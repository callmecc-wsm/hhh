# Agent Harness 运行观察室

先打开[交互研究工作台](../model-academy/public/harness-lab/index.html)。建议依次体验：成功运行 → 忽略失败测试 → 因果实验中的完成门槛 → 18 个机制中的双列对照。源码和原始 JSON 都可逐层展开，无须先读一份长报告。

页面是单文件 HTML，数据、脚本、样式全部内嵌，无 CDN 或模型 API。也可以执行 `python -m http.server 8765` 后访问 `http://localhost:8765`。复现包下载链接要求 ZIP 与 HTML 同目录；结构化证据 JSON 可直接在页面下载。

## 内容

- 7 个研究对象，18 个机制的逐项对照；87 个固定版本的源码／官方文档入口。
- 5 条控制循环录制：mini 3 条、Kimi 1 条、DeepSeek 1 条。
- Context、Tool Call、State Inspector 与实际事件时序图。
- 压缩阈值、工具输出保护、checkpoint、公开 Claude Stop hook、worktree 实验。
- 模型与 Harness 责任划分，以及标明为研究判断的下一代架构。

## 实验范围

| 对象 | 实际完成 |
|---|---|
| Codex | 固定 SHA，追 core/session、工具、策略、压缩与 AgentControl；未编译运行 Rust 核心 |
| Claude Code | 阅读官方 SDK、公开 sandbox-runtime 与插件；真实执行 Ralph Stop hook；私有核心未知 |
| Kimi | 真实 KimiSoul、Kosong、KimiToolset、Shell、Context；脚本化 provider；63 个上游测试与 2 个自建实验 |
| DeepSeek Harness | 真实核心 Cordis 插件组合；103 个上游测试与 1 个自建 trace；非完整 shipped-profile E2E |
| Gemini | 核心链阅读；AST 提取未修改的折叠函数并编译运行；非完整 CLI |
| OpenCode | 核心循环、processor、压缩、权限、worktree 阅读；未运行 |
| mini-SWE-agent | DefaultAgent + LocalEnvironment + DeterministicModel，真实 shell 与磁盘，3 个因果场景 |

脚本化模型用于隔离控制逻辑，不能测线上模型能力或误完成概率。DeepSeek trace 中的 verify 输出是受控 FAIL 文本；Kimi 与 mini 的测试是实际 Python 进程。Kimi 使用上游测试 fixture 的 yolo=True，临时目录不是 sandbox。

## 复现

需要 Git、Python 3.12、uv、Node 24、pnpm、bash、jq、perl、sed。需要网络下载公开源码与依赖，不需要模型密钥。

从资料包根目录运行：

```bash
python fetch_sources.py
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements-lock.txt
cd repos/deepseek-harness
pnpm install --frozen-lockfile --ignore-scripts
cd ../..
ln -s ../repos/deepseek-harness/node_modules experiments/node_modules
.venv/bin/python experiments/mini_run.py
.venv/bin/python -m pytest experiments/kimi/test_trace.py -q
node experiments/gemini_collapse.mjs
.venv/bin/python experiments/claude_hook.py
.venv/bin/python experiments/git_worktree.py
cd repos/deepseek-harness
pnpm exec vitest run --config ../../experiments/deepseek.config.ts
pnpm exec vitest run packages/core/agent-loop/tests/loop.spec.ts packages/core/agent-loop/tests/tool-order.spec.ts packages/core/agent-loop/tests/request-reconstruction.spec.ts packages/core/agent-loop/tests/request-error.spec.ts
cd ../kimi-cli
../../.venv/bin/python -m pytest tests/core/test_simple_compaction.py tests/core/test_context.py tests/core/test_context_pending_tokens.py tests/core/test_kimisoul_retry_recovery.py tests/core/test_kimisoul_turn_balance.py -q
cd ../..
python build_sources.py
python build_site.py
```

可编辑内容在 `content.py`，界面在 `site/`，生成页面在 `dist/index.html`。`LAB_INSTALL_DIR=/目标目录 python build_site.py` 可把生成页面复制到现有静态站点。交互页面和复现 ZIP 同时保存在 `../model-academy/public/harness-lab/`。

界面检查另需 Python 的 `playwright` 包与 Chromium。启动 `dist/` 的 HTTP 服务后运行 `python qa/check_ui.py`；脚本默认使用 `/usr/bin/chromium`。`python package_bundle.py` 打包本研究，并生成逐文件 SHA-256 清单。复现包不含依赖和整仓源码，`fetch_sources.py` 负责取回固定版本。

原始 trace、上游测试日志、官方文档快照与完整 SHA 在 `evidence/`。`qa/` 保存浏览器检查、截图与已知限制。复现不会依赖已有用户仓库；有副作用的实验使用新建临时目录。

## 证据边界

源码事实、实测、官方说明和研究推断在界面分别标记。GitHub 的固定 SHA 链接是原始代码；片段不保证每种配置都走该分支。部分官方 Anthropic 页面返回 HTTP 403，未把未获取的文章当成已阅读证据。Codex Cloud 的新文档与 Legacy 文档分开保留。Cloud 调度控制面的实现未被本研究验证。

浏览器自动化遍历所有事件、Inspector、机制、源码弹窗及 390px 页面布局。托管浏览器阻止 file:// 导航，因此用 HTTP 加载后断网验证单文件交互，不声称在该托管浏览器中测试过双击打开。

第三方源码片段仅用于本次技术研究与引用，权利归各仓库作者。版本和许可见 `THIRD_PARTY.md` 与 `licenses/`。
