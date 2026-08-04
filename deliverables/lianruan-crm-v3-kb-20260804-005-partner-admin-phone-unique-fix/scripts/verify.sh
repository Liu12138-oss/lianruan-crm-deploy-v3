#!/usr/bin/env bash
set -euo pipefail

install_root="${1:-${INSTALL_ROOT:-/opt/lianruan-crm-v3}}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "${script_dir}/.." && pwd)"
meta_file="${package_root}/manifest/KB元数据.env"

if [ -f "${meta_file}" ]; then
  set -a
  . "${meta_file}"
  set +a
fi

version_tag="${TARGET_VERSION:-3.0.0-stage9.27.20260804-kb005}"

fail() {
  echo "验证失败：$*" >&2
  exit 1
}

check_container_image() {
  local container_name="$1"
  local expected_image="$2"
  local seen_image
  seen_image="$(docker inspect -f '{{.Config.Image}}' "${container_name}")" || fail "无法读取容器镜像：${container_name}"
  [ "${seen_image}" = "${expected_image}" ] || fail "容器镜像未切换：${container_name} 当前为 ${seen_image}，预期为 ${expected_image}。"
}

check_health_version() {
  local body
  body="$(curl -fsS http://127.0.0.1/health/live)" || fail "存活检查不可访问。"
  case "${body}" in
    *"\"版本\":\"${version_tag}\""*) ;;
    *) fail "健康检查构建版本未更新，预期 ${version_tag}，实际返回：${body}" ;;
  esac
}

check_phone_index() {
  local index_count
  index_count="$(docker compose exec -T postgres psql -U lianruan_app -d lianruan_crm_v3 -tA -c "
    SELECT COUNT(*)
    FROM pg_indexes
    WHERE schemaname = 'iam'
      AND indexname = 'ux_users_phone_normalized_unique';
  ")" || fail "无法检查账号联系电话唯一索引。"
  [ "${index_count}" = "1" ] || fail "账号联系电话唯一索引未生效。"
}

[ -d "${install_root}" ] || fail "安装目录不存在：${install_root}"
[ -f "${install_root}/scripts/health-check.sh" ] || fail "未找到健康检查脚本。"

cd "${install_root}/compose"
export INSTALL_ROOT="${install_root}"
export V3_IMAGE_TAG="${version_tag}"

check_container_image "lianruan-crm-v3-api-1" "lianruan-crm-v3-api:${version_tag}"
check_container_image "lianruan-crm-v3-api-2" "lianruan-crm-v3-api:${version_tag}"
check_container_image "lianruan-crm-v3-worker" "lianruan-crm-v3-worker:${version_tag}"
check_container_image "lianruan-crm-v3-nginx" "lianruan-crm-v3-nginx:${version_tag}"
"${install_root}/scripts/health-check.sh"
curl -fsS http://127.0.0.1/health/live >/dev/null || fail "存活检查失败。"
curl -fsS http://127.0.0.1/health/ready >/dev/null || fail "就绪检查失败。"
check_health_version
check_phone_index
bash "${package_root}/tests/smoke.sh" "http://127.0.0.1"

echo "验证通过。"
