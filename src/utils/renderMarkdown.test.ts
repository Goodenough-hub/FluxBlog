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

describe("renderMarkdown 无语言代码块默认按 text 渲染", () => {
  it("裸 ``` 与 ```text 输出完全一致", async () => {
    const bare = await renderMarkdown("```\nAudi\nBMW\n```");
    const text = await renderMarkdown("```text\nAudi\nBMW\n```");

    expect(bare).toBe(text);
  });

  it("裸 ``` 也包裹进 xcode 窗口并带行号，无语言标签", async () => {
    const html = await renderMarkdown("```\nAudi\nBMW\n```");

    expect(html).toContain('class="xcode-window"');
    expect(html).toContain("line-numbers");
    // text/plaintext 语言不显示语言标签
    expect(html).not.toContain("xcode-lang");
  });

  it("显式语言仍高亮并显示语言标签", async () => {
    const html = await renderMarkdown("```javascript\nconst a = 1;\n```");

    expect(html).toContain('class="xcode-window"');
    expect(html).toContain('class="xcode-lang">javascript<');
  });
});

describe("renderMarkdown CSDN 图片兼容", () => {
  it("为 CSDN Markdown 图片禁用 Referer 并移除居中标记", async () => {
    const html = await renderMarkdown(
      "![示例](https://i-blog.csdnimg.cn/blog_migrate/image.jpeg?x=1#pic_center)"
    );

    expect(html).toContain(
      'src="https://i-blog.csdnimg.cn/blog_migrate/image.jpeg?x=1"'
    );
    expect(html).toContain('referrerpolicy="no-referrer"');
    expect(html).not.toContain("#pic_center");
  });

  it("兼容原始 HTML 图片且不改写非 CSDN 图片", async () => {
    const html = await renderMarkdown(
      '<img src="https://img-blog.csdnimg.cn/a.png#pic_center" alt="CSDN"><img src="https://example.com/a.png#pic_center" alt="other">'
    );

    expect(html).toContain(
      '<img src="https://img-blog.csdnimg.cn/a.png" alt="CSDN" referrerpolicy="no-referrer">'
    );
    expect(html).toContain(
      '<img src="https://example.com/a.png#pic_center" alt="other">'
    );
  });

  it("不匹配伪装域名并保留其他 fragment", async () => {
    const html = await renderMarkdown(
      "![伪装](https://i-blog.csdnimg.cn.evil.example/a.png#pic_center)\n\n![片段](https://i-blog.csdnimg.cn/a.png#section)"
    );

    expect(html).toContain(
      'src="https://i-blog.csdnimg.cn.evil.example/a.png#pic_center"'
    );
    expect(html).toContain('src="https://i-blog.csdnimg.cn/a.png#section"');
    expect(html.match(/referrerpolicy="no-referrer"/g)).toHaveLength(1);
  });
});
