import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { 管理端顶部导航 } from "../src/shared/navigation/admin-navigation.js";

const 根目录 = process.cwd();

async function 读取(路径: string): Promise<string> {
  return readFile(resolve(根目录, 路径), "utf8");
}

describe("R43 商机直接跟进与报价弹窗", () => {
  it("商机详情可直接填写跟进，并按阶段展示完整沟通内容", async () => {
    const [商机页, 跟进表单] = await Promise.all([
      读取("src/features/opportunity/OpportunityCenterPage.vue"),
      读取("src/features/opportunity/OpportunityFollowupForm.vue"),
    ]);

    expect(商机页).not.toContain("展开跟进编号");
    expect(商机页).not.toContain("快速跟进");
    expect(商机页).toContain("<OpportunityFollowupForm");
    expect(商机页).toContain(':可推进阶段="true"');
    expect(商机页).toContain("跟进历史");
    expect(商机页).toContain("数据.followups");
    expect(商机页).toContain("跟进记录.阶段");
    expect(商机页).toContain("本次沟通内容");
    expect(商机页).not.toContain("打开客户跟进");
    expect(商机页).not.toContain("编辑商机 / 推进阶段");
    expect(商机页).not.toContain('@click="打开跟进(当前商机)"');
    expect(商机页).not.toContain('@click="创建报价单">创建报价单</button>');

    expect(跟进表单).toContain("跟进方式");
    expect(跟进表单).toContain("本次沟通内容");
    expect(跟进表单).toContain("下一步计划");
    expect(跟进表单).toContain("需求挖掘填写越精准");
    expect(跟进表单).not.toContain("下次跟进时间");
    expect(跟进表单).toContain("同步推进阶段（可选）");
    expect(跟进表单).toContain("推进阶段时必须填写变更原因");
  });

  it("取消概览页签，商机信息并入右侧业务状态，内容面板与上方对齐", async () => {
    const 商机页 = await 读取("src/features/opportunity/OpportunityCenterPage.vue");

    expect(商机页).toContain('const 当前页签 = ref("跟进")');
    expect(商机页).toContain('const 页签列表 = ["跟进", "报价", "订单", "档案与审计"]');
    expect(商机页).not.toContain('当前页签 === "概览"');
    expect(商机页).not.toContain("<h2>商机信息</h2>");

    expect(商机页).toContain("<span>商机编号</span>");
    expect(商机页).toContain("<span>客户</span>");
    expect(商机页).toContain("<span>渠道商</span>");
    expect(商机页).toContain("<span>关联报价</span>");
    expect(商机页).toContain("<span>关联产品订单</span>");
    expect(商机页).toContain("关联产品订单.length");
    expect(商机页).toContain("下一步建议：");

    expect(商机页).toContain(".war-center > .panel");
    expect(商机页).toContain("margin: 10px 16px 16px;");
  });

  it("基本资料只在档案与审计维护，不再混入阶段和跟进字段", async () => {
    const 商机页 = await 读取("src/features/opportunity/OpportunityCenterPage.vue");

    expect(商机页).toContain("编辑商机资料");
    expect(商机页).toContain('changeReason: "维护商机基本资料"');
    expect(商机页).not.toContain("编辑商机与阶段推进");
    expect(商机页).not.toContain("推进到阶段 *");
    expect(商机页).not.toContain("跟进内容（可选，登记到跟进记录）");
  });

  it("关联报价在商机弹窗内完成查看与业务动作", async () => {
    const 商机页 = await 读取("src/features/opportunity/OpportunityCenterPage.vue");

    expect(商机页).toContain('class="modal quote-modal"');
    expect(商机页).toContain("报价明细");
    expect(商机页).toContain("打印 / 下载 PDF");
    expect(商机页).toContain("报价转订单");
    expect(商机页).toContain(
      '["draft", "submitted", "approved", "rejected"].includes(报价状态码(报价))',
    );
    expect(商机页).not.toContain("提交报价");
    expect(商机页).not.toContain("确认报价");
    expect(商机页).not.toContain("驳回报价");
    expect(商机页).not.toContain("重新提交报价");
    expect(商机页).not.toContain("可审核报价");
    expect(商机页).not.toContain("更新报价状态");
    expect(商机页).toContain('@click="转订单(选中报价)"');
    expect(商机页).toContain("<QuoteToOrderDialog");
    expect(商机页).toContain("hardwareItems 只保存选型元数据");
    expect(商机页).toContain('v-for="报价 in 关联报价"');
    expect(商机页).not.toContain("关联报价.slice(0, 2)");
    expect(商机页).toContain("报价档案路径(当前商机)");
    expect(商机页).not.toContain("报价单独立管理");
  });

  it("创建或编辑报价后回到来源商机，并保留独立报价管理入口", async () => {
    const [报价构建器, 路由, 渠道布局] = await Promise.all([
      读取("src/features/quote/QuoteCreatePage.vue"),
      读取("src/router/index.ts"),
      读取("src/layouts/PartnerLayout.vue"),
    ]);

    expect(报价构建器).toContain('← {{ 返回商机编号 ? "返回商机" : "返回商机列表" }}');
    expect(报价构建器).toContain("?opportunityId=${encodeURIComponent(返回商机编号.value)}");
    expect(报价构建器).not.toContain("← 返回报价列表");
    expect(报价构建器).not.toContain(".push(`${外壳前缀.value}/quote`)");

    expect(路由).toContain('path: "quote"');
    expect(路由).toContain("component: 报价中心页面");
    expect(路由).toContain('path: "quote/new"');
    expect(路由).toContain('path: "quote/edit/:id"');
    expect(路由).not.toContain('redirect: "/admin/opportunity"');
    expect(路由).not.toContain('redirect: "/partner/opportunity"');

    expect(渠道布局).toContain('{ 名称: "报价管理", 路径: "/partner/quote" }');
    expect(渠道布局).toContain('文案: "新建报价"');
  });

  it("历史报价编辑兼容旧产品与硬件编码，未改价时保留原明细保存", async () => {
    const 报价构建器 = await 读取("src/features/quote/QuoteCreatePage.vue");

    expect(报价构建器).toContain("Array.isArray(存档.productIds)");
    expect(报价构建器).toContain("Array.isArray(存档.products)");
    expect(报价构建器).toContain("Array.isArray(存档.hardwareItems)");
    expect(报价构建器).toContain("Array.isArray(存档.hardwareIds)");
    expect(报价构建器).toContain("按业务编号找产品");
    expect(报价构建器).toContain("匹配目录产品");
    expect(报价构建器).toContain("是服务产品");
    expect(报价构建器).toContain("是硬件或服务明细");
    expect(报价构建器).toContain('?.类型 === "硬件产品"');
    expect(报价构建器).toContain("维保|实施|技术服务");
    expect(报价构建器).not.toContain("/硬件|设备|服务/");
    expect(报价构建器).toContain("可保留原明细");
    expect(报价构建器).toContain("编辑已改动");
    expect(报价构建器).toContain("preserveExistingItems:");
    expect(报价构建器).toContain("可保留原明细.value && !编辑已改动.value");
    expect(报价构建器).not.toContain("[...存档明细, ...存档硬件明细]");
  });

  it("一级导航顺序与字号样式符合全站四档口径", async () => {
    const 导航顺序 = 管理端顶部导航.map((项目) => 项目.简称);
    expect(导航顺序.indexOf("渠道")).toBeGreaterThan(导航顺序.indexOf("消息"));
    expect(导航顺序.indexOf("渠道")).toBeLessThan(导航顺序.indexOf("配置"));

    const [主题样式, 排版锁定] = await Promise.all([
      读取("src/styles/theme.css"),
      读取("src/styles/war-typography-lock.css"),
    ]);
    expect(主题样式).toContain("gap: 8px;");
    expect(主题样式).toContain("font-weight: 700;");
    expect(排版锁定).toContain(".v2-桌面布局 .v2-顶部业务导航 .v2-一级导航");
    expect(排版锁定).toMatch(
      /\.v2-桌面布局 \.v2-顶部业务导航 \.v2-一级导航项 span[\s\S]*?font-size: 11px !important;/,
    );
  });
});
