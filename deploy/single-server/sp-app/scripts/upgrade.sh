#!/usr/bin/env bash
set -euo pipefail

install_root="${1:-${INSTALL_ROOT:-/opt/lianruan-crm-v3}}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "${script_dir}/.." && pwd)"
meta_file="${package_root}/manifest/包元数据.env"
set -a
# shellcheck disable=SC1090
. "${meta_file}"
set +a

timestamp="$(date '+%Y%m%d-%H%M%S')"
log_dir="${install_root}/logs/install"
log_file="${log_dir}/${PACKAGE_ID}-${timestamp}.log"
release_dir="${install_root}/releases/${TARGET_VERSION}-pre-${timestamp}"
backup_dir="${install_root}/backups/local/${timestamp}-${PACKAGE_ID}-preupgrade"
rollback_started=false
app_switch_started=false

mkdir -p "${log_dir}"
exec > >(tee -a "${log_file}") 2>&1

run_compose() {
  env -u V3_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME \
    INSTALL_ROOT="${install_root}" \
    docker compose \
    --project-directory "${install_root}/compose" \
    --env-file "${install_root}/compose/.env" \
    -f "${install_root}/compose/docker-compose.yml" \
    "$@"
}

message_services=()
if [ "$(awk -F= '$1 == "MESSAGE_WORKER_ENABLED" { value=$2 } END { print value }' "${install_root}/config/v3.env" | tr -d '\r')" = "true" ]; then
  message_services=(worker-message-critical worker-message-maintenance worker-message-integration)
fi
order_preapproval_services=()
if [ "$(awk -F= '$1 == "ORDER_PREAPPROVAL_WORKER_ENABLED" { value=$2 } END { print value }' "${install_root}/config/v3.env" | tr -d '\r')" = "true" ]; then
  order_preapproval_services=(worker-order-preapproval)
fi

记录运行镜像() {
  local service_name="$1"
  local container_id running_image running_image_id running_state
  container_id="$(run_compose --profile message --profile message-external ps -q "${service_name}")"
  [ -n "${container_id}" ] || { echo "无法记录升级前服务：${service_name}。" >&2; return 1; }
  running_image="$(docker inspect -f '{{.Config.Image}}' "${container_id}")"
  running_image_id="$(docker inspect -f '{{.Image}}' "${container_id}")"
  running_state="$(docker inspect -f '{{.State.Status}}' "${container_id}")"
  [ "$(docker image inspect -f '{{.Id}}' "${running_image}")" = "${running_image_id}" ] || {
    echo "升级前服务 ${service_name} 的镜像标签与实际摘要不一致。" >&2
    return 1
  }
  printf '%s|%s|%s|%s\n' "${service_name}" "${running_image}" "${running_image_id}" "${running_state}" >> "${release_dir}/runtime/service-images.tsv"
  printf '  %s:\n    image: %s\n' "${service_name}" "${running_image}" >> "${release_dir}/runtime/rollback-images.yml"
}

target_runtime_is_healthy() {
  local service_name image_name target_image target_image_id container_id health_status response
  for service_name in api-1 api-2; do
    image_name="lianruan-crm-v3-api"
    target_image="${image_name}:${TARGET_VERSION}"
    target_image_id="$(docker image inspect -f '{{.Id}}' "${target_image}" 2>/dev/null)" || return 1
    container_id="$(run_compose --profile message --profile message-external --profile order-preapproval ps -q "${service_name}" 2>/dev/null)" || return 1
    [ -n "${container_id}" ] || return 1
    [ "$(docker inspect -f '{{.Config.Image}}' "${container_id}" 2>/dev/null)" = "${target_image}" ] || return 1
    [ "$(docker inspect -f '{{.Image}}' "${container_id}" 2>/dev/null)" = "${target_image_id}" ] || return 1
    health_status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}" 2>/dev/null)"
    [ "${health_status}" = "healthy" ] || return 1
  done
  for service_name in worker "${message_services[@]}" "${order_preapproval_services[@]}"; do
    target_image="lianruan-crm-v3-worker:${TARGET_VERSION}"
    target_image_id="$(docker image inspect -f '{{.Id}}' "${target_image}" 2>/dev/null)" || return 1
    container_id="$(run_compose --profile message --profile message-external --profile order-preapproval ps -q "${service_name}" 2>/dev/null)" || return 1
    [ -n "${container_id}" ] || return 1
    [ "$(docker inspect -f '{{.Config.Image}}' "${container_id}" 2>/dev/null)" = "${target_image}" ] || return 1
    [ "$(docker inspect -f '{{.Image}}' "${container_id}" 2>/dev/null)" = "${target_image_id}" ] || return 1
  done
  target_image="lianruan-crm-v3-nginx:${TARGET_VERSION}"
  target_image_id="$(docker image inspect -f '{{.Id}}' "${target_image}" 2>/dev/null)" || return 1
  container_id="$(run_compose --profile message --profile message-external --profile order-preapproval ps -q nginx 2>/dev/null)" || return 1
  [ -n "${container_id}" ] || return 1
  [ "$(docker inspect -f '{{.Config.Image}}' "${container_id}" 2>/dev/null)" = "${target_image}" ] || return 1
  [ "$(docker inspect -f '{{.Image}}' "${container_id}" 2>/dev/null)" = "${target_image_id}" ] || return 1
  health_status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}" 2>/dev/null)"
  [ "${health_status}" = "healthy" ] || return 1
  response="$(curl --fail --silent --show-error --max-time 5 http://127.0.0.1/health/live 2>/dev/null)" || return 1
  case "${response}" in *'"success":true'*'"status":"ok"'*"\"版本\":\"${TARGET_VERSION}\""*) return 0 ;; esac
  return 1
}

回退应用() {
  [ "${rollback_started}" = false ] || return
  rollback_started=true
  if [ "${app_switch_started}" != true ]; then
    echo "应用切换尚未开始，无需自动回退。"
    return
  fi
  if target_runtime_is_healthy; then
    echo "目标七个应用容器、镜像摘要和核心健康接口均正常；本次失败属于其他验证项，保留健康目标版本并停止自动回退。"
    echo "请根据日志复核后执行：bash ${script_dir}/verify.sh ${install_root}"
    return
  fi
  echo "升级失败，开始自动恢复升级前应用文件；数据库不会自动恢复。"
  if [ -d "${release_dir}" ]; then
    bash "${script_dir}/rollback.sh" "${install_root}" "${release_dir}" || true
  fi
}

失败处理() {
  local exit_code="$1"
  回退应用
  echo "SP-APP 升级失败，退出码：${exit_code}" >&2
  echo "升级日志：${log_file}" >&2
  echo "应用快照：${release_dir}" >&2
  echo "数据库备份：${backup_dir}/postgres.sql（仅可在负责人确认后人工恢复）" >&2
  exit "${exit_code}"
}
trap '失败处理 $?' ERR

echo "开始 SP-APP 升级：${PACKAGE_ID}，目标版本：${TARGET_VERSION}。"
bash "${script_dir}/precheck.sh" "${install_root}"
current_version="$(awk -F= '$1 == "V3_IMAGE_TAG" { value=$2 } END { print value }' "${install_root}/compose/.env" | tr -d '\r')"
runtime_container="$(run_compose ps -q api-1 2>/dev/null || true)"
if [ -n "${runtime_container}" ]; then
  runtime_image="$(docker inspect -f '{{.Config.Image}}' "${runtime_container}" 2>/dev/null || true)"
  runtime_version="${runtime_image##*:}"
  if [ -n "${runtime_version}" ] && [ "${runtime_version}" != "${current_version}" ]; then
    echo "检测到 Compose 配置版本 ${current_version} 与 API 实际运行版本 ${runtime_version} 不一致，按实际运行版本执行升级。"
    current_version="${runtime_version}"
  fi
fi
if [ "${current_version}" = "${TARGET_VERSION}" ]; then
  echo "目标版本已部署，执行重复复核。"
  bash "${script_dir}/verify.sh" "${install_root}"
  trap - ERR
  exit 0
fi

mkdir -p "${backup_dir}" "${release_dir}/compose" "${release_dir}/config/nginx" "${release_dir}/scripts" "${release_dir}/runtime"
echo "创建数据库与业务文件备份。"
run_compose exec -T postgres pg_dump -U lianruan_app -d lianruan_crm_v3 > "${backup_dir}/postgres.sql"
for data_name in uploads exports; do
  mkdir -p "${install_root}/data/${data_name}"
  (cd "${install_root}/data" && zip -qr -X "${backup_dir}/${data_name}.zip" "${data_name}")
done

echo "保存应用快照：${release_dir}。"
cp "${install_root}/compose/docker-compose.yml" "${release_dir}/compose/docker-compose.yml"
cp "${install_root}/compose/.env" "${release_dir}/compose/.env"
cp "${install_root}/config/v3.env" "${release_dir}/config/v3.env"
cp "${install_root}/config/deploy.env" "${release_dir}/config/deploy.env"
cp "${install_root}/config/nginx/default.conf" "${release_dir}/config/nginx/default.conf"
cp "${install_root}/scripts/"*.sh "${release_dir}/scripts/"
printf 'services:\n' > "${release_dir}/runtime/rollback-images.yml"
for service_name in api-1 api-2 worker nginx "${message_services[@]}" "${order_preapproval_services[@]}"; do
  记录运行镜像 "${service_name}"
done

echo "预加载离线业务镜像。"
for image_file in "${package_root}"/images/*.docker-image; do
  docker load -i "${image_file}"
done

echo "停止应用写入服务。"
app_switch_started=true
run_compose --profile message --profile message-external --profile order-preapproval stop nginx api-1 api-2 worker "${message_services[@]}" "${order_preapproval_services[@]}"

echo "同步应用编排、Nginx、运维脚本与数据库迁移。"
cp "${package_root}/files/compose/docker-compose.yml" "${install_root}/compose/docker-compose.yml"
cp "${package_root}/files/config/nginx/default.conf" "${install_root}/config/nginx/default.conf"
cp "${package_root}/files/scripts/"*.sh "${install_root}/scripts/"
chmod 750 "${install_root}/scripts/"*.sh
cp "${package_root}/database/migrations/"*.sql "${install_root}/database/migrations/"

更新变量() {
  local target_file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "${target_file}"; then
    sed -i "s#^${key}=.*#${key}=${value}#" "${target_file}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${target_file}"
  fi
}
更新变量 "${install_root}/compose/.env" V3_IMAGE_TAG "${TARGET_VERSION}"
更新变量 "${install_root}/config/deploy.env" V3_IMAGE_TAG "${TARGET_VERSION}"
更新变量 "${install_root}/config/v3.env" V3_BUILD_VERSION "${TARGET_VERSION}"
更新变量 "${install_root}/config/v3.env" V3_BUILD_COMMIT "${BUILD_COMMIT}"
更新变量 "${install_root}/config/v3.env" V3_BUILD_TIME "${BUILD_TIME}"
if ! grep -q '^V3_ORGANIZATION_CHANNEL_PHONE_EDIT_ENABLED=' "${install_root}/config/v3.env"; then
  更新变量 "${install_root}/config/v3.env" V3_ORGANIZATION_CHANNEL_PHONE_EDIT_ENABLED false
fi
if ! grep -q '^MESSAGE_CHANNEL_CONFIG_ENCRYPTION_KEY=' "${install_root}/config/v3.env"; then
  command -v openssl >/dev/null 2>&1 || { echo "缺少 openssl，无法生成消息渠道配置加密密钥。" >&2; exit 1; }
  更新变量 "${install_root}/config/v3.env" MESSAGE_CHANNEL_CONFIG_ENCRYPTION_KEY "$(openssl rand -base64 32 | tr -d '\n')"
  echo "已生成并保存消息渠道配置加密密钥。"
fi
chmod 600 "${install_root}/config/v3.env"

run_compose config >/dev/null
echo "执行向前兼容数据库迁移。"
env -u V3_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME INSTALL_ROOT="${install_root}" bash "${install_root}/scripts/migrate-db.sh"

echo "启动升级后的应用服务。"
env -u V3_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME INSTALL_ROOT="${install_root}" bash "${install_root}/scripts/start.sh"
run_compose --profile message --profile message-external --profile order-preapproval up -d --force-recreate api-1 api-2 worker nginx "${message_services[@]}" "${order_preapproval_services[@]}"
bash "${script_dir}/verify.sh" "${install_root}"
trap - ERR

echo "SP-APP 升级完成。"
echo "升级日志：${log_file}"
echo "应用快照：${release_dir}"
echo "数据库备份：${backup_dir}/postgres.sql"
