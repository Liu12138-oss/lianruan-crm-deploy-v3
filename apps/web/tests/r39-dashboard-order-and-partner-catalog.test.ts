import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 根目录 = process.cwd();

async function 读取(路径: string): Promise<string> {
  return readFile(resolve(根目录, 路径), "utf8");
}

describe("R39 工作台面板换位与渠道端产品目录可见性", () => {
  it("工作台我的待办在左侧，业务趋势在右侧", async () => {
    const 工作台 = await 读取("src/features/dashboard/DashboardPage.vue");
    const 待办位置 = 工作台.indexOf("<h2>{{ 待办标题 }}</h2>");
    const 趋势位置 = 工作台.indexOf("<h2>业务趋势</h2>");

    expect(待办位置).toBeGreaterThan(-1);
    expect(趋势位置).toBeGreaterThan(-1);
    expect(待办位置).toBeLessThan(趋势位置);
  });

  it("工作台管理员入口只对内部管理员展示，待办跳转跟随外壳前缀", async () => {
    const 工作台 = await 读取("src/features/dashboard/DashboardPage.vue");

    expect(工作台).toContain('v-if="内部管理员"');
    expect(工作台).toContain("进入审核中心");
    expect(工作台).toContain('v-if="超级管理员"');
    expect(工作台).toContain("查看操作日志");
    expect(工作台).toContain("use外壳前缀");
    expect(工作台).toContain("function 审批路径");
    expect(工作台).toContain(
      "`${外壳前缀.value}/registration?selected=${encodeURIComponent(目标)}`",
    );
    expect(工作台).toContain("`${外壳前缀.value}/order/${encodeURIComponent(目标)}/actions`");
    expect(工作台).not.toContain("`/admin/registration/${row.id}/followup`");
  });

  it("渠道工作台展示本渠道业务待办，不读取或展示内部审批待办", async () => {
    const 工作台 = await 读取("src/features/dashboard/DashboardPage.vue");

    expect(工作台).toContain(
      'const 待办标题 = computed(() => (内部管理员.value ? "我的待办" : "业务待办"))',
    );
    expect(工作台).toContain("仅统计当前渠道的客户报备、报价和订单处理事项，不包含内部审批待办。");
    expect(工作台).toContain("渠道业务待办");
    expect(工作台).toContain("待办来源全部取当前账号已获授权的业务列表");
    expect(工作台).toContain('v-if="内部管理员"');
  });

  it("工作台报价状态优先使用页面顶层状态，避免已转订单仍显示已通过", async () => {
    const 工作台 = await 读取("src/features/dashboard/DashboardPage.vue");
    const 状态函数 = 工作台.slice(
      工作台.indexOf("function 报价状态码"),
      工作台.indexOf("function 报价状态文本"),
    );

    expect(状态函数).toContain('文本(row.状态, 字段(row, "status", "statusCode"))');
    expect(状态函数.indexOf("row.状态")).toBeLessThan(状态函数.indexOf("字段(row"));
  });

  it("渠道端产品目录不展示价格规则与刷新入口", async () => {
    const 产品页 = await 读取("src/features/product/ProductCatalogPage.vue");

    expect(产品页).toContain("是内部管理员");
    expect(产品页).toContain('v-if="内部管理员"');
    expect(产品页).toContain("@click=\"路由器.push('/admin/products/pricing')\"");
    expect(产品页).not.toContain(
      '<button type="button" class="button" @click="加载">刷新</button>',
    );
  });

  it("渠道端产品目录使用渠道向说明，不再展示管理员说明", async () => {
    const 产品页 = await 读取("src/features/product/ProductCatalogPage.vue");

    expect(产品页).toContain("产品目录承担对外报价与内部成本的双重职责");
    expect(产品页).toContain("浏览在售软件功能、硬件与套餐，可在报价单中直接选型并使用系统计价。");
    expect(产品页).toContain("内部管理员\n                ?");
  });

  it("价格规则与待发布 KPI 只对内部管理员展示", async () => {
    const 产品页 = await 读取("src/features/product/ProductCatalogPage.vue");

    expect(产品页).toContain("...(内部管理员.value");
    expect(产品页).toContain('label: "价格规则"');
    expect(产品页).toContain('label: "待发布"');
  });
});
