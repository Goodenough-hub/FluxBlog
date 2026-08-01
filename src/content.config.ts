import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

// 文章（posts）集合已移除：内容以 Postgres blog_drafts 为权威源，
// 经 AppPilot /api/v1/blog/posts* 下发，SSR 渲染。GitHub 仓库不再含文章 Markdown。
// 仅保留 pages 集合（about 等静态页，预渲染）。
const pages = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    ogImage: z.string().optional(),
    canonicalURL: z.string().optional(),
  }),
});

export const collections = { pages };
