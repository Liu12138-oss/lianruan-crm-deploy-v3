import crypto from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export const 请求编号响应头 = "x-request-id";

export function 创建请求编号(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "req_" + Date.now() + "_" + Math.random().toString(16).slice(2);
}

export function 请求编号中间件(req: Request, res: Response, next: NextFunction): void {
  const requestId = String(req.headers[请求编号响应头] || 创建请求编号());
  req.requestId = requestId;
  res.setHeader(请求编号响应头, requestId);
  next();
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}
