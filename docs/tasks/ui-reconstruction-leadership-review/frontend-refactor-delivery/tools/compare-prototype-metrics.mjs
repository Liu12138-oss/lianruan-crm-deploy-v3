/**
 * 原型与实现的排版尺寸对比。
 * 用法：node tools/compare-prototype-metrics.mjs
 * 说明：只读取两个页面的计算样式与几何信息，不修改任何数据。
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../../..");
const prototypeUrl = `file://${path.join(
  repoRoot,
  "docs/tasks/ui-reconstruction-leadership-review/ui-demo/index.html",
)}`;
const baseUrl = process.env.V3_TEST_BASE_URL || "http://10.9.86.66";
const superadmin = {
  username: process.env.V3_TEST_SUPERADMIN_USERNAME || "",
  password: process.env.V3_TEST_SUPERADMIN_PASSWORD || "",
};

const 页面映射 = [
  { 名称: "工作台", 原型: "dashboard", 实现: "/admin/dashboard" },
  { 名称: "客户管理", 原型: "customers", 实现: "/admin/registration" },
  { 名称: "商机作战", 原型: "opportunities", 实现: "/admin/opportunity" },
  { 名称: "报价管理", 原型: "quotes", 实现: "/admin/quote" },
  { 名称: "订单中心", 原型: "orders", 实现: "/admin/order" },
  { 名称: "渠道管理", 原型: "channels", 实现: "/admin/partners" },
  { 名称: "产品目录", 原型: "products", 实现: "/admin/products" },
  { 名称: "消息中心", 原型: "messages", 实现: "/admin/notifications" },
];

const 采集代码 = `(() => {
  const 取样式 = (元素, 属性) => (元素 ? getComputedStyle(元素)[属性] : null);
  const 盒 = (选择器) => {
    const 元素 = document.querySelector(选择器);
    if (!元素) return null;
    const 矩形 = 元素.getBoundingClientRect();
    return {
      宽: Math.round(矩形.width),
      高: Math.round(矩形.height),
      上: Math.round(矩形.top),
      左: Math.round(矩形.left),
      内边距: 取样式(元素, "padding"),
      列: 取样式(元素, "gridTemplateColumns"),
      间距: 取样式(元素, "gap"),
      圆角: 取样式(元素, "borderRadius"),
    };
  };
  const 字号 = (选择器) => 取样式(document.querySelector(选择器), "fontSize");
  return {
    画板: 盒(".artboard"),
    KPI区: 盒(".war-kpis"),
    KPI卡片: 盒(".war-kpis .list-kpi"),
    KPI值: 字号(".war-kpis .list-kpi .metric-value strong"),
    KPI标签: 字号(".war-kpis .list-kpi .metric-label span"),
    三栏: 盒(".war-layout"),
    左栏: 盒(".war-layout .war-list"),
    中栏: 盒(".war-layout .war-center"),
    右栏: 盒(".war-layout .war-right"),
    列表头: 盒(".war-list-head"),
    搜索框: 盒(".war-search"),
    记录卡: 盒(".war-record"),
    记录标题字号: 字号(".war-record-top strong"),
    记录说明字号: 字号(".war-record p"),
    面板: 盒(".war-center .panel"),
  };
})()`;

const browser = await chromium.launch({ headless: true });
const 结果 = { 原型: {}, 实现: {} };

// 原型测量
{
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  await page.goto(prototypeUrl, { waitUntil: "load" });
  await page.waitForTimeout(800);
  for (const 项 of 页面映射) {
    const 按钮 = page.locator(`[data-nav="${项.原型}"]`).first();
    if (await 按钮.count()) await 按钮.click();
    await page.waitForTimeout(500);
    结果.原型[项.名称] = await page.evaluate(采集代码);
  }
  await context.close();
}

// 实现测量
{
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async (账号) => {
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(账号),
    });
  }, superadmin);
  for (const 项 of 页面映射) {
    await page.goto(`${baseUrl}${项.实现}`, { waitUntil: "domcontentloaded" });
    await page.locator(".war-kpis").first().waitFor({ timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
    结果.实现[项.名称] = await page.evaluate(采集代码);
  }
  await context.close();
}

await browser.close();

const 行 = [];
for (const 项 of 页面映射) {
  const 原型 = 结果.原型[项.名称] || {};
  const 实现 = 结果.实现[项.名称] || {};
  for (const 键 of ["KPI区", "KPI卡片", "三栏", "左栏", "中栏", "右栏", "列表头", "记录卡"]) {
    const a = 原型[键];
    const b = 实现[键];
    行.push({
      页面: 项.名称,
      元素: 键,
      原型: a ? `${a.宽}x${a.高}` : "-",
      实现: b ? `${b.宽}x${b.高}` : "-",
      原型列: a?.列 || "",
      实现列: b?.列 || "",
      原型间距: a?.间距 || "",
      实现间距: b?.间距 || "",
    });
  }
  for (const 键 of ["KPI值", "KPI标签", "记录标题字号", "记录说明字号"]) {
    行.push({ 页面: 项.名称, 元素: 键, 原型: 原型[键] || "-", 实现: 实现[键] || "-" });
  }
}

const 输出目录 = path.join(scriptDir, "../test-evidence/prototype-metrics");
await fs.mkdir(输出目录, { recursive: true });
await fs.writeFile(
  path.join(输出目录, "metrics.json"),
  `${JSON.stringify(结果, null, 2)}\n`,
);
await fs.writeFile(
  path.join(输出目录, "metrics-diff.md"),
  [
    "# 原型 vs 实现 排版尺寸对比",
    "",
    "| 页面 | 元素 | 原型 | 实现 | 原型列宽 | 实现列宽 | 原型间距 | 实现间距 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...行.map(
      (项) =>
        `| ${项.页面} | ${项.元素} | ${项.原型} | ${项.实现} | ${项.原型列 || "-"} | ${项.实现列 || "-"} | ${项.原型间距 || "-"} | ${项.实现间距 || "-"} |`,
    ),
  ].join("\n") + "\n",
);
console.log(`已输出：${path.relative(repoRoot, path.join(输出目录, "metrics-diff.md"))}`);
console.log(JSON.stringify(结果.原型["客户管理"], null, 1).slice(0, 1200));
