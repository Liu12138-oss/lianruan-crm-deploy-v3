type IPG功能项 = {
  id: string;
  name: string;
  productCode?: string;
};

type IPG价格带 = {
  min: number;
  max: number;
  label: string;
  ordinary: number;
  encryptionSystem: number;
  encryption: number;
  readOnly: number;
  sensitive: number;
  secureDesktop: number;
};

type IPG匹配器 = {
  ids: string[];
  nameIncludes: string[];
};

const IPG计算版本 = "IPG-V4-2025-REFERENCE";

const IPG价格带列表: IPG价格带[] = [
  {
    min: 0,
    max: 19,
    label: "<20",
    ordinary: 75,
    encryptionSystem: 20000,
    encryption: 1800,
    readOnly: 650,
    sensitive: 1800,
    secureDesktop: 1800,
  },
  {
    min: 20,
    max: 49,
    label: "20~49",
    ordinary: 70,
    encryptionSystem: 20000,
    encryption: 1600,
    readOnly: 600,
    sensitive: 1600,
    secureDesktop: 1600,
  },
  {
    min: 50,
    max: 99,
    label: "50~99",
    ordinary: 65,
    encryptionSystem: 20000,
    encryption: 1500,
    readOnly: 550,
    sensitive: 1500,
    secureDesktop: 1500,
  },
  {
    min: 100,
    max: 199,
    label: "100~199",
    ordinary: 60,
    encryptionSystem: 20000,
    encryption: 1300,
    readOnly: 500,
    sensitive: 1300,
    secureDesktop: 1300,
  },
  {
    min: 200,
    max: 499,
    label: "200~499",
    ordinary: 55,
    encryptionSystem: 20000,
    encryption: 1100,
    readOnly: 450,
    sensitive: 1100,
    secureDesktop: 1100,
  },
  {
    min: 500,
    max: 999,
    label: "500~999",
    ordinary: 55,
    encryptionSystem: 20000,
    encryption: 900,
    readOnly: 450,
    sensitive: 900,
    secureDesktop: 900,
  },
  {
    min: 1000,
    max: Number.POSITIVE_INFINITY,
    label: ">=1000",
    ordinary: 50,
    encryptionSystem: 20000,
    encryption: 800,
    readOnly: 400,
    sensitive: 800,
    secureDesktop: 800,
  },
];

const IPG普通模块: Record<string, string> = {
  basic: "基本功能",
  documentOperation: "文档操作管控",
  printControl: "打印管控",
  deviceControl: "设备管控",
  mobileStorage: "移动存储管控",
  webControl: "网页浏览管控",
  mailControl: "邮件管控",
  imControl: "即时通讯管控",
  networkTraffic: "网络流量管控",
  networkControl: "网络控制",
  appControl: "应用程序管控",
  screenMonitor: "屏幕监控/屏幕监视",
  cloudBackup: "文档云备份",
  assetManagement: "资产管理",
  remoteMaintenance: "远程维护",
  softwareCenter: "软件中心",
  watermarkTrace: "水印及文档追溯",
};

const IPG功能匹配: Record<string, IPG匹配器> = {
  desktopManagement: { ids: ["FEAT-MOD-LEP-01-01"], nameIncludes: ["桌面管理模块"] },
  securityManagement: { ids: ["FEAT-MOD-LEP-01-02"], nameIncludes: ["安全管理模块"] },
  unauthorizedConnection: { ids: ["FEAT-MOD-LEP-01-03"], nameIncludes: ["非授权外连控制模块"] },
  softwareManagement: { ids: ["FEAT-MOD-LEP-01-04"], nameIncludes: ["软件管理模块"] },
  appStore: { ids: ["FEAT-MOD-LEP-01-05"], nameIncludes: ["软件商城模块"] },
  cloudSoftwareDownload: { ids: ["FEAT-MOD-LEP-01-06"], nameIncludes: ["云端软件安全下载服务"] },
  patchManagement: { ids: ["FEAT-MOD-LEP-01-07"], nameIncludes: ["补丁管理模块"] },
  topologyDiscovery: { ids: ["FEAT-MOD-LEP-01-08"], nameIncludes: ["设备发现模块"] },
  documentControl: {
    ids: ["FEAT-MOD-LEP-01-09"],
    nameIncludes: ["文件读写操作行为审计与控制模块"],
  },
  printAudit: { ids: ["FEAT-MOD-LEP-01-10"], nameIncludes: ["打印审计与控制模块"] },
  networkAudit: { ids: ["FEAT-MOD-LEP-01-11"], nameIncludes: ["网络行为审计与控制模块"] },
  imControl: { ids: ["FEAT-MOD-LEP-01-12"], nameIncludes: ["即时通讯管控模块"] },
  emailControl: { ids: ["FEAT-MOD-LEP-01-13"], nameIncludes: ["邮件管控模块"] },
  screenWatermark: { ids: ["FEAT-MOD-LEP-01-14"], nameIncludes: ["屏幕水印与控制模块"] },
  screenRecording: { ids: ["FEAT-MOD-LEP-01-15"], nameIncludes: ["屏幕录像模块"] },
  usbStorage: { ids: ["FEAT-MOD-LEP-01-16"], nameIncludes: ["USB移动存储管理模块"] },
  secureUsb: { ids: ["FEAT-MOD-LEP-01-17"], nameIncludes: ["安全U盘模块"] },
  documentWatermark: { ids: ["FEAT-1779254954043"], nameIncludes: ["文档水印模块"] },
  sensitiveContent: { ids: ["FEAT-MOD-LEP-02-01"], nameIncludes: ["敏感内容识别模块"] },
  transparentEncryption: { ids: ["FEAT-MOD-LEP-02-02"], nameIncludes: ["透明加解密客户端"] },
  virtualDiskEncryption: {
    ids: ["FEAT-MOD-LEP-02-03"],
    nameIncludes: ["虚拟磁盘隐身加密系统客户端"],
  },
  antivirus: { ids: ["FEAT-MOD-LEP-03-01"], nameIncludes: ["防病毒模块"] },
  ransomwareProtection: { ids: ["FEAT-MOD-LEP-03-02"], nameIncludes: ["文档防勒索模块"] },
  networkAccessControl: { ids: ["FEAT-MOD-LEP-04-01"], nameIncludes: ["网络准入控制模块"] },
  visitorManagement: { ids: ["FEAT-MOD-LEP-04-02"], nameIncludes: ["访客管理模块"] },
};

const IPG准入网关价格: Record<string, number> = {
  "IPG-1700F": 9000,
  "IPG-2500F": 19000,
  "IPG-3300F": 30000,
  "IPG-3500F": 35000,
  "IPG-4300F": 65000,
  "IPG-4500F": 90000,
};

const IPG安全U盘价格: Record<string, number> = {
  "16G": 540,
  "32G": 690,
  "64G": 980,
  "128G": 1280,
};

function 转有限数字(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function 金额取整(value: unknown): number {
  return Math.round(转有限数字(value, 0) * 100) / 100;
}

function 读取文本(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function 转功能项(value: unknown): IPG功能项 {
  if (typeof value === "string") return { id: value, name: value };
  if (!value || typeof value !== "object" || Array.isArray(value)) return { id: "", name: "" };
  const record = value as Record<string, unknown>;
  return {
    id: 读取文本(record.id),
    name: 读取文本(record.name) || 读取文本(record.title) || 读取文本(record.productCode),
    productCode: 读取文本(record.productCode),
  };
}

function 读取数组(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function 功能命中(feature: IPG功能项, matcher: IPG匹配器 | undefined): boolean {
  if (!matcher) return false;
  const id = String(feature.id || "").trim();
  const name = String(feature.name || "").trim();
  if (id && matcher.ids.includes(id)) return true;
  return matcher.nameIncludes.some((keyword) => keyword && name.includes(keyword));
}

function 是否包含功能(features: IPG功能项[], matcherKey: string): boolean {
  return features.some((feature) => 功能命中(feature, IPG功能匹配[matcherKey]));
}

function 读取价格带(endpoints: number): IPG价格带 {
  return (
    IPG价格带列表.find((band) => endpoints >= band.min && endpoints <= band.max) ||
    IPG价格带列表[IPG价格带列表.length - 1]!
  );
}

function 加说明(notes: string[], note: string): void {
  if (note && !notes.includes(note)) notes.push(note);
}

function 加普通模块(modules: Map<string, string>, key: string): void {
  const label = IPG普通模块[key];
  if (label) modules.set(key, label);
}

function 格式化百分比(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${(Math.abs(value) * 100).toFixed(2)}%`;
}

function 构建差额说明(difference: number, differenceRatio: number | null): string {
  if (differenceRatio === null || !Number.isFinite(differenceRatio)) {
    return "联软总价为0，暂不计算差额比例";
  }
  if (difference > 0) return `IPG参考总价高于联软总价 ${格式化百分比(differenceRatio)}`;
  if (difference < 0) return `IPG参考总价低于联软总价 ${格式化百分比(differenceRatio)}`;
  return "IPG参考总价与联软总价持平";
}

function 读取项目参数(input: Record<string, unknown>): Record<string, unknown> {
  const value = input.projectParams;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function 计算IPG参考价(input: Record<string, unknown> = {}): Record<string, unknown> {
  const rawFeatures = 读取数组(input.features).length
    ? 读取数组(input.features)
    : 读取数组(input.featureIds).length
      ? 读取数组(input.featureIds)
      : 读取数组(input.products);
  const features = rawFeatures.map(转功能项).filter((feature) => feature.id || feature.name);
  const projectParams = 读取项目参数(input);
  const notes: string[] = [];
  const ordinaryModules = new Map<string, string>();

  const endpointCount = Math.max(0, Math.floor(转有限数字(input.endpoints, 0)));
  const billableEndpoints = endpointCount > 0 ? Math.max(endpointCount, 10) : 0;
  const band = 读取价格带(billableEndpoints || 10);

  const selected = {
    desktopManagement: 是否包含功能(features, "desktopManagement"),
    securityManagement: 是否包含功能(features, "securityManagement"),
    unauthorizedConnection: 是否包含功能(features, "unauthorizedConnection"),
    softwareManagement: 是否包含功能(features, "softwareManagement"),
    appStore: 是否包含功能(features, "appStore"),
    cloudSoftwareDownload: 是否包含功能(features, "cloudSoftwareDownload"),
    patchManagement: 是否包含功能(features, "patchManagement"),
    topologyDiscovery: 是否包含功能(features, "topologyDiscovery"),
    documentControl: 是否包含功能(features, "documentControl"),
    printAudit: 是否包含功能(features, "printAudit"),
    networkAudit: 是否包含功能(features, "networkAudit"),
    imControl: 是否包含功能(features, "imControl"),
    emailControl: 是否包含功能(features, "emailControl"),
    screenWatermark: 是否包含功能(features, "screenWatermark"),
    screenRecording: 是否包含功能(features, "screenRecording"),
    usbStorage: 是否包含功能(features, "usbStorage"),
    secureUsb: 是否包含功能(features, "secureUsb"),
    documentWatermark: 是否包含功能(features, "documentWatermark"),
    sensitiveContent: 是否包含功能(features, "sensitiveContent"),
    transparentEncryption: 是否包含功能(features, "transparentEncryption"),
    virtualDiskEncryption: 是否包含功能(features, "virtualDiskEncryption"),
    antivirus: 是否包含功能(features, "antivirus"),
    ransomwareProtection: 是否包含功能(features, "ransomwareProtection"),
    networkAccessControl: 是否包含功能(features, "networkAccessControl"),
    visitorManagement: 是否包含功能(features, "visitorManagement"),
  };

  if (selected.desktopManagement || selected.securityManagement)
    加普通模块(ordinaryModules, "basic");
  if (selected.documentControl) 加普通模块(ordinaryModules, "documentOperation");
  if (selected.printAudit) 加普通模块(ordinaryModules, "printControl");
  if (selected.unauthorizedConnection || selected.usbStorage)
    加普通模块(ordinaryModules, "deviceControl");
  if (selected.usbStorage || selected.secureUsb) 加普通模块(ordinaryModules, "mobileStorage");
  if (selected.networkAudit) 加普通模块(ordinaryModules, "webControl");
  if (selected.emailControl) 加普通模块(ordinaryModules, "mailControl");
  if (selected.imControl) 加普通模块(ordinaryModules, "imControl");
  if (selected.securityManagement) {
    加普通模块(ordinaryModules, "networkTraffic");
    加普通模块(ordinaryModules, "networkControl");
  }
  if (selected.softwareManagement) 加普通模块(ordinaryModules, "appControl");
  if (selected.screenRecording) 加普通模块(ordinaryModules, "screenMonitor");
  if (selected.ransomwareProtection) 加普通模块(ordinaryModules, "cloudBackup");
  if (selected.desktopManagement) {
    加普通模块(ordinaryModules, "assetManagement");
    加普通模块(ordinaryModules, "remoteMaintenance");
  }
  if (selected.appStore) 加普通模块(ordinaryModules, "softwareCenter");
  if (selected.screenWatermark || selected.documentWatermark)
    加普通模块(ordinaryModules, "watermarkTrace");

  if (selected.cloudSoftwareDownload && !selected.appStore) {
    加说明(
      notes,
      "云端软件安全下载服务单独勾选时按系统口径不对应处理，仅提示差异，不计入IPG总价。",
    );
  }
  if (selected.patchManagement) 加说明(notes, "补丁管理模块按系统口径不对应处理，不计入IPG总价。");
  if (selected.topologyDiscovery)
    加说明(notes, "设备发现模块按系统口径不对应处理，不计入IPG总价。");
  if (selected.antivirus) 加说明(notes, "防病毒模块在本次IPG口径中不对应，不计入IPG总价。");
  if (selected.virtualDiskEncryption)
    加说明(notes, "虚拟磁盘隐身加密系统客户端按系统口径不对应处理，不计入IPG总价。");
  if (selected.visitorManagement)
    加说明(notes, "访客管理模块按系统口径不对应处理，仅提示差异，不计入IPG总价。");

  if (ordinaryModules.size > 0 && !ordinaryModules.has("basic")) {
    加普通模块(ordinaryModules, "basic");
    加说明(notes, "IPG普通模块按基本功能必选口径估算，已自动纳入基本功能。");
  }

  const actualOrdinaryCount = ordinaryModules.size;
  const billableOrdinaryCount = actualOrdinaryCount > 0 ? Math.max(actualOrdinaryCount, 3) : 0;
  if (actualOrdinaryCount > 0 && actualOrdinaryCount < 3) {
    加说明(notes, "IPG普通模块按至少3个模块起售规则估算。");
  }
  if (endpointCount > 0 && endpointCount < 10) {
    加说明(notes, "IPG按10点起售规则估算。");
  }

  let total = 0;
  if (billableOrdinaryCount > 0 && billableEndpoints > 0) {
    total += band.ordinary * billableOrdinaryCount * billableEndpoints;
  }

  if (selected.sensitiveContent && billableEndpoints > 0) {
    total += band.sensitive * billableEndpoints;
    加说明(notes, "敏感内容识别模块按IPG特殊模块口径纳入参考总价。");
  }

  if (selected.transparentEncryption && billableEndpoints > 0) {
    total += band.encryption * billableEndpoints;
    total += band.encryptionSystem;
    加说明(notes, "透明加解密客户端按IPG加密模块估算，不自动计算加密只读模块。");
  }

  if (selected.networkAccessControl) {
    const accessGatewayModel = 读取文本(projectParams.accessGatewayModel);
    if (projectParams.includeAccessGateway === true && IPG准入网关价格[accessGatewayModel]) {
      total += IPG准入网关价格[accessGatewayModel];
      加说明(notes, "网络准入控制已按项目参数纳入IPG准入网关参考价。");
    } else {
      加说明(
        notes,
        "网络准入控制映射到IPG准入网关/准入控制；未指定IPG网关型号，本次不自动加入硬件网关费用。",
      );
    }
  }

  if (selected.secureUsb) {
    const securityUsbQty = Math.max(0, Math.floor(转有限数字(projectParams.securityUsbQty, 0)));
    const securityUsbSpec = 读取文本(projectParams.securityUsbSpec) || "16G";
    if (securityUsbQty > 0 && IPG安全U盘价格[securityUsbSpec]) {
      total += IPG安全U盘价格[securityUsbSpec] * securityUsbQty;
      加说明(notes, "安全U盘已按项目参数纳入IPG安全U盘硬件参考价。");
    } else {
      加说明(
        notes,
        "安全U盘模块已参与移动存储管控映射；未指定IPG安全U盘数量，本次不自动加入U盘硬件费用。",
      );
    }
  }

  const ipgReferenceTotal = 金额取整(total);
  const lianruanTotal = 金额取整(input.lianruanTotal);
  const difference = 金额取整(ipgReferenceTotal - lianruanTotal);
  const differenceRatio = lianruanTotal > 0 ? difference / lianruanTotal : null;

  if (!features.length) 加说明(notes, "未读取到已勾选的联软模块，暂无法生成有效IPG参考价。");
  加说明(notes, "IPG为按模块映射自动估算的参考总价，最终以厂商正式报价为准。");

  return {
    ipgReferenceTotal,
    lianruanTotal,
    difference,
    differenceRatio,
    differenceRatioText: 格式化百分比(differenceRatio),
    differenceText: 构建差额说明(difference, differenceRatio),
    notes,
    calculationVersion: IPG计算版本,
  };
}
