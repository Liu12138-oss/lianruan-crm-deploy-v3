/**
 * API 客户端 - 后端服务对接
 * 替代 localStorage，实现数据共享
 */

// API 基础配置
// 优先使用 window.API_BASE（可在 HTML 中提前定义来覆盖），
// 否则自动推断：本地开发走 localhost:3000，生产环境走同域 3000 端口
if (typeof window.API_BASE === 'undefined') {
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  window.API_BASE = isLocal
    ? 'http://localhost:3000/api'
    : `${window.location.protocol}//${host}:3000/api`;
}
const API_BASE = window.API_BASE;

// API 基础配置（确保 window.APP_PREFIX 在加载前已定义）
// APP_PREFIX 通过 window.APP_PREFIX 设置（在 HTML 中或 api-client.js 之前）
const APP_PREFIX = window.APP_PREFIX || '';

// localStorage key 辅助函数
function getStorageKey(key) {
  return APP_PREFIX + key;
}

// 当前登录用户（模块级缓存）
let currentUser = null;
let authToken = null;

// 从 localStorage 恢复登录状态
function loadUserFromStorage() {
  try {
    // 尝试带前缀的 key
    const saved = localStorage.getItem(getStorageKey('api_user'));
    if (saved) {
      const data = JSON.parse(saved);
      currentUser = data.user;
      authToken = data.token;
      return;
    }
    // 尝试不带前缀的 key（兼容旧版）
    const legacySaved = localStorage.getItem('api_user');
    if (legacySaved) {
      const data = JSON.parse(legacySaved);
      currentUser = data.user;
      authToken = data.token;
      return;
    }
  } catch (e) {}
  currentUser = null;
  authToken = null;
}

// 初始化时加载一次（仅用于首次加载，之后由 syncUser 同步）
loadUserFromStorage();

// 同步用户信息（供外部调用，确保 store.user 与 currentUser 一致）
// admin-app.js 在 restoreLoginState() 后调用此函数
function syncUser(user) {
  if (user) {
    currentUser = user;
    // 同时从 localStorage 读取最新的 token（使用传入用户信息中存储的前缀）
    const userPrefix = user._storagePrefix || APP_PREFIX || '';
    const saved = localStorage.getItem(userPrefix + 'api_user');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        authToken = data.token;
      } catch (e) {}
    }
    // 兼容：如果没读到，尝试当前 APP_PREFIX
    if (!authToken) {
      const saved2 = localStorage.getItem(getStorageKey('api_user'));
      if (saved2) {
        try {
          const data = JSON.parse(saved2);
          authToken = data.token;
        } catch (e) {}
      }
    }
  }
}

function withOperatorPayload(payload = {}) {
  loadUserFromStorage();
  const base = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  return {
    ...base,
    operatorId: base.operatorId || base.operatedBy || currentUser?.id || '',
    operatorName: base.operatorName || base.operatedByName || currentUser?.name || '',
    operatorRole: base.operatorRole || base.operatedByRole || currentUser?.role || '',
    operatedBy: base.operatedBy || base.operatorId || currentUser?.id || '',
    operatedByName: base.operatedByName || base.operatorName || currentUser?.name || '',
    operatedByRole: base.operatedByRole || base.operatorRole || currentUser?.role || ''
  };
}

function buildAuthHeaders(headers = {}) {
  loadUserFromStorage();
  const result = { ...headers };
  if (authToken && !result.Authorization) {
    result.Authorization = `Bearer ${authToken}`;
  }
  return result;
}

function apiFetch(url, options = {}) {
  return window.fetch(url, {
    ...options,
    credentials: 'include',
    headers: buildAuthHeaders(options.headers || {})
  });
}

const apiClient = {
  // 登录
  async login(username, password, options = {}) {
    const res = await apiFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    
    currentUser = data.user;
    authToken = data.token;
    // 保存前缀信息到用户对象中，便于 syncUser 正确读取
    const prefix = options.prefix || APP_PREFIX || window.APP_PREFIX || '';
    if (prefix) {
      currentUser._storagePrefix = prefix;
    }
    // 保存到带前缀的 key
    localStorage.setItem(getStorageKey('api_user'), JSON.stringify({ user: currentUser, token: authToken }));
    localStorage.setItem(getStorageKey('user_info'), JSON.stringify(currentUser));
    localStorage.setItem(getStorageKey('auth_token'), authToken);
    return data;
  },
  
  // 获取当前用户
  getUser() {
    return currentUser;
  },
  
  // 退出登录
  logout() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem(getStorageKey('api_user'));
    localStorage.removeItem(getStorageKey('user_info'));
    localStorage.removeItem(getStorageKey('auth_token'));
  },
  
  // 创建报备
  async createRegistration(regData) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...regData,
        createdBy: regData.createdBy || currentUser?.id,
        createdByName: regData.createdByName || currentUser?.name,
        region: regData.region || currentUser?.region
      })
    });
    return res.json();
  },
  
  // 获取报备列表
  async getRegistrations(filters = {}) {
    loadUserFromStorage();
    const params = new URLSearchParams();
    if (currentUser?.id) {
      params.append('operatorId', currentUser.id);
    }
    
    // 根据角色过滤数据
    if (currentUser?.role === 'staff') {
      // 员工只能看自己的
      params.append('userId', currentUser.id);
      console.log('[API] staff 模式，userId:', currentUser.id);
    } else if (currentUser?.role === 'partner_admin') {
      // 企业管理员看本企业的全部
      params.append('partnerId', currentUser.partnerId);
      console.log('[API] partner_admin 模式，partnerId:', currentUser.partnerId);
    } else if (currentUser?.role === 'admin') {
      // 区域管理员看本区域的
      params.append('region', currentUser.region);
      console.log('[API] admin 模式，region:', currentUser.region);
    } else {
      console.log('[API] 未识别角色或未登录，currentUser:', currentUser);
    }
    // 超级管理员看全部，不加过滤
    
    Object.entries(filters).forEach(([k, v]) => params.append(k, v));
    
    const url = `${API_BASE}/registrations?${params}`;
    console.log('[API] 请求 URL:', url);
    const res = await apiFetch(url);
    const result = await res.json();
    console.log('[API] 报备返回条数:', result.data?.length || 0);
    return result;
  },
  
  // 更新报备状态（管理员审核）
  async updateRegistrationStatus(id, status, remark) {
    const res = await apiFetch(`${API_BASE}/registrations/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withOperatorPayload({ status, remark }))
    });
    return res.json();
  },
  
  // 创建商机
  async createOpportunity(oppData) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/opportunities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...oppData,
        // 确保 createdBy、createdByName、region 有值（如果传入的数据没有，则使用 currentUser）
        createdBy: oppData.createdBy || currentUser?.id,
        createdByName: oppData.createdByName || currentUser?.name,
        region: oppData.region || currentUser?.region
      })
    });
    return res.json();
  },
  
  // 获取商机列表
  async getOpportunities(filters = {}) {
    // 每次调用时重新加载用户数据（确保登录后可用）
    loadUserFromStorage();
    
    const params = new URLSearchParams();
    if (currentUser?.id) {
      params.append('operatorId', currentUser.id);
    }
    
    if (currentUser?.role === 'staff') {
      params.append('userId', currentUser.id);
    } else if (currentUser?.role === 'partner_admin') {
      params.append('partnerId', currentUser.partnerId);
    } else if (currentUser?.role === 'admin') {
      params.append('region', currentUser.region);
    }
    
    Object.entries(filters).forEach(([k, v]) => params.append(k, v));
    
    const res = await apiFetch(`${API_BASE}/opportunities?${params}`);
    return res.json();
  },
  
  // 更新商机（包括跟进记录、阶段等）
  async updateOpportunity(id, updates) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/opportunities/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withOperatorPayload(updates || {}))
    });
    return res.json();
  },
  
  // 更新报备记录（指派渠道商、跟进员工等）
  async updateRegistration(id, updates) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/registrations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withOperatorPayload(updates || {}))
    });
    return res.json();
  },
  
  // 获取仪表盘统计
  async getDashboardStats() {
    loadUserFromStorage();
    const params = new URLSearchParams();
    if (currentUser?.role === 'admin') {
      params.append('region', currentUser.region);
    }
    const res = await apiFetch(`${API_BASE}/dashboard/stats?${params}`);
    return res.json();
  },
  
  // 创建报价单
  async createQuote(quoteData) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...quoteData,
        createdBy: quoteData.createdBy || currentUser?.id,
        createdByName: quoteData.createdByName || currentUser?.name,
        region: quoteData.region || currentUser?.region
      })
    });
    return res.json();
  },
  
  // 获取报价单列表
  async getQuotes(filters = {}) {
    loadUserFromStorage();
    const params = new URLSearchParams();
    if (currentUser?.id) {
      params.append('operatorId', currentUser.id);
    }
    
    if (currentUser?.role === 'staff') {
      params.append('userId', currentUser.id);
    } else if (currentUser?.role === 'partner_admin') {
      params.append('partnerId', currentUser.partnerId);
    } else if (currentUser?.role === 'admin') {
      params.append('region', currentUser.region);
    }
    
    Object.entries(filters).forEach(([k, v]) => params.append(k, v));
    
    const res = await apiFetch(`${API_BASE}/quotes?${params}`);
    return res.json();
  },
  
  // 删除报价单
  async deleteQuote(quoteId) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/quotes/${quoteId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operatorId: currentUser?.id || '',
        operatorName: currentUser?.name || '',
        operatorRole: currentUser?.role || ''
      })
    });
    return res.json();
  },
  
  // 创建订单
  async createOrder(orderData) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...orderData,
        createdBy: orderData.createdBy || currentUser?.id,
        createdByName: orderData.createdByName || currentUser?.name,
        region: orderData.region || currentUser?.region
      })
    });
    return res.json();
  },
  
  // 获取订单列表
  async getOrders(filters = {}) {
    loadUserFromStorage();
    const params = new URLSearchParams();
    if (currentUser?.id) {
      params.append('operatorId', currentUser.id);
    }
    
    if (currentUser?.role === 'staff') {
      params.append('userId', currentUser.id);
    } else if (currentUser?.role === 'partner_admin') {
      params.append('partnerId', currentUser.partnerId);
    } else if (currentUser?.role === 'admin') {
      params.append('region', currentUser.region);
    }
    
    Object.entries(filters).forEach(([k, v]) => params.append(k, v));
    
    const res = await apiFetch(`${API_BASE}/orders?${params}`);
    return res.json();
  },

  // 删除订单
  async deleteOrder(orderId) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/orders/${orderId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operatorId: currentUser?.id || '',
        operatorName: currentUser?.name || '',
        operatorRole: currentUser?.role || ''
      })
    });
    return res.json();
  },

  // ???????????/?????
  async updateOrderStatus(orderId, status, remark = '') {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        remark,
        operatorId: currentUser?.id,
        operatorName: currentUser?.name,
        operatorRole: currentUser?.role
      })
    });
    return res.json();
  },

  // ?????????????????
  async getPartners(filters = {}) {
    loadUserFromStorage();
    const params = new URLSearchParams();
    if (currentUser?.id) {
      params.append('operatorId', currentUser.id);
    }

    // ????????????
    if (currentUser?.role === 'admin' && currentUser?.region) {
      params.append('region', currentUser.region);
    }

    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.append(k, v);
      }
    });

    const res = await apiFetch(`${API_BASE}/partners?${params}`);
    return res.json();
  },

  // 获取单个渠道商详情（包含员工列表）
  async getPartnerDetail(partnerId) {
    loadUserFromStorage();
    const params = new URLSearchParams();
    if (currentUser?.id) {
      params.append('operatorId', currentUser.id);
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const res = await apiFetch(`${API_BASE}/partners/${partnerId}${query}`, { headers });
    return res.json();
  },

  // 更新渠道商
  async updatePartner(partnerId, updates) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/partners/${partnerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withOperatorPayload(updates || {}))
    });
    return res.json();
  },

  // 删除渠道商
  async deletePartner(partnerId) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/partners/${partnerId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withOperatorPayload())
    });
    return res.json();
  },

  // 更新渠道商状态（审批）
  async updatePartnerStatus(partnerId, status, remark, approvedBy) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/partners/${partnerId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withOperatorPayload({ status, remark, approvedBy }))
    });
    return res.json();
  },

  // 获取用户列表（管理员账号管理）
  async getUsers(filters = {}) {
    loadUserFromStorage();
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => params.append(k, v));
    const res = await apiFetch(`${API_BASE}/users?${params}`);
    return res.json();
  },

  // 创建用户（管理员账号）
  async createUser(userData) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return res.json();
  },

  // 更新用户
  async updateUser(userId, updates) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withOperatorPayload(updates || {}))
    });
    return res.json();
  },

  // 删除用户
  async deleteUser(userId) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withOperatorPayload())
    });
    return res.json();
  },

  // 删除报备
  async deleteRegistration(regId) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/registrations/${regId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withOperatorPayload())
    });
    return res.json();
  },

  // 更新报价单
  async updateQuote(quoteId, updates) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/quotes/${quoteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withOperatorPayload(updates || {}))
    });
    return res.json();
  },

  // 更新报价单状态（发送/确认/撤回/转单）
  async updateQuoteStatus(quoteId, status) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/quotes/${quoteId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withOperatorPayload({ status }))
    });
    return res.json();
  },

  async previewQuoteWorkload(payload) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/quotes/workload-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    return res.json();
  },

  async previewIpgQuote(payload) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/ipg/quote-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    return res.json();
  },

  async getWorkloadMappings(keyword = '') {
    loadUserFromStorage();
    const params = new URLSearchParams();
    params.append('operatorId', currentUser?.id || '');
    if (keyword) params.append('keyword', keyword);
    const res = await apiFetch(`${API_BASE}/workload/mappings?${params}`);
    return res.json();
  },

  async updateWorkloadMapping(featureId, payload) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/workload/mappings/${featureId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(payload || {}),
        operatorId: currentUser?.id || ''
      })
    });
    return res.json();
  },

  async getWorkloadRules() {
    loadUserFromStorage();
    const params = new URLSearchParams();
    params.append('operatorId', currentUser?.id || '');
    const res = await apiFetch(`${API_BASE}/workload/rules?${params}`);
    return res.json();
  },

  async getWorkloadDeliveryRules() {
    loadUserFromStorage();
    const params = new URLSearchParams();
    params.append('operatorId', currentUser?.id || '');
    const res = await apiFetch(`${API_BASE}/workload/delivery-rules?${params}`);
    return res.json();
  },

  async updateWorkloadDeliveryRule(ruleId, payload) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/workload/delivery-rules/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(payload || {}),
        operatorId: currentUser?.id || ''
      })
    });
    return res.json();
  },

  async createWorkloadRule(payload) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/workload/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(payload || {}),
        operatorId: currentUser?.id || ''
      })
    });
    return res.json();
  },

  async updateWorkloadRule(ruleId, payload) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/workload/rules/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(payload || {}),
        operatorId: currentUser?.id || ''
      })
    });
    return res.json();
  },

  async deleteWorkloadRule(ruleId) {
    loadUserFromStorage();
    const params = new URLSearchParams();
    params.append('operatorId', currentUser?.id || '');
    const res = await apiFetch(`${API_BASE}/workload/rules/${ruleId}?${params}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // 获取待审批列表
  async getPendingApprovals() {
    loadUserFromStorage();
    const params = new URLSearchParams();
    if (currentUser) {
      params.append('userRole', currentUser.role);
    }
    const res = await apiFetch(`${API_BASE}/pending-approvals?${params}`);
    return res.json();
  },

  // 审批/驳回账号申请
  async approvePendingAccount(approvalId, action) {
    loadUserFromStorage();
    const res = await apiFetch(`${API_BASE}/pending-approvals/${approvalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        approvedBy: currentUser?.name
      })
    });
    return res.json();
  }
};

// 兼容旧版 localStorage API（用于平滑过渡）
const legacyStorage = {
  getItem(key) {
    return localStorage.getItem(key);
  },
  setItem(key, value) {
    localStorage.setItem(key, value);
  },
  removeItem(key) {
    localStorage.removeItem(key);
  }
};

// 导出
window.apiClient = apiClient;
window.legacyStorage = legacyStorage;
window.syncUser = syncUser;
