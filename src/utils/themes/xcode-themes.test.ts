import { describe, it, expect } from "vitest";
import { codeToHtml } from "shiki";
import { xcodeLight } from "./xcode-light";
import { xcodeDark } from "./xcode-dark";

describe("xcode themes", () => {
  it("主题元信息正确", () => {
    expect(xcodeLight.name).toBe("xcode-light");
    expect(xcodeLight.type).toBe("light");
    expect(xcodeLight.colors?.["editor.background"]).toBe("#FFFFFF");
    expect(xcodeLight.colors?.["editor.foreground"]).toBe("#1F1F24");
    expect(xcodeDark.name).toBe("xcode-dark");
    expect(xcodeDark.type).toBe("dark");
    expect(xcodeDark.colors?.["editor.background"]).toBe("#292A30");
    expect(xcodeDark.colors?.["editor.foreground"]).toBe("#DFDFE0");
  });

  it("关键字/字符串/注释着 Xcode 色（defaultColor:false 时以 CSS 变量内联）", async () => {
    const html = await codeToHtml('const x = "hi"; // note', {
      lang: "ts",
      themes: { light: xcodeLight, dark: xcodeDark },
      defaultColor: false,
    });
    // 关键字 const（light #AD3DA4 / dark #FF7AB2）
    expect(html).toContain("#AD3DA4");
    expect(html).toContain("#FF7AB2");
    // 字符串 "hi"（light #D12F1B）
    expect(html).toContain("#D12F1B");
    // 注释（light #5D6C79）
    expect(html).toContain("#5D6C79");
  });
});
