import { createRequire } from "node:module";
const require = createRequire("/Users/liu/.aicodex/worktrees/6e0a/lianruan-crm-deploy-v3/package.json");
const { chromium } = require("playwright");
const base = process.env.TARGET_BASE || "http://10.9.86.66";
const 路由 = ["/admin/products","/admin/notifications","/admin/admin-review","/admin/openapi-integration","/admin/audit-logs","/admin/notifications/platform","/admin/notifications/rules","/admin/certifications"];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const 问题 = [];
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("401")) 问题.push(m.text().slice(0, 140)); });
await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
await page.evaluate(async () => {
  const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "liulonghai", password: "LrCRM@2026!" }) });
  const j = await r.json();
  if (j?.data?.pageSession) localStorage.setItem("v3-page-session", JSON.stringify(j.data.pageSession));
  if (j?.data?.user) localStorage.setItem("v3-user", JSON.stringify(j.data.user));
});
for (const 路径 of 路由) {
  await page.goto(base + 路径, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const art = document.querySelector(".vui.war-artboard, .vui.war-artboard-plain");
    const k = document.querySelector(".war-kpis");
    const 卡位置 = k ? [...k.children].map((e) => Math.round(e.getBoundingClientRect().top)) : [];
    const 画板 = art ? art.getBoundingClientRect() : null;
    const 面板 = [...document.querySelectorAll(".vui.war-artboard > .panel, .vui.war-artboard > .grid-2")].map((e) => {
      const b = e.getBoundingClientRect();
      return { 顶: Math.round(b.top - (画板 ? 画板.top : 0)), 左: Math.round(b.left - (画板 ? 画板.left : 0)), 宽: Math.round(b.width), 高: Math.round(b.height) };
    });
    return {
      画板宽: 画板 ? Math.round(画板.width) : null,
      画板高: 画板 ? Math.round(画板.height) : null,
      KPI数: k ? k.children.length : 0,
      KPI行数: new Set(卡位置).size,
      面板,
      横向溢出: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  console.log(路径.padEnd(34), JSON.stringify(r));
}
console.log("控制台错误:", 问题.length ? 问题 : "无");
await browser.close();
