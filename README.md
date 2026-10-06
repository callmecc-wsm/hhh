# HHH

[模型工坊完整源码、学习资料与运行说明](model-academy/README.md)

`model-academy/` 包含四个严肃交互学习工坊：

- **从零训练**：保留原有 12 章、72 节原理、72 张图与 12 个实验。
- **微调**：12 章，数据、真实微型梯度更新、LoRA/QLoRA、偏好、遗忘、评测与发布。
- **蒸馏**：12 章，教师信号、数据核验、软目标、学生容量、迁移与成本路由。
- **Agent Harness**：12 章，从零组装、单步执行、参数校验、审批、记忆、重试、16 种故障与任务案例。

新增三课共 216 节讲解、24 个数值实验、72 道诊断题、36 个迁移案例、42 条概念解释；提供学习记录导出、完整讲义及可运行 Python 教具。

以理解、因果解释与迁移为目标，不设积分、排行榜或娱乐化解锁。新内容已写入源码；是否已上线以部署工作流状态为准。

## Agent Harness 源码研究

[交互研究工作台](model-academy/public/harness-lab/index.html) · [源码、实验与证据](agent-harness-research/README.md) · [复现资料包](model-academy/public/harness-lab/research-bundle.zip)

覆盖 7 个研究对象、18 个机制、固定 commit 的源码入口和真实控制循环 trace。下载 HTML 用浏览器打开，或启动模型工坊后访问 `/harness-lab/index.html`。


## 国家发展实验室

[源码与运行说明](country-lab/README.md) · [在线体验](https://country-causal-lab.macyu536.chatgpt.site)

韩国、新加坡、阿根廷共 9 个十年回合：观察条件、选择政策、封存预测、揭晓历史、比较结果并复盘因果。

## Coding Agent 研究

[研究阅读入口与复现说明](coding-agent-research/README.md) · [完整文字稿与来源](coding-agent-research/research.md)

从任务结构与底层系统约束分析 Coding Agent 与通用 Work / Computer Agent 的产品边界，附离线交互版。

## 国运 · 国家发展实验室

[源码与运行说明](nation-lab/README.md) · [在线体验](https://nation-development-lab.macyu536.chatgpt.site)

模拟器位于 `nation-lab/`：韩国、阿根廷、新加坡共 9 轮历史决策，支持预测封存、历史揭示、因果复盘与判断导出。

## AI 论文训练场

[完整源码与运行说明](paper-lab/README.md) · [在线阅读训练场](https://paper-reading-lab.macyu536.chatgpt.site)

9 篇代表论文，包含历史场景、预测、27 段原文主动标注、实验审查、证据夹与迁移练习。源码位于 `paper-lab/`。
