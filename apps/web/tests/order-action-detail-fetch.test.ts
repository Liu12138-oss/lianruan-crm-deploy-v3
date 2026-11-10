import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 根目录 = process.cwd();

async function 读取(路径: string): Promise<string> {
  return readFile(resolve(根目录, 路径), "utf8");
}

describe("订单处理页详情读取", () => {
  it("按订单编号直接读取详情，不受订单总量和前 200 条列表限制", async () => {
    const 页面 = await 读取("src/features/order/OrderActionCenterPage.vue");
    const 客户端 = await 读取("src/api/business-client.ts");

    expect(页面).toContain('查询阶段9详情("orders", 订单编号.value)');
    expect(页面).not.toContain('查询阶段9列表("orders", { page: 1, pageSize: 200 })');
    expect(客户端).toContain("export async function 查询阶段9详情");
    expect(客户端).toContain("`/api/stage9/${模块}/${encodeURIComponent(编号)}`");
  });
});
