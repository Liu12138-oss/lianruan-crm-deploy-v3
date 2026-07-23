import { expect, test } from "@playwright/test";

test("四种布局测试路由可以访问", async ({ page }) => {
  for (const 路径 of ["/unified", "/admin", "/partner", "/mobile"]) {
    await page.goto(路径);
    await expect(page.locator("h1")).toBeVisible();
  }
});
