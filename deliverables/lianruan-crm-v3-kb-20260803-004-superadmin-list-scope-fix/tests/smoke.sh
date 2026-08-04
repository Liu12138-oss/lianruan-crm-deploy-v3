#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-http://127.0.0.1}"

fail() {
  echo "业务自检失败：$*" >&2
  exit 1
}

check_success_api() {
  local request_path="$1"
  local body
  body="$(curl -fsS "${base_url}${request_path}")" || fail "接口不可访问：${request_path}"
  case "${body}" in
    *'"success":true'*|*'"status":"ok"'*) ;;
    *) fail "接口返回异常：${request_path}，返回：${body}" ;;
  esac
}

check_page() {
  local request_path="$1"
  local marker="$2"
  local body
  body="$(curl -fsS "${base_url}${request_path}")" || fail "页面不可访问：${request_path}"
  case "${body}" in
    *"${marker}"*) ;;
    *) fail "页面内容异常：${request_path}" ;;
  esac
}

check_success_api "/health/live"
check_success_api "/health/ready"
check_success_api "/api/v2/partners?pageSize=1"
check_success_api "/api/v2/users?pageSize=1"
check_success_api "/api/v2/quotes?pageSize=1"
check_success_api "/api/v2/orders?pageSize=1"
check_page "/" '<div id="app"'
check_page "/login" '<div id="app"'
check_page "/admin.html" "admin-app.js"
check_page "/partner.html" "partner-app.js"

echo "业务自检通过。"
