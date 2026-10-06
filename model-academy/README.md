# 模型工坊：训练、微调、蒸馏与 Agent Harness

附加研究：[Agent Harness 运行观察室](public/harness-lab/index.html)。这是独立的单文件交互研究，包含固定版本源码、真实控制循环 trace、18 个机制对照及复现实验。启动本项目后访问 `/harness-lab/index.html`；研究资料包位于同目录的 `research-bundle.zip`。

面向非技术读者的四个严肃交互学习工坊。用可复现的实验、因果解释、故障诊断、迁移案例和独立复述，逐步理解复杂模型系统。所有章节可自由进入；没有积分、排行榜或娱乐化解锁。

| 工坊 | 内容 | 学习入口 |
| --- | --- | --- |
| 从零训练 | 原有 12 章、72 节原理、72 张图、12 个实验 | `#/train` |
| 微调 | 12 章、72 节讲解、12 个实验：数据、SFT、LoRA/QLoRA、偏好、遗忘、评测、上线 | `#/finetune/f1` |
| 蒸馏 | 12 章、72 节讲解、12 个实验：教师信号、数据核验、软目标、容量、迁移、路由成本 | `#/distill/d1` |
| Agent Harness | 12 章、72 节讲解、16 种执行案例：从零组装、状态、工具、审批、记忆、恢复与回归 | `#/harness/h1` |

新增三课另含 72 道诊断题、36 个迁移案例、36 次独立解释与自评、42 条可跨章节查阅的概念解释。原训练课程及其 `model-academy-v1` 记录保持独立。

## 学习方式

1. 从一个具体问题出发，先预测改变条件后的结果。
2. 运行实验，只改变一个条件，保存两组对照。
3. 检查具体数据、消息或执行轨迹，解释差异来自哪里。
4. 逐层阅读直觉、机制、计算、验证与适用边界。
5. 把原理用到新案例；用自己的话解释，再与要点对照。
6. 导出实验与解释，之后不看笔记再回顾。

数值实验明确标记 **公式计算**、**真实微型训练** 或 **固定情景推演**。真实微型训练实际计算梯度，但不是完整 LLM 训练。固定教学评测数据不能作为真实模型性能预测。

Harness 使用确定性的脚本模型和本地模拟工具，能真实推进状态、改变模拟账本、暂停审批、取消、比较故障和运行案例矩阵；没有外部模型、真实付款或外发。隔离、摘要和并行开关用于解释系统边界，不是生产级实现。回归不会自动代替人批准动作。

## 本地运行

使用 Node.js 24，在仓库根目录执行：

```bash
npm install --global pnpm@11.25.0
cd model-academy
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev --host 0.0.0.0
```

打开终端显示的 HTTP 地址。首页是四工坊入口。无需 API key、账号或后端服务。

```bash
pnpm typecheck
pnpm build
pnpm preview --host 0.0.0.0
```

生产文件在 `dist/`，必须经 HTTP 服务访问，不能直接双击 `index.html`。

## 可下载资料

网页「资料与记录」及 `public/workshop/` 提供：

| 文件 | 用途 |
| --- | --- |
| `complete-handbook.md` | 三课完整讲义、实验说明、案例、诊断答案与来源 |
| `learning-guide.md` | 如何使用预测、对照、反事实、迁移和间隔回顾 |
| `mini_harness.py` | 标准库 Python Harness：精确审批、SQLite 幂等账本、预算、取消与未知结果恢复 |
| `test_mini_harness.py` | 参数、权限、审批、注入、超时、取消、幂等与恢复测试 |
| `fine_tune_and_distill.py` | 真实微型梯度训练及解释，与浏览器数值互相核验 |
| `test_training.py` | 梯度与训练性质测试 |
| `workshop-materials.zip` | 上述讲义与 Python 教具的打包下载 |

运行 Python 教具不需第三方依赖：

```bash
cd public/workshop
python3 mini_harness.py
python3 fine_tune_and_distill.py
python3 -m unittest -v test_mini_harness test_training
```

`mini_harness.py --help` 查看具体场景与运行方式。教学实现不能直接当作真实支付或生产 Agent 服务；生产化还需要真实接口契约、授权系统、持久状态、并发与对抗测试。

课程正文修改后，重新生成讲义：

```bash
node public/workshop/export-handbook.mjs
```

## 学习记录与数据

- 原训练进度：`model-academy-v1`。
- 新课程进度：`model-workshop-v2-finetune` / `distill` / `harness`。
- Harness 草稿与对照轨迹：`harness-workbench-v3-章节索引`。
- 主记录包含实验设置、预测、结果、观察、阅读、自测、案例选择、解释和自评；没有自动能力评分。
- 新课可导出 Markdown 学习报告与 JSON 备份，并导入当前课程的有效备份。导入会替换本课记录。
- 换浏览器、换域名、清理网站数据不会自动迁移。localStorage 不可用时仍可学习，并通过导出保存。
- 没有自动上传、云同步或自动创建云文档；Markdown 可自行放入常用云文档。
- Harness 正在等待的审批不会跨页面刷新自动恢复成批准；保存的轨迹只供复盘。

每个数值实验记录完成需要两组不同设置、一个满足条件的结果与本人观察；Harness 需要同一案例的成功与失效对照及文字解释。自评完成只是过程记录，不代表系统证明用户已掌握。

## 验证

业务逻辑测试可直接用 Node.js 24 运行，不依赖前端包安装：

```bash
node qa/original-training.test.mjs
node qa/workshop-simulations.test.mjs
node qa/workshop-storage.test.mjs
node qa/workshop-harness.test.mjs
```

- 原训练数学：22 项检查；覆盖 BPE、注意力、优化器、采样、1,536 种显存设置与完整 bigram 梯度。
- 新实验数值：45 项检查；24 个目标可达，2,005 组合法参数覆盖。
- 存储：34 项检查，覆盖损坏记录、参数边界、重复证据与空复述。
- Harness：47 项检查；16 个基线情景、12 个失效对照及 192 组单模块故障。
- Python：35 项标准库测试，并与浏览器模拟公式交叉核验。
- 浏览器：`qa/workshop-browser.py` 为可重复 Playwright 验收脚本；运行时需要 Chromium、Python Playwright 和已启动的网站。最新结果以 `qa/` 中的实际验收记录为准。

原游戏的历史检查见 `qa/validation.md` 与 `qa/github-export.md`；这些历史结果不替代本次新版本的浏览器验收。

## GitHub Pages 与其它静态托管

已保留 `.github/workflows/model-academy-pages.yml`。在 GitHub 的 **Settings → Pages** 将 **Source** 设为 **GitHub Actions**，然后在 **Actions → Deploy model academy to Pages** 手动运行工作流。

默认地址为 `https://callmecc-wsm.github.io/hhh/`，需工作流成功部署后才可访问新版本。四工坊源码分支为 `feat/four-learning-workshops`；合并前查看源码需选择该分支。源码上传不代表网站已部署。

| 配置 | 值 |
| --- | --- |
| 项目根目录 | `model-academy` |
| Node | `24` |
| 安装 | `pnpm install --frozen-lockfile --ignore-scripts` |
| 构建 | `pnpm build` |
| 输出 | `dist` |
| 环境变量 | 无 |

Vite 使用相对资源路径，章节使用 hash 路由，兼容 `/hhh/` 子路径。无需服务器路由回退。

## 源码结构

| 路径 | 内容 |
| --- | --- |
| `src/main.tsx` | 四工坊入口 |
| `components/academy/`、`lib/academy/` | 原训练课程与实验 |
| `components/workshop/workshop.tsx` | 新入口、课程导航、阅读、判断、复述、词典与导出 |
| `components/workshop/lab.tsx` | 数值实验控件、结果、曲线与对照 |
| `components/workshop/harness-lab.tsx` | 从零组装、单步轨迹、审批与案例回归 |
| `lib/workshop/*-course.ts` | 三课完整内容 |
| `lib/workshop/*-labs.ts`、`numerics.ts` | 可复现公式与微型梯度训练 |
| `lib/workshop/harness-engine.ts` | 确定性本地状态机与模拟工具 |
| `lib/workshop/storage.ts` | 记录校验、导出与完成条件 |
| `lib/workshop/glossary.ts` | 42 条白话概念与跨章节关联 |
| `public/course/` | 原训练课程的图片、讲义和实现 |
| `public/workshop/` | 新增讲义与可运行 Python 教具 |
| `qa/` | 测试脚本、设计约束和验收结果 |
