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

target_version="${TARGET_VERSION:-3.0.0-stage9.23.20260803-kb001}"

fail() {
  echo "验证失败：$*" >&2
  exit 1
}

[ -d "${install_root}" ] || fail "安装目录不存在：${install_root}"
[ -f "${install_root}/scripts/health-check.sh" ] || fail "未找到健康检查脚本。"

check_container_image() {
  local container_name="$1"
  local expected_image="$2"
  local actual_image
  actual_image="$(docker inspect -f '{{.Config.Image}}' "${container_name}")" || fail "无法读取容器镜像：${container_name}"
  [ "${actual_image}" = "${expected_image}" ] || fail "容器镜像未切换：${container_name} 当前为 ${actual_image}，预期为 ${expected_image}。"
}

check_health_version() {
  local body
  body="$(curl -fsS http://127.0.0.1/health/live)" || fail "存活检查不可访问。"
  case "${body}" in
    *"\"版本\":\"${target_version}\""*) ;;
    *) fail "健康检查构建版本未更新，预期 ${target_version}，实际返回：${body}" ;;
  esac
}

check_spa_entry() {
  local request_path="$1"
  local http_status
  local body
  http_status="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1${request_path}")" || fail "入口不可访问：${request_path}"
  [ "${http_status}" = "200" ] || fail "入口状态异常：${request_path} 返回 ${http_status}，预期 200。"
  body="$(curl -fsS "http://127.0.0.1${request_path}")" || fail "入口内容不可读取：${request_path}"
  case "${body}" in
    *'<div id="app"'*|*"assets/index-"*) ;;
    *) fail "入口未返回 V3 工程化页面：${request_path}" ;;
  esac
}

check_iam_config() {
  local body
  body="$(curl -fsS http://127.0.0.1/api/auth/sso/iam/config)" || fail "IAM 单点登录配置接口不可访问。"
  case "${body}" in
    *'"success":true'*) ;;
    *) fail "IAM 单点登录配置接口返回异常：${body}" ;;
  esac
  case "${body}" in
    *"QdCRMguanlyuan123"*) ;;
    *) fail "管理员单点登录请求标识未返回。" ;;
  esac
  case "${body}" in
    *"QdCRMkeduduan123"*) ;;
    *) fail "渠道端单点登录请求标识未返回。" ;;
  esac
}

cd "${install_root}/compose"
export INSTALL_ROOT="${install_root}"
export V3_IMAGE_TAG="${target_version}"

check_container_image "lianruan-crm-v3-api-1" "lianruan-crm-v3-api:${target_version}"
check_container_image "lianruan-crm-v3-api-2" "lianruan-crm-v3-api:${target_version}"
check_container_image "lianruan-crm-v3-nginx" "lianruan-crm-v3-nginx:${target_version}"
"${install_root}/scripts/health-check.sh"
curl -fsS http://127.0.0.1/health/live >/dev/null || fail "存活检查失败。"
curl -fsS http://127.0.0.1/health/ready >/dev/null || fail "就绪检查失败。"
check_health_version
bash "${package_root}/tests/smoke.sh" "http://127.0.0.1"
check_spa_entry "/"
check_spa_entry "/login"
check_spa_entry "/admin"
check_spa_entry "/partner"
check_iam_config

echo "验证通过。"
