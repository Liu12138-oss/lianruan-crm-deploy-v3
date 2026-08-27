#!/usr/bin/env bash
set -Eeuo pipefail

# 本脚本仅执行 PostgreSQL 一致性只读导出和上传附件打包，不停止、不修改生产服务和数据。
install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
output_dir=""

显示帮助() {
  cat <<'EOF'
用途：
  在生产 V3 服务器生成供测试环境恢复使用的 ZIP 迁移包。

安全边界：
  仅包含 PostgreSQL 逻辑备份和 data/uploads 附件；不包含 Redis、配置、密钥或导出文件。
  不会停止服务，不会执行数据库写入、删除或迁移。pg_dump 为一致性只读快照，建议在低峰执行。

用法：
  sudo bash 导出生产V3测试迁移包.sh
  sudo bash 导出生产V3测试迁移包.sh --output-dir /opt/lianruan-crm-v3/backups/transfer
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --install-root)
      install_root="${2:-}"
      shift 2
      ;;
    --output-dir)
      output_dir="${2:-}"
      shift 2
      ;;
    -h|--help)
      显示帮助
      exit 0
      ;;
    *)
      echo "未知参数：$1" >&2
      显示帮助 >&2
      exit 1
      ;;
  esac
done

compose_dir="${install_root}/compose"
if [ -z "${output_dir}" ]; then
  output_dir="${install_root}/backups/transfer"
fi

检查命令() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "未找到命令：$1" >&2
    exit 1
  fi
}

打包目录为zip() {
  local source_parent="$1"
  local source_name="$2"
  local output_file="$3"

  mkdir -p "${source_parent}/${source_name}"
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

with zipfile.ZipFile(output_file, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
    for item in (source_parent / source_name).rglob("*"):
        if item.is_file():
            zip_file.write(item, item.relative_to(source_parent))
PY
    return
  fi
  echo "未找到 zip 或 python3，无法生成迁移包。" >&2
  exit 1
}

打包迁移包() {
  local source_dir="$1"
  local output_file="$2"

  if command -v zip >/dev/null 2>&1; then
    (cd "$(dirname "${source_dir}")" && zip -qr -X "${output_file}" "$(basename "${source_dir}")")
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    SOURCE_DIR="${source_dir}" OUTPUT_FILE="${output_file}" python3 - <<'PY'
import os
import pathlib
import zipfile

source_dir = pathlib.Path(os.environ["SOURCE_DIR"])
output_file = pathlib.Path(os.environ["OUTPUT_FILE"])

with zipfile.ZipFile(output_file, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
    for item in source_dir.rglob("*"):
        if item.is_file():
            zip_file.write(item, item.relative_to(source_dir.parent))
PY
    return
  fi
  echo "未找到 zip 或 python3，无法生成迁移包。" >&2
  exit 1
}

if [ ! -d "${compose_dir}" ]; then
  echo "未找到 V3 Compose 目录：${compose_dir}" >&2
  exit 1
fi
检查命令 docker
检查命令 sha256sum

timestamp="$(date '+%Y%m%d-%H%M%S')"
package_name="v3-production-to-test-${timestamp}"
package_file="${output_dir}/${package_name}.zip"
mkdir -p "${output_dir}"
work_dir="$(mktemp -d "${output_dir}/.${package_name}.XXXXXX")"
package_dir="${work_dir}/${package_name}"

清理临时目录() {
  rm -rf "${work_dir}"
}
trap 清理临时目录 EXIT

mkdir -p "${package_dir}"
if [ -e "${package_file}" ]; then
  echo "迁移包已存在，拒绝覆盖：${package_file}" >&2
  exit 1
fi

echo "生产 V3 测试迁移包导出开始。"
echo "安装目录：${install_root}"
echo "输出目录：${output_dir}"
echo "本脚本不会停止或修改生产服务。"

cd "${compose_dir}"
docker compose exec -T postgres pg_isready -U lianruan_app -d lianruan_crm_v3 >/dev/null

echo "导出 PostgreSQL 一致性只读逻辑备份。"
docker compose exec -T postgres pg_dump \
  -U lianruan_app \
  -d lianruan_crm_v3 \
  --format=plain \
  --no-owner \
  --no-privileges \
  > "${package_dir}/postgres.sql"

if [ ! -s "${package_dir}/postgres.sql" ]; then
  echo "PostgreSQL 逻辑备份为空，导出失败。" >&2
  exit 1
fi

echo "打包生产上传附件。"
打包目录为zip "${install_root}/data" uploads "${package_dir}/uploads.zip"

migration_count="$(docker compose exec -T postgres psql -X -At -U lianruan_app -d lianruan_crm_v3 -c "SELECT COUNT(*) FROM migration.schema_migrations;")"
latest_migration="$(docker compose exec -T postgres psql -X -At -U lianruan_app -d lianruan_crm_v3 -c "SELECT version FROM migration.schema_migrations ORDER BY applied_at DESC, version DESC LIMIT 1;")"
image_tag="$(awk -F= '$1 == "V3_IMAGE_TAG" { value=$2 } END { print value }' "${install_root}/config/deploy.env" 2>/dev/null || true)"

cat > "${package_dir}/manifest.env" <<EOF
迁移包格式版本=V3生产到测试数据恢复包v1
导出时间=${timestamp}
来源主机=$(hostname)
来源数据库=lianruan_crm_v3
来源镜像版本=${image_tag:-未记录}
数据库迁移数量=${migration_count}
数据库最新迁移=${latest_migration:-未识别}
包含上传附件=true
不包含内容=Redis、配置、密钥、导出文件
EOF

(cd "${package_dir}" && sha256sum postgres.sql uploads.zip manifest.env > SHA256SUMS)
打包迁移包 "${package_dir}" "${package_file}"
(cd "${output_dir}" && sha256sum "$(basename "${package_file}")" > "$(basename "${package_file}").sha256")

echo "生产 V3 测试迁移包导出完成。"
echo "迁移包：${package_file}"
echo "外层校验文件：${package_file}.sha256"
echo "请仅将上述两个文件复制到测试服务器；不要复制生产的 config、secrets、Redis 或 data/postgres。"
