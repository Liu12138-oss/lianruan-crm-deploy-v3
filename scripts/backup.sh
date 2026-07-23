#!/bin/bash
# ================================================================
# 联软渠道管理平台 - 自动备份脚本
# ================================================================
# 功能：
#   - 备份完整项目目录
#   - 单独备份 data.json（最重要）
#   - 自动清理过期备份
# ================================================================
# 使用方法：
#   ./backup.sh                    # 执行备份
#   ./backup.sh --list            # 查看备份列表
#   ./backup.sh --restore 20260413 # 恢复到指定日期
# ================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_ROOT="/opt/lianruan-crm-backups"

# 备份保留策略
DAILY_KEEP=7      # 每日备份保留天数
WEEKLY_KEEP=4     # 每周备份保留份数
MONTHLY_KEEP=12   # 每月备份保留份数

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
title() { echo -e "\n${BLUE}═══════════════════════════════════════${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}═══════════════════════════════════════${NC}"; }

# 创建备份目录
mkdir -p "$BACKUP_ROOT"

# ================================================================
# 执行备份
# ================================================================
do_backup() {
  title "开始备份"

  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  DATE_STR=$(date +%Y%m%d)
  DAY_OF_WEEK=$(date +%u)  # 1=周一, 7=周日
  DAY_OF_MONTH=$(date +%d)

  BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
  BACKUP_DATA="${BACKUP_ROOT}/data-${TIMESTAMP}.json"

  # 确定备份类型
  if [ "$DAY_OF_WEEK" = "1" ]; then
    BACKUP_TYPE="weekly"
    TYPE_DESC="每周备份"
  elif [ "$DAY_OF_MONTH" = "01" ]; then
    BACKUP_TYPE="monthly"
    TYPE_DESC="每月备份"
  else
    BACKUP_TYPE="daily"
    TYPE_DESC="每日备份"
  fi

  echo "备份类型: ${TYPE_DESC}"
  echo "备份目录: ${BACKUP_DIR}"

  # 检查项目目录
  if [ ! -d "$PROJECT_DIR" ]; then
    error "项目目录不存在: $PROJECT_DIR"
    exit 1
  fi

  # 检查 data.json
  DATA_FILE="${PROJECT_DIR}/backend/data.json"
  if [ ! -f "$DATA_FILE" ]; then
    warn "data.json 文件不存在，跳过数据备份"
  else
    DATA_SIZE=$(ls -lh "$DATA_FILE" | awk '{print $5}')
    log "数据文件大小: $DATA_SIZE"
  fi

  # 1. 备份完整项目目录（排除大文件和临时文件）
  log "正在备份项目目录..."
  rsync -a \
    --exclude='node_modules' \
    --exclude='logs' \
    --exclude='*.log' \
    --exclude='*.pid' \
    --exclude='*.bak' \
    --exclude='.git' \
    "$PROJECT_DIR/" "$BACKUP_DIR/"

  if [ $? -eq 0 ]; then
    log "项目目录备份完成"
  else
    error "项目目录备份失败"
    exit 1
  fi

  # 2. 单独备份 data.json（最重要！）
  if [ -f "$DATA_FILE" ]; then
    log "正在备份 data.json..."
    cp "$DATA_FILE" "$BACKUP_DATA"
    
    # 验证备份
    if python3 -c "import json; json.load(open('$BACKUP_DATA'))" 2>/dev/null; then
      log "data.json 备份验证通过"
    else
      error "data.json 备份可能损坏！"
      rm -f "$BACKUP_DATA"
      exit 1
    fi
  fi

  # 3. 记录备份信息
  cat > "${BACKUP_ROOT}/.backup_manifest" << EOF
TIMESTAMP=${TIMESTAMP}
DATE=${DATE_STR}
TYPE=${BACKUP_TYPE}
PROJECT_VERSION=$(cat "${PROJECT_DIR}/docs/CHANGELOG.md" 2>/dev/null | grep -A1 "## \[" | head -2 | tail -1 | sed 's/.*\[//' | sed 's/\].*//' || echo "unknown")
DATA_SIZE=${DATA_SIZE:-"N/A"}
CREATED_AT=$(date '+%Y-%m-%d %H:%M:%S')
EOF

  # 4. 清理过期备份
  log "正在清理过期备份..."
  cleanup_old_backups

  echo ""
  title "备份完成"
  echo ""
  echo -e "  备份目录: ${GREEN}${BACKUP_DIR}${NC}"
  echo -e "  数据备份: ${GREEN}${BACKUP_DATA}${NC}"
  echo ""
  echo "  备份类型: ${TYPE_DESC}"
  echo "  建议执行: bash start.sh status 确认服务运行正常"
  echo ""
}

# ================================================================
# 清理过期备份
# ================================================================
cleanup_old_backups() {
  local today=$(date +%Y%m%d)
  local count=0

  # 获取所有备份目录，按时间排序
  local backups=($(ls -dt "$BACKUP_ROOT"/2???-??-??_?????? 2>/dev/null || true))

  # 分类备份
  local daily_backups=()
  local weekly_backups=()
  local monthly_backups=()

  for backup in "${backups[@]}"; do
    local dir_name=$(basename "$backup")
    local backup_date="${dir_name:0:8}"

    # 计算日期差
    local day_diff=$(( ($(date -d "$today" +%s) - $(date -d "$backup_date" +%s) ) / 86400 ))

    if [ $day_diff -le $DAILY_KEEP ]; then
      daily_backups+=("$backup")
    elif [ $day_diff -le $((DAILY_KEEP * 5)) ] && [ $(date -d "$backup_date" +%u) -eq 1 ]; then
      weekly_backups+=("$backup")
    elif [ $day_diff -le $((MONTHLY_KEEP * 30)) ] && [ $(date -d "$backup_date" +%d) -eq 1 ]; then
      monthly_backups+=("$backup")
    else
      # 超期备份，删除
      log "清理过期备份: $backup"
      rm -rf "$backup"
      
      # 同时删除对应的 data.json 备份
      rm -f "${BACKUP_ROOT}/data-${dir_name}.json"
      count=$((count + 1))
    fi
  done

  if [ $count -eq 0 ]; then
    log "无需清理过期备份"
  else
    log "已清理 $count 个过期备份"
  fi
}

# ================================================================
# 查看备份列表
# ================================================================
do_list() {
  title "备份列表"

  echo ""
  echo -e "  ${YELLOW}备份目录: ${BACKUP_ROOT}${NC}"
  echo ""

  if [ ! -d "$BACKUP_ROOT" ] || [ -z "$(ls -A "$BACKUP_ROOT" | grep -E '^[0-9]{8}_[0-9]{6}$' || true)" ]; then
    warn "没有找到备份"
    return
  fi

  printf "  %-20s %-12s %-15s %-15s\n" "备份时间" "类型" "数据大小" "项目版本"
  echo "  --------------------------------------------------------------------------"

  for dir in $(ls -dt "$BACKUP_ROOT"/2???-??-??_?????? 2>/dev/null || true); do
    local dir_name=$(basename "$dir")
    local data_file="${BACKUP_ROOT}/data-${dir_name}.json"

    # 确定类型
    local manifest="${dir}/.backup_manifest"
    if [ -f "$manifest" ]; then
      local btype=$(grep "^TYPE=" "$manifest" 2>/dev/null | cut -d= -f2 || echo "unknown")
    else
      local btype="unknown"
    fi

    # 获取数据大小
    if [ -f "$data_file" ]; then
      local dsize=$(ls -lh "$data_file" | awk '{print $5}')
    else
      local dsize="-"
    fi

    # 获取版本
    local version=""
    if [ -f "${dir}/docs/CHANGELOG.md" ]; then
      version=$(grep -A1 "^## \[" "${dir}/docs/CHANGELOG.md" | head -2 | tail -1 | sed 's/.*\[//' | sed 's/\].*//' || echo "")
    fi

    printf "  %-20s %-12s %-15s %-15s\n" \
      "$dir_name" "$btype" "$dsize" "${version:-"-"}"
  done

  echo ""
  echo "  保留策略：每日 ${DAILY_KEEP} 天 | 每周 ${WEEKLY_KEEP} 份 | 每月 ${MONTHLY_KEEP} 份"
  echo ""
}

# ================================================================
# 恢复备份
# ================================================================
do_restore() {
  local restore_timestamp="$1"

  if [ -z "$restore_timestamp" ]; then
    echo "用法: $0 --restore <备份时间戳>"
    echo "  例如: $0 --restore 20260413_020000"
    echo ""
    echo "可用备份："
    ls -1 "$BACKUP_ROOT"/2???-??-??_?????? 2>/dev/null || echo "  无"
    exit 1
  fi

  title "恢复备份"
  warn "此操作将用备份覆盖当前数据，是否继续？"
  echo ""
  read -p "输入 'yes' 确认恢复: " confirm

  if [ "$confirm" != "yes" ]; then
    echo "取消恢复操作"
    exit 0
  fi

  local backup_dir="${BACKUP_ROOT}/${restore_timestamp}"
  local backup_data="${BACKUP_ROOT}/data-${restore_timestamp}.json"

  if [ ! -d "$backup_dir" ]; then
    error "备份不存在: $backup_dir"
    exit 1
  fi

  # 1. 停止服务
  log "停止服务..."
  cd "$PROJECT_DIR/scripts"
  bash start.sh stop 2>/dev/null || true

  # 2. 备份当前数据（以防万一）
  if [ -f "${PROJECT_DIR}/backend/data.json" ]; then
    local current_backup="${BACKUP_ROOT}/pre-restore-$(date +%Y%m%d_%H%M%S).json"
    cp "${PROJECT_DIR}/backend/data.json" "$current_backup"
    log "当前数据已备份到: $current_backup"
  fi

  # 3. 恢复项目文件
  log "恢复项目文件..."
  rsync -a --exclude='data.json' "$backup_dir/" "$PROJECT_DIR/"

  # 4. 恢复数据文件
  if [ -f "$backup_data" ]; then
    log "恢复数据文件..."
    cp "$backup_data" "${PROJECT_DIR}/backend/data.json"
  fi

  # 5. 重启服务
  log "重启服务..."
  bash start.sh start

  title "恢复完成"
  echo ""
  echo -e "  备份来源: ${GREEN}${restore_timestamp}${NC}"
  echo -e "  项目已恢复到备份时的状态"
  echo ""
}

# ================================================================
# 主逻辑
# ================================================================
case "${1:-}" in
  --backup|-b)
    do_backup
    ;;
  --list|-l)
    do_list
    ;;
  --restore|-r)
    do_restore "$2"
    ;;
  --help|-h)
    echo "联软渠道管理平台 - 备份脚本"
    echo ""
    echo "用法:"
    echo "  $0                    执行备份"
    echo "  $0 --list            查看备份列表"
    echo "  $0 --restore <时间戳> 恢复到指定备份"
    echo ""
    echo "备份位置: $BACKUP_ROOT"
    echo ""
    ;;
  *)
    # 默认执行备份
    do_backup
    ;;
esac
