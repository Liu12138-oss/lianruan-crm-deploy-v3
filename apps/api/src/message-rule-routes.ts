import type { 构建信息 } from "@lianruan/shared";
import { 创建成功响应, 应用错误 } from "@lianruan/shared";
import { 事件目录, 到期数据源目录, 接收人类型目录, 提醒渠道目录 } from "@lianruan/shared";
import type { Request, Router } from "express";
import { Router as createRouter } from "express";

import {
  校验二次确认,
  校验同源写请求,
  type 消息平台路由参数,
  读取超级管理员,
} from "./message-platform-routes.js";
import {
  type 事件规则更新输入,
  type 任务模板创建输入,
  type 任务模板更新输入,
  创建消息规则数据服务,
  type 到期提醒规则更新输入,
  type 提醒任务创建输入,
  type 提醒任务更新输入,
  type 模板更新输入,
  type 消息规则数据服务,
} from "./message-rule-store.js";

export interface 消息规则路由参数 {
  build: 构建信息;
  sessionSecret: string;
  databaseUrl?: string;
  corsOrigin?: string;
  env?: NodeJS.ProcessEnv;
  service?: 消息规则数据服务;
}

export function 创建消息规则路由(参数: 消息规则路由参数): Router {
  const router = createRouter();
  const service =
    参数.service ||
    创建消息规则数据服务({
      ...(参数.databaseUrl ? { databaseUrl: 参数.databaseUrl } : {}),
    });
  const 平台参数: 消息平台路由参数 = {
    build: 参数.build,
    sessionSecret: 参数.sessionSecret,
    ...(参数.databaseUrl ? { databaseUrl: 参数.databaseUrl } : {}),
    ...(参数.corsOrigin ? { corsOrigin: 参数.corsOrigin } : {}),
    ...(参数.env ? { env: 参数.env } : {}),
  };

  router.get("/rules/catalog", async (req, res, next) => {
    try {
      读取超级管理员(req, 平台参数);
      res.json(
        成功(req, 参数.build, {
          dataSources: 到期数据源目录,
          events: 事件目录,
          channels: 提醒渠道目录,
          recipientTypes: 接收人类型目录,
          categories: [
            { code: "todo", label: "待办审批" },
            { code: "business", label: "业务动态" },
            { code: "system", label: "系统运维" },
            { code: "security", label: "安全合规" },
          ],
          priorities: [
            { code: "normal", label: "普通提醒" },
            { code: "strong", label: "重要提醒" },
            { code: "forced", label: "强制提醒" },
          ],
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/rules", async (req, res, next) => {
    try {
      const 用户 = 读取超级管理员(req, 平台参数);
      const [items, reminderItems] = await Promise.all([
        service.查询事件规则(用户),
        service.查询到期提醒规则(用户),
      ]);
      res.json(成功(req, 参数.build, { items, reminderItems }));
    } catch (error) {
      next(error);
    }
  });

  router.put("/rules/reminders/:ruleCode", async (req, res, next) => {
    try {
      校验规则同源写请求(req, 参数.corsOrigin);
      校验二次确认(req);
      const data = await service.更新到期提醒规则(
        读取超级管理员(req, 平台参数),
        读取到期规则代码(req),
        读取到期规则更新(req),
      );
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });

  router.put("/rules/:subscriptionCode", async (req, res, next) => {
    try {
      校验规则同源写请求(req, 参数.corsOrigin);
      校验二次确认(req);
      const data = await service.更新事件规则(
        读取超级管理员(req, 平台参数),
        读取订阅代码(req),
        读取规则更新(req),
      );
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });

  router.get("/rules/templates", async (req, res, next) => {
    try {
      const data = await service.查询模板(读取超级管理员(req, 平台参数));
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });

  router.put("/rules/templates/:templateCode", async (req, res, next) => {
    try {
      校验规则同源写请求(req, 参数.corsOrigin);
      校验二次确认(req);
      const data = await service.更新模板(
        读取超级管理员(req, 平台参数),
        读取模板代码(req),
        读取模板更新(req),
      );
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });

  router.get("/rules/task-templates", async (req, res, next) => {
    try {
      const data = await service.查询任务模板(读取超级管理员(req, 平台参数));
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });

  router.post("/rules/task-templates", async (req, res, next) => {
    try {
      校验规则同源写请求(req, 参数.corsOrigin);
      校验二次确认(req);
      const data = await service.创建任务模板(读取超级管理员(req, 平台参数), 读取任务模板创建(req));
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });

  router.post("/rules/task-templates/:templateCode/copy", async (req, res, next) => {
    try {
      校验规则同源写请求(req, 参数.corsOrigin);
      校验二次确认(req);
      const data = await service.复制任务模板(
        读取超级管理员(req, 平台参数),
        读取模板代码(req),
        读取任务模板复制覆盖(req),
      );
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });

  router.put("/rules/task-templates/:templateCode", async (req, res, next) => {
    try {
      校验规则同源写请求(req, 参数.corsOrigin);
      校验二次确认(req);
      const data = await service.更新任务模板(
        读取超级管理员(req, 平台参数),
        读取模板代码(req),
        读取任务模板更新(req),
      );
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });

  router.post("/rules/tasks", async (req, res, next) => {
    try {
      校验规则同源写请求(req, 参数.corsOrigin);
      校验二次确认(req);
      const data = await service.创建提醒任务(读取超级管理员(req, 平台参数), 读取任务创建(req));
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });

  router.put("/rules/tasks/:ruleCode", async (req, res, next) => {
    try {
      校验规则同源写请求(req, 参数.corsOrigin);
      校验二次确认(req);
      const data = await service.更新提醒任务(
        读取超级管理员(req, 平台参数),
        读取任务代码(req),
        读取任务更新(req),
      );
      res.json(成功(req, 参数.build, data));
    } catch (error) {
      next(error);
    }
  });
  return router;
}

function 校验规则同源写请求(req: Request, corsOrigin?: string): void {
  if (!req.get("origin")) {
    throw new 应用错误(
      "V3_MESSAGE_RULE_ORIGIN_REQUIRED",
      "提醒规则管理请求必须携带同源标识。",
      403,
    );
  }
  校验同源写请求(req, corsOrigin);
}

function 成功(req: Request, build: 构建信息, data: unknown) {
  return 创建成功响应({ data, requestId: req.requestId, build });
}

function 读取订阅代码(req: Request): string {
  const value = req.params.subscriptionCode;
  if (typeof value !== "string" || !/^[a-z0-9_]+$/.test(value)) {
    throw new 应用错误("V3_MESSAGE_RULE_INVALID", "提醒规则编号不合法。", 400);
  }
  return value;
}

function 读取规则更新(req: Request): 事件规则更新输入 {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw new 应用错误("V3_MESSAGE_RULE_INVALID", "提醒规则请求格式无效。", 400);
  }
  const body = req.body as Record<string, unknown>;
  const 允许字段 = new Set(["statusCode", "version", "confirm", "channelCodes", "recipientScope"]);
  if (Object.keys(body).some((key) => !允许字段.has(key))) {
    throw new 应用错误("V3_MESSAGE_RULE_INVALID", "提醒规则包含不支持的字段。", 400);
  }
  if (body.statusCode !== "active" && body.statusCode !== "disabled") {
    throw new 应用错误("V3_MESSAGE_RULE_INVALID", "提醒规则状态不合法。", 400);
  }
  if (!Number.isInteger(body.version) || (body.version as number) < 1) {
    throw new 应用错误("V3_MESSAGE_RULE_INVALID", "提醒规则版本不合法。", 400);
  }
  const 更新: 事件规则更新输入 = { statusCode: body.statusCode, version: body.version as number };
  if (body.channelCodes !== undefined) {
    const 通道 = body.channelCodes;
    if (
      !Array.isArray(通道) ||
      通道.length === 0 ||
      !通道.every(
        (item) =>
          item === "in_app" ||
          item === "wecom" ||
          item === "wecom_app" ||
          item === "sms" ||
          item === "email",
      )
    ) {
      throw new 应用错误(
        "V3_MESSAGE_RULE_INVALID",
        "提醒渠道仅支持站内、企微应用、企微群机器人、短信与邮件组合。",
        400,
      );
    }
    更新.channelCodes = [...new Set(通道 as string[])] as Array<
      "in_app" | "wecom" | "wecom_app" | "sms" | "email"
    >;
  }
  if (body.recipientScope !== undefined) {
    更新.recipientScope = 读取提醒范围(body.recipientScope) as never;
  }
  return 更新;
}

function 读取到期规则代码(req: Request): string {
  const value = req.params.ruleCode;
  if (typeof value !== "string" || !/^[a-z0-9_]+$/.test(value)) {
    throw new 应用错误("V3_MESSAGE_REMINDER_RULE_INVALID", "到期提醒规则编号不合法。", 400);
  }
  return value;
}

function 读取到期规则更新(req: Request): 到期提醒规则更新输入 {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw new 应用错误("V3_MESSAGE_REMINDER_RULE_INVALID", "到期提醒规则请求格式无效。", 400);
  }
  const body = req.body as Record<string, unknown>;
  const 允许字段 = new Set([
    "statusCode",
    "advanceDays",
    "dispatchTime",
    "workdayOnly",
    "recipientRule",
    "channelCodes",
    "digestWindowMinutes",
    "version",
    "confirm",
  ]);
  if (Object.keys(body).some((key) => !允许字段.has(key))) {
    throw new 应用错误("V3_MESSAGE_REMINDER_RULE_INVALID", "到期提醒规则包含不支持的字段。", 400);
  }
  if (body.statusCode !== "active" && body.statusCode !== "disabled") {
    throw new 应用错误("V3_MESSAGE_REMINDER_RULE_INVALID", "到期提醒规则状态不合法。", 400);
  }
  if (!Array.isArray(body.advanceDays) || !是有效提前天数(body.advanceDays)) {
    throw new 应用错误(
      "V3_MESSAGE_REMINDER_RULE_INVALID",
      "到期提前天数只能从 1、3、7、14、30、60、90 中选择且不能重复。",
      400,
    );
  }
  if (
    typeof body.dispatchTime !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.dispatchTime)
  ) {
    throw new 应用错误("V3_MESSAGE_REMINDER_RULE_INVALID", "执行时间格式应为 HH:MM。", 400);
  }
  if (typeof body.workdayOnly !== "boolean") {
    throw new 应用错误("V3_MESSAGE_REMINDER_RULE_INVALID", "仅工作日标记不合法。", 400);
  }
  const 接收人规则 = 读取接收人规则(body.recipientRule);
  const 接收人范围 =
    body.recipientScope !== undefined ? 读取提醒范围(body.recipientScope) : undefined;
  if (
    !Array.isArray(body.channelCodes) ||
    body.channelCodes.length === 0 ||
    !body.channelCodes.every(
      (item) =>
        item === "in_app" ||
        item === "wecom" ||
        item === "wecom_app" ||
        item === "sms" ||
        item === "email",
    )
  ) {
    throw new 应用错误(
      "V3_MESSAGE_REMINDER_RULE_INVALID",
      "提醒渠道仅支持站内、企微应用、企微群机器人、短信与邮件组合。",
      400,
    );
  }
  if (
    body.digestWindowMinutes !== 0 &&
    body.digestWindowMinutes !== 15 &&
    body.digestWindowMinutes !== 60
  ) {
    throw new 应用错误(
      "V3_MESSAGE_REMINDER_RULE_INVALID",
      "汇总窗口只能为即时、15 分钟或 60 分钟。",
      400,
    );
  }
  if (!Number.isInteger(body.version) || (body.version as number) < 1) {
    throw new 应用错误("V3_MESSAGE_REMINDER_RULE_INVALID", "到期提醒规则版本不合法。", 400);
  }
  return {
    statusCode: body.statusCode,
    advanceDays: [...body.advanceDays].sort((a, b) => b - a) as Array<
      1 | 3 | 7 | 14 | 30 | 60 | 90
    >,
    dispatchTime: body.dispatchTime,
    workdayOnly: body.workdayOnly,
    recipientRule: 接收人规则.type,
    ...(接收人范围 ? { recipientScope: 接收人范围 } : {}),
    channelCodes: [...new Set(body.channelCodes as string[])] as Array<
      "in_app" | "wecom" | "wecom_app" | "sms" | "email"
    >,
    digestWindowMinutes: body.digestWindowMinutes,
    version: body.version as number,
  };
}

function 读取模板代码(req: Request): string {
  const value = req.params.templateCode;
  if (typeof value !== "string" || !/^[a-z0-9_]+$/.test(value)) {
    throw new 应用错误("V3_MESSAGE_TEMPLATE_INVALID", "消息模板编号不合法。", 400);
  }
  return value;
}

function 读取模板更新(req: Request): 模板更新输入 {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw new 应用错误("V3_MESSAGE_TEMPLATE_INVALID", "消息模板请求格式无效。", 400);
  }
  const body = req.body as Record<string, unknown>;
  const 允许字段 = new Set(["titleTemplate", "bodyTemplate", "version", "confirm"]);
  if (Object.keys(body).some((key) => !允许字段.has(key))) {
    throw new 应用错误("V3_MESSAGE_TEMPLATE_INVALID", "消息模板包含不支持的字段。", 400);
  }
  if (typeof body.titleTemplate !== "string" || !body.titleTemplate.trim()) {
    throw new 应用错误("V3_MESSAGE_TEMPLATE_INVALID", "模板标题不能为空。", 400);
  }
  if (typeof body.bodyTemplate !== "string" || !body.bodyTemplate.trim()) {
    throw new 应用错误("V3_MESSAGE_TEMPLATE_INVALID", "模板正文不能为空。", 400);
  }
  if (!Number.isInteger(body.version) || (body.version as number) < 1) {
    throw new 应用错误("V3_MESSAGE_TEMPLATE_INVALID", "消息模板版本不合法。", 400);
  }
  return {
    titleTemplate: String(body.titleTemplate).trim(),
    bodyTemplate: String(body.bodyTemplate).trim(),
    version: body.version as number,
  };
}

function 是有效提前天数(value: unknown[]): value is Array<1 | 3 | 7 | 14 | 30 | 60 | 90> {
  return (
    value.length > 0 &&
    value.length <= 10 &&
    new Set(value).size === value.length &&
    value.every((day) => [1, 3, 7, 14, 30, 60, 90].includes(day as number))
  );
}

function 读取接收人规则(value: unknown): { type: string } {
  if (typeof value === "string") {
    const 动态 = new Set([
      "business_owner",
      "order_current_approver",
      "registration_creator_and_owner",
      "registration_pending_approver",
      "platform_administrator",
    ]);
    if (!动态.has(value)) {
      throw new 应用错误("V3_MESSAGE_REMINDER_RULE_INVALID", "接收人规则类型不支持。", 400);
    }
    return { type: value };
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const 类型 = String((value as Record<string, unknown>).type || "");
    if (!类型)
      throw new 应用错误("V3_MESSAGE_REMINDER_RULE_INVALID", "接收人规则类型不能为空。", 400);
    return { type: 类型 };
  }
  throw new 应用错误("V3_MESSAGE_REMINDER_RULE_INVALID", "接收人规则格式无效。", 400);
}

function 读取提醒范围(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new 应用错误("V3_MESSAGE_REMINDER_RULE_INVALID", "提醒范围格式无效。", 400);
  }
  const 范围 = value as Record<string, unknown>;
  if (范围.type === "users") {
    if (
      !Array.isArray(范围.userIds) ||
      范围.userIds.length === 0 ||
      !范围.userIds.every((item) => typeof item === "string")
    ) {
      throw new 应用错误(
        "V3_MESSAGE_REMINDER_RULE_INVALID",
        "指定用户范围必须选择至少一个用户。",
        400,
      );
    }
    return { type: "users", userIds: [...(范围.userIds as string[])] };
  }
  if (范围.type === "org" || 范围.type === "region") {
    if (
      !Array.isArray(范围.codes) ||
      范围.codes.length === 0 ||
      !范围.codes.every((item) => typeof item === "string")
    ) {
      throw new 应用错误(
        "V3_MESSAGE_REMINDER_RULE_INVALID",
        "指定组织或区域范围必须选择至少一项。",
        400,
      );
    }
    return { type: 范围.type, codes: [...(范围.codes as string[])] };
  }
  if (范围.type === "partners") {
    if (
      !Array.isArray(范围.partnerIds) ||
      范围.partnerIds.length === 0 ||
      !范围.partnerIds.every((item) => typeof item === "string")
    ) {
      throw new 应用错误(
        "V3_MESSAGE_REMINDER_RULE_INVALID",
        "指定渠道商范围必须选择至少一个渠道商。",
        400,
      );
    }
    return { type: "partners", partnerIds: [...(范围.partnerIds as string[])] };
  }
  if (范围.type === "roles" || 范围.type === undefined) {
    const 角色 = Array.isArray(范围.codes) ? (范围.codes as string[]) : [];
    const 用户 = Array.isArray(范围.userIds) ? (范围.userIds as string[]) : [];
    if (!角色.every((item) => typeof item === "string")) {
      throw new 应用错误("V3_MESSAGE_REMINDER_RULE_INVALID", "角色范围格式无效。", 400);
    }
    if (!用户.every((item) => typeof item === "string")) {
      throw new 应用错误("V3_MESSAGE_REMINDER_RULE_INVALID", "指定用户范围格式无效。", 400);
    }
    if (角色.length === 0 && 用户.length === 0) {
      throw new 应用错误(
        "V3_MESSAGE_REMINDER_RULE_INVALID",
        "请至少选择一个提醒角色或指定用户。",
        400,
      );
    }
    return {
      type: "roles",
      codes: 角色,
      ...(用户.length > 0 ? { userIds: [...用户] } : {}),
    };
  }
  throw new 应用错误("V3_MESSAGE_REMINDER_RULE_INVALID", "提醒范围类型不支持。", 400);
}

function 读取任务代码(req: Request): string {
  const value = req.params.ruleCode;
  if (typeof value !== "string" || !/^[a-z0-9_]+$/.test(value)) {
    throw new 应用错误("V3_MESSAGE_TASK_INVALID", "提醒任务编号不合法。", 400);
  }
  return value;
}

function 读取共享任务字段(body: Record<string, unknown>): {
  taskName?: string;
  recipientRule?: Record<string, unknown>;
  channelCodes?: string[];
  advanceDays?: number[];
  dispatchTime?: string;
  workdayOnly?: boolean;
  digestWindowMinutes?: number;
  titleTemplate?: string;
  bodyTemplate?: string;
} {
  const 结果: {
    taskName?: string;
    recipientRule?: Record<string, unknown>;
    channelCodes?: string[];
    advanceDays?: number[];
    dispatchTime?: string;
    workdayOnly?: boolean;
    digestWindowMinutes?: number;
    titleTemplate?: string;
    bodyTemplate?: string;
  } = {};
  if (body.taskName !== undefined) {
    if (typeof body.taskName !== "string" || !body.taskName.trim()) {
      throw new 应用错误("V3_MESSAGE_TASK_INVALID", "任务名称不能为空。", 400);
    }
    结果.taskName = String(body.taskName).trim();
  }
  if (body.recipientRule !== undefined) {
    if (
      !body.recipientRule ||
      typeof body.recipientRule !== "object" ||
      Array.isArray(body.recipientRule)
    ) {
      throw new 应用错误("V3_MESSAGE_TASK_INVALID", "接收人规则格式无效。", 400);
    }
    结果.recipientRule = body.recipientRule as Record<string, unknown>;
  }
  if (body.channelCodes !== undefined) {
    if (!Array.isArray(body.channelCodes) || body.channelCodes.length === 0) {
      throw new 应用错误("V3_MESSAGE_TASK_INVALID", "至少选择一个投递渠道。", 400);
    }
    结果.channelCodes = [...body.channelCodes] as string[];
  }
  if (body.advanceDays !== undefined) {
    if (!Array.isArray(body.advanceDays)) {
      throw new 应用错误("V3_MESSAGE_TASK_INVALID", "到期提前天数格式无效。", 400);
    }
    结果.advanceDays = [...body.advanceDays] as number[];
  }
  if (body.dispatchTime !== undefined) {
    if (
      typeof body.dispatchTime !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.dispatchTime)
    ) {
      throw new 应用错误("V3_MESSAGE_TASK_INVALID", "执行时间格式应为 HH:MM。", 400);
    }
    结果.dispatchTime = body.dispatchTime;
  }
  if (body.workdayOnly !== undefined) {
    if (typeof body.workdayOnly !== "boolean") {
      throw new 应用错误("V3_MESSAGE_TASK_INVALID", "仅工作日标记不合法。", 400);
    }
    结果.workdayOnly = body.workdayOnly;
  }
  if (body.digestWindowMinutes !== undefined) {
    if (
      body.digestWindowMinutes !== 0 &&
      body.digestWindowMinutes !== 15 &&
      body.digestWindowMinutes !== 60
    ) {
      throw new 应用错误("V3_MESSAGE_TASK_INVALID", "汇总窗口只能为即时、15 分钟或 60 分钟。", 400);
    }
    结果.digestWindowMinutes = body.digestWindowMinutes as number;
  }
  if (body.titleTemplate !== undefined) {
    if (typeof body.titleTemplate !== "string" || !body.titleTemplate.trim()) {
      throw new 应用错误("V3_MESSAGE_TASK_INVALID", "模板标题不能为空。", 400);
    }
    结果.titleTemplate = String(body.titleTemplate).trim();
  }
  if (body.bodyTemplate !== undefined) {
    if (typeof body.bodyTemplate !== "string" || !body.bodyTemplate.trim()) {
      throw new 应用错误("V3_MESSAGE_TASK_INVALID", "模板正文不能为空。", 400);
    }
    结果.bodyTemplate = String(body.bodyTemplate).trim();
  }
  return 结果;
}

function 读取任务模板创建(req: Request): 任务模板创建输入 {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "任务模板请求格式无效。", 400);
  }
  const body = req.body as Record<string, unknown>;
  const 允许字段 = new Set([
    "templateName",
    "reminderType",
    "dataSourceCode",
    "eventCode",
    "categoryCode",
    "priorityCode",
    "recipientRule",
    "channelCodes",
    "advanceDays",
    "dispatchTime",
    "workdayOnly",
    "digestWindowMinutes",
    "titleTemplate",
    "bodyTemplate",
    "description",
    "confirm",
  ]);
  if (Object.keys(body).some((key) => !允许字段.has(key))) {
    throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "任务模板包含不支持的字段。", 400);
  }
  if (typeof body.templateName !== "string" || !body.templateName.trim()) {
    throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "模板名称不能为空。", 400);
  }
  if (body.reminderType !== "expiry" && body.reminderType !== "event") {
    throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "模板类型只能为到期或事件。", 400);
  }
  if (typeof body.categoryCode !== "string" || typeof body.priorityCode !== "string") {
    throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "模板类别与优先级不能为空。", 400);
  }
  if (typeof body.titleTemplate !== "string" || !body.titleTemplate.trim()) {
    throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "模板标题不能为空。", 400);
  }
  if (typeof body.bodyTemplate !== "string" || !body.bodyTemplate.trim()) {
    throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "模板正文不能为空。", 400);
  }
  const 共享 = 读取共享任务字段(body);
  return {
    templateName: String(body.templateName).trim(),
    reminderType: body.reminderType as 任务模板创建输入["reminderType"],
    ...(typeof body.dataSourceCode === "string" ? { dataSourceCode: body.dataSourceCode } : {}),
    ...(typeof body.eventCode === "string" ? { eventCode: body.eventCode } : {}),
    categoryCode: body.categoryCode as string,
    priorityCode: body.priorityCode as string,
    ...(共享.recipientRule ? { recipientRule: 共享.recipientRule } : {}),
    ...(共享.channelCodes ? { channelCodes: 共享.channelCodes as never } : {}),
    ...(共享.advanceDays ? { advanceDays: 共享.advanceDays } : {}),
    ...(共享.dispatchTime ? { dispatchTime: 共享.dispatchTime } : {}),
    ...(共享.workdayOnly !== undefined ? { workdayOnly: 共享.workdayOnly } : {}),
    ...(共享.digestWindowMinutes !== undefined
      ? { digestWindowMinutes: 共享.digestWindowMinutes }
      : {}),
    titleTemplate: String(body.titleTemplate).trim(),
    bodyTemplate: String(body.bodyTemplate).trim(),
    ...(typeof body.description === "string" ? { description: body.description } : {}),
  };
}

function 读取任务模板复制覆盖(req: Request): Partial<任务模板创建输入> {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return {};
  }
  const body = req.body as Record<string, unknown>;
  const 覆盖: Partial<任务模板创建输入> = {};
  if (typeof body.templateName === "string" && body.templateName.trim()) {
    覆盖.templateName = String(body.templateName).trim();
  }
  if (typeof body.titleTemplate === "string" && body.titleTemplate.trim()) {
    覆盖.titleTemplate = String(body.titleTemplate).trim();
  }
  if (typeof body.bodyTemplate === "string" && body.bodyTemplate.trim()) {
    覆盖.bodyTemplate = String(body.bodyTemplate).trim();
  }
  const 共享 = 读取共享任务字段(body);
  if (共享.recipientRule) 覆盖.recipientRule = 共享.recipientRule;
  if (共享.channelCodes) 覆盖.channelCodes = 共享.channelCodes as never;
  if (共享.advanceDays) 覆盖.advanceDays = 共享.advanceDays;
  if (共享.dispatchTime) 覆盖.dispatchTime = 共享.dispatchTime;
  if (共享.workdayOnly !== undefined) 覆盖.workdayOnly = 共享.workdayOnly;
  if (共享.digestWindowMinutes !== undefined) 覆盖.digestWindowMinutes = 共享.digestWindowMinutes;
  if (typeof body.description === "string") 覆盖.description = body.description;
  return 覆盖;
}

function 读取任务模板更新(req: Request): 任务模板更新输入 {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "任务模板请求格式无效。", 400);
  }
  const body = req.body as Record<string, unknown>;
  const 允许字段 = new Set([
    "templateName",
    "recipientRule",
    "channelCodes",
    "advanceDays",
    "dispatchTime",
    "workdayOnly",
    "digestWindowMinutes",
    "titleTemplate",
    "bodyTemplate",
    "description",
    "confirm",
  ]);
  if (Object.keys(body).some((key) => !允许字段.has(key))) {
    throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "任务模板包含不支持的字段。", 400);
  }
  if (typeof body.titleTemplate !== "string" || !body.titleTemplate.trim()) {
    throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "模板标题不能为空。", 400);
  }
  if (typeof body.bodyTemplate !== "string" || !body.bodyTemplate.trim()) {
    throw new 应用错误("V3_MESSAGE_TASK_TEMPLATE_INVALID", "模板正文不能为空。", 400);
  }
  const 共享 = 读取共享任务字段(body);
  return {
    ...(typeof body.templateName === "string" && body.templateName.trim()
      ? { templateName: String(body.templateName).trim() }
      : {}),
    ...(共享.recipientRule ? { recipientRule: 共享.recipientRule } : {}),
    ...(共享.channelCodes ? { channelCodes: 共享.channelCodes as never } : {}),
    ...(共享.advanceDays ? { advanceDays: 共享.advanceDays } : {}),
    ...(共享.dispatchTime ? { dispatchTime: 共享.dispatchTime } : {}),
    ...(共享.workdayOnly !== undefined ? { workdayOnly: 共享.workdayOnly } : {}),
    ...(共享.digestWindowMinutes !== undefined
      ? { digestWindowMinutes: 共享.digestWindowMinutes }
      : {}),
    titleTemplate: String(body.titleTemplate).trim(),
    bodyTemplate: String(body.bodyTemplate).trim(),
    ...(typeof body.description === "string" ? { description: body.description } : {}),
  };
}

function 读取任务创建(req: Request): 提醒任务创建输入 {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw new 应用错误("V3_MESSAGE_TASK_INVALID", "提醒任务请求格式无效。", 400);
  }
  const body = req.body as Record<string, unknown>;
  const 允许字段 = new Set([
    "templateCode",
    "taskName",
    "recipientRule",
    "channelCodes",
    "advanceDays",
    "dispatchTime",
    "workdayOnly",
    "digestWindowMinutes",
    "titleTemplate",
    "bodyTemplate",
    "statusCode",
    "confirm",
  ]);
  if (Object.keys(body).some((key) => !允许字段.has(key))) {
    throw new 应用错误("V3_MESSAGE_TASK_INVALID", "提醒任务包含不支持的字段。", 400);
  }
  if (typeof body.templateCode !== "string" || !/^[a-z0-9_]+$/.test(body.templateCode)) {
    throw new 应用错误("V3_MESSAGE_TASK_INVALID", "任务模板编号不合法。", 400);
  }
  const 共享 = 读取共享任务字段(body);
  return {
    templateCode: body.templateCode,
    ...(共享.taskName ? { taskName: 共享.taskName } : {}),
    ...(共享.recipientRule ? { recipientRule: 共享.recipientRule } : {}),
    ...(共享.channelCodes ? { channelCodes: 共享.channelCodes as never } : {}),
    ...(共享.advanceDays ? { advanceDays: 共享.advanceDays } : {}),
    ...(共享.dispatchTime ? { dispatchTime: 共享.dispatchTime } : {}),
    ...(共享.workdayOnly !== undefined ? { workdayOnly: 共享.workdayOnly } : {}),
    ...(共享.digestWindowMinutes !== undefined
      ? { digestWindowMinutes: 共享.digestWindowMinutes }
      : {}),
    ...(共享.titleTemplate ? { titleTemplate: 共享.titleTemplate } : {}),
    ...(共享.bodyTemplate ? { bodyTemplate: 共享.bodyTemplate } : {}),
    ...(body.statusCode === "active" || body.statusCode === "disabled"
      ? { statusCode: body.statusCode }
      : {}),
  };
}

function 读取任务更新(req: Request): 提醒任务更新输入 {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw new 应用错误("V3_MESSAGE_TASK_INVALID", "提醒任务请求格式无效。", 400);
  }
  const body = req.body as Record<string, unknown>;
  const 允许字段 = new Set([
    "taskName",
    "statusCode",
    "recipientRule",
    "channelCodes",
    "advanceDays",
    "dispatchTime",
    "workdayOnly",
    "digestWindowMinutes",
    "titleTemplate",
    "bodyTemplate",
    "version",
    "confirm",
  ]);
  if (Object.keys(body).some((key) => !允许字段.has(key))) {
    throw new 应用错误("V3_MESSAGE_TASK_INVALID", "提醒任务包含不支持的字段。", 400);
  }
  if (!Number.isInteger(body.version) || (body.version as number) < 1) {
    throw new 应用错误("V3_MESSAGE_TASK_INVALID", "提醒任务版本不合法。", 400);
  }
  const 共享 = 读取共享任务字段(body);
  return {
    ...(共享.taskName ? { taskName: 共享.taskName } : {}),
    ...(body.statusCode === "active" || body.statusCode === "disabled"
      ? { statusCode: body.statusCode }
      : {}),
    ...(共享.recipientRule ? { recipientRule: 共享.recipientRule } : {}),
    ...(共享.channelCodes ? { channelCodes: 共享.channelCodes as never } : {}),
    ...(共享.advanceDays ? { advanceDays: 共享.advanceDays } : {}),
    ...(共享.dispatchTime ? { dispatchTime: 共享.dispatchTime } : {}),
    ...(共享.workdayOnly !== undefined ? { workdayOnly: 共享.workdayOnly } : {}),
    ...(共享.digestWindowMinutes !== undefined
      ? { digestWindowMinutes: 共享.digestWindowMinutes }
      : {}),
    ...(共享.titleTemplate ? { titleTemplate: 共享.titleTemplate } : {}),
    ...(共享.bodyTemplate ? { bodyTemplate: 共享.bodyTemplate } : {}),
    version: body.version as number,
  };
}
