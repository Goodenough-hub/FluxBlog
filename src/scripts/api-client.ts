/**
 * FluxBlog Studio API 客户端：cookie 鉴权（credentials:'include'）+ 401 刷新重放一次。
 * 替代 studio.ts 内联的 fetch。token 不再由 JS 管理，由 httpOnly cookie 自动携带。
 */
import { refresh, BLOG_API } from "./auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    msg: string,
    public detail?: any
  ) {
    super(msg);
  }
}

/** 受保护图片：带 cookie 取 Blob URL（调用方负责 revoke）。 */
export async function fetchAssetBlob(path: string): Promise<string> {
  const res = await fetch(`${BLOG_API}${path}`, { credentials: "include" });
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
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  const res = await fetch(`${BLOG_API}${path}`, {
    ...opts,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && allowRetry) {
    const ok = await refresh();
    if (ok) {
      return apiWithRetry<T>(path, { ...opts }, false);
    }
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
