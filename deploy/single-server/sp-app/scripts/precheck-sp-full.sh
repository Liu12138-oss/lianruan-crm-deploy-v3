#!/usr/bin/env bash
set -euo pipefail

install_root="${1:-${INSTALL_ROOT:-/opt/lianruan-crm-v3}}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "${script_dir}/.." && pwd)"
meta_file="${package_root}/manifest/包元数据.env"

失败() {
  echo "SP-FULL 预检查失败：$*" >&2
  exit 1
}

提示() {
  echo "预检查：$*"
}

[ "$(id -u)" -eq 0 ] || 失败 "请使用 root 或 sudo 执行。"
[ "$(uname -m)" = "x86_64" ] || 失败 "当前架构不是 x86_64。"
if [ -f /etc/os-release ] && ! grep -Eiq 'openEuler|Euler' /etc/os-release; then
  提示 "未检测到欧拉标识，请确认目标系统兼容。"
fi

for command_name in bash unzip zip sha256sum curl env awk grep sed df cp date mkdir tee openssl tr; do
  command -v "${command_name}" >/dev/null 2>&1 || 失败 "未找到命令：${command_name}"
done
[ -f "${meta_file}" ] || 失败 "未找到包元数据。"
set -a
# shellcheck disable=SC1090
. "${meta_file}"
set +a

[ "${PACKAGE_FAMILY}" = "SP" ] || 失败 "包族不是 SP。"
[ "${PACKAGE_MODE}" = "SP-FULL" ] || 失败 "包型不是 SP-FULL。"
[ "${SOURCE_VERSION}" = "none" ] || 失败 "SP-FULL 的 SOURCE_VERSION 必须是 none。"
[ "${UPGRADE_SOURCE_POLICY:-}" = "existing-v3-install-and-migration-lineage" ] ||
  失败 "包元数据缺少受控的 V3 升级来源策略。"

(cd "${package_root}" && sha256sum -c manifest/SHA256SUMS)

for image_file in "${package_root}"/images/*.docker-image; do
  [ -f "${image_file}" ] || 失败 "未找到镜像归档：${image_file}"
done
[ -d "${package_root}/runtime/docker-bin/docker" ] || 失败 "未找到离线 Docker 运行时目录。"
compose_runtimes=()
while IFS= read -r compose_candidate; do
  compose_runtimes+=("${compose_candidate}")
done < <(find "${package_root}/runtime/compose" -maxdepth 1 -type f -name 'docker-compose-linux-*' -print)
[ "${#compose_runtimes[@]}" -eq 1 ] || 失败 "离线 Docker Compose 运行时必须且只能有一个。"
compose_runtime="${compose_runtimes[0]}"
[ -f "${package_root}/runtime/sha256sum.txt" ] || 失败 "未找到离线运行时校验文件。"
[ -d "${package_root}/database/migrations" ] || 失败 "未找到数据库迁移目录。"
[ -f "${package_root}/compose/docker-compose.yml" ] || 失败 "未找到 Compose 文件。"
[ -f "${package_root}/config/v3.env.template" ] || 失败 "未找到 v3.env 模板。"
[ -f "${package_root}/config/deploy.env.example" ] || 失败 "未找到 deploy.env 示例。"
[ -f "${package_root}/config/nginx/default.conf" ] || 失败 "未找到 Nginx 配置。"

if [ -d "${install_root}" ]; then
  提示 "检测到已有安装目录，将按升级模式保留现有配置与业务数据。"
  for required_file in \
    "${install_root}/compose/docker-compose.yml" \
    "${install_root}/compose/.env" \
    "${install_root}/config/v3.env" \
    "${install_root}/config/deploy.env" \
    "${install_root}/secrets/postgres_password" \
    "${install_root}/secrets/redis_password"; do
    [ -f "${required_file}" ] || 失败 "已有安装目录缺少关键文件：${required_file}"
  done
  current_version="$(awk -F= '$1 == "V3_IMAGE_TAG" { value=$2 } END { print value }' "${install_root}/compose/.env" 2>/dev/null | tr -d '\r')"
  [ -n "${current_version}" ] || 失败 "无法读取现有 V3_IMAGE_TAG。"
  command -v docker >/dev/null 2>&1 || 失败 "升级已有 V3 环境需要可用 Docker。"
  docker compose version >/dev/null 2>&1 || 失败 "升级已有 V3 环境需要可用 Docker Compose。"

  run_compose() {
    env -u V3_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME \
      INSTALL_ROOT="${install_root}" \
      docker compose \
      --project-directory "${install_root}/compose" \
      --env-file "${install_root}/compose/.env" \
      -f "${install_root}/compose/docker-compose.yml" \
      "$@"
  }

  run_compose config >/dev/null || 失败 "现有 Compose 配置无法展开。"
  run_compose exec -T postgres pg_isready -U lianruan_app -d lianruan_crm_v3 >/dev/null ||
    失败 "PostgreSQL 未就绪，不能执行升级。"
  migration_table_exists="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT to_regclass('migration.schema_migrations') IS NOT NULL")"
  [ "${migration_table_exists}" = "t" ] ||
    失败 "未识别到 V3 迁移谱系表 migration.schema_migrations，拒绝覆盖未知数据库。"

  unsafe_switches="$(awk -F= '
    $1 == "V3_ORGANIZATION_ENABLED" ||
    $1 == "V3_ORGANIZATION_WRITE_ENABLED" ||
    $1 == "V3_ORGANIZATION_CHANNEL_PHONE_EDIT_ENABLED" ||
    $1 == "V3_DIRECTORY_SYNC_ENABLED" ||
    $1 == "V3_ORGANIZATION_ACCOUNT_ENTRY_MERGED" ||
    $1 == "V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED" ||
    $1 == "V3_ORGANIZATION_OFFBOARDING_ENABLED" {
      if ($2 != "false") print $1 "=" $2
    }
  ' "${install_root}/config/v3.env" | tr -d '\r')"
  if [ -n "${unsafe_switches}" ]; then
    提示 "检测到发布安全开关当前不是 false：$(printf '%s' "${unsafe_switches}" | tr '\n' ' ')。执行 upgrade-sp-full.sh 时会临时关闭、完成升级验证后恢复原配置；不会自动重启服务重新启用。"
  fi

  if [ "$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT to_regclass('org.business_roles') IS NOT NULL")" = "t" ]; then
    fixed_role_conflict="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "
      SELECT EXISTS (
        SELECT 1 FROM org.business_roles
        WHERE (role_code='internal_sales' AND (role_name<>'销售' OR domain_code<>'internal' OR category<>'sales' OR status_code<>'active'))
           OR (role_code='internal_technical' AND (role_name<>'技术' OR domain_code<>'internal' OR category<>'tech_engineer' OR status_code<>'active'))
           OR (role_code='channel_sales' AND (role_name<>'销售' OR domain_code<>'channel' OR category<>'sales' OR status_code<>'active'))
           OR (role_code='channel_technical' AND (role_name<>'技术' OR domain_code<>'channel' OR category<>'tech_engineer' OR status_code<>'active'))
      )
    " | tr -d '[:space:]')"
    [ "${fixed_role_conflict}" = "f" ] ||
      失败 "销售或技术固定业务角色存在语义冲突，请先导出并人工确认，不能静默覆盖。"
  fi

  if [ "$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT to_regclass('org.staff_assignments') IS NOT NULL")" = "t" ]; then
    duplicate_active_assignment_count="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "
      SELECT count(*) FROM (
        SELECT user_id FROM org.staff_assignments
        WHERE expired_at IS NULL
        GROUP BY user_id HAVING count(*) > 1
      ) duplicate_assignment
    " | tr -d '[:space:]')"
    [ "${duplicate_active_assignment_count}" = "0" ] ||
      失败 "存在一人多条有效任职，请先导出明细并人工确认唯一任职，不能自动结束历史记录。"
  fi

  while IFS='|' read -r migration_version migration_checksum; do
    [ -n "${migration_version}" ] || continue
    migration_file="${package_root}/database/migrations/${migration_version}.sql"
    if [ ! -f "${migration_file}" ]; then
      migration_candidates=()
      while IFS= read -r migration_candidate; do
        migration_candidates+=("${migration_candidate}")
      done < <(find "${package_root}/database/migrations" -maxdepth 1 -type f -name "${migration_version}_*.sql" -print)

      [ "${#migration_candidates[@]}" -eq 1 ] ||
        失败 "现有数据库迁移不在本全量包谱系内或匹配不唯一：${migration_version}。请先进行人工评估。"
      migration_file="${migration_candidates[0]}"
    fi

    if [[ "${migration_checksum}" =~ ^[0-9a-f]{64}$ ]]; then
      package_checksum="$(sha256sum "${migration_file}" | awk '{print $1}')"
      if [ "${migration_checksum}" != "${package_checksum}" ]; then
        case "${migration_version}|${migration_checksum}|${package_checksum}" in
          "20260804_S9_017_订单审批状态机|3bb85fe599ad30cbd65a2356f11bd3898473601faa1eed161dd8f840078b98b2|b39de745a4cc198151c3690f47dd482f0b4fb78b62086e9cffa97c11b754d7d1")
            [ -f "${package_root}/database/migrations/20260825_S9_027_订单审批状态机补齐.sql" ] ||
              失败 "缺少订单审批状态机正向补齐迁移，拒绝绕过历史迁移校验。"
            提示 "历史迁移 ${migration_version} 已改写，将通过受控正向补齐迁移修复。"
            ;;
          "20260811_S9_021_商机业务编号|9aedbb3ef4d4f8c117336bb05bac05ce3368b4302a65608813ec5aab1609a4b1|423172c2a58f96dd7b3cb2e05ac5ea6470ec3af78b6e8deb5aeca23c2f0ac70c")
            registration_number_ready="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT EXISTS (SELECT 1 FROM migration.schema_migrations WHERE version = '20260812_S9_023_客户报备业务编号统一')")"
            [ "${registration_number_ready}" = "t" ] ||
              失败 "商机业务编号历史差异未被客户报备编号迁移覆盖，拒绝升级。"
            提示 "历史迁移 ${migration_version} 已由后续客户报备编号迁移覆盖。"
            ;;
          "20260811_S9_021_商机业务编号|9aedbb3ef4d4f8c117336bb05bac05ce3368b4302a65608813ec5aab1609a4b1|3cdc220200e7d3ea629af8d93789577cfd9da35b902f24a16f6a5344d094db02")
            business_number_counter_ready="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT EXISTS (SELECT 1 FROM migration.schema_migrations WHERE version = '20260812_S9_023_客户报备业务编号统一') AND EXISTS (SELECT 1 FROM migration.schema_migrations WHERE version = '20260825_S9_026_业务编号计数器兼容修正')")"
            [ "${business_number_counter_ready}" = "t" ] ||
              失败 "商机业务编号历史差异未被后续业务编号兼容迁移覆盖，拒绝升级。"
            提示 "历史迁移 ${migration_version} 已由后续客户报备编号和计数器兼容迁移覆盖。"
            ;;
          "20260820_S10_006_组织架构导入导出与自动编码|bb332cf01bec38b96ec7c5a3503656e9e831aa8f76a9999bad85d1dc14b0b308|b123929993e9412999a0e532853aad9f776fbc0a34f63eab6279ed78b3fc8039")
            [ -f "${package_root}/database/migrations/20260825_S10_007_组织架构导入导出补齐.sql" ] ||
              失败 "缺少组织架构正向补齐迁移，拒绝绕过历史迁移校验。"
            提示 "历史迁移 ${migration_version} 已改写，将通过受控正向补齐迁移修复。"
            ;;
          "20260821_M09_001_提醒任务模板与自建任务|2e8989933e49b75ee5ad11379d809879abfcc1cb170a6ca4505f1869c4680814|de2e82bc6ba3f5a72b7c87bc3a3d4cd6575ef14181919178e2146d68f2fc03dd")
            reminder_template_ready="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "SELECT to_regclass('message.reminder_templates') IS NOT NULL AND (SELECT count(*) FROM message.reminder_templates WHERE template_code IN ('m3_registration_expiring', 'm3_opportunity_expected_close', 'm3_quote_valid_until', 'm3_order_delivery_date', 'm3_opportunity_next_action', 'm1_order_approval_pending', 'm1_order_status_changed', 'm1_order_confirmed', 'm1_registration_approval_pending', 'm1_registration_approved', 'm1_registration_rejected', 'm1_quote_approval_pending', 'm1_quote_approved', 'm1_quote_rejected', 'm1_opportunity_won', 'm1_opportunity_lost', 'm1_opportunity_stage_changed', 'm1_task_failure')) = 18")"
            [ "${reminder_template_ready}" = "t" ] ||
              失败 "提醒任务模板目录未完成受控补齐，拒绝绕过历史迁移校验。"
            提示 "历史迁移 ${migration_version} 的提醒模板目录状态已核验。"
            ;;
          *)
            失败 "迁移校验不一致：${migration_version}。拒绝使用可能被改写的迁移继续升级。"
            ;;
        esac
      fi
    elif [ -n "${migration_checksum}" ]; then
      case "${migration_version}|${migration_checksum}" in
        "20260727_S8_001|由阶段8.3交付脚本和代码审查确认"|"20260727_S8_004|由阶段9交付脚本执行并记录")
          提示 "历史迁移 ${migration_version} 使用受控确认记录，已完成谱系存在性校验。"
          ;;
        *)
          失败 "迁移摘要格式不受支持：${migration_version}。拒绝绕过未知迁移校验。"
          ;;
      esac
    fi
  done < <(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -At -F '|' -c "SELECT version, COALESCE(checksum_sha256, '') FROM migration.schema_migrations ORDER BY version")

  提示 "当前已部署版本：${current_version}；V3 安装标识与数据库迁移谱系校验通过。"
else
  提示 "未检测到已有安装目录，将按全新安装模式执行。"
fi

if [ -d "${install_root}" ]; then
  docker info >/dev/null 2>&1 || 失败 "Docker 服务不可用，不能升级已有 V3 环境。"
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  提示 "Docker 可用。"
else
  提示 "未检测到可用 Docker；全新安装将由 install-runtime.sh 安装离线 Docker 运行时。"
fi

echo "SP-FULL 预检查通过。"
