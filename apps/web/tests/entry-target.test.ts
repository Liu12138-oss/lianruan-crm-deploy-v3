import { describe, expect, it } from "vitest";

import type { 登录用户 } from "../src/api/auth-client.js";
import { 是否业务页面路径, 选择登录后路径 } from "../src/router/entry-target.js";

function 测试用户(defaultPath: string, allowedPaths: string[]): 登录用户 {
  return {
    username: "test",
    displayName: "测试用户",
    roleName: "测试角色",
    defaultPath,
    allowedPaths,
  };
}

describe("统一入口分流规则", () => {
  it("未登录时进入登录页", () => {
    expect(选择登录后路径(null, { 移动访问: false })).toBe("/login");
  });

  it("管理员桌面端进入管理首页", () => {
    const 用户 = 测试用户("/unified", ["/unified", "/admin", "/partner", "/mobile"]);
    expect(选择登录后路径(用户, { 移动访问: false })).toBe("/admin.html");
  });

  it("管理员移动端进入移动管理首页", () => {
    const 用户 = 测试用户("/admin/dashboard", ["/unified", "/admin", "/partner", "/mobile"]);
    expect(选择登录后路径(用户, { 移动访问: true })).toBe("/admin-mobile.html#/admin/home");
  });

  it("渠道账号桌面端进入渠道首页", () => {
    const 用户 = 测试用户("/partner/dashboard", ["/unified", "/partner", "/mobile"]);
    expect(选择登录后路径(用户, { 移动访问: false })).toBe("/partner.html");
  });

  it("渠道账号移动端进入移动渠道首页", () => {
    const 用户 = 测试用户("/partner/dashboard", ["/unified", "/partner", "/mobile"]);
    expect(选择登录后路径(用户, { 移动访问: true })).toBe("/partner-mobile.html#/partner/home");
  });

  it("只接受当前账号可进入的跳转地址", () => {
    const 用户 = 测试用户("/partner/dashboard", ["/unified", "/partner", "/mobile"]);
    expect(选择登录后路径(用户, { 移动访问: false, 候选路径: "/partner/quote" })).toBe(
      "/partner.html#/quote",
    );
    expect(选择登录后路径(用户, { 移动访问: false, 候选路径: "/admin/dashboard" })).toBe(
      "/partner.html",
    );
  });

  it("兼容旧工程化深链并转换为现有移动页面", () => {
    const 用户 = 测试用户("/admin/dashboard", ["/unified", "/admin", "/mobile"]);
    expect(
      选择登录后路径(用户, {
        移动访问: true,
        候选路径: "/mobile/admin/reviews?status=pending",
      }),
    ).toBe("/admin-mobile.html#/admin/reviews?status=pending");
  });

  it("允许当前角色直接跳转到现有页面深链", () => {
    const 用户 = 测试用户("/partner/dashboard", ["/unified", "/partner", "/mobile"]);
    expect(
      选择登录后路径(用户, {
        移动访问: false,
        候选路径: "/partner.html#/order",
      }),
    ).toBe("/partner.html#/order");
    expect(
      选择登录后路径(用户, {
        移动访问: false,
        候选路径: "/admin.html#/dashboard",
      }),
    ).toBe("/partner.html");
  });

  it("忽略外部跳转地址", () => {
    const 用户 = 测试用户("/admin/dashboard", ["/unified", "/admin", "/mobile"]);
    expect(选择登录后路径(用户, { 移动访问: false, 候选路径: "https://example.invalid" })).toBe(
      "/admin.html",
    );
  });

  it("只把四个现有页面识别为需要整页跳转的业务页面", () => {
    expect(是否业务页面路径("/admin.html#/dashboard")).toBe(true);
    expect(是否业务页面路径("/admin-mobile.html")).toBe(true);
    expect(是否业务页面路径("/partner.html")).toBe(true);
    expect(是否业务页面路径("/partner-mobile.html#/partner/home")).toBe(true);
    expect(是否业务页面路径("/admin/dashboard")).toBe(false);
    expect(是否业务页面路径("https://example.invalid/admin.html")).toBe(false);
  });
});
