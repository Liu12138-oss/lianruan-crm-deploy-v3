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

cd "${install_root}/compose"

echo "启动联软CRM V3单机服务。"
docker compose up -d postgres redis-state redis-cache

if [ -x "${install_root}/scripts/migrate-db.sh" ]; then
  INSTALL_ROOT="${install_root}" "${install_root}/scripts/migrate-db.sh"
else
  echo "未找到数据库迁移脚本，跳过数据库迁移。"
fi

docker compose up -d api-1 api-2 worker nginx

message_worker_enabled="$(读取配置 MESSAGE_WORKER_ENABLED)"
if [ "${message_worker_enabled}" = "true" ]; then
  message_event_cutover_at="$(读取配置 MESSAGE_EVENT_CUTOVER_AT)"
  if [ -z "${message_event_cutover_at}" ]; then
    echo "消息工作进程已启用但未配置 MESSAGE_EVENT_CUTOVER_AT，拒绝启动消息 profile。" >&2
    exit 1
  fi
  echo "显式启动站内消息 profile。"
  docker compose --profile message up -d worker-message-critical worker-message-maintenance
  echo "显式启动外部投递消息 profile；通道仍默认关闭，仅在超管保存、试发或启用后才会处理对应投递。"
  docker compose --profile message-external up -d worker-message-integration
else
  echo "统一消息工作进程保持默认关闭，确保所有消息 profile 已停止。"
  docker compose --profile message --profile message-external stop worker-message-integration worker-message-maintenance worker-message-critical || true
fi

order_preapproval_worker_enabled="$(读取配置 ORDER_PREAPPROVAL_WORKER_ENABLED)"
if [ "${order_preapproval_worker_enabled}" = "true" ]; then
  order_preapproval_event_cutover_at="$(读取配置 ORDER_PREAPPROVAL_EVENT_CUTOVER_AT)"
  if [ -z "${order_preapproval_event_cutover_at}" ]; then
    echo "订单预审任务进程已启用但未配置 ORDER_PREAPPROVAL_EVENT_CUTOVER_AT，拒绝启动订单预审 profile。" >&2
    exit 1
  fi
  echo "显式启动渠道产品订单预审任务；该任务只处理切换时间后的预审发件箱事件。"
  docker compose --profile order-preapproval up -d worker-order-preapproval
else
  echo "订单预审任务进程保持默认关闭，确保订单预审 profile 已停止。"
  docker compose --profile order-preapproval stop worker-order-preapproval || true
fi

echo "等待健康检查通过。"
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${http_port}/health/ready" >/dev/null 2>&1; then
    echo "服务就绪检查通过。"
    docker compose ps
    exit 0
  fi
  sleep 2
done

echo "服务启动后未在预期时间内通过就绪检查，请查看容器日志。" >&2
docker compose ps
exit 1
