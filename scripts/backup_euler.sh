#!/bin/bash
# ================================================================
# 联软渠道管理平台 - 欧拉/Ubuntu环境备份脚本
# ================================================================
# 默认项目目录：/home/liulonghai/lianruan-crm-deploy-v2.2.0
# 默认备份目录：/home/liulonghai/backup
#
# 设计目标：
#   1. 使用 SQLite 在线备份生成一致性数据库快照。
#   2. 每日备份不包含 node_modules，每周和每月备份包含 node_modules。
#   3. 备份包包含项目文件、数据库快照、校验和、备份清单。
#   4. 预留异地备份配置，默认不启用。
#   5. 支持一键安装 crontab，每天凌晨 1 点执行。
# ================================================================

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/liulonghai/lianruan-crm-deploy-v2.2.0}"
BACKUP_ROOT="${BACKUP_ROOT:-/home/liulonghai/backup}"

DAILY_KEEP_DAYS="${DAILY_KEEP_DAYS:-30}"
WEEKLY_KEEP_COUNT="${WEEKLY_KEEP_COUNT:-12}"
MONTHLY_KEEP_COUNT="${MONTHLY_KEEP_COUNT:-12}"
MANUAL_KEEP_DAYS="${MANUAL_KEEP_DAYS:-30}"

REMOTE_BACKUP_ENABLED="${REMOTE_BACKUP_ENABLED:-0}"
REMOTE_BACKUP_TARGET="${REMOTE_BACKUP_TARGET:-}"

KEEP_WORK_DIR="${KEEP_WORK_DIR:-0}"

SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
LOG_DIR="${BACKUP_ROOT}/logs"
INDEX_DIR="${BACKUP_ROOT}/indexes"
LATEST_DIR="${BACKUP_ROOT}/latest"
RESCUE_DIR="${BACKUP_ROOT}/rescue"
SYSTEM_DIR="${BACKUP_ROOT}/.system"
WORK_ROOT="${SYSTEM_DIR}/work"
LOCK_DIR="${SYSTEM_DIR}/backup.lock"

BACKUP_TYPE_OVERRIDE=""
INCLUDE_NODE_MODULES_OVERRIDE=""
CURRENT_WORK_DIR=""

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
联软渠道管理平台 - 欧拉/Ubuntu环境备份脚本

用法：
  bash scripts/backup_euler.sh run
  bash scripts/backup_euler.sh run --type daily
  bash scripts/backup_euler.sh run --type weekly
  bash scripts/backup_euler.sh run --type monthly
  bash scripts/backup_euler.sh run --type manual --include-node-modules
  bash scripts/backup_euler.sh list
  bash scripts/backup_euler.sh organize
  bash scripts/backup_euler.sh check
  bash scripts/backup_euler.sh install-deps
  bash scripts/backup_euler.sh install-cron
  bash scripts/backup_euler.sh show-cron

默认规则：
  每月 1 日：月备份，包含 node_modules
  每周一：周备份，包含 node_modules
  其他日期：日备份，不包含 node_modules

可覆盖环境变量：
  PROJECT_DIR=/home/liulonghai/lianruan-crm-deploy-v2.2.0
  BACKUP_ROOT=/home/liulonghai/backup
  REMOTE_BACKUP_ENABLED=0
  REMOTE_BACKUP_TARGET=user@host:/data/lianruan-crm-backup
EOF
}

parse_options() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --type)
        if [ $# -lt 2 ]; then
          error "--type 缺少参数"
          exit 1
        fi
        BACKUP_TYPE_OVERRIDE="$2"
        shift 2
        ;;
      --include-node-modules)
        INCLUDE_NODE_MODULES_OVERRIDE="1"
        shift
        ;;
      --exclude-node-modules)
        INCLUDE_NODE_MODULES_OVERRIDE="0"
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        error "未知参数：$1"
        usage
        exit 1
        ;;
    esac
  done
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

  error "未识别系统包管理器，请手工安装 sqlite3、rsync、tar、sha256sum、crontab"
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
  require_command crontab "请重新执行：bash \"${SCRIPT_PATH}\" install-deps"
  start_cron_service
  log "依赖安装和检查完成"
}

start_cron_service() {
  if ! command -v systemctl >/dev/null 2>&1; then
    warn "未检测到 systemctl，请手工确认定时任务服务已启动"
    return
  fi

  if systemctl list-unit-files crond.service 2>/dev/null | grep -q '^crond.service'; then
    run_as_root systemctl enable --now crond || warn "启动 crond 失败，请人工检查"
    return
  fi

  if systemctl list-unit-files cron.service 2>/dev/null | grep -q '^cron.service'; then
    run_as_root systemctl enable --now cron || warn "启动 cron 失败，请人工检查"
    return
  fi

  warn "未识别定时任务服务名称，请在欧拉上检查 crond，在 Ubuntu 上检查 cron"
}

check_environment() {
  title "环境检查"

  if [ ! -d "$PROJECT_DIR" ]; then
    error "项目目录不存在：$PROJECT_DIR"
    exit 1
  fi
  if [ ! -d "$PROJECT_DIR/backend" ]; then
    error "缺少后端目录：$PROJECT_DIR/backend"
    exit 1
  fi
  if [ ! -d "$PROJECT_DIR/frontend" ]; then
    error "缺少前端目录：$PROJECT_DIR/frontend"
    exit 1
  fi

  local install_hint
  install_hint="bash \"${SCRIPT_PATH}\" install-deps"
  require_command sqlite3 "$install_hint"
  require_command rsync "$install_hint"
  require_command tar "$install_hint"
  require_command sha256sum "$install_hint"
  require_command date "$install_hint"

  mkdir -p "$BACKUP_ROOT" "$LOG_DIR" "$INDEX_DIR" "$LATEST_DIR" "$RESCUE_DIR" "$WORK_ROOT"
  write_backup_root_readme
  write_rescue_tools

  log "项目目录：$PROJECT_DIR"
  log "备份目录：$BACKUP_ROOT"
  log "环境检查通过"
}

acquire_lock() {
  mkdir -p "$BACKUP_ROOT"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    error "已有备份任务正在运行，锁目录为：$LOCK_DIR"
    exit 1
  fi
}

release_lock() {
  rm -rf "$LOCK_DIR"
}

decide_backup_type() {
  if [ -n "$BACKUP_TYPE_OVERRIDE" ]; then
    case "$BACKUP_TYPE_OVERRIDE" in
      daily|weekly|monthly|manual)
        echo "$BACKUP_TYPE_OVERRIDE"
        return
        ;;
      *)
        error "不支持的备份类型：$BACKUP_TYPE_OVERRIDE"
        exit 1
        ;;
    esac
  fi

  local day_of_month
  local day_of_week
  day_of_month="$(date +%d)"
  day_of_week="$(date +%u)"

  if [ "$day_of_month" = "01" ]; then
    echo "monthly"
  elif [ "$day_of_week" = "1" ]; then
    echo "weekly"
  else
    echo "daily"
  fi
}

should_include_node_modules() {
  local backup_type="$1"

  if [ -n "$INCLUDE_NODE_MODULES_OVERRIDE" ]; then
    [ "$INCLUDE_NODE_MODULES_OVERRIDE" = "1" ] && echo "1" || echo "0"
    return
  fi

  case "$backup_type" in
    weekly|monthly|manual)
      echo "1"
      ;;
    *)
      echo "0"
      ;;
  esac
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

get_backup_storage_dir_by_parts() {
  local backup_type="$1"
  local year="$2"
  local month="$3"

  case "$backup_type" in
    daily)
      echo "${BACKUP_ROOT}/daily/${year}/${month}"
      ;;
    weekly)
      echo "${BACKUP_ROOT}/weekly/${year}"
      ;;
    monthly)
      echo "${BACKUP_ROOT}/monthly/${year}"
      ;;
    manual)
      echo "${BACKUP_ROOT}/manual/${year}/${month}"
      ;;
    *)
      echo "${BACKUP_ROOT}/other/${year}/${month}"
      ;;
  esac
}

get_backup_storage_dir() {
  local backup_type="$1"
  local year
  local month
  year="$(date +%Y)"
  month="$(date +%m)"
  get_backup_storage_dir_by_parts "$backup_type" "$year" "$month"
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

parse_backup_date_from_name() {
  basename "$1" | sed -n 's/^lianruan-crm-[a-z]*-\([0-9]\{8\}\)_[0-9]\{6\}\.tar\.gz$/\1/p'
}

list_backup_files() {
  find "$BACKUP_ROOT" \
    -type f \
    -name 'lianruan-crm-*.tar.gz' \
    ! -path "${SYSTEM_DIR}/*" \
    ! -path "${BACKUP_ROOT}/restores/*" \
    -exec ls -1t {} + 2>/dev/null || true
}

list_backup_files_by_type() {
  local backup_type="$1"
  find "$BACKUP_ROOT" \
    -type f \
    -name "lianruan-crm-${backup_type}-*.tar.gz" \
    ! -path "${SYSTEM_DIR}/*" \
    ! -path "${BACKUP_ROOT}/restores/*" \
    -exec ls -1t {} + 2>/dev/null || true
}

write_backup_root_readme() {
  cat > "${BACKUP_ROOT}/README.md" <<'EOF'
# 联软CRM备份目录说明

## 目录结构

```text
backup/
├── daily/        每日备份，按 年/月 存放，不包含 node_modules
├── weekly/       每周备份，按 年 存放，包含 node_modules
├── monthly/      每月备份，按 年 存放，包含 node_modules
├── manual/       手动备份，按 年/月 存放
├── latest/       最新备份指针文件，便于快速恢复
├── indexes/      备份索引表，便于查看和审计
├── logs/         定时备份日志
├── rescue/       项目目录丢失时使用的应急恢复工具
├── restores/     临时恢复演练目录
└── .system/      备份脚本工作目录和锁文件，不需要人工操作
```

## 常用命令

```bash
cd /home/liulonghai/lianruan-crm-deploy-v2.2.0
bash scripts/start.sh backup-list
bash scripts/start.sh backup
bash scripts/start.sh backup-organize
bash scripts/start.sh backup-verify
bash scripts/start.sh backup-restore-test
```
EOF
}

write_rescue_tools() {
  local script_dir
  local restore_source

  script_dir="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
  restore_source="${script_dir}/restore_euler.sh"
  mkdir -p "$RESCUE_DIR"

  if [ -f "$SCRIPT_PATH" ]; then
    cp "$SCRIPT_PATH" "${RESCUE_DIR}/backup_euler.sh"
    chmod +x "${RESCUE_DIR}/backup_euler.sh"
  fi

  if [ -f "$restore_source" ]; then
    cp "$restore_source" "${RESCUE_DIR}/restore_euler.sh"
    chmod +x "${RESCUE_DIR}/restore_euler.sh"
  fi

  cat > "${RESCUE_DIR}/项目目录丢失应急恢复.md" <<EOF
# 项目目录丢失应急恢复

## 适用场景

当项目目录整体丢失或损坏时使用，例如：

\`\`\`bash
${PROJECT_DIR}
\`\`\`

只要备份目录仍然存在，就可以从备份恢复：

\`\`\`bash
${BACKUP_ROOT}
\`\`\`

## 前置检查

\`\`\`bash
cd ${BACKUP_ROOT}
ls -l latest/
cat latest/latest-backup.txt
ls -l rescue/
\`\`\`

## 安装依赖

欧拉或 Ubuntu 均可执行：

\`\`\`bash
bash ${BACKUP_ROOT}/rescue/backup_euler.sh install-deps
\`\`\`

## 校验最新备份

\`\`\`bash
BACKUP_ROOT="${BACKUP_ROOT}" PROJECT_DIR="${PROJECT_DIR}" \\
bash ${BACKUP_ROOT}/rescue/restore_euler.sh verify latest
\`\`\`

## 临时恢复演练

\`\`\`bash
BACKUP_ROOT="${BACKUP_ROOT}" PROJECT_DIR="${PROJECT_DIR}" \\
bash ${BACKUP_ROOT}/rescue/restore_euler.sh restore-temp latest ${BACKUP_ROOT}/restores/emergency-test
\`\`\`

## 正式恢复

正式恢复会重建并覆盖项目目录，执行前请确认业务窗口。

\`\`\`bash
BACKUP_ROOT="${BACKUP_ROOT}" PROJECT_DIR="${PROJECT_DIR}" \\
bash ${BACKUP_ROOT}/rescue/restore_euler.sh restore-live latest
\`\`\`

## 恢复后检查

\`\`\`bash
cd ${PROJECT_DIR}
bash scripts/start.sh status
sqlite3 backend/crm.db "PRAGMA integrity_check;"
sqlite3 backend/audit.db "PRAGMA integrity_check;"
\`\`\`

如果日备份不包含 node_modules，恢复后可执行：

\`\`\`bash
cd ${PROJECT_DIR}/backend
npm install
\`\`\`
EOF
}

sqlite_integrity_check() {
  local db_file="$1"
  local db_label="$2"
  local result

  result="$(sqlite3 "$db_file" "PRAGMA integrity_check;" | tr -d '\r')"
  if [ "$result" != "ok" ]; then
    error "${db_label}完整性校验失败：$result"
    exit 1
  fi
  log "${db_label}完整性校验通过"
}

sqlite_online_backup() {
  local source_db="$1"
  local target_db="$2"
  local db_label="$3"

  if [ ! -f "$source_db" ]; then
    error "${db_label}不存在：$source_db"
    exit 1
  fi

  mkdir -p "$(dirname "$target_db")"
  sqlite3 "$source_db" "PRAGMA wal_checkpoint(PASSIVE);" >/dev/null
  sqlite3 "$source_db" ".backup '$target_db'"
  sqlite_integrity_check "$target_db" "$db_label"
}

build_rsync_excludes() {
  local include_node_modules="$1"
  local exclude_file="$2"

  : > "$exclude_file"
  cat >> "$exclude_file" <<'EOF'
.git/
.DS_Store
scripts/*.pid
backend/crm.db
backend/crm.db-wal
backend/crm.db-shm
backend/audit.db
backend/audit.db-wal
backend/audit.db-shm
EOF

  if [ "$include_node_modules" != "1" ]; then
    cat >> "$exclude_file" <<'EOF'
node_modules/
EOF
  fi
}

write_manifest() {
  local manifest_file="$1"
  local backup_name="$2"
  local backup_type="$3"
  local include_node_modules="$4"
  local package_file="$5"

  {
    echo "备份名称=${backup_name}"
    echo "备份类型=${backup_type}"
    echo "创建时间=$(date '+%Y-%m-%d %H:%M:%S %z')"
    echo "主机名=$(hostname 2>/dev/null || echo unknown)"
    echo "项目目录=${PROJECT_DIR}"
    echo "备份目录=${BACKUP_ROOT}"
    echo "备份包=${package_file}"
    echo "备份包相对路径=$(relative_backup_path "$package_file")"
    echo "包含node_modules=${include_node_modules}"
    echo "主业务库=backend/crm.db"
    echo "审计库=backend/audit.db"
    echo "数据库快照方式=sqlite3 .backup"
    echo "每日保留天数=${DAILY_KEEP_DAYS}"
    echo "每周保留份数=${WEEKLY_KEEP_COUNT}"
    echo "每月保留份数=${MONTHLY_KEEP_COUNT}"
    echo "手动备份保留天数=${MANUAL_KEEP_DAYS}"
    echo "异地备份启用=${REMOTE_BACKUP_ENABLED}"
    echo "异地备份目标=${REMOTE_BACKUP_TARGET}"
    echo "Node版本=$(node -v 2>/dev/null || echo 未检测到)"
    echo "npm版本=$(npm -v 2>/dev/null || echo 未检测到)"
    echo "项目大小=$(du -sh "$PROJECT_DIR" 2>/dev/null | awk '{print $1}' || echo 未知)"
    echo "说明=恢复时优先使用 project/backend 下的 crm.db 与 audit.db，它们来自在线一致性快照。"
  } > "$manifest_file"
}

write_checksums() {
  local work_dir="$1"
  local checksum_file="$2"

  (
    cd "$work_dir"
    find . -type f ! -path './backup_meta/SHA256SUMS.txt' -print0 \
      | sort -z \
      | xargs -0 sha256sum
  ) > "$checksum_file"
}

sync_remote_if_enabled() {
  local package_file="$1"

  if [ "$REMOTE_BACKUP_ENABLED" != "1" ]; then
    log "异地备份未启用，仅保留本机备份"
    return
  fi

  if [ -z "$REMOTE_BACKUP_TARGET" ]; then
    error "已启用异地备份，但 REMOTE_BACKUP_TARGET 为空"
    exit 1
  fi

  require_command rsync "bash \"${SCRIPT_PATH}\" install-deps"
  log "开始同步异地备份：$REMOTE_BACKUP_TARGET"
  rsync -av "$package_file" "$REMOTE_BACKUP_TARGET/"
  log "异地备份同步完成"
}

refresh_backup_catalog() {
  local index_file="${INDEX_DIR}/backup-index.tsv"
  local file
  local backup_type
  local relative_file
  local size
  local mtime
  local checksum_status
  local latest_file=""

  mkdir -p "$INDEX_DIR" "$LATEST_DIR"

  {
    echo -e "备份时间\t备份类型\t大小\t校验文件\t相对路径"
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      backup_type="$(parse_backup_type_from_name "$file")"
      [ -n "$backup_type" ] || backup_type="unknown"
      relative_file="$(relative_backup_path "$file")"
      size="$(du -h "$file" 2>/dev/null | awk '{print $1}')"
      mtime="$(file_mtime_text "$file")"
      if [ -f "${file}.sha256" ]; then
        checksum_status="有"
      else
        checksum_status="无"
      fi
      echo -e "${mtime}\t$(backup_type_label "$backup_type")\t${size}\t${checksum_status}\t${relative_file}"
      if [ -z "$latest_file" ]; then
        latest_file="$file"
      fi
    done < <(list_backup_files)
  } > "$index_file"

  rm -f "${LATEST_DIR}"/latest-*.txt "${LATEST_DIR}/latest-backup.txt" "${BACKUP_ROOT}/latest-backup.txt"

  if [ -n "$latest_file" ]; then
    echo "$latest_file" > "${LATEST_DIR}/latest-backup.txt"
  fi

  for backup_type in daily weekly monthly manual; do
    file="$(list_backup_files_by_type "$backup_type" | head -1 || true)"
    if [ -n "$file" ]; then
      echo "$file" > "${LATEST_DIR}/latest-${backup_type}.txt"
    fi
  done
}

delete_backup_package() {
  local file="$1"
  rm -f "$file" "${file}.sha256"
}

cleanup_by_count() {
  local backup_type="$1"
  local keep_count="$2"
  local index=0
  local file

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    index=$((index + 1))
    if [ "$index" -gt "$keep_count" ]; then
      log "清理过期${backup_type}备份：$file"
      delete_backup_package "$file"
    fi
  done < <(list_backup_files_by_type "$backup_type")
}

cleanup_old_backups() {
  title "清理过期备份"

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    log "清理过期每日备份：$file"
    delete_backup_package "$file"
  done < <(find "$BACKUP_ROOT" -type f -name 'lianruan-crm-daily-*.tar.gz' -mtime +"$DAILY_KEEP_DAYS" 2>/dev/null || true)

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    log "清理过期手动备份：$file"
    delete_backup_package "$file"
  done < <(find "$BACKUP_ROOT" -type f -name 'lianruan-crm-manual-*.tar.gz' -mtime +"$MANUAL_KEEP_DAYS" 2>/dev/null || true)

  cleanup_by_count "weekly" "$WEEKLY_KEEP_COUNT"
  cleanup_by_count "monthly" "$MONTHLY_KEEP_COUNT"
  find "$WORK_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +2 -print -exec rm -rf {} \; 2>/dev/null || true
  refresh_backup_catalog

  log "过期备份清理完成"
}

organize_existing_backups() {
  check_environment
  title "整理旧备份文件"

  local file
  local name
  local backup_type
  local date_part
  local year
  local month
  local target_dir
  local target_file
  local moved_count=0

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    name="$(basename "$file")"
    backup_type="$(parse_backup_type_from_name "$name")"
    date_part="$(parse_backup_date_from_name "$name")"

    if [ -z "$backup_type" ] || [ -z "$date_part" ]; then
      warn "跳过无法识别命名的备份包：$file"
      continue
    fi

    year="${date_part:0:4}"
    month="${date_part:4:2}"
    target_dir="$(get_backup_storage_dir_by_parts "$backup_type" "$year" "$month")"
    target_file="${target_dir}/${name}"

    if [ "$file" = "$target_file" ]; then
      continue
    fi

    mkdir -p "$target_dir"

    if [ -f "$target_file" ]; then
      warn "目标文件已存在，跳过：$target_file"
      continue
    fi

    mv "$file" "$target_file"
    if [ -f "${file}.sha256" ]; then
      mv "${file}.sha256" "${target_file}.sha256"
    fi
    moved_count=$((moved_count + 1))
    log "已整理：$(relative_backup_path "$target_file")"
  done < <(find "$BACKUP_ROOT" -maxdepth 1 -type f -name 'lianruan-crm-*.tar.gz' -exec ls -1t {} + 2>/dev/null || true)

  refresh_backup_catalog
  log "整理完成，移动备份包数量：${moved_count}"
}

run_backup() {
  check_environment
  acquire_lock

  local backup_type=""
  local include_node_modules=""
  local timestamp=""
  local backup_name=""
  local project_copy_dir=""
  local db_snapshot_dir=""
  local meta_dir=""
  local package_file=""
  local backup_storage_dir=""
  local exclude_file=""

  cleanup_on_exit() {
    local exit_code=$?
    if [ -n "$CURRENT_WORK_DIR" ] && [ "$KEEP_WORK_DIR" != "1" ]; then
      rm -rf "$CURRENT_WORK_DIR"
    fi
    release_lock
    exit "$exit_code"
  }
  trap cleanup_on_exit EXIT

  backup_type="$(decide_backup_type)"
  include_node_modules="$(should_include_node_modules "$backup_type")"
  timestamp="$(date +%Y%m%d_%H%M%S)"
  backup_name="lianruan-crm-${backup_type}-${timestamp}"
  backup_storage_dir="$(get_backup_storage_dir "$backup_type")"
  CURRENT_WORK_DIR="${WORK_ROOT}/${backup_name}"
  project_copy_dir="${CURRENT_WORK_DIR}/project"
  db_snapshot_dir="${CURRENT_WORK_DIR}/database_snapshot"
  meta_dir="${CURRENT_WORK_DIR}/backup_meta"
  package_file="${backup_storage_dir}/${backup_name}.tar.gz"
  exclude_file="${CURRENT_WORK_DIR}/rsync-exclude.txt"

  title "开始备份"
  log "备份类型：$backup_type"
  log "包含 node_modules：$include_node_modules"
  log "存放目录：$backup_storage_dir"
  log "工作目录：$CURRENT_WORK_DIR"

  mkdir -p "$project_copy_dir" "$db_snapshot_dir" "$meta_dir" "$backup_storage_dir"

  title "在线备份数据库"
  sqlite_online_backup "${PROJECT_DIR}/backend/crm.db" "${db_snapshot_dir}/crm.db" "主业务库"
  sqlite_online_backup "${PROJECT_DIR}/backend/audit.db" "${db_snapshot_dir}/audit.db" "审计库"

  title "同步项目文件"
  build_rsync_excludes "$include_node_modules" "$exclude_file"
  rsync -a --delete --exclude-from="$exclude_file" "${PROJECT_DIR}/" "$project_copy_dir/"
  mkdir -p "${project_copy_dir}/backend"
  cp "${db_snapshot_dir}/crm.db" "${project_copy_dir}/backend/crm.db"
  cp "${db_snapshot_dir}/audit.db" "${project_copy_dir}/backend/audit.db"
  log "项目文件同步完成"

  title "生成备份清单和校验和"
  write_manifest "${meta_dir}/manifest.txt" "$backup_name" "$backup_type" "$include_node_modules" "$package_file"
  write_checksums "$CURRENT_WORK_DIR" "${meta_dir}/SHA256SUMS.txt"
  log "校验和已生成：${meta_dir}/SHA256SUMS.txt"

  title "压缩备份包"
  (
    cd "$WORK_ROOT"
    tar -czf "$package_file" "$backup_name"
  )
  sha256sum "$package_file" > "${package_file}.sha256"
  refresh_backup_catalog
  log "备份包已生成：$package_file"
  log "备份包大小：$(du -h "$package_file" | awk '{print $1}')"

  sync_remote_if_enabled "$package_file"
  cleanup_old_backups

  title "备份完成"
  echo "备份包：$package_file"
  echo "校验文件：${package_file}.sha256"
}

list_backups() {
  mkdir -p "$BACKUP_ROOT"
  write_backup_root_readme
  refresh_backup_catalog
  title "备份列表"

  if [ -z "$(list_backup_files | head -1)" ]; then
    warn "没有找到备份包：$BACKUP_ROOT"
    return
  fi

  printf "%-10s %-10s %-19s %-s\n" "类型" "大小" "备份时间" "相对路径"
  echo "--------------------------------------------------------------------------------"
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    backup_type="$(parse_backup_type_from_name "$file")"
    printf "%-10s %-10s %-19s %-s\n" \
      "$(backup_type_label "$backup_type")" \
      "$(du -h "$file" | awk '{print $1}')" \
      "$(file_mtime_text "$file")" \
      "$(relative_backup_path "$file")"
  done < <(list_backup_files)

  echo ""
  echo "索引文件：${INDEX_DIR}/backup-index.tsv"
  echo "最新备份：${LATEST_DIR}/latest-backup.txt"
}

install_cron() {
  check_environment
  require_command crontab "bash \"${SCRIPT_PATH}\" install-deps"
  start_cron_service

  local cron_log="${LOG_DIR}/backup-cron.log"
  local cron_line="0 1 * * * PROJECT_DIR=\"${PROJECT_DIR}\" BACKUP_ROOT=\"${BACKUP_ROOT}\" /bin/bash \"${SCRIPT_PATH}\" run >> \"${cron_log}\" 2>&1"
  local temp_file
  local filtered_file

  temp_file="$(mktemp)"
  filtered_file="$(mktemp)"

  crontab -l > "$temp_file" 2>/dev/null || true
  grep -v "backup_euler.sh.* run" "$temp_file" > "$filtered_file" || true
  echo "$cron_line" >> "$filtered_file"
  crontab "$filtered_file"

  rm -f "$temp_file" "$filtered_file"

  title "定时任务已安装"
  echo "每天凌晨 1 点执行："
  echo "$cron_line"
  echo ""
  echo "欧拉系统定时任务服务为 crond，Ubuntu 系统定时任务服务为 cron。"
}

show_cron() {
  require_command crontab "bash \"${SCRIPT_PATH}\" install-deps"
  title "当前备份定时任务"
  crontab -l 2>/dev/null | grep "backup_euler.sh" || warn "未找到 backup_euler.sh 定时任务"
}

main() {
  local command="${1:-run}"
  shift || true

  case "$command" in
    run)
      parse_options "$@"
      run_backup
      ;;
    list)
      list_backups
      ;;
    organize)
      organize_existing_backups
      ;;
    check)
      check_environment
      ;;
    install-deps)
      install_dependencies
      ;;
    install-cron)
      install_cron
      ;;
    show-cron)
      show_cron
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
