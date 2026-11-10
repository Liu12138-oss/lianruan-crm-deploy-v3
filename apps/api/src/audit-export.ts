/**
 * 操作审计导出统一列白名单。
 * 只输出业务可读字段，禁止把密码、Cookie、令牌、AppSecret 等敏感内容带出。
 */
export interface 审计导出行 {
  时间: string;
  操作人账号: string;
  操作人姓名: string;
  角色: string;
  审计分类: string;
  模块编码: string;
  动作编码: string;
  对象类型: string;
  对象编号: string;
  对象名称: string;
  结果: string;
  说明: string;
  IP: string;
  请求编号: string;
}

const 审计导出表头 = [
  "时间",
  "操作人账号",
  "操作人姓名",
  "角色",
  "审计分类",
  "模块编码",
  "动作编码",
  "对象类型",
  "对象编号",
  "对象名称",
  "结果",
  "说明",
  "IP",
  "请求编号",
] as const;

const 敏感键模式 =
  /(password|passwd|cookie|authorization|appsecret|clientsecret|secret|token|access[_-]?key)/i;

/** 对可能包含请求快照的说明字段做兜底脱敏，防止历史脏数据把凭据带入导出文件。 */
function 清理文本(value: unknown): string {
  let text = String(value ?? "");
  if (敏感键模式.test(text)) {
    text = text
      .replace(
        /(["']?(?:password|passwd|cookie|authorization|appSecret|clientSecret|secret|token|access[_-]?key)["']?\s*[:=]\s*)["']?[^"',;}\s]+["']?/gi,
        "$1[已脱敏]",
      )
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [已脱敏]");
  }
  // 表格软件会把 =、+、-、@ 开头的单元格当公式执行；导出前强制按文本处理。
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return text;
}

function 转CSV单元格(value: unknown): string {
  return `"${清理文本(value).replaceAll('"', '""')}"`;
}

export function 生成审计导出CSV(rows: 审计导出行[]): Buffer {
  const lines = [
    审计导出表头.map(转CSV单元格).join(","),
    ...rows.map((行) => 审计导出表头.map((列) => 转CSV单元格(行[列])).join(",")),
  ];
  return Buffer.from(`\uFEFF${lines.join("\r\n")}`, "utf8");
}

export function 审计导出文件名(日期 = new Date()): string {
  const 上海时间 = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(日期)
    .replaceAll("/", "")
    .replaceAll(":", "")
    .replaceAll(" ", "-");
  return `操作审计-${上海时间}.csv`;
}
