# 联调专用 OpenAPI Client 创建说明

> 日期：2026-06-17  
> 用途：供联软 CRM 超级管理员创建 AI-agent / crm-agent 联调凭证。  
> 安全说明：本文只放创建规则和占位符，不填写真实 `appSecret`。

## 1. 创建入口

超级管理员登录 CRM 管理后台，进入：

```text
OpenAPI 对接 -> OpenAPI Client -> 新增 OpenAPI Client
```

也可以调用管理接口：

```http
POST /api/open-api/clients
```

管理接口需要超级管理员 `operatorId`，仅用于 CRM 内部管理，不给 AI-agent 使用。

## 2. 推荐联调 Client

| clientName | 绑定用户 | 角色 | 用途 | 建议资源 |
|---|---|---|---|---|
| `AI-agent-superadmin-sit` | `A030 / liulonghai` | `superadmin` | 全量联调、经营总览 | `["*"]` |
| `AI-agent-admin-sit` | `A013 / admin_sd` | `admin` | 区域权限验证 | 核心业务 + analytics |
| `AI-agent-partner-admin-sit` | `PA001 / liangcui` | `partner_admin` | 渠道权限验证 | 核心业务 + analytics |
| `AI-agent-staff-sit` | `S022 / shangxichao` | `staff` | 个人权限验证 | 核心业务 + analytics |

## 3. 创建参数模板

```json
{
  "name": "AI-agent-superadmin-sit",
  "boundUserId": "A030",
  "ipWhitelist": ["8.129.9.164", "10.18.16.114"],
  "allowedResources": ["*"],
  "expiresAt": "",
  "remark": "AI-agent SIT 联调，只读查询"
}
```

## 4. 密钥交付规则

1. `appSecret` 明文只在新建或重置后展示一次。
2. 不把 `appSecret` 写入 Markdown、接口文档、前端代码、截图或普通聊天记录。
3. `appKey/appSecret` 通过双方确认的安全渠道单独交付。
4. 如怀疑泄露，立即在 CRM 后台重置密钥。
5. AI-agent 不接收 CRM 管理员密码或普通用户密码。

## 5. 启用前检查

1. 绑定用户状态为 `active`。
2. 出口 IP 已加入白名单。
3. `allowedResources` 包含当前要调用的资源。
4. 使用 `/api/open/v1/auth/token` 获取 token 成功。
5. 使用 `/api/open/v1/diagnostics/self-check` 检查资源授权和可见数量。
