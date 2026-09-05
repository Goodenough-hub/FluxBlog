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

// 回归：无 h2/h3 时组件早退不渲染 <aside>，若容器仍无条件带 xl:max-w-6xl，
// main 的 flex-1 会撑满 1152px 容器并左移到目录原位（曾经的线上表现）。
// 容器加宽必须与目录同时存在，否则退回站点标准宽 max-w-3xl 居中。
const postPages = [
  "../pages/posts/[...slug]/index.astro",
  "../pages/private/[...slug]/index.astro",
  "../pages/preview/[...slug]/index.astro",
  "../pages/preview-draft/[id].astro",
] as const;

describe("文章页容器宽度随目录存在与否切换", () => {
  it.each(postPages)("%s 不再无条件加宽到 xl:max-w-6xl", page => {
    const pageSrc = readFileSync(
      fileURLToPath(new URL(page, import.meta.url)),
      "utf8"
    );
    expect(pageSrc).not.toContain('class="app-layout flex gap-8 xl:max-w-6xl"');
  });

  it.each(postPages)("%s 的 xl:max-w-6xl 绑定在有目录时", page => {
    const pageSrc = readFileSync(
      fileURLToPath(new URL(page, import.meta.url)),
      "utf8"
    );
    expect(pageSrc).toContain('"app-layout flex gap-8"');
    expect(pageSrc).toContain('{ "xl:max-w-6xl": tocHeadings.length > 0 }');
  });
});
