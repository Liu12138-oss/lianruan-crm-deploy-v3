import { 创建构建信息 } from "@lianruan/shared";
import { 创建测试环境变量 } from "@lianruan/testing";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { 创建密码散列, 创建认证路由 } from "../src/auth-routes.js";
import { 创建目录同步路由 } from "../src/org-sync-routes.js";
import type { 目录同步数据服务 } from "../src/org-sync-store.js";
import { 请求编号中间件 } from "../src/request-context.js";

const 会话密钥 = "directory-sync-test-session-secret";
const 密码散列 = 创建密码散列("LrCRM@2026!", Buffer.from("0123456789abcdef"));
const 构建信息 = 创建构建信息({ V3_BUILD_VERSION: "test", V3_BUILD_COMMIT: "test" });

function 创建环境(开关 = true) {
  return 创建测试环境变量({
    V3_DELIVERY_AUTH_ENABLED: "true",
    V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
    V3_ORGANIZATION_ENABLED: 开关 ? "true" : "false",
    V3_DIRECTORY_SYNC_ENABLED: 开关 ? "true" : "false",
    V3_DELIVERY_AUTH_USERS_JSON: JSON.stringify([
      {
        username: "sync_admin",
        displayName: "同步管理员",
        roleName: "超级管理员",
        passwordHash: 密码散列,
        defaultPath: "/unified",
        allowedPaths: ["/unified", "/admin"],
      },
    ]),
  });
}

function 创建服务(): 目录同步数据服务 {
  return {
    查询状态: vi.fn(async () => ({
      connectors: [],
      latestRun: null,
      applyEnabled: false,
      mode: "readonly_preview",
    })),
    测试连接: vi.fn(async () => ({
      corpIdMatched: true,
      visibleDepartmentCount: 2,
      sampleMemberCount: 1,
      elapsedMs: 12,
      missingPermissions: [],
    })),
    创建只读预览: vi.fn(async () => ({
      id: "11111111-1111-4111-8111-111111111111",
      statusCode: "previewed",
      writeScope: "integration_only",
      applyEnabled: false,
    })),
    查询批次: vi.fn(async () => ({ items: [], page: 1, pageSize: 20, total: 0 })),
    查询批次详情: vi.fn(async (id: string) => ({ id, statusCode: "previewed" })),
    查询差异: vi.fn(async () => ({ items: [], page: 1, pageSize: 20, total: 0 })),
  };
}

function 创建测试应用(env: NodeJS.ProcessEnv, service: 目录同步数据服务) {
  const app = express();
  app.use(请求编号中间件);
  app.use(express.json());
  app.use("/api/auth", 创建认证路由({ build: 构建信息, sessionSecret: 会话密钥, env }));
  app.use(
    "/api/integrations/directory-sync",
    创建目录同步路由({ build: 构建信息, sessionSecret: 会话密钥, env, service }),
  );
  app.use(
    (
      error: { statusCode?: number; code?: string; message?: string },
      _req: unknown,
      res: express.Response,
      _next: unknown,
    ) => {
      res
        .status(error.statusCode || 500)
        .json({ success: false, error: { code: error.code, message: error.message } });
    },
  );
  return app;
}

async function 登录Cookie(app: express.Express): Promise<string> {
  const 登录 = await request(app)
    .post("/api/auth/login")
    .send({ username: "sync_admin", password: "LrCRM@2026!" })
    .expect(200);
  const cookie = 登录.headers["set-cookie"]?.[0];
  if (!cookie) throw new Error("登录未返回会话 Cookie");
  return cookie;
}

describe("企微组织同步只读路由", () => {
  it("只接受签名 Cookie 中的超级管理员身份", async () => {
    const app = 创建测试应用(创建环境(), 创建服务());
    await request(app).get("/api/integrations/directory-sync/status").expect(401);
    const cookie = await 登录Cookie(app);
    const response = await request(app)
      .get("/api/integrations/directory-sync/status")
      .set("Cookie", cookie)
      .expect(200);
    expect(response.body.data.enabled).toBe(true);
    expect(response.body.data.applyEnabled).toBe(false);
  });

  it("开关关闭时不调用数据服务，也不产生预览批次", async () => {
    const service = 创建服务();
    const app = 创建测试应用(创建环境(false), service);
    const cookie = await 登录Cookie(app);
    await request(app)
      .post("/api/integrations/directory-sync/preview")
      .set("Cookie", cookie)
      .send({})
      .expect(503);
    expect(service.创建只读预览).not.toHaveBeenCalled();
  });

  it("预览只委托只读服务，应用与暂停一律被拒绝", async () => {
    const service = 创建服务();
    const app = 创建测试应用(创建环境(), service);
    const cookie = await 登录Cookie(app);
    const preview = await request(app)
      .post("/api/integrations/directory-sync/preview")
      .set("Cookie", cookie)
      .send({})
      .expect(200);
    expect(preview.body.data.writeScope).toBe("integration_only");
    expect(service.创建只读预览).toHaveBeenCalledTimes(1);

    const runId = "11111111-1111-4111-8111-111111111111";
    const apply = await request(app)
      .post(`/api/integrations/directory-sync/runs/${runId}/apply`)
      .set("Cookie", cookie)
      .send({})
      .expect(409);
    expect(apply.body.error.code).toBe("DIRECTORY_SYNC_APPLY_DISABLED");
    const pause = await request(app)
      .post(`/api/integrations/directory-sync/runs/${runId}/pause`)
      .set("Cookie", cookie)
      .send({})
      .expect(409);
    expect(pause.body.error.code).toBe("DIRECTORY_SYNC_APPLY_DISABLED");
  });

  it("批次和差异查询会校验 UUID、风险与审批筛选条件", async () => {
    const service = 创建服务();
    const app = 创建测试应用(创建环境(), service);
    const cookie = await 登录Cookie(app);
    const runId = "11111111-1111-4111-8111-111111111111";
    await request(app)
      .get(`/api/integrations/directory-sync/runs/${runId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(service.查询批次详情).toHaveBeenCalledWith(runId);
    await request(app)
      .get(
        `/api/integrations/directory-sync/changes?runId=${runId}&riskLevel=high&approvalStatus=pending`,
      )
      .set("Cookie", cookie)
      .expect(200);
    await request(app)
      .get("/api/integrations/directory-sync/changes?riskLevel=unsafe")
      .set("Cookie", cookie)
      .expect(400);
  });
});
