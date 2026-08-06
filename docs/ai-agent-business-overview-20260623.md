# AI-agent 业务重构业务说明

> 项目：联软渠道管理平台 v2.2.0  
> 日期：2026-06-23  
> 用途：给 AI-agent 重构、改造、业务理解和接口适配使用  
> 范围：说明当前 CRM/渠道业务、报价产品逻辑、权限边界、OpenAPI 对接方式和后续重构建议  
> 原则：AI-agent 默认只通过标准 OpenAPI 读取数据，不直接改动 CRM 主业务数据；报价、订单、产品计价以联软系统现有逻辑为准。

## 1. 系统定位

联软渠道管理平台是一个面向渠道销售、区域管理和总部管理的轻量 CRM / 渠道业务系统。它的核心目标不是单纯存客户，而是把渠道商、客户报备、商机、报价、订单、产品目录、渠道价格、区域价格、经营统计串成一条业务链。

当前系统承载的主要业务：

1. 渠道商管理：渠道资料、合作级别、渠道分销层级、区域归属、员工、渠道管理员、二级渠道关系。
2. 客户报备：渠道或员工提交客户保护信息，管理员审批，审批通过后作为商机来源。
3. 商机管理：跟踪客户项目进度、金额、阶段、负责人、关联报备、关联报价。
4. 报价管理：基于产品模块、终端数、硬件、套餐、区域价格、渠道分销层级生成联软报价。
5. 订单管理：由报价/商机转订单，支持渠道链路确认和状态跟踪。
6. 产品与价格管理：产品大类、模块、功能产品、硬件、套餐、发布状态、渠道价格、区域价格覆盖。
7. IPG 友商参考价：仅作为报价实时预览中的对比参考，不进入报价保存和订单主线。
8. 经营统计：面向总部、区域、渠道、员工的报备、商机、报价、订单、漏斗和贡献分析。
9. OpenAPI 对接：给 crm-agent / AI-agent 提供只读查询、只读统计和 Markdown 快照能力。

## 2. 技术现状

当前代码结构：

| 目录/文件 | 说明 |
|---|---|
| `frontend/` | 前端静态页面，主要使用 Vue 3 + Element Plus CDN。 |
| `frontend/admin.html` / `frontend/admin-app.js` | 超管、区管、管理后台主界面。 |
| `frontend/partner.html` / `frontend/partner-app.js` | 渠道管理员、渠道员工工作台。 |
| `frontend/app.js` | 早期/兼容版前端逻辑，仍保留部分业务实现。 |
| `frontend/api-client.js` | 前端访问后端内部 API 的封装。 |
| `backend/server.js` | 后端主服务，包含内部业务 API、OpenAPI、产品报价、审批、统计等主要逻辑。 |
| `backend/ipg-pricing-service.js` | IPG 友商参考价计算服务，独立于联软报价主逻辑。 |
| `backend/ipg-pricing-config.js` | IPG 模块映射、价格带、硬件参考价配置。 |
| `backend/db-layer.js` | 当前代码中的 SQLite 业务数据持久化层。 |
| `backend/audit-db.js` | 审计日志持久化层。 |
| `docs/openapi-aiagent-latest-guide.md` | 发给 AI-agent 的最新 OpenAPI 对接说明。 |
| `docs/openapi-aiagent-api-contract.md` | OpenAPI 标准 API 契约。 |
| `docs/openapi-aiagent-self-test-record.md` | OpenAPI 自测和实现记录。 |

部署口径：

| 项目 | 当前说明 |
|---|---|
| 前端端口 | `8080` |
| 后端端口 | `3000` |
| 内部业务 API | `/api/...` |
| 标准 OpenAPI | `/api/open/v1/...` |
| OpenAPI 管理 API | `/api/open-api/...` |

数据层注意点：

1. README 中仍有早期“JSON 文件存储”的描述。
2. 当前后端代码已经包含 `DbLayer`、`AuditDb`、`crm.db`、`audit.db` 等 SQLite 相关文件。
3. 重构时不能只按 README 理解数据层，应以当前运行代码和生产数据文件为准。
4. 如后续 AI-agent 只读分析，优先走 `/api/open/v1`，不要直接读数据库文件。

## 3. 角色与权限

系统中主要角色如下：

| 角色值 | 中文角色 | 业务视角 | 主要权限 |
|---|---|---|---|
| `superadmin` | 超级管理员 | 总部/系统管理员 | 全量数据、产品价格、渠道管理、账号管理、审计日志、OpenAPI client 管理。 |
| `admin` | 区域管理员 | 区管 | 查看和处理本区域数据，管理本区域渠道、审批报备/渠道申请、查看区域经营情况。 |
| `partner_admin` | 渠道管理员 | 渠道负责人 | 管理本渠道数据、员工、客户报备、商机、报价、订单；一级渠道可涉及二级渠道数据。 |
| `staff` | 员工 | 渠道销售/业务人员 | 处理本人创建或被指派的客户、报备、商机、报价、订单。 |

OpenAPI 权限裁剪口径：

| 角色 | `scopeType` | 数据范围 |
|---|---|---|
| `superadmin` | `all` | 全量数据。 |
| `admin` | `region` | 当前区域/大区内数据。 |
| `partner_admin` | `partner` | 本渠道及关联渠道数据。 |
| `staff` | `user` | 本人相关数据。 |

AI-agent 必须遵守的权限原则：

1. AI-agent 不自行复刻 CRM 权限逻辑。
2. AI-agent 通过 token 绑定的 CRM 用户获取数据，后端自动做权限裁剪。
3. 每份分析结论必须说明当前绑定用户、角色和 `scopeType`。
4. 局部权限数据不能被写成全局经营结论。
5. OpenAPI 响应会过滤敏感字段，AI-agent 生成 Markdown 快照时也不得写入 `appSecret`、`accessToken`、密码等敏感信息。

## 4. 渠道业务关键概念

### 4.1 合作级别

字段名：`level`  
当前 UI 名称：合作级别  
当前要求：必填

合作级别表示渠道商与联软的合作资质或商务级别，常见值包括：

| 值 | 展示名称 |
|---|---|
| `lep` | LEP |
| `diamond` | 钻石 |
| `gold` | 金牌 |
| `silver` | 银牌 |
| `bronze` | 铜牌 |
| `industry` | 行业总代 |

注意：

1. 合作级别是渠道资料的基础字段，当前新增/编辑渠道时必须填写。
2. 合作级别主要用于渠道分类、统计、筛选和管理展示。
3. 不要把合作级别和渠道分销层级混淆。

### 4.2 渠道分销层级

字段名：`partnerLevel`  
当前 UI 名称：渠道分销层级  
历史 UI 名称：渠道商等级  

渠道分销层级表示渠道在分销链路中的层级，当前主要值：

| 值 | 展示名称 | 业务含义 |
|---|---|---|
| `none` | 未设置/无层级 | 未进入一级/二级分销口径。 |
| `primary` | 一级渠道 | 一级渠道商。 |
| `secondary` | 二级渠道 | 二级渠道商，通常存在上级一级渠道。 |

重要说明：

1. 当前 UI 已将“渠道商等级”调整为“渠道分销层级”。
2. 后端字段仍然是 `partnerLevel`，这是为了兼容历史数据和接口。
3. 报价中的一级/二级渠道价格选择与 `partnerLevel` 相关。
4. AI-agent 输出业务说明时应使用“渠道分销层级”，提到技术字段时再说明字段名是 `partnerLevel`。

### 4.3 技术服务商

字段名：`techServiceType`

常见值：

| 值 | 展示名称 |
|---|---|
| `none` 或空 | 非技术服务商 |
| `developing` | 提名技术服务商 |
| `full` | 签约技术服务商 |

技术服务商身份用于渠道管理和实施交付能力标记，不应与合作级别、渠道分销层级混为一类。

## 5. 核心业务对象

### 5.1 用户 `users`

用户对象承载登录账号、角色、区域、渠道归属和状态。

关键字段：

| 字段 | 含义 |
|---|---|
| `id` / `userId` | 用户 ID。 |
| `username` | 登录账号。 |
| `name` / `displayName` | 姓名/展示名。 |
| `role` | 角色：`superadmin/admin/partner_admin/staff`。 |
| `region` | 所属区域。 |
| `bigRegion` | 所属大区。 |
| `partnerId` / `partnerName` | 所属渠道。 |
| `status` | 用户状态。 |

### 5.2 渠道商 `partners`

渠道商是销售体系的组织基础，和用户、报备、商机、报价、订单都有关系。

关键字段：

| 字段 | 含义 |
|---|---|
| `id` / `partnerId` | 渠道 ID。 |
| `name` / `partnerName` | 渠道名称。 |
| `level` | 合作级别，当前必填。 |
| `partnerLevel` | 渠道分销层级。 |
| `parentPartnerId` | 上级渠道 ID。 |
| `parentPartnerIds` | 关联上级渠道 ID 列表。 |
| `region` | 所属区域。 |
| `city` | 所在城市，渠道商新增/编辑/导入时必填，且必须是地市级行政区名称；用于覆盖率分析，不替代区域/大区。 |
| `bigRegion` | 所属大区。 |
| `contact` / `phone` / `email` | 联系人信息。 |
| `techServiceType` | 技术服务商类型。 |
| `status` | 渠道状态。 |

渠道关系：

1. 一个渠道可以有多个员工。
2. 一个一级渠道可以关联二级渠道。
3. 二级渠道订单可能需要一级渠道确认。
4. 区域管理员只能处理本区域渠道。

### 5.3 客户报备 `registrations`

客户报备是渠道保护和客户入口。通常由渠道员工或渠道管理员发起，经区域/总部审批后进入后续商机。

关键字段：

| 字段 | 含义 |
|---|---|
| `id` / `registrationId` | 报备 ID。 |
| `customer` / `customerName` | 客户名称。 |
| `creditCode` | 统一社会信用代码。 |
| `industry` | 行业。 |
| `contact` / `phone` | 客户联系人。 |
| `status` | 报备状态。 |
| `createdBy` / `createdByName` | 创建人。 |
| `assignedStaffId` / `assignedStaffName` | 指派员工。 |
| `partnerId` / `partnerName` | 所属渠道。 |
| `assignedPartnerId` / `assignedPartnerName` | 指派渠道。 |
| `region` / `bigRegion` | 区域/大区。 |
| `estimatedAmt` | 预计金额。 |
| `expireAt` | 保护到期时间。 |

常见状态：

| 值 | 展示名称 |
|---|---|
| `pending` | 待审批 |
| `approved` | 已通过 |
| `rejected` | 已驳回 |

### 5.4 商机 `opportunities`

商机表示一个可跟进销售项目，可从已审批报备创建，也可在允许的场景下独立创建。商机会关联客户、渠道、负责人、金额、预计成交时间、报价和订单。

关键字段：

| 字段 | 含义 |
|---|---|
| `id` / `opportunityId` | 商机 ID。 |
| `name` / `opportunityName` | 商机名称。 |
| `customer` / `customerName` | 客户名称。 |
| `stage` / `stageName` | 商机阶段。 |
| `amount` | 商机金额。 |
| `expectedClose` | 预计成交时间。 |
| `source` | 来源。 |
| `ownerId` / `ownerName` | 负责人。 |
| `assignedStaffId` / `assignedStaffName` | 指派员工。 |
| `partnerId` / `partnerName` | 所属渠道。 |
| `regId` / `registrationId` | 关联报备。 |
| `quoteId` | 关联报价。 |
| `region` / `bigRegion` | 区域/大区。 |

常见阶段：

| 值 | 展示名称 |
|---|---|
| `contacted` | 已接触 |
| `qualified` | 已确认 |
| `proposal` | 方案/报价中 |
| `negotiation` | 商务谈判 |
| `won` | 已成交 |
| `lost` | 已失单 |

### 5.5 报价单 `quotes`

报价单是产品价格、渠道价格、区域价格、硬件、套餐、维保、工作量预估、IPG 参考价等逻辑交汇的核心对象。

关键字段：

| 字段 | 含义 |
|---|---|
| `id` / `quoteId` | 报价单 ID。 |
| `customer` / `customerName` | 客户名称。 |
| `regId` / `registrationId` | 关联报备。 |
| `oppId` | 首个关联商机，历史兼容字段。 |
| `oppIds` / `opportunityIds` | 关联商机 ID 数组。 |
| `amount` / `total` / `totalAmount` | 报价金额。 |
| `originalTotal` | 原价合计。 |
| `discountAmount` | 优惠金额。 |
| `status` | 报价状态。 |
| `endpoints` | 终端数。 |
| `products` / `featureIds` | 勾选的功能模块。 |
| `hardwareIds` | 勾选的硬件产品。 |
| `quoteMode` | 报价模式，如套餐、增补、自定义。 |
| `partnerId` / `partnerName` | 所属渠道。 |
| `assignedStaffId` / `assignedStaffName` | 指派员工。 |
| `region` / `bigRegion` | 区域/大区。 |

报价创建约束：

1. 当前后端创建报价时要求至少关联一个商机。
2. `oppIds` 是新口径，`oppId` 保留为第一个商机的兼容字段。
3. 报价保存时写入联软报价结果和业务字段。
4. IPG 参考价只实时预览，不写入报价保存主流程。

常见状态：

| 值 | 展示名称 |
|---|---|
| `draft` | 草稿 |
| `submitted` | 已提交 |
| `approved` | 已通过 |
| `rejected` | 已驳回 |
| `converted` | 已转订单 |

### 5.6 订单 `orders`

订单是报价和商机转化后的业务结果，承接成交金额、客户、渠道、交付地址、联系人和状态。

关键字段：

| 字段 | 含义 |
|---|---|
| `id` / `orderId` / `orderNo` | 订单 ID/编号。 |
| `customer` / `customerName` | 客户名称。 |
| `quoteId` | 来源报价。 |
| `oppId` / `opportunityId` | 来源商机。 |
| `regId` / `registrationId` | 来源报备。 |
| `amount` / `total` / `totalAmount` | 订单金额。 |
| `status` | 订单状态。 |
| `deliveryAddr` | 交付地址。 |
| `contacts` | 交付联系人。 |
| `partnerId` / `partnerName` | 所属渠道。 |
| `parentPartnerId` | 上级渠道。 |
| `assignedStaffId` / `assignedStaffName` | 指派员工。 |
| `region` / `bigRegion` | 区域/大区。 |

常见状态：

| 值 | 展示名称 |
|---|---|
| `pending` | 待处理 |
| `confirmed` | 已确认 |
| `primary_confirmed` | 一级渠道已确认 |
| `rejected` | 已驳回 |
| `completed` | 已完成 |
| `cancelled` | 已取消 |

## 6. 业务主流程

### 6.1 账号与组织准备

1. 超级管理员维护区域管理员、渠道商、渠道管理员、渠道员工。
2. 渠道商必须有合作级别。
3. 渠道商可设置渠道分销层级。
4. 二级渠道需要关联上级一级渠道。
5. 用户登录后，前端按角色进入管理后台或渠道工作台。

### 6.2 客户报备流程

1. 渠道员工或渠道管理员提交客户报备。
2. 报备包含客户名称、联系人、行业、区域、预计金额、备注等信息。
3. 管理员按权限审批。
4. 审批通过后，客户进入保护期。
5. 已通过报备可以关联或生成商机。
6. 报备被驳回则不能继续作为有效商机来源。

### 6.3 商机流程

1. 商机可由报备转化，也可由允许的入口创建。
2. 商机承载客户项目、金额、阶段、负责人和预计成交时间。
3. 商机阶段反映从接触到成交/失单的过程。
4. 商机可关联一个或多个报价。
5. 成交后商机可与订单形成转化链路。

### 6.4 报价流程

1. 用户进入报价页面，选择客户、关联商机、终端数。
2. 选择报价模式：套餐、增补、自定义功能模块等。
3. 选择软件功能、硬件产品、维保服务和可选参数。
4. 前端根据当前用户/渠道/区域解析价格。
5. 生成联软报价总价、原价、优惠和明细。
6. 调用工作量预览接口，给出实施工作量参考。
7. 调用 IPG 参考价预览接口，展示友商总价对比。
8. 用户保存报价时，只保存联软报价主业务数据。
9. IPG 参考结果不进入报价单保存，不参与订单转化。

### 6.5 订单流程

1. 报价确认后可转订单。
2. 订单继承客户、报价、商机、渠道、区域、金额等信息。
3. 二级渠道相关订单可能需要一级渠道确认。
4. 订单进入待处理、确认、完成、取消等状态流转。
5. 订单数据进入经营统计和渠道贡献统计。

## 7. 产品目录模型

当前产品目录是三级结构，并兼容硬件、套餐和旧产品数据。

### 7.1 产品大类 `categories`

大类用于区分产品线或软件/硬件类别。当前核心大类包含：

| ID | 名称 |
|---|---|
| `CAT-LEP` | 联软ESPP企业安全监测保护平台软件V5.0 |

系统还存在标准维保相关大类常量：

| 常量 | 含义 |
|---|---|
| `MAINTENANCE_CATEGORY_ID` | 标准维保大类 ID。 |
| `STANDARD_MAINTENANCE_FEATURE_ID` | 标准维保功能 ID。 |
| `STANDARD_MAINTENANCE_PRODUCT_CODE` | 标准维保产品编码。 |
| `STANDARD_MAINTENANCE_DEFAULT_RATE` | 默认维保费率，当前为 15%。 |

### 7.2 产品模块 `modules`

模块属于产品大类，当前主要模块：

| ID | 名称 |
|---|---|
| `MOD-LEP-01` | 桌面安全管理 |
| `MOD-LEP-02` | 防泄密 |
| `MOD-LEP-03` | 防勒索 |
| `MOD-LEP-04` | 准入控制 |

### 7.3 功能产品 `features`

功能产品是实际参与软件报价的最小产品单元。

关键字段：

| 字段 | 含义 |
|---|---|
| `id` | 功能 ID。 |
| `moduleId` | 所属模块。 |
| `name` | 功能名称。 |
| `productCode` | 产品编码。 |
| `priceType` | 价格类型，如阶梯价或固定价。 |
| `tiers` | 终端数阶梯价格。 |
| `priceFixed` | 固定价。 |
| `discount` | 折扣/折算参数，历史字段。 |
| `unit` | 单位，如端点。 |
| `priceRatioPrimary` | 一级渠道价格比例。 |
| `priceRatioSecondary` | 二级渠道价格比例。 |
| `priceForPrimary` | 一级渠道直接价格。 |
| `priceForSecondary` | 二级渠道直接价格。 |
| `regionPriceOverrides` | 区域价格覆盖。 |
| `published` | 是否发布到报价侧。 |
| `status` | 产品状态。 |

当前常见功能模块包括：

| 功能 | 产品编码 |
|---|---|
| 桌面管理模块（含资产管理，远程桌面） | `UA-AM-1` |
| 安全管理模块 | `UA-SS-1` |
| 非授权外连控制模块 | `UA-DevCtrl-1` |
| 软件管理模块 | `UA-SoftMgr-1` |
| 软件商城模块 | `LV-AppStore-1` |
| 云端软件安全下载服务 | `SaaS-SWD` |
| 补丁管理模块 | `UA-MSP-1` |
| 设备发现模块 | `LV-Topo-1` |
| 文件读写操作行为审计与控制模块 | `UA-DocCtrl-1` |
| 打印审计与控制模块 | `UA-PAudit-1` |
| 网络行为审计与控制模块 | `UA-NAudit-1` |
| 即时通讯管控模块 | `UA-IMCtrl-1` |
| 邮件管控模块 | `UA-EmailCtrl-1` |
| 屏幕水印与控制模块 | `UA-ScrCtrl-WaterPrt-1` |
| 屏幕录像模块 | `UA-ScrRec-1` |
| USB移动存储管理模块 | `UA-UMgmt-1` |
| 安全U盘模块 | `UA-UEnc-1` |
| 敏感内容识别模块 | `BDP-DLP-1` |
| 透明加解密客户端 | `UA-DES-Win-1` |
| 虚拟磁盘隐身加密系统客户端 | `DLP-Ydisk-QY-1` |
| 防病毒模块 | `UEDR-AV-1` |
| 文档防勒索模块（含文档备份） | `UA-RD-Win-1` |
| 网络准入控制模块 | `UA-NAC-1` |
| 访客管理模块 | `UA-NAC-G-1` |

### 7.4 硬件产品 `hardwareProducts`

硬件以固定价参与报价。

当前示例：

| ID | 名称 | 型号 | 价格字段 |
|---|---|---|---|
| `HW-001` | 微盾一体机 | `WD-2000` | `priceFixed` |
| `HW-002` | 网络准入控制器（N2设备） | `NAC-N2` | `priceFixed` |
| `HW-003` | UniSDP零信任网关（P2设备） | `SDP-P2` | `priceFixed` |

### 7.5 套餐 `packages`

套餐包含一组功能、硬件和模块。

当前默认套餐示例：

| ID | 名称 |
|---|---|
| `PKG-BASIC` | 基础版套餐 |
| `PKG-PRO` | 专业版套餐 |
| `PKG-ENTERPRISE` | 企业版套餐 |
| `PKG-XCAD` | XCAD 国产化套餐 |

重构注意：

1. 套餐不是单独价格表，本质是功能和硬件组合。
2. 套餐总价仍要走功能、硬件、维保、终端数、渠道层级、区域覆盖等价格规则。
3. 部分历史套餐 ID 中的功能 ID 可能保留旧命名，重构时要先做数据清洗或兼容映射。

## 8. 联软报价计价逻辑

联软报价是系统主计价逻辑，不能被 IPG 参考价影响。

### 8.1 价格输入

报价计算主要输入：

| 输入 | 来源 |
|---|---|
| 终端数 `endpoints` | 报价表单。 |
| 功能产品 | 自定义勾选、套餐、增补。 |
| 硬件产品 | 报价表单。 |
| 当前用户/渠道 | 登录身份和渠道归属。 |
| 渠道分销层级 `partnerLevel` | 渠道信息。 |
| 当前区域 `region` | 用户区域、渠道区域、报备区域或报价区域。 |
| 区域价格覆盖 `regionPriceOverrides` | 产品价格配置。 |
| 点数覆盖/数量覆盖 | 报价页面可选覆盖参数。 |
| 维保配置 | 标准维保服务和费率。 |

### 8.2 软件功能价格

功能产品支持两类价格：

1. 阶梯价：按终端数命中 `tiers` 中的价格，再乘以数量/终端数。
2. 固定价：按 `priceFixed` 计算。

渠道分销层级价格：

1. 原价：使用产品默认 `tiers` 或 `priceFixed`。
2. 一级渠道价：优先使用 `priceForPrimary`，否则按 `priceRatioPrimary` 从原价折算。
3. 二级渠道价：优先使用 `priceForSecondary`，否则按 `priceRatioSecondary` 从原价折算。

当前前端中默认比例口径：

| 字段 | 默认值 |
|---|---:|
| `priceRatioPrimary` | 100 |
| `priceRatioSecondary` | 110 |

说明：

1. 这里的比例不是“折扣百分比”的单一含义，而是“渠道价格 = 基准价格 × 比例 / 100”。
2. 二级渠道默认 110 表示二级渠道价格可以高于一级/原价口径。
3. 管理员侧会显示原价、一级渠道价、二级渠道价作为参考。

### 8.3 区域价格覆盖

字段：`regionPriceOverrides`

区域价格覆盖用于给特定区域配置不同价格。当前已优化为：

1. 一个覆盖配置可选择单个或多个区域。
2. UI 默认一行展示已勾选区域。
3. 点击下拉三角展开多选。
4. 点击区域选中，再次点击取消。
5. 多选区域共用同一套覆盖价格。
6. 报价计算时，只要当前报价区域命中 `override.region` 或 `override.regions`，就使用该覆盖价格。
7. 同一区域不应在多个覆盖配置中重复配置。

覆盖项可包含：

| 字段 | 含义 |
|---|---|
| `region` | 首个区域，历史兼容字段。 |
| `regions` | 多区域数组，新口径。 |
| `enabled` | 是否启用。 |
| `tiers` | 区域阶梯价。 |
| `priceFixed` | 区域固定价。 |
| `priceRatioPrimary` | 区域一级渠道比例。 |
| `priceRatioSecondary` | 区域二级渠道比例。 |
| `priceForPrimary` | 区域一级渠道直接价。 |
| `priceForSecondary` | 区域二级渠道直接价。 |

重构不变量：

1. `region` 字段不能删除，它是历史兼容字段。
2. 新逻辑要以 `regions` 支持多选。
3. 匹配时应同时兼容 `override.region === currentRegion` 和 `override.regions.includes(currentRegion)`。
4. 多区域共用同一套价格，不要复制出多份覆盖内容。

### 8.4 硬件价格

硬件一般按固定价 `priceFixed` 计算，通常不按终端数阶梯计价。报价总价中硬件金额与软件金额汇总。

### 8.5 标准维保

标准维保通过特殊功能配置进入报价。

当前常量口径：

| 字段/常量 | 含义 |
|---|---|
| `STANDARD_MAINTENANCE_FEATURE_ID` | 标准维保功能 ID。 |
| `STANDARD_MAINTENANCE_PRODUCT_CODE` | 标准维保产品编码。 |
| `STANDARD_MAINTENANCE_FEATURE_NAME` | 标准维保服务名称。 |
| `STANDARD_MAINTENANCE_DEFAULT_RATE` | 默认维保费率 15。 |

维保通常按软件/硬件年度费用基数和费率计算。重构时要把标准维保识别逻辑独立出来，避免被普通功能模块计价重复计算。

### 8.6 渠道商价格参考

管理员侧报价界面存在“渠道商价格参考”：

1. 展示原价总价。
2. 展示一级渠道价。
3. 展示二级渠道价。
4. 用于管理员对比渠道报价，不改变当前报价单保存结果。

重构时需要保证：

1. 原价、一级、二级计算基于同一组功能、终端数、硬件和区域覆盖。
2. 一级/二级价格要分别使用对应的 `priceForPrimary` / `priceForSecondary` 或比例折算。
3. 区域覆盖生效时，三个口径都应使用同一区域覆盖基础价。
4. 不应出现管理员侧参考价格和渠道侧实际报价价格口径不一致。

## 9. IPG 友商参考价逻辑

IPG 功能是新增的友商参考价模块。它只用于报价实时预览，不影响联软报价、报价保存、订单转化、统计主线。

### 9.1 调用方式

内部接口：

```http
POST /api/ipg/quote-preview
```

前端封装：

```text
frontend/api-client.js -> previewIpgQuote
```

后端服务：

| 文件 | 说明 |
|---|---|
| `backend/ipg-pricing-service.js` | 计算 IPG 参考总价、差额、差异说明。 |
| `backend/ipg-pricing-config.js` | IPG 价格带、模块映射、硬件价。 |

### 9.2 输入

IPG 计算输入：

| 输入 | 说明 |
|---|---|
| `endpoints` | 终端数。 |
| `featureIds` / `products` | 已勾选的联软功能模块。 |
| `hardwareIds` | 已勾选硬件，仅作为扩展输入。 |
| `lianruanTotal` | 联软报价总价。 |
| `projectParams` | 项目参数，如是否含准入网关、网关型号、安全 U 盘数量/规格。 |

### 9.3 输出

前端只展示聚合结果：

| 字段 | 说明 |
|---|---|
| `lianruanTotal` | 联软总价。 |
| `ipgReferenceTotal` | IPG 参考总价。 |
| `difference` | IPG 总价减联软总价。 |
| `differenceRatio` / `differenceRatioText` | 差额比例。 |
| `differenceText` | 差额说明。 |
| `notes` | 差异说明。 |
| `calculationVersion` | IPG 计算版本。 |

重要边界：

1. 不展示 IPG 明细单价。
2. 不保存 IPG 结果到报价单。
3. 不影响联软报价金额。
4. 不影响订单金额。
5. 不影响联软产品和渠道价格配置。

### 9.4 IPG 价格带

当前版本：`IPG-V4-2025-REFERENCE`

价格带在 `backend/ipg-pricing-config.js` 中维护：

| 终端数范围 | 普通模块 | 加密系统 | 加密模块 | 只读模块 | 敏感识别 |
|---|---:|---:|---:|---:|---:|
| `<20` | 75 | 20000 | 1800 | 650 | 1800 |
| `20~49` | 70 | 20000 | 1600 | 600 | 1600 |
| `50~99` | 65 | 20000 | 1500 | 550 | 1500 |
| `100~199` | 60 | 20000 | 1300 | 500 | 1300 |
| `200~499` | 55 | 20000 | 1100 | 450 | 1100 |
| `500~999` | 55 | 20000 | 900 | 450 | 900 |
| `>=1000` | 50 | 20000 | 800 | 400 | 800 |

当前业务规则：

1. IPG 按至少 10 点起售估算。
2. 普通模块至少 3 个模块起售。
3. 普通模块如果有业务模块但未包含基本功能，自动纳入基本功能。
4. 多个联软模块映射到同一个 IPG 模块时，IPG 模块去重，避免重复计价。

### 9.5 联软到 IPG 的模块映射

当前映射按功能 ID 和名称关键字匹配，核心口径如下：

| 联软模块 | IPG 口径 |
|---|---|
| 桌面管理模块 | 资产管理、远程维护，且可能纳入基本功能。 |
| 安全管理模块 | 基本功能、网络流量管控、网络控制。 |
| 非授权外连控制模块 | 设备管控。 |
| 软件管理模块 | 应用程序管控。 |
| 软件商城模块 | 软件中心。 |
| 云端软件安全下载服务 | 单独勾选不计入 IPG 软件中心，仅提示差异；有软件商城时由软件商城映射软件中心。 |
| 文件读写操作行为审计与控制模块 | 文档操作管控。 |
| 打印审计与控制模块 | 打印管控。 |
| 网络行为审计与控制模块 | 网页浏览管控。 |
| 即时通讯管控模块 | 即时通讯管控。 |
| 邮件管控模块 | 邮件管控。 |
| 屏幕水印与控制模块 | 水印及文档追溯。 |
| 屏幕录像模块 | 屏幕监控/屏幕监视。 |
| USB移动存储管理模块 | 移动存储管控、设备管控。 |
| 安全U盘模块 | 移动存储管控，并可按项目参数加入安全 U 盘硬件参考价。 |
| 文档防勒索模块 | 文档云备份。 |
| 敏感内容识别模块 | IPG 特殊模块，按敏感识别单价计入。 |
| 透明加解密客户端 | 只计算 IPG 加密模块，不自动带出加密只读模块。 |
| 网络准入控制模块 | 映射准入网关/准入控制，可按项目参数加入网关硬件参考价。 |

不计入 IPG 总价，仅提示差异的模块：

| 联软模块 | 当前处理 |
|---|---|
| 云端软件安全下载服务单独勾选 | 不对应，仅提示差异。 |
| 补丁管理模块 | 不对应，不计价。 |
| 设备发现模块 | 不对应，不计价。 |
| 防病毒模块 | 本次 IPG 口径不对应，不计价。 |
| 虚拟磁盘隐身加密系统客户端 | 不对应，不计价。 |
| 访客管理模块 | 不对应，仅提示差异。 |

### 9.6 IPG 硬件参考价

准入网关参考价：

| 型号 | 参考价 |
|---|---:|
| `IPG-1700F` | 9000 |
| `IPG-2500F` | 19000 |
| `IPG-3300F` | 30000 |
| `IPG-3500F` | 35000 |
| `IPG-4300F` | 65000 |
| `IPG-4500F` | 90000 |

安全 U 盘参考价：

| 规格 | 参考价 |
|---|---:|
| `16G` | 540 |
| `32G` | 690 |
| `64G` | 980 |
| `128G` | 1280 |

### 9.7 IPG 重构不变量

后续重构 AI-agent 或报价服务时，必须保持：

1. 联软报价先算，IPG 后算。
2. IPG 调用输入来自联软已勾选模块、终端数、项目参数和联软总价。
3. IPG 模块映射系统口径为“对应才参与计算，不对应只提示差异”。
4. 多个联软模块映射同一 IPG 模块必须去重。
5. 透明加解密客户端只算 IPG 加密模块，不算加密只读模块。
6. 软件商城模块映射 IPG 软件中心，单独云端下载服务不映射软件中心。
7. 前端只展示总价、差额、比例、差异说明。
8. 不展示 IPG 单价明细。
9. 不保存 IPG 结果。
10. 不改变联软报价单、订单和产品主数据。

## 10. 实施工作量预览

内部接口：

```http
POST /api/quotes/workload-preview
```

用途：

1. 根据报价内容、终端数、产品标签和实施规则生成工作量建议。
2. 给报价或交付准备提供参考。
3. 当前也是预览性质，不应与报价金额主逻辑混在一起。

相关数据结构：

| 数据 | 说明 |
|---|---|
| `implementationWorkloadClassifications` | 工作量分类。 |
| `implementationWorkloadMappings` | 产品/标签与工作量映射。 |
| `implementationWorkloadRules` | 工作量规则。 |
| `implementationDeliveryWorkloadRules` | 交付工作量规则。 |

重构建议：

1. 工作量预览应作为独立领域服务。
2. 报价只依赖其输出，不应把工作量规则揉入价格计算。
3. 规则配置应只允许超管或授权管理员维护。

## 11. 数据关系图

核心关系：

| 来源 | 目标 | 关联字段 |
|---|---|---|
| 用户 | 渠道商 | `users.partnerId = partners.id` |
| 渠道商 | 渠道员工 | `users.partnerId = partners.id` |
| 渠道商 | 二级渠道 | `partners.parentPartnerId` / `partners.parentPartnerIds` |
| 客户报备 | 商机 | `opportunities.regId = registrations.id` |
| 商机 | 报价单 | `quotes.oppId` / `quotes.oppIds` / `opportunities.quoteId` |
| 报价单 | 订单 | `orders.quoteId = quotes.id` |
| 商机 | 订单 | `orders.oppId = opportunities.id` |
| 渠道商 | 报备/商机/报价/订单 | `partnerId` / `assignedPartnerId` / `parentPartnerId` / `parentPartnerIds` |
| 员工 | 报备/商机/报价/订单 | `createdBy` / `ownerId` / `assignedStaffId` |
| 产品大类 | 产品模块 | `modules.categoryId = categories.id` |
| 产品模块 | 功能产品 | `features.moduleId = modules.id` |
| 套餐 | 功能/硬件/模块 | `featureIds` / `hardwareIds` / `moduleIds` |

业务链路：

```text
渠道商/员工
  -> 客户报备
  -> 商机
  -> 报价单
  -> 订单
  -> 经营统计/渠道贡献
```

报价链路：

```text
产品大类
  -> 产品模块
  -> 功能产品/硬件/套餐
  -> 联软价格解析
  -> 联软报价总价
  -> IPG参考价预览
  -> 报价保存只保存联软主线
```

## 12. 经营统计和分析

系统提供多类统计：

1. 单对象统计摘要：渠道、报备、商机、报价、订单。
2. 经营总览：一次性返回当前权限范围内的核心经营指标。
3. 转化漏斗：报备 -> 商机 -> 报价 -> 订单。
4. 渠道贡献：按渠道统计报备数、商机数和金额、报价数和金额、订单数和金额。
5. 区域贡献：按区域/大区统计业务贡献。
6. 负责人贡献：按员工/负责人统计业务贡献。

AI-agent 分析时应优先使用 OpenAPI 统计接口，而不是自己把全部列表拉下来重新计算。对于需要解释明细的场景，再按分页拉取列表和详情。

## 13. OpenAPI 对接边界

AI-agent 标准对接 Base URL：

```text
{CRM_BASE_URL}/api/open/v1
```

当前 SIT 文档示例：

```text
http://10.18.16.114:3000/api/open/v1
```

### 13.1 鉴权

获取 token：

```http
POST /auth/token
Content-Type: application/json
```

请求体：

```json
{
  "appKey": "oak_xxx",
  "appSecret": "oas_xxx"
}
```

后续请求：

```http
Authorization: Bearer {accessToken}
```

注意：

1. AI-agent 不使用 CRM 用户密码。
2. AI-agent 不模拟前端登录。
3. OpenAPI client 由超管创建，并绑定一个 CRM 用户。
4. 实际可见数据由绑定用户角色、资源白名单、IP 白名单共同决定。

### 13.2 标准响应结构

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "requestId": "req_xxx"
}
```

列表响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": [],
  "requestId": "req_xxx",
  "pageNo": 1,
  "pageSize": 20,
  "total": 100
}
```

### 13.3 当前开放资源

身份和元数据：

| 接口 | 用途 |
|---|---|
| `POST /auth/token` | 获取 OpenAPI token。 |
| `GET /auth/me` | 查看当前 client 和绑定 CRM 用户。 |
| `GET /meta/permission-scope` | 查看当前权限范围。 |
| `GET /meta/dictionaries` | 获取角色、状态、区域、渠道分销层级等字典。 |
| `GET /identity/users/{userId}` | 查询用户身份上下文。 |
| `GET /diagnostics/self-check` | 联调自检。 |

核心对象：

| 资源 | 列表 | 详情 |
|---|---|---|
| 用户 | `GET /users` | `GET /users/{id}` |
| 渠道商 | `GET /partners` | `GET /partners/{id}` |
| 客户报备 | `GET /registrations` | `GET /registrations/{id}` |
| 商机 | `GET /opportunities` | `GET /opportunities/{id}` |
| 报价单 | `GET /quotes` | `GET /quotes/{id}` |
| 订单 | `GET /orders` | `GET /orders/{id}` |

统计分析：

| 接口 | 用途 |
|---|---|
| `GET /analytics/{resource}/summary` | 单对象统计摘要，支持 `partners/registrations/opportunities/quotes/orders`。 |
| `GET /analytics/business-overview` | 经营总览。 |
| `GET /analytics/funnel` | 通用漏斗。 |
| `GET /analytics/funnel/registration-opportunity-order` | 报备到订单转化漏斗。 |
| `GET /analytics/partners/profile` | 渠道画像。 |
| `GET /analytics/partners/contribution` | 渠道贡献。 |
| `GET /analytics/regions/contribution` | 区域贡献。 |
| `GET /analytics/owners/contribution` | 负责人贡献。 |

产品目录：

| 资源 | 列表 | 详情 |
|---|---|---|
| 产品大类 | `GET /categories` | 无 |
| 产品模块 | `GET /modules` | 无 |
| 功能产品 | `GET /features` | 无 |
| 硬件产品 | `GET /hardware` | 无 |
| 套餐 | `GET /packages` | `GET /packages/{id}` |
| 产品 | `GET /products` | `GET /products/{id}` |

### 13.4 查询参数

常用参数：

| 参数 | 说明 |
|---|---|
| `pageNo` / `pageSize` | 分页。 |
| `keyword` | 关键词搜索。 |
| `status` | 状态。 |
| `stage` | 商机阶段。 |
| `region` | 区域。 |
| `bigRegion` | 大区。 |
| `partnerId` | 渠道 ID。 |
| `partnerName` | 渠道名称模糊查询。 |
| `customer` | 客户名称模糊查询。 |
| `customerId` | 客户标识，兼容客户名/信用代码。 |
| `registrationId` | 报备 ID，兼容 `regId`。 |
| `opportunityId` | 商机 ID，兼容 `oppId/oppIds`。 |
| `quoteId` | 报价 ID。 |
| `orderId` / `orderNo` | 订单 ID/编号。 |
| `assignedStaffId` | 指派员工。 |
| `ownerId` / `ownerName` | 负责人。 |
| `createdBy` | 创建人。 |
| `createdAfter` / `createdBefore` | 创建时间范围。 |
| `updatedAfter` / `updatedBefore` | 更新时间范围。 |
| `partnerLevel` | 渠道分销层级。 |
| `sortBy` / `sortOrder` | 排序。 |

## 14. AI-agent 推荐取数流程

标准取数顺序：

1. `POST /auth/token`
2. `GET /auth/me`
3. `GET /meta/permission-scope`
4. `GET /meta/dictionaries`
5. `GET /diagnostics/self-check`
6. `GET /analytics/business-overview`
7. 按 `pageSize=200` 分页拉核心对象：
   `users`、`partners`、`registrations`、`opportunities`、`quotes`、`orders`
8. 如问题涉及报价、产品、套餐，再拉：
   `categories`、`modules`、`features`、`hardware`、`packages`、`products`
9. 对异常对象或重点对象调用详情接口。
10. 生成 Markdown 快照。

Markdown 快照头建议包含：

| 字段 | 说明 |
|---|---|
| 快照时间 | 生成时间。 |
| Base URL | 数据来源。 |
| clientName | OpenAPI client 名称。 |
| boundUser | 绑定 CRM 用户。 |
| role | 角色。 |
| scopeType | 权限范围。 |
| filters | 查询过滤条件。 |
| totals | 每个资源接口返回的 `total`。 |
| requestIds | 关键接口的 `requestId`，便于排障。 |
| 脱敏说明 | 联系人、电话、邮箱、信用代码是否脱敏。 |

## 15. AI-agent 重构建议模块

建议把 AI-agent 侧拆成以下模块，避免把业务问答、取数、权限、报价解释揉在一起。

### 15.1 CRM OpenAPI Client

职责：

1. 管理 `appKey/appSecret` 和 token。
2. 自动处理 token 过期重试。
3. 统一标准响应解析。
4. 统一分页拉取。
5. 记录 `requestId`。

禁止：

1. 不保存 CRM 用户密码。
2. 不把 token 写进 Markdown。
3. 不调用内部 `/api/...` 业务写接口。

### 15.2 权限上下文模块

职责：

1. 调用 `/auth/me` 和 `/meta/permission-scope`。
2. 维护当前用户、角色、scopeType。
3. 给分析结论自动加上权限范围说明。
4. 防止把区域/个人数据写成全局结论。

### 15.3 字典和状态模块

职责：

1. 调用 `/meta/dictionaries`。
2. 把状态值翻译成中文。
3. 处理历史字段和新 UI 术语。

必须维护的术语：

| 技术字段 | 推荐中文 |
|---|---|
| `partnerLevel` | 渠道分销层级 |
| `level` | 合作级别 |
| `techServiceType` | 技术服务商类型 |

### 15.4 业务对象仓储模块

职责：

1. 拉取用户、渠道、报备、商机、报价、订单。
2. 建立对象索引。
3. 建立跨对象关联。
4. 检查断链数据，例如报价无商机、订单无报价、渠道缺失。

### 15.5 产品目录模块

职责：

1. 拉取大类、模块、功能、硬件、套餐、产品。
2. 建立产品树。
3. 解释报价中的产品构成。
4. 识别标准维保、硬件、套餐。

### 15.6 报价解释模块

职责：

1. 解释联软报价构成。
2. 解释终端数、阶梯价、固定价、渠道分销层级、区域覆盖。
3. 解释管理员侧原价、一级渠道价、二级渠道价参考。
4. 解释 IPG 只是参考价，不影响联软报价。

注意：

1. AI-agent 不应重新实现生产计价作为最终报价。
2. 如需校验，只能做“解释/复核/疑点提示”，最终以 CRM 后端和前端实际报价结果为准。

### 15.7 经营分析模块

职责：

1. 优先使用统计接口。
2. 支持经营总览、漏斗、渠道贡献、区域贡献、负责人贡献。
3. 能按角色权限生成不同粒度的结论。
4. 能列出异常项和建议跟进动作。

### 15.8 Markdown 快照模块

职责：

1. 把当前权限内数据整理为 Markdown。
2. 对敏感字段按约定脱敏。
3. 保留数据来源、筛选条件、分页 total 和 requestId。
4. 输出可复核、可追踪的分析材料。

## 16. 重构风险和不变量

### 16.1 不能破坏的主线

1. 联软报价逻辑是主业务，不得被 IPG 参考价影响。
2. 报价保存只保存联软报价相关业务数据。
3. 订单金额来自联软报价/订单主线，不来自 IPG。
4. 渠道分销层级字段名仍为 `partnerLevel`。
5. 合作级别字段名仍为 `level`，且当前必填。
6. 区域价格覆盖必须兼容 `region` 和 `regions`。
7. OpenAPI 是只读查询和统计，不做业务写入。
8. OpenAPI 权限裁剪由 CRM 后端负责，AI-agent 不绕过权限。
9. 敏感字段不得写入 AI-agent 快照。
10. 旧字段如 `oppId`、`regId` 不能突然删除，应与新字段并存兼容。

### 16.2 容易混淆的字段

| 字段 | 容易误解 | 正确理解 |
|---|---|---|
| `level` | 被误认为渠道层级 | 实际是合作级别。 |
| `partnerLevel` | 被旧 UI 称为渠道商等级 | 当前应叫渠道分销层级。 |
| `partnerType` | 被误认为合作级别 | 实际是渠道商/技术服务商类型。 |
| `techServiceType` | 被误认为渠道等级 | 实际是技术服务商状态。 |
| `oppId` | 只能关联一个商机 | 历史兼容字段，当前应优先看 `oppIds`。 |
| `amount` / `total` / `totalAmount` | 金额字段重复 | 需按对象和接口归一化，OpenAPI 已做部分兼容。 |
| `region` | 只有用户区域 | 可能来自用户、渠道、报备或报价区域。 |

### 16.3 报价重构高风险点

1. 阶梯价格命中规则。
2. 固定价和阶梯价混合。
3. 一级/二级渠道价格直接价和比例价优先级。
4. 区域价格覆盖与全国默认价回退。
5. 多区域覆盖的命中。
6. 标准维保不应重复作为普通软件模块计算。
7. 套餐中的功能、硬件和模块 ID 兼容。
8. 点数覆盖和数量覆盖。
9. 管理员侧参考价与渠道侧实际价一致性。
10. IPG 只读预览边界。

## 17. 推荐验收清单

AI-agent 或相关服务改造后，建议按以下清单验收：

| 项目 | 验收点 |
|---|---|
| 鉴权 | token 获取、过期重试、403/401 错误提示正确。 |
| 权限 | 四类角色看到的数据范围符合 CRM 页面。 |
| 字典 | 状态、角色、渠道分销层级、合作级别翻译正确。 |
| 数据链路 | 报备、商机、报价、订单关联正确。 |
| 产品树 | 大类、模块、功能、硬件、套餐关系正确。 |
| 报价解释 | 能解释终端数、阶梯价、渠道分销层级、区域覆盖。 |
| IPG 说明 | 明确 IPG 只作参考，不展示明细单价，不保存。 |
| 统计分析 | 经营总览、漏斗、渠道贡献和区域贡献结果符合接口。 |
| 快照 | Markdown 包含权限、时间、过滤条件、total、requestId。 |
| 脱敏 | 不输出密钥、token、密码等敏感信息。 |

## 18. 关键文档和代码位置

OpenAPI 文档：

| 文件 | 说明 |
|---|---|
| `docs/openapi-aiagent-latest-guide.md` | 最新对接说明，适合给对方联调用。 |
| `docs/openapi-aiagent-api-contract.md` | API 契约，适合开发和验收。 |
| `docs/openapi-aiagent-self-test-record.md` | 自测记录和实现补充。 |
| 历史交付包中的 OpenAPI 交接资料 | 已从主线清理，不作为当前对接入口。 |

核心代码：

| 文件 | 说明 |
|---|---|
| `backend/server.js` | 主业务后端、内部 API、OpenAPI、报价保存、产品管理、统计分析。 |
| `backend/ipg-pricing-service.js` | IPG 参考价计算。 |
| `backend/ipg-pricing-config.js` | IPG 价格和映射配置。 |
| `frontend/admin-app.js` | 管理后台，含产品、价格、渠道、报价和统计 UI。 |
| `frontend/partner-app.js` | 渠道工作台，含报备、商机、报价、订单 UI。 |
| `frontend/api-client.js` | 前端 API 调用封装。 |

重点后端路由：

| 路由 | 说明 |
|---|---|
| `/api/quotes` | 内部报价保存、列表、更新、状态接口。 |
| `/api/quotes/workload-preview` | 实施工作量预览。 |
| `/api/ipg/quote-preview` | IPG 参考价预览。 |
| `/api/categories` / `/api/modules` / `/api/features` / `/api/hardware` / `/api/packages` / `/api/products` | 内部产品管理接口。 |
| `/api/open/v1/...` | AI-agent 标准只读 OpenAPI。 |

## 19. 给 AI-agent 的一句话业务总结

这是一个以渠道销售为主线的联软 CRM：渠道商和员工提交客户报备，报备转商机，商机生成报价，报价转订单；产品价格由联软功能模块、终端数、渠道分销层级、区域价格覆盖、硬件和维保共同决定；IPG 只是报价页面的友商总价参考，不进入报价保存和订单；AI-agent 应通过只读 OpenAPI 获取当前权限内数据，生成可追踪、可脱敏、带权限边界说明的 Markdown 分析材料。
