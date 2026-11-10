import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("渠道列表技术服务商类型", () => {
  it("标题区展示签约、提名与非技术服务商三种业务口径", async () => {
    const 源码 = await readFile(
      resolve(process.cwd(), "src/features/channel/ChannelListPage.vue"),
      "utf8",
    );

    expect(源码).toContain("技术服务商：{{ 技术服务商类型文本(当前渠道) }}");
    expect(源码).toContain('return "签约技术服务商";');
    expect(源码).toContain('return "提名技术服务商";');
    expect(源码).toContain('return "非技术服务商";');
  });
});
