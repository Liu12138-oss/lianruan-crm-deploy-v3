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

kb_id="${KB_ID:-KB-20260731-005}"
target_version="${TARGET_VERSION:-3.0.0-stage9.22.20260731-kb005}"
build_commit="${BUILD_COMMIT:-${kb_id}}"
build_time="${BUILD_TIME:-$(date -u '+%Y-%m-%dT%H:%M:%SZ')}"
timestamp="$(date '+%Y%m%d-%H%M%S')"
log_dir="${install_root}/logs/install"
log_file="${log_dir}/${kb_id}-${timestamp}.log"
release_dir="${install_root}/releases/${target_version}-pre-${timestamp}"
backup_dir="${install_root}/backups/local/${timestamp}-${kb_id}-preupgrade"

mkdir -p "${log_dir}"
exec > >(tee -a "${log_file}") 2>&1

失败处理() {
  local exit_code="$1"
  echo "KB 升级失败，退出码：${exit_code}"
  echo "升级日志：${log_file}"
  echo "如需回退应用配置，可执行：bash ${script_dir}/rollback.sh ${install_root} ${release_dir}"
}
trap '失败处理 $?' ERR

读取变量() {
  local file="$1"
  local key="$2"
  [ -f "${file}" ] || return 0
  while IFS= read -r line || [ -n "${line}" ]; do
    case "${line}" in
      "${key}="*) printf '%s\n' "${line#*=}"; return 0 ;;
    esac
  done < "${file}"
}

写入变量() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp="${file}.tmp"
  local found="0"
  local mode=""
  local owner_group=""
  mkdir -p "${file%/*}"
  if [ -f "${file}" ]; then
    mode="$(stat -c '%a' "${file}" 2>/dev/null || true)"
    owner_group="$(stat -c '%u:%g' "${file}" 2>/dev/null || true)"
  fi
  : > "${tmp}"
  if [ -f "${file}" ]; then
    while IFS= read -r line || [ -n "${line}" ]; do
      case "${line}" in
        "${key}="*)
          printf '%s=%s\n' "${key}" "${value}" >> "${tmp}"
          found="1"
          ;;
        *)
          printf '%s\n' "${line}" >> "${tmp}"
          ;;
      esac
    done < "${file}"
  fi
  if [ "${found}" = "0" ]; then
    printf '%s=%s\n' "${key}" "${value}" >> "${tmp}"
  fi
  mv "${tmp}" "${file}"
  [ -n "${mode}" ] && chmod "${mode}" "${file}"
  [ -n "${owner_group}" ] && chown "${owner_group}" "${file}"
}

检查容器镜像() {
  local container="$1"
  local expected="$2"
  local actual
  actual="$(docker inspect -f '{{.Config.Image}}' "${container}")" || {
    echo "无法读取容器镜像：${container}" >&2
    exit 1
  }
  if [ "${actual}" != "${expected}" ]; then
    echo "容器镜像未切换：${container} 当前为 ${actual}，预期为 ${expected}。" >&2
    exit 1
  fi
}

检查健康版本() {
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

检查前端资源() {
  local body
  body="$(curl -fsS http://127.0.0.1/admin-app.js)" || {
    echo "前端资源不可访问：admin-app.js。" >&2
    exit 1
  }
  case "${body}" in
    *"removePartnerStaffFromList"*) ;;
    *)
      echo "前端资源未包含渠道商员工删除同步修复。" >&2
      exit 1
      ;;
  esac
  case "${body}" in
    *"accountRole === 'partner_admin'"*) ;;
    *)
      echo "前端资源未包含企业管理员账号角色修复。" >&2
      exit 1
      ;;
  esac
  case "${body}" in
    *"accountRole: 'partner_admin'"*) ;;
    *)
      echo "前端资源未包含创建企业管理员入参修复。" >&2
      exit 1
      ;;
  esac
}

检查渠道员工字段() {
  local body
  body="$(curl -fsS "http://127.0.0.1/api/v2/partners?pageSize=1")" || {
    echo "渠道商接口不可访问。" >&2
    exit 1
  }
  case "${body}" in
    *'"success":true'*) ;;
    *)
      echo "渠道商接口返回异常。" >&2
      echo "${body}" >&2
      exit 1
      ;;
  esac
  case "${body}" in
    *'"data":[]'*)
      echo "当前无渠道商数据，跳过 staff 字段抽样。"
      return
      ;;
  esac
  case "${body}" in
    *'"staff":'*) ;;
    *)
      echo "渠道商接口未返回 staff 字段，疑似仍在运行旧 API。" >&2
      echo "${body}" >&2
      exit 1
      ;;
  esac
}

备份目录为zip() {
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

生成升级前备份() {
  echo "执行升级前 ZIP 备份：${backup_dir}"
  mkdir -p "${backup_dir}"

  cd "${install_root}/compose"
  docker compose exec -T postgres pg_dump -U lianruan_app -d lianruan_crm_v3 > "${backup_dir}/postgres.sql"

  备份目录为zip "${install_root}/data/uploads" "${backup_dir}/uploads.zip"
  备份目录为zip "${install_root}/data/exports" "${backup_dir}/exports.zip"

  {
    echo "备份时间=${timestamp}"
    echo "备份类型=${kb_id}-preupgrade"
    echo "安装目录=${install_root}"
    echo "目标版本=${target_version}"
    [ -f "${install_root}/config/v3.env" ] && sed -E 's#(PASSWORD|SECRET|KEY|TOKEN)=.*#\1=已隐藏#g' "${install_root}/config/v3.env"
    [ -f "${install_root}/config/deploy.env" ] && cat "${install_root}/config/deploy.env"
    [ -f "${install_root}/compose/.env" ] && cat "${install_root}/compose/.env"
  } > "${backup_dir}/config-summary.txt"

  (cd "${backup_dir}" && sha256sum * > sha256sum.txt)
  echo "升级前备份完成：${backup_dir}"
}

echo "开始执行 ${kb_id}，目标版本：${target_version}"
bash "${script_dir}/precheck.sh" "${install_root}"

previous_version="$(读取变量 "${install_root}/compose/.env" "V3_IMAGE_TAG" || true)"
if [ -z "${previous_version}" ]; then
  previous_version="$(读取变量 "${install_root}/config/deploy.env" "V3_IMAGE_TAG" || true)"
fi
if [ -z "${previous_version}" ]; then
  previous_version="3.0.0-stage9.20260727"
fi

生成升级前备份

echo "保存当前应用配置快照：${release_dir}"
mkdir -p "${release_dir}/compose" "${release_dir}/config" "${release_dir}/scripts"
cp "${install_root}/compose/docker-compose.yml" "${release_dir}/compose/docker-compose.yml"
[ -f "${install_root}/compose/.env" ] && cp "${install_root}/compose/.env" "${release_dir}/compose/.env"
cp "${install_root}/config/v3.env" "${release_dir}/config/v3.env"
[ -f "${install_root}/config/deploy.env" ] && cp "${install_root}/config/deploy.env" "${release_dir}/config/deploy.env"
[ -f "${install_root}/config/nginx/default.conf" ] && mkdir -p "${release_dir}/config/nginx" && cp "${install_root}/config/nginx/default.conf" "${release_dir}/config/nginx/default.conf"
cp "${install_root}/scripts/"*.sh "${release_dir}/scripts/" 2>/dev/null || true
printf 'PREVIOUS_VERSION=%s\nTARGET_VERSION=%s\n' "${previous_version}" "${target_version}" > "${release_dir}/版本.env"

echo "加载 KB 镜像。"
docker load -i "${package_root}/images/lianruan-crm-v3-api-${target_version}.docker-image"
docker load -i "${package_root}/images/lianruan-crm-v3-nginx-${target_version}.docker-image"

echo "同步镜像版本变量。"
写入变量 "${install_root}/compose/.env" "V3_IMAGE_TAG" "${target_version}"
[ -f "${install_root}/config/deploy.env" ] && 写入变量 "${install_root}/config/deploy.env" "V3_IMAGE_TAG" "${target_version}"
写入变量 "${install_root}/config/v3.env" "V3_BUILD_VERSION" "${target_version}"
写入变量 "${install_root}/config/v3.env" "V3_BUILD_COMMIT" "${build_commit}"
写入变量 "${install_root}/config/v3.env" "V3_BUILD_TIME" "${build_time}"
chmod 600 "${install_root}/config/v3.env"

cd "${install_root}/compose"
export INSTALL_ROOT="${install_root}"
export V3_IMAGE_TAG="${target_version}"

echo "确认 Compose 解析到目标镜像。"
docker compose config | grep -q "lianruan-crm-v3-api:${target_version}" || {
  echo "Compose 未解析到目标 API 镜像，请检查外部环境变量 V3_IMAGE_TAG。" >&2
  docker compose config | grep 'image:' >&2 || true
  exit 1
}
docker compose config | grep -q "lianruan-crm-v3-nginx:${target_version}" || {
  echo "Compose 未解析到目标 Nginx 镜像，请检查外部环境变量 V3_IMAGE_TAG。" >&2
  docker compose config | grep 'image:' >&2 || true
  exit 1
}

echo "停止受影响服务。"
docker compose stop nginx api-1 api-2 || true

echo "强制重建受影响服务。"
docker compose up -d --force-recreate --no-deps api-1 api-2
docker compose up -d --force-recreate --no-deps nginx

echo "确认容器镜像已经切换。"
检查容器镜像 "lianruan-crm-v3-api-1" "lianruan-crm-v3-api:${target_version}"
检查容器镜像 "lianruan-crm-v3-api-2" "lianruan-crm-v3-api:${target_version}"
检查容器镜像 "lianruan-crm-v3-nginx" "lianruan-crm-v3-nginx:${target_version}"

echo "执行健康检查。"
"${install_root}/scripts/health-check.sh"
curl -fsS http://127.0.0.1/health/live >/dev/null
curl -fsS http://127.0.0.1/health/ready >/dev/null
检查健康版本

echo "执行业务自检。"
bash "${package_root}/tests/smoke.sh" "http://127.0.0.1"
检查前端资源
检查渠道员工字段

echo "KB 升级完成。日志：${log_file}"
echo "如需回退，执行：bash ${script_dir}/rollback.sh ${install_root} ${release_dir}"
