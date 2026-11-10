import { afterEach, describe, expect, it, vi } from "vitest";

import { 保存渠道商层级, 创建渠道商 } from "../src/features/channel/channel-profile-client.js";

function 模拟响应(状态: number, 内容: unknown): Response {
  return {
    ok: 状态 >= 200 && 状态 < 300,
    status: 状态,
    json: async () => 内容,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("渠道客户端错误提示", () => {
  it("透传 V2 接口返回的字符串错误", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        模拟响应(409, {
          success: false,
          error: "渠道商编号已存在，请使用新的渠道商编号。",
        }),
      ),
    );

    await expect(创建渠道商({ name: "重复渠道" })).rejects.toThrow(
      "渠道商编号已存在，请使用新的渠道商编号。",
    );
  });

  it("兼容对象错误并用于分销层级保存", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        模拟响应(400, {
          success: false,
          error: { message: "二级渠道商必须至少绑定一个一级渠道商。" },
        }),
      ),
    );

    await expect(保存渠道商层级("P064", { partnerLevel: "secondary" })).rejects.toThrow(
      "二级渠道商必须至少绑定一个一级渠道商。",
    );
  });
});
