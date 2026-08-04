import { expect, type Page, test } from "@playwright/test";

const 测试用户 = {
  success: true,
  data: {
    user: {
      username: "admin",
      displayName: "产品交付验收账号",
      roleName: "产品交付总监",
      defaultPath: "/unified",
      allowedPaths: ["/unified", "/admin", "/partner", "/mobile"],
    },
    pageSession: {
      token: "v2.YWRtaW4.test-token",
      user: {
        id: "admin",
        userId: "admin",
        username: "admin",
        name: "产品交付验收账号",
        displayName: "产品交付验收账号",
        role: "superadmin",
        roleName: "超级管理员",
        status: "active",
        region: "",
        bigRegion: "",
        partnerId: "",
        partnerName: "",
      },
    },
  },
  meta: {
    requestId: "00000000-0000-4000-8000-000000000001",
    build: { 版本: "3.0.0-test", 提交: "test", 构建时间: "2026-07-27T00:00:00.000Z" },
  },
};

const 渠道测试用户 = {
  ...测试用户,
  data: {
    user: {
      username: "partner_staff",
      displayName: "渠道员工",
      roleName: "渠道用户",
      defaultPath: "/partner/dashboard",
      allowedPaths: ["/partner", "/mobile"],
    },
    pageSession: {
      token: "v2.cGFydG5lcl9zdGFmZg.test-token",
      user: {
        id: "staff-001",
        userId: "staff-001",
        username: "partner_staff",
        name: "渠道员工",
        displayName: "渠道员工",
        role: "staff",
        roleName: "渠道用户",
        status: "active",
        region: "华南",
        bigRegion: "南区",
        partnerId: "partner-001",
        partnerName: "测试渠道商",
      },
    },
  },
};

const 测试概览 = {
  success: true,
  data: {
    统计: [
      { 标题: "渠道商", 数量: 192, 说明: "正式渠道主档" },
      { 标题: "客户报备", 数量: 151, 说明: "正式客户报备" },
      { 标题: "商机", 数量: 43, 说明: "正式商机" },
      { 标题: "报价单", 数量: 4, 说明: "正式报价" },
      { 标题: "订单", 数量: 1, 说明: "正式订单" },
      { 标题: "产品", 数量: 34, 说明: "正式产品功能" },
    ],
    待办: [
      {
        id: "REG-001",
        编号: "REG-001",
        类型: "客户报备",
        标题: "北京测试客户",
        客户名称: "北京测试客户",
        渠道名称: "测试渠道",
        负责人: "测试负责人",
        区域: "华北区",
        状态: "pending",
        状态名称: "待审核",
        金额: 0,
        创建时间: "2026-07-27T00:00:00.000Z",
        更新时间: "2026-07-27T00:00:00.000Z",
        原始数据: {},
      },
    ],
    最近业务: [
      {
        id: "OPP-001",
        编号: "OPP-001",
        类型: "商机",
        标题: "测试商机",
        客户名称: "北京测试客户",
        渠道名称: "测试渠道",
        负责人: "测试负责人",
        区域: "华北区",
        状态: "closing",
        状态名称: "签约中",
        金额: 88000,
        创建时间: "2026-07-27T00:00:00.000Z",
        更新时间: "2026-07-27T00:00:00.000Z",
        原始数据: {},
      },
      {
        id: "QT-001",
        编号: "QT-001",
        类型: "报价",
        标题: "测试报价",
        客户名称: "北京测试客户",
        渠道名称: "测试渠道",
        负责人: "测试负责人",
        区域: "华北区",
        状态: "draft",
        状态名称: "草稿",
        金额: 120000,
        创建时间: "2026-07-27T00:00:00.000Z",
        更新时间: "2026-07-27T00:00:00.000Z",
        原始数据: {},
      },
    ],
    迁移状态: {
      批次编号: "S8-RUN-20260727-001",
      正式落表: "validated",
      校验结论: "通过",
    },
  },
  meta: 测试用户.meta,
};

const 测试列表 = {
  success: true,
  data: {
    数据: [
      {
        id: "REG-001",
        编号: "REG-001",
        类型: "客户报备",
        标题: "北京测试客户",
        客户名称: "北京测试客户",
        渠道名称: "测试渠道",
        负责人: "测试负责人",
        区域: "华北区",
        状态: "pending",
        状态名称: "待审核",
        金额: 0,
        创建时间: "2026-07-27T00:00:00.000Z",
        更新时间: "2026-07-27T00:00:00.000Z",
        原始数据: {},
      },
    ],
    分页: { 页码: 1, 每页: 20, 总数: 1 },
  },
  meta: 测试用户.meta,
};

const 测试商机列表 = {
  success: true,
  data: {
    数据: [
      {
        id: "OPP-001",
        编号: "OPP-001",
        类型: "商机",
        标题: "北京启明终端安全改造项目",
        客户名称: "北京测试客户",
        渠道名称: "测试渠道",
        负责人: "李销售",
        区域: "华北区",
        状态: "negotiation",
        状态名称: "招投标/商务谈判",
        金额: 88000,
        创建时间: "2026-07-27T00:00:00.000Z",
        更新时间: "2026-07-27T00:00:00.000Z",
        原始数据: {
          stage: "negotiation",
          contact: "张明",
          phone: "13800010001",
          expectedClose: "2026-08-30",
          lastFollowAt: "2026-07-27T00:00:00.000Z",
          lastFollowContent: "客户预算基本确认，等待采购流程。",
          regId: "REG-001",
          quoteId: "QT-001",
          endpoints: 200,
          probability: 70,
        },
      },
      {
        id: "OPP-002",
        编号: "OPP-002",
        类型: "商机",
        标题: "上海云鼎准入扩容项目",
        客户名称: "上海云鼎信息技术有限公司",
        渠道名称: "测试渠道",
        负责人: "王销售",
        区域: "华东区",
        状态: "registered",
        状态名称: "商机明确并报备",
        金额: 52000,
        创建时间: "2026-07-26T00:00:00.000Z",
        更新时间: "2026-07-27T00:00:00.000Z",
        原始数据: { stage: "registered", regId: "REG-002", expectedClose: "2026-09-10" },
      },
    ],
    分页: { 页码: 1, 每页: 20, 总数: 2 },
  },
  meta: 测试用户.meta,
};

const 测试报价列表 = {
  success: true,
  data: {
    数据: [
      {
        id: "QT-001",
        编号: "QT-001",
        类型: "报价",
        标题: "北京启明终端安全报价",
        客户名称: "北京测试客户",
        渠道名称: "测试渠道",
        负责人: "李销售",
        区域: "华北区",
        状态: "draft",
        状态名称: "草稿",
        金额: 120000,
        创建时间: "2026-07-27T00:00:00.000Z",
        更新时间: "2026-07-27T00:00:00.000Z",
        原始数据: {
          opportunityName: "北京启明终端安全改造项目",
          endpoints: 200,
          validDays: 30,
          products: [
            { id: "P-001", name: "终端安全管理", type: "软件产品", qty: 200, subtotal: 60000 },
          ],
        },
      },
    ],
    分页: { 页码: 1, 每页: 20, 总数: 1 },
  },
  meta: 测试用户.meta,
};

const 测试产品列表 = {
  success: true,
  data: {
    数据: [
      {
        id: "P-001",
        编号: "P-001",
        类型: "功能模块",
        标题: "终端安全管理",
        客户名称: "",
        渠道名称: "",
        负责人: "",
        区域: "",
        状态: "active",
        状态名称: "正常",
        金额: 300,
        创建时间: "2026-07-27T00:00:00.000Z",
        更新时间: "2026-07-27T00:00:00.000Z",
        原始数据: {
          categoryName: "终端安全",
          moduleName: "终端安全管理",
          description: "联软终端安全产品线",
        },
      },
      {
        id: "HW-001",
        编号: "HW-001",
        类型: "硬件设备",
        标题: "准入网关设备",
        客户名称: "",
        渠道名称: "",
        负责人: "",
        区域: "",
        状态: "active",
        状态名称: "正常",
        金额: 12000,
        创建时间: "2026-07-27T00:00:00.000Z",
        更新时间: "2026-07-27T00:00:00.000Z",
        原始数据: { categoryName: "硬件产品", moduleName: "准入网关", description: "硬件设备" },
      },
      {
        id: "PKG-001",
        编号: "PKG-001",
        类型: "推荐套餐",
        标题: "终端安全基础套餐",
        客户名称: "",
        渠道名称: "",
        负责人: "",
        区域: "",
        状态: "active",
        状态名称: "正常",
        金额: 30000,
        创建时间: "2026-07-27T00:00:00.000Z",
        更新时间: "2026-07-27T00:00:00.000Z",
        原始数据: { categoryName: "推荐套餐", moduleName: "基础套餐", description: "精选产品组合" },
      },
    ],
    分页: { 页码: 1, 每页: 20, 总数: 3 },
  },
  meta: 测试用户.meta,
};

const 测试通知列表 = {
  success: true,
  data: {
    数据: [
      {
        id: "N-001",
        编号: "N-001",
        类型: "通知",
        标题: "报备审核通过",
        客户名称: "",
        渠道名称: "",
        负责人: "",
        区域: "",
        状态: "unread",
        状态名称: "未读",
        金额: 0,
        创建时间: "2026-07-27T00:00:00.000Z",
        更新时间: "2026-07-27T00:00:00.000Z",
        原始数据: { desc: "客户报备已通过厂商审批" },
      },
    ],
    分页: { 页码: 1, 每页: 20, 总数: 1 },
  },
  meta: 测试用户.meta,
};

const 测试用户列表 = {
  success: true,
  data: {
    数据: [
      {
        id: "USER-001",
        编号: "admin",
        类型: "账号",
        标题: "产品交付验收账号",
        客户名称: "",
        渠道名称: "",
        负责人: "admin",
        区域: "总部",
        状态: "active",
        状态名称: "启用",
        金额: 0,
        创建时间: "2026-07-27T00:00:00.000Z",
        更新时间: "2026-07-27T00:00:00.000Z",
        原始数据: { role: "superadmin" },
      },
    ],
    分页: { 页码: 1, 每页: 20, 总数: 1 },
  },
  meta: 测试用户.meta,
};

const 测试开放接口总览 = {
  success: true,
  data: {
    baseUrl: "http://127.0.0.1:5173/api/open/v1",
    tokenEndpoint: "http://127.0.0.1:5173/api/open/v1/auth/token",
    tokenTtlSeconds: 7200,
    coreResources: ["users", "partners", "registrations", "opportunities", "quotes", "orders"],
    docs: [
      {
        id: "openapi-quickstart",
        title: "OpenAPI 对接说明",
        description: "AppKey、AppSecret、Token 和核心资源调用说明。",
        fileName: "OpenAPI对接说明.md",
        available: true,
      },
    ],
  },
  meta: 测试用户.meta,
};

const 测试开放接口客户端 = {
  success: true,
  data: [
    {
      id: "CLIENT-001",
      name: "AI-agent-superadmin-prod",
      appKey: "oak_test",
      boundUserId: "USER-001",
      status: "active",
      ipWhitelist: [],
      allowedResources: ["registrations", "quotes", "orders"],
      expiresAt: "",
      remark: "测试对接",
      secretResetRequired: false,
      boundUser: {
        id: "USER-001",
        username: "admin",
        name: "产品交付验收账号",
        role: "superadmin",
      },
    },
  ],
  meta: 测试用户.meta,
};

const 测试开放接口日志 = {
  success: true,
  data: [
    {
      id: "LOG-001",
      requestId: "REQ-001",
      time: "2026-07-27T00:00:00.000Z",
      clientName: "AI-agent-superadmin-prod",
      resultCode: 200,
      method: "GET",
      path: "/api/open/v1/registrations",
      ip: "127.0.0.1",
      resultMessage: "OpenAPI资源读取成功",
    },
  ],
  meta: 测试用户.meta,
};

const 测试工作量映射 = {
  success: true,
  data: [
    {
      featureId: "P-001",
      featureName: "终端安全管理",
      itemType: "feature",
      moduleName: "终端安全管理",
      categoryName: "终端安全",
      productCode: "LEP-EPP-BASE",
      deliveryTags: ["EPP_BASE"],
      active: true,
    },
    {
      featureId: "HW-001",
      featureName: "准入网关设备",
      itemType: "hardware",
      moduleName: "硬件产品",
      categoryName: "硬件产品",
      productCode: "UNACC-1100",
      deliveryTags: ["NXG_NO_DLP"],
      active: true,
    },
  ],
  meta: 测试用户.meta,
};

const 测试工作量规则 = {
  success: true,
  data: [
    {
      id: "RULE-001",
      item: "EPP（仅DLP基础）",
      productTypeLabel: "EPP（仅DLP基础）",
      deliveryTag: "EPP_BASE",
      condition: "1-100点",
      ruleType: "base",
      minPoints: 1,
      maxPoints: 100,
      personDays: 2.5,
      comboPersonDays: null,
      remark: "基础交付工作量",
      active: true,
    },
  ],
  meta: 测试用户.meta,
};

async function 模拟已登录(page: Page) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(测试用户),
    });
  });
  await page.route("**/api/stage9/overview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(测试概览),
    });
  });
  await page.route("**/api/stage9/products?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(测试产品列表),
    });
  });
  await page.route("**/api/stage9/notifications?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(测试通知列表),
    });
  });
  await page.route("**/api/open-api/overview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(测试开放接口总览),
    });
  });
  await page.route("**/api/open-api/clients", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(测试开放接口客户端),
    });
  });
  await page.route("**/api/open-api/logs?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(测试开放接口日志),
    });
  });
  await page.route("**/api/workload/mappings**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(测试工作量映射),
    });
  });
  await page.route("**/api/workload/delivery-rules", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(测试工作量规则),
    });
  });
  await page.route("**/api/stage9/**", async (route) => {
    const url = route.request().url();
    const body = url.includes("/notifications")
      ? 测试通知列表
      : url.includes("/products")
        ? 测试产品列表
        : url.includes("/users")
          ? 测试用户列表
          : url.includes("/opportunities")
            ? 测试商机列表
            : url.includes("/quotes")
              ? 测试报价列表
              : 测试列表;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.route("**/api/notifications/read", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { updated: true }, meta: 测试用户.meta }),
    });
  });
}

test("四种布局测试路由可以访问", async ({ page }) => {
  await 模拟已登录(page);
  for (const 路径 of ["/unified", "/admin", "/partner", "/mobile"]) {
    await page.goto(路径);
    await expect(page.locator("main, section").first()).toBeVisible();
    await expect(page.locator("body")).toContainText(/联软渠道|仪表盘|工作台|移动端/);
  }
});

test("未登录访问入口会跳转登录页", async ({ page }) => {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        error: { message: "请先登录。" },
        meta: 测试用户.meta,
      }),
    });
  });
  await page.goto("/admin");
  await expect(page.locator("button", { hasText: /登\s*录/ })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("默认登录页直接展示统一账号密码表单", async ({ page }) => {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        error: { message: "请先登录。" },
        meta: 测试用户.meta,
      }),
    });
  });

  await page.goto("/login");
  await expect(page.locator("body")).toContainText("统一登录入口");
  await expect(page.locator("body")).toContainText("登录账号");
  await expect(page.locator("button", { hasText: /登\s*录/ })).toBeVisible();
  await expect(page.locator(".role-options")).toHaveCount(0);
});

test("显式入口参数仍使用统一账号密码表单", async ({ page }) => {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        error: { message: "请先登录。" },
        meta: 测试用户.meta,
      }),
    });
  });

  await page.goto("/login?entry=select");
  await expect(page.getByText("登录账号", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /厂商管理入口/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /渠道合作伙伴入口/ })).toHaveCount(0);
  await expect(page.locator("button", { hasText: /登\s*录/ })).toBeVisible();
});

test("统一登录后进入现有管理员页面并写入页面会话", async ({ page }, testInfo) => {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ success: false, error: { message: "请先登录。" } }),
    });
  });
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(测试用户),
    });
  });
  await page.route("**/api/v2/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [], notifications: [] }),
    });
  });

  await page.goto("/login");
  await page.getByPlaceholder("请输入登录账号").fill("admin");
  await page.getByPlaceholder("请输入密码").fill("test-password");
  await page.locator("button", { hasText: /登\s*录/ }).click();

  if (testInfo.project.name === "移动浏览器") {
    await expect(page).toHaveURL(/\/mobile\.html\?scope=admin#\/admin\/home$/);
  } else {
    await expect(page).toHaveURL(/\/admin\.html#\/dashboard$/);
  }
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("admin_auth_token")))
    .toBe("v2.YWRtaW4.test-token");
});

test("统一登录后进入现有渠道页面并写入页面会话", async ({ page }, testInfo) => {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ success: false, error: { message: "请先登录。" } }),
    });
  });
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(渠道测试用户),
    });
  });
  await page.route("**/api/v2/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [], notifications: [] }),
    });
  });

  await page.goto("/login");
  await page.getByPlaceholder("请输入登录账号").fill("partner_staff");
  await page.getByPlaceholder("请输入密码").fill("test-password");
  await page.locator("button", { hasText: /登\s*录/ }).click();

  if (testInfo.project.name === "移动浏览器") {
    await expect(page).toHaveURL(/\/mobile\.html\?scope=partner#\/partner\/home$/);
  } else {
    await expect(page).toHaveURL(/\/partner\.html#\/dashboard$/);
  }
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("partner_auth_token")))
    .toBe("v2.cGFydG5lcl9zdGFmZg.test-token");
});

test("手机渠道路由使用渠道端一期底部导航", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mobile/partner/home");

  const 导航 = page.locator("nav[aria-label='移动端导航']");
  await expect(导航.locator(".移动端导航项")).toHaveText([
    /工作台/,
    /客户/,
    /商机/,
    /报价/,
    /我的/,
  ]);
  await expect(导航.getByText("审核")).toHaveCount(0);
});

test("桌面工作台展示V2快捷入口和通知抽屉", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/partner/dashboard");

  await expect(page.locator(".quick-action", { hasText: "客户报备" })).toBeVisible();
  await expect(page.getByText("近期商机")).toBeVisible();
  await expect(page.getByText("主力产品线")).toBeVisible();

  await page.getByTitle("通知").click();
  await expect(page.locator(".notif-panel[aria-label='通知中心']")).toHaveClass(/open/);
  await expect(page.getByText("报备审核通过")).toBeVisible();
});

test("产品目录展示V2标签页、大类卡和模块弹窗", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/partner/products");

  await expect(page.locator(".tab-nav")).toContainText("产品目录");
  await expect(page.locator(".tab-nav")).toContainText("推荐套餐");
  await expect(page.locator(".category-card", { hasText: "终端安全" })).toBeVisible();

  await page.locator(".category-card", { hasText: "终端安全" }).click();
  await expect(page.locator(".module-card-grid")).toBeVisible();
  await expect(page.locator(".module-card-v", { hasText: "终端安全管理" })).toBeVisible();

  await page.locator(".module-card-v", { hasText: "终端安全管理" }).click();
  await expect(page.locator(".v2-product-detail-desc")).toContainText("联软终端安全产品线");
});

test("商机管理展示V2列表看板和分栏详情", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/partner/opportunity");

  await expect(page.getByText("北京启明终端安全改造项目")).toBeVisible();
  await expect(page.getByText("合计金额")).toBeVisible();

  await page.locator("select", { hasText: "看板视图" }).selectOption("kanban");
  await expect(page.locator(".opportunity-kanban")).toBeVisible();
  await expect(page.locator(".kanban-column", { hasText: "70% 招投标/商务谈判" })).toBeVisible();

  await page.locator(".kanban-card", { hasText: "北京启明终端安全改造项目" }).click();
  await expect(page.locator(".v2-opportunity-modal")).toBeVisible();
  await expect(page.locator(".v2-opportunity-side")).toContainText("关联记录");
  await expect(page.locator(".v2-follow-section")).toContainText("跟进记录");
});

test("新建报备展示V2步骤条和企业查询提示", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/partner/registration/new");

  await expect(page.locator(".v2-form-steps")).toContainText("客户信息");
  await page
    .getByPlaceholder("输入公司名关键词，自动查询工商信息并回填")
    .fill("北京启明科技有限公司");
  await expect(page.locator(".v2-enterprise-hint")).toContainText("工商查询入口");
});

test("管理端新建报备保持V2三步流程不回落列表", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/registration/new");

  await expect(page.locator(".card-title", { hasText: "新建客户报备" })).toBeVisible();
  await expect(page.locator(".v2-form-steps")).toContainText("客户信息");
  await expect(page.locator(".v2-form-steps")).toContainText("指派渠道");
  await expect(page.locator(".v2-form-steps")).toContainText("提交确认");
  await expect(page.getByPlaceholder("输入公司名关键词，自动查询工商信息并回填")).toBeVisible();
  await expect(
    page.locator(".v2-create-card").getByRole("button", { name: "下一步" }),
  ).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "报备编号" })).toHaveCount(0);
});

test("管理端审核中心展示V2客户报备审核台", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/admin-review");

  await expect(page.locator(".v2-review-tabs")).toContainText("客户报备");
  await expect(page.locator(".v2-review-tabs")).toContainText("渠道商");
  await expect(page.locator(".v2-review-tabs")).toContainText("员工");
  await expect(page.getByRole("heading", { name: "客户报备审核" })).toBeVisible();
  for (const 表头 of ["报备编号", "客户名称", "所属区域", "行业", "联系人", "提交日期", "操作"]) {
    await expect(page.getByRole("columnheader", { name: 表头 })).toBeVisible();
  }
  await expect(page.locator(".v2-review-page").getByRole("button", { name: /通过/ })).toBeVisible();
  await expect(page.locator(".v2-review-page").getByRole("button", { name: /拒绝/ })).toBeVisible();
});

test("管理端OpenAPI展示V2对接总览和凭证管理页", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/openapi-integration");

  await expect(page.getByText("OpenAPI 对接总览")).toBeVisible();
  await expect(page.getByText("对接参数速览")).toBeVisible();
  await expect(page.getByText("Client 凭证管理")).toBeVisible();
  await expect(page.getByText("OpenAPI 调用审计")).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "AI-agent-superadmin-prod", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "标题" })).toHaveCount(0);
});

test("管理端工作量配置展示V2映射规则和交付规则", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/workload-config");

  await expect(page.getByText("标准工作量配置")).toBeVisible();
  await expect(page.getByText("产品映射规则")).toBeVisible();
  await expect(page.getByText("交付工作量规则（LEP-DELIVERY-20260612）")).toBeVisible();
  await expect(page.getByRole("row", { name: /终端安全管理/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: "EPP（仅DLP基础）" }).last()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "标题" })).toHaveCount(0);
});

test("管理端新建商机展示V2业务字段", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/opportunity/new");

  await expect(page.locator(".card-title", { hasText: "新建商机" })).toBeVisible();
  await expect(page.getByText("关联报备客户")).toBeVisible();
  await expect(page.getByText("商机名称 *")).toBeVisible();
  await expect(page.getByText("当前阶段")).toBeVisible();
  await expect(page.getByText("预计金额（元） *")).toBeVisible();
  await expect(page.getByText("端点数量")).toBeVisible();
  await expect(page.getByText("预计关闭日期")).toBeVisible();
  await expect(page.getByText("首次跟进记录")).toBeVisible();
  await expect(page.getByRole("button", { name: "创建商机" })).toBeVisible();
});

test("管理端新建报价展示V2客户搜索和完善提示", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/quote/new");

  await expect(page.locator(".v2-quick-quote-banner")).toContainText("智能报价配置器");
  await expect(page.getByText("客户搜索")).toBeVisible();
  await expect(page.locator(".quote-mode-selector")).toContainText("套餐报价");
  await expect(page.locator(".v2-quote-product-card").first()).toContainText("查看详情");
  await expect(page.getByRole("button", { name: "请完善信息" })).toBeVisible();
});

test("新建报价展示V2智能报价配置器", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/partner/quote/new");

  await expect(page.locator(".v2-quick-quote-banner")).toContainText("智能报价配置器");
  await expect(page.locator(".quote-mode-selector")).toContainText("套餐报价");
  await page.getByRole("button", { name: /自定义报价/ }).click();
  await expect(page.locator(".mode-card.active")).toContainText("自定义报价");

  await page.locator(".v2-quote-product-card", { hasText: "终端安全管理" }).click();
  await expect(page.locator(".summary-section")).toContainText("终端安全管理");
  await expect(page.locator(".grand-total-box")).toContainText("报价总额");
});

test("手机列表写入入口保持移动端路由", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mobile/partner/registrations");

  await page.locator(".v2-write-entry").getByRole("link", { name: "进入" }).click();
  await expect(page).toHaveURL(/\/mobile\/partner\/registrations\/new/);
  await expect(page.locator("nav[aria-label='移动端导航']")).toHaveCount(0);
});

test("手机管理员业务查询展示V2四段切换", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mobile/admin/business");

  const 分段控件 = page.locator(".segment-control");
  await expect(分段控件.getByRole("button", { name: "报备" })).toHaveClass(/active/);
  await 分段控件.getByRole("button", { name: "报价" }).click();
  await expect(分段控件.getByRole("button", { name: "报价" })).toHaveClass(/active/);
  await expect(page.locator(".record-card").first()).toBeVisible();
});

test("新建手机页隐藏底部导航并显示返回按钮", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mobile/partner/registrations/new");

  await expect(page.locator("nav[aria-label='移动端导航']")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "返回" })).toBeVisible();
});
