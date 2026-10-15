import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 根目录 = process.cwd();

async function 读取(路径: string): Promise<string> {
  return readFile(resolve(根目录, 路径), "utf8");
}

describe("R40 渠道端目录去价格、新建入口与订单总价落位", () => {
  it("渠道端产品目录只保留产品、模块与描述，不展示任何价格", async () => {
    const 产品页 = await 读取("src/features/product/ProductCatalogPage.vue");

    expect(产品页).toContain('v-if="内部管理员 && 功能.tiers?.length"');
    expect(产品页).toContain('v-if="内部管理员 && 功能.regionPriceOverrides?.length"');
    // 渠道端可访问的「产品目录」下钻里两处价格块都已按角色收敛，剩余两处属于超管维护页签。
    expect((产品页.match(/v-if="内部管理员" class="价格块"/g) || []).length).toBe(2);
    expect((产品页.match(/<div class="价格块">/g) || []).length).toBe(2);
  });

  it("渠道端顶栏提供新建客户、新建商机与新建报价入口", async () => {
    const 渠道布局 = await 读取("src/layouts/PartnerLayout.vue");

    expect(渠道布局).toContain("模块主操作");
    expect(渠道布局).toContain('{ 文案: "新建客户", 目标: "/partner/registration/new" }');
    expect(渠道布局).toContain('{ 文案: "新建商机", 目标: "/partner/opportunity/new" }');
    expect(渠道布局).toContain('{ 文案: "新建报价", 目标: "/partner/quote/new" }');
    expect(渠道布局).toContain('class="v2-顶部主操作"');
  });

  it("渠道端新建商机使用新 UI 专用表单，不再落到通用工作区页面", async () => {
    const 路由 = await 读取("src/router/index.ts");

    expect(路由).toContain('name: "渠道新建商机"');
    expect(路由).toContain("component: 新建商机页面");
    expect(路由).toContain("// 渠道端新建商机与管理端共用同一套新 UI 表单，避免渠道侧落到通用工作区页面。");
  });

  it("订单明细总价固定在方框内最下方", async () => {
    const 订单页 = await 读取("src/features/order/OrderCenterPage.vue");

    expect(订单页).toContain('class="panel 明细面板"');
    expect(订单页).toContain('class="panel-body flush 明细面板体"');
    expect(订单页).toContain('class="明细合计条"');
    expect(订单页).toContain("margin-top: auto");
    expect(订单页).not.toContain("<tfoot v-if=\"明细(当前订单).length\">");
  });
});
