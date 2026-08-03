import { getRelativeLocaleUrl } from "astro:i18n";
import config from "@/config";

/**
 * 按单段 slug 构造文章 URL（DB 驱动：slug 直接来自 API，无 filePath/嵌套目录）。
 * 用于 SSR 渲染的公开/私有文章列表与详情页、RSS、sitemap。
 */
export function getPostUrlBySlug(
  slug: string,
  locale: string | undefined = config.site.lang
): string {
  return getRelativeLocaleUrl(locale, `posts/${slug}`);
}

/** 按 project ID 构造 project 详情页 URL。 */
export function getProjectUrlByID(
  id: number,
  locale: string | undefined = config.site.lang
): string {
  return getRelativeLocaleUrl(locale, `projects/${id}`);
}
