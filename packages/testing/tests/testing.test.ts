import { describe, expect, it } from "vitest";

import { 创建测试环境变量 } from "../src/index.js";

describe("测试工具包", () => {
  it("提供稳定的测试环境变量", () => {
    expect(创建测试环境变量().APP_ENV).toBe("test");
  });
});
