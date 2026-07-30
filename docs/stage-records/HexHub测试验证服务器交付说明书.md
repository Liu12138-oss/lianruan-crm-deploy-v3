# HexHub测试验证服务器交付说明书

交付日期：2026-07-27  
HexHub资产：渠道CRM（新架构）  
测试服务器：`10.20.3.10`  
安装目录：`/opt/lianruan-crm-v3`  
访问地址：`http://10.20.3.10/login`

## 1. 交付结论

HexHub「渠道CRM（新架构）」已完成 V3 阶段9最终部署、阶段8正式源数据迁移、阶段9正式业务表落表、健康检查、核心业务闭环和页面巡检。

测试环境当前可以交给用户进行页面登录和业务验收。

## 2. 部署状态

| 项目 | 结果 |
| --- | --- |
| 操作系统 | openEuler x86_64 |
| 部署形态 | 单机 Docker Compose |
| 应用版本 | `3.0.0-stage9.20260727` |
| 构建标识 | `stage9-health-final` |
| 构建时间 | `2026-07-27T12:55:47Z` |
| 离线包 SHA256 | `59fae6a1f4975807c1c07e28991e2d062d920e86fea89028fd9f07daa93645af` |

容器状态：

| 容器 | 镜像 | 状态 |
| --- | --- | --- |
| `lianruan-crm-v3-nginx` | `lianruan-crm-v3-nginx:3.0.0-stage9.20260727` | 运行中，健康 |
| `lianruan-crm-v3-api-1` | `lianruan-crm-v3-api:3.0.0-stage9.20260727` | 运行中，健康 |
| `lianruan-crm-v3-api-2` | `lianruan-crm-v3-api:3.0.0-stage9.20260727` | 运行中，健康 |
| `lianruan-crm-v3-worker` | `lianruan-crm-v3-worker:3.0.0-stage9.20260727` | 运行中 |
| `lianruan-crm-v3-postgres` | `postgres:16.4-alpine` | 运行中，健康 |
| `lianruan-crm-v3-redis-cache` | `redis:7.2.5-alpine` | 运行中 |
| `lianruan-crm-v3-redis-state` | `redis:7.2.5-alpine` | 运行中，健康 |

磁盘状态：`/opt/lianruan-crm-v3` 所在根分区约 `69G`，已用约 `5.7G`，可用约 `60G`。

## 3. 健康检查

最终健康检查时间：2026-07-27 21:12:24（北京时间）。

| 接口 | 结果 |
| --- | --- |
| `http://10.20.3.10/health/live` | `ok` |
| `http://10.20.3.10/health/ready` | `ok` |
| `http://10.20.3.10/health/dependencies` | `ok` |

依赖明细：

| 依赖 | 状态 | 说明 |
| --- | --- | --- |
| 配置 | `ok` | 配置已通过校验 |
| PostgreSQL | `ok` | 连接正常 |
| Redis | `ok` | 连接正常 |
| 数据库迁移 | `ok` | 已执行10个迁移版本 |

## 4. 数据迁移结果

迁移批次：

| 项目 | 结果 |
| --- | --- |
| 批次编号 | `S8-RUN-20260727-001` |
| 批次状态 | `validated` |
| 暂存记录数 | `1091` |
| 失败记录数 | `0` |
| 正式落表校验 | `S8_4` 全部通过 |

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

迁移异常清单中存在 `15` 条 `S8_4_WORKLOAD_FEATURE_MISSING` 工作量功能映射缺失记录，已隔离记录，不阻断主业务链路。

## 5. 业务闭环验收

已在 HexHub 测试服务器真实 API 上完成以下链路：

1. 管理员登录。
2. 新建客户报备。
3. 报备审核通过。
4. 从报备创建商机。
5. 读取产品并进行报价试算。
6. 创建报价。
7. 报价转订单。
8. 订单一级确认。

验收记录：

| 对象 | 记录 |
| --- | --- |
| 客户报备 | `743dd357-b445-4e91-a0e7-5865171ce135`，状态 `approved` |
| 商机 | `cc1f86fd-b923-42f8-87fd-c3f677cc8588`，状态 `active` |
| 报价 | `f2d8d8d8-d62b-468f-8b65-ebf830a3a3b8`，状态 `approved`，金额 `68000` |
| 订单 | `322fcdc3-f115-4a3d-a57f-445e5e8f23eb`，状态 `confirmed`，金额 `68000` |

## 6. 页面巡检

已用 Playwright 完成 47 个页面巡检，全部通过。

| 类型 | 数量 | 结果 |
| --- | ---: | --- |
| 统一入口 | 1 | 通过 |
| PC管理端 | 19 | 通过 |
| PC渠道端 | 14 | 通过 |
| 手机端 | 13 | 通过 |

巡检记录：

```text
output/playwright/hexhub-stage9-final/页面巡检结果.json
```

截图目录：

```text
output/playwright/hexhub-stage9-final
```

## 7. 远端日志

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

## 8. 交付边界

1. 阶段9只迁移 V2 已有业务能力，不包含公海池等新功能。
2. 当前测试环境使用服务器 IP 和 HTTP，正式上线前需要配置域名和 HTTPS 证书。
3. V2旧密码不迁移，正式用户需要初始化新密码。
4. OpenAPI旧密钥不迁移，正式对接前需要重新签发。
5. 当前为单机部署，未配置备用服务器时仍存在整机单点。
