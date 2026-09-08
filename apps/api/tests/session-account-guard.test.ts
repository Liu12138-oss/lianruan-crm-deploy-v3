import crypto from "node:crypto";

import { 创建测试环境变量 } from "@lianruan/testing";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { 创建密码散列 } from "../src/auth-routes.js";
import { 创建应用 } from "../src/index.js";
import type { 会话账号状态服务 } from "../src/session-account-guard.js";

const 密码 = "LrCRM@2026!";
const 密码散列 = 创建密码散列(密码, Buffer.from("0123456789abcdef"));
const 基础环境 = 创建测试环境变量({
  V3_DELIVERY_AUTH_ENABLED: "true",
  V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
  V3_ORGANIZATION_ENABLED: "true",
  V3_DELIVERY_AUTH_USERS_JSON: JSON.stringify([
    {
      username: "guard_admin",
      displayName: "会话防护管理员",
      roleName: "超级管理员",
      passwordHash: 密码散列,
      defaultPath: "/unified",
      allowedPaths: ["/unified", "/admin"],
    },
  ]),
});

async function 登录(app: ReturnType<typeof 创建应用>) {
  const 响应 = await request(app)
    .post("/api/auth/login")
    .send({ username: "guard_admin", password: 密码 })
    .expect(200);
  const cookie = 响应.headers["set-cookie"]?.[0];
  if (!cookie) throw new Error("登录未返回会话 Cookie。");
  return {
    cookie,
    页面令牌: 响应.body.data.pageSession.token as string,
    移动端令牌: 响应.body.data.mobileSession.token as string,
  };
}

function 创建状态服务(
  状态: { statusCode: string; offboardingStatus: string; authorizationVersion?: number } | null,
): 会话账号状态服务 {
  return { 查询账号状态: vi.fn(async () => 状态) };
}

function 签发测试Cookie会话(authorizationVersion: number): string {
  const body = Buffer.from(
    JSON.stringify({
      username: "guard_admin",
      role: "superadmin",
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      nonce: "test-cookie-nonce",
      authorizationVersion,
    }),
    "utf8",
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", 基础环境.SESSION_SECRET || "")
    .update(body)
    .digest("base64url");
  return `lianruan_crm_v3_session=${encodeURIComponent(`${body}.${signature}`)}`;
}

function 签发测试移动端会话(authorizationVersion: number): string {
  const body = Buffer.from(
    JSON.stringify({
      username: "guard_admin",
      role: "superadmin",
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      nonce: "test-mobile-nonce",
      authorizationVersion,
    }),
    "utf8",
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", 基础环境.SESSION_SECRET || "")
    .update(`v3m.${body}`)
    .digest("base64url");
  return `v3m.${body}.${signature}`;
}

function 签发测试正式页面令牌(authorizationVersion: number): string {
  return [
    "v2",
    Buffer.from("guard_admin", "utf8").toString("base64url"),
    String(authorizationVersion),
    "test-page-nonce",
  ].join(".");
}

function 创建角色管理假服务() {
  return {
    查询角色列表: vi.fn(async () => ({ items: [] })),
    查询角色用户: vi.fn(async () => ({ items: [], page: 1, pageSize: 20, total: 0 })),
    查询账号: vi.fn(async () => ({ items: [] })),
    新建角色: vi.fn(async () => ({})),
    更新角色: vi.fn(async () => ({})),
    更新角色状态: vi.fn(async () => ({})),
    查询权限字典: vi.fn(async () => ({ resources: [] })),
    查询用户角色: vi.fn(async () => ({ roleIds: [], roles: [] })),
    覆盖用户角色: vi.fn(async () => ({ roleIds: [], roles: [] })),
  };
}

describe("停用账号旧会话防护", () => {
  it("账号状态防护关闭时不查询账号状态且现有登录行为保持不变", async () => {
    const 服务 = 创建状态服务({ statusCode: "disabled", offboardingStatus: "offboarding" });
    const app = 创建应用({ env: 基础环境, sessionAccountStatusService: 服务 });
    const 会话 = await 登录(app);

    await request(app).get("/api/org/status").set("Cookie", 会话.cookie).expect(200);
    expect(服务.查询账号状态).not.toHaveBeenCalled();
  });

  it("停用账号的签名 Cookie、正式页面令牌和移动端令牌均立即返回401", async () => {
    const 服务 = 创建状态服务({ statusCode: "disabled", offboardingStatus: "offboarding" });
    const app = 创建应用({
      env: {
        ...基础环境,
        V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED: "true",
        V3_ORGANIZATION_OFFBOARDING_ENABLED: "true",
      },
      sessionAccountStatusService: 服务,
    });
    const 会话 = await 登录(app);

    const Cookie响应 = await request(app)
      .get("/api/org/status")
      .set("Cookie", 会话.cookie)
      .expect(401);
    expect(Cookie响应.body.error.code).toBe("V3_AUTH_ACCOUNT_DISABLED");

    const 页面响应 = await request(app)
      .get("/api/org/status")
      .set("Cookie", 会话.cookie)
      .set("Authorization", `Bearer ${会话.页面令牌}`)
      .expect(401);
    expect(页面响应.body.error.code).toBe("V3_AUTH_ACCOUNT_DISABLED");

    const 移动响应 = await request(app)
      .get("/api/org/status")
      .set("Authorization", `Bearer ${会话.移动端令牌}`)
      .expect(401);
    expect(移动响应.body.error.code).toBe("V3_AUTH_ACCOUNT_DISABLED");
  });

  it("有效账号不受影响，既有V2页面令牌继续校验账号状态，客户端自报身份仍被拒绝", async () => {
    const 服务 = 创建状态服务({ statusCode: "active", offboardingStatus: "active" });
    const app = 创建应用({
      env: {
        ...基础环境,
        V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED: "true",
        V3_ORGANIZATION_OFFBOARDING_ENABLED: "true",
      },
      sessionAccountStatusService: 服务,
    });
    const 会话 = await 登录(app);

    await request(app).get("/api/org/status").set("Cookie", 会话.cookie).expect(200);
    await request(app)
      .get("/api/v2/oauth/config")
      .set("Authorization", `Bearer ${会话.页面令牌}`)
      .expect(200);
    expect(服务.查询账号状态).toHaveBeenCalledWith("guard_admin");
    const 自报身份响应 = await request(app).get("/api/orders?operatorId=guard_admin").expect(401);
    expect(自报身份响应.body.error.code).toBe("V3_AUTH_TRUSTED_SESSION_REQUIRED");
  });

  it("停用防护不抢占开放接口的独立签名令牌鉴权链路", async () => {
    const 服务 = 创建状态服务({ statusCode: "active", offboardingStatus: "active" });
    const app = 创建应用({
      env: {
        ...基础环境,
        V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED: "true",
        V3_ORGANIZATION_OFFBOARDING_ENABLED: "true",
      },
      sessionAccountStatusService: 服务,
    });

    const 响应 = await request(app)
      .post("/api/open/v1/auth/token")
      .send({ appKey: "不存在", appSecret: "不存在", createdBy: "兼容字段" });

    expect(响应.body.error?.code).not.toBe("V3_AUTH_TRUSTED_SESSION_REQUIRED");
    expect(服务.查询账号状态).not.toHaveBeenCalled();
  });

  it("账号状态查询失败时稳定返回503，不允许失效开放", async () => {
    const 服务: 会话账号状态服务 = {
      查询账号状态: vi.fn(async () => {
        throw new Error("模拟数据库不可用");
      }),
    };
    const app = 创建应用({
      env: {
        ...基础环境,
        V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED: "true",
        V3_ORGANIZATION_OFFBOARDING_ENABLED: "true",
      },
      sessionAccountStatusService: 服务,
    });
    const 会话 = await 登录(app);

    const 响应 = await request(app).get("/api/org/status").set("Cookie", 会话.cookie).expect(503);
    expect(响应.body.error.code).toBe("V3_AUTH_ACCOUNT_CHECK_UNAVAILABLE");
  });

  it("角色、任职或归并导致授权版本变化后，Cookie、正式页面令牌和移动端令牌均立即失效", async () => {
    const 服务 = 创建状态服务({
      statusCode: "active",
      offboardingStatus: "active",
      authorizationVersion: 2,
    });
    const app = 创建应用({
      env: {
        ...基础环境,
        V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED: "true",
        V3_ORGANIZATION_OFFBOARDING_ENABLED: "true",
      },
      sessionAccountStatusService: 服务,
    });

    const Cookie响应 = await request(app)
      .get("/api/org/status")
      .set("Cookie", 签发测试Cookie会话(1))
      .expect(401);
    expect(Cookie响应.body.error.code).toBe("V3_AUTH_AUTHORIZATION_CHANGED");

    const 页面响应 = await request(app)
      .get("/api/v2/oauth/config")
      .set("Authorization", `Bearer ${签发测试正式页面令牌(1)}`)
      .expect(401);
    expect(页面响应.body.error.code).toBe("V3_AUTH_AUTHORIZATION_CHANGED");

    const 移动端响应 = await request(app)
      .get("/api/org/status")
      .set("Authorization", `Bearer ${签发测试移动端会话(1)}`)
      .expect(401);
    expect(移动端响应.body.error.code).toBe("V3_AUTH_AUTHORIZATION_CHANGED");
  });

  it("超级管理员角色被数据库移除后，旧 Cookie 访问组织和 RBAC 立即失效", async () => {
    const 服务 = 创建状态服务({ statusCode: "active", offboardingStatus: "active" });
    服务.查询账号角色 = vi.fn(async () => ({ roleCodes: [] }));
    const app = 创建应用({
      env: { ...基础环境, V3_ORGANIZATION_ENABLED: "true" },
      sessionAccountStatusService: 服务,
      rbacService: 创建角色管理假服务(),
      orgService: {
        查询组织树: vi.fn(async () => ({ items: [] })),
      } as never,
    });
    const 会话 = await 登录(app);

    const 组织响应 = await request(app)
      .get("/api/org/units/tree")
      .set("Cookie", 会话.cookie)
      .expect(401);
    expect(组织响应.body.error.code).toBe("V3_AUTH_ROLE_CHANGED");
    const 角色响应 = await request(app)
      .get("/api/rbac/roles")
      .set("Cookie", 会话.cookie)
      .expect(401);
    expect(角色响应.body.error.code).toBe("V3_AUTH_ROLE_CHANGED");
  });

  it("角色实时查询异常时拒绝高权限请求并返回503", async () => {
    const 服务 = 创建状态服务({ statusCode: "active", offboardingStatus: "active" });
    服务.查询账号角色 = vi.fn(async () => {
      throw new Error("模拟角色数据库不可用");
    });
    const app = 创建应用({
      env: { ...基础环境, V3_ORGANIZATION_ENABLED: "true" },
      sessionAccountStatusService: 服务,
      rbacService: 创建角色管理假服务(),
    });
    const 会话 = await 登录(app);

    const 响应 = await request(app).get("/api/rbac/roles").set("Cookie", 会话.cookie).expect(503);
    expect(响应.body.error.code).toBe("V3_AUTH_ROLE_CHECK_UNAVAILABLE");
  });

  it("关闭交接执行后账号状态防护仍可独立保持，停用账号旧会话不会恢复", async () => {
    const 服务 = 创建状态服务({ statusCode: "disabled", offboardingStatus: "offboarded" });
    const app = 创建应用({
      env: {
        ...基础环境,
        V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED: "true",
        V3_ORGANIZATION_OFFBOARDING_ENABLED: "false",
      },
      sessionAccountStatusService: 服务,
    });
    const 会话 = await 登录(app);

    const 响应 = await request(app).get("/api/org/status").set("Cookie", 会话.cookie).expect(401);
    expect(响应.body.error.code).toBe("V3_AUTH_ACCOUNT_DISABLED");
  });

  it("开启账号状态防护但未配置账号状态服务时应用拒绝启动", () => {
    expect(() =>
      创建应用({
        env: {
          ...基础环境,
          DATABASE_URL: "",
          V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED: "true",
        },
      }),
    ).toThrow("未配置账号状态检查数据库");
  });
});
