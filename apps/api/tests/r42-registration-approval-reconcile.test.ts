import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const 当前目录 = path.dirname(fileURLToPath(import.meta.url));
const 正向迁移 = fs.readFileSync(
  path.resolve(当前目录, "../../../database/migrations/20261015_S10_027_报备审批记录同步修复.sql"),
  "utf8",
);
const 回退迁移 = fs.readFileSync(
  path.resolve(
    当前目录,
    "../../../database/migrations/20261015_S10_027_报备审批记录同步修复.rollback.sql",
  ),
  "utf8",
);

describe("S10-027 报备审批记录同步修复迁移", () => {
  it("只回填「审批 pending 且报备已终态」的记录，不影响正常待审核", () => {
    expect(正向迁移).toContain("UPDATE ops.approvals");
    expect(正向迁移).toContain("a.approval_type_code = 'registration'");
    expect(正向迁移).toContain("a.target_type = 'registration'");
    expect(正向迁移).toContain("a.target_id = r.id");
    expect(正向迁移).toContain("a.status_code = 'pending'");
    expect(正向迁移).toContain("r.status_code IN ('approved', 'rejected')");
  });

  it("回填状态后补一条审批事件并带修复标记，可重复执行", () => {
    expect(正向迁移).toContain("INSERT INTO ops.approval_events");
    expect(正向迁移).toContain("from_status_code");
    expect(正向迁移).toContain("to_status_code");
    expect(正向迁移).toContain("reconcileReason");
    expect(正向迁移).toContain("'S10-027 报备审批记录同步修复'");
    expect(正向迁移).not.toContain("DELETE FROM");
  });

  it("回退脚本为说明型，不提供会重造幽灵待办的回退语句", () => {
    expect(回退迁移).toContain("不提供数据回退语句");
    expect(回退迁移).not.toContain("UPDATE ops.approvals");
    expect(回退迁移).not.toContain("INSERT INTO");
  });
});
