const 依赖中文名称: Record<string, string> = {
  config: "配置校验",
  postgres: "数据库",
  redis: "缓存服务",
  migration: "数据服务",
  worker: "后台任务",
};

/** 把接口依赖名称统一成用户可读的中文名称，不展示内部组件名。 */
export function 依赖中文名(name: string): string {
  return 依赖中文名称[name] || "其他服务";
}

/** 根据检查状态生成业务说明，禁止把接口 message 中的技术文案直接展示给用户。 */
export function 依赖业务说明(name: string, status: string): string {
  const 代码 = String(status || "")
    .trim()
    .toLowerCase();
  const 正常说明: Record<string, string> = {
    config: "基础配置检查通过",
    postgres: "数据库服务正常",
    redis: "缓存服务正常",
    migration: "数据库结构已是最新",
    worker: "后台任务运行正常",
  };
  const 异常说明: Record<string, string> = {
    config: "基础配置检查异常，请联系管理员",
    postgres: "数据库服务异常，请联系管理员",
    redis: "缓存服务异常，请联系管理员",
    migration: "数据结构检查异常，请联系管理员",
    worker: "后台任务运行异常，请联系管理员",
  };

  if (代码 === "ok") return 正常说明[name] || "服务检查通过";
  if (代码 === "skipped") return "当前未启用该检查项";
  if (代码 === "degraded") return "服务响应偏慢，建议关注";
  return 异常说明[name] || "服务检查异常，请联系管理员";
}
