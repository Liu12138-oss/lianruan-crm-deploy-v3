import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { 渠道等级文本 } from "../src/shared/format/business-format.js";

async function 读取(路径: string): Promise<string> {
  return readFile(resolve(process.cwd(), 路径), "utf8");
}

describe("R45 渠道等级中文化", () => {
  it("钻石、铜牌和行业总代均展示业务中文名称", () => {
    expect(渠道等级文本("diamond")).toBe("钻石");
    expect(渠道等级文本("bronze")).toBe("铜牌");
    expect(渠道等级文本("industry")).toBe("行业总代");
    expect(渠道等级文本("unexpected-code")).toBe("其他渠道");
  });

  it("渠道列表、经营报表和核心档案不再直接展示等级代码", async () => {
    const [列表, 报表, 档案] = await Promise.all([
      读取("src/features/channel/ChannelListPage.vue"),
      读取("src/features/channel/PartnerReportPage.vue"),
      读取("src/features/channel/ChannelProfilePage.vue"),
    ]);

    expect(列表).toContain("渠道等级文本(读取渠道分销层级(row))");
    expect(报表).toContain("读取渠道等级文本(分销层级代码值)");
    expect(报表).toContain("读取渠道等级文本(合作级别)");
    expect(报表).toContain("同时展示分销层级和合作级别");
    expect(档案).toContain("渠道等级文本 as 读取渠道等级文本");
    expect(档案).toContain("读取渠道等级文本(档案.value?.level)");
    expect([列表, 报表, 档案].join("\n")).not.toContain("|| (代码 ? 代码 :");
  });
});
