#!/bin/bash
# 联软渠道管理平台 - 快速部署脚本
# 支持 Ubuntu/Debian/CentOS/RHEL

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
INSTALL_DIR="/opt/lianruan-crm"
PORT=8080
SERVICE_NAME="lianruan-crm"

echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}  联软渠道管理平台 - 部署脚本${NC}"
echo -e "${GREEN}====================================${NC}"
echo ""

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}请使用 sudo 运行此脚本${NC}"
    exit 1
fi

# 检测操作系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
else
    echo -e "${RED}无法检测操作系统${NC}"
    exit 1
fi

echo -e "${YELLOW}检测到操作系统: $OS${NC}"

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 安装依赖
echo ""
echo -e "${YELLOW}[1/5] 安装依赖...${NC}"

if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
    apt-get update -qq
    if ! command -v python3 &> /dev/null; then
        apt-get install -y -qq python3
    fi
elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]] || [[ "$OS" == *"Fedora"* ]]; then
    if ! command -v python3 &> /dev/null; then
        yum install -y -q python3
    fi
else
    echo -e "${YELLOW}未识别的操作系统，尝试使用现有 Python...${NC}"
fi

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}错误: 未找到 Python3，请手动安装${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Python3 已安装${NC}"

# 复制文件
echo ""
echo -e "${YELLOW}[2/5] 复制项目文件...${NC}"

mkdir -p "$INSTALL_DIR"
cp -r "$SCRIPT_DIR/frontend" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/backend" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR"/*.sh "$INSTALL_DIR/" 2>/dev/null || true

echo -e "${GREEN}✓ 文件已复制到 $INSTALL_DIR${NC}"

# 创建 systemd 服务
echo ""
echo -e "${YELLOW}[3/5] 创建系统服务...${NC}"

cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=联软渠道管理平台
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=${INSTALL_DIR}/frontend
ExecStart=/usr/bin/python3 -m http.server ${PORT}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 创建 www-data 用户（如果不存在）
if ! id "www-data" &>/dev/null; then
    useradd -r -s /bin/false www-data
fi

# 设置权限
chown -R www-data:www-data "$INSTALL_DIR"
chmod -R 755 "$INSTALL_DIR"

# 重载 systemd
systemctl daemon-reload
systemctl enable ${SERVICE_NAME}.service

echo -e "${GREEN}✓ 系统服务已创建${NC}"

# 防火墙配置
echo ""
echo -e "${YELLOW}[4/5] 配置防火墙...${NC}"

if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=${PORT}/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    echo -e "${GREEN}✓ firewalld 已配置${NC}"
elif command -v ufw &> /dev/null; then
    ufw allow ${PORT}/tcp 2>/dev/null || true
    echo -e "${GREEN}✓ ufw 已配置${NC}"
else
    echo -e "${YELLOW}! 未检测到防火墙，请手动开放端口 ${PORT}${NC}"
fi

# 启动服务
echo ""
echo -e "${YELLOW}[5/5] 启动服务...${NC}"

systemctl start ${SERVICE_NAME}.service
sleep 2

# 检查服务状态
if systemctl is-active --quiet ${SERVICE_NAME}.service; then
    echo -e "${GREEN}✓ 服务启动成功${NC}"
else
    echo -e "${RED}✗ 服务启动失败，请检查日志: journalctl -u ${SERVICE_NAME}${NC}"
    exit 1
fi

# 获取 IP 地址
IP_ADDR=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}====================================${NC}"
echo ""
echo -e "访问地址: ${YELLOW}http://${IP_ADDR}:${PORT}${NC}"
echo ""
echo -e "默认账号:"
echo -e "  超级管理员: ${YELLOW}admin / 123456${NC}"
echo -e "  渠道伙伴:   ${YELLOW}partner / 123456${NC}"
echo ""
echo -e "服务管理命令:"
echo -e "  查看状态: ${YELLOW}sudo systemctl status ${SERVICE_NAME}${NC}"
echo -e "  停止服务: ${YELLOW}sudo systemctl stop ${SERVICE_NAME}${NC}"
echo -e "  重启服务: ${YELLOW}sudo systemctl restart ${SERVICE_NAME}${NC}"
echo -e "  查看日志: ${YELLOW}sudo journalctl -u ${SERVICE_NAME} -f${NC}"
echo ""
