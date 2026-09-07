import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  type 企业微信映射导入文件,
  构建企业微信映射导入预览,
  解析企业微信映射文件,
} from "../src/wecom-identity-import.js";

describe("企业微信身份映射受控导入", () => {
  it("解析 XLSX 与 CSV 的姓名、账号列，并生成来源摘要", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["姓名", "账号"],
      ["张三", "zhangsan"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
    const xlsx = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const Excel结果 = 解析企业微信映射文件("企业微信映射.xlsx", xlsx);
    const CSV结果 = 解析企业微信映射文件(
      "企业微信映射.csv",
      Buffer.from("\uFEFF姓名,账号\n李四,lisi\n", "utf8"),
    );

    expect(Excel结果.rows).toEqual([
      { rowNumber: 2, displayName: "张三", wecomUserId: "zhangsan" },
    ]);
    expect(Excel结果.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(CSV结果.rows).toEqual([{ rowNumber: 2, displayName: "李四", wecomUserId: "lisi" }]);
  });

  it("恢复 multipart 上传中按 latin1 解码的中文文件名", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["姓名", "账号"],
        ["张三", "zhangsan"],
      ]),
      "Sheet1",
    );
    const xlsx = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const 乱码文件名 = Buffer.from("企业微信映射.xlsx", "utf8").toString("latin1");

    expect(解析企业微信映射文件(乱码文件名, xlsx).fileName).toBe("企业微信映射.xlsx");
  });

  it("区分待新增、已一致、等待 V3 账号和阻断项", () => {
    const file: 企业微信映射导入文件 = {
      fileName: "映射.xlsx",
      sourceSha256: "a".repeat(64),
      rows: [
        { rowNumber: 2, displayName: "张三", wecomUserId: "zhangsan" },
        { rowNumber: 3, displayName: "李四", wecomUserId: "lisi" },
        { rowNumber: 4, displayName: "王五", wecomUserId: "wangwu-new" },
        { rowNumber: 5, displayName: "赵六", wecomUserId: "zhaoliu" },
        { rowNumber: 6, displayName: "钱七", wecomUserId: "bound-user" },
      ],
    };
    const 预览 = 构建企业微信映射导入预览(
      file,
      [
        { id: "u1", username: "zhangsan", displayName: "张三", statusCode: "active" },
        { id: "u2", username: "lisi", displayName: "李四", statusCode: "active" },
        { id: "u3", username: "wangwu", displayName: "王五", statusCode: "active" },
        { id: "u4", username: "qianqi", displayName: "钱七", statusCode: "active" },
      ],
      [
        {
          id: "i2",
          userId: "u2",
          externalSubject: "lisi",
          externalUsername: "李四",
          statusCode: "active",
        },
        {
          id: "i3",
          userId: "u3",
          externalSubject: "wangwu-old",
          externalUsername: "王五",
          statusCode: "active",
        },
        {
          id: "i4",
          userId: "other-user",
          externalSubject: "bound-user",
          externalUsername: "其他人员",
          statusCode: "active",
        },
      ],
    );

    expect(预览.rows.map((item) => item.status)).toEqual([
      "ready",
      "unchanged",
      "blocked",
      "waiting_for_user",
      "blocked",
    ]);
    expect(预览.summary).toEqual({
      total: 5,
      ready: 1,
      unchanged: 1,
      waitingForUser: 1,
      blocked: 2,
    });
    expect(预览.canConfirm).toBe(false);
  });

  it("拒绝文件内重复、空值和已经停用的历史企业微信身份复用", () => {
    const 预览 = 构建企业微信映射导入预览(
      {
        fileName: "映射.csv",
        sourceSha256: "b".repeat(64),
        rows: [
          { rowNumber: 2, displayName: "张三", wecomUserId: "same" },
          { rowNumber: 3, displayName: "张三", wecomUserId: "other" },
          { rowNumber: 4, displayName: "李四", wecomUserId: "same" },
          { rowNumber: 5, displayName: "王五", wecomUserId: "" },
          { rowNumber: 6, displayName: "赵六", wecomUserId: "legacy" },
        ],
      },
      [
        { id: "u1", username: "z", displayName: "张三", statusCode: "active" },
        { id: "u2", username: "l", displayName: "李四", statusCode: "active" },
        { id: "u3", username: "zhao", displayName: "赵六", statusCode: "active" },
      ],
      [
        {
          id: "legacy",
          userId: "old",
          externalSubject: "legacy",
          externalUsername: "历史人员",
          statusCode: "disabled",
        },
      ],
    );

    expect(预览.rows.every((item) => item.status === "blocked")).toBe(true);
    expect(预览.summary.blocked).toBe(5);
  });
});
