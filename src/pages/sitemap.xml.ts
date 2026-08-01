import type { APIRoute } from "astro";
import { getRelativeLocaleUrl } from "astro:i18n";
import { listPublicPosts } from "@/utils/blogApi";
import { getPostUrlBySlug } from "@/utils/getPostPaths";
import config from "@/config";

// 自定义 sitemap：从 AppPilot DB 取公开文章 slug 列表实时生成（不再用 @astrojs/sitemap 构建期枚举）。
export const prerender = false;

const escapeXML = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

type Entry = { loc: string; lastmod?: string };

export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL(config.site.url)).href.replace(/\/$/, "");
  const locale = config.site.lang;
  const posts = await listPublicPosts();

  const entries: Entry[] = [
    `${base}${getRelativeLocaleUrl(locale, "")}`,
    `${base}${getRelativeLocaleUrl(locale, "posts")}`,
    `${base}${getRelativeLocaleUrl(locale, "tags")}`,
    `${base}${getRelativeLocaleUrl(locale, "archives")}`,
    `${base}${getRelativeLocaleUrl(locale, "about")}`,
  ].map(loc => ({ loc }));

  for (const p of posts) {
    const u = new URL(getPostUrlBySlug(p.slug, locale), site ?? undefined);
    entries.push({ loc: `${base}${u.pathname}`, lastmod: p.updatedAt });
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    e =>
      `  <url><loc>${escapeXML(e.loc)}</loc>${
        e.lastmod ? `<lastmod>${escapeXML(e.lastmod)}</lastmod>` : ""
      }</url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
