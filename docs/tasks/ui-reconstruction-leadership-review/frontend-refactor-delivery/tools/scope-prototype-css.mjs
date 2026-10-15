/**
 * 把原型页面级样式（ui-demo/demo.css）完整转换为 `.vui` 作用域版本，
 * 保证原型使用的每个 class 在实现里都有同样的样式定义。
 * 用法：node tools/scope-prototype-css.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../../..");
const source = path.join(
  repoRoot,
  "docs/tasks/ui-reconstruction-leadership-review/ui-demo/demo.css",
);
const target = path.join(repoRoot, "apps/web/src/styles/war-demo.css");
const raw = await fs.readFile(source, "utf8");

function 前缀选择器(selector) {
  const 清理 = selector.trim().replace(/\s+/g, " ");
  if (!清理) return "";
  if (清理 === ":root" || 清理 === "html" || 清理 === "body") return ".vui";
  if (/^(html|body)\s/.test(清理)) return `.vui ${清理.replace(/^(html|body)\s+/, "")}`;
  if (清理.startsWith(".vui")) return 清理;
  return `.vui ${清理}`;
}

let index = 0;
function 解析(结束字符, 缩进) {
  let 结果 = "";
  while (index < raw.length) {
    while (index < raw.length && /\s/.test(raw[index])) {
      结果 += raw[index];
      index += 1;
    }
    if (raw[index] === 结束字符) {
      index += 1;
      return 结果;
    }
    if (raw.startsWith("/*", index)) {
      const 结束 = raw.indexOf("*/", index);
      const 注释 = raw.slice(index, 结束 === -1 ? raw.length : 结束 + 2);
      index += 注释.length;
      结果 += 注释;
      continue;
    }
    if (raw[index] === "@") {
      let 头 = "";
      while (index < raw.length && raw[index] !== "{") {
        头 += raw[index];
        index += 1;
      }
      if (raw[index] !== "{") {
        结果 += 头;
        break;
      }
      index += 1;
      const 内部 = 解析("}", `${缩进}  `);
      if (/@(media|supports|layer)/.test(头)) 结果 += `${头}{\n${内部}\n${缩进}}`;
      else 结果 += `${头}{${内部}}`;
      continue;
    }
    const 选择器起点 = index;
    while (index < raw.length && raw[index] !== "{" && raw[index] !== "}") index += 1;
    const 选择器 = raw.slice(选择器起点, index).trim();
    if (raw[index] !== "{") {
      结果 += 选择器;
      continue;
    }
    index += 1;
    const 属性起点 = index;
    let 深度 = 0;
    while (index < raw.length) {
      if (raw[index] === "{") 深度 += 1;
      if (raw[index] === "}") {
        if (深度 === 0) break;
        深度 -= 1;
      }
      index += 1;
    }
    const 属性 = raw.slice(属性起点, index);
    index += 1;
    if (!选择器) continue;
    const 前缀 = 选择器
      .split(",")
      .map((项) => 前缀选择器(项))
      .filter(Boolean)
      .join(", ");
    结果 += `${缩进}${前缀} {${属性}}\n`;
  }
  结果 += "";
  return 结果;
}

const 输出 = `/* 由 ui-demo/demo.css 自动生成的 .vui 作用域版本，请勿手工修改。 */\n\n${解析("\u0000", "")}`;
await fs.writeFile(target, 输出);
console.log(
  JSON.stringify(
    {
      来源: path.relative(repoRoot, source),
      目标: path.relative(repoRoot, target),
      原行数: raw.split("\n").length,
      输出行数: 输出.split("\n").length,
      输出字节: 输出.length,
    },
    null,
    2,
  ),
);
