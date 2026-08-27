import { randomUUID } from "node:crypto";

import { 创建测试环境变量 } from "@lianruan/testing";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { 创建密码散列 } from "../src/auth-routes.js";
import { 创建应用 } from "../src/index.js";
import { 创建组织数据服务 } from "../src/org-store.js";

const 密码散列 = 创建密码散列("LrCRM@2026!", Buffer.from("0123456789abcdef"));
const 环境变量 = 创建测试环境变量({
  V3_DELIVERY_AUTH_ENABLED: "true",
  V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
  V3_ORGANIZATION_ENABLED: "true",
  V3_ORGANIZATION_WRITE_ENABLED: "true",
  V3_DELIVERY_AUTH_USERS_JSON: JSON.stringify([
    {
      username: "org_integration_admin",
      displayName: "组织集成测试超管",
      roleName: "超级管理员",
      passwordHash: 密码散列,
      defaultPath: "/unified",
      allowedPaths: ["/unified", "/admin"],
    },
  ]),
});

const 测试数据库地址 = 环境变量.DATABASE_URL;
if (!测试数据库地址) {
  throw new Error("组织集成测试必须配置 PostgreSQL DATABASE_URL。");
}

const 连接池 = new Pool({ connectionString: 测试数据库地址 });
const 前缀 = "r02_" + Date.now();
let 渠道商Id = "";
let 大区Id = "";
let 区域Id = "";
let 渠道成员Id = "";
let 渠道用户Id = "";
let 证书模板Id = "";
let 业务角色Id = "";

async function 登录Cookie(app: ReturnType<typeof 创建应用>): Promise<string> {
  const 登录 = await request(app)
    .post("/api/auth/login")
    .send({ username: "org_integration_admin", password: "LrCRM@2026!" })
    .expect(200);
  const cookie = 登录.headers["set-cookie"]?.[0];
  if (!cookie) throw new Error("登录未返回会话 Cookie");
  return cookie;
}

beforeAll(async () => {
  await 连接池.query(
    "INSERT INTO iam.users(username,display_name,status_code) VALUES('org_integration_admin','组织集成测试超管','active') ON CONFLICT (username) DO UPDATE SET status_code='active'",
  );
  const 超管 = await 连接池.query<{ id: string }>(
    "SELECT id::text AS id FROM iam.users WHERE username='org_integration_admin'",
  );
  await 连接池.query(
    "INSERT INTO iam.password_credentials(user_id,password_hash,algorithm,must_change_password) VALUES($1::uuid,$2,'scrypt',false) ON CONFLICT (user_id) DO UPDATE SET password_hash=EXCLUDED.password_hash",
    [超管.rows[0]!.id, 密码散列],
  );
  await 连接池.query(
    "INSERT INTO iam.user_roles(user_id,role_id) SELECT $1::uuid,id FROM iam.roles WHERE role_code='superadmin' ON CONFLICT DO NOTHING",
    [超管.rows[0]!.id],
  );
  const 大区 = await 连接池.query<{ id: string }>(
    "INSERT INTO org.regions(region_code,region_name,region_level) VALUES($1,'测试大区','big_region') RETURNING id::text AS id",
    [前缀 + "_big"],
  );
  大区Id = 大区.rows[0]!.id;
  const 区域 = await 连接池.query<{ id: string }>(
    "INSERT INTO org.regions(region_code,region_name,parent_region_id,region_level) VALUES($1,'测试区域',$2::uuid,'region') RETURNING id::text AS id",
    [前缀 + "_region", 大区Id],
  );
  区域Id = 区域.rows[0]!.id;
  const 渠道 = await 连接池.query<{ id: string }>(
    "INSERT INTO channel.partners(partner_code,partner_name,normalized_name,partner_level_code,region_id,status_code) VALUES($1,'测试渠道商',$1,'none',$2::uuid,'active') RETURNING id::text AS id",
    [前缀 + "_p", 区域Id],
  );
  渠道商Id = 渠道.rows[0]!.id;
  const 用户 = await 连接池.query<{ id: string }>(
    "INSERT INTO iam.users(username,display_name,status_code) VALUES($1,'测试渠道用户','active') RETURNING id::text AS id",
    [前缀 + "_user"],
  );
  渠道用户Id = 用户.rows[0]!.id;
  const 成员 = await 连接池.query<{ id: string }>(
    "INSERT INTO channel.partner_members(partner_id,user_id,member_role_code,status_code) VALUES($1::uuid,$2::uuid,'staff','active') RETURNING id::text AS id",
    [渠道商Id, 渠道用户Id],
  );
  渠道成员Id = 成员.rows[0]!.id;
  const 模板 = await 连接池.query<{ id: string }>(
    "INSERT INTO org.certification_templates(template_code,template_name,category,status_code) VALUES($1,'测试证书','test','active') RETURNING id::text AS id",
    [前缀 + "_cert"],
  );
  证书模板Id = 模板.rows[0]!.id;
  const 角色 = await 连接池.query<{ id: string }>(
    "INSERT INTO org.business_roles(role_code,role_name,domain_code,category,linked_certification_template_id) VALUES($1,'测试售前','channel','pre_sales',$2::uuid) RETURNING id::text AS id",
    [前缀 + "_role", 证书模板Id],
  );
  业务角色Id = 角色.rows[0]!.id;
});

afterAll(async () => {
  await 连接池
    .query("DELETE FROM org.member_business_roles WHERE id=$1::uuid", [业务角色Id])
    .catch(() => {});
  await 连接池
    .query("DELETE FROM org.member_certifications WHERE certification_template_id=$1::uuid", [
      证书模板Id,
    ])
    .catch(() => {});
  await 连接池
    .query("DELETE FROM org.business_roles WHERE id=$1::uuid", [业务角色Id])
    .catch(() => {});
  await 连接池
    .query("DELETE FROM org.certification_templates WHERE id=$1::uuid", [证书模板Id])
    .catch(() => {});
  await 连接池
    .query("DELETE FROM channel.partner_members WHERE id=$1::uuid", [渠道成员Id])
    .catch(() => {});
  await 连接池.query("DELETE FROM iam.users WHERE id=$1::uuid", [渠道用户Id]).catch(() => {});
  await 连接池.query("DELETE FROM channel.partners WHERE id=$1::uuid", [渠道商Id]).catch(() => {});
  await 连接池
    .query("DELETE FROM org.regions WHERE id IN ($1::uuid,$2::uuid)", [区域Id, 大区Id])
    .catch(() => {});
  const 超管 = await 连接池.query<{ id: string }>(
    "SELECT id::text AS id FROM iam.users WHERE username='org_integration_admin'",
  );
  if (超管.rows[0]) {
    await 连接池
      .query("DELETE FROM iam.user_roles WHERE user_id=$1::uuid", [超管.rows[0].id])
      .catch(() => {});
    await 连接池
      .query("DELETE FROM iam.password_credentials WHERE user_id=$1::uuid", [超管.rows[0].id])
      .catch(() => {});
    await 连接池
      .query("DELETE FROM iam.users WHERE id=$1::uuid", [超管.rows[0].id])
      .catch(() => {});
  }
  await 连接池.end();
});

describe("组织架构 R02 渠道组织与证书业务角色解耦", () => {
  it("历史账号固定禁止物理删除，账号、角色和登录凭据均保留", async () => {
    const 管理员 = await 连接池.query<{ id: string }>(
      `
      INSERT INTO iam.users(username,display_name,status_code)
      VALUES('admin','内置超级管理员','active')
      ON CONFLICT (username) DO UPDATE SET status_code='active'
      RETURNING id::text AS id
      `,
    );
    const 管理员Id = 管理员.rows[0]!.id;
    await 连接池.query(
      "INSERT INTO iam.user_roles(user_id,role_id) SELECT $1::uuid,id FROM iam.roles WHERE role_code='superadmin' ON CONFLICT DO NOTHING",
      [管理员Id],
    );

    const 待删除用户 = await 连接池.query<{ id: string }>(
      "INSERT INTO iam.users(username,display_name,status_code) VALUES($1,'待删除超级管理员','active') RETURNING id::text AS id",
      [前缀 + "_delete_superadmin"],
    );
    const 待删除用户Id = 待删除用户.rows[0]!.id;
    await 连接池.query(
      "INSERT INTO iam.password_credentials(user_id,password_hash,algorithm,must_change_password) VALUES($1::uuid,$2,'scrypt',false)",
      [待删除用户Id, 密码散列],
    );
    await 连接池.query(
      "INSERT INTO iam.user_roles(user_id,role_id) SELECT $1::uuid,id FROM iam.roles WHERE role_code='superadmin'",
      [待删除用户Id],
    );

    const 服务 = 创建组织数据服务({ databaseUrl: 测试数据库地址 });
    for (const username of ["org_integration_admin", "admin"]) {
      await expect(
        服务.删除用户(待删除用户Id, {
          username,
          requestId: 前缀 + "_physical_delete_disabled_" + username,
        }),
      ).rejects.toMatchObject({ code: "ORG_PHYSICAL_DELETE_DISABLED", statusCode: 409 });
    }
    const 清理结果 = await 连接池.query<{ 用户数: string; 角色数: string; 凭据数: string }>(
      `
      SELECT
        (SELECT count(*)::text FROM iam.users WHERE id=$1::uuid) AS "用户数",
        (SELECT count(*)::text FROM iam.user_roles WHERE user_id=$1::uuid) AS "角色数",
        (SELECT count(*)::text FROM iam.password_credentials WHERE user_id=$1::uuid) AS "凭据数"
      `,
      [待删除用户Id],
    );
    expect(清理结果.rows[0]).toEqual({ 用户数: "1", 角色数: "1", 凭据数: "1" });
  });

  it("渠道组织树成员携带所属渠道商名称", async () => {
    const app = 创建应用({ env: 环境变量 });
    const cookie = await 登录Cookie(app);
    const 树 = await request(app).get("/api/org/channel-tree").set("Cookie", cookie).expect(200);
    const 序列化 = JSON.stringify(树.body.data);
    expect(序列化).toContain("测试渠道商");
    expect(序列化).toContain(前缀 + "_p");
    expect(序列化).toContain("测试渠道用户");
  });

  it("真实 PostgreSQL 可读取渠道统一成员档案", async () => {
    const app = 创建应用({ env: 环境变量 });
    const cookie = await 登录Cookie(app);
    const 档案 = await request(app)
      .get("/api/org/channel-members/" + 渠道成员Id + "/profile")
      .set("Cookie", cookie)
      .expect(200);

    expect(档案.body.data).toMatchObject({
      id: 渠道成员Id,
      userId: 渠道用户Id,
      partnerId: 渠道商Id,
      partnerName: "测试渠道商",
      name: "测试渠道用户",
      businessRoleCode: "channel_sales",
    });
    expect(档案.body.data.certificationTemplates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 证书模板Id, templateName: "测试证书" }),
      ]),
    );
  });

  it("区域可编辑名称与父级（防环）", async () => {
    const app = 创建应用({ env: 环境变量 });
    const cookie = await 登录Cookie(app);
    const 更新 = await request(app)
      .put("/api/org/regions/" + 区域Id)
      .set("Cookie", cookie)
      .send({ regionName: "测试区域-改名", rowVersion: 1 })
      .expect(200);
    expect(更新.body.data.regionName).toBe("测试区域-改名");

    const 环 = await request(app)
      .put("/api/org/regions/" + 大区Id)
      .set("Cookie", cookie)
      .send({ parentRegionId: 区域Id, rowVersion: 1 })
      .expect(409);
    expect(环.body.error.code).toBe("ORG_REGION_PARENT_INVALID");
  });

  it("无岗位内部任职可调整到其他部门并执行行版本校验", async () => {
    const 用户 = await 连接池.query<{ id: string }>(
      "INSERT INTO iam.users(username,display_name,status_code) VALUES($1,'内部调岗测试用户','active') RETURNING id::text AS id",
      [前缀 + "_assignment_user"],
    );
    const 用户Id = 用户.rows[0]!.id;
    const 部门一 = await 连接池.query<{ id: string }>(
      "INSERT INTO org.org_units(unit_code,unit_name,unit_type,status_code) VALUES($1,'内部部门一','department','active') RETURNING id::text AS id",
      [前缀 + "_assignment_unit_1"],
    );
    const 部门二 = await 连接池.query<{ id: string }>(
      "INSERT INTO org.org_units(unit_code,unit_name,unit_type,status_code) VALUES($1,'内部部门二','department','active') RETURNING id::text AS id",
      [前缀 + "_assignment_unit_2"],
    );
    const 任职 = await 连接池.query<{ id: string }>(
      "INSERT INTO org.staff_assignments(user_id,org_unit_id,position_id,is_primary) VALUES($1::uuid,$2::uuid,NULL,true) RETURNING id::text AS id",
      [用户Id, 部门一.rows[0]!.id],
    );
    const app = 创建应用({ env: 环境变量 });
    const cookie = await 登录Cookie(app);

    try {
      const 更新 = await request(app)
        .put("/api/org/assignments/" + 任职.rows[0]!.id)
        .set("Cookie", cookie)
        .set("Idempotency-Key", 前缀 + "_assignment_update")
        .send({ orgUnitId: 部门二.rows[0]!.id, isPrimary: true, rowVersion: 1 })
        .expect(200);
      expect(更新.body.data).toMatchObject({
        orgUnitId: 部门二.rows[0]!.id,
        positionId: null,
        isPrimary: true,
        rowVersion: 2,
      });

      const 过期版本 = await request(app)
        .put("/api/org/assignments/" + 任职.rows[0]!.id)
        .set("Cookie", cookie)
        .send({ orgUnitId: 部门一.rows[0]!.id, isPrimary: true, rowVersion: 1 })
        .expect(409);
      expect(过期版本.body.error.code).toBe("ORG_VERSION_CONFLICT");
    } finally {
      await 连接池.query("DELETE FROM org.staff_assignments WHERE id=$1::uuid", [任职.rows[0]!.id]);
      await 连接池.query("DELETE FROM iam.users WHERE id=$1::uuid", [用户Id]);
      await 连接池.query("DELETE FROM org.org_units WHERE id IN ($1::uuid,$2::uuid)", [
        部门一.rows[0]!.id,
        部门二.rows[0]!.id,
      ]);
    }
  });

  it("数据库约束触发器拒绝任职部门与岗位归属不一致", async () => {
    const 后缀 = randomUUID();
    const 用户 = await 连接池.query<{ id: string }>(
      "INSERT INTO iam.users(username,display_name,status_code) VALUES($1,'任职一致性测试用户','active') RETURNING id::text AS id",
      [前缀 + "_assignment_trigger_" + 后缀],
    );
    const 部门一 = await 连接池.query<{ id: string }>(
      "INSERT INTO org.org_units(unit_code,unit_name,unit_type,status_code) VALUES($1,'任职一致性部门一','department','active') RETURNING id::text AS id",
      [前缀 + "_assignment_trigger_unit_1_" + 后缀],
    );
    const 部门二 = await 连接池.query<{ id: string }>(
      "INSERT INTO org.org_units(unit_code,unit_name,unit_type,status_code) VALUES($1,'任职一致性部门二','department','active') RETURNING id::text AS id",
      [前缀 + "_assignment_trigger_unit_2_" + 后缀],
    );
    const 岗位 = await 连接池.query<{ id: string }>(
      "INSERT INTO org.positions(org_unit_id,position_code,position_name,status_code) VALUES($1::uuid,$2,'任职一致性岗位','active') RETURNING id::text AS id",
      [部门一.rows[0]!.id, 前缀 + "_assignment_trigger_position_" + 后缀],
    );
    const 客户端 = await 连接池.connect();

    try {
      await 客户端.query("BEGIN");
      await 客户端.query(
        "INSERT INTO org.staff_assignments(user_id,org_unit_id,position_id,is_primary) VALUES($1::uuid,$2::uuid,$3::uuid,true)",
        [用户.rows[0]!.id, 部门二.rows[0]!.id, 岗位.rows[0]!.id],
      );
      await expect(客户端.query("COMMIT")).rejects.toMatchObject({ code: "23514" });
    } finally {
      await 客户端.query("ROLLBACK").catch(() => undefined);
      客户端.release();
      await 连接池.query("DELETE FROM org.positions WHERE id=$1::uuid", [岗位.rows[0]!.id]);
      await 连接池.query("DELETE FROM org.org_units WHERE id IN ($1::uuid,$2::uuid)", [
        部门一.rows[0]!.id,
        部门二.rows[0]!.id,
      ]);
      await 连接池.query("DELETE FROM iam.users WHERE id=$1::uuid", [用户.rows[0]!.id]);
    }
  });

  it("两个事务并发颁发同一证书时数据库只保留一份有效证书", async () => {
    const 后缀 = randomUUID();
    const 模板 = await 连接池.query<{ id: string }>(
      "INSERT INTO org.certification_templates(template_code,template_name,category,status_code) VALUES($1,'并发证书测试','test','active') RETURNING id::text AS id",
      [前缀 + "_concurrent_cert_" + 后缀],
    );
    const 客户端一 = await 连接池.connect();
    const 客户端二 = await 连接池.connect();
    const 颁发语句 = `INSERT INTO org.member_certifications(
      user_id,certification_template_id,issued_on,status_code
    ) VALUES($1::uuid,$2::uuid,current_date,'active')`;

    try {
      await Promise.all([客户端一.query("BEGIN"), 客户端二.query("BEGIN")]);
      await 客户端一.query(颁发语句, [渠道用户Id, 模板.rows[0]!.id]);
      const 第二次颁发 = 客户端二
        .query(颁发语句, [渠道用户Id, 模板.rows[0]!.id])
        .then(() => null)
        .catch((错误: unknown) => 错误);
      await 客户端一.query("COMMIT");
      const 并发错误 = await 第二次颁发;
      expect(并发错误).toMatchObject({ code: "23505" });
      await 客户端二.query("ROLLBACK");

      const 有效证书 = await 连接池.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM org.member_certifications
         WHERE user_id=$1::uuid AND certification_template_id=$2::uuid AND status_code='active'`,
        [渠道用户Id, 模板.rows[0]!.id],
      );
      expect(有效证书.rows[0]!.count).toBe(1);
    } finally {
      await 客户端一.query("ROLLBACK").catch(() => undefined);
      await 客户端二.query("ROLLBACK").catch(() => undefined);
      客户端一.release();
      客户端二.release();
      await 连接池.query(
        "DELETE FROM org.member_certifications WHERE certification_template_id=$1::uuid",
        [模板.rows[0]!.id],
      );
      await 连接池.query("DELETE FROM org.certification_templates WHERE id=$1::uuid", [
        模板.rows[0]!.id,
      ]);
    }
  });

  it("停用超管前保存完整角色快照，只允许其他有效超管接收且不改审批历史", async () => {
    const 后缀 = randomUUID();
    const 用户 = async (标识: string, 姓名: string) =>
      连接池.query<{ id: string }>(
        "INSERT INTO iam.users(username,display_name,status_code,region_id,offboarding_status) VALUES($1,$2,'active',$3::uuid,'active') RETURNING id::text AS id",
        [前缀 + "_" + 标识 + "_" + 后缀, 姓名, 区域Id],
      );
    const 目标 = await 用户("offboarding_target", "待停用超级管理员");
    const 超管接收人 = await 用户("offboarding_superadmin", "接收超级管理员");
    const 区管候选 = await 用户("offboarding_region", "同区域区管");
    const 目标Id = 目标.rows[0]!.id;
    const 超管接收人Id = 超管接收人.rows[0]!.id;
    const 区管候选Id = 区管候选.rows[0]!.id;
    await 连接池.query(
      `INSERT INTO iam.user_roles(user_id,role_id)
       SELECT $1::uuid,id FROM iam.roles WHERE role_code IN ('superadmin','region_manager')`,
      [目标Id],
    );
    await 连接池.query(
      "INSERT INTO iam.user_roles(user_id,role_id) SELECT $1::uuid,id FROM iam.roles WHERE role_code='superadmin'",
      [超管接收人Id],
    );
    await 连接池.query(
      "INSERT INTO iam.user_roles(user_id,role_id) SELECT $1::uuid,id FROM iam.roles WHERE role_code='region_manager'",
      [区管候选Id],
    );
    const 角色原值 = await 连接池.query<{ id: string; roleCode: string; roleName: string }>(
      `SELECT r.id::text AS id,r.role_code AS "roleCode",r.role_name AS "roleName"
       FROM iam.user_roles ur JOIN iam.roles r ON r.id=ur.role_id
       WHERE ur.user_id=$1::uuid ORDER BY r.role_code`,
      [目标Id],
    );
    const 审批 = await 连接池.query<{ id: string }>(
      `INSERT INTO ops.approvals(
        approval_type_code,target_type,target_id,applicant_user_id,status_code,extra_json
      ) VALUES('organization-test','organization-test',$1::uuid,$1::uuid,'pending',$2::jsonb)
      RETURNING id::text AS id`,
      [目标Id, JSON.stringify({ testRun: 后缀 })],
    );
    const 服务 = 创建组织数据服务({ databaseUrl: 测试数据库地址 });
    let 交接单Id = "";

    try {
      const 预览 = (await 服务.预览离职影响(目标Id)) as {
        candidates: Array<{ id: string }>;
        requiresReplacement: boolean;
      };
      expect(预览.requiresReplacement).toBe(true);
      expect(预览.candidates.some((候选) => 候选.id === 超管接收人Id)).toBe(true);
      expect(预览.candidates.some((候选) => 候选.id === 区管候选Id)).toBe(false);

      const 结果 = (await 服务.发起离职交接(
        {
          userId: 目标Id,
          replacementUserId: 超管接收人Id,
          effectiveAt: new Date().toISOString(),
          reason: "超级管理员停用交接真实数据库验收",
          confirmationUsername: 前缀 + "_offboarding_target_" + 后缀,
        },
        {
          username: "org_integration_admin",
          requestId: 前缀 + "_offboarding_role_snapshot_" + 后缀,
          role: "superadmin",
        },
      )) as { id: string };
      交接单Id = 结果.id;

      const 运行时角色 = await 连接池.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM iam.user_roles WHERE user_id=$1::uuid",
        [目标Id],
      );
      expect(运行时角色.rows[0]!.count).toBe(0);
      const 快照 = await 连接池.query<{ id: string; roleCode: string; roleName: string }>(
        `SELECT role_id::text AS id,role_code AS "roleCode",role_name AS "roleName"
         FROM org.offboarding_role_snapshots WHERE handover_id=$1::uuid ORDER BY role_code`,
        [交接单Id],
      );
      expect(快照.rows).toEqual(角色原值.rows);
      const 账号状态 = await 连接池.query<{ statusCode: string; offboardingStatus: string }>(
        `SELECT status_code AS "statusCode",offboarding_status AS "offboardingStatus"
         FROM iam.users WHERE id=$1::uuid`,
        [目标Id],
      );
      expect(账号状态.rows[0]).toEqual({
        statusCode: "disabled",
        offboardingStatus: "offboarding",
      });
      const 审批历史 = await 连接池.query<{ applicantUserId: string; statusCode: string }>(
        `SELECT applicant_user_id::text AS "applicantUserId",status_code AS "statusCode"
         FROM ops.approvals WHERE id=$1::uuid`,
        [审批.rows[0]!.id],
      );
      expect(审批历史.rows[0]).toEqual({ applicantUserId: 目标Id, statusCode: "pending" });
    } finally {
      await 连接池.query("DELETE FROM ops.approvals WHERE id=$1::uuid", [审批.rows[0]!.id]);
      if (交接单Id) {
        await 连接池.query("DELETE FROM ops.outbox_events WHERE aggregate_id=$1::uuid", [交接单Id]);
        await 连接池.query("DELETE FROM audit.audit_logs WHERE target_id=$1", [交接单Id]);
        await 连接池.query("UPDATE iam.users SET offboarding_handover_id=NULL WHERE id=$1::uuid", [
          目标Id,
        ]);
        await 连接池.query("DELETE FROM org.offboarding_handover WHERE id=$1::uuid", [交接单Id]);
      }
      await 连接池.query("DELETE FROM iam.user_roles WHERE user_id=ANY($1::uuid[])", [
        [超管接收人Id, 区管候选Id],
      ]);
      await 连接池.query("DELETE FROM iam.users WHERE id=ANY($1::uuid[])", [
        [目标Id, 超管接收人Id, 区管候选Id],
      ]);
    }
  });

  it("已停用账号或无有效成员关系的账号不能颁发证书", async () => {
    const 已停用 = await 连接池.query<{ id: string }>(
      "INSERT INTO iam.users(username,display_name,status_code) VALUES($1,'已停用证书测试用户','disabled') RETURNING id::text AS id",
      [前缀 + "_disabled_cert_user"],
    );
    const 无成员关系 = await 连接池.query<{ id: string }>(
      "INSERT INTO iam.users(username,display_name,status_code) VALUES($1,'无成员关系证书测试用户','active') RETURNING id::text AS id",
      [前缀 + "_no_membership_cert_user"],
    );
    const app = 创建应用({ env: 环境变量 });
    const cookie = await 登录Cookie(app);

    try {
      const 已停用响应 = await request(app)
        .post("/api/org/users/" + 已停用.rows[0]!.id + "/certifications")
        .set("Cookie", cookie)
        .send({ certificationTemplateId: 证书模板Id, issuedOn: "2026-08-27" })
        .expect(409);
      expect(已停用响应.body.error.code).toBe("ORG_CERTIFICATION_MEMBER_INACTIVE");

      const 无成员响应 = await request(app)
        .post("/api/org/users/" + 无成员关系.rows[0]!.id + "/certifications")
        .set("Cookie", cookie)
        .send({ certificationTemplateId: 证书模板Id, issuedOn: "2026-08-27" })
        .expect(409);
      expect(无成员响应.body.error.code).toBe("ORG_CERTIFICATION_MEMBERSHIP_REQUIRED");
    } finally {
      await 连接池.query("DELETE FROM iam.users WHERE id IN ($1::uuid,$2::uuid)", [
        已停用.rows[0]!.id,
        无成员关系.rows[0]!.id,
      ]);
    }
  });

  it("颁发和撤销证书均不自动改变业务角色", async () => {
    const app = 创建应用({ env: 环境变量 });
    const cookie = await 登录Cookie(app);
    const 颁发前角色 = await request(app)
      .get("/api/org/member-business-roles?partnerMemberId=" + 渠道成员Id)
      .set("Cookie", cookie)
      .expect(200);
    const 颁发前有效数量 = (颁发前角色.body.data.items as Array<Record<string, unknown>>).filter(
      (项) => 项.businessRoleId === 业务角色Id && !项.expiredAt,
    ).length;
    const 颁发 = await request(app)
      .post("/api/org/users/" + 渠道用户Id + "/certifications")
      .set("Cookie", cookie)
      .send({
        certificationTemplateId: 证书模板Id,
        issuedOn: "2026-08-21",
      })
      .expect(200);
    const 证书Id = 颁发.body.data.id as string;

    const 角色 = await request(app)
      .get("/api/org/member-business-roles?partnerMemberId=" + 渠道成员Id)
      .set("Cookie", cookie)
      .expect(200);
    const 颁发后有效数量 = (角色.body.data.items as Array<Record<string, unknown>>).filter(
      (项) => 项.businessRoleId === 业务角色Id && !项.expiredAt,
    ).length;
    expect(颁发后有效数量).toBe(颁发前有效数量);

    await request(app)
      .put("/api/org/member-certifications/" + 证书Id + "/revoke")
      .set("Cookie", cookie)
      .send({ reason: "集成测试撤销", rowVersion: 1 })
      .expect(200);

    const 撤销后 = await request(app)
      .get("/api/org/member-business-roles?partnerMemberId=" + 渠道成员Id)
      .set("Cookie", cookie)
      .expect(200);
    const 撤销后有效数量 = (撤销后.body.data.items as Array<Record<string, unknown>>).filter(
      (项) => 项.businessRoleId === 业务角色Id && !项.expiredAt,
    ).length;
    expect(撤销后有效数量).toBe(颁发前有效数量);
  });

  it("证书列表支持区域子树与证书名称检索", async () => {
    const app = 创建应用({ env: 环境变量 });
    const cookie = await 登录Cookie(app);
    const 颁发 = await request(app)
      .post("/api/org/users/" + 渠道用户Id + "/certifications")
      .set("Cookie", cookie)
      .send({ certificationTemplateId: 证书模板Id, issuedOn: "2026-08-21" })
      .expect(200);
    const 证书Id = 颁发.body.data.id as string;

    const 按区域 = await request(app)
      .get("/api/org/member-certifications?regionId=" + 大区Id)
      .set("Cookie", cookie)
      .expect(200);
    expect((按区域.body.data.items as Array<{ id: string }>).some((项) => 项.id === 证书Id)).toBe(
      true,
    );

    const 按名称 = await request(app)
      .get("/api/org/member-certifications?templateName=" + encodeURIComponent("测试证书"))
      .set("Cookie", cookie)
      .expect(200);
    expect((按名称.body.data.items as Array<{ id: string }>).some((项) => 项.id === 证书Id)).toBe(
      true,
    );

    const 不匹配 = await request(app)
      .get("/api/org/member-certifications?templateName=" + encodeURIComponent("不存在证书"))
      .set("Cookie", cookie)
      .expect(200);
    expect((不匹配.body.data.items as Array<{ id: string }>).some((项) => 项.id === 证书Id)).toBe(
      false,
    );

    await request(app)
      .put("/api/org/member-certifications/" + 证书Id + "/revoke")
      .set("Cookie", cookie)
      .send({ reason: "集成测试清理", rowVersion: 1 })
      .expect(200);
  });
});
