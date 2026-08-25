import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProjectCell } from "./project-cell";

function render(projectId: number | null | undefined, entries: [number, string][]) {
  return renderToStaticMarkup(
    createElement(ProjectCell, { projectId, projectMap: new Map(entries) })
  );
}

describe("ProjectCell", () => {
  it("长项目名使用限宽 + 截断样式，避免溢出挤压相邻列", () => {
    const html = render(1, [[1, "一个非常非常非常长的项目名称用于验证截断"]]);
    // 回归点：Tag 带 max-w-full 与 truncate，才不会撑破固定列宽
    expect(html).toContain("max-w-full");
    expect(html).toContain("truncate");
    expect(html).toContain("一个非常非常非常长的项目名称用于验证截断");
  });

  it("无项目归属时渲染占位符", () => {
    const html = render(null, [[1, "项目A"]]);
    expect(html).toContain("—");
    expect(html).not.toContain("truncate");
  });

  it("项目 ID 找不到时渲染「已删除」", () => {
    const html = render(999, [[1, "项目A"]]);
    expect(html).toContain("已删除");
  });
});
