import { describe, expect, it } from "vitest";
import { joinPath } from "./withBase";

describe("joinPath", () => {
  it("拼接时折叠接缝处的重复斜杠", () => {
    // 回归点：getRelativeLocaleUrl 返回带尾斜杠的 /blog/posts/，
    // 旧写法 `${base}/page/${n}` 会产出 /blog/posts//page/2 导致 SSR 路由 404。
    expect(joinPath("/blog/posts/", "page", 2)).toBe("/blog/posts/page/2");
    expect(joinPath("/blog/posts", "page", 2)).toBe("/blog/posts/page/2");
  });

  it("兼容多余的前导/尾随斜杠", () => {
    expect(joinPath("/blog/tags/js///", "/2/")).toBe("/blog/tags/js/2");
    expect(joinPath("/blog/preview/", "page", "3")).toBe("/blog/preview/page/3");
  });

  it("无尾段时返回去掉尾斜杠的 base", () => {
    expect(joinPath("/blog/posts/")).toBe("/blog/posts");
    expect(joinPath("/blog/posts")).toBe("/blog/posts");
  });

  it("接受数字与字符串段并忽略空段", () => {
    expect(joinPath("/blog/tags/js", "", 2)).toBe("/blog/tags/js/2");
  });
});
