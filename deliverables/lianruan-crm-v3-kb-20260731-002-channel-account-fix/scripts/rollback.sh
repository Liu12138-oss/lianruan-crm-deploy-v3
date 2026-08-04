#!/usr/bin/env bash
set -euo pipefail

install_root="${1:-${INSTALL_ROOT:-/opt/lianruan-crm-v3}}"
release_dir="${2:-}"

失败() {
  echo "回退失败：$*" >&2
  exit 1
}

[ -n "${release_dir}" ] || 失败 "请传入升级脚本输出的快照目录。"
[ -d "${release_dir}" ] || 失败 "快照目录不存在：${release_dir}"
[ -f "${release_dir}/compose/docker-compose.yml" ] || 失败 "快照缺少 Compose 文件。"

cp "${release_dir}/compose/docker-compose.yml" "${install_root}/compose/docker-compose.yml"
[ -f "${release_dir}/compose/.env" ] && cp "${release_dir}/compose/.env" "${install_root}/compose/.env"
[ -f "${release_dir}/config/deploy.env" ] && cp "${release_dir}/config/deploy.env" "${install_root}/config/deploy.env"
[ -f "${release_dir}/config/nginx/default.conf" ] && mkdir -p "${install_root}/config/nginx" && cp "${release_dir}/config/nginx/default.conf" "${install_root}/config/nginx/default.conf"

cd "${install_root}/compose"
docker compose stop nginx || true
docker compose stop api-1 api-2 || true
docker compose up -d api-1 api-2 nginx

"${install_root}/scripts/health-check.sh"
echo "回退完成。"

