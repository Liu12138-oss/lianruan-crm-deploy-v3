import { 创建测试环境变量 } from "@lianruan/testing";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { 创建密码散列 } from "../src/auth-routes.js";
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

    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.data.user.username).toBe("delivery_admin");
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
