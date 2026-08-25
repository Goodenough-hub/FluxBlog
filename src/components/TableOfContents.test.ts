import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// TOC 组件契约测试：锁两件事——
// 1) 视觉设计关键元素（引导线/节点圆点/激活胶囊），防重构时被误删
// 2) 滚动跟随脚本依赖的 class 钩子（.toc-link/.active/data-toc-id）
const src = readFileSync(
  fileURLToPath(new URL("./TableOfContents.astro", import.meta.url)),
  "utf8"
);

describe("TableOfContents 大纲风格设计契约", () => {
  it("有引导线、节点圆点与激活胶囊样式", () => {
    expect(src).toContain(".toc-list::before"); // 贯穿引导线
    expect(src).toContain(".toc-link::before"); // 节点圆点
    expect(src).toContain(".toc-link.active"); // 激活项
    expect(src).toContain("border-radius: 8px"); // 胶囊圆角
    expect(src).toContain("color-mix"); // 强调色半透明背景
  });

  it("滚动跟随脚本依赖的钩子保持不变", () => {
    expect(src).toContain("toc-link");
    expect(src).toContain("data-toc-id");
    expect(src).toContain('closest("nav")');
    expect(src).toContain("IntersectionObserver");
  });

  it("宽屏以下隐藏、目录与正文并排 sticky", () => {
    expect(src).toContain("max-width: 1279.98px");
    expect(src).toContain("display: none");
    expect(src).toContain("position: sticky");
  });
});
