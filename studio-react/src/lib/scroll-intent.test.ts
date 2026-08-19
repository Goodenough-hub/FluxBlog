import { describe, expect, it } from "vitest";
import { isScrollNavigationKey } from "./scroll-intent";

describe("滚动意图识别", () => {
  it("识别翻页和方向键", () => {
    expect(isScrollNavigationKey("PageDown")).toBe(true);
    expect(isScrollNavigationKey("PageUp")).toBe(true);
    expect(isScrollNavigationKey("ArrowDown")).toBe(true);
    expect(isScrollNavigationKey("Home")).toBe(true);
  });

  it("删除和普通输入不触发滚动同步", () => {
    expect(isScrollNavigationKey("Backspace")).toBe(false);
    expect(isScrollNavigationKey("Delete")).toBe(false);
    expect(isScrollNavigationKey("a")).toBe(false);
  });
});
