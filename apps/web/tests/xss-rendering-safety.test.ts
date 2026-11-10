import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 新界面源码目录 = resolve(process.cwd(), "src");

function 读取源码文件(目录: string): string[] {
  return readdirSync(目录).flatMap((名称) => {
    const 路径 = join(目录, 名称);
    if (statSync(路径).isDirectory()) return 读取源码文件(路径);
    return /\.(?:vue|ts|tsx|js)$/.test(名称) ? [路径] : [];
  });
}

describe("新UI渲染安全", () => {
  it("SEC-05：正式页面不使用原始HTML注入业务字段", () => {
    const 命中 = 读取源码文件(新界面源码目录).flatMap((路径) => {
      const 内容 = readFileSync(路径, "utf8");
      return ["v-html", "innerHTML", "outerHTML", "dangerouslyUseHTMLString"]
        .filter((模式) => 内容.includes(模式))
        .map((模式) => `${路径}：${模式}`);
    });

    expect(命中).toEqual([]);
  });
});
