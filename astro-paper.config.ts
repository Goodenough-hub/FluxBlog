import { defineAstroPaperConfig } from "./src/types/config";

// 站点完整 URL 由构建变量 FLUXBLOG_SITE_URL 注入，避免在源码写死尚未确定的主机名。
// 未设置时回退到 example.com，仅用于本地构建，不作为生产地址。
const SITE_URL = process.env.FLUXBLOG_SITE_URL || "https://example.com";

export default defineAstroPaperConfig({
  site: {
    url: SITE_URL,
    title: "FluxBlog",
    description: "个人技术博客",
    // 作者模块暂时隐藏：置空 author 与 profile。
    author: "",
    profile: "",
    ogImage: "default-og.jpg",
    lang: "zh-CN",
    timezone: "Asia/Shanghai",
    dir: "ltr",
  },
  posts: {
    perPage: 10,
    perIndex: 10,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: true,
      url: "https://github.com/Goodenough-hub/FluxBlog/edit/main/",
    },
    search: "pagefind",
  },
  socials: [
    { name: "github", url: "https://github.com/Goodenough-hub/FluxBlog" },
  ],
  shareLinks: [
    { name: "x", url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "mail", url: "mailto:?subject=See%20this%20post&body=" },
  ],
});
