---
title: "关于"
description: "关于 FluxBlog 与本站。"
---

FluxBlog 是一个基于 [AstroPaper](https://github.com/satnaing/astro-paper) 改造的 Astro Node SSR 技术博客，公开站点与 Studio 写作后台前端位于同一仓库。

- 后端驱动：草稿、版本、图片、发布与搜索由 AppPilot 提供
- 数据权威：文章内容以 PostgreSQL `blog_drafts` 为权威源
- SSR 交付：服务端由 `fluxblog.service` 运行，静态资源由 nginx 提供
