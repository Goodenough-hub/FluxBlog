/**
 * SSR markdown 渲染管线（服务端，Node 进程内执行）。
 *
 * 与 astro.config.ts 的构建期 @astrojs/markdown-remark 管线保持同源：
 *   remarkParse → remarkGfm → remarkToc → remarkCollapse → remarkMermaid → remarkMath
 *   → remarkRehype(+rehypeRaw) → rehypeCallouts → rehypeKatex → @shikijs/rehype(双主题)
 *   → rehypeStringify
 *
 * 公开文章正文来自 AppPilot DB（API 下发的 markdown 字符串），不再走 content
 * collection 的 render()，故需要此独立管线。Mermaid 只输出 <div data-mermaid>，
 * 实际渲染仍由 Layout.astro 的 loadMermaid 客户端按需 import（与构建期一致）。
 * remark-gfm 启用 GFM 扩展（表格/删除线/任务列表/自动链接），与构建期 gfm:true 对齐。
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeCallouts from "rehype-callouts";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import rehypeShiki from "@shikijs/rehype";
import remarkMermaid from "./remark-mermaid";
import {
  shikiThemes,
  shikiTransformers,
} from "./markdownPlugins";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkToc)
  .use(remarkCollapse, { test: "Table of contents" })
  .use(remarkMermaid)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeCallouts)
  .use(rehypeKatex)
  .use(rehypeShiki, {
    themes: shikiThemes,
    transformers: shikiTransformers,
    defaultColor: false,
  })
  .use(rehypeStringify);

/** renderMarkdown 把 markdown 字符串渲染为 HTML 片段（服务端）。 */
export async function renderMarkdown(md: string): Promise<string> {
  const file = await processor.process(md);
  return String(file);
}
