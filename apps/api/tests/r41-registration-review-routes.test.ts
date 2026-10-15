import { 创建测试环境变量 } from "@lianruan/testing";
import { Pool } from "pg";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { 创建应用 } from "../src/index.js";

const 测试环境变量 = 创建测试环境变量();

describe("R41 客户报备审核路由", () => {
  it("资料保存不改变报备状态，状态流转会同步审批记录", async () => {
    const app = 创建应用({
      env: {
        ...测试环境变量,
        V3_DELIVERY_AUTH_ENABLED: "true",
        V3_DELIVERY_AUTH_COOKIE_SECURE: "false",
        V3_DELIVERY_AUTH_USERS_JSON: "[]",
      },
    });
    const pool = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 批次 = `R41-报备审核-${Date.now()}`;
    const 客户名称 = `${批次}-客户`;
    let 报备编号 = "";
    try {
      const 报备 = await request(app)
        .post("/api/registrations")
        .send({
          customer: 客户名称,
          creditCode: `91R41${Date.now()}`,
          contact: "审核联系人",
          phone: "13900000000",
        })
        .expect(200);
      报备编号 = 报备.body.data.id;
      expect(报备.body.data.状态).toBe("pending");

      // 客户档案保存（不带 status）必须保持原状态，不能被默认成审核通过。
      const 资料保存 = await request(app)
        .put(`/api/registrations/${报备编号}`)
        .send({ customer: 客户名称, contact: "审核联系人（已更新）" })
        .expect(200);
      expect(资料保存.body.data.状态).toBe("pending");
      expect(资料保存.body.data.原始数据.contact).toBe("审核联系人（已更新）");

      const 待审核列表 = await request(app)
        .get("/api/stage9/approvals?status=pending&pageSize=100")
        .expect(200);
      expect(
        待审核列表.body.data.数据.some((项: { 客户名称: string }) => 项.客户名称 === 客户名称),
      ).toBe(true);

      // 状态流转：通过后审批记录同步为已通过，不再留在待审批列表。
      const 审核 = await request(app)
        .put(`/api/registrations/${报备编号}/status`)
        .send({ status: "approved", reason: "R41 自动化审核通过" })
        .expect(200);
      expect(审核.body.data.状态).toBe("approved");

      const 报备审计 = await pool.query<{ action_code: string; message: string }>(
        `SELECT action_code, message FROM audit.audit_logs
         WHERE module_code = 'registration' AND target_id = $1::text
         ORDER BY created_at DESC LIMIT 1`,
        [报备编号],
      );
      expect(报备审计.rows[0]?.action_code).toBe("change_status");
      expect(报备审计.rows[0]?.message).toContain("由「待审核」变更为「已通过」");

      const 待审核复查 = await request(app)
        .get("/api/stage9/approvals?status=pending&pageSize=100")
        .expect(200);
      expect(
        待审核复查.body.data.数据.some((项: { 客户名称: string }) => 项.客户名称 === 客户名称),
      ).toBe(false);

      const 全部审批 = await request(app).get("/api/stage9/approvals?pageSize=100").expect(200);
      expect(
        全部审批.body.data.数据.some(
          (项: { 客户名称: string; 状态: string }) =>
            项.客户名称 === 客户名称 && 项.状态 === "approved",
        ),
      ).toBe(true);
    } finally {
      if (报备编号) {
        await pool
          .query(
            "DELETE FROM audit.audit_logs WHERE module_code = 'registration' AND target_id = $1::text",
            [报备编号],
          )
          .catch(() => undefined);
        await pool
          .query(
            "DELETE FROM ops.approvals WHERE target_type = 'registration' AND target_id = $1::uuid",
            [报备编号],
          )
          .catch(() => undefined);
        await pool
          .query("DELETE FROM crm.registrations WHERE id = $1::uuid", [报备编号])
          .catch(() => undefined);
      }
      await pool.end();
    }
  });
});
