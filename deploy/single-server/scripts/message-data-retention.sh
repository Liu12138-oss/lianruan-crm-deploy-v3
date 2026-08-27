#!/usr/bin/env bash
set -euo pipefail

# 统一消息数据保留脚本默认只生成候选数量；不接受未显式授权的清理操作。
install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
execute=false
confirm_date=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --execute) execute=true ;;
    --confirm-retention)
      confirm_date="${2:-}"
      shift
      ;;
    --plan) ;;
    *)
      echo "未知参数：$1。支持 --plan、--execute、--confirm-retention YYYY-MM-DD。" >&2
      exit 1
      ;;
  esac
  shift
done

if [ "${execute}" = true ]; then
  if [ "${MESSAGE_DATA_CLEANUP_ENABLED:-false}" != "true" ]; then
    echo "拒绝清理：必须在本次命令环境中显式设置 MESSAGE_DATA_CLEANUP_ENABLED=true。" >&2
    exit 1
  fi
  if [ "${confirm_date}" != "$(date '+%Y-%m-%d')" ]; then
    echo "拒绝清理：必须使用当天日期确认，例如 --confirm-retention $(date '+%Y-%m-%d')。" >&2
    exit 1
  fi
fi

compose_dir="${install_root}/compose"
if [ ! -d "${compose_dir}" ]; then
  echo "未找到 Compose 目录：${compose_dir}" >&2
  exit 1
fi
cd "${compose_dir}"

查询() {
  docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U lianruan_app -d lianruan_crm_v3 -P pager=off -c "$1"
}

message_schema_exists="$(docker compose exec -T postgres psql -X -tAc "SELECT to_regnamespace('message') IS NOT NULL" -U lianruan_app -d lianruan_crm_v3 2>/dev/null || true)"
if [ "${message_schema_exists}" != "t" ]; then
  echo "消息保留计划跳过：message 架构尚未迁移。"
  exit 0
fi

echo "统一消息数据保留候选（仅输出数量，不输出任何业务或个人数据）："
查询 "
  SELECT '已归档通知超过365天' AS 项目, count(*) AS 候选数量
  FROM message.notifications
  WHERE status_code = 'archived' AND archived_at < now() - interval '365 days'
  UNION ALL
  SELECT '成功事件消费超过365天', count(*)
  FROM message.event_consumptions
  WHERE status_code = 'succeeded' AND finished_at < now() - interval '365 days'
  UNION ALL
  SELECT '外部投递尝试超过365天',
         CASE WHEN to_regclass('message.delivery_attempts') IS NULL THEN 0
              ELSE (SELECT count(*) FROM message.delivery_attempts WHERE created_at < now() - interval '365 days') END;
"

if [ "${execute}" = false ]; then
  echo "未执行任何清理。若已完成合规审批，可在一次性命令环境设置 MESSAGE_DATA_CLEANUP_ENABLED=true，并同时使用 --execute --confirm-retention 当天日期。"
  exit 0
fi

timestamp="$(date '+%Y%m%d-%H%M%S')"
audit_dir="${install_root}/logs/maintenance"
audit_file="${audit_dir}/message-data-retention-${timestamp}.log"
mkdir -p "${audit_dir}"

{
  echo "执行时间=${timestamp}"
  echo "执行人需要由运维工单记录；本日志不保存个人数据、正文或凭据。"
  echo "保留规则=仅删除归档通知、成功消费事实和投递尝试中超过365天的记录；不删除失败、死信、投递主记录或任何消息架构。"
} > "${audit_file}"

delivery_attempts_table_exists="$(docker compose exec -T postgres psql -X -tAc "SELECT to_regclass('message.delivery_attempts') IS NOT NULL" -U lianruan_app -d lianruan_crm_v3 2>/dev/null || true)"
if [ "${delivery_attempts_table_exists}" = "t" ]; then
  delivery_attempts_cleanup_sql="DELETE FROM message.delivery_attempts WHERE created_at < now() - interval '365 days'"
else
  delivery_attempts_cleanup_sql="DELETE FROM message.deliveries WHERE false"
fi

查询 "
  BEGIN;
  SELECT pg_advisory_xact_lock(hashtext('message.data_retention.cleanup.v1'));
  WITH deleted AS (
    DELETE FROM message.notifications
    WHERE status_code = 'archived' AND archived_at < now() - interval '365 days'
    RETURNING 1
  ) SELECT count(*) AS 已删除归档通知 FROM deleted;
  WITH deleted AS (
    DELETE FROM message.event_consumptions
    WHERE status_code = 'succeeded' AND finished_at < now() - interval '365 days'
    RETURNING 1
  ) SELECT count(*) AS 已删除成功消费事实 FROM deleted;
  WITH deleted AS (
    ${delivery_attempts_cleanup_sql}
    RETURNING 1
  ) SELECT count(*) AS 已删除投递尝试 FROM deleted;
  COMMIT;
" | tee -a "${audit_file}"

echo "清理已执行。审计摘要：${audit_file}"
