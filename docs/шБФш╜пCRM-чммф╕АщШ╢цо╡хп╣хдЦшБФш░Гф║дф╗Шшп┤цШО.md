# 联软 CRM 第一阶段对外联调交付说明

> 日期：2026-06-17  
> 范围：OpenAPI 只读查询、只读统计、AI-agent Markdown 取数。  
> 不包含：业务写入、审批触发、CRM 用户密码交付、业务数据库直连。

## 1. 交付内容

1. OpenAPI 鉴权接口。
2. 当前绑定用户与权限范围接口。
3. 字典/枚举接口。
4. 用户、渠道商、客户报备、商机、报价、订单列表和详情接口。
5. 产品大类、产品模块、功能产品、硬件产品、套餐、产品目录接口。
6. 经营总览、漏斗、渠道贡献、区域贡献、负责人贡献等统计接口。
7. OpenAPI Client 管理页和调用审计页。
8. Markdown 分析取数说明和安全脱敏规则。

## 2. 验收口径

1. AI-agent 能获取 token。
2. `/auth/me` 能返回 client 和绑定 CRM 用户。
3. `/meta/permission-scope` 能返回正确 scope。
4. `/meta/dictionaries` 能返回中文枚举。
5. 六类核心业务列表均支持分页、筛选、`total`。
6. 统计接口按当前权限范围返回数据。
7. 产品目录接口可支持报价构成分析。
8. OpenAPI 响应不返回密码、Secret、Token 等敏感字段。
9. 调用审计可查询 requestId、client、IP、路径和结果。

## 3. 安全边界

1. AI-agent 只拿 OpenAPI `appKey/appSecret`。
2. AI-agent 不拿 CRM 管理员或用户密码。
3. `appSecret` 单独安全交付，不进文档和 Markdown。
4. 所有数据按绑定 CRM 用户权限裁剪。
5. 对外 Markdown 默认脱敏联系人、手机号、邮箱、统一社会信用代码。

## 4. 推荐联调顺序

1. `POST /api/open/v1/auth/token`
2. `GET /api/open/v1/auth/me`
3. `GET /api/open/v1/meta/permission-scope`
4. `GET /api/open/v1/meta/dictionaries`
5. `GET /api/open/v1/diagnostics/self-check`
6. `GET /api/open/v1/analytics/business-overview`
7. 分页读取核心业务列表。
8. 分页读取产品目录列表。
9. 用四组 client 验证权限差异。
