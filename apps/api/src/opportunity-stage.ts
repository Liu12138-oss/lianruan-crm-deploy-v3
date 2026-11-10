import { 应用错误 } from "@lianruan/shared";

export type 标准商机阶段 =
  | "customer_contact"
  | "demand_discovery"
  | "customer_solution"
  | "poc_trial"
  | "project_approval"
  | "tender"
  | "won"
  | "lost"
  | "cancelled";

const 推进阶段顺序: Array<Exclude<标准商机阶段, "lost" | "cancelled">> = [
  "customer_contact",
  "demand_discovery",
  "customer_solution",
  "poc_trial",
  "project_approval",
  "tender",
  "won",
];

const 阶段名称: Record<标准商机阶段, string> = {
  customer_contact: "客户建联",
  demand_discovery: "需求挖掘",
  customer_solution: "客户方案",
  poc_trial: "POC 试用",
  project_approval: "立项推进",
  tender: "招投标",
  won: "成单",
  lost: "输单",
  cancelled: "项目取消",
};

/** 将历史阶段、百分比和中文阶段名统一成当前业务阶段键。 */
export function 规范商机阶段(值: unknown): 标准商机阶段 | null {
  const 文本 = String(值 ?? "")
    .trim()
    .toLowerCase();
  if (!文本) return null;
  if (/lost|输单|丢单/.test(文本)) return "lost";
  if (/cancel|项目取消|已取消/.test(文本)) return "cancelled";
  if (/won|赢单|成交|^100$/.test(文本)) return "won";
  if (/tender|bidding|negotiation|投标|招投标|^80$|^90$/.test(文本)) return "tender";
  if (/project|approval|budget_approved|立项|^60$|^65$|^70$/.test(文本)) {
    return "project_approval";
  }
  if (/testing|poc|^50$/.test(文本)) return "poc_trial";
  if (/design|方案|^40$/.test(文本)) return "customer_solution";
  if (/budget|quoted|需求|^20$|^30$/.test(文本)) return "demand_discovery";
  if (/customer_contact|registered|contacted|建联|^1$|^10$/.test(文本)) {
    return "customer_contact";
  }
  return null;
}

/**
 * 商机只能逐级推进；输单和项目取消可从任意进行中阶段进入，但已经终止的商机不能重新推进。
 * 阶段未变化时允许更新跟进内容或商机资料。
 */
export function 校验商机阶段推进(
  当前阶段值: unknown,
  目标阶段值: unknown,
): { 当前阶段: 标准商机阶段; 目标阶段: 标准商机阶段 } {
  const 当前阶段 = 规范商机阶段(当前阶段值);
  const 目标阶段 = 规范商机阶段(目标阶段值);
  if (!目标阶段) {
    throw new 应用错误(
      "V3_OPPORTUNITY_STAGE_INVALID",
      "商机阶段无法识别，请选择系统提供的阶段。",
      400,
    );
  }
  if (!当前阶段) {
    throw new 应用错误(
      "V3_OPPORTUNITY_STAGE_INVALID",
      "当前商机阶段数据无法识别，请先联系管理员核对历史数据。",
      409,
    );
  }
  if (当前阶段 === 目标阶段) return { 当前阶段, 目标阶段 };
  if (目标阶段 === "lost" || 目标阶段 === "cancelled") return { 当前阶段, 目标阶段 };
  // 输单后允许依据新的业务结果更正为赢单，但已经终止的商机不能回到进行中阶段。
  if (当前阶段 === "lost" && 目标阶段 === "won") {
    return { 当前阶段, 目标阶段 };
  }
  if (当前阶段 === "won" || 当前阶段 === "lost" || 当前阶段 === "cancelled") {
    throw new 应用错误(
      "V3_OPPORTUNITY_STAGE_TERMINAL",
      "已结束的商机不能重新推进阶段，请新建商机继续跟进。",
      409,
    );
  }
  const 当前序号 = 推进阶段顺序.indexOf(当前阶段);
  const 目标序号 = 推进阶段顺序.indexOf(目标阶段);
  if (目标序号 !== 当前序号 + 1) {
    const 下一阶段 = 推进阶段顺序[当前序号 + 1];
    if (!下一阶段) {
      throw new 应用错误("V3_OPPORTUNITY_STAGE_TERMINAL", "当前商机已经完成全部推进阶段。", 409);
    }
    throw new 应用错误(
      "V3_OPPORTUNITY_STAGE_SKIP",
      `商机阶段必须逐级推进，当前只能推进到「${阶段名称[下一阶段]}」。`,
      409,
    );
  }
  return { 当前阶段, 目标阶段 };
}

/** 正式落库仍沿用现有阶段编码，避免破坏报表和历史数据。 */
export function 商机阶段落库编码(阶段: 标准商机阶段): string {
  if (阶段 === "project_approval") return "70";
  if (阶段 === "tender") return "negotiation";
  if (阶段 === "customer_contact") return "registered";
  if (阶段 === "demand_discovery") return "budget";
  if (阶段 === "customer_solution") return "design";
  if (阶段 === "poc_trial") return "testing";
  return 阶段;
}
