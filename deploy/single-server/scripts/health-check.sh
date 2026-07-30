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

echo "阶段9健康检查通过。"
