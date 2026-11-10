export type 商机阶段键 =
  | "customer_contact"
  | "demand_discovery"
  | "customer_solution"
  | "poc_trial"
  | "project_approval"
  | "tender"
  | "won"
  | "lost"
  | "cancelled";

export type 商机可推进阶段 = Exclude<商机阶段键, "lost" | "cancelled">;

export interface 商机阶段定义 {
  键: 商机可推进阶段;
  名称: string;
  进度: string;
  兼容阶段: string[];
  提交阶段: string;
  背景: string;
  点色: string;
}

export const 商机七阶段: 商机阶段定义[] = [
  {
    键: "customer_contact",
    名称: "客户建联（10%）",
    进度: "10%",
    兼容阶段: ["contacted", "registered", "1", "10"],
    提交阶段: "registered",
    背景: "#eef5ff",
    点色: "#2f69ed",
  },
  {
    键: "demand_discovery",
    名称: "需求挖掘（20%-30%）",
    进度: "20%-30%",
    兼容阶段: ["quoted", "budget", "20", "30"],
    提交阶段: "budget",
    背景: "#fff8e8",
    点色: "#c58a17",
  },
  {
    键: "customer_solution",
    名称: "客户方案（40%）",
    进度: "40%",
    兼容阶段: ["design", "40"],
    提交阶段: "design",
    背景: "#eef8ff",
    点色: "#1677a8",
  },
  {
    键: "poc_trial",
    名称: "POC 试用（50%）",
    进度: "50%",
    兼容阶段: ["testing", "poc", "50"],
    提交阶段: "testing",
    背景: "#f1f8f4",
    点色: "#159873",
  },
  {
    键: "project_approval",
    名称: "立项推进（60%-70%）",
    进度: "60%-70%",
    兼容阶段: ["project", "approval", "budget_approved", "60", "65", "70"],
    提交阶段: "negotiation",
    背景: "#f3f1ff",
    点色: "#6856d6",
  },
  {
    键: "tender",
    名称: "招投标（80%-90%）",
    进度: "80%-90%",
    兼容阶段: ["negotiation", "tender", "bidding", "80", "90"],
    提交阶段: "negotiation",
    背景: "#eef8ff",
    点色: "#1385a8",
  },
  {
    键: "won",
    名称: "成单（100%）",
    进度: "100%",
    兼容阶段: ["won", "赢单", "成交", "100"],
    提交阶段: "won",
    背景: "#ecf9f3",
    点色: "#0b8d69",
  },
];

export const 商机终止状态 = [
  { 键: "lost" as const, 名称: "输单", 背景: "#fff1f3", 点色: "#ce4b58" },
  { 键: "cancelled" as const, 名称: "项目取消", 背景: "#f1f4f8", 点色: "#68798e" },
];

export function 映射商机阶段(...候选值: unknown[]): 商机阶段键 {
  const 文本 = 候选值
    .flatMap((值) => (Array.isArray(值) ? 值 : [值]))
    .map((值) =>
      String(值 || "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean)
    .join(" ");

  if (/lost|输单|丢单/.test(文本)) return "lost";
  if (/cancel|取消/.test(文本)) return "cancelled";

  for (const 阶段 of [...商机七阶段].reverse()) {
    if (阶段.兼容阶段.some((兼容值) => 文本.includes(兼容值.toLowerCase()))) return 阶段.键;
  }

  const 百分数 = 文本.match(/(\d{1,3})\s*%/);
  if (百分数) {
    const 数值 = Number(百分数[1]);
    if (数值 >= 100) return "won";
    if (数值 >= 80) return "tender";
    if (数值 >= 60) return "project_approval";
    if (数值 >= 50) return "poc_trial";
    if (数值 >= 40) return "customer_solution";
    if (数值 >= 20) return "demand_discovery";
  }

  return "customer_contact";
}

export function 查找商机阶段(键: 商机阶段键): 商机阶段定义 | undefined {
  return 商机七阶段.find((阶段) => 阶段.键 === 键);
}

export function 商机阶段文案(键: 商机阶段键): string {
  if (键 === "lost") return "输单";
  if (键 === "cancelled") return "项目取消";
  return 查找商机阶段(键)?.名称 || "客户建联（10%）";
}

export function 商机阶段进度(键: 商机阶段键): string {
  if (键 === "lost" || 键 === "cancelled") return "0%";
  return 查找商机阶段(键)?.进度 || "10%";
}
