import { describe, expect, it } from "vitest";

import { 内存健康任务队列, 创建健康任务载荷 } from "../src/index.js";

describe("任务进程健康任务", () => {
  it("可以入队、领取并成功完成无副作用健康任务", async () => {
    const queue = new 内存健康任务队列();
    await queue.enqueue(创建健康任务载荷("task-1"));
    expect(queue.size()).toBe(1);
    const result = await queue.runNext();
    expect(result?.status).toBe("success");
    expect(result?.message).toContain("未产生业务副作用");
    expect(queue.size()).toBe(0);
  });

  it("非法载荷会被Zod拦截", async () => {
    const queue = new 内存健康任务队列();
    await expect(
      queue.enqueue({ taskId: "", requestedAt: "bad", source: "stage-1-health" }),
    ).rejects.toThrow();
  });
});
