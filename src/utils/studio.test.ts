import { describe, it, expect } from "vitest";

// Slug 校验：与后端 blog.ValidSlug 对齐——小写字母、数字、连字符，不以连字符开头/结尾。
function validSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

// /blog URL 前缀：站点挂在 /blog/ 下，所有内部链接/资源路径都必须带前缀。
const BASE = "/blog/";
function blogUrl(path: string): string {
  const p = path.replace(/^\/+/, "");
  if (!p) return BASE;
  return BASE + p;
}

// 发布状态机：draft ⇄ published，中间态 publishing/unpublishing 由 job 驱动；
// 失败回退到上一个稳定态，不改变线上版本。
function nextPublishState(
  state: string,
  action: "publish" | "unpublish" | "succeed" | "fail"
): string {
  switch (state) {
    case "draft":
      if (action === "publish") return "publishing";
      return "draft";
    case "publishing":
      if (action === "succeed") return "published";
      if (action === "fail") return "draft";
      return "publishing";
    case "published":
      if (action === "unpublish") return "unpublishing";
      return "published";
    case "unpublishing":
      if (action === "succeed") return "draft";
      if (action === "fail") return "published";
      return "unpublishing";
    default:
      return state;
  }
}

describe("validSlug", () => {
  it("接受小写字母数字连字符", () => {
    expect(validSlug("hello-world")).toBe(true);
    expect(validSlug("a-1-b-2")).toBe(true);
  });
  it("拒绝大写/空/首尾连字符/下划线/中文", () => {
    expect(validSlug("")).toBe(false);
    expect(validSlug("Hello")).toBe(false);
    expect(validSlug("-x")).toBe(false);
    expect(validSlug("x-")).toBe(false);
    expect(validSlug("a_b")).toBe(false);
    expect(validSlug("中文")).toBe(false);
  });
});

describe("blogUrl", () => {
  it("为路径加 /blog/ 前缀", () => {
    expect(blogUrl("posts/x/")).toBe("/blog/posts/x/");
    expect(blogUrl("/posts/x/")).toBe("/blog/posts/x/");
    expect(blogUrl("media/2026/07/a.webp")).toBe("/blog/media/2026/07/a.webp");
  });
  it("空路径返回 /blog/", () => {
    expect(blogUrl("")).toBe("/blog/");
  });
});

describe("nextPublishState", () => {
  it("发布成功路径 draft→publishing→published", () => {
    expect(nextPublishState("draft", "publish")).toBe("publishing");
    expect(nextPublishState("publishing", "succeed")).toBe("published");
  });
  it("发布失败回退到 draft，线上不变", () => {
    expect(nextPublishState("publishing", "fail")).toBe("draft");
  });
  it("撤回成功路径 published→unpublishing→draft", () => {
    expect(nextPublishState("published", "unpublish")).toBe("unpublishing");
    expect(nextPublishState("unpublishing", "succeed")).toBe("draft");
  });
  it("撤回失败回退到 published，线上不变", () => {
    expect(nextPublishState("unpublishing", "fail")).toBe("published");
  });
});
