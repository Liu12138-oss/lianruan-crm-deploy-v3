# V3 受控只读 MCP 三阶段落地设计

## 1. 目标

在不改变现有 V3 业务行为和业务流程的前提下，建设独立、默认关闭、受控只读的 MCP 协议服务。内部人员和渠道人员通过经批准的 MCP 客户端查询本人原本有权查看的产品、报备、商机、报价和订单摘要。

MCP 只负责协议适配、工具注册、参数校验、调用编排和审计事件上报；业务事实、身份、权限、数据范围、字段策略和审计落库仍由 V3 API 负责。

## 2. 交付范围

三阶段全部实施：

1. 阶段一：协议骨架、stdio、默认关闭的 Streamable HTTP、三个模拟工具和 RedClaw 协议验收。
2. 阶段二：身份权限前置门禁、V3 可信授权、十个真实只读工具和 API 内部接口。
3. 阶段三：独立镜像、Compose、网络隔离、HTTPS-ready 配置、审计监控、压力测试、灰度、停止和回退。

## 3. 冻结业务工具

首期只注册十个工具：

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

所有工具只读，不接受用户、角色、区域、渠道、`operatorId` 或数据范围覆盖字段。工具名称、输入、输出、权限要求、字段边界和错误码版本化维护在 `packages/contracts`。

## 4. 规范和协议

1. 协议版本固定为 MCP `2026-07-28`。
2. 使用 TypeScript SDK v2，生产依赖精确锁版本并在 `apps/mcp` 内隔离 Zod 4。
3. 正式协议为 `2026-07-28`，服务端实现 `server/discover`、`tools/list` 和 `tools/call`。stdio 入口使用 SDK 双时代模式，同时兼容赤兔 0.5.22 的 2025-era `initialize` 握手；Streamable HTTP 保持现代协议，不开放旧协议回退。
4. stdio 的 stdout 只允许合法 MCP 消息，日志只写 stderr。
5. Streamable HTTP 只提供单 POST 端点；本机 HTTP 只绑定 `127.0.0.1`，外部 HTTPS 就绪前不开放 MCP 路径。
6. 每个请求校验协议版本、客户端信息、客户端能力和工具调用元数据。HTTP 校验 `MCP-Protocol-Version`、`Mcp-Method`、`Mcp-Name`、`Origin` 和受控 Host。
7. `tools/list` 按稳定顺序返回并接受授权过滤；`tools/call` 每次完整复核身份、权限、范围、字段和审计。

## 5. 工具元数据

1. 十个只读工具全部声明 `annotations.readOnlyHint: true`、`destructiveHint: false`、`idempotentHint: true`、`openWorldHint: false`。
2. 每个工具提供严格 `inputSchema`，未知字段拒绝；列表工具限制分页、时间范围和状态字典。
3. 每个工具提供版本化 `outputSchema`，业务结果通过 `structuredContent` 返回。
4. 结构化结果同时保留序列化 TextContent，兼容不以结构化内容为主的客户端。
5. 协议结果层的 `resultType: "complete"` 由 SDK v2 生成并纳入协议测试。
6. `server/discover` 和 `tools/list` 显式配置 `ttlMs`、`cacheScope`。依赖用户授权的工具列表使用 `ttlMs: 0` 或 `cacheScope: "private"`，不得公共缓存。
7. 工具执行错误返回 `isError: true`；协议结构错误、未知工具、版本错误和未授权按标准 JSON-RPC 或 HTTP 状态处理。

## 6. 身份和授权

允许一次工具调用必须同时满足：

```text
服务端解析出唯一有效主身份
且 客户端已登记且启用
且 账号有效且授权版本有效
且 MCP接入和工具层默认授权有效
且 V3原业务读取权限通过
且 对象在当前数据范围
且 字段通过现有角色字段权限
且 限流、分页、超时和审计允许
```

决策补充：

1. MCP 接入和十个已评审工具默认向所有有效 V3 账号开放，不额外要求逐人、逐工具白名单。
2. `integration.mcp.*` 权限代码继续保留，用于紧急撤权、工具停用和管理能力控制。
3. MCP 默认授权不扩大任何业务权限、数据范围和字段权限。
4. 超级管理员没有隐藏的业务全量绕过。
5. 主身份不唯一时业务工具不可调用。

## 7. 数据访问

固定采用以下链路：

```text
RedClaw / 受控客户端
        ↓ stdio 或 Streamable HTTP
apps/mcp
        ↓ 签名主体断言和内部只读接口
apps/api
        ↓ 现有领域服务或受控只读视图
PostgreSQL
```

1. MCP 不直接连接任何数据库。
2. MCP 容器不注入 `DATABASE_URL`、数据库密码、Redis 主状态库密码、Docker 套接字或其他业务凭据。
3. API 负责最终字段脱敏、保护性 404、V3 链接生成和审计落库。
4. 数据范围条件必须进入数据库查询或批准的只读视图，禁止全量查询后由 MCP 或模型过滤。
5. API 内部路由不对公网代理。

## 8. 字段和敏感数据

1. 不新增 MCP 专属业务字段密级，直接复用 V3 角色字段权限。
2. 无字段权限时隐藏或脱敏，无法判断时默认拒绝返回。
3. Token、密码、私钥、服务密钥、API Key、OAuth 授权码、Refresh Token、Session Secret 和数据库密码对任何角色均不可读取。
4. 上述凭据不进入模型上下文、工具返回、错误详情、日志和审计原文。
5. 审计只保存指纹、哈希、`jti` 和非敏感调用元数据。

## 9. API 内部接口

逻辑路由保持：

1. `POST /internal/mcp/context`
2. `POST /internal/mcp/products/search`
3. `POST /internal/mcp/registrations/search`
4. `POST /internal/mcp/registrations/get`
5. `POST /internal/mcp/opportunities/search`
6. `POST /internal/mcp/opportunities/get`
7. `POST /internal/mcp/quotes/search`
8. `POST /internal/mcp/quotes/get`
9. `POST /internal/mcp/orders/search`
10. `POST /internal/mcp/orders/get`

请求使用服务身份、签名主体断言和请求编号。主体断言有效期不超过 60 秒，使用独立密钥、`jti` 防重放；API 每次重新读取账号状态、权限、数据范围和字段策略。

## 10. 部署和网络

1. MCP 使用独立 Compose profile，默认不启动。
2. MCP 只加入 `mcp_net`，不加入 `data_net`。
3. API 增加仅容器网络可访问的内部 MCP 路由。
4. MCP 容器使用非特权用户、只读根文件系统、临时目录和资源上限。
5. Nginx 完成 HTTPS-ready 配置：443 证书挂载、MCP 稳定路径、80 跳转或拒绝；证书就绪前不开放外部 MCP 路径。
6. 本机 Streamable HTTP 只供本地测试，不发布宿主机公网端口。

## 11. 审计、限流和可观测

1. 每次连接、工具发现、调用、拒绝、超时、限流和异常均生成请求编号。
2. 审计记录用户、客户端、工具、版本、范围摘要、字段策略版本、结果状态、耗时、响应大小和脱敏类别。
3. 审计不保存完整业务结果、模型对话、凭据和敏感正文。
4. 审计不可用时业务工具拒绝执行。
5. 单用户、客户端和工具独立限流；默认每页 20、最大 50，响应上限 512 KiB。
6. 达到超时或并发阈值时熔断并返回繁忙错误，不把压力转移到主业务 API。

## 12. 验收门禁

1. 协议、工具和权限测试全部通过，RedClaw 可以完成发现、调用、拒绝和关闭测试。
2. 未授权工具可见、越权记录、越权字段、业务写入、未审计调用、凭据泄露均为零。
3. MCP 关闭或停止后，V3 登录、页面、API、Worker 和数据库主业务完全正常。
4. MCP 容器无法访问 PostgreSQL 网络和 Docker 套接字。
5. 主业务接口性能劣化不超过评审阈值，初始警戒值为 5%。
6. HTTPS 未就绪时，外部 MCP 路径保持关闭，不把阶段三标记为生产完成。
7. 升级、启动、停止、诊断、撤权和回退演练全部成功。

## 13. 回退

1. 关闭 `V3_MCP_ENABLED`。
2. 关闭 Nginx MCP 路径并停止 MCP 容器。
3. 撤销 MCP 授权记录和客户端令牌。
4. 保留 MCP 审计和诊断证据。
5. 检查 V3 API、Worker、四套正式页面和数据库主业务健康。
6. 只回退 MCP 镜像、工具版本和内部接口兼容版本，不回退 CRM 业务数据或删除审计。
