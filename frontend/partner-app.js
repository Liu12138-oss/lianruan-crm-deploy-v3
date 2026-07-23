// ============================================================
// 联软安全产品渠道管理平台 — 渠道伙伴应用（后端API版）
// Vue 3 + Vue Router (CDN) + Element Plus
// ============================================================

const { createApp, ref, reactive, computed, watch, onMounted, nextTick } = Vue;
const { createRouter, createWebHashHistory } = VueRouter;

// 企业数据和校验函数（直接使用 window 上的函数，避免重复声明变量）
// window.searchEnterprises, window.validateCreditCode, window.validatePhone 已在 enterprise-data.js 中定义

// API 基础配置（确保 window.API_BASE 已定义）
if (typeof window.API_BASE === 'undefined') {
  window.API_BASE = 'http://localhost:3000/api';
}
// 使用 window.API_BASE，避免重复声明 const

// API 请求辅助函数（如果 api-client.js 已加载则复用）
async function apiRequest(method, endpoint, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(`${window.API_BASE}${endpoint}`, options);
  return res.json();
}

// ── 商机阶段配置（全局定义，供所有组件使用）────────────────────
const STAGES = [
  { key:'contacted',    label:'1% 已联系上客户',   color:'#e6f4ff', dot:'#1677ff' },
  { key:'registered',   label:'10% 商机明确并报备', color:'#fff7e6', dot:'#faad14' },
  { key:'quoted',       label:'20% 正式报价',      color:'#fff0f6', dot:'#eb2f96' },
  { key:'budget',       label:'30% 明确预算',      color:'#f9f0ff', dot:'#722ed1' },
  { key:'design',       label:'40% 技术交流/方案设计', color:'#f6ffed', dot:'#52c41a' },
  { key:'testing',      label:'50% 产品测试',      color:'#fff1f0', dot:'#cf1322' },
  { key:'negotiation',  label:'70% 招投标/商务谈判', color:'#f0faff', dot:'#0891b2' },
  { key:'won',          label:'100% 赢单',        color:'#f6ffed', dot:'#389e0d' },
  { key:'cancelled',    label:'项目取消',          color:'#f5f5f5', dot:'#8c8c8c' },
  { key:'lost',         label:'输单',              color:'#fff1f0', dot:'#cf1322' },
];
function stageLabel(k) { return STAGES.find(s=>s.key===k)?.label || k; }
function stageDot(k)   { return STAGES.find(s=>s.key===k)?.dot   || '#aaa'; }
function stageTagClass(k) {
  return { contacted:'tag-blue', registered:'tag-orange', quoted:'tag-purple',
           budget:'tag-purple', design:'tag-green', testing:'tag-red',
           negotiation:'tag-blue', won:'tag-green', cancelled:'tag-gray', lost:'tag-red' }[k]||'tag-gray';
}
function probColor(p) {
  if (p >= 80) return '#52c41a';
  if (p >= 50) return '#faad14';
  return '#ff4d4f';
}

// ── 全局状态 ────────────────────────────────────────────────
const store = reactive({
  user: null,
  // 商机数据
  opportunities: [
    { id:'OPP-2026-001', name:'北京启明终端安全改造项目', customer:'北京启明科技有限公司', industry:'金融', contact:'张明', phone:'138-0001-0001', stage:'negotiation', amount:280000, endpoints:200, probability:80, source:'渠道推荐', owner:'李销售', createdAt:'2026-02-15', expectedClose:'2026-04-30', lastFollowAt:'2026-03-20', regId:'REG-2026-001', quoteId:'QT-2026-001', tags:['等保三级','重点客户'], notes:'客户已进行2轮技术交流，预算基本确认，等待采购审批。', followUps:[
      { id:1, date:'2026-03-20', type:'拜访', content:'上门拜访，确认终端数量200台，预算约28万，客户希望4月底前完成采购。', user:'李销售' },
      { id:2, date:'2026-03-10', type:'演示', content:'完成产品演示，重点展示EDR和DLP功能，客户反馈良好。', user:'李销售' },
      { id:3, date:'2026-02-20', type:'电话', content:'初次沟通，了解需求背景，客户有等保三级合规压力。', user:'李销售' },
    ]},
    { id:'OPP-2026-002', name:'上海云鼎工厂终端管控', customer:'上海云鼎信息技术有限公司', industry:'制造', contact:'李华', phone:'139-0002-0002', stage:'proposal', amount:160000, endpoints:100, probability:55, source:'市场活动', owner:'王销售', createdAt:'2026-03-01', expectedClose:'2026-05-31', lastFollowAt:'2026-03-18', regId:'REG-2026-002', quoteId:'QT-2026-002', tags:['工厂安全','新客户'], notes:'工厂有大量外协人员，对准入控制和DLP需求强烈。', followUps:[
      { id:1, date:'2026-03-18', type:'邮件', content:'发送报价单，等待客户反馈。', user:'王销售' },
      { id:2, date:'2026-03-08', type:'拜访', content:'拜访工厂IT负责人，了解工厂网络结构。', user:'王销售' },
    ]},
    { id:'OPP-2026-003', name:'广州盛世网络安全准入', customer:'广州盛世网络科技有限公司', industry:'互联网', contact:'王芳', phone:'137-0003-0003', stage:'closing', amount:85000, endpoints:50, probability:90, source:'老客户续约', owner:'张销售', createdAt:'2026-03-10', expectedClose:'2026-03-31', lastFollowAt:'2026-03-22', regId:'REG-2026-003', quoteId:'QT-2026-003', tags:['快速决策'], notes:'合同已进入法务审核，预计本月内签约。', followUps:[
      { id:1, date:'2026-03-22', type:'电话', content:'客户确认合同条款无异议，法务审核中。', user:'张销售' },
    ]},
    { id:'OPP-2026-004', name:'深圳中信数据防泄漏项目', customer:'深圳中信数字安全有限公司', industry:'金融', contact:'陈勇', phone:'136-0004-0004', stage:'prospecting', amount:420000, endpoints:350, probability:20, source:'展会获客', owner:'李销售', createdAt:'2026-03-20', expectedClose:'2026-07-31', lastFollowAt:'2026-03-25', regId:'REG-2026-004', quoteId:null, tags:['大客户','文档加密'], notes:'集团级采购，决策链长，需要多轮拜访。', followUps:[
      { id:1, date:'2026-03-25', type:'电话', content:'初次沟通，客户对文档加密和DLP很感兴趣。', user:'李销售' },
    ]},
    { id:'OPP-2026-005', name:'成都天府政务安全管理', customer:'成都天府大数据有限公司', industry:'政府/央企', contact:'赵主任', phone:'028-8888-0001', stage:'qualification', amount:200000, endpoints:150, probability:40, source:'政府关系', owner:'王销售', createdAt:'2026-03-15', expectedClose:'2026-06-30', lastFollowAt:'2026-03-24', regId:null, quoteId:null, tags:['政府项目','国产化'], notes:'有国产化替代需求，XCAD方案优势明显。', followUps:[
      { id:1, date:'2026-03-24', type:'拜访', content:'拜访信息中心，重点介绍XCAD国产化方案。', user:'王销售' },
      { id:2, date:'2026-03-15', type:'电话', content:'通过政府关系获得线索，初步了解需求。', user:'王销售' },
    ]},
  ],
  notifications: [
    { id:1, title:'报备审核通过', desc:'北京某科技公司 — 客户报备已通过厂商审批', time:'10分钟前', unread:true },
    { id:2, title:'订单待处理', desc:'订单 ORD-2026-0089 等待厂商确认', time:'1小时前', unread:true },
    { id:3, title:'报价单已过期', desc:'QT-2026-0045 报价有效期已届满', time:'昨天', unread:false },
    { id:4, title:'新产品上线', desc:'UniXCAD V5.1 已上架，欢迎选购', time:'2天前', unread:false },
  ],
  registrations: [
    { id:'REG-2026-001', customer:'北京启明科技有限公司', industry:'金融', contact:'张明', phone:'138-0001-0001', status:'approved', createdAt:'2026-03-10', expireAt:'2026-09-10', protectDays:180, notes:'等保三级项目', region:'北区（政府企业）' },
    { id:'REG-2026-002', customer:'上海云鼎信息技术有限公司', industry:'制造', contact:'李华', phone:'139-0002-0002', status:'approved', createdAt:'2026-03-18', expireAt:'2026-09-18', protectDays:180, notes:'工厂终端管理', region:'上海区（非金）' },
    { id:'REG-2026-003', customer:'广州盛世网络科技有限公司', industry:'互联网', contact:'王芳', phone:'137-0003-0003', status:'approved', createdAt:'2026-03-22', expireAt:'2026-09-22', protectDays:180, notes:'', region:'广州区' },
    { id:'REG-2026-004', customer:'深圳中信数字安全有限公司', industry:'金融', contact:'陈勇', phone:'136-0004-0004', status:'expired', createdAt:'2025-09-01', expireAt:'2026-03-01', protectDays:180, notes:'续保项目', region:'深圳区' },
    { id:'REG-2026-005', customer:'成都天府大数据有限公司', industry:'政府/央企', contact:'赵主任', phone:'028-8888-0001', status:'approved', createdAt:'2026-03-15', expireAt:'2026-09-15', protectDays:180, notes:'政务数字化项目', region:'西区' },
    { id:'REG-2026-006', customer:'杭州数智安全科技有限公司', industry:'互联网', contact:'周工', phone:'0571-8899-0001', status:'approved', createdAt:'2026-03-05', expireAt:'2026-09-05', protectDays:180, notes:'零信任改造', region:'浙赣区' },
    { id:'REG-2026-007', customer:'武汉长江信创研究院', industry:'教育', contact:'刘院长', phone:'027-7788-0001', status:'pending', createdAt:'2026-03-25', expireAt:'2026-09-25', protectDays:180, notes:'国产化桌面管理', region:'湖南区' },
    { id:'REG-2026-008', customer:'南京紫金医疗信息科技有限公司', industry:'医疗', contact:'陈主任', phone:'025-6677-0001', status:'reviewing', createdAt:'2026-03-26', expireAt:'2026-09-26', protectDays:180, notes:'HIS系统安全加固', region:'江苏区' },
  ],
  quotes: [
    { id:'QT-2026-001', customer:'北京启明科技有限公司', regId:'REG-2026-001', endpoints:200, products:['UA-AM-1+UA-SoftMgr-1+UA-SS-1','UA-NAC-1','UEDR-AV-1','UA-DLP-Suite'], total:42800, status:'sent', createdAt:'2026-03-15', validDays:30 },
    { id:'QT-2026-002', customer:'上海云鼎信息技术有限公司', regId:'REG-2026-002', endpoints:100, products:['UA-AM-1+UA-SoftMgr-1+UA-SS-1','UA-NAC-1','UEDR-AV-1','UA-DES-Win-1'], total:38000, status:'draft', createdAt:'2026-03-20', validDays:30 },
    { id:'QT-2026-003', customer:'广州盛世网络科技有限公司', regId:'REG-2026-003', endpoints:50, products:['UA-AM-1+UA-SoftMgr-1+UA-SS-1','UA-NAC-1'], total:15500, status:'confirmed', createdAt:'2026-03-22', validDays:30 },
  ],
  orders: [
    { id:'ORD-2026-001', quoteId:'QT-2026-003', customer:'广州盛世网络科技有限公司', total:15500, status:'processing', createdAt:'2026-03-23', deliveryAddr:'广州市天河区某大厦12楼', contacts:'王芳 137-0003-0003' },
    { id:'ORD-2026-002', quoteId:'QT-2026-001', customer:'北京启明科技有限公司', total:42800, status:'shipped', createdAt:'2026-03-12', deliveryAddr:'北京市朝阳区某科技园B座', contacts:'张明 138-0001-0001' },
  ],
  // 管理员账号体系（超级管理员可管理）
  adminAccounts: [
    { id:'A001', username:'admin', name:'联软科技超级管理员', role:'superadmin', bigRegion:'', region:'', avatar:'超', status:'active', createdAt:'2024-01-01', remark:'超级管理员，不可删除' },
    { id:'A002', username:'admin_ah', name:'安徽区管理员', role:'admin', bigRegion:'大东区', region:'安徽区', avatar:'皖', status:'active', createdAt:'2026-01-01', remark:'' },
    { id:'A003', username:'admin_js', name:'江苏区管理员', role:'admin', bigRegion:'大东区', region:'江苏区', avatar:'苏', status:'active', createdAt:'2026-01-01', remark:'' },
    { id:'A004', username:'admin_sh', name:'上海区（非金）管理员', role:'admin', bigRegion:'大东区', region:'上海区（非金）', avatar:'沪', status:'active', createdAt:'2026-01-01', remark:'' },
    { id:'A005', username:'admin_zgj', name:'浙赣区管理员', role:'admin', bigRegion:'大东区', region:'浙赣区', avatar:'浙', status:'active', createdAt:'2026-01-01', remark:'' },
    { id:'A006', username:'admin_sz', name:'深圳区管理员', role:'admin', bigRegion:'大南区', region:'深圳区', avatar:'深', status:'active', createdAt:'2026-01-01', remark:'' },
    { id:'A007', username:'admin_gz', name:'广州区管理员', role:'admin', bigRegion:'大南区', region:'广州区', avatar:'穗', status:'active', createdAt:'2026-01-01', remark:'' },
    { id:'A008', username:'admin_hn', name:'湖南区管理员', role:'admin', bigRegion:'大南区', region:'湖南区', avatar:'湘', status:'active', createdAt:'2026-01-01', remark:'' },
    { id:'A009', username:'admin_west', name:'西区管理员', role:'admin', bigRegion:'西区', region:'西区', avatar:'西', status:'active', createdAt:'2026-01-01', remark:'' },
    { id:'A010', username:'admin_bq', name:'北区（政府企业）管理员', role:'admin', bigRegion:'大北区', region:'北区（政府企业）', avatar:'北', status:'active', createdAt:'2026-01-01', remark:'' },
    { id:'A011', username:'admin_henan', name:'河南区管理员', role:'admin', bigRegion:'大北区', region:'河南区', avatar:'豫', status:'active', createdAt:'2026-01-01', remark:'' },
    { id:'A012', username:'admin_db', name:'东北区管理员', role:'admin', bigRegion:'大北区', region:'东北区', avatar:'东', status:'active', createdAt:'2026-01-01', remark:'' },
    { id:'A013', username:'admin_sd', name:'山东区管理员', role:'admin', bigRegion:'大北区', region:'山东区', avatar:'鲁', status:'active', createdAt:'2026-01-01', remark:'' },
    { id:'A014', username:'admin_jj', name:'晋冀区管理员', role:'admin', bigRegion:'大北区', region:'晋冀区', avatar:'晋', status:'active', createdAt:'2026-01-01', remark:'' },
  ],
  partners: [
    { id:'P001', name:'北京安盾网络科技有限公司', level:'diamond', region:'北区（政府企业）', contact:'刘总', phone:'010-8888-0001', email:'liu@andun.com', status:'active', joinDate:'2023-06-01', quoteCount:28, orderCount:15, totalAmt:1280000, isTechService:true, techServiceType:'full',
      staff: [
        { id:'S001-01', name:'刘建国', username:'liujg', password:'123456', phone:'138-1001-0001', email:'liujg@andun.com', role:'销售经理', status:'active', createdAt:'2023-06-01' },
        { id:'S001-02', name:'王小红', username:'wangxh', password:'123456', phone:'138-1001-0002', email:'wangxh@andun.com', role:'销售代表', status:'active', createdAt:'2023-08-15' },
        { id:'S001-03', name:'张伟', username:'zhangw', password:'123456', phone:'138-1001-0003', email:'zhangw@andun.com', role:'销售代表', status:'inactive', createdAt:'2023-09-01' },
      ]
    },
    { id:'P002', name:'上海锐行信息技术有限公司', level:'gold', region:'上海区（非金）', contact:'孙总', phone:'021-7777-0002', email:'sun@ruixing.com', status:'active', joinDate:'2024-01-15', quoteCount:12, orderCount:6, totalAmt:520000, isTechService:false, techServiceType:'none',
      staff: [
        { id:'S002-01', name:'孙明华', username:'sunmh', password:'123456', phone:'139-2002-0001', email:'sunmh@ruixing.com', role:'销售总监', status:'active', createdAt:'2024-01-15' },
        { id:'S002-02', name:'李婷', username:'liting', password:'123456', phone:'139-2002-0002', email:'liting@ruixing.com', role:'销售代表', status:'active', createdAt:'2024-02-01' },
      ]
    },
    { id:'P003', name:'广州卓越安全解决方案公司', level:'industry', region:'广州区', contact:'赵总', phone:'020-6666-0003', email:'zhao@zy.com', status:'active', joinDate:'2022-11-20', quoteCount:45, orderCount:30, totalAmt:3600000, isTechService:true, techServiceType:'full',
      staff: [
        { id:'S003-01', name:'赵志强', username:'zhaozq', password:'123456', phone:'137-3003-0001', email:'zhaozq@zy.com', role:'总经理', status:'active', createdAt:'2022-11-20' },
        { id:'S003-02', name:'陈美玲', username:'chenml', password:'123456', phone:'137-3003-0002', email:'chenml@zy.com', role:'销售经理', status:'active', createdAt:'2022-12-01' },
        { id:'S003-03', name:'周杰', username:'zhoujie', password:'123456', phone:'137-3003-0003', email:'zhoujie@zy.com', role:'销售代表', status:'active', createdAt:'2023-03-10' },
        { id:'S003-04', name:'吴芳', username:'wufang', password:'123456', phone:'137-3003-0004', email:'wufang@zy.com', role:'销售代表', status:'active', createdAt:'2023-06-20' },
      ]
    },
    { id:'P004', name:'深圳联创安全科技有限公司', level:'lep', region:'深圳区', contact:'黄总', phone:'0755-8888-0004', email:'huang@lianchuang.com', status:'active', joinDate:'2024-06-01', quoteCount:8, orderCount:3, totalAmt:280000, isTechService:false, techServiceType:'developing',
      staff: [
        { id:'S004-01', name:'黄伟', username:'huangw', password:'123456', phone:'136-4004-0001', email:'huangw@lianchuang.com', role:'技术总监', status:'active', createdAt:'2024-06-01' },
      ]
    },
    { id:'P005', name:'成都信安网络工程有限公司', level:'bronze', region:'西区', contact:'杨总', phone:'028-7777-0005', email:'yang@xinan.com', status:'active', joinDate:'2024-08-15', quoteCount:5, orderCount:1, totalAmt:95000, isTechService:false, techServiceType:'none',
      staff: [
        { id:'S005-01', name:'杨帆', username:'yangf', password:'123456', phone:'135-5005-0001', email:'yangf@xinan.com', role:'销售经理', status:'active', createdAt:'2024-08-15' },
      ]
    },
  ],
});

// ── 工具函数 ─────────────────────────────────────────────────
function fmt(n) {
  if (!n && n !== 0) return '—';
  return '¥ ' + Number(n).toLocaleString('zh-CN');
}
function fmtNum(n) {
  if (!n && n !== 0) return '—';
  return Number(n).toLocaleString('zh-CN');
}
function roundMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
function today() {
  return new Date().toISOString().slice(0,10);
}
function genId(prefix) {
  return prefix + '-' + Date.now().toString().slice(-6);
}

function persistPartnerLogin(user, token) {
  store.user = {
    id: user.id,
    name: user.name,
    role: user.role,
    avatar: (user.name || user.username || 'U').slice(0, 1),
    username: user.username,
    partnerId: user.partnerId,
    partnerName: user.partnerName,
    region: user.region,
    _storagePrefix: 'partner_'
  };
  localStorage.setItem('partner_auth_token', token);
  localStorage.setItem('partner_user_info', JSON.stringify(store.user));
  localStorage.setItem('partner_api_user', JSON.stringify({ user: store.user, token }));
  localStorage.setItem('api_user', JSON.stringify({ user: store.user, token }));
  if (typeof syncUser === 'function') {
    syncUser(store.user);
  }
}

// 获取当前用户的渠道商信息（从 partners 数组中通过 partnerId 查找）
function getCurrentPartner() {
  const partnerId = store.user?.partnerId;
  if (partnerId && store.partners) {
    return store.partners.find(p => p.id === partnerId) || null;
  }
  return null;
}

// 获取当前用户区域（渠道商端）
// 多层回退：用户 region → 通过 partnerId 从 partners 数组查找渠道商 region
function getCurrentRegion() {
  if (store.user?.region) return store.user.region;
  // 用户 region 为空时，从所属渠道商获取
  const partner = getCurrentPartner();
  if (partner?.region) return partner.region;
  return '';
}

// 解析功能模块价格配置（含区域覆盖）
// 返回: { tiers, priceFixed, priceForPrimary, priceForSecondary, priceRatioPrimary, priceRatioSecondary, priceSource }
function buildChannelPrice(baseTiers, baseFixed, ratio, fallbackPrice) {
  const ratioValue = Number(ratio);
  if (baseTiers && baseTiers.length && Number.isFinite(ratioValue)) {
    return baseTiers.map(t => ({ ...t, price: roundMoney((Number(t.price) || 0) * ratioValue / 100) }));
  }
  if (baseFixed !== undefined && baseFixed !== null && Number.isFinite(ratioValue)) {
    return roundMoney((Number(baseFixed) || 0) * ratioValue / 100);
  }
  return fallbackPrice ?? null;
}
function regionOverrideMatches(override, region) {
  if (!override || !region || override.enabled === false) return false;
  if (override.region === region) return true;
  return Array.isArray(override.regions) && override.regions.includes(region);
}
function resolveFeaturePriceConfig(feat) {
  if (!feat) return null;
  const region = getCurrentRegion();

  // 默认使用全国价格
  let config = {
    tiers: feat.tiers || null,
    priceFixed: feat.priceFixed || null,
    priceForPrimary: null,
    priceForSecondary: null,
    priceRatioPrimary: feat.priceRatioPrimary ?? 100,
    priceRatioSecondary: feat.priceRatioSecondary ?? 110,
    priceSource: '全国'
  };
  config.priceForPrimary = buildChannelPrice(config.tiers, config.priceFixed, config.priceRatioPrimary, feat.priceForPrimary || null);
  config.priceForSecondary = buildChannelPrice(config.tiers, config.priceFixed, config.priceRatioSecondary, feat.priceForSecondary || null);

  // 查找区域价格覆盖
  if (region && feat.regionPriceOverrides && Array.isArray(feat.regionPriceOverrides)) {
    const override = feat.regionPriceOverrides.find(o => regionOverrideMatches(o, region));
    if (override) {
      // 有覆盖的字段使用覆盖值，未覆盖的回退到全国默认
      if (override.tiers && override.tiers.length > 0) {
        config.tiers = override.tiers;
      }
      if (override.priceFixed !== undefined && override.priceFixed !== null) {
        config.priceFixed = override.priceFixed;
      }
      if (override.priceRatioPrimary !== undefined && override.priceRatioPrimary !== null) {
        config.priceRatioPrimary = override.priceRatioPrimary;
      }
      if (override.priceRatioSecondary !== undefined && override.priceRatioSecondary !== null) {
        config.priceRatioSecondary = override.priceRatioSecondary;
      }
      config.priceForPrimary = buildChannelPrice(config.tiers, config.priceFixed, config.priceRatioPrimary, override.priceForPrimary || null);
      config.priceForSecondary = buildChannelPrice(config.tiers, config.priceFixed, config.priceRatioSecondary, override.priceForSecondary || null);
      config.priceSource = region;
      console.log(`[区域价格] ${feat.name} - 使用${region}价格覆盖`, {
        tiers: config.tiers,
        priceForPrimary: config.priceForPrimary,
        priceForSecondary: config.priceForSecondary
      });
    }
  }

  return config;
}

function getDiscountedTierUnitPrice(feat, tier) {
  if (!tier) return 0;
  if (feat?.unitPrice) {
    return feat.unitPrice * (tier.discount || 1);
  }
  return tier.price || 0;
}

// ── 登录页 ───────────────────────────────────────────────────
const LoginPage = {
  template: `
  <div class="login-page">
    <div class="login-bg-circles"><span/><span/><span/></div>
    <div class="login-card">
      <div class="login-logo">
        <div class="logo-icon">🤝</div>
        <h1>联软渠道管理平台</h1>
        <p>渠道合作伙伴入口 <span class="partner-badge">Partner</span></p>
      </div>
      <div class="form-item" style="margin-bottom:14px">
        <label class="form-label">员工账号</label>
        <input class="form-control" v-model="username" placeholder="请输入员工账号" @keyup.enter="doLogin"/>
      </div>
      <div class="form-item" style="margin-bottom:20px">
        <label class="form-label">密码</label>
        <input class="form-control" type="password" v-model="password" placeholder="请输入密码" @keyup.enter="doLogin"/>
      </div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;padding:11px;font-size:15px" @click="doLogin">
        {{ loading ? '登录中...' : '登 录' }}
      </button>
      
      <!-- SSO 单点登录按钮 -->
      <button v-if="ssoEnabled" class="btn btn-sso" style="width:100%;justify-content:center;padding:11px;font-size:15px;margin-top:12px" @click="doSSOLogin" :disabled="loading">
        🔐 企业账号登录（SSO）
      </button>
      
      <p v-if="errMsg" style="color:#ff4d4f;font-size:13px;text-align:center;margin-top:12px">{{ errMsg }}</p>
      <div class="login-footer">
        <p>请使用已开通的企业管理员或普通员工账号登录。</p>
        <p style="margin-top:2px;color:#bbb">如需开通账号或重置密码，请联系系统管理员。</p>
        <p style="margin-top:4px">© 2026 联软科技 · 渠道管理平台 v2.0</p>
      </div>
    </div>
  </div>`,
  setup() {
    const router = VueRouter.useRouter();
    const username = ref('');
    const password = ref('');
    const loading = ref(false);
    const errMsg = ref('');
    const ssoEnabled = ref(false);
    
    // 检查 SSO 是否启用
    async function checkSSOConfig() {
      try {
        const res = await fetch(`${window.API_BASE}/oauth/config`);
        const data = await res.json();
        ssoEnabled.value = data.enabled;
      } catch (e) {
        ssoEnabled.value = false;
      }
    }
    
    // SSO 登录
    function doSSOLogin() {
      window.location.href = `${window.API_BASE}/oauth/authorize?return=${encodeURIComponent(window.location.origin + '/#/sso_callback')}`;
    }
    
    // 检查 URL 中是否有 SSO 回调数据
    async function checkSSOCallback() {
      const urlParams = new URLSearchParams(window.location.search);
      const data = urlParams.get('data');
      const error = urlParams.get('error');
      
      if (error) {
        errMsg.value = 'SSO 登录失败：' + error;
        window.history.replaceState({}, '', window.location.pathname + '#/login');
        return;
      }
      
      if (data) {
        try {
          const decoded = JSON.parse(atob(data));
          if (decoded.token && decoded.user) {
            store.user = {
              id: decoded.user.id,
              name: decoded.user.name,
              role: decoded.user.role,
              avatar: decoded.user.name?.slice(0, 1) || '👤',
              username: decoded.user.username,
              partnerId: decoded.user.partnerId,
              partnerName: decoded.user.partnerName,
              region: decoded.user.region
            };
            
            localStorage.setItem('partner_auth_token', decoded.token);
            localStorage.setItem('partner_user_info', JSON.stringify(store.user));
            localStorage.setItem('partner_api_user', JSON.stringify({ user: store.user, token: decoded.token }));
            localStorage.setItem('api_user', JSON.stringify({ user: store.user, token: decoded.token }));
            
            window.history.replaceState({}, '', window.location.pathname + '#/dashboard');
            router.push('/dashboard');
            return;
          }
        } catch (e) {
          console.error('SSO callback error:', e);
        }
      }
      
      // 如果用户待审批，显示提示
      if (data) {
        try {
          const decoded = JSON.parse(atob(data));
          if (decoded.user?.status === 'pending') {
            errMsg.value = '您的账号待审批，请联系管理员';
            window.history.replaceState({}, '', window.location.pathname + '#/login');
          }
        } catch (e) {}
      }
    }
    
    // 初始化时检查 SSO 配置和回调
    checkSSOConfig();
    checkSSOCallback();
    
    // 查找员工账号（从所有渠道商的staff中查找）
    function findStaffAccount(username) {
      for (const partner of store.partners) {
        if (partner.staff) {
          const staff = partner.staff.find(s => s.username === username && s.status === 'active');
          if (staff) {
            return { ...staff, partnerId: partner.id, partnerName: partner.name, region: partner.region };
          }
        }
      }
      return null;
    }
    
    async function doLogin() {
      errMsg.value = '';
      if (!username.value || !password.value) { errMsg.value = '请输入账号和密码'; return; }
      
      loading.value = true;
      try {
        // 调用后端 API 登录
        const res = await apiRequest('POST', '/auth/login', {
          username: username.value,
          password: password.value
        });
        
        if (res.error) {
          errMsg.value = res.error;
          loading.value = false;
          return;
        }
        
        // 检查是否为员工角色或企业管理员角色
        if (res.user.role !== 'staff' && res.user.role !== 'partner_admin') {
          errMsg.value = '此入口仅开放给渠道合作伙伴员工或企业管理员';
          loading.value = false;
          return;
        }
        
        store.user = {
          id: res.user.id,
          name: res.user.name,
          role: res.user.role,
          avatar: res.user.name.slice(0,1),
          username: username.value,
          partnerId: res.user.partnerId,
          partnerName: res.user.partnerName,
          region: res.user.region,
          _storagePrefix: 'partner_'  // 保存前缀信息，便于 syncUser 正确读取
        };
        
            // 保存 token（使用独立前缀，避免与其他应用冲突）
            localStorage.setItem('partner_auth_token', res.token);
            localStorage.setItem('partner_user_info', JSON.stringify(store.user));
            localStorage.setItem('partner_api_user', JSON.stringify({ user: store.user, token: res.token }));
            // 同步到 apiClient 的 currentUser（修复报价单/商机/订单等列表查询的过滤参数问题）
            if (typeof syncUser === 'function') {
              syncUser(store.user);
            }

        if (Array.isArray(res.notifications)) {
          store.notifications = normalizeNotifications(res.notifications);
        } else {
          await loadNotificationsFromServer();
        }
        
        router.push('/dashboard');
        setTimeout(() => showLoginDueReminderDialog(getLoginDueReminders(res)), 300);
      } catch (err) {
        errMsg.value = '登录失败：' + err.message;
      }
      loading.value = false;
    }
    
    return { username, password, loading, errMsg, ssoEnabled, doLogin, doSSOLogin };
  }
};

const PartnerSingleSignOnPageV2 = {
  template: `
  <div class="login-page">
    <div class="login-bg-circles"><span/><span/><span/></div>
    <div class="login-card">
      <div class="login-logo">
        <div class="logo-icon">SSO</div>
        <h1>Partner Single Sign-On</h1>
        <p>Validating IAM login token <span class="partner-badge">V2</span></p>
      </div>
      <p style="font-size:14px;text-align:center;color:#666;line-height:1.7">{{ message }}</p>
      <button v-if="showBack" class="btn btn-primary" style="width:100%;justify-content:center;padding:11px;font-size:15px;margin-top:18px" @click="goLogin">
        Back To Login
      </button>
    </div>
  </div>`,
  setup() {
    const router = VueRouter.useRouter();
    const showBack = ref(false);
    const message = ref('Validating IAM login token...');

    function goLogin() {
      router.replace('/login');
    }

    async function doSingleSignOn() {
      if (store.user) {
        router.replace('/dashboard');
        return;
      }

      const hash = window.location.hash || '';
      const queryString = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
      const urlParams = new URLSearchParams(queryString);
      const token = (urlParams.get('token') || '').trim();
      if (!token) {
        message.value = 'Missing SSO token. Please enter again from IAM.';
        showBack.value = true;
        return;
      }

      try {
        const res = await apiRequest('POST', '/sso/iam/partner-login-v2', { token });
        if (!res.success || !res.user || !res.token) {
          throw new Error(res.error || 'Single sign-on failed');
        }
        persistPartnerLogin(res.user, res.token);
        if (Array.isArray(res.notifications)) {
          store.notifications = normalizeNotifications(res.notifications);
        } else {
          await loadNotificationsFromServer();
        }
        window.history.replaceState({}, '', `${window.location.pathname}#/dashboard`);
        router.replace('/dashboard');
        setTimeout(() => showLoginDueReminderDialog(getLoginDueReminders(res)), 300);
      } catch (err) {
        message.value = err.message || 'Single sign-on failed';
        showBack.value = true;
      }
    }

    doSingleSignOn();
    return { message, showBack, goLogin };
  }
};

// ── 布局 ─────────────────────────────────────────────────────
const MainLayout = {
  template: `
  <div class="main-layout" v-if="store.user">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-mark">🛡️</div>
        <div class="logo-text">联软渠道平台<small>Channel Portal</small></div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-group-title">工作台</div>
        <div class="nav-item" :class="{active:$route.path==='/dashboard'}" @click="go('/dashboard')">
          <span class="nav-icon">📊</span> 总览仪表盘
        </div>

        <div class="nav-group-title">业务管理</div>
        <div class="nav-item" :class="{active:$route.path.startsWith('/opportunity')}" @click="go('/opportunity')">
          <span class="nav-icon">🎯</span> 商机管理
          <span class="nav-badge" v-if="hotOppCount">{{ hotOppCount }}</span>
        </div>
        <div class="nav-item" :class="{active:$route.path.startsWith('/registration')}" @click="go('/registration')">
          <span class="nav-icon">📋</span> 客户报备
          <span class="nav-badge" v-if="pendingCount">{{ pendingCount }}</span>
        </div>
        <div class="nav-item" :class="{active:$route.path.startsWith('/quote')}" @click="go('/quote')">
          <span class="nav-icon">💰</span> 报价管理
        </div>
        <div class="nav-item" :class="{active:$route.path.startsWith('/order')}" @click="go('/order')">
          <span class="nav-icon">📦</span> 订单管理
        </div>

        <div class="nav-group-title">产品</div>
        <div class="nav-item" :class="{active:$route.path==='/products'}" @click="go('/products')">
          <span class="nav-icon">🗂️</span> 产品目录
        </div>
      </nav>
      <div class="sidebar-footer">
        <div class="user-card">
          <div class="user-avatar" style="background:linear-gradient(135deg, #faad14, #ff7a45)">👤</div>
          <div class="user-info">
            <div class="name">{{ store.user.name.slice(0,8) }}{{ store.user.name.length>8?'…':'' }}</div>
            <div class="user-actions">
              <a @click.stop="openChangePassword">修改密码</a>
              <span class="separator"> | </span>
              <a @click.stop="logout">退出登录</a>
            </div>
          </div>
        </div>
      </div>
    </aside>
    
    <!-- 修改密码弹窗 -->
    <div class="modal-overlay" v-if="showChangePassword" @click.self="showChangePassword=false">
      <div class="modal" style="max-width:420px">
        <div class="modal-header">
          <div class="modal-title">修改密码</div>
          <span class="modal-close" @click="showChangePassword=false">✕</span>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">当前密码</label>
            <input class="form-control" type="password" v-model="passwordForm.oldPassword" placeholder="请输入当前密码"/>
          </div>
          <div class="form-item">
            <label class="form-label">新密码</label>
            <input class="form-control" type="password" v-model="passwordForm.newPassword" placeholder="请输入新密码（至少6位）"/>
          </div>
          <div class="form-item">
            <label class="form-label">确认新密码</label>
            <input class="form-control" type="password" v-model="passwordForm.confirmPassword" placeholder="请再次输入新密码"/>
          </div>
          <div v-if="passwordError" style="color:#ff4d4f;font-size:13px;margin-top:8px">{{ passwordError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showChangePassword=false">取消</button>
          <button class="btn btn-primary" @click="doChangePassword" :disabled="passwordLoading">
            {{ passwordLoading ? '提交中...' : '确认修改' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 主内容 -->
    <div class="content-area">
      <header class="top-header">
        <div class="breadcrumb">
          <span class="parent">联软渠道平台</span>
          <span class="sep">›</span>
          <span class="current">{{ pageTitle }}</span>
        </div>
        <div class="header-actions">
          <button class="header-btn" @click="showNotif=!showNotif" title="通知">
            🔔
            <span class="notif-dot" v-if="unreadCount"></span>
          </button>
          <button class="header-btn" title="帮助">❓</button>
          <div style="font-size:13px;color:#666">{{ store.user.name.slice(0,6) }}{{ store.user.name.length>6?'…':'' }}</div>
        </div>
      </header>
      <div class="page-body">
        <router-view />
      </div>
    </div>

    <!-- 通知面板 -->
    <div class="notif-panel" :class="{open:showNotif}">
      <div style="padding:16px 20px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center">
        <strong style="font-size:15px">通知中心</strong>
        <span style="font-size:13px;color:#1677ff;cursor:pointer" @click="markAllRead">全部已读</span>
      </div>
      <div style="flex:1;overflow-y:auto">
        <div v-for="n in store.notifications" :key="n.id" class="notif-item" :class="{unread:n.unread}" @click="markNotificationRead(n)">
          <div class="ni-title">{{ n.title }}</div>
          <div class="ni-desc">{{ n.desc }}</div>
          <div class="ni-time">{{ n.time }}</div>
        </div>
      </div>
    </div>
    <div v-if="showNotif" style="position:fixed;inset:0;z-index:997" @click="showNotif=false"></div>
  </div>`,
  setup() {
    const router = VueRouter.useRouter();
    const route = VueRouter.useRoute();
    const showNotif = ref(false);
    const isAdmin = computed(() => store.user?.role === 'admin' || store.user?.role === 'superadmin');
    const isSuperAdmin = computed(() => store.user?.role === 'superadmin');
    const isPartnerAdmin = computed(() => store.user?.role === 'partner_admin');
    const unreadCount = computed(() => store.notifications.filter(n=>n.unread).length);
    
    // 区域管理员隔离
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    
    // 辅助函数：获取报备的区域
    function getRegRegion(regId) {
      const reg = store.registrations.find(r => r.id === regId);
      return reg ? reg.region : null;
    }
    
    // 本区域待审核报备数
    const pendingCount = computed(() => {
      let list = store.registrations.filter(r => r.status === 'pending');
      if (adminRegion.value) {
        list = list.filter(r => r.region === adminRegion.value);
      }
      return list.length;
    });
    
    // 本区域签约中商机数
    const hotOppCount = computed(() => {
      let list = store.opportunities.filter(o => o.stage === 'closing');
      if (adminRegion.value) {
        list = list.filter(o => {
          const region = getRegRegion(o.regId);
          return region === adminRegion.value;
        });
      }
      return list.length;
    });
    
    // 本区域待审核报备数（用于审核中心badge）
    const reviewCount = computed(() => {
      let list = store.registrations.filter(r => r.status === 'pending' || r.status === 'reviewing');
      if (adminRegion.value) {
        list = list.filter(r => r.region === adminRegion.value);
      }
      return list.length;
    });
    const pageTitles = {
      '/dashboard': '总览仪表盘',
      '/opportunity': '商机管理',
      '/registration': '客户报备',
      '/registration/new': '新建报备',
      '/quote': '报价管理',
      '/quote/new': '新建报价',
      '/order': '订单管理',
      '/products': '产品目录',
    };
    const pageTitle = computed(() => {
      for (const [k,v] of Object.entries(pageTitles)) {
        if (route.path.startsWith(k) && route.path !== '/') return v;
      }
      return '工作台';
    });
    function go(p) { router.push(p); }
    function logout() {
      if (confirm('确认退出登录？')) {
        // 清理 localStorage 中的登录数据
        localStorage.removeItem('partner_user_info');
        localStorage.removeItem('partner_auth_token');
        localStorage.removeItem('partner_api_user');
        localStorage.removeItem('api_user');
        store.user = null;
        router.push('/login');
      }
    }
    function markAllRead() {
      store.notifications.forEach(n => n.unread = false);
      markAllNotificationsRead();
    }
    
    // 修改密码相关
    const showChangePassword = ref(false);
    const passwordForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' });
    const passwordError = ref('');
    const passwordLoading = ref(false);
    
    function openChangePassword() {
      passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
      passwordError.value = '';
      showChangePassword.value = true;
    }
    
    async function doChangePassword() {
      passwordError.value = '';
      const { oldPassword, newPassword, confirmPassword } = passwordForm.value;
      
      if (!oldPassword) { passwordError.value = '请输入当前密码'; return; }
      if (!newPassword) { passwordError.value = '请输入新密码'; return; }
      if (newPassword.length < 6) { passwordError.value = '新密码长度不能少于6位'; return; }
      if (newPassword !== confirmPassword) { passwordError.value = '两次输入的新密码不一致'; return; }
      
      passwordLoading.value = true;
      try {
        const res = await apiRequest('PUT', '/auth/password', {
          userId: store.user.id,
          oldPassword,
          newPassword
        });
        
        if (res.success) {
          alert('密码修改成功！');
          showChangePassword.value = false;
        } else {
          passwordError.value = res.error || '修改失败';
        }
      } catch (err) {
        passwordError.value = '操作失败：' + err.message;
      }
      passwordLoading.value = false;
    }
    
    return { store, showNotif, isAdmin, isSuperAdmin, isPartnerAdmin, unreadCount, pendingCount, hotOppCount, reviewCount, pageTitle, go, logout, markAllRead, markNotificationRead,
      showChangePassword, passwordForm, passwordError, passwordLoading, openChangePassword, doChangePassword };
  }
};

// ── 仪表盘 ───────────────────────────────────────────────────
const Dashboard = {
  template: `
  <div>
    <!-- 页面标题 -->
    <div style="margin-bottom:20px">
      <h2 style="font-size:18px;font-weight:700;color:#1a1a1a">总览仪表盘</h2>
      <p style="font-size:13px;color:#888;margin-top:4px">
        业务数据概览与关键指标
        <span v-if="adminRegion" class="tag tag-blue" style="margin-left:8px;font-size:12px">📍 {{ adminRegion }}</span>
        <span v-if="isPartnerAdmin" class="tag tag-purple" style="margin-left:8px;font-size:12px">🏢 企业管理员</span>
        <span v-else-if="isStaff" class="tag tag-orange" style="margin-left:8px;font-size:12px">👤 个人数据</span>
      </p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon blue">🎯</div>
        <div>
          <div class="stat-value">{{ myOpportunities.length }}</div>
          <div class="stat-label">进行中商机</div>
          <div class="stat-trend up">↑ 潜在价值 {{ fmt(totalOppAmt) }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">📋</div>
        <div>
          <div class="stat-value">{{ myRegistrations.length }}</div>
          <div class="stat-label">客户报备总数</div>
          <div class="stat-trend up">↑ 本月新增 2 条</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">💰</div>
        <div>
          <div class="stat-value">{{ myQuotes.length }}</div>
          <div class="stat-label">报价单总数</div>
          <div class="stat-trend up">↑ 本月新增 3 份</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">💎</div>
        <div>
          <div class="stat-value">{{ fmt(totalOrderAmt) }}</div>
          <div class="stat-label">累计成交金额</div>
          <div class="stat-trend up">↑ 同比增长 32%</div>
        </div>
      </div>
    </div>

    <!-- 快捷入口 -->
    <div class="quick-actions">
      <div class="quick-action" @click="go('/opportunity/new')">
        <div class="qa-icon" style="background:#fff0f6">🎯</div>
        <div><div class="qa-title">新建商机</div><div class="qa-desc">录入潜在客户</div></div>
      </div>
      <div class="quick-action" @click="go('/registration/new')">
        <div class="qa-icon" style="background:#e6f4ff">📝</div>
        <div><div class="qa-title">新建报备</div><div class="qa-desc">登记意向客户</div></div>
      </div>
      <div class="quick-action" @click="go('/quote/new')">
        <div class="qa-icon" style="background:#f6ffed">💡</div>
        <div><div class="qa-title">制作报价单</div><div class="qa-desc">在线配置产品</div></div>
      </div>
      <div class="quick-action" @click="go('/order')">
        <div class="qa-icon" style="background:#fff7e6">📦</div>
        <div><div class="qa-title">查看订单</div><div class="qa-desc">跟踪订单状态</div></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <!-- 最近商机 -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">近期商机</div>
          <button class="btn btn-text btn-sm" @click="go('/opportunity')">查看全部 →</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>商机名称</th><th>阶段</th><th>金额</th></tr></thead>
            <tbody>
              <tr v-for="o in myOpportunities.slice(0,4)" :key="o.id" style="cursor:pointer">
                <td style="font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ o.name }}</td>
                <td><span class="tag" :class="stageTagClass(o.stage)" style="font-size:11px">{{ stageLabel(o.stage) }}</span></td>
                <td style="font-weight:700;color:#1677ff">{{ fmt(o.amount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 最近报价 -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">最近报价单</div>
          <button class="btn btn-text btn-sm" @click="go('/quote')">查看全部 →</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>客户</th><th>金额</th><th>状态</th></tr></thead>
            <tbody>
              <tr v-for="q in myQuotes" :key="q.id">
                <td>{{ q.customer.slice(0,8) }}…</td>
                <td style="font-weight:600;color:#1677ff">{{ fmt(q.total) }}</td>
                <td><span class="tag" :class="quoteStatusClass(q.status)">{{ quoteStatusLabel(q.status) }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 产品概览 -->
    <div class="card" style="margin-top:20px">
      <div class="card-header">
        <div class="card-title">主力产品线</div>
        <button class="btn btn-text btn-sm" @click="go('/products')">产品目录 →</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px">
        <div v-for="p in productHighlights" :key="p.name"
          style="background:#fafcff;border:1px solid #e6f0ff;border-radius:10px;padding:14px;text-align:center;cursor:pointer"
          @click="go('/products')">
          <div style="font-size:28px;margin-bottom:8px">{{ p.icon }}</div>
          <div style="font-size:13px;font-weight:700;color:#1a1a1a">{{ p.name }}</div>
          <div style="font-size:11px;color:#888;margin-top:3px">{{ p.count }} 款产品</div>
        </div>
      </div>
    </div>

    <!-- 商机漏斗 -->
    <div class="card" style="margin-top:20px">
      <div class="card-header">
        <div class="card-title">商机销售漏斗</div>
        <button class="btn btn-text btn-sm" @click="go('/opportunity')">查看全部 →</button>
      </div>
      <div style="display:flex;gap:10px;align-items:flex-end;height:120px;padding:0 8px">
        <div v-for="s in funnelStages" :key="s.key" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px">
          <div style="font-size:13px;font-weight:700;color:#1a1a1a">{{ s.count }}</div>
          <div :style="{height: s.height+'px', width:'100%', background: s.color, borderRadius:'6px 6px 0 0', transition:'height .4s'}"></div>
          <div style="font-size:12px;color:#888;text-align:center;white-space:nowrap">{{ s.label }}</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
        <div v-for="s in funnelStages" :key="s.key" style="display:flex;align-items:center;gap:6px;font-size:12px;color:#555">
          <span :style="{width:'10px',height:'10px',borderRadius:'2px',background:s.color,display:'inline-block'}"></span>
          {{ s.label }}：{{ fmt(s.amount) }}
        </div>
      </div>
    </div>
  </div>`,
  setup() {
    const router = VueRouter.useRouter();
    const go = (p) => router.push(p);
    
    // 区域管理员隔离：获取本区域数据
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    // 员工隔离（统一使用 id 字段，与后端数据一致）
    const userId = computed(() => store.user?.id || '');
    const isStaff = computed(() => store.user?.role === 'staff' || store.user?.role === 'partner_admin');
    const isPartnerAdmin = computed(() => store.user?.role === 'partner_admin');
    
    // 辅助函数：获取报备的区域
    function getRegRegion(regId) {
      const reg = store.registrations.find(r => r.id === regId);
      return reg ? reg.region : null;
    }
    
    // 本区域/本人商机
    const myOpportunities = computed(() => {
      const partnerId = store.user?.partnerId;
      const isPartnerAdmin = store.user?.role === 'partner_admin';
      // 企业管理员（partner_admin）：看本企业的全部商机
      if (isPartnerAdmin && partnerId) {
        return store.opportunities.filter(o => o.partnerId === partnerId);
      }
      // 普通员工：自己创建的 + 被指派给自己的
      if (isStaff.value) {
        return store.opportunities.filter(o => 
          o.ownerId === userId.value || 
          o.createdBy === userId.value ||
          o.assignedStaffId === userId.value
        );
      }
      if (adminRegion.value) {
        // 区域管理员看本区域商机
        return store.opportunities.filter(o => {
          const region = getRegRegion(o.regId);
          return region === adminRegion.value;
        });
      }
      // 超级管理员看全部
      return store.opportunities;
    });
    
    // 本区域/本人报备
    const myRegistrations = computed(() => {
      const partnerId = store.user?.partnerId;
      const isPartnerAdmin = store.user?.role === 'partner_admin';
      // 企业管理员（partner_admin）：看本企业的全部报备
      if (isPartnerAdmin && partnerId) {
        return store.registrations.filter(r => r.partnerId === partnerId);
      }
      // 普通员工：自己创建的 + 被指派给自己的
      if (isStaff.value) {
        return store.registrations.filter(r => 
          r.createdBy === userId.value || 
          r.assignedStaffId === userId.value
        );
      }
      if (adminRegion.value) {
        // 区域管理员看本区域报备
        return store.registrations.filter(r => r.region === adminRegion.value);
      }
      // 超级管理员看全部
      return store.registrations;
    });
    
    // 本区域/本人报价单
    const myQuotes = computed(() => {
      const partnerId = store.user?.partnerId;
      const isPartnerAdmin = store.user?.role === 'partner_admin';
      // 企业管理员（partner_admin）：看本企业的全部报价单
      if (isPartnerAdmin && partnerId) {
        return store.quotes.filter(q => q.partnerId === partnerId);
      }
      // 普通员工：自己创建的 + 被指派给自己的
      if (isStaff.value) {
        return store.quotes.filter(q => 
          q.ownerId === userId.value || 
          q.createdBy === userId.value ||
          q.assignedStaffId === userId.value
        );
      }
      if (adminRegion.value) {
        // 区域管理员看本区域报价单
        return store.quotes.filter(q => {
          const region = getRegRegion(q.regId);
          return region === adminRegion.value;
        });
      }
      // 超级管理员看全部
      return store.quotes;
    });
    
    // 本区域/本人订单
    const myOrders = computed(() => {
      const partnerId = store.user?.partnerId;
      const isPartnerAdmin = store.user?.role === 'partner_admin';
      // 企业管理员（partner_admin）：看本企业的全部订单
      if (isPartnerAdmin && partnerId) {
        return store.orders.filter(o => o.partnerId === partnerId);
      }
      // 普通员工：自己创建的 + 被指派给自己的
      if (isStaff.value) {
        return store.orders.filter(o => 
          o.createdBy === userId.value || 
          o.assignedStaffId === userId.value
        );
      }
      if (adminRegion.value) {
        // 区域管理员看本区域订单（优先使用订单自身的region字段）
        return store.orders.filter(o => {
          // 优先使用订单自身的region字段，如果没有则通过customer查找报备
          if (o.region) return o.region === adminRegion.value;
          const reg = store.registrations.find(r => r.customer === o.customer);
          return reg && reg.region === adminRegion.value;
        });
      }
      // 超级管理员看全部
      return store.orders;
    });
    
    const totalOrderAmt = computed(() => myOrders.value.reduce((s,o)=>s+o.total,0));
    const totalOppAmt = computed(() => myOpportunities.value.reduce((s,o)=>s+o.amount,0));
    const productHighlights = [
      { icon:'🖥️', name:'桌面安全管理', count:4 },
      { icon:'🔒', name:'网络准入控制', count:2 },
      { icon:'🦠', name:'防病毒/EDR', count:2 },
      { icon:'🚫', name:'数据防泄漏', count:8 },
      { icon:'🔐', name:'文档加密', count:1 },
    ];
    const stageConfig = [
      { key:'contacted', label:'已联系', color:'#bae0ff', maxH:80 },
      { key:'registered', label:'已报备', color:'#91caff', maxH:80 },
      { key:'quoted', label:'已报价', color:'#4096ff', maxH:80 },
      { key:'budget', label:'已预算', color:'#1677ff', maxH:80 },
      { key:'design', label:'方案设计', color:'#52c41a', maxH:80 },
      { key:'testing', label:'产品测试', color:'#faad14', maxH:80 },
      { key:'negotiation', label:'商务谈判', color:'#722ed1', maxH:80 },
    ];
    const funnelStages = computed(() => {
      const maxCount = Math.max(...stageConfig.map(s => myOpportunities.value.filter(o=>o.stage===s.key).length), 1);
      return stageConfig.map(s => {
        const opps = myOpportunities.value.filter(o=>o.stage===s.key);
        return {
          ...s,
          count: opps.length,
          amount: opps.reduce((sum,o)=>sum+o.amount,0),
          height: Math.max(20, Math.round((opps.length / maxCount) * s.maxH)),
        };
      });
    });
    function statusClass(s) { return { approved:'tag-green', pending:'tag-orange', reviewing:'tag-blue', expired:'tag-gray', rejected:'tag-red' }[s]||'tag-gray'; }
    function statusLabel(s) { return { approved:'已通过', pending:'待审核', reviewing:'审核中', expired:'已过期', rejected:'已拒绝' }[s]||s; }
    function quoteStatusLabel(s) { return { draft:'草稿', sent:'已发送', confirmed:'已确认', converted:'已转单', expired:'已过期' }[s]||s; }
    function quoteStatusClass(s) { return { draft:'tag-gray', sent:'tag-blue', confirmed:'tag-green', converted:'tag-purple', expired:'tag-red' }[s]||'tag-gray'; }
    
    // 从后端加载数据到 store（供 Dashboard 等组件使用）
    async function loadRealData() {
      const params = new URLSearchParams();
      const partnerId = store.user?.partnerId;
      const isPartnerAdmin = store.user?.role === 'partner_admin';
      if (isPartnerAdmin && partnerId) {
        // 企业管理员（partner_admin）：获取本企业全部数据
        params.append('partnerId', partnerId);
      } else if (store.user?.role === 'staff') {
        // 普通员工：传 userId，后端返回自己创建的 + 被指派的
        params.append('userId', userId.value);
      } else if (adminRegion.value) {
        params.append('region', adminRegion.value);
      }
      
      // 加载报备
      try {
        const regRes = await fetch(`${window.API_BASE}/registrations?${params}`);
        const regData = await regRes.json();
        if (regData.success) {
          store.registrations = regData.data;
        }
      } catch (err) { console.error('加载报备失败:', err); }
      
      // 加载商机
      try {
        const oppRes = await fetch(`${window.API_BASE}/opportunities?${params}`);
        const oppData = await oppRes.json();
        if (oppData.success) {
          store.opportunities = oppData.data;
        }
      } catch (err) { console.error('加载商机失败:', err); }
      
      // 加载报价单
      try {
        const quoteRes = await fetch(`${window.API_BASE}/quotes?${params}`);
        const quoteData = await quoteRes.json();
        if (quoteData.success) {
          store.quotes = quoteData.data;
        }
      } catch (err) { console.error('加载报价单失败:', err); }
      
      // 加载订单
      try {
        const orderRes = await fetch(`${window.API_BASE}/orders?${params}`);
        const orderData = await orderRes.json();
        if (orderData.success) {
          store.orders = orderData.data;
        }
      } catch (err) { console.error('加载订单失败:', err); }
      
      // 加载渠道商数据（用于一级/二级关系判断）
      try {
        const partnerParams = new URLSearchParams();
        // 总是加载所有渠道商数据，以便正确识别一级/二级关系
        // 渠道商数量有限，性能影响不大
        const partnerRes = await fetch(`${window.API_BASE}/partners?${partnerParams}`);
        const partnerData = await partnerRes.json();
        if (partnerData.success && partnerData.data) {
          // 合并后端数据到 store.partners（更新 partnerLevel 等字段）
          partnerData.data.forEach(p => {
            const idx = store.partners.findIndex(sp => sp.id === p.id);
            if (idx !== -1) {
              store.partners[idx] = { ...store.partners[idx], ...p };
            } else {
              store.partners.push(p);
            }
          });
        }
      } catch (err) { console.error('加载渠道商数据失败:', err); }
    }
    
    // 页面加载时获取后端数据
    onMounted(loadRealData);
    
    return { store, adminRegion, isStaff, isPartnerAdmin, myOpportunities, myRegistrations, myQuotes, myOrders, fmt, go, totalOrderAmt, totalOppAmt, productHighlights, funnelStages,
      statusClass, statusLabel, quoteStatusClass, quoteStatusLabel,
      stageLabel, stageTagClass, probColor };
  }
};

// ── 客户报备 ─────────────────────────────────────────────────
const RegistrationList = {
  template: `
  <div>
    <div class="search-bar">
      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input class="form-control" v-model="kw" placeholder="搜索客户名称、联系人..."/>
      </div>
      <select class="form-control" v-model="filterStatus" style="width:120px">
        <option value="">全部状态</option>
        <option value="pending">待审核</option>
        <option value="reviewing">审核中</option>
        <option value="approved">已通过</option>
        <option value="expired">已过期</option>
        <option value="rejected">已拒绝</option>
      </select>
      <span v-if="adminRegion" class="tag tag-blue" style="padding:6px 12px;font-size:13px">📍 {{ adminRegion }}</span>
      <button class="btn btn-primary" @click="$router.push('/registration/new')">➕ 新建报备</button>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>报备编号</th><th>客户名称</th><th>行业</th><th>联系人</th><th>状态</th>
              <th>报备日期</th><th>保护期至</th><th>负责人</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in filtered" :key="r.id" style="cursor:pointer" @click="viewDetail(r)">
              <td style="font-family:monospace;color:#888;font-size:12px">{{ r.id }}</td>
              <td style="font-weight:600">{{ r.customer }}</td>
              <td><span class="tag tag-purple">{{ r.industry }}</span></td>
              <td>{{ r.contact }}<br/><span style="font-size:11px;color:#aaa">{{ r.phone }}</span></td>
              <td><span class="tag" :class="statusClass(r.status)">{{ statusLabel(r.status) }}</span></td>
              <td style="font-size:12px;color:#888">{{ r.createdAt }}</td>
              <td style="font-size:12px" :style="{color: isExpiringSoon(r)?'#faad14':'#888'}">
                {{ r.expireAt }}
                <span v-if="isExpiringSoon(r)" style="font-size:11px;color:#faad14;display:block">⚠️ 即将到期</span>
              </td>
              <td><span class="tag tag-gray" style="font-size:11px">{{ r.assignedStaffName || r.createdByName || '—' }}</span></td>
              <td @click.stop>
                <button class="btn btn-text btn-sm" @click="$router.push('/opportunity/new?regId='+r.id)" v-if="r.status==='approved'" style="color:#1677ff">🎯 报备商机</button>
              </td>
            </tr>
            <tr v-if="!filtered.length"><td colspan="9"><div class="empty-state"><div class="empty-icon">📋</div><p>暂无报备记录</p></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div class="modal-overlay" v-if="detail" @click.self="detail=null">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">报备详情 — {{ detail.id }}</div>
          <span class="modal-close" @click="detail=null">✕</span>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-item"><label class="form-label">客户名称</label><div style="padding:8px 0;font-weight:600">{{ detail.customer }}</div></div>
            <div class="form-item"><label class="form-label">行业</label><div style="padding:8px 0">{{ detail.industry }}</div></div>
            <div class="form-item"><label class="form-label">联系人</label><div style="padding:8px 0">{{ detail.contact }}</div></div>
            <div class="form-item"><label class="form-label">联系电话</label><div style="padding:8px 0">{{ detail.phone }}</div></div>
            <div class="form-item"><label class="form-label">报备日期</label><div style="padding:8px 0">{{ detail.createdAt }}</div></div>
            <div class="form-item"><label class="form-label">保护期至</label><div style="padding:8px 0">{{ detail.expireAt }}</div></div>
            <div class="form-item"><label class="form-label">当前状态</label><div style="padding:8px 0"><span class="tag" :class="statusClass(detail.status)">{{ statusLabel(detail.status) }}</span></div></div>
            <div class="form-item"><label class="form-label">保护天数</label><div style="padding:8px 0">{{ detail.protectDays }} 天</div></div>
            <div class="form-item full"><label class="form-label">备注</label><div style="padding:8px 0;color:#888">{{ detail.notes || '无' }}</div></div>
          </div>

          <!-- 订单统计 -->
          <div v-if="detail.status==='approved'" style="margin:20px 0;padding:16px;background:linear-gradient(135deg,#f6ffed,#e6f7ff);border-radius:10px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div style="text-align:center">
              <div style="font-size:12px;color:#888;margin-bottom:4px">📦 订单总数</div>
              <div style="font-size:24px;font-weight:800;color:#52c41a">{{ regOrders.length }}</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:12px;color:#888;margin-bottom:4px">💰 订单总额</div>
              <div style="font-size:24px;font-weight:800;color:#1677ff">{{ fmt(regOrderTotal) }}</div>
            </div>
          </div>

          <!-- 关联商机列表 -->
          <div v-if="detail.status==='approved'" style="margin:20px 0">
            <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:12px;display:flex;align-items:center;gap:8px">
              🎯 关联商机 <span style="font-size:12px;font-weight:400;color:#888">（共 {{ regOpportunities.length }} 个）</span>
            </div>
            <div v-if="regOpportunities.length" style="display:flex;flex-direction:column;gap:8px">
              <div v-for="o in regOpportunities" :key="o.id" 
                style="display:flex;align-items:center;gap:12px;padding:12px;background:#f8f9fa;border-radius:8px;border-left:4px solid"
                :style="{borderLeftColor: stageColor(o.stage)}"
                @click="$router.push('/opportunity');detail=null"
                class="hover-link">
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:600;color:#1677ff;cursor:pointer;text-decoration:underline;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ o.name }}</div>
                  <div style="font-size:11px;color:#888;margin-top:2px">{{ o.customer }} · 预计 {{ fmt(o.amount) }}</div>
                </div>
                <span class="tag" :class="stageTagClass(o.stage)" style="font-size:11px;flex-shrink:0">{{ stageLabel(o.stage) }}</span>
              </div>
            </div>
            <div v-else style="padding:16px;text-align:center;background:#f8f9fa;border-radius:8px;color:#888;font-size:13px">
              暂无关联商机 <button class="btn btn-primary btn-sm" @click="$router.push('/opportunity/new?regId='+detail.id);detail=null" style="margin-left:8px">立即创建</button>
            </div>
          </div>

          <div style="margin-top:20px">
            <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:12px">审批时间线</div>
            <div class="timeline">
              <div class="timeline-item">
                <div class="timeline-dot-wrap"><div class="timeline-dot"></div><div class="timeline-line"></div></div>
                <div class="timeline-content"><div class="tl-title">提交报备申请</div><div class="tl-time">{{ detail.createdAt }}</div></div>
              </div>
              <div class="timeline-item" v-if="detail.status!=='pending'">
                <div class="timeline-dot-wrap"><div class="timeline-dot" :class="{gray:detail.status==='rejected'}"></div><div class="timeline-line"></div></div>
                <div class="timeline-content">
                  <div class="tl-title">{{ detail.status==='approved'?'厂商审批通过':detail.status==='reviewing'?'厂商审核中':'审批未通过' }}</div>
                  <div class="tl-time">{{ detail.status==='approved'?detail.createdAt:'处理中' }}</div>
                </div>
              </div>
              <div class="timeline-item" v-if="detail.status==='approved'">
                <div class="timeline-dot-wrap"><div class="timeline-dot"></div></div>
                <div class="timeline-content"><div class="tl-title">报备保护期生效</div><div class="tl-desc">有效期至 {{ detail.expireAt }}</div></div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="detail=null">关闭</button>
          <button class="btn btn-primary" @click="$router.push('/opportunity/new?regId='+detail.id);detail=null" v-if="detail.status==='approved'">🎯 报备商机</button>
        </div>
      </div>
    </div>
  </div>`,
  setup() {
    const kw = ref('');
    const filterStatus = ref('');
    const detail = ref(null);
    const registrations = ref([]);
    const loading = ref(false);
    
    // 区域管理员隔离
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    // 员工隔离：获取当前用户ID（统一使用 id 字段，与后端数据一致）
    const userId = computed(() => store.user?.id || '');
    const isStaff = computed(() => store.user?.role === 'staff' || store.user?.role === 'partner_admin');
    
    // 从后端加载报备数据
    async function loadRegistrations() {
      loading.value = true;
      try {
        const params = new URLSearchParams();
        const partnerId = store.user?.partnerId;
        const isPartnerAdmin = store.user?.role === 'partner_admin';
        if (isPartnerAdmin && partnerId) {
          // 企业管理员（partner_admin）：看本企业全部报备
          params.append('partnerId', partnerId);
        } else if (store.user?.role === 'staff') {
          // 普通员工：传 userId，让后端返回自己创建的 + 被指派的
          params.append('userId', userId.value);
        } else if (adminRegion.value) {
          params.append('region', adminRegion.value);
        }
        if (filterStatus.value) {
          params.append('status', filterStatus.value);
        }
        
        const res = await fetch(`${window.API_BASE}/registrations?${params}`);
        const data = await res.json();
        if (data.success) {
          registrations.value = data.data;
        }
      } catch (err) {
        console.error('加载报备失败:', err);
      }
      loading.value = false;
    }
    
    // 初始加载
    onMounted(loadRegistrations);
    
    // 筛选后的列表
    const filtered = computed(() => registrations.value.filter(r => {
      const matchKw = !kw.value || r.customer?.includes(kw.value) || r.contact?.includes(kw.value);
      const matchSt = !filterStatus.value || r.status === filterStatus.value;
      return matchKw && matchSt;
    }));
    function statusClass(s) { return { approved:'tag-green', pending:'tag-orange', reviewing:'tag-blue', expired:'tag-gray', rejected:'tag-red' }[s]||'tag-gray'; }
    function statusLabel(s) { return { approved:'已通过', pending:'待审核', reviewing:'审核中', expired:'已过期', rejected:'已拒绝' }[s]||s; }
    function isExpiringSoon(r) {
      if (r.status !== 'approved') return false;
      const days = (new Date(r.expireAt) - new Date()) / 86400000;
      return days > 0 && days <= 30;
    }
    function viewDetail(r) { detail.value = r; }

    // 该报备关联的订单
    const regOrders = computed(() => {
      if (!detail.value) return [];
      return store.orders.filter(o => o.customer === detail.value.customer);
    });
    const regOrderTotal = computed(() => regOrders.value.reduce((s, o) => s + o.total, 0));

    // 该报备关联的商机
    const regOpportunities = computed(() => {
      if (!detail.value) return [];
      return store.opportunities.filter(o => o.regId === detail.value.id || o.customer === detail.value.customer);
    });

    // 商机阶段颜色
    function stageColor(stage) {
      const colors = {
        prospecting: '#1677ff', qualification: '#52c41a', proposal: '#faad14',
        negotiation: '#eb2f96', closing: '#722ed1', won: '#52c41a', lost: '#ff4d4f'
      };
      return colors[stage] || '#888';
    }

    return { kw, filterStatus, adminRegion, filtered, detail, statusClass, statusLabel, isExpiringSoon, viewDetail,
      regOrders, regOrderTotal, regOpportunities, stageColor, stageLabel, stageTagClass, fmt, loading, loadRegistrations };
  }
};

// ── 新建报备 ─────────────────────────────────────────────────
const RegistrationNew = {
  template: `
  <div>
    <div class="card" style="max-width:680px;margin:0 auto">
      <div class="card-header"><div class="card-title">新建客户报备</div></div>
      <div class="steps" style="margin-bottom:28px">
        <div class="step-item" :class="{active:step===1,done:step>1}">
          <div class="step-circle">{{ step>1?'✓':1 }}</div><div class="step-label">客户信息</div>
        </div>
        <div class="step-line" :class="{done:step>1}"></div>
        <div class="step-item" :class="{active:hasOpportunity?step===2:step===3,done:hasOpportunity?step>2:step>3}" v-if="hasOpportunity">
          <div class="step-circle">{{ step>2?'✓':2 }}</div><div class="step-label">项目信息</div>
        </div>
        <div class="step-line" :class="{done:hasOpportunity?step>2:step>3}" v-if="hasOpportunity"></div>
        <div class="step-item" :class="{active:hasOpportunity?step===3:step===2}">
          <div class="step-circle">{{ hasOpportunity?3:2 }}</div><div class="step-label">提交确认</div>
        </div>
      </div>

      <!-- Step 1 -->
      <div v-if="step===1">
        <div class="form-grid">
          <div class="form-item full" style="position:relative">
            <label class="form-label required">客户名称（全称）</label>
            <div style="position:relative">
              <input 
                class="form-control" 
                v-model="form.customer" 
                placeholder="输入公司名关键词，自动查询工商信息并回填"
                @input="onCustomerInput"
                @blur="hideEnterpriseList"
                @focus="onCustomerInput"
                style="padding-right:36px"
              />
              <!-- 搜索中状态 -->
              <span v-if="searchingEnterprise" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:#aaa;font-size:13px;animation:spin 1s linear infinite;display:inline-block">⟳</span>
              <!-- 已回填标志 -->
              <span v-else-if="enterpriseFilled" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:#52c41a;font-size:14px" title="已从工商数据回填">✓</span>
            </div>
            <!-- 企业搜索下拉列表 -->
            <div v-if="showEnterpriseList && enterpriseList.length > 0" class="enterprise-dropdown">
              <div 
                v-for="item in enterpriseList" 
                :key="item.creditCode || item.name"
                class="enterprise-item"
                @mousedown.prevent="selectEnterprise(item)"
              >
                <div style="display:flex;align-items:center;gap:6px">
                  <div class="enterprise-name" style="flex:1">{{ item.name }}</div>
                  <span v-if="item.source==='local'" style="font-size:10px;padding:1px 5px;background:#e6f4ff;color:#1677ff;border-radius:3px;white-space:nowrap">历史报备</span>
                </div>
                <div style="display:flex;gap:12px;margin-top:3px">
                  <div class="enterprise-code" style="flex:1">{{ item.creditCode || '—' }}</div>
                  <div v-if="item.legalPerson" style="font-size:11px;color:#888">法人：{{ item.legalPerson }}</div>
                </div>
                <div v-if="item.address" style="font-size:11px;color:#aaa;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ item.address }}</div>
              </div>
              <div v-if="enterpriseApiNote==='no_api_key'" style="padding:8px 12px;font-size:11px;color:#aaa;border-top:1px solid #f0f0f0;text-align:center">
                仅显示历史报备数据 · <a href="javascript:void(0)" style="color:#1677ff" @mousedown.prevent="showApiKeyTip=!showApiKeyTip">如何接入实时工商查询？</a>
              </div>
            </div>
            <!-- 无结果提示 -->
            <div v-if="showEnterpriseList && enterpriseList.length===0 && !searchingEnterprise && form.customer.length>=2" 
              style="position:absolute;left:0;right:0;background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:10px 14px;font-size:13px;color:#aaa;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,.1)">
              未找到匹配企业，请手动填写下方信息
            </div>
            <!-- API Key 配置提示 -->
            <div v-if="showApiKeyTip" style="margin-top:8px;padding:10px 14px;background:#fffbe6;border:1px solid #ffe58f;border-radius:6px;font-size:12px;color:#664d00;line-height:1.6">
              在后端 <code>server.js</code> 启动时设置环境变量 <code>COMPANY_API_KEY=你的AppCode</code> 即可接入阿里云市场企业工商查询接口。
            </div>
          </div>
          <!-- 工商回填信息展示卡片（选中企业后显示） -->
          <div v-if="enterpriseFilled" class="form-item full">
            <div style="background:#f6ffed;border:1px solid #b7eb8f;border-radius:8px;padding:12px 16px;font-size:13px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <span style="color:#389e0d;font-weight:600">✅ 工商信息已自动回填</span>
                <button class="btn btn-sm" style="font-size:11px;padding:2px 10px;border:1px solid #d9d9d9;border-radius:4px;background:#fff;cursor:pointer;color:#666" @click="clearEnterpriseFill">清除重填</button>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;color:#555">
                <div><span style="color:#999">统一信用代码：</span>{{ form.creditCode }}</div>
                <div><span style="color:#999">法定代表人：</span>{{ form.legalPerson || '—' }}</div>
                <div><span style="color:#999">经营状态：</span>{{ form.companyStatus || '—' }}</div>
                <div><span style="color:#999">注册地（省市）：</span>{{ form.city }}</div>
                <div v-if="form.address" class="form-item full" style="grid-column:span 2"><span style="color:#999">注册地址：</span>{{ form.address }}</div>
              </div>
            </div>
          </div>
          <div class="form-item full">
            <label class="form-label required">统一社会信用代码</label>
            <input 
              class="form-control" 
              v-model="form.creditCode" 
              placeholder="18位统一社会信用代码（选中企业后自动填入）"
              maxlength="18"
              @blur="validateCreditCodeInput"
              :style="enterpriseFilled?'background:#f9f9f9':' '"
            />
            <span v-if="creditCodeError" class="field-error">{{ creditCodeError }}</span>
          </div>
          <div class="form-item">
            <label class="form-label">法定代表人</label>
            <input class="form-control" v-model="form.legalPerson" placeholder="（自动回填或手动填写）" :style="enterpriseFilled?'background:#f9f9f9':' '"/>
          </div>
          <div class="form-item"><label class="form-label required">所属行业</label>
            <select class="form-control" v-model="form.industry">
              <option value="">请选择</option>
              <option v-for="i in industries" :key="i">{{ i }}</option>
            </select>
          </div>
          <div class="form-item"><label class="form-label required">客户省份/城市</label><input class="form-control" v-model="form.city" placeholder="例：北京市朝阳区"/></div>
          <div class="form-item full"><label class="form-label">注册地址</label><input class="form-control" v-model="form.address" placeholder="（自动回填或手动填写）" :style="enterpriseFilled?'background:#f9f9f9':' '"/></div>
          <div class="form-item"><label class="form-label required">联系人姓名</label><input class="form-control" v-model="form.contact" placeholder="客户决策人或联系人"/></div>
          <div class="form-item">
            <label class="form-label required">联系电话</label>
            <input 
              class="form-control" 
              v-model="form.phone" 
              placeholder="138-0000-0000"
              @blur="validatePhoneInput"
            />
            <span v-if="phoneError" class="field-error">{{ phoneError }}</span>
          </div>
          <div class="form-item full"><label class="form-label">客户邮箱</label><input class="form-control" v-model="form.email" placeholder="contact@company.com"/></div>
        </div>
        <div style="margin-top:24px;padding:16px;background:#f5f5f7;border-radius:8px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input type="checkbox" v-model="hasOpportunity" style="width:18px;height:18px;cursor:pointer"/>
            <span style="font-size:14px;color:#333">同时报备商机（项目信息）</span>
          </label>
          <p style="margin:8px 0 0 28px;font-size:12px;color:#888">勾选后，您可以在下一步填写项目详情，获得商机保护期</p>
        </div>
        <div v-if="!isStep1Valid && step1MissingFields.length" style="margin-top:12px;padding:10px 12px;background:#fff7e6;border:1px solid #ffd591;border-radius:8px;font-size:12px;color:#ad6800">
          还需完善后才能进入下一步：{{ step1MissingFields.join('、') }}
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:24px;gap:10px">
          <button class="btn btn-default" @click="$router.back()">取消</button>
          <button class="btn btn-primary" @click="goToNext" :disabled="!isStep1Valid" :title="!isStep1Valid && step1MissingFields.length ? ('请先完善：' + step1MissingFields.join('、')) : ''">下一步</button>
        </div>
      </div>

      <!-- Step 2 -->
      <div v-if="step===2">
        <div class="form-grid">
          <div class="form-item full"><label class="form-label required">项目名称</label><input class="form-control" v-model="form.project" placeholder="例：XX公司终端安全管控项目"/></div>
          <div class="form-item"><label class="form-label required">预计端点数量</label>
            <select class="form-control" v-model="form.endpointRange">
              <option value="">请选择</option>
              <option>10~19</option><option>20~49</option><option>50~99</option><option>100~199</option><option>200~500</option><option>500以上</option>
            </select>
          </div>
          <div class="form-item"><label class="form-label">预计金额（万元）</label><input class="form-control" v-model="form.estimatedAmt" placeholder="0"/></div>
          <div class="form-item"><label class="form-label">预计签约日期</label><input class="form-control" type="date" v-model="form.signDate"/></div>
          <div class="form-item"><label class="form-label">申请保护期</label>
            <select class="form-control" v-model="form.protectDays">
              <option value="90">90天</option><option value="180">180天</option><option value="365">365天</option>
            </select>
          </div>
          <div class="form-item full"><label class="form-label">项目背景 / 备注</label><textarea class="form-control" v-model="form.notes" placeholder="项目来源、痛点、竞争情况等..." rows="3"></textarea></div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:24px;gap:10px">
          <button class="btn btn-default" @click="step=1">上一步</button>
          <button class="btn btn-primary" @click="step=3" :disabled="!form.project||!form.endpointRange">下一步</button>
        </div>
      </div>

      <!-- Step 3 -->
      <div v-if="step===3">
        <div style="background:#f8f9fa;border-radius:10px;padding:20px;margin-bottom:20px">
          <div style="font-size:14px;font-weight:700;margin-bottom:14px;color:#333">确认报备信息</div>
          <div style="font-size:13px;color:#666;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #e0e0e0">客户信息</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13.5px">
            <div><span style="color:#888">客户名称：</span><strong>{{ form.customer }}</strong></div>
            <div><span style="color:#888">统一社会信用代码：</span>{{ form.creditCode || '-' }}</div>
            <div v-if="form.legalPerson"><span style="color:#888">法定代表人：</span>{{ form.legalPerson }}</div>
            <div><span style="color:#888">所属行业：</span>{{ form.industry }}</div>
            <div><span style="color:#888">联系人：</span>{{ form.contact }}</div>
            <div><span style="color:#888">联系电话：</span>{{ form.phone }}</div>
            <div><span style="color:#888">城市：</span>{{ form.city }}</div>
            <div><span style="color:#888">邮箱：</span>{{ form.email || '-' }}</div>
            <div v-if="form.address" style="grid-column:span 2"><span style="color:#888">注册地址：</span>{{ form.address }}</div>
          </div>
          <template v-if="hasOpportunity">
            <div style="font-size:13px;color:#666;margin:16px 0 12px;padding-bottom:10px;border-bottom:1px solid #e0e0e0">商机信息</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13.5px">
              <div><span style="color:#888">项目名称：</span>{{ form.project }}</div>
              <div><span style="color:#888">端点范围：</span>{{ form.endpointRange }}</div>
              <div><span style="color:#888">预计金额：</span>{{ form.estimatedAmt ? form.estimatedAmt + ' 万元' : '-' }}</div>
              <div><span style="color:#888">预计签约：</span>{{ form.signDate || '-' }}</div>
              <div><span style="color:#888">保护期：</span>{{ form.protectDays }} 天</div>
            </div>
            <div v-if="form.notes" style="margin-top:10px;color:#555;font-size:13px"><span style="color:#888">备注：</span>{{ form.notes }}</div>
          </template>
        </div>
        <div style="background:#fffbe6;border:1px solid #ffe58f;border-radius:8px;padding:14px;font-size:13px;color:#664d00;margin-bottom:20px">
          ℹ️ 提交后将进入厂商审核流程，通常 1-2 个工作日内完成审核。审核通过后保护期自动生效。
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px">
          <button class="btn btn-default" @click="goBackFromConfirm">上一步</button>
          <button class="btn btn-primary" @click="submit" :disabled="submitting">{{ submitting?'提交中...':'提交报备' }}</button>
        </div>
      </div>
    </div>
  </div>`,
  setup() {
    const router = VueRouter.useRouter();
    const route = VueRouter.useRoute();
    const step = ref(1);
    const submitting = ref(false);
    const hasOpportunity = ref(false);
    const industries = ['金融','制造','政府/央企','医疗','教育','互联网','零售','能源','交通','其他'];
    const form = reactive({
      customer:'', creditCode:'', legalPerson:'', address:'', companyStatus:'',
      industry:'', city:'', contact:'', phone:'', email:'',
      project:'', endpointRange:'', estimatedAmt:'', signDate:'', protectDays:'180', notes:''
    });
    
    // 企业搜索相关
    const showEnterpriseList = ref(false);
    const enterpriseList = ref([]);
    const creditCodeError = ref('');
    const phoneError = ref('');
    const searchingEnterprise = ref(false);  // 搜索中
    const enterpriseFilled = ref(false);     // 已从工商数据回填
    const enterpriseApiNote = ref('');       // API 状态提示
    const showApiKeyTip = ref(false);        // 是否展示 APIKey 配置提示
    let searchTimeout = null;
    
    // 支持从其他页面跳转时预填客户名
    onMounted(() => {
      if (route.query.customer) form.customer = decodeURIComponent(route.query.customer);
    });
    
    // 客户名称输入处理 - 防抖搜索（调用后端代理接口）
    function onCustomerInput() {
      if (searchTimeout) clearTimeout(searchTimeout);
      enterpriseFilled.value = false;
      
      const keyword = form.customer.trim();
      if (keyword.length < 2) {
        showEnterpriseList.value = false;
        enterpriseList.value = [];
        return;
      }
      
      searchTimeout = setTimeout(async () => {
        searchingEnterprise.value = true;
        try {
          const apiBase = window.API_BASE || 'http://localhost:3000/api';
          const res = await fetch(`${apiBase}/company-search?keyword=${encodeURIComponent(keyword)}`);
          const data = await res.json();
          if (data.success) {
            enterpriseList.value = data.data || [];
            enterpriseApiNote.value = data.note || '';
            showEnterpriseList.value = true;
          }
        } catch(e) {
          // 网络错误时降级使用本地数据
          if (typeof window.searchEnterprises === 'function') {
            enterpriseList.value = window.searchEnterprises(keyword);
            showEnterpriseList.value = enterpriseList.value.length > 0;
          }
        } finally {
          searchingEnterprise.value = false;
        }
      }, 400);
    }
    
    // 隐藏企业列表（延迟，允许点击）
    function hideEnterpriseList() {
      setTimeout(() => {
        showEnterpriseList.value = false;
      }, 200);
    }
    
    // 行业智能匹配辅助函数
    function matchIndustry(industryStr) {
      if (!industryStr) return '';
      const industryMap = {
        '金融': '金融', '银行': '金融', '保险': '金融', '证券': '金融',
        '制造': '制造', '加工': '制造', '生产': '制造',
        '政府': '政府/央企', '机关': '政府/央企', '国有': '政府/央企',
        '医疗': '医疗', '医院': '医疗', '卫生': '医疗',
        '教育': '教育', '学校': '教育', '大学': '教育',
        '信息': '互联网', '软件': '互联网', '科技': '互联网', '网络': '互联网',
        '零售': '零售', '商业': '零售', '贸易': '零售',
        '能源': '能源', '电力': '能源', '石油': '能源',
        '交通': '交通', '运输': '交通', '物流': '交通',
      };
      for (const [key, val] of Object.entries(industryMap)) {
        if (industryStr.includes(key)) return val;
      }
      return '';
    }

    // 将企业数据回填到表单的公共函数
    function fillFormFromEnterprise(data) {
      if (data.name) form.customer = data.name;
      if (data.creditCode) form.creditCode = data.creditCode;
      if (data.legalPerson) form.legalPerson = data.legalPerson;
      if (data.address) form.address = data.address;
      if (data.companyStatus) form.companyStatus = data.companyStatus;
      // 省市拼接：省+市 或 从地址中提取
      if (data.city) {
        form.city = data.province ? `${data.province}${data.city}` : data.city;
      } else if (data.address && !form.city) {
        form.city = data.address.substring(0, 12).replace(/[区县镇乡街道路号].*/,'') || data.address;
      }
      // 行业智能匹配（仅在用户未手动选择时覆盖）
      if (data.industry && !form.industry) {
        const matched = matchIndustry(data.industry);
        if (matched) form.industry = matched;
      }
    }

    // 选择企业 - 自动回填工商信息（搜索结果已包含完整数据，无需额外调用详情接口）
    function selectEnterprise(enterprise) {
      // 回填工商信息
      fillFormFromEnterprise(enterprise);
      showEnterpriseList.value = false;
      enterpriseFilled.value = true;
      creditCodeError.value = '';
    }
    
    // 清除工商回填，允许重新手动填写
    function clearEnterpriseFill() {
      enterpriseFilled.value = false;
      form.creditCode = '';
      form.legalPerson = '';
      form.address = '';
      form.companyStatus = '';
    }
    
    // 校验统一社会信用代码
    function validateCreditCodeInput() {
      if (!form.creditCode) {
        creditCodeError.value = '';
        return;
      }
      if (typeof window.validateCreditCode === 'function') {
        const valid = window.validateCreditCode(form.creditCode);
        creditCodeError.value = valid ? '' : '统一社会信用代码格式不正确，应为18位数字和大写字母组合';
      }
    }
    
    // 校验手机号
    function validatePhoneInput() {
      if (!form.phone) {
        phoneError.value = '';
        return;
      }
      if (typeof window.validatePhone === 'function') {
        const valid = window.validatePhone(form.phone);
        phoneError.value = valid ? '' : '手机号格式不正确，请输入11位有效手机号';
      }
    }
    
    // Step 1 表单校验
    const isStep1Valid = computed(() => {
      const basicValid = form.customer && form.industry && form.contact && form.phone && form.creditCode;
      const noErrors = !creditCodeError.value && !phoneError.value;
      return basicValid && noErrors;
    });

    const step1MissingFields = computed(() => {
      const missing = [];
      if (!form.customer) missing.push('客户名称');
      if (!form.creditCode) missing.push('统一社会信用代码');
      if (creditCodeError.value) missing.push('统一社会信用代码格式');
      if (!form.industry) missing.push('所属行业');
      if (!form.contact) missing.push('联系人姓名');
      if (!form.phone) missing.push('联系电话');
      if (phoneError.value) missing.push('联系电话格式');
      return missing;
    });
    
    // 获取当前用户所属区域（渠道合作伙伴从store.user.region获取）
    const userRegion = computed(() => store.user?.region || '');
    // 获取当前用户ID（统一使用id）
    const userId = computed(() => store.user?.id || '');
    
    // 下一步逻辑：根据是否报备商机决定跳转到哪一步
    function goToNext() {
      if (hasOpportunity.value) {
        step.value = 2;
      } else {
        step.value = 3;
      }
    }
    
    // 从确认页返回：根据是否报备商机决定返回到哪一步
    function goBackFromConfirm() {
      if (hasOpportunity.value) {
        step.value = 2;
      } else {
        step.value = 1;
      }
    }
    
    async function submit() {
      submitting.value = true;
      try {
        // 查重校验：先从后端获取完整的报备列表
        const checkRes = await apiRequest('GET', '/registrations');
        const allRegistrations = checkRes.success ? checkRes.data : [];
        
        const normalizedCustomer = form.customer.trim();
        const normalizedCreditCode = form.creditCode.trim();
        
        // 检查客户名称是否已存在（不区分大小写）
        const existingByName = allRegistrations.find(r => 
          r.customer && r.customer.trim().toLowerCase() === normalizedCustomer.toLowerCase()
        );
        
        if (existingByName) {
          submitting.value = false;
          alert(`该客户已被报备，不能重复报备。\n\n客户名称：${existingByName.customer}\n报备时间：${existingByName.createdAt || '未知'}`);
          return;
        }
        
        // 检查统一社会信用代码是否已存在（如果填写了）
        if (normalizedCreditCode) {
          const existingByCreditCode = allRegistrations.find(r => 
            r.creditCode && r.creditCode.trim() === normalizedCreditCode
          );
          
          if (existingByCreditCode) {
            submitting.value = false;
            alert(`该统一社会信用代码已被报备，不能重复报备。\n\n客户名称：${existingByCreditCode.customer}\n统一代码：${existingByCreditCode.creditCode}`);
            return;
          }
        }
        
        // 构建提交数据
        const submitData = {
          customer: form.customer,
          creditCode: form.creditCode,
          legalPerson: form.legalPerson || '',
          address: form.address || '',
          companyStatus: form.companyStatus || '',
          industry: form.industry,
          contact: form.contact,
          phone: form.phone,
          email: form.email,
          city: form.city,
          status: 'pending',
          region: userRegion.value,
          createdBy: userId.value,
          createdByName: store.user?.name || '',
          partnerId: store.user?.partnerId || '',
          partnerName: store.user?.partnerName || '',
          hasOpportunity: hasOpportunity.value
        };
        
        // 只有同时报备商机时才包含项目相关字段
        if (hasOpportunity.value) {
          const expDate = new Date();
          expDate.setDate(expDate.getDate() + parseInt(form.protectDays));
          submitData.project = form.project;
          submitData.endpointRange = form.endpointRange;
          submitData.estimatedAmt = form.estimatedAmt;
          submitData.signDate = form.signDate;
          submitData.protectDays = parseInt(form.protectDays);
          submitData.notes = form.notes;
        }
        
        // 调用后端 API 创建报备
        const res = await apiRequest('POST', '/registrations', submitData);
        
        if (res.success) {
          store.notifications.unshift({ 
            id: Date.now(), 
            title: '报备已提交', 
            desc: `${form.customer} 报备申请已提交，等待厂商审核`, 
            time: '刚刚', 
            unread: true 
          });
          alert('报备提交成功！等待厂商审核。');
          router.push('/registration');
        } else {
          alert('提交失败：' + (res.error || '未知错误'));
        }
      } catch (err) {
        alert('提交失败：' + err.message);
      }
      submitting.value = false;
    }
    return { 
      step, form, submitting, hasOpportunity, industries, 
      showEnterpriseList, enterpriseList, creditCodeError, phoneError,
      searchingEnterprise, enterpriseFilled, enterpriseApiNote, showApiKeyTip,
      isStep1Valid, step1MissingFields,
      onCustomerInput, hideEnterpriseList, selectEnterprise, clearEnterpriseFill,
      validateCreditCodeInput, validatePhoneInput,
      submit, goToNext, goBackFromConfirm 
    };
  }
};

// ── 报价管理列表 ─────────────────────────────────────────────
const QuoteList = {
  template: `
  <div>
    <div class="search-bar">
      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input class="form-control" v-model="kw" placeholder="搜索客户、报价单号..."/>
      </div>
      <span v-if="adminRegion" class="tag tag-blue" style="padding:6px 12px;font-size:13px">📍 {{ adminRegion }}</span>
      <button class="btn btn-primary" @click="$router.push('/quote/new')">➕ 新建报价单</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>报价单号</th><th>客户</th><th>项目名称</th><th>端点数</th><th>报价总额</th><th>创建日期</th><th>有效期</th><th>负责人</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="q in paginatedData" :key="q.id" @click="view(q)" style="cursor:pointer">
              <td style="font-family:monospace;color:#888;font-size:12px">{{ q.id }}</td>
              <td style="font-weight:600">{{ q.customer }}</td>
              <td>
                <span v-if="q.oppId" style="font-size:12px;color:#555">{{ getOppName(q.oppId) }}</span>
                <span v-else style="color:#aaa;font-size:12px">—</span>
              </td>
              <td>{{ getQuoteDisplayEndpoints(q) }} 台</td>
              <td style="font-weight:700;color:#1677ff">{{ fmt(q.total) }}</td>
              <td style="font-size:12px;color:#888">{{ q.createdAt }}</td>
              <td style="font-size:12px;color:#888">{{ q.validDays }} 天</td>
              <td><span class="tag tag-gray" style="font-size:11px">{{ q.assignedStaffName || q.createdByName || '—' }}</span></td>
              <td @click.stop style="white-space:nowrap">
                <!-- 已转单：显示状态 -->
                <template v-if="q.status==='converted'">
                  <span style="color:#722ed1;font-size:12px">✓ 已转单</span>
                </template>
                <!-- 未转单：显示转订单按钮 -->
                <template v-else>
                  <button class="btn btn-text btn-sm" style="color:#722ed1" @click="openToOrderModal(q)">📦 转订单</button>
                </template>
              </td>
            </tr>
            <tr v-if="!paginatedData.length"><td colspan="9"><div class="empty-state"><div class="empty-icon">💰</div><p>暂无报价记录</p></div></td></tr>
          </tbody>
        </table>
      </div>
      
      <!-- 分页控件 -->
      <div class="pagination" v-if="totalPages > 1">
        <span class="pagination-info">共 {{ filtered.length }} 条，第 {{ currentPage }}/{{ totalPages }} 页</span>
        <button class="btn btn-sm" @click="prevPage" :disabled="currentPage === 1">上一页</button>
        <button class="btn btn-sm" v-for="p in pageNumbers" :key="p" :class="{active: p === currentPage}" @click="goToPage(p)">{{ p }}</button>
        <button class="btn btn-sm" @click="nextPage" :disabled="currentPage === totalPages">下一页</button>
      </div>
      <div class="pagination" v-else style="justify-content:flex-end">
        <span class="pagination-info">共 {{ filtered.length }} 条</span>
      </div>
    </div>

    <!-- 查看报价单 -->
    <div class="modal-overlay" v-if="detail" @click.self="detail=null">
      <div class="modal modal-xl">
        <div class="modal-header">
          <div class="modal-title">报价单预览 — {{ detail.id }}</div>
          <span class="modal-close" @click="detail=null">✕</span>
        </div>
        <div class="modal-body" style="padding:0" id="quote-print-area">
          <!-- 打印专用页眉（仅打印时可见） -->
          <div class="print-only" style="display:none;padding:20px 32px 0;text-align:center">
            <div style="font-size:20px;font-weight:800;color:#001529;letter-spacing:1px">联软科技（深圳）有限公司</div>
            <div style="font-size:11px;color:#888;margin-top:2px">UniSoft Technology (Shenzhen) Co., Ltd.</div>
            <div style="border-bottom:2px solid #001529;margin:10px 0 0"></div>
          </div>
          <div class="quote-header">
            <h2>🛡️ 联软安全产品报价单</h2>
            <p>UniSoft Security Products Quotation</p>
            <div class="quote-meta">
              <div class="quote-meta-item"><label>报价编号</label><span>{{ detail.id }}</span></div>
              <div class="quote-meta-item"><label>客户名称</label><span>{{ detail.customer }}</span></div>
              <div class="quote-meta-item"><label>项目名称</label>
                <span v-if="detail.oppId">{{ getOppName(detail.oppId) }}</span>
                <span v-else style="color:#aaa">—</span>
              </div>
              <div class="quote-meta-item"><label>报价日期</label><span>{{ detail.createdAt }}</span></div>
              <div class="quote-meta-item"><label>有效期</label><span>{{ detail.validDays }} 天</span></div>
              <div class="quote-meta-item"><label>端点数量</label><span>{{ getQuoteDisplayEndpoints(detail) }} 台</span></div>
              <div class="quote-meta-item"><label>报价状态</label><span>{{ statusLabelMap[detail.status]||detail.status }}</span></div>
            </div>
          </div>
          <div class="quote-body">
            <div class="quote-section-title">产品明细</div>
            <!-- 软件产品 -->
            <div v-if="detailSoftwareItems.length > 0">
              <div style="font-size:13px;font-weight:600;color:#555;margin:10px 0 6px;padding-left:4px;">🖥️ 软件产品</div>
              <div class="table-wrap">
                <table class="quote-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>产品名称</th>
                      <th>授权端点数</th>
                      <th>小计（元）</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(p,i) in detailSoftwareItems" :key="'sw-'+i">
                      <td>{{ i+1 }}</td>
                      <td>{{ p.name }}</td>
                      <td>{{ p.qtyLabel || (p.qty + ' 台') }}</td>
                      <td style="font-weight:700">{{ fmt(p.subtotal) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <!-- 硬件产品 -->
            <div v-if="detailHardwareItems.length > 0">
              <div style="font-size:13px;font-weight:600;color:#555;margin:14px 0 6px;padding-left:4px;">🖨️ 硬件设备</div>
              <div class="table-wrap">
                <table class="quote-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>产品名称</th>
                      <th>数量</th>
                      <th>金额（元）</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(p,i) in detailHardwareItems" :key="'hw-'+i">
                      <td>{{ i+1 }}</td>
                      <td>{{ p.name }}</td>
                      <td>{{ p.unit }}</td>
                      <td style="font-weight:700">{{ fmt(p.subtotal) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div v-if="detailServiceItems.length > 0">
              <div style="font-size:13px;font-weight:600;color:#555;margin:14px 0 6px;padding-left:4px;">服务项</div>
              <div class="table-wrap">
                <table class="quote-table">
                  <thead><tr><th>#</th><th>产品名称</th><th>数量</th><th>小计（元）</th></tr></thead>
                  <tbody>
                    <tr v-for="(p,i) in detailServiceItems" :key="'svc-'+i">
                      <td>{{ i+1 }}</td>
                      <td>{{ p.name }}</td>
                      <td>{{ p.qtyLabel || (p.qty + ' 台') }}</td>
                      <td style="font-weight:700">{{ fmt(p.subtotal) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div v-if="detail.standardPersonDays !== undefined && detail.standardPersonDays !== null" style="margin-top:18px;padding:16px 18px;border-radius:10px;background:#f6ffed;border:1px solid #b7eb8f">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
                <div>
                  <div style="font-size:14px;font-weight:700;color:#237804">标准工作量建议</div>
                  <div style="font-size:12px;color:#666;margin-top:4px">{{ detail.workloadSummary || '按报价快照展示' }}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:24px;font-weight:700;color:#237804">{{ detail.standardPersonDays }}</div>
                  <div style="font-size:12px;color:#666">人天</div>
                </div>
              </div>
            </div>
            <div class="quote-total">
              <div class="quote-total-box">
                <div v-if="detail.discountAmount > 0" class="total-row" style="color:#888">
                  <span>产品原价</span>
                  <span style="text-decoration:line-through">{{ fmt(detail.originalTotal || detail.total) }}</span>
                </div>
                <div v-if="detail.discountAmount > 0" class="total-row" style="color:#52c41a">
                  <span>优惠金额</span>
                  <span>-{{ fmt(detail.discountAmount) }}</span>
                </div>
                <div class="total-row"><span>产品合计</span><span>{{ fmt(detail.total) }}</span></div>
                <div class="total-row"><span>实施服务费</span><span style="color:#888">另行报价</span></div>
                <div class="total-row grand"><span>报价总额</span><span>{{ fmt(detail.total) }}</span></div>
              </div>
            </div>
            <div style="margin-top:20px;font-size:12px;color:#aaa;border-top:1px solid #f0f0f0;padding-top:14px">
              <p v-for="n in PRODUCT_DATA.notes" :key="n">• {{ n }}</p>
            </div>
            <!-- 打印专用页脚 -->
            <div class="print-only" style="display:none;margin-top:40px;border-top:1px solid #e0e0e0;padding-top:20px;display:flex;justify-content:space-between;font-size:12px;color:#888">
              <div>
                <div style="margin-bottom:30px">报价方签章：___________________</div>
                <div>日期：___________________</div>
              </div>
              <div>
                <div style="margin-bottom:30px">客户方签章：___________________</div>
                <div>日期：___________________</div>
              </div>
              <div style="text-align:right">
                <div>联系电话：400-800-XXXX</div>
                <div style="margin-top:4px">官网：www.unisoft.com.cn</div>
                <div style="margin-top:4px;font-size:11px;color:#bbb">本报价单由联软渠道管理平台自动生成</div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="detail=null">关闭</button>
          <button class="btn btn-default" @click="downloadPdf(detail)" style="display:flex;align-items:center;gap:6px">
            <span>📄</span> 下载 PDF
          </button>
          <!-- 已转单：查看订单 -->
          <template v-if="detail.status==='converted'">
            <button class="btn btn-default" @click="$router.push('/order');detail=null">📋 查看订单</button>
          </template>
          <!-- 未转单：修改、转订单、删除 -->
          <template v-else>
            <button class="btn btn-primary" @click="editQuote(detail);detail=null">✏️ 修改报价</button>
            <button class="btn btn-primary" style="background:#722ed1;border-color:#722ed1" @click="openToOrderModal(detail);detail=null">📦 转订单</button>
            <button class="btn btn-default" style="color:#ff4d4f" @click="deleteQuote(detail);detail=null">🗑 删除</button>
          </template>
        </div>
      </div>
    </div>

    <!-- 收货地址弹窗 -->
    <div class="modal-overlay" v-if="showDeliveryModal" @click.self="showDeliveryModal=false">
      <div class="modal" style="max-width:480px">
        <div class="modal-header" style="border-bottom:none;padding-bottom:0;position:relative">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#722ed1,#9754de);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px">📦</div>
            <div>
              <div style="font-size:17px;font-weight:700;color:#1a1a1a">填写收货信息</div>
              <div style="font-size:12px;color:#8c8c8c;margin-top:2px">请填写正确的收货地址和联系方式</div>
            </div>
          </div>
          <span class="modal-close" @click="showDeliveryModal=false" style="position:absolute;top:16px;right:16px;width:28px;height:28px;border-radius:50%;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-size:14px;color:#666">✕</span>
        </div>
        <div class="modal-body" style="padding-top:20px">
          <!-- 报价单摘要 -->
          <div v-if="deliveryForm.quoteId" style="background:linear-gradient(135deg,#f6ffed 0%,#e6fffb 100%);border-radius:12px;padding:14px 16px;margin-bottom:20px;border:1px solid #b7eb8f">
            <div style="font-size:12px;color:#52c41a;font-weight:600;margin-bottom:8px">📋 报价单摘要</div>
            <div style="display:flex;justify-content:space-between;font-size:13px">
              <span style="color:#595959">{{ deliveryForm.customer }}</span>
              <span style="font-weight:600;color:#fa541c">¥ {{ deliveryForm.amount }}</span>
            </div>
          </div>
          <!-- 收货地址 -->
          <div style="margin-bottom:16px">
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:#434343;margin-bottom:8px">
              <span style="width:22px;height:22px;background:#e6f7ff;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-size:12px">📍</span>
              收货地址 <span style="color:#ff4d4f">*</span>
            </label>
            <input class="form-control" style="focus-style" v-model="deliveryForm.addr" placeholder="请输入详细收货地址（省市区+街道门牌号）" />
          </div>
          <!-- 联系人和电话 -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div style="margin-bottom:16px">
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:#434343;margin-bottom:8px">
                <span style="width:22px;height:22px;background:#fff7e6;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-size:12px">👤</span>
                联系人 <span style="color:#ff4d4f">*</span>
              </label>
              <input class="form-control" style="focus-style" v-model="deliveryForm.contact" placeholder="请输入联系人姓名" />
            </div>
            <div style="margin-bottom:16px">
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:#434343;margin-bottom:8px">
                <span style="width:22px;height:22px;background:#f9f0ff;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-size:12px">📞</span>
                联系电话 <span style="color:#ff4d4f">*</span>
              </label>
              <input class="form-control" style="focus-style" v-model="deliveryForm.phone" placeholder="请输入联系电话" />
            </div>
          </div>
        </div>
        <div class="modal-footer" style="padding-top:0;border-top:1px solid #f0f0f0">
          <button class="btn btn-default" @click="showDeliveryModal=false" style="padding:10px 20px;border-radius:8px">取消</button>
          <button class="btn btn-primary" @click="confirmToOrder" style="padding:10px 28px;border-radius:8px;background:linear-gradient(135deg,#722ed1,#9754de);border:none;font-weight:600;box-shadow:0 4px 12px rgba(114,46,209,0.3)">确认转订单</button>
        </div>
      </div>
    </div>

    <!-- 选择一级渠道商弹窗（二级渠道商转订单时） -->
    <div class="modal-overlay" v-if="showParentPartnerModal" @click.self="cancelParentSelect">
      <div class="modal" style="max-width:480px">
        <div class="modal-header" style="border-bottom:none;padding-bottom:0;position:relative">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#1890ff,#52c41a);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px">🏢</div>
            <div>
              <div style="font-size:17px;font-weight:700;color:#1a1a1a">选择一级渠道商</div>
              <div style="font-size:12px;color:#8c8c8c;margin-top:2px">作为二级渠道商，请选择要向其下单的一级渠道商</div>
            </div>
          </div>
          <span class="modal-close" @click="cancelParentSelect" style="position:absolute;top:16px;right:16px;width:28px;height:28px;border-radius:50%;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-size:14px;color:#666">✕</span>
        </div>
        <div class="modal-body">
          <div v-if="parentPartnersList.length > 0" style="margin-bottom:20px">
            <label class="form-label required">选择上级渠道商</label>
            <select class="form-control" v-model="selectedParentPartnerId" style="margin-bottom:16px">
              <option v-for="p in parentPartnersList" :key="p.id" :value="p.id">{{ p.name }} ({{ p.region }})</option>
            </select>
            <div v-if="selectedParentPartnerId" style="background:linear-gradient(135deg,#f6ffed,#e6fffb);border:1px solid #b7eb8f;border-radius:12px;padding:16px">
              <div style="font-size:14px;font-weight:600;color:#389e0d;margin-bottom:8px">📋 选中的一级渠道商</div>
              <div style="background:white;border-radius:8px;padding:12px">
                <div style="font-size:15px;font-weight:600;color:#1a1a1a;margin-bottom:6px">{{ parentPartnersList.find(p => p.id === selectedParentPartnerId)?.name }}</div>
                <div style="font-size:13px;color:#666">
                  <div style="margin-bottom:4px">📞 联系人：{{ parentPartnersList.find(p => p.id === selectedParentPartnerId)?.contact || '未设置' }}</div>
                  <div style="margin-bottom:4px">📱 联系电话：{{ parentPartnersList.find(p => p.id === selectedParentPartnerId)?.phone || '未设置' }}</div>
                  <div>📍 所在区域：{{ parentPartnersList.find(p => p.id === selectedParentPartnerId)?.region || '未设置' }}</div>
                </div>
              </div>
            </div>
          </div>
          <div v-else style="text-align:center;padding:40px;color:#999">
            未找到绑定的一级渠道商
          </div>
        </div>
        <div class="modal-footer" style="padding-top:0;border-top:1px solid #f0f0f0">
          <button class="btn btn-default" @click="cancelParentSelect" style="padding:10px 20px;border-radius:8px">取消</button>
          <button class="btn btn-primary" @click="confirmParentAndCreateOrder" :disabled="!selectedParentPartnerId" style="padding:10px 28px;border-radius:8px;background:linear-gradient(135deg,#1890ff,#52c41a);border:none;font-weight:600;box-shadow:0 4px 12px rgba(24,144,255,0.3)">确认下单</button>
        </div>
      </div>
    </div>
  </div>`,
  setup() {
    const router = VueRouter.useRouter();
    const kw = ref('');
    const detail = ref(null);
    const loading = ref(false);
    
    // 全局产品数据（用于模板渲染）
    const PRODUCT_DATA = window.PRODUCT_DATA || {};
    
    // 区域管理员隔离
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    // 员工隔离
    // 获取当前用户ID（统一使用 id 字段，与后端数据一致）
    const userId = computed(() => store.user?.id || '');
    const isStaff = computed(() => store.user?.role === 'staff' || store.user?.role === 'partner_admin');
    
    // 报价状态标签映射（避免模板中使用内联对象字面量导致 Vue 解析错误）
    const statusLabelMap = { draft: '草稿', sent: '已发送', confirmed: '已确认', expired: '已过期' };
    
    // 辅助函数：获取报备的区域
    function getRegRegion(regId) {
      const reg = store.registrations.find(r => r.id === regId);
      return reg ? reg.region : null;
    }
    
    // 加载报价单列表
    async function loadQuotes() {
      loading.value = true;
      try {
        const result = await apiClient.getQuotes();
        if (result.success && result.data) {
          // 合并后端数据到本地 store，更新已有数据，添加新数据
          const existingMap = new Map(store.quotes.map(q => [q.id, q]));
          result.data.forEach(quote => {
            if (existingMap.has(quote.id)) {
              // 更新已有数据（保留响应式引用）
              Object.assign(existingMap.get(quote.id), quote);
            } else {
              // 添加新数据
              store.quotes.push(quote);
            }
          });
        }
      } catch (err) {
        console.error('加载报价单列表失败:', err);
      } finally {
        loading.value = false;
      }
    }
    
    // 从后端加载功能和硬件数据（用于展示报价单明细）
    const allFeaturesForDetail = ref([]);
    const allHardwareForDetail = ref([]);
    
    async function loadProductData() {
      try {
        const [featRes, hwRes] = await Promise.all([
          fetch(`${window.API_BASE}/features`).then(r => r.json()),
          fetch(`${window.API_BASE}/hardware`).then(r => r.json())
        ]);
        if (featRes.success) allFeaturesForDetail.value = featRes.data || [];
        if (hwRes.success) allHardwareForDetail.value = hwRes.data || [];
      } catch (e) {
        console.error('加载产品数据失败:', e);
      }
    }
    
    // 页面加载时获取报价单列表
    onMounted(() => {
      loadQuotes();
      loadProductData();
    });
    
    // 本区域报价单（管理员）或本人的报价单（员工）
    const myQuotes = computed(() => {
      const partnerId = store.user?.partnerId;
      const isPartnerAdmin = store.user?.role === 'partner_admin';
      // 企业管理员（partner_admin）：看本企业的全部报价单
      if (isPartnerAdmin && partnerId) {
        return store.quotes.filter(q => q.partnerId === partnerId);
      }
      // 普通员工：自己创建的 + 被指派给自己的
      if (isStaff.value) {
        return store.quotes.filter(q => 
          q.ownerId === userId.value || 
          q.createdBy === userId.value ||
          q.assignedStaffId === userId.value
        );
      }
      if (adminRegion.value) {
        // 区域管理员看本区域报价单（优先使用报价单自身的region字段）
        return store.quotes.filter(q => {
          // 优先使用报价单自身的region字段，如果没有则通过regId查找报备
          const region = q.region || getRegRegion(q.regId);
          return region === adminRegion.value;
        });
      }
      // 超级管理员看全部
      return store.quotes;
    });
    
    // (getCurrentRegion 和 resolveFeaturePriceConfig 已提取到全局作用域)

    // 计算功能单价（阶梯/固定）- 根据渠道分销层级返回折后价格（含区域覆盖）
    const STANDARD_MAINTENANCE_FEATURE_ID = 'FEAT-MOD-MAINTENANCE-01-01';
    const DEFAULT_MAINTENANCE_MONTHS = 12;
    const DEFAULT_STANDARD_MAINTENANCE_RATE = 15;

    function isStandardMaintenanceFeature(featureOrId) {
      const featureId = typeof featureOrId === 'string' ? featureOrId : featureOrId?.id;
      return featureId === STANDARD_MAINTENANCE_FEATURE_ID;
    }

    function getFeatureQuantityUnit(featureOrId) {
      return isStandardMaintenanceFeature(featureOrId) ? '月' : '点';
    }

    function getMaintenanceRateMap(maintenanceFeature) {
      const rateMap = {};
      if (!Array.isArray(maintenanceFeature?.maintenanceModuleRates)) return rateMap;
      maintenanceFeature.maintenanceModuleRates.forEach(item => {
        const moduleId = String(item?.moduleId || '').trim();
        const rate = Number(item?.rate);
        if (!moduleId) return;
        rateMap[moduleId] = Number.isFinite(rate) ? rate : DEFAULT_STANDARD_MAINTENANCE_RATE;
      });
      return rateMap;
    }

    function getMaintenanceFeatureOverrideMap(maintenanceFeature) {
      const overrideMap = {};
      if (!Array.isArray(maintenanceFeature?.maintenanceFeatureOverrides)) return overrideMap;
      maintenanceFeature.maintenanceFeatureOverrides.forEach(item => {
        const featureId = String(item?.featureId || '').trim();
        const rawRate = item?.rate;
        if (!featureId || rawRate === '' || rawRate === null || rawRate === undefined) return;
        const rate = Number(rawRate);
        if (!Number.isFinite(rate)) return;
        overrideMap[featureId] = rate;
      });
      return overrideMap;
    }

    function calculateDetailFeatureSubtotal(feat, endpoints, overrideMap = {}) {
      if (!feat || isStandardMaintenanceFeature(feat)) return 0;
      const qty = getFeatureEffectiveEndpoints(feat.id, endpoints, overrideMap);
      if (qty <= 0) return 0;
      return roundMoney(calcUnitPriceForDetail(feat, qty) * qty);
    }

    function calculateMaintenancePrice(features, hardwareTotal, endpoints, overrideMap = {}) {
      const maintenanceFeature = features.find(isStandardMaintenanceFeature);
      if (!maintenanceFeature) return 0;
      const rateMap = getMaintenanceRateMap(maintenanceFeature);
      const featureOverrideMap = getMaintenanceFeatureOverrideMap(maintenanceFeature);
      const annualPrice = features
        .filter(feat => !isStandardMaintenanceFeature(feat))
        .reduce((sum, feat) => {
          if (!feat?.moduleId) return sum;
          const featureSubtotal = calculateDetailFeatureSubtotal(feat, endpoints, overrideMap);
          if (!featureSubtotal) return sum;
          const overriddenRate = featureOverrideMap[feat.id];
          const rate = Number.isFinite(overriddenRate)
            ? overriddenRate
            : (Number.isFinite(rateMap[feat.moduleId]) ? rateMap[feat.moduleId] : DEFAULT_STANDARD_MAINTENANCE_RATE);
          return sum + featureSubtotal * rate / 100;
        }, 0);
      const months = getFeatureEffectiveEndpoints(STANDARD_MAINTENANCE_FEATURE_ID, endpoints, overrideMap);
      return roundMoney(annualPrice * months / DEFAULT_MAINTENANCE_MONTHS);
    }

    function calcUnitPriceForDetail(feat, endpoints) {
      if (!feat) return 0;

      const partner = getCurrentPartner() || {};
      const partnerLevel = partner.partnerLevel || 'none';
      const pc = resolveFeaturePriceConfig(feat);
      if (!pc) return 0;

      // 根据渠道分销层级选择价格
      let priceToUse;
      if (partnerLevel === 'primary' && pc.priceForPrimary) {
        priceToUse = pc.priceForPrimary;
      } else if (partnerLevel === 'secondary' && pc.priceForSecondary) {
        priceToUse = pc.priceForSecondary;
      } else {
        priceToUse = pc.tiers || pc.priceFixed;
      }

      // 固定价格
      if (pc.priceFixed !== null) {
        return typeof priceToUse === 'number' ? priceToUse : pc.priceFixed;
      }

      // 阶梯价格
      if (pc.tiers && pc.tiers.length) {
        if (Array.isArray(priceToUse)) {
          const tier = priceToUse.find(t => endpoints >= t.min && endpoints <= t.max) || priceToUse[priceToUse.length - 1];
          return tier ? (tier.price ?? getDiscountedTierUnitPrice(feat, tier)) : 0;
        } else {
          const tier = pc.tiers.find(t => endpoints >= t.min && endpoints <= t.max) || pc.tiers[pc.tiers.length - 1];
          return tier ? getDiscountedTierUnitPrice(feat, tier) : 0;
        }
      }

      if (feat.unitPrice) return feat.unitPrice;
      return 0;
    }

    function getFeatureEffectiveEndpoints(featureId, baseEndpoints = 0, overrideMap = {}) {
      const overrideValue = Number(overrideMap?.[featureId]);
      if (Number.isFinite(overrideValue) && overrideValue > 0) return Math.floor(overrideValue);
      if (isStandardMaintenanceFeature(featureId)) return DEFAULT_MAINTENANCE_MONTHS;
      const fallback = Number(baseEndpoints);
      return Number.isFinite(fallback) && fallback > 0 ? Math.floor(fallback) : 0;
    }

    function getQuoteDisplayEndpoints(quote) {
      if (!quote) return 0;
      const baseEndpoints = Number(quote.endpoints) || 0;
      const products = Array.isArray(quote.products) ? quote.products.filter(pid => !isStandardMaintenanceFeature(pid)) : [];
      const overrideMap = quote.featurePointOverrides || {};
      if (!products.length) return baseEndpoints;
      const maxPoints = products.reduce((maxValue, pid) => {
        const overrideValue = Number(overrideMap[pid]);
        const qty = Number.isFinite(overrideValue) && overrideValue > 0 ? Math.floor(overrideValue) : baseEndpoints;
        return Math.max(maxValue, qty);
      }, 0);
      return maxPoints || baseEndpoints;
    }

    function getComplimentaryWarrantyItem() {
      return {
        id: 'gift-standard-warranty-1y',
        productCode: 'GIFT-WARRANTY-1Y',
        name: '标准质保服务（赠送1年）',
        type: '服务',
        unitPrice: 0,
        subtotal: 0,
        qty: 1,
        qtyLabel: '1 年',
        qtyDisplay: '1 年'
      };
    }
    
    function isQuoteServiceItem(item) {
      const itemId = typeof item === 'string' ? item : item?.id;
      return itemId === 'gift-standard-warranty-1y' || isStandardMaintenanceFeature(itemId);
    }

    const detailItems = computed(() => {
      if (!detail.value) return [];
      const endpoints = detail.value.endpoints || 0;
      const overrideMap = detail.value.featurePointOverrides || {};
      const items = [];
      // 功能模块
      const productIds = detail.value.products || [];
      const hardwareIds = detail.value.hardwareIds || [];
      const detailFeatures = productIds.map(id => allFeaturesForDetail.value.find(f => f.id === id)).filter(Boolean);
      const detailHardwareTotal = hardwareIds.reduce((sum, hid) => {
        const hw = allHardwareForDetail.value.find(h => h.id === hid);
        return sum + (hw?.priceFixed || 0);
      }, 0);
      let maintenanceSubtotal = 0;
      try {
        maintenanceSubtotal = calculateMaintenancePrice(detailFeatures, detailHardwareTotal, endpoints, overrideMap);
      } catch (err) {
        console.error('partner quote detail maintenance calculation failed', err);
      }
      productIds.forEach(pid => {
        const feat = allFeaturesForDetail.value.find(f => f.id === pid);
        const qty = getFeatureEffectiveEndpoints(pid, endpoints, overrideMap);
        if (feat) {
          let subtotal = 0;
          try {
            subtotal = isStandardMaintenanceFeature(feat)
              ? maintenanceSubtotal
              : calculateDetailFeatureSubtotal(feat, endpoints, overrideMap);
          } catch (err) {
            console.error('partner quote detail item build failed', pid, err);
          }
          const unitPrice = qty > 0 ? roundMoney(subtotal / qty) : 0;
          items.push({ id: feat.id, name: feat.name, type: 'feature', unitPrice, subtotal, qty, qtyLabel: `${qty} ${getFeatureQuantityUnit(feat)}` });
        } else {
          items.push({ id: pid, name: pid, type: 'feature', unitPrice: 0, subtotal: 0, qty, qtyLabel: `${qty} ${getFeatureQuantityUnit(pid)}` });
        }
      });
      items.push(getComplimentaryWarrantyItem());
      // 硬件设备
      hardwareIds.forEach(hid => {
        const hw = allHardwareForDetail.value.find(h => h.id === hid);
        if (hw) {
          const qty = hw.qty || 1;
          items.push({ id: hw.id, name: hw.name, type: 'hardware', unitPrice: hw.priceFixed || 0, subtotal: (hw.priceFixed || 0) * qty, unit: `${qty} 台` });
        }
      });
      return items;
    });
    const detailSoftwareItems = computed(() => detailItems.value.filter(item => item.type !== 'hardware' && !isQuoteServiceItem(item)));
    const detailHardwareItems = computed(() => detailItems.value.filter(item => item.type === 'hardware'));
    const detailServiceItems = computed(() => detailItems.value.filter(item => isQuoteServiceItem(item)));
    const filtered = computed(() => {
      resetPage();
      return myQuotes.value.filter(q => !kw.value || q.customer.includes(kw.value) || q.id.includes(kw.value));
    });
    
    // 分页相关
    const currentPage = ref(1);
    const pageSize = ref(10);
    const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)));
    const paginatedData = computed(() => {
      const start = (currentPage.value - 1) * pageSize.value;
      return filtered.value.slice(start, start + pageSize.value);
    });
    const pageNumbers = computed(() => {
      const pages = [];
      const total = totalPages.value;
      const cur = currentPage.value;
      if (total <= 7) {
        for (let i = 1; i <= total; i++) pages.push(i);
      } else {
        if (cur <= 4) {
          for (let i = 1; i <= 5; i++) pages.push(i);
          pages.push('...');
          pages.push(total);
        } else if (cur >= total - 3) {
          pages.push(1);
          pages.push('...');
          for (let i = total - 4; i <= total; i++) pages.push(i);
        } else {
          pages.push(1);
          pages.push('...');
          for (let i = cur - 1; i <= cur + 1; i++) pages.push(i);
          pages.push('...');
          pages.push(total);
        }
      }
      return pages;
    });
    function prevPage() { if (currentPage.value > 1) currentPage.value--; }
    function nextPage() { if (currentPage.value < totalPages.value) currentPage.value++; }
    function goToPage(p) { if (p !== '...' && p >= 1 && p <= totalPages.value) currentPage.value = p; }
    function resetPage() { currentPage.value = 1; }
    
    // 收货地址弹窗相关
    const showDeliveryModal = ref(false);
    const deliveryForm = reactive({ addr: '', contact: '', phone: '' });
    const currentQuoteForOrder = ref(null);
    
    // 确保产品数据已加载
    async function ensureProductData() {
      if (allFeaturesForDetail.value.length === 0 || allHardwareForDetail.value.length === 0) {
        await loadProductData();
      }
    }
    
    // 查看报价单详情
    async function view(q) {
      // 确保产品数据已加载后再显示详情
      await ensureProductData();
      detail.value = q;
    }
    
    // 打开转订单弹窗
    function openToOrderModal(q) {
      const existing = store.orders.find(o => o.quoteId === q.id);
      if (existing) { alert('该报价单已转为订单：' + existing.id); return; }
      const reg = store.registrations.find(r => r.id === q.regId);
      deliveryForm.addr = reg ? reg.address || reg.city || '' : '';
      deliveryForm.contact = reg ? reg.contact || '' : '';
      deliveryForm.phone = reg ? reg.phone || '' : '';
      currentQuoteForOrder.value = q;
      showDeliveryModal.value = true;
    }
    
    // 二级渠道商选择一级渠道商弹窗的状态
    const showParentPartnerModal = ref(false);
    const currentQuoteForParentSelect = ref(null);
    const parentPartnersList = ref([]); // 绑定的多个一级渠道商列表
    const selectedParentPartnerId = ref(''); // 选中的一级渠道商ID
    
    // 打开选择一级渠道商弹窗（支持多个上级渠道商）
    async function openSelectParentPartnerModal(q) {
      // 通过API获取当前渠道商信息
      const partnerId = store.user?.partnerId;
      if (!partnerId) {
        alert('无法获取渠道商信息');
        return;
      }
      
      try {
        const res = await apiRequest('GET', `/partners/${partnerId}`);
        if (!res.success || !res.data) {
          alert('获取渠道商信息失败');
          return;
        }
        
        const currentPartner = res.data;
        
        // 检查是否为二级渠道商
        if (currentPartner.partnerLevel !== 'secondary') {
          // 不是二级渠道商，直接创建订单
          await toOrderDirectly(q);
          return;
        }
        
        // 获取绑定的一级渠道商ID列表（支持多个）
        const parentPartnerIds = currentPartner.parentPartnerIds || 
                                (currentPartner.parentPartnerId ? [currentPartner.parentPartnerId] : []);
        if (parentPartnerIds.length === 0) {
          alert('您未绑定任何一级渠道商，请联系管理员设置');
          return;
        }
        
        // 获取所有一级渠道商信息
        const parentPromises = parentPartnerIds.map(pid => apiRequest('GET', `/partners/${pid}`));
        const parentResults = await Promise.all(parentPromises);
        const validParents = parentResults.filter(r => r.success && r.data).map(r => r.data);
        
        if (validParents.length === 0) {
          alert('获取一级渠道商信息失败，请联系管理员');
          return;
        }
        
        // 更新列表和默认选中第一个
        parentPartnersList.value = validParents;
        selectedParentPartnerId.value = validParents[0].id;
        currentQuoteForParentSelect.value = q;
        showParentPartnerModal.value = true;
      } catch (err) {
        console.error('获取渠道商信息失败:', err);
        alert('获取渠道商信息失败，请检查网络连接');
      }
    }
    
    // 直接创建订单（用于非二级渠道商）
    async function toOrderDirectly(q) {
      const reg = store.registrations.find(r => r.id === q.regId);
      showDeliveryModal.value = false;
      
      try {
        const result = await apiClient.createOrder({
          quoteId: q.id,
          customer: q.customer,
          total: q.total,
          deliveryAddr: deliveryForm.addr?.trim() || (reg ? reg.city || '' : ''),
          contacts: reg ? `${reg.contact} ${reg.phone}` : '待填写',
          region: reg ? reg.region : (q.region || ''),
          regId: q.regId || '',
          oppId: q.oppId || '',
          partnerId: store.user?.partnerId || '',
          partnerName: store.user?.partnerName || store.user?.name || '',
          createdBy: q.createdBy || store.user.id,
          assignedStaffId: q.assignedStaffId || store.user.id,
        });
        
        if (result.success) {
          store.orders.unshift(result.data);
          alert('已成功转为订单，请在订单管理中查看。');
          currentQuoteForOrder.value = null;
          router.push('/order');
        } else {
          alert('创建订单失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        console.error('创建订单失败:', err);
        alert('创建订单失败，请检查网络连接');
      }
    }
    
    // 确认转订单
    async function confirmToOrder() {
      if (!deliveryForm.addr?.trim()) { alert('请填写收货地址'); return; }
      if (!deliveryForm.contact?.trim()) { alert('请填写联系人'); return; }
      if (!deliveryForm.phone?.trim()) { alert('请填写联系电话'); return; }
      
      const q = currentQuoteForOrder.value;
      showDeliveryModal.value = false;
      
      // 打开选择一级渠道商弹窗（内部会检查是否为二级渠道商）
      await openSelectParentPartnerModal(q);
    }
    
    // 确认选择一级渠道商并创建订单（支持多个上级渠道商）
    async function confirmParentAndCreateOrder() {
      if (!selectedParentPartnerId.value) {
        alert('请选择一级渠道商');
        return;
      }
      
      const q = currentQuoteForParentSelect.value;
      if (!q) {
        alert('报价单信息丢失');
        return;
      }
      
      // 根据选中的ID查找渠道商对象
      const selectedParent = parentPartnersList.value.find(p => p.id === selectedParentPartnerId.value);
      if (!selectedParent) {
        alert('选中的一级渠道商信息无效');
        return;
      }
      
      const reg = store.registrations.find(r => r.id === q.regId);
      showParentPartnerModal.value = false;
      
      try {
        const result = await apiClient.createOrder({
          quoteId: q.id,
          customer: q.customer,
          total: q.total,
          deliveryAddr: deliveryForm.addr?.trim() || (reg ? reg.city || '' : ''),
          contacts: reg ? `${reg.contact} ${reg.phone}` : '待填写',
          region: reg ? reg.region : (q.region || ''),
          regId: q.regId || '',
          oppId: q.oppId || '',
          partnerId: store.user?.partnerId || '',
          partnerName: store.user?.partnerName || store.user?.name || '',
          assignedPartnerId: selectedParent.id,  // ✅ 匹配后端校验字段
          assignedPartnerName: selectedParent.name,  // ✅ 传递一级渠道商名称
          createdBy: q.createdBy || store.user.id,
          assignedStaffId: q.assignedStaffId || store.user.id,
        });
        
        if (result.success) {
          store.orders.unshift(result.data);
          // 更新报价单状态为已转单
          const statusResult = await apiClient.updateQuoteStatus(q.id, 'converted');
          if (statusResult.success) {
            const idx = store.quotes.findIndex(x => x.id === q.id);
            if (idx !== -1) Object.assign(store.quotes[idx], statusResult.data);
          }
          alert('已成功转为订单，请在订单管理中查看。');
          currentQuoteForOrder.value = null;
          currentQuoteForParentSelect.value = null;
          selectedParentPartnerId.value = '';
          parentPartnersList.value = [];
          router.push('/order');
        } else {
          alert('创建订单失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        console.error('创建订单失败:', err);
        alert('创建订单失败，请检查网络连接');
      }
    }
    
    // 取消选择一级渠道商
    function cancelParentSelect() {
      showParentPartnerModal.value = false;
      currentQuoteForParentSelect.value = null;
      selectedParentPartnerId.value = '';
      parentPartnersList.value = [];
    }
    function regenerate(q) {
      // 跳转到新建报价页面，预填客户信息并带上原报价单ID用于覆盖
      router.push('/quote/new?customer=' + encodeURIComponent(q.customer) + '&regId=' + (q.regId || '') + '&oppId=' + (q.oppId || '') + '&replaceId=' + q.id);
    }
    function getOppName(oppId) {
      const opp = store.opportunities.find(o => o.id === oppId);
      return opp ? opp.name : oppId;
    }
    async function toOrder(q) {
      const existing = store.orders.find(o => o.quoteId === q.id);
      if (existing) { alert('该报价单已转为订单：' + existing.id); return; }
      
      // 打开选择一级渠道商弹窗（内部会检查是否为二级渠道商）
      await openSelectParentPartnerModal(q);
    }
    function downloadPdf(q) {
      // 获取报价单内容区 HTML
      const area = document.getElementById('quote-print-area');
      if (!area) return;
      // 收集依赖样式
      const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(l => '<link rel="stylesheet" href="' + l.href + '">')
        .join('');
      const styleTags = Array.from(document.querySelectorAll('style'))
        .map(s => '<style>' + s.innerHTML + '</style>')
        .join('');
      // 构建打印页面 HTML（避免在模板字符串中使用 <\/script> 导致 Vue 解析错误）
      var printHtml = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/>';
      printHtml += '<meta name="viewport" content="width=device-width,initial-scale=1"/>';
      printHtml += '<title>报价单 — ' + q.id + ' — ' + q.customer + '</title>';
      printHtml += styleLinks + styleTags;
      printHtml += '<style>@page { size: A4; margin: 12mm 10mm; }';
      printHtml += 'body { background:#f5f7fb !important; margin:0; padding:18px; font-family:-apple-system, PingFang SC, Microsoft YaHei, sans-serif; color:#1f1f1f; }';
      printHtml += '#quote-print-area { max-width:1120px; margin:0 auto; background:#fff; border-radius:18px; overflow:hidden; box-shadow:0 8px 24px rgba(15,23,42,.08); }';
      printHtml += '.print-only { display: block !important; }';
      printHtml += '.modal, .modal-overlay, .modal-header, .modal-footer { all: unset; display: block; }';
      printHtml += '.sidebar, .header, .search-bar, .btn { display: none !important; }';
      printHtml += 'table { width: 100%; border-collapse: collapse; page-break-inside: auto; }';
      printHtml += 'tr { page-break-inside: avoid; }';
      printHtml += 'th, td { border: 1px solid #e0e0e0; padding: 8px 10px; font-size: 12px; }';
      printHtml += 'thead { background: #f5f7fb; color: #1f1f1f; }';
      printHtml += '.quote-header { background: linear-gradient(135deg,#0a1f3d 0%, #0b3470 55%, #0d47a1 100%); color:#fff; border-radius:18px 18px 0 0; padding:34px 32px 26px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.08); position:relative; overflow:hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact; }';
      printHtml += '.quote-header::before { content:\"\"; position:absolute; inset:0; background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0)); pointer-events:none; }';
      printHtml += '.quote-header h2 { font-size:24px; font-weight:800; letter-spacing:-0.6px; position:relative; z-index:1; }';
      printHtml += '.quote-header p { opacity:.82; font-size:14px; margin-top:8px; position:relative; z-index:1; }';
      printHtml += '.quote-meta { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:22px; position:relative; z-index:1; }';
      printHtml += '.quote-meta-item { background: rgba(255,255,255,0.10); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px 14px; backdrop-filter: blur(3px); }';
      printHtml += '.quote-meta-item label { font-size:12px; opacity:.72; display:block; margin-bottom:6px; letter-spacing:.2px; }';
      printHtml += '.quote-meta-item span { font-size:15px; font-weight:700; line-height:1.35; word-break:break-word; }';
      printHtml += '.quote-body { border:1px solid #e5e7eb; border-top:none; border-radius:0 0 18px 18px; padding:32px 36px; background:#fff; }';
      printHtml += '.quote-total { display:flex; justify-content:flex-end; margin-top:20px; }';
      printHtml += '.quote-total-box { background:rgba(0,122,255,0.04); border:1px solid rgba(0,122,255,0.15); border-radius:14px; padding:20px 28px; min-width:300px; }';
      printHtml += '.total-row { display:flex; justify-content:space-between; font-size:14px; color:#6b7280; margin-bottom:10px; padding:0; border-bottom:none; }';
      printHtml += '.total-row.grand { font-size:20px; font-weight:700; color:#1677ff; border-top:1px solid rgba(0,122,255,0.15); padding-top:14px; margin-top:14px; margin-bottom:0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }';
      printHtml += '</style></head><body>';
      printHtml += area.innerHTML;
      printHtml += '<' + 'script>document.querySelectorAll(".print-only").forEach(el => el.style.display = "");';
      printHtml += 'window.onload = function() { window.print(); window.onafterprint = function(){ window.close(); }; };<' + '/script>';
      printHtml += '</body></html>';
      const win = window.open('', '_blank', 'width=900,height=700');
      if (!win) { alert('请允许弹出窗口后重试'); return; }
      win.document.open();
      win.document.write(printHtml);
      win.document.close();
    }
    
    // 修改报价单（导航到编辑页面，携带报价单ID）
    function editQuote(q) {
      router.push('/quote/edit/' + q.id);
    }
    
    // 删除报价单（仅草稿状态可删除）
    async function deleteQuote(q) {
      if (!confirm(`确定删除报价单 ${q.id}？`)) return;
      try {
        const result = await apiClient.deleteQuote(q.id);
        if (result.success) {
          const idx = store.quotes.findIndex(x => x.id === q.id);
          if (idx !== -1) store.quotes.splice(idx, 1);
          detail.value = null;
        } else {
          alert('删除失败：' + (result.error || '未知错误'));
        }
      } catch (err) { alert('删除失败'); }
    }
    
    return { kw, detail, adminRegion, isStaff, detailItems, detailSoftwareItems, detailHardwareItems, detailServiceItems, filtered, paginatedData, loading, fmt, view, regenerate, toOrder, downloadPdf, PRODUCT_DATA, getOppName, getQuoteDisplayEndpoints, loadQuotes, allFeaturesForDetail, statusLabelMap,
      currentPage, totalPages, pageNumbers, prevPage, nextPage, goToPage,
      showDeliveryModal, deliveryForm, openToOrderModal, confirmToOrder, editQuote, deleteQuote,
      showParentPartnerModal, parentPartnersList, selectedParentPartnerId, confirmParentAndCreateOrder, cancelParentSelect };
  }
};

// ── 新建报价单 ───────────────────────────────────────────────
const QuoteNew = {
  template: `
  <div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">{{ isEdit ? '✏️ 编辑报价单' : '📋 智能报价配置器' }}</div>
      </div>

      <!-- 快速报价提示 -->
      <div v-if="quickQuoteMsg" style="background:linear-gradient(135deg,#e6f4ff 0%,#f0f7ff 100%);border:1px solid #91caff;border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:12px">
        <span style="font-size:24px">💡</span>
        <div>
          <div style="font-size:14px;font-weight:600;color:#0958d9;margin-bottom:4px">快速报价模式</div>
          <div style="font-size:13px;color:#666">{{ quickQuoteMsg }}</div>
        </div>
      </div>

      <!-- 第一步：基本信息 -->
      <div style="background:#fafafa;border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #f0f0f0">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <div style="width:32px;height:32px;background:#1677ff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">1</div>
          <span style="font-size:15px;font-weight:700;color:#1a1a1a">基本信息</span>
        </div>
        <div class="form-grid form-grid-3">
          <div class="form-item"><label class="form-label required">客户名称</label>
            <div style="position:relative">
              <input class="form-control" v-model="customerSearch"
                :placeholder="selectedReg ? selectedReg.customer : '搜索已报备客户名称...'"
                @focus="openCustomerDropdown" @blur="onCustomerBlur"
                :disabled="isEdit"
                style="padding-right:36px"/>
              <span v-if="selectedReg && !isEdit" @click="clearRegSelection" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);cursor:pointer;color:#aaa;font-size:16px">✕</span>
              <div v-if="showCustomerDropdown && !isEdit" style="position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1px solid #e0e0e0;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.1);z-index:999;max-height:240px;overflow-y:auto">
                <div v-for="r in filteredRegs" :key="r.id"
                  @mousedown.prevent="selectReg(r)"
                  style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f5f5f5;transition:background .15s"
                  @mouseenter="$event.currentTarget.style.background='#f0f7ff'"
                  @mouseleave="$event.currentTarget.style.background=''">
                  <div style="font-size:13px;font-weight:600;color:#1a1a1a">{{ r.customer }}</div>
                  <div style="font-size:11px;color:#aaa;margin-top:2px">
                    <span class="tag tag-green" style="font-size:10px;padding:0 5px">已审批</span>
                    &nbsp;{{ r.contact || '-' }} · {{ r.phone || '-' }} · {{ r.industry || '-' }}
                    &nbsp;<span style="color:#bbb">{{ r.id }}</span>
                  </div>
                </div>
                <div v-if="!filteredRegs.length && !customerSearch" style="padding:14px;text-align:center;color:#aaa;font-size:12px">
                  暂无可选的已报备客户
                </div>
                <div v-else-if="!filteredRegs.length" style="padding:14px;text-align:center;color:#aaa;font-size:12px">
                  未找到“{{ customerSearch }}”对应的已报备客户
                </div>
              </div>
            </div>
          </div>
          <div class="form-item"><label class="form-label required">端点数量</label>
            <input class="form-control" type="number" v-model.number="form.endpoints" placeholder="例：200" min="1" @input="recalcAll"/>
          </div>
          <div class="form-item"><label class="form-label">报价有效期</label>
            <select class="form-control" v-model.number="form.validDays">
              <option value="15">15天</option><option value="30">30天</option><option value="60">60天</option><option value="90">90天</option>
            </select>
          </div>
        </div>
        <!-- 编辑模式：显示关联商机信息 -->
        <div v-if="isEdit && selectedOpps.length" style="margin-top:16px;padding:16px;background:linear-gradient(135deg,#f6ffed 0%,#e6fffb 100%);border:1px solid #b7eb8f;border-radius:12px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="font-size:16px">📈</span>
            <span style="font-size:13px;font-weight:600;color:#52c41a">关联商机（已选 {{ selectedOpps.length }} 个）</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div v-for="opp in selectedOpps" :key="opp.id" style="padding:10px;background:#fff;border-radius:8px;border-left:4px solid" :style="{borderLeftColor: stageColor(opp.stage)}">
              <div style="font-size:13px;font-weight:600;color:#1a1a1a">{{ opp.name }}</div>
              <div style="font-size:12px;color:#666">阶段：{{ stageLabel(opp.stage) }} | 金额：{{ fmt(opp.amount) }}元</div>
            </div>
          </div>
        </div>
        <div v-else-if="isEdit && form.oppIds.length && selectedOpps.length === 0" style="margin-top:16px;padding:16px;background:#fffbe6;border:1px solid #ffe58f;border-radius:12px">
          <div style="font-size:13px;color:#ad8b00">关联商机ID：{{ form.oppIds.join(', ') }}（商机信息不可用）</div>
        </div>
        <!-- 关联商机选择（选了客户就显示） -->
        <div class="form-grid" style="margin-top:16px" v-if="form.customer && !isEdit">
          <div class="form-item full">
            <label class="form-label required">关联商机 <span style="font-size:12px;color:#888;font-weight:400">（必须至少选择一个）</span></label>
            <!-- 有可选商机时显示选择列表 -->
            <div v-if="relatedOpportunities.length" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px">
              <div v-for="o in relatedOpportunities" :key="o.id"
                @click="toggleOppSelection(o.id)"
                style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:10px;cursor:pointer;border:2px solid"
                :style="{borderColor: form.oppIds.includes(o.id) ? '#1677ff' : '#e8e8e8', background: form.oppIds.includes(o.id) ? '#f0f7ff' : '#fff'}">
                <input type="checkbox" :checked="form.oppIds.includes(o.id)" style="pointer-events:none"/>
                <div>
                  <div style="font-size:13px;font-weight:600">{{ o.name }}</div>
                  <div style="font-size:11px;color:#888">{{ stageLabel(o.stage) }}</div>
                </div>
              </div>
            </div>
            <!-- 无可选商机时显示提示 -->
            <div v-else style="margin-top:10px;padding:16px;background:#fff7e6;border:1px solid #ffd591;border-radius:10px;text-align:center">
              <div style="font-size:13px;color:#ad6800;margin-bottom:10px">该客户暂无活跃商机，请先创建商机后再报价</div>
              <button class="btn btn-primary" style="padding:6px 20px;font-size:13px" @click="goToCreateOpp">+ 创建商机</button>
            </div>
            <div v-if="form.oppIds.length === 0" style="font-size:12px;color:#ff4d4f;margin-top:8px">请至少选择一个商机</div>
            <div v-else style="font-size:12px;color:#52c41a;margin-top:8px">已选择 {{ form.oppIds.length }} 个商机</div>
          </div>
        </div>
      </div>

      <!-- 第二步：选择报价模式 -->
      <div style="background:#fafafa;border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #f0f0f0">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <div style="width:32px;height:32px;background:#1677ff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">2</div>
          <span style="font-size:15px;font-weight:700;color:#1a1a1a">选择报价方式</span>
        </div>
        
        <!-- 报价模式选择 -->
        <div class="quote-mode-selector">
          <div class="mode-card" :class="{active: quoteMode === 'package'}" @click="setMode('package')">
            <div class="mode-icon">📦</div>
            <div class="mode-title">套餐报价</div>
            <div class="mode-desc">选择标准套餐</div>
          </div>
          <div class="mode-card" :class="{active: quoteMode === 'supplement'}" @click="setMode('supplement')" :style="{opacity: selectedPackage ? 1 : 0.5, cursor: selectedPackage ? 'pointer' : 'not-allowed'}">
            <div class="mode-icon">➕</div>
            <div class="mode-title">补充功能</div>
            <div class="mode-desc">在套餐基础上加功能</div>
          </div>
          <div class="mode-card" :class="{active: quoteMode === 'custom'}" @click="setMode('custom')">
            <div class="mode-icon">🎨</div>
            <div class="mode-title">自定义报价</div>
            <div class="mode-desc">自由组合所有模块</div>
          </div>
        </div>
        
        <!-- 套餐选择区 -->
        <div v-if="quoteMode === 'package' || quoteMode === 'supplement'" style="margin-top:24px">
          <div style="font-size:13px;font-weight:700;margin-bottom:14px;color:#333">▌ 选择产品套餐</div>
          <div v-if="loadingPackages" style="text-align:center;padding:40px;color:#999">
            <div style="font-size:32px;margin-bottom:8px">⏳</div>
            <div>加载产品套餐...</div>
          </div>
          <div v-else-if="!publishedPackages.length" style="text-align:center;padding:40px;color:#999;background:#fff;border-radius:12px;border:2px dashed #e8e8e8">
            <div style="font-size:32px;margin-bottom:8px">📭</div>
            <div>暂无可用套餐，请联系管理员配置</div>
          </div>
          <div v-else class="package-grid">
            <div v-for="pkg in publishedPackages" :key="pkg.id"
              class="package-card"
              :class="{selected: selectedPackageId === pkg.id}"
              @click="selectPackage(pkg)">
              <div class="check-mark">✓</div>
              <div class="package-header">
                <span class="package-icon">{{ pkg.icon }}</span>
                <span class="badge-blue">{{ pkg.featureIds?.length || 0 }}个功能</span>
              </div>
              <div class="package-name">{{ pkg.name }}</div>
              <div class="package-desc">{{ pkg.desc }}</div>
              <div class="package-footer">
                <span v-for="(fid,idx) in (pkg.featureIds || []).slice(0,3)" :key="idx" class="feat-tag">
                  {{ getFeatureName(fid) }}
                </span>
                <span v-if="(pkg.featureIds || []).length > 3" class="feat-tag more">+{{ pkg.featureIds.length - 3 }}</span>
              </div>
              <div class="package-card-actions">
                <button class="view-detail-btn" @click.stop="openPackageDetail(pkg)">
                  查看详情 ▸
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 补充功能区 -->
        <div v-if="quoteMode === 'supplement' && selectedPackage" style="margin-top:24px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="font-size:13px;font-weight:700;color:#333">▌ 补充功能 
              <span style="font-weight:400;font-size:12px;color:#888">（已选「{{ selectedPackage.name }}」，可添加以下功能）</span>
            </div>
            <div style="font-size:12px;color:#1677ff;font-weight:600">
              已选 {{ supplementFeatures.length }} 个
            </div>
          </div>
          <div v-for="cat in supplementCategories" :key="cat.id" style="margin-bottom:16px">
            <div class="section-header">
              <span class="cat-icon">{{ cat.icon }}</span>
              <span>{{ cat.name }}</span>
            </div>
            <div class="supplement-grid">
              <div v-for="feat in getAvailableFeatures(cat.id)" :key="feat.id"
                class="supplement-card"
                :class="{selected: supplementFeatures.includes(feat.id)}"
                @click="toggleSupplementFeature(feat.id)">
                <div class="check-mark">✓</div>
                <div class="feat-name">{{ feat.name }}</div>
                <div class="feat-price">{{ getFeaturePriceDisplay(feat) }}</div>
              </div>
            </div>
          </div>
          <div v-if="supplementCategories.length === 0" style="text-align:center;padding:30px;color:#999">
            当前套餐已包含该大类全部功能
          </div>
        </div>
        
        <!-- 自定义报价区 - 卡片式选择 -->
        <div v-if="quoteMode === 'custom'" style="margin-top:24px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="font-size:13px;font-weight:700;color:#333">▌ 选择功能模块</div>
            <div style="font-size:12px;color:#1677ff;font-weight:600">
              已选 {{ customFeatures.length }} 个功能
            </div>
          </div>
          
          <!-- 产品大类卡片网格 -->
          <div class="category-card-grid">
            <div v-for="cat in categories" :key="cat.id"
              class="category-card"
              :class="{selected: customFeatures.some(fid => getFeatureCategoryId(fid) === cat.id)}"
              @click="toggleCategoryExpand(cat.id)">
              <div class="cat-card-icon">{{ cat.icon }}</div>
              <div class="cat-card-name">{{ cat.name }}</div>
              <div class="cat-card-count">{{ cat.featureCount }}个功能</div>
              <div class="cat-card-selected" v-if="customFeatures.filter(fid => getFeatureCategoryId(fid) === cat.id).length > 0">
                已选 {{ customFeatures.filter(fid => getFeatureCategoryId(fid) === cat.id).length }}
              </div>
              <div class="cat-card-arrow" :class="{expanded: expandedCategoryId === cat.id}">▼</div>
            </div>
          </div>
          
          <!-- 展开的功能模块列表 -->
          <div v-if="expandedCategoryId" class="category-feature-panel">
            <div class="feature-panel-header">
              <span class="cat-icon">{{ getCategoryIcon(expandedCategoryId) }}</span>
              <span>{{ getCategoryName(expandedCategoryId) }}</span>
              <span style="margin-left:auto;font-size:12px;color:#666">点击选择功能</span>
              <button class="detail-close-btn" @click="expandedCategoryId = ''">×</button>
            </div>
            <div class="feature-panel-content">
              <div v-for="mod in getCategoryModules(expandedCategoryId)" :key="mod.id" class="feature-module-group">
                <div class="feature-module-name">
                  <span class="mod-icon">{{ mod.icon }}</span>
                  <span>{{ mod.name }}</span>
                </div>
                <div class="feature-chips">
                  <div v-for="feat in mod.features" :key="feat.id"
                    class="feature-chip"
                    :class="{selected: customFeatures.includes(feat.id)}"
                    @click="toggleCustomFeature(feat.id)">
                    <span class="chip-check">✓</span>
                    <span class="chip-label">{{ feat.name }}</span>
                    <span class="chip-price-tag">{{ getFeaturePriceDisplay(feat) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 加配硬件区 -->
        <div v-if="publishedHardware.length && quoteMode !== 'custom'" style="margin-top:24px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="font-size:13px;font-weight:700;color:#333">▌ 加配硬件 <span style="font-weight:400;font-size:12px;color:#888">（可选）</span></div>
            <div style="font-size:12px;color:#fa8c16;font-weight:600">
              已选 {{ selectedHardware.length }} 件
            </div>
          </div>
          <div class="hardware-grid">
            <div v-for="hw in publishedHardware" :key="hw.id"
              class="hardware-card"
              :class="{selected: selectedHardware.includes(hw.id)}"
              @click="toggleHardware(hw.id)">
              <div class="check-mark">✓</div>
              <div class="hw-icon">{{ hw.icon }}</div>
              <div class="hw-name">{{ hw.name }}</div>
              <div class="hw-model">{{ hw.model }}</div>
              <div class="hw-specs">{{ hw.specs }}</div>
              <div class="hw-price">{{ fmt(hw.priceFixed) }}/{{ hw.unit }}</div>
            </div>
          </div>
        </div>
        
        <!-- 自定义模式下的硬件选择 -->
        <div v-if="quoteMode === 'custom' && publishedHardware.length" style="margin-top:24px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="font-size:13px;font-weight:700;color:#333">▌ 硬件设备 <span style="font-weight:400;font-size:12px;color:#888">（可选）</span></div>
            <div style="font-size:12px;color:#fa8c16;font-weight:600">
              已选 {{ selectedHardware.length }} 件
            </div>
          </div>
          <div class="hardware-grid">
            <div v-for="hw in publishedHardware" :key="hw.id"
              class="hardware-card"
              :class="{selected: selectedHardware.includes(hw.id)}"
              @click="toggleHardware(hw.id)">
              <div class="check-mark">✓</div>
              <div class="hw-icon">{{ hw.icon }}</div>
              <div class="hw-name">{{ hw.name }}</div>
              <div class="hw-model">{{ hw.model }}</div>
              <div class="hw-specs">{{ hw.specs }}</div>
              <div class="hw-price">{{ fmt(hw.priceFixed) }}/{{ hw.unit }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 第三步：报价汇总 -->
      <div style="background:linear-gradient(135deg,#f0f7ff 0%,#e6f4ff 100%);border:2px solid #91caff;border-radius:16px;padding:24px;margin-bottom:24px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <div style="width:32px;height:32px;background:#1677ff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">3</div>
          <span style="font-size:15px;font-weight:700;color:#1a1a1a">报价汇总</span>
          <span style="margin-left:auto;font-size:13px;color:#666">端点数：<strong style="color:#1677ff;font-size:16px">{{ form.endpoints || '—' }}</strong></span>
        </div>
        <div v-if="false" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;margin-bottom:16px;background:#fff;border:1px solid #d6e4ff;border-radius:12px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" v-model="hasSensitiveKeywordWorkload" />
            <span style="font-size:13px;font-weight:600;color:#1d39c4">包含敏感关键字工作量</span>
          </label>
          <span style="font-size:12px;color:#666">仅影响标准工作量建议，不影响报价金额</span>
        </div>
        
        <!-- 已选套餐 -->
        <div v-if="selectedPackage" class="summary-section package-summary">
          <div class="summary-title">📦 基础套餐</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div>
              <span style="font-size:15px;font-weight:700">{{ selectedPackage.icon }} {{ selectedPackage.name }}</span>
            </div>
            <div style="font-size:16px;font-weight:700;color:#1677ff">{{ fmt(packagePrice) }}</div>
          </div>
          <div style="margin-bottom:8px">
            <span class="summary-badge">{{ (selectedPackage.featureIds || []).length }} 个功能</span>
          </div>
          <!-- 套餐包含的功能列表 -->
          <div class="summary-package-features" :class="{collapsed: !summaryPackageExpanded}">
            <div v-for="fid in (selectedPackage.featureIds || [])" :key="fid" class="summary-feature-row">
              <span class="sfeat-dot">▸</span>
              <span class="sfeat-name">{{ getFeatureName(fid) }}</span>
              <span style="display:flex;align-items:center;gap:8px">
                <input class="form-control" type="number" min="1" :value="getFeaturePointInputValue(fid)" @focus="startFeaturePointEditing(fid)" @input="updateFeaturePointDraft(fid, $event.target.value)" @blur="commitFeaturePointOverride(fid)" @keydown.enter="$event.target.blur()" style="width:86px;height:30px;padding:4px 8px" />
                <span style="font-size:12px;color:#666">{{ getFeatureQuantityUnit(fid) }}</span>
                <span class="sfeat-price">{{ fmt(getFeatureTotalPrice(fid)) }}</span>
              </span>
            </div>
          </div>
          <div v-if="(selectedPackage.featureIds || []).length > 5" 
            class="summary-expand-btn"
            @click="summaryPackageExpanded = !summaryPackageExpanded">
            {{ summaryPackageExpanded ? '▲ 收起' : '▼ 展开全部功能' }}
          </div>
        </div>
        
        <!-- 补充功能 -->
        <div v-if="supplementFeatures.length" class="summary-section">
          <div class="summary-title">➕ 补充功能</div>
          <div v-for="fid in supplementFeatures" :key="fid" class="summary-row">
            <span>{{ getFeatureName(fid) }}</span>
            <span style="display:flex;align-items:center;gap:8px">
              <input class="form-control" type="number" min="1" :value="getFeaturePointInputValue(fid)" @focus="startFeaturePointEditing(fid)" @input="updateFeaturePointDraft(fid, $event.target.value)" @blur="commitFeaturePointOverride(fid)" @keydown.enter="$event.target.blur()" style="width:86px;height:30px;padding:4px 8px" />
              <span style="font-size:12px;color:#666">{{ getFeatureQuantityUnit(fid) }}</span>
              <span style="font-weight:600;color:#1677ff">{{ fmt(getFeatureTotalPrice(fid)) }}</span>
            </span>
          </div>
        </div>
        
        <!-- 自定义功能 -->
        <div v-if="customFeatures.length" class="summary-section">
          <div class="summary-title">🎨 自选功能</div>
          <div v-for="fid in customFeatures" :key="fid" class="summary-row">
            <span>{{ getFeatureName(fid) }}</span>
            <span style="display:flex;align-items:center;gap:8px">
              <input class="form-control" type="number" min="1" :value="getFeaturePointInputValue(fid)" @focus="startFeaturePointEditing(fid)" @input="updateFeaturePointDraft(fid, $event.target.value)" @blur="commitFeaturePointOverride(fid)" @keydown.enter="$event.target.blur()" style="width:86px;height:30px;padding:4px 8px" />
              <span style="font-size:12px;color:#666">{{ getFeatureQuantityUnit(fid) }}</span>
              <span style="font-weight:600;color:#1677ff">{{ fmt(getFeatureTotalPrice(fid)) }}</span>
            </span>
          </div>
        </div>

        <div class="summary-section">
          <div class="summary-title">🎁 赠送服务</div>
          <div class="summary-row">
            <span>标准质保服务（赠送1年）</span>
            <span style="display:flex;align-items:center;gap:8px">
              <span style="font-size:12px;color:#666">1 年</span>
              <span style="font-weight:600;color:#52c41a">{{ fmt(0) }}</span>
            </span>
          </div>
        </div>
        
        <!-- 硬件 -->
        <div v-if="selectedHardware.length" class="summary-section hardware">
          <div class="summary-title">🖥️ 硬件设备</div>
          <div v-for="hid in selectedHardware" :key="hid" class="summary-row">
            <span>{{ getHardwareName(hid) }}</span>
            <span style="font-weight:600;color:#fa8c16">{{ fmt(getHardwarePrice(hid)) }}</span>
          </div>
        </div>
        
        <!-- 总额 -->
        <div class="grand-total-box">
          <div v-if="discountAmount > 0" class="total-row" style="color:#888">
            <span>产品原价</span>
            <span style="text-decoration:line-through">{{ fmt(originalSubTotal) }}</span>
          </div>
          <div v-if="discountAmount > 0" class="total-row" style="color:#52c41a">
            <span>优惠金额</span>
            <span>-{{ fmt(discountAmount) }}</span>
          </div>
          <div class="total-row"><span>产品合计</span><span>{{ fmt(subTotal) }}</span></div>
          <div v-if="hardwareTotal > 0" class="total-row"><span>硬件合计</span><span style="color:#fa8c16">{{ fmt(hardwareTotal) }}</span></div>
          <div class="total-row grand"><span>报价总额</span><span style="font-size:22px">{{ fmt(grandTotal) }}</span></div>
        </div>
        <div v-if="ipgQuoteLoading || ipgQuotePreview || ipgQuoteError" style="margin-top:16px;padding:16px;border-radius:14px;background:#fff;border:1px solid #ffe7ba">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
            <div>
              <div style="font-size:14px;font-weight:700;color:#ad4e00">友商 IPG 参考对比</div>
              <div style="font-size:12px;color:#666;margin-top:4px">仅实时预览，不影响联软报价、保存和订单主线。</div>
            </div>
            <div v-if="ipgQuoteLoading" style="font-size:12px;color:#999;white-space:nowrap">计算中...</div>
          </div>
          <div v-if="ipgQuoteError" style="margin-top:12px;font-size:13px;color:#cf1322">{{ ipgQuoteError }}</div>
          <template v-else-if="ipgQuotePreview">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-top:12px">
              <div style="padding:12px;border-radius:10px;background:#fafafa;border:1px solid #f0f0f0">
                <div style="font-size:12px;color:#888">联软总价</div>
                <div style="font-size:18px;font-weight:700;color:#222;margin-top:6px">{{ fmt(ipgQuotePreview.lianruanTotal) }}</div>
              </div>
              <div style="padding:12px;border-radius:10px;background:#fff7e6;border:1px solid #ffe7ba">
                <div style="font-size:12px;color:#ad4e00">IPG参考总价</div>
                <div style="font-size:18px;font-weight:700;color:#ad4e00;margin-top:6px">{{ fmt(ipgQuotePreview.ipgReferenceTotal) }}</div>
              </div>
              <div style="padding:12px;border-radius:10px;background:#fafafa;border:1px solid #f0f0f0">
                <div style="font-size:12px;color:#888">差额</div>
                <div style="font-size:18px;font-weight:700;margin-top:6px" :style="{color: ipgQuotePreview.difference > 0 ? '#cf1322' : ipgQuotePreview.difference < 0 ? '#237804' : '#222'}">{{ fmt(ipgQuotePreview.difference) }}</div>
              </div>
              <div style="padding:12px;border-radius:10px;background:#fafafa;border:1px solid #f0f0f0">
                <div style="font-size:12px;color:#888">差额比例</div>
                <div style="font-size:18px;font-weight:700;color:#222;margin-top:6px">{{ ipgQuotePreview.differenceRatioText }}</div>
              </div>
            </div>
            <div style="margin-top:12px;font-size:13px;color:#444">{{ ipgQuotePreview.differenceText }}</div>
            <div v-if="ipgQuotePreview.notes && ipgQuotePreview.notes.length" style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
              <div v-for="(note, idx) in ipgQuotePreview.notes.slice(0, 5)" :key="idx" style="font-size:12px;color:#666;line-height:1.5">· {{ note }}</div>
            </div>
          </template>
        </div>
        <div style="margin-top:16px;padding:16px;border-radius:14px;background:#fff;border:1px solid #d9f7be">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
            <div>
              <div style="font-size:14px;font-weight:700;color:#237804">标准工作量建议</div>
              <div style="font-size:12px;color:#666;margin-top:4px">{{ workloadPreview?.workloadSummary || '根据产品类型和点数自动计算' }}</div>
            </div>
            <div style="text-align:right">
              <div v-if="workloadLoading" style="font-size:12px;color:#999">计算中...</div>
              <div v-else-if="workloadPreview?.available" style="font-size:24px;font-weight:700;color:#237804">{{ workloadPreview.standardPersonDays }}</div>
              <div v-else style="font-size:20px;font-weight:700;color:#999">--</div>
              <div style="font-size:12px;color:#666">人天</div>
            </div>
          </div>
          <div v-if="workloadPreview?.available" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            <span class="tag tag-blue">{{ workloadPreview.productType || '未分类' }}</span>
            <span class="tag" :class="effectiveSensitiveKeywordWorkload ? 'tag-orange' : 'tag-gray'">{{ effectiveSensitiveKeywordWorkload ? '含敏感关键字' : '不含敏感关键字' }}</span>
            <span class="tag tag-green">{{ workloadPreview?.workloadEndpoints || form.endpoints }} 点</span>
          </div>
          <div v-if="workloadPreview?.workloadClassifications?.matchedFeatureNames?.length" style="margin-top:12px;font-size:12px;color:#666">
            参与判定产品：{{ workloadPreview.workloadClassifications.matchedFeatureNames.join('、') }}
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px">
        <button class="btn btn-default" @click="$router.back()">取消</button>
        <button class="btn btn-primary btn-lg" @click="saveQuote" :disabled="!canSave">
          <span v-if="!canSave">请完善信息</span>
          <span v-else>{{ isEdit ? '保存报价单' : '生成报价单' }}</span>
        </button>
      </div>

      <!-- 套餐详情弹窗 -->
      <div class="modal-overlay" v-if="packageDetail" @click.self="packageDetail = null">
        <div class="modal modal-xl">
          <div class="modal-header">
            <div class="modal-title">
              <span class="pkg-detail-icon">{{ packageDetail.icon }}</span>
              {{ packageDetail.name }} — 套餐详情
            </div>
            <span class="modal-close" @click="packageDetail = null">✕</span>
          </div>
          <div class="modal-body">
            <div class="pkg-detail-desc">{{ packageDetail.desc }}</div>
            <div class="pkg-detail-stats">
              <div class="pkg-stat-item">
                <span class="stat-num">{{ (packageDetail.featureIds || []).length }}</span>
                <span class="stat-label">功能模块</span>
              </div>
              <div class="pkg-stat-item">
                <span class="stat-num">{{ packagePriceForDetail }}</span>
                <span class="stat-label">套餐价格</span>
              </div>
            </div>
            <div class="pkg-detail-divider"></div>
            <div class="pkg-detail-title">📋 包含功能列表</div>
            <div class="pkg-detail-list">
              <div v-for="(fid, idx) in packageDetail.featureIds" :key="fid" class="pkg-feature-row">
                <span class="pkg-feature-index">{{ idx + 1 }}</span>
                <span class="pkg-feature-name">{{ getFeatureName(fid) }}</span>
                <span class="pkg-feature-price">{{ fmt(getFeaturePrice(fid)) }}</span>
                <span class="pkg-feature-price-type">{{ getFeaturePriceType(fid) }}</span>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" @click="packageDetail = null">关闭</button>
            <button class="btn btn-primary" @click="packageDetail = null; selectPackage(packageDetail)">
              选择此套餐
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>`,
  setup() {
    const router = VueRouter.useRouter();
    const route = VueRouter.useRoute();
    
    // 获取当前用户ID
    const userId = computed(() => store.user?.id || '');
    const isStaff = computed(() => store.user?.role === 'staff' || store.user?.role === 'partner_admin');
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    
    // 编辑模式：从路由获取报价单ID（格式：/quote/edit/:id）
    const editId = route.params.id || '';
    const isEdit = !!editId;
    
    // 获取替换的报价单ID
    const replaceId = route.query.replaceId || '';
    const quickQuoteMsg = ref('');
    
    // 报价模式
    const quoteMode = ref('package'); // package | supplement | custom
    const form = reactive({
      customer: decodeURIComponent(route.query.customer || ''),
      regId: route.query.regId || '',
      oppIds: route.query.oppId ? [route.query.oppId] : [], // 改为数组，支持多选
      endpoints: 100,
      validDays: 30,
    });
    
    // 产品目录数据（从API加载）
    const productTree = ref([]);
    const publishedPackages = ref([]);
    const publishedHardware = ref([]);
    const allFeatures = ref([]);
    const loadingPackages = ref(true);
    const STANDARD_MAINTENANCE_FEATURE_ID = 'FEAT-MOD-MAINTENANCE-01-01';
    const DEFAULT_MAINTENANCE_MONTHS = 12;
    const DEFAULT_STANDARD_MAINTENANCE_RATE = 15;
    
    // 选择状态
    const selectedPackageId = ref('');
    const supplementFeatures = ref([]);
    const customFeatures = ref([]);
    const selectedHardware = ref([]);
    const featurePointOverrides = reactive({});
    const featurePointDrafts = reactive({});
    const hasSensitiveKeywordWorkload = ref(false);
    const workloadPreview = ref(null);
    const workloadLoading = ref(false);
    const ipgQuotePreview = ref(null);
    const ipgQuoteLoading = ref(false);
    const ipgQuoteError = ref('');
    let ipgQuoteRequestSeq = 0;
    const effectiveSensitiveKeywordWorkload = computed(() =>
      Boolean(workloadPreview.value?.hasSensitiveKeywordWorkload)
    );

    function isStandardMaintenanceFeature(featureOrId) {
      const featureId = typeof featureOrId === 'string' ? featureOrId : featureOrId?.id;
      return featureId === STANDARD_MAINTENANCE_FEATURE_ID;
    }

    function getFeatureQuantityUnit(featureOrId) {
      return isStandardMaintenanceFeature(featureOrId) ? '月' : '点';
    }

    function getMaintenanceRateMap(maintenanceFeature) {
      const rateMap = {};
      if (!Array.isArray(maintenanceFeature?.maintenanceModuleRates)) return rateMap;
      maintenanceFeature.maintenanceModuleRates.forEach(item => {
        const moduleId = String(item?.moduleId || '').trim();
        const rate = Number(item?.rate);
        if (!moduleId) return;
        rateMap[moduleId] = Number.isFinite(rate) ? rate : DEFAULT_STANDARD_MAINTENANCE_RATE;
      });
      return rateMap;
    }

    function getMaintenanceFeatureOverrideMap(maintenanceFeature) {
      const overrideMap = {};
      if (!Array.isArray(maintenanceFeature?.maintenanceFeatureOverrides)) return overrideMap;
      maintenanceFeature.maintenanceFeatureOverrides.forEach(item => {
        const featureId = String(item?.featureId || '').trim();
        const rawRate = item?.rate;
        if (!featureId || rawRate === '' || rawRate === null || rawRate === undefined) return;
        const rate = Number(rawRate);
        if (!Number.isFinite(rate)) return;
        overrideMap[featureId] = rate;
      });
      return overrideMap;
    }

    function normalizeFeaturePointOverrides(source = {}) {
      const normalized = {};
      if (!source || typeof source !== 'object' || Array.isArray(source)) return normalized;
      Object.entries(source).forEach(([featureId, value]) => {
        const points = Number(value);
        if (featureId && Number.isFinite(points) && points > 0) {
          normalized[featureId] = Math.floor(points);
        }
      });
      return normalized;
    }

    function applyFeaturePointOverrides(source = {}) {
      const normalized = normalizeFeaturePointOverrides(source);
      Object.keys(featurePointOverrides).forEach(key => delete featurePointOverrides[key]);
      Object.assign(featurePointOverrides, normalized);
      Object.keys(featurePointDrafts).forEach(key => delete featurePointDrafts[key]);
    }
    
    // 展开状态
    const expandedCategoryId = ref(''); // 当前展开的产品大类ID
    const summaryPackageExpanded = ref(false); // 汇总中套餐功能是否展开
    const packageDetail = ref(null); // 套餐详情弹窗
    
    // 选中套餐
    const selectedPackage = computed(() => 
      publishedPackages.value.find(p => p.id === selectedPackageId.value)
    );
    
    // 已发布的产品大类（排除硬件）
    const categories = computed(() => 
      productTree.value.filter(c => c.type !== 'hardware')
    );
    
    // 补充功能模式：可添加的大类（套餐内没有的大类）
    const supplementCategories = computed(() => {
      if (!selectedPackage.value) return [];
      const pkgFeatureIds = new Set(selectedPackage.value.featureIds || []);
      // 找出套餐内没有功能的大类
      return categories.value.filter(cat => {
        const catFeatures = allFeatures.value.filter(f => {
          const mod = productTree.value.find(m => m.modules?.some(mod => mod.features?.some(feat => feat.id === f.id)));
          return cat.modules?.some(m => m.features?.some(f => f.id === f.id));
        });
        return cat.modules?.some(mod => 
          mod.features?.some(feat => !pkgFeatureIds.has(feat.id))
        );
      });
    });
    
    // 加载产品目录数据
    async function loadProductCatalog() {
      loadingPackages.value = true;
      try {
        // 加载产品树结构
        const res = await fetch(`${window.API_BASE}/product-tree?published=true`);
        const result = await res.json();
        if (result.success) {
          productTree.value = result.data || [];
        }
        
        // 加载完整功能数据（包含价格阶梯信息）
        const featRes = await fetch(`${window.API_BASE}/features?published=true`);
        const featResult = await featRes.json();
        if (featResult.success) {
          // 构建功能ID到功能详情的映射
          const featMap = {};
          featResult.data.forEach(f => { featMap[f.id] = f; });
          const moduleMetaMap = {};
          
          // 提取所有功能，并补充完整价格信息
          const features = [];
          result.data?.forEach(cat => {
            cat.modules?.forEach(mod => {
              moduleMetaMap[mod.id] = { categoryId: cat.id, categoryName: cat.name, moduleName: mod.name };
              mod.features?.forEach(feat => {
                const fullFeat = featMap[feat.id] || feat;
                features.push({
                  ...fullFeat,
                  moduleName: mod.name,
                  categoryId: cat.id
                });
              });
            });
          });
          const existingIds = new Set(features.map(item => item.id));
          featResult.data.forEach(feature => {
            if (existingIds.has(feature.id)) return;
            const moduleMeta = moduleMetaMap[feature.moduleId] || {};
            features.push({
              ...feature,
              moduleName: moduleMeta.moduleName || feature.moduleName || '',
              categoryId: moduleMeta.categoryId || feature.categoryId || '',
              categoryName: moduleMeta.categoryName || feature.categoryName || ''
            });
          });
          allFeatures.value = features;
        }
        
        // 加载套餐
        const pkgRes = await fetch(`${window.API_BASE}/packages?published=true`);
        const pkgResult = await pkgRes.json();
        if (pkgResult.success) {
          publishedPackages.value = pkgResult.data || [];
        }
        
        // 加载硬件（不强制过滤发布状态，显示所有硬件供选择）
        const hwRes = await fetch(`${window.API_BASE}/hardware`);
        const hwResult = await hwRes.json();
        if (hwResult.success) {
          publishedHardware.value = hwResult.data || [];
        }
      } catch (err) {
        console.error('加载产品目录失败:', err);
      } finally {
        loadingPackages.value = false;
      }
    }
    
    // 计算套餐价格
    const packagePrice = computed(() => {
      if (!selectedPackage.value) return 0;
      return calculateDisplayedFeatureSectionTotal(selectedPackage.value.featureIds || []);
    });
    
    // 计算补充功能价格
    function getSupplementPrice() {
      return calculateDisplayedFeatureSectionTotal(supplementFeatures.value);
    }
    
    // 计算自定义功能价格
    function getCustomPrice() {
      return calculateDisplayedFeatureSectionTotal(customFeatures.value);
    }

    function getFeatureEffectiveEndpoints(featureId, baseEndpoints = form.endpoints, overrideMap = featurePointOverrides) {
      const overrideValue = Number(overrideMap?.[featureId]);
      if (Number.isFinite(overrideValue) && overrideValue > 0) return Math.floor(overrideValue);
      if (isStandardMaintenanceFeature(featureId)) return DEFAULT_MAINTENANCE_MONTHS;
      const fallback = Number(baseEndpoints);
      return Number.isFinite(fallback) && fallback > 0 ? Math.floor(fallback) : 0;
    }

    function setFeaturePointOverride(featureId, value) {
      if (!featureId) return;
      const points = Number(value);
      const basePoints = isStandardMaintenanceFeature(featureId) ? DEFAULT_MAINTENANCE_MONTHS : Number(form.endpoints);
      if (!Number.isFinite(points) || points <= 0) {
        delete featurePointOverrides[featureId];
        return;
      }
      const normalized = Math.floor(points);
      if (Number.isFinite(basePoints) && normalized === Math.floor(basePoints)) {
        delete featurePointOverrides[featureId];
        return;
      }
      featurePointOverrides[featureId] = normalized;
    }

    function startFeaturePointEditing(featureId) {
      if (!featureId) return;
      featurePointDrafts[featureId] = String(getFeaturePoints(featureId));
    }

    function updateFeaturePointDraft(featureId, value) {
      if (!featureId) return;
      featurePointDrafts[featureId] = value;
    }

    function commitFeaturePointOverride(featureId) {
      if (!featureId) return;
      if (!Object.prototype.hasOwnProperty.call(featurePointDrafts, featureId)) return;
      const rawValue = featurePointDrafts[featureId];
      if (rawValue === '') {
        delete featurePointOverrides[featureId];
        delete featurePointDrafts[featureId];
        return;
      }
      setFeaturePointOverride(featureId, rawValue);
      delete featurePointDrafts[featureId];
    }

    function clearUnusedFeaturePointOverrides() {
      const validIds = new Set(selectedQuoteProductIds.value);
      Object.keys(featurePointOverrides).forEach(featureId => {
        if (!validIds.has(featureId)) delete featurePointOverrides[featureId];
      });
      Object.keys(featurePointDrafts).forEach(featureId => {
        if (!validIds.has(featureId)) delete featurePointDrafts[featureId];
      });
    }

    function getFeatureById(featureId) {
      return allFeatures.value.find(f => f.id === featureId) || null;
    }

    function getFeaturesByIds(featureIds = []) {
      return featureIds.map(featureId => getFeatureById(featureId)).filter(Boolean);
    }

    function getCurrentQuoteFeatures() {
      if (quoteMode.value === 'package') {
        return getFeaturesByIds(selectedPackage.value?.featureIds || []);
      }
      if (quoteMode.value === 'supplement') {
        const featureIds = [...(selectedPackage.value?.featureIds || []), ...supplementFeatures.value];
        return getFeaturesByIds(featureIds);
      }
      return getFeaturesByIds(customFeatures.value);
    }

    function calculateDisplayedFeatureSectionTotal(featureIds) {
      if (!Array.isArray(featureIds) || featureIds.length === 0) return 0;
      return roundMoney(featureIds.reduce((sum, featureId) => sum + getFeatureTotalPrice(featureId), 0));
    }
    
    // 计算维保服务价格（标准维保服务的特殊计算逻辑）
    function calculateMaintenancePrice(features, hardwareTotal, endpoints, overrideMap = featurePointOverrides) {
      const maintenanceFeature = features.find(f => f.id === STANDARD_MAINTENANCE_FEATURE_ID);
      if (!maintenanceFeature) return 0;

      const nonMaintenanceFeatures = features.filter(f => !isStandardMaintenanceFeature(f));
      const rateMap = getMaintenanceRateMap(maintenanceFeature);
      const featureOverrideMap = getMaintenanceFeatureOverrideMap(maintenanceFeature);
      const annualPrice = nonMaintenanceFeatures.reduce((sum, feat) => {
        if (!feat?.moduleId) return sum;
        const featureSubtotal = roundMoney(calcFeatureTotal([feat], endpoints, overrideMap).total || 0);
        if (!featureSubtotal) return sum;
        const overriddenRate = featureOverrideMap[feat.id];
        const rate = Number.isFinite(overriddenRate)
          ? overriddenRate
          : (Number.isFinite(rateMap[feat.moduleId]) ? rateMap[feat.moduleId] : DEFAULT_STANDARD_MAINTENANCE_RATE);
        return sum + featureSubtotal * rate / 100;
      }, 0);
      const months = getFeatureEffectiveEndpoints(STANDARD_MAINTENANCE_FEATURE_ID, endpoints, overrideMap);
      return roundMoney(annualPrice * months / DEFAULT_MAINTENANCE_MONTHS);
    }
    
    // 计算功能模块总价
    function calcFeatureTotal(features, endpoints, overrideMap = featurePointOverrides) {
      if (!features.length) return { total: 0, originalTotal: 0, discountAmount: 0 };
      let total = 0;
      let originalTotal = 0;  // 原价总计

      // 获取当前渠道分销层级
      const partnerId = store.user?.partnerId;
      const partner = store.partners?.find(p => p.id === partnerId);
      const partnerLevel = partner?.partnerLevel || 'none';

      features.forEach(feat => {
        const qty = getFeatureEffectiveEndpoints(feat.id, endpoints, overrideMap);
        if (qty <= 0) return;
        // 解析价格配置（含区域覆盖）
        const pc = resolveFeaturePriceConfig(feat);
        if (!pc) return;

        // 先计算原价（含区域阶梯覆盖）
        let originalPrice = 0;
        const tiersToUse = pc.tiers || feat.tiers;
        const fixedToUse = pc.priceFixed ?? feat.priceFixed;
        if (fixedToUse) {
          originalPrice = fixedToUse;
        } else if (tiersToUse && tiersToUse.length) {
          const tier = tiersToUse.find(t => qty >= t.min && qty <= t.max) || tiersToUse[0];
          if (tier) originalPrice = tier.price || 0;
        } else if (feat.unitPrice) {
          originalPrice = feat.unitPrice;
        }

        // 根据渠道分销层级选择价格（含区域覆盖）
        let priceToUse = null;
        let priceSource = '基础价格';

        if (partnerLevel === 'primary' && pc.priceForPrimary) {
          priceToUse = pc.priceForPrimary;
          priceSource = '一级渠道商价格' + (pc.priceSource !== '全国' ? `(${pc.priceSource})` : '');
        } else if (partnerLevel === 'secondary' && pc.priceForSecondary) {
          priceToUse = pc.priceForSecondary;
          priceSource = '二级渠道商价格' + (pc.priceSource !== '全国' ? `(${pc.priceSource})` : '');
        }

        // 计算实际价格
        let actualPrice = originalPrice;

        // 如果没有找到对应等级价格，使用基础价格
        if (!priceToUse) {
          if (fixedToUse) {
            actualPrice = fixedToUse;
          } else if (tiersToUse && tiersToUse.length) {
            const tier = tiersToUse.find(t => qty >= t.min && qty <= t.max) || tiersToUse[0];
            if (tier) {
              actualPrice = getDiscountedTierUnitPrice(feat, tier);
            }
          } else if (feat.unitPrice) {
            actualPrice = feat.unitPrice;
          }
        } else {
          // 使用渠道分销层级价格
          if (typeof priceToUse === 'number') {
            actualPrice = priceToUse;
            console.log(`[价格计算] ${feat.name} - 使用${priceSource}: ¥${priceToUse}/端点 × ${qty}端点 = ¥${priceToUse * qty}`);
          } else if (Array.isArray(priceToUse) && priceToUse.length > 0) {
            const tier = priceToUse.find(t => qty >= t.min && qty <= t.max) || priceToUse[0];
            if (tier) {
              actualPrice = getDiscountedTierUnitPrice(feat, tier);
              console.log(`[价格计算] ${feat.name} - 使用${priceSource}阶梯: ¥${actualPrice}/端点 × ${qty}端点 = ¥${actualPrice * qty}`);
            }
          }
        }

        total += actualPrice * qty;
        originalTotal += originalPrice * qty;
      });

      const discountAmount = originalTotal - total;

      console.log(`[价格计算汇总] 原价: ¥${originalTotal}, 折后价格: ¥${total}, 优惠金额: ¥${discountAmount}`);

      return {
        total: roundMoney(total),
        originalTotal: roundMoney(originalTotal),
        discountAmount: roundMoney(discountAmount)
      };
    }
    
    // 获取功能价格显示
    function getFeaturePriceDisplay(feat) {
      if (isStandardMaintenanceFeature(feat)) {
        return '按模块比例/月';
      }
      if (feat.priceFixed) {
        return fmt(feat.priceFixed) + '/套';
      }
      if (feat.unitPrice) {
        return fmt(feat.unitPrice) + '/端点';
      }
      return '面议';
    }
    
    // 获取功能价格（根据渠道分销层级计算折后价格）
    function getFeaturePrice(fid) {
      const feat = getFeatureById(fid);
      if (!feat) return 0;
      if (isStandardMaintenanceFeature(feat)) {
        const features = getCurrentQuoteFeatures();
        return roundMoney(calculateMaintenancePrice(features, hardwareTotal.value, form.endpoints, featurePointOverrides));
      }

      const qty = getFeatureEffectiveEndpoints(fid, form.endpoints, featurePointOverrides);
      const partner = getCurrentPartner() || {};
      const partnerLevel = partner.partnerLevel || 'none';
      const pc = resolveFeaturePriceConfig(feat);
      if (!pc) return 0;

      // 根据渠道分销层级选择价格（含区域覆盖）
      let priceToUse;
      let priceSource;

      if (partnerLevel === 'primary' && pc.priceForPrimary) {
        priceToUse = pc.priceForPrimary;
        priceSource = '一级渠道商';
      } else if (partnerLevel === 'secondary' && pc.priceForSecondary) {
        priceToUse = pc.priceForSecondary;
        priceSource = '二级渠道商';
      } else {
        priceToUse = pc.tiers || pc.priceFixed;
        priceSource = '基础';
      }

      // 固定价格
      if (pc.priceFixed !== null) {
        const actualPrice = typeof priceToUse === 'number' ? priceToUse : pc.priceFixed;
        return actualPrice;
      }

      // 阶梯价格
      const tiersToUse = pc.tiers || feat.tiers;
      if (tiersToUse && tiersToUse.length) {
        if (Array.isArray(priceToUse)) {
          const tier = priceToUse.find(t => qty >= t.min && qty <= t.max) || priceToUse[0];
          return tier ? (tier.price ?? getDiscountedTierUnitPrice(feat, tier)) : 0;
        } else {
          const tier = tiersToUse.find(t => qty >= t.min && qty <= t.max) || tiersToUse[0];
          return tier ? getDiscountedTierUnitPrice(feat, tier) : 0;
        }
      }

      if (feat.unitPrice) {
        return feat.unitPrice * qty;
      }

      return 0;
    }

    function getFeatureTotalPrice(fid) {
      const feat = getFeatureById(fid);
      if (!feat) return 0;
      if (isStandardMaintenanceFeature(feat)) {
        const features = getCurrentQuoteFeatures();
        return roundMoney(calculateMaintenancePrice(features, hardwareTotal.value, form.endpoints, featurePointOverrides));
      }
      return roundMoney(calcFeatureTotal([feat], form.endpoints, featurePointOverrides).total);
    }

    function getFeaturePoints(fid) {
      return getFeatureEffectiveEndpoints(fid, form.endpoints, featurePointOverrides);
    }

    function getFeaturePointInputValue(fid) {
      if (Object.prototype.hasOwnProperty.call(featurePointDrafts, fid)) {
        return featurePointDrafts[fid];
      }
      return getFeaturePoints(fid);
    }
    
    // 获取功能名称
    function getFeatureName(fid) {
      const feat = getFeatureById(fid);
      return feat?.name || fid;
    }
    
    // 获取硬件名称
    function getHardwareName(hid) {
      const hw = publishedHardware.value.find(h => h.id === hid);
      return hw?.name || hid;
    }
    
    // 获取硬件价格
    function getHardwarePrice(hid) {
      const hw = publishedHardware.value.find(h => h.id === hid);
      return hw?.priceFixed || 0;
    }
    
    // 获取可添加的功能（套餐内没有的）
    function getAvailableFeatures(catId) {
      if (!selectedPackage.value) return [];
      const pkgFeatureIds = new Set(selectedPackage.value.featureIds || []);
      const cat = productTree.value.find(c => c.id === catId);
      if (!cat) return [];
      const available = [];
      cat.modules?.forEach(mod => {
        mod.features?.forEach(feat => {
          if (!pkgFeatureIds.has(feat.id)) {
            available.push(feat);
          }
        });
      });
      return available;
    }
    
    // 切换模式
    function setMode(mode) {
      if (mode === 'supplement' && !selectedPackageId.value) return;
      quoteMode.value = mode;
      clearUnusedFeaturePointOverrides();
      recalcAll();
    }
    
    // 选择/取消套餐（点击已选中的套餐则取消）
    function selectPackage(pkg) {
      if (selectedPackageId.value === pkg.id) {
        // 再次点击已选中的套餐：取消选中
        selectedPackageId.value = '';
        supplementFeatures.value = [];
        quoteMode.value = 'package';
      } else {
        selectedPackageId.value = pkg.id;
        supplementFeatures.value = [];
        if (quoteMode.value !== 'supplement') {
          quoteMode.value = 'package';
        }
      }
      clearUnusedFeaturePointOverrides();
      recalcAll();
    }
    
    // 切换补充功能
    function toggleSupplementFeature(fid) {
      const idx = supplementFeatures.value.indexOf(fid);
      if (idx === -1) {
        supplementFeatures.value.push(fid);
      } else {
        supplementFeatures.value.splice(idx, 1);
      }
    }
    
    // 切换自定义功能
    function toggleCustomFeature(fid) {
      const idx = customFeatures.value.indexOf(fid);
      if (idx === -1) {
        customFeatures.value.push(fid);
      } else {
        customFeatures.value.splice(idx, 1);
      }
    }
    
    // 切换硬件
    function toggleHardware(hid) {
      const idx = selectedHardware.value.indexOf(hid);
      if (idx === -1) {
        selectedHardware.value.push(hid);
      } else {
        selectedHardware.value.splice(idx, 1);
      }
    }
    
    // 打开套餐详情弹窗
    function openPackageDetail(pkg) {
      packageDetail.value = pkg;
    }
    
    // 获取套餐在详情弹窗中的价格
    const packagePriceForDetail = computed(() => {
      if (!packageDetail.value) return '—';
      const features = allFeatures.value.filter(f =>
        (packageDetail.value.featureIds || []).includes(f.id)
      );
      const result = calcFeatureTotal(features, form.endpoints);
      return fmt(result.total);
    });
    
    // 获取功能的价格类型
    function getFeaturePriceType(fid) {
      const feat = allFeatures.value.find(f => f.id === fid);
      if (!feat) return '';
      if (isStandardMaintenanceFeature(feat)) return '按模块比例/月';
      if (feat.priceFixed) return '固定价格';
      if (feat.tiers && feat.tiers.length) return '阶梯报价';
      if (feat.unitPrice) return '×端点数';
      return '';
    }
    
    // 切换类别展开/收起
    function toggleCategoryExpand(catId) {
      if (expandedCategoryId.value === catId) {
        expandedCategoryId.value = '';
      } else {
        expandedCategoryId.value = catId;
      }
    }
    
    // 获取功能所属的大类ID
    function getFeatureCategoryId(fid) {
      const feat = getFeatureById(fid);
      return feat?.categoryId || '';
    }
    
    // 获取大类图标
    function getCategoryIcon(catId) {
      const cat = productTree.value.find(c => c.id === catId);
      return cat?.icon || '📁';
    }
    
    // 获取大类名称
    function getCategoryName(catId) {
      const cat = productTree.value.find(c => c.id === catId);
      return cat?.name || '';
    }
    
    // 获取大类的模块列表
    function getCategoryModules(catId) {
      const cat = productTree.value.find(c => c.id === catId);
      return cat?.modules || [];
    }
    
    // 重新计算
    function recalcAll() {
      clearUnusedFeaturePointOverrides();
      // Vue 响应式会自动更新 computed
    }
    
    // 汇总计算 - 计算原价、优惠金额、折后价格
    function calcPriceSummary() {
      let features = [];
      if (quoteMode.value === 'package' || quoteMode.value === 'supplement') {
        // 套餐功能
        if (selectedPackage.value) {
          features = features.concat(allFeatures.value.filter(f => 
            (selectedPackage.value.featureIds || []).includes(f.id)
          ));
        }
        // 补充功能
        features = features.concat(allFeatures.value.filter(f => 
          supplementFeatures.value.includes(f.id)
        ));
      } else {
        // 自定义功能
        features = allFeatures.value.filter(f => customFeatures.value.includes(f.id));
      }
      
      // 计算硬件总价
      const hardwareTotal = selectedHardware.value.reduce((sum, hid) => sum + getHardwarePrice(hid), 0);
      
      // 计算维保服务价格
      const maintenancePrice = calculateMaintenancePrice(features, hardwareTotal, form.endpoints, featurePointOverrides);
      
      // 计算其他功能价格（排除标准维保服务，但包括其他维保模块功能如原厂现场人工服务）
      const nonMaintenanceFeatures = features.filter(f => f.id !== 'FEAT-MOD-MAINTENANCE-01-01');
      const featureResult = calcFeatureTotal(nonMaintenanceFeatures, form.endpoints, featurePointOverrides);
      
      // 产品合计只包含软件/服务，不包含硬件。
      // 硬件在 grandTotal 中单独累加，且不参与折扣计算。
      const total = featureResult.total + maintenancePrice;
      const originalTotal = featureResult.originalTotal + maintenancePrice;
      const discountAmount = originalTotal - total;
      
      console.log(`[价格计算汇总] 原价: ¥${originalTotal}, 折后价格: ¥${total}, 优惠金额: ¥${discountAmount}, 维保服务价格: ¥${maintenancePrice}`);
      
      return {
        originalTotal: roundMoney(originalTotal),
        discountAmount: roundMoney(discountAmount),
        discountedTotal: roundMoney(total)
      };
    }
    
    const subTotal = computed(() => {
      return calcPriceSummary().discountedTotal;
    });
    
    const originalSubTotal = computed(() => {
      return calcPriceSummary().originalTotal;
    });
    
    const discountAmount = computed(() => {
      return calcPriceSummary().discountAmount;
    });
    
    const hardwareTotal = computed(() => {
      return selectedHardware.value.reduce((sum, hid) => sum + getHardwarePrice(hid), 0);
    });
    
    const grandTotal = computed(() => subTotal.value + hardwareTotal.value);
    
    const originalGrandTotal = computed(() => originalSubTotal.value + hardwareTotal.value);
    
    const canSave = computed(() => {
      if (!form.customer) return false;
      if (form.endpoints <= 0) return false;
      if (!isEdit && form.oppIds.length === 0) return false;
      if (quoteMode.value === 'package' && !selectedPackageId.value) return false;
      if (quoteMode.value === 'supplement' && !selectedPackageId.value) return false;
      if (quoteMode.value === 'custom' && !customFeatures.value.length) return false;
      return grandTotal.value > 0;
    });
    
    // 已审批报备
    const approvedRegs = computed(() => {
      let list = store.registrations.filter(r => r.status === 'approved');
      const partnerId = store.user?.partnerId;
      const isPartnerAdmin = store.user?.role === 'partner_admin';
      // 企业管理员（partner_admin）：看本企业的全部报备
      if (isPartnerAdmin && partnerId) {
        return list.filter(r => r.partnerId === partnerId);
      }
      // 普通员工：自己创建的 + 被指派给自己的
      if (isStaff.value) {
        return list.filter(r =>
          r.createdBy === userId.value ||
          r.owner === userId.value ||
          r.assignedStaffId === userId.value ||
          r.assignedStaffUserId === userId.value
        );
      }
      if (adminRegion.value) {
        return list.filter(r => r.region === adminRegion.value);
      }
      return list;
    });

    const customerSearch = ref('');
    const showCustomerDropdown = ref(false);
    const selectedReg = computed(() => {
      if (form.regId) {
        const byId = approvedRegs.value.find(r => r.id === form.regId);
        if (byId) return byId;
      }
      if (form.customer) {
        return approvedRegs.value.find(r => r.customer === form.customer) || null;
      }
      return null;
    });
    const filteredRegs = computed(() => {
      const kw = customerSearch.value.trim().toLowerCase();
      if (!kw) return approvedRegs.value;
      return approvedRegs.value.filter(r => {
        const customer = (r.customer || '').toLowerCase();
        const contact = (r.contact || '').toLowerCase();
        const phone = String(r.phone || '').toLowerCase();
        const regId = String(r.id || '').toLowerCase();
        return customer.includes(kw) || contact.includes(kw) || phone.includes(kw) || regId.includes(kw);
      });
    });
    
    // 关联商机
    const relatedOpportunities = computed(() => {
      if (!form.customer) return [];
      let list = store.opportunities.filter(o => o.customer === form.customer && !['won','lost'].includes(o.stage));
      const partnerId = store.user?.partnerId;
      const isPartnerAdmin = store.user?.role === 'partner_admin';
      // 企业管理员（partner_admin）：看本企业的全部商机
      if (isPartnerAdmin && partnerId) {
        return list.filter(o => o.partnerId === partnerId);
      }
      // 普通员工：看自己创建的 + 被指派给自己的 + 自己是负责人的
      if (isStaff.value) {
        list = list.filter(o =>
          o.ownerId === userId.value ||
          o.assignedStaffId === userId.value ||
          o.assignedStaffUserId === userId.value ||
          o.createdBy === userId.value
        );
      }
      return list;
    });
    
    // 编辑模式下当前报价单关联的商机（兼容旧数据）
    const currentOpp = computed(() => {
      if (!isEdit || !form.oppIds.length) return null;
      return store.opportunities.find(o => o.id === form.oppIds[0]) || null;
    });
    
    // 选中的商机列表
    const selectedOpps = computed(() => {
      return store.opportunities.filter(o => form.oppIds.includes(o.id));
    });
    
    function onCustomerChange() {
      form.oppIds = [];
    }

    function openCustomerDropdown() {
      if (isEdit) return;
      showCustomerDropdown.value = true;
    }

    function onCustomerBlur() {
      setTimeout(() => { showCustomerDropdown.value = false; }, 200);
    }

    function selectReg(reg) {
      form.customer = reg.customer;
      form.regId = reg.id;
      onCustomerChange();
      customerSearch.value = '';
      showCustomerDropdown.value = false;
    }

    function clearRegSelection() {
      if (isEdit) return;
      form.customer = '';
      form.regId = '';
      onCustomerChange();
      customerSearch.value = '';
      showCustomerDropdown.value = false;
    }
    
    // 跳转创建商机（带客户名参数）
    function goToCreateOpp() {
      router.push('/opportunity/new?customer=' + encodeURIComponent(form.customer));
    }
    
    // 切换商机选择状态
    function toggleOppSelection(oppId) {
      const idx = form.oppIds.indexOf(oppId);
      if (idx >= 0) {
        form.oppIds.splice(idx, 1);
      } else {
        form.oppIds.push(oppId);
      }
    }
    
    // 商机阶段颜色（报价组件内使用）
    function stageColor(stage) {
      const colors = {
        prospecting: '#1677ff', qualification: '#52c41a', proposal: '#faad14',
        negotiation: '#eb2f96', closing: '#722ed1', won: '#52c41a', lost: '#ff4d4f'
      };
      return colors[stage] || '#888';
    }
    
    const selectedQuoteProductIds = computed(() => {
      if (quoteMode.value === 'package') {
        return [...(selectedPackage.value?.featureIds || [])];
      } else if (quoteMode.value === 'supplement') {
        return [...(selectedPackage.value?.featureIds || []), ...supplementFeatures.value];
      }
      return [...customFeatures.value];
    });

    function findMatchingPackageId(productIds = []) {
      const normalizedIds = Array.from(new Set((productIds || []).filter(Boolean)));
      if (!normalizedIds.length) return '';
      const exactPackage = publishedPackages.value.find(pkg => {
        const pkgFeatureIds = Array.isArray(pkg?.featureIds) ? pkg.featureIds : [];
        return pkgFeatureIds.length === normalizedIds.length && pkgFeatureIds.every(fid => normalizedIds.includes(fid));
      });
      if (exactPackage) return exactPackage.id;
      const bestPackage = publishedPackages.value
        .filter(pkg => {
          const pkgFeatureIds = Array.isArray(pkg?.featureIds) ? pkg.featureIds : [];
          return pkgFeatureIds.length > 0 && pkgFeatureIds.every(fid => normalizedIds.includes(fid));
        })
        .sort((a, b) => (b.featureIds?.length || 0) - (a.featureIds?.length || 0))[0];
      return bestPackage?.id || '';
    }

    async function ensureEditQuoteLoaded() {
      let quote = store.quotes.find(q => q.id === editId);
      if (quote) return quote;
      if (!apiClient.getQuotes) return null;
      try {
        const result = await apiClient.getQuotes();
        if (result.success && Array.isArray(result.data)) {
          store.quotes = result.data.map(item => ({ ...item }));
          quote = store.quotes.find(q => q.id === editId);
        }
      } catch (err) {
        console.error('加载编辑报价单失败:', err);
      }
      return quote || null;
    }

    function applyEditingQuote(quote) {
      form.customer = quote.customer || '';
      form.regId = quote.regId || '';
      if (quote.oppIds && Array.isArray(quote.oppIds)) {
        form.oppIds = [...quote.oppIds];
      } else if (quote.oppId) {
        form.oppIds = [quote.oppId];
      } else {
        form.oppIds = [];
      }
      form.endpoints = quote.endpoints || 100;
      form.validDays = quote.validDays || 30;

      const allIds = Array.isArray(quote.products) ? [...quote.products] : [];
      let resolvedPackageId = quote.packageId || '';
      if ((!resolvedPackageId || !publishedPackages.value.some(pkg => pkg.id === resolvedPackageId)) && allIds.length) {
        resolvedPackageId = findMatchingPackageId(allIds);
      }
      let resolvedMode = quote.quoteMode || '';
      if (!resolvedMode) {
        if (resolvedPackageId) {
          const matchedPackage = publishedPackages.value.find(pkg => pkg.id === resolvedPackageId);
          const matchedFeatureIds = Array.isArray(matchedPackage?.featureIds) ? matchedPackage.featureIds : [];
          resolvedMode = matchedFeatureIds.length && allIds.length > matchedFeatureIds.length ? 'supplement' : 'package';
        } else {
          resolvedMode = 'custom';
        }
      }

      quoteMode.value = resolvedMode;
      selectedPackageId.value = resolvedPackageId;
      supplementFeatures.value = [];
      customFeatures.value = [];
      selectedHardware.value = [];
      applyFeaturePointOverrides(quote.featurePointOverrides);

      if (allIds.length) {
        if (resolvedMode === 'supplement' && resolvedPackageId) {
          const pkg = publishedPackages.value.find(p => p.id === resolvedPackageId);
          if (pkg?.featureIds?.length) {
            supplementFeatures.value = allIds.filter(id => !pkg.featureIds.includes(id));
          } else {
            supplementFeatures.value = [...allIds];
          }
        } else if (resolvedMode === 'custom' || !resolvedPackageId) {
          customFeatures.value = [...allIds];
        }
      }
      if (quote.hardwareIds?.length) {
        selectedHardware.value = [...quote.hardwareIds];
      }
      hasSensitiveKeywordWorkload.value = false;
    }
    
    async function refreshWorkloadPreview() {
      if (!form.endpoints || form.endpoints <= 0) {
        workloadPreview.value = null;
        return;
      }
      if ((quoteMode.value === 'package' || quoteMode.value === 'supplement') && !selectedPackageId.value) {
        workloadPreview.value = null;
        return;
      }
      if (quoteMode.value === 'custom' && !customFeatures.value.length) {
        workloadPreview.value = null;
        return;
      }
      workloadLoading.value = true;
      try {
        const result = await apiClient.previewQuoteWorkload({
          products: selectedQuoteProductIds.value,
          hardwareIds: [...selectedHardware.value],
          endpoints: form.endpoints,
          featurePointOverrides: { ...featurePointOverrides },
          hasSensitiveKeywordWorkload: false
        });
        if (result.success) {
          workloadPreview.value = result.data || null;
        }
      } catch (err) {
        console.error('加载标准工作量建议失败:', err);
      } finally {
        workloadLoading.value = false;
      }
    }

    async function refreshIpgQuotePreview() {
      const requestSeq = ++ipgQuoteRequestSeq;
      ipgQuoteError.value = '';
      if (!form.endpoints || form.endpoints <= 0 || !selectedQuoteProductIds.value.length || grandTotal.value <= 0) {
        ipgQuotePreview.value = null;
        ipgQuoteLoading.value = false;
        return;
      }
      ipgQuoteLoading.value = true;
      try {
        const result = await apiClient.previewIpgQuote({
          featureIds: selectedQuoteProductIds.value,
          hardwareIds: [...selectedHardware.value],
          endpoints: form.endpoints,
          lianruanTotal: grandTotal.value,
          projectParams: {
            ipgEncryptionMode: 'encrypt'
          }
        });
        if (requestSeq !== ipgQuoteRequestSeq) return;
        if (result.success) {
          ipgQuotePreview.value = result.data || null;
        } else {
          throw new Error(result.error || 'IPG参考价计算失败');
        }
      } catch (err) {
        if (requestSeq !== ipgQuoteRequestSeq) return;
        console.error('加载IPG参考价失败:', err);
        ipgQuotePreview.value = null;
        ipgQuoteError.value = 'IPG参考价暂时无法计算';
      } finally {
        if (requestSeq === ipgQuoteRequestSeq) {
          ipgQuoteLoading.value = false;
        }
      }
    }
    
    // 保存报价单
    async function saveQuote() {
      const reg = store.registrations.find(r => r.customer === form.customer && r.status === 'approved');
      
      // 构建产品列表
      let productIds = [];
      if (quoteMode.value === 'package') {
        productIds = [...(selectedPackage.value?.featureIds || [])];
      } else if (quoteMode.value === 'supplement') {
        productIds = [...(selectedPackage.value?.featureIds || []), ...supplementFeatures.value];
      } else {
        productIds = [...customFeatures.value];
      }
      
      // 添加硬件ID
      const hardwareIds = [...selectedHardware.value];
      const payloadFeaturePointOverrides = { ...featurePointOverrides };
      
      try {
        if (isEdit) {
          const result = await apiClient.updateQuote(editId, {
            customer: form.customer,
            regId: reg ? reg.id : form.regId,
            oppIds: form.oppIds,
            oppId: form.oppIds[0] || null,
            endpoints: form.endpoints,
            products: productIds,
            hardwareIds,
            quoteMode: quoteMode.value,
            packageId: selectedPackageId.value,
            featurePointOverrides: payloadFeaturePointOverrides,
            hasSensitiveKeywordWorkload: effectiveSensitiveKeywordWorkload.value,
            total: grandTotal.value,
            originalTotal: originalGrandTotal.value,
            discountAmount: discountAmount.value,
            validDays: form.validDays
          });
          if (result.success) {
            const idx = store.quotes.findIndex(q => q.id === editId);
            if (idx !== -1) {
              store.quotes[idx] = { ...store.quotes[idx], ...result.data };
            }
            alert('报价单已更新！');
            router.push('/quote');
          } else {
            alert('更新失败：' + (result.error || '未知错误'));
          }
          return;
        }

        if (replaceId) {
          const relatedOrder = store.orders.find(o => o.quoteId === replaceId);
          if (relatedOrder) {
            await apiClient.deleteOrder(relatedOrder.id);
            const orderIdx = store.orders.findIndex(o => o.id === relatedOrder.id);
            if (orderIdx !== -1) store.orders.splice(orderIdx, 1);
          }
          await apiClient.deleteQuote(replaceId);
          const idx = store.quotes.findIndex(q => q.id === replaceId);
          if (idx !== -1) store.quotes.splice(idx, 1);
        }
        
        const result = await apiClient.createQuote({
          customer: form.customer,
          regId: reg ? reg.id : form.regId,
          oppIds: form.oppIds,
          oppId: form.oppIds[0] || null,
          endpoints: form.endpoints,
          products: productIds,
          hardwareIds: hardwareIds,
          quoteMode: quoteMode.value,
            packageId: selectedPackageId.value,
            featurePointOverrides: payloadFeaturePointOverrides,
            hasSensitiveKeywordWorkload: effectiveSensitiveKeywordWorkload.value,
            total: grandTotal.value,
            originalTotal: originalGrandTotal.value,
          discountAmount: discountAmount.value,
          validDays: form.validDays,
          ownerId: userId.value,
          createdBy: store.user.id,
          assignedStaffId: store.user.id,
        });
        
        if (result.success) {
          store.quotes.unshift(result.data);
          // 更新所有关联商机
          if (form.oppIds && form.oppIds.length) {
            form.oppIds.forEach(oppId => {
              const opp = store.opportunities.find(o => o.id === oppId);
              if (opp) {
                opp.quoteId = result.data.id;
                if (opp.stage === 'qualification') opp.stage = 'proposal';
              }
            });
          }
          alert(replaceId ? '报价单已重新生成！' : '报价单已生成！');
          router.push('/quote');
        } else {
          alert('创建失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        console.error('创建报价单失败:', err);
        alert('创建失败，请检查网络连接');
      }
    }
    
    // 初始化
    onMounted(async () => {
      // 加载产品目录
      await loadProductCatalog();

      if (isEdit) {
        const quote = await ensureEditQuoteLoaded();
        if (quote) {
          applyEditingQuote(quote);
        } else {
          alert('未找到要编辑的报价单，请刷新列表后重试');
          router.push('/quote');
          return;
        }
      }
      
      // 加载报备列表
      if (apiClient.getRegistrations) {
        try {
          const result = await apiClient.getRegistrations();
          if (result.success && result.data?.length) {
            store.registrations = result.data;
          }
        } catch (e) {
          console.error('加载报备列表失败:', e);
        }
      }
      
      // 加载商机列表（用于显示关联商机信息）
      if (apiClient.getOpportunities) {
        try {
          const result = await apiClient.getOpportunities();
          if (result.success && result.data?.length) {
            // 合并数据，保留已有引用
            const existingMap = new Map(store.opportunities.map(o => [o.id, o]));
            result.data.forEach(opp => {
              if (existingMap.has(opp.id)) {
                Object.assign(existingMap.get(opp.id), opp);
              } else {
                store.opportunities.push(opp);
              }
            });
          }
        } catch (e) {
          console.error('加载商机列表失败:', e);
        }
      }
      
      // 检查快速报价
      try {
        const pkgData = sessionStorage.getItem('quick_quote_package');
        if (pkgData) {
          const pkg = JSON.parse(pkgData);
          quickQuoteMsg.value = `您选择了套餐「${pkg.name}」，请确认客户信息`;
          sessionStorage.removeItem('quick_quote_package');
          // 自动选中套餐
          if (publishedPackages.value.find(p => p.id === pkg.id)) {
            selectPackage(pkg);
          }
        }
      } catch (e) {
        console.error('解析快速报价数据失败:', e);
      }
      await refreshWorkloadPreview();
      await refreshIpgQuotePreview();
    });
    
    watch([
      quoteMode,
      selectedPackageId,
      supplementFeatures,
      customFeatures,
      selectedHardware,
      featurePointOverrides,
      () => form.endpoints,
      () => grandTotal.value
    ], () => {
      clearUnusedFeaturePointOverrides();
      refreshWorkloadPreview();
      refreshIpgQuotePreview();
    }, { deep: true });
    
    return {
      form, quoteMode, publishedPackages, publishedHardware, categories, loadingPackages,
      selectedPackageId, selectedPackage, supplementFeatures, customFeatures, selectedHardware,
      approvedRegs, relatedOpportunities, selectedReg, customerSearch, showCustomerDropdown, filteredRegs, subTotal, hardwareTotal, grandTotal, canSave,
      originalSubTotal, discountAmount, originalGrandTotal,
      ipgQuotePreview, ipgQuoteLoading, ipgQuoteError,
      setMode, selectPackage, toggleSupplementFeature, toggleCustomFeature, toggleHardware,
      getFeatureName, getFeaturePrice, getFeatureTotalPrice, getFeaturePoints, getFeaturePointInputValue, startFeaturePointEditing, updateFeaturePointDraft, commitFeaturePointOverride, setFeaturePointOverride, getFeaturePriceDisplay, getFeatureQuantityUnit, getHardwareName, getHardwarePrice,
      getAvailableFeatures, supplementCategories, packagePrice, recalcAll,
      onCustomerChange, openCustomerDropdown, onCustomerBlur, selectReg, clearRegSelection, saveQuote, fmt, quickQuoteMsg, stageLabel,
      hasSensitiveKeywordWorkload, workloadPreview, workloadLoading, effectiveSensitiveKeywordWorkload,
      // 新增的展开状态和方法
      expandedCategoryId, summaryPackageExpanded, packageDetail,
      openPackageDetail, getFeaturePriceType, packagePriceForDetail,
      toggleCategoryExpand,
      getFeatureCategoryId, getCategoryIcon, getCategoryName, getCategoryModules,
      // 创建商机跳转
      goToCreateOpp,
      // 商机选择
      toggleOppSelection, selectedOpps, stageColor,
      // 编辑模式
      isEdit, currentOpp,
    };
  }
};

// ── 订单管理 ─────────────────────────────────────────────────
const OrderList = {
  template: `
  <div>
    <div class="search-bar">
      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input class="form-control" v-model="kw" placeholder="搜索客户、订单号..."/>
      </div>
      <select class="form-control" v-model="filterStatus" style="width:150px">
        <option value="">全部状态</option>
        <option value="pending">待确认</option>
        <option value="primary_confirmed">一级已确认</option>
        <option value="primary_rejected">已驳回</option>
        <option value="processing">处理中</option>
        <option value="shipped">已发货</option>
        <option value="completed">已完成</option>
        <option value="cancelled">已取消</option>
      </select>
      <button class="btn btn-default btn-sm" @click="refreshOrders" :disabled="loading">
        <span v-if="loading">⏳</span><span v-else>🔄</span> 刷新
      </button>
    </div>

    <!-- 一级渠道商提示条：当有待确认的二级订单时显示 -->
    <div v-if="isPrimaryPartner && pendingSecondaryOrders.length > 0" style="background:#e6f7ff;border:1px solid #91d5ff;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
      <span style="font-size:18px">📋</span>
      <span style="font-size:14px;color:#0050b3">您有 <strong>{{ pendingSecondaryOrders.length }}</strong> 个来自下属二级渠道商的订单待确认</span>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>订单编号</th><th>关联报价</th><th>客户</th><th>金额</th><th>状态</th><th>下单日期</th><th>负责人</th><th>收货地址</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="o in filtered" :key="o.id" @click="view(o)" style="cursor:pointer">
              <td style="font-family:monospace;font-size:12px;color:#888">{{ o.id }}</td>
              <td style="font-size:12px;color:#1677ff">{{ o.quoteId }}</td>
              <td style="font-weight:600">{{ o.customer }}</td>
              <td style="font-weight:700;color:#1677ff">{{ fmt(o.total) }}</td>
              <td><span class="tag" :class="oClass(o.status)">{{ oLabel(o.status) }}</span></td>
              <td style="font-size:12px;color:#888">{{ o.createdAt }}</td>
              <td><span class="tag tag-gray" style="font-size:11px">{{ o.assignedStaffName || o.createdByName || '—' }}</span></td>
              <td style="font-size:12px;color:#888;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ o.deliveryAddr }}</td>
              <td @click.stop>
                <!-- 一级渠道商：对待确认的二级订单显示确认/驳回按钮 -->
                <template v-if="isPrimaryPartner && o.status === 'pending' && isSecondarySubOrder(o)">
                  <button class="btn btn-primary btn-sm" style="margin-right:4px" @click.stop="openConfirmModal(o)">✅ 确认</button>
                  <button class="btn btn-danger btn-sm" @click.stop="openRejectModal(o)">❌ 驳回</button>
                </template>
              </td>
            </tr>
            <tr v-if="!filtered.length"><td colspan="9"><div class="empty-state"><div class="empty-icon">📦</div><p>暂无订单记录</p></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 一级确认弹窗 -->
    <div class="modal-overlay" v-if="showConfirmModal" @click.self="showConfirmModal=false">
      <div class="modal" style="max-width:440px">
        <div class="modal-header">
          <div class="modal-title">✅ 确认订单</div>
          <span class="modal-close" @click="showConfirmModal=false">✕</span>
        </div>
        <div class="modal-body">
          <div style="font-size:14px;color:#333;margin-bottom:12px">
            确认接受来自 <strong>{{ confirmTargetOrder && confirmTargetOrder.partnerName }}</strong> 的订单<br/>
            <span style="color:#1677ff;font-size:13px">{{ confirmTargetOrder && confirmTargetOrder.id }}</span>
          </div>
          <div class="form-item">
            <label class="form-label">备注（选填）</label>
            <textarea class="form-control" v-model="confirmRemark" rows="2" placeholder="如有备注，请填写..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showConfirmModal=false">取消</button>
          <button class="btn btn-primary" @click="doPrimaryConfirm" :disabled="confirmLoading">
            {{ confirmLoading ? '提交中...' : '确认接受' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 一级驳回弹窗 -->
    <div class="modal-overlay" v-if="showRejectModal" @click.self="showRejectModal=false">
      <div class="modal" style="max-width:440px">
        <div class="modal-header">
          <div class="modal-title">❌ 驳回订单</div>
          <span class="modal-close" @click="showRejectModal=false">✕</span>
        </div>
        <div class="modal-body">
          <div style="font-size:14px;color:#333;margin-bottom:12px">
            驳回来自 <strong>{{ rejectTargetOrder && rejectTargetOrder.partnerName }}</strong> 的订单
          </div>
          <div class="form-item">
            <label class="form-label">驳回原因 <span style="color:#ff4d4f">*</span></label>
            <textarea class="form-control" v-model="rejectRemark" rows="2" placeholder="请填写驳回原因..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showRejectModal=false">取消</button>
          <button class="btn btn-danger" @click="doPrimaryReject" :disabled="confirmLoading">
            {{ confirmLoading ? '提交中...' : '确认驳回' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 订单详情 -->
    <div class="modal-overlay" v-if="detail" @click.self="detail=null">
      <div class="modal modal-lg">
        <div class="modal-header">
          <div class="modal-title">订单详情 — {{ detail.id }}</div>
          <span class="modal-close" @click="detail=null">✕</span>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-item"><label class="form-label">客户名称</label><div style="padding:8px 0;font-weight:600">{{ detail.customer }}</div></div>
            <div class="form-item"><label class="form-label">关联报价单</label><div style="padding:8px 0;color:#1677ff">{{ detail.quoteId }}</div></div>
            <div class="form-item"><label class="form-label">订单金额</label><div style="padding:8px 0;font-weight:700;color:#1677ff;font-size:18px">{{ fmt(detail.total) }}</div></div>
            <div class="form-item"><label class="form-label">当前状态</label><div style="padding:8px 0"><span class="tag" :class="oClass(detail.status)">{{ oLabel(detail.status) }}</span></div></div>
            <div class="form-item full"><label class="form-label">收货地址</label><div style="padding:8px 0">{{ detail.deliveryAddr }}</div></div>
            <div class="form-item full"><label class="form-label">联系人</label><div style="padding:8px 0">{{ detail.contacts }}</div></div>
          </div>
          <div style="margin-top:20px">
            <div style="font-size:13px;font-weight:700;margin-bottom:14px">订单进度</div>
            <div class="timeline">
              <div class="timeline-item">
                <div class="timeline-dot-wrap"><div class="timeline-dot" :class="{active:true}"></div><div class="timeline-line"></div></div>
                <div class="timeline-content"><div class="tl-title">订单已创建</div><div class="tl-time">{{ detail.createdAt }}</div></div>
              </div>
              <!-- 二级渠道商订单专有：一级确认步骤 -->
              <div class="timeline-item" v-if="detail.partnerId && isSecondarySubOrder(detail)"
                   :class="{active:['primary_confirmed','processing','shipped','completed'].includes(detail.status)}">
                <div class="timeline-dot-wrap">
                  <div class="timeline-dot" :class="{active:['primary_confirmed','processing','shipped','completed'].includes(detail.status), 'danger-dot': detail.status==='primary_rejected'}"></div>
                  <div class="timeline-line"></div>
                </div>
                <div class="timeline-content">
                  <div class="tl-title" :style="{color: detail.status==='primary_rejected' ? 'var(--danger)' : ''}">
                    {{ detail.status === 'primary_rejected' ? '一级渠道商已驳回' : '一级渠道商确认' }}
                  </div>
                  <div class="tl-desc" v-if="detail.primaryConfirmedByName">
                    确认人：{{ detail.primaryConfirmedByName }}
                  </div>
                  <div class="tl-desc" v-else-if="detail.status === 'pending'">等待一级渠道商确认...</div>
                </div>
              </div>
              <div class="timeline-item" :class="{active:['processing','shipped','completed'].includes(detail.status)}">
                <div class="timeline-dot-wrap"><div class="timeline-dot" :class="{active:['processing','shipped','completed'].includes(detail.status)}"></div><div class="timeline-line"></div></div>
                <div class="timeline-content">
                  <div class="tl-title">厂商确认处理中</div>
                  <div class="tl-desc" v-if="detail.lastOperatorName && ['processing','shipped','completed'].includes(detail.status)">
                    确认人：{{ detail.lastOperatorName }}
                  </div>
                  <div class="tl-desc" v-else-if="['pending','primary_confirmed'].includes(detail.status)">等待厂商确认...</div>
                </div>
              </div>
              <div class="timeline-item" :class="{active:['shipped','completed'].includes(detail.status)}">
                <div class="timeline-dot-wrap"><div class="timeline-dot" :class="{active:['shipped','completed'].includes(detail.status)}"></div><div class="timeline-line"></div></div>
                <div class="timeline-content">
                  <div class="tl-title">已发货 / License 已下发</div>
                  <div class="tl-time" v-if="getShippedTime()">{{ getShippedTime() }}</div>
                  <div class="tl-desc" v-else-if="['processing','pending','primary_confirmed'].includes(detail.status)">等待发货...</div>
                </div>
              </div>
              <div class="timeline-item" :class="{active:detail.status==='completed'}">
                <div class="timeline-dot-wrap"><div class="timeline-dot" :class="{active:detail.status==='completed'}" style="background:var(--success)"></div></div>
                <div class="timeline-content"><div class="tl-title" :style="{color:detail.status==='completed'?'var(--success)':'#bbb'}">订单完成</div></div>
              </div>
              <div class="timeline-item" v-if="detail.status==='cancelled'">
                <div class="timeline-dot-wrap"><div class="timeline-dot" style="background:var(--danger)"></div></div>
                <div class="timeline-content"><div class="tl-title" style="color:var(--danger)">订单已取消</div></div>
              </div>
            </div>
          </div>
          <!-- 状态变更历史（合作伙伴可查看） -->
          <div v-if="detail.statusHistory && detail.statusHistory.length > 0" style="margin-top:24px;padding-top:20px;border-top:1px solid #eee">
            <div style="font-size:13px;font-weight:700;margin-bottom:14px">订单处理记录</div>
            <div style="font-size:12px;color:#666">
              <div v-for="(h, idx) in detail.statusHistory.slice().reverse()" :key="idx" style="margin-bottom:8px;padding:8px;background:#f5f5f5;border-radius:4px">
                <span style="color:#999">{{ formatTime(h.timestamp) }}</span> 
                <span style="margin-left:8px;font-weight:600">{{ h.operatorName }}</span>
                <span style="margin-left:8px" :class="{'text-success':h.to==='completed','text-danger':h.to==='cancelled'||h.to==='primary_rejected'}">
                  {{ h.to==='primary_confirmed' ? '（一级渠道商）确认了订单' :
                     h.to==='primary_rejected' ? '（一级渠道商）驳回了订单' :
                     h.from==='pending' && h.to==='processing' ? '确认了订单' : 
                     h.from==='primary_confirmed' && h.to==='processing' ? '（厂商）确认处理' :
                     h.from==='processing' && h.to==='shipped' ? '确认已发货' :
                     h.from==='shipped' && h.to==='completed' ? '完成了订单' :
                     h.to==='cancelled' ? '取消了订单' : '修改了状态' }}
                </span>
                <span v-if="h.remark" style="margin-left:8px;color:#888">({{ h.remark }})</span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <!-- 一级渠道商在详情弹窗中也可以确认/驳回 -->
          <template v-if="isPrimaryPartner && detail.status === 'pending' && isSecondarySubOrder(detail)">
            <button class="btn btn-danger" @click="openRejectModal(detail);detail=null">❌ 驳回</button>
            <button class="btn btn-primary" @click="openConfirmModal(detail);detail=null">✅ 确认接受</button>
          </template>
          <button class="btn btn-default" @click="detail=null">关闭</button>
        </div>
      </div>
    </div>
  </div>`,
  setup() {
    const kw = ref('');
    const filterStatus = ref('');
    const detail = ref(null);
    const loading = ref(false);
    
    // 员工隔离（统一使用 id 字段，与后端数据一致）
    const userId = computed(() => store.user?.id || '');
    const isStaff = computed(() => store.user?.role === 'staff' || store.user?.role === 'partner_admin');
    
    // 是否是一级渠道商（partner_admin 或 staff 属于一级渠道商企业）
    const isPrimaryPartner = computed(() => {
      const partnerId = store.user?.partnerId;
      if (!partnerId) return false;
      const partner = store.partners?.find(p => p.id === partnerId);
      return partner && partner.partnerLevel === 'primary';
    });
    
    // 判断某订单是否是当前一级渠道商的下属二级渠道商的订单（支持多个上级渠道商）
    function isSecondarySubOrder(order) {
      if (!order || !order.partnerId) return false;
      const myPartnerId = store.user?.partnerId;
      if (!myPartnerId) return false;
      
      // 【修复】优先使用订单自身的parentPartnerId字段（后端新增）
      if (order.parentPartnerId === myPartnerId) {
        return true;
      }
      
      // 兼容旧数据：通过store.partners查找（支持多个上级渠道商）
      const orderPartner = store.partners?.find(p => p.id === order.partnerId);
      if (!orderPartner) return false;
      
      // 检查是否为二级渠道商
      if (orderPartner.partnerLevel !== 'secondary') return false;
      
      // 优先检查 parentPartnerIds 数组
      const parentIds = orderPartner.parentPartnerIds || 
                       (orderPartner.parentPartnerId ? [orderPartner.parentPartnerId] : []);
      return parentIds.includes(myPartnerId);
    }
    
    // 一级渠道商待确认的下属二级订单
    const pendingSecondaryOrders = computed(() => {
      if (!isPrimaryPartner.value) return [];
      return store.orders.filter(o => o.status === 'pending' && isSecondarySubOrder(o));
    });
    
    // 确认/驳回弹窗状态
    const showConfirmModal = ref(false);
    const showRejectModal = ref(false);
    const confirmTargetOrder = ref(null);
    const rejectTargetOrder = ref(null);
    const confirmRemark = ref('');
    const rejectRemark = ref('');
    const confirmLoading = ref(false);
    
    function openConfirmModal(order) {
      confirmTargetOrder.value = order;
      confirmRemark.value = '';
      showConfirmModal.value = true;
    }
    function openRejectModal(order) {
      rejectTargetOrder.value = order;
      rejectRemark.value = '';
      showRejectModal.value = true;
    }
    
    // 一级渠道商确认订单
    async function doPrimaryConfirm() {
      const order = confirmTargetOrder.value;
      if (!order) return;
      confirmLoading.value = true;
      try {
        const res = await apiRequest('PUT', `/orders/${order.id}/primary-confirm`, {
          operatorId: store.user.id,
          operatorPartnerId: store.user.partnerId,
          operatorName: store.user.name || store.user.username,
          remark: confirmRemark.value
        });
        if (res.success) {
          // 更新本地订单状态
          const idx = store.orders.findIndex(o => o.id === order.id);
          if (idx !== -1) store.orders[idx] = { ...store.orders[idx], ...res.data };
          showConfirmModal.value = false;
          confirmTargetOrder.value = null;
          alert('已确认订单，等待区域管理员审批');
          await loadOrders();
        } else {
          alert('确认失败：' + (res.error || '未知错误'));
        }
      } catch(e) {
        alert('操作失败，请检查网络');
      } finally {
        confirmLoading.value = false;
      }
    }
    
    // 一级渠道商驳回订单
    async function doPrimaryReject() {
      const order = rejectTargetOrder.value;
      if (!order) return;
      if (!rejectRemark.value.trim()) { alert('请填写驳回原因'); return; }
      confirmLoading.value = true;
      try {
        const res = await apiRequest('PUT', `/orders/${order.id}/primary-reject`, {
          operatorId: store.user.id,
          operatorPartnerId: store.user.partnerId,
          operatorName: store.user.name || store.user.username,
          remark: rejectRemark.value
        });
        if (res.success) {
          const idx = store.orders.findIndex(o => o.id === order.id);
          if (idx !== -1) store.orders[idx] = { ...store.orders[idx], ...res.data };
          showRejectModal.value = false;
          rejectTargetOrder.value = null;
          alert('已驳回订单');
          await loadOrders();
        } else {
          alert('驳回失败：' + (res.error || '未知错误'));
        }
      } catch(e) {
        alert('操作失败，请检查网络');
      } finally {
        confirmLoading.value = false;
      }
    }
    
    // 加载订单列表
    async function loadOrders() {
      loading.value = true;
      try {
        const result = await apiClient.getOrders();
        if (result.success && result.data) {
          // 合并后端数据到本地 store，同时更新已有数据（状态可能已变更）
          const existingMap = new Map(store.orders.map(o => [o.id, o]));
          result.data.forEach(order => {
            if (existingMap.has(order.id)) {
              // 更新已有订单数据（状态可能已变更）
              const idx = store.orders.findIndex(o => o.id === order.id);
              if (idx !== -1) {
                store.orders[idx] = { ...store.orders[idx], ...order };
              }
            } else {
              store.orders.push(order);
            }
          });
        }
      } catch (err) {
        console.error('加载订单列表失败:', err);
      } finally {
        loading.value = false;
      }
    }
    
    // 刷新订单列表
    async function refreshOrders() {
      await loadOrders();
    }
    
    // 页面加载时获取订单列表
    onMounted(() => {
      loadOrders();
    });
    
    // 本人的订单（员工）
    const myOrders = computed(() => {
      const partnerId = store.user?.partnerId;
      const isPartnerAdmin = store.user?.role === 'partner_admin';
      // 企业管理员（partner_admin）：看本企业的全部订单
      if (isPartnerAdmin && partnerId) {
        // 一级渠道商的企业管理员：还能看到下属二级渠道商发来的待确认订单
        if (isPrimaryPartner.value) {
          return store.orders.filter(o =>
            o.partnerId === partnerId || // 自己的订单
            isSecondarySubOrder(o)       // 下属二级的订单
          );
        }
        return store.orders.filter(o => o.partnerId === partnerId);
      }
      // 普通员工：只能看到自己创建的订单（通过quoteId关联到报价单，再关联到ownerId）
      // 但对于一级渠道商的普通员工，还需要看到下属二级渠道商的待确认订单
      if (isStaff.value) {
        return store.orders.filter(o => {
          const quote = store.quotes.find(q => q.id === o.quoteId);
          // 自己创建的订单
          if (quote && quote.ownerId === userId.value) {
            return true;
          }
          // 一级渠道商的员工可以看到下属二级渠道商的订单（所有状态）
          if (isPrimaryPartner.value && isSecondarySubOrder(o)) {
            return true;
          }
          return false;
        });
      }
      return store.orders;
    });
    
    const filtered = computed(() => myOrders.value.filter(o => {
      const mK = !kw.value || o.customer.includes(kw.value) || o.id.includes(kw.value);
      const mS = !filterStatus.value || o.status === filterStatus.value;
      return mK && mS;
    }));
    
    function oClass(s) { return { pending:'tag-orange', primary_confirmed:'tag-blue', primary_rejected:'tag-red', processing:'tag-blue', shipped:'tag-purple', completed:'tag-green', cancelled:'tag-gray' }[s]||'tag-gray'; }
    function oLabel(s) { return { pending:'待确认', primary_confirmed:'一级已确认', primary_rejected:'已驳回', processing:'处理中', shipped:'已发货', completed:'已完成', cancelled:'已取消' }[s]||s; }
    function view(o) { detail.value = o; }
    
    // 获取发货时间
    function getShippedTime() {
      if (!detail.value || !detail.value.statusHistory) return '';
      const shipRecord = detail.value.statusHistory.find(h => h.to === 'shipped');
      return shipRecord ? formatTime(shipRecord.timestamp) : '';
    }
    
    // 格式化时间
    function formatTime(isoString) {
      if (!isoString) return '';
      const d = new Date(isoString);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }
    
    return { kw, filterStatus, isStaff, filtered, detail, loading, fmt, oClass, oLabel, view, loadOrders, refreshOrders, getShippedTime, formatTime,
      isPrimaryPartner, isSecondarySubOrder, pendingSecondaryOrders,
      showConfirmModal, showRejectModal, confirmTargetOrder, rejectTargetOrder,
      confirmRemark, rejectRemark, confirmLoading,
      openConfirmModal, openRejectModal, doPrimaryConfirm, doPrimaryReject };
  }
};

// ── 产品目录（新版三级产品架构，渠道商查看）───────────────────────
const Products = {
  template: `
  <div>
    <!-- 顶部导航标签 -->
    <div class="tab-nav" style="margin-bottom:20px">
      <div class="tab-item" :class="{active: currentTab === 'products'}" @click="switchTab('products')">
        💻 产品目录
      </div>
      <div class="tab-item" :class="{active: currentTab === 'packages'}" @click="switchTab('packages')">
        📦 推荐套餐
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" style="text-align:center;padding:60px;color:#999">
      <div style="font-size:24px">⏳</div>
      <div style="margin-top:10px">加载中...</div>
    </div>

    <!-- ===== 产品目录视图（弹窗层级式） ===== -->
    <div v-else-if="currentTab === 'products'">
      <!-- 页面标题 -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <h2 style="font-size:18px;font-weight:700;color:#1a1a1a">💻 产品目录</h2>
          <p style="font-size:13px;color:#888;margin-top:4px">点击查看产品详情与价格体系</p>
        </div>
      </div>

      <!-- 大类卡片网格 -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px">
        <div v-for="cat in categories" :key="cat.id" class="category-card" 
             @click="viewCategory(cat)" style="cursor:pointer">
          <div class="category-card-icon">{{ cat.icon }}</div>
          <div class="category-card-content">
            <div class="category-card-name">{{ cat.name }}</div>
            <div class="category-card-desc">{{ cat.desc || '暂无描述' }}</div>
            <div class="category-card-meta">
              <span class="tag" :class="cat.type === 'software' ? 'tag-blue' : 'tag-purple'">
                {{ cat.type === 'software' ? '软件' : '硬件' }}
              </span>
              <span class="tag tag-gray">{{ cat.moduleCount }} 模块</span>
              <span class="tag tag-gray">{{ cat.featureCount }} 功能</span>
            </div>
          </div>
          <div style="position:absolute;right:16px;bottom:16px;color:#007AFF;font-size:20px">→</div>
        </div>
      </div>

      <!-- 硬件产品独立展示 -->
      <div v-if="hardware.length > 0" style="margin-top:40px">
        <h3 style="font-size:16px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px">
          🖥️ 硬件产品
        </h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:16px">
          <div v-for="hw in hardware" :key="hw.id" class="feature-card" @click="viewHardware(hw)">
            <div style="display:flex;align-items:flex-start;gap:12px">
              <div class="module-icon">{{ hw.icon }}</div>
              <div style="flex:1">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <div>
                    <div style="font-weight:600;color:#1a1a1a">{{ hw.name }}</div>
                    <div style="font-size:12px;color:#888;margin-top:2px">{{ hw.model }}</div>
                  </div>
                </div>
                <div style="font-size:12px;color:#666;margin:8px 0;min-height:32px">{{ hw.desc }}</div>
                <div style="font-size:20px;font-weight:700;color:#f5222d">
                  ¥{{ hw.priceFixed?.toLocaleString() }}<span style="font-size:12px;font-weight:400;color:#888">/{{ hw.unit }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!categories.length && !hardware.length" class="empty-state">
        <div class="empty-icon">📦</div>
        <p>暂无产品数据</p>
        <p style="color:#999;font-size:12px;margin-top:8px">请联系管理员配置产品目录</p>
      </div>
    </div>

    <!-- ===== 推荐套餐视图 ===== -->
    <div v-else-if="currentTab === 'packages'">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <h2 style="font-size:18px;font-weight:700;color:#1a1a1a">📦 推荐套餐</h2>
          <p style="font-size:13px;color:#888;margin-top:4px">精选产品组合，一键获取方案报价</p>
        </div>
      </div>

      <!-- 套餐卡片 -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:20px">
        <div v-for="pkg in packages" :key="pkg.id" class="package-card" @click="viewPackage(pkg)">
          <div style="display:flex;align-items:flex-start;gap:16px">
            <div style="width:64px;height:64px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:32px;flex-shrink:0">
              {{ pkg.icon }}
            </div>
            <div style="flex:1">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div style="font-weight:700;font-size:16px;color:#1a1a1a">{{ pkg.name }}</div>
              </div>
              <div style="font-size:12px;color:#666;margin:8px 0;line-height:1.6">{{ pkg.desc }}</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                <span class="tag tag-blue">{{ pkg.moduleIds?.length || 0 }} 模块</span>
                <span class="tag tag-green">{{ pkg.featureIds?.length || 0 }} 功能</span>
                <span class="tag tag-purple">{{ pkg.hardwareIds?.length || 0 }} 硬件</span>
              </div>
            </div>
          </div>
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;color:#999">查看套餐详情 →</span>
            <button class="btn btn-primary btn-sm" @click.stop="quickQuotePackage(pkg)">快速报价</button>
          </div>
        </div>
      </div>

      <div v-if="!packages.length" class="empty-state">
        <div class="empty-icon">📦</div>
        <p>暂无推荐套餐</p>
      </div>
    </div>

    <!-- 产品模块列表弹窗（弹窗层级式第1层） -->
    <div v-if="showModulesModal" class="modal-overlay" @click.self="showModulesModal=false">
      <div class="modal modal-xl" style="width:900px">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px">
              {{ currentCategory?.icon }}
            </div>
            <div>
              <div class="modal-title">{{ currentCategory?.name }}</div>
              <div style="font-size:12px;color:#8c8c8c;margin-top:2px">产品模块 · 点击卡片查看功能详情</div>
            </div>
          </div>
          <button class="modal-close" @click="showModulesModal=false">×</button>
        </div>
        <div class="modal-body" style="max-height:70vh;overflow-y:auto">
          <div v-if="currentModules.length" class="module-card-grid">
            <div v-for="mod in currentModules" :key="mod.id" 
                 class="module-card-v"
                 :class="{selected: selectedModule?.id === mod.id}"
                 @click="viewModuleInModal(mod)">
              <div style="font-size:36px;margin-bottom:12px">{{ mod.icon }}</div>
              <div style="font-weight:700;font-size:15px;color:#1a1a1a;margin-bottom:6px;text-align:center;line-height:1.3">{{ mod.name }}</div>
              <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
                <span class="tag tag-blue">{{ mod.features?.length || 0 }} 功能</span>
              </div>
              <div v-if="mod.desc" style="font-size:12px;color:#888;margin-top:10px;text-align:center;line-height:1.4">{{ mod.desc }}</div>
              <div style="margin-top:12px;color:#007AFF;font-size:14px">查看 →</div>
            </div>
          </div>
          <div v-else style="text-align:center;padding:40px;color:#999">
            <div style="font-size:48px;margin-bottom:12px">📋</div>
            <div style="font-size:14px">该大类下暂无产品模块</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showModulesModal=false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 功能模块列表弹窗（弹窗层级式第2层） -->
    <div v-if="showFeaturesModal" class="modal-overlay" @click.self="closeFeaturesModal">
      <div class="modal modal-xl" style="width:1100px">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#1890ff,#722ed1);color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px">
              {{ selectedModule?.icon }}
            </div>
            <div>
              <div class="modal-title">{{ selectedModule?.name }}</div>
              <div style="font-size:12px;color:#8c8c8c;margin-top:2px">{{ currentCategory?.icon }} {{ currentCategory?.name }} · 功能模块</div>
            </div>
          </div>
          <button class="modal-close" @click="closeFeaturesModal">×</button>
        </div>
        <div class="modal-body" style="max-height:70vh;overflow-y:auto">
          <div v-if="currentFeatures.length" class="feature-card-grid">
            <div v-for="feat in currentFeatures" :key="feat.id" 
                 class="feature-card-h"
                 :class="{required: feat.required}">
              <div style="text-align:center;margin-bottom:12px">
                <div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:4px">{{ feat.name }}</div>
                <div style="display:flex;gap:6px;justify-content:center;margin-bottom:8px">
                  <span v-if="feat.required" class="tag tag-red">必选</span>
                  <span class="tag tag-gray">{{ feat.productCode }}</span>
                </div>
              </div>
              <div style="font-size:12px;color:#666;text-align:center;margin-bottom:10px;line-height:1.4;min-height:32px">{{ feat.desc }}</div>
              <div style="padding:10px;background:#f8f9fa;border-radius:8px;margin-bottom:10px">
                <div v-if="feat.priceType === 'fixed'" style="text-align:center">
                  <span style="font-size:20px;font-weight:700;color:#f5222d">¥{{ feat.priceFixed?.toLocaleString() }}</span>
                  <span style="font-size:11px;color:#888">/{{ feat.unit }}</span>
                </div>
                <div v-else>
                  <div style="text-align:center;margin-bottom:6px">
                    <span class="tag tag-blue">阶梯计价</span>
                    <span style="font-size:11px;color:#666;margin-left:4px">{{ feat.unit }}</span>
                  </div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center">
                    <span v-for="t in (feat.tiers || []).slice(0,3)" :key="t.min" 
                          style="background:#fff;border:1px solid #e8e8e8;padding:3px 8px;border-radius:4px;font-size:10px">
                      {{ t.min }}-{{ t.max }}端 ¥{{ t.price }}
                    </span>
                    <span v-if="(feat.tiers || []).length > 3" style="font-size:10px;color:#999">
                      +{{ feat.tiers.length - 3 }}档
                    </span>
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-outline btn-sm" @click="viewFeatureDetail(feat)" style="flex:1">详情</button>
                <button class="btn btn-primary btn-sm" @click="goToQuoteWithFeature(feat)" style="flex:1">报价</button>
              </div>
            </div>
          </div>
          <div v-else style="text-align:center;padding:40px;color:#999">
            <div style="font-size:48px;margin-bottom:12px">⚙️</div>
            <div style="font-size:14px">该模块下暂无功能模块</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showModulesModal=true">← 返回模块列表</button>
          <button class="btn btn-default" @click="closeFeaturesModal">关闭</button>
        </div>
      </div>
    </div>

    <!-- 功能模块详情弹窗 -->
    <div v-if="detailFeature" class="modal-overlay" @click.self="detailFeature=null">
      <div class="modal-content" style="max-width:560px">
        <div class="modal-header">
          <div class="modal-title">{{ detailFeature.name }}</div>
          <button class="modal-close" @click="detailFeature=null">×</button>
        </div>
        <div class="modal-body" style="max-height:65vh;overflow-y:auto">
          <!-- 面包屑和标签 -->
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">
            <span style="font-size:12px;color:#8c8c8c">{{ currentCategoryName }}</span>
            <span style="color:#d9d9d9">›</span>
            <span style="font-size:12px;color:#8c8c8c">{{ currentModuleName }}</span>
            <span v-if="detailFeature.required" style="background:#fff1f0;color:#cf1322;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:500">必选</span>
          </div>
          
          <!-- 功能描述 -->
          <div style="background:#f6ffed;border-radius:12px;padding:16px 20px;margin-bottom:16px;border-left:4px solid #52c41a">
            <div style="font-size:14px;color:#333;line-height:1.8">{{ detailFeature.desc }}</div>
          </div>
          
          <!-- 基本信息 -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
            <div style="background:#f8f9fa;border-radius:8px;padding:12px">
              <div style="font-size:11px;color:#8c8c8c;margin-bottom:4px">产品编号</div>
              <div style="font-size:13px;font-weight:500;color:#333">{{ detailFeature.productCode || '—' }}</div>
            </div>
            <div style="background:#f8f9fa;border-radius:8px;padding:12px">
              <div style="font-size:11px;color:#8c8c8c;margin-bottom:4px">计量单位</div>
              <div style="font-size:13px;font-weight:500;color:#333">{{ detailFeature.unit }}</div>
            </div>
          </div>
          
          <!-- 价格展示 -->
          <div style="margin-top:16px">
            <div style="font-size:14px;font-weight:600;margin-bottom:14px;display:flex;align-items:center;gap:6px">
              💰 价格体系
            </div>
            <div v-if="detailFeature.priceType === 'fixed'" 
                 style="background:#fff7e6;border-radius:14px;padding:24px;text-align:center;border:2px solid #ffd591;box-shadow:0 2px 8px rgba(250,84,28,0.1)">
              <div style="font-size:36px;font-weight:800;color:#fa541c">
                ¥{{ detailFeature.priceFixed?.toLocaleString() }}
              </div>
              <div style="font-size:14px;color:#8c8c8c;margin-top:6px">固定价格 / {{ detailFeature.unit }}</div>
            </div>
            <div v-else>
              <!-- 阶梯价格网格 -->
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px">
                <div v-for="(t, idx) in detailFeature.tiers" :key="t.min" 
                     style="background:#fff;border-radius:12px;padding:16px;text-align:center;border:2px solid"
                     :style="{borderColor: idx === 0 ? '#ff4d4f' : '#f0f0f0'}">
                  <div style="font-size:12px;color:#8c8c8c;margin-bottom:8px">{{ t.min }}-{{ t.max }} 端点</div>
                  <div style="font-size:22px;font-weight:700;color:#f5222d;margin-bottom:4px">¥{{ t.price }}</div>
                  <div style="font-size:11px;color:#bfbfbf">/{{ detailFeature.unit }}</div>
                  <div v-if="idx === 0" style="position:absolute;top:-8px;right:12px;background:#ff4d4f;color:#fff;font-size:10px;padding:2px 8px;border-radius:10px">
                    首选
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="detailFeature=null">关闭</button>
          <button class="btn btn-primary" @click="goToQuoteWithFeature(detailFeature)">制作报价单 →</button>
        </div>
      </div>
    </div>

    <!-- 套餐详情弹窗 -->
    <div v-if="detailPackage" class="modal-overlay" @click.self="detailPackage=null">
      <div class="modal-content" style="max-width:720px">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px">
              {{ detailPackage.icon }}
            </div>
            <div>
              <div class="modal-title">{{ detailPackage.name }}</div>
              <div style="font-size:12px;color:#8c8c8c;margin-top:2px">精选产品组合</div>
            </div>
          </div>
          <button class="modal-close" @click="detailPackage=null">×</button>
        </div>
        <div class="modal-body" style="max-height:65vh;overflow-y:auto">
          <!-- 套餐描述 -->
          <div style="background:#f0f5ff;border-radius:12px;padding:16px 20px;margin-bottom:20px;border:1px solid #d9e4ff">
            <div style="font-size:14px;color:#333;line-height:1.8">{{ detailPackage.desc || '暂无描述' }}</div>
          </div>
          
          <!-- 内容统计摘要 -->
          <div style="display:flex;gap:12px;margin-bottom:24px">
            <div v-if="detailPackage.moduleIds?.length" style="flex:1;background:#bae0ff;border-radius:10px;padding:14px;text-align:center;box-shadow:0 2px 8px rgba(24,144,255,0.15)">
              <div style="font-size:24px;font-weight:700;color:#1677ff">{{ detailPackage.moduleIds.length }}</div>
              <div style="font-size:12px;color:#333;margin-top:4px">📦 产品模块</div>
            </div>
            <div v-if="detailPackage.featureIds?.length" style="flex:1;background:#d9f7be;border-radius:10px;padding:14px;text-align:center;box-shadow:0 2px 8px rgba(82,196,26,0.15)">
              <div style="font-size:24px;font-weight:700;color:#389e0d">{{ detailPackage.featureIds.length }}</div>
              <div style="font-size:12px;color:#333;margin-top:4px">⚙️ 功能模块</div>
            </div>
            <div v-if="detailPackage.hardwareIds?.length" style="flex:1;background:#ffd591;border-radius:10px;padding:14px;text-align:center;box-shadow:0 2px 8px rgba(250,140,22,0.15)">
              <div style="font-size:24px;font-weight:700;color:#d46b08">{{ detailPackage.hardwareIds.length }}</div>
              <div style="font-size:12px;color:#333;margin-top:4px">🖥️ 硬件设备</div>
            </div>
          </div>
          
          <!-- 包含的模块 - 卡片网格 -->
          <div v-if="detailPackage.modules?.length" style="margin-bottom:24px">
            <div style="font-size:14px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px;color:#333">
              📦 产品模块
              <span style="font-size:12px;font-weight:400;color:#8c8c8c">({{ detailPackage.modules.length }}个)</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
              <div v-for="mod in detailPackage.modules" :key="mod.id" 
                   style="background:#e6f4ff;border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:10px;border:1px solid #91caff;transition:all 0.2s">
                <div style="font-size:20px">{{ mod.icon }}</div>
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:600;color:#1a1a1a">{{ mod.name }}</div>
                  <div style="font-size:11px;color:#8c8c8c;margin-top:2px">{{ mod.features?.length || 0 }} 个功能</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 包含的功能 - 表格列表 -->
          <div v-if="detailPackage.features?.length" style="margin-bottom:24px">
            <div style="font-size:14px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px;color:#333">
              ⚙️ 功能模块
              <span style="font-size:12px;font-weight:400;color:#8c8c8c">({{ detailPackage.features.length }}个)</span>
            </div>
            <div style="border:1px solid #e8e8e8;border-radius:10px;overflow:hidden">
              <div style="background:#fafafa;padding:10px 16px;border-bottom:1px solid #e8e8e8;display:grid;grid-template-columns:1fr 120px 80px;gap:12px;font-size:12px;color:#8c8c8c;font-weight:500">
                <div>功能名称</div>
                <div>所属模块</div>
                <div>类型</div>
              </div>
              <div style="max-height:200px;overflow-y:auto;background:#fff">
                <div v-for="feat in detailPackage.features" :key="feat.id" 
                     style="padding:10px 16px;border-bottom:1px solid #f0f0f0;display:grid;grid-template-columns:1fr 120px 80px;gap:12px;align-items:center">
                  <div style="font-size:13px;font-weight:500">{{ feat.name }}</div>
                  <div style="font-size:12px;color:#8c8c8c">{{ feat.moduleName || getModuleNameById(feat.moduleId) }}</div>
                  <div>
                    <span v-if="feat.required" style="background:#ffccc7;color:#a8071a;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500">必选</span>
                    <span v-else style="background:#f5f5f5;color:#8c8c8c;padding:2px 8px;border-radius:4px;font-size:11px">可选</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 包含的硬件 - 卡片展示 -->
          <div v-if="detailPackage.hardware?.length" style="margin-bottom:16px">
            <div style="font-size:14px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px;color:#333">
              🖥️ 硬件设备
              <span style="font-size:12px;font-weight:400;color:#8c8c8c">({{ detailPackage.hardware.length }}件)</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
              <div v-for="hw in detailPackage.hardware" :key="hw.id" 
                   style="background:#ffe7ba;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px;border:1px solid #ffa940;box-shadow:0 2px 8px rgba(250,140,22,0.15)">
                <span style="font-size:28px">{{ hw.icon }}</span>
                <div>
                  <div style="font-size:14px;font-weight:600;color:#1a1a1a">{{ hw.name }}</div>
                  <div style="font-size:12px;color:#8c8c8c;margin-top:2px">{{ hw.model }}</div>
                  <div style="font-size:14px;font-weight:600;color:#d46b08;margin-top:4px">¥{{ hw.priceFixed?.toLocaleString() }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="detailPackage=null">关闭</button>
          <button class="btn btn-primary" @click="goToQuoteWithPackage(detailPackage)">制作报价单 →</button>
        </div>
      </div>
    </div>
  </div>
  `,
  setup() {
    const loading = ref(true);
    const currentTab = ref('products'); // 'products' | 'packages'
    
    // 弹窗状态（弹窗层级式）
    const showModulesModal = ref(false); // 显示模块列表弹窗
    const showFeaturesModal = ref(false); // 显示功能列表弹窗
    const selectedModule = ref(null); // 选中的模块（用于高亮）
    
    // 数据
    const categories = ref([]);
    const modules = ref([]);
    const features = ref([]);
    const hardware = ref([]);
    const packages = ref([]);
    
    // 当前选择
    const currentCategory = ref(null);
    const currentModule = ref(null);
    const currentCategoryName = ref('');
    const currentModuleName = ref('');
    const currentModules = ref([]);
    const currentFeatures = ref([]);
    
    // 详情弹窗
    const detailFeature = ref(null);
    const detailPackage = ref(null);
    
    // 路由
    const router = VueRouter.useRouter();
    
    async function loadData() {
      loading.value = true;
      try {
        // 并行加载所有数据
        const [treeRes, pkgRes, hwRes] = await Promise.all([
          fetch(`${window.API_BASE}/product-tree?published=true`),
          fetch(`${window.API_BASE}/packages?published=true`),
          fetch(`${window.API_BASE}/hardware?published=true`)
        ]);
        
        const [tree, pkgData, hwData] = await Promise.all([
          treeRes.json(),
          pkgRes.json(),
          hwRes.json()
        ]);
        
        if (tree.success) {
          categories.value = tree.data;
          // 扁平化所有模块和功能供后续使用
          modules.value = tree.data.flatMap(c => c.modules.map(m => ({...m, categoryName: c.name, categoryIcon: c.icon})));
          features.value = modules.value.flatMap(m => (m.features || []).map(f => ({...f, moduleName: m.name, categoryName: m.categoryName})));
        }
        
        if (pkgData.success) {
          packages.value = pkgData.data;
        }
        
        if (hwData.success) {
          hardware.value = hwData.data;
        }
      } catch (err) {
        console.error('加载产品数据失败:', err);
      }
      loading.value = false;
    }
    
    function switchTab(tab) {
      currentTab.value = tab;
      currentCategory.value = null;
      currentModule.value = null;
    }
    
    // 打开模块列表弹窗（弹窗层级式第1层）
    function viewCategory(cat) {
      currentCategory.value = cat;
      currentCategoryName.value = cat.name;
      currentModules.value = cat.modules || [];
      selectedModule.value = null;
      showModulesModal.value = true;
    }
    
    // 在模块弹窗中点击模块，打开功能弹窗（弹窗层级式第2层）
    function viewModuleInModal(mod) {
      selectedModule.value = mod;
      currentModule.value = mod;
      currentModuleName.value = mod.name;
      currentFeatures.value = features.value.filter(f => f.moduleId === mod.id); // 从features数组过滤
      showModulesModal.value = false; // 关闭模块弹窗
      showFeaturesModal.value = true; // 打开功能弹窗
    }
    
    // 关闭功能弹窗，返回模块弹窗
    function closeFeaturesModal() {
      showFeaturesModal.value = false;
      selectedModule.value = null;
    }
    
    // 打开功能详情弹窗
    function viewFeatureDetail(feat) {
      detailFeature.value = feat;
    }
    
    // 保留旧的 viewModule 函数用于兼容性
    function viewModule(mod) {
      viewModuleInModal(mod);
    }
    
    function getModuleNameById(modId) {
      return modules.value.find(m => m.id === modId)?.name || '';
    }
    
    function viewHardware(hw) {
      // 硬件详情暂时显示在弹窗
      detailFeature.value = { ...hw, name: hw.name, desc: hw.desc, productCode: hw.model, priceType: 'fixed', priceFixed: hw.priceFixed, unit: hw.unit };
    }
    
    async function viewPackage(pkg) {
      // 获取套餐详情
      try {
        const res = await fetch(`${window.API_BASE}/packages/${pkg.id}`);
        const data = await res.json();
        if (data.success) {
          detailPackage.value = data.data;
        }
      } catch (err) {
        console.error('获取套餐详情失败:', err);
      }
    }
    
    function quickQuoteFeature(feat) {
      detailFeature.value = feat;
    }
    
    function quickQuotePackage(pkg) {
      viewPackage(pkg);
    }
    
    function goToQuoteWithFeature(feat) {
      // 将功能信息存入 sessionStorage，跳转到报价页面
      sessionStorage.setItem('quick_quote_feature', JSON.stringify(feat));
      router.push('/quote/new');
      detailFeature.value = null;
    }
    
    function goToQuoteWithPackage(pkg) {
      // 将套餐信息存入 sessionStorage
      sessionStorage.setItem('quick_quote_package', JSON.stringify(pkg));
      router.push('/quote/new');
      detailPackage.value = null;
    }
    
    onMounted(loadData);
    
    return {
      loading, currentTab,
      showModulesModal, showFeaturesModal, selectedModule,
      categories, modules, features, hardware, packages,
      currentCategory, currentModule, currentCategoryName, currentModuleName,
      currentModules, currentFeatures,
      detailFeature, detailPackage,
      switchTab, viewCategory, viewModuleInModal, viewFeatureDetail, closeFeaturesModal,
      viewHardware, viewPackage, getModuleNameById,
      quickQuoteFeature, quickQuotePackage, goToQuoteWithFeature, goToQuoteWithPackage
    };
  }
};

// ── 渠道商管理（管理员）────────────────────────────────────
const Partners = {
  template: `
  <div>
    <!-- 搜索栏 -->
    <div class="search-bar" style="margin-bottom:16px">
      <div class="search-input-wrap" style="min-width:260px">
        <span class="search-icon">🔍</span>
        <input class="form-control" v-model="kw" placeholder="搜索渠道商名称、联系人..."/>
      </div>
      <select class="form-control" v-model="levelFilter" style="width:140px">
        <option value="">全部级别</option>
        <option value="lep">💎 LEP</option>
        <option value="diamond">🔷 钻石</option>
        <option value="gold">🥇 金牌</option>
        <option value="silver">🥈 银牌</option>
        <option value="bronze">🥉 铜牌</option>
        <option value="industry">🏭 行业总代</option>
      </select>
      <select class="form-control" v-model="regionFilter" style="width:120px" v-if="!adminRegion">
        <option value="">全部区域</option>
        <option v-for="r in regions" :key="r">{{ r }}</option>
      </select>
      <span v-if="adminRegion" class="tag tag-blue" style="padding:6px 12px;font-size:13px">📍 {{ adminRegion }}</span>
      <button class="btn btn-primary" @click="openNew()">➕ 新增渠道商</button>
    </div>

    <!-- 渠道商列表 -->
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>渠道商名称</th>
              <th>级别</th>
              <th>区域</th>
              <th>联系人/电话</th>
              <th>销售人数</th>
              <th>报价/订单</th>
              <th>累计金额</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in filtered" :key="p.id" style="cursor:pointer" @click="openDetail(p)">
              <td>
                <div style="font-weight:600">{{ p.name }}</div>
                <div v-if="p.techServiceType && p.techServiceType !== 'none'" style="margin-top:4px">
                  <span v-if="p.techServiceType === 'full'" class="tag tag-blue" style="font-size:10px;padding:0 5px">🔧 签约技术服务商</span>
                  <span v-else-if="p.techServiceType === 'developing'" class="tag tag-green" style="font-size:10px;padding:0 5px">🌱 提名技术服务商</span>
                </div>
              </td>
              <td>
                <span class="tag" :class="levelClass(p.level)">
                  {{ levelLabel(p.level) }}
                </span>
              </td>
              <td>{{ p.region }}</td>
              <td>
                <div>{{ p.contact }}</div>
                <div style="font-size:11px;color:#aaa">{{ p.phone }}</div>
              </td>
              <td>
                <span class="badge badge-primary" style="font-size:12px">{{ (p.staff||[]).length }} 人</span>
              </td>
              <td style="font-size:12px">
                <span style="color:#1677ff">{{ p.quoteCount }}</span> / 
                <span style="color:#52c41a">{{ p.orderCount }}</span>
              </td>
              <td style="font-weight:700;color:#1677ff">{{ fmt(p.totalAmt) }}</td>
              <td>
                <span class="tag" :class="p.status==='active'?'tag-green':'tag-gray'">
                  {{ p.status==='active'?'正常':'停用' }}
                </span>
              </td>
              <td @click.stop>
                <button class="btn btn-text btn-sm" @click="openEdit(p)">编辑</button>
              </td>
            </tr>
            <tr v-if="!filtered.length">
              <td colspan="9">
                <div class="empty-state">
                  <div class="empty-icon">🤝</div>
                  <p>暂无渠道商记录</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 新增/编辑渠道商弹窗 -->
    <div class="modal-overlay" v-if="showForm" @click.self="closeForm">
      <div class="modal" style="width:560px">
        <div class="modal-header">
          <div class="modal-title">{{ editing ? '编辑渠道商' : '新增渠道商' }}</div>
          <span class="modal-close" @click="closeForm">✕</span>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-item full"><label class="form-label required">企业名称</label><input class="form-control" v-model="form.name" placeholder="公司全称"/></div>
            <div class="form-item"><label class="form-label required">合作级别</label>
              <select class="form-control" v-model="form.level">
                <option value="">空白</option>
                <option value="lep">💎 LEP</option>
                <option value="diamond">🔷 钻石</option>
                <option value="gold">🥇 金牌</option>
                <option value="silver">🥈 银牌</option>
                <option value="bronze">🥉 铜牌</option>
                <option value="industry">🏭 行业总代</option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label">技术服务类型</label>
              <select class="form-control" v-model="form.techServiceType">
                <option value="">请选择</option>
                <option value="developing">🌱 提名技术服务商</option>
                <option value="full">🔧 签约技术服务商</option>
              </select>
            </div>
            <div class="form-item"><label class="form-label required">所属区域</label>
              <select class="form-control" v-model="form.region">
                <option v-for="r in regions" :key="r">{{ r }}</option>
              </select>
            </div>
            <div class="form-item"><label class="form-label required">联系人</label><input class="form-control" v-model="form.contact" placeholder="负责人姓名"/></div>
            <div class="form-item"><label class="form-label required">联系电话</label><input class="form-control" v-model="form.phone" placeholder="138-0000-0000"/></div>
            <div class="form-item full"><label class="form-label">企业邮箱</label><input class="form-control" v-model="form.email" placeholder="contact@company.com"/></div>
            <div class="form-item"><label class="form-label">合作状态</label>
              <select class="form-control" v-model="form.status">
                <option value="active">正常</option>
                <option value="inactive">停用</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="closeForm">取消</button>
          <button class="btn btn-primary" @click="save" :disabled="!canSave">保存</button>
        </div>
      </div>
    </div>

    <!-- 渠道商详情弹窗 -->
    <div class="modal-overlay" v-if="detail" @click.self="detail=null">
      <div class="modal modal-xl" style="max-height:90vh;display:flex;flex-direction:column">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="modal-title">{{ detail.name }}</div>
            <span class="tag" :class="levelClass(detail.level)">{{ levelLabel(detail.level) }}</span>
            <span v-if="detail.techServiceType === 'full'" class="tag tag-blue">🔧 签约技术服务商</span>
            <span v-else-if="detail.techServiceType === 'developing'" class="tag tag-green">🌱 提名技术服务商</span>
          </div>
          <span class="modal-close" @click="detail=null">✕</span>
        </div>
        <div class="modal-body" style="padding:0;overflow:hidden">
          <div style="display:flex;min-height:500px">
            <!-- 左侧：企业信息 -->
            <div style="width:280px;flex-shrink:0;border-right:1px solid #f0f0f0;padding:20px;background:#fafbfc">
              <!-- 企业标识 -->
              <div style="text-align:center;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #e8e8e8">
                <div style="width:64px;height:64px;background:linear-gradient(135deg,#1677ff,#722ed1);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:28px;color:#fff;font-weight:700">
                  {{ detail.name.charAt(0) }}
                </div>
                <div style="font-size:13px;color:#888">{{ detail.id }}</div>
              </div>

              <!-- 核心指标卡片 -->
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
                <div style="background:#fff;padding:12px;border-radius:8px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.05)">
                  <div style="font-size:20px;font-weight:800;color:#1677ff">{{ detail.quoteCount }}</div>
                  <div style="font-size:11px;color:#888;margin-top:2px">报价单</div>
                </div>
                <div style="background:#fff;padding:12px;border-radius:8px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.05)">
                  <div style="font-size:20px;font-weight:800;color:#52c41a">{{ detail.orderCount }}</div>
                  <div style="font-size:11px;color:#888;margin-top:2px">成交订单</div>
                </div>
                <div style="background:#fff;padding:12px;border-radius:8px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.05)">
                  <div style="font-size:20px;font-weight:800;color:#faad14">{{ (detail.staff||[]).length }}</div>
                  <div style="font-size:11px;color:#888;margin-top:2px">销售人员</div>
                </div>
                <div style="background:#fff;padding:12px;border-radius:8px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.05)">
                  <div style="font-size:18px;font-weight:800;color:#722ed1">{{ detail.orderCount && detail.quoteCount ? Math.round(detail.orderCount/detail.quoteCount*100) : 0 }}%</div>
                  <div style="font-size:11px;color:#888;margin-top:2px">转化率</div>
                </div>
              </div>

              <!-- 累计金额 -->
              <div style="background:linear-gradient(135deg,#1677ff,#722ed1);padding:16px;border-radius:10px;text-align:center;margin-bottom:20px">
                <div style="font-size:12px;color:rgba(255,255,255,.8);margin-bottom:4px">累计成交金额</div>
                <div style="font-size:22px;font-weight:800;color:#fff">{{ fmt(detail.totalAmt) }}</div>
              </div>

              <!-- 联系信息 -->
              <div style="background:#fff;padding:16px;border-radius:10px;margin-bottom:16px">
                <div style="font-size:12px;font-weight:700;color:#333;margin-bottom:12px;display:flex;align-items:center;gap:6px">
                  <span>📞</span> 联系信息
                </div>
                <div style="margin-bottom:10px">
                  <div style="font-size:11px;color:#888;margin-bottom:2px">联系人</div>
                  <div style="font-size:13px;font-weight:600">{{ detail.contact }}</div>
                </div>
                <div style="margin-bottom:10px">
                  <div style="font-size:11px;color:#888;margin-bottom:2px">电话</div>
                  <div style="font-size:13px">{{ detail.phone }}</div>
                </div>
                <div v-if="detail.email">
                  <div style="font-size:11px;color:#888;margin-bottom:2px">邮箱</div>
                  <div style="font-size:13px">{{ detail.email }}</div>
                </div>
              </div>

              <!-- 基本信息 -->
              <div style="background:#fff;padding:16px;border-radius:10px">
                <div style="font-size:12px;font-weight:700;color:#333;margin-bottom:12px;display:flex;align-items:center;gap:6px">
                  <span>📍</span> 基本信息
                </div>
                <div style="margin-bottom:10px">
                  <div style="font-size:11px;color:#888;margin-bottom:2px">所属区域</div>
                  <div style="font-size:13px">{{ detail.region }}</div>
                </div>
                <div style="margin-bottom:10px">
                  <div style="font-size:11px;color:#888;margin-bottom:2px">加入日期</div>
                  <div style="font-size:13px">{{ detail.joinDate }}</div>
                </div>
                <div>
                  <div style="font-size:11px;color:#888;margin-bottom:2px">合作状态</div>
                  <span class="tag" :class="detail.status==='active'?'tag-green':'tag-gray'" style="margin-top:4px;display:inline-block">
                    {{ detail.status==='active'?'✅ 正常合作':'⏸️ 已停用' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 右侧：销售员工列表 -->
            <div style="flex:1;padding:20px;overflow-y:auto;max-height:600px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <div style="font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px">
                  👥 销售团队
                  <span style="font-size:12px;font-weight:400;color:#888">共 {{ (detail.staff||[]).length }} 人</span>
                </div>
                <button class="btn btn-primary btn-sm" @click="openStaffForm()">➕ 添加员工</button>
              </div>

              <!-- 员工卡片网格 -->
              <div v-if="(detail.staff||[]).length" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
                <div v-for="s in detail.staff" :key="s.id" style="background:#fff;border:1px solid #e8e8e8;border-radius:10px;padding:14px;transition:all .2s" :style="s.status!=='active'?'opacity:.6':''">
                  <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
                    <div style="width:44px;height:44px;background:linear-gradient(135deg,#52c41a,#389e0d);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;font-weight:600">
                      {{ s.name.charAt(0) }}
                    </div>
                    <div style="flex:1;min-width:0">
                      <div style="font-size:14px;font-weight:700;color:#1a1a1a;display:flex;align-items:center;gap:6px">
                        {{ s.name }}
                        <span v-if="s.status==='active'" style="width:8px;height:8px;background:#52c41a;border-radius:50%"></span>
                        <span v-else style="width:8px;height:8px;background:#d9d9d9;border-radius:50%"></span>
                      </div>
                      <div style="font-size:12px;color:#888;margin-top:2px">{{ s.role }}</div>
                    </div>
                  </div>
                  <div style="font-size:12px;color:#666;margin-bottom:6px;display:flex;align-items:center;gap:6px">
                    <span>📱</span> {{ s.phone }}
                  </div>
                  <div v-if="s.email" style="font-size:12px;color:#888;margin-bottom:12px;display:flex;align-items:center;gap:6px">
                    <span>✉️</span> {{ s.email }}
                  </div>
                  <div style="display:flex;gap:6px;margin-top:12px;padding-top:12px;border-top:1px solid #f0f0f0">
                    <button class="btn btn-text btn-sm" @click="editStaff(s)" style="flex:1">编辑</button>
                    <button class="btn btn-text btn-sm" @click="toggleStaffStatus(s)" style="flex:1;color:#1677ff">
                      {{ s.status==='active'?'禁用':'启用' }}
                    </button>
                    <button class="btn btn-text btn-sm" @click="deleteStaff(s)" style="color:#ff4d4f">删除</button>
                  </div>
                </div>
              </div>

              <!-- 空状态 -->
              <div v-else style="text-align:center;padding:60px 20px">
                <div style="width:80px;height:80px;background:#f5f5f5;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:36px">👤</div>
                <div style="font-size:14px;color:#888;margin-bottom:16px">暂无销售员工</div>
                <button class="btn btn-primary btn-sm" @click="openStaffForm()">添加第一位员工</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增/编辑员工弹窗 -->
    <div class="modal-overlay" v-if="staffForm.show" @click.self="closeStaffForm">
      <div class="modal" style="width:480px">
        <div class="modal-header">
          <div class="modal-title">{{ staffForm.editing ? '编辑员工' : '添加员工' }}</div>
          <span class="modal-close" @click="closeStaffForm">✕</span>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-item"><label class="form-label required">姓名</label><input class="form-control" v-model="staffForm.name" placeholder="员工姓名"/></div>
            <div class="form-item"><label class="form-label required">角色</label>
              <select class="form-control" v-model="staffForm.role">
                <option>销售总监</option>
                <option>销售经理</option>
                <option>销售代表</option>
                <option>技术支持</option>
              </select>
            </div>
            <div class="form-item"><label class="form-label required">联系电话</label><input class="form-control" v-model="staffForm.phone" placeholder="138-0000-0000"/></div>
            <div class="form-item"><label class="form-label">邮箱</label><input class="form-control" v-model="staffForm.email" placeholder="email@company.com"/></div>
            <div class="form-item"><label class="form-label">状态</label>
              <select class="form-control" v-model="staffForm.status">
                <option value="active">启用</option>
                <option value="inactive">禁用</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="closeStaffForm">取消</button>
          <button class="btn btn-primary" @click="saveStaff" :disabled="!canSaveStaff">保存</button>
        </div>
      </div>
    </div>
  </div>`,
  setup() {
    const kw = ref('');
    const levelFilter = ref('');
    const regionFilter = ref('');
    const regions = ['安徽区','江苏区','上海区（非金）','浙赣区','深圳区','广州区','湖南区','湖北区','西区','北区（政府企业）','河南区','东北区','山东区','晋冀区'];
    const showForm = ref(false);
    const editing = ref(false);
    const detail = ref(null);
    // 区域管理员的锁定区域（superadmin 无限制）
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    const form = reactive({ id:'', name:'', level:'gold', region:'安徽区', contact:'', phone:'', email:'', status:'active', techServiceType:'' });
    
    function matchesPartnerKeyword(partner, keyword) {
      const kwText = (keyword || '').trim().toLowerCase();
      if (!kwText) return true;
      const baseFields = [partner?.name, partner?.contact, partner?.phone, partner?.email, partner?.id];
      const staffFields = Array.isArray(partner?.staff)
        ? partner.staff.flatMap(s => [s?.name, s?.username, s?.phone, s?.email, s?.role])
        : [];
      return [...baseFields, ...staffFields]
        .filter(v => v !== undefined && v !== null && v !== '')
        .some(v => String(v).toLowerCase().includes(kwText));
    }

    const filtered = computed(() => store.partners.filter(p => {
      const mK = matchesPartnerKeyword(p, kw.value);
      const mL = !levelFilter.value || p.level === levelFilter.value;
      // 区域管理员强制只看本区域；超级管理员按筛选器
      const effectiveRegion = adminRegion.value || regionFilter.value;
      const mR = !effectiveRegion || p.region === effectiveRegion;
      return mK && mL && mR;
    }));
    
    const canSave = computed(() => form.name && form.level && form.contact && form.phone && form.region);
    
    function levelClass(lvl) {
      return { lep:'tag-purple', diamond:'tag-blue', gold:'tag-orange', silver:'tag-gray', bronze:'tag-brown', industry:'tag-green' }[lvl] || 'tag-gray';
    }
    function levelLabel(lvl) {
      return { lep:'💎 LEP', diamond:'🔷 钻石', gold:'🥇 金牌', silver:'🥈 银牌', bronze:'🥉 铜牌', industry:'🏭 行业总代' }[lvl] || lvl;
    }
    
    function openNew() {
      editing.value = false;
      form.id = ''; form.name = ''; form.level = 'gold'; form.region = adminRegion.value || '安徽区';
      form.contact = ''; form.phone = ''; form.email = ''; form.status = 'active'; form.techServiceType = '';
      showForm.value = true;
    }
    function openEdit(p) {
      editing.value = true;
      Object.assign(form, p);
      form.techServiceType = p.techServiceType && p.techServiceType !== 'none' ? p.techServiceType : '';
      showForm.value = true;
    }
    function closeForm() { showForm.value = false; }
    // 判断当前用户是否为超级管理员
    const isSuperAdmin = computed(() => store.user?.role === 'superadmin');
    
    async function save() {
      if (editing.value) {
        try {
          const result = await apiClient.updatePartner(form.id, form);
          if (result.success) {
            const idx = store.partners.findIndex(p => p.id === form.id);
            if (idx > -1) store.partners[idx] = { ...store.partners[idx], ...result.data };
          } else {
            alert('更新渠道商失败：' + (result.error || '未知错误'));
          }
        } catch (err) {
          alert('更新渠道商失败：' + err.message);
        }
      } else {
        // 区域管理员新增渠道商需要审核，超级管理员直接生效
        const newStatus = isSuperAdmin.value ? 'active' : 'pending';
        const partnerData = {
          name: form.name, level: form.level, region: form.region,
          contact: form.contact, phone: form.phone, email: form.email, status: newStatus,
          techServiceType: form.techServiceType,
          createdBy: store.user?.id,
          createdByRole: store.user?.role
        };
        
        try {
          const result = await apiClient.createPartner(partnerData);
          if (result.success) {
            store.partners.unshift(result.data);
            // 非超级管理员提交后提示等待审核
            if (!isSuperAdmin.value) {
              store.notifications.unshift({
                id: Date.now(),
                title: '渠道商提交成功',
                desc: `「${form.name}」已提交审核，等待超级管理员审批`,
                time: '刚刚',
                unread: true
              });
            }
          } else {
            alert('创建渠道商失败：' + (result.error || '未知错误'));
          }
        } catch (err) {
          alert('创建渠道商失败：' + err.message);
        }
      }
      closeForm();
    }
    function openDetail(p) { detail.value = p; }
    
    // 员工管理
    const staffForm = reactive({ show:false, editing:false, id:'', name:'', role:'销售代表', phone:'', email:'', status:'active' });
    const canSaveStaff = computed(() => staffForm.name && staffForm.phone);
    function openStaffForm(s) {
      staffForm.show = true;
      if (s) {
        staffForm.editing = true;
        Object.assign(staffForm, s);
      } else {
        staffForm.editing = false;
        staffForm.id = ''; staffForm.name = ''; staffForm.role = '销售代表'; 
        staffForm.phone = ''; staffForm.email = ''; staffForm.status = 'active';
      }
    }
    function closeStaffForm() { staffForm.show = false; }
    function saveStaff() {
      if (!detail.value.staff) detail.value.staff = [];
      if (staffForm.editing) {
        const idx = detail.value.staff.findIndex(s => s.id === staffForm.id);
        if (idx > -1) Object.assign(detail.value.staff[idx], staffForm);
      } else {
        const prefix = detail.value.id.replace('P', 'S') + '-';
        const seq = String(detail.value.staff.length + 1).padStart(2, '0');
        // 区域管理员新增员工需要审核，超级管理员直接生效
        const newStatus = isSuperAdmin.value ? 'active' : 'pending';
        detail.value.staff.unshift({
          id: prefix + seq, name: staffForm.name, role: staffForm.role,
          phone: staffForm.phone, email: staffForm.email, status: newStatus,
          createdAt: today()
        });
        // 非超级管理员提交后提示等待审核
        if (!isSuperAdmin.value) {
          store.notifications.unshift({
            id: Date.now(),
            title: '员工提交成功',
            desc: `「${staffForm.name}」已提交审核，等待超级管理员审批`,
            time: '刚刚',
            unread: true
          });
        }
      }
      closeStaffForm();
    }
    function editStaff(s) { openStaffForm(s); }
    function toggleStaffStatus(s) { s.status = s.status === 'active' ? 'inactive' : 'active'; }
    function deleteStaff(s) {
      if (!confirm(`确定删除员工「${s.name}」吗？`)) return;
      detail.value.staff = detail.value.staff.filter(x => x.id !== s.id);
    }
    
    return { store, kw, levelFilter, regionFilter, regions, filtered, showForm, editing, form, canSave, detail, staffForm, canSaveStaff,
      adminRegion, isSuperAdmin, openNew, openEdit, closeForm, save, openDetail, openStaffForm, closeStaffForm, saveStaff, editStaff, toggleStaffStatus, deleteStaff,
      levelClass, levelLabel, fmt };
  }
};

// ── 合作伙伴经营报表（管理员）────────────────────────────────
const PartnerReport = {
  template: `
  <div>
    <!-- 页面标题 -->
    <div style="margin-bottom:20px">
      <h2 style="font-size:18px;font-weight:700;color:#1a1a1a">合作伙伴经营报表</h2>
      <p style="font-size:13px;color:#888;margin-top:4px">
        渠道商维度业绩统计与经营分析
        <span v-if="adminRegion" class="tag tag-blue" style="margin-left:8px;font-size:12px">📍 {{ adminRegion }}</span>
      </p>
    </div>

    <!-- 核心指标卡 -->
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-icon blue">🤝</div>
        <div>
          <div class="stat-value">{{ myPartners.length }}</div>
          <div class="stat-label">合作渠道商</div>
          <div class="stat-trend up">↑ 本月新增 {{ newPartnersThisMonth }} 家</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">📊</div>
        <div>
          <div class="stat-value">{{ totalQuotes }}</div>
          <div class="stat-label">累计报价单</div>
          <div class="stat-trend up">转化率 {{ conversionRate }}%</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">💰</div>
        <div>
          <div class="stat-value">{{ fmt(totalRevenue) }}</div>
          <div class="stat-label">累计成交金额</div>
          <div class="stat-trend up">平均 {{ fmt(avgRevenue) }}/家</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">👥</div>
        <div>
          <div class="stat-value">{{ totalStaff }}</div>
          <div class="stat-label">销售总人数</div>
          <div class="stat-trend up">人均业绩 {{ fmt(revenuePerStaff) }}</div>
        </div>
      </div>
    </div>

    <!-- 图表区 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <!-- 业绩排名 -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏆 渠道商业绩排名 TOP5</div>
        </div>
        <div style="padding:16px">
          <div v-for="(p,i) in topPartners" :key="p.id" style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
            <div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700"
              :style="{background: i<3?'#fff7e6':'#f5f5f5', color: i<3?'#faad14':'#888'}">
              {{ i+1 }}
            </div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600">{{ p.name }}</div>
              <div style="font-size:11px;color:#aaa">{{ p.orderCount }} 订单 / {{ p.quoteCount }} 报价</div>
            </div>
            <div style="font-weight:700;color:#1677ff;font-size:14px">{{ fmt(p.totalAmt) }}</div>
          </div>
        </div>
      </div>

      <!-- 级别分布 -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📊 合作级别分布</div>
        </div>
        <div style="padding:16px">
          <div v-for="item in levelDistribution" :key="item.level" style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px">
              <span>{{ levelLabel(item.level) }}</span>
              <span style="font-weight:600">{{ item.count }} 家 ({{ item.percent }}%)</span>
            </div>
            <div style="height:8px;background:#f0f0f0;border-radius:4px;overflow:hidden">
              <div :style="{width: item.percent + '%', height: '100%', background: levelColor(item.level), borderRadius: '4px'}"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 区域分布 + 技术服务商 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🗺️ 区域分布</div>
        </div>
        <div style="padding:16px">
          <div v-for="item in regionDistribution" :key="item.region" style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f5f5f5">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:16px">{{ regionIcon(item.region) }}</span>
              <span style="font-size:13px">{{ item.region }}</span>
            </div>
            <div style="display:flex;align-items:center;gap:16px">
              <div style="width:100px;height:6px;background:#f0f0f0;border-radius:3px;overflow:hidden">
                <div :style="{width: item.percent + '%', height: '100%', background: '#1677ff', borderRadius: '3px'}"></div>
              </div>
              <span style="font-size:13px;font-weight:600;color:#1677ff">{{ item.count }} 家</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🔧 技术服务商分布</div>
        </div>
        <div style="padding:16px">
          <div style="display:flex;gap:20px;margin-bottom:20px">
            <div style="flex:1;text-align:center;padding:20px;background:#f6f8ff;border-radius:10px">
              <div style="font-size:28px;font-weight:800;color:#1677ff">{{ techServiceCount }}</div>
              <div style="font-size:12px;color:#888;margin-top:4px">签约技术服务商</div>
            </div>
            <div style="flex:1;text-align:center;padding:20px;background:#f6ffed;border-radius:10px">
              <div style="font-size:28px;font-weight:800;color:#52c41a">{{ developingTechServiceCount }}</div>
              <div style="font-size:12px;color:#888;margin-top:4px">提名技术服务商</div>
            </div>
          </div>
          <div style="font-size:12px;color:#888;line-height:1.8">
            <p>• 签约技术服务商占比：{{ techServicePercent }}%</p>
            <p>• 提名技术服务商占比：{{ developingTechServicePercent }}%</p>
            <p>• 签约技术服务商平均业绩：{{ fmt(techServiceAvgRevenue) }}</p>
            <p>• 提名技术服务商平均业绩：{{ fmt(developingTechServiceAvgRevenue) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar" style="margin-bottom:16px">
      <div class="search-input-wrap" style="flex:1;max-width:400px">
        <span class="search-icon">🔍</span>
        <input class="form-control" v-model="searchKw" placeholder="搜索合作伙伴名称..."/>
      </div>
      <button class="btn btn-default" @click="searchKw=''" v-if="searchKw">清除</button>
    </div>

    <!-- 详细数据表 -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">📋 渠道商经营明细 <span style="font-size:12px;color:#888;font-weight:400">（共 {{ filteredPartners.length }} 家）</span></div>
        <div style="display:flex;gap:10px">
          <select class="form-control" v-model="sortBy" style="width:140px;font-size:13px">
            <option value="totalAmt">按成交金额</option>
            <option value="orderCount">按订单数</option>
            <option value="quoteCount">按报价数</option>
            <option value="staffCount">按员工数</option>
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>排名</th>
              <th>渠道商</th>
              <th>级别</th>
              <th>区域</th>
              <th>员工数</th>
              <th>报价/订单</th>
              <th>成交金额</th>
              <th>转化率</th>
              <th>人均业绩</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p,i) in sortedPartners" :key="p.id" style="cursor:pointer" @click="openDetail(p)">
              <td>
                <span class="badge" :style="{background: i<3?'#faad14':'#f0f0f0', color: i<3?'#fff':'#888'}">{{ i+1 }}</span>
              </td>
              <td>
                <div style="font-weight:600;color:#1677ff">{{ p.name }}</div>
                <div v-if="p.techServiceType && p.techServiceType !== 'none'" style="margin-top:2px">
                  <span v-if="p.techServiceType === 'full'" class="tag tag-blue" style="font-size:10px;padding:0 4px">🔧 签约</span>
                  <span v-else-if="p.techServiceType === 'developing'" class="tag tag-green" style="font-size:10px;padding:0 4px">🌱 提名</span>
                </div>
              </td>
              <td><span class="tag" :class="levelClass(p.level)">{{ levelLabel(p.level) }}</span></td>
              <td>{{ p.region }}</td>
              <td>{{ (p.staff||[]).length }} 人</td>
              <td style="font-size:12px">
                <span style="color:#1677ff">{{ p.quoteCount }}</span> / 
                <span style="color:#52c41a">{{ p.orderCount }}</span>
              </td>
              <td style="font-weight:700;color:#1677ff">{{ fmt(p.totalAmt) }}</td>
              <td>
                <span :style="{color: p.quoteCount? '#52c41a' : '#888'}">
                  {{ p.quoteCount ? Math.round(p.orderCount/p.quoteCount*100) : 0 }}%
                </span>
              </td>
              <td style="font-size:12px;color:#888">{{ fmt(Math.round(p.totalAmt/((p.staff||[]).length||1))) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <!-- 合作伙伴详情弹窗 -->
    <div v-if="detailPartner" class="modal-overlay" @click.self="detailPartner=null">
      <div class="modal modal-lg" style="max-height:90vh;overflow:hidden">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:12px">
            <h3 style="margin:0">{{ detailPartner.name }}</h3>
            <span class="tag" :class="levelClass(detailPartner.level)">{{ levelLabel(detailPartner.level) }}</span>
            <span v-if="detailPartner.techServiceType === 'full'" class="tag tag-blue">🔧 签约技术服务商</span>
            <span v-else-if="detailPartner.techServiceType === 'developing'" class="tag tag-green">🌱 提名技术服务商</span>
          </div>
          <button class="btn btn-text" @click="detailPartner=null">✕</button>
        </div>
        <div class="modal-body">
          <!-- 基本信息 -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px;padding:16px;background:#f8f9fa;border-radius:8px">
            <div style="text-align:center">
              <div style="font-size:24px;font-weight:800;color:#1677ff">{{ (detailPartner.staff||[]).length }}</div>
              <div style="font-size:12px;color:#888">销售员工</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:24px;font-weight:800;color:#52c41a">{{ detailPartner.orderCount }}</div>
              <div style="font-size:12px;color:#888">成交订单</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:24px;font-weight:800;color:#faad14">{{ detailPartner.quoteCount }}</div>
              <div style="font-size:12px;color:#888">报价次数</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:24px;font-weight:800;color:#722ed1">{{ fmt(detailPartner.totalAmt) }}</div>
              <div style="font-size:12px;color:#888">成交金额</div>
            </div>
          </div>

          <!-- 转化率 -->
          <div style="margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-size:13px;font-weight:600">报价转化率</span>
              <span style="font-size:13px;font-weight:700;color:#52c41a">{{ detailPartner.quoteCount ? Math.round(detailPartner.orderCount/detailPartner.quoteCount*100) : 0 }}%</span>
            </div>
            <div style="height:8px;background:#f0f0f0;border-radius:4px;overflow:hidden">
              <div :style="{width: (detailPartner.quoteCount ? detailPartner.orderCount/detailPartner.quoteCount*100 : 0) + '%', height: '100%', background: '#52c41a', borderRadius: '4px'}"></div>
            </div>
          </div>

          <!-- 报备客户统计 -->
          <div style="margin-bottom:20px;padding:16px;background:#f0f7ff;border-radius:8px;border:1px solid #d6e4ff">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
              <span style="font-size:16px">📋</span>
              <span style="font-size:14px;font-weight:600;color:#1677ff">报备客户</span>
              <span style="font-size:20px;font-weight:800;color:#1677ff;margin-left:auto">{{ partnerRegistrations.length }}</span>
              <span style="font-size:12px;color:#888">家</span>
            </div>
            <div v-if="partnerRegistrations.length" style="display:flex;flex-wrap:wrap;gap:6px">
              <span v-for="r in partnerRegistrations.slice(0,5)" :key="r.id" class="tag tag-blue" style="font-size:11px">{{ r.customer }}</span>
              <span v-if="partnerRegistrations.length > 5" class="tag tag-gray" style="font-size:11px">+{{ partnerRegistrations.length - 5 }}</span>
            </div>
            <div v-else style="font-size:12px;color:#888">暂无报备客户</div>
          </div>

          <!-- 商机阶段分布 -->
          <div style="margin-bottom:20px">
            <h4 style="font-size:14px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:6px">
              <span>🎯</span> 商机阶段分布 <span style="font-size:12px;font-weight:400;color:#888">（共 {{ partnerOpportunities.length }} 个）</span>
            </h4>
            <div v-if="partnerOpportunities.length" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
              <div v-for="st in stageStats" :key="st.key" style="padding:12px;border-radius:8px;text-align:center" :style="{background: st.bgColor}">
                <div style="font-size:18px;font-weight:800" :style="{color: st.color}">{{ st.count }}</div>
                <div style="font-size:11px;color:#666;margin-top:2px">{{ st.label }}</div>
                <div v-if="st.amount > 0" style="font-size:11px;color:#888;margin-top:4px">{{ fmt(st.amount) }}</div>
              </div>
            </div>
            <div v-else style="padding:20px;text-align:center;background:#f8f9fa;border-radius:8px;color:#888;font-size:13px">
              暂无关联商机
            </div>
          </div>

          <!-- 员工列表 -->
          <div style="margin-bottom:20px">
            <h4 style="font-size:14px;font-weight:600;margin-bottom:12px">👥 销售团队（{{ (detailPartner.staff||[]).length }} 人）</h4>
            <div v-if="(detailPartner.staff||[]).length" style="display:flex;flex-wrap:wrap;gap:8px">
              <span v-for="s in detailPartner.staff" :key="s.id" class="tag tag-gray" style="font-size:12px;padding:4px 10px;display:flex;align-items:center;gap:4px">
                <span style="font-weight:600">{{ s.name }}</span>
                <span style="color:#888;font-size:11px">· {{ s.role }}</span>
              </span>
            </div>
            <div v-else style="color:#888;font-size:13px">暂无销售员工</div>
          </div>

          <!-- 区域与加入时间 -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
            <div style="padding:12px;background:#f8f9fa;border-radius:8px">
              <div style="font-size:12px;color:#888;margin-bottom:4px">所属区域</div>
              <div style="font-size:14px;font-weight:600">{{ regionIcon(detailPartner.region) }} {{ detailPartner.region }}</div>
            </div>
            <div style="padding:12px;background:#f8f9fa;border-radius:8px">
              <div style="font-size:12px;color:#888;margin-bottom:4px">加入时间</div>
              <div style="font-size:14px;font-weight:600">{{ detailPartner.joinDate || '未知' }}</div>
            </div>
          </div>

          <!-- 业绩趋势（模拟数据） -->
          <div>
            <h4 style="font-size:14px;font-weight:600;margin-bottom:12px">📈 近6个月业绩趋势</h4>
            <div style="display:flex;align-items:flex-end;gap:8px;height:100px;padding:10px;background:#f8f9fa;border-radius:8px">
              <div v-for="(m,idx) in partnerMonthlyTrend" :key="idx" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
                <div :style="{width:'100%',height:m.height+'%',background:m.color,borderRadius:'4px 4px 0 0',minHeight:'4px'}"></div>
                <span style="font-size:10px;color:#888">{{ m.month }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`,
  setup() {
    const sortBy = ref('totalAmt');
    const searchKw = ref('');
    const detailPartner = ref(null);
    
    // 区域管理员隔离：只看本区域渠道商
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    const myPartners = computed(() => adminRegion.value
      ? store.partners.filter(p => p.region === adminRegion.value)
      : store.partners);
    
    // 核心指标计算
    const totalQuotes = computed(() => myPartners.value.reduce((s,p)=>s+p.quoteCount,0));
    const totalRevenue = computed(() => myPartners.value.reduce((s,p)=>s+p.totalAmt,0));
    const totalStaff = computed(() => myPartners.value.reduce((s,p)=>s+(p.staff||[]).length,0));
    const avgRevenue = computed(() => Math.round(totalRevenue.value/(myPartners.value.length||1)));
    const revenuePerStaff = computed(() => Math.round(totalRevenue.value/(totalStaff.value||1)));
    const conversionRate = computed(() => {
      const q = totalQuotes.value;
      const o = myPartners.value.reduce((s,p)=>s+p.orderCount,0);
      return q ? Math.round(o/q*100) : 0;
    });
    const newPartnersThisMonth = computed(() => {
      const thisMonth = today().slice(0,7);
      return myPartners.value.filter(p => p.joinDate && p.joinDate.startsWith(thisMonth)).length;
    });
    
    // TOP5 排名
    const topPartners = computed(() => [...myPartners.value].sort((a,b)=>b.totalAmt-a.totalAmt).slice(0,5));
    // 搜索过滤后的合作伙伴列表
    const filteredPartners = computed(() => {
      let list = [...myPartners.value];
      if (searchKw.value.trim()) {
        const kw = searchKw.value.trim().toLowerCase();
        list = list.filter(p => p.name.toLowerCase().includes(kw));
      }
      return list;
    });

    const sortedPartners = computed(() => {
      const list = [...filteredPartners.value];
      if (sortBy.value === 'totalAmt') list.sort((a,b)=>b.totalAmt-a.totalAmt);
      else if (sortBy.value === 'orderCount') list.sort((a,b)=>b.orderCount-a.orderCount);
      else if (sortBy.value === 'quoteCount') list.sort((a,b)=>b.quoteCount-a.quoteCount);
      else if (sortBy.value === 'staffCount') list.sort((a,b)=>(b.staff||[]).length-(a.staff||[]).length);
      return list;
    });

    // 生成合作伙伴月度趋势数据（模拟）
    const partnerMonthlyTrend = computed(() => {
      if (!detailPartner.value) return [];
      const months = ['1月','2月','3月','4月','5月','6月'];
      return months.map((m, i) => {
        const randomFactor = 0.5 + Math.random();
        const height = Math.min(100, Math.max(10, randomFactor * 50));
        const colors = ['#1677ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#13c2c2'];
        return { month: m, height, color: colors[i] };
      });
    });

    // 该合作伙伴的报备客户
    const partnerRegistrations = computed(() => {
      if (!detailPartner.value) return [];
      // 根据客户名称匹配（实际项目中应该有 partnerId 关联）
      return store.registrations.filter(r => r.status === 'approved');
    });

    // 该合作伙伴的商机
    const partnerOpportunities = computed(() => {
      if (!detailPartner.value) return [];
      return store.opportunities;
    });

    // 商机阶段统计
    const stageStats = computed(() => {
      const stages = [
        { key: 'contacted', label: '1% 已联系上客户', color: '#1677ff', bgColor: '#e6f4ff' },
        { key: 'registered', label: '10% 商机明确并报备', color: '#faad14', bgColor: '#fff7e6' },
        { key: 'quoted', label: '20% 正式报价', color: '#eb2f96', bgColor: '#fff0f6' },
        { key: 'budget', label: '30% 明确预算', color: '#722ed1', bgColor: '#f9f0ff' },
        { key: 'design', label: '40% 技术交流/方案设计', color: '#52c41a', bgColor: '#f6ffed' },
        { key: 'testing', label: '50% 产品测试', color: '#cf1322', bgColor: '#fff1f0' },
        { key: 'negotiation', label: '70% 招投标/商务谈判', color: '#0891b2', bgColor: '#f0faff' },
        { key: 'won', label: '100% 赢单', color: '#389e0d', bgColor: '#f6ffed' },
        { key: 'cancelled', label: '项目取消', color: '#8c8c8c', bgColor: '#f5f5f5' },
        { key: 'lost', label: '输单', color: '#cf1322', bgColor: '#fff1f0' }
      ];
      return stages.map(st => {
        const opps = partnerOpportunities.value.filter(o => o.stage === st.key);
        return {
          ...st,
          count: opps.length,
          amount: opps.reduce((s, o) => s + o.amount, 0)
        };
      });
    });

    function openDetail(p) {
      detailPartner.value = p;
    }
    
    // 级别分布
    const levelDistribution = computed(() => {
      const levels = ['lep','diamond','gold','silver','bronze','industry'];
      const total = myPartners.value.length || 1;
      return levels.map(lvl => {
        const count = myPartners.value.filter(p=>p.level===lvl).length;
        return { level: lvl, count, percent: Math.round(count/total*100) };
      }).filter(x=>x.count>0);
    });
    
    // 区域分布
    const regionDistribution = computed(() => {
      const map = {};
      myPartners.value.forEach(p => { map[p.region] = (map[p.region]||0)+1; });
      const total = myPartners.value.length || 1;
      return Object.entries(map).map(([region,count]) => ({ region, count, percent: Math.round(count/total*100) }))
        .sort((a,b)=>b.count-a.count);
    });
    
    // 技术服务商统计
    const techServiceCount = computed(() => myPartners.value.filter(p=>p.techServiceType==='full').length);
    const developingTechServiceCount = computed(() => myPartners.value.filter(p=>p.techServiceType==='developing').length);
    const nonTechServiceCount = computed(() => myPartners.value.filter(p=>p.techServiceType!=='full' && p.techServiceType!=='developing').length);
    const techServicePercent = computed(() => Math.round(techServiceCount.value/(myPartners.value.length||1)*100));
    const developingTechServicePercent = computed(() => Math.round(developingTechServiceCount.value/(myPartners.value.length||1)*100));
    const techServiceAvgRevenue = computed(() => {
      const list = myPartners.value.filter(p=>p.techServiceType==='full');
      return list.length ? Math.round(list.reduce((s,p)=>s+p.totalAmt,0)/list.length) : 0;
    });
    const developingTechServiceAvgRevenue = computed(() => {
      const list = myPartners.value.filter(p=>p.techServiceType==='developing');
      return list.length ? Math.round(list.reduce((s,p)=>s+p.totalAmt,0)/list.length) : 0;
    });
    const nonTechServiceAvgRevenue = computed(() => {
      const list = myPartners.value.filter(p=>p.techServiceType!=='full' && p.techServiceType!=='developing');
      return list.length ? Math.round(list.reduce((s,p)=>s+p.totalAmt,0)/list.length) : 0;
    });
    
    function levelClass(lvl) {
      return { lep:'tag-purple', diamond:'tag-blue', gold:'tag-orange', silver:'tag-gray', bronze:'tag-brown', industry:'tag-green' }[lvl] || 'tag-gray';
    }
    function levelLabel(lvl) {
      return { lep:'💎 LEP', diamond:'🔷 钻石', gold:'🥇 金牌', silver:'🥈 银牌', bronze:'🥉 铜牌', industry:'🏭 行业总代' }[lvl] || lvl;
    }
    function levelColor(lvl) {
      return { lep:'#722ed1', diamond:'#1677ff', gold:'#faad14', silver:'#8c8c8c', bronze:'#a0522d', industry:'#52c41a' }[lvl] || '#888';
    }
    function regionIcon(region) {
      const map = {
        '安徽区':'🌿', '江苏区':'🏙️', '上海区（非金）':'🌆', '浙赣区':'🏞️',
        '深圳区':'🏢', '广州区':'🌸', '湖南区':'🌾', '湖北区':'鄂',
        '西区':'🏔️',
        '北区（政府企业）':'🏛️', '河南区':'🌻', '东北区':'❄️', '山东区':'🌊', '晋冀区':'🗻'
      };
      return map[region] || '📍';
    }
    
    return { store, adminRegion, myPartners, sortBy, searchKw, detailPartner, totalQuotes, totalRevenue, totalStaff, avgRevenue, revenuePerStaff, conversionRate, newPartnersThisMonth,
      topPartners, sortedPartners, filteredPartners, levelDistribution, regionDistribution, techServiceCount, developingTechServiceCount, nonTechServiceCount, techServicePercent,
      developingTechServicePercent, techServiceAvgRevenue, developingTechServiceAvgRevenue, nonTechServiceAvgRevenue, partnerMonthlyTrend, partnerRegistrations, partnerOpportunities, stageStats,
      levelClass, levelLabel, levelColor, regionIcon, fmt, openDetail };
  }
};

// ── 账号管理（超级管理员专属）────────────────────────────────
const BIG_REGIONS = [
  { label:'大东区', regions:['安徽区','江苏区','上海区（非金）','浙赣区'] },
  { label:'大南区', regions:['深圳区','广州区','湖南区','湖北区'] },
  { label:'西区',   regions:['西区'] },
  { label:'大北区', regions:['北区（政府企业）','河南区','东北区','山东区','晋冀区'] },
];
const ALL_REGIONS = BIG_REGIONS.flatMap(g => g.regions);

const AccountManage = {
  template: `
  <div>
    <!-- 顶部统计 -->
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat-card">
        <div class="stat-icon blue">👤</div>
        <div><div class="stat-value">{{ store.adminAccounts.filter(a=>a.role!=='superadmin').length }}</div><div class="stat-label">区域管理员总数</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">✅</div>
        <div><div class="stat-value">{{ store.adminAccounts.filter(a=>a.role!=='superadmin'&&a.status==='active').length }}</div><div class="stat-label">启用账号</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">⏸️</div>
        <div><div class="stat-value">{{ store.adminAccounts.filter(a=>a.role!=='superadmin'&&a.status==='disabled').length }}</div><div class="stat-label">停用账号</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">🗺️</div>
        <div><div class="stat-value">{{ BIG_REGIONS.length }}</div><div class="stat-label">大区数量</div></div>
      </div>
    </div>

    <!-- 各大区账号列表 -->
    <div v-for="group in BIG_REGIONS" :key="group.label" class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div class="card-title">{{ group.label }}</div>
        <button class="btn btn-primary btn-sm" @click="openNew(group.label)">➕ 新增管理员</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>账号</th><th>姓名</th><th>所属区域</th><th>状态</th><th>创建日期</th><th>备注</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="a in store.adminAccounts.filter(x=>x.bigRegion===group.label)" :key="a.id">
              <td style="font-family:monospace;font-weight:600;color:#007AFF">{{ a.username }}</td>
              <td>
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#007AFF,#5856D6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700;flex-shrink:0">{{ a.avatar }}</div>
                  <span style="font-weight:600">{{ a.name }}</span>
                </div>
              </td>
              <td><span class="tag tag-blue">{{ a.region }}</span></td>
              <td>
                <span class="tag" :class="a.status==='active'?'tag-green':'tag-gray'">
                  {{ a.status==='active'?'启用':'停用' }}
                </span>
              </td>
              <td style="font-size:12px;color:#888">{{ a.createdAt }}</td>
              <td style="font-size:12px;color:#888">{{ a.remark || '—' }}</td>
              <td @click.stop>
                <button class="btn btn-text btn-sm" @click="openEdit(a)">编辑</button>
                <button class="btn btn-text btn-sm" @click="toggleStatus(a)" :style="{color:a.status==='active'?'#FF9500':'#34C759'}">
                  {{ a.status==='active'?'停用':'启用' }}
                </button>
                <button class="btn btn-text btn-sm" style="color:#FF3B30" @click="deleteAccount(a)">删除</button>
              </td>
            </tr>
            <tr v-if="!store.adminAccounts.filter(x=>x.bigRegion===group.label).length">
              <td colspan="7"><div class="empty-state" style="padding:24px"><div class="empty-icon" style="font-size:36px">👤</div><p>该大区暂无管理员账号</p></div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <div class="modal-overlay" v-if="showForm" @click.self="showForm=false">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">{{ editing?'编辑管理员账号':'新增管理员账号' }}</div>
          <span class="modal-close" @click="showForm=false">✕</span>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-item">
              <label class="form-label required">所属大区</label>
              <select class="form-control" v-model="form.bigRegion" @change="form.region=''">
                <option v-for="g in BIG_REGIONS" :key="g.label" :value="g.label">{{ g.label }}</option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label required">负责区域</label>
              <select class="form-control" v-model="form.region">
                <option value="">请选择区域</option>
                <option v-for="r in (BIG_REGIONS.find(g=>g.label===form.bigRegion)||{regions:[]}).regions" :key="r" :value="r">{{ r }}</option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label required">登录账号</label>
              <input class="form-control" v-model="form.username" placeholder="如：admin_ah" :disabled="editing"/>
              <div class="form-hint" v-if="!editing">建议格式：admin_拼音缩写</div>
            </div>
            <div class="form-item">
              <label class="form-label required">管理员姓名</label>
              <input class="form-control" v-model="form.name" placeholder="如：安徽区管理员"/>
            </div>
            <div class="form-item">
              <label class="form-label">头像字</label>
              <input class="form-control" v-model="form.avatar" placeholder="1-2个字，如：皖" maxlength="2"/>
            </div>
            <div class="form-item">
              <label class="form-label">账号状态</label>
              <select class="form-control" v-model="form.status">
                <option value="active">启用</option>
                <option value="disabled">停用</option>
              </select>
            </div>
            <div class="form-item full">
              <label class="form-label">备注</label>
              <input class="form-control" v-model="form.remark" placeholder="可选备注信息"/>
            </div>
          </div>
          <div style="margin-top:20px;padding:14px 16px;background:rgba(0,122,255,0.05);border-radius:10px;border:1px solid rgba(0,122,255,0.12)">
            <div style="font-size:13px;font-weight:600;color:#007AFF;margin-bottom:6px">🔑 初始密码</div>
            <div style="font-size:13px;color:#555">新账号初始密码统一为 <b style="color:#007AFF;font-family:monospace">123456</b>，请提醒管理员登录后修改。</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showForm=false">取消</button>
          <button class="btn btn-primary" @click="save" :disabled="!canSave">{{ editing?'保存修改':'创建账号' }}</button>
        </div>
      </div>
    </div>
  </div>`,
  setup() {
    const showForm = ref(false);
    const editing = ref(false);
    const form = reactive({ id:'', username:'', name:'', avatar:'', bigRegion:'大东区', region:'', status:'active', remark:'' });
    const canSave = computed(() => form.username && form.name && form.bigRegion && form.region);

    function openNew(bigRegion) {
      editing.value = false;
      form.id = ''; form.username = ''; form.name = ''; form.avatar = '';
      form.bigRegion = bigRegion || '大东区'; form.region = ''; form.status = 'active'; form.remark = '';
      showForm.value = true;
    }
    function openEdit(a) {
      editing.value = true;
      Object.assign(form, { id:a.id, username:a.username, name:a.name, avatar:a.avatar, bigRegion:a.bigRegion, region:a.region, status:a.status, remark:a.remark||'' });
      showForm.value = true;
    }
    async function save() {
      if (!canSave.value) return;
      if (editing.value) {
        try {
          const result = await apiClient.updateUser(form.id, { 
            name:form.name, avatar:form.avatar||form.name.slice(0,1), 
            bigRegion:form.bigRegion, region:form.region, status:form.status, remark:form.remark 
          });
          if (result.success) {
            const idx = store.adminAccounts.findIndex(a => a.id === form.id);
            if (idx > -1) Object.assign(store.adminAccounts[idx], result.data);
          } else {
            alert('更新管理员失败：' + (result.error || '未知错误'));
          }
        } catch (err) {
          alert('更新管理员失败：' + err.message);
        }
      } else {
        // 检查账号名是否重复
        if (store.adminAccounts.find(a => a.username === form.username)) {
          alert('账号名已存在，请换一个'); return;
        }
        
        const userData = {
          username: form.username, 
          name: form.name,
          password: '123456', // 初始密码
          avatar: form.avatar || form.name.slice(0,1),
          role: 'admin', bigRegion: form.bigRegion, region: form.region,
          status: form.status, remark: form.remark
        };
        
        try {
          const result = await apiClient.createUser(userData);
          if (result.success) {
            store.adminAccounts.push(result.data);
          } else {
            alert('创建管理员失败：' + (result.error || '未知错误'));
            return;
          }
        } catch (err) {
          alert('创建管理员失败：' + err.message);
          return;
        }
      }
      showForm.value = false;
    }
    async function toggleStatus(a) {
      const newStatus = a.status === 'active' ? 'disabled' : 'active';
      try {
        const result = await apiClient.updateUser(a.id, { status: newStatus });
        if (result.success) {
          a.status = newStatus;
        } else {
          alert('更新状态失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        alert('更新状态失败：' + err.message);
      }
    }
    async function deleteAccount(a) {
      if (confirm('确认删除账号「' + a.name + '」(' + a.username + ')？')) {
        try {
          const result = await apiClient.deleteUser(a.id);
          if (result.success) {
            const idx = store.adminAccounts.findIndex(x => x.id === a.id);
            if (idx > -1) store.adminAccounts.splice(idx, 1);
          } else {
            alert('删除失败：' + (result.error || '未知错误'));
          }
        } catch (err) {
          alert('删除失败：' + err.message);
        }
      }
    }
    return { store, BIG_REGIONS, showForm, editing, form, canSave, openNew, openEdit, save, toggleStatus, deleteAccount, fmt };
  }
};

// ── 审核中心（管理员）────────────────────────────────────────
const AdminReview = {
  template: `
  <div>
    <!-- 标签切换 -->
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn" :class="activeTab==='registration'?'btn-primary':'btn-default'" @click="activeTab='registration'">
        📋 客户报备 <span v-if="pendingRegCount" class="nav-badge" style="margin-left:4px">{{ pendingRegCount }}</span>
      </button>
      <button v-if="isSuperAdmin" class="btn" :class="activeTab==='partner'?'btn-primary':'btn-default'" @click="activeTab='partner'">
        🤝 渠道商 <span v-if="pendingPartnerCount" class="nav-badge" style="margin-left:4px">{{ pendingPartnerCount }}</span>
      </button>
      <button v-if="isSuperAdmin" class="btn" :class="activeTab==='staff'?'btn-primary':'btn-default'" @click="activeTab='staff'">
        👤 员工 <span v-if="pendingStaffCount" class="nav-badge" style="margin-left:4px">{{ pendingStaffCount }}</span>
      </button>
    </div>

    <!-- 客户报备审核 -->
    <div v-if="activeTab==='registration'" class="card">
      <div class="card-header">
        <div class="card-title">
          客户报备审核
          <span v-if="adminRegion" class="tag tag-blue" style="margin-left:8px;font-size:12px">📍 {{ adminRegion }}</span>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>报备编号</th><th>客户名称</th><th>所属区域</th><th>行业</th><th>联系人</th><th>状态</th><th>提交日期</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="r in allRegs" :key="r.id">
              <td style="font-family:monospace;font-size:12px;color:#888">{{ r.id }}</td>
              <td style="font-weight:600">{{ r.customer }}</td>
              <td><span class="tag tag-purple" style="font-size:11px">{{ r.region || '未分配' }}</span></td>
              <td>{{ r.industry }}</td>
              <td>{{ r.contact }}</td>
              <td><span class="tag" :class="sClass(r.status)">{{ sLabel(r.status) }}</span></td>
              <td style="font-size:12px;color:#888">{{ r.createdAt }}</td>
              <td>
                <button class="btn btn-success btn-sm" @click="approveReg(r)" v-if="r.status==='pending'||r.status==='reviewing'">✓ 通过</button>
                <button class="btn btn-danger btn-sm" style="margin-left:6px" @click="rejectReg(r)" v-if="r.status==='pending'||r.status==='reviewing'">✕ 拒绝</button>
                <span v-else style="color:#aaa;font-size:12px">已处理</span>
              </td>
            </tr>
            <tr v-if="!allRegs.length">
              <td colspan="8">
                <div class="empty-state"><div class="empty-icon">✅</div><p>暂无报备记录</p></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 渠道商审核（仅超级管理员） -->
    <div v-if="activeTab==='partner' && isSuperAdmin" class="card">
      <div class="card-header">
        <div class="card-title">🤝 渠道商审核</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>渠道商编号</th><th>公司名称</th><th>所属区域</th><th>级别</th><th>联系人</th><th>状态</th><th>提交日期</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="p in pendingPartners" :key="p.id">
              <td style="font-family:monospace;font-size:12px;color:#888">{{ p.id }}</td>
              <td style="font-weight:600">{{ p.name }}</td>
              <td><span class="tag tag-purple" style="font-size:11px">{{ p.region }}</span></td>
              <td><span class="tag" :class="levelClass(p.level)">{{ levelLabel(p.level) }}</span></td>
              <td>{{ p.contact }} {{ p.phone }}</td>
              <td><span class="tag" :class="sClass(p.status)">{{ sLabel(p.status) }}</span></td>
              <td style="font-size:12px;color:#888">{{ p.joinDate }}</td>
              <td>
                <button class="btn btn-success btn-sm" @click="approvePartner(p)" v-if="p.status==='pending'">✓ 通过</button>
                <button class="btn btn-danger btn-sm" style="margin-left:6px" @click="rejectPartner(p)" v-if="p.status==='pending'">✕ 拒绝</button>
                <span v-else style="color:#aaa;font-size:12px">已处理</span>
              </td>
            </tr>
            <tr v-if="!pendingPartners.length">
              <td colspan="8">
                <div class="empty-state"><div class="empty-icon">✅</div><p>暂无待审核渠道商</p></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 员工审核（仅超级管理员） -->
    <div v-if="activeTab==='staff' && isSuperAdmin" class="card">
      <div class="card-header">
        <div class="card-title">👤 渠道商员工审核</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>员工编号</th><th>姓名</th><th>所属渠道商</th><th>职位</th><th>联系方式</th><th>状态</th><th>提交日期</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="s in pendingStaff" :key="s.id">
              <td style="font-family:monospace;font-size:12px;color:#888">{{ s.id }}</td>
              <td style="font-weight:600">{{ s.name }}</td>
              <td><span class="tag tag-blue" style="font-size:11px">{{ s.partnerName }}</span></td>
              <td>{{ s.role }}</td>
              <td>{{ s.phone }}</td>
              <td><span class="tag" :class="sClass(s.status)">{{ sLabel(s.status) }}</span></td>
              <td style="font-size:12px;color:#888">{{ s.createdAt }}</td>
              <td>
                <button class="btn btn-success btn-sm" @click="approveStaff(s)" v-if="s.status==='pending'">✓ 通过</button>
                <button class="btn btn-danger btn-sm" style="margin-left:6px" @click="rejectStaff(s)" v-if="s.status==='pending'">✕ 拒绝</button>
                <span v-else style="color:#aaa;font-size:12px">已处理</span>
              </td>
            </tr>
            <tr v-if="!pendingStaff.length">
              <td colspan="8">
                <div class="empty-state"><div class="empty-icon">✅</div><p>暂无待审核员工</p></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>`,
  setup() {
    const activeTab = ref('registration');
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    const isSuperAdmin = computed(() => store.user?.role === 'superadmin');
    
    // 区域管理员只看本区域报备；超级管理员看全部
    const allRegs = computed(() => adminRegion.value
      ? store.registrations.filter(r => r.region === adminRegion.value)
      : store.registrations);
    
    // 待审核报备数
    const pendingRegCount = computed(() => allRegs.value.filter(r => r.status === 'pending' || r.status === 'reviewing').length);
    
    // 待审核渠道商（仅超级管理员可见）
    const pendingPartners = computed(() => store.partners.filter(p => p.status === 'pending' || p.status === 'rejected'));
    const pendingPartnerCount = computed(() => store.partners.filter(p => p.status === 'pending').length);
    
    // 待审核员工（仅超级管理员可见）- 从所有渠道商中收集pending状态的员工
    const pendingStaff = computed(() => {
      const list = [];
      store.partners.forEach(p => {
        if (p.staff) {
          p.staff.forEach(s => {
            if (s.status === 'pending' || s.status === 'rejected') {
              list.push({ ...s, partnerName: p.name, partnerId: p.id });
            }
          });
        }
      });
      return list;
    });
    const pendingStaffCount = computed(() => {
      let count = 0;
      store.partners.forEach(p => {
        if (p.staff) {
          count += p.staff.filter(s => s.status === 'pending').length;
        }
      });
      return count;
    });
    
    function sClass(s) { return { approved:'tag-green', pending:'tag-orange', reviewing:'tag-blue', expired:'tag-gray', rejected:'tag-red', active:'tag-green' }[s]||'tag-gray'; }
    function sLabel(s) { return { approved:'已通过', pending:'待审核', reviewing:'审核中', expired:'已过期', rejected:'已拒绝', active:'已生效' }[s]||s; }
    function levelClass(lvl) { return { lep:'tag-purple', diamond:'tag-blue', gold:'tag-orange', silver:'tag-gray', bronze:'tag-brown', industry:'tag-green' }[lvl]||'tag-gray'; }
    function levelLabel(lvl) { return { lep:'💎 LEP', diamond:'🔷 钻石', gold:'🥇 金牌', silver:'🥈 银牌', bronze:'🥉 铜牌', industry:'🏭 行业总代' }[lvl]||lvl; }
    
    // 报备审核
    async function approveReg(r) {
      try {
        const result = await apiClient.updateRegistrationStatus(r.id, 'approved', r.remark || '', store.user?.name);
        if (result.success) {
          r.status = 'approved';
          r.approvedAt = result.data.approvedAt;
          r.approvedBy = result.data.approvedBy;
          store.notifications.unshift({ id:Date.now(), title:'报备审批通过', desc:`${r.customer} 已审批通过`, time:'刚刚', unread:true });
        } else {
          alert('审批失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        alert('审批失败：' + err.message);
      }
    }
    async function rejectReg(r) { 
      try {
        const result = await apiClient.updateRegistrationStatus(r.id, 'rejected', r.remark || '', store.user?.name);
        if (result.success) {
          r.status = 'rejected';
        } else {
          alert('拒绝失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        alert('拒绝失败：' + err.message);
      }
    }
    
    // 渠道商审核
    async function approvePartner(p) {
      try {
        const result = await apiClient.updatePartnerStatus(p.id, 'active', '', store.user?.name);
        if (result.success) {
          p.status = 'active';
          p.approvedAt = result.data.approvedAt;
          p.approvedBy = result.data.approvedBy;
          store.notifications.unshift({ id:Date.now(), title:'渠道商审批通过', desc:`${p.name} 已审批通过`, time:'刚刚', unread:true });
        } else {
          alert('审批失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        alert('审批失败：' + err.message);
      }
    }
    async function rejectPartner(p) { 
      try {
        const result = await apiClient.updatePartnerStatus(p.id, 'rejected', '', store.user?.name);
        if (result.success) {
          p.status = 'rejected';
        } else {
          alert('拒绝失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        alert('拒绝失败：' + err.message);
      }
    }
    
    // 员工审核
    async function approveStaff(s) {
      try {
        const result = await apiClient.updateUser(s.userId || s.id, { status: 'active' });
        if (result.success) {
          s.status = 'active';
          store.notifications.unshift({ id:Date.now(), title:'员工审批通过', desc:`${s.name} 已审批通过`, time:'刚刚', unread:true });
        } else {
          alert('审批失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        alert('审批失败：' + err.message);
      }
    }
    async function rejectStaff(s) { 
      try {
        const result = await apiClient.updateUser(s.userId || s.id, { status: 'rejected' });
        if (result.success) {
          s.status = 'rejected';
        } else {
          alert('拒绝失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        alert('拒绝失败：' + err.message);
      }
    }
    
    return { activeTab, adminRegion, isSuperAdmin, allRegs, pendingPartners, pendingStaff,
      pendingRegCount, pendingPartnerCount, pendingStaffCount,
      sClass, sLabel, levelClass, levelLabel,
      approveReg, rejectReg, approvePartner, rejectPartner, approveStaff, rejectStaff };
  }
};

// ── 商机管理 — 列表/看板 ────────────────────────────────────
// STAGES, stageLabel, stageDot, stageTagClass, probColor 已在前面定义

const OpportunityList = {
  template: `
  <div>
    <!-- 顶部筛选 -->
    <div class="search-bar">
      <div class="search-input-wrap" style="min-width:220px">
        <span class="search-icon">🔍</span>
        <input class="form-control" v-model="kw" placeholder="搜索商机名称、客户..."/>
      </div>
      <select class="form-control" v-model="stageFilter" style="width:120px">
        <option value="">全部阶段</option>
        <option v-for="s in STAGES" :key="s.key" :value="s.key">{{ s.label }}</option>
      </select>
      <select class="form-control" v-model="customerFilter" style="width:180px">
        <option value="">全部客户</option>
        <option v-for="r in approvedRegs" :key="r.id" :value="r.id">{{ r.customer }}</option>
      </select>
      <select class="form-control" v-model="viewMode" style="width:110px">
        <option value="list">📋 列表视图</option>
        <option value="kanban">📌 看板视图</option>
      </select>
      <span v-if="adminRegion" class="tag tag-blue" style="padding:6px 12px;font-size:13px">📍 {{ adminRegion }}</span>
      <button class="btn btn-default" @click="$router.push('/registration/new')" style="white-space:nowrap">📋 报备客户</button>
      <button class="btn btn-primary" @click="$router.push('/opportunity/new')" style="white-space:nowrap">➕ 新建商机</button>
    </div>

    <!-- 列表视图 -->
    <div class="card" v-if="viewMode==='list'">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>商机名称</th><th>客户</th><th>阶段</th><th>金额</th><th>预计关闭</th><th>最近跟进</th><th>负责人</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="o in filtered" :key="o.id" style="cursor:pointer" @click="openDetail(o)">
              <td>
                <div style="font-weight:600;color:#1a1a1a">{{ o.name }}</div>
                <div style="font-size:11px;color:#aaa;margin-top:2px">
                  <span v-for="t in o.tags" :key="t" class="tag tag-gray" style="font-size:10px;padding:0 5px;margin-right:3px">{{ t }}</span>
                </div>
              </td>
              <td>
                <div style="font-weight:500">{{ o.customer }}</div>
                <div style="font-size:11px;color:#aaa">{{ o.contact }} {{ o.phone }}</div>
              </td>
              <td>
                <span class="tag" :class="stageTagClass(o.stage)">
                  <span :style="{width:'7px',height:'7px',borderRadius:'50%',background:stageDot(o.stage),display:'inline-block',marginRight:'4px'}"></span>
                  {{ stageLabel(o.stage) }}
                </span>
              </td>
              <td style="font-weight:700;color:#1677ff">{{ fmt(o.amount) }}</td>
              <td style="font-size:12px" :style="{color: isOverdue(o)?'#ff4d4f':'#888'}">
                {{ o.expectedClose }}
                <span v-if="isOverdue(o)" style="display:block;font-size:11px;color:#ff4d4f">⚠️ 已逾期</span>
              </td>
              <td style="font-size:12px;color:#888">{{ o.lastFollowAt }}</td>
              <td><span class="tag tag-gray" style="font-size:11px">{{ o.assignedStaffName || o.createdByName || o.owner || '—' }}</span></td>
              <td @click.stop>
                <button class="btn btn-text btn-sm" @click="openFollow(o)">跟进</button>
              </td>
            </tr>
            <tr v-if="!filtered.length"><td colspan="9"><div class="empty-state"><div class="empty-icon">🎯</div><p>暂无商机记录</p></div></td></tr>
          </tbody>
        </table>
      </div>
      <!-- 合计 -->
      <div v-if="filtered.length" style="display:flex;gap:24px;padding:12px 16px;background:#fafafa;border-top:1px solid #f0f0f0;font-size:13px">
        <span style="color:#888">共 <b>{{ filtered.length }}</b> 条商机</span>
        <span style="color:#888">合计金额：<b style="color:#1677ff">{{ fmt(filtered.reduce((s,o)=>s+o.amount,0)) }}</b></span>
      </div>
    </div>

    <!-- 看板视图 -->
    <div v-if="viewMode==='kanban'" style="display:flex;gap:14px;overflow-x:auto;padding-bottom:8px">
      <div v-for="s in STAGES" :key="s.key" style="min-width:240px;flex-shrink:0">
        <div :style="{background:s.color,borderRadius:'10px 10px 0 0',padding:'12px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}">
          <span style="font-size:13px;font-weight:700">{{ s.label }}</span>
          <span class="badge badge-primary" style="font-size:11px;background:rgba(0,0,0,.08);color:#333">{{ byStage(s.key).length }}</span>
        </div>
        <div style="background:#f8f9fa;border:1px solid #eee;border-top:none;border-radius:0 0 10px 10px;min-height:300px;padding:8px">
          <div v-for="o in byStage(s.key)" :key="o.id"
            style="background:#fff;border-radius:8px;padding:12px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,.06);cursor:pointer;transition:box-shadow .2s"
            @click="openDetail(o)"
            @mouseenter="$event.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.12)'"
            @mouseleave="$event.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.06)'">
            <div style="font-size:13px;font-weight:700;margin-bottom:6px;color:#1a1a1a">{{ o.name }}</div>
            <div style="font-size:12px;color:#888;margin-bottom:8px">{{ o.customer }}</div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:14px;font-weight:800;color:#1677ff">{{ fmt(o.amount) }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:#bbb">
              <span>{{ o.owner }}</span>
              <span>{{ o.expectedClose }}</span>
            </div>
          </div>
          <div v-if="!byStage(s.key).length" style="text-align:center;padding:20px;color:#ccc;font-size:12px">暂无商机</div>
        </div>
        <div :style="{background:s.color,padding:'8px 14px',borderRadius:'0 0 10px 10px',textAlign:'right',fontSize:'12px',color:'#888',borderTop:'1px solid rgba(0,0,0,.05)'}">
          {{ fmt(byStage(s.key).reduce((sum,o)=>sum+o.amount,0)) }}
        </div>
      </div>
    </div>

    <!-- 商机详情抽屉 -->
    <div class="modal-overlay" v-if="detail" @click.self="detail=null">
      <div class="modal modal-xl" style="height:85vh;display:flex;flex-direction:column">
        <div class="modal-header">
          <div class="modal-title">{{ canEditOpportunityName ? (editName || detail.name) : detail.name }}</div>
          <span class="modal-close" @click="detail=null">✕</span>
        </div>
        <div style="flex:1;overflow:hidden;display:flex">
          <!-- 左：基本信息 -->
          <div style="width:320px;flex-shrink:0;border-right:1px solid #f0f0f0;overflow-y:auto;padding:20px">
            <div style="margin-bottom:16px">
              <span class="tag" :class="stageTagClass(detail.stage)" style="font-size:13px;padding:4px 12px">{{ stageLabel(detail.stage) }}</span>
            </div>
            <div class="form-item" style="margin-bottom:14px">
              <label class="form-label">商机名称</label>
              <input v-if="canEditOpportunityName" class="form-control" v-model.trim="editName" placeholder="请输入商机名称" />
              <div v-else style="font-weight:600;padding-top:4px">{{ detail.name }}</div>
            </div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">客户名称</label><div style="font-weight:600;padding-top:4px">{{ detail.customer }}</div></div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">联系人</label><div style="padding-top:4px">{{ detail.contact }} &nbsp; {{ detail.phone }}</div></div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">行业</label><div style="padding-top:4px">{{ detail.industry }}</div></div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">商机金额</label><div style="font-size:22px;font-weight:800;color:#1677ff;padding-top:4px">{{ fmt(detail.amount) }}</div></div>
            <div class="form-item" style="margin-bottom:14px">
              <label class="form-label">预计签约</label>
              <input class="form-control" type="date" v-model="editExpectedClose" />
            </div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">来源</label><div style="padding-top:4px">{{ detail.source }}</div></div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">负责人</label><div style="padding-top:4px">{{ detail.owner }}</div></div>
            <div v-if="detail.tags?.length" class="form-item" style="margin-bottom:14px">
              <label class="form-label">标签</label>
              <div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:6px">
                <span v-for="t in detail.tags" :key="t" class="tag tag-blue" style="font-size:11px">{{ t }}</span>
              </div>
            </div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">备注</label><div style="padding-top:4px;font-size:13px;color:#555;line-height:1.6">{{ detail.notes || '—' }}</div></div>
            <!-- 关联 -->
            <div v-if="detail.regId||detail.quoteId" style="border-top:1px solid #f0f0f0;padding-top:14px;margin-top:4px">
              <div style="font-size:12px;font-weight:700;color:#888;margin-bottom:10px">关联记录</div>
              <div v-if="detail.regId" style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
                <span style="color:#888">客户报备</span>
                <span style="color:#1677ff;cursor:pointer" @click="$router.push('/registration');detail=null">{{ detail.regId }}</span>
              </div>
              <div v-if="detail.quoteId" style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
                <span style="color:#888">报价单</span>
                <span style="color:#1677ff;cursor:pointer;font-weight:500" @click="openQuoteDetailModal(detail.quoteId)">📄 {{ detail.quoteId }}（点击查看详情）</span>
              </div>
              <div v-else-if="detail.stage === 'won' || detail.stage === 'closing'" style="font-size:12px;color:#faad14;background:#fffbe6;padding:8px 12px;border-radius:6px;margin-bottom:8px">
                💡 商机已赢单但尚未创建报价单，可点击下方「创建报价单」生成
              </div>
            </div>
          </div>
          <!-- 右：跟进记录 -->
          <div style="flex:1;overflow-y:auto;padding:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
              <div style="font-size:14px;font-weight:700">跟进记录</div>
              <button class="btn btn-primary btn-sm" @click="openFollow(detail)">+ 记录跟进</button>
            </div>
            <!-- 阶段推进 -->
            <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
              <div v-for="s in STAGES" :key="s.key"
                :style="{padding:'6px 14px',borderRadius:'20px',fontSize:'12px',cursor:'pointer',fontWeight:detail.stage===s.key?'700':'400',background:detail.stage===s.key?s.dot:'#f5f5f5',color:detail.stage===s.key?'#fff':'#555',transition:'all .2s'}"
                @click="changeStage(s.key)">
                {{ s.label }}
              </div>
            </div>
            <div class="timeline" v-if="detail.followUps?.length">
              <div v-for="(f,i) in detail.followUps" :key="f.id" class="timeline-item">
                <div class="timeline-dot-wrap">
                  <div class="timeline-dot"></div>
                  <div class="timeline-line" v-if="i < (detail.followUps?.length || 0) - 1"></div>
                </div>
                <div class="timeline-content" style="padding-bottom:16px">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                    <span class="tag tag-blue" style="font-size:11px">{{ f.type }}</span>
                    <span style="font-size:12px;color:#aaa">{{ f.date }} · {{ f.user }}</span>
                  </div>
                  <div style="font-size:13.5px;color:#333;line-height:1.7;background:#f8f9fa;border-radius:8px;padding:12px">{{ f.content }}</div>
                </div>
              </div>
            </div>
            <div v-else class="empty-state" style="padding:40px"><div class="empty-icon">📝</div><p>暂无跟进记录，点击"记录跟进"开始</p></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="detail=null">关闭</button>
          <button class="btn btn-primary" @click="saveExpectedClose" :disabled="savingExpectedClose">{{ savingExpectedClose ? '保存中...' : '💾 保存修改' }}</button>
          <button class="btn btn-default" v-if="detail.regId && ['qualification','proposal','negotiation'].includes(detail.stage)" @click="openInlineQuoteModal(detail)">📝 创建报价单</button>
          <button class="btn btn-default" v-if="detail.regId" @click="$router.push('/opportunity/new?regId='+detail.regId);detail=null">📋 再建商机</button>
          <button class="btn btn-primary" v-if="detail.quoteId && ['closing','won'].includes(detail.stage) && !store.orders.find(o=>o.oppId===detail.id)" @click="openWonConfirmModal(detail)">🎉 确认报价转订单</button>
          <button class="btn btn-default" v-if="!detail.quoteId && detail.stage === 'won' && !store.orders.find(o=>o.oppId===detail.id)" @click="openInlineQuoteModal(detail)">📝 创建报价单</button>
          <button class="btn btn-primary" v-if="!detail.quoteId && ['closing','won'].includes(detail.stage) && !store.orders.find(o=>o.oppId===detail.id)" @click="noQuoteAlert" style="background:#fa8c16;border-color:#fa8c16">📦 转订单</button>
          <button class="btn btn-success" v-if="!['won','lost'].includes(detail.stage)" @click="changeStage('won')">🎉 标记赢单</button>
        </div>
      </div>
    </div>

    <!-- 跟进记录弹窗 -->
    <div class="modal-overlay" v-if="followTarget" @click.self="followTarget=null">
      <div class="modal">
        <div class="modal-header"><div class="modal-title">记录跟进 — {{ followTarget.name }}</div><span class="modal-close" @click="followTarget=null">✕</span></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-item"><label class="form-label required">跟进方式</label>
              <select class="form-control" v-model="followForm.type">
                <option>电话</option><option>拜访</option><option>演示</option><option>邮件</option><option>微信</option><option>视频会议</option><option>其他</option>
              </select>
            </div>
            <div class="form-item"><label class="form-label required">跟进日期</label>
              <input class="form-control" type="date" v-model="followForm.date"/>
            </div>
            <div class="form-item"><label class="form-label">推进到阶段</label>
              <select class="form-control" v-model="followForm.newStage">
                <option value="">不变</option>
                <option v-for="s in STAGES" :key="s.key" :value="s.key">{{ s.label }}</option>
              </select>
            </div>
            <div class="form-item"><label class="form-label">下次跟进</label>
              <input class="form-control" type="date" v-model="followForm.nextDate"/>
            </div>
            <div class="form-item full"><label class="form-label required">跟进内容</label>
              <textarea class="form-control" v-model="followForm.content" rows="4" placeholder="本次沟通情况、客户反馈、达成共识、待解决问题..."></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="followTarget=null">取消</button>
          <button class="btn btn-primary" @click="saveFollow" :disabled="!followForm.content||!followForm.date">保存</button>
        </div>
      </div>
    </div>

    <!-- 收货地址弹窗（商机转订单） -->
    <div class="modal-overlay" v-if="showDeliveryModal" @click.self="showDeliveryModal=false">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">📦 转订单 — {{ currentOppForOrder?.name }}</div>
          <span class="modal-close" @click="showDeliveryModal=false">✕</span>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-item full"><label class="form-label required">收货地址</label>
              <input class="form-control" v-model="deliveryForm.addr" placeholder="请输入详细收货地址"/>
            </div>
            <div class="form-item"><label class="form-label required">联系人</label>
              <input class="form-control" v-model="deliveryForm.contact" placeholder="收货人姓名"/>
            </div>
            <div class="form-item"><label class="form-label required">联系电话</label>
              <input class="form-control" v-model="deliveryForm.phone" placeholder="收货人电话"/>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showDeliveryModal=false">取消</button>
          <button class="btn btn-primary" @click="confirmToOrderFromOpp">确认转订单</button>
        </div>
      </div>
    </div>

    <!-- 赢单确认弹窗 -->
    <div class="modal-overlay" v-if="showWonConfirmModal" @click.self="showWonConfirmModal=false">
      <div class="modal" style="max-width:600px">
        <div class="modal-header">
          <div class="modal-title">🎉 赢单确认 — {{ currentWonOpp?.name }}</div>
          <span class="modal-close" @click="showWonConfirmModal=false">✕</span>
        </div>
        <div class="modal-body">
          <div style="background:linear-gradient(135deg,#f6ffed 0%,#e6fffb 100%);border:1px solid #b7eb8f;border-radius:12px;padding:16px 20px;margin-bottom:20px">
            <div style="font-size:14px;font-weight:600;color:#389e0d;margin-bottom:4px">📋 确认最终报价</div>
            <div style="font-size:13px;color:#666">请确认商机「{{ currentWonOpp?.name }}」的最终报价单信息，确认后系统将自动转订单。</div>
            <div style="font-size:12px;color:#888;margin-top:8px">💡 如需修改报价，可点击「修改报价单」进行调整后再确认。</div>
          </div>
          
          <!-- 报价单信息 -->
          <div v-if="wonQuoteData" style="background:#fafafa;border-radius:12px;padding:20px;margin-bottom:20px">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px;margin-bottom:16px">
              <div><div style="font-size:12px;color:#888">报价单号</div><div style="font-weight:600;font-family:monospace">{{ wonQuoteData.id }}</div></div>
              <div><div style="font-size:12px;color:#888">客户名称</div><div style="font-weight:600">{{ wonQuoteData.customer }}</div></div>
              <div><div style="font-size:12px;color:#888">端点数量</div><div style="font-weight:600">{{ getQuoteDisplayEndpoints(wonQuoteData) }} 台</div></div>
              <div><div style="font-size:12px;color:#888">报价总额</div><div style="font-weight:700;font-size:18px;color:#1677ff">{{ fmt(wonQuoteData.total) }}</div></div>
            </div>
            <!-- 关联商机 -->
            <div v-if="wonQuoteData.oppId" style="margin-top:12px;padding-top:12px;border-top:1px dashed #ddd">
              <span style="color:#888;font-size:12px">关联商机：</span>
              <span style="color:#1677ff;font-size:13px">{{ wonQuoteData.oppId }}</span>
            </div>
          </div>
          <div v-else style="background:#fffbe6;border:1px solid #ffe58f;border-radius:10px;padding:14px 16px;margin-bottom:20px">
            <div style="font-size:13px;color:#ad6800">⚠️ 该商机暂无关联报价单，将以商机预计金额 <strong>{{ fmt(currentWonOpp?.amount || 0) }}</strong> 创建订单。</div>
          </div>
          
          <!-- 收货信息 -->
          <div style="background:linear-gradient(135deg,#f8f9fa 0%,#fff 100%);border-radius:16px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04)">
            <div style="font-size:14px;font-weight:700;color:#333;margin-bottom:20px;display:flex;align-items:center;gap:8px">📦 <span>收货信息</span></div>
            <div style="display:grid;gap:16px">
              <div>
                <label style="display:block;font-size:13px;font-weight:500;color:#555;margin-bottom:8px">📍 收货地址 <span style="color:#ff4d4f">*</span></label>
                <input class="form-control" style="padding:12px 14px;font-size:14px;border-radius:10px" v-model="wonDeliveryForm.addr" placeholder="请输入详细收货地址"/>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div>
                  <label style="display:block;font-size:13px;font-weight:500;color:#555;margin-bottom:8px">👤 联系人 <span style="color:#ff4d4f">*</span></label>
                  <input class="form-control" style="padding:12px 14px;font-size:14px;border-radius:10px" v-model="wonDeliveryForm.contact" placeholder="收货人姓名"/>
                </div>
                <div>
                  <label style="display:block;font-size:13px;font-weight:500;color:#555;margin-bottom:8px">📞 联系电话 <span style="color:#ff4d4f">*</span></label>
                  <input class="form-control" style="padding:12px 14px;font-size:14px;border-radius:10px" v-model="wonDeliveryForm.phone" placeholder="收货人电话"/>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showWonConfirmModal=false">取消</button>
          <button class="btn btn-default" v-if="wonQuoteData" @click="editQuoteFromWonConfirm(wonQuoteData)">✏️ 修改报价单</button>
          <button class="btn btn-primary btn-lg" @click="confirmWonAndCreateOrder">🎉 确认报价并转订单</button>
        </div>
      </div>
    </div>

    <!-- 内嵌报价单创建弹窗（从商机推进触发） -->
    <div class="modal-overlay" v-if="showInlineQuote" @click.self="showInlineQuote=false">
      <div class="modal modal-xl" style="max-height:95vh;width:95vw">
        <div class="modal-header">
          <div class="modal-title">📝 为「{{ inlineQuoteOpp?.name }}」创建报价单</div>
          <span class="modal-close" @click="showInlineQuote=false">✕</span>
        </div>
        <div class="modal-body" style="max-height:70vh;overflow-y:auto">
          <!-- 客户信息摘要 -->
          <div style="background:#f6f8ff;border:1px solid #d0e4ff;border-radius:10px;padding:14px 16px;margin-bottom:20px">
            <div style="font-size:13px;font-weight:700;color:#1677ff;margin-bottom:10px">🏢 客户信息</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
              <div><div style="font-size:11px;color:#888">客户名称</div><div style="font-weight:600">{{ inlineQuoteOpp?.customer }}</div></div>
              <div><div style="font-size:11px;color:#888">联系人</div><div style="font-weight:500">{{ inlineQuoteOpp?.contact }}</div></div>
              <div><div style="font-size:11px;color:#888">联系电话</div><div style="font-weight:500">{{ inlineQuoteOpp?.phone }}</div></div>
              <div><div style="font-size:11px;color:#888">端点数量</div><div style="font-weight:600;color:#1677ff">{{ inlineQuoteForm.endpoints }} 台</div></div>
            </div>
          </div>

          <!-- 端点数量 -->
          <div class="form-item" style="margin-bottom:20px">
            <label class="form-label required">端点数量（台）</label>
            <input type="number" class="form-control" v-model="inlineQuoteForm.endpoints" min="1" placeholder="请输入终端设备数量" style="max-width:200px" />
          </div>

          <!-- 报价模式 -->
          <div style="margin-bottom:20px">
            <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:12px">📦 报价模式</div>
            <div style="display:flex;gap:12px">
              <div class="mode-card" :class="{active: inlineQuoteMode === 'package'}" @click="inlineQuoteSetMode('package')">
                <div class="mode-icon">📦</div>
                <div class="mode-title">套餐报价</div>
                <div class="mode-desc">选择标准套餐，快速报价</div>
              </div>
              <div class="mode-card" :class="{active: inlineQuoteMode === 'supplement'}" @click="inlineQuoteSetMode('supplement')" :style="{opacity: inlineSelectedPackage ? 1 : 0.5, cursor: inlineSelectedPackage ? 'pointer' : 'not-allowed'}">
                <div class="mode-icon">➕</div>
                <div class="mode-title">补充功能</div>
                <div class="mode-desc">在套餐基础上添加功能</div>
              </div>
              <div class="mode-card" :class="{active: inlineQuoteMode === 'custom'}" @click="inlineQuoteSetMode('custom')">
                <div class="mode-icon">🎨</div>
                <div class="mode-title">自定义报价</div>
                <div class="mode-desc">自由组合所需功能</div>
              </div>
            </div>
          </div>

          <!-- 套餐选择 -->
          <div v-if="inlineQuoteMode === 'package' || inlineQuoteMode === 'supplement'" style="margin-bottom:20px">
            <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:12px">🎯 选择套餐</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
              <div v-for="pkg in publishedPackages" :key="pkg.id"
                class="package-card" :class="{selected: inlineSelectedPackageId === pkg.id}"
                @click="inlineSelectPackage(pkg)">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                  <span style="font-size:24px">{{ pkg.icon }}</span>
                  <div>
                    <div style="font-weight:700;font-size:14px">{{ pkg.name }}</div>
                    <div style="font-size:11px;color:#888">{{ (pkg.featureIds || []).length }} 个功能</div>
                  </div>
                  <div style="margin-left:auto;font-weight:700;color:#1677ff">{{ fmt(getPackagePrice(pkg, inlineQuoteForm.endpoints)) }}</div>
                </div>
                <div style="font-size:12px;color:#666;line-height:1.5">{{ pkg.desc }}</div>
              </div>
            </div>
          </div>

          <!-- 补充功能选择 -->
          <div v-if="inlineQuoteMode === 'supplement' && inlineSelectedPackage" style="margin-bottom:20px">
            <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:12px">➕ 选择补充功能（在「{{ inlineSelectedPackage.name }}」基础上）</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              <div v-for="f in inlineSupplementOptions" :key="f.id"
                class="feature-chip" :class="{selected: inlineSupplementFeatures.includes(f.id)}"
                @click="toggleInlineSupplement(f.id)">
                <span>{{ f.name }}</span>
                <span style="color:#1677ff;font-weight:600">+{{ fmt(getFeaturePriceById(f.id)) }}</span>
              </div>
            </div>
          </div>

          <!-- 自选功能 -->
          <div v-if="inlineQuoteMode === 'custom'" style="margin-bottom:20px">
            <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:12px">🎨 选择功能模块</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              <div v-for="f in allFeatures" :key="f.id"
                class="feature-chip" :class="{selected: inlineCustomFeatures.includes(f.id)}"
                @click="toggleInlineCustom(f.id)">
                <span>{{ f.name }}</span>
                <span style="color:#1677ff;font-weight:600">{{ fmt(getFeaturePriceById(f.id)) }}</span>
              </div>
            </div>
          </div>

          <!-- 硬件选择 -->
          <div v-if="publishedHardware.length" style="margin-bottom:20px">
            <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:12px">🖥️ 硬件设备</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              <div v-for="h in publishedHardware" :key="h.id"
                class="feature-chip hardware" :class="{selected: inlineSelectedHardware.includes(h.id)}"
                @click="toggleInlineHardware(h.id)">
                <span>{{ h.name }}</span>
                <span style="color:#fa8c16;font-weight:600">{{ fmt(h.price || 0) }}</span>
              </div>
            </div>
          </div>

          <!-- 报价汇总 -->
          <div v-if="inlineQuoteMode === 'package' || inlineQuoteMode === 'supplement' || inlineQuoteMode === 'custom'" style="background:#fafafa;border-radius:12px;padding:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
              <span style="font-size:15px;font-weight:700;color:#1a1a1a">💰 报价汇总</span>
              <span style="font-size:13px;color:#666">端点数：<strong style="color:#1677ff;font-size:16px">{{ inlineQuoteForm.endpoints || '—' }}</strong></span>
            </div>
            
            <div v-if="inlineSelectedPackage" style="margin-bottom:12px;padding:12px;background:#fff;border-radius:8px">
              <div style="font-weight:600;margin-bottom:8px">{{ inlineSelectedPackage.icon }} {{ inlineSelectedPackage.name }}</div>
              <div style="font-size:13px;color:#888">{{ (inlineSelectedPackage.featureIds || []).length }} 个功能</div>
              <div style="font-size:18px;font-weight:700;color:#1677ff;margin-top:8px">{{ fmt(inlinePackagePrice) }}</div>
            </div>
            
            <div v-if="inlineSupplementFeatures.length" style="margin-bottom:12px;padding:10px 12px;background:#fff;border-radius:8px">
              <div style="font-size:12px;color:#888;margin-bottom:6px">补充功能</div>
              <div v-for="fid in inlineSupplementFeatures" :key="fid" style="display:flex;justify-content:space-between;font-size:13px">
                <span>{{ getFeatureName(fid) }}</span>
                <span style="color:#1677ff;font-weight:600">{{ fmt(getFeaturePriceById(fid)) }}</span>
              </div>
            </div>
            
            <div v-if="inlineCustomFeatures.length" style="margin-bottom:12px;padding:10px 12px;background:#fff;border-radius:8px">
              <div style="font-size:12px;color:#888;margin-bottom:6px">自选功能</div>
              <div v-for="fid in inlineCustomFeatures" :key="fid" style="display:flex;justify-content:space-between;font-size:13px">
                <span>{{ getFeatureName(fid) }}</span>
                <span style="color:#1677ff;font-weight:600">{{ fmt(getFeaturePriceById(fid)) }}</span>
              </div>
            </div>

            <div style="margin-bottom:12px;padding:10px 12px;background:#fff;border-radius:8px">
              <div style="font-size:12px;color:#888;margin-bottom:6px">赠送服务</div>
              <div style="display:flex;justify-content:space-between;font-size:13px">
                <span>标准质保服务（赠送1年）</span>
                <span style="display:flex;align-items:center;gap:8px">
                  <span style="color:#666">1 年</span>
                  <span style="color:#52c41a;font-weight:600">{{ fmt(0) }}</span>
                </span>
              </div>
            </div>
            
            <div v-if="inlineSelectedHardware.length" style="margin-bottom:12px;padding:10px 12px;background:#fff;border-radius:8px">
              <div style="font-size:12px;color:#888;margin-bottom:6px">硬件设备</div>
              <div v-for="hid in inlineSelectedHardware" :key="hid" style="display:flex;justify-content:space-between;font-size:13px">
                <span>{{ getHardwareNameById(hid) }}</span>
                <span style="color:#fa8c16;font-weight:600">{{ fmt(getHardwarePriceById(hid)) }}</span>
              </div>
            </div>
            
            <div class="grand-total-box" style="margin-top:12px">
              <div class="total-row"><span>软件小计</span><span>{{ fmt(inlineSubTotal) }}</span></div>
              <div v-if="inlineHardwareTotal > 0" class="total-row"><span>硬件合计</span><span style="color:#fa8c16">{{ fmt(inlineHardwareTotal) }}</span></div>
              <div class="total-row grand"><span>报价总额</span><span style="font-size:22px">{{ fmt(inlineGrandTotal) }}</span></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showInlineQuote=false">取消</button>
          <button class="btn btn-primary btn-lg" @click="saveInlineQuote" :disabled="!inlineCanSave">
            <span v-if="!inlineCanSave">请完善信息</span>
            <span v-else>💾 生成报价单</span>
          </button>
        </div>
      </div>
    </div>
  
  <!-- 报价单详情弹窗 -->
  <div class="modal-overlay" v-if="showQuoteDetailModal" @click.self="showQuoteDetailModal=false">
    <div class="modal modal-xl" style="max-height:85vh;width:90vw">
      <div class="modal-header">
        <div class="modal-title">📋 报价单详情 — {{ quoteDetailData?.id }}</div>
        <span class="modal-close" @click="showQuoteDetailModal=false">✕</span>
      </div>
      <div class="modal-body" style="max-height:65vh;overflow-y:auto">
        <!-- 基本信息 -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px">
          <div style="background:#f6f8ff;border-radius:8px;padding:14px">
            <div style="font-size:11px;color:#888;margin-bottom:4px">客户名称</div>
            <div style="font-weight:600;font-size:15px">{{ quoteDetailData?.customer }}</div>
          </div>
          <div style="background:#f6f8ff;border-radius:8px;padding:14px">
            <div style="font-size:11px;color:#888;margin-bottom:4px">端点数量</div>
            <div style="font-weight:600;font-size:15px">{{ getQuoteDisplayEndpoints(quoteDetailData) }} 台</div>
          </div>
          <div style="background:#f6f8ff;border-radius:8px;padding:14px">
            <div style="font-size:11px;color:#888;margin-bottom:4px">报价总额</div>
            <div style="font-weight:700;font-size:18px;color:#1677ff">{{ fmt(quoteDetailData?.total || 0) }}</div>
          </div>
          <div style="background:#f6f8ff;border-radius:8px;padding:14px">
            <div style="font-size:11px;color:#888;margin-bottom:4px">报价模式</div>
            <div style="font-weight:600;font-size:14px">{{ quoteDetailData?.quoteMode === 'package' ? '📦 套餐报价' : quoteDetailData?.quoteMode === 'supplement' ? '➕ 补充功能' : '🎨 自定义报价' }}</div>
          </div>
        </div>
        <div v-if="quoteDetailData?.standardPersonDays !== undefined && quoteDetailData?.standardPersonDays !== null" style="margin-bottom:20px;padding:16px;border-radius:12px;background:#f6ffed;border:1px solid #b7eb8f">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
            <div>
              <div style="font-size:14px;font-weight:700;color:#237804">标准工作量建议</div>
              <div style="font-size:12px;color:#666;margin-top:4px">{{ quoteDetailData?.workloadSummary || '按报价快照展示' }}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:24px;font-weight:700;color:#237804">{{ quoteDetailData?.standardPersonDays }}</div>
              <div style="font-size:12px;color:#666">人天</div>
            </div>
          </div>
        </div>
        <!-- 明细表格 -->
        <div style="background:#fff;border:1px solid #e8e8e8;border-radius:10px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#fafafa">
                <th style="padding:12px 16px;text-align:left;font-size:12px;color:#888;font-weight:600">项目名称</th>
                <th style="padding:12px 16px;text-align:center;font-size:12px;color:#888;font-weight:600">类型</th>
                <th style="padding:12px 16px;text-align:center;font-size:12px;color:#888;font-weight:600">数量</th>
                <th style="padding:12px 16px;text-align:right;font-size:12px;color:#888;font-weight:600">小计(元/年)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in quoteDetailItems" :key="idx" style="border-top:1px solid #f0f0f0">
                <td style="padding:12px 16px;font-size:13px;font-weight:500">{{ item.name }}</td>
                <td style="padding:12px 16px;text-align:center">
                  <span class="tag" :class="item.type === '硬件' ? 'tag-orange' : 'tag-blue'" style="font-size:11px">{{ item.type }}</span>
                </td>
                <td style="padding:12px 16px;text-align:center;font-size:13px">{{ item.qtyDisplay || item.qty }}</td>
                <td style="padding:12px 16px;text-align:right;font-size:13px;font-weight:600;color:#1677ff">{{ fmt(item.subtotal) }}</td>
              </tr>
              <tr v-if="!quoteDetailItems.length">
                <td colspan="4" style="padding:24px;text-align:center;color:#aaa">暂无明细数据</td>
              </tr>
            </tbody>
            <tfoot>
              <tr style="background:#f0f7ff">
                <td colspan="3" style="padding:14px 16px;text-align:right;font-size:14px;font-weight:700;color:#333">报价总额（含税）</td>
                <td style="padding:14px 16px;text-align:right;font-size:18px;font-weight:700;color:#1677ff">{{ fmt(quoteDetailData?.total || 0) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <!-- 附加信息 -->
        <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div style="background:#fafafa;border-radius:8px;padding:14px">
            <div style="font-size:11px;color:#888;margin-bottom:6px">关联商机</div>
            <div style="font-size:13px;font-weight:500">{{ quoteDetailData?.oppId || '—' }}</div>
          </div>
          <div style="background:#fafafa;border-radius:8px;padding:14px">
            <div style="font-size:11px;color:#888;margin-bottom:6px">创建时间</div>
            <div style="font-size:13px;font-weight:500">{{ quoteDetailData?.createdAt || quoteDetailData?.date || '—' }}</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" @click="showQuoteDetailModal=false">关闭</button>
        <button class="btn btn-primary" v-if="detail && detail.stage !== 'lost'" @click="showQuoteDetailModal=false;openInlineQuoteModal(detail)">📝 修改报价单</button>
      </div>
    </div>
  </div>`,
  setup() {
    const router = VueRouter.useRouter();
    const kw = ref('');
    const stageFilter = ref('');
    const customerFilter = ref('');
    const viewMode = ref('list');
    const detail = ref(null);
    const followTarget = ref(null);
    const followForm = reactive({ type:'电话', date: today(), content:'', newStage:'', nextDate:'' });
    const loading = ref(false);

    // 产品目录数据（供内嵌报价单使用）
    const allFeatures = ref([]);
    const publishedPackages = ref([]);
    const publishedHardware = ref([]);
    
    // 加载产品目录数据
    async function loadProductCatalog() {
      try {
        const [treeRes, featRes, pkgRes, hwRes] = await Promise.all([
          fetch(`${window.API_BASE}/product-tree?published=true`).then(r => r.json()),
          fetch(`${window.API_BASE}/features`).then(r => r.json()),
          fetch(`${window.API_BASE}/packages?published=true`).then(r => r.json()),
          fetch(`${window.API_BASE}/hardware`).then(r => r.json())
        ]);
        if (treeRes.success) {
          const features = [];
          (treeRes.data || []).forEach(cat => {
            (cat.modules || []).forEach(mod => {
              mod.features?.forEach(feat => {
                features.push({ ...feat, moduleName: mod.name, categoryId: cat.id });
              });
            });
          });
          allFeatures.value = features;
        }
        if (featRes.success) {
          featRes.data?.forEach(f => {
            if (!allFeatures.value.find(x => x.id === f.id)) {
              allFeatures.value.push(f);
            }
          });
        }
        if (pkgRes.success) publishedPackages.value = pkgRes.data || [];
        if (hwRes.success) publishedHardware.value = hwRes.data || [];
      } catch (err) {
        console.error('加载产品目录失败:', err);
      }
    }

    // 区域管理员隔离
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    // 员工隔离：统一使用 id 字段（与后端数据一致）
    const userId = computed(() => store.user?.id || '');
    const isStaff = computed(() => store.user?.role === 'staff' || store.user?.role === 'partner_admin');
    
    // 辅助函数：获取报备的区域
    function getRegRegion(regId) {
      const reg = store.registrations.find(r => r.id === regId);
      return reg ? reg.region : null;
    }
    
    // 加载商机列表
    async function loadOpportunities() {
      loading.value = true;
      try {
        const result = await apiClient.getOpportunities();
        if (result.success && result.data) {
          // 【防御性修复】确保每条商机 followUps 和 tags 始终为数组
          result.data.forEach(opp => {
            if (!Array.isArray(opp.followUps)) opp.followUps = [];
            if (!Array.isArray(opp.tags)) opp.tags = [];
          });
          // 检查是否需要替换（当 store 是初始 mock 数据或为空时）
          const isMockData = store.opportunities.some(o => o.id?.startsWith('OPP-2026-'));
          if (isMockData || store.opportunities.length === 0) {
            // 直接替换为后端数据
            store.opportunities = result.data;
          } else {
            // 合并后端数据到本地 store，更新已有数据，添加新数据
            const existingMap = new Map(store.opportunities.map(o => [o.id, o]));
            result.data.forEach(opp => {
              if (existingMap.has(opp.id)) {
                // 更新已有数据（保留响应式引用）
                Object.assign(existingMap.get(opp.id), opp);
              } else {
                // 添加新数据
                store.opportunities.push(opp);
              }
            });
          }
        }
      } catch (err) {
        console.error('加载商机列表失败:', err);
      } finally {
        loading.value = false;
      }
    }
    
    // 页面加载时获取商机列表
    onMounted(() => {
      loadOpportunities();
    });

    // 已审批客户列表（用于筛选下拉）
    const approvedRegs = computed(() => {
      let list = store.registrations.filter(r => r.status === 'approved');
      const partnerId = store.user?.partnerId;
      const isPartnerAdmin = store.user?.role === 'partner_admin';
      // 企业管理员（partner_admin）：看本企业的全部报备
      if (isPartnerAdmin && partnerId) {
        return list.filter(r => r.partnerId === partnerId);
      }
      // 普通员工：自己创建的 + 被指派给自己的
      if (isStaff.value) {
        return list.filter(r =>
          r.createdBy === userId.value ||
          r.owner === userId.value ||
          r.assignedStaffId === userId.value ||
          r.assignedStaffUserId === userId.value
        );
      }
      if (adminRegion.value) {
        return list.filter(r => r.region === adminRegion.value);
      }
      return list;
    });

    // 本区域商机（管理员）或本人的商机（员工）
    const myOpportunities = computed(() => {
      const partnerId = store.user?.partnerId;
      const isPartnerAdmin = store.user?.role === 'partner_admin';
      // 企业管理员（partner_admin）：看本企业的全部商机
      if (isPartnerAdmin && partnerId) {
        return store.opportunities.filter(o => o.partnerId === partnerId);
      }
      // 普通员工：自己创建的 + 被指派给自己的
      if (isStaff.value) {
        return store.opportunities.filter(o => 
          o.ownerId === userId.value || 
          o.createdBy === userId.value ||
          o.assignedStaffId === userId.value
        );
      }
      if (adminRegion.value) {
        // 区域管理员看本区域商机
        return store.opportunities.filter(o => {
          const region = getRegRegion(o.regId);
          return region === adminRegion.value;
        });
      }
      // 超级管理员看全部
      return store.opportunities;
    });

    const filtered = computed(() => myOpportunities.value.filter(o => {
      const mK = !kw.value || o.name.includes(kw.value) || o.customer.includes(kw.value);
      const mS = !stageFilter.value || o.stage === stageFilter.value;
      const mC = !customerFilter.value || o.regId === customerFilter.value;
      return mK && mS && mC;
    }));

    function byStage(stage) { return myOpportunities.value.filter(o=>o.stage===stage); }
    function isOverdue(o) {
      return !['won','lost'].includes(o.stage) && new Date(o.expectedClose) < new Date();
    }
    const canEditOpportunityName = computed(() => store.user?.role === 'admin' || store.user?.role === 'superadmin');
    const editName = ref('');
    const editExpectedClose = ref('');
    const savingExpectedClose = ref(false);
    function openDetail(o) {
      detail.value = o;
      editName.value = o.name || '';
      editExpectedClose.value = o.expectedClose || '';
    }
    async function saveExpectedClose() {
      if (!detail.value) return;
      if (canEditOpportunityName.value && !editName.value.trim()) {
        alert('商机名称不能为空');
        return;
      }
      savingExpectedClose.value = true;
      try {
        const updates = {
          expectedClose: editExpectedClose.value || ''
        };
        if (canEditOpportunityName.value) {
          updates.name = editName.value.trim();
        }
        const result = await apiClient.updateOpportunity(detail.value.id, updates);
        if (result.success) {
          const updatedOpportunity = result.data || updates;
          Object.assign(detail.value, updatedOpportunity);
          const idx = store.opportunities.findIndex(x => x.id === detail.value.id);
          if (idx !== -1) Object.assign(store.opportunities[idx], updatedOpportunity);
          editName.value = detail.value.name || '';
          editExpectedClose.value = detail.value.expectedClose || '';
          alert('保存成功');
        } else {
          alert('保存失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        console.error('保存预计签约时间失败:', err);
        alert('保存失败，请检查网络连接');
      } finally {
        savingExpectedClose.value = false;
      }
    }
    function openFollow(o) {
      followTarget.value = o;
      followForm.type = '电话'; followForm.date = today(); followForm.content = ''; followForm.newStage = ''; followForm.nextDate = '';
    }
    async function saveFollow() {
      const newFollow = {
        id: Date.now(),
        date: followForm.date,
        type: followForm.type,
        content: followForm.content,
        user: store.user?.name?.slice(0,4) || '销售',
      };
      
      // 更新本地数据
      followTarget.value.followUps.unshift(newFollow);
      followTarget.value.lastFollowAt = followForm.date;
      if (followForm.newStage) followTarget.value.stage = followForm.newStage;
      
      // 调用API保存到后端
      try {
        const result = await apiClient.updateOpportunity(followTarget.value.id, {
          followUps: followTarget.value.followUps,
          lastFollowAt: followForm.date,
          stage: followForm.newStage || followTarget.value.stage
        });
        if (!result.success) {
          console.error('保存跟进记录失败:', result.error);
        }
      } catch (err) {
        console.error('保存跟进记录失败:', err);
      }
      
      store.notifications.unshift({ id:Date.now(), title:'跟进记录已保存', desc:`${followTarget.value.name} — ${followForm.type}跟进`, time:'刚刚', unread:true });
      followTarget.value = null;
    }

    // 收货地址弹窗相关（商机转订单）
    const showDeliveryModal = ref(false);
    const deliveryForm = reactive({ addr: '', contact: '', phone: '' });
    const currentOppForOrder = ref(null);
    
    // 赢单确认报价单弹窗
    const showWonConfirmModal = ref(false);
    const wonDeliveryForm = reactive({ addr: '', contact: '', phone: '' });
    const currentWonOpp = ref(null);
    const wonQuoteData = ref(null);
    
    // 内嵌报价单创建弹窗
    const showInlineQuote = ref(false);
    const inlineQuoteOpp = ref(null);
    const inlineQuoteForm = reactive({ endpoints: 100 });
    const inlineQuoteMode = ref('package');
    const inlineSelectedPackageId = ref('');
    const inlineSupplementFeatures = ref([]);
    const inlineCustomFeatures = ref([]);
    const inlineSelectedHardware = ref([]);
    const STANDARD_MAINTENANCE_FEATURE_ID = 'FEAT-MOD-MAINTENANCE-01-01';
    const DEFAULT_MAINTENANCE_MONTHS = 12;
    const DEFAULT_STANDARD_MAINTENANCE_RATE = 15;
    
    // 报价单详情弹窗
    const showQuoteDetailModal = ref(false);
    const quoteDetailData = ref(null);
    const quoteDetailItems = ref([]);
    function isQuoteDetailServiceItem(item) {
      const itemId = typeof item === 'string' ? item : item?.id;
      return itemId === 'gift-standard-warranty-1y' || isStandardMaintenanceFeature(itemId);
    }
    const quoteDetailSoftwareItems = computed(() => quoteDetailItems.value.filter(item => item.type !== 'hardware' && !isQuoteDetailServiceItem(item)));
    const quoteDetailHardwareItems = computed(() => quoteDetailItems.value.filter(item => item.type === 'hardware'));
    const quoteDetailServiceItems = computed(() => quoteDetailItems.value.filter(item => isQuoteDetailServiceItem(item)));

    function isStandardMaintenanceFeature(featureOrId) {
      const featureId = typeof featureOrId === 'string' ? featureOrId : featureOrId?.id;
      return featureId === STANDARD_MAINTENANCE_FEATURE_ID;
    }

    function getFeatureQuantityUnit(featureOrId) {
      return isStandardMaintenanceFeature(featureOrId) ? '月' : '点';
    }

    function getMaintenanceRateMap(maintenanceFeature) {
      const rateMap = {};
      if (!Array.isArray(maintenanceFeature?.maintenanceModuleRates)) return rateMap;
      maintenanceFeature.maintenanceModuleRates.forEach(item => {
        const moduleId = String(item?.moduleId || '').trim();
        const rate = Number(item?.rate);
        if (!moduleId) return;
        rateMap[moduleId] = Number.isFinite(rate) ? rate : DEFAULT_STANDARD_MAINTENANCE_RATE;
      });
      return rateMap;
    }

    function getMaintenanceFeatureOverrideMap(maintenanceFeature) {
      const overrideMap = {};
      if (!Array.isArray(maintenanceFeature?.maintenanceFeatureOverrides)) return overrideMap;
      maintenanceFeature.maintenanceFeatureOverrides.forEach(item => {
        const featureId = String(item?.featureId || '').trim();
        const rawRate = item?.rate;
        if (!featureId || rawRate === '' || rawRate === null || rawRate === undefined) return;
        const rate = Number(rawRate);
        if (!Number.isFinite(rate)) return;
        overrideMap[featureId] = rate;
      });
      return overrideMap;
    }

    function getFeatureEffectiveEndpoints(featureId, baseEndpoints = 0, overrideMap = {}) {
      const overrideValue = Number(overrideMap?.[featureId]);
      if (Number.isFinite(overrideValue) && overrideValue > 0) return Math.floor(overrideValue);
      if (isStandardMaintenanceFeature(featureId)) return DEFAULT_MAINTENANCE_MONTHS;
      const fallback = Number(baseEndpoints);
      return Number.isFinite(fallback) && fallback > 0 ? Math.floor(fallback) : 0;
    }

    function calculateOpportunityFeatureSubtotal(feat, endpoints, overrideMap = {}) {
      if (!feat || isStandardMaintenanceFeature(feat)) return 0;
      const qty = getFeatureEffectiveEndpoints(feat.id, endpoints, overrideMap);
      if (qty <= 0) return 0;
      const pc = resolveFeaturePriceConfig(feat);
      if (!pc) return 0;
      const partner = store.partners?.find(p => p.id === store.user?.partnerId);
      const partnerLevel = partner?.partnerLevel || 'none';
      let priceToUse = null;
      if (partnerLevel === 'primary' && pc.priceForPrimary) {
        priceToUse = pc.priceForPrimary;
      } else if (partnerLevel === 'secondary' && pc.priceForSecondary) {
        priceToUse = pc.priceForSecondary;
      }
      if (Array.isArray(priceToUse) && priceToUse.length) {
        const tier = priceToUse.find(t => qty >= t.min && qty <= t.max) || priceToUse[0];
        return roundMoney((tier?.price || 0) * qty);
      }
      if (Number.isFinite(Number(priceToUse)) && Number(priceToUse) > 0) {
        return roundMoney(Number(priceToUse));
      }
      const tiersToUse = pc.tiers || feat.tiers;
      const fixedToUse = pc.priceFixed ?? feat.priceFixed;
      if (Number.isFinite(Number(fixedToUse)) && Number(fixedToUse) > 0) {
        return roundMoney(Number(fixedToUse));
      }
      if (tiersToUse && tiersToUse.length) {
        const tier = tiersToUse.find(t => qty >= t.min && qty <= t.max) || tiersToUse[0];
        if (tier) return roundMoney(getDiscountedTierUnitPrice(feat, tier) * qty);
      }
      if (feat.unitPrice) return roundMoney(feat.unitPrice * qty);
      return 0;
    }

    function calculateOpportunityMaintenancePrice(features, endpoints, overrideMap = {}) {
      const maintenanceFeature = features.find(isStandardMaintenanceFeature);
      if (!maintenanceFeature) return 0;
      const rateMap = getMaintenanceRateMap(maintenanceFeature);
      const featureOverrideMap = getMaintenanceFeatureOverrideMap(maintenanceFeature);
      const annualPrice = features
        .filter(feat => !isStandardMaintenanceFeature(feat))
        .reduce((sum, feat) => {
          if (!feat?.moduleId) return sum;
          const featureSubtotal = calculateOpportunityFeatureSubtotal(feat, endpoints, overrideMap);
          if (!featureSubtotal) return sum;
          const overriddenRate = featureOverrideMap[feat.id];
          const rate = Number.isFinite(overriddenRate)
            ? overriddenRate
            : (Number.isFinite(rateMap[feat.moduleId]) ? rateMap[feat.moduleId] : DEFAULT_STANDARD_MAINTENANCE_RATE);
          return sum + featureSubtotal * rate / 100;
        }, 0);
      const months = getFeatureEffectiveEndpoints(STANDARD_MAINTENANCE_FEATURE_ID, endpoints, overrideMap);
      return roundMoney(annualPrice * months / DEFAULT_MAINTENANCE_MONTHS);
    }

    function getInlineQuoteFeatureIds() {
      if (inlineQuoteMode.value === 'package') {
        return [...(inlineSelectedPackage.value?.featureIds || [])];
      }
      if (inlineQuoteMode.value === 'supplement') {
        return [...(inlineSelectedPackage.value?.featureIds || []), ...inlineSupplementFeatures.value];
      }
      return [...inlineCustomFeatures.value];
    }

    function getInlineCurrentQuoteFeatures() {
      const featureIds = getInlineQuoteFeatureIds();
      return allFeatures.value.filter(feature => featureIds.includes(feature.id));
    }

    function calculateOpportunityFeatureSetTotal(featureIds, endpoints, overrideMap = {}) {
      const features = allFeatures.value.filter(feature => featureIds.includes(feature.id));
      const baseTotal = features.reduce((sum, feat) => sum + calculateOpportunityFeatureSubtotal(feat, endpoints, overrideMap), 0);
      const maintenanceTotal = calculateOpportunityMaintenancePrice(features, endpoints, overrideMap);
      return roundMoney(baseTotal + maintenanceTotal);
    }

    async function ensureQuoteLoadedById(quoteId) {
      if (!quoteId) return null;
      let quote = store.quotes.find(q => q.id === quoteId);
      if (quote) return quote;
      if (!apiClient.getQuotes) return null;
      try {
        const result = await apiClient.getQuotes();
        if (result.success && Array.isArray(result.data)) {
          store.quotes = result.data.map(item => ({ ...item }));
          quote = store.quotes.find(q => q.id === quoteId);
        }
      } catch (err) {
        console.error('加载报价单失败:', err);
      }
      return quote || null;
    }

    function getQuoteDisplayEndpoints(quote) {
      if (!quote) return 0;
      const baseEndpoints = Number(quote.endpoints) || 0;
      const products = Array.isArray(quote.products) ? quote.products.filter(pid => !isStandardMaintenanceFeature(pid)) : [];
      const overrideMap = quote.featurePointOverrides || {};
      if (!products.length) return baseEndpoints;
      const maxPoints = products.reduce((maxValue, pid) => {
        const overrideValue = Number(overrideMap[pid]);
        const qty = Number.isFinite(overrideValue) && overrideValue > 0 ? Math.floor(overrideValue) : baseEndpoints;
        return Math.max(maxValue, qty);
      }, 0);
      return maxPoints || baseEndpoints;
    }

    function getComplimentaryWarrantyItem() {
      return {
        id: 'gift-standard-warranty-1y',
        productCode: 'GIFT-WARRANTY-1Y',
        name: '标准质保服务（赠送1年）',
        type: '服务',
        qty: 1,
        qtyLabel: '1 年',
        qtyDisplay: '1 年',
        unitPrice: 0,
        subtotal: 0
      };
    }
    
    // 打开报价单详情弹窗
    async function openQuoteDetailModal(quoteId) {
      const quote = await ensureQuoteLoadedById(quoteId);
      if (!quote) {
        alert('未找到报价单');
        return;
      }
      quoteDetailData.value = quote;
      // 构建明细项
      const items = [];
      const ep = quote.endpoints || 100;
      const overrideMap = quote.featurePointOverrides || {};
      const detailFeatures = (quote.products || []).map(pid => allFeatures.value.find(f => f.id === pid)).filter(Boolean);
      const detailHardwareTotal = (quote.hardwareIds || []).reduce((sum, hid) => {
        const hw = publishedHardware.value.find(h => h.id === hid);
        return sum + (hw?.priceFixed || 0);
      }, 0);
      // 处理功能
      (quote.products || []).forEach(pid => {
        const feat = allFeatures.value.find(f => f.id === pid);
        if (feat) {
          const qty = getFeatureEffectiveEndpoints(pid, ep, overrideMap);
          const tier = feat.pricingTiers?.find(t => qty >= t.minQty && qty <= (t.maxQty || Infinity));
          const unitPrice = tier ? tier.price : (feat.prices?.[0]?.price || 0);
          items.push({ name: feat.name, type: '功能', qty, unitPrice, subtotal: unitPrice * qty });
        }
      });
      // 处理硬件
      (quote.hardwareIds || []).forEach(hid => {
        const hw = publishedHardware.value.find(h => h.id === hid);
        if (hw) {
          items.push({ name: hw.name, type: '硬件', qty: 1, unitPrice: hw.price || 0, subtotal: hw.price || 0 });
        }
      });
      items.push(getComplimentaryWarrantyItem());
      quoteDetailItems.value = items;
      showQuoteDetailModal.value = true;
    }

    async function openQuoteDetailModal(quoteId) {
      const quote = await ensureQuoteLoadedById(quoteId);
      if (!quote) {
        alert('未找到报价单');
        return;
      }
      quoteDetailData.value = quote;
      const items = [];
      const ep = Number(quote.endpoints) || 100;
      const overrideMap = quote.featurePointOverrides || {};
      const detailFeatures = (quote.products || []).map(pid => allFeatures.value.find(f => f.id === pid)).filter(Boolean);
      (quote.products || []).forEach(pid => {
        const feat = allFeatures.value.find(f => f.id === pid);
        const qty = getFeatureEffectiveEndpoints(pid, ep, overrideMap);
        if (!feat) {
          items.push({
            name: pid,
            productCode: pid,
            type: '功能',
            qty,
            qtyDisplay: `${qty} ${getFeatureQuantityUnit(pid)}`,
            unitPrice: 0,
            subtotal: 0
          });
          return;
        }
        const subtotal = isStandardMaintenanceFeature(feat)
          ? calculateOpportunityMaintenancePrice(detailFeatures, ep, overrideMap)
          : calculateOpportunityFeatureSubtotal(feat, ep, overrideMap);
        const unitPrice = qty > 0 ? roundMoney(subtotal / qty) : 0;
        items.push({
          name: feat.name,
          productCode: feat.productCode || feat.id,
          type: '功能',
          qty,
          qtyDisplay: `${qty} ${getFeatureQuantityUnit(feat)}`,
          unitPrice,
          subtotal
        });
      });
      (quote.hardwareIds || []).forEach(hid => {
        const hw = publishedHardware.value.find(h => h.id === hid);
        if (!hw) return;
        items.push({
          name: hw.name,
          productCode: hw.model || hw.productCode || hw.id,
          type: '硬件',
          qty: 1,
          unitPrice: hw.priceFixed || 0,
          subtotal: hw.priceFixed || 0
        });
      });
      items.push(getComplimentaryWarrantyItem());
      quoteDetailItems.value = items;
      showQuoteDetailModal.value = true;
    }
    
    const inlineSelectedPackage = computed(() => publishedPackages.value.find(p => p.id === inlineSelectedPackageId.value));
    const inlineSupplementOptions = computed(() => {
      if (!inlineSelectedPackage.value) return [];
      const pkgFeatureIds = new Set(inlineSelectedPackage.value.featureIds || []);
      return allFeatures.value.filter(f => !pkgFeatureIds.has(f.id));
    });
    const inlinePackagePrice = computed(() => {
      if (!inlineSelectedPackage.value) return 0;
      return getPackagePrice(inlineSelectedPackage.value, inlineQuoteForm.endpoints);
    });
    const inlineSubTotal = computed(() => {
      const featureIds = getInlineQuoteFeatureIds();
      return calculateOpportunityFeatureSetTotal(featureIds, inlineQuoteForm.endpoints);
    });
    const inlineHardwareTotal = computed(() => {
      return inlineSelectedHardware.value.reduce((sum, hid) => sum + getHardwarePriceById(hid), 0);
    });
    const inlineGrandTotal = computed(() => inlineSubTotal.value + inlineHardwareTotal.value);
    const inlineCanSave = computed(() => {
      if (inlineQuoteMode.value === 'package') return !!inlineSelectedPackageId.value;
      if (inlineQuoteMode.value === 'supplement') return !!inlineSelectedPackageId.value;
      if (inlineQuoteMode.value === 'custom') return inlineCustomFeatures.value.length > 0;
      return false;
    });
    
    // 获取功能名称（通过ID）
    function getFeatureName(fid) {
      const f = allFeatures.value.find(x => x.id === fid);
      return f ? f.name : fid;
    }
    
    // 获取功能总价（通过ID）— 统一与 admin-app.js 一致，包含阶梯价格计算
    function getFeaturePriceById(fid) {
      const f = allFeatures.value.find(x => x.id === fid);
      if (!f) return 0;
      const ep = inlineQuoteForm.endpoints || 100;
      // 阶梯价格：端点越多，单价越低
      const tier = f.pricingTiers?.find(t => ep >= t.minQty && ep <= (t.maxQty || Infinity));
      if (tier) return tier.price * ep;
      return (f.prices?.[0]?.price || 0) * ep;
    }
    
    // 获取套餐价格 — 统一与 admin-app.js 一致
    function getPackagePrice(pkg, endpoints) {
      if (!pkg) return 0;
      const qty = endpoints || 100;
      const tier = pkg.pricingTiers?.find(t => qty >= t.minQty && qty <= (t.maxQty || Infinity));
      if (tier) return tier.price * qty;
      const price = pkg.prices?.[0]?.price || pkg.price || 0;
      return price * qty;
    }

    function getFeaturePriceById(fid) {
      const feat = allFeatures.value.find(x => x.id === fid);
      if (!feat) return 0;
      if (isStandardMaintenanceFeature(feat)) {
        return calculateOpportunityMaintenancePrice(getInlineCurrentQuoteFeatures(), inlineQuoteForm.endpoints);
      }
      return calculateOpportunityFeatureSubtotal(feat, inlineQuoteForm.endpoints);
    }

    function getPackagePrice(pkg, endpoints) {
      if (!pkg) return 0;
      return calculateOpportunityFeatureSetTotal(pkg.featureIds || [], endpoints);
    }
    
    // 获取硬件名称（通过ID）
    function getHardwareNameById(hid) {
      const h = publishedHardware.value.find(x => x.id === hid);
      return h ? h.name : hid;
    }
    
    // 获取硬件价格（通过ID）
    function getHardwarePriceById(hid) {
      const h = publishedHardware.value.find(x => x.id === hid);
      return h ? (h.priceFixed || 0) : 0;
    }

    // 提示没有报价单不能转订单
    function noQuoteAlert() {
      alert('请先创建报价单后再转订单');
    }

    function openInlineQuoteModal(o) {
      inlineQuoteOpp.value = o;
      inlineQuoteForm.endpoints = o.endpoints || 100;
      inlineSelectedPackageId.value = '';
      inlineSupplementFeatures.value = [];
      inlineCustomFeatures.value = [];
      inlineSelectedHardware.value = [];
      inlineQuoteMode.value = 'package';
      showInlineQuote.value = true;
    }
    function inlineQuoteSetMode(mode) {
      if (mode === 'supplement' && !inlineSelectedPackageId.value) return;
      inlineQuoteMode.value = mode;
    }
    function inlineSelectPackage(pkg) {
      inlineSelectedPackageId.value = pkg.id;
      if (inlineQuoteMode.value !== 'supplement') {
        inlineQuoteMode.value = 'package';
      }
    }
    function toggleInlineSupplement(fid) {
      const idx = inlineSupplementFeatures.value.indexOf(fid);
      if (idx >= 0) inlineSupplementFeatures.value.splice(idx, 1);
      else inlineSupplementFeatures.value.push(fid);
    }
    function toggleInlineCustom(fid) {
      const idx = inlineCustomFeatures.value.indexOf(fid);
      if (idx >= 0) inlineCustomFeatures.value.splice(idx, 1);
      else inlineCustomFeatures.value.push(fid);
    }
    function toggleInlineHardware(hid) {
      const idx = inlineSelectedHardware.value.indexOf(hid);
      if (idx >= 0) inlineSelectedHardware.value.splice(idx, 1);
      else inlineSelectedHardware.value.push(hid);
    }
    async function saveInlineQuote() {
      if (!inlineQuoteOpp.value) return;
      const o = inlineQuoteOpp.value;
      let productIds = [];
      if (inlineQuoteMode.value === 'package') {
        productIds = [...(inlineSelectedPackage.value?.featureIds || [])];
      } else if (inlineQuoteMode.value === 'supplement') {
        productIds = [...(inlineSelectedPackage.value?.featureIds || []), ...inlineSupplementFeatures.value];
      } else {
        productIds = [...inlineCustomFeatures.value];
      }
      const hardwareIds = [...inlineSelectedHardware.value];
      
      try {
        const result = await apiClient.createQuote({
          customer: o.customer,
          regId: o.regId || '',
          oppIds: [o.id],
          oppId: o.id,
          endpoints: inlineQuoteForm.endpoints,
          products: productIds,
          hardwareIds: hardwareIds,
          quoteMode: inlineQuoteMode.value,
          packageId: inlineSelectedPackageId.value,
          total: inlineGrandTotal.value,
          validDays: 30,
          ownerId: store.user.id,
          createdBy: store.user.id,
          assignedStaffId: store.user.id,
        });
        
        if (result.success) {
          store.quotes.unshift(result.data);
          // 同步更新商机
          const opp = store.opportunities.find(x => x.id === o.id);
          if (opp) {
            opp.quoteId = result.data.id;
            opp.amount = inlineGrandTotal.value; // 同步更新商机金额
            if (opp.stage === 'qualification') opp.stage = 'proposal';
            // 更新到后端，并使用返回数据确保一致
            try {
              const updateResult = await apiClient.updateOpportunity(opp.id, { quoteId: opp.quoteId, stage: opp.stage, amount: opp.amount });
              if (updateResult.success) {
                // 用后端返回数据覆盖，确保数据一致
                Object.assign(opp, updateResult.data);
              }
            } catch (err) {}
            // 同步详情数据
            if (detail.value && detail.value.id === o.id) {
              detail.value.quoteId = opp.quoteId;
              detail.value.stage = opp.stage;
              detail.value.amount = opp.amount;
            }
          }
          showInlineQuote.value = false;
          alert('报价单已创建！');
        } else {
          alert('创建失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        console.error('创建报价单失败:', err);
        alert('创建失败，请检查网络连接');
      }
    }
    
    // 商机阶段变更处理
    function changeStage(newStage) {
      const oldStage = detail.value.stage;
      if (oldStage === newStage) return;
      
      // 已赢单或已输单的商机不允许更改阶段
      if (['won', 'lost'].includes(oldStage)) {
        alert('该商机已处于终态（' + stageLabel(oldStage) + '），不允许更改阶段。');
        return;
      }
      
      // 如果变更为"方案报价"阶段，且没有报价单，打开内嵌报价单弹窗
      if (newStage === 'proposal' && !detail.value.quoteId) {
        if (confirm(`商机将推进到"方案报价"阶段，建议先创建报价单。\n\n点击"确定"立即创建报价单，点击"取消"继续推进阶段。`)) {
          openInlineQuoteModal(detail.value);
          return;
        }
      }
      
      // 如果变更为"签约中"或"已赢单"，且没有报价单，打开内嵌报价单弹窗
      if (['closing', 'won'].includes(newStage) && !detail.value.quoteId) {
        if (confirm(`商机即将标记为"${stageLabel(newStage)}"，建议先创建报价单。\n\n点击"确定"立即创建报价单，点击"取消"跳过报价直接转订单。`)) {
          openInlineQuoteModal(detail.value);
          return;
        }
      }
      
      // 如果变更为"签约中"或"已赢单"，且有报价单，提示确认报价单后转订单
      if (['closing', 'won'].includes(newStage) && detail.value.quoteId) {
        const hasOrder = store.orders.find(o => o.oppId === detail.value.id);
        if (!hasOrder) {
          if (confirm(`商机即将标记为"${stageLabel(newStage)}"，是否确认报价单并转订单？\n\n点击"确定"打开报价单确认，点击"取消"只更新阶段。`)) {
            openWonConfirmModal(detail.value);
            return;
          }
        }
      }
      
      // 更新商机阶段
      const d = detail.value;
      d.stage = newStage;
      // 同步到后端
      apiClient.updateOpportunity(d.id, { stage: newStage }).then(result => {
        if (result.success) {
          // 同步更新列表数据
          const idx = store.opportunities.findIndex(x => x.id === d.id);
          if (idx !== -1) store.opportunities[idx].stage = newStage;
        }
      }).catch(err => console.error('更新商机阶段失败:', err));
    }
    
    // 打开赢单确认弹窗（带报价单确认）
    function openWonConfirmModal(o) {
      currentWonOpp.value = o;
      // 获取关联的报价单数据
      if (o.quoteId) {
        wonQuoteData.value = store.quotes.find(q => q.id === o.quoteId) || null;
      } else {
        wonQuoteData.value = null;
      }
      // 填充收货信息
      const reg = store.registrations.find(r => r.id === o.regId);
      wonDeliveryForm.addr = reg ? reg.address || reg.city || '' : '';
      wonDeliveryForm.contact = reg ? reg.contact || '' : '';
      wonDeliveryForm.phone = reg ? reg.phone || '' : '';
      showWonConfirmModal.value = true;
    }
    
    // 从赢单确认弹窗修改报价单
    async function openWonConfirmModal(o) {
      currentWonOpp.value = o;
      wonQuoteData.value = o.quoteId ? await ensureQuoteLoadedById(o.quoteId) : null;
      const reg = store.registrations.find(r => r.id === o.regId);
      wonDeliveryForm.addr = reg ? reg.address || reg.city || '' : '';
      wonDeliveryForm.contact = reg ? reg.contact || '' : '';
      wonDeliveryForm.phone = reg ? reg.phone || '' : '';
      showWonConfirmModal.value = true;
    }

    function editQuoteFromWonConfirm(quote) {
      showWonConfirmModal.value = false;
      detail.value = null;
      router.push('/quote/edit/' + quote.id);
    }
    
    // 确认赢单并创建订单
    async function confirmWonAndCreateOrder() {
      if (!wonDeliveryForm.addr.trim()) { alert('请填写收货地址'); return; }
      if (!wonDeliveryForm.contact.trim()) { alert('请填写联系人'); return; }
      if (!wonDeliveryForm.phone.trim()) { alert('请填写联系电话'); return; }
      
      const o = currentWonOpp.value;
      const reg = store.registrations.find(r => r.id === o.regId);
      showWonConfirmModal.value = false;
      
      try {
        // 如果有报价单，先更新报价单状态为已确认（如果需要）
        if (o.quoteId) {
          const quote = store.quotes.find(q => q.id === o.quoteId);
          if (quote && quote.status !== 'converted') {
            await apiClient.updateQuoteStatus(o.quoteId, 'confirmed');
            const quoteIdx = store.quotes.findIndex(q => q.id === o.quoteId);
            if (quoteIdx !== -1) store.quotes[quoteIdx].status = 'confirmed';
          }
        }
        
        // 创建订单
        const result = await apiClient.createOrder({
          customer: o.customer,
          total: wonQuoteData.value ? wonQuoteData.value.total : o.amount,
          deliveryAddr: wonDeliveryForm.addr.trim(),
          contacts: `${wonDeliveryForm.contact.trim()} ${wonDeliveryForm.phone.trim()}`,
          region: reg ? reg.region : (o.region || ''),
          regId: o.regId || '',
          oppId: o.id,
          quoteId: o.quoteId || '',
          createdBy: o.createdBy || o.ownerId || store.user.id,
          assignedStaffId: o.assignedStaffId || store.user.id,
        });
        
        if (result.success) {
          store.orders.unshift(result.data);
          // 更新商机阶段为已赢单
          const oppResult = await apiClient.updateOpportunity(o.id, { stage: 'won' });
          if (oppResult.success) {
            const idx = store.opportunities.findIndex(x => x.id === o.id);
            if (idx !== -1) store.opportunities[idx].stage = 'won';
            // 同步更新详情弹窗中的商机数据
            if (detail.value && detail.value.id === o.id) detail.value.stage = 'won';
          }
          // 更新报价单状态为已转单
          if (o.quoteId) {
            const quoteIdx = store.quotes.findIndex(q => q.id === o.quoteId);
            if (quoteIdx !== -1) {
              store.quotes[quoteIdx].status = 'converted';
              store.quotes[quoteIdx].convertedAt = new Date().toISOString().slice(0, 10);
            }
            await apiClient.updateQuoteStatus(o.quoteId, 'converted');
          }
          alert('🎉 商机已赢单，订单已创建！');
          detail.value = null;
          router.push('/order');
        } else {
          alert('创建订单失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        console.error('赢单转订单失败:', err);
        alert('操作失败，请检查网络连接');
      }
    }
    
    // 打开商机转订单弹窗
    function openToOrderFromOpp(o) {
      const reg = store.registrations.find(r => r.id === o.regId);
      deliveryForm.addr = reg ? reg.address || reg.city || '' : '';
      deliveryForm.contact = reg ? reg.contact || '' : '';
      deliveryForm.phone = reg ? reg.phone || '' : '';
      currentOppForOrder.value = o;
      showDeliveryModal.value = true;
    }
    
    // 确认从商机转订单
    async function confirmToOrderFromOpp() {
      if (!deliveryForm.addr.trim()) { alert('请填写收货地址'); return; }
      if (!deliveryForm.contact.trim()) { alert('请填写联系人'); return; }
      if (!deliveryForm.phone.trim()) { alert('请填写联系电话'); return; }
      
      const o = currentOppForOrder.value;
      const reg = store.registrations.find(r => r.id === o.regId);
      showDeliveryModal.value = false;
      
      try {
        const result = await apiClient.createOrder({
          customer: o.customer,
          total: o.amount,
          deliveryAddr: deliveryForm.addr.trim(),
          contacts: `${deliveryForm.contact.trim()} ${deliveryForm.phone.trim()}`,
          region: reg ? reg.region : (o.region || ''),
          regId: o.regId || '',
          oppId: o.id,
          quoteId: o.quoteId || '',
          createdBy: o.createdBy || o.ownerId || store.user.id,
          assignedStaffId: o.assignedStaffId || store.user.id,
        });
        
        if (result.success) {
          store.orders.unshift(result.data);
          // 更新商机阶段为已赢单
          const oppResult = await apiClient.updateOpportunity(o.id, { stage: 'won' });
          if (oppResult.success) {
            const idx = store.opportunities.findIndex(x => x.id === o.id);
            if (idx !== -1) store.opportunities[idx].stage = 'won';
            // 同步更新详情弹窗中的商机数据
            if (detail.value && detail.value.id === o.id) detail.value.stage = 'won';
          }
          // 更新关联报价单状态为已转单
          if (o.quoteId) {
            const quoteIdx = store.quotes.findIndex(q => q.id === o.quoteId);
            if (quoteIdx !== -1) {
              store.quotes[quoteIdx].status = 'converted';
              store.quotes[quoteIdx].convertedAt = new Date().toISOString().slice(0, 10);
            }
            await apiClient.updateQuoteStatus(o.quoteId, 'converted');
          }
          alert('已成功转为订单，请在订单管理中查看。');
          currentOppForOrder.value = null;
          detail.value = null;
          router.push('/order');
        } else {
          alert('创建订单失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        console.error('创建订单失败:', err);
        alert('创建订单失败，请检查网络连接');
      }
    }

    // 获取商机名称
    function getOppName(oppId) {
      const opp = store.opportunities.find(o => o.id === oppId);
      return opp ? opp.name : oppId;
    }

    // 加载产品目录（供内嵌报价单使用）
    onMounted(() => {
      loadOpportunities();
      loadProductCatalog();
    });

    return { store, adminRegion, isStaff, filtered, viewMode, kw, stageFilter, customerFilter, approvedRegs, detail, followTarget, followForm, loading,
      STAGES, byStage, isOverdue, openDetail, canEditOpportunityName, editName, editExpectedClose, savingExpectedClose, saveExpectedClose, openFollow, saveFollow, loadOpportunities,
      fmt, stageLabel, stageDot, stageTagClass, probColor,
      // 商机阶段变更
      changeStage,
      // 商机转订单
      showDeliveryModal, deliveryForm, openToOrderFromOpp, confirmToOrderFromOpp,
      // 赢单确认
      showWonConfirmModal, wonDeliveryForm, currentWonOpp, wonQuoteData, openWonConfirmModal, editQuoteFromWonConfirm, confirmWonAndCreateOrder,
      // 内嵌报价单
      showInlineQuote, inlineQuoteOpp, inlineQuoteForm, inlineQuoteMode, inlineSelectedPackageId, inlineSelectedPackage,
      inlineSupplementFeatures, inlineCustomFeatures, inlineSelectedHardware,
      inlinePackagePrice, inlineSubTotal, inlineHardwareTotal, inlineGrandTotal, inlineCanSave,
      openInlineQuoteModal, noQuoteAlert, inlineQuoteSetMode, inlineSelectPackage, toggleInlineSupplement, toggleInlineCustom, toggleInlineHardware, saveInlineQuote,
      // 报价单详情
      showQuoteDetailModal, quoteDetailData, quoteDetailItems, openQuoteDetailModal, getQuoteDisplayEndpoints,
      // 工具函数
      getOppName, allFeatures, publishedPackages, publishedHardware, getFeatureName, getFeaturePriceById, getPackagePrice, getHardwareNameById, getHardwarePriceById,
      // 产品目录加载
      loadProductCatalog };
  }
};

// ── 新建商机 ─────────────────────────────────────────────────
const OpportunityNew = {
  template: `
  <div>
    <div class="card" style="max-width:720px;margin:0 auto">
      <div class="card-header">
        <div class="card-title">新建商机</div>
        <span style="font-size:12px;color:#888">商机须关联已审批的报备客户</span>
      </div>

      <!-- 关联客户选择区 -->
      <div style="background:#f6f8ff;border:1.5px solid #d0e4ff;border-radius:10px;padding:16px 18px;margin-bottom:22px">
        <div style="font-size:13px;font-weight:700;color:#1677ff;margin-bottom:12px">🏢 关联报备客户</div>
        <div style="position:relative">
          <input class="form-control" v-model="customerSearch"
            :placeholder="selectedReg ? selectedReg.customer : '搜索已审批客户名称...'"
            @focus="showDropdown=true" @blur="onBlurSearch"
            style="padding-right:36px"/>
          <span v-if="selectedReg" @click="clearReg" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);cursor:pointer;color:#aaa;font-size:16px">✕</span>
          <!-- 下拉列表 -->
          <div v-if="showDropdown" style="position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1px solid #e0e0e0;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.1);z-index:999;max-height:240px;overflow-y:auto">
            <div v-for="r in filteredRegs" :key="r.id"
              @mousedown.prevent="selectReg(r)"
              style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f5f5f5;transition:background .15s"
              @mouseenter="$event.currentTarget.style.background='#f0f7ff'"
              @mouseleave="$event.currentTarget.style.background=''">
              <div style="font-size:13px;font-weight:600;color:#1a1a1a">{{ r.customer }}</div>
              <div style="font-size:11px;color:#aaa;margin-top:2px">
                <span class="tag tag-green" style="font-size:10px;padding:0 5px">已审批</span>
                &nbsp;{{ r.contact }} · {{ r.phone }} · {{ r.industry }}
                &nbsp;<span style="color:#bbb">{{ r.id }}</span>
              </div>
            </div>
            <!-- 加载中提示 -->
            <div v-if="loadingRegs" style="padding:14px;text-align:center;color:#888;font-size:12px">
              <span style="display:inline-block;animation:spin 1s linear infinite;margin-right:6px">⟳</span>加载中...
            </div>
            <!-- 无数据提示 -->
            <div v-else-if="!filteredRegs.length && !customerSearch" style="padding:14px;text-align:center;color:#aaa;font-size:12px">
              暂无已审批的客户报备
              <div style="margin-top:8px">
                <button class="btn btn-primary btn-sm" @mousedown.prevent="goRegNew">➕ 立即报备客户</button>
              </div>
            </div>
            <!-- 搜索无结果提示 -->
            <div v-else-if="!filteredRegs.length && customerSearch" style="padding:14px;text-align:center;color:#aaa;font-size:12px">
              未找到"{{ customerSearch }}"对应的已审批客户
              <div style="margin-top:8px">
                <button class="btn btn-primary btn-sm" @mousedown.prevent="goRegNew">➕ 立即报备此客户</button>
              </div>
            </div>
          </div>
        </div>
        <!-- 已选客户信息展示 -->
        <div v-if="selectedReg" style="margin-top:14px;display:flex;gap:20px;flex-wrap:wrap">
          <div style="flex:1;min-width:140px">
            <div style="font-size:11px;color:#888;margin-bottom:3px">联系人</div>
            <div style="font-size:13px;font-weight:600">{{ selectedReg.contact }}</div>
          </div>
          <div style="flex:1;min-width:140px">
            <div style="font-size:11px;color:#888;margin-bottom:3px">联系电话</div>
            <div style="font-size:13px;font-weight:600">{{ selectedReg.phone }}</div>
          </div>
          <div style="flex:1;min-width:140px">
            <div style="font-size:11px;color:#888;margin-bottom:3px">行业</div>
            <div style="font-size:13px;font-weight:600">{{ selectedReg.industry }}</div>
          </div>
          <div style="flex:1;min-width:140px">
            <div style="font-size:11px;color:#888;margin-bottom:3px">报备编号</div>
            <div style="font-size:12px;color:#1677ff;font-family:monospace">{{ selectedReg.id }}</div>
          </div>
          <div style="flex:1;min-width:140px">
            <div style="font-size:11px;color:#888;margin-bottom:3px">保护期至</div>
            <div style="font-size:13px;font-weight:600" :style="{color: isExpiring(selectedReg)?'#faad14':'#333'}">
              {{ selectedReg.expireAt }}
              <span v-if="isExpiring(selectedReg)" style="font-size:11px;color:#faad14">⚠️ 即将到期</span>
            </div>
          </div>
        </div>
        <!-- 该客户已有商机提示 -->
        <div v-if="selectedReg && existingOpps.length" style="margin-top:12px;background:#fffbe6;border:1px solid #ffe58f;border-radius:6px;padding:10px 14px">
          <div style="font-size:12px;color:#ad6800;font-weight:600;margin-bottom:6px">📋 该客户已有 {{ existingOpps.length }} 个商机</div>
          <div v-for="o in existingOpps" :key="o.id" style="font-size:12px;color:#595959;display:flex;gap:12px;padding:3px 0;border-bottom:1px solid #fff7cc">
            <span class="tag" :class="stageTagClass(o.stage)" style="font-size:10px;padding:0 5px">{{ stageLabel(o.stage) }}</span>
            <span style="font-weight:500">{{ o.name }}</span>
            <span style="color:#1677ff">{{ fmt(o.amount) }}</span>
          </div>
          <div style="font-size:11px;color:#aaa;margin-top:6px">可以继续为该客户创建新商机</div>
        </div>
        <!-- 未选客户时引导 -->
        <div v-if="!selectedReg" style="margin-top:10px;font-size:12px;color:#aaa">
          请先选择已审批的报备客户，如客户尚未报备，请先
          <span style="color:#1677ff;cursor:pointer;text-decoration:underline" @click="$router.push('/registration/new')">报备客户</span>
        </div>
      </div>

      <!-- 商机信息表单 -->
      <div class="form-grid" style="margin-bottom:20px">
        <!-- 商机名称 - 全行 -->
        <div class="form-item full"><label class="form-label required">商机名称</label><input class="form-control" v-model="form.name" placeholder="例：XX公司终端安全改造项目"/></div>
        
        <!-- 第一行：当前阶段 + 端点数量 -->
        <div class="form-item"><label class="form-label required">当前阶段</label>
          <select class="form-control" v-model="form.stage">
            <option v-for="s in STAGES" :key="s.key" :value="s.key">{{ s.label }}</option>
          </select>
        </div>
        <div class="form-item"><label class="form-label">端点数量</label><input class="form-control" type="number" v-model.number="form.endpoints" placeholder="0"/></div>
        
        <!-- 第二行：预计金额 + 预计签约时间 -->
        <div class="form-item"><label class="form-label required">预计金额（元）</label><input class="form-control" type="number" v-model.number="form.amount" placeholder="0"/></div>
        <div class="form-item"><label class="form-label">预计签约时间</label><input class="form-control" type="date" v-model="form.expectedClose"/></div>
        
        <!-- 第三行：客户对接人 + 对接人电话 -->
        <div class="form-item"><label class="form-label">客户对接人</label><input class="form-control" v-model="form.contactPerson" placeholder="客户方对接人姓名"/></div>
        <div class="form-item"><label class="form-label">对接人电话</label><input class="form-control" v-model="form.contactPhone" placeholder="客户方对接人电话"/></div>
        
        <!-- 第四行：商机来源（独占一行，美观） -->
        <div class="form-item"><label class="form-label">商机来源</label>
          <select class="form-control" v-model="form.source">
            <option>渠道推荐</option><option>市场活动</option><option>老客户续约</option><option>展会获客</option><option>政府关系</option><option>网络询盘</option><option>其他</option>
          </select>
        </div>
        <div class="form-item"></div>
        
        <!-- 标签 - 全行 -->
        <div class="form-item full"><label class="form-label">标签（回车添加）</label>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;border:1px solid #d9d9d9;border-radius:6px;padding:6px 10px;min-height:40px" @click="$refs.tagInput.focus()">
            <span v-for="t in form.tags" :key="t" class="tag tag-blue" style="font-size:12px">{{ t }} <span @click.stop="removeTag(t)" style="cursor:pointer;margin-left:2px">×</span></span>
            <input ref="tagInput" style="border:none;outline:none;font-size:13px;min-width:80px" v-model="tagInput" @keydown.enter.prevent="addTag" placeholder="输入标签后回车"/>
          </div>
        </div>
        
        <!-- 备注 - 全行 -->
        <div class="form-item full"><label class="form-label">备注</label><textarea class="form-control" v-model="form.notes" rows="3" placeholder="项目背景、竞争情况、关键决策人..."></textarea></div>
        
        <!-- 首次跟进 - 全行 -->
        <div class="form-item full">
          <label class="form-label">首次跟进记录</label>
          <textarea class="form-control" v-model="form.firstFollow" rows="3" placeholder="记录线索来源或首次沟通情况（可选）"></textarea>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px">
        <button class="btn btn-default" @click="$router.back()">取消</button>
        <button class="btn btn-primary" @click="submit" :disabled="!canSubmit">创建商机</button>
      </div>
    </div>
  </div>`,
  setup() {
    const router = VueRouter.useRouter();
    const route = VueRouter.useRoute();

    // 获取当前用户ID（员工使用 id，与报备数据的 createdBy 字段匹配）
    const userId = computed(() => store.user?.id || '');
    const isStaff = computed(() => store.user?.role === 'staff' || store.user?.role === 'partner_admin');
    // 区域管理员隔离
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    
    // 已审批报备客户列表
    const approvedRegs = computed(() => {
      let list = store.registrations.filter(r => r.status === 'approved');
      const partnerId = store.user?.partnerId;
      const isPartnerAdmin = store.user?.role === 'partner_admin';
      // 企业管理员（partner_admin）：看本企业的全部报备
      if (isPartnerAdmin && partnerId) {
        return list.filter(r => r.partnerId === partnerId);
      }
      // 普通员工：自己创建的
      if (isStaff.value) {
        return list.filter(r =>
          r.createdBy === userId.value ||
          r.owner === userId.value ||
          r.assignedStaffId === userId.value ||
          r.assignedStaffUserId === userId.value
        );
      }
      if (adminRegion.value) {
        return list.filter(r => r.region === adminRegion.value);
      }
      return list;
    });

    // 客户搜索
    const customerSearch = ref('');
    const showDropdown = ref(false);
    const selectedReg = ref(null);
    const loadingRegs = ref(false);

    // 加载报备数据
    async function loadRegistrations() {
      loadingRegs.value = true;
      try {
        const params = new URLSearchParams();
        const partnerId = store.user?.partnerId;
        const isPartnerAdmin = store.user?.role === 'partner_admin';
        if (isPartnerAdmin && partnerId) {
          // 企业管理员（partner_admin）：获取本企业全部报备
          params.append('partnerId', partnerId);
        } else if (store.user?.role === 'staff') {
          // 普通员工：传 userId，返回自己创建的 + 被指派的
          params.append('userId', userId.value);
        } else if (adminRegion.value) {
          params.append('region', adminRegion.value);
        }
        const res = await fetch(`${window.API_BASE}/registrations?${params}`);
        const data = await res.json();
        if (data.success) {
          store.registrations = data.data;
        }
      } catch (err) {
        console.error('加载报备失败:', err);
      } finally {
        loadingRegs.value = false;
      }
    }

    // 若路由带 regId 参数，自动预选
    onMounted(async () => {
      await loadRegistrations();
      const regId = route.query.regId;
      if (regId) {
        const reg = store.registrations.find(r => r.id === regId);
        if (reg && reg.status === 'approved') selectReg(reg);
      }
    });

    const filteredRegs = computed(() => {
      const kw = customerSearch.value.trim();
      if (!kw) return approvedRegs.value;
      return approvedRegs.value.filter(r =>
        r.customer.includes(kw) || r.contact.includes(kw) || r.id.includes(kw)
      );
    });

    // 已选客户下已有的商机（支持一客户多商机）
    const existingOpps = computed(() => {
      if (!selectedReg.value) return [];
      return store.opportunities.filter(o => o.regId === selectedReg.value.id);
    });

    function selectReg(r) {
      selectedReg.value = r;
      customerSearch.value = '';
      showDropdown.value = false;
    }
    function clearReg() {
      selectedReg.value = null;
      customerSearch.value = '';
    }
    function onBlurSearch() {
      setTimeout(() => { showDropdown.value = false; }, 200);
    }
    function goRegNew() {
      const name = customerSearch.value;
      router.push('/registration/new' + (name ? '?customer=' + encodeURIComponent(name) : ''));
    }
    function isExpiring(r) {
      if (!r.expireAt) return false;
      const diff = (new Date(r.expireAt) - new Date()) / 86400000;
      return diff >= 0 && diff <= 30;
    }

    const form = reactive({
      name:'', stage:'prospecting',
      amount:0, endpoints:0, expectedClose:'', source:'渠道推荐', contactPerson:'', contactPhone:'',
      tags:[], notes:'', firstFollow:'',
    });
    const tagInput = ref('');
    const canSubmit = computed(() => form.name && selectedReg.value);
    function addTag() {
      const t = tagInput.value.trim();
      if (t && !form.tags.includes(t)) form.tags.push(t);
      tagInput.value = '';
    }
    function removeTag(t) { form.tags = form.tags.filter(x=>x!==t); }
    async function submit() {
      const reg = selectedReg.value;
      const followUps = form.firstFollow ? [{
        id:1, date:today(), type:'其他', content:form.firstFollow, user:store.user?.name?.slice(0,4)||'销售'
      }] : [];
      
      try {
        // 调用后端 API 创建商机
        const result = await apiClient.createOpportunity({
          name: form.name,
          customer: reg.customer,
          industry: reg.industry,
          contact: form.contactPerson || reg.contact,
          phone: form.contactPhone || reg.phone,
          stage: form.stage,
          amount: form.amount,
          endpoints: form.endpoints,
          source: form.source,
          contactPerson: form.contactPerson,
          contactPhone: form.contactPhone,
          ownerId: userId.value,
          createdBy: store.user.id,      // 统一使用员工ID，与过滤逻辑一致
          assignedStaffId: store.user.id, // 统一使用员工ID
          partnerId: store.user?.partnerId,
          partnerName: store.user?.partnerName,
          expectedClose: form.expectedClose,
          regId: reg.id,
          quoteId: null,
          tags: [...form.tags],
          notes: form.notes,
          followUps,
        });
        
        if (result.success) {
          // 将返回的数据添加到本地 store
          store.opportunities.unshift(result.data);
          store.notifications.unshift({ id:Date.now(), title:'新商机已创建', desc:`${form.name} — ${reg.customer}`, time:'刚刚', unread:true });
          alert('商机创建成功！');
          router.push('/opportunity');
        } else {
          alert('创建失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        console.error('创建商机失败:', err);
        alert('创建失败，请检查网络连接');
      }
    }
    return {
      form, tagInput, canSubmit, STAGES, addTag, removeTag, submit,
      customerSearch, showDropdown, selectedReg, filteredRegs, existingOpps, loadingRegs,
      selectReg, clearReg, onBlurSearch, goRegNew, isExpiring,
      fmt, stageLabel, stageTagClass,
    };
  }
};

// ── 路由 ─────────────────────────────────────────────────────
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', component: LoginPage },
    { path: '/login/singlesignonlogin/login.do', component: PartnerSingleSignOnPageV2 },
    {
      path: '/',
      component: MainLayout,
      children: [
        { path: 'dashboard', component: Dashboard },
        { path: 'opportunity', component: OpportunityList },
        { path: 'opportunity/new', component: OpportunityNew },
        { path: 'registration', component: RegistrationList },
        { path: 'registration/new', component: RegistrationNew },
        { path: 'quote', component: QuoteList },
        { path: 'quote/new', component: QuoteNew },
        { path: 'quote/edit/:id', component: QuoteNew },
        { path: 'order', component: OrderList },
        { path: 'products', component: Products },
      ]
    }
  ]
});

// ── 恢复登录状态 ─────────────────────────────────────────────
function restoreLoginState() {
  try {
    // 使用独立前缀读取登录状态
    const userInfo = localStorage.getItem('partner_user_info');
    const token = localStorage.getItem('partner_auth_token');
    if (userInfo && token) {
      const parsed = JSON.parse(userInfo);
      // 验证是员工或企业管理员角色，避免读取到管理员的登录状态
      if (parsed.role === 'staff' || parsed.role === 'partner_admin') {
        // 添加前缀信息（兼容旧数据）
        if (!parsed._storagePrefix) {
          parsed._storagePrefix = 'partner_';
        }
        store.user = parsed;
        // 同步到 apiClient 的 currentUser（修复报价单/商机/订单等列表查询的过滤参数问题）
        if (typeof syncUser === 'function') {
          syncUser(store.user);
        }
      }
    }
  } catch (err) {
    console.error('恢复登录状态失败:', err);
    localStorage.removeItem('partner_user_info');
    localStorage.removeItem('partner_auth_token');
  }
}
restoreLoginState();

// ── 路由守卫 ─────────────────────────────────────────────────
router.beforeEach((to, from) => {
  const publicPaths = ['/login', '/login/singlesignonlogin/login.do'];
  if (!publicPaths.includes(to.path) && !store.user) return '/login';
  if (to.path === '/login' && store.user) return '/dashboard';
});

// 清空前端内置演示占位数据，避免接口未返回时展示样例记录
store.opportunities = [];
store.notifications = [];
store.registrations = [];
store.quotes = [];
store.orders = [];
store.adminAccounts = [];
store.partners = [];

function normalizeNotifications(list) {
  return (Array.isArray(list) ? list : []).map(item => ({
    ...item,
    unread: item.unread !== false
  }));
}

async function loadNotificationsFromServer() {
  if (!store.user?.id) return;
  try {
    const res = await apiRequest('GET', `/notifications?userId=${encodeURIComponent(store.user.id)}`);
    if (res.success) {
      store.notifications = normalizeNotifications(res.data || []);
    }
  } catch (err) {
    console.warn('加载通知中心失败:', err);
  }
}

async function markNotificationRead(notification) {
  if (!notification) return;
  notification.unread = false;
  if (!store.user?.id || !notification.id) return;
  try {
    await apiRequest('PUT', '/notifications/read', {
      userId: store.user.id,
      notificationId: notification.id
    });
  } catch (err) {
    console.warn('标记通知已读失败:', err);
  }
}

async function markAllNotificationsRead() {
  if (!store.user?.id) return;
  try {
    await apiRequest('PUT', '/notifications/read', { userId: store.user.id });
  } catch (err) {
    console.warn('标记全部通知已读失败:', err);
  }
}

function escapeReminderHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

function formatReminderDays(daysLeft) {
  return Number(daysLeft) === 0 ? '今天到期' : `还有 ${daysLeft} 天到期`;
}

function getLoginDueReminders(loginResult) {
  if (Array.isArray(loginResult?.dueReminders) && loginResult.dueReminders.length) {
    return loginResult.dueReminders;
  }
  const dueNotice = (Array.isArray(loginResult?.notifications) ? loginResult.notifications : [])
    .find(item => item?.type === 'due_reminder' && Array.isArray(item.reminderItems) && item.reminderItems.length);
  return dueNotice?.reminderItems || [];
}

function ensureDueReminderDialogStyle() {
  if (typeof document === 'undefined' || document.getElementById('due-reminder-message-box-style')) return;
  const style = document.createElement('style');
  style.id = 'due-reminder-message-box-style';
  style.textContent = `
    .due-reminder-message-box { width: 760px; max-width: calc(100vw - 32px); }
    .due-reminder-message-box .el-message-box__message { width: 100%; }
    .due-reminder-message-box .el-message-box__content { max-height: calc(100vh - 220px); overflow-y: auto; }
    .due-reminder-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; align-items: start; }
    @media (max-width: 680px) {
      .due-reminder-message-box { width: calc(100vw - 24px); }
      .due-reminder-grid { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}

function renderDueReminderSection(title, badgeText, items, accentColor) {
  const renderItem = item => `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid #edf0f5;border-radius:8px;background:#fff;margin-top:8px">
    <div style="width:8px;height:8px;border-radius:50%;background:${accentColor};margin-top:8px;flex:0 0 auto"></div>
    <div style="min-width:0;flex:1">
      <div style="font-size:14px;font-weight:600;color:#1f2937;white-space:normal;word-break:break-word">${escapeReminderHtml(item.targetName || item.customer || item.targetId)}</div>
      <div style="margin-top:4px;font-size:12px;color:#6b7280">
        <span style="color:${accentColor};font-weight:600">${escapeReminderHtml(formatReminderDays(item.daysLeft))}</span>
        <span style="margin-left:8px">截止日期：${escapeReminderHtml(item.dueDate || '')}</span>
      </div>
      ${item.customer && item.customer !== item.targetName ? `<div style="margin-top:2px;font-size:12px;color:#9ca3af">客户：${escapeReminderHtml(item.customer)}</div>` : ''}
    </div>
  </div>`;
  const visibleItems = items.slice(0, 5).map(renderItem).join('');
  const hiddenItems = items.slice(5).map(renderItem).join('');
  const moreBlock = hiddenItems ? `<details style="margin-top:8px">
    <summary style="cursor:pointer;color:#1677ff;font-size:13px;outline:none">展开更多 ${items.length - 5} 条</summary>
    <div style="margin-top:4px">${hiddenItems}</div>
  </details>` : '';
  const emptyBlock = !items.length ? `<div style="padding:24px 12px;margin-top:8px;border:1px dashed #d9dee8;border-radius:8px;background:#fff;color:#9ca3af;text-align:center;font-size:13px">暂无到期提醒</div>` : '';

  return `<div style="padding:12px;border:1px solid #e7eaf0;border-radius:10px;background:#f9fafc">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="font-size:15px;font-weight:700;color:#111827">${escapeReminderHtml(title)}</div>
      <div style="padding:2px 8px;border-radius:999px;background:${accentColor}14;color:${accentColor};font-size:12px;font-weight:600">${escapeReminderHtml(badgeText)}</div>
    </div>
    ${visibleItems}${moreBlock}${emptyBlock}
  </div>`;
}

function showLoginDueReminderDialog(reminders) {
  const list = Array.isArray(reminders) ? reminders : [];
  if (!list.length) return;

  const opportunityItems = list.filter(item => item.type === 'opportunity');
  const registrationItems = list.filter(item => item.type === 'registration');
  const summary = `共 ${list.length} 条到期提醒，请及时跟进处理。`;
  const html = `<div style="text-align:left;line-height:1.7">
    <div style="padding:12px 14px;border-radius:10px;background:#f0f7ff;color:#1f2937;font-size:14px">
      <div style="font-weight:700;margin-bottom:2px">30 天内到期提醒</div>
      <div style="color:#4b5563">${escapeReminderHtml(summary)}</div>
    </div>
    <div class="due-reminder-grid" style="margin-top:14px">
      ${renderDueReminderSection('商机预计签约时间', `${opportunityItems.length} 条`, opportunityItems, '#1677ff')}
      ${renderDueReminderSection('客户报备保护期', `${registrationItems.length} 条`, registrationItems, '#fa8c16')}
    </div>
  </div>`;

  const messageBox = typeof ElementPlus !== 'undefined' ? ElementPlus.ElMessageBox : null;
  if (messageBox?.alert) {
    ensureDueReminderDialogStyle();
    messageBox.alert(html, '到期提醒', {
      dangerouslyUseHTMLString: true,
      confirmButtonText: '知道了',
      customClass: 'due-reminder-message-box'
    }).catch(() => {});
    return;
  }

  alert(['到期提醒', summary, ...list.map(item => `${item.message || item.targetName}（${item.dueDate || ''}）`)].join('\n'));
}

if (store.user) {
  loadNotificationsFromServer();
}

// ── 挂载 ─────────────────────────────────────────────────────
const app = createApp({
  template: `<router-view />`
});
app.use(router);
app.use(ElementPlus);
app.mount('#app');
