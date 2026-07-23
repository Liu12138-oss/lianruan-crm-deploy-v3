/**
 * 渠道分销层级功能前端增强模块
 * 用于在现有前端代码中集成渠道分销层级功能
 * 
 * 功能包括：
 * 1. 分级报价显示（不同等级渠道商看到不同价格）
 * 2. 渠道分销层级管理界面
 * 3. 二级渠道商订单确认流程
 */

// ============================================
// 1. 分级报价工具函数
// ============================================

/**
 * 获取当前用户的渠道分销层级
 * @returns {string} 'primary' | 'secondary' | 'none'
 */
function getCurrentPartnerLevel() {
  // 从store中获取当前用户的渠道分销层级
  // store.user 对应后端返回的用户信息
  const user = window.store?.user || {};
  
  // 如果用户有 partnerId，查询渠道分销层级
  if (user.partnerId) {
    // 尝试从渠道商列表中获取分销层级信息
    const partners = window.store?.partners || [];
    const partner = partners.find(p => p.id === user.partnerId);
    return partner?.partnerLevel || 'none';
  }
  
  return 'none';
}

/**
 * 获取功能模块的价格（根据渠道分销层级）
 * @param {object} feat 功能模块对象
 * @param {number} endpoints 端点数量
 * @param {string} partnerLevel 渠道分销层级
 * @returns {number} 价格
 */
function getFeaturePriceByLevel(feat, endpoints, partnerLevel) {
  if (!feat) return 0;
  
  // 根据等级选择价格字段
  const priceField = partnerLevel === 'primary' ? 'priceForPrimary' : 
                     partnerLevel === 'secondary' ? 'priceForSecondary' : 
                     'priceForPrimary'; // 无层级使用一级价格
  
  // 固定价格
  if (feat.priceFixed !== undefined && feat.priceFixed !== null) {
    // 如果有分级价格，使用分级价格
    if (feat[priceField] !== undefined && feat[priceField] !== null) {
      return typeof feat[priceField] === 'number' ? feat[priceField] : feat.priceFixed;
    }
    return feat.priceFixed * (feat.discount || 1);
  }
  
  // 阶梯价格
  if (feat.tiers && feat.tiers.length) {
    // 如果有分级阶梯价格
    const tiers = feat[priceField] || feat.tiers;
    if (Array.isArray(tiers)) {
      const tier = tiers.find(t => endpoints >= t.min && endpoints <= t.max) || 
                   tiers.find(t => endpoints >= t.min) || 
                   tiers[tiers.length - 1];
      if (tier) {
        return tier.price || 0;
      }
    }
    // 降级使用原始 tiers
    const tier = feat.tiers.find(t => endpoints >= t.min && endpoints <= t.max) || 
                 feat.tiers.find(t => endpoints >= t.min) || 
                 feat.tiers[feat.tiers.length - 1];
    return tier ? (tier.price || 0) : 0;
  }
  
  // 单价
  if (feat.unitPrice) {
    return feat.unitPrice;
  }
  
  return 0;
}

/**
 * 计算功能模块总价（根据渠道分销层级）
 * @param {array} features 功能模块列表
 * @param {number} endpoints 端点数量
 * @returns {number} 总价
 */
function calcFeatureTotalByLevel(features, endpoints) {
  if (!features || !features.length) return 0;
  
  const partnerLevel = getCurrentPartnerLevel();
  let total = 0;
  
  features.forEach(feat => {
    const unitPrice = getFeaturePriceByLevel(feat, endpoints, partnerLevel);
    
    // 固定价格：直接使用
    if (feat.priceFixed !== undefined && feat.priceFixed !== null) {
      total += unitPrice * (feat.discount || 1);
    }
    // 阶梯价格：单价 × 数量
    else if (feat.tiers && feat.tiers.length) {
      total += unitPrice * endpoints;
    }
    // 单价：单价 × 数量
    else {
      total += unitPrice * endpoints;
    }
  });
  
  return Math.round(total);
}

/**
 * 获取单个功能模块价格（根据渠道分销层级，用于显示）
 * @param {object} feat 功能模块对象
 * @param {number} endpoints 端点数量
 * @returns {number} 价格
 */
function getFeaturePriceForDisplay(feat, endpoints) {
  const partnerLevel = getCurrentPartnerLevel();
  return getFeaturePriceByLevel(feat, endpoints, partnerLevel);
}

// ============================================
// 2. 渠道分销层级标签显示
// ============================================

/**
 * 渠道分销层级配置
 */
const PARTNER_LEVEL_CONFIG = {
  primary: {
    label: '一级渠道商',
    color: '#1677ff',
    icon: '⭐',
    desc: '一级渠道商可发展二级渠道商，享受最优价格'
  },
  secondary: {
    label: '二级渠道商',
    color: '#52c41a',
    icon: '🌟',
    desc: '二级渠道商由一级渠道商发展，价格上浮10%'
  },
  none: {
    label: '无层级',
    color: '#8c8c8c',
    icon: '○',
    desc: '普通渠道商，未设置分销层级'
  }
};

/**
 * 获取渠道分销层级标签
 * @param {string} level 等级
 * @returns {object} {label, color, icon, desc}
 */
function getPartnerLevelTag(level) {
  return PARTNER_LEVEL_CONFIG[level] || PARTNER_LEVEL_CONFIG.none;
}

/**
 * 获取渠道分销层级HTML标签
 * @param {string} level 等级
 * @returns {string} HTML标签字符串
 */
function getPartnerLevelBadge(level) {
  const config = getPartnerLevelTag(level);
  const tagClass = level === 'primary' ? 'tag-blue' : 
                   level === 'secondary' ? 'tag-green' : 'tag-gray';
  return `<span class="tag ${tagClass}" title="${config.desc}">${config.icon} ${config.label}</span>`;
}

// ============================================
// 3. 渠道分销层级管理组件（用于admin-app.js）
// ============================================

/**
 * 渠道分销层级管理模板
 * 在 Partners 组件的详情弹窗中添加
 */
const PARTNER_LEVEL_MANAGE_TEMPLATE = `
<!-- 渠道分销层级管理 -->
<div style="background:#f8f9fa;padding:16px;border-radius:10px;margin-bottom:16px">
  <div style="font-size:12px;font-weight:700;color:#333;margin-bottom:12px;display:flex;align-items:center;gap:6px">
    <span>🏅</span> 渠道分销层级
  </div>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
    <span v-html="getPartnerLevelBadge(detail.partnerLevel)"></span>
    <span style="font-size:12px;color:#666">{{ getPartnerLevelDesc(detail.partnerLevel) }}</span>
  </div>
  <div v-if="detail.parentPartnerName" style="margin-bottom:10px">
    <div style="font-size:11px;color:#888;margin-bottom:2px">上级渠道商</div>
    <div style="font-size:13px;color:#1677ff;cursor:pointer" @click="viewPartner(detail.parentPartnerId)">
      {{ detail.parentPartnerName }}
    </div>
  </div>
  <div v-if="detail.partnerLevelSetBy && detail.partnerLevelSetAt" style="font-size:11px;color:#999">
    设置时间：{{ detail.partnerLevelSetAt }}
  </div>
  <div style="margin-top:12px;display:flex;gap:8px">
    <button class="btn btn-sm" :class="detail.partnerLevel==='primary'?'btn-primary':'btn-default'" 
            @click="setPartnerLevel('primary')" :disabled="detail.partnerLevel==='primary'">
      ⭐ 设为一级
    </button>
    <button class="btn btn-sm" :class="detail.partnerLevel==='secondary'?'btn-success':'btn-default'" 
            @click="setPartnerLevel('secondary')" :disabled="detail.partnerLevel==='secondary'">
      🌟 设为二级
    </button>
    <button class="btn btn-sm" :class="detail.partnerLevel==='none'?'btn-default':'btn-default'" 
            @click="setPartnerLevel('none')" :disabled="detail.partnerLevel==='none'">
      ○ 取消层级
    </button>
  </div>
  <!-- 二级渠道商绑定 -->
  <div v-if="detail.partnerLevel==='secondary' && !detail.parentPartnerId" style="margin-top:12px">
    <div style="font-size:11px;color:#fa8c16;margin-bottom:8px">⚠️ 二级渠道商需要绑定上级一级渠道商</div>
    <select class="form-control" v-model="parentPartnerId" style="margin-bottom:8px">
      <option value="">选择上级渠道商</option>
      <option v-for="p in primaryPartners" :key="p.id" :value="p.id">
        {{ p.name }} ({{ p.region }})
      </option>
    </select>
    <button class="btn btn-primary btn-sm" @click="bindParentPartner" :disabled="!parentPartnerId">
      绑定上级渠道商
    </button>
  </div>
  <!-- 解绑功能 -->
  <div v-if="detail.partnerLevel==='secondary' && detail.parentPartnerId" style="margin-top:12px">
    <button class="btn btn-default btn-sm" @click="unbindParentPartner" style="color:#ff4d4f">
      解除绑定关系
    </button>
  </div>
</div>
`;

/**
 * 渠道分销层级管理方法（注入到 Partners 组件）
 */
const PARTNER_LEVEL_METHODS = {
  // 获取等级标签
  getPartnerLevelBadge(level) {
    const config = getPartnerLevelTag(level);
    const tagClass = level === 'primary' ? 'tag-blue' : 
                     level === 'secondary' ? 'tag-green' : 'tag-gray';
    return `<span class="tag ${tagClass}" title="${config.desc}">${config.icon} ${config.label}</span>`;
  },
  
  // 获取等级描述
  getPartnerLevelDesc(level) {
    const config = getPartnerLevelTag(level);
    return config.desc;
  },
  
  // 设置渠道分销层级
  async setPartnerLevel(level) {
    if (!this.detail) return;
    
    const levelName = level === 'primary' ? '一级渠道商' : 
                      level === 'secondary' ? '二级渠道商' : '无层级';
    
    if (!confirm(`确定将「${this.detail.name}」设置为${levelName}吗？`)) {
      return;
    }
    
    try {
      const result = await apiRequest('PUT', `/partners/${this.detail.id}/level`, {
        partnerLevel: level,
        operatedBy: this.userId,
        operatedByRole: this.userRole
      });
      
      if (result.success) {
        // 更新本地数据
        const idx = this.partners.findIndex(p => p.id === this.detail.id);
        if (idx !== -1) {
          this.partners[idx] = { ...this.partners[idx], ...result.data };
          this.detail = { ...this.detail, ...result.data };
        }
        alert('分销层级设置成功！');
      } else {
        alert('设置失败：' + (result.error || '未知错误'));
      }
    } catch (err) {
      console.error('设置渠道分销层级失败:', err);
      alert('设置失败，请检查网络连接');
    }
  },
  
  // 绑定上级渠道商
  async bindParentPartner() {
    if (!this.parentPartnerId || !this.detail) return;
    
    try {
      const result = await apiRequest('PUT', `/partners/${this.detail.id}/level`, {
        partnerLevel: 'secondary',
        parentPartnerId: this.parentPartnerId,
        operatedBy: this.userId,
        operatedByRole: this.userRole
      });
      
      if (result.success) {
        const idx = this.partners.findIndex(p => p.id === this.detail.id);
        if (idx !== -1) {
          this.partners[idx] = { ...this.partners[idx], ...result.data };
          this.detail = { ...this.detail, ...result.data };
        }
        alert('绑定成功！');
      } else {
        alert('绑定失败：' + (result.error || '未知错误'));
      }
    } catch (err) {
      console.error('绑定上级渠道商失败:', err);
      alert('绑定失败，请检查网络连接');
    }
  },
  
  // 解除绑定
  async unbindParentPartner() {
    if (!this.detail) return;
    
    if (!confirm('确定解除与上级渠道商的绑定关系吗？')) {
      return;
    }
    
    try {
      const result = await apiRequest('PUT', `/partners/${this.detail.id}/unbind`, {
        operatedBy: this.userId,
        operatedByRole: this.userRole
      });
      
      if (result.success) {
        const idx = this.partners.findIndex(p => p.id === this.detail.id);
        if (idx !== -1) {
          this.partners[idx] = { ...this.partners[idx], ...result.data };
          this.detail = { ...this.detail, ...result.data };
        }
        alert('解绑成功！');
      } else {
        alert('解绑失败：' + (result.error || '未知错误'));
      }
    } catch (err) {
      console.error('解绑失败:', err);
      alert('解绑失败，请检查网络连接');
    }
  },
  
  // 查看渠道商详情
  viewPartner(partnerId) {
    const partner = this.partners.find(p => p.id === partnerId);
    if (partner) {
      this.detail = partner;
    }
  }
};

// ============================================
// 4. 二级渠道商订单确认组件（用于partner-app.js）
// ============================================

/**
 * 二级渠道商订单确认模板
 * 在订单列表中添加确认按钮
 */
const SECONDARY_ORDER_CONFIRM_TEMPLATE = `
<!-- 二级渠道商订单确认（仅当订单状态为pending且当前用户是一级渠道商时显示） -->
<div v-if="order.partnerLevel === 'secondary' && order.status === 'pending' && isPrimaryPartner" 
     style="background:#fff7e6;border:1px solid #ffd591;border-radius:8px;padding:12px;margin:12px 0">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <span style="font-size:16px">⚠️</span>
    <span style="font-size:14px;font-weight:600;color:#ad6800">二级渠道商订单待确认</span>
  </div>
  <div style="font-size:12px;color:#666;margin-bottom:12px">
    此订单来自二级渠道商「{{ order.partnerName }}」，需要您确认后才能继续流转
  </div>
  <div style="display:flex;gap:8px">
    <button class="btn btn-primary btn-sm" @click="confirmSecondaryOrder(order)">
      ✅ 确认订单
    </button>
    <button class="btn btn-default btn-sm" @click="rejectSecondaryOrder(order)" style="color:#ff4d4f">
      ❌ 驳回订单
    </button>
  </div>
</div>
`;

/**
 * 二级渠道商订单确认方法
 */
const SECONDARY_ORDER_METHODS = {
  // 判断当前用户是否为一级渠道商
  isPrimaryPartner() {
    return getCurrentPartnerLevel() === 'primary';
  },
  
  // 确认二级渠道商订单
  async confirmSecondaryOrder(order) {
    if (!confirm('确认此订单吗？确认后将流转给区域管理员审批。')) {
      return;
    }
    
    try {
      const result = await apiRequest('PUT', `/orders/${order.id}/primary-confirm`, {
        operatorId: this.userId,
        operatorName: this.userName,
        remark: ''
      });
      
      if (result.success) {
        // 更新本地订单状态
        const idx = this.orders.findIndex(o => o.id === order.id);
        if (idx !== -1) {
          this.orders[idx] = { ...this.orders[idx], ...result.data };
        }
        alert('订单已确认，等待区域管理员审批');
      } else {
        alert('确认失败：' + (result.error || '未知错误'));
      }
    } catch (err) {
      console.error('确认订单失败:', err);
      alert('确认失败，请检查网络连接');
    }
  },
  
  // 驳回二级渠道商订单
  async rejectSecondaryOrder(order) {
    const remark = prompt('请输入驳回原因：');
    if (!remark) return;
    
    try {
      const result = await apiRequest('PUT', `/orders/${order.id}/primary-reject`, {
        operatorId: this.userId,
        operatorName: this.userName,
        remark: remark
      });
      
      if (result.success) {
        const idx = this.orders.findIndex(o => o.id === order.id);
        if (idx !== -1) {
          this.orders[idx] = { ...this.orders[idx], ...result.data };
        }
        alert('订单已驳回');
      } else {
        alert('驳回失败：' + (result.error || '未知错误'));
      }
    } catch (err) {
      console.error('驳回订单失败:', err);
      alert('驳回失败，请检查网络连接');
    }
  }
};

// ============================================
// 5. 导出模块
// ============================================

// 如果在浏览器环境，挂载到 window
if (typeof window !== 'undefined') {
  window.PartnerLevelModule = {
    // 工具函数
    getCurrentPartnerLevel,
    getFeaturePriceByLevel,
    calcFeatureTotalByLevel,
    getFeaturePriceForDisplay,
    getPartnerLevelTag,
    getPartnerLevelBadge,
    
    // 配置
    PARTNER_LEVEL_CONFIG,
    
    // 模板
    PARTNER_LEVEL_MANAGE_TEMPLATE,
    SECONDARY_ORDER_CONFIRM_TEMPLATE,
    
    // 方法
    PARTNER_LEVEL_METHODS,
    SECONDARY_ORDER_METHODS
  };
}

// 如果在 Node.js 环境，导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getCurrentPartnerLevel,
    getFeaturePriceByLevel,
    calcFeatureTotalByLevel,
    getFeaturePriceForDisplay,
    getPartnerLevelTag,
    getPartnerLevelBadge,
    PARTNER_LEVEL_CONFIG,
    PARTNER_LEVEL_MANAGE_TEMPLATE,
    SECONDARY_ORDER_CONFIRM_TEMPLATE,
    PARTNER_LEVEL_METHODS,
    SECONDARY_ORDER_METHODS
  };
}
