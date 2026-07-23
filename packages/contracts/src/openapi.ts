export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "联软CRM V3工程化骨架接口契约",
    version: "3.0.0-alpha.1",
    description: "阶段1只描述健康检查、统一响应和错误结构，不迁移历史业务接口。",
  },
  paths: {
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
