// ============================================================
// 联软安全产品渠道管理平台 — 主应用
// Vue 3 + Vue Router (CDN) + Element Plus
// ============================================================

const { createApp, ref, reactive, computed, watch, onMounted, nextTick } = Vue;
const { createRouter, createWebHashHistory } = VueRouter;

// API 基础配置
if (typeof window.API_BASE === 'undefined') {
  window.API_BASE = 'http://localhost:3000/api';
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
function toMoneyNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = typeof value === 'string'
    ? value.replace(/[,，\s￥¥元]/g, '')
    : value;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}
function normalizeOpportunityRecord(opp, options = {}) {
  const record = { ...(opp || {}) };
  if (Object.prototype.hasOwnProperty.call(record, 'amount')) {
    record.amount = toMoneyNumber(record.amount);
  }
  if (options.ensureArrays || Object.prototype.hasOwnProperty.call(record, 'followUps')) {
    record.followUps = Array.isArray(record.followUps) ? record.followUps : [];
  }
  if (options.ensureArrays || Object.prototype.hasOwnProperty.call(record, 'tags')) {
    record.tags = Array.isArray(record.tags) ? record.tags : [];
  }
  return record;
}
function normalizeOpportunityList(list) {
  return Array.isArray(list) ? list.map(opp => normalizeOpportunityRecord(opp, { ensureArrays: true })) : [];
}
function sumOpportunityAmount(list) {
  return (Array.isArray(list) ? list : []).reduce((sum, opp) => sum + toMoneyNumber(opp?.amount), 0);
}
function fmt(n) {
  if (!n && n !== 0) return '—';
  return '¥ ' + toMoneyNumber(n).toLocaleString('zh-CN');
}
function fmtNum(n) {
  if (!n && n !== 0) return '—';
  return Number(n).toLocaleString('zh-CN');
}
function today() {
  return new Date().toISOString().slice(0,10);
}
function genId(prefix) {
  return prefix + '-' + Date.now().toString().slice(-6);
}

// ── 登录页 ───────────────────────────────────────────────────
const LoginPage = {
  template: `
  <div class="login-page">
    <div class="login-bg-circles"><span/><span/><span/></div>
    <div class="login-card">
      <div class="login-logo">
        <div class="logo-icon">🛡️</div>
        <h1>联软渠道管理平台</h1>
        <p>UniSoft Channel Management System</p>
      </div>
      <div class="login-tabs">
        <div class="login-tab" :class="{active: role==='partner'}" @click="role='partner'">渠道合作伙伴</div>
        <div class="login-tab" :class="{active: role==='admin'}" @click="role='admin'">厂商管理员</div>
      </div>
      <div class="form-item" style="margin-bottom:14px">
        <label class="form-label">账号</label>
        <input class="form-control" v-model="username" :placeholder="role==='partner'?'请输入合作伙伴账号':'请输入管理员账号'" @keyup.enter="doLogin"/>
      </div>
      <div class="form-item" style="margin-bottom:20px">
        <label class="form-label">密码</label>
        <input class="form-control" type="password" v-model="password" placeholder="请输入密码" @keyup.enter="doLogin"/>
      </div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;padding:11px;font-size:15px" @click="doLogin">
        {{ loading ? '登录中...' : '登 录' }}
      </button>
      <p v-if="errMsg" style="color:#ff4d4f;font-size:13px;text-align:center;margin-top:12px">{{ errMsg }}</p>
      <div class="login-footer">
        <p>请使用已分配的账号登录。</p>
        <p style="margin-top:2px;color:#bbb">如需开通账号或重置密码，请联系系统管理员。</p>
        <p style="margin-top:4px">© 2026 联软科技 · 渠道管理平台 v2.0</p>
      </div>
    </div>
  </div>`,
  setup() {
    const router = VueRouter.useRouter();
    const role = ref('partner');
    const username = ref('');
    const password = ref('');
    const loading = ref(false);
    const errMsg = ref('');
    
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
    
    // 统一的 API 请求函数
    async function apiRequest(method, endpoint, body = null) {
      const options = { method, headers: { 'Content-Type': 'application/json' } };
      if (body) options.body = JSON.stringify(body);
      const res = await fetch(`${window.API_BASE}${endpoint}`, options);
      return res.json();
    }
    
    async function doLogin() {
      errMsg.value = '';
      if (!username.value || !password.value) { errMsg.value = '请输入账号和密码'; return; }
      loading.value = true;
      
      // 调用后端 API 登录（统一验证员工和管理员）
      try {
        const res = await apiRequest('POST', '/auth/login', {
          username: username.value,
          password: password.value
        });
        
        if (res.error) {
          errMsg.value = res.error;
          loading.value = false;
          return;
        }
        
        // 员工账号
        if (res.user.role === 'staff') {
          store.user = {
            name: res.user.name,
            role: 'staff',
            avatar: res.user.name.slice(0,1),
            username: username.value,
            id: res.user.id,        // 使用后端返回的 id，与数据一致
            staffId: res.user.id,
            partnerId: res.user.partnerId,
            partnerName: res.user.partnerName,
            region: res.user.region,
            email: res.user.email,
            phone: res.user.phone
          };
        }
        // 管理员账号（超级管理员/区域管理员）
        else if (res.user.role === 'admin' || res.user.role === 'superadmin') {
          store.user = {
            name: res.user.name,
            role: res.user.role,
            avatar: res.user.name.slice(0,1),
            region: res.user.region,
            bigRegion: res.user.bigRegion,
            username: username.value,
            id: res.user.id
          };
        } else {
          errMsg.value = '不支持的账号类型';
          loading.value = false;
          return;
        }
        
        // 保存登录状态
        localStorage.setItem('api_user', JSON.stringify({ user: store.user, token: res.token }));
        
        loading.value = false;
        router.push('/dashboard');
      } catch (err) {
        errMsg.value = '登录失败：' + err.message;
        loading.value = false;
      }
    }
    return { role, username, password, loading, errMsg, doLogin };
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

        <template v-if="isAdmin">
          <div class="nav-group-title">管理后台</div>
          <div class="nav-item" :class="{active:$route.path==='/partner-report'}" @click="go('/partner-report')">
            <span class="nav-icon">📈</span> 经营报表
          </div>
          <div class="nav-item" :class="{active:$route.path==='/partners'}" @click="go('/partners')">
            <span class="nav-icon">🤝</span> 渠道商管理
          </div>
          <div class="nav-item" :class="{active:$route.path==='/admin-review'}" @click="go('/admin-review')">
            <span class="nav-icon">✅</span> 审核中心
            <span class="nav-badge" v-if="reviewCount">{{ reviewCount }}</span>
          </div>
          <div class="nav-item" v-if="isSuperAdmin" :class="{active:$route.path==='/account-manage'}" @click="go('/account-manage')">
            <span class="nav-icon">👤</span> 账号管理
          </div>
        </template>
      </nav>
      <div class="sidebar-footer">
        <div class="user-card">
          <div class="user-avatar">{{ store.user.avatar }}</div>
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
        <div v-for="n in store.notifications" :key="n.id" class="notif-item" :class="{unread:n.unread}" @click="n.unread=false">
          <div class="ni-title">{{ n.title }}</div>
          <div class="ni-desc">{{ n.desc }}</div>
          <div class="ni-time">{{ n.time }}</div>
        </div>
      </div>
    </div>
    <div v-if="showNotif" style="position:fixed;inset:0;z-index:997" @click="showNotif=false"></div>
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
  </div>`,
  setup() {
    const router = VueRouter.useRouter();
    const route = VueRouter.useRoute();
    const showNotif = ref(false);
    const showChangePassword = ref(false);
    const passwordForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' });
    const passwordError = ref('');
    const passwordLoading = ref(false);
    const isAdmin = computed(() => store.user?.role === 'admin' || store.user?.role === 'superadmin');
    const isSuperAdmin = computed(() => store.user?.role === 'superadmin');
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
      '/partner-report': '经营报表',
      '/partners': '渠道商管理',
      '/admin-review': '审核中心',
      '/account-manage': '账号管理',
      '/admin-review': '审核中心',
    };
    const pageTitle = computed(() => {
      for (const [k,v] of Object.entries(pageTitles)) {
        if (route.path.startsWith(k) && route.path !== '/') return v;
      }
      return '工作台';
    });
    function go(p) { router.push(p); }
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
        const resp = await apiRequest('/auth/change-password', {
          method: 'POST',
          data: { oldPassword, newPassword }
        });
        if (resp.success) {
          alert('密码修改成功');
          showChangePassword.value = false;
        } else {
          passwordError.value = resp.error || '密码修改失败';
        }
      } catch(e) {
        passwordError.value = '网络错误，请稍后重试';
      } finally {
        passwordLoading.value = false;
      }
    }
    function logout() {
      if (confirm('确认退出登录？')) { store.user = null; router.push('/login'); }
    }
    function markAllRead() { store.notifications.forEach(n => n.unread = false); }
    return { store, showNotif, showChangePassword, passwordForm, passwordError, passwordLoading, isAdmin, isSuperAdmin, unreadCount, pendingCount, hotOppCount, reviewCount, pageTitle, go, logout, openChangePassword, doChangePassword, markAllRead };
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
        <span v-if="isStaff" class="tag tag-orange" style="margin-left:8px;font-size:12px">👤 个人数据</span>
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
            <thead><tr><th>商机名称</th><th>阶段</th><th>金额</th><th>概率</th></tr></thead>
            <tbody>
              <tr v-for="o in myOpportunities.slice(0,4)" :key="o.id" style="cursor:pointer">
                <td style="font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ o.name }}</td>
                <td><span class="tag" :class="stageTagClass(o.stage)" style="font-size:11px">{{ stageLabel(o.stage) }}</span></td>
                <td style="font-weight:700;color:#1677ff">{{ fmt(o.amount) }}</td>
                <td style="font-size:12px;font-weight:600" :style="{color:probColor(o.probability)}">{{ o.probability }}%</td>
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
    // 员工隔离
    const userId = computed(() => store.user?.staffId || store.user?.username || '');
    const isStaff = computed(() => store.user?.role === 'staff');
    
    // 从后端加载真实数据
    async function loadRealData() {
      // 构建查询参数
      const params = new URLSearchParams();
      if (isStaff.value && userId.value) {
        params.append('userId', userId.value);
      } else if (adminRegion.value) {
        params.append('region', adminRegion.value);
      }
      
      // 并行加载报备、报价单、订单数据
      try {
        const [regRes, quoteRes, orderRes, oppRes] = await Promise.all([
          fetch(`${window.API_BASE}/registrations?${params.toString()}`).then(r => r.json()),
          fetch(`${window.API_BASE}/quotes?${params.toString()}`).then(r => r.json()),
          fetch(`${window.API_BASE}/orders?${params.toString()}`).then(r => r.json()),
          fetch(`${window.API_BASE}/opportunities?${params.toString()}`).then(r => r.json()),
        ]);
        
        // 合并报备数据（直接替换整个数组，确保响应式更新）
        if (regRes.success) {
          // 保留示例数据的 ID 集合（示例数据没有 createdBy 字段）
          const sampleIds = new Set(store.registrations.filter(r => !r.createdBy).map(r => r.id));
          // 合并：保留示例数据 + 添加/更新后端数据
          const merged = [];
          const backendMap = new Map(regRes.data.map(r => [r.id, r]));
          // 先添加示例数据
          store.registrations.forEach(r => {
            if (sampleIds.has(r.id) && !backendMap.has(r.id)) {
              merged.push(r);
            }
          });
          // 再添加后端数据
          merged.push(...regRes.data);
          store.registrations = merged;
        }
        
        // 合并报价单数据（直接替换确保响应式）
        if (quoteRes.success) {
          const sampleIds = new Set(store.quotes.filter(q => !q.createdBy).map(q => q.id));
          const merged = [];
          const backendMap = new Map(quoteRes.data.map(q => [q.id, q]));
          store.quotes.forEach(q => {
            if (sampleIds.has(q.id) && !backendMap.has(q.id)) {
              merged.push(q);
            }
          });
          merged.push(...quoteRes.data);
          store.quotes = merged;
        }
        
        // 合并订单数据（直接替换确保响应式）
        if (orderRes.success) {
          const sampleIds = new Set(store.orders.filter(o => !o.createdBy).map(o => o.id));
          const merged = [];
          const backendMap = new Map(orderRes.data.map(o => [o.id, o]));
          store.orders.forEach(o => {
            if (sampleIds.has(o.id) && !backendMap.has(o.id)) {
              merged.push(o);
            }
          });
          merged.push(...orderRes.data);
          store.orders = merged;
        }
        
        // 合并商机数据（直接替换确保响应式）
        if (oppRes.success) {
          const sampleIds = new Set(store.opportunities.filter(o => !o.createdBy).map(o => o.id));
          const merged = [];
          const normalizedData = normalizeOpportunityList(oppRes.data);
          const backendMap = new Map(normalizedData.map(o => [o.id, o]));
          store.opportunities.forEach(o => {
            if (sampleIds.has(o.id) && !backendMap.has(o.id)) {
              merged.push(o);
            }
          });
          merged.push(...normalizedData);
          store.opportunities = merged;
        }
      } catch (err) {
        console.error('加载数据失败:', err);
      }
    }
    
    onMounted(loadRealData);
    
    // 辅助函数：获取报备的区域
    function getRegRegion(regId) {
      const reg = store.registrations.find(r => r.id === regId);
      return reg ? reg.region : null;
    }
    
    // 本区域/本人商机
    const myOpportunities = computed(() => {
      if (isStaff.value) {
        // 员工：自己创建的商机 + 被指派给自己的商机
        return store.opportunities.filter(o =>
          o.ownerId === userId.value ||
          o.createdBy === userId.value ||
          o.assignedStaffId === userId.value ||
          o.assignedStaffUserId === userId.value
        );
      }
      if (adminRegion.value) {
        // 区域管理员看本区域商机
        return store.opportunities.filter(o => {
          const region = o.region || getRegRegion(o.regId);
          return region === adminRegion.value;
        });
      }
      // 超级管理员看全部
      return store.opportunities;
    });
    
    // 本区域/本人报备
    const myRegistrations = computed(() => {
      if (isStaff.value) {
        // 员工：自己创建的报备 + 被指派给自己的报备
        return store.registrations.filter(r => 
          r.createdBy === userId.value || 
          r.owner === userId.value ||
          r.assignedStaffId === userId.value ||
          r.assignedStaffUserId === userId.value
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
      if (isStaff.value) {
        // 员工：自己创建的报价单 + 被指派给自己的报价单
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
      if (isStaff.value) {
        // 员工：自己创建的订单 + 被指派给自己的订单
        return store.orders.filter(o => 
          o.createdBy === userId.value || 
          o.assignedStaffId === userId.value ||
          o.assignedStaffUserId === userId.value
        );
      }
      if (adminRegion.value) {
        // 区域管理员看本区域订单
        return store.orders.filter(o => {
          const region = o.region || (store.registrations.find(r => r.customer === o.customer)?.region);
          return region === adminRegion.value;
        });
      }
      // 超级管理员看全部
      return store.orders;
    });
    
    const totalOrderAmt = computed(() => myOrders.value.reduce((s,o)=>s+o.total,0));
    const totalOppAmt = computed(() => sumOpportunityAmount(myOpportunities.value));
    const productHighlights = [
      { icon:'🖥️', name:'桌面安全管理', count:4 },
      { icon:'🔒', name:'网络准入控制', count:2 },
      { icon:'🦠', name:'防病毒/EDR', count:2 },
      { icon:'🚫', name:'数据防泄漏', count:8 },
      { icon:'🔐', name:'文档加密', count:1 },
    ];
    const stageConfig = [
      { key:'prospecting', label:'线索', color:'#bae0ff', maxH:80 },
      { key:'qualification', label:'需求确认', color:'#91caff', maxH:80 },
      { key:'proposal', label:'方案报价', color:'#4096ff', maxH:80 },
      { key:'negotiation', label:'商务谈判', color:'#1677ff', maxH:80 },
      { key:'closing', label:'签约中', color:'#0958d9', maxH:80 },
    ];
    const funnelStages = computed(() => {
      const maxCount = Math.max(...stageConfig.map(s => myOpportunities.value.filter(o=>o.stage===s.key).length), 1);
      return stageConfig.map(s => {
        const opps = myOpportunities.value.filter(o=>o.stage===s.key);
        return {
          ...s,
          count: opps.length,
          amount: sumOpportunityAmount(opps),
          height: Math.max(20, Math.round((opps.length / maxCount) * s.maxH)),
        };
      });
    });
    function statusClass(s) { return { approved:'tag-green', pending:'tag-orange', reviewing:'tag-blue', expired:'tag-gray', rejected:'tag-red' }[s]||'tag-gray'; }
    function statusLabel(s) { return { approved:'已通过', pending:'待审核', reviewing:'审核中', expired:'已过期', rejected:'已拒绝' }[s]||s; }
    function quoteStatusClass(s) { return { draft:'tag-gray', sent:'tag-blue', confirmed:'tag-green', expired:'tag-red' }[s]||'tag-gray'; }
    function quoteStatusLabel(s) { return { draft:'草稿', sent:'已发送', confirmed:'已确认', expired:'已过期' }[s]||s; }
    return { store, adminRegion, isStaff, myOpportunities, myRegistrations, myQuotes, myOrders, fmt, go, totalOrderAmt, totalOppAmt, productHighlights, funnelStages,
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
              <th>报备日期</th><th>保护期至</th><th>操作</th>
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
              <td @click.stop>
                <button class="btn btn-text btn-sm" @click="$router.push('/opportunity/new?regId='+r.id)" v-if="r.status==='approved'" style="color:#1677ff">🎯 报备商机</button>
              </td>
            </tr>
            <tr v-if="!filtered.length"><td colspan="8"><div class="empty-state"><div class="empty-icon">📋</div><p>暂无报备记录</p></div></td></tr>
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
    
    // 区域管理员隔离
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    // 员工隔离：获取当前用户ID
    const userId = computed(() => store.user?.staffId || store.user?.username || '');
    const isStaff = computed(() => store.user?.role === 'staff');
    
    // 本区域报备（管理员）或本人的报备（员工）
    const myRegistrations = computed(() => {
      if (isStaff.value) {
        // 员工：自己创建的报备 + 被指派给自己的报备
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
    
    const filtered = computed(() => myRegistrations.value.filter(r => {
      const matchKw = !kw.value || r.customer.includes(kw.value) || r.contact.includes(kw.value);
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
      regOrders, regOrderTotal, regOpportunities, stageColor, stageLabel, stageTagClass, fmt };
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
            <input 
              class="form-control" 
              v-model="form.customer" 
              placeholder="例：北京某科技有限公司，输入2个字后自动搜索"
              @input="onCustomerInput"
              @blur="hideEnterpriseList"
              @focus="onCustomerInput"
            />
            <!-- 企业搜索下拉列表 -->
            <div v-if="showEnterpriseList && enterpriseList.length > 0" class="enterprise-dropdown">
              <div 
                v-for="item in enterpriseList" 
                :key="item.creditCode"
                class="enterprise-item"
                @mousedown.prevent="selectEnterprise(item)"
              >
                <div class="enterprise-name">{{ item.name }}</div>
                <div class="enterprise-code">{{ item.creditCode }}</div>
              </div>
            </div>
          </div>
          <div class="form-item full">
            <label class="form-label required">统一社会信用代码</label>
            <input 
              class="form-control" 
              v-model="form.creditCode" 
              placeholder="18位统一社会信用代码"
              maxlength="18"
              @blur="validateCreditCodeInput"
            />
            <span v-if="creditCodeError" class="field-error">{{ creditCodeError }}</span>
          </div>
          <div class="form-item"><label class="form-label required">所属行业</label>
            <select class="form-control" v-model="form.industry">
              <option value="">请选择</option>
              <option v-for="i in industries" :key="i">{{ i }}</option>
            </select>
          </div>
          <div class="form-item"><label class="form-label required">客户省份/城市</label><input class="form-control" v-model="form.city" placeholder="例：北京市朝阳区"/></div>
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
        <div style="display:flex;justify-content:flex-end;margin-top:24px;gap:10px">
          <button class="btn btn-default" @click="$router.back()">取消</button>
          <button class="btn btn-primary" @click="goToNext" :disabled="!isStep1Valid">下一步</button>
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
            <div><span style="color:#888">统一社会信用代码：</span>{{ form.creditCode }}</div>
            <div><span style="color:#888">所属行业：</span>{{ form.industry }}</div>
            <div><span style="color:#888">联系人：</span>{{ form.contact }}</div>
            <div><span style="color:#888">联系电话：</span>{{ form.phone }}</div>
            <div><span style="color:#888">城市：</span>{{ form.city }}</div>
            <div><span style="color:#888">邮箱：</span>{{ form.email || '-' }}</div>
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
      customer:'', creditCode:'', industry:'', city:'', contact:'', phone:'', email:'',
      project:'', endpointRange:'', estimatedAmt:'', signDate:'', protectDays:'180', notes:''
    });
    
    // 企业搜索相关
    const showEnterpriseList = ref(false);
    const enterpriseList = ref([]);
    const creditCodeError = ref('');
    const phoneError = ref('');
    let searchTimeout = null;
    
    // 支持从其他页面跳转时预填客户名
    onMounted(() => {
      if (route.query.customer) form.customer = decodeURIComponent(route.query.customer);
    });
    
    // 获取当前用户所属区域（渠道合作伙伴从store.user.region获取）
    const userRegion = computed(() => store.user?.region || '');
    // 获取当前用户ID（员工使用staffId，管理员使用username）
    const userId = computed(() => store.user?.staffId || store.user?.username || '');
    
    // 客户名称输入处理 - 防抖搜索
    function onCustomerInput() {
      if (searchTimeout) clearTimeout(searchTimeout);
      
      const keyword = form.customer.trim();
      if (keyword.length < 2) {
        showEnterpriseList.value = false;
        enterpriseList.value = [];
        return;
      }
      
      searchTimeout = setTimeout(() => {
        if (typeof window.searchEnterprises === 'function') {
          enterpriseList.value = window.searchEnterprises(keyword);
          showEnterpriseList.value = enterpriseList.value.length > 0;
        }
      }, 300);
    }
    
    // 隐藏企业列表（延迟，允许点击）
    function hideEnterpriseList() {
      setTimeout(() => {
        showEnterpriseList.value = false;
      }, 200);
    }
    
    // 选择企业
    function selectEnterprise(enterprise) {
      form.customer = enterprise.name;
      form.creditCode = enterprise.creditCode;
      form.city = enterprise.address;
      showEnterpriseList.value = false;
      creditCodeError.value = '';
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
      
      // 构建提交数据
      const submitData = {
        customer: form.customer,
        creditCode: form.creditCode,
        industry: form.industry,
        contact: form.contact,
        phone: form.phone,
        email: form.email,
        city: form.city,
        status: 'pending',
        region: userRegion.value,
        createdBy: store.user.id,      // 统一使用员工ID，与过滤逻辑一致
        assignedStaffId: store.user.id, // 统一使用员工ID
        createdAt: today(),
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
        submitData.expireAt = expDate.toISOString().slice(0,10);
        submitData.notes = form.notes;
      }
      
      try {
        const result = await apiClient.createRegistration(submitData);
        if (result.success) {
          store.registrations.unshift(result.data);
          store.notifications.unshift({ id: Date.now(), title:'报备已提交', desc:`${form.customer} 报备申请已提交，等待厂商审核`, time:'刚刚', unread:true });
          alert('报备提交成功！等待厂商审核。');
          router.push('/registration');
        } else {
          alert('报备提交失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        alert('报备提交失败：' + err.message);
      } finally {
        submitting.value = false;
      }
    }
    return { 
      step, form, submitting, hasOpportunity, industries, 
      showEnterpriseList, enterpriseList, creditCodeError, phoneError,
      isStep1Valid,
      onCustomerInput, hideEnterpriseList, selectEnterprise, 
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
            <tr><th>报价单号</th><th>客户</th><th>项目名称</th><th>端点数</th><th>报价总额</th><th>状态</th><th>创建日期</th><th>有效期</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="q in filtered" :key="q.id" @click="view(q)" class="clickable-row">
              <td style="font-family:monospace;color:#888;font-size:12px">{{ q.id }}</td>
              <td style="font-weight:600">{{ q.customer }}</td>
              <td>
                <span v-if="q.oppId" style="font-size:12px;color:#555">{{ getOppName(q.oppId) }}</span>
                <span v-else style="color:#aaa;font-size:12px">—</span>
              </td>
              <td>{{ q.endpoints }} 台</td>
              <td style="font-weight:700;color:#1677ff">{{ fmt(q.total) }}</td>
              <td><span class="tag" :class="qClass(q.status)">{{ qLabel(q.status) }}</span></td>
              <td style="font-size:12px;color:#888">{{ q.createdAt }}</td>
              <td style="font-size:12px;color:#888">{{ q.validDays }} 天</td>
              <td @click.stop>
                <button class="btn btn-text btn-sm" @click="toOrder(q)" v-if="q.status==='confirmed'">转订单</button>
              </td>
            </tr>
            <tr v-if="!filtered.length"><td colspan="9"><div class="empty-state"><div class="empty-icon">💰</div><p>暂无报价记录</p></div></td></tr>
          </tbody>
        </table>
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
              <div class="quote-meta-item"><label>端点数量</label><span>{{ detail.endpoints }} 台</span></div>
              <div class="quote-meta-item"><label>报价状态</label><span>{{ {draft:'草稿',sent:'已发送',confirmed:'已确认',expired:'已过期'}[detail.status]||detail.status }}</span></div>
            </div>
          </div>
          <div class="quote-body">
            <div class="quote-section-title">产品明细 <span></span></div>
            <div class="table-wrap">
              <table class="quote-table">
                <thead><tr><th>#</th><th>产品名称</th><th>数量</th><th>小计（元）</th></tr></thead>
                <tbody>
                  <tr v-for="(p,i) in detailItems" :key="i">
                    <td>{{ i+1 }}</td>
                    <td>{{ p.name }}</td>
                    <td>{{ p.qtyLabel || (detail.endpoints + ' 台') }}</td>
                    <td style="font-weight:700">{{ fmt(p.subtotal) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="quote-total">
              <div class="quote-total-box">
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
          <button class="btn btn-primary" @click="toOrder(detail);detail=null" v-if="detail.status==='confirmed'">转为订单</button>
        </div>
      </div>
    </div>
  </div>`,
  setup() {
    const router = VueRouter.useRouter();
    const kw = ref('');
    const detail = ref(null);
    const quoteFeatures = ref([]);
    const quoteHardware = ref([]);
    const STANDARD_MAINTENANCE_FEATURE_ID = 'FEAT-MOD-MAINTENANCE-01-01';
    const DEFAULT_MAINTENANCE_MONTHS = 12;
    const DEFAULT_STANDARD_MAINTENANCE_RATE = 15;
    
    // 区域管理员隔离
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    // 员工隔离
    const userId = computed(() => store.user?.staffId || store.user?.username || '');
    const isStaff = computed(() => store.user?.role === 'staff');
    
    // 辅助函数：获取报备的区域
    function getRegRegion(regId) {
      const reg = store.registrations.find(r => r.id === regId);
      return reg ? reg.region : null;
    }
    
    // 本区域报价单（管理员）或本人的报价单（员工）
    const myQuotes = computed(() => {
      if (isStaff.value) {
        // 员工：自己创建的报价单 + 被指派给自己的报价单
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

    function isStandardMaintenanceFeature(featureOrId) {
      const featureId = typeof featureOrId === 'string' ? featureOrId : featureOrId?.id;
      return featureId === STANDARD_MAINTENANCE_FEATURE_ID;
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

    function getQuoteBaseFeatureSubtotal(feat, endpoints) {
      if (!feat) return 0;
      const qty = Number(endpoints) || 0;
      if (isStandardMaintenanceFeature(feat)) return 0;
      if (feat.priceFixed) return feat.priceFixed * (feat.discount || 1);
      if (feat.tiers && feat.tiers.length) {
        const tier = feat.tiers.find(t => qty >= t.min && qty <= t.max) || feat.tiers[0];
        if (tier) {
          const price = feat.unitPrice ? feat.unitPrice * tier.discount : (tier.price || 0);
          return price * qty;
        }
      }
      if (feat.unitPrice) return feat.unitPrice * qty;
      return 0;
    }

    function calculateQuoteMaintenanceSubtotal(quote, features) {
      const maintenanceFeature = features.find(isStandardMaintenanceFeature);
      if (!maintenanceFeature) return 0;
      const rateMap = getMaintenanceRateMap(maintenanceFeature);
      const annualPrice = features
        .filter(feat => !isStandardMaintenanceFeature(feat))
        .reduce((sum, feat) => {
          if (!feat?.moduleId) return sum;
          const rate = Number.isFinite(rateMap[feat.moduleId]) ? rateMap[feat.moduleId] : DEFAULT_STANDARD_MAINTENANCE_RATE;
          return sum + getQuoteBaseFeatureSubtotal(feat, quote?.endpoints) * rate / 100;
        }, 0);
      return Math.round(annualPrice * DEFAULT_MAINTENANCE_MONTHS / DEFAULT_MAINTENANCE_MONTHS);
    }

    function getComplimentaryWarrantyItem() {
      return {
        id: 'gift-standard-warranty-1y',
        name: '标准质保服务（赠送1年）',
        productCode: 'GIFT-WARRANTY-1Y',
        type: '服务',
        qty: 1,
        qtyLabel: '1 年',
        qtyDisplay: '1 年',
        unitPrice: 0,
        subtotal: 0
      };
    }

    async function loadQuoteCatalog() {
      try {
        const [featureRes, hardwareRes] = await Promise.all([
          fetch(`${window.API_BASE}/features`),
          fetch(`${window.API_BASE}/hardware`)
        ]);
        const [featureData, hardwareData] = await Promise.all([featureRes.json(), hardwareRes.json()]);
        if (featureData.success) quoteFeatures.value = featureData.data || [];
        if (hardwareData.success) quoteHardware.value = hardwareData.data || [];
      } catch (err) {
        console.error('加载报价单产品目录失败:', err);
      }
    }
    
    const detailItems = computed(() => {
      if (!detail.value) return [];
      const featureList = (detail.value.products || []).map(pid => quoteFeatures.value.find(item => item.id === pid)).filter(Boolean);
      const featureItems = featureList.map(feature => ({
        id: feature.id,
        name: feature.name,
        qtyLabel: isStandardMaintenanceFeature(feature) ? `${DEFAULT_MAINTENANCE_MONTHS} 月` : `${detail.value.endpoints} 台`,
        subtotal: isStandardMaintenanceFeature(feature)
          ? calculateQuoteMaintenanceSubtotal(detail.value, featureList)
          : Math.round(getQuoteBaseFeatureSubtotal(feature, detail.value.endpoints))
      }));
      const hardwareItems = (detail.value.hardwareIds || []).map(hid => {
        const hw = quoteHardware.value.find(item => item.id === hid);
        if (!hw) return null;
        return {
          id: hw.id,
          name: hw.name,
          qtyLabel: `1 ${hw.unit || '台'}`,
          subtotal: hw.priceFixed || 0
        };
      }).filter(Boolean);
      return [...featureItems, getComplimentaryWarrantyItem(), ...hardwareItems];
    });
    const filtered = computed(() => myQuotes.value.filter(q => !kw.value || q.customer.includes(kw.value) || q.id.includes(kw.value)));
    function qClass(s) { return { draft:'tag-gray', sent:'tag-blue', confirmed:'tag-green', expired:'tag-red' }[s]||'tag-gray'; }
    function qLabel(s) { return { draft:'草稿', sent:'已发送', confirmed:'已确认', expired:'已过期' }[s]||s; }
    function view(q) { detail.value = q; }
    function getOppName(oppId) {
      const opp = store.opportunities.find(o => o.id === oppId);
      return opp ? opp.name : oppId;
    }
    onMounted(loadQuoteCatalog);
    async function toOrder(q) {
      const existing = store.orders.find(o => o.quoteId === q.id);
      if (existing) { alert('该报价单已转为订单：' + existing.id); return; }
      const reg = store.registrations.find(r => r.id === q.regId);
      
      const orderData = {
        quoteId: q.id,
        customer: q.customer,
        total: q.total,
        status: 'pending',
        deliveryAddr: reg ? reg.city || '待填写' : '待填写',
        contacts: reg ? `${reg.contact} ${reg.phone}` : '待填写',
        oppId: q.oppId || '',
        regId: q.regId || '',
        endpoints: q.endpoints || 0,
        products: q.products || [],
        createdBy: q.createdBy || store.user.id,      // 从报价单继承创建者，否则使用员工ID
        assignedStaffId: q.assignedStaffId || store.user.id // 从报价单继承员工ID
      };
      
      try {
        const result = await apiClient.createOrder(orderData);
        if (result.success) {
          store.orders.unshift(result.data);
          alert('已成功转为订单，请在订单管理中查看。');
          router.push('/order');
        } else {
          alert('创建订单失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        alert('创建订单失败：' + err.message);
      }
    }
    function downloadPdf(q) {
      // 获取报价单内容区 HTML
      const area = document.getElementById('quote-print-area');
      if (!area) return;
      // 收集依赖样式
      const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(l => `<link rel="stylesheet" href="${l.href}">`)
        .join('');
      const styleTags = Array.from(document.querySelectorAll('style'))
        .map(s => `<style>${s.innerHTML}</style>`)
        .join('');
      const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>报价单 — ${q.id} — ${q.customer}</title>
  ${styleLinks}
  ${styleTags}
  <style>
    @page { size: A4; margin: 15mm 12mm; }
    body { background: #fff !important; font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif; }
    .print-only { display: block !important; }
    .modal, .modal-overlay, .modal-header, .modal-footer { all: unset; display: block; }
    /* 隐藏不需要的部分 */
    .sidebar, .header, .search-bar, .btn { display: none !important; }
    /* 表格自适应 */
    table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
    th, td { border: 1px solid #e0e0e0; padding: 8px 10px; font-size: 12px; }
    thead { background: #001529; color: #fff; }
    .quote-header { background: linear-gradient(135deg,#001529,#003a8c); color:#fff; padding: 28px 32px; }
    .quote-header h2 { font-size: 22px; font-weight: 800; }
    .quote-header p { font-size: 12px; opacity:.7; margin-top:4px; }
    .quote-meta { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 16px; }
    .quote-meta-item { background: rgba(255,255,255,.1); border-radius: 6px; padding: 8px 14px; min-width: 130px; }
    .quote-meta-item label { display: block; font-size: 10px; opacity: .6; margin-bottom: 2px; }
    .quote-meta-item span { font-size: 13px; font-weight: 700; }
    .quote-body { padding: 20px 32px; }
    .quote-section-title { font-size: 14px; font-weight: 700; color: #001529; border-left: 4px solid #1677ff; padding-left: 10px; margin-bottom: 14px; }
    .quote-total { display: flex; justify-content: flex-end; margin-top: 14px; }
    .quote-total-box { width: 320px; border: 1px solid #f0f0f0; border-radius: 8px; overflow: hidden; }
    .total-row { display: flex; justify-content: space-between; padding: 10px 16px; font-size: 13px; border-bottom: 1px solid #f5f5f5; }
    .total-row.grand { background: #001529; color: #fff; font-weight: 800; font-size: 15px; }
  </style>
</head>
<body>
  ${area.innerHTML}
  <script>
    // 显示打印专用元素
    document.querySelectorAll('.print-only').forEach(el => el.style.display = '');
    window.onload = function() { window.print(); window.onafterprint = function(){ window.close(); }; };
  <\/script>
</body>
</html>`;
      const win = window.open('', '_blank', 'width=900,height=700');
      if (!win) { alert('请允许弹出窗口后重试'); return; }
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
    return { kw, detail, adminRegion, isStaff, detailItems, filtered, fmt, qClass, qLabel, view, toOrder, downloadPdf, PRODUCT_DATA, getOppName };
  }
};

// ── 新建报价单 ───────────────────────────────────────────────
const QuoteNew = {
  template: `
  <div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">📋 智能报价配置器</div>
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
            <select class="form-control" v-model="form.customer" @change="onCustomerChange">
              <option value="">请选择已报备客户</option>
              <option v-for="r in approvedRegs" :key="r.id" :value="r.customer">{{ r.customer }}</option>
            </select>
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
        <!-- 关联商机选择 -->
        <div class="form-grid" style="margin-top:16px" v-if="form.customer && relatedOpportunities.length">
          <div class="form-item full">
            <label class="form-label">关联商机 <span style="font-size:12px;color:#888;font-weight:400">（可选）</span></label>
            <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px">
              <div v-for="o in relatedOpportunities" :key="o.id" 
                @click="form.oppId = form.oppId === o.id ? '' : o.id"
                style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:10px;cursor:pointer;border:2px solid"
                :style="{borderColor: form.oppId === o.id ? '#1677ff' : '#e8e8e8', background: form.oppId === o.id ? '#f0f7ff' : '#fff'}">
                <input type="checkbox" :checked="form.oppId === o.id" style="pointer-events:none"/>
                <div>
                  <div style="font-size:13px;font-weight:600">{{ o.name }}</div>
                  <div style="font-size:11px;color:#888">{{ stageLabel(o.stage) }}</div>
                </div>
              </div>
            </div>
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
                    <span v-if="getFeaturePriceDisplay(feat) !== '面议'" class="chip-price-tag">{{ getFeaturePriceDisplay(feat) }}</span>
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
              <span class="sfeat-price">{{ fmt(getFeaturePrice(fid)) }}</span>
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
            <span style="font-weight:600;color:#1677ff">{{ fmt(getFeaturePrice(fid)) }}</span>
          </div>
        </div>
        
        <!-- 自定义功能 -->
        <div v-if="customFeatures.length" class="summary-section">
          <div class="summary-title">🎨 自选功能</div>
          <div v-for="fid in customFeatures" :key="fid" class="summary-row">
            <span>{{ getFeatureName(fid) }}</span>
            <span style="font-weight:600;color:#1677ff">{{ fmt(getFeaturePrice(fid)) }}</span>
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
          <div class="total-row"><span>软件小计</span><span>{{ fmt(subTotal) }}</span></div>
          <div v-if="hardwareTotal > 0" class="total-row"><span>硬件合计</span><span style="color:#fa8c16">{{ fmt(hardwareTotal) }}</span></div>
          <div class="total-row grand"><span>报价总额</span><span style="font-size:22px">{{ fmt(grandTotal) }}</span></div>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px">
        <button class="btn btn-default" @click="$router.back()">取消</button>
        <button class="btn btn-primary btn-lg" @click="saveQuote" :disabled="!canSave">
          <span v-if="!canSave">请完善信息</span>
          <span v-else>生成报价单</span>
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
    const isStaff = computed(() => store.user?.role === 'staff');
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    
    // 获取替换的报价单ID
    const replaceId = route.query.replaceId || '';
    const quickQuoteMsg = ref('');
    
    // 报价模式
    const quoteMode = ref('package'); // package | supplement | custom
    const form = reactive({
      customer: decodeURIComponent(route.query.customer || ''),
      regId: route.query.regId || '',
      oppId: route.query.oppId || '',
      endpoints: 100,
      validDays: 30,
    });
    
    // 产品目录数据（从API加载）
    const productTree = ref([]);
    const publishedPackages = ref([]);
    const publishedHardware = ref([]);
    const allFeatures = ref([]);
    const loadingPackages = ref(true);
    
    // 选择状态
    const selectedPackageId = ref('');
    const supplementFeatures = ref([]);
    const customFeatures = ref([]);
    const selectedHardware = ref([]);
    
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
    
    const STANDARD_MAINTENANCE_FEATURE_ID = 'FEAT-MOD-MAINTENANCE-01-01';
    const DEFAULT_MAINTENANCE_MONTHS = 12;
    const DEFAULT_STANDARD_MAINTENANCE_RATE = 15;

    function isStandardMaintenanceFeature(featureOrId) {
      const featureId = typeof featureOrId === 'string' ? featureOrId : featureOrId?.id;
      return featureId === STANDARD_MAINTENANCE_FEATURE_ID;
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

    function getCurrentQuoteFeatures() {
      if (quoteMode.value === 'package') {
        return (selectedPackage.value?.featureIds || []).map(fid => allFeatures.value.find(f => f.id === fid)).filter(Boolean);
      }
      if (quoteMode.value === 'supplement') {
        const featureIds = [...(selectedPackage.value?.featureIds || []), ...supplementFeatures.value];
        return featureIds.map(fid => allFeatures.value.find(f => f.id === fid)).filter(Boolean);
      }
      return customFeatures.value.map(fid => allFeatures.value.find(f => f.id === fid)).filter(Boolean);
    }

    function calculateDisplayedFeatureSectionTotal(featureIds) {
      if (!Array.isArray(featureIds) || featureIds.length === 0) return 0;
      return Math.round(featureIds.reduce((sum, featureId) => sum + getFeaturePrice(featureId), 0));
    }

    function getBaseFeatureSubtotal(feat, endpoints) {
      if (!feat) return 0;
      const qty = Number(endpoints) || 0;
      if (isStandardMaintenanceFeature(feat)) {
        return 0;
      }
      if (feat.priceFixed) {
        return feat.priceFixed * (feat.discount || 1);
      }
      if (feat.tiers && feat.tiers.length) {
        const tier = feat.tiers.find(t => qty >= t.min && qty <= t.max) || feat.tiers[0];
        if (tier) {
          const price = feat.unitPrice ? feat.unitPrice * tier.discount : (tier.price || 0);
          return price * qty;
        }
      }
      if (feat.unitPrice) {
        return feat.unitPrice * qty;
      }
      return 0;
    }

    function calculateMaintenancePrice(features, endpoints) {
      const maintenanceFeature = features.find(isStandardMaintenanceFeature);
      if (!maintenanceFeature) return 0;
      const rateMap = getMaintenanceRateMap(maintenanceFeature);
      const annualPrice = features
        .filter(feat => !isStandardMaintenanceFeature(feat))
        .reduce((sum, feat) => {
          if (!feat?.moduleId) return sum;
          const rate = Number.isFinite(rateMap[feat.moduleId]) ? rateMap[feat.moduleId] : DEFAULT_STANDARD_MAINTENANCE_RATE;
          return sum + getBaseFeatureSubtotal(feat, endpoints) * rate / 100;
        }, 0);
      return Math.round(annualPrice);
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
    
    // 计算功能模块总价
    function calcFeatureTotal(features, endpoints) {
      if (!features.length) return 0;
      let total = 0;
      features.forEach(feat => {
        total += getBaseFeatureSubtotal(feat, endpoints);
      });
      total += calculateMaintenancePrice(features, endpoints) * (DEFAULT_MAINTENANCE_MONTHS / DEFAULT_MAINTENANCE_MONTHS);
      return Math.round(total);
    }
    
    // 获取功能价格显示
    function getFeaturePriceDisplay(feat) {
      if (isStandardMaintenanceFeature(feat)) {
        return '按模块比例/月';
      }
      if (feat.priceFixed) {
        return fmt(feat.priceFixed * (feat.discount || 1)) + '/套';
      }
      if (feat.unitPrice) {
        return fmt(feat.unitPrice) + '/端点';
      }
      return '面议';
    }
    
    // 获取功能价格
    function getFeaturePrice(fid) {
      const feat = allFeatures.value.find(f => f.id === fid);
      if (!feat) return 0;
      if (isStandardMaintenanceFeature(feat)) {
        return calculateMaintenancePrice(getCurrentQuoteFeatures(), form.endpoints);
      }
      return getBaseFeatureSubtotal(feat, form.endpoints);
    }
    
    // 获取功能名称
    function getFeatureName(fid) {
      const feat = allFeatures.value.find(f => f.id === fid);
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
      recalcAll();
    }
    
    // 选择套餐
    function selectPackage(pkg) {
      selectedPackageId.value = pkg.id;
      supplementFeatures.value = [];
      if (quoteMode.value !== 'supplement') {
        quoteMode.value = 'package';
      }
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
      return fmt(calcFeatureTotal(features, form.endpoints));
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
      const feat = allFeatures.value.find(f => f.id === fid);
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
      // Vue 响应式会自动更新 computed
    }
    
    // 汇总计算
    const subTotal = computed(() => {
      if (quoteMode.value === 'package') {
        return packagePrice.value + getSupplementPrice();
      } else if (quoteMode.value === 'supplement') {
        return packagePrice.value + getSupplementPrice();
      } else {
        return getCustomPrice();
      }
    });
    
    const hardwareTotal = computed(() => {
      return selectedHardware.value.reduce((sum, hid) => sum + getHardwarePrice(hid), 0);
    });
    
    const grandTotal = computed(() => subTotal.value + hardwareTotal.value);
    
    const canSave = computed(() => {
      if (!form.customer) return false;
      if (form.endpoints <= 0) return false;
      if (quoteMode.value === 'package' && !selectedPackageId.value) return false;
      if (quoteMode.value === 'supplement' && !selectedPackageId.value) return false;
      if (quoteMode.value === 'custom' && !customFeatures.value.length) return false;
      return grandTotal.value > 0;
    });
    
    // 已审批报备
    const approvedRegs = computed(() => {
      let list = store.registrations.filter(r => r.status === 'approved');
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
    
    // 关联商机
    const relatedOpportunities = computed(() => {
      if (!form.customer) return [];
      let list = store.opportunities.filter(o => o.customer === form.customer && !['won','lost'].includes(o.stage));
      if (isStaff.value) {
        list = list.filter(o =>
          o.ownerId === userId.value ||
          o.createdBy === userId.value ||
          o.assignedStaffId === userId.value ||
          o.assignedStaffUserId === userId.value
        );
      }
      return list;
    });
    
    function onCustomerChange() {
      form.oppId = '';
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
      
      try {
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
          oppId: form.oppId || null,
          endpoints: form.endpoints,
          products: productIds,
          hardwareIds: hardwareIds,
          quoteMode: quoteMode.value,
          packageId: selectedPackageId.value,
          total: grandTotal.value,
          validDays: form.validDays,
          ownerId: userId.value,
          createdBy: store.user.id,
          assignedStaffId: store.user.id,
        });
        
        if (result.success) {
          store.quotes.unshift(result.data);
          if (form.oppId) {
            const opp = store.opportunities.find(o => o.id === form.oppId);
            if (opp) {
              opp.quoteId = result.data.id;
              if (opp.stage === 'qualification') opp.stage = 'proposal';
            }
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
    });
    
    return {
      form, quoteMode, publishedPackages, publishedHardware, categories, loadingPackages,
      selectedPackageId, selectedPackage, supplementFeatures, customFeatures, selectedHardware,
      approvedRegs, relatedOpportunities, subTotal, hardwareTotal, grandTotal, canSave,
      setMode, selectPackage, toggleSupplementFeature, toggleCustomFeature, toggleHardware,
      getFeatureName, getFeaturePrice, getFeaturePriceDisplay, getHardwareName, getHardwarePrice,
      getAvailableFeatures, supplementCategories, packagePrice, recalcAll,
      onCustomerChange, saveQuote, fmt, quickQuoteMsg, stageLabel,
      // 新增的展开状态和方法
      expandedCategoryId, summaryPackageExpanded, packageDetail,
      openPackageDetail, getFeaturePriceType, packagePriceForDetail,
      toggleCategoryExpand,
      getFeatureCategoryId, getCategoryIcon, getCategoryName, getCategoryModules,
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
      <select class="form-control" v-model="filterStatus" style="width:130px">
        <option value="">全部状态</option>
        <option value="pending">待确认</option>
        <option value="processing">处理中</option>
        <option value="shipped">已发货</option>
        <option value="completed">已完成</option>
        <option value="cancelled">已取消</option>
      </select>
      <span v-if="adminRegion" class="tag tag-blue" style="padding:6px 12px;font-size:13px">📍 {{ adminRegion }}</span>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>订单编号</th><th>关联报价</th><th>客户</th><th>金额</th><th>状态</th><th>下单日期</th><th>收货地址</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="o in filtered" :key="o.id">
              <td style="font-family:monospace;font-size:12px;color:#888">{{ o.id }}</td>
              <td style="font-size:12px;color:#1677ff">{{ o.quoteId }}</td>
              <td style="font-weight:600">{{ o.customer }}</td>
              <td style="font-weight:700;color:#1677ff">{{ fmt(o.total) }}</td>
              <td><span class="tag" :class="oClass(o.status)">{{ oLabel(o.status) }}</span></td>
              <td style="font-size:12px;color:#888">{{ o.createdAt }}</td>
              <td style="font-size:12px;color:#888;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ o.deliveryAddr }}</td>
              <td><button class="btn btn-text btn-sm" @click="view(o)">详情</button></td>
            </tr>
            <tr v-if="!filtered.length"><td colspan="8"><div class="empty-state"><div class="empty-icon">📦</div><p>暂无订单记录</p></div></td></tr>
          </tbody>
        </table>
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
                <div class="timeline-dot-wrap"><div class="timeline-dot active"></div><div class="timeline-line"></div></div>
                <div class="timeline-content"><div class="tl-title">订单已创建</div><div class="tl-time">{{ detail.createdAt }}</div></div>
              </div>
              <div class="timeline-item" v-if="['processing','shipped','completed'].includes(detail.status)">
                <div class="timeline-dot-wrap"><div class="timeline-dot" :class="{active: ['processing','shipped','completed'].includes(detail.status)}"></div><div class="timeline-line"></div></div>
                <div class="timeline-content"><div class="tl-title">厂商确认处理中</div><div class="tl-desc">License 生成 / 硬件备货</div></div>
              </div>
              <div class="timeline-item" v-if="['shipped','completed'].includes(detail.status)">
                <div class="timeline-dot-wrap"><div class="timeline-dot" :class="{active: ['shipped','completed'].includes(detail.status)}"></div><div class="timeline-line"></div></div>
                <div class="timeline-content"><div class="tl-title">已发货 / License 已下发</div><div class="tl-time">{{ detail.createdAt }}</div></div>
              </div>
              <div class="timeline-item" v-if="detail.status==='completed'">
                <div class="timeline-dot-wrap"><div class="timeline-dot" style="background:var(--success)"></div></div>
                <div class="timeline-content"><div class="tl-title" style="color:var(--success)">订单完成</div></div>
              </div>
              <div class="timeline-item" v-if="!['completed','cancelled'].includes(detail.status)">
                <div class="timeline-dot-wrap"><div class="timeline-dot gray"></div></div>
                <div class="timeline-content"><div class="tl-title" style="color:#bbb">等待完成...</div></div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="detail=null">关闭</button>
        </div>
      </div>
    </div>
  </div>`,
  setup() {
    const kw = ref('');
    const filterStatus = ref('');
    const detail = ref(null);
    
    // 区域管理员隔离
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    // 员工隔离
    const userId = computed(() => store.user?.staffId || store.user?.username || '');
    const isStaff = computed(() => store.user?.role === 'staff');
    
    // 本区域订单（管理员）或本人的订单（员工）
    const myOrders = computed(() => {
      if (isStaff.value) {
        // 员工：自己创建的订单 + 被指派给自己的订单
        return store.orders.filter(o => 
          o.createdBy === userId.value || 
          o.assignedStaffId === userId.value
        );
      }
      if (adminRegion.value) {
        // 区域管理员看本区域订单
        return store.orders.filter(o => {
          const region = o.region || (store.registrations.find(r => r.customer === o.customer)?.region);
          return region === adminRegion.value;
        });
      }
      // 超级管理员看全部
      return store.orders;
    });
    
    const filtered = computed(() => myOrders.value.filter(o => {
      const mK = !kw.value || o.customer.includes(kw.value) || o.id.includes(kw.value);
      const mS = !filterStatus.value || o.status === filterStatus.value;
      return mK && mS;
    }));
    function oClass(s) { return { pending:'tag-orange', processing:'tag-blue', shipped:'tag-purple', completed:'tag-green', cancelled:'tag-gray' }[s]||'tag-gray'; }
    function oLabel(s) { return { pending:'待确认', processing:'处理中', shipped:'已发货', completed:'已完成', cancelled:'已取消' }[s]||s; }
    function view(o) { detail.value = o; }
    return { kw, filterStatus, adminRegion, isStaff, filtered, detail, fmt, oClass, oLabel, view };
  }
};

// ── 产品目录（弹窗层级式三级产品架构）──────────────────────────
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
      <div class="modal-content" style="max-width:900px">
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
          
          <!-- 包含的模块 -->
          <div v-if="detailPackage.modules?.length" style="margin-bottom:24px">
            <div style="font-size:14px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px;color:#333">
              📦 产品模块
              <span style="font-size:12px;font-weight:400;color:#8c8c8c">({{ detailPackage.modules.length }}个)</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
              <div v-for="mod in detailPackage.modules" :key="mod.id" 
                   style="background:#e6f4ff;border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:10px;border:1px solid #91caff">
                <div style="font-size:20px">{{ mod.icon }}</div>
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:600;color:#1a1a1a">{{ mod.name }}</div>
                  <div style="font-size:11px;color:#8c8c8c;margin-top:2px">{{ mod.features?.length || 0 }} 个功能</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 包含的功能 -->
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
          
          <!-- 包含的硬件 -->
          <div v-if="detailPackage.hardware?.length" style="margin-bottom:16px">
            <div style="font-size:14px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px;color:#333">
              🖥️ 硬件设备
              <span style="font-size:12px;font-weight:400;color:#8c8c8c">({{ detailPackage.hardware.length }}件)</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
              <div v-for="hw in detailPackage.hardware" :key="hw.id" 
                   style="background:#ffe7ba;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px;border:1px solid #ffa940">
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
    const showModulesModal = ref(false);
    const showFeaturesModal = ref(false);
    const selectedModule = ref(null);
    
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
    
    // 打开模块列表弹窗
    function viewCategory(cat) {
      currentCategory.value = cat;
      currentCategoryName.value = cat.name;
      currentModules.value = cat.modules || [];
      selectedModule.value = null;
      showModulesModal.value = true;
    }
    
    // 在模块弹窗中点击模块，打开功能弹窗
    function viewModuleInModal(mod) {
      selectedModule.value = mod;
      currentModule.value = mod;
      currentModuleName.value = mod.name;
      currentFeatures.value = features.value.filter(f => f.moduleId === mod.id); // 从features数组过滤
      showModulesModal.value = false; // 关闭模块弹窗
      showFeaturesModal.value = true; // 打开功能弹窗
    }
    
    function closeFeaturesModal() {
      showFeaturesModal.value = false;
      selectedModule.value = null;
    }
    
    function viewFeatureDetail(feat) {
      detailFeature.value = feat;
    }
    
    function viewModule(mod) {
      viewModuleInModal(mod);
    }
    
    function getModuleNameById(modId) {
      return modules.value.find(m => m.id === modId)?.name || '';
    }
    
    function viewHardware(hw) {
      detailFeature.value = { ...hw, name: hw.name, desc: hw.desc, productCode: hw.model, priceType: 'fixed', priceFixed: hw.priceFixed, unit: hw.unit };
    }
    
    async function viewPackage(pkg) {
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
      sessionStorage.setItem('quick_quote_feature', JSON.stringify(feat));
      router.push('/quote/new');
      detailFeature.value = null;
    }
    
    function goToQuoteWithPackage(pkg) {
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
        { key: 'prospecting', label: '线索挖掘', color: '#1677ff', bgColor: '#e6f4ff' },
        { key: 'qualification', label: '需求确认', color: '#52c41a', bgColor: '#f6ffed' },
        { key: 'proposal', label: '方案报价', color: '#faad14', bgColor: '#fff7e6' },
        { key: 'negotiation', label: '商务谈判', color: '#eb2f96', bgColor: '#fff0f6' },
        { key: 'closing', label: '签约中', color: '#722ed1', bgColor: '#f9f0ff' },
        { key: 'won', label: '已赢单', color: '#389e0d', bgColor: '#f6ffed' },
        { key: 'lost', label: '已输单', color: '#cf1322', bgColor: '#fff1f0' }
      ];
      return stages.map(st => {
        const opps = partnerOpportunities.value.filter(o => o.stage === st.key);
        return {
          ...st,
          count: opps.length,
          amount: sumOpportunityAmount(opps)
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
              <td><span class="tag tag-gray" style="font-size:11px">{{ o.owner }}</span></td>
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
        <span style="color:#888">合计金额：<b style="color:#1677ff">{{ fmt(sumOpportunityAmount(filtered)) }}</b></span>
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
              <span style="font-size:12px;font-weight:600" :style="{color:probColor(o.probability)}">{{ o.probability }}%</span>
            </div>
            <div style="margin-top:8px">
              <div class="progress-bar"><div class="progress-fill" :style="{width:o.probability+'%',background:probColor(o.probability)}"></div></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:#bbb">
              <span>{{ o.owner }}</span>
              <span>{{ o.expectedClose }}</span>
            </div>
          </div>
          <div v-if="!byStage(s.key).length" style="text-align:center;padding:20px;color:#ccc;font-size:12px">暂无商机</div>
        </div>
        <div :style="{background:s.color,padding:'8px 14px',borderRadius:'0 0 10px 10px',textAlign:'right',fontSize:'12px',color:'#888',borderTop:'1px solid rgba(0,0,0,.05)'}">
          {{ fmt(sumOpportunityAmount(byStage(s.key))) }}
        </div>
      </div>
    </div>

    <!-- 商机详情抽屉 -->
    <div class="modal-overlay" v-if="detail" @click.self="detail=null">
      <div class="modal modal-xl" style="height:85vh;display:flex;flex-direction:column">
        <div class="modal-header">
          <div class="modal-title">{{ detail.name }}</div>
          <span class="modal-close" @click="detail=null">✕</span>
        </div>
        <div style="flex:1;overflow:hidden;display:flex">
          <!-- 左：基本信息 -->
          <div style="width:320px;flex-shrink:0;border-right:1px solid #f0f0f0;overflow-y:auto;padding:20px">
            <div style="margin-bottom:16px">
              <span class="tag" :class="stageTagClass(detail.stage)" style="font-size:13px;padding:4px 12px">{{ stageLabel(detail.stage) }}</span>
            </div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">客户名称</label><div style="font-weight:600;padding-top:4px">{{ detail.customer }}</div></div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">联系人</label><div style="padding-top:4px">{{ detail.contact }} &nbsp; {{ detail.phone }}</div></div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">行业</label><div style="padding-top:4px">{{ detail.industry }}</div></div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">商机金额</label><div style="font-size:22px;font-weight:800;color:#1677ff;padding-top:4px">{{ fmt(detail.amount) }}</div></div>
            <div class="form-item" style="margin-bottom:14px">
              <label class="form-label">成功概率</label>
              <div style="display:flex;align-items:center;gap:10px;padding-top:6px">
                <div class="progress-bar" style="flex:1"><div class="progress-fill" :style="{width:detail.probability+'%',background:probColor(detail.probability)}"></div></div>
                <span style="font-weight:700" :style="{color:probColor(detail.probability)}">{{ detail.probability }}%</span>
              </div>
            </div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">预计签约</label><div style="padding-top:4px">{{ detail.expectedClose }}</div></div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">来源</label><div style="padding-top:4px">{{ detail.source }}</div></div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">负责人</label><div style="padding-top:4px">{{ detail.owner }}</div></div>
            <div v-if="detail.tags.length" class="form-item" style="margin-bottom:14px">
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
              <div v-if="detail.quoteId" style="display:flex;justify-content:space-between;font-size:13px">
                <span style="color:#888">报价单</span>
                <span style="color:#1677ff;cursor:pointer" @click="$router.push('/quote');detail=null">{{ detail.quoteId }}</span>
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
                @click="detail.stage=s.key">
                {{ s.label }}
              </div>
            </div>
            <div class="timeline" v-if="detail.followUps.length">
              <div v-for="(f,i) in detail.followUps" :key="f.id" class="timeline-item">
                <div class="timeline-dot-wrap">
                  <div class="timeline-dot"></div>
                  <div class="timeline-line" v-if="i<detail.followUps.length-1"></div>
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
          <button class="btn btn-default" v-if="detail.regId" @click="$router.push('/opportunity/new?regId='+detail.regId);detail=null">📋 再建商机</button>
          <button class="btn btn-success" @click="detail.stage='won';detail=null">🎉 标记赢单</button>
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

    // 区域管理员隔离
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    // 员工隔离
    const userId = computed(() => store.user?.staffId || store.user?.username || '');
    const isStaff = computed(() => store.user?.role === 'staff');
    
    // 辅助函数：获取报备的区域
    function getRegRegion(regId) {
      const reg = store.registrations.find(r => r.id === regId);
      return reg ? reg.region : null;
    }

    // 已审批客户列表（用于筛选下拉）- 区域管理员只看本区域，员工只看自己的
    const approvedRegs = computed(() => {
      let list = store.registrations.filter(r => r.status === 'approved');
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
      if (isStaff.value) {
        // 员工：自己创建的商机 + 被指派给自己的商机
        return store.opportunities.filter(o =>
          o.ownerId === userId.value ||
          o.createdBy === userId.value ||
          o.assignedStaffId === userId.value ||
          o.assignedStaffUserId === userId.value
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
    function openDetail(o) { detail.value = o; }
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
    return { store, adminRegion, isStaff, filtered, viewMode, kw, stageFilter, customerFilter, approvedRegs, detail, followTarget, followForm,
      STAGES, byStage, isOverdue, openDetail, openFollow, saveFollow, sumOpportunityAmount,
      fmt, stageLabel, stageDot, stageTagClass, probColor };
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
          <div v-if="showDropdown && filteredRegs.length" style="position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1px solid #e0e0e0;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.1);z-index:999;max-height:240px;overflow-y:auto">
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
            <div v-if="!filteredRegs.length" style="padding:14px;text-align:center;color:#aaa;font-size:12px">未找到匹配的已审批客户</div>
          </div>
          <!-- 空结果提示 -->
          <div v-if="showDropdown && !filteredRegs.length && customerSearch" style="position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1px solid #e0e0e0;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.1);z-index:999;padding:16px">
            <div style="text-align:center;color:#aaa;font-size:12px;margin-bottom:10px">未找到"{{ customerSearch }}"对应的已审批客户</div>
            <div style="text-align:center">
              <button class="btn btn-primary btn-sm" @mousedown.prevent="goRegNew">➕ 立即报备此客户</button>
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
        <div class="form-item full"><label class="form-label required">商机名称</label><input class="form-control" v-model="form.name" placeholder="例：XX公司终端安全改造项目"/></div>
        <div class="form-item"><label class="form-label required">当前阶段</label>
          <select class="form-control" v-model="form.stage">
            <option v-for="s in STAGES" :key="s.key" :value="s.key">{{ s.label }}</option>
          </select>
        </div>
        <div class="form-item"><label class="form-label required">预计金额（元）</label><input class="form-control" type="number" v-model.number="form.amount" placeholder="0"/></div>
        <div class="form-item"><label class="form-label">端点数量</label><input class="form-control" type="number" v-model.number="form.endpoints" placeholder="0"/></div>
        <div class="form-item"><label class="form-label">成功概率（%）</label>
          <input class="form-control" type="range" min="0" max="100" step="5" v-model.number="form.probability" style="padding:10px 0"/>
          <div style="text-align:center;font-weight:700;color:#1677ff">{{ form.probability }}%</div>
        </div>
        <div class="form-item"><label class="form-label">预计关闭日期</label><input class="form-control" type="date" v-model="form.expectedClose"/></div>
        <div class="form-item"><label class="form-label">商机来源</label>
          <select class="form-control" v-model="form.source">
            <option>渠道推荐</option><option>市场活动</option><option>老客户续约</option><option>展会获客</option><option>政府关系</option><option>网络询盘</option><option>其他</option>
          </select>
        </div>
        <div class="form-item"><label class="form-label">负责人</label><input class="form-control" v-model="form.owner" placeholder="销售负责人姓名"/></div>
        <div class="form-item full"><label class="form-label">标签（回车添加）</label>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;border:1px solid #d9d9d9;border-radius:6px;padding:6px 10px;min-height:40px" @click="$refs.tagInput.focus()">
            <span v-for="t in form.tags" :key="t" class="tag tag-blue" style="font-size:12px">{{ t }} <span @click.stop="removeTag(t)" style="cursor:pointer;margin-left:2px">×</span></span>
            <input ref="tagInput" style="border:none;outline:none;font-size:13px;min-width:80px" v-model="tagInput" @keydown.enter.prevent="addTag" placeholder="输入标签后回车"/>
          </div>
        </div>
        <div class="form-item full"><label class="form-label">备注</label><textarea class="form-control" v-model="form.notes" rows="3" placeholder="项目背景、竞争情况、关键决策人..."></textarea></div>
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

    // 获取当前用户ID
    const userId = computed(() => store.user?.staffId || store.user?.username || '');
    const isStaff = computed(() => store.user?.role === 'staff');
    
    // 已审批报备客户列表（员工只能看到自己创建的报备）
    const approvedRegs = computed(() => {
      const list = store.registrations.filter(r => r.status === 'approved');
      if (isStaff.value) {
        return list.filter(r =>
          r.createdBy === userId.value ||
          r.owner === userId.value ||
          r.assignedStaffId === userId.value ||
          r.assignedStaffUserId === userId.value
        );
      }
      return list;
    });

    // 客户搜索
    const customerSearch = ref('');
    const showDropdown = ref(false);
    const selectedReg = ref(null);

    // 若路由带 regId 参数，自动预选
    onMounted(() => {
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
      amount:0, endpoints:0, probability:30, expectedClose:'', source:'渠道推荐', owner:'',
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
      
      const oppData = {
        name: form.name,
        customer: reg.customer, industry: reg.industry,
        contact: reg.contact, phone: reg.phone,
        stage: form.stage, amount: form.amount, endpoints: form.endpoints,
        probability: form.probability, source: form.source, owner: form.owner,
        ownerId: userId.value,
        createdBy: store.user.id,      // 统一使用员工ID，与过滤逻辑一致
        assignedStaffId: store.user.id, // 统一使用员工ID
        region: reg.region,  // 从报备获取区域
        expectedClose: form.expectedClose,
        regId: reg.id, quoteId: null,
        tags: [...form.tags], notes: form.notes, followUps,
      };
      
      try {
        const result = await apiClient.createOpportunity(oppData);
        if (result.success) {
          store.opportunities.unshift(normalizeOpportunityRecord(result.data, { ensureArrays: true }));
          store.notifications.unshift({ id:Date.now(), title:'新商机已创建', desc:`${form.name} — ${reg.customer}`, time:'刚刚', unread:true });
          alert('商机创建成功！');
          router.push('/opportunity');
        } else {
          alert('创建商机失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        alert('创建商机失败：' + err.message);
      }
    }
    return {
      form, tagInput, canSubmit, STAGES, addTag, removeTag, submit,
      customerSearch, showDropdown, selectedReg, filteredRegs, existingOpps,
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
        { path: 'order', component: OrderList },
        { path: 'products', component: Products },
        { path: 'partner-report', component: PartnerReport },
        { path: 'partners', component: Partners },
        { path: 'admin-review', component: AdminReview },
        { path: 'account-manage', component: AccountManage },
      ]
    }
  ]
});

// 清空前端内置演示占位数据，避免接口未返回时展示样例记录
store.opportunities = [];
store.notifications = [];
store.registrations = [];
store.quotes = [];
store.orders = [];
store.adminAccounts = [];
store.partners = [];

// ── 路由守卫 ─────────────────────────────────────────────────
router.beforeEach((to, from) => {
  if (to.path !== '/login' && !store.user) return '/login';
  if (to.path === '/login' && store.user) return '/dashboard';
});

// ── 挂载 ─────────────────────────────────────────────────────
const app = createApp({
  template: `<router-view />`
});
app.use(router);
app.use(ElementPlus);
app.mount('#app');
