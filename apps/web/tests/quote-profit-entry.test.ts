import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const 管理员脚本 = resolve(process.cwd(), "public/admin-app.js");
const 渠道脚本 = resolve(process.cwd(), "public/partner-app.js");
const 客户端脚本 = resolve(process.cwd(), "public/api-client.js");

describe("报价收益与硬件数量页面入口", () => {
  it("管理员和渠道页面均支持同型号正整数数量并提交 hardwareItems", async () => {
    for (const 文件 of [管理员脚本, 渠道脚本]) {
      const 内容 = await readFile(文件, "utf8");
      expect(内容).toContain("const hardwareQuantities = reactive({});");
      expect(内容).toContain("function getHardwareQuantity(hid)");
      expect(内容).toContain("function setHardwareQuantity(hid, value)");
      expect(内容).toContain(
        "return selectedHardware.value.map(hid => ({ productId: hid, quantity: getHardwareQuantity(hid) }));",
      );
      expect(内容).toContain("hardwareItems: buildHardwareItems()");
    }
  });

  it("管理员报价、订单和商机报价详情复用同一收益组件", async () => {
    const 内容 = await readFile(管理员脚本, "utf8");
    expect(内容).toContain("const QuoteProfitPanel =");
    expect(内容).toContain("内部收益核算");
    expect(内容).toContain("apiClient.getQuoteProfit(props.quoteId)");
    expect(内容).toContain("apiClient.saveQuoteProfitDraft");
    expect(内容).toContain("apiClient.recalculateQuoteProfit");
    expect(内容).toContain("apiClient.freezeQuoteProfit");
    expect(内容).toContain("项目收益");

    const 报价管理组件 = 读取组件源码(内容, "const QuoteList =", "const QuoteNew =");
    expect(报价管理组件).toContain("<QuoteProfitPanel :quote-id=\"detail.id || ''\" />");
    expect(报价管理组件).not.toContain('readonly context="order"');

    const 订单管理组件 = 读取组件源码(内容, "const OrderList =", "const Products =");
    expect(订单管理组件).toContain(
      '<QuoteProfitPanel :quote-id="detail.quoteId || detail.quoteNo || \'\'" readonly context="order" />',
    );

    const 商机管理组件 = 读取组件源码(内容, "const OpportunityList =", "const OpportunityNew =");
    expect(商机管理组件).toContain("<QuoteProfitPanel :quote-id=\"quoteDetailData?.id || ''\" />");
  });

  it("订单收益明确区分非正式结果和正式快照且保持只读", async () => {
    const 内容 = await readFile(管理员脚本, "utf8");
    expect(内容).toContain("订单尚未形成正式收益快照，以下为最新核算结果，仅供内部参考。");
    expect(内容).toContain("该订单已形成正式收益快照，以下金额只读且不可覆盖。");
    expect(内容).toContain("showEditActions");
    expect(内容).toContain('v-if="showEditActions"');
    expect(内容).toContain('v-if="readonly"');
  });

  it("报价详情在金额一致时优先展示已保存的渠道报价明细", async () => {
    const 内容 = await readFile(管理员脚本, "utf8");
    expect(内容).toContain(
      "const storedItems = Array.isArray(detail.value.items) ? detail.value.items : [];",
    );
    expect(内容).toContain("Math.abs(storedTotal - quoteTotal) <= 0.01");
    expect(内容).toContain("subtotal: Number(item.lineAmount) || 0");
  });

  it("管理员页面启动时刷新旧登录缓存以恢复区管区域信息", async () => {
    const 内容 = await readFile(管理员脚本, "utf8");
    expect(内容).toContain("async function refreshAdminSessionState()");
    expect(内容).toContain("await adminFetch(`${window.API_BASE}/auth/me`)");
    expect(内容).toContain("void refreshAdminSessionState();");
  });

  it("API客户端包含收益草稿、重算、冻结和成本规则方法", async () => {
    const 内容 = await readFile(客户端脚本, "utf8");
    for (const 方法 of [
      "getQuoteProfit",
      "saveQuoteProfitDraft",
      "recalculateQuoteProfit",
      "freezeQuoteProfit",
      "getHardwareCostRules",
      "createHardwareCostRule",
    ]) {
      expect(内容).toContain(`async ${方法}`);
    }
  });
});

function 读取组件源码(内容: string, 起始标记: string, 结束标记: string): string {
  const 起始位置 = 内容.indexOf(起始标记);
  const 结束位置 = 内容.indexOf(结束标记, 起始位置 + 起始标记.length);
  if (起始位置 < 0 || 结束位置 < 0) throw new Error(`无法定位组件：${起始标记}`);
  return 内容.slice(起始位置, 结束位置);
}
