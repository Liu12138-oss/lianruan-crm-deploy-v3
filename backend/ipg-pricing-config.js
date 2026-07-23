const IPG_CALCULATION_VERSION = 'IPG-V4-2025-REFERENCE';

const PRICE_BANDS = [
  { min: 0, max: 19, label: '<20', ordinary: 75, encryptionSystem: 20000, encryption: 1800, readOnly: 650, sensitive: 1800, secureDesktop: 1800 },
  { min: 20, max: 49, label: '20~49', ordinary: 70, encryptionSystem: 20000, encryption: 1600, readOnly: 600, sensitive: 1600, secureDesktop: 1600 },
  { min: 50, max: 99, label: '50~99', ordinary: 65, encryptionSystem: 20000, encryption: 1500, readOnly: 550, sensitive: 1500, secureDesktop: 1500 },
  { min: 100, max: 199, label: '100~199', ordinary: 60, encryptionSystem: 20000, encryption: 1300, readOnly: 500, sensitive: 1300, secureDesktop: 1300 },
  { min: 200, max: 499, label: '200~499', ordinary: 55, encryptionSystem: 20000, encryption: 1100, readOnly: 450, sensitive: 1100, secureDesktop: 1100 },
  { min: 500, max: 999, label: '500~999', ordinary: 55, encryptionSystem: 20000, encryption: 900, readOnly: 450, sensitive: 900, secureDesktop: 900 },
  { min: 1000, max: Infinity, label: '>=1000', ordinary: 50, encryptionSystem: 20000, encryption: 800, readOnly: 400, sensitive: 800, secureDesktop: 800 }
];

const ORDINARY_MODULES = {
  basic: '基本功能',
  documentOperation: '文档操作管控',
  printControl: '打印管控',
  deviceControl: '设备管控',
  mobileStorage: '移动存储管控',
  webControl: '网页浏览管控',
  mailControl: '邮件管控',
  imControl: '即时通讯管控',
  networkTraffic: '网络流量管控',
  networkControl: '网络控制',
  appControl: '应用程序管控',
  screenMonitor: '屏幕监控/屏幕监视',
  cloudBackup: '文档云备份',
  assetManagement: '资产管理',
  remoteMaintenance: '远程维护',
  softwareCenter: '软件中心',
  watermarkTrace: '水印及文档追溯'
};

const FEATURE_MATCHERS = {
  desktopManagement: {
    ids: ['FEAT-MOD-LEP-01-01'],
    nameIncludes: ['桌面管理模块']
  },
  securityManagement: {
    ids: ['FEAT-MOD-LEP-01-02'],
    nameIncludes: ['安全管理模块']
  },
  unauthorizedConnection: {
    ids: ['FEAT-MOD-LEP-01-03'],
    nameIncludes: ['非授权外连控制模块']
  },
  softwareManagement: {
    ids: ['FEAT-MOD-LEP-01-04'],
    nameIncludes: ['软件管理模块']
  },
  appStore: {
    ids: ['FEAT-MOD-LEP-01-05'],
    nameIncludes: ['软件商城模块']
  },
  cloudSoftwareDownload: {
    ids: ['FEAT-MOD-LEP-01-06'],
    nameIncludes: ['云端软件安全下载服务']
  },
  patchManagement: {
    ids: ['FEAT-MOD-LEP-01-07'],
    nameIncludes: ['补丁管理模块']
  },
  topologyDiscovery: {
    ids: ['FEAT-MOD-LEP-01-08'],
    nameIncludes: ['设备发现模块']
  },
  documentControl: {
    ids: ['FEAT-MOD-LEP-01-09'],
    nameIncludes: ['文件读写操作行为审计与控制模块']
  },
  printAudit: {
    ids: ['FEAT-MOD-LEP-01-10'],
    nameIncludes: ['打印审计与控制模块']
  },
  networkAudit: {
    ids: ['FEAT-MOD-LEP-01-11'],
    nameIncludes: ['网络行为审计与控制模块']
  },
  imControl: {
    ids: ['FEAT-MOD-LEP-01-12'],
    nameIncludes: ['即时通讯管控模块']
  },
  emailControl: {
    ids: ['FEAT-MOD-LEP-01-13'],
    nameIncludes: ['邮件管控模块']
  },
  screenWatermark: {
    ids: ['FEAT-MOD-LEP-01-14'],
    nameIncludes: ['屏幕水印与控制模块']
  },
  screenRecording: {
    ids: ['FEAT-MOD-LEP-01-15'],
    nameIncludes: ['屏幕录像模块']
  },
  usbStorage: {
    ids: ['FEAT-MOD-LEP-01-16'],
    nameIncludes: ['USB移动存储管理模块']
  },
  secureUsb: {
    ids: ['FEAT-MOD-LEP-01-17'],
    nameIncludes: ['安全U盘模块']
  },
  documentWatermark: {
    ids: ['FEAT-1779254954043'],
    nameIncludes: ['文档水印模块']
  },
  sensitiveContent: {
    ids: ['FEAT-MOD-LEP-02-01'],
    nameIncludes: ['敏感内容识别模块']
  },
  transparentEncryption: {
    ids: ['FEAT-MOD-LEP-02-02'],
    nameIncludes: ['透明加解密客户端']
  },
  virtualDiskEncryption: {
    ids: ['FEAT-MOD-LEP-02-03'],
    nameIncludes: ['虚拟磁盘隐身加密系统客户端']
  },
  antivirus: {
    ids: ['FEAT-MOD-LEP-03-01'],
    nameIncludes: ['防病毒模块']
  },
  ransomwareProtection: {
    ids: ['FEAT-MOD-LEP-03-02'],
    nameIncludes: ['文档防勒索模块']
  },
  networkAccessControl: {
    ids: ['FEAT-MOD-LEP-04-01'],
    nameIncludes: ['网络准入控制模块']
  },
  visitorManagement: {
    ids: ['FEAT-MOD-LEP-04-02'],
    nameIncludes: ['访客管理模块']
  }
};

const ACCESS_GATEWAY_PRICES = {
  'IPG-1700F': 9000,
  'IPG-2500F': 19000,
  'IPG-3300F': 30000,
  'IPG-3500F': 35000,
  'IPG-4300F': 65000,
  'IPG-4500F': 90000
};

const SECURITY_USB_PRICES = {
  '16G': 540,
  '32G': 690,
  '64G': 980,
  '128G': 1280
};

module.exports = {
  IPG_CALCULATION_VERSION,
  PRICE_BANDS,
  ORDINARY_MODULES,
  FEATURE_MATCHERS,
  ACCESS_GATEWAY_PRICES,
  SECURITY_USB_PRICES
};
