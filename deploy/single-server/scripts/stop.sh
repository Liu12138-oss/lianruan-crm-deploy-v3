#!/usr/bin/env bash
set -euo pipefail

install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
cd "${install_root}/compose"

echo "按安全顺序停止联软CRM V3单机服务。"
docker compose stop nginx || true
docker compose stop api-1 api-2 worker || true
docker compose stop redis-cache redis-state || true
docker compose stop postgres || true
docker compose ps
echo "服务已停止。"
