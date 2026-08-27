#!/usr/bin/env bash
set -euo pipefail

install_root="${1:-${INSTALL_ROOT:-/opt/lianruan-crm-v3}}"
release_dir="${2:-}"

fail() {
  echo "应用回退失败：$*" >&2
  exit 1
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

run_rollback_compose() {
  env -u V3_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME \
    INSTALL_ROOT="${install_root}" \
    docker compose \
    --project-directory "${install_root}/compose" \
    --env-file "${install_root}/compose/.env" \
    -f "${install_root}/compose/docker-compose.yml" \
    -f "${release_dir}/runtime/rollback-images.yml" \
    "$@"
}

read_runtime_field() {
  local service_name="$1" field_number="$2"
  awk -F'|' -v service="${service_name}" -v field="${field_number}" '$1 == service { print $field; exit }' "${release_dir}/runtime/service-images.tsv"
}

read_config_value() {
  local config_file="$1" key="$2"
  awk -F= -v key="${key}" '$1 == key { value=substr($0, length(key) + 2) } END { print value }' "${config_file}" | tr -d '\r'
}

verify_offboarding_quiesced() {
  local worker_id worker_env worker_offboarding table_exists incomplete_count event_table_exists event_count
  local offboarding_column_exists offboarded_count
  worker_id="$(run_compose --profile message --profile message-external ps -q worker)"
  [ -n "${worker_id}" ] || fail "未找到运行中的主 Worker，无法证明停用归档任务已经停止。"
  worker_env="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "${worker_id}")"
  worker_offboarding="$(printf '%s\n' "${worker_env}" | awk -F= '$1 == "V3_ORGANIZATION_OFFBOARDING_ENABLED" { value=$2 } END { print value }')"
  [ "${worker_offboarding}" != "true" ] || fail "运行中的主 Worker 仍启用了停用归档与交接，请先重建 Worker 并确认实际环境为 false。"

  table_exists="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT to_regclass('org.offboarding_handover') IS NOT NULL" | tr -d '[:space:]')"
  if [ "${table_exists}" = "t" ]; then
    incomplete_count="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT count(*) FROM org.offboarding_handover WHERE status_code NOT IN ('completed','closed','cancelled')" | tr -d '[:space:]')"
    [ "${incomplete_count}" = "0" ] || fail "仍有 ${incomplete_count} 个未完成交接单，拒绝回退应用。"
  fi
  event_table_exists="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT to_regclass('ops.outbox_events') IS NOT NULL" | tr -d '[:space:]')"
  if [ "${event_table_exists}" = "t" ]; then
    event_count="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT count(*) FROM ops.outbox_events WHERE event_type='org.offboarding.scan_requested' AND status_code IN ('pending','processing','failed')" | tr -d '[:space:]')"
    [ "${event_count}" = "0" ] || fail "仍有 ${event_count} 个未终结的交接扫描事件，拒绝回退应用。"
  fi
  offboarding_column_exists="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='iam' AND table_name='users' AND column_name='offboarding_status')" | tr -d '[:space:]')"
  offboarded_count=0
  if [ "${offboarding_column_exists}" = "t" ]; then
    offboarded_count="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT count(*) FROM iam.users WHERE offboarding_status IN ('offboarding','offboarded')" | tr -d '[:space:]')"
  fi
  if [ "${offboarded_count}" != "0" ] && [ "${snapshot_account_status_check}" != "true" ]; then
    fail "已存在 ${offboarded_count} 个停用归档账号，目标快照必须继续开启账号状态防护。"
  fi
}

verify_restored_service() {
  local service_name="$1"
  local expected_image expected_image_id container_id actual_image actual_image_id
  expected_image="$(read_runtime_field "${service_name}" 2)"
  expected_image_id="$(read_runtime_field "${service_name}" 3)"
  [ -n "${expected_image}" ] || fail "快照缺少 ${service_name} 的源镜像。"
  [ "$(docker image inspect -f '{{.Id}}' "${expected_image}")" = "${expected_image_id}" ] || fail "${service_name} 的源镜像摘要不匹配。"
  container_id="$(run_rollback_compose --profile message --profile message-external ps -q "${service_name}")"
  [ -n "${container_id}" ] || fail "回退后未找到 ${service_name}。"
  actual_image="$(docker inspect -f '{{.Config.Image}}' "${container_id}")"
  actual_image_id="$(docker inspect -f '{{.Image}}' "${container_id}")"
  [ "${actual_image}" = "${expected_image}" ] || fail "${service_name} 未恢复源镜像：${actual_image}。"
  [ "${actual_image_id}" = "${expected_image_id}" ] || fail "${service_name} 未恢复源镜像摘要。"
}

wait_for_api_json() {
  local check_name="$1" url="$2" attempt response
  for attempt in $(seq 1 30); do
    if response="$(curl --fail --silent --show-error --max-time 5 "${url}" 2>&1)"; then
      case "${response}" in
        *'"success":true'*'"status":"ok"'*) echo "${check_name}通过。"; return 0 ;;
      esac
    fi
    sleep 2
  done
  echo "${check_name}未在 60 秒内通过，最后响应：${response:-无}" >&2
  return 1
}

[ -n "${release_dir}" ] || fail "请提供升级前应用快照目录。"
[ -d "${release_dir}" ] || fail "未找到应用快照目录：${release_dir}。"
for snapshot_file in \
  compose/docker-compose.yml compose/.env config/v3.env config/deploy.env \
  config/nginx/default.conf runtime/service-images.tsv runtime/rollback-images.yml; do
  [ -f "${release_dir}/${snapshot_file}" ] || fail "快照缺少文件：${snapshot_file}。"
done

current_account_status_check="$(read_config_value "${install_root}/config/v3.env" V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED)"
current_offboarding_enabled="$(read_config_value "${install_root}/config/v3.env" V3_ORGANIZATION_OFFBOARDING_ENABLED)"
snapshot_account_status_check="$(read_config_value "${release_dir}/config/v3.env" V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED)"
[ "${current_offboarding_enabled}" != "true" ] ||
  fail "当前停用归档与交接仍为开启状态，拒绝回退应用。请先关闭 V3_ORGANIZATION_OFFBOARDING_ENABLED 并确认任务停止。"
if [ "${current_account_status_check}" = "true" ] && [ "${snapshot_account_status_check}" != "true" ]; then
  fail "升级前快照不具备账号状态防护，回退会恢复停用账号旧会话，已拒绝执行。请改用具备状态防护的安全基线。"
fi
verify_offboarding_quiesced

echo "开始恢复升级前应用文件和各组件真实镜像。数据库不会自动恢复。"
run_compose --profile message --profile message-external stop \
  nginx api-1 api-2 worker worker-message-critical worker-message-maintenance worker-message-integration || true
cp "${release_dir}/compose/docker-compose.yml" "${install_root}/compose/docker-compose.yml"
cp "${release_dir}/compose/.env" "${install_root}/compose/.env"
cp "${release_dir}/config/v3.env" "${install_root}/config/v3.env"
cp "${release_dir}/config/deploy.env" "${install_root}/config/deploy.env"
cp "${release_dir}/config/nginx/default.conf" "${install_root}/config/nginx/default.conf"
cp "${release_dir}/scripts/"*.sh "${install_root}/scripts/"
chmod 750 "${install_root}/scripts/"*.sh

for service_name in api-1 api-2 worker nginx worker-message-critical worker-message-maintenance worker-message-integration; do
  source_image="$(read_runtime_field "${service_name}" 2)"
  source_image_id="$(read_runtime_field "${service_name}" 3)"
  [ -n "${source_image}" ] || fail "快照缺少 ${service_name}。"
  [ "$(docker image inspect -f '{{.Id}}' "${source_image}")" = "${source_image_id}" ] || fail "${service_name} 的源镜像已不存在或摘要变化。"
done

run_rollback_compose --profile message --profile message-external up -d --no-deps --force-recreate \
  api-1 api-2 worker nginx worker-message-critical worker-message-maintenance worker-message-integration

for service_name in api-1 api-2 worker nginx worker-message-critical worker-message-maintenance worker-message-integration; do
  verify_restored_service "${service_name}"
done

wait_for_api_json "回退后 API 存活检查" "http://127.0.0.1/health/live"
wait_for_api_json "回退后 API 就绪检查" "http://127.0.0.1/health/ready"
echo "应用回退完成，已恢复升级前各组件真实镜像；数据库扩展迁移被保留，数据库恢复仍须负责人确认。"
