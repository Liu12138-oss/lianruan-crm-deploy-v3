#!/usr/bin/env bash
set -euo pipefail

install_root="${1:-${INSTALL_ROOT:-/opt/lianruan-crm-v3}}"
release_dir="${2:-}"

if [ -z "${release_dir}" ]; then
  echo "用法：bash rollback.sh /opt/lianruan-crm-v3 /opt/lianruan-crm-v3/releases/快照目录" >&2
  exit 1
fi

[ -d "${release_dir}" ] || {
  echo "回退目录不存在：${release_dir}" >&2
  exit 1
}

echo "开始回退应用配置和镜像引用。"
echo "注意：本次升级不变更数据库，回退脚本不处理数据库。"

cd "${install_root}/compose"
docker compose stop nginx api-1 api-2 worker || true

cp "${release_dir}/compose/docker-compose.yml" "${install_root}/compose/docker-compose.yml"
[ -f "${release_dir}/compose/.env" ] && cp "${release_dir}/compose/.env" "${install_root}/compose/.env"
cp "${release_dir}/config/v3.env" "${install_root}/config/v3.env"
[ -f "${release_dir}/config/deploy.env" ] && cp "${release_dir}/config/deploy.env" "${install_root}/config/deploy.env"
[ -f "${release_dir}/config/nginx/default.conf" ] && cp "${release_dir}/config/nginx/default.conf" "${install_root}/config/nginx/default.conf"

docker compose up -d api-1 api-2 worker nginx
"${install_root}/scripts/health-check.sh"

echo "应用配置回退完成。"
