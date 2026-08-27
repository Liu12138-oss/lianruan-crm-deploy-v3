#!/usr/bin/env bash
set -euo pipefail

install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
cd "${install_root}/compose"

echo "按安全顺序停止联软CRM V3单机服务。"
docker compose stop nginx || true
echo "停止已显式启用的消息角色；未运行的消息 profile 不影响停止流程。"
docker compose --profile message --profile message-external stop worker-message-integration worker-message-maintenance worker-message-critical || true
echo "停止订单预审独立任务；不会修改订单、OA 或建群历史。"
docker compose --profile order-preapproval stop worker-order-preapproval || true
docker compose stop api-1 api-2 worker || true
docker compose stop redis-cache redis-state || true
docker compose stop postgres || true
docker compose ps
echo "服务已停止。"
