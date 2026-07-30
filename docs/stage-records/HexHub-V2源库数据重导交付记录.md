# HexHub V2源库数据重导交付记录

交付时间：2026-07-28 14:26  
执行资产：HexHub「渠道CRM（新架构）」  
访问地址：`http://10.20.3.10/login`  
执行目标：将 HexHub 测试环境重置为 V2 源库迁移后的业务数据形态，清理此前混入的页面验收测试数据。

## 1. 交付结论

已完成 V2 源库数据重导。

本次执行了：

1. 重导前 PostgreSQL 逻辑备份。
2. 停止 V3 应用服务，保留 PostgreSQL 与 Redis。
3. 清理 V3 业务与迁移 schema。
4. 重新执行数据库结构迁移。
5. 重新装载阶段8 V2 暂存包，共 `1091` 条暂存记录。
6. 重新执行阶段8.4正式业务表落表。
7. 启动 V3 应用服务。
8. 执行健康检查、登录接口、业务概览、待审报备、审核中心接口复核。

## 2. 数据结果

重导后 HexHub 测试环境业务概览：

| 对象 | 数量 |
| --- | ---: |
| 渠道商 | 192 |
| 客户报备 | 151 |
| 商机 | 43 |
| 报价单 | 4 |
| 订单 | 1 |
| 产品 | 34 |
| 迁移暂存记录 | 1091 |

迁移状态：

| 项目 | 结果 |
| --- | --- |
| 批次编号 | `S8-RUN-20260727-001` |
| 正式落表 | `validated` |
| 校验结论 | 通过 |

## 3. 接口复核

| 接口 | 结果 |
| --- | --- |
| `/health/live` | 通过 |
| `/health/ready` | 通过 |
| `/health/dependencies` | 通过 |
| `/api/auth/login` | 通过 |
| `/api/stage9/overview` | 通过 |
| `/api/stage9/registrations?status=pending` | 通过，待审报备 `1` 条 |
| `/api/stage9/approvals` | 通过，审核中心 `21` 条 |

登录账号仍可用：

```text
账号：admin
密码：LrCRM@2026!
```

## 4. 远端留痕

重导前备份目录：

```text
/opt/lianruan-crm-v3/backups/local/20260728-142352-v2-source-reimport-before
```

重导执行日志：

```text
/root/v3-v2-source-reimport-20260728-142352.log
```

数据库迁移日志：

```text
/opt/lianruan-crm-v3/logs/install/migrate-db-20260728-142355.log
```

本地执行脚本：

```text
tmp/stage8-reimport/hexhub-v2-source-reimport.sh
```

说明：首次执行脚本时，远端 Compose 的 Redis 服务名为 `redis-cache`、`redis-state`，不是脚本默认的 `redis`。数据库重导已经完成后，启动服务环节报出 `no such service: redis`。随后已按正确服务名手动补启动 `api-1`、`api-2`、`worker`、`nginx`，并完成健康检查。本地脚本已修正服务名判断，后续复用不会再触发该问题。

## 5. 已记录问题

用户反馈的“新建客户报备后，在审核中心看不到该内容”不属于本次数据重导阻断项，已作为后续业务缺陷修复项记录。当前 V2 源库历史审核中心数据可以查询，接口返回 `21` 条；新建报备是否同步生成审核任务，需要下一步按业务逻辑修复。
