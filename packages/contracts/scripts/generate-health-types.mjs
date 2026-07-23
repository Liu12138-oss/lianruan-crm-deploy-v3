import fs from "node:fs";
import path from "node:path";

const target = path.resolve("src/generated.ts");
const content =
  'export type HealthPath = "/health/live" | "/health/ready" | "/health/dependencies";\nexport type HealthStatus = "ok" | "degraded" | "failed";\nexport type HealthDependencyName = "config" | "postgres" | "redis" | "migration" | "worker";\nexport type HealthDependencyStatus = "ok" | "failed" | "skipped";\n';
fs.writeFileSync(target, content);
console.log("契约类型已生成：" + target);
