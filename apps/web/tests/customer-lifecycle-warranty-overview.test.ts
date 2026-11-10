import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 根目录 = process.cwd();

async function 读取(路径: string): Promise<string> {
  return readFile(resolve(根目录, 路径), "utf8");
}

describe("客户生命周期质保与业务概况增强", () => {
  it("客户档案不再维护客户级质保，订单摘要支持维护四个日期", async () => {
    const 客户页 = await 读取("src/features/customer/CustomerManagementPage.vue");

    expect(客户页).not.toContain("warrantyStart: 档案表单");
    expect(客户页).not.toContain("warrantyEnd: 档案表单");
    expect(客户页).toContain("const 质保维护表单 = reactive({");
    expect(客户页).toContain("更新订单质保(订单.id");
    expect(客户页).toContain("质保起始日不能晚于质保到期日");
    expect(客户页).toContain("维保起始日必须晚于质保到期日");
    expect(客户页).toContain('字段(摘要记录, "warrantyStartDate", "质保起始日")');
    expect(客户页).toContain('字段(摘要记录, "maintenanceEndDate", "维保到期日")');
    expect(客户页).toContain("业务摘要遮罩 质保维护遮罩");
    expect(客户页).toContain(".业务摘要遮罩.质保维护遮罩");
    expect(客户页).toContain("z-index: 1310");
  });

  it("客户跟进页的关联商机使用中文阶段名，不直接展示后端状态码", async () => {
    const 跟进页 = await 读取("src/features/customer/CustomerFollowupPage.vue");

    expect(跟进页).toContain("商机阶段文案(映射商机阶段");
    expect(跟进页).toContain("{{ 商机阶段名称(商机) }}");
    expect(跟进页).not.toContain("{{ 商机.状态名称 }}");
  });

  it("生命周期第 7 步固定为持续运营，在保或断保作为客户档案状态展示", async () => {
    const 客户页 = await 读取("src/features/customer/CustomerManagementPage.vue");

    expect(客户页).toContain('文本(订单.状态, 字段(订单, "status")) !== "cancelled"');
    expect(客户页).toContain(
      'some((到期时间) => 到期时间 >= 今天零点()) ? "在保客户" : "断保客户"',
    );
    expect(客户页).toContain('字段(订单, "warrantyEndDate", "质保到期日")');
    expect(客户页).toContain("if (有效订单.value.length) return 6;");
    expect(客户页).toContain('"持续运营"');
    expect(客户页).toContain("{{ 质保状态 }}");
  });

  it("产品订单与维保订单按各自日期着色，剩余 30 天内黄色、已过期红色", async () => {
    const 客户页 = await 读取("src/features/customer/CustomerManagementPage.vue");

    expect(客户页).toContain("if (剩余天数 < 0)");
    expect(客户页).toContain('return { 等级: "质保已过期"');
    expect(客户页).toContain("if (剩余天数 <= 30)");
    expect(客户页).toContain('return { 等级: "质保即将到期"');
    expect(客户页).toContain(':class="订单质保信息(订单).等级"');
    expect(客户页).toContain('字段(订单, "warrantyEndDate", "质保到期日")');
    expect(客户页).toContain('字段(订单, "maintenanceEndDate", "维保到期日")');
    expect(客户页).toContain('v-for="订单 in 产品订单"');
    expect(客户页).toContain('v-for="订单 in 维保订单"');
    expect(客户页).toContain(".业务条目.质保即将到期");
    expect(客户页).toContain(".业务条目.质保已过期");
  });

  it("客户列表保留待审核与已驳回状态及驳回原因，右栏重复信息已移除", async () => {
    const 客户页 = await 读取("src/features/customer/CustomerManagementPage.vue");

    expect(客户页).toContain("['pending', 'rejected'].includes(row.状态)");
    expect(客户页).toContain(
      "`驳回原因：${清除富文本标签(文本(字段(row, 'reviewRemark', 'reason', 'remark'), '未记录'))}`",
    );
    expect(客户页).not.toContain("row.状态 === 'approved' ? 客户状态文本");
    expect(客户页).not.toContain("<strong>当前状态</strong>");
    expect(客户页).not.toContain("<strong>建议动作</strong>");
  });

  it("业务概况展示订单与商机指标、滚动条目和摘要弹窗", async () => {
    const 客户页 = await 读取("src/features/customer/CustomerManagementPage.vue");

    expect(客户页).toContain('{ 标签: "订单总数"');
    expect(客户页).toContain('{ 标签: "订单总金额"');
    expect(客户页).toContain('{ 标签: "商机数"');
    expect(客户页).toContain('{ 标签: "商机金额"');
    expect(客户页).toContain("业务滚动区");
    expect(客户页).toContain("打开摘要('订单', 订单)");
    expect(客户页).toContain("打开摘要('商机', 商机)");
    expect(客户页).toContain("查看完整详情");
  });

  it("客户业务摘要跳转订单与商机详情时会预选对应记录", async () => {
    const 客户页 = await 读取("src/features/customer/CustomerManagementPage.vue");
    const 订单页 = await 读取("src/features/order/OrderCenterPage.vue");

    expect(客户页).toContain("/order?orderId=");
    expect(客户页).toContain("/opportunity?opportunityId=");
    expect(订单页).toContain("useRoute");
    expect(订单页).toContain("文本(路由.query.orderId)");
  });

  it("全站表单网格可收缩，字段标签统一加粗", async () => {
    const 视觉样式 = await 读取("src/styles/visual-ui.css");
    const 表单样式 = await 读取("src/styles/war-form.css");
    const 演示样式 = await 读取("src/styles/war-demo.css");
    const 字体收口 = await 读取("src/styles/war-typography-lock.css");

    expect(视觉样式).toContain(".vui .form-field {\n  min-width: 0;");
    expect(表单样式).toContain("width: 100%;\n  min-width: 0;\n  max-width: 100%;");
    expect(演示样式).toContain("width: 100%;\n  min-width: 0;\n  max-width: 100%;");
    expect(字体收口).toContain(".vui label > span");
    expect(字体收口).toContain(".vui .info-item span");
    expect(字体收口).toContain(".vui .form-label");
  });
});
