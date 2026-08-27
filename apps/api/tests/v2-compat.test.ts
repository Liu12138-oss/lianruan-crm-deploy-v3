import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { 创建测试环境变量 } from "@lianruan/testing";
import { Pool } from "pg";
import request from "supertest";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { 创建应用 } from "../src/index.js";

const 测试环境变量 = 创建测试环境变量({
  V3_DELIVERY_AUTH_ENABLED: "true",
  V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
  V3_DELIVERY_AUTH_USERS_JSON: "[]",
});
const 当前目录 = path.dirname(fileURLToPath(import.meta.url));
const V2区域管理员恢复迁移 = fs.readFileSync(
  path.resolve(当前目录, "../../../database/migrations/20260817_S9_025_V2区域管理员账号恢复.sql"),
  "utf8",
);
const V2区域管理员恢复回退迁移 = fs.readFileSync(
  path.resolve(
    当前目录,
    "../../../database/migrations/20260817_S9_025_V2区域管理员账号恢复.rollback.sql",
  ),
  "utf8",
);

if (!测试环境变量.DATABASE_URL) {
  throw new Error("V2兼容接口测试必须配置 PostgreSQL DATABASE_URL，禁止回退内存模式。");
}

describe("V2真实页面兼容接口", () => {
  it("迁移用户可以通过V2登录格式获取用户和令牌", async () => {
    const app = 创建应用({
      env: { ...测试环境变量, V3_ORGANIZATION_ENABLED: "true" },
    });
    const 正式页面会话 = request.agent(app);
    const 用户列表 = await request(app).get("/api/v2/users?pageSize=1000").expect(200);
    const 用户 =
      (用户列表.body.data as Array<{ username: string }>).find(
        (item) => item.username === "liulonghai",
      ) || (用户列表.body.data as Array<{ username: string }>)[0];

    if (!用户?.username) throw new Error("未找到可用于V2兼容登录测试的迁移用户。");

    const 失败登录 = await request(app)
      .post("/api/v2/auth/login")
      .send({ username: 用户.username, password: "错误密码" })
      .expect(401);
    expect(失败登录.headers["set-cookie"]).toBeUndefined();

    const 登录 = await 正式页面会话
      .post("/api/v2/auth/login")
      .send({ username: 用户.username, password: "LrCRM@2026!" })
      .expect(200);

    expect(登录.body.success).toBe(true);
    expect(登录.body.user.username).toBe(用户.username);
    expect(登录.body.token).toMatch(/^v2\./);
    expect(登录.headers["set-cookie"]?.[0]).toContain("HttpOnly");

    const 组织状态 = await 正式页面会话.get("/api/org/status").expect(200);
    expect(组织状态.body.data.enabled).toBe(true);

    const 统一入口登录 = await request(app)
      .post("/api/auth/login")
      .send({ username: 用户.username, password: "LrCRM@2026!" })
      .expect(200);
    expect(统一入口登录.body.data.user.username).toBe(用户.username);
    expect(统一入口登录.body.data.pageSession.token).toMatch(/^v2\./);
    expect(统一入口登录.body.data.pageSession.user.username).toBe(用户.username);
    expect(统一入口登录.body.data.pageSession.user.id).toBeTruthy();
  });

  it("V2登录页可以读取未启用的OAuth配置", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 响应 = await request(app).get("/api/v2/oauth/config").expect(200);

    expect(响应.body.success).toBe(true);
    expect(响应.body.enabled).toBe(false);
    expect(响应.body.data.enabled).toBe(false);
  });

  it("账号联系电话在创建和修改时必须保持唯一", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 批次 = `phone_unique_${Date.now()}`;
    const 电话一 = `139${String(Date.now()).slice(-8)}`;
    const 电话二 = `138${String(Date.now()).slice(-8)}`;

    const 账号一 = await request(app)
      .post("/api/v2/users")
      .send({
        username: `${批次}_a`,
        name: `${批次}-账号甲`,
        role: "staff",
        phone: 电话一,
        status: "active",
      })
      .expect(200);
    expect(账号一.body.success).toBe(true);

    const 创建冲突 = await request(app)
      .post("/api/v2/users")
      .send({
        username: `${批次}_b`,
        name: `${批次}-账号乙`,
        role: "staff",
        phone: 电话一,
        status: "active",
      })
      .expect(409);
    expect(创建冲突.body.success).toBe(false);
    expect(创建冲突.body.error).toContain("联系电话已被账号");

    const 账号二 = await request(app)
      .post("/api/v2/users")
      .send({
        username: `${批次}_b`,
        name: `${批次}-账号乙`,
        role: "staff",
        phone: 电话二,
        email: `${批次}_b@example.com`,
        status: "active",
      })
      .expect(200);
    expect(账号二.body.success).toBe(true);

    const 修改冲突 = await request(app)
      .put(`/api/v2/users/${encodeURIComponent(`${批次}_b`)}`)
      .send({
        username: `${批次}_b`,
        name: `${批次}-账号乙`,
        role: "staff",
        phone: 电话一,
        status: "active",
      })
      .expect(409);
    expect(修改冲突.body.success).toBe(false);
    expect(修改冲突.body.error).toContain("联系电话已被账号");

    const 列表 = await request(app).get("/api/v2/users?pageSize=1000").expect(200);
    const 回显 = (
      列表.body.data as Array<{
        username: string;
        phone: string;
        email: string;
      }>
    ).find((用户) => 用户.username === `${批次}_b`);
    expect(回显).toBeDefined();
    expect(回显?.phone).toBe(电话二);
    expect(回显?.email).toBe(`${批次}_b@example.com`);
  });

  it("迁移区域管理员部分保存后保留登录名、角色和联系电话", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 批次 = `region_admin_save_${Date.now()}`;
    const 登录账号 = `${批次}_login`;
    const 联系电话 = `137${String(Date.now()).slice(-8)}`;

    const 创建 = await request(app)
      .post("/api/v2/admin/accounts")
      .send({
        id: 批次,
        username: 登录账号,
        name: `${批次}-区域管理员`,
        role: "admin",
        phone: 联系电话,
        email: `${批次}@example.com`,
        region: "安徽区",
        bigRegion: "大东区",
        password: "LrCRM@2026!",
        status: "active",
      })
      .expect(200);
    expect(创建.body.data.role).toBe("admin");

    const 部分保存 = await request(app)
      .put(`/api/v2/users/${encodeURIComponent(批次)}`)
      .send({
        name: `${批次}-已编辑`,
        region: "安徽区",
        bigRegion: "大东区",
        status: "active",
        remark: "仅编辑展示信息",
      })
      .expect(200);
    expect(部分保存.body.data.username).toBe(登录账号);
    expect(部分保存.body.data.role).toBe("admin");
    expect(部分保存.body.data.phone).toBe(联系电话);

    const 登录 = await request(app)
      .post("/api/v2/auth/login")
      .send({ username: 登录账号, password: "LrCRM@2026!" })
      .expect(200);
    expect(登录.body.user.role).toBe("admin");

    const 停用 = await request(app)
      .put(`/api/v2/users/${encodeURIComponent(批次)}`)
      .send({ status: "disabled" })
      .expect(200);
    expect(停用.body.data.status).toBe("disabled");

    const 恢复 = await request(app)
      .put(`/api/v2/users/${encodeURIComponent(批次)}`)
      .send({ status: "active" })
      .expect(200);
    expect(恢复.body.data.username).toBe(登录账号);
    expect(恢复.body.data.role).toBe("admin");
    expect(恢复.body.data.phone).toBe(联系电话);
  });

  it("原始V2区域管理员被旧保存逻辑覆盖后仅恢复明确异常账号", async () => {
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 批次 = `v2_region_repair_${Date.now()}`;
    const 原始登录名 = `${批次}_login`;
    const 冲突原始登录名 = `${批次}_conflict_login`;
    const 原始电话 = `136${String(Date.now()).slice(-8)}`;

    try {
      await pool.query(
        `
        INSERT INTO iam.users (v2_source_id, username, display_name, status_code, extra_json)
        VALUES
          ($1::text, $1::citext, '待恢复区域管理员', 'active', jsonb_build_object('id', $1::text, 'role', 'staff')),
          ($2::text, $2::citext, '登录名冲突区域管理员', 'active', jsonb_build_object('id', $2::text, 'role', 'staff')),
          ($3::text, $3::citext, '正常V2员工', 'active', jsonb_build_object('id', $3::text, 'role', 'staff')),
          ($4::text, $5::citext, '已有登录账号', 'active', '{}'::jsonb)
        `,
        [批次, `${批次}_conflict`, `${批次}_staff`, `${批次}_other`, 冲突原始登录名],
      );
      await pool.query(
        `
        INSERT INTO iam.user_roles (user_id, role_id)
        SELECT u.id, r.id
        FROM iam.users u
        JOIN iam.roles r ON r.role_code = 'staff'
        WHERE u.v2_source_id IN ($1, $2, $3)
        ON CONFLICT DO NOTHING
        `,
        [批次, `${批次}_conflict`, `${批次}_staff`],
      );
      await pool.query(
        `
        INSERT INTO migration.v2_raw_records (
          batch_id, entity_name, source_id, source_sha256, raw_json, redacted_json, process_status
        )
        SELECT id, 'users', $1, $2, '{}'::jsonb, $3::jsonb, 'loaded'
        FROM migration.migration_batches
        ORDER BY started_at DESC
        LIMIT 1
        `,
        [
          批次,
          `${批次}-sha`,
          JSON.stringify({
            data: {
              username: 原始登录名,
              role: "admin",
              phone: 原始电话,
              email: `${批次}@example.com`,
            },
          }),
        ],
      );
      await pool.query(
        `
        INSERT INTO migration.v2_raw_records (
          batch_id, entity_name, source_id, source_sha256, raw_json, redacted_json, process_status
        )
        SELECT id, 'users', $1, $2, '{}'::jsonb, $3::jsonb, 'loaded'
        FROM migration.migration_batches
        ORDER BY started_at DESC
        LIMIT 1
        `,
        [
          `${批次}_conflict`,
          `${批次}-conflict-sha`,
          JSON.stringify({ data: { username: 冲突原始登录名, role: "admin" } }),
        ],
      );
      await pool.query(
        `
        INSERT INTO migration.v2_raw_records (
          batch_id, entity_name, source_id, source_sha256, raw_json, redacted_json, process_status
        )
        SELECT id, 'users', $1, $2, '{}'::jsonb, $3::jsonb, 'loaded'
        FROM migration.migration_batches
        ORDER BY started_at DESC
        LIMIT 1
        `,
        [
          `${批次}_staff`,
          `${批次}-staff-sha`,
          JSON.stringify({ data: { username: `${批次}_staff_login`, role: "staff" } }),
        ],
      );
      await pool.query(V2区域管理员恢复迁移);

      const 恢复结果 = await pool.query<{
        username: string;
        phone: string | null;
        email: string | null;
        role: string | null;
        has_region_manager: boolean;
      }>(
        `
        SELECT
          u.username::text AS username,
          u.phone,
          u.email::text AS email,
          u.extra_json->>'role' AS role,
          EXISTS (
            SELECT 1
            FROM iam.user_roles ur
            JOIN iam.roles r ON r.id = ur.role_id
            WHERE ur.user_id = u.id AND r.role_code = 'region_manager'
          ) AS has_region_manager
        FROM iam.users u
        WHERE u.v2_source_id = $1
        `,
        [批次],
      );
      expect(恢复结果.rows[0]).toMatchObject({
        username: 原始登录名,
        phone: 原始电话,
        email: `${批次}@example.com`,
        role: "admin",
        has_region_manager: true,
      });

      const 跳过结果 = await pool.query<{ username: string; action_code: string }>(
        `
        SELECT u.username::text AS username, repair.action_code
        FROM iam.users u
        JOIN migration.v2_region_manager_account_repairs repair ON repair.user_id = u.id
        WHERE u.v2_source_id = $1
        `,
        [`${批次}_conflict`],
      );
      expect(跳过结果.rows[0]).toEqual({
        username: `${批次}_conflict`,
        action_code: "skipped_username_conflict",
      });

      const 员工结果 = await pool.query<{ username: string; role: string | null }>(
        "SELECT username::text AS username, extra_json->>'role' AS role FROM iam.users WHERE v2_source_id = $1",
        [`${批次}_staff`],
      );
      expect(员工结果.rows[0]).toEqual({ username: `${批次}_staff`, role: "staff" });

      await pool.query(V2区域管理员恢复回退迁移);
      const 回退结果 = await pool.query<{
        username: string;
        phone: string | null;
        role: string | null;
        has_region_manager: boolean;
      }>(
        `
        SELECT
          u.username::text AS username,
          u.phone,
          u.extra_json->>'role' AS role,
          EXISTS (
            SELECT 1
            FROM iam.user_roles ur
            JOIN iam.roles r ON r.id = ur.role_id
            WHERE ur.user_id = u.id AND r.role_code = 'region_manager'
          ) AS has_region_manager
        FROM iam.users u
        WHERE u.v2_source_id = $1
        `,
        [批次],
      );
      expect(回退结果.rows[0]).toMatchObject({
        username: 批次,
        phone: null,
        role: "staff",
        has_region_manager: false,
      });
    } finally {
      await pool.query(
        "DELETE FROM migration.v2_raw_records WHERE entity_name = 'users' AND source_id = ANY($1)",
        [[批次, `${批次}_conflict`, `${批次}_staff`]],
      );
      await pool.query("DELETE FROM iam.users WHERE v2_source_id = ANY($1)", [
        [批次, `${批次}_conflict`, `${批次}_staff`, `${批次}_other`],
      ]);
      await pool.end();
    }
  });

  it("产品目录按V2数组格式返回功能、硬件、套餐和树结构", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const [功能, 硬件, 套餐, 树] = await Promise.all([
      request(app).get("/api/v2/features").expect(200),
      request(app).get("/api/v2/hardware").expect(200),
      request(app).get("/api/v2/packages").expect(200),
      request(app).get("/api/v2/product-tree").expect(200),
    ]);

    expect(功能.body.data).toHaveLength(34);
    expect(硬件.body.data).toHaveLength(15);
    expect(套餐.body.data).toHaveLength(6);
    expect(功能.body.data[0]).toHaveProperty("moduleId");
    expect(功能.body.data[0]).toHaveProperty("productCode");
    expect(硬件.body.data[0]).toHaveProperty("model");
    expect(套餐.body.data[0]).toHaveProperty("featureIds");
    expect(树.body.data.some((category: { modules?: unknown[] }) => category.modules?.length)).toBe(
      true,
    );
  });

  it("工作量映射和规则保持V2维护页可读取的数据口径", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const [映射, 交付规则, 旧规则] = await Promise.all([
      request(app).get("/api/v2/workload/mappings").expect(200),
      request(app).get("/api/v2/workload/delivery-rules").expect(200),
      request(app).get("/api/v2/workload/rules").expect(200),
    ]);

    expect(映射.body.data).toHaveLength(49);
    expect(交付规则.body.data).toHaveLength(15);
    expect(旧规则.body.data.length).toBeGreaterThanOrEqual(24);
    expect(映射.body.data[0]).toHaveProperty("deliveryTags");
    expect(交付规则.body.data[0]).toHaveProperty("personDays");
    expect(旧规则.body.data[0]).toHaveProperty("minPoints");
    expect(旧规则.body.data[0]).toHaveProperty("personDays");
  });

  it("友商IPG参考对比使用V2功能编号时返回有效参考价", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 响应 = await request(app)
      .post("/api/v2/ipg/quote-preview")
      .send({
        featureIds: ["FEAT-MOD-LEP-01-01", "FEAT-MOD-LEP-01-02"],
        endpoints: 100,
        lianruanTotal: 16500,
        projectParams: { ipgEncryptionMode: "encrypt" },
      })
      .expect(200);

    expect(响应.body.success).toBe(true);
    expect(响应.body.data.ipgReferenceTotal).toBeGreaterThan(0);
    expect(响应.body.data.lianruanTotal).toBe(16500);
    expect(响应.body.data.differenceText).toContain("IPG参考总价");
  });

  it("V2后台常用维护入口不再返回404", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const [企业搜索, 导出, 导入模板, 文档, 简介产品, 地市] = await Promise.all([
      request(app).get("/api/v2/company-search?keyword=公司").expect(200),
      request(app).get("/api/v2/export/registrations").expect(200),
      request(app).get("/api/v2/import/registrations/template").expect(200),
      request(app).get("/api/v2/open-api/docs").expect(200),
      request(app).get("/api/v2/partner-profile-products").expect(200),
      request(app).get("/api/v2/meta/prefecture-cities").expect(200),
    ]);

    expect(企业搜索.body.success).toBe(true);
    expect(Array.isArray(企业搜索.body.data)).toBe(true);
    expect(导出.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(导入模板.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(文档.body.data).toHaveLength(2);
    expect(Array.isArray(简介产品.body.data.products)).toBe(true);
    expect(Array.isArray(地市.body.data)).toBe(true);
  });

  it("V2导入导出真实解析Excel并写入PostgreSQL，兼容裸/api/import路径", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const { 渠道商名称, 员工姓名 } = await 读取可导入负责人(app);
    const 客户名称 = `阶段9导入客户-${Date.now()}`;
    const 导入联系电话 = `137${String(Date.now()).slice(-8)}`;
    const 报备文件 = 生成Excel([
      [
        "客户名称*",
        "统一社会信用代码",
        "行业",
        "联系人",
        "联系电话",
        "负责员工姓名*",
        "所属渠道商名称*",
        "客户地址",
      ],
      [客户名称, "", "制造", "验收联系人", 导入联系电话, 员工姓名, 渠道商名称, "阶段9验收地址"],
    ]);

    const 预览 = await request(app)
      .post("/api/import/registrations/preview")
      .attach("file", 报备文件, {
        filename: "客户报备导入.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      .expect(200);
    expect(预览.body.success).toBe(true);
    expect(预览.body.totalCount).toBe(1);
    expect(预览.body.errorCount).toBe(0);

    const 执行报备 = await request(app)
      .post("/api/import/registrations/execute")
      .attach("file", 报备文件, {
        filename: "客户报备导入.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      .expect(200);
    expect(执行报备.body.success).toBe(true);
    expect(执行报备.body.results.success + 执行报备.body.results.updated).toBeGreaterThanOrEqual(1);

    const 导入报备回读 = await request(app)
      .get(`/api/v2/registrations?keyword=${encodeURIComponent(客户名称)}&pageSize=10`)
      .expect(200);
    const 导入报备 = 导入报备回读.body.data.find(
      (item: { customer?: string }) => item.customer === 客户名称,
    );
    expect(导入报备?.id).toMatch(/^BB-.+-\d{8}-\d{4}$/);

    const 商机文件 = 生成Excel([
      [
        "商机名称*",
        "客户名称*",
        "商机金额",
        "预计签约日期",
        "商机阶段",
        "行业",
        "联系人",
        "联系电话",
        "负责员工姓名*",
        "所属渠道商名称*",
        "备注",
      ],
      [
        `${客户名称}安全项目`,
        客户名称,
        "50000",
        "2026-08-31",
        "40% 技术交流/方案设计",
        "制造",
        "验收联系人",
        "13800138009",
        员工姓名,
        渠道商名称,
        "阶段9导入验收",
      ],
    ]);
    const 执行商机 = await request(app)
      .post("/api/v2/import/opportunities/execute")
      .attach("file", 商机文件, {
        filename: "商机导入.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      .expect(200);
    expect(执行商机.body.success).toBe(true);
    expect(执行商机.body.results.success + 执行商机.body.results.updated).toBeGreaterThanOrEqual(1);

    const 商机回读 = await request(app)
      .get(`/api/v2/opportunities?keyword=${encodeURIComponent(客户名称)}&pageSize=10`)
      .expect(200);
    const 导入商机 = 商机回读.body.data.find(
      (item: { name?: string }) => item.name === `${客户名称}安全项目`,
    );
    expect(导入商机?.code).toMatch(/^SJ-\d{8}-\d{4}$/);

    const 回读 = await request(app)
      .get(`/api/v2/registrations?keyword=${encodeURIComponent(客户名称)}`)
      .expect(200);
    expect(回读.body.data.some((item: { customer?: string }) => item.customer === 客户名称)).toBe(
      true,
    );
  });

  it("审计日志按V2维护页字段返回列表和详情", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 列表 = await request(app).get("/api/v2/audit-logs?pageSize=5").expect(200);

    expect(列表.body.success).toBe(true);
    expect(Array.isArray(列表.body.data)).toBe(true);
    expect(列表.body.total).toBeGreaterThan(0);
    const 第一条 = 列表.body.data[0] as { id: string };
    expect(第一条).toHaveProperty("created_at");
    expect(第一条).toHaveProperty("module");
    expect(第一条).toHaveProperty("action");
    expect(第一条).toHaveProperty("result");

    const 详情 = await request(app).get(`/api/v2/audit-logs/${第一条.id}`).expect(200);
    expect(详情.body.success).toBe(true);
    expect(详情.body.data.id).toBe(第一条.id);
  });

  it("渠道简介、分销层级和工作量规则按V2路径写入PostgreSQL，订单调价必须校验区管身份", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const 渠道商列表 = await request(app).get("/api/v2/partners?pageSize=1").expect(200);
    const 渠道商 = 渠道商列表.body.data[0] as { id: string };
    expect(渠道商.id).toBeTruthy();

    const 简介 = await request(app).get(`/api/v2/partners/${渠道商.id}/profile`).expect(200);
    expect(简介.body.success).toBe(true);
    const 保存简介 = await request(app)
      .put(`/api/v2/partners/${渠道商.id}/profile`)
      .send({ address: "阶段9自动验收地址", verified: true })
      .expect(200);
    expect(保存简介.body.data.address).toBe("阶段9自动验收地址");

    const 层级 = await request(app)
      .put(`/api/v2/partners/${渠道商.id}/level`)
      .send({ partnerLevel: "none", parentPartnerIds: [] })
      .expect(200);
    expect(层级.body.data.partnerLevel).toBe("none");

    const 新规则 = await request(app)
      .post("/api/v2/workload/rules")
      .send({ productType: "EPP", minPoints: 260001, maxPoints: null, personDays: 18 })
      .expect(200);
    expect(新规则.body.success).toBe(true);
    await request(app).delete(`/api/v2/workload/rules/${新规则.body.data.id}`).expect(200);

    const 订单列表 = await request(app).get("/api/v2/orders?pageSize=1").expect(200);
    const 订单 = 订单列表.body.data[0] as { id: string; amount?: number; total?: number };
    if (订单?.id) {
      const 伪造操作人 = await request(app)
        .put(`/api/v2/orders/${订单.id}/price-adjust`)
        .send({
          newAmount: Number(订单.amount || 订单.total || 1),
          adjustmentReason: "阶段9自动验收",
          operatorId: "admin_sd",
        })
        .expect(403);
      expect(伪造操作人.body.success).toBe(false);

      const 伪造页面令牌 = await request(app)
        .put(`/api/v2/orders/${订单.id}/price-adjust`)
        .set(
          "Authorization",
          `Bearer v2.${Buffer.from("admin_sd", "utf8").toString("base64url")}.forged`,
        )
        .send({
          newAmount: Number(订单.amount || 订单.total || 1),
          adjustmentReason: "阶段9伪造令牌验收",
        })
        .expect(403);
      expect(伪造页面令牌.body.success).toBe(false);
    }
  });

  it("区管提交企业管理员生成审批待办，账号待审批禁用，超管通过后启用", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 序号 = Date.now();
    const 渠道商编号 = `PARTNER-ADMIN-APPROVAL-${序号}`;
    const 企业管理员账号 = `partner_admin_pending_${序号}`;
    const 渠道联系电话 = `137${String(序号).slice(-8)}`;
    const 员工电话 = `138${String(序号).slice(-8)}`;

    try {
      await request(app)
        .post("/api/v2/partners")
        .send({
          id: 渠道商编号,
          name: `区管审批验收渠道商-${序号}`,
          city: "深圳市",
          contact: "验收负责人",
          phone: 渠道联系电话,
          status: "active",
        })
        .expect(200);

      const 创建 = await request(app)
        .post(`/api/v2/partners/${渠道商编号}/staff`)
        .send({
          username: 企业管理员账号,
          name: "区管待审批企业管理员",
          role: "partner_admin",
          accountRole: "partner_admin",
          staffRole: "企业管理员",
          password: "123456",
          phone: 员工电话,
          status: "pending",
          createdBy: "region_admin_test",
          createdByRole: "admin",
        })
        .expect(200);
      expect(创建.body.success).toBe(true);

      const 详情 = await request(app).get(`/api/v2/partners/${渠道商编号}`).expect(200);
      const 员工 = 查找员工(详情.body.data, 企业管理员账号);
      expect(员工?.status).toBe("pending");

      const 审批查询 = await pool.query<{
        approval_type_code: string;
        target_type: string;
        status_code: string;
        extra_json: Record<string, unknown>;
      }>(
        `
        SELECT a.approval_type_code, a.target_type, a.status_code, a.extra_json
        FROM ops.approvals a
        JOIN iam.users u ON u.id = a.target_id
        WHERE u.username::text = $1
        ORDER BY a.created_at DESC
        LIMIT 1
        `,
        [企业管理员账号],
      );
      const 审批记录 = 审批查询.rows[0];
      expect(审批记录).toBeTruthy();
      expect(审批记录?.approval_type_code).toBe("partner_admin");
      expect(审批记录?.target_type).toBe("user");
      expect(审批记录?.status_code).toBe("pending");
      expect(审批记录?.extra_json?.type).toBe("partner_admin");
      expect(审批记录?.extra_json?.targetName).toBe("区管待审批企业管理员");

      const 事件查询 = await pool.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM ops.approval_events e
        JOIN ops.approvals a ON a.id = e.approval_id
        JOIN iam.users u ON u.id = a.target_id
        WHERE u.username::text = $1 AND e.event_code = 'submit'
        `,
        [企业管理员账号],
      );
      expect(Number(事件查询.rows[0]?.count || 0)).toBeGreaterThan(0);

      const 提醒发件箱查询 = await pool.query<{ event_type: string; aggregate_type: string }>(
        `
        SELECT outbox.event_type, outbox.aggregate_type
        FROM ops.outbox_events outbox
        JOIN ops.approvals approval ON approval.id = outbox.aggregate_id
        JOIN iam.users user_account ON user_account.id = approval.target_id
        WHERE user_account.username::text = $1
          AND outbox.event_type = 'iam.account.approval.pending'
        ORDER BY outbox.created_at DESC
        LIMIT 1
        `,
        [企业管理员账号],
      );
      expect(提醒发件箱查询.rows[0]).toEqual({
        event_type: "iam.account.approval.pending",
        aggregate_type: "approval",
      });

      const 待审批列表 = await request(app)
        .get("/api/v2/pending-approvals?pageSize=100")
        .expect(200);
      const 匹配 = (待审批列表.body.data as Array<Record<string, unknown>>).find(
        (item) => item.username === 企业管理员账号 && item.type === "partner_admin",
      );
      expect(匹配).toBeTruthy();
      expect(匹配?.status).toBe("pending");
      const 审批ID = String(匹配?.approvalId || 匹配?.id || "");

      const 通过 = await request(app)
        .put(`/api/v2/pending-approvals/${审批ID}`)
        .send({ action: "approve", approvedBy: "验收超管" })
        .expect(200);
      expect(通过.body.success).toBe(true);

      const 通过后详情 = await request(app).get(`/api/v2/partners/${渠道商编号}`).expect(200);
      expect(查找员工(通过后详情.body.data, 企业管理员账号)?.status).toBe("active");

      const 用户状态 = await pool.query<{ status_code: string; extra_status: string | null }>(
        "SELECT status_code, extra_json->>'status' AS extra_status FROM iam.users WHERE username::text = $1",
        [企业管理员账号],
      );
      const 用户行 = 用户状态.rows[0];
      expect(用户行?.status_code).toBe("active");
      expect(用户行?.extra_status).toBe("active");

      const 成员状态 = await pool.query<{ status_code: string }>(
        `
        SELECT pm.status_code
        FROM channel.partner_members pm
        JOIN iam.users u ON u.id = pm.user_id
        WHERE u.username::text = $1
        LIMIT 1
        `,
        [企业管理员账号],
      );
      expect(成员状态.rows[0]?.status_code).toBe("active");
    } finally {
      await pool.end();
    }
  });

  it("区管提交普通员工生成审批待办，超管驳回后账号禁用", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 序号 = Date.now();
    const 渠道商编号 = `PARTNER-STAFF-APPROVAL-${序号}`;
    const 员工账号 = `staff_pending_${序号}`;
    const 渠道联系电话 = `139${String(序号).slice(-8)}`;
    const 员工电话 = `137${String(序号).slice(-8)}`;

    try {
      await request(app)
        .post("/api/v2/partners")
        .send({
          id: 渠道商编号,
          name: `区管员工审批验收渠道商-${序号}`,
          city: "深圳市",
          contact: "验收负责人",
          phone: 渠道联系电话,
          status: "active",
        })
        .expect(200);

      const 创建 = await request(app)
        .post(`/api/v2/partners/${渠道商编号}/staff`)
        .send({
          username: 员工账号,
          name: "区管待审批员工",
          role: "staff",
          accountRole: "staff",
          staffRole: "销售代表",
          password: "123456",
          phone: 员工电话,
          status: "pending",
          createdBy: "region_admin_test",
          createdByRole: "admin",
        })
        .expect(200);
      expect(创建.body.success).toBe(true);

      const 详情 = await request(app).get(`/api/v2/partners/${渠道商编号}`).expect(200);
      expect(查找员工(详情.body.data, 员工账号)?.status).toBe("pending");

      const 审批查询 = await pool.query<{
        approval_type_code: string;
        status_code: string;
        extra_json: Record<string, unknown>;
      }>(
        `
        SELECT a.approval_type_code, a.status_code, a.extra_json
        FROM ops.approvals a
        JOIN iam.users u ON u.id = a.target_id
        WHERE u.username::text = $1
        ORDER BY a.created_at DESC
        LIMIT 1
        `,
        [员工账号],
      );
      const 审批记录 = 审批查询.rows[0];
      expect(审批记录).toBeTruthy();
      expect(审批记录?.approval_type_code).toBe("staff");
      expect(审批记录?.status_code).toBe("pending");

      const 提醒发件箱查询 = await pool.query<{ event_type: string; aggregate_type: string }>(
        `
        SELECT outbox.event_type, outbox.aggregate_type
        FROM ops.outbox_events outbox
        JOIN ops.approvals approval ON approval.id = outbox.aggregate_id
        JOIN iam.users user_account ON user_account.id = approval.target_id
        WHERE user_account.username::text = $1
          AND outbox.event_type = 'iam.account.approval.pending'
        ORDER BY outbox.created_at DESC
        LIMIT 1
        `,
        [员工账号],
      );
      expect(提醒发件箱查询.rows[0]).toEqual({
        event_type: "iam.account.approval.pending",
        aggregate_type: "approval",
      });

      const 待审批列表 = await request(app)
        .get("/api/v2/pending-approvals?pageSize=100")
        .expect(200);
      const 匹配 = (待审批列表.body.data as Array<Record<string, unknown>>).find(
        (item) => item.username === 员工账号 && item.type === "staff",
      );
      expect(匹配).toBeTruthy();
      const 审批ID = String(匹配?.approvalId || 匹配?.id || "");

      const 驳回 = await request(app)
        .put(`/api/v2/pending-approvals/${审批ID}`)
        .send({ action: "reject", approvedBy: "验收超管", remark: "验收驳回" })
        .expect(200);
      expect(驳回.body.success).toBe(true);

      const 用户状态 = await pool.query<{ status_code: string; extra_status: string | null }>(
        "SELECT status_code, extra_json->>'status' AS extra_status FROM iam.users WHERE username::text = $1",
        [员工账号],
      );
      const 用户行 = 用户状态.rows[0];
      expect(用户行?.status_code).toBe("disabled");
      expect(用户行?.extra_status).toBe("rejected");

      const 驳回后审批状态 = await pool.query<{ status_code: string; event_code: string }>(
        `
        SELECT a.status_code, e.event_code
        FROM ops.approvals a
        JOIN ops.approval_events e ON e.approval_id = a.id
        JOIN iam.users u ON u.id = a.target_id
        WHERE u.username::text = $1 AND e.event_code = 'reject'
        ORDER BY e.event_at DESC
        LIMIT 1
        `,
        [员工账号],
      );
      expect(驳回后审批状态.rows[0]?.status_code).toBe("rejected");
      expect(驳回后审批状态.rows[0]?.event_code).toBe("reject");

      const 重新提交 = await request(app)
        .put(`/api/v2/pending-approvals/${审批ID}`)
        .send({ action: "resubmit", approvedBy: "验收超管" })
        .expect(200);
      expect(重新提交.body.success).toBe(true);

      const 重新提交待办 = await pool.query<{ id: string; status_code: string }>(
        `
        SELECT a.id::text AS id, a.status_code
        FROM ops.approvals a
        JOIN iam.users u ON u.id = a.target_id
        WHERE u.username::text = $1
        ORDER BY a.updated_at DESC
        LIMIT 1
        `,
        [员工账号],
      );
      expect(重新提交待办.rows[0]?.status_code).toBe("pending");

      const 重新提交事件 = await pool.query<{ event_code: string }>(
        `
        SELECT e.event_code
        FROM ops.approval_events e
        WHERE e.approval_id = $1::uuid AND e.event_code = 'resubmit'
        ORDER BY e.event_at DESC
        LIMIT 1
        `,
        [重新提交待办.rows[0]?.id || ""],
      );
      expect(重新提交事件.rows[0]?.event_code).toBe("resubmit");

      const 通过 = await request(app)
        .put(`/api/v2/pending-approvals/${String(重新提交待办.rows[0]?.id || "")}`)
        .send({ action: "approve", approvedBy: "验收超管" })
        .expect(200);
      expect(通过.body.success).toBe(true);

      const 通过后状态 = await pool.query<{
        approval_status: string;
        user_status: string;
        member_status: string;
        event_code: string;
      }>(
        `
        SELECT a.status_code AS approval_status, u.status_code AS user_status,
          pm.status_code AS member_status, e.event_code
        FROM ops.approvals a
        JOIN iam.users u ON u.id = a.target_id
        JOIN channel.partner_members pm ON pm.user_id = u.id AND pm.partner_id = a.applicant_partner_id
        JOIN ops.approval_events e ON e.approval_id = a.id AND e.event_code = 'approve'
        WHERE u.username::text = $1
        ORDER BY e.event_at DESC
        LIMIT 1
        `,
        [员工账号],
      );
      expect(通过后状态.rows[0]?.approval_status).toBe("approved");
      expect(通过后状态.rows[0]?.user_status).toBe("active");
      expect(通过后状态.rows[0]?.member_status).toBe("active");
      expect(通过后状态.rows[0]?.event_code).toBe("approve");

      const 重复通过 = await request(app)
        .put(`/api/v2/pending-approvals/${String(重新提交待办.rows[0]?.id || "")}`)
        .send({ action: "approve", approvedBy: "验收超管" })
        .expect(409);
      expect(重复通过.body.error).toContain("已处理");
    } finally {
      await pool.end();
    }
  });

  it("提交待审核渠道商时在同一业务链路写入渠道商审核提醒发件箱事件", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 序号 = Date.now();
    const 渠道商编号 = `PARTNER-PENDING-REMINDER-${序号}`;

    try {
      const 创建 = await request(app)
        .post("/api/v2/partners")
        .send({
          id: 渠道商编号,
          name: `渠道商审核提醒验收-${序号}`,
          city: "深圳市",
          contact: "验收负责人",
          phone: `136${String(序号).slice(-8)}`,
          status: "pending",
        })
        .expect(200);
      expect(创建.body.success).toBe(true);

      const 结果 = await pool.query<{
        event_type: string;
        aggregate_type: string;
        status_code: string;
      }>(
        `
        SELECT outbox.event_type, outbox.aggregate_type, approval.status_code
        FROM ops.outbox_events outbox
        JOIN ops.approvals approval ON approval.id = outbox.aggregate_id
        JOIN channel.partners partner ON partner.id = approval.target_id
        WHERE partner.v2_source_id = $1
          AND outbox.event_type = 'channel.partner.approval.pending'
        ORDER BY outbox.created_at DESC
        LIMIT 1
        `,
        [渠道商编号],
      );
      expect(结果.rows[0]).toEqual({
        event_type: "channel.partner.approval.pending",
        aggregate_type: "approval",
        status_code: "pending",
      });
    } finally {
      await pool.end();
    }
  });

  it("渠道商员工禁用后保留在团队中，删除后逻辑归档且保留角色与证书历史", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    try {
      const 序号 = Date.now();
      const 渠道商编号 = `PARTNER-STAFF-DELETE-${序号}`;
      const 员工账号 = `staff_delete_${序号}`;
      const 渠道联系电话 = `135${String(序号).slice(-8)}`;
      const 员工电话 = `136${String(序号).slice(-8)}`;

      await request(app)
        .post("/api/v2/partners")
        .send({
          id: 渠道商编号,
          name: `删除员工验收渠道商-${序号}`,
          city: "深圳市",
          contact: "验收负责人",
          phone: 渠道联系电话,
          status: "active",
        })
        .expect(200);

      const 创建员工结果 = await request(app).post(`/api/v2/partners/${渠道商编号}/staff`).send({
        username: 员工账号,
        name: "删除员工验收账号",
        role: "staff",
        accountRole: "staff",
        staffRole: "销售代表",
        password: "123456",
        phone: 员工电话,
        status: "active",
      });
      expect(创建员工结果.status, JSON.stringify(创建员工结果.body)).toBe(200);

      const 创建后详情 = await request(app).get(`/api/v2/partners/${渠道商编号}`).expect(200);
      expect(查找员工(创建后详情.body.data, 员工账号)?.status).toBe("active");

      const 待归档成员 = await pool.query<{ member_id: string; user_id: string }>(
        `SELECT pm.id::text AS member_id,pm.user_id::text AS user_id
       FROM channel.partner_members pm
       JOIN iam.users u ON u.id=pm.user_id
       WHERE pm.partner_id=(SELECT id FROM channel.partners WHERE v2_source_id=$1 OR partner_code=$1 LIMIT 1)
         AND lower(u.username::text)=lower($2)`,
        [渠道商编号, 员工账号],
      );
      if (!待归档成员.rows[0]) throw new Error("未找到待归档的渠道成员关系。");
      const 证书名称 = `归档保留证书-${序号}`;
      const 证书 = await pool.query<{ id: string }>(
        `INSERT INTO org.certification_templates(template_code,template_name,status_code)
       VALUES($1,$2,'active') RETURNING id::text AS id`,
        [`ARCHIVE-CERT-${序号}`, 证书名称],
      );
      await pool.query(
        `INSERT INTO org.member_certifications(
         user_id,certification_template_id,certificate_no,issued_on,status_code
       ) VALUES($1::uuid,$2::uuid,$3,current_date,'active')`,
        [待归档成员.rows[0].user_id, 证书.rows[0]?.id, `ARCHIVE-NO-${序号}`],
      );

      const 删除前事实 = await pool.query<{
        member_id: string;
        role_count: number;
        certification_count: number;
      }>(
        `SELECT pm.id::text AS member_id,
         (SELECT count(*)::int FROM org.member_business_roles m WHERE m.partner_member_id=pm.id) AS role_count,
         (SELECT count(*)::int FROM org.member_certifications c WHERE c.user_id=pm.user_id) AS certification_count
       FROM channel.partner_members pm
       JOIN iam.users u ON u.id=pm.user_id
       WHERE pm.partner_id=(SELECT id FROM channel.partners WHERE v2_source_id=$1 OR partner_code=$1 LIMIT 1)
         AND lower(u.username::text)=lower($2)`,
        [渠道商编号, 员工账号],
      );
      expect(删除前事实.rows[0]?.member_id).toBeTruthy();
      const 删除前记录 = 删除前事实.rows[0];
      if (!删除前记录) throw new Error("未找到待归档的渠道成员关系。");
      expect(删除前记录.role_count).toBeGreaterThan(0);
      expect(删除前记录.certification_count).toBe(1);

      await request(app)
        .put(`/api/v2/partners/${渠道商编号}/staff/${员工账号}/status`)
        .send({ status: "inactive" })
        .expect(200);

      const 禁用后详情 = await request(app).get(`/api/v2/partners/${渠道商编号}`).expect(200);
      expect(查找员工(禁用后详情.body.data, 员工账号)?.status).toBe("inactive");

      const 删除结果 = await request(app)
        .delete(`/api/v2/partners/${渠道商编号}/staff/${员工账号}`)
        .expect(200);
      expect(删除结果.body.data).toMatchObject({ deleted: true, partnerId: 渠道商编号 });

      const 删除后详情 = await request(app).get(`/api/v2/partners/${渠道商编号}`).expect(200);
      expect(查找员工(删除后详情.body.data, 员工账号)).toBeUndefined();

      const 删除后事实 = await pool.query<{
        member_id: string;
        member_status: string;
        archived_at: Date | null;
        archive_reason: string | null;
        user_status: string;
        role_count: number;
        certification_count: number;
        audit_count: number;
      }>(
        `SELECT pm.id::text AS member_id,pm.status_code AS member_status,pm.archived_at,pm.archive_reason,
         u.status_code AS user_status,
         (SELECT count(*)::int FROM org.member_business_roles m WHERE m.partner_member_id=pm.id) AS role_count,
         (SELECT count(*)::int FROM org.member_certifications c WHERE c.user_id=pm.user_id) AS certification_count,
         (SELECT count(*)::int FROM audit.audit_logs a
          WHERE a.target_type='channel_member' AND a.target_id=pm.id::text
            AND a.action_code='channel_member.archived') AS audit_count
       FROM channel.partner_members pm
       JOIN iam.users u ON u.id=pm.user_id
       WHERE pm.id=$1::uuid`,
        [删除前记录.member_id],
      );
      expect(删除后事实.rows[0]).toMatchObject({
        member_id: 删除前记录.member_id,
        member_status: "disabled",
        archive_reason: "渠道商管理移除成员",
        user_status: "disabled",
        role_count: 删除前记录.role_count,
        certification_count: 删除前记录.certification_count,
        audit_count: 1,
      });
      expect(删除后事实.rows[0]?.archived_at).toBeInstanceOf(Date);
    } finally {
      await pool.end();
    }
  });

  it("归档一个渠道成员关系时，存在其他有效渠道关系的账号保持启用并切换兼容渠道", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 序号 = Date.now();
    const 渠道一 = `PARTNER-ARCHIVE-A-${序号}`;
    const 渠道二 = `PARTNER-ARCHIVE-B-${序号}`;
    const 员工账号 = `staff_multi_partner_${序号}`;
    const 员工电话 = `134${String(序号).slice(-8)}`;
    try {
      for (const [渠道编号, 名称后缀] of [
        [渠道一, "一"],
        [渠道二, "二"],
      ]) {
        await request(app)
          .post("/api/v2/partners")
          .send({
            id: 渠道编号,
            name: `多渠道归档验收渠道${名称后缀}-${序号}`,
            city: "深圳市",
            contact: "验收负责人",
            phone: `133${String(序号 + (名称后缀 === "一" ? 0 : 1)).slice(-8)}`,
            status: "active",
          })
          .expect(200);
        await request(app)
          .post(`/api/v2/partners/${渠道编号}/staff`)
          .send({
            username: 员工账号,
            name: "多渠道归档验收员工",
            role: "staff",
            accountRole: "staff",
            staffRole: "销售代表",
            password: "123456",
            phone: 员工电话,
            status: "active",
          })
          .expect(200);
      }

      await request(app).delete(`/api/v2/partners/${渠道一}/staff/${员工账号}`).expect(200);
      const 账号事实 = await pool.query<{
        status_code: string;
        partner_id: string | null;
        active_memberships: number;
        archived_memberships: number;
      }>(
        `SELECT u.status_code,u.extra_json->>'partnerId' AS partner_id,
           (SELECT count(*)::int FROM channel.partner_members pm
            WHERE pm.user_id=u.id AND pm.status_code='active' AND pm.archived_at IS NULL) AS active_memberships,
           (SELECT count(*)::int FROM channel.partner_members pm
            WHERE pm.user_id=u.id AND pm.archived_at IS NOT NULL) AS archived_memberships
         FROM iam.users u WHERE lower(u.username::text)=lower($1)`,
        [员工账号],
      );
      expect(账号事实.rows[0]).toMatchObject({
        status_code: "active",
        partner_id: 渠道二,
        active_memberships: 1,
        archived_memberships: 1,
      });
    } finally {
      await pool.end();
    }
  });
});

function 生成Excel(rows: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "导入数据");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function 读取可导入负责人(app: ReturnType<typeof 创建应用>) {
  const 渠道商列表 = await request(app).get("/api/v2/partners?pageSize=1000").expect(200);
  const 渠道商 = (渠道商列表.body.data as Array<Record<string, unknown>>).find(
    (item) =>
      Array.isArray(item.staff) &&
      item.staff.some((staff) => staff?.name && staff.status !== "deleted"),
  );
  const 员工记录 = Array.isArray(渠道商?.staff)
    ? (渠道商.staff.find((staff) => staff?.name && staff.status !== "deleted") as
        { name?: string } | undefined)
    : undefined;
  if (!渠道商?.name || !员工记录?.name) {
    throw new Error("未找到可用于导入验收的渠道商员工。");
  }
  return { 渠道商名称: String(渠道商.name), 员工姓名: String(员工记录.name) };
}

function 查找员工(partner: { staff?: Array<Record<string, unknown>> }, username: string) {
  return partner.staff?.find((staff) => String(staff.username || "") === username);
}
