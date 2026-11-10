import { expect, type Page, test } from "@playwright/test";

const 管理员用户 = {
  id: "admin",
  name: "测试超级管理员",
  displayName: "测试超级管理员",
  username: "admin",
  role: "superadmin",
  roleCodes: ["superadmin"],
  avatar: "测",
  region: "",
  bigRegion: "",
  partnerId: "",
  partnerName: "",
  status: "active",
  _storagePrefix: "admin_",
};

const 区管用户 = {
  ...管理员用户,
  id: "region-manager",
  name: "湖南区区管",
  displayName: "湖南区区管",
  username: "hunan_manager",
  role: "admin",
  roleCodes: ["region_manager"],
  region: "湖南区",
};

const 普通管理员用户 = {
  ...管理员用户,
  id: "ordinary-admin",
  name: "普通管理员",
  displayName: "普通管理员",
  username: "ordinary_admin",
  role: "admin",
  roleCodes: ["admin"],
  region: "",
};

const 旧区管缓存用户 = {
  ...普通管理员用户,
  id: "stale-region-manager",
  name: "湖南区区管旧缓存",
  displayName: "湖南区区管旧缓存",
  username: "hunan_manager",
};

const 测试报价 = {
  id: "QUOTE-001",
  quoteNo: "QUOTE-001",
  customer: "收益入口测试客户",
  partnerName: "收益入口测试渠道",
  status: "draft",
  total: 120000,
  validDays: 30,
  endpoints: 100,
  products: [],
  hardwareItems: [],
  region: "湖南区",
  createdAt: "2026-09-18T02:00:00.000Z",
};

const 测试订单 = {
  id: "ORDER-001",
  quoteId: "QUOTE-001",
  quoteNo: "QUOTE-001",
  customer: "收益入口测试客户",
  partnerName: "收益入口测试渠道",
  total: 120000,
  status: "pending_superadmin_confirm",
  deliveryAddr: "测试地址",
  contacts: "测试联系人 13800000000",
  region: "湖南区",
  createdAt: "2026-09-18T02:00:00.000Z",
  statusHistory: [],
};

function 构造收益响应(statusCode: "estimated" | "frozen") {
  return {
    success: true,
    data: {
      quoteId: "QUOTE-001",
      orderId: "ORDER-001",
      scopeCode: "weidun",
      statusCode,
      statusName: statusCode === "frozen" ? "已冻结" : "实时预估",
      formulaVersion: "weidun-v1",
      warrantyYears: 3,
      procurementMaintenanceYears: 0,
      quoteRowVersion: 1,
      calculationVersion: statusCode === "frozen" ? 1 : null,
      summary: {
        productContractAmount: "120000.000000",
        serviceContractAmount: "0.000000",
        effectiveContractIncome: "114000.000000",
        projectProfit: "111000.000000",
      },
      details: {},
      softwareLines: [],
      hardwareLines: [],
      missingRules: [],
    },
    meta: {
      requestId: "00000000-0000-4000-8000-000000000001",
      build: { 版本: "test", 提交: "test", 构建时间: "2026-09-18T00:00:00.000Z" },
    },
  };
}

async function 准备管理员页面(
  page: Page,
  收益响应: ReturnType<typeof 构造收益响应>,
  用户: typeof 管理员用户 = 管理员用户,
  刷新后用户: typeof 管理员用户 | null = null,
) {
  await page.addInitScript((用户) => {
    localStorage.setItem("admin_auth_token", "test-admin-token");
    localStorage.setItem("admin_user_info", JSON.stringify(用户));
    localStorage.setItem(
      "admin_api_user",
      JSON.stringify({ user: 用户, token: "test-admin-token" }),
    );
  }, 用户);

  await page.route("**/api/quotes/**/profit-calculation", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(收益响应),
    });
  });

  await page.route("**/api/v2/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me") && 刷新后用户) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, user: 刷新后用户, token: "test-admin-token" }),
      });
      return;
    }
    const data = path.endsWith("/quotes") ? [测试报价] : path.endsWith("/orders") ? [测试订单] : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data, notifications: [] }),
    });
  });

  await page.route("**/api/messages/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [], notifications: [] }),
    });
  });

  await page.route("**/api/org/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: {}, notifications: [] }),
    });
  });
}

test("报价管理详情展示可编辑的内部收益核算", async ({ page }) => {
  await 准备管理员页面(page, 构造收益响应("estimated"));
  await page.goto("/admin.html#/quote");
  await page.getByText("QUOTE-001", { exact: true }).first().click();

  const 收益面板 = page.locator(".quote-profit-panel");
  await expect(收益面板).toBeVisible();
  await expect(收益面板.getByText("内部收益核算")).toBeVisible();
  await expect(收益面板.getByRole("button", { name: "保存草稿" })).toBeVisible();
  await expect(收益面板.getByRole("button", { name: "重新计算" })).toBeVisible();
});

test("所属区域区管可以从报价管理详情查看收益", async ({ page }) => {
  await 准备管理员页面(page, 构造收益响应("estimated"), 区管用户);
  await page.goto("/admin.html#/quote");
  await page.getByText("QUOTE-001", { exact: true }).first().click();

  await expect(page.locator(".quote-profit-panel")).toBeVisible();
  await expect(page.locator(".quote-profit-panel").getByText("内部收益核算")).toBeVisible();
});

test("没有收益权限的普通管理员不渲染收益面板", async ({ page }) => {
  await 准备管理员页面(page, 构造收益响应("estimated"), 普通管理员用户);
  await page.goto("/admin.html#/quote");
  await page.getByText("QUOTE-001", { exact: true }).first().click();

  await expect(page.getByText("报价单预览 — QUOTE-001")).toBeVisible();
  await expect(page.locator(".quote-profit-panel")).toHaveCount(0);
});

test("旧区管登录缓存会在页面启动后刷新并显示收益", async ({ page }) => {
  await 准备管理员页面(page, 构造收益响应("estimated"), 旧区管缓存用户, 区管用户);
  await page.goto("/admin.html#/quote");
  await page.getByText("QUOTE-001", { exact: true }).first().click();

  await expect(page.locator(".quote-profit-panel")).toBeVisible();
});

test("订单详情冻结前展示只读的非正式收益", async ({ page }) => {
  await 准备管理员页面(page, 构造收益响应("estimated"));
  await page.goto("/admin.html#/order");
  await page.getByText("ORDER-001", { exact: true }).first().click();

  const 收益面板 = page.locator('.quote-profit-panel[data-context="order"]');
  await expect(收益面板).toBeVisible();
  await expect(
    收益面板.getByText("订单尚未形成正式收益快照，以下为最新核算结果，仅供内部参考。"),
  ).toBeVisible();
  await expect(收益面板.locator("input")).toHaveCount(0);
  await expect(收益面板.locator("button")).toHaveCount(0);
});

test("订单详情冻结后展示只读的正式收益快照", async ({ page }) => {
  await 准备管理员页面(page, 构造收益响应("frozen"));
  await page.goto("/admin.html#/order");
  await page.getByText("ORDER-001", { exact: true }).first().click();

  const 收益面板 = page.locator('.quote-profit-panel[data-context="order"]');
  await expect(收益面板).toBeVisible();
  await expect(收益面板.getByText("已冻结")).toBeVisible();
  await expect(
    收益面板.getByText("该订单已形成正式收益快照，以下金额只读且不可覆盖。"),
  ).toBeVisible();
  await expect(收益面板.locator("input")).toHaveCount(0);
  await expect(收益面板.locator("button")).toHaveCount(0);
});
