#!/usr/bin/env bash
set -Eeuo pipefail

# 仅清理可由 V2 正式迁移重新生成的业务记录，不修改表结构、组织区域和部署登录配置。
install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
backup_dir=""
execute="false"
confirm_text=""
stop_services="false"
start_services="false"
clean_accounts="false"
keep_username="admin"

显示帮助() {
  cat <<'EOF'
用途：
  清理 V3 当前业务记录，为 V2 到 V3 的正式导入准备空的业务数据层。

保留：
  数据库结构与迁移版本、组织与区域、部署和登录配置。

清理：
  客户、报备、商机、报价、订单、渠道商及关联、产品与工作量、审批、通知、导入导出任务、
  幂等与发件箱记录、开放接口客户及访问日志、审计日志和旧迁移暂存批次。

默认只输出待清理数量，不会删除数据。

  实际执行前必须：
  1. 已完成 V3 迁移前备份，并通过 --backup-dir 指定含 postgres.sql 的备份目录。
  2. 使用 --stop-services 自动停止 nginx、api-1、api-2、worker；PostgreSQL 会保持运行。
  3. 使用 --clean-accounts 时，仅保留用户名为 admin 的唯一账号及其角色和密码。

用法：
  sudo bash 清理V3业务数据.sh --install-root /opt/lianruan-crm-v3
  sudo bash 清理V3业务数据.sh \
    --install-root /opt/lianruan-crm-v3 \
    --backup-dir /opt/lianruan-crm-v3/backups/local/时间-切换前备份 \
    --execute \
    --stop-services \
    --clean-accounts \
    --confirm 清理V3业务数据

迁移完成后启动服务：
  sudo /opt/lianruan-crm-v3/scripts/start.sh
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --install-root)
      install_root="${2:-}"
      shift 2
      ;;
    --backup-dir)
      backup_dir="${2:-}"
      shift 2
      ;;
    --execute)
      execute="true"
      shift
      ;;
    --confirm)
      confirm_text="${2:-}"
      shift 2
      ;;
    --stop-services)
      stop_services="true"
      shift
      ;;
    --start-services)
      start_services="true"
      shift
      ;;
    --clean-accounts)
      clean_accounts="true"
      shift
      ;;
    -h|--help)
      显示帮助
      exit 0
      ;;
    *)
      echo "未知参数：$1" >&2
      显示帮助 >&2
      exit 1
      ;;
  esac
done

compose_dir="${install_root}/compose"
if [ ! -d "${compose_dir}" ]; then
  echo "未找到 V3 Compose 目录：${compose_dir}" >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 docker 命令，无法连接 V3 PostgreSQL。" >&2
  exit 1
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
log_dir="${install_root}/logs/migration-cutover"
log_file="${log_dir}/清理V3业务数据-${timestamp}.log"
mkdir -p "${log_dir}"
exec > >(tee -a "${log_file}") 2>&1

执行数据库命令() {
  (
    cd "${compose_dir}"
    docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -v "clean_accounts=${clean_accounts}" -U lianruan_app -d lianruan_crm_v3 "$@"
  )
}

停止业务写服务() {
  echo "停止 nginx、api-1、api-2、worker，保留 PostgreSQL。"
  (
    cd "${compose_dir}"
    docker compose stop nginx api-1 api-2 worker
    docker compose up -d postgres
  )
}

启动全部服务() {
  if [ ! -x "${install_root}/scripts/start.sh" ]; then
    echo "未找到服务启动脚本：${install_root}/scripts/start.sh" >&2
    exit 1
  fi

  echo "启动 V3 全部服务并执行健康检查。"
  INSTALL_ROOT="${install_root}" "${install_root}/scripts/start.sh"
}

检查业务写服务已停止() {
  local running_services
  local service_name

  running_services="$(cd "${compose_dir}" && docker compose ps --status running --services || true)"
  for service_name in nginx api-1 api-2 worker; do
    if printf '%s\n' "${running_services}" | grep -Fxq "${service_name}"; then
      echo "服务仍在运行，禁止清理：${service_name}" >&2
      echo "请先停止 nginx、api-1、api-2、worker；不要停止 PostgreSQL。" >&2
      exit 1
    fi
  done

  if ! printf '%s\n' "${running_services}" | grep -Fxq "postgres"; then
    echo "PostgreSQL 未运行，无法执行清理。" >&2
    exit 1
  fi
}

检查保留账号() {
  local keep_account_count

  keep_account_count="$(执行数据库命令 -Atc "SELECT COUNT(*) FROM iam.users WHERE lower(username::text) = lower('${keep_username}');")"
  if [ "${keep_account_count}" != "1" ]; then
    echo "账号清理要求唯一保留账号 ${keep_username}，当前匹配数量：${keep_account_count}。" >&2
    exit 1
  fi
}

输出数量() {
  执行数据库命令 <<'SQL'
SELECT 'crm.customers' AS "数据表", COUNT(*) AS "记录数" FROM crm.customers
UNION ALL SELECT 'crm.customer_aliases', COUNT(*) FROM crm.customer_aliases
UNION ALL SELECT 'crm.registrations', COUNT(*) FROM crm.registrations
UNION ALL SELECT 'crm.registration_events', COUNT(*) FROM crm.registration_events
UNION ALL SELECT 'crm.opportunities', COUNT(*) FROM crm.opportunities
UNION ALL SELECT 'crm.opportunity_followups', COUNT(*) FROM crm.opportunity_followups
UNION ALL SELECT 'crm.opportunity_stage_history', COUNT(*) FROM crm.opportunity_stage_history
UNION ALL SELECT 'crm.quotes', COUNT(*) FROM crm.quotes
UNION ALL SELECT 'crm.quote_items', COUNT(*) FROM crm.quote_items
UNION ALL SELECT 'crm.quote_snapshots', COUNT(*) FROM crm.quote_snapshots
UNION ALL SELECT 'crm.quote_status_history', COUNT(*) FROM crm.quote_status_history
UNION ALL SELECT 'crm.orders', COUNT(*) FROM crm.orders
UNION ALL SELECT 'crm.order_items', COUNT(*) FROM crm.order_items
UNION ALL SELECT 'crm.order_status_history', COUNT(*) FROM crm.order_status_history
UNION ALL SELECT 'crm.business_number_counters', COUNT(*) FROM crm.business_number_counters
UNION ALL SELECT 'channel.partners', COUNT(*) FROM channel.partners
UNION ALL SELECT 'channel.partner_relations', COUNT(*) FROM channel.partner_relations
UNION ALL SELECT 'channel.partner_members', COUNT(*) FROM channel.partner_members
UNION ALL SELECT 'channel.partner_profiles', COUNT(*) FROM channel.partner_profiles
UNION ALL SELECT 'channel.partner_profile_products', COUNT(*) FROM channel.partner_profile_products
UNION ALL SELECT 'catalog.package_items', COUNT(*) FROM catalog.package_items
UNION ALL SELECT 'catalog.price_rules', COUNT(*) FROM catalog.price_rules
UNION ALL SELECT 'catalog.workload_mappings', COUNT(*) FROM catalog.workload_mappings
UNION ALL SELECT 'catalog.workload_rules', COUNT(*) FROM catalog.workload_rules
UNION ALL SELECT 'catalog.delivery_workload_rules', COUNT(*) FROM catalog.delivery_workload_rules
UNION ALL SELECT 'catalog.product_features', COUNT(*) FROM catalog.product_features
UNION ALL SELECT 'catalog.hardware_products', COUNT(*) FROM catalog.hardware_products
UNION ALL SELECT 'catalog.product_packages', COUNT(*) FROM catalog.product_packages
UNION ALL SELECT 'catalog.product_modules', COUNT(*) FROM catalog.product_modules
UNION ALL SELECT 'catalog.product_categories', COUNT(*) FROM catalog.product_categories
UNION ALL SELECT 'catalog.workload_classifications', COUNT(*) FROM catalog.workload_classifications
UNION ALL SELECT 'ops.approvals', COUNT(*) FROM ops.approvals
UNION ALL SELECT 'ops.approval_events', COUNT(*) FROM ops.approval_events
UNION ALL SELECT 'ops.notifications', COUNT(*) FROM ops.notifications
UNION ALL SELECT 'ops.files', COUNT(*) FROM ops.files
UNION ALL SELECT 'ops.import_export_tasks', COUNT(*) FROM ops.import_export_tasks
UNION ALL SELECT 'ops.idempotency_keys', COUNT(*) FROM ops.idempotency_keys
UNION ALL SELECT 'ops.outbox_events', COUNT(*) FROM ops.outbox_events
UNION ALL SELECT 'integration.open_api_access_logs', COUNT(*) FROM integration.open_api_access_logs
UNION ALL SELECT 'integration.open_api_client_secrets', COUNT(*) FROM integration.open_api_client_secrets
UNION ALL SELECT 'integration.open_api_permissions', COUNT(*) FROM integration.open_api_permissions
UNION ALL SELECT 'integration.open_api_clients', COUNT(*) FROM integration.open_api_clients
UNION ALL SELECT 'audit.audit_logs', COUNT(*) FROM audit.audit_logs
UNION ALL SELECT 'migration.migration_batches', COUNT(*) FROM migration.migration_batches
ORDER BY 1;
SQL
}

输出账号数量() {
  执行数据库命令 <<'SQL'
SELECT username::text AS "用户名", display_name AS "显示名称", status_code AS "状态", v2_source_id AS "V2来源编号"
FROM iam.users
ORDER BY username;
SQL
}

检查目标表存在() {
  执行数据库命令 <<'SQL'
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'crm.customers', 'crm.customer_aliases', 'crm.registrations', 'crm.registration_events',
    'crm.opportunities', 'crm.opportunity_followups', 'crm.opportunity_stage_history',
    'crm.quotes', 'crm.quote_items', 'crm.quote_snapshots', 'crm.quote_status_history',
    'crm.orders', 'crm.order_items', 'crm.order_status_history', 'crm.business_number_counters',
    'channel.partners', 'channel.partner_relations', 'channel.partner_members',
    'channel.partner_profiles', 'channel.partner_profile_products',
    'catalog.package_items', 'catalog.price_rules', 'catalog.workload_mappings',
    'catalog.workload_rules', 'catalog.delivery_workload_rules', 'catalog.product_features',
    'catalog.hardware_products', 'catalog.product_packages', 'catalog.product_modules',
    'catalog.product_categories', 'catalog.workload_classifications',
    'ops.approvals', 'ops.approval_events', 'ops.notifications', 'ops.files',
    'ops.import_export_tasks', 'ops.idempotency_keys', 'ops.outbox_events',
    'integration.open_api_access_logs', 'integration.open_api_client_secrets',
    'integration.open_api_permissions', 'integration.open_api_clients', 'audit.audit_logs',
    'migration.migration_batches'
  ]
  LOOP
    IF to_regclass(target_table) IS NULL THEN
      RAISE EXCEPTION '缺少预期业务表：%，请先核对 V3 数据库迁移版本', target_table;
    END IF;
  END LOOP;
END $$;
SQL
}

echo "V3 业务数据清理准备开始。"
echo "安装目录：${install_root}"
echo "日志文件：${log_file}"
echo "本脚本不会删除上传目录、导出目录、账号权限、组织区域、部署与登录配置或数据库结构。"

检查目标表存在
echo "当前待清理记录数量："
输出数量

if [ "${execute}" != "true" ]; then
  echo "当前为盘点模式，未删除任何数据。"
  echo "实际执行前请完成备份，然后传入 --execute --stop-services --confirm 清理V3业务数据。"
  exit 0
fi

if [ "${confirm_text}" != "清理V3业务数据" ]; then
  echo "确认语不正确，未执行删除。" >&2
  exit 1
fi
if [ -z "${backup_dir}" ] || [ ! -s "${backup_dir}/postgres.sql" ]; then
  echo "未找到有效 PostgreSQL 备份：${backup_dir}/postgres.sql" >&2
  echo "请先完成 V3 迁移前备份，再使用 --backup-dir 指定备份目录。" >&2
  exit 1
fi

if [ "${stop_services}" != "true" ]; then
  echo "实际清理必须传入 --stop-services，避免业务写入与清理并发发生。" >&2
  exit 1
fi

if [ "${start_services}" = "true" ]; then
  echo "已指定 --start-services：清理成功后将启动全部 V3 服务。"
else
  echo "清理成功后将保持业务服务停止，便于继续导入 V2 数据。"
fi

if [ "${clean_accounts}" = "true" ]; then
  echo "已指定 --clean-accounts：将只保留账号 ${keep_username}，并清理其他账号及其关联身份、角色、员工画像和任职。"
  检查保留账号
  echo "当前账号清单："
  输出账号数量
else
  echo "未指定 --clean-accounts：保留全部现有账号、密码和角色。"
fi

停止业务写服务
检查业务写服务已停止

echo "开始事务清理。"
执行数据库命令 <<'SQL'
BEGIN;

DELETE FROM crm.order_status_history;
DELETE FROM crm.order_items;
DELETE FROM crm.orders;
DELETE FROM crm.quote_status_history;
DELETE FROM crm.quote_snapshots;
DELETE FROM crm.quote_items;
DELETE FROM crm.quotes;
DELETE FROM crm.opportunity_stage_history;
DELETE FROM crm.opportunity_followups;
DELETE FROM crm.opportunities;
DELETE FROM crm.registration_events;
DELETE FROM crm.registrations;
DELETE FROM crm.customer_aliases;
DELETE FROM crm.customers;
DELETE FROM crm.business_number_counters;

DELETE FROM catalog.package_items;
DELETE FROM catalog.price_rules;
DELETE FROM catalog.workload_mappings;
DELETE FROM catalog.workload_rules;
DELETE FROM catalog.delivery_workload_rules;
DELETE FROM catalog.product_features;
DELETE FROM catalog.hardware_products;
DELETE FROM catalog.product_packages;
DELETE FROM catalog.product_modules;
DELETE FROM catalog.product_categories;
DELETE FROM catalog.workload_classifications;

DELETE FROM ops.approval_events;
DELETE FROM ops.approvals;
DELETE FROM ops.notifications;
DELETE FROM ops.import_export_tasks;
DELETE FROM ops.files;
DELETE FROM ops.idempotency_keys;
DELETE FROM ops.outbox_events;

DELETE FROM integration.open_api_access_logs;
DELETE FROM integration.open_api_client_secrets;
DELETE FROM integration.open_api_permissions;
DELETE FROM integration.open_api_clients;
DELETE FROM audit.audit_logs;

DELETE FROM channel.partner_profile_products;
DELETE FROM channel.partner_profiles;
DELETE FROM channel.partner_members;
DELETE FROM channel.partner_relations;
DELETE FROM channel.partners;

DELETE FROM migration.migration_batches;

\if :clean_accounts
DO $$
DECLARE
  keep_user_id uuid;
BEGIN
  SELECT id INTO keep_user_id
  FROM iam.users
  WHERE lower(username::text) = 'admin';

  IF to_regclass('org.positions') IS NOT NULL THEN
    UPDATE org.positions
    SET created_by_user_id = NULL
    WHERE created_by_user_id IS NOT NULL AND created_by_user_id <> keep_user_id;
  END IF;

  IF to_regclass('org.staff_assignments') IS NOT NULL THEN
    IF to_regclass('org.manager_relations') IS NOT NULL THEN
      UPDATE org.manager_relations
      SET created_by_user_id = NULL
      WHERE created_by_user_id IS NOT NULL AND created_by_user_id <> keep_user_id;
      DELETE FROM org.manager_relations;
    END IF;

    DELETE FROM org.staff_assignments WHERE user_id <> keep_user_id;
  END IF;
END $$;

DELETE FROM iam.users
WHERE lower(username::text) <> 'admin';
\endif

COMMIT;
SQL

echo "清理完成，执行清理后核对："
输出数量

remaining_count="$(执行数据库命令 -Atc "
SELECT COALESCE(SUM(count_value), 0)
FROM (
  SELECT COUNT(*) AS count_value FROM crm.customers
  UNION ALL SELECT COUNT(*) FROM crm.registrations
  UNION ALL SELECT COUNT(*) FROM crm.opportunities
  UNION ALL SELECT COUNT(*) FROM crm.quotes
  UNION ALL SELECT COUNT(*) FROM crm.orders
  UNION ALL SELECT COUNT(*) FROM channel.partners
  UNION ALL SELECT COUNT(*) FROM catalog.product_features
  UNION ALL SELECT COUNT(*) FROM catalog.hardware_products
  UNION ALL SELECT COUNT(*) FROM catalog.product_packages
  UNION ALL SELECT COUNT(*) FROM ops.approvals
  UNION ALL SELECT COUNT(*) FROM ops.notifications
  UNION ALL SELECT COUNT(*) FROM integration.open_api_clients
  UNION ALL SELECT COUNT(*) FROM audit.audit_logs
  UNION ALL SELECT COUNT(*) FROM migration.migration_batches
) AS remaining;")"

if [ "${remaining_count}" != "0" ]; then
  echo "清理后核对失败，仍存在业务记录：${remaining_count}" >&2
  exit 1
fi

if [ "${clean_accounts}" = "true" ]; then
  remaining_account_count="$(执行数据库命令 -Atc "SELECT COUNT(*) FROM iam.users WHERE lower(username::text) <> lower('${keep_username}');")"
  if [ "${remaining_account_count}" != "0" ]; then
    echo "账号清理后核对失败，仍存在非 ${keep_username} 账号：${remaining_account_count}" >&2
    exit 1
  fi
  echo "账号清理后保留账号："
  输出账号数量
fi

echo "V3 业务数据已清理完成。"
echo "下一步可执行 V2 迁移包的暂存导入、数量核对和正式落表。"
echo "如需回退，请使用本次备份恢复 PostgreSQL，再恢复上传和导出文件。"

if [ "${start_services}" = "true" ]; then
  启动全部服务
else
  echo "业务服务保持停止状态；V2 导入完成并核对通过后，再执行 start.sh。"
fi
