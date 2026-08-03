import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 纯 HTTP 下 crypto.randomUUID 为 undefined，埋点曾裸调它抛 TypeError；
// 且 getSessionId() 同步执行于 fetch 参数构造中，早于 .catch() 挂载故拦不住。
// 下面 stub 所需全局，覆盖「randomUUID 缺失 / 网络失败均不抛错」。

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  });
  vi.stubGlobal("window", { location: { pathname: "/blog/" } });
  vi.stubGlobal("document", { title: "FluxBlog" });
  fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

import { getSessionId, trackPageview } from "./analytics";

describe("analytics", () => {
  it("getSessionId 生成并复用同一 sid", () => {
    const a = getSessionId();
    const b = getSessionId();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("crypto.randomUUID 缺失时 getSessionId 回退且不抛错（纯 HTTP 非安全上下文）", () => {
    vi.stubGlobal("crypto", {});
    expect(() => getSessionId()).not.toThrow();
    expect(getSessionId()).toMatch(/^\d+-[a-z0-9]+$/);
  });

  it("trackPageview 在 randomUUID 缺失时不抛错并仍发出请求", () => {
    vi.stubGlobal("crypto", {});
    expect(() => trackPageview()).not.toThrow();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("trackPageview 在 fetch reject 时不抛错", () => {
    fetchMock.mockReturnValue(Promise.reject(new Error("network down")));
    expect(() => trackPageview()).not.toThrow();
  });

  it("trackPageview 携带正确的埋点字段", () => {
    trackPageview();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/analytics/track");
    const body = JSON.parse((opts as { body: string }).body);
    expect(body).toMatchObject({
      app: "fluxblog",
      eventType: "pageview",
      path: "/blog/",
      title: "FluxBlog",
    });
    expect(typeof body.sessionId).toBe("string");
  });
});
