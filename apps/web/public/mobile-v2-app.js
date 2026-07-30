/*
 * 移动端二期界面。
 * 写入交互仅在服务端功能开关、业务参数和发布契约同时确认后执行。
 */
(function (window, document) {
  'use strict';

  const root = document.getElementById('mobileV2App');
  const api = window.MobileV2Api;
  if (!root || !api || !api.isExperimentalEnabled()) {
    if (api) {
      api.clearSession();
      api.clearPublishedWriteContracts();
    }
    if (root) {
      const main = document.createElement('main');
      const badge = document.createElement('span');
      const title = document.createElement('h1');
      const text = document.createElement('p');
      const link = document.createElement('a');
      main.className = 'v2-disabled';
      main.setAttribute('role', 'main');
      badge.className = 'v2-badge';
      badge.textContent = '移动端二期';
      title.textContent = '当前未开放';
      text.textContent = '生产环境只开放一期手机端。二期代码已随包保留，但入口、会话接续和接口请求默认关闭，不会读取一期登录态或发起业务请求。';
      link.className = 'v2-disabled__link';
      link.href = 'mobile.html';
      link.textContent = '返回一期手机端';
      main.append(badge, title, text, link);
      root.replaceChildren(main);
    }
    return;
  }
  const PARTNER_ROLES = ['staff', 'partner_admin'];
  const ADMIN_ROLES = ['admin', 'superadmin'];
  const STATUS_TEXT = {
    pending: '待审核', reviewing: '审核中', approved: '已通过', rejected: '已驳回',
    active: '已生效', inactive: '已停用', disabled: '已停用', draft: '草稿', sent: '已发送',
    confirmed: '已确认', converted: '已转订单', processing: '处理中', shipped: '已发货',
    completed: '已完成', cancelled: '已取消', contacted: '已联系', registered: '已报备',
    quoted: '已报价', budget: '明确预算', design: '方案设计', testing: '产品测试',
    negotiation: '商务谈判', won: '已赢单', lost: '已丢失', primary_confirmed: '一级已确认',
    primary_rejected: '一级已驳回'
  };
  const STATUS_OPTIONS = [
    ['pending', '待审核'], ['reviewing', '审核中'], ['approved', '已通过'], ['rejected', '已驳回'],
    ['draft', '草稿'], ['sent', '已发送'], ['confirmed', '已确认'], ['converted', '已转订单'],
    ['primary_confirmed', '一级已确认'], ['primary_rejected', '一级已驳回'], ['processing', '处理中'], ['shipped', '已发货'], ['completed', '已完成'], ['cancelled', '已取消'],
    ['contacted', '已联系'], ['registered', '已报备'], ['quoted', '已报价'], ['budget', '明确预算'],
    ['design', '方案设计'], ['testing', '产品测试'], ['negotiation', '商务谈判'], ['won', '已赢单'], ['lost', '已丢失'],
    ['active', '已生效'], ['inactive', '已停用']
  ];
  const OPPORTUNITY_STAGE_FLOW = {
    contacted: ['registered'], registered: ['quoted'], quoted: ['budget'], budget: ['design'],
    design: ['testing'], testing: ['negotiation'], negotiation: ['won', 'lost', 'cancelled']
  };
  // 只有后端在功能开关响应中同时确认接口已发布时，后续联调才可解除此处的发布门禁。
  const WRITE_CONTRACTS = {
    'registration-draft': { module: 'registration', action: 'create', path: '/registration-drafts', method: 'POST', label: '保存报备草稿' },
    'registration-submit': { module: 'registration', action: 'submit', path: '/registrations', method: 'POST', label: '提交报备' },
    'registration-review': { module: 'registration', action: 'review', path: '/registrations/:id/review', method: 'PUT', label: '审核报备' },
    'opportunity-create': { module: 'opportunity', action: 'create', path: '/opportunities', method: 'POST', label: '创建商机' },
    'opportunity-update': { module: 'opportunity', action: 'update', path: '/opportunities/:id', method: 'PUT', label: '编辑商机' },
    'opportunity-advance': { module: 'opportunity', action: 'advance', path: '/opportunities/:id/stage', method: 'PUT', label: '推进商机阶段' },
    'opportunity-follow-up': { module: 'opportunity', action: 'follow_up', path: '/opportunities/:id/follow-ups', method: 'POST', label: '提交跟进' },
    'quote-preview': { module: 'quote', action: 'create', path: '/quotes/preview', method: 'POST', label: '服务端试算' },
    'quote-draft': { module: 'quote', action: 'create', path: '/quote-drafts', method: 'POST', label: '保存报价草稿' },
    'quote-submit': { module: 'quote', action: 'submit', path: '/quotes', method: 'POST', label: '提交报价' },
    'quote-discount-review': { module: 'quote', action: 'review', path: '/quotes/:id/discount-review', method: 'PUT', label: '审核报价折扣' },
    'quote-confirm': { module: 'quote', action: 'review', path: '/quotes/:id/confirm', method: 'PUT', label: '确认报价' },
    'order-draft': { module: 'order', action: 'create', path: '/order-drafts', method: 'POST', label: '保存订单草稿' },
    'order-submit': { module: 'order', action: 'submit', path: '/orders/:id/submit', method: 'POST', label: '提交订单' },
    'order-primary-review': { module: 'order', action: 'primary_review', path: '/orders/:id/primary-review', method: 'PUT', label: '一级渠道确认' },
    'order-fulfill': { module: 'order', action: 'fulfill', path: '/orders/:id/fulfillment', method: 'PUT', label: '推进订单履约' }
  };
  const moduleDefinitions = {
    partner: {
      home: { title: '渠道工作台', endpoint: '/dashboard', label: '渠道经营概览', type: 'dashboard' },
      registrations: { title: '客户报备', endpoint: '/registrations', label: '客户报备', type: 'registration' },
      opportunities: { title: '商机管理', endpoint: '/opportunities', label: '商机', type: 'opportunity' },
      quotes: { title: '报价管理', endpoint: '/quotes', label: '报价单', type: 'quote' },
      orders: { title: '订单管理', endpoint: '/orders', label: '订单', type: 'order' },
      catalog: { title: '产品目录', endpoint: '/catalog', label: '产品目录', type: 'catalog' },
      notifications: { title: '消息通知', endpoint: '/notifications', label: '消息通知', type: 'notification' },
      me: { title: '我的', label: '个人中心', type: 'profile' }
    },
    admin: {
      home: { title: '厂商工作台', endpoint: '/dashboard', label: '管理概览', type: 'dashboard' },
      approvals: { title: '审核中心', label: '审核操作', type: 'approval', frozen: true },
      business: { title: '业务中心', endpoint: '/dashboard', label: '区域业务概览', type: 'dashboard' },
      registrations: { title: '客户报备', endpoint: '/registrations', label: '客户报备', type: 'registration' },
      opportunities: { title: '商机管理', endpoint: '/opportunities', label: '商机', type: 'opportunity' },
      quotes: { title: '报价管理', endpoint: '/quotes', label: '报价单', type: 'quote' },
      orders: { title: '订单管理', endpoint: '/orders', label: '订单', type: 'order' },
      partners: { title: '渠道协作', endpoint: '/partners', label: '渠道商', type: 'partner' },
      catalog: { title: '产品目录', endpoint: '/catalog', label: '产品目录', type: 'catalog' },
      notifications: { title: '消息通知', endpoint: '/notifications', label: '消息通知', type: 'notification' },
      me: { title: '我的', label: '个人中心', type: 'profile' }
    }
  };

  const state = {
    scope: getScope(),
    session: api.getStoredSession(),
    restoring: false,
    loginError: '',
    notice: '',
    module: createModuleState(),
    filters: {},
    featureFlags: createFeatureFlagState(),
    write: createWriteState(),
    moduleRequestId: 0
  };

  function createModuleState() {
    return {
      key: '', status: 'idle', message: '', data: null, label: '', type: '',
      pagination: { page: 1, pageSize: 20, total: 0, hasMore: false }, filters: { keyword: '', status: '' }
    };
  }

  function createFeatureFlagState() {
    return { status: 'idle', modules: {}, contracts: {}, message: '' };
  }

  function createWriteState() {
    return { forms: {}, feedback: null, idempotencyKeys: {}, submitting: {}, quotePreviews: {}, parentOptions: {} };
  }

  function getScope() {
    const value = new URLSearchParams(window.location.search).get('scope');
    return value === 'partner' || value === 'admin' ? value : '';
  }

  function getRoute() {
    const route = window.location.hash.replace(/^#/, '') || '';
    return route.startsWith('/') ? route : '';
  }

  function setRoute(route, replace) {
    const target = `#${route}`;
    if (replace) window.history.replaceState(null, '', target);
    else window.location.hash = route;
  }

  function chooseScope(scope) {
    const url = new URL(window.location.href);
    url.searchParams.set('scope', scope);
    url.hash = '/login';
    window.location.assign(url.toString());
  }

  function clearScope() {
    const url = new URL(window.location.href);
    url.searchParams.delete('scope');
    url.hash = '/entry';
    window.location.assign(url.toString());
  }

  function roleName(user) {
    return {
      staff: '渠道员工', partner_admin: '渠道管理员', admin: '区域管理员', superadmin: '超级管理员'
    }[user && user.role] || '未知角色';
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function isScopeMatched() {
    if (!state.session || !state.session.user || !state.scope) return false;
    const role = state.session.user.role;
    return state.scope === 'partner' ? PARTNER_ROLES.includes(role) : ADMIN_ROLES.includes(role);
  }

  function getFeatureEnabled(moduleName, action) {
    return state.featureFlags.status === 'ready'
      && state.featureFlags.modules[moduleName]
      && state.featureFlags.modules[moduleName][action] === true;
  }

  function isCurrentRoleAllowedForWrite(contractKey) {
    const role = state.session && state.session.user ? state.session.user.role : '';
    if (['registration-review', 'quote-discount-review', 'order-fulfill'].includes(contractKey)) return ADMIN_ROLES.includes(role);
    if (['quote-confirm', 'order-primary-review'].includes(contractKey)) return role === 'partner_admin';
    return PARTNER_ROLES.includes(role);
  }

  function canShowWriteAction(contractKey) {
    const contract = WRITE_CONTRACTS[contractKey];
    return Boolean(contract && isCurrentRoleAllowedForWrite(contractKey) && getFeatureEnabled(contract.module, contract.action));
  }

  function canShowTimeline(type) {
    return getFeatureEnabled(type, 'read');
  }

  function getPublishedContract(contractKey) {
    const contract = state.featureFlags.contracts[contractKey];
    const apiContract = api.getPublishedWriteContract(contractKey);
    return contract && contract.published === true && apiContract ? contract : null;
  }

  function normalizeFeatureContracts(source) {
    const entries = Array.isArray(source)
      ? source.map(function (item) { return [item && item.key, item]; })
      : Object.entries(source && typeof source === 'object' ? source : {});
    return entries.reduce(function (result, entry) {
      const key = String(entry[0] || '').trim();
      const value = entry[1] && typeof entry[1] === 'object' ? entry[1] : {};
      const expected = WRITE_CONTRACTS[key];
      if (!expected) return result;
      result[key] = {
        published: value.published === true,
        businessConfigReady: value.businessConfigReady !== false,
        method: String(value.method || '').toUpperCase(),
        path: String(value.path || '').trim()
      };
      return result;
    }, {});
  }

  function getWriteGateMessage(contractKey) {
    const contract = WRITE_CONTRACTS[contractKey];
    if (!contract) return '当前操作契约不存在，未执行任何请求。';
    if (state.featureFlags.status === 'loading' || state.featureFlags.status === 'idle') return '正在读取服务端功能开关，写入入口保持关闭。';
    if (state.featureFlags.status === 'error') return '无法确认服务端功能开关，写入入口保持关闭。';
    if (!canShowWriteAction(contractKey)) return '服务端尚未对当前账号开放此操作，未执行任何请求。';
    const rawContract = state.featureFlags.contracts[contractKey];
    if (rawContract && rawContract.businessConfigReady === false) return 'BUSINESS_CONFIG_MISSING：服务端业务参数未配置，当前操作已停止且不会自动重试。';
    if (!getPublishedContract(contractKey)) return '服务端尚未确认该写接口已发布，表单仅用于交互校验，不会发送任何写请求。';
    return '';
  }

  function getOperationTitle(module) {
    const titles = {
      'registration-draft': '新建客户报备', 'registration-review': '审核客户报备', 'registration-events': '报备时间线',
      'opportunity-create': '从报备创建商机', 'opportunity-edit': '编辑商机', 'opportunity-advance': '推进商机阶段',
      'opportunity-follow-up': '新增跟进', 'opportunity-events': '商机时间线',
      'quote-draft': '新建报价', 'quote-submit': '提交报价', 'quote-discount-review': '审核报价折扣',
      'quote-confirm': '确认报价', 'quote-events': '报价时间线', 'order-draft': '创建订单草稿', 'order-submit': '提交订单',
      'order-primary-review': '一级渠道确认', 'order-fulfill': '订单履约', 'order-events': '订单时间线'
    };
    return titles[module.operation] || module.title;
  }

  function createIdempotencyKey(contractKey) {
    const suffix = window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `mobile-v2-${contractKey}-${suffix}`;
  }

  function getWriteErrorMessage(error) {
    const code = error && error.code ? error.code : '';
    if (code === 'BUSINESS_CONFIG_MISSING') return '业务参数尚未配置，操作已停止；请由管理员完成配置后重新发起，不会自动重试。';
    if (code === 'HISTORY_MAPPING_REQUIRED') return '该对象属于未完成映射的历史数据，只允许查询，不能从移动端写入。';
    if (code === 'DUPLICATE_PROTECTED') return '当前输入存在受保护的重复信息，未返回其他渠道或联系人资料。';
    if (code === 'OPPORTUNITY_EXISTS') return '该报备已有活动商机，未创建重复商机。';
    if (code === 'ORDER_EXISTS') return '该报价已有订单草稿或已转为订单，未重复创建；请刷新后确认当前状态。';
    if (code === 'QUOTE_EXPIRED') return '报价已过期，不能继续提交或转订单；请刷新后确认当前状态。';
    if (code === 'PRICE_CONFLICT' || code === 'QUOTE_AMOUNT_CONFLICT') return '服务端试算金额已变化或存在冲突，未执行写入；请重新试算后确认。';
    if (code === 'STATE_CONFLICT' || code === 'IDEMPOTENCY_CONFLICT') return '数据已被其他操作更新、金额已变化或请求标识冲突，未自动重试；请刷新后确认当前状态。';
    if (code === 'FEATURE_DISABLED') return '服务端已关闭当前功能，未执行写入。';
    if (error && error.status === 403) return '无权执行当前操作，未执行写入。';
    return '操作未完成，页面不会自动重试写入。';
  }

  async function loadFeatureFlags() {
    if (!state.session || state.featureFlags.status === 'loading') return;
    api.clearPublishedWriteContracts();
    state.featureFlags = { ...createFeatureFlagState(), status: 'loading' };
    render();
    try {
      const result = await api.request('/feature-flags');
      const data = result && result.data && typeof result.data === 'object' ? result.data : {};
      const modules = data.modules && typeof data.modules === 'object' ? data.modules : {};
      // 未提供 contracts 时按未发布处理；不能仅凭页面内约定解除写请求门禁。
      const contracts = normalizeFeatureContracts(data.contracts);
      api.setPublishedWriteContracts(contracts);
      state.featureFlags = { status: 'ready', modules, contracts, message: '' };
    } catch (error) {
      api.clearPublishedWriteContracts();
      state.featureFlags = {
        ...createFeatureFlagState(), status: 'error',
        message: error.code === 'FEATURE_DISABLED' ? '服务端已关闭当前功能。' : '功能开关读取失败。'
      };
    }
    render();
  }

  function getCurrentModule() {
    const routeParts = getRoute().split('/').filter(Boolean);
    const section = routeParts[0] || state.scope;
    const page = routeParts[1] || 'home';
    const definition = moduleDefinitions[state.scope] && moduleDefinitions[state.scope][page];
    if (section !== state.scope || !definition) return null;
    const canWrite = ['registration', 'opportunity', 'quote', 'order'].includes(definition.type);
    let recordId = '';
    let operation = '';
    let relatedId = '';
    const target = routeParts[2] || '';
    const operationSegment = routeParts[3] || '';
    if (canWrite && target === 'new') {
      if (definition.type === 'registration') operation = 'registration-draft';
      else if (definition.type === 'opportunity') operation = 'opportunity-create';
      else if (definition.type === 'quote') operation = 'quote-draft';
      else return null;
      if (routeParts[3]) {
        try {
          relatedId = decodeURIComponent(routeParts[3]);
        } catch (error) {
          return null;
        }
      }
      if (definition.type === 'registration' && relatedId) return null;
    } else if (target && ['registration', 'opportunity', 'quote', 'order', 'partner'].includes(definition.type)) {
      try {
        recordId = decodeURIComponent(target);
      } catch (error) {
        return null;
      }
      if (operationSegment) {
        const operationMap = {
          registration: ['review', 'events'],
          opportunity: ['edit', 'advance', 'follow-up', 'events'],
          quote: ['submit', 'discount-review', 'confirm', 'order', 'events'],
          order: ['primary-review', 'fulfill', 'events']
        };
        if (!canWrite || !(operationMap[definition.type] || []).includes(operationSegment) || routeParts[4]) return null;
        operation = definition.type === 'quote' && operationSegment === 'order'
          ? 'order-draft'
          : `${definition.type}-${operationSegment}`;
      }
    } else if (target) {
      return null;
    }
    return { page, recordId, relatedId, operation, ...definition };
  }

  function guardRoute() {
    const route = getRoute();
    if (!state.scope) {
      if (route !== '/entry') setRoute('/entry', true);
      return;
    }
    if (!state.session) {
      if (route !== '/login') setRoute('/login', true);
      return;
    }
    if (!isScopeMatched()) {
      api.clearSession();
      api.clearPublishedWriteContracts();
      state.session = null;
      state.featureFlags = createFeatureFlagState();
      state.write = createWriteState();
      state.loginError = '当前账号不属于所选入口，请切换入口后重新登录。';
      setRoute('/login', true);
      return;
    }
    if (!getCurrentModule()) setRoute(`/${state.scope}/home`, true);
  }

  function entryView() {
    return `
      <main class="v2-entry">
        <span class="v2-badge">移动端二期 · 独立灰度入口</span>
        <h1>请选择访问入口</h1>
        <p>二期与一期独立部署。当前入口不会读取或调用电脑端历史业务接口。</p>
        <button class="v2-scope-card" type="button" data-action="choose-scope" data-scope="partner">
          <span class="v2-scope-card__icon">🤝</span><span><strong>渠道伙伴</strong><small>报备、商机、报价、订单与协作能力</small></span><b>›</b>
        </button>
        <button class="v2-scope-card" type="button" data-action="choose-scope" data-scope="admin">
          <span class="v2-scope-card__icon">🏢</span><span><strong>厂商管理</strong><small>审核、业务、渠道和经营协作能力</small></span><b>›</b>
        </button>
        <p class="v2-entry__hint">一期入口仍保留，可在二期灰度期间随时回退。</p>
      </main>`;
  }

  function loginView() {
    const title = state.scope === 'partner' ? '渠道伙伴移动端二期' : '厂商管理移动端二期';
    return `
      <main class="v2-login">
        <span class="v2-badge">${state.scope === 'partner' ? '渠道伙伴入口' : '厂商管理入口'} · 兼容测试</span>
        <h1>${title}</h1>
        <p>二期基础服务当前仅提供 Bearer 鉴权的只读接口。请先完成一期登录，再由二期校验并接续当前会话。</p>
        <section class="v2-form">
          <strong>登录态接续（仅兼容测试）</strong>
          <span>二期不重新实现登录，只读取一期已存在会话并在当前标签页保存；接续后必须通过二期 <code>/me</code> 校验。</span>
          ${state.loginError ? `<p class="v2-message v2-message--error" role="alert">${escapeHtml(state.loginError)}</p>` : ''}
          <button class="v2-button v2-button--primary" type="button" data-action="adopt-session">接续当前登录态</button>
          <button class="v2-button v2-button--secondary" type="button" data-action="open-v1-login">前往一期登录</button>
        </section>
        <button class="v2-text-button" type="button" data-action="clear-scope">切换入口</button>
      </main>`;
  }

  function moduleStatusView() {
    const module = state.module;
    if (module.status === 'loading' || module.status === 'idle') {
      return `<section class="v2-state"><span class="v2-spinner"></span><strong>正在连接二期服务…</strong><p>不会请求一期或电脑端业务接口。</p></section>`;
    }
    if (module.status === 'not-ready') {
      return `<section class="v2-state"><span>🚧</span><strong>${escapeHtml(module.label || '当前功能')}建设中</strong><p>${escapeHtml(module.message || '二期业务接口尚未发布，请等待灰度开关开放。')}</p></section>`;
    }
    if (module.status === 'frozen') {
      return `<section class="v2-state"><span>🔒</span><strong>${escapeHtml(module.label || '写入功能')}规则冻结后开放</strong><p>${escapeHtml(module.message || '二期基础接口当前仅开放只读查询。审核、提交、调价和状态变更将在状态机、审计和幂等规则确认后开放。')}</p></section>`;
    }
    if (module.status === 'empty') {
      return `<section class="v2-state"><span>🗂️</span><strong>暂无可展示数据</strong><p>${escapeHtml(module.message || '服务已响应，但当前权限范围内没有数据。')}</p></section>`;
    }
    if (module.status === 'error') {
      return `<section class="v2-state"><span>⚠️</span><strong>加载失败</strong><p>${escapeHtml(module.message)}</p><button class="v2-button v2-button--secondary" type="button" data-action="reload-module">重新加载</button></section>`;
    }
    return '';
  }

  function statusText(value) {
    return STATUS_TEXT[value] || value || '—';
  }

  function statusTone(value) {
    if (['approved', 'active', 'confirmed', 'completed', 'won'].includes(value)) return ' v2-status--success';
    if (['rejected', 'cancelled', 'lost', 'disabled', 'inactive', 'primary_rejected'].includes(value)) return ' v2-status--danger';
    if (['pending', 'reviewing', 'draft', 'sent', 'contacted', 'registered', 'quoted', 'budget', 'design', 'testing', 'negotiation', 'primary_confirmed', 'processing', 'shipped'].includes(value)) return ' v2-status--warning';
    return '';
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

  function formatValue(value, field) {
    if (value === undefined || value === null || value === '') return '—';
    if (['amount', 'total', 'estimatedAmt', 'originalTotal', 'discountAmount'].includes(field)) return escapeHtml(formatAmount(value));
    if (/(At|Date|Close)$/.test(field) || ['signDate', 'expireAt', 'joinDate'].includes(field)) return escapeHtml(formatDate(value));
    if (field === 'status' || field === 'stage') return escapeHtml(statusText(value));
    if (field === 'approvalStatus') return escapeHtml({ not_required: '无需折扣审核', pending: '待折扣审核', approved: '折扣审核已通过', rejected: '折扣审核已驳回' }[value] || value);
    if (Array.isArray(value)) return value.length ? `共 ${value.length} 项` : '—';
    if (typeof value === 'object') return '已记录';
    return escapeHtml(value);
  }

  function recordTitle(item, type) {
    if (type === 'partner') return item.name || item.id || '未命名渠道商';
    return item.name || item.customerName || item.customer || item.id || '未命名记录';
  }

  function recordSubtitle(item, type) {
    const amount = type === 'registration' ? item.estimatedAmt : (item.total !== undefined ? item.total : item.amount);
    const parts = [];
    if (type === 'partner') {
      if (item.region) parts.push(item.region);
      if (item.city) parts.push(item.city);
      if (item.contact) parts.push(item.contact);
    } else {
      if (item.partnerName) parts.push(item.partnerName);
      else if (item.customer) parts.push(item.customer);
      if (amount !== undefined && amount !== null && amount !== '') parts.push(formatAmount(amount));
      if (item.updatedAt || item.createdAt) parts.push(formatDate(item.updatedAt || item.createdAt));
    }
    return parts.filter(Boolean).join(' · ') || '暂无补充信息';
  }

  function listFiltersView(module) {
    const filters = state.module.filters || { keyword: '', status: '' };
    const stageLabel = module.type === 'opportunity' ? '阶段' : '状态';
    const placeholder = module.type === 'partner' ? '搜索渠道商、地区或编号' : `搜索${module.label}名称、客户或编号`;
    return `
      <form class="v2-filter" data-form="record-filter">
        <label class="v2-filter__search"><span class="v2-visually-hidden">搜索</span><input name="keyword" value="${escapeHtml(filters.keyword)}" type="search" maxlength="100" placeholder="${escapeHtml(placeholder)}" autocomplete="off" /></label>
        <label class="v2-filter__select"><span class="v2-visually-hidden">${stageLabel}</span><select name="status"><option value="">全部${stageLabel}</option>${STATUS_OPTIONS.map(function (option) {
          return `<option value="${option[0]}"${filters.status === option[0] ? ' selected' : ''}>${option[1]}</option>`;
        }).join('')}</select></label>
        <button class="v2-filter__submit" type="submit">查询</button>
        ${(filters.keyword || filters.status) ? '<button class="v2-filter__reset" type="button" data-action="reset-filter">重置</button>' : ''}
      </form>`;
  }

  function recordListView(module) {
    const records = Array.isArray(state.module.data) ? state.module.data : [];
    const pagination = state.module.pagination;
    const items = records.map(function (item) {
      const status = item.stage || item.status;
      return `<button class="v2-record-card" type="button" data-action="open-detail" data-id="${escapeHtml(item.id)}">
        <span class="v2-status${statusTone(status)}">${escapeHtml(statusText(status))}</span>
        <strong>${escapeHtml(recordTitle(item, module.type))}</strong>
        <small>${escapeHtml(recordSubtitle(item, module.type))}</small><b>›</b>
      </button>`;
    }).join('');
    const paging = pagination.hasMore
      ? `<button class="v2-load-more" type="button" data-action="load-more"${state.module.status === 'loading-more' ? ' disabled' : ''}>${state.module.status === 'loading-more' ? '正在加载…' : '加载更多'}</button>`
      : (records.length ? `<p class="v2-list-end">已显示 ${records.length} / ${pagination.total} 条</p>` : '');
    return `${listWriteEntryView(module)}${listFiltersView(module)}<p class="v2-list-summary">${pagination.total ? `共 ${pagination.total} 条${module.label}` : ''}</p>${records.length ? `<section class="v2-record-list">${items}</section>${paging}` : moduleStatusView()}`;
  }

  function buildWriteRoute(page, operation, recordId) {
    const encodedId = recordId ? `/${encodeURIComponent(recordId)}` : '';
    if (operation === 'registration-draft') return `/${state.scope}/registrations/new`;
    if (operation === 'opportunity-create') return `/${state.scope}/opportunities/new${encodedId}`;
    if (operation === 'quote-draft') return `/${state.scope}/quotes/new`;
    if (operation === 'order-draft') return `/${state.scope}/quotes${encodedId}/order`;
    const suffix = operation.replace(/^(registration|opportunity|quote|order)-/, '');
    return `/${state.scope}/${page}${encodedId}/${suffix}`;
  }

  function writeRouteButton(label, page, operation, recordId, className) {
    const route = buildWriteRoute(page, operation, recordId);
    return `<button class="${className || 'v2-button v2-button--secondary'}" type="button" data-action="go-write" data-route="${escapeHtml(route)}">${escapeHtml(label)}</button>`;
  }

  function featureClosedView(message) {
    return `<section class="v2-state v2-state--compact"><span>🔒</span><strong>操作未开放</strong><p>${escapeHtml(message)}</p></section>`;
  }

  function listWriteEntryView(module) {
    if (module.type === 'registration' && canShowWriteAction('registration-draft')) {
      return `<section class="v2-write-entry"><div><strong>客户报备</strong><small>服务端已对当前账号开放草稿创建入口。</small></div>${writeRouteButton('新建报备', 'registrations', 'registration-draft', '', 'v2-button v2-button--primary')}</section>`;
    }
    if (module.type === 'opportunity' && canShowWriteAction('opportunity-create')) {
      return `<section class="v2-write-entry"><div><strong>创建商机</strong><small>仅可从已审批客户报备详情发起创建。</small></div><button class="v2-button v2-button--secondary" type="button" data-action="go" data-page="registrations">选择已审批报备</button></section>`;
    }
    if (module.type === 'quote' && canShowTimeline('quote')) {
      const hint = canShowWriteAction('quote-preview') ? '选品后仅显示服务端试算结果，提交时服务端会再次重算。' : '可浏览目录与选择产品；试算、草稿和提交仍由服务端开关与参数状态决定。';
      return `<section class="v2-write-entry"><div><strong>报价选品</strong><small>${hint}</small></div>${writeRouteButton('开始选品', 'quotes', 'quote-draft', '', 'v2-button v2-button--primary')}</section>`;
    }
    return '';
  }

  function writeDetailActionsView(module, item) {
    const actions = [];
    if (module.type === 'registration') {
      if (item.status === 'approved' && canShowWriteAction('opportunity-create')) {
        actions.push(writeRouteButton('从此报备创建商机', 'opportunities', 'opportunity-create', item.id));
      }
      if (['pending', 'reviewing'].includes(item.status) && canShowWriteAction('registration-review')) {
        actions.push(writeRouteButton('审核报备', 'registrations', 'registration-review', item.id));
      }
      if (canShowTimeline('registration')) actions.push(writeRouteButton('查看时间线', 'registrations', 'registration-events', item.id));
    }
    if (module.type === 'opportunity') {
      if (canShowWriteAction('opportunity-update')) actions.push(writeRouteButton('编辑商机', 'opportunities', 'opportunity-edit', item.id));
      if (OPPORTUNITY_STAGE_FLOW[item.stage] && canShowWriteAction('opportunity-advance')) actions.push(writeRouteButton('推进阶段', 'opportunities', 'opportunity-advance', item.id));
      if (canShowWriteAction('opportunity-follow-up')) actions.push(writeRouteButton('新增跟进', 'opportunities', 'opportunity-follow-up', item.id));
      if (canShowTimeline('opportunity')) actions.push(writeRouteButton('查看时间线', 'opportunities', 'opportunity-events', item.id));
    }
    if (module.type === 'quote') {
      if (item.status === 'draft' && canShowWriteAction('quote-submit')) actions.push(writeRouteButton('提交报价', 'quotes', 'quote-submit', item.id));
      if (item.status === 'sent' && item.approvalStatus === 'pending' && canShowWriteAction('quote-discount-review')) actions.push(writeRouteButton('审核折扣', 'quotes', 'quote-discount-review', item.id));
      if (item.status === 'sent' && !['pending', 'rejected'].includes(item.approvalStatus) && canShowWriteAction('quote-confirm')) actions.push(writeRouteButton('确认报价', 'quotes', 'quote-confirm', item.id));
      if (item.status === 'confirmed' && canShowWriteAction('order-draft')) actions.push(writeRouteButton('创建订单草稿', 'quotes', 'order-draft', item.id));
      if (canShowTimeline('quote')) actions.push(writeRouteButton('查看时间线', 'quotes', 'quote-events', item.id));
    }
    if (module.type === 'order') {
      if (item.status === 'pending' && item.primaryPartnerId && canShowWriteAction('order-primary-review')) actions.push(writeRouteButton('一级渠道确认', 'orders', 'order-primary-review', item.id));
      if (((item.status === 'pending' && !item.primaryPartnerId) || ['primary_confirmed', 'processing', 'shipped'].includes(item.status)) && canShowWriteAction('order-fulfill')) actions.push(writeRouteButton('推进履约', 'orders', 'order-fulfill', item.id));
      if (canShowTimeline('order')) actions.push(writeRouteButton('查看时间线', 'orders', 'order-events', item.id));
    }
    return actions.length ? `<section class="v2-write-actions"><h2>受控操作</h2><p>入口由服务端功能开关决定；提交前仍需接口发布、权限和状态机校验。</p><div>${actions.join('')}</div></section>` : '';
  }

  function getWriteFormKey(module) {
    return `${state.scope}:${module.page}:${module.operation}:${module.recordId || module.relatedId || 'new'}`;
  }

  function getWriteValues(module, fallback) {
    return { ...fallback, ...(state.write.forms[getWriteFormKey(module)] || {}) };
  }

  function fieldValue(values, name) {
    return escapeHtml(values[name] === undefined || values[name] === null ? '' : values[name]);
  }

  function writeFeedbackView(module) {
    const feedback = state.write.feedback;
    if (!feedback || feedback.formKey !== getWriteFormKey(module)) return '';
    const className = feedback.level === 'error' ? 'v2-message--error' : 'v2-message--notice';
    return `<p class="v2-message ${className}" role="status">${escapeHtml(feedback.message)}</p>`;
  }

  function writePrepareButton(contractKey, label) {
    if (!canShowWriteAction(contractKey)) return '';
    if (getPublishedContract(contractKey)) {
      return `<button class="v2-button v2-button--primary" type="button" data-action="submit-write" data-contract="${contractKey}">${escapeHtml(label)}</button>`;
    }
    return `<button class="v2-button v2-button--primary" type="button" data-action="prepare-write" data-contract="${contractKey}">校验并生成标识（接口待发布）</button>`;
  }

  function writeFormShell(module, title, description, content, buttons) {
    return `<section class="v2-write-panel"><div class="v2-write-panel__heading"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div>${writeFeedbackView(module)}<form class="v2-business-form" data-write-form data-form-key="${escapeHtml(getWriteFormKey(module))}" novalidate>${content}<p class="v2-write-panel__hint">仅在当前页面内保存填写内容。字段格式、长度和业务参数以服务端配置版本为准；若返回 BUSINESS_CONFIG_MISSING，页面会停止操作且不自动重试。当前接口未发布时不会向服务端发送草稿、提交、审核或状态变更请求。</p><div class="v2-business-form__actions">${buttons}</div></form></section>`;
  }

  function registrationDraftView(module) {
    const values = getWriteValues(module, {
      customer: '', contact: '', phone: '', creditCode: '', industry: '', email: '', city: '', project: '', endpointRange: '', estimatedAmt: '', signDate: '', notes: ''
    });
    const available = canShowWriteAction('registration-draft') || canShowWriteAction('registration-submit');
    if (!available) return featureClosedView(getWriteGateMessage('registration-draft'));
    const content = `
      <input name="draftId" type="hidden" value="${fieldValue(values, 'draftId')}" />
      <label>客户名称<span>*</span><input name="customer" value="${fieldValue(values, 'customer')}" maxlength="200" required autocomplete="organization" placeholder="最终长度由服务端参数版本校验" /></label>
      <div class="v2-business-form__grid"><label>联系人<span>*</span><input name="contact" value="${fieldValue(values, 'contact')}" maxlength="200" required autocomplete="name" /></label><label>联系电话<span>*</span><input name="phone" value="${fieldValue(values, 'phone')}" maxlength="200" required inputmode="tel" autocomplete="tel" /></label></div>
      <label>统一社会信用代码<input name="creditCode" value="${fieldValue(values, 'creditCode')}" maxlength="200" autocapitalize="characters" placeholder="提供时参与精确查重" /></label>
      <div class="v2-business-form__grid"><label>所属行业<input name="industry" value="${fieldValue(values, 'industry')}" maxlength="200" /></label><label>所在城市<input name="city" value="${fieldValue(values, 'city')}" maxlength="200" /></label></div>
      <label>项目名称<input name="project" value="${fieldValue(values, 'project')}" maxlength="200" /></label>
      <label>联系邮箱<input name="email" value="${fieldValue(values, 'email')}" maxlength="320" inputmode="email" autocomplete="email" /></label>
      <label>预计终端范围<input name="endpointRange" value="${fieldValue(values, 'endpointRange')}" maxlength="200" /></label>
      <div class="v2-business-form__grid"><label>预计金额<input name="estimatedAmt" value="${fieldValue(values, 'estimatedAmt')}" type="number" min="0" max="999999999" step="0.01" inputmode="decimal" /></label><label>预计签约日<input name="signDate" value="${fieldValue(values, 'signDate')}" type="date" /></label></div>
      <label>备注<textarea name="notes" maxlength="2000" rows="4" placeholder="最终字段限制由服务端参数版本校验">${fieldValue(values, 'notes')}</textarea></label>`;
    return writeFormShell(module, '新建客户报备', '创建人、渠道商与区域由服务端会话确定，页面不传入这些权限字段；提交前的查重与保护期配置由服务端复核。', content, `${writePrepareButton('registration-draft', '保存报备草稿')}${writePrepareButton('registration-submit', '提交客户报备')}`);
  }

  function registrationReviewView(module) {
    if (!canShowWriteAction('registration-review')) return featureClosedView(getWriteGateMessage('registration-review'));
    const values = getWriteValues(module, { action: 'start', reasonCode: '', rejectRemark: '' });
    const content = `
      <section class="v2-linked-record"><strong>${escapeHtml(recordTitle(state.module.data || {}, 'registration'))}</strong><span>${escapeHtml((state.module.data || {}).id || '')}</span></section>
      <label>审核动作<span>*</span><select name="action"><option value="start"${values.action === 'start' ? ' selected' : ''}>开始审核</option><option value="approve"${values.action === 'approve' ? ' selected' : ''}>审核通过</option><option value="reject"${values.action === 'reject' ? ' selected' : ''}>驳回</option></select></label>
      <label>驳回原因代码<span class="v2-field-conditional">驳回时必填</span><input name="reasonCode" value="${fieldValue(values, 'reasonCode')}" maxlength="100" placeholder="由服务端原因字典校验" /></label>
      <label>驳回补充说明<textarea name="rejectRemark" maxlength="2000" rows="5" placeholder="最终长度由服务端参数版本校验">${fieldValue(values, 'rejectRemark')}</textarea></label>`;
    return writeFormShell(module, '审核客户报备', '审核范围、审核路由、状态机、对象版本与驳回原因字典均由服务端最终校验；不会在页面中伪造审核结果。', content, writePrepareButton('registration-review', '提交审核'));
  }

  function opportunityCreateView(module) {
    if (!canShowWriteAction('opportunity-create')) return featureClosedView(getWriteGateMessage('opportunity-create'));
    if (!module.relatedId) return featureClosedView('请从已审批客户报备详情发起创建，页面未请求任何写接口。');
    const registration = state.module.data || {};
    if (registration.status !== 'approved') return featureClosedView('关联报备未处于已通过状态，不能创建商机。');
    const values = getWriteValues(module, {
      regId: registration.id || '', name: registration.project || registration.customer || '', amount: registration.estimatedAmt || '', expectedClose: registration.signDate || '', contact: '', phone: '', endpoints: '', source: '客户报备', notes: '', tags: '', productIntent: '', competitionInfo: ''
    });
    const content = `
      <section class="v2-linked-record"><strong>${escapeHtml(registration.customer || '已审批客户报备')}</strong><span>${escapeHtml(registration.id || '')}</span></section>
      <input name="regId" type="hidden" value="${fieldValue(values, 'regId')}" />
      <label>商机名称<span>*</span><input name="name" value="${fieldValue(values, 'name')}" maxlength="200" required /></label>
      <div class="v2-business-form__grid"><label>预计金额<input name="amount" value="${fieldValue(values, 'amount')}" type="number" min="0" max="999999999" step="0.01" inputmode="decimal" /></label><label>预计成交日<input name="expectedClose" value="${fieldValue(values, 'expectedClose')}" type="date" /></label></div>
      <div class="v2-business-form__grid"><label>联系人<input name="contact" value="${fieldValue(values, 'contact')}" maxlength="200" /></label><label>联系电话<input name="phone" value="${fieldValue(values, 'phone')}" maxlength="200" inputmode="tel" /></label></div>
      <div class="v2-business-form__grid"><label>预计终端数<input name="endpoints" value="${fieldValue(values, 'endpoints')}" type="number" min="0" max="999999999" step="1" inputmode="numeric" /></label><label>商机来源<input name="source" value="${fieldValue(values, 'source')}" maxlength="200" /></label></div>
      <label>标签<input name="tags" value="${fieldValue(values, 'tags')}" maxlength="500" placeholder="多个标签由服务端规则解析" /></label>
      <label>产品意向<textarea name="productIntent" maxlength="2000" rows="3" placeholder="最终字段限制由服务端参数版本校验">${fieldValue(values, 'productIntent')}</textarea></label>
      <label>竞争情况<textarea name="competitionInfo" maxlength="2000" rows="3" placeholder="最终字段限制由服务端参数版本校验">${fieldValue(values, 'competitionInfo')}</textarea></label>
      <label>备注<textarea name="notes" maxlength="2000" rows="3">${fieldValue(values, 'notes')}</textarea></label>`;
    return writeFormShell(module, '从已审批报备创建商机', '关联报备、创建人、渠道商和区域必须由服务端重新核验，页面不会传入归属字段。', content, writePrepareButton('opportunity-create', '创建商机'));
  }

  function opportunityEditView(module) {
    if (!canShowWriteAction('opportunity-update')) return featureClosedView(getWriteGateMessage('opportunity-update'));
    const item = state.module.data || {};
    const values = getWriteValues(module, {
      amount: item.amount || '', expectedClose: item.expectedClose || '', contact: '', phone: '', endpoints: item.endpoints || '',
      source: item.source || '', notes: '', tags: Array.isArray(item.tags) ? item.tags.join('，') : (item.tags || ''), productIntent: '', competitionInfo: ''
    });
    const content = `
      <section class="v2-linked-record"><strong>${escapeHtml(recordTitle(item, 'opportunity'))}</strong><span>${escapeHtml(item.id || '')}</span></section>
      <p class="v2-write-panel__hint">为避免脱敏字段回写，请仅填写需要变更的联系人、电话、备注、产品意向和竞争情况；留空字段不会覆盖服务端原值。</p>
      <div class="v2-business-form__grid"><label>预计金额<input name="amount" value="${fieldValue(values, 'amount')}" type="number" min="0" max="999999999" step="0.01" inputmode="decimal" /></label><label>预计成交日<input name="expectedClose" value="${fieldValue(values, 'expectedClose')}" type="date" /></label></div>
      <div class="v2-business-form__grid"><label>联系人<input name="contact" value="${fieldValue(values, 'contact')}" maxlength="200" placeholder="填写后覆盖原联系人" /></label><label>联系电话<input name="phone" value="${fieldValue(values, 'phone')}" maxlength="200" inputmode="tel" placeholder="填写后覆盖原电话" /></label></div>
      <div class="v2-business-form__grid"><label>预计终端数<input name="endpoints" value="${fieldValue(values, 'endpoints')}" type="number" min="0" max="999999999" step="1" inputmode="numeric" /></label><label>商机来源<input name="source" value="${fieldValue(values, 'source')}" maxlength="200" /></label></div>
      <label>标签<input name="tags" value="${fieldValue(values, 'tags')}" maxlength="500" placeholder="多个标签由服务端规则解析" /></label>
      <label>产品意向<textarea name="productIntent" maxlength="2000" rows="3" placeholder="填写后覆盖原内容">${fieldValue(values, 'productIntent')}</textarea></label>
      <label>竞争情况<textarea name="competitionInfo" maxlength="2000" rows="3" placeholder="填写后覆盖原内容">${fieldValue(values, 'competitionInfo')}</textarea></label>
      <label>备注<textarea name="notes" maxlength="2000" rows="3" placeholder="填写后覆盖原内容">${fieldValue(values, 'notes')}</textarea></label>`;
    return writeFormShell(module, '编辑商机', '客户、区域、渠道商、负责人、创建人和阶段均由服务端管理，页面不会传入或修改这些字段。', content, writePrepareButton('opportunity-update', '保存商机修改'));
  }

  function opportunityAdvanceView(module) {
    if (!canShowWriteAction('opportunity-advance')) return featureClosedView(getWriteGateMessage('opportunity-advance'));
    const item = state.module.data || {};
    const nextStages = OPPORTUNITY_STAGE_FLOW[item.stage] || [];
    if (!nextStages.length) return featureClosedView('当前阶段不是已冻结的可推进阶段，历史或已结案商机保持只读。');
    const values = getWriteValues(module, { nextStage: nextStages[0], reasonCode: '', reasonRemark: '' });
    const content = `
      <section class="v2-linked-record"><strong>${escapeHtml(recordTitle(item, 'opportunity'))}</strong><span>当前阶段：${escapeHtml(statusText(item.stage))}</span></section>
      <label>下一阶段<span>*</span><select name="nextStage">${nextStages.map(function (stage) { return `<option value="${stage}"${values.nextStage === stage ? ' selected' : ''}>${escapeHtml(statusText(stage))}</option>`; }).join('')}</select></label>
      <label>结案原因代码<span class="v2-field-conditional">赢单、失单或取消时必填</span><input name="reasonCode" value="${fieldValue(values, 'reasonCode')}" maxlength="100" placeholder="由服务端原因字典校验" /></label>
      <label>结案补充说明<textarea name="reasonRemark" maxlength="2000" rows="4" placeholder="最终字段限制由服务端参数版本校验">${fieldValue(values, 'reasonRemark')}</textarea></label>`;
    return writeFormShell(module, '推进商机阶段', '仅展示相邻阶段；跳级、历史阶段和结案原因均由服务端状态机复核。', content, writePrepareButton('opportunity-advance', '提交阶段变更'));
  }

  function opportunityFollowUpView(module) {
    if (!canShowWriteAction('opportunity-follow-up')) return featureClosedView(getWriteGateMessage('opportunity-follow-up'));
    const item = state.module.data || {};
    const values = getWriteValues(module, { content: '', nextFollowAt: '' });
    const content = `
      <section class="v2-linked-record"><strong>${escapeHtml(recordTitle(item, 'opportunity'))}</strong><span>${escapeHtml(item.id || '')}</span></section>
      <label>跟进内容<span>*</span><textarea name="content" maxlength="2000" rows="6" required placeholder="最终字段限制由服务端参数版本校验">${fieldValue(values, 'content')}</textarea></label>
      <label>下次跟进时间<span>*</span><input name="nextFollowAt" value="${fieldValue(values, 'nextFollowAt')}" type="datetime-local" required /></label>`;
    return writeFormShell(module, '新增跟进', '跟进记录和待办仅在服务端确认负责人、对象范围与幂等键后写入。', content, writePrepareButton('opportunity-follow-up', '提交跟进'));
  }

  function getQuoteProducts(catalog) {
    const source = Array.isArray(catalog) ? catalog : (catalog && typeof catalog === 'object' ? [...(catalog.features || []), ...(catalog.hardware || [])] : []);
    return source
      .filter(function (item) { return item && item.id && item.name; });
  }

  function getQuoteItems(values) {
    return Object.keys(values || {}).filter(function (key) { return key.startsWith('quoteItem:'); }).map(function (key) {
      return { productId: key.slice('quoteItem:'.length), quantity: Number(values[key]) };
    }).filter(function (item) { return item.productId && Number.isInteger(item.quantity) && item.quantity > 0; });
  }

  function quoteControlledButton(contractKey, label) {
    if (canShowWriteAction(contractKey)) return writePrepareButton(contractKey, label);
    return `<button class="v2-button v2-button--secondary" type="button" data-action="prepare-write" data-contract="${contractKey}">检查${escapeHtml(label)}条件</button>`;
  }

  function quotePreviewView(module) {
    const preview = state.write.quotePreviews && state.write.quotePreviews[getWriteFormKey(module)];
    if (!preview || typeof preview !== 'object') return '';
    const items = Array.isArray(preview.items) ? preview.items : [];
    const amount = function (value) {
      const number = Number(value);
      return Number.isFinite(number) ? `${escapeHtml(preview.currency || '')} ${number.toFixed(2)}` : '—';
    };
    return `<section class="v2-quote-preview"><h3>本次服务端试算结果</h3><p>以下金额仅供本次会话查看，保存或提交时服务端会重新试算。</p><ul>${items.map(function (item) {
      return `<li><span>${escapeHtml(item.productName || item.productId || '')} × ${escapeHtml(item.quantity || '')}</span><b>${amount(item.subtotal)}</b></li>`;
    }).join('')}</ul><dl><div><dt>小计</dt><dd>${amount(preview.subtotal)}</dd></div><div><dt>折扣</dt><dd>${amount(preview.discountAmount)}</dd></div><div><dt>税费</dt><dd>${amount(preview.taxAmount)}</dd></div><div><dt>试算总额</dt><dd>${amount(preview.total)}</dd></div></dl><small>计算标识与价格规则版本由服务端留存，前端不会提交或保存金额、税率及价格版本。</small></section>`;
  }

  function quoteDraftView(module) {
    const catalog = state.module.data || {};
    const products = getQuoteProducts(catalog);
    const values = getWriteValues(module, { customer: '', discountRate: '', quoteId: '', quoteVersion: '' });
    const productRows = products.map(function (product) {
      const key = `quoteItem:${product.id}`;
      return `<label class="v2-quote-product"><span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml([product.id, product.unit, product.desc].filter(Boolean).join(' · ') || '服务端目录项')}</small></span><input name="${escapeHtml(key)}" value="${fieldValue(values, key)}" type="number" min="0" max="100000" step="1" inputmode="numeric" placeholder="数量" /></label>`;
    }).join('');
    const submitButton = values.quoteId && values.quoteVersion
      ? quoteControlledButton('quote-submit', '提交报价')
      : '<button class="v2-button v2-button--secondary" type="button" disabled>请先保存报价草稿</button>';
    const content = `
      <input name="quoteId" type="hidden" value="${fieldValue(values, 'quoteId')}" />
      <input name="quoteVersion" type="hidden" value="${fieldValue(values, 'quoteVersion')}" />
      <label>客户名称<span>*</span><input name="customer" value="${fieldValue(values, 'customer')}" maxlength="120" required autocomplete="organization" /></label>
      <label>折扣申请比例<input name="discountRate" value="${fieldValue(values, 'discountRate')}" type="number" min="0" max="1" step="0.0001" inputmode="decimal" placeholder="留空表示不申请折扣" /></label>
      <section class="v2-quote-products"><h3>选择产品与数量<span>*</span></h3><p>产品仅来自服务端已发布目录；不展示或输入单价、税率、总价和价格规则。</p>${productRows || '<p class="v2-message v2-message--error">当前没有可供选择的服务端目录项，未发送任何试算或写入请求。</p>'}</section>
      ${quotePreviewView(module)}`;
    return writeFormShell(module, '新建报价', '先选择产品和数量，再由服务端试算。报价草稿与提交均不接收客户端金额、税费、价格版本、区域、操作者或渠道归属。', content, `${quoteControlledButton('quote-preview', '服务端试算')}${quoteControlledButton('quote-draft', '保存报价草稿')}${submitButton}`);
  }

  function quoteSubmitView(module) {
    if (!canShowWriteAction('quote-submit')) return featureClosedView(getWriteGateMessage('quote-submit'));
    const item = state.module.data || {};
    const values = getWriteValues(module, { quoteId: item.id || '', quoteVersion: item.version || '' });
    const content = `<section class="v2-linked-record"><strong>${escapeHtml(recordTitle(item, 'quote'))}</strong><span>${escapeHtml(item.id || '')}</span></section><input name="quoteId" type="hidden" value="${fieldValue(values, 'quoteId')}" /><input name="quoteVersion" type="hidden" value="${fieldValue(values, 'quoteVersion')}" /><p class="v2-write-panel__hint">提交时服务端会再次试算并冻结快照；页面不会传递任何金额、税率、总价、价格规则或归属字段。</p>`;
    return writeFormShell(module, '提交报价', '仅当前草稿可提交。提交后的产品、数量和折扣申请将由服务端重新校验并生成不可修改快照。', content, quoteControlledButton('quote-submit', '确认提交报价'));
  }

  function quoteDiscountReviewView(module) {
    if (!canShowWriteAction('quote-discount-review')) return featureClosedView(getWriteGateMessage('quote-discount-review'));
    const item = state.module.data || {};
    const values = getWriteValues(module, { action: 'approve', reasonCode: '' });
    const content = `<section class="v2-linked-record"><strong>${escapeHtml(recordTitle(item, 'quote'))}</strong><span>${escapeHtml(item.id || '')}</span></section><label>审核动作<span>*</span><select name="action"><option value="approve"${values.action === 'approve' ? ' selected' : ''}>通过折扣审核</option><option value="reject"${values.action === 'reject' ? ' selected' : ''}>驳回折扣审核</option></select></label><label>驳回原因代码<span class="v2-field-conditional">驳回时必填</span><input name="reasonCode" value="${fieldValue(values, 'reasonCode')}" maxlength="100" placeholder="由服务端原因字典校验" /></label>`;
    return writeFormShell(module, '审核报价折扣', '审批范围、职责分离、原因代码和报价版本均由服务端校验。', content, quoteControlledButton('quote-discount-review', '提交折扣审核'));
  }

  function quoteConfirmView(module) {
    if (!canShowWriteAction('quote-confirm')) return featureClosedView(getWriteGateMessage('quote-confirm'));
    const item = state.module.data || {};
    const content = `<section class="v2-linked-record"><strong>${escapeHtml(recordTitle(item, 'quote'))}</strong><span>${escapeHtml(item.id || '')}</span></section><p class="v2-write-panel__hint">仅服务端已确认审批、有效期、权限与版本均满足时才会确认报价。</p>`;
    return writeFormShell(module, '确认报价', '确认后方可按服务端规则创建订单；页面不会直接修改报价状态或审批结果。', content, quoteControlledButton('quote-confirm', '确认报价'));
  }

  function getOrderParentOptionState(module) {
    return state.write.parentOptions[getWriteFormKey(module)] || { status: 'idle', data: [], applicable: false, message: '' };
  }

  function getOrderParentSelectionMessage(module, values) {
    const user = state.session && state.session.user ? state.session.user : {};
    if (user.partnerLevel !== 'secondary') return '';
    const parentOptions = getOrderParentOptionState(module);
    if (parentOptions.status === 'loading' || parentOptions.status === 'idle') return '正在读取服务端一级渠道候选列表，未发送请求。';
    if (parentOptions.status === 'error') return parentOptions.message || '无法确认服务端一级渠道候选列表，未发送请求。';
    if (!parentOptions.applicable || !Array.isArray(parentOptions.data) || !parentOptions.data.length) return '服务端未返回有效一级渠道候选项，未发送请求。';
    if (!parentOptions.data.some(function (item) { return item && item.id === values.primaryPartnerId; })) return '请选择服务端返回的有效一级渠道商，未发送请求。';
    return '';
  }

  async function loadOrderParentOptions(module) {
    const user = state.session && state.session.user ? state.session.user : {};
    if (!module || user.partnerLevel !== 'secondary') return;
    const formKey = getWriteFormKey(module);
    const current = getOrderParentOptionState(module);
    if (current.status === 'loading' || current.status === 'ready') return;
    state.write.parentOptions[formKey] = { status: 'loading', data: [], applicable: true, message: '' };
    render();
    try {
      const quoteId = module && module.recordId ? String(module.recordId) : '';
      if (!quoteId) throw new api.MobileV2ApiError('报价编号缺失，未读取一级渠道候选列表', 'V2_INVALID_PATH');
      const result = await api.request(`/orders/parent-options?quoteId=${encodeURIComponent(quoteId)}`);
      const items = Array.isArray(result && result.data) ? result.data : [];
      state.write.parentOptions[formKey] = {
        status: 'ready', data: items.filter(function (item) { return item && item.id && item.name; }),
        applicable: result && result.applicable === true, message: result && result.message ? String(result.message) : ''
      };
    } catch (error) {
      state.write.parentOptions[formKey] = { status: 'error', data: [], applicable: true, message: getWriteErrorMessage(error) };
    }
    const currentModule = getCurrentModule();
    if (currentModule && getWriteFormKey(currentModule) === formKey) render();
  }

  function orderDraftView(module) {
    if (!canShowWriteAction('order-draft')) return featureClosedView(getWriteGateMessage('order-draft'));
    const quote = state.module.data || {};
    const values = getWriteValues(module, { quoteId: quote.id || '', quoteVersion: quote.version || '', orderDraftId: '', orderDraftVersion: '', deliveryAddr: '' });
    const isSecondary = state.session && state.session.user && state.session.user.partnerLevel === 'secondary';
    const parentOptions = getOrderParentOptionState(module);
    const parentSelection = !isSecondary ? '' : (parentOptions.status === 'ready' && parentOptions.applicable && parentOptions.data.length
      ? `<label>指定一级渠道商<span>*</span><select name="primaryPartnerId"><option value="">请选择服务端候选项</option>${parentOptions.data.map(function (item) { return `<option value="${escapeHtml(item.id)}"${values.primaryPartnerId === item.id ? ' selected' : ''}>${escapeHtml(item.name)}${item.region ? `（${escapeHtml(item.region)}）` : ''}</option>`; }).join('')}</select></label>`
      : `<p class="v2-message v2-message--error">${escapeHtml(parentOptions.status === 'loading' ? '正在读取服务端一级渠道候选列表，当前不会发送转订单请求。' : (parentOptions.message || '未获得有效一级渠道候选项，当前不会发送转订单请求。'))}</p>`);
    const content = `<section class="v2-linked-record"><strong>${escapeHtml(recordTitle(quote, 'quote'))}</strong><span>${escapeHtml(quote.id || '')}</span></section><input name="quoteId" type="hidden" value="${fieldValue(values, 'quoteId')}" /><input name="quoteVersion" type="hidden" value="${fieldValue(values, 'quoteVersion')}" /><input name="orderDraftId" type="hidden" value="${fieldValue(values, 'orderDraftId')}" /><input name="orderDraftVersion" type="hidden" value="${fieldValue(values, 'orderDraftVersion')}" /><label>收货地址<span>*</span><textarea name="deliveryAddr" maxlength="240" rows="4" required placeholder="完整地址仅提交给服务端，详情页仅展示脱敏结果">${fieldValue(values, 'deliveryAddr')}</textarea></label>${parentSelection}`;
    const buttons = isSecondary && !(parentOptions.status === 'ready' && parentOptions.applicable && parentOptions.data.length)
      ? '<button class="v2-button v2-button--secondary" type="button" disabled>等待有效一级渠道候选项</button>'
      : `${quoteControlledButton('order-draft', '保存订单草稿')}${values.orderDraftId && values.orderDraftVersion ? quoteControlledButton('order-submit', '提交订单') : '<button class="v2-button v2-button--secondary" type="button" disabled>请先保存订单草稿</button>'}`;
    return writeFormShell(module, '创建订单草稿', '订单金额、产品、税费、归属、区域、报价快照和渠道关系快照均由服务端从已确认报价及会话生成。保存草稿后提交时会再次校验报价状态与版本。', content, buttons);
  }

  function orderPrimaryReviewView(module) {
    if (!canShowWriteAction('order-primary-review')) return featureClosedView(getWriteGateMessage('order-primary-review'));
    const item = state.module.data || {};
    const values = getWriteValues(module, { action: 'approve', reasonCode: '' });
    const content = `<section class="v2-linked-record"><strong>${escapeHtml(recordTitle(item, 'order'))}</strong><span>${escapeHtml(item.id || '')}</span></section><label>确认动作<span>*</span><select name="action"><option value="approve"${values.action === 'approve' ? ' selected' : ''}>确认订单</option><option value="reject"${values.action === 'reject' ? ' selected' : ''}>驳回订单</option></select></label><label>驳回原因代码<span class="v2-field-conditional">驳回时必填</span><input name="reasonCode" value="${fieldValue(values, 'reasonCode')}" maxlength="100" placeholder="由服务端原因字典校验" /></label>`;
    return writeFormShell(module, '一级渠道确认', '仅订单指定一级渠道商的渠道管理员可确认或驳回；服务端复核关系快照、状态和对象版本。', content, quoteControlledButton('order-primary-review', '提交一级确认'));
  }

  function orderFulfillView(module) {
    if (!canShowWriteAction('order-fulfill')) return featureClosedView(getWriteGateMessage('order-fulfill'));
    const item = state.module.data || {};
    const values = getWriteValues(module, { targetStatus: '' });
    const content = `<section class="v2-linked-record"><strong>${escapeHtml(recordTitle(item, 'order'))}</strong><span>当前状态：${escapeHtml(statusText(item.status))}</span></section><label>目标履约状态<span>*</span><input name="targetStatus" value="${fieldValue(values, 'targetStatus')}" maxlength="100" required placeholder="由服务端履约配置校验" /></label><p class="v2-write-panel__hint">服务端尚未发布可选履约节点字典，页面不猜测状态流转；仅提交由已配置流程指定的状态标识。</p>`;
    return writeFormShell(module, '订单履约', '区域、履约权限、相邻状态、版本和节点字段均由服务端校验。调价、取消、退款不会显示或请求。', content, quoteControlledButton('order-fulfill', '提交履约状态'));
  }

  function timelineView(module) {
    if (!canShowTimeline(module.type)) return featureClosedView('服务端未开放当前模块查询能力，时间线入口保持关闭。');
    const label = { registration: '报备', opportunity: '商机', quote: '报价', order: '订单' }[module.type] || '业务';
    const events = Array.isArray(state.module.data) ? state.module.data : [];
    if (!events.length) return `<section class="v2-timeline"><h2>${label}时间线</h2><div class="v2-state v2-state--compact"><span>🕘</span><strong>暂无时间线事件</strong><p>当前账号范围内尚无可展示的服务端事件。</p></div></section>`;
    return `<section class="v2-timeline"><h2>${label}时间线</h2>${events.map(function (event) {
      const transition = [event.beforeStatus && statusText(event.beforeStatus), event.afterStatus && statusText(event.afterStatus)].filter(Boolean).join(' → ');
      return `<article><span></span><div><strong>${escapeHtml(event.summary || event.action || '业务操作')}</strong><p>${escapeHtml(transition || '状态未变化')}</p><small>${escapeHtml([event.actorName, event.actorRole ? roleName({ role: event.actorRole }) : '', formatDate(event.createdAt)].filter(Boolean).join(' · '))}</small></div></article>`;
    }).join('')}</section>`;
  }

  function operationContentView(module) {
    if (state.module.status !== 'ready') return moduleStatusView();
    if (module.operation === 'registration-draft') return registrationDraftView(module);
    if (module.operation === 'registration-review') return registrationReviewView(module);
    if (['registration-events', 'opportunity-events', 'quote-events', 'order-events'].includes(module.operation)) return timelineView(module);
    if (module.operation === 'opportunity-create') return opportunityCreateView(module);
    if (module.operation === 'opportunity-edit') return opportunityEditView(module);
    if (module.operation === 'opportunity-advance') return opportunityAdvanceView(module);
    if (module.operation === 'opportunity-follow-up') return opportunityFollowUpView(module);
    if (module.operation === 'quote-draft') return quoteDraftView(module);
    if (module.operation === 'quote-submit') return quoteSubmitView(module);
    if (module.operation === 'quote-discount-review') return quoteDiscountReviewView(module);
    if (module.operation === 'quote-confirm') return quoteConfirmView(module);
    if (module.operation === 'order-draft') return orderDraftView(module);
    if (module.operation === 'order-primary-review') return orderPrimaryReviewView(module);
    if (module.operation === 'order-fulfill') return orderFulfillView(module);
    return featureClosedView('当前操作未定义，未执行任何请求。');
  }

  function collectWriteFormValues(form) {
    return Array.from(new FormData(form).entries()).reduce(function (result, entry) {
      const name = entry[0];
      const value = String(entry[1] || '').trim();
      result[name] = value;
      return result;
    }, {});
  }

  function validateWriteValues(contractKey, values) {
    const errors = [];
    const limits = { customer: 200, creditCode: 200, industry: 200, city: 200, project: 200, contact: 200, phone: 200, email: 320, endpointRange: 200, name: 200, source: 200, tags: 500, notes: 2000, rejectRemark: 2000, productIntent: 2000, competitionInfo: 2000, reasonCode: 100, reasonRemark: 2000, content: 2000, deliveryAddr: 240 };
    Object.keys(limits).forEach(function (field) {
      if (values[field] && values[field].length > limits[field]) errors.push(`${field}超过允许长度`);
    });
    if (['registration-draft', 'registration-submit'].includes(contractKey) && !values.customer) errors.push('请填写客户名称');
    if (['registration-draft', 'registration-submit'].includes(contractKey) && !values.contact) errors.push('请填写联系人');
    if (['registration-draft', 'registration-submit'].includes(contractKey) && !values.phone) errors.push('请填写联系电话');
    if (contractKey === 'registration-review' && !values.action) errors.push('请选择审核动作');
    if (contractKey === 'registration-review' && values.action === 'reject' && !values.reasonCode) errors.push('驳回时必须填写驳回原因代码');
    if (contractKey === 'registration-submit' && !values.draftId) errors.push('请先保存当前会话中的报备草稿，再提交客户报备');
    if (contractKey === 'opportunity-create' && (!values.regId || !values.name)) errors.push('请从已审批报备填写商机名称');
    if (contractKey === 'opportunity-update' && !['amount', 'expectedClose', 'contact', 'phone', 'endpoints', 'source', 'notes', 'tags', 'productIntent', 'competitionInfo'].some(function (field) { return Boolean(values[field]); })) errors.push('请至少填写一项需要修改的商机字段');
    if (contractKey === 'opportunity-advance' && !values.nextStage) errors.push('请选择下一阶段');
    if (contractKey === 'opportunity-advance' && ['won', 'lost', 'cancelled'].includes(values.nextStage) && !values.reasonCode) errors.push('结案时必须填写结案原因代码');
    if (contractKey === 'opportunity-follow-up' && !values.content) errors.push('请填写跟进内容');
    if (contractKey === 'opportunity-follow-up' && !values.nextFollowAt) errors.push('请填写下次跟进时间');
    if (['quote-preview', 'quote-draft'].includes(contractKey)) {
      const quoteItemKeys = Object.keys(values).filter(function (key) { return key.startsWith('quoteItem:') && values[key]; });
      if (!getQuoteItems(values).length) errors.push('请至少选择一项产品并填写正整数数量');
      if (quoteItemKeys.some(function (key) { return !Number.isInteger(Number(values[key])) || Number(values[key]) < 1 || Number(values[key]) > 100000; })) errors.push('产品数量必须为 1 至 100000 的整数');
      if (values.discountRate && (!Number.isFinite(Number(values.discountRate)) || Number(values.discountRate) < 0 || Number(values.discountRate) > 1)) errors.push('折扣申请比例必须为 0 至 1 的数字');
    }
    if (contractKey === 'quote-draft' && !values.customer) errors.push('请填写客户名称');
    if (contractKey === 'quote-submit' && (!values.quoteId || !Number.isInteger(Number(values.quoteVersion)) || Number(values.quoteVersion) < 1)) errors.push('当前报价草稿编号或版本缺失，请刷新或重新保存草稿');
    if (contractKey === 'quote-discount-review' && !values.action) errors.push('请选择折扣审核动作');
    if (contractKey === 'quote-discount-review' && values.action === 'reject' && !values.reasonCode) errors.push('驳回折扣时必须填写原因代码');
    if (contractKey === 'order-draft' && !values.quoteId) errors.push('报价编号缺失，未发送请求');
    if (contractKey === 'order-draft' && (!Number.isInteger(Number(values.quoteVersion)) || Number(values.quoteVersion) < 1)) errors.push('当前报价版本缺失，请刷新后重新创建订单草稿');
    if (contractKey === 'order-draft' && !values.deliveryAddr) errors.push('请填写收货地址');
    if (contractKey === 'order-draft') {
      const parentMessage = getOrderParentSelectionMessage(getCurrentModule(), values);
      if (parentMessage) errors.push(parentMessage);
    }
    if (contractKey === 'order-submit' && (!values.orderDraftId || !Number.isInteger(Number(values.orderDraftVersion)) || Number(values.orderDraftVersion) < 1)) errors.push('当前订单草稿编号或版本缺失，请重新保存订单草稿');
    if (contractKey === 'order-primary-review' && !values.action) errors.push('请选择一级确认动作');
    if (contractKey === 'order-primary-review' && values.action === 'reject' && !values.reasonCode) errors.push('驳回订单时必须填写原因代码');
    if (contractKey === 'order-fulfill' && !values.targetStatus) errors.push('请填写由服务端配置的目标履约状态');
    ['estimatedAmt', 'amount', 'endpoints'].forEach(function (field) {
      if (values[field] && (!Number.isFinite(Number(values[field])) || Number(values[field]) < 0)) errors.push('金额必须为非负数字');
    });
    return errors;
  }

  function requiresObjectVersion(contractKey) {
    return ['registration-review', 'opportunity-update', 'opportunity-advance', 'opportunity-follow-up', 'quote-submit', 'quote-discount-review', 'quote-confirm', 'order-draft', 'order-submit', 'order-primary-review', 'order-fulfill'].includes(contractKey);
  }

  function getCurrentObjectVersion() {
    const version = Number(state.module && state.module.data && state.module.data.version);
    return Number.isInteger(version) && version > 0 ? version : 0;
  }

  function getWriteObjectVersion(contractKey, values) {
    if (['quote-submit', 'order-draft'].includes(contractKey)) {
      const version = Number(values && values.quoteVersion);
      return Number.isInteger(version) && version > 0 ? version : 0;
    }
    if (contractKey === 'order-submit') {
      const version = Number(values && values.orderDraftVersion);
      return Number.isInteger(version) && version > 0 ? version : 0;
    }
    return getCurrentObjectVersion();
  }

  function pickWriteFields(values, fields, omitEmpty) {
    return fields.reduce(function (result, field) {
      if (!Object.prototype.hasOwnProperty.call(values, field)) return result;
      if (omitEmpty && !values[field]) return result;
      result[field] = values[field];
      return result;
    }, {});
  }

  function buildWritePath(contract, targetId) {
    const path = String(contract && contract.path || '');
    if (!path.includes(':id')) return path;
    if (!targetId) return '';
    return path.replace(':id', encodeURIComponent(targetId));
  }

  function buildWriteBody(contractKey, values, version) {
    const registrationFields = ['customer', 'creditCode', 'industry', 'contact', 'phone', 'email', 'city', 'project', 'endpointRange', 'estimatedAmt', 'signDate', 'notes'];
    const opportunityFields = ['name', 'amount', 'expectedClose', 'contact', 'phone', 'endpoints', 'source', 'notes', 'tags', 'productIntent', 'competitionInfo'];
    const editableOpportunityFields = opportunityFields.filter(function (field) { return field !== 'name'; });
    if (contractKey === 'registration-draft') {
      return { ...pickWriteFields(values, registrationFields), ...(values.draftId ? { draftId: values.draftId } : {}) };
    }
    if (contractKey === 'registration-submit') {
      return { draftId: values.draftId, ...pickWriteFields(values, registrationFields) };
    }
    if (contractKey === 'registration-review') {
      return { action: values.action, reasonCode: values.reasonCode, remark: values.rejectRemark, version };
    }
    if (contractKey === 'opportunity-create') {
      return { regId: values.regId, ...pickWriteFields(values, opportunityFields) };
    }
    if (contractKey === 'opportunity-update') {
      return { ...pickWriteFields(values, editableOpportunityFields, true), version };
    }
    if (contractKey === 'opportunity-advance') {
      return { stage: values.nextStage, reasonCode: values.reasonCode, remark: values.reasonRemark, version };
    }
    if (contractKey === 'opportunity-follow-up') {
      return { content: values.content, nextFollowAt: values.nextFollowAt, version };
    }
    if (contractKey === 'quote-preview') {
      return { items: getQuoteItems(values), ...(values.discountRate ? { discountRate: values.discountRate } : {}) };
    }
    if (contractKey === 'quote-draft') {
      return { customer: values.customer, items: getQuoteItems(values), ...(values.discountRate ? { discountRate: values.discountRate } : {}) };
    }
    if (contractKey === 'quote-submit') {
      return { quoteId: values.quoteId, version };
    }
    if (contractKey === 'quote-discount-review') {
      return { action: values.action, reasonCode: values.reasonCode, version };
    }
    if (contractKey === 'quote-confirm') {
      return { version };
    }
    if (contractKey === 'order-draft') {
      return { quoteId: values.quoteId, version, deliveryAddr: values.deliveryAddr, ...(values.primaryPartnerId ? { primaryPartnerId: values.primaryPartnerId } : {}) };
    }
    if (contractKey === 'order-submit') {
      return { version };
    }
    if (contractKey === 'order-primary-review') {
      return { action: values.action, reasonCode: values.reasonCode, version };
    }
    if (contractKey === 'order-fulfill') {
      return { status: values.targetStatus, version };
    }
    return null;
  }

  function applyWriteSuccess(module, contractKey, values, result) {
    const formKey = getWriteFormKey(module);
    const data = result && result.data && typeof result.data === 'object' ? result.data : null;
    const requestId = result && result.requestId ? String(result.requestId) : '';
    if (!data || !requestId) {
      state.write.feedback = { formKey, level: 'error', message: '服务端写入响应不完整，页面未展示成功结果；请刷新后确认当前状态。' };
      render();
      return;
    }
    if (contractKey === 'registration-draft' && data.id) {
      state.write.forms[formKey] = { ...values, draftId: data.id };
    }
    if (contractKey === 'quote-preview') {
      state.write.quotePreviews = { ...(state.write.quotePreviews || {}), [formKey]: data };
    }
    if (contractKey === 'quote-draft' && data.id && Number.isInteger(Number(data.version)) && Number(data.version) > 0) {
      state.write.forms[formKey] = { ...values, quoteId: data.id, quoteVersion: String(data.version) };
    }
    if (contractKey === 'quote-submit' && Number.isInteger(Number(data.version)) && Number(data.version) > 0) {
      state.write.forms[formKey] = { ...values, quoteVersion: String(data.version) };
    }
    if (contractKey === 'order-draft' && data.id && Number.isInteger(Number(data.version)) && Number(data.version) > 0) {
      state.write.forms[formKey] = { ...values, orderDraftId: data.id, orderDraftVersion: String(data.version) };
    }
    if (module.recordId && data.id === module.recordId && state.module && state.module.data) {
      state.module = { ...state.module, data: { ...state.module.data, ...data } };
    }
    delete state.write.idempotencyKeys[formKey];
    const objectId = data.id ? `；对象编号：${data.id}` : '';
    state.write.feedback = { formKey, level: 'notice', message: `${WRITE_CONTRACTS[contractKey].label}已由服务端完成；请求编号：${requestId}${objectId}` };
    render();
  }

  function prepareWriteAction(button) {
    const contractKey = button.dataset.contract;
    const module = getCurrentModule();
    const form = button.closest('[data-write-form]');
    if (!contractKey || !module || !form) return;
    const formKey = getWriteFormKey(module);
    const values = collectWriteFormValues(form);
    state.write.forms[formKey] = values;
    const errors = validateWriteValues(contractKey, values);
    if (errors.length) {
      state.write.feedback = { formKey, level: 'error', message: errors.join('；') };
      render();
      return;
    }
    const idempotencyKey = state.write.idempotencyKeys[formKey] || createIdempotencyKey(contractKey);
    state.write.idempotencyKeys[formKey] = idempotencyKey;
    const gateMessage = getWriteGateMessage(contractKey);
    state.write.feedback = {
      formKey,
      level: 'notice',
      message: gateMessage ? `${gateMessage}已生成幂等标识：${idempotencyKey}` : `已生成幂等标识：${idempotencyKey}。当前版本不包含写请求实现，等待后端接口确认后联调。`
    };
    render();
  }

  async function submitPublishedWrite(button) {
    const contractKey = button.dataset.contract;
    const module = getCurrentModule();
    const form = button.closest('[data-write-form]');
    if (!contractKey || !module || !form || state.write.submitting[getWriteFormKey(module)]) return;
    const formKey = getWriteFormKey(module);
    const values = collectWriteFormValues(form);
    state.write.forms[formKey] = values;
    const errors = validateWriteValues(contractKey, values);
    if (errors.length) {
      state.write.feedback = { formKey, level: 'error', message: errors.join('；') };
      render();
      return;
    }
    const gateMessage = getWriteGateMessage(contractKey);
    if (gateMessage) {
      state.write.feedback = { formKey, level: 'error', message: gateMessage };
      render();
      return;
    }
    const version = getWriteObjectVersion(contractKey, values);
    if (requiresObjectVersion(contractKey) && !version) {
      state.write.feedback = { formKey, level: 'error', message: '当前对象版本缺失，未发送请求，请刷新或联系管理员。' };
      render();
      return;
    }
    const contract = api.getPublishedWriteContract(contractKey);
    const targetId = contractKey === 'order-submit' ? values.orderDraftId : module.recordId;
    const path = buildWritePath(contract, targetId);
    const body = buildWriteBody(contractKey, values, version);
    if (!contract || !path || !body) {
      state.write.feedback = { formKey, level: 'error', message: '服务端发布契约或操作对象不完整，未发送请求。' };
      render();
      return;
    }
    const idempotencyKey = state.write.idempotencyKeys[formKey] || createIdempotencyKey(contractKey);
    state.write.idempotencyKeys[formKey] = idempotencyKey;
    state.write.submitting[formKey] = true;
    button.disabled = true;
    try {
      const result = await api.request(path, {
        method: contract.method,
        writeContract: contractKey,
        headers: { 'Idempotency-Key': idempotencyKey, 'X-Client-Version': 'mobile-v2-write-1' },
        body
      });
      applyWriteSuccess(module, contractKey, values, result);
    } catch (error) {
      handleWriteError(module, error);
    } finally {
      delete state.write.submitting[formKey];
      button.disabled = false;
    }
  }

  function handleWriteError(module, error) {
    const formKey = getWriteFormKey(module);
    state.write.feedback = { formKey, level: 'error', message: getWriteErrorMessage(error) };
    render();
  }

  function detailsView(module) {
    const item = state.module.data || {};
    const fieldMap = {
      registration: [['id', '报备编号'], ['customer', '客户名称'], ['status', '状态'], ['partnerName', '渠道商'], ['region', '所属区域'], ['industry', '所属行业'], ['contact', '联系人'], ['phone', '联系电话'], ['email', '联系邮箱'], ['city', '所在城市'], ['project', '项目名称'], ['estimatedAmt', '预计金额'], ['signDate', '预计签约日'], ['expireAt', '保护到期日'], ['createdByName', '创建人'], ['assignedStaffName', '跟进人员'], ['createdAt', '创建时间'], ['updatedAt', '更新时间'], ['remark', '备注']],
      opportunity: [['id', '商机编号'], ['name', '商机名称'], ['customer', '客户名称'], ['stage', '当前阶段'], ['status', '状态'], ['partnerName', '渠道商'], ['region', '所属区域'], ['industry', '所属行业'], ['contact', '联系人'], ['phone', '联系电话'], ['amount', '预计金额'], ['endpoints', '预计终端数'], ['probability', '赢单概率'], ['expectedClose', '预计成交日'], ['source', '商机来源'], ['owner', '负责人'], ['createdByName', '创建人'], ['assignedStaffName', '跟进人员'], ['lastFollowAt', '最近跟进时间'], ['createdAt', '创建时间'], ['updatedAt', '更新时间'], ['notes', '跟进说明'], ['followUps', '跟进记录']],
      quote: [['id', '报价编号'], ['customerName', '客户名称'], ['customer', '客户名称'], ['status', '状态'], ['approvalStatus', '折扣审批结果'], ['discountReviewReasonCode', '折扣驳回原因'], ['partnerName', '渠道商'], ['region', '所属区域'], ['total', '报价金额'], ['amount', '报价金额'], ['originalTotal', '原始金额'], ['discountAmount', '优惠金额'], ['taxAmount', '税费'], ['currency', '币种'], ['convertedOrderId', '转订单编号'], ['endpoints', '终端数'], ['validDays', '有效天数'], ['quoteMode', '报价方式'], ['createdByName', '创建人'], ['assignedStaffName', '跟进人员'], ['createdAt', '创建时间'], ['updatedAt', '更新时间'], ['products', '产品明细']],
      order: [['id', '订单编号'], ['customerName', '客户名称'], ['customer', '客户名称'], ['status', '状态'], ['partnerName', '渠道商'], ['region', '所属区域'], ['total', '订单金额'], ['amount', '订单金额'], ['currency', '币种'], ['deliveryAddr', '交付地址'], ['deliveryAddress', '交付地址'], ['contacts', '联系人'], ['primaryPartnerName', '指定一级渠道商'], ['parentPartnerId', '上级渠道商'], ['primaryReviewedBy', '一级审核人'], ['primaryReviewReasonCode', '一级驳回原因'], ['createdByName', '创建人'], ['assignedStaffName', '跟进人员'], ['createdAt', '创建时间'], ['updatedAt', '更新时间'], ['primaryConfirmedByName', '一级确认人'], ['primaryConfirmedAt', '一级确认时间'], ['primaryConfirmRemark', '一级确认说明']],
      partner: [['id', '渠道商编号'], ['name', '渠道商名称'], ['status', '状态'], ['partnerLevel', '渠道等级'], ['level', '渠道等级'], ['region', '所属区域'], ['city', '所在城市'], ['contact', '联系人'], ['phone', '联系电话'], ['email', '联系邮箱'], ['joinDate', '加入日期'], ['techServiceType', '技术服务类型']]
    };
    const used = {};
    const rows = (fieldMap[module.type] || []).filter(function (field) {
      if (used[field[0]] || item[field[0]] === undefined || item[field[0]] === null || item[field[0]] === '') return false;
      used[field[0]] = true;
      return true;
    }).map(function (field) {
      return `<div class="v2-detail-row"><dt>${field[1]}</dt><dd>${formatValue(item[field[0]], field[0])}</dd></div>`;
    }).join('');
    return `
      <section class="v2-detail-card">
        <div class="v2-detail-card__title"><span class="v2-status${statusTone(item.stage || item.status)}">${escapeHtml(statusText(item.stage || item.status))}</span><h2>${escapeHtml(recordTitle(item, module.type))}</h2><p>${escapeHtml(item.id || '')}</p></div>
        <dl class="v2-detail-list">${rows || '<div class="v2-state v2-state--compact"><span>🗂️</span><strong>暂无可展示详情</strong></div>'}</dl>
      </section>
      ${writeDetailActionsView(module, item)}
      <p class="v2-readonly-hint">受控操作仅在服务端功能开关明确开放时显示；当前未发布接口不会接收任何写请求。</p>`;
  }

  function notificationView() {
    const records = Array.isArray(state.module.data) ? state.module.data : [];
    const pagination = state.module.pagination;
    if (!records.length) return moduleStatusView();
    return `<p class="v2-list-summary">共 ${pagination.total} 条通知</p><section class="v2-notification-list">${records.map(function (item) {
      const when = item.time || item.updatedAt || item.createdAt;
      return `<article class="v2-notification${item.unread ? ' v2-notification--unread' : ''}"><span aria-hidden="true">${item.unread ? '●' : '○'}</span><div><h2>${escapeHtml(item.title || '通知')}</h2><p>${escapeHtml(item.desc || '暂无通知内容')}</p><small>${escapeHtml(formatDate(when))}</small></div></article>`;
    }).join('')}</section>${pagination.hasMore ? `<button class="v2-load-more" type="button" data-action="load-more"${state.module.status === 'loading-more' ? ' disabled' : ''}>${state.module.status === 'loading-more' ? '正在加载…' : '加载更多'}</button>` : `<p class="v2-list-end">已显示 ${records.length} / ${pagination.total} 条</p>`}`;
  }

  function catalogSection(title, items, getName, getMeta) {
    if (!items.length) return '';
    return `<section class="v2-catalog-section"><h2>${title}<small>${items.length} 项</small></h2>${items.map(function (item) {
      return `<article class="v2-catalog-card"><span>${escapeHtml(item.icon || '▦')}</span><div><strong>${escapeHtml(getName(item))}</strong><p>${escapeHtml(getMeta(item) || item.desc || '暂无说明')}</p></div></article>`;
    }).join('')}</section>`;
  }

  function catalogView() {
    const data = state.module.data || {};
    const sections = [
      catalogSection('产品分类', data.categories || [], item => item.name || item.id || '未命名分类', item => item.type || item.desc),
      catalogSection('功能模块', data.modules || [], item => item.name || item.id || '未命名模块', item => item.desc),
      catalogSection('功能项', data.features || [], item => item.name || item.id || '未命名功能项', item => [item.productCode, item.unit, item.desc].filter(Boolean).join(' · ')),
      catalogSection('硬件产品', data.hardware || [], item => item.name || item.id || '未命名硬件', item => [item.model, item.unit, item.desc].filter(Boolean).join(' · ')),
      catalogSection('产品套餐', data.packages || [], item => item.name || item.id || '未命名套餐', item => item.desc)
    ].join('');
    return sections ? `<div class="v2-catalog">${sections}</div><p class="v2-readonly-hint">目录仅展示已发布基础资料，不展示价格底表，也不提供报价计算。</p>` : moduleStatusView();
  }

  function dashboardView(module) {
    const counts = (state.module.data && state.module.data.counts) || {};
    const isPartner = state.scope === 'partner';
    const cards = isPartner
      ? [['registrations', '客户报备', counts.registrations], ['opportunities', '商机', counts.opportunities], ['quotes', '报价单', counts.quotes], ['orders', '订单', counts.orders]]
      : [['registrations', '客户报备', counts.registrations], ['opportunities', '商机', counts.opportunities], ['quotes', '报价单', counts.quotes], ['orders', '订单', counts.orders], ['partners', '渠道商', counts.partners], ['approvals', '待办审核', counts.pendingRegistrations + counts.pendingApprovals]];
    const shortcuts = isPartner
      ? [['registrations', '客户报备'], ['opportunities', '商机管理'], ['quotes', '报价管理'], ['orders', '订单管理'], ['catalog', '产品目录'], ['notifications', '消息通知']]
      : [['registrations', '客户报备'], ['opportunities', '商机管理'], ['quotes', '报价管理'], ['orders', '订单管理'], ['partners', '渠道协作'], ['catalog', '产品目录'], ['notifications', '消息通知']];
    return `
      <section class="v2-dashboard-cards">${cards.map(function (item) {
        return `<button type="button" data-action="go" data-page="${item[0]}"><b>${Number.isFinite(Number(item[2])) ? item[2] : 0}</b><span>${item[1]}</span></button>`;
      }).join('')}</section>
      <section class="v2-dashboard-tips"><span>未读通知 ${Number(counts.unreadNotifications) || 0}</span><span>到期提醒 ${Number(counts.dueReminders) || 0}</span></section>
      <section class="v2-section"><h2>${module.page === 'home' ? '常用查询' : '业务查询'}</h2><div class="v2-shortcuts">${shortcuts.map(function (item) {
        return `<button type="button" data-action="go" data-page="${item[0]}">${item[1]}<b>›</b></button>`;
      }).join('')}</div></section>`;
  }

  function moduleContentView(module) {
    if (state.module.status !== 'ready' && state.module.status !== 'loading-more') return moduleStatusView();
    if (module.operation) return operationContentView(module);
    if (module.recordId) return detailsView(module);
    if (module.type === 'dashboard') return dashboardView(module);
    if (module.type === 'catalog') return catalogView();
    if (module.type === 'notification') return notificationView();
    return recordListView(module);
  }

  function shellView() {
    const user = state.session.user;
    const module = getCurrentModule();
    const isPartner = state.scope === 'partner';
    const navigation = isPartner
      ? [['home', '工作台', '⌂'], ['registrations', '客户', '◫'], ['opportunities', '商机', '◎'], ['quotes', '报价', '¥'], ['me', '我的', '◉']]
      : [['home', '工作台', '⌂'], ['approvals', '审核', '✓'], ['business', '业务', '▦'], ['partners', '渠道', '◇'], ['me', '我的', '◉']];
    const currentPage = module ? module.page : 'me';
    const title = module ? getOperationTitle(module) : '我的';
    const subtitle = `${roleName(user)} · ${user.partnerName || user.region || '联软渠道管理平台'}`;
    const mainBody = currentPage === 'me' ? `
      <section class="v2-profile"><span>${escapeHtml((user.name || user.username || '用').slice(0, 1))}</span><div><h1>${escapeHtml(user.name || user.username || '用户')}</h1><p>${escapeHtml(roleName(user))}</p><small>${escapeHtml(user.partnerName || user.region || '—')}</small></div></section>
      <section class="v2-settings"><button type="button" data-action="go" data-page="notifications">消息通知 <b>›</b></button><button type="button" data-action="reload-session">校验二期登录态 <b>›</b></button><button type="button" data-action="open-v1">返回一期移动端 <b>›</b></button><button class="v2-settings__danger" type="button" data-action="logout">退出登录 <b>›</b></button></section>` : `
      ${module.recordId || module.operation ? '' : currentPage === 'home' ? `<section class="v2-welcome"><span>二期只读基础能力</span><h1>您好，${escapeHtml(user.name || user.username || '用户')}</h1><p>当前页面只展示二期服务端已授权的真实数据。</p></section>` : `<section class="v2-module-heading"><h1>${escapeHtml(module.title)}</h1><p>${module.frozen ? '当前仅展示功能开放状态，业务写入继续冻结。' : '仅查询二期已发布接口，不回退到一期或电脑端历史业务接口。'}</p></section>`}
      ${moduleContentView(module)}`;
    return `
      <header class="v2-header">
        <div class="v2-header__title">${module && (module.recordId || module.operation) ? `<button class="v2-back-button" type="button" data-action="back-list">‹</button>` : ''}<div class="v2-header__copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(subtitle)}</small></div></div>
        <button class="v2-icon-button" type="button" data-action="reload-module" aria-label="刷新">↻</button>
      </header>
      <main class="v2-main">
        ${state.notice ? `<p class="v2-message v2-message--notice">${escapeHtml(state.notice)}</p>` : ''}
        ${mainBody}
      </main>
      <nav class="v2-nav" aria-label="主导航">${navigation.map(function (item) {
        const active = item[0] === currentPage ? ' v2-nav__item--active' : '';
        return `<button class="v2-nav__item${active}" type="button" data-action="go" data-page="${item[0]}"><span>${item[2]}</span>${item[1]}</button>`;
      }).join('')}</nav>`;
  }

  function bindEvents() {
    root.querySelectorAll('[data-action="choose-scope"]').forEach(function (button) {
      button.addEventListener('click', function () { chooseScope(button.dataset.scope); });
    });
    root.querySelectorAll('[data-action="clear-scope"]').forEach(function (button) {
      button.addEventListener('click', clearScope);
    });
    root.querySelectorAll('[data-action="go"]').forEach(function (button) {
      button.addEventListener('click', function () { setRoute(`/${state.scope}/${button.dataset.page}`); });
    });
    root.querySelectorAll('[data-action="go-write"]').forEach(function (button) {
      button.addEventListener('click', function () {
        const route = String(button.dataset.route || '');
        if (route.startsWith(`/${state.scope}/`) && !route.includes('..')) setRoute(route);
      });
    });
    root.querySelectorAll('[data-action="reload-module"]').forEach(function (button) {
      button.addEventListener('click', function () { loadModule({ resetPage: false }); });
    });
    root.querySelectorAll('[data-action="adopt-session"]').forEach(function (button) {
      button.addEventListener('click', adoptSession);
    });
    root.querySelectorAll('[data-action="open-v1-login"]').forEach(function (button) {
      button.addEventListener('click', function () { window.location.assign(`mobile.html?scope=${encodeURIComponent(state.scope)}#/login`); });
    });
    root.querySelectorAll('[data-action="reload-session"]').forEach(function (button) {
      button.addEventListener('click', restoreLoginState);
    });
    root.querySelectorAll('[data-action="logout"]').forEach(function (button) {
      button.addEventListener('click', doLogout);
    });
    root.querySelectorAll('[data-action="open-v1"]').forEach(function (button) {
      button.addEventListener('click', function () { window.location.assign(`mobile.html?scope=${encodeURIComponent(state.scope)}#/login`); });
    });
    root.querySelectorAll('[data-action="open-detail"]').forEach(function (button) {
      button.addEventListener('click', function () {
        const module = getCurrentModule();
        if (module && button.dataset.id) setRoute(`/${state.scope}/${module.page}/${encodeURIComponent(button.dataset.id)}`);
      });
    });
    root.querySelectorAll('[data-action="back-list"]').forEach(function (button) {
      button.addEventListener('click', function () {
        const module = getCurrentModule();
        if (module) setRoute(`/${state.scope}/${module.page}`);
      });
    });
    root.querySelectorAll('[data-action="load-more"]').forEach(function (button) {
      button.addEventListener('click', function () { loadModule({ append: true }); });
    });
    root.querySelectorAll('[data-action="prepare-write"]').forEach(function (button) {
      button.addEventListener('click', function () { prepareWriteAction(button); });
    });
    root.querySelectorAll('[data-action="submit-write"]').forEach(function (button) {
      button.addEventListener('click', function () { submitPublishedWrite(button); });
    });
    root.querySelectorAll('[data-write-form]').forEach(function (form) {
      const remember = function () {
        const formKey = form.dataset.formKey;
        if (formKey) state.write.forms[formKey] = collectWriteFormValues(form);
      };
      form.addEventListener('input', remember);
      form.addEventListener('change', remember);
      form.addEventListener('submit', function (event) { event.preventDefault(); });
    });
    root.querySelectorAll('[data-action="reset-filter"]').forEach(function (button) {
      button.addEventListener('click', function () {
        const module = getCurrentModule();
        if (!module) return;
        state.filters[`${state.scope}:${module.page}`] = { keyword: '', status: '' };
        loadModule({ resetPage: true });
      });
    });
    root.querySelectorAll('[data-form="record-filter"]').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        const module = getCurrentModule();
        if (!module) return;
        const formData = new FormData(form);
        state.filters[`${state.scope}:${module.page}`] = {
          keyword: String(formData.get('keyword') || '').trim(),
          status: String(formData.get('status') || '').trim()
        };
        loadModule({ resetPage: true });
      });
    });
  }

  function render() {
    guardRoute();
    if (!state.scope) root.innerHTML = entryView();
    else if (!state.session) root.innerHTML = loginView();
    else root.innerHTML = shellView();
    bindEvents();
  }

  async function restoreLoginState() {
    if (!state.session) return;
    state.restoring = true;
    state.notice = '';
    render();
    try {
      const user = await api.getCurrentUser();
      state.session = api.saveSession({ token: state.session.token, user });
      state.notice = '兼容测试会话已由二期服务校验；生产级短时令牌与刷新会话尚未开发。';
    } catch (error) {
      if (error.status === 401) {
        api.clearSession();
        api.clearPublishedWriteContracts();
        state.session = null;
        state.featureFlags = createFeatureFlagState();
        state.write = createWriteState();
        state.loginError = '登录已失效，请重新登录。';
      } else {
        state.notice = error.code === 'V2_SERVICE_NOT_READY'
          ? '二期服务尚未发布，当前不会加载任何业务数据。'
          : '暂时无法校验二期登录态，业务数据不会加载。';
      }
    } finally {
      state.restoring = false;
      render();
      if (state.session) {
        loadFeatureFlags();
        loadModule({ resetPage: true });
      }
    }
  }

  async function adoptSession() {
    state.loginError = '';
    const session = api.getLegacySession(state.scope);
    if (!session) {
      state.loginError = '未找到当前入口的一期登录态，请先完成一期登录。';
      render();
      return;
    }
    state.session = api.saveSession(session);
    if (!isScopeMatched()) {
      api.clearSession();
      state.session = null;
      state.featureFlags = createFeatureFlagState();
      state.write = createWriteState();
      state.loginError = '该账号不属于当前入口，请切换入口后重新登录。';
      render();
      return;
    }
    setRoute(`/${state.scope}/home`, true);
    await restoreLoginState();
  }

  async function doLogout() {
    try {
      await api.logout(state.scope);
    } catch (error) {
      // 无论退出接口是否可达，都必须清除本机登录态，避免再次接续旧令牌。
      api.clearSession();
      api.clearPublishedWriteContracts();
      api.clearLegacySession(state.scope);
    }
    state.session = null;
    state.notice = '';
    state.module = createModuleState();
    state.featureFlags = createFeatureFlagState();
    state.write = createWriteState();
    setRoute('/login', true);
    render();
  }

  function buildListPath(module, page, filters) {
    const query = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (filters.keyword) query.set('keyword', filters.keyword);
    if (filters.status) query.set('status', filters.status);
    return `${module.endpoint}?${query.toString()}`;
  }

  async function loadModule(options) {
    const config = options || {};
    const module = getCurrentModule();
    if (!state.session || !module || module.type === 'profile') return;
    const operationUsesQuoteProducts = module.operation === 'quote-draft';
    const operationWithoutRead = ['registration-draft'].includes(module.operation);
    const operationContract = module.operation && WRITE_CONTRACTS[module.operation] ? module.operation : '';
    if (operationWithoutRead || ((operationContract && !canShowWriteAction(operationContract)) && !operationUsesQuoteProducts) || (module.operation === 'opportunity-create' && !module.relatedId)) {
      state.module = {
        ...createModuleState(), key: `${state.scope}:${module.page}:${module.operation || 'view'}`,
        status: 'ready', type: module.type, label: module.label
      };
      render();
      return;
    }
    if (module.frozen) {
      state.module = {
        ...createModuleState(), key: `${state.scope}:${module.page}`, status: 'frozen', type: module.type, label: module.label,
        message: '二期基础接口当前只读。审核写入将在状态机、审计、并发和幂等规则冻结后开放。'
      };
      render();
      return;
    }
    const detail = Boolean(module.recordId || module.relatedId);
    const paged = ['registration', 'opportunity', 'quote', 'order', 'partner', 'notification'].includes(module.type) && !detail;
    const filterKey = `${state.scope}:${module.page}`;
    const filters = state.filters[filterKey] || { keyword: '', status: '' };
    const previous = state.module;
    const canAppend = config.append && paged && previous.key === filterKey && previous.status === 'ready' && previous.pagination.hasMore;
    const page = canAppend ? previous.pagination.page + 1 : 1;
    const endpoint = module.operation === 'opportunity-create'
      ? `/registrations/${encodeURIComponent(module.relatedId)}`
      : (operationUsesQuoteProducts
        ? '/quote-products'
        : (module.operation && module.operation.endsWith('-events')
          ? `${module.endpoint}/${encodeURIComponent(module.recordId)}/events`
          : (detail ? `${module.endpoint}/${encodeURIComponent(module.recordId)}` : (paged ? buildListPath(module, page, filters) : module.endpoint))));
    const moduleKey = detail ? `${filterKey}:${module.recordId || module.relatedId}:${module.operation || 'detail'}` : filterKey;
    const requestId = ++state.moduleRequestId;
    state.module = {
      ...createModuleState(), key: moduleKey, status: canAppend ? 'loading-more' : 'loading',
      type: module.type, label: module.label, filters: { ...filters }, data: canAppend ? previous.data : null,
      pagination: canAppend ? previous.pagination : { page: 1, pageSize: 20, total: 0, hasMore: false }
    };
    render();
    try {
      const result = await api.request(endpoint);
      if (requestId !== state.moduleRequestId) return;
      const data = result.data === undefined ? result : result.data;
      const records = Array.isArray(data) ? data : null;
      const merged = canAppend && records ? (Array.isArray(previous.data) ? previous.data : []).concat(records) : data;
      const total = Number.isFinite(Number(result.total)) ? Number(result.total) : (Array.isArray(merged) ? merged.length : 0);
      const isEmpty = Array.isArray(merged) && merged.length === 0 && !operationUsesQuoteProducts;
      state.module = {
        ...createModuleState(), key: moduleKey, status: isEmpty ? 'empty' : 'ready', type: module.type,
        label: module.label, data: merged, filters: { ...filters }, pagination: {
          page: Number(result.page) || page, pageSize: Number(result.pageSize) || 20, total,
          hasMore: Boolean(result.hasMore)
        }
      };
    } catch (error) {
      if (requestId !== state.moduleRequestId) return;
      if (error.status === 401) {
        api.clearSession();
        api.clearPublishedWriteContracts();
        state.session = null;
        state.featureFlags = createFeatureFlagState();
        state.write = createWriteState();
        state.loginError = '登录已失效，请重新登录。';
        setRoute('/login', true);
      } else if (error.code === 'FEATURE_DISABLED') {
        state.module = {
          ...createModuleState(), key: moduleKey, status: 'frozen', type: module.type,
          message: '服务端已关闭当前功能，页面不会回退到一期或发起任何写入。', label: module.label
        };
      } else if (error.code === 'BUSINESS_CONFIG_MISSING') {
        state.module = {
          ...createModuleState(), key: moduleKey, status: 'frozen', type: module.type,
          message: 'BUSINESS_CONFIG_MISSING：服务端业务参数未配置，当前操作保持关闭且不会自动重试。', label: module.label
        };
      } else if (error.code === 'V2_SERVICE_NOT_READY' || error.status === 404) {
        state.module = {
          ...createModuleState(), key: moduleKey, status: 'not-ready', type: module.type,
          message: detail ? '该记录不存在、已失效或当前账号无权访问。' : '二期业务接口尚未发布，本页面不会回退到一期或电脑端接口。', label: module.label
        };
      } else {
        state.module = {
          ...createModuleState(), key: moduleKey, status: 'error', type: module.type,
          message: error.message, label: module.label
        };
      }
    }
    render();
    if (module.operation === 'order-draft' && state.module.status === 'ready') loadOrderParentOptions(module);
  }

  window.addEventListener('hashchange', function () {
    state.module = createModuleState();
    render();
    loadModule({ resetPage: true });
  });

  window.addEventListener('DOMContentLoaded', function () {
    render();
    if (state.session) restoreLoginState();
  });
})(window, document);
