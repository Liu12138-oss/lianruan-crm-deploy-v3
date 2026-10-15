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
  const out = [];
  for (const 模块 of ["partners", "registrations", "users", "audit", "opportunities"]) {
    const 各次 = [];
    for (let 轮 = 0; 轮 < 5; 轮++) {
      const ids = new Set();
      for (let p = 1; p <= 12; p++) {
        const r = await fetch(`/api/stage9/${模块}?page=${p}&pageSize=100`, { credentials: "include" });
        const j = await r.json();
        const d = j?.data;
        if (!d) break;
        for (const row of (d.数据 || [])) ids.add(row.id);
        if ((d.数据 || []).length < 100) break;
      }
      const arr = [...ids].sort();
      各次.push({ 唯一数: arr.length, 指纹: arr.join(",").length + ":" + arr.slice(0, 3).join("|") });
      await new Promise((r) => setTimeout(r, 300));
    }
    const 唯一数集合 = [...new Set(各次.map((x) => x.唯一数))];
    const 指纹集合 = [...new Set(各次.map((x) => x.指纹))];
    out.push({ 模块, 每次唯一数: 各次.map((x) => x.唯一数), 结果是否稳定: 指纹集合.length === 1, 出现几种结果: 指纹集合.length });
  }
  return out;
});
console.log(JSON.stringify(结果, null, 2));
await browser.close();
