import { test, expect } from "@playwright/test";

// 冒烟测试分两组：
// - CI 常驻组：仅覆盖预渲染页（/blog/login/、/blog/404），不依赖后端 + PG。
// - 内容组：覆盖首页/文章/搜索（SSR，需 AppPilot 后端 + PG + 已导入内容）。
//   仅当 FLUXBLOG_E2E_BASE_URL 指向已部署站点时运行；本地无后端时跳过，
//   避免因 SSR fetch 失败 500 而误报。
const hasBackend = !!process.env.FLUXBLOG_E2E_BASE_URL;

test("登录页可达（预渲染）", async ({ page }) => {
  await page.goto("login/");
  await expect(page).toHaveTitle(/登录/);
  await expect(page.locator("#login-form")).toBeVisible();
});

test("登录页暗色模式切换（预渲染）", async ({ page }) => {
  await page.goto("login/");
  const html = page.locator("html");
  const before = await html.getAttribute("data-theme");
  expect(before).toMatch(/^(light|dark)$/);

  const menuButton = page.locator("#menu-btn");
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
  const themeButton = page.locator("#theme-btn");
  await expect(themeButton).toBeVisible();
  await themeButton.click();

  await expect.poll(() => html.getAttribute("data-theme")).not.toBe(before);
});

test("404 页可达（预渲染）", async ({ page }) => {
  await page.goto("this-slug-does-not-exist/");
  await expect(page.locator("body")).toBeVisible();
});

// ===== 内容组（需后端，CI 无后端时跳过）=====
test.skip(!hasBackend, "内容组需要后端 + PG + 已导入内容（设 FLUXBLOG_E2E_BASE_URL 启用）");

test("首页与文章可达", async ({ page }) => {
  await page.goto("");
  await expect(page).toHaveTitle(/FluxBlog/);
  await page.getByRole("link", { name: /欢迎|Markdown/ }).first().click();
  await expect(page.locator("article")).toBeVisible();
});

test("搜索页可用", async ({ page }) => {
  await page.goto("search/");
  await page.getByPlaceholder(/search|搜索/i).first().fill("FluxBlog");
  // 后端 ILIKE 返回 Card 列表
  await expect(page.locator("main ul li").first()).toBeVisible({ timeout: 15_000 });
});
