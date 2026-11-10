import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 根目录 = process.cwd();

async function 读取(路径: string): Promise<string> {
  return readFile(resolve(根目录, 路径), "utf8");
}

describe("客户业务概况、档案编辑与跟进入口回归", () => {
  it("业务概况中商机条目在左、产品订单与维保订单在右", async () => {
    const 客户页 = await 读取("src/features/customer/CustomerManagementPage.vue");

    expect(客户页.indexOf("<strong>商机条目</strong>")).toBeGreaterThan(-1);
    expect(客户页.indexOf("<strong>产品订单</strong>")).toBeGreaterThan(-1);
    expect(客户页.indexOf("<strong>维保订单</strong>")).toBeGreaterThan(-1);
    expect(客户页.indexOf("<strong>商机条目</strong>")).toBeLessThan(
      客户页.indexOf("<strong>产品订单</strong>"),
    );
    expect(客户页.indexOf("<strong>产品订单</strong>")).toBeLessThan(
      客户页.indexOf("<strong>维保订单</strong>"),
    );
  });

  it("订单摘要展示业务主体信息、合作伙伴、区域与完整明细", async () => {
    const 客户页 = await 读取("src/features/customer/CustomerManagementPage.vue");

    for (const 断言 of [
      "打开摘要('订单', 订单)",
      "订单产品类型",
      "<span>所属区域</span>",
      "<span>合作伙伴</span>",
      "<span>渠道层级</span>",
      "<span>上级一级渠道</span>",
      "<span>签单人员</span>",
      "摘要关联报价",
      "摘要关联商机",
      "deliveryAddr",
      "<h3>订单明细</h3>",
      "摘要明细合计",
      "明细合计（总价）",
      "查看完整详情",
    ]) {
      expect(客户页).toContain(断言);
    }
  });

  it("商机摘要展示阶段、金额、区域、负责人、关联报价与最近跟进", async () => {
    const 客户页 = await 读取("src/features/customer/CustomerManagementPage.vue");

    for (const 断言 of [
      "打开摘要('商机', 商机)",
      "<span>商机阶段</span>",
      "<span>预计金额</span>",
      "<span>所属区域</span>",
      "<span>负责人</span>",
      "<span>关联报价单</span>",
      "摘要最新跟进",
      "<h3>最近跟进</h3>",
    ]) {
      expect(客户页).toContain(断言);
    }
  });

  it("编辑客户档案在客户详情内打开弹窗并原位保存", async () => {
    const 客户页 = await 读取("src/features/customer/CustomerManagementPage.vue");

    expect(客户页).toContain('class="button" @click="打开编辑档案"');
    expect(客户页).toContain('aria-labelledby="编辑客户档案标题"');
    expect(客户页).toContain('@submit.prevent="保存客户档案"');
    expect(客户页).toContain("客户列表.value.splice(位置, 1, 更新后)");
    expect(客户页).not.toContain('@click="打开跟进(当前客户)">编辑客户档案');
  });

  it("客户列表不再提供客户跟进入口，历史跟进仍可在客户档案查看", async () => {
    const 客户页 = await 读取("src/features/customer/CustomerManagementPage.vue");
    const 路由 = await 读取("src/router/index.ts");

    expect(客户页).toContain("摘要最新跟进");
    expect(客户页).not.toContain('aria-labelledby="记录客户跟进标题"');
    expect(客户页).not.toContain('@submit.prevent="保存跟进"');
    expect(客户页).not.toContain("nextFollowAt: 跟进表单.下次跟进");
    expect(客户页).not.toContain("${外壳前缀.value}/registration/${row.id}/followup");
    expect(路由).not.toContain('path: "registration/:id/followup"');
  });

  it("客户列表不再展示空金额占位符", async () => {
    const 客户页 = await 读取("src/features/customer/CustomerManagementPage.vue");

    expect(客户页).toContain(":amount=\"金额数值(row.金额) > 0 ? 金额文本(row.金额) : ''\"");
  });
});
