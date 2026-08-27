/*
 * 统一消息前端客户端。
 * 仅访问 V3 的 /api/messages 接口；服务端依据登录态确定数据范围，前端不传递用户、渠道或区域过滤条件。
 */
(function () {
  'use strict';

  function readStoredToken() {
    const directKeys = ['admin_auth_token', 'partner_auth_token'];
    for (const key of directKeys) {
      const token = localStorage.getItem(key);
      if (token) return token;
    }
    for (const key of ['admin_mobile_api_user', 'partner_mobile_api_user']) {
      try {
        const session = JSON.parse(localStorage.getItem(key) || 'null');
        if (session?.token) return session.token;
      } catch (error) {
        console.warn('读取统一消息登录态失败：', error);
      }
    }
    return '';
  }

  function readError(result, fallback) {
    const value = result?.error || result?.message || result?.msg;
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  function normalizeNotification(item) {
    const source = item || {};
    return {
      id: String(source.id || ''),
      title: source.title || '系统通知',
      body: source.body || source.content || source.desc || '',
      categoryCode: source.categoryCode || source.category_code || 'system',
      priorityCode: source.priorityCode || source.priority_code || 'normal',
      statusCode: source.statusCode || source.status_code || (source.unread === false ? 'read' : 'unread'),
      aggregateType: source.aggregateType || source.aggregate_type || '',
      aggregateId: source.aggregateId || source.aggregate_id || '',
      targetAction: source.targetAction || source.target_action || '',
      createdAt: source.createdAt || source.created_at || source.time || '',
      expiresAt: source.expiresAt || source.expires_at || ''
    };
  }

  function normalizeList(result) {
    const data = result?.data ?? result ?? {};
    const rawItems = Array.isArray(data) ? data : (data.items || data.notifications || []);
    return {
      items: rawItems.map(normalizeNotification),
      nextCursor: data.nextCursor || data.next_cursor || '',
      hasMore: Boolean(data.hasMore || data.has_more || data.nextCursor || data.next_cursor)
    };
  }

  async function request(path, options) {
    const requestOptions = options || {};
    const headers = { Accept: 'application/json', ...(requestOptions.headers || {}) };
    const token = requestOptions.token || readStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (requestOptions.body !== undefined) headers['Content-Type'] = 'application/json';

    let response;
    try {
      response = await fetch(`/api/messages${path}`, {
        method: requestOptions.method || 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers,
        body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body)
      });
    } catch (error) {
      throw new Error('消息服务暂时不可用，请稍后重试。');
    }

    let result = {};
    try {
      result = await response.json();
    } catch (error) {
      throw new Error('消息服务响应异常，请稍后重试。');
    }
    if (!response.ok || result?.success === false) {
      throw new Error(readError(result, response.status === 401 ? '登录状态已失效，请重新登录。' : '消息服务暂时不可用，请稍后重试。'));
    }
    return result;
  }

  function createClient(options) {
    const clientOptions = options || {};
    const withToken = (requestOptions) => ({ ...requestOptions, token: clientOptions.getToken?.() || '' });
    return {
      async list(query) {
        const params = new URLSearchParams();
        const options = query || {};
        if (options.category) params.set('category', options.category);
        if (options.status) params.set('status', options.status);
        if (options.cursor) params.set('cursor', options.cursor);
        params.set('limit', String(Math.min(Math.max(Number(options.limit) || 20, 1), 100)));
        const result = await request(`/notifications?${params.toString()}`, withToken({ method: 'GET' }));
        return normalizeList(result);
      },
      async unreadCount() {
        const result = await request('/notifications/unread-count', withToken({ method: 'GET' }));
        const data = result?.data ?? result ?? {};
        return Math.max(0, Number(data.count ?? data.unreadCount ?? data.unread_count ?? 0) || 0);
      },
      async markRead(id) {
        if (!id) return;
        await request(`/notifications/${encodeURIComponent(id)}/read`, withToken({ method: 'PUT' }));
      },
      async markAllRead() {
        await request('/notifications/read-all', withToken({ method: 'PUT' }));
      }
    };
  }

  /* 业务目标只允许映射到当前正式页面的受控内部路由，拒绝服务端下发任意地址。 */
  function resolveTarget(notification, context) {
    const item = normalizeNotification(notification);
    const type = String(item.aggregateType || '').toLowerCase();
    const id = encodeURIComponent(item.aggregateId || '');
    const isMobile = context?.device === 'mobile';
    const isPartner = context?.scope === 'partner';
    if (!id || !['view', 'process', 'approve'].includes(item.targetAction)) return '';
    const desktopTargets = {
      registration: '/registration', customer_registration: '/registration',
      opportunity: '/opportunity', quote: '/quote', order: '/order'
    };
    if (!desktopTargets[type]) return '';
    if (!isMobile) return desktopTargets[type];
    if (isPartner) {
      const partnerTargets = {
        registration: `/partner/registrations/${id}`, customer_registration: `/partner/registrations/${id}`,
        opportunity: `/partner/opportunities/${id}`, quote: `/partner/quotes/${id}`, order: `/partner/orders/${id}`
      };
      return partnerTargets[type] || '';
    }
    if (type === 'registration' || type === 'customer_registration') return '/admin/reviews';
    return `/admin/business/${type}/${id}`;
  }

  window.createMessageClient = createClient;
  window.resolveMessageTarget = resolveTarget;
})();
