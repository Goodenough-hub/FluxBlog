import { defineConfig, envField, fontProviders, svgoOptimizer } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";
import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import rehypeCallouts from "rehype-callouts";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { shikiThemes, shikiTransformers } from "./src/utils/markdownPlugins";
import remarkMermaid from "./src/utils/remark-mermaid";
import config from "./astro-paper.config";

export default defineConfig({
  // base=/blog：站点挂在 /blog/ 子路径下，nginx 单独 location 暴露。
  // 所有内部链接、RSS、sitemap、OG、图片、Pagefind 都带 /blog/ 前缀。
  site: config.site.url,
  base: "/blog",
  trailingSlash: "ignore",
  adapter: node({ mode: "standalone" }),
  integrations: [mdx()],
  i18n: {
    locales: ["zh-CN"],
    defaultLocale: "zh-CN",
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [
        remarkToc,
        [remarkCollapse, { test: "Table of contents" }],
        // Mermaid：把 ```mermaid 代码块转成 <div data-mermaid>，按需客户端渲染。
        remarkMermaid,
        // KaTeX：remark-math 标记公式，rehype-katex 在构建期输出 HTML/CSS。
        remarkMath,
      ],
      rehypePlugins: [rehypeCallouts, rehypeKatex],
    }),
    shikiConfig: {
      themes: shikiThemes,
      defaultColor: false,
      wrap: false,
      transformers: shikiTransformers,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      name: "Google Sans Code",
      cssVariable: "--font-google-sans-code",
      provider: fontProviders.google(),
      fallbacks: ["monospace"],
      weights: [300, 400, 500, 600, 700],
      styles: ["normal", "italic"],
      formats: ["woff", "ttf"],
    },
  ],
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
      // FluxBlog 后端 API 基址（Studio 用）。开发指向本地 AppPilot :8080。
      PUBLIC_BLOG_API: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    svgOptimizer: svgoOptimizer(),
  },
});
