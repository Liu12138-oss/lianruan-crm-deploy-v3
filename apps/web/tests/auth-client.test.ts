import { afterEach, describe, expect, it, vi } from "vitest";

import {
  单点登录,
  存在业务页面会话,
  校验页面会话有效,
  登录,
  读取单点登录配置,
} from "../src/api/auth-client.js";

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
    let 单点请求体文本 = "";
    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      单点请求体文本 = String(init?.body || "{}");
      return new Response(
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
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const 用户 = await 单点登录({ token: "sso-token", entry: "admin", clientType: "pc" });
    expect(用户.username).toBe("delivery_admin");
    expect(localStorage.getItem("admin_auth_token")).toBe("v2.admin.sso-token");
    const 请求体 = JSON.parse(单点请求体文本) as Record<string, unknown>;
    expect(请求体.entry).toBe("admin");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/sso/iam/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
  });

  it("统一单点登录无入口时不提交入口字段", async () => {
    let 单点请求体文本 = "";
    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      单点请求体文本 = String(init?.body || "{}");
      return new Response(
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
              token: "v2.partner.sso-token",
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
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await 单点登录({ token: "sso-token", entry: null, clientType: "mobile" });

    const 请求体 = JSON.parse(单点请求体文本) as Record<string, unknown>;
    expect(请求体).toEqual({ token: "sso-token", clientType: "mobile" });
    expect(localStorage.getItem("partner_auth_token")).toBe("v2.partner.sso-token");
  });

  it("可以提交UniSDP单点登录凭证", async () => {
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
                token: "v2.admin.unisdp-token",
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

    await 单点登录({ token: "unisdp-token", entry: null, clientType: "pc", provider: "unisdp" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/sso/unisdp/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    expect(localStorage.getItem("admin_auth_token")).toBe("v2.admin.unisdp-token");
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

  it("仅在本机存在页面会话令牌时判定为可恢复会话", () => {
    expect(存在业务页面会话()).toBe(false);
    localStorage.setItem("partner_auth_token", "v2.partner.token");
    expect(存在业务页面会话()).toBe(true);
  });

  it("后退缓存恢复时服务端会话失效会清理本地业务页面会话", async () => {
    localStorage.setItem("admin_auth_token", "expired-admin-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: false }), {
            status: 401,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    await expect(校验页面会话有效()).resolves.toBe(false);
    expect(localStorage.getItem("admin_auth_token")).toBeNull();
  });

  it("新标签页只有 Cookie 时通过服务端会话补写页面会话", async () => {
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
                  token: "v2.partner.cookie-recovered",
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

    expect(存在业务页面会话()).toBe(false);
    await expect(校验页面会话有效()).resolves.toBe(true);
    expect(localStorage.getItem("partner_auth_token")).toBe("v2.partner.cookie-recovered");
    expect(存在业务页面会话()).toBe(true);
  });

  it("同角色恢复会话不会先删除本页令牌，避免触发其他标签页退出", async () => {
    localStorage.setItem("partner_auth_token", "v2.partner.cookie-recovered");
    const 删除键: string[] = [];
    const 原始删除 = Storage.prototype.removeItem;
    const 监听 = (事件: StorageEvent) => {
      if (事件.key) 删除键.push(事件.key);
    };
    window.addEventListener("storage", 监听);
    Storage.prototype.removeItem = function (key: string) {
      删除键.push(key);
      return 原始删除.call(this, key);
    };

    try {
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
                    token: "v2.partner.cookie-recovered",
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

      await expect(校验页面会话有效()).resolves.toBe(true);
      expect(删除键).not.toContain("partner_auth_token");
      expect(localStorage.getItem("partner_auth_token")).toBe("v2.partner.cookie-recovered");
    } finally {
      window.removeEventListener("storage", 监听);
      Storage.prototype.removeItem = 原始删除;
    }
  });
});
