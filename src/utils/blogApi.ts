/**
 * FluxBlog 服务端 API 客户端（SSR 页面在 Node 进程内调用 AppPilot Go 后端）。
 *
 * 运行时基址来自环境变量，需绝对地址（Node fetch 不接受相对路径）：
 *   BLOG_API_INTERNAL 或 PUBLIC_BLOG_API，回退 http://127.0.0.1:8080/api/v1/blog
 * 客户端（Studio）不走这里，仍用 src/scripts/auth.ts 的相对地址 + cookie。
 *
 * 公开读无需鉴权；私有读带 Bearer（token 来自 SSR 读取的 cookie，见 Phase 3）。
 */
import type { Post, PostSummary } from "./blogTypes";

const API_BASE =
  process.env.BLOG_API_INTERNAL ||
  process.env.PUBLIC_BLOG_API ||
  "http://127.0.0.1:8080/api/v1/blog";

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const err = new Error(`blog API ${path}: HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

function authHeader(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 列出公开已发布文档（不含正文）。 */
export function listPublicPosts(): Promise<PostSummary[]> {
  return fetchJSON<PostSummary[]>("/posts");
}

/** 取单篇公开已发布文档（含 markdown 正文）。 */
export function getPublicPost(slug: string): Promise<Post> {
  return fetchJSON<Post>(`/posts/${encodeURIComponent(slug)}`);
}

/** 全文搜索公开已发布文档。 */
export function searchPublic(
  q: string,
  page = 1,
  pageSize = 10
): Promise<{ items: PostSummary[]; total: number; page: number; pageSize: number }> {
  const qs = new URLSearchParams({ q, page: String(page), pageSize: String(pageSize) });
  return fetchJSON(`/posts/search?${qs}`);
}

/** 列出本人私有已发布文档。 */
export function listMyPrivatePosts(token: string): Promise<PostSummary[]> {
  return fetchJSON<PostSummary[]>("/me/posts", { headers: authHeader(token) });
}

/** 取本人私有已发布文档（含正文）。 */
export function getMyPrivatePost(slug: string, token: string): Promise<Post> {
  return fetchJSON<Post>(`/me/posts/${encodeURIComponent(slug)}`, {
    headers: authHeader(token),
  });
}

export type { Post, PostSummary };
