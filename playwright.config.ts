import { defineConfig } from "@playwright/test";

// FluxBlog E2E：基于生产构建后验证。需要先 `npm run build` 并 `npm run preview`，
// 或指向已部署站点。CI 与本地默认测 http://127.0.0.1:4321/blog/（astro preview）。
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
        command: "npm run preview -- --port 4321",
        port: 4321,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true } },
  ],
});
