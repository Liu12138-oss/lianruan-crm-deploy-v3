import { 应用错误 } from "@lianruan/shared";

/**
 * 企业微信适配器只暴露只读探测能力。真实凭据解析和 HTTP 调用必须由后续独立任务进程注入，
 * API 进程不保存、不过路也不输出应用密钥。
 */
export interface 企业微信连接器摘要 {
  id: string;
  corpId: string;
  agentId: string;
  statusCode: "disabled" | "readonly" | "enabled" | "degraded";
}

export interface 企业微信连接测试结果 {
  corpIdMatched: boolean;
  visibleDepartmentCount: number;
  sampleMemberCount: number;
  elapsedMs: number;
  missingPermissions: string[];
}

export interface 企业微信通讯录适配器 {
  测试连接(连接器: 企业微信连接器摘要): Promise<企业微信连接测试结果>;
}

/** 默认实现显式拒绝真实连接，防止开发、测试或 API 进程误用生产凭据。 */
export class 未配置企业微信通讯录适配器 implements 企业微信通讯录适配器 {
  async 测试连接(): Promise<企业微信连接测试结果> {
    throw new 应用错误(
      "DIRECTORY_SYNC_ADAPTER_UNAVAILABLE",
      "企业微信只读适配器尚未由独立任务进程配置，当前不会发起外部请求。",
      503,
    );
  }
}
