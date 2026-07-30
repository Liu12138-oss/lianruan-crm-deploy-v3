# 阶段8.3 PostgreSQL暂存装载包报告

生成时间：2026-07-30T07:29:09.035Z

## 1. 装载包结论

| 项目 | 结果 |
| --- | --- |
| 批次编号 | S8-RUN-20260730-005 |
| 装载包状态 | 装载包可执行 |
| 导出清单 | `/Users/liu/Documents/Codex/lianruan-crm-deploy-v3/tmp/stage8/S8-RUN-20260730-005/v2-export/manifest.json` |
| 输出目录 | `/Users/liu/Documents/Codex/lianruan-crm-deploy-v3/tmp/stage8/S8-RUN-20260730-005/v2-postgres-staging` |
| 源快照摘要 | `99b82046f9eb0589d965445a3b2a1a72764424f6e7e81e83793033384da54b07` |
| 映射版本 | v2-entity-mapping@2026-07-23 |
| CRM暂存记录数 | 952 |
| 审计暂存记录数 | 549 |
| 暂存总记录数 | 1501 |
| 期望实体数 | 21 |

## 2. 期望数量

| 实体名 | 期望数量 | 分组 |
| --- | --- | --- |
| categories | 3 | crm_entity |
| features | 34 | crm_entity |
| hardwareProducts | 15 | crm_entity |
| implementationDeliveryWorkloadRules | 15 | crm_entity |
| implementationWorkloadClassifications | 3 | crm_entity |
| implementationWorkloadMappings | 49 | crm_entity |
| implementationWorkloadRules | 24 | crm_entity |
| modules | 7 | crm_entity |
| notifications | 55 | crm_entity |
| openApiClients | 4 | crm_entity |
| opportunities | 47 | crm_entity |
| orders | 1 | crm_entity |
| packages | 6 | crm_entity |
| partnerProfileProducts | 4 | crm_entity |
| partnerProfiles | 198 | crm_entity |
| partners | 197 | crm_entity |
| pendingApprovals | 23 | crm_entity |
| quotes | 4 | crm_entity |
| registrations | 188 | crm_entity |
| users | 75 | crm_entity |
| audit_logs | 549 | audit_log |

## 3. 装载文件

| 类型 | 相对路径 | 记录数 | 大小字节 | SHA256 |
| --- | --- | --- | --- | --- |
| 暂存记录CSV | `load/v2_raw_records.csv` | 1501 | 2636084 | `d85da1c7324775b91dc89016a1d3443cc0116be2485f31ddb2459454eda847fd` |
| 期望数量CSV | `load/expected-counts.csv` | 21 | 1102 | `fc1c164d1c43c90d0fde1e16b0f2b754bc84bbaf80759030ffdf6ad8acdfb3e2` |
| 准备SQL | `sql/00-prepare-migration-staging.sql` |  | 4446 | `eceb6a508c2ba9ac93cbf9df415f7dab7fcb3b0ee0d765f2c4ac24c3794f6437` |
| 装载SQL | `sql/01-load-v2-raw-records.sql` |  | 8758 | `40680df23705d48efe10ac0472222c73f63b93ed082cd4b80790bbeb11013d06` |
| 校验SQL | `sql/02-verify-staging.sql` |  | 2495 | `977422289f65dc2967c614d06505354065aa888367e2ee4f225c4eb35f9c4f29` |
| 执行脚本 | `scripts/执行PostgreSQL暂存装载.sh` |  | 2723 | `7ccc8d6fbcb5e2d61132663366a65c23af80319be26cf85bd669b3dcfc56e196` |

## 4. 执行方式

本机有 PostgreSQL 客户端时：

```bash
DATABASE_URL="postgres://用户:密码@主机:5432/lianruan_crm_v3" \
  tmp/stage8/S8-RUN-20260730-005/v2-postgres-staging/scripts/执行PostgreSQL暂存装载.sh
```

生产容器方式：

```bash
STAGE8_PSQL_MODE=docker \
POSTGRES_CONTAINER=lianruan-crm-v3-postgres \
  tmp/stage8/S8-RUN-20260730-005/v2-postgres-staging/scripts/执行PostgreSQL暂存装载.sh
```

## 5. 阶段边界

- 本装载包只写入 `migration.migration_batches`、`migration.v2_raw_records`、`migration.v2_import_expected_counts`、`migration.validation_results` 和 `migration.migration_errors`。
- 本装载包不写入 `crm.*`、`channel.*`、`iam.*` 等业务正式表。
- 暂存层不保存 V2 明文密码、开放接口密钥、令牌和授权值；`raw_json` 与 `redacted_json` 均写入脱敏后的 JSON。
- 执行 `02-verify-staging.sql` 失败时，不得进入阶段8.4。
