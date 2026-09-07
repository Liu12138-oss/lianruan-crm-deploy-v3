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
wait_for_http "/admin.html" "${base_url}/admin.html"
admin_html="${response_body}"
admin_app_ref="$(printf '%s\n' "${admin_html}" | sed -n 's/.*src="\([^"]*admin-app\.js?v=[^"]*\)".*/\1/p')"
admin_style_ref="$(printf '%s\n' "${admin_html}" | sed -n 's/.*href="\([^"]*style\.css?v=[^"]*\)".*/\1/p')"
[ -n "${admin_app_ref}" ] && [ -n "${admin_style_ref}" ] || {
  echo "冒烟失败：正式 admin.html 未找到带版本号的 admin-app.js 或 style.css 引用。" >&2
  exit 1
}
case "${admin_app_ref}${admin_style_ref}" in
  *$'\n'*) echo "冒烟失败：正式 admin.html 的静态资源版本引用不唯一。" >&2; exit 1 ;;
esac
wait_for_http "${admin_app_ref}" "${base_url}/${admin_app_ref}"
admin_script="${response_body}"
wait_for_http "${admin_style_ref}" "${base_url}/${admin_style_ref}"
case "${admin_script}" in *"组织架构"*) ;; *) echo "冒烟失败：管理员页面缺少组织架构入口。" >&2; exit 1 ;; esac
case "${admin_script}" in *"router.push('/organization/units')"*) ;; *) echo "冒烟失败：组织架构入口未内嵌到管理员页面。" >&2; exit 1 ;; esac
case "${admin_script}" in *"{ path: 'organization/units', component: OrganizationWorkspace }"*) ;; *) echo "冒烟失败：管理员页面缺少组织架构内嵌路由。" >&2; exit 1 ;; esac
case "${admin_script}" in *"/api/org/status"*) ;; *) echo "冒烟失败：管理员页面缺少组织状态读取逻辑。" >&2; exit 1 ;; esac
case "${admin_script}" in *"只读观察"*) ;; *) echo "冒烟失败：管理员页面缺少组织只读观察状态。" >&2; exit 1 ;; esac
case "${admin_script}" in
  *"企业微信账号映射导入"*"/api/org/wecom-identities/import-preview"*"/api/org/wecom-identities/import-confirm"*) ;;
  *) echo "冒烟失败：管理员页面缺少企业微信身份映射受控导入入口。" >&2; exit 1 ;;
esac
wait_for_http "组织架构工作区" "${base_url}/workspace/admin/platform-admin/organization/units"
case "${response_body}" in *'id="app"'*) ;; *) echo "冒烟失败：组织架构工作区未由当前静态产物提供。" >&2; exit 1 ;; esac
case "${admin_script}" in *"统一消息"*|*"企业微信"*) ;; *) echo "冒烟失败：管理员页面缺少统一消息管理能力。" >&2; exit 1 ;; esac
echo "业务冒烟通过。"
