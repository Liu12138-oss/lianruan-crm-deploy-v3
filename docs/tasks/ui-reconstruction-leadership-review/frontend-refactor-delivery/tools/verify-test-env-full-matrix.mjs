import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.V3_TEST_BASE_URL || "http://10.9.86.66";
const beforeUrl = process.env.V3_TEST_BEFORE_URL || "";
const widths = (process.env.V3_TEST_WIDTHS || "1280,1366,1440,1600,1920")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);
const accounts = {
  superadmin: {
    username: process.env.V3_TEST_SUPERADMIN_USERNAME || "",
    password: process.env.V3_TEST_SUPERADMIN_PASSWORD || "",
  },
  region: {
    username: process.env.V3_TEST_REGION_USERNAME || "",
    password: process.env.V3_TEST_REGION_PASSWORD || "",
  },
  channel: {
    username: process.env.V3_TEST_CHANNEL_USERNAME || "",
    password: process.env.V3_TEST_CHANNEL_PASSWORD || "",
  },
};
const 启用角色 = (process.env.V3_TEST_ROLES || "superadmin,region,channel")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputRoot =
  process.env.V3_TEST_EVIDENCE_DIR ||
  path.join(scriptDir, "../test-evidence/20260923-refactor-verification-r11");
const screenshotRoot = path.join(outputRoot, "screenshots");
const beforeScreenshotRoot = path.join(outputRoot, "before-screenshots");
await fs.mkdir(screenshotRoot, { recursive: true });
if (beforeUrl) await fs.mkdir(beforeScreenshotRoot, { recursive: true });

const 超管路由 = {
  "/admin/dashboard": ["工作台"],
  "/admin/registration": ["客户报备"],
  "/admin/registration/new": ["新建客户报备"],
  "/admin/opportunity": ["商机"],
  "/admin/opportunity/new": ["新建商机"],
  "/admin/quote": ["报价"],
  "/admin/quote/new": ["新建报价单"],
  "/admin/order": ["订单"],
  "/admin/products": ["产品目录"],
  "/admin/products/pricing": ["基础阶梯价", "区域价格覆盖", "渠道价格比例"],
  "/admin/partners": ["渠道商"],
  "/admin/partner-report": ["渠道报表"],
  "/admin/admin-review": ["审核中心"],
  "/admin/notifications": ["消息中心"],
  "/admin/notifications/platform": ["消息渠道配置"],
  "/admin/notifications/rules": ["提醒规则与模板"],
  "/admin/certifications": ["证书与风险"],
  "/admin/leads": ["线索管理"],
  "/admin/leads/sources": ["数据来源"],
  "/admin/platform-admin": ["管理配置"],
  "/admin/workload-config": ["工作量配置"],
  "/admin/account-manage": ["账号管理"],
  "/admin/audit-logs": ["审计日志"],
  "/admin/openapi-integration": ["开放接口"],
  "/admin/organization": ["组织"],
};

const 区管路由 = {
  "/admin/dashboard": ["工作台"],
  "/admin/registration": ["客户报备"],
  "/admin/opportunity": ["商机"],
  "/admin/quote": ["报价"],
  "/admin/order": ["订单"],
  "/admin/products": ["产品目录"],
  "/admin/products/pricing": ["基础阶梯价"],
  "/admin/partners": ["渠道商"],
  "/admin/admin-review": ["审核中心"],
  "/admin/notifications": ["消息中心"],
  "/admin/leads": ["线索管理"],
  "/admin/registration/:id/followup": ["编辑客户档案", "记录客户跟进"],
  "/admin/partners/:id/profile": ["渠道核心档案"],
  "/admin/partners/:id/members": ["渠道成员维护"],
  "/admin/order/:id/actions": ["订单处理"],
};

const 渠道路由 = {
  "/partner/dashboard": ["仪表盘"],
  "/partner/registration": ["客户报备"],
  "/partner/registration/new": ["新建客户报备"],
  "/partner/opportunity": ["商机"],
  "/partner/opportunity/new": ["新建商机"],
  "/partner/quote": ["报价"],
  "/partner/order": ["订单"],
  "/partner/products": ["产品目录"],
  "/partner/registration/:id/followup": ["编辑客户档案", "记录客户跟进"],
  "/partner/order/:id/actions": ["订单处理"],
};

const 越权检查 = [
  { role: "region", route: "/admin/certifications" },
  { role: "region", route: "/admin/notifications/platform" },
  { role: "region", route: "/admin/notifications/rules" },
  { role: "region", route: "/admin/account-manage" },
  { role: "region", route: "/admin/platform-admin" },
  { role: "region", route: "/admin/openapi-integration" },
  { role: "channel", route: "/admin/registration" },
  { role: "channel", route: "/admin/opportunity" },
  { role: "channel", route: "/admin/order" },
  { role: "channel", route: "/admin/leads" },
];

async function maskSensitiveText(page) {
  await page.evaluate(() => {
    const mask = (value) =>
      value
        .replace(/1[3-9]\d{9}/g, (phone) => `${phone.slice(0, 3)}****${phone.slice(-4)}`)
        .replace(
          /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
          "$1***@$2",
        )
        .replace(/\d{6,}(?=[^0-9]|$)/g, (value) => `${value.slice(0, 3)}***${value.slice(-2)}`);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeValue) node.nodeValue = mask(node.nodeValue);
      node = walker.nextNode();
    }
  });
}

async function login(page, account, url) {
  const response = await page.evaluate(
    async ({ input, target }) => {
      const result = await fetch(`${target}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return { status: result.status, body: await result.json() };
    },
    { input: account, target: url },
  );
  if (!response.status.toString().startsWith("2")) {
    throw new Error(`${account.username} 登录失败：${response.status}`);
  }
  return response.body?.data?.user;
}

async function fetchList(page, module, url) {
  return page.evaluate(
    async ({ moduleName, target }) => {
      const response = await fetch(`${target}/api/stage9/${moduleName}?page=1&pageSize=100`, {
        credentials: "include",
      });
      const result = await response.json();
      return result?.data?.数据 || [];
    },
    { moduleName: module, target: url },
  );
}

async function exercisePage(page, route) {
  await page
    .locator("h1")
    .first()
    .waitFor({ timeout: 6000 })
    .catch(() => undefined);
  await page.waitForTimeout(700);
  const pathName = new URL(page.url()).pathname;
  const 点击并关闭 = async (打开按钮名, 弹窗选择器, 关闭按钮名) => {
    const button = page.getByRole("button", { name: 打开按钮名 });
    if (!(await button.count())) return false;
    await button.first().click();
    await page.locator(弹窗选择器).first().waitFor({ timeout: 4000 });
    const 关闭 = page.locator(弹窗选择器).first().getByRole("button", { name: 关闭按钮名 });
    if (await 关闭.count()) await 关闭.first().click();
    else await page.keyboard.press("Escape");
    return true;
  };
  const 记录 = {};
  if (pathName.endsWith("/followup")) {
    记录.客户档案编辑 = await 点击并关闭(/编辑客户档案/, ".客户档案弹窗, .编辑面板, form", /取消/);
    const 跟进 = page.getByRole("button", { name: /记录客户跟进|保存跟进/ });
    记录.客户跟进入口 = (await 跟进.count()) > 0;
  }
  if (pathName.endsWith("/members")) {
    记录.渠道成员新增 = await 点击并关闭(/新增成员/, ".成员弹窗", /关闭|取消/);
  }
  if (pathName.endsWith("/actions")) {
    const 动作按钮 = page.getByRole("button", { name: /执行|处理/ });
    记录.订单动作按钮数 = await 动作按钮.count();
    if (记录.订单动作按钮数)
      记录.订单动作弹窗 = await 点击并关闭(/执行|处理/, ".动作弹窗", /取消|关闭/);
  }
  if (pathName === "/admin/products/pricing") {
    for (const 标签 of ["区域覆盖", "渠道价格比例", "基础阶梯价"]) {
      const button = page.getByRole("button", { name: 标签 });
      if (await button.count()) {
        await button.first().click();
        await page.waitForTimeout(220);
        记录[`价格标签-${标签}`] = true;
      }
    }
  }
  if (pathName === "/admin/certifications") {
    记录.证书模板弹窗 = await 点击并关闭(/新建模板/, ".证书弹窗", /关闭|取消/);
  }
  if (pathName === "/admin/quote" || pathName === "/partner/quote") {
    记录.报价动作 = {
      发送: await page.getByRole("button", { name: /发送/ }).count(),
      转订单: await page.getByRole("button", { name: /转订单/ }).count(),
    };
  }
  if (pathName === "/admin/opportunity" || pathName === "/partner/opportunity") {
    记录.商机阶段文案 = await page.evaluate(() => {
      const text = document.body.innerText || "";
      return {
        七阶段命中: ["客户建联", "需求挖掘", "客户方案", "POC试用", "立项推进", "招投标", "成单"].filter(
          (stage) => text.includes(stage),
        ).length,
        旧十阶段残留: ["初步接洽", "方案确认", "商务谈判", "合同签订"].filter((stage) =>
          text.includes(stage),
        ).length,
      };
    });
  }
  return 记录;
}

async function capture(page, directory, file, expectedTexts) {
  await page
    .locator("h1")
    .first()
    .waitFor({ timeout: 6000 })
    .catch(() => undefined);
  await page.waitForTimeout(800);
  await page
    .waitForFunction(() => !(document.body.innerText || "").includes("数据加载中"), {
      timeout: 5000,
    })
    .catch(() => undefined);
  await maskSensitiveText(page);
  if (directory) await page.screenshot({ path: path.join(directory, file), fullPage: true });
  return page.evaluate(
    ({ expected }) => {
      const text = (document.body.innerText || "").replace(/\s+/g, " ");
      return {
        path: location.pathname,
        text: text.slice(0, 1600),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        missingTexts: expected.filter((item) => !text.includes(item)),
        forbidden: text.includes("403 无权限") || text.includes("无权限访问"),
      };
    },
    { expected: expectedTexts },
  );
}

async function buildRouteList(page, role, url) {
  if (role === "superadmin") return Object.entries(超管路由).map(([route, expected]) => ({ route, expected }));
  const 定义 = role === "region" ? 区管路由 : 渠道路由;
  const [registrations, orders, partners] = await Promise.all([
    fetchList(page, "registrations", url),
    fetchList(page, "orders", url),
    fetchList(page, "partners", url),
  ]);
  const routes = [];
  for (const [base, expected] of Object.entries(定义)) {
    if (base.endsWith(":id/followup")) {
      const id = registrations[0]?.id;
      if (id) routes.push({ route: base.replace(":id", id), expected });
      continue;
    }
    if (base.endsWith(":id/profile")) {
      const id = partners[0]?.id;
      if (id) routes.push({ route: base.replace(":id", id), expected });
      continue;
    }
    if (base.endsWith(":id/members")) {
      const id = partners[0]?.id;
      if (id) routes.push({ route: base.replace(":id", id), expected });
      continue;
    }
    if (base.endsWith(":id/actions")) {
      const id = orders[0]?.id;
      if (id) routes.push({ route: base.replace(":id", id), expected });
      continue;
    }
    routes.push({ route: base, expected });
  }
  return routes;
}

async function 跑角色矩阵(browser, role, account, url, options) {
  const { 截屏宽度, 输出目录, 是否校验 } = options;
  const records = [];
  const errors = [];
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push({ role, width, error: error.message }));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push({ role, width, error: message.text().slice(0, 300) });
    });
    try {
      await page.goto(`${url}/login`, { waitUntil: "domcontentloaded", timeout: 20000 });
      const user = await login(page, account, url);
      const routes = await buildRouteList(page, role, url);
      for (const item of routes) {
        await page.goto(`${url}${item.route}`, { waitUntil: "domcontentloaded", timeout: 20000 });
        const interactions =
          width === 截屏宽度 ? await exercisePage(page, item.route) : undefined;
        const file = `${role}-${width}-${item.route.replaceAll("/", "-").replaceAll(":", "-")}.png`;
        const result = await capture(
          page,
          width === 截屏宽度 ? 输出目录 : undefined,
          file,
          item.expected,
        );
        records.push({ role, width, route: item.route, user, file, interactions, ...result });
      }
    } catch (error) {
      errors.push({ role, width, error: error instanceof Error ? error.message : String(error) });
    } finally {
      await context.close();
    }
  }
  return { records, errors, 是否校验 };
}

const browser = await chromium.launch({ headless: true });
const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  beforeUrl: beforeUrl || null,
  widths,
  records: [],
  errors: [],
  permissionChecks: [],
  apiChecks: [],
};

for (const [role, account] of Object.entries(accounts)) {
  if (!启用角色.includes(role)) continue;
  if (!account.username || !account.password) {
    summary.errors.push({ role, error: "缺少测试账号或密码，已跳过" });
    continue;
  }
  const 结果 = await 跑角色矩阵(browser, role, account, baseUrl, {
    截屏宽度: 1440,
    输出目录: screenshotRoot,
    是否校验: true,
  });
  summary.records.push(...结果.records);
  summary.errors.push(...结果.errors);
}

for (const 检查 of 越权检查) {
  if (!启用角色.includes(检查.role)) continue;
  const account = accounts[检查.role];
  if (!account.password) continue;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await login(page, account, baseUrl);
    await page.goto(`${baseUrl}${检查.route}`, { waitUntil: "domcontentloaded" });
    const 结果 = await capture(page, undefined, "", []);
    summary.permissionChecks.push({
      ...检查,
      landedPath: 结果.path,
      blocked: 结果.path === "/403" || 结果.forbidden,
    });
  } catch (error) {
    summary.permissionChecks.push({
      ...检查,
      blocked: null,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await context.close();
  }
}

{
  const account = accounts.superadmin;
  if (account.password) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await login(page, account, baseUrl);
    const 接口列表 = [
      "/api/messages/platform/channels",
      "/api/messages/platform/rules",
      "/api/messages/platform/channels/readiness",
      "/api/notifications",
      "/api/stage9/registrations?page=1&pageSize=1",
      "/api/stage9/orders?page=1&pageSize=1",
      "/api/stage9/partners?page=1&pageSize=1",
      "/api/org/certification-templates",
      "/api/org/member-certifications",
      "/api/org/units/tree",
      "/api/approvals",
    ];
    for (const 接口 of 接口列表) {
      const 结果 = await page.evaluate(async (target) => {
        const response = await fetch(target, { credentials: "include" });
        return { status: response.status };
      }, 接口);
      summary.apiChecks.push({ path: 接口, status: 结果.status });
    }
    await context.close();
  }
}

if (beforeUrl) {
  for (const [role, account] of Object.entries(accounts)) {
    if (!启用角色.includes(role)) continue;
    if (!account.password) continue;
    const 旧宽度 = [...widths];
    widths.length = 0;
    widths.push(1440);
    const 结果 = await 跑角色矩阵(browser, role, account, beforeUrl, {
      截屏宽度: 1440,
      输出目录: beforeScreenshotRoot,
      是否校验: false,
    });
    summary.records.push(...结果.records.map((record) => ({ ...record, environment: "before" })));
    widths.length = 0;
    widths.push(...旧宽度);
  }
}

summary.failures = summary.records.filter(
  (record) =>
    record.environment !== "before" &&
    (record.scrollWidth > record.clientWidth + 1 ||
      record.missingTexts.length > 0 ||
      record.forbidden),
);
summary.widths = [...widths];
summary.summary = {
  记录数: summary.records.length,
  失败数: summary.failures.length,
  错误数: summary.errors.length,
  越权拦截通过: summary.permissionChecks.filter((item) => item.blocked === true).length,
  越权检查数: summary.permissionChecks.length,
};
await fs.writeFile(
  path.join(outputRoot, "full-matrix-results.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);
console.log(JSON.stringify(summary.summary, null, 2));
console.log(
  JSON.stringify(
    summary.failures.map((item) => ({
      role: item.role,
      width: item.width,
      route: item.route,
      missing: item.missingTexts,
      overflow: item.scrollWidth - item.clientWidth,
    })),
    null,
    2,
  ),
);
await browser.close();
