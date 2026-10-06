# Python 学习资料验证记录

**日期**：2026-10-05。**环境**：Python 3.12.14、Node v24.19.0。**目录**：`model-academy`。

**结果**：35 项 Python 测试、8 个命令行情景、9 组网页/Python 数值对照均通过。资料 ZIP 解压后再次运行 35 项测试通过。完整讲义从最终审校后的 3 门课程、36 个章节生成，包含实验设置、默认结果、案例、测验参考、42 条术语释义和阅读来源边界。案例与测验答案使用 `content.ts` 稳定重排后的实际数据，选项与反馈保持对应。

| 验证 | 实际结果 | 覆盖 |
| --- | --- | --- |
| Harness 回归 | 28 项通过 | 角色与参数契约、具体审批、拒绝、取消、预算、注入后的越权阻断、幂等、未知结果恢复、SQLite 重启保留 |
| 数学与训练回归 | 7 项通过 | 初值、训练变化、错误标签后果、蒸馏分布、有限差分梯度、softmax 稳定性、非法输入 |
| 网页与 Python 一致性 | 9 组配置、1,382 个数值通过 | 逐步损失、权重、偏置、分布、KL、组合目标 |
| 最大数值误差 | `4.010680676458378e-15` | 判定容差为 `1e-11` |
| 命令行入口 | 8 种情景的终点与账本条数符合期望 | 包含退款已提交、状态却无法核验的人工处理终点 |
| ZIP 离线运行 | 解压后 35 项测试通过 | 4 个 Python 文件、2 个 Markdown 文件；不依赖仓库其它内容 |
| 缓存清理 | `public/workshop` 下无 `__pycache__` | 已增加局部 `.gitignore`，忽略 Python 缓存和模拟账本 |

## 复现命令

从 `model-academy` 目录运行：

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s public/workshop -p 'test_*.py' -q
node public/workshop/verify-numerics.mjs
node public/workshop/export-handbook.mjs
python3 public/workshop/package-materials.py
```

`stripTypeScriptTypes` 在此 Node 版本提示实验性 API 警告；导出和验证命令均正常退出。数值对照通过结构化子进程参数调用 Python，不拼接 shell 命令。

逐一运行命令行案例：

```bash
python3 public/workshop/mini_harness.py --scenario normal
python3 public/workshop/mini_harness.py --scenario invalid
python3 public/workshop/mini_harness.py --scenario reject
python3 public/workshop/mini_harness.py --scenario timeout
python3 public/workshop/mini_harness.py --scenario cancel
python3 public/workshop/mini_harness.py --scenario injection
python3 public/workshop/mini_harness.py --scenario unresolved
python3 public/workshop/mini_harness.py --scenario budget
```

| 情景 | 终点 | 模拟账本记录数 |
| --- | --- | --- |
| `normal` | `done` | 1 |
| `invalid` | `invalid_request` | 0 |
| `reject` | `denied` | 0 |
| `timeout` | `done` | 1 |
| `cancel` | `cancelled` | 0 |
| `injection` | `denied` | 0 |
| `unresolved` | `needs_review` | 1 |
| `budget` | `budget_exhausted` | 0 |

`timeout` 轨迹中只有 1 次 `refund`，随后是 `refund_status`。`unresolved` 保留已提交的账本记录与未知结果状态，不再次退款，也不伪称已回滚。

ZIP 检查与解压后回归：

```bash
PYTHONDONTWRITEBYTECODE=1 python3 - <<'PY'
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile
import subprocess
import sys

with TemporaryDirectory() as directory:
    with ZipFile('public/workshop/workshop-materials.zip') as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == 6
        archive.extractall(directory)
    subprocess.run(
        [sys.executable, '-m', 'unittest', '-q', 'test_mini_harness.py', 'test_training.py'],
        cwd=Path(directory) / 'model-workshop', check=True,
    )
PY
```

## 结论边界

- **模型**：Harness 使用确定性脚本响应；训练代码使用合成数据和固定教师 logits，未调用真实模型、网络或支付接口。
- **控制**：测试验证列出的本地情景与不变量，不证明通用提示注入防护或生产可靠率。非法动作检测不是基于恶意关键词。
- **审批**：库函数要求具体参数审批。命令行演示明确模拟用户批准；真实集成需要可信用户身份和 UI 路径。
- **持久化**：SQLite 保存模拟业务账本，不保存整个任务或对话。单服务事务和唯一键不等于跨服务绝对恰好一次。
- **取消**：停止后续动作，不保证撤回已提交副作用；示例没有线程并发或远端取消传播。
- **最终回答**：`done` 表示生成最终文字，不代表文字已经经过通用真实性验证。相关回归明确展示文字与账本可能不一致。
- **梯度**：微型实验真正更新参数，不能据此推断 Transformer 的学习曲线、能力增益、训练成本或上线收益。
- **资料**：参考链接继承 `sourceReadingNote`，本次未逐页在线核验；滚动文档、源代码和服务条款仍需按实际版本查证。
- **学习评价**：自评与固定案例通过只属于学习记录，不是能力认证。

**更新规则**：课程、实验或资料修改后，重新导出讲义并打包 ZIP；数学核心修改后，还要重跑数值一致性和梯度测试。
