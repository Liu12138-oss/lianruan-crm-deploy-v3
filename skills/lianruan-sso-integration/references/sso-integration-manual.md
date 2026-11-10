# IAM/EMM 与 UniSDP 单点登录对接手册

版本：2026-10-28  
适用对象：需要把联软 IAM/EMM H5 单点登录、UniSDP 接口单点登录或 UniSDP 门户单点登录接入其他 Web 系统的研发、测试和运维人员。

> 本手册描述协议和实现边界，不包含本项目真实 ISAID、内部地址、密钥或生产凭据。目标系统必须使用自己的配置，并从真实环境取得成功、失败响应样例后再编码。

## 1. 先看整体架构

两套单点登录共享同一条安全主线，但取票据方式和提供方协议不同：

```text
浏览器 / EMM 客户端
        |
        | 1. 打开业务入口，携带票据或触发 EMM 桥接
        v
前端单点中转页
        |
        | 2. 把票据 POST 给后端，不把入口/角色当可信身份
        v
业务后端
        |
        | 3. 服务端调用身份提供方校验票据
        v
IAM / UniSDP
        |
        | 4. 返回用户名、手机号、部门等身份字段
        v
业务后端
        |
        | 5. 匹配本地账号、检查角色和状态
        | 6. 写 HttpOnly Cookie 会话 + 返回页面会话
        v
浏览器整页跳转到管理端或渠道端
```

关键结论：

1. **票据只在服务端校验。** 前端不能根据票据内容直接判断用户身份。
2. **入口由本地身份形态决定。** 手机号命中渠道账号走渠道端；用户名命中管理角色走管理端。
3. **会话必须由服务端签发。** 页面会话只能使用后端返回的会话数据，不能由前端拼角色或用户 ID。
4. **单点失败要有账号密码兜底。** 失败后回到登录页，并清理 URL 中的票据。

## 2. 对接前信息清单

编码前先填完以下信息。缺少关键项时不要“猜一个试试”。

### 2.1 身份提供方

| 项目 | IAM/EMM | UniSDP |
| --- | --- | --- |
| 校验地址 | 目标环境提供 | 目标环境提供 |
| ISAID/应用标识 | 管理端和渠道端是否不同 | 是否只有一个 |
| 请求方式 | 通常是 POST，参数在 URL 查询串 | 通常是 POST，表单编码，参数在查询串 |
| 成功状态 | `status=2000` | `status=2000` 且 `isLogin=true` |
| 用户名位置 | `data.mailuser.username` 或 `mailuser.username` | 顶层 `username` |
| 手机号位置 | 通常没有独立手机号，用户名可能就是手机号 | 顶层或嵌套多个字段，按目标环境样例确认 |
| 失败样例 | 至少提供过期、无效、用户不存在各一份 | 至少提供过期、无效、参数为空各一份 |

### 2.2 本地账号

- 用户名是否大小写敏感；本项目统一转小写后匹配。
- 手机号是否允许带 `+86`、空格、短横线；本项目只保留数字，并去掉 13 位且以 `86` 开头的国家码。
- 手机号是否在本地账号表中唯一；不唯一时必须拒绝登录。
- 哪些角色可以进入管理端，哪些角色属于渠道端。
- 账号停用、离职、审批未通过时是否拒绝单点登录。
- 是否需要把提供方主体写入外部身份映射表，是否允许自动绑定。

### 2.3 会话和落点

- Cookie 名称、签名算法、有效期、`Secure`、`SameSite`、域名和路径。
- 目标系统是否已有业务页面会话；页面会话的存储键和结构是什么。
- 管理端、渠道端、移动端分别有哪些正式页面。
- 单点成功后是否需要整页跳转；如果前后端同源，是否允许 SPA 内部跳转。
- 单点失败回到哪个登录页，是否需要显示错误原因。

### 2.4 安全约束

- 校验地址是否只允许内网访问，是否需要出网白名单。
- ISAID 由谁保管，是否允许写入配置文件，是否需要密钥管理服务。
- 是否需要限制来源 IP、请求频率、重放和重复回调。
- 日志中允许记录哪些字段，保留多久。

## 3. 两套单点共用的设计

### 3.1 推荐接口契约

路径可以按目标系统调整，但职责不要混合：

```text
GET  /api/auth/sso/iam/config
POST /api/auth/sso/iam/login
POST /api/auth/sso/unisdp/login
GET  /app/sso.htm
POST /app/sso.htm
GET  /api/auth/me
POST /api/auth/logout
```

#### IAM 配置接口

用于前端判断单点是否启用、选择 EMM 请求标识和超时时间：

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "entries": ["admin", "partner"],
    "requestIsaidByEntry": {
      "admin": "<ADMIN_REQUEST_ISAID>",
      "partner": "<PARTNER_REQUEST_ISAID>"
    },
    "timeoutMs": 8000
  }
}
```

注意：`enabled` 表示 IAM 单点能力本身是否启用，不要再用历史上的 PC 独立开关字段判断电脑端是否可用。目标系统如果确实存在独立开关，必须由用户明确确认，不能靠猜测。

#### IAM 登录接口

请求：

```json
{
  "token": "<IAM_SSO_TOKEN>",
  "entry": "admin",
  "clientType": "pc"
}
```

`entry` 可以为空。为空时，服务端根据管理端/渠道端校验标识是否相同来决定校验入口；如果两者不同，应要求调用方补充入口，不能静默选一个。

成功响应建议：

```json
{
  "success": true,
  "data": {
    "user": {
      "username": "local-user",
      "displayName": "本地显示名",
      "roleName": "本地角色",
      "defaultPath": "/admin",
      "allowedPaths": ["/admin", "/partner", "/mobile"],
      "roles": ["admin"],
      "permissions": [],
      "scopes": []
    },
    "pageSession": {
      "token": "<PAGE_SESSION_TOKEN>",
      "user": {
        "id": "local-user-id",
        "username": "local-user",
        "role": "admin"
      }
    },
    "entry": "admin",
    "matchedBy": "username",
    "expiresInSeconds": 43200
  }
}
```

不要把身份提供方返回的原始对象直接作为 `user` 返回；必须先匹配本地账号，再返回本地角色和授权范围。

#### UniSDP 登录接口

请求至少接受以下任一字段：

```json
{
  "token": "<UNISDP_SSO_TOKEN>"
}
```

也兼容：

```json
{
  "sso_token": "<UNISDP_SSO_TOKEN>"
}
```

成功响应与 IAM 登录接口保持同构，额外可以返回 `provider: "unisdp"` 和 `matchedBy`。

#### UniSDP 门户接口

`GET` 或 `POST /app/sso.htm` 从查询串或表单中读取 `sso_token`、`ssoToken`、`ssotoken`、`token`、`code` 中的第一个非空值。

- 成功：写 HttpOnly Cookie，返回一个 HTML 完成页；完成页写入页面会话后整页跳转到管理端或渠道端。
- 失败：清理 Cookie，302 到账号密码登录页，例如 `/login?ssoFallback=1&provider=unisdp`。
- 门户接口不能只返回 JSON，因为门户需要浏览器完成页面会话写入和整页跳转。

### 3.2 身份匹配规则

推荐使用“形态优先、角色兜底”的确定性规则：

```text
候选值 = 提供方手机号（如果有）优先，否则使用提供方用户名
数字串 = 去掉所有非数字字符
如果是 13 位且以 86 开头，去掉 86
如果结果是 11 位且以 1 开头：
    按规范化手机号匹配本地渠道账号
    命中多个：拒绝登录，返回“手机号重复”
    命中零个：拒绝登录
否则：
    按用户名（统一小写）匹配本地账号
    要求账号具有管理端角色
    没有管理端角色：拒绝登录
```

必须坚持以下边界：

- **手机号只走渠道入口。** 即使调用方传了 `entry=admin`，也不能因为前端参数把手机号用户送进管理端。
- **用户名只走管理端入口。** 渠道账号即使有普通用户名，也不能通过用户名形态绕过手机号匹配。
- **角色和状态用本地数据。** 提供方返回的显示名、部门只用于展示或审计，不能直接映射为本地权限。
- **匹配结果必须唯一。** 手机号重复、外部主体重复绑定、用户名冲突都要显式报错。
- **不自动合并账号。** 外部身份映射表建议以 `(provider, issuer, subject)` 唯一，不允许静默绑定到多个本地账号。

建议的数据结构：

```sql
CREATE TABLE external_identities (
  id              BIGSERIAL PRIMARY KEY,
  provider        TEXT NOT NULL,
  issuer          TEXT NOT NULL,
  subject         TEXT NOT NULL,
  user_id         BIGINT NOT NULL,
  status_code     TEXT NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, issuer, subject)
);
```

具体表名、字段和唯一约束要服从目标系统现有模型；不要为了单点登录另建一套与主账号表脱节的用户体系。

### 3.3 会话设计

推荐同时建立两层会话：

1. **服务端 HttpOnly Cookie 会话**：用于后续 API 鉴权，浏览器 JavaScript 不可读取。
2. **业务页面会话**：目标系统现有页面如果需要本地会话，由服务端返回同一身份和页面会话令牌，前端保存到既有键位。

Cookie 建议：

```text
名称：由目标系统配置
属性：HttpOnly; Path=/; SameSite=Lax; Max-Age=<TTL>; Secure（HTTPS 环境必须启用）
内容：签名后的会话令牌，不直接放提供方票据
```

页面会话建议：

- 管理端前缀：`admin_`
- 渠道端前缀：`partner_`
- 写入：`<prefix>auth_token`、`<prefix>user_info`、`<prefix>api_user`
- 登录前清理另一侧会话，避免管理端和渠道端身份混用。

单点成功后优先使用浏览器整页跳转，尤其是页面会话需要切换存储前缀或从服务端完成页写入 localStorage 时。不要依赖 SPA 内部路由完成跨套页面切换。

### 3.4 安全和日志

必须做到：

- 单点票据只出现在初始请求中，读取后立即从地址栏、History 和 hash 中清理。
- 日志只记录票据指纹、长度、`requestId`、阶段、错误码和脱敏账号。
- 不在前端日志、埋点、错误上报中记录票据、Cookie、密码和 ISAID。
- 写接口校验 `Origin`/`Referer`，防止跨站提交；单点接口也要纳入统一限流和审计。
- 重定向只允许本站相对路径，并校验目标路径是否在当前账号 `allowedPaths` 内；禁止 `//evil.example`、绝对 URL 和协议相对 URL。
- 校验地址从服务端配置读取，禁止由请求参数覆盖。
- 对提供方响应做结构校验和长度限制，避免超大响应或异常 JSON 拖垮服务。
- 失败时清理旧 Cookie，避免“登录失败但仍残留旧会话”。

## 4. IAM/EMM H5 单点登录

### 4.1 完整流程

```text
1. 用户从 EMM、统一门户或业务链接进入。
2. 前端识别 IAM 单点标记：source=emm 或 needtransfer=1，或直接访问 IAM 专属入口。
3. 前端优先读取 URL 中的 token/code；没有时，在 EMM 客户端或移动端调用 JQAPI.getSSOToken。
4. 前端把 token、entry、clientType POST 给业务后端。
5. 后端按入口选择 ISAID，调用 IAM 校验地址。
6. IAM 返回 status=2000 和 mailuser 身份字段。
7. 后端按手机号或用户名匹配本地账号，检查角色、状态和允许入口。
8. 后端签发 Cookie 会话和页面会话，前端整页跳转到对应业务页面。
9. 失败时清理票据并回到登录页，显示可理解的失败原因。
```

### 4.2 前端入口识别

建议支持以下标记：

| 来源 | 识别方式 | 处理 |
| --- | --- | --- |
| EMM 统一链接 | `source=emm` | 走 IAM 单点 |
| IAM 占位链接 | `needtransfer=1` | 走 IAM 单点 |
| IAM 专属路径 | `/sso/iam` | 固定走 IAM |
| 旧兼容路径 | `/login/singlesignonlogin/login.do` | 固定走 IAM，保留兼容 |
| UniSDP 票据 | 参数 `ssotoken`（忽略大小写、下划线、短横线） | 优先走 UniSDP |

参数可能出现在查询串或 hash 的查询串中，两者都要检查。UniSDP 票据优先级高于 IAM 标记，避免混合链接被错误路由。

票据参数建议至少兼容：

```text
token
ssotoken
code
```

参数名标准化时去掉 `_`、`-` 并转小写，因此 `sso_token`、`sso-token`、`SSO_TOKEN` 都能识别。

### 4.3 EMM H5 桥接

EMM 客户端提供 `JQAPI.getSSOToken`。页面不在 EMM 中时，不应假设一定拿得到票据。

调用形式：

```javascript
window.JQAPI.getSSOToken(
  { ISAID: requestIsaid },
  function (data) {
    // data 可能是对象，也可能是 JSON 字符串
    var payload = typeof data === "string" ? JSON.parse(data) : data;
    var token = payload.SSOToken && (payload.SSOToken.token || payload.SSOToken.ltpatoken);
  },
  function (data) {
    // 读取 data.msg，给出可理解的错误
  }
);
```

桥接实现通常通过隐藏 iframe 调用：

```text
emm-services://?action=jsfunction
  &invokeID=<唯一调用 ID>
  &apiname=getSSOToken
  &param=<URL 编码后的 { ISAID }>
  &oncallback=JQAPICallBack.successCallBack
  &errorcallback=JQAPICallBack.failedCallBack
```

实现要点：

- 只实现当前需要的 `getSSOToken`，不要伪造完整 EMM SDK。
- 每次调用生成唯一 `invokeID`，回调后删除登记项，避免内存泄漏。
- 加超时保护；移动端可以使用完整配置超时，PC 自动尝试建议使用更短超时，避免用户长时间停在空白页。
- 只有在移动端或明确 `source=emm` 时才主动调用 EMM；普通 PC 登录页不能无端等待 EMM。
- EMM 返回缺少 token、JSON 解析失败、超时、回调报错要分别给不同提示，便于排障。

### 4.4 后端校验 IAM 票据

推荐逻辑：

```ts
type IamEntry = "admin" | "partner";

interface IamConfig {
  enabled: boolean;
  validateUrl: string;
  timeoutMs: number;
  validateIsaidByEntry: Record<IamEntry, string>;
}

async function validateIamToken(
  token: string,
  entry: IamEntry,
  config: IamConfig,
): Promise<Record<string, unknown>> {
  if (!config.enabled) throw new Error("IAM_SSO_DISABLED");
  const isaid = config.validateIsaidByEntry[entry]?.trim();
  if (!config.validateUrl || !isaid) throw new Error("IAM_SSO_CONFIG_INVALID");

  const url = new URL(config.validateUrl);
  url.searchParams.set("isaid", isaid);
  url.searchParams.set("sso_token", token);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error("IAM_PROVIDER_HTTP_ERROR");
    if (!text) return {};
    return JSON.parse(text) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}
```

解析身份：

```ts
function readIamUsername(payload: any): string {
  return String(
    payload?.data?.mailuser?.username ??
      payload?.mailuser?.username ??
      "",
  ).trim();
}

function readIamProfile(payload: any) {
  const user = payload?.data?.mailuser ?? payload?.mailuser ?? {};
  return {
    username: readIamUsername(payload).toLowerCase(),
    rawUsername: readIamUsername(payload),
    displayName: String(user.struserdes ?? "").trim(),
    userId: String(user.userid ?? "").trim(),
    deptId: String(user.deptid ?? "").trim(),
    deptName: String(user.deptname ?? "").trim(),
  };
}
```

校验规则：

- `status` 必须是数字 `2000`。
- 用户名去空白后不能为空。
- 非 2000 时优先展示提供方原始 `msg`，再拼接已知错误映射；不要把“校验码编号不存在”一律误报成“凭证过期”。
- 校验地址和 ISAID 只从服务端配置读取。
- 请求总时长受 `timeoutMs` 控制，默认 8 秒；超时返回 504 类错误。

常见错误码：

| 状态 | 含义 | 建议文案 |
| --- | --- | --- |
| 6005 | IAM 用户不存在 | IAM 用户不存在 |
| 6010 | 设备待审核 | 当前设备待审核，暂无法登录 |
| 6035 | 凭证过期 | 单点凭证已过期，请从 IAM 入口重新进入 |
| 6036 | 用户离职 | IAM 用户已离职，禁止登录 |
| 6041 | 用户禁用 | IAM 用户已被禁用，禁止登录 |
| 6042 | 凭证无效 | 单点凭证无效，请重新发起登录 |
| 6048 | 设备未绑定 | IAM 用户设备未绑定 |
| 6610 | 设备黑名单 | 当前设备在黑名单中，无法登录 |
| 8095 | 认证服务异常 | IAM 认证服务异常，请稍后重试 |

### 4.5 IAM 的入口和落点

前端传入 `entry` 只用于选择校验 ISAID。最终入口必须由本地匹配结果决定：

```text
手机号命中渠道账号 -> partner
用户名命中管理账号 -> admin
```

如果调用方没有传 `entry`：

- 管理端和渠道端校验 ISAID 相同：可以用统一标识发起校验。
- 两者不同：返回 400，要求调用方补充入口；不要默认选管理端或渠道端。

登录前还要检查本地账号是否允许进入该工作区，例如管理端账号必须能访问管理路径，渠道账号必须能访问渠道路径。否则返回 403，而不是把用户送到无权页面。

## 5. UniSDP 单点登录

UniSDP 有两种接入形态，不要混为一谈：

| 形态 | 入口 | 适用场景 | 会话完成方式 |
| --- | --- | --- | --- |
| 接口模式 | `POST /api/auth/sso/unisdp/login` | 前端中转页或 SPA | JSON 返回 Cookie + 页面会话 |
| 门户模式 | `GET|POST /app/sso.htm` | UniSDP 门户直接跳转 | 服务端写 Cookie，返回 HTML 完成页写页面会话 |

### 5.1 接口模式

请求体兼容 `token` 和 `sso_token`。服务端调用提供方时：

```ts
async function validateUniSdpToken(token: string, config: UniSdpConfig) {
  const url = new URL(config.validateUrl);
  url.searchParams.set("sso_token", token);
  url.searchParams.set("isaid", config.isaid);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!response.ok) throw new Error("UNISDP_PROVIDER_HTTP_ERROR");
  return await response.json();
}
```

成功判定：

```text
status === 2000
isLogin === true
username 非空
```

身份字段：

- `username` 在顶层，统一转小写后用于本地用户名匹配。
- 手机号可能在 `mobile`、`mobilePhone`、`phone`、`data.phone`、`user.mobile`、`userInfo.mobile` 等位置；具体以目标环境真实响应为准。
- 手机号规范化：只保留数字，去掉 13 位且以 `86` 开头的国家码，最终必须是 11 位且以 `1` 开头。
- 如果提供方同时返回手机号和用户名，优先用手机号判定形态。

失败判定：

- 非 2000 或 `isLogin !== true` 返回 401 类业务错误。
- 已知错误码：`6001` 参数为空、`6003` 凭证无效、`6010` 凭证过期。
- 未知错误优先使用提供方 `errmsg`，但要做长度和敏感信息清理。

### 5.2 门户模式

门户模式最重要的区别是：**会话和页面跳转必须在服务端完成页中收口**。

处理顺序：

1. 从 `GET` 查询串或 `POST` 表单读取票据。
2. 服务端校验 UniSDP 票据。
3. 匹配本地账号，检查角色、状态和允许入口。
4. 写 HttpOnly Cookie。
5. 生成页面会话；返回 HTML 完成页。
6. 完成页清理旧存储，写入新页面会话，`location.replace(targetPath)`。
7. 失败时清理 Cookie，302 到 `/login?ssoFallback=1&provider=unisdp`。

完成页示例（生产实现必须做 HTML 安全序列化，不能直接拼接未转义的用户数据）：

```html
<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>正在完成单点登录</title></head>
  <body>
    <p>正在完成 UniSDP 单点登录，请稍候...</p>
    <script>
      (function () {
        var data = __SAFE_JSON__;
        try {
          [
            "admin_auth_token", "admin_user_info", "admin_api_user",
            "partner_auth_token", "partner_user_info", "partner_api_user",
            "api_user"
          ].forEach(function (key) { localStorage.removeItem(key); });
          localStorage.setItem(data.prefix + "auth_token", data.token);
          localStorage.setItem(data.prefix + "user_info", JSON.stringify(data.user));
          localStorage.setItem(
            data.prefix + "api_user",
            JSON.stringify({ user: data.user, token: data.token })
          );
          if (data.prefix === "partner_") {
            localStorage.setItem(
              "api_user",
              JSON.stringify({ user: data.user, token: data.token })
            );
          }
          location.replace(data.targetPath);
        } catch (error) {
          location.replace(data.fallbackPath);
        }
      })();
    </script>
  </body>
</html>
```

安全要求：

- `__SAFE_JSON__` 必须把 `<` 转义为 `\u003c`，避免用户字段形成存储型 XSS。
- 完成页设置 `Cache-Control: no-store`。
- 只允许跳转到本站已授权的管理端或渠道端路径。
- 页面会话令牌和 Cookie 会话必须来自同一服务端身份，不能由 HTML 自行生成。

### 5.3 UniSDP 落点

门户模式和接口模式使用同一套匹配规则：

```text
手机号命中渠道账号 -> /partner.html 或目标系统渠道首页
用户名命中管理账号 -> /admin.html 或目标系统管理首页
```

如果目标系统已经迁移为 SPA 路由，应把旧 `.html` 路径集中映射到新的正式页面，而不是在两个地方各写一套判断。落点规则建议集中在一个模块，并配单元测试。

## 6. 前端中转页实现要点

前端只做四件事：识别入口、取得票据、提交后端、按安全路径跳转。

推荐状态机：

```text
读取配置 -> 读取 URL 票据
    -> 有票据：提交后端
    -> 无票据且是 EMM/移动端：调用 EMM 桥接
    -> 无票据且不是 EMM：报“缺少单点凭证”
提交成功 -> 清理 URL -> 整页跳转
提交失败 -> 清理 URL -> 回登录页或显示重试提示
```

实现要求：

- 只从 URL 查询串和 hash 查询串读取票据，不遍历 `window.location.href` 做字符串切割。
- 读取后立即调用 `history.replaceState` 清理票据参数；失败分支也要清理。
- 不在前端解析票据内容，不从票据推断角色。
- `redirect` 只接受本站相对路径，且必须由后端或统一落点模块校验 `allowedPaths`。
- 对 `source=emm` 的链接，即使没有票据也进入 IAM 中转页尝试桥接。
- UniSDP 票据优先于 IAM 标记，避免混合参数导致错误提供方。
- 页面切换使用 `location.replace` 或 `location.assign`；不要用 SPA Router 跳到需要独立页面会话的 `.html` 页面。

## 7. 配置建议

### 7.1 通用配置项

目标系统可以采用自己的前缀；下面是语义建议：

```dotenv
# 总开关
IAM_SSO_ENABLED=true
UNISDP_SSO_ENABLED=true

# IAM 校验
IAM_SSO_VALIDATE_URL=<IAM_VALIDATE_URL>
IAM_SSO_VALIDATE_ISAID=<IAM_VALIDATE_ISAID>
IAM_SSO_ADMIN_VALIDATE_ISAID=<IAM_ADMIN_ISAID>
IAM_SSO_PARTNER_VALIDATE_ISAID=<IAM_PARTNER_ISAID>
IAM_SSO_ADMIN_REQUEST_ISAID=<IAM_ADMIN_REQUEST_ISAID>
IAM_SSO_PARTNER_REQUEST_ISAID=<IAM_PARTNER_REQUEST_ISAID>
IAM_SSO_TIMEOUT_MS=8000

# UniSDP 校验
UNISDP_SSO_VALIDATE_URL=<UNISDP_VALIDATE_URL>
UNISDP_SSO_ISAID=<UNISDP_ISAID>
UNISDP_SSO_TIMEOUT_MS=8000

# 会话
AUTH_COOKIE_NAME=<COOKIE_NAME>
AUTH_COOKIE_SECURE=true
AUTH_SESSION_TTL_SECONDS=43200
```

### 7.2 与本项目 V3 配置的对应关系

| 通用语义 | 本项目 V3 变量 |
| --- | --- |
| IAM 总开关 | `V3_IAM_H5_SSO_ENABLED` |
| IAM 校验地址 | `V3_IAM_H5_SSO_VALIDATE_URL` |
| IAM 统一校验标识 | `V3_IAM_H5_SSO_VALIDATE_ISAID` |
| IAM 管理端校验标识 | `V3_IAM_H5_SSO_ADMIN_VALIDATE_ISAID` |
| IAM 渠道端校验标识 | `V3_IAM_H5_SSO_PARTNER_VALIDATE_ISAID` |
| IAM 管理端请求标识 | `V3_IAM_H5_SSO_ADMIN_REQUEST_ISAID` |
| IAM 渠道端请求标识 | `V3_IAM_H5_SSO_PARTNER_REQUEST_ISAID` |
| IAM 超时 | `V3_IAM_H5_SSO_TIMEOUT_MS` |
| UniSDP 总开关 | `V3_UNISDP_SSO_ENABLED` |
| UniSDP 校验地址 | `V3_UNISDP_SSO_VALIDATE_URL` |
| UniSDP 应用标识 | `V3_UNISDP_SSO_ISAID` |
| UniSDP 超时 | `V3_UNISDP_SSO_TIMEOUT_MS` |

注意：本项目已移除历史 PC 独立开关的运行时拦截；不要在新系统中复活该字段，除非目标系统明确需要独立的 PC 开关，并且同步定义清楚它与总开关的关系。

## 8. 推荐实现顺序

### 第一步：协议适配器

先写纯函数或独立服务，不要在路由里堆解析逻辑：

- 读取配置并校验必填项。
- 构造提供方请求。
- 处理超时、非 2xx、空响应、非 JSON。
- 解析 `status`、`isLogin`、用户名、手机号和错误信息。
- 返回稳定的内部身份对象，不返回提供方原始对象。

### 第二步：本地身份匹配

- 规范化用户名和手机号。
- 查询本地账号、角色、状态和允许路径。
- 手机号重复时返回冲突错误。
- 不自动创建账号，不自动合并外部身份。
- 所有匹配失败都返回明确但不过度暴露账号存在性的错误。

### 第三步：会话

- 签发带版本和过期时间的服务端会话。
- 设置 HttpOnly Cookie。
- 生成业务页面会话。
- 提供 `/api/auth/me` 恢复会话。
- 退出登录同时清理 Cookie 和页面会话。

### 第四步：前端入口

- 集中实现入口识别。
- 实现票据读取和 URL 清理。
- 实现 EMM 桥接和超时。
- 实现单点中转页、错误提示和登录页回退。

### 第五步：门户模式

- 实现 `/app/sso.htm` 的 GET/POST。
- 成功后返回完成页，失败后 302 回登录页。
- 完成页做 HTML 安全序列化和缓存禁用。

## 9. 测试矩阵

### 9.1 服务端单元测试

- 配置默认值、环境变量覆盖、空值回退。
- IAM 成功响应：`status=2000`、用户名在 `data.mailuser` 和 `mailuser` 两种位置。
- IAM 失败响应：6005、6035、6042、未知状态、空用户名。
- UniSDP 成功：`status=2000`、`isLogin=true`、用户名、手机号。
- UniSDP 失败：`isLogin=false`、非 2000、`errmsg`。
- 提供方超时和非 2xx。
- 手机号规范化：空格、短横线、`+86`、13 位 `86` 前缀、非手机号。
- 手机号重复：必须返回冲突，不允许任选一个。
- 用户名未命中、命中但无管理角色、账号停用。
- 安全重定向：外部 URL、协议相对 URL、未授权路径。

### 9.2 路由与前端测试

- `source=emm`、`needtransfer=1`、`/sso/iam` 都进入 IAM 中转。
- `ssotoken`、`sso_token`、`sso-token`、大小写变体都进入 UniSDP。
- UniSDP 票据与 IAM 标记同时存在时，UniSDP 优先。
- 普通登录页不触发单点。
- 票据读取后 URL 中不再出现票据。
- 单点失败回到 `/login` 并带 `ssoFallback=1`。
- 管理员、渠道账号、PC、移动端分别落到正确页面。
- 管理端和渠道端页面会话互斥，登录一侧时清理另一侧。

### 9.3 假提供方端到端测试

用一个本地 HTTP 服务模拟 IAM/UniSDP：

- 校验请求方法、查询参数和请求体格式。
- 返回成功、过期、无效、用户不存在、超时。
- 记录收到的票据，测试代码不把票据写日志。
- 验证 Cookie 属性、会话恢复、退出清理。
- 验证门户完成页写入页面会话后跳到正确路径。

### 9.4 真实环境回归

必须取得真实票据完成以下场景：

- 管理员用户名登录。
- 渠道手机号登录。
- 渠道账号使用普通用户名登录被拒绝。
- 过期票据、无效票据、缺少票据。
- 重复手机号、停用账号、无角色账号。
- PC 和移动端落点。
- UniSDP 接口模式和门户模式各一次。
- 登录后刷新、访问 `/api/auth/me`、退出登录。

真实票据缺失时，测试报告必须写“阻塞”，不能因为单元测试通过就标记完成。

## 10. 常见故障排查

| 现象 | 优先检查 | 处理 |
| --- | --- | --- |
| 一直停在“正在读取凭证” | 是否在 EMM 内、桥接是否加载、超时是否过长 | 确认 `source=emm` 或移动端；检查 `/emm-h5-sso.js` 加载；缩短 PC 自动尝试超时 |
| “当前环境未检测到 EMM 能力” | `JQAPI` 是否存在 | 确认页面运行在 EMM 客户端；普通浏览器走账号密码 |
| EMM 返回缺少 token | 返回结构是否为 `SSOToken.token` 或 `SSOToken.ltpatoken` | 按真实响应补充解析；不要猜字段 |
| 凭证过期/无效 | 票据是否被重复使用、是否在有效期内 | 重新从入口进入获取新票据；检查系统时间 |
| 未开通单点账号 | 本地账号、角色、状态、手机号是否匹配 | 补账号或修手机号；不要自动建号 |
| 渠道账号用用户名登录失败 | 是否符合“手机号走渠道、用户名走管理端” | 属预期行为；渠道账号必须使用手机号形态 |
| 手机号重复登录被拒绝 | 是否存在多个渠道账号共用手机号 | 先治理账号唯一性 |
| 登录成功但页面仍回登录 | Cookie 是否写入、Domain/Path/SameSite/Secure 是否正确、页面会话是否写入 | 检查浏览器 Cookie、`/api/auth/me`、前端存储键 |
| IAM 配置返回未启用 | 环境变量是否真正进入运行容器 | 读取接口实际响应，不要只看代码默认值 |
| UniSDP 门户成功但页面无会话 | 完成页是否被执行、localStorage 是否被浏览器策略阻止 | 检查 CSP、隐私模式、完成页脚本和跳转路径 |
| UniSDP 票据被当成 IAM | 入口识别顺序是否错误 | UniSDP 票据优先；检查参数名标准化 |
| 日志看不到完整票据 | 这是预期安全行为 | 用票据指纹、`requestId` 和阶段定位 |

## 11. 部署与反向代理

需要确认：

- `/api/` 转发到业务后端，保留 Cookie 和真实 Host。
- `/app/sso.htm` 单独转发到后端，不能被前端 SPA 的 `index.html` 兜底。
- `/sso/iam`、`/sso/unisdp`、`/login` 等前端入口都要返回带 `no-store` 的入口页，避免旧缓存导致票据残留或旧版本代码继续运行。
- 反向代理传递 `X-Request-Id`、`X-Real-IP`、`X-Forwarded-Proto`，并确保应用信任这些头。
- HTTPS 环境 Cookie 必须加 `Secure`；跨域部署时重新评估 `SameSite` 和 CORS，不能直接照搬同源配置。
- 如果后端有多个实例，会话签名密钥、ISAID、校验地址和时间配置必须一致。

## 12. 上线检查与回退

### 上线前

- [ ] 真实成功票据和失败票据各验证一次。
- [ ] 管理员、渠道、PC、移动端落点全部验证。
- [ ] Cookie 属性和页面会话恢复验证。
- [ ] 日志中无完整票据、密码、Cookie、ISAID。
- [ ] 单点失败能回账号密码登录。
- [ ] 旧会话、旧页面缓存和旧开关不会干扰新流程。
- [ ] 提供方不可用时有明确错误提示和监控指标。

### 回退

- 关闭对应单点开关，保留账号密码登录。
- 保留旧版本接口路径和页面入口至少一个发布周期，确认无外部链接依赖后再清理。
- 回退时不要删除审计日志和外部身份映射；先停止新登录，再排查。
- 如果只是自检脚本误判，优先修脚本并重新验证，不要要求用户回退已经健康的服务。

## 13. 需要目标系统确认的事项

以下问题没有统一答案，必须在目标系统落地前确认：

1. 身份提供方是否就是本项目的 IAM/EMM 和 UniSDP，还是只有类似协议。
2. 目标系统使用什么后端语言、前端框架和会话模型。
3. 管理员与渠道账号的判定字段是角色、组织、租户还是其他关系。
4. 手机号是否唯一，是否允许一个国家码格式，历史数据是否脏。
5. 页面会话键名、落点路径和移动端页面是否与 V3 相同。
6. 是否需要外部身份映射、自动开户、账号合并或换绑；默认不做。
7. 是否有真实票据、测试账号、提供方白名单和联调窗口。

这些问题中任何一项影响身份、权限、落点或安全时，先确认再编码。
