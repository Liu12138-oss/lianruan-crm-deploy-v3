# 单点登录接口与字段速查

本文件只放实施时高频核对内容。完整设计、边界和验收流程见 [sso-integration-manual.md](sso-integration-manual.md)。

## 1. 路由

| 能力 | 方法 | 建议路径 | 说明 |
| --- | --- | --- | --- |
| IAM 配置 | GET | `/api/auth/sso/iam/config` | 前端读取启用状态、入口、请求标识和超时 |
| IAM 登录 | POST | `/api/auth/sso/iam/login` | 接收 IAM/EMM 票据，服务端换票 |
| IAM 管理端兼容 | POST | `/api/auth/sso/iam/admin-login-v2` | 固定管理端入口，仅兼容旧调用 |
| IAM 渠道端兼容 | POST | `/api/auth/sso/iam/partner-login-v2` | 固定渠道入口，仅兼容旧调用 |
| UniSDP 登录 | POST | `/api/auth/sso/unisdp/login` | 接收 UniSDP 票据 |
| UniSDP 门户 | GET/POST | `/app/sso.htm` | 服务端完成登录并返回页面会话完成页 |
| 当前会话 | GET | `/api/auth/me` | 恢复 Cookie 会话和页面会话 |
| 退出 | POST | `/api/auth/logout` | 清理 Cookie 会话 |

## 2. 前端入口识别

| 输入 | 识别 | 目标 |
| --- | --- | --- |
| `/sso/iam` | IAM 专属入口 | IAM 中转页 |
| `/login/singlesignonlogin/login.do` | IAM 旧兼容入口 | IAM 中转页 |
| 查询串或 hash 中 `source=emm` | IAM/EMM 标记 | IAM 中转页 |
| 查询串或 hash 中 `needtransfer=1` | IAM 标记 | IAM 中转页 |
| 查询串或 hash 中 `ssotoken` | UniSDP 票据 | UniSDP 中转页 |
| `/sso/unisdp` | UniSDP 专属入口 | UniSDP 中转页 |
| `/app/sso.htm` | UniSDP 门户服务端入口 | 由后端处理，不进入 SPA 中转 |

参数名标准化：去掉 `_` 和 `-`，再转小写。例如 `sso_token`、`sso-token`、`SSO_TOKEN` 都等价于 `ssotoken`。

优先顺序：UniSDP 票据优先于 IAM 标记；平台专属路径优先于查询参数中的 `provider`。

## 3. IAM 请求与响应

### 3.1 前端到业务后端

```http
POST /api/auth/sso/iam/login
Content-Type: application/json
Cookie: <浏览器现有 Cookie，如有>

{
  "token": "<IAM_SSO_TOKEN>",
  "entry": "admin",
  "clientType": "pc"
}
```

字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `token` | 是 | IAM/EMM 票据 |
| `entry` | 否 | `admin` 或 `partner`；只用于选择校验 ISAID |
| `clientType` | 否 | `pc` 或 `mobile`，用于审计和落点提示 |

### 3.2 业务后端到 IAM

```http
POST <IAM_VALIDATE_URL>?isaid=<ISAID>&sso_token=<IAM_SSO_TOKEN>
Content-Type: application/json
```

IAM 成功响应（字段位置可能少一层 `data`）：

```json
{
  "status": 2000,
  "data": {
    "mailuser": {
      "username": "zhangsan",
      "struserdes": "张三",
      "userid": "10001",
      "deptid": "20001",
      "deptname": "华东区"
    }
  }
}
```

兼容：

```json
{
  "status": 2000,
  "mailuser": {
    "username": "zhangsan",
    "struserdes": "张三"
  }
}
```

身份提取顺序：

```text
username: data.mailuser.username -> mailuser.username
displayName: data.mailuser.struserdes -> mailuser.struserdes
userId: data.mailuser.userid -> mailuser.userid
deptId: data.mailuser.deptid -> mailuser.deptid
deptName: data.mailuser.deptname -> mailuser.deptname
```

### 3.3 IAM 状态码

| 状态码 | 含义 | 建议 HTTP 状态 |
| --- | --- | --- |
| 2000 | 成功 | 200 |
| 6005 | 用户不存在 | 401 |
| 6010 | 设备待审核 | 401 |
| 6035 | 凭证过期 | 401 |
| 6036 | 用户离职 | 401 |
| 6041 | 用户禁用 | 401 |
| 6042 | 凭证无效 | 401 |
| 6048 | 设备未绑定 | 401 |
| 6610 | 设备黑名单 | 401 |
| 8095 | 认证服务异常 | 502 |
| 其他 | 未知错误 | 401，优先展示原始 `msg` |

## 4. UniSDP 请求与响应

### 4.1 前端到业务后端

```http
POST /api/auth/sso/unisdp/login
Content-Type: application/json

{
  "token": "<UNISDP_SSO_TOKEN>"
}
```

兼容字段：`token`、`sso_token`、`ssoToken`、`ssotoken`、`code`。

### 4.2 业务后端到 UniSDP

```http
POST <UNISDP_VALIDATE_URL>?sso_token=<UNISDP_SSO_TOKEN>&isaid=<UNISDP_ISAID>
Content-Type: application/x-www-form-urlencoded
Accept: application/json
```

成功响应：

```json
{
  "status": 2000,
  "isLogin": true,
  "username": "zhangsan",
  "mobile": "13800138000"
}
```

成功判定：`status === 2000 && isLogin === true && username 非空`。

手机号常见位置：

```text
mobile
mobilePhone
mobileNo
phone
phoneNumber
phoneNo
telephone
tel
cellphone
cellPhone
userMobile
userPhone
data.mobile
data.mobilePhone
data.phone
data.phoneNumber
data.userMobile
data.userPhone
user.mobile
user.mobilePhone
user.phone
userInfo.mobile
userInfo.mobilePhone
userInfo.phone
userinfo.mobile
userinfo.mobilePhone
userinfo.phone
```

实际字段以目标环境样例为准；不要因为列表里有某个字段就假设提供方一定返回它。

### 4.3 UniSDP 状态码

| 状态 | 含义 | 处理 |
| --- | --- | --- |
| 2000 + `isLogin=true` | 成功 | 继续本地账号匹配 |
| 6001 | 参数为空 | 400 或 401，提示缺少凭证 |
| 6003 | 凭证无效 | 401 |
| 6010 | 凭证过期 | 401 |
| 其他或 `isLogin=false` | 未知失败 | 401，优先使用 `errmsg` |

## 5. 本地账号匹配

### 5.1 手机号规范化

```text
1. 去掉所有非数字字符。
2. 如果是 13 位且以 86 开头，去掉前两位。
3. 结果必须是 11 位且以 1 开头，否则不按手机号形态匹配。
```

示例：

| 输入 | 结果 |
| --- | --- |
| `+86 138-0013-8000` | `13800138000` |
| `8613800138000` | `13800138000` |
| `13800138000` | `13800138000` |
| `010-88886666` | 不按手机号匹配 |

### 5.2 匹配结果

| 形态 | 本地匹配 | 入口 | 失败处理 |
| --- | --- | --- | --- |
| 11 位手机号 | 渠道账号手机号 | `partner` | 未命中 403；重复 409 |
| 非手机号 | 本地用户名 | `admin` | 未命中或无管理角色 403 |

本地账号必须同时满足：

- 账号存在且状态可用于登录。
- 手机号形态账号具有渠道成员关系或渠道角色。
- 用户名形态账号具有管理端角色。
- 账号允许进入对应工作区。

## 6. 会话与响应

### 6.1 Cookie 建议

```text
HttpOnly
Path=/
SameSite=Lax
Max-Age=<会话秒数>
Secure（HTTPS 必须）
```

### 6.2 页面会话键

管理端：

```text
admin_auth_token
admin_user_info
admin_api_user
```

渠道端：

```text
partner_auth_token
partner_user_info
partner_api_user
api_user（兼容键，仅在渠道端写入）
```

登录成功后清理另一侧键，避免身份混用。

### 6.3 登录成功响应

```json
{
  "success": true,
  "data": {
    "user": {
      "username": "local-user",
      "displayName": "本地显示名",
      "roleName": "本地角色",
      "defaultPath": "/admin",
      "allowedPaths": ["/admin", "/mobile"],
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

### 6.4 失败响应

建议保持统一错误结构：

```json
{
  "success": false,
  "error": {
    "code": "AUTH_SSO_INVALID",
    "message": "单点凭证无效，请重新发起登录。",
    "requestId": "<REQUEST_ID>"
  }
}
```

错误码建议：

| 场景 | HTTP | 错误码 |
| --- | --- | --- |
| 缺少票据 | 400 | `AUTH_SSO_BAD_REQUEST` |
| 提供方拒绝 | 401 | `AUTH_SSO_REJECTED` |
| 本地账号未开通 | 403 | `AUTH_SSO_USER_NOT_FOUND` 或 `AUTH_SSO_PARTNER_NOT_FOUND` |
| 手机号重复 | 409 | `AUTH_SSO_PARTNER_PHONE_NOT_UNIQUE` |
| 提供方超时 | 504 | `AUTH_SSO_TIMEOUT` |
| 提供方异常 | 502 | `AUTH_SSO_PROVIDER_ERROR` |
| 单点未启用 | 503 | `AUTH_SSO_DISABLED` |

## 7. 配置映射

| 通用语义 | 本项目 V3 变量 | 是否敏感 |
| --- | --- | --- |
| IAM 总开关 | `V3_IAM_H5_SSO_ENABLED` | 否 |
| IAM 校验地址 | `V3_IAM_H5_SSO_VALIDATE_URL` | 否，内部地址不公开 |
| IAM 统一校验标识 | `V3_IAM_H5_SSO_VALIDATE_ISAID` | 是 |
| IAM 管理端校验标识 | `V3_IAM_H5_SSO_ADMIN_VALIDATE_ISAID` | 是 |
| IAM 渠道端校验标识 | `V3_IAM_H5_SSO_PARTNER_VALIDATE_ISAID` | 是 |
| IAM 管理端请求标识 | `V3_IAM_H5_SSO_ADMIN_REQUEST_ISAID` | 是 |
| IAM 渠道端请求标识 | `V3_IAM_H5_SSO_PARTNER_REQUEST_ISAID` | 是 |
| IAM 超时 | `V3_IAM_H5_SSO_TIMEOUT_MS` | 否 |
| UniSDP 总开关 | `V3_UNISDP_SSO_ENABLED` | 否 |
| UniSDP 校验地址 | `V3_UNISDP_SSO_VALIDATE_URL` | 否 |
| UniSDP 应用标识 | `V3_UNISDP_SSO_ISAID` | 是 |
| UniSDP 超时 | `V3_UNISDP_SSO_TIMEOUT_MS` | 否 |

## 8. 测试断言速查

### IAM

- [ ] `status=2000` 且用户名在两种位置都能解析。
- [ ] 非 2000 返回 401，不被误判为 502。
- [ ] 超时返回 504。
- [ ] 缺少 `token` 返回 400。
- [ ] 统一入口没有 `entry` 且两端 ISAID 不同返回 400。
- [ ] 手机号形态账号即使传 `entry=admin` 也只能进渠道端。
- [ ] 渠道账号用普通用户名登录被拒绝。

### UniSDP

- [ ] `status=2000 && isLogin=true` 才成功。
- [ ] `isLogin=false` 返回 401。
- [ ] 手机号优先于用户名判定形态。
- [ ] 门户失败 302 到 `/login?ssoFallback=1&provider=unisdp`。
- [ ] 门户成功页写入页面会话后跳转正确页面。
- [ ] 完成页对 `<` 做转义，防 XSS。

### 会话与安全

- [ ] Cookie 有 `HttpOnly`，HTTPS 有 `Secure`。
- [ ] 登录后 URL 不再包含票据。
- [ ] 日志不含完整票据、密码、Cookie、ISAID。
- [ ] `redirect` 只允许本站且账号有权限的路径。
- [ ] 退出登录清理 Cookie 和页面会话。
- [ ] 刷新页面能通过 `/api/auth/me` 恢复会话。

## 9. 最小假提供方响应

### IAM 成功

```json
{
  "status": 2000,
  "data": { "mailuser": { "username": "admin01", "struserdes": "管理员" } }
}
```

### IAM 过期

```json
{ "status": 6035, "msg": "sso token expired" }
```

### UniSDP 成功

```json
{ "status": 2000, "isLogin": true, "username": "13800138000" }
```

### UniSDP 无效

```json
{ "status": 6003, "isLogin": false, "errmsg": "invalid sso_token" }
```
