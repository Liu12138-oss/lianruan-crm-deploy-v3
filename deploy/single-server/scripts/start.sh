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

echo "启动联软CRM V3单机服务。"
docker compose up -d postgres redis-state redis-cache

if [ -x "${install_root}/scripts/migrate-db.sh" ]; then
  INSTALL_ROOT="${install_root}" "${install_root}/scripts/migrate-db.sh"
else
  echo "未找到数据库迁移脚本，跳过数据库迁移。"
fi

docker compose up -d api-1 api-2 worker nginx

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
