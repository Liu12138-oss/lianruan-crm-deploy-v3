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

kb_id="${KB_ID:-KB-20260731-002}"
target_version="${TARGET_VERSION:-3.0.0-stage9.22.20260731-kb002}"
timestamp="$(date '+%Y%m%d-%H%M%S')"
log_dir="${install_root}/logs/install"
log_file="${log_dir}/${kb_id}-${timestamp}.log"
release_dir="${install_root}/releases/${target_version}-pre-${timestamp}"

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
  mkdir -p "${file%/*}"
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
  cp "${tmp}" "${file}"
  rm -f "${tmp}"
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

echo "执行升级前备份。"
INSTALL_ROOT="${install_root}" "${install_root}/scripts/backup.sh" --type "${kb_id}-preupgrade"

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
docker load -i "${package_root}/images/lianruan-crm-v3-api-${target_version}.tar"
docker load -i "${package_root}/images/lianruan-crm-v3-nginx-${target_version}.tar"

echo "同步镜像版本变量。"
写入变量 "${install_root}/compose/.env" "V3_IMAGE_TAG" "${target_version}"
[ -f "${install_root}/config/deploy.env" ] && 写入变量 "${install_root}/config/deploy.env" "V3_IMAGE_TAG" "${target_version}"

cd "${install_root}/compose"

echo "停止受影响服务。"
docker compose stop nginx || true
docker compose stop api-1 api-2 || true

echo "启动受影响服务。"
docker compose up -d api-1 api-2 nginx

echo "执行健康检查。"
"${install_root}/scripts/health-check.sh"
curl -fsS http://127.0.0.1/health/live >/dev/null
curl -fsS http://127.0.0.1/health/ready >/dev/null

echo "执行业务自检。"
bash "${package_root}/tests/smoke.sh" "http://127.0.0.1"

echo "KB 升级完成。日志：${log_file}"
echo "如需回退，执行：bash ${script_dir}/rollback.sh ${install_root} ${release_dir}"

