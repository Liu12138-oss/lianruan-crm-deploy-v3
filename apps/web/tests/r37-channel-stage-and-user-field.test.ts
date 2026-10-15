import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 根目录 = process.cwd();

async function 读取(路径: string): Promise<string> {
  return readFile(resolve(根目录, 路径), "utf8");
}

describe("R37 渠道合作环节进度轨道与页面字段中文化", () => {
  it("渠道商页合作环节改为商机进度式横向轨道，保留六环节与操作", async () => {
    const 渠道页 = await 读取("src/features/channel/ChannelListPage.vue");

    expect(渠道页).toContain("环节轨道");
    expect(渠道页).toContain("环节圆点");
    expect(渠道页).toContain("当前环节序号");
    expect(渠道页).not.toContain("环节网格");
    for (const 环节 of ["初次拜访", "统一培训", "客户开放（协同拜访）", "技术认证情况", "商机报备情况", "首单合作成功"]) {
      expect(渠道页).toContain(环节);
    }
    expect(渠道页).toContain("cooperationSteps");
  });

  it("渠道、订单、报价与定价 KPI 说明不再展示后端字段与状态码", async () => {
    const [渠道页, 订单页, 报价页, 定价页] = await Promise.all([
      读取("src/features/channel/ChannelListPage.vue"),
      读取("src/features/order/OrderCenterPage.vue"),
      读取("src/features/quote/QuoteCenterPage.vue"),
      读取("src/features/product/PricingCenterPage.vue"),
    ]);

    expect(渠道页).not.toContain("partnerLevel = ");
    expect(报价页).not.toContain('note: "draft"');
    expect(报价页).not.toContain('note: "submitted"');
    expect(报价页).not.toContain('note: "converted，不可重复转单"');
    expect(订单页).not.toContain("pending / pending_primary_confirm");
    expect(订单页).not.toContain("region_pending / primary_confirmed");
    expect(订单页).not.toContain('note: "pending_superadmin_confirm"');
    expect(订单页).not.toContain('note: "confirmed"');
    expect(定价页).not.toContain("priceType = fixed");
    expect(定价页).toContain("按固定单价计价");
  });

  it("订单审批历史用中文状态名，不再回退展示状态码", async () => {
    const [订单页, 订单处理页, 公共格式] = await Promise.all([
      读取("src/features/order/OrderCenterPage.vue"),
      读取("src/features/order/OrderActionCenterPage.vue"),
      读取("src/shared/format/business-format.ts"),
    ]);

    expect(订单页).toContain("订单状态文本(项.to)");
    expect(订单页).not.toContain("订单状态文本(项.to, 项.to)");
    expect(订单处理页).toContain("其他状态");
    expect(公共格式).toContain("revision_requested");
    expect(公共格式).toContain("replaced");
  });

  it("审计详情面向普通用户中文化：角色、模块、对象类型与变更字段不再直出后端代码", async () => {
    const 审计页 = await 读取("src/features/platform/AuditLogPage.vue");

    expect(审计页).toContain("角色中文映射");
    expect(审计页).toContain("模块中文映射");
    expect(审计页).toContain("对象类型中文映射");
    expect(审计页).toContain("变更字段中文映射");
    expect(审计页).toContain("动作清洗");
    expect(审计页).not.toContain("显示值(详情原始.moduleCode)");
    expect(审计页).not.toContain("显示值(详情原始.requestId)");
    expect(审计页).toContain("内部技术字段不面向业务展示");
  });

  it("账号管理角色与所属渠道展示中文名称，不展示角色代码与渠道编号", async () => {
    const 账号页 = await 读取("src/features/platform/AccountManagePage.vue");

    expect(账号页).toContain("角色中文映射");
    expect(账号页).toContain("角色文本");
    expect(账号页).toContain("渠道文本");
    expect(账号页).not.toContain('文本(取(行, "partnerId", "partnerName"), "内部账号")');
  });
});
