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
backup_dir="${install_root}/backups/local/${timestamp}-${PACKAGE_ID}-preupgrade"
app_switch_started=false
safety_switches_disabled=false
safety_switch_state_file=""
safety_switches=(
  V3_ORGANIZATION_ENABLED
  V3_ORGANIZATION_WRITE_ENABLED
  V3_ORGANIZATION_CHANNEL_PHONE_EDIT_ENABLED
  V3_DIRECTORY_SYNC_ENABLED
  V3_ORGANIZATION_ACCOUNT_ENTRY_MERGED
  V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED
  V3_ORGANIZATION_OFFBOARDING_ENABLED
)

mkdir -p "${log_dir}"
exec > >(tee -a "${log_file}") 2>&1

更新变量() {
  local target_file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "${target_file}"; then
    sed -i "s#^${key}=.*#${key}=${value}#" "${target_file}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${target_file}"
  fi
}

恢复发布安全开关到文件() {
  local target_file="$1" temp_file
  [ -n "${safety_switch_state_file}" ] && [ -f "${safety_switch_state_file}" ] || return 0
  temp_file="$(mktemp "${target_file}.sp-full-restore.XXXXXX")" || return 1
  awk -F '\t' '
    NR == FNR { original[$1] = $2; next }
    {
      key = $1
      sub(/=.*/, "", key)
      if (key in original) {
        if (!(key in written) && original[key] != "") {
          print original[key]
          written[key] = 1
        }
        next
      }
      print
    }
    END {
      for (key in original) {
        if (!(key in written) && original[key] != "") print original[key]
      }
    }
  ' "${safety_switch_state_file}" "${target_file}" > "${temp_file}" || {
    rm -f "${temp_file}"
    return 1
  }
  mv "${temp_file}" "${target_file}"
}

临时关闭发布安全开关() {
  local key original_line
  safety_switch_state_file="$(mktemp "${install_root}/config/.sp-full-switches.XXXXXX")"
  chmod 600 "${safety_switch_state_file}"
  for key in "${safety_switches[@]}"; do
    original_line="$(awk -F= -v key="${key}" '$1 == key { line = $0 } END { print line }' "${install_root}/config/v3.env" | tr -d '\r')"
    printf '%s\t%s\n' "${key}" "${original_line}" >> "${safety_switch_state_file}"
    更新变量 "${install_root}/config/v3.env" "${key}" false
  done
  chmod 600 "${install_root}/config/v3.env"
  safety_switches_disabled=true
  echo "已临时关闭 7 项发布安全开关，待升级验证完成后恢复原配置；不会自动重启服务重新启用。"
}

恢复发布安全开关() {
  [ "${safety_switches_disabled}" = true ] || return 0
  恢复发布安全开关到文件 "${install_root}/config/v3.env" || return 1
  chmod 600 "${install_root}/config/v3.env"
  rm -f "${safety_switch_state_file}"
  safety_switch_state_file=""
  safety_switches_disabled=false
  echo "已恢复升级前 7 项发布安全开关配置；当前运行容器仍保持升级验证期间的安全关闭状态，未自动重启重新启用。"
}

回退应用() {
  [ "${app_switch_started}" = true ] || return 0
 [ -n "${release_dir:-}" ] && [ -d "${release_dir}" ] || return 0
  echo "升级失败，开始自动恢复升级前应用文件与镜像；数据库不会自动恢复。"
  bash "${script_dir}/rollback-sp-full.sh" "${install_root}" "${release_dir}" ||
    echo "自动应用回退失败，请根据升级日志和应用快照执行人工回退。" >&2
}

失败处理() {
  local exit_code="$1"
 回退应用
  恢复发布安全开关 ||
    echo "发布安全开关配置恢复失败，请根据 ${backup_dir}/发布安全开关升级前原值.tsv 人工恢复。" >&2
  echo "SP-FULL 升级失败，退出码：${exit_code}" >&2
  echo "升级日志：${log_file}" >&2
  echo "应用快照：${release_dir:-未创建}" >&2
  echo "数据库备份：${backup_dir}/postgres.sql（仅可在负责人确认后人工恢复）" >&2
  exit "${exit_code}"
}
trap '失败处理 $?' ERR

echo "开始 SP-FULL 升级：${PACKAGE_ID}，目标版本：${TARGET_VERSION}。"

if [ -d "${install_root}/compose" ] && [ -f "${install_root}/compose/.env" ] && [ -f "${install_root}/config/v3.env" ]; then
  current_version="$(awk -F= '$1 == "V3_IMAGE_TAG" { value=$2 } END { print value }' "${install_root}/compose/.env" | tr -d '\r')"
  echo "检测到已有安装，当前版本：${current_version:-未知}。"

  if [ "${current_version}" = "${TARGET_VERSION}" ]; then
    bash "${script_dir}/precheck-sp-full.sh" "${install_root}"
    echo "当前已是目标版本，仅同步运维脚本并执行复核，不重复加载镜像、不停机、不重复迁移。"
    cp "${package_root}/files/scripts/"*.sh "${install_root}/scripts/" 2>/dev/null || true
    chmod 750 "${install_root}/scripts/"*.sh 2>/dev/null || true
    bash "${script_dir}/verify-sp-full.sh" "${install_root}"
    trap - ERR
    echo "SP-FULL 复核完成：${TARGET_VERSION}。"
    exit 0
  fi

  临时关闭发布安全开关
  bash "${script_dir}/precheck-sp-full.sh" "${install_root}"
  echo "按升级模式执行。"
  release_dir="${install_root}/releases/${TARGET_VERSION}-pre-${timestamp}"
  mkdir -p "${backup_dir}" "${release_dir}/compose" "${release_dir}/config/nginx" "${release_dir}/scripts" "${release_dir}/runtime"
  cp "${safety_switch_state_file}" "${backup_dir}/发布安全开关升级前原值.tsv"

  run_compose() {
    env -u V3_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME \
      INSTALL_ROOT="${install_root}" \
      docker compose \
      --project-directory "${install_root}/compose" \
      --env-file "${install_root}/compose/.env" \
      -f "${install_root}/compose/docker-compose.yml" \
      "$@"
  }

  echo "创建数据库与业务文件备份。"
  run_compose exec -T postgres pg_dump -U lianruan_app -d lianruan_crm_v3 > "${backup_dir}/postgres.sql"
  for data_name in uploads exports; do
    mkdir -p "${install_root}/data/${data_name}"
    (cd "${install_root}/data" && zip -qr -X "${backup_dir}/${data_name}.zip" "${data_name}")
  done

  echo "保存升级前应用快照：${release_dir}。"
  cp "${install_root}/compose/docker-compose.yml" "${release_dir}/compose/docker-compose.yml"
  cp "${install_root}/compose/.env" "${release_dir}/compose/.env"
  cp "${install_root}/config/v3.env" "${release_dir}/config/v3.env"
  恢复发布安全开关到文件 "${release_dir}/config/v3.env"
  cp "${install_root}/config/deploy.env" "${release_dir}/config/deploy.env"
  cp "${install_root}/config/nginx/default.conf" "${release_dir}/config/nginx/default.conf"
  cp "${install_root}/scripts/"*.sh "${release_dir}/scripts/" 2>/dev/null || true
  printf 'services:\n' > "${release_dir}/runtime/rollback-images.yml"
  for service_name in api-1 api-2 worker nginx worker-message-critical worker-message-maintenance worker-message-integration; do
    container_id="$(run_compose --profile message --profile message-external ps -q "${service_name}" 2>/dev/null || true)"
    if [ -n "${container_id}" ]; then
      running_image="$(docker inspect -f '{{.Config.Image}}' "${container_id}" 2>/dev/null || true)"
      running_image_id="$(docker inspect -f '{{.Image}}' "${container_id}" 2>/dev/null || true)"
      if [ -n "${running_image}" ]; then
        printf '%s|%s|%s|%s\n' "${service_name}" "${running_image}" "${running_image_id}" "$(docker inspect -f '{{.State.Status}}' "${container_id}" 2>/dev/null || true)" >> "${release_dir}/runtime/service-images.tsv"
        printf '  %s:\n    image: %s\n' "${service_name}" "${running_image}" >> "${release_dir}/runtime/rollback-images.yml"
      fi
    fi
  done

  echo "预加载离线业务与基础镜像。"
  for image_file in "${package_root}"/images/*.docker-image; do
    docker load -i "${image_file}"
  done

  echo "停止应用写入服务。"
  app_switch_started=true
  run_compose --profile message --profile message-external stop nginx api-1 api-2 worker worker-message-critical worker-message-maintenance worker-message-integration || true

  echo "同步 Compose、Nginx、运维脚本与数据库迁移。"
  cp "${package_root}/compose/docker-compose.yml" "${install_root}/compose/docker-compose.yml"
  cp "${package_root}/config/nginx/default.conf" "${install_root}/config/nginx/default.conf"
  cp "${package_root}/files/scripts/"*.sh "${install_root}/scripts/" 2>/dev/null || true
  chmod 750 "${install_root}/scripts/"*.sh 2>/dev/null || true
  cp "${package_root}/database/migrations/"*.sql "${install_root}/database/migrations/"

  更新变量 "${install_root}/compose/.env" V3_IMAGE_TAG "${TARGET_VERSION}"
  更新变量 "${install_root}/config/deploy.env" V3_IMAGE_TAG "${TARGET_VERSION}"
  更新变量 "${install_root}/config/v3.env" V3_BUILD_VERSION "${TARGET_VERSION}"
  更新变量 "${install_root}/config/v3.env" V3_BUILD_COMMIT "${BUILD_COMMIT}"
  更新变量 "${install_root}/config/v3.env" V3_BUILD_TIME "${BUILD_TIME}"
  if ! grep -q '^V3_ORGANIZATION_CHANNEL_PHONE_EDIT_ENABLED=' "${install_root}/config/v3.env"; then
    更新变量 "${install_root}/config/v3.env" V3_ORGANIZATION_CHANNEL_PHONE_EDIT_ENABLED false
  fi
  chmod 600 "${install_root}/config/v3.env"

  run_compose config >/dev/null
  echo "执行向前兼容数据库迁移（已执行的迁移自动跳过）。"
  env -u V3_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME INSTALL_ROOT="${install_root}" bash "${install_root}/scripts/migrate-db.sh"

  echo "启动升级后的应用服务。"
  env -u V3_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME INSTALL_ROOT="${install_root}" bash "${install_root}/scripts/start.sh"
  bash "${script_dir}/verify-sp-full.sh" "${install_root}"
  恢复发布安全开关
else
  echo "未检测到已有安装，按全新安装模式执行。"
  bash "${script_dir}/precheck-sp-full.sh" "${install_root}"
  env -u V3_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME INSTALL_ROOT="${install_root}" bash "${package_root}/scripts/install-all.sh"
  env -u V3_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME INSTALL_ROOT="${install_root}" bash "${install_root}/scripts/migrate-db.sh"
  env -u V3_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME INSTALL_ROOT="${install_root}" bash "${install_root}/scripts/health-check.sh"
  bash "${script_dir}/verify-sp-full.sh" "${install_root}"
fi

trap - ERR
echo "SP-FULL 升级完成。"
echo "升级日志：${log_file}"
echo "应用快照：${release_dir:-全新安装无快照}"
echo "数据库备份：${backup_dir}/postgres.sql（全新安装无备份）"
