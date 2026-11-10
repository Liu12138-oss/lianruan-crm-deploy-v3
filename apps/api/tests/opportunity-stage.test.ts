import { describe, expect, it } from "vitest";

import { 校验商机阶段推进, 规范商机阶段 } from "../src/opportunity-stage.js";

describe("商机阶段状态机", () => {
  it("允许相邻阶段推进并统一历史编码", () => {
    expect(规范商机阶段("registered")).toBe("customer_contact");
    expect(规范商机阶段("70")).toBe("project_approval");
    expect(规范商机阶段("negotiation")).toBe("tender");
    expect(校验商机阶段推进("registered", "budget").目标阶段).toBe("demand_discovery");
    expect(校验商机阶段推进("70", "negotiation").目标阶段).toBe("tender");
  });

  it("拒绝跳阶段，并允许输单后按真实结果更正为赢单", () => {
    expect(() => 校验商机阶段推进("budget", "testing")).toThrowError(/逐级推进/);
    expect(() => 校验商机阶段推进("won", "budget")).toThrowError(/已结束/);
    expect(校验商机阶段推进("lost", "won").目标阶段).toBe("won");
  });

  it("允许从进行中进入输单或项目取消，但终止后不能恢复", () => {
    expect(校验商机阶段推进("testing", "lost").目标阶段).toBe("lost");
    expect(校验商机阶段推进("design", "cancelled").目标阶段).toBe("cancelled");
    expect(() => 校验商机阶段推进("lost", "budget")).toThrowError(/已结束/);
  });

  it("无法识别的阶段必须拒绝，不能默认落到客户建联", () => {
    expect(() => 校验商机阶段推进("registered", "unknown-stage")).toThrowError(/无法识别/);
  });
});
