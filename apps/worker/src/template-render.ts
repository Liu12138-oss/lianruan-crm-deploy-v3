/**
 * 统一消息模板渲染器。
 * 模板仅支持白名单变量（{{变量名}}）与白名单函数（{{函数(变量, 参数)}}），
 * 不允许任意表达式，避免把业务信息错误扩散或产生注入面。
 * 变量键必须来自调用方传入的变量字典；函数名必须来自内置白名单。
 */

export type 模板变量字典 = Record<string, string | number>;

const 变量名正则 = /^[a-z][a-z0-9_]*$/;
const 函数名正则 = /^[a-z][a-z0-9_]*$/;

const 毫秒每天 = 86_400_000;

function 上海日期(value: Date): Date {
  const 本地 = new Date(value.getTime() + 8 * 3_600_000);
  return new Date(本地.getUTCFullYear(), 本地.getUTCMonth(), 本地.getUTCDate());
}

function 解析日期(value: string | number): Date | null {
  const 文本 = String(value).trim();
  if (!文本) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(文本)) {
    const 日期 = new Date(`${文本}T00:00:00+08:00`);
    return Number.isNaN(日期.getTime()) ? null : 日期;
  }
  const 日期 = new Date(文本);
  return Number.isNaN(日期.getTime()) ? null : 日期;
}

export function 计算剩余天数(日期值: string | number): string {
  const 日期 = 解析日期(日期值);
  if (!日期) return "0";
  const 差值 = Math.round((日期.getTime() - 上海日期(new Date()).getTime()) / 毫秒每天);
  return String(Math.max(0, 差值));
}

function 读取参数(名称: string | undefined, 变量: 模板变量字典): string | number {
  if (!名称) return "";
  const 名称清理 = 名称.trim();
  if (!变量名正则.test(名称清理)) return "";
  const 值 = 变量[名称清理];
  return 值 === undefined ? "" : 值;
}

function 补零(value: number, 位数 = 2): string {
  return String(value).padStart(位数, "0");
}

function 格式化日期(日期: Date, 格式: string): string {
  const 年 = 日期.getFullYear();
  const 月 = 日期.getMonth() + 1;
  const 日 = 日期.getDate();
  if (格式 === "YYYY-MM-DD") return `${年}-${补零(月)}-${补零(日)}`;
  if (格式 === "MM-DD") return `${补零(月)}-${补零(日)}`;
  if (格式 === "YYYY年MM月DD日") return `${年}年${月}月${日}日`;
  if (格式 === "MM月DD日") return `${月}月${日}日`;
  return `${年}-${补零(月)}-${补零(日)}`;
}

const 函数实现: Record<string, (参数: string[], 变量: 模板变量字典) => string> = {
  days_left(参数, 变量) {
    return 计算剩余天数(读取参数(参数[0], 变量));
  },
  format_date(参数, 变量) {
    const 日期 = 解析日期(读取参数(参数[0], 变量));
    if (!日期) return String(读取参数(参数[0], 变量) || "");
    return 格式化日期(日期, (参数[1] || "YYYY-MM-DD").trim());
  },
};

const 函数调用正则 = /\{\{\s*([a-z][a-z0-9_]*)\s*\(\s*([^)]*)\)\s*\}\}/g;
const 变量引用正则 = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

function 渲染片段(文本: string, 变量: 模板变量字典, 模板用途: string): string {
  let 结果 = 文本.replace(函数调用正则, (_全部, 函数名: string, 参数原文: string) => {
    if (!函数名正则.test(函数名)) {
      throw new Error(`模板${模板用途}包含不支持的函数：${函数名}`);
    }
    const 实现 = 函数实现[函数名];
    if (!实现) {
      throw new Error(`模板${模板用途}包含未注册的函数：${函数名}`);
    }
    const 参数 = 参数原文
      .split(",")
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
    return 实现(参数, 变量);
  });
  const 使用过的变量 = new Set<string>();
  结果 = 结果.replace(变量引用正则, (_全部, 变量名: string) => {
    if (!变量名正则.test(变量名)) {
      throw new Error(`模板${模板用途}包含不支持的变量：${变量名}`);
    }
    if (!(变量名 in 变量)) {
      throw new Error(`模板${模板用途}引用了未提供的变量：${变量名}`);
    }
    使用过的变量.add(变量名);
    return String(变量[变量名]);
  });
  return 结果;
}

export function 渲染模板(
  titleTemplate: string,
  bodyTemplate: string,
  变量: 模板变量字典,
): { title: string; body: string } {
  return {
    title: 渲染片段(titleTemplate, 变量, "标题"),
    body: 渲染片段(bodyTemplate, 变量, "正文"),
  };
}
