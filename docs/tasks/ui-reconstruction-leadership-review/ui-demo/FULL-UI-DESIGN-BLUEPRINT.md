# 联软渠道管理平台 V3 全量 UI 视觉优化与原型设计总蓝图

## 1. 文档定位

本文档是全量 UI 升级总蓝图，覆盖 V3 当前四套正式业务页面、工程化工作区、管理端、渠道端、移动端、业务图和关键窗口。

配套文档：

- `VISUAL-RULES.md`：目标视觉模型和固定画板规则。
- `DESIGN.md`：视觉设计系统和核心页面交互。
- `IMPLEMENTATION-SPEC.md`：前后端接口、权限、数据和验收实施规格。
- `index.html`：可点击交互原型。
- `FEATURE-COVERAGE-MATRIX.md`：全量功能覆盖矩阵、测试环境只读核对结果和 201 项覆盖状态。

本文档解决三个问题：

1. 当前全部 UI 范围是什么。
2. 每类页面应使用什么目标设计模式。
3. 前端 Agent 应从哪些路由、组件、动作和截图开始实施。

## 2. 设计基线

### 2.1 目标视觉来源

- `../visual-designs/screenshots/02-war-full.png`
- `../visual-designs/versions/02-war-room.html`
- `../visual-designs/assets/visual-ui.css`

### 2.2 固定画板

| 类型                 | 尺寸             |
| -------------------- | ---------------- |
| 列表和业务页         | `1440px × 740px` |
| 新增、编辑和长文档页 | `1440px × 900px` |

### 2.3 固定页面外壳

```text
顶部业务导航 62px
六项指标 73px 开始，96px 高
业务内容 180px 开始
左侧列表 / 中间业务上下文 / 右侧决策面板
```

### 2.4 顶层业务导航

普通业务导航：

`业务全景 / 工作台 / 客户管理 / 线索管理 / 商机作战 / 渠道管理 / 订单中心 / 产品目录 / 消息中心 / 管理配置`

规则：

- “报价”不作为普通用户独立业务分组。
- 报价在商机上下文内完成。
- 管理员跨商机报价查询放在“管理配置 → 报价审核与查询”。
- “消息中心”必须作为一级导航可见，顶部铃铛只提供快速查看。
- “人天与工作量配置”必须在产品目录直接可见，并由服务端权限决定管理账号可见性。
- 页面级跳转使用导航按钮，原地动作使用弹窗。

## 3. 全量承载范围

### 3.1 四套正式页面

| 页面         | 文件                                  | 目标                             |
| ------------ | ------------------------------------- | -------------------------------- |
| 管理员电脑端 | `apps/web/public/admin.html`          | 完整业务、平台管理和审核         |
| 管理员移动端 | `apps/web/public/admin-mobile.html`   | 待办、审核、查询和关键确认       |
| 渠道电脑端   | `apps/web/public/partner.html`        | 渠道报备、商机、报价、订单和产品 |
| 渠道移动端   | `apps/web/public/partner-mobile.html` | 高频跟进、报价和订单动作         |

### 3.2 工程化工作区

| 路径                   | 目标                                           |
| ---------------------- | ---------------------------------------------- |
| `/workspace/admin/*`   | 新组织、权限、合同、财务、公海、消息和分析页面 |
| `/workspace/partner/*` | 渠道侧新增模块                                 |
| `/workspace/mobile/*`  | 移动端新增模块                                 |

### 3.3 全量原型资产

- 56 张业务页面设计图。
- 96 张关键窗口、抽屉和确认动作设计图。
- 3 张业务图：主业务链、跨业务链路、状态机。
- 1 套设计系统。
- 1 套固定画板视觉规则。

## 4. 页面设计模式

全部页面必须归入以下模式之一，不允许研发按自己的理解重新排列。

### 4.1 三栏业务工作台

适用：

- 客户管理。
- 商机管理。
- 报价审核与查询。
- 订单管理。
- 渠道商管理。
- 渠道成员管理。
- 产品目录。
- 审核中心。
- 消息中心。
- 组织与账号。
- 角色与权限。
- OpenAPI 与审计。

结构：

- 左侧对象列表。
- 中间业务上下文。
- 右侧决策、状态和建议。

### 4.2 列表加单主面板

适用：

- 操作日志。
- 系统健康。
- 迁移状态。
- 备份记录。
- 消息投递记录。

结构：

- 六项指标。
- 筛选栏。
- 宽表或日志表格。

### 4.3 新建和编辑表单

适用：

- 客户新增。
- 商机新增。
- 渠道新增。
- 渠道成员新增。
- 用户新增。
- 证书授权。
- 价格规则编辑。

### 4.4 报价单文档工作区

适用：

- 新建报价。
- 修改报价。
- 报价详情。

结构：

- 左栏报价对象和规则。
- 中间软件、硬件和服务明细。
- 右栏正式报价单预览和试算汇总。

### 4.5 业务图和状态机

适用：

- 主业务链。
- 支撑链路。
- 状态流转。
- 审批链路。

规则：

- 节点、箭头和状态标签必须单行。
- 不依赖装饰性连线。
- 节点必须对应真实业务动作。

### 4.6 移动端任务页

适用：

- 移动工作台。
- 审核。
- 跟进。
- 报价确认。
- 订单确认和履约。

规则：

- 不使用桌面表格。
- 使用任务卡、底部导航、状态摘要和关键动作。
- 高风险动作二次确认。

## 5. 管理员电脑端全量路由

| 当前路由                            | 目标页面       | 设计模式        | 原型参考                 |
| ----------------------------------- | -------------- | --------------- | ------------------------ |
| `/dashboard`                        | 总览仪表盘     | 指标 + 面板     | `10-dashboard.png`       |
| `/opportunity`                      | 商机完整工作区 | 三栏 + 页签     | `14-opportunities.png`   |
| `/opportunity/new`                  | 新建商机       | 表单            | `15-opportunity-new.png` |
| `/opportunity/import`               | 商机导入       | 导入任务        | `07-import-center.png`   |
| `/registration`                     | 客户管理       | 三栏工作台      | `11-customers.png`       |
| `/registration/new`                 | 客户新增与报备 | 多步表单        | `12-customer-new.png`    |
| `/registration/import`              | 客户导入       | 导入任务        | `07-import-center.png`   |
| `/leads`                            | 线索管理       | 三栏检索        | `54-lead-management.png` |
| `/leads/:id`                        | 线索详情       | 正文 + 侧栏     | `55-lead-detail.png`     |
| `/lead-sources`                     | 数据来源与采集 | 来源 + 日志     | `56-lead-sources.png`    |
| `/quote`                            | 报价审核与查询 | 三栏工作台      | `16-quotes.png`          |
| `/quote/new`                        | 报价单编辑器   | 报价文档        | `17-quote-new.png`       |
| `/quote/edit/:id`                   | 修改报价       | 报价文档        | `17-quote-new.png`       |
| `/order`                            | 订单管理       | 三栏工作台      | `18-orders.png`          |
| `/products`                         | 产品目录       | 三栏 + 成本配置 | `20-products.png`        |
| `/partner-report`                   | 渠道经营报表   | 指标 + 图表     | 沿用工作台模式           |
| `/partners`                         | 渠道商管理     | 三栏工作台      | `19-channels.png`        |
| `/partners/import`                  | 渠道导入       | 导入任务        | `07-import-center.png`   |
| `/partner-admin`                    | 企业管理员     | 列表 + 表单     | `07-channel-members.png` |
| `/admin-review`                     | 审核中心       | 三栏工作台      | `21-approvals.png`       |
| `/account-manage`                   | 账号管理       | 三栏工作台      | `23-organization.png`    |
| `/account-manage/staff-import`      | 员工导入       | 导入任务        | `07-import-center.png`   |
| `/audit-logs`                       | 操作日志       | 宽表            | `26-audit-system.png`    |
| `/openapi-integration`              | OpenAPI 对接   | 三栏工作台      | `25-openapi.png`         |
| `/message-platform`                 | 消息渠道配置   | 三栏工作台      | `22-messages.png`        |
| `/message-rules`                    | 提醒规则管理   | 三栏工作台      | `22-messages.png`        |
| `/organization/units`               | 组织与岗位     | 组织工作区      | `23-organization.png`    |
| `/organization/staff`               | 人员与任职     | 组织工作区      | `23-organization.png`    |
| `/organization/business-roles`      | 业务角色       | 组织工作区      | `23-organization.png`    |
| `/organization/certifications`      | 证书管理       | 组织工作区      | `07-channel-members.png` |
| `/organization/rbac`                | 权限角色       | 权限矩阵        | `24-roles.png`           |
| `/organization/data-scopes`         | 数据范围       | 权限矩阵        | `24-roles.png`           |
| `/organization/offboarding`         | 离职交接       | 任务工作区      | `23-organization.png`    |
| `/organization/directory-sync`      | 企微组织同步   | 差异预览        | `23-organization.png`    |
| `/organization/external-identities` | 外部身份映射   | 映射工作区      | `23-organization.png`    |
| `/workload-config`                  | 工作量配置     | 三栏配置        | `20-products.png`        |
| `/notifications`                    | 消息中心       | 三栏工作台      | `22-messages.png`        |

## 6. 渠道电脑端全量路由

| 当前路由            | 目标页面       | 设计模式    | 原型参考                   |
| ------------------- | -------------- | ----------- | -------------------------- |
| `/dashboard`        | 渠道工作台     | 指标 + 面板 | `27-partner-dashboard.png` |
| `/opportunity`      | 渠道商机工作区 | 三栏 + 页签 | `14-opportunities.png`     |
| `/opportunity/new`  | 新建商机       | 表单        | `15-opportunity-new.png`   |
| `/registration`     | 客户报备       | 三栏工作台  | `11-customers.png`         |
| `/registration/new` | 新建客户报备   | 多步表单    | `12-customer-new.png`      |
| `/quote`            | 兼容报价查询   | 三栏工作台  | `16-quotes.png`            |
| `/quote/new`        | 报价编辑器     | 报价文档    | `17-quote-new.png`         |
| `/quote/edit/:id`   | 修改报价       | 报价文档    | `17-quote-new.png`         |
| `/order`            | 订单管理       | 三栏工作台  | `18-orders.png`            |
| `/products`         | 产品目录       | 卡片 + 详情 | `20-products.png`          |
| `/notifications`    | 通知           | 列表        | `22-messages.png`          |

推荐变化：

- 普通渠道用户从商机中的“报价”页签进入报价，不再把 `/quote` 作为主入口。
- `/quote` 保留一段时间作为兼容和直接访问入口。

## 7. 移动端全量页面

### 7.1 移动一期已存在页面

- 工作台。
- 客户报备列表。
- 新建报备。
- 商机列表。
- 新建商机。
- 报价列表。
- 订单列表。
- 审核中心。
- 业务查询。
- 渠道商列表。
- 消息提醒。
- 我的。

### 7.2 移动二期目标页面

- 客户报备草稿、提交和审核。
- 商机创建、编辑、阶段推进和跟进。
- 报价试算、草稿、提交、折扣审核和确认。
- 订单草稿、提交、一级确认和履约。

移动端要求：

- 所有页面使用独立卡片布局。
- 保留返回列表和刷新入口。
- 高风险动作使用二次确认。
- 字段权限、数据范围和状态机与电脑端一致。

## 8. 完整动作清单

### 8.1 客户

- 新建客户报备。
- 保存草稿。
- 提交审核。
- 编辑客户档案。
- 查看详情。
- 记录商机跟进。
- 查看关联商机。
- 延期保护期。
- 导入。
- 导出。

### 8.2 商机

- 新建商机。
- 编辑商机。
- 记录跟进。
- 更新七阶段进度：客户建联（10%）、需求挖掘（20%-30%）、客户方案（40%）、POC 试用（50%）、立项推进（60%-70%）、招投标（80%-90%）、成单（100%）。
- 将输单和项目取消作为终止结果，不计入七阶段进度。
- 更新成单概率。
- 更新预计成交时间。
- 创建报价。
- 查看报价版本。
- 查看关联订单。
- 查看状态历史。

### 8.3 报价

- 新建报价。
- 修改报价。
- 复制为新版本。
- 服务端试算。
- 保存草稿。
- 发送客户。
- 客户确认。
- 折扣审核。
- 下载 PDF。
- 转订单。

### 8.4 订单

- 报价转订单。
- 一级确认。
- 一级驳回并退回二级。
- 区管确认。
- 区管调价。
- 超管确认。
- 超管退回区管、一级或二级。
- 申请回退修改。
- 批准回退修改。
- 驳回回退修改。
- 修改订单并重新提交。
- 确认发货。
- 完成订单。
- 取消订单。

### 8.5 渠道与成员

- 新增渠道商。
- 编辑渠道商信息与渠道核心档案。
- 维护工商主体、经营规模、注册地址、联系人、合作背景、主要行业、代理品牌、授权产品线、资质认证、典型客户、服务区域和授权提醒。
- 维护产品能力、技术服务商评分和行业产品矩阵。
- 设置渠道等级。
- 绑定或解除上级渠道。
- 添加成员。
- 编辑成员。
- 分配销售或技术业务角色。
- 启用或停用成员。
- 重置密码。
- 删除或归档成员。
- 授权证书。
- 撤销证书。

### 8.6 产品和价格

- 新增产品分类。
- 新增软件模块。
- 新增功能。
- 新增硬件。
- 新增套餐。
- 编辑固定价。
- 编辑阶梯价。
- 编辑一级渠道折扣率。
- 编辑二级渠道折扣率。
- 新增区域覆盖。
- 编辑区域阶梯。
- 配置硬件内部成本。

### 8.7 审核、消息和组织

- 审核通过。
- 审核驳回。
- 批量审核。
- 标记消息已读。
- 全部已读。
- 设置通知偏好。
- 配置消息渠道。
- 配置提醒规则。
- 新建组织。
- 编辑组织。
- 新建岗位。
- 编辑任职。
- 新建系统角色。
- 分配角色。
- 配置数据范围。
- 离职交接。
- 账号归档、恢复和归并。

## 9. 页面与接口映射

本节只列领域接口，具体字段以 `IMPLEMENTATION-SPEC.md` 为准。

| 领域     | 接口前缀                                                               |
| -------- | ---------------------------------------------------------------------- |
| 认证     | `/api/auth/*`                                                          |
| 客户报备 | `/api/registrations*`                                                  |
| 商机     | `/api/opportunities*`                                                  |
| 报价     | `/api/quotes*`                                                         |
| 订单     | `/api/orders*`                                                         |
| 订单回退 | `/api/order-revision-requests*`                                        |
| 渠道     | `/api/partners*`                                                       |
| 产品     | `/api/products*`、`/api/features*`、`/api/hardware*`、`/api/packages*` |
| 工作量   | `/api/workload/*`                                                      |
| 组织     | `/api/org/*`                                                           |
| 权限     | `/api/rbac/*`                                                          |
| 消息     | `/api/messages/*`                                                      |
| 目录同步 | `/api/integrations/directory-sync/*`                                   |
| 开放接口 | `/api/open-api/*` 和 `/api/open/v1/*`                                  |
| 收益     | `/api/quotes/:quoteId/profit-calculation*`                             |

## 10. 前后端边界

### 10.1 前端只负责

- 展示服务端返回的正式业务事实。
- 表单输入和服务端校验提示。
- 页面筛选、排序、分页和视图切换。
- 角色可见性提示。
- 加载、空状态、错误和成功反馈。

### 10.2 服务端必须负责

- 当前用户和数据范围。
- 客户、渠道、区域、负责人归属。
- 报价金额、折扣、税费、工作量和快照。
- 订单金额、编号、状态机和审批节点。
- 成本和收益访问控制。
- 幂等、并发、审计和任务恢复。

## 11. 实施阶段

### 阶段 1：设计系统和页面外壳

- 设计令牌。
- 顶部导航。
- 三栏工作台。
- 指标卡。
- 表格和状态标签。
- 抽屉和弹窗。

### 阶段 2：核心业务链

- 客户。
- 商机完整页签。
- 报价编辑器。
- 订单审批。
- 渠道成员。
- 产品价格。

### 阶段 3：平台管理

- 组织和账号。
- 角色权限。
- 审核中心。
- 消息和规则。
- OpenAPI。
- 审计与系统。

### 阶段 4：渠道端和移动端

- 渠道工作台。
- 渠道报价和订单。
- 移动审核。
- 移动跟进。
- 移动报价。
- 移动订单。

### 阶段 5：兼容清理和灰度

- 旧路由重定向。
- 旧页面只保留最小入口。
- 主业务回归。
- 功能开关和回退。

## 12. 全量验收矩阵

| 验收项       | 要求                                               |
| ------------ | -------------------------------------------------- |
| 页面完整性   | 所有现有正式路由有目标页面或兼容映射               |
| 视觉一致性   | 统一设计令牌、导航、面板、表格、弹窗和状态色       |
| 固定画板     | 1440px 不变形，窄窗口仅横向滚动                    |
| 业务完整性   | 报备、商机、报价、订单、渠道、产品、组织和消息闭环 |
| 权限完整性   | 每个动作后端鉴权，前端只做可见性                   |
| 数据一致性   | 金额、明细、状态和快照只以服务端为准               |
| 状态完整性   | 正常、加载、空、错误、无权限、冲突、成功           |
| 操作完整性   | 主流程、返回、编辑、审批、驳回和重试均可执行       |
| 移动端完整性 | 高频任务独立设计，不压缩桌面页面                   |
| 回退完整性   | 每个模块可关闭或回退，不影响正式页面               |

## 13. 页面设计图索引

以下图片是前台设计基线。研发实现时应逐页对照，不以自行重排替代。

### 13.1 页面

![设计总览](screenshots/01-overview.png)

![设计系统](screenshots/02-design-system.png)

![窗口与状态](screenshots/03-windows.png)

![业务全景图](screenshots/04-business-map.png)

![业务链路图](screenshots/05-business-flows.png)

![状态机与审批图](screenshots/06-state-machines.png)

![渠道成员管理](screenshots/07-channel-members.png)

![订单审批动作](screenshots/08-order-actions.png)

![模块价格规则](screenshots/09-pricing-rules.png)

![总览仪表盘](screenshots/10-dashboard.png)

![客户管理](screenshots/11-customers.png)

![客户新增](screenshots/12-customer-new.png)

![客户跟进](screenshots/13-customer-followup.png)

![商机完整工作区](screenshots/14-opportunities.png)

![新建商机](screenshots/15-opportunity-new.png)

![报价审核与查询](screenshots/16-quotes.png)

![报价单编辑器](screenshots/17-quote-new.png)

![订单管理](screenshots/18-orders.png)

![渠道商管理](screenshots/19-channels.png)

![产品目录](screenshots/20-products.png)

![审核中心](screenshots/21-approvals.png)

![消息中心](screenshots/22-messages.png)

![组织与账号](screenshots/23-organization.png)

![角色与权限](screenshots/24-roles.png)

![OpenAPI 对接](screenshots/25-openapi.png)

![审计与系统](screenshots/26-audit-system.png)

![渠道工作台](screenshots/27-partner-dashboard.png)

![移动端原型](screenshots/28-mobile.png)

![认证与异常状态](screenshots/29-auth-flows.png)

![渠道经营报表](screenshots/30-partner-report.png)

![渠道画像与层级](screenshots/31-channel-profile.png)

![证书管理](screenshots/32-certificate-management.png)

![消息渠道配置](screenshots/33-message-platform.png)

![提醒规则与模板](screenshots/34-message-rules.png)

![账号生命周期](screenshots/35-account-management.png)

![组织双域管理](screenshots/36-organization-admin.png)

![产品维护](screenshots/37-product-admin.png)

![工作量配置](screenshots/38-workload-config.png)

![导入导出任务](screenshots/39-import-export.png)

![报价动作与收益](screenshots/40-quote-actions.png)

![审计与运维](screenshots/41-audit-operations.png)

![移动端全量页面](screenshots/42-mobile-full.png)

![管理配置中心](screenshots/43-admin-settings.png)

![全量功能总览](screenshots/44-extensions.png)

![系统架构总览](screenshots/45-architecture.png)

![MCP 管理](screenshots/46-mcp-management.png)

![消息运行监控](screenshots/47-message-monitoring.png)

![合同与协议占位](screenshots/48-contracts.png)

![收款与应收占位](screenshots/49-receipts.png)

![保证金管理占位](screenshots/50-deposits.png)

![客户公海与报备池占位](screenshots/51-customer-pool.png)

![AI 分析与大屏占位](screenshots/52-ai-analytics.png)

![备份与恢复中心占位](screenshots/53-backup-recovery.png)

![线索管理](screenshots/54-lead-management.png)

![线索详情](screenshots/55-lead-detail.png)

![数据来源与采集](screenshots/56-lead-sources.png)

### 13.2 关键窗口

![客户详情](screenshots/windows-v3/21-customer-detail.png)

![记录跟进](screenshots/windows-v3/24-followup-form.png)

![报价详情](screenshots/windows-v3/72-quote-detail.png)

![报价转订单](screenshots/windows-v3/19-convert-order.png)

![订单修订](screenshots/windows-v3/53-order-revision.png)

![审批详情](screenshots/windows-v3/05-approval-detail.png)

![批量导入](screenshots/windows-v3/26-import-center.png)

![产品选择器](screenshots/windows-v3/69-product-picker.png)

![权限差异](screenshots/windows-v3/60-permission-audit.png)

![消息面板](screenshots/windows-v3/43-messages-panel.png)

![区域筛选](screenshots/windows-v3/78-region-filter.png)

![渠道成员编辑](screenshots/windows-v3/33-member-editor.png)

![证书维护](screenshots/windows-v3/30-member-cert.png)

![回退修订审批](screenshots/windows-v3/54-order-revision-review.png)

![价格规则编辑](screenshots/windows-v3/62-pricing-editor.png)

![客户档案编辑](screenshots/windows-v3/22-customer-editor.png)

![招投标关联](screenshots/windows-v3/90-lead-associate.png)

![招投标公告变更](screenshots/windows-v3/91-lead-change.png)

完整 96 个窗口截图位于 `screenshots/windows-v3/`，文件清单见 `PROTOTYPE-EVIDENCE.json`。核心窗口之外还覆盖认证、证书、账号、产品、提醒、报价动作、MCP、消息监控、规划占位、审计运维和订单高风险动作。

## 14. 前端开发交付要求

前端 Agent 必须：

1. 先建立公共设计系统和布局组件。
2. 按页面模式实施，不逐页复制原型 HTML。
3. 所有接口通过统一客户端调用。
4. 不在浏览器复制业务规则。
5. 为每个页面补加载、空、错误和无权限状态。
6. 使用稳定尺寸和固定单行规则，避免窗口缩放导致重排。
7. 每个页面完成后，与对应设计图进行视觉对照。
8. 每个模块单独提交回归和回退说明。
9. 不删除旧入口，直到新页面通过灰度。
10. 页面变更同步更新契约和测试。

## 15. 后端开发交付要求

后端 Agent 必须：

1. 为页面提供完整分页、筛选、详情和动作接口。
2. 所有身份、权限、数据范围从服务端会话解析。
3. 为列表提供区域筛选和稳定排序。
4. 为关键操作提供幂等、版本和审计。
5. 返回可执行的业务动作列表，减少前端自行判断状态。
6. 提供标准错误码和中文错误消息。
7. 保证报价、订单、收益和成本边界。
8. 为任务失败、回调异常和人工补偿提供状态。

## 16. 最终完成定义

只有同时满足以下条件，UI 全量升级才视为完成：

- 四套正式页面均按目标视觉体系更新。
- 工程化工作区页面与正式页面使用同一设计系统。
- 所有现有业务动作均可从新页面触达。
- 所有关键状态有视觉和交互反馈。
- 所有金额、权限和状态由服务端负责。
- 移动端高频任务有独立页面。
- 旧入口按兼容期工作，且可回退。
- 前端、后端、测试和运维证据齐全。
- `FEATURE-COVERAGE-MATRIX.md` 中 201 项均为 `已覆盖`，56 个页面和 96 个窗口截图证据完整。
