import { describe, expect, it } from "vitest";

import { 渲染模板, 计算剩余天数 } from "../src/template-render.js";

describe("消息模板渲染器", () => {
  it("渲染普通变量", () => {
    const 结果 = 渲染模板(
      "客户报备保护期即将到期",
      "报备【{{customer_name}}】（编号 {{business_no}}）保护期将于 {{due_date}} 到期，剩余 {{days_left}} 天。",
      {
        customer_name: "江苏振华海科装备科技股份有限公司",
        business_no: "REG-001",
        due_date: "2026-08-21",
        days_left: 3,
      },
    );
    expect(结果.title).toBe("客户报备保护期即将到期");
    expect(结果.body).toContain("江苏振华海科装备科技股份有限公司");
    expect(结果.body).toContain("REG-001");
    expect(结果.body).toContain("剩余 3 天");
  });

  it("渲染渠道商名称和提报人", () => {
    const 结果 = 渲染模板(
      "订单等待处理",
      "渠道商【{{partner_name}}】、提报人【{{submitter_name}}】。订单【{{customer_name}}】待您审批。",
      {
        partner_name: "联软渠道商",
        submitter_name: "湛怀玉",
        customer_name: "验收客户",
      },
    );

    expect(结果.body).toBe("渠道商【联软渠道商】、提报人【湛怀玉】。订单【验收客户】待您审批。");
  });

  it("函数 days_left 按上海时区计算剩余天数", () => {
    const 今天 = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
    const 明天 = new Date(new Date().getTime() + 86_400_000).toLocaleDateString("en-CA", {
      timeZone: "Asia/Shanghai",
    });
    const 结果 = 渲染模板("t", "剩余 {{days_left(due_date)}} 天", { due_date: 明天 });
    expect(结果.body).toBe("剩余 1 天");
    const 今天结果 = 渲染模板("t", "剩余 {{days_left(due_date)}} 天", { due_date: 今天 });
    expect(今天结果.body).toBe("剩余 0 天");
  });

  it("函数 format_date 支持日期格式", () => {
    const 结果 = 渲染模板("t", "到期日 {{format_date(due_date, 'YYYY年MM月DD日')}}", {
      due_date: "2026-08-21",
    });
    expect(结果.body).toBe("到期日 2026年8月21日");
  });

  it("M8 到期提醒模板使用 worker 提供的变量字典可完整渲染", () => {
    const daysLeft = 计算剩余天数("2026-08-25");
    const 结果 = 渲染模板(
      "客户报备保护期即将到期",
      "报备【{{customer_name}}】（编号 {{business_no}}）保护期将于 {{due_date}} 到期，剩余 {{days_left}} 天，请及时安排后续处理。",
      {
        customer_name: "江苏振华海科装备科技股份有限公司",
        business_no: "REG-20260820-001",
        due_date: "2026-08-25",
        protect_days: "30",
        days_left: daysLeft,
      },
    );
    expect(结果.title).toBe("客户报备保护期即将到期");
    expect(结果.body).toContain("江苏振华海科装备科技股份有限公司");
    expect(结果.body).toContain("REG-20260820-001");
    expect(结果.body).toContain(`剩余 ${daysLeft} 天`);
  });

  it("未知变量与函数抛出明确错误", () => {
    expect(() => 渲染模板("t", "{{unknown_var}}", {})).toThrow("未提供的变量");
    expect(() => 渲染模板("t", "{{eval(1)}}", {})).toThrow("未注册的函数");
  });
});
