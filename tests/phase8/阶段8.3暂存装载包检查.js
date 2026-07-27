#!/usr/bin/env node

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const 项目根目录 = path.resolve(__dirname, "../..");
const 导出脚本 = path.join(项目根目录, "scripts/migration/导出V2只读迁移批次.js");
const 装载包脚本 = path.join(项目根目录, "scripts/migration/生成PostgreSQL暂存装载包.js");
const 临时目录 = path.join(项目根目录, "tmp/tests/phase8/postgres-staging-package");
const 源目录 = path.join(临时目录, "source");
const 导出目录 = path.join(临时目录, "export-run");
const 装载包目录 = path.join(临时目录, "staging-package");
const 记录文档 = path.join(临时目录, "阶段8.3-PostgreSQL暂存装载包报告.md");
const CRM库 = path.join(源目录, "crm.db");
const 审计库 = path.join(源目录, "audit.db");

function 断言(条件, 消息) {
  if (!条件) {
    console.error(`阶段8.3暂存装载包检查失败：${消息}`);
    process.exit(1);
  }
}

function 执行命令(命令, 参数, 选项 = {}) {
  return childProcess.execFileSync(命令, 参数, {
    cwd: 项目根目录,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...选项,
  });
}

function 初始化测试库() {
  fs.rmSync(临时目录, { recursive: true, force: true });
  fs.mkdirSync(源目录, { recursive: true });
  执行命令("sqlite3", [CRM库], {
    input: `
CREATE TABLE entities (
  entity_name TEXT NOT NULL,
  id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (entity_name, id)
);
CREATE INDEX idx_entities_name ON entities(entity_name);
INSERT INTO entities(entity_name, id, data_json, updated_at)
VALUES
('users', 'U001', '{"id":"U001","username":"admin","password":"123456","role":"superadmin"}', '2026-07-01 10:00:00'),
('partners', 'P001', '{"id":"P001","name":"测试渠道"}', '2026-07-01 10:20:00');
`,
  });
  执行命令("sqlite3", [审计库], {
    input: `
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  request_id TEXT,
  actor_user_id TEXT,
  actor_username TEXT,
  actor_name TEXT,
  actor_role TEXT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  target_name TEXT,
  result TEXT NOT NULL,
  message TEXT,
  ip TEXT,
  user_agent TEXT,
  before_json TEXT,
  after_json TEXT,
  extra_json TEXT
);
INSERT INTO audit_logs(id, created_at, module, action, result, after_json)
VALUES
('A001', '2026-07-01T10:00:00.000Z', 'auth', 'login', 'success', '{"password":"123456"}');
`,
  });
}

function 主函数() {
  断言(fs.existsSync(装载包脚本), "缺少阶段8.3装载包生成脚本");
  初始化测试库();
  执行命令("node", [
    导出脚本,
    "--crm-db",
    CRM库,
    "--audit-db",
    审计库,
    "--output-dir",
    导出目录,
    "--batch-id",
    "S8-TEST-POSTGRES-001",
    "--label",
    "阶段8.3自动检查导出",
  ]);
  执行命令("node", [
    装载包脚本,
    "--export-manifest",
    path.join(导出目录, "manifest.json"),
    "--output-dir",
    装载包目录,
    "--batch-code",
    "S8-TEST-POSTGRES-001",
    "--record-doc",
    记录文档,
  ]);

  const 必需文件 = [
    "manifest.json",
    "sha256sum.txt",
    "load/v2_raw_records.csv",
    "load/expected-counts.csv",
    "sql/00-prepare-migration-staging.sql",
    "sql/01-load-v2-raw-records.sql",
    "sql/02-verify-staging.sql",
    "scripts/执行PostgreSQL暂存装载.sh",
    "reports/阶段8.3-PostgreSQL暂存装载包报告.md",
  ];
  for (const 文件 of 必需文件) {
    断言(fs.existsSync(path.join(装载包目录, 文件)), `未生成文件：${文件}`);
  }
  断言(fs.existsSync(记录文档), "未同步阶段8.3交接报告");

  const 清单 = JSON.parse(fs.readFileSync(path.join(装载包目录, "manifest.json"), "utf8"));
  断言(清单.阶段结论.装载包状态 === "装载包可执行", "装载包状态应为可执行");
  断言(清单.汇总.暂存总记录数 === 3, "暂存总记录数应为3");
  断言(清单.期望数量.length === 3, "期望数量应包含两个CRM实体和审计日志");

  const 暂存CSV = fs.readFileSync(path.join(装载包目录, "load/v2_raw_records.csv"), "utf8");
  断言(!暂存CSV.includes("123456"), "暂存CSV泄露敏感明文");
  断言(暂存CSV.includes("[已脱敏]"), "暂存CSV缺少脱敏占位值");

  const 装载SQL = fs.readFileSync(path.join(装载包目录, "sql/01-load-v2-raw-records.sql"), "utf8");
  断言(装载SQL.includes("migration.v2_raw_records"), "装载SQL未写入暂存表");
  断言(装载SQL.includes("migration.validation_results"), "装载SQL未写入校验结果");
  断言(装载SQL.includes("migration.migration_errors"), "装载SQL未写入异常隔离清单");

  执行命令("bash", ["-n", path.join(装载包目录, "scripts/执行PostgreSQL暂存装载.sh")]);
  执行命令("shasum", ["-a", "256", "-c", path.join(装载包目录, "sha256sum.txt")], {
    cwd: 装载包目录,
  });

  let 重复执行失败 = false;
  try {
    执行命令("node", [
      装载包脚本,
      "--export-manifest",
      path.join(导出目录, "manifest.json"),
      "--output-dir",
      装载包目录,
      "--batch-code",
      "S8-TEST-POSTGRES-001",
    ]);
  } catch (错误) {
    重复执行失败 = true;
  }
  断言(重复执行失败, "未加 --force 时不应覆盖已有装载包清单");

  console.log("阶段8.3暂存装载包检查通过。");
}

主函数();
