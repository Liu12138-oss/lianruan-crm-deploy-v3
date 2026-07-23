#!/bin/bash
# 联软CRM v2.2.0 批量导入功能升级脚本
# 日期：2026-04-20

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [ -z "$1" ]; then
    echo "用法: bash upgrade.sh <项目目录>"
    echo "示例: bash upgrade.sh /home/liulonghai/lianruan-crm-deploy-v2.2.0"
    exit 1
fi

PROJECT_DIR="$1"
PROJECT_DIR=$(cd "$PROJECT_DIR" && pwd)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log_info "=========================================="
log_info "联软CRM 批量导入功能升级程序"
log_info "=========================================="
log_info "项目目录: $PROJECT_DIR"
log_info ""

# 1. 检查项目目录
log_info "[1/5] 检查项目目录..."
if [ ! -d "$PROJECT_DIR" ]; then
    log_error "项目目录不存在: $PROJECT_DIR"
    exit 1
fi
if [ ! -f "$PROJECT_DIR/backend/server.js" ]; then
    log_error "backend/server.js 不存在"
    exit 1
fi
if [ ! -f "$PROJECT_DIR/frontend/admin-app.js" ]; then
    log_error "frontend/admin-app.js 不存在"
    exit 1
fi
log_info "项目目录检查通过"

# 2. 备份
log_info ""
log_info "[2/5] 备份当前文件..."
BACKUP_DIR="$PROJECT_DIR/backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp "$PROJECT_DIR/backend/server.js" "$BACKUP_DIR/server.js.bak"
cp "$PROJECT_DIR/frontend/admin-app.js" "$BACKUP_DIR/admin-app.js.bak"
log_info "备份已保存到: $BACKUP_DIR"

# 3. 停止服务
log_info ""
log_info "[3/5] 停止服务..."
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "python.*http.server" 2>/dev/null || true
sleep 2
log_info "服务已停止"

# 4. 复制新文件
log_info ""
log_info "[4/5] 复制新文件..."
cp "$SCRIPT_DIR/files/server.js" "$PROJECT_DIR/backend/server.js"
cp "$SCRIPT_DIR/files/admin-app.js" "$PROJECT_DIR/frontend/admin-app.js"
if [ -f "$SCRIPT_DIR/files/style.css" ]; then
    cp "$SCRIPT_DIR/files/style.css" "$PROJECT_DIR/frontend/style.css"
fi
log_info "文件复制完成"

# 5. 验证
log_info ""
log_info "[5/5] 验证升级..."
if grep -q "/api/import" "$PROJECT_DIR/backend/server.js"; then
    log_info "批量导入API已添加 ✓"
else
    log_error "批量导入API未找到"
fi

# 6. 启动服务
log_info ""
log_warn "=========================================="
log_warn "升级完成！正在启动服务..."
log_warn "=========================================="

cd "$PROJECT_DIR/backend"
nohup node server.js > /dev/null 2>&1 &
BACKEND_PID=$!
log_info "后端服务已启动 (PID: $BACKEND_PID)"

sleep 2

cd "$PROJECT_DIR/frontend"
nohup python -m http.server 8080 > /dev/null 2>&1 &
FRONTEND_PID=$!
log_info "前端服务已启动 (PID: $FRONTEND_PID)"

log_info ""
log_info "=========================================="
log_info "升级成功完成！"
log_info "=========================================="
log_info ""
log_info "访问地址:"
log_info "  前端: http://localhost:8080"
log_info "  后端API: http://localhost:3000/api"
log_info ""
log_info "备份目录: $BACKUP_DIR"
log_info ""
log_info "如需回滚，执行:"
log_info "  cp $BACKUP_DIR/server.js.bak $PROJECT_DIR/backend/server.js"
log_info "  cp $BACKUP_DIR/admin-app.js.bak $PROJECT_DIR/frontend/admin-app.js"
