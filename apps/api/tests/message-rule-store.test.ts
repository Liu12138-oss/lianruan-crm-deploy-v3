import { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { 创建消息规则数据服务 } from "../src/message-rule-store.js";

describe("消息规则数据服务", () => {
  it("保存到期提醒规则时绑定全部参数并返回完整规则字段", async () => {
    const 当前时间 = new Date("2026-08-27T01:00:00.000Z");
    const 当前规则 = {
      rule_code: "m3_registration_expiring",
      reminder_code: "crm.registration.expiring",
      aggregate_type: "registration",
      rule_name: "客户报备保护期到期提醒",
      reminder_type: "expiry" as const,
      template_code: "m3_registration_expiring",
      data_source_code: "registration_protection_expiry",
      is_system: true,
      protection_level: "configurable" as const,
      status_code: "active" as const,
      advance_days: [30, 7, 1],
      dispatch_time: "09:00",
      workday_only: true,
      recipient_rule_json: { type: "business_owner" },
      channel_codes: ["in_app"],
      digest_window_minutes: 0,
      rule_version: 3,
      rule_updated_at: 当前时间,
      updated_by: "platform_superadmin",
    };
    let 更新语句 = "";
    let 更新参数: unknown[] = [];
    const 客户端 = {
      query: async (语句: string, 参数: unknown[] = []) => {
        if (语句 === "BEGIN" || 语句 === "COMMIT" || 语句 === "ROLLBACK") return { rows: [] };
        if (语句.includes("FOR UPDATE OF rule")) return { rows: [当前规则] };
        if (语句.includes("UPDATE message.reminder_rules")) {
          更新语句 = 语句;
          更新参数 = 参数;
          return {
            rows: [
              {
                ...当前规则,
                advance_days: [30, 7],
                channel_codes: ["in_app", "email"],
                rule_version: 4,
              },
            ],
          };
        }
        if (语句.includes("INSERT INTO audit.audit_logs")) return { rows: [] };
        throw new Error(`未覆盖的数据库语句：${语句}`);
      },
      release: () => undefined,
    };
    const 连接池 = {
      query: async (语句: string) => {
        if (语句.includes("FROM iam.users")) {
          return {
            rows: [{ id: "11111111-1111-4111-8111-111111111111", username: "platform_superadmin" }],
          };
        }
        throw new Error(`未覆盖的连接池语句：${语句}`);
      },
      connect: async () => 客户端,
    } as unknown as Pool;
    const 服务 = 创建消息规则数据服务({ pool: 连接池 });

    const 结果 = await 服务.更新到期提醒规则(
      { username: "platform_superadmin", requestId: "22222222-2222-4222-8222-222222222222" },
      当前规则.rule_code,
      {
        statusCode: "active",
        advanceDays: [30, 7],
        dispatchTime: "09:00",
        workdayOnly: true,
        recipientRule: "business_owner",
        channelCodes: ["in_app", "email"],
        digestWindowMinutes: 0,
        version: 3,
      },
    );

    expect(更新语句).toContain("$10::text AS updated_by");
    expect(更新参数).toHaveLength(10);
    expect(更新参数[9]).toBe("platform_superadmin");
    expect(结果).toMatchObject({
      templateCode: "m3_registration_expiring",
      dataSourceCode: "registration_protection_expiry",
      isSystem: true,
      updatedBy: "platform_superadmin",
      version: 4,
    });
  });
});
