# 联软CRM v2.3.0 批量导入功能升级包

## 使用说明

### 1. 解压升级包

将升级包解压到任意临时目录，例如：
```
/tmp/lianruan-crm-v2.3.0-upgrade/
```

### 2. 执行升级

```bash
cd /tmp/lianruan-crm-v2.3.0-upgrade
bash upgrade.sh /home/liulonghai/lianruan-crm-deploy-v2.2.0
```

### 3. 验证升级

打开浏览器访问系统，检查以下入口是否出现：
- 商机管理 → 商机导入
- 客户报备 → 报备导入  
- 渠道商管理 → 渠道商导入
- 账号管理 → 员工导入

### 4. 如需回滚

```bash
cd /home/liulonghai/lianruan-crm-deploy-v2.2.0/scripts
bash restore.sh
# 按提示选择备份目录进行回滚
```

## 升级内容

- 后端：批量导入API（4组接口）
- 前端：4个导入组件（渠道商/员工/报备/商机）
- 依赖：xlsx + multer

## 系统要求

- Node.js 18+
- 原项目：联软CRM v2.2.0
