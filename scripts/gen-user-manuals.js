const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber, PageBreak } = require('docx');

const FONT = '微软雅黑';
const FONT_EN = 'Arial';
const PAGE_W = 11906; // A4
const MARGIN = 1440;  // 1 inch
const CONTENT_W = PAGE_W - MARGIN * 2;

// 通用样式
function makeStyles() {
  return {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: FONT, color: '1a1a1a' },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: FONT, color: '1677ff' },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: FONT, color: '333333' },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  };
}

// 编号配置
function makeNumbering() {
  return {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'steps', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: 'Step %1: ', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 720 } } } }] },
    ]
  };
}

// 通用页面属性
function makePageProps() {
  return {
    page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } },
  };
}

// 辅助函数
function h1(text) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] }); }
function h2(text) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] }); }
function h3(text) { return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] }); }
function p(text, opts = {}) { return new Paragraph({ spacing: { after: 120, line: 360 }, ...opts, children: [new TextRun({ text, font: FONT, size: 21, ...(opts.run || {}) })] }); }
function bold(text) { return new TextRun({ text, bold: true, font: FONT, size: 21 }); }
function normal(text) { return new TextRun({ text, font: FONT, size: 21 }); }
function prun(...runs) { return new Paragraph({ spacing: { after: 120, line: 360 }, children: runs }); }
function bullet(text) { return new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 80, line: 340 }, children: [new TextRun({ text, font: FONT, size: 21 })] }); }
function step(text) { return new Paragraph({ numbering: { reference: 'steps', level: 0 }, spacing: { after: 100, line: 340 }, children: [new TextRun({ text, font: FONT, size: 21 })] }); }
function emptyLine() { return new Paragraph({ spacing: { after: 60 }, children: [] }); }

function makeHeader(title) {
  return new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: title, font: FONT, size: 16, color: '999999' })] })] });
}
function makeFooter() {
  return new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '第 ', font: FONT, size: 16, color: '999999' }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: '999999' }), new TextRun({ text: ' 页', font: FONT, size: 16, color: '999999' })] })] });
}

// 表格辅助
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
function headerCell(text, width) {
  return new TableCell({ borders: BORDERS, width: { size: width, type: WidthType.DXA }, shading: { fill: '1890FF', type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: 'center', children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, font: FONT, size: 20, color: 'FFFFFF' })] })] });
}
function cell(text, width, opts = {}) {
  return new TableCell({ borders: BORDERS, width: { size: width, type: WidthType.DXA }, shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined, margins: { top: 60, bottom: 60, left: 120, right: 120 }, verticalAlign: 'center', children: [new Paragraph({ children: [new TextRun({ text, font: FONT, size: 20, ...(opts.run || {}) })] })] });
}

function makeSimpleTable(headers, rows, colWidths) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  return new Table({ width: { size: totalW, type: WidthType.DXA }, columnWidths: colWidths, rows: [
    new TableRow({ children: headers.map((h, i) => headerCell(h, colWidths[i])) }),
    ...rows.map((row, ri) => new TableRow({ children: row.map((c, i) => cell(c, colWidths[i], ri % 2 === 1 ? { shading: 'F9FAFB' } : {})) }))
  ] });
}

function makeDoc(title, headerTitle, sections) {
  return new Document({
    styles: makeStyles(),
    numbering: makeNumbering(),
    sections: [{
      properties: makePageProps(),
      headers: { default: makeHeader(headerTitle) },
      footers: { default: makeFooter() },
      children: [
        // 封面
        emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: '联软安全产品渠道管理平台', font: FONT, size: 44, bold: true, color: '1677FF' })] }),
        emptyLine(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: title, font: FONT, size: 36, color: '333333' })] }),
        emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '版本：v2.2.0', font: FONT, size: 22, color: '888888' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: '发布日期：2026年4月', font: FONT, size: 22, color: '888888' })] }),
        new Paragraph({ children: [new PageBreak()] }),
        // 目录
        h1('目录'),
        new TableOfContents('目录', { hyperlink: true, headingStyleRange: '1-3' }),
        new Paragraph({ children: [new PageBreak()] }),
        ...sections
      ]
    }]
  });
}

// ===================== 区域管理员手册 =====================
const adminSections = [
  h1('一、系统登录'),
  p('区域管理员通过管理后台入口登录系统。'),
  step('打开浏览器，访问管理后台地址（admin.html）'),
  step('在登录页面输入区域管理员账号和密码'),
  step('点击「登录」按钮进入系统'),
  p('登录后，页面顶部会显示当前登录的区域标识（如「📍 安徽区」），表示当前账号仅能操作本区域的数据。', { run: { color: '666666' } }),
  emptyLine(),

  h1('二、系统导航'),
  p('登录后，左侧导航栏分为以下几个区域：'),
  makeSimpleTable(
    ['导航区域', '功能模块', '说明'],
    [
      ['工作台', '总览仪表盘', '查看本区域业务数据概览'],
      ['业务管理', '商机管理', '查看和管理本区域所有商机'],
      ['业务管理', '客户报备', '查看和管理本区域客户报备'],
      ['业务管理', '报价管理', '查看和管理本区域报价单'],
      ['业务管理', '订单管理', '查看和管理本区域订单'],
      ['产品', '产品目录', '浏览产品信息和推荐套餐'],
      ['管理后台', '经营报表', '查看本区域渠道商经营数据'],
      ['管理后台', '渠道商管理', '管理本区域渠道商及其员工'],
      ['管理后台', '企业管理员', '为渠道企业创建管理员账号'],
      ['管理后台', '审核中心', '审核本区域客户报备申请'],
    ],
    [1800, 3000, 4560]
  ),
  emptyLine(),

  h1('三、功能详细说明'),

  h2('3.1 总览仪表盘'),
  p('仪表盘展示本区域的业务数据概览，包含以下核心指标：'),
  bullet('商机总数及潜在金额'),
  bullet('客户报备总数'),
  bullet('报价单总数'),
  bullet('订单总数及成交金额'),
  bullet('商机销售漏斗（按阶段分布）'),
  p('所有数据均按区域隔离，仅显示本区域的业务数据。', { run: { color: '1677ff' } }),
  emptyLine(),

  h2('3.2 客户报备'),
  h3('3.2.1 新建报备'),
  p('区域管理员新建的报备会自动通过审核，无需等待审批。'),
  step('点击左侧导航「客户报备」，进入报备列表页'),
  step('点击右上角「➕ 新建报备」按钮'),
  step('填写客户信息：客户名称、行业、联系人、电话等'),
  step('可选择同时创建商机'),
  step('点击「提交」，报备自动生效'),
  emptyLine(),

  h3('3.2.2 审核报备'),
  p('在审核中心，区域管理员可以审核本区域渠道商提交的报备申请：'),
  step('进入「审核中心」→「客户报备」标签'),
  step('查看待审核的报备列表'),
  step('点击「✓ 通过」或「✕ 拒绝」进行审核操作'),
  p('已拒绝的报备支持「↻ 重新提交」操作。'),
  emptyLine(),

  h2('3.3 商机管理'),
  p('区域管理员可以查看、创建和管理本区域的所有商机。'),
  bullet('支持列表视图和看板视图切换'),
  bullet('可以按客户、阶段等条件筛选'),
  bullet('可以查看商机详情、跟进记录'),
  bullet('可以推进商机阶段（从"已联系"到"签约中"）'),
  bullet('商机阶段到达"签约中"或"已赢单"时，系统会提示创建报价单或确认转订单'),
  emptyLine(),

  h2('3.4 报价管理'),
  p('区域管理员可以查看和管理本区域所有渠道商创建的报价单。'),
  h3('新建报价'),
  step('从商机列表或报备详情页点击「报价」进入'),
  step('选择已审批的客户报备'),
  step('选择关联商机（至少一个）'),
  step('选择产品/套餐，设置终端数量'),
  step('系统自动计算价格（标准维保服务价格 = 其他软硬件总价 × 15% + 防病毒模块 × 25%）'),
  step('点击「保存报价单」'),
  emptyLine(),

  h3('报价单操作'),
  bullet('发送报价：将报价单发送给客户'),
  bullet('确认报价：客户确认报价'),
  bullet('撤回报价：撤回已发送的报价'),
  bullet('修改报价：修改草稿状态的报价'),
  bullet('删除报价：仅可删除草稿状态的报价'),
  bullet('转订单：将已确认的报价转为订单'),
  emptyLine(),

  h2('3.5 订单管理'),
  p('区域管理员可以管理本区域所有订单的全生命周期。'),
  h3('订单状态流转'),
  makeSimpleTable(
    ['状态', '说明', '操作人'],
    [
      ['待确认 (pending)', '渠道商提交订单', '区管/超管确认'],
      ['一级已确认 (primary_confirmed)', '二级渠道商的上级已确认', '区管/超管确认'],
      ['处理中 (processing)', '订单已确认', '区管/超管确认发货'],
      ['已发货 (shipped)', '已发出货物', '区管/超管确认完成'],
      ['已完成 (completed)', '订单已完成', '无'],
      ['已取消 (cancelled)', '订单已取消', '无'],
    ],
    [2800, 3760, 2800]
  ),
  emptyLine(),
  h3('价格调整'),
  p('区域管理员可以调整本区域订单的价格：'),
  step('点击订单列表中的订单，打开详情'),
  step('在「价格调整」区域点击「调整价格」'),
  step('输入调整后价格和调整原因'),
  step('点击「确认调整」'),
  p('价格调整记录会永久保存在订单详情中。'),
  emptyLine(),

  h2('3.6 渠道商管理'),
  p('管理本区域的渠道合作伙伴。'),
  h3('新增渠道商'),
  p('区域管理员新增的渠道商需经超级管理员审批后才能生效。'),
  step('进入「渠道商管理」，点击「新增渠道商」'),
  step('填写公司名称、合作级别、区域、联系人等信息'),
  step('提交后状态为"待审批"，等待超管审核'),
  emptyLine(),

  h3('渠道商等级管理'),
  p('支持设置渠道商的等级体系：'),
  bullet('一级渠道商（primary）：享受最优价格，可发展二级渠道商'),
  bullet('二级渠道商（secondary）：价格上浮10%，需绑定上级渠道商'),
  bullet('二级渠道商可以绑定多个一级渠道商'),
  emptyLine(),

  h3('员工管理'),
  p('在渠道商详情页，可以管理该渠道商的员工：'),
  bullet('新增员工（需超管审批）'),
  bullet('编辑员工信息'),
  bullet('启用/禁用员工账号'),
  bullet('重置员工密码（重置为初始密码）'),
  emptyLine(),

  h2('3.7 企业管理员'),
  p('为渠道企业创建企业管理员账号。企业管理员可以查看本企业所有员工的数据。'),
  step('进入「企业管理员」页面'),
  step('填写登录账号、姓名、电话、选择所属渠道企业'),
  step('提交创建，等待超管审批'),
  p('企业管理员与普通员工使用相同的渠道伙伴登录入口。'),
  emptyLine(),

  h2('3.8 审核中心'),
  p('区域管理员的审核中心仅包含「客户报备审核」功能。'),
  bullet('可通过/拒绝本区域渠道商提交的报备申请'),
  bullet('不支持渠道商审核和员工审核（仅超管权限）'),
  emptyLine(),

  h2('3.9 经营报表'),
  p('查看本区域渠道商的经营分析数据：'),
  bullet('渠道商业绩排名 TOP5'),
  bullet('合作级别分布'),
  bullet('区域分布统计'),
  bullet('技术服务商统计'),
  bullet('渠道商经营明细（按成交金额/订单数/报价数/员工数排序）'),
  emptyLine(),

  h1('四、注意事项'),
  bullet('区域管理员只能查看和操作本区域的数据，无法跨区域操作'),
  bullet('新增渠道商、员工、企业管理员后需等待超级管理员审批'),
  bullet('管理员创建的客户报备会自动通过，无需审核'),
  bullet('不能修改产品目录（大类、模块、功能、硬件、套餐）'),
  bullet('不能访问账号管理页面（仅超级管理员可访问）'),
  bullet('订单价格调整会记录历史，请谨慎操作'),
  emptyLine(),
];

// ===================== 企业管理员手册 =====================
const partnerAdminSections = [
  h1('一、系统登录'),
  p('企业管理员通过渠道伙伴入口登录系统。'),
  step('打开浏览器，访问渠道伙伴入口地址（partner.html）'),
  step('输入企业管理员账号和密码'),
  step('点击「登录」按钮进入系统'),
  p('登录后，页面顶部会显示「🏢 企业管理员」标识。'),
  emptyLine(),

  h1('二、角色说明'),
  p('企业管理员（partner_admin）是渠道企业的管理者账号，与普通员工的区别：'),
  makeSimpleTable(
    ['权限项', '企业管理员', '普通员工'],
    [
      ['数据范围', '本企业所有员工的数据', '仅自己创建和被指派的数据'],
      ['商机管理', '查看本企业全部商机', '仅查看自己关联的商机'],
      ['客户报备', '查看本企业全部报备', '仅查看自己关联的报备'],
      ['报价管理', '查看本企业全部报价', '仅查看自己创建的报价'],
      ['订单管理', '查看本企业全部订单', '仅查看自己关联的订单'],
    ],
    [2000, 3680, 3680]
  ),
  emptyLine(),

  h1('三、功能详细说明'),

  h2('3.1 总览仪表盘'),
  p('展示本企业的业务数据概览，标注为「🏢 企业管理员」，数据范围覆盖本企业全部员工。'),
  bullet('进行中商机数量及潜在金额'),
  bullet('报备数量'),
  bullet('报价单数量'),
  bullet('订单数量及金额'),
  bullet('商机销售漏斗'),
  emptyLine(),

  h2('3.2 商机管理'),
  p('企业管理员可以查看和管理本企业所有员工创建的商机。'),
  bullet('查看所有商机的列表和看板'),
  bullet('查看任意商机的详情和跟进记录'),
  bullet('推进商机阶段'),
  bullet('在商机详情中快速报价'),
  bullet('新建商机（需关联已审批的客户报备）'),
  emptyLine(),

  h2('3.3 客户报备'),
  p('企业管理员可以查看本企业所有报备记录。'),
  bullet('查看报备列表'),
  bullet('新建报备（提交后需管理员审核）'),
  bullet('查看报备详情和关联商机'),
  p('企业管理员新建的报备需要等待区域管理员审核后才能生效，与普通员工流程一致。'),
  emptyLine(),

  h2('3.4 报价管理'),
  p('企业管理员可以查看本企业所有报价单，并创建新报价。'),
  h3('创建报价单'),
  step('进入「报价管理」→「新建报价」'),
  step('选择客户（从已审批的报备中选择）'),
  step('选择关联商机（至少一个，支持多选）'),
  step('选择产品/套餐'),
  step('设置终端数量，确认价格'),
  step('保存报价单'),
  p('报价单关联商机后，商机阶段会自动推进到"已报价"。'),
  emptyLine(),

  h3('报价单操作'),
  bullet('修改报价：编辑草稿状态的报价'),
  bullet('删除报价：删除草稿状态的报价'),
  bullet('转订单：将已确认报价转为订单'),
  emptyLine(),

  h2('3.5 订单管理'),
  p('企业管理员可以查看本企业所有订单。'),
  bullet('查看订单列表和详情'),
  bullet('查看订单状态流转记录'),
  bullet('查看价格调整记录'),
  p('企业管理员不能执行订单确认、发货、取消等操作（仅区管和超管可以）。'),
  emptyLine(),

  h2('3.6 渠道商信息'),
  p('如果企业管理员同时也是一级渠道商，还可以看到以下管理功能：'),
  bullet('确认/驳回下属二级渠道商的订单'),
  bullet('查看下属二级渠道商的订单'),
  p('这些功能仅在渠道商等级为"一级"时可用。'),
  emptyLine(),

  h1('四、常见问题'),
  h3('Q：为什么看不到某些商机/报备/报价？'),
  p('请确认该数据是否属于本企业员工创建。企业管理员只能看到本企业范围内的数据。'),
  emptyLine(),
  h3('Q：创建报价时为什么看不到关联商机？'),
  p('关联商机需要满足以下条件：'),
  bullet('客户已完成报备且报备已通过审核'),
  bullet('商机状态不是"已赢单"或"已输单"'),
  bullet('商机属于本企业'),
  emptyLine(),
  h3('Q：报备提交后多久能通过？'),
  p('报备由区域管理员审核，通常在1个工作日内完成。如遇紧急情况，请联系区域管理员。'),
  emptyLine(),
];

// ===================== 企业用户手册 =====================
const staffSections = [
  h1('一、系统登录'),
  p('企业用户（普通员工）通过渠道伙伴入口登录系统。'),
  step('打开浏览器，访问渠道伙伴入口地址（partner.html）'),
  step('输入员工账号和密码'),
  step('点击「登录」按钮进入系统'),
  p('登录后，页面顶部会显示「👤 个人数据」标识，表示当前仅展示个人数据。'),
  emptyLine(),

  h1('二、角色说明'),
  p('企业用户（staff）是渠道商的普通销售人员，主要职责是：'),
  bullet('报备客户信息'),
  bullet('跟进和管理商机'),
  bullet('为客户创建报价单'),
  bullet('跟踪订单状态'),
  p('普通员工只能查看自己创建和被指派的数据，无法查看其他同事的数据。'),
  p('如需查看企业全部数据，请联系区域管理员创建企业管理员账号。', { run: { color: '1677ff' } }),
  emptyLine(),

  h1('三、功能详细说明'),

  h2('3.1 总览仪表盘'),
  p('展示个人业务数据概览，标注为「👤 个人数据」。'),
  bullet('个人进行中的商机及金额'),
  bullet('个人报备数量'),
  bullet('个人报价单数量'),
  bullet('个人订单数量及金额'),
  bullet('个人商机销售漏斗'),
  emptyLine(),

  h2('3.2 客户报备'),
  p('客户报备是开展业务的第一步，报备通过后才能创建商机和报价。'),
  h3('新建报备'),
  step('点击左侧导航「客户报备」→「➕ 新建报备」'),
  step('填写客户名称（必填）、行业、联系人、电话等'),
  step('如果客户有统一社会信用代码，建议填写（系统会自动查重）'),
  step('选择所属渠道商（如已自动分配则无需手动选择）'),
  step('可选择同时创建商机'),
  step('点击「提交」'),
  p('提交后需等待区域管理员审核，审核通过后才能进行后续操作。'),
  emptyLine(),

  h3('报备保护期'),
  p('报备审核通过后享有 180 天保护期。保护期内同一客户不会被其他渠道商重复报备。报备到期后系统会提示"⚠️ 即将到期"。'),
  emptyLine(),

  h3('从报备创建商机'),
  p('报备审核通过后，可以在报备详情页点击「🎯 报备商机」快速创建关联商机。'),
  emptyLine(),

  h2('3.3 商机管理'),
  p('商机是销售漏斗的核心，跟踪从接触到签约的全过程。'),
  h3('创建商机'),
  step('点击「商机管理」→「新建商机」'),
  step('选择已审批的客户报备（必选）'),
  step('填写商机名称、预计金额、终端数量等'),
  step('选择商机阶段（默认为"已联系"）'),
  step('点击「保存」'),
  emptyLine(),

  h3('商机阶段'),
  makeSimpleTable(
    ['阶段', '说明', '胜率'],
    [
      ['1% 已联系上客户', '首次接触客户', '低'],
      ['10% 商机明确并报备', '客户报备已通过', '低'],
      ['20% 正式报价', '已向客户发送报价', '中'],
      ['30% 明确预算', '客户已确认预算', '中'],
      ['40% 技术交流/方案设计', '进行技术方案交流', '中'],
      ['50% 产品测试', '产品试用测试中', '中高'],
      ['70% 招投标/商务谈判', '商务谈判阶段', '高'],
      ['90% 签约中', '即将签约', '很高'],
      ['100% 赢单', '项目签约成功', '—'],
    ],
    [3000, 3760, 2600]
  ),
  emptyLine(),
  p('商机阶段可通过拖拽或点击推进，到达"签约中"或"已赢单"时，系统会提示创建报价单。'),
  emptyLine(),

  h3('商机跟进'),
  step('在商机列表点击商机名称，打开详情'),
  step('在详情页右下方「跟进记录」区域填写跟进内容'),
  step('选择跟进类型（拜访、电话、邮件等）'),
  step('点击「添加跟进」'),
  emptyLine(),

  h2('3.4 报价管理'),
  p('为客户创建产品报价单。'),
  h3('创建报价'),
  step('进入「报价管理」→「新建报价」'),
  step('选择客户（从已审批的报备中选择）'),
  step('选择关联商机（至少一个，点击选择）'),
  step('选择报价模式：套餐报价 / 补充报价 / 自定义报价'),
  step('选择具体的产品功能模块和硬件设备'),
  step('设置终端数量，系统自动计算阶梯价格'),
  step('确认价格后点击「保存报价单」'),
  emptyLine(),

  h3('维保服务说明'),
  p('报价中可选择维保产品模块：'),
  bullet('标准维保服务：价格自动计算 = 其他软硬件总价 × 15% + 防病毒模块 × 25%'),
  bullet('原厂现场人工服务：按阶梯定价，手动选择'),
  emptyLine(),

  h3('报价单操作'),
  bullet('修改报价：编辑草稿状态的报价单'),
  bullet('删除报价：删除草稿状态的报价单'),
  bullet('转订单：将已确认的报价转为订单（需区管确认后生效）'),
  emptyLine(),

  h2('3.5 订单管理'),
  p('查看订单状态和跟踪物流。'),
  bullet('查看个人订单列表'),
  bullet('查看订单详情（包含状态、金额、收货地址等）'),
  bullet('查看订单状态流转记录'),
  p('普通员工不能执行订单确认、发货等操作，这些由区域管理员负责。'),
  emptyLine(),

  h1('四、常见问题'),
  h3('Q：报备被拒绝了怎么办？'),
  p('查看拒绝原因，修改后点击「重新提交」。如遇问题，联系区域管理员。'),
  emptyLine(),
  h3('Q：创建报价时为什么看不到关联商机？'),
  p('可能原因：'),
  bullet('该客户还没有通过审核的报备，请先完成客户报备'),
  bullet('该客户确实没有活跃商机（已赢单或已输单的除外），请先创建商机'),
  emptyLine(),
  h3('Q：报价单转订单后多久能发货？'),
  p('订单提交后需要区域管理员确认，确认后进入处理流程。发货时间取决于区域管理员的操作。'),
  emptyLine(),
  h3('Q：想查看团队其他同事的数据怎么办？'),
  p('请联系区域管理员为您的企业创建企业管理员账号，企业管理员可以查看本企业所有员工的数据。'),
  emptyLine(),
  h3('Q：忘记了登录密码怎么办？'),
  p('请联系区域管理员重置您的密码，重置后密码恢复为初始密码。'),
  emptyLine(),
];

// ===================== 生成文件 =====================
async function main() {
  const docs = [
    { name: '区域管理员用户手册', file: '区域管理员用户手册.docx', header: '联软渠道平台 - 区域管理员用户手册', sections: adminSections },
    { name: '企业管理员用户手册', file: '企业管理员用户手册.docx', header: '联软渠道平台 - 企业管理员用户手册', sections: partnerAdminSections },
    { name: '企业用户手册', file: '企业用户手册.docx', header: '联软渠道平台 - 企业用户手册', sections: staffSections },
  ];

  for (const d of docs) {
    const doc = makeDoc(d.name, d.header, d.sections);
    const buffer = await Packer.toBuffer(doc);
    const outPath = `d:\\AI项目及FRP\\第三版\\lianruan-crm-deploy-v2.2.0\\docs\\${d.file}`;
    fs.writeFileSync(outPath, buffer);
    console.log(`✅ ${d.file} 已生成 (${(buffer.length / 1024).toFixed(1)} KB)`);
  }
}

main().catch(console.error);
