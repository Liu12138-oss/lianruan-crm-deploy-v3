#!/usr/bin/env bash
set -euo pipefail

install_root="${1:-${INSTALL_ROOT:-/opt/lianruan-crm-v3}}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "${script_dir}/.." && pwd)"
meta_file="${package_root}/manifest/包元数据.env"

失败() {
  echo "预检查失败：$*" >&2
  exit 1
}

提示() {
  echo "预检查：$*"
}

run_compose() {
  env -u V3_IMAGE_TAG -u COMPOSE_FILE -u COMPOSE_PROJECT_NAME \
    INSTALL_ROOT="${install_root}" \
    docker compose \
    --project-directory "${install_root}/compose" \
    --env-file "${install_root}/compose/.env" \
    -f "${install_root}/compose/docker-compose.yml" \
    "$@"
}

读取配置值() {
  local config_file="$1" key="$2"
  awk -F= -v key="${key}" '$1 == key { value=substr($0, length(key) + 2) } END { print value }' "${config_file}" | tr -d '\r'
}

[ "$(id -u)" -eq 0 ] || 失败 "请使用 root 或 sudo 执行。"
[ "$(uname -m)" = "x86_64" ] || 失败 "当前架构不是 x86_64。"
if [ -f /etc/os-release ] && ! grep -Eiq 'openEuler|Euler' /etc/os-release; then
  提示 "未检测到欧拉标识，请确认目标系统兼容。"
fi

for command_name in bash unzip zip sha256sum docker curl env awk grep sed df cp date mkdir tee openssl tr; do
  command -v "${command_name}" >/dev/null 2>&1 || 失败 "未找到命令：${command_name}"
done
docker compose version >/dev/null 2>&1 || 失败 "未找到可用 Docker Compose。"
[ -f "${meta_file}" ] || 失败 "未找到包元数据。"
set -a
# shellcheck disable=SC1090
. "${meta_file}"
set +a

[ -d "${install_root}" ] || 失败 "安装目录不存在：${install_root}"
[ -f "${install_root}/compose/docker-compose.yml" ] || 失败 "未找到现有 Compose 文件。"
[ -f "${install_root}/compose/.env" ] || 失败 "未找到现有 Compose 变量文件。"
[ -f "${install_root}/config/v3.env" ] || 失败 "未找到现有 V3 配置。"
[ -f "${install_root}/config/deploy.env" ] || 失败 "未找到现有部署配置。"
[ -f "${install_root}/secrets/postgres_password" ] || 失败 "未找到 PostgreSQL 密钥文件。"
[ -f "${install_root}/secrets/redis_password" ] || 失败 "未找到 Redis 密钥文件。"

organization_enabled="$(awk -F= '$1 == "V3_ORGANIZATION_ENABLED" { value=$2 } END { print value }' "${install_root}/config/v3.env" | tr -d '\r')"
organization_write_enabled="$(awk -F= '$1 == "V3_ORGANIZATION_WRITE_ENABLED" { value=$2 } END { print value }' "${install_root}/config/v3.env" | tr -d '\r')"
directory_sync_enabled="$(awk -F= '$1 == "V3_DIRECTORY_SYNC_ENABLED" { value=$2 } END { print value }' "${install_root}/config/v3.env" | tr -d '\r')"
account_entry_merged="$(awk -F= '$1 == "V3_ORGANIZATION_ACCOUNT_ENTRY_MERGED" { value=$2 } END { print value }' "${install_root}/config/v3.env" | tr -d '\r')"
account_status_check_enabled="$(awk -F= '$1 == "V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED" { value=$2 } END { print value }' "${install_root}/config/v3.env" | tr -d '\r')"
offboarding_enabled="$(awk -F= '$1 == "V3_ORGANIZATION_OFFBOARDING_ENABLED" { value=$2 } END { print value }' "${install_root}/config/v3.env" | tr -d '\r')"
[ "${organization_enabled}" = "false" ] ||
  失败 "发布前组织总开关必须保持 false；完成新版本和服务器静态资源验证后，再单独开启只读观察。"
[ "${organization_write_enabled}" = "false" ] ||
  失败 "组织写入开关必须保持 false，本包仅允许交付只读观察能力。"
[ "${directory_sync_enabled}" = "false" ] ||
  失败 "企微目录同步开关必须保持 false，本包不启用真实同步。"
[ "${account_entry_merged}" = "false" ] ||
  失败 "账号入口整合开关必须保持 false，完成新旧入口能力对照后再单独开启。"
[ "${account_status_check_enabled}" = "false" ] ||
  失败 "首次发布前账号状态防护必须保持 false，完成新版本登录回归后再独立灰度。"
[ "${offboarding_enabled}" = "false" ] ||
  失败 "停用归档与交接执行开关必须保持 false，专项验收和回退演练通过后才能单独评审。"

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

current_version="$(读取配置值 "${install_root}/compose/.env" V3_IMAGE_TAG)"
[ -n "${current_version}" ] || 失败 "无法读取当前 V3_IMAGE_TAG。"
deploy_version="$(读取配置值 "${install_root}/config/deploy.env" V3_IMAGE_TAG)"
[ "${deploy_version}" = "${current_version}" ] || 失败 "Compose 与部署变量版本不一致：${current_version} / ${deploy_version:-未设置}。"
if [ "${current_version}" != "${SOURCE_VERSION}" ] && [ "${current_version}" != "${TARGET_VERSION}" ]; then
  失败 "当前版本 ${current_version} 不允许升级；仅允许从 ${SOURCE_VERSION} 升级或复核 ${TARGET_VERSION}。"
fi

for image_file in "${package_root}"/images/*.docker-image; do
  [ -f "${image_file}" ] || 失败 "未找到业务镜像归档。"
done

(cd "${package_root}" && sha256sum -c manifest/SHA256SUMS)
compose_output="$(run_compose config)"
[ -n "${compose_output}" ] || 失败 "Compose 展开结果为空。"
run_compose ps >/dev/null

校验运行服务() {
  local service_name="$1" expected_image="$2" expected_image_id="$3"
  local container_id running_image running_image_id
  container_id="$(run_compose --profile message --profile message-external ps -q "${service_name}")"
  [ -n "${container_id}" ] || 失败 "服务未运行：${service_name}。"
  running_image="$(docker inspect -f '{{.Config.Image}}' "${container_id}")"
  running_image_id="$(docker inspect -f '{{.Image}}' "${container_id}")"
  [ "${running_image}" = "${expected_image}" ] || 失败 "${service_name} 实际镜像不匹配：${running_image}，预期 ${expected_image}。"
  [ "${running_image_id}" = "${expected_image_id}" ] || 失败 "${service_name} 实际镜像摘要不匹配：${running_image_id}。"
  [ "$(docker image inspect -f '{{.Id}}' "${expected_image}")" = "${expected_image_id}" ] || 失败 "${service_name} 源镜像标签与摘要不匹配。"
}

if [ "${current_version}" = "${SOURCE_VERSION}" ]; then
  校验运行服务 api-1 "${SOURCE_API_IMAGE}" "${SOURCE_API_IMAGE_ID}"
  校验运行服务 api-2 "${SOURCE_API_IMAGE}" "${SOURCE_API_IMAGE_ID}"
  校验运行服务 worker "${SOURCE_WORKER_IMAGE}" "${SOURCE_WORKER_IMAGE_ID}"
  校验运行服务 nginx "${SOURCE_NGINX_IMAGE}" "${SOURCE_NGINX_IMAGE_ID}"
  if [ "$(读取配置值 "${install_root}/config/v3.env" MESSAGE_WORKER_ENABLED)" = "true" ]; then
    校验运行服务 worker-message-critical "${SOURCE_WORKER_IMAGE}" "${SOURCE_WORKER_IMAGE_ID}"
    校验运行服务 worker-message-maintenance "${SOURCE_WORKER_IMAGE}" "${SOURCE_WORKER_IMAGE_ID}"
    校验运行服务 worker-message-integration "${SOURCE_WORKER_IMAGE}" "${SOURCE_WORKER_IMAGE_ID}"
  fi
  提示 "已确认测试环境混合基线：API=${SOURCE_API_IMAGE}，Worker=${SOURCE_WORKER_IMAGE}，Nginx=${SOURCE_NGINX_IMAGE}。"
else
  target_api_image="lianruan-crm-v3-api:${TARGET_VERSION}"
  target_worker_image="lianruan-crm-v3-worker:${TARGET_VERSION}"
  target_nginx_image="lianruan-crm-v3-nginx:${TARGET_VERSION}"
  target_api_image_id="$(docker image inspect -f '{{.Id}}' "${target_api_image}")"
  target_worker_image_id="$(docker image inspect -f '{{.Id}}' "${target_worker_image}")"
  target_nginx_image_id="$(docker image inspect -f '{{.Id}}' "${target_nginx_image}")"
  校验运行服务 api-1 "${target_api_image}" "${target_api_image_id}"
  校验运行服务 api-2 "${target_api_image}" "${target_api_image_id}"
  校验运行服务 worker "${target_worker_image}" "${target_worker_image_id}"
  校验运行服务 nginx "${target_nginx_image}" "${target_nginx_image_id}"
fi

available_kb="$(df -Pk "${install_root}" | awk 'NR == 2 { print $4 }')"
[ "${available_kb:-0}" -ge 8388608 ] || 失败 "可用磁盘空间不足 8GiB。"
提示 "通过。当前版本：${current_version}，目标版本：${TARGET_VERSION}。"
