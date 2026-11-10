import { describe, expect, it } from "vitest";

import type { 登录用户 } from "../src/api/auth-client.js";
import {
  去除Sdp网关路径前缀,
  是否业务页面路径,
  是否跳过页面会话复核,
  选择登录后路径,
} from "../src/router/entry-target.js";

function 测试用户(defaultPath: string, allowedPaths: string[]): 登录用户 {
  return {
    username: "test",
    displayName: "测试用户",
    roleName: "测试角色",
    defaultPath,
    allowedPaths,
  };
}

describe("登录分流规则", () => {
  it("未登录时进入登录页", () => {
    expect(选择登录后路径(null, { 移动访问: false })).toBe("/login");
  });

  it("管理员桌面端进入管理首页", () => {
    const 用户 = 测试用户("/unified", ["/unified", "/admin", "/partner", "/mobile"]);
    expect(选择登录后路径(用户, { 移动访问: false })).toBe("/admin");
  });

  it("历史 unified 权限不再作为可访问页面", () => {
    const 用户 = 测试用户("/unified", ["/unified"]);
    expect(选择登录后路径(用户, { 移动访问: false })).toBe("/403");
    expect(选择登录后路径(用户, { 移动访问: false, 候选路径: "/unified" })).toBe("/403");
  });

  it("管理员移动端进入移动管理首页", () => {
    const 用户 = 测试用户("/admin/dashboard", ["/unified", "/admin", "/partner", "/mobile"]);
    expect(选择登录后路径(用户, { 移动访问: true })).toBe("/admin-mobile.html#/admin/home");
  });

  it("渠道账号桌面端进入渠道首页", () => {
    const 用户 = 测试用户("/partner/dashboard", ["/unified", "/partner", "/mobile"]);
    expect(选择登录后路径(用户, { 移动访问: false })).toBe("/partner");
  });

  it("渠道账号移动端进入移动渠道首页", () => {
    const 用户 = 测试用户("/partner/dashboard", ["/unified", "/partner", "/mobile"]);
    expect(选择登录后路径(用户, { 移动访问: true })).toBe("/partner-mobile.html#/partner/home");
  });

  it("只接受当前账号可进入的跳转地址", () => {
    const 用户 = 测试用户("/partner/dashboard", ["/unified", "/partner", "/mobile"]);
    expect(选择登录后路径(用户, { 移动访问: false, 候选路径: "/partner/quote" })).toBe(
      "/partner/quote",
    );
    expect(选择登录后路径(用户, { 移动访问: false, 候选路径: "/admin/dashboard" })).toBe(
      "/partner",
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
    ).toBe("/partner/order");
    expect(
      选择登录后路径(用户, {
        移动访问: false,
        候选路径: "/admin.html#/dashboard",
      }),
    ).toBe("/partner");
  });

  it("忽略外部跳转地址", () => {
    const 用户 = 测试用户("/admin/dashboard", ["/unified", "/admin", "/mobile"]);
    expect(选择登录后路径(用户, { 移动访问: false, 候选路径: "https://example.invalid" })).toBe(
      "/admin",
    );
  });

  it("识别新旧业务页面路径", () => {
    expect(是否业务页面路径("/admin.html#/dashboard")).toBe(true);
    expect(是否业务页面路径("/admin/dashboard")).toBe(true);
    expect(是否业务页面路径("/admin-mobile.html")).toBe(true);
    expect(是否业务页面路径("/partner.html")).toBe(true);
    expect(是否业务页面路径("/partner-mobile.html#/partner/home")).toBe(true);
    expect(是否业务页面路径("https://example.invalid/admin.html")).toBe(false);
  });

  it("单点登录回调页不执行全局会话复核", () => {
    expect(是否跳过页面会话复核("/login")).toBe(true);
    expect(是否跳过页面会话复核("/login/")).toBe(true);
    expect(是否跳过页面会话复核("/login/singlesignonlogin/login.do")).toBe(true);
    expect(是否跳过页面会话复核("/sso/iam")).toBe(true);
    expect(是否跳过页面会话复核("/sso/unisdp/")).toBe(true);
    expect(是否跳过页面会话复核("/admin")).toBe(false);
    expect(是否跳过页面会话复核("/partner")).toBe(false);
    expect(是否跳过页面会话复核("/be6f66a6ac593ee41cfd344d1f53fbf7/login")).toBe(true);
    expect(是否跳过页面会话复核("/be6f66a6ac593ee41cfd344d1f53fbf7/sso/unisdp")).toBe(true);
  });

  it("去除 SDP 网关 32 位应用前缀并保留业务路径", () => {
    const 应用编号 = "be6f66a6ac593ee41cfd344d1f53fbf7";
    expect(去除Sdp网关路径前缀(`/${应用编号}/login`)).toBe("/login");
    expect(去除Sdp网关路径前缀(`/${应用编号}/admin`)).toBe("/admin");
    expect(去除Sdp网关路径前缀(`/${应用编号}/partner/quote`)).toBe("/partner/quote");
    expect(去除Sdp网关路径前缀(`/${应用编号}`)).toBe("/");
    expect(去除Sdp网关路径前缀(`/${应用编号}/`)).toBe("/");
  });

  it("不误伤普通路径或非 32 位应用编号", () => {
    expect(去除Sdp网关路径前缀("/admin/organization")).toBe("/admin/organization");
    expect(去除Sdp网关路径前缀("/be6f66a6ac593ee41cfd344d1f53fbf7x/login")).toBe(
      "/be6f66a6ac593ee41cfd344d1f53fbf7x/login",
    );
    expect(去除Sdp网关路径前缀("/admin/be6f66a6ac593ee41cfd344d1f53fbf7/login")).toBe(
      "/admin/be6f66a6ac593ee41cfd344d1f53fbf7/login",
    );
  });
});
