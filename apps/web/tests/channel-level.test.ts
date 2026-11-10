import { describe, expect, it } from "vitest";

import type { 阶段9记录 } from "../src/api/business-client.js";
import {
  清理有效上级编号,
  渠道可作一级上级,
  读取渠道分销层级,
} from "../src/features/channel/channel-level.js";

function 渠道(原始数据: Record<string, unknown>): 阶段9记录 {
  return {
    id: String(原始数据.uuid || 原始数据.id || ""),
    编号: String(原始数据.id || ""),
    类型: "渠道商",
    标题: String(原始数据.name || ""),
    客户名称: "",
    渠道名称: String(原始数据.name || ""),
    负责人: "",
    区域: String(原始数据.region || ""),
    状态: String(原始数据.status || ""),
    状态名称: "",
    金额: 0,
    创建时间: "",
    更新时间: "",
    原始数据,
  };
}

describe("渠道分销层级判断", () => {
  it("历史一级渠道 partnerLevel 为 none 但存在有效下级时仍视为一级", () => {
    const P175 = 渠道({
      id: "P175",
      name: "江苏汇鸿中天科技有限公司",
      region: "江苏区",
      status: "active",
      partnerLevel: "none",
      level: "primary",
      childPartnerIds: ["P062", "P063"],
    });

    expect(读取渠道分销层级(P175)).toBe("primary");
    expect(渠道可作一级上级(P175, "江苏区")).toBe(true);
  });

  it("停用、归档、跨区域和缺少下级关系记录不能被选为一级上级", () => {
    const 正常一级 = 渠道({
      id: "P175",
      region: "江苏区",
      status: "active",
      partnerLevel: "primary",
      childPartnerIds: [],
    });
    const 停用一级 = 渠道({
      id: "P-STOP",
      region: "江苏区",
      status: "disabled",
      partnerLevel: "primary",
    });
    const 归档一级 = 渠道({
      id: "P-ARCHIVE",
      region: "江苏区",
      status: "archived",
      partnerLevel: "primary",
    });

    expect(渠道可作一级上级(正常一级, "江苏区")).toBe(true);
    expect(渠道可作一级上级(正常一级, "湖南区")).toBe(false);
    expect(渠道可作一级上级(停用一级, "江苏区")).toBe(false);
    expect(渠道可作一级上级(归档一级, "江苏区")).toBe(false);
    expect(渠道可作一级上级(正常一级, "")).toBe(false);
  });

  it("切换区域后清理不再有效的已选上级", () => {
    const P175 = 渠道({
      id: "P175",
      region: "江苏区",
      status: "active",
      partnerLevel: "primary",
      childPartnerIds: [],
    });
    const P200 = 渠道({
      id: "P200",
      region: "湖南区",
      status: "active",
      partnerLevel: "primary",
      childPartnerIds: [],
    });

    expect(清理有效上级编号([P175, P200], "湖南区", ["P175", "P200"])).toEqual(["P200"]);
  });
});
