# 联软渠道管理平台 - 局域网部署指南

## 系统架构

- **前端**: Vue 3 + Vue Router + Element Plus (CDN 版本)
- **后端**: 无（纯前端应用，数据存储在浏览器 localStorage）
- **部署方式**: 静态文件服务器

## 部署步骤

### 方法一：使用 Python HTTP 服务器（推荐，最简单）

**要求**: 目标机器安装 Python 3

```bash
# 1. 复制项目到服务器
cp -r security-quoting-system /opt/lianruan-crm/

# 2. 进入前端目录
cd /opt/lianruan-crm/frontend

# 3. 启动 HTTP 服务器（端口可自定义）
python3 -m http.server 8080

# 4. 后台运行（Linux/Mac）
nohup python3 -m http.server 8080 > /var/log/lianruan-crm.log 2>&1 &
```

访问地址: `http://服务器IP:8080`

---

### 方法二：使用 Nginx（生产环境推荐）

**1. 安装 Nginx**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

**2. 复制项目文件**

```bash
sudo mkdir -p /var/www/lianruan-crm
sudo cp -r security-quoting-system/frontend/* /var/www/lianruan-crm/
sudo chown -R www-data:www-data /var/www/lianruan-crm
```

**3. 配置 Nginx**

创建配置文件 `/etc/nginx/sites-available/lianruan-crm`：

```nginx
server {
    listen 80;
    server_name _;  # 监听所有域名/IP
    
    root /var/www/lianruan-crm;
    index index.html;
    
    # 开启 gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    
    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # 前端路由支持（Vue Router hash 模式不需要此配置）
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**4. 启用配置**

```bash
sudo ln -s /etc/nginx/sites-available/lianruan-crm /etc/nginx/sites-enabled/
sudo nginx -t  # 测试配置
sudo systemctl restart nginx
```

---

### 方法三：使用 Windows IIS

**1. 安装 IIS**
- 控制面板 → 程序 → 启用或关闭 Windows 功能
- 勾选 "Internet Information Services"

**2. 部署文件**
- 将 `frontend` 文件夹复制到 `C:\inetpub\wwwroot\lianruan-crm`

**3. 添加网站**
- IIS 管理器 → 右键"网站" → 添加网站
- 网站名称: `lianruan-crm`
- 物理路径: `C:\inetpub\wwwroot\lianruan-crm`
- 端口: `80` 或自定义

---

## 默认登录账号

### 超级管理员
- 账号: `admin`
- 密码: `123456`
- 权限: 全部功能 + 账号管理

### 区域管理员（示例）
| 账号 | 区域 | 密码 |
|------|------|------|
| admin_ah | 安徽区 | 123456 |
| admin_js | 江苏区 | 123456 |
| admin_sh | 上海区（非金） | 123456 |
| admin_sz | 深圳区 | 123456 |
| admin_gz | 广州区 | 123456 |

### 渠道合作伙伴
- 账号: `partner`
- 密码: `123456`

---

## 局域网访问配置

### 1. 防火墙开放端口

```bash
# Linux (firewalld)
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload

# Linux (ufw)
sudo ufw allow 8080/tcp

# Windows
# 高级安全 Windows Defender 防火墙 → 入站规则 → 新建规则 → 端口 → 8080
```

### 2. 获取服务器 IP

```bash
# Linux/Mac
ip addr show

# Windows
ipconfig
```

### 3. 客户端访问

在浏览器输入：
```
http://服务器IP:8080
```

---

## 数据持久化说明

⚠️ **重要**: 本系统使用浏览器 localStorage 存储数据

- 数据保存在**客户端浏览器**中
- 清除浏览器数据会导致数据丢失
- 不同电脑/浏览器数据不互通
- 建议定期导出重要数据备份

---

## 离线部署（无外网环境）

如果局域网**完全隔离**（无法访问互联网），需要下载 CDN 资源到本地：

### 1. 下载依赖文件

```bash
mkdir -p /var/www/lianruan-crm/lib

cd /var/www/lianruan-crm/lib

# Vue 3
curl -O https://unpkg.com/vue@3/dist/vue.global.prod.js

# Vue Router
curl -O https://unpkg.com/vue-router@4/dist/vue-router.global.prod.js

# Element Plus JS
curl -O https://unpkg.com/element-plus/dist/index.full.min.js

# Element Plus CSS
curl -O https://unpkg.com/element-plus/dist/index.css
```

### 2. 修改 index.html

将 CDN 链接改为本地路径：

```html
<!-- 修改前 -->
<link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css" />
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>

<!-- 修改后 -->
<link rel="stylesheet" href="lib/index.css" />
<script src="lib/vue.global.prod.js"></script>
```

---

## 常见问题

### Q: 页面空白/加载失败
- 检查服务器是否正常运行
- 检查防火墙端口是否开放
- 检查文件路径是否正确

### Q: 登录后数据不显示
- 按 F12 打开开发者工具
- 查看 Console 是否有报错
- 检查 localStorage 是否有数据

### Q: 如何备份数据
- 系统设置 → 数据管理 → 导出数据
- 或手动复制浏览器 localStorage

---

## 系统更新

更新版本时：
1. 备份现有数据（导出 JSON）
2. 替换前端文件
3. 刷新浏览器缓存（Ctrl+F5）
4. 重新导入数据

---

## 技术支持

- 项目路径: `/opt/lianruan-crm/`
- 日志文件: `/var/log/lianruan-crm.log`
- 配置文件: `/etc/nginx/sites-available/lianruan-crm`
