/**
 * 把原型设计系统 visual-designs/assets/visual-ui.css 转换为作用域隔离版本。
 * 所有选择器统一加 `.vui` 前缀，避免影响 V3 现有页面与 Element Plus。
 * 用法：node tools/scope-visual-ui.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../../..");
const source = path.join(
  repoRoot,
  "docs/tasks/ui-reconstruction-leadership-review/visual-designs/assets/visual-ui.css",
);
const target = path.join(repoRoot, "apps/web/src/styles/visual-ui.css");

const raw = await fs.readFile(source, "utf8");

function 前缀选择器(selector) {
  const 清理 = selector.trim().replace(/\s+/g, " ");
  if (!清理) return "";
  if (清理 === ":root" || 清理 === "html" || 清理 === "body") return ".vui";
  if (清理.startsWith("html ") || 清理.startsWith("body ")) {
    return `.vui ${清理.replace(/^(html|body) /, "")}`;
  }
  if (清理.startsWith(":root ") || 清理.startsWith("html.") || 清理.startsWith("body.")) {
    return `.vui ${清理.replace(/^(html|body|:root)[.\s]/, "")}`;
  }
  if (清理.startsWith(".vui")) return 清理;
  return `.vui ${清理}`;
}

function 转换规则(selector, body) {
  const 选择器 = selector
    .split(",")
    .map((item) => 前缀选择器(item))
    .filter(Boolean)
    .join(", ");
  return `${选择器} {${body}}`;
}

let index = 0;
let output = "";

function 解析内容(结束字符, 缩进) {
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
      const 起点 = index;
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
      if (/@(media|supports|layer)/.test(头)) {
        const 内部 = 解析内容("}", 缩进 + "  ");
        结果 += `${头}{\n${内部}\n${缩进}}`;
      } else {
        const 内部 = 解析内容("}", 缩进 + "  ");
        结果 += `${头}{${内部}}`;
      }
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
    结果 += `${缩进}${转换规则(选择器, 属性)}\n`;
  }
  return 结果;
}

output = 解析内容("\u0000", "");
output = `/* 由 visual-designs/assets/visual-ui.css 自动生成的 .vui 作用域版本，请勿手工修改。 */\n\n${output}`;

await fs.writeFile(target, output);
console.log(
  JSON.stringify(
    {
      来源: path.relative(repoRoot, source),
      目标: path.relative(repoRoot, target),
      原行数: raw.split("\n").length,
      输出行数: output.split("\n").length,
      输出字节: output.length,
    },
    null,
    2,
  ),
);
