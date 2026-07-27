# PostgreSQL暂存装载操作手册

更新日期：2026-07-27

## 1. 操作目标

阶段8.3把阶段8.2生成的 V2 只读导出文件装载到 PostgreSQL 的 `migration.*` 暂存表，并生成数量守恒校验、异常隔离清单和执行报告。

本阶段不写入业务正式表，不开放 V3 业务入口，不代表正式迁移完成。

## 2. 前置条件

1. 阶段8.1正式源库记录为“已确认正式源库”。
2. 阶段8.2只读导出状态为“导出通过”。
3. `tmp/stage8/v2-export-official/manifest.json` 存在。
4. 测试或生产候选 PostgreSQL 可用。
5. 操作人确认当前执行目标是测试库或正式迁移窗口内的 V3 PostgreSQL。

## 3. 生成装载包

```bash
node scripts/migration/生成PostgreSQL暂存装载包.js \
  --export-manifest "tmp/stage8/v2-export-official/manifest.json" \
  --output-dir "tmp/stage8/v2-postgres-staging-official" \
  --batch-code "S8-RUN-20260727-001" \
  --record-doc "docs/stage-records/阶段8.3-PostgreSQL暂存装载包报告.md" \
  --force
```

## 4. 装载包结构

```text
tmp/stage8/v2-postgres-staging-official/
├── load/
│   ├── v2_raw_records.csv
│   └── expected-counts.csv
├── sql/
│   ├── 00-prepare-migration-staging.sql
│   ├── 01-load-v2-raw-records.sql
│   └── 02-verify-staging.sql
├── scripts/
│   └── 执行PostgreSQL暂存装载.sh
├── reports/
│   └── 阶段8.3-PostgreSQL暂存装载包报告.md
├── logs/
├── manifest.json
└── sha256sum.txt
```

## 5. 执行方式

本机有 `psql` 时：

```bash
DATABASE_URL="postgres://用户:密码@主机:5432/lianruan_crm_v3" \
  tmp/stage8/v2-postgres-staging-official/scripts/执行PostgreSQL暂存装载.sh
```

在单机容器部署服务器上：

```bash
STAGE8_PSQL_MODE=docker \
POSTGRES_CONTAINER=lianruan-crm-v3-postgres \
  tmp/stage8/v2-postgres-staging-official/scripts/执行PostgreSQL暂存装载.sh
```

执行脚本会自动写日志到：

```text
tmp/stage8/v2-postgres-staging-official/logs/
```

## 6. 校验标准

执行成功后必须满足：

1. `migration.migration_batches.status_code = imported`。
2. `migration.v2_raw_records` 暂存总数等于阶段8.2导出总数。
3. 每个实体的暂存数量等于 `migration.v2_import_expected_counts.expected_records`。
4. `migration.validation_results` 中 `S8_3_%` 校验项全部为 `passed`。
5. `migration.migration_errors` 不存在未解决异常。

## 7. 安全边界

- `raw_json` 与 `redacted_json` 均写入脱敏 JSON。
- 暂存层不保存 V2 明文密码、开放接口密钥、令牌和授权值。
- 本阶段不写 `crm.*`、`channel.*`、`iam.*`、`catalog.*`、`ops.*`、`integration.*`、`audit.*` 业务正式表。
- 校验失败时不得进入阶段8.4。

## 8. 回退方式

暂存装载失败时，不需要恢复业务表。确认批次编号后可清理本批次暂存数据：

```sql
DELETE FROM migration.migration_batches
WHERE batch_code = 'S8-RUN-20260727-001';
```

因为相关暂存表均通过外键 `ON DELETE CASCADE` 关联批次，该操作会删除本批次暂存记录、期望数量、校验结果和异常清单。
