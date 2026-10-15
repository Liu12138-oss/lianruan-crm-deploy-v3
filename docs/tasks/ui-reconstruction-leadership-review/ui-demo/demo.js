const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;

const status = (text, tone = "gray") => `<span class="status ${tone}">${text}</span>`;

const state = {
  screen: "overview",
  tab: {},
  overlay: "",
  toast: "",
  regionFilter: "全部区域",
};

const screens = [
  ["overview", "设计总览", "设计文档", "页面地图、评审范围和原型入口。"],
  ["design-system", "设计系统", "设计文档", "颜色、排版、间距、表单、表格和状态规范。"],
  ["windows", "窗口与状态", "设计文档", "详情抽屉、审批弹窗、导入和异常状态。"],
  ["business-map", "业务全景图", "业务图", "从客户报备到订单履约和收益冻结的主业务链。"],
  ["business-flows", "业务链路图", "业务图", "渠道、账号、审批、消息、订单预审和收益链路。"],
  ["state-machines", "状态机与审批图", "业务图", "报备、商机、报价、订单、渠道和任务状态流转。"],
  [
    "channel-members",
    "渠道成员管理",
    "渠道运营",
    "查看、添加、编辑、停用、重置密码、业务角色和证书授权。",
  ],
  ["order-actions", "订单审批动作", "销售过程", "一级、区管、超管、退回修订和履约动作全集。"],
  ["pricing-rules", "模块价格规则", "产品与配置", "固定价、阶梯价、渠道比例和区域价格覆盖。"],
  ["dashboard", "总览仪表盘", "管理工作台", "管理员业务概览、待办和经营趋势。"],
  ["customers", "客户管理", "客户经营", "客户档案、归属、保护期和健康度。"],
  ["customer-new", "客户新增", "客户经营", "工商查询、客户报备、联系人与归属。"],
  ["customer-followup", "客户跟进", "客户经营", "待跟进客户、跟进记录和下一步计划。"],
  ["opportunities", "商机管理", "销售过程", "列表和阶段看板、推进、跟进和转报价。"],
  ["opportunity-new", "新建商机", "销售过程", "关联报备客户、项目信息和阶段计划。"],
  ["quotes", "报价审核与查询", "平台管理", "管理员跨商机查询报价、折扣审核和异常处理。"],
  ["quote-new", "报价单编辑器", "销售过程", "从商机进入的新建、修改和报价版本编辑。"],
  ["orders", "订单管理", "销售过程", "订单状态机、审批、履约和修订。"],
  ["channels", "渠道商管理", "渠道运营", "渠道档案、层级、成员、证书和合作状态。"],
  ["products", "产品目录", "产品与配置", "软件功能、硬件、套餐、价格和成本配置。"],
  ["approvals", "审核中心", "业务协同", "客户报备、渠道、员工、报价和订单审批。"],
  ["messages", "消息中心", "业务协同", "通知、待办、偏好和投递状态。"],
  ["organization", "组织与账号", "平台管理", "组织树、岗位、人员、数据范围和外部身份。"],
  ["roles", "角色与权限", "平台管理", "系统角色、业务权限、用户权限和数据范围。"],
  ["openapi", "OpenAPI 对接", "平台管理", "客户端、密钥、资源和调用日志。"],
  ["audit-system", "审计与系统", "平台管理", "审计日志、迁移状态、备份与服务健康。"],
  ["partner-dashboard", "渠道工作台", "渠道端", "渠道用户视角的报备、商机、报价和订单概览。"],
  ["mobile", "移动端原型", "渠道端", "管理员和渠道用户移动端关键页面。"],
  ["auth-flows", "认证与异常状态", "平台管理", "登录、单点登录、密码修改、会话失效、403 和维护。"],
  ["partner-report", "渠道经营报表", "渠道运营", "渠道业绩、级别、区域和技术服务商分析。"],
  ["channel-profile", "渠道画像与层级", "渠道运营", "渠道简介、产品能力、技术服务商和分销层级。"],
  ["certificate-management", "证书管理", "平台管理", "证书模板、持证记录、颁发、延期和撤销。"],
  ["message-platform", "消息渠道配置", "业务协同", "企微、短信、邮箱配置、测试和投递状态。"],
  ["message-rules", "提醒规则与模板", "业务协同", "事件订阅、到期提醒、模板和自建任务。"],
  ["account-management", "账号生命周期", "平台管理", "管理员、企业管理员、归档、恢复和归并。"],
  ["organization-admin", "组织双域管理", "平台管理", "内部组织、渠道组织、岗位、任职和数据范围。"],
  ["product-admin", "产品维护", "产品与配置", "大类、模块、功能、硬件、套餐和发布状态。"],
  ["workload-config", "工作量配置", "产品与配置", "产品映射、交付工作量和新版规则。"],
  ["import-export", "导入导出任务", "平台管理", "模板、上传、预检、执行和结果下载。"],
  ["quote-actions", "报价动作与收益", "销售过程", "发送、确认、撤回、过期、收益和一级渠道选择。"],
  ["audit-operations", "审计与运维", "平台管理", "日志详情、任务补偿、备份、恢复和系统状态。"],
  ["mobile-full", "移动端全量页面", "渠道端", "移动一期和二期全部高频任务页面。"],
  [
    "admin-settings",
    "管理配置中心",
    "平台管理",
    "集中进入组织、账号、证书、消息、提醒、产品、工作量、价格、OpenAPI 和审计运维。",
  ],
  [
    "extensions",
    "全量功能与窗口",
    "设计文档",
    "认证、渠道报表、证书、提醒、账号、组织、产品、工作量、导入导出、报价动作、审计运维和移动端全量页面。",
  ],
  [
    "architecture",
    "系统架构总览",
    "业务图",
    "四端入口、业务域、数据边界、任务链路、权限与实施顺序。",
  ],
];

const extendedCapabilities = [
  {
    id: "auth-flows",
    title: "认证与异常状态",
    group: "认证与安全",
    parent: "overview",
    desc: "登录、单点登录、密码修改、会话失效、403、维护和未知路由。",
  },
  {
    id: "partner-report",
    title: "渠道经营报表",
    group: "渠道运营",
    parent: "channels",
    desc: "渠道业绩、级别、区域、技术服务商和人均业绩分析。",
  },
  {
    id: "channel-profile",
    title: "渠道画像与层级",
    group: "渠道运营",
    parent: "channels",
    desc: "渠道简介、产品能力、技术服务商类型和一级/二级分销关系。",
  },
  {
    id: "certificate-management",
    title: "证书管理",
    group: "平台管理",
    parent: "channel-members",
    desc: "证书模板、持证记录、颁发、延期、撤销和到期风险。",
  },
  {
    id: "message-platform",
    title: "消息渠道配置",
    group: "业务协同",
    parent: "messages",
    desc: "企微群、企微应用、短信、SMTP、测试发送和投递状态。",
  },
  {
    id: "message-rules",
    title: "提醒规则与模板",
    group: "业务协同",
    parent: "messages",
    desc: "业务事件、到期提醒、任务模板、消息模板和自建任务。",
  },
  {
    id: "account-management",
    title: "账号生命周期",
    group: "平台管理",
    parent: "organization",
    desc: "管理员、企业管理员、渠道成员归档、恢复、归并和离职交接。",
  },
  {
    id: "organization-admin",
    title: "组织双域管理",
    group: "平台管理",
    parent: "organization",
    desc: "内部组织、渠道组织、岗位、任职、负责人和数据范围。",
  },
  {
    id: "product-admin",
    title: "产品维护",
    group: "产品与配置",
    parent: "products",
    desc: "产品大类、模块、功能、硬件、套餐及发布状态。",
  },
  {
    id: "workload-config",
    title: "工作量配置",
    group: "产品与配置",
    parent: "products",
    desc: "产品映射、交付工作量、特殊比例和敏感关键词规则。",
  },
  {
    id: "import-export",
    title: "导入导出任务",
    group: "平台管理",
    parent: "audit-system",
    desc: "模板下载、文件上传、预检、执行、结果下载和失败明细。",
  },
  {
    id: "quote-actions",
    title: "报价动作与收益",
    group: "销售过程",
    parent: "quotes",
    desc: "报价发送、确认、撤回、过期、收益预估、转订单和一级渠道选择。",
  },
  {
    id: "audit-operations",
    title: "审计与运维",
    group: "平台管理",
    parent: "audit-system",
    desc: "日志详情、任务补偿、备份恢复、服务健康和恢复演练。",
  },
  {
    id: "mobile-full",
    title: "移动端全量页面",
    group: "渠道端",
    parent: "mobile",
    desc: "移动一期和二期全部高频任务页面及高风险动作确认。",
  },
];

const extendedCapabilityMap = Object.fromEntries(
  extendedCapabilities.map((item) => [item.id, item]),
);

const navGroups = [
  { label: "设计文档", ids: ["overview", "design-system", "windows", "extensions"] },
  { label: "业务图", ids: ["business-map", "business-flows", "state-machines", "architecture"] },
  { label: "管理工作台", ids: ["dashboard"] },
  { label: "客户经营", ids: ["customers", "customer-new", "customer-followup"] },
  {
    label: "销售过程",
    ids: ["opportunities", "opportunity-new", "orders", "order-actions"],
  },
  { label: "渠道与产品", ids: ["channels", "channel-members", "products", "pricing-rules"] },
  { label: "业务协同", ids: ["approvals", "messages"] },
  {
    label: "平台管理",
    ids: ["admin-settings", "organization", "roles", "quotes", "openapi", "audit-system"],
  },
  { label: "渠道端与移动端", ids: ["partner-dashboard", "mobile"] },
  {
    label: "扩展能力",
    ids: [
      "auth-flows",
      "partner-report",
      "channel-profile",
      "certificate-management",
      "message-platform",
      "message-rules",
      "account-management",
      "organization-admin",
      "product-admin",
      "workload-config",
      "import-export",
      "quote-actions",
      "audit-operations",
      "mobile-full",
    ],
  },
];

const primaryNavigation = [
  ["business-map", "业务全景"],
  ["dashboard", "工作台"],
  ["customers", "客户管理"],
  ["opportunities", "商机作战"],
  ["channels", "渠道管理"],
  ["orders", "订单中心"],
  ["products", "产品目录"],
  ["messages", "消息中心"],
  ["admin-settings", "管理配置"],
];

const primaryNavigationGroups = {
  "business-map": ["business-map", "business-flows", "state-machines", "architecture"],
  dashboard: ["dashboard"],
  customers: ["customers", "customer-new", "customer-followup"],
  opportunities: ["opportunities", "opportunity-new", "quote-new"],
  channels: ["channels", "channel-members"],
  orders: ["orders", "order-actions"],
  products: ["products", "pricing-rules"],
  messages: ["messages", "message-platform", "message-rules"],
  "admin-settings": [
    "admin-settings",
    "organization",
    "roles",
    "openapi",
    "audit-system",
    "approvals",
    "windows",
    "design-system",
    "overview",
    "business-map",
    "business-flows",
    "state-machines",
    "quotes",
    "extensions",
    "auth-flows",
    "partner-report",
    "channel-profile",
    "certificate-management",
    "message-platform",
    "message-rules",
    "account-management",
    "organization-admin",
    "product-admin",
    "workload-config",
    "import-export",
    "quote-actions",
    "audit-operations",
    "mobile-full",
  ],
  organization: [
    "organization",
    "roles",
    "openapi",
    "audit-system",
    "approvals",
    "windows",
    "design-system",
    "overview",
    "business-map",
    "business-flows",
    "state-machines",
    "quotes",
    "extensions",
    "auth-flows",
    "partner-report",
    "channel-profile",
    "certificate-management",
    "message-platform",
    "message-rules",
    "account-management",
    "organization-admin",
    "product-admin",
    "workload-config",
    "import-export",
    "quote-actions",
    "audit-operations",
    "mobile-full",
  ],
};

const topPrimaryAction = {
  dashboard: ["customer-new", "新建客户"],
  customers: ["customer-new", "新建客户"],
  "customer-followup": ["followup-form", "记录跟进"],
  opportunities: ["opportunity-new", "新建商机"],
  "opportunity-new": ["submit-confirm", "创建商机"],
  quotes: ["quote-new", "新建报价"],
  "quote-new": ["quote-submit", "生成报价"],
  orders: ["order-primary-confirm", "一级确认"],
  channels: ["channel-edit", "新建渠道商"],
  "channel-members": ["member-editor", "添加成员"],
  "order-actions": ["order-primary-confirm", "一级确认"],
  "pricing-rules": ["pricing-editor", "编辑价格规则"],
  products: ["product-edit", "新建产品"],
  approvals: ["bulk-approve", "批量处理"],
  messages: ["message-preferences", "通知偏好"],
  organization: ["user-editor", "新建账号"],
  roles: ["role-editor", "新建角色"],
  openapi: ["api-client", "新建客户端"],
  extensions: ["extensions", "全量能力"],
};

const screensWithoutPageHeader = new Set([
  "dashboard",
  "customers",
  "customer-followup",
  "opportunities",
  "quotes",
  "orders",
  "channels",
  "products",
  "approvals",
  "messages",
  "organization",
  "roles",
  "openapi",
  "audit-system",
  "partner-dashboard",
  "extensions",
]);

const navIcon = {
  overview: "grid",
  "design-system": "layers",
  windows: "file",
  dashboard: "dashboard",
  customers: "users",
  "customer-new": "plus",
  "customer-followup": "message",
  opportunities: "target",
  "opportunity-new": "plus",
  quotes: "file",
  "quote-new": "plus",
  orders: "cart",
  channels: "building",
  products: "box",
  approvals: "check-circle",
  messages: "bell",
  organization: "layers",
  roles: "shield",
  openapi: "link",
  "audit-system": "database",
  "partner-dashboard": "building",
  mobile: "smartphone",
  extensions: "grid",
  "admin-settings": "settings",
  architecture: "layers",
  "auth-flows": "shield",
  "partner-report": "chart",
  "channel-profile": "building",
  "certificate-management": "shield",
  "message-platform": "message",
  "message-rules": "bell",
  "account-management": "users",
  "organization-admin": "layers",
  "product-admin": "box",
  "workload-config": "settings",
  "import-export": "upload",
  "quote-actions": "file",
  "audit-operations": "database",
  "mobile-full": "smartphone",
};

const navCount = {
  customers: "1,286",
  "customer-followup": "18",
  opportunities: "75",
  quotes: "96",
  orders: "128",
  channels: "192",
  approvals: "23",
  messages: "5",
};

const screenMap = Object.fromEntries(
  screens.map(([id, title, group, desc]) => [id, { id, title, group, desc }]),
);

const customerRows = [
  [
    "华南某智能制造集团",
    "CU202609150021",
    "制造",
    "华南区域",
    "深圳示例数字科技",
    "张明",
    "保护期内",
    "¥ 42.8 万",
    "green",
  ],
  [
    "华东某商业银行",
    "CU202609140016",
    "金融",
    "华东区域",
    "上海启辰信息技术",
    "陈佳",
    "待跟进",
    "¥ 68.0 万",
    "amber",
  ],
  [
    "某省级政务服务中心",
    "CU202606180008",
    "政府",
    "华北区域",
    "北京中安网络技术",
    "周宁",
    "商机推进",
    "¥ 51.7 万",
    "blue",
  ],
  [
    "华北某医疗集团",
    "CU202609080014",
    "医疗",
    "华北区域",
    "北京中安网络技术",
    "王卓",
    "持续运营",
    "¥ 24.6 万",
    "gray",
  ],
  [
    "西南某能源集团",
    "CU202609030009",
    "能源",
    "西南区域",
    "成都智联安全服务",
    "李楠",
    "即将到期",
    "¥ 18.8 万",
    "amber",
  ],
];

const opportunityRows = [
  [
    "华南某智能制造集团",
    "OP202609150031",
    "方案确认",
    "¥ 42.8 万",
    "65%",
    "张明",
    "2026-10-18",
    "blue",
  ],
  [
    "华东某商业银行",
    "OP202609140026",
    "商务谈判",
    "¥ 68.0 万",
    "80%",
    "陈佳",
    "2026-09-30",
    "amber",
  ],
  [
    "某省政务数据中心",
    "OP202609120019",
    "需求确认",
    "¥ 51.7 万",
    "45%",
    "周宁",
    "2026-11-08",
    "blue",
  ],
  [
    "华北某医疗集团",
    "OP202609080014",
    "POC 试用",
    "¥ 24.6 万",
    "55%",
    "王卓",
    "2026-10-25",
    "purple",
  ],
  [
    "西南某能源集团",
    "OP202609030009",
    "客户建联",
    "¥ 18.8 万",
    "25%",
    "李楠",
    "2026-12-12",
    "gray",
  ],
];

const quoteRows = [
  [
    "华南某智能制造集团",
    "QT202609160028",
    "终端安全改造项目",
    "1,200",
    "¥ 428,600.00",
    "待客户确认",
    "97%",
    "2026-10-16",
    "amber",
  ],
  [
    "华东某商业银行",
    "QT202609150019",
    "办公终端防护",
    "800",
    "¥ 680,000.00",
    "已发送",
    "95%",
    "2026-09-30",
    "blue",
  ],
  [
    "某省政务数据中心",
    "QT202609120011",
    "政务终端安全",
    "1,600",
    "¥ 516,800.00",
    "折扣待审",
    "88%",
    "2026-10-12",
    "amber",
  ],
  [
    "华北某医疗集团",
    "QT202609080007",
    "医疗终端安全",
    "600",
    "¥ 246,000.00",
    "已确认",
    "98%",
    "2026-10-08",
    "green",
  ],
  [
    "西南某能源集团",
    "QT202609050003",
    "能源终端改造",
    "400",
    "¥ 138,500.00",
    "已失效",
    "96%",
    "2026-09-05",
    "gray",
  ],
];

const orderRows = [
  [
    "华南某大型制造企业",
    "SO202609150018",
    "深圳示例数字科技",
    "¥ 328,600.00",
    "待审核",
    "待处理",
    "18 小时",
    "张明",
    "amber",
  ],
  [
    "华东某金融服务机构",
    "SO202609140032",
    "上海启辰信息技术",
    "¥ 189,000.00",
    "待确认",
    "已通过",
    "2 天",
    "陈佳",
    "blue",
  ],
  [
    "某省政务数据中心",
    "SO202609120009",
    "北京中安网络技术",
    "¥ 516,800.00",
    "履约中",
    "已通过",
    "交付 62%",
    "周宁",
    "green",
  ],
  [
    "华北某医疗集团",
    "SO202609080026",
    "北京中安网络技术",
    "¥ 246,000.00",
    "已完成",
    "已通过",
    "已归档",
    "王卓",
    "gray",
  ],
  [
    "西南某能源集团",
    "SO202609050013",
    "成都智联安全服务",
    "¥ 138,500.00",
    "已退回",
    "需修改",
    "未开始",
    "李楠",
    "red",
  ],
];

const channelRows = [
  [
    "深圳示例数字科技有限公司",
    "CH-2026-000128",
    "核心渠道",
    "华南区域",
    "刘海峰",
    "24 人 / 12 证",
    "合作中",
    "¥ 328.6 万",
    "green",
  ],
  [
    "上海启辰信息技术有限公司",
    "CH-2026-000112",
    "核心渠道",
    "华东区域",
    "周明远",
    "18 人 / 9 证",
    "合作中",
    "¥ 189.0 万",
    "green",
  ],
  [
    "北京中安网络技术有限公司",
    "CH-2026-000086",
    "金牌渠道",
    "华北区域",
    "赵思宁",
    "31 人 / 15 证",
    "待续签",
    "¥ 516.8 万",
    "amber",
  ],
  [
    "成都智联安全服务有限公司",
    "CH-2026-000141",
    "认证渠道",
    "西南区域",
    "彭奕辰",
    "6 人 / 3 证",
    "待审批",
    "¥ 138.5 万",
    "blue",
  ],
  [
    "厦门产品交付中心",
    "CH-2026-000166",
    "二级渠道",
    "福建",
    "林舒雅",
    "5 人 / 2 证",
    "待续签",
    "¥ 86.0 万",
    "amber",
  ],
];

function pageHead(title, desc, actions = "") {
  return `<header class="page-head"><div><h1>${title}</h1><p>${desc}</p></div><div class="page-actions">${actions}</div></header>`;
}

function metric(label, value, unit, note, _accent = false) {
  return `<article class="list-kpi"><div class="metric-label"><span>${label}</span>${icon("trend")}</div><div class="metric-value"><strong>${value}</strong><small>${unit}</small></div><div class="metric-foot">${note}</div></article>`;
}

function panel(title, desc, body, actions = "", flush = false) {
  return `<section class="panel"><header class="panel-head"><div><h2>${title}</h2>${desc ? `<p>${desc}</p>` : ""}</div>${actions ? `<div class="button-row">${actions}</div>` : ""}</header><div class="panel-body ${flush ? "flush" : ""}">${body}</div></section>`;
}

function progress(label, value) {
  return `<div class="progress-row"><span>${label}</span><div class="progress-track"><i style="width:${value}%"></i></div><strong>${value}%</strong></div>`;
}

function flow(steps, active, done = active - 1) {
  return `<div class="flow">${steps.map((step, index) => `<div class="flow-step ${index < done ? "done" : index === active ? "active" : ""}"><span class="flow-dot">${index < done ? "✓" : index + 1}</span><strong>${step}</strong></div>`).join("")}</div>`;
}

function infoGrid(items, triple = false) {
  return `<div class="info-grid ${triple ? "three" : ""}">${items.map(([label, value]) => `<div class="info-item"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>`;
}

function table(columns, rows) {
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function warWorkspace(config) {
  const visibleRecords = config.regionFilter
    ? config.records.filter(
        (record) => state.regionFilter === "全部区域" || record.region === state.regionFilter,
      )
    : config.records;
  const displayCount =
    config.regionFilter && state.regionFilter !== "全部区域"
      ? String(visibleRecords.length)
      : config.listCount;
  const records = visibleRecords
    .map(
      (record, index) =>
        `<article class="war-record ${index === 0 ? "active" : ""}"><div class="war-record-top"><strong>${record.title}</strong>${status(record.badge, record.tone)}</div><p>${record.meta}</p><div class="war-record-bottom"><span>${record.owner}</span><strong>${record.amount}</strong></div><div class="record-tags">${record.tags.map((tag, tagIndex) => `<span class="${tagIndex === 0 && record.tone !== "gray" ? "hot" : ""}">${tag}</span>`).join("")}</div>${record.actions ? `<div class="war-record-actions">${record.actions}</div>` : ""}</article>`,
    )
    .join("");
  const steps = config.steps
    .map((step, index) => {
      const stateClass =
        index < config.activeStep ? "done" : index === config.activeStep ? "active" : "";
      return `<div class="step-item ${stateClass}"><span class="dot">${index < config.activeStep ? "✓" : index + 1}</span><strong>${step}</strong></div>`;
    })
    .join("");
  const info = (items) =>
    items
      .map(
        ([label, value]) =>
          `<div class="info-item"><span>${label}</span><strong>${value}</strong></div>`,
      )
      .join("");
  const detailGrid = config.hideDetails
    ? ""
    : config.compactDetails
      ? `<div class="detail-grid"><article class="detail-card"><div class="card-head"><strong>${config.infoTitleOne}</strong><span>${config.infoNoteOne}</span></div><div class="info-grid">${info(config.infoOne)}</div></article><article class="detail-card soft"><div class="card-head"><strong>下一步建议</strong><span>业务助手</span></div><div class="note-box">${config.advice}</div></article></div>`
      : `<div class="detail-grid"><article class="detail-card"><div class="card-head"><strong>${config.infoTitleOne}</strong><span>${config.infoNoteOne}</span></div><div class="info-grid">${info(config.infoOne)}</div></article><article class="detail-card soft"><div class="card-head"><strong>${config.noteTitleOne}</strong><span>${config.noteNoteOne}</span></div><div class="note-box">${config.noteOne}</div></article><article class="detail-card"><div class="card-head"><strong>${config.infoTitleTwo}</strong><span>${config.infoNoteTwo}</span></div><div class="info-grid">${info(config.infoTwo)}</div></article><article class="detail-card soft"><div class="card-head"><strong>下一步建议</strong><span>业务助手</span></div><div class="note-box">${config.advice}</div></article></div>`;
  return `<div class="war-layout"><aside class="war-panel war-list"><div class="war-list-head"><div class="war-title-row"><strong>${config.listTitle}</strong><span class="count-badge">${displayCount}</span></div><div class="war-search">${icon("search")} ${config.searchPlaceholder}</div>${config.regionFilter ? `<div class="war-region-filter"><span>超管区域范围</span><button type="button" data-modal="region-filter">${icon("layers")} ${state.regionFilter} ${icon("chevron")}</button></div>` : ""}<div class="war-tabs"><span class="war-tab active">全部</span><span class="war-tab">${config.tabOne}</span><span class="war-tab">${config.tabTwo}</span></div></div><div class="war-list-body">${records}</div></aside><main class="war-panel war-center"><div class="war-center-head"><div class="deal-title"><strong>${config.centerTitle}</strong><span>${config.centerMeta}</span></div><div class="center-actions">${config.centerActions}</div></div><div class="stage-band"><div class="step-head"><span>${config.stageLabel}</span><strong>当前阶段：${config.steps[config.activeStep]}</strong></div><div class="step-dots">${steps}</div></div>${config.centerExtra || ""}${detailGrid}</main><aside class="war-panel war-right"><div class="right-section"><article class="right-card highlight"><div class="right-card-title"><strong>业务状态</strong><span>实时快照</span></div><div class="info-grid">${info(config.rightTop)}</div></article><article class="right-card"><div class="right-card-title"><strong>${config.progressTitle}</strong><span>当前周期</span></div><div class="progress-list">${config.progress.map(([label, value]) => progress(label, value)).join("")}</div></article><article class="right-card"><div class="right-card-title"><strong>最近动态</strong><span>共 ${config.timeline.length} 条</span></div><div class="timeline">${config.timeline.map(([title, time, desc]) => `<div class="timeline-item"><i class="timeline-dot"></i><div><strong>${title}</strong><p>${desc}</p></div><time>${time}</time></div>`).join("")}</div></article></div></aside></div>`;
}

function toolbar(filters, actions, tabs = "") {
  return `<div class="toolbar">${tabs || `<div class="filters">${filters}</div>`}<div class="button-row">${actions}</div></div>`;
}

function segment(name, items) {
  const active = state.tab[name] || items[0][0];
  return `<div class="segmented">${items.map(([value, label]) => `<button type="button" class="segment ${active === value ? "active" : ""}" data-tab="${name}" data-value="${value}">${label}</button>`).join("")}</div>`;
}

function actionButtons(items) {
  return `<span class="table-actions">${items
    .map(
      ([label, modal, cls = "link"]) =>
        `<button type="button" class="${cls}" data-modal="${modal}">${label}</button>`,
    )
    .join("")}</span>`;
}

function sidebar() {
  return `<aside class="sidebar"><div class="sidebar-inner">${navGroups
    .map(
      (group) =>
        `<section class="nav-group"><span class="nav-caption">${group.label}</span>${group.ids
          .map((id) => {
            const screen = screenMap[id];
            return `<button type="button" class="nav-item ${state.screen === id ? "active" : ""}" data-nav="${id}">${icon(navIcon[id] || "file")}<span class="nav-label">${screen.title}</span>${navCount[id] ? `<span class="nav-count">${navCount[id]}</span>` : ""}</button>`;
          })
          .join("")}</section>`,
    )
    .join("")}</div></aside>`;
}

function header() {
  return `<header class="app-header"><div class="brand"><span class="brand-mark">L</span><div class="brand-copy"><strong>联软渠道管理平台</strong><span>V3 UI 重构交互设计文档</span></div></div><div class="header-search">${icon("search")} 搜索客户、商机、报价单、订单或渠道商</div><div class="header-actions"><button type="button" class="icon-button" data-nav="messages" title="进入消息中心">${icon("bell")}<span class="badge">5</span></button><button type="button" class="icon-button" data-modal="messages-panel" title="快速查看消息">${icon("message")}</button><button type="button" class="icon-button" data-nav="design-system" title="设计系统">${icon("layers")}</button><button type="button" class="icon-button" data-nav="audit-system" title="系统状态">${icon("settings")}</button><span class="user-chip"><span class="avatar">刘</span>刘管理员 ${icon("chevron")}</span></div></header>`;
}

function topNavigation() {
  const action = topPrimaryAction[state.screen] || ["screen-map", "页面地图"];
  const actionAttribute = screenMap[action[0]]
    ? `data-nav="${action[0]}"`
    : `data-modal="${action[0]}"`;
  return `<header class="top-nav"><div class="top-brand"><span class="brand-logo">L</span><div class="brand-copy"><strong>联软渠道管理平台</strong><span>V3 工程化应用 · UI 重构设计原型</span></div></div><nav class="top-menu">${primaryNavigation
    .map(
      ([id, label]) =>
        `<button type="button" class="nav-link ${(primaryNavigationGroups[id] || []).includes(state.screen) ? "active" : ""}" data-nav="${id}">${label}</button>`,
    )
    .join(
      "",
    )}</nav><div class="top-actions"><button type="button" class="top-icon" data-modal="screen-map" title="页面地图">${icon("grid")}</button><button type="button" class="top-icon" data-nav="messages" title="进入消息中心">${icon("bell")}<i class="count">5</i></button><button type="button" class="top-icon" data-modal="messages-panel" title="快速查看消息">${icon("message")}</button><button type="button" class="top-icon" data-modal="mobile-guide" title="移动适配说明">${icon("smartphone")}</button><button type="button" class="button primary" ${actionAttribute}>${icon("plus")} ${action[1]}</button><span class="user-mini"><span class="user-avatar">刘</span>刘管理员</span></div></header>`;
}

function renderOverview() {
  const cards = screens
    .filter(([id]) => !["overview"].includes(id))
    .map(
      ([id, title, group, desc], index) =>
        `<button type="button" class="screen-link" data-nav="${id}"><span class="screen-no">${String(index + 1).padStart(2, "0")}</span><strong>${title}</strong><p>${desc}</p></button>`,
    )
    .join("");
  return `${pageHead("UI 重构交互设计文档", "覆盖管理端、渠道端、移动端、全局组件和关键业务窗口。点击任意页面可进入对应原型。", `<button type="button" class="button" data-nav="auth-flows">${icon("shield")} 认证与异常状态</button><button type="button" class="button" data-nav="extensions">${icon("grid")} 全量功能与窗口</button><button type="button" class="button primary" data-nav="design-system">${icon("layers")} 查看设计系统</button><button type="button" class="button" data-modal="print-help">${icon("download")} 导出说明</button>`)}
  ${panel("设计原则", "先统一设计体系，再按业务模块迁移，不改变现有权限、数据范围、状态机和接口契约。", `<div class="grid-4"><div class="callout"><strong>操作优先</strong><br />首屏展示业务状态、待办和下一步动作。</div><div class="callout"><strong>信息分层</strong><br />列表负责筛选，详情负责上下文，右侧负责决策。</div><div class="callout"><strong>状态可读</strong><br />相同状态跨模块使用一致颜色和语义。</div><div class="callout"><strong>渐进迁移</strong><br />页面按模块切换，保留可回退能力。</div></div>`)}
  ${panel("页面地图", `${screens.length - 1} 个页面与窗口原型，动态数据仅用于视觉评审。`, `<div class="screen-grid">${cards}</div>`)}`;
}

function renderDesignSystem() {
  const swatches = [
    ["品牌主色", "#2f69ed", "--blue"],
    ["主色深色", "#1557d6", "--blue-strong"],
    ["品牌深蓝", "#17345e", "--blue-deep"],
    ["成功", "#159873", "--green"],
    ["警告", "#c58a17", "--amber"],
    ["危险", "#ce4b58", "--red"],
    ["流程紫", "#7254d8", "--purple"],
    ["页面底色", "#eef4fa", "--page"],
  ];
  return `${pageHead("设计系统", "统一视觉令牌、排版、容器、表单、状态和操作规则。", `<button type="button" class="button primary" data-modal="token-export">${icon("download")} 导出设计令牌</button>`)}
  ${panel("颜色令牌", "品牌色用于主操作、选中态和关键数字；业务状态颜色保持跨模块一致。", `<div class="token-grid">${swatches.map(([name, value, token]) => `<article class="token-card"><div class="swatch" style="--swatch:${value}"></div><strong>${name}</strong><span>${token} · ${value}</span></article>`).join("")}</div>`)}
  <div class="grid-2">
    ${panel("字体与层级", "正文使用系统无衬线字体，数字使用等宽数字排版。", `<div class="spec-list"><div class="spec-item"><strong>页面标题</strong><span>22px / 700 / 行高 1.3</span></div><div class="spec-item"><strong>区块标题</strong><span>12px / 700 / 行高 1.4</span></div><div class="spec-item"><strong>正文与表格</strong><span>9-11px / 400-700 / 行高 1.45</span></div><div class="spec-item"><strong>关键数字</strong><span>23-28px / 800 / font-variant-numeric: tabular-nums</span></div></div>`)}
    ${panel("容器与间距", "桌面端以 8px 为基础间距，跨模块保持相同密度。", `<div class="spec-list"><div class="spec-item"><strong>基础间距</strong><span>4 / 8 / 12 / 16 / 20 / 24 px</span></div><div class="spec-item"><strong>卡片圆角</strong><span>8px；弹窗 10px；状态标签 5px</span></div><div class="spec-item"><strong>表格行高</strong><span>表头 32px，数据行 43px</span></div><div class="spec-item"><strong>输入控件</strong><span>最小高度 34px，筛选项 32px</span></div></div>`)}
  </div>
  ${panel("组件样例", "按钮、状态、标签、筛选项和流程条均通过统一样例展示。", `<div class="grid-3"><section><h3>按钮</h3><div class="button-row"><button class="button primary" type="button">主操作</button><button class="button" type="button">次要操作</button><button class="button danger" type="button">危险操作</button></div></section><section><h3>状态</h3><div class="chip-row">${status("已通过", "green")}${status("待审核", "amber")}${status("进行中", "blue")}${status("已退回", "red")}${status("已完成", "gray")}</div></section><section><h3>流程</h3>${flow(["提交", "审核", "确认", "交付"], 2)}</section></div>`)}
  ${panel("交互规则", "所有高风险动作必须二次确认；列表选择不得改变当前筛选条件。", `<div class="grid-3"><div class="callout success"><strong>成功反馈</strong><br />使用右下角轻提示，不打断当前任务。</div><div class="callout warning"><strong>冲突处理</strong><br />显示业务原因和刷新入口，不静默覆盖数据。</div><div class="callout"><strong>抽屉与弹窗</strong><br />详情使用右侧抽屉；跨模块操作和审批使用居中弹窗。</div></div>`)}`;
}

function dashboardMetricCard(label, value, unit, note, accent = false) {
  return metric(label, value, unit, note, accent);
}

function renderDashboard() {
  return `${pageHead("总览仪表盘", "查看客户、商机、报价、订单和渠道运营的实时概览。", `<button type="button" class="button" data-modal="import-center">${icon("upload")} 批量导入</button><button type="button" class="button primary" data-nav="customer-new">${icon("plus")} 新建客户</button>`)}
  <div class="war-kpis">${dashboardMetricCard("客户报备", "152", "条", "待审核 9 条", true)}${dashboardMetricCard("进行中商机", "44", "条", "本周新增 12 条")}${dashboardMetricCard("报价单", "96", "份", "待确认 14 份")}${dashboardMetricCard("订单", "128", "笔", "合同额 1,860 万")}${dashboardMetricCard("渠道商", "192", "家", "待审批 6 家")}${dashboardMetricCard("待处理提醒", "23", "项", "超时 5 项")}</div>
  <div class="grid-2">
    ${panel("业务趋势", "近六个月客户、商机和订单变化。", `<div class="progress-list">${progress("客户新增", 82)}${progress("商机转化", 68)}${progress("报价确认", 76)}${progress("订单交付", 91)}</div><div class="callout" style="margin-top:12px">本月商机金额环比上升 18%，订单按期交付率为 94%。</div>`)}
    ${panel("我的待办", "按优先级显示需当前账号处理的业务事项。", `<div class="list-stack"><article class="record-card"><div class="record-top"><strong>客户报备待审核</strong>${status("9 项", "amber")}</div><p>其中 2 项即将超过 24 小时时效。</p></article><article class="record-card"><div class="record-top"><strong>订单待确认</strong>${status("12 笔", "blue")}</div><p>3 笔订单已超时，需要优先处理。</p></article><article class="record-card"><div class="record-top"><strong>渠道资质待补齐</strong>${status("9 家", "red")}</div><p>证书或合作协议将在 30 天内到期。</p></article></div>`, `<button type="button" class="button small" data-nav="approvals">进入审核中心</button>`)}
  </div>
  ${panel(
    "最近业务",
    "跨模块展示最近发生的关键业务变化。",
    table(
      ["业务类型", "对象", "状态", "负责人", "更新时间"],
      [
        ["客户报备", "华南某智能制造集团", status("待审核", "amber"), "张明", "10 分钟前"],
        ["商机", "华东某商业银行终端安全项目", status("商务谈判", "blue"), "陈佳", "28 分钟前"],
        ["订单", "SO202609150018", status("待审核", "amber"), "周宁", "1 小时前"],
        ["渠道商", "成都智联安全服务有限公司", status("待审批", "blue"), "区域运营", "2 小时前"],
      ]
        .map(
          (row) =>
            `<tr><td>${row[0]}</td><td><span class="record-title">${row[1]}</span></td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td></tr>`,
        )
        .join(""),
    ),
    `<button type="button" class="button small" data-nav="audit-system">查看操作日志</button>`,
    true,
  )}`;
}

function customerTableRows() {
  return customerRows
    .map(
      (row) =>
        `<tr data-modal="customer-detail"><td><span class="record-title">${row[0]}</span><span class="record-meta">${row[1]}</span></td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td>${row[5]}</td><td>${status(row[6], row[8])}</td><td class="amount">${row[7]}</td><td>${actionButtons(
          [
            ["查看", "customer-detail"],
            ["跟进", "followup-form"],
          ],
        )}</td></tr>`,
    )
    .join("");
}

function renderCustomers() {
  return `<div class="war-kpis">${metric("客户总数", "1,286", "家", "本月新增 42 家", true)}${metric("待审核报备", "9", "家", "平均 0.8 天完成")}${metric("保护期内", "58", "家", "15 家即将到期")}${metric("重点客户", "36", "家", "贡献 62% 商机金额")}${metric("本月已跟进", "126", "次", "覆盖 78 家客户")}${metric("风险客户", "7", "家", "连续 30 天未跟进")}</div>${warWorkspace(
    {
      listTitle: "客户列表",
      listCount: "1,286",
      regionFilter: true,
      searchPlaceholder: "搜索客户名称、信用代码或负责人",
      tabOne: "我的客户",
      tabTwo: "待跟进",
      records: [
        {
          title: "华南某智能制造集团",
          region: "华南区域",
          meta: "制造 · 华南区域 · 深圳示例数字科技",
          badge: "保护期内",
          tone: "green",
          owner: "负责人：张明",
          amount: "¥ 42.8 万",
          tags: ["重点客户", "2 个商机"],
        },
        {
          title: "华东某商业银行",
          region: "华东区域",
          meta: "金融 · 华东区域 · 上海启辰信息技术",
          badge: "待跟进",
          tone: "amber",
          owner: "负责人：陈佳",
          amount: "¥ 68.0 万",
          tags: ["7 天未联系", "报价待确认"],
        },
        {
          title: "某省级政务服务中心",
          region: "华北区域",
          meta: "政府 · 华北区域 · 北京中安网络技术",
          badge: "商机推进",
          tone: "blue",
          owner: "负责人：周宁",
          amount: "¥ 51.7 万",
          tags: ["信息完整", "方案确认"],
        },
        {
          title: "华北某医疗集团",
          region: "华北区域",
          meta: "医疗 · 华北区域 · 北京中安网络技术",
          badge: "持续运营",
          tone: "gray",
          owner: "负责人：王卓",
          amount: "¥ 24.6 万",
          tags: ["已成交", "复购机会"],
        },
        {
          title: "西南某能源集团",
          region: "西南区域",
          meta: "能源 · 西南区域 · 成都智联安全服务",
          badge: "即将到期",
          tone: "amber",
          owner: "负责人：李楠",
          amount: "¥ 18.8 万",
          tags: ["保护期 12 天", "需续报"],
        },
      ],
      centerTitle: "华南某智能制造集团",
      centerMeta: "CU202609150021 · 制造业 · 华南区域 · 归属渠道：深圳示例数字科技有限公司",
      centerActions: `<button type="button" class="button" data-modal="customer-editor">${icon("edit")} 编辑客户档案</button><button type="button" class="button primary" data-modal="followup-form">${icon("message")} 新建跟进</button>`,
      stageLabel: "客户全生命周期",
      steps: ["客户报备", "审核通过", "保护期", "商机创建", "报价推进", "订单交付", "持续运营"],
      activeStep: 3,
      infoTitleOne: "客户档案",
      infoNoteOne: "工商信息已核验",
      infoOne: [
        ["客户编号", "CU202609150021"],
        ["统一社会信用代码", "91440300MA5F8X2D7Q"],
        ["所属行业", "制造业"],
        ["客户等级", "重点客户"],
        ["所属区域", "华南区域 / 广东省"],
        ["客户来源", "渠道自主报备"],
      ],
      noteTitleOne: "联系人信息",
      noteNoteOne: "2 位联系人",
      noteOne:
        "主要联系人：张明 · 信息中心负责人<br />手机：138****6621<br />邮箱：zhangming@example.com<br />偏好方式：企业微信 / 电话",
      infoTitleTwo: "业务概况",
      infoNoteTwo: "关联业务快照",
      infoTwo: [
        ["关联商机", "2 个"],
        ["关联报价", "1 份"],
        ["预计金额", "¥ 61.6 万"],
        ["最近跟进", "今天 09:18"],
        ["下次跟进", "09-19 10:00"],
        ["保护期剩余", "88 天"],
      ],
      advice:
        "建议本周内完成技术方案评审，并同步确认采购流程、预算归属和合同主体。当前未发现归属冲突或资料阻断项。",
      rightTop: [
        ["当前状态", "保护期内 · 活跃"],
        ["关联商机", "2 个 · ¥ 61.6 万"],
        ["本月跟进", "4 次"],
        ["健康评分", "86 / 100"],
      ],
      progressTitle: "客户健康度",
      progress: [
        ["资料完整度", 100],
        ["跟进连续度", 82],
        ["商机推进度", 68],
        ["关键人覆盖", 92],
      ],
      timeline: [
        ["电话 · 预算与项目范围确认", "今天 09:18", "客户确认一期预算约 42.8 万。"],
        ["拜访 · 现有资产与安全需求", "09-12 15:40", "完成终端资产梳理，技术负责人支持立项。"],
      ],
    },
  )}`;
}

function wizardStep(title, desc, index, active = false, done = false) {
  return `<div class="step-item ${active ? "active" : ""} ${done ? "done" : ""}"><span class="step-no">${done ? "✓" : index}</span><div><strong>${title}</strong><span>${desc}</span></div></div>`;
}

function renderCustomerNew() {
  return `${pageHead("新建客户与报备", "工商查询、客户档案、报备保护、联系人与归属一次完成。", `<button type="button" class="button" data-nav="customers">返回客户列表</button><button type="button" class="button">保存草稿</button><button type="button" class="button primary" data-modal="submit-confirm">提交审核</button>`)}
  <section class="panel"><div class="wizard-layout"><aside class="wizard-steps"><span class="nav-caption">填写进度</span><div class="step-list">${wizardStep("客户主体信息", "企业名称、信用代码和工商信息", 1, true)}${wizardStep("联系人与需求", "联系人、预算与项目背景", 2)}${wizardStep("归属与保护", "区域、渠道和跟进人员", 3)}${wizardStep("资料附件", "营业执照和项目材料", 4)}${wizardStep("确认提交", "查重与提交校验", 5)}</div></aside><main class="wizard-main"><section class="section"><div class="section-head"><strong>客户主体信息</strong><span>* 为必填项</span></div><div class="section-body"><div class="form-grid"><div class="form-field full"><label class="form-label required">客户名称（工商全称）</label><div class="form-control">华南某智能制造集团股份有限公司 ${icon("search")}</div><div class="helper">已匹配工商主体，信用代码和注册地址可自动回填。</div></div><div class="form-field"><label class="form-label required">统一社会信用代码</label><div class="form-control readonly">91440300MA5F8X2D7Q</div></div><div class="form-field"><label class="form-label required">所属行业</label><div class="form-control">制造业 / 智能制造 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">客户等级</label><div class="form-control">重点客户 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">企业规模</label><div class="form-control">1,000-5,000 人 ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label">注册地址</label><div class="form-control readonly">广东省深圳市南山区科技园示例路 88 号 A 栋 12 层</div></div></div></div></section><section class="section"><div class="section-head"><strong>联系人与项目需求</strong><span>用于运营审核和后续跟进</span></div><div class="section-body"><div class="form-grid"><div class="form-field"><label class="form-label required">主要联系人</label><div class="form-control">张明</div></div><div class="form-field"><label class="form-label">联系人职务</label><div class="form-control">信息中心负责人</div></div><div class="form-field"><label class="form-label required">联系电话</label><div class="form-control">138****6621</div></div><div class="form-field"><label class="form-label">联系邮箱</label><div class="form-control">zhangming@example.com</div></div><div class="form-field"><label class="form-label required">预计金额</label><div class="form-control">¥ 428,000</div></div><div class="form-field"><label class="form-label">预计签约时间</label><div class="form-control">2026-10-18 ${icon("calendar")}</div></div><div class="form-field full"><label class="form-label">项目需求说明</label><div class="form-control textarea">客户计划替换现有终端防护体系，一期覆盖 1,200 台办公终端，重点关注 EDR、数据防泄漏和等保合规能力。</div></div></div></div></section><section class="section"><div class="section-head"><strong>资料附件</strong><span>PDF、JPG、PNG、XLSX，单文件不超过 10 MB</span></div><div class="section-body"><div class="form-control textarea">${icon("upload")} 上传营业执照、客户授权材料或项目需求文件</div></div></section></main><aside class="wizard-aside"><article class="right-card highlight"><div class="right-title"><strong>查重结果</strong><span>刚刚更新</span></div>${status("未发现重复客户", "green")}<div class="info-grid" style="margin-top:10px">${infoGrid(
    [
      ["名称匹配", "无高相似记录"],
      ["信用代码", "无历史报备"],
    ],
  )}</div></article><article class="right-card"><div class="right-title"><strong>归属与保护</strong><span>按账号带入</span></div>${infoGrid(
    [
      ["所属区域", "华南区域"],
      ["归属渠道", "深圳示例数字科技"],
      ["跟进人员", "张明"],
      ["保护期", "通过后 90 天"],
    ],
  )}</article><article class="right-card"><div class="right-title"><strong>提交校验</strong><span>4 / 6 完成</span></div><div class="callout success">工商主体和联系人已校验</div><div class="callout warning" style="margin-top:8px">营业执照尚未上传，可能延长审核时间。</div></article></aside></div></section>`;
}

function renderCustomerFollowup() {
  return `${pageHead("客户跟进", "以客户视角聚合其关联商机的跟进记录、待办和下一步计划，不新增独立客户跟进数据模型。", `<button type="button" class="button" data-modal="followup-plan">${icon("calendar")} 跟进计划</button><button type="button" class="button primary" data-modal="followup-form">${icon("message")} 记录商机跟进</button>`)}
  <div class="war-kpis">${metric("今日待跟进", "18", "项", "10:00 前优先处理", true)}${metric("已逾期", "5", "项", "最长逾期 3 天")}${metric("本月跟进", "126", "次", "环比增长 18%")}${metric("平均响应", "1.2", "天", "目标不超过 2 天")}${metric("客户转商机", "12", "家", "转化率 24%")}${metric("下次提醒", "34", "项", "覆盖未来 7 天")}</div>
  <div class="split-layout"><div class="list-panel">${panel("待跟进客户", "18 项 · 来源：关联商机跟进计划", `<div class="list-stack"><article class="record-card selected"><div class="record-top"><strong>华南某智能制造集团</strong>${status("即将超时", "amber")}</div><p>关联商机：终端安全改造项目 · 需求确认</p><div class="record-bottom"><span>下次联系 10:30</span><strong>¥ 42.8 万</strong></div><div class="tag-row"><span class="tag blue">技术方案待确认</span><span class="tag amber">重点客户</span></div></article><article class="record-card"><div class="record-top"><strong>华东某商业银行</strong>${status("逾期 1 天", "red")}</div><p>关联商机：办公终端防护 · 报价确认</p><div class="record-bottom"><span>负责人：陈佳</span><strong>¥ 68.0 万</strong></div></article><article class="record-card"><div class="record-top"><strong>某省级政务服务中心</strong>${status("今日 14:00", "blue")}</div><p>关联商机：政务终端安全 · 方案交流</p><div class="record-bottom"><span>负责人：周宁</span><strong>¥ 51.7 万</strong></div></article><article class="record-card"><div class="record-top"><strong>华北某医疗集团</strong>${status("今日 16:30", "green")}</div><p>关联商机：医疗终端安全 · 交付回访</p><div class="record-bottom"><span>负责人：王卓</span><strong>¥ 24.6 万</strong></div></article></div>`)}</div><main class="detail-panel">${panel(
    "华南某智能制造集团",
    "CU202609150021 · 当前从 2 个关联商机聚合跟进 · 保护期剩余 88 天",
    `<div class="flow" style="margin-bottom:12px">${flow(["首次联系", "需求确认", "方案交流", "商务推进", "成交交付", "持续运营"], 1, 1)}</div><div class="grid-2"><div>${infoGrid(
      [
        ["主要联系人", "张明 · 信息中心"],
        ["联系电话", "138****6621"],
        ["采购联系人", "刘颖 · 采购经理"],
        ["归属渠道", "深圳示例数字科技"],
        ["关联商机", "终端安全改造项目"],
        ["商机预计金额", "¥ 42.8 万"],
      ],
      true,
    )}</div><div class="callout"><strong>本次跟进目标</strong><br />完成技术方案确认并约定采购流程评审时间。<br /><br /><strong>客户承诺</strong><br />本周内给出预算审批结果。</div></div>`,
    `<button type="button" class="button primary" data-modal="followup-form">${icon("message")} 记录商机跟进</button>`,
  )}${panel(
    "客户跟进记录",
    "聚合关联商机的跟进记录，共 12 条，按时间倒序",
    `<div class="timeline">${[
      [
        "电话 · 预算与项目范围确认",
        "2026-09-17 09:18",
        "关联商机：终端安全改造项目。确认一期预算约 42.8 万，客户要求周五前提交技术方案。",
        "张明",
      ],
      [
        "拜访 · 现有资产与安全需求",
        "2026-09-12 15:40",
        "关联商机：终端安全改造项目。完成终端资产梳理，技术负责人支持项目立项。",
        "张明",
      ],
      [
        "会议 · 初步方案交流",
        "2026-09-05 11:20",
        "关联商机：终端安全改造项目。介绍整体建设思路，客户关注兼容性和实施周期。",
        "李楠",
      ],
    ]
      .map(
        ([title, time, desc, owner]) =>
          `<div class="timeline-item"><i class="timeline-dot"></i><div><strong>${title}</strong><p>${desc}</p></div><time>${time} · ${owner}</time></div>`,
      )
      .join("")}</div>`,
  )}</main><aside class="decision-panel">${panel("客户健康度", "综合评分 86", `<div class="progress-list">${progress("联系活跃度", 92)}${progress("需求清晰度", 78)}${progress("决策链覆盖", 68)}${progress("资料完整度", 100)}</div>`)}${panel(
    "关联业务",
    "全链路快照",
    infoGrid([
      ["关联商机", "2 个"],
      ["关联报价", "1 份"],
      ["预计金额", "¥ 61.6 万"],
      ["保护期剩余", "88 天"],
    ]),
  )}${panel("下一步建议", "业务助手", `<div class="callout">建议补充采购联系人，并将技术方案评审安排在周五前完成。</div><button type="button" class="button primary full" style="margin-top:9px" data-nav="opportunities">查看关联商机</button>`)}</aside></div>`;
}

function opportunityCards() {
  const stages = [
    ["客户建联", "18", "¥ 188 万"],
    ["需求确认", "12", "¥ 246 万"],
    ["方案 / POC", "8", "¥ 312 万"],
    ["商务谈判", "5", "¥ 208 万"],
    ["成单交接", "3", "¥ 126 万"],
  ];
  return `<div class="grid-3">${stages.map(([label, count, amount]) => `<article class="panel"><div class="panel-body"><div class="record-top"><strong>${label}</strong>${status(count + " 条", "blue")}</div><div class="metric-value"><strong>${amount}</strong><small>预计金额</small></div><div class="callout" style="margin-top:10px">按最近跟进时间排序，停滞超过 7 天的商机将在卡片顶部显示风险提示。</div></div></article>`).join("")}</div>`;
}

function opportunityTableRows() {
  return opportunityRows
    .map(
      (row) =>
        `<tr data-modal="opportunity-detail"><td><span class="record-title">${row[0]}</span><span class="record-meta">${row[1]}</span></td><td>${status(row[2], row[7])}</td><td class="amount">${row[3]}</td><td>${row[4]}</td><td>${row[5]}</td><td>${row[6]}</td><td>${actionButtons(
          [
            ["查看", "opportunity-detail"],
            ["记录跟进", "followup-form"],
          ],
        )}</td></tr>`,
    )
    .join("");
}

function opportunityWorkspaceTabs(active) {
  const items = [
    ["overview", "概览"],
    ["followups", "跟进"],
    ["quotes", "报价"],
    ["orders", "订单"],
    ["archive", "档案与审计"],
  ];
  return `<div class="opportunity-workspace-tabs">${items.map(([value, label]) => `<button type="button" class="opportunity-workspace-tab ${active === value ? "active" : ""}" data-tab="opportunityWorkspace" data-value="${value}">${label}</button>`).join("")}</div>`;
}

function renderOpportunityWorkspace(active) {
  if (active === "followups") {
    return `<div class="opportunity-tab-content followup-tab-content"><section class="opp-tab-panel"><div class="card-head"><strong>跟进记录</strong><span>共 12 条</span></div><div class="timeline"><div class="timeline-item"><i class="timeline-dot"></i><div><strong>电话 · 方案与预算确认</strong><p>客户确认一期预算约 42.8 万，要求本周提交方案。</p></div><time>今天 09:18</time></div><div class="timeline-item"><i class="timeline-dot"></i><div><strong>拜访 · 终端资产盘点</strong><p>确认 1,200 台终端，技术负责人支持立项。</p></div><time>09-12 15:40</time></div></div></section><section class="opp-tab-panel soft"><div class="card-head"><strong>下一步计划</strong><span>业务助手</span></div><div class="note-box">完成技术方案评审，补充采购联系人，并约定商务谈判时间。</div><button type="button" class="button primary full" data-modal="followup-form">记录商机跟进</button></section></div>`;
  }
  if (active === "quotes") {
    return `<div class="opportunity-tab-content quote-tab-content"><section class="opp-tab-panel"><div class="card-head"><strong>报价版本</strong><span>共 2 份</span></div><div class="quote-version-list"><button type="button" class="quote-version active"><span>V2 · 当前有效</span><strong>QT202609160028</strong><small>待客户确认 · ¥ 42.86 万</small></button><button type="button" class="quote-version"><span>V1 · 历史版本</span><strong>QT202609120011</strong><small>草稿 · ¥ 18.8 万</small></button></div><button type="button" class="button" data-nav="quote-new">${icon("plus")} 新建报价版本</button></section><section class="opp-tab-panel soft"><div class="card-head"><strong>当前报价摘要</strong><span>服务端快照</span></div>${infoGrid(
      [
        ["报价编号", "QT202609160028"],
        ["客户", "华南某智能制造集团"],
        ["端点数量", "1,200 点"],
        ["报价总额", "¥ 428,600.00"],
        ["组合折扣", "97%"],
        ["有效期至", "2026-10-16"],
      ],
      true,
    )}<div class="button-row" style="margin-top:10px"><button type="button" class="button" data-modal="quote-detail">查看报价</button><button type="button" class="button" data-nav="quote-new">修改报价</button><button type="button" class="button primary" data-modal="convert-order">转订单</button></div></section></div>`;
  }
  if (active === "orders") {
    return `<div class="opportunity-tab-content order-tab-content"><section class="opp-tab-panel"><div class="card-head"><strong>关联订单</strong><span>尚未生成</span></div><div class="callout warning">当前报价尚未转订单。报价确认后，可从报价页签直接转订单，订单生成后这里显示订单状态、审批节点和履约进度。</div><button type="button" class="button primary" data-tab="opportunityWorkspace" data-value="quotes">前往报价页签</button></section><section class="opp-tab-panel soft"><div class="card-head"><strong>订单规则</strong><span>业务口径</span></div><div class="callout">报价单是订单的唯一来源；报价转订单后先进入一级确认或区管确认，订单中心只负责审批与履约。</div></section></div>`;
  }
  if (active === "archive") {
    return `<div class="opportunity-tab-content archive-tab-content"><section class="opp-tab-panel">${infoGrid(
      [
        ["商机编号", "OP202609150031"],
        ["客户", "华南某智能制造集团"],
        ["创建时间", "2026-09-15 10:20"],
        ["创建人", "张明"],
        ["负责人", "张明"],
        ["最后更新", "今天 09:30"],
      ],
      true,
    )}</section><section class="opp-tab-panel soft"><div class="card-head"><strong>状态历史与审计</strong><span>只追加</span></div><div class="timeline"><div class="timeline-item"><i class="timeline-dot"></i><div><strong>商机创建</strong><p>客户报备审核通过后创建。</p></div><time>09-15</time></div><div class="timeline-item"><i class="timeline-dot"></i><div><strong>报价单创建</strong><p>QT202609160028 已保存报价快照。</p></div><time>09-16</time></div></div></section></div>`;
  }
  return `<div class="opportunity-quote-strip"><div class="opportunity-quote-head"><strong>关联报价单</strong><span>共 2 份 · 报价单独立管理，商机只展示上下文</span></div><div class="opportunity-quote-list"><article class="quote-mini active"><div><strong>QT202609160028</strong>${status("待客户确认", "amber")}</div><p>终端安全改造项目 · 1,200 点 · ¥ 42.86 万</p><small>当前有效报价 · 张明 · 2026-10-16 到期</small></article><article class="quote-mini"><div><strong>QT202609120011</strong>${status("草稿", "gray")}</div><p>办公电脑防护试点 · 800 点 · ¥ 18.8 万</p><small>历史版本 · 张明 · 未发送</small></article></div><div class="opportunity-quote-actions"><button type="button" class="link" data-nav="quote-new">${icon("plus")} 新建报价</button><button type="button" class="link" data-tab="opportunityWorkspace" data-value="quotes">${icon("file")} 查看报价</button></div></div>`;
}

function renderOpportunities() {
  const activeWorkspaceTab = state.tab.opportunityWorkspace || "overview";
  return `<div class="war-kpis">${metric("商机总数", "75", "条", "本月新增 12 条", true)}${metric("活跃商机", "46", "条", "预计金额 960 万")}${metric("方案 / POC", "18", "条", "本周新增 4 条")}${metric("商务谈判", "8", "条", "预计金额 320 万")}${metric("预计成交", "6", "条", "赢单概率 78%")}${metric("停滞风险", "5", "条", "超过 7 天未跟进")}</div>${warWorkspace(
    {
      listTitle: "商机列表",
      listCount: "75",
      regionFilter: true,
      searchPlaceholder: "搜索商机名称、客户或商机编号",
      tabOne: "重点商机",
      tabTwo: "停滞风险",
      records: [
        {
          title: "华南某智能制造集团",
          region: "华南区域",
          meta: "方案确认 · 深圳示例数字科技",
          badge: "作战中",
          tone: "blue",
          owner: "负责人：张明",
          amount: "¥ 42.8 万",
          tags: ["65% 赢单", "本周跟进"],
        },
        {
          title: "华东某商业银行",
          region: "华东区域",
          meta: "商务谈判 · 上海启辰信息技术",
          badge: "高概率",
          tone: "green",
          owner: "负责人：陈佳",
          amount: "¥ 68.0 万",
          tags: ["80% 赢单", "报价已发送"],
        },
        {
          title: "某省政务数据中心",
          region: "华北区域",
          meta: "需求确认 · 北京中安网络技术",
          badge: "推进中",
          tone: "blue",
          owner: "负责人：周宁",
          amount: "¥ 51.7 万",
          tags: ["45% 赢单", "资产核验"],
        },
        {
          title: "华北某医疗集团",
          region: "华北区域",
          meta: "POC 试用 · 北京中安网络技术",
          badge: "POC",
          tone: "purple",
          owner: "负责人：王卓",
          amount: "¥ 24.6 万",
          tags: ["测试报告中", "55% 赢单"],
        },
        {
          title: "西南某能源集团",
          region: "西南区域",
          meta: "客户建联 · 成都智联安全服务",
          badge: "需跟进",
          tone: "amber",
          owner: "负责人：李楠",
          amount: "¥ 18.8 万",
          tags: ["25% 赢单", "首次交流"],
        },
      ],
      centerTitle: "终端安全改造项目",
      centerMeta: "OP202609150031 · 华南某智能制造集团 · 方案确认 · 赢单概率 65%",
      centerActions: `<button type="button" class="button" data-modal="followup-form">${icon("message")} 记录跟进</button><button type="button" class="button primary" data-nav="quote-new">${icon("file")} 创建报价单</button>`,
      stageLabel: "标准化商机作战流程",
      steps: ["客户建联", "客户方案", "需求挖掘", "POC 试用", "立项推进", "招投标", "成单交接"],
      activeStep: 2,
      compactDetails: activeWorkspaceTab === "overview",
      hideDetails: activeWorkspaceTab !== "overview",
      centerExtra: `${opportunityWorkspaceTabs(activeWorkspaceTab)}${renderOpportunityWorkspace(activeWorkspaceTab)}`,
      infoTitleOne: "商机信息",
      infoNoteOne: "业务事实",
      infoOne: [
        ["商机编号", "OP202609150031"],
        ["客户", "华南某智能制造集团"],
        ["预计金额", "¥ 42.8 万"],
        ["端点规模", "1,200 台"],
        ["负责人", "张明"],
        ["预计成交", "2026-10-18"],
      ],
      noteTitleOne: "当前跟进说明",
      noteNoteOne: "最近更新 18 分钟前",
      noteOne:
        "客户已完成初步方案确认，计划进入商务谈判和采购流程。需要补充采购部门联系人并确认合同主体。",
      infoTitleTwo: "竞争与决策",
      infoNoteTwo: "机会质量",
      infoTwo: [
        ["竞争态势", "无明确竞品"],
        ["关键决策人", "信息中心负责人"],
        ["预算状态", "已进入审批"],
        ["技术认可度", "较高"],
        ["关联报价", "待创建"],
        ["风险等级", "低"],
      ],
      advice:
        "建议本周完成技术方案评审，并创建报价单。项目处于方案确认阶段，应优先补齐采购流程和决策链信息。",
      rightTop: [
        ["商机状态", "作战中"],
        ["赢单概率", "65%"],
        ["停滞天数", "1 天"],
        ["预计金额", "¥ 42.8 万"],
      ],
      progressTitle: "商机健康度",
      progress: [
        ["客户活跃度", 92],
        ["需求清晰度", 86],
        ["方案完成度", 74],
        ["决策链覆盖", 68],
      ],
      timeline: [
        ["创建商机", "09-15 10:20", "从已通过客户报备创建。"],
        ["完成首次建联", "09-15 15:40", "确认终端规模和安全需求。"],
        ["方案初步确认", "09-17 09:18", "客户认可技术路线。"],
      ],
    },
  )}`;
}

function renderOpportunityNew() {
  return `${pageHead("新建商机", "商机必须关联已审批的报备客户，同一客户可创建多个商机。", `<button type="button" class="button" data-nav="opportunities">返回商机列表</button><button type="button" class="button primary" data-modal="submit-confirm">创建商机</button>`)}
  <section class="panel"><div class="wizard-layout"><aside class="wizard-steps"><span class="nav-caption">填写进度</span><div class="step-list">${wizardStep("关联报备客户", "仅可选择已审批客户", 1, true)}${wizardStep("商机信息", "阶段、金额和预计签约时间", 2)}${wizardStep("首次跟进", "记录线索来源和沟通情况", 3)}${wizardStep("确认提交", "校验并生成商机编号", 4)}</div></aside><main class="wizard-main"><section class="section"><div class="section-head"><strong>关联报备客户</strong><span>保护期内客户</span></div><div class="section-body"><div class="form-grid"><div class="form-field full"><label class="form-label required">客户</label><div class="form-control">华南某智能制造集团 ${icon("search")}</div><div class="helper">报备编号 REG202609150021，保护期至 2026-12-14。</div></div>${infoGrid(
    [
      ["联系人", "张明"],
      ["联系电话", "138****6621"],
      ["所属行业", "制造业"],
      ["归属渠道", "深圳示例数字科技"],
    ],
  )}</div><div class="callout warning" style="margin-top:12px">该客户已有 2 个商机，可继续创建新商机，但不自动合并金额和阶段。</div></div></section><section class="section"><div class="section-head"><strong>商机信息</strong><span>阶段、金额和预计签约时间由业务填写</span></div><div class="section-body"><div class="form-grid"><div class="form-field full"><label class="form-label required">商机名称</label><div class="form-control">华南某智能制造集团终端安全改造项目</div></div><div class="form-field"><label class="form-label required">当前阶段</label><div class="form-control">客户建联 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">端点数量</label><div class="form-control">1,200</div></div><div class="form-field"><label class="form-label required">预计金额</label><div class="form-control">¥ 428,000</div></div><div class="form-field"><label class="form-label">预计签约时间</label><div class="form-control">2026-10-18 ${icon("calendar")}</div></div><div class="form-field full"><label class="form-label">首次跟进记录</label><div class="form-control textarea">客户计划替换现有终端防护体系，一期覆盖 1,200 台终端。</div></div></div></div></section></main><aside class="wizard-aside"><article class="right-card highlight"><div class="right-title"><strong>阶段口径</strong><span>标准流程</span></div>${flow(["客户建联", "客户方案", "需求挖掘", "POC 试用", "立项推进", "招投标", "成单交接"], 0)}</article><article class="right-card"><div class="right-title"><strong>服务端自动生成</strong><span>只读</span></div>${infoGrid(
    [
      ["商机编号", "系统生成"],
      ["归属渠道", "当前客户渠道"],
      ["负责人", "当前账号"],
      ["创建时间", "提交时生成"],
    ],
  )}</article><article class="right-card"><div class="right-title"><strong>提交前检查</strong><span>2 项</span></div><div class="callout success">客户报备已通过</div><div class="callout warning" style="margin-top:8px">建议确认采购流程和关键决策人。</div></article></aside></div></section>`;
}

function quoteRowsHtml() {
  return quoteRows
    .map(
      (row) =>
        `<tr data-modal="quote-detail"><td><span class="record-title">${row[0]}</span><span class="record-meta">${row[1]} · ${row[2]}</span></td><td>${row[3]} 点</td><td class="amount">${row[4]}</td><td>${status(row[5], row[8])}</td><td>${row[6]}</td><td>${row[7]}</td><td>${actionButtons(
          [
            ["预览", "quote-detail"],
            ["转订单", "convert-order"],
          ],
        )}</td></tr>`,
    )
    .join("");
}

function renderQuotes() {
  return `<div class="war-kpis">${metric("报价单总数", "96", "份", "本月新增 18 份", true)}${metric("待发出", "7", "份", "草稿待提交")}${metric("待客户确认", "14", "份", "平均 2.1 天")}${metric("折扣待审", "5", "份", "超出授权折扣")}${metric("已确认", "42", "份", "确认率 76%")}${metric("本月失效", "3", "份", "有效期届满")}</div>${warWorkspace(
    {
      listTitle: "报价单列表",
      listCount: "96",
      regionFilter: true,
      searchPlaceholder: "搜索客户、报价单号或项目名称",
      tabOne: "待确认",
      tabTwo: "折扣待审",
      records: [
        {
          title: "华南某智能制造集团",
          region: "华南区域",
          meta: "QT202609160028 · 终端安全改造项目",
          badge: "待确认",
          tone: "amber",
          owner: "负责人：张明",
          amount: "¥ 42.86 万",
          tags: ["折扣 97%", "1,200 点"],
          actions: `<button type="button" class="link" data-modal="quote-detail">查看</button><button type="button" class="link" data-modal="convert-order">转订单</button>`,
        },
        {
          title: "华东某商业银行",
          region: "华东区域",
          meta: "QT202609150019 · 办公终端防护",
          badge: "已发送",
          tone: "blue",
          owner: "负责人：陈佳",
          amount: "¥ 68.0 万",
          tags: ["折扣 95%", "800 点"],
          actions: `<button type="button" class="link" data-modal="quote-detail">查看</button><button type="button" class="link" data-modal="convert-order">转订单</button>`,
        },
        {
          title: "某省政务数据中心",
          region: "华北区域",
          meta: "QT202609120011 · 政务终端安全",
          badge: "折扣待审",
          tone: "amber",
          owner: "负责人：周宁",
          amount: "¥ 51.68 万",
          tags: ["折扣 88%", "需审核"],
          actions: `<button type="button" class="link" data-modal="quote-detail">查看</button><button type="button" class="link" data-modal="convert-order">转订单</button>`,
        },
        {
          title: "华北某医疗集团",
          region: "华北区域",
          meta: "QT202609080007 · 医疗终端安全",
          badge: "已确认",
          tone: "green",
          owner: "负责人：王卓",
          amount: "¥ 24.6 万",
          tags: ["可转订单", "600 点"],
          actions: `<button type="button" class="link" data-modal="quote-detail">查看</button><button type="button" class="link" data-modal="convert-order">转订单</button>`,
        },
        {
          title: "西南某能源集团",
          region: "西南区域",
          meta: "QT202609050003 · 能源终端改造",
          badge: "已失效",
          tone: "gray",
          owner: "负责人：李楠",
          amount: "¥ 13.85 万",
          tags: ["已过期", "400 点"],
        },
      ],
      centerTitle: "报价单 QT202609160028",
      centerMeta: "华南某智能制造集团 · 待客户确认 · 深圳示例数字科技 · 有效期至 2026-10-16",
      centerActions: `<button type="button" class="button" data-nav="quote-actions">${icon("chart")} 报价动作与收益</button><button type="button" class="button" data-nav="quote-new">${icon("edit")} 修改报价</button><button type="button" class="button primary" data-modal="convert-order">${icon("cart")} 转订单</button>`,
      stageLabel: "报价确认流程",
      steps: ["报价配置", "服务端试算", "折扣审核", "发送客户", "客户确认", "转订单", "归档"],
      activeStep: 3,
      infoTitleOne: "报价概要",
      infoNoteOne: "服务端试算",
      infoOne: [
        ["报价单号", "QT202609160028"],
        ["客户名称", "华南某智能制造集团"],
        ["关联商机", "终端安全改造项目"],
        ["端点数量", "1,200 点"],
        ["报价总额", "¥ 428,600.00"],
        ["价格版本", "2026-09"],
      ],
      noteTitleOne: "报价说明",
      noteNoteOne: "折扣未超授权",
      noteOne:
        "该报价已按组合折扣 97% 由服务端试算完成，等待客户确认。硬件和服务明细已纳入报价快照。",
      infoTitleTwo: "金额构成",
      infoNoteTwo: "含税口径",
      infoTwo: [
        ["软件折后价", "¥ 320,000.00"],
        ["硬件报价", "¥ 40,000.00"],
        ["服务报价", "¥ 68,600.00"],
        ["组合折扣", "97%"],
        ["报价版本", "V2"],
        ["确认率", "76%"],
      ],
      advice:
        "客户仍未确认报价，建议在 48 小时内回访，确认折扣、实施服务和合同主体，确认后可直接转订单。",
      rightTop: [
        ["报价状态", "待客户确认"],
        ["报价总额", "¥ 42.86 万"],
        ["组合折扣", "97%"],
        ["有效期至", "2026-10-16"],
      ],
      progressTitle: "报价进度",
      progress: [
        ["配置完成度", 100],
        ["试算完成度", 100],
        ["折扣确认度", 90],
        ["客户确认度", 60],
      ],
      timeline: [
        ["报价单已发送客户", "今天 09:20", "发送给主要联系人和采购联系人。"],
        ["服务端试算完成", "09-16 18:40", "金额、折扣和工作量已固化快照。"],
        ["报价单创建", "09-16 17:50", "关联终端安全改造项目。"],
      ],
    },
  )}`;
}

function renderQuoteNew() {
  return `${pageHead("新建 / 编辑报价单", "报价单按客户和商机创建，软件、硬件、服务、阶梯价、区域覆盖和渠道价格比例均由服务端试算。", `<button type="button" class="button" data-nav="quotes">返回报价列表</button><button type="button" class="button">保存草稿</button><button type="button" class="button primary" data-modal="quote-submit">生成报价单</button>`)}
  <div class="quote-builder-layout"><aside class="quote-builder-side">${panel("报价对象", "客户、商机与价格上下文", `<div class="quote-field-list"><div><span>客户名称</span><strong>华南某智能制造集团 ${icon("chevron")}</strong></div><div><span>关联商机</span><strong>终端安全改造项目 ${icon("chevron")}</strong></div><div><span>端点数量</span><strong>1,200 点</strong></div><div><span>归属区域</span><strong>华南区域</strong></div><div><span>渠道层级</span><strong>一级渠道商</strong></div><div><span>渠道价格比例</span><strong>标准价 × 100%</strong></div><div><span>报价有效期</span><strong>30 天 ${icon("calendar")}</strong></div></div>`)}${panel("报价方式", "切换套餐、补充功能或自定义模块", `<div class="quote-mode-grid"><button type="button" class="quote-mode active"><strong>套餐报价</strong><span>标准组合</span></button><button type="button" class="quote-mode"><strong>补充功能</strong><span>套餐加配</span></button><button type="button" class="quote-mode"><strong>自定义报价</strong><span>自由组合</span></button></div>`)}${panel("价格规则命中", "服务端实时计算", `<div class="callout success">1,200 点命中 1,000+ 阶梯；华南区域覆盖优先，区域单价 ¥ 270 / 点；一级渠道比例 100%。</div>`)}</aside><main class="quote-builder-main">${panel(
    "软件模块",
    "价格 = 区域覆盖价优先于标准阶梯价，再应用渠道比例",
    `${table(
      ["产品模块", "数量", "标准价", "区域覆盖", "渠道比例", "最终单价", "小计", "操作"],
      [
        ["终端安全管理", "1,200 点", "¥ 280", "¥ 270", "100%", "¥ 270", "¥ 324,000.00", "移除"],
        ["数据防泄漏", "1,200 点", "¥ 80", "—", "100%", "¥ 80", "¥ 96,000.00", "移除"],
        ["终端准入控制", "500 点", "¥ 120", "—", "100%", "¥ 120", "¥ 60,000.00", "移除"],
      ]
        .map(
          (row) =>
            `<tr><td><span class="record-title">${row[0]}</span></td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td class="amount">${row[5]}</td><td class="amount">${row[6]}</td><td><button type="button" class="link">${row[7]}</button></td></tr>`,
        )
        .join(""),
    )}<div class="quote-add-row"><button type="button" class="button small" data-modal="product-picker">${icon("plus")} 从产品目录添加模块</button><button type="button" class="button small" data-modal="pricing-editor">${icon("edit")} 查看价格规则</button></div>`,
  )}${panel(
    "硬件与服务",
    "硬件数量、服务周期和赠送质保明细",
    `${table(
      ["项目", "类型", "数量", "单价", "小计", "操作"],
      [
        ["微盾安全网关", "硬件", "1 台", "¥ 40,000.00", "¥ 40,000.00", "移除"],
        ["标准质保服务（赠送 1 年）", "服务", "1 年", "¥ 0.00", "¥ 0.00", "移除"],
        ["实施服务", "服务", "1 项", "¥ 28,600.00", "¥ 28,600.00", "移除"],
      ]
        .map(
          (row) =>
            `<tr><td><span class="record-title">${row[0]}</span></td><td>${row[1]}</td><td>${row[2]}</td><td class="amount">${row[3]}</td><td class="amount">${row[4]}</td><td><button type="button" class="link">${row[5]}</button></td></tr>`,
        )
        .join(""),
    )}<div class="quote-add-row"><button type="button" class="button small" data-modal="product-picker">${icon("plus")} 添加硬件或服务</button></div>`,
  )}</main><aside class="quote-builder-summary">${panel(
    "报价单预览",
    "正式报价单结构",
    `<div class="quote-document"><div class="quote-document-brand"><span class="brand-logo">L</span><div><strong>联软安全产品报价单</strong><small>报价单号 QT202609160028 · 版本 V2</small></div></div><div class="quote-document-meta">${infoGrid(
      [
        ["客户", "华南某智能制造集团"],
        ["联系人", "张明"],
        ["报价日期", "2026-09-17"],
        ["有效期至", "2026-10-16"],
        ["商机", "终端安全改造项目"],
        ["渠道", "深圳示例数字科技"],
      ],
      true,
    )}</div><div class="quote-document-lines"><div><span>软件产品</span><strong>¥ 324,000.00</strong></div><div><span>数据防泄漏</span><strong>¥ 96,000.00</strong></div><div><span>终端准入控制</span><strong>¥ 60,000.00</strong></div><div><span>硬件产品</span><strong>¥ 40,000.00</strong></div><div><span>服务项目</span><strong>¥ 28,600.00</strong></div></div><div class="quote-document-total"><span>报价总额</span><strong>¥ 548,600.00</strong></div><small>金额、折扣、税费和工作量以生成时的服务端快照为准。</small></div>`,
  )}${panel("试算汇总", "服务端结果", `<div class="quote-summary-lines"><div><span>产品小计</span><strong>¥ 520,000.00</strong></div><div><span>服务合计</span><strong>¥ 28,600.00</strong></div><div><span>组合折扣</span><strong>100%</strong></div><div><span>税费</span><strong>¥ 31,962.26</strong></div><div class="total"><span>报价总额</span><strong>¥ 548,600.00</strong></div></div>`)}${panel("操作", "保存或提交后进入报价确认流程", `<div class="button-row"><button type="button" class="button" data-toast="报价草稿已保存。">保存草稿</button><button type="button" class="button primary" data-modal="quote-submit">生成报价单</button></div>`)}</aside></div>`;
}

function orderRowsHtml() {
  return orderRows
    .map(
      (row) =>
        `<tr data-modal="order-detail"><td><span class="record-title">${row[0]}</span><span class="record-meta">${row[1]}</span></td><td>${row[2]}</td><td class="amount">${row[3]}</td><td>${status(row[4], row[8])}</td><td>${row[5]}</td><td>${row[6]}</td><td>${row[7]}</td><td>${actionButtons(
          [
            ["详情", "order-detail"],
            ["修订", "order-revision"],
          ],
        )}</td></tr>`,
    )
    .join("");
}

function renderOrders() {
  return `<div class="war-kpis">${metric("订单总数", "128", "笔", "合同额 1,860 万", true)}${metric("待商务审核", "12", "笔", "超时 3 笔")}${metric("待渠道确认", "8", "笔", "平均 0.7 天")}${metric("履约交付中", "36", "笔", "按期率 94%")}${metric("已完成", "72", "笔", "环比增长 9%")}${metric("异常滞留", "5", "笔", "含退回修订 2 笔")}</div>${warWorkspace(
    {
      listTitle: "订单列表",
      listCount: "128",
      regionFilter: true,
      searchPlaceholder: "搜索订单编号、客户或渠道商",
      tabOne: "待我处理",
      tabTwo: "履约中",
      records: [
        {
          title: "华南某大型制造企业",
          region: "华南区域",
          meta: "SO202609150018 · QT202609160028 · 终端安全 + DLP + 网关",
          badge: "待一级确认",
          tone: "amber",
          owner: "负责人：张明",
          amount: "¥ 32.86 万",
          tags: ["3 个模块", "SLA 18 小时", "待一级确认"],
        },
        {
          title: "华东某金融服务机构",
          region: "华东区域",
          meta: "SO202609140032 · QT202609150019 · 终端安全 + 准入",
          badge: "待确认",
          tone: "blue",
          owner: "负责人：陈佳",
          amount: "¥ 18.90 万",
          tags: ["2 个模块", "待渠道确认"],
        },
        {
          title: "某省政务数据中心",
          region: "华北区域",
          meta: "SO202609120009 · QT202609120011 · 政务终端安全套餐",
          badge: "履约中",
          tone: "green",
          owner: "负责人：周宁",
          amount: "¥ 51.68 万",
          tags: ["4 个模块", "交付 62%", "按期"],
        },
        {
          title: "华北某医疗集团",
          region: "华北区域",
          meta: "SO202609080026 · QT202609080007 · 终端安全 + 实施服务",
          badge: "已完成",
          tone: "gray",
          owner: "负责人：王卓",
          amount: "¥ 24.60 万",
          tags: ["2 个模块", "已归档", "完成"],
        },
        {
          title: "西南某能源集团",
          region: "西南区域",
          meta: "SO202609050013 · QT202609050003 · 终端安全改造",
          badge: "已退回",
          tone: "red",
          owner: "负责人：李楠",
          amount: "¥ 13.85 万",
          tags: ["3 个模块", "需修改", "退回一级"],
        },
      ],
      centerTitle: "订单 SO202609150018",
      centerMeta: "华南某大型制造企业 · 待一级确认 · 深圳示例数字科技 · SLA 剩余 18 小时",
      centerActions: `<button type="button" class="button" data-modal="order-revision">${icon("edit")} 申请回退修订</button><button type="button" class="button danger" data-modal="order-primary-reject">${icon("alert")} 驳回并退回</button><button type="button" class="button primary" data-modal="order-primary-confirm">${icon("check-circle")} 一级确认订单</button>`,
      stageLabel: "订单处理流程",
      steps: ["订单提交", "一级确认", "区管确认", "超管确认", "采购备货", "履约交付", "完成归档"],
      activeStep: 1,
      hideDetails: true,
      centerExtra: `<div class="order-context-scroll"><div class="order-source-strip"><div class="order-source-main"><span>报价来源</span><strong>QT202609160028 · V2</strong><small>客户确认于 2026-09-17 16:40 · 价格版本 2026-09</small></div><div><span>组合折扣</span><strong>97%</strong></div><div><span>商品项</span><strong>3 项</strong></div><div><span>快照状态</span><strong>已冻结</strong></div><button type="button" class="button small" data-modal="quote-detail">${icon("eye")} 查看原报价</button></div><section class="order-module-panel"><header><div><strong>商品与价格快照</strong><span>订单确认后只读，修改必须走回退修订</span></div><div class="order-module-total"><span>合同金额</span><strong>¥ 328,600.00</strong></div></header>${table(
        ["产品 / 模块", "类型", "数量", "报价单价", "订单单价", "差异"],
        [
          ["终端安全管理", "软件", "1,200 点", "¥ 280.00", "¥ 270.00", "-¥ 10.00"],
          ["数据防泄漏", "软件", "1,200 点", "¥ 80.00", "¥ 80.00", "¥ 0.00"],
          ["微盾安全网关", "硬件", "1 台", "¥ 40,000.00", "¥ 40,000.00", "¥ 0.00"],
        ]
          .map(
            (row) =>
              `<tr data-modal="product-detail"><td><span class="record-title">${row[0]}</span></td><td>${row[1]}</td><td>${row[2]}</td><td class="amount">${row[3]}</td><td class="amount">${row[4]}</td><td class="amount ${row[5].startsWith("-") ? "order-diff" : ""}">${row[5]}</td></tr>`,
          )
          .join(""),
      )}</section></div>`,
      infoTitleOne: "订单信息",
      infoNoteOne: "业务事实",
      infoOne: [
        ["订单编号", "SO202609150018"],
        ["关联报价", "QT202609160028"],
        ["合同金额", "¥ 328,600.00"],
        ["客户名称", "华南某大型制造企业"],
        ["渠道商", "深圳示例数字科技"],
        ["负责人", "张明"],
      ],
      noteTitleOne: "当前处理说明",
      noteNoteOne: "一级分销商待确认",
      noteOne:
        "二级渠道商订单资料已提交，等待一级分销商确认产品模块、数量和金额。确认后进入区管审批。",
      infoTitleTwo: "交付信息",
      infoNoteTwo: "合同与收货",
      infoTwo: [
        ["产品明细", "终端安全 1,200 点"],
        ["签约主体", "深圳示例数字科技"],
        ["收货地址", "广东省深圳市南山区"],
        ["履约进度", "0%"],
        ["SLA 剩余", "18 小时"],
        ["审批节点", "一级确认"],
      ],
      advice:
        "一级分销商确认后将进入区管确认。若模块、数量或金额有误，应驳回并退回二级渠道商修改；如订单已确认后发现错误，则申请回退修订。",
      rightTop: [
        ["订单状态", "待一级确认"],
        ["来源报价", "QT202609160028 · V2"],
        ["商品项", "3 项"],
        ["合同金额", "¥ 32.86 万"],
        ["审批节点", "一级确认"],
        ["SLA 剩余", "18 小时"],
      ],
      progressTitle: "订单完成度",
      progress: [
        ["资料完整度", 100],
        ["一级确认", 35],
        ["区管确认", 0],
        ["履约交付", 0],
      ],
      timeline: [
        ["订单提交", "今天 10:28", "从报价单 QT202609160028 转入。"],
        ["合同附件校验完成", "今天 10:30", "附件格式和金额字段匹配。"],
        ["进入一级确认节点", "今天 10:31", "等待一级分销商确认。"],
      ],
    },
  )}`;
}

function channelRowsHtml() {
  return channelRows
    .map(
      (row) =>
        `<tr data-modal="channel-detail"><td><span class="record-title">${row[0]}</span><span class="record-meta">${row[1]}</span></td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td>${row[5]}</td><td>${status(row[6], row[8])}</td><td class="amount">${row[7]}</td><td>${actionButtons(
          [
            ["查看", "channel-detail"],
            ["编辑", "channel-edit"],
          ],
        )}</td></tr>`,
    )
    .join("");
}

function renderChannels() {
  return `<div class="war-kpis">${metric("渠道商总数", "192", "家", "本月新增 6 家", true)}${metric("核心渠道", "36", "家", "覆盖 8 个区域")}${metric("待审批", "6", "家", "平均 1.8 天完成")}${metric("待续签", "5", "家", "30 天内到期")}${metric("活跃成员", "1,284", "人", "近 30 日活跃 82%")}${metric("资质完整率", "92", "%", "9 家需补齐证书")}</div>${warWorkspace(
    {
      listTitle: "渠道商列表",
      listCount: "192",
      searchPlaceholder: "搜索渠道商名称、信用代码或管理员",
      tabOne: "核心渠道",
      tabTwo: "待续签",
      records: [
        {
          title: "深圳示例数字科技有限公司",
          meta: "核心渠道 · 华南区域 · 负责人：刘海峰",
          badge: "合作中",
          tone: "green",
          owner: "24 人 / 12 项证书",
          amount: "¥ 328.6 万",
          tags: ["一级渠道", "资质完整"],
        },
        {
          title: "上海启辰信息技术有限公司",
          meta: "核心渠道 · 华东区域 · 负责人：周明远",
          badge: "合作中",
          tone: "green",
          owner: "18 人 / 9 项证书",
          amount: "¥ 189.0 万",
          tags: ["一级渠道", "正常"],
        },
        {
          title: "北京中安网络技术有限公司",
          meta: "金牌渠道 · 华北区域 · 负责人：赵思宁",
          badge: "待续签",
          tone: "amber",
          owner: "31 人 / 15 项证书",
          amount: "¥ 516.8 万",
          tags: ["协议将到期", "需跟进"],
        },
        {
          title: "成都智联安全服务有限公司",
          meta: "认证渠道 · 西南区域 · 负责人：彭奕辰",
          badge: "待审批",
          tone: "blue",
          owner: "6 人 / 3 项证书",
          amount: "¥ 138.5 万",
          tags: ["准入审核", "资料齐全"],
        },
        {
          title: "厦门产品交付中心",
          meta: "二级渠道 · 深圳示例下级 · 负责人：林舒雅",
          badge: "待续签",
          tone: "amber",
          owner: "5 人 / 2 项证书",
          amount: "¥ 86.0 万",
          tags: ["二级渠道", "交付能力"],
        },
      ],
      centerTitle: "深圳示例数字科技有限公司",
      centerMeta: "CH-2026-000128 · 核心渠道 · 华南区域 · 企业管理员：刘海峰",
      centerActions: `<button type="button" class="button" data-nav="partner-report">${icon("chart")} 经营报表</button><button type="button" class="button" data-nav="channel-profile">${icon("building")} 渠道画像</button><button type="button" class="button" data-nav="channel-members">${icon("users")} 成员维护</button><button type="button" class="button primary" data-modal="channel-edit">${icon("edit")} 编辑渠道商信息</button>`,
      stageLabel: "渠道合作生命周期",
      steps: ["资料提交", "准入审核", "协议签署", "证书补齐", "开户激活", "合作运营", "年度续签"],
      activeStep: 5,
      infoTitleOne: "渠道档案",
      infoNoteOne: "主体信息已核验",
      infoOne: [
        ["统一社会信用代码", "91440300MA5F8X2D7Q"],
        ["渠道等级", "核心渠道"],
        ["所属区域", "华南区域"],
        ["企业管理员", "刘海峰"],
        ["成员规模", "24 人"],
        ["合作起始日", "2024-03-18"],
      ],
      noteTitleOne: "合作说明",
      noteNoteOne: "资质完整率 100%",
      noteOne:
        "华南区域核心渠道，具备终端安全、数据安全和技术交付能力。本年度目标完成率 82%，当前具备年度续签条件。",
      infoTitleTwo: "业务表现",
      infoNoteTwo: "本年度",
      infoTwo: [
        ["订单金额", "¥ 328.6 万"],
        ["报价数量", "32 份"],
        ["商机数量", "24 条"],
        ["活跃成员", "21 人"],
        ["证书数量", "12 项"],
        ["目标完成率", "82%"],
      ],
      advice:
        "建议在三日内提交年度续签材料，并完成一项即将到期的安全交付认证更新。当前无准入或合规阻断项。",
      rightTop: [
        ["合作状态", "正常合作"],
        ["渠道等级", "核心渠道"],
        ["资质完整度", "100%"],
        ["年度目标完成率", "82%"],
      ],
      progressTitle: "渠道健康度",
      progress: [
        ["经营贡献", 88],
        ["资质完整度", 100],
        ["成员活跃度", 82],
        ["交付能力", 92],
      ],
      timeline: [
        ["渠道资料审核通过", "今天 09:10", "主体、管理员和证书均已核验。"],
        ["企业管理员补充证书", "09-14 15:20", "新增安全交付认证 2 项。"],
        ["新增二级渠道", "09-09 11:40", "厦门产品交付中心已创建。"],
      ],
    },
  )}`;
}

function renderProducts() {
  const products = [
    ["终端安全管理", "软件模块", "¥ 680 / 点", "已发布", "12 项工作量规则"],
    ["数据防泄漏", "软件模块", "¥ 320 / 点", "已发布", "8 项工作量规则"],
    ["微盾安全网关", "硬件产品", "¥ 68,000 / 台", "已发布", "成本规则已维护"],
    ["终端安全基础套餐", "产品套餐", "¥ 428,000", "已发布", "12 个功能模块"],
    ["LV-7050-A", "硬件产品", "¥ 36,800 / 台", "成本待补充", "年度质保成本待确定"],
  ];
  return `${pageHead("产品目录", "统一维护软件功能、硬件产品、套餐、价格规则、工作量和收益成本。", `<button type="button" class="button" data-nav="product-admin">${icon("layers")} 产品维护</button><button type="button" class="button" data-nav="workload-config">${icon("settings")} 人天与工作量配置</button><button type="button" class="button" data-modal="product-import">${icon("upload")} 导入产品</button><button type="button" class="button primary" data-modal="product-edit">${icon("plus")} 新建产品</button>`)}
  <div class="war-kpis">${metric("软件功能", "34", "项", "全部已发布", true)}${metric("硬件产品", "15", "款", "1 款成本待补充")}${metric("产品套餐", "6", "个", "含 52 个功能项")}${metric("工作量映射", "49", "条", "覆盖报价试算")}${metric("价格规则", "86", "条", "阶梯与区域价格")}${metric("待完善", "3", "项", "阻塞正式收益冻结")}</div>
  ${panel(
    "产品与套餐",
    "产品目录承担对外报价与内部成本的双重职责，但两类数据必须分表隔离。",
    `${toolbar(`<div class="field search">${icon("search")}<input placeholder="搜索产品名称、编号、型号" /></div><div class="field">${icon("filter")} 全部类型 ${icon("chevron")}</div><div class="field">${icon("layers")} 全部产品线 ${icon("chevron")}</div>`, `<button type="button" class="button small">${icon("download")} 导出</button><button type="button" class="button small primary">查询</button>`)}${table(
      ["产品名称", "类型", "公开价格", "状态", "配置说明", "操作"],
      products
        .map(
          (row) =>
            `<tr data-modal="product-detail"><td><span class="record-title">${row[0]}</span></td><td>${row[1]}</td><td class="amount">${row[2]}</td><td>${status(row[3], row[3] === "已发布" ? "green" : "amber")}</td><td>${row[4]}</td><td><span class="table-actions"><button type="button" class="link" data-modal="product-detail">查看</button><button type="button" class="link" data-modal="product-edit">编辑</button><button type="button" class="link" data-modal="pricing-editor">价格规则</button><button type="button" class="link" data-modal="cost-rule">成本配置</button></span></td></tr>`,
        )
        .join(""),
    )}</div>`,
    "",
    true,
  )}`;
}

function approvalRows(tab) {
  const rows = {
    registrations: [
      [
        "客户报备",
        "华南某智能制造集团",
        "深圳示例数字科技",
        "张明",
        "10 分钟前",
        "待审核",
        "amber",
      ],
      ["客户报备", "华东某商业银行", "上海启辰信息技术", "陈佳", "28 分钟前", "待审核", "amber"],
      ["客户报备", "某省级政务服务中心", "北京中安网络技术", "周宁", "1 小时前", "审核中", "blue"],
    ],
    channels: [
      [
        "渠道准入",
        "成都智联安全服务有限公司",
        "西南区域",
        "彭奕辰",
        "待审批 2 天",
        "待审批",
        "blue",
      ],
      [
        "渠道续签",
        "北京中安网络技术有限公司",
        "华北区域",
        "赵思宁",
        "30 天内到期",
        "待续签",
        "amber",
      ],
    ],
    quotes: [
      ["报价折扣", "QT202609120011", "某省政务数据中心", "周宁", "折扣 88%", "折扣待审", "amber"],
      ["报价确认", "QT202609160028", "华南某智能制造集团", "张明", "客户已确认", "待审核", "blue"],
    ],
    orders: [
      [
        "订单审核",
        "SO202609150018",
        "华南某大型制造企业",
        "周宁",
        "超时 2 小时",
        "待商务审核",
        "red",
      ],
      [
        "渠道确认",
        "SO202609140032",
        "华东某金融服务机构",
        "陈佳",
        "等待 0.7 天",
        "待渠道确认",
        "blue",
      ],
    ],
  };
  return table(
    ["审批类型", "业务对象", "渠道 / 客户", "申请人", "时效", "状态", "操作"],
    rows[tab]
      .map(
        (row) =>
          `<tr data-modal="approval-detail"><td>${row[0]}</td><td><span class="record-title">${row[1]}</span></td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td>${status(row[5], row[6])}</td><td>${actionButtons(
            [
              ["审核", "approval-detail"],
              ["查看", "approval-detail"],
            ],
          )}</td></tr>`,
      )
      .join(""),
  );
}

function renderApprovals() {
  const tab = state.tab.approvals || "registrations";
  return `${pageHead("审核中心", "统一处理客户报备、渠道、员工、报价和订单审批。", `<button type="button" class="button">${icon("refresh")} 刷新</button><button type="button" class="button primary" data-modal="bulk-approve">批量处理</button>`)}
  <div class="war-kpis">${metric("待处理总数", "23", "项", "超时 5 项", true)}${metric("客户报备", "9", "项", "平均 0.8 天")}${metric("渠道与账号", "6", "项", "含续签 2 项")}${metric("报价审核", "5", "项", "折扣或确认")}${metric("订单审批", "3", "项", "其中超时 2 项")}${metric("今日已完成", "18", "项", "处理效率环比提升")}</div>
  ${panel(
    "待审批任务",
    "所有审批均保留业务上下文和状态变化记录。",
    `${toolbar(
      "",
      "",
      segment("approvals", [
        ["registrations", "客户报备 9"],
        ["channels", "渠道与账号 6"],
        ["quotes", "报价 5"],
        ["orders", "订单 3"],
      ]),
    )}${approvalRows(tab)}</div>`,
    "",
    true,
  )}`;
}

function messageRows() {
  return [
    [
      "客户报备待审核",
      "华南某智能制造集团 · 需在 14:00 前完成",
      "审批待办",
      "10 分钟前",
      "未读",
      "amber",
    ],
    [
      "订单即将超时",
      "SO202609150018 已进入商务审核 22 小时",
      "超时提醒",
      "28 分钟前",
      "未读",
      "red",
    ],
    [
      "报价客户已确认",
      "QT202609160028 客户确认报价，可转订单",
      "业务进展",
      "1 小时前",
      "未读",
      "green",
    ],
    [
      "渠道证书即将到期",
      "北京中安网络技术有限公司有 3 项证书将在 30 天内到期",
      "资质提醒",
      "2 小时前",
      "未读",
      "amber",
    ],
    [
      "系统备份完成",
      "数据库、配置文件和上传文件已完成本机备份",
      "系统通知",
      "昨天",
      "已读",
      "gray",
    ],
  ]
    .map(
      (row) =>
        `<tr data-modal="message-detail"><td><span class="record-title">${row[0]}</span><span class="record-meta">${row[1]}</span></td><td>${row[2]}</td><td>${row[3]}</td><td>${status(row[4], row[4] === "未读" ? "blue" : "gray")}</td><td>${actionButtons(
          [
            ["查看", "message-detail"],
            ["标记已读", "mark-read"],
          ],
        )}</td></tr>`,
    )
    .join("");
}

function renderMessages() {
  return `${pageHead("消息中心", "集中展示审批待办、业务提醒、系统通知和外部投递状态。", `<button type="button" class="button" data-nav="message-platform">${icon("settings")} 消息渠道配置</button><button type="button" class="button" data-nav="message-rules">${icon("bell")} 提醒规则与模板</button><button type="button" class="button primary" data-modal="mark-all-read">全部标记已读</button>`)}
  <div class="workspace-switch"><button type="button" class="active">消息列表</button><button type="button" data-nav="message-platform">消息渠道配置</button><button type="button" data-nav="message-rules">提醒规则与模板</button></div>
  <div class="war-kpis">${metric("未读消息", "5", "条", "2 条需立即处理", true)}${metric("审批待办", "18", "项", "超时 5 项")}${metric("业务提醒", "42", "条", "本周")}${metric("系统通知", "7", "条", "含备份和任务状态")}${metric("外部投递失败", "2", "条", "企微或邮件")}${metric("已投递", "126", "条", "本月成功率 98.4%")}</div>
  ${panel("消息列表", "业务消息与系统消息统一展示，但按来源和动作区分。", `${toolbar(`<div class="field search">${icon("search")}<input placeholder="搜索标题、业务编号" /></div><div class="field">${icon("filter")} 全部类型 ${icon("chevron")}</div><div class="field">${icon("bell")} 未读优先 ${icon("chevron")}</div>`, `<button type="button" class="button small" data-modal="message-preferences">通知偏好</button>`)}${table(["消息", "类型", "时间", "状态", "操作"], messageRows())}</div>`, "", true)}`;
}

function renderOrganization() {
  return `${pageHead("组织与账号", "统一维护内部组织、渠道组织、岗位、人员任职、数据范围和外部身份。", `<button type="button" class="button" data-nav="account-management">${icon("users")} 账号生命周期</button><button type="button" class="button" data-nav="organization-admin">${icon("layers")} 组织双域管理</button><button type="button" class="button primary" data-modal="user-editor">${icon("plus")} 新建人员账号</button>`)}
  <div class="split-layout"><div class="list-panel">${panel("组织架构", "内部组织与渠道组织分域展示", `<div class="list-stack"><article class="record-card selected"><div class="record-top"><strong>联软科技</strong>${status("内部组织", "blue")}</div><p>总部 · 8 个大区 · 42 个区域</p></article><article class="record-card"><div class="record-top"><strong>华南大区</strong>${status("12 人", "gray")}</div><p>区域管理、安全服务、渠道运营</p></article><article class="record-card"><div class="record-top"><strong>渠道组织架构</strong>${status("192 家", "green")}</div><p>按大区、区域和渠道商组织</p></article></div>`)}</div><main class="detail-panel">${panel(
    "华南大区",
    "内部组织 · 负责人：刘管理员 · 下属 4 个区域",
    `<div class="grid-3"><div class="callout"><strong>12</strong><br />在职人员</div><div class="callout"><strong>36</strong><br />渠道商</div><div class="callout"><strong>6</strong><br />待处理权限差异</div></div><div style="margin-top:12px">${table(
      ["人员", "岗位", "业务角色", "账号状态", "数据范围", "操作"],
      [
        [
          "张明",
          "渠道运营",
          "销售",
          "启用",
          "华南大区",
          actionButtons([
            ["编辑", "user-editor"],
            ["查看", "user-detail"],
          ]),
        ],
        [
          "周宁",
          "区域管理",
          "管理",
          "启用",
          "广东省",
          actionButtons([
            ["编辑", "user-editor"],
            ["查看", "user-detail"],
          ]),
        ],
        [
          "王卓",
          "技术服务",
          "技术",
          "启用",
          "华南大区",
          actionButtons([
            ["编辑", "user-editor"],
            ["查看", "user-detail"],
          ]),
        ],
      ]
        .map(
          (row) =>
            `<tr><td><span class="record-title">${row[0]}</span></td><td>${row[1]}</td><td>${row[2]}</td><td>${status(row[3], "green")}</td><td>${row[4]}</td><td>${row[5]}</td></tr>`,
        )
        .join(""),
    )}</div>`,
  )}</main><aside class="decision-panel">${panel("组织健康度", "当前快照", `<div class="progress-list">${progress("账号归集率", 94)}${progress("外部身份完整率", 87)}${progress("证书有效率", 92)}${progress("数据范围配置率", 98)}</div>`)}${panel(
    "外部身份",
    "IAM / UniSDP / 泛微 / 企微",
    infoGrid([
      ["IAM", "71 / 75"],
      ["UniSDP", "64 / 75"],
      ["泛微 OA", "58 / 75"],
      ["企微", "69 / 75"],
    ]),
  )}${panel("风险提醒", "需要人工确认", `<div class="callout warning">4 个账号存在外部身份冲突，6 个账号尚未归集到组织架构。</div>`)}</aside></div>`;
}

function renderRoles() {
  const permissions = [
    "客户查看",
    "客户编辑",
    "客户报备审核",
    "商机查看",
    "商机编辑",
    "报价创建",
    "报价审核",
    "订单审批",
    "渠道管理",
    "组织权限",
    "审计查看",
  ];
  const roleCards = [
    ["超级管理员", "全部权限", "内置"],
    ["区域管理员", "本区域业务权限", "8 人"],
    ["普通管理员", "指定业务权限", "12 人"],
    ["渠道企业管理员", "本企业数据范围", "192 人"],
    ["渠道员工", "本人业务数据", "1,284 人"],
  ]
    .map(
      ([name, desc, tag], index) =>
        `<article class="record-card ${index === 1 ? "selected" : ""}"><div class="record-top"><strong>${name}</strong>${status(tag, "gray")}</div><p>${desc}</p></article>`,
    )
    .join("");
  const permissionChips = permissions
    .map(
      (permission, index) =>
        `<span class="chip ${index < 9 ? "active" : ""}">${index < 9 ? "✓" : "+"} ${permission}</span>`,
    )
    .join("");
  const permissionRows = [
    ["客户", "✓", "✓", "✓", "✓", "✓"],
    ["商机", "✓", "✓", "✓", "—", "✓"],
    ["报价", "✓", "✓", "✓", "—", "✓"],
    ["订单", "✓", "—", "—", "✓", "✓"],
    ["渠道", "✓", "—", "✓", "—", "✓"],
    ["审计", "✓", "—", "—", "—", "—"],
  ]
    .map(
      (row) =>
        `<tr><td><span class="record-title">${row[0]}</span></td>${row
          .slice(1)
          .map((value) => `<td>${value}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `${pageHead("角色与权限", "系统角色、业务权限、用户权限和数据范围分离管理。", `<button type="button" class="button" data-modal="permission-audit">${icon("shield")} 权限差异检查</button><button type="button" class="button primary" data-modal="role-editor">${icon("plus")} 新建角色</button>`)}
  <div class="split-layout"><div class="list-panel">${panel("系统角色", "权限角色决定接口权限，不替代业务角色", `<div class="list-stack">${roleCards}</div>`)}</div><main class="detail-panel">${panel("区域管理员", "角色权限与数据范围", `<div class="chip-row" style="margin-bottom:12px">${permissionChips}</div>${table(["资源", "查看", "新增", "编辑", "审核", "导出"], permissionRows)}`)}</main><aside class="decision-panel">${panel("数据范围", "角色级绑定", `<div class="callout"><strong>内部范围</strong><br />华南大区及所有子区域</div><div class="callout" style="margin-top:8px"><strong>渠道范围</strong><br />华南区域全部一级、二级渠道</div>`)}${panel("用户级覆盖", "默认关闭", `<div class="callout warning">用户级覆盖仅用于例外场景，必须单独审计和定期复核。</div>`)}</aside></div>`;
}

function renderOpenApi() {
  const clientRows = [
    [
      "AI Agent 查询客户端",
      "liulonghai",
      "客户、商机、订单",
      "10.20.3.0/24",
      status("启用", "green"),
      "2 分钟前",
      actionButtons([
        ["查看", "api-client"],
        ["重签密钥", "reset-secret"],
      ]),
    ],
    [
      "经营分析客户端",
      "admin",
      "订单、渠道、统计",
      "10.20.4.0/24",
      status("启用", "green"),
      "28 分钟前",
      actionButtons([
        ["查看", "api-client"],
        ["重签密钥", "reset-secret"],
      ]),
    ],
    [
      "测试联调客户端",
      "wangning",
      "产品目录",
      "127.0.0.1",
      status("停用", "gray"),
      "昨天",
      actionButtons([
        ["查看", "api-client"],
        ["启用", "confirm-action"],
      ]),
    ],
  ]
    .map(
      (row) =>
        `<tr><td><span class="record-title">${row[0]}</span></td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td>${row[5]}</td><td>${row[6]}</td></tr>`,
    )
    .join("");
  const logRows = [
    [
      "09:32:18",
      "AI Agent",
      "GET /api/open/v1/orders",
      status("成功", "green"),
      "182 ms",
      "10.20.3.18",
    ],
    [
      "09:21:06",
      "经营分析",
      "GET /api/open/v1/channels",
      status("成功", "green"),
      "246 ms",
      "10.20.4.21",
    ],
    [
      "08:58:40",
      "AI Agent",
      "GET /api/open/v1/customers",
      status("403", "red"),
      "94 ms",
      "10.20.3.22",
    ],
  ]
    .map(
      (row) =>
        `<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td>${row[5]}</td></tr>`,
    )
    .join("");
  return `${pageHead("OpenAPI 对接", "维护客户端、资源授权、密钥、来源白名单和调用日志。", `<button type="button" class="button">${icon("refresh")} 刷新</button><button type="button" class="button primary" data-modal="api-client">${icon("plus")} 新建客户端</button>`)}
  <div class="war-kpis">${metric("客户端总数", "4", "个", "2 个近期调用", true)}${metric("启用中", "3", "个", "1 个已停用")}${metric("今日调用", "1,286", "次", "成功率 99.6%")}${metric("平均响应", "186", "ms", "P95 420 ms")}${metric("异常请求", "12", "次", "401 / 403")}${metric("密钥剩余", "2", "个", "90 天内到期")}</div>
  ${panel("客户端列表", "密钥只允许在创建或重置时展示一次。", table(["客户端", "绑定用户", "授权资源", "来源白名单", "状态", "最近调用", "操作"], clientRows), "", true)}
  ${panel("调用日志", "定位 401、403、404 和数据范围问题。", table(["时间", "客户端", "资源", "结果", "耗时", "来源 IP"], logRows))}`;
}

function renderAuditSystem() {
  const auditRows = [
    [
      "09:42:16",
      "刘管理员",
      "审核客户报备",
      "华南某智能制造集团",
      status("成功", "green"),
      "10.20.1.18",
    ],
    ["09:35:02", "张明", "新建商机", "OP202609150031", status("成功", "green"), "10.20.3.22"],
    [
      "09:12:45",
      "陈佳",
      "尝试访问跨区域订单",
      "SO202609120009",
      status("拒绝", "red"),
      "10.20.3.36",
    ],
    ["08:58:20", "系统", "报价收益冻结", "QT202609160028", status("成功", "green"), "worker"],
  ]
    .map(
      (row) =>
        `<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td>${row[5]}</td></tr>`,
    )
    .join("");
  return `${pageHead("审计与系统", "查看关键操作、迁移状态、备份记录、服务健康和安全门禁。", `<button type="button" class="button" data-nav="audit-operations">${icon("database")} 审计与运维</button><button type="button" class="button" data-nav="import-export">${icon("upload")} 导入导出任务</button><button type="button" class="button primary" data-modal="backup-now">${icon("database")} 立即备份</button>`)}
  <div class="war-kpis">${metric("服务状态", "正常", "", "2 个 API 实例", true)}${metric("数据库", "16.4", "", "连接正常")}${metric("Redis", "正常", "", "状态与缓存实例")}${metric("最近备份", "今天", "03:00", "本机备份成功")}${metric("待处理告警", "2", "项", "1 项需关注")}${metric("迁移版本", "S10_024", "", "最新已记录")}</div>
  <div class="grid-2">${panel("操作审计", "关键操作、账号、数据范围和结果。", table(["时间", "操作人", "动作", "对象", "结果", "来源 IP"], auditRows))}${panel("服务健康", "存活、就绪和依赖检查。", `<div class="list-stack"><article class="record-card"><div class="record-top"><strong>API 实例</strong>${status("正常", "green")}</div><p>api-1、api-2 均通过 /health/live 和 /health/ready。</p></article><article class="record-card"><div class="record-top"><strong>后台任务</strong>${status("正常", "green")}</div><p>健康任务、消息、订单预审和收益任务进程运行正常。</p></article><article class="record-card"><div class="record-top"><strong>备份恢复</strong>${status("需演练", "amber")}</div><p>最近一次离线恢复演练记录已超过 30 天。</p></article></div>`)}</div>`;
}

function renderPartnerDashboard() {
  return `${pageHead("渠道工作台", "渠道企业管理员和员工只查看本渠道、本人权限范围内的客户与业务。", `<button type="button" class="button" data-nav="customer-new">${icon("plus")} 新建客户报备</button>`)}
  <div class="war-kpis">${metric("我的客户", "86", "家", "本月新增 8 家", true)}${metric("进行中商机", "24", "条", "预计金额 680 万")}${metric("报价单", "32", "份", "待确认 6 份")}${metric("订单", "18", "笔", "履约中 6 笔")}${metric("待跟进", "12", "项", "逾期 2 项")}${metric("渠道成员", "24", "人", "活跃 21 人")}</div>
  <div class="grid-2">${panel(
    "近期商机",
    "按最近跟进时间排序。",
    table(
      ["商机 / 客户", "阶段", "金额", "负责人"],
      opportunityRows
        .slice(0, 4)
        .map(
          (row) =>
            `<tr data-modal="opportunity-detail"><td><span class="record-title">${row[0]}</span><span class="record-meta">${row[1]}</span></td><td>${status(row[2], row[7])}</td><td class="amount">${row[3]}</td><td>${row[5]}</td></tr>`,
        )
        .join(""),
    ),
  )}${panel("渠道经营概况", "本渠道数据范围", `<div class="progress-list">${progress("本月报备目标", 82)}${progress("商机转化", 68)}${progress("报价确认", 76)}${progress("订单履约", 91)}</div><div class="callout" style="margin-top:12px">当前账号数据范围：深圳示例数字科技有限公司及其下属二级渠道。</div>`)}</div>`;
}

function phoneFrame(title, content, navItems) {
  return `<div class="phone"><div class="phone-top"><span>9:41</span><strong>${title}</strong><span>•••</span></div><div class="phone-content">${content}</div><nav class="phone-nav">${navItems.map((item, index) => `<span class="${index === 0 ? "active" : ""}">${item}</span>`).join("")}</nav></div>`;
}

function renderMobile() {
  const mobileAdmin = `<div class="mobile-kpi"><div><span>待审核</span><strong>18</strong></div><div><span>超时</span><strong>5</strong></div></div><article class="mobile-card"><strong>客户报备待审核</strong><p>华南某智能制造集团 · 10 分钟前</p></article><article class="mobile-card"><strong>订单待确认</strong><p>SO202609150018 · 超时 2 小时</p></article><article class="mobile-card"><strong>渠道资质提醒</strong><p>9 家渠道证书或协议即将到期</p></article>`;
  const mobileFollowup = `<article class="mobile-card"><strong>华南某智能制造集团</strong><p>需求确认 · 下次联系 10:30</p></article><article class="mobile-card"><strong>本次跟进目标</strong><p>确认技术方案和采购流程评审时间。</p></article><div class="callout">最近记录：客户确认一期预算约 42.8 万，周五前提交方案。</div>`;
  const mobileBusiness = `<div class="mobile-kpi"><div><span>商机</span><strong>24</strong></div><div><span>报价</span><strong>32</strong></div></div><article class="mobile-card"><strong>终端安全改造项目</strong><p>方案确认 · ¥ 42.8 万</p></article><article class="mobile-card"><strong>办公电脑防护试点</strong><p>客户建联 · ¥ 18.8 万</p></article><article class="mobile-card"><strong>QT202609160028</strong><p>待客户确认 · 有效期至 10-16</p></article>`;
  const mobileForm = `<article class="mobile-card"><strong>新建客户报备</strong><p>第 1 / 4 步 · 客户信息</p></article><div class="mobile-card"><strong>客户名称</strong><p>华南某智能制造集团股份有限公司</p></div><div class="mobile-card"><strong>统一社会信用代码</strong><p>91440300MA5F8X2D7Q</p></div><div class="mobile-card"><strong>联系人 / 电话</strong><p>张明 · 138****6621</p></div><button class="button primary full" type="button">下一步：项目信息</button>`;
  return `${pageHead("移动端原型", "移动端围绕查询、审批、跟进和关键录入重新组织，不压缩桌面表格。", `<button type="button" class="button" data-nav="mobile-full">${icon("smartphone")} 移动端全量页面</button><button type="button" class="button primary" data-modal="mobile-guide">${icon("file")} 移动适配说明</button>`)}<div class="phone-row">${phoneFrame("管理员首页", mobileAdmin, ["首页", "审核", "消息", "我的"])}${phoneFrame("客户跟进", mobileFollowup, ["跟进", "客户", "商机", "我的"])}${phoneFrame("渠道业务", mobileBusiness, ["工作台", "商机", "报价", "我的"])}${phoneFrame("新建报备", mobileForm, ["返回", "保存", "下一步", "更多"])}</div><div class="mobile-preview-note" style="margin-top:16px">移动端安全规则：沿用同一登录态、身份权限和数据范围；审批、状态修改和订单确认必须走服务端二次校验。</div>`;
}

function renderMobileFull() {
  const adminHome = `<div class="mobile-kpi"><div><span>待审核</span><strong>18</strong></div><div><span>超时</span><strong>5</strong></div></div><article class="mobile-card"><strong>客户报备待审核</strong><p>华南某智能制造集团 · 10 分钟前</p></article><article class="mobile-card"><strong>订单待确认</strong><p>SO202609150018 · 超时 2 小时</p></article><article class="mobile-card"><strong>渠道资质提醒</strong><p>9 家渠道证书或协议即将到期</p></article>`;
  const customerDetail = `<article class="mobile-card"><strong>华南某智能制造集团</strong><p>保护期内 · 华南区域 · 张明</p></article><article class="mobile-card"><strong>客户健康度 86</strong><p>2 个商机 · ¥ 61.6 万 · 88 天保护期</p></article><button class="button primary full" type="button">记录跟进</button>`;
  const workflow = `<article class="mobile-card"><strong>终端安全改造项目</strong><p>方案确认 · 赢单概率 65%</p></article><article class="mobile-card"><strong>当前阶段</strong><p>需求确认 → 方案 / POC → 商务谈判</p></article><div class="callout success">阶段变化与跟进记录一次提交。</div>`;
  const quote = `<article class="mobile-card"><strong>QT202609160028</strong><p>待客户确认 · ¥ 42.86 万</p></article><article class="mobile-card"><strong>报价有效期</strong><p>2026-10-16 · 折扣 97%</p></article><button class="button primary full" type="button">发送报价</button>`;
  const orderApproval = `<article class="mobile-card"><strong>SO202609150018</strong><p>待一级确认 · SLA 剩余 18 小时</p></article><article class="mobile-card"><strong>合同金额</strong><p>¥ 328,600.00 · 终端安全 1,200 点</p></article><div class="button-row"><button class="button danger" type="button">驳回</button><button class="button primary" type="button">确认订单</button></div>`;
  const channelMembers = `<article class="mobile-card"><strong>渠道成员 24 人</strong><p>销售 18 · 技术 6 · 停用 1</p></article><article class="mobile-card"><strong>张明</strong><p>销售 · 证书 5 份 · 启用</p></article><button class="button primary full" type="button">添加成员</button>`;
  const messageCenter = `<article class="mobile-card"><strong>客户报备待审核</strong><p>审批待办 · 未读</p></article><article class="mobile-card"><strong>订单即将超时</strong><p>超时提醒 · 未读</p></article><article class="mobile-card"><strong>渠道证书即将到期</strong><p>资质提醒 · 未读</p></article>`;
  const profile = `<article class="mobile-card"><strong>刘管理员</strong><p>区域管理员 · 华南大区</p></article><article class="mobile-card"><strong>数据范围</strong><p>华南大区及全部子区域</p></article><article class="mobile-card"><strong>外部身份</strong><p>IAM 已绑定 · 企微已绑定</p></article>`;
  const phoneData = [
    ["管理员首页", adminHome, ["首页", "审核", "消息", "我的"]],
    ["客户详情", customerDetail, ["返回", "客户", "商机", "更多"]],
    ["商机跟进", workflow, ["商机", "跟进", "报价", "我的"]],
    ["报价详情", quote, ["返回", "报价", "分享", "更多"]],
    ["订单审批", orderApproval, ["返回", "审批", "附件", "更多"]],
    ["渠道成员", channelMembers, ["返回", "成员", "证书", "更多"]],
    ["消息中心", messageCenter, ["消息", "待办", "提醒", "我的"]],
    ["个人中心", profile, ["首页", "待办", "消息", "我的"]],
  ];
  return `${pageHead("移动端全量页面", "移动一期和二期页面按查询、审批、跟进、录入、成员维护和个人中心分组。", `<button type="button" class="button" data-modal="mobile-guide">${icon("file")} 移动适配说明</button>`)}${panel(
    "移动端页面宫格",
    "每个手机画板对应一个正式移动端任务页面；审批、订单确认和状态修改必须二次确认。",
    `<div class="phone-row phone-row-full">${phoneData.map(([title, content, nav]) => phoneFrame(title, content, nav)).join("")}</div>`,
  )}<div class="grid-3" style="margin-top:16px">${panel("一期范围", "桌面功能移动化", `<div class="spec-list"><div class="spec-item"><strong>管理端</strong><span>首页、审核、客户、商机、报价、订单、渠道、消息、个人中心。</span></div><div class="spec-item"><strong>渠道端</strong><span>工作台、客户报备、商机、报价、订单、成员、消息、个人中心。</span></div></div>`)}${panel("高风险动作", "必须二次确认", `<div class="callout warning">审批、驳回、订单确认、调价、退回修订、停用账号和撤销证书均使用独立确认窗口。</div>`)}${panel("共享底座", "与桌面端完全一致", `<div class="callout success">统一登录态、权限、数据范围、状态机、接口契约、审计和消息任务。</div>`)}</div>`;
}

function capabilityLaunchPanel(ids) {
  const cards = ids
    .map((id) => extendedCapabilityMap[id])
    .filter(Boolean)
    .map(
      (capability) =>
        `<button type="button" class="capability-card" data-nav="${capability.id}"><span>${capability.group}</span><strong>${capability.title}</strong><p>${capability.desc}</p></button>`,
    )
    .join("");
  return `<div class="capability-grid">${cards}</div>`;
}

function renderAdminSettings() {
  const groups = [
    {
      id: "identity",
      title: "身份与安全",
      desc: "登录、组织、账号、角色和数据范围",
      icon: "shield",
      items: [
        ["auth-login", "登录界面", "账号密码、IAM 和 UniSDP 单点登录", "入口", "modal"],
        ["auth-flows", "认证与异常状态", "登录、改密、会话失效、403 和维护", "正常", "nav"],
        ["organization", "组织与账号", "内部组织、渠道组织、岗位和外部身份", "已启用", "nav"],
        ["roles", "角色与权限", "系统角色、业务权限和数据范围", "已启用", "nav"],
        ["account-management", "账号生命周期", "归档、恢复、归并和离职交接", "3 项待处理", "nav"],
      ],
    },
    {
      id: "message",
      title: "消息与提醒",
      desc: "消息查询、渠道配置和提醒任务",
      icon: "bell",
      items: [
        ["messages", "消息中心", "审批待办、业务提醒和系统消息", "5 条未读", "nav"],
        ["message-platform", "消息渠道配置", "企微、短信、SMTP 和投递状态", "1 项待测试", "nav"],
        ["message-rules", "提醒规则与模板", "业务事件、到期提醒和任务模板", "规则正常", "nav"],
      ],
    },
    {
      id: "product",
      title: "产品与价格",
      desc: "产品目录、人天工作量、价格和成本",
      icon: "box",
      items: [
        ["products", "产品目录", "软件功能、硬件、套餐和公开价格", "146 项已发布", "nav"],
        ["product-admin", "产品维护", "大类、模块、功能、硬件和套餐", "3 项待完善", "nav"],
        [
          "workload-config",
          "人天与工作量配置",
          "产品映射、交付工作量和特殊比例",
          "49 条规则",
          "nav",
        ],
        ["pricing-rules", "模块价格规则", "阶梯价、渠道比例和区域覆盖", "86 条规则", "nav"],
      ],
    },
    {
      id: "channel",
      title: "渠道与资质",
      desc: "渠道档案、经营报表、画像和证书",
      icon: "building",
      items: [
        ["channels", "渠道商管理", "渠道档案、成员、证书和合作状态", "192 家", "nav"],
        ["partner-report", "经营报表", "渠道业绩、区域和技术服务商分析", "8 个区域", "nav"],
        [
          "channel-profile",
          "渠道画像与层级",
          "产品能力、技术服务商和分销关系",
          "完整率 96%",
          "nav",
        ],
        [
          "certificate-management",
          "证书管理",
          "证书模板、持证记录、延期和撤销",
          "24 份将到期",
          "nav",
        ],
      ],
    },
    {
      id: "integration",
      title: "集成与运维",
      desc: "开放接口、导入导出、审计和系统健康",
      icon: "database",
      items: [
        ["openapi", "OpenAPI 对接", "客户端、密钥、资源授权和调用日志", "3 个启用", "nav"],
        ["import-export", "导入导出任务", "模板、上传、预检和结果下载", "3 条待下载", "nav"],
        ["audit-system", "审计与系统", "审计日志、迁移状态和备份", "服务正常", "nav"],
        ["audit-operations", "审计与运维", "任务重试、恢复演练和诊断报告", "4 条待补偿", "nav"],
      ],
    },
    {
      id: "business",
      title: "业务协同",
      desc: "商机报价上下文、审批和移动端",
      icon: "layers",
      items: [
        [
          "opportunities",
          "商机与报价上下文",
          "从商机进入报价、订单和完整业务链",
          "75 条商机",
          "nav",
        ],
        ["approvals", "审核中心", "客户报备、渠道、员工、报价和订单", "23 项待处理", "nav"],
        ["quote-actions", "报价动作与收益", "发送、确认、撤回、收益和转订单", "1 份待冻结", "nav"],
        ["mobile-full", "移动端全量页面", "移动一期和二期全部高频任务", "8 组页面", "nav"],
      ],
    },
  ];
  const active = state.tab.adminSettingsGroup || groups[0].id;
  const current = groups.find((group) => group.id === active) || groups[0];
  const selectedId = current.items.some(([id]) => id === state.tab.adminSettingsItem)
    ? state.tab.adminSettingsItem
    : current.items[0][0];
  const selected = current.items.find(([id]) => id === selectedId) || current.items[0];
  const mode = state.tab.adminSettingsMode === "edit" ? "edit" : "view";
  const groupMeta = {
    identity: {
      owner: "平台管理员",
      scope: "总部及全部区域",
      dependencies: ["组织架构", "角色与权限", "外部身份映射"],
      pending: ["4 个外部身份冲突待确认", "3 个账号待完成离职交接"],
      changes: ["角色权限范围调整", "账号归档任务完成"],
    },
    message: {
      owner: "消息运营",
      scope: "全平台业务消息与提醒",
      dependencies: ["企微应用", "短信供应商", "SMTP", "业务事件"],
      pending: ["1 个消息渠道待完成测试", "2 条失败消息待重试"],
      changes: ["企微应用配置更新", "证书到期提醒规则调整"],
    },
    product: {
      owner: "产品运营",
      scope: "全部销售区域和渠道层级",
      dependencies: ["产品目录", "价格规则", "人天规则", "收益核算"],
      pending: ["3 项产品配置不完整", "1 款硬件成本待补充"],
      changes: ["终端安全管理阶梯价更新", "500+ 点人天规则新增"],
    },
    channel: {
      owner: "渠道运营",
      scope: "全部一级、二级渠道商",
      dependencies: ["渠道成员", "证书模板", "合作协议", "经营报表"],
      pending: ["9 家渠道资质待补齐", "5 家渠道待续签"],
      changes: ["渠道画像能力更新", "2 名成员证书完成延期"],
    },
    integration: {
      owner: "系统管理员",
      scope: "系统级配置和后台任务",
      dependencies: ["OpenAPI", "Worker", "PostgreSQL", "Redis"],
      pending: ["4 条后台任务待补偿", "恢复演练已超过 30 天"],
      changes: ["诊断报告生成", "本机全量备份完成"],
    },
    business: {
      owner: "业务管理员",
      scope: "有权访问的客户、商机、报价和订单",
      dependencies: ["客户报备", "商机作战", "报价", "订单审批"],
      pending: ["23 项审批任务待处理", "1 份报价收益待冻结"],
      changes: ["订单回退修订门槛调整", "移动端页面范围更新"],
    },
  }[current.id];
  const nav = groups
    .map(
      (group, index) =>
        `<button type="button" class="settings-nav-item ${group.id === active ? "active" : ""}" data-tab="adminSettingsGroup" data-value="${group.id}">${icon(group.icon)}<span><strong>${group.title}</strong><small>${group.desc}</small></span><b>${String(index + 1).padStart(2, "0")}</b></button>`,
    )
    .join("");
  const rows = current.items
    .map(
      ([target, title, desc, statusText, mode]) =>
        `<article class="settings-row ${target === selectedId ? "active" : ""}"><button type="button" class="settings-row-main" data-tab="adminSettingsItem" data-value="${target}"><span class="settings-row-icon">${icon(current.icon)}</span><span class="settings-row-copy"><strong>${title}</strong><small>${desc}</small></span><span class="settings-row-state">${statusText}</span></button><button type="button" class="settings-row-edit" data-tab="adminSettingsItem" data-value="${target}" data-open-mode="edit">编辑</button><button type="button" class="settings-row-open" ${mode === "modal" ? `data-modal="${target}"` : `data-nav="${target}"`} title="打开页面">${icon("eye")}</button></article>`,
    )
    .join("");
  const detail =
    mode === "edit"
      ? `<div class="settings-editor-body"><div class="form-grid"><div class="form-field"><label class="form-label">配置状态</label><div class="form-control">启用 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">生效范围</label><div class="form-control">${groupMeta.scope} ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">负责人</label><div class="form-control">${groupMeta.owner} ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">生效时间</label><div class="form-control">保存后立即生效 ${icon("calendar")}</div></div><div class="form-field full"><label class="form-label">配置说明</label><div class="form-control textarea">${selected[2]}</div></div><div class="form-field full"><label class="form-label">依赖检查</label><div class="callout success">已检查 ${groupMeta.dependencies.join("、")}，当前没有阻断项。</div></div></div></div>`
      : `<div class="settings-detail-grid"><div><span>配置状态</span><strong>${selected[3]}</strong></div><div><span>配置负责人</span><strong>${groupMeta.owner}</strong></div><div><span>生效范围</span><strong>${groupMeta.scope}</strong></div><div><span>最近更新</span><strong>今天 10:20</strong></div></div>`;
  const editorFooter =
    mode === "edit"
      ? `<div class="settings-editor-actions"><button type="button" class="button" data-tab="adminSettingsMode" data-value="view">取消编辑</button><button type="button" class="button primary" data-toast="${selected[1]}配置已保存，服务端将按权限和依赖重新校验。">保存配置</button></div>`
      : `<div class="settings-editor-actions"><button type="button" class="button" ${selected[4] === "modal" ? `data-modal="${selected[0]}"` : `data-nav="${selected[0]}"`}>${icon("eye")} 打开页面</button><button type="button" class="button primary" data-tab="adminSettingsMode" data-value="edit">${icon("edit")} 编辑配置</button></div>`;
  const side =
    mode === "edit"
      ? `<section class="settings-side-block"><header><strong>变更预览</strong><span>保存前检查</span></header><div class="settings-diff"><div><span>配置状态</span><b>启用</b></div><div><span>生效范围</span><b>${groupMeta.scope}</b></div><div><span>负责人</span><b>${groupMeta.owner}</b></div></div></section><section class="settings-side-block"><header><strong>影响范围</strong><span>关联对象</span></header><div class="settings-chip-list">${groupMeta.dependencies.map((item) => `<span>${item}</span>`).join("")}</div></section><section class="settings-side-block"><header><strong>校验结果</strong><span>服务端预检</span></header><div class="check-list"><div class="check-item"><span class="check-icon">✓</span><div><strong>权限范围有效</strong><span>当前账号可维护该配置</span></div></div><div class="check-item"><span class="check-icon">✓</span><div><strong>依赖关系正常</strong><span>未发现阻断项</span></div></div></div></section><section class="settings-side-block warning"><header><strong>提交与生效</strong><span>需要确认</span></header><p>保存后写入配置版本，并进入审计日志；涉及业务规则的变更将在服务端重新校验后生效。</p></section>`
      : `<section class="settings-side-block"><header><strong>当前状态</strong><span>实时快照</span></header><div class="settings-side-info"><div><span>配置状态</span><strong>${selected[3]}</strong></div><div><span>配置版本</span><strong>v2026.09</strong></div><div><span>负责人</span><strong>${groupMeta.owner}</strong></div><div><span>最近更新</span><strong>今天 10:20</strong></div></div></section><section class="settings-side-block warning"><header><strong>待处理事项</strong><span>${groupMeta.pending.length} 项</span></header><div class="settings-pending-list">${groupMeta.pending.map((item, index) => `<button type="button" data-toast="已定位待处理事项：${item}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${item}</strong>${icon("chevron")}</button>`).join("")}</div></section><section class="settings-side-block"><header><strong>生效范围与依赖</strong><span>当前配置</span></header><div class="settings-side-info"><div><span>生效范围</span><strong>${groupMeta.scope}</strong></div><div><span>依赖对象</span><strong>${groupMeta.dependencies.join("、")}</strong></div></div></section><section class="settings-side-block"><header><strong>最近变更与审计</strong><span>最近 2 条</span></header><div class="timeline">${groupMeta.changes.map((item, index) => `<div class="timeline-item"><i class="timeline-dot"></i><div><strong>${item}</strong><p>${index === 0 ? "已写入配置版本和审计日志。" : "操作人：刘管理员。"}</p></div><time>${index === 0 ? "今天" : "09-19"}</time></div>`).join("")}</div></section>`;
  return `${pageHead("管理配置中心", "左侧选择业务板块，中间查看和编辑具体配置，右侧展示状态、风险和影响范围。", `<button type="button" class="button" data-nav="extensions">${icon("grid")} 查看全量能力</button><button type="button" class="button primary" data-modal="auth-login">${icon("shield")} 打开登录界面</button>`)}
  <div class="settings-page">
    <div class="settings-summary">
      <div><span>配置域</span><strong>6</strong><small>类</small></div>
      <div><span>可配置页面</span><strong>24</strong><small>个</small></div>
      <div><span>待处理事项</span><strong>9</strong><small>项</small></div>
      <div><span>系统状态</span><strong>正常</strong><small>全部服务</small></div>
    </div>
    <div class="settings-layout">
      <aside class="settings-nav">${nav}<div class="settings-nav-footer"><span>当前账号</span><strong>刘管理员</strong><small>超级管理员 · 全部组织与渠道</small></div></aside>
      <main class="settings-main">
        <header class="settings-main-head"><div><h2>${current.title}</h2><p>${current.desc}</p></div>${status("当前分组", "blue")}</header>
        <div class="settings-list">${rows}</div>
        <section class="settings-editor"><header><div><h3>${selected[1]}</h3><p>${selected[2]}</p></div><div class="settings-editor-switch"><button type="button" class="${mode === "view" ? "active" : ""}" data-tab="adminSettingsMode" data-value="view">查看</button><button type="button" class="${mode === "edit" ? "active" : ""}" data-tab="adminSettingsMode" data-value="edit">编辑</button></div></header>${detail}${editorFooter}</section>
      </main>
      <aside class="settings-side">${side}</aside>
    </div>
  </div>`;
}

function renderExtensionsHub() {
  const grouped = Object.entries(
    extendedCapabilities.reduce((result, capability) => {
      result[capability.group] = result[capability.group] || [];
      result[capability.group].push(capability.id);
      return result;
    }, {}),
  );
  return `<div class="war-kpis">${metric("主页面", String(screens.length), "个", "完整页面清单", true)}${metric("扩展工作区", String(extendedCapabilities.length), "个", "均支持独立页面")}${metric("关键窗口", "32+", "个", "详情、审批和状态")}${metric("正式页面", "4", "套", "PC / 移动 × 管理 / 渠道")}${metric("移动页面", "8", "组", "一期和二期")}${metric("覆盖门禁", "全量", "", "不遗漏实际路由")}</div><div class="extended-page-body"><div class="grid-2">${grouped.map(([group, ids]) => panel(group, `${ids.length} 个业务工作区`, capabilityLaunchPanel(ids))).join("")}</div><div style="height:16px"></div>${panel(
    "关键窗口与异常状态",
    "所有详情、审批、导入、权限差异和状态变化均可在交互原型中打开。",
    `<div class="compact-actions">${[
      ["客户详情", "customer-detail"],
      ["客户档案编辑", "customer-editor"],
      ["记录跟进", "followup-form"],
      ["渠道成员维护", "member-editor"],
      ["报价详情", "quote-detail"],
      ["报价转订单", "convert-order"],
      ["订单修订", "order-revision"],
      ["回退修订审批", "order-revision-review"],
      ["价格规则", "pricing-editor"],
      ["审批详情", "approval-detail"],
      ["批量导入", "import-center"],
      ["产品选择器", "product-picker"],
      ["权限差异", "permission-audit"],
      ["区域筛选", "region-filter"],
      ["消息中心", "messages-panel"],
      ["状态全集", "state-gallery"],
    ]
      .map(
        ([label, modal]) =>
          `<button type="button" class="order-action-card-button" data-modal="${modal}"><strong>${label}</strong></button>`,
      )
      .join("")}</div>`,
  )}</div>`;
}

function extendedWorkspacePage(config) {
  const records = config.records
    .map(
      ([title, meta, badge, tone], index) =>
        `<article class="war-record ${index === 0 ? "active" : ""}"><div class="war-record-top"><strong>${title}</strong>${status(badge, tone)}</div><p>${meta}</p>${config.recordActions ? `<div class="war-record-actions">${config.recordActions}</div>` : ""}</article>`,
    )
    .join("");
  return `<div class="war-kpis">${config.metrics.map((item) => metric(...item)).join("")}</div><div class="war-layout"><aside class="war-panel war-list"><div class="war-list-head"><div class="war-title-row"><strong>${config.listTitle}</strong><span class="count-badge">${config.listCount}</span></div><div class="war-search">${icon("search")} ${config.searchPlaceholder}</div><div class="war-tabs">${config.tabs.map((tab, index) => `<span class="war-tab ${index === 0 ? "active" : ""}">${tab}</span>`).join("")}</div></div><div class="war-list-body">${records}</div></aside><main class="war-panel war-center"><div class="war-center-head"><div class="deal-title"><strong>${config.centerTitle}</strong><span>${config.centerMeta}</span></div><div class="center-actions">${config.centerActions || ""}</div></div><div class="extended-center-grid">${config.panels.map((p) => panel(p.title, p.desc || "", p.body)).join("")}</div></main><aside class="war-panel war-right"><div class="right-section"><article class="right-card highlight"><div class="right-card-title"><strong>${config.rightTitle}</strong><span>实时快照</span></div><div class="info-grid">${infoGrid(config.rightItems)}</div></article><article class="right-card"><div class="right-card-title"><strong>${config.secondTitle || "处理状态"}</strong><span>当前状态</span></div>${config.secondBody}</article><article class="right-card"><div class="right-card-title"><strong>最近动态</strong><span>${config.timeline.length} 条</span></div><div class="timeline">${config.timeline.map(([title, time, desc]) => `<div class="timeline-item"><i class="timeline-dot"></i><div><strong>${title}</strong><p>${desc}</p></div><time>${time}</time></div>`).join("")}</div></article></div></aside></div>`;
}

function renderAuthFlows() {
  const cards = [
    ["管理员登录", "账号、密码和统一入口", "auth-login"],
    ["渠道伙伴登录", "渠道账号自动识别入口", "auth-login"],
    ["IAM / UniSDP", "单点登录跳转和失败回退", "auth-sso"],
    ["修改密码", "首次登录和主动改密", "change-password"],
    ["会话失效", "登录态过期后的重新认证", "session-expired"],
    ["无权限 / 维护", "403、维护和未知路由", "forbidden"],
  ];
  return `<div class="war-kpis">${metric("统一入口", "1", "个", "根路径 /", true)}${metric("正式页面", "4", "套", "PC / 移动")}${metric("登录方式", "3", "类", "本地 / IAM / UniSDP")}${metric("会话", "Cookie", "会话", "HttpOnly")}${metric("异常页", "4", "个", "403 / 过期 / 维护 / 404")}${metric("页面会话", "4", "套", "正式业务页面")}</div><div class="extended-page-body">${panel("认证与异常页面", "覆盖登录、单点登录、改密和异常状态", `<div class="auth-card-grid">${cards.map(([title, desc, modal]) => `<button type="button" class="auth-card" data-modal="${modal}"><strong>${title}</strong><span>${desc}</span></button>`).join("")}</div>`)}</div>`;
}

const extendedMeta = {
  "partner-report": {
    metrics: [
      ["渠道总数", "227", "家", "覆盖 8 个区域", true],
      ["核心渠道", "36", "家", "本月新增 6 家"],
      ["累计成交", "¥ 1,860 万", "", "同比增长 12%"],
      ["报价转化", "28", "%", "高于上月 3%"],
      ["技术服务商", "42", "家", "签约 18 家"],
      ["待续签", "5", "家", "30 天内到期"],
    ],
    listTitle: "渠道排名",
    listCount: "227",
    searchPlaceholder: "搜索渠道商、区域或级别",
    tabs: ["全部", "核心渠道", "技术服务商"],
    records: [
      ["深圳示例数字科技有限公司", "核心渠道 · 华南 · 成交 ¥ 328.6 万", "TOP 1", "green"],
      ["北京中安网络技术有限公司", "金牌渠道 · 华北 · 成交 ¥ 516.8 万", "TOP 2", "blue"],
      ["上海启辰信息技术有限公司", "核心渠道 · 华东 · 成交 ¥ 189.0 万", "TOP 3", "green"],
      ["成都智联安全服务有限公司", "认证渠道 · 西南 · 成交 ¥ 138.5 万", "技术服务商", "purple"],
      ["厦门产品交付中心", "二级渠道 · 福建 · 成交 ¥ 86.0 万", "二级渠道", "amber"],
    ],
    centerTitle: "合作伙伴经营报表",
    centerMeta: "渠道业绩、级别、区域、技术服务商和人均业绩",
    panels: [
      {
        title: "业绩排名 TOP5",
        body: table(
          ["排名", "渠道商", "区域", "成交金额", "转化率"],
          [
            ["1", "北京中安网络技术", "华北", "¥ 516.8 万", "31%"],
            ["2", "深圳示例数字科技", "华南", "¥ 328.6 万", "26%"],
            ["3", "上海启辰信息技术", "华东", "¥ 189.0 万", "24%"],
          ]
            .map(
              (r) =>
                `<tr><td>${r[0]}</td><td><span class="record-title">${r[1]}</span></td><td>${r[2]}</td><td class="amount">${r[3]}</td><td>${r[4]}</td></tr>`,
            )
            .join(""),
        ),
      },
      {
        title: "渠道结构",
        body: `<div class="progress-list">${progress("核心渠道占比", 42)}${progress("技术服务商覆盖", 68)}${progress("区域完整度", 92)}</div>`,
      },
    ],
    rightTitle: "经营快照",
    rightItems: [
      ["渠道总数", "227 家"],
      ["活跃成员", "1,284 人"],
      ["平均转化率", "24%"],
      ["待续签", "5 家"],
    ],
    secondTitle: "技术服务商",
    secondBody: `<div class="progress-list">${progress("签约技术服务商", 42)}${progress("提名技术服务商", 58)}</div>`,
    timeline: [
      ["新增渠道商", "今天 09:10", "本月新增 6 家。"],
      ["核心渠道变更", "昨天 16:20", "2 家渠道等级调整。"],
      ["技术服务商复核", "09-18", "3 家待补齐资质。"],
    ],
  },
  "channel-profile": {
    metrics: [
      ["渠道画像", "227", "家", "档案完整率 92%", true],
      ["业务能力", "86", "项", "销售 / 技术"],
      ["技术服务商", "42", "家", "签约 18 家"],
      ["协议编号", "227", "个", "全局唯一"],
      ["地市区号", "218", "个", "9 个待补齐"],
      ["层级关系", "46", "组", "一级 / 二级"],
    ],
    listTitle: "渠道商",
    listCount: "227",
    searchPlaceholder: "搜索渠道商名称或编号",
    tabs: ["全部", "技术服务商", "层级异常"],
    records: [
      ["深圳示例数字科技有限公司", "核心渠道 · 华南区域", "合作中", "green"],
      ["北京中安网络技术有限公司", "金牌渠道 · 签约技术服务商", "合作中", "purple"],
      ["成都智联安全服务有限公司", "认证渠道 · 提名技术服务商", "待审批", "blue"],
      ["厦门产品交付中心", "二级渠道 · 深圳示例下级", "待续签", "amber"],
    ],
    centerTitle: "深圳示例数字科技有限公司",
    centerMeta: "渠道画像、产品能力、技术服务类型和一级/二级关系",
    panels: [
      {
        title: "渠道简介",
        body: `<div class="note-box">华南区域核心渠道，具备终端安全、数据安全和技术交付能力。协议编号 CH-2026-000128，地市区号 0755。</div>`,
      },
      {
        title: "产品能力",
        body: `<div class="chip-row"><span class="chip active">终端安全</span><span class="chip active">数据防泄漏</span><span class="chip active">安全网关</span><span class="chip">XCAD</span></div>`,
      },
      {
        title: "技术服务商类型",
        body: infoGrid([
          ["当前类型", "签约技术服务商"],
          ["生效时间", "2024-03-18"],
          ["技术成员", "6 人"],
          ["服务覆盖", "华南区域"],
        ]),
      },
      {
        title: "分销层级",
        body: infoGrid([
          ["上级渠道", "无"],
          ["下级渠道", "2 家"],
          ["层级状态", "正常"],
          ["关系变更", "留有效期历史"],
        ]),
      },
    ],
    rightTitle: "渠道状态",
    rightItems: [
      ["合作状态", "合作中"],
      ["协议编号", "CH-2026-000128"],
      ["地市区号", "0755"],
      ["画像完整度", "96%"],
    ],
    secondTitle: "渠道健康度",
    secondBody: `<div class="progress-list">${progress("经营贡献", 88)}${progress("技术能力", 92)}${progress("交付能力", 86)}</div>`,
    timeline: [
      ["渠道简介更新", "今天 10:20", "补充南方交付能力。"],
      ["产品能力调整", "09-18", "新增安全网关。"],
      ["下级渠道变更", "09-16", "新增厦门交付中心。"],
    ],
  },
  "certificate-management": {
    metrics: [
      ["证书模板", "8", "类", "销售 / 技术 / 交付", true],
      ["持证记录", "326", "条", "有效 284 条"],
      ["本月颁发", "18", "份", "待处理 2 份"],
      ["即将到期", "24", "份", "30 天内"],
      ["已过期", "42", "份", "仅告警"],
      ["已撤销", "6", "份", "保留历史"],
    ],
    listTitle: "证书名称",
    listCount: "8",
    searchPlaceholder: "搜索证书名称或类别",
    tabs: ["模板", "持证记录", "到期风险"],
    records: [
      ["渠道销售能力认证", "销售类 · 有效 126 人", "启用", "blue"],
      ["终端安全产品认证", "技术类 · 有效 88 人", "启用", "green"],
      ["安全交付认证", "交付类 · 24 人即将到期", "即将到期", "amber"],
      ["数据安全能力认证", "技术类 · 有效期 2 年", "启用", "green"],
    ],
    centerTitle: "证书管理",
    centerMeta: "证书模板与持证记录分开管理，证书变化不自动修改业务角色和系统权限",
    panels: [
      {
        title: "证书模板",
        body: table(
          ["证书名称", "类别", "有效期", "状态"],
          [
            ["渠道销售能力认证", "销售", "3 年", "启用"],
            ["终端安全产品认证", "技术", "2 年", "启用"],
            ["安全交付认证", "交付", "1 年", "启用"],
          ]
            .map(
              (r) =>
                `<tr><td><span class="record-title">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td><td>${status(r[3], "green")}</td></tr>`,
            )
            .join(""),
        ),
      },
      {
        title: "持证记录",
        body: table(
          ["持有人", "证书", "颁发日", "到期日", "状态"],
          [
            ["张明", "渠道销售能力认证", "2024-03-18", "2027-03-18", status("有效", "green")],
            ["王卓", "安全交付认证", "2025-10-12", "2026-10-12", status("即将到期", "amber")],
            ["陈晓宇", "终端安全产品认证", "2023-04-10", "2025-04-10", status("已过期", "red")],
          ]
            .map(
              (r) =>
                `<tr><td><span class="record-title">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`,
            )
            .join(""),
        ),
      },
      {
        title: "到期统计",
        body: `<div class="progress-list">${progress("有效证书", 87)}${progress("30 天内到期", 24)}${progress("已过期", 13)}</div>`,
      },
      {
        title: "组织筛选",
        body: infoGrid([
          ["归属组织", "华南大区"],
          ["证书类别", "全部"],
          ["证书名称", "全部"],
          ["状态", "有效优先"],
        ]),
      },
    ],
    centerActions: `<button type="button" class="button primary" data-modal="certificate-template">${icon("plus")} 新建证书模板</button>`,
    rightTitle: "证书状态",
    rightItems: [
      ["有效记录", "284 条"],
      ["即将到期", "24 条"],
      ["已过期", "42 条"],
      ["已撤销", "6 条"],
    ],
    secondTitle: "处理动作",
    secondBody: `<div class="button-row"><button type="button" class="button" data-modal="certificate-issue">颁发证书</button><button type="button" class="button" data-modal="certificate-extend">延期证书</button><button type="button" class="button danger" data-modal="certificate-revoke">撤销证书</button></div><div class="callout warning">证书到期只告警，不自动撤销业务角色或系统权限。</div>`,
    timeline: [
      ["王卓证书即将到期", "今天 09:10", "安全交付认证剩余 24 天。"],
      ["新增证书模板", "09-18", "数据安全能力认证已创建。"],
      ["批量延期完成", "09-16", "12 名成员证书延期。"],
    ],
  },
  "message-platform": {
    metrics: [
      ["消息渠道", "4", "类", "站内、企微、短信、邮件", true],
      ["正式启用", "2", "类", "站内、企微"],
      ["测试成功", "3", "类", "短信待测试"],
      ["今日投递", "1,286", "条", "成功率 98.6%"],
      ["失败投递", "12", "条", "待重试 4 条"],
      ["未就绪", "1", "类", "SMTP 配置缺失"],
    ],
    listTitle: "消息渠道",
    listCount: "4",
    searchPlaceholder: "搜索渠道名称或状态",
    tabs: ["正式渠道", "测试渠道", "失败投递"],
    records: [
      ["企业微信群机器人", "Webhook 已配置 · 正式启用", "正常", "green"],
      ["企微自建应用", "应用消息 · 正式启用", "正常", "green"],
      ["短信", "供应商接入 · 尚未启用", "待测试", "amber"],
      ["SMTP 邮箱", "SMTP 配置缺失", "未就绪", "red"],
    ],
    centerTitle: "消息渠道配置",
    centerMeta: "敏感配置只提交不回显，测试通过后才允许启用正式投递",
    panels: [
      {
        title: "运行前置检查",
        body: `<div class="check-list"><div class="check-item"><span class="check-icon">✓</span><div><strong>消息工作进程已开启</strong><span>状态和事件游标正常</span></div></div><div class="check-item"><span class="check-icon">✓</span><div><strong>站内通知可用</strong><span>模板和接收人校验正常</span></div></div><div class="check-item warning"><span class="check-icon">!</span><div><strong>SMTP 尚未配置</strong><span>邮件渠道禁止启用</span></div></div></div>`,
      },
      {
        title: "正式启用状态",
        body: table(
          ["渠道", "状态", "最近测试", "操作"],
          [
            ["企业微信群机器人", status("已启用", "green"), "2026-09-20 09:10", "停用"],
            ["企微自建应用", status("已启用", "green"), "2026-09-20 09:12", "停用"],
            ["短信", status("未启用", "gray"), "从未测试", "测试后启用"],
            ["SMTP", status("未就绪", "red"), "配置缺失", "配置"],
          ]
            .map(
              (r) =>
                `<tr><td><span class="record-title">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td><td><button type="button" class="link">${r[3]}</button></td></tr>`,
            )
            .join(""),
        ),
      },
    ],
    centerActions: `<button type="button" class="button" data-modal="message-channel-test">${icon("message")} 发送测试消息</button><button type="button" class="button primary" data-modal="message-channel-edit">${icon("edit")} 配置渠道</button>`,
    rightTitle: "投递状态",
    rightItems: [
      ["今日投递", "1,286 条"],
      ["成功", "1,268 条"],
      ["失败", "12 条"],
      ["待重试", "4 条"],
    ],
    secondTitle: "最近失败",
    secondBody: `<div class="member-risk-list"><div class="member-risk-row warning"><span><strong>短信投递失败</strong><small>模板未配置</small></span><b>4 条</b></div><div class="member-risk-row warning"><span><strong>邮件未送达</strong><small>SMTP 配置缺失</small></span><b>8 条</b></div></div>`,
    timeline: [
      ["企微测试成功", "今天 09:12", "企微群和应用消息均成功。"],
      ["短信测试失败", "今天 09:08", "供应商模板编号未配置。"],
      ["邮件渠道检查", "09-18", "SMTP 配置缺失。"],
    ],
  },
  "message-rules": {
    metrics: [
      ["业务事件规则", "9", "条", "全部启用", true],
      ["到期提醒规则", "2", "条", "报备、订单"],
      ["消息模板", "18", "个", "4 类通道"],
      ["任务模板", "6", "个", "自定义提醒"],
      ["自建提醒任务", "12", "条", "本周执行"],
      ["投递失败", "4", "条", "待重试"],
    ],
    listTitle: "规则分类",
    listCount: "37",
    searchPlaceholder: "搜索事件、模板或任务",
    tabs: ["业务事件", "到期提醒", "任务模板", "消息模板"],
    records: [
      ["订单待审批", "订单事件 · 4 个接收人角色", "启用", "green"],
      ["客户报备审核结果", "报备事件 · 创建人和负责人", "启用", "green"],
      ["报价待客户确认", "报价事件 · 负责人", "启用", "green"],
      ["报备保护期到期", "定时扫描 · 30 天前提醒", "启用", "blue"],
      ["自定义提醒任务", "基于任务模板创建", "运行中", "purple"],
    ],
    centerTitle: "提醒规则与任务管理",
    centerMeta: "事件、到期计划、模板和任务实例统一管理",
    panels: [
      {
        title: "业务事件规则",
        body: table(
          ["事件", "通道", "接收人", "状态"],
          [
            ["订单待审批", "站内 / 企微", "当前审批人", status("启用", "green")],
            ["客户报备审核", "站内 / 企微", "创建人、负责人", status("启用", "green")],
            ["报价待确认", "站内", "报价负责人", status("启用", "green")],
          ]
            .map(
              (r) =>
                `<tr><td><span class="record-title">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`,
            )
            .join(""),
        ),
      },
      {
        title: "到期提醒规则",
        body: table(
          ["对象", "提前时间", "通道", "状态"],
          [
            ["客户报备保护期", "30 天", "站内 / 邮件", status("启用", "green")],
            ["订单履约到期", "3 天", "站内 / 企微", status("启用", "green")],
          ]
            .map(
              (r) =>
                `<tr><td><span class="record-title">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`,
            )
            .join(""),
        ),
      },
      {
        title: "任务模板",
        body: `<div class="list-stack"><article class="record-card"><div class="record-top"><strong>周度客户回访</strong>${status("模板", "blue")}</div><p>按负责人范围生成，每周一执行。</p></article><article class="record-card"><div class="record-top"><strong>渠道资质复核</strong>${status("模板", "blue")}</div><p>证书到期前 30 天生成待办。</p></article></div>`,
      },
      {
        title: "消息模板",
        body: table(
          ["模板", "通道", "事件", "状态"],
          [
            ["订单待审批", "站内", "order.pending", status("启用", "green")],
            ["报备审核结果", "企微", "registration.review", status("启用", "green")],
            ["证书到期提醒", "邮件", "cert.expiring", status("启用", "green")],
          ]
            .map(
              (r) =>
                `<tr><td><span class="record-title">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`,
            )
            .join(""),
        ),
      },
    ],
    centerActions: `<button type="button" class="button" data-modal="message-template-edit">${icon("edit")} 编辑模板</button><button type="button" class="button primary" data-modal="message-task-create">${icon("plus")} 新建提醒任务</button>`,
    rightTitle: "规则状态",
    rightItems: [
      ["启用事件", "9 条"],
      ["启用提醒", "2 条"],
      ["模板数量", "18 个"],
      ["任务实例", "12 条"],
    ],
    secondTitle: "投递与失败",
    secondBody: `<div class="progress-list">${progress("事件消费成功率", 99)}${progress("外部投递成功率", 97)}${progress("任务执行成功率", 95)}</div>`,
    timeline: [
      ["提醒规则更新", "今天 10:20", "订单待审批新增企微通道。"],
      ["任务模板复制", "09-19", "周度回访模板副本。"],
      ["投递失败重试", "09-18", "4 条短信等待重试。"],
    ],
  },
  "account-management": {
    metrics: [
      ["内部账号", "71", "个", "超管、区管、管理员", true],
      ["企业管理员", "46", "个", "待审批 3 个"],
      ["停用归档", "8", "个", "保留历史"],
      ["外部身份冲突", "4", "个", "待人工核验"],
      ["待归并", "2", "组", "重复账号"],
      ["员工导入", "12", "条", "本月新增"],
    ],
    listTitle: "账号类型",
    listCount: "125",
    searchPlaceholder: "搜索账号、姓名、手机号",
    tabs: ["内部账号", "企业管理员", "归档账号", "待归并"],
    records: [
      ["超级管理员", "admin · 全部权限", "启用", "red"],
      ["华南大区管理员", "liuchengzhou · 华南区域", "启用", "blue"],
      ["企业管理员：刘海峰", "深圳示例数字科技", "启用", "green"],
      ["归档账号：陈晓宇", "已停用并交接", "已归档", "gray"],
      ["重复账号：张明", "两条账号待归并", "待处理", "amber"],
    ],
    centerTitle: "账号生命周期",
    centerMeta: "账号创建、角色分配、停用归档、恢复、归并和外部身份统一管理",
    panels: [
      {
        title: "内部账号",
        body: table(
          ["账号", "姓名", "角色", "区域", "状态"],
          [
            ["admin", "超级管理员", "超级管理员", "全局", status("启用", "green")],
            ["liuchengzhou", "刘龙飞", "区域管理员", "湖南区", status("启用", "green")],
            ["admin_hn", "湖南区管理员", "区域管理员", "湖南区", status("启用", "green")],
          ]
            .map(
              (r) =>
                `<tr><td><span class="record-title">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`,
            )
            .join(""),
        ),
      },
      {
        title: "企业管理员与外部身份",
        body: table(
          ["姓名", "渠道商", "系统角色", "外部身份", "状态"],
          [
            [
              "刘海峰",
              "深圳示例数字科技",
              "企业管理员",
              "IAM / 泛微 / 企微",
              status("正常", "green"),
            ],
            ["周明远", "上海启辰信息技术", "企业管理员", "IAM / 企微", status("正常", "green")],
            ["赵思宁", "北京中安网络技术", "企业管理员", "泛微待核验", status("待核验", "amber")],
          ]
            .map(
              (r) =>
                `<tr><td><span class="record-title">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`,
            )
            .join(""),
        ),
      },
    ],
    centerActions: `<button type="button" class="button" data-modal="account-archive">${icon("archive")} 归档账号</button><button type="button" class="button" data-modal="account-restore">${icon("refresh")} 恢复账号</button><button type="button" class="button primary" data-modal="account-merge">${icon("users")} 归并账号</button>`,
    rightTitle: "账号状态",
    rightItems: [
      ["内部账号", "71 个"],
      ["企业管理员", "46 个"],
      ["已归档", "8 个"],
      ["外部身份冲突", "4 个"],
    ],
    secondTitle: "生命周期检查",
    secondBody: `<div class="progress-list">${progress("账号归集率", 94)}${progress("外部身份完整率", 87)}${progress("归档交接完成率", 92)}</div>`,
    timeline: [
      ["账号归档完成", "今天 10:20", "陈晓宇业务已交接。"],
      ["外部身份待核验", "09-19", "泛微候选 4 条。"],
      ["重复账号归并", "09-18", "张明账号完成预览。"],
    ],
  },
  "organization-admin": {
    metrics: [
      ["内部组织", "8", "大区", "42 个区域", true],
      ["内部人员", "86", "人", "在职 82 人"],
      ["渠道组织", "227", "家", "渠道商主体"],
      ["岗位", "18", "个", "启用 16 个"],
      ["业务角色", "6", "类", "销售 / 技术"],
      ["权限角色", "12", "个", "自定义角色"],
    ],
    listTitle: "组织栏目",
    listCount: "9",
    searchPlaceholder: "搜索组织、人员或角色",
    tabs: ["内部组织", "渠道组织", "权限范围"],
    records: [
      ["组织与成员", "部门、岗位、人员任职", "入口", "blue"],
      ["业务角色", "销售、技术等业务职责", "启用", "green"],
      ["证书管理", "8 类证书模板", "启用", "green"],
      ["角色管理", "12 个系统角色", "启用", "blue"],
      ["离职交接", "待处理交接单 3 个", "进行中", "amber"],
      ["企微同步", "差异预览和人工批准", "启用", "green"],
      ["外部身份映射", "IAM / UniSDP / 泛微 / 企微", "4 个冲突", "red"],
    ],
    centerTitle: "组织双域管理",
    centerMeta: "内部组织和渠道组织分域展示，跨域范围不直接并集",
    panels: [
      {
        title: "内部组织树",
        body: `<div class="list-stack"><article class="record-card"><div class="record-top"><strong>联软科技</strong>${status("总部", "blue")}</div><p>8 个大区 · 42 个区域 · 86 名人员</p></article><article class="record-card"><div class="record-top"><strong>华南大区</strong>${status("12 人", "gray")}</div><p>渠道运营、安全服务、区域管理</p></article></div>`,
      },
      {
        title: "渠道组织树",
        body: `<div class="list-stack"><article class="record-card"><div class="record-top"><strong>深圳示例数字科技</strong>${status("核心渠道", "green")}</div><p>24 名成员 · 2 家下级渠道</p></article><article class="record-card"><div class="record-top"><strong>北京中安网络技术</strong>${status("金牌渠道", "blue")}</div><p>31 名成员 · 15 项证书</p></article></div>`,
      },
      {
        title: "岗位与任职",
        body: table(
          ["人员", "岗位", "业务角色", "组织", "状态"],
          [
            ["张明", "渠道运营", "销售", "华南大区", status("在职", "green")],
            ["周宁", "区域管理", "管理", "湖南区", status("在职", "green")],
            ["王卓", "技术服务", "技术", "华南大区", status("在职", "green")],
          ]
            .map(
              (r) =>
                `<tr><td><span class="record-title">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`,
            )
            .join(""),
        ),
      },
      {
        title: "数据范围",
        body: table(
          ["对象", "范围类型", "范围值", "状态"],
          [
            ["内部人员", "组织子树", "华南大区", status("有效", "green")],
            ["渠道商", "区域", "华南区域", status("有效", "green")],
            ["客户/商机", "区域", "华南区域", status("有效", "green")],
          ]
            .map(
              (r) =>
                `<tr><td><span class="record-title">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`,
            )
            .join(""),
        ),
      },
    ],
    centerActions: `<button type="button" class="button" data-modal="org-unit-edit">${icon("edit")} 编辑组织</button><button type="button" class="button" data-modal="org-sync">${icon("refresh")} 企微同步</button><button type="button" class="button primary" data-modal="user-editor">${icon("plus")} 新建用户</button>`,
    rightTitle: "组织健康度",
    rightItems: [
      ["组织节点", "50 个"],
      ["人员", "86 人"],
      ["渠道组织", "227 家"],
      ["待交接", "3 个"],
    ],
    secondTitle: "数据范围配置",
    secondBody: `<div class="progress-list">${progress("账号归集率", 94)}${progress("外部身份完整率", 87)}${progress("证书有效率", 92)}${progress("数据范围配置率", 98)}</div>`,
    timeline: [
      ["企微同步预览", "今天 10:10", "3 个部门、12 条人员变更。"],
      ["外部身份冲突", "09-19", "4 条候选待确认。"],
      ["离职交接完成", "09-18", "1 名管理员已交接。"],
    ],
  },
  "product-admin": {
    metrics: [
      ["产品大类", "8", "类", "已发布", true],
      ["软件模块", "34", "个", "全部发布"],
      ["软件功能", "86", "项", "启用 82 项"],
      ["硬件产品", "15", "款", "1 款待补成本"],
      ["产品套餐", "6", "个", "组合产品"],
      ["待完善", "3", "项", "阻塞收益冻结"],
    ],
    listTitle: "产品层级",
    listCount: "149",
    searchPlaceholder: "搜索产品、模块、型号",
    tabs: ["大类", "模块", "功能", "硬件", "套餐"],
    records: [
      ["终端安全", "产品大类 · 4 个模块", "已发布", "green"],
      ["终端安全管理", "软件模块 · 12 项功能", "已发布", "green"],
      ["数据防泄漏", "软件功能 · ¥ 80 / 点", "已发布", "green"],
      ["微盾安全网关", "硬件产品 · ¥ 40,000 / 台", "已发布", "green"],
      ["终端安全基础套餐", "产品套餐 · 12 个功能模块", "已发布", "green"],
    ],
    centerTitle: "产品维护",
    centerMeta: "产品大类、模块、功能、硬件和套餐均有独立新增、编辑、发布和删除动作",
    panels: [
      {
        title: "产品大类",
        body: table(
          ["大类", "产品类型", "模块数", "状态"],
          [
            ["终端安全", "软件", "4", status("已发布", "green")],
            ["数据安全", "软件", "3", status("已发布", "green")],
            ["安全硬件", "硬件", "15", status("已发布", "green")],
          ]
            .map(
              (r) =>
                `<tr><td><span class="record-title">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`,
            )
            .join(""),
        ),
      },
      {
        title: "功能与硬件",
        body: table(
          ["产品", "类型", "价格", "状态"],
          [
            ["终端安全管理", "软件功能", "¥ 280 / 点", status("已发布", "green")],
            ["数据防泄漏", "软件功能", "¥ 80 / 点", status("已发布", "green")],
            ["微盾安全网关", "硬件", "¥ 40,000 / 台", status("已发布", "green")],
          ]
            .map(
              (r) =>
                `<tr><td><span class="record-title">${r[0]}</span></td><td>${r[1]}</td><td class="amount">${r[2]}</td><td>${r[3]}</td></tr>`,
            )
            .join(""),
        ),
      },
      {
        title: "套餐组成",
        body: `<div class="chip-row"><span class="chip active">终端安全管理</span><span class="chip active">数据防泄漏</span><span class="chip active">安全网关</span><span class="chip">标准维保服务</span></div>`,
      },
      {
        title: "发布与成本",
        body: infoGrid([
          ["功能发布", "86 项"],
          ["硬件发布", "15 款"],
          ["成本待补", "1 款"],
          ["产品线范围", "微盾 / 非微盾"],
        ]),
      },
    ],
    centerActions: `<button type="button" class="button" data-modal="product-category">${icon("plus")} 新增大类</button><button type="button" class="button" data-modal="product-feature">${icon("box")} 新建产品</button><button type="button" class="button primary" data-modal="product-package">${icon("layers")} 新建套餐</button>`,
    rightTitle: "产品状态",
    rightItems: [
      ["产品总数", "149 项"],
      ["已发布", "146 项"],
      ["待完善", "3 项"],
      ["成本待补", "1 款"],
    ],
    secondTitle: "发布检查",
    secondBody: `<div class="progress-list">${progress("功能发布率", 95)}${progress("硬件发布率", 93)}${progress("套餐完整率", 100)}</div>`,
    timeline: [
      ["功能价格更新", "今天 10:20", "终端安全管理阶梯价调整。"],
      ["硬件成本补充", "09-19", "微盾安全网关成本已维护。"],
      ["套餐发布", "09-18", "终端安全基础套餐已发布。"],
    ],
  },
  "workload-config": {
    metrics: [
      ["工作量映射", "49", "条", "覆盖 42 个产品", true],
      ["交付规则", "15", "条", "LEP-DELIVERY-20260612"],
      ["特殊比例", "6", "个", "模块覆盖"],
      ["敏感词规则", "4", "条", "命中加项"],
      ["待完善", "3", "项", "无有效映射"],
      ["最后更新", "今天", "", "10:20"],
    ],
    listTitle: "工作量配置",
    listCount: "49",
    searchPlaceholder: "搜索产品、模块或规则",
    tabs: ["产品映射", "交付规则", "特殊比例"],
    records: [
      ["终端安全管理", "映射为人天规则 · 已启用", "启用", "green"],
      ["数据防泄漏", "映射为人天规则 · 已启用", "启用", "green"],
      ["安全网关", "交付工作量 3 人天", "启用", "green"],
      ["敏感关键词工作量", "命中范围加项", "启用", "amber"],
      ["标准维保服务", "模块比例特殊覆盖", "启用", "blue"],
    ],
    centerTitle: "标准工作量配置",
    centerMeta: "产品映射、交付工作量和特殊比例共同参与报价工作量试算",
    panels: [
      {
        title: "产品映射规则",
        body: table(
          ["产品名称", "类型", "映射类型", "状态"],
          [
            ["终端安全管理", "软件功能", "人天规则", status("启用", "green")],
            ["微盾安全网关", "硬件", "交付工作量", status("启用", "green")],
            ["标准维保服务", "服务", "比例规则", status("启用", "green")],
          ]
            .map(
              (r) =>
                `<tr><td><span class="record-title">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`,
            )
            .join(""),
        ),
      },
      {
        title: "交付工作量规则",
        body: table(
          ["产品类型", "点数范围", "人天", "状态"],
          [
            ["终端安全", "1-99", "5 人天", status("启用", "green")],
            ["终端安全", "100-499", "12 人天", status("启用", "green")],
            ["终端安全", "500+", "24 人天", status("启用", "green")],
          ]
            .map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`)
            .join(""),
        ),
      },
      {
        title: "特殊比例覆盖",
        body: `<div class="pricing-ratio-list"><div><span>安全运维模块</span><strong>15%</strong></div><div><span>数据安全模块</span><strong>12%</strong></div><div><span>标准维保服务</span><strong>15%</strong></div></div>`,
      },
      {
        title: "敏感关键词",
        body: `<div class="chip-row"><span class="chip active">等保</span><span class="chip active">国产化</span><span class="chip active">信创</span><span class="chip">重大项目</span></div>`,
      },
    ],
    centerActions: `<button type="button" class="button primary" data-modal="workload-rule-edit">${icon("edit")} 编辑工作量规则</button>`,
    rightTitle: "配置状态",
    rightItems: [
      ["产品映射", "49 条"],
      ["交付规则", "15 条"],
      ["特殊比例", "6 个"],
      ["待完善", "3 项"],
    ],
    secondTitle: "映射完整率",
    secondBody: `<div class="progress-list">${progress("软件功能", 96)}${progress("硬件产品", 100)}${progress("服务产品", 88)}</div>`,
    timeline: [
      ["工作量规则更新", "今天 10:20", "新增 500+ 点人天规则。"],
      ["特殊比例调整", "09-19", "安全运维模块比例调整。"],
      ["映射补齐", "09-18", "补齐 2 个产品映射。"],
    ],
  },
  "import-export": {
    metrics: [
      ["导入任务", "18", "条", "本月执行", true],
      ["成功", "15", "条", "成功率 83%"],
      ["失败", "2", "条", "可下载错误明细"],
      ["部分成功", "1", "条", "4 行失败"],
      ["导出任务", "26", "条", "文件保留 7 天"],
      ["待下载", "3", "条", "任务已完成"],
    ],
    listTitle: "任务类型",
    listCount: "44",
    searchPlaceholder: "搜索任务编号、业务类型",
    tabs: ["导入", "导出", "失败任务"],
    records: [
      ["客户报备导入", "126 行 · 已完成", "成功", "green"],
      ["商机导入", "58 行 · 4 行失败", "部分成功", "amber"],
      ["渠道商导入", "32 行 · 已完成", "成功", "green"],
      ["员工导入", "12 行 · 模板校验失败", "失败", "red"],
      ["客户导出", "1,286 条", "待下载", "blue"],
    ],
    centerTitle: "导入导出任务",
    centerMeta: "模板下载、文件上传、预检、执行和结果下载全流程",
    panels: [
      {
        title: "导入步骤",
        body: `<div class="flow">${[
          ["下载模板", "选择业务类型"],
          ["上传文件", "XLSX"],
          ["预检", "字段和重复校验"],
          ["执行", "异步写入"],
          ["结果", "下载错误明细"],
        ]
          .map(
            ([t, d], i) =>
              `<div class="flow-step ${i === 1 ? "active" : ""}"><span class="flow-dot">${i + 1}</span><strong>${t}</strong></div>`,
          )
          .join("")}</div>`,
      },
      {
        title: "最近任务",
        body: table(
          ["任务", "类型", "进度", "状态"],
          [
            ["客户报备导入", "导入", "126 / 126", status("成功", "green")],
            ["商机导入", "导入", "54 / 58", status("部分成功", "amber")],
            ["客户导出", "导出", "1,286 / 1,286", status("待下载", "blue")],
          ]
            .map(
              (r) =>
                `<tr><td><span class="record-title">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`,
            )
            .join(""),
        ),
      },
      {
        title: "错误明细",
        body: `<div class="callout warning">商机导入有 4 行未写入：客户未审批、渠道归属为空、金额格式错误。</div><button type="button" class="button" style="margin-top:8px">${icon("download")} 下载错误明细</button>`,
      },
      {
        title: "导出范围",
        body: infoGrid([
          ["导出对象", "客户、商机、渠道、员工"],
          ["数据范围", "当前账号范围"],
          ["脱敏", "手机号、邮箱"],
          ["文件保留", "7 天"],
        ]),
      },
    ],
    centerActions: `<button type="button" class="button" data-modal="import-center">${icon("upload")} 新建导入</button><button type="button" class="button primary" data-modal="export-scope">${icon("download")} 新建导出</button>`,
    rightTitle: "任务状态",
    rightItems: [
      ["本月导入", "18 条"],
      ["本月导出", "26 条"],
      ["失败", "2 条"],
      ["待下载", "3 条"],
    ],
    secondTitle: "文件与保留期",
    secondBody: `<div class="progress-list">${progress("导入成功率", 83)}${progress("导出成功率", 100)}${progress("文件剩余保留期", 70)}</div>`,
    timeline: [
      ["客户报备导入完成", "今天 10:20", "126 行全部写入。"],
      ["商机导入部分失败", "09-19", "4 行进入错误明细。"],
      ["员工导出完成", "09-18", "文件可下载。"],
    ],
  },
  "quote-actions": {
    metrics: [
      ["报价总数", "18", "份", "草稿 5 份", true],
      ["待客户确认", "4", "份", "即将到期 1 份"],
      ["已确认", "6", "份", "可转订单"],
      ["已转订单", "5", "份", "只读"],
      ["已过期", "2", "份", "需重新报价"],
      ["收益待冻结", "1", "份", "订单已确认"],
    ],
    listTitle: "报价单",
    listCount: "18",
    searchPlaceholder: "搜索报价单号、客户或商机",
    tabs: ["全部", "待确认", "已转订单"],
    records: [
      ["QT202609160028", "华南某智能制造集团 · 待客户确认", "可发送", "amber"],
      ["QT202609150019", "华东某商业银行 · 已发送", "待确认", "blue"],
      ["QT202609120011", "某省政务数据中心 · 已确认", "可转订单", "green"],
      ["QT202609050003", "西南某能源集团 · 已过期", "需重算", "gray"],
    ],
    centerTitle: "报价动作与收益",
    centerMeta: "处理报价发送、确认、撤回、过期、PDF、转订单和收益快照",
    panels: [
      {
        title: "报价状态动作",
        body: `<div class="order-action-grid compact-actions">${[
          ["发送报价", "quote-send", "blue"],
          ["客户确认", "quote-confirm", "green"],
          ["撤回报价", "quote-withdraw", "amber"],
          ["标记过期", "quote-expire", "gray"],
          ["删除草稿", "quote-delete", "red"],
          ["转订单", "convert-order", "blue"],
        ]
          .map(
            ([t, m, tone]) =>
              `<button type="button" class="order-action-card-button" data-modal="${m}"><strong>${t}</strong></button>`,
          )
          .join("")}</div>`,
      },
      {
        title: "收益计算",
        body: infoGrid([
          ["产品合同额", "¥ 548,600.00"],
          ["硬件内部成本", "¥ 13,000.00"],
          ["项目收益", "¥ 186,420.00"],
          ["收益状态", "待冻结"],
          ["成本规则", "配置完整"],
          ["冻结时点", "订单确认事件"],
        ]),
      },
      {
        title: "一级渠道商选择",
        body: `<div class="callout">二级渠道商报价转订单时，必须显式选择一级渠道商。</div><button type="button" class="button" style="margin-top:8px" data-modal="parent-partner-select">选择一级渠道商</button>`,
      },
      {
        title: "报价历史",
        body: `<div class="timeline"><div class="timeline-item"><i class="timeline-dot"></i><div><strong>报价已发送</strong><p>发送给主要联系人和采购联系人。</p></div><time>今天 09:20</time></div><div class="timeline-item"><i class="timeline-dot"></i><div><strong>报价快照生成</strong><p>金额、折扣和工作量已固化。</p></div><time>09-16</time></div></div>`,
      },
    ],
    centerActions: `<button type="button" class="button" data-modal="quote-profit">${icon("chart")} 收益面板</button><button type="button" class="button primary" data-modal="quote-send">${icon("message")} 发送报价</button>`,
    rightTitle: "当前报价",
    rightItems: [
      ["状态", "待客户确认"],
      ["金额", "¥ 42.86 万"],
      ["有效期", "2026-10-16"],
      ["折扣", "97%"],
    ],
    secondTitle: "收益状态",
    secondBody: `<div class="callout warning">收益为实时预估；订单超管确认后由 Worker 冻结正式快照。</div>`,
    timeline: [
      ["报价生成", "09-16 17:50", "服务端试算完成。"],
      ["报价发送", "今天 09:20", "客户已查看。"],
      ["收益预估更新", "今天 09:25", "区域覆盖价已命中。"],
    ],
  },
  "audit-operations": {
    metrics: [
      ["审计日志", "12,860", "条", "今日 286 条", true],
      ["任务成功", "98.6", "%", "失败 4 条"],
      ["待补偿", "4", "条", "可重试 3 条"],
      ["最近备份", "今天", "03:00", "本机备份成功"],
      ["恢复演练", "30", "天前", "需重新演练"],
      ["服务健康", "正常", "", "全部依赖可用"],
    ],
    listTitle: "运维分类",
    listCount: "6",
    searchPlaceholder: "搜索日志、任务或备份",
    tabs: ["审计", "任务", "备份"],
    records: [
      ["操作审计", "关键业务操作和越权拒绝", "正常", "blue"],
      ["失败任务补偿", "4 条待处理", "需关注", "amber"],
      ["本机备份", "今天 03:00 成功", "正常", "green"],
      ["离线恢复演练", "30 天前", "需演练", "amber"],
      ["服务健康", "API、PostgreSQL、Redis 正常", "正常", "green"],
    ],
    centerTitle: "审计与运维",
    centerMeta: "操作审计、任务补偿、备份恢复和服务健康统一查看",
    panels: [
      {
        title: "操作审计",
        body: table(
          ["时间", "操作人", "动作", "对象", "结果"],
          [
            ["09:42", "刘管理员", "审核客户报备", "华南某智能制造集团", status("成功", "green")],
            ["09:12", "陈佳", "跨区域订单访问", "SO202609120009", status("拒绝", "red")],
            ["08:58", "系统", "报价收益冻结", "QT202609160028", status("成功", "green")],
          ]
            .map(
              (r) =>
                `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td><span class="record-title">${r[3]}</span></td><td>${r[4]}</td></tr>`,
            )
            .join(""),
        ),
        actions: `<button type="button" class="link" data-modal="log-detail">查看日志详情</button>`,
      },
      {
        title: "任务失败补偿",
        body: table(
          ["任务", "失败原因", "重试次数", "状态"],
          [
            ["订单预审", "OA 超时", "2", status("待重试", "amber")],
            ["消息投递", "短信模板缺失", "1", status("待重试", "amber")],
            ["收益冻结", "成本规则缺失", "0", status("待处理", "red")],
          ]
            .map(
              (r) =>
                `<tr><td><span class="record-title">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`,
            )
            .join(""),
        ),
        actions: `<button type="button" class="link" data-modal="task-retry">重试任务</button>`,
      },
      {
        title: "备份记录",
        body: table(
          ["时间", "类型", "结果", "大小"],
          [
            ["今天 03:00", "本机全量", status("成功", "green"), "2.8 GB"],
            ["昨天 03:00", "本机全量", status("成功", "green"), "2.7 GB"],
            ["09-18 03:00", "本机全量", status("成功", "green"), "2.7 GB"],
          ]
            .map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`)
            .join(""),
        ),
        actions: `<button type="button" class="link" data-modal="backup-now">立即备份</button>`,
      },
      {
        title: "恢复演练",
        body: `<div class="callout warning">最近一次离线恢复演练距今 30 天，建议重新执行并记录证据。</div><button type="button" class="button" style="margin-top:8px" data-modal="restore-confirm">开始恢复演练</button>`,
      },
    ],
    centerActions: `<button type="button" class="button" data-modal="collect-diagnostics">${icon("download")} 下载诊断报告</button><button type="button" class="button primary" data-modal="backup-now">${icon("database")} 立即备份</button>`,
    rightTitle: "系统状态",
    rightItems: [
      ["API", "正常"],
      ["PostgreSQL", "正常"],
      ["Redis", "正常"],
      ["Worker", "正常"],
    ],
    secondTitle: "风险",
    secondBody: `<div class="member-risk-list"><div class="member-risk-row warning"><span><strong>恢复演练过期</strong><small>最近演练 30 天前</small></span><b>需处理</b></div><div class="member-risk-row warning"><span><strong>4 条任务待补偿</strong><small>3 条可重试</small></span><b>待处理</b></div></div>`,
    timeline: [
      ["备份完成", "今天 03:00", "本机全量备份成功。"],
      ["越权访问拒绝", "09-19", "跨区域订单访问被拒绝。"],
      ["任务失败", "09-18", "OA 预审超时。"],
    ],
  },
};

function renderExtendedWorkspace(key) {
  return extendedWorkspacePage(extendedMeta[key]);
}

function processChain(steps, active = -1) {
  return `<div class="process-chain">${steps
    .map(
      ([title, desc], index) =>
        `<div class="process-node ${index < active ? "done" : index === active ? "active" : ""}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${title}</strong><small>${desc}</small></div>${index < steps.length - 1 ? `<i class="process-arrow">→</i>` : ""}`,
    )
    .join("")}</div>`;
}

function flowLane(title, steps) {
  return `<div class="flow-lane"><div class="flow-lane-title"><strong>${title}</strong></div><div class="flow-track">${steps.map((step, index) => `<span><b>${step}</b>${index < steps.length - 1 ? "<i>→</i>" : ""}</span>`).join("")}</div></div>`;
}

function renderBusinessMap() {
  return `<div class="war-kpis">${metric("客户", "1,286", "家", "客户主档")}${metric("报备", "152", "条", "保护与审核")}${metric("商机", "75", "条", "销售推进")}${metric("报价", "96", "份", "服务端试算")}${metric("订单", "128", "笔", "审批与履约")}${metric("收益", "S10-024", "版本", "确认后冻结")}</div><div class="business-board">${panel(
    "主业务链",
    "客户报备到订单履约及收益冻结",
    processChain(
      [
        ["客户报备", "客户、联系人、归属"],
        ["运营审核", "查重与保护期"],
        ["商机创建", "项目与阶段"],
        ["报价试算", "价格、折扣、工作量"],
        ["客户确认", "报价版本与有效期"],
        ["订单审批", "商务、渠道、超管"],
        ["履约交付", "发货、完成、归档"],
        ["收益冻结", "订单确认后异步冻结"],
      ],
      4,
    ),
  )}<div class="grid-3">${panel(
    "客户与销售链",
    "主数据到成交",
    processChain(
      [
        ["客户主档", "唯一客户事实"],
        ["报备保护", "渠道归属"],
        ["商机", "阶段推进"],
        ["报价", "价格快照"],
        ["订单", "合同执行"],
      ],
      2,
    ),
  )}${panel(
    "渠道运营链",
    "准入到续签",
    processChain(
      [
        ["渠道商建档", "主体与层级"],
        ["成员与证书", "业务角色"],
        ["合作运营", "报价与订单"],
        ["年度续签", "协议与资质"],
      ],
      1,
    ),
  )}${panel(
    "平台支撑链",
    "安全与审计",
    processChain(
      [
        ["统一登录", "IAM / 本地"],
        ["角色数据范围", "服务端鉴权"],
        ["审批与消息", "待办和通知"],
        ["审计任务", "留痕与补偿"],
      ],
      2,
    ),
  )}</div></div>`;
}

function renderBusinessFlows() {
  return `<div class="war-kpis">${metric("主业务链", "8", "节点", "客户到收益")}${metric("渠道生命周期", "7", "节点", "准入到续签")}${metric("账号与权限", "6", "节点", "身份到数据范围")}${metric("订单预审", "7", "节点", "OA 与企微协同")}${metric("模块价格", "4", "层规则", "阶梯、渠道、区域")}${metric("报价收益链", "7", "节点", "试算到冻结")}</div><div class="business-board">${panel("跨业务链路", "各业务链共享客户、渠道、账号、审批、消息和审计底座", `<div class="flow-lanes">${flowLane("主业务链", ["客户报备", "审核", "商机", "报价", "订单", "履约", "收益"])}${flowLane("渠道与账号", ["渠道准入", "成员创建", "角色授权", "数据范围", "证书管理", "离职交接", "归档"])}${flowLane("模块价格规则", ["基础价", "区域覆盖", "渠道比例", "数量阶梯", "报价单价"])}${flowLane("订单预审", ["订单确认", "区域映射", "OA 发起", "企微群", "回调同步", "附件归档", "完成"])}${flowLane("审批与消息", ["业务事件", "发件箱", "规则匹配", "收件人校验", "多通道投递", "结果审计"])}${flowLane("报价收益", ["报价试算", "成本规则", "订单确认", "冻结请求", "Worker 重算", "正式快照", "异常补偿"])}</div>`)}</div>`;
}

function stateCard(title, states, note) {
  return `<article class="state-card"><div class="state-card-head"><strong>${title}</strong><span>${note}</span></div><div class="state-flow">${states.map((state, index) => `<span class="state-chip ${index === 0 ? "active" : ""}">${state}</span>${index < states.length - 1 ? "<i>→</i>" : ""}`).join("")}</div></article>`;
}

function renderStateMachines() {
  return `<div class="war-kpis">${metric("客户报备", "5", "状态", "待审到过期")}${metric("商机", "7", "阶段", "建联到成单")}${metric("报价", "5", "状态", "草稿到转单")}${metric("订单", "12", "状态", "待确认到完成")}${metric("渠道", "5", "状态", "待审到合作")}${metric("任务", "6", "状态", "待执行到失败")}</div><div class="business-board">${panel("关键状态机", "状态变化必须由服务端校验，并写状态历史和审计日志", `<div class="state-grid">${stateCard("客户报备", ["待审核", "审核中", "已通过", "已拒绝", "已过期"], "保护期以审核通过时间计算")}${stateCard("商机阶段", ["客户建联", "需求确认", "方案 / POC", "商务谈判", "立项 / 招投标", "成单交接", "关闭"], "跟进时同步更新阶段")}${stateCard("报价状态", ["草稿", "已发送", "已确认", "已转单", "已过期"], "已转单报价只读")}${stateCard("订单状态", ["待一级确认", "待超管确认", "已确认", "履约中", "已完成", "已退回"], "退回修订保留审批轮次")}${stateCard("渠道状态", ["待审批", "合作中", "待续签", "已停用", "已归档"], "资质与协议独立维护")}${stateCard("任务状态", ["待执行", "执行中", "成功", "部分成功", "失败", "已补偿"], "失败不静默丢失")}</div>`)}</div>`;
}

function renderArchitecture() {
  const layers = [
    ["终端与入口", "管理员 PC / 管理员移动 / 渠道 PC / 渠道移动", "blue"],
    ["页面与领域组件", "客户、商机、报价、订单、渠道、产品、消息、组织", "green"],
    ["应用服务", "鉴权、权限、状态机、任务、消息、审计和公开只读 API", "purple"],
    ["领域数据", "客户主档、商机、报价快照、订单、渠道、产品、组织账号", "amber"],
    ["基础设施", "PostgreSQL、Redis、Worker、文件存储、OA / 企微 / IAM", "gray"],
  ];
  const domains = [
    ["客户经营", "客户主档 · 报备 · 保护期 · 跟进"],
    ["销售过程", "商机 · 跟进 · 报价 · 报价转订单"],
    ["订单履约", "审批 · 调价 · 回退修订 · 履约归档"],
    ["渠道运营", "准入 · 层级 · 成员 · 证书 · 经营分析"],
    ["产品与价格", "目录 · 套餐 · 阶梯价 · 区域覆盖 · 人天"],
    ["平台治理", "组织 · 账号 · 权限 · 审计 · 消息 · OpenAPI"],
  ];
  const layerCards = layers
    .map(
      ([title, desc, tone], index) =>
        `<article class="architecture-layer ${tone}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${title}</strong><small>${desc}</small></div></article>`,
    )
    .join("");
  const domainCards = domains
    .map(
      ([title, desc], index) =>
        `<article><span>DOMAIN ${String(index + 1).padStart(2, "0")}</span><strong>${title}</strong><p>${desc}</p></article>`,
    )
    .join("");
  const boundaryRows = [
    ["客户报备", "查重、保存、状态", "消息、区域归属校验", "事务回滚"],
    ["报价", "服务端试算、快照", "PDF、通知", "保留原版本"],
    ["订单", "批准状态、审批轮次", "OA、企微、收益冻结", "任务补偿"],
    ["组织账号", "身份、角色、范围", "企微同步、身份映射", "人工批准"],
  ]
    .map(
      (row) =>
        `<tr><td><span class="record-title">${row[0]}</span></td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td></tr>`,
    )
    .join("");
  const slices = [
    ["基础壳与鉴权", "01"],
    ["客户与商机", "02"],
    ["报价与订单", "03"],
    ["渠道与产品", "04"],
    ["消息与组织", "05"],
    ["审计与运维", "06"],
    ["移动端收口", "07"],
  ]
    .map(
      ([title, index]) =>
        `<div class="timeline-item"><i class="timeline-dot"></i><div><strong>${title}</strong><p>完成后单独回归和回退。</p></div><time>SLICE ${index}</time></div>`,
    )
    .join("");
  return `<div class="war-kpis">${metric("正式入口", "4", "套", "PC / 移动 × 管理 / 渠道", true)}${metric("业务域", "6", "个", "客户到平台治理")}${metric("核心实体", "28", "类", "主档、快照与任务")}${metric("状态机", "6", "套", "服务端统一校验")}${metric("后台任务", "5", "类", "消息、预审、收益、导入、审计")}${metric("交付切片", "7", "阶段", "可独立回归与回退")}</div><div class="war-layout architecture-workspace"><aside class="war-panel war-list"><div class="war-list-head"><div class="war-title-row"><strong>架构层次</strong><span class="count-badge">5</span></div><div class="war-search">${icon("search")} 搜索业务域、模块或接口</div><div class="war-tabs"><span class="war-tab active">系统视角</span><span class="war-tab">业务视角</span><span class="war-tab">交付视角</span></div></div><div class="architecture-layer-list">${layerCards}</div></aside><main class="war-panel war-center architecture-center"><div class="war-center-head"><div class="deal-title"><strong>全量系统架构与业务边界</strong><span>四端共享统一鉴权、权限、数据范围、状态机、审计和任务底座</span></div><div class="center-actions"><button type="button" class="button" data-nav="business-map">${icon("layers")} 业务全景</button><button type="button" class="button primary" data-nav="extensions">${icon("grid")} 页面索引</button></div></div><div class="architecture-center-scroll"><div class="architecture-domain-grid">${domainCards}</div>${panel(
    "端到端主链",
    "客户报备到订单履约、收益冻结和审计归档",
    processChain(
      [
        ["客户报备", "主体与保护期"],
        ["商机创建", "阶段与跟进"],
        ["报价试算", "价格与工作量"],
        ["客户确认", "报价快照"],
        ["报价转单", "订单生成"],
        ["审批履约", "一级 / 区管 / 超管"],
        ["收益冻结", "确认后异步"],
        ["归档审计", "只追加留痕"],
      ],
      4,
    ),
  )}${panel("数据与任务边界", "同步事务只处理业务状态，外部系统与耗时计算统一进入任务", table(["边界", "同步职责", "异步 / 外部职责", "失败策略"], boundaryRows))}</div></main><aside class="war-panel war-right"><div class="right-section"><article class="right-card highlight"><div class="right-card-title"><strong>统一底座</strong><span>所有页面复用</span></div>${infoGrid(
    [
      ["身份", "HttpOnly 会话"],
      ["权限", "角色 + 数据范围"],
      ["状态", "服务端状态机"],
      ["审计", "操作与任务留痕"],
    ],
  )}</article><article class="right-card"><div class="right-card-title"><strong>系统交互</strong><span>外部依赖</span></div><div class="progress-list">${progress("IAM / UniSDP", 100)}${progress("企微", 94)}${progress("泛微 OA", 86)}${progress("OpenAPI", 92)}</div></article><article class="right-card"><div class="right-card-title"><strong>推荐实施顺序</strong><span>7 个切片</span></div><div class="timeline">${slices}</div></article><article class="right-card"><div class="right-card-title"><strong>质量门禁</strong><span>完成定义</span></div><div class="member-risk-list"><div class="member-risk-row success"><span><strong>状态与权限</strong><small>服务端统一校验</small></span><b>必须</b></div><div class="member-risk-row warning"><span><strong>幂等与补偿</strong><small>外部任务失败不丢</small></span><b>必须</b></div><div class="member-risk-row"><span><strong>审计与回退</strong><small>每次发布可回退</small></span><b>必须</b></div></div></article></div></aside></div>`;
}

function renderChannelMembers() {
  const records = [
    ["SZ001", "刘海峰", "liuhf", "企业管理员", "138****8821", "启用", "12 份"],
    ["SZ002", "张明", "zhangm", "销售", "138****6621", "启用", "5 份"],
    ["SZ003", "王卓", "wangz", "技术", "139****2308", "启用", "4 份"],
    ["SZ004", "陈晓宇", "chenxy", "销售", "137****9912", "停用", "2 份"],
    ["SZ005", "林舒雅", "linsy", "销售", "136****1208", "启用", "3 份"],
  ];
  return `<div class="war-kpis">${metric("渠道成员", "24", "人", "深圳示例数字科技", true)}${metric("企业管理员", "1", "人", "账号独立", false)}${metric("销售成员", "18", "人", "业务角色", false)}${metric("技术成员", "6", "人", "业务角色", false)}${metric("有效证书", "12", "份", "4 类证书", false)}${metric("待处理", "2", "人", "停用或证书到期", false)}</div><div class="war-layout"><aside class="war-panel war-list"><div class="war-list-head"><div class="war-title-row"><strong>渠道与成员</strong><span class="count-badge">192</span></div><div class="war-search">${icon("search")} 搜索渠道商名称</div><div class="war-tabs"><span class="war-tab active">全部</span><span class="war-tab">我的渠道</span><span class="war-tab">有成员</span></div></div><div class="war-list-body">${[
    ["深圳示例数字科技有限公司", "24 人 · 1 名企业管理员", "合作中", "green"],
    ["上海启辰信息技术有限公司", "18 人 · 1 名企业管理员", "合作中", "green"],
    ["北京中安网络技术有限公司", "31 人 · 2 名企业管理员", "待续签", "amber"],
    ["成都智联安全服务有限公司", "6 人 · 1 名企业管理员", "待审批", "blue"],
    ["厦门产品交付中心", "5 人 · 0 名企业管理员", "待续签", "amber"],
  ]
    .map(
      ([title, meta, badge, tone], index) =>
        `<article class="war-record ${index === 0 ? "active" : ""}"><div class="war-record-top"><strong>${title}</strong>${status(badge, tone)}</div><p>${meta}</p></article>`,
    )
    .join(
      "",
    )}</div></aside><main class="war-panel war-center"><div class="war-center-head"><div class="deal-title"><strong>深圳示例数字科技有限公司 · 成员管理</strong><span>共 24 人 · 企业管理员 1 人 · 证书 12 份</span></div><div class="center-actions"><button type="button" class="button" data-nav="channels">返回渠道商列表</button><button type="button" class="button" data-nav="certificate-management">${icon("shield")} 证书管理</button><button type="button" class="button" data-modal="member-editor">${icon("plus")} 添加成员</button></div></div><div class="member-toolbar"><div class="field search">${icon("search")} 搜索姓名、账号或手机号</div><div class="field">${icon("filter")} 全部业务角色 ${icon("chevron")}</div><div class="field">${icon("users")} 全部状态 ${icon("chevron")}</div></div><div class="member-table-wrap">${table(
    ["成员", "账号身份", "业务角色", "联系电话", "状态", "证书", "操作"],
    records
      .map(
        (row) =>
          `<tr data-modal="member-detail"><td><span class="member-name"><b>${row[1]}</b><small>${row[0]}</small></span></td><td>${row[3]}</td><td>${status(row[3] === "技术" ? "技术" : row[3] === "企业管理员" ? "企业管理员" : "销售", row[3] === "技术" ? "purple" : row[3] === "企业管理员" ? "blue" : "green")}</td><td>${row[4]}</td><td>${status(row[5], row[5] === "启用" ? "green" : "gray")}</td><td>${row[6]}</td><td>${actionButtons(
            [
              ["查看", "member-detail"],
              ["编辑", "member-editor"],
              ["重置密码", "member-reset"],
              ["停用", "member-disable"],
            ],
          )}</td></tr>`,
      )
      .join(""),
  )}</div></main><aside class="war-panel war-right"><div class="right-section"><article class="right-card highlight"><div class="right-card-title"><strong>成员状态</strong><span>实时快照</span></div>${infoGrid(
    [
      ["成员总数", "24 人"],
      ["企业管理员", "1 人"],
      ["销售 / 技术", "18 / 6"],
      ["账号停用", "1 人"],
    ],
  )}</article><article class="right-card"><div class="right-card-title"><strong>业务角色分布</strong><span>销售 / 技术</span></div><div class="progress-list">${progress("销售成员", 75)}${progress("技术成员", 25)}${progress("证书覆盖", 92)}</div></article><article class="right-card"><div class="right-card-title"><strong>证书与风险</strong><span>4 类证书</span></div><div class="member-risk-list"><div class="member-risk-row warning"><span><strong>安全交付认证即将到期</strong><small>王卓 · 2026-10-12</small></span><b>30 天</b></div><div class="member-risk-row"><span><strong>成员账号待复核</strong><small>陈晓宇 · 已停用</small></span><b>待处理</b></div><div class="member-risk-row success"><span><strong>销售能力认证</strong><small>张明 · 2027-03-18</small></span><b>有效</b></div></div></article></div></aside></div>`;
}

function orderActionCard(title, desc, button, modal, tone = "blue") {
  return `<article class="order-action-card"><div class="order-action-head"><strong>${title}</strong>${status(tone === "red" ? "高风险" : tone === "amber" ? "需说明" : "可执行", tone)}</div><p>${desc}</p><button type="button" class="button ${tone === "red" ? "danger" : tone === "blue" ? "primary" : ""} small" data-modal="${modal}">${button}</button></article>`;
}

function renderOrderActions() {
  return `<div class="war-kpis">${metric("待一级确认", "5", "笔", "一级分销商处理", true)}${metric("待区管确认", "8", "笔", "含调价 2 笔", false)}${metric("待超管确认", "3", "笔", "调价订单", false)}${metric("回退修订", "2", "笔", "待审批或重提", false)}${metric("履约中", "36", "笔", "发货与完成", false)}${metric("异常订单", "1", "笔", "审批超时", false)}</div><div class="war-layout"><aside class="war-panel war-list"><div class="war-list-head"><div class="war-title-row"><strong>审批订单</strong><span class="count-badge">19</span></div><div class="war-search">${icon("search")} 搜索订单编号或客户</div><div class="war-tabs"><span class="war-tab active">待我处理</span><span class="war-tab">全部审批</span><span class="war-tab">超时</span></div></div><div class="war-list-body">${[
    ["SO202609150018", "待一级确认", "华南某大型制造企业", "amber"],
    ["SO202609140032", "待区管确认", "华东某金融服务机构", "blue"],
    ["SO202609120009", "待超管确认", "某省政务数据中心", "purple"],
    ["SO202609080026", "待回退修订审核", "华北某医疗集团", "amber"],
    ["SO202609050013", "已退回二级修改", "西南某能源集团", "red"],
  ]
    .map(
      ([no, badge, customer, tone], index) =>
        `<article class="war-record ${index === 0 ? "active" : ""}"><div class="war-record-top"><strong>${no}</strong>${status(badge, tone)}</div><p>${customer}</p><div class="war-record-bottom"><span>当前审批节点</span><strong>${index + 1} 天</strong></div></article>`,
    )
    .join(
      "",
    )}</div></aside><main class="war-panel war-center"><div class="war-center-head"><div class="deal-title"><strong>订单审批动作全集</strong><span>不同状态只显示当前角色可执行的动作，服务端二次校验</span></div><div class="center-actions"><button type="button" class="button" data-modal="order-revision">${icon("edit")} 申请回退修订</button></div></div><div class="order-action-grid">${orderActionCard("一级分销商确认", "一级渠道确认订单后进入区管审批", "确认订单", "order-primary-confirm", "blue")}${orderActionCard("一级分销商驳回", "驳回后必须退回二级渠道商修改", "驳回订单", "order-primary-reject", "red")}${orderActionCard("区管确认", "区管确认后进入超管确认或后续审批", "区管确认", "order-region-confirm", "blue")}${orderActionCard("区管调价", "调整订单总额并提交超管确认", "调整价格", "order-region-price", "amber")}${orderActionCard("超管确认", "最终确认订单并触发收益冻结", "超管确认", "order-superadmin-confirm", "blue")}${orderActionCard("超管退回", "可退回区管、一级或二级渠道商", "选择退回目标", "order-superadmin-return", "red")}${orderActionCard("回退修订审批", "批准后同步修改报价和订单并重新审批", "批准 / 驳回修订", "order-revision-review", "amber")}${orderActionCard("修订后重新提交", "重新选择模块、数量和系统单价", "重新提交", "order-resubmit", "blue")}${orderActionCard("履约动作", "确认发货、完成订单或取消订单", "执行履约动作", "order-fulfillment", "gray")}</div></main><aside class="war-panel war-right"><div class="right-section"><article class="right-card highlight"><div class="right-card-title"><strong>当前订单</strong><span>SO202609150018</span></div>${infoGrid(
    [
      ["客户", "华南某大型制造企业"],
      ["当前状态", "待一级确认"],
      ["审批轮次", "第 1 轮"],
      ["订单金额", "¥ 328,600.00"],
    ],
  )}</article><article class="right-card"><div class="right-card-title"><strong>审批链路</strong><span>角色顺序</span></div>${flow(["订单提交", "一级确认", "区管确认", "超管确认", "履约交付"], 1)}</article><article class="right-card"><div class="right-card-title"><strong>审批提醒</strong><span>SLA 剩余 18 小时</span></div><div class="callout warning">驳回和退回必须填写原因并选择退回节点。调价后必须重新进入超管确认。</div></article></div></aside></div>`;
}

function renderPricingRules() {
  return `<div class="war-kpis">${metric("软件模块", "34", "项", "参与报价", true)}${metric("阶梯计价", "18", "项", "按端点数量", false)}${metric("固定价", "16", "项", "单一单价", false)}${metric("区域覆盖", "12", "项", "区域专属价", false)}${metric("一级渠道比例", "100", "%", "默认折扣率", false)}${metric("二级渠道比例", "110", "%", "默认折扣率", false)}</div><div class="war-layout"><aside class="war-panel war-list"><div class="war-list-head"><div class="war-title-row"><strong>软件模块</strong><span class="count-badge">34</span></div><div class="war-search">${icon("search")} 搜索模块名称或编号</div><div class="war-tabs"><span class="war-tab active">全部</span><span class="war-tab">阶梯计价</span><span class="war-tab">区域覆盖</span></div></div><div class="war-list-body">${[
    ["终端安全管理", "阶梯计价 · 12 项工作量", "已发布", "green"],
    ["数据防泄漏", "阶梯计价 · 8 项工作量", "已发布", "green"],
    ["终端准入控制", "固定价 · 区域覆盖 3 个", "已发布", "green"],
    ["安全运维管理", "阶梯计价 · 区域覆盖 2 个", "已发布", "green"],
    ["标准维保服务", "固定价 · 按月计算", "已发布", "green"],
  ]
    .map(
      ([title, meta, badge, tone], index) =>
        `<article class="war-record ${index === 0 ? "active" : ""}"><div class="war-record-top"><strong>${title}</strong>${status(badge, tone)}</div><p>${meta}</p></article>`,
    )
    .join(
      "",
    )}</div></aside><main class="war-panel war-center"><div class="war-center-head"><div class="deal-title"><strong>终端安全管理 · 价格规则</strong><span>阶梯价 + 渠道价格比例 + 区域价格覆盖 · 生效时间 2026-09-01</span></div><div class="center-actions"><button type="button" class="button" data-nav="products">返回产品与套餐</button><button type="button" class="button primary" data-modal="pricing-editor">${icon("edit")} 编辑价格规则</button></div></div><div class="pricing-board"><section class="pricing-block"><div class="pricing-block-head"><strong>基础阶梯价</strong><span>全国默认</span></div>${table(
    ["起购端点", "结束端点", "标准单价"],
    [
      ["1", "99", "¥ 360 / 点"],
      ["100", "499", "¥ 320 / 点"],
      ["500", "999", "¥ 300 / 点"],
      ["1,000", "不限", "¥ 280 / 点"],
    ]
      .map(
        (row) => `<tr><td>${row[0]}</td><td>${row[1]}</td><td class="amount">${row[2]}</td></tr>`,
      )
      .join(""),
  )}</section><div class="grid-2"><section class="pricing-block"><div class="pricing-block-head"><strong>渠道价格比例</strong><span>折扣率</span></div><div class="pricing-ratio-list"><div><span>一级渠道商</span><strong>标准价 × 100%</strong></div><div><span>二级渠道商</span><strong>标准价 × 110%</strong></div><div><span>区域覆盖</span><strong>优先于渠道比例</strong></div></div></section><section class="pricing-block"><div class="pricing-block-head"><strong>区域价格覆盖</strong><span>3 个区域</span></div><div class="region-price-list"><div><span>华南区域</span><strong>1,000 点以上 ¥ 270</strong></div><div><span>华东区域</span><strong>500 点以上 ¥ 290</strong></div><div><span>华北区域</span><strong>1,000 点以上 ¥ 275</strong></div></div></section></div><section class="pricing-block"><div class="pricing-block-head"><strong>区域阶梯覆盖明细</strong><span>命中区域后优先使用该阶梯</span></div>${table(
    ["区域", "起购端点", "结束端点", "区域单价", "覆盖状态"],
    [
      ["华南区域", "1,000", "不限", "¥ 270 / 点", status("生效中", "green")],
      ["华东区域", "500", "999", "¥ 290 / 点", status("生效中", "green")],
      ["华北区域", "1,000", "不限", "¥ 275 / 点", status("待生效", "amber")],
    ]
      .map(
        (row) =>
          `<tr><td><span class="record-title">${row[0]}</span></td><td>${row[1]}</td><td>${row[2]}</td><td class="amount">${row[3]}</td><td>${row[4]}</td></tr>`,
      )
      .join(""),
  )}</section></div></main><aside class="war-panel war-right"><div class="right-section"><article class="right-card highlight"><div class="right-card-title"><strong>价格命中顺序</strong><span>服务端计算</span></div>${flow(["产品模块", "区域覆盖", "渠道比例", "数量阶梯", "报价单价"], 3)}</article><article class="right-card"><div class="right-card-title"><strong>当前报价命中</strong><span>1,200 点 · 华南</span></div>${infoGrid(
    [
      ["基础阶梯", "¥ 280 / 点"],
      ["区域覆盖", "¥ 270 / 点"],
      ["一级渠道", "× 100%"],
      ["最终单价", "¥ 270 / 点"],
    ],
  )}</article><article class="right-card"><div class="right-card-title"><strong>规则状态</strong><span>版本与审计</span></div><div class="callout success">区域覆盖优先于渠道价格比例，报价保存时固化命中阶梯和版本。</div></article></div></aside></div>`;
}

function renderWindows() {
  const cards = [
    ["customer-detail", "客户详情抽屉", "展示客户档案、联系人、归属、健康度和跟进记录。"],
    [
      "customer-editor",
      "客户档案编辑",
      "编辑信用代码、行业、等级、区域、渠道、负责人、保护期和联系人。",
    ],
    ["followup-form", "记录跟进弹窗", "电话、拜访、会议和邮件统一录入，支持下一步提醒。"],
    ["member-editor", "渠道成员维护", "添加或编辑成员、销售/技术业务角色、账号状态和证书授权。"],
    ["quote-detail", "报价修改入口", "在报价详情中进入修改报价，已转单报价只允许查看。"],
    ["convert-order", "报价转订单", "确认收货地址、签约主体和订单明细。"],
    ["order-revision", "订单修订", "退回后从产品目录重新选择模块并重新提交。"],
    ["order-revision-review", "回退修订审批", "批准后同步更新原报价和订单，驳回后恢复原审批节点。"],
    ["pricing-editor", "模块价格规则", "维护阶梯价、渠道价格比例和区域价格覆盖。"],
    ["approval-detail", "审批详情与驳回", "查看业务上下文、审批意见和历史记录。"],
    ["import-center", "批量导入", "下载模板、上传文件、预检和结果下载。"],
    ["product-picker", "产品选择器", "按分类、产品线和关键词选择模块或硬件。"],
    ["permission-audit", "权限差异检查", "识别角色、数据范围和用户级覆盖的差异。"],
    ["order-detail", "订单详情抽屉", "展示订单审批链、业务上下文、当前可执行动作和 SLA。"],
    ["member-cert", "成员证书维护", "证书授权与业务角色、系统权限分离维护。"],
    ["region-filter", "超管区域筛选", "超级管理员按区域过滤客户、商机、报价和订单。"],
  ];
  return `${pageHead("窗口与状态", "所有详情、审批、导入、状态变化和高风险动作的窗口规范。", `<button type="button" class="button primary" data-modal="state-gallery">${icon("layers")} 查看状态全集</button>`)}${panel("关键窗口", "点击卡片查看可交互效果。", `<div class="screen-grid">${cards.map(([modal, title, desc], index) => `<button type="button" class="screen-link" data-modal="${modal}"><span class="screen-no">WIN ${String(index + 1).padStart(2, "0")}</span><strong>${title}</strong><p>${desc}</p></button>`).join("")}</div>`)}${panel("通用状态反馈", "加载、空状态、错误、无权限、冲突和成功反馈。", `<div class="grid-3"><div class="empty-state callout"><div><strong>暂无数据</strong><span>保留筛选条件并提供创建入口</span></div></div><div class="empty-state callout warning"><div><strong>加载失败</strong><span>显示中文原因和重试按钮</span></div></div><div class="empty-state callout"><div><strong>无访问权限</strong><span>解释角色和数据范围，不暴露对象详情</span></div></div></div>`)}`;
}

function renderScreen() {
  switch (state.screen) {
    case "overview":
      return renderOverview();
    case "design-system":
      return renderDesignSystem();
    case "windows":
      return renderWindows();
    case "business-map":
      return renderBusinessMap();
    case "business-flows":
      return renderBusinessFlows();
    case "state-machines":
      return renderStateMachines();
    case "architecture":
      return renderArchitecture();
    case "channel-members":
      return renderChannelMembers();
    case "order-actions":
      return renderOrderActions();
    case "pricing-rules":
      return renderPricingRules();
    case "dashboard":
      return renderDashboard();
    case "customers":
      return renderCustomers();
    case "customer-new":
      return renderCustomerNew();
    case "customer-followup":
      return renderCustomerFollowup();
    case "opportunities":
      return renderOpportunities();
    case "opportunity-new":
      return renderOpportunityNew();
    case "quotes":
      return renderQuotes();
    case "quote-new":
      return renderQuoteNew();
    case "orders":
      return renderOrders();
    case "channels":
      return renderChannels();
    case "products":
      return renderProducts();
    case "approvals":
      return renderApprovals();
    case "messages":
      return renderMessages();
    case "organization":
      return renderOrganization();
    case "roles":
      return renderRoles();
    case "openapi":
      return renderOpenApi();
    case "audit-system":
      return renderAuditSystem();
    case "partner-dashboard":
      return renderPartnerDashboard();
    case "mobile":
      return renderMobile();
    case "extensions":
      return renderExtensionsHub();
    case "admin-settings":
      return renderAdminSettings();
    case "auth-flows":
      return renderAuthFlows();
    case "mobile-full":
      return renderMobileFull();
    case "partner-report":
    case "channel-profile":
    case "certificate-management":
    case "message-platform":
    case "message-rules":
    case "account-management":
    case "organization-admin":
    case "product-admin":
    case "workload-config":
    case "import-export":
    case "quote-actions":
    case "audit-operations":
      return renderExtendedWorkspace(state.screen);
    default:
      return renderOverview();
  }
}

function modalShell(title, desc, body, footer = "", variant = "") {
  return `<div class="overlay"><section class="modal ${variant}"><header class="modal-head"><div><strong>${title}</strong>${desc ? `<p>${desc}</p>` : ""}</div><button type="button" class="icon-button" data-close>×</button></header><div class="modal-body">${body}</div>${footer ? `<footer class="modal-foot">${footer}</footer>` : ""}</section></div>`;
}

function drawerShell(title, desc, body, footer = "") {
  return `<div class="drawer-overlay"></div><aside class="drawer"><header class="drawer-head"><div><strong>${title}</strong>${desc ? `<p class="record-meta">${desc}</p>` : ""}</div><button type="button" class="icon-button" data-close>×</button></header><div class="drawer-body">${body}</div>${footer ? `<footer class="modal-foot">${footer}</footer>` : ""}</aside>`;
}

function orderActionOverlay(kind) {
  const foot = `<button type="button" class="button" data-close>取消</button><button type="button" class="button primary" data-toast="订单动作已提交，服务端将按当前状态和角色再次校验。">确认提交</button>`;
  const orderSummary = `<div class="order-approval-summary"><div><span>订单编号</span><strong>SO202609150018</strong></div><div><span>来源报价</span><strong>QT202609160028 · V2</strong></div><div><span>商品项</span><strong>3 项</strong></div><div><span>合同金额</span><strong>¥ 328,600.00</strong></div></div><div class="callout" style="margin-top:10px">终端安全管理 1,200 点 · 数据防泄漏 1,200 点 · 微盾安全网关 1 台</div><div style="height:12px"></div>`;
  if (kind === "order-primary-confirm")
    return modalShell(
      "一级分销商确认订单",
      "确认后订单进入区管审批节点。",
      `${orderSummary}<div class="callout success">确认当前产品模块、数量和订单金额无误。</div>`,
      foot,
    );
  if (kind === "order-primary-reject")
    return modalShell(
      "一级分销商驳回订单",
      "驳回后必须选择退回二级渠道商修改。",
      `${orderSummary}<div class="form-grid"><div class="form-field"><label class="form-label required">退回目标</label><div class="form-control readonly">二级渠道商</div></div><div class="form-field full"><label class="form-label required">驳回原因</label><div class="form-control textarea">产品数量与采购清单不一致，请修正后重新提交。</div></div></div>`,
      `<button type="button" class="button" data-close>取消</button><button type="button" class="button danger" data-toast="订单已驳回并退回二级渠道商。">确认驳回</button>`,
    );
  if (kind === "order-region-confirm")
    return modalShell(
      "区管确认订单",
      "区管确认后进入超管确认或后续履约节点。",
      `${orderSummary}<div class="callout success">一级渠道已确认，订单金额和产品明细已完成复核。</div>`,
      foot,
    );
  if (kind === "order-region-price")
    return modalShell(
      "区管调整订单价格",
      "调价后必须提交超管确认，并保留原报价和订单金额快照。",
      `${orderSummary}<div class="form-grid"><div class="form-field"><label class="form-label">调整前金额</label><div class="form-control readonly">¥ 328,600.00</div></div><div class="form-field"><label class="form-label required">调整后金额</label><div class="form-control">¥ 318,600.00</div></div><div class="form-field full"><label class="form-label required">调价原因</label><div class="form-control textarea">按区域商务政策调整渠道结算金额。</div></div></div>`,
      foot,
    );
  if (kind === "order-superadmin-confirm")
    return modalShell(
      "超级管理员确认订单",
      "确认订单后进入履约，并触发报价收益冻结任务。",
      `${orderSummary}<div class="callout warning">确认后订单金额不再修改；如金额有误，请选择退回相关节点。</div>`,
      foot,
    );
  if (kind === "order-superadmin-return")
    return modalShell(
      "超级管理员退回订单",
      "明确退回区管、一级渠道商或二级渠道商。",
      `${orderSummary}<div class="region-options">${[
        ["退回区管", "由区管重新审核或调价"],
        ["退回一级渠道商", "由一级渠道商重新确认"],
        ["退回二级渠道商", "由二级渠道商修改模块和数量"],
      ]
        .map(
          ([title, desc], index) =>
            `<button type="button" class="region-option ${index === 0 ? "active" : ""}"><strong>${title}</strong><span>${desc}</span></button>`,
        )
        .join(
          "",
        )}</div><div style="height:12px"></div><div class="form-control textarea">请填写退回原因和需要修改的内容。</div>`,
      `<button type="button" class="button" data-close>取消</button><button type="button" class="button danger" data-toast="订单已按所选目标退回。">确认退回</button>`,
    );
  if (kind === "order-revision-review")
    return modalShell(
      "回退修改审批",
      "批准后同步更新原报价和原订单，并重新进入审批链；驳回后恢复原审批节点。",
      `${orderSummary}<div class="form-control textarea">可填写审核意见；驳回时原因必填。</div>`,
      `<button type="button" class="button danger" data-toast="回退修改已驳回，订单恢复原审批节点。">驳回申请</button><button type="button" class="button primary" data-toast="回退修改已批准，报价和订单已同步更新。">批准并重新进入审批</button>`,
    );
  if (kind === "order-resubmit")
    return modalShell(
      "修改订单并重新提交",
      "产品模块必须从产品目录选择，数量可修改，系统单价由报价规则计算。",
      `<div class="callout">来源报价 QT202609160028 · V2 · 修改后将同步更新原报价并重新进入审批链</div><div style="height:10px"></div>${table(
        ["产品 / 模块", "数量", "系统单价", "小计"],
        [
          ["终端安全管理", "1,200", "¥ 280.00", "¥ 336,000.00"],
          ["数据防泄漏", "1,200", "¥ 80.00", "¥ 96,000.00"],
          ["微盾安全网关", "1", "¥ 40,000.00", "¥ 40,000.00"],
        ]
          .map(
            (row) =>
              `<tr><td><span class="record-title">${row[0]}</span></td><td><div class="form-control">${row[1]}</div></td><td class="amount">${row[2]}</td><td class="amount">${row[3]}</td></tr>`,
          )
          .join(""),
      )}<div style="height:10px"></div><button type="button" class="button" data-modal="product-picker">${icon("box")} 从产品目录新增模块</button>`,
      foot,
    );
  if (kind === "order-fulfillment")
    return modalShell(
      "订单履约动作",
      "按当前履约状态显示发货、完成或取消动作。",
      `${orderSummary}<div class="grid-3"><button type="button" class="region-option"><strong>确认发货</strong><span>登记物流和发货时间</span></button><button type="button" class="region-option"><strong>完成订单</strong><span>确认交付和归档</span></button><button type="button" class="region-option"><strong>取消订单</strong><span>取消后保留历史记录</span></button></div>`,
      foot,
    );
  return "";
}

function overlayContent(kind) {
  const commonFoot = `<button type="button" class="button" data-close>取消</button><button type="button" class="button primary" data-toast="操作已提交，业务状态将在服务端校验后更新。">确认</button>`;
  if (kind.startsWith("extended-")) {
    const key = kind.slice("extended-".length);
    const capability = extendedCapabilityMap[key];
    if (!capability) return "";
    const body =
      key === "auth-flows"
        ? renderAuthFlows()
        : key === "mobile-full"
          ? renderMobileFull()
          : renderExtendedWorkspace(key);
    return modalShell(
      capability.title,
      capability.desc,
      `<div class="extended-modal-body">${body}</div>`,
      `<button type="button" class="button" data-close>关闭</button><button type="button" class="button primary" data-nav="${capability.parent}">前往对应业务页</button>`,
      "wide",
    );
  }
  if (kind.startsWith("order-") && !["order-detail", "order-revision"].includes(kind)) {
    return orderActionOverlay(kind);
  }
  switch (kind) {
    case "auth-login":
      return modalShell(
        "统一登录与入口分流",
        "根路径 / 根据登录态、账号类型和访问设备决定正式页面落点。",
        `<div class="auth-stage"><div class="auth-browser-card"><span class="auth-badge">统一入口</span><strong>联软渠道管理平台</strong><p>账号密码、IAM 和 UniSDP 共用同一入口。</p><div class="form-grid"><div class="form-field full"><label class="form-label required">账号</label><div class="form-control">liulonghai</div></div><div class="form-field full"><label class="form-label required">密码</label><div class="form-control">••••••••••••</div></div></div><button type="button" class="button primary full" data-toast="登录成功，正在按账号类型和设备跳转正式页面。">登录</button><div class="auth-links"><button type="button" class="link" data-modal="auth-sso">IAM / UniSDP 单点登录</button><button type="button" class="link">忘记密码</button></div></div><div class="auth-route-list">${[
          ["未登录", "/login"],
          ["管理员桌面端", "/admin.html"],
          ["管理员移动端", "/admin-mobile.html"],
          ["渠道桌面端", "/partner.html"],
          ["渠道移动端", "/partner-mobile.html"],
        ]
          .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
          .join("")}</div></div>`,
        `<button type="button" class="button" data-close>关闭</button><button type="button" class="button primary" data-modal="auth-login">查看登录页</button>`,
      );
    case "auth-sso":
      return modalShell(
        "IAM / UniSDP 单点登录",
        "单点登录失败时必须回退到统一登录页，并保留安全 redirect 参数。",
        `<div class="grid-3"><button type="button" class="region-option"><strong>IAM 登录</strong><span>PC IAM 与移动端统一识别</span></button><button type="button" class="region-option"><strong>UniSDP 登录</strong><span>企业身份单点登录</span></button><button type="button" class="region-option"><strong>本地登录</strong><span>SSO 不可用时回退</span></button></div><div class="callout success" style="margin-top:12px">IAM 配置接口返回 enabled:true，并包含 entries、requestIsaidByEntry 和 timeoutMs。</div>`,
        commonFoot,
      );
    case "change-password":
      return modalShell(
        "修改密码",
        "首次登录或主动改密必须校验旧密码，并重新建立页面会话。",
        `<div class="form-grid"><div class="form-field full"><label class="form-label required">当前密码</label><div class="form-control">••••••••••••</div></div><div class="form-field full"><label class="form-label required">新密码</label><div class="form-control">••••••••••••</div></div><div class="form-field full"><label class="form-label required">确认新密码</label><div class="form-control">••••••••••••</div></div></div><div class="callout warning" style="margin-top:12px">修改成功后，其他设备上的页面会话立即失效。</div>`,
        commonFoot,
      );
    case "session-expired":
      return modalShell(
        "会话已失效",
        "登录态过期或服务端主动注销后，不允许继续展示业务数据。",
        `<div class="empty-state callout warning"><div><strong>需要重新登录</strong><span>当前页面数据已锁定，请重新认证后继续操作。</span></div></div><div class="button-row" style="margin-top:12px"><button type="button" class="button primary" data-modal="auth-login">重新登录</button></div>`,
        `<button type="button" class="button" data-close>关闭</button>`,
      );
    case "forbidden":
      return modalShell(
        "无权限、维护与未知路由",
        "异常页不暴露对象详情、接口数据或权限差异。",
        `<div class="grid-3"><article class="record-card"><div class="record-top"><strong>403 无权限</strong>${status("提示", "red")}</div><p>说明当前角色或数据范围不足，提供返回工作台入口。</p></article><article class="record-card"><div class="record-top"><strong>系统维护</strong>${status("提示", "amber")}</div><p>展示维护窗口和预计恢复时间，不重复提交业务动作。</p></article><article class="record-card"><div class="record-top"><strong>404 未知路由</strong>${status("提示", "gray")}</div><p>保留统一入口，引导返回允许访问的正式页面。</p></article></div>`,
        `<button type="button" class="button" data-close>关闭</button><button type="button" class="button primary" data-nav="overview">返回工作台</button>`,
      );
    case "quote-send":
      return modalShell(
        "发送报价给客户",
        "发送后报价进入已发送状态，并向客户联系人和内部负责人投递通知。",
        `<div class="callout">QT202609160028 · 华南某智能制造集团 · 报价总额 ¥ 428,600.00</div><div class="form-grid" style="margin-top:12px"><div class="form-field full"><label class="form-label required">收件人</label><div class="chip-row"><span class="chip active">张明 · 主要联系人</span><span class="chip active">刘颖 · 采购联系人</span></div></div><div class="form-field full"><label class="form-label">发送内容</label><div class="form-control textarea">请查收终端安全改造项目报价单，有效期至 2026-10-16。</div></div></div>`,
        `<button type="button" class="button" data-close>取消</button><button type="button" class="button primary" data-toast="报价已发送，客户联系人与内部负责人均已收到通知。">确认发送</button>`,
      );
    case "quote-confirm":
      return modalShell(
        "确认客户接受报价",
        "确认后报价进入已确认状态，可发起转订单。",
        `<div class="callout success">QT202609160028 · 报价总额 ¥ 428,600.00 · 折扣 97%</div><div class="form-control textarea" style="margin-top:12px">客户确认报价与合同主体，可进入订单流程。</div>`,
        commonFoot,
      );
    case "quote-withdraw":
      return modalShell(
        "撤回报价",
        "撤回后客户链接失效，历史版本和发送记录保留。",
        `<div class="callout warning">确认撤回 QT202609160028？客户将无法继续查看当前链接。</div><div class="form-control textarea" style="margin-top:12px">客户要求调整产品明细，撤回后生成新版本。</div>`,
        `<button type="button" class="button" data-close>取消</button><button type="button" class="button danger" data-toast="报价已撤回，可修改后重新发送。">确认撤回</button>`,
      );
    case "quote-expire":
      return modalShell(
        "标记报价过期",
        "过期后只保留查询，不允许转订单，需重新生成报价版本。",
        `<div class="callout warning">QT202609050003 已超过有效期，确认标记为已过期。</div>`,
        commonFoot,
      );
    case "quote-delete":
      return modalShell(
        "删除报价草稿",
        "仅草稿且未发送、未转订单的报价允许删除。",
        `<div class="callout warning">删除后无法恢复，请确认该报价未关联客户确认或订单。</div>`,
        `<button type="button" class="button" data-close>取消</button><button type="button" class="button danger" data-toast="报价草稿已删除。">确认删除</button>`,
      );
    case "quote-profit":
      return modalShell(
        "报价收益预估",
        "内部成本和收益仅对授权角色展示，渠道端和 OpenAPI 不返回。",
        `${infoGrid(
          [
            ["产品合同额", "¥ 548,600.00"],
            ["硬件内部成本", "¥ 13,000.00"],
            ["其他成本", "¥ 349,180.00"],
            ["项目收益", "¥ 186,420.00"],
            ["收益率", "33.98%"],
            ["冻结状态", "待订单超管确认"],
          ],
          true,
        )}<div class="callout warning" style="margin-top:12px">当前为实时预估。订单超管确认后由 Worker 重新计算并冻结正式收益快照。</div>`,
        `<button type="button" class="button" data-close>关闭</button><button type="button" class="button primary" data-toast="已生成收益预估明细。">生成明细</button>`,
      );
    case "parent-partner-select":
      return modalShell(
        "选择一级渠道商",
        "二级渠道商报价转订单时必须明确选择一级渠道商，系统校验层级关系。",
        `<div class="list-stack">${[
          ["深圳示例数字科技有限公司", "华南区域 · 上级关系有效"],
          ["上海启辰信息技术有限公司", "华东区域 · 当前报价区域不匹配"],
          ["北京中安网络技术有限公司", "华北区域 · 当前报价区域不匹配"],
        ]
          .map(
            ([name, desc], index) =>
              `<article class="record-card ${index === 0 ? "selected" : ""}"><div class="record-top"><strong>${name}</strong>${index === 0 ? status("推荐", "green") : status("不可选", "gray")}</div><p>${desc}</p></article>`,
          )
          .join("")}</div>`,
        commonFoot,
      );
    case "certificate-template":
      return modalShell(
        "新建证书模板",
        "证书模板定义类别、有效期和续期规则，不直接授予成员。",
        `<div class="form-grid"><div class="form-field"><label class="form-label required">证书名称</label><div class="form-control">数据安全能力认证</div></div><div class="form-field"><label class="form-label required">证书类别</label><div class="form-control">技术 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label required">有效期</label><div class="form-control">2 年</div></div><div class="form-field"><label class="form-label">到期提醒</label><div class="form-control">提前 30 天 ${icon("chevron")}</div></div></div>`,
        commonFoot,
      );
    case "certificate-issue":
      return modalShell(
        "颁发证书",
        "颁发后生成持证记录，并按提醒规则进入到期任务。",
        `<div class="form-grid"><div class="form-field full"><label class="form-label required">持证人</label><div class="form-control">王卓 · 深圳示例数字科技 ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label required">证书模板</label><div class="form-control">安全交付认证 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label required">颁发日期</label><div class="form-control">2026-09-20 ${icon("calendar")}</div></div><div class="form-field"><label class="form-label required">到期日期</label><div class="form-control">2027-09-20 ${icon("calendar")}</div></div></div>`,
        commonFoot,
      );
    case "certificate-extend":
      return modalShell(
        "延期证书",
        "延期保留原持证记录，并新增有效期变更历史。",
        `<div class="callout">王卓 · 安全交付认证 · 当前到期日 2026-10-12</div><div class="form-grid" style="margin-top:12px"><div class="form-field"><label class="form-label required">新到期日</label><div class="form-control">2027-10-12 ${icon("calendar")}</div></div><div class="form-field"><label class="form-label">延期原因</label><div class="form-control">年度复审通过</div></div></div>`,
        commonFoot,
      );
    case "certificate-revoke":
      return modalShell(
        "撤销证书",
        "撤销证书不自动撤销业务角色或系统权限，但会生成权限复核任务。",
        `<div class="callout warning">撤销后将保留持证历史，并提醒管理员检查相关业务授权。</div><div class="form-control textarea" style="margin-top:12px">离职交接或资格失效原因。</div>`,
        `<button type="button" class="button" data-close>取消</button><button type="button" class="button danger" data-toast="证书已撤销，权限复核任务已生成。">确认撤销</button>`,
      );
    case "message-channel-edit":
      return modalShell(
        "编辑消息渠道",
        "敏感凭据只提交不回显；测试通过后才允许启用正式投递。",
        `<div class="form-grid"><div class="form-field"><label class="form-label required">渠道类型</label><div class="form-control">企业微信应用 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">状态</label><div class="form-control">测试中 ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label required">应用密钥</label><div class="form-control">••••••••••••••••</div></div><div class="form-field full"><label class="form-label">接收范围</label><div class="chip-row"><span class="chip active">审批待办</span><span class="chip active">业务提醒</span><span class="chip">系统通知</span></div></div></div>`,
        commonFoot,
      );
    case "message-channel-test":
      return modalShell(
        "测试发送",
        "测试消息只发送给当前管理员，不进入正式收件人队列。",
        `<div class="form-grid"><div class="form-field full"><label class="form-label required">测试渠道</label><div class="form-control">企业微信应用 ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label">测试内容</label><div class="form-control textarea">联软渠道管理平台消息通道测试，请忽略。</div></div></div>`,
        `<button type="button" class="button" data-close>取消</button><button type="button" class="button primary" data-toast="测试消息已发送，请检查当前账号企微。">发送测试</button>`,
      );
    case "message-template-edit":
      return modalShell(
        "编辑消息模板",
        "模板变量必须通过服务端白名单，不允许拼接未授权对象字段。",
        `<div class="form-grid"><div class="form-field"><label class="form-label required">模板名称</label><div class="form-control">订单待确认提醒</div></div><div class="form-field"><label class="form-label required">渠道</label><div class="form-control">站内 + 企微 ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label required">模板内容</label><div class="form-control textarea">订单 {orderNo} 等待您处理，剩余 {slaRemaining}，请及时确认。</div></div><div class="form-field full"><label class="form-label">可用变量</label><div class="chip-row"><span class="chip active">{orderNo}</span><span class="chip active">{customerName}</span><span class="chip active">{slaRemaining}</span><span class="chip">{channelName}</span></div></div></div>`,
        commonFoot,
      );
    case "message-task-create":
      return modalShell(
        "新建提醒任务",
        "任务按业务事件或定时规则生成，失败后可补偿。",
        `<div class="form-grid"><div class="form-field"><label class="form-label required">任务名称</label><div class="form-control">渠道证书到期提醒</div></div><div class="form-field"><label class="form-label required">触发方式</label><div class="form-control">到期前 30 天 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label required">收件角色</label><div class="form-control">渠道企业管理员、区域运营 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">消息模板</label><div class="form-control">证书到期提醒 ${icon("chevron")}</div></div></div>`,
        commonFoot,
      );
    case "account-archive":
      return modalShell(
        "归档账号",
        "归档后账号不能登录，但业务归属、历史记录和审计信息完整保留。",
        `<div class="callout warning">归档前必须完成客户、商机、报价、订单和待办交接。</div>${infoGrid(
          [
            ["账号", "chenxy"],
            ["姓名", "陈晓宇"],
            ["待交接客户", "8 家"],
            ["待交接商机", "3 条"],
          ],
        )}`,
        `<button type="button" class="button" data-close>取消</button><button type="button" class="button danger" data-modal="account-merge">先执行离职交接</button>`,
      );
    case "account-merge":
      return modalShell(
        "账号归并与离职交接",
        "待办、客户归属、商机负责人和订单协作关系迁移到接收账号。",
        `<div class="form-grid"><div class="form-field full"><label class="form-label required">原账号</label><div class="form-control readonly">陈晓宇 · chenxy</div></div><div class="form-field full"><label class="form-label required">接收账号</label><div class="form-control">张明 · zhangm ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label">迁移范围</label><div class="chip-row"><span class="chip active">客户归属</span><span class="chip active">商机负责人</span><span class="chip active">待办</span><span class="chip active">订单协作</span></div></div></div>`,
        commonFoot,
      );
    case "account-restore":
      return modalShell(
        "恢复归档账号",
        "恢复后需重新校验账号状态、角色、数据范围和外部身份。",
        `<div class="callout">陈晓宇 · chenxy · 归档于 2026-09-01</div><div class="form-grid" style="margin-top:12px"><div class="form-field"><label class="form-label required">恢复后的状态</label><div class="form-control">启用 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">数据范围</label><div class="form-control">华南大区 ${icon("chevron")}</div></div></div>`,
        commonFoot,
      );
    case "org-unit-edit":
      return modalShell(
        "编辑组织单元",
        "内部组织与渠道组织分域维护，岗位和任职关系变化写入审计。",
        `<div class="form-grid"><div class="form-field"><label class="form-label required">组织名称</label><div class="form-control">安全服务部</div></div><div class="form-field"><label class="form-label required">父级组织</label><div class="form-control">华南大区 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">负责人</label><div class="form-control">周宁 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">数据范围</label><div class="form-control">本组织及子组织 ${icon("chevron")}</div></div></div>`,
        commonFoot,
      );
    case "product-category":
      return modalShell(
        "新增产品大类",
        "大类用于组织模块、功能、硬件和套餐，不直接参与报价。",
        `<div class="form-grid"><div class="form-field required"><label class="form-label required">大类名称</label><div class="form-control">安全服务</div></div><div class="form-field"><label class="form-label required">产品类型</label><div class="form-control">服务 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">排序</label><div class="form-control">50</div></div><div class="form-field"><label class="form-label">状态</label><div class="form-control">启用 ${icon("chevron")}</div></div></div>`,
        commonFoot,
      );
    case "product-feature":
      return modalShell(
        "新建产品功能",
        "产品价格、工作量和成本规则分开维护，最终由服务端报价试算命中。",
        `<div class="form-grid"><div class="form-field"><label class="form-label required">产品名称</label><div class="form-control">安全运营中心</div></div><div class="form-field"><label class="form-label required">产品类型</label><div class="form-control">软件功能 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">标准单价</label><div class="form-control">¥ 260 / 点</div></div><div class="form-field"><label class="form-label">工作量规则</label><div class="form-control">8 人天 ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label">状态</label><div class="form-control">草稿 ${icon("chevron")}</div></div></div>`,
        commonFoot,
      );
    case "product-package":
      return modalShell(
        "新建产品套餐",
        "套餐由已发布功能组成，价格至少包含公开价和内部成本两部分。",
        `<div class="form-grid"><div class="form-field"><label class="form-label required">套餐名称</label><div class="form-control">终端安全增强套餐</div></div><div class="form-field"><label class="form-label required">产品线</label><div class="form-control">微盾 ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label required">包含功能</label><div class="chip-row"><span class="chip active">终端安全管理</span><span class="chip active">数据防泄漏</span><span class="chip active">终端准入控制</span><span class="chip">安全运维</span></div></div><div class="form-field"><label class="form-label required">套餐价格</label><div class="form-control">¥ 428,000</div></div><div class="form-field"><label class="form-label">内部成本</label><div class="form-control">¥ 320,000</div></div></div>`,
        commonFoot,
      );
    case "workload-rule-edit":
      return modalShell(
        "编辑工作量规则",
        "交付工作量按产品映射、数量范围和特殊比例组合计算。",
        `${table(
          ["规则类型", "适用产品", "数量范围", "工作量", "状态"],
          [
            ["人天规则", "终端安全管理", "1-99", "5 人天", status("启用", "green")],
            ["人天规则", "终端安全管理", "100-499", "12 人天", status("启用", "green")],
            ["人天规则", "终端安全管理", "500+", "24 人天", status("启用", "green")],
          ]
            .map(
              (row) =>
                `<tr><td>${row[0]}</td><td><span class="record-title">${row[1]}</span></td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td></tr>`,
            )
            .join(""),
        )}`,
        commonFoot,
      );
    case "export-scope":
      return modalShell(
        "新建导出任务",
        "导出范围不得突破当前账号数据权限，敏感字段按规则脱敏。",
        `<div class="form-grid"><div class="form-field"><label class="form-label required">导出对象</label><div class="form-control">客户主档 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label required">导出范围</label><div class="form-control">当前筛选结果 ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label">字段</label><div class="chip-row"><span class="chip active">客户名称</span><span class="chip active">负责人</span><span class="chip active">区域</span><span class="chip">手机号（脱敏）</span></div></div></div><div class="callout success" style="margin-top:12px">预计 1,286 行，文件生成后可下载 7 天。</div>`,
        commonFoot,
      );
    case "log-detail":
      return drawerShell(
        "审计日志详情",
        "2026-09-20 09:42:16 · 刘管理员 · 审核客户报备",
        `${infoGrid(
          [
            ["操作对象", "华南某智能制造集团"],
            ["业务编号", "CU202609150021"],
            ["来源 IP", "10.20.1.18"],
            ["请求标识", "req_01J8X2K9"],
            ["结果", "成功"],
            ["耗时", "182 ms"],
          ],
          true,
        )}<div style="height:12px"></div><div class="note-box">请求前状态：待审核；请求后状态：已通过。归属渠道、保护期和客户主体校验均通过。</div>`,
        `<button type="button" class="button" data-close>关闭</button>`,
      );
    case "task-retry":
      return modalShell(
        "重试失败任务",
        "重试按原任务幂等键执行，不重复生成业务数据。",
        `<div class="callout warning">订单预审 · OA 超时 · 已重试 2 次。确认后立即执行补偿。</div>`,
        `<button type="button" class="button" data-close>取消</button><button type="button" class="button primary" data-toast="任务已进入重试队列。">确认重试</button>`,
      );
    case "restore-confirm":
      return modalShell(
        "开始恢复演练",
        "恢复演练使用独立临时目录，禁止覆盖当前生产数据。",
        `<div class="grid-3"><div class="callout"><strong>备份选择</strong><br />今天 03:00 本机全量</div><div class="callout"><strong>校验</strong><br />SHA256 + 数据表行数</div><div class="callout warning"><strong>隔离环境</strong><br />临时实例端口 15432</div></div>`,
        `<button type="button" class="button" data-close>取消</button><button type="button" class="button primary" data-toast="恢复演练已启动，结果会写入运维记录。">开始演练</button>`,
      );
    case "collect-diagnostics":
      return modalShell(
        "下载诊断报告",
        "诊断报告不包含密码、密钥和客户敏感字段。",
        `<div class="spec-list"><div class="spec-item"><strong>服务健康</strong><span>API、PostgreSQL、Redis、Worker</span></div><div class="spec-item"><strong>配置检查</strong><span>只输出键名和是否配置</span></div><div class="spec-item"><strong>任务摘要</strong><span>失败数量、重试次数和错误码</span></div><div class="spec-item"><strong>脱敏</strong><span>客户名称、手机号、邮箱和密钥</span></div></div>`,
        `<button type="button" class="button" data-close>取消</button><button type="button" class="button primary" data-toast="诊断报告已生成。">确认下载</button>`,
      );
    case "customer-detail":
      return drawerShell(
        "华南某智能制造集团",
        "CU202609150021 · 保护期内 · 华南区域",
        `${infoGrid(
          [
            ["统一社会信用代码", "91440300MA5F8X2D7Q"],
            ["所属行业", "制造业"],
            ["归属渠道", "深圳示例数字科技有限公司"],
            ["负责人", "张明"],
            ["保护期至", "2026-12-14"],
            ["预计金额", "¥ 42.8 万"],
          ],
          true,
        )}<div style="height:12px"></div>${panel("客户健康度", "综合评分 86", `<div class="progress-list">${progress("资料完整度", 100)}${progress("跟进连续度", 82)}${progress("商机推进度", 68)}</div>`)}${panel("最近跟进", "2 条", `<div class="timeline"><div class="timeline-item"><i class="timeline-dot"></i><div><strong>电话 · 预算与项目范围确认</strong><p>客户确认一期预算约 42.8 万。</p></div><time>今天 09:18</time></div><div class="timeline-item"><i class="timeline-dot"></i><div><strong>拜访 · 现有资产与安全需求</strong><p>完成终端资产梳理，技术负责人支持立项。</p></div><time>09-12 15:40</time></div></div>`)}`,
        `<button type="button" class="button" data-modal="followup-form">记录跟进</button><button type="button" class="button primary" data-nav="opportunities">查看商机</button>`,
      );
    case "customer-editor":
      return modalShell(
        "编辑客户档案",
        "客户主档、联系人、归属、保护期和业务资料；客户编号、创建时间和历史业务不可修改。",
        `<div class="form-grid"><div class="form-field full"><label class="form-label required">客户名称（工商全称）</label><div class="form-control">华南某智能制造集团股份有限公司</div></div><div class="form-field required"><label class="form-label required">统一社会信用代码</label><div class="form-control readonly">91440300MA5F8X2D7Q</div></div><div class="form-field"><label class="form-label required">所属行业</label><div class="form-control">制造业 / 智能制造 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">客户等级</label><div class="form-control">重点客户 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">经营状态</label><div class="form-control readonly">存续</div></div><div class="form-field"><label class="form-label">所属区域</label><div class="form-control readonly">华南区域 / 广东省</div></div><div class="form-field"><label class="form-label">归属渠道</label><div class="form-control readonly">深圳示例数字科技有限公司</div></div><div class="form-field"><label class="form-label">客户负责人</label><div class="form-control">张明 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">保护期至</label><div class="form-control">2026-12-14 ${icon("calendar")}</div></div><div class="form-field"><label class="form-label">主要联系人</label><div class="form-control">张明</div></div><div class="form-field"><label class="form-label">联系电话</label><div class="form-control">138****6621</div></div><div class="form-field"><label class="form-label">邮箱</label><div class="form-control">zhangming@example.com</div></div><div class="form-field"><label class="form-label">客户来源</label><div class="form-control">渠道自主报备 ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label">注册地址</label><div class="form-control">广东省深圳市南山区科技园示例路 88 号 A 栋 12 层</div></div><div class="form-field full"><label class="form-label">备注</label><div class="form-control textarea">重点客户，项目预算已进入客户内部审批流程。</div></div></div>`,
        commonFoot,
      );
    case "followup-form":
      return modalShell(
        "记录商机跟进",
        "记录写入关联商机的跟进行为，并在客户跟进视图和商机时间线中汇总展示。",
        `<div class="form-grid"><div class="form-field full"><label class="form-label required">关联商机</label><div class="form-control">终端安全改造项目 · 方案确认 ${icon("chevron")}</div><div class="helper">客户存在多个商机时必须明确选择，避免跟进记录归属错误。</div></div><div class="form-field"><label class="form-label">当前阶段</label><div class="form-control readonly">方案确认</div></div><div class="form-field"><label class="form-label required">跟进后阶段</label><div class="form-control">商务谈判 ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label required">跟进方式</label>${segment(
          "followup-type",
          [
            ["phone", "电话"],
            ["visit", "拜访"],
            ["meeting", "会议"],
            ["email", "邮件"],
          ],
        )}</div><div class="form-field full"><label class="form-label required">跟进内容</label><div class="form-control textarea">记录沟通对象、客户诉求、承诺事项和下一次跟进计划。</div></div><div class="form-field"><label class="form-label">下一步动作</label><div class="form-control">提交技术与实施方案 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">下次跟进</label><div class="form-control">2026-09-19 10:00 ${icon("calendar")}</div></div><div class="form-field full"><label class="form-label">提醒</label><div class="callout success">已开启：提前 30 分钟通知商机负责人。</div></div></div>`,
        commonFoot,
      );
    case "followup-plan":
      return modalShell(
        "客户跟进计划",
        "按本周、未来 30 天和逾期客户组织跟进节奏。",
        `<div class="grid-3"><div class="callout"><strong>今天</strong><br />18 项</div><div class="callout warning"><strong>逾期</strong><br />5 项</div><div class="callout"><strong>未来 7 天</strong><br />34 项</div></div><div style="height:12px"></div>${table(
          ["客户", "下一步动作", "负责人", "计划时间"],
          [
            ["华南某智能制造集团", "提交技术方案", "张明", "今天 10:30"],
            ["华东某商业银行", "确认报价", "陈佳", "已逾期"],
            ["某省级政务服务中心", "方案交流", "周宁", "今天 14:00"],
          ]
            .map(
              (row) =>
                `<tr><td><span class="record-title">${row[0]}</span></td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td></tr>`,
            )
            .join(""),
        )}`,
        `<button type="button" class="button" data-close>关闭</button>`,
      );
    case "opportunity-detail":
      return drawerShell(
        "终端安全改造项目",
        "OP202609150031 · 方案确认 · 赢单概率 65%",
        `${flow(["客户建联", "客户方案", "需求挖掘", "POC 试用", "立项推进", "招投标", "成单交接"], 2, 3)}<div style="height:14px"></div>${panel(
          "商机信息",
          "业务事实",
          infoGrid(
            [
              ["客户", "华南某智能制造集团"],
              ["预计金额", "¥ 42.8 万"],
              ["端点规模", "1,200 台"],
              ["负责人", "张明"],
              ["预计成交", "2026-10-18"],
              ["关联报价", "QT202609160028"],
            ],
            true,
          ),
        )}${panel("最近跟进", "按时间倒序", `<div class="callout">客户确认预算和终端规模，下一步需要完成技术方案评审。</div>`)}`,
        `<button type="button" class="button" data-modal="followup-form">${icon("message")} 记录跟进</button><button type="button" class="button primary" data-nav="quote-new">转报价</button>`,
      );
    case "opportunity-advance":
      return modalShell(
        "记录商机跟进",
        "填写跟进内容时同步更新商机阶段、赢单概率和预计成交时间。",
        `<div class="form-grid"><div class="form-field"><label class="form-label">当前阶段</label><div class="form-control readonly">方案确认</div></div><div class="form-field"><label class="form-label required">推进至</label><div class="form-control">商务谈判 ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label required">跟进内容</label><div class="form-control textarea">客户完成方案评审，计划进入商务报价和采购流程。</div></div><div class="form-field"><label class="form-label">赢单概率</label><div class="form-control">80%</div></div><div class="form-field"><label class="form-label">预计成交</label><div class="form-control">2026-10-18 ${icon("calendar")}</div></div></div>`,
        commonFoot,
      );
    case "quote-detail":
      return drawerShell(
        "报价单 QT202609160028",
        "华南某智能制造集团 · 待客户确认 · 有效期至 2026-10-16",
        `${infoGrid(
          [
            ["关联商机", "终端安全改造项目"],
            ["端点数量", "1,200 点"],
            ["报价总额", "¥ 428,600.00"],
            ["组合折扣", "97%"],
            ["价格版本", "2026-09"],
            ["负责人", "张明"],
          ],
          true,
        )}<div style="height:12px"></div>${panel(
          "产品明细",
          "软件、硬件和服务分项展示",
          table(
            ["产品", "类型", "数量", "小计"],
            [
              ["终端安全管理", "软件", "1,200 点", "¥ 320,000.00"],
              ["数据防泄漏", "软件", "1,200 点", "¥ 68,600.00"],
              ["微盾安全网关", "硬件", "1 台", "¥ 40,000.00"],
            ]
              .map(
                (row) =>
                  `<tr><td><span class="record-title">${row[0]}</span></td><td>${row[1]}</td><td>${row[2]}</td><td class="amount">${row[3]}</td></tr>`,
              )
              .join(""),
          ),
        )}`,
        `<button type="button" class="button" data-nav="quote-new">${icon("edit")} 修改报价</button><button type="button" class="button" data-modal="convert-order">${icon("cart")} 转订单</button>`,
      );
    case "convert-order":
      return modalShell(
        "报价转订单",
        "将校验报价状态、重复转单、渠道归属和收货信息。",
        `<div class="form-grid"><div class="form-field"><label class="form-label">报价单</label><div class="form-control readonly">QT202609160028</div></div><div class="form-field"><label class="form-label">客户</label><div class="form-control readonly">华南某智能制造集团</div></div><div class="form-field full"><label class="form-label required">收货地址</label><div class="form-control textarea">广东省深圳市南山区科技园示例路 88 号 A 栋 12 层</div></div><div class="form-field"><label class="form-label">签约主体</label><div class="form-control">深圳示例数字科技有限公司 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">订单金额</label><div class="form-control readonly">¥ 428,600.00</div></div></div><div class="callout warning" style="margin-top:12px">系统检测到该报价尚未转单。确认后将生成订单并进入商务审核。</div>`,
        commonFoot,
      );
    case "order-detail":
      return drawerShell(
        "订单 SO202609150018",
        "华南某大型制造企业 · 待一级确认 · SLA 剩余 18 小时",
        `${flow(["订单提交", "一级确认", "区管确认", "超管确认", "履约交付"], 1, 1)}<div style="height:14px"></div>${infoGrid(
          [
            ["关联报价", "QT202609160028"],
            ["合同金额", "¥ 328,600.00"],
            ["渠道商", "深圳示例数字科技"],
            ["负责人", "张明"],
            ["收货地址", "广东省深圳市南山区"],
            ["产品明细", "终端安全 1,200 点"],
          ],
          true,
        )}<div style="height:12px"></div>${panel(
          "报价来源",
          "订单只读引用原报价快照，修改必须走回退修订",
          `${infoGrid(
            [
              ["报价单号", "QT202609160028"],
              ["报价版本", "V2"],
              ["客户确认时间", "2026-09-17 16:40"],
              ["价格版本", "2026-09"],
              ["组合折扣", "97%"],
              ["冻结状态", "已冻结"],
            ],
            true,
          )}<div class="button-row" style="margin-top:10px"><button type="button" class="button" data-modal="quote-detail">${icon("eye")} 查看原报价</button><button type="button" class="button" data-modal="order-revision">${icon("edit")} 申请回退修订</button></div>`,
        )}${panel(
          "商品与价格快照",
          "3 项商品 · 合同金额 ¥ 328,600.00 · 订单确认后只读",
          table(
            ["产品 / 模块", "类型", "数量", "报价单价", "订单单价", "差异"],
            [
              ["终端安全管理", "软件", "1,200 点", "¥ 280.00", "¥ 270.00", "-¥ 10.00"],
              ["数据防泄漏", "软件", "1,200 点", "¥ 80.00", "¥ 80.00", "¥ 0.00"],
              ["微盾安全网关", "硬件", "1 台", "¥ 40,000.00", "¥ 40,000.00", "¥ 0.00"],
            ]
              .map(
                (row) =>
                  `<tr><td><span class="record-title">${row[0]}</span></td><td>${row[1]}</td><td>${row[2]}</td><td class="amount">${row[3]}</td><td class="amount">${row[4]}</td><td class="amount ${row[5].startsWith("-") ? "order-diff" : ""}">${row[5]}</td></tr>`,
              )
              .join(""),
          ),
        )}${panel(
          "审批历史",
          "当前第 1 审批轮次",
          `<div class="timeline"><div class="timeline-item"><i class="timeline-dot"></i><div><strong>订单提交</strong><p>由报价 QT202609160028 转入，商品与金额快照已生成。</p></div><time>今天 10:28</time></div><div class="timeline-item"><i class="timeline-dot"></i><div><strong>进入一级确认</strong><p>等待一级分销商核对商品、数量和金额。</p></div><time>今天 10:31</time></div></div>`,
        )}<div style="height:12px"></div>${panel("当前可执行动作", "仅显示当前状态和当前角色允许的动作", `<div class="button-row"><button type="button" class="button" data-modal="order-revision">申请回退修订</button><button type="button" class="button danger" data-modal="order-primary-reject">驳回并退回二级</button><button type="button" class="button primary" data-modal="order-primary-confirm">一级确认订单</button></div>`)}`,
      );
    case "order-revision":
      return modalShell(
        "订单回退修订",
        "退回后只能从产品目录选择模块，单价由系统规则计算。",
        `<div class="callout">来源报价 QT202609160028 · V2 · 修订批准后同步更新原报价和原订单</div><div style="height:10px"></div>${table(
          ["产品 / 模块", "数量", "系统单价", "小计"],
          [
            ["终端安全管理", "1,200", "¥ 280.00", "¥ 336,000.00"],
            ["数据防泄漏", "1,200", "¥ 80.00", "¥ 96,000.00"],
            ["微盾安全网关", "1", "¥ 40,000.00", "¥ 40,000.00"],
          ]
            .map(
              (row) =>
                `<tr><td><span class="record-title">${row[0]}</span></td><td><div class="form-control">${row[1]}</div></td><td class="amount">${row[2]}</td><td class="amount">${row[3]}</td></tr>`,
            )
            .join(""),
        )}<div style="height:10px"></div><button type="button" class="button" data-modal="product-picker">${icon("box")} 从产品目录新增模块</button><div class="callout warning" style="margin-top:12px">订单总额 ¥ 472,000.00，重新提交后将按审批轮次进入下一节点。</div>`,
        commonFoot,
      );
    case "approval-detail":
      return modalShell(
        "审批详情",
        "审核动作必须记录意见，并更新业务状态和审计日志。",
        `<div class="grid-2"><section>${infoGrid([
          ["审批类型", "客户报备"],
          ["业务对象", "华南某智能制造集团"],
          ["申请人", "张明"],
          ["提交时间", "今天 09:32"],
        ])}</section><section>${status("待审核", "amber")}<div class="callout" style="margin-top:10px">客户名称、信用代码和归属渠道已通过系统校验。</div></section></div><div style="height:12px"></div>${panel("审批意见", "通过可选填，驳回必填", `<div class="form-control textarea">补充审批意见或驳回原因。</div>`)}`,
        `<button type="button" class="button" data-close>取消</button><button type="button" class="button danger" data-modal="reject-order">驳回</button><button type="button" class="button primary" data-toast="审批已通过，业务状态已更新。">通过</button>`,
      );
    case "reject-order":
      return modalShell(
        "驳回并退回修改",
        "明确退回节点，原因将写入业务历史和审计日志。",
        `<div class="form-grid"><div class="form-field"><label class="form-label required">退回层级</label><div class="form-control">退回一级渠道商修改 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">订单</label><div class="form-control readonly">SO202609150018</div></div><div class="form-field full"><label class="form-label required">驳回原因</label><div class="form-control textarea">产品明细与合同附件不一致，请修正后重新提交。</div></div></div>`,
        commonFoot,
      );
    case "import-center":
      return modalShell(
        "批量导入",
        "先下载模板，再上传文件进行预检；预检失败不会写入正式业务表。",
        `<div class="grid-3"><article class="record-card"><div class="record-top"><strong>1. 下载模板</strong></div><p>按业务类型下载当前字段模板。</p><button type="button" class="button small">${icon("download")} 下载</button></article><article class="record-card selected"><div class="record-top"><strong>2. 上传文件</strong></div><p>支持 XLSX，单文件不超过 10 MB。</p><button type="button" class="button small primary">${icon("upload")} 选择文件</button></article><article class="record-card"><div class="record-top"><strong>3. 预检执行</strong>${status("待执行", "gray")}</div><p>校验必填项、重复数据、编号和权限范围。</p></article></div><div class="callout success" style="margin-top:12px">已选择“客户报备导入.xlsx”，共 126 行，等待预检。</div>`,
        commonFoot,
      );
    case "product-picker":
      return modalShell(
        "从产品目录选择模块",
        "产品名称不可手工修改，单价和工作量由服务端计算。",
        `${toolbar(
          `<div class="field search">${icon("search")}<input placeholder="检索产品或模块" /></div>`,
          `${segment("product-picker", [
            ["all", "全部"],
            ["software", "软件"],
            ["hardware", "硬件"],
            ["package", "套餐"],
          ])}`,
        )}<div class="grid-3"><article class="record-card selected"><div class="record-top"><strong>终端安全管理</strong>${status("已选择", "green")}</div><p>软件模块 · ¥ 280 / 点 · 12 项工作量</p></article><article class="record-card"><div class="record-top"><strong>数据防泄漏</strong>${status("可选", "gray")}</div><p>软件模块 · ¥ 80 / 点 · 8 项工作量</p></article><article class="record-card"><div class="record-top"><strong>微盾安全网关</strong>${status("可选", "gray")}</div><p>硬件产品 · ¥ 40,000 / 台 · 成本规则已维护</p></article><article class="record-card"><div class="record-top"><strong>终端安全基础套餐</strong>${status("可选", "gray")}</div><p>产品套餐 · 12 个功能模块</p></article></div>`,
        `<button type="button" class="button" data-close>取消</button><button type="button" class="button primary" data-toast="已加入报价明细。">加入报价</button>`,
      );
    case "messages-panel":
      return drawerShell(
        "消息中心",
        "5 条未读 · 审批待办与业务提醒",
        `<div class="list-stack">${[
          ["客户报备待审核", "华南某智能制造集团 · 10 分钟前", "amber"],
          ["订单即将超时", "SO202609150018 · 剩余 18 小时", "red"],
          ["报价客户已确认", "QT202609160028 · 1 小时前", "green"],
          ["渠道证书即将到期", "北京中安网络技术有限公司 · 2 小时前", "amber"],
        ]
          .map(
            ([title, desc, tone]) =>
              `<article class="record-card"><div class="record-top"><strong>${title}</strong>${status("未读", tone)}</div><p>${desc}</p></article>`,
          )
          .join("")}</div>`,
        `<button type="button" class="button" data-modal="message-preferences">通知偏好</button><button type="button" class="button primary" data-nav="messages" data-close>进入消息中心</button>`,
      );
    case "message-detail":
      return modalShell(
        "消息详情",
        "客户报备待审核",
        `<div class="callout"><strong>华南某智能制造集团</strong><br />客户名称、信用代码和归属渠道已通过系统校验，请在 14:00 前完成审批。</div><div style="height:12px"></div>${infoGrid(
          [
            ["审批类型", "客户报备"],
            ["提交人", "张明"],
            ["归属渠道", "深圳示例数字科技有限公司"],
            ["提交时间", "今天 09:32"],
          ],
        )}`,
        `<button type="button" class="button" data-close>关闭</button><button type="button" class="button primary" data-modal="approval-detail">立即处理</button>`,
      );
    case "message-preferences":
      return modalShell(
        "通知偏好",
        "通知偏好只控制接收方式，不改变业务权限和待办生成规则。",
        `<div class="spec-list"><div class="spec-item"><strong>站内通知</strong><span>${status("开启", "green")}</span></div><div class="spec-item"><strong>企业微信</strong><span>${status("开启", "green")}</span></div><div class="spec-item"><strong>邮件</strong><span>${status("关闭", "gray")}</span></div><div class="spec-item"><strong>短信</strong><span>${status("未配置", "amber")}</span></div></div>`,
        commonFoot,
      );
    case "user-editor":
      return modalShell(
        "编辑人员账号",
        "业务角色、系统角色和数据范围相互独立。",
        `<div class="form-grid"><div class="form-field"><label class="form-label required">姓名</label><div class="form-control">张明</div></div><div class="form-field"><label class="form-label">联系电话</label><div class="form-control">138****6621</div></div><div class="form-field"><label class="form-label">内部组织</label><div class="form-control">华南大区 / 渠道运营 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">业务角色</label><div class="form-control">销售 ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label">系统角色</label><div class="chip-row"><span class="chip active">区域管理员</span><span class="chip">普通管理员</span><span class="chip">审计查看</span></div></div><div class="form-field full"><label class="form-label">数据范围</label><div class="callout">华南大区及全部子区域，不包含其他大区。</div></div></div>`,
        commonFoot,
      );
    case "user-detail":
      return drawerShell(
        "张明",
        "华南大区 / 渠道运营 · 账号启用",
        `${infoGrid([
          ["用户名", "zhangming"],
          ["联系电话", "138****6621"],
          ["系统角色", "区域管理员"],
          ["业务角色", "销售"],
          ["数据范围", "华南大区"],
          ["外部身份", "IAM / 企微已绑定"],
        ])}<div style="height:12px"></div>${panel("权限摘要", "有效权限 28 项", `<div class="progress-list">${progress("客户权限", 100)}${progress("商机权限", 100)}${progress("报价权限", 80)}${progress("订单权限", 60)}</div>`)}`,
        `<button type="button" class="button" data-modal="user-editor">编辑</button>`,
      );
    case "role-editor":
      return modalShell(
        "新建权限角色",
        "系统角色决定接口权限，不自动授予业务角色。",
        `<div class="form-grid"><div class="form-field"><label class="form-label required">角色名称</label><div class="form-control">区域运营管理员</div></div><div class="form-field"><label class="form-label">角色类型</label><div class="form-control">内部管理角色 ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label">权限点</label><div class="chip-row">${["客户查看", "客户编辑", "商机查看", "商机编辑", "报价查看", "报价创建", "订单查看", "渠道查看"].map((item, index) => `<span class="chip ${index < 6 ? "active" : ""}">${item}</span>`).join("")}</div></div><div class="form-field full"><label class="form-label">数据范围</label><div class="callout">按内部组织：华南大区及子区域；按渠道组织：华南区域全部渠道。</div></div></div>`,
        commonFoot,
      );
    case "permission-audit":
      return modalShell(
        "权限差异检查",
        "识别角色变更、数据范围变更和用户级覆盖产生的权限差异。",
        `${table(
          ["账号", "当前权限", "授权来源", "差异", "最晚处理"],
          [
            ["张明", "客户、商机、报价、订单", "区域管理员角色", "新增报价审核权限", "7 天内确认"],
            ["陈佳", "客户、商机、报价", "普通管理员角色", "数据范围扩大至华东大区", "7 天内确认"],
            ["王卓", "客户、商机", "渠道员工角色", "证书撤销待回收", "今天"],
          ]
            .map(
              (row) =>
                `<tr><td><span class="record-title">${row[0]}</span></td><td>${row[1]}</td><td>${row[2]}</td><td>${status(row[3], "amber")}</td><td>${row[4]}</td></tr>`,
            )
            .join(""),
        )}`,
        `<button type="button" class="button" data-close>关闭</button><button type="button" class="button primary" data-toast="已生成权限差异确认任务。">生成确认任务</button>`,
      );
    case "channel-detail":
      return drawerShell(
        "深圳示例数字科技有限公司",
        "CH-2026-000128 · 核心渠道 · 合作中",
        `${infoGrid(
          [
            ["统一社会信用代码", "91440300MA5F8X2D7Q"],
            ["所属区域", "华南区域"],
            ["企业管理员", "刘海峰"],
            ["成员规模", "24 人"],
            ["资质证书", "12 项"],
            ["本年度订单额", "¥ 328.6 万"],
          ],
          true,
        )}<div style="height:12px"></div>${panel(
          "渠道资质",
          "证书与有效期",
          table(
            ["证书", "状态", "有效期"],
            [
              ["渠道合作协议", status("有效", "green"), "2027-03-18"],
              ["技术服务能力证书", status("有效", "green"), "2027-06-30"],
              ["安全交付认证", status("即将到期", "amber"), "2026-10-12"],
            ]
              .map(
                (row) =>
                  `<tr><td><span class="record-title">${row[0]}</span></td><td>${row[1]}</td><td>${row[2]}</td></tr>`,
              )
              .join(""),
          ),
        )}`,
        `<button type="button" class="button" data-modal="channel-edit">编辑渠道商信息</button><button type="button" class="button primary" data-modal="user-editor">维护成员</button>`,
      );
    case "channel-edit":
      return modalShell(
        "编辑渠道商信息",
        "渠道基本资料与成员、证书、账号分开维护。",
        `<div class="form-grid"><div class="form-field full"><label class="form-label required">渠道商名称</label><div class="form-control">深圳示例数字科技有限公司</div></div><div class="form-field"><label class="form-label required">渠道等级</label><div class="form-control">核心渠道 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label required">所属区域</label><div class="form-control">华南区域 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">上级渠道</label><div class="form-control">无 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">合作状态</label><div class="form-control">合作中 ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label">渠道简介</label><div class="form-control textarea">华南区域核心渠道，具备终端安全和数据安全交付能力。</div></div></div>`,
        commonFoot,
      );
    case "product-detail":
      return drawerShell(
        "终端安全管理",
        "软件模块 · 已发布 · 编号 FEAT-TERMINAL",
        `${infoGrid(
          [
            ["产品线", "终端安全"],
            ["公开价格", "¥ 280 / 点"],
            ["工作量规则", "12 项"],
            ["价格规则", "阶梯价 / 区域价"],
            ["收益范围", "微盾"],
            ["状态", "已发布"],
          ],
          true,
        )}<div style="height:12px"></div>${panel(
          "价格与工作量",
          "服务端计算依据",
          table(
            ["规则", "范围", "单价 / 系数"],
            [
              ["基础阶梯", "1-499 点", "¥ 320"],
              ["标准阶梯", "500-999 点", "¥ 300"],
              ["批量阶梯", "1,000 点以上", "¥ 280"],
            ]
              .map(
                (row) =>
                  `<tr><td>${row[0]}</td><td>${row[1]}</td><td class="amount">${row[2]}</td></tr>`,
              )
              .join(""),
          ),
        )}`,
        `<button type="button" class="button" data-modal="product-edit">编辑产品</button>`,
      );
    case "product-edit":
      return modalShell(
        "编辑产品",
        "公共价格与内部成本分开保存，成本字段不得通过渠道接口返回。",
        `<div class="form-grid"><div class="form-field"><label class="form-label required">产品名称</label><div class="form-control">终端安全管理</div></div><div class="form-field"><label class="form-label required">产品类型</label><div class="form-control">软件模块 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">产品线</label><div class="form-control">微盾 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">公开价格</label><div class="form-control">¥ 280 / 点</div></div><div class="form-field full"><label class="form-label">产品说明</label><div class="form-control textarea">提供终端安全防护、EDR 和行为检测能力。</div></div></div>`,
        commonFoot,
      );
    case "cost-rule":
      return modalShell(
        "硬件成本规则",
        "成本规则按型号版本化保存，只对超级管理员开放。",
        `<div class="form-grid"><div class="form-field"><label class="form-label">硬件型号</label><div class="form-control readonly">LV-7050-A</div></div><div class="form-field"><label class="form-label required">内部销售成本</label><div class="form-control">¥ 13,000.00</div></div><div class="form-field"><label class="form-label">年度质保 / 维保成本</label><div class="form-control">待确定</div></div><div class="form-field"><label class="form-label">生效时间</label><div class="form-control">2026-09-16 00:00 ${icon("calendar")}</div></div></div><div class="callout warning" style="margin-top:12px">年度成本为空时允许保存草稿，但不能冻结正式收益。</div>`,
        commonFoot,
      );
    case "api-client":
      return modalShell(
        "OpenAPI 客户端",
        "密钥只在创建或重签时展示一次，数据库仅保存摘要。",
        `<div class="form-grid"><div class="form-field"><label class="form-label required">客户端名称</label><div class="form-control">AI Agent 查询客户端</div></div><div class="form-field"><label class="form-label required">绑定用户</label><div class="form-control">liulonghai ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label">授权资源</label><div class="chip-row">${["客户查看", "商机查看", "报价查看", "订单查看", "渠道查看"].map((item, index) => `<span class="chip ${index < 4 ? "active" : ""}">${item}</span>`).join("")}</div></div><div class="form-field full"><label class="form-label">来源白名单</label><div class="form-control">10.20.3.0/24</div></div></div>`,
        commonFoot,
      );
    case "reset-secret":
      return modalShell(
        "重签客户端密钥",
        "旧密钥将立即失效，请确认调用方已完成切换准备。",
        `<div class="callout warning">重签后旧密钥立即失效。新密钥只展示一次，不能再次查看。</div><div class="form-grid" style="margin-top:12px"><div class="form-field full"><label class="form-label">新密钥</label><div class="form-control readonly">sk_live_••••••••••••••••••••</div></div></div>`,
        commonFoot,
      );
    case "backup-now":
      return modalShell(
        "立即备份",
        "备份数据库、配置、上传文件和导出文件，并生成本机校验清单。",
        `<div class="spec-list"><div class="spec-item"><strong>数据库</strong><span>PostgreSQL 全量备份</span></div><div class="spec-item"><strong>配置</strong><span>v3.env、Compose、Nginx 配置</span></div><div class="spec-item"><strong>文件</strong><span>上传与导出目录</span></div><div class="spec-item"><strong>目标</strong><span>本机备份目录，异机备份当前启用状态以系统配置为准</span></div></div>`,
        commonFoot,
      );
    case "org-sync":
      return modalShell(
        "企微组织同步",
        "企业微信只提供组织和人员基础信息，差异必须人工批准。",
        `<div class="grid-3"><div class="callout"><strong>新增部门</strong><br />3 个</div><div class="callout"><strong>人员变更</strong><br />12 条</div><div class="callout warning"><strong>冲突</strong><br />4 条</div></div><div style="height:12px"></div>${table(
          ["对象", "差异", "当前处理"],
          [
            ["华南大区 / 安全服务部", "新增部门", status("待批准", "amber")],
            ["张明", "岗位调整", status("待批准", "amber")],
            ["陈佳", "电话变更", status("已忽略", "gray")],
          ]
            .map(
              (row) =>
                `<tr><td><span class="record-title">${row[0]}</span></td><td>${row[1]}</td><td>${row[2]}</td></tr>`,
            )
            .join(""),
        )}`,
        `<button type="button" class="button" data-close>取消</button><button type="button" class="button primary" data-toast="已批准所选组织同步差异。">批准所选</button>`,
      );
    case "bulk-approve":
      return modalShell(
        "批量处理审核任务",
        "批量操作逐条执行并记录结果，任何一条失败都不会静默跳过。",
        `<div class="form-grid"><div class="form-field full"><label class="form-label required">处理动作</label>${segment(
          "bulk-approve",
          [
            ["approve", "批量通过"],
            ["reject", "批量驳回"],
            ["assign", "批量转派"],
          ],
        )}</div><div class="form-field full"><label class="form-label">审批意见</label><div class="form-control textarea">客户信息、归属渠道和业务规则已核验。</div></div></div><div class="callout warning" style="margin-top:12px">当前选择 6 项任务，其中 1 项存在跨区域风险，将进入人工复核。</div>`,
        commonFoot,
      );
    case "mark-all-read":
      return modalShell(
        "全部标记已读",
        "只改变消息读取状态，不改变待办和业务流程。",
        `<div class="callout">当前有 5 条未读消息，确认后全部标记为已读。</div>`,
        commonFoot,
      );
    case "mark-read":
      return modalShell(
        "标记已读",
        "消息读取状态只影响通知中心展示。",
        `<div class="callout">确认将该消息标记为已读。</div>`,
        commonFoot,
      );
    case "confirm-action":
      return modalShell(
        "确认操作",
        "该操作将写入审计日志，并按业务规则校验权限和状态。",
        `<div class="callout warning">请确认当前对象和操作结果无误。</div>`,
        commonFoot,
      );
    case "submit-confirm":
      return modalShell(
        "确认提交",
        "提交后进入服务端校验和后续审批或任务流程。",
        `<div class="callout success">必填项已通过前端校验。服务端将继续复核权限、数据范围和业务状态。</div>`,
        commonFoot,
      );
    case "quote-submit":
      return modalShell(
        "生成报价单",
        "金额、折扣、税费和工作量均由服务端重新计算。",
        `<div class="callout success">报价总额 ¥ 428,600.00，折扣 97%。确认后将生成报价快照。</div>`,
        commonFoot,
      );
    case "quote-export":
      return modalShell(
        "导出报价单",
        "导出范围受当前筛选条件和数据权限约束。",
        `<div class="form-grid"><div class="form-field"><label class="form-label">导出范围</label><div class="form-control">当前筛选结果 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">文件格式</label><div class="form-control">XLSX ${icon("chevron")}</div></div></div>`,
        commonFoot,
      );
    case "order-export":
      return modalShell(
        "导出订单",
        "导出字段、状态和金额以服务端正式数据为准。",
        `<div class="callout">当前筛选结果共 128 笔订单，将生成 XLSX 文件。</div>`,
        commonFoot,
      );
    case "product-import":
      return modalShell(
        "导入产品目录",
        "导入前执行重复项、价格、产品线和成本字段预检。",
        `<div class="form-control textarea">${icon("upload")} 选择产品目录导入文件</div><div class="callout success" style="margin-top:12px">模板版本：产品目录 V3 · 2026-09。</div>`,
        commonFoot,
      );
    case "token-export":
      return modalShell(
        "导出设计令牌",
        "导出 CSS 变量、颜色、间距、字号和组件尺寸。",
        `<div class="callout success">可导出为 design-tokens.json 或 CSS variables，供 Vue 工程直接引用。</div>`,
        `<button type="button" class="button" data-close>关闭</button><button type="button" class="button primary" data-toast="设计令牌已导出。">导出</button>`,
      );
    case "mobile-guide":
      return modalShell(
        "移动适配说明",
        "移动端不复用桌面表格，而是按任务重新组织信息。",
        `<div class="spec-list"><div class="spec-item"><strong>管理员</strong><span>待办、审核、查询、客户跟进和渠道详情。</span></div><div class="spec-item"><strong>渠道用户</strong><span>客户报备、商机、报价、订单和个人信息。</span></div><div class="spec-item"><strong>共享规则</strong><span>登录、权限、数据范围、状态机和接口与桌面端一致。</span></div><div class="spec-item"><strong>高风险动作</strong><span>审批、订单确认和状态修改必须二次确认。</span></div></div>`,
        `<button type="button" class="button primary" data-close>知道了</button>`,
      );
    case "state-gallery":
      return modalShell(
        "状态全集",
        "业务状态必须跨列表、详情、审批和消息保持一致。",
        `<div class="grid-3">${[
          "已通过:green",
          "待审核:amber",
          "进行中:blue",
          "已退回:red",
          "已完成:gray",
          "折扣待审:amber",
          "保护期内:green",
          "即将到期:amber",
          "已失效:gray",
          "履约中:green",
          "待客户确认:blue",
          "异常:red",
        ]
          .map((item) => {
            const [label, tone] = item.split(":");
            return `<div class="callout">${status(label, tone)}<br /><span class="record-meta">跨模块统一使用</span></div>`;
          })
          .join("")}</div>`,
        `<button type="button" class="button" data-close>关闭</button>`,
      );
    case "screen-map":
      return drawerShell(
        "页面地图",
        "全部页面与关键窗口，点击后直接切换",
        `<div class="screen-grid">${screens
          .map(
            ([id, title, group, desc], index) =>
              `<button type="button" class="screen-link" data-nav="${id}" data-close><span class="screen-no">${String(index + 1).padStart(2, "0")}</span><strong>${title}</strong><p>${group} · ${desc}</p></button>`,
          )
          .join("")}</div>`,
        `<button type="button" class="button" data-close>关闭</button>`,
      );
    case "region-filter":
      return modalShell(
        "区域范围筛选",
        "仅超级管理员显示。筛选只缩小当前查询范围，不改变账号原有数据权限。",
        `<div class="region-options">${[
          "全部区域",
          "华南区域",
          "华东区域",
          "华北区域",
          "西南区域",
          "西北区域",
          "东北区域",
          "华中区域",
        ]
          .map(
            (region) =>
              `<button type="button" class="region-option ${state.regionFilter === region ? "active" : ""}" data-region="${region}"><strong>${region}</strong><span>${region === "全部区域" ? "超管全量范围" : "查看该区域内业务"}</span></button>`,
          )
          .join("")}</div>`,
        `<button type="button" class="button" data-region="全部区域">重置</button><button type="button" class="button primary" data-close>完成</button>`,
      );
    case "member-detail":
      return drawerShell(
        "张明",
        "zhangm · 深圳示例数字科技有限公司 · 普通员工",
        `${infoGrid(
          [
            ["姓名", "张明"],
            ["登录账号", "zhangm"],
            ["联系电话", "138****6621"],
            ["邮箱", "zhangming@example.com"],
            ["账号身份", "普通员工"],
            ["业务角色", "销售"],
            ["账号状态", "启用"],
            ["加入时间", "2024-03-18"],
          ],
          true,
        )}<div style="height:12px"></div>${panel(
          "有效证书",
          "证书与业务角色独立维护",
          table(
            ["证书名称", "类别", "状态", "有效期"],
            [
              ["渠道销售能力认证", "销售", status("有效", "green"), "2027-03-18"],
              ["终端安全产品认证", "技术", status("有效", "green"), "2026-12-31"],
            ]
              .map(
                (row) =>
                  `<tr><td><span class="record-title">${row[0]}</span></td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td></tr>`,
              )
              .join(""),
          ),
        )}`,
        `<button type="button" class="button" data-modal="member-reset">重置密码</button><button type="button" class="button primary" data-modal="member-editor">编辑成员</button>`,
      );
    case "member-editor":
      return modalShell(
        "添加 / 编辑渠道成员",
        "业务角色只分销售和技术，证书授权和系统权限独立维护。",
        `<div class="form-grid"><div class="form-field"><label class="form-label required">登录账号</label><div class="form-control">zhangm</div></div><div class="form-field"><label class="form-label required">成员姓名</label><div class="form-control">张明</div></div><div class="form-field"><label class="form-label required">业务角色</label><div class="form-control">销售 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label required">联系电话</label><div class="form-control">138****6621</div></div><div class="form-field"><label class="form-label">邮箱</label><div class="form-control">zhangming@example.com</div></div><div class="form-field"><label class="form-label">账号状态</label><div class="form-control">启用 ${icon("chevron")}</div></div><div class="form-field full"><label class="form-label">证书授权</label><div class="chip-row"><span class="chip active">渠道销售能力认证</span><span class="chip active">终端安全产品认证</span><span class="chip">安全交付认证</span></div></div></div>`,
        commonFoot,
      );
    case "member-cert":
      return modalShell(
        "证书授权维护",
        "新增勾选将颁发证书，取消勾选将撤销当前有效证书。",
        `${table(
          ["证书名称", "类别", "当前状态", "授权"],
          [
            ["渠道销售能力认证", "销售", status("有效", "green"), "已授权"],
            ["终端安全产品认证", "技术", status("有效", "green"), "已授权"],
            ["安全交付认证", "交付", status("未授权", "gray"), "未授权"],
          ]
            .map(
              (row) =>
                `<tr><td><span class="record-title">${row[0]}</span></td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td></tr>`,
            )
            .join(""),
        )}`,
        commonFoot,
      );
    case "member-reset":
      return modalShell(
        "重置成员密码",
        "重置后旧密码立即失效，成员需使用新密码重新登录。",
        `<div class="callout warning">确认重置张明（zhangm）的登录密码？</div>`,
        commonFoot,
      );
    case "member-disable":
      return modalShell(
        "停用渠道成员",
        "停用后账号不能登录，但成员关系、业务历史和审计记录保留。",
        `<div class="callout warning">确认停用张明（zhangm）？如账号仍属于其他有效渠道，可能仍可从其他渠道身份登录。</div>`,
        commonFoot,
      );
    case "pricing-editor":
      return modalShell(
        "编辑模块价格规则",
        "按基础阶梯、渠道价格比例和区域覆盖顺序计算报价单价。",
        `<div class="form-grid"><div class="form-field"><label class="form-label">计价方式</label><div class="form-control">阶梯计价 ${icon("chevron")}</div></div><div class="form-field"><label class="form-label">生效时间</label><div class="form-control">2026-09-01 ${icon("calendar")}</div></div></div><div style="height:12px"></div>${table(
          ["起购端点", "结束端点", "标准单价", "操作"],
          [
            ["1", "99", "¥ 360 / 点", "删除"],
            ["100", "499", "¥ 320 / 点", "删除"],
            ["500", "999", "¥ 300 / 点", "删除"],
            ["1,000", "不限", "¥ 280 / 点", "删除"],
          ]
            .map(
              (row) =>
                `<tr><td><div class="form-control">${row[0]}</div></td><td><div class="form-control">${row[1]}</div></td><td><div class="form-control">${row[2]}</div></td><td><button type="button" class="link">${row[3]}</button></td></tr>`,
            )
            .join(""),
        )}<div style="height:10px"></div><button type="button" class="button">${icon("plus")} 添加阶梯</button><div class="form-grid" style="margin-top:12px"><div class="form-field"><label class="form-label">一级渠道价格比例（折扣率）</label><div class="form-control">100%</div></div><div class="form-field"><label class="form-label">二级渠道价格比例（折扣率）</label><div class="form-control">110%</div></div></div><div style="height:12px"></div><div class="pricing-block"><div class="pricing-block-head"><strong>区域价格覆盖</strong><span>命中区域后优先于全国默认价</span></div>${table(
          ["区域", "最小数量", "最大数量", "区域单价", "一级折扣率", "二级折扣率", "状态"],
          [
            ["华南区域", "1,000", "不限", "¥ 270 / 点", "100%", "110%", "启用"],
            ["华东区域", "500", "999", "¥ 290 / 点", "100%", "110%", "启用"],
            ["华北区域", "1,000", "不限", "¥ 275 / 点", "100%", "110%", "待生效"],
          ]
            .map(
              (row) =>
                `<tr><td><span class="record-title">${row[0]}</span></td><td><div class="form-control">${row[1]}</div></td><td><div class="form-control">${row[2]}</div></td><td><div class="form-control">${row[3]}</div></td><td><div class="form-control">${row[4]}</div></td><td><div class="form-control">${row[5]}</div></td><td>${row[6]}</td></tr>`,
            )
            .join(""),
        )}<div class="pricing-ratio-list" style="padding:10px"><button type="button" class="button">${icon("plus")} 添加区域覆盖</button></div></div>`,
        commonFoot,
      );
    case "print-help":
      return modalShell(
        "设计文档导出",
        "可在浏览器中使用“打印 / 另存为 PDF”导出当前页面。",
        `<div class="callout">原型完全使用本地 HTML/CSS/JavaScript 构建，不依赖外部 CDN，适合离线传阅和研发查看。</div><div class="spec-list" style="margin-top:12px"><div class="spec-item"><strong>交互原型</strong><span>index.html</span></div><div class="spec-item"><strong>页面截图</strong><span>screenshots/ 目录</span></div><div class="spec-item"><strong>设计说明</strong><span>README.md</span></div></div>`,
        `<button type="button" class="button" data-close>关闭</button><button type="button" class="button primary" onclick="window.print()">打印 / PDF</button>`,
      );
    default:
      return "";
  }
}

function renderApp() {
  const app = document.getElementById("app");
  const overlay = state.overlay ? overlayContent(state.overlay) : "";
  const toast = state.toast
    ? `<div class="toast">${icon("check-circle")} ${state.toast}</div>`
    : "";
  const template = document.createElement("template");
  template.innerHTML = renderScreen();
  if (screensWithoutPageHeader.has(state.screen)) {
    template.content.querySelector(".page-head")?.remove();
  }
  app.innerHTML = `<div class="customer-review-shell"><header class="customer-review-head"><div><strong>联软渠道管理平台 UI 重构交互设计文档</strong><span>以 02-war-full 为目标视觉模型：顶部业务导航、六项指标、三栏作战室、固定画板。点击顶部导航或页面地图切换页面。</span></div><button type="button" class="button primary" data-modal="screen-map">${icon("grid")} 页面地图 · ${screenMap[state.screen].title}</button></header><section class="artboard war-artboard demo-artboard" data-screen="${state.screen}"><div class="app-canvas">${topNavigation()}<main class="demo-content">${template.innerHTML}</main></div></section></div>${overlay}${toast}`;
}

function setScreen(id) {
  if (!screenMap[id]) return;
  state.screen = id;
  state.overlay = "";
  renderApp();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function openOverlay(id) {
  state.overlay = id;
  renderApp();
}

function closeOverlay() {
  state.overlay = "";
  renderApp();
}

function showToast(message) {
  state.toast = message;
  renderApp();
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    state.toast = "";
    renderApp();
  }, 2600);
}

document.addEventListener("click", (event) => {
  if (
    event.target.classList.contains("overlay") ||
    event.target.classList.contains("drawer-overlay")
  ) {
    closeOverlay();
    return;
  }
  const target = event.target.closest(
    "[data-nav], [data-modal], [data-close], [data-tab], [data-toast], [data-region]",
  );
  if (!target) {
    const button = event.target.closest("button");
    if (button) {
      const label = button.textContent.replace(/\s+/g, " ").trim() || "该操作";
      showToast(`${label}已触发，原型仅展示当前交互状态。`);
    }
    return;
  }
  if (target.dataset.nav) {
    closeOverlay();
    setScreen(target.dataset.nav);
    return;
  }
  if (target.dataset.modal) {
    openOverlay(target.dataset.modal);
    return;
  }
  if (target.hasAttribute("data-close")) {
    closeOverlay();
    return;
  }
  if (target.dataset.region) {
    state.regionFilter = target.dataset.region;
    closeOverlay();
    return;
  }
  if (target.dataset.tab) {
    state.tab[target.dataset.tab] = target.dataset.value;
    if (target.dataset.openMode === "edit") {
      state.tab.adminSettingsMode = "edit";
    }
    renderApp();
    return;
  }
  if (target.dataset.toast) {
    state.overlay = "";
    showToast(target.dataset.toast);
  }
});

window.demoGo = setScreen;
window.demoModal = openOverlay;
window.demoScreens = screens.map(([id]) => id);

renderApp();
