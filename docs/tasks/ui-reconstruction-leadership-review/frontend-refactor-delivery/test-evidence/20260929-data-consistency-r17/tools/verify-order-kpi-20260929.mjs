import { createRequire } from "node:module";
const require = createRequire("/Users/liu/.aicodex/worktrees/6e0a/lianruan-crm-deploy-v3/package.json");
const { chromium } = require("playwright");
const base = process.env.TARGET_BASE || "http://10.9.86.66";
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
await page.goto(`${base}/admin/order`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);
const 结果 = await page.evaluate(() => {
  const k = document.querySelector(".war-kpis");
  if (!k) return { 错误: "未找到 KPI 容器" };
  return [...k.children].map((e) => (e.innerText || "").replace(/\n+/g, " | ").trim());
});
console.log(JSON.stringify(结果, null, 2));
const 接口 = await page.evaluate(async () => {
  const r = await fetch("/api/stage9/orders?page=1&pageSize=100", { credentials: "include" });
  const j = await r.json();
  const d = j?.data;
  const 计数 = {};
  for (const row of (d?.数据 || [])) 计数[row.状态] = (计数[row.状态] || 0) + 1;
  return { 总数: d?.分页?.总数, 本页: (d?.数据 || []).length, 状态分布: 计数 };
});
console.log("接口:", JSON.stringify(接口, null, 2));
await browser.close();
