// 原型侧截图工具：按 ui-demo 原型页面 id 逐页截图，用于与实现侧 impl-*.png 对照
// 用法：node tools-proto-shots.mjs [输出目录]
import { createRequire } from "node:module";
import fs from "node:fs/promises";
const require = createRequire("/Users/liu/.aicodex/worktrees/6e0a/lianruan-crm-deploy-v3/package.json");
const { chromium } = require("playwright");

const W = "/Users/liu/.aicodex/worktrees/6e0a/lianruan-crm-deploy-v3";
const out = process.argv[2] || new URL(".", import.meta.url).pathname;

const 页面 = [
  ["产品目录", "products"],
  ["消息中心", "messages"],
  ["审核中心", "approvals"],
  ["OpenAPI", "openapi"],
  ["审计与系统", "audit-system"],
  ["消息渠道配置", "message-platform"],
  ["提醒规则与模板", "message-rules"],
  ["证书管理", "certificate-management"],
];

await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`file://${W}/docs/tasks/ui-reconstruction-leadership-review/ui-demo/index.html`, { waitUntil: "load" });
await page.waitForTimeout(800);
for (const [名称, id] of 页面) {
  await page.evaluate((s) => window.demoGo(s), id);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/proto-${名称}.png`, fullPage: false });
}
await browser.close();
console.log("原型截图完成：", out);
