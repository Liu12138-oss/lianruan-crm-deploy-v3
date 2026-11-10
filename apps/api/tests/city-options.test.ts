import { describe, expect, it } from "vitest";

import { 列出标准地市名称 } from "../src/business-store.js";

describe("渠道标准城市选项", () => {
  it("返回稳定的标准地市名称且包含南京", () => {
    const 城市列表 = 列出标准地市名称();

    expect(城市列表.length).toBeGreaterThan(250);
    expect(城市列表).toContain("南京市");
    expect(城市列表).toContain("延边朝鲜族自治州");
  });

  it("不把省级简称当成城市", () => {
    const 城市列表 = 列出标准地市名称();

    for (const 省级简称 of ["福建市", "山西市", "海南市", "广西市", "新疆市", "西藏市"]) {
      expect(城市列表).not.toContain(省级简称);
    }
  });

  it("返回结果按中文名称稳定排序且没有重复项", () => {
    const 城市列表 = 列出标准地市名称();
    const 排序副本 = [...城市列表].sort((左, 右) => 左.localeCompare(右, "zh-CN"));

    expect(城市列表).toEqual(排序副本);
    expect(new Set(城市列表).size).toBe(城市列表.length);
  });
});
