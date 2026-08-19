import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./renderMarkdown";

describe("renderMarkdown 源码位置", () => {
  it("为标题和段落输出 Markdown 起止行", async () => {
    const html = await renderMarkdown("## 标题\n\n第一段\n第二行");

    expect(html).toContain(
      '<h2 id="标题" data-source-start="1" data-source-end="1">'
    );
    expect(html).toContain(
      '<p data-source-start="3" data-source-end="4">第一段\n第二行</p>'
    );
  });

  it("Mermaid 转换后仍保留源码位置", async () => {
    const html = await renderMarkdown("```mermaid\ngraph TD\nA-->B\n```");

    expect(html).toContain('class="mermaid"');
    expect(html).toContain('data-source-start="1"');
    expect(html).toContain('data-source-end="4"');
  });
});
