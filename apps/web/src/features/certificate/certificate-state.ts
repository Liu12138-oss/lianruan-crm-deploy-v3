import type { 成员证书 } from "../../api/organization-client.js";

export type 证书到期风险等级 =
  "有效" | "30 天内到期" | "已过期" | "已撤销" | "无到期日" | "日期异常";

const 上海时区偏移毫秒 = 8 * 60 * 60 * 1000;
const 每天毫秒 = 24 * 60 * 60 * 1000;

/** 把日期归一到上海时区的自然日序号，避免浏览器按 UTC 零点解析日期。 */
export function 上海自然日序号(值: unknown): number | null {
  if (值 === null || 值 === undefined || String(值).trim() === "") return null;
  const 原始 = String(值).trim();
  const 纯日期 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(原始);
  if (纯日期) {
    const 年 = Number(纯日期[1]);
    const 月 = Number(纯日期[2]);
    const 日 = Number(纯日期[3]);
    const 校验 = new Date(Date.UTC(年, 月 - 1, 日));
    if (校验.getUTCFullYear() !== 年 || 校验.getUTCMonth() !== 月 - 1 || 校验.getUTCDate() !== 日)
      return null;
    return Math.floor(校验.getTime() / 每天毫秒);
  }
  const 时间 = Date.parse(原始);
  if (Number.isNaN(时间)) return null;
  return Math.floor((时间 + 上海时区偏移毫秒) / 每天毫秒);
}

/** 到期日当天按上海时区完整一天计算；0 天表示今天到期，负数表示已过保。 */
export function 证书剩余自然日(到期日: unknown, 当前毫秒 = Date.now()): number | null {
  const 到期序号 = 上海自然日序号(到期日);
  if (到期序号 === null) return null;
  const 今天序号 = Math.floor((当前毫秒 + 上海时区偏移毫秒) / 每天毫秒);
  return 到期序号 - 今天序号;
}

export function 证书到期风险(
  证书: Pick<成员证书, "statusCode" | "expiresOn">,
  当前毫秒 = Date.now(),
): 证书到期风险等级 {
  if (证书.statusCode === "revoked") return "已撤销";
  if (!证书.expiresOn) return "无到期日";
  const 剩余天数 = 证书剩余自然日(证书.expiresOn, 当前毫秒);
  if (剩余天数 === null) return "日期异常";
  if (剩余天数 < 0) return "已过期";
  if (剩余天数 <= 30) return "30 天内到期";
  return "有效";
}

/** 用写接口返回的新版本就地替换列表记录，保留接口未返回的展示字段。 */
export function 合并证书更新(证书列表: 成员证书[], 更新: 成员证书): 成员证书[] {
  return 证书列表.map((证书) => (证书.id === 更新.id ? { ...证书, ...更新 } : 证书));
}
