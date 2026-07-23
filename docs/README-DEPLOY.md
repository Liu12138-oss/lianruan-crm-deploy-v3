# 联软安全渠道管理平台 - 部署说明

## 系统要求

| 软件 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | ≥ 16.x | 运行后端服务 |
| Python3 | ≥ 3.6 | 运行前端静态服务（可选，也可用 Nginx） |
| 操作系统 | Linux (Ubuntu/CentOS/Debian) | 推荐 |

---

## 目录结构

```
security-quoting-system/
├── frontend/          # 前端静态文件
│   ├── login.html     # 统一入口（推荐收藏此页）
│   ├── admin.html     # 厂商管理后台
│   ├── partner.html   # 渠道伙伴电脑版
│   ├── partner-mobile.html  # 渠道伙伴手机版
│   ├── api-client.js  # API 对接层
│   └── style.css
├── backend/           # 后端服务
│   ├── server.js      # 主服务文件
│   ├── data.json      # 数据文件（自动读写）
│   └── package.json
├── logs/              # 运行日志（自动创建）
└── start.sh           # 一键启动脚本
```

---

## 快速部署（推荐）

### 第一步：上传文件

```bash
# 方式一：scp 上传
scp security-quoting-system.tar.gz user@your-server:/opt/

# 方式二：rsync
rsync -avz security-quoting-system/ user@your-server:/opt/security-quoting-system/
```

### 第二步：解压 & 安装

```bash
# 在服务器上执行
cd /opt
tar -xzf security-quoting-system.tar.gz
cd security-quoting-system

# 首次运行（自动安装 npm 依赖并启动）
bash start.sh install
```

### 第三步：访问系统

启动后会显示访问地址，例如：

```
  统一入口    http://192.168.1.100:8080/login.html
  管理后台    http://192.168.1.100:8080/admin.html
  渠道伙伴    http://192.168.1.100:8080/partner.html
  手机版      http://192.168.1.100:8080/partner-mobile.html
```

**默认账号：** `admin / 123456`（超级管理员）

---

## 日常运维命令

```bash
bash start.sh start    # 启动服务
bash start.sh stop     # 停止服务
bash start.sh restart  # 重启服务
bash start.sh status   # 查看运行状态
bash start.sh logs     # 查看运行日志
```

---

## 修改端口

默认端口：前端 **8080**，后端 **3000**

```bash
# 临时修改（本次启动有效）
FRONTEND_PORT=9090 BACKEND_PORT=9000 bash start.sh start

# 永久修改：编辑 start.sh 文件头部
BACKEND_PORT=${BACKEND_PORT:-3000}   # 改为你的端口
FRONTEND_PORT=${FRONTEND_PORT:-8080} # 改为你的端口
```

---

## 使用 Nginx 反向代理（推荐生产环境）

如果服务器安装了 Nginx，推荐用 Nginx 提供前端文件并反代 API，所有请求走标准 80/443 端口。

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或IP

    # 前端静态文件
    root /opt/security-quoting-system/frontend;
    index login.html;

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

使用 Nginx 时，在各 HTML 文件 `<head>` 内追加以下配置，让前端直接访问同域的 `/api/`：

```html
<script>window.API_BASE = '/api';</script>
```

然后安装并启动 Nginx：

```bash
sudo apt install nginx  # Ubuntu
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## 设置开机自启（systemd）

```bash
sudo tee /etc/systemd/system/ruanruan-quoting.service <<EOF
[Unit]
Description=联软渠道管理平台
After=network.target

[Service]
Type=forking
WorkingDirectory=/opt/security-quoting-system
ExecStart=/bin/bash /opt/security-quoting-system/start.sh start
ExecStop=/bin/bash /opt/security-quoting-system/start.sh stop
Restart=on-failure
User=nobody

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ruanruan-quoting
sudo systemctl start ruanruan-quoting
```

---

## 防火墙设置

```bash
# Ubuntu (ufw)
sudo ufw allow 8080/tcp
sudo ufw allow 3000/tcp

# CentOS (firewalld)
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

---

## 数据备份

数据存储在 `backend-simple/data.json`，定期备份此文件即可：

```bash
# 手动备份
cp backend-simple/data.json "backup-$(date +%Y%m%d-%H%M%S).json"

# 定时备份（crontab）
# 每天凌晨 2 点备份
0 2 * * * cp /opt/security-quoting-system/backend-simple/data.json /opt/backups/data-$(date +\%Y\%m\%d).json
```

---

## 常见问题

**Q: 端口被占用怎么办？**
```bash
# 查看占用端口的进程
lsof -i :3000
lsof -i :8080
# 停止冲突进程，或修改 start.sh 中的端口配置
```

**Q: Node.js 如何安装？**
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# 验证
node -v && npm -v
```

**Q: 数据丢失了怎么办？**

检查 `backend-simple/data.json` 是否存在且格式正确。服务每次写入数据时会自动保存到此文件，只要文件存在即可恢复。

---

## 演示账号

| 账号 | 密码 | 角色 | 说明 |
|------|------|------|------|
| admin | 123456 | 超级管理员 | 全权管理，登录 admin.html |
| admin_sd | 123456 | 区域管理员 | 山东区，登录 admin.html |
| liujg | 123456 | 渠道员工 | 北京安盾网络，登录 partner.html |
| wangxh | 123456 | 渠道员工 | 上海锐行信息，登录 partner.html |
| cz_admin | 123456 | 企业管理员 | P004渠道商，登录 partner.html |
