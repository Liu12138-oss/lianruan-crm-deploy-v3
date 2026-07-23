# 联软CRM v2.2.0 企业信息查询功能升级包

## 升级日期
2026-04-22

## 升级内容

### 功能说明
在客户报备新增/编辑时，输入企业名称简称后可自动搜索并回填以下工商信息：
- 统一社会信用代码
- 法定代表人
- 企业状态
- 注册地址/城市
- 行业类型

### 技术实现
- **后端**：新增 `/api/company-search` 代理接口，调用阿里云市场企业工商模糊查询API
- **前端**：管理员端和渠道商端均已集成企业搜索选择组件
- **本地优先**：先在本地已报备客户中搜索，再调用外部API

### API配置
- **接口地址**：`https://kzgsmhv1.market.alicloudapi.com/api/company_search/query`
- **认证方式**：Header `Authorization: APPCODE {AppCode}`
- **AppCode**：`6785eb7b1e65481f9876cd97403bb2cc`

---

## 升级步骤（生产环境）

### 1. 上传升级包
将 `company-search-upgrade.zip` 上传到服务器任意临时目录，例如：
```bash
cd /tmp
# 使用scp或其他方式上传zip包
```

### 2. 解压升级包
```bash
cd /tmp
unzip -o company-search-upgrade.zip
cd company-search-upgrade
ls -la
# 应该看到 upgrade.sh 和 files/ 目录
```

### 3. 执行升级脚本
```bash
# 停止当前服务（如果正在运行）
pkill -f "node.*server.js"
pkill -f "python.*http.server"

# 执行升级
bash upgrade.sh /home/liulonghai/lianruan-crm-deploy-v2.2.0
```

### 4. 配置API Key并启动
```bash
cd /home/liulonghai/lianruan-crm-deploy-v2.2.0/backend

# 方式一：直接启动时设置环境变量
COMPANY_API_KEY=6785eb7b1e65481f9876cd97403bb2cc node server.js &

# 方式二：修改启动脚本
# 编辑 start-backend.sh，添加：
export COMPANY_API_KEY=6785eb7b1e65481f9876cd97403bb2cc

# 启动前端
cd /home/liulonghai/lianruan-crm-deploy-v2.2.0/frontend
python -m http.server 8080 &
```

### 5. 验证升级
打开浏览器访问系统：
1. 使用管理员或渠道商账号登录
2. 进入「客户报备」→「新增报备」
3. 输入企业名称简称（如"腾讯"）
4. 等待搜索结果出现，选择企业
5. 验证工商信息是否自动回填

---

## 回滚步骤

### 如果升级后出现问题，执行回滚：
```bash
cd /home/liulonghai/lianruan-crm-deploy-v2.2.0

# 停止服务
pkill -f "node.*server.js"
pkill -f "python.*http.server"

# 从备份目录恢复文件
BACKUP_DIR=$(ls -td backup_company_search_* | head -1)
cp $BACKUP_DIR/server.js.bak backend/server.js
cp $BACKUP_DIR/admin-app.js.bak frontend/admin-app.js
cp $BACKUP_DIR/partner-app.js.bak frontend/partner-app.js

# 重新启动服务
cd backend && node server.js &
cd ../frontend && python -m http.server 8080 &
```

---

## 数据影响说明

**本升级包不会影响数据库：**
- `backend/server.js`：只添加了新的API接口和辅助函数
- `frontend/admin-app.js`：只添加了新的前端组件
- `frontend/partner-app.js`：只添加了新的前端组件
- 不涉及 `data.json` 数据库文件的修改

---

## 文件清单

| 文件 | 路径 | 说明 |
|------|------|------|
| upgrade.sh | / | 升级执行脚本 |
| files/server.js | /files/ | 后端主文件（新增企业查询API） |
| files/admin-app.js | /files/ | 管理员前端（新增企业选择组件） |
| files/partner-app.js | /files/ | 渠道商前端（新增企业选择组件） |

---

## 变更记录

### 2026-04-22
- 集成阿里云市场企业工商模糊查询API
- 后端新增 `/api/company-search` 代理接口
- 前端新增企业搜索下拉组件
- 支持本地已报备客户优先匹配
- 支持API查询失败时降级到本地数据
