#!/bin/bash
# =========================================
# 联软CRM v2.3.0 批量导入功能升级脚本
# =========================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 显示信息
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  联软CRM v2.3.0 批量导入功能升级${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查参数
if [ -z "$1" ]; then
    echo -e "${RED}错误: 请指定项目路径${NC}"
    echo "用法: bash upgrade.sh /home/liulonghai/lianruan-crm-deploy-v2.2.0"
    exit 1
fi

PROJECT_DIR="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 验证项目路径
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}错误: 项目路径不存在: $PROJECT_DIR${NC}"
    exit 1
fi

if [ ! -f "$PROJECT_DIR/backend/server.js" ]; then
    echo -e "${RED}错误: 找不到 backend/server.js，不是有效的项目目录${NC}"
    exit 1
fi

if [ ! -f "$PROJECT_DIR/frontend/admin-app.js" ]; then
    echo -e "${RED}错误: 找不到 frontend/admin-app.js，不是有效的项目目录${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 项目路径验证通过${NC}"
echo "  项目目录: $PROJECT_DIR"
echo ""

# Step 1: 创建备份
echo -e "${YELLOW}Step 1: 创建备份...${NC}"
BACKUP_DIR="$PROJECT_DIR/backups/backup_v2.3.0_$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

cp "$PROJECT_DIR/backend/server.js" "$BACKUP_DIR/server.js.bak"
cp "$PROJECT_DIR/frontend/admin-app.js" "$BACKUP_DIR/admin-app.js.bak"
cp "$PROJECT_DIR/backend/package.json" "$BACKUP_DIR/package.json.bak"
cp "$PROJECT_DIR/frontend/style.css" "$BACKUP_DIR/style.css.bak"

echo -e "${GREEN}✓ 备份已保存到: $BACKUP_DIR${NC}"
echo ""

# Step 2: 停服
echo -e "${YELLOW}Step 2: 停止服务...${NC}"
cd "$PROJECT_DIR/scripts"
if [ -f "start.sh" ]; then
    bash start.sh stop 2>/dev/null || true
    echo -e "${GREEN}✓ 服务已停止${NC}"
else
    echo -e "${YELLOW}警告: 未找到 start.sh 脚本，请手动停止服务${NC}"
fi
echo ""

# Step 3: 替换后端文件
echo -e "${YELLOW}Step 3: 替换后端文件...${NC}"
if [ -f "$SCRIPT_DIR/server.js" ]; then
    cp "$SCRIPT_DIR/server.js" "$PROJECT_DIR/backend/server.js"
    echo -e "${GREEN}✓ backend/server.js 已更新${NC}"
else
    echo -e "${RED}错误: 找不到升级文件 server.js${NC}"
    exit 1
fi

# 更新 package.json 添加新依赖
if [ -f "$SCRIPT_DIR/package.json" ]; then
    cp "$SCRIPT_DIR/package.json" "$PROJECT_DIR/backend/package.json"
    echo -e "${GREEN}✓ backend/package.json 已更新${NC}"
fi
echo ""

# Step 4: 替换前端文件
echo -e "${YELLOW}Step 4: 替换前端文件...${NC}"
if [ -f "$SCRIPT_DIR/admin-app.js" ]; then
    cp "$SCRIPT_DIR/admin-app.js" "$PROJECT_DIR/frontend/admin-app.js"
    echo -e "${GREEN}✓ frontend/admin-app.js 已更新${NC}"
else
    echo -e "${RED}错误: 找不到升级文件 admin-app.js${NC}"
    exit 1
fi

if [ -f "$SCRIPT_DIR/style.css" ]; then
    cp "$SCRIPT_DIR/style.css" "$PROJECT_DIR/frontend/style.css"
    echo -e "${GREEN}✓ frontend/style.css 已更新${NC}"
fi
echo ""

# Step 5: 安装新依赖
echo -e "${YELLOW}Step 5: 安装新依赖 (xlsx, multer)...${NC}"
cd "$PROJECT_DIR/backend"
npm install --silent 2>/dev/null || npm install
echo -e "${GREEN}✓ 依赖安装完成${NC}"
echo ""

# Step 6: 启服
echo -e "${YELLOW}Step 6: 启动服务...${NC}"
cd "$PROJECT_DIR/scripts"
if [ -f "start.sh" ]; then
    bash start.sh start 2>/dev/null || true
    echo -e "${GREEN}✓ 服务已启动${NC}"
else
    echo -e "${YELLOW}警告: 未找到 start.sh 脚本，请手动启动服务${NC}"
fi
echo ""

# Step 7: 验证
echo -e "${YELLOW}Step 7: 验证功能...${NC}"
sleep 2

# 测试API
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/import/partners/template | grep -q "200\|302\|503"; then
    echo -e "${GREEN}✓ API服务正常${NC}"
else
    echo -e "${YELLOW}⚠ API响应异常，请检查服务状态${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  升级完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "备份目录: $BACKUP_DIR"
echo ""
echo "如需回滚，执行:"
echo "  cd $PROJECT_DIR/scripts"
echo "  bash restore.sh backup_v2.3.0_$TIMESTAMP"
echo ""
echo "新功能入口:"
echo "  - 商机管理 → 商机导入"
echo "  - 客户报备 → 报备导入"
echo "  - 渠道商管理 → 渠道商导入"
echo "  - 账号管理 → 员工导入"
echo ""
