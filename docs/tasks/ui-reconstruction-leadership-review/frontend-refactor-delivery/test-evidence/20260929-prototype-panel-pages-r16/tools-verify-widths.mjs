import { createRequire } from "node:module";
const require = createRequire("/Users/liu/.aicodex/worktrees/6e0a/lianruan-crm-deploy-v3/package.json");
const { chromium } = require("playwright");
const base = "http://10.9.86.66";
const 账号 = { username: "liulonghai", password: "LrCRM@2026!" };
const 路由 = ["/admin/dashboard","/admin/registration","/admin/opportunity","/admin/quote","/admin/order","/admin/partners","/admin/products","/admin/notifications","/admin/leads","/admin/certifications"];
const 宽度 = [900, 1200, 1440, 1800];
const browser = await chromium.launch({ headless: true });
const 汇总 = [];
for (const 宽 of 宽度) {
  const ctx = await browser.newContext({ viewport: { width: 宽, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(async (a) => {
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a) });
    const j = await r.json();
    if (j?.data?.pageSession) localStorage.setItem("v3-page-session", JSON.stringify(j.data.pageSession));
    if (j?.data?.user) localStorage.setItem("v3-user", JSON.stringify(j.data.user));
  }, 账号);
  for (const 路径 of 路由) {
    await page.goto(base + 路径, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1000);
    const 信息 = await page.evaluate(() => {
      const art = document.querySelector(".vui.war-artboard, .vui.war-artboard-plain");
      const 盒 = (el) => el ? Math.round(el.getBoundingClientRect().width) : null;
      const k = document.querySelector(".war-kpis");
      const l = document.querySelector(".war-layout");
      const 卡行高 = k ? [...k.children].map((e) => Math.round(e.getBoundingClientRect().top)) : [];
      const 不同行 = new Set(卡行高).size;
      return {
        画板宽: 盒(art),
        KPI数: k ? k.children.length : 0,
        KPI行数: 不同行,
        三栏数: l ? l.children.length : 0,
        三栏列宽: l ? [...l.children].map((e) => Math.round(e.getBoundingClientRect().width)) : [],
        横向溢出: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    汇总.push({ 宽, 路径, ...信息 });
  }
  await ctx.close();
}
for (const 宽 of 宽度) {
  const 组 = 汇总.filter((x) => x.宽 === 宽);
  const kpi行异常 = 组.filter((x) => x.KPI数 && x.KPI行数 !== 1).map((x) => x.路径);
  const 三栏异常 = 组.filter((x) => x.三栏数 && x.三栏数 !== 3 && x.三栏数 !== 2).map((x) => x.路径 + ":" + x.三栏数);
  console.log(`视口 ${宽}px：页面 ${组.length}｜六指标换行 ${kpi行异常.length ? kpi行异常.join(",") : "无"}｜三栏结构异常 ${三栏异常.length ? 三栏异常.join(",") : "无"}｜画板宽 ${[...new Set(组.map(x=>x.画板宽))].join("/")}`);
}
await browser.close();
