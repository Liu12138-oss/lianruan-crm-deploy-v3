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

check_spa_entry() {
  local request_path="$1"
  local http_status
  local body
  http_status="$(curl -sS -o /dev/null -w '%{http_code}' "${base_url}${request_path}")" || fail "入口不可访问：${request_path}"
  [ "${http_status}" = "200" ] || fail "入口状态异常：${request_path} 返回 ${http_status}，预期 200。"
  body="$(curl -fsS "${base_url}${request_path}")" || fail "入口内容不可读取：${request_path}"
  case "${body}" in
    *'<div id="app"'*|*"assets/index-"*) ;;
    *) fail "入口未返回 V3 工程化页面：${request_path}" ;;
  esac
}

check_redirect_entry() {
  local request_path="$1"
  local expected_location="$2"
  local response_headers
  local redirect_location
  local normalized_location
  response_headers="$(curl -sS -D - -o /dev/null "${base_url}${request_path}")" || fail "入口不可访问：${request_path}"
  printf '%s' "${response_headers}" | grep -Eq '^HTTP/[0-9.]+ 302' || fail "入口未返回 302 跳转：${request_path}"
  redirect_location="$(printf '%s' "${response_headers}" | awk 'tolower($0) ~ /^location:/ { sub(/^[^:]*:[[:space:]]*/, ""); sub(/\r$/, ""); print; exit }')"
  [ -n "${redirect_location}" ] || fail "入口跳转未返回 Location 响应头：${request_path}"
  normalized_location="${redirect_location}"
  case "${normalized_location}" in
    http://*|https://*)
      normalized_location="${normalized_location#*://}"
      case "${normalized_location}" in
        */*) normalized_location="/${normalized_location#*/}" ;;
        *) normalized_location="/" ;;
      esac
      ;;
  esac
  [ "${normalized_location}" = "${expected_location}" ] || fail "入口跳转目标错误：${request_path}，实际 ${redirect_location}，预期 ${expected_location}。"
}

check_business_entry() {
  local request_path="$1"
  local content_marker="$2"
  local body
  body="$(curl -fsS "${base_url}${request_path}")" || fail "业务页面不可访问：${request_path}"
  case "${body}" in
    *"${content_marker}"*) ;;
    *) fail "业务页面内容错误：${request_path} 未包含 ${content_marker}。" ;;
  esac
}

check_iam_config() {
  local body
  body="$(curl -fsS "${base_url}/api/auth/sso/iam/config")" || fail "IAM 单点登录配置接口不可访问。"
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

check_success_api "/health/live"
check_success_api "/api/v2/partners?pageSize=1"
check_success_api "/api/auth/sso/iam/config"
check_spa_entry "/"
check_spa_entry "/login"
check_redirect_entry "/admin" "/admin.html"
check_redirect_entry "/partner" "/partner.html"
check_business_entry "/admin.html" "admin-app.js"
check_business_entry "/admin-mobile.html" "mobile.html"
check_business_entry "/partner.html" "partner-app.js"
check_business_entry "/partner-mobile.html" "mobile.html"
check_iam_config

echo "业务自检通过。"
