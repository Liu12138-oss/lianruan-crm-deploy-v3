import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(base, "../../../../");
const failures = [];

const handoffFiles = [
  "MODULE-STATUS-AND-SCOPE-MATRIX.md",
  "PAGE-ROUTE-PERMISSION-MATRIX.md",
  "ACTION-API-IDEMPOTENCY-CONTRACT.md",
  "IMPLEMENTATION-TICKETS.md",
  "TEST-AND-ROLLBACK-MATRIX.md",
];

const relatedFiles = [
  "README.md",
  "ARCHITECTURE-OPTIMIZATION-BLUEPRINT.md",
  "BUSINESS-FACT-AND-PROTOTYPE-AUDIT.md",
  "LEAD-MANAGEMENT-PROTOTYPE-SPEC.md",
  "FULL-UI-DESIGN-BLUEPRINT.md",
  "IMPLEMENTATION-SPEC.md",
  "FEATURE-COVERAGE-MATRIX.md",
  "DESIGN.md",
  "VISUAL-RULES.md",
];

const relatedRequiredHeadings = {
  "BUSINESS-FACT-AND-PROTOTYPE-AUDIT.md": [
    "客户报备状态与流程",
    "商机阶段与结案状态",
    "报价状态与流程",
    "订单状态与流程",
    "消息事件和到期数据源",
    "原型核对与修正结果",
  ],
};

const requiredHeadings = {
  "MODULE-STATUS-AND-SCOPE-MATRIX.md": [
    "状态定义",
    "全局工程状态",
    "当前 UI 重构范围",
    "功能开关矩阵",
  ],
  "PAGE-ROUTE-PERMISSION-MATRIX.md": [
    "统一入口和异常页",
    "管理端正式页面",
    "工程化工作区路由",
    "渠道端正式页面",
    "移动端正式路径与原型",
    "字段级权限矩阵",
    "动作级权限矩阵",
  ],
  "ACTION-API-IDEMPOTENCY-CONTRACT.md": [
    "契约原则",
    "通用响应",
    "客户、报备与商机",
    "报价",
    "订单",
    "组织、账号与权限",
    "消息与提醒",
    "报价收益",
    "MCP 内部接口",
  ],
  "IMPLEMENTATION-TICKETS.md": ["执行规则", "阶段与依赖", "基础任务", "未来模块任务边界"],
  "TEST-AND-ROLLBACK-MATRIX.md": [
    "测试门禁",
    "路由与页面回归",
    "权限、字段和拒绝行为",
    "订单报价与商品快照测试",
    "组织和 MCP 测试",
    "模块回退矩阵",
  ],
};

const documents = {};
for (const file of handoffFiles) {
  const absolute = path.join(base, file);
  try {
    const content = await fs.readFile(absolute, "utf8");
    documents[file] = content;
    if (content.trim().length < 1000) {
      failures.push(`${file} 内容过短`);
    }
    for (const heading of requiredHeadings[file]) {
      if (!content.includes(heading)) failures.push(`${file} 缺少章节：${heading}`);
    }
  } catch (error) {
    failures.push(`${file} 不存在或无法读取：${error.message}`);
  }
}

for (const [file, headings] of Object.entries(relatedRequiredHeadings)) {
  const content = await fs.readFile(path.join(base, file), "utf8");
  for (const heading of headings) {
    if (!content.includes(heading)) failures.push(`${file} 缺少章节：${heading}`);
  }
}

async function extractRoutes(file, mode) {
  const source = await fs.readFile(path.join(repositoryRoot, file), "utf8");
  return [
    ...new Set([...source.matchAll(/\{\s*path:\s*['"]([^'"]+)['"]/g)].map((match) => match[1])),
  ]
    .filter((route) => route && route !== "/" && route !== "")
    .map((route) => {
      if (mode === "admin") return `admin.html#/${route.replace(/^\//, "")}`;
      if (mode === "partner") return `partner.html#/${route.replace(/^\//, "")}`;
      if (mode === "mobile") return route.startsWith("/mobile") ? route : `/mobile${route}`;
      return route;
    });
}

const pageMatrix = documents["PAGE-ROUTE-PERMISSION-MATRIX.md"] || "";
const routeGroups = [
  ["管理端路由", await extractRoutes("apps/web/public/admin-app.js", "admin")],
  ["渠道端路由", await extractRoutes("apps/web/public/partner-app.js", "partner")],
  ["移动端路由", await extractRoutes("apps/web/public/mobile-app.js", "mobile")],
];

for (const [label, routes] of routeGroups) {
  for (const route of routes) {
    const hashPath = route.includes("#/") ? route.slice(route.indexOf("#") + 1) : route;
    const aliases = [route, `\`${hashPath}\``, hashPath];
    if (!aliases.some((alias) => pageMatrix.includes(alias))) {
      failures.push(`${label}缺少页面矩阵覆盖：${route}`);
    }
  }
}

const workspaceSource = await fs.readFile(
  path.join(repositoryRoot, "apps/web/src/router/index.ts"),
  "utf8",
);
const workspaceRoutes = [...workspaceSource.matchAll(/path:\s*`?\/workspace\/admin\/[^`"']+/g)]
  .map((match) => match[0].replace(/^path:\s*`?/, ""))
  .filter((route) => !route.includes("${"))
  .filter((route) => route !== "/workspace/admin/platform-admin/organization");
for (const route of workspaceRoutes) {
  if (!pageMatrix.includes(route)) failures.push(`工作区路由缺少页面矩阵覆盖：${route}`);
}

const screenshotReferences = new Set();
for (const file of [...handoffFiles, ...relatedFiles]) {
  const content = documents[file] ?? (await fs.readFile(path.join(base, file), "utf8"));
  for (const match of content.matchAll(/screenshots\/[A-Za-z0-9_./-]+\.png/g)) {
    screenshotReferences.add(match[0]);
  }
  if (content.includes("screenshots/windows/")) {
    failures.push(`${file} 引用了旧窗口截图目录`);
  }
}
for (const reference of screenshotReferences) {
  const candidates = [
    path.join(base, reference),
    path.join(base, "../visual-designs", reference),
    path.join(repositoryRoot, reference),
  ];
  let found = false;
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      found = true;
      break;
    } catch {
      // Try the next documented location.
    }
  }
  if (!found) failures.push(`截图引用不存在：${reference}`);
}

const ticketsText = documents["IMPLEMENTATION-TICKETS.md"] || "";
const ticketBlocks = ticketsText
  .split(/\n### /)
  .slice(1)
  .map((block) => `### ${block}`);
const ticketIds = [];
for (const block of ticketBlocks) {
  const id = block.match(/^###\s+([A-Z]+-\d+)/)?.[1] || "";
  if (!id) continue;
  ticketIds.push(id);
  for (const field of ["状态：", "负责：", "依赖：", "验收：", "测试：", "回退："]) {
    if (!block.includes(field)) failures.push(`${id} 缺少字段：${field}`);
  }
}
if (ticketIds.length !== new Set(ticketIds).size) failures.push("实施任务单存在重复任务编号");

const apiDocument = documents["ACTION-API-IDEMPOTENCY-CONTRACT.md"] || "";
const requiredApiMarkers = [
  "POST /api/auth/login",
  "GET /api/registrations",
  "POST /api/opportunities",
  "POST /api/quotes",
  "POST /api/quotes/:id/convert-order",
  "PUT /api/orders/:id/primary-confirm",
  "PUT /api/orders/:id/price-adjust",
  "POST /api/orders/:id/revision-requests",
  "PUT /api/org/member-certifications/:id/revoke",
  "GET /api/messages/notifications",
  "POST /api/messages/platform/channels/:channelCode/test",
  "GET /api/quotes/:quoteId/profit-calculation",
  "POST /internal/mcp/context",
  "Idempotency-Key",
  "expectedRowVersion",
];
for (const marker of requiredApiMarkers) {
  if (!apiDocument.includes(marker)) failures.push(`动作与接口契约缺少：${marker}`);
}

const statusDocument = documents["MODULE-STATUS-AND-SCOPE-MATRIX.md"] || "";
const criticalFlags = [
  "V3_ORGANIZATION_ENABLED",
  "V3_ORGANIZATION_WRITE_ENABLED",
  "V3_ORGANIZATION_OFFBOARDING_ENABLED",
  "V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED",
  "V3_DIRECTORY_SYNC_ENABLED",
  "MESSAGE_WORKER_ENABLED",
  "MESSAGE_WECOM_GROUP_ENABLED",
  "MESSAGE_WECOM_APP_ENABLED",
  "MESSAGE_SMS_ENABLED",
  "MESSAGE_EMAIL_ENABLED",
  "QUOTE_PROFIT_WORKER_ENABLED",
  "ORDER_PREAPPROVAL_WORKER_ENABLED",
  "V3_MCP_ENABLED",
  "V3_MCP_REAL_TOOLS_ENABLED",
  "V3_MCP_HTTP_ENABLED",
];
for (const flag of criticalFlags) {
  if (!statusDocument.includes(flag)) failures.push(`模块状态矩阵缺少关键开关：${flag}`);
}

const testDocument = documents["TEST-AND-ROLLBACK-MATRIX.md"] || "";
for (const command of [
  "npm run build",
  "npm run check",
  "npm test",
  "npm run test:e2e",
  "npm run verify",
]) {
  if (!testDocument.includes(command)) failures.push(`测试矩阵缺少命令：${command}`);
}

const evidence = JSON.parse(await fs.readFile(path.join(base, "PROTOTYPE-EVIDENCE.json"), "utf8"));
if (evidence.pageCount !== 56) failures.push(`原型证据页面数不是 56：${evidence.pageCount}`);
if (evidence.windowCount !== 96) failures.push(`原型证据窗口数不是 96：${evidence.windowCount}`);
const gallery = await fs.readFile(path.join(base, "gallery.html"), "utf8");
if (!gallery.includes("主页面 56") || !gallery.includes("关键窗口 96")) {
  failures.push("gallery.html 未包含 56 个页面和 96 个关键窗口");
}

const result = {
  documents: handoffFiles.length,
  routes:
    routeGroups.reduce((total, [, routes]) => total + routes.length, 0) + workspaceRoutes.length,
  screenshots: screenshotReferences.size,
  tickets: ticketIds.length,
  failures,
};

console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
