# GitHub 独立部署检查

- 保留全部课程、实验、自测与复述功能；React 入口改为 Vite 客户端渲染。
- 将图片及讲义下载地址改为基于 `import.meta.env.BASE_URL` 的路径。
- TypeScript 检查及生产构建通过。
- 发布目录包含 72 张原理图、Markdown 讲义与 Python 教学实现。
- 原版完整交互验收记录见 `validation.md`。
- Pages 工作流需在 GitHub 设置中启用 Pages 后手动运行；本地构建检查不等同于线上部署成功。
- 独立安装锁定的依赖后，再次运行 `pnpm build` 成功；没有复用原站点的 node_modules。
- 课程 JSON 与原版逐字节一致；72 张构建后图片与源文件一致，两个下载附件存在。
- 构建入口的 JS、CSS 和 favicon 均使用相对路径，源码中无遗留 `/course/` 根路径。
