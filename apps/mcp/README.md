# V3 受控只读 MCP 服务

本应用实现 MCP `2026-07-28`。stdio 入口同时兼容赤兔 0.5.22 使用的 2025-era `initialize` 握手，现代客户端仍走 `2026-07-28` 的 `server/discover`。默认只提供模拟工具；启用真实工具后通过内部 API 读取 V3 数据，不连接数据库、不执行写操作，也不改变 V3 业务状态。

## 当前能力

- `server/discover`
- `tools/list`
- `tools/call`
- stdio 传输
- 本机 Streamable HTTP 骨架
- 三个模拟工具：
  - `v3_current_context`
  - `v3_product_search`
  - `v3_registration_list`

所有工具均为只读，声明 `readOnlyHint`、`destructiveHint`、`idempotentHint` 和 `openWorldHint`，并提供严格输入、输出 JSON Schema。

## 构建和测试

```bash
npm --workspace @lianruan/mcp run build
npm --workspace @lianruan/mcp run check
npm --workspace @lianruan/mcp run test
npm --workspace @lianruan/mcp run test:protocol
npm --workspace @lianruan/mcp run test:redclaw
```

## RedClaw 本地配置

RedClaw 首期使用 stdio：

```text
名称：lianruan-v3-mcp-internal
传输：STDIO
启动命令：node
参数：/绝对路径/lianruan-crm-deploy-v3/apps/mcp/dist/server.js --transport stdio
工具超时：60 秒或以上
环境变量：
  V3_MCP_ENABLED=true
  V3_MCP_TRANSPORT=stdio
  V3_MCP_LOCAL_TEST_MODE=true
  V3_MCP_LOCAL_TEST_USER=internal-demo
```

渠道模拟用户使用独立服务进程，环境变量改为 `V3_MCP_LOCAL_TEST_USER=channel-demo`。不得在同一进程中混用两个测试用户。

`V3_MCP_LOCAL_TEST_MODE` 只允许在 `NODE_ENV=test` 或 `NODE_ENV=development` 时启用，生产启动会直接失败。

## 本机 HTTP

阶段一只允许绑定 `127.0.0.1`：

```bash
V3_MCP_ENABLED=true \
V3_MCP_TRANSPORT=streamable-http \
V3_MCP_HTTP_ENABLED=true \
V3_MCP_LOCAL_TEST_MODE=true \
V3_MCP_LOCAL_TEST_USER=internal-demo \
NODE_ENV=development \
node apps/mcp/dist/server.js --transport streamable-http
```

外部 MCP 在 HTTPS 就绪前保持关闭。容器内部明文 HTTP 必须显式设置 `V3_MCP_ALLOW_INTERNAL_HTTP=true`，且只能位于独立 `mcp_net`，不得发布宿主机公网端口。

## 安全边界

- 模拟模式不读取真实业务数据；真实模式只能通过 `apps/api` 内部只读接口读取。
- 不持有数据库、Redis 主状态或 Docker 凭据。
- 不接受客户端传入的用户、角色、渠道、区域或数据范围。
- 不实现写工具、任意 SQL、文件读取或命令执行。
- stdout 只用于 MCP 协议消息，日志只写 stderr。

## 真实只读工具

真实模式必须配置 `V3_MCP_REAL_TOOLS_ENABLED=true`、`V3_MCP_API_BASE_URL` 和 Ed25519 私钥文件。本地联调还需要真实测试用户的 `V3_MCP_LOCAL_TEST_USER_ID`、`V3_MCP_LOCAL_TEST_USERNAME`；生产和远程模式使用 OAuth/IAM JWT 主体，不读取本地测试身份覆盖。

真实模式注册十个只读工具，内部 API 使用 `X-V3-MCP-Principal` Ed25519 签名断言、60秒有效期和 `jti` 防重放。远程HTTP使用 OAuth 2.1 Bearer JWT、JWKS、issuer、audience 和客户端/用户白名单；外部HTTPS未就绪时保持关闭。
