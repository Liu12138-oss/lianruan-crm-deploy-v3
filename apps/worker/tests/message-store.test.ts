import { 读取应用配置 } from "@lianruan/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

const 查询数据库 = vi.fn();

vi.mock("pg", () => ({
  Pool: class {
    public query = 查询数据库;
    public end = vi.fn();
  },
}));

import { 查询报备待审批接收人, 消息消费存储 } from "../src/message-store.js";

function 创建测试配置() {
  return 读取应用配置({
    APP_ENV: "test",
    DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/message_test",
  });
}

function 上海今天(): string {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" }))
    .toISOString()
    .slice(0, 10);
}

function 加天数(日期: string, 天数: number): string {
  const 值 = new Date(`${日期}T00:00:00Z`);
  值.setUTCDate(值.getUTCDate() + 天数);
  return 值.toISOString().slice(0, 10);
}

describe("到期提醒规则扫描", () => {
  beforeEach(() => {
    查询数据库.mockReset();
  });

  it("存在规则记录时展开规则中的提前天数，不回退单一全局提前天数", async () => {
    const 用户甲 = "22222222-2222-2222-2222-222222222222";
    const 用户乙 = "33333333-3333-3333-3333-333333333333";
    查询数据库
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [{ count: "2" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            rule_code: "m3_registration_expiring",
            reminder_code: "crm.registration.expiring",
            aggregate_type: "registration",
            advance_days: [30, 7, 1],
            dispatch_time: "00:00",
            workday_only: false,
            recipient_rule_json: { type: "business_owner" },
            channel_codes: ["in_app"],
            digest_window_minutes: 0,
            template_code: "m3_registration_expiring",
            data_source_code: "registration_expiring",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            aggregate_id: "11111111-1111-1111-1111-111111111111",
            owner_user_id: 用户甲,
            region_id: null,
            partner_id: null,
            due_on: 加天数(上海今天(), 30),
          },
          {
            aggregate_id: "44444444-4444-4444-4444-444444444444",
            owner_user_id: 用户乙,
            region_id: null,
            partner_id: null,
            due_on: 加天数(上海今天(), 7),
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ user_id: 用户甲 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rows: [{ user_id: 用户乙 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const 存储 = new 消息消费存储(创建测试配置());

    await expect(存储.扫描并投递到期提醒(创建测试配置())).resolves.toEqual({
      scheduledCount: 2,
      notifiedCount: 0,
    });

    const 规则查询语句 = 查询数据库.mock.calls[2]?.[0] as string;
    expect(规则查询语句).toContain("FROM message.reminder_rules rule");
    expect(规则查询语句).toContain("WHERE rule.status_code = 'active'");
    const 登记语句 = 查询数据库.mock.calls[5]?.[0] as string;
    expect(登记语句).toContain("INSERT INTO message.reminder_schedules");
    expect(登记语句).toContain("ON CONFLICT (semantic_key) DO NOTHING");
  });

  it("规则表尚无任何记录时保留旧的全局提前天数兼容路径", async () => {
    查询数据库
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const 配置 = 创建测试配置();
    const 存储 = new 消息消费存储(配置);

    await expect(存储.扫描并投递到期提醒(配置)).resolves.toEqual({
      scheduledCount: 1,
      notifiedCount: 0,
    });

    const 兼容登记语句 = 查询数据库.mock.calls[2]?.[0] as string;
    expect(兼容登记语句).toContain("SELECT $1::integer AS advance_days");
    expect(兼容登记语句).not.toContain("message.reminder_rules rule");
  });

  it("待投递查询携带当前尝试次数，用于生成可重试的队列任务编号", async () => {
    查询数据库.mockResolvedValueOnce({
      rows: [
        {
          delivery_id: "00000000-0000-4000-8000-000000000001",
          channel_code: "email",
          attempt_count: 2,
        },
      ],
    });
    const 存储 = new 消息消费存储(创建测试配置());

    await expect(存储.查询待入队外部投递(10)).resolves.toEqual([
      {
        deliveryId: "00000000-0000-4000-8000-000000000001",
        channelCode: "email",
        attemptNumber: 2,
      },
    ]);
    expect(查询数据库.mock.calls[0]?.[0]).toContain("attempt_count");
  });

  it("外部投递回写为 JSON 参数声明明确类型，避免 PostgreSQL 无法推断类型", async () => {
    const 连接 = {
      query: vi.fn().mockResolvedValue({}),
      release: vi.fn(),
    };
    const 存储 = new 消息消费存储(创建测试配置());
    (存储 as unknown as { 数据库连接池: { connect: () => Promise<typeof 连接> } }).数据库连接池 = {
      connect: vi.fn().mockResolvedValue(连接),
    };

    await 存储.记录外部投递结果(
      {
        deliveryId: "00000000-0000-4000-8000-000000000001",
        channelCode: "email",
        title: "测试",
        body: "测试正文",
        templateCode: "platform_test_email",
        attemptNumber: 1,
      },
      {
        statusCode: "success",
        retryable: false,
        providerCode: "smtp_generic",
        httpStatus: 250,
        summary: "SMTP 服务器已接受邮件。",
      },
    );

    const [更新语句, 参数] = 连接.query.mock.calls[1] as [string, unknown[]];
    expect(更新语句).toContain(
      "jsonb_build_object('providerCode', $4::text, 'httpStatus', $5::integer)",
    );
    expect(参数).toEqual([
      "00000000-0000-4000-8000-000000000001",
      "success",
      null,
      "smtp_generic",
      250,
      "SMTP 服务器已接受邮件。",
    ]);
    expect(连接.query).toHaveBeenCalledWith("COMMIT");
    expect(连接.release).toHaveBeenCalledOnce();
  });

  it("客户报备提醒从受控渠道与账号关系取得渠道商和提报人", async () => {
    const 领取连接 = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [
            {
              consumption_id: "00000000-0000-4000-8000-000000000001",
              source_event_id: "00000000-0000-4000-8000-000000000002",
              event_code: "crm.registration.approval.pending",
              aggregate_type: "registration",
              aggregate_id: "00000000-0000-4000-8000-000000000003",
            },
          ],
        })
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    const 执行连接 = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [
            {
              category_code: "todo",
              priority_code: "strong",
              channel_codes: ["in_app"],
              recipient_rule_json: { type: "registration_pending_approver" },
              subscription_code: "m1_registration_approval_pending",
              template_code: "m1_registration_approval_pending",
              title_template: "客户报备待审批",
              body_template:
                "渠道商【{{partner_name}}】、提报人【{{submitter_name}}】。客户报备【{{customer_name}}】待您审批。",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              customer_name: "验收客户",
              business_no: "BB-001",
              due_date: null,
              protect_days: null,
              partner_name: "联软渠道商",
              submitter_name: "湛怀玉",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ region_id: "00000000-0000-4000-8000-000000000004" }] })
        .mockResolvedValueOnce({ rows: [{ user_id: "00000000-0000-4000-8000-000000000005" }] })
        .mockResolvedValueOnce({ rows: [{ id: "00000000-0000-4000-8000-000000000006" }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    const 存储 = new 消息消费存储(创建测试配置());
    const 连接池 = {
      connect: vi.fn().mockResolvedValueOnce(领取连接).mockResolvedValueOnce(执行连接),
      query: vi.fn().mockResolvedValue({}),
    };
    (存储 as unknown as { 数据库连接池: typeof 连接池 }).数据库连接池 = 连接池;

    await expect(存储.处理一批站内消息(创建测试配置(), "2026-08-01T00:00:00Z", 10)).resolves.toBe(
      1,
    );

    const 变量查询 = 执行连接.query.mock.calls.find(([语句]) =>
      String(语句).includes("FROM crm.registrations registration"),
    )?.[0] as string;
    expect(变量查询).toContain("LEFT JOIN channel.partners partner");
    expect(变量查询).toContain("LEFT JOIN iam.users submitter");
    const 通知写入参数 = 执行连接.query.mock.calls.find(([语句]) =>
      String(语句).includes("INSERT INTO message.notifications"),
    )?.[1] as unknown[];
    expect(通知写入参数).toContain(
      "渠道商【联软渠道商】、提报人【湛怀玉】。客户报备【验收客户】待您审批。",
    );
  });

  it("订单提醒按项目名称优先、商机名称兜底，并渲染订单号、渠道商和提交人", async () => {
    const 领取连接 = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [
            {
              consumption_id: "00000000-0000-4000-8000-000000000011",
              source_event_id: "00000000-0000-4000-8000-000000000012",
              event_code: "crm.order.confirmed",
              aggregate_type: "order",
              aggregate_id: "00000000-0000-4000-8000-000000000013",
            },
          ],
        })
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    const 执行连接 = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [
            {
              category_code: "business",
              priority_code: "normal",
              channel_codes: ["in_app"],
              recipient_rule_json: { type: "business_owner" },
              subscription_code: "m1_order_confirmed_in_app",
              template_code: "m1_order_confirmed",
              title_template: "订单确认完成",
              body_template:
                "订单确认完成。订单号：{{business_no}}；订单名称：{{order_name}}；订单渠道商：{{partner_name}}；提交人：{{submitter_name}}。",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              customer_name: "验收客户",
              order_name: "项目名称优先",
              business_no: "DD-001",
              amount: "1000",
              partner_name: "联软渠道商",
              submitter_name: "湛怀玉",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ user_id: "00000000-0000-4000-8000-000000000014" }] })
        .mockResolvedValueOnce({ rows: [{ id: "00000000-0000-4000-8000-000000000015" }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    const 存储 = new 消息消费存储(创建测试配置());
    const 连接池 = {
      connect: vi.fn().mockResolvedValueOnce(领取连接).mockResolvedValueOnce(执行连接),
      query: vi.fn().mockResolvedValue({}),
    };
    (存储 as unknown as { 数据库连接池: typeof 连接池 }).数据库连接池 = 连接池;

    await expect(存储.处理一批站内消息(创建测试配置(), "2026-08-01T00:00:00Z", 10)).resolves.toBe(
      1,
    );

    const 变量查询 = 执行连接.query.mock.calls.find(([语句]) =>
      String(语句).includes("FROM crm.orders order_record"),
    )?.[0] as string;
    expect(变量查询).toContain("NULLIF(order_record.extra_json->>'projectName', '')");
    expect(变量查询).toContain("NULLIF(opportunity.extra_json->>'name', '')");
    expect(变量查询).toContain("'未填写订单名称'");
    const 通知写入参数 = 执行连接.query.mock.calls.find(([语句]) =>
      String(语句).includes("INSERT INTO message.notifications"),
    )?.[1] as unknown[];
    expect(通知写入参数).toContain(
      "订单确认完成。订单号：DD-001；订单名称：项目名称优先；订单渠道商：联软渠道商；提交人：湛怀玉。",
    );
  });

  it("超管审核待办从审批记录读取渠道商、提交人，并仅投递规则指定的启用用户", async () => {
    const 领取连接 = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [
            {
              consumption_id: "00000000-0000-4000-8000-000000000021",
              source_event_id: "00000000-0000-4000-8000-000000000022",
              event_code: "iam.account.approval.pending",
              aggregate_type: "approval",
              aggregate_id: "00000000-0000-4000-8000-000000000023",
            },
          ],
        })
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    const 执行连接 = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [
            {
              category_code: "todo",
              priority_code: "strong",
              channel_codes: ["in_app"],
              recipient_rule_json: {
                type: "users",
                scope: { type: "users", userIds: ["00000000-0000-4000-8000-000000000024"] },
              },
              subscription_code: "m1_account_approval_pending",
              template_code: "m1_account_approval_pending",
              title_template: "员工账号待审核",
              body_template:
                "员工账号待审核。员工姓名：{{target_name}}；渠道商名称：{{partner_name}}；提交人：{{submitter_name}}。",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { partner_name: "联软渠道商", submitter_name: "湛怀玉", target_name: "待审核员工" },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ user_id: "00000000-0000-4000-8000-000000000024" }] })
        .mockResolvedValueOnce({ rows: [{ id: "00000000-0000-4000-8000-000000000025" }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    const 存储 = new 消息消费存储(创建测试配置());
    const 连接池 = {
      connect: vi.fn().mockResolvedValueOnce(领取连接).mockResolvedValueOnce(执行连接),
      query: vi.fn().mockResolvedValue({}),
    };
    (存储 as unknown as { 数据库连接池: typeof 连接池 }).数据库连接池 = 连接池;

    await expect(存储.处理一批站内消息(创建测试配置(), "2026-08-01T00:00:00Z", 10)).resolves.toBe(
      1,
    );

    const 变量查询 = 执行连接.query.mock.calls.find(([语句]) =>
      String(语句).includes("FROM ops.approvals approval"),
    )?.[0] as string;
    expect(变量查询).toContain("LEFT JOIN channel.partners partner");
    expect(变量查询).toContain("LEFT JOIN iam.users submitter");
    const 指定用户查询 = 执行连接.query.mock.calls.find(
      ([语句]) =>
        String(语句).includes("user_account.id = ANY($1::uuid[])") &&
        String(语句).includes("status_code = 'active'"),
    )?.[1] as unknown[];
    expect(指定用户查询).toEqual([["00000000-0000-4000-8000-000000000024"]]);
    const 通知写入参数 = 执行连接.query.mock.calls.find(([语句]) =>
      String(语句).includes("INSERT INTO message.notifications"),
    )?.[1] as unknown[];
    expect(通知写入参数).toContain(
      "员工账号待审核。员工姓名：待审核员工；渠道商名称：联软渠道商；提交人：湛怀玉。",
    );
  });
});

describe("客户报备待审批接收人", () => {
  beforeEach(() => {
    查询数据库.mockReset();
  });

  it("角色与指定用户取并集，并只保留启用账号", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ region_id: "00000000-0000-4000-8000-000000000004" }] })
        .mockResolvedValueOnce({ rows: [{ user_id: "00000000-0000-4000-8000-000000000005" }] })
        .mockResolvedValueOnce({ rows: [{ user_id: "00000000-0000-4000-8000-000000000006" }] }),
    };

    await expect(
      查询报备待审批接收人(client as never, "00000000-0000-4000-8000-000000000003", {
        type: "roles",
        codes: ["superadmin", "region_manager"],
        userIds: ["00000000-0000-4000-8000-000000000006"],
      }),
    ).resolves.toEqual([
      "00000000-0000-4000-8000-000000000005",
      "00000000-0000-4000-8000-000000000006",
    ]);

    expect(client.query.mock.calls[1]?.[1]).toEqual([
      ["superadmin", "region_manager"],
      "00000000-0000-4000-8000-000000000004",
    ]);
    expect(client.query.mock.calls[2]?.[1]).toEqual([["00000000-0000-4000-8000-000000000006"]]);
  });
});
