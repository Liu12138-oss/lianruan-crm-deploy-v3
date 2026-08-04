#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-http://127.0.0.1}"

失败() {
  echo "业务自检失败：$*" >&2
  exit 1
}

检查接口() {
  local path="$1"
  local body
  body="$(curl -fsS "${base_url}${path}")" || 失败 "接口不可访问：${path}"
  case "${body}" in
    *'"success":true'*|*'"status":"ok"'*) ;;
    *) 失败 "接口返回异常：${path}" ;;
  esac
}

检查接口 "/health/live"
检查接口 "/api/v2/partners?pageSize=1"
检查接口 "/api/v2/users?pageSize=1"

partners_body="$(curl -fsS "${base_url}/api/v2/partners?pageSize=1")" || 失败 "渠道商接口不可访问。"
case "${partners_body}" in
  *'"data":[]'*) ;;
  *'"staff":'*) ;;
  *) 失败 "渠道商接口未返回 staff 字段。" ;;
esac

admin_app_body="$(curl -fsS "${base_url}/admin-app.js")" || 失败 "前端资源不可访问：admin-app.js。"
case "${admin_app_body}" in
  *"removePartnerStaffFromList"*) ;;
  *) 失败 "前端资源未包含渠道商员工删除同步修复。" ;;
esac

case "${admin_app_body}" in
  *"accountRole === 'partner_admin'"*) ;;
  *) 失败 "前端资源未包含企业管理员账号角色修复。" ;;
esac

echo "业务自检通过。"
