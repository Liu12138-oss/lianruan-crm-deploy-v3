import { describe, expect, it } from "vitest";

import {
  初始账号审批阶段,
  是账号审批目标,
  读取账号审批阶段,
  账号审批阶段名称,
} from "../src/account-approval.js";

describe("渠道账号两级审批阶段", () => {
  it("识别账号类审批目标", () => {
    expect(是账号审批目标("user")).toBe(true);
    expect(是账号审批目标("partner")).toBe(false);
  });

  it("企业管理员提交进入区管初审，区管提交进入超管终审", () => {
    expect(初始账号审批阶段("partner_admin")).toBe("region_review");
    expect(初始账号审批阶段("region_manager")).toBe("superadmin_review");
  });

  it("历史审批缺少阶段时按超管终审兼容", () => {
    expect(读取账号审批阶段({})).toBe("superadmin_review");
    expect(读取账号审批阶段({ approvalStage: "region_review" })).toBe("region_review");
    expect(读取账号审批阶段({ approvalStage: "superadmin_review" })).toBe("superadmin_review");
  });

  it("审批阶段名称不向前端暴露内部代码", () => {
    expect(账号审批阶段名称("region_review")).toBe("待区管初审");
    expect(账号审批阶段名称("superadmin_review")).toBe("待超管终审");
  });
});
