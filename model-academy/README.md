# 模型工坊 · 从零训练一个大模型

附加研究：[Agent Harness 运行观察室](public/harness-lab/index.html)。这是独立的单文件交互研究，包含固定版本源码、真实控制循环 trace、18 个机制对照及复现实验。启动本项目后访问 `/harness-lab/index.html`；研究资料包位于同目录的 `research-bundle.zip`。

完整可编辑的交互学习网页。包含 12 章、72 节原理、72 张原理图、12 个主实验、36 道判断题和 12 次费曼复述自评。

面向希望理解大模型技术的产品经理和学生。课程依次覆盖下一词预测、数据与分词、线性代数、注意力、位置编码与因果掩码、Transformer 架构、交叉熵与反向传播、优化器、训练系统、对齐、推理采样和评测。

## 本地运行

安装 Node.js 24，然后在仓库根目录执行：

```bash
npm install --global pnpm@11.25.0
cd model-academy
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
```

终端会显示本地访问地址。检查并生成生产版本：

```bash
pnpm build
pnpm preview
```

构建产物在 `dist/`。必须用 HTTP 服务打开，不能直接双击 `index.html`。

## GitHub Pages 部署

仓库已包含 `.github/workflows/model-academy-pages.yml`，无需填写密钥。

1. 打开仓库 **Settings → Pages**，将 **Source** 设为 **GitHub Actions**。
2. 打开 **Actions → Deploy model academy to Pages**。
3. 点击 **Run workflow**，选择 `master`，再点击运行。
4. 等待 `build` 和 `deploy` 成功，在运行详情中打开部署地址。

当前仓库默认地址为 `https://callmecc-wsm.github.io/hhh/`；该地址需成功部署后才可访问。工作流发布 `model-academy/dist` 的内容，因此网址不再带 `model-academy/`。

每次修改代码后，推送到 `master` 会自动检查构建；需要发布时再手动运行上述工作流。GitHub Pages 需先在仓库设置中启用。此提交准备了部署流程，本身不代表网站已上线。

## 其他静态部署平台

| 设置 | 值 |
| --- | --- |
| 项目根目录 | `model-academy` |
| Node.js | `24` |
| 安装命令 | `pnpm install --frozen-lockfile --ignore-scripts` |
| 构建命令 | `pnpm build` |
| 输出目录 | `dist` |
| 环境变量 | 无 |

Vite 使用相对资源路径；课程图片和下载文件随站点部署，兼容 `/hhh/` 子路径及自定义域名。所有章节在同一个页面切换，不依赖服务器路由。

## 源码结构

| 路径 | 内容 |
| --- | --- |
| `src/main.tsx` | React 入口 |
| `components/academy/` | 学习界面与全部交互实验 |
| `components/ui/` | 界面基础组件 |
| `lib/academy/original.json` | 72 节完整正文、公式、要点与原始资料链接 |
| `lib/academy/curriculum.ts` | 实验目标、深入讲解、判断题、复述题与量规 |
| `lib/academy/math.ts` | 注意力、梯度、优化器、采样和微型模型等计算 |
| `app/globals.css` | 视觉与响应式样式 |
| `public/course/figures/` | 72 张 WebP 原理图 |
| `public/course/课程讲义与资料.md` | 原视频完整讲义 |
| `public/course/mini_transformer.py` | 带注释的 PyTorch 教学实现 |
| `qa/` | 检查记录 |

这是原游戏的独立静态部署版本。界面、课程、实验及数据资产完整保留，运行入口改为 React + Vite。没有依赖原站点的登录、云数据库或专属部署服务。原视频 MP4 不属于游戏运行资源，未包含在此目录。

## 学习记录与实验范围

进度与复述保存在当前浏览器的 localStorage（键为 `model-academy-v1`）。换域名、浏览器、设备或清除网站数据不会自动迁移记录。无账号同步、外部模型调用或自动文本评分。

实验按公式实时计算；人工情景、资源估算和模拟评测在页面注明。第 12 章的微型语言模型实际执行训练，但不是 Transformer。复述使用明确的自评量规，不等同于自动判定掌握程度。

Python 附录需要另行安装 PyTorch。此前仅通过 Python 语法检查，没有在当前环境运行训练。课程内的 WebMCP 是可选增强，核心功能不依赖它。

## 验证

原游戏的 12 个主实验、阅读记录、错题反馈、复述自评、刷新恢复和章节切换已验证；详见 `qa/validation.md`。静态部署适配的检查记录见 `qa/github-export.md`。

## 部署资料

- [Vite 静态部署文档](https://vite.dev/guide/static-deploy.html)
- [GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
