---
title: "欢迎来到 FluxBlog"
slug: "欢迎来到fluxblog"
publishedAt: 2026-07-29
updatedAt: 2026-07-29
description: "FluxBlog 的第一篇示例文章：普通 Markdown、中文搜索内容与代码高亮。"
tags: ["公告", "示例"]
---

# 欢迎来到 FluxBlog

这是一篇用于验证构建产物的示例文章，同时为 Pagefind 提供中文搜索内容。FluxBlog 使用 Shiki 做代码高亮，支持双主题（浅色 / 暗色）。

## 中文搜索内容

为了验证 Pagefind 的中文索引，这里写一段普通正文：FluxBlog 是静态技术博客，部署在 `/blog/` 子路径下，所有内部链接、RSS、站点地图、图片与搜索资源都带 `/blog/` 前缀。

## 代码高亮

行内代码：`npm run build`。块级代码：

```ts
function greet(name: string): string {
  return `你好, ${name}`;
}

console.log(greet("FluxBlog"));
```

Python 示例：

```python
def fib(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
```

发布流程：在 Studio 写作 → AppPilot 草稿库 → GitHub 原子提交。GitHub Actions 只负责 CI；线上 `/var/www/fluxblog` 在需要时手动部署。
