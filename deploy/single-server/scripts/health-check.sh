#!/usr/bin/env bash
set -euo pipefail

install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
if [ -f "${install_root}/config/deploy.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${install_root}/config/deploy.env"
  set +a
fi
http_port="${HTTP_PORT:-80}"

读取配置() {
  local key="$1"
  local config_file="${install_root}/config/v3.env"
  if [ -n "${!key:-}" ]; then
    printf '%s' "${!key}"
    return
  fi
  if [ -f "${config_file}" ]; then
    awk -F '=' -v key="${key}" '$1 == key { value=substr($0, length(key) + 2) } END { print value }' "${config_file}" | tr -d '\r'
  fi
}

检查消息容器() {
  local service="$1"
  local container_id
  local state
  local health
  container_id="$(docker compose ps -q "${service}" 2>/dev/null || true)"
  if [ -z "${container_id}" ]; then
    echo "消息角色未运行：${service}" >&2
    return 1
  fi
  state="$(docker inspect -f '{{.State.Status}}' "${container_id}" 2>/dev/null || true)"
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}未配置{{end}}' "${container_id}" 2>/dev/null || true)"
  if [ "${state}" != "running" ] || { [ "${health}" != "healthy" ] && [ "${health}" != "未配置" ]; }; then
    echo "消息角色异常：${service}，状态=${state:-未知}，健康=${health:-未知}" >&2
    return 1
  fi
  echo "消息角色正常：${service}。"
}

检查订单预审容器() {
  local service="worker-order-preapproval"
  local container_id
  local state
  local health
  container_id="$(docker compose ps -q "${service}" 2>/dev/null || true)"
  if [ -z "${container_id}" ]; then
    echo "订单预审任务未运行：${service}" >&2
    return 1
  fi
  state="$(docker inspect -f '{{.State.Status}}' "${container_id}" 2>/dev/null || true)"
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}未配置{{end}}' "${container_id}" 2>/dev/null || true)"
  if [ "${state}" != "running" ] || { [ "${health}" != "healthy" ] && [ "${health}" != "未配置" ]; }; then
    echo "订单预审任务异常：${service}，状态=${state:-未知}，健康=${health:-未知}" >&2
    return 1
  fi
  echo "订单预审任务正常。"
}
cd "${install_root}/compose"

等待HTTP接口() {
  local check_name="$1"
  local url="$2"
  local max_attempts="${3:-60}"
  local delay_seconds="${4:-2}"
  local attempt

  echo "检查${check_name}。"
  for attempt in $(seq 1 "${max_attempts}"); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      echo "${check_name}通过。"
      return 0
    fi
    sleep "${delay_seconds}"
  done

  echo "${check_name}未在预期时间内通过：${url}" >&2
  curl -i -sS "${url}" >&2 || true
  echo >&2
  docker compose ps >&2 || true
  return 1
}

echo "检查容器状态。"
docker compose ps

等待HTTP接口 "API存活状态" "http://127.0.0.1:${http_port}/health/live"
等待HTTP接口 "API就绪状态" "http://127.0.0.1:${http_port}/health/ready"

echo "检查PostgreSQL。"
docker compose exec -T postgres pg_isready -U lianruan_app -d lianruan_crm_v3 >/dev/null

echo "检查Redis状态实例。"
docker compose exec -T redis-state sh -c 'REDISCLI_AUTH="$(cat /run/secrets/redis_password)" redis-cli ping | grep PONG' >/dev/null

echo "检查安装目录磁盘。"
df -h "${install_root}"

message_worker_enabled="$(读取配置 MESSAGE_WORKER_ENABLED)"
message_wecom_group_enabled="$(读取配置 MESSAGE_WECOM_GROUP_ENABLED)"
message_sms_enabled="$(读取配置 MESSAGE_SMS_ENABLED)"
message_email_enabled="$(读取配置 MESSAGE_EMAIL_ENABLED)"
if [ "${message_worker_enabled}" = "true" ]; then
  echo "检查消息角色与积压。"
  message_event_cutover_at="$(读取配置 MESSAGE_EVENT_CUTOVER_AT)"
  if [ -z "${message_event_cutover_at}" ]; then
    echo "消息工作进程已启用但未配置 MESSAGE_EVENT_CUTOVER_AT。" >&2
    exit 1
  fi
  message_schema_exists="$(docker compose exec -T postgres psql -X -tAc "SELECT to_regnamespace('message') IS NOT NULL" -U lianruan_app -d lianruan_crm_v3 2>/dev/null || true)"
  if [ "${message_schema_exists}" != "t" ]; then
    echo "消息工作进程已启用但 message 架构尚未迁移。" >&2
    exit 1
  fi
  检查消息容器 worker-message-critical
  检查消息容器 worker-message-maintenance
  检查消息容器 worker-message-integration
  "${install_root}/scripts/message-observability.sh" --compact
else
  if [ "${message_wecom_group_enabled}" = "true" ] || [ "${message_sms_enabled}" = "true" ] || [ "${message_email_enabled}" = "true" ]; then
    echo "外部消息渠道已启用，但 MESSAGE_WORKER_ENABLED 不是 true。" >&2
    exit 1
  fi
  echo "统一消息工作进程未启用，跳过消息角色与积压检查。"
fi

order_preapproval_worker_enabled="$(读取配置 ORDER_PREAPPROVAL_WORKER_ENABLED)"
if [ "${order_preapproval_worker_enabled}" = "true" ]; then
  order_preapproval_event_cutover_at="$(读取配置 ORDER_PREAPPROVAL_EVENT_CUTOVER_AT)"
  if [ -z "${order_preapproval_event_cutover_at}" ]; then
    echo "订单预审任务进程已启用但未配置 ORDER_PREAPPROVAL_EVENT_CUTOVER_AT。" >&2
    exit 1
  fi
  order_preapproval_table_exists="$(docker compose exec -T postgres psql -X -tAc "SELECT to_regclass('integration.order_preapproval_requests') IS NOT NULL" -U lianruan_app -d lianruan_crm_v3 2>/dev/null || true)"
  if [ "${order_preapproval_table_exists}" != "t" ]; then
    echo "订单预审任务已启用但订单预审数据表尚未迁移。" >&2
    exit 1
  fi
  检查订单预审容器
else
  echo "订单预审任务未启用，跳过订单预审任务检查。"
fi

echo "阶段9健康检查通过。"
