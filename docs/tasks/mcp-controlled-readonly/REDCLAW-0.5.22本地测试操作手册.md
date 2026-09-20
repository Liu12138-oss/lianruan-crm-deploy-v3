# 赤兔 RedClaw 0.5.22 本地测试操作手册

## 1. 适用范围

- 客户端：`/Applications/AICodex-RedClaw.app`
- 已验证版本：`0.5.22`
- 工程目录：`/Users/liu/Documents/Codex/lianruan-crm-deploy-v3`
- 首选传输：`STDIO`
- 测试目标：先验证 MCP 协议、工具发现和模拟工具调用，再决定是否进行真实 V3 数据测试。

协议兼容：赤兔 0.5.22 使用 2025-era `initialize` 握手；`apps/mcp` 的 stdio 入口同时兼容该握手和 MCP `2026-07-28`。Streamable HTTP 仍只服务现代协议。

本手册优先使用模拟工具。模拟模式不需要数据库、不需要启动 API、不需要密钥，适合先确认赤兔和 MCP 服务能否正常连接。

如果你只想先测试赤兔能否正常使用 MCP，只需要执行第 2 节构建命令，然后直接复制第 2.1 节配置。无需阅读真实数据测试部分。

## 2. 测试前准备

打开终端，进入工程目录并构建 MCP：

```bash
cd /Users/liu/Documents/Codex/lianruan-crm-deploy-v3
npm --workspace @lianruan/mcp run build
```

确认入口文件存在：

```bash
ls -l /Users/liu/Documents/Codex/lianruan-crm-deploy-v3/apps/mcp/dist/server.js
```

如果文件不存在，不要继续配置赤兔，先处理上一步构建错误。

### 2.1 最快方式：直接复制 `config.toml`

如果你不想逐项填写界面，直接编辑：

```text
~/.aicodex/config.toml
```

先退出赤兔并备份配置：

```bash
cp ~/.aicodex/config.toml ~/.aicodex/config.toml.bak-$(date +%Y%m%d-%H%M%S)
```

把下面两段追加到文件末尾。除了服务器名称冲突时修改名称，其他内容可以原样使用。

```toml
[mcp_servers.lianruan-v3-mcp-mock-internal]
command = "node"
args = [
  "/Users/liu/Documents/Codex/lianruan-crm-deploy-v3/apps/mcp/dist/server.js",
  "--transport",
  "stdio"
]
cwd = "/Users/liu/Documents/Codex/lianruan-crm-deploy-v3"
enabled = true
startup_timeout_sec = 30

[mcp_servers.lianruan-v3-mcp-mock-internal.env]
NODE_ENV = "development"
V3_MCP_ENABLED = "true"
V3_MCP_TRANSPORT = "stdio"
V3_MCP_LOCAL_TEST_MODE = "true"
V3_MCP_LOCAL_TEST_USER = "internal-demo"

[mcp_servers.lianruan-v3-mcp-mock-channel]
command = "node"
args = [
  "/Users/liu/Documents/Codex/lianruan-crm-deploy-v3/apps/mcp/dist/server.js",
  "--transport",
  "stdio"
]
cwd = "/Users/liu/Documents/Codex/lianruan-crm-deploy-v3"
enabled = false
startup_timeout_sec = 30

[mcp_servers.lianruan-v3-mcp-mock-channel.env]
NODE_ENV = "development"
V3_MCP_ENABLED = "true"
V3_MCP_TRANSPORT = "stdio"
V3_MCP_LOCAL_TEST_MODE = "true"
V3_MCP_LOCAL_TEST_USER = "channel-demo"
```

保存后重新打开赤兔。内部模拟服务会立即启用；渠道模拟服务默认关闭，完成内部测试后把 `enabled` 改为 `true` 即可。

### 2.2 真实 V3 服务复制配置

真实服务需要先完成第 10.1 至 10.4 节，生成密钥并启动 API。完成后再把下面配置追加到 `~/.aicodex/config.toml`。

```toml
[mcp_servers.lianruan-v3-mcp-real]
command = "node"
args = [
  "/Users/liu/Documents/Codex/lianruan-crm-deploy-v3/apps/mcp/dist/server.js",
  "--transport",
  "stdio"
]
cwd = "/Users/liu/Documents/Codex/lianruan-crm-deploy-v3"
enabled = true
startup_timeout_sec = 30

[mcp_servers.lianruan-v3-mcp-real.env]
NODE_ENV = "development"
V3_MCP_ENABLED = "true"
V3_MCP_TRANSPORT = "stdio"
V3_MCP_LOCAL_TEST_MODE = "true"
V3_MCP_LOCAL_TEST_USER = "internal-demo"
V3_MCP_LOCAL_TEST_USER_ID = "acbfa8e4-74dc-3b7e-7c6f-d750c7d94290"
V3_MCP_LOCAL_TEST_USERNAME = "liangwanqi"
V3_MCP_REAL_TOOLS_ENABLED = "true"
V3_MCP_API_BASE_URL = "http://127.0.0.1:3100/internal/mcp"
V3_MCP_SERVICE_KEY_FILE = "/tmp/v3-mcp-local/private.pem"
```

`liangwanqi` 是当前本地测试库中的超管测试账号。测试库重建后如果查询不到该账号，只需要替换最后两个用户配置值和第 10.3 节的查询结果，其他内容不用调整。

## 3. 在赤兔中新增内部模拟服务

1. 打开赤兔 RedClaw。
2. 进入“设置”中的“MCP 服务器”。
3. 点击“添加服务器”。
4. 按以下内容填写。

| 配置项       | 填写内容                                            |
| ------------ | --------------------------------------------------- |
| 名称         | `lianruan-v3-mcp-mock-internal`                     |
| 启用此服务器 | 开启                                                |
| 传输方式     | `STDIO`                                             |
| 启动命令     | `node`                                              |
| 工作目录     | `/Users/liu/Documents/Codex/lianruan-crm-deploy-v3` |
| 启动超时     | `30` 秒或以上                                       |
| 工具超时     | `60` 秒或以上                                       |

参数按顺序填写：

```text
/Users/liu/Documents/Codex/lianruan-crm-deploy-v3/apps/mcp/dist/server.js
--transport
stdio
```

环境变量逐项填写：

```text
NODE_ENV=development
V3_MCP_ENABLED=true
V3_MCP_TRANSPORT=stdio
V3_MCP_LOCAL_TEST_MODE=true
V3_MCP_LOCAL_TEST_USER=internal-demo
```

如果当前版本显示“工具允许清单”或“工具禁用清单”，首期可以保持为空。服务端启用后只会返回三个模拟工具。也可以显式允许：

```text
v3_current_context
v3_product_search
v3_registration_list
```

保存配置，然后执行“测试”“重新连接”或“刷新 MCP 服务器配置”。

## 4. 预期结果

连接成功后，赤兔应发现三个工具：

| 工具                   | 用途                            |
| ---------------------- | ------------------------------- |
| `v3_current_context`   | 返回 `internal-demo` 的身份摘要 |
| `v3_product_search`    | 返回模拟的已发布产品            |
| `v3_registration_list` | 返回内部模拟报备                |

在赤兔对话中依次输入：

```text
调用 v3_current_context，告诉我当前测试身份。
```

预期关键信息：

```text
username: internal-demo
personType: internal
primaryOrganization: 测试总部
```

继续输入：

```text
查询已发布产品。
```

预期只返回模拟的产品、功能、硬件和套餐，不返回已停用产品。

继续输入：

```text
查询我的客户报备。
```

内部测试用户可以看到内部模拟范围中的三条报备。

## 5. 渠道用户测试

渠道用户必须使用新的独立服务进程。不要只修改现有进程中的 `V3_MCP_LOCAL_TEST_USER`。

在赤兔中再新增一个 MCP 服务器：

| 配置项   | 填写内容                       |
| -------- | ------------------------------ |
| 名称     | `lianruan-v3-mcp-mock-channel` |
| 传输方式 | `STDIO`                        |
| 启动命令 | `node`                         |
| 参数     | 与内部模拟服务相同             |
| 工作目录 | 与内部模拟服务相同             |

环境变量：

```text
NODE_ENV=development
V3_MCP_ENABLED=true
V3_MCP_TRANSPORT=stdio
V3_MCP_LOCAL_TEST_MODE=true
V3_MCP_LOCAL_TEST_USER=channel-demo
```

渠道进程预期关键信息：

```text
username: channel-demo
personType: channel
primaryPartner: 渠道甲
```

调用 `v3_registration_list` 时，只应看到渠道甲可见的两条模拟报备。

## 6. 推荐的测试顺序

1. 启动内部模拟服务。
2. 确认三个工具可见。
3. 调用 `v3_current_context`。
4. 调用 `v3_product_search`。
5. 调用 `v3_registration_list`。
6. 关闭并删除内部模拟服务。
7. 启动渠道模拟服务。
8. 确认渠道身份和渠道范围。
9. 关闭渠道模拟服务。

模拟测试全部通过后，再考虑真实 V3 数据测试。

## 7. 通过 `~/.aicodex/config.toml` 手工配置

正常情况下优先使用赤兔界面。只有在界面无法完成配置时，才手工编辑：

```text
~/.aicodex/config.toml
```

编辑前先退出赤兔，避免应用保存时覆盖手工修改。AICodex 风格的等价配置如下：

```toml
[mcp_servers.lianruan-v3-mcp-mock-internal]
command = "node"
args = [
  "/Users/liu/Documents/Codex/lianruan-crm-deploy-v3/apps/mcp/dist/server.js",
  "--transport",
  "stdio"
]
cwd = "/Users/liu/Documents/Codex/lianruan-crm-deploy-v3"
enabled = true
startup_timeout_sec = 30

[mcp_servers.lianruan-v3-mcp-mock-internal.env]
NODE_ENV = "development"
V3_MCP_ENABLED = "true"
V3_MCP_TRANSPORT = "stdio"
V3_MCP_LOCAL_TEST_MODE = "true"
V3_MCP_LOCAL_TEST_USER = "internal-demo"
```

保存后重新打开赤兔并刷新 MCP 服务器。

## 8. 常见问题

| 现象                       | 检查项                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| 赤兔显示服务启动失败       | 确认 `node -v` 是 22.x，且 `dist/server.js` 存在                                                       |
| 工具列表为空               | 确认 `V3_MCP_ENABLED=true`，并重新启用服务器                                                           |
| 日志提示本地测试模式不允许 | 确认显式填写 `NODE_ENV=development`                                                                    |
| 内部和渠道结果相同         | 两个用户是否运行在独立服务进程中                                                                       |
| 返回旧协议或初始化失败     | 重新执行 `npm --workspace @lianruan/mcp run build`；当前 stdio 同时兼容赤兔 0.5.22 和 MCP `2026-07-28` |
| 无法看到工具               | 赤兔工具允许清单是否误填或误禁用工具                                                                   |
| 终端手工运行没有输出       | stdio 服务等待客户端发送协议消息，属于正常现象                                                         |

不要通过 `console.log` 手工测试 stdio 服务。MCP 消息必须保持标准输出干净，日志统一读取标准错误。

## 9. 停止和清理

在赤兔设置中停用对应的 MCP 服务器即可停止 stdio 子进程。

手工验证进程是否退出：

```bash
pgrep -af 'apps/mcp/dist/server.js' || true
```

如果没有输出，说明测试进程已经退出。

## 10. 真实 V3 工具测试附录

真实模式会注册十个只读工具，但需要本地 PostgreSQL 测试库、API 内部只读路由和 Ed25519 密钥。模拟测试稳定后再执行，不要跳过前面的协议测试。

### 10.1 启动测试数据库

```bash
cd /Users/liu/Documents/Codex/lianruan-crm-deploy-v3
docker compose -f deploy/local-dev/docker-compose.yml up -d
npm run prepare:postgres-test
```

### 10.2 生成临时密钥

```bash
mkdir -p /tmp/v3-mcp-local
openssl genpkey -algorithm ED25519 -out /tmp/v3-mcp-local/private.pem
openssl pkey -in /tmp/v3-mcp-local/private.pem -pubout -out /tmp/v3-mcp-local/public.pem
chmod 600 /tmp/v3-mcp-local/private.pem /tmp/v3-mcp-local/public.pem
```

### 10.3 确认默认真实测试用户

```bash
docker exec lianruan-crm-v3-postgres psql \
  -U lianruan -d lianruan_crm_v3_test -Atc \
  "SELECT id, username FROM iam.users WHERE status_code='active' AND username='liangwanqi' LIMIT 1;"
```

默认测试账号为：

```text
用户名：liangwanqi
用户编号：acbfa8e4-74dc-3b7e-7c6f-d750c7d94290
```

查询结果应与上述用户编号一致。如果本地测试库被重建后账号发生变化，只需要用查询结果替换第 2.2 节和第 10.5 节中的用户编号、用户名。

### 10.4 启动 API

先构建 API：

```bash
npm --workspace @lianruan/api run build
```

启动 API 并保持终端运行：

```bash
APP_ENV=development \
DATABASE_URL='postgresql://lianruan:lianruan_dev_password@127.0.0.1:5432/lianruan_crm_v3_test' \
REDIS_URL='redis://:lianruan_dev_redis@127.0.0.1:6379/15' \
API_HOST=127.0.0.1 \
API_PORT=3100 \
SESSION_SECRET='local-mcp-test-session-secret' \
V3_MCP_API_ENABLED=true \
V3_MCP_API_PUBLIC_KEY_FILE=/tmp/v3-mcp-local/public.pem \
node apps/api/dist/server.js
```

### 10.5 配置真实 V3 工具

在赤兔中新增第三个 STDIO 服务：

| 配置项   | 填写内容                                            |
| -------- | --------------------------------------------------- |
| 名称     | `lianruan-v3-mcp-real`                              |
| 传输方式 | `STDIO`                                             |
| 启动命令 | `node`                                              |
| 参数     | 与模拟服务相同                                      |
| 工作目录 | `/Users/liu/Documents/Codex/lianruan-crm-deploy-v3` |

环境变量：

```text
NODE_ENV=development
V3_MCP_ENABLED=true
V3_MCP_TRANSPORT=stdio
V3_MCP_LOCAL_TEST_MODE=true
V3_MCP_LOCAL_TEST_USER=internal-demo
V3_MCP_LOCAL_TEST_USER_ID=acbfa8e4-74dc-3b7e-7c6f-d750c7d94290
V3_MCP_LOCAL_TEST_USERNAME=liangwanqi
V3_MCP_REAL_TOOLS_ENABLED=true
V3_MCP_API_BASE_URL=http://127.0.0.1:3100/internal/mcp
V3_MCP_SERVICE_KEY_FILE=/tmp/v3-mcp-local/private.pem
```

保存并重新连接后，预期发现十个真实只读工具。

### 10.6 真实模式重点检查

- `v3_current_context` 返回的是 `liangwanqi` 真实用户。
- 普通员工只能看到本人负责的数据。
- 区管只能看到正式绑定区域的数据。
- 渠道用户只能看到本渠道数据。
- 联系方式、成本价、底价和附件不会越权返回。
- 关闭 API 后工具调用失败，但 V3 页面和普通 API 不受影响。

## 11. 当前不测试远程 HTTP

赤兔 0.5.22 支持远程 MCP，但当前没有生产域名和证书时，不应通过外部 HTTP 开放 MCP。远程测试在以下条件全部满足后再进行：

1. 域名和证书已准备。
2. HTTPS Nginx 模板已启用。
3. V3/IAM 已提供 OAuth `issuer`、`audience`、JWKS 和客户端信息。
4. MCP 客户端和用户白名单已配置。
5. 外部 80 端口不代理 `/mcp`。

## 12. 测试完成判定

模拟模式至少完成：

- [ ] 赤兔能启动 MCP stdio 进程。
- [ ] 能发现三个模拟工具。
- [ ] `v3_current_context` 返回预期测试身份。
- [ ] 产品和报备模拟查询返回预期结果。
- [ ] 渠道测试用户与内部测试用户结果不同。
- [ ] 关闭服务器后进程退出。

真实模式追加完成：

- [ ] 能发现十个真实工具。
- [ ] 真实身份、数据范围和字段策略符合 V3 权限。
- [ ] API 关闭时 MCP 失败但主业务正常。

只有模拟和真实模式均完成上述验证，才能进入 HTTPS 远程验收。
