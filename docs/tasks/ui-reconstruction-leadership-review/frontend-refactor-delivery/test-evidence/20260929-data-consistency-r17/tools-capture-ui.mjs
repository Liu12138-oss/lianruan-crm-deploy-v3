// 数据一致性采集：逐页记录 UI 指标值、面板计数，以及页面真实调用的 /api 响应
import { createRequire } from "node:module";
import fs from "node:fs/promises";
const require = createRequire("/Users/liu/.aicodex/worktrees/6e0a/lianruan-crm-deploy-v3/package.json");
const { chromium } = require("playwright");

const base = process.env.TARGET_BASE || "http://10.9.86.66";
const out = process.env.OUT_DIR || "/tmp/dc-20260929";
const 账号 = { username: process.env.U || "liulonghai", password: process.env.P || "LrCRM@2026!" };

const 页面 = [
  ["工作台", "/admin/dashboard"],
  ["客户管理", "/admin/registration"],
  ["商机作战", "/admin/opportunity"],
  ["报价管理", "/admin/quote"],
  ["订单中心", "/admin/order"],
  ["渠道管理", "/admin/partners"],
  ["产品目录", "/admin/products"],
  ["消息中心", "/admin/notifications"],
  ["线索管理", "/admin/leads"],
  ["线索来源", "/admin/leads/sources"],
  ["证书管理", "/admin/certifications"],
  ["审核中心", "/admin/admin-review"],
  ["组织与账号", "/admin/organization"],
  ["OpenAPI", "/admin/openapi-integration"],
  ["审计与系统", "/admin/audit-logs"],
  ["账号生命周期", "/admin/account-manage"],
  ["渠道经营报表", "/admin/partner-report"],
  ["工作量配置", "/admin/workload-config"],
  ["消息渠道配置", "/admin/notifications/platform"],
  ["提醒规则与模板", "/admin/notifications/rules"],
  ["管理配置", "/admin/platform-admin"],
  ["模块价格规则", "/admin/products/pricing"],
  ["导入导出", "/admin/system/import-export"],
];

const 采集UI = `(() => {
  const t = (el) => el ? (el.textContent || "").trim().replace(/\\s+/g, " ") : "";
  const kpis = [...document.querySelectorAll(".war-kpis .list-kpi")].map((e) => ({
    标签: t(e.querySelector(".metric-label span")),
    值: t(e.querySelector(".metric-value strong")),
    单位: t(e.querySelector(".metric-value small")),
    脚注: t(e.querySelector(".metric-foot")),
  }));
  const 计数 = [...document.querySelectorAll(".war-count, .table-count, .list-count")]
    .map((e) => t(e)).filter(Boolean);
  const 面板 = [...document.querySelectorAll(".panel, .right-card, .grid-2 > *")].map((e) => ({
    标题: t(e.querySelector(".panel-head h2, h2, .right-card-title strong, h3")),
    行数: e.querySelectorAll("tbody tr").length,
    占位: t(e.querySelector(".war-empty")).slice(0, 60),
  })).filter((p) => p.标题 || p.行数);
  const 表 = [...document.querySelectorAll("table.data-table, table")].map((e) => ({
    列: [...e.querySelectorAll("thead th")].map((th) => t(th)),
    行数: e.querySelectorAll("tbody tr").length,
  }));
  const 空态 = [...document.querySelectorAll(".war-empty, .empty, .v2-空态")].map((e) => t(e).slice(0, 60));
  return { 标题: t(document.querySelector("h1, .page-head h1, .war-panel-title")), kpis, 计数, 面板, 表, 空态,
    文本: document.body.innerText.replace(/\\s+/g, " ").slice(0, 400) };
})()`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(async (a) => {
  const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a) });
  const j = await r.json();
  if (j?.data?.pageSession) localStorage.setItem("v3-page-session", JSON.stringify(j.data.pageSession));
  if (j?.data?.user) localStorage.setItem("v3-user", JSON.stringify(j.data.user));
}, 账号);

await fs.mkdir(out, { recursive: true });
const 结果 = [];
for (const [名称, 路径] of 页面) {
  const 接口 = [];
  const 错误 = [];
  const onResp = async (res) => {
    const u = res.url();
    if (!u.includes("/api/")) return;
    const 路径 = u.replace(base, "");
    const 条目 = { 接口: 路径.split("?")[0], 查询: 路径.includes("?") ? 路径.split("?")[1] : "", 状态: res.status() };
    if (res.status() >= 400) { 条目.错误 = true; 接口.push(条目); return; }
    try {
      const j = await res.json();
      const d = j?.data;
      if (Array.isArray(d)) 条目.条数 = d.length;
      else if (d && typeof d === "object") {
        if (d.分页) 条目.总数 = d.分页.总数;
        if (Array.isArray(d.数据)) 条目.条数 = d.数据.length;
      }
      if (j?.success === false) 条目.业务失败 = j?.error?.message || "unknown";
    } catch { 条目.非JSON = true; }
    接口.push(条目);
  };
  const onErr = (m) => { if (m.type() === "error" && !m.text().includes("401")) 错误.push(m.text().slice(0, 160)); };
  page.on("response", onResp);
  page.on("console", onErr);
  await page.goto(base + 路径, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1800);
  let ui = null;
  try { ui = await page.evaluate(采集UI); } catch (e) { ui = { 错误: String(e.message) }; }
  page.off("response", onResp);
  page.off("console", onErr);
  // 合并同接口重复调用
  const 合并 = [];
  for (const it of 接口) {
    const 键 = it.接口 + "|" + it.查询;
    const 存在 = 合并.find((x) => x.键 === 键);
    if (存在) 存在.次数 = (存在.次数 || 1) + 1; else 合并.push({ 键, ...it });
  }
  结果.push({ 名称, 路径, ui, 接口: 合并, 控制台错误: 错误 });
  await page.screenshot({ path: `${out}/ui-${名称}.png`, fullPage: false });
}
await fs.writeFile(`${out}/capture.json`, JSON.stringify({ base, 账号: 账号.username, 结果 }, null, 2));
await browser.close();
console.log("采集完成：", out);
