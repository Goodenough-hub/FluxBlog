# FluxBlog

基于 [AstroPaper](https://github.com/satnaing/astro-paper)（MIT）的静态技术博客，公开站点与在线写作后台位于同一仓库。

- 静态站点挂在 `/blog/` 子路径（`base: "/blog"`），完整站点地址由构建变量 `FLUXBLOG_SITE_URL` 注入
- 内容集合 schema：`title` / `slug` / `description` / `publishedAt` / `updatedAt` / `draft` / `tags` / `cover`
- Mermaid（按需客户端渲染）+ KaTeX（构建期输出）+ Shiki 双主题 + Pagefind 中文搜索
- 写作后台 `/blog/studio/`：草稿 CRUD、乐观锁自动保存、IndexedDB 恢复、图片上传、Git 发布

后端由 AppPilot 提供（独立 blog JWT / 账号 / 表族，与 FinFlow 隔离）。已发布内容以本仓库 `main` 为权威源，发布经 AppPilot → Git Data API 原子提交；GitHub Actions 只运行 CI，不自动部署。阿里云 `/var/www/fluxblog` 仅在明确要求时手动更新。

## 命令

```bash
npm install
npm run typecheck   # astro check
npm test            # vitest run
npm run build       # astro build && pagefind --site dist
npm run test:e2e    # 生产构建后的 Playwright 验证
```

构建时注入站点地址：`FLUXBLOG_SITE_URL=https://<host> npm run build`。

## License

MIT（继承自 AstroPaper 上游，见 `LICENSE`）。
