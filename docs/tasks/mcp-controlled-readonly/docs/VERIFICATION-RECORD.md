# 验证记录：V3 受控只读 MCP 标准修订

## 1. 任务信息

- 任务标识：`mcp-controlled-readonly`
- 验证日期：2026-09-18
- 验证范围：MCP 产品设计、开发交付手册、任务级设计、任务单和决策记录
- 本轮性质：文档修订，不包含代码、数据库、生产配置或发布操作

## 2. 修订文件

- `docs/V3 MCP受控业务能力产品设计与开发落地方案.md`
- `docs/V3 MCP受控只读能力开发实施与交付手册.md`
- `docs/V3业务平台底座与业务扩展实施交付方案.md`
- `docs/tasks/mcp-controlled-readonly/DESIGN.md`（新增）
- `docs/tasks/mcp-controlled-readonly/TICKETS.md`（新增）
- `docs/tasks/mcp-controlled-readonly/docs/DECISION-LOG.md`（新增）

## 3. 已固化决策

1. 阶段一、阶段二、阶段三全部实施并分别验收。
2. 默认赤兔支持 MCP `2026-07-28`，阶段一仍执行真实协议探测。
3. 先修订标准和验收口径，再编码；不影响当前 V3 业务。
4. MCP 接入和十个评审工具默认开放，但不扩大业务权限、数据范围和字段权限。
5. 业务字段复用 V3 角色字段权限；凭据任何角色不可读取，不进入模型、返回、日志和审计。
6. MCP 不直连数据库，只调用 API 内部只读接口。
7. 外部 MCP 在 HTTPS 就绪前保持关闭，同时完成 HTTPS-ready 配置。

## 4. 标准修订内容

- 增加工具只读 annotations、inputSchema、outputSchema 和 structuredContent 要求。
- 增加协议结果层 `resultType`、`ttlMs` 和 `cacheScope` 验收要求。
- 明确用户相关 `tools/list` 使用 `ttlMs: 0` 或 `cacheScope: "private"`。
- 明确协议错误、HTTP 错误和工具执行错误的边界。
- 明确预注册客户端、Client ID Metadata Documents 演进和 DCR 废弃状态。
- 明确 MCP `2026-07-28` 协议无 `initialize` 会话，应用层授权记录不是协议会话。

## 5. 自动检查

已执行：

```bash
git diff --check -- \
  "docs/V3 MCP受控业务能力产品设计与开发落地方案.md" \
  "docs/V3 MCP受控只读能力开发实施与交付手册.md" \
  "docs/V3业务平台底座与业务扩展实施交付方案.md" \
  docs/tasks/mcp-controlled-readonly

./node_modules/.bin/prettier --check \
  "docs/V3 MCP受控业务能力产品设计与开发落地方案.md" \
  "docs/V3 MCP受控只读能力开发实施与交付手册.md" \
  "docs/V3业务平台底座与业务扩展实施交付方案.md" \
  "docs/tasks/mcp-controlled-readonly/DESIGN.md" \
  "docs/tasks/mcp-controlled-readonly/TICKETS.md" \
  "docs/tasks/mcp-controlled-readonly/docs/DECISION-LOG.md" \
  "docs/tasks/mcp-controlled-readonly/docs/VERIFICATION-RECORD.md"
```

结果：

- `git diff --check`：通过，无空白错误。
- `prettier --check`：通过，所有文件符合当前格式。
- 业务代码、数据库、生产配置和发布包：未修改。

## 6. 后续门禁

- `MCP-00` 已完成。
- `MCP-01` 至 `MCP-07` 仍为待实施。
- 是否开始编码、修改数据库、部署或发布，必须由用户后续明确指令触发。
- `P0-A` 未完成前不得注册真实 MCP 业务工具。

## 7. MCP-01 协议骨架验证

实施日期：2026-09-18。

新增应用：

- `apps/mcp`，工作区名称 `@lianruan/mcp`。

已实现：

- MCP `2026-07-28`、`server/discover`、`tools/list` 和 `tools/call`。
- stdio 和本机 Streamable HTTP 骨架。
- 三个模拟工具：`v3_current_context`、`v3_product_search`、`v3_registration_list`。
- 工具只读 annotations、严格输入输出 Schema、结构化内容和安全缓存提示。
- 默认关闭、本地测试夹具、回环地址限制和外部 HTTPS 前置门禁。

已执行：

```bash
npm --workspace @lianruan/mcp run check
npm --workspace @lianruan/mcp run build
npm --workspace @lianruan/mcp run test
npm --workspace @lianruan/mcp run test:protocol
npm --workspace @lianruan/mcp run test:redclaw
./node_modules/.bin/eslint "apps/mcp/src/**/*.ts" "apps/mcp/tests/**/*.ts"
./node_modules/.bin/prettier --check "apps/mcp/**/*.{ts,json,md}"
```

结果：

- 类型检查、构建、协议测试、HTTP 测试、stdio 子进程测试和配置测试全部通过。
- 自动化用例共 15 个，全部通过。
- `dist/server.js` 可由固定到 `2026-07-28` 的 MCP 客户端通过 stdio 发现和调用。
- 代码中未引入数据库、PostgreSQL、Redis 或 Docker 套接字访问。

尚未完成：

- 真实 RedClaw 客户端人工验收，使用 `apps/mcp/tests/redclaw-acceptance.md` 记录。

## 8. P0-A 与真实只读工具验证

实施日期：2026-09-18。

已实现：

- 通用业务接口默认仅信任正式会话；兼容身份需显式开启测试或迁移开关。
- OpenAPI 查询传入绑定用户上下文。
- OpenAPI 资源未配置时不再回退为 `*`。
- `iam.data_scope_bindings` 已接入注册、商机、报价和订单运行时数据范围。
- `apps/api` 新增 Ed25519 主体断言和 `/internal/mcp` 只读路由。
- `apps/mcp` 新增十个真实只读工具、内部 API 客户端、限流、并发预算和响应大小限制。

已执行：

```bash
npm run prepare:postgres-test
npm --workspace @lianruan/api run test
npm --workspace @lianruan/mcp run test
npm run build
```

结果：

- API：`178 passed / 3 skipped`。
- MCP：`20 passed`，包含 RedClaw 0.5.22 的 2025-era stdio 兼容用例。
- 全仓构建通过。
- P0 负向测试覆盖伪造兼容身份、无资源和资源级数据范围覆盖。
- MCP远程测试覆盖受保护资源元数据、匿名401、受信JWKS签发的RS256逐用户JWT和匿名拒绝。
- MCP客户端测试覆盖每用户限流、并发预算和响应大小保护。
- API和Worker镜像的构建阶段已实际通过，现有镜像没有因MCP工作区加入而中断。

## 9. 阶段三部署验证

已执行：

```bash
find deploy/single-server/scripts -maxdepth 1 -name '*.sh' -print0 | xargs -0 -n1 bash -n
INSTALL_ROOT=/tmp/mcp-compose-config \
  docker compose -f deploy/single-server/compose/docker-compose.yml --profile mcp config
docker build --platform linux/amd64 \
  -f deploy/single-server/docker/mcp.Dockerfile \
  -t lianruan-crm-v3-mcp:local-mcp-test .
```

容器烟测：

- 独立镜像构建成功。
- 容器健康检查 `/health/ready` 返回 `200`。
- 容器内 MCP `2026-07-28` 协议协商成功。
- 模拟工具列表和 `v3_current_context` 调用成功。
- Compose 解析通过，MCP只加入 `mcp_net`，未注入 `DATABASE_URL`。
- 默认 Nginx 80 端口不代理 MCP；HTTPS 和受保护资源元数据使用独立模板。

尚未执行：

- 生产部署、域名证书启用和人员灰度。
- 真实 RedClaw人工验收、主业务性能基线和压力测试。
- 380V生产发布包制作和正式发布。

## 10. RedClaw 0.5.22 实机协议验收

验收日期：2026-09-18。

实际探测结果：

- 赤兔 0.5.22 首次连接时请求 MCP 协议版本 `2025-06-18`。
- 原 stdio 入口只接受 `2026-07-28`，客户端日志返回 `Unsupported protocol version`。
- stdio 入口已切换为 SDK 双时代服务：2025-era 客户端使用 `initialize`，现代客户端保持 `server/discover` 和 MCP `2026-07-28`。
- Streamable HTTP 未放宽，仍为现代协议入口。

实机验证：

- 赤兔 0.5.22 成功启动内部模拟 stdio 进程。
- 三个模拟工具均被发现。
- `v3_current_context`、`v3_product_search`、`v3_registration_list` 在赤兔会话中调用成功。
- 内部模拟身份返回 `internal-demo`、`internal`、`测试总部`，报备返回内部范围 3 条。
- 独立 2025-era stdio 客户端验证渠道模拟身份返回 `channel-demo`、`channel`、`渠道甲`，报备仅返回本渠道 2 条，并脱敏 `contactPhone`、`contactEmail`。

说明：赤兔 0.5.22 对运行中手工修改 `~/.aicodex/config.toml` 的 MCP 服务器刷新不稳定。配置服务器后应完全退出并重新打开赤兔；新增或切换服务器后建议新建会话再验证工具发现。
