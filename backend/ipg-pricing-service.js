const {
  IPG_CALCULATION_VERSION,
  PRICE_BANDS,
  ORDINARY_MODULES,
  FEATURE_MATCHERS,
  ACCESS_GATEWAY_PRICES,
  SECURITY_USB_PRICES
} = require('./ipg-pricing-config');

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function roundMoney(value) {
  return Math.round(toFiniteNumber(value, 0) * 100) / 100;
}

function normalizeFeature(feature) {
  if (typeof feature === 'string') {
    return { id: feature, name: feature };
  }
  return {
    id: String(feature?.id || '').trim(),
    name: String(feature?.name || feature?.title || feature?.productCode || '').trim()
  };
}

function featureMatches(feature, matcher) {
  if (!matcher) return false;
  const id = String(feature.id || '').trim();
  const name = String(feature.name || '').trim();
  if (id && Array.isArray(matcher.ids) && matcher.ids.includes(id)) return true;
  return Array.isArray(matcher.nameIncludes)
    && matcher.nameIncludes.some(keyword => keyword && name.includes(keyword));
}

function hasFeature(features, matcherKey) {
  const matcher = FEATURE_MATCHERS[matcherKey];
  return features.some(feature => featureMatches(feature, matcher));
}

function getBand(endpoints) {
  return PRICE_BANDS.find(band => endpoints >= band.min && endpoints <= band.max) || PRICE_BANDS[PRICE_BANDS.length - 1];
}

function addUniqueNote(notes, note) {
  if (note && !notes.includes(note)) notes.push(note);
}

function addOrdinaryModule(modules, key) {
  if (ORDINARY_MODULES[key]) modules.set(key, ORDINARY_MODULES[key]);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '--';
  return `${(Math.abs(value) * 100).toFixed(2)}%`;
}

function buildDifferenceText(difference, differenceRatio) {
  if (!Number.isFinite(differenceRatio)) {
    return '联软总价为0，暂不计算差额比例';
  }
  if (difference > 0) {
    return `IPG参考总价高于联软总价 ${formatPercent(differenceRatio)}`;
  }
  if (difference < 0) {
    return `IPG参考总价低于联软总价 ${formatPercent(differenceRatio)}`;
  }
  return 'IPG参考总价与联软总价持平';
}

function calculateIpgQuotePreview(input = {}) {
  const rawFeatures = Array.isArray(input.features)
    ? input.features
    : Array.isArray(input.featureIds)
      ? input.featureIds
      : Array.isArray(input.products)
        ? input.products
        : [];
  const features = rawFeatures.map(normalizeFeature).filter(feature => feature.id || feature.name);
  const projectParams = input.projectParams || {};
  const notes = [];
  const ordinaryModules = new Map();

  const endpointCount = Math.max(0, Math.floor(toFiniteNumber(input.endpoints, 0)));
  const billableEndpoints = endpointCount > 0 ? Math.max(endpointCount, 10) : 0;
  const band = getBand(billableEndpoints || 10);

  const selected = {
    desktopManagement: hasFeature(features, 'desktopManagement'),
    securityManagement: hasFeature(features, 'securityManagement'),
    unauthorizedConnection: hasFeature(features, 'unauthorizedConnection'),
    softwareManagement: hasFeature(features, 'softwareManagement'),
    appStore: hasFeature(features, 'appStore'),
    cloudSoftwareDownload: hasFeature(features, 'cloudSoftwareDownload'),
    patchManagement: hasFeature(features, 'patchManagement'),
    topologyDiscovery: hasFeature(features, 'topologyDiscovery'),
    documentControl: hasFeature(features, 'documentControl'),
    printAudit: hasFeature(features, 'printAudit'),
    networkAudit: hasFeature(features, 'networkAudit'),
    imControl: hasFeature(features, 'imControl'),
    emailControl: hasFeature(features, 'emailControl'),
    screenWatermark: hasFeature(features, 'screenWatermark'),
    screenRecording: hasFeature(features, 'screenRecording'),
    usbStorage: hasFeature(features, 'usbStorage'),
    secureUsb: hasFeature(features, 'secureUsb'),
    documentWatermark: hasFeature(features, 'documentWatermark'),
    sensitiveContent: hasFeature(features, 'sensitiveContent'),
    transparentEncryption: hasFeature(features, 'transparentEncryption'),
    virtualDiskEncryption: hasFeature(features, 'virtualDiskEncryption'),
    antivirus: hasFeature(features, 'antivirus'),
    ransomwareProtection: hasFeature(features, 'ransomwareProtection'),
    networkAccessControl: hasFeature(features, 'networkAccessControl'),
    visitorManagement: hasFeature(features, 'visitorManagement')
  };

  if (selected.desktopManagement || selected.securityManagement) addOrdinaryModule(ordinaryModules, 'basic');
  if (selected.documentControl) addOrdinaryModule(ordinaryModules, 'documentOperation');
  if (selected.printAudit) addOrdinaryModule(ordinaryModules, 'printControl');
  if (selected.unauthorizedConnection || selected.usbStorage) addOrdinaryModule(ordinaryModules, 'deviceControl');
  if (selected.usbStorage || selected.secureUsb) addOrdinaryModule(ordinaryModules, 'mobileStorage');
  if (selected.networkAudit) addOrdinaryModule(ordinaryModules, 'webControl');
  if (selected.emailControl) addOrdinaryModule(ordinaryModules, 'mailControl');
  if (selected.imControl) addOrdinaryModule(ordinaryModules, 'imControl');
  if (selected.securityManagement) {
    addOrdinaryModule(ordinaryModules, 'networkTraffic');
    addOrdinaryModule(ordinaryModules, 'networkControl');
  }
  if (selected.softwareManagement) addOrdinaryModule(ordinaryModules, 'appControl');
  if (selected.screenRecording) addOrdinaryModule(ordinaryModules, 'screenMonitor');
  if (selected.ransomwareProtection) addOrdinaryModule(ordinaryModules, 'cloudBackup');
  if (selected.desktopManagement) {
    addOrdinaryModule(ordinaryModules, 'assetManagement');
    addOrdinaryModule(ordinaryModules, 'remoteMaintenance');
  }
  if (selected.appStore) addOrdinaryModule(ordinaryModules, 'softwareCenter');
  if (selected.screenWatermark || selected.documentWatermark) addOrdinaryModule(ordinaryModules, 'watermarkTrace');

  if (selected.cloudSoftwareDownload && !selected.appStore) {
    addUniqueNote(notes, '云端软件安全下载服务单独勾选时按系统口径不对应处理，仅提示差异，不计入IPG总价。');
  }
  if (selected.patchManagement) addUniqueNote(notes, '补丁管理模块按系统口径不对应处理，不计入IPG总价。');
  if (selected.topologyDiscovery) addUniqueNote(notes, '设备发现模块按系统口径不对应处理，不计入IPG总价。');
  if (selected.antivirus) addUniqueNote(notes, '防病毒模块在本次IPG口径中不对应，不计入IPG总价。');
  if (selected.virtualDiskEncryption) addUniqueNote(notes, '虚拟磁盘隐身加密系统客户端按系统口径不对应处理，不计入IPG总价。');
  if (selected.visitorManagement) addUniqueNote(notes, '访客管理模块按系统口径不对应处理，仅提示差异，不计入IPG总价。');

  if (ordinaryModules.size > 0 && !ordinaryModules.has('basic')) {
    addOrdinaryModule(ordinaryModules, 'basic');
    addUniqueNote(notes, 'IPG普通模块按基本功能必选口径估算，已自动纳入基本功能。');
  }

  const actualOrdinaryCount = ordinaryModules.size;
  const billableOrdinaryCount = actualOrdinaryCount > 0 ? Math.max(actualOrdinaryCount, 3) : 0;
  if (actualOrdinaryCount > 0 && actualOrdinaryCount < 3) {
    addUniqueNote(notes, 'IPG普通模块按至少3个模块起售规则估算。');
  }
  if (endpointCount > 0 && endpointCount < 10) {
    addUniqueNote(notes, 'IPG按10点起售规则估算。');
  }

  let total = 0;
  if (billableOrdinaryCount > 0 && billableEndpoints > 0) {
    total += band.ordinary * billableOrdinaryCount * billableEndpoints;
  }

  if (selected.sensitiveContent && billableEndpoints > 0) {
    total += band.sensitive * billableEndpoints;
    addUniqueNote(notes, '敏感内容识别模块按IPG特殊模块口径纳入参考总价。');
  }

  if (selected.transparentEncryption && billableEndpoints > 0) {
    total += band.encryption * billableEndpoints;
    total += band.encryptionSystem;
    addUniqueNote(notes, '透明加解密客户端按IPG加密模块估算，不自动计算加密只读模块。');
  }

  if (selected.networkAccessControl) {
    const accessGatewayModel = String(projectParams.accessGatewayModel || '').trim();
    if (projectParams.includeAccessGateway && ACCESS_GATEWAY_PRICES[accessGatewayModel]) {
      total += ACCESS_GATEWAY_PRICES[accessGatewayModel];
      addUniqueNote(notes, '网络准入控制已按项目参数纳入IPG准入网关参考价。');
    } else {
      addUniqueNote(notes, '网络准入控制映射到IPG准入网关/准入控制；未指定IPG网关型号，本次不自动加入硬件网关费用。');
    }
  }

  if (selected.secureUsb) {
    const securityUsbQty = Math.max(0, Math.floor(toFiniteNumber(projectParams.securityUsbQty, 0)));
    const securityUsbSpec = String(projectParams.securityUsbSpec || '16G').trim();
    if (securityUsbQty > 0 && SECURITY_USB_PRICES[securityUsbSpec]) {
      total += SECURITY_USB_PRICES[securityUsbSpec] * securityUsbQty;
      addUniqueNote(notes, '安全U盘已按项目参数纳入IPG安全U盘硬件参考价。');
    } else {
      addUniqueNote(notes, '安全U盘模块已参与移动存储管控映射；未指定IPG安全U盘数量，本次不自动加入U盘硬件费用。');
    }
  }

  const ipgReferenceTotal = roundMoney(total);
  const lianruanTotal = roundMoney(input.lianruanTotal);
  const difference = roundMoney(ipgReferenceTotal - lianruanTotal);
  const differenceRatio = lianruanTotal > 0 ? difference / lianruanTotal : null;

  if (!features.length) {
    addUniqueNote(notes, '未读取到已勾选的联软模块，暂无法生成有效IPG参考价。');
  }

  addUniqueNote(notes, 'IPG为按模块映射自动估算的参考总价，最终以厂商正式报价为准。');

  return {
    ipgReferenceTotal,
    lianruanTotal,
    difference,
    differenceRatio,
    differenceRatioText: Number.isFinite(differenceRatio) ? formatPercent(differenceRatio) : '--',
    differenceText: buildDifferenceText(difference, differenceRatio),
    notes,
    calculationVersion: IPG_CALCULATION_VERSION
  };
}

module.exports = {
  calculateIpgQuotePreview
};
