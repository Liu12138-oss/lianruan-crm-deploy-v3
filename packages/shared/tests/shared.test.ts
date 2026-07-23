import { describe, expect, it } from "vitest";

import { 创建错误响应, 判断健康状态, 应用错误 } from "../src/index.js";

describe("共享响应结构", () => {
  it("能够生成中文错误响应", () => {
    const 响应 = 创建错误响应({
      error: new 应用错误("V3_TEST", "测试错误"),
      requestId: "req-test",
      build: { 版本: "1", 提交: "abc", 构建时间: "2026-07-23T00:00:00.000Z" },
    });

    expect(响应.success).toBe(false);
    expect(响应.error.message).toBe("测试错误");
  });

  it("能够根据依赖状态判断整体健康状态", () => {
    expect(判断健康状态([])).toBe("ok");
    expect(
      判断健康状态([{ name: "redis", status: "skipped", message: "跳过", checkedAt: "now" }]),
    ).toBe("degraded");
    expect(
      判断健康状态([{ name: "redis", status: "failed", message: "失败", checkedAt: "now" }]),
    ).toBe("failed");
  });
});
