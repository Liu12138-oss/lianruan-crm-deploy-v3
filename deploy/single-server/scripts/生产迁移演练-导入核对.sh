#!/usr/bin/env bash
set -Eeuo pipefail

install_root="${INSTALL_ROOT:-/opt/lianruan-crm-v3}"
package_path=""
init_password="${INIT_PASSWORD:-LrCRM@2026!}"
assume_yes="false"
skip_formal_load="false"
skip_password_init="false"

show_help() {
  cat <<'EOF'
用途：
  在 V3 测试服务器上导入本次 V2 迁移演练包，自动完成备份、暂存导入、数量核对、正式落表、密码初始化和登录核对。

最简单用法：
  sudo bash /tmp/生产迁移演练-导入核对.sh --package /tmp/stage8-official-S8-RUN-版本号.zip

常用参数：
  --package 路径          本地生成并上传到服务器的 stage8-official-*.zip。
  --install-root 路径     V3安装目录，默认 /opt/lianruan-crm-v3。
  --password 密码         迁移用户统一初始化密码，默认 LrCRM@2026!。
  --yes                  不再二次确认。
  --skip-formal-load     只做暂存导入和数量核对，不落正式业务表。
  --skip-password-init   不初始化迁移用户密码。
  -h, --help             查看帮助。

日志：
  /opt/lianruan-crm-v3/logs/migration-rehearsal/
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --package)
      package_path="${2:-}"
      shift 2
      ;;
    --install-root)
      install_root="${2:-}"
      shift 2
      ;;
    --password)
      init_password="${2:-}"
      shift 2
      ;;
    --yes)
      assume_yes="true"
      shift
      ;;
    --skip-formal-load)
      skip_formal_load="true"
      shift
      ;;
    --skip-password-init)
      skip_password_init="true"
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo "未知参数：$1" >&2
      show_help >&2
      exit 1
      ;;
  esac
done

prompt_value() {
  local prompt_text="$1"
  local default_value="$2"
  local input_value=""

  if [ -t 0 ]; then
    read -r -p "${prompt_text} [默认：${default_value}]：" input_value || true
  fi
  if [ -n "${input_value}" ]; then
    printf '%s' "${input_value}"
  else
    printf '%s' "${default_value}"
  fi
}

find_default_package() {
  local latest_package
  latest_package="$(ls -t /tmp/stage8-official-*.zip 2>/dev/null | head -n 1 || true)"
  if [ -n "${latest_package}" ]; then
    printf '%s' "${latest_package}"
  else
    printf '%s' "/tmp/stage8-official-S8-RUN-版本号.zip"
  fi
}

extract_package() {
  local source_package="$1"
  local target_dir="$2"

  if [ -d "${source_package}" ]; then
    cp -R "${source_package}" "${target_dir}/"
    return
  fi

  case "${source_package}" in
    *.zip)
      if command -v unzip >/dev/null 2>&1; then
        unzip -q "${source_package}" -d "${target_dir}"
        return
      fi
      if command -v python3 >/dev/null 2>&1; then
        PACKAGE_PATH="${source_package}" EXTRACT_DIR="${target_dir}" python3 - <<'PY'
import os
import zipfile

with zipfile.ZipFile(os.environ["PACKAGE_PATH"]) as zip_file:
    zip_file.extractall(os.environ["EXTRACT_DIR"])
PY
        return
      fi
      echo "服务器没有 unzip，也没有 python3，无法解压 ZIP 迁移包。" >&2
      echo "请先安装 unzip，或在本地解压后上传目录再执行本脚本。" >&2
      exit 1
      ;;
    *)
      echo "不支持的迁移包格式：${source_package}" >&2
      echo "请使用 .zip 迁移包。" >&2
      exit 1
      ;;
  esac
}

zip_or_copy_dir() {
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

backup_without_tar() {
  local backup_type="$1"
  local backup_dir="${install_root}/backups/local/${timestamp}-${backup_type}"

  echo "准备执行迁移前备份：${backup_dir}"
  mkdir -p "${backup_dir}"

  cd "${install_root}/compose"
  echo "导出PostgreSQL逻辑备份。"
  docker compose exec -T postgres pg_dump -U lianruan_app -d lianruan_crm_v3 > "${backup_dir}/postgres.sql"

  echo "备份业务文件，不依赖tar。"
  zip_or_copy_dir "${install_root}/data" uploads "${backup_dir}/uploads.zip"
  zip_or_copy_dir "${install_root}/data" exports "${backup_dir}/exports.zip"

  echo "生成配置摘要。"
  {
    echo "备份时间=${timestamp}"
    echo "备份类型=${backup_type}"
    if [ -f "${install_root}/config/v3.env" ]; then
      sed -E 's#(PASSWORD|SECRET|KEY|TOKEN)=.*#\1=已隐藏#g' "${install_root}/config/v3.env"
    fi
    if [ -f "${install_root}/config/deploy.env" ]; then
      cat "${install_root}/config/deploy.env"
    fi
  } > "${backup_dir}/config-summary.txt"

  if command -v sha256sum >/dev/null 2>&1; then
    (cd "${backup_dir}" && sha256sum * > sha256sum.txt)
  fi

  echo "备份完成：${backup_dir}"
}

if [ -z "${package_path}" ]; then
  package_path="$(prompt_value "请输入迁移包路径" "$(find_default_package)")"
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
log_dir="${install_root}/logs/migration-rehearsal"
log_file="${log_dir}/迁移演练导入核对-${timestamp}.log"
mkdir -p "${log_dir}"
exec > >(tee -a "${log_file}") 2>&1

trap 'echo "执行失败：第 ${LINENO} 行。请查看日志：${log_file}" >&2' ERR

echo "生产迁移演练导入开始。"
echo "安装目录：${install_root}"
echo "迁移包路径：${package_path}"
echo "日志文件：${log_file}"

if [ ! -d "${install_root}/compose" ]; then
  echo "未找到 V3 Compose 目录：${install_root}/compose" >&2
  exit 1
fi
if [ ! -f "${package_path}" ] && [ ! -d "${package_path}" ]; then
  echo "迁移包不存在：${package_path}" >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 docker 命令，无法导入 PostgreSQL。" >&2
  exit 1
fi

if [ "${assume_yes}" != "true" ]; then
  confirm_value="$(prompt_value "确认开始备份、导入、核对、落表和登录自检吗？输入 YES 继续" "NO")"
  if [ "${confirm_value}" != "YES" ]; then
    echo "用户取消执行。"
    exit 0
  fi
fi

compose_dir="${install_root}/compose"
migration_root="${install_root}/data/migration"
target_staging_dir="${migration_root}/stage8-official"
extract_dir="${migration_root}/extract-${timestamp}"
mkdir -p "${migration_root}" "${extract_dir}"

echo "步骤1：安装迁移暂存包。"
if [ -d "${target_staging_dir}" ]; then
  old_dir="${target_staging_dir}.bak.${timestamp}"
  mv "${target_staging_dir}" "${old_dir}"
  echo "已备份旧暂存包目录：${old_dir}"
fi

extract_package "${package_path}" "${extract_dir}"

candidate_dir=""
if [ -d "${extract_dir}/v2-postgres-staging" ]; then
  candidate_dir="${extract_dir}/v2-postgres-staging"
elif [ -d "${extract_dir}/stage8-official" ]; then
  candidate_dir="${extract_dir}/stage8-official"
else
  candidate_dir="$(find "${extract_dir}" -maxdepth 2 -type d -name 'v2-postgres-staging' | head -n 1 || true)"
fi

if [ -z "${candidate_dir}" ] || [ ! -f "${candidate_dir}/scripts/执行PostgreSQL暂存装载.sh" ]; then
  echo "迁移包格式不正确，未找到 scripts/执行PostgreSQL暂存装载.sh。" >&2
  exit 1
fi

mv "${candidate_dir}" "${target_staging_dir}"
chmod +x "${target_staging_dir}/scripts/执行PostgreSQL暂存装载.sh"
batch_code="$(awk -F'"' '/^batch_code=/{print $2; exit}' "${target_staging_dir}/scripts/执行PostgreSQL暂存装载.sh")"
if [ -z "${batch_code}" ]; then
  echo "无法从暂存装载脚本识别批次编号。" >&2
  exit 1
fi
echo "本次批次编号：${batch_code}"

echo "步骤2：执行 V3 迁移前备份。"
backup_without_tar "migration-rehearsal-${batch_code}-preimport"

echo "步骤3：检查 V3 服务健康状态。"
if [ -x "${install_root}/scripts/health-check.sh" ]; then
  INSTALL_ROOT="${install_root}" "${install_root}/scripts/health-check.sh"
fi

echo "步骤4：导入 PostgreSQL 暂存层并自动核对 S8_3 数量。"
cd "${target_staging_dir}"
STAGE8_PSQL_MODE=docker \
POSTGRES_CONTAINER=lianruan-crm-v3-postgres \
  ./scripts/执行PostgreSQL暂存装载.sh

run_psql() {
  cd "${compose_dir}"
  docker compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 "$@"
}

staging_count_file="${log_dir}/暂存数量核对-${batch_code}-${timestamp}.txt"
echo "步骤5：输出暂存层数量核对表：${staging_count_file}"
run_psql <<SQL | tee "${staging_count_file}"
SELECT
  b.batch_code AS "批次编号",
  b.status_code AS "批次状态",
  b.total_records AS "暂存总数",
  b.failed_records AS "未解决异常数",
  b.finished_at AS "完成时间"
FROM migration.migration_batches b
WHERE b.batch_code = '${batch_code}';

SELECT
  e.entity_name AS "实体",
  e.expected_records AS "V2导出数量",
  COUNT(r.id) AS "PostgreSQL暂存数量",
  CASE WHEN e.expected_records = COUNT(r.id) THEN '一致' ELSE '不一致' END AS "结果"
FROM migration.v2_import_expected_counts e
JOIN migration.migration_batches b ON b.id = e.batch_id
LEFT JOIN migration.v2_raw_records r ON r.batch_id = e.batch_id AND r.entity_name = e.entity_name
WHERE b.batch_code = '${batch_code}'
GROUP BY e.entity_name, e.expected_records
ORDER BY e.entity_name;
SQL

failed_check_count="$(run_psql -Atc "SELECT COUNT(*) FROM migration.validation_results WHERE batch_id=(SELECT id FROM migration.migration_batches WHERE batch_code='${batch_code}') AND check_code LIKE 'S8_3_%' AND result_code='failed';")"
open_error_count="$(run_psql -Atc "SELECT COUNT(*) FROM migration.migration_errors WHERE batch_id=(SELECT id FROM migration.migration_batches WHERE batch_code='${batch_code}') AND resolved_at IS NULL;")"
if [ "${failed_check_count}" != "0" ] || [ "${open_error_count}" != "0" ]; then
  echo "暂存核对未通过，失败校验项：${failed_check_count}，未解决异常：${open_error_count}。已停止，未落正式表。" >&2
  exit 1
fi

if [ "${skip_formal_load}" = "true" ]; then
  echo "已按参数跳过正式业务表落表。"
else
  echo "步骤6：落到 V3 正式业务表。"
  formal_sql="${install_root}/database/migrations/20260727_S8_004_正式业务表落表.sql"
  if [ ! -f "${formal_sql}" ]; then
    echo "未找到正式落表 SQL：${formal_sql}" >&2
    exit 1
  fi
  cd "${compose_dir}"
  docker compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -v ON_ERROR_STOP=1 -f - < "${formal_sql}"
fi

formal_count_file="${log_dir}/正式表数量核对-${batch_code}-${timestamp}.txt"
echo "步骤7：输出正式业务表数量核对表：${formal_count_file}"
run_psql <<SQL | tee "${formal_count_file}"
WITH expected AS (
  SELECT e.entity_name, e.expected_records
  FROM migration.v2_import_expected_counts e
  JOIN migration.migration_batches b ON b.id = e.batch_id
  WHERE b.batch_code = '${batch_code}'
),
formal AS (
  SELECT 'users' AS entity_name, COUNT(*) AS formal_records FROM iam.users WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'partners', COUNT(*) FROM channel.partners WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'registrations', COUNT(*) FROM crm.registrations WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'opportunities', COUNT(*) FROM crm.opportunities WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'quotes', COUNT(*) FROM crm.quotes WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'orders', COUNT(*) FROM crm.orders WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'categories', COUNT(*) FROM catalog.product_categories WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'modules', COUNT(*) FROM catalog.product_modules WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'features', COUNT(*) FROM catalog.product_features WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'hardwareProducts', COUNT(*) FROM catalog.hardware_products WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'packages', COUNT(*) FROM catalog.product_packages WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'implementationWorkloadClassifications', COUNT(*) FROM catalog.workload_classifications WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'implementationWorkloadMappings', COUNT(*) FROM catalog.workload_mappings WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'implementationWorkloadRules', COUNT(*) FROM catalog.workload_rules WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'implementationDeliveryWorkloadRules', COUNT(*) FROM catalog.delivery_workload_rules WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'openApiClients', COUNT(*) FROM integration.open_api_clients WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'pendingApprovals', COUNT(*) FROM ops.approvals WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'notifications', COUNT(*) FROM ops.notifications WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit.audit_logs WHERE v2_source_id IS NOT NULL
)
SELECT
  e.entity_name AS "实体",
  e.expected_records AS "V2导出数量",
  COALESCE(f.formal_records, 0) AS "V3正式表数量",
  CASE
    WHEN e.expected_records = COALESCE(f.formal_records, 0) THEN '一致'
    WHEN e.expected_records < COALESCE(f.formal_records, 0) THEN 'V3更多，通常是旧测试数据叠加'
    ELSE 'V3缺少，需要停止验收'
  END AS "结果"
FROM expected e
LEFT JOIN formal f ON f.entity_name = e.entity_name
ORDER BY e.entity_name;
SQL

core_missing_count="$(run_psql -Atc "
WITH expected AS (
  SELECT e.entity_name, e.expected_records
  FROM migration.v2_import_expected_counts e
  JOIN migration.migration_batches b ON b.id = e.batch_id
  WHERE b.batch_code = '${batch_code}'
),
formal AS (
  SELECT 'users' AS entity_name, COUNT(*) AS formal_records FROM iam.users WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'partners', COUNT(*) FROM channel.partners WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'registrations', COUNT(*) FROM crm.registrations WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'opportunities', COUNT(*) FROM crm.opportunities WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'quotes', COUNT(*) FROM crm.quotes WHERE v2_source_id IS NOT NULL
  UNION ALL SELECT 'orders', COUNT(*) FROM crm.orders WHERE v2_source_id IS NOT NULL
)
SELECT COUNT(*)
FROM expected e
JOIN formal f ON f.entity_name = e.entity_name
WHERE e.entity_name IN ('users','partners','registrations','opportunities','quotes','orders')
  AND e.expected_records > f.formal_records;
")"
if [ "${core_missing_count}" != "0" ]; then
  echo "核心业务正式表存在缺数，已停止验收。缺数项数量：${core_missing_count}" >&2
  exit 1
fi

if [ "${skip_password_init}" = "true" ]; then
  echo "已按参数跳过迁移用户密码初始化。"
else
  echo "步骤8：初始化迁移用户统一密码。"
  if [ ! -x "${install_root}/scripts/init-migrated-user-passwords.sh" ]; then
    echo "未找到密码初始化脚本：${install_root}/scripts/init-migrated-user-passwords.sh" >&2
    exit 1
  fi
  echo "前面已完成迁移前完整备份，本步骤跳过密码脚本的二次完整备份，仅保留v3.env单文件备份。"
  INSTALL_ROOT="${install_root}" INIT_PASSWORD="${init_password}" \
    "${install_root}/scripts/init-migrated-user-passwords.sh" --yes --skip-backup
fi

echo "步骤9：执行健康检查。"
if [ -x "${install_root}/scripts/health-check.sh" ]; then
  INSTALL_ROOT="${install_root}" "${install_root}/scripts/health-check.sh"
fi

echo "步骤10：自动抽取一个迁移账号做登录核对。"
login_username="$(run_psql -Atc "SELECT username FROM iam.users WHERE status_code='active' AND v2_source_id IS NOT NULL ORDER BY username LIMIT 1;")"
if [ -z "${login_username}" ]; then
  echo "未找到可登录的 V2 迁移账号，请人工检查 iam.users。"
else
  login_request="$(printf '{"username":"%s","password":"%s"}' "${login_username}" "${init_password}")"
  login_response="$(curl -sS -c "/tmp/v3-login-${batch_code}.cookie" -H 'Content-Type: application/json' -d "${login_request}" http://127.0.0.1/api/auth/login || true)"
  echo "登录核对账号：${login_username}"
  if printf '%s' "${login_response}" | grep -q '"success":true'; then
    echo "登录核对：通过。"
    curl -sS -b "/tmp/v3-login-${batch_code}.cookie" http://127.0.0.1/api/auth/me >/dev/null || true
  else
    echo "登录核对：失败。响应如下："
    echo "${login_response}"
    exit 1
  fi
fi

echo "生产迁移演练导入完成。"
echo "批次编号：${batch_code}"
echo "日志文件：${log_file}"
echo "暂存核对文件：${staging_count_file}"
echo "正式表核对文件：${formal_count_file}"
echo "统一初始化密码：${init_password}"
echo "下一步请用浏览器抽查管理端和渠道端页面。"
