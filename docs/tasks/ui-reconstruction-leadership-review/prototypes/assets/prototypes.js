const prototypeData = {
  channels: [
    {
      name: "深圳示例数字科技有限公司",
      meta: "CH-2026-000128",
      level: "核心渠道",
      region: "华南区域",
      admin: "刘海峰",
      members: 24,
      certs: 12,
      status: "合作中",
      kind: "success",
    },
    {
      name: "东莞区域服务中心",
      meta: "二级渠道 · 深圳示例下级",
      level: "二级渠道",
      region: "广东",
      admin: "陈晓宇",
      members: 8,
      certs: 4,
      status: "合作中",
      kind: "success",
    },
    {
      name: "上海启辰信息技术有限公司",
      meta: "CH-2026-000112",
      level: "核心渠道",
      region: "华东区域",
      admin: "周明远",
      members: 18,
      certs: 9,
      status: "合作中",
      kind: "success",
    },
    {
      name: "北京中安网络技术有限公司",
      meta: "CH-2026-000086",
      level: "金牌渠道",
      region: "华北区域",
      admin: "赵思宁",
      members: 31,
      certs: 15,
      status: "待续签",
      kind: "warning",
    },
    {
      name: "成都智联安全服务有限公司",
      meta: "CH-2026-000141",
      level: "认证渠道",
      region: "西南区域",
      admin: "彭奕辰",
      members: 6,
      certs: 3,
      status: "待审批",
      kind: "info",
    },
  ],
  opportunities: [
    {
      no: "OP202609150031",
      customer: "华南某智能制造集团",
      channel: "深圳示例数字科技",
      stage: "方案确认",
      amount: "¥ 428,000",
      probability: 65,
      owner: "张明",
      close: "2026-10-18",
      status: "高概率",
      kind: "success",
    },
    {
      no: "OP202609140026",
      customer: "华东某商业银行",
      channel: "上海启辰信息技术",
      stage: "商务谈判",
      amount: "¥ 680,000",
      probability: 80,
      owner: "陈佳",
      close: "2026-09-30",
      status: "重点推进",
      kind: "warning",
    },
    {
      no: "OP202609120019",
      customer: "某省政务数据中心",
      channel: "北京中安网络技术",
      stage: "需求确认",
      amount: "¥ 516,800",
      probability: 45,
      owner: "周宁",
      close: "2026-11-08",
      status: "正常",
      kind: "info",
    },
    {
      no: "OP202609080014",
      customer: "华北某医疗集团",
      channel: "北京中安网络技术",
      stage: "POC验证",
      amount: "¥ 246,000",
      probability: 55,
      owner: "王卓",
      close: "2026-10-25",
      status: "正常",
      kind: "info",
    },
    {
      no: "OP202609030009",
      customer: "西南某能源集团",
      channel: "成都智联安全服务",
      stage: "初步接触",
      amount: "¥ 188,000",
      probability: 25,
      owner: "李楠",
      close: "2026-12-12",
      status: "需跟进",
      kind: "neutral",
    },
  ],
  orders: [
    {
      no: "SO202609150018",
      customer: "华南某大型制造企业",
      channel: "深圳示例数字科技",
      amount: "¥ 328,600.00",
      status: "待审核",
      kind: "warning",
      created: "2026-09-15 10:28",
      owner: "张明",
    },
    {
      no: "SO202609140032",
      customer: "华东某金融服务机构",
      channel: "上海启辰信息技术",
      amount: "¥ 189,000.00",
      status: "待确认",
      kind: "info",
      created: "2026-09-14 16:42",
      owner: "陈佳",
    },
    {
      no: "SO202609120009",
      customer: "某省政务数据中心",
      channel: "北京中安网络技术",
      amount: "¥ 516,800.00",
      status: "履约中",
      kind: "success",
      created: "2026-09-12 09:16",
      owner: "周宁",
    },
    {
      no: "SO202609080026",
      customer: "华北某医疗集团",
      channel: "北京中安网络技术",
      amount: "¥ 246,000.00",
      status: "已完成",
      kind: "neutral",
      created: "2026-09-08 14:35",
      owner: "王卓",
    },
    {
      no: "SO202609050013",
      customer: "西南某能源集团",
      channel: "成都智联安全服务",
      amount: "¥ 138,500.00",
      status: "已退回",
      kind: "danger",
      created: "2026-09-05 11:02",
      owner: "李楠",
    },
  ],
};

const schemeMeta = {
  command: {
    number: "方案 01",
    title: "深蓝指挥台",
    subtitle: "强调业务全局、待办优先级与高密度表格效率。",
    accent: "业务指挥中心",
  },
  insight: {
    number: "方案 02",
    title: "轻量洞察工作台",
    subtitle: "弱化装饰，使用窄导航、同屏分析与记录详情，适合持续运营。",
    accent: "数据洞察工作台",
  },
  flow: {
    number: "方案 03",
    title: "流程画布",
    subtitle: "以业务阶段和办理路径为主，降低首次使用与跨团队协作门槛。",
    accent: "流程协同画布",
  },
};

const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;

const status = (label, kind = "neutral") =>
  `<span class="status-pill ${kind}">${label}</span>`;

const navItem = (iconName, label, active = false) => `
  <div class="nav-item ${active ? "active" : ""}">
    ${icon(iconName)}
    <span>${label}</span>
  </div>`;

const renderSidebar = (active) => `
  <aside class="app-sidebar">
    <div class="sidebar-brand">
      <span class="brand-mark">L</span>
      <div class="sidebar-brand-copy">
        <strong>联软渠道管理平台</strong>
        <span>渠道 · 商机 · 订单</span>
      </div>
    </div>
    <nav class="app-nav" aria-label="平台导航">
      <span class="nav-caption">业务中心</span>
      ${navItem("layout-dashboard", "工作台")}
      ${navItem("clipboard-list", "客户报备")}
      ${navItem("target", "商机管理", active === "opportunities")}
      ${navItem("file-text", "报价管理")}
      ${navItem("shopping-cart", "订单管理", active === "orders")}
      <span class="nav-caption">渠道与配置</span>
      ${navItem("building-2", "渠道管理", active === "channels")}
      ${navItem("package", "产品目录")}
      ${navItem("badge-check", "审核中心")}
      ${navItem("bar-chart-3", "经营分析")}
    </nav>
  </aside>`;

const renderTopbar = (title) => `
  <header class="app-topbar">
    <div class="topbar-left">
      <span class="topbar-title">厂商管理后台</span>
      <span class="topbar-crumb">/ ${title}</span>
    </div>
    <div class="topbar-right">
      <div class="header-search">${icon("search")} 搜索编号、客户或渠道商</div>
      <button class="icon-button" type="button" aria-label="消息提醒">${icon("bell")}</button>
      <div class="user-chip"><span class="avatar">刘</span><span>刘管理员</span>${icon("chevron-down")}</div>
    </div>
  </header>`;

const renderShell = ({ active, title, content, context }) => `
  <div class="app-shell">
    ${renderSidebar(active)}
    <div class="app-main">
      ${renderTopbar(title)}
      <div class="screen-body">
        <div class="split-grid">
          <main class="content-column">${content}</main>
          <aside class="context-panel">${context}</aside>
        </div>
      </div>
    </div>
  </div>`;

const renderPageHead = (title, description, action, actionIcon = "plus") => `
  <div class="content-page-head">
    <div>
      <h3>${title}</h3>
      <p>${description}</p>
    </div>
    <button class="primary-button" type="button">${icon(actionIcon)} ${action}</button>
  </div>`;

const renderMetricRow = (items) => `
  <div class="metric-row">
    ${items
      .map(
        (item, index) => `
          <article class="metric-card ${index === 0 ? "accent" : ""}">
            <span>${item.label}</span>
            <strong>${item.value}</strong>
            <small>${item.note}</small>
          </article>`,
      )
      .join("")}
  </div>`;

const renderChannelContext = () => `
  <div class="context-head">
    <strong>渠道结构</strong>
    <span>合作状态快照</span>
  </div>
  <div class="context-list">
    ${[
      ["华南区域", "42 家渠道商", 88],
      ["华东区域", "35 家渠道商", 72],
      ["华北区域", "27 家渠道商", 61],
      ["西南区域", "18 家渠道商", 43],
    ]
      .map(
        ([name, note, value]) => `
          <div class="context-row">
            <div class="context-row-main">
              <strong>${name}</strong>
              <span>${note}</span>
            </div>
            <div class="progress-line">
              <div class="progress-track"><i style="width:${value}%"></i></div>
              <span>${value}%</span>
            </div>
          </div>`,
      )
      .join("")}
  </div>
  <div class="screen-note">${icon("shield-check")}<span><strong>资质完整度 92%</strong>，还有 9 家渠道商证书需补充。</span></div>`;

const renderChannels = () => `
  <section class="module-section" id="channels">
    <div class="module-heading">
      <div>
        <span class="module-number">MODULE 01</span>
        <h2>渠道管理</h2>
        <p>团队可以在一屏内掌握渠道层级、区域、成员规模、资质与合作状态。</p>
      </div>
      <span class="scheme-pill">渠道档案 + 分层运营</span>
    </div>
    ${renderShell({
      active: "channels",
      title: "渠道管理",
      content: `
        ${renderPageHead("渠道商管理", "统一维护渠道档案、层级关系、企业管理员和合作状态。", "新建渠道商", "building-2")}
        ${renderMetricRow([
          { label: "渠道商总数", value: "128", note: "本月新增 6 家" },
          { label: "核心渠道", value: "36", note: "覆盖 8 个区域" },
          { label: "待续签", value: "5", note: "30 天内到期" },
          { label: "成员总数", value: "1,284", note: "证书覆盖 92%" },
        ])}
        <div class="filter-panel">
          <div class="filter-row">
            <div class="field grow">${icon("search")} 渠道商名称、统一社会信用代码</div>
            <div class="field">${icon("map-pin")} 全部区域 ${icon("chevron-down")}</div>
            <div class="field">${icon("layers-3")} 全部等级 ${icon("chevron-down")}</div>
            <div class="field">${icon("circle-dot")} 全部状态 ${icon("chevron-down")}</div>
          </div>
          <div class="inline-actions">
            <button class="primary-button" type="button">${icon("search")} 查询</button>
            <button class="ghost-button" type="button">${icon("rotate-ccw")} 重置</button>
          </div>
        </div>
        <div class="data-panel">
          <div class="panel-head"><strong>渠道商列表</strong><span>共 128 家 · 按最近合作活跃度排序</span></div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>渠道商名称</th><th>渠道等级</th><th>所属区域</th><th>企业管理员</th><th>成员 / 证书</th><th>合作状态</th><th>操作</th></tr></thead>
              <tbody>
                ${prototypeData.channels
                  .map(
                    (item) => `
                      <tr>
                        <td><span class="record-title">${item.name}</span><span class="record-sub">${item.meta}</span></td>
                        <td><span class="role-pill">${item.level}</span></td>
                        <td>${item.region}</td>
                        <td>${item.admin}</td>
                        <td>${item.members} 人 / ${item.certs} 项</td>
                        <td>${status(item.status, item.kind)}</td>
                        <td><span class="link-action">查看</span><span class="link-action muted-action">编辑</span></td>
                      </tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
          <div class="pagination"><span>第 1-5 条，共 128 条</span><div class="pagination-pages"><span class="active">1</span><span>2</span><span>3</span><span>...</span><span>26</span></div></div>
        </div>`,
      context: renderChannelContext(),
    })}
  </section>`;

const renderOpportunityContext = () => `
  <div class="context-head">
    <strong>商机漏斗</strong>
    <span>预计金额 ¥ 2,058,800</span>
  </div>
  <div class="funnel">
    ${[
      ["初步接触", "18 条", "100%"],
      ["需求确认", "12 条", "67%"],
      ["方案 / POC", "8 条", "44%"],
      ["商务谈判", "5 条", "28%"],
    ]
      .map(([label, count, ratio]) => `<div class="funnel-row"><span>${label}</span><strong>${count} · ${ratio}</strong></div>`)
      .join("")}
  </div>
  <div class="screen-note">${icon("sparkles")}<span><strong>3 条重点商机</strong>本周需要完成下一步推进。</span></div>`;

const renderOpportunities = () => `
  <section class="module-section" id="opportunities">
    <div class="module-heading">
      <div>
        <span class="module-number">MODULE 02</span>
        <h2>商机管理</h2>
        <p>把阶段、金额、赢单概率、归属渠道和下一步时间放在同一套视图里。</p>
      </div>
      <span class="scheme-pill">商机漏斗 + 推进节奏</span>
    </div>
    ${renderShell({
      active: "opportunities",
      title: "商机管理",
      content: `
        ${renderPageHead("商机管理", "跟踪客户机会、销售阶段、预计金额和关键跟进节点。", "新建商机", "target")}
        <div class="stage-summary">
          ${[
            ["初步接触", "18", "¥ 1.8M", "#7c8ca4"],
            ["需求确认", "12", "¥ 2.4M", "#2f69ed"],
            ["方案 / POC", "8", "¥ 3.1M", "#18a889"],
            ["商务谈判", "5", "¥ 2.1M", "#d5a710"],
            ["预计成交", "3", "¥ 1.2M", "#d14b55"],
          ]
            .map(([label, value, note, color]) => `<article class="stage-card" style="--stage-color:${color}"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`)
            .join("")}
        </div>
        <div class="filter-panel">
          <div class="filter-row">
            <div class="field grow">${icon("search")} 商机编号、客户名称或渠道商</div>
            <div class="field">${icon("git-branch")} 全部阶段 ${icon("chevron-down")}</div>
            <div class="field">${icon("calendar-days")} 本季度 ${icon("chevron-down")}</div>
          </div>
          <div class="inline-actions"><button class="primary-button" type="button">${icon("list-filter")} 筛选</button></div>
        </div>
        <div class="data-panel">
          <div class="panel-head"><strong>商机列表</strong><span>共 46 条 · 预计金额 ¥ 9.6M</span></div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>商机编号 / 客户</th><th>归属渠道</th><th>阶段</th><th>预计金额</th><th>赢单概率</th><th>负责人</th><th>预计成交</th><th>操作</th></tr></thead>
              <tbody>
                ${prototypeData.opportunities
                  .map(
                    (item) => `
                      <tr>
                        <td><span class="record-title">${item.customer}</span><span class="record-sub">${item.no}</span></td>
                        <td>${item.channel}</td>
                        <td>${status(item.stage, "info")}</td>
                        <td class="amount">${item.amount}</td>
                        <td><div class="progress-line"><div class="progress-track"><i style="width:${item.probability}%"></i></div><span>${item.probability}%</span></div></td>
                        <td>${item.owner}</td>
                        <td>${item.close}</td>
                        <td><span class="link-action">查看</span><span class="link-action muted-action">推进</span></td>
                      </tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
          <div class="pagination"><span>第 1-5 条，共 46 条</span><div class="pagination-pages"><span class="active">1</span><span>2</span><span>3</span><span>...</span><span>10</span></div></div>
        </div>`,
      context: renderOpportunityContext(),
    })}
  </section>`;

const renderOrderContext = () => `
  <div class="context-head">
    <strong>交付节奏</strong>
    <span>本月 128 笔订单</span>
  </div>
  <div class="chart-bars">
    ${[
      ["4月", 46],
      ["5月", 58],
      ["6月", 52],
      ["7月", 72],
      ["8月", 66],
      ["9月", 86],
    ]
      .map(([label, height]) => `<div class="chart-bar"><i style="height:${height}%"></i><span>${label}</span></div>`)
      .join("")}
  </div>
  <div class="screen-note">${icon("clock-3")}<span><strong>12 笔订单</strong>已超过当前审批节点 SLA。</span></div>`;

const renderOrders = () => `
  <section class="module-section" id="orders">
    <div class="module-heading">
      <div>
        <span class="module-number">MODULE 03</span>
        <h2>订单管理</h2>
        <p>直接看到订单金额、审批状态、履约阶段、渠道归属和异常滞留。</p>
      </div>
      <span class="scheme-pill">订单状态机 + 履约总览</span>
    </div>
    ${renderShell({
      active: "orders",
      title: "订单管理",
      content: `
        ${renderPageHead("订单管理", "查看订单状态、合同金额、履约进度和审批记录。", "新建订单", "shopping-cart")}
        <div class="order-timeline">
          ${[
            ["1", "提交订单", "今日新增 18"],
            ["2", "商务审核", "待处理 12"],
            ["3", "渠道确认", "待确认 8"],
            ["4", "履约交付", "进行中 36"],
            ["5", "完成归档", "本月 72"],
          ]
            .map(([index, label, note]) => `<div class="order-step"><span class="step-index">${index}</span><div><strong>${label}</strong><span>${note}</span></div></div>`)
            .join("")}
        </div>
        ${renderMetricRow([
          { label: "本月订单", value: "128", note: "合同额 ¥ 1,860 万" },
          { label: "待审核", value: "12", note: "其中超时 3 笔" },
          { label: "履约中", value: "36", note: "按期率 94%" },
          { label: "已完成", value: "72", note: "环比增长 9%" },
        ])}
        <div class="filter-panel">
          <div class="filter-row">
            <div class="field grow">${icon("search")} 订单编号、客户名称或渠道商</div>
            <div class="field">${icon("workflow")} 全部状态 ${icon("chevron-down")}</div>
            <div class="field">${icon("calendar-range")} 2026-09-01 至今 ${icon("chevron-down")}</div>
          </div>
          <div class="inline-actions"><button class="primary-button" type="button">${icon("search")} 查询</button><button class="ghost-button" type="button">${icon("download")} 导出</button></div>
        </div>
        <div class="data-panel">
          <div class="panel-head"><strong>订单列表</strong><span>共 128 笔 · 金额按合同含税价展示</span></div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>订单编号 / 客户</th><th>渠道商</th><th>合同金额</th><th>订单状态</th><th>负责人</th><th>创建时间</th><th>操作</th></tr></thead>
              <tbody>
                ${prototypeData.orders
                  .map(
                    (item) => `
                      <tr>
                        <td><span class="record-title">${item.customer}</span><span class="record-sub">${item.no}</span></td>
                        <td>${item.channel}</td>
                        <td class="amount">${item.amount}</td>
                        <td>${status(item.status, item.kind)}</td>
                        <td>${item.owner}</td>
                        <td>${item.created}</td>
                        <td><span class="link-action">查看</span><span class="link-action muted-action">${item.status === "待审核" ? "审核" : "跟进"}</span></td>
                      </tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
          <div class="pagination"><span>第 1-5 条，共 128 条</span><div class="pagination-pages"><span class="active">1</span><span>2</span><span>3</span><span>...</span><span>26</span></div></div>
        </div>`,
      context: renderOrderContext(),
    })}
  </section>`;

const renderApp = () => {
  const variant = document.body.dataset.variant || "command";
  const meta = schemeMeta[variant] || schemeMeta.command;
  const root = document.getElementById("prototype-root");

  root.innerHTML = `
    <div class="prototype-page">
      <header class="review-header">
        <div class="review-brand">
          <span class="brand-mark">L</span>
          <div class="review-brand-copy">
            <strong>联软渠道管理平台 · UI 重构概念原型</strong>
            <span>${meta.number} · ${meta.title} · 业务规则和权限边界保持不变</span>
          </div>
        </div>
        <div class="review-actions">
          <span class="review-pill">${meta.accent}</span>
          <button class="ghost-button" type="button" onclick="window.print()">${icon("printer")} 打印 / PDF</button>
        </div>
      </header>

      <nav class="module-tabs" aria-label="模块快速定位">
        <button class="module-tab active" type="button" data-target="channels">${icon("building-2")} 渠道管理</button>
        <button class="module-tab" type="button" data-target="opportunities">${icon("target")} 商机管理</button>
        <button class="module-tab" type="button" data-target="orders">${icon("shopping-cart")} 订单管理</button>
      </nav>

      <main class="prototype-content">
        <section class="prototype-intro">
          <div>
            <span class="review-pill">${meta.number}</span>
            <h1>${meta.title}</h1>
            <p>${meta.subtitle} 当前版本同时展示渠道管理、商机管理和订单管理，页面数据仅用于视觉与信息层级评审。</p>
          </div>
          <div class="review-meta">
            <span>${icon("monitor")} 桌面端 1440 基线</span>
            <span>${icon("palette")} 联软科技蓝体系</span>
            <span>${icon("shield-check")} 权限与状态机不变</span>
          </div>
        </section>
        ${renderChannels()}
        ${renderOpportunities()}
        ${renderOrders()}
      </main>
    </div>`;

  const tabs = Array.from(document.querySelectorAll(".module-tab"));
  const sections = Array.from(document.querySelectorAll(".module-section"));

  const setActive = (id) => {
    tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.target === id));
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      document.getElementById(tab.dataset.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(tab.dataset.target);
    });
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0.1, 0.25, 0.5] },
    );
    sections.forEach((section) => observer.observe(section));
  }

  if (window.lucide) {
    window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
  }
};

renderApp();
