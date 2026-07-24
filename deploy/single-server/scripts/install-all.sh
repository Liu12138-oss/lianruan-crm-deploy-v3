#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "${script_dir}/.." && pwd)"
install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
server_host="${SERVER_HOST:-}"
http_port="${HTTP_PORT:-80}"
timestamp="$(date '+%Y%m%d-%H%M%S')"
log_dir="${install_root}/logs/install"
log_file="${log_dir}/install-all-${timestamp}.log"

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用root或sudo执行一键安装脚本。" >&2
  exit 1
fi

mkdir -p "${log_dir}"
exec > >(tee -a "${log_file}") 2>&1

失败处理() {
  local exit_code="$1"
  echo "阶段7.1一键安装失败，退出码：${exit_code}" >&2
  echo "安装日志：${log_file}" >&2
  if [ -x "${install_root}/scripts/collect-diagnostics.sh" ]; then
    echo "可执行诊断采集：sudo ${install_root}/scripts/collect-diagnostics.sh" >&2
  fi
}
trap '失败处理 $?' ERR

if [ -z "${server_host}" ]; then
  server_host="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi
server_host="${server_host:-127.0.0.1}"

echo "阶段7.1一键安装开始。"
echo "安装目录：${install_root}"
echo "访问地址：http://${server_host}:${http_port}"
echo "安装日志：${log_file}"

INSTALL_ROOT="${install_root}" "${package_root}/scripts/preflight.sh"
INSTALL_ROOT="${install_root}" "${package_root}/scripts/install-runtime.sh"
INSTALL_ROOT="${install_root}" SERVER_HOST="${server_host}" "${package_root}/scripts/install.sh"

echo "尝试放行HTTP端口。"
if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port="${http_port}/tcp" || true
  firewall-cmd --reload || true
else
  echo "firewalld未运行或未安装，跳过防火墙端口配置。"
fi

INSTALL_ROOT="${install_root}" "${install_root}/scripts/start.sh"
INSTALL_ROOT="${install_root}" "${install_root}/scripts/health-check.sh"

echo "阶段7.1一键安装完成。"
echo "访问地址：http://${server_host}:${http_port}"
echo "安装日志：${log_file}"
echo "后续健康检查：${install_root}/scripts/health-check.sh"
