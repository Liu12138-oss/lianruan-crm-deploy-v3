import { afterEach, describe, expect, it, vi } from "vitest";

import { 创建报备, 请求 } from "../src/api/business-client.js";

describe("业务接口错误提示", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("优先展示兼容接口返回的字符串业务原因", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              error: "联系电话已被账号「左梅君」使用，请更换。",
            }),
            { status: 409, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    await expect(请求("/api/users")).rejects.toThrow("联系电话已被账号「左梅君」使用，请更换。");
  });

  it("继续兼容对象结构的错误原因", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: false, error: { message: "审批事项已处理。" } }), {
            status: 409,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    await expect(请求("/api/approvals/example/status")).rejects.toThrow("审批事项已处理。");
  });

  it("创建类接口在快速重复提交时复用同一幂等键", async () => {
    const 调用 = vi.fn(
      async (_地址: RequestInfo | URL, _选项?: RequestInit) =>
        new Response(JSON.stringify({ success: true, data: { id: "registration-1" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", 调用);
    const 输入 = { customerName: `连点客户-${Date.now()}`, contact: "测试联系人" };

    await 创建报备(输入);
    await 创建报备(输入);

    const 第一次键 = new Headers(调用.mock.calls[0]?.[1]?.headers).get("idempotency-key");
    const 第二次键 = new Headers(调用.mock.calls[1]?.[1]?.headers).get("idempotency-key");
    expect(第一次键).toBeTruthy();
    expect(第二次键).toBe(第一次键);
  });
});
