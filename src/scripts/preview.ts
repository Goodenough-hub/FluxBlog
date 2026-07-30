/**
 * Studio 预览渲染器：把 Markdown 渲染为 HTML，复用与公开文章一致的
 * remark-math / rehype-katex / remark-mermaid，再按需客户端加载 Mermaid 与 Shiki。
 *
 * - 200ms 防抖 + 渲染序号：丢弃过期异步结果。
 * - Mermaid strict security；Shiki 双主题（min-light / night-owl），与公开文章一致。
 * - 受保护图片（/api/v1/blog/assets/:id）通过 Bearer fetch 取 Blob URL，
 *   切换/重绘/退出时统一 revoke。
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkMermaid from "../utils/remark-mermaid";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { fetchAssetBlob } from "./api-client";

// 预览对作者自有内容放宽 sanitize：允许 class/style（KaTeX 需要），允许 mermaid div。
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...((defaultSchema.attributes && defaultSchema.attributes["*"]) || []),
      "className",
      "class",
      "style",
    ],
    div: [
      ...((defaultSchema.attributes && defaultSchema.attributes.div) || []),
      "data-mermaid",
    ],
  },
  tagNames: [
    ...((defaultSchema.tagNames as string[] | undefined) || []),
    "math",
    "inlineMath",
    "annotation",
    "semantics",
    "mrow",
    "mi",
    "mo",
    "mn",
    "msup",
    "msub",
    "mfrac",
    "mtext",
    "mspace",
    "mover",
    "munder",
    "munderover",
    "mtable",
    "mtr",
    "mtd",
    "mstyle",
  ],
};

const processor = unified()
  .use(remarkParse)
  .use(remarkMath)
  .use(remarkMermaid)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeKatex)
  .use(rehypeSanitize, schema)
  .use(rehypeStringify);

export async function renderMarkdown(md: string): Promise<string> {
  const file = await processor.process(md);
  return String(file);
}

let highlighterPromise: Promise<any> | null = null;
async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then(({ createHighlighter }) =>
      createHighlighter({
        themes: ["min-light", "night-owl"],
        langs: [
          "ts",
          "js",
          "tsx",
          "jsx",
          "go",
          "python",
          "bash",
          "json",
          "yaml",
          "html",
          "css",
          "sql",
          "rust",
          "java",
        ],
      })
    );
  }
  return highlighterPromise;
}

let mermaidPromise: Promise<any> | null = null;
async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then(m => {
      const mer = m.default;
      mer.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "default",
      });
      return mer;
    });
  }
  return mermaidPromise;
}

export class PreviewRenderer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;
  private blobUrls = new Set<string>();

  constructor(private root: HTMLElement) {}

  /** 防抖 200ms 渲染；过期异步结果被丢弃。 */
  schedule(md: string, ms = 200): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.render(md), ms);
  }

  private async render(md: string): Promise<void> {
    const n = ++this.seq;
    let html: string;
    try {
      html = await renderMarkdown(md);
    } catch {
      return;
    }
    if (n !== this.seq) return; // 已有更新的渲染请求
    this.revokeUrls();
    this.root.innerHTML = html;
    await this.enhance(n);
  }

  private async enhance(n: number): Promise<void> {
    // Mermaid
    const mermaidEls = this.root.querySelectorAll("[data-mermaid]");
    if (mermaidEls.length) {
      try {
        const mer = await getMermaid();
        if (n !== this.seq) return;
        for (const el of Array.from(mermaidEls)) {
          const id = "preview-mmd-" + Math.random().toString(36).slice(2, 8);
          try {
            const { svg } = await mer.render(
              id,
              (el as HTMLElement).textContent || ""
            );
            (el as HTMLElement).innerHTML = svg;
          } catch {
            (el as HTMLElement).classList.add("mermaid-error");
          }
        }
      } catch {}
    }
    // Shiki 代码高亮
    const codeEls = this.root.querySelectorAll("pre code");
    if (codeEls.length) {
      try {
        const hl = await getHighlighter();
        if (n !== this.seq) return;
        for (const code of Array.from(codeEls)) {
          const pre = code.parentElement;
          if (!pre) continue;
          const cls = code.getAttribute("class") || "";
          const m = cls.match(/language-([\w-]+)/);
          const lang = m ? m[1] : "ts";
          try {
            const out = hl.codeToHtml(code.textContent || "", {
              lang,
              themes: { light: "min-light", dark: "night-owl" },
            });
            pre.outerHTML = out;
          } catch {}
        }
      } catch {}
    }
    // 受保护图片 → Blob URL
    const imgs = this.root.querySelectorAll('img[src^="/api/v1/blog/assets/"]');
    for (const img of Array.from(imgs)) {
      const src = img.getAttribute("src") || "";
      try {
        const blobUrl = await fetchAssetBlob(src);
        if (n !== this.seq) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        this.blobUrls.add(blobUrl);
        img.setAttribute("src", blobUrl);
      } catch {}
    }
  }

  revokeUrls(): void {
    for (const u of this.blobUrls) URL.revokeObjectURL(u);
    this.blobUrls.clear();
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.seq++; // 使在途异步结果失效
    this.revokeUrls();
  }
}
