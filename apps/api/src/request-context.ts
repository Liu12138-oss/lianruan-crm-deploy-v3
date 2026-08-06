import crypto from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export const 请求编号响应头 = "x-request-id";
const 请求编号安全格式 = /^[A-Za-z0-9._:-]{1,128}$/;

export function 创建请求编号(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "req_" + Date.now() + "_" + Math.random().toString(16).slice(2);
}

export function 请求编号中间件(req: Request, res: Response, next: NextFunction): void {
  const requestId = 读取请求编号(req.headers[请求编号响应头]);
  req.requestId = requestId;
  res.setHeader(请求编号响应头, requestId);
  next();
}

function 读取请求编号(value: string | string[] | undefined): string {
  const 原始编号 = Array.isArray(value) ? value[0] : value;
  if (typeof 原始编号 !== "string") return 创建请求编号();
  const requestId = 原始编号.trim();
  return 请求编号安全格式.test(requestId) ? requestId : 创建请求编号();
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}
