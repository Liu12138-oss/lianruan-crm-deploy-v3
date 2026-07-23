#!/usr/bin/env bash
# 本脚本一键还原本补丁替换的三个代码文件，绝不自动还原生产数据库。

set -u
set -o pipefail
umask 077

PACKAGE_DIR="$(cd "$(dirname "$0")" && pwd -P)"
source "$PACKAGE_DIR/lib/common.sh"

LOCK_DIR=''
LOCK_HELD='no'
SOURCE_BACKUP_DIR=''
BACKUP_DIR=''
SERVICE_CONTROL_STARTED='no'
FILES_REPLACED='no'

show_usage() {
  cat <<'EOF'
账号管理员精确操作修复包——一键还原

用法：
  bash restore.sh
  bash restore.sh 升级备份目录

不传备份目录时，自动选择本升级包最近一次成功升级的备份。
还原仅恢复 backend/server.js、frontend/admin-app.js、frontend/admin.html。
数据库快照不会被自动恢复，以避免覆盖升级后的真实业务数据。

演练时可通过环境变量覆盖路径和端口：
  PROJECT_DIR=项目目录 BACKUP_ROOT=备份目录 BACKEND_PORT=后端端口 FRONTEND_PORT=前端端口 bash restore.sh
EOF
}

resolve_source_backup() {
  local requested_path="${1:-}"
  local candidate

  if [ -n "$requested_path" ]; then
    if [ -d "$requested_path" ]; then
      candidate="$requested_path"
    else
      candidate="$BACKUP_ROOT/$requested_path"
    fi
  else
    candidate=''
    while IFS= read -r requested_path; do
      if [ -f "$requested_path/metadata/升级成功" ]; then
        candidate="$requested_path"
        break
      fi
    done < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'upgrade-*' -print 2>/dev/null | sort -r)
  fi

  if [ -z "$candidate" ] || [ ! -d "$candidate" ]; then
    log_error "未找到可用的成功升级备份。"
    return 1
  fi
  if [ ! -f "$candidate/metadata/升级成功" ]; then
    log_error "指定备份不是成功升级备份，已拒绝还原：${candidate}"
    return 1
  fi
  printf '%s\n' "$candidate"
}

record_restore_status() {
  local status_text="$1"
  [ -n "$BACKUP_DIR" ] || return 0
  printf '%s\t%s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')" "$status_text" > "$BACKUP_DIR/metadata/还原状态.tsv"
}

acquire_lock() {
  LOCK_DIR="$BACKUP_ROOT/.account-admin-fix.lock"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    log_error "检测到已有升级或还原任务正在执行，锁目录为：${LOCK_DIR}"
    return 1
  fi
  printf '%s\n' "$$" > "$LOCK_DIR/进程号"
  LOCK_HELD='yes'
  return 0
}

release_lock() {
  if [ "$LOCK_HELD" = 'yes' ] && [ -n "$LOCK_DIR" ]; then
    rm -f "$LOCK_DIR/进程号"
    rmdir "$LOCK_DIR" 2>/dev/null || true
    LOCK_HELD='no'
  fi
}

recover_current_service_and_code() {
  local recovery_ok='yes'

  if [ "$SERVICE_CONTROL_STARTED" = 'no' ]; then
    return 0
  fi

  log_warn "开始自动恢复还原前的服务状态。"
  if ! assert_service_ownership 'yes'; then
    log_error "无法确认当前进程归属，已停止自动恢复以避免影响其他服务。"
    return 1
  fi
  if ! stop_project_services "$BACKUP_DIR/logs/自动恢复停服日志.txt"; then
    recovery_ok='no'
  fi
  if [ "$FILES_REPLACED" = 'yes' ]; then
    if ! replace_target_files "$BACKUP_DIR/files"; then
      recovery_ok='no'
    elif ! validate_post_replace_syntax; then
      recovery_ok='no'
    fi
  fi
  if [ "$recovery_ok" = 'yes' ]; then
    if ! start_project_services "$BACKUP_DIR/logs/自动恢复启动日志.txt"; then
      recovery_ok='no'
    fi
  fi

  if [ "$recovery_ok" = 'yes' ]; then
    record_restore_status '还原失败，已自动恢复还原前代码并重新启动服务'
    log_warn "已自动恢复还原前代码并重新启动服务。"
    return 0
  fi

  record_restore_status '还原失败，自动恢复未完成'
  log_error "自动恢复未完成。请保留备份目录并立即人工检查：${BACKUP_DIR}"
  return 1
}

fail_after_service_control() {
  local message="$1"
  log_error "$message"
  recover_current_service_and_code || true
  return 1
}

on_interrupt() {
  trap - INT TERM
  log_error "收到中断信号。"
  recover_current_service_and_code || true
  exit 130
}

main() {
  if [ "$#" -gt 1 ]; then
    show_usage
    return 1
  fi

  log_info "开始一键还原。"
  if ! validate_required_commands; then
    return 1
  fi
  if ! validate_package_layout || ! verify_payload_checksums; then
    return 1
  fi
  if ! validate_project_layout || ! validate_target_syntax || ! validate_target_metadata_permissions; then
    return 1
  fi
  if ! assert_target_state 'upgraded'; then
    return 1
  fi
  if ! ensure_backup_root_capacity; then
    return 1
  fi
  SOURCE_BACKUP_DIR="$(resolve_source_backup "${1:-}")" || return 1
  if ! verify_backup_integrity "$SOURCE_BACKUP_DIR" || ! verify_backup_baseline_hashes "$SOURCE_BACKUP_DIR"; then
    return 1
  fi
  if ! assert_service_ownership 'no'; then
    return 1
  fi
  if ! acquire_lock; then
    return 1
  fi

  if ! assert_target_state 'upgraded'; then
    return 1
  fi
  if ! verify_backup_integrity "$SOURCE_BACKUP_DIR" || ! verify_backup_baseline_hashes "$SOURCE_BACKUP_DIR"; then
    return 1
  fi
  if ! create_backup_directory 'restore-before'; then
    return 1
  fi
  if ! backup_databases || ! backup_target_files || ! write_backup_metadata '代码还原前自动备份'; then
    record_restore_status '还原前自动备份失败，未停止服务'
    log_error "还原前自动备份失败，未停止服务。"
    return 1
  fi
  if ! verify_backup_integrity "$BACKUP_DIR" || ! verify_backup_upgraded_hashes "$BACKUP_DIR"; then
    record_restore_status '还原前备份校验失败，未停止服务'
    log_error "还原前备份校验失败，未停止服务。"
    return 1
  fi
  record_restore_status '还原前自动备份完成，等待停服'
  log_info "还原前备份完成：${BACKUP_DIR}"

  if ! assert_service_ownership 'no'; then
    record_restore_status '服务进程归属校验失败，未停止服务'
    return 1
  fi
  SERVICE_CONTROL_STARTED='yes'
  if ! stop_project_services "$BACKUP_DIR/logs/停服日志.txt"; then
    fail_after_service_control '服务未能安全停止，已取消还原。'
    return 1
  fi

  FILES_REPLACED='yes'
  if ! replace_target_files "$SOURCE_BACKUP_DIR/files"; then
    fail_after_service_control '代码还原失败，开始自动恢复。'
    return 1
  fi
  if ! validate_post_replace_syntax || ! assert_target_state 'baseline'; then
    fail_after_service_control '还原后的代码校验失败，开始自动恢复。'
    return 1
  fi
  if ! start_project_services "$BACKUP_DIR/logs/启动日志.txt"; then
    fail_after_service_control '还原后的服务启动或健康检查失败，开始自动恢复。'
    return 1
  fi
  if ! validate_sqlite_integrity "$PROJECT_DIR/backend/crm.db" '主业务库' || ! validate_sqlite_integrity "$PROJECT_DIR/backend/audit.db" '审计库'; then
    fail_after_service_control '服务启动后的数据库完整性校验失败，开始自动恢复代码。'
    return 1
  fi

  printf '%s\n' '本次代码还原已完成。数据库快照未被自动恢复，生产业务数据保持原状。' > "$BACKUP_DIR/metadata/还原成功"
  record_restore_status '还原成功，服务健康检查与数据库完整性校验通过'
  log_info "一键还原完成。还原前备份目录：${BACKUP_DIR}"
  log_info "本次仅还原三个代码文件；未导入、删除、覆盖或恢复生产数据库。"
  return 0
}

trap release_lock EXIT
trap on_interrupt INT TERM

if ! main "$@"; then
  exit 1
fi
