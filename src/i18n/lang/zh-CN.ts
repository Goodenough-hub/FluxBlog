import type { UIStrings } from "../types";

export default {
  nav: {
    home: "首页",
    posts: "文章",
    tags: "标签",
    about: "关于",
    projects: "项目",
    archives: "归档",
    search: "搜索",
  },
  post: {
    publishedAt: "发布于",
    updatedAt: "更新",
    sharePostIntro: "分享这篇文章：",
    sharePostOn: "在 {{platform}} 上分享",
    sharePostViaEmail: "通过邮件分享",
    tagLabel: "标签",
    backToTop: "回到顶部",
    goBack: "返回",
    editPage: "编辑此页",
    previousPost: "上一篇",
    nextPost: "下一篇",
  },
  pagination: {
    prev: "上一页",
    next: "下一页",
    page: "页",
  },
  home: {
    socialLinks: "社交链接",
    featured: "精选",
    recentPosts: "最近文章",
    allPosts: "全部文章",
    contribution: {
      title: "发布动态",
      summary: "近一年公开发布 {{count}} 篇 · 活跃 {{days}} 天",
      empty: "近一年暂无公开发布",
      graphLabel: "公开发布贡献图：近一年发布 {{count}} 篇，活跃 {{days}} 天",
      legendLabel: "颜色越深表示当天发布的文章越多",
      hint: "悬停、轻点或用方向键查看某日详情",
      less: "少",
      more: "多",
      dayEmpty: "{{date}} · 无发布",
      dayOne: "{{date}} · 发布 {{count}} 篇",
      dayMany: "{{date}} · 发布 {{count}} 篇",
      dayWithPrivate: "{{date}} · 发布 {{count}} 篇",
    },
  },
  preview: {
    contribution: {
      title: "发布动态（含私有）",
      summary:
        "近一年发布 {{count}} 篇 · 私有 {{privateCount}} 篇 · 活跃 {{days}} 天",
      empty: "近一年暂无公开或私有发布",
      graphLabel:
        "预览发布贡献图：近一年发布 {{count}} 篇，其中私有 {{privateCount}} 篇，活跃 {{days}} 天",
      legendLabel: "颜色越深表示当天发布的文章越多",
      hint: "悬停、轻点或用方向键查看某日详情",
      less: "少",
      more: "多",
      dayEmpty: "{{date}} · 无发布",
      dayOne: "{{date}} · 发布 {{count}} 篇",
      dayMany: "{{date}} · 发布 {{count}} 篇",
      dayWithPrivate:
        "{{date}} · 发布 {{count}} 篇（私有 {{privateCount}} 篇）",
    },
  },
  footer: {
    copyright: "版权",
    allRightsReserved: "保留所有权利。",
  },
  pages: {
    tagTitle: "标签",
    tagDesc: "带有该标签的全部文章",

    tagsTitle: "标签",
    tagsDesc: "文章中用到的全部标签。",

    postsTitle: "文章",
    postsDesc: "已发布的全部文章。",

    archivesTitle: "归档",
    archivesDesc: "全部归档文章。",

    searchTitle: "搜索",
    searchDesc: "搜索任意文章……",

    projectsTitle: "项目",
    projectsDesc: "按项目分组的文章。",
  },
  a11y: {
    skipToContent: "跳到正文",
    openMenu: "打开菜单",
    closeMenu: "关闭菜单",
    toggleTheme: "切换主题",
    searchPlaceholder: "搜索文章……",
    noResults: "没有找到结果",
    goToPreviousPage: "上一页",
    goToNextPage: "下一页",
  },
  notFound: {
    title: "404 未找到",
    message: "页面不存在",
    goHome: "回到首页",
  },
} satisfies UIStrings;
