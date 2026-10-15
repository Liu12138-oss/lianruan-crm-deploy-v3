import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 管理员脚本 = resolve(process.cwd(), "public/admin-app.js");
const 渠道脚本 = resolve(process.cwd(), "public/partner-app.js");

describe("编辑报价单的套餐回推", () => {
  it("自定义报价模式不再按功能子集回推基础套餐", async () => {
    for (const 文件 of [管理员脚本, 渠道脚本]) {
      const 内容 = await readFile(文件, "utf8");
      expect(内容).toContain("const isExplicitCustomQuote = quote.quoteMode === 'custom';");
      expect(内容).toContain(
        "let resolvedPackageId = isExplicitCustomQuote ? '' : quote.packageId || '';",
      );
      expect(内容).toContain(
        "if (!isExplicitCustomQuote && (!resolvedPackageId || !publishedPackages.value.some(pkg => pkg.id === resolvedPackageId)) && allIds.length) {",
      );
      // 套餐报价与历史报价仍需保留子集回推能力
      expect(内容).toContain("function findMatchingPackageId(productIds = []) {");
    }
  });
});
