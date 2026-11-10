import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const 基础地址 = "http://10.9.86.66";
const 输出目录 = resolve(import.meta.dirname, "probe-output-third-r1");
const 截图目录 = resolve(输出目录, "截图");
await mkdir(截图目录, { recursive: true });

const 账号 = {
  超管: { username: "liulonghai", password: "LrCRM@2026!" },
  江苏区管: { username: "liuchengzhou", password: "123456" },
  渠道管理员: { username: "zuomeijun", password: "LrCRM@2026!" },
};

async function 登录(浏览器, 账号信息) {
  const 上下文 = await 浏览器.newContext({ baseURL: 基础地址, viewport: { width: 1600, height: 1000 } });
  const 页面 = await 上下文.newPage();
  const 控制台错误 = [];
  页面.on("console", (消息) => { if (消息.type() === "error") 控制台错误.push(消息.text()); });
  页面.on("pageerror", (错误) => 控制台错误.push(`页面异常：${错误.message}`));
  await 页面.goto("/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await 页面.locator('input[autocomplete="username"]').fill(账号信息.username);
  await 页面.locator('input[autocomplete="current-password"]').fill(账号信息.password);
  await Promise.all([
    页面.waitForURL((地址) => !地址.pathname.startsWith("/login"), { timeout: 30000 }),
    页面.getByRole("button", { name: /登\s*录/ }).click(),
  ]);
  await 页面.waitForTimeout(1200);
  const cookies = await 上下文.cookies(基础地址);
  return { 上下文, 页面, 控制台错误, cookies };
}

async function 请求(页面, 路径) {
  return 页面.evaluate(async (路径) => {
    const 响应 = await fetch(路径, { credentials: "include", cache: "no-store" });
    const 文本 = await 响应.text();
    let 内容 = null;
    try { 内容 = JSON.parse(文本); } catch { 内容 = 文本.slice(0, 1000); }
    return { 状态: 响应.status, 内容 };
  }, 路径);
}

async function 页面快照(页面, 路径, 名称) {
  await 页面.goto(路径, { waitUntil: "domcontentloaded", timeout: 30000 });
  await 页面.waitForTimeout(1500);
  await 页面.screenshot({ path: resolve(截图目录, `${名称}.png`), fullPage: true });
  return 页面.evaluate(() => {
    const 可见 = (元素) => {
      const 框 = 元素.getBoundingClientRect();
      const 样式 = getComputedStyle(元素);
      return 框.width > 0 && 框.height > 0 && 样式.display !== "none" && 样式.visibility !== "hidden";
    };
    const 文案 = (元素) => (元素.textContent || "").replace(/\s+/g, " ").trim();
    return {
      地址: location.pathname + location.search,
      标题: document.title,
      h1: [...document.querySelectorAll("h1")].filter(可见).map(文案),
      h2: [...document.querySelectorAll("h2")].filter(可见).map(文案),
      菜单: [...document.querySelectorAll('[aria-label="管理端一级导航"] a, [aria-label="渠道端一级导航"] a')].filter(可见).map(文案),
      按钮: [...document.querySelectorAll("button")].filter(可见).map(文案).filter(Boolean),
      链接: [...document.querySelectorAll("a")].filter(可见).map((项) => ({ 文案: 文案(项), 地址: 项.getAttribute("href") || "" })).filter((项) => 项.文案),
      表头: [...document.querySelectorAll("th")].filter(可见).map(文案),
      正文: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 20000),
      横向溢出: document.documentElement.scrollWidth - innerWidth,
    };
  });
}

const 结果 = { 执行时间: new Date().toISOString(), 基础地址, 角色: {}, 页面: {}, 接口: {} };
const 浏览器 = await chromium.launch({ headless: true });
try {
  const 超管 = await 登录(浏览器, 账号.超管);
  结果.角色.超管 = { 地址: new URL(超管.页面.url()).pathname, 菜单: await 超管.页面.locator('[aria-label="管理端一级导航"] a').allTextContents(), cookies: 超管.cookies, 控制台错误: 超管.控制台错误 };
  结果.接口.超管 = {};
  for (const [名称, 路径] of Object.entries({
    组织树: "/api/org/units/tree",
    组织状态: "/api/org/status",
    区域: "/api/org/regions",
    证书模板: "/api/org/certification-templates",
    成员证书: "/api/org/member-certifications",
    消息偏好: "/api/messages/preferences",
    消息列表: "/api/messages/notifications?limit=100",
    消息渠道: "/api/messages/platform/channels",
    消息投递: "/api/messages/platform/deliveries?limit=100",
    审批: "/api/stage9/approvals?page=1&pageSize=500",
    订单: "/api/stage9/orders?page=1&pageSize=10",
  })) 结果.接口.超管[名称] = await 请求(超管.页面, 路径);

  const 订单数据 = 结果.接口.超管.订单.内容?.data || 结果.接口.超管.订单.内容;
  const 订单行 = Array.isArray(订单数据?.数据) ? 订单数据.数据[0] : Array.isArray(订单数据) ? 订单数据[0] : null;
  const 订单号 = String(订单行?.编号 || 订单行?.原始数据?.orderNo || 订单行?.原始数据?.order_no || "");
  if (订单号) {
    结果.接口.超管.审计按订单号 = await 请求(超管.页面, `/api/stage9/audit?keyword=${encodeURIComponent(订单号)}&page=1&pageSize=50`);
    结果.接口.超管.审计订单号 = 订单号;
  }

  for (const [名称, 路径] of Object.entries({
    超管工作台: "/admin/dashboard",
    组织与岗位: "/admin/organization/units",
    人员与任职: "/admin/organization/staff",
    证书与风险: "/admin/certifications",
    消息中心: "/admin/notifications",
    消息渠道配置: "/admin/notifications/platform",
    提醒规则: "/admin/notifications/rules",
    操作审计: "/admin/audit-logs",
    客户管理: "/admin/registration",
  })) 结果.页面[名称] = await 页面快照(超管.页面, 路径, `超管-${名称}`);

  const 区管 = await 登录(浏览器, 账号.江苏区管);
  结果.角色.区管 = { 地址: new URL(区管.页面.url()).pathname, 菜单: await 区管.页面.locator('[aria-label="管理端一级导航"] a').allTextContents(), 控制台错误: 区管.控制台错误 };
  结果.接口.区管 = {};
  for (const [名称, 路径] of Object.entries({
    审批: "/api/stage9/approvals?page=1&pageSize=500",
    订单: "/api/stage9/orders?page=1&pageSize=500",
    客户: "/api/stage9/registrations?page=1&pageSize=500",
    商机: "/api/stage9/opportunities?page=1&pageSize=500",
    报价: "/api/stage9/quotes?page=1&pageSize=500",
  })) 结果.接口.区管[名称] = await 请求(区管.页面, 路径);
  for (const [名称, 路径] of Object.entries({ 区管工作台: "/admin/dashboard", 区管审核中心: "/admin/admin-review" })) 结果.页面[名称] = await 页面快照(区管.页面, 路径, `区管-${名称}`);

  const 渠道 = await 登录(浏览器, 账号.渠道管理员);
  结果.角色.渠道管理员 = { 地址: new URL(渠道.页面.url()).pathname, 菜单: await 渠道.页面.locator('[aria-label="渠道端一级导航"] a').allTextContents(), 控制台错误: 渠道.控制台错误 };
  结果.接口.渠道管理员 = {};
  for (const [名称, 路径] of Object.entries({
    客户: "/api/stage9/registrations?page=1&pageSize=500",
    商机: "/api/stage9/opportunities?page=1&pageSize=500",
    报价: "/api/stage9/quotes?page=1&pageSize=500",
    订单: "/api/stage9/orders?page=1&pageSize=500",
    消息偏好: "/api/messages/preferences",
    消息列表: "/api/messages/notifications?limit=100",
  })) 结果.接口.渠道管理员[名称] = await 请求(渠道.页面, 路径);
  for (const [名称, 路径] of Object.entries({ 渠道工作台: "/partner/dashboard", 渠道成员维护: "/partner/members", 渠道关系: "/partner/partners", 消息中心: "/admin/notifications" })) 结果.页面[名称] = await 页面快照(渠道.页面, 路径, `渠道-${名称}`);

  await 超管.上下文.close(); await 区管.上下文.close(); await 渠道.上下文.close();
} finally {
  await 浏览器.close();
}
await writeFile(resolve(输出目录, "probe.json"), JSON.stringify(结果, null, 2));
console.log(resolve(输出目录, "probe.json"));
