export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "联软CRM V3阶段9业务接口契约",
    version: "3.0.0-stage9.20260727",
    description:
      "阶段9交付验收版覆盖健康检查、交付登录、客户报备、商机、报价、订单、渠道、产品、账号、审计、OpenAPI、工作量和导入导出查询接口。",
  },
  paths: {
    "/api/auth/login": {
      post: {
        summary: "交付验收登录",
        responses: {
          "200": { description: "登录成功" },
          "400": { description: "用户名或密码缺失" },
          "401": { description: "用户名或密码错误" },
          "503": { description: "登录入口未启用" },
        },
      },
    },
    "/api/auth/me": {
      get: {
        summary: "读取当前登录用户",
        responses: {
          "200": { description: "已登录" },
          "401": { description: "未登录或会话过期" },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        summary: "退出登录",
        responses: {
          "200": { description: "退出成功" },
        },
      },
    },
    "/health/live": {
      get: {
        summary: "存活检查",
        responses: {
          "200": { description: "进程存活" },
        },
      },
    },
    "/health/ready": {
      get: {
        summary: "就绪检查",
        responses: {
          "200": { description: "依赖就绪" },
          "503": { description: "依赖未就绪" },
        },
      },
    },
    "/health/dependencies": {
      get: {
        summary: "依赖检查详情",
        responses: {
          "200": { description: "依赖详情" },
          "503": { description: "至少一个关键依赖失败" },
        },
      },
    },
  },
  components: {
    schemas: {
      StandardError: {
        type: "object",
        required: ["success", "error", "meta"],
        properties: {
          success: { const: false },
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: {},
            },
          },
          meta: {
            type: "object",
            required: ["requestId", "build"],
            properties: {
              requestId: { type: "string" },
              build: { type: "object" },
            },
          },
        },
      },
      HealthDependency: {
        type: "object",
        required: ["name", "status", "message", "checkedAt"],
        properties: {
          name: { enum: ["config", "postgres", "redis", "migration", "worker"] },
          status: { enum: ["ok", "failed", "skipped"] },
          message: { type: "string" },
          checkedAt: { type: "string", format: "date-time" },
          latencyMs: { type: "number" },
        },
      },
    },
  },
} as const;

export type OpenApiDocument = typeof openApiDocument;
