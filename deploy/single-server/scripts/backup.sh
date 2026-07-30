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

打包目录为zip() {
  local source_parent="$1"
  local source_name="$2"
  local output_file="$3"

  if [ ! -d "${source_parent}/${source_name}" ]; then
    mkdir -p "${source_parent}/${source_name}"
  fi

  if command -v zip >/dev/null 2>&1; then
    (cd "${source_parent}" && zip -qr -X "${output_file}" "${source_name}")
    return
  fi

  if command -v python3 >/dev/null 2>&1; then
    SOURCE_PARENT="${source_parent}" SOURCE_NAME="${source_name}" OUTPUT_FILE="${output_file}" python3 - <<'PY'
import os
import pathlib
import zipfile

source_parent = pathlib.Path(os.environ["SOURCE_PARENT"])
source_name = os.environ["SOURCE_NAME"]
output_file = pathlib.Path(os.environ["OUTPUT_FILE"])
source_dir = source_parent / source_name

with zipfile.ZipFile(output_file, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
    for item in source_dir.rglob("*"):
        if item.is_file():
            zip_file.write(item, item.relative_to(source_parent))
PY
    return
  fi

  local copy_target="${output_file%.zip}"
  rm -rf "${copy_target}"
  cp -R "${source_parent}/${source_name}" "${copy_target}"
  echo "未找到zip或python3，已改为目录备份：${copy_target}" >&2
}

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
打包目录为zip "${install_root}/data" uploads "${backup_dir}/uploads.zip"
打包目录为zip "${install_root}/data" exports "${backup_dir}/exports.zip"

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
