#!/usr/bin/env bash
set -euo pipefail

install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
backup_type="manual"
dry_run=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      dry_run=true
      shift
      ;;
    --type)
      backup_type="${2:-manual}"
      shift 2
      ;;
    *)
      echo "未知参数：$1" >&2
      exit 1
      ;;
  esac
done

timestamp="$(date '+%Y%m%d-%H%M%S')"
backup_dir="${install_root}/backups/local/${timestamp}-${backup_type}"

echo "准备执行备份：${backup_dir}"
if [ "${dry_run}" = true ]; then
  echo "演练模式：不写入备份文件。"
  exit 0
fi

mkdir -p "${backup_dir}"

cd "${install_root}/compose"
echo "导出PostgreSQL逻辑备份。"
docker compose exec -T postgres pg_dump -U lianruan_app -d lianruan_crm_v3 > "${backup_dir}/postgres.sql"

echo "打包业务文件。"
tar -czf "${backup_dir}/uploads.tar.gz" -C "${install_root}/data" uploads
tar -czf "${backup_dir}/exports.tar.gz" -C "${install_root}/data" exports

echo "生成配置摘要。"
{
  echo "备份时间=${timestamp}"
  echo "备份类型=${backup_type}"
  sed -E 's#(PASSWORD|SECRET|KEY|TOKEN)=.*#\1=已隐藏#g' "${install_root}/config/v3.env"
  cat "${install_root}/config/deploy.env"
} > "${backup_dir}/config-summary.txt"

if command -v sha256sum >/dev/null 2>&1; then
  (cd "${backup_dir}" && sha256sum * > sha256sum.txt)
fi

if grep -q '^BACKUP_REMOTE_ENABLED=true' "${install_root}/config/deploy.env"; then
  remote_target="$(awk -F= '/^BACKUP_REMOTE_TARGET=/{print $2}' "${install_root}/config/deploy.env")"
  if [ -z "${remote_target}" ]; then
    echo "已启用异机备份但未配置BACKUP_REMOTE_TARGET。" >&2
    exit 1
  fi
  echo "异机备份已预留，请在阶段7后续接入同步命令：${remote_target}"
else
  echo "异机备份当前未启用，仅完成本机备份。"
fi

echo "备份完成：${backup_dir}"
