import { createRequire } from "node:module";
const require = createRequire("/Users/liu/.aicodex/worktrees/6e0a/lianruan-crm-deploy-v3/package.json");
const { chromium } = require("playwright");
const base = process.env.TARGET_BASE || "http://10.9.86.66";
const 批次 = "D10PROBE" + Date.now().toString().slice(-6);
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
await page.evaluate(async (账号) => {
  const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(账号) });
  const j = await r.json();
  if (j?.data?.pageSession) localStorage.setItem("v3-page-session", JSON.stringify(j.data.pageSession));
  if (j?.data?.user) localStorage.setItem("v3-user", JSON.stringify(j.data.user));
}, { username: "liulonghai", password: "LrCRM@2026!" });

const 结果 = await page.evaluate(async (p) => {
  const 请求 = async (方法, 路径, 正文) => {
    const r = await fetch(路径, { method: 方法, credentials: "include", headers: { "content-type": "application/json" }, body: 正文 ? JSON.stringify(正文) : undefined });
    const t = await r.text();
    try { return { 状态: r.status, 数据: JSON.parse(t) }; } catch { return { 状态: r.status, 数据: t.slice(0, 200) }; }
  };
  const 渠道商列表 = await 请求("GET", "/api/stage9/partners?page=1&pageSize=1");
  const 渠道商编号 = (渠道商列表.数据?.data?.数据 || [])[0]?.编号;
  const 新增 = await 请求("POST", `/api/v2/partners/${渠道商编号}/staff`, {
    name: `${p}成员`, username: `${p.toLowerCase()}user`, phone: `139${Date.now().toString().slice(-8)}`, role: "销售", status: "active",
  });
  const 成员 = 新增.数据?.data;
  const 停用 = await 请求("PUT", `/api/v2/partners/${渠道商编号}/staff/${成员?.id || 成员?.username}`, { status: "disabled" });
  const 查询 = await 请求("GET", `/api/stage9/users?page=1&pageSize=5&search=${encodeURIComponent(成员?.username || "")}`);
  return { 渠道商编号, 新增状态: 新增.状态, 成员, 停用状态: 停用.状态, 停用返回: 停用.数据?.data, 查询结果: 查询.数据?.data?.数据 };
}, 批次);
console.log(JSON.stringify(结果, null, 2));
await browser.close();
