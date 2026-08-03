/**
 * FluxBlog 文章类型，镜像 AppPilot blog 后端的 JSON 契约。
 * 与 Go 侧 internal/blog/models.go 的 Draft / DraftSummary 对应。
 */

/** Project 公开视图（含文章数）。 */
export type ProjectSummary = {
  id: number;
  name: string;
  intro: string;
  postCount: number;
};

/** Project 详情。 */
export type Project = {
  id: number;
  name: string;
  intro: string;
};

/** 列表项（不含 markdown 正文）。 */
export type PostSummary = {
  id: number;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  cover?: string | null;
  status: string;
  visibility: string;
  version: number;
  projectId?: number | null;
  projectName?: string | null;
  publishedAt?: string | null;
  updatedAt: string;
};

/** 单篇正文（含 markdown）。 */
export type Post = PostSummary & {
  userId: number;
  markdown: string;
  publishedCommitSha?: string | null;
  publishedVersion?: number | null;
  hasUnpublishedChanges?: boolean;
  createdAt: string;
};
