#!/bin/bash
# =========================================
# 联软CRM 回滚脚本
# =========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  联软CRM 回滚工具${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查参数
if [ -z "$1" ]; then
    echo -e "${RED}错误: 请指定备份目录名称${NC}"
    echo "用法: bash restore.sh backup_v2.3.0_20260420_120000"
    echo ""
    echo "可用的备份:"
    BACKUP_BASE="$(cd "$(dirname "$0")/.." && pwd)/backups"
    if [ -d "$BACKUP_BASE" ]; then
        ls -1 "$BACKUP_BASE" | grep backup_v2.3.0 || echo "  无v2.3.0备份"
    fi
    exit 1
fi

BACKUP_NAME="$1"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$PROJECT_DIR/backups/$BACKUP_NAME"

if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}错误: 备份目录不存在: $BACKUP_DIR${NC}"
    exit 1
fi

echo "备份目录: $BACKUP_DIR"
echo ""

echo -e "${YELLOW}警告: 此操作将恢复以下文件到备份版本:${NC}"
echo "  - backend/server.js"
echo "  - frontend/admin-app.js"
echo "  - backend/package.json"
echo "  - frontend/style.css"
echo ""
read -p "确认继续? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "操作已取消"
    exit 0
fi

# Step 1: 停服
echo ""
echo -e "${YELLOW}Step 1: 停止服务...${NC}"
cd "$PROJECT_DIR/scripts"
if [ -f "start.sh" ]; then
    bash start.sh stop 2>/dev/null || true
    echo -e "${GREEN}✓ 服务已停止${NC}"
fi

# Step 2: 还原文件
echo ""
echo -e "${YELLOW}Step 2: 还原文件...${NC}"

[ -f "$BACKUP_DIR/server.js.bak" ] && cp "$BACKUP_DIR/server.js.bak" "$PROJECT_DIR/backend/server.js" && echo -e "${GREEN}✓ backend/server.js 已还原${NC}"
[ -f "$BACKUP_DIR/admin-app.js.bak" ] && cp "$BACKUP_DIR/admin-app.js.bak" "$PROJECT_DIR/frontend/admin-app.js" && echo -e "${GREEN}✓ frontend/admin-app.js 已还原${NC}"
[ -f "$BACKUP_DIR/package.json.bak" ] && cp "$BACKUP_DIR/package.json.bak" "$PROJECT_DIR/backend/package.json" && echo -e "${GREEN}✓ backend/package.json 已还原${NC}"
[ -f "$BACKUP_DIR/style.css.bak" ] && cp "$BACKUP_DIR/style.css.bak" "$PROJECT_DIR/frontend/style.css" && echo -e "${GREEN}✓ frontend/style.css 已还原${NC}"

# Step 3: 重新安装依赖
echo ""
echo -e "${YELLOW}Step 3: 重新安装依赖...${NC}"
cd "$PROJECT_DIR/backend"
npm install --silent 2>/dev/null || npm install
echo -e "${GREEN}✓ 依赖已更新${NC}"

# Step 4: 启服
echo ""
echo -e "${YELLOW}Step 4: 启动服务...${NC}"
cd "$PROJECT_DIR/scripts"
if [ -f "start.sh" ]; then
    bash start.sh start 2>/dev/null || true
    echo -e "${GREEN}✓ 服务已启动${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  回滚完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "已回滚到: $BACKUP_NAME"
echo ""
