import { defineConfig } from "@playwright/test";

// FluxBlog E2E：基于生产构建后验证。默认起 Node SSR server（dist/server/entry.mjs）。
// 或用 FLUXBLOG_E2E_BASE_URL 指向已部署站点（需后端 + PG + 已导入内容）。
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.FLUXBLOG_E2E_BASE_URL || "http://127.0.0.1:4321/blog/",
    trace: "on-first-retry",
  },
  webServer: process.env.FLUXBLOG_E2E_BASE_URL
    ? undefined
    : {
        command: "HOST=127.0.0.1 PORT=4321 node ./dist/server/entry.mjs",
        port: 4321,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true } },
  ],
});
