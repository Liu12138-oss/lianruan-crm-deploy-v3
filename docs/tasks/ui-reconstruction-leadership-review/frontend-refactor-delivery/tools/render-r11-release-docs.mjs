import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(scriptDir, "..");
const evidence = path.join(root, "test-evidence/20260923-refactor-verification-r11");
const data = JSON.parse(await fs.readFile(path.join(evidence, "full-matrix-results.json"), "utf8"));

const 环境记录 = data.records.filter((record) => record.environment !== "before");
const 重构前记录 = data.records.filter((record) => record.environment === "before");
const 分辨率矩阵 = [...new Set(环境记录.map((record) => record.width))].sort((a, b) => a - b);

function 失败原因(record) {
  const 原因 = [];
  if (record.scrollWidth > record.clientWidth + 1)
    原因.push(`横向溢出 ${record.scrollWidth - record.clientWidth}px`);
  if (record.missingTexts.length) 原因.push(`缺少文案 ${record.missingTexts.join("、")}`);
  if (record.forbidden) 原因.push("落到 403");
  return 原因.join("；") || "通过";
}

const 聚合 = new Map();
for (const record of 环境记录) {
  const key = `${record.role}|${record.route}`;
  if (!聚合.has(key)) 聚合.set(key, { role: record.role, route: record.route, widths: [], records: [] });
  const item = 聚合.get(key);
  item.widths.push(record.width);
  item.records.push(record);
}

const 覆盖行 = [...聚合.values()].map((item) => {
  const 失败 = item.records.filter(
    (record) =>
      record.scrollWidth > record.clientWidth + 1 ||
      record.missingTexts.length > 0 ||
      record.forbidden,
  );
  const 最大溢出 = Math.max(...item.records.map((record) => record.scrollWidth - record.clientWidth));
  return {
    role: item.role,
    route: item.route,
    widths: [...item.widths].sort((a, b) => a - b).join(" / "),
    screenshots: item.records.filter((record) => record.width === 1440).length,
    status: 失败.length ? "失败" : "通过",
    detail: 失败.length ? 失败.map(失败原因).join("；") : "无横向溢出、关键文案齐全",
    最大溢出,
  };
});

const 角色名 = { superadmin: "超级管理员", region: "湖南区区域管理员", channel: "渠道销售代表" };

const 覆盖文档 = `# 全量页面覆盖矩阵（r11）

生成时间：${data.generatedAt}

测试环境：${data.baseUrl}

分辨率矩阵：${分辨率矩阵.join(" / ")}

## 1. 覆盖总量

- 访问记录：${环境记录.length} 条（含分辨率重复访问）。
- 唯一「角色 × 路由」组合：${覆盖行.length} 个。
- 重构前对比记录：${重构前记录.length} 条。
- 失败组合：${覆盖行.filter((row) => row.status === "失败").length} 个。
- 越权拦截验证：${data.permissionChecks.filter((item) => item.blocked === true).length} / ${data.permissionChecks.length} 通过。

## 2. 角色 × 路由覆盖明细

| 角色 | 路由 | 覆盖分辨率 | 1440 截图 | 结果 | 说明 |
| --- | --- | --- | --- | --- | --- |
${覆盖行
  .map(
    (row) =>
      `| ${角色名[row.role] || row.role} | \`${row.route}\` | ${row.widths} | ${row.screenshots} | ${row.status} | ${row.detail} |`,
  )
  .join("\n")}

## 3. 越权访问拦截验证

| 角色 | 直链路由 | 实际落点 | 结果 |
| --- | --- | --- | --- |
${data.permissionChecks
  .map(
    (item) =>
      `| ${角色名[item.role] || item.role} | \`${item.route}\` | \`${item.landedPath || "-"}\` | ${item.blocked ? "已拦截" : "未拦截"} |`,
  )
  .join("\n")}

## 4. 关键接口状态

| 接口 | 状态码 | 说明 |
| --- | --- | --- |
${data.apiChecks
  .map((item) => {
    const 说明 =
      item.status >= 200 && item.status < 300
        ? "正常"
        : item.path === "/api/messages/platform/channels"
          ? "测试环境缺少 message 架构迁移，后端待补"
          : "待后端确认";
    return `| \`${item.path}\` | ${item.status} | ${说明} |`;
  })
  .join("\n")}

## 5. 脚本

\`\`\`bash
cd docs/tasks/ui-reconstruction-leadership-review/frontend-refactor-delivery
V3_TEST_SUPERADMIN_USERNAME=<超管账号> V3_TEST_SUPERADMIN_PASSWORD=<密码> \\
V3_TEST_REGION_USERNAME=<区管账号> V3_TEST_REGION_PASSWORD=<密码> \\
V3_TEST_CHANNEL_USERNAME=<渠道账号> V3_TEST_CHANNEL_PASSWORD=<密码> \\
V3_TEST_BEFORE_URL=<重构前镜像地址> \\
node tools/verify-test-env-full-matrix.mjs
\`\`\`

证据文件：\`${path.relative(root, path.join(evidence, "full-matrix-results.json"))}\`
`;

await fs.writeFile(path.join(root, "21-COVERAGE-MATRIX-R11.md"), 覆盖文档);

const 对比候选 = [
  ["工作台", "superadmin", "/admin/dashboard", "01-dashboard.png"],
  ["客户报备", "superadmin", "/admin/registration", "02-registration.png"],
  ["商机管理", "superadmin", "/admin/opportunity", "03-opportunity.png"],
  ["报价管理", "superadmin", "/admin/quote", "04-quote.png"],
  ["订单中心", "superadmin", "/admin/order", "05-order.png"],
  ["产品目录", "superadmin", "/admin/products", "06-products.png"],
  ["渠道商", "superadmin", "/admin/partners", "08-partners.png"],
  ["审核中心", "superadmin", "/admin/admin-review", "10-admin-review.png"],
  ["消息中心", "superadmin", "/admin/notifications", "17-notifications.png"],
];

const 截图名 = (role, route) =>
  `${role}-1440-${route.replaceAll("/", "-").replaceAll(":", "-")}.png`;

const 对比块 = [];
for (const [名称, role, route, 基线文件] of 对比候选) {
  const 前存在 = await fs
    .access(path.join(evidence, "before-screenshots", 截图名(role, route)))
    .then(() => true)
    .catch(() => false);
  const 后存在 = await fs
    .access(path.join(evidence, "screenshots", 截图名(role, route)))
    .then(() => true)
    .catch(() => false);
  const 前图 = 前存在
    ? `test-evidence/20260923-refactor-verification-r11/before-screenshots/${截图名(role, route)}`
    : `test-evidence/20260923-business-baseline/screenshots/${基线文件}`;
  const 后图 = 后存在
    ? `test-evidence/20260923-refactor-verification-r11/screenshots/${截图名(role, route)}`
    : "";
  if (!后图) continue;
  对比块.push(`      <section>
        <h2>${名称} · <code>${route}</code></h2>
        <p class="meta">左：重构前（旧镜像 ${"3.0.0-stage10.20260920-mcpdeploy1"}）；右：重构后（${"uirefactor11"}，1440×900）</p>
        <div class="compare">
          <figure>
            <figcaption><span>重构前</span></figcaption>
            <img src="${前图}" alt="${名称} 重构前" loading="lazy" />
          </figure>
          <figure>
            <figcaption><span>重构后</span></figcaption>
            <img src="${后图}" alt="${名称} 重构后" loading="lazy" />
          </figure>
        </div>
      </section>`);
}

const 画廊 = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>UI 重构前后对比画廊（r11）</title>
    <style>
      :root {
        color: #172b4d;
        background: #eef4fa;
        font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 28px;
      }
      header {
        max-width: 1500px;
        margin: 0 auto 22px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 28px;
      }
      p {
        margin: 0;
        color: #60748c;
        line-height: 1.65;
      }
      main {
        display: grid;
        max-width: 1500px;
        gap: 22px;
        margin: auto;
      }
      section {
        overflow: hidden;
        border: 1px solid #d7e3f0;
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 12px 32px rgba(31, 65, 109, 0.08);
      }
      h2 {
        margin: 0;
        padding: 16px 18px;
        border-bottom: 1px solid #e5edf6;
        font-size: 17px;
      }
      .meta {
        padding: 12px 18px;
        color: #6a7d92;
        background: #f8fbff;
        font-size: 12px;
      }
      .compare {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
      figure {
        min-width: 0;
        margin: 0;
        padding: 18px;
      }
      figure + figure {
        border-left: 1px solid #e5edf6;
      }
      figcaption {
        margin-bottom: 10px;
        color: #40576f;
        font-size: 13px;
        font-weight: 800;
      }
      img {
        display: block;
        width: 100%;
        border: 1px solid #dbe6f1;
        border-radius: 8px;
        background: #fff;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>UI 重构前后对比画廊（r11）</h1>
      <p>
        重构前取旧镜像只读容器抓取的 1440×900 截图，重构后取当前测试环境同一路由截图。共
        ${对比块.length} 组重点页面对比。
      </p>
    </header>
    <main>
${对比块.join("\n")}
    </main>
  </body>
</html>
`;

await fs.writeFile(path.join(root, "COMPARISON-GALLERY.html"), 画廊);

console.log(
  JSON.stringify(
    {
      覆盖组合: 覆盖行.length,
      失败组合: 覆盖行.filter((row) => row.status === "失败").length,
      对比组数: 对比块.length,
    },
    null,
    2,
  ),
);
