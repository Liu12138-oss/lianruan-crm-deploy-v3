#!/usr/bin/env bash
set -euo pipefail

install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
timestamp="$(date '+%Y%m%d-%H%M%S')"
diagnostics_dir="${install_root}/logs/diagnostics/${timestamp}"

mkdir -p "${diagnostics_dir}"

{
  echo "诊断时间=${timestamp}"
  uname -a
  cat /etc/os-release 2>/dev/null || true
  docker version || true
  docker compose version || true
  df -h "${install_root}" || true
} > "${diagnostics_dir}/system.txt"

cd "${install_root}/compose"
docker compose ps > "${diagnostics_dir}/compose-ps.txt" 2>&1 || true
docker compose logs --tail=500 api-1 api-2 worker nginx postgres redis-state redis-cache \
  > "${diagnostics_dir}/compose-logs.txt" 2>&1 || true

sed -E 's#(PASSWORD|SECRET|KEY|TOKEN)=.*#\1=已隐藏#g' "${install_root}/config/v3.env" \
  > "${diagnostics_dir}/v3-env-summary.txt" 2>/dev/null || true

package_file="${diagnostics_dir}.zip"
if command -v zip >/dev/null 2>&1; then
  (cd "$(dirname "${diagnostics_dir}")" && zip -qr -X "${package_file}" "$(basename "${diagnostics_dir}")")
  echo "诊断包已生成：${package_file}"
elif command -v python3 >/dev/null 2>&1; then
  DIAGNOSTICS_DIR="${diagnostics_dir}" PACKAGE_FILE="${package_file}" python3 - <<'PY'
import os
import pathlib
import zipfile

diagnostics_dir = pathlib.Path(os.environ["DIAGNOSTICS_DIR"])
package_file = pathlib.Path(os.environ["PACKAGE_FILE"])
parent_dir = diagnostics_dir.parent

with zipfile.ZipFile(package_file, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
    for item in diagnostics_dir.rglob("*"):
        if item.is_file():
            zip_file.write(item, item.relative_to(parent_dir))
PY
  echo "诊断包已生成：${package_file}"
else
  echo "未找到zip或python3，诊断目录已保留：${diagnostics_dir}"
fi
