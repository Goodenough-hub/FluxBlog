/**
 * 从 markdown 提取 h2/h3 标题（id 由 rehype-slug 的 github-slugger 算法决定）。
 * 用于服务端渲染 TOC，避免客户端 DOM 扫描。
 */
import { slug } from "github-slugger";

export interface TocHeading {
  depth: 2 | 3;
  text: string;
  id: string;
}

/** 从 markdown 字符串提取所有 h2/h3 标题及其 slug id。 */
export function extractHeadings(md: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const lines = md.split("\n");
  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.+)/);
    if (!m) continue;
    const depth = m[1].length as 2 | 3;
    const text = m[2].replace(/#+$/, "").trim();
    headings.push({ depth, text, id: slug(text) });
  }
  return headings;
}