import { 读取应用配置 } from "@lianruan/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

const 数据库连接池构造 = vi.hoisted(() => vi.fn());

vi.mock("pg", () => ({
  Pool: class {
    public readonly connect = vi.fn();
    public readonly query = vi.fn();
    public readonly end = vi.fn();

    public constructor(参数: unknown) {
      数据库连接池构造(参数);
    }
  },
}));

import {
  启动组织离职交接任务服务,
  组织离职交接任务存储,
  组织离职交接最大重试次数,
  组织离职交接单批最大数量,
  组织离职交接未结束订单状态,
} from "../src/org-offboarding-worker.js";

const 交接单编号 = "00000000-0000-4000-8000-000000000001";
const 离职用户编号 = "00000000-0000-4000-8000-000000000002";
const 接收用户编号 = "00000000-0000-4000-8000-000000000003";
const 发起用户编号 = "00000000-0000-4000-8000-000000000004";
const 事件编号 = "00000000-0000-4000-8000-000000000005";

interface 查询结果 {
  rows: Array<Record<string, unknown>>;
  rowCount?: number;
}

type 查询处理器 = (语句: string, 参数: unknown[]) => 查询结果 | Promise<查询结果>;

interface 测试连接 {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

interface 测试连接池 {
  connect: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
}

interface 可测试交接存储 {
  数据库连接池: 测试连接池;
  领取事件(): Promise<{
    id: string;
    handoverId: string;
    retryCount: number;
    leaseToken: string;
  } | null>;
  执行交接批次(handoverId: string): Promise<boolean>;
  校验接收人(
    db: 测试连接,
    handover: {
      id: string;
      userId: string;
      replacementUserId: string | null;
      statusCode: string;
      createdByUserId: string;
      targetRoleCodes: string[];
      targetRegionId: string | null;
    },
  ): Promise<void>;
  转移业务对象(
    db: 测试连接,
    handover: {
      id: string;
      userId: string;
      replacementUserId: string | null;
      statusCode: string;
      createdByUserId: string;
      targetRoleCodes: string[];
      targetRegionId: string | null;
    },
    rule: {
      domainCode: "order";
      tableName: string;
      statusCondition: string;
      hasRowVersion: boolean;
    },
    limit: number,
  ): Promise<number>;
  完成事件(
    event: { id: string; handoverId: string; retryCount: number; leaseToken: string },
    completed: boolean,
  ): Promise<void>;
  记录事件失败(
    event: { id: string; handoverId: string; retryCount: number; leaseToken: string },
    error: unknown,
  ): Promise<void>;
}

function 规范语句(语句: string): string {
  return 语句.replace(/\s+/g, " ").trim();
}

function 创建连接(处理: 查询处理器): 测试连接 {
  return {
    query: vi.fn(async (语句: string, 参数: unknown[] = []) => 处理(规范语句(语句), 参数)),
    release: vi.fn(),
  };
}

function 创建连接池(连接列表: 测试连接[], 根查询?: 查询处理器): 测试连接池 {
  return {
    connect: vi.fn(async () => {
      const 连接 = 连接列表.shift();
      if (!连接) throw new Error("测试连接池没有可用连接。");
      return 连接;
    }),
    query: vi.fn(async (语句: string, 参数: unknown[] = []) =>
      根查询 ? 根查询(规范语句(语句), 参数) : { rows: [] },
    ),
    end: vi.fn(async () => undefined),
  };
}

function 创建存储(连接池?: 测试连接池): 可测试交接存储 {
  const 存储 = new 组织离职交接任务存储("postgresql://test:test@127.0.0.1:5432/test");
  const 可测试 = 存储 as unknown as 可测试交接存储;
  if (连接池) 可测试.数据库连接池 = 连接池;
  return 可测试;
}

function 创建交接单(
  覆盖: Partial<{
    replacementUserId: string | null;
    targetRoleCodes: string[];
    targetRegionId: string | null;
  }> = {},
) {
  return {
    id: 交接单编号,
    userId: 离职用户编号,
    replacementUserId: 接收用户编号,
    statusCode: "pending_scan",
    createdByUserId: 发起用户编号,
    targetRoleCodes: ["region_manager"],
    targetRegionId: "00000000-0000-4000-8000-000000000006",
    ...覆盖,
  };
}

function 创建事件(覆盖: Partial<{ retryCount: number; leaseToken: string }> = {}) {
  return {
    id: 事件编号,
    handoverId: 交接单编号,
    retryCount: 0,
    leaseToken: "lease-current",
    ...覆盖,
  };
}

describe("组织离职交接任务", () => {
  beforeEach(() => {
    数据库连接池构造.mockClear();
  });

  it("独立开关关闭时不创建数据库连接池", async () => {
    const 日志器 = { info: vi.fn(), error: vi.fn() };
    const 服务 = await 启动组织离职交接任务服务(
      读取应用配置({ APP_ENV: "test", V3_ORGANIZATION_OFFBOARDING_ENABLED: "false" }),
      日志器 as never,
    );

    expect(服务.enabled).toBe(false);
    expect(数据库连接池构造).not.toHaveBeenCalled();
    await expect(服务.close()).resolves.toBeUndefined();
  });

  it("领取使用跳过锁和租约，两个实例可取得不同事件且超时事件可恢复", async () => {
    const 待领取 = [
      { id: 事件编号, handoverId: 交接单编号, retryCount: 0, leaseToken: "lease-a" },
      {
        id: "00000000-0000-4000-8000-000000000007",
        handoverId: "00000000-0000-4000-8000-000000000008",
        retryCount: 1,
        leaseToken: "lease-b",
      },
    ];
    const 查询语句: string[] = [];
    const 建立领取连接 = () =>
      创建连接((语句) => {
        查询语句.push(语句);
        if (语句 === "BEGIN" || 语句 === "COMMIT") return { rows: [] };
        return { rows: 待领取.length ? [待领取.shift()!] : [] };
      });
    const 存储甲 = 创建存储(创建连接池([建立领取连接()]));
    const 存储乙 = 创建存储(创建连接池([建立领取连接()]));

    const [事件甲, 事件乙] = await Promise.all([存储甲.领取事件(), 存储乙.领取事件()]);

    expect(事件甲?.id).not.toBe(事件乙?.id);
    const 领取语句 = 查询语句.find((语句) => 语句.includes("WITH candidate AS")) || "";
    expect(领取语句).toContain("FOR UPDATE SKIP LOCKED");
    expect(领取语句).toContain(
      "status_code='processing' AND next_retry_at IS NOT NULL AND next_retry_at<=now()",
    );
    expect(领取语句).toContain("next_retry_at=now()+interval '5 minutes'");
    expect(领取语句).toContain("'leaseToken',gen_random_uuid()::text");
  });

  it("事件完成必须匹配当前租约令牌，旧实例不能覆盖新实例状态", async () => {
    let 当前租约 = "lease-new";
    let 状态 = "processing";
    const 连接池 = 创建连接池([], (语句, 参数) => {
      expect(语句).toContain("payload_json->>'leaseToken'=$3");
      if (参数[2] === 当前租约 && 状态 === "processing") {
        状态 = String(参数[1]);
        return { rows: [{ id: 事件编号 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const 存储 = 创建存储(连接池);

    await 存储.完成事件(创建事件({ leaseToken: "lease-old" }), true);
    expect(状态).toBe("processing");
    await 存储.完成事件(创建事件({ leaseToken: 当前租约 }), true);
    expect(状态).toBe("sent");
  });

  it("单批最多处理200条并覆盖订单全部未结束状态", async () => {
    const 订单编号 = Array.from({ length: 组织离职交接单批最大数量 }, (_, 下标) => ({
      id: `10000000-0000-4000-8000-${String(下标).padStart(12, "0")}`,
    }));
    const 查询记录: Array<{ 语句: string; 参数: unknown[] }> = [];
    let 待处理检查次数 = 0;
    const 连接 = 创建连接((语句, 参数) => {
      查询记录.push({ 语句, 参数 });
      if (["BEGIN", "COMMIT"].includes(语句)) return { rows: [] };
      if (语句.includes("FROM org.offboarding_handover WHERE")) return { rows: [创建交接单()] };
      if (语句.includes("SELECT count(*)::text AS count FROM (")) {
        待处理检查次数 += 1;
        return { rows: [{ count: 待处理检查次数 === 1 ? "250" : "50" }] };
      }
      if (语句.includes("FROM iam.users 用户")) {
        return {
          rows: [{ roleCodes: ["region_manager"], regionId: 创建交接单().targetRegionId }],
        };
      }
      if (语句.startsWith("UPDATE org.offboarding_handover")) return { rows: [] };
      if (语句.includes("FROM crm.customers") && 语句.includes("FOR UPDATE SKIP LOCKED"))
        return { rows: [] };
      if (语句.includes("FROM crm.registrations") && 语句.includes("FOR UPDATE SKIP LOCKED"))
        return { rows: [] };
      if (语句.includes("FROM crm.opportunities") && 语句.includes("FOR UPDATE SKIP LOCKED"))
        return { rows: [] };
      if (语句.includes("FROM crm.quotes") && 语句.includes("FOR UPDATE SKIP LOCKED"))
        return { rows: [] };
      if (语句.includes("FROM crm.orders") && 语句.includes("FOR UPDATE SKIP LOCKED")) {
        expect(参数[1]).toBe(组织离职交接单批最大数量);
        return { rows: 订单编号 };
      }
      if (语句.startsWith("INSERT INTO org.offboarding_handover_items")) return { rows: [] };
      if (语句.startsWith("UPDATE crm.orders")) return { rows: 订单编号 };
      if (语句.startsWith("UPDATE org.offboarding_handover_items")) return { rows: [] };
      if (语句.startsWith("INSERT INTO audit.audit_logs")) return { rows: [] };
      throw new Error(`未处理的测试查询：${语句}`);
    });
    const 存储 = 创建存储(创建连接池([连接]));

    await expect(存储.执行交接批次(交接单编号)).resolves.toBe(false);

    const 订单选择语句 = 查询记录.find(
      ({ 语句 }) => 语句.includes("FROM crm.orders") && 语句.includes("FOR UPDATE SKIP LOCKED"),
    )?.语句;
    expect(订单选择语句).toBeTruthy();
    for (const 状态 of 组织离职交接未结束订单状态) {
      expect(订单选择语句).toContain(`'${状态}'`);
    }
    expect(组织离职交接未结束订单状态).not.toContain("completed" as never);
    expect(组织离职交接未结束订单状态).not.toContain("cancelled" as never);
    expect(组织离职交接未结束订单状态).not.toContain("rejected" as never);
  });

  it.each([
    ["账号失效", null],
    ["角色失效", { roleCodes: ["staff"], regionId: 创建交接单().targetRegionId }],
    [
      "区域变化",
      { roleCodes: ["region_manager"], regionId: "00000000-0000-4000-8000-000000000099" },
    ],
  ])("接收人%s时停止转移", async (_场景, 接收人) => {
    const 连接 = 创建连接((语句) => {
      if (语句.includes("SELECT count(*)::text AS count FROM (")) return { rows: [{ count: "1" }] };
      if (语句.includes("FROM iam.users 用户")) return { rows: 接收人 ? [接收人] : [] };
      return { rows: [] };
    });
    const 存储 = 创建存储();

    await expect(存储.校验接收人(连接, 创建交接单())).rejects.toThrow(
      接收人 ? "角色或区域已变化" : "接收人已不可用",
    );
    const 接收人查询 = 连接.query.mock.calls.find(([语句]) =>
      String(语句).includes("FROM iam.users 用户"),
    );
    expect(接收人查询?.[0]).toContain("FOR UPDATE OF 用户");
  });

  it("第八次失败停止自动重试并进入人工处理且写入失败审计", async () => {
    const 查询语句: string[] = [];
    const 连接 = 创建连接((语句) => {
      查询语句.push(语句);
      if (语句.startsWith("UPDATE ops.outbox_events")) return { rows: [{ id: 事件编号 }] };
      return { rows: [] };
    });
    const 存储 = 创建存储(创建连接池([连接]));

    await 存储.记录事件失败(
      创建事件({ retryCount: 组织离职交接最大重试次数 - 1 }),
      new Error("模拟永久失败"),
    );

    const 发件箱更新 = 连接.query.mock.calls.find(([语句]) =>
      String(语句).includes("UPDATE ops.outbox_events"),
    );
    expect(发件箱更新?.[1]?.[1]).toBe(true);
    expect(发件箱更新?.[0]).toContain("next_retry_at=CASE WHEN $2::boolean THEN NULL");
    expect(发件箱更新?.[0]).toContain("payload_json->>'leaseToken'=$5");
    expect(查询语句.some((语句) => 语句.includes("status_code='partial_failed'"))).toBe(true);
    expect(查询语句.some((语句) => 语句.includes("'offboarding.transfer_failed'"))).toBe(true);
  });

  it("仅以RETURNING真实编号完成交接，编号不一致时回滚重试", async () => {
    const 订单甲 = "20000000-0000-4000-8000-000000000001";
    const 订单乙 = "20000000-0000-4000-8000-000000000002";
    const 连接 = 创建连接((语句) => {
      if (语句.includes("FROM crm.orders") && 语句.includes("FOR UPDATE SKIP LOCKED"))
        return { rows: [{ id: 订单甲 }, { id: 订单乙 }] };
      if (语句.startsWith("INSERT INTO org.offboarding_handover_items")) return { rows: [] };
      if (语句.startsWith("UPDATE crm.orders")) return { rows: [{ id: 订单甲 }] };
      if (语句.startsWith("UPDATE org.offboarding_handover_items")) return { rows: [] };
      if (语句.startsWith("INSERT INTO audit.audit_logs")) return { rows: [] };
      throw new Error(`未处理的测试查询：${语句}`);
    });
    const 存储 = 创建存储();
    const 规则 = {
      domainCode: "order" as const,
      tableName: "crm.orders",
      statusCondition: "status_code='draft'",
      hasRowVersion: true,
    };

    await expect(存储.转移业务对象(连接, 创建交接单(), 规则, 2)).rejects.toThrow("发生并发变化");
    expect(
      连接.query.mock.calls.some(([语句]) =>
        String(语句).startsWith("UPDATE org.offboarding_handover_items"),
      ),
    ).toBe(false);
  });

  it("重复执行已转移对象不会重复写明细或审计", async () => {
    const 订单编号 = "30000000-0000-4000-8000-000000000001";
    let 选择次数 = 0;
    const 连接 = 创建连接((语句) => {
      if (语句.includes("FROM crm.orders") && 语句.includes("FOR UPDATE SKIP LOCKED")) {
        选择次数 += 1;
        return { rows: 选择次数 === 1 ? [{ id: 订单编号 }] : [] };
      }
      if (语句.startsWith("INSERT INTO org.offboarding_handover_items")) return { rows: [] };
      if (语句.startsWith("UPDATE crm.orders")) return { rows: [{ id: 订单编号 }] };
      if (语句.startsWith("UPDATE org.offboarding_handover_items")) return { rows: [] };
      if (语句.startsWith("INSERT INTO audit.audit_logs")) return { rows: [] };
      throw new Error(`未处理的测试查询：${语句}`);
    });
    const 存储 = 创建存储();
    const 规则 = {
      domainCode: "order" as const,
      tableName: "crm.orders",
      statusCondition: "status_code='draft'",
      hasRowVersion: true,
    };

    await expect(存储.转移业务对象(连接, 创建交接单(), 规则, 1)).resolves.toBe(1);
    await expect(存储.转移业务对象(连接, 创建交接单(), 规则, 1)).resolves.toBe(0);

    const 明细写入次数 = 连接.query.mock.calls.filter(([语句]) =>
      String(语句).startsWith("INSERT INTO org.offboarding_handover_items"),
    ).length;
    const 审计次数 = 连接.query.mock.calls.filter(([语句]) =>
      String(语句).startsWith("INSERT INTO audit.audit_logs"),
    ).length;
    expect(明细写入次数).toBe(1);
    expect(审计次数).toBe(1);
  });
});
