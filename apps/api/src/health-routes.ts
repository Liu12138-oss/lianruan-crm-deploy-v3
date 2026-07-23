import type { 构建信息 } from "@lianruan/shared";
import { 创建成功响应, 判断健康状态 } from "@lianruan/shared";
import type { Router } from "express";
import { Router as createRouter } from "express";

import type { 依赖检查器 } from "./dependencies.js";

export function 创建健康路由(参数: { dependencyChecker: 依赖检查器; build: 构建信息 }): Router {
  const router = createRouter();

  router.get("/live", (req, res) => {
    res.json(
      创建成功响应({
        requestId: req.requestId,
        build: 参数.build,
        data: {
          status: "ok",
          service: "api",
          checkedAt: new Date().toISOString(),
        },
      }),
    );
  });

  router.get("/ready", async (req, res, next) => {
    try {
      const dependencies = await 参数.dependencyChecker.check();
      const status = 判断健康状态(dependencies);
      res.status(status === "failed" ? 503 : 200).json(
        创建成功响应({
          requestId: req.requestId,
          build: 参数.build,
          data: {
            status,
            service: "api",
            checkedAt: new Date().toISOString(),
            dependencies,
          },
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/dependencies", async (req, res, next) => {
    try {
      const dependencies = await 参数.dependencyChecker.check();
      const status = 判断健康状态(dependencies);
      res.status(status === "failed" ? 503 : 200).json(
        创建成功响应({
          requestId: req.requestId,
          build: 参数.build,
          data: {
            status,
            service: "api",
            checkedAt: new Date().toISOString(),
            dependencies,
          },
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}
