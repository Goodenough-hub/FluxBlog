import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// auth.ts 在调用时读取 globalThis.localStorage 与 fetch，下面分别 stub。
function makeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => m.set(k, String(v)),
    removeItem: (k: string) => m.delete(k),
    clear: () => m.clear(),
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal("localStorage", makeStorage());
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

import {
  setSession,
  ensureToken,
  refresh,
  clearSession,
  isLoggedIn,
} from "./auth";

describe("auth token refresh", () => {
  it("令牌离到期>5min：ensureToken 不刷新", async () => {
    setSession("tok-1", Math.floor(Date.now() / 1000) + 3600);
    const t = await ensureToken();
    expect(t).toBe("tok-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("令牌临近到期：ensureToken 主动刷新一次", async () => {
    setSession("tok-1", Math.floor(Date.now() / 1000) + 60); // <5min
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          token: "tok-2",
          expiresAt: Math.floor(Date.now() / 1000) + 7200,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    const t = await ensureToken();
    expect(t).toBe("tok-2");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("并发 refresh：全局 mutex 只发一次", async () => {
    setSession("tok-1", Math.floor(Date.now() / 1000) + 60);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ token: "tok-2", expiresAt: 9999999999 }), {
        status: 200,
      })
    );
    const [a, b] = await Promise.all([refresh(), refresh()]);
    expect(a).toBe("tok-2");
    expect(b).toBe("tok-2");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refresh 失败：清理会话", async () => {
    setSession("tok-1", Math.floor(Date.now() / 1000) + 60);
    fetchMock.mockResolvedValueOnce(new Response("bad", { status: 401 }));
    const t = await refresh();
    expect(t).toBeNull();
    expect(isLoggedIn()).toBe(false);
  });

  it("clearSession 后 ensureToken 返回 null", async () => {
    setSession("tok-1", Math.floor(Date.now() / 1000) + 3600);
    clearSession();
    expect(await ensureToken()).toBeNull();
  });
});
