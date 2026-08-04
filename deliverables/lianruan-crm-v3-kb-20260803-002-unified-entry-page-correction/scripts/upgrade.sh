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

kb_id="${KB_ID:-KB-20260803-002}"
target_version="${TARGET_VERSION:-3.0.0-stage9.24.20260803-kb002}"
build_commit="${BUILD_COMMIT:-kb-20260803-002-unified-entry-page-correction}"
build_time="${BUILD_TIME:-$(date -u '+%Y-%m-%dT%H:%M:%SZ')}"
timestamp="$(date '+%Y%m%d-%H%M%S')"
log_dir="${install_root}/logs/install"
log_file="${log_dir}/${kb_id}-${timestamp}.log"
release_dir="${install_root}/releases/${target_version}-pre-${timestamp}"
backup_dir="${install_root}/backups/local/${timestamp}-${kb_id}-preupgrade"

mkdir -p "${log_dir}"
exec > >(tee -a "${log_file}") 2>&1

handle_failure() {
  local exit_code="$1"
  echo "KB 升级失败，退出码：${exit_code}"
  echo "升级日志：${log_file}"
  echo "如需回退应用配置，可执行：bash ${script_dir}/rollback.sh ${install_root} ${release_dir}"
}
trap 'handle_failure $?' ERR

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

write_env_value_if_missing() {
  local file_path="$1"
  local key_name="$2"
  local value_text="$3"
  if [ -f "${file_path}" ] && grep -q "^${key_name}=" "${file_path}"; then
    echo "保留现场已有配置：${key_name}"
    return
  fi
  write_env_value "${file_path}" "${key_name}" "${value_text}"
  echo "补齐配置：${key_name}"
}

check_container_image() {
  local container_name="$1"
  local expected_image="$2"
  local actual_image
  actual_image="$(docker inspect -f '{{.Config.Image}}' "${container_name}")" || {
    echo "无法读取容器镜像：${container_name}" >&2
    exit 1
  }
  if [ "${actual_image}" != "${expected_image}" ]; then
    echo "容器镜像未切换：${container_name} 当前为 ${actual_image}，预期为 ${expected_image}。" >&2
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
    *"\"版本\":\"${target_version}\""*) ;;
    *)
      echo "健康检查构建版本未更新，预期 ${target_version}。" >&2
      echo "${body}" >&2
      exit 1
      ;;
  esac
}

check_spa_entry() {
  local request_path="$1"
  local http_status
  local body
  http_status="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1${request_path}")" || {
    echo "入口不可访问：${request_path}" >&2
    exit 1
  }
  if [ "${http_status}" != "200" ]; then
    echo "入口状态异常：${request_path} 返回 ${http_status}，预期 200。" >&2
    exit 1
  fi
  body="$(curl -fsS "http://127.0.0.1${request_path}")" || {
    echo "入口内容不可读取：${request_path}" >&2
    exit 1
  }
  case "${body}" in
    *'<div id="app"'*|*"assets/index-"*) ;;
    *)
      echo "入口未返回 V3 工程化页面：${request_path}" >&2
      exit 1
      ;;
  esac
}

check_redirect_entry() {
  local request_path="$1"
  local expected_location="$2"
  local response_headers
  local redirect_location
  local normalized_location
  response_headers="$(curl -sS -D - -o /dev/null "http://127.0.0.1${request_path}")" || {
    echo "入口不可访问：${request_path}" >&2
    exit 1
  }
  printf '%s' "${response_headers}" | grep -Eq '^HTTP/[0-9.]+ 302' || {
    echo "入口未返回 302 跳转：${request_path}" >&2
    exit 1
  }
  redirect_location="$(printf '%s' "${response_headers}" | awk 'tolower($0) ~ /^location:/ { sub(/^[^:]*:[[:space:]]*/, ""); sub(/\r$/, ""); print; exit }')"
  if [ -z "${redirect_location}" ]; then
    echo "入口跳转未返回 Location 响应头：${request_path}" >&2
    exit 1
  fi
  normalized_location="${redirect_location}"
  case "${normalized_location}" in
    http://*|https://*)
      normalized_location="${normalized_location#*://}"
      case "${normalized_location}" in
        */*) normalized_location="/${normalized_location#*/}" ;;
        *) normalized_location="/" ;;
      esac
      ;;
  esac
  if [ "${normalized_location}" != "${expected_location}" ]; then
    echo "入口跳转目标错误：${request_path}，实际 ${redirect_location}，预期 ${expected_location}。" >&2
    exit 1
  fi
}

check_business_entry() {
  local request_path="$1"
  local content_marker="$2"
  local body
  body="$(curl -fsS "http://127.0.0.1${request_path}")" || {
    echo "业务页面不可访问：${request_path}" >&2
    exit 1
  }
  case "${body}" in
    *"${content_marker}"*) ;;
    *)
      echo "业务页面内容错误：${request_path} 未包含 ${content_marker}。" >&2
      exit 1
      ;;
  esac
}

check_iam_config() {
  local body
  body="$(curl -fsS http://127.0.0.1/api/auth/sso/iam/config)" || {
    echo "IAM 单点登录配置接口不可访问。" >&2
    exit 1
  }
  case "${body}" in
    *'"success":true'*) ;;
    *) echo "IAM 单点登录配置接口返回异常：${body}" >&2; exit 1 ;;
  esac
  case "${body}" in
    *"QdCRMguanlyuan123"*) ;;
    *) echo "管理员单点登录请求标识未返回。" >&2; exit 1 ;;
  esac
  case "${body}" in
    *"QdCRMkeduduan123"*) ;;
    *) echo "渠道端单点登录请求标识未返回。" >&2; exit 1 ;;
  esac
}

zip_directory_backup() {
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

  zip_directory_backup "${install_root}/data/uploads" "${backup_dir}/uploads.zip"
  zip_directory_backup "${install_root}/data/exports" "${backup_dir}/exports.zip"

  [ -f "${install_root}/config/v3.env" ] && cp "${install_root}/config/v3.env" "${backup_dir}/config/v3.env"
  [ -f "${install_root}/config/deploy.env" ] && cp "${install_root}/config/deploy.env" "${backup_dir}/config/deploy.env"
  [ -f "${install_root}/compose/.env" ] && cp "${install_root}/compose/.env" "${backup_dir}/config/compose.env"
  [ -f "${install_root}/config/nginx/default.conf" ] && cp "${install_root}/config/nginx/default.conf" "${backup_dir}/config/nginx/default.conf"

  {
    echo "备份时间=${timestamp}"
    echo "备份类型=${kb_id}-preupgrade"
    echo "安装目录=${install_root}"
    echo "目标版本=${target_version}"
  } > "${backup_dir}/备份说明.txt"

  (cd "${backup_dir}" && sha256sum postgres.sql uploads.zip exports.zip 备份说明.txt > sha256sum.txt)
  echo "升级前备份完成：${backup_dir}"
}

tag_unchanged_worker_image() {
  local worker_image
  worker_image="$(docker inspect -f '{{.Config.Image}}' lianruan-crm-v3-worker 2>/dev/null || true)"
  if [ -z "${worker_image}" ]; then
    echo "未检测到 worker 容器，跳过 worker 镜像别名。"
    return
  fi
  if docker image inspect "${worker_image}" >/dev/null 2>&1; then
    docker tag "${worker_image}" "lianruan-crm-v3-worker:${target_version}"
    echo "已为现有 worker 镜像增加目标版本别名，不重启 worker。"
  else
    echo "未找到当前 worker 镜像，跳过 worker 镜像别名。"
  fi
}

echo "开始执行 ${kb_id}，目标版本：${target_version}"
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
printf 'PREVIOUS_VERSION=%s\nTARGET_VERSION=%s\n' "${previous_version}" "${target_version}" > "${release_dir}/版本.env"

echo "加载 KB 镜像。"
docker load -i "${package_root}/images/lianruan-crm-v3-api-${target_version}.docker-image"
docker load -i "${package_root}/images/lianruan-crm-v3-nginx-${target_version}.docker-image"
tag_unchanged_worker_image

echo "同步配置文件。"
mkdir -p "${install_root}/config/nginx"
cp "${package_root}/files/config/nginx/default.conf" "${install_root}/config/nginx/default.conf"
chmod 644 "${install_root}/config/nginx/default.conf"

echo "同步版本变量。"
write_env_value "${install_root}/compose/.env" "V3_IMAGE_TAG" "${target_version}"
[ -f "${install_root}/config/deploy.env" ] && write_env_value "${install_root}/config/deploy.env" "V3_IMAGE_TAG" "${target_version}"
write_env_value "${install_root}/config/v3.env" "V3_BUILD_VERSION" "${target_version}"
write_env_value "${install_root}/config/v3.env" "V3_BUILD_COMMIT" "${build_commit}"
write_env_value "${install_root}/config/v3.env" "V3_BUILD_TIME" "${build_time}"

echo "补齐 IAM H5 单点登录配置。"
write_env_value_if_missing "${install_root}/config/v3.env" "V3_IAM_H5_SSO_ENABLED" "true"
write_env_value_if_missing "${install_root}/config/v3.env" "V3_IAM_H5_SSO_VALIDATE_URL" "http://10.10.2.62:8192/emm-cgi/oidc/getUserFromSsoToken"
write_env_value_if_missing "${install_root}/config/v3.env" "V3_IAM_H5_SSO_VALIDATE_ISAID" "QudaoCrm123"
write_env_value_if_missing "${install_root}/config/v3.env" "V3_IAM_H5_SSO_ADMIN_VALIDATE_ISAID" ""
write_env_value_if_missing "${install_root}/config/v3.env" "V3_IAM_H5_SSO_PARTNER_VALIDATE_ISAID" ""
write_env_value_if_missing "${install_root}/config/v3.env" "V3_IAM_H5_SSO_ADMIN_REQUEST_ISAID" "QdCRMguanlyuan123"
write_env_value_if_missing "${install_root}/config/v3.env" "V3_IAM_H5_SSO_PARTNER_REQUEST_ISAID" "QdCRMkeduduan123"
write_env_value_if_missing "${install_root}/config/v3.env" "V3_IAM_H5_SSO_TIMEOUT_MS" "8000"
chmod 600 "${install_root}/config/v3.env"

cd "${install_root}/compose"
export INSTALL_ROOT="${install_root}"
export V3_IMAGE_TAG="${target_version}"

echo "确认 Compose 解析到目标镜像。"
docker compose config | grep -q "lianruan-crm-v3-api:${target_version}" || {
  echo "Compose 未解析到目标 API 镜像，请检查 V3_IMAGE_TAG。" >&2
  docker compose config | grep 'image:' >&2 || true
  exit 1
}
docker compose config | grep -q "lianruan-crm-v3-nginx:${target_version}" || {
  echo "Compose 未解析到目标 Nginx 镜像，请检查 V3_IMAGE_TAG。" >&2
  docker compose config | grep 'image:' >&2 || true
  exit 1
}

echo "停止受影响服务。"
docker compose stop nginx api-1 api-2 || true

echo "强制重建受影响服务。"
docker compose up -d --force-recreate --no-deps api-1 api-2
docker compose up -d --force-recreate --no-deps nginx

echo "确认容器镜像已经切换。"
check_container_image "lianruan-crm-v3-api-1" "lianruan-crm-v3-api:${target_version}"
check_container_image "lianruan-crm-v3-api-2" "lianruan-crm-v3-api:${target_version}"
check_container_image "lianruan-crm-v3-nginx" "lianruan-crm-v3-nginx:${target_version}"

echo "执行健康检查。"
"${install_root}/scripts/health-check.sh"
curl -fsS http://127.0.0.1/health/live >/dev/null
curl -fsS http://127.0.0.1/health/ready >/dev/null
check_health_version

echo "执行业务自检。"
bash "${package_root}/tests/smoke.sh" "http://127.0.0.1"
check_spa_entry "/"
check_spa_entry "/login"
check_redirect_entry "/admin" "/admin.html"
check_redirect_entry "/partner" "/partner.html"
check_business_entry "/admin.html" "admin-app.js"
check_business_entry "/admin-mobile.html" "mobile.html"
check_business_entry "/partner.html" "partner-app.js"
check_business_entry "/partner-mobile.html" "mobile.html"
check_iam_config

echo "KB 升级完成。日志：${log_file}"
echo "如需回退，执行：bash ${script_dir}/rollback.sh ${install_root} ${release_dir}"
