import { 创建测试环境变量 } from "@lianruan/testing";
import { Pool } from "pg";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { 创建应用 } from "../src/index.js";

const 基础环境 = 创建测试环境变量({
  V3_DELIVERY_AUTH_ENABLED: "true",
  V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
  V3_DELIVERY_AUTH_USERS_JSON: "[]",
});

describe("MCP P0身份和开放接口安全门禁", () => {
  it("通用业务接口默认不信任V2令牌、兼容头和operatorId", async () => {
    const app = 创建应用({
      env: {
        ...基础环境,
        V3_BUSINESS_LEGACY_IDENTITY_ENABLED: "false",
      },
    });
    const v2令牌 = `Bearer v2.${Buffer.from("liulonghai", "utf8").toString("base64url")}.forged`;
    const 兼容头 = Buffer.from(
      JSON.stringify({
        username: "liulonghai",
        displayName: "伪造用户",
        roleName: "超级管理员",
      }),
      "utf8",
    ).toString("base64url");

    await request(app).get("/api/orders?operatorId=liulonghai").expect(401);
    await request(app).get("/api/orders").set("Authorization", v2令牌).expect(401);
    await request(app).get("/api/orders").set("x-v3-delivery-user", 兼容头).expect(401);
    await request(app).get("/api/orders").expect(401);

    const 产品 = await request(app).get("/api/products?pageSize=1").expect(200);
    expect(产品.body.success).toBe(true);
  });

  it("开放接口未配置资源时不回退为通配资源", async () => {
    const app = 创建应用({ env: 基础环境 });
    const pool = new Pool({ connectionString: 基础环境.DATABASE_URL });
    const 用户 = await pool.query<{ id: string }>(
      `
      SELECT u.id::text AS id
      FROM iam.users u
      JOIN iam.user_roles ur ON ur.user_id = u.id
      JOIN iam.roles r ON r.id = ur.role_id
      WHERE u.status_code = 'active' AND r.role_code = 'superadmin'
      ORDER BY u.created_at
      LIMIT 1
      `,
    );
    const boundUserId = 用户.rows[0]?.id;
    if (!boundUserId) throw new Error("未找到OpenAPI测试绑定用户。");

    const 创建 = await request(app)
      .post("/api/open-api/clients")
      .send({
        name: `P0无资源Client-${Date.now()}`,
        boundUserId,
        status: "active",
        ipWhitelist: [],
        allowedResources: [],
      })
      .expect(200);
    const 令牌 = await request(app)
      .post("/api/open/v1/auth/token")
      .send({ appKey: 创建.body.data.appKey, appSecret: 创建.body.data.appSecret })
      .expect(200);

    expect(令牌.body.data.allowedResources).toEqual([]);
    const 资源访问 = await request(app)
      .get("/api/open/v1/registrations?pageSize=1")
      .set("Authorization", `Bearer ${令牌.body.data.accessToken}`)
      .expect(403);
    expect(资源访问.body.success).toBe(false);
    await pool.end();
  });

  it("资源级数据范围绑定覆盖旧角色推断范围", async () => {
    const app = 创建应用({ env: 基础环境 });
    const pool = new Pool({ connectionString: 基础环境.DATABASE_URL });
    const 用户与伙伴 = await pool.query<{ user_id: string; partner_id: string }>(
      `
      SELECT u.id::text AS user_id, p.id::text AS partner_id
      FROM iam.users u
      JOIN iam.user_roles ur ON ur.user_id = u.id
      JOIN iam.roles r ON r.id = ur.role_id AND r.role_code = 'superadmin'
      JOIN channel.partners p ON p.status_code = 'active'
      WHERE u.status_code = 'active'
        AND (SELECT count(*) FROM crm.registrations reg WHERE reg.partner_id = p.id) > 0
        AND (SELECT count(*) FROM crm.registrations reg WHERE reg.partner_id = p.id) <
            (SELECT count(*) FROM crm.registrations)
      ORDER BY u.created_at, p.created_at
      LIMIT 1
      `,
    );
    const 行 = 用户与伙伴.rows[0];
    if (!行) throw new Error("未找到用于资源级范围验收的数据。");
    const 角色 = await pool.query<{ role_id: string }>(
      "SELECT role_id::text FROM iam.user_roles WHERE user_id = $1::uuid LIMIT 1",
      [行.user_id],
    );
    const roleId = 角色.rows[0]?.role_id;
    if (!roleId) throw new Error("未找到绑定用户角色。");

    const 绑定 = await pool.query<{ id: string }>(
      `
      INSERT INTO iam.data_scope_bindings(role_id, resource_code, scope_type, scope_ref_id)
      VALUES ($1::uuid, 'registration', 'partner', $2::uuid)
      RETURNING id::text AS id
      `,
      [roleId, 行.partner_id],
    );
    const bindingId = 绑定.rows[0]?.id;
    try {
      const 期望 = await pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM crm.registrations WHERE partner_id = $1::uuid",
        [行.partner_id],
      );
      const 创建 = await request(app)
        .post("/api/open-api/clients")
        .send({
          name: `P0数据范围Client-${Date.now()}`,
          boundUserId: 行.user_id,
          status: "active",
          ipWhitelist: [],
          allowedResources: ["registrations"],
        })
        .expect(200);
      const 令牌 = await request(app)
        .post("/api/open/v1/auth/token")
        .send({ appKey: 创建.body.data.appKey, appSecret: 创建.body.data.appSecret })
        .expect(200);
      const 查询 = await request(app)
        .get("/api/open/v1/registrations?pageSize=1")
        .set("Authorization", `Bearer ${令牌.body.data.accessToken}`)
        .expect(200);

      expect(String(查询.body.data.分页.总数)).toBe(期望.rows[0]?.count);
    } finally {
      if (bindingId)
        await pool.query("DELETE FROM iam.data_scope_bindings WHERE id = $1::uuid", [bindingId]);
      await pool.end();
    }
  });
});
