import rss from "@astrojs/rss";
import { listPublicPosts } from "@/utils/blogApi";
import { getPostUrlBySlug } from "@/utils/getPostPaths";
import config from "@/config";

// RSS 改为运行时从 AppPilot DB 生成（不再读 content collection）。
export const prerender = false;

export async function GET() {
  const posts = await listPublicPosts();

  return rss({
    title: config.site.title,
    description: config.site.description,
    site: config.site.url,
    items: posts.map(({ slug, title, description, publishedAt, updatedAt }) => ({
      link: getPostUrlBySlug(slug, config.site.lang),
      title,
      description,
      pubDate: new Date(updatedAt ?? publishedAt ?? Date.now()),
    })),
  });
}
