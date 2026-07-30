/**
 * FluxBlog Studio 鉴权：保存 token + expiresAt，到期前 5 分钟刷新，
 * 401 时全局 mutex 只刷新并重放一次；刷新失败清理会话回登录页。
 */
const TOKEN_KEY = "fluxblog_token";
const EXPIRES_KEY = "fluxblog_token_expires";
export const BLOG_API = import.meta.env.PUBLIC_BLOG_API || "/api/v1/blog";

let refreshPromise: Promise<string | null> | null = null;

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getExpiresAt(): number {
  return Number(localStorage.getItem(EXPIRES_KEY) || 0);
}

export function setSession(token: string, expiresAt: number): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRES_KEY, String(expiresAt));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

/** 到期前 5 分钟内主动刷新；否则返回当前有效 token。 */
export async function ensureToken(): Promise<string | null> {
  const t = getToken();
  if (!t) return null;
  const exp = getExpiresAt();
  const now = Math.floor(Date.now() / 1000);
  if (exp && exp - now > 300) return t;
  return refresh();
}

/** 全局 mutex 刷新：并发 401 只发一次 refresh。失败返回 null 并清理会话。 */
export function refresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const t = getToken();
  if (!t) {
    clearSession();
    return Promise.resolve(null);
  }
  refreshPromise = fetch(`${BLOG_API}/auth/refresh`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}` },
  })
    .then(async r => {
      if (!r.ok) {
        clearSession();
        return null;
      }
      const data = await r.json();
      setSession(data.token, data.expiresAt);
      return data.token as string;
    })
    .catch(() => {
      clearSession();
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function login(
  username: string,
  password: string
): Promise<boolean> {
  const r = await fetch(`${BLOG_API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) return false;
  const data = await r.json();
  setSession(data.token, data.expiresAt);
  return true;
}
