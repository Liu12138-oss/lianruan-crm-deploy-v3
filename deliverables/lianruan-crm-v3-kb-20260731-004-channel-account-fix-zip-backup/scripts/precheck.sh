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

target_version="${TARGET_VERSION:-3.0.0-stage9.22.20260731-kb002}"

失败() {
  echo "预检查失败：$*" >&2
  exit 1
}

提示() {
  echo "预检查：$*"
}

[ "$(id -u)" -eq 0 ] || 失败 "请使用 root 或 sudo 执行。"
[ "$(uname -m)" = "x86_64" ] || 失败 "当前架构不是 x86_64。"

if [ -f /etc/os-release ] && ! grep -Eiq 'openEuler|Euler' /etc/os-release; then
  echo "提示：当前系统未检测到欧拉标识，请确认兼容性。"
fi

command -v unzip >/dev/null 2>&1 || 失败 "未找到 unzip。"
command -v zip >/dev/null 2>&1 || 失败 "未找到 zip。"
command -v sha256sum >/dev/null 2>&1 || 失败 "未找到 sha256sum。"
command -v docker >/dev/null 2>&1 || 失败 "未找到 docker。"
docker compose version >/dev/null 2>&1 || 失败 "未找到 docker compose。"
command -v curl >/dev/null 2>&1 || 失败 "未找到 curl。"

[ -d "${install_root}" ] || 失败 "安装目录不存在：${install_root}"
[ -f "${install_root}/compose/docker-compose.yml" ] || 失败 "未找到 V3 Compose 文件。"
[ -f "${install_root}/config/v3.env" ] || 失败 "未找到 V3 环境配置。"
grep -q 'lianruan_crm_v3' "${install_root}/config/v3.env" || 失败 "当前目录不像 V3 生产目录。"

[ -f "${package_root}/images/lianruan-crm-v3-api-${target_version}.docker-image" ] || 失败 "缺少 API 镜像。"
[ -f "${package_root}/images/lianruan-crm-v3-nginx-${target_version}.docker-image" ] || 失败 "缺少 Nginx 镜像。"

if [ -f "${package_root}/manifest/SHA256SUMS" ]; then
  (cd "${package_root}" && sha256sum -c manifest/SHA256SUMS)
fi

cd "${install_root}/compose"
docker compose ps >/dev/null

提示 "通过。安装目录：${install_root}"
