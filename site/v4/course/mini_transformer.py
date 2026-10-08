"""模型工坊：现代 PreNorm 解码器的最小教学实现。

需要 Python 3.10+ 和 PyTorch 2.x：python mini_transformer.py --steps 120
此文件与网页的 64 参数 bigram 实验不同：这里真的实现了 Transformer。
展示完整的前向、交叉熵、反向、AdamW 更新与自回归生成。
数据极小，只适合检查计算链条；不代表泛化能力，也不用于生产。

参考：
https://arxiv.org/abs/1706.03762
https://arxiv.org/abs/2104.09864 (RoPE)
https://arxiv.org/abs/1910.07467 (RMSNorm)
https://arxiv.org/abs/2002.05202 (SwiGLU)
https://arxiv.org/abs/1711.05101 (AdamW)

验证范围：此交付环境未安装 PyTorch，仅检查了 Python 语法。
脚本内置张量形状、因果遮罩与损失下降断言，运行时会执行。
"""
import argparse
import torch
from torch import nn
from torch.nn import functional as F


class RMSNorm(nn.Module):
    def __init__(self, width, eps=1e-6):
        super().__init__()
        self.scale = nn.Parameter(torch.ones(width))
        self.eps = eps

    def forward(self, x):
        # [B,N,d]；按最后一个维度的均方根归一化，不减均值。
        rms_inv = torch.rsqrt(x.float().square().mean(-1, keepdim=True) + self.eps)
        return x * rms_inv.to(x.dtype) * self.scale


def rope(x):
    # x: [B,H,N,D]。每一对相邻坐标使用不同频率。
    n, d = x.shape[-2:]
    assert d % 2 == 0
    freq = 1.0 / (10000 ** (torch.arange(0, d, 2, device=x.device).float() / d))
    angles = torch.arange(n, device=x.device).float()[:, None] * freq[None, :]
    cos, sin = angles.cos().to(x.dtype), angles.sin().to(x.dtype)
    even, odd = x[..., 0::2], x[..., 1::2]
    return torch.stack((even*cos-odd*sin, even*sin+odd*cos), dim=-1).flatten(-2)


class Attention(nn.Module):
    def __init__(self, width, heads):
        super().__init__()
        assert width % heads == 0 and (width // heads) % 2 == 0
        self.heads = heads
        self.qkv = nn.Linear(width, 3*width, bias=False)
        self.out = nn.Linear(width, width, bias=False)

    def forward(self, x):
        b, n, d = x.shape
        q, k, v = self.qkv(x).chunk(3, dim=-1)
        # [B,N,d] -> [B,H,N,D]，其中 d=H*D。
        q, k, v = [t.view(b,n,self.heads,d//self.heads).transpose(1,2) for t in (q,k,v)]
        q, k = rope(q), rope(k)
        # 直接写出公式以便与网页对应；生产通常用优化后的 SDPA 内核。
        scores = q @ k.transpose(-2,-1) / (d//self.heads)**0.5
        future = torch.ones(n,n,device=x.device,dtype=torch.bool).triu(1)
        scores = scores.masked_fill(future, float('-inf'))
        weights = scores.softmax(dim=-1)
        mixed = weights @ v
        mixed = mixed.transpose(1,2).contiguous().view(b,n,d)
        return self.out(mixed)


class SwiGLU(nn.Module):
    def __init__(self, width, hidden):
        super().__init__()
        self.gate = nn.Linear(width, hidden, bias=False)
        self.up = nn.Linear(width, hidden, bias=False)
        self.down = nn.Linear(hidden, width, bias=False)

    def forward(self, x):
        return self.down(F.silu(self.gate(x)) * self.up(x))


class Block(nn.Module):
    def __init__(self, width, heads, hidden):
        super().__init__()
        self.norm1, self.norm2 = RMSNorm(width), RMSNorm(width)
        self.attention = Attention(width, heads)
        self.ffn = SwiGLU(width, hidden)

    def forward(self, x):
        x = x + self.attention(self.norm1(x))
        x = x + self.ffn(self.norm2(x))
        return x


class TinyTransformer(nn.Module):
    def __init__(self, vocab_size, width=64, heads=4, hidden=160, layers=2):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, width)
        self.blocks = nn.ModuleList([Block(width,heads,hidden) for _ in range(layers)])
        self.norm = RMSNorm(width)
        self.head = nn.Linear(width, vocab_size, bias=False)
        self.apply(self._init)

    @staticmethod
    def _init(module):
        if isinstance(module, (nn.Linear, nn.Embedding)):
            nn.init.normal_(module.weight, std=0.02)

    def forward(self, ids):
        x = self.embed(ids)
        for block in self.blocks:
            x = block(x)
        return self.head(self.norm(x))  # logits: [B,N,V]，不是概率

    @torch.no_grad()
    def generate(self, ids, count=4, temperature=0.5):
        assert temperature > 0
        self.eval()
        for _ in range(count):
            logits = self(ids)[:, -1, :]  # 取最后一个位置预测下一词
            p = (logits / temperature).softmax(dim=-1)
            ids = torch.cat([ids, torch.multinomial(p, 1)], dim=1)
        return ids


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--steps', type=int, default=120)
    args = parser.parse_args()
    if args.steps < 1:
        parser.error('--steps 必须大于 0')
    torch.manual_seed(42)
    torch.set_num_threads(2)
    vocab = ['小猫','小狗','喜欢','坐在','鱼','骨头','地毯','。']
    sequences = torch.tensor([[0,2,4,7],[1,2,5,7],[0,3,6,7],[1,3,6,7]])
    x, y = sequences[:, :-1], sequences[:, 1:]
    model = TinyTransformer(len(vocab))
    assert model(x).shape == (4,3,8)
    # 因果性自检：修改未来 token，不得改变之前位置的输出。
    model.eval()
    altered = x.clone()
    altered[:, -1] = (altered[:, -1] + 1) % len(vocab)
    with torch.no_grad():
        assert torch.allclose(model(x)[:, :-1],model(altered)[:, :-1],atol=1e-5)
    # 对矩阵权重施加衰减；归一化 scale 等一维参数不衰减。
    optimizer = torch.optim.AdamW([
        {'params':[p for p in model.parameters() if p.ndim >= 2], 'weight_decay':0.01},
        {'params':[p for p in model.parameters() if p.ndim < 2], 'weight_decay':0.0},
    ], lr=0.003, betas=(0.9,0.999))
    model.train()
    losses = []
    for step in range(args.steps):
        optimizer.zero_grad(set_to_none=True)
        logits = model(x)
        # F.cross_entropy 内部处理 log-softmax，不要先手工 softmax。
        loss = F.cross_entropy(logits.reshape(-1,len(vocab)), y.reshape(-1))
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        losses.append(loss.item())
        if step % 20 == 0:
            print(f'step={step:3d}, train_loss={loss.item():.4f}')
    if args.steps >= 80:
        assert losses[-1] < losses[0], '本次训练损失未降低，请检查运行环境与数值。'
    for context in ([0,2], [1,2]):
        ids = model.generate(torch.tensor([context]), count=2)
        print(' '.join(vocab[i] for i in ids[0].tolist()))
    print('此结果来自训练语料，不是独立测试；未检验真实语言泛化。')


if __name__ == '__main__':
    main()
