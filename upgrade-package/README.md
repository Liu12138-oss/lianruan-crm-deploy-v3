# 联软CRM v2.2.0 批量导入功能升级包

## 升级内容

本次升级新增批量导入功能：

| 模块 | 功能 |
|------|------|
| 渠道商管理 | 渠道商导入 |
| 账号管理 | 员工导入 |
| 客户报备 | 报备导入 |
| 商机管理 | 商机导入 |

### 技术实现
- **后端**：4组批量导入API（/api/import/partners, /api/import/staffs, /api/import/registrations, /api/import/opportunities）
- **前端**：4个导入组件（渠道商/员工/报备/商机）
- **依赖**：xlsx（Excel解析）+ multer（文件上传）

---

## 升级文件清单

| 文件路径 | 说明 |
|---------|------|
| `backend/server.js` | 后端核心（新增批量导入API） |
| `frontend/admin-app.js` | 管理员前端（新增导入组件） |
| `frontend/style.css` | 样式文件（如有更新） |

---

## 升级操作步骤（Linux服务器）

### 步骤1：上传升级包

```bash
# 在Windows本地打包
cd "d:\远程交付中心文件\建设材料\AI项目及frp\联软渠道管理平台\项目文件夹\lianruan-crm-deploy-v2.2.0"
powershell -Command "Compress-Archive -Path 'upgrade-package\*' -DestinationPath 'batch-import-upgrade.zip' -Force"

# 上传到服务器
scp batch-import-upgrade.zip root@服务器IP:/tmp/
```

### 步骤2：SSH登录服务器后执行

```bash
# 解压
cd /tmp
unzip -o batch-import-upgrade.zip
cd upgrade-package

# 执行升级（自动备份、自动停服、自动启服）
bash upgrade.sh /home/liulonghai/lianruan-crm-deploy-v2.2.0
```

### 步骤3：验证升级

打开浏览器访问系统，检查以下入口：
- 商机管理 → 商机导入按钮
- 客户报备 → 报备导入按钮
- 渠道商管理 → 渠道商导入按钮
- 账号管理 → 员工导入按钮

---

## 导入模板下载

导入功能需要使用Excel模板，请下载：
- `CRM数据导入模板.xlsx`

模板文件位于项目根目录，或联系管理员获取。

### 模板说明

| Sheet | 用途 |
|-------|------|
| 渠道商导入 | 批量导入渠道商信息 |
| 员工导入 | 批量导入员工账号 |
| 报备导入 | 批量导入客户报备 |
| 商机导入 | 批量导入商机 |

---

## 回滚操作

如果升级后出现问题：

```bash
# 查看备份目录
ls -la /home/liulonghai/lianruan-crm-deploy-v2.2.0/ | grep backup

# 进入最新的备份目录恢复文件
cd /home/liulonghai/lianruan-crm-deploy-v2.2.0/backup_XXXXXXXX_XXXXXX
cp server.js.bak /home/liulonghai/lianruan-crm-deploy-v2.2.0/backend/server.js
cp admin-app.js.bak /home/liulonghai/lianruan-crm-deploy-v2.2.0/frontend/admin-app.js

# 重启服务
pkill -f "node.*server.js"
cd /home/liulonghai/lianruan-crm-deploy-v2.2.0/backend
nohup node server.js > /dev/null 2>&1 &
```

---

## 常见问题

### Q1: 导入时提示"文件格式错误"
确保使用xlsx格式，不要使用xls或csv

### Q2: 导入时提示"数据校验失败"
检查模板中的必填字段是否完整，数据格式是否正确

### Q3: 导入后数据不显示
清除浏览器缓存后刷新页面（Ctrl+F5）

---

## 服务管理

```bash
# 查看服务状态
ps aux | grep node
ps aux | grep http.server

# 重启服务
pkill -f "node.*server.js"
pkill -f "python.*http.server"
sleep 2
cd /home/liulonghai/lianruan-crm-deploy-v2.2.0/backend && nohup node server.js > /dev/null 2>&1 &
cd /home/liulonghai/lianruan-crm-deploy-v2.2.0/frontend && nohup python -m http.server 8080 > /dev/null 2>&1 &
```

---

## 版本信息

- **升级包版本**: v2.2.0-batch-import
- **发布日期**: 2026-04-20
- **适用版本**: 联软CRM v2.2.0
