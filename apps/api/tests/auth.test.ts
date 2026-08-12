import type { 日志器, 日志字段 } from "@lianruan/shared";
import { 创建测试环境变量 } from "@lianruan/testing";
import { Pool } from "pg";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { 创建密码散列 } from "../src/auth-routes.js";
import { 读取IamH5单点登录配置 } from "../src/iam-sso.js";
import { 创建应用 } from "../src/index.js";
import type { 认证流程日志器 } from "../src/logger.js";
import { 读取UniSdp单点登录配置 } from "../src/unisdp-sso.js";

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

interface 捕获日志记录 {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  fields: 日志字段;
}

function 创建捕获日志器(): 日志器 & { records: 捕获日志记录[] } {
  const records: 捕获日志记录[] = [];
  const 创建实例 = (默认字段: 日志字段 = {}): 日志器 => ({
    debug: (message, fields) =>
      records.push({ level: "debug", message, fields: 合并日志字段(默认字段, fields) }),
    info: (message, fields) =>
      records.push({ level: "info", message, fields: 合并日志字段(默认字段, fields) }),
    warn: (message, fields) =>
      records.push({ level: "warn", message, fields: 合并日志字段(默认字段, fields) }),
    error: (message, fields) =>
      records.push({ level: "error", message, fields: 合并日志字段(默认字段, fields) }),
    child: (fields) => 创建实例(合并日志字段(默认字段, fields)),
    flush: () => Promise.resolve(),
  });
  return Object.assign(创建实例(), { records });
}

function 合并日志字段(默认字段: 日志字段, fields: 日志字段 | undefined): 日志字段 {
  return { ...默认字段, ...(fields || {}) };
}

function 创建捕获认证流程日志器(): 认证流程日志器 & { lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    write: (line) => lines.push(line),
    flush: () => Promise.resolve(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
    expect(login.body.data.mobileSession.token).toMatch(/^v3m\./);
    expect(login.body.data.pageSession.user.role).toBe("admin");

    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.data.user.username).toBe("delivery_admin");
    expect(me.body.data.pageSession.user.username).toBe("delivery_admin");
    expect(me.body.data.mobileSession.user.username).toBe("delivery_admin");
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

  it("账号密码登录日志包含诊断信息但不记录明文密码", async () => {
    const logger = 创建捕获日志器();
    const app = 创建应用({ env: 认证环境, logger });

    await request(app)
      .post("/api/auth/login")
      .send({ username: "delivery_admin", password: "LrCRM@2026!" })
      .expect(200);

    const 日志文本 = JSON.stringify(logger.records);
    const 开始事件 = logger.records.find((记录) => 记录.fields.event === "auth.password.started");
    const 成功事件 = logger.records.find((记录) => 记录.fields.event === "auth.password.succeeded");
    expect(开始事件?.fields.passwordFingerprint).toBeTruthy();
    expect(开始事件?.fields.passwordLength).toBe("LrCRM@2026!".length);
    expect(成功事件?.fields.sessionTokenFingerprint).toBeTruthy();
    expect(日志文本).not.toContain("LrCRM@2026!");
  });
});

describe("IAM单点登录成功流程", () => {
  it("IAM单点登录同时支持电脑和手机端", () => {
    const 配置 = 读取IamH5单点登录配置({});
    expect(配置.enabled).toBe(true);
    expect(配置.validateUrl).toBe("http://10.10.2.62:8192/emm-cgi/oidc/getUserFromSsoToken");
    expect(配置.validateIsaidByEntry.admin).toBe("QdCRMguanlyuan123");
    expect(配置.validateIsaidByEntry.partner).toBe("QdCRMguanlyuan123");
    expect(配置.requestIsaidByEntry.admin).toBe("QdCRMguanlyuan123");
    expect(配置.requestIsaidByEntry.partner).toBe("QdCRMguanlyuan123");
    expect(配置.timeoutMs).toBe(8000);
  });

  it("IAM单点登录成功后写入新版会话", async () => {
    const logger = 创建捕获日志器();
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
        V3_IAM_H5_SSO_PC_ENABLED: "true",
        V3_IAM_H5_SSO_VALIDATE_URL: "https://iam.example.test/validate",
        V3_IAM_H5_SSO_VALIDATE_ISAID: "crm-v3-test",
      }),
      logger,
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
    const 日志文本 = JSON.stringify(logger.records);
    const 开始事件 = logger.records.find((记录) => 记录.fields.event === "auth.iam_sso.started");
    const 成功事件 = logger.records.find((记录) => 记录.fields.event === "auth.iam_sso.succeeded");
    expect(开始事件?.fields.ssoTokenFingerprint).toBeTruthy();
    expect(开始事件?.fields.ssoTokenLength).toBe("sso-token-for-test".length);
    expect(成功事件?.fields.sessionTokenFingerprint).toBeTruthy();
    expect(日志文本).not.toContain("sso-token-for-test");
  });

  it("统一单点登录不带入口时按管理员账号自动识别入口", async () => {
    let 校验地址文本 = "";
    const fetchMock = vi.fn(async (input: unknown) => {
      校验地址文本 = String(input);
      return new Response(
        JSON.stringify({
          status: 2000,
          data: { mailuser: { username: "delivery_admin" } },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const app = 创建应用({
      env: 创建测试环境变量({
        ...认证环境,
        DATABASE_URL: "",
        V3_IAM_H5_SSO_ENABLED: "true",
        V3_IAM_H5_SSO_PC_ENABLED: "true",
        V3_IAM_H5_SSO_VALIDATE_URL: "https://iam.example.test/validate",
        V3_IAM_H5_SSO_VALIDATE_ISAID: "crm-v3-test",
      }),
    });

    const 登录 = await request(app)
      .post("/api/auth/sso/iam/login")
      .send({ token: "sso-token-for-test", clientType: "pc" })
      .expect(200);

    expect(登录.body.data.entry).toBe("admin");
    const 校验地址 = new URL(校验地址文本);
    expect(校验地址.searchParams.get("isaid")).toBe("crm-v3-test");
  });

  it("统一单点登录不带入口时按渠道账号自动识别入口", async () => {
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

    const 登录 = await request(app)
      .post("/api/auth/sso/iam/login")
      .send({ token: "sso-token-for-test", clientType: "mobile" })
      .expect(200);

    expect(登录.body.data.entry).toBe("partner");
    expect(登录.body.data.pageSession.user.role).toBe("staff");
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

  it("历史PC开关不会阻断IAM电脑端单点登录", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ status: 2000, data: { mailuser: { username: "delivery_admin" } } }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );
    const app = 创建应用({
      env: 创建测试环境变量({
        ...认证环境,
        DATABASE_URL: "",
        V3_IAM_H5_SSO_ENABLED: "true",
        V3_IAM_H5_SSO_PC_ENABLED: "false",
        V3_IAM_H5_SSO_VALIDATE_URL: "https://iam.example.test/validate",
        V3_IAM_H5_SSO_VALIDATE_ISAID: "crm-v3-test",
      }),
    });

    const res = await request(app)
      .post("/api/auth/sso/iam/login")
      .send({ token: "iam-pc-token", clientType: "pc" })
      .expect(200);

    expect(res.body.data.user.username).toBe("delivery_admin");
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
        V3_IAM_H5_SSO_PC_ENABLED: "true",
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
        V3_IAM_H5_SSO_PC_ENABLED: "true",
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

describe("UniSDP门户单点登录流程", () => {
  it("默认读取UniSDP单点登录配置", () => {
    const 配置 = 读取UniSdp单点登录配置({
      V3_UNISDP_SSO_ENABLED: "true",
    });
    expect(配置.enabled).toBe(true);
    expect(配置.validateUrl).toBe("https://portal.leagsoft.com/UniSSO/auth/sso_token.json");
    expect(配置.isaid).toBe("QdCRMguanlyuan123");
    expect(配置.timeoutMs).toBe(8000);
  });

  it("UniSDP JSON接口登录成功后写入新版会话", async () => {
    let 校验地址文本 = "";
    const logger = 创建捕获日志器();
    const authFlowLogger = 创建捕获认证流程日志器();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        校验地址文本 = String(input);
        return new Response(
          JSON.stringify({
            status: 2000,
            username: "delivery_admin",
            mobile: "13800138000",
            isLogin: true,
            errmsg: "ok",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );
    const app = 创建应用({
      env: 创建测试环境变量({
        ...认证环境,
        DATABASE_URL: "",
        V3_IAM_H5_SSO_ENABLED: "false",
        V3_UNISDP_SSO_ENABLED: "true",
        V3_UNISDP_SSO_VALIDATE_URL: "https://portal.example.test/UniSSO/auth/sso_token.json",
        V3_UNISDP_SSO_ISAID: "crm-unisdp-test",
      }),
      logger,
      authFlowLogger,
    });

    const agent = request.agent(app);
    const 登录 = await agent
      .post("/api/auth/sso/unisdp/login")
      .send({ sso_token: "unisdp-token-for-test" })
      .expect(200);

    expect(登录.body.data.provider).toBe("unisdp");
    expect(登录.body.data.user.username).toBe("delivery_admin");
    expect(登录.body.data.pageSession.token).toMatch(/^v2\./);
    expect(登录.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    const 校验地址 = new URL(校验地址文本);
    expect(校验地址.searchParams.get("sso_token")).toBe("unisdp-token-for-test");
    expect(校验地址.searchParams.get("isaid")).toBe("crm-unisdp-test");

    const 当前用户 = await agent.get("/api/auth/me").expect(200);
    expect(当前用户.body.data.user.username).toBe("delivery_admin");
    const 服务校验通过事件 = logger.records.find(
      (记录) => 记录.fields.event === "auth.unisdp_sso.provider_succeeded",
    );
    const 登录成功事件 = logger.records.find(
      (记录) => 记录.fields.event === "auth.unisdp_sso.succeeded",
    );
    const 日志文本 = JSON.stringify(logger.records);
    expect(服务校验通过事件?.fields.uniSdpMobilePresent).toBe(true);
    expect(服务校验通过事件?.fields.uniSdpMobileLength).toBe(11);
    expect(服务校验通过事件?.fields.uniSdpMobileMasked).toBe("138****8000");
    expect(服务校验通过事件?.fields.uniSdpMobileFingerprint).toBeTruthy();
    expect(登录成功事件?.fields.uniSdpMobilePresent).toBe(true);
    expect(日志文本).not.toContain("13800138000");

    const 摘要文本 = authFlowLogger.lines.join("\n");
    expect(摘要文本).toContain("[UNISDP-SSO] [全流程]");
    expect(摘要文本).toContain(
      "[认证服务校验通过] UniSDP返回账号：delivery_admin，手机号：138****8000",
    );
    expect(摘要文本).toContain("[登录成功] 本地账号：delivery_admin");
    expect(摘要文本).toContain('"requestId"');
    expect(摘要文本).not.toContain("unisdp-token-for-test");
    expect(摘要文本).not.toContain("13800138000");
  });

  it("UniSDP返回手机号用户名时优先匹配渠道账号手机号", async () => {
    const logger = 创建捕获日志器();
    const authFlowLogger = 创建捕获认证流程日志器();
    const 渠道用户行 = {
      id: "channel-user-001",
      v2_source_id: "channel-source-001",
      username: "channel_staff_001",
      display_name: "渠道销售账号",
      password_hash: 密码散列,
      role_code: "staff",
      role_name: "销售代表",
      region_name: "",
      extra_json: { phone: "13536920924", role: "staff", name: "渠道销售账号" },
      partner_id: "partner-001",
      partner_name: "测试渠道商",
    };
    vi.spyOn(Pool.prototype, "query").mockImplementation(async (...args: unknown[]) => {
      const params = args[1] as unknown[] | undefined;
      const 首个参数 = String(params?.[0] || "");
      if (首个参数 === "13536920924" || 首个参数 === "channel_staff_001") {
        return { rows: [渠道用户行] } as never;
      }
      return { rows: [] } as never;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: 2000,
              username: "13536920924",
              isLogin: true,
              errmsg: "ok",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );
    const app = 创建应用({
      env: 创建测试环境变量({
        ...认证环境,
        DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
        V3_IAM_H5_SSO_ENABLED: "false",
        V3_UNISDP_SSO_ENABLED: "true",
        V3_UNISDP_SSO_VALIDATE_URL: "https://portal.example.test/UniSSO/auth/sso_token.json",
        V3_UNISDP_SSO_ISAID: "crm-unisdp-test",
      }),
      logger,
      authFlowLogger,
    });

    const agent = request.agent(app);
    const 登录 = await agent
      .post("/api/auth/sso/unisdp/login")
      .send({ sso_token: "unisdp-token-for-channel" })
      .expect(200);

    expect(登录.body.data.user.username).toBe("channel_staff_001");
    expect(登录.body.data.entry).toBe("partner");
    expect(登录.body.data.pageSession.user.role).toBe("staff");
    const 当前用户 = await agent.get("/api/auth/me").expect(200);
    expect(当前用户.body.data.user.username).toBe("channel_staff_001");

    const 服务校验通过事件 = logger.records.find(
      (记录) => 记录.fields.event === "auth.unisdp_sso.provider_succeeded",
    );
    const 登录成功事件 = logger.records.find(
      (记录) => 记录.fields.event === "auth.unisdp_sso.succeeded",
    );
    const 日志文本 = JSON.stringify(logger.records);
    expect(服务校验通过事件?.fields.uniSdpUsernameLooksLikePhone).toBe(true);
    expect(服务校验通过事件?.fields.uniSdpUsername).toBe("135****0924");
    expect(服务校验通过事件?.fields.uniSdpUsernameFingerprint).toBeTruthy();
    expect(登录成功事件?.fields.uniSdpLocalUserMatchMode).toBe("partner_phone");
    expect(日志文本).not.toContain("13536920924");

    const 摘要文本 = authFlowLogger.lines.join("\n");
    expect(摘要文本).toContain("UniSDP返回账号：135****0924，手机号：未返回");
    expect(摘要文本).toContain('"uniSdpUsernameLooksLikePhone":true');
    expect(摘要文本).toContain('"ssoTokenFingerprint"');
    expect(摘要文本).not.toContain("unisdp-token-for-channel");
    expect(摘要文本).not.toContain("13536920924");
  });

  it("UniSDP门户表单登录成功后返回写入页面会话的过渡页", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: 2000,
              username: "delivery_admin",
              isLogin: true,
              errmsg: "ok",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );
    const app = 创建应用({
      env: 创建测试环境变量({
        ...认证环境,
        DATABASE_URL: "",
        V3_IAM_H5_SSO_ENABLED: "false",
        V3_UNISDP_SSO_ENABLED: "true",
        V3_UNISDP_SSO_VALIDATE_URL: "https://portal.example.test/UniSSO/auth/sso_token.json",
        V3_UNISDP_SSO_ISAID: "crm-unisdp-test",
      }),
    });

    const agent = request.agent(app);
    const 登录 = await agent
      .post("/app/sso.htm")
      .type("form")
      .send({ sso_token: "unisdp-token-for-test" })
      .expect(200);

    expect(登录.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(登录.text).toContain("正在完成 UniSDP 单点登录");
    expect(登录.text).toContain("admin_auth_token");
    expect(登录.text).toContain("/admin.html");

    const 当前用户 = await agent.get("/api/auth/me").expect(200);
    expect(当前用户.body.data.user.username).toBe("delivery_admin");
  });

  it("UniSDP门户表单登录失败时回到账密登录兜底", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: 6003,
              username: "",
              isLogin: false,
              errmsg: "invalid sso_token",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );
    const app = 创建应用({
      env: 创建测试环境变量({
        ...认证环境,
        DATABASE_URL: "",
        V3_IAM_H5_SSO_ENABLED: "false",
        V3_UNISDP_SSO_ENABLED: "true",
        V3_UNISDP_SSO_VALIDATE_URL: "https://portal.example.test/UniSSO/auth/sso_token.json",
        V3_UNISDP_SSO_ISAID: "crm-unisdp-test",
      }),
    });

    const res = await request(app)
      .post("/app/sso.htm")
      .type("form")
      .send({ sso_token: "bad-unisdp-token" })
      .expect(302);

    expect(res.headers.location).toBe("/login?ssoFallback=1&provider=unisdp");
  });

  it("UniSDP门户GET缺少凭证时回到账密登录兜底", async () => {
    const app = 创建应用({
      env: 创建测试环境变量({
        ...认证环境,
        DATABASE_URL: "",
        V3_IAM_H5_SSO_ENABLED: "false",
        V3_UNISDP_SSO_ENABLED: "true",
      }),
    });

    const res = await request(app).get("/app/sso.htm").expect(302);

    expect(res.headers.location).toBe("/login?ssoFallback=1&provider=unisdp");
  });
});
