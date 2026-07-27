#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const yaml = require("js-yaml");

const 项目根目录 = path.resolve(__dirname, "../..");
const 默认导出清单 = path.join(项目根目录, "tmp/stage8/v2-export-official/manifest.json");
const 默认输出目录 = path.join(项目根目录, "tmp/stage8/v2-postgres-staging-official");
const 默认映射文件 = path.join(项目根目录, "database/mapping/v2-entity-mapping.yaml");
const 暂存增强SQL = path.join(
  项目根目录,
  "database/migrations/20260727_S8_001_迁移暂存装载增强.sql",
);

function 输出用法并退出() {
  console.log(`用法：
node scripts/migration/生成PostgreSQL暂存装载包.js \\
  --export-manifest "tmp/stage8/v2-export-official/manifest.json" \\
  --output-dir "tmp/stage8/v2-postgres-staging-official" \\
  --batch-code "S8-RUN-20260727-001" \\
  --record-doc "docs/stage-records/阶段8.3-PostgreSQL暂存装载包报告.md"

说明：
- 本脚本不连接数据库，只生成 PostgreSQL 暂存装载包。
- 装载包只写入 migration.* 暂存表，不写业务正式表。
- 暂存层不保存 V2 明文密码、开放接口密钥、令牌和授权值。
- 输出目录已有 manifest.json 时默认停止；需要覆盖时显式增加 --force。`);
  process.exit(0);
}

function 解析参数(原始参数) {
  const 参数 = {};
  for (let i = 0; i < 原始参数.length; i += 1) {
    const 当前 = 原始参数[i];
    if (当前 === "--help" || 当前 === "-h") {
      输出用法并退出();
    }
    if (!当前.startsWith("--")) {
      throw new Error(`参数格式错误：${当前}`);
    }
    const 等号位置 = 当前.indexOf("=");
    if (等号位置 >= 0) {
      参数[当前.slice(2, 等号位置)] = 当前.slice(等号位置 + 1);
      continue;
    }
    const 键 = 当前.slice(2);
    const 下一个 = 原始参数[i + 1];
    if (!下一个 || 下一个.startsWith("--")) {
      参数[键] = "true";
      continue;
    }
    参数[键] = 下一个;
    i += 1;
  }
  return 参数;
}

function 绝对路径(输入路径) {
  return path.resolve(项目根目录, 输入路径);
}

function 读取JSON(文件路径) {
  return JSON.parse(fs.readFileSync(文件路径, "utf8"));
}

function 读取映射版本(映射文件) {
  if (!fs.existsSync(映射文件)) {
    return "v2-entity-mapping@unknown";
  }
  const 内容 = fs.readFileSync(映射文件, "utf8");
  const 解析结果 = yaml.load(内容);
  return `v2-entity-mapping@${解析结果?.generatedAt ?? "unknown"}`;
}

function 计算文本SHA256(文本) {
  return crypto
    .createHash("sha256")
    .update(文本 ?? "", "utf8")
    .digest("hex");
}

function 计算文件SHA256(文件路径) {
  const 哈希 = crypto.createHash("sha256");
  const 文件描述符 = fs.openSync(文件路径, "r");
  const 缓冲区 = Buffer.alloc(1024 * 1024 * 8);
  try {
    let 读取字节数 = 0;
    do {
      读取字节数 = fs.readSync(文件描述符, 缓冲区, 0, 缓冲区.length, null);
      if (读取字节数 > 0) {
        哈希.update(缓冲区.subarray(0, 读取字节数));
      }
    } while (读取字节数 > 0);
  } finally {
    fs.closeSync(文件描述符);
  }
  return 哈希.digest("hex");
}

function 文件元信息(文件路径) {
  const 状态 = fs.statSync(文件路径);
  return {
    路径: 文件路径,
    大小字节: 状态.size,
    修改时间: 状态.mtime.toISOString(),
    SHA256: 计算文件SHA256(文件路径),
  };
}

function 准备输出目录(输出目录, 是否强制) {
  const 清单路径 = path.join(输出目录, "manifest.json");
  if (fs.existsSync(清单路径) && !是否强制) {
    throw new Error(
      `输出目录已有 manifest.json，为避免覆盖演练记录请换目录或增加 --force：${清单路径}`,
    );
  }
  fs.mkdirSync(path.join(输出目录, "load"), { recursive: true });
  fs.mkdirSync(path.join(输出目录, "sql"), { recursive: true });
  fs.mkdirSync(path.join(输出目录, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(输出目录, "reports"), { recursive: true });
  fs.mkdirSync(path.join(输出目录, "logs"), { recursive: true });
  if (是否强制) {
    for (const 子目录 of ["load", "sql", "scripts", "reports"]) {
      const 目录 = path.join(输出目录, 子目录);
      for (const 文件 of fs.readdirSync(目录)) {
        fs.rmSync(path.join(目录, 文件), { recursive: true, force: true });
      }
    }
  }
}

function CSV值(值) {
  const 字符串 = 值 === null || 值 === undefined ? "" : String(值);
  if (/[",\n\r]/.test(字符串)) {
    return `"${字符串.replace(/"/g, '""')}"`;
  }
  return 字符串;
}

function 写CSV行(文件描述符, 列表) {
  fs.writeSync(文件描述符, 列表.map(CSV值).join(",") + "\n", undefined, "utf8");
}

function 生成源快照摘要(导出清单) {
  const 段落 = [
    导出清单.源库?.CRM库?.SHA256,
    导出清单.源库?.CRM库?.WAL文件?.SHA256,
    导出清单.源库?.审计库?.SHA256,
    导出清单.源库?.审计库?.WAL文件?.SHA256,
    导出清单.批次编号,
    导出清单.生成时间,
  ].filter(Boolean);
  return 计算文本SHA256(段落.join("\n"));
}

function 构造暂存JSON(记录) {
  if (记录.recordType === "crm_entity") {
    return {
      recordType: "crm_entity",
      entityName: 记录.entityName,
      sourceId: 记录.sourceId,
      sourceUpdatedAt: 记录.sourceUpdatedAt,
      data: 记录.redactedJson,
      redactionPaths: 记录.redactionPaths ?? [],
      mapping: 记录.mapping ?? {},
    };
  }
  return {
    recordType: "audit_log",
    sourceId: 记录.sourceId,
    createdAt: 记录.createdAt,
    requestId: 记录.requestId,
    actorUserId: 记录.actorUserId,
    actorUsername: 记录.actorUsername,
    actorName: 记录.actorName,
    actorRole: 记录.actorRole,
    module: 记录.module,
    action: 记录.action,
    targetType: 记录.targetType,
    targetId: 记录.targetId,
    targetName: 记录.targetName,
    result: 记录.result,
    message: 记录.message,
    ip: 记录.ip,
    userAgent: 记录.userAgent,
    beforeJson: 记录.beforeJson,
    afterJson: 记录.afterJson,
    extraJson: 记录.extraJson,
    redactionPaths: 记录.redactionPaths ?? [],
  };
}

function 生成期望数量(导出清单) {
  const 期望数量 = [];
  for (const 行 of 导出清单.CRM实体统计 ?? []) {
    期望数量.push({
      entityName: 行.实体名,
      expectedRecords: Number(行.导出记录数),
      recordGroup: "crm_entity",
    });
  }
  期望数量.push({
    entityName: "audit_logs",
    expectedRecords: Number(导出清单.审计统计?.导出记录数 ?? 0),
    recordGroup: "audit_log",
  });
  return 期望数量;
}

async function 写暂存CSV(配置, 导出清单) {
  const 原始记录CSV = path.join(配置.输出目录, "load", "v2_raw_records.csv");
  const 期望数量CSV = path.join(配置.输出目录, "load", "expected-counts.csv");
  const 原始记录文件 = fs.openSync(原始记录CSV, "w");
  let 暂存记录总数 = 0;
  const 文件统计 = [];

  try {
    写CSV行(原始记录文件, [
      "batch_code",
      "entity_name",
      "source_id",
      "source_updated_at",
      "source_sha256",
      "redacted_json",
      "record_group",
      "export_file",
    ]);

    for (const 文件 of 导出清单.导出文件 ?? []) {
      const 导出文件路径 =
        文件.路径 && fs.existsSync(文件.路径)
          ? 文件.路径
          : path.join(path.dirname(配置.导出清单路径), 文件.相对路径);
      if (!fs.existsSync(导出文件路径)) {
        throw new Error(`导出文件不存在：${导出文件路径}`);
      }
      const 输入流 = fs.createReadStream(导出文件路径, "utf8");
      const 行读取器 = readline.createInterface({ input: 输入流, crlfDelay: Infinity });
      let 文件记录数 = 0;
      for await (const 文本行 of 行读取器) {
        if (!文本行.trim()) {
          continue;
        }
        const 记录 = JSON.parse(文本行);
        const 实体名 = 记录.recordType === "audit_log" ? "audit_logs" : 记录.entityName;
        const 更新时间 = 记录.recordType === "audit_log" ? 记录.createdAt : 记录.sourceUpdatedAt;
        const 暂存JSON = 构造暂存JSON(记录);
        写CSV行(原始记录文件, [
          配置.批次编号,
          实体名,
          记录.sourceId,
          更新时间,
          记录.sourceJsonSha256,
          JSON.stringify(暂存JSON),
          记录.recordType,
          文件.相对路径,
        ]);
        文件记录数 += 1;
        暂存记录总数 += 1;
      }
      文件统计.push({
        相对路径: 文件.相对路径,
        期望记录数: Number(文件.记录数),
        暂存记录数: 文件记录数,
        数量一致: Number(文件.记录数) === 文件记录数,
      });
    }
  } finally {
    fs.closeSync(原始记录文件);
  }

  const 期望数量文件 = fs.openSync(期望数量CSV, "w");
  try {
    写CSV行(期望数量文件, ["batch_code", "entity_name", "expected_records", "record_group"]);
    for (const 行 of 生成期望数量(导出清单)) {
      写CSV行(期望数量文件, [配置.批次编号, 行.entityName, 行.expectedRecords, 行.recordGroup]);
    }
  } finally {
    fs.closeSync(期望数量文件);
  }

  return {
    原始记录CSV,
    期望数量CSV,
    暂存记录总数,
    文件统计,
  };
}

function 写SQL文件(配置, 上下文) {
  const 准备SQL路径 = path.join(配置.输出目录, "sql", "00-prepare-migration-staging.sql");
  const 装载SQL路径 = path.join(配置.输出目录, "sql", "01-load-v2-raw-records.sql");
  const 校验SQL路径 = path.join(配置.输出目录, "sql", "02-verify-staging.sql");

  fs.writeFileSync(准备SQL路径, fs.readFileSync(暂存增强SQL, "utf8"), "utf8");
  fs.writeFileSync(
    装载SQL路径,
    `\\set ON_ERROR_STOP on

\\if :{?stage8_batch_code}
\\else
\\echo '缺少变量：stage8_batch_code'
\\quit 1
\\endif

BEGIN;

CREATE TEMP TABLE stage8_import_records (
  batch_code text NOT NULL,
  entity_name text NOT NULL,
  source_id text NOT NULL,
  source_updated_at timestamptz,
  source_sha256 text NOT NULL,
  redacted_json jsonb NOT NULL,
  record_group text NOT NULL,
  export_file text NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE stage8_expected_counts (
  batch_code text NOT NULL,
  entity_name text NOT NULL,
  expected_records bigint NOT NULL,
  record_group text NOT NULL
) ON COMMIT DROP;

\\copy stage8_import_records(batch_code, entity_name, source_id, source_updated_at, source_sha256, redacted_json, record_group, export_file) FROM 'load/v2_raw_records.csv' WITH (FORMAT csv, HEADER true)
\\copy stage8_expected_counts(batch_code, entity_name, expected_records, record_group) FROM 'load/expected-counts.csv' WITH (FORMAT csv, HEADER true)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM stage8_import_records
    GROUP BY batch_code, entity_name, source_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION '阶段8.3暂存导入包存在重复源编号';
  END IF;
END $$;

INSERT INTO migration.migration_batches (
  batch_code,
  source_snapshot_sha256,
  source_taken_at,
  mapping_version,
  status_code,
  total_records,
  failed_records,
  note
)
VALUES (
  :'stage8_batch_code',
  :'stage8_source_snapshot_sha256',
  :'stage8_source_taken_at'::timestamptz,
  :'stage8_mapping_version',
  'exported',
  :'stage8_total_records'::bigint,
  0,
  '阶段8.3暂存层装载批次'
)
ON CONFLICT (batch_code) DO UPDATE
SET
  source_snapshot_sha256 = EXCLUDED.source_snapshot_sha256,
  source_taken_at = EXCLUDED.source_taken_at,
  mapping_version = EXCLUDED.mapping_version,
  status_code = 'exported',
  total_records = EXCLUDED.total_records,
  failed_records = 0,
  finished_at = NULL,
  note = EXCLUDED.note;

DELETE FROM migration.v2_raw_records
WHERE batch_id = (SELECT id FROM migration.migration_batches WHERE batch_code = :'stage8_batch_code');

DELETE FROM migration.v2_import_expected_counts
WHERE batch_id = (SELECT id FROM migration.migration_batches WHERE batch_code = :'stage8_batch_code');

DELETE FROM migration.migration_errors
WHERE batch_id = (SELECT id FROM migration.migration_batches WHERE batch_code = :'stage8_batch_code')
  AND error_code LIKE 'S8_3_%';

DELETE FROM migration.validation_results
WHERE batch_id = (SELECT id FROM migration.migration_batches WHERE batch_code = :'stage8_batch_code')
  AND check_code LIKE 'S8_3_%';

INSERT INTO migration.v2_import_expected_counts (
  batch_id,
  entity_name,
  expected_records,
  record_group
)
SELECT
  b.id,
  e.entity_name,
  e.expected_records,
  e.record_group
FROM stage8_expected_counts e
JOIN migration.migration_batches b ON b.batch_code = e.batch_code
WHERE e.batch_code = :'stage8_batch_code';

-- 阶段8.3暂存层不保存V2明文敏感字段。raw_json与redacted_json均写入脱敏后的JSON。
INSERT INTO migration.v2_raw_records (
  batch_id,
  entity_name,
  source_id,
  source_updated_at,
  source_sha256,
  raw_json,
  redacted_json,
  process_status
)
SELECT
  b.id,
  r.entity_name,
  r.source_id,
  r.source_updated_at,
  r.source_sha256,
  r.redacted_json,
  r.redacted_json,
  'pending'
FROM stage8_import_records r
JOIN migration.migration_batches b ON b.batch_code = r.batch_code
WHERE r.batch_code = :'stage8_batch_code';

INSERT INTO migration.migration_errors (
  batch_id,
  entity_name,
  source_id,
  error_code,
  error_category,
  error_message,
  field_path,
  suggested_action,
  owner_role
)
SELECT
  b.id,
  r.entity_name,
  r.source_id,
  'S8_3_REQUIRED_FIELD_EMPTY',
  '阻断迁移',
  '暂存导入记录存在空实体名、空源编号或空源摘要',
  '$',
  '回到阶段8.2重新导出并核对源记录',
  '数据迁移负责人'
FROM stage8_import_records r
JOIN migration.migration_batches b ON b.batch_code = r.batch_code
WHERE r.batch_code = :'stage8_batch_code'
  AND (
    NULLIF(TRIM(r.entity_name), '') IS NULL
    OR NULLIF(TRIM(r.source_id), '') IS NULL
    OR NULLIF(TRIM(r.source_sha256), '') IS NULL
  );

INSERT INTO migration.migration_errors (
  batch_id,
  entity_name,
  source_id,
  error_code,
  error_category,
  error_message,
  field_path,
  suggested_action,
  owner_role
)
SELECT
  b.id,
  r.entity_name,
  r.source_id,
  'S8_3_MAPPING_MISSING',
  '阻断迁移',
  'CRM实体缺少迁移映射覆盖',
  '$.mapping.covered',
  '补充 database/mapping/v2-entity-mapping.yaml 后重新导出',
  '数据迁移负责人'
FROM stage8_import_records r
JOIN migration.migration_batches b ON b.batch_code = r.batch_code
WHERE r.batch_code = :'stage8_batch_code'
  AND r.entity_name <> 'audit_logs'
  AND COALESCE(r.redacted_json->'mapping'->>'covered', 'false') <> 'true';

WITH batch AS (
  SELECT id FROM migration.migration_batches WHERE batch_code = :'stage8_batch_code'
),
expected AS (
  SELECT entity_name, expected_records
  FROM migration.v2_import_expected_counts
  WHERE batch_id = (SELECT id FROM batch)
),
actual AS (
  SELECT entity_name, COUNT(*) AS actual_records
  FROM migration.v2_raw_records
  WHERE batch_id = (SELECT id FROM batch)
  GROUP BY entity_name
)
INSERT INTO migration.validation_results (
  batch_id,
  check_code,
  check_name,
  result_code,
  expected_value,
  actual_value,
  detail_json
)
SELECT
  (SELECT id FROM batch),
  'S8_3_COUNT_' || md5(e.entity_name),
  '阶段8.3数量守恒：' || e.entity_name,
  CASE WHEN e.expected_records = COALESCE(a.actual_records, 0) THEN 'passed' ELSE 'failed' END,
  e.expected_records::text,
  COALESCE(a.actual_records, 0)::text,
  jsonb_build_object('entityName', e.entity_name)
FROM expected e
LEFT JOIN actual a ON a.entity_name = e.entity_name
ON CONFLICT (batch_id, check_code) DO UPDATE
SET
  result_code = EXCLUDED.result_code,
  expected_value = EXCLUDED.expected_value,
  actual_value = EXCLUDED.actual_value,
  detail_json = EXCLUDED.detail_json,
  created_at = now();

WITH batch AS (
  SELECT id FROM migration.migration_batches WHERE batch_code = :'stage8_batch_code'
),
counts AS (
  SELECT
    (SELECT COALESCE(SUM(expected_records), 0) FROM migration.v2_import_expected_counts WHERE batch_id = (SELECT id FROM batch)) AS expected_records,
    (SELECT COUNT(*) FROM migration.v2_raw_records WHERE batch_id = (SELECT id FROM batch)) AS actual_records
)
INSERT INTO migration.validation_results (
  batch_id,
  check_code,
  check_name,
  result_code,
  expected_value,
  actual_value,
  detail_json
)
SELECT
  (SELECT id FROM batch),
  'S8_3_TOTAL_COUNT',
  '阶段8.3总记录数量守恒',
  CASE WHEN expected_records = actual_records THEN 'passed' ELSE 'failed' END,
  expected_records::text,
  actual_records::text,
  '{}'::jsonb
FROM counts
ON CONFLICT (batch_id, check_code) DO UPDATE
SET
  result_code = EXCLUDED.result_code,
  expected_value = EXCLUDED.expected_value,
  actual_value = EXCLUDED.actual_value,
  detail_json = EXCLUDED.detail_json,
  created_at = now();

WITH batch AS (
  SELECT id FROM migration.migration_batches WHERE batch_code = :'stage8_batch_code'
),
error_count AS (
  SELECT COUNT(*) AS errors
  FROM migration.migration_errors
  WHERE batch_id = (SELECT id FROM batch)
    AND resolved_at IS NULL
)
INSERT INTO migration.validation_results (
  batch_id,
  check_code,
  check_name,
  result_code,
  expected_value,
  actual_value,
  detail_json
)
SELECT
  (SELECT id FROM batch),
  'S8_3_ERROR_COUNT',
  '阶段8.3异常隔离清单未解决项',
  CASE WHEN errors = 0 THEN 'passed' ELSE 'failed' END,
  '0',
  errors::text,
  '{}'::jsonb
FROM error_count
ON CONFLICT (batch_id, check_code) DO UPDATE
SET
  result_code = EXCLUDED.result_code,
  expected_value = EXCLUDED.expected_value,
  actual_value = EXCLUDED.actual_value,
  detail_json = EXCLUDED.detail_json,
  created_at = now();

WITH batch AS (
  SELECT id FROM migration.migration_batches WHERE batch_code = :'stage8_batch_code'
),
summary AS (
  SELECT
    EXISTS (
      SELECT 1
      FROM migration.validation_results
      WHERE batch_id = (SELECT id FROM batch)
        AND check_code LIKE 'S8_3_%'
        AND result_code = 'failed'
    ) AS has_failed,
    (SELECT COUNT(*) FROM migration.v2_raw_records WHERE batch_id = (SELECT id FROM batch)) AS total_records,
    (SELECT COUNT(*) FROM migration.migration_errors WHERE batch_id = (SELECT id FROM batch) AND resolved_at IS NULL) AS failed_records
)
UPDATE migration.migration_batches mb
SET
  status_code = CASE WHEN summary.has_failed THEN 'failed' ELSE 'imported' END,
  total_records = summary.total_records,
  failed_records = summary.failed_records,
  finished_at = now()
FROM summary
WHERE mb.id = (SELECT id FROM batch);

COMMIT;
`,
    "utf8",
  );

  fs.writeFileSync(
    校验SQL路径,
    `\\set ON_ERROR_STOP on

\\if :{?stage8_batch_code}
\\else
\\echo '缺少变量：stage8_batch_code'
\\quit 1
\\endif

SELECT
  batch_code AS "批次编号",
  status_code AS "批次状态",
  total_records AS "暂存记录数",
  failed_records AS "未解决异常数",
  started_at AS "开始时间",
  finished_at AS "完成时间"
FROM migration.migration_batches
WHERE batch_code = :'stage8_batch_code';

SELECT
  e.entity_name AS "实体名",
  e.expected_records AS "期望数量",
  COUNT(r.id) AS "暂存数量",
  CASE WHEN e.expected_records = COUNT(r.id) THEN '通过' ELSE '失败' END AS "数量校验"
FROM migration.v2_import_expected_counts e
JOIN migration.migration_batches b ON b.id = e.batch_id
LEFT JOIN migration.v2_raw_records r ON r.batch_id = e.batch_id AND r.entity_name = e.entity_name
WHERE b.batch_code = :'stage8_batch_code'
GROUP BY e.entity_name, e.expected_records
ORDER BY e.entity_name;

SELECT
  check_code AS "校验编码",
  check_name AS "校验名称",
  result_code AS "结果",
  expected_value AS "期望值",
  actual_value AS "实际值"
FROM migration.validation_results
WHERE batch_id = (SELECT id FROM migration.migration_batches WHERE batch_code = :'stage8_batch_code')
  AND check_code LIKE 'S8_3_%'
ORDER BY check_code;

SELECT
  entity_name AS "实体名",
  source_id AS "源编号",
  error_code AS "异常编码",
  error_category AS "异常分类",
  error_message AS "异常说明",
  suggested_action AS "建议处理"
FROM migration.migration_errors
WHERE batch_id = (SELECT id FROM migration.migration_batches WHERE batch_code = :'stage8_batch_code')
  AND resolved_at IS NULL
ORDER BY created_at, entity_name, source_id
LIMIT 100;

SELECT set_config('stage8.batch_code', :'stage8_batch_code', false);

DO $$
DECLARE
  failed_checks integer;
  open_errors integer;
BEGIN
  SELECT COUNT(*) INTO failed_checks
  FROM migration.validation_results
  WHERE batch_id = (SELECT id FROM migration.migration_batches WHERE batch_code = current_setting('stage8.batch_code'))
    AND check_code LIKE 'S8_3_%'
    AND result_code = 'failed';

  SELECT COUNT(*) INTO open_errors
  FROM migration.migration_errors
  WHERE batch_id = (SELECT id FROM migration.migration_batches WHERE batch_code = current_setting('stage8.batch_code'))
    AND resolved_at IS NULL;

  IF failed_checks > 0 OR open_errors > 0 THEN
    RAISE EXCEPTION '阶段8.3暂存校验未通过，失败校验项：%，未解决异常：%', failed_checks, open_errors;
  END IF;
END $$;
`,
    "utf8",
  );

  return { 准备SQL路径, 装载SQL路径, 校验SQL路径 };
}

function 写执行脚本(配置, 上下文) {
  const 脚本路径 = path.join(配置.输出目录, "scripts", "执行PostgreSQL暂存装载.sh");
  const 内容 = `#!/usr/bin/env bash
set -euo pipefail

package_dir="$(cd "$(dirname "$0")/.." && pwd)"
log_dir="$package_dir/logs"
mkdir -p "$log_dir"
log_file="$log_dir/staging-load-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$log_file") 2>&1

batch_code="${上下文.批次编号}"
source_snapshot_sha256="${上下文.源快照摘要}"
source_taken_at="${上下文.源快照时间}"
mapping_version="${上下文.映射版本}"
total_records="${上下文.暂存记录总数}"

echo "阶段8.3暂存装载开始：$batch_code"
echo "装载包目录：$package_dir"
echo "日志文件：$log_file"

run_local_psql() {
  if [ -z "\${DATABASE_URL:-}" ]; then
    echo "缺少 DATABASE_URL，无法使用本机psql执行"
    return 1
  fi
  if ! command -v psql >/dev/null 2>&1; then
    echo "本机未安装psql，无法使用本机psql执行"
    return 1
  fi
  cd "$package_dir"
  psql "$DATABASE_URL" \\
    -v ON_ERROR_STOP=1 \\
    -v stage8_batch_code="$batch_code" \\
    -v stage8_source_snapshot_sha256="$source_snapshot_sha256" \\
    -v stage8_source_taken_at="$source_taken_at" \\
    -v stage8_mapping_version="$mapping_version" \\
    -v stage8_total_records="$total_records" \\
    -f "sql/00-prepare-migration-staging.sql" \\
    -f "sql/01-load-v2-raw-records.sql" \\
    -f "sql/02-verify-staging.sql"
}

run_container_psql() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "未找到docker命令，无法使用容器内psql执行"
    return 1
  fi
  container_name="\${POSTGRES_CONTAINER:-lianruan-crm-v3-postgres}"
  container_dir="/tmp/lianruan-crm-v3-stage8/$batch_code"
  docker exec "$container_name" sh -lc "rm -rf '$container_dir' && mkdir -p '$container_dir'"
  docker cp "$package_dir/." "$container_name:$container_dir/"
  docker exec "$container_name" sh -lc "cd '$container_dir' && password='' && if [ -f /run/secrets/postgres_password ]; then password=\\$(cat /run/secrets/postgres_password); else password=\\\${POSTGRES_PASSWORD:-}; fi && PGPASSWORD=\\$password psql -U \\\"\\\${POSTGRES_USER:-lianruan_app}\\\" -d \\\"\\\${POSTGRES_DB:-lianruan_crm_v3}\\\" -v ON_ERROR_STOP=1 -v stage8_batch_code='$batch_code' -v stage8_source_snapshot_sha256='$source_snapshot_sha256' -v stage8_source_taken_at='$source_taken_at' -v stage8_mapping_version='$mapping_version' -v stage8_total_records='$total_records' -f 'sql/00-prepare-migration-staging.sql' -f 'sql/01-load-v2-raw-records.sql' -f 'sql/02-verify-staging.sql'"
}

case "\${STAGE8_PSQL_MODE:-auto}" in
  local)
    run_local_psql
    ;;
  docker)
    run_container_psql
    ;;
  auto)
    run_local_psql || run_container_psql
    ;;
  *)
    echo "STAGE8_PSQL_MODE只支持 auto、local、docker"
    exit 1
    ;;
esac

echo "阶段8.3暂存装载完成：$batch_code"
`;
  fs.writeFileSync(脚本路径, 内容, "utf8");
  fs.chmodSync(脚本路径, 0o755);
  return 脚本路径;
}

function Markdown表格(表头, 行列表) {
  const 行转文本 = (行) =>
    `| ${表头.map((列) => String(行[列] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`;
  return [
    `| ${表头.join(" | ")} |`,
    `| ${表头.map(() => "---").join(" | ")} |`,
    ...行列表.map(行转文本),
  ].join("\n");
}

function 生成报告(清单) {
  const 文件行 = 清单.装载文件.map((文件) => ({
    类型: 文件.类型,
    相对路径: `\`${文件.相对路径}\``,
    记录数: 文件.记录数 ?? "",
    大小字节: 文件.大小字节,
    SHA256: `\`${文件.SHA256}\``,
  }));
  const 数量行 = 清单.期望数量.map((行) => ({
    实体名: 行.entityName,
    期望数量: 行.expectedRecords,
    分组: 行.recordGroup,
  }));
  return `# 阶段8.3 PostgreSQL暂存装载包报告

生成时间：${清单.生成时间}

## 1. 装载包结论

| 项目 | 结果 |
| --- | --- |
| 批次编号 | ${清单.批次编号} |
| 装载包状态 | ${清单.阶段结论.装载包状态} |
| 导出清单 | \`${清单.导出清单路径}\` |
| 输出目录 | \`${清单.输出目录}\` |
| 源快照摘要 | \`${清单.源快照摘要}\` |
| 映射版本 | ${清单.映射版本} |
| CRM暂存记录数 | ${清单.汇总.CRM暂存记录数} |
| 审计暂存记录数 | ${清单.汇总.审计暂存记录数} |
| 暂存总记录数 | ${清单.汇总.暂存总记录数} |
| 期望实体数 | ${清单.汇总.期望实体数} |

## 2. 期望数量

${Markdown表格(["实体名", "期望数量", "分组"], 数量行)}

## 3. 装载文件

${Markdown表格(["类型", "相对路径", "记录数", "大小字节", "SHA256"], 文件行)}

## 4. 执行方式

本机有 PostgreSQL 客户端时：

\`\`\`bash
DATABASE_URL="postgres://用户:密码@主机:5432/lianruan_crm_v3" \\
  ${path.relative(项目根目录, 清单.执行脚本)}
\`\`\`

生产容器方式：

\`\`\`bash
STAGE8_PSQL_MODE=docker \\
POSTGRES_CONTAINER=lianruan-crm-v3-postgres \\
  ${path.relative(项目根目录, 清单.执行脚本)}
\`\`\`

## 5. 阶段边界

- 本装载包只写入 \`migration.migration_batches\`、\`migration.v2_raw_records\`、\`migration.v2_import_expected_counts\`、\`migration.validation_results\` 和 \`migration.migration_errors\`。
- 本装载包不写入 \`crm.*\`、\`channel.*\`、\`iam.*\` 等业务正式表。
- 暂存层不保存 V2 明文密码、开放接口密钥、令牌和授权值；\`raw_json\` 与 \`redacted_json\` 均写入脱敏后的 JSON。
- 执行 \`02-verify-staging.sql\` 失败时，不得进入阶段8.4。
`;
}

function 写清单和报告(配置, 上下文) {
  const 报告路径 = path.join(配置.输出目录, "reports", "阶段8.3-PostgreSQL暂存装载包报告.md");
  const 清单路径 = path.join(配置.输出目录, "manifest.json");
  const SHA路径 = path.join(配置.输出目录, "sha256sum.txt");
  const 装载文件 = [
    {
      类型: "暂存记录CSV",
      路径: 上下文.原始记录CSV,
      相对路径: "load/v2_raw_records.csv",
      记录数: 上下文.暂存记录总数,
    },
    {
      类型: "期望数量CSV",
      路径: 上下文.期望数量CSV,
      相对路径: "load/expected-counts.csv",
      记录数: 上下文.期望数量.length,
    },
    { 类型: "准备SQL", 路径: 上下文.准备SQL路径, 相对路径: "sql/00-prepare-migration-staging.sql" },
    { 类型: "装载SQL", 路径: 上下文.装载SQL路径, 相对路径: "sql/01-load-v2-raw-records.sql" },
    { 类型: "校验SQL", 路径: 上下文.校验SQL路径, 相对路径: "sql/02-verify-staging.sql" },
    { 类型: "执行脚本", 路径: 上下文.执行脚本, 相对路径: "scripts/执行PostgreSQL暂存装载.sh" },
  ].map((文件) => ({ ...文件, ...文件元信息(文件.路径) }));

  const 清单 = {
    生成时间: new Date().toISOString(),
    批次编号: 配置.批次编号,
    导出清单路径: 配置.导出清单路径,
    输出目录: 配置.输出目录,
    源快照摘要: 上下文.源快照摘要,
    源快照时间: 上下文.源快照时间,
    映射版本: 配置.映射版本,
    阶段结论: {
      装载包状态: 上下文.阻断项.length === 0 ? "装载包可执行" : "装载包存在阻断项",
      阻断项: 上下文.阻断项,
    },
    汇总: {
      CRM暂存记录数: 上下文.CRM暂存记录数,
      审计暂存记录数: 上下文.审计暂存记录数,
      暂存总记录数: 上下文.暂存记录总数,
      期望实体数: 上下文.期望数量.length,
    },
    期望数量: 上下文.期望数量,
    文件统计: 上下文.文件统计,
    装载文件,
    执行脚本: 上下文.执行脚本,
  };

  fs.writeFileSync(报告路径, 生成报告(清单), "utf8");
  if (配置.记录文档) {
    fs.mkdirSync(path.dirname(配置.记录文档), { recursive: true });
    fs.writeFileSync(配置.记录文档, 生成报告(清单), "utf8");
  }
  清单.输出文件 = {
    manifest: 清单路径,
    report: 报告路径,
    sha256sum: SHA路径,
    recordDoc: 配置.记录文档,
  };
  fs.writeFileSync(清单路径, JSON.stringify(清单, null, 2) + "\n", "utf8");

  const 校验文件 = [清单路径, 报告路径, ...装载文件.map((文件) => 文件.路径)];
  if (配置.记录文档) {
    校验文件.push(配置.记录文档);
  }
  const 校验内容 = 校验文件
    .map((文件路径) => `${计算文件SHA256(文件路径)}  ${path.relative(配置.输出目录, 文件路径)}`)
    .join("\n");
  fs.writeFileSync(SHA路径, 校验内容 + "\n", "utf8");
  return 清单;
}

async function 主函数() {
  const 参数 = 解析参数(process.argv.slice(2));
  const 配置 = {
    导出清单路径: 绝对路径(参数["export-manifest"] ?? 默认导出清单),
    输出目录: 绝对路径(参数["output-dir"] ?? 默认输出目录),
    批次编号: 参数["batch-code"] ?? null,
    映射文件: 绝对路径(参数["mapping-file"] ?? 默认映射文件),
    映射版本:
      参数["mapping-version"] ?? 读取映射版本(绝对路径(参数["mapping-file"] ?? 默认映射文件)),
    记录文档: 参数["record-doc"] ? 绝对路径(参数["record-doc"]) : null,
    是否强制: 参数.force === "true",
  };
  if (!fs.existsSync(配置.导出清单路径)) {
    throw new Error(`导出清单不存在：${配置.导出清单路径}`);
  }
  if (!fs.existsSync(暂存增强SQL)) {
    throw new Error(`暂存增强SQL不存在：${暂存增强SQL}`);
  }
  准备输出目录(配置.输出目录, 配置.是否强制);

  const 导出清单 = 读取JSON(配置.导出清单路径);
  配置.批次编号 = 配置.批次编号 ?? 导出清单.批次编号;
  if (!配置.批次编号) {
    throw new Error("缺少批次编号，请传入 --batch-code");
  }
  if (导出清单.阶段结论?.导出状态 !== "导出通过") {
    throw new Error("阶段8.2导出清单状态不是导出通过，不能生成8.3装载包");
  }

  const 写入结果 = await 写暂存CSV(配置, 导出清单);
  const 期望数量 = 生成期望数量(导出清单);
  const 源快照摘要 = 生成源快照摘要(导出清单);
  const 源快照时间 = 导出清单.生成时间 ?? new Date().toISOString();
  const CRM暂存记录数 = Number(导出清单.汇总?.CRM导出记录总数 ?? 0);
  const 审计暂存记录数 = Number(导出清单.汇总?.审计导出记录总数 ?? 0);
  const 阻断项 = [];
  if (写入结果.暂存记录总数 !== CRM暂存记录数 + 审计暂存记录数) {
    阻断项.push("暂存CSV记录总数与8.2导出清单不一致");
  }
  for (const 文件 of 写入结果.文件统计) {
    if (!文件.数量一致) {
      阻断项.push(`导出文件数量不一致：${文件.相对路径}`);
    }
  }

  const SQL文件 = 写SQL文件(配置, {
    批次编号: 配置.批次编号,
    源快照摘要,
    源快照时间,
    映射版本: 配置.映射版本,
    暂存记录总数: 写入结果.暂存记录总数,
  });
  const 执行脚本 = 写执行脚本(配置, {
    批次编号: 配置.批次编号,
    源快照摘要,
    源快照时间,
    映射版本: 配置.映射版本,
    暂存记录总数: 写入结果.暂存记录总数,
  });
  const 清单 = 写清单和报告(配置, {
    ...写入结果,
    ...SQL文件,
    执行脚本,
    源快照摘要,
    源快照时间,
    CRM暂存记录数,
    审计暂存记录数,
    期望数量,
    阻断项,
  });

  console.log(`阶段8.3暂存装载包已生成：${清单.输出文件.report}`);
  if (配置.记录文档) {
    console.log(`阶段记录已同步：${配置.记录文档}`);
  }
  console.log(`装载包状态：${清单.阶段结论.装载包状态}`);
  console.log(`暂存总记录数：${清单.汇总.暂存总记录数}`);
}

主函数().catch((错误) => {
  console.error(`阶段8.3暂存装载包生成失败：${错误.message}`);
  process.exit(1);
});
