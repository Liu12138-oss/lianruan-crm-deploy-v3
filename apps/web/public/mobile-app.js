/*
 * 联软渠道管理平台移动端
 * 说明：登录态由既有 api-client.js 维护；所有移动端业务请求统一走受保护的 /api/mobile 接口。
 */
(function () {
  'use strict';

  const { createApp, ref, reactive, computed, onMounted, watch } = Vue;
  const APP_PREFIX = window.APP_PREFIX || '';
  const PARTNER_ROLES = ['staff', 'partner_admin'];
  const ADMIN_ROLES = ['admin', 'superadmin'];
  const EMM_H5_SSO_ISAIDS = Object.freeze({
    partner: 'QdCRMguanlyuan123',
    admin: 'QdCRMguanlyuan123'
  });
  const EMM_H5_SSO_TIMEOUT_MS = 8000;
  const SINGLE_SIGN_ON_PATH = '/login/singlesignonlogin/login.do';
  const SINGLE_SIGN_ON_TOKEN_KEYS = ['token', 'sso_token', 'ssotoken'];
  const STATUS_TEXT = {
    pending: '待审核', reviewing: '审核中', approved: '已通过', rejected: '已驳回',
    active: '已生效', inactive: '已停用', draft: '草稿', sent: '已发送',
    pending_primary_confirm: '待一级确认', primary_confirmed: '一级已确认',
    primary_rejected: '一级已驳回', pending_superadmin_confirm: '待超管确认',
    confirmed: '已确认', converted: '已转订单', processing: '处理中', shipped: '已发货',
    completed: '已完成', cancelled: '已取消', contacted: '已联系', registered: '已报备',
    quoted: '已报价', budget: '明确预算', design: '方案设计', testing: '产品测试',
    negotiation: '商务谈判', won: '已赢单', lost: '已输单'
  };
  const STAGE_OPTIONS = [
    { value: 'contacted', label: '已联系' }, { value: 'registered', label: '已报备' },
    { value: 'quoted', label: '已报价' }, { value: 'budget', label: '明确预算' },
    { value: 'design', label: '方案设计' }, { value: 'testing', label: '产品测试' },
    { value: 'negotiation', label: '商务谈判' }, { value: 'won', label: '已赢单' },
    { value: 'lost', label: '已输单' }
  ];
  const REGISTRATION_STATUS_OPTIONS = [
    { value: 'pending', label: '待审核' }, { value: 'reviewing', label: '审核中' },
    { value: 'approved', label: '已通过' }, { value: 'rejected', label: '已驳回' }
  ];
  const FOLLOW_UP_TYPE_OPTIONS = ['电话', '拜访', '会议', '演示', '邮件', '其他'];

  function readScope() {
    return new URLSearchParams(window.location.search).get('scope') || '';
  }

  function readSingleSignOnTokenFromUrl() {
    const hash = window.location.hash || '';
    const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    const queryList = [hashQuery, window.location.search.replace(/^\?/, '')].filter(Boolean);
    for (const queryText of queryList) {
      const params = new URLSearchParams(queryText);
      for (const key of SINGLE_SIGN_ON_TOKEN_KEYS) {
        const value = (params.get(key) || '').trim();
        if (value) return value;
      }
    }
    return '';
  }

  function parseEmmPayload(data) {
    if (!data) return {};
    if (typeof data === 'string') return JSON.parse(data);
    return data;
  }

  function readErrorMessage(value, fallback = '操作失败，请稍后重试。') {
    if (!value) return fallback;
    if (value instanceof Error) return readErrorMessage(value.message, fallback);
    if (typeof value === 'string') {
      const text = value.trim();
      return text && text !== '[object Object]' ? text : fallback;
    }
    if (typeof value === 'object') {
      return (
        readErrorMessage(value.message, '') ||
        readErrorMessage(value.error, '') ||
        readErrorMessage(value.msg, '') ||
        readErrorMessage(value.detail, '') ||
        fallback
      );
    }
    const text = String(value || '').trim();
    return text && text !== '[object Object]' ? text : fallback;
  }

  function normalizeMobileRecord(record) {
    if (!record || typeof record !== 'object' || !record.原始数据) return record;
    const raw = record.原始数据 && typeof record.原始数据 === 'object' ? record.原始数据 : {};
    return {
      ...raw,
      id: raw.id || record.编号 || record.id,
      uuid: record.id,
      code: record.编号,
      name: raw.name || raw.opportunityName || record.标题,
      targetName: raw.targetName || raw.name || record.客户名称 || record.标题,
      type: raw.type || raw.targetType || record.类型,
      customer: raw.customer || raw.customerName || record.客户名称,
      customerName: raw.customerName || raw.customer || record.客户名称,
      partnerName: raw.partnerName || record.渠道名称,
      assignedStaffName: raw.assignedStaffName || record.负责人,
      ownerName: raw.ownerName || record.负责人,
      region: raw.region || record.区域,
      status: record.状态,
      statusName: record.状态名称,
      amount: raw.amount ?? record.金额,
      total: raw.total ?? record.金额,
      createdAt: raw.createdAt || record.创建时间,
      updatedAt: raw.updatedAt || record.更新时间
    };
  }

  function normalizeMobileResult(result) {
    const list = result?.data;
    if (!Array.isArray(list?.数据) || !list?.分页) {
      return { ...result, data: normalizeMobileRecord(list) };
    }
    const page = Number(list.分页.页码) || 1;
    const pageSize = Number(list.分页.每页) || 20;
    const total = Number(list.分页.总数) || 0;
    return {
      ...result,
      data: list.数据.map(normalizeMobileRecord),
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total
    };
  }

  function translateSingleSignOnError(message) {
    return readErrorMessage(message, '单点登录失败，请稍后重试。');
  }

  function normalizeSingleSignOnResult(result) {
    const mobileSession = result?.data?.mobileSession;
    if (mobileSession?.token && mobileSession?.user) {
      return {
        success: true,
        user: mobileSession.user,
        token: mobileSession.token
      };
    }
    return result || {};
  }

  function mobileSessionKey(key) {
    return `${APP_PREFIX}mobile_${key}`;
  }

  function readSession() {
    try {
      const raw = localStorage.getItem(mobileSessionKey('api_user'));
      if (raw) return JSON.parse(raw);
    } catch (error) {
      console.warn('读取移动端登录态失败：', error);
    }
    return null;
  }

  function readAuthToken() {
    const session = readSession();
    return session?.token || '';
  }

  /**
   * 移动端统一请求封装。
   * 不携带 userId、partnerId、region、operatorId 等权限过滤参数，服务端以 Bearer 令牌确定可见数据范围。
   */
  async function mobileRequest(path, options = {}) {
    const token = readAuthToken();
    if (!token) {
      window.dispatchEvent(new CustomEvent('mobile-auth-expired'));
      throw new Error('登录状态已失效，请重新登录');
    }
    const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
    const requestOptions = { method: options.method || 'GET', headers, cache: 'no-store', credentials: 'include' };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(options.body);
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(requestOptions.method.toUpperCase())) {
      headers['Idempotency-Key'] = options.idempotencyKey || createIdempotencyKey();
    }

    let response;
    try {
      response = await fetch(`${window.API_BASE}/mobile${path}`, requestOptions);
    } catch (error) {
      throw new Error('网络连接失败，请检查网络后重试');
    }

    let result = null;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error(`服务响应异常（${response.status}）`);
    }
    if (!response.ok || result?.success === false) {
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('mobile-auth-expired'));
        throw new Error('登录状态已失效，请重新登录');
      }
      const message = readErrorMessage(result?.error || result?.message, `请求失败（${response.status}）`);
      throw new Error(message);
    }
    return normalizeMobileResult(result);
  }
  window.mobileRequest = mobileRequest;

  function createIdempotencyKey() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function statusText(value) {
    return STATUS_TEXT[value] || value || '—';
  }

  function statusClass(value) {
    if (['approved', 'active', 'confirmed', 'completed', 'won'].includes(value)) return 'status-success';
    if (['rejected', 'cancelled', 'lost'].includes(value)) return 'status-danger';
    if (['pending', 'reviewing', 'draft', 'contacted', 'registered'].includes(value)) return 'status-pending';
    return 'status-neutral';
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text.replace('T', ' ').replace(/(\.\d+)?Z$/, '').slice(0, 16);
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value])
    );
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function formatAmount(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '—';
    return `¥${amount.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
  }

  function recordName(item) {
    return item?.name || item?.customerName || item?.customer || item?.targetName || item?.id || '未命名记录';
  }

  function itemAmount(item, type) {
    if (type === 'registration') return undefined;
    return item?.amount ?? item?.total ?? item?.totalAmount ?? item?.estimatedAmt;
  }

  function detailRows(item, type) {
    const rowsByType = {
      registration: [
        ['编号', item.id], ['状态', statusText(item.status)], ['客户名称', recordName(item)],
        ['统一社会信用代码', item.creditCode], ['所属行业', item.industry], ['联系人', item.contact],
        ['联系电话', item.phone], ['所在城市', item.city], ['所属区域', item.region],
        ['渠道商', item.partnerName || item.assignedPartnerName], ['审核意见', item.remark], ['提交时间', formatDateTime(item.createdAt)],
        ['需求说明', item.notes]
      ],
      opportunity: [
        ['编号', item.id], ['阶段', statusText(item.stage)], ['商机名称', recordName(item)],
        ['客户名称', item.customer || item.customerName], ['关联报备', item.regId], ['预计金额', formatAmount(item.amount)],
        ['预计终端数', item.endpoints], ['预计成交日期', formatDate(item.expectedClose)], ['所属区域', item.region],
        ['负责人', item.assignedStaffName || item.owner || item.createdByName], ['渠道商', item.partnerName || item.assignedPartnerName],
        ['创建时间', formatDateTime(item.createdAt)], ['跟进说明', item.notes]
      ],
      quote: [
        ['报价单号', item.id], ['状态', statusText(item.status)], ['客户名称', item.customerName || item.customer],
        ['关联报备', item.regId], ['报价金额', formatAmount(item.total ?? item.amount)], ['终端数量', item.endpoints],
        ['渠道商', item.partnerName], ['转订单编号', item.convertedOrderId], ['创建时间', formatDateTime(item.createdAt)],
        ['产品', Array.isArray(item.products) ? item.products.join('、') : item.products]
      ],
      order: [
        ['订单号', item.id], ['状态', statusText(item.status)], ['客户名称', item.customerName || item.customer],
        ['关联报价', item.quoteId], ['订单金额', formatAmount(item.total ?? item.amount)], ['渠道商', item.partnerName],
        ['下单时间', formatDateTime(item.createdAt)], ['收货地址', item.deliveryAddr || item.deliveryAddress],
        ['联系人', item.deliveryContactName || item.contacts], ['联系电话', item.deliveryContactPhone],
        ['发票抬头', item.invoiceTitle], ['订单备注', item.remark]
      ],
      partner: [
        ['渠道商编号', item.id], ['状态', statusText(item.status)], ['渠道商名称', recordName(item)],
        ['合作级别', item.level], ['渠道层级', item.partnerLevel], ['所属区域', item.region], ['所在城市', item.city],
        ['联系人', item.contact], ['联系电话', item.phone], ['电子邮箱', item.email], ['审核意见', item.remark], ['加入日期', formatDate(item.joinDate)]
      ]
    };
    return (rowsByType[type] || []).map(([label, value]) => ({ label, value: value === 0 ? '0' : (value || '—') }));
  }

  const EmptyState = {
    props: { text: { type: String, default: '暂无数据' } },
    template: '<div class="empty-state"><span>◌</span><p>{{ text }}</p></div>'
  };

  const FormHeading = {
    props: { title: String, text: String },
    template: '<div class="form-heading"><h1>{{ title }}</h1><p>{{ text }}</p></div>'
  };

  const RecordList = {
    components: { EmptyState },
    props: { items: { type: Array, default: () => [] }, type: String, emptyText: String, hasMore: Boolean, loadingMore: Boolean },
    emits: ['open', 'load-more'],
    components: { EmptyState },
    methods: { recordName, statusText, statusClass, formatDate, formatDateTime, formatAmount, itemAmount },
    template: `
      <div v-if="items.length" class="card-list">
        <button v-for="item in items" :key="item.id" class="record-card" type="button" @click="$emit('open', item)">
          <div class="record-card__top"><span class="record-card__status" :class="statusClass(item.status || item.stage)">{{ statusText(item.status || item.stage) }}</span><small>{{ item.id }}</small></div>
          <strong>{{ recordName(item) }}</strong>
          <p>{{ item.partnerName || item.contact || item.createdByName || '—' }}</p>
          <div class="record-card__bottom"><span>{{ formatDateTime(item.createdAt || item.joinDate) }}</span><b v-if="itemAmount(item, type) !== undefined">{{ formatAmount(itemAmount(item, type)) }}</b></div>
        </button>
      </div>
      <empty-state v-else :text="emptyText"></empty-state>
      <button v-if="hasMore && items.length" class="load-more" type="button" :disabled="loadingMore" @click="$emit('load-more')">{{ loadingMore ? '正在加载…' : '加载更多' }}</button>`
  };

  const DetailCard = {
    props: { item: { type: Object, required: true }, type: { type: String, required: true } },
    methods: { detailRows, statusText, formatDateTime },
    template: `
      <article class="detail-card">
        <div class="detail-card__title"><h1>{{ item.name || item.customerName || item.customer || item.id }}</h1><span>{{ item.id }}</span></div>
        <dl class="detail-list"><div v-for="row in detailRows(item, type)" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div></dl>
        <section v-if="type === 'opportunity' && Array.isArray(item.followUps) && item.followUps.length" class="detail-timeline"><h2>跟进记录</h2><div v-for="followUp in item.followUps" :key="followUp.id || followUp.date"><b>{{ followUp.type || '跟进' }}</b><p>{{ followUp.content || '—' }}</p><small>{{ followUp.user || '—' }} · {{ formatDateTime(followUp.date) }}<template v-if="followUp.stage"> · 阶段 {{ statusText(followUp.stage) }}</template><template v-if="followUp.nextFollowAt"> · 下次 {{ followUp.nextFollowAt }}</template></small></div></section>
      </article>`
  };

  const ReviewList = {
    components: { EmptyState },
    props: { items: { type: Array, default: () => [] }, kind: String, emptyText: String, hasMore: Boolean, loadingMore: Boolean },
    emits: ['review', 'load-more'],
    components: { EmptyState },
    methods: { recordName, formatDate, formatDateTime },
    template: `
      <div v-if="items.length" class="card-list review-list">
        <button v-for="item in items" :key="item.id" class="record-card" type="button" @click="$emit('review', item)">
          <div class="record-card__top"><span class="record-card__status status-pending">待审核</span><small>{{ item.id }}</small></div>
          <strong>{{ recordName(item) }}</strong>
          <p>{{ item.partnerName || item.createdByName || item.region || item.type || '—' }}</p>
          <div class="record-card__bottom"><span>{{ formatDateTime(item.createdAt) }}</span><b>处理 ›</b></div>
        </button>
      </div>
      <empty-state v-else :text="emptyText"></empty-state>
      <button v-if="hasMore && items.length" class="load-more" type="button" :disabled="loadingMore" @click="$emit('load-more')">{{ loadingMore ? '正在加载…' : '加载更多' }}</button>`
  };

  createApp({
    components: { EmptyState, FormHeading, RecordList, DetailCard, ReviewList },
    setup() {
      const scope = ref(readScope());
      const ready = ref(false);
      const user = ref(null);
      const path = ref('');
      const submitting = ref(false);
      const loginError = ref('');
      const formError = ref('');
      const toast = reactive({ message: '', type: 'success' });
      let toastTimer = null;
      let singleSignOnPaused = false;
      const loginForm = reactive({ username: '', password: '' });
      const ssoState = reactive({ processing: false, message: '', attempted: false });
      const filters = reactive({ keyword: '', opportunityStage: '', registrationStatus: '' });
      const businessType = ref('registration');
      const opportunities = ref([]);
      const registrations = ref([]);
      const quotes = ref([]);
      const orders = ref([]);
      const partners = ref([]);
      const pendingApprovals = ref([]);
      const reviewRegistrations = ref([]);
      const reviewPartners = ref([]);
      const reviewAccounts = ref([]);
      const loading = reactive({ registrations: false, opportunities: false, quotes: false, orders: false, partners: false, pendingApprovals: false });
      const collectionRequestId = reactive({ registrations: 0, opportunities: 0, quotes: 0, orders: 0, partners: 0, pendingApprovals: 0 });
      const reviewLoading = reactive({ registrations: false, partners: false, pendingApprovals: false });
      const pageMeta = reactive({
        registrations: { page: 1, pageSize: 20, total: 0, hasMore: false },
        opportunities: { page: 1, pageSize: 20, total: 0, hasMore: false },
        quotes: { page: 1, pageSize: 20, total: 0, hasMore: false },
        orders: { page: 1, pageSize: 20, total: 0, hasMore: false },
        partners: { page: 1, pageSize: 20, total: 0, hasMore: false },
        pendingApprovals: { page: 1, pageSize: 20, total: 0, hasMore: false }
      });
      const reviewPageMeta = reactive({
        registrations: { page: 1, pageSize: 20, total: 0, hasMore: false },
        partners: { page: 1, pageSize: 20, total: 0, hasMore: false },
        pendingApprovals: { page: 1, pageSize: 20, total: 0, hasMore: false }
      });
      const reviewRequestId = reactive({ registrations: 0, partners: 0, pendingApprovals: 0 });
      const detailItems = reactive({ registration: null, opportunity: null, quote: null, order: null, partner: null });
      const detailLoading = reactive({ registration: false, opportunity: false, quote: false, order: false, partner: false });
      const detailError = reactive({ registration: '', opportunity: '', quote: '', order: '', partner: '' });
      const detailRequestId = reactive({ registration: 0, opportunity: 0, quote: 0, order: 0, partner: 0 });
      const reviewDialog = reactive({ visible: false, kind: '', item: null, title: '', action: 'approve', remark: '', error: '' });
      const registrationForm = reactive({ customer: '', creditCode: '', industry: '', contact: '', phone: '', city: '', notes: '' });
      const opportunityForm = reactive({ regId: '', name: '', customer: '', stage: 'contacted', amount: null, endpoints: null, expectedClose: '', notes: '' });
      const followUpTypeOptions = FOLLOW_UP_TYPE_OPTIONS;
      const followUpForm = reactive({ type: '电话', stage: 'contacted', content: '', nextFollowAt: '' });
      const quoteOrderForm = reactive({ deliveryContactName: '', deliveryContactPhone: '', deliveryAddress: '', invoiceTitle: '', remark: '' });
      const detailFormError = reactive({ followUp: '', convertOrder: '' });
      const registrationPicker = reactive({ keyword: '', items: [], selected: null, open: false, page: 1, pageSize: 10, total: 0, hasMore: false, loading: false, requestId: 0 });
      const companyPicker = reactive({ items: [], open: false, loading: false, filled: false, selectedName: '', filledCreditCode: '', filledIndustry: '', filledCity: '', requestId: 0 });

      const isPartnerScope = computed(() => scope.value === 'partner');
      const isAdminScope = computed(() => scope.value === 'admin');
      const isSuperAdmin = computed(() => user.value?.role === 'superadmin');
      const isPartnerUser = computed(() => PARTNER_ROLES.includes(user.value?.role));
      const isAdminUser = computed(() => ADMIN_ROLES.includes(user.value?.role));
      const roleName = computed(() => ({ staff: '渠道员工', partner_admin: '渠道管理员', admin: '区域管理员', superadmin: '超级管理员' }[user.value?.role] || '用户'));
      const stageOptions = STAGE_OPTIONS;
      const registrationStatusOptions = REGISTRATION_STATUS_OPTIONS;
      const industries = ['金融', '制造', '政府/央企', '教育', '医疗', '互联网', '零售', '其他'];
      const businessTabs = [
        { value: 'registration', label: '报备' }, { value: 'opportunity', label: '商机' },
        { value: 'quote', label: '报价' }, { value: 'order', label: '订单' }
      ];

      const navigation = computed(() => isPartnerScope.value ? [
        { path: '/partner/home', label: '工作台', icon: '⌂' }, { path: '/partner/opportunities', label: '商机', icon: '◉' },
        { path: '/partner/registrations', label: '客户', icon: '＋' }, { path: '/partner/quotes', label: '报价', icon: '¥' },
        { path: '/me', label: '我的', icon: '◌' }
      ] : [
        { path: '/admin/home', label: '工作台', icon: '⌂' }, { path: '/admin/reviews', label: '审核', icon: '✓' },
        { path: '/admin/business', label: '业务', icon: '◉' }, { path: '/admin/partners', label: '渠道', icon: '◇' },
        { path: '/me', label: '我的', icon: '◌' }
      ]);

      const page = computed(() => {
        const current = path.value;
        if (current.endsWith('/home')) return 'home';
        if (current === '/partner/opportunities') return 'opportunities';
        if (current === '/partner/opportunities/new') return 'opportunity-new';
        if (current.startsWith('/partner/opportunities/')) return 'opportunity-detail';
        if (current === '/partner/registrations') return 'registrations';
        if (current === '/partner/registrations/new') return 'registration-new';
        if (current.startsWith('/partner/registrations/')) return 'registration-detail';
        if (current === '/partner/quotes') return 'quotes';
        if (current.startsWith('/partner/quotes/')) return 'quote-detail';
        if (current === '/partner/orders') return 'orders';
        if (current.startsWith('/partner/orders/')) return 'order-detail';
        if (current === '/admin/reviews') return 'reviews';
        if (current === '/admin/business') return 'business';
        if (current.startsWith('/admin/business/')) return 'business-detail';
        if (current === '/admin/partners') return 'partners';
        if (current.startsWith('/admin/partners/')) return 'partner-detail';
        if (current === '/me') return 'me';
        return 'unknown';
      });

      const pageTitle = computed(() => ({
        home: '工作台', opportunities: '商机', 'opportunity-new': '新建商机', 'opportunity-detail': '商机详情',
        registrations: '客户报备', 'registration-new': '新建报备', 'registration-detail': '报备详情',
        quotes: '报价单', 'quote-detail': '报价详情', orders: '订单', 'order-detail': '订单详情',
        reviews: '审核中心', business: '业务查询', 'business-detail': '业务详情', partners: '渠道商',
        'partner-detail': '渠道商详情', me: '我的'
      }[page.value] || '移动端'));
      const showNavigation = computed(() => ['home', 'opportunities', 'registrations', 'quotes', 'reviews', 'business', 'partners', 'me'].includes(page.value));
      const showBack = computed(() => !['home', 'opportunities', 'registrations', 'quotes', 'reviews', 'business', 'partners', 'me'].includes(page.value));
      const pendingRegistrations = computed(() => registrations.value.filter(item => ['pending', 'reviewing'].includes(item.status)));
      const pendingRegistrationCount = computed(() => pendingRegistrations.value.length);
      const pendingPartners = computed(() => partners.value.filter(item => item.status === 'pending'));
      const pendingAccounts = computed(() => pendingApprovals.value.filter(item => ['staff', 'partner_admin'].includes(item.type) && item.status === 'pending'));
      const reviewPendingAccounts = computed(() => reviewAccounts.value.filter(item => ['staff', 'partner_admin'].includes(item.type) && item.status === 'pending'));
      const pendingApprovalCount = computed(() => pendingPartners.value.length + pendingAccounts.value.length);
      const keyword = computed(() => filters.keyword.trim().toLowerCase());
      const matchKeyword = (item) => {
        if (!keyword.value) return true;
        return [item.id, item.name, item.customer, item.customerName, item.partnerName, item.contact, item.targetName]
          .some(value => String(value || '').toLowerCase().includes(keyword.value));
      };
      const filteredOpportunities = computed(() => opportunities.value.filter(item => matchKeyword(item) && (!filters.opportunityStage || item.stage === filters.opportunityStage)));
      const filteredRegistrations = computed(() => registrations.value.filter(item => matchKeyword(item) && (!filters.registrationStatus || item.status === filters.registrationStatus)));
      const filteredQuotes = computed(() => quotes.value.filter(matchKeyword));
      const filteredOrders = computed(() => orders.value.filter(matchKeyword));
      const filteredPartners = computed(() => partners.value.filter(matchKeyword));
      const businessItems = computed(() => ({ registration: registrations.value, opportunity: opportunities.value, quote: quotes.value, order: orders.value }[businessType.value] || []).filter(matchKeyword));
      const businessCollectionKey = computed(() => ({ registration: 'registrations', opportunity: 'opportunities', quote: 'quotes', order: 'orders' }[businessType.value]));
      const businessPageMeta = computed(() => ({ ...pageMeta[businessCollectionKey.value], loading: loading[businessCollectionKey.value] }));
      const selectedId = computed(() => decodeURIComponent(path.value.split('/').pop() || ''));
      const selectedOpportunity = computed(() => detailItems.opportunity);
      const selectedRegistration = computed(() => detailItems.registration);
      const selectedQuote = computed(() => detailItems.quote);
      const selectedOrder = computed(() => detailItems.order);
      const selectedPartner = computed(() => detailItems.partner);
      const canAddFollowUp = computed(() => Boolean(isPartnerUser.value && selectedOpportunity.value));
      const canConvertSelectedQuote = computed(() => Boolean(
        isPartnerUser.value &&
        selectedQuote.value &&
        selectedQuote.value.status === 'confirmed' &&
        !selectedQuote.value.convertedOrderId
      ));
      const selectedQuoteConvertedText = computed(() => {
        if (!selectedQuote.value) return '';
        if (selectedQuote.value.status === 'converted' || selectedQuote.value.convertedOrderId) {
          return selectedQuote.value.convertedOrderId
            ? `该报价已转为订单：${selectedQuote.value.convertedOrderId}`
            : '该报价已转为订单，不能重复转单。';
        }
        return '';
      });
      const businessDetailType = computed(() => path.value.split('/')[3] || 'registration');
      const selectedBusinessItem = computed(() => detailItems[businessDetailType.value] || null);
      const reviewDialogRows = computed(() => {
        if (!reviewDialog.item) return [];
        const type = reviewDialog.kind === 'registration' ? 'registration' : reviewDialog.kind === 'partner' ? 'partner' : 'account';
        if (type === 'account') return [
          { label: '申请编号', value: reviewDialog.item.id || '—' }, { label: '账号类型', value: reviewDialog.item.type || '—' },
          { label: '申请对象', value: reviewDialog.item.targetName || reviewDialog.item.targetId || '—' }, { label: '所属区域', value: reviewDialog.item.region || '—' },
          { label: '申请时间', value: formatDateTime(reviewDialog.item.createdAt) }
        ];
        return detailRows(reviewDialog.item, type).slice(0, 10);
      });

      function flash(message, type = 'success') {
        toast.message = readErrorMessage(message, type === 'error' ? '操作失败，请稍后重试。' : '操作成功');
        toast.type = type;
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => { toast.message = ''; }, 2600);
      }

      function defaultHome() {
        return isPartnerScope.value ? '/partner/home' : '/admin/home';
      }

      function redirectRouteKey() {
        return `${APP_PREFIX}mobile_redirect_route`;
      }

      function normalizeHash() {
        return (window.location.hash || '').replace(/^#/, '').split('?')[0] || '';
      }

      function isSingleSignOnPath(nextPath) {
        return nextPath === SINGLE_SIGN_ON_PATH;
      }

      function isLoginPath(nextPath) {
        return nextPath === '/login';
      }

      function shouldStartSingleSignOn(nextPath) {
        return !singleSignOnPaused && (isLoginPath(nextPath) || isSingleSignOnPath(nextPath));
      }

      function buildCleanSearch() {
        const params = new URLSearchParams(window.location.search);
        SINGLE_SIGN_ON_TOKEN_KEYS.forEach(key => params.delete(key));
        const query = params.toString();
        return query ? `?${query}` : '';
      }

      function isAllowedPath(nextPath) {
        if (nextPath === '/me') return true;
        if (isPartnerUser.value) return nextPath.startsWith('/partner/');
        if (isAdminUser.value) return nextPath.startsWith('/admin/');
        return false;
      }

      function invalidateAsyncViews() {
        Object.keys(collectionRequestId).forEach(key => {
          collectionRequestId[key] += 1;
          loading[key] = false;
        });
        Object.keys(detailRequestId).forEach(key => {
          detailRequestId[key] += 1;
          detailLoading[key] = false;
        });
        registrationPicker.requestId += 1;
        registrationPicker.loading = false;
      }

      function syncRoute() {
        const nextPath = normalizeHash();
        const previousPage = page.value;
        if (path.value && path.value !== nextPath) invalidateAsyncViews();
        path.value = nextPath;
        if (!scope.value) return;
        if (shouldStartSingleSignOn(path.value)) {
          if (user.value) {
            clearMobileSession();
            user.value = null;
          }
          startSingleSignOn();
          return;
        }
        if (!user.value) {
          if (path.value !== '/login') {
            sessionStorage.setItem(redirectRouteKey(), path.value);
            go('/login', true);
          }
          return;
        }
        if (path.value === '/login' || !isAllowedPath(path.value)) {
          go(defaultHome(), true);
          return;
        }
        if (page.value === 'registration-new') restoreDraft('registration');
        if (page.value === 'opportunity-new') restoreDraft('opportunity');
        if (previousPage === page.value && detailRouteInfo()) loadDetail();
      }

      function go(nextPath, replace = false) {
        if (!nextPath) return;
        const nextHash = `#${nextPath}`;
        if (replace) {
          history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
          syncRoute();
          return;
        }
        if (window.location.hash === nextHash) {
          syncRoute();
        } else {
          window.location.hash = nextPath;
        }
      }

      function chooseScope(nextScope) {
        window.location.href = `mobile.html?scope=${nextScope}#/login`;
      }

      function backToScope() {
        window.location.href = 'mobile.html';
      }

      function goBack() {
        const backMap = {
          'opportunity-new': '/partner/opportunities', 'opportunity-detail': '/partner/opportunities',
          'registration-new': '/partner/registrations', 'registration-detail': '/partner/registrations',
          'quote-detail': '/partner/quotes', 'order-detail': '/partner/orders',
          'business-detail': '/admin/business', 'partner-detail': '/admin/partners'
        };
        go(backMap[page.value] || defaultHome());
      }

      function isNavActive(item) {
        if (item.path.endsWith('/home')) return page.value === 'home';
        if (item.path === '/partner/opportunities') return page.value.startsWith('opportunity');
        if (item.path === '/partner/registrations') return page.value.startsWith('registration');
        if (item.path === '/partner/quotes') return page.value.startsWith('quote');
        if (item.path === '/admin/business') return page.value === 'business' || page.value === 'business-detail';
        if (item.path === '/admin/partners') return page.value === 'partners' || page.value === 'partner-detail';
        return path.value === item.path;
      }

      const collectionEndpoints = {
        registrations: '/registrations', opportunities: '/opportunities', quotes: '/quotes', orders: '/orders',
        partners: '/partners', pendingApprovals: '/pending-approvals'
      };

      function activeCollectionKey() {
        if (page.value === 'opportunities') return 'opportunities';
        if (page.value === 'registrations' || page.value === 'reviews') return 'registrations';
        if (page.value === 'quotes') return 'quotes';
        if (page.value === 'orders') return 'orders';
        if (page.value === 'business') return businessCollectionKey.value;
        if (page.value === 'partners') return 'partners';
        return '';
      }

      function collectionQuery(key, append) {
        const meta = pageMeta[key];
        const query = new URLSearchParams({ page: String(append ? meta.page + 1 : 1), pageSize: String(meta.pageSize) });
        if (page.value === 'reviews' && key === 'registrations') query.set('status', 'pending');
        if (page.value === 'reviews' && key === 'partners') query.set('status', 'pending');
        if (activeCollectionKey() === key) {
          if (filters.keyword.trim()) query.set('keyword', filters.keyword.trim());
          if (key === 'registrations' && filters.registrationStatus && page.value !== 'reviews') query.set('status', filters.registrationStatus);
          if (key === 'opportunities' && filters.opportunityStage) query.set('status', filters.opportunityStage);
        }
        return query.toString();
      }

      async function fetchCollection(key, endpoint = collectionEndpoints[key], append = false) {
        const requestId = ++collectionRequestId[key];
        loading[key] = true;
        try {
          const query = collectionQuery(key, append);
          const result = await mobileRequest(`${endpoint}?${query}`);
          if (requestId !== collectionRequestId[key]) return;
          const data = Array.isArray(result.data) ? result.data : [];
          const nextData = append ? (value => value.concat(data)) : (() => data);
          if (key === 'registrations') registrations.value = nextData(registrations.value);
          if (key === 'opportunities') opportunities.value = nextData(opportunities.value);
          if (key === 'quotes') quotes.value = nextData(quotes.value);
          if (key === 'orders') orders.value = nextData(orders.value);
          if (key === 'partners') partners.value = nextData(partners.value);
          if (key === 'pendingApprovals') pendingApprovals.value = nextData(pendingApprovals.value);
          Object.assign(pageMeta[key], {
            page: Number(result.page) || (append ? pageMeta[key].page + 1 : 1),
            pageSize: Number(result.pageSize) || pageMeta[key].pageSize,
            total: Number(result.total) || 0,
            hasMore: Boolean(result.hasMore)
          });
        } finally {
          if (requestId === collectionRequestId[key]) loading[key] = false;
        }
      }

      function detailRouteInfo() {
        if (page.value === 'registration-detail') return { type: 'registration', endpoint: '/registrations' };
        if (page.value === 'opportunity-detail') return { type: 'opportunity', endpoint: '/opportunities' };
        if (page.value === 'quote-detail') return { type: 'quote', endpoint: '/quotes' };
        if (page.value === 'order-detail') return { type: 'order', endpoint: '/orders' };
        if (page.value === 'partner-detail') return { type: 'partner', endpoint: '/partners' };
        if (page.value === 'business-detail') {
          const routeInfo = {
            registration: { type: 'registration', endpoint: '/registrations' },
            opportunity: { type: 'opportunity', endpoint: '/opportunities' },
            quote: { type: 'quote', endpoint: '/quotes' },
            order: { type: 'order', endpoint: '/orders' }
          };
          return routeInfo[businessDetailType.value] || null;
        }
        return null;
      }

      async function loadDetail() {
        const routeInfo = detailRouteInfo();
        const id = selectedId.value;
        if (!routeInfo || !id || !user.value) return;
        const { type, endpoint } = routeInfo;
        const requestId = ++detailRequestId[type];
        detailLoading[type] = true;
        detailError[type] = '';
        detailItems[type] = null;
        try {
          const result = await mobileRequest(`${endpoint}/${encodeURIComponent(id)}`);
          if (requestId !== detailRequestId[type]) return;
          detailItems[type] = result.data || null;
          if (type === 'opportunity') {
            Object.assign(followUpForm, { type: '电话', stage: detailItems[type]?.stage || 'contacted', content: '', nextFollowAt: '' });
            detailFormError.followUp = '';
          }
          if (type === 'quote') {
            Object.assign(quoteOrderForm, { deliveryContactName: '', deliveryContactPhone: '', deliveryAddress: '', invoiceTitle: '', remark: '' });
            detailFormError.convertOrder = '';
          }
        } catch (error) {
          if (requestId !== detailRequestId[type]) return;
          detailError[type] = error.message || '详情加载失败';
        } finally {
          if (requestId === detailRequestId[type]) detailLoading[type] = false;
        }
      }

      function detailMessage(type) {
        if (detailLoading[type]) return '正在加载详情…';
        return detailError[type] || '记录不存在或无访问权限';
      }

      async function loadApprovedRegistrations(append = false) {
        const keyword = registrationPicker.keyword.trim();
        if (!append && keyword.length < 2) {
          Object.assign(registrationPicker, { items: [], open: false, page: 1, total: 0, hasMore: false, loading: false });
          return;
        }
        const requestId = ++registrationPicker.requestId;
        const query = new URLSearchParams({
          status: 'approved',
          page: String(append ? registrationPicker.page + 1 : 1),
          pageSize: String(registrationPicker.pageSize)
        });
        query.set('keyword', keyword);
        registrationPicker.loading = true;
        try {
          const result = await mobileRequest(`/registrations?${query}`);
          if (requestId !== registrationPicker.requestId) return;
          const data = Array.isArray(result.data) ? result.data : [];
          registrationPicker.items = append ? registrationPicker.items.concat(data) : data;
          registrationPicker.page = Number(result.page) || (append ? registrationPicker.page + 1 : 1);
          registrationPicker.pageSize = Number(result.pageSize) || registrationPicker.pageSize;
          registrationPicker.total = Number(result.total) || 0;
          registrationPicker.hasMore = Boolean(result.hasMore);
          registrationPicker.selected = registrationPicker.items.find(item => item.id === opportunityForm.regId) || registrationPicker.selected;
          registrationPicker.open = true;
        } catch (error) {
          if (requestId === registrationPicker.requestId) formError.value = error.message || '已审批报备加载失败';
        } finally {
          if (requestId === registrationPicker.requestId) registrationPicker.loading = false;
        }
      }

      async function loadMoreApprovedRegistrations() {
        if (!registrationPicker.hasMore || registrationPicker.loading) return;
        await loadApprovedRegistrations(true);
      }

      function openOpportunityRegistrationPicker() {
        if (registrationPicker.keyword.trim().length >= 2 && !registrationPicker.selected) loadApprovedRegistrations();
      }

      function hideOpportunityRegistrationPicker() {
        window.setTimeout(() => { registrationPicker.open = false; }, 160);
      }

      async function selectOpportunityRegistration(registration) {
        if (!registration?.id) return;
        registrationPicker.selected = registration;
        registrationPicker.keyword = recordName(registration);
        registrationPicker.open = false;
        opportunityForm.regId = registration.id;
        await fillOpportunityFromRegistration();
      }

      async function loadMore(key) {
        if (!key || !pageMeta[key]?.hasMore || loading[key]) return;
        try {
          await fetchCollection(key, collectionEndpoints[key], true);
        } catch (error) {
          flash(error.message || '加载更多失败，请稍后重试', 'error');
        }
      }

      async function fetchReviewCollection(key, append = false) {
        const meta = reviewPageMeta[key];
        const requestId = ++reviewRequestId[key];
        const query = new URLSearchParams({ page: String(append ? meta.page + 1 : 1), pageSize: String(meta.pageSize) });
        if (key === 'registrations' || key === 'partners') query.set('status', 'pending');
        const endpoint = collectionEndpoints[key];
        reviewLoading[key] = true;
        try {
          const result = await mobileRequest(`${endpoint}?${query}`);
          if (requestId !== reviewRequestId[key]) return;
          const data = Array.isArray(result.data) ? result.data : [];
          if (key === 'registrations') reviewRegistrations.value = append ? reviewRegistrations.value.concat(data) : data;
          if (key === 'partners') reviewPartners.value = append ? reviewPartners.value.concat(data) : data;
          if (key === 'pendingApprovals') reviewAccounts.value = append ? reviewAccounts.value.concat(data) : data;
          Object.assign(meta, {
            page: Number(result.page) || (append ? meta.page + 1 : 1),
            pageSize: Number(result.pageSize) || meta.pageSize,
            total: Number(result.total) || 0,
            hasMore: Boolean(result.hasMore)
          });
        } finally {
          if (requestId === reviewRequestId[key]) reviewLoading[key] = false;
        }
      }

      async function loadMoreReview(key) {
        if (!key || !reviewPageMeta[key]?.hasMore || reviewLoading[key]) return;
        try {
          await fetchReviewCollection(key, true);
        } catch (error) {
          flash(error.message || '加载更多失败，请稍后重试', 'error');
        }
      }

      async function reloadActiveCollection() {
        const key = activeCollectionKey();
        if (!key) return;
        try {
          await fetchCollection(key);
        } catch (error) {
          flash(error.message || '筛选加载失败，请稍后重试', 'error');
        }
      }

      async function reloadForRoute() {
        if (!user.value) return;
        if (detailRouteInfo()) {
          await loadDetail();
          return;
        }
        if (page.value === 'opportunity-new') {
          await loadApprovedRegistrations();
          return;
        }
        if (page.value === 'home') {
          await loadPageData();
          return;
        }
        if (page.value !== 'reviews') {
          await reloadActiveCollection();
          return;
        }
        const tasks = [fetchReviewCollection('registrations')];
        if (isSuperAdmin.value) tasks.push(fetchReviewCollection('partners'), fetchReviewCollection('pendingApprovals'));
        const results = await Promise.allSettled(tasks);
        const failure = results.find(result => result.status === 'rejected');
        if (failure) flash(failure.reason?.message || '待审核数据加载失败，请稍后重试', 'error');
      }

      async function loadPageData() {
        if (!user.value) return;
        if (detailRouteInfo()) {
          await loadDetail();
          return;
        }
        if (page.value === 'reviews') {
          await reloadForRoute();
          return;
        }
        const tasks = [
          fetchCollection('registrations'), fetchCollection('opportunities'), fetchCollection('quotes'), fetchCollection('orders')
        ];
        if (isAdminUser.value) tasks.push(fetchCollection('partners'));
        if (isSuperAdmin.value) tasks.push(fetchCollection('pendingApprovals'));
        const results = await Promise.allSettled(tasks);
        const failure = results.find(result => result.status === 'rejected');
        if (failure) {
          const message = failure.reason?.message || '业务数据加载失败';
          flash(message, 'error');
          if (/登录状态|无权|未登录|令牌/.test(message)) logout(false);
        }
      }

      function persistMobileSession(loginResult, nextUser) {
        localStorage.setItem(mobileSessionKey('auth_token'), loginResult.token);
        localStorage.setItem(mobileSessionKey('user_info'), JSON.stringify(nextUser));
        localStorage.setItem(mobileSessionKey('api_user'), JSON.stringify({ user: nextUser, token: loginResult.token }));
      }

      function scopeByRole(role) {
        if (PARTNER_ROLES.includes(role)) return 'partner';
        if (ADMIN_ROLES.includes(role)) return 'admin';
        return '';
      }

      function homeByScope(nextScope) {
        return nextScope === 'partner' ? '/partner/home' : '/admin/home';
      }

      function persistMobileSessionForScope(loginResult, nextUser, nextScope) {
        const prefix = nextScope === 'partner' ? 'partner_' : 'admin_';
        const storageKey = key => `${prefix}mobile_${key}`;
        localStorage.setItem(storageKey('auth_token'), loginResult.token);
        localStorage.setItem(storageKey('user_info'), JSON.stringify(nextUser));
        localStorage.setItem(storageKey('api_user'), JSON.stringify({ user: nextUser, token: loginResult.token }));
      }

      function redirectToMatchedScope(loginResult, nextUser) {
        const nextScope = scopeByRole(nextUser.role);
        if (!nextScope || nextScope === scope.value) return false;
        clearMobileSession();
        persistMobileSessionForScope(loginResult, nextUser, nextScope);
        window.location.assign(`mobile.html?scope=${nextScope}#${homeByScope(nextScope)}`);
        return true;
      }

      function clearMobileSession() {
        localStorage.removeItem(mobileSessionKey('auth_token'));
        localStorage.removeItem(mobileSessionKey('user_info'));
        localStorage.removeItem(mobileSessionKey('api_user'));
      }

      function emmSsoIsaid() {
        return isPartnerScope.value ? EMM_H5_SSO_ISAIDS.partner : EMM_H5_SSO_ISAIDS.admin;
      }

      function replaceCleanRoute(nextPath) {
        history.replaceState(null, '', `${window.location.pathname}${buildCleanSearch()}#${nextPath}`);
        syncRoute();
      }

      function requestEmmSingleSignOnToken() {
        return new Promise((resolve, reject) => {
          if (!window.JQAPI || typeof window.JQAPI.getSSOToken !== 'function') {
            reject(new Error('当前环境未检测到 EMM 单点登录能力'));
            return;
          }

          let done = false;
          const timer = window.setTimeout(() => {
            if (done) return;
            done = true;
            reject(new Error('未能从 EMM 获取单点登录凭证，请确认当前页面在 EMM 客户端中打开'));
          }, EMM_H5_SSO_TIMEOUT_MS);

          function finish(callback) {
            return function (data) {
              if (done) return;
              done = true;
              window.clearTimeout(timer);
              callback(data);
            };
          }

          window.JQAPI.getSSOToken(
            { ISAID: emmSsoIsaid() },
            finish(data => {
              try {
                const payload = parseEmmPayload(data);
                const ssoToken = String(payload?.SSOToken?.token || payload?.SSOToken?.ltpatoken || '').trim();
                if (!ssoToken) {
                  reject(new Error('EMM 返回缺少单点登录凭证'));
                  return;
                }
                resolve(ssoToken);
              } catch (error) {
                reject(new Error('EMM 单点登录返回格式异常'));
              }
            }),
            finish(data => {
              let message = 'EMM 单点登录失败，请稍后重试';
              try {
                const payload = parseEmmPayload(data);
                message = payload.msg || message;
              } catch (error) {
                if (data) message = String(data);
              }
              reject(new Error(message));
            })
          );
        });
      }

      async function readSingleSignOnToken() {
        const tokenFromUrl = readSingleSignOnTokenFromUrl();
        if (tokenFromUrl) return tokenFromUrl;
        ssoState.message = `正在通过 EMM 获取${isPartnerScope.value ? '渠道用户与企业管理员' : '管理员'}单点登录凭证…`;
        return requestEmmSingleSignOnToken();
      }

      async function startSingleSignOn() {
        if (ssoState.processing || ssoState.attempted) return;
        ssoState.attempted = true;
        ssoState.processing = true;
        submitting.value = true;
        loginError.value = '';
        ssoState.message = '正在验证单点登录信息，请稍候…';

        try {
          const ssoToken = await readSingleSignOnToken();
          const allowedRoles = isPartnerScope.value ? PARTNER_ROLES : ADMIN_ROLES;
          let response;
          try {
            response = await fetch('/api/auth/sso/iam/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: ssoToken,
                entry: isPartnerScope.value ? 'partner' : 'admin',
                clientType: 'mobile'
              })
            });
          } catch (error) {
            throw new Error('单点登录请求失败，请检查手机网络、后端接口地址或 HTTPS 配置。');
          }

          let result = null;
          try {
            result = await response.json();
          } catch (error) {
            throw new Error(`单点登录响应异常（${response.status}）`);
          }
          if (!response.ok || result?.success === false) {
            throw new Error(translateSingleSignOnError(result?.error || result?.message || `单点登录失败（${response.status}）`));
          }

          result = normalizeSingleSignOnResult(result);
          const nextUser = { ...(result.user || {}), _storagePrefix: APP_PREFIX };
          if (!allowedRoles.includes(nextUser.role)) {
            if (redirectToMatchedScope(result, nextUser)) return;
            throw new Error(isPartnerScope.value ? '该账号应使用厂商管理入口登录' : '该账号应使用渠道伙伴入口登录');
          }

          persistMobileSession(result, nextUser);
          user.value = nextUser;
          singleSignOnPaused = false;
          ssoState.message = '单点登录成功，正在进入移动端…';
          sessionStorage.removeItem(redirectRouteKey());
          replaceCleanRoute(defaultHome());
          await reloadForRoute();
        } catch (error) {
          clearMobileSession();
          loginError.value = translateSingleSignOnError(error.message);
          replaceCleanRoute('/login');
        } finally {
          ssoState.processing = false;
          submitting.value = false;
        }
      }

      async function login() {
        if (ssoState.processing) return;
        loginError.value = '';
        if (!loginForm.username || !loginForm.password) {
          loginError.value = '请输入账号和密码';
          return;
        }
        submitting.value = true;
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username: loginForm.username, password: loginForm.password })
          });
          const rawResult = await response.json();
          if (!response.ok || rawResult?.success === false) throw new Error(readErrorMessage(rawResult?.error, '登录失败，请稍后重试'));
          const result = normalizeSingleSignOnResult(rawResult);
          const nextUser = { ...(result.user || {}), _storagePrefix: APP_PREFIX };
          const allowedRoles = isPartnerScope.value ? PARTNER_ROLES : ADMIN_ROLES;
          if (!allowedRoles.includes(nextUser.role)) {
            if (redirectToMatchedScope(result, nextUser)) return;
            clearMobileSession();
            loginError.value = isPartnerScope.value ? '该账号应使用厂商管理入口登录' : '该账号应使用渠道伙伴入口登录';
            return;
          }
          persistMobileSession(result, nextUser);
          user.value = nextUser;
          singleSignOnPaused = false;
          loginForm.password = '';
          const redirectRoute = sessionStorage.getItem(redirectRouteKey());
          sessionStorage.removeItem(redirectRouteKey());
          go(redirectRoute && isAllowedPath(redirectRoute) ? redirectRoute : defaultHome(), true);
          await reloadForRoute();
        } catch (error) {
          loginError.value = error.message || '登录失败，请稍后重试';
        } finally {
          submitting.value = false;
        }
      }

      async function restoreLogin() {
        const session = readSession();
        let nextSession = session;
        if (!nextSession?.user || !nextSession?.token) {
          try {
            const response = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
            const result = await response.json();
            if (!response.ok || result?.success === false) return;
            const normalized = normalizeSingleSignOnResult(result);
            if (!normalized?.user || !normalized?.token) return;
            nextSession = normalized;
            persistMobileSession(normalized, normalized.user);
          } catch (error) {
            return;
          }
        }
        const nextUser = { ...nextSession.user, _storagePrefix: APP_PREFIX };
        const allowedRoles = isPartnerScope.value ? PARTNER_ROLES : ADMIN_ROLES;
        if (!allowedRoles.includes(nextUser.role)) {
          clearMobileSession();
          return;
        }
        user.value = nextUser;
      }

      function resetRegistrationForm() {
        delete registrationForm.project;
        delete registrationForm.estimatedAmt;
        Object.assign(registrationForm, { customer: '', creditCode: '', industry: '', contact: '', phone: '', city: '', notes: '' });
        Object.assign(companyPicker, { items: [], open: false, loading: false, filled: false, selectedName: '', filledCreditCode: '', filledIndustry: '', filledCity: '', requestId: companyPicker.requestId + 1 });
      }

      function resetOpportunityForm() {
        Object.assign(opportunityForm, { regId: '', name: '', customer: '', stage: 'contacted', amount: null, endpoints: null, expectedClose: '', notes: '' });
        Object.assign(registrationPicker, { keyword: '', items: [], selected: null, open: false, page: 1, pageSize: 10, total: 0, hasMore: false, loading: false });
      }

      function draftKey(type) {
        return `${APP_PREFIX}mobile_${type}_draft`;
      }

      function restoreDraft(type) {
        const form = type === 'registration' ? registrationForm : opportunityForm;
        try {
          const raw = sessionStorage.getItem(draftKey(type));
          if (!raw) return;
          const draft = JSON.parse(raw);
          if (draft && typeof draft === 'object') {
            if (type === 'registration') {
              Object.assign(form, {
                customer: draft.customer || '',
                creditCode: draft.creditCode || '',
                industry: draft.industry || '',
                contact: draft.contact || '',
                phone: draft.phone || '',
                city: draft.city || '',
                notes: draft.notes || ''
              });
            } else {
              Object.assign(form, draft);
            }
          }
        } catch (error) {
          sessionStorage.removeItem(draftKey(type));
        }
      }

      function saveDraft(type) {
        const form = type === 'registration' ? registrationForm : opportunityForm;
        try {
          sessionStorage.setItem(draftKey(type), JSON.stringify(form));
          flash('草稿已保存到本次会话');
        } catch (error) {
          flash('草稿保存失败，请检查浏览器存储权限', 'error');
        }
      }

      function clearDraft(type, silent = false) {
        sessionStorage.removeItem(draftKey(type));
        if (type === 'registration') resetRegistrationForm();
        else resetOpportunityForm();
        if (!silent) flash('草稿已清除');
      }

      function validPhone(value) {
        return /^[+\d][\d\s-]{5,20}$/.test(String(value || '').trim());
      }

      function matchMobileIndustry(value) {
        const source = String(value || '');
        const rules = [
          ['金融', '金融'], ['银行', '金融'], ['保险', '金融'], ['证券', '金融'],
          ['制造', '制造'], ['加工', '制造'], ['生产', '制造'],
          ['政府', '政府/央企'], ['机关', '政府/央企'], ['国有', '政府/央企'],
          ['医疗', '医疗'], ['医院', '医疗'], ['卫生', '医疗'],
          ['教育', '教育'], ['学校', '教育'], ['大学', '教育'],
          ['信息', '互联网'], ['软件', '互联网'], ['科技', '互联网'], ['网络', '互联网'],
          ['零售', '零售'], ['商业', '零售'], ['贸易', '零售']
        ];
        const matched = rules.find(([keyword]) => source.includes(keyword));
        return matched ? matched[1] : '';
      }

      function openRegistrationCompanyPicker() {
        if (registrationForm.customer.trim().length >= 2 && registrationForm.customer.trim() !== companyPicker.selectedName) searchRegistrationCompany();
      }

      function hideRegistrationCompanyPicker() {
        window.setTimeout(() => { companyPicker.open = false; }, 160);
      }

      async function searchRegistrationCompany() {
        const keyword = registrationForm.customer.trim();
        if (keyword.length < 2 || keyword === companyPicker.selectedName) return;
        const requestId = ++companyPicker.requestId;
        companyPicker.loading = true;
        try {
          const result = await mobileRequest(`/company-search?keyword=${encodeURIComponent(keyword)}`);
          if (requestId !== companyPicker.requestId) return;
          companyPicker.items = Array.isArray(result.data) ? result.data : [];
          companyPicker.open = true;
        } catch (error) {
          if (requestId === companyPicker.requestId) {
            companyPicker.items = [];
            companyPicker.open = true;
          }
        } finally {
          if (requestId === companyPicker.requestId) companyPicker.loading = false;
        }
      }

      function selectRegistrationCompany(company) {
        const customer = String(company?.name || company?.customer || '').trim();
        if (!customer) return;
        const creditCode = String(company.creditCode || '').trim();
        const industry = matchMobileIndustry(company.industry);
        const city = String(company.city || company.address || '').trim();
        registrationForm.customer = customer;
        if (creditCode) registrationForm.creditCode = creditCode;
        if (industry) registrationForm.industry = industry;
        if (city) registrationForm.city = city;
        companyPicker.selectedName = customer;
        companyPicker.filledCreditCode = creditCode;
        companyPicker.filledIndustry = industry;
        companyPicker.filledCity = city;
        companyPicker.filled = true;
        companyPicker.open = false;
      }

      async function submitRegistration() {
        formError.value = '';
        if (!validPhone(registrationForm.phone)) {
          formError.value = '请输入正确的联系电话';
          return;
        }
        submitting.value = true;
        try {
          const result = await mobileRequest('/registrations', {
            method: 'POST',
            body: {
              customer: registrationForm.customer,
              creditCode: registrationForm.creditCode,
              industry: registrationForm.industry,
              contact: registrationForm.contact,
              phone: registrationForm.phone,
              city: registrationForm.city,
              notes: registrationForm.notes
            }
          });
          clearDraft('registration', true);
          await fetchCollection('registrations', '/registrations');
          flash('客户报备已提交，等待厂商审核');
          go(`/partner/registrations/${result.data?.id || ''}`);
        } catch (error) {
          formError.value = error.message || '提交失败，请稍后重试';
        } finally {
          submitting.value = false;
        }
      }

      async function fillOpportunityFromRegistration() {
        let registration = registrationPicker.items.find(item => item.id === opportunityForm.regId) || null;
        if (!registration && opportunityForm.regId) {
          try {
            const result = await mobileRequest(`/registrations/${encodeURIComponent(opportunityForm.regId)}`);
            if (result.data?.status === 'approved') registration = result.data;
          } catch (error) {
            formError.value = error.message || '关联报备读取失败';
            return;
          }
        }
        if (!registration) return;
        registrationPicker.selected = registration;
        opportunityForm.customer = recordName(registration);
        opportunityForm.name = opportunityForm.name || `${recordName(registration)}项目`;
        opportunityForm.notes = opportunityForm.notes || registration.notes || '';
      }

      async function submitOpportunity() {
        formError.value = '';
        let registration = registrationPicker.selected?.id === opportunityForm.regId ? registrationPicker.selected : null;
        if (!registration && opportunityForm.regId) {
          try {
            const result = await mobileRequest(`/registrations/${encodeURIComponent(opportunityForm.regId)}`);
            if (result.data?.status === 'approved') registration = result.data;
          } catch (error) {
            formError.value = error.message || '关联报备读取失败';
            return;
          }
        }
        if (!registration) {
          formError.value = '请选择已审批通过的客户报备';
          return;
        }
        submitting.value = true;
        try {
          const result = await mobileRequest('/opportunities', { method: 'POST', body: { ...opportunityForm } });
          clearDraft('opportunity', true);
          await fetchCollection('opportunities', '/opportunities');
          flash('商机已提交');
          go(`/partner/opportunities/${result.data?.id || ''}`);
        } catch (error) {
          formError.value = error.message || '提交失败，请稍后重试';
        } finally {
          submitting.value = false;
        }
      }

      async function submitFollowUp() {
        detailFormError.followUp = '';
        const content = followUpForm.content.trim();
        if (!selectedOpportunity.value?.id) return;
        if (!content) {
          detailFormError.followUp = '请填写跟进内容';
          return;
        }
        if (content.length > 500) {
          detailFormError.followUp = '跟进内容不能超过500字';
          return;
        }
        if (!stageOptions.some(item => item.value === followUpForm.stage)) {
          detailFormError.followUp = '请选择正确的商机阶段';
          return;
        }
        submitting.value = true;
        try {
          await mobileRequest(`/opportunities/${encodeURIComponent(selectedOpportunity.value.id)}/follow-ups`, {
            method: 'POST',
            body: { ...followUpForm, content }
          });
          Object.assign(followUpForm, { type: '电话', stage: selectedOpportunity.value?.stage || 'contacted', content: '', nextFollowAt: '' });
          await loadDetail();
          await fetchCollection('opportunities', '/opportunities');
          flash('商机跟进已记录');
        } catch (error) {
          detailFormError.followUp = error.message || '跟进提交失败，请稍后重试';
        } finally {
          submitting.value = false;
        }
      }

      async function submitQuoteConvertOrder() {
        detailFormError.convertOrder = '';
        if (!selectedQuote.value?.id) return;
        if (!quoteOrderForm.deliveryContactName.trim() || !quoteOrderForm.deliveryContactPhone.trim() || !quoteOrderForm.deliveryAddress.trim()) {
          detailFormError.convertOrder = '交付联系人、联系电话和交付地址不能为空';
          return;
        }
        if (!validPhone(quoteOrderForm.deliveryContactPhone)) {
          detailFormError.convertOrder = '请输入正确的联系电话';
          return;
        }
        if (quoteOrderForm.deliveryAddress.trim().length > 240) {
          detailFormError.convertOrder = '交付地址不能超过240字';
          return;
        }
        if (!window.confirm('确认将该已确认报价转为订单吗？')) return;
        submitting.value = true;
        try {
          const result = await mobileRequest(`/quotes/${encodeURIComponent(selectedQuote.value.id)}/convert-order`, {
            method: 'POST',
            body: {
              deliveryContactName: quoteOrderForm.deliveryContactName.trim(),
              deliveryContactPhone: quoteOrderForm.deliveryContactPhone.trim(),
              deliveryAddress: quoteOrderForm.deliveryAddress.trim(),
              invoiceTitle: quoteOrderForm.invoiceTitle.trim(),
              remark: quoteOrderForm.remark.trim()
            }
          });
          Object.assign(quoteOrderForm, { deliveryContactName: '', deliveryContactPhone: '', deliveryAddress: '', invoiceTitle: '', remark: '' });
          await Promise.all([fetchCollection('quotes', '/quotes'), fetchCollection('orders', '/orders')]);
          const orderId = result.data?.id;
          flash('已转为订单，请等待下一步审批');
          if (orderId) go(`/partner/orders/${encodeURIComponent(orderId)}`);
          else await loadDetail();
        } catch (error) {
          detailFormError.convertOrder = error.message || '转订单失败，请稍后重试';
        } finally {
          submitting.value = false;
        }
      }

      function openPartnerDetail(type, item) {
        const routeMap = { opportunities: 'opportunities', registrations: 'registrations', quotes: 'quotes', orders: 'orders' };
        go(`/partner/${routeMap[type]}/${encodeURIComponent(item.id)}`);
      }

      function openBusinessDetail(item) {
        go(`/admin/business/${businessType.value}/${encodeURIComponent(item.id)}`);
      }

      function openAdminPartner(item) {
        go(`/admin/partners/${encodeURIComponent(item.id)}`);
      }

      function openReview(kind, item) {
        reviewDialog.visible = true;
        reviewDialog.kind = kind;
        reviewDialog.item = item;
        reviewDialog.title = kind === 'registration' ? '审核客户报备' : kind === 'partner' ? '审核渠道商申请' : '审核账号申请';
        reviewDialog.action = 'approve';
        reviewDialog.remark = '';
        reviewDialog.error = '';
      }

      function openRegistrationReview(item) { openReview('registration', item); }
      function openPartnerReview(item) { openReview('partner', item); }
      function openAccountReview(item) { openReview('account', item); }
      function closeReview() { Object.assign(reviewDialog, { visible: false, kind: '', item: null, title: '', action: 'approve', remark: '', error: '' }); }
      function prepareReject() { reviewDialog.action = 'reject'; reviewDialog.error = ''; }

      async function approveReview() {
        reviewDialog.error = '';
        if (!reviewDialog.item) return;
        if (reviewDialog.action === 'reject' && !reviewDialog.remark.trim()) {
          reviewDialog.error = '请填写驳回原因';
          return;
        }
        const actionName = reviewDialog.action === 'approve' ? '通过' : '驳回';
        if (!window.confirm(`确认${actionName}“${recordName(reviewDialog.item)}”吗？`)) return;
        submitting.value = true;
        try {
          if (reviewDialog.kind === 'registration') {
            await mobileRequest(`/registrations/${encodeURIComponent(reviewDialog.item.id)}/status`, {
              method: 'PUT', body: { status: reviewDialog.action === 'approve' ? 'approved' : 'rejected', remark: reviewDialog.remark.trim() }
            });
          } else if (reviewDialog.kind === 'partner') {
            await mobileRequest(`/partners/${encodeURIComponent(reviewDialog.item.id)}/status`, {
              method: 'PUT', body: { status: reviewDialog.action === 'approve' ? 'active' : 'rejected', remark: reviewDialog.remark.trim() }
            });
          } else {
            await mobileRequest(`/pending-approvals/${encodeURIComponent(reviewDialog.item.id)}`, {
              method: 'PUT', body: { action: reviewDialog.action, remark: reviewDialog.remark.trim() }
            });
          }
          closeReview();
          await reloadForRoute();
          flash(`已${actionName}`);
        } catch (error) {
          reviewDialog.error = error.message || '审核处理失败，请稍后重试';
        } finally {
          submitting.value = false;
        }
      }

      function logout(showMessage = true) {
        singleSignOnPaused = true;
        ssoState.attempted = true;
        // 令牌撤销不阻塞本地退出；即使网络不可用也不能保留本地业务页面访问入口。
        window.fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
        mobileRequest('/logout', { method: 'POST' }).catch(() => {});
        clearMobileSession();
        user.value = null;
        opportunities.value = [];
        registrations.value = [];
        quotes.value = [];
        orders.value = [];
        partners.value = [];
        pendingApprovals.value = [];
        reviewRegistrations.value = [];
        reviewPartners.value = [];
        reviewAccounts.value = [];
        Object.values(pageMeta).forEach(meta => Object.assign(meta, { page: 1, pageSize: 20, total: 0, hasMore: false }));
        Object.values(reviewPageMeta).forEach(meta => Object.assign(meta, { page: 1, pageSize: 20, total: 0, hasMore: false }));
        if (showMessage) flash('已退出登录');
        window.location.href = '/login';
      }

      let registrationPickerTimer = null;
      let companyPickerTimer = null;
      watch(() => [filters.keyword, filters.opportunityStage, filters.registrationStatus, businessType.value], reloadActiveCollection);
      watch(page, reloadForRoute);
      watch(() => registrationPicker.keyword, () => {
        if (page.value !== 'opportunity-new') return;
        const keyword = registrationPicker.keyword.trim();
        if (registrationPicker.selected && keyword === recordName(registrationPicker.selected)) return;
        registrationPicker.selected = null;
        opportunityForm.regId = '';
        registrationPicker.open = false;
        window.clearTimeout(registrationPickerTimer);
        if (keyword.length < 2) {
          Object.assign(registrationPicker, { items: [], page: 1, total: 0, hasMore: false, loading: false });
          return;
        }
        registrationPickerTimer = window.setTimeout(() => { loadApprovedRegistrations(); }, 250);
      });
      watch(() => registrationForm.customer, () => {
        if (page.value !== 'registration-new') return;
        const keyword = registrationForm.customer.trim();
        if (keyword === companyPicker.selectedName) return;
        if (companyPicker.filled) {
          if (registrationForm.creditCode === companyPicker.filledCreditCode) registrationForm.creditCode = '';
          if (registrationForm.industry === companyPicker.filledIndustry) registrationForm.industry = '';
          if (registrationForm.city === companyPicker.filledCity) registrationForm.city = '';
        }
        companyPicker.selectedName = '';
        companyPicker.filledCreditCode = '';
        companyPicker.filledIndustry = '';
        companyPicker.filledCity = '';
        companyPicker.filled = false;
        companyPicker.open = false;
        window.clearTimeout(companyPickerTimer);
        if (keyword.length < 2) {
          companyPicker.items = [];
          return;
        }
        companyPickerTimer = window.setTimeout(() => { searchRegistrationCompany(); }, 300);
      });

      onMounted(async () => {
        if (!scope.value) {
          ready.value = true;
          return;
        }
        await restoreLogin();
        ready.value = true;
        syncRoute();
        if (page.value === 'registration-new') restoreDraft('registration');
        if (page.value === 'opportunity-new') restoreDraft('opportunity');
        if (user.value) await reloadForRoute();
      });

      window.addEventListener('hashchange', syncRoute);
      window.addEventListener('mobile-auth-expired', () => {
        if (user.value) logout(false);
      });

      return {
        scope, ready, user, submitting, loginError, formError, toast, loginForm, ssoState, filters, businessType,
        opportunities, registrations, quotes, orders, partners, pendingApprovals, reviewRegistrations, reviewPartners, reviewPendingAccounts,
        pageMeta, loading, reviewPageMeta, reviewLoading, reviewDialog, registrationForm, opportunityForm, followUpTypeOptions, followUpForm, quoteOrderForm, detailFormError, companyPicker,
        isPartnerScope, isAdminScope, isSuperAdmin, roleName, stageOptions, registrationStatusOptions, industries, businessTabs,
        navigation, page, pageTitle, showNavigation, showBack, pendingRegistrations, pendingRegistrationCount,
        pendingPartners, pendingAccounts, pendingApprovalCount, filteredOpportunities, filteredRegistrations, filteredQuotes,
        filteredOrders, filteredPartners, businessItems, businessCollectionKey, businessPageMeta, selectedOpportunity, selectedRegistration, selectedQuote, selectedOrder,
        selectedPartner, canAddFollowUp, canConvertSelectedQuote, selectedQuoteConvertedText, businessDetailType, selectedBusinessItem, reviewDialogRows,
        chooseScope, backToScope, go, goBack, isNavActive, loadPageData, loadMore, loadMoreReview, loadMoreApprovedRegistrations, login, logout,
        submitRegistration, submitOpportunity, fillOpportunityFromRegistration, openOpportunityRegistrationPicker, hideOpportunityRegistrationPicker, selectOpportunityRegistration,
        submitFollowUp, submitQuoteConvertOrder,
        openRegistrationCompanyPicker, hideRegistrationCompanyPicker, selectRegistrationCompany, openPartnerDetail, openBusinessDetail, openAdminPartner,
        openRegistrationReview, openPartnerReview, openAccountReview, closeReview, prepareReject, approveReview,
        registrationPicker, detailMessage, saveDraft, clearDraft, statusClass, stageText: statusText, recordName, formatDate, formatDateTime, formatAmount
      };
    }
  }).mount('#mobileApp');
})();
