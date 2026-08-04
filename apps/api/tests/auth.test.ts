import { 创建测试环境变量 } from "@lianruan/testing";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { 创建密码散列 } from "../src/auth-routes.js";
import { 读取IamH5单点登录配置 } from "../src/iam-sso.js";
import { 创建应用 } from "../src/index.js";

const 密码散列 = 创建密码散列("LrCRM@2026!", Buffer.from("0123456789abcdef"));
const 认证环境 = 创建测试环境变量({
  V3_DELIVERY_AUTH_ENABLED: "true",
  V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
  V3_DELIVERY_AUTH_USERS_JSON: JSON.stringify([
    {
      username: "delivery_admin",
      displayName: "产品交付验收账号",
      roleName: "产品交付总监",
      passwordHash: 密码散列,
      defaultPath: "/unified",
      allowedPaths: ["/unified", "/admin", "/partner", "/mobile"],
    },
  ]),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("交付验收登录接口", () => {
  it("账号密码正确时签发会话并返回当前用户", async () => {
    const app = 创建应用({ env: 认证环境 });
    const agent = request.agent(app);
    const login = await agent
      .post("/api/auth/login")
      .send({ username: "delivery_admin", password: "LrCRM@2026!" })
      .expect(200);
    expect(login.body.success).toBe(true);
    expect(login.body.data.user.displayName).toBe("产品交付验收账号");
    expect(login.body.data.pageSession.token).toMatch(/^v2\./);
    expect(login.body.data.pageSession.user.role).toBe("admin");

    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.data.user.username).toBe("delivery_admin");
    expect(me.body.data.pageSession.user.username).toBe("delivery_admin");
  });

  it("密码错误时返回中文错误", async () => {
    const app = 创建应用({ env: 认证环境 });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "delivery_admin", password: "bad-password" })
      .expect(401);
    expect(res.body.error.message).toContain("用户名或密码不正确");
  });

  it("未登录读取当前用户时返回401", async () => {
    const app = 创建应用({ env: 认证环境 });
    const res = await request(app).get("/api/auth/me").expect(401);
    expect(res.body.error.message).toContain("请先登录");
  });
});

describe("IAM单点登录成功流程", () => {
  it("默认复用V2单点登录参数", () => {
    const 配置 = 读取IamH5单点登录配置({});
    expect(配置.enabled).toBe(true);
    expect(配置.validateUrl).toBe("http://10.10.2.62:8192/emm-cgi/oidc/getUserFromSsoToken");
    expect(配置.validateIsaidByEntry.admin).toBe("QudaoCrm123");
    expect(配置.validateIsaidByEntry.partner).toBe("QudaoCrm123");
    expect(配置.requestIsaidByEntry.admin).toBe("QdCRMguanlyuan123");
    expect(配置.requestIsaidByEntry.partner).toBe("QdCRMkeduduan123");
    expect(配置.timeoutMs).toBe(8000);
  });

  it("IAM单点登录成功后写入新版会话", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: 2000,
              data: {
                mailuser: {
                  username: "delivery_admin",
                  struserdes: "产品交付验收账号",
                  userid: "iam-001",
                },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );
    const app = 创建应用({
      env: 创建测试环境变量({
        ...认证环境,
        DATABASE_URL: "",
        V3_IAM_H5_SSO_ENABLED: "true",
        V3_IAM_H5_SSO_VALIDATE_URL: "https://iam.example.test/validate",
        V3_IAM_H5_SSO_VALIDATE_ISAID: "crm-v3-test",
      }),
    });
    const agent = request.agent(app);
    const 登录 = await agent
      .post("/api/auth/sso/iam/login")
      .send({ token: "sso-token-for-test", entry: "admin", clientType: "pc" })
      .expect(200);

    expect(登录.body.success).toBe(true);
    expect(登录.body.data.user.username).toBe("delivery_admin");
    expect(登录.body.data.pageSession.token).toMatch(/^v2\./);
    expect(登录.body.data.pageSession.user.role).toBe("admin");
    expect(登录.headers["set-cookie"]?.[0]).toContain("HttpOnly");

    const 当前用户 = await agent.get("/api/auth/me").expect(200);
    expect(当前用户.body.data.user.username).toBe("delivery_admin");
  });
});

describe("IAM单点登录失败场景", () => {
  it("IAM单点登录缺少凭证时返回中文错误", async () => {
    const app = 创建应用({ env: 认证环境 });
    const res = await request(app)
      .post("/api/auth/sso/iam/login")
      .send({ entry: "admin" })
      .expect(400);
    expect(res.body.error.message).toContain("缺少单点登录凭证");
  });

  it("IAM拒绝单点凭证时返回401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ status: 6042, msg: "凭证无效" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    const app = 创建应用({
      env: 创建测试环境变量({
        ...认证环境,
        DATABASE_URL: "",
        V3_IAM_H5_SSO_ENABLED: "true",
        V3_IAM_H5_SSO_VALIDATE_URL: "https://iam.example.test/validate",
        V3_IAM_H5_SSO_VALIDATE_ISAID: "crm-v3-test",
      }),
    });

    const res = await request(app)
      .post("/api/auth/sso/iam/login")
      .send({ token: "bad-sso-token", entry: "admin" })
      .expect(401);
    expect(res.body.error.message).toContain("单点凭证无效");
  });

  it("IAM账号未开通目标入口时拒绝登录", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: 2000,
              data: { mailuser: { username: "partner_only" } },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );
    const app = 创建应用({
      env: 创建测试环境变量({
        V3_DELIVERY_AUTH_ENABLED: "true",
        V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
        V3_DELIVERY_AUTH_USERS_JSON: JSON.stringify([
          {
            username: "partner_only",
            displayName: "渠道专用账号",
            roleName: "渠道用户",
            passwordHash: 密码散列,
            defaultPath: "/partner/dashboard",
            allowedPaths: ["/partner", "/mobile"],
          },
        ]),
        DATABASE_URL: "",
        V3_IAM_H5_SSO_ENABLED: "true",
        V3_IAM_H5_SSO_VALIDATE_URL: "https://iam.example.test/validate",
        V3_IAM_H5_SSO_VALIDATE_ISAID: "crm-v3-test",
      }),
    });

    const res = await request(app)
      .post("/api/auth/sso/iam/login")
      .send({ token: "sso-token-for-test", entry: "admin" })
      .expect(403);
    expect(res.body.error.message).toContain("未开通该单点登录入口");
  });
});
