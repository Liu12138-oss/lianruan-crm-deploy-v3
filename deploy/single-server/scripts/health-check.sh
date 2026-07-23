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
cd "${install_root}/compose"

echo "检查容器状态。"
docker compose ps

echo "检查API存活状态。"
curl -fsS "http://127.0.0.1:${http_port}/health/live" >/dev/null

echo "检查API就绪状态。"
curl -fsS "http://127.0.0.1:${http_port}/health/ready" >/dev/null

echo "检查PostgreSQL。"
docker compose exec -T postgres pg_isready -U lianruan_app -d lianruan_crm_v3 >/dev/null

echo "检查Redis状态实例。"
docker compose exec -T redis-state sh -c 'REDISCLI_AUTH="$(cat /run/secrets/redis_password)" redis-cli ping | grep PONG' >/dev/null

echo "检查安装目录磁盘。"
df -h "${install_root}"

echo "阶段7健康检查通过。"
