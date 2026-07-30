import { type 应用配置, 读取应用配置 } from "@lianruan/config";

export const 测试请求编号 = "00000000-0000-4000-8000-000000000001";

export function 创建测试环境变量(覆盖: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    APP_ENV: "test",
    API_HOST: "127.0.0.1",
    API_PORT: "3101",
    CORS_ORIGIN: "http://127.0.0.1:5173",
    DATABASE_URL:
      process.env.V3_TEST_DATABASE_URL ||
      "postgresql://lianruan:lianruan_dev_password@127.0.0.1:5432/lianruan_crm_v3_test",
    REDIS_URL: "redis://:lianruan_dev_redis@127.0.0.1:6379/15",
    SESSION_SECRET: "test-only-session-secret",
    HEALTH_DEPENDENCY_MODE: "mock",
    V3_BUILD_VERSION: "3.0.0-test",
    V3_BUILD_COMMIT: "test",
    V3_BUILD_TIME: "2026-07-23T00:00:00.000Z",
    ...覆盖,
  };
}

export function 创建测试应用配置(覆盖: NodeJS.ProcessEnv = {}): 应用配置 {
  return 读取应用配置(创建测试环境变量(覆盖));
}

export function 创建测试服务配置(覆盖: NodeJS.ProcessEnv = {}): 应用配置 {
  return 创建测试应用配置(覆盖);
}
