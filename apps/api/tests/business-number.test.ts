import { describe, expect, it } from "vitest";

import { 获取地市区号, 规范地市区号 } from "../src/business-store.js";

describe("地市区号规则", () => {
  it("两位区号左侧补零，三位和四位保持不变", () => {
    expect(规范地市区号("25")).toBe("025");
    expect(规范地市区号("025")).toBe("025");
    expect(规范地市区号("0512")).toBe("0512");
  });

  it("拒绝超出 2 至 4 位范围的区号", () => {
    expect(规范地市区号("8")).toBe("");
    expect(规范地市区号("12345")).toBe("");
  });

  it("优先按渠道商所在城市取区号，不使用旧默认值 86", () => {
    expect(获取地市区号("南京市", "86")).toBe("025");
    expect(获取地市区号("苏州市", "86")).toBe("0512");
    expect(获取地市区号("未知城市", "25")).toBe("025");
    expect(获取地市区号("未知城市", "86")).toBe("");
  });
});
