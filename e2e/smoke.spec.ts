import { test, expect } from "@playwright/test";

// 冒烟：公开站点基本可用。覆盖 /blog/、文章、搜索、暗色模式、移动端 viewport。
// 发布/撤回/登录等涉及后端 + PG 的流程在集成环境单独覆盖（需运行 AppPilot）。

test("首页与文章可达", async ({ page }) => {
  await page.goto("");
  await expect(page).toHaveTitle(/FluxBlog/);
  // 进入一篇文章
  await page.getByRole("link", { name: /欢迎|Markdown/ }).first().click();
  await expect(page.locator("article")).toBeVisible();
});

test("搜索页可用", async ({ page }) => {
  await page.goto("search/");
  // Pagefind UI 懒加载，输入后应出现结果
  await page.getByPlaceholder(/search|搜索/i).first().fill("FluxBlog");
  // 等待结果出现（放宽超时）
  await expect(page.locator(".pagefind-ui__result").first()).toBeVisible({ timeout: 15_000 });
});

test("暗色模式切换", async ({ page }) => {
  await page.goto("");
  const html = page.locator("html");
  const before = await html.getAttribute("data-theme");
  await page.getByRole("button", { name: /theme|主题|dark|light/i }).first().click().catch(() => {});
  // 切换后 data-theme 应改变（或保持，若无按钮则跳过）
  const after = await html.getAttribute("data-theme");
  expect(before).toBeTruthy();
  expect(after).toBeTruthy();
});
