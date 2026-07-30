import { describe, it, expect } from "vitest";

/**
 * Frontmatter 契约测试：固定 AppPilot 后端 assembleFrontmatter() 产出的格式
 * 与 FluxBlog 内容集合 schema 的期望一致（见 src/content.config.ts）。
 *
 * Go 侧 internal/blog 的 TestAssembleFrontmatter 直接断言产出；本测试从
 * FluxBlog 侧用相同格式的 fixture 解析，保证 schema 规则（必填字段、cover
 * 可省略、publishedAt 日期 / updatedAt RFC3339、tags 数组、--- 闭合）被满足。
 * 任一端改坏格式都会在此或 Go 测试失败。
 */

// 与后端一致的 fixture：含 cover（注意 --- 闭合，正文后空行）。
const withCover = `---
title: "标题 \\"引号\\""
slug: "my-post"
description: "描述"
publishedAt: 2026-07-29
updatedAt: 2026-07-30T12:00:00Z
draft: false
tags: ["a","b"]
cover: "/blog/media/2026/07/abc.webp"
---

正文`;

// 无封面 fixture：cover 行应被省略（schema cover 为 optional，不接受 null）。
const withoutCover = `---
title: "T"
slug: "p"
description: "D"
publishedAt: 2026-07-29
updatedAt: 2026-07-29T00:00:00Z
draft: true
tags: ["x"]
---

正文`;

// 解析 frontmatter：拆分 --- 闭合块，按行解析 key: value（值用 JSON 解析以匹配后端 JSON 序列化）。
function parseFrontmatter(src: string): Record<string, unknown> {
  const m = src.match(/^---\n([\s\S]*?)\n---\n\n/);
  if (!m) throw new Error("frontmatter 未以 ---\\n...\\n---\\n\\n 闭合");
  const out: Record<string, unknown> = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val: unknown = line.slice(idx + 1).trim();
    try { val = JSON.parse(val as string); } catch { /* 标量保留字符串 */ }
    out[key] = val;
  }
  return out;
}

describe("frontmatter 契约（后端产出 ↔ FluxBlog schema）", () => {
  it("必须以 --- 闭合且正文在其后", () => {
    expect(() => parseFrontmatter("title: x\n正文")).toThrow();
    expect(parseFrontmatter(withCover)).toBeTruthy();
  });

  it("必填字段齐全且类型正确", () => {
    const f = parseFrontmatter(withCover);
    expect(f.title).toBe('标题 "引号"'); // JSON 解码后的引号
    expect(f.slug).toBe("my-post");
    expect(f.description).toBe("描述");
    expect(f.publishedAt).toBe("2026-07-29"); // 日期
    expect(String(f.updatedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/); // RFC3339
    expect(f.draft).toBe(false);
    expect(Array.isArray(f.tags)).toBe(true);
    expect((f.tags as string[]).length).toBe(2);
  });

  it("有封面时 cover 为字符串路径", () => {
    const f = parseFrontmatter(withCover);
    expect(f.cover).toBe("/blog/media/2026/07/abc.webp");
  });

  it("无封面时省略 cover（schema cover optional，不接受 null）", () => {
    const f = parseFrontmatter(withoutCover);
    expect("cover" in f).toBe(false);
  });

  it("slug 只允许小写字母/数字/连字符", () => {
    const f = parseFrontmatter(withCover);
    expect(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.slug as string)).toBe(true);
  });
});
