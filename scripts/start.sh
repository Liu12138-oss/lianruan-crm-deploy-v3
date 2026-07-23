#!/bin/bash
# ================================================================
# 联软安全渠道管理平台 - 一键启动脚本
# ================================================================
# 用法：
#   首次运行：bash start.sh install              # 安装业务依赖 + 初始化备份 + 启动
#   日常启动：bash start.sh                      # 直接启动
#   停止服务：bash start.sh stop
#   重启服务：bash start.sh restart
#   查看状态：bash start.sh status
#   查看日志：bash start.sh logs
#   安装备份：bash start.sh backup-install
#   手动备份：bash start.sh backup
#   备份列表：bash start.sh backup-list
#   恢复演练：bash start.sh backup-restore-test
# ================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
LOG_DIR="$SCRIPT_DIR/logs"
BACKEND_PID_FILE="$SCRIPT_DIR/backend.pid"
FRONTEND_PID_FILE="$SCRIPT_DIR/frontend.pid"
BACKUP_SCRIPT="$SCRIPT_DIR/backup_euler.sh"
RESTORE_SCRIPT="$SCRIPT_DIR/restore_euler.sh"

BACKEND_PORT=${BACKEND_PORT:-3000}
FRONTEND_PORT=${FRONTEND_PORT:-8080}
BACKUP_ROOT=${BACKUP_ROOT:-/home/liulonghai/backup}

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[信息]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[提醒]${NC}  $1"; }
error() { echo -e "${RED}[错误]${NC} $1"; }
title() { echo -e "\n${BLUE}═══════════════════════════════════════${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}═══════════════════════════════════════${NC}"; }

mkdir -p "$LOG_DIR"

show_usage() {
  cat <<EOF
联软安全渠道管理平台 - 一键启动脚本

用法：
  bash start.sh install                         安装业务依赖、初始化备份定时任务并启动服务
  bash start.sh start                           启动服务
  bash start.sh stop                            停止服务
  bash start.sh restart                         重启服务
  bash start.sh status                          查看业务和备份状态
  bash start.sh logs                            查看业务日志和备份定时任务日志

备份入口：
  bash start.sh backup-install                  安装备份依赖并安装每天凌晨 1 点定时任务
  bash start.sh backup-check                    检查备份环境
  bash start.sh backup                          按当天规则执行一次手动备份
  bash start.sh backup --type daily             强制执行日备份，不包含 node_modules
  bash start.sh backup --type weekly            强制执行周备份，包含 node_modules
  bash start.sh backup-list                     查看备份列表
  bash start.sh backup-organize                 整理历史散落备份
  bash start.sh backup-cron                     查看备份定时任务
  bash start.sh backup-verify                   校验最新备份
  bash start.sh backup-restore-test             恢复最新备份到临时目录演练
  bash start.sh backup-restore-live             正式覆盖恢复，执行前必须输入 yes

可覆盖环境变量：
  BACKUP_ROOT=/home/liulonghai/backup
  BACKEND_PORT=3000
  FRONTEND_PORT=8080
EOF
}

run_backup_script() {
  if [ ! -f "$BACKUP_SCRIPT" ]; then
    error "未找到备份脚本：$BACKUP_SCRIPT"
    exit 1
  fi

  PROJECT_DIR="$PROJECT_DIR" BACKUP_ROOT="$BACKUP_ROOT" /bin/bash "$BACKUP_SCRIPT" "$@"
}

run_restore_script() {
  if [ ! -f "$RESTORE_SCRIPT" ]; then
    error "未找到恢复脚本：$RESTORE_SCRIPT"
    exit 1
  fi

  PROJECT_DIR="$PROJECT_DIR" BACKUP_ROOT="$BACKUP_ROOT" /bin/bash "$RESTORE_SCRIPT" "$@"
}

install_backup_quietly() {
  title "初始化备份"

  if [ ! -f "$BACKUP_SCRIPT" ]; then
    warn "未找到备份脚本，跳过备份初始化：$BACKUP_SCRIPT"
    return 0
  fi

  if ! run_backup_script install-deps; then
    warn "备份依赖安装失败，业务服务继续启动；修复后可执行：bash start.sh backup-install"
    return 0
  fi

  if ! run_backup_script install-cron; then
    warn "备份定时任务安装失败，业务服务继续启动；修复后可执行：bash start.sh backup-install"
    return 0
  fi

  log "备份依赖和每天凌晨 1 点定时任务已初始化"
}

install_backup() {
  title "安装备份功能"
  run_backup_script install-deps
  run_backup_script install-cron
}

format_file_time() {
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

relative_to_backup_root() {
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

show_backup_status() {
  title "备份状态"
  echo "  备份目录  $BACKUP_ROOT"

  if [ -f "${BACKUP_ROOT}/latest/latest-backup.txt" ]; then
    local latest_backup
    latest_backup="$(cat "${BACKUP_ROOT}/latest/latest-backup.txt" 2>/dev/null || true)"
    if [ -n "$latest_backup" ] && [ -f "$latest_backup" ]; then
      local latest_size
      local latest_time
      latest_size="$(du -h "$latest_backup" 2>/dev/null | awk '{print $1}')"
      latest_time="$(format_file_time "$latest_backup")"
      echo -e "  最新备份  ${GREEN}● 已生成${NC}  ${latest_time}  ${latest_size:-未知大小}"
      echo "  备份包    $(relative_to_backup_root "$latest_backup")"
    else
      echo -e "  最新备份  ${YELLOW}● 指针异常${NC}  ${latest_backup:-未记录路径}"
    fi
  else
    echo -e "  最新备份  ${YELLOW}● 未发现${NC}  可执行：bash start.sh backup"
  fi

  if command -v crontab &>/dev/null; then
    if crontab -l 2>/dev/null | grep -q "backup_euler.sh.* run"; then
      echo -e "  定时任务  ${GREEN}● 已安装${NC}  每天凌晨 1 点"
    else
      echo -e "  定时任务  ${YELLOW}● 未发现${NC}  可执行：bash start.sh backup-install"
    fi
  else
    echo -e "  定时任务  ${YELLOW}● 未检测${NC}  缺少 crontab，可执行：bash start.sh backup-install"
  fi

  echo "  目录规范  daily/ weekly/ monthly/ manual/ latest/ indexes/ rescue/"
  echo ""
}

# 检查 Node.js
check_node() {
  if ! command -v node &>/dev/null; then
    error "未找到 Node.js，请先安装 Node.js 16 或以上版本"
    echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  CentOS/RHEL:   curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs"
    exit 1
  fi
  log "Node.js 版本: $(node -v)"
}

# 检查 Python3（用于前端静态文件服务）
check_python() {
  if command -v python3 &>/dev/null; then
    log "Python3 版本: $(python3 --version)"
    return 0
  elif command -v python &>/dev/null && python --version 2>&1 | grep -q "3\."; then
    log "Python 版本: $(python --version)"
    return 0
  else
    warn "未找到 Python3，前端将改用 Node.js serve 提供静态文件服务"
    return 1
  fi
}

# 安装后端依赖
install_deps() {
  title "安装依赖"
  log "安装后端依赖（npm install）..."
  (cd "$BACKEND_DIR" && npm install)
  log "依赖安装完成"
}

# 停止服务
stop_services() {
  local stopped=0

  if [ -f "$BACKEND_PID_FILE" ]; then
    local pid=$(cat "$BACKEND_PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      log "后端服务已停止（PID: $pid）"
      stopped=1
    fi
    rm -f "$BACKEND_PID_FILE"
  fi

  if [ -f "$FRONTEND_PID_FILE" ]; then
    local pid=$(cat "$FRONTEND_PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      log "前端服务已停止（PID: $pid）"
      stopped=1
    fi
    rm -f "$FRONTEND_PID_FILE"
  fi

  # 兜底：按端口杀进程
  for port in $BACKEND_PORT $FRONTEND_PORT; do
    local pid=$(lsof -ti :$port 2>/dev/null | head -1)
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null && log "已释放端口 $port（PID: $pid）"
    fi
  done

  [ $stopped -eq 0 ] && log "没有正在运行的服务"
}

# 检查服务是否运行
is_running() {
  [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null
}

# 查看状态
show_status() {
  title "服务状态"
  local host=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

  if is_running "$BACKEND_PID_FILE"; then
    echo -e "  后端 API  ${GREEN}● 运行中${NC}  http://${host}:${BACKEND_PORT}"
  else
    echo -e "  后端 API  ${RED}● 未运行${NC}"
  fi

  if is_running "$FRONTEND_PID_FILE"; then
    echo -e "  前端 Web  ${GREEN}● 运行中${NC}  http://${host}:${FRONTEND_PORT}"
  else
    echo -e "  前端 Web  ${RED}● 未运行${NC}"
  fi

  echo ""
  show_backup_status
}

# 启动后端
start_backend() {
  log "启动后端服务（端口 $BACKEND_PORT）..."
  cd "$BACKEND_DIR"
  PORT=$BACKEND_PORT nohup node server.js >> "$LOG_DIR/backend.log" 2>&1 &
  echo $! > "$BACKEND_PID_FILE"
  sleep 1
  if kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
    log "后端服务启动成功 PID=$(cat "$BACKEND_PID_FILE")"
  else
    error "后端服务启动失败，请查看日志：$LOG_DIR/backend.log"
    exit 1
  fi
}

# 启动前端
start_frontend() {
  log "启动前端静态服务（端口 $FRONTEND_PORT）..."
  cd "$FRONTEND_DIR"

  if command -v python3 &>/dev/null; then
    nohup python3 -m http.server $FRONTEND_PORT --bind 0.0.0.0 >> "$LOG_DIR/frontend.log" 2>&1 &
  elif command -v python &>/dev/null; then
    nohup python -m http.server $FRONTEND_PORT --bind 0.0.0.0 >> "$LOG_DIR/frontend.log" 2>&1 &
  else
    nohup npx --yes serve -s . -l $FRONTEND_PORT >> "$LOG_DIR/frontend.log" 2>&1 &
  fi
  echo $! > "$FRONTEND_PID_FILE"
  sleep 2

  # 检查启动是否成功
  if kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
    log "前端服务启动成功 PID=$(cat "$FRONTEND_PID_FILE")"
  else
    error "前端服务启动失败，请查看日志：$LOG_DIR/frontend.log"
    exit 1
  fi
}

# 显示访问地址
show_urls() {
  local host=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
  title "启动成功"
  echo ""
  echo -e "  ${GREEN}访问地址（局域网可用）：${NC}"
  echo -e "  ┌─────────────────────────────────────────────────────────┐"
  echo -e "  │  统一入口    http://${host}:${FRONTEND_PORT}/login.html"
  echo -e "  │  管理后台    http://${host}:${FRONTEND_PORT}/admin.html"
  echo -e "  │  渠道伙伴    http://${host}:${FRONTEND_PORT}/partner.html"
  echo -e "  │  手机版      http://${host}:${FRONTEND_PORT}/partner-mobile.html"
  echo -e "  └─────────────────────────────────────────────────────────┘"
  echo ""
  echo -e "  ${YELLOW}演示账号：admin / 123456${NC}"
  echo ""
  echo -e "  查看日志：bash start.sh logs"
  echo -e "  停止服务：bash start.sh stop"
  echo -e "  手动备份：bash start.sh backup"
  echo -e "  备份状态：bash start.sh status"
  echo ""
}

# 查看日志
show_logs() {
  echo -e "${BLUE}─── 后端日志（最近50行）───${NC}"
  tail -50 "$LOG_DIR/backend.log" 2>/dev/null || echo "（无日志）"
  echo -e "\n${BLUE}─── 前端日志（最近20行）───${NC}"
  tail -20 "$LOG_DIR/frontend.log" 2>/dev/null || echo "（无日志）"
  echo -e "\n${BLUE}─── 备份定时任务日志（最近50行）───${NC}"
  tail -50 "$BACKUP_ROOT/logs/backup-cron.log" 2>/dev/null || echo "（无日志）"
}

# ── 主逻辑 ──────────────────────────────────────────────────────
CMD="${1:-start}"
if [ $# -gt 0 ]; then
  shift
fi

case "$CMD" in
  install)
    check_node
    install_deps
    install_backup_quietly
    start_backend
    start_frontend
    show_urls
    show_backup_status
    ;;
  start)
    check_node
    if [ ! -d "$BACKEND_DIR/node_modules" ]; then
      warn "未找到 node_modules，正在自动安装依赖..."
      install_deps
    fi
    start_backend
    start_frontend
    show_urls
    show_backup_status
    ;;
  stop)
    stop_services
    ;;
  restart)
    stop_services
    sleep 1
    check_node
    start_backend
    start_frontend
    show_urls
    show_backup_status
    ;;
  status)
    show_status
    ;;
  logs)
    show_logs
    ;;
  backup-install)
    install_backup
    ;;
  backup-check)
    run_backup_script check
    ;;
  backup)
    run_backup_script run "$@"
    ;;
  backup-list)
    run_backup_script list
    ;;
  backup-organize)
    run_backup_script organize
    ;;
  backup-cron)
    run_backup_script show-cron
    ;;
  backup-verify)
    if [ $# -eq 0 ]; then
      run_restore_script verify latest
    else
      run_restore_script verify "$@"
    fi
    ;;
  backup-restore-test)
    if [ $# -eq 0 ]; then
      run_restore_script restore-temp latest
    else
      run_restore_script restore-temp "$@"
    fi
    ;;
  backup-restore-live)
    if [ $# -eq 0 ]; then
      run_restore_script restore-live latest
    else
      run_restore_script restore-live "$@"
    fi
    ;;
  help|--help|-h)
    show_usage
    ;;
  *)
    show_usage
    exit 1
    ;;
esac
