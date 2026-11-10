import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

async function 读取源码(路径: string): Promise<string> {
  return readFile(resolve(process.cwd(), 路径), "utf8");
}

describe("双报价与订单履约新界面", () => {
  it("报价中心和报价构建器提供标准与渠道分销双入口，标准报价不展示价格", async () => {
    const [报价中心, 报价创建, 商机中心] = await Promise.all([
      读取源码("src/features/quote/QuoteCenterPage.vue"),
      读取源码("src/features/quote/QuoteCreatePage.vue"),
      读取源码("src/features/opportunity/OpportunityCenterPage.vue"),
    ]);

    expect(报价中心).toContain("新建报价('standard')");
    expect(报价中心).toContain("新建报价('channel_distribution')");
    expect(报价中心).toContain("function 报价金额文本");
    expect(报价中心).toContain('是标准报价(row) ? "待区管定价" : 金额文本(row?.金额)');
    expect(报价中心).toContain("标准产品报价全链路不展示价格");
    expect(商机中心).toContain("创建报价单('standard')");
    expect(商机中心).toContain("创建报价单('channel_distribution')");
    expect(报价创建).toContain("quoteTypeCode: 表单.报价类型");
    expect(报价创建).toContain("标准产品报价不展示、不返回任何价格");
  });

  it("转订单弹窗始终收集收货信息，并对一级渠道强制出货金额和合同附件", async () => {
    const 源码 = await 读取源码("src/features/quote/QuoteToOrderDialog.vue");

    expect(源码).toContain("收货人 *");
    expect(源码).toContain("联系电话 *");
    expect(源码).toContain("详细收货地址 *");
    expect(源码).toContain("一级渠道商转订单必须填写出货金额。");
    expect(源码).toContain("一级渠道商转订单必须上传至少 1 个合同附件。");
    expect(源码).toContain('accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"');
    expect(源码).toContain("每张订单最多上传 10 个合同附件。");
    expect(源码).toContain("创建报价转订单(");
    expect(源码).toContain('String(表单.出货金额 ?? "").trim()');
    expect(源码).toContain("ElMessage.error(消息)");
  });

  it("新建报价默认不预选套餐、模块和功能", async () => {
    const 源码 = await 读取源码("src/features/quote/QuoteCreatePage.vue");

    expect(源码).toContain("const 预选套餐 = 文本(路由.query.packageId);");
    expect(源码).not.toContain("套餐列表.value[0]?.id");
    expect(源码).not.toContain("默认进入套餐报价");
  });

  it("新报价流程免审批，草稿与历史状态报价均可直接转订单", async () => {
    const [报价中心, 商机中心, 审核中心] = await Promise.all([
      读取源码("src/features/quote/QuoteCenterPage.vue"),
      读取源码("src/features/opportunity/OpportunityCenterPage.vue"),
      读取源码("src/features/approval/ApprovalCenterPage.vue"),
    ]);

    for (const 源码 of [报价中心, 商机中心]) {
      expect(源码).toContain('["draft", "submitted", "approved", "rejected"]');
      expect(源码).not.toContain("function 提交报价");
      expect(源码).not.toContain("function 确认报价");
      expect(源码).not.toContain("function 驳回报价");
      expect(源码).not.toContain("function 重新提交报价");
      expect(源码).not.toContain("function 变更报价状态");
    }
    expect(审核中心).not.toContain("报价审核");
    expect(审核中心).toContain("是已退役报价审批");
  });

  it("区管补价优先于普通确认，取消订单必须填写原因", async () => {
    const 源码 = await 读取源码("src/features/order/OrderActionCenterPage.vue");

    expect(源码).toContain('key: "region_price_adjust"');
    expect(源码).toContain('title: "区管补价"');
    expect(源码).toContain("标准产品报价必须补充大于 0 的最终订单价格后提交超管确认。");
    expect(源码).toContain('当前动作.value === "region_price_adjust" && 表单.amount <= 0');
    expect(源码).toContain('key: "cancel"');
    expect(源码).toContain("取消后关闭待办和通知，必须填写原因。");
    expect(源码).toContain('"cancel",');
  });

  it("订单展示价格对比与利润脱敏，待定价时隐藏金额和比例", async () => {
    const [订单中心, 订单处理, 客户端] = await Promise.all([
      读取源码("src/features/order/OrderCenterPage.vue"),
      读取源码("src/features/order/OrderActionCenterPage.vue"),
      读取源码("src/api/business-client.ts"),
    ]);

    for (const 源码 of [订单中心, 订单处理]) {
      expect(源码).toContain("待区管定价");
      expect(源码).toContain("渠道利润");
    }
    expect(订单中心).toContain('v-if="!当前订单是渠道用户"');
    expect(订单处理).toContain('v-if="管理端角色"');
    expect(订单中心).toContain("下载订单合同附件");
    expect(客户端).toContain("contractFiles");
    expect(客户端).toContain("/contract-attachments/");
  });

  it("渠道年度订单目标区分人工目标与系统完成金额，并按后端权限控制编辑", async () => {
    const [档案页, 客户端] = await Promise.all([
      读取源码("src/features/channel/ChannelProfilePage.vue"),
      读取源码("src/api/business-client.ts"),
    ]);

    expect(档案页).toContain("年度订单目标");
    expect(档案页).toContain("年度目标金额（人工）");
    expect(档案页).toContain("系统实际完成金额");
    expect(档案页).toContain(':disabled="!可编辑目标 || 目标保存中"');
    expect(档案页).toContain("超管可维护全部渠道，区管仅可维护本区域。");
    expect(档案页).toContain("当前账号只读。");
    expect(客户端).toContain("保存渠道年度订单目标");
    expect(客户端).toContain("/order-target");
  });
});
