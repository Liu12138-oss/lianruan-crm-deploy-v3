import { expect, type Page, test } from "@playwright/test";

const 测试用户 = {
  success: true,
  data: {
    user: {
      username: "admin",
      displayName: "产品交付验收账号",
      roleName: "超级管理员",
      defaultPath: "/admin/dashboard",
      allowedPaths: ["/admin", "/partner", "/mobile"],
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
    mobileSession: {
      token: "v3m.YWRtaW4.test-mobile-token",
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
    mobileSession: {
      token: "v3m.cGFydG5lcl9zdGFmZg.test-mobile-token",
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
          id: "FEAT-END-01",
          productCode: "LEP-EPP-BASE",
          categoryCode: "CAT-END",
          categoryName: "终端安全",
          moduleName: "终端安全管理",
          description: "联软终端安全产品线",
        },
      },
      {
        id: "P-002",
        编号: "UA-NAC-1",
        类型: "功能模块",
        标题: "网络准入控制",
        客户名称: "",
        渠道名称: "",
        负责人: "",
        区域: "",
        状态: "active",
        状态名称: "正常",
        金额: 180,
        创建时间: "2026-07-27T00:00:00.000Z",
        更新时间: "2026-07-27T00:00:00.000Z",
        原始数据: {
          id: "FEAT-END-02",
          productCode: "UA-NAC-1",
          categoryCode: "CAT-END",
          categoryName: "终端安全",
          moduleName: "准入控制",
        },
      },
      {
        id: "HW-001",
        编号: "HW-001",
        类型: "硬件产品",
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
        类型: "产品套餐",
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
        原始数据: {
          featureIds: ["FEAT-END-01"],
          categoryName: "推荐套餐",
          moduleName: "基础套餐",
          description: "精选产品组合",
        },
      },
    ],
    分页: { 页码: 1, 每页: 20, 总数: 4 },
  },
  meta: 测试用户.meta,
};

const 测试产品树 = {
  success: true,
  data: [
    {
      id: "CAT-END",
      name: "终端安全",
      code: "CAT-END",
      type: "software",
      icon: "🛡️",
      sort: 1,
      modules: [
        {
          id: "MOD-END-01",
          categoryId: "CAT-END",
          name: "终端安全管理",
          code: "MOD-END-01",
          icon: "🖥️",
          sort: 1,
          features: [
            {
              id: "FEAT-END-01",
              uuid: "P-001",
              name: "终端安全管理",
              productCode: "LEP-EPP-BASE",
            },
          ],
        },
        {
          id: "MOD-END-02",
          categoryId: "CAT-END",
          name: "准入控制",
          code: "MOD-END-02",
          icon: "🌐",
          sort: 2,
          features: [
            {
              id: "FEAT-END-02",
              uuid: "P-002",
              name: "网络准入控制",
              productCode: "UA-NAC-1",
            },
          ],
        },
      ],
    },
  ],
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

async function 读取页面本地会话(page: Page, key: string) {
  try {
    return await page.evaluate((会话键) => localStorage.getItem(会话键), key);
  } catch (错误) {
    // 移动端统一登录会连续发生整页跳转，跳转瞬间旧执行上下文会被销毁；轮询时等待新页面即可。
    if (错误 instanceof Error && 错误.message.includes("Execution context was destroyed")) {
      return null;
    }
    throw 错误;
  }
}

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
  await page.route("**/api/v2/product-tree", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(测试产品树),
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

test("三种业务布局测试路由可以访问", async ({ page }) => {
  await 模拟已登录(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/admin$/);
  for (const 路径 of ["/admin", "/partner", "/mobile"]) {
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
  let 已登录 = false;
  await page.route("**/api/auth/me", async (route) => {
    if (已登录) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(测试用户),
      });
      return;
    }
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ success: false, error: { message: "请先登录。" } }),
    });
  });
  await page.route("**/api/auth/login", async (route) => {
    已登录 = true;
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
    await expect(page).toHaveURL(/\/admin$/);
  }
  await expect.poll(() => 读取页面本地会话(page, "admin_auth_token")).toBe("v2.YWRtaW4.test-token");
});

test("统一登录后进入现有渠道页面并写入页面会话", async ({ page }, testInfo) => {
  let 已登录 = false;
  await page.route("**/api/auth/me", async (route) => {
    if (已登录) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(渠道测试用户),
      });
      return;
    }
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ success: false, error: { message: "请先登录。" } }),
    });
  });
  await page.route("**/api/auth/login", async (route) => {
    已登录 = true;
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
    await expect(page).toHaveURL(/\/partner$/);
  }
  await expect
    .poll(() => 读取页面本地会话(page, "partner_auth_token"))
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

test("桌面工作台展示一级导航、我的待办、业务趋势和消息入口", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/dashboard");

  await expect(page.getByRole("link", { name: "审核中心", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "我的待办" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "业务趋势" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "产品线" })).toBeVisible();

  await expect(page.getByRole("link", { name: "业务全景" })).toBeVisible();
  await expect(page.getByRole("link", { name: "工作台" })).toBeVisible();
  await expect(page.getByRole("link", { name: "线索管理" })).toBeVisible();
  await page.locator(".v2-顶部图标").click();
  await expect(page).toHaveURL(/\/admin\/notifications$/);
  await expect(page.getByRole("heading", { name: "消息列表" })).toBeVisible();
});

test("工作台我的待办遇到超长客户名称不会撑破左侧面板", async ({ page }) => {
  await 模拟已登录(page);
  const 超长名称 =
    "华东区超长客户名称用于验证待办卡片不会破坏页面布局并保持状态标签完整可见".repeat(4);
  await page.route("**/api/stage9/registrations?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          数据: [
            {
              ...测试列表.data.数据[0],
              id: "REG-LONG-TITLE",
              编号: "REG-LONG-TITLE",
              标题: 超长名称,
              客户名称: 超长名称,
            },
          ],
          分页: { 页码: 1, 每页: 100, 总数: 1 },
        },
        meta: 测试用户.meta,
      }),
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/dashboard");

  const 卡片 = page.locator(".record-card").first();
  await expect(卡片).toBeVisible();
  const 尺寸 = await 卡片.evaluate((元素) => {
    const 卡片元素 = 元素 as HTMLElement;
    const 面板 = 卡片元素.closest(".panel-body") as HTMLElement;
    const 标题 = 卡片元素.querySelector(".record-top strong") as HTMLElement;
    const 状态 = 卡片元素.querySelector(".record-top .status") as HTMLElement;
    const 卡片区域 = 卡片元素.getBoundingClientRect();
    const 面板区域 = 面板.getBoundingClientRect();
    const 状态区域 = 状态.getBoundingClientRect();
    return {
      卡片右边界: 卡片区域.right,
      面板右边界: 面板区域.right,
      标题已溢出: 标题.scrollWidth > 标题.clientWidth,
      标题省略方式: getComputedStyle(标题).textOverflow,
      状态完整可见: 状态区域.left >= 卡片区域.left - 0.5 && 状态区域.right <= 卡片区域.right + 0.5,
      卡片内容宽度: 卡片元素.scrollWidth,
      卡片可视宽度: 卡片元素.clientWidth,
    };
  });

  expect(尺寸.卡片右边界).toBeLessThanOrEqual(尺寸.面板右边界 + 0.5);
  expect(尺寸.标题已溢出).toBe(true);
  expect(尺寸.标题省略方式).toBe("ellipsis");
  expect(尺寸.状态完整可见).toBe(true);
  expect(尺寸.卡片内容宽度).toBeLessThanOrEqual(尺寸.卡片可视宽度 + 1);
});

test("客户列表报备商机填写数字端点数量后可以正常提交", async ({ page }) => {
  await 模拟已登录(page);
  const 已通过客户 = {
    ...测试列表.data.数据[0],
    id: "REG-APPROVED-001",
    编号: "REG-APPROVED-001",
    标题: "北京测试客户",
    客户名称: "北京测试客户",
    状态: "approved",
    状态名称: "已通过",
  };
  await page.route("**/api/stage9/registrations?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { 数据: [已通过客户], 分页: { 页码: 1, 每页: 100, 总数: 1 } },
        meta: 测试用户.meta,
      }),
    });
  });
  let 提交内容: Record<string, unknown> | null = null;
  await page.route("**/api/opportunities", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    提交内容 = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          ...已通过客户,
          id: "OPP-CREATED-001",
          编号: "OPP-CREATED-001",
          类型: "商机",
          标题: "报备商机提交验证",
          状态: "active",
          状态名称: "进行中",
          原始数据: { stage: "registered", endpoints: 500 },
        },
        meta: 测试用户.meta,
      }),
    });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/registration");
  await page.getByRole("button", { name: /报备商机/ }).click();
  await expect(page.getByRole("heading", { name: "报备商机" })).toBeVisible();
  await page.getByLabel("商机名称 *").fill("报备商机提交验证");
  await page.getByLabel("端点数量").fill("500");
  await page.getByLabel("预计金额（元）*").fill("100000");
  await page.getByRole("button", { name: "确认报备商机" }).click();

  await expect.poll(() => 提交内容).not.toBeNull();
  expect(提交内容).toMatchObject({
    registrationId: "REG-APPROVED-001",
    name: "报备商机提交验证",
    amount: 100000,
    endpoints: 500,
  });
  await expect(page.getByRole("heading", { name: "报备商机" })).toHaveCount(0);
});

test("产品目录展示管理员子目录并支持大类、模块、功能三层下钻", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/partner/products");

  const 子目录 = page.getByRole("navigation", { name: "产品维护子目录" });
  await expect(子目录).toContainText("产品目录");
  await expect(子目录).toContainText("模块管理");
  await expect(子目录).toContainText("工作量配置");
  await expect(page.locator(".目录网格 .目录卡").first()).toBeVisible();

  const 大类卡 = page.locator(".目录网格 .目录卡").first();
  const 大类名称 = await 大类卡.locator(".目录卡名称").innerText();
  await 大类卡.click();
  await expect(page.locator(".目录面包屑")).toContainText(大类名称);

  const 模块卡 = page.locator(".目录网格 .目录卡").first();
  await expect(模块卡).toBeVisible();
  const 模块名称 = await 模块卡.locator(".目录卡名称").innerText();
  await 模块卡.click();
  await expect(page.locator(".目录面包屑")).toContainText(模块名称);
  await expect(page.locator(".目录网格 .目录卡").first()).toBeVisible();
});

test("商机管理展示列表、四页签详情和业务状态", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/partner/opportunity");

  await expect(page.locator(".opportunity-list-item").first()).toContainText(
    "北京启明终端安全改造项目",
  );
  await page.locator(".opportunity-list-item").first().click();
  await expect(page.locator(".section-tabs")).toContainText("跟进");
  await expect(page.locator(".section-tabs")).toContainText("报价");
  await expect(page.locator(".section-tabs")).toContainText("订单");
  await expect(page.locator(".section-tabs")).toContainText("档案与审计");
  await expect(page.locator(".right-card", { hasText: "业务状态" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "商机跟进" })).toBeVisible();
  await expect(page.getByText("本次沟通内容 *", { exact: true })).toBeVisible();
  await expect(
    page.getByText("需求挖掘填写越精准，越能提供更具体、细致、针对性的客户方案。"),
  ).toBeVisible();
});

test("渠道新建客户展示五步流程和实时查重", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/partner/registration/new");

  await expect(page.getByRole("heading", { name: "新建客户与报备" })).toBeVisible();
  const 步骤条 = page.locator(".wizard-steps");
  await expect(步骤条).toContainText("客户主体信息");
  await expect(步骤条).toContainText("联系人与需求");
  await expect(步骤条).toContainText("归属与保护");
  await expect(步骤条).toContainText("资料附件");
  await page.getByPlaceholder("请输入工商全称").fill("北京启明科技有限公司");
  await expect(page.getByText("未发现重复客户")).toBeVisible();
});

test("管理端新建客户保持五步流程不回落列表", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/registration/new");

  await expect(page.getByRole("heading", { name: "新建客户与报备" })).toBeVisible();
  const 步骤条 = page.locator(".wizard-steps");
  await expect(步骤条).toContainText("客户主体信息");
  await expect(步骤条).toContainText("确认提交");
  await expect(page.getByPlaceholder("请输入工商全称")).toBeVisible();
  await expect(page.getByRole("button", { name: "提交审核" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "报备编号" })).toHaveCount(0);
});

test("管理端审核中心展示待审批与已审批分区", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/admin-review");

  await expect(page.getByRole("heading", { name: "审批任务" })).toBeVisible();
  const 分区 = page.getByRole("tablist", { name: "审批分区" });
  await expect(分区.getByRole("tab", { name: /待审批/ })).toHaveAttribute("aria-selected", "true");
  await expect(分区.getByRole("tab", { name: /已审批/ })).toBeVisible();
  for (const 分类 of ["全部", "客户报备", "渠道与账号", "报价", "订单"]) {
    await expect(
      page.getByRole("button", { name: new RegExp(`^${分类}(?: \\d+)?$`) }),
    ).toBeVisible();
  }
  for (const 表头 of ["审批类型", "业务对象", "渠道 / 客户", "申请人", "时效", "状态", "操作"]) {
    await expect(page.getByRole("columnheader", { name: 表头 })).toBeVisible();
  }
});

test("管理端OpenAPI展示客户端列表和调用日志", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/openapi-integration");

  await expect(page.getByRole("heading", { name: "客户端列表" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "调用日志" })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "AI-agent-superadmin-prod", exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "标题" })).toHaveCount(0);
});

test("管理端工作量配置支持产品映射维护并展示工作量规则", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/workload-config");

  await expect(page.getByRole("heading", { name: "工作量配置" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "产品工作量映射" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "工作量规则" })).toBeVisible();
  await expect(page.getByRole("row", { name: /终端安全管理/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: "LEP-EPP-BASE" })).toBeVisible();
  await page
    .getByRole("row", { name: /终端安全管理/ })
    .getByRole("button", { name: "配置" })
    .click();
  await expect(page.getByRole("button", { name: "保存", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "标题" })).toHaveCount(0);
});

test("管理端侧栏直接展示消息中心和人天与工作量配置", async ({ page }) => {
  await 模拟已登录(page);
  await page.addInitScript((user) => {
    const token = user.data.pageSession.token;
    localStorage.setItem("admin_auth_token", token);
    localStorage.setItem("admin_user_info", JSON.stringify(user.data.pageSession.user));
    localStorage.setItem(
      "admin_api_user",
      JSON.stringify({ user: user.data.pageSession.user, token }),
    );
  }, 测试用户);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin.html#/dashboard");

  const 侧栏 = page.locator(".sidebar-nav");
  const 消息入口 = 侧栏.locator(".nav-item", { hasText: "消息中心" });
  const 工作量入口 = 侧栏.locator(".nav-item", { hasText: "人天与工作量配置" });

  await expect(消息入口).toBeVisible();
  await expect(工作量入口).toBeVisible();

  await 消息入口.click();
  await expect(page).toHaveURL(/\/admin\.html#\/notifications$/);
  await expect(page.getByRole("heading", { name: "消息中心" })).toBeVisible();

  await 工作量入口.click();
  await expect(page).toHaveURL(/\/admin\.html#\/workload-config$/);
  await expect(page.getByText("标准工作量配置")).toBeVisible();
});

test("管理端新建商机展示业务类型和维保关联字段", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/opportunity/new");

  await expect(page.getByRole("heading", { name: "新建商机" })).toBeVisible();
  await expect(page.getByText("关联报备客户").first()).toBeVisible();
  await expect(page.getByText("商机名称", { exact: true })).toBeVisible();
  await expect(page.getByText("当前阶段", { exact: true })).toBeVisible();
  await expect(page.getByText("业务类型", { exact: true })).toBeVisible();
  await expect(page.getByText(/预计金额（元）/).first()).toBeVisible();
  await expect(page.getByText("端点数量")).toBeVisible();
  await expect(page.getByText("预计签约时间", { exact: true })).toBeVisible();
  await expect(page.getByText("首次跟进记录", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "创建商机" })).toBeVisible();
});

test("管理端新建报价将报价方式置于功能模块上方", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/quote/new");

  await expect(page.getByRole("heading", { name: "报价方式" })).toBeVisible();
  await expect(page.locator(".报价方式顶部面板")).toContainText("套餐报价");
  await expect(page.locator(".报价方式顶部面板")).toContainText("补充功能");
  await expect(page.locator(".报价方式顶部面板")).toContainText("自定义报价");
  await expect(page.getByRole("heading", { name: "报价对象" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "软件模块" })).toBeVisible();
  await expect(page.getByText("报价总额").last()).toBeVisible();
  await expect(page.getByRole("button", { name: "生成报价单" })).toBeVisible();
});

test("渠道新建报价支持切换报价方式并展示模块方格", async ({ page }) => {
  await 模拟已登录(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/partner/quote/new");

  await expect(page.locator(".报价方式顶部面板")).toContainText("报价方式");
  await expect(page.locator(".报价方式顶部面板")).toContainText("套餐报价");
  await page.getByRole("button", { name: /自定义报价/ }).click();
  await expect(page.locator(".quote-mode.active")).toContainText("自定义报价");
  await expect(page.locator(".quote-category-card").first()).toBeVisible();
  await expect(page.locator(".quote-catalog-detail").first()).toBeVisible();
  await expect(page.getByText("报价总额").last()).toBeVisible();
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
