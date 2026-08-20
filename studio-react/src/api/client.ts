// FluxBlog studio-react API 客户端
// 与 FluxBlog src/scripts/api-client.ts + auth.ts 契约一致：
// - cookie 鉴权（credentials:'include'）
// - isLoggedIn 通过 JS 可读的 fluxblog_session cookie 探测
// - 401 全局 mutex refresh + 重放一次
// - 失败抛 ApiError；冲突 409 由调用方处理

export class ApiError extends Error {
  status: number;
  body?: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const SESSION_COOKIE = "fluxblog_session";

function getCookie(name: string): string | null {
  const matches = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`)
  );
  return matches ? decodeURIComponent(matches[1]) : null;
}

export function isLoggedIn(): boolean {
  return getCookie(SESSION_COOKIE) === "1";
}

let refreshPromise: Promise<boolean> | null = null;

function refresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

const API_BASE = "/api/v1/blog";

export async function api<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  return apiWithRetry<T>(path, init, true);
}

async function apiWithRetry<T>(
  path: string,
  init: RequestInit,
  allowRetry: boolean
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && allowRetry) {
    const ok = await refresh();
    if (ok) {
      return apiWithRetry<T>(path, init, false);
    }
    throw new ApiError(401, "未登录或令牌失效");
  }

  if (!res.ok) {
    let body: unknown = undefined;
    try {
      body = await res.json();
    } catch {
      /* not JSON */
    }
    const message =
      (body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${res.status}`) || `HTTP ${res.status}`;
    throw new ApiError(res.status, message, body);
  }

  if (res.status === 204) return undefined as unknown as T;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export async function login(
  username: string,
  password: string
): Promise<boolean> {
  const r = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return r.ok;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    /* ignore */
  }
}

export interface MeResponse {
  userId: string;
  username: string;
  isEnabled: boolean;
  tokenVersion: number;
  isAdmin: boolean;
}

export async function fetchMe(): Promise<MeResponse> {
  return api<MeResponse>("/auth/me");
}

export interface Draft {
  id: number;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  cover: string | null;
  markdown: string;
  status: string;
  visibility: "public" | "private";
  version: number;
  projectId?: number | null;
  publishedVersion?: number | null;
  publishedAt?: string | null;
  hasUnpublishedChanges?: boolean;
  scheduledPublishAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Project {
  id: number;
  name: string;
}

export const draftsApi = {
  async list(): Promise<Draft[]> {
    return api<Draft[]>("/drafts");
  },
  async get(id: number): Promise<Draft> {
    return api<Draft>(`/drafts/${id}`);
  },
  async create(input: {
    slug: string;
    title: string;
    description?: string;
    markdown?: string;
    visibility?: "public" | "private";
  }): Promise<Draft> {
    return api<Draft>("/drafts", {
      method: "POST",
      body: JSON.stringify({
        markdown: "",
        visibility: "private",
        ...input,
      }),
    });
  },
  async update(
    id: number,
    input: Partial<Draft> & { markdown: string },
    baseVersion: number
  ): Promise<Draft> {
    return api<Draft>(`/drafts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...input, baseVersion }),
    });
  },
  // 单独切换可见性：未发布草稿走 PATCH（仅传 visibility+baseVersion）；
  // 已发布草稿走 POST /publish（服务端会原地把 visibility 改成入参值）
  async setVisibility(
    id: number,
    visibility: "public" | "private",
    baseVersion: number,
    isPublished: boolean
  ): Promise<Draft> {
    if (isPublished) {
      return api<Draft>(`/drafts/${id}/publish`, {
        method: "POST",
        body: JSON.stringify({ visibility }),
      });
    }
    return api<Draft>(`/drafts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ visibility, baseVersion }),
    });
  },
  async delete(id: number): Promise<void> {
    await api<{ ok: boolean }>(`/drafts/${id}`, { method: "DELETE" });
  },
  async versions(id: number): Promise<
    {
      id: number;
      version: number;
      title: string;
      markdown: string;
      createdAt: string;
    }[]
  > {
    return api(`/drafts/${id}/versions`);
  },
  async restore(id: number, version: number): Promise<Draft> {
    return api<Draft>(`/drafts/${id}/versions/${version}/restore`, {
      method: "POST",
    });
  },
  async publish(
    id: number,
    options?: {
      visibility?: "public" | "private";
      scheduledPublishAt?: string | null;
      projectId?: number | null;
      tags?: string[];
    }
  ): Promise<{
    status: string;
    noop?: boolean;
    scheduled?: boolean;
    scheduledPublishAt?: string;
    visibility?: string;
    publishedVersion?: number;
    publishedAt?: string;
    updatedAt?: string;
  }> {
    return api(`/drafts/${id}/publish`, {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    });
  },
  async unpublish(id: number): Promise<{ status: string; noop?: boolean }> {
    return api(`/drafts/${id}/unpublish`, { method: "POST" });
  },
};

export const tagsApi = {
  async list(): Promise<string[]> {
    const r = await api<{ tags: string[] | null }>("/tags");
    return r.tags ?? [];
  },
};

export const projectsApi = {
  async list(): Promise<Project[]> {
    // Studio 是 admin-only 界面：需要看到所有项目（含没有已发布公开文章的），
    // 所以走 admin-preview 全表 endpoint，而非公开的 /projects（后者带
    // HAVING COUNT(published_public) > 0 过滤，会把纯草稿/私有的项目藏起来，
    // 导致 List 页把归属这些项目的草稿误标"已删除"）。
    return api<Project[]>("/admin-preview/projects");
  },
  async create(input: { name: string; intro?: string }): Promise<Project> {
    return api<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

/** 受保护图片：带 cookie 取 Blob URL（调用方负责 revoke）。 */
export async function fetchAssetBlob(path: string): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, `asset ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
