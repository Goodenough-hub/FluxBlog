import { describe, it, expect } from "vitest";
import { shikiThemes, shikiTransformers } from "./markdownPlugins";

describe("markdownPlugins 共享 Shiki 配置", () => {
  it("主题为 Xcode 双主题，键名保持 light/dark", () => {
    expect(shikiThemes.light.name).toBe("xcode-light");
    expect(shikiThemes.dark.name).toBe("xcode-dark");
  });

  it("transformers 含 code-window，且保留 notation transformers", () => {
    const names = shikiTransformers.map(t => t.name);
    expect(names).toContain("code-window");
    // notation 系列仍在（diff/highlight/word-highlight）
    expect(names.some(n => n && n.includes("notation"))).toBe(true);
  });
});
