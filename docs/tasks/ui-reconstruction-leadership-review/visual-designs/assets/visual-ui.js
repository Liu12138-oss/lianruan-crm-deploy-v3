const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;

const status = (text, tone = "gray") => `<span class="status ${tone}">${text}</span>`;

const moduleMeta = {
  customers: {
    label: "客户管理",
    nav: "客户管理",
    title: "客户管理",
    subtitle: "统一管理客户档案、归属渠道、报备状态、负责人和报备有效期。",
    primaryAction: "新建客户报备",
    listTitle: "客户列表",
    listCount: "共 86 家客户",
    kpis: [
      ["客户总数", "86", "家", "本月新增 12 家"],
      ["待审核报备", "9", "家", "平均 0.9 天完成"],
      ["已通过报备", "58", "家", "有效期平均 90 天"],
      ["即将到期", "15", "家", "30 天内到期"],
      ["活跃客户", "42", "家", "近 30 日有跟进"],
      ["归属冲突", "3", "家", "待运营裁决"],
    ],
    table: {
      columns: ["客户名称", "所属行业", "所属区域", "归属渠道", "负责人", "有效期至", "报备状态", "预计金额", "操作"],
      rows: [
        ["华南某智能制造集团", "REG202609150021", "制造", "华南区域", "深圳示例数字科技有限公司", "张明", "2026-12-14", "待审核", "¥ 42.8 万"],
        ["华东某商业银行", "REG202609140016", "金融", "华东区域", "上海启辰信息技术有限公司", "陈佳", "2026-12-14", "已通过", "¥ 68.0 万"],
        ["某省级政务服务中心", "REG202606180008", "政府", "华北区域", "北京中安网络技术有限公司", "周宁", "2026-09-18", "即将到期", "¥ 51.7 万"],
        ["某能源集团信息中心", "REG202609100027", "能源", "华南区域", "深圳示例数字科技有限公司", "王卓", "2026-12-10", "已通过", "¥ 36.2 万"],
        ["华北某医疗集团", "REG202609080014", "医疗", "华北区域", "北京中安网络技术有限公司", "王卓", "2026-11-25", "已通过", "¥ 24.6 万"],
      ],
    },
    warRecords: [
      ["华南某智能制造集团", "制造 · 华南区域 · 客户查重", "待审核", "负责人：张明", "预计 42.8 万"],
      ["华东某商业银行", "金融 · 华东区域 · 运营审核", "已通过", "负责人：陈佳", "预计 68.0 万"],
      ["某省级政务服务中心", "政府 · 华北区域 · 有效期管理", "即将到期", "负责人：周宁", "预计 51.7 万"],
      ["某能源集团信息中心", "能源 · 华南区域 · 商机转化", "已通过", "负责人：王卓", "预计 36.2 万"],
      ["华北某医疗集团", "医疗 · 华北区域 · 跟进维护", "已通过", "负责人：王卓", "预计 24.6 万"],
    ],
    warTitle: "华南某智能制造集团",
    warMeta: "制造 / 华南区域 / 报备编号 REG202609150021",
    warSteps: ["报备提交", "客户查重", "运营审核", "归属确认", "商机转化", "跟进维护", "到期续报"],
    warInfo: [
      ["客户编号", "CU202609150021"],
      ["所属行业", "制造"],
      ["所属区域", "华南区域"],
      ["归属渠道", "深圳示例数字科技有限公司"],
      ["负责人", "张明"],
      ["有效期至", "2026-12-14"],
      ["客户来源", "渠道自主报备"],
      ["报备状态", "待审核"],
    ],
    warNotes: "客户名称与工商主体已完成查重，未发现冲突报备。下一步由渠道运营核验归属关系和报备有效期，通过后即可创建商机。",
    rightTop: [["报备状态", "待审核"], ["归属渠道", "深圳示例数字科技"], ["有效期至", "2026-12-14"], ["预计金额", "¥ 42.8 万"]],
    timeline: [
      ["提交客户报备", "2026-09-15 · 张明"],
      ["系统完成客户查重", "2026-09-15 · 系统"],
      ["渠道运营接收审核", "2026-09-15 · 渠道运营"],
    ],
  },
  channels: {
    label: "渠道管理",
    nav: "渠道管理",
    title: "渠道商管理",
    subtitle: "统一维护渠道档案、层级、区域、管理员、成员与资质状态。",
    primaryAction: "新建渠道商",
    listTitle: "渠道商列表",
    listCount: "共 128 家渠道商",
    kpis: [
      ["渠道商总数", "128", "家", "本月新增 6 家"],
      ["核心渠道", "36", "家", "覆盖 8 个区域"],
      ["待审批", "6", "家", "平均 1.8 天完成"],
      ["待续签", "5", "家", "30 天内到期"],
      ["活跃成员", "1,284", "人", "近 30 日活跃 82%"],
      ["资质完整率", "92", "%", "9 家需补齐证书"],
    ],
    table: {
      columns: ["渠道商名称", "渠道等级", "所属区域", "企业管理员", "成员 / 证书", "合作状态", "订单金额", "操作"],
      rows: [
        ["深圳示例数字科技有限公司", "CH-2026-000128", "核心渠道", "华南区域", "刘海峰", "24 人 / 12 项", "合作中", "¥ 328.6 万"],
        ["上海启辰信息技术有限公司", "CH-2026-000112", "核心渠道", "华东区域", "周明远", "18 人 / 9 项", "合作中", "¥ 189.0 万"],
        ["北京中安网络技术有限公司", "CH-2026-000086", "金牌渠道", "华北区域", "赵思宁", "31 人 / 15 项", "待续签", "¥ 516.8 万"],
        ["成都智联安全服务有限公司", "CH-2026-000141", "认证渠道", "西南区域", "彭奕辰", "6 人 / 3 项", "待审批", "¥ 138.5 万"],
        ["厦门产品交付中心", "二级渠道 · 深圳示例下级", "二级渠道", "福建", "林舒雅", "5 人 / 2 项", "待续签", "¥ 86.0 万"],
      ],
    },
    warRecords: [
      ["深圳示例数字科技有限公司", "核心渠道 · 华南区域", "合作中", "负责人：刘海峰", "¥ 328.6 万"],
      ["上海启辰信息技术有限公司", "核心渠道 · 华东区域", "合作中", "负责人：周明远", "¥ 189.0 万"],
      ["北京中安网络技术有限公司", "金牌渠道 · 华北区域", "待续签", "负责人：赵思宁", "¥ 516.8 万"],
      ["成都智联安全服务有限公司", "认证渠道 · 西南区域", "待审批", "负责人：彭奕辰", "¥ 138.5 万"],
      ["厦门产品交付中心", "二级渠道 · 福建", "待续签", "负责人：林舒雅", "¥ 86.0 万"],
    ],
    warTitle: "深圳示例数字科技有限公司",
    warMeta: "核心渠道 / 华南区域 / 渠道编号 CH-2026-000128",
    warSteps: ["资料提交", "准入审核", "协议签署", "证书补齐", "开户激活", "合作运营", "年度续签"],
    warInfo: [
      ["统一社会信用代码", "91440300MA5F8X2D7Q"],
      ["渠道等级", "核心渠道"],
      ["企业管理员", "刘海峰"],
      ["成员规模", "24 人"],
      ["资质证书", "12 项，完整率 100%"],
      ["合作起始日", "2024-03-18"],
      ["最近更新时间", "2026-09-16 18:40"],
      ["本年度订单额", "¥ 328.6 万"],
    ],
    warNotes: "已完成渠道主体、管理员和证书核验。当前具备年度续签条件，预计在三日内提交续签材料。",
    rightTop: [["合作状态", "正常合作"], ["渠道等级", "核心渠道"], ["资质完整度", "100%"], ["年度目标完成率", "82%"]],
    timeline: [
      ["渠道资料审核通过", "2026-09-16 · 王芳"],
      ["企业管理员完成证书补充", "2026-09-14 · 刘海峰"],
      ["新增二级渠道厦门交付中心", "2026-09-09 · 周明远"],
      ["渠道季度经营复盘", "2026-08-28 · 刘管理员"],
    ],
  },
  opportunities: {
    label: "商机管理",
    nav: "商机作战",
    title: "商机作战",
    subtitle: "集中跟踪商机阶段、预计金额、赢单概率和下一步作战动作。",
    primaryAction: "新建商机",
    listTitle: "商机列表",
    listCount: "共 75 条商机",
    kpis: [
      ["商机总数", "75", "条", "本月新增 12 条"],
      ["活跃商机", "46", "条", "预计金额 960 万"],
      ["方案 / POC", "18", "条", "本周新增 4 条"],
      ["商务谈判", "8", "条", "预计金额 320 万"],
      ["预计成交", "6", "条", "赢单概率 78%"],
      ["本月流失", "3", "条", "同比减少 2 条"],
    ],
    table: {
      columns: ["客户 / 商机", "归属渠道", "当前阶段", "预计金额", "赢单概率", "负责人", "下一步动作", "预计成交", "操作"],
      rows: [
        ["华南某智能制造集团", "OP202609150031", "深圳示例数字科技", "方案确认", "¥ 42.8 万", "65%", "张明", "确认最终方案清单", "2026-10-18"],
        ["华东某商业银行", "OP202609140026", "上海启辰信息技术", "商务谈判", "¥ 68.0 万", "80%", "陈佳", "提交商务报价", "2026-09-30"],
        ["某省政务数据中心", "OP202609120019", "北京中安网络技术", "需求确认", "¥ 51.7 万", "45%", "周宁", "完成资产清单核验", "2026-11-08"],
        ["华北某医疗集团", "OP202609080014", "北京中安网络技术", "POC 试用", "¥ 24.6 万", "55%", "王卓", "跟进 POC 测试报告", "2026-10-25"],
        ["西南某能源集团", "OP202609030009", "成都智联安全服务", "客户建联", "¥ 18.8 万", "25%", "李楠", "安排首次方案交流", "2026-12-12"],
      ],
    },
    warRecords: [
      ["高斯（杭州）智能科技有限公司", "制造业 · 杭州市萧山区 · 客户建联", "作战中", "负责人：张玉环", "¥ 10 万"],
      ["零跑汽车有限公司", "制造业 · 金华市婺城区 · 客户建联", "作战中", "负责人：邱方律", "¥ 50 万"],
      ["杭州长川科技股份有限公司", "制造业 · 杭州市滨江区 · 客户建联", "作战中", "负责人：王建", "¥ 50 万"],
      ["浙江水晶光电科技股份有限公司", "制造业 · 台州市椒江区 · 客户建联", "作战中", "负责人：张宇", "¥ 50 万"],
      ["宁波拓普集团股份有限公司", "制造业 · 宁波市北仑区 · 客户建联", "作战中", "负责人：何苏静", "¥ 50 万"],
    ],
    warTitle: "高斯（杭州）智能科技有限公司",
    warMeta: "制造业 / 杭州市萧山区 / 客户建联",
    warSteps: ["客户建联", "客户方案", "需求挖掘", "POC 试用", "立项推进", "招投标", "成单交接"],
    warInfo: [
      ["商机编号", "OP202609160035"],
      ["归属渠道", "杭州安全服务中心"],
      ["负责人", "张玉环"],
      ["预估金额", "¥ 10 万"],
      ["预计成交", "2026-10-18"],
      ["商机来源", "客户报备转商机"],
      ["当前阶段", "客户建联"],
      ["停滞时长", "1 天"],
    ],
    warNotes: "已确认客户存在终端安全和办公电脑防护需求。下一步需要完成关键联系人画像，并确认当前安全产品使用情况。",
    rightTop: [["商机状态", "作战中"], ["赢单概率", "45%"], ["停滞天数", "1 天"], ["预计金额", "¥ 10 万"]],
    timeline: [
      ["创建商机", "2026-09-16 · 张玉环"],
      ["客户报备审核通过", "2026-09-15 · 渠道运营"],
      ["完成首次客户建联", "2026-09-15 · 张玉环"],
    ],
  },
  quotes: {
    label: "报价管理",
    nav: "报价管理",
    title: "报价管理",
    subtitle: "统一管理报价配置、服务端试算、折扣审核、发送确认与转订单。",
    primaryAction: "新建报价单",
    listTitle: "报价单列表",
    listCount: "共 96 份报价单",
    kpis: [
      ["报价单总数", "96", "份", "本月新增 18 份"],
      ["待发出", "7", "份", "草稿待提交"],
      ["待客户确认", "14", "份", "平均 2.1 天"],
      ["折扣待审", "5", "份", "超出授权折扣"],
      ["已确认", "42", "份", "确认率 76%"],
      ["本月失效", "3", "份", "有效期届满"],
    ],
    table: {
      columns: ["客户 / 报价单号", "关联商机", "端点数量", "报价总额", "报价状态", "折扣率", "负责人", "有效期至", "操作"],
      rows: [
        ["华南某智能制造集团", "QT202609160028", "关联商机 1 个", "1,200", "¥ 42.8 万", "待确认", "97%", "张明", "2026-10-16"],
        ["华东某商业银行", "QT202609150019", "关联商机 1 个", "800", "¥ 68.0 万", "已发送", "95%", "陈佳", "2026-09-30"],
        ["某省政务数据中心", "QT202609120011", "关联商机 2 个", "1,600", "¥ 51.7 万", "折扣待审", "88%", "周宁", "2026-10-12"],
        ["华北某医疗集团", "QT202609080007", "关联商机 1 个", "600", "¥ 24.6 万", "已确认", "98%", "王卓", "2026-10-08"],
        ["西南某能源集团", "QT202609050003", "关联商机 1 个", "400", "¥ 13.85 万", "已失效", "96%", "李楠", "2026-09-05"],
      ],
    },
    warRecords: [
      ["华南某智能制造集团", "QT202609160028 · 关联商机 1 个 · 端点 1,200", "待确认", "负责人：张明", "¥ 42.8 万"],
      ["华东某商业银行", "QT202609150019 · 关联商机 1 个 · 端点 800", "已发送", "负责人：陈佳", "¥ 68.0 万"],
      ["某省政务数据中心", "QT202609120011 · 关联商机 2 个 · 端点 1,600", "折扣待审", "负责人：周宁", "¥ 51.7 万"],
      ["华北某医疗集团", "QT202609080007 · 关联商机 1 个 · 端点 600", "已确认", "负责人：王卓", "¥ 24.6 万"],
      ["西南某能源集团", "QT202609050003 · 关联商机 1 个 · 端点 400", "已失效", "负责人：李楠", "¥ 13.85 万"],
    ],
    warTitle: "华南某智能制造集团",
    warMeta: "报价单 QT202609160028 / 深圳示例数字科技 / 待客户确认",
    warSteps: ["报价配置", "服务端试算", "折扣审核", "发送客户", "客户确认", "转订单", "归档"],
    warInfo: [
      ["报价单号", "QT202609160028"],
      ["客户名称", "华南某智能制造集团"],
      ["关联商机", "终端安全改造项目（1 个）"],
      ["归属渠道", "深圳示例数字科技有限公司"],
      ["端点数量", "1,200 点"],
      ["报价总额", "¥ 428,600.00"],
      ["有效期至", "2026-10-16"],
      ["报价版本", "V2 · 价格版本 2026-09"],
    ],
    warNotes: "该报价已按组合折扣 97% 由服务端试算完成，等待客户确认。折扣未超出渠道授权范围，无需厂商审核。",
    rightTop: [["报价状态", "待客户确认"], ["报价总额", "¥ 42.86 万"], ["组合折扣", "97%"], ["有效期至", "2026-10-16"]],
    timeline: [
      ["报价单已发送客户", "2026-09-16 · 张明"],
      ["服务端试算完成", "2026-09-16 · 系统"],
      ["关联商机阶段推进", "2026-09-16 · 张明"],
      ["创建报价单", "2026-09-16 · 张明"],
    ],
  },
  orders: {
    label: "订单管理",
    nav: "订单中心",
    title: "订单管理",
    subtitle: "统一查看订单金额、审批状态、渠道确认、履约交付和异常滞留。",
    primaryAction: "新建订单",
    listTitle: "订单列表",
    listCount: "共 128 笔订单",
    kpis: [
      ["订单总数", "128", "笔", "合同额 1,860 万"],
      ["待商务审核", "12", "笔", "超时 3 笔"],
      ["待渠道确认", "8", "笔", "平均 0.7 天"],
      ["履约交付中", "36", "笔", "按期率 94%"],
      ["已完成", "72", "笔", "环比增长 9%"],
      ["SLA 告警", "3", "笔", "需优先处理"],
    ],
    table: {
      columns: ["订单 / 客户", "渠道商", "合同金额", "订单状态", "商务审核", "履约进度", "负责人", "创建时间", "操作"],
      rows: [
        ["华南某大型制造企业", "SO202609150018", "深圳示例数字科技", "¥ 328,600.00", "待审核", "待处理", "待交付", "张明", "2026-09-15 10:28"],
        ["华东某金融服务机构", "SO202609140032", "上海启辰信息技术", "¥ 189,000.00", "待确认", "已通过", "待交付", "陈佳", "2026-09-14 16:42"],
        ["某省政务数据中心", "SO202609120009", "北京中安网络技术", "¥ 516,800.00", "履约中", "已通过", "交付 62%", "周宁", "2026-09-12 09:16"],
        ["华北某医疗集团", "SO202609080026", "北京中安网络技术", "¥ 246,000.00", "已完成", "已通过", "已归档", "王卓", "2026-09-08 14:35"],
        ["西南某能源集团", "SO202609050013", "成都智联安全服务", "¥ 138,500.00", "已退回", "需修改", "未开始", "李楠", "2026-09-05 11:02"],
      ],
    },
    warRecords: [
      ["华南某大型制造企业", "SO202609150018 · 深圳示例数字科技", "待审核", "负责人：张明", "¥ 32.86 万"],
      ["华东某金融服务机构", "SO202609140032 · 上海启辰信息技术", "待确认", "负责人：陈佳", "¥ 18.90 万"],
      ["某省政务数据中心", "SO202609120009 · 北京中安网络技术", "履约中", "负责人：周宁", "¥ 51.68 万"],
      ["华北某医疗集团", "SO202609080026 · 北京中安网络技术", "已完成", "负责人：王卓", "¥ 24.60 万"],
      ["西南某能源集团", "SO202609050013 · 成都智联安全服务", "已退回", "负责人：李楠", "¥ 13.85 万"],
    ],
    warTitle: "华南某大型制造企业",
    warMeta: "订单 SO202609150018 / 深圳示例数字科技 / 待审核",
    warSteps: ["订单提交", "商务审核", "渠道确认", "合同归档", "采购备货", "履约交付", "完成归档"],
    warInfo: [
      ["订单编号", "SO202609150018"],
      ["客户名称", "华南某大型制造企业"],
      ["归属渠道", "深圳示例数字科技有限公司"],
      ["合同金额", "¥ 328,600.00"],
      ["产品明细", "终端安全 1,200 点"],
      ["签约主体", "深圳示例数字科技有限公司"],
      ["创建时间", "2026-09-15 10:28"],
      ["负责人", "张明"],
    ],
    warNotes: "订单资料已提交，合同金额和产品明细待商务审核。客户希望 2026-09-25 前完成交付排期确认。",
    rightTop: [["订单状态", "待审核"], ["合同金额", "¥ 32.86 万"], ["履约进度", "0%"], ["SLA 剩余", "18 小时"]],
    timeline: [
      ["订单提交", "2026-09-15 · 张明"],
      ["合同附件校验完成", "2026-09-15 · 系统"],
      ["进入商务审核节点", "2026-09-15 · 订单中心"],
    ],
  },
};

const topNavigation = (active, actionLabel) => {
  const items = ["客户管理", "商机作战", "报价管理", "渠道管理", "订单中心", "运营交付", "数据看板", "管理配置"];
  return `
    <header class="top-nav">
      <div class="top-brand">
        <span class="brand-logo">L</span>
        <div class="brand-copy">
          <strong>联软渠道管理平台</strong>
          <span>V3 工程化应用 · 渠道业务协同中心</span>
        </div>
      </div>
      <nav class="top-menu">
        ${items
          .map((item) => `<span class="nav-link ${item === active ? "active" : ""}">${item}</span>`)
          .join("")}
      </nav>
      <div class="top-actions">
        <span class="top-icon">${icon("search")}</span>
        <span class="top-icon">${icon("bell")}<i class="count">5</i></span>
        <span class="top-icon">${icon("settings")}</span>
        ${actionLabel ? `<button class="button primary top-primary" type="button">${icon("plus")} ${actionLabel}</button>` : ""}
        <span class="user-mini"><span class="user-avatar">刘</span>刘管理员</span>
      </div>
    </header>`;
};

const listStatusTone = (text) => {
  if (["合作中", "已完成", "已通过", "已确认"].includes(text)) return "green";
  if (["待审批", "待审核", "待续签", "待确认", "已退回", "即将到期", "折扣待审"].includes(text)) return "amber";
  if (["履约中", "方案确认", "商务谈判", "POC 试用", "已发送"].includes(text)) return "blue";
  if (["需求确认", "客户建联", "正常", "待发出"].includes(text)) return "blue";
  return "gray";
};

const renderListRows = (module) => {
  const meta = moduleMeta[module];
  return meta.table.rows
    .map((row) => {
      const first = `<td><span class="record-name">${row[0]}</span><span class="record-meta">${row[1]}</span></td>`;
      if (module === "channels") {
        return `<tr>${first}<td><span class="role-pill">${row[2]}</span></td><td>${row[3]}</td><td>${row[4]}</td><td>${row[5]}</td><td>${status(row[6], listStatusTone(row[6]))}</td><td class="amount">${row[7]}</td><td><span class="table-actions"><span class="action-link">查看</span><span class="action-link muted">编辑</span></span></td></tr>`;
      }
      if (module === "opportunities") {
        return `<tr>${first}<td>${row[2]}</td><td>${status(row[3], listStatusTone(row[3]))}</td><td class="amount">${row[4]}</td><td>${row[5]}</td><td>${row[6]}</td><td>${row[7]}</td><td>${row[8]}</td><td><span class="table-actions"><span class="action-link">查看</span><span class="action-link muted">推进</span></span></td></tr>`;
      }
      return `<tr>${first}<td>${row[2]}</td><td class="amount">${row[3]}</td><td>${status(row[4], listStatusTone(row[4]))}</td><td>${row[5]}</td><td>${row[6]}</td><td>${row[7]}</td><td>${row[8]}</td><td><span class="table-actions"><span class="action-link">查看</span><span class="action-link muted">${row[4] === "待审核" ? "审核" : "跟进"}</span></span></td></tr>`;
    })
    .join("");
};

const renderListArtboard = (module) => {
  const meta = moduleMeta[module];
  return `
    <section class="artboard list-artboard" id="artboard-${module}" data-module="${module}">
      <div class="app-canvas">
        ${topNavigation(meta.nav)}
        <div class="list-kpis">
          ${meta.kpis
            .map(
              ([label, value, unit, note]) => `
                <article class="list-kpi">
                  <div class="metric-label"><span>${label}</span>${icon("trending-up")}</div>
                  <div class="metric-value"><strong>${value}</strong><small>${unit}</small></div>
                  <div class="metric-foot">${note}</div>
                </article>`,
            )
            .join("")}
        </div>
        <div class="list-main">
          <div class="list-toolbar">
            <div class="section-tabs">
              <button class="section-tab" type="button">全部</button>
              <button class="section-tab active" type="button">${meta.label}</button>
              <button class="section-tab" type="button">本月新增</button>
              <button class="section-tab" type="button">重点关注</button>
            </div>
            <div class="list-filters">
              <div class="field search">${icon("search")} 搜索名称、编号或负责人</div>
              <div class="field">${icon("map-pin")} 全部区域 ${icon("chevron-down")}</div>
              <div class="field">${icon("filter")} 全部状态 ${icon("chevron-down")}</div>
              <button class="button primary" type="button">${icon("search")} 查询</button>
              <button class="button" type="button">${icon("upload")} 导出</button>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr>${meta.table.columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead>
              <tbody>${renderListRows(module)}</tbody>
            </table>
          </div>
          <div class="list-footer">
            <span>${meta.listCount} · 第 1-5 条 · 数据更新时间 2026-09-17 09:30</span>
            <div class="page-buttons"><span class="active">1</span><span>2</span><span>3</span><span>...</span><span>26</span></div>
          </div>
        </div>
      </div>
    </section>`;
};

const renderWarRecord = (records) => records
  .map(
    ([title, meta, badge, owner, amount], index) => `
      <article class="war-record ${index === 0 ? "active" : ""}">
        <div class="war-record-top"><strong>${title}</strong>${status(badge, listStatusTone(badge))}</div>
        <p>${meta}</p>
        <div class="war-record-bottom"><span>${owner}</span><strong>${amount}</strong></div>
      </article>`,
  )
  .join("");

const renderWarSteps = (steps) => steps
  .map(
    (step, index) => `
      <div class="step-item ${index < 1 ? "done" : index === 1 ? "active" : ""}">
        <span class="dot">${index + 1}</span>
        <strong>${step}</strong>
      </div>`,
  )
  .join("");

const renderWarInfo = (items) => items
  .map(([label, value]) => `<div class="info-item"><span>${label}</span><strong>${value}</strong></div>`)
  .join("");

const warListCount = { customers: 86, channels: 128, opportunities: 75, quotes: 96, orders: 128 };

const renderWarArtboard = (module) => {
  if (createFlowMeta[module]) {
    return renderCreateArtboard(module);
  }
  const meta = moduleMeta[module];
  return `
    <section class="artboard war-artboard" id="artboard-${module}" data-module="${module}">
      <div class="app-canvas">
        ${topNavigation(meta.nav, meta.primaryAction)}
        <div class="war-kpis">
          ${meta.kpis
            .map(
              ([label, value, unit, note]) => `
                <article class="list-kpi">
                  <div class="metric-label"><span>${label}</span>${icon("trending-up")}</div>
                  <div class="metric-value"><strong>${value}</strong><small>${unit}</small></div>
                  <div class="metric-foot">${note}</div>
                </article>`,
            )
            .join("")}
        </div>
        <div class="war-layout">
          <aside class="war-panel war-list">
            <div class="war-list-head">
              <div class="war-title-row"><strong>${meta.listTitle}</strong><span class="count-badge">${warListCount[module]}</span></div>
              <div class="war-search">${icon("search")} 搜索名称、编号或负责人</div>
              <div class="war-tabs"><span class="war-tab active">全部</span><span class="war-tab">重点</span><span class="war-tab">本周更新</span></div>
            </div>
            <div class="war-list-body">${renderWarRecord(meta.warRecords)}</div>
          </aside>

          <main class="war-panel war-center">
            <div class="war-center-head">
              <div class="deal-title"><strong>${meta.warTitle}</strong><span>${meta.warMeta}</span></div>
              <div class="center-actions"><button class="button" type="button">${icon("share-2")} 流转</button><button class="button primary" type="button">${icon("check")} 处理</button></div>
            </div>
            <div class="stage-band">
              <div class="step-head"><span>标准化业务作战流程</span><strong>当前阶段：${meta.warSteps[1]}</strong></div>
              <div class="step-dots">${renderWarSteps(meta.warSteps)}</div>
            </div>
            <div class="detail-grid">
              <article class="detail-card">
                <div class="card-head"><strong>基础信息</strong><span>系统自动带入</span></div>
                <div class="info-grid">${renderWarInfo(meta.warInfo.slice(0, 6))}</div>
              </article>
              <article class="detail-card soft">
                <div class="card-head"><strong>当前处理说明</strong><span>最近更新 18 分钟前</span></div>
                <div class="note-box">${meta.warNotes}</div>
              </article>
              <article class="detail-card">
                <div class="card-head"><strong>关键字段</strong><span>${meta.label}口径</span></div>
                <div class="info-grid">${renderWarInfo(meta.warInfo.slice(6))}</div>
              </article>
              <article class="detail-card soft">
                <div class="card-head"><strong>下一步建议</strong><span>业务助手</span></div>
                <div class="note-box">结合当前资料完整度、历史进度和业务规则，建议优先完成关键联系人核验；系统未发现阻断项。</div>
              </article>
            </div>
          </main>

          <aside class="war-panel war-right">
            <div class="right-section">
              <article class="right-card highlight">
                <div class="right-card-title"><strong>业务状态</strong><span>实时快照</span></div>
                <div class="info-grid">${meta.rightTop.map(([label, value]) => `<div class="info-item"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>
              </article>
              <article class="right-card">
                <div class="right-card-title"><strong>近六个月趋势</strong><span>${meta.label}</span></div>
                <div class="bar-chart"><i style="height:44%"></i><i style="height:58%"></i><i style="height:52%"></i><i style="height:69%"></i><i style="height:74%"></i><i style="height:88%"></i></div>
              </article>
              <article class="right-card">
                <div class="right-card-title"><strong>最近动态</strong><span>共 ${meta.timeline.length} 条</span></div>
                <div class="timeline-list">
                  ${meta.timeline.map(([title, note]) => `<div class="timeline-item"><i></i><div><strong>${title}</strong><span>${note}</span></div></div>`).join("")}
                </div>
              </article>
            </div>
          </aside>
        </div>
      </div>
    </section>`;
};

const renderHybridRows = (module) => moduleMeta[module].table.rows.slice(0, 4)
  .map((row) => {
    if (module === "channels") {
      return `<tr><td><span class="record-name">${row[0]}</span><span class="record-meta">${row[1]}</span></td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td>${status(row[6], listStatusTone(row[6]))}</td><td class="amount">${row[7]}</td></tr>`;
    }
    if (module === "opportunities") {
      return `<tr><td><span class="record-name">${row[0]}</span><span class="record-meta">${row[1]}</span></td><td>${row[2]}</td><td>${status(row[3], listStatusTone(row[3]))}</td><td class="amount">${row[4]}</td><td>${row[5]}</td><td>${row[7]}</td></tr>`;
    }
    return `<tr><td><span class="record-name">${row[0]}</span><span class="record-meta">${row[1]}</span></td><td>${row[2]}</td><td class="amount">${row[3]}</td><td>${status(row[4], listStatusTone(row[4]))}</td><td>${row[6]}</td><td>${row[7]}</td></tr>`;
  })
  .join("");

const hybridColumns = {
  channels: ["渠道商", "等级", "区域", "管理员", "状态", "订单金额"],
  opportunities: ["客户 / 商机", "归属渠道", "阶段", "预计金额", "概率", "预计成交"],
  orders: ["订单 / 客户", "渠道商", "合同金额", "状态", "履约进度", "创建时间"],
};

const renderHybridArtboard = (module) => {
  const meta = moduleMeta[module];
  const metrics = meta.kpis.slice(0, 4);
  return `
    <section class="artboard hybrid-artboard" id="artboard-${module}" data-module="${module}">
      <div class="app-canvas">
        <div class="hybrid-shell">
          <aside class="hybrid-rail">
            <span class="hybrid-logo">L</span>
            <span class="rail-icon">${icon("layout-dashboard")}</span>
            <span class="rail-icon">${icon("users")}</span>
            <span class="rail-icon ${module === "opportunities" ? "active" : ""}">${icon("target")}</span>
            <span class="rail-icon ${module === "channels" ? "active" : ""}">${icon("building-2")}</span>
            <span class="rail-icon ${module === "orders" ? "active" : ""}">${icon("shopping-cart")}</span>
            <span class="rail-icon">${icon("bar-chart-3")}</span>
          </aside>
          <main class="hybrid-main">
            <header class="hybrid-topbar">
              <div class="hybrid-breadcrumb"><strong>${meta.title}</strong><span>首页 / ${meta.label} / ${meta.title}</span></div>
              <div class="hybrid-actions"><span class="top-icon">${icon("bell")}<i class="count">5</i></span><span class="user-mini"><span class="user-avatar">刘</span>刘管理员</span><button class="button primary" type="button">${icon("plus")} ${meta.primaryAction}</button></div>
            </header>
            <div class="hybrid-content">
              <div class="hybrid-metrics">
                ${metrics.map(([label, value, unit, note]) => `<article class="hybrid-metric"><span>${label}</span><strong>${value}<small style="display:inline;margin-left:4px;font-size:10px;color:#8391a5">${unit}</small></strong><small>${note}</small></article>`).join("")}
              </div>
              <div class="hybrid-board">
                <section class="hybrid-table-card">
                  <div class="hybrid-card-head"><strong>${meta.listTitle}</strong><span>${meta.listCount} · 实时更新</span></div>
                  <div class="hybrid-filter">
                    <div class="field search">${icon("search")} 搜索名称或编号</div>
                    <div class="field">${icon("filter")} 全部状态 ${icon("chevron-down")}</div>
                    <button class="button soft" type="button">${icon("sliders-horizontal")} 高级筛选</button>
                  </div>
                  <div class="hybrid-table">
                    <table class="data-table"><thead><tr>${hybridColumns[module].map((column) => `<th>${column}</th>`).join("")}</tr></thead><tbody>${renderHybridRows(module)}</tbody></table>
                  </div>
                </section>
                <aside class="hybrid-side-card">
                  <div class="hybrid-card-head"><strong>业务洞察</strong><span>当前周期</span></div>
                  <div class="hybrid-insight">
                    <div class="hybrid-insight-list">
                      ${[
                        ["目标完成率", "82%", 82],
                        ["资料完整率", "92%", 92],
                        ["按期处理率", "94%", 94],
                        ["本月环比", "12%", 68],
                      ]
                        .map(([label, value, progress]) => `<div class="insight-row"><div class="insight-top"><span>${label}</span><strong>${value}</strong></div><div class="progress"><div class="progress-track"><i style="width:${progress}%"></i></div><span>${progress}%</span></div></div>`)
                        .join("")}
                    </div>
                    <div class="hybrid-card-head" style="height:38px;padding:0;margin-top:10px;border-bottom:0"><strong style="font-size:11px">流程完整度</strong><span>已通过 5 / 7 步</span></div>
                    <div class="hybrid-flow">${[1, 2, 3, 4, 5, 6, 7].map((step) => `<span class="${step <= 5 ? "active" : ""}"></span>`).join("")}</div>
                    <div class="note-box" style="margin-top:11px">当前业务主链路完整，权限、状态与审计规则均沿用 V3 正式口径。</div>
                  </div>
                </aside>
              </div>
            </div>
          </main>
        </div>
      </div>
    </section>`;
};

const formField = (label, content, options = {}) => {
  const { required = false, full = false, readonly = false } = options;
  return `
    <div class="form-field ${full ? "full" : ""}">
      <label class="form-label ${required ? "required" : ""}">${label}</label>
      <div class="form-control ${readonly ? "readonly" : ""}">${content}</div>
    </div>`;
};

const formPlaceholder = (text) => `<span class="placeholder">${text}</span>`;

const formSelect = (text) => `<span>${text}</span>${icon("chevron-down")}`;

const renderWizard = (steps, current) => steps
  .map((step, index) => {
    const line = index === 0 ? "" : `<i class="wizard-line ${index <= current ? "done" : ""}"></i>`;
    const state = index < current ? "done" : index === current ? "active" : "";
    const mark = index < current ? icon("check") : index + 1;
    return `${line}<div class="wizard-step ${state}"><span class="wizard-dot">${mark}</span><strong>${step}</strong></div>`;
  })
  .join("");

const renderRuleCard = (title, items) => `
  <article class="create-card side-card">
    <div class="card-head"><strong>${title}</strong></div>
    <ul class="rule-list">${items.map((item) => `<li>${item}</li>`).join("")}</ul>
  </article>`;

const createFlowMeta = {
  "create-registration": {
    nav: "客户管理",
    crumb: "首页 / 客户管理 / 客户报备 / 新建客户报备",
    title: "新建客户报备",
    subtitle: "客户名称支持工商信息查询回填；提交后进入厂商运营审核，审核通过后进入报备保护期。",
    steps: ["客户信息", "项目信息（可选）", "提交确认"],
    current: 0,
    primary: "下一步：项目信息",
    secondary: "保存草稿",
    body: () => `
      <div class="create-card">
        <div class="wizard">${renderWizard(createFlowMeta["create-registration"].steps, 0)}</div>
        <div class="section-title"><span>客户信息</span><em>带 * 为必填项，客户名称与信用代码由工商数据自动校验</em></div>
        <div class="form-grid">
          ${formField("客户名称（全称）", formPlaceholder("输入公司名关键词，自动查询工商信息并回填"), { required: true, full: true })}
          <div class="form-field full">
            <div class="filled-card">
              <div class="filled-head"><strong>${icon("check")} 工商信息已自动回填</strong><span>清除重填</span></div>
              <div class="filled-grid">
                <div><span>统一社会信用代码</span><strong>91440300MA5F8X2D7Q</strong></div>
                <div><span>法定代表人</span><strong>刘振华</strong></div>
                <div><span>经营状态</span><strong>存续</strong></div>
                <div><span>注册地（省市）</span><strong>广东省 · 深圳市</strong></div>
              </div>
            </div>
          </div>
          ${formField("所属行业", formSelect("制造"), { required: true })}
          ${formField("报备来源", formSelect("渠道自主报备"))}
          ${formField("所属区域", "华南区域", { readonly: true })}
          ${formField("归属渠道", "深圳示例数字科技有限公司", { readonly: true })}
          ${formField("客户联系人", "张明", { required: true })}
          ${formField("联系电话", "138****6621", { required: true })}
          ${formField("备注", formPlaceholder("补充说明、竞争情况或客户特殊要求（可选）"), { full: true })}
        </div>
        <div class="create-foot">
          <span class="foot-tip">${icon("info")} 提交前系统自动查重，同客户存在有效报备时会提示归属冲突</span>
          <button class="button" type="button">保存草稿</button>
          <button class="button primary" type="button">下一步：项目信息</button>
        </div>
      </div>
      <aside class="create-side">
        ${renderRuleCard("提交后流转", [
          "① 渠道提交报备，生成报备编号",
          "② 厂商运营审核客户归属与有效期",
          "③ 审核通过进入保护期，可创建商机",
        ])}
        ${renderRuleCard("服务端校验口径", [
          "客户归属、保护期与查重由服务端复核",
          "区域、渠道与创建人取当前登录会话",
          "页面不提交权限与归属字段",
        ])}
      </aside>`,
  },
  "create-opportunity": {
    nav: "商机作战",
    crumb: "首页 / 商机作战 / 新建商机",
    title: "新建商机",
    subtitle: "商机须关联已审批的报备客户；同一客户可创建多个商机，系统会提示已存在商机。",
    primary: "创建商机",
    secondary: "取消",
    body: () => `
      <div class="create-card">
        <div class="section-title"><span>关联报备客户</span><em>仅可选择已审批通过的客户报备</em></div>
        <div class="linked-block">
          <div class="linked-search">${icon("search")}<span>华南某智能制造集团</span><em>重新选择</em></div>
          <div class="linked-grid">
            <div><span>联系人</span><strong>张明</strong></div>
            <div><span>联系电话</span><strong>138****6621</strong></div>
            <div><span>行业</span><strong>制造</strong></div>
            <div><span>报备编号</span><strong>REG202609150021</strong></div>
            <div><span>保护期至</span><strong>2026-12-14</strong></div>
          </div>
          <div class="linked-note">${icon("alert-circle")} 该客户已有 2 个商机：终端安全改造项目（方案确认）、办公电脑防护试点（客户建联），可继续创建新商机</div>
        </div>
        <div class="section-title"><span>商机信息</span><em>阶段、金额与预计签约时间由渠道填写</em></div>
        <div class="form-grid">
          ${formField("商机名称", formPlaceholder("例：华南某智能制造集团终端安全改造项目"), { required: true, full: true })}
          ${formField("当前阶段", formSelect("客户建联"), { required: true })}
          ${formField("端点数量", "1,200", {})}
          ${formField("预计金额（元）", "428,000", { required: true })}
          ${formField("预计签约时间", formSelect("2026-10-18"))}
          ${formField("客户对接人", "张明")}
          ${formField("对接人电话", "138****6621")}
          ${formField("商机来源", formSelect("渠道推荐"))}
          ${formField("标签", "安全改造 × 重点客户 × 预算已确认")}
          ${formField("备注", formPlaceholder("项目背景、竞争情况、关键决策人..."), { full: true })}
          ${formField("首次跟进记录", formPlaceholder("记录线索来源或首次沟通情况（可选）"), { full: true })}
        </div>
        <div class="create-foot">
          <span class="foot-tip">${icon("info")} 商机编号、归属渠道与创建人由服务端生成</span>
          <button class="button" type="button">取消</button>
          <button class="button primary" type="button">创建商机</button>
        </div>
      </div>
      <aside class="create-side">
        ${renderRuleCard("前置条件", [
          "商机必须关联已审批的报备客户",
          "客户尚未报备时，引导先完成客户报备",
          "同一客户可有多个商机，不阻断创建",
        ])}
        ${renderRuleCard("阶段口径", [
          "客户建联 → 客户方案 → 需求挖掘",
          "POC 试用 → 立项推进 → 招投标 → 成单交接",
          "阶段推进与停滞时长进入商机看板统计",
        ])}
      </aside>`,
  },
  "create-quote": {
    nav: "报价管理",
    crumb: "首页 / 报价管理 / 新建报价单",
    title: "新建报价单",
    subtitle: "报价单必须先选已报备客户，并至少关联一个商机；金额、税费与价格版本全部由服务端试算。",
    steps: ["基本信息", "选择报价方式", "确认与试算"],
    current: 1,
    primary: "提交报价",
    secondary: "保存草稿",
    body: () => `
      <div class="create-card">
        <div class="wizard">${renderWizard(createFlowMeta["create-quote"].steps, 1)}</div>
        <div class="section-title"><span>基本信息</span><em>客户与关联商机为必填，金额由服务端试算</em></div>
        <div class="form-grid">
          ${formField("客户名称", formSelect("华南某智能制造集团"), { required: true })}
          ${formField("端点数量", "1,200", { required: true })}
          ${formField("报价有效期", formSelect("30 天"))}
          <div class="form-field full">
            <label class="form-label required">关联商机（至少选择 1 个）</label>
            <div class="opp-picks">
              <div class="opp-pick active">${icon("check")} 终端安全改造项目<em>方案确认 · ¥ 42.8 万</em></div>
              <div class="opp-pick">办公电脑防护试点<em>客户建联 · ¥ 18.8 万</em></div>
            </div>
          </div>
        </div>
        <div class="section-title"><span>选择报价方式</span><em>套餐报价 / 补充功能 / 自定义报价</em></div>
        <div class="mode-cards">
          <div class="mode-card active"><span>套餐报价</span><em>选择标准套餐</em></div>
          <div class="mode-card"><span>补充功能</span><em>在套餐基础上加功能</em></div>
          <div class="mode-card"><span>自定义报价</span><em>自由组合模块</em></div>
        </div>
        <div class="package-row">
          <div class="package-card active"><strong>终端安全基础套餐</strong><span>12 个功能 · 端点授权 1,000 起</span></div>
          <div class="package-card"><strong>终端安全增强套餐</strong><span>18 个功能 · 含 EDR 与运维</span></div>
        </div>
        <div class="create-foot">
          <span class="foot-tip">${icon("info")} 提交后进入折扣审核与客户确认环节，确认后可直接转订单</span>
          <button class="button" type="button">保存草稿</button>
          <button class="button primary" type="button">提交报价</button>
        </div>
      </div>
      <aside class="create-side">
        <article class="create-card side-card highlight">
          <div class="card-head"><strong>报价金额</strong><span>服务端试算</span></div>
          <div class="quote-amount"><span>报价总额</span><strong>¥ 428,600.00</strong></div>
          <div class="quote-lines">
            <div><span>端点数量</span><strong>1,200 点</strong></div>
            <div><span>组合折扣</span><strong>97%</strong></div>
            <div><span>税额</span><strong>¥ 24,262.26</strong></div>
            <div><span>价格版本</span><strong>2026-09</strong></div>
          </div>
          <div class="note-box">金额、折扣与税费由服务端按最新价格版本试算，页面不提交金额字段。</div>
        </article>
        ${renderRuleCard("报价链路", [
          "报价单必须关联至少一个商机",
          "超出授权折扣时自动进入折扣审核",
          "客户确认后支持一键转订单",
        ])}
      </aside>`,
  },
};

const renderCreateArtboard = (module) => {
  const meta = createFlowMeta[module];
  return `
    <section class="artboard tall" id="artboard-${module}" data-module="${module}">
      <div class="app-canvas">
        ${topNavigation(meta.nav)}
        <div class="create-head">
          <div class="create-crumb">${meta.crumb}</div>
          <div class="create-title"><strong>${meta.title}</strong><span>${meta.subtitle}</span></div>
        </div>
        <div class="create-body">${meta.body()}</div>
      </div>
    </section>`;
};

const versionInfo = {
  list: ["宽表工作台", "参考图 1 扩展 · 六项指标 + 高密度筛选表格"],
  war: ["三栏作战室", "六项指标 + 左列表 + 中流程 + 右决策面板 + 新建流程"],
  hybrid: ["品牌融合版", "原评审稿品牌体系 + 参考图高密度工作台"],
};

const versionModules = {
  list: ["channels", "opportunities", "orders"],
  war: ["customers", "opportunities", "quotes", "channels", "orders", "create-registration", "create-opportunity", "create-quote"],
  hybrid: ["channels", "opportunities", "orders"],
};

const renderPage = () => {
  const version = document.body.dataset.version || "list";
  const [title, subtitle] = versionInfo[version];
  const root = document.getElementById("visual-root");
  const renderer = version === "list" ? renderListArtboard : version === "war" ? renderWarArtboard : renderHybridArtboard;
  const modules = versionModules[version] || versionModules.list;

  root.innerHTML = `
    <div class="review-strip">
      <span><strong>联软渠道管理平台 UI 重构视觉稿</strong> · ${title}</span>
      <span>${subtitle}</span>
    </div>
    ${modules.map(renderer).join("")}`;

  if (window.lucide) {
    window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
  }
};

renderPage();
