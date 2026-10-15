import { createRequire } from "node:module";
const require = createRequire("/Users/liu/.aicodex/worktrees/6e0a/lianruan-crm-deploy-v3/package.json");
const { chromium } = require("playwright");
const base = process.env.TARGET_BASE || "http://10.9.86.66";
const 批次 = "D10FIX" + Date.now().toString().slice(-6);
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();
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
    try { return { 状态: r.status, 数据: JSON.parse(t) }; } catch { return { 状态: r.status, 数据: t.slice(0, 160) }; }
  };
  const 渠道商编号 = ((await 请求("GET", "/api/stage9/partners?page=1&pageSize=1")).数据?.data?.数据 || [])[0]?.编号;
  const 新增 = await 请求("POST", `/api/v2/partners/${渠道商编号}/staff`, {
    name: `${p}成员`, username: `${p.toLowerCase()}user`, phone: `137${Date.now().toString().slice(-8)}`, role: "销售", status: "active",
  });
  const 成员 = 新增.数据?.data;
  const 停用 = await 请求("PUT", `/api/v2/partners/${渠道商编号}/staff/${成员?.id || 成员?.username}`, { status: "inactive" });
  const 启用 = await 请求("PUT", `/api/v2/partners/${渠道商编号}/staff/${成员?.id || 成员?.username}`, { status: "active" });
  const 再停用 = await 请求("PUT", `/api/v2/partners/${渠道商编号}/staff/${成员?.id || 成员?.username}`, { status: "disabled" });
  return { 渠道商编号, 成员: { id: 成员?.id, 用户名: 成员?.username }, 新增状态: 新增.状态, 停用inactive状态: 停用.状态, 启用状态: 启用.状态, 再停用disabled状态: 再停用.状态 };
}, 批次);
console.log(JSON.stringify(结果, null, 2));
console.log("批次=" + 批次);
await browser.close();
