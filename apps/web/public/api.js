// ============================================================
// API 客户端 - 后端通信层
// 支持 localStorage 模式和 API 模式切换
// ============================================================

const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000/api';
const USE_API = window.USE_API !== false; // 默认使用 API

// 请求拦截器
async function request(url, options = {}) {
  const token = localStorage.getItem('lianruan_token');
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    },
    ...options
  };
  
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || '请求失败');
    }
    
    return data;
  } catch (error) {
    console.error('[API] 请求失败:', error);
    throw error;
  }
}

// API 客户端
const api = {
  // 认证
  auth: {
    login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
    verify: () => request('/auth/verify'),
    changePassword: (data) => request('/auth/change-password', { method: 'POST', body: data }),
  },
  
  // 商机
  opportunities: {
    list: (params) => request(`/opportunities?${new URLSearchParams(params)}`),
    get: (id) => request(`/opportunities/${id}`),
    create: (data) => request('/opportunities', { method: 'POST', body: data }),
    update: (id, data) => request(`/opportunities/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/opportunities/${id}`, { method: 'DELETE' }),
    addFollowUp: (id, data) => request(`/opportunities/${id}/follow-ups`, { method: 'POST', body: data }),
  },
  
  // 客户报备
  registrations: {
    list: (params) => request(`/registrations?${new URLSearchParams(params)}`),
    get: (id) => request(`/registrations/${id}`),
    create: (data) => request('/registrations', { method: 'POST', body: data }),
    audit: (id, data) => request(`/registrations/${id}/audit`, { method: 'PUT', body: data }),
  },
  
  // 报价单
  quotes: {
    list: (params) => request(`/quotes?${new URLSearchParams(params)}`),
    get: (id) => request(`/quotes/${id}`),
    create: (data) => request('/quotes', { method: 'POST', body: data }),
    update: (id, data) => request(`/quotes/${id}`, { method: 'PUT', body: data }),
  },
  
  // 订单
  orders: {
    list: (params) => request(`/orders?${new URLSearchParams(params)}`),
    get: (id) => request(`/orders/${id}`),
    create: (data) => request('/orders', { method: 'POST', body: data }),
    updateStatus: (id, data) => request(`/orders/${id}/status`, { method: 'PUT', body: data }),
  },
  
  // 渠道商
  partners: {
    list: (params) => request(`/partners?${new URLSearchParams(params)}`),
    get: (id) => request(`/partners/${id}`),
    create: (data) => request('/partners', { method: 'POST', body: data }),
    addStaff: (id, data) => request(`/partners/${id}/staff`, { method: 'POST', body: data }),
    audit: (id, data) => request(`/partners/${id}/audit`, { method: 'PUT', body: data }),
  },
  
  // 管理员
  admin: {
    accounts: {
      list: () => request('/admin/accounts'),
      create: (data) => request('/admin/accounts', { method: 'POST', body: data }),
      update: (id, data) => request(`/admin/accounts/${id}`, { method: 'PUT', body: data }),
      delete: (id) => request(`/admin/accounts/${id}`, { method: 'DELETE' }),
      resetPassword: (id) => request(`/admin/accounts/${id}/reset-password`, { method: 'POST' }),
    },
    pending: () => request('/admin/pending'),
  },
  
  // 报表
  reports: {
    dashboard: () => request('/reports/dashboard'),
    byRegion: () => request('/reports/by-region'),
    partnerRanking: (params) => request(`/reports/partner-ranking?${new URLSearchParams(params)}`),
    trends: (params) => request(`/reports/trends?${new URLSearchParams(params)}`),
  },
  
  // 数据管理
  data: {
    export: () => request('/data/export'),
    import: (data) => request('/data/import', { method: 'POST', body: data }),
    stats: () => request('/data/stats'),
  },
};

// 兼容层：如果 USE_API 为 false，使用 localStorage
const storeApi = {
  // 从 localStorage 获取数据
  _getData() {
    const version = localStorage.getItem('lianruan_data_version') || '2';
    const data = localStorage.getItem(`lianruan_data_v${version}`);
    return data ? JSON.parse(data) : {};
  },
  
  // 保存数据到 localStorage
  _saveData(data) {
    const version = localStorage.getItem('lianruan_data_version') || '2';
    localStorage.setItem(`lianruan_data_v${version}`, JSON.stringify(data));
  },
  
  // 商机
  opportunities: {
    list: async (params) => {
      const data = storeApi._getData();
      let list = data.opportunities || [];
      
      // 过滤和分页逻辑...
      const page = parseInt(params.page) || 1;
      const pageSize = parseInt(params.pageSize) || 10;
      const start = (page - 1) * pageSize;
      
      return {
        success: true,
        data: {
          list: list.slice(start, start + pageSize),
          pagination: { page, pageSize, total: list.length }
        }
      };
    },
    // ... 其他方法
  }
};

// 导出 API（根据配置选择使用 API 或 localStorage）
window.api = USE_API ? api : storeApi;
