import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { 创建测试环境变量 } from "@lianruan/testing";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const 测试环境变量 = 创建测试环境变量();
const 当前目录 = path.dirname(fileURLToPath(import.meta.url));
const 回退迁移 = fs.readFileSync(
  path.resolve(
    当前目录,
    "../../../database/migrations/20260901_S10_015_泛微OA账号参考映射与自动绑定.rollback.sql",
  ),
  "utf8",
);

if (!测试环境变量.DATABASE_URL) {
  throw new Error("泛微 OA 自动绑定测试必须配置 PostgreSQL DATABASE_URL，禁止回退内存模式。");
}

const 数据库连接池 = new Pool({ connectionString: 测试环境变量.DATABASE_URL });
let 序号 = 0;

afterAll(async () => {
  await 数据库连接池.end();
});

function 新标识(前缀: string) {
  序号 += 1;
  return `${前缀}_${Date.now()}_${序号}`.toLowerCase();
}

async function 新建参考映射(状态: "auto_match_enabled" | "review_required" = "auto_match_enabled") {
  const 标识 = 新标识("eteams_auto");
  const 用户名 = `${标识}_login`;
  const 姓名 = `泛微自动绑定测试${序号}`;
  const 泛微用户编号 = `test-${标识}`;
  await 数据库连接池.query(
    `INSERT INTO iam.eteams_account_reference_mappings(
       v3_username,expected_display_name,external_subject,external_username,mapping_status,
       source_version,source_file_row,queried_on
     ) VALUES($1::citext,$2,$3,$2,$4,$5,$6,current_date)`,
    [用户名, 姓名, 泛微用户编号, 状态, `test-${标识}`, 1000000 + 序号],
  );
  return { 用户名, 姓名, 泛微用户编号 };
}

async function 新建账号(参数: { 用户名: string; 姓名: string; 状态?: "active" | "disabled" }) {
  const 结果 = await 数据库连接池.query<{ id: string }>(
    `INSERT INTO iam.users(v2_source_id,username,display_name,status_code,extra_json)
     VALUES($1,$2::citext,$3,$4,'{}'::jsonb)
     RETURNING id::text AS id`,
    [新标识("eteams_user"), 参数.用户名, 参数.姓名, 参数.状态 || "active"],
  );
  const 账号 = 结果.rows[0];
  if (!账号) throw new Error("测试账号创建失败。");
  return 账号.id;
}

async function 查询有效泛微身份(用户编号: string) {
  const 结果 = await 数据库连接池.query<{
    id: string;
    external_subject: string;
  }>(
    `SELECT id::text AS id,external_subject
     FROM iam.external_identities
     WHERE user_id=$1::uuid AND provider_code='eteams' AND status_code='active'`,
    [用户编号],
  );
  return 结果.rows;
}

describe("泛微 OA 账号参考映射与自动绑定", () => {
  it("生产参考数据包含 1049 条可自动匹配记录和 3 条待人工核验记录", async () => {
    const 统计 = await 数据库连接池.query<{
      mapping_status: string;
      total: string;
    }>(
      `SELECT mapping_status,COUNT(*)::text AS total
       FROM iam.eteams_account_reference_mappings
       WHERE source_version='eteams-directory-readonly-2026-09-01'
       GROUP BY mapping_status
       ORDER BY mapping_status`,
    );
    expect(统计.rows).toEqual([
      { mapping_status: "auto_match_enabled", total: "1049" },
      { mapping_status: "review_required", total: "3" },
    ]);

    const 待核验 = await 数据库连接池.query<{
      v3_username: string;
      external_subject: string;
    }>(
      `SELECT v3_username::text,external_subject
       FROM iam.eteams_account_reference_mappings
       WHERE source_version='eteams-directory-readonly-2026-09-01'
         AND mapping_status='review_required'
       ORDER BY source_file_row`,
    );
    expect(待核验.rows).toEqual([
      { v3_username: "wangxun", external_subject: "3908602306352113018" },
      { v3_username: "liusujie", external_subject: "1589100384635200628" },
      { v3_username: "wx_tengchaoqin", external_subject: "1258120002840813568" },
    ]);
  });

  it("新增启用账号在登录名与姓名均严格匹配时自动绑定，并留下事件和审计", async () => {
    const 参考 = await 新建参考映射();
    const 用户编号 = await 新建账号({ 用户名: 参考.用户名, 姓名: 参考.姓名 });

    expect(await 查询有效泛微身份(用户编号)).toEqual([
      expect.objectContaining({ external_subject: 参考.泛微用户编号 }),
    ]);

    const 事件 = await 数据库连接池.query<{ result_code: string; operation_code: string }>(
      `SELECT result_code,operation_code
       FROM iam.eteams_identity_auto_match_events
       WHERE user_id=$1::uuid
       ORDER BY created_at DESC`,
      [用户编号],
    );
    expect(事件.rows[0]).toEqual({ result_code: "auto_bound", operation_code: "insert" });

    const 审计 = await 数据库连接池.query<{ action_code: string; result_code: string }>(
      `SELECT action_code,result_code
       FROM audit.audit_logs
       WHERE target_id=(SELECT id::text FROM iam.external_identities
                        WHERE user_id=$1::uuid AND provider_code='eteams' AND status_code='active')
       ORDER BY created_at DESC`,
      [用户编号],
    );
    expect(审计.rows[0]).toEqual({
      action_code: "eteams_identity.auto_bound",
      result_code: "success",
    });
  });

  it("登录名不符、姓名不符或待人工核验的参考记录不会自动绑定", async () => {
    const 登录名不符参考 = await 新建参考映射();
    const 登录名不符用户 = await 新建账号({
      用户名: `${登录名不符参考.用户名}_other`,
      姓名: 登录名不符参考.姓名,
    });
    expect(await 查询有效泛微身份(登录名不符用户)).toHaveLength(0);

    const 姓名不符参考 = await 新建参考映射();
    const 姓名不符用户 = await 新建账号({ 用户名: 姓名不符参考.用户名, 姓名: "姓名不一致" });
    expect(await 查询有效泛微身份(姓名不符用户)).toHaveLength(0);

    const 待核验参考 = await 新建参考映射("review_required");
    const 待核验用户 = await 新建账号({ 用户名: 待核验参考.用户名, 姓名: 待核验参考.姓名 });
    expect(await 查询有效泛微身份(待核验用户)).toHaveLength(0);
  });

  it("停用账号不绑定；恢复为启用且严格匹配后按更新路径自动绑定", async () => {
    const 参考 = await 新建参考映射();
    const 用户编号 = await 新建账号({ 用户名: 参考.用户名, 姓名: 参考.姓名, 状态: "disabled" });
    expect(await 查询有效泛微身份(用户编号)).toHaveLength(0);

    await 数据库连接池.query(
      "UPDATE iam.users SET status_code='active',updated_at=now() WHERE id=$1::uuid",
      [用户编号],
    );
    expect(await 查询有效泛微身份(用户编号)).toEqual([
      expect.objectContaining({ external_subject: 参考.泛微用户编号 }),
    ]);
    const 事件 = await 数据库连接池.query<{ operation_code: string }>(
      `SELECT operation_code FROM iam.eteams_identity_auto_match_events
       WHERE user_id=$1::uuid AND result_code='auto_bound'`,
      [用户编号],
    );
    expect(事件.rows).toEqual([{ operation_code: "update" }]);
  });

  it("已有泛微身份或泛微编号已被其他有效账号占用时不覆盖，并记录跳过事实", async () => {
    const 已有身份参考 = await 新建参考映射();
    const 已有身份用户 = await 新建账号({
      用户名: 已有身份参考.用户名,
      姓名: 已有身份参考.姓名,
      状态: "disabled",
    });
    await 数据库连接池.query(
      `INSERT INTO iam.external_identities(user_id,provider_code,external_subject,external_username,status_code)
       VALUES($1::uuid,'eteams',$2,'既有身份','active')`,
      [已有身份用户, `existing-${新标识("eteams")}`],
    );
    await 数据库连接池.query("UPDATE iam.users SET status_code='active' WHERE id=$1::uuid", [
      已有身份用户,
    ]);
    const 既有身份 = (await 查询有效泛微身份(已有身份用户))[0];
    if (!既有身份) throw new Error("测试用既有泛微身份创建失败。");
    expect(既有身份.external_subject).not.toBe(已有身份参考.泛微用户编号);

    const 占用参考 = await 新建参考映射();
    const 占用用户 = await 新建账号({
      用户名: 新标识("eteams_holder"),
      姓名: "泛微编号占用账号",
      状态: "disabled",
    });
    await 数据库连接池.query(
      `INSERT INTO iam.external_identities(user_id,provider_code,external_subject,external_username,status_code)
       VALUES($1::uuid,'eteams',$2,'已占用泛微身份','active')`,
      [占用用户, 占用参考.泛微用户编号],
    );
    const 待绑定用户 = await 新建账号({ 用户名: 占用参考.用户名, 姓名: 占用参考.姓名 });
    expect(await 查询有效泛微身份(待绑定用户)).toHaveLength(0);

    const 跳过结果 = await 数据库连接池.query<{ result_code: string }>(
      `SELECT result_code FROM iam.eteams_identity_auto_match_events
       WHERE user_id=$1::uuid ORDER BY created_at DESC`,
      [待绑定用户],
    );
    expect(跳过结果.rows[0]).toEqual({ result_code: "skipped_external_subject_occupied" });
  });

  it("安全回退脚本在已有自动匹配事实时拒绝删除追溯数据", () => {
    expect(回退迁移).toContain("S10-015_ROLLBACK_BLOCKED");
    expect(回退迁移).toContain("iam.eteams_identity_auto_match_events");
  });
});
