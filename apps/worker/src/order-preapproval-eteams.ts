import type { 应用配置 } from "@lianruan/config";

export interface 订单预审字段映射 {
  productTypeValue: string;
  purchaseContentValue: string;
  fields: {
    region: 订单预审字段定义;
    orderNo: 订单预审字段定义;
    contractPartner: 订单预审字段定义;
    endUser: 订单预审字段定义;
    productType: 订单预审字段定义;
    purchaseContent: 订单预审字段定义;
    purchaseAttachment: 订单预审字段定义;
    quoteAttachment: 订单预审字段定义;
  };
}

export interface 订单预审字段定义 {
  fieldId: string;
  controlType: "select" | "text" | "checkbox" | "textarea" | "file";
}

export interface 订单预审流程数据 {
  workflowId: string;
  formId: string;
  发起人泛微编号: string;
  订单编号: string;
  合同对方: string;
  最终用户: string;
  所属区域: string;
  字段映射: 订单预审字段映射;
  采购订单附件: 泛微上传文件;
  报价单附件: 泛微上传文件;
}

export interface 泛微上传文件 {
  fileId: string;
  fileName: string;
}

export interface 泛微流程回查条件 {
  订单编号: string;
  所属区域: string;
  产品类型: string;
  采购内容: string;
  采购订单字段编号: string;
  报价单字段编号: string;
}

export class 订单预审外部错误 extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly options: {
      httpStatus?: number | undefined;
      retryable?: boolean;
      manualConfirmationRequired?: boolean;
    } = {},
  ) {
    super(message);
    this.name = "订单预审外部错误";
  }

  public get httpStatus(): number | undefined {
    return this.options.httpStatus;
  }

  public get retryable(): boolean {
    return this.options.retryable === true;
  }

  public get manualConfirmationRequired(): boolean {
    return this.options.manualConfirmationRequired === true;
  }
}

/** 泛微凭据只在任务进程内使用，任何返回值均不包含访问令牌。 */
export class 泛微订单预审客户端 {
  public constructor(
    private readonly config: 应用配置["orderPreapproval"],
    private readonly 请求: typeof fetch = fetch,
  ) {}

  public async 上传报价单(
    发起人泛微编号: string,
    文件名: string,
    文件内容: Buffer,
  ): Promise<泛微上传文件> {
    const accessToken = await this.获取访问令牌();
    const 地址 = this.创建地址("/api/file/v2/common/upload");
    地址.searchParams.set("access_token", accessToken);
    const 表单 = new FormData();
    表单.set("userid", 发起人泛微编号);
    表单.set("module", "workflow");
    表单.set("name", 文件名);
    表单.set("size", String(文件内容.length));
    表单.set("file", new Blob([Uint8Array.from(文件内容)], { type: "application/pdf" }), 文件名);
    const 响应 = await this.发送请求("上传报价单", 地址, {
      method: "POST",
      body: 表单,
    });
    const 文件编号 =
      读取字符串(响应.json, ["message", "fileid"]) || 读取字符串(响应.json, ["fileid"]);
    if (!文件编号) {
      throw new 订单预审外部错误("ETEAMS_UPLOAD_RESPONSE_INVALID", "泛微附件上传未返回文件编号。", {
        httpStatus: 响应.status,
      });
    }
    return { fileId: 文件编号, fileName: 文件名 };
  }

  public async 创建并流转流程(数据: 订单预审流程数据): Promise<string> {
    const accessToken = await this.获取访问令牌();
    const 地址 = this.创建地址("/api/workflow/core/paService/v2/doCreateRequest");
    地址.searchParams.set("access_token", accessToken);
    const 请求体 = 序列化订单预审创建载荷(数据);
    let 响应: 泛微响应;
    try {
      响应 = await this.发送请求("创建并流转流程", 地址, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: 请求体,
      });
    } catch (错误) {
      if (错误 instanceof 订单预审外部错误 && 错误.retryable) {
        throw new 订单预审外部错误(
          "ETEAMS_CREATE_RESULT_UNCERTAIN",
          "泛微创建流程请求未获得可确认响应，已转人工确认以避免重复流程。",
          { httpStatus: 错误.httpStatus, manualConfirmationRequired: true },
        );
      }
      throw 错误;
    }
    const 流程编号 =
      读取字符串(响应.json, ["message", "requestId"]) ||
      读取字符串(响应.json, ["requestId"]) ||
      读取字符串(响应.json, ["data", "requestId"]);
    if (!流程编号) {
      throw new 订单预审外部错误("ETEAMS_CREATE_RESPONSE_INVALID", "泛微未返回流程实例编号。", {
        httpStatus: 响应.status,
      });
    }
    return 流程编号;
  }

  public async 回查流程(
    发起人泛微编号: string,
    流程编号: string,
    条件: 泛微流程回查条件,
  ): Promise<void> {
    const accessToken = await this.获取访问令牌();
    const 地址 = this.创建地址("/workflow/v2/getInfoByID");
    地址.searchParams.set("access_token", accessToken);
    地址.searchParams.set("userid", 发起人泛微编号);
    地址.searchParams.set("id", 流程编号);
    let 响应: 泛微响应;
    try {
      响应 = await this.发送请求("回查流程", 地址, { method: "GET" });
    } catch (错误) {
      if (错误 instanceof 订单预审外部错误 && 错误.retryable) {
        throw new 订单预审外部错误(
          "ETEAMS_VERIFY_RETRYABLE",
          "泛微流程回查暂时不可用，将仅回查已取得的流程编号，不会重复创建流程。",
          { httpStatus: 错误.httpStatus, retryable: true },
        );
      }
      throw 错误;
    }
    校验流程回查结果(响应.json, 条件, 响应.status);
  }

  private async 获取访问令牌(): Promise<string> {
    const 认证码地址 = this.创建地址("/oauth2/authorize");
    认证码地址.searchParams.set("corpid", this.读取配置("corpId"));
    认证码地址.searchParams.set("response_type", "code");
    const 授权响应 = await this.发送请求("获取泛微授权码", 认证码地址, { method: "GET" });
    const 授权码 = 读取字符串(授权响应.json, ["code"]);
    if (!授权码) {
      throw new 订单预审外部错误("ETEAMS_AUTH_CODE_MISSING", "泛微授权接口未返回授权码。", {
        httpStatus: 授权响应.status,
      });
    }
    const 参数 = new URLSearchParams({
      app_key: this.读取配置("appKey"),
      app_secret: this.读取配置("appSecret"),
      grant_type: "authorization_code",
      code: 授权码,
    });
    const 令牌响应 = await this.发送请求(
      "获取泛微访问令牌",
      this.创建地址("/oauth2/access_token"),
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: 参数.toString(),
      },
    );
    const accessToken =
      读取字符串(令牌响应.json, ["accessToken"]) || 读取字符串(令牌响应.json, ["access_token"]);
    if (!accessToken) {
      throw new 订单预审外部错误("ETEAMS_ACCESS_TOKEN_MISSING", "泛微令牌接口未返回访问令牌。", {
        httpStatus: 令牌响应.status,
      });
    }
    return accessToken;
  }

  private 创建地址(pathname: string): URL {
    const origin = this.读取配置("origin").replace(/\/$/, "");
    return new URL(`${origin}${pathname}`);
  }

  private 读取配置<T extends keyof 应用配置["orderPreapproval"]["eteams"]>(字段: T): string {
    const 值 = this.config.eteams[字段];
    if (!值) throw new 订单预审外部错误("ETEAMS_CONFIG_MISSING", "泛微连接配置不完整。", {});
    return String(值);
  }

  private async 发送请求(动作: string, 地址: URL, 初始化: RequestInit): Promise<泛微响应> {
    const 超时控制器 = new AbortController();
    const 计时器 = setTimeout(() => 超时控制器.abort(), this.config.requestTimeoutMs);
    try {
      const 响应 = await this.请求(地址, { ...初始化, signal: 超时控制器.signal });
      const json = await 读取响应JSON(响应);
      const 错误码 = 读取错误码(json);
      if (!响应.ok || (错误码 !== undefined && String(错误码) !== "0")) {
        throw 构建泛微接口错误(动作, 响应.status, 错误码);
      }
      return { status: 响应.status, json };
    } catch (错误) {
      if (错误 instanceof 订单预审外部错误) throw 错误;
      const 超时 =
        超时控制器.signal.aborted || (错误 instanceof Error && 错误.name === "AbortError");
      throw new 订单预审外部错误(
        超时 ? "ETEAMS_TIMEOUT" : "ETEAMS_NETWORK_ERROR",
        超时 ? `泛微${动作}超时。` : `泛微${动作}网络异常。`,
        { retryable: true },
      );
    } finally {
      clearTimeout(计时器);
    }
  }
}

interface 泛微响应 {
  status: number;
  json: unknown;
}

/**
 * 泛微字段编号均超过 JavaScript 安全整数范围，必须以数字字面量输出。
 * 这里不能用 Number 转换，否则字段编号会在 JSON 序列化前失真。
 */
export function 序列化订单预审创建载荷(数据: 订单预审流程数据): string {
  const 字段 = 数据.字段映射.fields;
  const 文本字段 = [
    构建文本字段(字段.region.fieldId, 数据.所属区域),
    构建文本字段(字段.orderNo.fieldId, 数据.订单编号),
    构建文本字段(字段.contractPartner.fieldId, 数据.合同对方),
    构建文本字段(字段.endUser.fieldId, 数据.最终用户),
    构建文本字段(字段.productType.fieldId, 数据.字段映射.productTypeValue),
    构建文本字段(字段.purchaseContent.fieldId, 数据.字段映射.purchaseContentValue),
    构建附件字段(字段.purchaseAttachment.fieldId, 数据.采购订单附件),
    构建附件字段(字段.quoteAttachment.fieldId, 数据.报价单附件),
  ];
  return [
    "{",
    `\"userid\":${JSON.stringify(数据.发起人泛微编号)},`,
    `\"workflowId\":${JSON.stringify(数据.workflowId)},`,
    `\"requestname\":${JSON.stringify(`渠道产品订单预审-${数据.订单编号}`)},`,
    '"isnextflow":1,',
    '"isVerifyFormRequired":true,',
    '"formData":{',
    `\"formId\":${JSON.stringify(数据.formId)},`,
    '"module":"workflow",',
    `\"dataDetails\":[${文本字段.join(",")}]`,
    "}",
    "}",
  ].join("");
}

export function 校验订单预审字段映射(原始: unknown): 订单预审字段映射 {
  if (!是记录(原始) || !是记录(原始.fields)) {
    throw new 订单预审外部错误(
      "ORDER_PREAPPROVAL_TEMPLATE_INVALID",
      "订单预审模板字段映射缺失。",
      {},
    );
  }
  const fields = 原始.fields;
  const 读取字段 = (
    名称: keyof 订单预审字段映射["fields"],
    控件类型: 订单预审字段定义["controlType"],
  ) => {
    const 值 = fields[名称];
    if (
      !是记录(值) ||
      typeof 值.fieldId !== "string" ||
      !/^\d{10,30}$/.test(值.fieldId) ||
      值.controlType !== 控件类型
    ) {
      throw new 订单预审外部错误(
        "ORDER_PREAPPROVAL_TEMPLATE_INVALID",
        `订单预审模板字段“${名称}”无效。`,
        {},
      );
    }
    return { fieldId: 值.fieldId, controlType: 控件类型 };
  };
  if (
    原始.productTypeValue !== "EPP渠道产品" ||
    原始.purchaseContentValue !== "详见采购订单上传处的报价单"
  ) {
    throw new 订单预审外部错误(
      "ORDER_PREAPPROVAL_TEMPLATE_INVALID",
      "订单预审模板固定字段值不符合已验证规则。",
      {},
    );
  }
  return {
    productTypeValue: 原始.productTypeValue,
    purchaseContentValue: 原始.purchaseContentValue,
    fields: {
      region: 读取字段("region", "select"),
      orderNo: 读取字段("orderNo", "text"),
      contractPartner: 读取字段("contractPartner", "text"),
      endUser: 读取字段("endUser", "text"),
      productType: 读取字段("productType", "checkbox"),
      purchaseContent: 读取字段("purchaseContent", "textarea"),
      purchaseAttachment: 读取字段("purchaseAttachment", "file"),
      quoteAttachment: 读取字段("quoteAttachment", "file"),
    },
  };
}

function 构建文本字段(fieldId: string, 值: string): string {
  return `{\"fieldId\":${fieldId},\"dataOptions\":[{\"optionId\":${JSON.stringify(值)}}]}`;
}

function 构建附件字段(fieldId: string, 文件: 泛微上传文件): string {
  if (!/^\d{1,30}$/.test(文件.fileId)) {
    throw new 订单预审外部错误("ETEAMS_UPLOAD_FILE_ID_INVALID", "泛微附件编号格式无效。", {});
  }
  return `{\"fieldId\":${fieldId},\"dataOptions\":[{\"optionId\":${文件.fileId},\"optionObj\":{\"name\":${JSON.stringify(文件.fileName)},\"extName\":\"pdf\",\"type\":\"application/pdf\",\"img\":false}}]}`;
}

function 校验流程回查结果(原始: unknown, 条件: 泛微流程回查条件, httpStatus: number): void {
  const 结果文本 = JSON.stringify(原始);
  const 状态 = 读取字符串(原始, ["flowRequest", "statusType"]);
  const 当前节点 = 读取字符串(原始, ["flowRequest", "currentNode"]);
  if (!状态 || !["inProcess", "processing", "pending"].includes(状态) || !当前节点) {
    throw new 订单预审外部错误(
      "ETEAMS_VERIFY_STATUS_INVALID",
      "泛微回查未确认流程处于有效审批状态。",
      {
        httpStatus,
      },
    );
  }
  const 必须存在 = [
    条件.订单编号,
    条件.所属区域,
    条件.产品类型,
    条件.采购内容,
    条件.采购订单字段编号,
    条件.报价单字段编号,
  ];
  if (必须存在.some((值) => !结果文本.includes(值))) {
    throw new 订单预审外部错误(
      "ETEAMS_VERIFY_FIELD_MISMATCH",
      "泛微回查的关键字段或双附件不完整。",
      {
        httpStatus,
      },
    );
  }
}

function 构建泛微接口错误(
  动作: string,
  httpStatus: number,
  错误码?: number | string,
): 订单预审外部错误 {
  const 可重试 = httpStatus === 429 || httpStatus >= 500 || 错误码 === 45009 || 错误码 === 45011;
  const 错误代码 = 错误码 === undefined ? `HTTP_${httpStatus}` : `ETEAMS_${错误码}`;
  return new 订单预审外部错误(
    错误代码,
    可重试 ? `泛微${动作}暂时不可用。` : `泛微${动作}被拒绝，请核对模板、字段、发起人或应用权限。`,
    { httpStatus, retryable: 可重试 },
  );
}

async function 读取响应JSON(响应: Response): Promise<unknown> {
  const 文本 = await 响应.text();
  if (!文本.trim()) return {};
  try {
    // 泛微流程与附件编号通常为 19 位整数，超过 JavaScript 安全整数范围。
    // 仅将约定编号字段的超长数字改为字符串，避免 JSON.parse 后发生静默精度丢失。
    const 保留编号精度文本 = 文本.replace(
      /"(requestId|requestid|fileid|fileId)"\s*:\s*(-?\d{16,})/g,
      '"$1":"$2"',
    );
    return JSON.parse(保留编号精度文本) as unknown;
  } catch {
    throw new 订单预审外部错误("ETEAMS_RESPONSE_INVALID", "泛微接口返回了无法识别的响应。", {
      httpStatus: 响应.status,
      retryable: 响应.status >= 500,
    });
  }
}

function 读取错误码(原始: unknown): number | string | undefined {
  const 值 = 读取未知值(原始, ["message", "errcode"]) ?? 读取未知值(原始, ["errcode"]);
  return typeof 值 === "number" || typeof 值 === "string" ? 值 : undefined;
}

function 读取字符串(原始: unknown, 路径: string[]): string | undefined {
  const 值 = 读取未知值(原始, 路径);
  return typeof 值 === "string" || typeof 值 === "number" ? String(值) : undefined;
}

function 读取未知值(原始: unknown, 路径: string[]): unknown {
  let 当前: unknown = 原始;
  for (const 节点 of 路径) {
    if (!是记录(当前)) return undefined;
    当前 = 当前[节点];
  }
  return 当前;
}

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return Boolean(值) && typeof 值 === "object" && !Array.isArray(值);
}
