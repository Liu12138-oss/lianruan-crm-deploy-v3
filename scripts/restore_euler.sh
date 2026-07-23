#!/bin/bash
# ================================================================
# 联软渠道管理平台 - 欧拉/Ubuntu环境恢复脚本
# ================================================================
# 默认项目目录：/home/liulonghai/lianruan-crm-deploy-v2.2.0
# 默认备份目录：/home/liulonghai/backup
#
# 恢复模式：
#   1. verify：只校验备份包，不改项目。
#   2. restore-temp：恢复到临时目录，用于演练。
#   3. restore-live：覆盖正式项目目录，执行前必须输入 yes。
# ================================================================

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/liulonghai/lianruan-crm-deploy-v2.2.0}"
BACKUP_ROOT="${BACKUP_ROOT:-/home/liulonghai/backup}"
RESTORE_WORK_ROOT="${RESTORE_WORK_ROOT:-${BACKUP_ROOT}/restores/.work}"
LATEST_DIR="${BACKUP_ROOT}/latest"
SYSTEM_DIR="${BACKUP_ROOT}/.system"
SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[信息]${NC} $1"; }
warn() { echo -e "${YELLOW}[提醒]${NC} $1"; }
error() { echo -e "${RED}[错误]${NC} $1" >&2; }
title() {
  echo ""
  echo -e "${BLUE}================================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}================================================${NC}"
}

usage() {
  cat <<EOF
联软渠道管理平台 - 欧拉/Ubuntu环境恢复脚本

用法：
  bash scripts/restore_euler.sh list
  bash scripts/restore_euler.sh verify latest
  bash scripts/restore_euler.sh verify /home/liulonghai/backup/daily/2026/07/lianruan-crm-daily-20260721_010000.tar.gz
  bash scripts/restore_euler.sh restore-temp latest
  bash scripts/restore_euler.sh restore-temp latest /home/liulonghai/restore-test
  bash scripts/restore_euler.sh restore-live latest
  bash scripts/restore_euler.sh install-deps

说明：
  latest 表示使用最新备份包。
  restore-temp 只恢复到临时目录，不覆盖正式项目。
  restore-live 会覆盖 PROJECT_DIR，执行前必须输入 yes。
EOF
}

require_command() {
  local command_name="$1"
  local install_hint="$2"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    error "缺少命令：${command_name}"
    echo "安装建议：${install_hint}" >&2
    exit 1
  fi
}

run_as_root() {
  if [ "$(id -u)" = "0" ]; then
    "$@"
    return
  fi

  if ! command -v sudo >/dev/null 2>&1; then
    error "当前不是 root 用户，且系统缺少 sudo，请切换 root 后重试"
    exit 1
  fi

  sudo "$@"
}

detect_package_manager() {
  if command -v apt-get >/dev/null 2>&1; then
    echo "apt-get"
    return
  fi
  if command -v dnf >/dev/null 2>&1; then
    echo "dnf"
    return
  fi
  if command -v yum >/dev/null 2>&1; then
    echo "yum"
    return
  fi

  error "未识别系统包管理器，请手工安装 sqlite3、rsync、tar、sha256sum"
  exit 1
}

install_deps_by_apt() {
  title "安装 Ubuntu 依赖"
  run_as_root apt-get update
  run_as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y sqlite3 rsync tar coreutils cron
}

install_deps_by_dnf_or_yum() {
  local package_manager="$1"
  local packages=(sqlite rsync tar coreutils cronie)

  title "安装欧拉依赖"
  if run_as_root "$package_manager" install -y "${packages[@]}"; then
    return
  fi

  warn "常规安装失败，开始尝试禁用失效的 update 软件源后重试"
  if run_as_root "$package_manager" --disablerepo=update install -y "${packages[@]}"; then
    return
  fi

  warn "禁用 update 源后仍失败，继续尝试同时禁用 update 和 updates 源"
  if run_as_root "$package_manager" --disablerepo=update --disablerepo=updates install -y "${packages[@]}"; then
    return
  fi

  error "依赖安装失败，请检查 /etc/yum.repos.d/ 下的软件源配置"
  echo "临时处理建议：" >&2
  echo "  sudo ${package_manager} --disablerepo=update install -y sqlite rsync tar coreutils cronie" >&2
  echo "长期处理建议：修复或关闭失效的 openEuler update 软件源后再安装" >&2
  exit 1
}

install_dependencies() {
  local package_manager
  package_manager="$(detect_package_manager)"

  case "$package_manager" in
    apt-get)
      install_deps_by_apt
      ;;
    dnf|yum)
      install_deps_by_dnf_or_yum "$package_manager"
      ;;
  esac

  title "依赖检查"
  require_command sqlite3 "请重新执行：bash \"${SCRIPT_PATH}\" install-deps"
  require_command rsync "请重新执行：bash \"${SCRIPT_PATH}\" install-deps"
  require_command tar "请重新执行：bash \"${SCRIPT_PATH}\" install-deps"
  require_command sha256sum "请重新执行：bash \"${SCRIPT_PATH}\" install-deps"
  log "依赖安装和检查完成"
}

check_environment() {
  local install_hint
  install_hint="bash \"${SCRIPT_PATH}\" install-deps"
  require_command sqlite3 "$install_hint"
  require_command tar "$install_hint"
  require_command sha256sum "$install_hint"
  require_command rsync "$install_hint"
  mkdir -p "$BACKUP_ROOT" "$RESTORE_WORK_ROOT"
}

list_backups() {
  mkdir -p "$BACKUP_ROOT"
  title "备份列表"

  if [ -z "$(list_backup_files | head -1)" ]; then
    warn "没有找到备份包：$BACKUP_ROOT"
    return
  fi

  printf "%-10s %-10s %-19s %-s\n" "类型" "大小" "备份时间" "相对路径"
  echo "--------------------------------------------------------------------------------"
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    printf "%-10s %-10s %-19s %-s\n" \
      "$(backup_type_label "$(parse_backup_type_from_name "$file")")" \
      "$(du -h "$file" | awk '{print $1}')" \
      "$(file_mtime_text "$file")" \
      "$(relative_backup_path "$file")"
  done < <(list_backup_files)
}

backup_type_label() {
  case "$1" in
    daily) echo "每日备份" ;;
    weekly) echo "每周备份" ;;
    monthly) echo "每月备份" ;;
    manual) echo "手动备份" ;;
    *) echo "$1" ;;
  esac
}

relative_backup_path() {
  local file="$1"
  case "$file" in
    "$BACKUP_ROOT"/*)
      echo "${file#$BACKUP_ROOT/}"
      ;;
    *)
      echo "$file"
      ;;
  esac
}

file_mtime_text() {
  local file="$1"
  local result

  result="$(stat -c '%y' "$file" 2>/dev/null | cut -d. -f1 || true)"
  if [ -n "$result" ]; then
    echo "$result"
    return
  fi

  result="$(stat -f '%Sm' -t '%Y-%m-%d %H:%M:%S' "$file" 2>/dev/null || true)"
  if [ -n "$result" ]; then
    echo "$result"
    return
  fi

  date -r "$file" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "-"
}

parse_backup_type_from_name() {
  basename "$1" | sed -n 's/^lianruan-crm-\([a-z]*\)-[0-9]\{8\}_[0-9]\{6\}\.tar\.gz$/\1/p'
}

list_backup_files() {
  find "$BACKUP_ROOT" \
    -type f \
    -name 'lianruan-crm-*.tar.gz' \
    ! -path "${SYSTEM_DIR}/*" \
    ! -path "${BACKUP_ROOT}/restores/*" \
    -exec ls -1t {} + 2>/dev/null || true
}

resolve_backup_package() {
  local input="$1"

  if [ -z "$input" ]; then
    error "请指定备份包或 latest"
    exit 1
  fi

  if [ "$input" = "latest" ]; then
    local latest
    if [ -f "${LATEST_DIR}/latest-backup.txt" ]; then
      latest="$(cat "${LATEST_DIR}/latest-backup.txt" 2>/dev/null || true)"
      if [ -n "$latest" ] && [ -f "$latest" ]; then
        echo "$latest"
        return
      fi
    fi
    if [ -f "${BACKUP_ROOT}/latest-backup.txt" ]; then
      latest="$(cat "${BACKUP_ROOT}/latest-backup.txt" 2>/dev/null || true)"
      if [ -n "$latest" ] && [ -f "$latest" ]; then
        echo "$latest"
        return
      fi
    fi
    latest="$(list_backup_files | head -1 || true)"
    if [ -z "$latest" ]; then
      error "没有找到任何备份包：$BACKUP_ROOT"
      exit 1
    fi
    echo "$latest"
    return
  fi

  if [ -f "$input" ]; then
    echo "$input"
    return
  fi

  if [ -f "${BACKUP_ROOT}/${input}" ]; then
    echo "${BACKUP_ROOT}/${input}"
    return
  fi

  local matched_file
  matched_file="$(find "$BACKUP_ROOT" \
    -type f \
    -name "$(basename "$input")" \
    ! -path "${SYSTEM_DIR}/*" \
    ! -path "${BACKUP_ROOT}/restores/*" \
    -print -quit 2>/dev/null || true)"
  if [ -n "$matched_file" ]; then
    echo "$matched_file"
    return
  fi

  error "备份包不存在：$input"
  exit 1
}

get_archive_root_name() {
  local package_file="$1"
  local root_name

  root_name="$(tar -tzf "$package_file" | head -1 | cut -d/ -f1)"
  if [ -z "$root_name" ]; then
    error "无法识别备份包根目录：$package_file"
    exit 1
  fi
  echo "$root_name"
}

sqlite_integrity_check() {
  local db_file="$1"
  local db_label="$2"
  local result

  if [ ! -f "$db_file" ]; then
    error "${db_label}不存在：$db_file"
    exit 1
  fi

  result="$(sqlite3 "$db_file" "PRAGMA integrity_check;" | tr -d '\r')"
  if [ "$result" != "ok" ]; then
    error "${db_label}完整性校验失败：$result"
    exit 1
  fi
  log "${db_label}完整性校验通过"
}

extract_and_verify() {
  local package_file="$1"
  local restore_dir="$2"
  local root_name
  local root_dir
  local checksum_file

  rm -rf "$restore_dir"
  mkdir -p "$restore_dir"

  title "解压备份包"
  log "备份包：$package_file"
  tar -xzf "$package_file" -C "$restore_dir"

  root_name="$(get_archive_root_name "$package_file")"
  root_dir="${restore_dir}/${root_name}"
  checksum_file="${root_dir}/backup_meta/SHA256SUMS.txt"

  if [ ! -d "$root_dir/project" ]; then
    error "备份包缺少 project 目录：$root_dir"
    exit 1
  fi

  title "校验备份内容"
  if [ -f "$checksum_file" ]; then
    (
      cd "$root_dir"
      sha256sum -c "$checksum_file" >/dev/null
    )
    log "文件校验和通过"
  else
    warn "未找到校验和文件，跳过文件级校验：$checksum_file"
  fi

  sqlite_integrity_check "${root_dir}/project/backend/crm.db" "主业务库"
  sqlite_integrity_check "${root_dir}/project/backend/audit.db" "审计库"

  echo "$root_dir"
}

verify_backup() {
  local package_file="$1"
  local restore_dir

  restore_dir="${RESTORE_WORK_ROOT}/verify-$(date +%Y%m%d_%H%M%S)"
  extract_and_verify "$package_file" "$restore_dir" >/tmp/lianruan_restore_verify_path.txt

  title "校验完成"
  echo "备份包可用：$package_file"
  rm -rf "$restore_dir"
}

restore_temp() {
  local package_file="$1"
  local target_dir="${2:-${BACKUP_ROOT}/restores/restore-test-$(date +%Y%m%d_%H%M%S)}"
  local restore_dir
  local root_dir

  restore_dir="${RESTORE_WORK_ROOT}/temp-$(date +%Y%m%d_%H%M%S)"
  root_dir="$(extract_and_verify "$package_file" "$restore_dir" | tail -1)"

  rm -rf "$target_dir"
  mkdir -p "$(dirname "$target_dir")"
  rsync -a "${root_dir}/project/" "$target_dir/"
  rm -rf "$restore_dir"

  title "临时恢复完成"
  echo "恢复目录：$target_dir"
  echo "你可以在该目录执行 scripts/start.sh 做恢复演练。"
}

run_pre_restore_backup() {
  local backup_script="${PROJECT_DIR}/scripts/backup_euler.sh"

  if [ ! -d "$PROJECT_DIR" ]; then
    warn "项目目录不存在，判断为灾难恢复场景，跳过恢复前自动备份"
    return
  fi

  if [ ! -f "$backup_script" ]; then
    warn "未找到恢复前备份脚本，跳过自动预备份：$backup_script"
    return
  fi

  title "恢复前自动备份当前项目"
  PROJECT_DIR="$PROJECT_DIR" BACKUP_ROOT="$BACKUP_ROOT" /bin/bash "$backup_script" run --type manual --include-node-modules
}

stop_service_if_possible() {
  local start_script="${PROJECT_DIR}/scripts/start.sh"

  if [ ! -d "$PROJECT_DIR" ]; then
    warn "项目目录不存在，跳过自动停服"
    return
  fi

  if [ -f "$start_script" ]; then
    title "停止当前服务"
    /bin/bash "$start_script" stop || warn "停止服务失败，请人工确认进程状态"
  else
    warn "未找到启动脚本，跳过自动停服：$start_script"
  fi
}

start_service_if_possible() {
  local start_script="${PROJECT_DIR}/scripts/start.sh"

  if [ -f "$start_script" ]; then
    title "启动服务"
    /bin/bash "$start_script" start || warn "启动服务失败，请查看项目日志并人工处理"
  else
    warn "未找到启动脚本，跳过自动启服：$start_script"
  fi
}

backup_contains_node_modules() {
  local project_dir="$1"

  if [ -d "${project_dir}/node_modules" ] || [ -d "${project_dir}/backend/node_modules" ]; then
    echo "1"
  else
    echo "0"
  fi
}

restore_live() {
  local package_file="$1"
  local restore_dir
  local root_dir
  local source_project_dir
  local contains_node_modules
  local confirm

  restore_dir="${RESTORE_WORK_ROOT}/live-$(date +%Y%m%d_%H%M%S)"
  root_dir="$(extract_and_verify "$package_file" "$restore_dir" | tail -1)"
  source_project_dir="${root_dir}/project"
  contains_node_modules="$(backup_contains_node_modules "$source_project_dir")"

  title "正式恢复确认"
  echo "即将用备份覆盖正式项目目录：$PROJECT_DIR"
  echo "备份包：$package_file"
  echo "备份包含 node_modules：$contains_node_modules"
  if [ ! -d "$PROJECT_DIR" ]; then
    echo "当前项目目录不存在，将按灾难恢复模式重新创建。"
  fi
  echo ""
  echo "请输入 yes 后继续："
  read -r confirm

  if [ "$confirm" != "yes" ]; then
    rm -rf "$restore_dir"
    echo "已取消恢复"
    exit 0
  fi

  run_pre_restore_backup
  stop_service_if_possible

  title "覆盖正式项目目录"
  mkdir -p "$PROJECT_DIR"
  if [ "$contains_node_modules" = "1" ]; then
    rsync -a --delete "${source_project_dir}/" "$PROJECT_DIR/"
  else
    rsync -a --delete --exclude='node_modules/' "${source_project_dir}/" "$PROJECT_DIR/"
  fi

  sqlite_integrity_check "${PROJECT_DIR}/backend/crm.db" "恢复后的主业务库"
  sqlite_integrity_check "${PROJECT_DIR}/backend/audit.db" "恢复后的审计库"

  start_service_if_possible
  rm -rf "$restore_dir"

  title "正式恢复完成"
  echo "已恢复到备份包：$package_file"
}

main() {
  local command="${1:-help}"
  local package_input="${2:-}"
  local package_file=""

  case "$command" in
    list)
      list_backups
      ;;
    verify)
      check_environment
      package_file="$(resolve_backup_package "$package_input")"
      verify_backup "$package_file"
      ;;
    restore-temp)
      check_environment
      package_file="$(resolve_backup_package "$package_input")"
      restore_temp "$package_file" "${3:-}"
      ;;
    restore-live)
      check_environment
      package_file="$(resolve_backup_package "$package_input")"
      restore_live "$package_file"
      ;;
    install-deps)
      install_dependencies
      ;;
    help|--help|-h)
      usage
      ;;
    *)
      error "未知命令：$command"
      usage
      exit 1
      ;;
  esac
}

main "$@"
