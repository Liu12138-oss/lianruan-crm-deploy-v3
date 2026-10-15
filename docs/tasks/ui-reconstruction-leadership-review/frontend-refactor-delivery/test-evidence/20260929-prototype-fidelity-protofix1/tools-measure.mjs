import { createRequire } from "node:module";
import fs from "node:fs/promises";
const require = createRequire("/Users/liu/.aicodex/worktrees/6e0a/lianruan-crm-deploy-v3/package.json");
const { chromium } = require("playwright");

const W = "/Users/liu/.aicodex/worktrees/6e0a/lianruan-crm-deploy-v3";
const base = process.env.TARGET_BASE || "http://10.9.86.66";
const 账号 = { username: "liulonghai", password: "LrCRM@2026!" };
const out = process.env.OUT_DIR || "/tmp/measure-20260929";
await fs.mkdir(out, { recursive: true });

const 页面 = [
  ["工作台", "dashboard", "/admin/dashboard"],
  ["客户管理", "customers", "/admin/registration"],
  ["商机作战", "opportunities", "/admin/opportunity"],
  ["报价管理", "quotes", "/admin/quote"],
  ["订单中心", "orders", "/admin/order"],
  ["渠道管理", "channels", "/admin/partners"],
  ["产品目录", "products", "/admin/products"],
  ["消息中心", "messages", "/admin/notifications"],
  ["线索管理", "lead-management", "/admin/leads"],
  ["证书管理", "certificate-management", "/admin/certifications"],
  ["审核中心", "approvals", "/admin/admin-review"],
  ["组织与账号", "organization", "/admin/organization"],
  ["OpenAPI", "openapi", "/admin/openapi-integration"],
  ["审计与系统", "audit-system", "/admin/audit-logs"],
  ["账号生命周期", "account-management", "/admin/account-manage"],
  ["渠道经营报表", "partner-report", "/admin/partner-report"],
  ["工作量配置", "workload-config", "/admin/workload-config"],
  ["消息渠道配置", "message-platform", "/admin/notifications/platform"],
  ["提醒规则与模板", "message-rules", "/admin/notifications/rules"],
  ["管理配置", "platform-admin", "/admin/platform-admin"],
  ["组织双域管理", "organization-admin", "/admin/organization"],
  ["产品维护", "product-admin", "/admin/products"],
  ["模块价格规则", "pricing-rules", "/admin/products/pricing"],
  ["新建客户", "customer-new", "/admin/registration/new"],
  ["新建商机", "opportunity-new", "/admin/opportunity/new"],
  ["新建报价", "quote-new", "/admin/quote/new"],
  ["线索来源", "lead-sources", "/admin/leads/sources"],
  ["导入导出", "import-export", "/admin/system/import-export"],
];

const 采集原型 = `(() => {
  const art = document.querySelector(".artboard.war-artboard");
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), 宽: Math.round(b.width), 高: Math.round(b.height) }; };
  const rel = (el) => { if (!el || !art) return null; const b = el.getBoundingClientRect(); const a = art.getBoundingClientRect(); return { 顶: Math.round(b.top - a.top), 左: Math.round(b.left - a.left), 宽: Math.round(b.width), 高: Math.round(b.height) }; };
  const k = document.querySelector(".war-kpis");
  const l = document.querySelector(".war-layout");
  const content = document.querySelector(".demo-content");
  return {
    画板: r(art),
    内容区: rel(content),
    顶部导航: rel(document.querySelector(".top-nav")),
    内容区顶部内边距: content ? getComputedStyle(content).paddingTop : null,
    KPI: rel(k),
    KPI数: k ? k.children.length : 0,
    KPI标签: [...document.querySelectorAll(".war-kpis .metric-label")].map(e=>e.textContent.trim()),
    KPI卡宽: k && k.children[0] ? Math.round(k.children[0].getBoundingClientRect().width) : null,
    三栏: rel(l),
    三栏列宽: l ? [...l.children].map(e=>Math.round(e.getBoundingClientRect().width)) : [],
    右栏卡数: document.querySelectorAll(".war-right .right-card").length,
    右栏卡标题: [...document.querySelectorAll(".war-right .right-card-title strong")].map(e=>e.textContent.trim()),
    记录卡数: document.querySelectorAll(".war-record").length,
    页头: document.querySelectorAll(".page-head").length,
    溢出: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    页面滚动高: document.documentElement.scrollHeight,
  };
})()`;

const 采集实现 = `(() => {
  const art = document.querySelector(".vui.war-artboard, .vui.war-artboard-plain");
  const rel = (el) => { if (!el || !art) return null; const b = el.getBoundingClientRect(); const a = art.getBoundingClientRect(); return { 顶: Math.round(b.top - a.top), 左: Math.round(b.left - a.left), 宽: Math.round(b.width), 高: Math.round(b.height) }; };
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), 宽: Math.round(b.width), 高: Math.round(b.height) }; };
  const k = document.querySelector(".war-kpis");
  const l = document.querySelector(".war-layout");
  const content = art;
  return {
    画板: r(art),
    内容区: rel(content),
    顶部导航: rel(document.querySelector(".v2-顶部业务导航")),
    页内标题栏: rel(document.querySelector(".v2-页内标题栏")),
    页面内容内边距: (() => { const p = document.querySelector(".v2-页面内容"); if(!p) return null; const s = getComputedStyle(p); return s.paddingTop+" "+s.paddingRight+" "+s.paddingBottom+" "+s.paddingLeft; })(),
    画板内边距: art ? getComputedStyle(art).padding : null,
    KPI: rel(k),
    KPI数: k ? k.children.length : 0,
    KPI标签: [...document.querySelectorAll(".war-kpis .metric-label")].map(e=>e.textContent.trim()),
    KPI卡宽: k && k.children[0] ? Math.round(k.children[0].getBoundingClientRect().width) : null,
    三栏: rel(l),
    三栏列宽: l ? [...l.children].map(e=>Math.round(e.getBoundingClientRect().width)) : [],
    右栏卡数: document.querySelectorAll(".war-right .right-card").length,
    右栏卡标题: [...document.querySelectorAll(".war-right .right-card-title strong")].map(e=>e.textContent.trim()),
    记录卡数: document.querySelectorAll(".war-record").length,
    页头: document.querySelectorAll(".page-head").length,
    溢出: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    页面滚动高: document.documentElement.scrollHeight,
  };
})()`;

const browser = await chromium.launch({ headless: true });
const 结果 = { 原型: {}, 实现: {} };

// 原型
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`file://${W}/docs/tasks/ui-reconstruction-leadership-review/ui-demo/index.html`, { waitUntil: "load" });
  await page.waitForTimeout(600);
  for (const [名称, id] of 页面) {
    await page.evaluate((s) => window.demoGo(s), id);
    await page.waitForTimeout(120);
    try { 结果.原型[名称] = await page.evaluate(采集原型); } catch (e) { 结果.原型[名称] = { 错误: String(e.message) }; }
  }
  await ctx.close();
}

// 实现
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(async (a) => {
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a) });
    const j = await r.json();
    if (j?.data?.pageSession) localStorage.setItem("v3-page-session", JSON.stringify(j.data.pageSession));
    if (j?.data?.user) localStorage.setItem("v3-user", JSON.stringify(j.data.user));
  }, 账号);
  for (const [名称, , 路径] of 页面) {
    await page.goto(base + 路径, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".vui", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(700);
    try { 结果.实现[名称] = await page.evaluate(采集实现); } catch (e) { 结果.实现[名称] = { 错误: String(e.message) }; }
    await page.screenshot({ path: `${out}/impl-${名称}.png`, fullPage: false });
  }
  await ctx.close();
}

await fs.writeFile(`${out}/measure.json`, JSON.stringify(结果, null, 2));
await browser.close();
console.log("完成");
