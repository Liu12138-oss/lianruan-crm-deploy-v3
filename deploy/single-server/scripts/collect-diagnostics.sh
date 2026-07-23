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

tar -czf "${diagnostics_dir}.tar.gz" -C "$(dirname "${diagnostics_dir}")" "$(basename "${diagnostics_dir}")"
echo "诊断包已生成：${diagnostics_dir}.tar.gz"
