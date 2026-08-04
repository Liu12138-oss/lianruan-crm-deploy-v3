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

version_tag="${TARGET_VERSION:-3.0.0-stage9.25.20260803-kb003}"
min_version="${MIN_VERSION:-3.0.0-stage9.24.20260803-kb002}"

fail() {
  echo "预检查失败：$*" >&2
  exit 1
}

info() {
  echo "预检查：$*"
}

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

[ "$(id -u)" -eq 0 ] || fail "请使用 root 或 sudo 执行。"
[ "$(uname -m)" = "x86_64" ] || fail "当前架构不是 x86_64。"

if [ -f /etc/os-release ] && ! grep -Eiq 'openEuler|Euler' /etc/os-release; then
  echo "提示：当前系统未检测到欧拉标识，请确认操作系统兼容性。"
fi

for command_name in unzip zip sha256sum docker curl; do
  command -v "${command_name}" >/dev/null 2>&1 || fail "未找到命令：${command_name}"
done
docker compose version >/dev/null 2>&1 || fail "未找到 docker compose。"

[ -d "${install_root}" ] || fail "安装目录不存在：${install_root}"
[ -f "${install_root}/compose/docker-compose.yml" ] || fail "未找到 V3 Compose 文件。"
[ -f "${install_root}/config/v3.env" ] || fail "未找到 V3 环境配置。"
grep -q 'lianruan_crm_v3' "${install_root}/config/v3.env" || fail "当前目录不像 V3 生产目录。"

[ -f "${package_root}/images/lianruan-crm-v3-api-${version_tag}.docker-image" ] || fail "缺少 API 镜像。"
[ -f "${package_root}/images/lianruan-crm-v3-nginx-${version_tag}.docker-image" ] || fail "缺少 Nginx 镜像。"
[ -f "${package_root}/images/lianruan-crm-v3-worker-${version_tag}.docker-image" ] || fail "缺少 Worker 镜像。"
[ -f "${package_root}/database/migrations/20260803_S9_015_KB_003_导入既往客户.sql" ] || fail "缺少数据库迁移文件。"
[ -f "${package_root}/files/config/nginx/default.conf" ] || fail "缺少 Nginx 配置文件。"

if [ -f "${package_root}/manifest/SHA256SUMS" ]; then
  (cd "${package_root}" && sha256sum -c manifest/SHA256SUMS)
fi

available_kb="$(df -Pk "${install_root}" | tail -n 1 | while read -r filesystem blocks used available capacity mounted; do printf '%s' "${available}"; done)"
if [ "${available_kb:-0}" -lt 3145728 ]; then
  fail "安装目录所在磁盘剩余空间不足 3GB。"
fi

cd "${install_root}/compose"
docker compose ps >/dev/null

current_version="$(read_env_value "${install_root}/compose/.env" "V3_IMAGE_TAG" || true)"
[ -n "${current_version}" ] || current_version="$(read_env_value "${install_root}/config/deploy.env" "V3_IMAGE_TAG" || true)"
[ -n "${current_version}" ] || current_version="未读取到"

info "通过。当前版本：${current_version}，最低建议版本：${min_version}，目标版本：${version_tag}"
