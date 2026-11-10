import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("界面组件中文语言包", () => {
  it("日期选择器和分页等 Element Plus 组件统一使用简体中文", async () => {
    const 根组件 = await readFile(resolve(process.cwd(), "src/App.vue"), "utf8");

    expect(根组件).toContain('import zhCn from "element-plus/es/locale/lang/zh-cn"');
    expect(根组件).toContain('<el-config-provider :locale="zhCn">');
  });
});
