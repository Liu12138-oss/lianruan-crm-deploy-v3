#!/usr/bin/env bash
set -euo pipefail

install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
target_version=""
dry_run=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      dry_run=true
      shift
      ;;
    --to)
      target_version="${2:-}"
      shift 2
      ;;
    *)
      echo "未知参数：$1" >&2
      exit 1
      ;;
  esac
done

if [ -z "${target_version}" ]; then
  echo "请使用 --to 指定要回退的版本目录，或使用 --dry-run 查看说明。" >&2
  if [ "${dry_run}" = true ]; then
    echo "回退目录约定：${install_root}/releases/版本号/"
    exit 0
  fi
  exit 1
fi

release_dir="${install_root}/releases/${target_version}"
if [ ! -d "${release_dir}" ]; then
  echo "未找到回退版本目录：${release_dir}" >&2
  exit 1
fi
for required_file in compose/docker-compose.yml config/v3.env; do
  if [ ! -f "${release_dir}/${required_file}" ]; then
    echo "回退版本缺少文件：${release_dir}/${required_file}" >&2
    exit 1
  fi
done

echo "准备回退到版本：${target_version}"
echo "注意：本脚本只回退应用镜像和配置，不自动回滚数据库。"

read_config_value() {
  local config_file="$1" key="$2"
  awk -F= -v key="${key}" '$1 == key { value=substr($0, length(key) + 2) } END { print value }' "${config_file}" | tr -d '\r'
}

run_compose() {
  env -u V3_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME \
    INSTALL_ROOT="${install_root}" \
    docker compose \
    --project-directory "${install_root}/compose" \
    --env-file "${install_root}/compose/.env" \
    -f "${install_root}/compose/docker-compose.yml" \
    "$@"
}

verify_offboarding_quiesced() {
  local worker_id worker_env worker_offboarding table_exists incomplete_count event_table_exists event_count
  local offboarding_column_exists offboarded_count
  worker_id="$(run_compose --profile message --profile message-external ps -q worker)"
  if [ -z "${worker_id}" ]; then
    echo "未找到运行中的主 Worker，无法证明停用归档任务已经停止。" >&2
    exit 1
  fi
  worker_env="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "${worker_id}")"
  worker_offboarding="$(printf '%s\n' "${worker_env}" | awk -F= '$1 == "V3_ORGANIZATION_OFFBOARDING_ENABLED" { value=$2 } END { print value }')"
  if [ "${worker_offboarding}" = "true" ]; then
    echo "运行中的主 Worker 仍启用了停用归档与交接，请先重建 Worker 并确认实际环境为 false。" >&2
    exit 1
  fi

  table_exists="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT to_regclass('org.offboarding_handover') IS NOT NULL" | tr -d '[:space:]')"
  if [ "${table_exists}" = "t" ]; then
    incomplete_count="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT count(*) FROM org.offboarding_handover WHERE status_code NOT IN ('completed','closed','cancelled')" | tr -d '[:space:]')"
    if [ "${incomplete_count}" != "0" ]; then
      echo "仍有 ${incomplete_count} 个未完成交接单，拒绝回退应用。" >&2
      exit 1
    fi
  fi

  event_table_exists="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT to_regclass('ops.outbox_events') IS NOT NULL" | tr -d '[:space:]')"
  if [ "${event_table_exists}" = "t" ]; then
    event_count="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT count(*) FROM ops.outbox_events WHERE event_type='org.offboarding.scan_requested' AND status_code IN ('pending','processing','failed')" | tr -d '[:space:]')"
    if [ "${event_count}" != "0" ]; then
      echo "仍有 ${event_count} 个未终结的交接扫描事件，拒绝回退应用。" >&2
      exit 1
    fi
  fi

  offboarding_column_exists="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='iam' AND table_name='users' AND column_name='offboarding_status')" | tr -d '[:space:]')"
  offboarded_count=0
  if [ "${offboarding_column_exists}" = "t" ]; then
    offboarded_count="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT count(*) FROM iam.users WHERE offboarding_status IN ('offboarding','offboarded')" | tr -d '[:space:]')"
  fi
  if [ "${offboarded_count}" != "0" ] && [ "${target_account_status_check}" != "true" ]; then
    echo "已存在 ${offboarded_count} 个停用归档账号，目标版本必须继续开启账号状态防护。" >&2
    exit 1
  fi
}

current_account_status_check="$(read_config_value "${install_root}/config/v3.env" V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED)"
current_offboarding_enabled="$(read_config_value "${install_root}/config/v3.env" V3_ORGANIZATION_OFFBOARDING_ENABLED)"
target_account_status_check="$(read_config_value "${release_dir}/config/v3.env" V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED)"
[ "${current_offboarding_enabled}" != "true" ] || {
  echo "当前停用归档与交接仍为开启状态，拒绝回退应用。请先关闭 V3_ORGANIZATION_OFFBOARDING_ENABLED 并确认任务停止。" >&2
  exit 1
}
if [ "${current_account_status_check}" = "true" ] && [ "${target_account_status_check}" != "true" ]; then
  echo "目标版本不具备账号状态防护，回退会恢复停用账号旧会话，已拒绝执行。请改用具备状态防护的安全基线。" >&2
  exit 1
fi
verify_offboarding_quiesced

if [ "${dry_run}" = true ]; then
  echo "演练模式：将检查目录但不替换文件。"
  exit 0
fi

cp "${release_dir}/compose/docker-compose.yml" "${install_root}/compose/docker-compose.yml"
cp "${release_dir}/config/v3.env" "${install_root}/config/v3.env"

cd "${install_root}/compose"
docker compose up -d api-1 api-2 worker nginx

echo "回退命令执行完成，请立即运行健康检查：${install_root}/scripts/health-check.sh"
