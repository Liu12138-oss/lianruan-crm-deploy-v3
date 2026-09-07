#!/usr/bin/env bash
set -euo pipefail

install_root="${1:-${INSTALL_ROOT:-/opt/lianruan-crm-v3}}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "${script_dir}/.." && pwd)"
meta_file="${package_root}/manifest/包元数据.env"
set -a
# shellcheck disable=SC1090
. "${meta_file}"
set +a

run_compose() {
  env -u V3_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME \
    INSTALL_ROOT="${install_root}" \
    docker compose \
    --project-directory "${install_root}/compose" \
    --env-file "${install_root}/compose/.env" \
    -f "${install_root}/compose/docker-compose.yml" \
    "$@"
}

response_body=""
wait_for_http() {
  local check_name="$1" url="$2" attempt response
  for attempt in $(seq 1 30); do
    if response="$(curl --fail --silent --show-error --max-time 5 "${url}" 2>&1)"; then
      response_body="${response}"
      echo "${check_name}通过。"
      return 0
    fi
    sleep 2
  done
  echo "验证失败：${check_name}未在 60 秒内通过，最后响应：${response:-无}" >&2
  return 1
}

等待服务健康() {
  local service_name="$1" container_id="$2" attempt health_status
  echo "等待 ${service_name} 健康检查通过。"
  for attempt in $(seq 1 90); do
    container_id="$(run_compose --profile message --profile message-external --profile order-preapproval ps -q "${service_name}" 2>/dev/null || true)"
    if [ -n "${container_id}" ]; then
      health_status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}" 2>/dev/null || true)"
      if [ "${health_status}" = "healthy" ] || { [ -z "$(docker inspect -f '{{if .State.Health}}yes{{end}}' "${container_id}" 2>/dev/null)" ] && [ "${health_status}" = "running" ]; }; then
        return 0
      fi
    fi
    sleep 2
  done
  echo "验证失败：${service_name} 健康检查未在 180 秒内通过，最后状态：${health_status:-未知}。" >&2
  return 1
}

verify_target_service() {
  local service_name="$1" image_name="$2"
  local target_image target_image_id container_id running_image running_image_id health_status
  target_image="${image_name}:${TARGET_VERSION}"
  target_image_id="$(docker image inspect -f '{{.Id}}' "${target_image}")"
  container_id="$(run_compose --profile message --profile message-external --profile order-preapproval ps -q "${service_name}")"
  [ -n "${container_id}" ] || { echo "验证失败：服务未运行：${service_name}。" >&2; exit 1; }
  running_image="$(docker inspect -f '{{.Config.Image}}' "${container_id}")"
  running_image_id="$(docker inspect -f '{{.Image}}' "${container_id}")"
  [ "${running_image}" = "${target_image}" ] || { echo "验证失败：${service_name} 仍在使用 ${running_image}。" >&2; exit 1; }
  [ "${running_image_id}" = "${target_image_id}" ] || { echo "验证失败：${service_name} 实际镜像摘要与目标标签不一致。" >&2; exit 1; }
  等待服务健康 "${service_name}" "${container_id}" || exit 1
  echo "${service_name} 目标镜像与运行状态通过。"
}

验证运行中发布安全开关() {
  local service_name container_id container_env key value
  local -a services=(api-1 api-2 worker)
  local -a switches=(
    V3_ORGANIZATION_ENABLED
    V3_ORGANIZATION_WRITE_ENABLED
    V3_ORGANIZATION_CHANNEL_PHONE_EDIT_ENABLED
    V3_DIRECTORY_SYNC_ENABLED
    V3_ORGANIZATION_ACCOUNT_ENTRY_MERGED
    V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED
    V3_ORGANIZATION_OFFBOARDING_ENABLED
  )
  if [ "$(awk -F= '$1 == "MESSAGE_WORKER_ENABLED" { value=$2 } END { print value }' "${install_root}/config/v3.env" | tr -d '\r')" = "true" ]; then
    services+=(worker-message-critical worker-message-maintenance worker-message-integration)
  fi
  if [ "$(awk -F= '$1 == "ORDER_PREAPPROVAL_WORKER_ENABLED" { value=$2 } END { print value }' "${install_root}/config/v3.env" | tr -d '\r')" = "true" ]; then
    services+=(worker-order-preapproval)
  fi
  for service_name in "${services[@]}"; do
    container_id="$(run_compose --profile message --profile message-external --profile order-preapproval ps -q "${service_name}")"
    [ -n "${container_id}" ] || { echo "验证失败：未找到 ${service_name} 容器。" >&2; exit 1; }
    container_env="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "${container_id}")"
    for key in "${switches[@]}"; do
      value="$(printf '%s\n' "${container_env}" | awk -F= -v key="${key}" '$1 == key { value=$2 } END { print value }' | tr -d '\r')"
      [ "${value}" = "false" ] || {
        echo "验证失败：${service_name} 的 ${key} 实际值为 ${value:-未设置}，升级验证期间必须为 false。" >&2
        exit 1
      }
    done
  done
  echo "运行中的 7 项发布安全开关均为 false。"
}

current_version="$(awk -F= '$1 == "V3_IMAGE_TAG" { value=$2 } END { print value }' "${install_root}/compose/.env" | tr -d '\r')"
[ "${current_version}" = "${TARGET_VERSION}" ] || {
  echo "验证失败：当前镜像版本为 ${current_version:-未设置}，预期 ${TARGET_VERSION}。" >&2
  exit 1
}

compose_output="$(run_compose config)"
for image_name in lianruan-crm-v3-api lianruan-crm-v3-worker lianruan-crm-v3-nginx; do
  case "${compose_output}" in
    *"${image_name}:${TARGET_VERSION}"*) ;;
    *) echo "验证失败：Compose 未引用目标镜像 ${image_name}:${TARGET_VERSION}。" >&2; exit 1 ;;
  esac
done

verify_target_service api-1 lianruan-crm-v3-api
verify_target_service api-2 lianruan-crm-v3-api
verify_target_service worker lianruan-crm-v3-worker
verify_target_service nginx lianruan-crm-v3-nginx
if [ "$(awk -F= '$1 == "MESSAGE_WORKER_ENABLED" { value=$2 } END { print value }' "${install_root}/config/v3.env" | tr -d '\r')" = "true" ]; then
  verify_target_service worker-message-critical lianruan-crm-v3-worker
  verify_target_service worker-message-maintenance lianruan-crm-v3-worker
  verify_target_service worker-message-integration lianruan-crm-v3-worker
fi
if [ "$(awk -F= '$1 == "ORDER_PREAPPROVAL_WORKER_ENABLED" { value=$2 } END { print value }' "${install_root}/config/v3.env" | tr -d '\r')" = "true" ]; then
  verify_target_service worker-order-preapproval lianruan-crm-v3-worker
fi

验证运行中发布安全开关

organization_migration_count="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "
  SELECT count(*)
  FROM migration.schema_migrations
  WHERE version IN (
    '20260827_S10_009_渠道成员统一业务角色',
    '20260827_S10_010_任职编辑一致性修正',
    '20260827_S10_011_组织成员一致性与交接授权留痕'
  )
" | tr -d '[:space:]')"
[ "${organization_migration_count}" = "3" ] || {
  echo "验证失败：S10_009、S10_010、S10_011 迁移账本未全部登记。" >&2
  exit 1
}
s10_009_file="${package_root}/database/migrations/20260827_S10_009_渠道成员统一业务角色.sql"
s10_010_file="${package_root}/database/migrations/20260827_S10_010_任职编辑一致性修正.sql"
s10_011_file="${package_root}/database/migrations/20260827_S10_011_组织成员一致性与交接授权留痕.sql"
[ -f "${s10_009_file}" ] && [ -f "${s10_010_file}" ] && [ -f "${s10_011_file}" ] || {
  echo "验证失败：升级包缺少 S10_009、S10_010 或 S10_011 正向迁移文件。" >&2
  exit 1
}
s10_009_checksum="$(sha256sum "${s10_009_file}" | awk '{print $1}')"
s10_010_checksum="$(sha256sum "${s10_010_file}" | awk '{print $1}')"
s10_011_checksum="$(sha256sum "${s10_011_file}" | awk '{print $1}')"
organization_migration_checksum_ready="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "
  SELECT count(*) = 3
  FROM migration.schema_migrations
  WHERE (version='20260827_S10_009_渠道成员统一业务角色' AND checksum_sha256='${s10_009_checksum}')
     OR (version='20260827_S10_010_任职编辑一致性修正' AND checksum_sha256='${s10_010_checksum}')
     OR (version='20260827_S10_011_组织成员一致性与交接授权留痕' AND checksum_sha256='${s10_011_checksum}')
" | tr -d '[:space:]')"
[ "${organization_migration_checksum_ready}" = "t" ] || {
  echo "验证失败：S10_009、S10_010 或 S10_011 迁移账本摘要与升级包不一致。" >&2
  exit 1
}
organization_schema_ready="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "
  SELECT
    (SELECT count(*) = 4
       FROM information_schema.columns
      WHERE table_schema='channel'
        AND table_name='partner_members'
        AND column_name IN ('row_version','updated_at','archived_at','archive_reason'))
    AND to_regclass('org.ux_staff_assignments_user_single_active') IS NOT NULL
    AND to_regprocedure('org.assert_assignment_consistent(uuid)') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid='org.staff_assignments'::regclass
        AND tgname='trg_staff_assignments_consistency' AND NOT tgisinternal
    )
    AND to_regclass('org.ux_member_certifications_user_template_active') IS NOT NULL
    AND to_regclass('org.offboarding_role_snapshots') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid='org.member_business_roles'::regclass
        AND tgname='trg_member_business_roles_reject_auto_certification' AND NOT tgisinternal
    )
    AND NOT EXISTS (
      SELECT 1 FROM org.staff_assignments
      WHERE expired_at IS NULL
      GROUP BY user_id HAVING count(*) > 1
    )
    AND (SELECT count(*) = 4 FROM org.business_roles
         WHERE (role_code='internal_sales' AND role_name='销售' AND domain_code='internal' AND category='sales' AND status_code='active')
            OR (role_code='internal_technical' AND role_name='技术' AND domain_code='internal' AND category='tech_engineer' AND status_code='active')
            OR (role_code='channel_sales' AND role_name='销售' AND domain_code='channel' AND category='sales' AND status_code='active')
            OR (role_code='channel_technical' AND role_name='技术' AND domain_code='channel' AND category='tech_engineer' AND status_code='active'))
" | tr -d '[:space:]')"
[ "${organization_schema_ready}" = "t" ] || {
  echo "验证失败：渠道成员统一档案、固定业务角色、任职/证书约束或交接角色快照未就绪。" >&2
  exit 1
}

s10_018_file="${package_root}/database/migrations/20260907_S10_018_客户报备业务编号函数补齐.sql"
s10_019_file="${package_root}/database/migrations/20260907_S10_019_企微身份用户唯一约束.sql"
[ -f "${s10_018_file}" ] && [ -f "${s10_019_file}" ] || {
  echo "验证失败：升级包缺少客户报备编号修复或企业微信身份唯一约束迁移。" >&2
  exit 1
}
s10_018_checksum="$(sha256sum "${s10_018_file}" | awk '{print $1}')"
s10_019_checksum="$(sha256sum "${s10_019_file}" | awk '{print $1}')"
current_fix_migrations_ready="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "
  SELECT count(*) = 2
  FROM migration.schema_migrations
  WHERE (version='20260907_S10_018_客户报备业务编号函数补齐' AND checksum_sha256='${s10_018_checksum}')
     OR (version='20260907_S10_019_企微身份用户唯一约束' AND checksum_sha256='${s10_019_checksum}')
" | tr -d '[:space:]')"
[ "${current_fix_migrations_ready}" = "t" ] || {
  echo "验证失败：客户报备编号修复或企业微信身份唯一约束迁移账本未正确登记。" >&2
  exit 1
}
business_number_function_ready="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "
  SELECT to_regprocedure('crm.next_business_number(text,text)') IS NOT NULL
     AND pg_get_functiondef('crm.next_business_number(text,text)'::regprocedure) LIKE '%registration%'
" | tr -d '[:space:]')"
[ "${business_number_function_ready}" = "t" ] || {
  echo "验证失败：客户报备业务编号函数未恢复 registration 支持。" >&2
  exit 1
}
wecom_identity_constraint_ready="$(run_compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tAc "
  SELECT to_regclass('iam.ux_external_identities_wecom_user_active') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM iam.external_identities
       WHERE provider_code='wecom' AND status_code='active'
       GROUP BY user_id HAVING count(*) > 1
     )
" | tr -d '[:space:]')"
[ "${wecom_identity_constraint_ready}" = "t" ] || {
  echo "验证失败：企业微信有效身份用户唯一约束或历史数据校验未通过。" >&2
  exit 1
}

env -u V3_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME INSTALL_ROOT="${install_root}" bash "${install_root}/scripts/health-check.sh"
wait_for_http "/health/live" http://127.0.0.1/health/live
for required_text in '"success":true' '"status":"ok"' "\"版本\":\"${TARGET_VERSION}\""; do
  case "${response_body}" in *"${required_text}"*) ;; *) echo "验证失败：/health/live 缺少 ${required_text}。" >&2; exit 1 ;; esac
done
wait_for_http "/health/ready" http://127.0.0.1/health/ready
case "${response_body}" in *'"success":true'*'"status":"ok"'*) ;; *) echo "验证失败：/health/ready 不是健康 API JSON。" >&2; exit 1 ;; esac
wait_for_http "IAM 配置接口" http://127.0.0.1/api/auth/sso/iam/config
case "${response_body}" in *'"enabled":true'*) ;; *) echo "验证失败：IAM 配置接口未返回 enabled:true。" >&2; exit 1 ;; esac
for required_field in entries requestIsaidByEntry timeoutMs; do
  case "${response_body}" in *"\"${required_field}\""*) ;; *) echo "验证失败：IAM 配置接口缺少 ${required_field}。" >&2; exit 1 ;; esac
done
wait_for_http "/login" http://127.0.0.1/login
wait_for_http "/admin.html" http://127.0.0.1/admin.html
admin_html_body="${response_body}"
admin_app_ref="$(printf '%s\n' "${admin_html_body}" | sed -n 's/.*src="\([^"]*admin-app\.js?v=[^"]*\)".*/\1/p')"
admin_style_ref="$(printf '%s\n' "${admin_html_body}" | sed -n 's/.*href="\([^"]*style\.css?v=[^"]*\)".*/\1/p')"
[ -n "${admin_app_ref}" ] && [ -n "${admin_style_ref}" ] || {
  echo "验证失败：正式 admin.html 未找到带版本号的 admin-app.js 或 style.css 引用。" >&2
  exit 1
}
case "${admin_app_ref}${admin_style_ref}" in
  *$'\n'*) echo "验证失败：正式 admin.html 的静态资源版本引用不唯一。" >&2; exit 1 ;;
esac
wait_for_http "${admin_app_ref}" "http://127.0.0.1/${admin_app_ref}"
admin_script_text="${response_body}"
wait_for_http "${admin_style_ref}" "http://127.0.0.1/${admin_style_ref}"
case "${admin_script_text}" in
  *"组织架构"*"router.push('/organization/units')"*) ;;
  *) echo "验证失败：正式 admin-app.js 缺少组织架构内嵌入口。" >&2; exit 1 ;;
esac
case "${admin_script_text}" in
  *"{ path: 'organization/units', component: OrganizationWorkspace }"*) ;;
  *) echo "验证失败：正式 admin-app.js 缺少组织架构内嵌路由。" >&2; exit 1 ;;
esac
case "${admin_script_text}" in
  *"/api/org/status"*"只读观察"*) ;;
  *) echo "验证失败：正式 admin-app.js 缺少组织状态与只读观察逻辑。" >&2; exit 1 ;;
esac
case "${admin_script_text}" in
  *"企业微信账号映射导入"*) ;;
  *) echo "验证失败：正式 admin-app.js 缺少企业微信身份映射导入页面。" >&2; exit 1 ;;
esac
case "${admin_script_text}" in
  *"/api/org/wecom-identities/import-preview"*) ;;
  *) echo "验证失败：正式 admin-app.js 缺少企业微信身份映射预览接口。" >&2; exit 1 ;;
esac
case "${admin_script_text}" in
  *"/api/org/wecom-identities/import-confirm"*) ;;
  *) echo "验证失败：正式 admin-app.js 缺少企业微信身份映射确认接口。" >&2; exit 1 ;;
esac
wait_for_http "组织架构工作区" http://127.0.0.1/workspace/admin/platform-admin/organization/units
case "${response_body}" in
  *'id="app"'*) ;;
  *) echo "验证失败：组织架构工作区未由当前 Nginx 静态产物提供。" >&2; exit 1 ;;
esac

echo "SP-FULL 验证通过：${TARGET_VERSION}。"
