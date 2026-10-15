#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-http://127.0.0.1}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "${script_dir}/.." && pwd)"
set -a
# shellcheck disable=SC1090
. "${package_root}/manifest/包元数据.env"
set +a

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
  echo "冒烟失败：${check_name}未在 60 秒内通过，最后响应：${response:-无}" >&2
  return 1
}

wait_for_http "/health/live" "${base_url}/health/live"
for required_text in '"success":true' '"status":"ok"' "\"版本\":\"${TARGET_VERSION}\""; do
  case "${response_body}" in *"${required_text}"*) ;; *) echo "冒烟失败：/health/live 缺少 ${required_text}。" >&2; exit 1 ;; esac
done
wait_for_http "/health/ready" "${base_url}/health/ready"
case "${response_body}" in *'"success":true'*'"status":"ok"'*) ;; *) echo "冒烟失败：/health/ready 不是健康 API JSON。" >&2; exit 1 ;; esac
wait_for_http "IAM 配置接口" "${base_url}/api/auth/sso/iam/config"
case "${response_body}" in *'"enabled":true'*) ;; *) echo "冒烟失败：IAM 配置接口未返回 enabled:true。" >&2; exit 1 ;; esac
for required_field in entries requestIsaidByEntry timeoutMs; do
  case "${response_body}" in *"\"${required_field}\""*) ;; *) echo "冒烟失败：IAM 配置接口缺少 ${required_field}。" >&2; exit 1 ;; esac
done
wait_for_http "/login" "${base_url}/login"
# 统一入口：旧桌面入口必须 301 到重构后的正式路由，正式路由必须由新应用入口提供
admin_entry_headers="$(curl --silent --show-error --max-time 5 -o /dev/null -D - "${base_url}/admin.html")"
case "${admin_entry_headers}" in
  *" 301 "*|*" 302 "*) ;;
  *) echo "冒烟失败：/admin.html 未按统一入口规则重定向。" >&2; exit 1 ;;
esac
case "${admin_entry_headers}" in
  *"ocation: /admin"*|*"ocation: ${base_url}/admin"*) ;;
  *) echo "冒烟失败：/admin.html 未重定向到 /admin。" >&2; exit 1 ;;
esac
wait_for_http "/admin" "${base_url}/admin"
case "${response_body}" in *'id="app"'*) ;; *) echo "冒烟失败：/admin 未返回重构后的应用入口。" >&2; exit 1 ;; esac
admin_entry_bundle="$(printf '%s\n' "${response_body}" | sed -n 's/.*src="\([^"]*assets\/index-[^"]*\.js\)".*/\1/p')"
[ -n "${admin_entry_bundle}" ] || { echo "冒烟失败：/admin 未找到入口资源 assets/index-*.js。" >&2; exit 1; }
wait_for_http "${admin_entry_bundle}" "${base_url}/${admin_entry_bundle}"
wait_for_http "组织架构工作区" "${base_url}/workspace/admin/platform-admin/organization/units"
case "${response_body}" in *'id="app"'*) ;; *) echo "冒烟失败：组织架构工作区未由当前静态产物提供。" >&2; exit 1 ;; esac
echo "业务冒烟通过。"
