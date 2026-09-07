import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { 创建测试环境变量 } from "@lianruan/testing";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";

const 测试环境变量 = 创建测试环境变量();
if (!测试环境变量.DATABASE_URL) {
  throw new Error("客户报备业务编号迁移测试必须配置 PostgreSQL DATABASE_URL，禁止回退内存模式。");
}

const 当前目录 = path.dirname(fileURLToPath(import.meta.url));
const 旧迁移 = fs.readFileSync(
  path.resolve(当前目录, "../../../database/migrations/20260811_S9_022_既有业务编号统一.sql"),
  "utf8",
);
const 补齐迁移 = fs.readFileSync(
  path.resolve(
    当前目录,
    "../../../database/migrations/20260907_S10_018_客户报备业务编号函数补齐.sql",
  ),
  "utf8",
);

function 提取编号函数(sql: string): string {
  const 开始 = sql.indexOf("CREATE OR REPLACE FUNCTION crm.next_business_number(");
  const 结束 = sql.indexOf("\n$$;", 开始);
  if (开始 < 0 || 结束 < 0) throw new Error("迁移文件缺少业务编号函数定义。");
  return sql.slice(开始, 结束 + "\n$$;".length);
}

describe("客户报备业务编号函数补齐迁移", () => {
  it("可修复旧迁移覆盖且不改变其他三类编号规则", async () => {
    const 数据库连接池 = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
    const 客户端 = await 数据库连接池.connect();
    const 提报账号 = `migration_fix_${Date.now()}`;
    try {
      await 客户端.query("BEGIN");
      await 客户端.query(提取编号函数(旧迁移));
      await 客户端.query("SAVEPOINT 验证旧函数不支持报备");

      await expect(
        客户端.query("SELECT crm.next_business_number($1, $2)", ["registration", 提报账号]),
      ).rejects.toThrow("不支持的业务编号类型：registration");
      await 客户端.query("ROLLBACK TO SAVEPOINT 验证旧函数不支持报备");

      await 客户端.query(补齐迁移);
      const 报备编号 = await 客户端.query<{ 编号: string }>(
        'SELECT crm.next_business_number($1, $2) AS "编号"',
        ["registration", 提报账号],
      );
      expect(报备编号.rows[0]?.编号).toMatch(new RegExp(`^BB-${提报账号}-\\d{8}-\\d{4}$`));

      const 报价编号 = await 客户端.query<{ 编号: string }>(
        'SELECT crm.next_business_number($1, $2) AS "编号"',
        ["quote", 提报账号],
      );
      expect(报价编号.rows[0]?.编号).toMatch(new RegExp(`^BJ-${提报账号}-\\d{8}-\\d{4}$`));

      const 订单编号 = await 客户端.query<{ 编号: string }>(
        'SELECT crm.next_business_number($1, $2) AS "编号"',
        ["order", 提报账号],
      );
      expect(订单编号.rows[0]?.编号).toMatch(new RegExp(`^LS-${提报账号}-\\d{8}-\\d{4}$`));

      const 商机编号 = await 客户端.query<{ 编号: string }>(
        'SELECT crm.next_business_number($1, $2) AS "编号"',
        ["opportunity", ""],
      );
      expect(商机编号.rows[0]?.编号).toMatch(/^SJ-\d{8}-\d{4}$/);
    } finally {
      await 客户端.query("ROLLBACK").catch(() => undefined);
      客户端.release();
      await 数据库连接池.end();
    }
  });
});
