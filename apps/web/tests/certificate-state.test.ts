import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { 成员证书 } from "../src/api/organization-client.js";
import {
  合并证书更新,
  证书到期风险,
  证书剩余自然日,
} from "../src/features/certificate/certificate-state.js";

const 原证书: 成员证书 = {
  id: "cert-1",
  userId: "user-1",
  displayName: "测试人员",
  templateName: "测试证书",
  issuedOn: "2026-10-22",
  expiresOn: "2027-10-21",
  statusCode: "active",
  rowVersion: 3,
};

describe("证书页局部状态更新", () => {
  it("按上海自然日计算到期边界，到期当天和 30 天内为预警，31 天为有效", () => {
    const 当前 = Date.parse("2026-10-26T02:00:00.000Z");
    expect(证书剩余自然日("2026-10-26", 当前)).toBe(0);
    expect(证书到期风险({ statusCode: "active", expiresOn: "2026-10-26" }, 当前)).toBe(
      "30 天内到期",
    );
    expect(证书到期风险({ statusCode: "active", expiresOn: "2026-11-25" }, 当前)).toBe(
      "30 天内到期",
    );
    expect(证书到期风险({ statusCode: "active", expiresOn: "2026-11-26" }, 当前)).toBe("有效");
    expect(证书到期风险({ statusCode: "active", expiresOn: "2026-10-25" }, 当前)).toBe("已过期");
    expect(证书到期风险({ statusCode: "active", expiresOn: null }, 当前)).toBe("无到期日");
  });

  it("写接口返回新版本后立即替换旧版本，并保留未返回的展示字段", () => {
    const 更新后 = 合并证书更新([原证书], {
      id: "cert-1",
      expiresOn: "2028-10-21",
      rowVersion: 4,
    } as 成员证书);

    expect(更新后[0]).toEqual({
      ...原证书,
      expiresOn: "2028-10-21",
      rowVersion: 4,
    });
  });

  it("只替换目标证书，不影响其他记录", () => {
    const 其他证书 = { ...原证书, id: "cert-2", rowVersion: 9 };
    const 更新后 = 合并证书更新([原证书, 其他证书], {
      id: "cert-2",
      statusCode: "revoked",
      rowVersion: 10,
    } as 成员证书);

    expect(更新后[0]).toBe(原证书);
    expect(更新后[1]).toMatchObject({ id: "cert-2", statusCode: "revoked", rowVersion: 10 });
  });

  it("只有有效证书显示延期和撤销操作，模板操作不受证书状态影响", async () => {
    const 源码 = await readFile(
      resolve(process.cwd(), "src/features/certificate/CertificateCenterPage.vue"),
      "utf8",
    );
    const 模板区 = 源码.slice(
      源码.indexOf("<template v-if=\"当前标签 === '模板'"),
      源码.indexOf('<template v-else-if="当前证书"'),
    );
    const 证书区 = 源码.slice(
      源码.indexOf('<template v-else-if="当前证书"'),
      源码.indexOf('<div v-else class="war-empty">'),
    );

    expect(模板区).toContain('<div class="center-actions">');
    expect(模板区).not.toContain('v-if="当前证书');
    expect(证书区).toContain('v-if="当前证书?.statusCode === \'active\'" class="center-actions"');
  });
});
