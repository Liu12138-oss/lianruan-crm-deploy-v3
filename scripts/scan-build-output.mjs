import fs from "node:fs";
import path from "node:path";

const targets = ["apps/api/dist", "apps/worker/dist", "apps/web/dist"];
const patterns = [
  { name: "带凭据PostgreSQL连接串", regex: /postgres(?:ql)?:\/\/[^:\s"']+:[^@\s"']+@/i },
  { name: "带凭据Redis连接串", regex: /rediss?:\/\/[^@\s"']+@/i },
  { name: "会话密钥字面量", regex: /SESSION_SECRET\s*[:=]\s*["'][^"']{8,}/i },
  { name: "生产地址", regex: /https?:\/\/(?:crm|api)\.[^\s"']+/i },
];
const hits = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (stat.isFile() && stat.size < 2 * 1024 * 1024) {
      const text = fs.readFileSync(full, "utf8");
      for (const pattern of patterns) {
        if (pattern.regex.test(text)) hits.push(full + " 命中 " + pattern.name);
      }
    }
  }
}
for (const target of targets) walk(target);
if (hits.length) {
  console.error("构建产物疑似包含敏感信息：\n" + hits.join("\n"));
  process.exit(1);
}
console.log("构建产物敏感信息扫描通过。");
