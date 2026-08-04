import { describe, it, expect } from "vitest";
import { codeToHtml } from "shiki";
import { transformerCodeWindow } from "./codeWindow.js";
import { xcodeLight } from "../themes/xcode-light";
import { xcodeDark } from "../themes/xcode-dark";

function render(code: string, opts: { lang?: string; meta?: string } = {}) {
  return codeToHtml(code, {
    lang: opts.lang ?? "ts",
    themes: { light: xcodeLight, dark: xcodeDark },
    defaultColor: false,
    transformers: [transformerCodeWindow()],
    meta: opts.meta ? { __raw: opts.meta } : undefined,
  });
}

describe("transformerCodeWindow", () => {
  it("包裹为 xcode 窗口，含三彩点/复制按钮/行号 class/语言标签", async () => {
    const html = await render("const a = 1;");
    expect(html).toContain('class="xcode-window"');
    expect(html).toContain("xcode-titlebar");
    expect(html).toContain("xcode-dots");
    expect(html).toContain('class="xcode-copy" data-copy');
    expect(html).toContain("line-numbers");
    expect(html).toContain('class="xcode-lang">ts<');
  });

  it("有 file meta 时显示文件名", async () => {
    const html = await render("x", { meta: 'file="main.swift"' });
    expect(html).toContain('class="xcode-filename">main.swift<');
  });

  it("无 file meta 时不渲染文件名", async () => {
    const html = await render("x");
    expect(html).not.toContain("xcode-filename");
  });

  it("plaintext 语言隐藏语言标签", async () => {
    const html = await render("x", { lang: "text" });
    expect(html).not.toContain("xcode-lang");
  });

  it("同时有 file 和 lang 时都渲染，且 figure 内含 pre", async () => {
    const html = await render("const a = 1;", { lang: "swift", meta: 'file="main.swift"' });
    expect(html).toContain('class="xcode-filename">main.swift<');
    expect(html).toContain('class="xcode-lang">swift<');
    expect(html).toMatch(/<figure class="xcode-window">[\s\S]*<pre/);
  });

  it("文件名含空格不被截断", async () => {
    const html = await render("x", { meta: 'file="my file.swift"' });
    expect(html).toContain('class="xcode-filename">my file.swift<');
  });
});
