# Coding Agent 的产品边界研究

研究问题：未来 2～4 年，Coding Agent 会继续作为独立产品类别，还是被通用 Work / Computer Agent 吸收？

研究截至 **2026-10-05**，预测覆盖 2027、2028、2030。产品事实、战略推断和预测分别标注，附 23 组来源。

## 阅读

- [完整文字稿与证据索引](research.md)：可直接在 GitHub 阅读。
- [交互研究](index.html)：下载后用浏览器打开，无需服务器，支持离线阅读。

交互版包含任务结构对照、19 项对象分类、真实 Astropy Issue 的机制推演、软件生产链、十个问题、公司战略下注、演化时间线和四种分叉情景。真实任务展示为机制推演，未进行跨产品对照实验。

## 复现交互版

需要 Python 3.9 或更新版本。在本目录执行：

```sh
python -m pip install -r requirements.txt
python build.py
```

`research.md` 保存研究正文和来源；`build.py` 生成 `index.html`，同时嵌入完整文字稿下载链接。修改研究后重新运行构建，并提交更新后的 HTML。
