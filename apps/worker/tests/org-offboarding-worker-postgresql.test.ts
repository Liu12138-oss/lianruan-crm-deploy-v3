import { randomUUID } from "node:crypto";
import fs from "node:fs";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  组织离职交接任务存储,
  组织离职交接最大重试次数,
  组织离职交接单批最大数量,
  组织离职交接未结束订单状态,
} from "../src/org-offboarding-worker.js";

const 测试数据库地址 = process.env.V3_TEST_DATABASE_URL;
const 描述真实数据库 = 测试数据库地址 ? describe.sequential : describe.skip;
const 测试前缀 = `org_offboarding_pg_${Date.now()}_${randomUUID().slice(0, 8)}`;
const 迁移文件 = new URL(
  "../../../database/migrations/20260826_S10_008_组织停用归档交接安全加固.sql",
  import.meta.url,
);
const 回退文件 = new URL(
  "../../../database/migrations/20260826_S10_008_组织停用归档交接安全加固.rollback.sql",
  import.meta.url,
);

interface 已领取事件 {
  id: string;
  handoverId: string;
  retryCount: number;
  leaseToken: string;
}

interface 可测试交接存储 {
  领取事件(): Promise<已领取事件 | null>;
  完成事件(event: 已领取事件, completed: boolean): Promise<void>;
}

interface 交接场景 {
  sourceUserId: string;
  replacementUserId: string;
  regionId: string;
  handoverId: string;
  eventId: string;
}

let 连接池: Pool | null = null;
const 交接单编号集合: string[] = [];
const 用户编号集合: string[] = [];
const 区域编号集合: string[] = [];
const 渠道商编号集合: string[] = [];

function 获取连接池(): Pool {
  if (!连接池) throw new Error("真实 PostgreSQL 专项测试尚未初始化连接池。");
  return 连接池;
}

function 创建任务存储(): 组织离职交接任务存储 {
  if (!测试数据库地址) throw new Error("未配置 V3_TEST_DATABASE_URL。");
  return new 组织离职交接任务存储(测试数据库地址);
}

async function 创建区域(): Promise<string> {
  const 结果 = await 获取连接池().query<{ id: string }>(
    `INSERT INTO org.regions(region_code,region_name,region_level)
     VALUES($1,$2,'region') RETURNING id::text AS id`,
    [`${测试前缀}_${randomUUID()}`, "离职交接真实数据库验收区域"],
  );
  const id = 结果.rows[0]!.id;
  区域编号集合.push(id);
  return id;
}

async function 创建用户(
  regionId: string,
  options: { statusCode?: "active" | "disabled"; offboardingStatus?: string } = {},
): Promise<string> {
  const 唯一后缀 = randomUUID();
  const 结果 = await 获取连接池().query<{ id: string }>(
    `INSERT INTO iam.users(username,display_name,status_code,region_id,offboarding_status)
     VALUES($1,$2,$3,$4::uuid,$5) RETURNING id::text AS id`,
    [
      `${测试前缀}_${唯一后缀}`,
      "离职交接真实数据库验收账号",
      options.statusCode || "active",
      regionId,
      options.offboardingStatus || "active",
    ],
  );
  const id = 结果.rows[0]!.id;
  用户编号集合.push(id);
  return id;
}

async function 绑定系统角色(userId: string, roleCode = "region_manager"): Promise<void> {
  await 获取连接池().query(
    `INSERT INTO iam.user_roles(user_id,role_id)
     SELECT $1::uuid,id FROM iam.roles WHERE role_code=$2 AND status_code='active'
     ON CONFLICT DO NOTHING`,
    [userId, roleCode],
  );
}

async function 创建交接场景(
  options: {
    replacementStatus?: "active" | "disabled";
    replacementRole?: string | null;
    retryCount?: number;
    eventStatus?: "pending" | "processing";
    nextRetryAt?: Date | null;
    leaseToken?: string;
  } = {},
): Promise<交接场景> {
  const regionId = await 创建区域();
  const sourceUserId = await 创建用户(regionId, {
    statusCode: "disabled",
    offboardingStatus: "offboarding",
  });
  const replacementUserId = await 创建用户(regionId, {
    statusCode: options.replacementStatus || "active",
  });
  if (options.replacementRole !== null)
    await 绑定系统角色(replacementUserId, options.replacementRole || "region_manager");
  const 交接单 = await 获取连接池().query<{ id: string }>(
    `INSERT INTO org.offboarding_handover(
       user_id,effective_at,replacement_user_id,reason,created_by_user_id,scan_requested_at,
       target_role_codes,target_region_id
     ) VALUES($1::uuid,now(),$2::uuid,$3,$2::uuid,now(),ARRAY['region_manager']::text[],$4::uuid)
     RETURNING id::text AS id`,
    [sourceUserId, replacementUserId, "真实 PostgreSQL 离职交接验收", regionId],
  );
  const handoverId = 交接单.rows[0]!.id;
  交接单编号集合.push(handoverId);
  const 事件 = await 获取连接池().query<{ id: string }>(
    `INSERT INTO ops.outbox_events(
       event_type,aggregate_type,aggregate_id,payload_json,status_code,retry_count,next_retry_at
     ) VALUES(
       'org.offboarding.scan_requested','offboarding_handover',$1::uuid,$2::jsonb,$3,$4,$5
     ) RETURNING id::text AS id`,
    [
      handoverId,
      JSON.stringify({
        handoverId,
        ...(options.leaseToken ? { leaseToken: options.leaseToken } : {}),
      }),
      options.eventStatus || "pending",
      options.retryCount || 0,
      options.nextRetryAt || null,
    ],
  );
  return {
    sourceUserId,
    replacementUserId,
    regionId,
    handoverId,
    eventId: 事件.rows[0]!.id,
  };
}

async function 新增客户(sourceUserId: string, count: number): Promise<string[]> {
  const 结果 = await 获取连接池().query<{ id: string }>(
    `INSERT INTO crm.customers(
       customer_name,normalized_name,owner_user_id,status_code,extra_json
     )
     SELECT $1 || '-' || 序号::text,$2 || '-' || 序号::text,$3::uuid,'active',
            jsonb_build_object('testRun',$2::text)
     FROM generate_series(1,$4::int) AS 序号
     RETURNING id::text AS id`,
    ["离职交接验收客户", `${测试前缀}_${randomUUID()}`, sourceUserId, count],
  );
  return 结果.rows.map((行) => 行.id);
}

async function 查询动态待办数量(userId: string): Promise<number> {
  const 上下文 = await 获取连接池().query<{
    regionId: string | null;
    roleCodes: string[];
  }>(
    `SELECT u.region_id::text AS "regionId",
            COALESCE(array_agg(r.role_code ORDER BY r.role_code)
              FILTER (WHERE r.role_code IS NOT NULL),ARRAY[]::text[]) AS "roleCodes"
     FROM iam.users u
     LEFT JOIN iam.user_roles ur ON ur.user_id=u.id
     LEFT JOIN iam.roles r ON r.id=ur.role_id AND r.status_code='active'
     WHERE u.id=$1::uuid
     GROUP BY u.id`,
    [userId],
  );
  const 用户 = 上下文.rows[0]!;
  const 结果 = await 获取连接池().query<{ count: number }>(
    `SELECT count(*)::int AS count FROM (
       SELECT approval.id
       FROM ops.approvals approval
       LEFT JOIN crm.registrations registration
         ON approval.target_type='registration' AND registration.id=approval.target_id
       LEFT JOIN crm.orders orders
         ON approval.target_type='order' AND orders.id=approval.target_id
       LEFT JOIN channel.partners partner
         ON partner.id=COALESCE(registration.partner_id,orders.partner_id,approval.applicant_partner_id)
       WHERE approval.status_code IN ('active','pending')
         AND (
           $1::boolean
           OR (
             $2::boolean AND $3::uuid IS NOT NULL
             AND COALESCE(
               registration.region_id::text,
               partner.region_id::text,
               approval.extra_json->>'regionId',''
             )=$3::text
           )
         )
       UNION ALL
       SELECT registration.id
       FROM crm.registrations registration
       WHERE registration.status_code='pending'
         AND NOT EXISTS (
           SELECT 1 FROM ops.approvals approval
           WHERE approval.target_type='registration' AND approval.target_id=registration.id
         )
         AND (
           $1::boolean OR ($2::boolean AND $3::uuid IS NOT NULL AND registration.region_id=$3::uuid)
         )
     ) 待办`,
    [
      用户.roleCodes.includes("superadmin"),
      用户.roleCodes.some((角色) => ["admin", "region_manager"].includes(角色)),
      用户.regionId,
    ],
  );
  return 结果.rows[0]!.count;
}

描述真实数据库("组织离职交接任务真实 PostgreSQL 验收", () => {
  beforeAll(async () => {
    const 地址 = new URL(测试数据库地址!);
    const 数据库名称 = 地址.pathname.slice(1);
    if (
      !["127.0.0.1", "localhost", "::1"].includes(地址.hostname) ||
      !数据库名称.endsWith("_test")
    ) {
      throw new Error("真实 PostgreSQL 专项测试只允许连接本机且名称以 _test 结尾的隔离测试库。");
    }
    连接池 = new Pool({ connectionString: 测试数据库地址, max: 8 });
    await 连接池.query("SELECT 1");
  });

  afterAll(async () => {
    if (!连接池) return;
    await 连接池
      .query("DELETE FROM audit.audit_logs WHERE target_id=ANY($1::text[])", [交接单编号集合])
      .catch(() => undefined);
    await 连接池
      .query("DELETE FROM ops.outbox_events WHERE aggregate_id=ANY($1::uuid[])", [交接单编号集合])
      .catch(() => undefined);
    await 连接池
      .query("DELETE FROM org.offboarding_handover WHERE id=ANY($1::uuid[])", [交接单编号集合])
      .catch(() => undefined);
    await 连接池
      .query("DELETE FROM ops.approvals WHERE extra_json->>'testRun'=$1", [测试前缀])
      .catch(() => undefined);
    await 连接池
      .query("DELETE FROM crm.orders WHERE extra_json->>'testRun'=$1", [测试前缀])
      .catch(() => undefined);
    await 连接池
      .query("DELETE FROM crm.opportunities WHERE extra_json->>'testRun'=$1", [测试前缀])
      .catch(() => undefined);
    await 连接池
      .query("DELETE FROM crm.registrations WHERE extra_json->>'testRun'=$1", [测试前缀])
      .catch(() => undefined);
    await 连接池
      .query("DELETE FROM crm.quotes WHERE extra_json->>'testRun'=$1", [测试前缀])
      .catch(() => undefined);
    await 连接池
      .query("DELETE FROM crm.customers WHERE extra_json->>'testRun' LIKE $1", [`${测试前缀}%`])
      .catch(() => undefined);
    await 连接池
      .query("DELETE FROM channel.partners WHERE id=ANY($1::uuid[])", [渠道商编号集合])
      .catch(() => undefined);
    await 连接池
      .query("DELETE FROM iam.users WHERE id=ANY($1::uuid[])", [用户编号集合])
      .catch(() => undefined);
    await 连接池
      .query("DELETE FROM org.regions WHERE id=ANY($1::uuid[])", [区域编号集合])
      .catch(() => undefined);
    await 连接池.end();
    连接池 = null;
  });

  it("S10-008 可迁移、可回退并从有效角色与区域回填资格快照", async () => {
    const db = 获取连接池();
    const regionId = await 创建区域();
    const sourceUserId = await 创建用户(regionId);
    const replacementUserId = await 创建用户(regionId);
    await 绑定系统角色(sourceUserId);
    const 迁移SQL = fs.readFileSync(迁移文件, "utf8");
    const 回退SQL = fs.readFileSync(回退文件, "utf8");
    const 事务连接 = await db.connect();
    await 事务连接.query("BEGIN");
    try {
      await 事务连接.query(回退SQL);
      const 回退后字段 = await 事务连接.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM information_schema.columns
         WHERE table_schema='org' AND table_name='offboarding_handover'
           AND column_name IN ('target_role_codes','target_region_id')`,
      );
      expect(回退后字段.rows[0]!.count).toBe(0);

      const 交接单 = await 事务连接.query<{ id: string }>(
        `INSERT INTO org.offboarding_handover(
           user_id,effective_at,replacement_user_id,reason,created_by_user_id
         ) VALUES($1::uuid,now(),$2::uuid,$3,$2::uuid) RETURNING id::text AS id`,
        [sourceUserId, replacementUserId, "S10-008 迁移与回退验收"],
      );
      const handoverId = 交接单.rows[0]!.id;
      await 事务连接.query(迁移SQL);
      const 快照 = await 事务连接.query<{
        roleCodes: string[];
        regionId: string;
        roleComment: string;
      }>(
        `SELECT h.target_role_codes AS "roleCodes",h.target_region_id::text AS "regionId",
                col_description('org.offboarding_handover'::regclass,
                  (SELECT ordinal_position FROM information_schema.columns
                   WHERE table_schema='org' AND table_name='offboarding_handover'
                     AND column_name='target_role_codes')) AS "roleComment"
         FROM org.offboarding_handover h WHERE h.id=$1::uuid`,
        [handoverId],
      );
      expect(快照.rows[0]!.roleCodes).toEqual(["region_manager"]);
      expect(快照.rows[0]!.regionId).toBe(regionId);
      expect(快照.rows[0]!.roleComment).toContain("有效系统角色快照");

      await 事务连接.query(回退SQL);
      const 二次回退字段 = await 事务连接.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM information_schema.columns
         WHERE table_schema='org' AND table_name='offboarding_handover'
           AND column_name IN ('target_role_codes','target_region_id')`,
      );
      expect(二次回退字段.rows[0]!.count).toBe(0);

      await 事务连接.query(迁移SQL);
      const 恢复后快照 = await 事务连接.query<{ roleCodes: string[]; regionId: string }>(
        `SELECT target_role_codes AS "roleCodes",target_region_id::text AS "regionId"
         FROM org.offboarding_handover WHERE id=$1::uuid`,
        [handoverId],
      );
      expect(恢复后快照.rows[0]).toEqual({ roleCodes: ["region_manager"], regionId });
    } finally {
      await 事务连接.query("ROLLBACK");
      事务连接.release();
    }
  });

  it("动态待办按当前角色和区域实时可见且不篡改申请人历史", async () => {
    const db = 获取连接池();
    const regionId = await 创建区域();
    const 原区管Id = await 创建用户(regionId);
    const 接收区管Id = await 创建用户(regionId);
    await 绑定系统角色(原区管Id);
    const 渠道商 = await db.query<{ id: string }>(
      `INSERT INTO channel.partners(
         partner_code,partner_name,normalized_name,partner_level_code,region_id,status_code
       ) VALUES($1,$2,$1,'none',$3::uuid,'active') RETURNING id::text AS id`,
      [`${测试前缀}_${randomUUID()}`, "动态待办验收渠道商", regionId],
    );
    const partnerId = 渠道商.rows[0]!.id;
    渠道商编号集合.push(partnerId);
    const 客户 = await db.query<{ id: string }>(
      `INSERT INTO crm.customers(customer_name,normalized_name,region_id,status_code,extra_json)
       VALUES($1,$2,$3::uuid,'active',jsonb_build_object('testRun',$4::text))
       RETURNING id::text AS id`,
      ["动态待办验收客户", `${测试前缀}_${randomUUID()}`, regionId, 测试前缀],
    );
    const 报备 = await db.query<{ id: string }>(
      `INSERT INTO crm.registrations(
         customer_id,partner_id,owner_user_id,region_id,status_code,extra_json
       ) VALUES
         ($1::uuid,$2::uuid,$3::uuid,$4::uuid,'pending',jsonb_build_object('testRun',$5::text)),
         ($1::uuid,$2::uuid,$3::uuid,$4::uuid,'pending',jsonb_build_object('testRun',$5::text))
       RETURNING id::text AS id`,
      [客户.rows[0]!.id, partnerId, 原区管Id, regionId, 测试前缀],
    );
    const 审批 = await db.query<{ id: string }>(
      `INSERT INTO ops.approvals(
         approval_type_code,target_type,target_id,applicant_user_id,applicant_partner_id,
         status_code,extra_json
       ) VALUES('registration','registration',$1::uuid,$2::uuid,$3::uuid,'pending',
                jsonb_build_object('testRun',$4::text))
       RETURNING id::text AS id`,
      [报备.rows[0]!.id, 原区管Id, partnerId, 测试前缀],
    );

    expect(await 查询动态待办数量(原区管Id)).toBe(2);
    await db.query("DELETE FROM iam.user_roles WHERE user_id=$1::uuid", [原区管Id]);
    await 绑定系统角色(接收区管Id);
    expect(await 查询动态待办数量(原区管Id)).toBe(0);
    expect(await 查询动态待办数量(接收区管Id)).toBe(2);
    const 申请历史 = await db.query<{ applicantUserId: string }>(
      `SELECT applicant_user_id::text AS "applicantUserId" FROM ops.approvals WHERE id=$1::uuid`,
      [审批.rows[0]!.id],
    );
    expect(申请历史.rows[0]!.applicantUserId).toBe(原区管Id);
  });

  it("两个 Worker 并发时同一事件仅被一个实例领取并执行一次", async () => {
    const 场景 = await 创建交接场景();
    await 新增客户(场景.sourceUserId, 1);
    const 存储甲 = 创建任务存储();
    const 存储乙 = 创建任务存储();
    try {
      const 处理结果 = await Promise.all([存储甲.处理下一事件(), 存储乙.处理下一事件()]);
      expect(处理结果.sort()).toEqual([false, true]);
      const 结果 = await 获取连接池().query<{
        eventStatus: string;
        itemCount: number;
        auditCount: number;
      }>(
        `SELECT
           (SELECT status_code FROM ops.outbox_events WHERE id=$1::uuid) AS "eventStatus",
           (SELECT count(*)::int FROM org.offboarding_handover_items WHERE handover_id=$2::uuid) AS "itemCount",
           (SELECT count(*)::int FROM audit.audit_logs
             WHERE target_id=$2::text AND action_code='offboarding.owner_transferred') AS "auditCount"`,
        [场景.eventId, 场景.handoverId],
      );
      expect(结果.rows[0]).toEqual({ eventStatus: "sent", itemCount: 1, auditCount: 1 });
    } finally {
      await Promise.all([存储甲.关闭(), 存储乙.关闭()]);
    }
  });

  it("到期租约可恢复且旧租约令牌不能覆盖新实例状态", async () => {
    const 场景 = await 创建交接场景({
      eventStatus: "processing",
      nextRetryAt: new Date(Date.now() - 60_000),
      leaseToken: "expired-lease",
    });
    const 存储 = 创建任务存储();
    const 可测试存储 = 存储 as unknown as 可测试交接存储;
    try {
      const 新事件 = await 可测试存储.领取事件();
      expect(新事件?.id).toBe(场景.eventId);
      expect(新事件?.leaseToken).not.toBe("expired-lease");

      await 可测试存储.完成事件(
        {
          id: 场景.eventId,
          handoverId: 场景.handoverId,
          retryCount: 0,
          leaseToken: "expired-lease",
        },
        true,
      );
      const 旧令牌后状态 = await 获取连接池().query<{ statusCode: string }>(
        `SELECT status_code AS "statusCode" FROM ops.outbox_events WHERE id=$1::uuid`,
        [场景.eventId],
      );
      expect(旧令牌后状态.rows[0]!.statusCode).toBe("processing");

      await 可测试存储.完成事件(新事件!, true);
      const 新令牌后状态 = await 获取连接池().query<{ statusCode: string }>(
        `SELECT status_code AS "statusCode" FROM ops.outbox_events WHERE id=$1::uuid`,
        [场景.eventId],
      );
      expect(新令牌后状态.rows[0]!.statusCode).toBe("sent");
    } finally {
      await 存储.关闭();
    }
  });

  it("单批最多 200 条、订单状态完整、真实编号审计并可幂等续跑", async () => {
    const db = 获取连接池();
    const 场景 = await 创建交接场景();
    const 客户编号 = await 新增客户(场景.sourceUserId, 205);
    const 所有订单状态 = [
      ...组织离职交接未结束订单状态,
      "primary_rejected",
      "rejected",
      "cancelled",
      "completed",
    ];
    const 订单 = await db.query<{ id: string; statusCode: string }>(
      `INSERT INTO crm.orders(owner_user_id,status_code,total_amount,extra_json)
       SELECT $1::uuid,状态,0,jsonb_build_object('testRun',$2::text)
       FROM unnest($3::text[]) AS 状态
       RETURNING id::text AS id,status_code AS "statusCode"`,
      [场景.sourceUserId, 测试前缀, 所有订单状态],
    );
    const 存储 = 创建任务存储();
    try {
      await expect(存储.处理下一事件()).resolves.toBe(true);
      const 首批 = await db.query<{
        transferredCustomers: number;
        remainingCustomers: number;
        itemCount: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM crm.customers
             WHERE id=ANY($1::uuid[]) AND owner_user_id=$2::uuid) AS "transferredCustomers",
           (SELECT count(*)::int FROM crm.customers
             WHERE id=ANY($1::uuid[]) AND owner_user_id=$3::uuid) AS "remainingCustomers",
           (SELECT count(*)::int FROM org.offboarding_handover_items
             WHERE handover_id=$4::uuid) AS "itemCount"`,
        [客户编号, 场景.replacementUserId, 场景.sourceUserId, 场景.handoverId],
      );
      expect(首批.rows[0]).toEqual({
        transferredCustomers: 组织离职交接单批最大数量,
        remainingCustomers: 5,
        itemCount: 组织离职交接单批最大数量,
      });

      await expect(存储.处理下一事件()).resolves.toBe(true);
      const 有效订单编号 = 订单.rows
        .filter((行) => 组织离职交接未结束订单状态.includes(行.statusCode as never))
        .map((行) => 行.id)
        .sort();
      const 终态订单编号 = 订单.rows
        .filter((行) => !组织离职交接未结束订单状态.includes(行.statusCode as never))
        .map((行) => 行.id)
        .sort();
      const 完成结果 = await db.query<{
        handoverStatus: string;
        eventStatus: string;
        sourceOffboardingStatus: string;
        customerItems: number;
        orderItems: number;
      }>(
        `SELECT
           (SELECT status_code FROM org.offboarding_handover WHERE id=$1::uuid) AS "handoverStatus",
           (SELECT status_code FROM ops.outbox_events WHERE id=$2::uuid) AS "eventStatus",
           (SELECT offboarding_status FROM iam.users WHERE id=$3::uuid) AS "sourceOffboardingStatus",
           (SELECT count(*)::int FROM org.offboarding_handover_items
             WHERE handover_id=$1::uuid AND domain_code='customer') AS "customerItems",
           (SELECT count(*)::int FROM org.offboarding_handover_items
             WHERE handover_id=$1::uuid AND domain_code='order') AS "orderItems"`,
        [场景.handoverId, 场景.eventId, 场景.sourceUserId],
      );
      expect(完成结果.rows[0]).toEqual({
        handoverStatus: "completed",
        eventStatus: "sent",
        sourceOffboardingStatus: "offboarded",
        customerItems: 205,
        orderItems: 组织离职交接未结束订单状态.length,
      });

      const 已转订单 = await db.query<{ id: string }>(
        `SELECT id::text AS id FROM crm.orders
         WHERE extra_json->>'testRun'=$1 AND owner_user_id=$2::uuid ORDER BY id`,
        [测试前缀, 场景.replacementUserId],
      );
      const 保留订单 = await db.query<{ id: string }>(
        `SELECT id::text AS id FROM crm.orders
         WHERE extra_json->>'testRun'=$1 AND owner_user_id=$2::uuid ORDER BY id`,
        [测试前缀, 场景.sourceUserId],
      );
      expect(已转订单.rows.map((行) => 行.id)).toEqual(有效订单编号);
      expect(保留订单.rows.map((行) => 行.id)).toEqual(终态订单编号);

      const 明细真实编号 = await db.query<{ id: string }>(
        `SELECT object_id::text AS id FROM org.offboarding_handover_items
         WHERE handover_id=$1::uuid AND domain_code='customer' ORDER BY object_id`,
        [场景.handoverId],
      );
      expect(明细真实编号.rows.map((行) => 行.id)).toEqual([...客户编号].sort());
      const 审计 = await db.query<{
        actorUserId: string | null;
        actionCode: string;
        objectIds: string[] | null;
        initiatedByUserId: string;
      }>(
        `SELECT actor_user_id::text AS "actorUserId",action_code AS "actionCode",
                ARRAY(SELECT jsonb_array_elements_text(COALESCE(extra_json->'objectIds','[]'::jsonb))) AS "objectIds",
                extra_json->>'initiatedByUserId' AS "initiatedByUserId"
         FROM audit.audit_logs
         WHERE target_id=$1 AND action_code IN (
           'offboarding.owner_transferred','offboarding.completed'
         ) ORDER BY created_at,id`,
        [场景.handoverId],
      );
      const 客户审计编号 = 审计.rows
        .filter((行) => 行.objectIds?.length)
        .flatMap((行) => 行.objectIds || [])
        .filter((id) => 客户编号.includes(id))
        .sort();
      expect(客户审计编号).toEqual([...客户编号].sort());
      expect(审计.rows.every((行) => 行.actorUserId === null)).toBe(true);
      expect(审计.rows.every((行) => 行.initiatedByUserId === 场景.replacementUserId)).toBe(true);
      expect(审计.rows.some((行) => 行.actionCode === "offboarding.completed")).toBe(true);

      const 幂等前审计数 = 审计.rows.length;
      await expect(存储.处理下一事件()).resolves.toBe(false);
      const 幂等后审计数 = await db.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM audit.audit_logs
         WHERE target_id=$1 AND action_code IN (
           'offboarding.owner_transferred','offboarding.completed'
         )`,
        [场景.handoverId],
      );
      expect(幂等后审计数.rows[0]!.count).toBe(幂等前审计数);
    } finally {
      await 存储.关闭();
    }
  });

  it.each([
    ["账号失效", "account"],
    ["角色变化", "role"],
    ["区域变化", "region"],
  ] as const)("接收人%s时事务不转移业务并登记可重试失败", async (_名称, 场景类型) => {
    const db = 获取连接池();
    const 场景 = await 创建交接场景();
    const 客户编号 = (await 新增客户(场景.sourceUserId, 1))[0]!;
    if (场景类型 === "account") {
      await db.query("UPDATE iam.users SET status_code='disabled' WHERE id=$1::uuid", [
        场景.replacementUserId,
      ]);
    } else if (场景类型 === "role") {
      await db.query("DELETE FROM iam.user_roles WHERE user_id=$1::uuid", [场景.replacementUserId]);
    } else {
      const otherRegionId = await 创建区域();
      await db.query("UPDATE iam.users SET region_id=$1::uuid WHERE id=$2::uuid", [
        otherRegionId,
        场景.replacementUserId,
      ]);
    }
    const 存储 = 创建任务存储();
    try {
      await expect(存储.处理下一事件()).resolves.toBe(true);
      const 结果 = await db.query<{
        ownerUserId: string;
        eventStatus: string;
        retryCount: number;
        canRetry: boolean;
        itemCount: number;
        handoverStatus: string;
      }>(
        `SELECT
           (SELECT owner_user_id::text FROM crm.customers WHERE id=$1::uuid) AS "ownerUserId",
           (SELECT status_code FROM ops.outbox_events WHERE id=$2::uuid) AS "eventStatus",
           (SELECT retry_count FROM ops.outbox_events WHERE id=$2::uuid) AS "retryCount",
           (SELECT next_retry_at IS NOT NULL FROM ops.outbox_events WHERE id=$2::uuid) AS "canRetry",
           (SELECT count(*)::int FROM org.offboarding_handover_items
             WHERE handover_id=$3::uuid) AS "itemCount",
           (SELECT status_code FROM org.offboarding_handover WHERE id=$3::uuid) AS "handoverStatus"`,
        [客户编号, 场景.eventId, 场景.handoverId],
      );
      expect(结果.rows[0]).toEqual({
        ownerUserId: 场景.sourceUserId,
        eventStatus: "failed",
        retryCount: 1,
        canRetry: true,
        itemCount: 0,
        handoverStatus: "pending_scan",
      });
      await db.query(
        "UPDATE ops.outbox_events SET next_retry_at=now()+interval '1 day' WHERE id=$1::uuid",
        [场景.eventId],
      );
    } finally {
      await 存储.关闭();
    }
  });

  it("第八次失败停止自动重试、转人工并写入失败审计", async () => {
    const db = 获取连接池();
    const 场景 = await 创建交接场景({
      replacementRole: null,
      retryCount: 组织离职交接最大重试次数 - 1,
    });
    await 新增客户(场景.sourceUserId, 1);
    const 存储 = 创建任务存储();
    try {
      await expect(存储.处理下一事件()).resolves.toBe(true);
      const 结果 = await db.query<{
        eventStatus: string;
        retryCount: number;
        retryStopped: boolean;
        manualActionRequired: boolean;
        handoverStatus: string;
        auditCount: number;
        systemAuditCount: number;
      }>(
        `SELECT
           (SELECT status_code FROM ops.outbox_events WHERE id=$1::uuid) AS "eventStatus",
           (SELECT retry_count FROM ops.outbox_events WHERE id=$1::uuid) AS "retryCount",
           (SELECT next_retry_at IS NULL FROM ops.outbox_events WHERE id=$1::uuid) AS "retryStopped",
           (SELECT COALESCE((payload_json->>'manualActionRequired')::boolean,false)
              FROM ops.outbox_events WHERE id=$1::uuid) AS "manualActionRequired",
           (SELECT status_code FROM org.offboarding_handover WHERE id=$2::uuid) AS "handoverStatus",
           (SELECT count(*)::int FROM audit.audit_logs
              WHERE target_id=$2::text AND action_code='offboarding.transfer_failed') AS "auditCount",
           (SELECT count(*)::int FROM audit.audit_logs
              WHERE target_id=$2::text AND action_code='offboarding.transfer_failed'
                AND actor_user_id IS NULL AND actor_username='system') AS "systemAuditCount"`,
        [场景.eventId, 场景.handoverId],
      );
      expect(结果.rows[0]).toEqual({
        eventStatus: "failed",
        retryCount: 组织离职交接最大重试次数,
        retryStopped: true,
        manualActionRequired: true,
        handoverStatus: "partial_failed",
        auditCount: 1,
        systemAuditCount: 1,
      });
      await expect(存储.处理下一事件()).resolves.toBe(false);
    } finally {
      await 存储.关闭();
    }
  });
});
