/**
 * FluxBlog Studio API 客户端：Bearer 鉴权 + 令牌自动刷新 + 401 重放一次。
 * 替代 studio.ts 内联的 fetch。
 */
import { ensureToken, refresh, clearSession, BLOG_API } from "./auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    msg: string,
    public detail?: any
  ) {
    super(msg);
  }
}

/** 受保护图片：带 Bearer 取 Blob URL（调用方负责 revoke）。 */
export async function fetchAssetBlob(path: string): Promise<string> {
  const token = await ensureToken();
  const res = await fetch(`${BLOG_API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, `asset ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  return apiWithRetry<T>(path, opts, true);
}

async function apiWithRetry<T>(
  path: string,
  opts: RequestInit,
  allowRetry: boolean
): Promise<T> {
  const token = await ensureToken();
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  if (token && !headers["Authorization"])
    headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BLOG_API}${path}`, { ...opts, headers });

  if (res.status === 401 && allowRetry) {
    const fresh = await refresh();
    if (fresh) {
      const h2: Record<string, string> = {
        ...(opts.headers as Record<string, string>),
      };
      h2["Authorization"] = `Bearer ${fresh}`;
      return apiWithRetry<T>(path, { ...opts, headers: h2 }, false);
    }
    clearSession();
    throw new ApiError(401, "未登录或令牌失效");
  }
  if (!res.ok) {
    let detail: any = null;
    try {
      detail = await res.json();
    } catch {}
    throw new ApiError(
      res.status,
      detail?.error || `HTTP ${res.status}`,
      detail
    );
  }
  if (res.status === 204) return undefined as unknown as T;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json() as Promise<T>;
  return (await res.text()) as unknown as T;
}
