import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { 计算历史缺价序号 } from "../src/shared/format/quote-history.js";

const 根目录 = process.cwd();

async function 读取(路径: string): Promise<string> {
  return readFile(resolve(根目录, 路径), "utf8");
}

describe("QTE-16 历史报价明细价格展示", () => {
  it("部分明细零价且总额有差额时，只标记零价明细", () => {
    const 明细 = [
      ...Array.from({ length: 6 }, (_, 序号) => ({
        名称: `软件模块${序号 + 1}`,
        单价: 0,
        小计: 0,
      })),
      { 名称: "LV-7050-A", 单价: 11000, 小计: 11000 },
    ];

    expect([...计算历史缺价序号(明细, 49500)]).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("明细合计与总额一致时，不把正常零价赠送项标为历史缺失", () => {
    const 明细 = [
      { 单价: 0, 小计: 0 },
      { 单价: 11000, 小计: 11000 },
    ];

    expect(计算历史缺价序号(明细, 11000).size).toBe(0);
  });

  it("编辑页和报价详情逐项展示，并使用历史创建日期", async () => {
    const [编辑页, 报价详情] = await Promise.all([
      读取("src/features/quote/QuoteCreatePage.vue"),
      读取("src/features/quote/QuoteCenterPage.vue"),
    ]);

    expect(编辑页).toContain("计算历史缺价序号");
    expect(编辑页).toContain("明细金额(项, 项.单价)");
    expect(编辑页).toContain("明细金额(项, 项.小计)");
    expect(编辑页).toContain("存档创建时间.value = 待编辑.创建时间");
    expect(编辑页).toContain("<strong>{{ 报价日期 }}</strong>");
    expect(编辑页).not.toContain('new Date().toLocaleDateString("zh-CN")');

    expect(报价详情).toContain("计算历史缺价序号");
    expect(报价详情).toContain("明细金额文本(序号");
  });
});
