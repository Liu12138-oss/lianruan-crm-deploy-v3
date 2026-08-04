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

check_legacy_entry() {
  local request_path="$1"
  local http_status
  http_status="$(curl -sS -o /dev/null -w '%{http_code}' "${base_url}${request_path}")" || fail "旧入口不可访问：${request_path}"
  [ "${http_status}" = "200" ] || fail "旧入口状态异常：${request_path} 返回 ${http_status}，预期 200。"
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
check_spa_entry "/admin"
check_spa_entry "/partner"
check_legacy_entry "/admin.html"
check_legacy_entry "/partner.html"
check_iam_config

echo "业务自检通过。"
