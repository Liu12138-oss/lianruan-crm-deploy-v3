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
  const 模块 = ["partners","registrations","opportunities","quotes","orders","products","users","audit","approvals","notifications","workload","openapi"];
  const out = {};
  for (const m of 模块) {
    const r = await fetch(`/api/stage9/${m}?page=1&pageSize=1`, { credentials: "include" });
    const j = await r.json();
    out[m] = j?.data?.分页?.总数 ?? null;
  }
  const 概览 = await (await fetch("/api/stage9/overview", { credentials: "include" })).json();
  return { 模块总数: out, 概览统计: (概览?.data?.统计 || []).map((x) => `${x.标题}=${x.数量}`) };
});
console.log(JSON.stringify(结果, null, 2));
await browser.close();
