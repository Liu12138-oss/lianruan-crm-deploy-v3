import { createRequire } from "node:module";
const require = createRequire("/Users/liu/.aicodex/worktrees/6e0a/lianruan-crm-deploy-v3/package.json");
const { chromium } = require("playwright");
const base = "http://10.9.86.66";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
await page.evaluate(async () => {
  const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "liulonghai", password: "LrCRM@2026!" }) });
  const j = await r.json();
  if (j?.data?.pageSession) localStorage.setItem("v3-page-session", JSON.stringify(j.data.pageSession));
  if (j?.data?.user) localStorage.setItem("v3-user", JSON.stringify(j.data.user));
});
const 结果 = await page.evaluate(async () => {
  const 已见 = new Set();
  let 同页汇总成员 = 0, 去重后成员 = 0, 有成员渠道 = 0;
  const 重复项 = [];
  for (let p = 1; p <= 3; p++) {
    const r = await fetch(`/api/stage9/partners?page=${p}&pageSize=100`, { credentials: "include" });
    const j = await r.json();
    for (const row of (j?.data?.数据 || [])) {
      const staff = Array.isArray(row.原始数据?.staff) ? row.原始数据.staff : [];
      同页汇总成员 += staff.length;
      if (已见.has(row.id)) { 重复项.push(row.编号); continue; }
      已见.add(row.id);
      去重后成员 += staff.length;
      if (staff.length) 有成员渠道 += 1;
    }
  }
  return { 唯一渠道数: 已见.size, 重复渠道: 重复项.length, 重复编号: 重复项,
    含重复的成员汇总: 同页汇总成员, 去重后的成员汇总: 去重后成员, 有成员渠道数: 有成员渠道 };
});
console.log(JSON.stringify(结果, null, 2));
await browser.close();
