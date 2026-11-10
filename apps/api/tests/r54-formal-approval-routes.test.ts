import { randomUUID } from "node:crypto";

import { 创建测试环境变量 } from "@lianruan/testing";
import { Pool } from "pg";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { 创建密码散列 } from "../src/auth-routes.js";
import { 创建应用 } from "../src/index.js";
import { 执行审计维护删除 } from "./审计维护清理.js";

const 测试环境变量 = 创建测试环境变量({
  V3_DELIVERY_AUTH_ENABLED: "true",
  V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
  V3_DELIVERY_AUTH_USERS_JSON: "[]",
});

describe("R54 正式审批接口", () => {
  it("渠道商审批通过和驳回均写入目标状态、审批事件与审计日志", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 后缀 = randomUUID().slice(0, 8);
    const 渠道编号 = `R54-APPROVAL-${后缀}`;
    let 通过审批编号 = "";
    let 驳回审批编号 = "";

    try {
      const 超管 = await pool.query<{ username: string; displayName: string }>(
        `
          SELECT u.username::text AS username, u.display_name AS "displayName"
          FROM iam.users u
          JOIN iam.user_roles ur ON ur.user_id = u.id
          JOIN iam.roles r ON r.id = ur.role_id
          WHERE u.status_code = 'active' AND r.role_code = 'superadmin'
          ORDER BY CASE WHEN u.username::text = 'liulonghai' THEN 0 ELSE 1 END, u.created_at
          LIMIT 1
          `,
      );
      const 超管账号 = 超管.rows[0];
      if (!超管账号) throw new Error("测试库缺少可登录的超级管理员账号。");

      const 通过渠道 = await pool.query<{ id: string }>(
        `
          INSERT INTO channel.partners (
            partner_code, partner_name, normalized_name, partner_level_code, status_code, extra_json
          )
          VALUES ($1, $2, $2, 'primary', 'pending', $3::jsonb)
          RETURNING id::text AS id
          `,
        [`${渠道编号}-PASS`, `R54审批通过渠道-${后缀}`, JSON.stringify({ testRun: 后缀 })],
      );
      const 驳回渠道 = await pool.query<{ id: string }>(
        `
          INSERT INTO channel.partners (
            partner_code, partner_name, normalized_name, partner_level_code, status_code, extra_json
          )
          VALUES ($1, $2, $2, 'primary', 'pending', $3::jsonb)
          RETURNING id::text AS id
          `,
        [`${渠道编号}-REJECT`, `R54审批驳回渠道-${后缀}`, JSON.stringify({ testRun: 后缀 })],
      );
      const 通过渠道编号 = 通过渠道.rows[0]?.id;
      const 驳回渠道编号 = 驳回渠道.rows[0]?.id;
      if (!通过渠道编号 || !驳回渠道编号) throw new Error("创建审批测试渠道失败。");

      const 审批记录 = await pool.query<{ id: string; target_id: string }>(
        `
          INSERT INTO ops.approvals (
            approval_type_code, target_type, target_id, status_code, extra_json
          )
          VALUES
            ('partner', 'partner', $1::uuid, 'pending', $2::jsonb),
            ('partner', 'partner', $3::uuid, 'pending', $4::jsonb)
          RETURNING id::text AS id, target_id::text AS target_id
          `,
        [
          通过渠道编号,
          JSON.stringify({ targetName: `R54审批通过渠道-${后缀}`, status: "pending" }),
          驳回渠道编号,
          JSON.stringify({ targetName: `R54审批驳回渠道-${后缀}`, status: "pending" }),
        ],
      );
      通过审批编号 = 审批记录.rows.find((行) => 行.target_id === 通过渠道编号)?.id || "";
      驳回审批编号 = 审批记录.rows.find((行) => 行.target_id === 驳回渠道编号)?.id || "";
      expect(通过审批编号).not.toBe("");
      expect(驳回审批编号).not.toBe("");

      const 会话 = request.agent(app);
      await 会话
        .post("/api/auth/login")
        .send({ username: 超管账号.username, password: "LrCRM@2026!" })
        .expect(200);

      const 通过响应 = await 会话
        .put(`/api/approvals/${通过审批编号}/status`)
        .send({ action: "approve", remark: "R54 自动化审核通过" })
        .expect(200);
      expect(通过响应.body.data.状态).toBe("approved");
      expect(通过响应.body.data.原始数据.approvalId).toBe(通过审批编号);
      await 会话
        .put(`/api/approvals/${驳回审批编号}/status`)
        .send({ action: "reject", remark: "资料不完整，请补充后重新提交" })
        .expect(200);

      const 渠道结果 = await pool.query<{
        partner_code: string;
        status_code: string;
        reviewRemark: string;
        reviewedByName: string;
      }>(
        `
          SELECT partner_code, status_code, extra_json->>'reviewRemark' AS "reviewRemark",
            extra_json->>'reviewedByName' AS "reviewedByName"
          FROM channel.partners
          WHERE id = ANY($1::uuid[])
          ORDER BY partner_code
          `,
        [[通过渠道编号, 驳回渠道编号]],
      );
      expect(渠道结果.rows).toEqual([
        {
          partner_code: `${渠道编号}-PASS`,
          status_code: "active",
          reviewRemark: "R54 自动化审核通过",
          reviewedByName: 超管账号.displayName,
        },
        {
          partner_code: `${渠道编号}-REJECT`,
          status_code: "rejected",
          reviewRemark: "资料不完整，请补充后重新提交",
          reviewedByName: 超管账号.displayName,
        },
      ]);

      const 审批事件 = await pool.query<{
        event_code: string;
        from_status_code: string;
        to_status_code: string;
        reason: string;
        actorName: string;
      }>(
        `
          SELECT event_code, from_status_code, to_status_code, reason,
            extra_json->>'actorName' AS "actorName"
          FROM ops.approval_events
          WHERE approval_id = ANY($1::uuid[])
          ORDER BY event_at, event_code
          `,
        [[通过审批编号, 驳回审批编号]],
      );
      expect(审批事件.rows).toEqual([
        {
          event_code: "approve",
          from_status_code: "pending",
          to_status_code: "approved",
          reason: "R54 自动化审核通过",
          actorName: 超管账号.displayName,
        },
        {
          event_code: "reject",
          from_status_code: "pending",
          to_status_code: "rejected",
          reason: "资料不完整，请补充后重新提交",
          actorName: 超管账号.displayName,
        },
      ]);

      const 审计日志 = await pool.query<{
        target_id: string;
        actor_name: string;
        result_code: string;
        remark: string;
      }>(
        `
          SELECT target_id, actor_name, result_code, after_json->>'remark' AS remark
          FROM audit.audit_logs
          WHERE module_code = 'partner'
            AND action_code LIKE 'approval.%'
            AND target_id = ANY($1::text[])
          ORDER BY target_id
          `,
        [[通过审批编号, 驳回审批编号]],
      );
      expect(审计日志.rows).toHaveLength(2);
      expect(审计日志.rows).toEqual(
        expect.arrayContaining([
          {
            target_id: 通过审批编号,
            actor_name: 超管账号.displayName,
            result_code: "success",
            remark: "R54 自动化审核通过",
          },
          {
            target_id: 驳回审批编号,
            actor_name: 超管账号.displayName,
            result_code: "success",
            remark: "资料不完整，请补充后重新提交",
          },
        ]),
      );
    } finally {
      const 审批编号 = [通过审批编号, 驳回审批编号].filter(Boolean);
      if (审批编号.length) {
        await 执行审计维护删除(pool, "target_id = ANY($1::text[])", [审批编号]).catch(
          () => undefined,
        );
        await pool
          .query("DELETE FROM ops.approvals WHERE id = ANY($1::uuid[])", [审批编号])
          .catch(() => undefined);
      }
      await pool
        .query("DELETE FROM channel.partners WHERE partner_code LIKE $1", [`${渠道编号}-%`])
        .catch(() => undefined);
      await pool.end();
    }
  }, 30_000);

  it("客户报备通过正式审批接口处理后，报备状态与审批记录同步更新", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 后缀 = randomUUID().slice(0, 8);
    const 客户名称 = `R54报备审批客户-${后缀}`;
    let 客户编号 = "";
    let 报备编号 = "";
    let 审批编号 = "";

    try {
      const 超管 = await pool.query<{
        id: string;
        username: string;
        displayName: string;
      }>(
        `
          SELECT u.id::text AS id, u.username::text AS username,
            u.display_name AS "displayName"
          FROM iam.users u
          JOIN iam.user_roles ur ON ur.user_id = u.id
          JOIN iam.roles r ON r.id = ur.role_id
          WHERE u.status_code = 'active' AND r.role_code = 'superadmin'
          ORDER BY CASE WHEN u.username::text = 'liulonghai' THEN 0 ELSE 1 END, u.created_at
          LIMIT 1
          `,
      );
      const 超管账号 = 超管.rows[0];
      if (!超管账号) throw new Error("测试库缺少可登录的超级管理员账号。");

      const 客户 = await pool.query<{ id: string }>(
        `
          INSERT INTO crm.customers (customer_name, normalized_name, owner_user_id, extra_json)
          VALUES ($1, $2, $3::uuid, $4::jsonb)
          RETURNING id::text AS id
          `,
        [客户名称, 客户名称.toLowerCase(), 超管账号.id, JSON.stringify({ testRun: 后缀 })],
      );
      客户编号 = 客户.rows[0]?.id || "";
      if (!客户编号) throw new Error("创建报备审批测试客户失败。");

      const 报备 = await pool.query<{ id: string }>(
        `
          INSERT INTO crm.registrations (
            registration_no, customer_id, owner_user_id, status_code, submitted_at, extra_json
          )
          VALUES ($1, $2::uuid, $3::uuid, 'pending', now(), $4::jsonb)
          RETURNING id::text AS id
          `,
        [
          `R54-REG-${后缀}`,
          客户编号,
          超管账号.id,
          JSON.stringify({
            customer: 客户名称,
            customerName: 客户名称,
            submittedByUserId: 超管账号.id,
            status: "pending",
          }),
        ],
      );
      报备编号 = 报备.rows[0]?.id || "";
      if (!报备编号) throw new Error("创建报备审批测试报备失败。");

      const 审批 = await pool.query<{ id: string }>(
        `
          INSERT INTO ops.approvals (
            approval_type_code, target_type, target_id, applicant_user_id, status_code, extra_json
          )
          VALUES ('registration', 'registration', $1::uuid, $2::uuid, 'pending', $3::jsonb)
          RETURNING id::text AS id
          `,
        [报备编号, 超管账号.id, JSON.stringify({ targetName: 客户名称, status: "pending" })],
      );
      审批编号 = 审批.rows[0]?.id || "";
      if (!审批编号) throw new Error("创建报备审批测试审批记录失败。");

      const 会话 = request.agent(app);
      await 会话
        .post("/api/auth/login")
        .send({ username: 超管账号.username, password: "LrCRM@2026!" })
        .expect(200);
      await 会话
        .put(`/api/approvals/${审批编号}/status`)
        .send({ action: "reject", remark: "R54 报备资料不完整，请补充后重新提交" })
        .expect(200);

      const 报备结果 = await pool.query<{
        status_code: string;
        reviewRemark: string;
        reviewedByName: string;
      }>(
        `
          SELECT status_code, extra_json->>'reviewRemark' AS "reviewRemark",
            extra_json->>'reviewedByName' AS "reviewedByName"
          FROM crm.registrations
          WHERE id = $1::uuid
          `,
        [报备编号],
      );
      expect(报备结果.rows[0]).toEqual({
        status_code: "rejected",
        reviewRemark: "R54 报备资料不完整，请补充后重新提交",
        reviewedByName: 超管账号.displayName,
      });

      const 审批结果 = await pool.query<{
        status_code: string;
        reviewRemark: string;
        reviewedByName: string;
      }>(
        `
          SELECT status_code, extra_json->>'reviewRemark' AS "reviewRemark",
            extra_json->>'reviewedByName' AS "reviewedByName"
          FROM ops.approvals
          WHERE id = $1::uuid
          `,
        [审批编号],
      );
      expect(审批结果.rows[0]).toEqual({
        status_code: "rejected",
        reviewRemark: "R54 报备资料不完整，请补充后重新提交",
        reviewedByName: 超管账号.displayName,
      });

      const 待审批复查 = await 会话
        .get("/api/stage9/approvals?status=pending&pageSize=100")
        .expect(200);
      expect(
        待审批复查.body.data.数据.some((项: { 客户名称?: string }) => 项.客户名称 === 客户名称),
      ).toBe(false);
    } finally {
      if (报备编号) {
        await 执行审计维护删除(pool, "target_id = $1", [报备编号]).catch(() => undefined);
        await pool
          .query("DELETE FROM ops.outbox_events WHERE aggregate_id = $1", [报备编号])
          .catch(() => undefined);
      }
      if (审批编号) {
        await pool
          .query("DELETE FROM ops.approvals WHERE id = $1::uuid", [审批编号])
          .catch(() => undefined);
      }
      if (报备编号) {
        await pool
          .query("DELETE FROM crm.registrations WHERE id = $1::uuid", [报备编号])
          .catch(() => undefined);
      }
      if (客户编号) {
        await pool
          .query("DELETE FROM crm.customers WHERE id = $1::uuid", [客户编号])
          .catch(() => undefined);
      }
      await pool.end();
    }
  }, 30_000);

  it("渠道成员驳回后保留已驳回状态、原因，并在登录时展示审批提示", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 后缀 = randomUUID().slice(0, 8);
    const 渠道编号 = `R54-MEMBER-${后缀}`;
    const 登录名 = `r54_member_${后缀}`;
    const 密码 = "R54Test@2026!";
    let 渠道UUID = "";
    let 用户UUID = "";
    let 审批编号 = "";

    try {
      const 超管 = await pool.query<{ username: string }>(
        `
          SELECT u.username::text AS username
          FROM iam.users u
          JOIN iam.user_roles ur ON ur.user_id = u.id
          JOIN iam.roles r ON r.id = ur.role_id
          WHERE u.status_code = 'active' AND r.role_code = 'superadmin'
          ORDER BY CASE WHEN u.username::text = 'liulonghai' THEN 0 ELSE 1 END, u.created_at
          LIMIT 1
          `,
      );
      const 超管账号 = 超管.rows[0];
      if (!超管账号) throw new Error("测试库缺少可登录的超级管理员账号。");

      const 渠道 = await pool.query<{ id: string }>(
        `
          INSERT INTO channel.partners (
            partner_code, partner_name, normalized_name, partner_level_code, status_code, extra_json
          )
          VALUES ($1, $2, $2, 'primary', 'active', $3::jsonb)
          RETURNING id::text AS id
          `,
        [渠道编号, `R54成员驳回渠道-${后缀}`, JSON.stringify({ testRun: 后缀 })],
      );
      渠道UUID = 渠道.rows[0]?.id || "";
      if (!渠道UUID) throw new Error("创建渠道成员审批测试渠道失败。");

      const 用户 = await pool.query<{ id: string }>(
        `
          INSERT INTO iam.users (username, display_name, status_code, extra_json)
          VALUES ($1, $2, 'active', $3::jsonb)
          RETURNING id::text AS id
          `,
        [登录名, `R54驳回成员-${后缀}`, JSON.stringify({ status: "pending" })],
      );
      用户UUID = 用户.rows[0]?.id || "";
      if (!用户UUID) throw new Error("创建渠道成员审批测试账号失败。");

      await pool.query(
        `
          INSERT INTO iam.password_credentials (
            user_id, password_hash, algorithm, must_change_password
          )
          VALUES ($1::uuid, $2, 'scrypt', false)
          `,
        [用户UUID, 创建密码散列(密码, Buffer.from("0123456789abcdef"))],
      );
      await pool.query(
        `
          INSERT INTO channel.partner_members (
            partner_id, user_id, member_role_code, status_code
          )
          VALUES ($1::uuid, $2::uuid, 'staff', 'active')
          `,
        [渠道UUID, 用户UUID],
      );

      const 审批 = await pool.query<{ id: string }>(
        `
          INSERT INTO ops.approvals (
            approval_type_code, target_type, target_id, applicant_partner_id,
            status_code, extra_json
          )
          VALUES ('user', 'user', $1::uuid, $2::uuid, 'pending', $3::jsonb)
          RETURNING id::text AS id
          `,
        [
          用户UUID,
          渠道UUID,
          JSON.stringify({
            targetName: `R54驳回成员-${后缀}`,
            targetType: "user",
            type: "staff",
            status: "pending",
          }),
        ],
      );
      审批编号 = 审批.rows[0]?.id || "";
      if (!审批编号) throw new Error("创建渠道成员审批测试待办失败。");

      const 会话 = request.agent(app);
      await 会话
        .post("/api/auth/login")
        .send({ username: 超管账号.username, password: "LrCRM@2026!" })
        .expect(200);
      await 会话
        .put(`/api/approvals/${审批编号}/status`)
        .send({ action: "reject", remark: "成员证书与岗位不匹配，请补充材料后重新提交。" })
        .expect(200);

      const 渠道详情 = await 会话.get(`/api/partners/${渠道编号}`).expect(200);
      const 成员 = (渠道详情.body.data.原始数据.staff as Array<Record<string, unknown>>).find(
        (项) => 项.username === 登录名,
      );
      expect(成员).toMatchObject({
        status: "rejected",
        reviewRemark: "成员证书与岗位不匹配，请补充材料后重新提交。",
      });

      const 登录响应 = await request(app)
        .post("/api/auth/login")
        .send({ username: 登录名, password: 密码 })
        .expect(401);
      expect(登录响应.body.error.message).toBe(
        "账号审批未通过：成员证书与岗位不匹配，请补充材料后重新提交。",
      );
    } finally {
      if (审批编号) {
        await 执行审计维护删除(pool, "target_id = $1", [审批编号]).catch(() => undefined);
        await pool
          .query("DELETE FROM ops.approval_events WHERE approval_id = $1::uuid", [审批编号])
          .catch(() => undefined);
        await pool
          .query("DELETE FROM ops.approvals WHERE id = $1::uuid", [审批编号])
          .catch(() => undefined);
      }
      if (用户UUID) {
        await pool
          .query("DELETE FROM channel.partner_members WHERE user_id = $1::uuid", [用户UUID])
          .catch(() => undefined);
        await pool
          .query("DELETE FROM iam.password_credentials WHERE user_id = $1::uuid", [用户UUID])
          .catch(() => undefined);
        await pool
          .query("DELETE FROM iam.users WHERE id = $1::uuid", [用户UUID])
          .catch(() => undefined);
      }
      if (渠道UUID) {
        await pool
          .query("DELETE FROM channel.partners WHERE id = $1::uuid", [渠道UUID])
          .catch(() => undefined);
      }
      await pool.end();
    }
  }, 30_000);
});
