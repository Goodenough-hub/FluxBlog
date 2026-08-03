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
    heroIntro:
      "这里是 FluxBlog，我的个人技术博客。我是一名后端工程师，关注 AI Infra 与 AI Agent 的落地——这里记录工程实践、系统设计与踩过的坑，偶有零散思考。本站用 Astro 搭建，默认支持浅色与深色模式，欢迎通过 RSS 订阅。",
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
    search: true,
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
