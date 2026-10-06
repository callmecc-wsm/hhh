#!/usr/bin/env python3
"""标准库里的真实微型梯度下降，与网页 numerics.ts 使用相同公式和初值。

python3 fine_tune_and_distill.py --experiment compare
python3 fine_tune_and_distill.py --experiment finetune --steps 60 --noise 2
python3 fine_tune_and_distill.py --experiment distill --steps 50 --alpha 1 --temperature 2

这里真的更新参数，但只训练 3 参数分类器或 4 个 logits，不训练 Transformer。
所有数据合成、教师 logits 固定；没有调用任何品牌模型，也没有访问网络。
"""

from __future__ import annotations

import argparse
import json
import math


def sigmoid(x: float) -> float:
    # 分支避免 exp 在绝对值很大的输入上溢出。
    return 1 / (1 + math.exp(-x)) if x >= 0 else math.exp(x) / (1 + math.exp(x))


def softmax(logits: list[float], temperature: float = 1) -> list[float]:
    if temperature <= 0 or not math.isfinite(temperature):
        raise ValueError("温度必须为有限正数")
    if not logits or any(not math.isfinite(v) for v in logits):
        raise ValueError("logits 必须是非空有限数值列表")
    largest = max(logits)
    exp = [math.exp((v - largest) / temperature) for v in logits]
    return [v / sum(exp) for v in exp]


def kl(q: list[float], p: list[float]) -> float:
    if any(v > 0 and p[i] == 0 for i, v in enumerate(q)):
        return math.inf
    return sum(v * (math.log(v) - math.log(p[i])) for i, v in enumerate(q) if v > 0)


def cross_entropy(q: list[float], p: list[float]) -> float:
    if any(v > 0 and p[i] == 0 for i, v in enumerate(q)):
        return math.inf
    return -sum(v * math.log(p[i]) for i, v in enumerate(q) if v > 0)


def softplus(x: float) -> float:
    return max(x, 0) + math.log1p(math.exp(-abs(x)))


def validate_training(steps: int, lr: float) -> None:
    if type(steps) is not int or not 0 <= steps <= 10_000:
        raise ValueError("教学步数应为 0–10000 的整数")
    if not math.isfinite(lr) or not 0 < lr <= 10:
        raise ValueError("教学学习率应在 (0, 10] 内")


def linear_fit(steps: int = 60, lr: float = 0.3, noise: int = 0, replay: int = 0) -> dict:
    validate_training(steps, lr)
    if type(noise) is not int or not 0 <= noise <= 4:
        raise ValueError("噪声标签数应为 0–4 的整数")
    if type(replay) is not int or not 0 <= replay <= 100:
        raise ValueError("旧样本回放数应为 0–100 的整数")

    # 每行 = [横向特征 x1, 纵向特征 x2, 二分类标签 y]。
    original = [[1, 0, 1], [-1, 0, 0], [.8, .2, 1], [-.8, -.2, 0]]
    domain = [[0, 1, 1], [0, -1, 0], [.2, .8, 1], [-.2, -.8, 0]]
    # 只翻转训练标签，干净目标集不变，才能观察“学错”而非自我证明。
    data = [[x1, x2, 1 - label if i < noise else label] for i, (x1, x2, label) in enumerate(domain)]
    data += [original[i % len(original)][:] for i in range(replay)]
    w, b = [2.0, -0.4], 0.0
    losses, general, target = [], [], []

    def loss(rows):
        result = 0.0
        for x1, x2, label in rows:
            logit = w[0] * x1 + w[1] * x2 + b
            # 与交叉熵等价，但避免概率接近 0/1 时先取整再取 log。
            result += softplus(-logit) if label else softplus(logit)
        return result / len(rows)

    for step in range(steps + 1):
        losses.append(loss(data))
        general.append(loss(original))
        target.append(loss(domain))
        if step == steps:
            break
        gradient = [0.0, 0.0, 0.0]
        for x1, x2, label in data:
            error = sigmoid(w[0] * x1 + w[1] * x2 + b) - label
            # 二分类交叉熵对 logit 的导数 = 预测概率 - 标签。
            gradient[0] += error * x1
            gradient[1] += error * x2
            gradient[2] += error
        w = [value - lr * gradient[i] / len(data) for i, value in enumerate(w)]
        b -= lr * gradient[2] / len(data)
    return {"w": w, "b": b, "losses": losses, "general": general, "target": target,
            "probabilities": [sigmoid(w[0] * x1 + w[1] * x2 + b) for x1, x2, _ in domain]}


def distill_gradient(logits: list[float], teacher: list[float], temperature: float, alpha: float) -> list[float]:
    q = softmax(teacher, temperature)
    p = softmax(logits, temperature)
    hard = softmax(logits)
    # L = α T² KL(q_T || p_T) + (1-α) CE(y, p_1)。
    # softmax(z/T) 带来 1/T，乘 T² 后的梯度留下 T。
    return [alpha * temperature * (p[i] - q[i]) + (1 - alpha) * (hard[i] - (1 if i == 0 else 0)) for i in range(len(logits))]


def distill_fit(steps: int = 50, lr: float = 0.3, temperature: float = 2, alpha: float = 1, teacher: list[float] | None = None) -> dict:
    validate_training(steps, lr)
    if not math.isfinite(alpha) or not 0 <= alpha <= 1:
        raise ValueError("软目标权重 α 必须在 [0, 1] 内")
    teacher = [3, 1, 0, -1] if teacher is None else teacher
    if len(teacher) != 4 or any(not math.isfinite(v) for v in teacher):
        raise ValueError("本实验固定为 4 个有限 teacher logits")
    logits, history, objective = [0.0] * 4, [], []
    q = softmax(teacher, temperature)
    for step in range(steps + 1):
        divergence = kl(q, softmax(logits, temperature))
        history.append(divergence)
        objective.append(alpha * temperature ** 2 * divergence + (1 - alpha) * -math.log(softmax(logits)[0]))
        if step == steps:
            break
        gradient = distill_gradient(logits, teacher, temperature, alpha)
        logits = [value - lr * gradient[i] for i, value in enumerate(logits)]
    return {"teacher": q, "student": softmax(logits, temperature), "serving": softmax(logits), "history": history, "objective": objective, "logits": logits}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--experiment", choices=["finetune", "distill", "compare"], default="compare")
    parser.add_argument("--steps", type=int, default=60)
    parser.add_argument("--lr", type=float, default=.3)
    parser.add_argument("--noise", type=int, default=0)
    parser.add_argument("--replay", type=int, default=0)
    parser.add_argument("--temperature", type=float, default=2)
    parser.add_argument("--alpha", type=float, default=1)
    parser.add_argument("--json", action="store_true", help="输出所有逐步数据，便于与网页或自己的实验比较")
    args = parser.parse_args()
    try:
        if args.experiment == "finetune":
            result = linear_fit(args.steps, args.lr, args.noise, args.replay)
            summary = {"真实更新": "两个权重和一个偏置", "初始训练损失": result["losses"][0], "最终训练损失": result["losses"][-1], "最终干净目标损失": result["target"][-1], "最终旧任务损失": result["general"][-1], "权重": result["w"], "偏置": result["b"], "目标样本概率": result["probabilities"]}
        elif args.experiment == "distill":
            result = distill_fit(args.steps, args.lr, args.temperature, args.alpha)
            summary = {"真实更新": "四个学生 logits", "初始 KL": result["history"][0], "最终 KL": result["history"][-1], "训练温度": args.temperature, "教师软分布": result["teacher"], "学生训练分布": result["student"], "学生 T=1 分布": result["serving"]}
        else:
            result = {"干净标签": linear_fit(args.steps, args.lr), "两个错误标签": linear_fit(args.steps, args.lr, noise=2), "只学硬标签": distill_fit(args.steps, args.lr, args.temperature, alpha=0), "只学软目标": distill_fit(args.steps, args.lr, args.temperature, alpha=1)}
            summary = {name: ({"训练损失": value["losses"][-1], "干净目标损失": value["target"][-1]} if "losses" in value else {"教师到学生 KL": value["history"][-1], "学生训练分布": value["student"]}) for name, value in result.items()}
    except ValueError as error:
        parser.error(str(error))
    print(json.dumps(result if args.json else summary, ensure_ascii=False, indent=2))
    if not args.json:
        print("\n读数边界：合成数据上的真实小模型训练；不是大模型能力、商业模型质量或训练费用的实测。")


if __name__ == "__main__":
    main()
