#!/bin/bash
# =========================================
# 联软CRM 回滚脚本
# 用法: bash restore.sh <项目目录> <备份目录>
# 示例: bash restore.sh /home/liulonghai/lianruan-crm-deploy-v2.2.0 \
#             /home/liulonghai/lianruan-crm-deploy-v2.2.0/backups/backup_v2.2.0_before_import_20260420_120000
# =========================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}========================================${NC}"
echo -e "${RED}  联软CRM 回滚操作${NC}"
echo -e "${RED}========================================${NC}"
echo ""

PROJECT_DIR="$1"
BACKUP_DIR="$2"

# 如果没传参数，列出可用备份
if [ -z "$PROJECT_DIR" ] || [ -z "$BACKUP_DIR" ]; then
    if [ -z "$PROJECT_DIR" ]; then
        PROJECT_DIR="/home/liulonghai/lianruan-crm-deploy-v2.2.0"
    fi
    echo "可用的备份目录："
    ls -dt "$PROJECT_DIR/backups/backup_v2.2.0_before_import_"* 2>/dev/null | head -10 || echo "  （无可用备份）"
    echo ""
    echo "用法: bash restore.sh $PROJECT_DIR <备份目录路径>"
    exit 0
fi

# 验证备份目录
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}错误: 备份目录不存在: $BACKUP_DIR${NC}"
    exit 1
fi

echo -e "${YELLOW}将从备份恢复: $BACKUP_DIR${NC}"
echo ""
read -p "确认回滚？(y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "已取消回滚"
    exit 0
fi

# 停止服务
echo -e "${YELLOW}[1/3] 停止后端服务...${NC}"
BACKEND_PID_FILE="$PROJECT_DIR/scripts/backend.pid"
if [ -f "$BACKEND_PID_FILE" ]; then
    OLD_PID=$(cat "$BACKEND_PID_FILE")
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
    echo -e "${GREEN}✓ 服务已停止${NC}"
fi

# 恢复文件
echo -e "${YELLOW}[2/3] 恢复原始文件...${NC}"
[ -f "$BACKUP_DIR/server.js" ]    && cp "$BACKUP_DIR/server.js"    "$PROJECT_DIR/backend/server.js"    && echo "  ✓ server.js"
[ -f "$BACKUP_DIR/package.json" ] && cp "$BACKUP_DIR/package.json" "$PROJECT_DIR/backend/package.json" && echo "  ✓ package.json"
[ -f "$BACKUP_DIR/admin-app.js" ] && cp "$BACKUP_DIR/admin-app.js" "$PROJECT_DIR/frontend/admin-app.js" && echo "  ✓ admin-app.js"
[ -f "$BACKUP_DIR/style.css" ]    && cp "$BACKUP_DIR/style.css"    "$PROJECT_DIR/frontend/style.css"   && echo "  ✓ style.css"

# 重启服务
echo -e "${YELLOW}[3/3] 重启服务...${NC}"
cd "$PROJECT_DIR/backend"
npm install --silent 2>/dev/null || true
nohup node server.js > "$PROJECT_DIR/scripts/logs/backend.log" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PROJECT_DIR/scripts/backend.pid"
sleep 2

if kill -0 "$NEW_PID" 2>/dev/null; then
    echo -e "${GREEN}✓ 服务已重启 (PID: $NEW_PID)${NC}"
else
    echo -e "${RED}✗ 服务启动失败，请查看日志: $PROJECT_DIR/scripts/logs/backend.log${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ 回滚完成！${NC}"
