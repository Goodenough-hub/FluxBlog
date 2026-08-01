/**
 * FluxBlog Studio 鉴权：httpOnly cookie 模式。
 *
 * token 存于 httpOnly cookie（fluxblog_token），JS 不可读，SSR 私有页服务端
 * 读取后转发给 Go 私有 API。前端只通过 fluxblog_session 判断登录态。
 * 所有 fetch 走 credentials:'include'，同源自动带 cookie。
 * 401 时全局 mutex 只刷新并重放一次；刷新失败抛 401（由调用方决定回登录页）。
 */
export const BLOG_API = import.meta.env.PUBLIC_BLOG_API || "/api/v1/blog";

const SESSION_COOKIE = "fluxblog_session";

let refreshPromise: Promise<boolean> | null = null;

/** 读取 document.cookie 中某 key 的值（仅用于非 httpOnly 的 session 标志）。 */
function getCookie(name: string): string | null {
  const matches = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`)
  );
  return matches ? decodeURIComponent(matches[1]) : null;
}

export function isLoggedIn(): boolean {
  return getCookie(SESSION_COOKIE) === "1";
}

export async function login(
  username: string,
  password: string
): Promise<boolean> {
  const r = await fetch(`${BLOG_API}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return r.ok;
}

/** 注销：后端清两个 cookie。 */
export async function clearSession(): Promise<void> {
  try {
    await fetch(`${BLOG_API}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    /* 忽略网络错误，前端态由刷新页面重置 */
  }
}

/** 全局 mutex 刷新：并发 401 只发一次 refresh。成功返回 true。 */
export function refresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${BLOG_API}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then(r => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}
