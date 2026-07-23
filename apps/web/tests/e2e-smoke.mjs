import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/router.ts", import.meta.url), "utf8");
const required = ["/", "/admin", "/partner", "/mobile"];
const missing = required.filter((routePath) => !source.includes("path: '" + routePath + "'"));
if (missing.length) {
  console.error("浏览器测试入口缺少路由：" + missing.join(", "));
  process.exit(1);
}
console.log("浏览器测试入口已就绪：" + required.join(", "));
