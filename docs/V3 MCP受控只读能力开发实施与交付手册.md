# V3 MCP受控只读能力开发实施与交付手册

## 1. 文档状态与执行方式

| 项目 | 内容 |
| --- | --- |
| 文档版本 | `v1.0` |
| 编制日期 | 2026-08-31 |
| 适用工程 | 联软渠道管理平台 V3 |
| 主需求归属 | 第12项“AI数据分析、大屏与企微智能机器人”中的受控只读工具协议层 |
| 产品范围 | 内部人员和渠道人员；首期只读 |
| 首期验收客户端 | 赤兔 RedClaw（本地 stdio） |
| 协议版本 | MCP `2026-07-28` |
| 生产状态 | 默认关闭；通过三阶段门禁后按人员灰度 |
| 编码要求 | 其他开发人员按本文直接实施，不自行增加业务规则、写工具或权限旁路 |

本文是开发、测试、部署和验收的执行基线。本文已经吸收用户确认的范围：首期同时支持内部人员和渠道人员，不实现双重身份切换，本地使用赤兔 RedClaw 验收，首期不提供任何业务写入能力。

本文不授权跳过项目既有生产门禁。涉及真实业务数据、数据库迁移、生产配置和发布包的改动，必须按本文阶段退出条件完成独立评审、测试和回退演练。

本机 RedClaw 检查记录（2026-08-31）：已安装应用为“联软赤兔”，应用版本 `0.5.17`；设置页存在“MCP 服务器”入口，支持 STDIO 和流式 HTTP，可配置名称、启用开关、启动命令、参数、环境变量、环境变量透传、工作目录、启动超时、工具超时、工具允许清单和工具禁用清单。应用提示可升级到 `0.5.20`，本次文档按已安装的 `0.5.17` 编写，升级后必须重新执行兼容验收。

### 1.1 已冻结产品决策

| 编号 | 已确认方案 | 直接开发约束 |
| --- | --- | --- |
| M-01 | 内部人员和渠道人员同时支持 | 每次调用映射真实 V3 用户 |
| M-02 | 赤兔 RedClaw 为首期验收客户端 | 本地优先 stdio，记录实际版本和配置 |
| M-03 | 远程仅限内网或受控终端 | 禁止公网匿名访问 |
| M-04 | 远程 OAuth 2.1 + PKCE | 本地 stdio 仅使用受控测试夹具 |
| M-05 | 不做双重身份选择或切换 | 主身份不唯一时拒绝，不合并权限 |
| M-06 | 产品、报备、商机、报价和订单只读 | 固定十个工具，不自动暴露 OpenAPI |
| M-07 | 联系方式默认脱敏 | 完整联系方式不进入首期 |
| M-08 | 金额按现有字段权限 | 成本和底价无权即隐藏 |
| M-09 | 工具未授权返回403，对象越权采用保护性404 | 不泄露对象是否存在 |
| M-10 | 审计至少保留3年 | 不保存完整问题、回答和敏感结果 |
| M-11 | 远程生产必须使用 HTTPS | 无 HTTPS 不开放远程 MCP |
| M-12 | 首期禁止写入 | 写工具必须另行立项 |
| M-13 | 批准新增 `apps/mcp` | 独立进程、默认关闭、不连接业务主库 |
| M-14 | 初始性能劣化警戒值5% | 最终以实施前后基线验收，超限立即停止灰度 |

以上范围无需开发人员逐项重新确认。仅当项目真实结构、权限事实或本机 RedClaw 行为与本文冲突，且冲突会改变业务语义、安全边界或接口契约时，才停止对应项并提交具体差异；其他事项按三阶段计划连续实施。

---

## 2. 产品最终效果

用户在赤兔 RedClaw 或其他经批准的 MCP 客户端中，可以用自然语言查询 V3 中自己原本有权查看的业务信息。MCP 只负责协议和工具适配，V3 仍是账号、权限、数据范围、字段策略和业务事实的唯一来源。

首期完成后，用户可以询问：

- “查询我本月待处理的客户报备。”
- “列出我负责的商机和当前阶段。”
- “查看这个报价和订单的摘要。”
- “查询已发布的产品和套餐。”
- “打开这个对象在 V3 中的详情页面。”

同一个问题由不同人员提出时，返回结果不得超出各自权限；当身份、角色、数据范围或字段权限不同时，结果应按授权产生差异：

| 人员 | 默认可见范围 | 默认限制 |
| --- | --- | --- |
| 内部普通员工 | 本人负责或现有权限允许的业务对象 | 不得查看非授权组织、区域和渠道 |
| 内部区域管理员 | 授权区域及下级范围 | 不得跨未授权区域 |
| 内部平台管理员 | MCP 配置、工具、审计和运行状态；业务数据仍按显式授权 | 不因平台身份自动获得业务全量 |
| 渠道员工 | 本人负责的报备、商机、报价、订单及产品公开字段 | 不得查看其他渠道和内部敏感字段 |
| 渠道管理员 | 本渠道或明确授权的渠道树 | 不得跨渠道查看 |
| 审计人员 | MCP 调用、拒绝和配置审计摘要 | 不默认查看业务正文 |

回答必须附带查询范围摘要、时间范围、数据更新时间、脱敏说明和必要的 V3 详情链接。所有业务办理仍回到 V3 正式页面完成。

---

## 3. 冻结范围和不做清单

### 3.1 首期开放

首期开放以下十个只读工具：

1. `v3_current_context`
2. `v3_product_search`
3. `v3_registration_list`
4. `v3_registration_get`
5. `v3_opportunity_list`
6. `v3_opportunity_get`
7. `v3_quote_list`
8. `v3_quote_get`
9. `v3_order_list`
10. `v3_order_get`

### 3.2 首期禁止

首期不得注册或实现以下能力：

- 创建、修改、删除报备、商机、报价和订单。
- 审批、驳回、确认收款、核销、冲销、领取、分配、回收和转移。
- 批量导出、文件下载、合同正文、附件正文和收款凭证。
- 任意 SQL、任意表名、任意字段名、原始过滤表达式和原始接口路径透传。
- 服务器文件读取、命令执行、数据库结构浏览和密钥读取。
- 通过提示词、工具参数或客户端请求头覆盖用户、角色、渠道、区域和数据范围。
- 建立独立业务账号、独立业务角色或共享超级管理员账号。

---

## 4. MCP规范和本项目实现约束

### 4.1 必须遵守的规范

- 采用 MCP `2026-07-28` 规范和官方 TypeScript SDK v2。
- 每个请求使用 JSON-RPC 2.0，并在请求 `_meta` 中携带协议版本、客户端信息和客户端能力。
- 服务端必须实现 `server/discover`。
- 服务端开放工具时必须声明 `tools` 能力，并实现 `tools/list` 和 `tools/call`。
- `tools/list` 可以根据请求中携带的授权返回不同工具，但不能代替 `tools/call` 的再次鉴权。
- 工具列表必须按稳定顺序返回，工具输入必须是严格 JSON Schema，未知字段默认拒绝。
- 首期不实现 Resources、Prompts、Roots、Tasks 和 MCP Apps。

### 4.2 传输方式

| 场景 | 传输 | 规则 |
| --- | --- | --- |
| 赤兔 RedClaw 本地验收 | stdio | RedClaw 启动独立进程；标准输出只能写合法 MCP 消息，日志写标准错误 |
| 本地远程联调 | Streamable HTTP | 业务请求使用单一 POST 端点；只绑定 `127.0.0.1`；仅测试开关允许启用 |
| 生产或测试环境远程访问 | Streamable HTTP | HTTPS、OAuth 2.1、PKCE、受保护资源元数据、Origin 校验和客户端白名单 |

首期 Streamable HTTP 不实现旧版独立 GET/SSE 会话和服务器主动通知流；业务请求统一走单一 POST 端点。服务端不依赖连接状态、进程状态或协议会话编号判断用户身份；每次请求都重新校验授权。若后续需要通知流，必须按同一规范单独设计和验收。

生产远程端点必须满足：

- 所有 POST 请求带 `MCP-Protocol-Version`，且与请求体 `_meta.io.modelcontextprotocol/protocolVersion` 一致。
- 校验 `Mcp-Method`、`Mcp-Name` 和请求体方法、工具名称的一致性。
- 校验 `Origin` 和受控 `Host`，非法来源返回 403。
- 401 时返回包含 `resource_metadata` 的 `WWW-Authenticate`。
- 工具请求响应可为 `application/json` 或请求范围内的 `text/event-stream`。
- 反向代理关闭缓冲时设置 `X-Accel-Buffering: no`。

### 4.3 官方依赖

生产首期只引入官方 SDK 作为 MCP 运行依赖，版本锁定如下（2026-08-31 核验）：

- `@modelcontextprotocol/server@2.0.0`：服务端和工具注册，stdio 传输从其 `/stdio` 子路径导入。
- `@modelcontextprotocol/node@2.0.0`：仅在使用原生 Node `IncomingMessage`/`ServerResponse` 的 Streamable HTTP 时引入。
- `@modelcontextprotocol/express@2.0.0`：仅在决定使用 Express 适配器时引入；与 `@modelcontextprotocol/node` 二选一，不同时引入。
- `zod@4.5.4`：仅在 `apps/mcp` 内使用 Zod 4；不得推动全仓 Zod 3 升级。若安装时上游已发布更高补丁版本，必须同步更新软件物料清单和兼容测试记录。

安装依赖时必须：

1. 使用精确版本，禁止生产依赖使用未锁定的浮动版本。
2. 本需求统一使用根 `package.json` 声明的 npm 版本和 npm 工作区；只更新根 `package-lock.json`，不在 `apps/mcp` 新建子目录锁文件，不更新仓库现有 pnpm 文件，也不新增 Yarn 配置。
3. 生成软件物料清单，记录许可证、版本、完整性校验值和来源。
4. 不直接复制第三方 MCP 仓库代码；GitHub 参考项目只用于设计模式。

---

## 5. 总体架构和边界

```text
赤兔 RedClaw / 受控 MCP 客户端
          │
          │ stdio（本地）或 HTTPS Streamable HTTP（远程）
          ▼
      apps/mcp
          │ 只负责协议、工具、输入输出、限流和调用编排
          │ 不连接数据库，不保存业务角色，不执行写操作
          ▼
  apps/api 内部 MCP 只读接口
          │ 校验服务身份、用户授权、账号状态、业务权限、数据范围、字段策略
          ▼
  V3 现有领域查询服务 / 受控分析视图
          ▼
       PostgreSQL
```

组件职责：

| 组件 | 必须负责 | 明确禁止 |
| --- | --- | --- |
| `apps/mcp` | MCP协议、stdio、Streamable HTTP、工具注册、参数校验、限流、错误转换和审计调用 | 直接连接数据库、拼接SQL、判断业务状态、使用超级管理员账号 |
| `apps/api` | 可信身份解析、权限、数据范围、字段脱敏、固定查询、V3链接和审计落库 | 信任客户端自报用户、角色、范围或工具结果 |
| `packages/contracts` | 工具输入输出、错误码、版本和字段字典 | 实现业务查询和权限计算 |
| `packages/config` | 开关、地址、超时、限流和密钥配置校验 | 提供不安全默认值 |
| `apps/worker` | 后续指标刷新和评测任务；首期不参与简单查询 | 与MCP共用关键业务并发池 |
| PostgreSQL | V3业务事实和受控MCP审计元数据 | 接受MCP任意SQL或业务写入 |

### 5.1 网络隔离

单机部署必须使用独立网络：

- `apps/mcp` 只加入 `mcp_net`，不加入 `data_net`。
- `apps/mcp` 不注入 `DATABASE_URL`、数据库密码、Redis主状态库密码和 Docker 套接字。
- PostgreSQL 和 Redis 不加入 `mcp_net`。
- `apps/mcp` 只能访问 API 的内部 MCP 路由或内部反向代理。
- API 查询如必须访问主库，使用 API 自己的独立只读连接池；MCP 进程没有数据库凭据。
- MCP 使用非根用户、只读根文件系统、最小挂载和资源上限。

---

## 6. 仓库改动清单

以下是允许的目标改动范围。开发人员不得扩大到无关业务模块。

```text
apps/mcp/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── src/
│   ├── server.ts                 # 入口和优雅停止
│   ├── config.ts                 # 环境变量解析与安全默认值
│   ├── protocol/
│   │   ├── discover.ts           # server/discover
│   │   ├── transports.ts         # stdio与Streamable HTTP
│   │   └── errors.ts              # MCP错误映射
│   ├── auth/
│   │   ├── principal.ts          # 每请求主体解析
│   │   ├── oauth.ts              # HTTP OAuth元数据与令牌校验
│   │   └── local-test.ts         # 仅测试环境的RedClaw固定用户夹具
│   ├── tools/
│   │   ├── registry.ts           # 显式工具白名单
│   │   ├── context.ts
│   │   ├── products.ts
│   │   ├── registrations.ts
│   │   ├── opportunities.ts
│   │   ├── quotes.ts
│   │   └── orders.ts
│   ├── v3-client/
│   │   ├── client.ts             # 调用API内部接口
│   │   ├── contracts.ts
│   │   └── retry.ts
│   └── audit/
│       ├── events.ts
│       └── redact.ts
└── tests/
    ├── protocol.test.ts
    ├── auth.test.ts
    ├── tools.test.ts
    ├── permissions.test.ts
    ├── redclaw-fixtures.ts
    └── redclaw-acceptance.md
```

必须同步修改：

- `scripts/run-workspaces.mjs`：把 `@lianruan/mcp` 加入构建、检查和测试工作区列表。
- `packages/contracts`：新增 MCP 契约，不修改既有契约语义。
- `packages/config`：新增 MCP 配置校验，默认关闭。
- `apps/api`：新增独立内部 MCP 只读路由和授权适配器，不改变既有对外业务路由语义。
- `database/migrations`：只新增 MCP 客户端、授权记录和调用审计元数据表，不修改 CRM 业务事实表。
- `deploy/single-server`：新增默认不启动的 MCP 服务、网络和开关。
- `AGENTS.md`：把 `apps/mcp` 纳入 V3 主线并保留本手册链接。
- `docs/V3业务平台底座与业务扩展实施交付方案.md`：同步第12项边界和阶段状态。

---

## 7. 配置规范

### 7.1 通用配置

| 配置项 | 默认值 | 生产要求 |
| --- | --- | --- |
| `V3_MCP_ENABLED` | `false` | 总开关，必须显式开启 |
| `V3_MCP_TRANSPORT` | `stdio` | 可选 `stdio`、`streamable-http` |
| `V3_MCP_HTTP_ENABLED` | `false` | 远程HTTP单独开关 |
| `V3_MCP_BIND_HOST` | `127.0.0.1` | 容器内由反向代理访问时使用内部地址 |
| `V3_MCP_PORT` | `3307` | 不与现有端口冲突 |
| `V3_MCP_API_BASE_URL` | 无 | 必填，指向 API 内部 MCP 路由 |
| `V3_MCP_SERVICE_KEY_FILE` | 无 | 必填，服务间签名密钥文件；不能写入代码和日志 |
| `V3_MCP_ALLOWED_CLIENTS` | 空 | 空表示无客户端可用，采用显式清单 |
| `V3_MCP_ALLOWED_USERS` | 空 | 生产灰度用户白名单；空表示无业务用户 |
| `V3_MCP_AUDIT_REQUIRED` | `true` | 审计不可用时拒绝业务工具调用 |
| `V3_MCP_MAX_PAGE_SIZE` | `50` | 不得超过50 |
| `V3_MCP_QUERY_TIMEOUT_MS` | `3000` | 单工具查询超时 |
| `V3_MCP_RESPONSE_MAX_BYTES` | `524288` | 512千字节 |
| `V3_MCP_RATE_LIMIT_PER_USER` | `60/min` | 由容量测试调整，不得取消 |
| `V3_MCP_MAX_CONCURRENCY` | `20` | 独立并发预算，不得占用关键业务池 |

### 7.2 HTTP授权配置

| 配置项 | 要求 |
| --- | --- |
| `V3_MCP_OAUTH_ISSUER` | V3或批准IAM授权服务器签发方 |
| `V3_MCP_OAUTH_RESOURCE` | MCP HTTPS完整资源地址 |
| `V3_MCP_OAUTH_AUDIENCE` | 与资源地址绑定，拒绝通用 `api` |
| `V3_MCP_OAUTH_SCOPES` | 按工具拆分的最小范围，例如 `mcp:connect mcp:registration:read` |
| `V3_MCP_OAUTH_JWKS_URL` | 令牌签名公钥地址或受控缓存地址 |
| `V3_MCP_OAUTH_ALLOWED_ORIGINS` | 明确的 RedClaw、反向代理和测试来源 |
| `V3_MCP_OAUTH_DCR_ENABLED` | `false`；首期不启用动态客户端注册 |

### 7.3 赤兔 RedClaw 本地测试配置

本地验收优先使用 stdio，不启动远程 OAuth。当前 `0.5.17` 设置页的录入方式如下：

1. 打开“设置”→“MCP 服务器”→“添加服务器”。
2. “名称”填写 `lianruan-v3-mcp-internal`，打开“启用此服务器”，传输选择“STDIO”。
3. “启动命令”填写 `node`；“参数”逐项填写：`/绝对路径/lianruan-crm-deploy-v3/apps/mcp/dist/server.js`、`--transport`、`stdio`。
4. “环境变量”逐项填写：`V3_MCP_ENABLED=true`、`V3_MCP_TRANSPORT=stdio`、`V3_MCP_LOCAL_TEST_MODE=true`、`V3_MCP_LOCAL_TEST_USER=internal-demo`。
5. “工具超时”填写不低于 `60` 秒；“工具允许清单”首期填写已通过验收的工具名，禁止留空后默认暴露全部工具。
6. 保存后点击服务器的“测试”或“刷新 MCP 服务器配置”，记录工具发现结果和调用结果。
7. 使用渠道测试用户时新增第二个服务器 `lianruan-v3-mcp-channel`，除 `V3_MCP_LOCAL_TEST_USER=channel-demo` 外其余配置相同；不得在同一进程中混用两个测试用户。

RedClaw 的界面字段最终会写入 `~/.aicodex/config.toml` 的 `[mcp_servers.<名称>]` 配置。字段名以本机实际版本为准，服务端只依赖 `command`、`args`、`env`、工作目录和超时的等价语义；不得因为客户端界面字段变化修改 MCP 协议或放宽服务端鉴权。

`V3_MCP_LOCAL_TEST_MODE` 和 `V3_MCP_LOCAL_TEST_USER` 只允许在 `NODE_ENV=test` 或明确的本地开发环境使用；生产启动时发现这两个配置必须直接失败。测试用户必须来自固定夹具，不能填入任意真实用户编号。

首次联调需把脱敏后的 RedClaw 实际配置、版本号和启动日志固化到验收报告。若当前版本不支持 stdio，停止阶段一验收并先补充兼容方案，不得静默切换到远程生产入口。

---

## 8. 身份、授权和权限模型

### 8.1 用户身份

首期同时支持内部人员和渠道人员，但不实现双重身份切换：

- 以 V3 当前账号的唯一有效主身份作为 MCP 身份。
- 如果账号存在多个有效身份、多个渠道成员关系或无法唯一解析主身份，MCP 拒绝业务工具调用，并提示回到 V3 完成账号归属整理。
- MCP 不接受工具参数中的 `userId`、`username`、`roleCode`、`regionId`、`partnerId`、`operatorId` 或数据范围覆盖项。
- MCP 不信任 `x-v3-delivery-user`、V2令牌或客户端自报身份作为生产身份来源。

### 8.2 授权链

```text
可信用户令牌有效
→ 客户端已登记且启用
→ 账号存在、未停用、未锁定
→ MCP接入权限通过
→ 工具所需业务读取权限通过
→ 目标资源位于该用户数据范围
→ 返回字段通过字段策略
→ 场景、时间、数量、超时和审计要求通过
```

任意一项失败均拒绝，不降级为匿名、共享账号、超级管理员或全量范围。

### 8.3 MCP权限代码

新增权限代码建议固定为：

- `integration.mcp.connect`
- `integration.mcp.client.manage`
- `integration.mcp.tool_policy.manage`
- `integration.mcp.audit.read`
- `integration.mcp.operations.read`
- `integration.mcp.product.read`
- `integration.mcp.registration.read`
- `integration.mcp.opportunity.read`
- `integration.mcp.quote.read`
- `integration.mcp.order.read`

业务工具必须同时满足 MCP 权限和原业务域读取权限。例如：

```text
查询报价 = integration.mcp.connect
         + integration.mcp.quote.read
         + V3原有报价读取权限
         + 当前用户报价数据范围
```

超级管理员也必须满足显式业务读取权限和显式数据范围。

### 8.4 数据范围

每个资源单独计算范围：

| 资源 | 范围计算原则 |
| --- | --- |
| 报备 | 本人、负责人、渠道、区域和保护主体的授权交集 |
| 商机 | 本人、团队、渠道和区域的授权交集 |
| 报价 | 本人、商机、渠道、区域和价格权限的授权交集 |
| 订单 | 本人、报价、渠道和区域的授权交集 |
| 产品 | 已发布产品和当前用户产品读取权限 |

范围必须在数据库查询条件或已批准分析视图中执行，禁止先读取全量再由 MCP 或模型过滤。

### 8.5 字段策略

| 字段类别 | 首期策略 |
| --- | --- |
| 编号、名称、状态、时间 | 按资源权限返回 |
| 负责人、渠道、区域、进度摘要 | 按当前角色返回最少字段 |
| 联系人、手机、邮箱 | 默认脱敏；只返回掩码或是否存在 |
| 报价金额、订单金额 | 按现有业务字段权限返回；无权限隐藏 |
| 成本价、底价、完整折扣 | 默认隐藏 |
| 合同正文、附件、收款凭证 | 不返回内容，仅返回 V3 受控链接或固定拒绝 |

字段脱敏必须在 API 服务端结构化输出阶段完成，不能依赖模型提示词。

---

## 9. 工具契约

### 9.1 通用输入约束

所有列表工具使用以下输入结构：

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "keyword": { "type": "string", "maxLength": 100 },
    "status": { "type": "string", "maxLength": 50 },
    "from": { "type": "string", "format": "date" },
    "to": { "type": "string", "format": "date" },
    "cursor": { "type": "string", "maxLength": 256 },
    "limit": { "type": "integer", "minimum": 1, "maximum": 50, "default": 20 }
  }
}
```

服务端必须校验：

- `from` 不得晚于 `to`。
- 默认时间范围不超过30天，工具另有配置时按更小值执行。
- `limit` 超过50直接返回参数错误，不自动放大或循环翻页。
- 查询文本长度、游标长度和状态值必须符合工具字典。
- 输入对象中的未知字段直接拒绝。

详情工具统一使用：

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["id"],
  "properties": {
    "id": { "type": "string", "minLength": 1, "maxLength": 100 }
  }
}
```

### 9.2 工具登记表

| 工具 | 所需权限 | 输入 | 输出边界 |
| --- | --- | --- | --- |
| `v3_current_context` | `integration.mcp.connect` | 空对象 | 用户显示名、人员类型、主组织、主渠道、权限摘要；不返回完整权限明细 |
| `v3_product_search` | MCP接入、产品读取 | 通用列表输入 | 已发布产品、功能、硬件和套餐公开字段 |
| `v3_registration_list` | MCP接入、报备读取 | 通用列表输入 | 分页报备摘要和脱敏负责人、渠道、区域 |
| `v3_registration_get` | MCP接入、报备读取 | `id` | 单条报备摘要、状态、时间和 V3 链接 |
| `v3_opportunity_list` | MCP接入、商机读取 | 通用列表输入 | 分页商机摘要和阶段 |
| `v3_opportunity_get` | MCP接入、商机读取 | `id` | 单条商机摘要和 V3 链接 |
| `v3_quote_list` | MCP接入、报价读取 | 通用列表输入 | 报价摘要；金额按字段权限处理 |
| `v3_quote_get` | MCP接入、报价读取 | `id` | 报价摘要；隐藏成本、底价和附件正文 |
| `v3_order_list` | MCP接入、订单读取 | 通用列表输入 | 订单编号、状态、时间和允许展示的金额摘要 |
| `v3_order_get` | MCP接入、订单读取 | `id` | 订单摘要和 V3 链接，不改变状态 |

### 9.3 通用输出结构

所有列表工具输出必须包含：

```json
{
  "requestId": "req_xxx",
  "toolCode": "v3_registration_list",
  "toolVersion": "1.0.0",
  "dataAsOf": "2026-08-31T10:20:00.000Z",
  "scopeSummary": "本人负责范围",
  "items": [],
  "pageInfo": {
    "nextCursor": null,
    "hasNext": false,
    "truncated": false
  },
  "maskedFields": ["contactPhone", "contactEmail"],
  "source": "V3客户报备",
  "v3Link": "/admin.html"
}
```

金额使用字符串十进制格式，不使用浮点数；日期使用 ISO 8601；空结果返回空数组和明确的 `dataAsOf`，不得编造结果。

---

## 10. API内部接口契约

### 10.1 内部路由

以下接口只允许来自 `apps/mcp` 的内部服务请求，不对公网代理。表中路径是本手册的稳定逻辑路径；实际挂载时必须服从 `apps/api` 现有内部路由前缀和反向代理规则，并通过契约测试证明调用路径等价，禁止为了 MCP 改写既有公开业务路由：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/internal/mcp/context` | 解析用户主身份、账号状态和权限摘要 |
| `POST` | `/internal/mcp/products/search` | 查询产品公开字段 |
| `POST` | `/internal/mcp/registrations/search` | 查询报备列表 |
| `POST` | `/internal/mcp/registrations/get` | 查询报备摘要 |
| `POST` | `/internal/mcp/opportunities/search` | 查询商机列表 |
| `POST` | `/internal/mcp/opportunities/get` | 查询商机摘要 |
| `POST` | `/internal/mcp/quotes/search` | 查询报价列表 |
| `POST` | `/internal/mcp/quotes/get` | 查询报价摘要 |
| `POST` | `/internal/mcp/orders/search` | 查询订单列表 |
| `POST` | `/internal/mcp/orders/get` | 查询订单摘要 |

### 10.2 请求封装

请求必须包含：

- `Authorization`：服务间认证令牌，仅证明请求来自 `apps/mcp`，不能代替用户身份。
- `X-V3-MCP-Principal`：由 MCP 根据用户授权令牌生成的服务端签名主体断言；API 只接受有效签名，不接受客户端直传的明文用户字段。
- `X-Request-Id`：与 MCP 审计请求编号一致。
- 请求体：只包含工具允许的业务过滤字段，不包含用户、角色、范围覆盖字段。

主体断言至少包含：

```json
{
  "iss": "v3-mcp",
  "aud": "v3-api-mcp-internal",
  "sub": "iam-user-id",
  "clientId": "redclaw-local",
  "authorizationVersion": 12,
  "issuedAt": 1788160000,
  "expiresAt": 1788160060,
  "requestId": "req_xxx",
  "jti": "nonce_xxx"
}
```

主体断言有效期不超过60秒，API 每次调用重新读取账号状态、权限角色、数据范围和字段策略。`sub` 只能由服务端签名产生，不能从工具参数复制。

### 10.3 API查询要求

- API 查询使用固定 SQL 或批准的查询服务，不接收任意 SQL。
- 数据范围条件必须进入查询条件，禁止全量查询后内存过滤。
- 详情查询先执行对象范围条件，再返回保护性 404。
- 查询超时、结果行数、响应大小和连接池必须单独限制。
- API 负责最终字段脱敏和 V3 链接生成。
- API 将成功、拒绝、超时、限流和异常写入 MCP 调用审计。

---

## 11. 错误码和拒绝体验

### 11.1 MCP协议错误

至少正确处理：

| 情况 | 协议或HTTP错误 |
| --- | --- |
| 方法不存在 | JSON-RPC `-32601` |
| 请求结构错误 | JSON-RPC `-32602` |
| 协议版本不支持 | `-32022`，返回支持版本列表 |
| HTTP头与请求体不一致 | `-32020`，HTTP 400 |
| 未授权 | HTTP 401，并返回授权发现地址 |
| 授权范围不足 | HTTP 403，并返回最小必要范围提示 |
| 非法来源 | HTTP 403 |

### 11.2 V3业务错误

建议统一使用以下中文错误代码：

- `MCP_DISABLED`：MCP 总开关关闭。
- `MCP_CLIENT_NOT_ALLOWED`：客户端未登记或未启用。
- `MCP_AUTH_REQUIRED`：需要重新授权。
- `MCP_USER_DISABLED`：当前账号不可用。
- `MCP_CONTEXT_NOT_UNIQUE`：用户主身份无法唯一解析。
- `MCP_TOOL_NOT_ALLOWED`：当前账号未获该工具权限。
- `MCP_SCOPE_DENIED`：目标不在当前数据范围。
- `MCP_FIELD_MASKED`：部分字段受权限保护。
- `MCP_QUERY_LIMIT_EXCEEDED`：请缩小查询范围或分页。
- `MCP_AUDIT_UNAVAILABLE`：审计不可用，工具拒绝执行。
- `MCP_RATE_LIMITED`：调用频率超过限制。
- `MCP_SERVICE_BUSY`：MCP 服务繁忙，请稍后重试。

错误消息不得返回数据库错误、堆栈、表名、字段名、内部地址、令牌、密钥或目标对象是否存在的敏感信息。

---

## 12. 三阶段开发计划

### 阶段一：协议骨架与 RedClaw 模拟验收

目标：不读取真实业务数据，完成可启动、可停止、可被 RedClaw 发现和调用的 MCP 服务。

开发任务：

1. 新增 `apps/mcp` 工作区、构建、检查和测试脚本。
2. 接入官方 SDK v2，锁定协议版本 `2026-07-28`。
3. 实现 `server/discover`、`tools/list`、`tools/call`。
4. 实现 stdio；实现 Streamable HTTP 但默认关闭。
5. 注册三个模拟工具：当前身份摘要、产品搜索、报备列表。
6. 实现配置校验、总开关、客户端白名单、请求编号和标准错误输出。
7. 实现 Origin、Host、协议头和请求体一致性校验。
8. 提供 RedClaw 配置示例和固定内部、渠道测试用户夹具。

阶段退出条件：

- MCP 进程可独立启动和停止。
- RedClaw 能发现三个模拟工具并完成调用。
- 标准输出没有非 MCP 日志。
- MCP 关闭时无任何业务工具可见。
- 代码和运行时没有数据库驱动、数据库地址和数据库密码。
- 协议测试、工具输入校验和错误测试全部通过。

### 阶段二：V3可信授权与真实只读工具

目标：先完成权限收口，再接入真实 V3 业务只读工具。

前置安全任务：

1. OpenAPI 查询传入绑定用户上下文。
2. 空用户上下文对受保护资源默认拒绝。
3. 隔离 V2 令牌、兼容请求头和 `operatorId` 等不可信身份来源。
4. 确定 `iam.data_scope_bindings` 的唯一运行时事实来源，并完成影子比对。
5. OpenAPI 资源未配置时改为无资源，不回退为 `*`；完成存量客户端影响核查。
6. 完成内部、渠道、区域、本人和跨范围负向测试。

真实 MCP 实施任务：

1. 实现逐用户授权、账号状态、授权版本和主身份唯一性检查。
2. 实现 MCP 权限代码与既有业务读取权限的组合校验。
3. 实现 API 内部 MCP 路由、主体断言、固定查询和字段脱敏。
4. 按顺序开放产品、报备、商机、报价、订单工具。
5. `tools/list` 按权限过滤，`tools/call` 再次完整鉴权。
6. 实现分页、时间范围、响应大小、超时、限流、截断和审计。
7. 在 RedClaw 中分别使用内部测试用户和渠道测试用户验证差异结果。

阶段退出条件：

- 未登录、停用账号、过期令牌、伪造主体全部拒绝。
- 不同内部和渠道用户工具列表不同，调用结果符合各自范围。
- 跨区域、跨渠道、跨人员对象无法读取。
- 敏感字段脱敏和保护性 404 行为稳定。
- 阶段二权限修复作为独立提交、独立测试和独立发布完成。
- V3 登录、四套正式页面、报备、商机、报价、订单和 Worker 回归通过。

### 阶段三：隔离部署、RedClaw验收与灰度交付

目标：证明 MCP 可以独立运行、独立停止、独立回退，并且不影响 V3 主业务。

开发和运维任务：

1. 完成 MCP 独立镜像、Compose 服务、网络、资源限制和非特权用户。
2. 配置 Streamable HTTP、HTTPS、OAuth 2.1、PKCE、资源元数据和来源白名单。
3. 配置审计、限流、熔断、健康检查、诊断和告警。
4. 使用 RedClaw 完成全量本地验收；其他客户端只做协议兼容观察，不纳入首期承诺。
5. 生产环境部署但保持关闭，按用户白名单开放 2 至 5 名试点人员。
6. 完成 MCP 压力测试、主业务基线比较、故障演练和一键关闭演练。
7. 输出镜像、配置模板、迁移脚本、升级包、校验值、验收报告和回退说明。

阶段退出条件：

- MCP 关闭、停止或容器删除后，V3 主业务完全正常。
- MCP 容器无法访问 PostgreSQL 网络和 Docker 套接字。
- RedClaw 工具发现、调用、拒绝、分页和错误体验全部通过。
- 越权工具、记录、字段、业务写入和未审计调用均为零。
- 主业务接口性能劣化不超过已确认阈值，初始警戒值为5%。
- 升级、停止、启动、诊断和回退演练均成功。

---

## 13. 赤兔 RedClaw 验收方案

### 13.1 验收前准备

本次文档更新已完成 RedClaw `0.5.17` 的客户端能力核验，但仓库当前尚未创建 `apps/mcp` 可执行产物，因此不宣称业务工具已经验收通过。阶段一完成后，必须使用下列材料在同一版本 RedClaw 中复测并填写记录。

开发人员必须提供：

- 可执行的 `apps/mcp/dist/server.js`。
- RedClaw 配置示例，路径使用绝对路径。
- 内部测试用户夹具和渠道测试用户夹具。
- 模拟数据和真实测试数据库两套配置。
- 工具清单导出文件和版本号。
- 一键启动、停止和清理命令。

推荐命令：

```bash
npm --workspace @lianruan/mcp run build
npm --workspace @lianruan/mcp run test
npm --workspace @lianruan/mcp run test:protocol
npm --workspace @lianruan/mcp run test:redclaw
```

### 13.2 RedClaw 验收用例

| 编号 | 测试内容 | 预期结果 |
| --- | --- | --- |
| RC-01 | 启动内部测试用户服务 | 发现允许的工具，服务无标准输出污染 |
| RC-02 | 启动渠道测试用户服务 | 工具列表与内部用户不同 |
| RC-03 | 调用 `v3_current_context` | 返回测试用户类型和主身份摘要 |
| RC-04 | 调用产品搜索 | 只返回已发布产品公开字段 |
| RC-05 | 内部用户查询报备 | 只返回本人或授权组织范围 |
| RC-06 | 渠道用户查询报备 | 只返回本人或本渠道范围 |
| RC-07 | 渠道甲读取渠道乙编号 | 返回保护性 404，不泄露对象存在性 |
| RC-08 | 普通员工读取他人对象 | 返回保护性 404 |
| RC-09 | 无业务读取权限调用工具 | 工具不可见，直接调用返回拒绝 |
| RC-10 | 伪造 `userId`、`operatorId` 和角色参数 | 参数拒绝或忽略，授权结果不改变 |
| RC-11 | 返回联系方式 | 手机、邮箱和联系人脱敏 |
| RC-12 | 查询成本价和底价 | 字段隐藏，不返回替代明文 |
| RC-13 | 请求超过50条 | 返回 `MCP_QUERY_LIMIT_EXCEEDED` |
| RC-14 | 查询时间超过配置上限 | 返回缩小时间范围提示 |
| RC-15 | 使用未知输入字段 | 返回参数错误 |
| RC-16 | 停用测试用户后再次调用 | 立即或约定时间内拒绝 |
| RC-17 | 关闭 `V3_MCP_ENABLED` | RedClaw无法发现业务工具 |
| RC-18 | MCP进程异常退出 | RedClaw显示服务不可用，V3主业务不受影响 |
| RC-19 | 审计服务不可用 | 业务工具拒绝，不无审计放行 |
| RC-20 | 连续高并发调用 | MCP限流或熔断，不拖慢主业务 |

### 13.3 RedClaw 验收记录

验收记录至少保存：

- RedClaw版本、操作系统、Node.js版本和 MCP 版本。
- 使用的测试用户、客户端名称和配置摘要。
- 每个用例的请求编号、工具版本、结果状态和耗时。
- 允许返回的字段、脱敏字段和数据更新时间。
- 截图或结构化输出，不保存令牌、密钥和完整敏感数据。
- 失败原因、修复提交、复测结果和验收人。

---

## 14. 测试和质量门禁

### 14.1 测试层次

| 层次 | 必测内容 |
| --- | --- |
| 单元测试 | 配置、安全默认值、工具过滤、输入校验、字段脱敏、错误映射 |
| 契约测试 | 工具名称、版本、JSON Schema、输出结构、未知字段拒绝 |
| 协议测试 | `server/discover`、`tools/list`、`tools/call`、版本错误、请求头一致性、stdio和HTTP |
| 集成测试 | API内部路由、主体断言、账号状态、权限、数据范围、分页和审计 |
| 越权测试 | 跨人员、跨区域、跨渠道、跨组织、详情编号猜测、字段泄露 |
| 安全测试 | 令牌重放、受众错误、来源错误、Origin、Host、提示注入、请求伪造 |
| 性能测试 | 单用户、单客户端、全局并发、慢查询、连接池、限流和熔断 |
| 回归测试 | 登录、统一入口、四套正式页面、报备、商机、报价、订单和 Worker |
| 部署测试 | 开关、镜像、网络隔离、HTTPS、健康、日志、升级、停止和回退 |

### 14.2 强制指标

以下任一指标不达标，不得开放真实业务工具：

- 越权工具可见：0。
- 越权工具执行：0。
- 越权记录泄露：0。
- 越权字段泄露：0。
- MCP业务写入：0。
- 未审计调用：0。
- 明文令牌、密钥和密码日志：0。
- MCP关闭时仍可调用业务工具：0。
- MCP故障导致主业务不可用：0。
- 现有主业务回归失败：0。

---

## 15. 审计、监控和告警

### 15.1 调用审计字段

每次连接、工具发现和工具调用至少记录：

- 请求编号、MCP会话标识（仅作应用追踪，不作为权限依据）。
- 用户编号、账号状态、主身份摘要和授权版本。
- 客户端编号、来源地址、工具名称、工具版本和工具集版本。
- 输入字段名称、参数摘要或哈希，不保存不必要的敏感值。
- 使用的权限代码、数据范围类型和字段策略版本。
- 返回数量、截断标记、脱敏字段、数据快照时间、耗时和响应大小。
- 成功、拒绝、限流、超时、熔断和异常错误代码。

禁止记录：

- 访问令牌、刷新令牌、授权码、服务密钥和数据库密码。
- 完整联系人、合同正文、附件正文和收款凭证。
- 完整模型对话、完整工具返回和未脱敏数据库异常。

### 15.2 监控指标

- MCP进程存活、启动失败、连接数和异常退出数。
- 每个用户、客户端和工具的调用量、拒绝率、耗时和响应大小。
- 401、403、保护性404、限流和熔断数量。
- API内部路由耗时、数据库查询耗时和连接使用量。
- 工具列表数量、结果截断次数和字段脱敏次数。
- MCP开启前后的主业务接口响应分位值、错误率和数据库资源使用量。

审计写入失败时，业务工具必须拒绝执行；MCP自身健康接口可以返回故障，但不得影响 V3 主业务。

---

## 16. 部署、灰度和回退

### 16.1 Compose部署要求

MCP服务必须使用独立 Compose 服务并默认不启动：

```yaml
services:
  mcp:
    profiles: ["mcp"]
    environment:
      V3_MCP_ENABLED: "false"
      V3_MCP_HTTP_ENABLED: "false"
    networks:
      - mcp_net
    read_only: true
    user: "10001:10001"
    security_opt:
      - no-new-privileges:true
```

实际 Compose 文件必须补齐健康检查、内存、处理器、进程数、临时目录和日志限制；不能复制旧 V2 服务配置。

### 16.2 灰度顺序

1. 本地 RedClaw 模拟数据。
2. 测试环境多角色真实权限和脱敏数据。
3. 生产部署但保持总开关关闭。
4. 开放两至五名内部和渠道试点用户。
5. 按人员逐步扩大，不按角色一次性全开。
6. 稳定后再评估其他客户端；首期不扩展写能力。

### 16.3 一键停止和回退

发生越权、字段泄露、身份映射错误、异常负载或审计故障时：

1. 设置 `V3_MCP_ENABLED=false`。
2. 关闭 Nginx MCP 路径并停止 MCP 容器。
3. 撤销 MCP 授权记录和客户端令牌。
4. 保留审计和诊断证据。
5. 检查 V3 API、Worker、四套正式页面和数据库主业务健康。

回退只允许回退 MCP 镜像、工具版本和 MCP 内部接口兼容版本；不回退 CRM 业务数据、不回退业务状态、不删除审计记录。

---

## 17. 开发交付物和完成定义

开发团队必须交付：

1. `apps/mcp` 源码、构建产物、单元测试和协议测试。
2. `packages/contracts` MCP 工具与错误契约。
3. `apps/api` MCP 内部只读接口、授权适配器和权限测试。
4. 数据库向前兼容迁移和迁移验证记录。
5. RedClaw 配置示例、固定用户夹具和验收报告。
6. Docker 镜像、Compose、网络隔离和环境变量模板。
7. HTTPS、授权发现、限流、监控、告警和诊断说明。
8. 升级包、外层校验值、包内校验、脚本语法检查和回退步骤。
9. 权限矩阵、字段字典、工具清单和版本变更记录。
10. 已知边界、故障联系人和试点退出条件。

一项能力只有同时满足以下条件才算完成：

- 产品范围、工具语义、权限、字段和错误规则已写入契约。
- 代码、测试、审计、监控、部署和回退全部完成。
- RedClaw 正向、负向、越权、异常和关闭测试全部通过。
- 真实数据查询使用 V3 运行时身份和数据范围，不存在共享账号。
- 生产工具清单中没有写工具、任意 SQL、文件工具和命令工具。
- MCP关闭或停止后主业务回归通过。
- 默认开关关闭，灰度用户和工具白名单可以独立控制。

---

## 18. 当前项目阻断项

在阶段二接入真实业务前，必须独立完成以下事项：

- `apps/api/src/business-routes.ts` 的开放查询传入绑定用户上下文。
- `apps/api/src/business-store.ts` 的空用户上下文改为受保护资源默认拒绝。
- 一般业务路由隔离 V2 令牌、兼容请求头和 `operatorId` 身份来源。
- 将 `iam.data_scope_bindings` 接入唯一运行时数据范围计算，并完成影子比对。
- 将开放接口资源未配置时的 `*` 回退改为默认无资源，完成存量客户端核查。
- 现有生产入口仍为 HTTP 时，远程 MCP 不得开放；必须先完成 HTTPS 或置于企业 HTTPS 反向代理之后。

这些事项属于 V3 权限和身份底座修复，必须独立提交、独立测试、独立发布，不得与 MCP 业务工具混成一个不可回退的大包。

---

## 19. 参考资料

- [MCP 2026-07-28规范](https://modelcontextprotocol.io/specification/2026-07-28)
- [MCP Streamable HTTP传输](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP授权规范](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [官方 TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [V3 MCP受控业务能力产品设计与开发落地方案](V3%20MCP受控业务能力产品设计与开发落地方案.md)
- [V3业务平台底座与业务扩展实施交付方案](V3业务平台底座与业务扩展实施交付方案.md)
