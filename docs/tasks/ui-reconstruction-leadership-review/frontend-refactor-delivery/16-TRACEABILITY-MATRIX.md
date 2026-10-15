# 模块任务追溯矩阵

## 1. 使用说明

本矩阵用于让不同 Agent 快速确认任务范围、目标文件、测试证据和验收标准。状态仅表示文档和开发准备度，不代表正式后端已完成。

| 任务 ID     | 模块       | 文档 | 目标路由               | 目标组件目录                     | mock / Repository      | 测试重点                         | 状态                          |
| ----------- | ---------- | ---- | ---------------------- | -------------------------------- | ---------------------- | -------------------------------- | ----------------------------- |
| UI-FND-01   | 设计系统   | `01` | 全局                   | `apps/web/src/design-system`     | 无需                   | 令牌、组件、5 组宽度             | 前端完成（r11，0 失败）       |
| UI-FND-02   | 权限       | `02` | 全局                   | `apps/web/src/shared/permission` | 会话夹具               | 路由、菜单、动作、字段           | 前端完成（r11，10/10 越权拦截） |
| UI-DASH-01  | 工作台     | `03` | `/admin/dashboard`     | `features/dashboard`             | DashboardRepository    | 指标、待办、跳转、空状态         | 前端完成（r11）               |
| UI-CUST-01  | 客户       | `04` | `/admin/registration`  | `features/customer`              | CustomerRepository     | 状态、查重、权限、档案、跟进     | 前端完成（r11，含档案编辑探针） |
| UI-LEAD-01  | 线索       | `05` | `/admin/leads`         | `features/lead`                  | LeadRepository         | 搜索、详情、角色、预留           | 前端完成（r11，数据待接入）   |
| UI-OPP-01   | 商机       | `06` | `/admin/opportunity`   | `features/opportunity`           | OpportunityRepository  | 七阶段、跟进、报价页签           | 前端完成（r11，七阶段已核验） |
| UI-QUOTE-01 | 报价       | `07` | `/admin/quote`         | `features/quote`                 | QuoteRepository        | 版本、编辑、转订单、只读         | 前端完成（r11）               |
| UI-ORDER-01 | 订单       | `08` | `/admin/order`         | `features/order`                 | OrderRepository        | 状态动作、审批、修订、履约       | 前端完成（r11，含超管确认探针） |
| UI-CHAN-01  | 渠道       | `09` | `/admin/partners`      | `features/channel`               | ChannelRepository      | 核心档案、成员、层级、证书       | 前端完成（r11，含成员弹窗探针） |
| UI-PROD-01  | 产品与价格 | `10` | `/admin/products`      | `features/product`               | ProductRepository      | 目录、阶梯、区域、工作量         | 前端完成（r11，含价格规则探针） |
| UI-APPR-01  | 审核       | `11` | `/admin/admin-review`  | `features/approval`              | ApprovalRepository     | 审批动作、原因、上下文           | 前端完成（r11）               |
| UI-MSG-01   | 消息       | `11` | `/admin/notifications` | `features/message`               | MessageRepository      | 未读、详情、跳转、偏好           | 前端完成（r11，规则接口已修） |
| UI-ORG-01   | 组织账号   | `11` | `/admin/organization`  | `features/organization`          | OrganizationRepository | 开关、角色、账号、证书           | 前端完成（r11）               |

## 2. 页面证据

每个模块必须提供：

- 页面截图：1366 / 1440 / 1600 / 1920。
- 权限截图：至少管理员、区域管理员、渠道用户。
- 状态截图：loading、empty、error、forbidden、conflict。
- 测试报告：引用 `templates/TEST-EXECUTION-REPORT.md`。

## 3. 需求追溯

每个页面动作必须能够追溯到：

- 模块文档中的动作定义。
- Repository 或 mock 方法。
- 测试用例。
- 权限用例。
- 页面证据和测试报告。

无法追溯的动作不得进入正式页面。

## 4. 阻塞记录

出现以下情况时在 `17-ISSUE-FEEDBACK-AND-REWORK-PROTOCOL.md` 中登记：

- 文档内部矛盾。
- 页面或路由未定义。
- 角色和字段权限不明确。
- mock 字段不足。
- 原型与正式代码冲突。
- 测试环境不可用。
- 视觉验收存在争议。
