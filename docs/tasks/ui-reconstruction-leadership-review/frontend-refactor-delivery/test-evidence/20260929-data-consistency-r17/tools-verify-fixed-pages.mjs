import { createRequire } from "node:module";
const require = createRequire("/Users/liu/.aicodex/worktrees/6e0a/lianruan-crm-deploy-v3/package.json");
const { chromium } = require("playwright");
const base = "http://10.9.86.66";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
await page.evaluate(async () => {
  const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "liulonghai", password: "LrCRM@2026!" }) });
  const j = await r.json();
  if (j?.data?.pageSession) localStorage.setItem("v3-page-session", JSON.stringify(j.data.pageSession));
  if (j?.data?.user) localStorage.setItem("v3-user", JSON.stringify(j.data.user));
});
const 页面 = [
  ["账号生命周期", "/admin/account-manage"],
  ["商机作战", "/admin/opportunity"],
  ["审计与系统", "/admin/audit-logs"],
  ["消息中心", "/admin/notifications"],
  ["组织与账号", "/admin/organization"],
  ["提醒规则与模板", "/admin/notifications/rules"],
];
for (const [名称, 路径] of 页面) {
  await page.goto(base + 路径, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  const kpi = await page.evaluate(() => [...document.querySelectorAll(".war-kpis .list-kpi")].map((e) => {
    const 值 = e.querySelector(".metric-value strong")?.textContent.trim();
    const 单位 = e.querySelector(".metric-value small")?.textContent.trim() || "";
    const 脚注 = e.querySelector(".metric-foot")?.textContent.trim() || "";
    return `${e.querySelector(".metric-label span")?.textContent.trim()}=${值}${单位}${脚注 ? "（" + 脚注 + "）" : ""}`;
  }).join(" | "));
  console.log(`${名称}: ${kpi || "（KPI 未渲染）"}`);
}
await browser.close();
