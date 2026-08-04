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

echo "业务自检通过。"

