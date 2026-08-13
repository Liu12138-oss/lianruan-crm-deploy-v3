# 组织架构前端 UI 设计文档（KB-20260813）

> 本文档配套 8 份 HTML 原型，每份原型在浏览器中打开即可看到真实渲染效果。
> 原型路径：`docs/operations/组织架构UI原型/`
> 原型技术栈：Vue 3 + Element Plus（与项目实际一致），CDN 加载，无需构建。

---

## 0. 文档目标

- 给前端开发提供**视觉参考**与**页面结构**基线
- 给后端开发提供**字段映射**与**接口契约**反查
- 给产品 / 业务方提供**真实可看**的原型，便于评审
- 给测试提供**页面结构**作为用例设计输入

## 1. 设计原则

| 原则 | 落地方式 |
| --- | --- |
| 与 V3 现有视觉一致 | 沿用 `apps/web/public/style.css`（Apple Design Style，主色 `#007AFF`，侧栏 `#1D1D1F`），所有原型直接引用真实样式表 |
| 使用项目已有组件库 | Element Plus 全量注册（见 `apps/web/src/main.ts`） |
| 单一管理入口 | 所有页面挂在 `/admin/platform-admin/organization/*` 下 |
| 移动端首期不做 | D-06 决策，桌面端优先 |
| D-02 红线视觉化 | 业务角色页、证书页、数据范围页都有"业务角色 ≠ 权限"的醒目提示 |
| D-03 视觉化 | 证书页顶部 banner + "仅告警不撤销"说明 |
| D-07 占位页面真实可看 | 同步占位页不是空白，时间线 + 占位说明清楚 |

## 2. 全局布局

### 2.1 管理端布局（公共）

```
┌──────────┬──────────────────────────────────────────┐
│          │ 顶栏：面包屑 + 用户身份                       │
│  侧边栏   ├──────────────────────────────────────────┤
│ 232px    │                                          │
│          │  页面标题 + 操作按钮                          │
│  平台管理   │                                          │
│  - 组织架构 │  内容区（白色卡片 + 圆角 10px + 边框 #e5ecf3）│
│  - 账号权限 │                                          │
│  - 渠道运营 │                                          │
│  - 审计日志 │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

侧边栏设计：每个分组用大写小标题区分（"日常业务" / "平台管理"），当前激活项用苹果蓝 `#007AFF` 背景 + 白字 + 蓝色光晕。

#### V3 视觉规范基线（开发必须遵守）

所有 8 份原型**直接引用 V3 真实样式表** `apps/web/public/style.css`，下面是规范要点：

| 项 | V3 规范 |
| --- | --- |
| 主色 | `#007AFF`（苹果蓝） |
| 成功 / 启用 | `#34C759` |
| 警告 / 待补 | `#FF9500` |
| 危险 / 停用 | `#FF3B30` |
| 信息 / 紫色（渠道/离职） | `#5856D6` |
| 中性 / 灰 | `#6E6E73` / `#A1A1A6` |
| 侧栏背景 | `#1D1D1F` |
| 内容区背景 | `#F5F5F7` |
| 卡片背景 | `#FFFFFF` |
| 卡片圆角 | 16px |
| 圆角档位 | 8 / 12 / 16 / 20 / 9999px |
| 阴影 | Apple 极淡多层 `0 2px 8px rgba(0,0,0,0.06)` |
| 侧栏宽 | 240px 固定 |
| 顶栏高 | 52px 毛玻璃 `backdrop-filter: blur(20px)` |
| 字体 | SF Pro / PingFang SC / Microsoft YaHei |
| 卡片标题 | 左侧 4px 蓝色竖条 |
| 导航激活 | 蓝底白字 + 蓝色光晕阴影 |
| 按钮 | primary 蓝底 / default 白底 / text 纯文字 / danger 红底 |

**视觉基线文件**：`docs/operations/视觉基线/V3视觉UI基线.html`（可打开预览）

### 2.2 路由设计

```
/admin/platform-admin/organization
├── /units                   → 01-组织架构主页
│   ├── /units/:id           → 详情页
│   └── /units/:id/status    → 启停归档对话框
├── /positions               → 岗位字典
├── /staff                   → 人员与任职
├── /business-roles          → 02-业务角色
│   ├── /business-roles/:id  → 业务角色详情
│   └── /business-roles/:id/cert-requirements → 证书要求
├── /certifications          → 03-证书管理
│   ├── /certifications/templates
│   └── /certifications/members
├── /data-scopes             → 04-数据范围
│   ├── /data-scopes/roles
│   └── /data-scopes/users   → D-08 关闭
├── /offboarding             → 05-离职交接
│   ├── /offboarding/:id      → 交接单详情
│   └── /offboarding/initiate → 08-发起离职对话框
├── /directory-sync          → 06-同步占位
└── /audit                   → 07-审计日志（与 platform-admin 共用）
```

## 3. 页面清单

| 编号 | 原型文件 | 页面名 | 子项 | 优先级 |
|---|---|---|---|---|
| 01 | `01-组织架构主页.html` | 组织架构主页 | 11.1 + 11.2 | P0 |
| 02 | `02-业务角色.html` | 业务角色字典 | 11.3 | P0 |
| 03 | `03-证书管理.html` | 证书管理 | 11.4 | P0 |
| 04 | `04-数据范围.html` | 数据范围绑定 | 11.5 | P0 |
| 05 | `05-离职交接.html` | 离职交接列表 | 11.6 | P0 |
| 06 | `06-同步占位.html` | 组织同步占位 | 11.7 | P0 |
| 07 | `07-审计查看.html` | 审计日志 | §10 | P0 |
| 08 | `08-发起离职对话框.html` | 发起离职对话框 | 11.6 | P0 |

每个原型的"设计要点 + 字段映射 + 接口对应"在下面章节详述。

---

## 4. 页面 01：组织架构主页

**路径**：`/admin/platform-admin/organization/units`

**原型**：`01-组织架构主页.html`

### 4.1 页面结构

- 顶栏：面包屑（平台管理 / 组织架构）
- 页面标题：组织架构 + 描述 + 操作按钮（导入 / 导出 / 新建组织）
- 工具栏：搜索框 + 域筛选（全部/内部/渠道）+ 状态筛选
- 主区域：**双栏布局**——左 340px 组织树，右详情面板

### 4.2 组织树（左栏）

- 根节点"联软总部"在顶部
- 缩进显示父子关系
- 每个节点显示：图标 / 名称 / 状态徽标 / 类型标签（仅部分节点）
- hover 高亮，点击切换右侧详情
- 折叠 / 展开按钮（▼ / ▶）

### 4.3 详情面板（右栏）

**基本信息**：

| 字段 | 类型 | 来源接口 | 数据库表 |
|---|---|---|---|
| 组织编码 | 文本 | `GET /api/org/units/:id` | `org.org_units.unit_code` |
| 所属域 | 标签 | 同上 | `unit_type` 决定（`department`/`region` 等） |
| 父组织 | 文本+跳转 | 同上 | `parent_unit_id` |
| 负责人 | 文本 | 同上 + `org.manager_relations` | `org.staff_assignments.manager_assignment_id` |
| 当前状态 | 标签 | 同上 | `status_code` |
| 生效时间 | 日期 | 同上 | `effective_at` |
| 失效时间 | 文本 | 同上 | `expired_at` |
| 数据来源 | 标签 | 同上 | `source_code` |
| 路径 | 等宽字体 | 同上 | `path_code::text` |
| sort_order | 数字 | 同上 | `sort_order` |

**岗位子表**：

| 列 | 来源 |
|---|---|
| 岗位编码 | `org.positions.position_code` |
| 岗位名称 | `org.positions.position_name` |
| 类别 | `org.positions.category`（管理/销售/支持/其他） |
| 任职人数 | 关联 `org.staff_assignments` 计数 |
| 操作 | 编辑 / 停用 |

**任职人员子表**：

| 列 | 来源 |
|---|---|
| 姓名 | `iam.users.display_name` |
| 账号 | `iam.users.username` |
| 岗位 | `org.positions.position_name` |
| 主职 | `org.staff_assignments.is_primary` |
| 直属负责人 | `org.manager_relations.manager_assignment_id` → 用户 |
| 有效期 | `effective_at` ~ `expired_at` |
| 操作 | 调岗 / 改负责人 / 离职 |

### 4.4 操作按钮

| 按钮 | 行为 | 权限 |
|---|---|---|
| 新建组织 | 打开 `OrgUnitFormDialog` | `org.unit.create` |
| 编辑 | 打开编辑对话框 | `org.unit.update` |
| 启停 | 打开 `OrgUnitStatusDialog` | `org.unit.status` |
| 归档 | 同上，归档有守卫 | `org.unit.status` |
| 添加岗位 | 打开岗位表单 | `org.position.create` |
| 添加任职 | 打开任职表单 | `org.assignment.create` |
| 调岗 | 结束旧 + 新建新任职 | `org.assignment.update` |
| 离职 | 跳到 08 对话框 | `org.staff.offboard` |

---

## 5. 页面 02：业务角色

**路径**：`/admin/platform-admin/organization/business-roles`

**原型**：`02-业务角色.html`

### 5.1 顶部 D-02 红线提示

页面顶部必须有黄色 alert：

> ⚠ D-02 红线：业务角色名（"销售经理"）**不等于**权限（`partner.order.create`）。授权走 `user_permission_roles`，岗位名只做业务显示。

### 5.2 三个 Tab

1. **业务角色**：字典表（编码 / 名称 / 域 / 类别 / 覆盖部门 / 持有人 / 证书要求 / 状态 / 操作）
2. **角色-证书要求**：哪个业务角色要求哪个证书模板，多少张
3. **角色-权限映射**：业务角色被指派时，自动应用哪些 `iam.roles`

### 5.3 字段映射

| 列 | 来源 |
|---|---|
| 编码 | `org.business_roles.role_code` |
| 名称 | `org.business_roles.role_name` |
| 域 | `domain_code`（internal/channel） |
| 类别 | `category`（sales/pre_sales/post_sales/tech/business_assistant/manager） |
| 覆盖部门 | `JOIN org.staff_assignments` 计数（去重 org_unit_id） |
| 持有人 | `JOIN org.staff_assignments WHERE business_role_id=X` 计数 |
| 证书要求 | `JOIN org.business_role_cert_requirements` 显示证书模板名 + (持有/要求) 比例 |
| 状态 | `status_code`（active/disabled） |

### 5.4 业务角色类别标签配色

| 类别 | 配色 | 标签 |
|---|---|---|
| sales | 浅黄 | 销售 |
| pre_sales | 浅蓝 | 售前 |
| post_sales | 浅紫 | 售后 |
| tech | 浅绿 | 技术 |
| business_assistant | 浅红 | 商务 |
| manager | 浅橙 | 管理 |

---

## 6. 页面 03：证书管理

**路径**：`/admin/platform-admin/organization/certifications`

**原型**：`03-证书管理.html`

> **2026-08-13 改进**：颁发对话框支持"按渠道商选员工"，证书表新增"所属渠道商"列，搜索范围扩大到渠道商名。这是为了让"给对应渠道商的对应用户加证书"和"搜对应渠道商的证书"两个场景无需切换页面。

### 6.1 顶部到期预警 Banner

黄色 banner 显示三类数字：

- **7 天内到期：N 条**（点击跳过滤）
- **已过期：N 条**
- **有效中：N 条**

### 6.2 D-03 底部说明

页面底部蓝色 info banner：

> 💡 D-03 说明：证书过期仅写 `certification_expiry_events` + 三通道告警，**不会**自动撤销业务角色。撤销业务角色由管理员根据证书状态和实际业务情况手工处理。

### 6.3 三个 Tab

1. **证书模板**：`org.certification_templates`
2. **员工证书**（默认）：**所属渠道商** / 持有人 / 模板 / 类别 / 颁发方 / 颁发日 / 到期日 / 剩余天数 / 状态
3. **过期事件**：`org.certification_expiry_events`，含检测时间 / 通知发送状态 / 处理人

> **关键改进（KB-20260813）**：
> - 员工证书表新增"所属渠道商"列，通过 `channel.partner_members` 反查 join，区分渠道员工与内部员工（"— 内部员工"）。
> - 搜索框占位符改为"🔍 按持有人 / 模板 / 渠道商搜索…"，**搜索范围扩大到渠道商名**。
> - 筛选新增"渠道商"下拉（所有渠道商 / 联软渠道（华东）/（华北）/（华南）/ 内部员工），与"类别""状态"并列。

### 6.4 状态标签配色

| 状态 | 配色 | 触发 |
|---|---|---|
| 有效 | 绿 | `expires_on > today AND status_code='active'` |
| 即将过期 | 黄 | `expires_on <= today + 7 AND expires_on > today` |
| 已过期 | 红 | `expires_on <= today` |
| 已撤销 | 灰 | `status_code='revoked'` |

### 6.5 颁发证书对话框（按渠道商选员工）

**入口**：页面顶部"➕ 颁发证书"按钮。

**3 步流程**：

```
步骤 1：选员工
  ├─ 渠道商下拉（必选）
  │   ├─ 所有渠道商
  │   ├─ 联软渠道（华东）
  │   ├─ 联软渠道（华北）
  │   ├─ 联软渠道（华南）
  │   └─ （内部员工只能从其他入口进入）
  ├─ 员工姓名/账号搜索（实时过滤该渠道员工）
  └─ 员工列表（最多展示前 50 条，含已持有证书数）

步骤 2：选证书模板（必选）
  ├─ 模板下拉（按 category 分组）
  ├─ 颁发后系统自动写入 cert_no / issuing_authority / expires_on
  └─ 显示模板默认有效期与颁发方

步骤 3：填颁发信息
  ├─ 颁发日期（默认今天）
  ├─ 到期日期（默认按模板有效期计算）
  ├─ 实际颁发方（可覆盖模板默认）
  ├─ 证书编号（可选，留空自动生成）
  └─ 证书附件（可选，PDF/图片，5MB 以内）
```

**关键设计**：

- 渠道商下拉**与员工列表联动**：切换渠道商 → 自动重新加载员工列表 → 搜索框作用域自动限制。
- 搜索结果中显示员工当前持有证书数（"已持有 2 张证书"），避免重复颁发同类证书。
- 已选员工以"渠道员工"标签显示在预览区，明确归属。
- 表单底部保留 D-03 蓝色说明 banner，提醒"证书过期不撤销业务角色"。

**字段映射**：

| 字段 | 来源 |
|---|---|
| 渠道商下拉 | `channel.partners`（仅 `status='active'`）|
| 员工列表 | `iam.users` JOIN `channel.partner_members` WHERE partner_id = selected_partner |
| 已持有证书数 | `COUNT(org.member_certifications WHERE user_id=X AND status='active')` |
| 证书模板 | `org.certification_templates` |
| 颁发日期 | 默认 `today`，可改 |
| 到期日期 | 默认 `issued_on + validity_days` |
| 实际颁发方 | 默认 `template.issuing_authority`，可覆盖 |
| 证书编号 | 自动生成或人工填写 |
| 附件 | 走 `ops.files` 表 |

### 6.6 字段映射

| 列 | 来源 |
|---|---|
| **所属渠道商** | `channel.partner_members JOIN channel.partners`，无关联时显示"— 内部员工" |
| 持有人 | `iam.users.display_name` |
| 账号 | `iam.users.username` |
| 证书模板 | `org.certification_templates.template_name` |
| 类别 | `category`（pre_sales/post_sales/product/compliance/other） |
| 颁发方 | `issuing_authority`（可与模板默认不同） |
| 颁发日 | `issued_on` |
| 到期日 | `expires_on` |
| 剩余天数 | 计算列 `expires_on - today` |
| 状态 | 综合 `status_code` + 到期日 |
| 操作 | 查看 / 延期 / 撤销 |

### 6.7 搜索与筛选

| 控件 | 行为 |
|---|---|
| 搜索框 | `OR` 匹配：持有人.display_name / 账号.username / 渠道商名.partner_name（不区分大小写）|
| 类别下拉 | 过滤 `category` |
| 渠道商下拉 | 过滤 `partner_id`；选"所有渠道商"显示全部，选"联软渠道（华东）"只显示该渠道员工，选"— 内部员工"只显示无渠道关联的用户 |
| 状态下拉 | 过滤 `status_code` + 到期日综合判断 |

### 6.8 接口对应（证书管理）

| 页面操作 | 接口 |
|---|---|
| 列表筛选查询 | `GET /api/org/member-certifications?keyword=&partner_id=&category=&status=` |
| 颁发证书 | `POST /api/org/users/:id/certifications`（携带 `partner_id` 来源） |
| 延期 | `PUT /api/org/member-certifications/:id/extend` |
| 撤销 | `PUT /api/org/member-certifications/:id/revoke` |
| 渠道商下拉 | `GET /api/channel/partners?status=active`（仅 active） |
| 渠道员工列表 | `GET /api/channel/partners/:id/members?keyword=` |

> 推荐新增接口（KB-20260813）：
> - `GET /api/org/member-certifications/search-by-partner?partner_id=&keyword=` —— 专项渠道证书检索
> - `GET /api/org/cert-templates?category=` —— 模板按类别筛选

---

## 7. 页面 04：数据范围

**路径**：`/admin/platform-admin/organization/data-scopes`

**原型**：`04-数据范围.html`

### 7.1 D-08 / D-11 提示

- 顶部黄色 alert：**首期仅支持 `subject_type='role'`**，用户级覆盖默认关闭。
- 右侧切换 Tab：
  - "按角色绑定"（可用）
  - "按用户绑定（D-08 关闭）"（灰色 + 提示）

### 7.2 主体选择器

选择某个角色后，展示该角色的所有数据范围绑定。

### 7.3 资源 + 范围卡片

每张卡片是一个"资源类型 + 范围类型"的组合：

- **客户（customer）+ org_tree**：显示覆盖的组织树节点
- **商机（opportunity）+ org_tree + self**：组织树 + 本人创建
- **渠道商（partner）+ channel_tree**：覆盖的渠道树
- **合同（contract）+ org_tree**

### 7.4 字段映射

| 字段 | 来源 |
|---|---|
| 主体类型 | `iam.data_scope_bindings.subject_type`（role / user） |
| 主体 ID | `subject_id`（role → `iam.roles.id`，user → `iam.users.id`） |
| 资源 | `resource_code`（customer / opportunity / contract / partner ...） |
| 范围类型 | `scope_type`（all / org_tree / region / channel / channel_tree / self / custom） |
| 范围目标 | `scope_target_id`（组织 / 区域 / 渠道 ID） |
| 生效 / 失效 | `effective_at` / `expired_at` |

### 7.5 统计指标

顶部 4 个 el-statistic：

- 绑定资源数（distinct resource_code）
- 覆盖范围项（distinct scope_target_id）
- 数据范围策略（聚合展示）
- 授权版本（与 `iam.users.authorization_version` 联动）

---

## 8. 页面 05：离职交接

**路径**：`/admin/platform-admin/organization/offboarding`

**原型**：`05-离职交接.html`

### 8.1 顶部状态卡片

4 个统计卡：

- 进行中（蓝色）
- 部分完成（待补，黄色）
- 已完成（30 天内，绿色）
- 已生成管理员任务（紫色）

### 8.2 交接单列表

每行展示：

- 交接单号（`HO-YYYY-NNN`）
- 离职员工 + 账号
- 所属组织
- 接收人（"待补"或"取消"灰色标记）
- 发起时间
- 领域完成度（`已完成/总数`，部分完成时附带"X 项进入管理员队列"）
- 状态标签

### 8.3 交接单详情（点击展开）

**基本信息**：

- 离职员工 + 部门
- 离职原因（主动 / 公司辞退 / 退休 / 其他）
- 发起人 + 时间
- **账号状态**（红色强调：已停用）
- **任职状态**（红色强调：已结束所有任职）
- `offboarding_status`（offboarding）

**部分完成警告**：

> ⚠ 部分完成：客户 N 项、报备 M 项因"客户有保护规则"未自动转移。剩余 X 项已写入 `workflow.process_tasks`，由具备 `org.offboarding.handle` 权限的内部管理员与企业管理员处理。

### 8.4 6 领域明细

抽屉 / 折叠展开：

| 领域 | 表 | transfer_strategy | transferred / remaining |
|---|---|---|---|
| customer | `crm.customers` | single_receiver / by_rule | 列出对象编号 + 名称 |
| registration | `crm.registrations` | 同上 | 同上 |
| opportunity | `crm.opportunities` | 同上 | 同上 |
| contract | `crm.contracts` | 财务复核进队列 | 列出合同号 |
| todo | `ops.notifications` | single_receiver | 列出待办标题 |
| approval | `ops.approvals` | single_receiver | 列出审批标题 |

### 8.5 操作

- 重试项：对单项重新触发 transfer
- 补做：进入管理员任务列表（`/workspace/admin/workflow/tasks`）
- 查看详情：抽屉展开
- 取消：仅进行中可取消

---

## 9. 页面 06：同步占位

**路径**：`/admin/platform-admin/organization/directory-sync`

**原型**：`06-同步占位.html`

### 9.1 设计要点

**首期不允许"空白页"或"开发中"**——必须给业务方一个"我们知道这事、未来会做"的明确答复。

### 9.2 状态信息

- 顶部蓝色 alert：`enabled=false · 首期未启用`
- 字段预留说明：所有相关字段已建好，启用仅需实现 service / worker

### 9.3 时间线（计划感）

5 步时间线，已完成项是青色实心圆 + 蓝色标签，未来项是灰色圆 + 浅色标签：

1. ✅ 字段预留完成（2026-08-13）
2. ✅ 占位接口实现（2026-08-13）
3. ⏳ 接入 IAM 适配器
4. ⏳ 接入企微通讯录适配器
5. ⏳ 实现冲突策略

### 9.4 手工映射登记

下方"外部对象手工映射"区域：首期允许手工登记，提示"供将来启用同步时使用"。

### 9.5 接口对应

| 接口 | 响应 |
|---|---|
| `POST /api/integrations/directory-sync/preview` | 501 + "首期未启用" |
| `POST /api/integrations/directory-sync/run` | 501 + "首期未启用" |
| `GET /api/integrations/directory-sync/runs` | 200 + `{ runs: [], note: '首期未启用' }` |
| `GET /api/integrations/directory-sync/status` | 200 + `{ enabled: false, note: '...' }` |

---

## 10. 页面 07：审计查看

**路径**：`/admin/platform-admin/audit`（与 platform-admin 共用）

**原型**：`07-审计查看.html`

### 10.1 筛选器

6 个筛选条件组合：

- 对象类型（组织/任职/业务角色/证书/数据范围/离职交接）
- 事件码（下拉显示已注册的事件码列表）
- 操作者
- 时间范围
- 对象 ID / 关键字

### 10.2 审计列表

每行：

- 时间（含毫秒）
- 事件码（等宽字体）
- 对象（用户/资源名）
- 操作者
- 来源 IP
- 请求编号（前 8 字符 + 省略号）
- 概要
- 操作：详情

### 10.3 详情面板（点击展开）

**before / after JSON diff**：

```json
{
  "user_id": "chenqiang-uuid",
  "status_code": "active",
  "offboarding_status": "active",
  "sessions": 3
}
```

↓ 变更后 ↓

```json
{
  "user_id": "chenqiang-uuid",
  "status_code": "disabled",
  "offboarding_status": "offboarding",
  "sessions_revoked": 3,
  "assignments_expired": 1,
  "handover_items": 6
}
```

**审计上下文**：

- 审计 ID、请求 ID、会话 ID
- 授权版本变化（递增醒目提示：旧会话立即失效）
- 客户端信息
- row_hash（哈希链保证不可篡改）

### 10.4 字段映射

| 字段 | 来源 |
|---|---|
| 事件码 | `audit.audit_events.event_code` |
| 对象 | payload 中的 `object_id` / `object_name` |
| 操作者 | `actor_user_id` → `iam.users.username` |
| IP | `source_ip` |
| 请求 ID | `request_id` |
| 概要 | 从 payload 提取的关键字段 |
| before/after | payload.before / payload.after |
| row_hash | `row_hash`（前一行的 hash + 本行内容） |

---

## 11. 页面 08：发起离职对话框

**路径**：覆盖在 `/offboarding` 上方的 Modal

**原型**：`08-发起离职对话框.html`

### 11.1 视觉强调

- 顶部红色 alert：**"重要提示：此操作不可撤回"**
- 立即停用 + 撤销会话必须醒目（红字）
- 6 个领域扫描预览提前展示，让管理员看到"会有什么发生"

### 11.2 字段

| 字段 | 类型 | 必填 | 来源 |
|---|---|---|---|
| 离职员工 | 预览卡片 | — | 来自列表选择 |
| 离职原因 | 单选（主动 / 公司辞退 / 退休 / 其他） | 是 | 表单 |
| 备注 | 文本域 | 是 | 进审计 |
| 接收人 | 单选（推荐 / 其他 / 管理员队列） | 是 | 表单 |
| 扫描预览 | 6 领域 | — | 实时查询 |
| 确认按钮 | "确认发起离职"（红色） | — | — |

### 11.3 6 领域扫描预览格式

```
👥 客户（customer）                  23 个 · 其中 21 个可自动转移
📋 客户报备（registration）             8 个 · 全部可自动转移
💼 商机（opportunity）                12 个 · 10 个可转移 · 2 个进入管理员队列
📄 合同（contract）                    5 个 · 需财务复核 · 进入管理员队列
📝 待办（todo）                       3 个 · 自动转移给接收人
✅ 审批（approval）                    2 个 · 自动转移给接收人
```

### 11.4 决策点回看

- **不引入二次确认**（用户已决定）
- 弹窗内文必须明确告知"账号将立即停用、所有会话将被撤销"
- 误操作风险：弹窗顶部红色 alert + "不可撤回"措辞 + 底部按钮文案"确认发起离职"（红色）

---

## 12. 组件清单

按原型图中出现的组件整理：

### 12.1 组织架构组件

```
apps/web/src/components/admin/organization/
├── OrgTree.vue                    # 树（el-tree）
├── OrgUnitFormDialog.vue          # 新建/编辑
├── OrgUnitStatusDialog.vue        # 启停归档
├── OrgUnitDetailHeader.vue        # 详情面板顶部
├── PositionTable.vue              # 岗位表
├── PositionFormDialog.vue
├── StaffAssignmentTable.vue       # 任职表
├── StaffAssignmentDialog.vue      # 调岗（结束+新建）
├── ManagerRelationEditor.vue      # 直属负责人
├── BusinessRoleTable.vue
├── BusinessRoleFormDialog.vue
├── BusinessRoleCertRequirements.vue
├── BusinessRolePermissionGrants.vue
├── CertificationTemplateTable.vue
├── CertificationTemplateDialog.vue
├── MemberCertificationTable.vue
├── MemberCertificationDialog.vue # 颁发/延期/撤销
├── DataScopeBindingPanel.vue
├── OffboardingInitiateDialog.vue  # 复用 08 的视觉
├── OffboardingDetailDrawer.vue
├── DirectorySyncPlaceholder.vue   # 复用 06 的视觉
└── AuditTable.vue
```

### 12.2 复用组件

- `el-table`：所有列表
- `el-tree`：组织树
- `el-dialog`：所有弹窗
- `el-drawer`：详情面板、6 领域明细
- `el-form`：所有表单
- `el-tag`：状态标签（统一 5 套配色：active 绿 / disabled 红 / draft 黄 / archived 灰 / 业务角色 6 类）
- `el-statistic`：统计卡片
- `el-timeline`：时间线
- `el-pagination`：列表分页
- `el-alert`：D-02 / D-03 / D-08 等提示

## 13. 状态标签配色规范（全局）

| 状态 | 背景色 | 文字色 | 用途 |
|---|---|---|---|
| active / 启用 / 有效 | `#dcfce7` | `#166534` | 通用"正常" |
| disabled / 停用 / 撤销 | `#fee2e2` | `#991b1b` | 通用"停用" |
| draft / 草稿 / 待补 | `#fef3c7` | `#92400e` | 通用"中间" |
| archived / 归档 | `#e5e7eb` | `#4b5563` | 通用"完成" |
| 内部域 | `tag-purple` | `#5856D6` | 域标签（沿用 V3 紫色 6 套官方色）|
| 渠道域 | `tag-purple` | `#5856D6` | 域标签 |
| 区域 | `#fae8ff` | `#86198f` | 地理标签 |
| 渠道 | `#fed7aa` | `#9a3412` | 渠道标签 |
| 主职 | `#fef9c3` | `#854d0e` | 业务角色标记 |
| 部分完成 | `#fef3c7` | `#92400e` | 交接状态 |
| 已完成 | `#dcfce7` | `#166534` | 交接状态 |
| 已取消 | `#e5e7eb` | `#4b5563` | 交接状态 |

## 14. 与后端接口的对应

### 14.1 11.1 + 11.2 接口对应

| 页面 | 接口 |
|---|---|
| 01 主页（树加载） | `GET /api/org/units/tree` |
| 01 详情面板 | `GET /api/org/units/:id` |
| 01 岗位表 | `GET /api/org/units/:id/positions` |
| 01 任职表 | `GET /api/org/units/:id/staff` |
| 01 新建组织 | `POST /api/org/units` |
| 01 编辑 | `PUT /api/org/units/:id` |
| 01 启停归档 | `PUT /api/org/units/:id/status` |
| 01 调岗 | `PUT /api/org/assignments/:id` |
| 01 离职入口 | 跳到 08 对话框 |

### 14.2 11.3 接口对应

| 页面 | 接口 |
|---|---|
| 02 列表 | `GET /api/org/business-roles` |
| 02 详情 | `GET /api/org/business-roles/:id` |
| 02 证书要求 | `GET /api/org/business-roles/:id/cert-requirements` |
| 02 权限映射 | `GET /api/org/business-roles/:id/permission-grants` |
| 02 指派业务角色 | `POST /api/channel/partners/:id/members` |
| 02 撤销业务角色 | `PUT /api/channel/partner-members/:id/expire` |

### 14.3 11.4 接口对应

| 页面 | 接口 |
|---|---|
| 03 模板列表 | `GET /api/org/certification-templates` |
| 03 员工证书 | `GET /api/org/users/:id/certifications` |
| 03 颁发证书 | `POST /api/org/users/:id/certifications` |
| 03 延期 | `PUT /api/org/member-certifications/:id/extend` |
| 03 撤销 | `PUT /api/org/member-certifications/:id/revoke` |

### 14.4 11.5 接口对应

| 页面 | 接口 |
|---|---|
| 04 角色绑定 | `GET /api/org/roles/:id/data-scopes` |
| 04 保存 | `PUT /api/org/roles/:id/data-scopes` |
| 04 用户绑定（D-08 关闭） | 返回 409 |

### 14.5 11.6 接口对应

| 页面 | 接口 |
|---|---|
| 05 列表 | `GET /api/org/offboarding` |
| 05 详情 | `GET /api/org/offboarding/:id` |
| 05 重试项 | `POST /api/org/offboarding/:id/retry-items` |
| 08 发起 | `POST /api/org/staff/:userId/offboard` |
| 08 扫描预览 | `POST /api/org/staff/:userId/offboard/preview`（新增建议接口） |

### 14.6 11.7 接口对应

| 页面 | 接口 | 响应 |
|---|---|---|
| 06 状态 | `GET /api/integrations/directory-sync/status` | 200 `{enabled:false,note:'...'}` |
| 06 占位 | `POST /api/integrations/directory-sync/preview` | 501 |
| 06 占位 | `POST /api/integrations/directory-sync/run` | 501 |
| 06 占位 | `GET /api/integrations/directory-sync/runs` | 200 `{runs:[],note:'...'}` |

### 14.7 审计接口对应

| 页面 | 接口 |
|---|---|
| 07 筛选查询 | `GET /api/org/audit/events?object_type=...&event_code=...&...` |
| 07 详情 | `GET /api/org/audit/events/:id` |
| 07 哈希链 | `GET /api/org/audit/hash-chain?start=...&end=...` |
| 07 导出 | `GET /api/org/audit/events/export?...` |

## 15. 可访问性

- 所有标签和按钮含 `aria-label`
- 颜色对比度满足 WCAG AA
- 表格支持键盘导航
- 时间字段使用 ISO 8601 + 本地化显示
- 状态标签文字 + 颜色双重提示（避免色盲）

## 16. 国际化

首期仅中文界面；预留 i18n 接口（`@/i18n` 钩子），二期支持英文。

## 17. 浏览器兼容

- Chrome ≥ 100
- Edge ≥ 100
- Safari ≥ 15
- 不支持 IE
- 移动端：仅会话过期 / 登录 / 首页，不开放组织管理页面（D-06）

## 18. 性能预算

- 首屏加载 < 2 秒（管理端侧边栏 + 顶栏）
- 表格 100 行内 < 500ms 渲染
- 树懒加载：每次展开最多加载 50 个子节点
- 接口响应 < 200ms（缓存友好）

## 19. 原型查看方法

```bash
# 方式 1：直接打开
open docs/operations/组织架构UI原型/01-组织架构主页.html

# 方式 2：起本地静态服务（推荐，CDN 加载更稳定）
cd docs/operations/组织架构UI原型
python3 -m http.server 8080
# 浏览器访问 http://localhost:8080/01-组织架构主页.html

# 方式 3：macOS Quick Look 预览
qlmanage -p 01-组织架构主页.html
```

每份原型都是**独立的** HTML，浏览器打开即可看到真实页面。所有组件通过 CDN 加载 Element Plus，无构建步骤。

---

[返回组织架构首期落地开发方案](组织架构首期落地开发方案.md) · [返回主方案](V3业务平台底座与业务扩展实施交付方案.md#章节-21)
