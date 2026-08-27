# 组织架构前端 UI 设计文档（KB-20260813）

> 本文档配套 8 份 HTML 原型，每份原型在浏览器中打开即可看到真实渲染效果。
> 原型路径：`docs/operations/组织架构UI原型/`
> `docs/operations/组织架构UI原型.bak/` 仅为历史备份，不是开发、评审或验收依据；与正式原型冲突时一律忽略。
> 原型技术栈：Vue 3 + Element Plus（与项目实际一致），CDN 加载，无需构建。
> 修订版本：2026-08-27-R5；在 R4 基础上补齐合作伙伴经营报表入口，对齐当前正式 `/admin.html`：左侧单一组织架构入口、单一内部任职、销售/技术二选一、渠道成员四入口统一资料、多证书授权和逻辑归档。8 份原型仅保留视觉参考，若与当前正式页面和 OpenAPI 冲突，以正式页面和契约为准。

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
| 单一管理入口 | 当前正式入口为 `/admin.html#/organization/*`，继续使用原左侧菜单和内容区；`/workspace/admin/*` 仅为工程化过渡预览 |
| 移动端首期不做 | D-06 决策，桌面端优先 |
| D-02 红线视觉化 | 业务角色页、证书页、数据范围页都有"业务角色 ≠ 权限"的醒目提示 |
| D-03 视觉化 | 证书页顶部 banner + "仅告警不撤销"说明 |
| D-07 / D-19 同步受控 | 企微同步先只读预览，审批后受控应用；安全边界和高风险差异始终可见 |
| D-13 上下文可见 | 顶栏始终展示当前内部或渠道工作身份；切换后重新加载权限与数据，不能只换标签 |
| 冲突可恢复 | `row_version` 冲突保留用户输入，展示差异并允许刷新后重试 |
| 高风险可控 | 离职保留一次业务确认，叠加独立权限、近期强认证和后端幂等，不重复弹窗 |
| 单一内部任职 | 当前不展示主职、兼职或跨部门任职；已有任职使用“调整”，无任职时才允许“添加” |
| 统一成员资料 | 组织架构、渠道商员工、企业管理员、合作伙伴经营报表共用姓名、电话、邮箱、销售/技术角色和多份证书；身份、审批、账号状态、系统权限和外部身份独立 |

## 2. 全局布局

### 2.1 管理端布局（公共）

```
┌──────────┬──────────────────────────────────────────┐
│          │ 顶栏：面包屑 + 当前工作身份 + 返回原工作台     │
│  侧边栏   ├──────────────────────────────────────────┤
│ 232px    │                                          │
│          │  页签：组织与成员 | 证书管理 | 角色管理       │
│          │  | 权限与范围 | 离职交接 | 企微同步         │
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

组织架构内嵌于当前管理员页面内容区：点击左侧菜单“组织架构”后，侧边栏与顶栏保持不变；六个栏目（组织与成员、证书管理、角色管理、权限与范围、离职交接、企微同步）在内容区顶部切换。销售/技术业务角色不再单独提供自定义字典页，而是在内部成员抽屉和渠道统一成员资料弹窗中二选一。

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
/admin.html
└── #/organization
    ├── /units                   → 组织与成员（默认）
    ├── /certifications          → 证书管理
    ├── /rbac                    → 系统角色管理
    ├── /data-scopes             → 权限与范围
    ├── /offboarding             → 离职交接
    └── /directory-sync          → 企微组织同步

兼容路径 `#/organization/staff` 和 `#/organization/business-roles` 保留路由识别，但不作为正式菜单入口；不得据此恢复一人多任职或自定义人员业务角色页面。
```

## 3. 页面清单

| 编号 | 原型文件 | 页面名 | 子项 | 优先级 |
|---|---|---|---|---|
| 01 | `01-组织架构主页.html` | 组织架构主页 | 11.1 + 11.2 | P0 |
| 02 | `02-业务角色.html` | 历史业务角色视觉参考；当前由统一成员资料弹窗承载销售/技术选择 | 11.3 | 参考 |
| 03 | `03-证书管理.html` | 证书管理 | 11.4 | P0 |
| 04 | `04-数据范围.html` | 数据范围绑定 | 11.5 | P0 |
| 05 | `05-离职交接.html` | 离职交接列表 | 11.6 | P0 |
| 06 | `06-同步占位.html` | 企微组织同步控制台 | 11.7A + 11.7B | P0 |
| 07 | `07-审计查看.html` | 审计日志 | §10 | P0 |
| 08 | `08-发起离职对话框.html` | 发起离职对话框 | 11.6 | P0 |

每个原型的"设计要点 + 字段映射 + 接口对应"在下面章节详述。

---

## 4. 页面 01：组织架构主页

**路径**：`/admin.html#/organization/units`

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
| 组织负责人 | 文本 | 同上 | `org.org_units.manager_assignment_id` → `org.staff_assignments` → `iam.users`；直属汇报关系仍只读 `org.manager_relations` |
| 当前状态 | 标签 | 同上 | `status_code` |
| 生效时间 | 日期 | 同上 | `effective_at` |
| 失效时间 | 文本 | 同上 | `expired_at` |
| 数据来源 | 标签 | 同上 | `source_code` |
| 路径 | 等宽字体 | 同上 | `path_code::text` |
| sort_order | 数字 | 同上 | `sort_order` |
| 数据版本 | 隐藏提交字段 | 同上 | `row_version` |

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
| 任职状态 | 当前未结束记录统一显示“当前任职” |
| 直属负责人 | `org.manager_relations` 中当前有效 `direct` 关系 → 负责人任职 → 用户 |
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

交互约束：

- 编辑和移动提交携带 `row_version`；发生版本冲突时不关闭弹窗，展示“数据已被其他人更新”，允许对比最新值、复制已填内容或重新应用。
- 渠道域组织必须先选择所属渠道商；选择父节点后自动锁定渠道商，禁止出现跨渠道父子组合。
- 状态切换只展示服务端返回的可执行动作，前端不自行推导状态机。

---

## 5. 页面 02：业务角色（当前不单独开放）

**当前入口**：内部成员编辑抽屉、渠道统一成员资料弹窗。

**原型**：`02-业务角色.html`

原 `02-业务角色.html` 只保留视觉参考。当前业务规则固定为：

- 内部成员：销售、技术二选一，对应 `internal_sales`、`internal_technical`。
- 渠道成员：销售、技术二选一，对应 `channel_sales`、`channel_technical`。
- 不在正式页面创建、改名、停用或扩展人员业务角色，也不展示售前、售后、商务、管理、其他等自定义类别。
- 业务角色只表示人员职责，不自动授予系统权限；系统角色仍在“角色管理”栏目独立配置。
- 同一弹窗可以独立勾选多份证书；证书颁发、撤销、到期均不自动改变销售/技术角色。

### 5.1 D-02 红线提示

页面顶部必须有黄色 alert：

> ⚠ D-02 红线：业务角色名（"销售经理"）**不等于**权限（`partner.order.create`）。授权走 `user_permission_roles`，岗位名只做业务显示。

### 5.2 统一成员资料弹窗

弹窗字段固定为姓名、登录账号只读、电话、邮箱、业务角色单选和证书多选。渠道成员的所属渠道、企业管理员身份、审批状态、账号状态、系统权限和 IAM/UniSDP 外部身份只展示或保持原入口管理，不进入统一保存参数。

### 5.3 字段映射

| 列 | 来源 |
|---|---|
| 编码 | `org.business_roles.role_code` |
| 名称 | `org.business_roles.role_name` |
| 域 | `domain_code`（internal/channel） |
| 类别 | `sales` 或 `tech_engineer` |
| 覆盖组织或渠道 | `org.member_business_roles` 分别关联内部任职的 `org_unit_id` 或渠道成员的 `partner_id` 后去重计数 |
| 持有人 | `JOIN org.member_business_roles` 后按内部任职或渠道成员去重计数 |
| 证书要求 | `JOIN org.business_role_cert_requirements` 显示证书模板名 + (持有/要求) 比例 |
| 状态 | `status_code`（active/disabled） |

### 5.4 四入口一致性

- 超级管理员从组织架构、渠道商员工、企业管理员或合作伙伴经营报表编辑渠道人员时，均调用 `GET /api/org/channel-members/:id/profile` 读取。
- 保存均调用 `PUT /api/org/channel-members/:id/profile`，携带行版本、业务角色和证书增撤集合；服务端在同一事务更新。
- 保存成功后关闭弹窗并重新加载当前入口，不依赖前端本地复制形成“看似同步”。
- 区域管理员继续沿用原渠道成员受限编辑流程，不因经营报表复用统一弹窗而扩大为组织架构管理权限。
- 企业管理员身份和审批状态独立保存，统一资料接口不得接收或改写相应字段。

### 5.5 业务角色类别标签配色

| 类别 | 配色 | 标签 |
|---|---|---|
| sales | 浅黄 | 销售 |
| tech_engineer | 浅绿 | 技术 |

---

## 6. 页面 03：证书管理

**路径**：`/admin.html#/organization/certifications`

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

告警详情按站内、企微和邮箱分别显示“待投递、已受理、已送达、失败、重试中”，不得用一个“已发送”覆盖三通道结果。重复扫描不应在页面产生重复阈值事件。

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
| 列表筛选查询 | `GET /api/org/member-certifications?keyword=&partnerId=&category=&status=` |
| 颁发证书 | `POST /api/org/users/:id/certifications`（携带 `partner_id` 来源） |
| 延期 | `PUT /api/org/member-certifications/:id/extend` |
| 撤销 | `PUT /api/org/member-certifications/:id/revoke` |
| 渠道商下拉 | `GET /api/channel/partners?status=active`（仅 active） |
| 渠道员工列表 | `GET /api/channel/partners/:id/members?keyword=` |

> 接口收口（KB-20260814）：复用 `GET /api/org/member-certifications` 的组合筛选能力，不新增用途重叠的 `search-by-partner` 路径；模板类别筛选统一使用 `GET /api/org/certification-templates?category=`。

---

## 7. 页面 04：数据范围

**路径**：`/admin.html#/organization/data-scopes`

**原型**：`04-数据范围.html`

### 7.1 D-08 / D-11 提示

- 顶部黄色 alert：**首期仅支持 `subject_type='role'`**，用户级覆盖默认关闭。
- 首期只渲染“按角色绑定”，不提供用户级编辑 Tab；页面说明区提供“查看历史用户级绑定审计”链接。

### 7.2 主体选择器

先展示当前工作身份，再选择权限角色，展示该角色在当前上下文中的数据范围绑定。首期不提供用户级编辑切换；历史用户级绑定只在审计详情中只读展示。

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
- 当前工作上下文（内部组织或渠道商）
- 权限差异任务（待确认、超期）

---

## 8. 页面 05：离职交接

**路径**：`/admin.html#/organization/offboarding`

**原型**：`05-离职交接.html`

### 8.1 顶部状态卡片

状态统计卡：

- 停权处理中（红色）
- 扫描中（蓝色）
- 交接中（蓝色）
- 部分完成（待补，黄色）
- 已完成（30 天内，绿色）
- 待管理员处理（橙色）
- 已生成管理员任务（紫色）

### 8.2 交接单列表

每行展示：

- 交接单号（`HO-YYYY-NNN`）
- 离职员工 + 账号
- 所属组织
- 接收人（“待补”或“管理员任务队列”标记）
- 发起时间
- 领域完成度（`已完成/总数`，部分完成时附带"X 项进入管理员队列"）
- 状态标签

### 8.3 交接单详情（点击展开）

**基本信息**：

- 离职员工 + 部门
- 离职原因（主动 / 公司辞退 / 退休 / 其他）
- 发起人 + 时间
- **账号状态**（红色强调：已停用）
- **成员关系状态**（红色强调：已结束内部任职、渠道成员关系和成员业务角色）
- `offboarding_status`（offboarding）

**部分完成警告**：

> ⚠ 部分完成：客户 N 项、报备 M 项因"客户有保护规则"未自动转移。剩余 X 项已写入 `workflow.process_tasks`，由具备 `org.offboarding.handle` 权限的内部管理员与企业管理员处理。

第一阶段停权提交成功后立即显示“账号已停用，正在扫描交接对象”，不能等待六领域扫描完成才反馈成功。每个领域独立显示扫描、排队、执行、部分完成和失败状态；失败操作只重试当前项，不重复停权和重复转移已完成项。

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
- 受控重新启用：仅授权管理员在确认误操作或返聘后发起；创建新任职和新授权，不恢复旧会话、旧任职、旧成员关系及已结束业务角色

---

## 9. 页面 06：企微组织同步

**路径**：`/admin.html#/organization/directory-sync`

**原型**：`06-同步占位.html`

### 9.1 设计目标

- 管理员一眼看到连接是否健康、同步范围、最近成功全量、回调健康和当前是否允许应用。
- 把“测试连接”“生成预览”和“应用已审批差异”明确分层，避免只读操作与正式写入混淆。
- 高风险差异同时展示 V3 当前值、企微候选值、业务影响和建议动作，不把技术字段直接丢给业务人员。
- 固定展示安全边界：单向读取、不改权限、不发证、不自动停号或离职、不碰渠道组织。

### 9.2 页面状态

连接器状态使用独立标签：未配置、已配置但关闭、只读连接、预览中、待审批、应用中、已暂停、降级、失败。

顶部状态区包含：

- 企业微信连接器名称和企业编号脱敏摘要。
- 当前模式：只读预览或审批后应用。
- 同步可见范围摘要，不展示无权限部门详情。
- 最近成功全量时间、回调最近接收时间、当前积压和熔断原因。
- 总开关与应用开关只显示状态；配置修改进入独立强认证流程。

### 9.3 操作区

| 操作 | 交互 | 安全约束 |
| --- | --- | --- |
| 测试连接 | 主按钮，显示只读说明和结果摘要 | 不写映射、不建任职、不改变正式数据 |
| 生成预览 | 创建异步批次，立即跳转批次详情 | 防重复点击，使用幂等键 |
| 查看差异 | 打开差异列表，默认高风险优先 | 显示筛选和未读高风险数 |
| 应用已审批差异 | 危险操作，默认禁用 | 审批完整、应用开关开启、近期强认证和二次确认后才可用 |
| 暂停 | 暂停尚未领取的新应用项 | 已领取项在对象边界完成后暂停 |

确认框必须显示批次号、批准差异数、高风险项数、预计影响部门和人员数，不使用含糊的“确认同步全部”文案。

### 9.4 差异汇总与列表

统计卡片：新增、资料更新、中风险、高风险、阻断、待审批、已忽略、应用失败。

差异列表字段：对象类型、企微对象、V3 映射、变化类型、风险级别、当前值、候选值、影响、处理建议、审批状态、版本和操作。

处理规则：

- 首期所有差异都需要审批，允许按低风险分组批量批准。
- 部门移动、删除、成员退出或禁用、当前任职部门变化、负责人变化始终逐项确认。
- 对象不可见只显示“待再次全量确认”，不得展示为“已离职”。
- `row_version` 冲突时保留审批选择，刷新差异并要求重新确认，不能覆盖新值。
- 同名未映射人员提示“禁止按姓名自动合并”，提供受控人工映射入口。

### 9.5 批次与回调

批次列表展示：批次号、类型、触发来源、状态、开始和完成时间、部门数、成员数、差异数、失败数和操作。

批次详情展示分段进度：获取部门、获取成员、规范化、比对、待审批、应用、审计。失败项显示中文原因、企业微信错误码、是否可重试和下一步动作，不展示令牌或密钥。

回调健康只展示事件类型、接收时间、处理状态、重复次数和脱敏对象编号；不展示解密后的完整原文或敏感字段。

### 9.6 空状态与降级状态

- 未配置：显示配置清单和“前往连接配置”，不显示应用按钮。
- 只读观察：显示观察剩余天数、最近两轮全量对账和“应用保持关闭”。
- 无差异：说明最近校准一致，并显示校准时间和对象数量。
- 降级或熔断：顶部红色告警，说明应用已自动暂停、原因、最后成功快照和恢复步骤。
- 可见对象数量异常突降：用最高风险告警，禁止产生失效和离职动作。

### 9.7 原型兼容说明

为避免破坏既有文档链接，正式原型暂时保留文件名 `06-同步占位.html`，但页面内容和开发名称均为“企微组织同步控制台”，旧的禁用实现已经废止。

### 9.8 接口对应

接口统一见第 14.6 节和 `企业微信组织架构同步实施方案.md` 第 11 章。

---

## 10. 页面 07：审计查看

**路径**：`/workspace/admin/platform-admin/audit`（与 platform-admin 共用）

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

- 顶部红色 alert：**“高风险操作：提交后立即停权”**；同时说明误操作只能走受控重新启用，且不会恢复旧会话、旧任职和已结束授权
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

- 保留一次业务确认，不叠加第二个内容相同的确认弹窗。
- 提交前校验独立高风险权限和最近十五分钟强认证；强认证过期时打开认证层，认证成功后恢复原表单和预览，不要求重新填写。
- 提交按钮只允许点击一次并携带幂等键；超时后查询原请求结果，不能让用户通过反复点击创建多个交接单。
- 弹窗内文必须明确告知“账号将立即停用、旧会话立即失效，内部任职、渠道成员关系和成员业务角色立即结束”
- 误操作风险：弹窗顶部红色 alert + “重新启用不会恢复旧会话、旧任职和已结束授权”说明 + 底部按钮文案“确认发起离职”（红色）
- 接收人选择器仅展示有效、非本人、非离职中且满足当前六领域范围要求的账号；不符合项显示不可选原因。

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
├── PermissionRoleDriftPanel.vue     # 派生权限差异与确认回收
├── WorkContextSwitcher.vue          # 当前内部/渠道工作身份
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
| 当前任职 | `#fef9c3` | `#854d0e` | 唯一有效内部任职标记 |
| 部分完成 | `#fef3c7` | `#92400e` | 交接状态 |
| 已完成 | `#dcfce7` | `#166534` | 交接状态 |
| 停权处理中 | `#fee2e2` | `#991b1b` | 离职第一阶段 |
| 扫描中 / 交接中 | `#dbeafe` | `#1d4ed8` | 离职异步阶段 |
| 待管理员处理 | `#ffedd5` | `#9a3412` | 离职剩余项 |
| 只读连接 / 预览中 | `#dbeafe` | `#1d4ed8` | 企微同步非写入状态 |
| 待审批 | `#fef3c7` | `#92400e` | 企微差异待确认 |
| 降级 / 熔断 | `#fee2e2` | `#991b1b` | 企微应用已自动暂停 |

## 14. 与后端接口的对应

本节只用于页面反查。最终路径、字段、错误码、幂等键、`row_version`、权限和工作上下文以 `packages/contracts/openapi/organization.yaml` 为唯一来源；契约变更后必须自动生成或同步更新 `organization-client.ts`，禁止前端自行拼出另一套接口。

### 14.1 11.1 + 11.2 接口对应

| 页面 | 接口 |
|---|---|
| 01 主页（树加载） | `GET /api/org/units/tree` |
| 01 详情面板 | `GET /api/org/units/:id` |
| 01 岗位表 | `GET /api/org/positions?orgUnitId=:id` |
| 01 任职表 | `GET /api/org/units/:id/staff` |
| 01 新建组织 | `POST /api/org/units` |
| 01 编辑 | `PUT /api/org/units/:id` |
| 01 启停归档 | `PUT /api/org/units/:id/status` |
| 01 调岗 | `PUT /api/org/assignments/:id` |
| 01 离职入口 | 跳到 08 对话框 |

### 14.2 11.3 接口对应

| 页面 | 接口 |
|---|---|
| 固定角色候选 | `GET /api/org/business-roles`，前端只取四个固定编码 |
| 内部成员选择销售/技术 | `POST /api/org/member-business-roles`，同一成员切换时结束旧固定角色 |
| 渠道成员统一资料读取 | `GET /api/org/channel-members/:id/profile` |
| 渠道成员统一资料保存 | `PUT /api/org/channel-members/:id/profile` |
| 02 新增渠道成员 | `POST /api/channel/partners/:id/members` |
| 渠道成员移除 | 兼容入口执行逻辑归档，保留角色、证书、业务和审计历史 |

### 14.3 11.4 接口对应

| 页面 | 接口 |
|---|---|
| 03 模板列表 | `GET /api/org/certification-templates` |
| 03 员工证书 | `GET /api/org/member-certifications?userId=&partnerId=&category=&status=&keyword=` |
| 03 颁发证书 | `POST /api/org/users/:id/certifications` |
| 03 延期 | `PUT /api/org/member-certifications/:id/extend` |
| 03 撤销 | `PUT /api/org/member-certifications/:id/revoke` |

### 14.4 11.5 接口对应

| 页面 | 接口 |
|---|---|
| 04 角色绑定 | `GET /api/org/data-scopes/:subjectType/:subjectId`，首期固定 `subjectType=role` |
| 04 保存 | `PUT /api/org/data-scopes/:subjectType/:subjectId`，首期固定 `subjectType=role` |
| 04 删除单条绑定 | `DELETE /api/org/data-scopes/bindings/:id` |
| 04 用户绑定（D-08 关闭） | 返回 409 |

### 14.5 11.6 接口对应

| 页面 | 接口 |
|---|---|
| 05 列表 | `GET /api/org/offboarding` |
| 05 详情 | `GET /api/org/offboarding/:id` |
| 05 重试项 | `POST /api/org/offboarding/:id/retry-items` |
| 08 发起 | `POST /api/org/staff/:userId/offboard` |
| 08 扫描预览 | `POST /api/org/staff/:userId/offboard/preview` |

### 14.6 11.7 接口对应

| 页面 | 接口 | 用途 |
|---|---|---|
| 06 状态 | `GET /api/integrations/directory-sync/status` | 连接、回调、最近批次和熔断状态 |
| 06 测试连接 | `POST /api/integrations/directory-sync/test-connection` | 只读测试并返回可见范围摘要 |
| 06 生成预览 | `POST /api/integrations/directory-sync/preview` | 创建异步预览批次 |
| 06 创建运行 | `POST /api/integrations/directory-sync/runs` | 创建全量或校准运行 |
| 06 批次列表 | `GET /api/integrations/directory-sync/runs` | 分页查询批次 |
| 06 批次详情 | `GET /api/integrations/directory-sync/runs/:id` | 查询进度、统计、检查点和错误 |
| 06 差异列表 | `GET /api/integrations/directory-sync/changes` | 按批次、风险和状态筛选 |
| 06 应用 | `POST /api/integrations/directory-sync/runs/:id/apply` | 应用明确列出且版本匹配的已审批差异 |
| 06 暂停 | `POST /api/integrations/directory-sync/runs/:id/pause` | 暂停尚未领取的新应用项 |

### 14.7 审计接口对应

| 页面 | 接口 |
|---|---|
| 07 筛选查询 | `GET /api/org/audit/events?object_type=...&event_code=...&...` |
| 07 详情 | `GET /api/org/audit/events/:id` |
| 07 哈希链 | `GET /api/org/audit/hash-chain?start=...&end=...` |
| 07 导出 | `GET /api/org/audit/events/export?...` |

### 14.8 通用反馈与错误恢复

| 场景 | 页面行为 |
| --- | --- |
| 首次加载 | 使用与最终结构一致的骨架屏，避免树和详情跳动 |
| 空数据 | 说明为空原因和下一步动作；无权限与确实无数据使用不同文案 |
| 401 会话失效 | 保存未提交表单草稿，完成登录后回到原安全路径并恢复草稿 |
| 403 无权限或越界 | 显示当前工作身份和缺少的动作，不泄露目标对象详情 |
| 409 版本或状态冲突 | 保留输入，展示最新数据摘要，允许刷新、对比或重新应用 |
| 409 用户级范围关闭 | 明确提示首期仅支持角色级，并提供跳转到角色绑定入口 |
| 422 业务校验失败 | 定位到具体字段或树节点，使用中文说明可采取的修正动作 |
| 503 任务底座未就绪 | 保留当前业务事实，显示任务将自动重试或管理员处理入口 |
| 请求超时 | 先按请求编号或幂等键查询结果，不能直接提示用户重复提交 |

所有写操作成功后同时刷新当前对象、列表统计和可执行动作；失败时不得清空筛选条件、当前树节点或已填表单。跨页面返回时保留最近一次组织节点、筛选项和分页位置，但不得缓存越权数据正文。

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
- 企微测试、预览、全量和应用接口只负责创建异步任务，管理接口 1 秒内返回受理结果；不以外部接口完成时间作为页面请求时长。

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

[返回组织架构首期落地开发方案](组织架构首期落地开发方案.md) · [返回主方案](../V3业务平台底座与业务扩展实施交付方案.md#章节-21)
