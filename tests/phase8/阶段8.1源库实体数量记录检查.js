#!/usr/bin/env node

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const 项目根目录 = path.resolve(__dirname, "../..");
const 脚本路径 = path.join(项目根目录, "scripts/migration/生成V2快照实体数量记录.js");
const 临时目录 = path.join(项目根目录, "tmp/tests/phase8/source-snapshot-record");
const 源目录 = path.join(临时目录, "source");
const 输出目录 = path.join(临时目录, "output");
const 记录文档 = path.join(临时目录, "阶段8.1-V2源库实体数量记录.md");
const CRM库 = path.join(源目录, "crm.db");
const 审计库 = path.join(源目录, "audit.db");

function 断言(条件, 消息) {
  if (!条件) {
    console.error(`阶段8.1源库实体数量记录检查失败：${消息}`);
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
  fs.mkdirSync(输出目录, { recursive: true });

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
('users', 'U001', '{"id":"U001","username":"admin","role":"superadmin","password":"x"}', '2026-07-01 10:00:00'),
('partners', 'P001', '{"id":"P001","name":"测试渠道"}', '2026-07-01 10:10:00'),
('registrations', 'R001', '{"id":"R001","customer":"测试客户"}', '2026-07-01 10:20:00');
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
('A001', '2026-07-01T10:00:00.000Z', 'auth', 'login', 'success', '{"ok":true}'),
('A002', '2026-07-01T10:01:00.000Z', 'partner', 'create', 'success', '{"id":"P001"}');
`,
  });
}

function 主函数() {
  断言(fs.existsSync(脚本路径), "缺少源库实体数量记录脚本");
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
    "阶段8.1自动检查快照",
    "--expected-source-dir",
    源目录,
    "--record-doc",
    记录文档,
  ]);

  const manifest路径 = path.join(输出目录, "manifest.json");
  const 实体CSV路径 = path.join(输出目录, "entity-counts.csv");
  const 审计CSV路径 = path.join(输出目录, "audit-module-action-counts.csv");
  const 摘要路径 = path.join(输出目录, "sha256sum.txt");

  for (const 文件路径 of [manifest路径, 实体CSV路径, 审计CSV路径, 记录文档, 摘要路径]) {
    断言(fs.existsSync(文件路径), `未生成文件：${文件路径}`);
  }

  const 报告 = JSON.parse(fs.readFileSync(manifest路径, "utf8"));
  断言(报告.阶段结论.源库确认状态 === "已确认正式源库", "测试源库应被确认为正式源库");
  断言(Number(报告.CRM库.实体统计.汇总.总记录数) === 3, "CRM实体总数应为3");
  断言(Number(报告.审计库.审计统计.汇总.审计总数) === 2, "审计总数应为2");
  断言(
    报告.CRM库.实体统计.明细.every((行) => 行.是否覆盖迁移映射),
    "测试实体应全部覆盖迁移映射",
  );
  断言(
    fs.readFileSync(记录文档, "utf8").includes("阶段8.1 V2源库实体数量记录"),
    "记录文档标题不正确",
  );
  断言(
    fs.readFileSync(实体CSV路径, "utf8").includes("含敏感键记录数"),
    "实体CSV缺少敏感键统计字段",
  );
  断言(fs.readFileSync(摘要路径, "utf8").includes("manifest.json"), "校验摘要缺少manifest记录");

  console.log("阶段8.1源库实体数量记录检查通过。");
}

主函数();
