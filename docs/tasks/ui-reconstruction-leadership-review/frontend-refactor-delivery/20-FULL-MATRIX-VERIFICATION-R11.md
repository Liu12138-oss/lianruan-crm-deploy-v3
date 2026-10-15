# UI 重构全量矩阵验证报告（r11）

验证日期：2026-09-23

测试环境：`http://10.9.86.66`

本轮发布镜像：`lianruan-crm-v3-nginx:3.0.0-stage10.20260923-uirefactor11`

回滚镜像：`lianruan-crm-v3-nginx:3.0.0-stage10.20260923-uirefactor10`

生产环境 `10.20.3.10` 未连接、未部署、未修改。

## 1. 本轮修复项

| 问题 | 现象 | 处理 | 证据 |
| --- | --- | --- | --- |
| 提醒规则接口路径错误 | 页面请求 `/api/messages/rules` 返回 404，提醒规则始终走 fallback 静态数据 | 改为调用真实接口 `/api/messages/platform/rules`，并按接口字段渲染规则名、事件、接收人、渠道和状态 | 接口返回 200、9 条规则，表格渲染 9 行 |
| 提醒规则列表字段映射 | 真实数据返回 `ruleName` / `recipientRule.label` / `channelCodes`，页面按旧字段渲染会显示空白 | 增加字段映射与渠道中文名映射，停用状态使用中性色标签 | 表格显示「提醒任务 / 事件代码 / 接收人 / 消息渠道 / 状态」 |
| 测试环境镜像标签不一致 | `.env` 中 `V3_IMAGE_TAG` 指向只有 Nginx 存在的标签，API/Worker/MCP 无同名镜像，重启有失败风险 | 用现有 API/Worker/MCP 镜像补齐同名标签，`V3_IMAGE_TAG` 与四个镜像保持一致 | 四个镜像均存在 uirefactor11 标签 |

## 2. 健康检查

| 项目 | 结果 |
| --- | --- |
| `/health/live` | 200 |
| `/health/ready` | 200 |
| Web 容器 | healthy，只重建 Nginx |
| API / Worker / PostgreSQL / Redis | 未重建、未重启 |

## 3. 本地门禁

| 项目 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npm --workspace @lianruan/web run check` | 通过 |
| 单元测试 | `npm --workspace @lianruan/web run test` | 22 个文件、130 项通过 |
| 生产构建 | `npm --workspace @lianruan/web run build` | 通过，资源 `index-Ces1o_NH.js` |

## 4. 全量矩阵结果

验证脚本：`tools/verify-test-env-full-matrix.mjs`

```json
{
  "记录数": 300,
  "失败数": 0,
  "错误数": 20,
  "越权拦截通过": 10,
  "越权检查数": 10
}
```

- 分辨率矩阵：`1280 / 1366 / 1440 / 1600 / 1920`。
- 角色：超级管理员、湖南区区域管理员、渠道销售代表。
- 唯一「角色 × 路由」组合：50 个；访问记录 250 条。
- 重构前对比记录：50 条（旧镜像只读容器，1440×900）。
- 判定项：横向溢出、关键文案缺失、403 误入、脚本异常。
- 失败组合：0。

明细见 `21-COVERAGE-MATRIX-R11.md` 与 `test-evidence/20260923-refactor-verification-r11/full-matrix-results.json`。

## 5. 交互探针结果

验证脚本：`tools/probe-interactions.mjs`

```json
{ "通过": 10, "总数": 10 }
```

| 探针 | 结果 |
| --- | --- |
| 商机七阶段文案（客户建联 / 需求挖掘 / 客户方案 / POC试用 / 立项推进 / 招投标 / 成单） | 通过，无旧十阶段残留 |
| 模块价格规则：阶梯价、渠道比例、区域覆盖、命中顺序 | 通过，区域覆盖与阶梯计价筛选可切换 |
| 证书模板弹窗 | 通过 |
| 提醒规则真实数据（9 条） | 通过 |
| 客户档案编辑态与跟进入口 | 通过 |
| 渠道成员新增弹窗 | 通过 |
| 订单动作按状态与角色显示 | 通过，无动作状态给出边界提示 |
| 超管确认 / 超管退回动作卡 | 通过 |
| 渠道核心档案表单可编辑 | 通过 |
| 渠道端订单入口 | 通过 |

## 6. 越权与数据范围

| 角色 | 直链 | 落点 | 结果 |
| --- | --- | --- | --- |
| 区域管理员 | `/admin/certifications`、`/admin/notifications/platform`、`/admin/notifications/rules`、`/admin/account-manage`、`/admin/platform-admin`、`/admin/openapi-integration` | `/403` | 已拦截 |
| 渠道销售代表 | `/admin/registration`、`/admin/opportunity`、`/admin/order`、`/admin/leads` | `/403` | 已拦截 |

## 7. 接口状态

| 接口 | 状态 | 说明 |
| --- | --- | --- |
| `/api/messages/platform/rules` | 200 | 本轮修复后可用 |
| `/api/messages/platform/channels` | 500 | 测试环境缺少 `message` 架构迁移，见第 8 节 |
| `/api/messages/platform/channels/readiness` | 200 | 加密密钥已配置 |
| `/api/notifications` | 200 | 消息中心数据正常 |
| `/api/stage9/registrations`、`orders`、`partners`、`products` | 200 | 业务列表正常 |
| `/api/org/certification-templates`、`/api/org/member-certifications`、`/api/org/units/tree` | 200 | 证书与组织数据正常 |
| `/api/approvals` | 200 | 审核中心数据正常 |

## 8. 剩余阻塞（后端 / 运维范围）

`GET /api/messages/platform/channels` 返回 500 的根因已定位：

- 接口查询 `message.channel_accounts`，需要迁移 `database/migrations/20260814_M04_001_message_channel_configuration.sql` 建立的 `message` 架构。
- 测试环境数据库当前不存在该架构（`information_schema.tables` 查询无 `message.*` 表）。
- 该问题属于测试环境数据库迁移缺口，不在前端 UI 代码范围；前端已保留完整页面结构、`readiness` 状态提示和错误降级。
- 处理建议：由后端/运维在测试环境执行该迁移后，直接复跑 `tools/probe-interactions.mjs` 的第 4 个探针即可验证。

其他环境差异：

- `liangwanqi / 123456` 返回 401（账号密码不匹配），本轮可用超管账号为 `liulonghai`。
- 20 条控制台错误中，15 条为登录前 `/me` 的 401，5 条为上述渠道配置 500，均属预期。

## 9. 重构前后对比

- 重构前证据：`test-evidence/20260923-refactor-verification-r11/before-screenshots/`（旧镜像 `3.0.0-stage10.20260920-mcpdeploy1` 只读容器，1440×900）。
- 重构后证据：`test-evidence/20260923-refactor-verification-r11/screenshots/`（当前测试环境同路由，1440×900）。
- 对比画廊：`COMPARISON-GALLERY.html`（9 组重点页面对比）。
- 历史基线：`test-evidence/20260923-business-baseline/`。

## 10. 结论

本轮在测试环境完成前端 UI 重构的全角色、全分辨率、全路由矩阵验证：50 个角色×路由组合、250 条访问记录全部通过，10 项关键交互探针全部通过，10 项越权直链全部被拦截。除测试环境 `message` 架构迁移缺口外，未发现 UI 重构失败项。
