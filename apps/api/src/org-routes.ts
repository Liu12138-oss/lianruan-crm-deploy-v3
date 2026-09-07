import crypto from "node:crypto";

import type { 构建信息 } from "@lianruan/shared";
import { 创建成功响应, 应用错误 } from "@lianruan/shared";
import type { Request, RequestHandler, Router } from "express";
import { Router as 创建路由器 } from "express";
import multer from "multer";

import { 读取请求会话用户名, 读取请求会话角色 } from "./auth-routes.js";
import { 创建组织数据服务, type 组织操作人, type 组织数据服务 } from "./org-store.js";
import { 解析企业微信映射文件 } from "./wecom-identity-import.js";

export interface 组织路由参数 {
  build: 构建信息;
  sessionSecret: string;
  databaseUrl?: string;
  env?: NodeJS.ProcessEnv;
  service?: 组织数据服务;
}

/**
 * 组织模块为独立边界：只接受签名 Cookie 会话，绝不读取业务兼容请求头。
 * 功能默认关闭，关闭时不会向组织表写入任何数据。
 */
export function 创建组织路由(参数: 组织路由参数): Router {
  const router = 创建路由器();
  const 上传企微映射文件 = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  }).single("file");
  let service = 参数.service;
  const 获取服务 = (): 组织数据服务 => {
    if (!service)
      service = 创建组织数据服务(参数.databaseUrl ? { databaseUrl: 参数.databaseUrl } : {});
    return service;
  };
  const 读取主体 = (req: Request) => 读取组织管理员(req, 参数);
  const 执行写入 = <T>(处理: (req: Request, 主体: 组织操作人) => Promise<T>) =>
    执行(async (req) => {
      const 主体 = 读取可写主体(req, 参数);
      const 服务 = 获取服务();
      return 执行组织幂等写入(req, 服务, 主体, () => 处理(req, 主体));
    });
  const 执行 =
    <T>(处理: (req: Request) => Promise<T>) =>
    async (
      req: Request,
      res: Parameters<Router["get"]>[1] extends never ? never : any,
      next: (error: unknown) => void,
    ) => {
      try {
        res.json(
          创建成功响应({ data: await 处理(req), requestId: req.requestId, build: 参数.build }),
        );
      } catch (error) {
        next(error);
      }
    };

  router.get(
    "/status",
    执行(async (req) => {
      const 功能已启用 = 读取开关(参数.env, "V3_ORGANIZATION_ENABLED");
      if (!功能已启用)
        return {
          enabled: false,
          writeEnabled: false,
          channelPhoneEditEnabled: false,
          directorySyncEnabled: false,
          accountEntryMerged: false,
          accountStatusCheckEnabled: 读取开关(参数.env, "V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED"),
          offboardingEnabled: false,
        };
      读取主体(req);
      return {
        enabled: true,
        writeEnabled: 读取开关(参数.env, "V3_ORGANIZATION_WRITE_ENABLED"),
        channelPhoneEditEnabled: 读取开关(参数.env, "V3_ORGANIZATION_CHANNEL_PHONE_EDIT_ENABLED"),
        directorySyncEnabled: 读取开关(参数.env, "V3_DIRECTORY_SYNC_ENABLED"),
        accountEntryMerged: 读取开关(参数.env, "V3_ORGANIZATION_ACCOUNT_ENTRY_MERGED"),
        accountStatusCheckEnabled: 读取开关(参数.env, "V3_AUTH_ACCOUNT_STATUS_CHECK_ENABLED"),
        offboardingEnabled: 读取开关(参数.env, "V3_ORGANIZATION_OFFBOARDING_ENABLED"),
      };
    }),
  );

  router.get(
    "/units/tree",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().查询组织树();
    }),
  );
  router.get(
    "/channel-tree",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().查询渠道组织树();
    }),
  );
  router.get(
    "/channel-members/:id/profile",
    执行(async (req) => {
      断言组织已启用(参数);
      const 主体 = 读取主体(req);
      return 获取服务().查询渠道成员档案(读取标识(req, "id"), 主体);
    }),
  );
  router.put(
    "/channel-members/:id/profile",
    执行写入((req, 主体) => {
      const 内容 = 读取对象(req);
      if (
        Object.prototype.hasOwnProperty.call(内容, "phone") &&
        !读取开关(参数.env, "V3_ORGANIZATION_CHANNEL_PHONE_EDIT_ENABLED")
      )
        throw new 应用错误(
          "ORG_CHANNEL_PHONE_EDIT_DISABLED",
          "渠道成员手机号当前仅可查看；完成 IAM/UniSDP 手机号匹配专项验收后才能修改。",
          409,
        );
      return 获取服务().保存渠道成员档案(读取标识(req, "id"), 内容, 主体);
    }),
  );
  router.get(
    "/regions",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().查询区域列表();
    }),
  );
  router.post(
    "/regions",
    执行写入((req, 主体) => 获取服务().新建区域(读取对象(req), 主体)),
  );
  router.put(
    "/regions/:id",
    执行写入((req, 主体) => 获取服务().更新区域(读取标识(req, "id"), 读取对象(req), 主体)),
  );

  router.get(
    "/units/export",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().导出部门();
    }),
  );
  router.post(
    "/units/import",
    执行写入((req, 主体) => 获取服务().导入部门(读取对象(req), 主体)),
  );
  router.get(
    "/units/:id",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().查询组织详情(读取标识(req, "id"));
    }),
  );
  router.post(
    "/units",
    执行写入((req, 主体) => 获取服务().新建组织(读取对象(req), 主体)),
  );
  router.put(
    "/units/:id",
    执行写入((req, 主体) => 获取服务().更新组织(读取标识(req, "id"), 读取对象(req), 主体)),
  );
  router.put(
    "/units/:id/status",
    执行写入((req, 主体) => 获取服务().更新组织状态(读取标识(req, "id"), 读取对象(req), 主体)),
  );

  router.get(
    "/positions",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().查询岗位(读取查询文本(req, "orgUnitId"));
    }),
  );
  router.post(
    "/positions",
    执行写入((req, 主体) => 获取服务().新建岗位(读取对象(req), 主体)),
  );
  router.put(
    "/positions/:id",
    执行写入((req, 主体) => 获取服务().更新岗位(读取标识(req, "id"), 读取对象(req), 主体)),
  );
  router.put(
    "/positions/:id/status",
    执行写入((req, 主体) => 获取服务().更新岗位状态(读取标识(req, "id"), 读取对象(req), 主体)),
  );

  router.get(
    "/staff",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().查询任职(读取查询文本(req, "orgUnitId"));
    }),
  );
  router.get(
    "/staff/export",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().导出成员();
    }),
  );
  router.post(
    "/staff/import",
    执行写入((req, 主体) => 获取服务().导入成员(读取对象(req), 主体)),
  );
  router.post(
    "/staff/:userId/assignments",
    执行写入((req, 主体) => 获取服务().新建任职(读取标识(req, "userId"), 读取对象(req), 主体)),
  );
  router.put(
    "/assignments/:id",
    执行写入((req, 主体) => 获取服务().更新任职(读取标识(req, "id"), 读取对象(req), 主体)),
  );
  router.put(
    "/assignments/:id/expire",
    执行写入((req, 主体) => 获取服务().结束任职(读取标识(req, "id"), 读取对象(req), 主体)),
  );

  router.get(
    "/manager-relations",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().查询负责人关系(读取查询标识(req, "subordinateAssignmentId"));
    }),
  );
  router.post(
    "/manager-relations",
    执行写入((req, 主体) => 获取服务().新建负责人关系(读取对象(req), 主体)),
  );
  router.put(
    "/manager-relations/:id",
    执行写入((req, 主体) => 获取服务().更新负责人关系(读取标识(req, "id"), 读取对象(req), 主体)),
  );
  router.put(
    "/manager-relations/:id/expire",
    执行写入((req, 主体) => 获取服务().结束负责人关系(读取标识(req, "id"), 读取对象(req), 主体)),
  );

  router.get(
    "/business-roles",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().查询业务角色();
    }),
  );
  router.post(
    "/business-roles",
    执行写入((req, 主体) => 获取服务().新建业务角色(读取对象(req), 主体)),
  );
  router.put(
    "/business-roles/:id",
    执行写入((req, 主体) => 获取服务().更新业务角色(读取标识(req, "id"), 读取对象(req), 主体)),
  );
  router.put(
    "/business-roles/:id/status",
    执行写入((req, 主体) => 获取服务().更新业务角色状态(读取标识(req, "id"), 读取对象(req), 主体)),
  );
  router.get(
    "/member-business-roles",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      const businessRoleId = 读取查询标识(req, "businessRoleId");
      const staffAssignmentId = 读取查询标识(req, "staffAssignmentId");
      const partnerMemberId = 读取查询标识(req, "partnerMemberId");
      return 获取服务().查询成员业务角色({
        ...(businessRoleId ? { businessRoleId } : {}),
        ...(staffAssignmentId ? { staffAssignmentId } : {}),
        ...(partnerMemberId ? { partnerMemberId } : {}),
      });
    }),
  );
  router.post(
    "/member-business-roles",
    执行写入((req, 主体) => 获取服务().指派成员业务角色(读取对象(req), 主体)),
  );
  router.put(
    "/member-business-roles/:id/expire",
    执行写入((req, 主体) => 获取服务().结束成员业务角色(读取标识(req, "id"), 读取对象(req), 主体)),
  );
  router.get(
    "/certification-templates",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().查询证书模板(读取查询文本(req, "category"));
    }),
  );
  router.post(
    "/certification-templates",
    执行写入((req, 主体) => 获取服务().新建证书模板(读取对象(req), 主体)),
  );
  router.get(
    "/member-certifications",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      const 筛选: {
        orgUnitId?: string;
        partnerId?: string;
        regionId?: string;
        category?: string;
        templateName?: string;
      } = {};
      const 部门 = 读取查询文本(req, "orgUnitId");
      const 渠道 = 读取查询文本(req, "partnerId");
      const 区域 = 读取查询文本(req, "regionId");
      const 类别 = 读取查询文本(req, "category");
      const 证书名 = 读取查询文本(req, "templateName");
      if (部门) 筛选.orgUnitId = 部门;
      if (渠道) 筛选.partnerId = 渠道;
      if (区域) 筛选.regionId = 区域;
      if (类别) 筛选.category = 类别;
      if (证书名) 筛选.templateName = 证书名;
      return 获取服务().查询成员证书(读取查询文本(req, "userId"), 筛选);
    }),
  );
  router.post(
    "/users/:userId/certifications",
    执行写入((req, 主体) => 获取服务().颁发证书(读取标识(req, "userId"), 读取对象(req), 主体)),
  );
  router.delete(
    "/users/:userId",
    执行写入((req) => {
      读取标识(req, "userId");
      throw new 应用错误(
        "ORG_PHYSICAL_DELETE_DISABLED",
        "历史账号禁止物理删除，请使用停用归档并完成业务交接。",
        409,
      );
    }),
  );
  router.put(
    "/member-certifications/:id/extend",
    执行写入((req, 主体) => 获取服务().延期证书(读取标识(req, "id"), 读取对象(req), 主体)),
  );
  router.put(
    "/member-certifications/:id/revoke",
    执行写入((req, 主体) => 获取服务().撤销证书(读取标识(req, "id"), 读取对象(req), 主体)),
  );
  router.get(
    "/admin-accounts/unassigned",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().统计未归集管理账号();
    }),
  );
  // 渠道商与组织架构同步（v1：channel.partners → org.regions 单向；写回 channel 留待 v2）
  router.get(
    "/channel-sync/preview",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().预览渠道商同步();
    }),
  );
  router.post(
    "/channel-sync/execute",
    执行写入((req, 主体) => 获取服务().执行渠道商同步(读取对象(req), 主体)),
  );
  router.post(
    "/wecom-identities/import-preview",
    校验企微导入权限(参数),
    解析企微上传文件(上传企微映射文件),
    执行(async (req) => {
      return 获取服务().预览企业微信身份导入(读取企微映射文件(req));
    }),
  );
  router.post(
    "/wecom-identities/import-confirm",
    校验企微导入权限(参数),
    解析企微上传文件(上传企微映射文件),
    执行(async (req) => {
      const 主体 = 读取可写主体(req, 参数);
      const file = 读取企微映射文件(req);
      return 执行企微导入幂等写入(req, 获取服务(), 主体, file.sourceSha256, () =>
        获取服务().确认企业微信身份导入(file, 主体),
      );
    }),
  );
  router.get(
    "/users/:userId/eteams-identity",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().查询泛微OA身份(读取标识(req, "userId"));
    }),
  );
  router.post(
    "/users/:userId/eteams-identity-candidates",
    执行写入((req, 主体) =>
      获取服务().新建泛微OA身份候选(读取标识(req, "userId"), 读取对象(req), 主体),
    ),
  );
  router.put(
    "/users/:userId/eteams-identity-candidates/:candidateId",
    执行写入((req, 主体) =>
      获取服务().更新泛微OA身份候选(
        读取标识(req, "userId"),
        读取标识(req, "candidateId"),
        读取对象(req),
        主体,
      ),
    ),
  );
  router.post(
    "/users/:userId/eteams-identity-candidates/:candidateId/confirm",
    执行写入((req, 主体) =>
      获取服务().确认泛微OA身份候选(
        读取标识(req, "userId"),
        读取标识(req, "candidateId"),
        读取对象(req),
        主体,
      ),
    ),
  );
  router.post(
    "/users/:userId/eteams-identity-candidates/:candidateId/reject",
    执行写入((req, 主体) =>
      获取服务().驳回泛微OA身份候选(
        读取标识(req, "userId"),
        读取标识(req, "candidateId"),
        读取对象(req),
        主体,
      ),
    ),
  );
  router.post(
    "/users/:userId/eteams-identity/disable",
    执行写入((req, 主体) =>
      获取服务().停用泛微OA身份(读取标识(req, "userId"), 读取对象(req), 主体),
    ),
  );
  router.get(
    "/data-scopes/:subjectType/:subjectId",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().查询数据范围(读取数据范围主体类型(req), 读取标识(req, "subjectId"));
    }),
  );
  router.put(
    "/data-scopes/:subjectType/:subjectId",
    执行写入((req, 主体) =>
      获取服务().保存数据范围(
        读取可写数据范围主体(req),
        读取标识(req, "subjectId"),
        读取对象(req),
        主体,
      ),
    ),
  );
  router.delete(
    "/data-scopes/bindings/:id",
    执行写入((req, 主体) => 获取服务().停用数据范围(读取标识(req, "id"), 读取对象(req), 主体)),
  );

  router.get(
    "/staff/:userId/offboarding-preview",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().预览离职影响(读取标识(req, "userId"));
    }),
  );

  router.get(
    "/offboarding",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().查询离职交接();
    }),
  );
  router.get(
    "/offboarding/:id",
    执行(async (req) => {
      断言组织已启用(参数);
      读取主体(req);
      return 获取服务().查询离职交接详情(读取标识(req, "id"));
    }),
  );
  router.post(
    "/offboarding",
    执行写入((req, 主体) => {
      断言离职交接执行已启用(参数);
      return 获取服务().发起离职交接(读取对象(req), 主体);
    }),
  );
  router.post(
    "/offboarding/:id/retry-items",
    执行写入((req, 主体) => {
      断言离职交接执行已启用(参数);
      return 获取服务().重试离职扫描(读取标识(req, "id"), 读取对象(req), 主体);
    }),
  );
  router.post(
    "/offboarding/:id/close",
    执行写入((req, 主体) => {
      断言离职交接执行已启用(参数);
      return 获取服务().关闭离职交接(读取标识(req, "id"), 读取对象(req), 主体);
    }),
  );
  return router;
}

export function 读取组织管理员(
  req: Request,
  参数: Pick<组织路由参数, "sessionSecret" | "env">,
): 组织操作人 {
  const 会话参数 = { sessionSecret: 参数.sessionSecret, ...(参数.env ? { env: 参数.env } : {}) };
  const username = 读取请求会话用户名(req, 会话参数);
  const role = 读取请求会话角色(req, 会话参数);
  if (!username) throw new 应用错误("ORG_AUTH_REQUIRED", "请先登录后再访问组织架构。", 401);
  if (role !== "superadmin")
    throw new 应用错误("ORG_PERMISSION_DENIED", "仅超级管理员可管理组织架构。", 403);
  return { username, requestId: req.requestId, role };
}

function 读取可写主体(req: Request, 参数: 组织路由参数) {
  断言组织已启用(参数);
  if (!读取开关(参数.env, "V3_ORGANIZATION_WRITE_ENABLED"))
    throw new 应用错误("ORG_WRITE_DISABLED", "组织架构当前为只读观察模式。", 403);
  return 读取组织管理员(req, 参数);
}

function 断言组织已启用(参数: Pick<组织路由参数, "env">) {
  if (!读取开关(参数.env, "V3_ORGANIZATION_ENABLED"))
    throw new 应用错误("ORG_FEATURE_DISABLED", "组织架构功能尚未启用。", 503);
}

function 断言离职交接执行已启用(参数: Pick<组织路由参数, "env">) {
  if (!读取开关(参数.env, "V3_ORGANIZATION_OFFBOARDING_ENABLED"))
    throw new 应用错误(
      "ORG_OFFBOARDING_DISABLED",
      "停用归档与自动交接尚未通过专项验收，当前只允许预览影响。",
      403,
    );
}

function 读取开关(env: NodeJS.ProcessEnv | undefined, key: string): boolean {
  return (env || process.env)[key] === "true";
}
function 读取标识(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value))
    throw new 应用错误("ORG_REQUEST_INVALID", "标识格式不合法。", 400);
  return value;
}
function 读取查询文本(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function 读取查询标识(req: Request, key: string): string | undefined {
  const value = 读取查询文本(req, key);
  if (value === undefined) return undefined;
  if (!/^[0-9a-f-]{36}$/i.test(value))
    throw new 应用错误("ORG_REQUEST_INVALID", `${key}格式不合法。`, 400);
  return value;
}
function 读取数据范围主体类型(req: Request): string {
  const value = req.params.subjectType;
  if (value === "role" || value === "user") return value;
  throw new 应用错误("ORG_REQUEST_INVALID", "数据范围主体类型仅支持 role 或 user。", 400);
}
function 读取可写数据范围主体(req: Request): string {
  const subjectType = 读取数据范围主体类型(req);
  if (subjectType === "user")
    throw new 应用错误(
      "DATA_SCOPE_USER_OVERRIDE_DISABLED",
      "首期不支持用户级数据范围写入，请维护角色级数据范围。",
      409,
    );
  return subjectType;
}
function 读取对象(req: Request): Record<string, unknown> {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
    throw new 应用错误("ORG_REQUEST_INVALID", "请求内容必须是对象。", 400);
  return req.body as Record<string, unknown>;
}

function 解析企微上传文件(上传: RequestHandler): RequestHandler {
  return (req, res, next) => {
    上传(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }
      if (error instanceof multer.MulterError) {
        const message =
          error.code === "LIMIT_FILE_SIZE"
            ? "企业微信映射文件不能超过5MB。"
            : "企业微信映射文件上传失败。";
        next(new 应用错误("ORG_WECOM_IMPORT_UPLOAD_FAILED", message, 400));
        return;
      }
      next(new 应用错误("ORG_WECOM_IMPORT_UPLOAD_FAILED", "企业微信映射文件上传失败。", 400));
    });
  };
}

function 校验企微导入权限(参数: 组织路由参数): RequestHandler {
  return (req, _res, next) => {
    try {
      读取可写主体(req, 参数);
      next();
    } catch (error) {
      next(error);
    }
  };
}

function 读取企微映射文件(req: Request) {
  const file = req.file;
  if (!file) throw new 应用错误("ORG_WECOM_IMPORT_FILE_MISSING", "请上传企业微信映射文件。", 400);
  return 解析企业微信映射文件(file.originalname, file.buffer);
}
async function 执行组织幂等写入<T>(
  req: Request,
  服务: 组织数据服务,
  主体: 组织操作人,
  操作: () => Promise<T>,
): Promise<T> {
  const value = req.headers["idempotency-key"];
  if (typeof value !== "string" || !value.trim()) return 操作();
  const key = value.trim();
  if (key.length > 200)
    throw new 应用错误("ORG_IDEMPOTENCY_KEY_INVALID", "幂等键长度不能超过200个字符。", 400);
  return 服务.执行幂等(
    {
      作用域: `org:${主体.username}:${req.method}:${req.path}`,
      幂等键: key,
      请求哈希: crypto
        .createHash("sha256")
        .update(
          JSON.stringify({ method: req.method, path: req.path, body: req.body || null }),
          "utf8",
        )
        .digest("hex"),
    },
    操作,
  );
}

async function 执行企微导入幂等写入<T>(
  req: Request,
  服务: 组织数据服务,
  主体: 组织操作人,
  sourceSha256: string,
  操作: () => Promise<T>,
): Promise<T> {
  const value = req.headers["idempotency-key"];
  if (typeof value !== "string" || !value.trim())
    throw new 应用错误("ORG_IDEMPOTENCY_KEY_REQUIRED", "确认导入必须提供幂等键。", 400);
  const key = value.trim();
  if (key.length > 200)
    throw new 应用错误("ORG_IDEMPOTENCY_KEY_INVALID", "幂等键长度不能超过200个字符。", 400);
  return 服务.执行幂等(
    {
      作用域: `org:${主体.username}:${req.method}:${req.path}`,
      幂等键: key,
      请求哈希: crypto
        .createHash("sha256")
        .update(JSON.stringify({ method: req.method, path: req.path, sourceSha256 }), "utf8")
        .digest("hex"),
    },
    操作,
  );
}
