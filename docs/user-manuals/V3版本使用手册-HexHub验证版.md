# 联软CRM V3版本使用手册（HexHub验证版）

文档版本：`3.0`  
验证日期：2026-07-27  
验证环境：HexHub「渠道CRM（新架构）」测试验证服务器  
访问地址：`http://10.20.3.10/login`  
系统版本：`3.0.0-stage9.20260727`  
适用范围：联软总部及其渠道体系

## 1. 最终交付结论

HexHub「渠道CRM（新架构）」已完成 V3 阶段9最终部署、阶段8正式源数据迁移、阶段9正式业务表落表、健康检查、核心业务闭环和浏览器页面巡检。

当前测试环境可以进入用户页面验收。优先验收链路为：客户报备、报备审批、商机、报价、订单确认。

## 2. 登录信息

| 项目 | 内容 |
| --- | --- |
| 登录地址 | `http://10.20.3.10/login` |
| 用户名 | `admin` |
| 初始密码 | `LrCRM@2026!` |
| 登录后默认入口 | `/unified` |
| 验收账号显示名 | 产品交付验收账号 |
| 验收账号角色 | 产品交付总监 |

正式上线前必须重置验收账号密码，并按正式组织、角色和渠道范围重新发放用户账号。V2旧密码不迁移，正式用户统一初始化新密码。

## 3. 页面入口

| 入口 | 地址 | 用途 |
| --- | --- | --- |
| 统一入口 | `/unified` | 查看总体指标、待办、最近业务和迁移状态 |
| 管理端首页 | `/admin/dashboard` | 总部和区域管理员业务概览 |
| 平台管理中心 | `/admin/platform-admin` | 组织、账号、权限、OpenAPI、工作量、导入导出、审计等后台入口 |
| 渠道端首页 | `/partner/dashboard` | 渠道用户查看本渠道业务 |
| 手机渠道端 | `/mobile/partner/home` | 手机一期渠道工作台 |
| 手机管理端 | `/mobile/admin/home` | 手机一期管理工作台 |

未登录访问受保护页面时，系统会自动跳转到登录页。登录成功后会回到原目标页面或进入统一入口。

## 4. 管理端功能

| 页面 | 地址 | 主要能力 |
| --- | --- | --- |
| 客户报备 | `/admin/registration` | 查询、详情、审核通过、驳回 |
| 新建客户报备 | `/admin/registration/new` | 录入客户名称、统一社会信用代码、联系人、电话 |
| 报备导入 | `/admin/registration/import` | 客户报备批量导入入口 |
| 商机管理 | `/admin/opportunity` | 查询、详情、跟进 |
| 新建商机 | `/admin/opportunity/new` | 从已通过报备创建商机 |
| 商机导入 | `/admin/opportunity/import` | 商机批量导入入口 |
| 报价单 | `/admin/quote` | 查询、确认报价、转订单 |
| 新建报价 | `/admin/quote/new` | 选择商机、产品和端点数，试算并提交报价 |
| 订单管理 | `/admin/order` | 查询订单、确认订单 |
| 产品目录 | `/admin/products` | 查看软件、硬件、套餐目录 |
| 渠道报表 | `/admin/partner-report` | 查看渠道业务统计 |
| 渠道商 | `/admin/partners` | 查看渠道主档、层级和区域信息 |
| 渠道导入 | `/admin/partners/import` | 渠道主档批量导入入口 |
| 渠道管理员 | `/admin/partner-admin` | 查看渠道管理员账号 |
| 账号管理 | `/admin/account-manage` | 查看总部、区域、渠道账号 |
| 员工导入 | `/admin/account-manage/staff-import` | 员工账号批量导入入口 |
| 审核中心 | `/admin/admin-review` | 查看待审核业务 |
| 审计日志 | `/admin/audit-logs` | 查看关键操作与迁移审计记录 |
| OpenAPI | `/admin/openapi-integration` | 查看接口客户端和调用记录 |
| 工作量配置 | `/admin/workload-config` | 查看工作量规则和产品映射 |
| 导入导出 | `/admin/system/import-export` | 兼容入口，会进入平台管理中心 |

## 5. 渠道端功能

| 页面 | 地址 | 主要能力 |
| --- | --- | --- |
| 渠道仪表盘 | `/partner/dashboard` | 渠道侧指标、待办和最近业务 |
| 客户报备 | `/partner/registration` | 查询、查看、提交客户报备 |
| 新建客户报备 | `/partner/registration/new` | 渠道侧提交客户保护 |
| 商机管理 | `/partner/opportunity` | 查询、查看、跟进 |
| 新建商机 | `/partner/opportunity/new` | 从已通过报备创建商机 |
| 报价单 | `/partner/quote` | 查询、确认、转订单 |
| 新建报价 | `/partner/quote/new` | 选择商机和产品生成报价 |
| 订单管理 | `/partner/order` | 查询订单和确认状态 |
| 产品目录 | `/partner/products` | 查看可销售产品 |

## 6. 手机端一期

| 页面 | 地址 | 主要能力 |
| --- | --- | --- |
| 手机渠道首页 | `/mobile/partner/home` | 渠道侧指标、待办和最近业务 |
| 手机入口 | `/mobile` | 手机端统一入口 |
| 手机报备 | `/mobile/partner/registrations` | 报备查询和详情 |
| 手机新建报备 | `/mobile/partner/registrations/new` | 新建客户报备 |
| 手机商机 | `/mobile/partner/opportunities` | 商机查询和跟进 |
| 手机新建商机 | `/mobile/partner/opportunities/new` | 新建商机 |
| 手机报价 | `/mobile/partner/quotes` | 报价查询和转订单 |
| 手机订单 | `/mobile/partner/orders` | 订单查询 |
| 手机管理首页 | `/mobile/admin/home` | 管理侧指标和待办 |
| 手机审核中心 | `/mobile/admin/reviews` | 审核任务查询 |
| 手机业务查询 | `/mobile/admin/business` | 业务记录查询 |
| 手机渠道查询 | `/mobile/admin/partners` | 渠道信息查询 |
| 手机我的 | `/mobile/me` | 当前账号和会话信息 |

## 7. 第一优先级验收链路

建议用户按以下顺序做页面验收：

1. 登录 `http://10.20.3.10/login`。
2. 进入 `/admin/registration/new`，新建客户报备。
3. 回到 `/admin/registration`，对待审核报备点击“通过”。
4. 进入 `/admin/opportunity/new`，选择已通过报备，新建商机。
5. 进入 `/admin/quote/new`，选择商机、产品和端点数，点击“试算”，确认金额和工作量后提交。
6. 回到 `/admin/quote`，确认报价或转订单。
7. 进入 `/admin/order`，确认订单。
8. 回到 `/unified` 或 `/admin/dashboard`，确认统计、待办和最近业务已变化。

本次自动化真实验收已经跑通同一链路，生成的验收记录如下：

| 对象 | 记录 |
| --- | --- |
| 客户报备 | `743dd357-b445-4e91-a0e7-5865171ce135`，状态 `approved` |
| 商机 | `cc1f86fd-b923-42f8-87fd-c3f677cc8588`，状态 `active` |
| 报价 | `f2d8d8d8-d62b-468f-8b65-ebf830a3a3b8`，状态 `approved`，金额 `68000` |
| 订单 | `322fcdc3-f115-4a3d-a57f-445e5e8f23eb`，状态 `confirmed`，金额 `68000` |

## 8. 数据迁移结果

阶段8正式源数据已进入 V3 PostgreSQL，并完成阶段9正式业务表落表。

迁移批次：

| 项目 | 结果 |
| --- | --- |
| 批次编号 | `S8-RUN-20260727-001` |
| 批次状态 | `validated` |
| 暂存记录数 | `1091` |
| 失败记录数 | `0` |
| `S8_4`正式落表校验 | 通过 |

正式业务表当前数量：

| 对象 | 数量 |
| --- | ---: |
| 渠道商 | 192 |
| 客户报备 | 153 |
| 商机 | 45 |
| 报价 | 6 |
| 订单 | 3 |
| 审计日志 | 393 |
| 迁移暂存记录 | 1091 |
| 迁移用户账号数 | 71 |

存在 `15` 条 `S8_4_WORKLOAD_FEATURE_MISSING` 工作量功能映射缺失记录，已写入迁移异常清单，不阻断客户报备、商机、报价、订单主链路。

## 9. 健康检查结果

最终健康检查时间：2026-07-27 21:12:24（北京时间）。

| 接口 | 结果 |
| --- | --- |
| `/health/live` | `ok` |
| `/health/ready` | `ok` |
| `/health/dependencies` | `ok` |

依赖状态：

| 依赖 | 状态 | 说明 |
| --- | --- | --- |
| 配置 | `ok` | 配置已通过校验 |
| PostgreSQL | `ok` | 连接正常 |
| Redis | `ok` | 连接正常 |
| 数据库迁移 | `ok` | 已执行10个迁移版本 |

## 10. 页面验证结果

已用 Playwright 在本地浏览器验证 47 个页面，全部通过。

| 类型 | 结果 |
| --- | --- |
| 统一入口 | 通过 |
| PC管理端 | 19个页面通过 |
| PC渠道端 | 14个页面通过 |
| 手机端 | 13个页面通过 |

验收记录：

```text
output/playwright/hexhub-stage9-final/页面巡检结果.json
```

截图留存：

```text
output/playwright/hexhub-stage9-final/桌面-统一入口.png
output/playwright/hexhub-stage9-final/桌面-客户报备.png
output/playwright/hexhub-stage9-final/桌面-平台管理中心.png
output/playwright/hexhub-stage9-final/桌面-渠道仪表盘.png
output/playwright/hexhub-stage9-final/手机-首页.png
output/playwright/hexhub-stage9-final/手机-渠道首页.png
output/playwright/hexhub-stage9-final/手机-管理员首页.png
```

浏览器控制台记录中有 2 条登录前 `/api/auth/me` 返回 `401` 的未登录探测，属于登录页正常行为，不影响登录后页面。

## 11. 运维常用命令

安装目录：

```bash
/opt/lianruan-crm-v3
```

查看容器：

```bash
cd /opt/lianruan-crm-v3/compose
docker compose ps
```

健康检查：

```bash
/opt/lianruan-crm-v3/scripts/health-check.sh
curl -i http://127.0.0.1/health/live
curl -i http://127.0.0.1/health/ready
curl -i http://127.0.0.1/health/dependencies
```

启动和停止：

```bash
/opt/lianruan-crm-v3/scripts/start.sh
/opt/lianruan-crm-v3/scripts/stop.sh
```

诊断采集：

```bash
/opt/lianruan-crm-v3/scripts/collect-diagnostics.sh
```

关键日志：

```text
/root/v3-stage9-hexhub-deploy-20260727-205411.log
/opt/lianruan-crm-v3/logs/install/install-all-20260727-205545.log
/opt/lianruan-crm-v3/logs/install/migrate-db-20260727-205619.log
```

本地交付留存：

```text
output/hexhub-stage9-final/远端部署日志-20260727T125408Z.txt
output/hexhub-stage9-final/业务闭环验收-20260727T125739Z.json
output/hexhub-stage9-final/远端数据库数量-最终通过-20260727T130057Z.txt
output/playwright/hexhub-stage9-final/页面巡检结果.json
```

## 12. 离线安装包

本次最终 ZIP 安装包：

```text
tmp/phase7-package/lianruan-crm-v3-offline-3.0.0-stage9.20260727.zip
```

SHA256：

```text
59fae6a1f4975807c1c07e28991e2d062d920e86fea89028fd9f07daa93645af
```

业务镜像均已切换到：

```text
lianruan-crm-v3-api:3.0.0-stage9.20260727
lianruan-crm-v3-nginx:3.0.0-stage9.20260727
lianruan-crm-v3-worker:3.0.0-stage9.20260727
```

## 13. 当前边界

1. 阶段9只迁移 V2 已有业务能力，不包含公海池等新功能。
2. OpenAPI旧密钥不恢复，正式对接前需要重新签发。
3. V2用户密码不恢复，正式上线前统一初始化密码。
4. 当前测试环境使用服务器 IP 和 HTTP，正式上线前需要补域名和 HTTPS 证书。
5. 当前为单机 Docker Compose 部署，已具备双 API 容器和 Redis/PostgreSQL 容器化运行能力；未配置备用服务器时仍存在整机单点。
6. 生产切换前仍需做一次停机窗口迁移演练、备份恢复演练和业务负责人签收。
