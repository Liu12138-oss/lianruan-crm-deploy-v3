import { describe, expect, it } from "vitest";

import { 匹配城市, 构建城市检索项 } from "../src/features/channel/city-search.js";

const 城市选项 = 构建城市检索项(["南京市", "北京市", "连云港市", "延边朝鲜族自治州"]);

describe("渠道所在城市检索", () => {
  it("支持标准城市中文检索", () => {
    expect(匹配城市(城市选项, "南京").map((项) => 项.名称)).toEqual(["南京市"]);
  });

  it("支持无声调全拼检索", () => {
    expect(匹配城市(城市选项, "nanjing").map((项) => 项.名称)).toEqual(["南京市"]);
  });

  it("支持全拼首字母检索，并忽略空格", () => {
    expect(匹配城市(城市选项, "n j").map((项) => 项.名称)).toEqual(["南京市"]);
    expect(匹配城市(城市选项, "lyg").map((项) => 项.名称)).toEqual(["连云港市"]);
  });

  it("城市简称也能通过拼音命中标准全称", () => {
    expect(匹配城市(城市选项, "yanbian").map((项) => 项.名称)).toEqual(["延边朝鲜族自治州"]);
  });

  it("不存在的城市不返回候选", () => {
    expect(匹配城市(城市选项, "不存在的城市")).toEqual([]);
  });
});
