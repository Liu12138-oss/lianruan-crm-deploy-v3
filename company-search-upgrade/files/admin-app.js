// ============================================================
// 联软安全产品渠道管理平台 — 厂商管理后台（后端API版）
// Vue 3 + Vue Router (CDN) + Element Plus
// ============================================================

const { createApp, ref, reactive, computed, watch, onMounted, nextTick } = Vue;
const { createRouter, createWebHashHistory } = VueRouter;

// API 基础配置（确保 window.API_BASE 已定义）
if (typeof window.API_BASE === 'undefined') {
  window.API_BASE = 'http://localhost:3000/api';
}
// 使用 window.API_BASE，避免重复声明 const

// API 请求辅助函数
async function apiRequest(method, endpoint, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);
  
  try {
    const res = await fetch(`${window.API_BASE}${endpoint}`, options);
    // 检查 HTTP 状态码
    if (!res.ok) {
      const errorText = await res.text().catch(() => '未知错误');
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }
    const data = await res.json();
    return data;
  } catch (err) {
    // 重新抛出错误，让调用方处理
    throw new Error(`请求失败: ${err.message}`);
  }
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
  // 待审批账号（员工/企业管理员申请）
  pendingApprovals: [],
  partners: [
    { id:'P001', name:'北京安盾网络科技有限公司', level:'diamond', region:'北区（政府企业）', contact:'刘总', phone:'010-8888-0001', email:'liu@andun.com', status:'active', joinDate:'2023-06-01', quoteCount:28, orderCount:15, totalAmt:1280000, isTechService:true,
      staff: [
        { id:'S001-01', name:'刘建国', username:'liujg', password:'123456', phone:'138-1001-0001', email:'liujg@andun.com', role:'销售经理', status:'active', createdAt:'2023-06-01' },
        { id:'S001-02', name:'王小红', username:'wangxh', password:'123456', phone:'138-1001-0002', email:'wangxh@andun.com', role:'销售代表', status:'active', createdAt:'2023-08-15' },
        { id:'S001-03', name:'张伟', username:'zhangw', password:'123456', phone:'138-1001-0003', email:'zhangw@andun.com', role:'销售代表', status:'inactive', createdAt:'2023-09-01' },
      ]
    },
    { id:'P002', name:'上海锐行信息技术有限公司', level:'gold', region:'上海区（非金）', contact:'孙总', phone:'021-7777-0002', email:'sun@ruixing.com', status:'active', joinDate:'2024-01-15', quoteCount:12, orderCount:6, totalAmt:520000, isTechService:false,
      staff: [
        { id:'S002-01', name:'孙明华', username:'sunmh', password:'123456', phone:'139-2002-0001', email:'sunmh@ruixing.com', role:'销售总监', status:'active', createdAt:'2024-01-15' },
        { id:'S002-02', name:'李婷', username:'liting', password:'123456', phone:'139-2002-0002', email:'liting@ruixing.com', role:'销售代表', status:'active', createdAt:'2024-02-01' },
      ]
    },
    { id:'P003', name:'广州卓越安全解决方案公司', level:'industry', region:'广州区', contact:'赵总', phone:'020-6666-0003', email:'zhao@zy.com', status:'active', joinDate:'2022-11-20', quoteCount:45, orderCount:30, totalAmt:3600000, isTechService:true,
      staff: [
        { id:'S003-01', name:'赵志强', username:'zhaozq', password:'123456', phone:'137-3003-0001', email:'zhaozq@zy.com', role:'总经理', status:'active', createdAt:'2022-11-20' },
        { id:'S003-02', name:'陈美玲', username:'chenml', password:'123456', phone:'137-3003-0002', email:'chenml@zy.com', role:'销售经理', status:'active', createdAt:'2022-12-01' },
        { id:'S003-03', name:'周杰', username:'zhoujie', password:'123456', phone:'137-3003-0003', email:'zhoujie@zy.com', role:'销售代表', status:'active', createdAt:'2023-03-10' },
        { id:'S003-04', name:'吴芳', username:'wufang', password:'123456', phone:'137-3003-0004', email:'wufang@zy.com', role:'销售代表', status:'active', createdAt:'2023-06-20' },
      ]
    },
    { id:'P004', name:'深圳联创安全科技有限公司', level:'lep', region:'深圳区', contact:'黄总', phone:'0755-8888-0004', email:'huang@lianchuang.com', status:'active', joinDate:'2024-06-01', quoteCount:8, orderCount:3, totalAmt:280000, isTechService:true,
      staff: [
        { id:'S004-01', name:'黄伟', username:'huangw', password:'123456', phone:'136-4004-0001', email:'huangw@lianchuang.com', role:'技术总监', status:'active', createdAt:'2024-06-01' },
      ]
    },
    { id:'P005', name:'成都信安网络工程有限公司', level:'bronze', region:'西区', contact:'杨总', phone:'028-7777-0005', email:'yang@xinan.com', status:'active', joinDate:'2024-08-15', quoteCount:5, orderCount:1, totalAmt:95000, isTechService:false,
      staff: [
        { id:'S005-01', name:'杨帆', username:'yangf', password:'123456', phone:'135-5005-0001', email:'yangf@xinan.com', role:'销售经理', status:'active', createdAt:'2024-08-15' },
      ]
    },
  ],
});

// ── 全局数据刷新函数（导入后调用）─────────────────────────────
async function refreshStoreData() {
  const params = new URLSearchParams();
  if (store.user?.role === 'staff') {
    params.append('userId', store.user.id);
  } else if (store.user?.region) {
    params.append('region', store.user.region);
  }
  
  try {
    // 刷新报备
    const regRes = await fetch(`${window.API_BASE}/registrations?${params}`);
    const regData = await regRes.json();
    if (regData.success) store.registrations = regData.data;
    
    // 刷新商机
    const oppRes = await fetch(`${window.API_BASE}/opportunities?${params}`);
    const oppData = await oppRes.json();
    if (oppData.success) store.opportunities = oppData.data;
    
    // 刷新渠道商
    const partRes = await fetch(`${window.API_BASE}/partners?${params}`);
    const partData = await partRes.json();
    if (partData.success) store.partners = partData.data;
    
    // 刷新用户
    const userRes = await fetch(`${window.API_BASE}/users?${params}`);
    const userData = await userRes.json();
    if (userData.success) store.users = userData.data;
    
    console.log('[refreshStoreData] 数据已刷新');
  } catch (err) {
    console.error('[refreshStoreData] 刷新失败:', err);
  }
}

// ── 工具函数 ─────────────────────────────────────────────────
function fmt(n) {
  if (!n && n !== 0) return '—';
  return '¥ ' + Number(n).toLocaleString('zh-CN');
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
        <div class="logo-icon">🏢</div>
        <h1>联软渠道管理平台</h1>
        <p>厂商管理后台 <span class="admin-badge">Admin</span></p>
      </div>
      <div class="form-item" style="margin-bottom:14px">
        <label class="form-label">管理员账号</label>
        <input class="form-control" v-model="username" placeholder="请输入管理员账号" @keyup.enter="doLogin"/>
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
        <p>区域管理员：admin_ah、admin_js 等 / 123456</p>
        <p style="margin-top:2px;color:#bbb">超级管理员：admin / 123456</p>
        <p style="margin-top:8px;">
          <a href="partner.html" style="color:#999;text-decoration:underline;">← 前往渠道伙伴入口</a>
        </p>
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
        
        // 检查是否为管理员角色
        if (res.user.role !== 'admin' && res.user.role !== 'superadmin') {
          errMsg.value = '此入口仅开放给厂商管理员';
          loading.value = false;
          return;
        }
        
        store.user = {
          id: res.user.id,
          name: res.user.name,
          role: res.user.role,
          avatar: res.user.name.slice(0, 1),
          username: username.value,
          region: res.user.region,
          bigRegion: res.user.bigRegion,
          _storagePrefix: 'admin_'  // 保存前缀信息，便于 syncUser 正确读取
        };
        
        // 保存 token（使用独立前缀，避免与其他应用冲突）
        localStorage.setItem('admin_auth_token', res.token);
        localStorage.setItem('admin_user_info', JSON.stringify(store.user));
        // 同步到 apiClient 的 currentUser（修复报价单/商机/订单等列表查询的过滤参数问题）
        if (typeof syncUser === 'function') {
          syncUser(store.user);
        }
        localStorage.setItem('admin_api_user', JSON.stringify({ user: store.user, token: res.token }));
        
        // 加载待审批列表（用于侧边栏badge）
        try {
          const aprRes = await apiRequest('GET', '/pending-approvals', { userRole: store.user.role });
          if (aprRes.success) store.pendingApprovals = aprRes.data || [];
        } catch (e) {}
        
        router.push('/dashboard');
      } catch (err) {
        errMsg.value = '登录失败：' + err.message;
      }
      loading.value = false;
    }
    return { username, password, loading, errMsg, doLogin };
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
          <div class="nav-item" :class="{active:$route.path==='/partner-admin'}" @click="go('/partner-admin')">
            <span class="nav-icon">🏢</span> 企业管理员
            <span class="nav-badge" v-if="pendingPartnerAdminCount">{{ pendingPartnerAdminCount }}</span>
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
        <div v-for="n in store.notifications" :key="n.id" class="notif-item" :class="{unread:n.unread}" @click="n.unread=false">
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
    
    // 待审批的企业管理员账号数（仅超级管理员可见）
    const pendingPartnerAdminCount = computed(() => {
      return store.pendingApprovals.filter(a => a.type === 'partner_admin' && a.status === 'pending').length;
    });
    
    // 加载待审批列表
    async function loadPendingApprovals() {
      try {
        const res = await apiRequest('GET', '/pending-approvals', { userRole: store.user?.role });
        if (res.success) {
          store.pendingApprovals = res.data || [];
        }
      } catch (e) {
        console.error('加载待审批列表失败:', e);
      }
    }
    
    const pageTitles = {
      '/dashboard': '总览仪表盘',
      '/opportunity': '商机管理',
      '/opportunity/import': '商机导入',
      '/registration': '客户报备',
      '/registration/new': '新建报备',
      '/registration/import': '客户报备导入',
      '/quote': '报价管理',
      '/quote/new': '新建报价',
      '/order': '订单管理',
      '/products': '产品目录',
      '/partner-report': '经营报表',
      '/partners': '渠道商管理',
      '/partners/import': '渠道商导入',
      '/partner-admin': '企业管理员',
      '/admin-review': '审核中心',
      '/account-manage': '账号管理',
      '/account-manage/staff-import': '员工导入',
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
        localStorage.removeItem('admin_user_info');
        localStorage.removeItem('admin_auth_token');
        localStorage.removeItem('admin_api_user');
        store.user = null;
        router.push('/login');
      }
    }
    function markAllRead() { store.notifications.forEach(n => n.unread = false); }
    
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
    
    return { store, showNotif, isAdmin, isSuperAdmin, unreadCount, pendingCount, hotOppCount, reviewCount, pendingPartnerAdminCount, pageTitle, go, logout, markAllRead, loadPendingApprovals, 
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
    // 员工隔离
    const userId = computed(() => store.user?.id || '');
    const isStaff = computed(() => store.user?.role === 'staff');
    
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
          o.assignedStaffId === userId.value
        );
      }
      if (adminRegion.value) {
        // 区域管理员看本区域商机（优先使用商机自身的region字段，其次从报备中查找）
        return store.opportunities.filter(o => {
          // 优先使用商机自身的region字段（后端API返回的数据）
          if (o.region) {
            return o.region === adminRegion.value;
          }
          // 兼容旧数据：从报备中查找区域
          const region = getRegRegion(o.regId);
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
      if (isStaff.value) {
        // 员工：自己创建的报价单 + 被指派给自己的报价单
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
    
    // 本区域/本人订单
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
          // 优先使用订单自身的region字段
          if (o.region) {
            return o.region === adminRegion.value;
          }
          // 兼容旧数据：通过regId查找报备的区域
          const reg = store.registrations.find(r => r.id === o.regId);
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
    function quoteStatusClass(s) { return { draft:'tag-gray', sent:'tag-blue', confirmed:'tag-green', expired:'tag-red' }[s]||'tag-gray'; }
    function quoteStatusLabel(s) { return { draft:'草稿', sent:'已发送', confirmed:'已确认', expired:'已过期' }[s]||s; }
    
    // 从后端加载数据到 store（供 Dashboard 等组件使用）
    async function loadRealData() {
      const params = new URLSearchParams();
      if (isStaff.value) {
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
    }
    
    // 页面加载时获取后端数据
    onMounted(loadRealData);
    
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
      <button class="btn btn-default" @click="$router.push('/registration/import')" v-if="isAdmin">📥 批量导入</button>
    </div>

    <div v-if="loading" style="text-align:center;padding:60px;color:#888">
      <div style="font-size:32px;margin-bottom:16px">⏳</div>
      <div>加载中...</div>
    </div>
    <div class="card" v-else>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>报备编号</th><th>客户名称</th><th>合作伙伴</th><th>行业</th><th>联系人</th><th>状态</th>
              <th>报备日期</th><th>保护期至</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in paginatedData" :key="r.id" style="cursor:pointer" @click="viewDetail(r)">
              <td style="font-family:monospace;color:#888;font-size:12px">{{ r.id }}</td>
              <td style="font-weight:600">{{ r.customer }}</td>
              <td>
                <div style="font-weight:500;color:#1677ff">{{ r.assignedPartnerName || r.partnerName || '—' }}</div>
                <div v-if="r.assignedStaffName" style="font-size:11px;color:#666">{{ r.assignedStaffName }}</div>
                <div v-else-if="r.partnerId" style="font-size:11px;color:#aaa;font-family:monospace">{{ r.partnerId }}</div>
              </td>
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
            <tr v-if="!paginatedData.length"><td colspan="9"><div class="empty-state"><div class="empty-icon">📋</div><p>暂无报备记录</p></div></td></tr>
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
            <div class="form-item full"><label class="form-label">指派渠道商</label><div style="padding:8px 0;font-weight:600;color:#1677ff">{{ detail.assignedPartnerName || detail.partnerName || '—' }}</div><div v-if="detail.assignedPartnerId" style="font-size:12px;color:#aaa;font-family:monospace">{{ detail.assignedPartnerId }}</div></div>
            <div class="form-item full"><label class="form-label">指派跟进员工</label><div style="padding:8px 0;font-weight:600">{{ detail.assignedStaffName || '—' }}</div><div v-if="detail.assignedStaffId" style="font-size:12px;color:#aaa;font-family:monospace">{{ detail.assignedStaffId }}</div></div>
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
    const currentPage = ref(1);
    const pageSize = ref(10);
    
    // 区域管理员隔离
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    // 员工隔离：获取当前用户ID
    const userId = computed(() => store.user?.id || '');
    const isStaff = computed(() => store.user?.role === 'staff');
    const isSuperAdmin = computed(() => store.user?.role === 'superadmin');
    const isAdmin = computed(() => store.user?.role === 'admin' || store.user?.role === 'superadmin');
    
    // 分页相关
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
        pages.push(1);
        if (cur > 3) pages.push('...');
        for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
        if (cur < total - 2) pages.push('...');
        pages.push(total);
      }
      return pages;
    });
    function prevPage() { if (currentPage.value > 1) currentPage.value--; }
    function nextPage() { if (currentPage.value < totalPages.value) currentPage.value++; }
    function goToPage(p) { if (p !== '...' && p >= 1 && p <= totalPages.value) currentPage.value = p; }
    function resetPage() { currentPage.value = 1; }
    
    // 从后端加载报备数据
    async function loadRegistrations() {
      loading.value = true;
      try {
        const params = new URLSearchParams();
        if (isStaff.value && userId.value) {
          params.append('userId', userId.value);
        } else if (adminRegion.value) {
          params.append('region', adminRegion.value);
        }
        // 超级管理员不传参数，看全部
        
        const res = await fetch(`${window.API_BASE || 'http://localhost:3000/api'}/registrations?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          registrations.value = data.data || [];
        }
      } catch (err) {
        console.error('加载报备失败:', err);
      }
      loading.value = false;
    }
    
    onMounted(loadRegistrations);
    
    // 本区域报备（管理员）或本人的报备（员工）
    const myRegistrations = computed(() => {
      // 现在数据已经从后端按角色过滤加载，直接返回即可
      return registrations.value;
    });
    
    const filtered = computed(() => {
      resetPage();
      return myRegistrations.value.filter(r => {
        const matchKw = !kw.value || r.customer.includes(kw.value) || r.contact.includes(kw.value);
        const matchSt = !filterStatus.value || r.status === filterStatus.value;
        return matchKw && matchSt;
      });
    });
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

    return { kw, filterStatus, adminRegion, isAdmin, filtered, paginatedData, detail, statusClass, statusLabel, isExpiringSoon, viewDetail,
      regOrders, regOrderTotal, regOpportunities, stageColor, stageLabel, stageTagClass, fmt, loading, loadRegistrations,
      currentPage, totalPages, pageNumbers, prevPage, nextPage, goToPage };
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
        <div class="step-item" :class="{active:hasOpportunity?step===3:step===2,done:hasOpportunity?step>3:step>2}">
          <div class="step-circle">{{ hasOpportunity?3:2 }}</div><div class="step-label">指派渠道</div>
        </div>
        <div class="step-line" :class="{done:hasOpportunity?step>3:step>2}"></div>
        <div class="step-item" :class="{active:hasOpportunity?step===4:step===3}">
          <div class="step-circle">{{ hasOpportunity?4:3 }}</div><div class="step-label">提交确认</div>
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
              <span v-if="searchingEnterprise" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:#aaa;font-size:13px;animation:spin 1s linear infinite;display:inline-block">⟳</span>
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
            </div>
            <!-- 无结果提示 -->
            <div v-if="showEnterpriseList && enterpriseList.length===0 && !searchingEnterprise && form.customer.length>=2" 
              style="position:absolute;left:0;right:0;background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:10px 14px;font-size:13px;color:#aaa;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,.1)">
              未找到匹配企业，请手动填写下方信息
            </div>
          </div>
          <!-- 工商回填信息卡片 -->
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
                <div v-if="form.address" style="grid-column:span 2"><span style="color:#999">注册地址：</span>{{ form.address }}</div>
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
              :style="enterpriseFilled?'background:#f9f9f9':''"
            />
            <span v-if="creditCodeError" class="field-error">{{ creditCodeError }}</span>
          </div>
          <div class="form-item">
            <label class="form-label">法定代表人</label>
            <input class="form-control" v-model="form.legalPerson" placeholder="（自动回填或手动填写）" :style="enterpriseFilled?'background:#f9f9f9':''"/>
          </div>
          <div class="form-item"><label class="form-label required">所属行业</label>
            <select class="form-control" v-model="form.industry">
              <option value="">请选择</option>
              <option v-for="i in industries" :key="i">{{ i }}</option>
            </select>
          </div>
          <div class="form-item"><label class="form-label required">客户省份/城市</label><input class="form-control" v-model="form.city" placeholder="例：北京市朝阳区"/></div>
          <div class="form-item full"><label class="form-label">注册地址</label><input class="form-control" v-model="form.address" placeholder="（自动回填或手动填写）" :style="enterpriseFilled?'background:#f9f9f9':''"/></div>
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
          <button class="btn btn-primary" @click="goToAssign" :disabled="!form.project||!form.endpointRange">下一步</button>
        </div>
      </div>

      <!-- Step 3: 指派渠道 -->
      <div v-if="step===3">
        <div style="background:#f6f8ff;border:1.5px solid #d0e4ff;border-radius:10px;padding:16px 18px;margin-bottom:22px">
          <div style="font-size:13px;font-weight:700;color:#1677ff;margin-bottom:12px">🏢 选择跟进渠道</div>
          
          <!-- 渠道选择 -->
          <div class="form-item full" style="margin-bottom:16px">
            <label class="form-label required">渠道合作伙伴</label>
            <select class="form-control" v-model="selectedPartnerId" @change="onPartnerChange">
              <option value="">请选择渠道合作伙伴</option>
              <option v-for="p in regionPartners" :key="p.id" :value="p.id">{{ p.name }} ({{ p.level }})</option>
            </select>
            <p v-if="regionPartners.length === 0" style="font-size:12px;color:#999;margin-top:6px">本区域暂无渠道合作伙伴，请先添加渠道商</p>
          </div>
          
          <!-- 员工选择 -->
          <div class="form-item full" v-if="selectedPartnerId">
            <label class="form-label required">指派跟进员工</label>
            <select class="form-control" v-model="selectedStaffId">
              <option value="">请选择跟进员工</option>
              <option v-for="s in selectedPartnerStaff" :key="s.id" :value="s.id">{{ s.name }} ({{ s.role }})</option>
            </select>
            <p v-if="selectedPartnerStaff.length === 0" style="font-size:12px;color:#999;margin-top:6px">该渠道商暂无员工，请先在渠道商管理中添加员工</p>
          </div>
          
          <!-- 已选信息展示 -->
          <div v-if="selectedPartnerId && selectedStaffId" style="margin-top:14px;padding:12px;background:#fff;border-radius:8px;border:1px solid #e0e0e0">
            <div style="font-size:12px;color:#888;margin-bottom:8px">已指派：</div>
            <div style="display:flex;gap:20px;flex-wrap:wrap">
              <div>
                <div style="font-size:11px;color:#888">渠道商</div>
                <div style="font-size:13px;font-weight:600">{{ selectedPartner?.name }}</div>
              </div>
              <div>
                <div style="font-size:11px;color:#888">跟进员工</div>
                <div style="font-size:13px;font-weight:600">{{ selectedStaff?.name }}</div>
              </div>
              <div>
                <div style="font-size:11px;color:#888">员工电话</div>
                <div style="font-size:13px;font-weight:600">{{ selectedStaff?.phone || '-' }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div style="display:flex;justify-content:flex-end;margin-top:24px;gap:10px">
          <button class="btn btn-default" @click="goBackFromAssign">上一步</button>
          <button class="btn btn-primary" @click="goToConfirm" :disabled="!isAssignValid">下一步</button>
        </div>
      </div>

      <!-- Step 4 -->
      <div v-if="step===4">
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
          <div style="font-size:13px;color:#666;margin:16px 0 12px;padding-bottom:10px;border-bottom:1px solid #e0e0e0">指派信息</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13.5px">
            <div><span style="color:#888">渠道商：</span><strong>{{ selectedPartner?.name }}</strong></div>
            <div><span style="color:#888">跟进员工：</span><strong>{{ selectedStaff?.name }}</strong></div>
          </div>
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
    const searchingEnterprise = ref(false);
    const enterpriseFilled = ref(false);
    const enterpriseApiNote = ref('');
    const showApiKeyTip = ref(false);
    let searchTimeout = null;
    
    // 支持从其他页面跳转时预填客户名
    onMounted(() => {
      if (route.query.customer) form.customer = decodeURIComponent(route.query.customer);
    });
    
    // 获取当前用户所属区域（渠道合作伙伴从store.user.region获取）
    const userRegion = computed(() => store.user?.region || '');
    // 获取当前用户ID（员工使用staffId，管理员使用username）
    const userId = computed(() => store.user?.id || '');
    // 判断当前用户是否为管理员（admin 或 superadmin）
    const isAdmin = computed(() => store.user?.role === 'admin' || store.user?.role === 'superadmin');
    
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
    
    // 选择企业 - 自动回填工商信息
    function selectEnterprise(enterprise) {
      form.customer = enterprise.name;
      form.creditCode = enterprise.creditCode || '';
      form.legalPerson = enterprise.legalPerson || '';
      form.address = enterprise.address || '';
      form.companyStatus = enterprise.companyStatus || '';
      if (enterprise.city) {
        form.city = enterprise.province ? `${enterprise.province}${enterprise.city}` : enterprise.city;
      } else if (enterprise.address) {
        form.city = enterprise.address.substring(0, 12).replace(/[区县镇乡街道路号].*/,'') || enterprise.address;
      }
      if (enterprise.industry && !form.industry) {
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
          if (enterprise.industry.includes(key)) {
            form.industry = val;
            break;
          }
        }
      }
      showEnterpriseList.value = false;
      enterpriseFilled.value = true;
      creditCodeError.value = '';
    }
    
    // 清除工商回填
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
    
    // 下一步逻辑：根据是否报备商机决定跳转到哪一步
    function goToNext() {
      if (hasOpportunity.value) {
        step.value = 2;
      } else {
        step.value = 3; // 直接到指派渠道
        loadPartners();
      }
    }
    
    // 从确认页返回：根据是否报备商机决定返回到哪一步
    function goBackFromConfirm() {
      step.value = 3; // 返回到指派渠道步骤
    }
    
    // ========== 渠道指派相关 ==========
    const regionPartners = ref([]);
    const selectedPartnerId = ref('');
    const selectedStaffId = ref('');
    const loadingPartners = ref(false);
    
    // 加载本区域渠道合作伙伴
    async function loadPartners() {
      loadingPartners.value = true;
      try {
        const result = await apiClient.getPartners({ status: 'active' });
        if (result.success) {
          regionPartners.value = result.data || [];
        }
      } catch (err) {
        console.error('加载渠道商失败:', err);
      } finally {
        loadingPartners.value = false;
      }
    }
    
    // 当前选中的渠道商
    const selectedPartner = computed(() => {
      return regionPartners.value.find(p => p.id === selectedPartnerId.value);
    });
    
    // 当前选中渠道商的员工列表
    const selectedPartnerStaff = computed(() => {
      return selectedPartner.value?.staff || [];
    });
    
    // 当前选中的员工
    const selectedStaff = computed(() => {
      return selectedPartnerStaff.value.find(s => s.id === selectedStaffId.value);
    });
    
    // 渠道指派表单校验
    const isAssignValid = computed(() => {
      return selectedPartnerId.value && selectedStaffId.value;
    });
    
    // 渠道选择变化时清空员工选择
    function onPartnerChange() {
      selectedStaffId.value = '';
    }
    
    // 从项目信息页进入指派渠道页
    function goToAssign() {
      step.value = 3;
      loadPartners();
    }
    
    // 从指派渠道页返回
    function goBackFromAssign() {
      if (hasOpportunity.value) {
        step.value = 2;
      } else {
        step.value = 1;
      }
    }
    
    // 从指派渠道页进入确认页
    function goToConfirm() {
      step.value = 4;
    }
    
    async function submit() {
      submitting.value = true;
      
      // 查重校验：先从后端获取完整的报备列表
      try {
        const allRegsResult = await apiClient.getRegistrations();
        const allRegistrations = allRegsResult.success ? allRegsResult.data : [];
        
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
      } catch (err) {
        console.error('查重校验失败:', err);
        // 查重失败时继续提交，让后端再做一次校验
      }
      
      // 构建提交数据
      // 管理员提交的报备自动通过，无需审核
      const isAutoApproved = isAdmin.value;
      const submitData = {
        id: genId('REG-2026'),
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
        status: isAutoApproved ? 'approved' : 'pending',
        region: userRegion.value,
        owner: userId.value,
        createdAt: today(),
        hasOpportunity: hasOpportunity.value,
        // 指派渠道信息
        assignedPartnerId: selectedPartnerId.value,
        assignedPartnerName: selectedPartner.value?.name || '',
        assignedStaffId: selectedStaffId.value,
        assignedStaffName: selectedStaff.value?.name || ''
      };
      
      // 管理员自动通过的报备，添加审核信息
      if (isAutoApproved) {
        submitData.approvedBy = userId.value;
        submitData.approvedAt = new Date().toISOString();
      }
      
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
        // 调用 API 创建报备
        const result = await apiClient.createRegistration(submitData);
        if (result.success) {
          store.registrations.unshift(result.data || submitData);
          const isAutoApproved = isAdmin.value;
          store.notifications.unshift({ 
            id: Date.now(), 
            title: isAutoApproved ? '报备已生效' : '报备已提交', 
            desc: isAutoApproved ? `${form.customer} 报备已自动通过` : `${form.customer} 报备申请已提交，等待厂商审核`, 
            time: '刚刚', 
            unread: true 
          });
          alert(isAutoApproved ? '报备提交成功！已自动通过审核。' : '报备提交成功！等待厂商审核。');
          router.push('/registration');
        } else {
          alert('提交失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        console.error('提交报备失败:', err);
        alert('提交失败，请检查网络连接');
      } finally {
        submitting.value = false;
      }
    }
    
    return { 
      step, form, submitting, hasOpportunity, industries, 
      showEnterpriseList, enterpriseList, creditCodeError, phoneError,
      searchingEnterprise, enterpriseFilled, enterpriseApiNote, showApiKeyTip,
      isStep1Valid, isAdmin,
      onCustomerInput, hideEnterpriseList, selectEnterprise, clearEnterpriseFill,
      validateCreditCodeInput, validatePhoneInput,
      submit, goToNext, goBackFromConfirm,
      // 渠道指派相关
      regionPartners, selectedPartnerId, selectedStaffId, loadingPartners,
      selectedPartner, selectedPartnerStaff, selectedStaff, isAssignValid,
      onPartnerChange, goToAssign, goBackFromAssign, goToConfirm
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
            <tr><th>报价单号</th><th>客户</th><th>合作伙伴</th><th>项目名称</th><th>端点数</th><th>报价总额</th><th>创建日期</th><th>有效期</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="q in paginatedData" :key="q.id" @click="view(q)" class="clickable-row">
              <td style="font-family:monospace;color:#888;font-size:12px">{{ q.id }}</td>
              <td style="font-weight:600">{{ q.customer }}</td>
              <td>
                <div style="font-weight:500;color:#1677ff">{{ getPartnerDisplayName(q) }}</div>
                <div v-if="q.assignedStaffName" style="font-size:11px;color:#666">{{ q.assignedStaffName }}</div>
                <div v-else-if="q.createdByName" style="font-size:11px;color:#666">{{ q.createdByName }}</div>
              </td>
              <td>
                <span v-if="q.oppId" style="font-size:12px;color:#555">{{ getOppName(q.oppId) }}</span>
                <span v-else style="color:#aaa;font-size:12px">—</span>
              </td>
              <td>{{ q.endpoints }} 台</td>
              <td style="font-weight:700;color:#1677ff">{{ fmt(q.total) }}</td>
              <td style="font-size:12px;color:#888">{{ q.createdAt }}</td>
              <td style="font-size:12px;color:#888">{{ q.validDays }} 天</td>
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
              <div class="quote-meta-item"><label>端点数量</label><span>{{ detail.endpoints }} 台</span></div>
              <div class="quote-meta-item"><label>报价状态</label><span>{{ qLabel(detail.status) }}</span></div>
            </div>
          </div>
          <div class="quote-body">
            <div class="quote-section-title">产品明细</div>
            <!-- 软件产品 -->
            <div v-if="detailItems.filter(p=>p.type!=='hardware').length > 0">
              <div style="font-size:13px;font-weight:600;color:#555;margin:10px 0 6px;padding-left:4px;">🖥️ 软件产品</div>
              <div class="table-wrap">
                <table class="quote-table">
                  <thead><tr><th>#</th><th>产品名称</th><th>产品编号</th><th>授权端点数</th><th>单价（元/端点）</th><th>小计（元）</th></tr></thead>
                  <tbody>
                    <tr v-for="(p,i) in detailItems.filter(p=>p.type!=='hardware')" :key="'sw-'+i">
                      <td>{{ i+1 }}</td>
                      <td>{{ p.name }}</td>
                      <td style="font-family:monospace;font-size:12px;color:#888">{{ p.id }}</td>
                      <td>{{ detail.endpoints }} 台</td>
                      <td>{{ fmt(p.unitPrice) }}</td>
                      <td style="font-weight:700">{{ fmt(p.subtotal) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <!-- 硬件产品 -->
            <div v-if="detailItems.filter(p=>p.type==='hardware').length > 0">
              <div style="font-size:13px;font-weight:600;color:#555;margin:14px 0 6px;padding-left:4px;">🖨️ 硬件设备</div>
              <div class="table-wrap">
                <table class="quote-table">
                  <thead><tr><th>#</th><th>产品名称</th><th>产品编号</th><th>数量</th><th>单价（元）</th><th>金额（元）</th></tr></thead>
                  <tbody>
                    <tr v-for="(p,i) in detailItems.filter(p=>p.type==='hardware')" :key="'hw-'+i">
                      <td>{{ i+1 }}</td>
                      <td>{{ p.name }}</td>
                      <td style="font-family:monospace;font-size:12px;color:#888">{{ p.id }}</td>
                      <td>{{ p.unit }}</td>
                      <td>{{ fmt(p.unitPrice) }}</td>
                      <td style="font-weight:700">{{ fmt(p.subtotal) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
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
            <div class="print-only" style="display:flex;margin-top:40px;border-top:1px solid #e0e0e0;padding-top:20px;justify-content:space-between;font-size:12px;color:#888">
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
            <button class="btn btn-default" @click="router.push('/order');detail=null">📋 查看订单</button>
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
        <div class="modal-header" style="border-bottom:none;padding-bottom:0">
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
  </div>`,
  setup() {
    const router = VueRouter.useRouter();
    const kw = ref('');
    const detail = ref(null);
    const loading = ref(false);
    const currentPage = ref(1);
    const pageSize = ref(10);
    
    // 全局产品数据（用于模板渲染）
    const PRODUCT_DATA = window.PRODUCT_DATA || {};
    
    // 区域管理员隔离
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    // 员工隔离
    const userId = computed(() => store.user?.id || '');
    const isStaff = computed(() => store.user?.role === 'staff');
    
    // 分页相关
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
        pages.push(1);
        if (cur > 3) pages.push('...');
        for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
        if (cur < total - 2) pages.push('...');
        pages.push(total);
      }
      return pages;
    });
    function prevPage() { if (currentPage.value > 1) currentPage.value--; }
    function nextPage() { if (currentPage.value < totalPages.value) currentPage.value++; }
    function goToPage(p) { if (p !== '...' && p >= 1 && p <= totalPages.value) currentPage.value = p; }
    function resetPage() { currentPage.value = 1; }
    
    // 辅助函数：获取报备的区域
    function getRegRegion(regId) {
      const reg = store.registrations.find(r => r.id === regId);
      return reg ? reg.region : null;
    }
    
    // 辅助函数：获取合作伙伴名称（避免模板中复杂表达式）
    function getPartnerDisplayName(item) {
      if (item.assignedPartnerName) return item.assignedPartnerName;
      if (item.assignedPartnerId) {
        const p = store.partners.find(p => p.id === item.assignedPartnerId);
        return p ? p.name : null;
      }
      if (item.partnerName) return item.partnerName;
      if (item.partnerId) {
        const p = store.partners.find(p => p.id === item.partnerId);
        return p ? p.name : null;
      }
      return '—';
    }
    
    // 加载报价单列表
    async function loadQuotes() {
      loading.value = true;
      try {
        console.log('[DEBUG] loadQuotes called, store.user:', store.user);
        const result = await apiClient.getQuotes();
        console.log('[DEBUG] getQuotes result:', result);
        if (result.success && result.data) {
          console.log('[DEBUG] Quotes data count:', result.data.length);
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
      console.log('[DEBUG] myQuotes computed, store.user.role:', store.user?.role, 'isStaff:', isStaff.value, 'adminRegion:', adminRegion.value, 'store.quotes.length:', store.quotes.length);
      if (isStaff.value) {
        // 员工只能看到自己创建的报价单
        return store.quotes.filter(q => q.ownerId === userId.value);
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
      console.log('[DEBUG] Superadmin: returning all', store.quotes.length, 'quotes');
      return store.quotes;
    });
    
    // 计算功能单价（阶梯/固定）
    function calcUnitPrice(feat, endpoints) {
      if (!feat) return 0;
      if (feat.priceFixed) return feat.priceFixed;
      if (feat.tiers && feat.tiers.length) {
        const tier = feat.tiers.find(t => endpoints >= t.min && endpoints <= t.max) || feat.tiers[feat.tiers.length - 1];
        return tier ? (tier.price || 0) : 0;
      }
      if (feat.unitPrice) return feat.unitPrice;
      return 0;
    }
    
    const detailItems = computed(() => {
      if (!detail.value) return [];
      const endpoints = detail.value.endpoints || 0;
      const items = [];
      // 功能模块
      const productIds = detail.value.products || [];
      productIds.forEach(pid => {
        const feat = allFeaturesForDetail.value.find(f => f.id === pid);
        if (feat) {
          const unitPrice = calcUnitPrice(feat, endpoints);
          const isFixed = feat.priceFixed != null && (!feat.tiers || feat.tiers.length === 0);
          const subtotal = isFixed ? unitPrice : unitPrice * endpoints;
          items.push({ id: feat.id, name: feat.name, type: 'feature', unitPrice, subtotal });
        } else {
          items.push({ id: pid, name: pid, type: 'feature', unitPrice: 0, subtotal: 0 });
        }
      });
      // 硬件设备
      const hardwareIds = detail.value.hardwareIds || [];
      hardwareIds.forEach(hid => {
        const hw = allHardwareForDetail.value.find(h => h.id === hid);
        if (hw) {
          const qty = hw.qty || 1;
          items.push({ id: hw.id, name: hw.name, type: 'hardware', unitPrice: hw.priceFixed || 0, subtotal: (hw.priceFixed || 0) * qty, unit: `${qty} 台` });
        }
      });
      return items;
    });
    const filtered = computed(() => {
      resetPage();
      return myQuotes.value.filter(q => !kw.value || q.customer.includes(kw.value) || q.id.includes(kw.value));
    });
    function qClass(s) { return { draft:'tag-gray', sent:'tag-blue', confirmed:'tag-green', converted:'tag-purple', expired:'tag-red' }[s]||'tag-gray'; }
    function qLabel(s) { return { draft:'草稿', sent:'已发送', confirmed:'已确认', converted:'已转单', expired:'已过期' }[s]||s; }
    
    // 收货地址弹窗相关
    const showDeliveryModal = ref(false);
    const deliveryForm = reactive({ addr: '', contact: '', phone: '' });
    const currentQuoteForOrder = ref(null);
    
    function view(q) { detail.value = q; }
    function getOppName(oppId) {
      const opp = store.opportunities.find(o => o.id === oppId);
      return opp ? opp.name : oppId;
    }
    
    // 发送报价（草稿 -> 已发送）
    async function sendQuote(q) {
      try {
        const result = await apiClient.updateQuoteStatus(q.id, 'sent');
        if (result.success) {
          const idx = store.quotes.findIndex(x => x.id === q.id);
          if (idx !== -1) Object.assign(store.quotes[idx], result.data);
          detail.value = result.data;
        } else {
          alert('操作失败：' + (result.error || '未知错误'));
        }
      } catch (err) { alert('操作失败'); }
    }
    
    // 确认报价（已发送 -> 已确认）
    async function confirmQuote(q) {
      try {
        const result = await apiClient.updateQuoteStatus(q.id, 'confirmed');
        if (result.success) {
          const idx = store.quotes.findIndex(x => x.id === q.id);
          if (idx !== -1) Object.assign(store.quotes[idx], result.data);
          detail.value = result.data;
        } else {
          alert('操作失败：' + (result.error || '未知错误'));
        }
      } catch (err) { alert('操作失败'); }
    }
    
    // 撤回报价（已发送 -> 草稿）
    async function withdrawQuote(q) {
      if (!confirm(`确定撤回报价单 ${q.id}？撤回后将变为草稿状态。`)) return;
      try {
        const result = await apiClient.updateQuoteStatus(q.id, 'draft');
        if (result.success) {
          const idx = store.quotes.findIndex(x => x.id === q.id);
          if (idx !== -1) Object.assign(store.quotes[idx], result.data);
          detail.value = result.data;
        } else {
          alert('操作失败：' + (result.error || '未知错误'));
        }
      } catch (err) { alert('操作失败'); }
    }
    
    // 标记过期
    async function expireQuote(q) {
      try {
        const result = await apiClient.updateQuoteStatus(q.id, 'expired');
        if (result.success) {
          const idx = store.quotes.findIndex(x => x.id === q.id);
          if (idx !== -1) Object.assign(store.quotes[idx], result.data);
          detail.value = result.data;
        }
      } catch (err) {}
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

    // 修改报价单（导航到编辑页面，携带报价单ID）
    function editQuote(q) {
      router.push('/quote/edit/' + q.id);
    }
    
    // 转订单（打开收货地址弹窗）
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
    
    // 确认转订单
    async function confirmToOrder() {
      if (!deliveryForm.addr.trim()) { alert('请填写收货地址'); return; }
      if (!deliveryForm.contact.trim()) { alert('请填写联系人'); return; }
      if (!deliveryForm.phone.trim()) { alert('请填写联系电话'); return; }
      
      const q = currentQuoteForOrder.value;
      const reg = store.registrations.find(r => r.id === q.regId);
      showDeliveryModal.value = false;
      
      try {
        const result = await apiClient.createOrder({
          quoteId: q.id,
          customer: q.customer,
          total: q.total,
          deliveryAddr: deliveryForm.addr.trim(),
          contacts: `${deliveryForm.contact.trim()} ${deliveryForm.phone.trim()}`,
          region: reg ? reg.region : (q.region || ''),
          regId: q.regId || '',
          oppId: q.oppId || '',
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
          router.push('/order');
        } else {
          alert('创建订单失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        console.error('创建订单失败:', err);
        alert('创建订单失败，请检查网络连接');
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
    return { kw, detail, adminRegion, isStaff, detailItems, filtered, paginatedData, loading, fmt, qClass, qLabel, view, downloadPdf, PRODUCT_DATA, getOppName, loadQuotes, allFeaturesForDetail,
      currentPage, totalPages, pageNumbers, prevPage, nextPage, goToPage,
      sendQuote, confirmQuote, withdrawQuote, deleteQuote, expireQuote, openToOrderModal, confirmToOrder, editQuote,
      showDeliveryModal, deliveryForm, getPartnerDisplayName };
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
            <select class="form-control" v-model="form.customer" @change="onCustomerChange" :disabled="isEdit">
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
        <!-- 关联商机选择 -->
        <div class="form-grid" style="margin-top:16px" v-if="form.customer && !isEdit">
          <div class="form-item full">
            <label class="form-label required">关联商机 <span style="font-size:12px;color:#888;font-weight:400">（必须至少选择一个）</span></label>
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
            <div v-else style="margin-top:10px;padding:16px;background:#fff7e6;border:1px solid #ffd591;border-radius:10px;text-align:center">
              <div style="font-size:13px;color:#ad6800;margin-bottom:10px">该客户暂无活跃商机，请先创建商机后再报价</div>
              <button class="btn btn-primary" style="padding:6px 20px;font-size:13px" @click="$router.push('/opportunity/new?customer=' + encodeURIComponent(form.customer))">+ 创建商机</button>
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
    
    // 编辑模式：从路由获取报价单ID（格式：/quote/edit/:id）
    const editId = route.params.id || '';
    const isEdit = !!editId;
    const replaceId = route.query.replaceId || '';
    const quickQuoteMsg = ref('');
    
    // 报价模式
    const quoteMode = ref('package'); // package | supplement | custom
    const form = reactive({
      customer: decodeURIComponent(route.query.customer || ''),
      regId: route.query.regId || '',
      oppIds: route.query.oppId ? [route.query.oppId] : [],
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
          
          // 提取所有功能，并补充完整价格信息
          const features = [];
          result.data?.forEach(cat => {
            cat.modules?.forEach(mod => {
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
      const features = allFeatures.value.filter(f => 
        (selectedPackage.value.featureIds || []).includes(f.id)
      );
      return calcFeatureTotal(features, form.endpoints);
    });
    
    // 计算补充功能价格
    function getSupplementPrice() {
      const features = allFeatures.value.filter(f => supplementFeatures.value.includes(f.id));
      return calcFeatureTotal(features, form.endpoints);
    }
    
    // 计算自定义功能价格
    function getCustomPrice() {
      const features = allFeatures.value.filter(f => customFeatures.value.includes(f.id));
      return calcFeatureTotal(features, form.endpoints);
    }
    
    // 计算功能模块总价
    function calcFeatureTotal(features, endpoints) {
      if (!features.length) return 0;
      let total = 0;
      const qty = endpoints || 0;
      
      features.forEach(feat => {
        if (feat.priceFixed) {
          total += feat.priceFixed * (feat.discount || 1);
        } else if (feat.tiers && feat.tiers.length) {
          const tier = feat.tiers.find(t => qty >= t.min && qty <= t.max) || feat.tiers[0];
          if (tier) {
            const price = feat.unitPrice ? feat.unitPrice * tier.discount : (tier.price || 0);
            total += price * qty;
          }
        } else if (feat.unitPrice) {
          total += feat.unitPrice * qty;
        }
      });
      return Math.round(total);
    }
    
    // 获取功能价格显示
    function getFeaturePriceDisplay(feat) {
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
      if (feat.priceFixed) {
        return feat.priceFixed * (feat.discount || 1);
      }
      if (feat.tiers && feat.tiers.length) {
        const tier = feat.tiers.find(t => form.endpoints >= t.min && form.endpoints <= t.max) || feat.tiers[0];
        return tier ? (feat.unitPrice ? feat.unitPrice * tier.discount * form.endpoints : tier.price || 0) : 0;
      }
      if (feat.unitPrice) {
        return feat.unitPrice * form.endpoints;
      }
      return 0;
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
      if (!isEdit && form.oppIds.length === 0) return false;
      if (quoteMode.value === 'package' && !selectedPackageId.value) return false;
      if (quoteMode.value === 'supplement' && !selectedPackageId.value) return false;
      if (quoteMode.value === 'custom' && !customFeatures.value.length) return false;
      return grandTotal.value > 0;
    });
    
    // 已审批报备
    const approvedRegs = computed(() => {
      let list = store.registrations.filter(r => r.status === 'approved');
      if (isStaff.value) {
        return list.filter(r => r.createdBy === userId.value);
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
        list = list.filter(o => o.ownerId === userId.value || o.assignedStaffId === userId.value || o.createdBy === userId.value);
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
    
    // 切换商机选择状态
    function toggleOppSelection(oppId) {
      const idx = form.oppIds.indexOf(oppId);
      if (idx >= 0) {
        form.oppIds.splice(idx, 1);
      } else {
        form.oppIds.push(oppId);
      }
    }
    
    // 商机阶段颜色
    function stageColor(stage) {
      const colors = {
        prospecting: '#1677ff', qualification: '#52c41a', proposal: '#faad14',
        negotiation: '#eb2f96', closing: '#722ed1', won: '#52c41a', lost: '#ff4d4f'
      };
      return colors[stage] || '#888';
    }
    
    // 保存报价单（支持新建和编辑）
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
        // 编辑模式：更新报价单
        if (isEdit) {
          const result = await apiClient.updateQuote(editId, {
            customer: form.customer,
            regId: reg ? reg.id : form.regId,
            oppIds: form.oppIds,
            oppId: form.oppIds[0] || null,
            endpoints: form.endpoints,
            products: productIds,
            hardwareIds: hardwareIds,
            quoteMode: quoteMode.value,
            packageId: selectedPackageId.value,
            total: grandTotal.value,
            validDays: form.validDays,
          });
          
          if (result.success) {
            // 更新本地数据
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
        
        // 新建模式
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
          total: grandTotal.value,
          validDays: form.validDays,
          ownerId: userId.value,
          createdBy: store.user.id,
          assignedStaffId: store.user.id,
        });
        
        if (result.success) {
          store.quotes.unshift(result.data);
          // 同步更新商机：关联报价单ID，推进阶段
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
        console.error('保存报价单失败:', err);
        alert('保存失败，请检查网络连接');
      }
    }
    
    // 初始化
    onMounted(async () => {
      // 加载产品目录
      await loadProductCatalog();
      
      // 编辑模式：加载已有报价单数据
      if (isEdit) {
        const quote = store.quotes.find(q => q.id === editId);
        if (quote) {
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
          quoteMode.value = quote.quoteMode || 'package';
          selectedPackageId.value = quote.packageId || '';
          // 加载产品列表
          if (quote.products?.length) {
            const allIds = [...(quote.products || [])];
            if (quoteMode.value === 'package') {
              // 套餐模式
            } else if (quoteMode.value === 'supplement' && selectedPackageId.value) {
              const pkg = publishedPackages.value.find(p => p.id === selectedPackageId.value);
              if (pkg?.featureIds?.length) {
                supplementFeatures.value = allIds.filter(id => !pkg.featureIds.includes(id));
              } else {
                supplementFeatures.value = [...allIds];
              }
            } else {
              customFeatures.value = [...allIds];
            }
          }
          if (quote.hardwareIds?.length) {
            selectedHardware.value = [...quote.hardwareIds];
          }
        }
        // 继续加载报备和商机列表（用于展示）
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
      approvedRegs, relatedOpportunities, selectedOpps, subTotal, hardwareTotal, grandTotal, canSave,
      setMode, selectPackage, toggleSupplementFeature, toggleCustomFeature, toggleHardware,
      getFeatureName, getFeaturePrice, getFeaturePriceDisplay, getHardwareName, getHardwarePrice,
      getAvailableFeatures, supplementCategories, packagePrice, recalcAll,
      onCustomerChange, toggleOppSelection, saveQuote, fmt, quickQuoteMsg, stageLabel, stageColor,
      // 新增的展开状态和方法
      expandedCategoryId, summaryPackageExpanded, packageDetail,
      openPackageDetail, getFeaturePriceType, packagePriceForDetail,
      toggleCategoryExpand,
      getFeatureCategoryId, getCategoryIcon, getCategoryName, getCategoryModules,
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
          <thead><tr><th>订单编号</th><th>关联报价</th><th>客户</th><th>合作伙伴</th><th>金额</th><th>状态</th><th>下单日期</th><th>收货地址</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="o in paginatedData" :key="o.id" @click="view(o)" style="cursor:pointer">
              <td style="font-family:monospace;font-size:12px;color:#888">{{ o.id }}</td>
              <td style="font-size:12px;color:#1677ff">{{ o.quoteId }}</td>
              <td style="font-weight:600">{{ o.customer }}</td>
              <td>
                <div style="font-weight:500;color:#1677ff">{{ getPartnerDisplayName(o) }}</div>
                <div v-if="o.assignedStaffName" style="font-size:11px;color:#666">{{ o.assignedStaffName }}</div>
                <div v-else-if="o.createdByName" style="font-size:11px;color:#666">{{ o.createdByName }}</div>
              </td>
              <td style="font-weight:700;color:#1677ff">{{ fmt(o.total) }}</td>
              <td><span class="tag" :class="oClass(o.status)">{{ oLabel(o.status) }}</span></td>
              <td style="font-size:12px;color:#888">{{ o.createdAt }}</td>
              <td style="font-size:12px;color:#888;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ o.deliveryAddr }}</td>
              <td @click.stop>
                <!-- 管理员/超级管理员可以操作订单状态 -->
                <template v-if="canManageOrder(o)">
                  <button v-if="o.status==='pending'" class="btn btn-primary btn-sm" @click="confirmOrder(o)">确认订单</button>
                  <button v-else-if="o.status==='primary_confirmed'" class="btn btn-primary btn-sm" style="background:#52c41a;border-color:#52c41a" @click="confirmOrder(o)">区管确认</button>
                  <button v-else-if="o.status==='processing'" class="btn btn-primary btn-sm" @click="shipOrder(o)">确认发货</button>
                  <button v-else-if="o.status==='shipped'" class="btn btn-success btn-sm" @click="completeOrder(o)">完成订单</button>
                  <span v-else-if="o.status==='completed'" class="tag tag-green">已完成</span>
                  <span v-else-if="o.status==='cancelled'" class="tag tag-gray">已取消</span>
                </template>
                <span v-else class="text-muted" style="font-size:12px;color:#999">-</span>
              </td>
            </tr>
            <tr v-if="!paginatedData.length"><td colspan="9"><div class="empty-state"><div class="empty-icon">📦</div><p>暂无订单记录</p></div></td></tr>
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
            <div class="form-item full"><label class="form-label">合作伙伴</label><div style="padding:8px 0;font-weight:600;color:#1677ff">{{ detail.partnerName || '—' }}</div><div v-if="detail.partnerId" style="font-size:12px;color:#aaa;font-family:monospace">{{ detail.partnerId }}</div></div>
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
                <div class="timeline-content"><div class="tl-title">厂商确认处理中</div><div class="tl-desc" v-if="detail.lastOperatorName">确认人：{{ detail.lastOperatorName }}</div></div>
              </div>
              <div class="timeline-item" v-if="['shipped','completed'].includes(detail.status)">
                <div class="timeline-dot-wrap"><div class="timeline-dot" :class="{active: ['shipped','completed'].includes(detail.status)}"></div><div class="timeline-line"></div></div>
                <div class="timeline-content"><div class="tl-title">已发货 / License 已下发</div><div class="tl-time" v-if="detail.statusHistory">{{ getShippedTime() }}</div></div>
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
          <!-- 价格调整区域（仅管理员可见） -->
          <div v-if="isAdmin" style="margin-top:20px;padding:16px;background:#fffbe6;border-radius:8px;border:1px solid #ffe58f">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <div style="font-size:13px;font-weight:700;color:#d48806">💰 价格调整</div>
              <button class="btn btn-sm" style="background:#faad14;color:#fff" @click="showPriceAdjust=true" v-if="!showPriceAdjust">调整价格</button>
            </div>
            <!-- 价格调整表单 -->
            <div v-if="showPriceAdjust" style="margin-top:12px">
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
                <div style="font-size:13px;color:#666">当前价格：<b style="color:#faad14">{{ fmt(detail.amount || detail.total) }}</b></div>
                <span style="color:#999">→</span>
                <input class="form-control" type="number" v-model.number="adjustForm.newAmount" placeholder="调整后价格" style="width:120px"/>
              </div>
              <div style="margin-bottom:10px">
                <textarea class="form-control" v-model="adjustForm.reason" placeholder="请填写价格调整原因（必填）" rows="2" style="resize:none"></textarea>
              </div>
              <div style="display:flex;gap:10px">
                <button class="btn btn-sm" style="background:#faad14;color:#fff" @click="submitPriceAdjust(detail)">确认调整</button>
                <button class="btn btn-sm btn-default" @click="showPriceAdjust=false;adjustForm={newAmount:null,reason:''}">取消</button>
              </div>
              <div v-if="adjustError" style="color:#ff4d4f;font-size:12px;margin-top:8px">{{ adjustError }}</div>
            </div>
            <!-- 价格调整历史 -->
            <div v-if="detail.priceAdjustments && detail.priceAdjustments.length > 0" style="margin-top:12px;padding-top:12px;border-top:1px dashed #ffe58f">
              <div style="font-size:12px;color:#d48806;margin-bottom:8px">调整记录</div>
              <div v-for="(adj, idx) in detail.priceAdjustments.slice().reverse()" :key="idx" style="font-size:12px;color:#666;margin-bottom:6px">
                <span style="color:#999">{{ formatTime(adj.timestamp) }}</span>
                <span style="margin-left:8px">{{ adj.operatorName }}</span>
                <span style="margin-left:8px">将价格从 <b style="color:#faad14">¥{{ fmt(adj.oldAmount) }}</b> 调整为 <b style="color:#52c41a">¥{{ fmt(adj.newAmount) }}</b></span>
                <div style="margin-top:2px;margin-left:80px;color:#888">(原因：{{ adj.reason }})</div>
              </div>
            </div>
          </div>
          <!-- 操作按钮区域（管理员） -->
          <div v-if="canManageOrder(detail) && detail.status !== 'completed' && detail.status !== 'cancelled'" style="margin-top:24px;padding-top:20px;border-top:1px solid #eee">
            <div style="font-size:13px;font-weight:700;margin-bottom:14px">订单操作</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button v-if="detail.status==='pending'" class="btn btn-primary" @click="confirmOrder(detail);detail=null">确认订单</button>
              <button v-if="detail.status==='primary_confirmed'" class="btn btn-primary" style="background:#52c41a;border-color:#52c41a" @click="confirmOrder(detail);detail=null">区管确认（一级已确认）</button>
              <button v-if="detail.status==='processing'" class="btn btn-primary" @click="shipOrder(detail);detail=null">确认发货</button>
              <button v-if="detail.status==='shipped'" class="btn btn-success" @click="completeOrder(detail);detail=null">完成订单</button>
              <button v-if="detail.status!=='cancelled'" class="btn btn-danger" @click="cancelOrder(detail);detail=null">取消订单</button>
            </div>
          </div>
          <!-- 状态变更历史 -->
          <div v-if="detail.statusHistory && detail.statusHistory.length > 0" style="margin-top:24px;padding-top:20px;border-top:1px solid #eee">
            <div style="font-size:13px;font-weight:700;margin-bottom:14px">操作记录</div>
            <div style="font-size:12px;color:#666">
              <div v-for="(h, idx) in detail.statusHistory.slice().reverse()" :key="idx" style="margin-bottom:8px">
                <span style="color:#999">{{ formatTime(h.timestamp) }}</span> 
                <span style="margin-left:8px">{{ h.operatorName }}</span>
                <span style="margin-left:8px">将状态从 "{{ oLabel(h.from) }}" 改为 "{{ oLabel(h.to) }}"</span>
                <span v-if="h.remark" style="margin-left:8px;color:#888">({{ h.remark }})</span>
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
    const loading = ref(false);
    const currentPage = ref(1);
    const pageSize = ref(10);
    
    // 区域管理员隔离
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    const isAdmin = computed(() => store.user?.role === 'admin' || store.user?.role === 'superadmin');
    const userRegion = computed(() => store.user?.region || '');
    // 员工隔离
    const userId = computed(() => store.user?.id || '');
    const isStaff = computed(() => store.user?.role === 'staff');
    
    // 分页相关
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
        pages.push(1);
        if (cur > 3) pages.push('...');
        for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
        if (cur < total - 2) pages.push('...');
        pages.push(total);
      }
      return pages;
    });
    function prevPage() { if (currentPage.value > 1) currentPage.value--; }
    function nextPage() { if (currentPage.value < totalPages.value) currentPage.value++; }
    function goToPage(p) { if (p !== '...' && p >= 1 && p <= totalPages.value) currentPage.value = p; }
    function resetPage() { currentPage.value = 1; }
    
    // 辅助函数：获取合作伙伴名称（避免模板中复杂表达式）
    function getPartnerDisplayName(item) {
      if (item.assignedPartnerName) return item.assignedPartnerName;
      if (item.assignedPartnerId) {
        const p = store.partners.find(p => p.id === item.assignedPartnerId);
        return p ? p.name : null;
      }
      if (item.partnerName) return item.partnerName;
      if (item.partnerId) {
        const p = store.partners.find(p => p.id === item.partnerId);
        return p ? p.name : null;
      }
      return '—';
    }
    
    // 判断当前用户是否可以管理该订单（超级管理员可以管理所有，区域管理员只能管理本区域）
    function canManageOrder(order) {
      if (!isAdmin.value) return false;
      if (store.user?.role === 'superadmin') return true;
      // 区域管理员：检查订单是否属于本区域
      if (order.region) {
        return order.region === userRegion.value;
      }
      // 如果没有region字段，通过客户报备信息判断
      const reg = store.registrations.find(r => r.customer === order.customer);
      return reg && reg.region === userRegion.value;
    }
    
    // 加载订单列表
    async function loadOrders() {
      loading.value = true;
      try {
        const result = await apiClient.getOrders();
        if (result.success && result.data) {
          // 合并后端数据到本地 store，避免重复，同时更新已有数据
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
    
    // 页面加载时获取订单列表
    onMounted(() => {
      loadOrders();
    });
    
    // 本区域订单（管理员）或本人的订单（员工）
    const myOrders = computed(() => {
      if (isStaff.value) {
        // 员工只能看到自己创建的订单（通过quoteId关联到报价单，再关联到ownerId）
        return store.orders.filter(o => {
          const quote = store.quotes.find(q => q.id === o.quoteId);
          return quote && quote.ownerId === userId.value;
        });
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
    
    const filtered = computed(() => {
      resetPage();
      return myOrders.value.filter(o => {
        const mK = !kw.value || o.customer.includes(kw.value) || o.id.includes(kw.value);
        const mS = !filterStatus.value || o.status === filterStatus.value;
        return mK && mS;
      });
    });
    
    function oClass(s) { return { pending:'tag-orange', primary_confirmed:'tag-green', primary_rejected:'tag-red', processing:'tag-blue', shipped:'tag-purple', completed:'tag-green', cancelled:'tag-gray' }[s]||'tag-gray'; }
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
    
    // 确认订单（pending 或 primary_confirmed -> processing）
    async function confirmOrder(order) {
      const isPrimaryConfirmed = order.status === 'primary_confirmed';
      const label = isPrimaryConfirmed ? '该订单已经一级渠道商确认，确认区管审批并开始处理' : '确认接受订单';
      if (!confirm(`${label}\n订单：${order.id}\n客户：${order.customer}\n金额：${fmt(order.total)}`)) return;
      try {
        const remark = isPrimaryConfirmed ? '区域管理员确认，开始处理' : '厂商已确认订单，开始处理';
        const result = await apiClient.updateOrderStatus(order.id, 'processing', remark);
        if (result.success) {
          // 更新本地数据
          const idx = store.orders.findIndex(o => o.id === order.id);
          if (idx !== -1) {
            store.orders[idx] = result.data;
          }
          alert('订单已确认，进入处理中状态');
        } else {
          alert('操作失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        alert('操作失败：' + err.message);
      }
    }
    
    // 确认发货（processing -> shipped）
    async function shipOrder(order) {
      if (!confirm(`确认订单 ${order.id} 已发货？\nLicense 已生成 / 硬件已发货`)) return;
      try {
        const result = await apiClient.updateOrderStatus(order.id, 'shipped', 'License已下发/硬件已发货');
        if (result.success) {
          const idx = store.orders.findIndex(o => o.id === order.id);
          if (idx !== -1) {
            store.orders[idx] = result.data;
          }
          alert('订单已标记为已发货');
        } else {
          alert('操作失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        alert('操作失败：' + err.message);
      }
    }
    
    // 完成订单（shipped -> completed）
    async function completeOrder(order) {
      if (!confirm(`确认完成订单 ${order.id}？`)) return;
      try {
        const result = await apiClient.updateOrderStatus(order.id, 'completed', '订单已完成');
        if (result.success) {
          const idx = store.orders.findIndex(o => o.id === order.id);
          if (idx !== -1) {
            store.orders[idx] = result.data;
          }
          alert('订单已完成');
        } else {
          alert('操作失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        alert('操作失败：' + err.message);
      }
    }
    
    // 取消订单
    async function cancelOrder(order) {
      const remark = prompt(`请输入取消订单 ${order.id} 的原因：`, '客户取消');
      if (remark === null) return; // 用户点击取消
      try {
        const result = await apiClient.updateOrderStatus(order.id, 'cancelled', remark);
        if (result.success) {
          const idx = store.orders.findIndex(o => o.id === order.id);
          if (idx !== -1) {
            store.orders[idx] = result.data;
          }
          alert('订单已取消');
        } else {
          alert('操作失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        alert('操作失败：' + err.message);
      }
    }
    
    // 价格调整相关
    const showPriceAdjust = ref(false);
    const adjustForm = ref({ newAmount: null, reason: '' });
    const adjustError = ref('');
    
    async function submitPriceAdjust(order) {
      adjustError.value = '';
      const { newAmount, reason } = adjustForm.value;
      
      if (!newAmount || newAmount <= 0) {
        adjustError.value = '请输入有效的调整后价格';
        return;
      }
      if (!reason || reason.trim() === '') {
        adjustError.value = '请填写价格调整原因';
        return;
      }
      
      try {
        const res = await apiRequest('PUT', `/orders/${order.id}/price-adjust`, {
          newAmount,
          adjustmentReason: reason,
          operatorId: store.user.id,
          operatorName: store.user.name,
          operatorRole: store.user.role
        });
        
        if (res && res.success) {
          alert(`价格已从 ¥${(order.amount || order.total).toLocaleString()} 调整为 ¥${newAmount.toLocaleString()}`);
          // 更新本地订单数据
          const idx = store.orders.findIndex(o => o.id === order.id);
          if (idx !== -1) {
            store.orders[idx] = res.data;
          }
          // 更新详情中的订单数据
          detail.value = res.data;
          showPriceAdjust.value = false;
          adjustForm.value = { newAmount: null, reason: '' };
        } else {
          adjustError.value = (res && res.error) || '调整失败';
        }
      } catch (err) {
        adjustError.value = '操作失败：' + err.message;
      }
    }
    
    return { kw, filterStatus, adminRegion, isStaff, isAdmin, filtered, paginatedData, detail, loading, fmt, oClass, oLabel, view, loadOrders, canManageOrder, confirmOrder, shipOrder, completeOrder, cancelOrder, getShippedTime, formatTime,
      currentPage, totalPages, pageNumbers, prevPage, nextPage, goToPage, getPartnerDisplayName,
      showPriceAdjust, adjustForm, adjustError, submitPriceAdjust };
  }
};

// ── 产品目录（所有管理员可见，超级管理员额外显示管理功能）─────────────
const ProductCatalog = {
  template: `
  <div>
    <!-- 顶部导航标签 -->
    <div class="tab-nav" style="margin-bottom:20px">
      <!-- 所有管理员可见的标签 -->
      <div class="tab-item" :class="{active: currentTab === 'products'}" @click="currentTab = 'products'">
        💻 产品目录
      </div>
      <!-- 仅区域管理员可见：推荐套餐（超级管理员使用套餐管理功能） -->
      <div v-if="!isSuperAdmin" class="tab-item" :class="{active: currentTab === 'packages'}" @click="currentTab = 'packages'">
        📦 推荐套餐
      </div>
      <!-- 仅超级管理员可见的管理标签 -->
      <div v-if="isSuperAdmin" class="tab-divider"></div>
      <div v-if="isSuperAdmin" class="tab-item" :class="{active: currentTab === 'manage-categories'}" @click="currentTab = 'manage-categories'">
        📂 大类管理
      </div>
      <div v-if="isSuperAdmin" class="tab-item" :class="{active: currentTab === 'manage-modules'}" @click="currentTab = 'manage-modules'">
        📋 模块管理
      </div>
      <div v-if="isSuperAdmin" class="tab-item" :class="{active: currentTab === 'manage-features'}" @click="currentTab = 'manage-features'">
        ⚙️ 功能管理
      </div>
      <div v-if="isSuperAdmin" class="tab-item" :class="{active: currentTab === 'manage-hardware'}" @click="currentTab = 'manage-hardware'">
        🖥️ 硬件管理
      </div>
      <div v-if="isSuperAdmin" class="tab-item" :class="{active: currentTab === 'manage-packages'}" @click="currentTab = 'manage-packages'">
        📦 套餐管理
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" style="text-align:center;padding:60px;color:#999">
      <div style="font-size:24px">⏳</div>
      <div style="margin-top:10px">加载中...</div>
    </div>

    <!-- ===== 产品目录视图（弹窗层级式，与合作伙伴端一致） ===== -->
    <div v-else-if="currentTab === 'products'">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <h2 style="font-size:18px;font-weight:700;color:#1a1a1a">💻 产品目录</h2>
          <p style="font-size:13px;color:#888;margin-top:4px">点击查看产品详情与价格体系</p>
        </div>
      </div>

      <!-- 大类卡片网格 -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px">
        <div v-for="cat in categories" :key="cat.id" class="category-card" 
             @click="openCategoryPreview(cat)" style="cursor:pointer">
          <div class="category-card-icon">{{ cat.icon }}</div>
          <div class="category-card-content">
            <div class="category-card-name">{{ cat.name }}</div>
            <div class="category-card-desc">{{ cat.desc || '暂无描述' }}</div>
            <div class="category-card-meta">
              <span class="tag" :class="cat.type === 'software' ? 'tag-blue' : 'tag-purple'">
                {{ cat.type === 'software' ? '软件' : '硬件' }}
              </span>
              <span class="tag tag-gray">{{ getModuleCount(cat.id) }} 模块</span>
              <span class="tag tag-gray">{{ getFeatureCount(cat.id) }} 功能</span>
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
          <div v-for="hw in hardware" :key="hw.id" class="feature-card" @click="viewHardwareDetail(hw)">
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
      </div>
    </div>

    <!-- ===== 推荐套餐视图（与合作伙伴端一致） ===== -->
    <div v-else-if="currentTab === 'packages'">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <h2 style="font-size:18px;font-weight:700;color:#1a1a1a">📦 推荐套餐</h2>
          <p style="font-size:13px;color:#888;margin-top:4px">精选产品组合，一键获取方案报价</p>
        </div>
      </div>

      <!-- 套餐卡片 -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:20px">
        <div v-for="pkg in packages" :key="pkg.id" class="package-card" @click="openPackagePreview(pkg)">
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
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid #f0f0f0;display:flex;justify-content:flex-end">
            <span style="font-size:12px;color:#007AFF">查看套餐详情 →</span>
          </div>
        </div>
      </div>

      <div v-if="!packages.length" class="empty-state">
        <div class="empty-icon">📦</div>
        <p>暂无推荐套餐</p>
      </div>
    </div>

    <!-- ===== 产品大类管理（仅超级管理员） ===== -->
    <div v-else-if="currentTab === 'manage-categories' && isSuperAdmin">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3 style="font-size:16px;font-weight:600">📂 产品大类管理</h3>
        <button class="btn btn-primary" @click="openCategoryDialog()">+ 新增大类</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
        <div v-for="cat in categories" :key="cat.id" class="category-card" @click="selectCategory(cat)">
          <div class="category-card-icon">{{ cat.icon }}</div>
          <div class="category-card-content">
            <div class="category-card-name">{{ cat.name }}</div>
            <div class="category-card-desc">{{ cat.desc || '暂无描述' }}</div>
            <div class="category-card-meta">
              <span class="tag" :class="cat.type === 'software' ? 'tag-blue' : 'tag-purple'">{{ cat.type === 'software' ? '软件' : '硬件' }}</span>
              <span class="tag tag-gray">{{ getModuleCount(cat.id) }} 模块</span>
              <span class="tag tag-gray">{{ getFeatureCount(cat.id) }} 功能</span>
            </div>
          </div>
          <div class="category-card-actions" @click.stop>
            <button class="btn btn-text btn-sm" @click="openCategoryDialog(cat)">编辑</button>
            <button class="btn btn-text btn-sm" style="color:#ff4d4f" @click="deleteCategory(cat)">删除</button>
          </div>
        </div>
      </div>
      <div v-if="!categories.length" class="empty-state">
        <div class="empty-icon">📂</div>
        <p>暂无产品大类</p>
      </div>
    </div>

    <!-- ===== 产品模块管理（仅超级管理员） ===== -->
    <div v-else-if="currentTab === 'manage-modules' && isSuperAdmin">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <h3 style="font-size:16px;font-weight:600">📋 产品模块管理</h3>
          <select v-model="filterCategoryId" class="form-control" style="margin-top:8px;width:200px">
            <option value="">全部大类</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.icon }} {{ c.name }}</option>
          </select>
        </div>
        <button class="btn btn-primary" @click="openModuleDialog()">+ 新增模块</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
        <div v-for="mod in filteredModules" :key="mod.id" class="module-card" @click="goToFeatureTab(mod)" style="cursor:pointer">
          <div style="display:flex;align-items:flex-start;gap:12px">
            <div class="module-icon">{{ mod.icon }}</div>
            <div style="flex:1">
              <div style="font-weight:600;color:#1a1a1a;margin-bottom:4px">{{ mod.name }}</div>
              <div style="font-size:12px;color:#888;margin-bottom:8px">{{ mod.desc || '暂无描述' }}</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <span class="tag tag-gray">{{ getCategoryName(mod.categoryId) }}</span>
                <span class="tag tag-blue">{{ getModuleFeatureCount(mod.id) }} 功能</span>
              </div>
            </div>
          </div>
          <div class="category-card-actions" @click.stop style="margin-top:12px;padding-top:12px;border-top:1px solid #f0f0f0">
            <button class="btn btn-text btn-sm" @click="openModuleDialog(mod)">编辑</button>
            <button class="btn btn-text btn-sm" style="color:#ff4d4f" @click="deleteModule(mod)">删除</button>
          </div>
        </div>
      </div>
      <div v-if="!filteredModules.length" class="empty-state">
        <div class="empty-icon">📋</div>
        <p>暂无产品模块</p>
      </div>
    </div>

    <!-- ===== 功能模块管理（仅超级管理员） ===== -->
    <div v-else-if="currentTab === 'manage-features' && isSuperAdmin">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <h3 style="font-size:16px;font-weight:600">⚙️ 功能模块管理</h3>
          <select v-model="filterModuleId" class="form-control" style="margin-top:8px;width:200px">
            <option value="">全部模块</option>
            <optgroup v-for="cat in categories" :key="cat.id" :label="cat.icon + ' ' + cat.name">
              <option v-for="mod in getCategoryModules(cat.id)" :key="mod.id" :value="mod.id">{{ mod.icon }} {{ mod.name }}</option>
            </optgroup>
          </select>
        </div>
        <button class="btn btn-primary" @click="openFeatureDialog()">+ 新增功能</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:16px">
        <div v-for="feat in filteredFeatures" :key="feat.id" class="feature-card" :class="{'feature-card-unpublished': !feat.published}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <div style="flex:1">
              <div style="font-weight:600;font-size:14px;color:#1a1a1a">{{ feat.name }}</div>
              <div style="font-size:11px;color:#999;margin-top:2px">{{ feat.productCode }}</div>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              <span v-if="feat.required" class="tag tag-red">必选</span>
              <span v-if="!feat.published" class="tag tag-orange">待发布</span>
            </div>
          </div>
          <div style="font-size:12px;color:#666;line-height:1.6;margin:8px 0;min-height:36px">{{ feat.desc }}</div>
          <div style="padding:8px;background:#f8f9fa;border-radius:6px;margin-top:8px">
            <div v-if="feat.priceType === 'fixed'" style="font-size:16px;font-weight:700;color:#f5222d">
              ¥{{ feat.priceFixed?.toLocaleString() }}<span style="font-size:12px;font-weight:400;color:#888">/{{ feat.unit }}</span>
            </div>
            <div v-else style="font-size:12px;color:#666">
              <span class="tag tag-blue">阶梯计价</span>
              <span style="margin-left:8px">{{ feat.unit }}</span>
            </div>
          </div>
          <div v-if="isSuperAdmin" class="category-card-actions" @click.stop style="margin-top:12px;padding-top:12px;border-top:1px solid #f0f0f0">
            <button class="btn btn-text btn-sm" @click="openFeatureDialog(feat)">编辑</button>
            <button class="btn btn-text btn-sm" :style="{color: feat.published ? '#fa8c16' : '#52c41a'}" @click="toggleFeaturePublish(feat)">
              {{ feat.published ? '取消发布' : '发布' }}
            </button>
            <button class="btn btn-text btn-sm" style="color:#ff4d4f" @click="deleteFeature(feat)">删除</button>
          </div>
        </div>
      </div>
      <div v-if="!filteredFeatures.length" class="empty-state">
        <div class="empty-icon">⚙️</div>
        <p>暂无功能模块</p>
      </div>
    </div>

    <!-- ===== 硬件产品管理（仅超级管理员） ===== -->
    <div v-else-if="currentTab === 'manage-hardware' && isSuperAdmin">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3 style="font-size:16px;font-weight:600">🖥️ 硬件产品管理</h3>
        <button class="btn btn-primary" @click="openHardwareDialog()">+ 新增硬件</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:16px">
        <div v-for="hw in hardware" :key="hw.id" class="feature-card" :class="{'feature-card-unpublished': !hw.published}">
          <div style="display:flex;align-items:flex-start;gap:12px">
            <div class="module-icon">{{ hw.icon }}</div>
            <div style="flex:1">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                  <div style="font-weight:600;color:#1a1a1a">{{ hw.name }}</div>
                  <div style="font-size:12px;color:#888;margin-top:2px">{{ hw.model }}</div>
                </div>
                <div style="display:flex;gap:4px">
                  <span v-if="!hw.published" class="tag tag-orange">待发布</span>
                </div>
              </div>
              <div style="font-size:12px;color:#666;margin:8px 0">{{ hw.desc }}</div>
              <div style="font-size:11px;color:#999;padding:6px;background:#f8f9fa;border-radius:4px">{{ hw.specs }}</div>
              <div style="font-size:20px;font-weight:700;color:#f5222d;margin-top:8px">
                ¥{{ hw.priceFixed?.toLocaleString() }}<span style="font-size:12px;font-weight:400;color:#888">/{{ hw.unit }}</span>
              </div>
            </div>
          </div>
          <div class="category-card-actions" @click.stop style="margin-top:12px;padding-top:12px;border-top:1px solid #f0f0f0">
            <button class="btn btn-text btn-sm" @click="openHardwareDialog(hw)">编辑</button>
            <button class="btn btn-text btn-sm" :style="{color: hw.published ? '#fa8c16' : '#52c41a'}" @click="toggleHardwarePublish(hw)">
              {{ hw.published ? '取消发布' : '发布' }}
            </button>
            <button class="btn btn-text btn-sm" style="color:#ff4d4f" @click="deleteHardware(hw)">删除</button>
          </div>
        </div>
      </div>
      <div v-if="!hardware.length" class="empty-state">
        <div class="empty-icon">🖥️</div>
        <p>暂无硬件产品</p>
      </div>
    </div>

    <!-- ===== 套餐管理（仅超级管理员） ===== -->
    <div v-else-if="currentTab === 'manage-packages' && isSuperAdmin">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3 style="font-size:16px;font-weight:600">📦 套餐管理</h3>
        <button class="btn btn-primary" @click="openPackageDialog()">+ 新增套餐</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));gap:16px">
        <div v-for="pkg in packages" :key="pkg.id" class="package-card" :class="{'package-card-unpublished': !pkg.published}" @click="openPackagePreview(pkg)" style="cursor:pointer">
          <div style="display:flex;align-items:flex-start;gap:12px">
            <div class="module-icon" style="width:56px;height:56px;font-size:28px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center">
              {{ pkg.icon }}
            </div>
            <div style="flex:1">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                  <div style="font-weight:700;font-size:16px;color:#1a1a1a">{{ pkg.name }}</div>
                </div>
                <span v-if="!pkg.published" class="tag tag-orange">待发布</span>
              </div>
              <div style="font-size:12px;color:#666;margin:8px 0;line-height:1.6">{{ pkg.desc }}</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                <span class="tag tag-blue">{{ pkg.moduleIds?.length || 0 }} 模块</span>
                <span class="tag tag-green">{{ pkg.featureIds?.length || 0 }} 功能</span>
                <span class="tag tag-purple">{{ pkg.hardwareIds?.length || 0 }} 硬件</span>
              </div>
            </div>
          </div>
          <div class="category-card-actions" @click.stop style="margin-top:12px;padding-top:12px;border-top:1px solid #f0f0f0">
            <button class="btn btn-text btn-sm" @click="openPackageDialog(pkg)">编辑</button>
            <button class="btn btn-text btn-sm" :style="{color: pkg.published ? '#fa8c16' : '#52c41a'}" @click="togglePackagePublish(pkg)">
              {{ pkg.published ? '取消发布' : '发布' }}
            </button>
            <button class="btn btn-text btn-sm" style="color:#ff4d4f" @click="deletePackage(pkg)">删除</button>
          </div>
        </div>
      </div>
      <div v-if="!packages.length" class="empty-state">
        <div class="empty-icon">📦</div>
        <p>暂无套餐，点击"新增套餐"添加</p>
      </div>
    </div>

    <!-- ===== 产品预览弹窗层级 ===== -->

    <!-- 产品模块列表弹窗（弹窗层级式第1层） -->
    <div v-if="showModulesModal" class="modal-overlay" @click.self="showModulesModal=false">
      <div class="modal modal-xl" style="width:900px">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px">
              {{ previewCategory?.icon }}
            </div>
            <div>
              <div class="modal-title">{{ previewCategory?.name }}</div>
              <div style="font-size:12px;color:#8c8c8c;margin-top:2px">产品模块 · 点击卡片查看功能详情</div>
            </div>
          </div>
          <button class="modal-close" @click="showModulesModal=false">×</button>
        </div>
        <div class="modal-body" style="max-height:70vh;overflow-y:auto">
          <div v-if="previewModules.length" class="module-card-grid">
            <div v-for="mod in previewModules" :key="mod.id" 
                 class="module-card-v"
                 :class="{selected: previewSelectedModule?.id === mod.id}"
                 @click="openModulePreview(mod)">
              <div style="font-size:36px;margin-bottom:12px">{{ mod.icon }}</div>
              <div style="font-weight:700;font-size:15px;color:#1a1a1a;margin-bottom:6px;text-align:center;line-height:1.3">{{ mod.name }}</div>
              <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
                <span class="tag tag-blue">{{ getModuleFeatureCount(mod.id) }} 功能</span>
                <span v-if="!mod.published" class="tag tag-orange">待发布</span>
              </div>
              <div v-if="mod.desc" style="font-size:12px;color:#888;margin-top:10px;text-align:center;line-height:1.4">{{ mod.desc }}</div>
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
              {{ previewSelectedModule?.icon }}
            </div>
            <div>
              <div class="modal-title">{{ previewSelectedModule?.name }}</div>
              <div style="font-size:12px;color:#8c8c8c;margin-top:2px">{{ previewCategory?.icon }} {{ previewCategory?.name }} · 功能模块</div>
            </div>
          </div>
          <button class="modal-close" @click="closeFeaturesModal">×</button>
        </div>
        <div class="modal-body" style="max-height:70vh;overflow-y:auto">
          <div v-if="previewFeatures.length" class="feature-card-grid">
            <div v-for="feat in previewFeatures" :key="feat.id" 
                 class="feature-card-h"
                 :class="{required: feat.required}">
              <div style="text-align:center;margin-bottom:12px">
                <div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:4px">{{ feat.name }}</div>
                <div style="display:flex;gap:6px;justify-content:center;margin-bottom:8px;flex-wrap:wrap">
                  <span v-if="feat.required" class="tag tag-red">必选</span>
                  <span v-if="!feat.published" class="tag tag-orange">待发布</span>
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

    <!-- ===== 套餐详情弹窗 ===== -->
    <div v-if="showPackagePreviewModal" class="modal-overlay" @click.self="showPackagePreviewModal=false">
      <div class="modal modal-xl" style="width:900px">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px">
              {{ previewPackage?.icon }}
            </div>
            <div>
              <div class="modal-title">{{ previewPackage?.name }}</div>
              <div style="font-size:12px;color:#8c8c8c;margin-top:2px">套餐详情</div>
            </div>
          </div>
          <button class="modal-close" @click="showPackagePreviewModal=false">×</button>
        </div>
        <div class="modal-body" style="max-height:70vh;overflow-y:auto">
          <div v-if="previewPackage" style="display:flex;flex-direction:column;gap:20px">
            <!-- 基本信息 -->
            <div style="background:#f8f9fa;padding:16px;border-radius:8px">
              <div style="font-size:14px;color:#666;line-height:1.8">
                <div v-if="previewPackage.desc"><strong>套餐描述：</strong>{{ previewPackage.desc }}</div>
                <div style="margin-top:8px">
                  <span class="tag tag-blue">{{ previewPackage.moduleIds?.length || 0 }} 模块</span>
                  <span class="tag tag-green">{{ previewPackage.featureIds?.length || 0 }} 功能</span>
                  <span class="tag tag-purple">{{ previewPackage.hardwareIds?.length || 0 }} 硬件</span>
                  <span v-if="!previewPackage.published" class="tag tag-orange" style="margin-left:8px">待发布</span>
                </div>
              </div>
            </div>
            
            <!-- 模块列表 -->
            <div v-if="getPackageModules(previewPackage).length">
              <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:#1a1a1a">📋 包含模块</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
                <div v-for="mod in getPackageModules(previewPackage)" :key="mod.id" 
                     style="background:#fff;border:1px solid #e8e8e8;border-radius:8px;padding:12px">
                  <div style="font-size:20px;margin-bottom:6px">{{ mod.icon }}</div>
                  <div style="font-weight:600;font-size:13px;color:#1a1a1a">{{ mod.name }}</div>
                  <div style="font-size:11px;color:#888;margin-top:4px">{{ getCategoryName(mod.categoryId) }}</div>
                </div>
              </div>
            </div>
            
            <!-- 功能列表 -->
            <div v-if="getPackageFeatures(previewPackage).length">
              <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:#1a1a1a">⚙️ 包含功能</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
                <div v-for="feat in getPackageFeatures(previewPackage)" :key="feat.id" 
                     style="background:#fff;border:1px solid #e8e8e8;border-radius:8px;padding:12px">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
                    <div style="font-weight:600;font-size:13px;color:#1a1a1a">{{ feat.name }}</div>
                    <span v-if="feat.required" class="tag tag-red" style="font-size:10px">必选</span>
                  </div>
                  <div style="font-size:11px;color:#888">{{ getModuleName(feat.moduleId) }}</div>
                  <div style="margin-top:6px">
                    <span v-if="feat.priceType === 'fixed'" style="color:#f5222d;font-weight:600">¥{{ feat.priceFixed?.toLocaleString() }}/{{ feat.unit }}</span>
                    <span v-else class="tag tag-blue" style="font-size:10px">阶梯计价</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 硬件列表 -->
            <div v-if="getPackageHardware(previewPackage).length">
              <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:#1a1a1a">🖥️ 包含硬件</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
                <div v-for="hw in getPackageHardware(previewPackage)" :key="hw.id" 
                     style="background:#fff;border:1px solid #e8e8e8;border-radius:8px;padding:12px">
                  <div style="font-size:20px;margin-bottom:6px">{{ hw.icon }}</div>
                  <div style="font-weight:600;font-size:13px;color:#1a1a1a">{{ hw.name }}</div>
                  <div v-if="hw.model" style="font-size:11px;color:#888;margin-top:4px">型号: {{ hw.model }}</div>
                  <div style="color:#f5222d;font-weight:600;margin-top:6px">¥{{ hw.priceFixed?.toLocaleString() }}/{{ hw.unit }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showPackagePreviewModal=false">关闭</button>
        </div>
      </div>
    </div>

    <!-- ===== 功能详情弹窗（产品目录视图用） ===== -->
    <div v-if="detailFeature" class="modal-overlay" @click.self="detailFeature=null">
      <div class="modal-content" style="max-width:560px">
        <div class="modal-header">
          <div class="modal-title">{{ detailFeature.name }}</div>
          <button class="modal-close" @click="detailFeature=null">×</button>
        </div>
        <div class="modal-body" style="max-height:65vh;overflow-y:auto">
          <div style="padding:12px;background:#f8f9fa;border-radius:8px;margin-bottom:16px">
            <div style="font-size:13px;color:#666;margin-bottom:8px">{{ detailFeature.desc }}</div>
            <div v-if="detailFeature.productCode" style="font-size:11px;color:#999">产品编码: {{ detailFeature.productCode }}</div>
          </div>
          <div style="padding:16px;background:#fff7e6;border-radius:8px;border:1px solid #ffd591">
            <div style="font-size:12px;color:#ad6800;margin-bottom:8px">💰 价格信息</div>
            <div v-if="detailFeature.priceType === 'fixed'" style="font-size:24px;font-weight:700;color:#f5222d">
              ¥{{ detailFeature.priceFixed?.toLocaleString() }}<span style="font-size:14px;font-weight:400;color:#888">/{{ detailFeature.unit }}</span>
            </div>
            <div v-else style="font-size:14px;color:#666">
              <span class="tag tag-blue">阶梯计价</span>
              <span style="margin-left:8px">{{ detailFeature.unit }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="detailFeature=null">关闭</button>
        </div>
      </div>
    </div>

    <!-- ===== 大类编辑弹窗 ===== -->
    <div v-if="showCategoryDialog" class="modal-overlay" @click.self="showCategoryDialog=false">
      <div class="modal-content" style="max-width:500px">
        <div class="modal-header">
          <div class="modal-title">{{ editingCategory ? '编辑大类' : '新增大类' }}</div>
          <button class="modal-close" @click="showCategoryDialog=false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>大类名称 *</label>
            <input class="form-control" v-model="categoryForm.name" placeholder="如: LEP 终端安全产品">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label>图标</label>
              <input class="form-control" v-model="categoryForm.icon" placeholder="emoji图标，如: 💻">
            </div>
            <div class="form-group">
              <label>类型</label>
              <select class="form-control" v-model="categoryForm.type">
                <option value="software">软件</option>
                <option value="hardware">硬件</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea class="form-control" v-model="categoryForm.desc" rows="2" placeholder="大类描述"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showCategoryDialog=false">取消</button>
          <button class="btn btn-primary" @click="saveCategory" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- ===== 模块编辑弹窗 ===== -->
    <div v-if="showModuleDialog" class="modal-overlay" @click.self="showModuleDialog=false">
      <div class="modal-content" style="max-width:500px">
        <div class="modal-header">
          <div class="modal-title">{{ editingModule ? '编辑模块' : '新增模块' }}</div>
          <button class="modal-close" @click="showModuleDialog=false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>所属大类 *</label>
            <select class="form-control" v-model="moduleForm.categoryId">
              <option value="">选择大类</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.icon }} {{ c.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>模块名称 *</label>
            <input class="form-control" v-model="moduleForm.name" placeholder="如: 管理后台">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label>图标</label>
              <input class="form-control" v-model="moduleForm.icon" placeholder="emoji图标，如: 🖥️">
            </div>
            <div class="form-group">
              <label>排序</label>
              <input type="number" class="form-control" v-model="moduleForm.sort" placeholder="数字越小越靠前">
            </div>
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea class="form-control" v-model="moduleForm.desc" rows="2" placeholder="模块描述"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showModuleDialog=false">取消</button>
          <button class="btn btn-primary" @click="saveModule" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- ===== 功能编辑弹窗 ===== -->
    <div v-if="showFeatureDialog" class="modal-overlay" @click.self="showFeatureDialog=false">
      <div class="modal-content" style="max-width:700px">
        <div class="modal-header">
          <div class="modal-title">{{ editingFeature ? '编辑功能' : '新增功能' }}</div>
          <button class="modal-close" @click="showFeatureDialog=false">×</button>
        </div>
        <div class="modal-body" style="max-height:60vh;overflow-y:auto">
          <div class="form-group">
            <label>所属模块 *</label>
            <select class="form-control" v-model="featureForm.moduleId">
              <option value="">选择模块</option>
              <optgroup v-for="c in categories" :key="c.id" :label="c.icon + ' ' + c.name">
                <option v-for="m in getCategoryModules(c.id)" :key="m.id" :value="m.id">{{ m.icon }} {{ m.name }}</option>
              </optgroup>
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label>功能名称 *</label>
              <input class="form-control" v-model="featureForm.name" placeholder="如: 网络准入控制（NAC）">
            </div>
            <div class="form-group">
              <label>产品编号</label>
              <input class="form-control" v-model="featureForm.productCode" placeholder="如: UA-NAC-1">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            <div class="form-group">
              <label>价格类型</label>
              <select class="form-control" v-model="featureForm.priceType">
                <option value="tiered">阶梯计价</option>
                <option value="fixed">固定价格</option>
              </select>
            </div>
            <div class="form-group">
              <label>单价(元)</label>
              <input type="number" class="form-control" v-model="featureForm.priceFixed" placeholder="0">
            </div>
            <div class="form-group">
              <label>计量单位</label>
              <input class="form-control" v-model="featureForm.unit" placeholder="如: 端点">
            </div>
          </div>
          <div class="form-group">
            <label>功能介绍</label>
            <textarea class="form-control" v-model="featureForm.desc" rows="3" placeholder="详细描述此功能的特点和用途"></textarea>
          </div>
          <div class="form-group" style="display:flex;align-items:center;gap:16px">
            <label style="display:flex;align-items:center;gap:6px">
              <input type="checkbox" v-model="featureForm.required"> 必选功能
            </label>
          </div>
          <!-- 阶梯价格 -->
          <div v-if="featureForm.priceType === 'tiered'" style="margin-top:12px;padding:12px;background:#f8f9fa;border-radius:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <label style="font-weight:600">阶梯价格配置</label>
              <button type="button" class="btn btn-text btn-sm" @click="addFeatureTier">+ 添加阶梯</button>
            </div>
            <div v-for="(t, idx) in featureForm.tiers" :key="idx" style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center">
              <input type="number" class="form-control" v-model="t.min" placeholder="最小数量">
              <input type="number" class="form-control" v-model="t.max" placeholder="最大数量">
              <input type="number" class="form-control" v-model="t.price" placeholder="单价">
              <button type="button" class="btn btn-text btn-sm" style="color:#ff4d4f" @click="featureForm.tiers.splice(idx,1)">×</button>
            </div>
          </div>
          
          <!-- 渠道商价格折扣设置 -->
          <div style="margin-top:12px;padding:12px;background:#e6f7ff;border-radius:8px;border-left:3px solid #1890ff">
            <div style="font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:6px">
              <span>💰</span> 渠道商价格折扣设置
            </div>
            <div style="margin-bottom:12px;padding:8px;background:#fff3cd;border-radius:4px;font-size:12px;color:#856404">
              💡 折扣率说明：折扣率 = 实际支付比例（30% = 打3折，支付原价的30%；100% = 原价，无折扣）
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div class="form-group" style="margin-bottom:0">
                <label style="font-size:12px;color:#666">一级渠道商折扣率</label>
                <div style="display:flex;align-items:center;gap:8px">
                  <input type="number" class="form-control" v-model.number="featureForm.priceRatioPrimary" 
                         min="0" max="100" step="1" placeholder="100"
                         style="flex:1">
                  <span style="font-size:13px;color:#666;white-space:nowrap">%</span>
                </div>
                <div style="font-size:11px;color:#999;margin-top:4px">
                  实际价格 = 原价 × {{ featureForm.priceRatioPrimary || 100 }}%
                </div>
                <div v-if="featureForm.priceType === 'fixed' && (featureForm.priceRatioPrimary || 100) < 100" 
                     style="font-size:11px;color:#52c41a;margin-top:2px">
                  优惠金额 = ¥{{ ((featureForm.priceFixed || 0) * (100 - (featureForm.priceRatioPrimary || 100)) / 100).toFixed(0) }}
                </div>
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label style="font-size:12px;color:#666">二级渠道商折扣率</label>
                <div style="display:flex;align-items:center;gap:8px">
                  <input type="number" class="form-control" v-model.number="featureForm.priceRatioSecondary" 
                         min="0" max="100" step="1" placeholder="30"
                         style="flex:1">
                  <span style="font-size:13px;color:#666;white-space:nowrap">%</span>
                </div>
                <div style="font-size:11px;color:#999;margin-top:4px">
                  实际价格 = 原价 × {{ featureForm.priceRatioSecondary || 100 }}%
                </div>
                <div v-if="featureForm.priceType === 'fixed' && (featureForm.priceRatioSecondary || 100) < 100" 
                     style="font-size:11px;color:#52c41a;margin-top:2px">
                  优惠金额 = ¥{{ ((featureForm.priceFixed || 0) * (100 - (featureForm.priceRatioSecondary || 100)) / 100).toFixed(0) }}
                </div>
              </div>
            </div>
            <div style="margin-top:12px;padding:8px;background:#fff;border-radius:4px;font-size:12px;color:#666">
              <div style="font-weight:600;margin-bottom:4px">💡 价格预览</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
                <div>
                  <span style="color:#999">一级渠道商：</span>
                  <span v-if="featureForm.priceType === 'fixed'" style="font-weight:600;color:#52c41a">
                    ¥{{ Math.round((featureForm.priceFixed || 0) * (featureForm.priceRatioPrimary || 100) / 100) }}
                  </span>
                  <span v-else style="font-weight:600;color:#1890ff">
                    阶梯价格 × {{ featureForm.priceRatioPrimary || 100 }}%
                  </span>
                  <span v-if="(featureForm.priceRatioPrimary || 100) < 100" style="color:#52c41a;font-size:11px;margin-left:4px">
                    ({{ 100 - (featureForm.priceRatioPrimary || 100) }}% off)
                  </span>
                </div>
                <div>
                  <span style="color:#999">二级渠道商：</span>
                  <span v-if="featureForm.priceType === 'fixed'" style="font-weight:600;color:#52c41a">
                    ¥{{ Math.round((featureForm.priceFixed || 0) * (featureForm.priceRatioSecondary || 100) / 100) }}
                  </span>
                  <span v-else style="font-weight:600;color:#1890ff">
                    阶梯价格 × {{ featureForm.priceRatioSecondary || 100 }}%
                  </span>
                  <span v-if="(featureForm.priceRatioSecondary || 100) < 100" style="color:#52c41a;font-size:11px;margin-left:4px">
                    ({{ 100 - (featureForm.priceRatioSecondary || 100) }}% off)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showFeatureDialog=false">取消</button>
          <button class="btn btn-primary" @click="saveFeature" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- ===== 硬件编辑弹窗 ===== -->
    <div v-if="showHardwareDialog" class="modal-overlay" @click.self="showHardwareDialog=false">
      <div class="modal-content" style="max-width:600px">
        <div class="modal-header">
          <div class="modal-title">{{ editingHardware ? '编辑硬件' : '新增硬件' }}</div>
          <button class="modal-close" @click="showHardwareDialog=false">×</button>
        </div>
        <div class="modal-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label>产品名称 *</label>
              <input class="form-control" v-model="hardwareForm.name" placeholder="如: 微盾一体机">
            </div>
            <div class="form-group">
              <label>型号</label>
              <input class="form-control" v-model="hardwareForm.model" placeholder="如: WD-2000">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            <div class="form-group">
              <label>图标</label>
              <input class="form-control" v-model="hardwareForm.icon" placeholder="emoji">
            </div>
            <div class="form-group">
              <label>单价(元)</label>
              <input type="number" class="form-control" v-model="hardwareForm.priceFixed" placeholder="0">
            </div>
            <div class="form-group">
              <label>单位</label>
              <input class="form-control" v-model="hardwareForm.unit" placeholder="如: 台">
            </div>
          </div>
          <div class="form-group">
            <label>产品规格</label>
            <input class="form-control" v-model="hardwareForm.specs" placeholder="如: CPU: 8核 | 内存: 32GB">
          </div>
          <div class="form-group">
            <label>产品介绍</label>
            <textarea class="form-control" v-model="hardwareForm.desc" rows="3" placeholder="详细描述产品特点"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showHardwareDialog=false">取消</button>
          <button class="btn btn-primary" @click="saveHardware" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- ===== 套餐编辑弹窗 ===== -->
    <div v-if="showPackageDialog" class="modal-overlay" @click.self="showPackageDialog=false">
      <div class="modal modal-xl" style="width:900px">
        <div class="modal-header">
          <div class="modal-title">{{ editingPackage ? '编辑套餐' : '新增套餐' }}</div>
          <button class="modal-close" @click="showPackageDialog=false">×</button>
        </div>
        <div class="modal-body" style="max-height:70vh;overflow-y:auto">
          <!-- 基本信息区 -->
          <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:16px;margin-bottom:20px">
            <div class="form-group">
              <label>套餐名称 <span style="color:#ff4d4f">*</span></label>
              <input class="form-control" v-model="packageForm.name" placeholder="如: 基础版套餐">
            </div>
            <div class="form-group">
              <label>图标</label>
              <input class="form-control" v-model="packageForm.icon" placeholder="emoji，如: 📦">
            </div>
            <div class="form-group">
              <label>状态</label>
              <select class="form-control" v-model="packageForm.status">
                <option value="active">✓ 启用</option>
                <option value="inactive">✗ 停用</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>套餐描述</label>
            <textarea class="form-control" v-model="packageForm.desc" rows="2" placeholder="套餐简介"></textarea>
          </div>
          
          <!-- 已选内容摘要 -->
          <div v-if="packageForm.moduleIds.length || packageForm.featureIds.length || packageForm.hardwareIds.length" 
               style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:12px;padding:16px 20px;margin:20px 0;color:#fff;box-shadow:0 4px 12px rgba(102,126,234,0.3)">
            <div style="font-weight:600;margin-bottom:10px;font-size:14px">✨ 已选内容摘要</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              <span v-if="packageForm.moduleIds.length" style="background:rgba(255,255,255,0.35);padding:4px 12px;border-radius:20px;font-size:13px;font-weight:500">
                📦 {{ packageForm.moduleIds.length }} 个模块
              </span>
              <span v-if="packageForm.featureIds.length" style="background:rgba(255,255,255,0.35);padding:4px 12px;border-radius:20px;font-size:13px;font-weight:500">
                ⚙️ {{ packageForm.featureIds.length }} 个功能
              </span>
              <span v-if="packageForm.hardwareIds.length" style="background:rgba(255,255,255,0.35);padding:4px 12px;border-radius:20px;font-size:13px;font-weight:500">
                🖥️ {{ packageForm.hardwareIds.length }} 件硬件
              </span>
            </div>
          </div>
          
          <!-- 模块选择区 - 按大类分组 -->
          <div style="margin-top:20px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <label style="font-weight:600;font-size:14px">📦 产品模块 <span style="color:#8c8c8c;font-weight:normal">(按类别分组)</span></label>
              <span style="font-size:12px;color:#8c8c8c">{{ packageForm.moduleIds.length }}/{{ modules.length }} 已选</span>
            </div>
            <div v-for="cat in categories" :key="cat.id" style="margin-bottom:16px">
              <div v-if="getCategoryModules(cat.id).length" style="border:1px solid #e8e8e8;border-radius:10px;overflow:hidden">
                <!-- 大类标题 -->
                <div style="background:#fafafa;padding:10px 16px;border-bottom:1px solid #e8e8e8;display:flex;align-items:center;gap:8px">
                  <span style="font-size:16px">{{ cat.icon }}</span>
                  <span style="font-weight:600;color:#333">{{ cat.name }}</span>
                  <span style="margin-left:auto;font-size:12px;color:#8c8c8c">
                    {{ getCategoryModules(cat.id).filter(m => packageForm.moduleIds.includes(m.id)).length }}/{{ getCategoryModules(cat.id).length }}
                  </span>
                </div>
                <!-- 模块网格 -->
                <div style="padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;background:#fff">
                  <div v-for="m in getCategoryModules(cat.id)" :key="m.id" 
                       @click="toggleModuleInPackage(m.id)"
                       style="padding:10px 14px;border-radius:8px;border:2px solid transparent;cursor:pointer;transition:all 0.2s"
                       :style="{
                         background: packageForm.moduleIds.includes(m.id) ? '#e6f4ff' : '#f8f9fa',
                         borderColor: packageForm.moduleIds.includes(m.id) ? '#1890ff' : 'transparent'
                       }">
                    <div style="display:flex;align-items:center;gap:6px">
                      <span style="font-size:14px">{{ m.icon }}</span>
                      <span style="font-size:13px;font-weight:500" :style="{color: packageForm.moduleIds.includes(m.id) ? '#1890ff' : '#333'}">{{ m.name }}</span>
                    </div>
                    <div style="margin-top:4px;font-size:11px;color:#8c8c8c">{{ getFeatureCount(m.id) }} 个功能</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 功能模块选择区 -->
          <div style="margin-top:24px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <label style="font-weight:600;font-size:14px">⚙️ 功能模块 <span style="color:#8c8c8c;font-weight:normal">(必选标记🔴)</span></label>
              <span style="font-size:12px;color:#8c8c8c">{{ packageForm.featureIds.length }}/{{ features.length }} 已选</span>
            </div>
            <div style="border:1px solid #e8e8e8;border-radius:10px;overflow:hidden">
              <!-- 表头 -->
              <div style="background:#fafafa;padding:10px 16px;border-bottom:1px solid #e8e8e8;display:grid;grid-template-columns:40px 1fr 100px 80px;gap:12px;font-size:12px;color:#8c8c8c;font-weight:500">
                <div></div>
                <div>功能名称</div>
                <div>所属模块</div>
                <div style="text-align:center">操作</div>
              </div>
              <!-- 功能列表 -->
              <div style="max-height:200px;overflow-y:auto">
                <div v-for="f in features" :key="f.id" 
                     style="padding:10px 16px;border-bottom:1px solid #f0f0f0;display:grid;grid-template-columns:40px 1fr 100px 80px;gap:12px;align-items:center"
                     :style="{background: packageForm.featureIds.includes(f.id) ? '#f0f7ff' : ''}">
                  <div style="text-align:center">
                    <span v-if="f.required" style="color:#ff4d4f;font-size:12px" title="必选">🔴</span>
                    <span v-else style="color:#d9d9d9;font-size:12px">⚪</span>
                  </div>
                  <div style="font-size:13px;font-weight:500">{{ f.name }}</div>
                  <div style="font-size:12px;color:#8c8c8c">{{ getModuleName(f.moduleId) }}</div>
                  <div style="text-align:center">
                    <button v-if="f.required" class="btn btn-text btn-sm" style="color:#52c41a" @click="toggleFeatureInPackage(f.id)" :disabled="!packageForm.featureIds.includes(f.id)">
                      {{ packageForm.featureIds.includes(f.id) ? '✓ 已选' : '必选' }}
                    </button>
                    <button v-else class="btn btn-text btn-sm" 
                            :style="{color: packageForm.featureIds.includes(f.id) ? '#1890ff' : '#8c8c8c'}"
                            @click="toggleFeatureInPackage(f.id)">
                      {{ packageForm.featureIds.includes(f.id) ? '✓ 取消' : '+ 选择' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 硬件产品选择区 -->
          <div style="margin-top:24px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <label style="font-weight:600;font-size:14px">🖥️ 硬件产品</label>
              <span style="font-size:12px;color:#8c8c8c">{{ packageForm.hardwareIds.length }}/{{ hardware.length }} 已选</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
              <div v-for="h in hardware" :key="h.id" 
                   @click="toggleHardwareInPackage(h.id)"
                   style="padding:14px 16px;border-radius:10px;border:2px solid transparent;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:12px"
                   :style="{
                     background: packageForm.hardwareIds.includes(h.id) ? '#fff7e6' : '#fafafa',
                     borderColor: packageForm.hardwareIds.includes(h.id) ? '#fa8c16' : '#e8e8e8'
                   }">
                <span style="font-size:24px">{{ h.icon }}</span>
                <div>
                  <div style="font-size:14px;font-weight:600" :style="{color: packageForm.hardwareIds.includes(h.id) ? '#fa8c16' : '#333'}">{{ h.name }}</div>
                  <div style="font-size:12px;color:#8c8c8c;margin-top:2px">{{ h.model }}</div>
                </div>
                <div v-if="packageForm.hardwareIds.includes(h.id)" style="margin-left:auto;color:#fa8c16;font-size:16px">✓</div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showPackageDialog=false">取消</button>
          <button class="btn btn-primary" @click="savePackage" :disabled="saving || !packageForm.name">{{ saving ? '保存中...' : '保存套餐' }}</button>
        </div>
      </div>
    </div>
  </div>
  `,
  setup() {
    const loading = ref(true);
    const saving = ref(false);
    const currentTab = ref('products'); // 默认打开产品目录（与合作伙伴端一致）
    
    // 超级管理员判断
    const isSuperAdmin = computed(() => store.user?.role === 'superadmin');
    
    // 弹窗层级式预览状态
    const showModulesModal = ref(false);
    const showFeaturesModal = ref(false);
    const previewCategory = ref(null);
    const previewModules = ref([]);
    const previewSelectedModule = ref(null);
    const previewFeatures = ref([]);
    
    // 套餐详情弹窗
    const showPackagePreviewModal = ref(false);
    const previewPackage = ref(null);
    
    // 详情弹窗（产品目录视图用）
    const detailFeature = ref(null);
    const detailPackage = ref(null);
    
    // 数据
    const categories = ref([]);
    const modules = ref([]);
    const features = ref([]);
    const hardware = ref([]);
    const packages = ref([]);
    const stats = ref({});
    
    // 过滤
    const filterCategoryId = ref('');
    const filterModuleId = ref('');
    
    // 大类
    const showCategoryDialog = ref(false);
    const editingCategory = ref(null);
    const categoryForm = reactive({ name: '', icon: '📦', type: 'software', desc: '' });
    
    // 模块
    const showModuleDialog = ref(false);
    const editingModule = ref(null);
    const moduleForm = reactive({ categoryId: '', name: '', icon: '📋', sort: 1, desc: '' });
    
    // 功能
    const showFeatureDialog = ref(false);
    const editingFeature = ref(null);
    const featureForm = reactive({ 
      moduleId: '', 
      name: '', 
      productCode: '', 
      priceType: 'tiered', 
      priceFixed: 0, 
      unit: '端点', 
      desc: '', 
      required: false, 
      tiers: [],
      priceRatioPrimary: 100,  // 一级渠道商价格比例（默认100%）
      priceRatioSecondary: 110  // 二级渠道商价格比例（默认110%）
    });
    
    // 硬件
    const showHardwareDialog = ref(false);
    const editingHardware = ref(null);
    const hardwareForm = reactive({ name: '', model: '', icon: '🖥️', priceFixed: 0, unit: '台', specs: '', desc: '' });
    
    // 套餐
    const showPackageDialog = ref(false);
    const editingPackage = ref(null);
    const packageForm = reactive({ name: '', icon: '📦', desc: '', moduleIds: [], featureIds: [], hardwareIds: [], status: 'active' });
    
    // 计算属性
    const filteredModules = computed(() => {
      if (!filterCategoryId.value) return modules.value;
      return modules.value.filter(m => m.categoryId === filterCategoryId.value);
    });
    
    const filteredFeatures = computed(() => {
      if (!filterModuleId.value) return features.value;
      return features.value.filter(f => f.moduleId === filterModuleId.value);
    });
    
    // 加载数据
    async function loadAll() {
      loading.value = true;
      try {
        const [catRes, modRes, featRes, hwRes, pkgRes, statsRes] = await Promise.all([
          fetch(`${window.API_BASE}/categories`),
          fetch(`${window.API_BASE}/modules`),
          fetch(`${window.API_BASE}/features`),
          fetch(`${window.API_BASE}/hardware`),
          fetch(`${window.API_BASE}/packages`),
          fetch(`${window.API_BASE}/products/stats`)
        ]);
        const [catData, modData, featData, hwData, pkgData, statsData] = await Promise.all([
          catRes.json(), modRes.json(), featRes.json(), hwRes.json(), pkgRes.json(), statsRes.json()
        ]);
        categories.value = catData.data || [];
        modules.value = modData.data || [];
        features.value = featData.data || [];
        hardware.value = hwData.data || [];
        packages.value = pkgData.data || [];
        stats.value = statsData.data || {};
      } catch (err) {
        console.error('加载失败:', err);
      }
      loading.value = false;
    }
    
    // 辅助方法
    function getCategoryName(catId) { return categories.value.find(c => c.id === catId)?.name || ''; }
    function getCategoryModules(catId) { return modules.value.filter(m => m.categoryId === catId); }
    function getModuleCount(catId) { return modules.value.filter(m => m.categoryId === catId).length; }
    function getModuleName(modId) { return modules.value.find(m => m.id === modId)?.name || ''; }
    function getFeatureCount(catId) {
      // 如果是模块ID，返回该模块的功能数量
      if (typeof catId === 'string' && catId.startsWith('M')) {
        return features.value.filter(f => f.moduleId === catId).length;
      }
      // 如果是大类ID，返回该大类下所有模块的功能数量
      const modIds = modules.value.filter(m => m.categoryId === catId).map(m => m.id);
      return features.value.filter(f => modIds.includes(f.moduleId)).length;
    }
    function getModuleFeatureCount(modId) { return features.value.filter(f => f.moduleId === modId).length; }
    
    // 套餐预览辅助方法
    function openPackagePreview(pkg) {
      previewPackage.value = pkg;
      showPackagePreviewModal.value = true;
    }
    function getPackageModules(pkg) {
      if (!pkg?.moduleIds) return [];
      return modules.value.filter(m => pkg.moduleIds.includes(m.id));
    }
    function getPackageFeatures(pkg) {
      if (!pkg?.featureIds) return [];
      return features.value.filter(f => pkg.featureIds.includes(f.id));
    }
    function getPackageHardware(pkg) {
      if (!pkg?.hardwareIds) return [];
      return hardware.value.filter(h => pkg.hardwareIds.includes(h.id));
    }
    
    // 套餐编辑辅助方法
    function toggleModuleInPackage(modId) {
      const idx = packageForm.moduleIds.indexOf(modId);
      if (idx >= 0) {
        packageForm.moduleIds.splice(idx, 1);
      } else {
        packageForm.moduleIds.push(modId);
      }
    }
    function toggleFeatureInPackage(featId) {
      const idx = packageForm.featureIds.indexOf(featId);
      if (idx >= 0) {
        packageForm.featureIds.splice(idx, 1);
      } else {
        packageForm.featureIds.push(featId);
      }
    }
    function toggleHardwareInPackage(hwId) {
      const idx = packageForm.hardwareIds.indexOf(hwId);
      if (idx >= 0) {
        packageForm.hardwareIds.splice(idx, 1);
      } else {
        packageForm.hardwareIds.push(hwId);
      }
    }
    
    function selectCategory(cat) {
      filterCategoryId.value = cat.id;
      currentTab.value = 'manage-modules';
    }
    
    // 弹窗层级式预览函数
    function openCategoryPreview(cat) {
      previewCategory.value = cat;
      previewModules.value = modules.value.filter(m => m.categoryId === cat.id);
      previewSelectedModule.value = null;
      showModulesModal.value = true;
    }
    
    function openModulePreview(mod) {
      previewSelectedModule.value = mod;
      previewFeatures.value = features.value.filter(f => f.moduleId === mod.id);
      showModulesModal.value = false; // 关闭模块弹窗
      showFeaturesModal.value = true; // 打开功能弹窗
    }
    
    function closeFeaturesModal() {
      showFeaturesModal.value = false;
      previewSelectedModule.value = null;
    }
    
    // 点击模块卡片，跳转到功能模块标签页并过滤
    function goToFeatureTab(mod) {
      filterModuleId.value = mod.id;
      currentTab.value = 'manage-features';
    }
    
    // 硬件详情查看（产品目录视图用）
    function viewHardwareDetail(hw) {
      detailFeature.value = { ...hw, name: hw.name, desc: hw.desc, productCode: hw.model, priceType: 'fixed', priceFixed: hw.priceFixed, unit: hw.unit };
    }
    
    // 大类操作
    function openCategoryDialog(cat = null) {
      editingCategory.value = cat;
      if (cat) {
        Object.assign(categoryForm, { name: cat.name, icon: cat.icon, type: cat.type, desc: cat.desc || '' });
      } else {
        Object.assign(categoryForm, { name: '', icon: '📦', type: 'software', desc: '' });
      }
      showCategoryDialog.value = true;
    }
    
    async function saveCategory() {
      if (!categoryForm.name) { alert('请填写名称'); return; }
      saving.value = true;
      try {
        const url = editingCategory.value ? `${window.API_BASE}/categories/${editingCategory.value.id}` : `${window.API_BASE}/categories`;
        const res = await fetch(url, {
          method: editingCategory.value ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...categoryForm })
        });
        const data = await res.json();
        if (data.success) { showCategoryDialog.value = false; loadAll(); }
        else alert(data.error || '保存失败');
      } catch (err) { alert(err.message); }
      saving.value = false;
    }
    
    async function deleteCategory(cat) {
      if (!confirm(`确定删除「${cat.name}」吗？\n注意：删除大类会同时删除其下所有模块和功能！`)) return;
      try {
        const res = await fetch(`${window.API_BASE}/categories/${cat.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) loadAll();
        else alert(data.error || '删除失败');
      } catch (err) { alert(err.message); }
    }
    
    // 模块操作
    function openModuleDialog(mod = null) {
      editingModule.value = mod;
      if (mod) {
        Object.assign(moduleForm, { categoryId: mod.categoryId, name: mod.name, icon: mod.icon, sort: mod.sort, desc: mod.desc || '' });
      } else {
        Object.assign(moduleForm, { categoryId: filterCategoryId.value || '', name: '', icon: '📋', sort: modules.value.length + 1, desc: '' });
      }
      showModuleDialog.value = true;
    }
    
    async function saveModule() {
      if (!moduleForm.categoryId || !moduleForm.name) { alert('请选择大类并填写名称'); return; }
      saving.value = true;
      try {
        const url = editingModule.value ? `${window.API_BASE}/modules/${editingModule.value.id}` : `${window.API_BASE}/modules`;
        const res = await fetch(url, {
          method: editingModule.value ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...moduleForm })
        });
        const data = await res.json();
        if (data.success) { showModuleDialog.value = false; loadAll(); }
        else alert(data.error || '保存失败');
      } catch (err) { alert(err.message); }
      saving.value = false;
    }
    
    async function deleteModule(mod) {
      if (!confirm(`确定删除「${mod.name}」吗？\n注意：删除模块会同时删除其下所有功能！`)) return;
      try {
        const res = await fetch(`${window.API_BASE}/modules/${mod.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) loadAll();
        else alert(data.error || '删除失败');
      } catch (err) { alert(err.message); }
    }
    
    // 功能操作
    function openFeatureDialog(feat = null) {
      editingFeature.value = feat;
      if (feat) {
        Object.assign(featureForm, { 
          moduleId: feat.moduleId, 
          name: feat.name, 
          productCode: feat.productCode || '', 
          priceType: feat.priceType, 
          priceFixed: feat.priceFixed, 
          unit: feat.unit, 
          desc: feat.desc || '', 
          required: feat.required, 
          tiers: feat.tiers ? [...feat.tiers] : [],
          priceRatioPrimary: feat.priceRatioPrimary || 100,
          priceRatioSecondary: feat.priceRatioSecondary || 110
        });
      } else {
        Object.assign(featureForm, { 
          moduleId: filterModuleId.value || '', 
          name: '', 
          productCode: '', 
          priceType: 'tiered', 
          priceFixed: 0, 
          unit: '端点', 
          desc: '', 
          required: false, 
          tiers: [],
          priceRatioPrimary: 100,
          priceRatioSecondary: 110
        });
      }
      showFeatureDialog.value = true;
    }
    
    function addFeatureTier() {
      const last = featureForm.tiers[featureForm.tiers.length - 1];
      featureForm.tiers.push({ min: last ? last.max + 1 : 1, max: last ? last.max + 100 : 100, price: 0 });
    }
    
    async function saveFeature() {
      if (!featureForm.moduleId || !featureForm.name) { alert('请选择模块并填写名称'); return; }
      saving.value = true;
      try {
        const url = editingFeature.value ? `${window.API_BASE}/features/${editingFeature.value.id}` : `${window.API_BASE}/features`;
        const res = await fetch(url, {
          method: editingFeature.value ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...featureForm })
        });
        const data = await res.json();
        if (data.success) { showFeatureDialog.value = false; loadAll(); }
        else alert(data.error || '保存失败');
      } catch (err) { alert(err.message); }
      saving.value = false;
    }
    
    async function toggleFeaturePublish(feat) {
      try {
        const res = await fetch(`${window.API_BASE}/features/${feat.id}/publish`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ published: !feat.published })
        });
        const data = await res.json();
        if (data.success) loadAll();
      } catch (err) { alert(err.message); }
    }
    
    async function deleteFeature(feat) {
      if (!confirm(`确定删除「${feat.name}」吗？`)) return;
      try {
        const res = await fetch(`${window.API_BASE}/features/${feat.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) loadAll();
        else alert(data.error || '删除失败');
      } catch (err) { alert(err.message); }
    }
    
    // 硬件操作
    function openHardwareDialog(hw = null) {
      editingHardware.value = hw;
      if (hw) {
        Object.assign(hardwareForm, { name: hw.name, model: hw.model || '', icon: hw.icon || '🖥️', priceFixed: hw.priceFixed, unit: hw.unit, specs: hw.specs || '', desc: hw.desc || '' });
      } else {
        Object.assign(hardwareForm, { name: '', model: '', icon: '🖥️', priceFixed: 0, unit: '台', specs: '', desc: '' });
      }
      showHardwareDialog.value = true;
    }
    
    async function saveHardware() {
      if (!hardwareForm.name) { alert('请填写名称'); return; }
      saving.value = true;
      try {
        const url = editingHardware.value ? `${window.API_BASE}/hardware/${editingHardware.value.id}` : `${window.API_BASE}/hardware`;
        const res = await fetch(url, {
          method: editingHardware.value ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...hardwareForm })
        });
        const data = await res.json();
        if (data.success) { showHardwareDialog.value = false; loadAll(); }
        else alert(data.error || '保存失败');
      } catch (err) { alert(err.message); }
      saving.value = false;
    }
    
    async function toggleHardwarePublish(hw) {
      try {
        const res = await fetch(`${window.API_BASE}/hardware/${hw.id}/publish`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ published: !hw.published })
        });
        const data = await res.json();
        if (data.success) loadAll();
      } catch (err) { alert(err.message); }
    }
    
    async function deleteHardware(hw) {
      if (!confirm(`确定删除「${hw.name}」吗？`)) return;
      try {
        const res = await fetch(`${window.API_BASE}/hardware/${hw.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) loadAll();
        else alert(data.error || '删除失败');
      } catch (err) { alert(err.message); }
    }
    
    // 套餐操作
    function openPackageDialog(pkg = null) {
      editingPackage.value = pkg;
      if (pkg) {
        Object.assign(packageForm, { name: pkg.name, icon: pkg.icon || '📦', desc: pkg.desc || '', moduleIds: [...(pkg.moduleIds||[])], featureIds: [...(pkg.featureIds||[])], hardwareIds: [...(pkg.hardwareIds||[])], status: pkg.status || 'active' });
      } else {
        Object.assign(packageForm, { name: '', icon: '📦', desc: '', moduleIds: [], featureIds: [], hardwareIds: [], status: 'active' });
      }
      showPackageDialog.value = true;
    }
    
    async function savePackage() {
      if (!packageForm.name) { alert('请填写名称'); return; }
      saving.value = true;
      try {
        const url = editingPackage.value ? `${window.API_BASE}/packages/${editingPackage.value.id}` : `${window.API_BASE}/packages`;
        const res = await fetch(url, {
          method: editingPackage.value ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...packageForm })
        });
        const data = await res.json();
        if (data.success) { showPackageDialog.value = false; loadAll(); }
        else alert(data.error || '保存失败');
      } catch (err) { alert(err.message); }
      saving.value = false;
    }
    
    async function togglePackagePublish(pkg) {
      try {
        const res = await fetch(`${window.API_BASE}/packages/${pkg.id}/publish`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ published: !pkg.published })
        });
        const data = await res.json();
        if (data.success) loadAll();
      } catch (err) { alert(err.message); }
    }
    
    async function deletePackage(pkg) {
      if (!confirm(`确定删除「${pkg.name}」吗？`)) return;
      try {
        const res = await fetch(`${window.API_BASE}/packages/${pkg.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) loadAll();
        else alert(data.error || '删除失败');
      } catch (err) { alert(err.message); }
    }
    
    onMounted(loadAll);
    
    return {
      loading, saving, currentTab, isSuperAdmin, categories, modules, features, hardware, packages, stats,
      filterCategoryId, filterModuleId, filteredModules, filteredFeatures,
      // 弹窗层级式预览
      showModulesModal, showFeaturesModal, previewCategory, previewModules, previewSelectedModule, previewFeatures,
      openCategoryPreview, openModulePreview, closeFeaturesModal, goToFeatureTab,
      // 套餐预览
      showPackagePreviewModal, previewPackage, openPackagePreview,
      getPackageModules, getPackageFeatures, getPackageHardware,
      // 详情弹窗
      detailFeature, detailPackage, viewHardwareDetail,
      // 角色判断
      isSuperAdmin,
      // 编辑弹窗
      showCategoryDialog, editingCategory, categoryForm,
      showModuleDialog, editingModule, moduleForm,
      showFeatureDialog, editingFeature, featureForm,
      showHardwareDialog, editingHardware, hardwareForm,
      showPackageDialog, editingPackage, packageForm,
      getCategoryName, getCategoryModules, getModuleCount, getFeatureCount, getModuleFeatureCount, getModuleName, selectCategory,
      toggleModuleInPackage, toggleFeatureInPackage, toggleHardwareInPackage,
      openCategoryDialog, saveCategory, deleteCategory,
      openModuleDialog, saveModule, deleteModule,
      openFeatureDialog, addFeatureTier, saveFeature, toggleFeaturePublish, deleteFeature,
      openHardwareDialog, saveHardware, toggleHardwarePublish, deleteHardware,
      openPackageDialog, savePackage, togglePackagePublish, deletePackage
    };
  }
};

// 兼容旧名称
const Products = ProductCatalog;


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
      <button class="btn btn-default" @click="$router.push('/partners/import')" v-if="isAdmin">📥 批量导入</button>
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
            <tr v-for="p in paginatedData" :key="p.id" style="cursor:pointer" @click="openDetail(p)">
              <td>
                <div style="font-weight:600">{{ p.name }}</div>
                <div v-if="p.isTechService" style="margin-top:4px">
                  <span class="tag tag-blue" style="font-size:10px;padding:0 5px">🔧 技术服务商</span>
                </div>
              </td>
              <td>
                <div style="margin-bottom:4px">
                  <span class="tag" :class="levelClass(p.level)">
                    {{ levelLabel(p.level) }}
                  </span>
                </div>
                <!-- 渠道商等级标签 -->
                <div v-html="getPartnerLevelBadge(p)"></div>
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
                <span class="tag" :class="statusClass(p.status)">
                  {{ statusLabel(p.status) }}
                </span>
              </td>
              <td @click.stop>
                <button class="btn btn-text btn-sm" @click="openEdit(p)" v-if="p.status!=='pending'">编辑</button>
                <button class="btn btn-text btn-sm" @click="openLevelManage(p)" style="color:#722ed1">等级</button>
                <button class="btn btn-primary btn-sm" @click="resubmitPartner(p)" v-if="p.status==='rejected'" style="margin-left:6px">↻ 重新提交</button>
              </td>
            </tr>
            <tr v-if="!paginatedData.length">
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
                <option value="lep">💎 LEP</option>
                <option value="diamond">🔷 钻石</option>
                <option value="gold">🥇 金牌</option>
                <option value="silver">🥈 银牌</option>
                <option value="bronze">🥉 铜牌</option>
                <option value="industry">🏭 行业总代</option>
              </select>
            </div>
            <div class="form-item" style="display:flex;align-items:center;gap:8px;padding-top:28px">
              <input type="checkbox" id="techService" v-model="form.isTechService" style="width:16px;height:16px"/>
              <label for="techService" style="font-size:13px;cursor:pointer">🔧 技术服务商</label>
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
            <span v-if="detail.isTechService" class="tag tag-blue">🔧 技术服务商</span>
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
                      <!-- 审批状态标签 -->
                      <div style="margin-top:4px">
                        <span v-if="s.status==='pending'" class="tag tag-orange" style="font-size:10px">待审批</span>
                        <span v-else-if="s.status==='rejected'" class="tag tag-red" style="font-size:10px">已拒绝</span>
                        <span v-else-if="s.createdByRole && s.createdByRole!=='superadmin' && s.approvedBy" class="tag tag-green" style="font-size:10px">已审批</span>
                      </div>
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
                    <button class="btn btn-text btn-sm" @click="resetStaffPassword(s)" style="color:#52c41a">🔑</button>
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
            <div class="form-item"><label class="form-label required">登录账号</label><input class="form-control" v-model="staffForm.username" placeholder="如：liujg" :disabled="staffForm.editing"/></div>
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
          <div v-if="!staffForm.editing" style="margin-top:12px;padding:10px 12px;background:#f5f5f7;border-radius:6px;font-size:12px;color:#666">
            <span style="color:#007AFF">ℹ️</span> 初始密码为 <code style="background:#fff;padding:2px 6px;border-radius:3px;font-family:monospace">123456</code>，员工首次登录后请提醒修改
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="closeStaffForm">取消</button>
          <button class="btn btn-primary" @click="saveStaff" :disabled="!canSaveStaff">保存</button>
        </div>
      </div>
    </div>

    <!-- 渠道商等级管理弹窗 -->
    <div class="modal-overlay" v-if="levelForm.show" @click.self="closeLevelManage">
      <div class="modal" style="width:500px">
        <div class="modal-header">
          <div class="modal-title">🏷️ 渠道商等级管理</div>
          <span class="modal-close" @click="closeLevelManage">✕</span>
        </div>
        <div class="modal-body">
          <div style="margin-bottom:16px;padding:12px;background:#f5f5f7;border-radius:8px">
            <div style="font-size:13px;color:#666">当前渠道商</div>
            <div style="font-size:15px;font-weight:700;margin-top:4px">{{ levelForm.partnerName }}</div>
          </div>

          <div class="form-item">
            <label class="form-label required">渠道商等级</label>
            <select class="form-control" v-model="levelForm.partnerLevel">
              <option value="none">无等级</option>
              <option value="primary">一级渠道商</option>
              <option value="secondary">二级渠道商</option>
            </select>
          </div>

          <div v-if="levelForm.partnerLevel === 'secondary'" class="form-item" style="margin-top:12px">
            <label class="form-label required">上级渠道商（可多选）</label>
            <select class="form-control" v-model="levelForm.parentPartnerIds" multiple style="height:120px">
              <option v-for="p in primaryPartners" :key="p.id" :value="p.id">{{ p.name }} ({{ p.region }})</option>
            </select>
            <div style="margin-top:6px;font-size:12px;color:#888">
              ℹ️ 二级渠道商可绑定多个上级一级渠道商（按住 Ctrl 键多选）
            </div>
          </div>

          <div v-if="levelForm.partnerLevel === 'primary'" style="margin-top:12px;padding:10px;background:#e6f7ff;border-radius:6px;font-size:12px;color:#0050b3">
            💡 一级渠道商可以发展和管理二级渠道商，享受最优价格
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="closeLevelManage">取消</button>
          <button class="btn btn-primary" @click="savePartnerLevel" :disabled="!canSaveLevel">保存</button>
        </div>
      </div>
    </div>
  </div>`,
  setup() {
    const kw = ref('');
    const levelFilter = ref('');
    const regionFilter = ref('');
    const regions = ['安徽区','江苏区','上海区（非金）','浙赣区','深圳区','广州区','湖南区','西区','北区（政府企业）','河南区','东北区','山东区','晋冀区'];
    const showForm = ref(false);
    const editing = ref(false);
    const detail = ref(null);
    const partners = ref([]); // 从后端加载的渠道商列表
    const loading = ref(false);
    const currentPage = ref(1);
    const pageSize = ref(10);
    
    // 区域管理员的锁定区域（superadmin 无限制）
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    const form = reactive({ id:'', name:'', level:'gold', region:'安徽区', contact:'', phone:'', email:'', status:'active', isTechService:false });

    // 等级管理表单
    const levelForm = reactive({
      show: false,
      partnerId: '',
      partnerName: '',
      partnerLevel: 'none',
      parentPartnerIds: []  // 支持多个上级渠道商
    });

    // 一级渠道商列表（用于绑定上级）
    const primaryPartners = computed(() => {
      return partners.value.filter(p => p.partnerLevel === 'primary' && p.id !== levelForm.partnerId);
    });

    // 等级管理表单验证
    const canSaveLevel = computed(() => {
      if (levelForm.partnerLevel === 'secondary') {
        // 确保是数组且有内容
        if (!Array.isArray(levelForm.parentPartnerIds)) {
          console.warn('[等级管理] parentPartnerIds 不是数组:', typeof levelForm.parentPartnerIds, levelForm.parentPartnerIds);
          return false;
        }
        // 过滤掉空值
        const validIds = levelForm.parentPartnerIds.filter(id => id && String(id).trim() !== '');
        console.log('[等级管理] 验证 - 有效上级渠道商数量:', validIds.length);
        return validIds.length > 0;
      }
      return true;
    });
    
    // 判断当前用户是否为超级管理员
    const isSuperAdmin = computed(() => store.user?.role === 'superadmin');
    const isAdmin = computed(() => store.user?.role === 'admin' || store.user?.role === 'superadmin');
    const userId = computed(() => store.user?.id || '');
    const userRole = computed(() => store.user?.role || '');
    
    // 分页相关
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
        pages.push(1);
        if (cur > 3) pages.push('...');
        for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
        if (cur < total - 2) pages.push('...');
        pages.push(total);
      }
      return pages;
    });
    function prevPage() { if (currentPage.value > 1) currentPage.value--; }
    function nextPage() { if (currentPage.value < totalPages.value) currentPage.value++; }
    function goToPage(p) { if (p !== '...' && p >= 1 && p <= totalPages.value) currentPage.value = p; }
    function resetPage() { currentPage.value = 1; }
    
    // 从后端加载渠道商列表
    async function loadPartners() {
      loading.value = true;
      try {
        const params = new URLSearchParams();
        params.append('userId', userId.value);
        params.append('userRole', userRole.value);
        if (adminRegion.value) {
          params.append('region', adminRegion.value);
        }
        
        const res = await apiRequest('GET', `/partners?${params.toString()}`);
        if (res.success) {
          partners.value = res.data || [];
        }
      } catch (err) {
        console.error('加载渠道商失败:', err);
      } finally {
        loading.value = false;
      }
    }
    
    // 页面加载时获取数据
    onMounted(() => {
      loadPartners();
    });
    
    const filtered = computed(() => {
      resetPage();
      return partners.value.filter(p => {
        const mK = !kw.value || p.name.includes(kw.value) || (p.contact && p.contact.includes(kw.value)) || (p.phone && p.phone.includes(kw.value));
        const mL = !levelFilter.value || p.level === levelFilter.value;
        // 区域管理员强制只看本区域；超级管理员按筛选器
        const effectiveRegion = adminRegion.value || regionFilter.value;
        const mR = !effectiveRegion || p.region === effectiveRegion;
        return mK && mL && mR;
      });
    });
    
    const canSave = computed(() => form.name && form.contact && form.phone && form.region);
    
    function levelClass(lvl) {
      return { lep:'tag-purple', diamond:'tag-blue', gold:'tag-orange', silver:'tag-gray', bronze:'tag-brown', industry:'tag-green' }[lvl] || 'tag-gray';
    }
    function levelLabel(lvl) {
      return { lep:'💎 LEP', diamond:'🔷 钻石', gold:'🥇 金牌', silver:'🥈 银牌', bronze:'🥉 铜牌', industry:'🏭 行业总代' }[lvl] || lvl;
    }
    
    // 渠道商等级标签显示（使用PartnerLevelModule）
    function getPartnerLevelBadge(partner) {
      if (typeof window.PartnerLevelModule !== 'undefined') {
        // 提取等级字段，而不是传递整个对象
        const level = partner?.partnerLevel || 'none';
        return window.PartnerLevelModule.getPartnerLevelBadge(level);
      }
      // 降级处理：模块未加载时返回空
      return '';
    }
    
    function statusClass(st) {
      return { active:'tag-green', pending:'tag-orange', rejected:'tag-red', inactive:'tag-gray' }[st] || 'tag-gray';
    }
    function statusLabel(st) {
      return { active:'正常', pending:'待审批', rejected:'已驳回', inactive:'停用' }[st] || st;
    }
    async function resubmitPartner(p) {
      try {
        const res = await apiRequest('PUT', `/partners/${p.id}/status`, { status: 'pending' });
        if (res.success) {
          p.status = 'pending';
          store.notifications.unshift({ id:Date.now(), title:'渠道商重新提交', desc:`${p.name} 已重新提交审核`, time:'刚刚', unread:true });
        } else {
          alert('重新提交失败：' + (res.error || '未知错误'));
        }
      } catch (err) {
        alert('重新提交失败：' + err.message);
      }
    }
    
    function openNew() {
      editing.value = false;
      form.id = ''; form.name = ''; form.level = 'gold'; form.region = adminRegion.value || '安徽区'; 
      form.contact = ''; form.phone = ''; form.email = ''; form.status = 'active'; form.isTechService = false;
      showForm.value = true;
    }
    function openEdit(p) {
      editing.value = true;
      Object.assign(form, p);
      showForm.value = true;
    }
    function closeForm() { showForm.value = false; }
    
    async function save() {
      if (editing.value) {
        // 编辑模式：调用后端API保存
        try {
          const res = await apiRequest('PUT', `/partners/${form.id}`, {
            name: form.name,
            level: form.level,
            region: form.region,
            contact: form.contact,
            phone: form.phone,
            email: form.email,
            status: form.status,
            isTechService: form.isTechService
          });
          if (res.success) {
            // 更新本地数据
            const idx = partners.value.findIndex(p => p.id === form.id);
            if (idx > -1) {
              partners.value[idx] = { ...partners.value[idx], ...res.data };
            }
            alert('渠道商信息更新成功');
          } else {
            alert('更新失败：' + (res.error || '未知错误'));
            return;
          }
        } catch (err) {
          alert('更新失败：' + err.message);
          return;
        }
      } else {
        // 新增模式：调用后端API
        try {
          const newStatus = isSuperAdmin.value ? 'active' : 'pending';
          const res = await apiRequest('POST', '/partners', {
            name: form.name,
            level: form.level,
            region: form.region,
            bigRegion: store.user?.bigRegion || '',
            contact: form.contact,
            phone: form.phone,
            email: form.email,
            isTechService: form.isTechService,
            createdBy: userId.value,
            createdByRole: userRole.value
          });
          
          if (res.success) {
            // 添加到本地列表
            partners.value.unshift(res.data);
            
            // 非超级管理员提交后提示等待审核
            if (!isSuperAdmin.value) {
              store.notifications.unshift({
                id: Date.now(),
                title: '渠道商提交成功',
                desc: `「${form.name}」已提交审核，等待超级管理员审批`,
                time: '刚刚',
                unread: true
              });
              alert('渠道商创建成功，等待超级管理员审批');
            } else {
              alert('渠道商创建成功');
            }
          } else {
            alert('创建失败：' + (res.error || '未知错误'));
            return;
          }
        } catch (err) {
          alert('创建失败：' + err.message);
          return;
        }
      }
      closeForm();
    }
    async function openDetail(p) { 
      // 从后端获取最新的渠道商详情（包括 staff）
      try {
        const res = await apiRequest('GET', `/partners/${p.id}`);
        if (res.success && res.data) {
          detail.value = res.data;
        } else {
          detail.value = p;
        }
      } catch (err) {
        console.error('加载渠道商详情失败:', err);
        detail.value = p;
      }
    }
    
    // 员工管理
    const staffForm = reactive({ show:false, editing:false, id:'', username:'', name:'', role:'销售代表', phone:'', email:'', status:'active' });
    const canSaveStaff = computed(() => staffForm.username && staffForm.name && staffForm.phone);
    function openStaffForm(s) {
      staffForm.show = true;
      if (s) {
        staffForm.editing = true;
        Object.assign(staffForm, s);
      } else {
        staffForm.editing = false;
        staffForm.id = ''; staffForm.username = ''; staffForm.name = ''; staffForm.role = '销售代表'; 
        staffForm.phone = ''; staffForm.email = ''; staffForm.status = 'active';
      }
    }
    function closeStaffForm() { staffForm.show = false; }
    async function saveStaff() {
      if (!detail.value.staff) detail.value.staff = [];
      if (staffForm.editing) {
        // 编辑模式：调用后端API保存
        try {
          const res = await apiRequest('PUT', `/users/${staffForm.id}`, {
            name: staffForm.name,
            phone: staffForm.phone,
            email: staffForm.email,
            status: staffForm.status,
            staffRole: staffForm.role
          });
          if (res.success) {
            // 更新本地数据
            const idx = detail.value.staff.findIndex(s => s.id === staffForm.id);
            if (idx > -1) Object.assign(detail.value.staff[idx], res.data);
            alert('员工信息更新成功');
          } else {
            alert('更新失败：' + (res.error || '未知错误'));
            return;
          }
        } catch (err) {
          alert('更新失败：' + err.message);
          return;
        }
      } else {
        // 区域管理员新增员工需要审核，超级管理员直接生效
        const newStatus = isSuperAdmin.value ? 'active' : 'pending';
        
        // 先在后端创建用户账号
        try {
          const res = await apiRequest('POST', `/partners/${detail.value.id}/staff`, {
            username: staffForm.username,
            name: staffForm.name,
            role: 'staff',
            password: '123456',
            region: detail.value.region,
            status: newStatus,
            staffRole: staffForm.role,
            phone: staffForm.phone,
            email: staffForm.email
          });
          if (!res.success) {
            alert('创建账号失败：' + (res.message || res.error || '未知错误'));
            return;
          }
        } catch (err) {
          console.log('创建后端用户账号失败（可能已存在）:', err);
          alert('创建账号失败：' + (err.error || err.message));
          return;
        }
        
        // 重新加载渠道商详情以获取最新的 staff 列表
        try {
          const partnerRes = await apiRequest('GET', `/partners/${detail.value.id}`);
          if (partnerRes.success && partnerRes.data) {
            // 更新当前 detail 的 staff
            detail.value.staff = partnerRes.data.staff || [];
          }
        } catch (err) {
          console.error('重新加载渠道商详情失败:', err);
        }
        
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
    async function toggleStaffStatus(s) {
      const newStatus = s.status === 'active' ? 'inactive' : 'active';
      
      // 调用后端API切换状态
      try {
        // ✅ 使用 s.userId 而不是 s.id，因为后端API期望的是用户ID
        const res = await apiRequest('PUT', `/users/${s.userId}/status`, { status: newStatus });
        if (res.success) {
          s.status = newStatus;
          store.notifications.unshift({
            id: Date.now(),
            title: newStatus === 'active' ? '员工账号已启用' : '员工账号已禁用',
            desc: `「${s.name}」(${s.username}) 的登录账号已${newStatus === 'active' ? '启用' : '禁用'}`,
            time: '刚刚',
            unread: true
          });
        } else {
          alert('切换状态失败：' + (res.error || '未知错误'));
        }
      } catch (err) {
        alert('切换状态失败：' + err.message);
      }
    }
    // 重置员工账号密码
    async function resetStaffPassword(s) {
      if (!confirm(`确认重置「${s.name}」(${s.username}) 的密码吗？\n\n重置后密码将恢复为：123456`)) return;
      try {
        // ✅ 使用 s.userId 而不是 s.id，因为后端API期望的是用户ID
        const res = await apiRequest('PUT', `/users/${s.userId}/password`, { password: '123456' });
        if (res.success) {
          alert('密码已重置为：123456');
        } else {
          alert('操作失败：' + (res.error || '未知错误'));
        }
      } catch (err) {
        alert('操作失败：' + err.message);
      }
    }
    async function deleteStaff(s) {
      if (!confirm(`确定删除员工「${s.name}」吗？`)) return;
      try {
        // ✅ 使用 s.userId 而不是 s.id，因为后端API期望的是用户ID
        const res = await apiRequest('DELETE', `/users/${s.userId}`);
        if (res.success) {
          detail.value.staff = detail.value.staff.filter(x => x.id !== s.id);
          store.notifications.unshift({
            id: Date.now(),
            title: '员工已删除',
            desc: `「${s.name}」(${s.username}) 已从渠道商中移除`,
            time: '刚刚',
            unread: true
          });
        } else {
          alert('删除失败：' + (res.error || '未知错误'));
        }
      } catch (err) {
        alert('删除失败：' + err.message);
      }
    }

    // 渠道商等级管理
    function openLevelManage(p) {
      console.log('[等级管理] 打开渠道商:', p.name, '当前等级:', p.partnerLevel);
      levelForm.partnerId = p.id;
      levelForm.partnerName = p.name;
      levelForm.partnerLevel = p.partnerLevel || 'none';
      // 支持多个上级渠道商：优先使用 parentPartnerIds，否则用 parentPartnerId 创建数组
      // 确保始终初始化为数组
      if (p.parentPartnerIds && Array.isArray(p.parentPartnerIds) && p.parentPartnerIds.length > 0) {
        levelForm.parentPartnerIds = [...p.parentPartnerIds];
      } else if (p.parentPartnerId) {
        levelForm.parentPartnerIds = [p.parentPartnerId];
      } else {
        levelForm.parentPartnerIds = [];
      }
      console.log('[等级管理] 初始化上级渠道商列表:', levelForm.parentPartnerIds);
      console.log('[等级管理] 可选一级渠道商:', primaryPartners.value.map(p => ({ id: p.id, name: p.name })));
      levelForm.show = true;
    }

    function closeLevelManage() {
      levelForm.show = false;
    }

    async function savePartnerLevel() {
      try {
        // 数据验证：确保 parentPartnerIds 是数组
        let parentIdsToSend = [];
        if (levelForm.partnerLevel === 'secondary') {
          // 确保是数组
          if (Array.isArray(levelForm.parentPartnerIds)) {
            parentIdsToSend = levelForm.parentPartnerIds.filter(id => id && id.trim() !== '');
          } else if (typeof levelForm.parentPartnerIds === 'string') {
            // 如果是字符串（单选），转换为数组
            parentIdsToSend = levelForm.parentPartnerIds.trim() !== '' ? [levelForm.parentPartnerIds] : [];
          }
          
          console.log('[等级管理] 二级渠道商上级渠道商ID:', parentIdsToSend);
          
          if (parentIdsToSend.length === 0) {
            alert('二级渠道商必须选择至少一个一级渠道商');
            return;
          }
        }
        
        const requestBody = {
          partnerLevel: levelForm.partnerLevel,
          parentPartnerIds: parentIdsToSend,
          operatedBy: store.user.id,
          operatedByRole: store.user.role
        };
        
        console.log('[等级管理] 发送请求:', requestBody);
        
        const res = await apiRequest('PUT', `/partners/${levelForm.partnerId}/level`, requestBody);

        if (res.success) {
          // 更新本地数据
          const idx = partners.value.findIndex(p => p.id === levelForm.partnerId);
          if (idx > -1) {
            partners.value[idx] = { ...partners.value[idx], ...res.data };
          }
          closeLevelManage();
          alert('渠道商等级设置成功');
        } else {
          console.error('[等级管理] 请求失败:', res.error);
          alert('设置失败：' + (res.error || '未知错误'));
        }
      } catch (err) {
        console.error('[等级管理] 异常:', err);
        alert('设置失败：' + err.message);
      }
    }

    return { store, kw, levelFilter, regionFilter, regions, filtered, paginatedData, showForm, editing, form, canSave, detail, staffForm, canSaveStaff,
      adminRegion, isAdmin, isSuperAdmin, partners, loading, openNew, openEdit, closeForm, save, openDetail, openStaffForm, closeStaffForm, saveStaff, editStaff, toggleStaffStatus, resetStaffPassword, deleteStaff,
      levelClass, levelLabel, getPartnerLevelBadge, statusClass, statusLabel, fmt, loadPartners, resubmitPartner,
      levelForm, primaryPartners, canSaveLevel, openLevelManage, closeLevelManage, savePartnerLevel,
      currentPage, totalPages, pageNumbers, prevPage, nextPage, goToPage };
  }
};

// ── 企业管理员管理（渠道企业管理员账号）────────────────────────
const PartnerAdminManage = {
  template: `
  <div>
    <!-- 页面标题 -->
    <div style="margin-bottom:20px">
      <h2 style="font-size:18px;font-weight:700;color:#1a1a1a">企业管理员</h2>
      <p style="font-size:13px;color:#888;margin-top:4px">
        为渠道企业创建企业管理员账号，企业管理员可查看本企业所有员工的数据
      </p>
    </div>

    <!-- 卡片区域：左侧-创建表单，右侧-现有企业管理员列表 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

      <!-- 左侧：创建企业管理员 -->
      <div class="card">
        <div class="card-title">🏢 创建企业管理员</div>
        <p style="font-size:12px;color:#888;margin-bottom:16px">
          由区域管理员创建的企业管理员账号，需经超级管理员审批后生效
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-item">
            <label class="form-label required">登录账号</label>
            <input class="form-control" v-model="form.username" placeholder="如：sdcz_admin" />
          </div>
          <div class="form-item">
            <label class="form-label required">姓名</label>
            <input class="form-control" v-model="form.name" placeholder="企业管理员姓名" />
          </div>
          <div class="form-item">
            <label class="form-label required">联系电话</label>
            <input class="form-control" v-model="form.phone" placeholder="138-0000-0000" />
          </div>
          <div class="form-item">
            <label class="form-label">邮箱</label>
            <input class="form-control" v-model="form.email" placeholder="email@company.com" />
          </div>
          <div class="form-item full">
            <label class="form-label required">所属渠道企业</label>
            <select class="form-control" v-model="form.partnerId">
              <option value="">请选择渠道企业</option>
              <option v-for="p in myPartners" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
        </div>
        <div v-if="isSuperAdmin" style="margin-top:12px;padding:10px;background:#fff7e6;border-radius:6px;font-size:12px;color:#ad6800">
          💡 超级管理员创建将直接生效；区域管理员创建需提交审批
        </div>
        <div style="margin-top:16px">
          <button class="btn btn-primary" @click="createPartnerAdmin" :disabled="!canCreate">创建企业管理员</button>
        </div>
      </div>

      <!-- 右侧：企业管理员账号列表 -->
      <div class="card">
        <div class="card-title">👤 现有企业管理员</div>
        <div v-if="partnerAdmins.length === 0" class="empty-state">
          <div class="empty-icon">🏢</div>
          <p style="color:#999">暂无企业管理员账号</p>
        </div>
        <div v-else style="display:flex;flex-direction:column;gap:10px">
          <div v-for="u in partnerAdmins" :key="u.id" style="display:flex;align-items:center;gap:12px;padding:12px;background:#fafafa;border-radius:8px">
            <div style="width:40px;height:40px;background:linear-gradient(135deg,#722ed1,#52c41a);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;font-weight:600">
              {{ u.name?.charAt(0) }}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:700;color:#1a1a1a">{{ u.name }}</div>
              <div style="font-size:12px;color:#888;margin-top:2px">{{ u.partnerName || '—' }} · {{ u.username }}</div>
            </div>
            <span :class="'tag ' + (u.status==='active'?'tag-green':(u.status==='inactive'?'tag-red':'tag-orange'))" style="font-size:11px">
              {{ u.status==='active'?'已启用':(u.status==='inactive'?'已禁用':'待审批') }}
            </span>
            <div style="display:flex;gap:6px">
              <button class="btn btn-text btn-sm" @click="openEditAdmin(u)" title="编辑">
                <span style="font-size:14px">✏️</span>
              </button>
              <button class="btn btn-text btn-sm" @click="toggleAdminStatus(u)" :title="u.status==='active'?'禁用':'启用'">
                <span style="font-size:14px">{{ u.status==='active'?'⛔':'✅' }}</span>
              </button>
              <button class="btn btn-text btn-sm" @click="resetAdminPassword(u)" title="重置密码">
                <span style="font-size:14px">🔑</span>
              </button>
              <button class="btn btn-text btn-sm" style="color:#ff4d4f" @click="deleteAdmin(u)" title="删除">
                <span style="font-size:14px">🗑️</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 待审批账号（超级管理员可见） -->
    <div v-if="isSuperAdmin && pendingAdmins.length > 0" class="card" style="margin-top:20px">
      <div class="card-title" style="color:#d46b08">⏳ 待审批企业管理员账号</div>
      <table class="data-table" style="margin-top:12px">
        <thead>
          <tr>
            <th>账号</th><th>姓名</th><th>所属企业</th><th>联系电话</th><th>提交人</th><th>提交时间</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in pendingAdmins" :key="a.id">
            <td style="font-family:monospace;font-size:12px">{{ a.targetId }}</td>
            <td>{{ a.targetName }}</td>
            <td>{{ a.targetPartnerName || '—' }}</td>
            <td>—</td>
            <td>{{ a.createdBy }}</td>
            <td>{{ new Date(a.createdAt).toLocaleDateString() }}</td>
            <td>
              <button class="btn btn-primary btn-sm" @click="approveAdmin(a.id)">通过</button>
              <button class="btn btn-text btn-sm" style="color:#ff4d4f" @click="rejectAdmin(a.id)">驳回</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 编辑企业管理员弹窗 -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
      <div class="modal" style="width:480px">
        <div class="modal-header">
          <div class="modal-title">✏️ 编辑企业管理员</div>
          <button class="modal-close" @click="closeEditModal">&times;</button>
        </div>
        <div class="modal-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-item">
              <label class="form-label required">姓名</label>
              <input class="form-control" v-model="editForm.name" placeholder="企业管理员姓名" />
            </div>
            <div class="form-item">
              <label class="form-label">联系电话</label>
              <input class="form-control" v-model="editForm.phone" placeholder="138-0000-0000" />
            </div>
            <div class="form-item">
              <label class="form-label">邮箱</label>
              <input class="form-control" v-model="editForm.email" placeholder="email@company.com" />
            </div>
            <div class="form-item">
              <label class="form-label">登录账号</label>
              <input class="form-control" :value="editForm.username" disabled style="background:#f5f5f5" />
            </div>
          </div>
          <div class="form-item" style="margin-top:12px">
            <label class="form-label">所属渠道企业</label>
            <input class="form-control" :value="editForm.partnerName" disabled style="background:#f5f5f5" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="closeEditModal">取消</button>
          <button class="btn btn-primary" @click="saveEditAdmin">保存</button>
        </div>
      </div>
    </div>

    <!-- 提示信息 -->
    <div class="card" style="margin-top:20px">
      <div class="card-title">📖 使用说明</div>
      <div style="font-size:13px;color:#666;line-height:1.8;margin-top:8px">
        <p>• <strong>企业管理员</strong>：属于某个渠道企业，可查看该企业<strong>所有员工</strong>的客户、商机、报价单、订单数据。</p>
        <p>• <strong>普通员工</strong>：只能查看自己创建的数据。</p>
        <p>• 企业管理员与普通员工使用相同的渠道伙伴登录入口（partner.html / partner-mobile.html）。</p>
        <p>• 由区域管理员创建的企业管理员，需超级管理员审批后生效。</p>
      </div>
    </div>
  </div>
  `,
  setup() {
    const isSuperAdmin = computed(() => store.user?.role === 'superadmin');
    const isAdmin = computed(() => store.user?.role === 'admin' || store.user?.role === 'superadmin');
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    const userId = computed(() => store.user?.id || '');
    const userRole = computed(() => store.user?.role || '');
    
    // 页面加载时获取渠道商数据
    async function loadPartners() {
      try {
        const params = new URLSearchParams();
        params.append('userId', userId.value);
        params.append('userRole', userRole.value);
        if (adminRegion.value) {
          params.append('region', adminRegion.value);
        }
        const res = await apiRequest('GET', `/partners?${params.toString()}`);
        if (res.success) {
          store.partners = res.data || [];
        }
      } catch (err) {
        console.error('加载渠道商失败:', err);
      }
    }
    
    // 当前管理员可见的渠道商列表（区域管理员只看到本区域的）
    const myPartners = computed(() => {
      if (isSuperAdmin.value) return store.partners || [];
      return (store.partners || []).filter(p => {
        // 渠道商 region 与管理员 region 匹配
        if (adminRegion.value && p.region === adminRegion.value) return true;
        // 或者渠道商由该管理员创建
        return p.createdBy === store.user?.id;
      });
    });

    // 页面加载时获取数据
    onMounted(() => {
      loadPartners();
    });

    // 现有企业管理员列表
    const partnerAdmins = computed(() => {
      return (store.partners || []).flatMap(p =>
        (p.staff || []).filter(s => s.role === 'partner_admin')
          .map(s => ({ ...s, partnerName: p.name }))
      );
    });

    // 待审批的企业管理员申请
    const pendingAdmins = computed(() => {
      return store.pendingApprovals.filter(a => a.type === 'partner_admin' && a.status === 'pending');
    });

    const form = reactive({
      username: '', name: '', phone: '', email: '', partnerId: ''
    });
    const canCreate = computed(() => form.username && form.name && form.phone && form.partnerId);

    async function createPartnerAdmin() {
      if (!canCreate.value) return;
      const partner = store.partners.find(p => p.id === form.partnerId);
      const userRes = await apiRequest('POST', '/users', {
        username: form.username,
        name: form.name,
        password: '123456',
        role: 'partner_admin',
        staffRole: '企业管理员',
        partnerId: form.partnerId,
        partnerName: partner?.name || '',
        region: partner?.region || '',
        bigRegion: partner?.bigRegion || '',
        phone: form.phone,
        email: form.email,
        status: isSuperAdmin.value ? 'active' : 'pending',
        createdBy: store.user?.id,
        createdByRole: store.user?.role
      });

      if (userRes.error) {
        alert('创建失败：' + userRes.error);
        return;
      }

      // 重新加载渠道商数据（包含新创建的员工）
      await loadPartners();

      // 清空表单
      form.username = '';
      form.name = '';
      form.phone = '';
      form.email = '';
      form.partnerId = '';
      alert('企业管理员创建成功！');

      // 如果是区域管理员创建，添加到待审批列表
      if (!isSuperAdmin.value) {
        const apr = {
          id: 'APR-' + Date.now(),
          type: 'partner_admin',
          targetId: userRes.data?.id,
          targetName: form.name,
          targetPartnerId: form.partnerId,
          targetPartnerName: partner?.name || '',
          createdBy: store.user?.name,
          createdByRole: store.user?.role,
          region: partner?.region || '',
          bigRegion: partner?.bigRegion || '',
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        store.pendingApprovals.unshift(apr);
        alert('已提交审批，等待超级管理员审核');
      } else {
        alert('企业管理员创建成功！初始密码：123456');
        // 刷新
        await loadPending();
      }

      // 清空表单
      form.username = ''; form.name = ''; form.phone = ''; form.email = ''; form.partnerId = '';
    }

    async function loadPending() {
      const res = await apiRequest('GET', '/pending-approvals', { userRole: store.user?.role });
      if (res.success) store.pendingApprovals = res.data || [];
    }

    async function approveAdmin(id) {
      if (!confirm('确认审批通过该企业管理员账号？')) return;
      const res = await apiRequest('PUT', '/pending-approvals/' + id, { action: 'approve', approvedBy: store.user?.name });
      if (res.success) {
        // 重新加载待审批列表和渠道商数据
        await loadPending();
        await loadPartners();
        store.notifications.unshift({ id: Date.now(), title: '企业管理员审批通过', desc: '新企业管理员账号已启用', time: '刚刚', unread: true });
      } else {
        alert('操作失败：' + res.message);
      }
    }

    async function rejectAdmin(id) {
      if (!confirm('确认驳回该申请？账号将被删除。')) return;
      const res = await apiRequest('PUT', '/pending-approvals/' + id, { action: 'reject', approvedBy: store.user?.name });
      if (res.success) {
        await loadPending();
      } else {
        alert('操作失败：' + res.message);
      }
    }

    // 编辑企业管理员
    const showEditModal = ref(false);
    const editForm = reactive({ id: '', userId: '', username: '', name: '', phone: '', email: '', partnerId: '', partnerName: '' });

    function openEditAdmin(admin) {
      editForm.id = admin.id;
      editForm.userId = admin.userId;
      editForm.username = admin.username;
      editForm.name = admin.name || '';
      editForm.phone = admin.phone || '';
      editForm.email = admin.email || '';
      editForm.partnerId = '';
      editForm.partnerName = admin.partnerName || '';
      showEditModal.value = true;
    }

    function closeEditModal() {
      showEditModal.value = false;
    }

    async function saveEditAdmin() {
      if (!editForm.name) {
        alert('请填写姓名');
        return;
      }
      // 更新用户信息
      const res = await apiRequest('PUT', '/users/' + editForm.userId, {
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email
      });

      if (res.success) {
        // 重新加载渠道商数据确保同步
        await loadPartners();
        closeEditModal();
        alert('保存成功');
      } else {
        alert('保存失败：' + res.error);
      }
    }

    // 禁用/启用企业管理员
    async function toggleAdminStatus(admin) {
      const newStatus = admin.status === 'active' ? 'inactive' : 'active';
      const action = newStatus === 'active' ? '启用' : '禁用';

      if (!confirm(`确认${action}账号「${admin.name}」吗？${newStatus === 'inactive' ? '禁用后该账号将无法登录。' : ''}`)) return;

      // 使用专门的 status API 端点
      const res = await apiRequest('PUT', '/users/' + admin.userId + '/status', { status: newStatus });
      if (res.success) {
        // 更新本地状态
        admin.status = newStatus;
        // 重新加载渠道商数据确保同步
        await loadPartners();
        alert(`账号已${action}`);
      } else {
        alert('操作失败：' + (res.error || '未知错误'));
      }
    }

    // 重置密码
    async function resetAdminPassword(admin) {
      if (!confirm(`确认重置「${admin.name}」的密码吗？\n\n重置后密码将恢复为：123456`)) return;
      try {
        const res = await apiRequest('PUT', '/users/' + admin.userId + '/password', { password: '123456' });
        if (res.success) {
          alert('密码已重置为：123456');
        } else {
          alert('操作失败：' + (res.error || '未知错误'));
        }
      } catch (err) {
        alert('操作失败：' + err.message);
      }
    }

    // 删除企业管理员
    async function deleteAdmin(admin) {
      if (!confirm(`确认删除企业管理员「${admin.name}」吗？\n\n删除后将无法恢复，且该账号将无法登录。`)) return;
      try {
        // 先调用后端API删除用户账号
        const res = await apiRequest('DELETE', '/users/' + admin.userId);
        if (res.success) {
          // 重新加载渠道商数据确保同步
          await loadPartners();
          alert('删除成功');
        } else {
          alert('删除失败：' + (res.error || '未知错误'));
        }
      } catch (err) {
        alert('删除失败：' + err.message);
      }
    }

    return { store, isSuperAdmin, adminRegion, myPartners, partnerAdmins, pendingAdmins, form, canCreate, createPartnerAdmin, approveAdmin, rejectAdmin, loadPartners,
      showEditModal, editForm, openEditAdmin, closeEditModal, saveEditAdmin, toggleAdminStatus, resetAdminPassword, deleteAdmin };
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
          <div class="card-title">🔧 技术服务商统计</div>
        </div>
        <div style="padding:16px">
          <div style="display:flex;gap:20px;margin-bottom:20px">
            <div style="flex:1;text-align:center;padding:20px;background:#f6ffed;border-radius:10px">
              <div style="font-size:28px;font-weight:800;color:#52c41a">{{ techServiceCount }}</div>
              <div style="font-size:12px;color:#888;margin-top:4px">技术服务商</div>
            </div>
            <div style="flex:1;text-align:center;padding:20px;background:#f6f8ff;border-radius:10px">
              <div style="font-size:28px;font-weight:800;color:#1677ff">{{ nonTechServiceCount }}</div>
              <div style="font-size:12px;color:#888;margin-top:4px">普通渠道商</div>
            </div>
          </div>
          <div style="font-size:12px;color:#888;line-height:1.8">
            <p>• 技术服务商占比：{{ techServicePercent }}%</p>
            <p>• 技术服务商平均业绩：{{ fmt(techServiceAvgRevenue) }}</p>
            <p>• 普通渠道商平均业绩：{{ fmt(nonTechServiceAvgRevenue) }}</p>
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
                <div v-if="p.isTechService" style="margin-top:2px">
                  <span class="tag tag-blue" style="font-size:10px;padding:0 4px">🔧 技术</span>
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
            <span v-if="detailPartner.isTechService" class="tag tag-blue">🔧 技术服务商</span>
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
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <h4 style="font-size:14px;font-weight:600;margin:0">👥 销售团队（{{ (detailPartner.staff||[]).length }} 人）</h4>
              <button class="btn btn-primary btn-sm" @click="openStaffForm()">➕ 添加员工</button>
            </div>
            <div v-if="(detailPartner.staff||[]).length" style="display:flex;flex-direction:column;gap:8px">
              <div v-for="s in detailPartner.staff" :key="s.id" class="tag tag-gray" style="font-size:12px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between">
                <div style="display:flex;align-items:center;gap:12px">
                  <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#007AFF,#5856D6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:600">{{ s.name.slice(0,1) }}</div>
                  <div>
                    <div style="font-weight:600;font-size:13px">{{ s.name }} <span :class="s.status==='active'?'tag tag-green':'tag tag-gray'" style="font-size:10px;padding:2px 6px;margin-left:6px">{{ s.status==='active'?'启用':'停用' }}</span></div>
                    <div style="color:#666;font-size:12px;margin-top:2px">
                      <span style="font-family:monospace;background:#f0f0f0;padding:1px 6px;border-radius:3px;color:#007AFF">{{ s.username }}</span>
                      <span style="margin:0 6px;color:#ccc">|</span>
                      {{ s.role }}
                      <span style="margin:0 6px;color:#ccc">|</span>
                      {{ s.phone }}
                    </div>
                  </div>
                </div>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-text btn-sm" @click="openStaffForm(s)">编辑</button>
                  <button class="btn btn-text btn-sm" :style="{color:s.status==='active'?'#FF9500':'#34C759'}" @click="toggleStaffStatus(s)">{{ s.status==='active'?'停用':'启用' }}</button>
                  <button class="btn btn-text btn-sm" @click="resetStaffPassword(s)" title="重置密码">🔑</button>
                  <button class="btn btn-text btn-sm" style="color:#FF3B30" @click="deleteStaff(s)">删除</button>
                </div>
              </div>
            </div>
            <div v-else style="color:#888;font-size:13px;padding:16px;background:#f8f9fa;border-radius:8px;text-align:center">暂无销售员工，点击上方按钮添加</div>
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

    <!-- 员工管理弹窗 -->
    <div class="modal-overlay" v-if="showStaffForm" @click.self="showStaffForm=false">
      <div class="modal" style="max-width:480px">
        <div class="modal-header">
          <div class="modal-title">{{ editingStaff ? '编辑员工账号' : '添加员工账号' }}</div>
          <span class="modal-close" @click="showStaffForm=false">✕</span>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-item">
              <label class="form-label required">登录账号</label>
              <input class="form-control" v-model="staffForm.username" placeholder="如：liujg" :disabled="editingStaff"/>
              <div class="form-hint" v-if="!editingStaff">建议使用姓名拼音缩写</div>
            </div>
            <div class="form-item">
              <label class="form-label required">员工姓名</label>
              <input class="form-control" v-model="staffForm.name" placeholder="如：刘建国"/>
            </div>
            <div class="form-item">
              <label class="form-label required">职位/角色</label>
              <select class="form-control" v-model="staffForm.role">
                <option value="">请选择</option>
                <option value="销售总监">销售总监</option>
                <option value="销售经理">销售经理</option>
                <option value="销售代表">销售代表</option>
                <option value="技术工程师">技术工程师</option>
                <option value="售前顾问">售前顾问</option>
              </select>
            </div>
            <div class="form-item">
              <label class="form-label required">联系电话</label>
              <input class="form-control" v-model="staffForm.phone" placeholder="138-0000-0000"/>
            </div>
            <div class="form-item">
              <label class="form-label">邮箱</label>
              <input class="form-control" v-model="staffForm.email" placeholder="name@company.com"/>
            </div>
            <div class="form-item">
              <label class="form-label">账号状态</label>
              <select class="form-control" v-model="staffForm.status">
                <option value="active">启用</option>
                <option value="inactive">停用</option>
              </select>
            </div>
          </div>
          <div style="margin-top:16px;padding:12px;background:#f0f7ff;border-radius:8px;border:1px solid #d6e4ff">
            <div style="font-size:12px;color:#1677ff">
              <span style="font-weight:600">🔑 初始密码：</span>新账号初始密码统一为 <b>123456</b>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showStaffForm=false">取消</button>
          <button class="btn btn-primary" @click="saveStaff" :disabled="!canSaveStaff">{{ editingStaff ? '保存修改' : '创建账号' }}</button>
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
    
    // ========== 员工账号管理 ==========
    const showStaffForm = ref(false);
    const editingStaff = ref(false);
    const staffForm = reactive({ id:'', username:'', name:'', role:'', phone:'', email:'', status:'active' });
    const canSaveStaff = computed(() => staffForm.username && staffForm.name && staffForm.role && staffForm.phone);
    
    function openStaffForm(staff = null) {
      if (staff) {
        editingStaff.value = true;
        Object.assign(staffForm, { ...staff });
      } else {
        editingStaff.value = false;
        staffForm.id = ''; staffForm.username = ''; staffForm.name = ''; staffForm.role = '';
        staffForm.phone = ''; staffForm.email = ''; staffForm.status = 'active';
      }
      showStaffForm.value = true;
    }
    
    function saveStaff() {
      if (!canSaveStaff.value || !detailPartner.value) return;
      
      const partner = store.partners.find(p => p.id === detailPartner.value.id);
      if (!partner) return;
      
      if (!partner.staff) partner.staff = [];
      
      if (editingStaff.value) {
        // 编辑
        const idx = partner.staff.findIndex(s => s.id === staffForm.id);
        if (idx > -1) {
          partner.staff[idx] = { ...partner.staff[idx], ...staffForm };
        }
      } else {
        // 新增 - 检查账号是否已存在
        if (partner.staff.find(s => s.username === staffForm.username)) {
          alert('该登录账号已存在，请更换');
          return;
        }
        // 检查全局是否已存在该用户名
        const allUsernames = store.partners.flatMap(p => p.staff?.map(s => s.username) || []);
        if (allUsernames.includes(staffForm.username)) {
          alert('该登录账号已被其他渠道商使用，请更换');
          return;
        }
        const newId = 'S' + String(Date.now()).slice(-6);
        partner.staff.push({
          id: newId,
          username: staffForm.username,
          name: staffForm.name,
          role: staffForm.role,
          phone: staffForm.phone,
          email: staffForm.email,
          status: staffForm.status,
          password: '123456',
          createdAt: today()
        });
      }
      
      // 同步更新 detailPartner
      detailPartner.value = { ...partner };
      showStaffForm.value = false;
    }
    
    function toggleStaffStatus(staff) {
      const partner = store.partners.find(p => p.id === detailPartner.value?.id);
      if (!partner || !partner.staff) return;
      const s = partner.staff.find(s => s.id === staff.id);
      if (s) {
        s.status = s.status === 'active' ? 'inactive' : 'active';
        detailPartner.value = { ...partner };
      }
    }

    // 重置员工账号密码
    async function resetStaffPassword(staff) {
      if (!confirm(`确认重置「${staff.name}」(${staff.username}) 的密码吗？\n\n重置后密码将恢复为：123456`)) return;
      try {
        // ✅ 使用 staff.userId 而不是 staff.id，因为后端API期望的是用户ID
        const res = await apiRequest('PUT', `/users/${staff.userId}/password`, { password: '123456' });
        if (res.success) {
          alert('密码已重置为：123456');
        } else {
          alert('操作失败：' + (res.error || '未知错误'));
        }
      } catch (err) {
        alert('操作失败：' + err.message);
      }
    }

    function deleteStaff(staff) {
      if (!confirm(`确认删除员工「${staff.name}」(${staff.username})？\n删除后该账号将无法登录。`)) return;
      const partner = store.partners.find(p => p.id === detailPartner.value?.id);
      if (!partner || !partner.staff) return;
      const idx = partner.staff.findIndex(s => s.id === staff.id);
      if (idx > -1) {
        partner.staff.splice(idx, 1);
        detailPartner.value = { ...partner };
      }
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
    const techServiceCount = computed(() => myPartners.value.filter(p=>p.isTechService).length);
    const nonTechServiceCount = computed(() => myPartners.value.filter(p=>!p.isTechService).length);
    const techServicePercent = computed(() => Math.round(techServiceCount.value/(myPartners.value.length||1)*100));
    const techServiceAvgRevenue = computed(() => {
      const list = myPartners.value.filter(p=>p.isTechService);
      return list.length ? Math.round(list.reduce((s,p)=>s+p.totalAmt,0)/list.length) : 0;
    });
    const nonTechServiceAvgRevenue = computed(() => {
      const list = myPartners.value.filter(p=>!p.isTechService);
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
        '深圳区':'🏢', '广州区':'🌸', '湖南区':'🌾',
        '西区':'🏔️',
        '北区（政府企业）':'🏛️', '河南区':'🌻', '东北区':'❄️', '山东区':'🌊', '晋冀区':'🗻'
      };
      return map[region] || '📍';
    }
    
    return { store, adminRegion, myPartners, sortBy, searchKw, detailPartner, totalQuotes, totalRevenue, totalStaff, avgRevenue, revenuePerStaff, conversionRate, newPartnersThisMonth,
      topPartners, sortedPartners, filteredPartners, levelDistribution, regionDistribution, techServiceCount, nonTechServiceCount, techServicePercent,
      techServiceAvgRevenue, nonTechServiceAvgRevenue, partnerMonthlyTrend, partnerRegistrations, partnerOpportunities, stageStats,
      levelClass, levelLabel, levelColor, regionIcon, fmt, openDetail,
      // 员工管理
      showStaffForm, editingStaff, staffForm, canSaveStaff, openStaffForm, saveStaff, toggleStaffStatus, resetStaffPassword, deleteStaff };
  }
};

// ── 账号管理（超级管理员专属）────────────────────────────────
const BIG_REGIONS = [
  { label:'大东区', regions:['安徽区','江苏区','上海区（非金）','浙赣区'] },
  { label:'大南区', regions:['深圳区','广州区','湖南区'] },
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
        <div><div class="stat-value">{{ adminAccounts.filter(a=>a.role!=='superadmin').length }}</div><div class="stat-label">区域管理员总数</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">✅</div>
        <div><div class="stat-value">{{ adminAccounts.filter(a=>a.role!=='superadmin'&&a.status==='active').length }}</div><div class="stat-label">启用账号</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">⏸️</div>
        <div><div class="stat-value">{{ adminAccounts.filter(a=>a.role!=='superadmin'&&a.status==='disabled').length }}</div><div class="stat-label">停用账号</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">🗺️</div>
        <div><div class="stat-value">{{ BIG_REGIONS.length }}</div><div class="stat-label">大区数量</div></div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" style="text-align:center;padding:40px;color:#888">加载中...</div>

    <!-- 操作按钮 -->
    <div v-if="!loading" style="margin-bottom:16px;display:flex;justify-content:flex-end;gap:8px;align-items:center">
      <button class="btn btn-default" @click="$router.push('/account-manage/staff-import')">📥 批量导入</button>
    </div>

    <!-- 各大区账号列表 -->
    <div v-if="!loading" v-for="group in BIG_REGIONS" :key="group.label" class="card" style="margin-bottom:20px">
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
            <tr v-for="a in adminAccounts.filter(x=>x.bigRegion===group.label)" :key="a.id">
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
                <button class="btn btn-text btn-sm" @click="resetPassword(a)" title="重置密码">🔑</button>
                <button class="btn btn-text btn-sm" @click="toggleStatus(a)" :style="{color:a.status==='active'?'#FF9500':'#34C759'}">
                  {{ a.status==='active'?'停用':'启用' }}
                </button>
                <button class="btn btn-text btn-sm" style="color:#FF3B30" @click="deleteAccount(a)">删除</button>
              </td>
            </tr>
            <tr v-if="!adminAccounts.filter(x=>x.bigRegion===group.label).length">
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
          <button class="btn btn-primary" @click="save" :disabled="saving">
            {{ saving ? '保存中...' : (editing?'保存修改':'创建账号') }}
          </button>
        </div>
      </div>
    </div>
  </div>`,
  setup() {
    const loading = ref(true);
    const saving = ref(false);
    const adminAccounts = ref([]);
    const showForm = ref(false);
    const editing = ref(false);
    const form = reactive({ id:'', username:'', name:'', avatar:'', bigRegion:'大东区', region:'', status:'active', remark:'' });
    const canSave = computed(() => form.username && form.name && form.bigRegion && form.region);

    // 从后端加载管理员账号列表
    async function loadAdminAccounts() {
      loading.value = true;
      try {
        const res = await apiRequest('GET', '/users?role=admin');
        if (res.success && res.data) {
          // 确保每条数据有 avatar 和 remark 字段，且使用 userId 作为操作标识
          adminAccounts.value = res.data.map(a => ({
            ...a,
            userId: a.id,  // 确保有 userId 字段用于 API 调用
            avatar: a.avatar || a.name?.slice(0, 1) || '?',
            remark: a.remark || ''
          }));
        } else {
          console.error('加载管理员账号失败:', res);
          adminAccounts.value = [];
        }
      } catch (e) {
        console.error('加载管理员账号失败:', e);
        adminAccounts.value = [];
      } finally {
        loading.value = false;
      }
    }
    
    // 重置管理员密码
    async function resetPassword(admin) {
      if (!confirm(`确认重置「${admin.name}」的密码吗？\n\n重置后密码将恢复为：123456`)) return;
      try {
        const res = await apiRequest('PUT', '/users/' + admin.userId + '/password', { password: '123456' });
        if (res.success) {
          alert('密码已重置为：123456');
        } else {
          alert('操作失败：' + (res.error || '未知错误'));
        }
      } catch (e) {
        alert('操作失败：' + e.message);
      }
    }

    onMounted(() => {
      loadAdminAccounts();
    });

    function openNew(bigRegion) {
      editing.value = false;
      form.id = ''; form.username = ''; form.name = ''; form.avatar = '';
      form.bigRegion = bigRegion || '大东区'; form.region = ''; form.status = 'active'; form.remark = '';
      showForm.value = true;
    }
    function openEdit(a) {
      editing.value = true;
      Object.assign(form, { id:a.id, username:a.username, name:a.name, avatar:a.avatar, bigRegion:a.bigRegion || '', region:a.region || '', status:a.status, remark:a.remark||'' });
      showForm.value = true;
    }
    async function save() {
      // 表单验证
      if (!form.username) { alert('请填写登录账号'); return; }
      if (!form.name) { alert('请填写管理员姓名'); return; }
      if (!form.bigRegion) { alert('请选择大区'); return; }
      if (!form.region) { alert('请选择负责区域'); return; }
      
      if (!canSave.value) return;
      saving.value = true;
      try {
        if (editing.value) {
          // 编辑：调用更新API
          const res = await apiRequest('PUT', '/users/' + form.id, {
            name: form.name,
            avatar: form.avatar || form.name.slice(0,1),
            bigRegion: form.bigRegion,
            region: form.region,
            status: form.status,
            remark: form.remark
          });
          if (res.success) {
            alert('保存成功');
            showForm.value = false;
            loadAdminAccounts(); // 重新加载
          } else {
            alert('保存失败：' + (res.error || '未知错误'));
          }
        } else {
          // 新增：检查账号名是否重复（本地检查）
          if (adminAccounts.value.find(a => a.username === form.username)) {
            alert('账号名已存在，请换一个'); return;
          }
          // 调用后端API创建账号
          const res = await apiRequest('POST', '/admin/accounts', {
            username: form.username,
            name: form.name,
            role: 'admin',
            password: '123456',
            region: form.region,
            bigRegion: form.bigRegion,
            status: form.status,
            remark: form.remark
          });
          if (res.success) {
            alert('管理员账号创建成功，初始密码为 123456');
            showForm.value = false;
            loadAdminAccounts(); // 重新加载，确保显示新账号
          } else {
            alert('创建账号失败：' + (res.message || res.error || '未知错误'));
            return;
          }
        }
      } catch (e) {
        alert('操作失败：' + e.message);
      } finally {
        saving.value = false;
      }
    }
    async function toggleStatus(a) {
      const newStatus = a.status === 'active' ? 'disabled' : 'active';
      try {
        const res = await apiRequest('PUT', '/users/' + a.id, { status: newStatus });
        if (res.success) {
          a.status = newStatus;
        } else {
          alert('状态更新失败');
        }
      } catch (e) {
        alert('状态更新失败：' + e.message);
      }
    }
    async function deleteAccount(a) {
      if (confirm('确认删除账号「' + a.name + '」(' + a.username + ')？')) {
        try {
          const res = await apiRequest('DELETE', '/users/' + a.id);
          if (res.success) {
            loadAdminAccounts(); // 重新加载
          } else {
            alert('删除失败：' + (res.error || '未知错误'));
          }
        } catch (e) {
          alert('删除失败：' + e.message);
        }
      }
    }
    return { adminAccounts, loading, saving, BIG_REGIONS, showForm, editing, form, canSave, openNew, openEdit, save, toggleStatus, deleteAccount, resetPassword };
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
    <div v-if="loading" style="text-align:center;padding:40px;color:#888">加载中...</div>

    <!-- 客户报备审核 -->
    <div v-if="activeTab==='registration' && !loading" class="card">
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
            <tr v-for="r in paginatedRegs" :key="r.id">
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
                <button class="btn btn-primary btn-sm" @click="resubmitReg(r)" v-if="r.status==='rejected'">↻ 重新提交</button>
                <span v-if="r.status==='approved'" style="color:#aaa;font-size:12px">已通过</span>
              </td>
            </tr>
            <tr v-if="!paginatedRegs.length">
              <td colspan="8">
                <div class="empty-state"><div class="empty-icon">✅</div><p>暂无报备记录</p></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- 分页控件 -->
      <div class="pagination" v-if="totalPages > 1">
        <span class="pagination-info">共 {{ allRegs.length }} 条，第 {{ currentPage }}/{{ totalPages }} 页</span>
        <button class="btn btn-sm" @click="prevPage" :disabled="currentPage === 1">上一页</button>
        <button class="btn btn-sm" v-for="p in pageNumbers" :key="p" :class="{active: p === currentPage}" @click="goToPage(p)">{{ p }}</button>
        <button class="btn btn-sm" @click="nextPage" :disabled="currentPage === totalPages">下一页</button>
      </div>
      <div class="pagination" v-else style="justify-content:flex-end">
        <span class="pagination-info">共 {{ allRegs.length }} 条</span>
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
            <tr v-for="p in paginatedPartners" :key="p.id">
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
                <button class="btn btn-primary btn-sm" @click="resubmitPartner(p)" v-if="p.status==='rejected'">↻ 重新提交</button>
                <span v-if="p.status==='active'" style="color:#aaa;font-size:12px">已通过</span>
              </td>
            </tr>
            <tr v-if="!paginatedPartners.length">
              <td colspan="8">
                <div class="empty-state"><div class="empty-icon">✅</div><p>暂无待审核渠道商</p></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- 分页控件 -->
      <div class="pagination" v-if="partnerTotalPages > 1">
        <span class="pagination-info">共 {{ pendingPartners.length }} 条，第 {{ partnerPage }}/{{ partnerTotalPages }} 页</span>
        <button class="btn btn-sm" @click="prevPartnerPage" :disabled="partnerPage === 1">上一页</button>
        <button class="btn btn-sm" v-for="p in partnerPageNumbers" :key="p" :class="{active: p === partnerPage}" @click="goToPartnerPage(p)">{{ p }}</button>
        <button class="btn btn-sm" @click="nextPartnerPage" :disabled="partnerPage === partnerTotalPages">下一页</button>
      </div>
      <div class="pagination" v-else style="justify-content:flex-end">
        <span class="pagination-info">共 {{ pendingPartners.length }} 条</span>
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
            <tr v-for="s in paginatedStaff" :key="s.id">
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
                <button class="btn btn-primary btn-sm" @click="resubmitStaff(s)" v-if="s.status==='rejected'">↻ 重新提交</button>
                <span v-if="s.status==='active'" style="color:#aaa;font-size:12px">已通过</span>
              </td>
            </tr>
            <tr v-if="!paginatedStaff.length">
              <td colspan="8">
                <div class="empty-state"><div class="empty-icon">✅</div><p>暂无待审核员工</p></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- 分页控件 -->
      <div class="pagination" v-if="staffTotalPages > 1">
        <span class="pagination-info">共 {{ pendingStaff.length }} 条，第 {{ staffPage }}/{{ staffTotalPages }} 页</span>
        <button class="btn btn-sm" @click="prevStaffPage" :disabled="staffPage === 1">上一页</button>
        <button class="btn btn-sm" v-for="p in staffPageNumbers" :key="p" :class="{active: p === staffPage}" @click="goToStaffPage(p)">{{ p }}</button>
        <button class="btn btn-sm" @click="nextStaffPage" :disabled="staffPage === staffTotalPages">下一页</button>
      </div>
      <div class="pagination" v-else style="justify-content:flex-end">
        <span class="pagination-info">共 {{ pendingStaff.length }} 条</span>
      </div>
    </div>
  </div>`,
  setup() {
    const activeTab = ref('registration');
    const loading = ref(false);
    const registrations = ref([]);
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    const isSuperAdmin = computed(() => store.user?.role === 'superadmin');
    const isAdmin = computed(() => store.user?.role === 'admin' || store.user?.role === 'superadmin');
    
    // 分页相关（三个标签页各自独立分页）
    const currentPage = ref(1);
    const pageSize = ref(10);
    const partnerPage = ref(1);
    const partnerPageSize = ref(10);
    const staffPage = ref(1);
    const staffPageSize = ref(10);
    
    // 报备分页
    const totalPages = computed(() => Math.max(1, Math.ceil(allRegs.value.length / pageSize.value)));
    const paginatedRegs = computed(() => {
      const start = (currentPage.value - 1) * pageSize.value;
      return allRegs.value.slice(start, start + pageSize.value);
    });
    const pageNumbers = computed(() => {
      const pages = [];
      const total = totalPages.value;
      const cur = currentPage.value;
      if (total <= 7) {
        for (let i = 1; i <= total; i++) pages.push(i);
      } else {
        pages.push(1);
        if (cur > 3) pages.push('...');
        for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
        if (cur < total - 2) pages.push('...');
        pages.push(total);
      }
      return pages;
    });
    function prevPage() { if (currentPage.value > 1) currentPage.value--; }
    function nextPage() { if (currentPage.value < totalPages.value) currentPage.value++; }
    function goToPage(p) { if (p !== '...' && p >= 1 && p <= totalPages.value) currentPage.value = p; }
    function resetPage() { currentPage.value = 1; }
    
    // 渠道商分页
    const partnerTotalPages = computed(() => Math.max(1, Math.ceil(pendingPartners.value.length / partnerPageSize.value)));
    const paginatedPartners = computed(() => {
      const start = (partnerPage.value - 1) * partnerPageSize.value;
      return pendingPartners.value.slice(start, start + partnerPageSize.value);
    });
    const partnerPageNumbers = computed(() => {
      const pages = [];
      const total = partnerTotalPages.value;
      const cur = partnerPage.value;
      if (total <= 7) {
        for (let i = 1; i <= total; i++) pages.push(i);
      } else {
        pages.push(1);
        if (cur > 3) pages.push('...');
        for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
        if (cur < total - 2) pages.push('...');
        pages.push(total);
      }
      return pages;
    });
    function prevPartnerPage() { if (partnerPage.value > 1) partnerPage.value--; }
    function nextPartnerPage() { if (partnerPage.value < partnerTotalPages.value) partnerPage.value++; }
    function goToPartnerPage(p) { if (p !== '...' && p >= 1 && p <= partnerTotalPages.value) partnerPage.value = p; }
    
    // 员工分页
    const staffTotalPages = computed(() => Math.max(1, Math.ceil(pendingStaff.value.length / staffPageSize.value)));
    const paginatedStaff = computed(() => {
      const start = (staffPage.value - 1) * staffPageSize.value;
      return pendingStaff.value.slice(start, start + staffPageSize.value);
    });
    const staffPageNumbers = computed(() => {
      const pages = [];
      const total = staffTotalPages.value;
      const cur = staffPage.value;
      if (total <= 7) {
        for (let i = 1; i <= total; i++) pages.push(i);
      } else {
        pages.push(1);
        if (cur > 3) pages.push('...');
        for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
        if (cur < total - 2) pages.push('...');
        pages.push(total);
      }
      return pages;
    });
    function prevStaffPage() { if (staffPage.value > 1) staffPage.value--; }
    function nextStaffPage() { if (staffPage.value < staffTotalPages.value) staffPage.value++; }
    function goToStaffPage(p) { if (p !== '...' && p >= 1 && p <= staffTotalPages.value) staffPage.value = p; }
    
    // 从后端加载报备数据
    async function loadRegistrations() {
      loading.value = true;
      try {
        const params = new URLSearchParams();
        if (adminRegion.value) {
          params.append('region', adminRegion.value);
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
    
    onMounted(loadRegistrations);
    
    // 区域管理员只看本区域报备；超级管理员看全部
    const allRegs = computed(() => adminRegion.value
      ? registrations.value.filter(r => r.region === adminRegion.value)
      : registrations.value);
    
    // 待审核报备数
    const pendingRegCount = computed(() => allRegs.value.filter(r => r.status === 'pending' || r.status === 'reviewing').length);
    
    // 待审核列表（从后端获取）
    const pendingApprovals = ref([]);
    
    // 从后端加载待审批列表
    async function loadPendingApprovals() {
      if (!isSuperAdmin.value) return;
      try {
        const res = await apiRequest('GET', `/pending-approvals?userRole=${store.user?.role}`);
        if (res.success) {
          pendingApprovals.value = res.data || [];
        }
      } catch (err) {
        console.error('加载待审批列表失败:', err);
      }
    }
    
    onMounted(() => {
      loadRegistrations();
      loadPendingApprovals();
    });
    
    // 待审核渠道商（仅超级管理员可见）
    const pendingPartners = computed(() => {
      const partnerApprovals = pendingApprovals.value.filter(a => a.type === 'partner');
      // 从 partners 中找到对应的渠道商，合并待审批数据中的信息
      return partnerApprovals.map(a => {
        const partner = store.partners.find(p => p.id === a.targetId);
        // 合并 partner 数据和 approval 数据，优先使用 partner 中的字段
        return {
          id: a.targetId,
          name: a.targetName,
          region: a.region,
          status: a.status,
          // 从 partner 中获取详细信息，如果不存在则使用默认值
          level: partner?.level || 'gold',
          contact: partner?.contact || '-',
          phone: partner?.phone || '',
          joinDate: partner?.joinDate || a.createdAt?.split('T')[0]
        };
      }).filter(p => p.status === 'pending' || p.status === 'rejected');
    });
    const pendingPartnerCount = computed(() => pendingApprovals.value.filter(a => a.type === 'partner' && a.status === 'pending').length);
    
    // 待审核员工（仅超级管理员可见）
    // 同时包含 type==='staff' 和 type==='partner_admin' 的待审批账号
    const pendingStaff = computed(() => {
      const staffApprovals = pendingApprovals.value.filter(a => a.type === 'staff' || a.type === 'partner_admin');
      return staffApprovals.map(a => {
        // 从 users 中找到对应的用户获取更多信息
        const user = store.users?.find(u => u.id === a.targetId);
        // 从对应渠道商的 staff 数组中获取详细信息
        let staffInfo = null;
        if (a.targetPartnerId || user?.partnerId) {
          const partner = store.partners?.find(p => p.id === (a.targetPartnerId || user?.partnerId));
          if (partner?.staff) {
            staffInfo = partner.staff.find(s => s.userId === a.targetId || s.id === a.targetId);
          }
        }
        // 角色标签：企业管理员 or 员工职位
        const roleLabel = a.type === 'partner_admin' ? '企业管理员' : (staffInfo?.role || user?.staffRole || '销售代表');
        return {
          id: a.targetId,
          aprId: a.id,  // pendingApprovals 记录 id（用于审批接口）
          name: a.targetName,
          partnerName: a.targetPartnerName || user?.partnerName || '-',
          partnerId: a.targetPartnerId || user?.partnerId,
          role: roleLabel,
          phone: staffInfo?.phone || user?.phone || '-',
          status: a.status,
          type: a.type,
          createdAt: a.createdAt?.split('T')[0] || '-'
        };
      }).filter(s => s.status === 'pending' || s.status === 'rejected');
    });
    const pendingStaffCount = computed(() => pendingApprovals.value.filter(a => (a.type === 'staff' || a.type === 'partner_admin') && a.status === 'pending').length);
    
    function sClass(s) { return { approved:'tag-green', pending:'tag-orange', reviewing:'tag-blue', expired:'tag-gray', rejected:'tag-red', active:'tag-green' }[s]||'tag-gray'; }
    function sLabel(s) { return { approved:'已通过', pending:'待审核', reviewing:'审核中', expired:'已过期', rejected:'已拒绝', active:'已生效' }[s]||s; }
    function levelClass(lvl) { return { lep:'tag-purple', diamond:'tag-blue', gold:'tag-orange', silver:'tag-gray', bronze:'tag-brown', industry:'tag-green' }[lvl]||'tag-gray'; }
    function levelLabel(lvl) { return { lep:'💎 LEP', diamond:'🔷 钻石', gold:'🥇 金牌', silver:'🥈 银牌', bronze:'🥉 铜牌', industry:'🏭 行业总代' }[lvl]||lvl; }
    
    // 报备审核
    async function approveReg(r) {
      try {
        const res = await apiRequest('PUT', `/registrations/${r.id}/status`, { status: 'approved', remark: '' });
        if (res.success) {
          r.status = 'approved';
          store.notifications.unshift({ id:Date.now(), title:'报备审批通过', desc:`${r.customer} 已审批通过`, time:'刚刚', unread:true });
        } else {
          alert('审批失败：' + (res.error || '未知错误'));
        }
      } catch (err) {
        alert('审批失败：' + err.message);
      }
    }
    async function rejectReg(r) { 
      try {
        const res = await apiRequest('PUT', `/registrations/${r.id}/status`, { status: 'rejected', remark: '' });
        if (res.success) {
          r.status = 'rejected';
          store.notifications.unshift({ id:Date.now(), title:'报备已拒绝', desc:`${r.customer} 已被拒绝`, time:'刚刚', unread:true });
        } else {
          alert('拒绝失败：' + (res.error || '未知错误'));
        }
      } catch (err) {
        alert('拒绝失败：' + err.message);
      }
    }
    async function resubmitReg(r) {
      try {
        const res = await apiRequest('PUT', `/registrations/${r.id}/status`, { status: 'pending', remark: '' });
        if (res.success) {
          r.status = 'pending';
          store.notifications.unshift({ id:Date.now(), title:'报备重新提交', desc:`${r.customer} 已重新提交审核`, time:'刚刚', unread:true });
        } else {
          alert('重新提交失败：' + (res.error || '未知错误'));
        }
      } catch (err) {
        alert('重新提交失败：' + err.message);
      }
    }
    
    // 渠道商审核
    async function approvePartner(p) {
      try {
        const res = await apiRequest('PUT', `/partners/${p.id}/status`, { 
          status: 'active', 
          approvedBy: store.user?.id 
        });
        if (res.success) {
          p.status = 'active';
          store.notifications.unshift({ id:Date.now(), title:'渠道商审批通过', desc:`${p.name} 已审批通过`, time:'刚刚', unread:true });
          // 刷新待审批列表
          loadPendingApprovals();
        } else {
          alert('审批失败：' + (res.error || '未知错误'));
        }
      } catch (err) {
        alert('审批失败：' + err.message);
      }
    }
    async function rejectPartner(p) { 
      try {
        const res = await apiRequest('PUT', `/partners/${p.id}/status`, { 
          status: 'rejected', 
          approvedBy: store.user?.id 
        });
        if (res.success) {
          p.status = 'rejected';
          loadPendingApprovals();
        } else {
          alert('拒绝失败：' + (res.error || '未知错误'));
        }
      } catch (err) {
        alert('拒绝失败：' + err.message);
      }
    }
    async function resubmitPartner(p) {
      try {
        const res = await apiRequest('PUT', `/partners/${p.id}/status`, { 
          status: 'pending'
        });
        if (res.success) {
          p.status = 'pending';
          // 更新待审批列表
          const approval = pendingApprovals.value.find(a => a.targetId === p.id && a.type === 'partner');
          if (approval) {
            approval.status = 'pending';
          }
          store.notifications.unshift({ id:Date.now(), title:'渠道商重新提交', desc:`${p.name} 已重新提交审核`, time:'刚刚', unread:true });
        } else {
          alert('重新提交失败：' + (res.error || '未知错误'));
        }
      } catch (err) {
        alert('重新提交失败：' + err.message);
      }
    }
    
    // 员工审核
    async function approveStaff(s) {
      try {
        // 区分处理：partner_admin 使用 pending-approvals 接口，staff 使用 users 接口
        let res;
        if (s.type === 'partner_admin') {
          // 企业管理员审批
          res = await apiRequest('PUT', `/pending-approvals/${s.aprId}`, { 
            action: 'approve',
            approvedBy: store.user?.name
          });
        } else {
          // 普通员工审批
          res = await apiRequest('PUT', `/users/${s.id}/status`, { 
            status: 'active',
            approvedBy: store.user?.id
          });
        }
        
        if (res.success) {
          s.status = 'active';
          store.notifications.unshift({ id:Date.now(), title:'员工审批通过', desc:`${s.name} 已审批通过`, time:'刚刚', unread:true });
          // 刷新待审批列表
          loadPendingApprovals();
        } else {
          alert('审批失败：' + (res.error || res.message || '未知错误'));
        }
      } catch (err) {
        alert('审批失败：' + err.message);
      }
    }
    async function rejectStaff(s) { 
      try {
        // 区分处理：partner_admin 使用 pending-approvals 接口，staff 使用 users 接口
        let res;
        if (s.type === 'partner_admin') {
          // 企业管理员驳回
          res = await apiRequest('PUT', `/pending-approvals/${s.aprId}`, { 
            action: 'reject',
            approvedBy: store.user?.name
          });
        } else {
          // 普通员工驳回
          res = await apiRequest('PUT', `/users/${s.id}/status`, { 
            status: 'rejected',
            approvedBy: store.user?.id
          });
        }
        
        if (res.success) {
          s.status = 'rejected';
          // 刷新待审批列表
          loadPendingApprovals();
        } else {
          alert('拒绝失败：' + (res.error || res.message || '未知错误'));
        }
      } catch (err) {
        alert('拒绝失败：' + err.message);
      }
    }
    async function resubmitStaff(s) {
      try {
        const res = await apiRequest('PUT', `/users/${s.id}/status`, { 
          status: 'pending'
        });
        if (res.success) {
          s.status = 'pending';
          // 更新待审批列表
          const approval = pendingApprovals.value.find(a => a.targetId === s.id && a.type === 'staff');
          if (approval) {
            approval.status = 'pending';
          }
          store.notifications.unshift({ id:Date.now(), title:'员工重新提交', desc:`${s.name} 已重新提交审核`, time:'刚刚', unread:true });
        } else {
          alert('重新提交失败：' + (res.error || '未知错误'));
        }
      } catch (err) {
        alert('重新提交失败：' + err.message);
      }
    }
    
    return { activeTab, loading, adminRegion, isAdmin, isSuperAdmin, allRegs, pendingPartners, pendingStaff,
      paginatedRegs, paginatedPartners, paginatedStaff,
      pendingRegCount, pendingPartnerCount, pendingStaffCount,
      sClass, sLabel, levelClass, levelLabel,
      approveReg, rejectReg, resubmitReg, approvePartner, rejectPartner, resubmitPartner, approveStaff, rejectStaff, resubmitStaff,
      loadPendingApprovals,
      currentPage, totalPages, pageNumbers, prevPage, nextPage, goToPage,
      partnerPage, partnerTotalPages, partnerPageNumbers, prevPartnerPage, nextPartnerPage, goToPartnerPage,
      staffPage, staffTotalPages, staffPageNumbers, prevStaffPage, nextStaffPage, goToStaffPage };
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
      <button class="btn btn-default" @click="$router.push('/opportunity/import')" v-if="isAdmin" style="white-space:nowrap">📥 批量导入</button>
    </div>

    <!-- 列表视图 -->
    <div class="card" v-if="viewMode==='list'">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>商机名称</th><th>客户</th><th>合作伙伴</th><th>阶段</th><th>金额</th><th>预计关闭</th><th>最近跟进</th><th>负责人</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="o in paginatedData" :key="o.id" style="cursor:pointer" @click="openDetail(o)">
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
                <div style="font-weight:500;color:#1677ff">{{ o.assignedPartnerName || o.partnerName || '—' }}</div>
                <div v-if="o.assignedStaffName" style="font-size:11px;color:#666">{{ o.assignedStaffName }}</div>
                <div v-else-if="o.createdByName" style="font-size:11px;color:#666">{{ o.createdByName }}</div>
                <div v-else-if="o.partnerId" style="font-size:11px;color:#aaa;font-family:monospace">{{ o.partnerId }}</div>
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
            <tr v-if="!paginatedData.length"><td colspan="10"><div class="empty-state"><div class="empty-icon">🎯</div><p>暂无商机记录</p></div></td></tr>
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
      <!-- 合计 -->
      <div v-if="filtered.length" style="display:flex;gap:24px;padding:12px 16px;background:#fafafa;border-top:1px solid #f0f0f0;font-size:13px">
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
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">预计签约</label><div style="padding-top:4px">{{ detail.expectedClose }}</div></div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">来源</label><div style="padding-top:4px">{{ detail.source }}</div></div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">负责人</label><div style="padding-top:4px">{{ detail.owner }}</div></div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">指派渠道商</label><div style="padding-top:4px;font-weight:600;color:#1677ff">{{ detail.assignedPartnerName || detail.partnerName || '—' }}</div><div v-if="detail.assignedPartnerId" style="font-size:11px;color:#aaa;font-family:monospace">{{ detail.assignedPartnerId }}</div></div>
            <div class="form-item" style="margin-bottom:14px"><label class="form-label">指派跟进员工</label><div style="padding-top:4px;font-weight:600">{{ detail.assignedStaffName || '—' }}</div><div v-if="detail.assignedStaffId" style="font-size:11px;color:#aaa;font-family:monospace">{{ detail.assignedStaffId }}</div></div>
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
          <button class="btn btn-default" v-if="detail.regId && ['qualification','proposal','negotiation'].includes(detail.stage)" @click="openInlineQuoteModal(detail)">📝 创建报价单</button>
          <button class="btn btn-default" v-if="detail.regId" @click="$router.push('/opportunity/new?regId='+detail.regId);detail=null">📋 再建商机</button>
          <button class="btn btn-primary" v-if="detail.quoteId && ['closing','won'].includes(detail.stage) && !store.orders.find(o=>o.oppId===detail.id)" @click="openWonConfirmModal(detail)">🎉 确认报价转订单</button>
          <button class="btn btn-default" v-if="!detail.quoteId && detail.stage === 'won' && !store.orders.find(o=>o.oppId===detail.id)" @click="openInlineQuoteModal(detail)">📝 创建报价单</button>
          <button class="btn btn-primary" v-if="!detail.quoteId && ['closing','won'].includes(detail.stage) && !store.orders.find(o=>o.oppId===detail.id)" @click="noQuoteAlert" style="background:#fa8c16;border-color:#fa8c16">📦 转订单</button>
          <button class="btn btn-success" v-if="!['won','lost'].includes(detail.stage)" @click="changeStage('won')">🎉 标记赢单</button>
        </div>
      </div>
    </div>

    <!-- 收货地址弹窗（商机转订单） -->
    <div class="modal-overlay" v-if="showDeliveryModal" @click.self="showDeliveryModal=false">
      <div class="modal" style="max-width:480px">
        <div class="modal-header">
          <div class="modal-title">📦 填写收货信息</div>
          <span class="modal-close" @click="showDeliveryModal=false">✕</span>
        </div>
        <div class="modal-body">
          <div style="background:#fff7e6;border:1px solid #ffd591;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:#d46b08">
            💡 商机「{{ currentOppForOrder?.name }}」将标记为已赢单并生成订单
          </div>
          <div class="form-item">
            <label class="form-label required">收货地址</label>
            <input class="form-input" v-model="deliveryForm.addr" placeholder="请输入详细收货地址（省市区+街道门牌号）" />
          </div>
          <div class="form-item">
            <label class="form-label required">联系人</label>
            <input class="form-input" v-model="deliveryForm.contact" placeholder="请输入联系人姓名" />
          </div>
          <div class="form-item">
            <label class="form-label required">联系电话</label>
            <input class="form-input" v-model="deliveryForm.phone" placeholder="请输入联系电话" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showDeliveryModal=false">取消</button>
          <button class="btn btn-primary" @click="confirmToOrderFromOpp">确认转订单</button>
        </div>
      </div>
    </div>

    <!-- 赢单确认报价单弹窗 -->
    <div class="modal-overlay" v-if="showWonConfirmModal" @click.self="showWonConfirmModal=false">
      <div class="modal modal-xl" style="max-height:90vh">
        <div class="modal-header">
          <div class="modal-title">🎉 确认报价单并转订单 — {{ currentWonOpp?.name }}</div>
          <span class="modal-close" @click="showWonConfirmModal=false">✕</span>
        </div>
        <div class="modal-body" style="max-height:60vh;overflow-y:auto">
          <!-- 提示信息 -->
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
              <div><div style="font-size:12px;color:#888">端点数量</div><div style="font-weight:600">{{ wonQuoteData.endpoints }} 台</div></div>
              <div><div style="font-size:12px;color:#888">报价总额</div><div style="font-weight:700;font-size:18px;color:#1677ff">{{ fmt(wonQuoteData.total) }}</div></div>
            </div>
            <!-- 关联商机 -->
            <div v-if="wonQuoteData.oppId" style="margin-top:12px;padding-top:12px;border-top:1px dashed #ddd">
              <span style="color:#888;font-size:12px">关联商机：</span>
              <span style="color:#1677ff;font-size:13px">{{ getOppName(wonQuoteData.oppId) }}</span>
            </div>
          </div>
          
          <!-- 收货信息 -->
          <div style="background:linear-gradient(135deg,#f8f9fa 0%,#fff 100%);border-radius:16px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04)">
            <div style="font-size:14px;font-weight:700;color:#333;margin-bottom:20px;display:flex;align-items:center;gap:8px">📦 <span>收货信息</span></div>
            <div style="display:grid;gap:16px">
              <div>
                <label style="display:block;font-size:13px;font-weight:500;color:#555;margin-bottom:8px">📍 收货地址 <span style="color:#ff4d4f">*</span></label>
                <input class="form-control" style="padding:12px 14px;font-size:14px;border-radius:10px" v-model="wonDeliveryForm.addr" placeholder="请输入详细收货地址（省市区+街道门牌号）" />
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div>
                  <label style="display:block;font-size:13px;font-weight:500;color:#555;margin-bottom:8px">👤 联系人 <span style="color:#ff4d4f">*</span></label>
                  <input class="form-control" style="padding:12px 14px;font-size:14px;border-radius:10px" v-model="wonDeliveryForm.contact" placeholder="请输入联系人姓名" />
                </div>
                <div>
                  <label style="display:block;font-size:13px;font-weight:500;color:#555;margin-bottom:8px">📞 联系电话 <span style="color:#ff4d4f">*</span></label>
                  <input class="form-control" style="padding:12px 14px;font-size:14px;border-radius:10px" v-model="wonDeliveryForm.phone" placeholder="请输入联系电话" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="showWonConfirmModal=false">取消</button>
          <button class="btn btn-default" v-if="wonQuoteData" @click="editQuoteFromWonConfirm(wonQuoteData)">✏️ 修改报价单</button>
          <button class="btn btn-primary" @click="confirmWonAndCreateOrder" :disabled="!wonDeliveryForm.addr || !wonDeliveryForm.contact || !wonDeliveryForm.phone">
            🎉 确认报价并转订单
          </button>
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
                <span style="color:#1677ff;font-weight:600">+{{ fmt(getFeaturePrice(f.id)) }}</span>
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
                <span style="color:#1677ff;font-weight:600">{{ fmt(getFeaturePrice(f.id)) }}</span>
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
                <span style="color:#1677ff;font-weight:600">{{ fmt(getFeaturePrice(fid)) }}</span>
              </div>
            </div>
            
            <div v-if="inlineCustomFeatures.length" style="margin-bottom:12px;padding:10px 12px;background:#fff;border-radius:8px">
              <div style="font-size:12px;color:#888;margin-bottom:6px">自选功能</div>
              <div v-for="fid in inlineCustomFeatures" :key="fid" style="display:flex;justify-content:space-between;font-size:13px">
                <span>{{ getFeatureName(fid) }}</span>
                <span style="color:#1677ff;font-weight:600">{{ fmt(getFeaturePrice(fid)) }}</span>
              </div>
            </div>
            
            <div v-if="inlineSelectedHardware.length" style="margin-bottom:12px;padding:10px 12px;background:#fff;border-radius:8px">
              <div style="font-size:12px;color:#888;margin-bottom:6px">硬件设备</div>
              <div v-for="hid in inlineSelectedHardware" :key="hid" style="display:flex;justify-content:space-between;font-size:13px">
                <span>{{ getHardwareName(hid) }}</span>
                <span style="color:#fa8c16;font-weight:600">{{ fmt(getHardwarePrice(hid)) }}</span>
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
            <div style="font-weight:600;font-size:15px">{{ quoteDetailData?.endpoints }} 台</div>
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
        <!-- 明细表格 -->
        <div style="background:#fff;border:1px solid #e8e8e8;border-radius:10px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#fafafa">
                <th style="padding:12px 16px;text-align:left;font-size:12px;color:#888;font-weight:600">项目名称</th>
                <th style="padding:12px 16px;text-align:center;font-size:12px;color:#888;font-weight:600">类型</th>
                <th style="padding:12px 16px;text-align:center;font-size:12px;color:#888;font-weight:600">数量</th>
                <th style="padding:12px 16px;text-align:right;font-size:12px;color:#888;font-weight:600">单价(元/年)</th>
                <th style="padding:12px 16px;text-align:right;font-size:12px;color:#888;font-weight:600">小计(元/年)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in quoteDetailItems" :key="idx" style="border-top:1px solid #f0f0f0">
                <td style="padding:12px 16px;font-size:13px;font-weight:500">{{ item.name }}</td>
                <td style="padding:12px 16px;text-align:center">
                  <span class="tag" :class="item.type === '硬件' ? 'tag-orange' : 'tag-blue'" style="font-size:11px">{{ item.type }}</span>
                </td>
                <td style="padding:12px 16px;text-align:center;font-size:13px">{{ item.qty }}</td>
                <td style="padding:12px 16px;text-align:right;font-size:13px;font-weight:500">{{ fmt(item.unitPrice) }}</td>
                <td style="padding:12px 16px;text-align:right;font-size:13px;font-weight:600;color:#1677ff">{{ fmt(item.subtotal) }}</td>
              </tr>
              <tr v-if="!quoteDetailItems.length">
                <td colspan="5" style="padding:24px;text-align:center;color:#aaa">暂无明细数据</td>
              </tr>
            </tbody>
            <tfoot>
              <tr style="background:#f0f7ff">
                <td colspan="4" style="padding:14px 16px;text-align:right;font-size:14px;font-weight:700;color:#333">报价总额（含税）</td>
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
    const currentPage = ref(1);
    const pageSize = ref(10);
    
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
    
    // 产品价格查询辅助函数
    function getPackagePrice(pkg, endpoints) {
      if (!pkg) return 0;
      const qty = endpoints || 100;
      const tier = pkg.pricingTiers?.find(t => qty >= t.minQty && qty <= (t.maxQty || Infinity));
      if (tier) return tier.price * qty;
      const price = pkg.prices?.[0]?.price || pkg.price || 0;
      return price * qty;
    }
    function getFeaturePrice(fid) {
      const f = allFeatures.value.find(x => x.id === fid);
      if (!f) return 0;
      const ep = inlineQuoteForm.endpoints || 100;
      const tier = f.pricingTiers?.find(t => ep >= t.minQty && ep <= (t.maxQty || Infinity));
      if (tier) return tier.price * ep;
      return (f.prices?.[0]?.price || 0) * ep;
    }
    function getFeatureName(fid) {
      return allFeatures.value.find(x => x.id === fid)?.name || fid;
    }
    function getHardwarePrice(hid) {
      return publishedHardware.value.find(x => x.id === hid)?.priceFixed || 0;
    }
    function getHardwareName(hid) {
      return publishedHardware.value.find(x => x.id === hid)?.name || hid;
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
    
    // 报价单详情弹窗
    const showQuoteDetailModal = ref(false);
    const quoteDetailData = ref(null);
    const quoteDetailItems = ref([]);
    
    // 打开报价单详情弹窗
    function openQuoteDetailModal(quoteId) {
      const quote = store.quotes.find(q => q.id === quoteId);
      if (!quote) {
        alert('未找到报价单');
        return;
      }
      quoteDetailData.value = quote;
      // 构建明细项
      const items = [];
      const ep = quote.endpoints || 100;
      // 处理功能
      (quote.products || []).forEach(pid => {
        const feat = allFeatures.value.find(f => f.id === pid);
        if (feat) {
          const tier = feat.pricingTiers?.find(t => ep >= t.minQty && ep <= (t.maxQty || Infinity));
          const unitPrice = tier ? tier.price : (feat.prices?.[0]?.price || 0);
          items.push({ name: feat.name, type: '功能', qty: ep, unitPrice, subtotal: unitPrice * ep });
        }
      });
      // 处理硬件
      (quote.hardwareIds || []).forEach(hid => {
        const hw = publishedHardware.value.find(h => h.id === hid);
        if (hw) {
          items.push({ name: hw.name, type: '硬件', qty: 1, unitPrice: hw.priceFixed || 0, subtotal: hw.priceFixed || 0 });
        }
      });
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
      let total = inlinePackagePrice.value;
      for (const fid of inlineSupplementFeatures.value) total += getFeaturePrice(fid);
      for (const fid of inlineCustomFeatures.value) total += getFeaturePrice(fid);
      return total;
    });
    const inlineHardwareTotal = computed(() => {
      return inlineSelectedHardware.value.reduce((sum, hid) => sum + getHardwarePrice(hid), 0);
    });
    const inlineGrandTotal = computed(() => inlineSubTotal.value + inlineHardwareTotal.value);
    const inlineCanSave = computed(() => {
      if (inlineQuoteMode.value === 'package') return !!inlineSelectedPackageId.value;
      if (inlineQuoteMode.value === 'supplement') return !!inlineSelectedPackageId.value;
      if (inlineQuoteMode.value === 'custom') return inlineCustomFeatures.value.length > 0;
      return false;
    });
    
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
    
    // 获取商机名称
    function getOppName(oppId) {
      const opp = store.opportunities.find(o => o.id === oppId);
      return opp ? opp.name : oppId;
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
    
    // 商机转报价（跳转到新建报价页面，带上商机ID）
    function goToQuoteFromOpp(o) {
      router.push('/quote/new?oppId=' + o.id + '&customer=' + encodeURIComponent(o.customer) + '&regId=' + (o.regId || ''));
      detail.value = null;
    }

    // 区域管理员隔离
    const adminRegion = computed(() => store.user?.role === 'admin' ? store.user.region : '');
    // 员工隔离
    const userId = computed(() => store.user?.id || '');
    const isStaff = computed(() => store.user?.role === 'staff');
    const isAdmin = computed(() => store.user?.role === 'admin' || store.user?.role === 'superadmin');
    
    // 分页相关
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
        pages.push(1);
        if (cur > 3) pages.push('...');
        for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
        if (cur < total - 2) pages.push('...');
        pages.push(total);
      }
      return pages;
    });
    function prevPage() { if (currentPage.value > 1) currentPage.value--; }
    function nextPage() { if (currentPage.value < totalPages.value) currentPage.value++; }
    function goToPage(p) { if (p !== '...' && p >= 1 && p <= totalPages.value) currentPage.value = p; }
    function resetPage() { currentPage.value = 1; }
    
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
      } catch (err) {
        console.error('加载商机列表失败:', err);
      } finally {
        loading.value = false;
      }
    }
    
    // 页面加载时获取商机列表
    onMounted(() => {
      loadOpportunities();
      loadProductCatalog(); // 加载产品目录（供内嵌报价单使用）
    });

    // 已审批客户列表（用于筛选下拉）- 区域管理员只看本区域，员工只看自己的
    const approvedRegs = computed(() => {
      let list = store.registrations.filter(r => r.status === 'approved');
      if (isStaff.value) {
        return list.filter(r => r.owner === userId.value);
      }
      if (adminRegion.value) {
        return list.filter(r => r.region === adminRegion.value);
      }
      return list;
    });

    // 本区域商机（管理员）或本人的商机（员工）
    const myOpportunities = computed(() => {
      if (isStaff.value) {
        // 员工只能看到自己创建的商机
        return store.opportunities.filter(o => o.ownerId === userId.value);
      }
      if (adminRegion.value) {
        // 区域管理员看本区域商机（优先使用商机自身的region字段，其次从报备中查找）
        return store.opportunities.filter(o => {
          // 优先使用商机自身的region字段（后端API返回的数据）
          if (o.region) {
            return o.region === adminRegion.value;
          }
          // 兼容旧数据：从报备中查找区域
          const region = getRegRegion(o.regId);
          return region === adminRegion.value;
        });
      }
      // 超级管理员看全部
      return store.opportunities;
    });

    const filtered = computed(() => {
      resetPage();
      return myOpportunities.value.filter(o => {
        const mK = !kw.value || o.name.includes(kw.value) || o.customer.includes(kw.value);
        const mS = !stageFilter.value || o.stage === stageFilter.value;
        const mC = !customerFilter.value || o.regId === customerFilter.value;
        return mK && mS && mC;
      });
    });

    function byStage(stage) { return myOpportunities.value.filter(o=>o.stage===stage); }
    function isOverdue(o) {
      return !['won','lost'].includes(o.stage) && new Date(o.expectedClose) < new Date();
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
    function openDetail(o) { detail.value = o; }
    function openFollow(o) {
      followTarget.value = o;
      followForm.type = '电话'; followForm.date = today(); followForm.content = ''; followForm.newStage = ''; followForm.nextDate = '';
    }
    async function saveFollow() {
      const targetStage = followForm.newStage;
      const opp = followTarget.value; // 保存当前商机引用
      
      const newFollow = {
        id: Date.now(),
        date: followForm.date,
        type: followForm.type,
        content: followForm.content,
        user: store.user?.name?.slice(0,4) || '销售',
      };
      
      // 检查是否有关联报价单
      const hasQuote = !!opp.quoteId;
      
      // 推进到方案报价阶段时，如果没有报价单，提示创建
      if (targetStage === 'proposal' && !hasQuote) {
        if (confirm(`商机将推进到"方案报价"阶段，建议先创建报价单。\n\n点击"确定"立即创建报价单，点击"取消"继续保存跟进记录。`)) {
          // 先保存跟进记录，再跳转到报价页面
          opp.followUps.unshift(newFollow);
          opp.lastFollowAt = followForm.date;
          try {
            await apiClient.updateOpportunity(opp.id, {
              followUps: opp.followUps,
              lastFollowAt: followForm.date,
              stage: targetStage
            });
          } catch (err) {}
          store.notifications.unshift({ id:Date.now(), title:'跟进记录已保存', desc:`${opp.name} — ${followForm.type}跟进`, time:'刚刚', unread:true });
          followTarget.value = null;
          router.push('/quote/new?oppId=' + opp.id + '&customer=' + encodeURIComponent(opp.customer) + '&regId=' + (opp.regId || ''));
          return;
        }
      }
      
      // 推进到赢单/签约中时，如果没有报价单，提示创建
      if (['closing', 'won'].includes(targetStage) && !hasQuote) {
        if (confirm(`商机将标记为"${stageLabel(targetStage)}"，建议先创建报价单。\n\n点击"确定"立即创建报价单，点击"取消"继续保存跟进记录。`)) {
          opp.followUps.unshift(newFollow);
          opp.lastFollowAt = followForm.date;
          try {
            await apiClient.updateOpportunity(opp.id, {
              followUps: opp.followUps,
              lastFollowAt: followForm.date,
              stage: targetStage
            });
          } catch (err) {}
          store.notifications.unshift({ id:Date.now(), title:'跟进记录已保存', desc:`${opp.name} — ${followForm.type}跟进`, time:'刚刚', unread:true });
          followTarget.value = null;
          router.push('/quote/new?oppId=' + opp.id + '&customer=' + encodeURIComponent(opp.customer) + '&regId=' + (opp.regId || ''));
          return;
        }
      }
      
      // 推进到赢单/签约中时，如果有报价单，提示确认报价后转订单
      if (['closing', 'won'].includes(targetStage) && hasQuote) {
        if (confirm(`商机将标记为"${stageLabel(targetStage)}"，是否确认报价单并转订单？\n\n点击"确定"打开报价单确认页面，点击"取消"继续保存跟进记录。`)) {
          opp.followUps.unshift(newFollow);
          opp.lastFollowAt = followForm.date;
          opp.stage = targetStage;
          try {
            await apiClient.updateOpportunity(opp.id, {
              followUps: opp.followUps,
              lastFollowAt: followForm.date,
              stage: targetStage
            });
          } catch (err) {}
          store.notifications.unshift({ id:Date.now(), title:'跟进记录已保存', desc:`${opp.name} — ${followForm.type}跟进`, time:'刚刚', unread:true });
          followTarget.value = null;
          // 打开赢单确认弹窗
          openWonConfirmModal(opp);
          return;
        }
      }
      
      // 默认逻辑：直接保存跟进记录
      opp.followUps.unshift(newFollow);
      opp.lastFollowAt = followForm.date;
      if (targetStage) opp.stage = targetStage;
      
      try {
        const result = await apiClient.updateOpportunity(opp.id, {
          followUps: opp.followUps,
          lastFollowAt: followForm.date,
          stage: targetStage || opp.stage
        });
        if (!result.success) {
          console.error('保存跟进记录失败:', result.error);
        }
      } catch (err) {
        console.error('保存跟进记录失败:', err);
      }
      
      store.notifications.unshift({ id:Date.now(), title:'跟进记录已保存', desc:`${opp.name} — ${followForm.type}跟进`, time:'刚刚', unread:true });
      followTarget.value = null;
      // 同步更新列表数据和详情数据
      const idx = store.opportunities.findIndex(x => x.id === opp.id);
      if (idx !== -1) Object.assign(store.opportunities[idx], opp);
      if (detail.value && detail.value.id === opp.id) Object.assign(detail.value, opp);
    }
    return { store, adminRegion, isAdmin, isStaff, filtered, paginatedData, viewMode, kw, stageFilter, customerFilter, approvedRegs, detail, followTarget, followForm, loading,
      STAGES, byStage, isOverdue, openDetail, openFollow, saveFollow, loadOpportunities,
      fmt, stageLabel, stageDot, stageTagClass, probColor,
      currentPage, totalPages, pageNumbers, prevPage, nextPage, goToPage, changeStage,
      // 商机转订单
      showDeliveryModal, deliveryForm, openToOrderFromOpp, confirmToOrderFromOpp, goToQuoteFromOpp,
      // 赢单确认
      showWonConfirmModal, wonDeliveryForm, currentWonOpp, wonQuoteData, openWonConfirmModal, editQuoteFromWonConfirm, confirmWonAndCreateOrder,
      // 内嵌报价单
      showInlineQuote, inlineQuoteOpp, inlineQuoteForm, inlineQuoteMode, inlineSelectedPackageId, inlineSelectedPackage,
      inlineSupplementFeatures, inlineCustomFeatures, inlineSelectedHardware,
      inlinePackagePrice, inlineSubTotal, inlineHardwareTotal, inlineGrandTotal, inlineCanSave,
      openInlineQuoteModal, noQuoteAlert, inlineQuoteSetMode, inlineSelectPackage, toggleInlineSupplement, toggleInlineCustom, toggleInlineHardware, saveInlineQuote,
      // 报价单详情
      showQuoteDetailModal, quoteDetailData, quoteDetailItems, openQuoteDetailModal,
      // 工具函数
      getOppName, allFeatures, publishedPackages, publishedHardware, getFeatureName, getFeaturePrice, getHardwareName, getHardwarePrice, getPackagePrice
    };
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

      <!-- 指派渠道区域 -->
      <div style="background:#f6f8ff;border:1.5px solid #d0e4ff;border-radius:10px;padding:16px 18px;margin-bottom:22px">
        <div style="font-size:13px;font-weight:700;color:#1677ff;margin-bottom:12px">🏢 指派跟进渠道</div>
        
        <!-- 渠道选择 -->
        <div class="form-item full" style="margin-bottom:16px">
          <label class="form-label required">渠道合作伙伴</label>
          <select class="form-control" v-model="selectedPartnerId" @change="onPartnerChange">
            <option value="">请选择渠道合作伙伴</option>
            <option v-for="p in regionPartners" :key="p.id" :value="p.id">{{ p.name }} ({{ p.level }})</option>
          </select>
          <p v-if="regionPartners.length === 0 && !loadingPartners" style="font-size:12px;color:#999;margin-top:6px">本区域暂无渠道合作伙伴，请先添加渠道商</p>
        </div>
        
        <!-- 员工选择 -->
        <div class="form-item full" v-if="selectedPartnerId">
          <label class="form-label required">指派跟进员工</label>
          <select class="form-control" v-model="selectedStaffId">
            <option value="">请选择跟进员工</option>
            <option v-for="s in selectedPartnerStaff" :key="s.id" :value="s.id">{{ s.name }} ({{ s.role }})</option>
          </select>
          <p v-if="selectedPartnerStaff.length === 0" style="font-size:12px;color:#999;margin-top:6px">该渠道商暂无员工，请先在渠道商管理中添加员工</p>
        </div>
        
        <!-- 已选信息展示 -->
        <div v-if="selectedPartnerId && selectedStaffId" style="margin-top:14px;padding:12px;background:#fff;border-radius:8px;border:1px solid #e0e0e0">
          <div style="font-size:12px;color:#888;margin-bottom:8px">已指派：</div>
          <div style="display:flex;gap:20px;flex-wrap:wrap">
            <div>
              <div style="font-size:11px;color:#888">渠道商</div>
              <div style="font-size:13px;font-weight:600">{{ selectedPartner?.name }}</div>
            </div>
            <div>
              <div style="font-size:11px;color:#888">跟进员工</div>
              <div style="font-size:13px;font-weight:600">{{ selectedStaff?.name }}</div>
            </div>
            <div>
              <div style="font-size:11px;color:#888">员工电话</div>
              <div style="font-size:13px;font-weight:600">{{ selectedStaff?.phone || '-' }}</div>
            </div>
          </div>
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
    const userId = computed(() => store.user?.id || '');
    const isStaff = computed(() => store.user?.role === 'staff');
    
    // 已审批报备客户列表（员工只能看到自己创建的报备）
    const approvedRegs = computed(() => {
      const list = store.registrations.filter(r => r.status === 'approved');
      if (isStaff.value) {
        return list.filter(r => r.owner === userId.value);
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
      amount:0, endpoints:0, expectedClose:'', source:'渠道推荐', owner:'',
      tags:[], notes:'', firstFollow:'',
    });
    const tagInput = ref('');
    
    // ========== 渠道指派相关 ==========
    const regionPartners = ref([]);
    const selectedPartnerId = ref('');
    const selectedStaffId = ref('');
    const loadingPartners = ref(false);
    
    // 加载本区域渠道合作伙伴
    async function loadPartners() {
      loadingPartners.value = true;
      try {
        const result = await apiClient.getPartners({ status: 'active' });
        if (result.success) {
          regionPartners.value = result.data || [];
        }
      } catch (err) {
        console.error('加载渠道商失败:', err);
      } finally {
        loadingPartners.value = false;
      }
    }
    
    // 当前选中的渠道商
    const selectedPartner = computed(() => {
      return regionPartners.value.find(p => p.id === selectedPartnerId.value);
    });
    
    // 当前选中渠道商的员工列表
    const selectedPartnerStaff = computed(() => {
      return selectedPartner.value?.staff || [];
    });
    
    // 当前选中的员工
    const selectedStaff = computed(() => {
      return selectedPartnerStaff.value.find(s => s.id === selectedStaffId.value);
    });
    
    // 渠道选择变化时清空员工选择
    function onPartnerChange() {
      selectedStaffId.value = '';
    }
    
    // 页面加载时获取渠道列表
    onMounted(() => {
      const regId = route.query.regId;
      if (regId) {
        const reg = store.registrations.find(r => r.id === regId);
        if (reg && reg.status === 'approved') selectReg(reg);
      }
      // 加载本区域渠道商
      loadPartners();
    });
    
    const canSubmit = computed(() => form.name && selectedReg.value && selectedPartnerId.value && selectedStaffId.value);
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
          contact: reg.contact,
          phone: reg.phone,
          stage: form.stage,
          amount: form.amount,
          endpoints: form.endpoints,
          source: form.source,
          owner: form.owner,
          ownerId: userId.value,
          createdBy: store.user.id,      // 统一使用员工ID，与过滤逻辑一致
          expectedClose: form.expectedClose,
          regId: reg.id,
          quoteId: null,
          tags: [...form.tags],
          notes: form.notes,
          followUps,
          // 指派渠道信息
          assignedPartnerId: selectedPartnerId.value,
          assignedPartnerName: selectedPartner.value?.name || '',
          assignedStaffId: selectedStaffId.value,
          assignedStaffName: selectedStaff.value?.name || ''
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
      customerSearch, showDropdown, selectedReg, filteredRegs, existingOpps,
      selectReg, clearReg, onBlurSearch, goRegNew, isExpiring,
      fmt, stageLabel, stageTagClass,
      // 渠道指派相关
      regionPartners, selectedPartnerId, selectedStaffId, loadingPartners,
      selectedPartner, selectedPartnerStaff, selectedStaff, onPartnerChange
    };
  }
};

// ── 商机导入 ─────────────────────────────────────────────────
const OpportunityImport = {
  template: `
  <div>
    <div class="card" style="margin-bottom:20px">
      <div style="padding:20px">
        <h3 style="margin:0 0 8px 0">商机导入</h3>
        <p style="color:#888;font-size:13px;margin:0">
          导入商机数据。必填：商机名称、客户名称、负责员工姓名、所属渠道商名称。<br/>
          <strong style="color:#ff4d4f">注意：客户必须先完成报备，否则导入会失败。</strong>
        </p>
      </div>
    </div>
    
    <div class="card">
      <div style="padding:20px">
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">
          <button class="btn btn-default" @click="downloadTemplate">📥 下载导入模板</button>
          <label class="btn btn-primary" style="cursor:pointer">
            📤 上传Excel文件
            <input type="file" accept=".xlsx,.xls" @change="onFileSelect" style="display:none" />
          </label>
          <span v-if="fileName" style="color:#666;font-size:13px">已选择: {{ fileName }}</span>
        </div>
        
        <div v-if="previewData.length" style="margin-top:20px">
          <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:600">预览数据（共 {{ totalCount }} 条）</span>
            <button class="btn btn-primary" @click="doImport" :disabled="importing">{{ importing ? '导入中...' : '确认导入' }}</button>
          </div>
          
          <div class="table-wrap" style="overflow-x:auto">
            <table style="min-width:1000px">
              <thead><tr><th>行号</th><th v-for="h in headers" :key="h">{{ h }}</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="item in previewData" :key="item.rowIndex" :style="{background: item.errors.length ? '#fff2f0' : '#f6ffed'}">
                  <td>{{ item.rowIndex }}</td>
                  <td v-for="(v, k) in item.data" :key="k">{{ v || '-' }}</td>
                  <td>
                    <span v-if="item.errors.length" style="color:#ff4d4f;font-size:12px">{{ item.errors[0] }}</span>
                    <span v-else style="color:#52c41a;font-size:12px">✓ 正常</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div v-if="result" style="margin-top:20px">
          <div :style="{padding:'16px',borderRadius:'8px',background: result.results?.failed ? '#fff2f0' : '#f6ffed',border:'1px solid',borderColor: result.results?.failed ? '#ffccc7' : '#b7eb8f'}">
            <div style="font-weight:600;margin-bottom:8px" :style="{color: result.results?.failed ? '#cf1322' : '#389e0d'}">{{ result.message }}</div>
            <div style="font-size:13px;color:#666">
              <div>新增: {{ result.results?.success || 0 }} 条 | 更新: {{ result.results?.updated || 0 }} 条 | 失败: {{ result.results?.failed || 0 }} 条</div>
            </div>
            <div v-if="result.results?.errors?.length" style="margin-top:12px">
              <div style="font-weight:600;color:#cf1322;margin-bottom:8px">失败详情:</div>
              <div v-for="err in result.results.errors.slice(0, 20)" :key="err.row" style="font-size:12px;color:#cf1322;margin-bottom:4px">第{{ err.row }}行: {{ err.message }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  setup() {
    const type = 'opportunities';
    const fileName = ref('');
    const selectedFile = ref(null);
    const previewData = ref([]);
    const headers = ref([]);
    const totalCount = ref(0);
    const result = ref(null);
    const importing = ref(false);
    
    async function downloadTemplate() {
      try {
        const apiBase = window.location.origin.replace(':8080', ':3000');
        const response = await fetch(`${apiBase}/api/import/${type}/template`);
        if (!response.ok) throw new Error('下载失败');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '商机导入模板.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (err) { alert('下载模板失败: ' + err.message); }
    }
    
    async function onFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      fileName.value = file.name;
      selectedFile.value = file;
      result.value = null;
      importing.value = false;
      
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const apiBase = window.location.origin.replace(':8080', ':3000');
        const response = await fetch(`${apiBase}/api/import/${type}/preview`, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
          previewData.value = data.preview;
          headers.value = data.headers;
          totalCount.value = data.totalCount;
        } else {
          alert(data.error || '预览失败');
          fileName.value = '';
          selectedFile.value = null;
        }
      } catch (err) {
        alert('预览失败: ' + err.message);
        fileName.value = '';
        selectedFile.value = null;
      }
    }
    
    async function doImport() {
      if (!selectedFile.value) { alert('请先选择文件'); return; }
      if (!confirm(`确认导入 ${totalCount.value} 条数据？`)) return;
      importing.value = true;
      
      const formData = new FormData();
      formData.append('file', selectedFile.value);
      formData.append('userId', store.user?.id);
      formData.append('userRole', store.user?.role);
      
      try {
        const apiBase = window.location.origin.replace(':8080', ':3000');
        const response = await fetch(`${apiBase}/api/import/${type}/execute`, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
          result.value = data;
          previewData.value = [];
          fileName.value = '';
          selectedFile.value = null;
          // 刷新全局数据
          if (typeof refreshStoreData === 'function') refreshStoreData();
        } else {
          alert(data.error || '导入失败');
        }
      } catch (err) { alert('导入失败: ' + err.message); }
      finally { importing.value = false; }
    }
    
    return { fileName, previewData, headers, totalCount, result, importing, downloadTemplate, onFileSelect, doImport };
  }
};

// ── 客户报备导入 ─────────────────────────────────────────────
const RegistrationImport = {
  template: `
  <div>
    <div class="card" style="margin-bottom:20px">
      <div style="padding:20px">
        <h3 style="margin:0 0 8px 0">客户报备导入</h3>
        <p style="color:#888;font-size:13px;margin:0">导入客户报备数据。必填：客户名称、负责员工姓名、所属渠道商名称。</p>
      </div>
    </div>
    <div class="card">
      <div style="padding:20px">
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">
          <button class="btn btn-default" @click="downloadTemplate">📥 下载导入模板</button>
          <label class="btn btn-primary" style="cursor:pointer">
            📤 上传Excel文件
            <input type="file" accept=".xlsx,.xls" @change="onFileSelect" style="display:none" />
          </label>
          <span v-if="fileName" style="color:#666;font-size:13px">已选择: {{ fileName }}</span>
        </div>
        <div v-if="previewData.length" style="margin-top:20px">
          <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:600">预览数据（共 {{ totalCount }} 条）</span>
            <button class="btn btn-primary" @click="doImport" :disabled="importing">{{ importing ? '导入中...' : '确认导入' }}</button>
          </div>
          <div class="table-wrap" style="overflow-x:auto">
            <table style="min-width:800px">
              <thead><tr><th>行号</th><th v-for="h in headers" :key="h">{{ h }}</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="item in previewData" :key="item.rowIndex" :style="{background: item.errors.length ? '#fff2f0' : '#f6ffed'}">
                  <td>{{ item.rowIndex }}</td>
                  <td v-for="(v, k) in item.data" :key="k">{{ v || '-' }}</td>
                  <td><span v-if="item.errors.length" style="color:#ff4d4f;font-size:12px">{{ item.errors[0] }}</span><span v-else style="color:#52c41a;font-size:12px">✓ 正常</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-if="result" style="margin-top:20px">
          <div :style="{padding:'16px',borderRadius:'8px',background: result.results?.failed ? '#fff2f0' : '#f6ffed',border:'1px solid',borderColor: result.results?.failed ? '#ffccc7' : '#b7eb8f'}">
            <div style="font-weight:600;margin-bottom:8px" :style="{color: result.results?.failed ? '#cf1322' : '#389e0d'}">{{ result.message }}</div>
            <div style="font-size:13px;color:#666">新增: {{ result.results?.success || 0 }} 条 | 更新: {{ result.results?.updated || 0 }} 条 | 失败: {{ result.results?.failed || 0 }} 条</div>
            <div v-if="result.results?.errors?.length" style="margin-top:12px;font-size:12px;color:#cf1322">
              <div v-for="err in result.results.errors.slice(0, 20)" :key="err.row" style="margin-bottom:4px">第{{ err.row }}行: {{ err.message }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  setup() {
    const type = 'registrations';
    const fileName = ref('');
    const selectedFile = ref(null);
    const previewData = ref([]);
    const headers = ref([]);
    const totalCount = ref(0);
    const result = ref(null);
    const importing = ref(false);
    
    async function downloadTemplate() {
      try {
        const apiBase = window.location.origin.replace(':8080', ':3000');
        const response = await fetch(`${apiBase}/api/import/${type}/template`);
        if (!response.ok) throw new Error('下载失败');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '客户报备导入模板.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (err) { alert('下载模板失败: ' + err.message); }
    }
    
    async function onFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      fileName.value = file.name;
      selectedFile.value = file;
      result.value = null;
      importing.value = false;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const apiBase = window.location.origin.replace(':8080', ':3000');
        const response = await fetch(`${apiBase}/api/import/${type}/preview`, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
          previewData.value = data.preview;
          headers.value = data.headers;
          totalCount.value = data.totalCount;
        } else {
          alert(data.error || '预览失败');
          fileName.value = '';
          selectedFile.value = null;
        }
      } catch (err) { alert('预览失败: ' + err.message); fileName.value = ''; selectedFile.value = null; }
    }
    
    async function doImport() {
      if (!selectedFile.value) { alert('请先选择文件'); return; }
      if (!confirm(`确认导入 ${totalCount.value} 条数据？`)) return;
      importing.value = true;
      const formData = new FormData();
      formData.append('file', selectedFile.value);
      formData.append('userId', store.user?.id);
      formData.append('userRole', store.user?.role);
      try {
        const apiBase = window.location.origin.replace(':8080', ':3000');
        const response = await fetch(`${apiBase}/api/import/${type}/execute`, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
          result.value = data;
          previewData.value = [];
          fileName.value = '';
          selectedFile.value = null;
          if (typeof refreshStoreData === 'function') refreshStoreData();
        } else { alert(data.error || '导入失败'); }
      } catch (err) { alert('导入失败: ' + err.message); }
      finally { importing.value = false; }
    }
    
    return { fileName, previewData, headers, totalCount, result, importing, downloadTemplate, onFileSelect, doImport };
  }
};

// ── 渠道商导入 ───────────────────────────────────────────────
const PartnerImport = {
  template: `
  <div>
    <div class="card" style="margin-bottom:20px">
      <div style="padding:20px">
        <h3 style="margin:0 0 8px 0">渠道商导入</h3>
        <p style="color:#888;font-size:13px;margin:0">导入渠道商数据。必填：渠道商名称、所在区域。</p>
      </div>
    </div>
    <div class="card">
      <div style="padding:20px">
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">
          <button class="btn btn-default" @click="downloadTemplate">📥 下载导入模板</button>
          <label class="btn btn-primary" style="cursor:pointer">
            📤 上传Excel文件
            <input type="file" accept=".xlsx,.xls" @change="onFileSelect" style="display:none" />
          </label>
          <span v-if="fileName" style="color:#666;font-size:13px">已选择: {{ fileName }}</span>
        </div>
        <div v-if="previewData.length" style="margin-top:20px">
          <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:600">预览数据（共 {{ totalCount }} 条）</span>
            <button class="btn btn-primary" @click="doImport" :disabled="importing">{{ importing ? '导入中...' : '确认导入' }}</button>
          </div>
          <div class="table-wrap" style="overflow-x:auto">
            <table style="min-width:700px">
              <thead><tr><th>行号</th><th v-for="h in headers" :key="h">{{ h }}</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="item in previewData" :key="item.rowIndex" :style="{background: item.errors.length ? '#fff2f0' : '#f6ffed'}">
                  <td>{{ item.rowIndex }}</td>
                  <td v-for="(v, k) in item.data" :key="k">{{ v || '-' }}</td>
                  <td><span v-if="item.errors.length" style="color:#ff4d4f;font-size:12px">{{ item.errors[0] }}</span><span v-else style="color:#52c41a;font-size:12px">✓ 正常</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-if="result" style="margin-top:20px">
          <div :style="{padding:'16px',borderRadius:'8px',background: result.results?.failed ? '#fff2f0' : '#f6ffed',border:'1px solid',borderColor: result.results?.failed ? '#ffccc7' : '#b7eb8f'}">
            <div style="font-weight:600;margin-bottom:8px" :style="{color: result.results?.failed ? '#cf1322' : '#389e0d'}">{{ result.message }}</div>
            <div style="font-size:13px;color:#666">新增: {{ result.results?.success || 0 }} 条 | 更新: {{ result.results?.updated || 0 }} 条 | 失败: {{ result.results?.failed || 0 }} 条</div>
            <div v-if="result.results?.errors?.length" style="margin-top:12px;font-size:12px;color:#cf1322">
              <div v-for="err in result.results.errors.slice(0, 20)" :key="err.row" style="margin-bottom:4px">第{{ err.row }}行: {{ err.message }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  setup() {
    const type = 'partners';
    const fileName = ref('');
    const selectedFile = ref(null);
    const previewData = ref([]);
    const headers = ref([]);
    const totalCount = ref(0);
    const result = ref(null);
    const importing = ref(false);
    
    async function downloadTemplate() {
      try {
        const apiBase = window.location.origin.replace(':8080', ':3000');
        const response = await fetch(`${apiBase}/api/import/${type}/template`);
        if (!response.ok) throw new Error('下载失败');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '渠道商导入模板.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (err) { alert('下载模板失败: ' + err.message); }
    }
    
    async function onFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      fileName.value = file.name;
      selectedFile.value = file;
      result.value = null;
      importing.value = false;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const apiBase = window.location.origin.replace(':8080', ':3000');
        const response = await fetch(`${apiBase}/api/import/${type}/preview`, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
          previewData.value = data.preview;
          headers.value = data.headers;
          totalCount.value = data.totalCount;
        } else {
          alert(data.error || '预览失败');
          fileName.value = '';
          selectedFile.value = null;
        }
      } catch (err) { alert('预览失败: ' + err.message); fileName.value = ''; selectedFile.value = null; }
    }
    
    async function doImport() {
      if (!selectedFile.value) { alert('请先选择文件'); return; }
      if (!confirm(`确认导入 ${totalCount.value} 条数据？`)) return;
      importing.value = true;
      const formData = new FormData();
      formData.append('file', selectedFile.value);
      formData.append('userId', store.user?.id);
      formData.append('userRole', store.user?.role);
      try {
        const apiBase = window.location.origin.replace(':8080', ':3000');
        const response = await fetch(`${apiBase}/api/import/${type}/execute`, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
          result.value = data;
          previewData.value = [];
          fileName.value = '';
          selectedFile.value = null;
          if (typeof refreshStoreData === 'function') refreshStoreData();
        } else { alert(data.error || '导入失败'); }
      } catch (err) { alert('导入失败: ' + err.message); }
      finally { importing.value = false; }
    }
    
    return { fileName, previewData, headers, totalCount, result, importing, downloadTemplate, onFileSelect, doImport };
  }
};

// ── 员工导入 ─────────────────────────────────────────────────
const StaffImport = {
  template: `
  <div>
    <div class="card" style="margin-bottom:20px">
      <div style="padding:20px">
        <h3 style="margin:0 0 8px 0">员工导入</h3>
        <p style="color:#888;font-size:13px;margin:0">导入员工账号数据。必填：登录账号、员工姓名、所属渠道商名称、密码。</p>
      </div>
    </div>
    <div class="card">
      <div style="padding:20px">
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">
          <button class="btn btn-default" @click="downloadTemplate">📥 下载导入模板</button>
          <label class="btn btn-primary" style="cursor:pointer">
            📤 上传Excel文件
            <input type="file" accept=".xlsx,.xls" @change="onFileSelect" style="display:none" />
          </label>
          <span v-if="fileName" style="color:#666;font-size:13px">已选择: {{ fileName }}</span>
        </div>
        <div v-if="previewData.length" style="margin-top:20px">
          <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:600">预览数据（共 {{ totalCount }} 条）</span>
            <button class="btn btn-primary" @click="doImport" :disabled="importing">{{ importing ? '导入中...' : '确认导入' }}</button>
          </div>
          <div class="table-wrap" style="overflow-x:auto">
            <table style="min-width:700px">
              <thead><tr><th>行号</th><th v-for="h in headers" :key="h">{{ h }}</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="item in previewData" :key="item.rowIndex" :style="{background: item.errors.length ? '#fff2f0' : '#f6ffed'}">
                  <td>{{ item.rowIndex }}</td>
                  <td v-for="(v, k) in item.data" :key="k">{{ v || '-' }}</td>
                  <td><span v-if="item.errors.length" style="color:#ff4d4f;font-size:12px">{{ item.errors[0] }}</span><span v-else style="color:#52c41a;font-size:12px">✓ 正常</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-if="result" style="margin-top:20px">
          <div :style="{padding:'16px',borderRadius:'8px',background: result.results?.failed ? '#fff2f0' : '#f6ffed',border:'1px solid',borderColor: result.results?.failed ? '#ffccc7' : '#b7eb8f'}">
            <div style="font-weight:600;margin-bottom:8px" :style="{color: result.results?.failed ? '#cf1322' : '#389e0d'}">{{ result.message }}</div>
            <div style="font-size:13px;color:#666">新增: {{ result.results?.success || 0 }} 条 | 更新: {{ result.results?.updated || 0 }} 条 | 失败: {{ result.results?.failed || 0 }} 条</div>
            <div v-if="result.results?.errors?.length" style="margin-top:12px;font-size:12px;color:#cf1322">
              <div v-for="err in result.results.errors.slice(0, 20)" :key="err.row" style="margin-bottom:4px">第{{ err.row }}行: {{ err.message }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  setup() {
    const type = 'staff';
    const fileName = ref('');
    const selectedFile = ref(null);
    const previewData = ref([]);
    const headers = ref([]);
    const totalCount = ref(0);
    const result = ref(null);
    const importing = ref(false);
    
    async function downloadTemplate() {
      try {
        const apiBase = window.location.origin.replace(':8080', ':3000');
        const response = await fetch(`${apiBase}/api/import/${type}/template`);
        if (!response.ok) throw new Error('下载失败');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '员工导入模板.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (err) { alert('下载模板失败: ' + err.message); }
    }
    
    async function onFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      fileName.value = file.name;
      selectedFile.value = file;
      result.value = null;
      importing.value = false;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const apiBase = window.location.origin.replace(':8080', ':3000');
        const response = await fetch(`${apiBase}/api/import/${type}/preview`, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
          previewData.value = data.preview;
          headers.value = data.headers;
          totalCount.value = data.totalCount;
        } else {
          alert(data.error || '预览失败');
          fileName.value = '';
          selectedFile.value = null;
        }
      } catch (err) { alert('预览失败: ' + err.message); fileName.value = ''; selectedFile.value = null; }
    }
    
    async function doImport() {
      if (!selectedFile.value) { alert('请先选择文件'); return; }
      if (!confirm(`确认导入 ${totalCount.value} 条数据？`)) return;
      importing.value = true;
      const formData = new FormData();
      formData.append('file', selectedFile.value);
      formData.append('userId', store.user?.id);
      formData.append('userRole', store.user?.role);
      try {
        const apiBase = window.location.origin.replace(':8080', ':3000');
        const response = await fetch(`${apiBase}/api/import/${type}/execute`, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
          result.value = data;
          previewData.value = [];
          fileName.value = '';
          selectedFile.value = null;
          if (typeof refreshStoreData === 'function') refreshStoreData();
        } else { alert(data.error || '导入失败'); }
      } catch (err) { alert('导入失败: ' + err.message); }
      finally { importing.value = false; }
    }
    
    return { fileName, previewData, headers, totalCount, result, importing, downloadTemplate, onFileSelect, doImport };
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
        { path: 'opportunity/import', component: OpportunityImport },
        { path: 'registration', component: RegistrationList },
        { path: 'registration/new', component: RegistrationNew },
        { path: 'registration/import', component: RegistrationImport },
        { path: 'quote', component: QuoteList },
        { path: 'quote/new', component: QuoteNew },
        { path: 'quote/edit/:id', component: QuoteNew },
        { path: 'order', component: OrderList },
        { path: 'products', component: Products },
        { path: 'partner-report', component: PartnerReport },
        { path: 'partners', component: Partners },
        { path: 'partners/import', component: PartnerImport },
        { path: 'partner-admin', component: PartnerAdminManage },
        { path: 'admin-review', component: AdminReview },
        { path: 'account-manage', component: AccountManage },
        { path: 'account-manage/staff-import', component: StaffImport },
      ]
    }
  ]
});

// ── 恢复登录状态 ─────────────────────────────────────────────
function restoreLoginState() {
  try {
    // 使用独立前缀读取登录状态
    const userInfo = localStorage.getItem('admin_user_info');
    const token = localStorage.getItem('admin_auth_token');
    if (userInfo && token) {
      const parsed = JSON.parse(userInfo);
      // 验证是管理员角色，避免读取到渠道伙伴的登录状态
      if (parsed.role === 'admin' || parsed.role === 'superadmin') {
        // 添加前缀信息（兼容旧数据）
        if (!parsed._storagePrefix) {
          parsed._storagePrefix = 'admin_';
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
    localStorage.removeItem('admin_user_info');
    localStorage.removeItem('admin_auth_token');
  }
}
restoreLoginState();

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
