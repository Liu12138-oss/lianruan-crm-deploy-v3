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

describe("渠道账号两级审批", () => {
  it("企业管理员提交后由区管初审、超管终审，任一级都不能越权", async () => {
    const app = 创建应用({ env: 测试环境变量 });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 后缀 = randomUUID().slice(0, 8);
    const 密码 = "TwoStage@2026!";
    const 渠道编号 = `TWO-STAGE-${后缀}`;
    const 企业管理员账号 = `two_stage_partner_admin_${后缀}`;
    const 区域管理员账号 = `two_stage_region_admin_${后缀}`;
    const 员工账号 = `two_stage_staff_${后缀}`;
    let 渠道UUID = "";
    let 企业管理员UUID = "";
    let 区域管理员UUID = "";
    let 员工UUID = "";
    let 审批编号 = "";
    let 区域自建员工UUID = "";
    let 区域自建审批编号 = "";

    try {
      const 超管查询 = await pool.query<{ username: string; display_name: string }>(
        `
        SELECT u.username::text AS username, u.display_name::text AS display_name
        FROM iam.users u
        JOIN iam.user_roles ur ON ur.user_id = u.id
        JOIN iam.roles r ON r.id = ur.role_id
        WHERE u.status_code = 'active' AND r.role_code = 'superadmin'
        ORDER BY CASE WHEN u.username::text = 'liulonghai' THEN 0 ELSE 1 END, u.created_at
        LIMIT 1
        `,
      );
      const 超管账号 = 超管查询.rows[0]?.username;
      const 超管姓名 = 超管查询.rows[0]?.display_name;
      if (!超管账号) throw new Error("测试库缺少可登录的超级管理员账号。");
      if (!超管姓名) throw new Error("测试库超级管理员缺少显示名称。");

      const 区域 = await pool.query<{ id: string }>(
        `
        SELECT id::text AS id
        FROM org.regions
        WHERE status_code = 'active'
        ORDER BY CASE WHEN region_name = '江苏区' THEN 0 ELSE 1 END, region_name
        LIMIT 1
        `,
      );
      const 区域编号 = 区域.rows[0]?.id;
      if (!区域编号) throw new Error("测试库缺少可用区域。");

      const 渠道 = await pool.query<{ id: string }>(
        `
        INSERT INTO channel.partners (
          partner_code, partner_name, normalized_name, partner_level_code,
          status_code, region_id, extra_json
        )
        VALUES ($1, $2, $2, 'primary', 'active', $3::uuid, $4::jsonb)
        RETURNING id::text AS id
        `,
        [
          渠道编号,
          `两级审批渠道-${后缀}`,
          区域编号,
          JSON.stringify({ testRun: 后缀, region: "两级审批测试区域" }),
        ],
      );
      渠道UUID = 渠道.rows[0]?.id || "";
      if (!渠道UUID) throw new Error("创建两级审批测试渠道失败。");

      const 创建账号 = async (账号: string, 姓名: string, 角色: string) => {
        const 用户 = await pool.query<{ id: string }>(
          `
          INSERT INTO iam.users (username, display_name, status_code, region_id, extra_json)
          VALUES ($1, $2, 'active', $3::uuid, $4::jsonb)
          RETURNING id::text AS id
          `,
          [
            账号,
            姓名,
            角色 === "region_manager" ? 区域编号 : null,
            JSON.stringify({ status: "active" }),
          ],
        );
        const 用户编号 = 用户.rows[0]?.id || "";
        if (!用户编号) throw new Error(`创建账号 ${账号} 失败。`);
        await pool.query(
          `
          INSERT INTO iam.user_roles (user_id, role_id)
          SELECT $1::uuid, id FROM iam.roles WHERE role_code = $2
          `,
          [用户编号, 角色],
        );
        await pool.query(
          `
          INSERT INTO iam.password_credentials (user_id, password_hash, algorithm, must_change_password)
          VALUES ($1::uuid, $2, 'scrypt', false)
          `,
          [用户编号, 创建密码散列(密码, Buffer.from("0123456789abcdef"))],
        );
        return 用户编号;
      };

      企业管理员UUID = await 创建账号(企业管理员账号, "两级审批企业管理员", "partner_admin");
      区域管理员UUID = await 创建账号(区域管理员账号, "两级审批区域管理员", "region_manager");
      await pool.query(
        `
        INSERT INTO channel.partner_members (partner_id, user_id, member_role_code, status_code)
        VALUES ($1::uuid, $2::uuid, 'partner_admin', 'active')
        `,
        [渠道UUID, 企业管理员UUID],
      );

      const 企业管理员 = request.agent(app);
      await 企业管理员
        .post("/api/auth/login")
        .send({ username: 企业管理员账号, password: 密码 })
        .expect(200);

      const 创建员工 = await 企业管理员
        .post(`/api/v2/partners/${渠道编号}/staff`)
        .send({
          username: 员工账号,
          name: "两级审批待审员工",
          role: "staff",
          accountRole: "staff",
          staffRole: "销售代表",
          businessRoleCode: "channel_sales",
          password: 密码,
          phone: `188${Date.now().toString().slice(-8)}`,
          status: "active",
        })
        .expect(200);
      expect(创建员工.body.success).toBe(true);
      员工UUID = String(创建员工.body.data?.id || "");
      if (!员工UUID) {
        const 员工 = await pool.query<{ id: string }>(
          "SELECT id::text AS id FROM iam.users WHERE lower(username::text)=lower($1)",
          [员工账号],
        );
        员工UUID = 员工.rows[0]?.id || "";
      }

      const 待审批 = await pool.query<{
        id: string;
        status_code: string;
        approval_stage: string;
        user_status: string;
        extra_status: string;
        member_status: string;
      }>(
        `
        SELECT a.id::text AS id, a.status_code, a.extra_json->>'approvalStage' AS approval_stage,
          u.status_code AS user_status, u.extra_json->>'status' AS extra_status,
          pm.status_code AS member_status
        FROM ops.approvals a
        JOIN iam.users u ON u.id = a.target_id
        JOIN channel.partner_members pm ON pm.user_id = u.id AND pm.partner_id = a.applicant_partner_id
        WHERE lower(u.username::text)=lower($1)
        ORDER BY a.created_at DESC
        LIMIT 1
        `,
        [员工账号],
      );
      const 待审批行 = 待审批.rows[0];
      审批编号 = 待审批行?.id || "";
      expect(待审批行).toMatchObject({
        status_code: "pending",
        approval_stage: "region_review",
        user_status: "disabled",
        extra_status: "pending",
        member_status: "disabled",
      });

      const 绕过审批 = await 企业管理员
        .put(`/api/v2/partners/${渠道编号}/staff/${员工账号}/status`)
        .send({ status: "active" })
        .expect(409);
      expect(绕过审批.body.error).toContain("不能直接启用");

      const 提权企业管理员 = await 企业管理员
        .post(`/api/v2/partners/${渠道编号}/staff`)
        .send({
          username: `two_stage_forbidden_admin_${后缀}`,
          name: "不允许提权账号",
          role: "partner_admin",
          accountRole: "partner_admin",
          password: 密码,
          phone: `189${Date.now().toString().slice(-8)}`,
        })
        .expect(403);
      expect(提权企业管理员.body.error).toContain("不能创建、编辑或提权企业管理员账号");

      const 超管 = request.agent(app);
      await 超管
        .post("/api/auth/login")
        .send({ username: 超管账号, password: "LrCRM@2026!" })
        .expect(200);
      const 超管越级 = await 超管
        .put(`/api/approvals/${审批编号}/status`)
        .send({ action: "approve", remark: "超管直接通过" })
        .expect(409);
      expect(超管越级.body.error.message).toContain("不能越级");

      const 区管 = request.agent(app);
      await 区管
        .post("/api/auth/login")
        .send({ username: 区域管理员账号, password: 密码 })
        .expect(200);
      const 区管初审 = await 区管
        .put(`/api/approvals/${审批编号}/status`)
        .send({ action: "approve", remark: "区管初审通过" })
        .expect(200);
      expect(区管初审.body.data.原始数据.approvalStage).toBe("superadmin_review");
      expect(区管初审.body.data.原始数据.reviewedByName).toContain("两级审批区域管理员");
      expect(区管初审.body.data.原始数据.reviewedByName).not.toContain("V2兼容审批");

      const 初审后 = await pool.query<{
        approval_status: string;
        approval_stage: string;
        user_status: string;
        extra_status: string;
        member_status: string;
      }>(
        `
        SELECT a.status_code AS approval_status, a.extra_json->>'approvalStage' AS approval_stage,
          u.status_code AS user_status, u.extra_json->>'status' AS extra_status,
          pm.status_code AS member_status
        FROM ops.approvals a
        JOIN iam.users u ON u.id = a.target_id
        JOIN channel.partner_members pm ON pm.user_id = u.id AND pm.partner_id = a.applicant_partner_id
        WHERE a.id = $1::uuid
        `,
        [审批编号],
      );
      expect(初审后.rows[0]).toMatchObject({
        approval_status: "pending",
        approval_stage: "superadmin_review",
        user_status: "disabled",
        extra_status: "pending",
        member_status: "disabled",
      });

      const 阶段提醒事件 = await pool.query<{ count: number }>(
        `
        SELECT count(*)::int AS count
        FROM ops.outbox_events
        WHERE event_type = 'iam.account.approval.pending'
          AND aggregate_id = $1::uuid
        `,
        [审批编号],
      );
      expect(阶段提醒事件.rows[0]?.count).toBe(2);

      const 未终审登录 = await request(app)
        .post("/api/auth/login")
        .send({ username: 员工账号, password: 密码 })
        .expect(401);
      expect(未终审登录.body.error.message).toContain("账号待审批");

      await 区管
        .put(`/api/approvals/${审批编号}/status`)
        .send({ action: "approve", remark: "区管越权终审" })
        .expect(403);

      const 超管终审 = await 超管
        .put(`/api/approvals/${审批编号}/status`)
        .send({ action: "approve", remark: "超管终审通过" })
        .expect(200);
      expect(超管终审.body.data.原始数据.approvalStageName).toBe("审批已通过");
      expect(超管终审.body.data.原始数据.stepName).toBe("审批已通过");
      expect(超管终审.body.data.原始数据.reviewedByName).toContain(超管姓名);
      expect(超管终审.body.data.原始数据.reviewedByName).not.toContain("V2兼容审批");

      const 终审后 = await pool.query<{
        approval_status: string;
        user_status: string;
        member_status: string;
      }>(
        `
        SELECT a.status_code AS approval_status, u.status_code AS user_status,
          pm.status_code AS member_status
        FROM ops.approvals a
        JOIN iam.users u ON u.id = a.target_id
        JOIN channel.partner_members pm ON pm.user_id = u.id AND pm.partner_id = a.applicant_partner_id
        WHERE a.id = $1::uuid
        `,
        [审批编号],
      );
      expect(终审后.rows[0]).toEqual({
        approval_status: "approved",
        user_status: "active",
        member_status: "active",
      });

      await request(app)
        .post("/api/auth/login")
        .send({ username: 员工账号, password: 密码 })
        .expect(200);

      const 区域自建员工账号 = `two_stage_region_staff_${后缀}`;
      await 区管
        .post(`/api/v2/partners/${渠道编号}/staff`)
        .send({
          username: 区域自建员工账号,
          name: "区管自建员工",
          role: "staff",
          accountRole: "staff",
          staffRole: "销售代表",
          businessRoleCode: "channel_sales",
          password: 密码,
          phone: `186${Date.now().toString().slice(-8)}`,
        })
        .expect(200);
      const 区域自建审批 = await pool.query<{ id: string; user_id: string; stage: string }>(
        `
        SELECT a.id::text AS id, u.id::text AS user_id, a.extra_json->>'approvalStage' AS stage
        FROM ops.approvals a
        JOIN iam.users u ON u.id=a.target_id
        WHERE lower(u.username::text)=lower($1)
        ORDER BY a.created_at DESC
        LIMIT 1
        `,
        [区域自建员工账号],
      );
      区域自建审批编号 = 区域自建审批.rows[0]?.id || "";
      区域自建员工UUID = 区域自建审批.rows[0]?.user_id || "";
      expect(区域自建审批.rows[0]?.stage).toBe("superadmin_review");
    } finally {
      const 审批编号列表 = [审批编号, 区域自建审批编号].filter(Boolean);
      if (审批编号列表.length) {
        await pool
          .query("DELETE FROM ops.outbox_events WHERE aggregate_id = ANY($1::uuid[])", [
            审批编号列表,
          ])
          .catch(() => undefined);
        await pool
          .query("DELETE FROM ops.approval_events WHERE approval_id = ANY($1::uuid[])", [
            审批编号列表,
          ])
          .catch(() => undefined);
        await pool
          .query("DELETE FROM ops.approvals WHERE id = ANY($1::uuid[])", [审批编号列表])
          .catch(() => undefined);
      }
      const 用户编号列表 = [员工UUID, 区域自建员工UUID, 企业管理员UUID, 区域管理员UUID].filter(
        Boolean,
      );
      if (用户编号列表.length) {
        await 执行审计维护删除(pool, "actor_user_id = ANY($1::uuid[])", [用户编号列表]).catch(
          () => undefined,
        );
        await 执行审计维护删除(pool, "target_id::text = ANY($1::text[])", [用户编号列表]).catch(
          () => undefined,
        );
        await pool
          .query("DELETE FROM channel.partner_members WHERE user_id = ANY($1::uuid[])", [
            用户编号列表,
          ])
          .catch(() => undefined);
        await pool
          .query("DELETE FROM iam.user_roles WHERE user_id = ANY($1::uuid[])", [用户编号列表])
          .catch(() => undefined);
        await pool
          .query("DELETE FROM iam.password_credentials WHERE user_id = ANY($1::uuid[])", [
            用户编号列表,
          ])
          .catch(() => undefined);
        await pool
          .query("DELETE FROM iam.users WHERE id = ANY($1::uuid[])", [用户编号列表])
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
