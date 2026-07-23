# 联软渠道管理平台 v2.2.0

## 快速部署

### 一键安装（推荐）

```bash
# 下载并解压部署包
tar -xzf lianruan-crm-deploy-v2.2.0.tar.gz
cd lianruan-crm-deploy-v2.2.0

# 执行安装
chmod +x install.sh
sudo ./install.sh
```

### 手动部署

```bash
# 1. 解压
tar -xzf lianruan-crm-deploy-v2.2.0.tar.gz
cd lianruan-crm-deploy-v2.2.0

# 2. 安装后端依赖
cd backend
npm install
cd ..

# 3. 启动后端服务（端口 3000）
cd backend
node server.js &

# 4. 启动前端服务（端口 8080）
cd frontend
python3 -m http.server 8080 &
```

## 访问地址

| 入口 | 地址 |
|------|------|
| 统一入口（自动适配） | http://服务器IP:8080/login.html |
| 管理后台 | http://服务器IP:8080/admin.html |
| 渠道伙伴（电脑版） | http://服务器IP:8080/partner.html |
| 渠道伙伴（手机版） | http://服务器IP:8080/partner-mobile.html |

## 演示账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 超级管理员 | admin | 123456 |
| 区域管理员 | admin_sd | 123456 |
| 渠道员工 | liujg | 123456 |

## 系统要求

- Node.js >= 16.0.0
- Python 3.x
- 内存: 最低 512MB
- 磁盘: 最低 1GB

## 技术架构

- **前端**: Vue 3 + Element Plus (CDN)
- **后端**: Node.js + Express + JSON 文件存储
- **端口**: 前端 8080，后端 3000

## 目录结构

```
lianruan-crm-deploy-v2.2.0/
├── frontend/          # 前端文件
│   ├── login.html     # 统一登录入口
│   ├── admin.html     # 管理后台
│   ├── partner.html   # 渠道伙伴（电脑版）
│   └── ...
├── backend/          # 后端文件
│   ├── server.js      # 服务端
│   ├── data.json     # 数据文件
│   └── package.json
├── scripts/          # 辅助脚本
├── docs/             # 文档
└── install.sh        # 一键安装脚本
```

## 注意事项

1. 首次部署会初始化数据库
2. 数据保存在 `backend/data.json`
3. 建议定期备份 data.json 文件
4. 如需开机自启，可配置 systemd 服务

## 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 8080 | HTTP 服务 |
| 后端 API | 3000 | RESTful API |

## 防火墙设置

```bash
# 开放端口
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

或使用 ufw:
```bash
sudo ufw allow 8080
```

## 数据备份

```bash
# 备份数据文件
cp /path/to/backend/data.json data-backup-$(date +%Y%m%d).json
```
