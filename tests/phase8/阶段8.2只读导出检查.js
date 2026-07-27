#!/usr/bin/env node

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const 项目根目录 = path.resolve(__dirname, "../..");
const 脚本路径 = path.join(项目根目录, "scripts/migration/导出V2只读迁移批次.js");
const 临时目录 = path.join(项目根目录, "tmp/tests/phase8/read-only-export");
const 源目录 = path.join(临时目录, "source");
const 输出目录 = path.join(临时目录, "run");
const 记录文档 = path.join(临时目录, "阶段8.2-V2只读导出报告.md");
const CRM库 = path.join(源目录, "crm.db");
const 审计库 = path.join(源目录, "audit.db");

function 断言(条件, 消息) {
  if (!条件) {
    console.error(`阶段8.2只读导出检查失败：${消息}`);
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
('openApiClients', 'C001', '{"id":"C001","name":"测试客户端","secret":"SECRET_VALUE","token":"TOKEN_VALUE"}', '2026-07-01 10:10:00'),
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
INSERT INTO audit_logs(id, created_at, module, action, result, after_json, extra_json)
VALUES
('A001', '2026-07-01T10:00:00.000Z', 'auth', 'login', 'success', '{"password":"123456"}', '{"authorization":"Bearer TOKEN"}'),
('A002', '2026-07-01T10:01:00.000Z', 'partner', 'create', 'success', '{"id":"P001"}', null);
`,
  });
}

function 主函数() {
  断言(fs.existsSync(脚本路径), "缺少只读导出脚本");
  初始化测试库();

  执行命令("node", [
    脚本路径,
    "--crm-db",
    CRM库,
    "--audit-db",
    审计库,
    "--output-dir",
    输出目录,
    "--label",
    "阶段8.2自动检查导出",
    "--batch-id",
    "S8-TEST-001",
    "--page-size",
    "2",
    "--record-doc",
    记录文档,
  ]);

  const manifest路径 = path.join(输出目录, "manifest.json");
  const 报告路径 = path.join(输出目录, "reports", "阶段8.2-V2只读导出报告.md");
  const 用户导出路径 = path.join(输出目录, "exported", "entities-users.ndjson");
  const 客户端导出路径 = path.join(输出目录, "exported", "entities-openApiClients.ndjson");
  const 审计导出路径 = path.join(输出目录, "exported", "audit-logs.ndjson");

  for (const 文件路径 of [
    manifest路径,
    报告路径,
    记录文档,
    用户导出路径,
    客户端导出路径,
    审计导出路径,
  ]) {
    断言(fs.existsSync(文件路径), `未生成文件：${文件路径}`);
  }

  const 全部导出文本 = [
    fs.readFileSync(用户导出路径, "utf8"),
    fs.readFileSync(客户端导出路径, "utf8"),
    fs.readFileSync(审计导出路径, "utf8"),
  ].join("\n");
  for (const 明文 of ["123456", "SECRET_VALUE", "TOKEN_VALUE", "Bearer TOKEN"]) {
    断言(!全部导出文本.includes(明文), `导出文件泄露敏感明文：${明文}`);
  }
  断言(全部导出文本.includes("[已脱敏]"), "导出文件未出现脱敏占位值");

  const 清单 = JSON.parse(fs.readFileSync(manifest路径, "utf8"));
  断言(清单.阶段结论.导出状态 === "导出通过", "导出状态应为通过");
  断言(清单.汇总.CRM源记录总数 === 3, "CRM源记录总数应为3");
  断言(清单.汇总.CRM导出记录总数 === 3, "CRM导出记录总数应为3");
  断言(清单.汇总.审计导出记录总数 === 2, "审计导出记录总数应为2");
  断言(清单.汇总.脱敏字段总数 >= 4, "脱敏字段总数不足");
  断言(清单.输出文件.recordDoc === 记录文档, "清单未记录同步交接文档");

  let 重复执行失败 = false;
  try {
    执行命令("node", [脚本路径, "--crm-db", CRM库, "--audit-db", 审计库, "--output-dir", 输出目录]);
  } catch (错误) {
    重复执行失败 = true;
  }
  断言(重复执行失败, "未加 --force 时不应覆盖已有导出清单");

  console.log("阶段8.2只读导出检查通过。");
}

主函数();
