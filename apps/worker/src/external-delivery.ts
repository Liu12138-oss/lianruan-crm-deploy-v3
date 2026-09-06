import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";

import type { 应用配置 } from "@lianruan/config";

export interface 外部待投递消息 {
  deliveryId: string;
  channelCode: "wecom" | "wecom_app" | "sms" | "email";
  title: string;
  body: string;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientWecomUserId?: string;
  templateCode: string;
}

export interface 外部投递结果 {
  statusCode: "success" | "retry_wait" | "failed" | "ignored";
  retryable: boolean;
  providerCode: string;
  httpStatus?: number;
  providerMessageId?: string;
  summary: string;
}

type 请求函数 = typeof fetch;

/**
 * 外部通道不得记录原始请求、完整响应、Webhook 或联系人；仅返回可审计的脱敏结果。
 */
export async function 投递外部消息(
  config: 应用配置,
  消息: 外部待投递消息,
  请求: 请求函数 = fetch,
): Promise<外部投递结果> {
  if (消息.channelCode === "wecom") return 投递企微群机器人(config, 消息, 请求);
  if (消息.channelCode === "wecom_app") return 投递企微自建应用(config, 消息, 请求);
  if (消息.channelCode === "sms") return 投递通用短信(config, 消息, 请求);
  return 投递通用邮箱(config, 消息);
}

const 企微应用令牌缓存 = new Map<string, { value: string; expiresAt: number }>();

function 企微应用令牌缓存键(corpId: string, agentId: number, secret: string): string {
  return crypto.createHash("sha256").update(`${corpId}:${agentId}:${secret}`).digest("hex");
}

async function 投递企微自建应用(
  config: 应用配置,
  消息: 外部待投递消息,
  请求: 请求函数,
): Promise<外部投递结果> {
  const 通道 = config.message.channels.wecomApp;
  if (!通道.enabled) return 忽略结果("wecom_app", "企微自建应用通道未启用，未发起外部请求。");
  if (!通道.corpId || !通道.agentId || !通道.secret) {
    return 忽略结果("wecom_app", "企微自建应用凭据未配置完整，未发起外部请求。");
  }
  if (!消息.recipientWecomUserId) {
    return 忽略结果("wecom_app", "接收人未绑定企微 UserId，未发起外部请求。");
  }
  // 自建应用使用企微 Markdown 子集：状态单独强调、业务字段使用引用块逐行展示。
  const 内容 = 构建企微应用Markdown(消息.title, 消息.body);
  const 发送地址 = (token: string) =>
    `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(token)}`;
  const 发送请求 = async (token: string) =>
    发送JSON请求(
      请求,
      发送地址(token),
      {
        touser: 消息.recipientWecomUserId,
        msgtype: "markdown",
        agentid: 通道.agentId,
        markdown: { content: 内容 },
      },
      config.message.channels.requestTimeoutMs,
    );
  const 首次令牌 = await 获取企微应用令牌(config, 通道.corpId, 通道.agentId, 通道.secret, 请求);
  if (首次令牌.error) return 首次令牌.error;
  let 响应 = await 发送请求(首次令牌.token);
  if (响应.networkError) return 可重试结果("wecom_app", 响应.networkError);
  let errcode = 读取数字字段(响应.body, "errcode");
  if (errcode === 40014 || errcode === 42001) {
    // 企微重新获取令牌会使旧令牌立即失效，缓存令牌可能被其他调用方挤掉，这里清缓存并重试一次。
    企微应用令牌缓存.delete(企微应用令牌缓存键(通道.corpId, 通道.agentId, 通道.secret));
    const 重取令牌 = await 获取企微应用令牌(config, 通道.corpId, 通道.agentId, 通道.secret, 请求);
    if (!重取令牌.error) {
      响应 = await 发送请求(重取令牌.token);
      if (响应.networkError) return 可重试结果("wecom_app", 响应.networkError);
      errcode = 读取数字字段(响应.body, "errcode");
    }
  }
  if (响应.status >= 200 && 响应.status < 300 && errcode === 0) {
    return {
      statusCode: "success",
      retryable: false,
      providerCode: "wecom_app",
      httpStatus: 响应.status,
      summary: "企微自建应用已接受请求。",
    };
  }
  if (响应.status === 429 || 响应.status >= 500 || errcode === 45009 || errcode === 45011) {
    return 可重试结果("wecom_app", "企微自建应用暂时不可用。", 响应.status);
  }
  return 失败结果(
    "wecom_app",
    企微应用错误摘要(errcode, 读取文本字段(响应.body, "errmsg")),
    响应.status,
  );
}

function 构建企微应用Markdown(标题: string, 正文: string): string {
  const 安全标题 = 转义企微Markdown文本(标题.trim() || "统一消息提醒");
  const 片段 = 正文
    .replace(/\r\n/g, "\n")
    .split(/[；;。\n]+/)
    .map((值) => 值.trim())
    .filter(Boolean);
  const 状态 = 提取企微提醒状态(标题, 正文);
  const 状态颜色 = /驳回|未通过|失败|拒绝|到期/.test(状态)
    ? "warning"
    : /通过|确认|成功/.test(状态)
      ? "info"
      : "comment";
  const 行: string[] = [
    `**${安全标题}**`,
    `> <font color="${状态颜色}">状态：${转义企微Markdown文本(状态)}</font>`,
  ];
  for (const 片段值 of 片段) {
    const 待解析片段 = 清理既有Markdown字段标记(片段值);
    const 匹配 = 待解析片段.match(/^([^：:]{1,24})[：:](.*)$/);
    if (匹配) {
      const 标签 = 转义企微Markdown文本(匹配[1]?.trim() || "");
      const 值 = 转义企微Markdown文本(匹配[2]?.trim() || "");
      if (标签 && 值) 行.push(`> **${标签}：**${值}`);
    } else if (待解析片段 !== 标题.trim()) {
      行.push(`> ${转义企微Markdown文本(待解析片段.replace(/[。.!！]$/, ""))}`);
    }
  }
  if (行.length === 2 && 正文.trim()) 行.push(转义企微Markdown文本(正文.trim()));
  // 企业微信官方“发送应用消息”约束 Markdown 内容最长 2048 字节。
  return 按字节截断(行.join("\n"), 2_048);
}

function 清理既有Markdown字段标记(值: string): string {
  return 值.replace(/\*\*([^*]+?)\*\*/g, "$1").trim();
}

function 提取企微提醒状态(标题: string, 正文: string): string {
  const 来源 = `${标题} ${正文}`;
  if (/驳回|未通过|拒绝/.test(来源)) return "审批驳回";
  if (/失败/.test(来源)) return "处理失败";
  if (/即将到期|到期/.test(来源)) {
    const 剩余 = 来源.match(/剩余\s*([0-9]+)\s*天/);
    return 剩余 ? `即将到期 · 剩余 ${剩余[1]} 天` : "即将到期";
  }
  if (/待审批|待审核|待处理|等待/.test(来源)) return "待处理";
  if (/通过/.test(来源)) return "审批通过";
  if (/确认完成|已确认|确认/.test(来源)) return "已确认";
  if (/状态已变化|状态已更新|状态变更/.test(来源)) return "状态变更";
  if (/成功/.test(来源)) return "处理成功";
  return "提醒";
}

function 转义企微Markdown文本(值: string): string {
  const 替换: Record<string, string> = {
    "\\": "＼",
    "`": "｀",
    "*": "＊",
    _: "＿",
    "#": "＃",
    "[": "［",
    "]": "］",
    "<": "＜",
    ">": "＞",
  };
  return [...值]
    .map((字符) => 替换[字符] || 字符)
    .join("")
    .trim();
}

async function 获取企微应用令牌(
  config: 应用配置,
  corpId: string,
  agentId: number,
  secret: string,
  请求: 请求函数,
): Promise<{ token: string; error?: never } | { token?: never; error: 外部投递结果 }> {
  const 缓存键 = 企微应用令牌缓存键(corpId, agentId, secret);
  const 已缓存 = 企微应用令牌缓存.get(缓存键);
  if (已缓存 && 已缓存.expiresAt > Date.now() + 60_000) return { token: 已缓存.value };
  const 地址 = new URL("https://qyapi.weixin.qq.com/cgi-bin/gettoken");
  地址.searchParams.set("corpid", corpId);
  地址.searchParams.set("corpsecret", secret);
  const 响应 = await 发送JSON请求(
    请求,
    地址.toString(),
    undefined,
    config.message.channels.requestTimeoutMs,
    {},
    "GET",
  );
  if (响应.networkError) return { error: 可重试结果("wecom_app", 响应.networkError) };
  const token = 读取令牌字段(响应.body, "access_token");
  const errcode = 读取数字字段(响应.body, "errcode");
  if (响应.status >= 200 && 响应.status < 300 && errcode === 0 && token) {
    const expires = Math.max(120, 读取数字字段(响应.body, "expires_in") || 7_200);
    企微应用令牌缓存.set(缓存键, { value: token, expiresAt: Date.now() + (expires - 60) * 1_000 });
    return { token };
  }
  if (响应.status === 429 || 响应.status >= 500) {
    return { error: 可重试结果("wecom_app", "企微自建应用令牌服务暂时不可用。", 响应.status) };
  }
  return { error: 失败结果("wecom_app", "企微自建应用凭据无效或无权获取令牌。", 响应.status) };
}

async function 投递企微群机器人(
  config: 应用配置,
  消息: 外部待投递消息,
  请求: 请求函数,
): Promise<外部投递结果> {
  const 通道 = config.message.channels.wecomGroup;
  if (!通道.enabled || !通道.webhook) {
    return 忽略结果("wecom_group", "企微群机器人通道未启用，未发起外部请求。");
  }
  if (含企微群机器人敏感内容(消息.title, 消息.body)) {
    return 忽略结果("wecom_group", "企微群机器人仅允许脱敏团队汇总，敏感业务正文未发起外部请求。");
  }

  const 内容 = 按字节截断(`${消息.title}\n${消息.body}`.trim(), 2_048);
  const 响应 = await 发送JSON请求(
    请求,
    通道.webhook,
    { msgtype: "text", text: { content: 内容 } },
    config.message.channels.requestTimeoutMs,
  );
  if (响应.networkError) return 可重试结果("wecom_group", 响应.networkError);

  const errcode = 读取数字字段(响应.body, "errcode");
  if (响应.status >= 200 && 响应.status < 300 && errcode === 0) {
    return {
      statusCode: "success",
      retryable: false,
      providerCode: "wecom_group",
      httpStatus: 响应.status,
      summary: "企微群机器人已接受请求。",
    };
  }
  if (响应.status === 429 || 响应.status >= 500 || errcode === 45009 || errcode === 45011) {
    return 可重试结果("wecom_group", "企微群机器人暂时不可用。", 响应.status);
  }
  return 失败结果("wecom_group", "企微群机器人拒绝请求，请核对通道配置。", 响应.status);
}

async function 投递通用短信(
  config: 应用配置,
  消息: 外部待投递消息,
  请求: 请求函数,
): Promise<外部投递结果> {
  const 通道 = config.message.channels.sms;
  if (!通道.enabled) return 忽略结果("sms_generic", "短信通道未启用，未发起外部请求。");
  if (!通道.endpoint || !通道.apiKey || !通道.apiSecret || !通道.templateId) {
    return 忽略结果("sms_generic", "短信供应商凭据或模板未配置，未发起外部请求。");
  }
  if (!消息.recipientPhone)
    return 忽略结果("sms_generic", "接收人未登记可用手机号，未发起外部请求。");

  const 请求体 = {
    templateId: 通道.templateId,
    templateCode: 消息.templateCode,
    recipient: 消息.recipientPhone,
    parameters: { title: 按字节截断(消息.title, 256), body: 按字节截断(消息.body, 512) },
    ...(通道.sender ? { sender: 通道.sender } : {}),
  };
  const 原始请求体 = JSON.stringify(请求体);
  const 签名 = crypto.createHmac("sha256", 通道.apiSecret).update(原始请求体).digest("hex");
  const 响应 = await 发送JSON请求(
    请求,
    通道.endpoint,
    请求体,
    config.message.channels.requestTimeoutMs,
    { authorization: `Bearer ${通道.apiKey}`, "x-message-signature": 签名 },
  );
  if (响应.networkError) return 可重试结果("sms_generic", 响应.networkError);
  if (响应.status === 429 || 响应.status >= 500) {
    return 可重试结果("sms_generic", "短信供应商暂时不可用。", 响应.status);
  }
  if (响应.status >= 200 && 响应.status < 300) {
    const 供应商消息编号 = 读取文本字段(响应.body, "messageId");
    return {
      statusCode: "success",
      retryable: false,
      providerCode: "sms_generic",
      httpStatus: 响应.status,
      ...(供应商消息编号 ? { providerMessageId: 供应商消息编号 } : {}),
      summary: "短信供应商已接受请求。",
    };
  }
  return 失败结果("sms_generic", "短信供应商拒绝请求，请核对通道配置。", 响应.status);
}

/**
 * 邮箱只读取 IAM 当前账号邮箱；完整地址只在本次 SMTP 会话内使用，绝不写入日志或投递回执。
 */
async function 投递通用邮箱(config: 应用配置, 消息: 外部待投递消息): Promise<外部投递结果> {
  const 通道 = config.message.channels.email;
  if (!通道.enabled) return 忽略结果("smtp_generic", "邮箱通道未启用，未发起外部请求。");
  if (!通道.smtpHost || !通道.username || !通道.password || !通道.from) {
    return 忽略结果("smtp_generic", "邮箱供应商参数未配置，未发起外部请求。");
  }
  if (!消息.recipientEmail || !是安全邮箱地址(消息.recipientEmail)) {
    return 忽略结果("smtp_generic", "接收人未登记已授权的有效邮箱，未发起外部请求。");
  }
  if (通道.smtpPort === 465 && 通道.security !== "tls") {
    return 失败结果("smtp_generic", "SMTP 端口 465 必须使用 TLS 安全方式，请保存配置后重试。");
  }

  try {
    const 响应码 = await 发送SMTP邮件({
      host: 通道.smtpHost,
      port: 通道.smtpPort,
      security: 通道.security,
      username: 通道.username,
      password: 通道.password,
      from: 通道.from,
      to: 消息.recipientEmail,
      subject: 消息.title,
      body: 消息.body,
      timeoutMs: config.message.channels.requestTimeoutMs,
    });
    return {
      statusCode: "success",
      retryable: false,
      providerCode: "smtp_generic",
      ...(响应码 ? { httpStatus: 响应码 } : {}),
      summary: "SMTP 服务器已接受邮件。",
    };
  } catch (错误) {
    const 响应码 = 错误 instanceof SMTP响应错误 ? 错误.响应码 : undefined;
    if (响应码 && 响应码 >= 500) {
      return 失败结果("smtp_generic", "SMTP 服务器拒绝邮件，请核对账号或收件人授权。", 响应码);
    }
    return 可重试结果("smtp_generic", "SMTP 服务器暂时不可用。", 响应码);
  }
}

interface SMTP发送参数 {
  host: string;
  port: number;
  security: "starttls" | "tls";
  username: string;
  password: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  timeoutMs: number;
}

class SMTP响应错误 extends Error {
  public constructor(public readonly 响应码?: number) {
    super("SMTP 协议响应异常。");
  }
}

async function 发送SMTP邮件(参数: SMTP发送参数): Promise<number> {
  let 会话 = await 创建SMTP会话(参数.host, 参数.port, 参数.security === "tls", 参数.timeoutMs);
  let 连接 = 会话.连接;
  let 读取器 = 会话.读取器;
  try {
    await 要求SMTP响应(读取器, [220]);
    await 发送SMTP命令(连接, 读取器, "EHLO lianruan-crm-v3", [250]);
    if (参数.security === "starttls") {
      await 发送SMTP命令(连接, 读取器, "STARTTLS", [220]);
      会话 = await 升级为TLS会话(连接, 参数.host, 参数.timeoutMs);
      连接 = 会话.连接;
      读取器 = 会话.读取器;
      await 发送SMTP命令(连接, 读取器, "EHLO lianruan-crm-v3", [250]);
    }
    const 凭据 = Buffer.from(`\u0000${参数.username}\u0000${参数.password}`, "utf8").toString(
      "base64",
    );
    await 发送SMTP命令(连接, 读取器, `AUTH PLAIN ${凭据}`, [235]);
    await 发送SMTP命令(连接, 读取器, `MAIL FROM:<${参数.from}>`, [250]);
    await 发送SMTP命令(连接, 读取器, `RCPT TO:<${参数.to}>`, [250, 251]);
    await 发送SMTP命令(连接, 读取器, "DATA", [354]);
    const 邮件正文 = 构建SMTP邮件正文(参数);
    const 结果 = await 发送SMTP命令(连接, 读取器, `${邮件正文}\r\n.`, [250]);
    await 发送SMTP命令(连接, 读取器, "QUIT", [221]);
    return 结果;
  } finally {
    连接.destroy();
  }
}

interface SMTP会话 {
  连接: net.Socket | tls.TLSSocket;
  读取器: SMTP响应读取器;
}

async function 创建SMTP会话(
  host: string,
  port: number,
  直接TLS: boolean,
  超时毫秒: number,
): Promise<SMTP会话> {
  return new Promise((resolve, reject) => {
    const 连接 = 直接TLS
      ? tls.connect({ host, port, servername: host, minVersion: "TLSv1.2" })
      : net.createConnection({ host, port });
    // 监听器必须在 connect 或 secureConnect 前注册，防止 220 欢迎语先于读取器到达。
    const 读取器 = new SMTP响应读取器(连接, 超时毫秒);
    const 超时器 = setTimeout(失败, 超时毫秒);
    function 失败() {
      clearTimeout(超时器);
      连接.destroy();
      reject(new SMTP响应错误());
    }
    连接.once("error", 失败);
    连接.once(直接TLS ? "secureConnect" : "connect", () => {
      clearTimeout(超时器);
      连接.removeListener("error", 失败);
      resolve({ 连接, 读取器 });
    });
  });
}

async function 升级为TLS会话(
  连接: net.Socket | tls.TLSSocket,
  host: string,
  超时毫秒: number,
): Promise<SMTP会话> {
  return new Promise((resolve, reject) => {
    const 安全连接 = tls.connect({ socket: 连接, servername: host, minVersion: "TLSv1.2" });
    // STARTTLS 握手完成后服务端也可能立即输出欢迎语，需先挂载读取器。
    const 读取器 = new SMTP响应读取器(安全连接, 超时毫秒);
    const 失败 = () => {
      clearTimeout(超时器);
      安全连接.destroy();
      reject(new SMTP响应错误());
    };
    const 超时器 = setTimeout(失败, 超时毫秒);
    安全连接.once("error", 失败);
    安全连接.once("secureConnect", () => {
      clearTimeout(超时器);
      安全连接.removeListener("error", 失败);
      resolve({ 连接: 安全连接, 读取器 });
    });
  });
}

class SMTP响应读取器 {
  private readonly 行集合: string[] = [];
  private 当前读取:
    { resolve: (响应码: number) => void; reject: (错误: Error) => void } | undefined;
  private 剩余数据 = "";

  public constructor(
    private readonly 连接: net.Socket | tls.TLSSocket,
    private readonly 超时毫秒: number,
  ) {
    连接.on("data", (数据: Buffer) => {
      this.剩余数据 += 数据.toString("utf8");
      const 行集合 = this.剩余数据.split(/\r?\n/);
      this.剩余数据 = 行集合.pop() ?? "";
      this.行集合.push(...行集合.filter(Boolean));
      this.尝试完成读取();
    });
    连接.on("error", () => this.当前读取?.reject(new SMTP响应错误()));
    连接.on("close", () => this.当前读取?.reject(new SMTP响应错误()));
  }

  public async 读取(): Promise<number> {
    if (this.当前读取) throw new Error("SMTP 响应读取重入。");
    return new Promise((resolve, reject) => {
      const 超时器 = setTimeout(() => {
        const 当前读取 = this.当前读取;
        if (!当前读取) return;
        this.当前读取 = undefined;
        this.连接.destroy();
        当前读取.reject(new SMTP响应错误());
      }, this.超时毫秒);
      this.当前读取 = {
        resolve: (响应码) => {
          clearTimeout(超时器);
          resolve(响应码);
        },
        reject: (错误) => {
          clearTimeout(超时器);
          reject(错误);
        },
      };
      this.尝试完成读取();
    });
  }

  private 尝试完成读取(): void {
    if (!this.当前读取) return;
    while (this.行集合.length) {
      const 行 = this.行集合.shift() ?? "";
      const 匹配 = /^(\d{3})([ -])/.exec(行);
      if (!匹配) continue;
      if (匹配[2] !== " ") continue;
      const 当前读取 = this.当前读取;
      this.当前读取 = undefined;
      当前读取.resolve(Number(匹配[1]));
      return;
    }
  }
}

async function 发送SMTP命令(
  连接: net.Socket | tls.TLSSocket,
  读取器: SMTP响应读取器,
  命令: string,
  允许响应码: number[],
): Promise<number> {
  await new Promise<void>((resolve, reject) =>
    连接.write(`${命令}\r\n`, (错误) => (错误 ? reject(错误) : resolve())),
  );
  return 要求SMTP响应(读取器, 允许响应码);
}

async function 要求SMTP响应(读取器: SMTP响应读取器, 允许响应码: number[]): Promise<number> {
  const 响应码 = await 读取器.读取();
  if (!允许响应码.includes(响应码)) throw new SMTP响应错误(响应码);
  return 响应码;
}

function 构建SMTP邮件正文(参数: SMTP发送参数): string {
  const 标题 = 参数.subject.replace(/[\r\n]/g, " ").slice(0, 256);
  const 正文 = 参数.body.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..").slice(0, 8_000);
  return [
    `From: <${参数.from}>`,
    `To: <${参数.to}>`,
    `Subject: =?UTF-8?B?${Buffer.from(标题, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    正文,
  ].join("\r\n");
}

function 是安全邮箱地址(value: string): boolean {
  return value.length <= 320 && !/[\r\n]/.test(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function 发送JSON请求(
  请求: 请求函数,
  地址: string,
  请求体: object | undefined,
  超时毫秒: number,
  附加请求头: Record<string, string> = {},
  方法: "GET" | "POST" = "POST",
): Promise<{ status: number; body: unknown; networkError?: string }> {
  const 控制器 = new AbortController();
  const 超时器 = setTimeout(() => 控制器.abort(), 超时毫秒);
  try {
    const 响应 = await 请求(地址, {
      method: 方法,
      headers: { "content-type": "application/json", ...附加请求头 },
      ...(请求体 ? { body: JSON.stringify(请求体) } : {}),
      signal: 控制器.signal,
    });
    return { status: 响应.status, body: await 安全读取响应JSON(响应) };
  } catch {
    return { status: 0, body: null, networkError: "外部通道网络请求失败或超时。" };
  } finally {
    clearTimeout(超时器);
  }
}

async function 安全读取响应JSON(响应: Response): Promise<unknown> {
  try {
    return await 响应.json();
  } catch {
    return null;
  }
}

function 按字节截断(value: string, 最大字节数: number): string {
  let 结果 = "";
  for (const 字符 of value) {
    if (Buffer.byteLength(结果 + 字符, "utf8") > 最大字节数) break;
    结果 += 字符;
  }
  return 结果;
}

function 读取数字字段(value: unknown, 字段: string): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  const 值 = (value as Record<string, unknown>)[字段];
  return typeof 值 === "number" ? 值 : undefined;
}

function 读取文本字段(value: unknown, 字段: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const 值 = (value as Record<string, unknown>)[字段];
  return typeof 值 === "string" && 值.trim() ? 值.trim().slice(0, 128) : undefined;
}

/**
 * 企微 access_token 可达 200+ 字符，不能走 128 截断的通用文本读取。
 */
function 读取令牌字段(value: unknown, 字段: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const 值 = (value as Record<string, unknown>)[字段];
  return typeof 值 === "string" && 值.trim() ? 值.trim() : undefined;
}

const 企微应用错误说明: Record<number, string> = {
  40003: "无效的成员 UserId",
  40013: "无效的 corpId",
  40014: "access_token 无效",
  40058: "请求参数错误（请核对 agentId）",
  42001: "access_token 过期",
  60011: "无权限（请核对应用 Secret 权限范围）",
  60020: "访问来源 IP 不在应用白名单",
  81013: "接收人 UserId 无效（user/party/tag 全部无效）",
  0: "ok",
};

/**
 * 企微拒绝响应只保留错误码和错误文本，去掉 hint 与来源 IP 等辅助字段。
 */
function 企微应用错误摘要(errcode: number | undefined, errmsg: string | undefined): string {
  const 错误码 = typeof errcode === "number" ? String(errcode) : "未知";
  const 说明 = (typeof errcode === "number" ? 企微应用错误说明[errcode] : undefined) || "";
  const 文本 = ((errmsg || "").split(", hint:")[0] || "").trim().slice(0, 64);
  return `企微自建应用拒绝请求：错误码 ${错误码}${说明 ? `（${说明}）` : ""}${文本 ? `，${文本}` : ""}。`;
}

/**
 * 群机器人不能承担个人或业务明细通知。规则宁严勿松，具体业务链接仍只留在站内消息。
 */
function 含企微群机器人敏感内容(title: string, body: string): boolean {
  const 内容 = `${title}\n${body}`;
  return /客户|合同|金额|报价|人民币|[¥￥]|1\d{10}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(内容);
}

function 忽略结果(providerCode: string, summary: string): 外部投递结果 {
  return { statusCode: "ignored", retryable: false, providerCode, summary };
}

function 可重试结果(providerCode: string, summary: string, httpStatus?: number): 外部投递结果 {
  return {
    statusCode: "retry_wait",
    retryable: true,
    providerCode,
    ...(httpStatus ? { httpStatus } : {}),
    summary,
  };
}

function 失败结果(providerCode: string, summary: string, httpStatus?: number): 外部投递结果 {
  return {
    statusCode: "failed",
    retryable: false,
    providerCode,
    ...(httpStatus ? { httpStatus } : {}),
    summary,
  };
}
