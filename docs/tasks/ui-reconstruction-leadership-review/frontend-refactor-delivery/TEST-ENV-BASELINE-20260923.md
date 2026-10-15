# 测试环境基线记录

记录日期：2026-09-23

## 1. 环境

- 测试环境：`http://10.9.86.66`
- 服务器主机名：`localhost.localdomain`
- 操作系统：openEuler Linux，内核 `6.6.0`
- 登录方式：已通过受控 SSH 账号验证；不在仓库记录密码和会话令牌。

## 2. 部署目录

```text
/opt/lianruan-crm-v3
```

## 3. 容器状态

| 容器                          | 状态                |
| ----------------------------- | ------------------- |
| `lianruan-crm-v3-api-1`       | healthy             |
| `lianruan-crm-v3-api-2`       | healthy             |
| `lianruan-crm-v3-nginx`       | healthy，监听 80    |
| `lianruan-crm-v3-worker`      | running             |
| `lianruan-crm-v3-postgres`    | healthy，监听 15432 |
| `lianruan-crm-v3-redis-state` | healthy             |
| `lianruan-crm-v3-redis-cache` | running             |

## 4. 当前版本

```text
3.0.0-stage10.20260920-mcpdeploy1
```

构建提交：`bab11f6`

构建时间：`2026-09-20T01:14:00Z`

## 5. 健康检查

`GET /health/live` 返回正常。

`GET /health/ready` 返回正常，以下依赖通过：

- config
- postgres
- redis
- migration

数据库已执行 67 个迁移版本。

## 6. 页面基线

已验证登录页、管理端登录态和以下管理端路由：

```text
admin.html#/dashboard
admin.html#/opportunity
admin.html#/registration
admin.html#/quote
admin.html#/order
admin.html#/partners
admin.html#/products
admin.html#/admin-review
admin.html#/notifications
```

检查宽度：

```text
1366 / 1440 / 1920
```

结果：

- 页面均可打开。
- 文档宽度与视口宽度一致，没有整页横向溢出。
- 登录页在会话恢复探测时出现一次预期 `401`，不影响页面显示。
- 管理端超级管理员账号可正常登录。

## 7. 当前基线与目标 UI 的差距

- 当前登录后实际落点是旧静态页面 `admin.html#/*`，不是本轮文档规划的 Vue `/admin/*` 工作区。
- 商机页面仍显示旧的十阶段，尚未应用七阶段 UI。
- 线索管理页面尚未部署。
- 当前管理端仍是旧侧栏和旧页面结构，与本轮 `02-war-full` 目标原型不同。
- 当前测试环境只能用于旧版本基线和后续部署后回归，不能用于本轮新 UI 的最终验收。

## 8. 使用要求

- 后续 Agent 可以在该环境执行只读核对。
- 任何写操作、数据迁移、服务重启、镜像替换和配置变更必须单独授权。
- 测试账号、密码、Cookie、页面令牌和 SSH 私钥不得提交到仓库或写入交付包。
- 每轮部署后重新记录版本、提交、健康检查、浏览器截图和问题单。
