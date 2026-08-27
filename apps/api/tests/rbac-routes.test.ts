import { 创建测试环境变量 } from "@lianruan/testing";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { 创建密码散列 } from "../src/auth-routes.js";
import { 创建应用 } from "../src/index.js";

const 密码散列 = 创建密码散列("LrCRM@2026!", Buffer.from("0123456789abcdef"));
const 测试环境变量 = 创建测试环境变量({
  V3_DELIVERY_AUTH_ENABLED: "true",
  V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
  V3_DELIVERY_AUTH_USERS_JSON: JSON.stringify([
    {
      username: "org_admin",
      displayName: "组织管理员",
      roleName: "超级管理员",
      passwordHash: 密码散列,
      defaultPath: "/unified",
      allowedPaths: ["/unified", "/admin"],
    },
    {
      username: "normal_admin",
      displayName: "普通管理员",
      roleName: "管理员",
      passwordHash: 密码散列,
      defaultPath: "/unified",
      allowedPaths: ["/unified", "/admin"],
    },
  ]),
});

if (!测试环境变量.DATABASE_URL) {
  throw new Error("RBAC接口测试必须配置 PostgreSQL DATABASE_URL，禁止回退内存模式。");
}

const 连接池 = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
const 测试超管用户名 = "rbac_test_admin_" + Date.now();
let 测试超管Id = "";

async function 登录Cookie(app: ReturnType<typeof 创建应用>, username: string): Promise<string> {
  const 登录 = await request(app)
    .post("/api/auth/login")
    .send({ username, password: "LrCRM@2026!" })
    .expect(200);
  const cookie = 登录.headers["set-cookie"]?.[0];
  if (!cookie) throw new Error("登录未返回会话 Cookie");
  return cookie;
}

beforeAll(async () => {
  const 用户 = await 连接池.query<{ id: string }>(
    `
    INSERT INTO iam.users (username, display_name, status_code)
    VALUES ($1, 'RBAC测试超管', 'active')
    ON CONFLICT (username) DO UPDATE SET status_code = 'active'
    RETURNING id::text AS id
    `,
    [测试超管用户名],
  );
  测试超管Id = 用户.rows[0]!.id;
  await 连接池.query(
    `
    INSERT INTO iam.password_credentials (user_id, password_hash, algorithm, must_change_password)
    VALUES ($1::uuid, $2, 'scrypt', false)
    ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `,
    [测试超管Id, 密码散列],
  );
  await 连接池.query(
    `
    INSERT INTO iam.user_roles (user_id, role_id)
    SELECT $1::uuid, id FROM iam.roles WHERE role_code = 'superadmin'
    ON CONFLICT DO NOTHING
    `,
    [测试超管Id],
  );
});

afterAll(async () => {
  await 连接池.query("DELETE FROM iam.user_roles WHERE user_id = $1::uuid", [测试超管Id]);
  await 连接池.query("DELETE FROM iam.password_credentials WHERE user_id = $1::uuid", [测试超管Id]);
  await 连接池.query("DELETE FROM iam.users WHERE id = $1::uuid", [测试超管Id]);
  await 连接池.end();
});

describe("RBAC 角色管理接口", () => {
  it("仅超级管理员可访问角色管理，普通管理员返回403", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 超管Cookie = await 登录Cookie(app, 测试超管用户名);
    const 角色列表 = await request(app)
      .get("/api/rbac/roles")
      .set("Cookie", 超管Cookie)
      .expect(200);
    expect(角色列表.body.success).toBe(true);
    const items = 角色列表.body.data.items as Array<{
      roleCode: string;
      isSystem: boolean;
      permissionCodes: string[];
    }>;
    expect(items.length).toBeGreaterThan(0);
    const 超管 = items.find((项) => 项.roleCode === "superadmin");
    expect(超管).toBeTruthy();
    expect(超管!.isSystem).toBe(true);
    expect((超管!.permissionCodes || []).length).toBeGreaterThan(0);

    const 普通Cookie = await 登录Cookie(app, "normal_admin");
    const 拒绝 = await request(app).get("/api/rbac/roles").set("Cookie", 普通Cookie).expect(403);
    expect(拒绝.body.error.code).toBe("RBAC_PERMISSION_DENIED");
  });

  it("权限字典包含组织架构、账号管理与拆分权限点", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 超管Cookie = await 登录Cookie(app, 测试超管用户名);
    const 字典 = await request(app)
      .get("/api/rbac/permissions")
      .set("Cookie", 超管Cookie)
      .expect(200);
    const 资源代码 = (字典.body.data.resources as Array<{ resourceCode: string }>).map(
      (项) => 项.resourceCode,
    );
    expect(资源代码).toContain("organization");
    expect(资源代码).toContain("account");
    expect(资源代码).toContain("order");
    expect(资源代码).toContain("report");
    const 订单资源 = (
      字典.body.data.resources as Array<{
        resourceCode: string;
        permissions: Array<{ permissionCode: string }>;
      }>
    ).find((项) => 项.resourceCode === "order");
    const 订单权限 = (订单资源?.permissions || []).map((项) => 项.permissionCode);
    expect(订单权限).toEqual(
      expect.arrayContaining(["order:read", "order:create", "order:edit", "order:delete"]),
    );
    const 全部权限 = (
      字典.body.data.resources as Array<{
        permissions: Array<{ permissionCode: string }>;
      }>
    ).flatMap((资源) => 资源.permissions.map((项) => 项.permissionCode));
    expect(全部权限.some((代码) => 代码.endsWith(":write"))).toBe(false);
  });

  it("新建/编辑/停用自定义角色，系统内置角色受保护", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 超管Cookie = await 登录Cookie(app, 测试超管用户名);
    const 名称 = "自动化测试角色" + Date.now();
    const 新建 = await request(app)
      .post("/api/rbac/roles")
      .set("Cookie", 超管Cookie)
      .send({
        roleName: 名称,
        description: "测试角色",
        permissionCodes: ["order:read", "organization:read"],
        scopes: [{ scopeType: "all" }],
      })
      .expect(200);
    const 角色Id = 新建.body.data.id as string;
    expect(角色Id).toBeTruthy();

    const 编辑 = await request(app)
      .put("/api/rbac/roles/" + 角色Id)
      .set("Cookie", 超管Cookie)
      .send({
        roleName: 名称 + "改",
        description: "测试角色改",
        permissionCodes: ["order:read", "order:create"],
        scopes: [{ scopeType: "self" }],
      })
      .expect(200);
    expect(编辑.body.data.permissionCodes).toEqual(
      expect.arrayContaining(["order:read", "order:create"]),
    );

    const 停用 = await request(app)
      .post("/api/rbac/roles/" + 角色Id + "/status")
      .set("Cookie", 超管Cookie)
      .send({ statusCode: "disabled" })
      .expect(200);
    expect(停用.body.data.statusCode).toBe("disabled");

    const 角色列表 = await request(app)
      .get("/api/rbac/roles")
      .set("Cookie", 超管Cookie)
      .expect(200);
    const 超管角色 = (角色列表.body.data.items as Array<{ id: string; roleCode: string }>).find(
      (项) => 项.roleCode === "superadmin",
    );
    const 系统保护 = await request(app)
      .put("/api/rbac/roles/" + 超管角色!.id)
      .set("Cookie", 超管Cookie)
      .send({ roleName: "改超管" })
      .expect(403);
    expect(系统保护.body.error.code).toBe("RBAC_SYSTEM_ROLE_PROTECTED");
    await request(app)
      .post("/api/rbac/roles/" + 超管角色!.id + "/status")
      .set("Cookie", 超管Cookie)
      .send({ statusCode: "disabled" })
      .expect(403);
  });

  it("用户角色分配：覆盖、清空与超级管理员角色保护", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 超管Cookie = await 登录Cookie(app, 测试超管用户名);
    const 用户 = await 连接池.query<{ id: string }>(
      "SELECT id::text AS id FROM iam.users WHERE status_code = 'active' ORDER BY created_at LIMIT 1",
    );
    if (!用户.rows[0]) throw new Error("测试库未找到可用账号。");
    const 用户Id = 用户.rows[0].id;

    const 名称 = "角色分配测试" + Date.now();
    const 新建 = await request(app)
      .post("/api/rbac/roles")
      .set("Cookie", 超管Cookie)
      .send({ roleName: 名称, permissionCodes: ["order:read"], scopes: [] })
      .expect(200);
    const 角色Id = 新建.body.data.id as string;

    const 原角色 = await request(app)
      .get("/api/rbac/users/" + 用户Id + "/roles")
      .set("Cookie", 超管Cookie)
      .expect(200);
    const 原角色Ids = (原角色.body.data.roleIds as string[]) || [];

    try {
      const 分配 = await request(app)
        .put("/api/rbac/users/" + 用户Id + "/roles")
        .set("Cookie", 超管Cookie)
        .send({ roleIds: [角色Id] })
        .expect(200);
      expect(分配.body.data.roleIds).toContain(角色Id);

      const 超管保护 = await request(app)
        .put("/api/rbac/users/" + 测试超管Id + "/roles")
        .set("Cookie", 超管Cookie)
        .send({ roleIds: [] })
        .expect(409);
      expect(超管保护.body.error.code).toBe("RBAC_SUPERADMIN_ROLE_PROTECTED");
    } finally {
      await request(app)
        .put("/api/rbac/users/" + 用户Id + "/roles")
        .set("Cookie", 超管Cookie)
        .send({ roleIds: 原角色Ids })
        .expect(200);
    }
  });

  it("角色用户与账号检索仅向超级管理员返回最小必要信息", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 超管Cookie = await 登录Cookie(app, 测试超管用户名);
    const 角色列表 = await request(app)
      .get("/api/rbac/roles")
      .set("Cookie", 超管Cookie)
      .expect(200);
    const 超管角色 = (角色列表.body.data.items as Array<{ id: string; roleCode: string }>).find(
      (项) => 项.roleCode === "superadmin",
    );
    if (!超管角色) throw new Error("测试库未找到超级管理员角色。");

    const 成员 = await request(app)
      .get(`/api/rbac/roles/${超管角色.id}/users?keyword=RBAC测试超管`)
      .set("Cookie", 超管Cookie)
      .expect(200);
    expect(成员.body.data.role).toMatchObject({ id: 超管角色.id, roleCode: "superadmin" });
    expect(成员.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 测试超管Id, username: 测试超管用户名 }),
      ]),
    );
    expect(成员.body.data.items[0]).not.toHaveProperty("passwordHash");
    expect(成员.body.data.items[0]).not.toHaveProperty("extraJson");

    const 账号 = await request(app)
      .get("/api/rbac/accounts?keyword=RBAC测试超管")
      .set("Cookie", 超管Cookie)
      .expect(200);
    expect(账号.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 测试超管Id, username: 测试超管用户名 }),
      ]),
    );
    expect(账号.body.data.items[0]).toHaveProperty("systemRoleCodes");
    expect(账号.body.data.items[0]).not.toHaveProperty("externalSubject");

    const 普通Cookie = await 登录Cookie(app, "normal_admin");
    await request(app)
      .get("/api/rbac/accounts?keyword=RBAC测试超管")
      .set("Cookie", 普通Cookie)
      .expect(403);
  });
});
