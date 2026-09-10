import { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { 创建消息规则数据服务 } from "../src/message-rule-store.js";

describe("消息规则数据服务", () => {
  it("接收人候选按内部任职或有效管理角色读取，并记录读取审计", async () => {
    const 查询记录: Array<{ 语句: string; 参数: unknown[] }> = [];
    const 连接池 = {
      query: async (语句: string, 参数: unknown[] = []) => {
        查询记录.push({ 语句, 参数 });
        if (语句.includes("lower(username)")) {
          return {
            rows: [{ id: "11111111-1111-4111-8111-111111111111", username: "platform_superadmin" }],
          };
        }
        if (语句.includes("FROM iam.users u")) {
          return {
            rows: [
              {
                userId: "6f2fd9ae-1200-b247-9018-27de1ca8515c",
                username: "liulonghai",
                displayName: "刘龙海",
                hasWecomIdentity: true,
              },
            ],
          };
        }
        if (语句.includes("INSERT INTO audit.audit_logs")) return { rows: [] };
        throw new Error(`未覆盖的数据库语句：${语句}`);
      },
    } as unknown as Pool;
    const 服务 = 创建消息规则数据服务({ pool: 连接池 });

    await expect(
      服务.查询接收人候选({
        username: "platform_superadmin",
        requestId: "22222222-2222-4222-8222-222222222222",
      }),
    ).resolves.toEqual({
      items: [
        {
          userId: "6f2fd9ae-1200-b247-9018-27de1ca8515c",
          username: "liulonghai",
          displayName: "刘龙海",
          hasWecomIdentity: true,
        },
      ],
    });

    const 候选查询 = 查询记录.find((记录) => 记录.语句.includes("FROM iam.users u"));
    expect(候选查询?.语句).toContain("org.staff_assignments");
    expect(候选查询?.语句).toContain("role.role_code IN ('superadmin', 'admin', 'region_manager')");
    expect(
      查询记录.some(
        (记录) =>
          记录.语句.includes("INSERT INTO audit.audit_logs") &&
          记录.参数.includes("read_recipient_candidates"),
      ),
    ).toBe(true);
  });

  it("保存指定用户范围时拒绝非内部提醒账号", async () => {
    const 客户端查询: string[] = [];
    const 客户端 = {
      query: async (语句: string) => {
        客户端查询.push(语句);
        if (语句 === "BEGIN" || 语句 === "ROLLBACK") return { rows: [] };
        if (语句.includes("FOR UPDATE OF subscription")) {
          return {
            rows: [
              {
                subscription_code: "m1_order_status_in_app",
                rule_version: 1,
                protection_level: "configurable",
                recipient_rule_json: { type: "users", scope: { type: "users", userIds: [] } },
                rule_name: "订单状态变化",
              },
            ],
          };
        }
        if (语句.includes("SELECT u.id::text AS id")) return { rows: [] };
        throw new Error(`不应执行数据库语句：${语句}`);
      },
      release: () => undefined,
    };
    const 连接池 = {
      query: async (语句: string) => {
        if (语句.includes("lower(username)")) {
          return {
            rows: [{ id: "11111111-1111-4111-8111-111111111111", username: "platform_superadmin" }],
          };
        }
        throw new Error(`未覆盖的连接池语句：${语句}`);
      },
      connect: async () => 客户端,
    } as unknown as Pool;
    const 服务 = 创建消息规则数据服务({ pool: 连接池 });

    await expect(
      服务.更新事件规则(
        { username: "platform_superadmin", requestId: "22222222-2222-4222-8222-222222222222" },
        "m1_order_status_in_app",
        {
          statusCode: "active",
          version: 1,
          recipientScope: { type: "users", userIds: ["33333333-3333-4333-8333-333333333333"] },
        },
      ),
    ).rejects.toMatchObject({
      code: "V3_MESSAGE_RULE_RECIPIENT_UNAVAILABLE",
      statusCode: 409,
    });
    expect(客户端查询.some((语句) => 语句.includes("UPDATE message.event_subscriptions"))).toBe(
      false,
    );
  });

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
