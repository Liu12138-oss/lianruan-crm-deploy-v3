import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const logsDir = path.resolve("tmp/verify-logs");
fs.mkdirSync(logsDir, { recursive: true });
const steps = [
  ["Node版本检查", ["node", "scripts/verify-node-version.mjs"]],
  ["PostgreSQL测试库准备", ["node", "scripts/prepare-postgresql-test.mjs"]],
  ["格式检查", ["npm", "run", "format"]],
  ["静态检查", ["npm", "run", "check"]],
  ["单元与接口测试", ["npm", "test"]],
  ["浏览器入口测试", ["npm", "run", "test:e2e"]],
  ["生产构建", ["npm", "run", "build"]],
  ["产物敏感信息扫描", ["node", "scripts/scan-build-output.mjs"]],
];

for (const [name, [cmd, ...args]] of steps) {
  console.log("验证步骤开始：" + name);
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) {
    console.error("验证失败：" + name + "。原始日志请查看终端输出，补充日志目录：" + logsDir);
    process.exit(result.status ?? 1);
  }
}
console.log("PostgreSQL生产同构完整验证通过。");
