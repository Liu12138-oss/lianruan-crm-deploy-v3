#!/usr/bin/env bash
set -Eeuo pipefail

# 本脚本只允许在拥有当前测试环境最新迁移记录的目标库执行，禁止用于生产环境。
install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
package_path=""
backup_dir=""
execute="false"
confirm_text=""
start_services="false"

显示帮助() {
  cat <<'EOF'
用途：
  在测试 V3 服务器恢复生产 V3 数据，并使用测试服务器当前代码补齐数据库迁移。

安全保护：
  1. 仅当目标库已具有本项目当前最新迁移记录时才允许继续，避免在当前生产库执行。
  2. 必须同时提供 --execute 和 --confirm 覆盖测试V3数据。
  3. 执行前自动备份测试数据库、上传附件和导出文件；仅停止测试 API、Nginx 与任务进程。
  4. 强制要求测试环境的消息、企微群机器人、短信、邮件开关全部为 false。
  5. 默认不启动业务服务，避免恢复后的历史任务或外部动作被意外执行。

用法：
  仅检查迁移包和测试环境保护条件：
    sudo bash 导入生产V3数据到测试.sh --package /tmp/v3-production-to-test-时间.zip

  实际导入：
    sudo bash 导入生产V3数据到测试.sh \
      --package /tmp/v3-production-to-test-时间.zip \
      --execute \
      --confirm 覆盖测试V3数据

  导入、验证后立即启动测试服务：
    在上述命令末尾增加 --start-services。
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --install-root)
      install_root="${2:-}"
      shift 2
      ;;
    --package)
      package_path="${2:-}"
      shift 2
      ;;
    --backup-dir)
      backup_dir="${2:-}"
      shift 2
      ;;
    --execute)
      execute="true"
      shift
      ;;
    --confirm)
      confirm_text="${2:-}"
      shift 2
      ;;
    --start-services)
      start_services="true"
      shift
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

检查命令() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "未找到命令：$1" >&2
    exit 1
  fi
}

读取配置值() {
  local key="$1"
  local config_file="${install_root}/config/v3.env"
  if [ ! -f "${config_file}" ]; then
    echo "未找到测试环境配置文件：${config_file}" >&2
    exit 1
  fi
  awk -F= -v key="${key}" '
    $0 !~ /^[[:space:]]*#/ && $1 == key {
      value = substr($0, length(key) + 2)
    }
    END {
      sub(/\r$/, "", value)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      print value
    }
  ' "${config_file}"
}

检查外部消息已关闭() {
  local key
  local value
  for key in MESSAGE_WORKER_ENABLED MESSAGE_WECOM_GROUP_ENABLED MESSAGE_SMS_ENABLED MESSAGE_EMAIL_ENABLED; do
    value="$(读取配置值 "${key}")"
    if [ "${value}" != "false" ]; then
      echo "为避免测试环境向外发送消息，${key} 必须明确配置为 false，当前值：${value:-未配置}。" >&2
      exit 1
    fi
  done
}

解压迁移包() {
  local source_file="$1"
  local target_dir="$2"
  if command -v unzip >/dev/null 2>&1; then
    unzip -q "${source_file}" -d "${target_dir}"
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    PACKAGE_PATH="${source_file}" EXTRACT_DIR="${target_dir}" python3 - <<'PY'
import os
import pathlib
import zipfile

package_path = pathlib.Path(os.environ["PACKAGE_PATH"])
extract_dir = pathlib.Path(os.environ["EXTRACT_DIR"]).resolve()

with zipfile.ZipFile(package_path) as zip_file:
    for info in zip_file.infolist():
        target_path = (extract_dir / info.filename).resolve()
        if target_path != extract_dir and extract_dir not in target_path.parents:
            raise SystemExit("迁移包包含越界路径，拒绝解压：" + info.filename)
    zip_file.extractall(extract_dir)
PY
    return
  fi
  echo "服务器没有 unzip，也没有 python3，无法解压 ZIP 迁移包。" >&2
  exit 1
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
  echo "未找到 zip 或 python3，无法创建测试环境回退备份。" >&2
  exit 1
}

执行数据库查询() {
  (
    cd "${compose_dir}"
    docker compose exec -T postgres psql -X -At -v ON_ERROR_STOP=1 -U lianruan_app -d lianruan_crm_v3 -c "$1"
  )
}

停止测试业务服务() {
  echo "停止测试 nginx、API 和任务进程，保留 PostgreSQL 与 Redis。"
  (
    cd "${compose_dir}"
    docker compose stop nginx api-1 api-2 worker || true
    docker compose --profile message --profile message-external stop \
      worker-message-critical worker-message-maintenance worker-message-integration || true
    docker compose up -d postgres redis-state redis-cache
  )
}

检查业务服务已停止() {
  local running_services
  local service_name
  running_services="$(cd "${compose_dir}" && docker compose --profile message --profile message-external ps --status running --services || true)"
  for service_name in nginx api-1 api-2 worker worker-message-critical worker-message-maintenance worker-message-integration; do
    if printf '%s\n' "${running_services}" | grep -Fxq "${service_name}"; then
      echo "服务仍在运行，拒绝覆盖测试数据：${service_name}" >&2
      exit 1
    fi
  done
}

创建测试回退备份() {
  echo "创建测试环境回退备份：${backup_dir}"
  mkdir -p "${backup_dir}"
  (
    cd "${compose_dir}"
    docker compose exec -T postgres pg_dump \
      -U lianruan_app \
      -d lianruan_crm_v3 \
      --format=plain \
      --no-owner \
      --no-privileges \
      > "${backup_dir}/postgres.sql"
  )
  if [ ! -s "${backup_dir}/postgres.sql" ]; then
    echo "测试环境回退数据库备份为空，拒绝继续。" >&2
    exit 1
  fi
  打包目录为zip "${install_root}/data" uploads "${backup_dir}/uploads.zip"
  打包目录为zip "${install_root}/data" exports "${backup_dir}/exports.zip"
  (cd "${backup_dir}" && sha256sum postgres.sql uploads.zip exports.zip > SHA256SUMS)
}

清空测试Redis() {
  echo "清空测试 Redis 队列、会话和缓存，避免恢复后执行历史任务。"
  (
    cd "${compose_dir}"
    docker compose exec -T redis-state sh -c 'REDISCLI_AUTH="$(cat /run/secrets/redis_password)" redis-cli FLUSHALL ASYNC'
    docker compose exec -T redis-cache sh -c 'REDISCLI_AUTH="$(cat /run/secrets/redis_password)" redis-cli FLUSHALL ASYNC'
  )
}

重建测试数据库() {
  echo "断开测试数据库连接并重建数据库。"
  (
    cd "${compose_dir}"
    docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U lianruan_app -d postgres <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'lianruan_crm_v3'
  AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS lianruan_crm_v3;
CREATE DATABASE lianruan_crm_v3 OWNER lianruan_app;
SQL
    docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U lianruan_app -d lianruan_crm_v3 -f - < "${package_dir}/postgres.sql"
  )
}

恢复测试附件() {
  local old_uploads_dir="${install_root}/data/uploads.before-production-import-${timestamp}"
  local old_exports_dir="${install_root}/data/exports.before-production-import-${timestamp}"

  echo "替换测试上传附件；原附件目录保留为：${old_uploads_dir}"
  if [ -e "${install_root}/data/uploads" ]; then
    mv "${install_root}/data/uploads" "${old_uploads_dir}"
  fi
  mkdir -p "${install_root}/data"
  if command -v unzip >/dev/null 2>&1; then
    unzip -q "${package_dir}/uploads.zip" -d "${install_root}/data"
  else
    UPLOADS_ZIP="${package_dir}/uploads.zip" DATA_DIR="${install_root}/data" python3 - <<'PY'
import os
import pathlib
import zipfile

archive = pathlib.Path(os.environ["UPLOADS_ZIP"])
data_dir = pathlib.Path(os.environ["DATA_DIR"]).resolve()
with zipfile.ZipFile(archive) as zip_file:
    for info in zip_file.infolist():
        target_path = (data_dir / info.filename).resolve()
        if target_path != data_dir and data_dir not in target_path.parents:
            raise SystemExit("附件包包含越界路径，拒绝解压：" + info.filename)
    zip_file.extractall(data_dir)
PY
  fi
  mkdir -p "${install_root}/data/uploads"

  echo "清空测试导出文件，避免保留旧测试数据或复制生产导出文件。"
  if [ -e "${install_root}/data/exports" ]; then
    mv "${install_root}/data/exports" "${old_exports_dir}"
  fi
  mkdir -p "${install_root}/data/exports"
}

输出验证结果() {
  echo "数据库迁移版本："
  执行数据库查询 "SELECT version FROM migration.schema_migrations ORDER BY applied_at, version;"
  echo "核心记录数量："
  (
    cd "${compose_dir}"
    docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U lianruan_app -d lianruan_crm_v3 <<'SQL'
SELECT 'iam.users' AS "数据表", COUNT(*) AS "记录数" FROM iam.users
UNION ALL SELECT 'crm.customers', COUNT(*) FROM crm.customers
UNION ALL SELECT 'channel.partners', COUNT(*) FROM channel.partners
UNION ALL SELECT 'ops.files', COUNT(*) FROM ops.files
UNION ALL SELECT 'audit.audit_logs', COUNT(*) FROM audit.audit_logs
ORDER BY 1;
SQL
  )
  echo "上传附件文件数量：$(find "${install_root}/data/uploads" -type f | wc -l | tr -d ' ')"
}

if [ -z "${package_path}" ]; then
  echo "必须通过 --package 指定生产导出的 ZIP 迁移包。" >&2
  exit 1
fi
if [ ! -f "${package_path}" ] || [[ "${package_path}" != *.zip ]]; then
  echo "迁移包不存在或不是 ZIP 文件：${package_path}" >&2
  exit 1
fi

compose_dir="${install_root}/compose"
migration_dir="${install_root}/database/migrations"
if [ ! -d "${compose_dir}" ] || [ ! -d "${migration_dir}" ]; then
  echo "未找到测试环境 V3 Compose 或数据库迁移目录。" >&2
  exit 1
fi
检查命令 docker
检查命令 sha256sum

timestamp="$(date '+%Y%m%d-%H%M%S')"
if [ -z "${backup_dir}" ]; then
  backup_dir="${install_root}/backups/local/${timestamp}-production-data-import-preimport"
fi
extract_dir="${install_root}/data/migration/production-to-test-${timestamp}"
mkdir -p "${extract_dir}"

清理解压目录() {
  rm -rf "${extract_dir}"
}
trap 清理解压目录 EXIT

echo "生产 V3 数据导入测试环境准备开始。"
echo "测试安装目录：${install_root}"
echo "生产迁移包：${package_path}"
echo "测试回退备份目录：${backup_dir}"

解压迁移包 "${package_path}" "${extract_dir}"
manifest_file="$(find "${extract_dir}" -maxdepth 2 -type f -name manifest.env -print | sed -n '1p')"
package_dir="${manifest_file%/manifest.env}"
if [ -z "${package_dir}" ] || [ ! -s "${package_dir}/postgres.sql" ] || [ ! -f "${package_dir}/uploads.zip" ] || [ ! -f "${package_dir}/SHA256SUMS" ]; then
  echo "迁移包格式不正确，必须包含 postgres.sql、uploads.zip、manifest.env 和 SHA256SUMS。" >&2
  exit 1
fi
if [ "$(find "${extract_dir}" -maxdepth 2 -type f -name manifest.env | wc -l | tr -d ' ')" != "1" ]; then
  echo "迁移包中 manifest.env 数量异常，拒绝继续。" >&2
  exit 1
fi
(cd "${package_dir}" && sha256sum -c SHA256SUMS)
if [ -f "${package_path}.sha256" ]; then
  (cd "$(dirname "${package_path}")" && sha256sum -c "$(basename "${package_path}").sha256")
else
  echo "未发现外层校验文件：${package_path}.sha256；已完成包内文件校验。" >&2
fi

echo "迁移包摘要："
cat "${package_dir}/manifest.env"

检查外部消息已关闭
(
  cd "${compose_dir}"
  docker compose exec -T postgres pg_isready -U lianruan_app -d lianruan_crm_v3 >/dev/null
)

latest_local_migration=""
for migration_file in "${migration_dir}"/*.sql; do
  migration_name="$(basename "${migration_file}" .sql)"
  case "${migration_name}" in
    *.rollback|*.down)
      continue
      ;;
  esac
  if [ -z "${latest_local_migration}" ] || [[ "${migration_name}" > "${latest_local_migration}" ]]; then
    latest_local_migration="${migration_name}"
  fi
done
if [ -z "${latest_local_migration}" ]; then
  echo "无法识别测试环境当前最新数据库迁移。" >&2
  exit 1
fi
target_has_latest="$(执行数据库查询 "SELECT EXISTS (SELECT 1 FROM migration.schema_migrations WHERE version = '${latest_local_migration}');")"
if [ "${target_has_latest}" != "t" ]; then
  echo "目标数据库不包含测试环境最新迁移：${latest_local_migration}。" >&2
  echo "这可能是生产环境或未升级完成的测试环境，拒绝覆盖。" >&2
  exit 1
fi
echo "测试环境保护校验通过：已检测到最新迁移 ${latest_local_migration}。"

if [ "${execute}" != "true" ]; then
  echo "当前为检查模式，未停止服务、未备份、未修改测试数据。"
  echo "实际执行必须增加：--execute --confirm 覆盖测试V3数据"
  exit 0
fi
if [ "${confirm_text}" != "覆盖测试V3数据" ]; then
  echo "确认语不正确。实际执行必须使用：--confirm 覆盖测试V3数据" >&2
  exit 1
fi

停止测试业务服务
检查业务服务已停止
创建测试回退备份
清空测试Redis
重建测试数据库

echo "使用测试环境当前迁移补齐数据库结构。"
INSTALL_ROOT="${install_root}" "${install_root}/scripts/migrate-db.sh"

restored_latest="$(执行数据库查询 "SELECT EXISTS (SELECT 1 FROM migration.schema_migrations WHERE version = '${latest_local_migration}');")"
if [ "${restored_latest}" != "t" ]; then
  echo "测试环境最新迁移未补齐：${latest_local_migration}，保持业务服务停止。" >&2
  exit 1
fi

恢复测试附件
输出验证结果

echo "生产 V3 数据已导入测试环境，业务服务当前保持停止。"
echo "测试环境回退备份：${backup_dir}"
echo "如需启动测试服务，请先核对上述数据和迁移结果，再执行："
echo "  sudo INSTALL_ROOT=${install_root} bash ${install_root}/scripts/start.sh"

if [ "${start_services}" = "true" ]; then
  echo "按参数启动测试服务并执行健康检查。"
  INSTALL_ROOT="${install_root}" "${install_root}/scripts/start.sh"
fi
