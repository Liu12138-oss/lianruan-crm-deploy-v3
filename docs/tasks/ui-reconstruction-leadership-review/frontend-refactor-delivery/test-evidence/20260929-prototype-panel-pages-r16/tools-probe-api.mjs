import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire("/Users/liu/.aicodex/worktrees/6e0a/lianruan-crm-deploy-v3/package.json");
const { chromium } = require("playwright");
const 基址 = process.env.TARGET_BASE || "http://10.9.86.66";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${基址}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const 结果 = await page.evaluate(async () => {
  await fetch("/api/auth/login", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "liulonghai", password: "LrCRM@2026!" }) });
  const 取 = async (u) => { const r = await fetch(u, { credentials: "include" }); const t = await r.text(); try { return JSON.parse(t); } catch { return { 原文: t.slice(0, 200) }; } };
  const 模块 = ["products","approvals","notifications","openapi","audit","users","workload"];
  const o = {};
  for (const m of 模块) {
    const r = await 取(`/api/stage9/${m}?page=1&pageSize=100`);
    const 行 = r?.data?.数据 ?? [];
    const 键集 = new Set();
    行.slice(0, 40).forEach(x => Object.keys(x.原始数据 || {}).forEach(k => 键集.add(k)));
    o[m] = { 总数: r?.data?.分页?.总数 ?? null, 条数: 行.length, 键: [...键集],
      类型分布: 行.reduce((m2, x) => { const k = x.类型 || "?"; m2[k] = (m2[k]||0)+1; return m2; }, {}),
      状态分布: 行.reduce((m2, x) => { const k = x.状态 || "?"; m2[k] = (m2[k]||0)+1; return m2; }, {}),
      首条: 行[0] ? { 编号: 行[0].编号, 标题: 行[0].标题, 状态: 行[0].状态, 状态名称: 行[0].状态名称, 创建时间: 行[0].创建时间, 原始: 行[0].原始数据 } : null };
  }
  o.依赖 = (await 取("/api/health/dependencies"))?.data ?? null;
  o.概览 = (await 取("/api/stage9/overview"))?.data ?? null;
  o.平台通道 = (await 取("/api/messages/platform/channels"))?.data ?? null;
  o.开放日志 = (await 取("/api/open-api/logs?limit=5"))?.data ?? null;
  o.开放客户端 = (await 取("/api/open-api/clients"))?.data ?? null;
  o.工作量映射 = (await 取("/api/workload/mappings"))?.data ?? null;
  o.交付规则 = (await 取("/api/workload/delivery-rules"))?.data ?? null;
  return o;
});
writeFileSync("/tmp/api-shapes-20260929.json", JSON.stringify(结果, null, 1));
for (const [k,v] of Object.entries(结果)) {
  if (v && typeof v === "object" && "总数" in v) console.log(k, "总数="+v.总数, "类型="+JSON.stringify(v.类型分布), "状态="+JSON.stringify(v.状态分布));
  else console.log(k, Array.isArray(v) ? `数组长度=${v.length}` : (v ? "对象:"+Object.keys(v).join(",") : "空"));
}
console.log("--- 依赖 ---", JSON.stringify(结果.依赖)?.slice(0,600));
await browser.close();
