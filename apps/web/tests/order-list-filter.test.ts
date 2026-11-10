import { describe, expect, it } from "vitest";

import { 订单匹配列表分区 } from "../src/features/order/order-list-filter.js";

describe("订单中心列表分区", () => {
  it("渠道用户一级确认后，订单在已完成中仍可见", () => {
    expect(订单匹配列表分区("primary_confirmed", "已完成", "partner")).toBe(true);
    expect(订单匹配列表分区("pending_superadmin_confirm", "已完成", "partner")).toBe(true);
    expect(订单匹配列表分区("completed", "已完成", "partner")).toBe(true);
  });

  it("区管只把本级已处理后的订单放进已完成", () => {
    expect(订单匹配列表分区("primary_confirmed", "待我处理", "region_manager")).toBe(true);
    expect(订单匹配列表分区("primary_confirmed", "已完成", "region_manager")).toBe(false);
    expect(订单匹配列表分区("pending_superadmin_confirm", "已完成", "region_manager")).toBe(true);
  });

  it("超管只把最终确认后的订单放进已完成", () => {
    expect(订单匹配列表分区("pending_superadmin_confirm", "待我处理", "superadmin")).toBe(true);
    expect(订单匹配列表分区("pending_superadmin_confirm", "已完成", "superadmin")).toBe(false);
    expect(订单匹配列表分区("confirmed", "已完成", "superadmin")).toBe(true);
  });
});
