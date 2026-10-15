import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = path.dirname(fileURLToPath(import.meta.url));
const failures = [];

const requiredFiles = [
  "00-MASTER-FRONTEND-REFACTOR-PLAN.md",
  "01-DESIGN-SYSTEM-AND-ADAPTATION.md",
  "02-PERMISSION-AND-SCOPE.md",
  "03-DASHBOARD-WORKBENCH.md",
  "04-CUSTOMER-MANAGEMENT.md",
  "05-LEAD-MANAGEMENT.md",
  "06-OPPORTUNITY-MANAGEMENT.md",
  "07-QUOTE-MANAGEMENT.md",
  "08-ORDER-MANAGEMENT.md",
  "09-CHANNEL-MANAGEMENT.md",
  "10-PRODUCT-PRICING-WORKLOAD.md",
  "11-APPROVAL-MESSAGE-ORGANIZATION.md",
  "12-IMPLEMENTATION-TEST-AND-ROLLBACK.md",
  "13-REFERENCE-ARCHITECTURE-AND-MODERNIZATION.md",
  "14-RISK-REGISTER.md",
  "15-AGENT-EXECUTION-GUIDE.md",
  "16-TRACEABILITY-MATRIX.md",
  "17-ISSUE-FEEDBACK-AND-REWORK-PROTOCOL.md",
  "TEST-ENV-BASELINE-20260923.md",
  "TEST-ENV-BUSINESS-BASELINE-REPORT.md",
  "TEST-ENV-REFACTOR-VERIFICATION.md",
  "tools/run-test-env-baseline.mjs",
  "tools/verify-test-env-refactor.mjs",
  "templates/MODULE-DELIVERY-REPORT.md",
  "templates/TEST-EXECUTION-REPORT.md",
  "templates/ISSUE-REPORT.md",
  "templates/REWORK-RECORD.md",
];

const documents = new Map();
for (const file of requiredFiles) {
  try {
    documents.set(file, await fs.readFile(path.join(base, file), "utf8"));
  } catch (error) {
    failures.push(`缺少文档：${file}（${error.message}）`);
  }
}

const master = documents.get("00-MASTER-FRONTEND-REFACTOR-PLAN.md") || "";
for (const marker of [
  "客户建联",
  "需求挖掘",
  "客户方案",
  "POC 试用",
  "立项推进",
  "招投标",
  "成单",
  "1280px",
  "开发测试循环",
]) {
  if (!master.includes(marker)) failures.push(`总方案缺少关键规则：${marker}`);
}

const permission = documents.get("02-PERMISSION-AND-SCOPE.md") || "";
for (const marker of ["路由权限", "菜单权限", "页面动作", "字段权限", "数据范围"]) {
  if (!permission.includes(marker)) failures.push(`权限文档缺少关键层级：${marker}`);
}

const moduleFiles = requiredFiles.filter((file) => /^0[3-9]-|^10-|^11-/.test(file));
for (const file of moduleFiles) {
  const content = documents.get(file) || "";
  if (!/权限|页面/.test(content)) failures.push(`${file} 缺少页面或权限说明`);
  if (!/测试|验收/.test(content)) failures.push(`${file} 缺少测试或验收说明`);
}

const feedback = documents.get("17-ISSUE-FEEDBACK-AND-REWORK-PROTOCOL.md") || "";
for (const marker of ["P0", "P1", "P2", "返工闭环", "不得关闭问题的情况"]) {
  if (!feedback.includes(marker)) failures.push(`问题闭环文档缺少关键内容：${marker}`);
}

const result = {
  documents: requiredFiles.length,
  failures,
};

console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
