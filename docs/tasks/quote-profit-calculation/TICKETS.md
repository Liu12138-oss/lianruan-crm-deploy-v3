# 微盾＋硬件报价收益核算实施任务单

## 1. 执行规则

- 所有任务状态初始为“待实施”。实施代理必须按编号和依赖顺序执行，不得跳过权限、迁移、审计或回退任务。
- 开始编码前必须再次阅读根目录 `AGENTS.md`、`docs/V3业务平台底座与业务扩展实施交付方案.md`、`docs/V3 MCP受控只读能力开发实施与交付手册.md` 和本任务 `DESIGN.md`、决策记录。
- 每完成一个任务，先执行该任务验证命令并记录结果，再开始下一个任务。
- 数据库迁移、生产配置、发布包和生产环境操作属于高风险动作；任务单提供实现要求，不代表已经获得生产执行授权。
- 所有代码、注释、错误消息、测试标题和方案说明使用标准简体中文；字段名、路径、命令、第三方专有名词保留原文。
- 任何实现与本设计不一致时，先更新 `docs/DECISION-LOG.md` 并取得用户确认，禁止在代码中静默改变公式或权限。

## 2. 依赖关系

```text
QPC-00 数据预检
  ├─QPC-01 计算契约与纯函数
  └─QPC-02 数据库迁移与初始成本
       ↓
QPC-03 报价输入、公开价快照与硬件数量
       ↓
QPC-04 收益查询/草稿/重算接口 ── QPC-05 成本规则接口
       ↓                              ↓
QPC-06 异步冻结与幂等 Worker
       ↓
QPC-07 管理端收益展示 ── QPC-08 报价硬件数量交互
       ↓
QPC-09 全链路测试与安全门禁
       ↓
QPC-10 发布、观测与回退
```

---

## QPC-00：数据与代码基线预检

### 状态

已完成（2026-09-16）：只读预检 SQL、权威 Excel 校验和脱敏结果均已固化，13 个硬件型号全部唯一匹配。

### 目标

在写代码前确认产品分类、硬件型号、区域归属和订单冻结触发点，形成可重复的预检报告，避免按产品名称或区域名称猜测。权威文件固定为 `微盾+硬件+渠道XCAD收益核算表-2026-05-to+龙海.xlsx`，SHA256 为 `236e3b588e169894509d1e1982e97b5e001ffbc742b5f4262b42ca2033a5e015`。

### 修改文件

- 新增 `scripts/quote-profit/precheck.sql`。
- 新增 `docs/tasks/quote-profit-calculation/docs/PRECHECK-RESULT.md`，只记录脱敏统计和稳定编码，不写生产敏感数据。

### 实施内容

1. 查询所有 `catalog.product_categories` 的 `category_code`、`v2_source_id`、`product_type_code`，列出微盾、XCAD、服务和未分类候选；最终映射必须使用稳定编码。
2. 查询 13 个 Excel 硬件型号在 `catalog.hardware_products.hardware_code`、`v2_source_id` 中的匹配情况；每个型号必须得到 0 或 1 个结果，禁止名称模糊匹配。
3. 统计现有 `crm.quote_items` 的 `product_ref_type`、空 `product_ref_id`、非整数硬件数量、套餐、手工项和服务分类情况。
4. 统计报价正式区域来源：商机 `region_id`、渠道商 `region_id`、两者冲突、两者均空。
5. 统计订单进入 `confirmed` 的历史数量和 `crm.order.confirmed` 发件箱事件；确认超管确认成功后确实产生该事件。
6. 检查上述 SHA256 对应 Excel 的 6 个工作表、公式和初始成本，不引用外部工作簿；把公式单元格和至少两个脱敏对账样例固化为测试输入/预期结果。
7. 如果微盾/XCAD 分类编码或硬件型号不能唯一映射，停止 QPC-02 的数据种子实施，将清单写入决策记录并请求业务确认，不能自行按名称选择。

### 验收标准

- 预检脚本只读、可重复执行，不产生数据库写入。
- 13 个硬件型号均有明确唯一映射或被列为阻塞项；未知的 `LV-7050A` 年度成本没有被写成 0。
- 微盾、XCAD、服务分类有稳定编码清单；运行时方案不依赖名称正则。
- 区域空值和冲突数量可见，且未提出区域名称权限兜底。
- 预检报告记录权威文件显示名称、实际路径、SHA256、工作表清单和对账样例编号。
- 确认多区域区管的有效 `iam.data_scope_bindings` 分布，统计无绑定但 `iam.users.region_id` 非空的兼容账号。

### 验证命令

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/quote-profit/precheck.sql
git diff --check
```

### 兼容与回退

本任务只有只读脚本和报告；回退为删除这两个新增文件。

---

## QPC-01：收益计算契约与确定性计算引擎

### 状态

已完成（2026-09-16）：定点计算引擎、统一导出及公式/边界专项测试已完成，`weidun-v1` 输出与权威样例一致。

### 前置依赖

QPC-00 已完成，Excel 公式和测试样例已固化。

### 修改文件

- 新增 `packages/shared/src/quote-profit.ts`。
- 修改 `packages/shared/src/index.ts`。
- 新增 `packages/shared/tests/quote-profit.test.ts`。

### 实施内容

1. 定义中文领域类型：收益输入、软件明细、硬件明细、缺失规则、计算结果、公式版本和状态。
2. `formulaVersion` 固定为 `weidun-v1`，税率和软件年度成本率作为版本化常量：5%、7%、0.5%、95%、93%。
3. 实现纯函数“计算微盾报价收益”，输入只接受十进制定点数字符串、整数年限和明细，不接受 JavaScript 浮点累计结果。
4. 内部建议使用 `bigint` 的百万分之一元缩放值，或经过验证的等价定点实现；JSON 边界统一转换成十进制字符串，不能直接序列化 `bigint`。
5. 计算过程不提前按分取整；快照保留 6 位小数，页面金额使用统一函数四舍五入到 2 位。
6. 项目收益、合同有效收入和产品税费允许为负，不静默归零；输入的报价、成本和年限仍必须满足非负/下限约束。
7. 计算结果必须同时返回所有公式中间值、缺失规则和 `complete` 标记；缺失成本时不得以 0 冒充完整结果。
8. 缺少输入时，与该输入相关的派生金额返回 `null`；真正计算结果为零时才返回定点字符串 `"0.000000"`，两种情况必须有测试区分。
9. 生成稳定输入指纹时固定字段顺序、数字格式和公式版本，排除展示名称、计算时间等非业务字段。

### 必测场景

- 微盾软件＋硬件＋服务的 Excel 对账样例。
- 只软件、只硬件、软件＋硬件、含服务、质保 1 年、质保 3 年、采购维保 0 年和多年。
- 一分钱参与 0.5% 计算，证明无二进制浮点误差。
- 产品合同额低于硬件内部成本时输出负收益，不归零。
- 硬件成本缺失、年度成本缺失、公开价缺失、未知分类时返回明确缺失项。
- 相同输入两次计算的输出和输入指纹完全一致。

### 验收标准

- 与 Excel 脱敏样例逐字段一致，展示金额误差为 0.00 元。
- `projectProfit` 没有扣减 `procurementMaintenanceCost`。
- 所有金额 API 值为字符串，无 `NaN`、`Infinity`、科学计数法和负零。
- 纯函数不读取数据库、系统时间或环境变量，API 和 Worker 可复用。

### 验证命令

```bash
npm --workspace @lianruan/shared test
npm --workspace @lianruan/shared run check
npm --workspace @lianruan/shared run build
```

### 兼容与回退

新增模块在未被调用前无业务副作用；回退删除新增导出和测试。

---

## QPC-02：数据库迁移、范围标识与 Excel 初始成本

### 状态

已完成（2026-09-16）：正向迁移、合法回退、有效期防重叠、冻结只读保护、13 条初始成本和迁移闭环均已验证。

### 前置依赖

QPC-00 已确认稳定分类编码和硬件型号映射。

### 修改文件

- 新增 `database/migrations/20260916_S10_024_微盾硬件收益核算.sql`。
- 新增 `database/migrations/20260916_S10_024_微盾硬件收益核算.rollback.sql`。
- 新增 `apps/api/tests/quote-profit-migration.test.ts` 或等价真实 PostgreSQL 迁移测试。

### 实施内容

1. 为 `catalog.product_categories`、`catalog.hardware_products` 增加 `profit_scope_code` 和检查约束，默认 `unclassified`。
2. 按 QPC-00 确认的稳定编码设置 `weidun`、`xcad`；未知值继续为 `unclassified`，不得使用运行时名称正则。
3. 为 `crm.quotes` 增加可空 `region_id` 外键和区域索引；优先从商机正式区域补齐，其次使用渠道商正式区域，冲突或均空的行不做名称兜底并记录迁移校验结果。
4. 为 `crm.quote_items` 增加 `item_type_code`、`extra_json` 和硬件正整数检查；仅在目录映射明确时回填类型，未知项保持 `unknown`。
5. 创建 `catalog.hardware_profit_cost_rules`，增加版本、生效区间、状态、来源、行版本和审计所需字段；使用排他约束或事务锁保证同一型号有效期不重叠。V1 只允许 `effective_from <= now()`，未来生效直接拒绝。
6. 创建 `crm.quote_profit_calculations`，按设计建立状态、版本、快照、金额、指纹、冻结和乐观锁字段。
7. 增加必要唯一约束：一个报价只能有一个当前草稿/不完整版本；同一订单、公式版本、输入指纹只能冻结一次。
8. 增加冻结行保护触发器，拒绝更新 `frozen` 行的金额、快照、年限、状态和规则来源；新审批轮次只能插入新版本。
9. 允许不完整/不适用记录的金额列为 `NULL`；增加冻结状态检查，确保 `frozen` 的全部公式输入和结果非空。
10. 按 Excel 种入 13 个型号的 V1 规则；`LV-7050A.annual_warranty_maintenance_cost` 为 `NULL`。年度质保和维保公式都读取同一字段。
11. 数据种子写 `source_code='excel'` 和完整源引用；种子可重复执行且不覆盖后续人工版本。
12. 回退脚本必须先检测冻结记录、人工成本版本和新格式硬件数量。新格式硬件数量按 `crm.quote_items.extra_json.pricingBasis` 或明确的写版本标记识别，不能仅凭 `quantity > 1` 猜测来源。存在上线后业务数据时拒绝破坏性回退并输出中文阻断原因；允许回退时只删除本迁移批次数据和新增结构。回退 SQL 必须用合法 PostgreSQL 语法检查 `to_regclass(...) IS NOT NULL`，不能把条件表达式直接写进 `FROM`。

### 验收标准

- 迁移可在空库和含存量报价的隔离库执行两次，不重复成本版本、不破坏报价。
- 回填后现有硬件数量均为正整数；异常行在迁移前被预检阻断。
- `LV-7050A` 的年度成本为数据库空值，不是 0 或字符串“未确定”。
- XCAD 分类不能进入 `weidun` 范围。
- 迁移和回退在隔离测试库完成一次闭环；存在正式冻结数据时回退会安全拒绝。

### 验证命令

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/20260916_S10_024_微盾硬件收益核算.sql
npm --workspace @lianruan/api test
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/20260916_S10_024_微盾硬件收益核算.rollback.sql
```

### 兼容与回退

- 新列提供默认值，旧代码在新迁移执行后仍可运行。
- 不删除或重写原 `list_price`、报价金额和订单状态。
- 生产回退必须先停收益 Worker，再执行兼容性检查；不满足安全条件时只回退应用镜像，保留新表只读。

---

## QPC-03：报价明细、公开价依据和硬件数量服务端收口

### 状态

已完成（2026-09-16）：`hardwareItems`、同型号多台、报价明细同步、公开价依据和服务端金额收口已完成并通过回归。

### 前置依赖

QPC-01、QPC-02 已完成。

### 修改文件

- 修改 `apps/api/src/business-store.ts` 中报价试算、创建、编辑和明细查询。
- 修改 `apps/api/src/business-routes.ts` 的报价输入校验，或把新增校验抽到独立文件。
- 修改 `apps/api/tests/business.test.ts`，必要时新增 `apps/api/tests/quote-hardware-quantity.test.ts`。

### 实施内容

1. 报价请求优先读取 `hardwareItems`；兼容读取旧 `hardwareIds` 并规范化为数量 1。新旧字段同时出现时要求内容一致，否则返回 `V3_QUOTE_HARDWARE_INPUT_CONFLICT`。
2. 硬件数量必须是 1 到设计上限之间的正整数；建议上限 9999。相同型号重复出现返回 `V3_QUOTE_HARDWARE_DUPLICATED`，不自动猜测是重复选择还是数量累加。
3. 套餐中的硬件数量按 `catalog.package_items.quantity` 展开，与额外选择的同型号硬件合并后得到最终数量；快照保留来源明细。
4. 试算、创建、编辑、报价详情、转订单和 PDF 数据全部使用同一规范化明细，`crm.quote_items.quantity` 保存真实数量，金额为服务端计算结果。
5. 修复当前“编辑报价只更新总额/扩展 JSON、不可靠同步 `crm.quote_items`”的问题：在同一事务内锁定报价、重算、替换明细、更新总额和递增 `row_version`。
6. 每条软件明细同时计算：公开单价、折后单价、公开金额、折后金额、命中区域/阶梯/渠道规则。公开价是同区域、同数量且未应用渠道级比例/专属价的原价。
7. 将价格依据写入 `crm.quote_items.extra_json.pricingBasis`，至少包含目录编号、目录版本/更新时间、数量、公开价规则、折后价规则、计算时间和价格区域编号。
8. `item_type_code` 通过结构化目录关系写入；未知、手工或未分类项不得通过名称正则补成服务。
9. 前端提交的 `total`、`unitPrice`、`lineAmount` 只作兼容输入，不作为持久化金额；与服务端结果差异超出 0.01 元时记录审计并使用服务端结果。
10. 旧报价读取时，如果没有 `pricingBasis`，收益核算实时重建并标记 `reconstructed=true`；无法重建则收益不完整，不回写伪造快照。
11. 报价价格规则不变，只调整硬件选择、请求和明细持久化。验收时必须证明软件阶梯价、区域价格和渠道比例结果与改造前一致。

### 验收标准

- 同型号 3 台硬件在试算、报价明细、订单明细、PDF 和收益输入中均为 3 台。
- 同型号 2 台在报价金额中按 2 倍销售价，在收益输入中按 2 倍内部成本和 2 倍年度质保/维保成本计算。
- 旧 `hardwareIds` 创建的报价仍成功且按 1 台；新旧冲突请求被拒绝。
- 报价编辑后数据库明细和总额一致，失败时事务整体回滚。
- 公开价与管理员报价页“原价”口径一致，折后价与正式报价金额一致。
- 未分类服务项导致收益不完整，不被名称猜测为服务。

### 验证命令

```bash
npm --workspace @lianruan/api test
npm --workspace @lianruan/api run check
npm --workspace @lianruan/api run build
```

### 兼容与回退

- 请求、响应继续保留 `hardwareIds`；响应新增 `hardwareItems`，旧页面不受影响。
- 回退应用代码后，新列仍可保留；旧代码会忽略数量扩展，但已包含多数量的新报价不能继续由旧页面编辑。发布回退前应暂时禁用报价编辑或确认没有新格式数据。

---

## QPC-04：收益查询、草稿保存和服务端重算接口

### 状态

已完成（2026-09-16）：收益查询、草稿、重算、冻结投递、成本规则接口、多区域权限和 `roleCodes` 已完成。

### 前置依赖

QPC-01、QPC-02、QPC-03 已完成。

### 修改文件

- 新增 `apps/api/src/quote-profit-store.ts`。
- 新增 `apps/api/src/quote-profit-routes.ts`。
- 修改 `apps/api/src/create-app.ts` 和 `apps/api/src/index.ts`。
- 修改 `apps/api/src/v2-compat-routes.ts`，为 V2 登录和会话响应补充稳定 `roleCodes`。
- 新增 `apps/api/tests/quote-profit-routes.test.ts`。
- 新增 `apps/api/tests/quote-profit-postgresql.test.ts`。
- 扩展 `apps/api/tests/v2-compat.test.ts`，验证 `roleCodes` 返回和不泄露内部成本。

### 实施内容

1. 定义可注入的收益数据服务接口，生产实现使用 PostgreSQL，路由单测可注入桩服务。
2. 实现 `GET /api/quotes/:quoteId/profit-calculation`、`PUT /api/quotes/:quoteId/profit-calculation/draft`、`POST /api/quotes/:quoteId/profit-calculation/recalculate`、`POST /api/quotes/:quoteId/profit-calculation/freeze`。
3. 每次访问从数据库复核账号启用状态和有效 `superadmin`/`region_manager` 角色，不能只信 Cookie 中的角色摘要。
4. 区管从 `iam.data_scope_bindings` 读取本人有效角色的一个或多个 `region` 范围；存在绑定集合时按集合判断，无绑定时才兼容 `iam.users.region_id`。报价区域必须命中集合，否则或报价区域为空时返回保护性 404。超管可查看全部，但区域为空时结果仍为 `incomplete`。
5. 只接受 `warrantyYears`、`procurementMaintenanceYears`、`expectedRowVersion` 等白名单字段；请求中出现任意金额/成本字段直接返回 `V3_QUOTE_PROFIT_AMOUNT_READ_ONLY`。
6. 草稿保存用事务和 `SELECT ... FOR UPDATE` 锁定当前计算记录；检查报价 `row_version` 和收益 `row_version`，冲突返回 409，不做最后写入覆盖。
7. GET 保持只读：没有草稿或草稿报价版本落后时，实时计算并返回响应态 `estimated`，不写数据库。PUT/POST 才保存草稿或不完整记录。纯计算返回的 `complete` 持久化时必须映射为 `draft`，数据库和接口都不能把 `complete` 当成持久化状态。
8. 重算服务统一读取报价、明细、价格依据、成本规则、生效时间和正式区域，调用 QPC-01 纯函数，保存输入/计算快照。
9. 已有 `frozen` 记录永不更新。报价发生变化时将原草稿设为 `void`，创建递增 `calculation_version` 的新记录。
10. 非微盾、混入 XCAD 或未分类产品的报价返回 `not_applicable`，响应不输出部分收益总额。
11. 所有金额响应为定点字符串；返回状态中文名、缺失规则、硬件成本行、公式版本、计算时间、报价版本和冻结信息。
12. 冻结接口仅超管可调用，负责校验订单状态并幂等投递冻结请求，不直接修改冻结金额；区管只能保存草稿。
13. 将访问拒绝、草稿保存、重算和冻结请求写入 `audit.audit_logs`；日志不得包含 Cookie、密码或成本规则之外的无关敏感数据。

### 错误码

| 错误码                             | HTTP | 含义                                                                                  |
| ---------------------------------- | ---: | ------------------------------------------------------------------------------------- |
| `V3_QUOTE_PROFIT_NOT_FOUND`        |  404 | 报价不存在或当前用户无区域权限                                                        |
| `V3_QUOTE_PROFIT_ROLE_DENIED`      |  403 | 当前角色不允许访问收益域                                                              |
| `V3_QUOTE_PROFIT_REGION_REQUIRED`  |  403 | 区管没有正式区域绑定                                                                  |
| `V3_QUOTE_PROFIT_NOT_APPLICABLE`   |  422 | 报价不属于纯微盾＋硬件范围                                                            |
| `V3_QUOTE_PROFIT_INCOMPLETE`       |  422 | 仅用于要求正式冻结但缺少公开价、成本或明确归类；普通查询返回 200 和 `incomplete` 状态 |
| `V3_QUOTE_PROFIT_FROZEN_READ_ONLY` |  409 | 正式快照不可覆盖                                                                      |
| `V3_QUOTE_PROFIT_VERSION_CONFLICT` |  409 | 报价或收益行版本冲突                                                                  |
| `V3_QUOTE_PROFIT_AMOUNT_READ_ONLY` |  400 | 请求试图提交服务端计算金额                                                            |

### 验收标准

- 超管、同区域区管、跨区域区管、普通管理员、渠道管理员、销售、停用账号均有自动化权限用例。
- 单区域区管、多区域区管、区域集合全部无权、区域集合部分命中和仅 `iam.users.region_id` 兼容账号均有自动化用例。
- 修改区域名称不影响权限；只改 Cookie 区域或角色不能越权。
- 输入金额无法覆盖服务端结果；并发保存不会丢失更新。
- 返回缺失规则时不会伪造 0 元完整收益。
- 新路由只挂在 `/api`，未出现在 `/api/v2`、OpenAPI 和 MCP。

### 验证命令

```bash
npm --workspace @lianruan/api test
npm --workspace @lianruan/api run check
npm --workspace @lianruan/api run build
```

### 兼容与回退

在 `create-app.ts` 中把收益路由挂载在 `/api`，且顺序早于通用业务路由，确保 `/api/quotes/:quoteId/profit-calculation` 不被 `/api/quotes/:id` 截断；新接口与现有路由隔离。应用回退时停止调用新接口即可，已有收益记录保留只读。

---

## QPC-05：超管硬件成本规则维护（嵌入现有硬件管理）

### 状态

已完成（2026-09-16）：超管成本规则查询与新版本维护、V1 禁止未来生效、审计和自动重试事件已完成。

### 前置依赖

QPC-02、QPC-04 已完成。

### 修改文件

- 扩展 `apps/api/src/quote-profit-store.ts`、`quote-profit-routes.ts`。
- 扩展 `apps/api/tests/quote-profit-routes.test.ts`、`quote-profit-postgresql.test.ts`。

### 实施内容

1. 实现 `GET /api/quote-profit/hardware-cost-rules` 和 `POST /api/quote-profit/hardware-cost-rules`。
2. GET 支持型号、状态、生效时间和“仅缺失年度成本”筛选，返回当前有效版本和历史版本摘要。
3. POST 只创建新版本：锁定硬件规则，校验生效区间，关闭旧版本，再插入新版本；禁止原地覆盖金额。V1 只接受当前或过去生效时间，拒绝未来时间。
4. 输入必须包含硬件产品编号、内部销售成本、生效时间、来源说明；年度质保/维保成本允许空，0 表示已明确为 0，空值表示未知，两者不能混淆。V1 年度质保和采购维保继续读取同一个权威 Excel 字段，不允许页面维护出两套含义不明金额。
5. 仅数据库当前有效 `superadmin` 可调用；区管即使知道 URL 也返回 403。
6. 成功后写 `cost_rule_created` 审计和 `crm.quote.profit.cost_rule.changed` 发件箱事件，供已确认但不完整记录重试。
7. 冻结快照继续引用原规则版本；成本规则变更只影响未冻结或新版本收益。
8. 页面不新增独立成本管理菜单。成本规则维护操作由 QPC-07 在现有“产品目录 → 硬件管理”列表中提供：每个硬件型号增加“成本配置”按钮，打开成本配置弹窗；硬件基本资料编辑和成本规则维护仍是两个独立提交动作。
9. 成本配置弹窗至少展示当前内部销售成本、当前年度质保/维保成本、生效时间、来源说明、配置完整状态和历史版本；历史版本只读，通过“新增版本”创建变更。内部销售成本必须为大于等于 0 的两位金额；年度质保/维保成本允许留空且必须原样提交为空值，不能自动转换为 0；生效时间和来源说明必填。
10. 成本配置弹窗仅超管渲染。区管、普通管理员和渠道端不请求成本规则接口，也不在页面源码中渲染内部成本字段。
11. `hardwareProductId` 接受数据库 UUID、`hardware_code` 或 `v2_source_id`，必须解析为唯一数据库 UUID；匹配 0 条或多条均拒绝，不得静默选择。

### 验收标准

- 同型号并发新增规则时最多一条当前有效记录。
- 0 与空值语义不同；`LV-7050A` 未补齐前保持不完整。
- 区管和其他角色不能读取成本规则列表，防止从接口侧泄露内部成本。
- 规则改价后旧冻结收益不变，新草稿使用新版本并在输入快照中记录规则编号。

### 验证命令

```bash
npm --workspace @lianruan/api test
```

### 兼容与回退

停用成本规则接口不会影响报价主链；规则历史保留，不执行破坏性删除。

---

## QPC-06：订单超管确认后的异步冻结与幂等处理

### 状态

已完成（2026-09-16）：订单确认写冻结事件、Worker 租约/幂等处理、缺成本自动重试和配置开关已完成。

### 前置依赖

QPC-01 至 QPC-05 已完成。

### 修改文件

- 修改 `apps/api/src/business-store.ts` 的订单确认事务。
- 新增 `apps/worker/src/quote-profit-store.ts`。
- 新增 `apps/worker/src/quote-profit-worker.ts`。
- 修改 `apps/worker/src/worker.ts`、`apps/worker/src/index.ts`。
- 修改 `packages/config/src/index.ts`、`packages/config/tests/*`。
- 修改 `.env.example`、`deploy/single-server/config/v3.env.template`。
- 新增 `apps/worker/tests/quote-profit-worker.test.ts`。
- 新增 `apps/worker/tests/quote-profit-worker-postgresql.test.ts`。

### 实施内容

1. 订单状态从 `pending_superadmin_confirm` 进入 `confirmed` 时，在订单事务内写专用事件 `crm.quote.profit.freeze.requested`；不得由前端另发冻结请求。
2. 事件载荷包含订单、报价、订单行版本、审批轮次、修订版本、公式版本和 `confirmedAt`，不包含可被篡改的金额。
3. Worker 仅领取该专用事件类型，采用 `FOR UPDATE SKIP LOCKED`、租约令牌、有限重试和退避，避免与消息/订单预审消费者争抢其他事件。
4. Worker 每次从数据库重新读取订单、报价、明细、公开价和成本规则，调用共享计算引擎；只从最新草稿继承两个年限，没有草稿时使用 3/0，不能直接冻结此前浏览器看到的草稿金额。
5. 正式冻结以订单总额为合同总额，硬件和服务金额取当前订单明细，软件折后价反算为“订单总额 - 硬件 - 服务”，用于兼容现有总价调价；反算小于 0 或分类不完整时不能冻结。
6. 成本规则有效时点固定为订单进入 `confirmed` 的事件时间；Worker 延迟执行或之后的成本规则改价不能改变该审批轮次的取值。
7. 完整结果插入 `frozen` 记录；缺失成本或范围不明确时插入/更新 `incomplete` 并完成本次事件，等待成本规则变更事件再次触发。
8. 使用数据库唯一约束、输入指纹和条件写入保证同订单/公式/输入只冻结一次。事件重复、进程崩溃重启和两个 Worker 并发都应安全空转或返回已有快照。
9. Worker 失败只更新事件重试信息和审计，不回写 `crm.orders.status_code`。超过阈值后标记失败并输出结构化错误码，禁止记录完整 SQL、凭据或 Cookie。
10. 新增配置：`QUOTE_PROFIT_WORKER_ENABLED`、`QUOTE_PROFIT_EVENT_CUTOVER_AT`、`QUOTE_PROFIT_POLL_INTERVAL_MS`、`QUOTE_PROFIT_MAX_RETRIES`。默认关闭；启用时必须有合法切换时间。
11. 收益任务并入现有主 Worker 生命周期，独立关闭数据库连接；不新增外部服务或 Redis 依赖。若实施中决定独立容器，必须先更新设计并获得确认。
12. 成本规则变更事件自动扫描“订单已确认且收益仍不完整”的受影响硬件型号并重试冻结；允许超管手工重算作为兜底。不得全表重算，不得覆盖冻结记录。

### 验收标准

- 超管确认成功后 API 立即返回订单结果，收益稍后冻结；Worker 停止或失败不导致订单确认失败。
- 重复确认事件和并发 Worker 只产生一条正式快照。
- Worker 在计算写入前崩溃，租约到期后能安全重试；写入后崩溃不会重复冻结。
- `LV-7050A` 缺成本时订单保持 `confirmed`，收益为 `incomplete`；补齐规则后重试可冻结。
- 切换时间之前的历史事件默认不自动批量冻结，历史回填必须使用单独受控命令并另行授权。

### 验证命令

```bash
npm --workspace @lianruan/worker test
npm --workspace @lianruan/worker run check
npm --workspace @lianruan/worker run build
npm --workspace @lianruan/config test
```

### 兼容与回退

- 第一阶段部署保持 `QUOTE_PROFIT_WORKER_ENABLED=false`，完成迁移与接口检查后再启用。
- 紧急回退先关闭该开关并重启 Worker，再回退应用镜像；未消费事件可保留，恢复前重新设置切换时间。

---

## QPC-07：管理员报价详情收益展示与硬件管理成本配置

### 状态

已完成（2026-09-16）：报价详情收益区块、超管成本配置、角色显隐、冻结只读、负收益提示和专项测试已完成。

### 前置依赖

QPC-04、QPC-05、QPC-06 已完成。

### 修改文件

- 修改 `apps/web/public/api-client.js`。
- 修改 `apps/web/public/admin-app.js`。
- 配套修改 `apps/api/src/v2-compat-routes.ts` 及其测试，确保登录响应返回稳定 `roleCodes`；若实现采用页面会话 `roles`，必须先更新设计与接口契约，不能继续读取不存在的字段。
- 必要时修改 `apps/web/public/style.css`，只增加收益区块需要的局部样式。
- 新增 `apps/web/tests/quote-profit-entry.test.ts`。
- 扩展 `apps/web/e2e/layout.spec.ts` 或新增收益专项端到端测试。

### 实施内容

1. API 客户端增加收益读取、草稿保存、重算、成本规则列表和新版本创建方法；统一解析中文错误响应。
2. 报价详情仅对区管和超管渲染“内部收益核算”。正式页面会把 `region_manager` 映射为展示角色 `admin`，显隐必须读取后端登录响应提供的原始有效 `roleCodes`；不能只依赖 `role='admin'`。前端判断只负责体验，实际权限完全由后端控制。
3. 按设计展示状态、基本信息、年限输入、4 个汇总卡、核算明细、硬件成本明细和缺失规则。
4. 已冻结时所有输入和按钮只读；显示冻结人、冻结时间、公式版本、计算版本和“正式快照”标识。
5. 未冻结时区管和超管可保存年限并重算；必须提交 `expectedRowVersion`，409 时刷新数据并提示“数据已被其他人更新”。
6. 收益允许为负，使用风险色和“当前报价预计亏损”提示，不隐藏负号、不归零。
7. 收益接口 404 时不泄露报价是否存在；403 提示角色无权限；422 显示缺失规则；5xx 只让收益区块降级，不影响报价详情其他内容。
8. 在现有“产品目录 → 硬件管理”列表的每个硬件型号上增加“成本配置”按钮，仅超管可见；硬件卡片显示“成本完整/缺少年度成本/未配置”状态，列表顶部支持“只看成本缺失”筛选。弹窗支持查看当前规则、历史版本和新增版本，不提供直接编辑历史行。
9. 硬件基本资料弹窗继续维护名称、型号、对外报价单价、单位和规格；“成本配置”弹窗只维护内部销售成本、年度质保/维保成本、生效日期和来源说明，两个弹窗不得互相覆盖字段。
10. 区管页面不能请求成本规则列表，普通管理员和渠道端 DOM 中不渲染收益标签、金额或成本字段；区管在收益区块只填写质保年限和采购维保年限。
11. 新增硬件必须先保存硬件基本资料，取得正式硬件编号后才能创建成本版本；未配置成本不阻断硬件资料保存，但应立即显示“未配置”，引用该型号的收益只能保存为不完整，不能冻结。
12. 首版不增加独立成本菜单、导出、打印、经营报表卡片和移动端收益入口。

### 验收标准

- 超管、同区域区管、普通管理员三种页面截图和接口网络记录符合权限。
- 超管在现有硬件管理页面可以完成“打开型号 → 成本配置 → 新增版本 → 查看历史”的闭环；页面网络请求不把内部成本混入 `/api/v2/hardware` 对外目录响应。
- 新增硬件未填写成本时可以保存且明确显示“未配置”；补充成本版本后状态刷新为完整或缺少年度成本。
- `draft`、`incomplete`、`frozen`、负收益四种状态可清晰区分。
- `LV-7050A` 显示具体缺失提示；规则补齐后页面重算刷新。
- 收益接口故障时，报价查看、下载 PDF、转订单等原功能仍可用。
- 浏览器控制台不输出内部成本或完整接口响应。

### 验证命令

```bash
npm --workspace @lianruan/web test
npm --workspace @lianruan/web run check
npm --workspace @lianruan/web run build
npm --workspace @lianruan/web run test:e2e -- --grep "收益核算"
```

### 兼容与回退

收益区块为详情页附加区域；回退前端后接口和表可继续保留，不影响报价详情主功能。

---

## QPC-08：管理员端和渠道端硬件数量交互

### 状态

已完成（2026-09-16）：管理员端和渠道端同型号数量交互、金额预览、旧数据兼容及专项测试已完成。

### 前置依赖

QPC-03 已完成。

### 修改文件

- 修改 `apps/web/public/admin-app.js`。
- 修改 `apps/web/public/partner-app.js`。
- 修改 `apps/web/public/api-client.js`（如报价请求转换集中在此文件）。
- 新增 `apps/web/tests/quote-hardware-quantity.test.ts`。
- 扩展相关端到端测试。

### 实施内容

1. 将 `selectedHardware: string[]` 的报价选择状态规范为 `{productId, quantity}[]`；界面仍支持勾选型号，但选中后显示数量步进器/数字输入框。
2. 数量默认 1，只允许 1 到 9999 的整数；取消型号时删除该项，重新选中恢复默认 1。
3. 套餐自带硬件与额外硬件同型号时页面展示合计数量和来源说明，提交给服务端的最终结构不得重复型号。
4. 新建、编辑、快速报价、报价详情、合计金额、渠道价格参考、标准维保计算和 PDF 明细全部使用硬件数量。
5. 编辑旧报价时把 `hardwareIds` 转换为数量 1；保存后同时返回 `hardwareItems` 和兼容 `hardwareIds`。
6. 管理端和渠道端保持相同数量行为，但渠道端不能看到内部成本和收益。
7. 页面金额仍只用于预览，最终结果以服务端响应为准；接口返回校验错误时显示中文原因。
8. 报价价格规则本身不变。不得借本次改造修改软件阶梯价、区域价格覆盖、渠道比例或渠道专属价的计算语义。

### 验收标准

- 同型号数量 2 时，管理员端和渠道端预览硬件金额均为单价两倍，保存后数据库数量为 2。
- 同型号数量 2 时，软件价格、服务价格和渠道折扣结果与此前规则一致，仅硬件数量相关金额变化。
- 旧报价打开、编辑、保存不丢硬件；同型号不会生成两行含义不明的数据。
- 标准维保、正式报价 PDF、订单明细数量同步回归通过。
- 渠道页面源代码和网络请求中没有收益/内部成本字段。

### 验证命令

```bash
npm --workspace @lianruan/web test
npm --workspace @lianruan/web run build
npm --workspace @lianruan/web run test:e2e -- --grep "硬件数量"
```

### 兼容与回退

保留旧字段用于读兼容。若已产生数量大于 1 的报价，旧页面回退会错误显示为 1，因此应用回退时必须同时禁用报价编辑或部署兼容补丁，不能只回退页面文件。

---

## QPC-09：全链路测试、安全与非暴露门禁

### 状态

已完成（2026-09-16）：公式、权限、数据范围、幂等、主链回归、非暴露、冻结保护、构建和全量门禁均通过。

### 前置依赖

QPC-01 至 QPC-08 全部完成。

### 修改文件

- 补齐 `apps/api/tests/*quote-profit*`。
- 补齐 `apps/worker/tests/*quote-profit*`。
- 补齐 `apps/web/tests/*quote-profit*` 和端到端用例。
- 如有稳定烟测入口，最小修改 `tests/smoke.sh` 或对应 V3 烟测脚本。

### 实施内容

1. 公式对账：至少两组完整 Excel 样例和所有边界公式。
2. 权限矩阵：超管、单区域区管、多区域区管、跨区域区管、无区域区管、历史 `admin` 区管、普通管理员、渠道管理员、员工、停用账号、过期会话。
3. 数据范围：只比较正式 UUID；多区域绑定部分命中、区域改名、重名、Cookie 篡改、数据库角色撤销和数据范围停用均不能越权。
4. 输入安全：拒绝金额覆盖、非整数硬件数量、重复型号、超大年限、未知字段、非法 UUID 和行版本冲突。
5. 幂等并发：重复事件、重复重算、两个 Worker、进程中断恢复、成本规则并发版本和成本补齐后的自动重试。
6. 主链回归：报价试算/新建/编辑/PDF、转订单、一级确认、区管确认、超管确认、退回、调价、OA 预审、企微和消息事件。
7. 非暴露检查：OpenAPI 契约、MCP 工具/资源、V2 兼容路由、渠道端页面和日志中均无收益字段与内部成本。
8. 冻结防篡改：直接 SQL 更新冻结行应被约束/触发器阻断，或应用测试证明数据库权限只允许受控写函数；审计记录不可缺失。
9. 故障演练：成本缺失、目录下架、公开价缺失、数据库短暂失败、Worker 关闭时订单仍可确认。

### 验收标准

- 所有新增专项测试通过，现有 API、Worker、Web 测试无回归。
- 任何非授权身份均无法得到收益金额、内部成本或“对象存在”侧信道。
- 冻结失败不回滚订单，冻结成功不可覆盖。
- `git diff --check`、类型检查、构建和全量测试通过。

### 验证命令

```bash
npm run build
npm run check
npm test
npm run test:e2e
git diff --check
git status --short
```

### 兼容与回退

测试本身无运行时副作用；隔离数据库测试必须使用名称以 `_test` 结尾的本机测试库并在结束后清理测试数据。

---

## QPC-10：发布、观测、数据验证与回退演练

### 状态

待生产授权：本地发布配置和回退边界已完成；生产数据库迁移、升级包制作、生产发布和历史数据回填必须另行取得明确授权后执行。

### 前置依赖

QPC-09 全部验收通过。

### 修改文件

- 最小修改 `deploy/single-server/compose/docker-compose.yml`（仅增加主 Worker 所需环境变量）。
- 修改 `deploy/single-server/config/v3.env.template`、`.env.example`。
- 修改实际升级包的 `precheck.sh`、`upgrade.sh`、`verify.sh`、`rollback.sh` 和 `tests/smoke.sh`。
- 新增 `docs/operations/微盾硬件收益核算运维手册.md`。

### 实施顺序

1. 备份数据库和当前配置，记录 API/Worker/Web 镜像摘要与当前版本。
2. 在测试环境执行预检、迁移、数据种子和迁移后 SQL 断言；13 个型号、分类范围和区域统计必须符合报告。
3. 部署 API、Worker、Web，但保持 `QUOTE_PROFIT_WORKER_ENABLED=false`；验证报价、订单和新收益只读接口。
4. 用超管创建成本规则版本、区管跨区拒绝和 Excel 公式做验收；确认 OpenAPI/MCP/渠道端无暴露。
5. 设置 `QUOTE_PROFIT_EVENT_CUTOVER_AT` 为明确上线时间，启用 Worker 并重建主 Worker 容器。
6. 新建一张受控测试报价，走完整订单审批，验证异步冻结、审计、日志和重复事件幂等。
7. 观察待处理/失败事件、收益不完整数量、冻结延迟和 Worker 日志；达到观察窗口后再宣布上线完成。
8. 不自动回填历史订单。历史回填需单独生成清单、评估成本版本时点并获得授权。

### 发布断言

- 数据库迁移记录、13 个成本规则、`LV-7050A` 空年度成本符合预期。
- 收益 Worker 只处理切换时间后的专用事件。
- 新订单超管确认后在目标时间内生成 `frozen` 或可解释的 `incomplete`。
- 订单状态、OA 预审、消息任务和健康检查无回归。
- 升级包通过外层 SHA256、解压、包内 `manifest/SHA256SUMS`、所有脚本 `bash -n` 和关键字本地等价验证。
- 自检脚本不写死 Vite 哈希资源，不使用 `docker compose config | grep -q` 的 `pipefail` 风险写法。

### 回退步骤

1. 将 `QUOTE_PROFIT_WORKER_ENABLED=false`，重建 Worker 并确认不再领取收益事件。
2. 回退 API/Web/Worker 镜像；若已有数量大于 1 的报价，先启用报价编辑维护窗口或部署兼容读取补丁。
3. 若无正式冻结和人工成本版本，可执行迁移回退脚本；否则保留新表和新列，只做应用级回退。
4. 不删除 `audit.audit_logs` 和已冻结快照；必要时将未冻结记录标记 `void`。
5. 恢复前一版配置，验证登录、报价、订单、OA/企微、消息和健康接口。

### 验收标准

- 升级和回退在测试环境各完成一次，命令、耗时、检查结果和异常处理都有记录。
- 生产执行前获得数据库变更、配置变更和发布的明确授权。
- 运维人员能定位：待处理事件、失败事件、不完整收益、缺失型号、最新冻结时间和公式版本。

---

## 3. 完成定义

只有同时满足以下条件，本任务才能标记完成：

1. QPC-00 至 QPC-10 均完成且每项验收证据可追踪。
2. Excel 公式对账通过，没有采购维保重复扣减或前端可信金额。
3. 收益和成本只对超管/所属区域区管开放，后端数据库角色与区域复核覆盖所有接口。
4. XCAD、OpenAPI、MCP、V2 兼容接口、普通管理员和渠道端均未暴露收益。
5. 订单确认与收益冻结异步解耦，收益故障不影响订单主链。
6. 多数量硬件贯穿报价、订单、PDF 和收益快照，旧报价仍可读取。
7. 迁移、回退、构建、全量测试、端到端测试和升级包自检全部通过。
