# 国运 · 国家发展实验室

基于真实历史的交互式国家发展学习工具。覆盖韩国、阿根廷、新加坡，每个国家 3 轮，共 9 轮。

[在线体验](https://nation-development-lab.macyu536.chatgpt.site)（Sites 私人站点，需要对应访问权限）。

## 本地运行

纯 HTML、CSS 和 JavaScript，无需安装依赖或构建。安装 Python 3 后，在仓库根目录运行：

```bash
python3 -m http.server 4173 --directory nation-lab/dist
```

打开 <http://localhost:4173>。也可将 `nation-lab/dist/` 作为站点根目录部署到静态托管服务。

## 实验流程

观察条件 → 选择优先政策与配套方向 → 封存增长预测及信心 → 揭示真实历史 → 比较结果 → 拆解因果并记录修正。

| 案例 | 三轮起点 | 最后观察年 |
| --- | --- | --- |
| 韩国 | 1960、1970、1980 年 | 1990 年 |
| 阿根廷 | 1970、1980、1990 年 | 2000 年 |
| 新加坡 | 1965、1975、1985 年 | 1995 年 |

每轮主要展示 4 项数据和 3 个约束，其他背景按需展开。复盘分别讨论结构性因素、政策选择、外部环境、运气与时点、归因的不确定性，并说明社会代价。

## 文件

| 文件 | 内容 |
| --- | --- |
| `dist/index.html` | 页面入口 |
| `dist/style.css` | 桌面与移动端样式 |
| `dist/app.js` | 交互流程、图表、本机存档与 Markdown 导出 |
| `dist/cases.js` | 三个国家的情境、政策选项、历史叙事与归因 |
| `dist/evidence.js` | 世界银行历史数据快照 |
| `dist/ARG.svg`、`dist/KOR.svg`、`dist/SGP.svg` | 国家地理轮廓 |

`dist/` 中的文件就是可编辑源码，未经过编译。此 GitHub 副本用于代码管理；提交不会自动更新既有 Sites 站点。

## 数据与边界

- **数据**：世界银行 WDI，2026-10-05 UTC 读取的历史修订序列；口径与外部链接可在应用「数据与来源」查看。
- **收入水平**：人均 GDP 使用当年现价美元。
- **增长**：使用固定 2015 年美元的实际人均 GDP，十年变化为 `(末年 / 初年 − 1) × 100%`。图表以初年为 100。
- **历史解释**：质性叙事与因果讨论为综合整理，不等同于识别政策净效应的统计估计。
- **地图**：来自 [Natural Earth / geo-countries](https://github.com/datasets/geo-countries)，采用现代边界，仅用于定位。
- **字体**：通过 Google Fonts 加载 Noto Sans SC 和 Noto Serif SC；不可用时使用系统字体。
- **存档**：浏览器 `localStorage`，键为 `nation-lab-v1`，不跨设备或站点同步。清除网站数据会删除记录，建议先导出。

系统记录政策取舍与预测，不生成反事实 GDP，也不把历史路径当作标准答案。未来叙事在交互中按轮次解锁；纯前端代码和数据文件仍可被查看，不用于保密或考试防作弊。

## 验证

源码导入前已完成九轮浏览器流程检查，覆盖预测解锁、原始判断保留、修正记录、刷新续玩、国家切换、记录导出与移动端布局。

可在本地使用 Node.js 检查脚本语法：

```bash
node --check nation-lab/dist/app.js
node --check nation-lab/dist/cases.js
node --check nation-lab/dist/evidence.js
```
