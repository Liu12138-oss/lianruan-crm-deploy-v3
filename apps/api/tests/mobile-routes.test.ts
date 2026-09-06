import { randomUUID } from "node:crypto";

import { 创建测试环境变量 } from "@lianruan/testing";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { 创建密码散列 } from "../src/auth-routes.js";
import { 创建应用 } from "../src/index.js";

describe("移动端业务接口", () => {
  const 环境变量 = 创建测试环境变量({
    V3_DELIVERY_AUTH_ENABLED: "true",
    V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
    V3_DELIVERY_AUTH_USERS_JSON: JSON.stringify([
      {
        username: "mobile_admin",
        displayName: "移动端管理员",
        roleName: "超级管理员",
        passwordHash: 创建密码散列("LrCRM@2026!", Buffer.from("0123456789abcdef")),
        defaultPath: "/admin",
        allowedPaths: ["/admin", "/mobile"],
      },
    ]),
  });

  async function 获取移动端令牌() {
    const app = 创建应用({ env: 环境变量 });
    const 登录 = await request(app)
      .post("/api/auth/login")
      .send({ username: "mobile_admin", password: "LrCRM@2026!" })
      .expect(200);
    return { app, token: 登录.body.data.mobileSession.token as string };
  }

  it("待审核入口映射到审核模块，且必须使用V3移动端令牌", async () => {
    const { app, token } = await 获取移动端令牌();

    const response = await request(app)
      .get("/api/mobile/pending-approvals?page=1&pageSize=20")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("数据");
    expect(response.body.data).toHaveProperty("分页");
  });

  it("移动端管理员可以读取商机列表", async () => {
    const { app, token } = await 获取移动端令牌();

    const response = await request(app)
      .get("/api/mobile/opportunities?page=1&pageSize=20")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("数据");
    expect(response.body.data).toHaveProperty("分页");
  });

  it("拒绝伪造的历史页面令牌", async () => {
    const app = 创建应用({ env: 环境变量 });

    const response = await request(app)
      .get("/api/mobile/registrations?page=1&pageSize=20")
      .set("Authorization", `Bearer v2.${Buffer.from("mobile_admin").toString("base64url")}.forged`)
      .expect(401);

    expect(response.body.error.code).toBe("V3_MOBILE_AUTH_REQUIRED");
  });

  it("相同幂等键的重复报备会回放首次结果", async () => {
    const { app, token } = await 获取移动端令牌();
    const 唯一后缀 = randomUUID();
    const 幂等键 = "mobile-registration-retry-" + 唯一后缀;
    const 客户名称 = "移动端幂等测试客户-" + 唯一后缀;
    const 请求体 = { customerName: 客户名称, contact: "测试联系人" };

    const 首次 = await request(app)
      .post("/api/mobile/registrations")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", 幂等键)
      .send(请求体)
      .expect(200);
    const 重试 = await request(app)
      .post("/api/mobile/registrations")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", 幂等键)
      .send(请求体)
      .expect(200);

    expect(重试.body.data).toEqual(首次.body.data);
    const 列表 = await request(app)
      .get("/api/mobile/registrations?page=1&pageSize=100&keyword=" + encodeURIComponent(客户名称))
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(列表.body.data.数据.filter((项: { 标题: string }) => 项.标题 === 客户名称)).toHaveLength(
      1,
    );
  });

  it("同一幂等键不能用于不同请求", async () => {
    const { app, token } = await 获取移动端令牌();
    const 幂等键 = "mobile-registration-conflict-001";

    await request(app)
      .post("/api/mobile/registrations")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", 幂等键)
      .send({ customerName: "移动端幂等冲突客户A" })
      .expect(200);
    const 冲突 = await request(app)
      .post("/api/mobile/registrations")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", 幂等键)
      .send({ customerName: "移动端幂等冲突客户B" })
      .expect(409);

    expect(冲突.body.error.code).toBe("V3_MOBILE_IDEMPOTENCY_CONFLICT");
  });

  it("渠道角色不能审核移动端报备", async () => {
    const 渠道环境变量 = 创建测试环境变量({
      V3_DELIVERY_AUTH_ENABLED: "true",
      V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
      V3_DELIVERY_AUTH_USERS_JSON: JSON.stringify([
        {
          username: "mobile_partner",
          displayName: "移动端渠道用户",
          roleName: "渠道用户",
          passwordHash: 创建密码散列("LrCRM@2026!", Buffer.from("0123456789abcdef")),
          defaultPath: "/partner",
          allowedPaths: ["/partner", "/mobile"],
        },
      ]),
    });
    const app = 创建应用({ env: 渠道环境变量 });
    const 登录 = await request(app)
      .post("/api/auth/login")
      .send({ username: "mobile_partner", password: "LrCRM@2026!" })
      .expect(200);

    const response = await request(app)
      .put("/api/mobile/registrations/REG-001/status")
      .set("Authorization", `Bearer ${登录.body.data.mobileSession.token as string}`)
      .set("Idempotency-Key", `mobile-partner-review-${Date.now()}`)
      .send({ status: "approved" })
      .expect(403);

    expect(response.body.error.code).toBe("V3_PERMISSION_DENIED");
  });

  it("管理员 Cookie 会话可以审核移动端报备", async () => {
    const app = 创建应用({ env: 环境变量 });
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ username: "mobile_admin", password: "LrCRM@2026!" })
      .expect(200);
    const 报备 = await agent
      .post("/api/mobile/registrations")
      .set("Idempotency-Key", `mobile-cookie-registration-${Date.now()}`)
      .send({ customerName: "移动端Cookie审核客户" })
      .expect(200);

    const 审核 = await agent
      .put(`/api/mobile/registrations/${报备.body.data.id}/status`)
      .set("Idempotency-Key", `mobile-cookie-review-${Date.now()}`)
      .send({ status: "approved" })
      .expect(200);

    expect(审核.body.data.状态).toBe("approved");
  });
});
