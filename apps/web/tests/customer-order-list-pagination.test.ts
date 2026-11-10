import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { 查询阶段9全部, type 阶段9列表结果, type 阶段9记录 } from "../src/api/business-client.js";

const 根目录 = process.cwd();

async function 读取(路径: string): Promise<string> {
  return readFile(resolve(根目录, 路径), "utf8");
}

function 记录(id: string): 阶段9记录 {
  return {
    id,
    编号: id,
    类型: "order",
    标题: id,
    客户名称: "测试客户",
    渠道名称: "测试渠道",
    负责人: "测试负责人",
    区域: "江苏区",
    状态: "completed",
    状态名称: "已完成",
    金额: 0,
    创建时间: "2026-10-27T00:00:00.000Z",
    更新时间: "2026-10-27T00:00:00.000Z",
    原始数据: {},
  };
}

describe("客户与订单千条列表分页", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["src/features/customer/CustomerManagementPage.vue", "客户"],
    ["src/features/order/OrderCenterPage.vue", "订单"],
  ])("%s 只渲染当前页并支持筛选后回到第一页", async (路径) => {
    const 页面 = await 读取(路径);

    expect(页面).toContain("const 每页条数 = 20;");
    expect(页面).toContain("const 分页后列表 = computed");
    expect(页面).toContain('v-for="row in 分页后列表"');
    expect(页面).toContain("watch([当前标签, 搜索词, 选中区域, 选中排序], () => {");
    expect(页面).toContain(
      'const 排序选项 = ["创建时间新→旧", "创建时间旧→新", "金额高→低", "金额低→高"];',
    );
    expect(页面).toContain("当前页码.value = 1;");
    expect(页面).toContain("当前页码.value = Math.min(总页数.value, Math.max(1, 页码));");
    expect(页面).toContain("上一页");
    expect(页面).toContain("下一页");
    expect(页面).toContain("共 {{ 过滤后列表.length }}");
  });

  it("全量读取按顺序合并服务端分页，保持总数与记录顺序", async () => {
    const 每页数据 = Array.from({ length: 5 }, (_, 页序号) =>
      Array.from({ length: 100 }, (_, 行序号) => 记录(`第${页序号 + 1}页-${行序号 + 1}`)),
    );
    const 调用 = vi.fn(async (地址: string | URL | Request) => {
      const 页码 = Number(new URL(String(地址), "http://localhost").searchParams.get("page"));
      const 数据 = 每页数据[页码 - 1] || [];
      const 响应: 阶段9列表结果 = {
        数据,
        分页: { 页码, 每页: 100, 总数: 500 },
      };
      return new Response(JSON.stringify({ success: true, data: 响应 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", 调用);

    const 结果 = await 查询阶段9全部("orders");

    expect(结果.总数).toBe(500);
    expect(结果.数据).toHaveLength(500);
    expect(结果.数据[0]?.id).toBe("第1页-1");
    expect(结果.数据[100]?.id).toBe("第2页-1");
    expect(结果.数据[499]?.id).toBe("第5页-100");
    expect(调用).toHaveBeenCalledTimes(5);
  });
});
