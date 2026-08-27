import crypto from "node:crypto";

import { 校验消息通道配置加密密钥,type 消息通道密文, 解密消息通道配置 } from "@lianruan/config";

import { 订单预审外部错误 } from "./order-preapproval-eteams.js";

export interface 企微自建应用凭据 {
  corpId: string;
  secret: string;
}

export interface 订单预审群参数 {
  群编号: string;
  群名称: string;
  群主企微编号: string;
  成员企微编号: string[];
}

const 令牌缓存 = new Map<string, { value: string; expiresAt: number }>();

/** 订单预审建群只接收消息平台解密后的短期运行凭据，不读取订单预审环境变量。 */
export class 企微订单预审群客户端 {
  public constructor(
    private readonly 凭据: 企微自建应用凭据,
    private readonly 超时毫秒: number,
    private readonly 请求: typeof fetch = fetch,
  ) {}

  public async 查询群(群编号: string): Promise<string | null> {
    const accessToken = await this.获取令牌();
    const 地址 = new URL("https://qyapi.weixin.qq.com/cgi-bin/appchat/get");
    地址.searchParams.set("access_token", accessToken);
    地址.searchParams.set("chatid", 群编号);
    const 响应 = await this.发送请求("查询订单预审群", 地址, { method: "GET" }, true);
    const 错误码 = 读取企微错误码(响应.json);
    if (错误码 === 0) return 读取文本(响应.json, "chatid") || 群编号;
    if (错误码 === 40003) return null;
    throw 构建企微错误("查询订单预审群", 响应.status, 错误码, true);
  }

  public async 创建群(参数: 订单预审群参数): Promise<string> {
    const accessToken = await this.获取令牌();
    const 地址 = new URL("https://qyapi.weixin.qq.com/cgi-bin/appchat/create");
    地址.searchParams.set("access_token", accessToken);
    let 响应: 企微响应;
    try {
      响应 = await this.发送请求(
        "创建订单预审群",
        地址,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: 参数.群名称,
            owner: 参数.群主企微编号,
            userlist: 参数.成员企微编号,
            chatid: 参数.群编号,
          }),
        },
        false,
      );
    } catch (错误) {
      if (错误 instanceof 订单预审外部错误 && 错误.retryable) {
        throw new 订单预审外部错误(
          "WECOM_GROUP_CREATE_RESULT_UNCERTAIN",
          "企微建群未获得可确认响应，已转人工确认以避免重复建群。",
          { httpStatus: 错误.httpStatus, manualConfirmationRequired: true },
        );
      }
      throw 错误;
    }
    const 错误码 = 读取企微错误码(响应.json);
    if (错误码 !== 0) {
      const 限流或服务异常 =
        响应.status === 429 || 响应.status >= 500 || 错误码 === 45009 || 错误码 === 45011;
      if (限流或服务异常) {
        throw new 订单预审外部错误(
          "WECOM_GROUP_CREATE_RESULT_UNCERTAIN",
          "企微建群未获得可确认响应，已转人工确认以避免重复建群。",
          { httpStatus: 响应.status, manualConfirmationRequired: true },
        );
      }
      throw 构建企微错误("创建订单预审群", 响应.status, 错误码, false);
    }
    return 读取文本(响应.json, "chatid") || 参数.群编号;
  }

  public async 发送群通知(群编号: string): Promise<void> {
    const accessToken = await this.获取令牌();
    const 地址 = new URL("https://qyapi.weixin.qq.com/cgi-bin/appchat/send");
    地址.searchParams.set("access_token", accessToken);
    const 响应 = await this.发送请求(
      "发送订单预审群通知",
      地址,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chatid: 群编号,
          msgtype: "text",
          text: { content: "订单预审流程已发起，请在 OA 审批。" },
          safe: 0,
        }),
      },
      true,
    );
    const 错误码 = 读取企微错误码(响应.json);
    if (错误码 !== 0) throw 构建企微错误("发送订单预审群通知", 响应.status, 错误码, true);
  }

  private async 获取令牌(): Promise<string> {
    const 缓存键 = crypto
      .createHash("sha256")
      .update(`${this.凭据.corpId}:${this.凭据.secret}`)
      .digest("hex");
    const 已缓存 = 令牌缓存.get(缓存键);
    if (已缓存 && 已缓存.expiresAt > Date.now() + 60_000) return 已缓存.value;
    const 地址 = new URL("https://qyapi.weixin.qq.com/cgi-bin/gettoken");
    地址.searchParams.set("corpid", this.凭据.corpId);
    地址.searchParams.set("corpsecret", this.凭据.secret);
    const 响应 = await this.发送请求("获取企微应用令牌", 地址, { method: "GET" }, true);
    const 错误码 = 读取企微错误码(响应.json);
    const accessToken = 读取文本(响应.json, "access_token");
    if (错误码 !== 0 || !accessToken)
      throw 构建企微错误("获取企微应用令牌", 响应.status, 错误码, true);
    const 有效秒数 = Math.max(120, Number(读取文本(响应.json, "expires_in")) || 7_200);
    令牌缓存.set(缓存键, { value: accessToken, expiresAt: Date.now() + (有效秒数 - 60) * 1_000 });
    return accessToken;
  }

  private async 发送请求(
    动作: string,
    地址: URL,
    初始化: RequestInit,
    可安全重试: boolean,
  ): Promise<企微响应> {
    const 控制器 = new AbortController();
    const 计时器 = setTimeout(() => 控制器.abort(), this.超时毫秒);
    try {
      const 响应 = await this.请求(地址, { ...初始化, signal: 控制器.signal });
      return { status: 响应.status, json: await 读取响应JSON(响应) };
    } catch (错误) {
      if (错误 instanceof 订单预审外部错误) throw 错误;
      const 超时 = 控制器.signal.aborted || (错误 instanceof Error && 错误.name === "AbortError");
      throw new 订单预审外部错误(
        超时 ? "WECOM_TIMEOUT" : "WECOM_NETWORK_ERROR",
        超时 ? `企微${动作}超时。` : `企微${动作}网络异常。`,
        可安全重试 ? { retryable: true } : { manualConfirmationRequired: true },
      );
    } finally {
      clearTimeout(计时器);
    }
  }
}

export function 解密订单预审企微应用凭据(
  密文: 消息通道密文,
  加密密钥: string | undefined,
): 企微自建应用凭据 {
  if (!加密密钥) {
    throw new 订单预审外部错误(
      "WECOM_CHANNEL_KEY_MISSING",
      "未配置消息平台通道加密密钥，无法读取企微建群应用。",
      {},
    );
  }
  const 密钥 = 校验消息通道配置加密密钥(加密密钥);
  if (!密钥) {
    throw new 订单预审外部错误("WECOM_CHANNEL_KEY_INVALID", "消息平台通道加密密钥无效。", {});
  }
  const 配置 = 解密消息通道配置<Record<string, unknown>>(密文, 密钥);
  const corpId = typeof 配置.corpId === "string" ? 配置.corpId.trim() : "";
  const secret = typeof 配置.secret === "string" ? 配置.secret.trim() : "";
  if (!corpId || !secret) {
    throw new 订单预审外部错误(
      "WECOM_CHANNEL_CONFIG_INVALID",
      "消息平台企微自建应用配置不完整。",
      {},
    );
  }
  return { corpId, secret };
}

interface 企微响应 {
  status: number;
  json: unknown;
}

function 构建企微错误(
  动作: string,
  httpStatus: number,
  错误码: number | undefined,
  可安全重试: boolean,
): 订单预审外部错误 {
  const 限流或服务异常 =
    httpStatus === 429 || httpStatus >= 500 || 错误码 === 45009 || 错误码 === 45011;
  const 可重试 = 可安全重试 && 限流或服务异常;
  return new 订单预审外部错误(
    错误码 === undefined ? `WECOM_HTTP_${httpStatus}` : `WECOM_${错误码}`,
    限流或服务异常
      ? `企微${动作}暂时不可用。`
      : `企微${动作}被拒绝，请核对应用权限、群主或成员可见范围。`,
    可重试 ? { httpStatus, retryable: true } : { httpStatus },
  );
}

function 读取企微错误码(原始: unknown): number | undefined {
  if (!是记录(原始)) return undefined;
  const 值 = 原始.errcode;
  return typeof 值 === "number"
    ? 值
    : typeof 值 === "string" && /^-?\d+$/.test(值)
      ? Number(值)
      : undefined;
}

function 读取文本(原始: unknown, 字段: string): string | undefined {
  if (!是记录(原始)) return undefined;
  const 值 = 原始[字段];
  return typeof 值 === "string" || typeof 值 === "number" ? String(值) : undefined;
}

async function 读取响应JSON(响应: Response): Promise<unknown> {
  const 文本 = await 响应.text();
  if (!文本.trim()) return {};
  try {
    return JSON.parse(文本) as unknown;
  } catch {
    throw new 订单预审外部错误("WECOM_RESPONSE_INVALID", "企微接口返回了无法识别的响应。", {
      httpStatus: 响应.status,
      retryable: 响应.status >= 500,
    });
  }
}

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return Boolean(值) && typeof 值 === "object" && !Array.isArray(值);
}
