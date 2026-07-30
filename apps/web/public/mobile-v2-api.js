/*
 * 移动端二期专用接口客户端。
 * 仅允许请求 /api/mobile/v2/*，不得复用一期或电脑端历史业务接口。
 */
(function (window) {
  'use strict';

  // 仅用于本地兼容测试的当前标签页会话，不写入 localStorage。
  const SESSION_KEY = 'mobile_v2_session';
  const REQUEST_TIMEOUT = 15000;
  const WRITE_METHODS = new Set(['POST', 'PUT']);
  const ALLOWED_WRITE_CONTRACTS = Object.freeze({
    'registration-draft': { method: 'POST', path: '/registration-drafts' },
    'registration-submit': { method: 'POST', path: '/registrations' },
    'registration-review': { method: 'PUT', path: '/registrations/:id/review' },
    'opportunity-create': { method: 'POST', path: '/opportunities' },
    'opportunity-update': { method: 'PUT', path: '/opportunities/:id' },
    'opportunity-advance': { method: 'PUT', path: '/opportunities/:id/stage' },
    'opportunity-follow-up': { method: 'POST', path: '/opportunities/:id/follow-ups' },
    'quote-preview': { method: 'POST', path: '/quotes/preview' },
    'quote-draft': { method: 'POST', path: '/quote-drafts' },
    'quote-submit': { method: 'POST', path: '/quotes' },
    'quote-discount-review': { method: 'PUT', path: '/quotes/:id/discount-review' },
    'quote-confirm': { method: 'PUT', path: '/quotes/:id/confirm' },
    'order-draft': { method: 'POST', path: '/order-drafts' },
    'order-submit': { method: 'POST', path: '/orders/:id/submit' },
    'order-primary-review': { method: 'PUT', path: '/orders/:id/primary-review' },
    'order-fulfill': { method: 'PUT', path: '/orders/:id/fulfillment' }
  });
  const publishedWriteContracts = new Map();

  function isExperimentalEnabled() {
    return window.MOBILE_V2_EXPERIMENTAL_ENABLED === true;
  }

  function getApiBase() {
    if (window.MOBILE_V2_API_BASE) {
      return String(window.MOBILE_V2_API_BASE).replace(/\/$/, '');
    }
    const protocol = window.location.protocol || 'http:';
    const host = window.location.hostname || 'localhost';
    return `${protocol}//${host}:3000/api/mobile/v2`;
  }

  class MobileV2ApiError extends Error {
    constructor(message, code, status) {
      super(message);
      this.name = 'MobileV2ApiError';
      this.code = code || 'V2_REQUEST_FAILED';
      this.status = Number(status) || 0;
    }
  }

  function getStoredSession() {
    if (!isExperimentalEnabled()) {
      clearSession();
      return null;
    }
    try {
      const value = window.sessionStorage.getItem(SESSION_KEY);
      if (!value) return null;
      const session = JSON.parse(value);
      if (!session || !session.token || !session.user) return null;
      return session;
    } catch (error) {
      window.sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function saveSession(session) {
    if (!isExperimentalEnabled()) {
      throw new MobileV2ApiError('移动端二期未开放，未保存登录态', 'V2_DISABLED');
    }
    if (!session || !session.token || !session.user) {
      throw new MobileV2ApiError('二期登录响应不完整，未保存登录态', 'V2_AUTH_RESPONSE_INVALID');
    }
    const safeSession = {
      token: String(session.token),
      user: session.user,
      savedAt: new Date().toISOString()
    };
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(safeSession));
    return safeSession;
  }

  function clearSession() {
    window.sessionStorage.removeItem(SESSION_KEY);
  }

  function clearLegacySession(scope) {
    const prefix = scope === 'partner' ? 'partner_' : scope === 'admin' ? 'admin_' : '';
    if (!prefix) return;
    ['api_user', 'user_info', 'auth_token'].forEach(function (key) {
      window.localStorage.removeItem(`${prefix}${key}`);
    });
  }

  function getPath(path) {
    const normalized = String(path || '').trim();
    if (!normalized || !normalized.startsWith('/') || normalized.includes('..')) {
      throw new MobileV2ApiError('二期接口路径不合法', 'V2_INVALID_PATH');
    }
    return `${getApiBase()}${normalized}`;
  }

  function getHeaderValue(headers, name) {
    const expected = String(name).toLowerCase();
    const key = Object.keys(headers || {}).find(function (item) { return item.toLowerCase() === expected; });
    return key ? headers[key] : '';
  }

  function isSafeContractPath(path) {
    return /^\/(?:[A-Za-z0-9._~-]+|:[A-Za-z][A-Za-z0-9_]*)(?:\/(?:[A-Za-z0-9._~-]+|:[A-Za-z][A-Za-z0-9_]*))*$/.test(path);
  }

  function isContractPathMatched(template, path) {
    const templateParts = String(template).split('/').filter(Boolean);
    const pathParts = String(path).split('?')[0].split('/').filter(Boolean);
    if (templateParts.length !== pathParts.length) return false;
    return templateParts.every(function (part, index) {
      return part.startsWith(':') ? Boolean(pathParts[index]) : part === pathParts[index];
    });
  }

  function normalizePublishedWriteContracts(source) {
    const entries = Array.isArray(source)
      ? source.map(function (item) { return [item && item.key, item]; })
      : Object.entries(source && typeof source === 'object' ? source : {});
    return entries.reduce(function (result, entry) {
      const key = String(entry[0] || '').trim();
      const value = entry[1] && typeof entry[1] === 'object' ? entry[1] : {};
      const method = String(value.method || '').toUpperCase();
      const path = String(value.path || '').trim();
      const allowed = ALLOWED_WRITE_CONTRACTS[key];
      if (!key || !allowed || value.published !== true || !WRITE_METHODS.has(method) || !isSafeContractPath(path)) return result;
      if (allowed.method !== method || allowed.path !== path) return result;
      result.set(key, Object.freeze({ key, method, path }));
      return result;
    }, new Map());
  }

  function setPublishedWriteContracts(contracts) {
    publishedWriteContracts.clear();
    normalizePublishedWriteContracts(contracts).forEach(function (value, key) { publishedWriteContracts.set(key, value); });
  }

  function clearPublishedWriteContracts() {
    publishedWriteContracts.clear();
  }

  function getPublishedWriteContract(key) {
    return publishedWriteContracts.get(String(key || '')) || null;
  }

  function validateWriteRequest(path, method, config) {
    const contractKey = String(config.writeContract || '').trim();
    const contract = getPublishedWriteContract(contractKey);
    if (!contract || contract.method !== method || !isContractPathMatched(contract.path, path)) {
      throw new MobileV2ApiError('当前写接口未由服务端发布契约确认，未发送请求', 'V2_WRITE_CONTRACT_UNPUBLISHED');
    }
    const idempotencyKey = String(getHeaderValue(config.headers, 'Idempotency-Key') || '').trim();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      throw new MobileV2ApiError('写入请求必须携带合法的 Idempotency-Key，未发送请求', 'V2_IDEMPOTENCY_REQUIRED');
    }
  }

  async function request(path, options) {
    if (!isExperimentalEnabled()) {
      throw new MobileV2ApiError('移动端二期未开放，未发送请求', 'V2_DISABLED', 404);
    }
    const config = options || {};
    const method = String(config.method || 'GET').toUpperCase();
    const isLogoutRequest = path === '/logout' && method === 'POST';
    if (method !== 'GET' && !isLogoutRequest && !WRITE_METHODS.has(method)) {
      throw new MobileV2ApiError('二期仅允许已发布契约中的 POST 或 PUT 写请求', 'V2_WRITE_FROZEN');
    }
    if (WRITE_METHODS.has(method) && !isLogoutRequest) {
      validateWriteRequest(path, method, config);
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    const headers = { Accept: 'application/json', ...(config.headers || {}) };
    const session = getStoredSession();

    if (config.auth !== false && session && session.token) {
      headers.Authorization = `Bearer ${session.token}`;
    }
    if (config.body !== undefined) headers['Content-Type'] = 'application/json';

    try {
      const response = await window.fetch(getPath(path), {
        method,
        headers,
        body: config.body === undefined ? undefined : JSON.stringify(config.body),
        signal: controller.signal
      });
      const text = await response.text();
      let result = {};
      try {
        result = text ? JSON.parse(text) : {};
      } catch (error) {
        if (response.status === 404) {
          throw new MobileV2ApiError('二期服务或当前功能接口尚未发布', 'V2_SERVICE_NOT_READY', response.status);
        }
        throw new MobileV2ApiError('二期服务返回了无法识别的数据', 'V2_INVALID_RESPONSE', response.status);
      }

      if (!response.ok || result.success === false) {
        throw new MobileV2ApiError(
          result.error || result.message || `二期服务请求失败（${response.status}）`,
          result.code || (response.status === 404 ? 'V2_SERVICE_NOT_READY' : 'V2_REQUEST_FAILED'),
          response.status
        );
      }
      return result;
    } catch (error) {
      if (error instanceof MobileV2ApiError) throw error;
      if (error && error.name === 'AbortError') {
        throw new MobileV2ApiError('二期服务响应超时，请稍后重试', 'V2_REQUEST_TIMEOUT');
      }
      throw new MobileV2ApiError('无法连接二期服务，请检查网络或服务部署状态', 'V2_NETWORK_ERROR');
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function getCurrentUser() {
    const result = await request('/me');
    const payload = result.data && typeof result.data === 'object' ? result.data : result;
    return payload.user || result.user || payload;
  }

  function getLegacySession(scope) {
    if (!isExperimentalEnabled()) return null;
    // 仅兼容测试：只读取一期已存在的会话，不在二期内重新实现登录。
    const prefix = scope === 'partner' ? 'partner_' : scope === 'admin' ? 'admin_' : '';
    if (!prefix) return null;
    try {
      const value = window.localStorage.getItem(`${prefix}api_user`);
      if (!value) return null;
      const session = JSON.parse(value);
      if (!session || !session.token || !session.user) return null;
      return { token: session.token, user: session.user };
    } catch (error) {
      return null;
    }
  }

  async function logout(scope) {
    try {
      await request('/logout', { method: 'POST' });
    } finally {
      clearSession();
      clearLegacySession(scope);
    }
  }

  window.MobileV2Api = {
    MobileV2ApiError,
    isExperimentalEnabled,
    getApiBase,
    getStoredSession,
    saveSession,
    clearSession,
    clearLegacySession,
    request,
    setPublishedWriteContracts,
    clearPublishedWriteContracts,
    getPublishedWriteContract,
    getCurrentUser,
    getLegacySession,
    logout
  };
})(window);
