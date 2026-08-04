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

target_version="${TARGET_VERSION:-3.0.0-stage9.22.20260731-kb002}"

失败() {
  echo "验证失败：$*" >&2
  exit 1
}

[ -d "${install_root}" ] || 失败 "安装目录不存在：${install_root}"
[ -f "${install_root}/scripts/health-check.sh" ] || 失败 "未找到健康检查脚本。"

检查容器镜像() {
  local container="$1"
  local expected="$2"
  local actual
  actual="$(docker inspect -f '{{.Config.Image}}' "${container}")" || 失败 "无法读取容器镜像：${container}"
  [ "${actual}" = "${expected}" ] || 失败 "容器镜像未切换：${container} 当前为 ${actual}，预期为 ${expected}。"
}

检查健康版本() {
  local body
  body="$(curl -fsS http://127.0.0.1/health/live)" || 失败 "存活检查不可访问。"
  case "${body}" in
    *"\"版本\":\"${target_version}\""*) ;;
    *) 失败 "健康检查构建版本未更新，预期 ${target_version}，实际返回：${body}" ;;
  esac
}

检查前端资源() {
  local body
  body="$(curl -fsS http://127.0.0.1/admin-app.js)" || 失败 "前端资源不可访问：admin-app.js。"
  case "${body}" in
    *"accountRole === 'partner_admin'"*) ;;
    *) 失败 "前端资源未包含企业管理员账号角色修复。" ;;
  esac
  case "${body}" in
    *"accountRole: 'partner_admin'"*) ;;
    *) 失败 "前端资源未包含创建企业管理员入参修复。" ;;
  esac
}

检查渠道员工字段() {
  local body
  body="$(curl -fsS "http://127.0.0.1/api/v2/partners?pageSize=1")" || 失败 "渠道商接口不可访问。"
  case "${body}" in
    *'"success":true'*) ;;
    *) 失败 "渠道商接口返回异常：${body}" ;;
  esac
  case "${body}" in
    *'"data":[]'*) echo "当前无渠道商数据，跳过 staff 字段抽样。"; return ;;
  esac
  case "${body}" in
    *'"staff":'*) ;;
    *) 失败 "渠道商接口未返回 staff 字段，疑似仍在运行旧 API。" ;;
  esac
}

cd "${install_root}/compose"
export INSTALL_ROOT="${install_root}"
export V3_IMAGE_TAG="${target_version}"
检查容器镜像 "lianruan-crm-v3-api-1" "lianruan-crm-v3-api:${target_version}"
检查容器镜像 "lianruan-crm-v3-api-2" "lianruan-crm-v3-api:${target_version}"
检查容器镜像 "lianruan-crm-v3-nginx" "lianruan-crm-v3-nginx:${target_version}"
"${install_root}/scripts/health-check.sh"
curl -fsS http://127.0.0.1/health/live >/dev/null || 失败 "存活检查失败。"
curl -fsS http://127.0.0.1/health/ready >/dev/null || 失败 "就绪检查失败。"
检查健康版本
bash "${package_root}/tests/smoke.sh" "http://127.0.0.1"
检查前端资源
检查渠道员工字段

echo "验证通过。"
