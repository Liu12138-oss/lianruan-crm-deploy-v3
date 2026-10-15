import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.V3_TEST_BASE_URL || "http://10.9.86.66";
const accounts = {
  superadmin: {
    username: process.env.V3_TEST_SUPERADMIN_USERNAME || "liangwanqi",
    password: process.env.V3_TEST_SUPERADMIN_PASSWORD || "",
  },
  region: {
    username: process.env.V3_TEST_REGION_USERNAME || "chenqinyu",
    password: process.env.V3_TEST_REGION_PASSWORD || "",
  },
  channel: {
    username: process.env.V3_TEST_CHANNEL_USERNAME || "liulongfei",
    password: process.env.V3_TEST_CHANNEL_PASSWORD || "",
  },
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir =
  process.env.V3_TEST_EVIDENCE_DIR ||
  path.join(scriptDir, "../test-evidence/20260923-refactor-verification-r9");
const screenshotsDir = path.join(outputDir, "screenshots");
await fs.mkdir(screenshotsDir, { recursive: true });

async function maskSensitiveText(page) {
  await page.evaluate(() => {
    const mask = (value) =>
      value
        .replace(/1[3-9]\d{9}/g, (phone) => `${phone.slice(0, 3)}****${phone.slice(-4)}`)
        .replace(/([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, "$1***@$2")
        .replace(/\d{6,}(?=[^0-9]|$)/g, (value) => `${value.slice(0, 3)}***${value.slice(-2)}`);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeValue) node.nodeValue = mask(node.nodeValue);
      node = walker.nextNode();
    }
  });
}

async function login(page, account) {
  const response = await page.evaluate(async (input) => {
    const result = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return { status: result.status, body: await result.json() };
  }, account);
  if (!response.status.toString().startsWith("2")) {
    throw new Error(`${account.username} 登录失败：${response.status}`);
  }
  return response.body?.data?.user;
}

async function fetchList(page, module) {
  return page.evaluate(async (moduleName) => {
    const response = await fetch(`/api/stage9/${moduleName}?page=1&pageSize=100`, {
      credentials: "include",
    });
    const result = await response.json();
    return result?.data?.数据 || [];
  }, module);
}

async function capture(page, file, expectedTexts) {
  await page.waitForTimeout(900);
  await page
    .waitForFunction(() => !(document.body.innerText || "").includes("数据加载中"), {
      timeout: 5000,
    })
    .catch(() => undefined);
  await maskSensitiveText(page);
  await page.screenshot({ path: path.join(screenshotsDir, file), fullPage: true });
  return page.evaluate(
    ({ expected }) => {
      const text = (document.body.innerText || "").replace(/\s+/g, " ");
      return {
        path: location.pathname,
        text: text.slice(0, 2600),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        missingTexts: expected.filter((item) => !text.includes(item)),
        hasForbidden: text.startsWith("403 无权限") || text.includes("403 无权限"),
      };
    },
    { expected: expectedTexts },
  );
}

async function exercisePage(page, route) {
  const pathName = new URL(page.url()).pathname;
  if (route.endsWith("/followup")) {
    const button = page.getByRole("button", { name: "编辑客户档案" });
    if (await button.count()) {
      await button.first().click();
      await page.getByRole("button", { name: "取消编辑" }).first().waitFor();
      await page.getByRole("button", { name: "取消编辑" }).first().click();
    }
  }
  if (route.endsWith("/members")) {
    const button = page.getByRole("button", { name: /新增成员/ });
    if (await button.count()) {
      await button.first().click();
      await page.locator(".成员弹窗").waitFor();
      await page.locator(".成员弹窗 header button").click();
    }
  }
  if (route.endsWith("/actions")) {
    const button = page.getByRole("button", { name: "执行" });
    if (await button.count()) {
      await button.first().click();
      await page.locator(".动作弹窗").waitFor();
      await page.locator(".动作弹窗 footer").getByRole("button", { name: "取消" }).click();
    }
  }
  if (pathName === "/admin/products/pricing") {
    const button = page.getByRole("button", { name: "区域覆盖" });
    if (await button.count()) await button.first().click();
  }
  if (pathName === "/admin/certifications") {
    const button = page.getByRole("button", { name: "新建模板" });
    if (await button.count()) {
      await button.first().click();
      await page.locator(".证书弹窗").waitFor();
      await page.locator(".证书弹窗 header button").click();
    }
  }
}

function routeExpectations(role) {
  const common = {
    "/admin/dashboard": ["工作台"],
    "/admin/registration": ["客户报备"],
    "/admin/opportunity": ["商机管理"],
    "/admin/quote": ["报价管理"],
    "/admin/order": ["订单管理"],
    "/admin/products": ["产品目录"],
    "/admin/products/pricing": ["基础阶梯价", "区域价格覆盖", "渠道价格比例"],
    "/admin/partners": ["渠道商"],
    "/admin/admin-review": ["审核中心"],
    "/admin/notifications": ["消息中心"],
  };
  if (role === "region") {
    return {
      ...common,
      "/admin/registration/:followup": ["编辑客户档案", "记录客户跟进"],
      "/admin/partners/:profile": ["渠道核心档案", "工商主体", "产品能力与提醒"],
      "/admin/partners/:members": ["渠道成员维护", "新增成员"],
      "/admin/order/:actions": ["订单处理", "当前可执行动作", "订单信息"],
    };
  }
  if (role === "channel") {
    return {
      "/dashboard": ["总览仪表盘"],
      "/registration": ["客户报备"],
      "/opportunity": ["商机管理"],
      "/quote": ["报价管理"],
      "/order": ["订单管理"],
      "/products": ["产品目录"],
      "/registration/:followup": ["编辑客户档案", "记录客户跟进"],
      "/order/:actions": ["订单处理", "当前可执行动作", "订单信息"],
    };
  }
  return {
    ...common,
    "/admin/certifications": ["证书与风险", "证书模板", "持证记录"],
    "/admin/notifications/platform": ["消息渠道配置", "企微自建应用", "SMTP 邮箱"],
    "/admin/notifications/rules": ["提醒规则与模板", "客户报备待审核", "订单待审批"],
  };
}

async function buildRoutes(page, role) {
  if (role === "superadmin") {
    return Object.entries(routeExpectations(role)).map(([route, expected]) => ({
      route,
      expected,
    }));
  }
  const [registrations, orders, partners] = await Promise.all([
    fetchList(page, "registrations"),
    fetchList(page, "orders"),
    fetchList(page, "partners"),
  ]);
  const prefix = role === "region" ? "/admin" : "/partner";
  const routes = [];
  for (const [base, expected] of Object.entries(routeExpectations(role))) {
    if (base.endsWith(":followup")) {
      const id = registrations[0]?.id;
      if (id) routes.push({ route: base.replace(":followup", `${id}/followup`), expected });
      continue;
    }
    if (base.endsWith(":profile")) {
      const id = partners[0]?.id;
      if (id) routes.push({ route: base.replace(":profile", `${id}/profile`), expected });
      continue;
    }
    if (base.endsWith(":members")) {
      const id = partners[0]?.id;
      if (id) routes.push({ route: base.replace(":members", `${id}/members`), expected });
      continue;
    }
    if (base.endsWith(":actions")) {
      const id = orders[0]?.id;
      if (id) routes.push({ route: base.replace(":actions", `${id}/actions`), expected });
      continue;
    }
    routes.push({ route: base, expected });
  }
  return routes.map((item) =>
    item.route.startsWith("/admin") ? item : { ...item, route: `${prefix}${item.route}` },
  );
}

const browser = await chromium.launch({ headless: true });
const records = [];
const errors = [];
const skipped = [];

for (const [role, account] of Object.entries(accounts)) {
  if (!account.password) {
    skipped.push(`${role}: 缺少测试密码`);
    continue;
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push({ role, error: error.message }));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("401")) {
      errors.push({ role, error: message.text() });
    }
  });
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 15000 });
    const user = await login(page, account);
    const routes = await buildRoutes(page, role);
    for (const item of routes) {
      await page.goto(`${baseUrl}${item.route}`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await exercisePage(page, item.route);
      const file = `${role}-${item.route.replaceAll("/", "-").replaceAll(":", "-")}.png`;
      records.push({
        role,
        route: item.route,
        user,
        file,
        ...(await capture(page, file, item.expected)),
      });
    }
  } catch (error) {
    errors.push({ role, error: error instanceof Error ? error.message : String(error) });
  } finally {
    await context.close();
  }
}

for (const role of ["region", "channel"]) {
  const account = accounts[role];
  if (!account.password) continue;
  const context = await browser.newContext({ viewport: { width: 1920, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await login(page, account);
  const route = role === "region" ? "/admin/opportunity" : "/partner/opportunity";
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  const file = `${role}-1920-opportunity.png`;
  records.push({
    role,
    route,
    width: 1920,
    file,
    ...(await capture(page, file, ["商机管理"])),
  });
  await context.close();
}

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  skipped,
  records,
  errors,
  failures: records.filter(
    (record) =>
      record.scrollWidth > record.clientWidth + 1 ||
      record.missingTexts.length > 0 ||
      record.hasForbidden,
  ),
};
await fs.writeFile(
  path.join(outputDir, "post-deploy-results.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);
console.log(JSON.stringify(summary, null, 2));
await browser.close();
