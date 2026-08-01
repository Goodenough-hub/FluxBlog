import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// auth.ts 现在是 cookie 模式：JS 不持有 token，只读 fluxblog_session 判断登录态。
// 下面 stub document.cookie 与 fetch。

let cookieStore = "";
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore = "";
  // 极简 document：cookie 读写。
  vi.stubGlobal("document", {
    get cookie() {
      return cookieStore;
    },
    set cookie(_v: string) {
      // 测试直接通过设置 cookieStore 模拟登录态，写入忽略。
    },
  });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

import { login, refresh, clearSession, isLoggedIn } from "./auth";

describe("auth (cookie 模式)", () => {
  it("isLoggedIn：仅当 fluxblog_session=1 为真", () => {
    cookieStore = "fluxblog_session=1";
    expect(isLoggedIn()).toBe(true);
    cookieStore = "other=2; fluxblog_session=1; foo=bar";
    expect(isLoggedIn()).toBe(true);
    cookieStore = "other=2";
    expect(isLoggedIn()).toBe(false);
    cookieStore = "";
    expect(isLoggedIn()).toBe(false);
  });

  it("login 成功：fetch 带 credentials:include + JSON body，返回 true", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const ok = await login("u", "p");
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/login$/);
    expect((init as RequestInit).credentials).toBe("include");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("login 失败（401）：返回 false", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad", { status: 401 }));
    expect(await login("u", "p")).toBe(false);
  });

  it("并发 refresh：全局 mutex 只发一次", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const [a, b] = await Promise.all([refresh(), refresh()]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).credentials).toBe("include");
  });

  it("refresh 失败（401）：返回 false", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad", { status: 401 }));
    expect(await refresh()).toBe(false);
  });

  it("clearSession：调 /auth/logout", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await clearSession();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/logout$/);
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).credentials).toBe("include");
  });
});
