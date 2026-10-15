import { describe, expect, it } from "vitest";

import {
  映射商机阶段,
  商机七阶段,
  商机阶段进度,
  商机阶段文案,
} from "../src/shared/stages/opportunity-stage.js";

describe("商机七阶段映射", () => {
  it("只保留七个主推进阶段", () => {
    expect(商机七阶段.map((阶段) => 阶段.名称)).toEqual([
      "客户建联（10%）",
      "需求挖掘（20%-30%）",
      "客户方案（40%）",
      "POC 试用（50%）",
      "立项推进（60%-70%）",
      "招投标（80%-90%）",
      "成单（100%）",
    ]);
  });

  it("兼容旧十阶段代码并保持提交阶段兼容", () => {
    expect(映射商机阶段("contacted")).toBe("customer_contact");
    expect(映射商机阶段("registered")).toBe("customer_contact");
    expect(映射商机阶段("quoted")).toBe("demand_discovery");
    expect(映射商机阶段("budget")).toBe("demand_discovery");
    expect(映射商机阶段("design")).toBe("customer_solution");
    expect(映射商机阶段("testing")).toBe("poc_trial");
    expect(映射商机阶段("negotiation")).toBe("tender");
    expect(映射商机阶段("won")).toBe("won");
    expect(商机七阶段.map((阶段) => 阶段.提交阶段)).toEqual([
      "registered",
      "budget",
      "design",
      "testing",
      "negotiation",
      "negotiation",
      "won",
    ]);
  });

  it("按进度识别新阶段并区分终止状态", () => {
    expect(映射商机阶段("60%")).toBe("project_approval");
    expect(映射商机阶段("85%")).toBe("tender");
    expect(映射商机阶段("lost")).toBe("lost");
    expect(映射商机阶段("项目取消")).toBe("cancelled");
    expect(商机阶段文案("project_approval")).toBe("立项推进（60%-70%）");
    expect(商机阶段进度("demand_discovery")).toBe("20%-30%");
  });
});
