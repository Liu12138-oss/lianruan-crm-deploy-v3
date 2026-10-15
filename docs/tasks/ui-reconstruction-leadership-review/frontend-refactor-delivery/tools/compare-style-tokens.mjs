/**
 * 逐元素比对原型与实现的计算样式（字体、字号、字重、行高、间距、高度、圆角）。
 * 输出差异清单，用于逐条修正。
 * 用法：node tools/compare-style-tokens.mjs
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
const 账号 = {
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
  { 名称: "线索管理", 原型: "lead-management", 实现: "/admin/leads" },
  { 名称: "证书管理", 原型: "certificate-management", 实现: "/admin/certifications" },
];

const 采集代码 = `(() => {
  const 目标类 = [
    "war-kpis","list-kpi","metric-label","metric-value","metric-foot",
    "war-layout","war-list","war-list-head","war-title-row","count-badge","war-search","war-tabs","war-tab",
    "war-center","war-center-head","deal-title","panel","panel-head","panel-body",
    "war-record","war-record-top","war-record-bottom","record-tags","record-title","record-meta",
    "right-card","right-card-title","info-grid","info-item","timeline","timeline-item",
    "status","button","chip","callout","grid-2","grid-3","flow","step-item","section","form-grid","form-field"
  ];
  const 取样式 = (元素) => {
    const c = getComputedStyle(元素);
    return {
      字号: c.fontSize,
      字重: c.fontWeight,
      行高: c.lineHeight,
      字体: c.fontFamily.split(",")[0].replace(/["']/g, ""),
      内边距: c.paddingTop + " " + c.paddingRight + " " + c.paddingBottom + " " + c.paddingLeft,
      外边距: c.marginTop + " " + c.marginRight + " " + c.marginBottom + " " + c.marginLeft,
      圆角: c.borderRadius,
      高度: Math.round(元素.getBoundingClientRect().height),
      宽度: Math.round(元素.getBoundingClientRect().width),
      颜色: c.color,
      背景: c.backgroundColor,
      display: c.display,
      间距: c.gap,
      列: c.gridTemplateColumns,
    };
  };
  const 结果 = {};
  for (const 类 of 目标类) {
    const 元素 = [...document.querySelectorAll("." + 类)].find((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (!元素) continue;
    结果[类] = 取样式(元素);
  }
  // 顶层结构顺序（用于核对排版骨架）
  const 骨架 = [...document.querySelectorAll(".demo-content > *, .demo-content > * > *")]
    .map((e) => e.className && String(e.className).split(" ")[0])
    .filter(Boolean)
    .slice(0, 12);
  return { 元素: 结果, 骨架 };
})()`;

const browser = await chromium.launch({ headless: true });
const 结果 = { 原型: {}, 实现: {} };

{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(prototypeUrl, { waitUntil: "load" });
  await page.waitForTimeout(600);
  for (const 项 of 页面映射) {
    const 按钮 = page.locator(`[data-nav="${项.原型}"]`).first();
    if (await 按钮.count()) await 按钮.click();
    await page.waitForTimeout(400);
    结果.原型[项.名称] = await page.evaluate(采集代码);
  }
  await ctx.close();
}

{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async (input) => {
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }, 账号);
  for (const 项 of 页面映射) {
    await page.goto(`${baseUrl}${项.实现}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    结果.实现[项.名称] = await page.evaluate(采集代码);
  }
  await ctx.close();
}
await browser.close();

const 差异 = [];
const 骨架差异 = [];
for (const 项 of 页面映射) {
  const 原型 = 结果.原型[项.名称] || { 元素: {} };
  const 实现 = 结果.实现[项.名称] || { 元素: {} };
  for (const [类, 原型样式] of Object.entries(原型.元素 || {})) {
    const 实现样式 = (实现.元素 || {})[类];
    if (!实现样式) {
      差异.push({ 页面: 项.名称, 类, 项: "缺失", 原型: "有", 实现: "无" });
      continue;
    }
    for (const 键 of ["字号", "字重", "行高", "字体"]) {
      if (原型样式[键] !== 实现样式[键]) {
        差异.push({
          页面: 项.名称,
          类,
          项: 键,
          原型: 原型样式[键],
          实现: 实现样式[键],
        });
      }
    }
  }
  if ((原型.骨架 || []).join(">") !== (实现.骨架 || []).join(">")) {
    骨架差异.push({
      页面: 项.名称,
      原型: (原型.骨架 || []).join(" > ") || "(无)",
      实现: (实现.骨架 || []).join(" > ") || "(无)",
    });
  }
}

const 输出目录 = path.join(scriptDir, "../test-evidence/style-token-diff");
await fs.mkdir(输出目录, { recursive: true });
await fs.writeFile(
  path.join(输出目录, "style-tokens.json"),
  `${JSON.stringify({ 结果, 差异, 骨架差异 }, null, 2)}\n`,
);
await fs.writeFile(
  path.join(输出目录, "style-diff.md"),
  [
    "# 原型 vs 实现 样式差异清单",
    "",
    `差异条目：${差异.length}`,
    "",
    "| 页面 | class | 项目 | 原型 | 实现 |",
    "| --- | --- | --- | --- | --- |",
    ...差异
      .slice(0, 400)
      .map((项) => `| ${项.页面} | .${项.类} | ${项.项} | ${项.原型} | ${项.实现} |`),
    "",
    "## 骨架顺序差异",
    "",
    "| 页面 | 原型 | 实现 |",
    "| --- | --- | --- |",
    ...骨架差异.map((项) => `| ${项.页面} | ${项.原型} | ${项.实现} |`),
  ].join("\n") + "\n",
);
console.log(`差异条目：${差异.length}，骨架差异：${骨架差异.length}`);
console.log(`报告：${path.relative(repoRoot, path.join(输出目录, "style-diff.md"))}`);
console.log(
  JSON.stringify(
    差异.slice(0, 25).map((项) => `${项.页面}.${项.类}.${项.项}: ${项.原型} → ${项.实现}`),
    null,
    1,
  ),
);
