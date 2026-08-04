import { afterEach, describe, expect, it, vi } from "vitest";

import { 单点登录, 登录, 读取单点登录配置 } from "../src/api/auth-client.js";

describe("认证接口客户端", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("账号密码登录后保存管理员业务页面会话", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              user: {
                username: "delivery_admin",
                displayName: "产品交付验收账号",
                roleName: "超级管理员",
                defaultPath: "/admin/dashboard",
                allowedPaths: ["/admin", "/mobile"],
              },
              pageSession: {
                token: "v2.admin.token",
                user: {
                  id: "admin-001",
                  userId: "admin-001",
                  username: "delivery_admin",
                  name: "产品交付验收账号",
                  displayName: "产品交付验收账号",
                  role: "superadmin",
                  roleName: "超级管理员",
                  status: "active",
                  region: "",
                  bigRegion: "",
                  partnerId: "",
                  partnerName: "",
                },
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await 登录({ username: "delivery_admin", password: "test-password" });

    expect(localStorage.getItem("admin_auth_token")).toBe("v2.admin.token");
    expect(JSON.parse(localStorage.getItem("admin_user_info") || "{}").role).toBe("superadmin");
    expect(localStorage.getItem("partner_auth_token")).toBeNull();
  });

  it("可以读取单点登录运行配置", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              data: {
                enabled: true,
                entries: ["admin", "partner"],
                requestIsaidByEntry: {
                  admin: "admin-isaid",
                  partner: "partner-isaid",
                },
                timeoutMs: 8000,
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    const 配置 = await 读取单点登录配置();
    expect(配置.enabled).toBe(true);
    expect(配置.requestIsaidByEntry.admin).toBe("admin-isaid");
  });

  it("可以提交单点登录凭证并返回用户", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              user: {
                username: "delivery_admin",
                displayName: "产品交付验收账号",
                roleName: "产品交付总监",
                defaultPath: "/admin/dashboard",
                allowedPaths: ["/admin"],
              },
              pageSession: {
                token: "v2.admin.sso-token",
                user: {
                  id: "admin-001",
                  userId: "admin-001",
                  username: "delivery_admin",
                  name: "产品交付验收账号",
                  displayName: "产品交付验收账号",
                  role: "admin",
                  roleName: "管理员",
                  status: "active",
                  region: "华东",
                  bigRegion: "东区",
                  partnerId: "",
                  partnerName: "",
                },
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const 用户 = await 单点登录({ token: "sso-token", entry: "admin", clientType: "pc" });
    expect(用户.username).toBe("delivery_admin");
    expect(localStorage.getItem("admin_auth_token")).toBe("v2.admin.sso-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/sso/iam/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
  });

  it("渠道登录会清理管理员页面会话并保存渠道页面会话", async () => {
    localStorage.setItem("admin_auth_token", "old-admin-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              data: {
                user: {
                  username: "partner_staff",
                  displayName: "渠道员工",
                  roleName: "渠道用户",
                  defaultPath: "/partner/dashboard",
                  allowedPaths: ["/partner", "/mobile"],
                },
                pageSession: {
                  token: "v2.partner.token",
                  user: {
                    id: "staff-001",
                    userId: "staff-001",
                    username: "partner_staff",
                    name: "渠道员工",
                    displayName: "渠道员工",
                    role: "staff",
                    roleName: "渠道用户",
                    status: "active",
                    region: "华南",
                    bigRegion: "南区",
                    partnerId: "partner-001",
                    partnerName: "测试渠道商",
                  },
                },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    await 登录({ username: "partner_staff", password: "test-password" });

    expect(localStorage.getItem("admin_auth_token")).toBeNull();
    expect(localStorage.getItem("partner_auth_token")).toBe("v2.partner.token");
    expect(JSON.parse(localStorage.getItem("partner_api_user") || "{}").user.partnerId).toBe(
      "partner-001",
    );
    expect(localStorage.getItem("api_user")).not.toBeNull();
  });

  it("缺少业务页面会话时阻止进入错误页面", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              data: {
                user: {
                  username: "delivery_admin",
                  displayName: "产品交付验收账号",
                  roleName: "管理员",
                  defaultPath: "/admin/dashboard",
                  allowedPaths: ["/admin"],
                },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    await expect(登录({ username: "delivery_admin", password: "test-password" })).rejects.toThrow(
      "登录响应缺少业务页面会话",
    );
  });
});
