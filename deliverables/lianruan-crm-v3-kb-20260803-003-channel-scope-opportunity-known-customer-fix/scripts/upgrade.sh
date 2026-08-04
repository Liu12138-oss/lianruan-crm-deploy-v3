#!/usr/bin/env bash
set -euo pipefail

install_root="${1:-${INSTALL_ROOT:-/opt/lianruan-crm-v3}}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "${script_dir}/.." && pwd)"
meta_file="${package_root}/manifest/KB元数据.env"

if [ -f "${meta_file}" ]; then
  set -a
  . "${meta_file}"
  set +a
fi

kb_id="${KB_ID:-KB-20260803-003}"
version_tag="${TARGET_VERSION:-3.0.0-stage9.25.20260803-kb003}"
build_commit="${BUILD_COMMIT:-kb-20260803-003-channel-scope-opportunity-known-customer-fix}"
build_time="${BUILD_TIME:-$(date -u '+%Y-%m-%dT%H:%M:%SZ')}"
time_code="$(date '+%Y%m%d-%H%M%S')"
log_dir="${install_root}/logs/install"
log_file="${log_dir}/${kb_id}-${time_code}.log"
release_dir="${install_root}/releases/${version_tag}-pre-${time_code}"
backup_dir="${install_root}/backups/local/${time_code}-${kb_id}-preupgrade"

mkdir -p "${log_dir}"
exec > >(tee -a "${log_file}") 2>&1

fail_note() {
  local exit_code="$1"
  echo "KB 升级失败，退出码：${exit_code}"
  echo "升级日志：${log_file}"
  echo "如需回退应用配置，可执行：bash ${script_dir}/rollback.sh ${install_root} ${release_dir}"
}
trap 'fail_note $?' ERR

read_env_value() {
  local file_path="$1"
  local key_name="$2"
  [ -f "${file_path}" ] || return 0
  while IFS= read -r line || [ -n "${line}" ]; do
    case "${line}" in
      "${key_name}="*) printf '%s\n' "${line#*=}"; return 0 ;;
    esac
  done < "${file_path}"
}

write_env_value() {
  local file_path="$1"
  local key_name="$2"
  local value_text="$3"
  local tmp_file="${file_path}.tmp"
  local found="0"
  local file_mode=""
  local owner_group=""
  mkdir -p "${file_path%/*}"
  if [ -f "${file_path}" ]; then
    file_mode="$(stat -c '%a' "${file_path}" 2>/dev/null || true)"
    owner_group="$(stat -c '%u:%g' "${file_path}" 2>/dev/null || true)"
  fi
  : > "${tmp_file}"
  if [ -f "${file_path}" ]; then
    while IFS= read -r line || [ -n "${line}" ]; do
      case "${line}" in
        "${key_name}="*)
          printf '%s=%s\n' "${key_name}" "${value_text}" >> "${tmp_file}"
          found="1"
          ;;
        *)
          printf '%s\n' "${line}" >> "${tmp_file}"
          ;;
      esac
    done < "${file_path}"
  fi
  if [ "${found}" = "0" ]; then
    printf '%s=%s\n' "${key_name}" "${value_text}" >> "${tmp_file}"
  fi
  mv "${tmp_file}" "${file_path}"
  [ -n "${file_mode}" ] && chmod "${file_mode}" "${file_path}"
  [ -n "${owner_group}" ] && chown "${owner_group}" "${file_path}"
}

check_container_image() {
  local container_name="$1"
  local expected_image="$2"
  local seen_image
  seen_image="$(docker inspect -f '{{.Config.Image}}' "${container_name}")" || {
    echo "无法读取容器镜像：${container_name}" >&2
    exit 1
  }
  if [ "${seen_image}" != "${expected_image}" ]; then
    echo "容器镜像未切换：${container_name} 当前为 ${seen_image}，预期为 ${expected_image}。" >&2
    exit 1
  fi
}

check_health_version() {
  local body
  body="$(curl -fsS http://127.0.0.1/health/live)" || {
    echo "存活检查不可访问。" >&2
    exit 1
  }
  case "${body}" in
    *"\"版本\":\"${version_tag}\""*) ;;
    *)
      echo "健康检查构建版本未更新，预期 ${version_tag}。" >&2
      echo "${body}" >&2
      exit 1
      ;;
  esac
}

check_known_customers() {
  local count_text
  count_text="$(
    docker compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -Atc \
      "SELECT count(*) FROM crm.customers WHERE extra_json->>'knownCustomerSource' = 'customser_back.sql';"
  )"
  count_text="$(printf '%s' "${count_text}" | tr -d '[:space:]')"
  if [ "${count_text:-0}" -lt 29000 ]; then
    echo "既往客户导入数量异常，当前为 ${count_text:-0}。" >&2
    exit 1
  fi
  echo "既往客户导入数量核验通过：${count_text}"
}

zip_dir_backup() {
  local source_dir="$1"
  local output_file="$2"
  local parent_dir
  local source_name
  parent_dir="$(dirname "${source_dir}")"
  source_name="$(basename "${source_dir}")"
  if [ ! -d "${source_dir}" ]; then
    mkdir -p "${source_dir}"
  fi
  (cd "${parent_dir}" && zip -qr -X "${output_file}" "${source_name}")
}

create_preupgrade_backup() {
  echo "执行升级前 ZIP 备份：${backup_dir}"
  mkdir -p "${backup_dir}/config/nginx"

  cd "${install_root}/compose"
  docker compose exec -T postgres pg_dump -U lianruan_app -d lianruan_crm_v3 > "${backup_dir}/postgres.sql"

  zip_dir_backup "${install_root}/data/uploads" "${backup_dir}/uploads.zip"
  zip_dir_backup "${install_root}/data/exports" "${backup_dir}/exports.zip"

  [ -f "${install_root}/config/v3.env" ] && cp "${install_root}/config/v3.env" "${backup_dir}/config/v3.env"
  [ -f "${install_root}/config/deploy.env" ] && cp "${install_root}/config/deploy.env" "${backup_dir}/config/deploy.env"
  [ -f "${install_root}/compose/.env" ] && cp "${install_root}/compose/.env" "${backup_dir}/config/compose.env"
  [ -f "${install_root}/config/nginx/default.conf" ] && cp "${install_root}/config/nginx/default.conf" "${backup_dir}/config/nginx/default.conf"

  {
    echo "备份时间=${time_code}"
    echo "备份类型=${kb_id}-preupgrade"
    echo "安装目录=${install_root}"
    echo "目标版本=${version_tag}"
  } > "${backup_dir}/备份说明.txt"

  (cd "${backup_dir}" && sha256sum postgres.sql uploads.zip exports.zip 备份说明.txt > sha256sum.txt)
  echo "升级前备份完成：${backup_dir}"
}

echo "开始执行 ${kb_id}，目标版本：${version_tag}"
bash "${script_dir}/precheck.sh" "${install_root}"

previous_version="$(read_env_value "${install_root}/compose/.env" "V3_IMAGE_TAG" || true)"
if [ -z "${previous_version}" ]; then
  previous_version="$(read_env_value "${install_root}/config/deploy.env" "V3_IMAGE_TAG" || true)"
fi
if [ -z "${previous_version}" ]; then
  previous_version="3.0.0-stage9.20260727"
fi

create_preupgrade_backup

echo "保存当前应用配置快照：${release_dir}"
mkdir -p "${release_dir}/compose" "${release_dir}/config/nginx" "${release_dir}/scripts"
cp "${install_root}/compose/docker-compose.yml" "${release_dir}/compose/docker-compose.yml"
[ -f "${install_root}/compose/.env" ] && cp "${install_root}/compose/.env" "${release_dir}/compose/.env"
cp "${install_root}/config/v3.env" "${release_dir}/config/v3.env"
[ -f "${install_root}/config/deploy.env" ] && cp "${install_root}/config/deploy.env" "${release_dir}/config/deploy.env"
[ -f "${install_root}/config/nginx/default.conf" ] && cp "${install_root}/config/nginx/default.conf" "${release_dir}/config/nginx/default.conf"
cp "${install_root}/scripts/"*.sh "${release_dir}/scripts/" 2>/dev/null || true
printf 'PREVIOUS_VERSION=%s\nNEW_VERSION=%s\n' "${previous_version}" "${version_tag}" > "${release_dir}/版本.env"

cd "${install_root}/compose"
export INSTALL_ROOT="${install_root}"
export V3_IMAGE_TAG="${version_tag}"

echo "停止受影响服务。"
docker compose stop nginx api-1 api-2 worker || true

echo "加载 KB 镜像。"
docker load -i "${package_root}/images/lianruan-crm-v3-api-${version_tag}.docker-image"
docker load -i "${package_root}/images/lianruan-crm-v3-nginx-${version_tag}.docker-image"
docker load -i "${package_root}/images/lianruan-crm-v3-worker-${version_tag}.docker-image"

echo "同步配置和数据库迁移。"
mkdir -p "${install_root}/config/nginx" "${install_root}/database/migrations"
cp "${package_root}/files/config/nginx/default.conf" "${install_root}/config/nginx/default.conf"
cp "${package_root}/database/migrations/20260803_S9_015_KB_003_导入既往客户.sql" "${install_root}/database/migrations/"
chmod 644 "${install_root}/config/nginx/default.conf"

echo "同步版本变量。"
write_env_value "${install_root}/compose/.env" "V3_IMAGE_TAG" "${version_tag}"
[ -f "${install_root}/config/deploy.env" ] && write_env_value "${install_root}/config/deploy.env" "V3_IMAGE_TAG" "${version_tag}"
write_env_value "${install_root}/config/v3.env" "V3_BUILD_VERSION" "${version_tag}"
write_env_value "${install_root}/config/v3.env" "V3_BUILD_COMMIT" "${build_commit}"
write_env_value "${install_root}/config/v3.env" "V3_BUILD_TIME" "${build_time}"
chmod 600 "${install_root}/config/v3.env"

echo "执行数据库迁移。"
"${install_root}/scripts/migrate-db.sh"

echo "启动受影响服务。"
docker compose up -d --force-recreate --no-deps api-1 api-2 worker
docker compose up -d --force-recreate --no-deps nginx

echo "确认容器镜像已经切换。"
check_container_image "lianruan-crm-v3-api-1" "lianruan-crm-v3-api:${version_tag}"
check_container_image "lianruan-crm-v3-api-2" "lianruan-crm-v3-api:${version_tag}"
check_container_image "lianruan-crm-v3-worker" "lianruan-crm-v3-worker:${version_tag}"
check_container_image "lianruan-crm-v3-nginx" "lianruan-crm-v3-nginx:${version_tag}"

echo "执行健康检查。"
"${install_root}/scripts/health-check.sh"
curl -fsS http://127.0.0.1/health/live >/dev/null
curl -fsS http://127.0.0.1/health/ready >/dev/null
check_health_version
check_known_customers

echo "执行业务自检。"
bash "${package_root}/tests/smoke.sh" "http://127.0.0.1"

echo "KB 升级完成。日志：${log_file}"
echo "如需回退应用配置，执行：bash ${script_dir}/rollback.sh ${install_root} ${release_dir}"
