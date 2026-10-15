import { createRequire } from "node:module";
import fs from "node:fs/promises";
const require = createRequire("/Users/liu/.aicodex/worktrees/6e0a/lianruan-crm-deploy-v3/package.json");
const { chromium } = require("playwright");
const base = "http://10.9.86.66";
const out = process.env.OUT_DIR || "/tmp/verify-roles-20260929";
await fs.mkdir(out, { recursive: true });

const 角色 = [
  { 名称: "超管-liulonghai", 账号: "liulonghai", 密码: "LrCRM@2026!", 前缀: "/admin",
    路由: ["/admin/dashboard","/admin/registration","/admin/leads","/admin/leads/sources","/admin/opportunity","/admin/quote","/admin/order","/admin/partners","/admin/products","/admin/products/pricing","/admin/notifications","/admin/certifications","/admin/admin-review","/admin/platform-admin","/admin/account-manage","/admin/openapi-integration","/admin/audit-logs","/admin/partner-report","/admin/workload-config","/admin/registration/new","/admin/opportunity/new","/admin/quote/new"] },
  { 名称: "区管-chenqinyu", 账号: "chenqinyu", 密码: "123456", 前缀: "/admin",
    路由: ["/admin/dashboard","/admin/registration","/admin/leads","/admin/opportunity","/admin/quote","/admin/order","/admin/partners","/admin/products","/admin/notifications"] },
  { 名称: "渠道-liulongfei", 账号: "liulongfei", 密码: "123456", 前缀: "/partner",
    路由: ["/partner/dashboard","/partner/registration","/partner/opportunity","/partner/quote","/partner/order","/partner/products"] },
];

const browser = await chromium.launch({ headless: true });
const 结论 = [];
for (const 角色项 of 角色) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const 控制台错误 = [];
  page.on("console", (m) => { if (m.type() === "error") 控制台错误.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => 控制台错误.push("pageerror: " + String(e.message).slice(0, 200)));
  const 响应异常 = [];
  page.on("response", (r) => { if (r.status() >= 400 && r.url().includes("/api/")) 响应异常.push(r.status() + " " + r.url().slice(-70)); });

  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const 登录 = await page.evaluate(async (a) => {
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a) });
    const j = await r.json();
    if (j?.data?.pageSession) localStorage.setItem("v3-page-session", JSON.stringify(j.data.pageSession));
    if (j?.data?.user) localStorage.setItem("v3-user", JSON.stringify(j.data.user));
    return r.status;
  }, { username: 角色项.账号, password: 角色项.密码 });
  结论.push({ 角色: 角色项.名称, 登录状态: 登录 });

  for (const 路径 of 角色项.路由) {
    await page.goto(base + 路径, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1100);
    const 信息 = await page.evaluate(() => {
      const art = document.querySelector(".vui.war-artboard, .vui.war-artboard-plain");
      const nav = document.querySelector(".v2-顶部业务导航");
      const r = (el) => el ? Math.round(el.getBoundingClientRect().width) : null;
      return {
        网址: location.pathname,
        画板宽: r(art),
        画板类: art ? String(art.className).replace("vui ", "").split(" ")[0] : null,
        导航高: nav ? Math.round(nav.getBoundingClientRect().height) : null,
        面包屑行: !!document.querySelector(".v2-页内标题栏"),
        KPI数: document.querySelectorAll(".war-kpis .list-kpi").length,
        横向溢出: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        标题: (document.querySelector("h1") || {}).textContent?.trim().slice(0, 30) || "",
      };
    });
    结论.push({ 角色: 角色项.名称, ...信息 });
    if (路径 === 角色项.路由[0] || 路径.endsWith("/registration")) {
      await page.screenshot({ path: `${out}/${角色项.名称}-${信息.画板类 || "page"}.png` });
    }
  }
  结论.push({ 角色: 角色项.名称, 控制台错误: 控制台错误.slice(0, 5), 接口异常: 响应异常.slice(0, 5) });
  await ctx.close();
}
await fs.writeFile(`${out}/结论.json`, JSON.stringify(结论, null, 2));
for (const 行 of 结论) {
  if (行.网址) {
    const 问题 = [];
    if (行.画板宽 && 行.画板宽 !== 1440) 问题.push("画板宽" + 行.画板宽);
    if (行.导航高 && 行.导航高 !== 62) 问题.push("导航高" + 行.导航高);
    if (行.面包屑行) 问题.push("仍有面包屑行");
    if (行.横向溢出) 问题.push("横向溢出" + 行.横向溢出);
    console.log((问题.length ? "❌ " : "✅ ") + 行.角色 + " " + 行.网址 + (问题.length ? " -> " + 问题.join(",") : ""));
  } else if (行.控制台错误 || 行.接口异常) {
    console.log("⚠️  " + 行.角色 + " 控制台=" + JSON.stringify(行.控制台错误) + " 接口=" + JSON.stringify(行.接口异常));
  } else if (行.登录状态) {
    console.log("🔑 " + 行.角色 + " 登录 = " + 行.登录状态);
  }
}
await browser.close();
