#!/bin/bash
# 联软渠道管理平台 - 一键安装脚本
# 适用：全新部署

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 检测是否 root 用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${YELLOW}提示: 建议使用 sudo 运行以获得最佳权限${NC}"
        echo ""
    fi
}

# 检测系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        OS="unknown"
    fi
    echo -e "检测系统: ${CYAN}${OS}${NC}"
}

# 安装依赖
install_deps() {
    echo ""
    echo -e "${YELLOW}[1/5] 安装系统依赖...${NC}"

    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        echo -e "  ✓ Node.js 已安装: $NODE_VERSION"
    else
        echo -e "  ${RED}✗ Node.js 未安装${NC}"
        echo -e "  请先安装 Node.js: ${CYAN}curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs${NC}"
        exit 1
    fi

    if command -v python3 &> /dev/null; then
        PY_VERSION=$(python3 --version)
        echo -e "  ✓ Python3 已安装: $PY_VERSION"
    else
        echo -e "  ${RED}✗ Python3 未安装${NC}"
        exit 1
    fi
}

# 创建目录
create_dirs() {
    echo ""
    echo -e "${YELLOW}[2/5] 创建目录结构...${NC}"

    INSTALL_DIR="/var/www/lianruan-crm"

    # 如果不是 root 用户，使用家目录
    if [ "$EUID" -ne 0 ]; then
        INSTALL_DIR="$HOME/lianruan-crm"
    fi

    echo -e "  安装目录: ${CYAN}${INSTALL_DIR}${NC}"
    read -p "  使用默认目录? [Y/n]: " use_default
    if [ "$use_default" = "n" ] || [ "$use_default" = "N" ]; then
        read -p "  请输入安装目录: " INSTALL_DIR
    fi

    mkdir -p "$INSTALL_DIR"
    echo -e "  ✓ 目录创建完成"
}

# 复制文件
copy_files() {
    echo ""
    echo -e "${YELLOW}[3/5] 复制文件...${NC}"

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # 复制前端
    if [ -d "${SCRIPT_DIR}/frontend" ]; then
        rm -rf "${INSTALL_DIR}/frontend" 2>/dev/null || true
        cp -r "${SCRIPT_DIR}/frontend" "${INSTALL_DIR}/"
        echo "  ✓ 前端文件"
    fi

    # 复制后端
    if [ -d "${SCRIPT_DIR}/backend" ]; then
        rm -rf "${INSTALL_DIR}/backend" 2>/dev/null || true
        cp -r "${SCRIPT_DIR}/backend" "${INSTALL_DIR}/"
        echo "  ✓ 后端文件"
    fi

    # 复制脚本
    if [ -d "${SCRIPT_DIR}/scripts" ]; then
        cp "${SCRIPT_DIR}/scripts/"*.sh "${INSTALL_DIR}/" 2>/dev/null || true
        chmod +x "${INSTALL_DIR}/"*.sh 2>/dev/null || true
        echo "  ✓ 脚本文件"
    fi

    echo -e "  ✓ 文件复制完成"
}

# 安装后端依赖
install_backend() {
    echo ""
    echo -e "${YELLOW}[4/5] 安装后端依赖...${NC}"

    cd "${INSTALL_DIR}/backend"
    npm install --silent 2>/dev/null || npm install
    cd ..

    echo -e "  ✓ 依赖安装完成"
}

# 配置服务
configure_service() {
    echo ""
    echo -e "${YELLOW}[5/5] 配置服务...${NC}"

    # 检查是否有 systemd
    if command -v systemctl &> /dev/null; then
        cat > /tmp/lianruan-crm.service << EOF
[Unit]
Description=联软渠道管理平台
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=${INSTALL_DIR}/backend
ExecStart=/usr/bin/node ${INSTALL_DIR}/backend/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

        read -p "  是否配置 systemd 服务? [y/N]: " configure_systemd
        if [ "$configure_systemd" = "y" ] || [ "$configure_systemd" = "Y" ]; then
            sudo cp /tmp/lianruan-crm.service /etc/systemd/system/
            sudo systemctl daemon-reload
            sudo systemctl enable lianruan-crm
            sudo systemctl start lianruan-crm
            echo -e "  ✓ 服务已配置并启动"
        fi
    fi

    echo -e "  ✓ 配置完成"
}

# 启动服务
start_services() {
    echo ""
    echo -e "${GREEN}启动服务...${NC}"

    # 启动后端
    cd "${INSTALL_DIR}/backend"
    nohup node server.js > /tmp/lianruan-crm-backend.log 2>&1 &
    BACKEND_PID=$!
    sleep 2

    # 检查后端是否启动成功
    if ps -p $BACKEND_PID > /dev/null; then
        echo -e "  ✓ 后端服务已启动 (PID: $BACKEND_PID)"
    else
        echo -e "  ${RED}✗ 后端服务启动失败，请检查日志: /tmp/lianruan-crm-backend.log${NC}"
    fi

    # 启动前端（Python HTTP 服务器）
    cd "${INSTALL_DIR}/frontend"
    nohup python3 -m http.server 8080 > /tmp/lianruan-crm-frontend.log 2>&1 &
    FRONTEND_PID=$!
    sleep 1

    if ps -p $FRONTEND_PID > /dev/null; then
        echo -e "  ✓ 前端服务已启动 (PID: $FRONTEND_PID)"
    else
        echo -e "  ${RED}✗ 前端服务启动失败${NC}"
    fi
}

# 显示完成信息
show_complete() {
    echo ""
    echo -e "${GREEN}====================================${NC}"
    echo -e "${GREEN}  安装完成！${NC}"
    echo -e "${GREEN}====================================${NC}"
    echo ""
    echo -e "  安装目录: ${CYAN}${INSTALL_DIR}${NC}"
    echo ""
    echo -e "  访问地址:"
    echo -e "    统一入口: ${CYAN}http://你的服务器IP:8080/login.html${NC}"
    echo -e "    管理后台: ${CYAN}http://你的服务器IP:8080/admin.html${NC}"
    echo -e "    渠道伙伴: ${CYAN}http://你的服务器IP:8080/partner.html${NC}"
    echo ""
    echo -e "  演示账号:"
    echo -e "    超级管理员: ${CYAN}admin / 123456${NC}"
    echo -e "    区域管理员: ${CYAN}admin_sd / 123456${NC}"
    echo -e "    渠道员工: ${CYAN}liujg / 123456${NC}"
    echo ""
    echo -e "  日志文件:"
    echo -e "    后端: ${CYAN}/tmp/lianruan-crm-backend.log${NC}"
    echo -e "    前端: ${CYAN}/tmp/lianruan-crm-frontend.log${NC}"
    echo ""
    echo -e "  常用命令:"
    echo -e "    重启后端: ${CYAN}cd ${INSTALL_DIR}/backend && node server.js${NC}"
    echo -e "    重启前端: ${CYAN}cd ${INSTALL_DIR}/frontend && python3 -m http.server 8080${NC}"
    echo ""
}

# 主流程
main() {
    clear
    echo -e "${GREEN}====================================${NC}"
    echo -e "${GREEN}  联软渠道管理平台 - 一键安装${NC}"
    echo -e "${GREEN}  v2.2.0 (Vue 3 + Node.js)${NC}"
    echo -e "${GREEN}====================================${NC}"
    echo ""

    check_root
    detect_os
    install_deps
    create_dirs
    copy_files
    install_backend
    configure_service
    start_services
    show_complete
}

main "$@"
