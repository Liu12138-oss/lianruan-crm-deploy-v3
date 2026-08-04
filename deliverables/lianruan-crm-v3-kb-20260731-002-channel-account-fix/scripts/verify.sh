#!/usr/bin/env bash
set -euo pipefail

install_root="${1:-${INSTALL_ROOT:-/opt/lianruan-crm-v3}}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "${script_dir}/.." && pwd)"

失败() {
  echo "验证失败：$*" >&2
  exit 1
}

[ -d "${install_root}" ] || 失败 "安装目录不存在：${install_root}"
[ -f "${install_root}/scripts/health-check.sh" ] || 失败 "未找到健康检查脚本。"

"${install_root}/scripts/health-check.sh"
curl -fsS http://127.0.0.1/health/live >/dev/null || 失败 "存活检查失败。"
curl -fsS http://127.0.0.1/health/ready >/dev/null || 失败 "就绪检查失败。"
bash "${package_root}/tests/smoke.sh" "http://127.0.0.1"

echo "验证通过。"

