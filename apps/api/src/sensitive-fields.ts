const 敏感字段名 = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "newPassword",
  "oldPassword",
  "initialPassword",
  "tempPassword",
]);

/**
 * 移除接口响应中的账号凭据字段。
 *
 * 历史 V2 数据可能把初始密码写入 extra_json；这些字段只能在服务端内部使用，
 * 任何列表、详情、创建或登录响应都不得回显。函数返回新对象，不修改调用方数据。
 */
export function 移除敏感字段<T>(value: T): T {
  return 递归移除(value) as T;
}

function 递归移除(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => 递归移除(item));
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  const 来源 = value as Record<string, unknown>;
  const 结果: Record<string, unknown> = {};
  for (const [键, 值] of Object.entries(来源)) {
    if (敏感字段名.has(键)) continue;
    结果[键] = 递归移除(值);
  }
  return 结果;
}
