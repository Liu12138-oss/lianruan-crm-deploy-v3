#!/usr/bin/env bash
# 只读预检脚本：不会停止服务、替换文件或写入生产数据库。

set -u
set -o pipefail
umask 077

PACKAGE_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$PACKAGE_DIR/lib/common.sh"

show_usage() {
  cat <<'EOF'
账号管理员精确操作修复包——只读预检

用法：
  bash check.sh

可通过环境变量覆盖演练路径：
  PROJECT_DIR=项目目录 BACKUP_ROOT=备份目录 BACKEND_PORT=后端端口 FRONTEND_PORT=前端端口 bash check.sh
EOF
}

main() {
  local current_state

  if [ "$#" -ne 0 ]; then
    show_usage
    return 1
  fi

  log_info "开始只读预检。"
  if ! validate_required_commands; then
    return 1
  fi
  if ! validate_package_layout || ! verify_payload_checksums || ! verify_payload_syntax; then
    return 1
  fi
  if ! validate_project_layout || ! validate_target_syntax || ! validate_target_metadata_permissions; then
    return 1
  fi

  current_state="$(target_state)" || {
    log_error "无法计算项目文件校验和。"
    return 1
  }
  case "$current_state" in
    baseline)
      log_info "升级前基线校验通过，可以执行升级。"
      ;;
    upgraded)
      log_info "当前项目已是本补丁版本，无需重复升级。"
      ;;
    mixed)
      log_error "三个目标文件版本不一致，已拒绝继续。"
      show_target_hashes || true
      return 1
      ;;
    *)
      log_error "项目文件校验和与本补丁基线不一致，已拒绝继续。"
      show_target_hashes || true
      return 1
      ;;
  esac

  log_info "预检完成。本脚本未停止服务、未写入项目文件、未操作生产数据库。"
  return 0
}

main "$@"
