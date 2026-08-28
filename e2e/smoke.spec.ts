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

test("首页贡献图可用且不造成页面横向溢出", async ({ page }) => {
  await page.goto("");

  const graph = page.locator("#contribution-graph");
  const days = graph.locator("[data-contribution-day]");
  const detail = graph.locator("[data-contribution-detail]");
  await expect(graph).toBeVisible();
  expect(await days.count()).toBeGreaterThanOrEqual(365);
  expect(await days.count()).toBeLessThanOrEqual(371);

  const defaultDetail = await detail.textContent();
  await days.last().focus();
  await expect(days.last()).toBeFocused();
  await expect(detail).not.toHaveText(defaultDetail ?? "");

  await page.keyboard.press("ArrowLeft");
  const focusedDay = graph.locator("[data-contribution-day]:focus");
  await expect(focusedDay).toBeVisible();
  await expect(detail).toHaveText(
    (await focusedDay.getAttribute("data-label")) ?? ""
  );

  const scroller = graph.locator("[data-contribution-scroll]");
  const scrollMetrics = await scroller.evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth,
  }));
  const maxScrollLeft = scrollMetrics.scrollWidth - scrollMetrics.clientWidth;
  const viewportWidth = page.viewportSize()?.width ?? 0;
  if (viewportWidth >= 640) {
    expect(maxScrollLeft).toBeLessThanOrEqual(1);
  } else if (maxScrollLeft > 0) {
    expect(scrollMetrics.scrollLeft).toBeGreaterThan(maxScrollLeft - 2);
  }

  const hasPageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  expect(hasPageOverflow).toBe(false);
});

test("贡献图色阶随深浅主题切换", async ({ page }) => {
  await page.goto("");

  const legendCells = page.locator(".contribution-legend-cell");
  const readColors = () =>
    legendCells.evaluateAll(cells =>
      cells.map(cell => getComputedStyle(cell).backgroundColor)
    );
  const lightColors = await readColors();
  expect(new Set(lightColors).size).toBe(5);

  const html = page.locator("html");
  const beforeTheme = await html.getAttribute("data-theme");
  const menuButton = page.locator("#menu-btn");
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
  await page.locator("#theme-btn").click();
  await expect.poll(() => html.getAttribute("data-theme")).not.toBe(beforeTheme);

  const darkColors = await readColors();
  expect(new Set(darkColors).size).toBe(5);
  expect(darkColors).not.toEqual(lightColors);
});

test("搜索页可用", async ({ page }) => {
  await page.goto("search/");
  await page.getByPlaceholder(/search|搜索/i).first().fill("FluxBlog");
  // 后端 ILIKE 返回 Card 列表
  await expect(page.locator("main ul li").first()).toBeVisible({ timeout: 15_000 });
});

test("文章代码块为 Xcode 窗口风（含行号/复制，需后端）", async ({ page }) => {
  test.skip(!hasBackend, "需要 FLUXBLOG_E2E_BASE_URL 指向含代码块文章的站点");
  // 通过内容组约定：首页第一篇文章通常含代码；按站点实际调整 slug。
  await page.goto("./");
  const firstPost = page.locator("a[href*='/blog/posts/']").first();
  await firstPost.click();
  const win = page.locator(".xcode-window").first();
  await expect(win).toBeVisible();
  await expect(win.locator(".xcode-dots")).toBeVisible();
  await expect(win.locator(".xcode-copy")).toBeVisible();
  // 行号 gutter：第一行 ::before 计数存在（检查 line 元素存在即可）
  await expect(win.locator("pre.line-numbers .line").first()).toBeVisible();
});
