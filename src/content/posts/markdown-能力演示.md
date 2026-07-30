---
title: "Markdown 能力：Mermaid 与 KaTeX"
slug: "markdown-能力演示"
publishedAt: 2026-07-29
description: "验证 FluxBlog 的 Mermaid 图表与 KaTeX 数学公式渲染。"
tags: ["示例", "Mermaid", "KaTeX"]
---

# Mermaid 与 KaTeX

本文同时包含 Mermaid 图表、行内与块级公式、多语言代码块，用于构建夹具验证。

## Mermaid

仅在包含图表的文章中按需加载客户端渲染：

```mermaid
flowchart LR
    Studio -->|草稿| AppPilot
    AppPilot -->|Git 提交| GitHub
    GitHub -->|Actions CI| 构建
    构建 -->|手动部署| 线上
```

## KaTeX 行内公式

质能方程 $E = mc^2$，欧拉公式 $e^{i\pi} + 1 = 0$，在构建阶段输出 HTML/CSS。

## KaTeX 块级公式

$$
\int_{-\infty}^{\infty} e^{-x^2}\, dx = \sqrt{\pi}
$$

$$
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}
$$

## 多语言代码块

```go
func main() {
    fmt.Println("FluxBlog publish via Git Data API")
}
```

```bash
npm run build
```

```js
const url = import.meta.env.BASE_URL; // "/blog/"
```
