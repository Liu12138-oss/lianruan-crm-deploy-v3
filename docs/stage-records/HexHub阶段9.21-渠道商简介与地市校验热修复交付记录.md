# HexHub阶段9.21 渠道商简介与地市校验热修复交付记录

记录时间：2026-07-29 18:40  
交付负责人：产品交付总监  
目标环境：HexHub「渠道CRM（新架构）」测试验证资产  
访问地址：`http://10.20.3.10/login`、`http://10.20.3.10/admin.html`  
发布版本：`3.0.0-stage9.21.20260729`  
构建标识：`stage9.21-partner-profile-city-hotfix`

## 一、修复目标

本次只修复 V3 当前业务页面中的两个问题，不重导 V2 数据，不修改 V2 源码，不改变既有业务流程。

1. 渠道商详情中的“渠道商信息简介”持续显示“正在加载渠道商信息简介...”。
2. 编辑渠道商“所在城市”时，数据库已有地市仍提示找不到，例如“潍坊市”。

## 二、修复内容

修复文件：`/Users/liu/Documents/Codex/lianruan-crm-deploy-v3/apps/web/public/admin-app.js`

1. 增加地市接口返回结构归一化，兼容 `{ region, cities: [...] }` 分组结构。
2. 增加渠道商城市输入归一化，支持“潍坊”自动匹配为“潍坊市”，并继续支持已完整填写的“潍坊市”。
3. 保存渠道商前使用归一化后的城市值参与校验和提交。
4. 增加渠道商简介返回值归一化，兼容 `/api/v2/partners/:id/profile` 返回的迁移扁平结构。
5. 渠道商简介矩阵产品列为空时，回退使用产品配置列表，避免详情面板长期处于加载或空列异常状态。

## 三、发布资产

离线安装包：

`/Users/liu/Documents/Codex/lianruan-crm-deploy-v3/tmp/phase7-package/lianruan-crm-v3-offline-3.0.0-stage9.21.20260729.zip`

安装包大小：约 540M  
SHA256：

```text
0528194569116ade09a59e294bf2201dc45e3d698e31e60d0581af7dbdf19ce4
```

镜像版本：

1. `lianruan-crm-v3-api:3.0.0-stage9.21.20260729`
2. `lianruan-crm-v3-worker:3.0.0-stage9.21.20260729`
3. `lianruan-crm-v3-nginx:3.0.0-stage9.21.20260729`

远端发布前备份目录：

`/opt/lianruan-crm-v3/backups/local/20260729-183257-stage9-21-preupgrade`

远端迁移复核日志：

`/opt/lianruan-crm-v3/logs/install/migrate-db-20260729-183300.log`

## 四、自动化验证结果

### 1. 构建与语法校验

| 校验项 | 结果 |
|---|---|
| `node --check apps/web/public/admin-app.js` | 通过 |
| `npx -y -p node@22 node --check apps/web/public/admin-app.js` | 通过 |
| 离线包 SHA256 校验 | 通过 |

### 2. 远端健康检查

| 接口 | 结果 |
|---|---|
| `http://10.20.3.10/health/live` | 通过，版本为 `3.0.0-stage9.21.20260729` |
| `http://10.20.3.10/health/ready` | 通过，PostgreSQL、Redis、迁移状态正常 |

### 3. 登录验证

| 账号 | 密码 | 结果 |
|---|---|---|
| `admin` | `LrCRM@2026!` | 登录成功 |
| `liulonghai` | `LrCRM@2026!` | 登录成功 |

### 4. 接口验证

| 接口 | 验证点 | 结果 |
|---|---|---|
| `/api/v2/meta/prefecture-cities` | 返回 15 个区域分组、52 个城市，包含“潍坊市” | 通过 |
| `/api/v2/partners/P004/profile` | 返回“山东凯航信息科技有限公司”“潍坊市”“山东区”及权限数据 | 通过 |
| `/admin-app.js` | 包含 `normalizeCityOptions` | 通过 |
| `/admin-app.js` | 包含 `normalizePartnerProfilePayload` | 通过 |

### 5. 页面验证

验证工具：Playwright CLI  
验证入口：`http://10.20.3.10/admin.html`

| 页面操作 | 结果 |
|---|---|
| 管理员登录后进入渠道商管理 | 通过 |
| 列表中查看 P004“山东凯航信息科技有限公司” | 通过，显示“山东区 / 潍坊市” |
| 打开 P004 渠道商详情 | 通过，“渠道商信息简介”正常展示，不再卡加载 |
| 查看详情中的企业基本信息、合作经营摘要、画像矩阵 | 通过 |
| 编辑 P004，所在城市保持“潍坊市”并保存 | 通过，弹出“渠道商信息更新成功” |
| 页面控制台 warning/error | 通过，0 个 warning，0 个 error |

页面快照记录：

1. `.playwright-cli/page-2026-07-29T10-36-49-400Z.yml`：渠道商信息简介正常展示。
2. `.playwright-cli/page-2026-07-29T10-37-20-663Z.yml`：编辑弹窗中“所在城市”为“潍坊市”。
3. `.playwright-cli/page-2026-07-29T10-37-32-903Z.yml`：保存成功弹窗。

## 五、结论

阶段9.21热修复已发布到 HexHub「渠道CRM（新架构）」测试验证资产。两个问题均已修复并完成接口、登录、页面操作和控制台验收。

本次未重导 V2 数据，未清库，未改变业务流程。
