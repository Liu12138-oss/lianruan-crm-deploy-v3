/**
 * 联软渠道管理平台 - 后端服务
 * 内存缓存 + SQLite 持久化（WAL模式，原子写入，崩溃安全）
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const XLSX = require('xlsx');
const DbLayer = require('./db-layer');
const AuditDb = require('./audit-db');
const { searchCustomerLedger, normalizeCompanyName } = require('./customer-ledger');
const { calculateIpgQuotePreview } = require('./ipg-pricing-service');
const {
  PREFECTURE_LEVEL_CITIES,
  isPrefectureLevelCity,
  normalizePrefectureCity,
} = require('./prefecture-cities');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');   // 旧版兼容（迁移/备份用）
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'crm.db');
const AUDIT_DB_PATH = process.env.AUDIT_DB_PATH || path.join(__dirname, 'audit.db');

// 中间件
app.use((req, res, next) => {
  // 仅为二期接口补充安全响应头；不改变一期接口的跨域和缓存行为。
  if (isMobileV2RequestPath(req.path)) applyMobileV2SecurityHeaders(req, res);
  next();
});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  req.requestId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `req_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  next();
});
app.use((req, res, next) => {
  try {
    captureAuditBeforeSnapshot(req);
  } catch (err) {
    console.error('[audit] Failed to capture before snapshot:', err.message);
  }
  next();
});
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function patchedJson(body) {
    try {
      const options = req.auditLogged ? null : buildAutoAuditOptions(req, body, res);
      if (options && !req.auditLogged) {
        writeAuditLog(req, options);
      }
    } catch (err) {
      console.error('[audit] Failed to build auto audit log:', err.message);
    }
    return originalJson(body);
  };
  next();
});

// 文件上传配置
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB限制
});

// 内存数据存储
let db = {
  users: [
    { id: 'A001', username: 'admin', name: '联软科技超级管理员', role: 'superadmin', password: '123456', region: '', bigRegion: '', status: 'active' },
    { id: 'A002', username: 'admin_ah', name: '安徽区管理员', role: 'admin', password: '123456', region: '安徽区', bigRegion: '大东区', status: 'active' },
    { id: 'A003', username: 'admin_js', name: '江苏区管理员', role: 'admin', password: '123456', region: '江苏区', bigRegion: '大东区', status: 'active' },
    { id: 'S001', username: 'liujg', name: '刘建国', role: 'staff', password: '123456', partnerId: 'P001', partnerName: '北京安盾网络', region: '北区（政府企业）', status: 'active' },
    { id: 'S002', username: 'wangxh', name: '王小红', role: 'staff', password: '123456', partnerId: 'P002', partnerName: '上海锐行信息', region: '上海区（非金）', status: 'active' },
    { id: 'S003', username: 'zhaozq', name: '赵志强', role: 'staff', password: '123456', partnerId: 'P003', partnerName: '广州卓越安全', region: '广州区', status: 'active' },
  ],
  partners: [
    { 
      id: 'P001', 
      name: '北京安盾网络', 
      level: 'gold',
      partnerLevel: 'none', // 渠道分销层级: primary(一级)/secondary(二级)/none(无层级,默认)
      parentPartnerId: null, // 上级渠道商ID(仅二级渠道商有值)
      partnerLevelSetBy: null, // 等级设置人
      partnerLevelSetAt: null, // 等级设置时间
      region: '北区（政府企业）', 
      city: '北京市',
      bigRegion: '大北区', 
      contact: '张总', 
      phone: '13800138001', 
      email: 'zhang@andun.com', 
      status: 'active', 
      joinDate: '2024-01-15', 
      quoteCount: 5, 
      orderCount: 3, 
      totalAmt: 150000, 
      staff: [], 
      createdBy: 'A010', 
      createdByRole: 'admin' 
    },
    { 
      id: 'P002', 
      name: '上海锐行信息', 
      level: 'diamond',
      partnerLevel: 'none',
      parentPartnerId: null,
      partnerLevelSetBy: null,
      partnerLevelSetAt: null,
      region: '上海区（非金）', 
      city: '上海市',
      bigRegion: '大东区', 
      contact: '李总', 
      phone: '13800138002', 
      email: 'li@ruixing.com', 
      status: 'active', 
      joinDate: '2024-02-20', 
      quoteCount: 8, 
      orderCount: 5, 
      totalAmt: 280000, 
      staff: [], 
      createdBy: 'A004', 
      createdByRole: 'admin' 
    },
    { 
      id: 'P003', 
      name: '广州卓越安全', 
      level: 'silver',
      partnerLevel: 'none',
      parentPartnerId: null,
      partnerLevelSetBy: null,
      partnerLevelSetAt: null,
      region: '广州区', 
      city: '广州市',
      bigRegion: '大南区', 
      contact: '王总', 
      phone: '13800138003', 
      email: 'wang@zhuoyue.com', 
      status: 'active', 
      joinDate: '2024-03-10', 
      quoteCount: 3, 
      orderCount: 1, 
      totalAmt: 80000, 
      staff: [], 
      createdBy: 'A007', 
      createdByRole: 'admin' 
    },
  ],
  registrations: [],
  opportunities: [],
  notifications: [],
  quotes: [],
  orders: [],
  channelTargets: [],
  channelVisits: [],
  pendingApprovals: [], // 待审批列表(type: partner/staff/partner_admin/secondary_partner)
  // secondary_partner类型的pendingApproval包含:
  // - parentPartnerId: 一级渠道商ID(申请人)
  // - parentPartnerName: 一级渠道商名称
  // - region: 所属区域(必须与一级渠道商同区域)
  
  // ========================================
  // 新版三级产品架构
  // ========================================
  
  // 1. 产品大类（软件/硬件）
  categories: [
    {
      id: 'CAT-LEP',
      name: '联软ESPP企业安全监测保护平台软件V5.0',
      type: 'software',
      icon: '🛡️',
      sort: 1,
      status: 'active',
      desc: '联软ESPP企业安全监测保护平台软件V5.0',
      createdAt: '2026-04-12'
    }
  ],  // 2. 产品模块（属于大类）
  modules: [
    {
      id: 'MOD-LEP-01',
      categoryId: 'CAT-LEP',
      name: '桌面安全管理',
      icon: '🖥️',
      sort: 1,
      status: 'active',
      desc: '终端桌面安全管理模块套件',
      createdAt: '2026-04-12'
    },
    {
      id: 'MOD-LEP-02',
      categoryId: 'CAT-LEP',
      name: '防泄密',
      icon: '🔒',
      sort: 2,
      status: 'active',
      desc: '数据防泄密模块',
      createdAt: '2026-04-12'
    },
    {
      id: 'MOD-LEP-03',
      categoryId: 'CAT-LEP',
      name: '防勒索',
      icon: '🛡️',
      sort: 3,
      status: 'active',
      desc: '勒索病毒防护模块',
      createdAt: '2026-04-12'
    },
    {
      id: 'MOD-LEP-04',
      categoryId: 'CAT-LEP',
      name: '准入控制',
      icon: '🌐',
      sort: 4,
      status: 'active',
      desc: '网络准入控制模块',
      createdAt: '2026-04-12'
    }
  ],  // 3. 功能模块（属于产品模块）
  features: [
    {
      id: 'FEAT-MOD-LEP-01-01',
      moduleId: 'MOD-LEP-01',
      name: '桌面管理模块（含资产管理，远程桌面）',
      required: false,
      productCode: 'UA-AM-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 150}, {"min": 20, "max": 49, "price": 140}, {"min": 50, "max": 99, "price": 130}, {"min": 100, "max": 199, "price": 110}, {"min": 200, "max": 500, "price": 90}],
      discount: 0.2,
      unit: '端点',
      desc: '桌面管理许可，主要功能包括：\n1）终端资产信息收集与管理，包括：设备基本属性、设备配置信息、设备硬件信息、设备软件信息等；\n2）远程交互，包括：远程连接终端桌面交互、发布通知公告等；\n3）节能管理：节能及非工作时间开关机管理；\n4）对客户端进行统一管理、展示信息、策略配置。',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-01-02',
      moduleId: 'MOD-LEP-01',
      name: '安全管理模块',
      required: false,
      productCode: 'UA-SS-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 75}, {"min": 20, "max": 49, "price": 70}, {"min": 50, "max": 99, "price": 65}, {"min": 100, "max": 199, "price": 55}, {"min": 200, "max": 500, "price": 45}],
      discount: 0.2,
      unit: '端点',
      desc: '安全管理许可，主要功能包括：\n1）软件防火墙功能，对指定程序、网络地址范围、通讯方向、端口范围等设置访问权限；\n2）支持对终端流量进行统计；\n3）支持对网络连接和互联网连通进行检测与监听。',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-01-03',
      moduleId: 'MOD-LEP-01',
      name: '非授权外连控制模块',
      required: false,
      productCode: 'UA-DevCtrl-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 75}, {"min": 20, "max": 49, "price": 70}, {"min": 50, "max": 99, "price": 65}, {"min": 100, "max": 199, "price": 55}, {"min": 200, "max": 500, "price": 45}],
      discount: 0.2,
      unit: '端点',
      desc: '非授权外连控制模块客户端许可，主要功能包括：\n1）对计算机外联设备的使用进行审计和管控，包括：USB设备、蓝牙、光驱、串口、并口、1394接口等；\n2）支持禁用终端电脑共享WiFi热点。',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-01-04',
      moduleId: 'MOD-LEP-01',
      name: '软件管理模块',
      required: false,
      productCode: 'UA-SoftMgr-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 75}, {"min": 20, "max": 49, "price": 70}, {"min": 50, "max": 99, "price": 65}, {"min": 100, "max": 199, "price": 55}, {"min": 200, "max": 500, "price": 45}],
      discount: 0.2,
      unit: '端点',
      desc: '软件管理模块客户端许可，主要功能包括：\n1）支持对已安装软件信息、安装包、绿色软件信息采集与统计；\n2）支持软件安装监控；\n3）支持批量卸载终端软件；\n4）支持对进程进行黑白名单管理。',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-01-05',
      moduleId: 'MOD-LEP-01',
      name: '软件商城模块',
      required: false,
      productCode: 'LV-AppStore-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 75}, {"min": 20, "max": 49, "price": 70}, {"min": 50, "max": 99, "price": 65}, {"min": 100, "max": 199, "price": 55}, {"min": 200, "max": 500, "price": 45}],
      discount: 0.2,
      unit: '端点',
      desc: '企业软件商店模块许可，主要功能：\n1）提供标准化的软件中心，为终端用户提供软件下载入口，避免私自下载安装软件带来的潜在安全和法律风险',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-01-06',
      moduleId: 'MOD-LEP-01',
      name: '云端软件安全下载服务',
      required: false,
      productCode: 'SaaS-SWD',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 75}, {"min": 20, "max": 49, "price": 70}, {"min": 50, "max": 99, "price": 65}, {"min": 100, "max": 199, "price": 55}, {"min": 200, "max": 500, "price": 45}],
      discount: 0.2,
      unit: '端点',
      desc: '云软件安全下载，主要功能包括：\n1）提供云端软件下载至软件商城服务，在做好软件标准化管理的同时极大节省运维效率。\n注：需先选购软件商城模块',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-01-07',
      moduleId: 'MOD-LEP-01',
      name: '补丁管理模块',
      required: false,
      productCode: 'UA-MSP-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 75}, {"min": 20, "max": 49, "price": 70}, {"min": 50, "max": 99, "price": 65}, {"min": 100, "max": 199, "price": 55}, {"min": 200, "max": 500, "price": 45}],
      discount: 0.2,
      unit: '端点',
      desc: '微软补丁管理许可，主要功能包括：：\n1）自动给客户端安装补丁，支持中继和断点续传；\n2）支持蓝屏修复和远程卸载补丁；',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-01-08',
      moduleId: 'MOD-LEP-01',
      name: '设备发现模块',
      required: false,
      productCode: 'LV-Topo-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 75}, {"min": 20, "max": 49, "price": 70}, {"min": 50, "max": 99, "price": 65}, {"min": 100, "max": 199, "price": 55}, {"min": 200, "max": 500, "price": 45}],
      discount: 0.2,
      unit: '端点',
      desc: '设备发现及定位模块，主要功能包括：\n1）网络中设备的发现；\n2）新设备接入告警；\n3）HUB接入告警；\n4）网络拓扑可视化管理；\n注：采购数量需等于用户采购最其它模块的最大值。',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-03-01',
      moduleId: 'MOD-LEP-03',
      name: '防病毒模块',
      required: false,
      productCode: 'UEDR-AV-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 225}, {"min": 20, "max": 49, "price": 210}, {"min": 50, "max": 99, "price": 195}, {"min": 100, "max": 199, "price": 165}, {"min": 200, "max": 500, "price": 135}],
      discount: 0.2,
      unit: '端点',
      desc: '防病毒Windows桌面操作系统客户端，主要功能包括：\n1）防范木马、病毒入侵计算机，\n2）病毒查杀（本地查杀）、文件实时防护、白名单管理、勒索防护、日志管理等功能；',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-03-02',
      moduleId: 'MOD-LEP-03',
      name: '文档防勒索模块（含文档备份）',
      required: false,
      productCode: 'UA-RD-Win-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 150}, {"min": 20, "max": 49, "price": 140}, {"min": 50, "max": 99, "price": 130}, {"min": 100, "max": 199, "price": 110}, {"min": 200, "max": 500, "price": 90}],
      discount: 0.2,
      unit: '端点',
      desc: '文档勒索防护Windows客户端许可,主要功能包含：\n1）基于勒索病毒特征码及行为进行识别和拦截；\n2）对终端文档提前自动备份；',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-02-01',
      moduleId: 'MOD-LEP-02',
      name: '敏感内容识别模块',
      required: false,
      productCode: 'BDP-DLP-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 450}, {"min": 20, "max": 49, "price": 420}, {"min": 50, "max": 99, "price": 390}, {"min": 100, "max": 199, "price": 330}, {"min": 200, "max": 500, "price": 270}],
      discount: 0.2,
      unit: '端点',
      desc: '敏感内容检查模块客户端许可：\n1）通过扫描发现包含敏感内容的文档；\n2）对包含敏感内容的文件传输/发送动作自动阻断；',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-01-09',
      moduleId: 'MOD-LEP-01',
      name: '文件读写操作行为审计与控制模块',
      required: false,
      productCode: 'UA-DocCtrl-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 75}, {"min": 20, "max": 49, "price": 70}, {"min": 50, "max": 99, "price": 65}, {"min": 100, "max": 199, "price": 55}, {"min": 200, "max": 500, "price": 45}],
      discount: 0.2,
      unit: '端点',
      desc: '文件读写操作行为审计与控制模块客户端许可，主要功能包括：\n1）支持对文件的读、写、复制、剪切、创建、删除、另存为、新建、重命名的动作进行监控；',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-01-10',
      moduleId: 'MOD-LEP-01',
      name: '打印审计与控制模块',
      required: false,
      productCode: 'UA-PAudit-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 75}, {"min": 20, "max": 49, "price": 70}, {"min": 50, "max": 99, "price": 65}, {"min": 100, "max": 199, "price": 55}, {"min": 200, "max": 500, "price": 45}],
      discount: 0.2,
      unit: '端点',
      desc: '打印审计与控制模块客户端许可，主要功能包括：\n1）打印行为与内容审计；\n2）打印控制与审批管理；\n3）打印机黑白名单管理。',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-01-11',
      moduleId: 'MOD-LEP-01',
      name: '网络行为审计与控制模块',
      required: false,
      productCode: 'UA-NAudit-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 75}, {"min": 20, "max": 49, "price": 70}, {"min": 50, "max": 99, "price": 65}, {"min": 100, "max": 199, "price": 55}, {"min": 200, "max": 500, "price": 45}],
      discount: 0.2,
      unit: '端点',
      desc: '网络行为审计与控制模块客户端许可，主要功能包括：\n1）支持审计与禁止网页访问行为；\n2）支持对网站进行分类、支持论坛发帖内容审计；',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-01-12',
      moduleId: 'MOD-LEP-01',
      name: '即时通讯管控模块',
      required: false,
      productCode: 'UA-IMCtrl-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 75}, {"min": 20, "max": 49, "price": 70}, {"min": 50, "max": 99, "price": 65}, {"min": 100, "max": 199, "price": 55}, {"min": 200, "max": 500, "price": 45}],
      discount: 0.2,
      unit: '端点',
      desc: '即时通讯行为审计与控制模块客户端许可，主要功能包括：\n1）常用即时通讯客户端消息审计与文件传输控制；',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-01-13',
      moduleId: 'MOD-LEP-01',
      name: '邮件管控模块',
      required: false,
      productCode: 'UA-EmailCtrl-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 75}, {"min": 20, "max": 49, "price": 70}, {"min": 50, "max": 99, "price": 65}, {"min": 100, "max": 199, "price": 55}, {"min": 200, "max": 500, "price": 45}],
      discount: 0.2,
      unit: '端点',
      desc: '邮件审计模块客户端许可，主要功能包括：\n1)常见邮件客户端使用SMTP+TLS协议发送的邮件内容审计和外发控制；\n2)使用IE11与Chrome50版本以上浏览器访问QQ邮箱、163个人邮箱、Yeah.Net邮箱、126邮箱、QQ企业邮箱的内容审计和外发控制。',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-01-14',
      moduleId: 'MOD-LEP-01',
      name: '屏幕水印与控制模块',
      required: false,
      productCode: 'UA-ScrCtrl-WaterPrt-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 75}, {"min": 20, "max": 49, "price": 70}, {"min": 50, "max": 99, "price": 65}, {"min": 100, "max": 199, "price": 55}, {"min": 200, "max": 500, "price": 45}],
      discount: 0.2,
      unit: '端点',
      desc: '屏幕水印与控制模块客户端许可。主要功能包括：\n1）震慑潜在拍照泄密行为\n2）支持在计算机屏幕、应用程序或访问网站时显示文字水印、图片水印、二维码水印或点阵水印；\n3）支持将水印信息输入系统进行追溯。',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-01-15',
      moduleId: 'MOD-LEP-01',
      name: '屏幕录像模块',
      required: false,
      productCode: 'UA-ScrRec-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 75}, {"min": 20, "max": 49, "price": 70}, {"min": 50, "max": 99, "price": 65}, {"min": 100, "max": 199, "price": 55}, {"min": 200, "max": 500, "price": 45}],
      discount: 0.2,
      unit: '端点',
      desc: '屏幕录像模块客户端许可，主要功能包括：\n1）支持对终端的屏幕进行录像，可在管理端实现回放',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-01-16',
      moduleId: 'MOD-LEP-01',
      name: 'USB移动存储管理模块',
      required: false,
      productCode: 'UA-UMgmt-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 75}, {"min": 20, "max": 49, "price": 70}, {"min": 50, "max": 99, "price": 65}, {"min": 100, "max": 199, "price": 55}, {"min": 200, "max": 500, "price": 45}],
      discount: 0.2,
      unit: '端点',
      desc: 'USB移动存储管理模块客户端许可，主要功能：\n1）USB移动存储设备注册与管理；\n2）仅注册移动存储设备可使用，且可限定可使用的终端或部门使用；\n3）非注册移动存储设备不可用，防止外部移动存储使用带来的风险。',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-01-17',
      moduleId: 'MOD-LEP-01',
      name: '安全U盘模块',
      required: false,
      productCode: 'UA-UEnc-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 150}, {"min": 20, "max": 49, "price": 140}, {"min": 50, "max": 99, "price": 130}, {"min": 100, "max": 199, "price": 110}, {"min": 200, "max": 500, "price": 90}],
      discount: 0.2,
      unit: '端点',
      desc: '安全U盘模块许可（按照本域安全U盘的注册数量计算），主要功能包括：\n1）安全U盘制作工具；\n2）安全U盘绑定注册与管理；\n3）安全U盘文件读写操作审计与控制。',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-02-02',
      moduleId: 'MOD-LEP-02',
      name: '透明加解密客户端',
      required: false,
      productCode: 'UA-DES-Win-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 1500}, {"min": 20, "max": 49, "price": 1400}, {"min": 50, "max": 99, "price": 1300}, {"min": 100, "max": 199, "price": 1210}, {"min": 200, "max": 500, "price": 990}],
      discount: 0.2,
      unit: '端点',
      desc: '文档安全模块Windows许可，主要功能包括：\n1）按管理端配置的策略，对终端电脑常用重要文档进行强制透明加解密；\n2）含管理平台',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-02-03',
      moduleId: 'MOD-LEP-02',
      name: '虚拟磁盘隐身加密系统客户端',
      required: false,
      productCode: 'DLP-Ydisk-QY-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 1200}, {"min": 20, "max": 49, "price": 1050}, {"min": 50, "max": 99, "price": 975}, {"min": 100, "max": 199, "price": 880}, {"min": 200, "max": 500, "price": 810}],
      discount: 0.2,
      unit: '端点',
      desc: '虚拟磁盘隐身加密系统企业版客户端许可，主要功能包括：\n1）保险箱：容量不限，数量不限\n2）主辅双库，身份信息备份\n3）独立加密，操作系统支持Win 7/8/10/11',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-04-01',
      moduleId: 'MOD-LEP-04',
      name: '网络准入控制模块',
      required: false,
      productCode: 'UA-NAC-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 500}, {"min": 20, "max": 49, "price": 500}, {"min": 50, "max": 99, "price": 500}, {"min": 100, "max": 199, "price": 500}, {"min": 200, "max": 500, "price": 500}],
      discount: 0.2,
      unit: '端点',
      desc: '网络准入控制许可、横向移动控制，主要功能包括：\n1）基于802.1x的网络准入控制；\n2）基于EoU认证的网络准入控制(可配合UNACC网关进行网络准入认证，解决HUB、VPN、WAN、无线AP、NAT等各种接入方式的准入控制)；\n3）支持终端识别、安全检查、安全隔离、安全修复（如需补丁自动修复，须购买补丁管理模块）、安全接入等网络准入控制流程。\n注：基于硬件网关的网络准入控制请选购N系列或NACC硬件产品',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
    {
      id: 'FEAT-MOD-LEP-04-02',
      moduleId: 'MOD-LEP-04',
      name: '访客管理模块',
      required: false,
      productCode: 'UA-NAC-G-1',
      priceType: 'tiered',
      priceFixed: null,
      tiers: [{"min": 10, "max": 19, "price": 3000}, {"min": 20, "max": 49, "price": 3000}, {"min": 50, "max": 99, "price": 3000}, {"min": 100, "max": 199, "price": 3000}, {"min": 200, "max": 500, "price": 3000}],
      discount: 1.0,
      unit: '端点',
      desc: '访客及外协人员管理模块，主要功能包括：\n1）访客管理；\n2）外协人员管理；\n注：采购本模块前需先选购网络准入控制模块，且采购数量与网络准入控制模块数量保持一致',
      status: 'active',
      published: true,
      createdAt: '2026-04-12',
    },
  ],  // 4. 硬件产品
  hardwareProducts: [
    {
      id: 'HW-001',
      categoryId: 'CAT-HW',
      name: '微盾一体机',
      model: 'WD-2000',
      icon: '🖥️',
      desc: '联软安略安全管控平台一体机，支持网关型、802.1x等多种准入控制，开箱即用。',
      specs: 'CPU: 8核 | 内存: 32GB | 硬盘: 2TB | 网口: 6个千兆',
      priceFixed: 10000,
      unit: '台',
      status: 'active',
      published: true,
      createdAt: '2026-01-01'
    },
    {
      id: 'HW-002',
      categoryId: 'CAT-HW',
      name: '网络准入控制器（N2设备）',
      model: 'NAC-N2',
      icon: '🔲',
      desc: '1U机架式，6个千兆网口，最大500台；支持策略路由/端口镜像/EOU/Portal等多种准入方式。',
      specs: '1U机架式 | 6个千兆网口 | 最大500台终端',
      priceFixed: 27000,
      unit: '台',
      status: 'active',
      published: true,
      createdAt: '2026-01-01'
    },
    {
      id: 'HW-003',
      categoryId: 'CAT-HW',
      name: 'UniSDP零信任网关（P2设备）',
      model: 'SDP-P2',
      icon: '🛡️',
      desc: '高端型号，8个千兆网口，最大支持2000台设备，支持多节点集群部署。',
      specs: 'CPU: 16核 | 内存: 64GB | 硬盘: 4TB | 网口: 8个千兆',
      priceFixed: 38000,
      unit: '台',
      status: 'active',
      published: true,
      createdAt: '2026-01-01'
    }
  ],

  // 5. 套餐
  packages: [
    {
      id: 'PKG-BASIC',
      name: '基础版套餐',
      icon: '📦',
      desc: '适合中小企业入门级终端安全管理需求，包含核心准入控制和基础安全功能。',
      featureIds: ['FEAT-LEP-0101', 'FEAT-LEP-0201', 'FEAT-LEP-0301'],
      hardwareIds: ['HW-002'],
      moduleIds: ['MOD-LEP-01', 'MOD-LEP-02', 'MOD-LEP-03'],
      status: 'active',
      published: true,
      createdAt: '2026-01-01'
    },
    {
      id: 'PKG-PRO',
      name: '专业版套餐',
      icon: '🎯',
      desc: '面向中大型企业，包含完整的终端安全、数据防泄漏功能，支持复杂的网络架构。',
      featureIds: ['FEAT-LEP-0101', 'FEAT-LEP-0201', 'FEAT-LEP-0202', 'FEAT-LEP-0301', 'FEAT-LEP-0302', 'FEAT-LEP-0401', 'FEAT-LEP-0501', 'FEAT-LEP-0601'],
      hardwareIds: ['HW-002'],
      moduleIds: ['MOD-LEP-01', 'MOD-LEP-02', 'MOD-LEP-03', 'MOD-LEP-04', 'MOD-LEP-05', 'MOD-LEP-06'],
      status: 'active',
      published: true,
      createdAt: '2026-01-01'
    },
    {
      id: 'PKG-ENTERPRISE',
      name: '企业版套餐',
      icon: '🏢',
      desc: '面向大型企业和集团客户，提供全方位的终端安全、准入控制、文档加密，支持远程办公。',
      featureIds: ['FEAT-LEP-0101', 'FEAT-LEP-0201', 'FEAT-LEP-0202', 'FEAT-LEP-0203', 'FEAT-LEP-0301', 'FEAT-LEP-0302', 'FEAT-LEP-0401', 'FEAT-LEP-0501', 'FEAT-LEP-0601', 'FEAT-LEP-0701'],
      hardwareIds: ['HW-001', 'HW-002', 'HW-003'],
      moduleIds: ['MOD-LEP-01', 'MOD-LEP-02', 'MOD-LEP-03', 'MOD-LEP-04', 'MOD-LEP-05', 'MOD-LEP-06', 'MOD-LEP-07'],
      status: 'active',
      published: true,
      createdAt: '2026-01-01'
    },
    {
      id: 'PKG-XCAD',
      name: 'XCAD 国产化套餐',
      icon: '🏛️',
      desc: '面向有国产化替代需求的政企客户，包含数字化安全基座和完整的域管功能。',
      featureIds: ['FEAT-XCAD-0101', 'FEAT-XCAD-0102', 'FEAT-XCAD-0201', 'FEAT-XCAD-0202'],
      hardwareIds: [],
      moduleIds: ['MOD-XCAD-01', 'MOD-XCAD-02'],
      status: 'active',
      published: true,
      createdAt: '2026-01-01'
    }
  ],

  // 保留旧版产品数据用于兼容（后续可迁移）
  products: [],
  partnerProfiles: [],
  partnerProfileProducts: [],
  openApiClients: [],
  implementationWorkloadClassifications: [],
  implementationWorkloadMappings: [],
  implementationWorkloadRules: [],
  implementationDeliveryWorkloadRules: [],
  mobileV2BusinessConfigs: [],
  mobileV2RegistrationDrafts: [],
  mobileV2OrderDrafts: [],
  mobileV2BusinessEvents: [],
  mobileV2IdempotencyRecords: []
};

// SQLite 持久化层
const dbLayer = new DbLayer(DB_PATH);
const auditDb = new AuditDb(AUDIT_DB_PATH);

const STANDARD_MAINTENANCE_FEATURE_ID = 'FEAT-MOD-MAINTENANCE-01-01';
const STANDARD_MAINTENANCE_PRODUCT_CODE = 'MAINT-STD-1';
const STANDARD_MAINTENANCE_FEATURE_NAME = '标准维保服务';
const STANDARD_MAINTENANCE_DEFAULT_RATE = 15;
const MAINTENANCE_CATEGORY_ID = 'CAT-MAINTENANCE';

function isStandardMaintenanceFeatureConfig(feature) {
  if (!feature) return false;
  const featureId = String(feature.id || '').trim();
  const productCode = String(feature.productCode || '').trim();
  const name = String(feature.name || '').trim();
  return featureId === STANDARD_MAINTENANCE_FEATURE_ID
    || productCode === STANDARD_MAINTENANCE_PRODUCT_CODE
    || name === STANDARD_MAINTENANCE_FEATURE_NAME;
}

function normalizeMaintenanceRateValue(value, defaultValue = STANDARD_MAINTENANCE_DEFAULT_RATE) {
  const numericValue = Number(value);
  const fallbackValue = Number(defaultValue);
  const normalizedValue = Number.isFinite(numericValue) ? numericValue : (Number.isFinite(fallbackValue) ? fallbackValue : 0);
  return Math.max(0, Math.min(100, Math.round(normalizedValue * 100) / 100));
}

function getEligibleStandardMaintenanceModules(feature) {
  const maintenanceModuleId = String(feature?.moduleId || '').trim();
  return Array.isArray(db.modules)
    ? db.modules.filter(module => module && module.categoryId !== MAINTENANCE_CATEGORY_ID && module.id !== maintenanceModuleId)
    : [];
}

function getEligibleStandardMaintenanceFeatures(feature) {
  const maintenanceFeatureId = String(feature?.id || '').trim();
  return Array.isArray(db.features)
    ? db.features.filter(item => {
      if (!item || !item.moduleId) return false;
      const module = db.modules.find(entry => entry.id === item.moduleId);
      return module?.categoryId !== MAINTENANCE_CATEGORY_ID
        && String(item.id || '').trim() !== maintenanceFeatureId
        && !isStandardMaintenanceFeatureConfig(item);
    })
    : [];
}

function normalizeStandardMaintenanceModuleRates(maintenanceModuleRates, feature) {
  const eligibleModules = getEligibleStandardMaintenanceModules(feature);
  const sourceMap = new Map();
  if (Array.isArray(maintenanceModuleRates)) {
    maintenanceModuleRates.forEach(item => {
      const moduleId = String(item?.moduleId || '').trim();
      if (!moduleId) return;
      sourceMap.set(moduleId, {
        moduleId,
        rate: normalizeMaintenanceRateValue(item.rate)
      });
    });
  }
  return eligibleModules.map(module => {
    const existingItem = sourceMap.get(module.id);
    return {
      moduleId: module.id,
      rate: normalizeMaintenanceRateValue(existingItem?.rate, STANDARD_MAINTENANCE_DEFAULT_RATE)
    };
  });
}

function normalizeStandardMaintenanceFeatureOverrides(maintenanceFeatureOverrides, feature) {
  const eligibleFeatures = getEligibleStandardMaintenanceFeatures(feature);
  const sourceMap = new Map();
  if (Array.isArray(maintenanceFeatureOverrides)) {
    maintenanceFeatureOverrides.forEach(item => {
      const featureId = String(item?.featureId || '').trim();
      if (!featureId) return;
      const hasRate = item?.rate !== undefined && item?.rate !== null && item?.rate !== '';
      sourceMap.set(featureId, {
        featureId,
        rate: hasRate ? normalizeMaintenanceRateValue(item.rate) : null
      });
    });
  }
  return eligibleFeatures.map(item => {
    const existingItem = sourceMap.get(item.id);
    return {
      featureId: item.id,
      rate: existingItem ? existingItem.rate : null
    };
  });
}

function normalizeStandardMaintenanceRegionOverrides(regionPriceOverrides, priceFixed) {
  if (!Array.isArray(regionPriceOverrides)) return [];
  return regionPriceOverrides.map(override => {
    const regions = Array.from(new Set([
      ...(Array.isArray(override.regions) ? override.regions : []),
      override.region || ''
    ].filter(Boolean)));
    const normalizedOverride = {
      ...override,
      region: regions[0] || '',
      regions,
      tiers: []
    };
    const baseFixed = normalizedOverride.priceFixed !== undefined
      && normalizedOverride.priceFixed !== null
      && normalizedOverride.priceFixed !== ''
      ? Number(normalizedOverride.priceFixed) || 0
      : (Number(priceFixed) || 0);
    delete normalizedOverride.tiers;
    if (normalizedOverride.priceRatioPrimary !== undefined && normalizedOverride.priceRatioPrimary !== null && normalizedOverride.priceRatioPrimary !== '') {
      let ratioPrimary = Number(normalizedOverride.priceRatioPrimary) || 0;
      if (ratioPrimary > 100) ratioPrimary = Math.round(100 / ratioPrimary * 100);
      ratioPrimary = Math.max(0, Math.min(100, ratioPrimary));
      normalizedOverride.priceRatioPrimary = Math.round(ratioPrimary);
      normalizedOverride.priceForPrimary = roundMoney(baseFixed * ratioPrimary / 100);
    } else {
      delete normalizedOverride.priceRatioPrimary;
      delete normalizedOverride.priceForPrimary;
    }
    if (normalizedOverride.priceRatioSecondary !== undefined && normalizedOverride.priceRatioSecondary !== null && normalizedOverride.priceRatioSecondary !== '') {
      let ratioSecondary = Number(normalizedOverride.priceRatioSecondary) || 0;
      if (ratioSecondary > 100) ratioSecondary = Math.round(100 / ratioSecondary * 100);
      ratioSecondary = Math.max(0, Math.min(100, ratioSecondary));
      normalizedOverride.priceRatioSecondary = Math.round(ratioSecondary);
      normalizedOverride.priceForSecondary = roundMoney(baseFixed * ratioSecondary / 100);
    } else {
      delete normalizedOverride.priceRatioSecondary;
      delete normalizedOverride.priceForSecondary;
    }
    if (normalizedOverride.priceFixed === undefined || normalizedOverride.priceFixed === null || normalizedOverride.priceFixed === '') {
      delete normalizedOverride.priceFixed;
    } else {
      normalizedOverride.priceFixed = baseFixed;
    }
    return normalizedOverride;
  });
}

function normalizeStandardMaintenanceFeatureConfig(feature) {
  if (!feature || !isStandardMaintenanceFeatureConfig(feature)) return feature;
  const normalizedFeature = {
    ...feature,
    priceType: 'fixed',
    priceFixed: Number(feature.priceFixed) || 0,
    unit: '月',
    tiers: []
  };
  delete normalizedFeature.unitPoints;
  normalizedFeature.maintenanceModuleRates = normalizeStandardMaintenanceModuleRates(
    normalizedFeature.maintenanceModuleRates,
    normalizedFeature
  );
  normalizedFeature.maintenanceFeatureOverrides = normalizeStandardMaintenanceFeatureOverrides(
    normalizedFeature.maintenanceFeatureOverrides,
    normalizedFeature
  );
  normalizedFeature.regionPriceOverrides = normalizeStandardMaintenanceRegionOverrides(
    normalizedFeature.regionPriceOverrides,
    normalizedFeature.priceFixed
  );
  if (normalizedFeature.priceRatioPrimary !== undefined && normalizedFeature.priceRatioPrimary !== null && normalizedFeature.priceRatioPrimary !== '') {
    let ratioPrimary = Number(normalizedFeature.priceRatioPrimary) || 0;
    if (ratioPrimary > 100) ratioPrimary = Math.round(100 / ratioPrimary * 100);
    ratioPrimary = Math.max(0, Math.min(100, ratioPrimary));
    normalizedFeature.priceRatioPrimary = Math.round(ratioPrimary);
    normalizedFeature.priceForPrimary = roundMoney(normalizedFeature.priceFixed * ratioPrimary / 100);
  } else {
    delete normalizedFeature.priceForPrimary;
  }
  if (normalizedFeature.priceRatioSecondary !== undefined && normalizedFeature.priceRatioSecondary !== null && normalizedFeature.priceRatioSecondary !== '') {
    let ratioSecondary = Number(normalizedFeature.priceRatioSecondary) || 0;
    if (ratioSecondary > 100) ratioSecondary = Math.round(100 / ratioSecondary * 100);
    ratioSecondary = Math.max(0, Math.min(100, ratioSecondary));
    normalizedFeature.priceRatioSecondary = Math.round(ratioSecondary);
    normalizedFeature.priceForSecondary = roundMoney(normalizedFeature.priceFixed * ratioSecondary / 100);
  } else {
    delete normalizedFeature.priceForSecondary;
  }
  return normalizedFeature;
}

function normalizeStandardMaintenanceFeaturesInDb() {
  if (!Array.isArray(db.features) || db.features.length === 0) return false;
  let changed = false;
  db.features = db.features.map(feature => {
    const normalizedFeature = normalizeStandardMaintenanceFeatureConfig(feature);
    if (normalizedFeature !== feature && JSON.stringify(normalizedFeature) !== JSON.stringify(feature)) {
      changed = true;
    }
    return normalizedFeature;
  });
  return changed;
}

// 从 SQLite 加载数据到内存
function loadData() {
  try {
    if (dbLayer.isEmpty()) {
      // 首次运行：尝试从旧版 data.json 迁移
      if (fs.existsSync(DATA_FILE)) {
        console.log('[迁移] 检测到旧版 data.json，正在导入到 SQLite...');
        dbLayer.importFromJson(DATA_FILE);
        const loaded = dbLayer.loadAll();
        // 将加载的数据写入 db 对象
        for (const key of Object.keys(loaded)) {
          if (loaded[key].length > 0) {
            db[key] = loaded[key];
          }
        }
        console.log('✅ 旧版数据已迁移到 SQLite');
      } else {
        console.log('✅ 首次运行，使用默认数据');
      }
    } else {
      // 正常加载：从 SQLite 读取
      const loaded = dbLayer.loadAll();
      for (const key of Object.keys(loaded)) {
        if (loaded[key].length > 0) {
          db[key] = loaded[key];
        }
      }
      console.log('✅ 数据已从 SQLite 加载');
    }
    if (normalizeStandardMaintenanceFeaturesInDb()) {
      saveData();
      console.log('✅ 已归一化标准维保服务配置');
    }
  } catch (err) {
    console.error('加载数据失败:', err.message);
    console.log('⚠️  使用内存默认数据运行');
  }
}

// 保存数据到 SQLite（原子事务，替代旧的 writeFileSync）
function saveData() {
  try {
    dbLayer.syncToDb(db);
  } catch (err) {
    console.error('保存数据失败:', err.message);
  }
}

// 移除旧的定时保存（SQLite 即时写入已保证持久性，无需 setInterval）

const DUE_REMINDER_WINDOW_DAYS = 30;

function ensureNotificationsStore() {
  if (!Array.isArray(db.notifications)) {
    db.notifications = [];
  }
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function parseDateAtLocalStart(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const datePart = raw.slice(0, 10);
  const match = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (!Number.isNaN(date.getTime())) {
      date.setHours(0, 0, 0, 0);
      return date;
    }
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDaysLeft(value, now = new Date()) {
  const dueDate = parseDateAtLocalStart(value);
  if (!dueDate) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function isWithinDueReminderWindow(value) {
  const daysLeft = getDaysLeft(value);
  return daysLeft !== null && daysLeft >= 0 && daysLeft <= DUE_REMINDER_WINDOW_DAYS;
}

function formatDueDate(value) {
  const date = parseDateAtLocalStart(value);
  return date ? formatDateKey(date) : String(value || '').slice(0, 10);
}

function formatDaysLeftText(daysLeft) {
  if (daysLeft === 0) return '今天到期';
  return `还有 ${daysLeft} 天到期`;
}

function findRegistrationById(regId) {
  if (!regId) return null;
  return (db.registrations || []).find(item => item.id === regId) || null;
}

function getRecordPartnerId(record) {
  if (!record) return '';
  if (record.partnerId) return record.partnerId;
  if (record.assignedPartnerId) return record.assignedPartnerId;
  if (record.assignedStaffId) {
    const staffInfo = getUserInfo(record.assignedStaffId);
    if (staffInfo.partnerId) return staffInfo.partnerId;
  }
  if (record.createdBy) {
    const creatorInfo = getUserInfo(record.createdBy);
    if (creatorInfo.partnerId) return creatorInfo.partnerId;
  }
  if (record.ownerId) {
    const ownerInfo = getUserInfo(record.ownerId);
    if (ownerInfo.partnerId) return ownerInfo.partnerId;
  }
  return '';
}

function getOpportunityRegion(opp) {
  if (opp?.region) return opp.region;
  const reg = findRegistrationById(opp?.regId);
  return reg?.region || '';
}

function canUserSeeOpportunity(user, opp) {
  if (!user || !opp) return false;
  if (user.role === 'superadmin') return true;
  if (user.role === 'admin') return Boolean(user.region && getOpportunityRegion(opp) === user.region);
  if (user.role === 'partner_admin') return Boolean(user.partnerId && getRecordPartnerId(opp) === user.partnerId);
  if (user.role === 'staff') {
    return isRecordRelatedToUser(opp, user.id, ['createdBy', 'ownerId', 'assignedStaffId']);
  }
  return false;
}

function canUserSeeRegistration(user, reg) {
  if (!user || !reg) return false;
  if (user.role === 'superadmin') return true;
  if (user.role === 'admin') return Boolean(user.region && reg.region === user.region);
  if (user.role === 'partner_admin') return Boolean(user.partnerId && getRecordPartnerId(reg) === user.partnerId);
  if (user.role === 'staff') return isRecordRelatedToUser(reg, user.id, ['createdBy', 'owner', 'assignedStaffId']);
  return false;
}

function buildLoginDueReminders(user) {
  const reminders = [];
  for (const opp of db.opportunities || []) {
    if (!opp?.expectedClose) continue;
    if (['won', 'lost'].includes(opp.stage)) continue;
    if (!isWithinDueReminderWindow(opp.expectedClose)) continue;
    if (!canUserSeeOpportunity(user, opp)) continue;

    const daysLeft = getDaysLeft(opp.expectedClose);
    reminders.push({
      type: 'opportunity',
      targetId: opp.id,
      targetName: opp.name || opp.customer || opp.id,
      customer: opp.customer || '',
      dueDate: formatDueDate(opp.expectedClose),
      daysLeft,
      message: `商机「${opp.name || opp.customer || opp.id}」预计签约时间 ${formatDaysLeftText(daysLeft)}`
    });
  }

  for (const reg of db.registrations || []) {
    if (!reg?.expireAt) continue;
    if (reg.status !== 'approved') continue;
    if (!isWithinDueReminderWindow(reg.expireAt)) continue;
    if (!canUserSeeRegistration(user, reg)) continue;

    const daysLeft = getDaysLeft(reg.expireAt);
    reminders.push({
      type: 'registration',
      targetId: reg.id,
      targetName: reg.customer || reg.id,
      customer: reg.customer || '',
      dueDate: formatDueDate(reg.expireAt),
      daysLeft,
      message: `客户报备「${reg.customer || reg.id}」保护期 ${formatDaysLeftText(daysLeft)}`
    });
  }

  reminders.sort((a, b) => {
    if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
    return String(a.dueDate).localeCompare(String(b.dueDate));
  });
  return reminders;
}

function buildDueReminderNotificationDesc(reminders) {
  const opportunityCount = reminders.filter(item => item.type === 'opportunity').length;
  const registrationCount = reminders.filter(item => item.type === 'registration').length;
  const summary = [
    opportunityCount ? `${opportunityCount} 个商机预计签约时间进入 30 天提醒期` : '',
    registrationCount ? `${registrationCount} 个客户报备保护期进入 30 天提醒期` : ''
  ].filter(Boolean).join('，');
  const details = reminders.slice(0, 8).map(item => `${item.targetName}（${formatDaysLeftText(item.daysLeft)}，${item.dueDate}）`);
  const moreText = reminders.length > details.length ? `；另有 ${reminders.length - details.length} 条` : '';
  return `${summary || '暂无到期提醒'}：${details.join('；')}${moreText}`;
}

function listNotificationsForUser(userId) {
  ensureNotificationsStore();
  const normalizedUserId = String(userId || '');
  return db.notifications
    .filter(item => String(item.userId || '') === normalizedUserId)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function ensureDueReminderNotificationsForLogin(user) {
  const reminders = buildLoginDueReminders(user);
  if (!reminders.length) return reminders;

  ensureNotificationsStore();
  const now = new Date();
  const todayKey = formatDateKey(now);
  const userId = String(user.id || '');
  const reminderKey = `due-reminder:${userId}:${todayKey}`;
  const desc = buildDueReminderNotificationDesc(reminders);
  const contentHash = crypto.createHash('sha1').update(JSON.stringify(reminders)).digest('hex');
  const existing = db.notifications.find(item => item.reminderKey === reminderKey);

  if (existing) {
    const contentChanged = existing.contentHash !== contentHash;
    existing.title = '到期提醒';
    existing.desc = desc;
    existing.time = '今天';
    existing.type = 'due_reminder';
    existing.dateKey = todayKey;
    existing.reminderItems = reminders;
    existing.contentHash = contentHash;
    existing.updatedAt = now.toISOString();
    if (contentChanged) existing.unread = true;
  } else {
    db.notifications.unshift({
      id: `NTF-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      userId,
      type: 'due_reminder',
      reminderKey,
      dateKey: todayKey,
      title: '到期提醒',
      desc,
      time: '今天',
      unread: true,
      reminderItems: reminders,
      contentHash,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    });
  }
  saveData();
  return reminders;
}

// 登录接口
function buildAuditRequestId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `audit_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function getRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
}

function safeAuditPayload(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (depth > 6) return '[truncated]';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(item => safeAuditPayload(item, depth + 1, seen));
  }
  if (typeof value !== 'object') {
    return String(value);
  }
  if (seen.has(value)) {
    return '[circular]';
  }
  seen.add(value);

  const maskedKeys = new Set([
    'password',
    'oldPassword',
    'newPassword',
    'confirmPassword',
    'secret',
    'clientSecret',
    'token',
    'accessToken',
    'refreshToken',
    'authorization'
  ]);

  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (maskedKeys.has(key)) {
      result[key] = '[masked]';
      continue;
    }
    result[key] = safeAuditPayload(item, depth + 1, seen);
  }
  return result;
}

function getUserRecordById(userId) {
  if (!userId) return null;
  return db.users.find(item => item.id === userId) || null;
}

function getUserRecordByName(name) {
  if (!name) return null;
  return db.users.find(item => item.name === name || item.username === name) || null;
}

function setRequestAuditContext(req, context = {}) {
  if (!req || !context || typeof context !== 'object') return;
  req.auditContext = {
    ...(req.auditContext && typeof req.auditContext === 'object' ? req.auditContext : {}),
    ...context
  };
}

function buildAuditActor(req, fallbackUser = null) {
  const explicitOperatorId =
    req.body?.operatorId ||
    req.body?.operatedBy ||
    req.body?.userId ||
    req.body?.createdBy ||
    req.query?.operatorId ||
    req.query?.operatedBy ||
    req.query?.userId ||
    '';
  const requestOperator = getOperatorFromRequest(req);
  const explicitOperator = getUserRecordById(explicitOperatorId);
  const namedOperator = getUserRecordByName(
    req.body?.approvedBy ||
    req.body?.operatorName ||
    req.body?.createdByName ||
    req.body?.operatedByName ||
    ''
  );
  const fallbackOperator = fallbackUser && fallbackUser.id ? getUserRecordById(fallbackUser.id) || fallbackUser : fallbackUser;
  const managerOperator = req.openApiManager && req.openApiManager.id ? req.openApiManager : null;
  const actor = requestOperator || explicitOperator || namedOperator || managerOperator || fallbackOperator || null;

  return {
    userId: actor?.id || explicitOperatorId || '',
    username: actor?.username || req.body?.username || req.query?.username || '',
    name: actor?.name || req.body?.operatorName || req.body?.approvedBy || req.body?.createdByName || '',
    role: actor?.role || req.body?.operatorRole || req.query?.operatorRole || ''
  };
}

function getAuditStatusLabel(status) {
  const map = {
    draft: '草稿',
    sent: '已发送',
    confirmed: '已确认',
    converted: '已转订单',
    expired: '已过期',
    pending: '待确认',
    primary_confirmed: '一级已确认',
    primary_rejected: '一级已驳回',
    processing: '处理中',
    shipped: '已发货',
    completed: '已完成',
    cancelled: '已取消'
  };
  return map[status] || status || '';
}

function cloneAuditValue(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    return value;
  }
}

const AUDIT_OPERATOR_FIELDS = new Set([
  'operatorId',
  'operatorName',
  'operatorRole',
  'operatedBy',
  'operatedByName',
  'operatedByRole',
  'operatedByRegion',
  'userRole',
  'userRegion'
]);

const AUDIT_SYSTEM_FIELDS = new Set([
  'updatedAt',
  'updatedBy',
  'createdAt',
  'createdByRole',
  'lastLogin',
  'lastLoginType',
  'ssoProvider',
  'ssoSubject',
  'password',
  'token'
]);

function stripAuditOperatorFields(value) {
  if (!value || typeof value !== 'object') return value;
  AUDIT_OPERATOR_FIELDS.forEach(field => {
    delete value[field];
  });
  return value;
}

const AUDIT_FIELD_LABELS = {
  name: '名称',
  username: '登录账号',
  role: '角色',
  status: '状态',
  remark: '备注',
  customer: '客户名称',
  customerName: '客户名称',
  creditCode: '统一社会信用代码',
  industry: '行业',
  contact: '联系人',
  phone: '联系电话',
  email: '邮箱',
  region: '区域',
  bigRegion: '大区',
  stage: '进度',
  probability: '赢率',
  amount: '金额',
  total: '金额',
  expectedClose: '预计签约时间',
  expireAt: '客户报备保护期',
  protectDays: '保护天数',
  assignedStaffId: '跟进员工ID',
  assignedStaffName: '跟进员工',
  assignedPartnerId: '渠道商ID',
  assignedPartnerName: '渠道商',
  partnerId: '渠道商ID',
  partnerName: '渠道商',
  owner: '负责人',
  ownerId: '负责人ID',
  quoteId: '报价单',
  followUps: '跟进记录',
  tags: '标签',
  notes: '备注',
  revenueTarget: '收入目标',
  opportunityTarget: '商机目标',
  visitTarget: '拜访目标',
  visitDate: '拜访日期',
  type: '类型',
  theme: '主题',
  summary: '总结',
  nextAction: '下一步动作',
  attendees: '参与人员',
  published: '发布状态',
  appKey: 'AppKey',
  ipWhitelist: 'IP白名单',
  allowedResources: '授权资源'
};

const AUDIT_STAGE_LABELS = {
  contacted: '1% 已联系上客户',
  registered: '10% 商机明确并报备',
  quoted: '20% 正式报价',
  budget: '30% 明确预算',
  design: '40% 技术交流/方案设计',
  testing: '50% 产品测试',
  negotiation: '70% 招投标/商务谈判',
  won: '100% 赢单',
  cancelled: '项目取消',
  lost: '输单',
  prospecting: '初步接触',
  qualification: '需求确认',
  proposal: '方案报价',
  closing: '商务谈判'
};

const AUDIT_STATUS_LABELS = {
  active: '启用',
  inactive: '停用',
  disabled: '禁用',
  pending: '待处理',
  approved: '已通过',
  rejected: '已驳回',
  draft: '草稿',
  sent: '已发送',
  confirmed: '已确认',
  converted: '已转订单',
  expired: '已过期',
  processing: '处理中',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  primary_confirmed: '一级已确认',
  primary_rejected: '一级已驳回'
};

function captureAuditBeforeSnapshot(req) {
  if (!req || !['PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) return;
  const before = findAuditBeforeRecord(req);
  if (!before) return;
  const actor = buildAuditActor(req);
  setRequestAuditContext(req, {
    actor,
    before,
    targetId: req.params?.id || req.params?.featureId || before.id || before.featureId || '',
    targetName: resolveAuditTargetName(before)
  });
}

function findAuditBeforeRecord(req) {
  const pathParts = String(req.path || '').split('/').filter(Boolean);
  if (pathParts[0] !== 'api') return null;
  if (pathParts[1] === 'open' || pathParts[1] === 'mock') return null;

  let collection = '';
  let id = '';
  let idField = 'id';

  const resource = pathParts[1] || '';
  if (resource === 'workload') {
    const subtype = pathParts[2] || '';
    id = pathParts[3] || '';
    if (subtype === 'mappings') {
      collection = 'implementationWorkloadMappings';
      idField = 'featureId';
    } else if (subtype === 'delivery-rules') {
      collection = 'implementationDeliveryWorkloadRules';
    } else if (subtype === 'rules') {
      collection = 'implementationWorkloadRules';
    }
  } else if (resource === 'open-api' && pathParts[2] === 'clients') {
    collection = 'openApiClients';
    id = pathParts[3] || '';
  } else if (resource === 'partners' && pathParts[2] === 'secondary') {
    collection = 'partners';
    id = pathParts[3] || '';
  } else {
    const collectionMap = {
      registrations: 'registrations',
      opportunities: 'opportunities',
      quotes: 'quotes',
      orders: 'orders',
      users: 'users',
      partners: 'partners',
      categories: 'categories',
      modules: 'modules',
      features: 'features',
      hardware: 'hardwareProducts',
      packages: 'packages',
      products: 'products',
      'pending-approvals': 'pendingApprovals',
      'channel-targets': 'channelTargets',
      'channel-visits': 'channelVisits'
    };
    collection = collectionMap[resource] || '';
    id = pathParts[2] || '';
  }

  if (!collection || !id || !Array.isArray(db[collection])) return null;
  const record = db[collection].find(item => String(item?.[idField] || '') === String(id));
  return record ? cloneAuditValue(record) : null;
}

function getAuditFieldLabel(field) {
  return AUDIT_FIELD_LABELS[field] || field;
}

function normalizeAuditComparable(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (err) {
    return String(value);
  }
}

function formatAuditDateValue(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return text;
}

function formatAuditValue(field, value) {
  if (value === undefined || value === null || value === '') return '空';
  if (field === 'stage') return AUDIT_STAGE_LABELS[value] || String(value);
  if (field === 'status') return AUDIT_STATUS_LABELS[value] || getAuditStatusLabel(value) || String(value);
  if (field === 'published') return value ? '已发布' : '未发布';
  if (field === 'probability') return `${value}%`;
  if (['amount', 'total', 'revenueTarget'].includes(field)) {
    const num = Number(value);
    return Number.isFinite(num) ? `¥${num.toLocaleString('zh-CN')}` : String(value);
  }
  if (['expectedClose', 'expireAt', 'visitDate', 'signDate'].includes(field) || /At$/.test(field)) {
    return formatAuditDateValue(value) || '空';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '空';
    if (value.every(item => typeof item === 'string' || typeof item === 'number')) {
      return value.join('、');
    }
    return `${value.length}项`;
  }
  if (typeof value === 'object') {
    return value.name || value.title || value.id || `${Object.keys(value).length}项内容`;
  }
  return String(value);
}

function getAuditTargetTypeLabel(targetType, moduleName) {
  const map = {
    registration: '客户报备',
    opportunity: '商机',
    quote: '报价单',
    order: '订单',
    user: '账号',
    partner: '渠道商',
    pending_approval: '审批记录',
    workload_rule: '工作量规则',
    workload_mapping: '工作量映射',
    category: '产品大类',
    module: '产品模块',
    feature: '功能模块',
    hardware: '硬件产品',
    package: '套餐',
    product: '产品',
    channel_target: '渠道目标',
    channel_visit: '渠道拜访',
    open_api_client: 'OpenAPI Client',
    import_task: '导入任务'
  };
  return map[targetType] || map[moduleName] || targetType || moduleName || '记录';
}

function getAuditActionVerb(action) {
  const map = {
    create: '创建',
    update: '更新',
    delete: '删除',
    change_status: '变更状态',
    change_password: '修改密码',
    reset_password: '重置密码',
    reset_secret: '重置密钥',
    sync_status: '同步状态',
    price_adjust: '调整价格',
    primary_confirm: '一级确认',
    primary_reject: '一级驳回',
    approve: '审批通过',
    reject: '审批驳回',
    approve_secondary: '审批通过',
    reject_secondary: '审批驳回',
    process_pending: '处理审批',
    batch_publish: '批量发布',
    import: '导入'
  };
  return map[action] || '操作';
}

function buildAuditChangeSummary(before, after, body = {}) {
  const beforeObj = before && typeof before === 'object' && !Array.isArray(before) ? before : null;
  const afterObj = after && typeof after === 'object' && !Array.isArray(after) ? after : null;
  if (!beforeObj || !afterObj) return { lines: [], fields: [] };

  const bodyKeys = body && typeof body === 'object' && !Array.isArray(body)
    ? Object.keys(body).filter(key => !AUDIT_OPERATOR_FIELDS.has(key) && !AUDIT_SYSTEM_FIELDS.has(key))
    : [];
  const compareKeys = bodyKeys.length
    ? bodyKeys
    : Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]))
        .filter(key => !AUDIT_OPERATOR_FIELDS.has(key) && !AUDIT_SYSTEM_FIELDS.has(key));

  const fields = [];
  for (const key of compareKeys) {
    if (AUDIT_SYSTEM_FIELDS.has(key) || AUDIT_OPERATOR_FIELDS.has(key)) continue;
    const oldValue = beforeObj[key];
    const newValue = afterObj[key];
    if (normalizeAuditComparable(oldValue) === normalizeAuditComparable(newValue)) continue;
    const label = getAuditFieldLabel(key);
    const beforeText = formatAuditValue(key, oldValue);
    const afterText = formatAuditValue(key, newValue);
    fields.push({
      field: key,
      label,
      before: beforeText,
      after: afterText,
      text: `${label}由「${beforeText}」变更为「${afterText}」`
    });
  }

  return {
    lines: fields.map(item => item.text),
    fields
  };
}

function buildAuditNaturalMessage(config, targetName, changeSummary) {
  if (!config) return '';
  const targetLabel = getAuditTargetTypeLabel(config.targetType, config.module);
  const targetText = targetName ? `${targetLabel}「${targetName}」` : targetLabel;
  const verb = getAuditActionVerb(config.action);
  if (changeSummary?.lines?.length) {
    return `${verb}${targetText}：${changeSummary.lines.join('；')}`;
  }
  if (config.action === 'delete') return `${verb}${targetText}`;
  if (config.action === 'create') return `${verb}${targetText}`;
  return '';
}

function resolveAuditTargetName(value, fallback = '') {
  if (!value) return fallback;
  return (
    value.name ||
    value.username ||
    value.customerName ||
    value.title ||
    value.targetName ||
    value.featureName ||
    value.moduleName ||
    value.categoryName ||
    value.id ||
    fallback
  );
}

function buildAuditQueryExtra(req, body) {
  return {
    params: cloneAuditValue(req.params || {}),
    query: cloneAuditValue(req.query || {}),
    body: cloneAuditValue(req.body || {}),
    resultMeta: body && typeof body === 'object'
      ? {
          success: body.success !== false,
          total: Number.isFinite(Number(body.total)) ? Number(body.total) : undefined,
          count: Array.isArray(body.data) ? body.data.length : undefined
        }
      : undefined
  };
}

function writeAuditLog(req, options = {}) {
  try {
    const actor = options.actor || buildAuditActor(req, options.fallbackUser || null);
    const record = {
      id: buildAuditRequestId(),
      created_at: new Date().toISOString(),
      request_id: req.requestId || '',
      actor_user_id: actor.userId || '',
      actor_username: actor.username || '',
      actor_name: actor.name || '',
      actor_role: actor.role || '',
      module: options.module || 'system',
      action: options.action || 'unknown',
      target_type: options.targetType || '',
      target_id: options.targetId || '',
      target_name: options.targetName || '',
      result: options.result || 'success',
      message: options.message || '',
      ip: getRequestIp(req),
      user_agent: req.headers['user-agent'] || '',
      before_json: options.before !== undefined ? JSON.stringify(safeAuditPayload(options.before)) : null,
      after_json: options.after !== undefined ? JSON.stringify(safeAuditPayload(options.after)) : null,
      extra_json: options.extra !== undefined ? JSON.stringify(safeAuditPayload(options.extra)) : null
    };
    auditDb.insert(record);
    req.auditLogged = true;
    return record;
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err.message);
    return null;
  }
}

function buildGenericAutoAuditConfig(req, key, routePath) {
  const method = req.method.toUpperCase();
  if (!routePath || !routePath.startsWith('/api/')) return null;

  const excludedPrefixes = [
    '/api/mock/',
    '/api/open/v1/'
  ];
  if (excludedPrefixes.some(prefix => routePath.startsWith(prefix))) return null;

  const excludedRoutes = new Set([
    'PUT /api/notifications/read',
    'POST /api/import/:type/preview',
    'POST /api/quotes/workload-preview',
    'POST /api/ipg/quote-preview',
    'POST /api/oauth/logout'
  ]);
  if (excludedRoutes.has(key)) return null;

  const segments = routePath.split('/').filter(Boolean);
  const resource = segments[1] || 'system';
  const moduleMap = {
    auth: 'auth',
    registrations: 'registration',
    opportunities: 'opportunity',
    quotes: 'quote',
    orders: 'order',
    users: 'account',
    admin: 'account',
    partners: 'partner',
    'pending-approvals': 'approval',
    workload: 'workload',
    categories: 'product',
    modules: 'product',
    features: 'product',
    hardware: 'product',
    packages: 'product',
    products: 'product',
    'channel-targets': 'partner',
    'channel-visits': 'partner',
    import: 'system',
    'open-api': 'openapi'
  };
  const targetTypeMap = {
    registrations: 'registration',
    opportunities: 'opportunity',
    quotes: 'quote',
    orders: 'order',
    users: 'user',
    admin: 'user',
    partners: 'partner',
    'pending-approvals': 'pending_approval',
    workload: 'workload_rule',
    categories: 'category',
    modules: 'module',
    features: 'feature',
    hardware: 'hardware',
    packages: 'package',
    products: 'product',
    'channel-targets': 'channel_target',
    'channel-visits': 'channel_visit',
    import: 'import_task',
    'open-api': 'open_api_client',
    auth: 'user'
  };

  let action = method === 'POST' ? 'create' : method === 'DELETE' ? 'delete' : 'update';
  if (routePath.includes('/status')) action = 'change_status';
  if (routePath.includes('/password')) action = 'change_password';
  if (routePath.includes('/reset-secret')) action = 'reset_secret';
  if (routePath.includes('/primary-confirm')) action = 'primary_confirm';
  if (routePath.includes('/primary-reject')) action = 'primary_reject';
  if (routePath.includes('/price-adjust')) action = 'price_adjust';
  if (routePath.includes('/approve')) action = 'approve';
  if (routePath.includes('/reject')) action = 'reject';
  if (routePath.includes('/publish')) action = 'change_status';
  if (routePath.includes('/execute')) action = 'import';
  if (routePath.includes('/login')) action = 'login';

  return {
    module: moduleMap[resource] || 'system',
    action,
    targetType: targetTypeMap[resource] || resource.replace(/-/g, '_'),
    message: `Auto audit: ${method} ${routePath}`
  };
}

function getAutoAuditConfig(req) {
  const routePath = req.route?.path || '';
  const key = `${req.method.toUpperCase()} ${routePath}`;
  if (req.method.toUpperCase() === 'GET') {
    return null;
  }
  const configs = {
    'GET /api/registrations': { module: 'registration', action: 'list', targetType: 'registration', message: '查询报备列表' },
    'GET /api/opportunities': { module: 'opportunity', action: 'list', targetType: 'opportunity', message: '查询商机列表' },
    'GET /api/quotes': { module: 'quote', action: 'list', targetType: 'quote', message: '查询报价单列表' },
    'DELETE /api/quotes/:id': { module: 'quote', action: 'delete', targetType: 'quote', message: '删除报价单' },
    'GET /api/orders': { module: 'order', action: 'list', targetType: 'order', message: '查询订单列表' },
    'DELETE /api/orders/:id': { module: 'order', action: 'delete', targetType: 'order', message: '删除订单' },
    'GET /api/users': { module: 'account', action: 'list', targetType: 'user', message: '查询账号列表' },
    'POST /api/users': { module: 'account', action: 'create', targetType: 'user', message: '创建账号' },
    'POST /api/admin/accounts': { module: 'account', action: 'create', targetType: 'user', message: '创建管理员账号' },
    'PUT /api/users/:id': { module: 'account', action: 'update', targetType: 'user', message: '更新账号信息' },
    'DELETE /api/users/:id': { module: 'account', action: 'delete', targetType: 'user', message: '删除账号' },
    'PUT /api/users/:id/password': { module: 'account', action: 'reset_password', targetType: 'user', message: '重置账号密码' },
    'PUT /api/users/:id/status': { module: 'account', action: 'change_status', targetType: 'user', message: '变更账号状态' },
    'POST /api/users/sync-status': { module: 'account', action: 'sync_status', targetType: 'user', message: '同步账号状态' },
    'GET /api/partners': { module: 'partner', action: 'list', targetType: 'partner', message: '查询渠道商列表' },
    'GET /api/partners/:id': { module: 'partner', action: 'detail', targetType: 'partner', message: '查看渠道商详情' },
    'PUT /api/partners/:id/status': { module: 'partner', action: 'change_status', targetType: 'partner', message: '变更渠道商状态' },
    'POST /api/partners/:id/staff': { module: 'partner', action: 'add_staff', targetType: 'partner', message: '为渠道商新增员工' },
    'PUT /api/partners/:id': { module: 'partner', action: 'update', targetType: 'partner', message: '更新渠道商信息' },
    'DELETE /api/partners/:id': { module: 'partner', action: 'delete', targetType: 'partner', message: '删除渠道商' },
    'PUT /api/partners/:id/level': { module: 'partner', action: 'set_level', targetType: 'partner', message: '设置渠道分销层级' },
    'PUT /api/partners/:id/unbind': { module: 'partner', action: 'unbind', targetType: 'partner', message: '解绑渠道商上级关系' },
    'PUT /api/partners/:id/add-parent': { module: 'partner', action: 'add_parent', targetType: 'partner', message: '新增渠道商上级关系' },
    'PUT /api/partners/:id/rebind': { module: 'partner', action: 'rebind', targetType: 'partner', message: '重绑渠道商上级关系' },
    'POST /api/partners/secondary/apply': { module: 'partner', action: 'secondary_apply', targetType: 'partner', message: '申请创建二级渠道商' },
    'GET /api/partners/secondary/pending': { module: 'partner', action: 'list', targetType: 'pending_approval', message: '查询二级渠道商待审批列表' },
    'PUT /api/partners/secondary/:id/approve': { module: 'partner', action: 'approve_secondary', targetType: 'pending_approval', message: '审批通过二级渠道商申请' },
    'PUT /api/partners/secondary/:id/reject': { module: 'partner', action: 'reject_secondary', targetType: 'pending_approval', message: '驳回二级渠道商申请' },
    'GET /api/pending-approvals': { module: 'approval', action: 'list', targetType: 'pending_approval', message: '查询待审批列表' },
    'GET /api/workload/classifications': { module: 'workload', action: 'list', targetType: 'workload_classification', message: '查询工作量分类配置' },
    'GET /api/workload/mappings': { module: 'workload', action: 'list', targetType: 'workload_mapping', message: '查询工作量映射列表' },
    'PUT /api/workload/mappings/:featureId': { module: 'workload', action: 'update', targetType: 'workload_mapping', message: '更新工作量映射' },
    'GET /api/workload/rules': { module: 'workload', action: 'list', targetType: 'workload_rule', message: '查询工作量规则列表' },
    'POST /api/workload/rules': { module: 'workload', action: 'create', targetType: 'workload_rule', message: '创建工作量规则' },
    'PUT /api/workload/rules/:id': { module: 'workload', action: 'update', targetType: 'workload_rule', message: '更新工作量规则' },
    'DELETE /api/workload/rules/:id': { module: 'workload', action: 'delete', targetType: 'workload_rule', message: '删除工作量规则' },
    'GET /api/product-tree': { module: 'product', action: 'list', targetType: 'product_tree', message: '查询产品目录树' },
    'GET /api/categories': { module: 'product', action: 'list', targetType: 'category', message: '查询产品大类列表' },
    'POST /api/categories': { module: 'product', action: 'create', targetType: 'category', message: '创建产品大类' },
    'PUT /api/categories/:id': { module: 'product', action: 'update', targetType: 'category', message: '更新产品大类' },
    'DELETE /api/categories/:id': { module: 'product', action: 'delete', targetType: 'category', message: '删除产品大类' },
    'GET /api/modules': { module: 'product', action: 'list', targetType: 'module', message: '查询产品模块列表' },
    'POST /api/modules': { module: 'product', action: 'create', targetType: 'module', message: '创建产品模块' },
    'PUT /api/modules/:id': { module: 'product', action: 'update', targetType: 'module', message: '更新产品模块' },
    'DELETE /api/modules/:id': { module: 'product', action: 'delete', targetType: 'module', message: '删除产品模块' },
    'GET /api/features': { module: 'product', action: 'list', targetType: 'feature', message: '查询功能模块列表' },
    'POST /api/features': { module: 'product', action: 'create', targetType: 'feature', message: '创建功能模块' },
    'PUT /api/features/:id': { module: 'product', action: 'update', targetType: 'feature', message: '更新功能模块' },
    'DELETE /api/features/:id': { module: 'product', action: 'delete', targetType: 'feature', message: '删除功能模块' },
    'GET /api/hardware': { module: 'product', action: 'list', targetType: 'hardware', message: '查询硬件产品列表' },
    'POST /api/hardware': { module: 'product', action: 'create', targetType: 'hardware', message: '创建硬件产品' },
    'PUT /api/hardware/:id': { module: 'product', action: 'update', targetType: 'hardware', message: '更新硬件产品' },
    'DELETE /api/hardware/:id': { module: 'product', action: 'delete', targetType: 'hardware', message: '删除硬件产品' },
    'GET /api/packages': { module: 'product', action: 'list', targetType: 'package', message: '查询套餐列表' },
    'GET /api/packages/:id': { module: 'product', action: 'detail', targetType: 'package', message: '查看套餐详情' },
    'POST /api/packages': { module: 'product', action: 'create', targetType: 'package', message: '创建套餐' },
    'PUT /api/packages/:id': { module: 'product', action: 'update', targetType: 'package', message: '更新套餐' },
    'DELETE /api/packages/:id': { module: 'product', action: 'delete', targetType: 'package', message: '删除套餐' },
    'GET /api/products': { module: 'product', action: 'list', targetType: 'product', message: '查询产品列表' },
    'GET /api/products/:id': { module: 'product', action: 'detail', targetType: 'product', message: '查看产品详情' },
    'POST /api/products': { module: 'product', action: 'create', targetType: 'product', message: '创建产品' },
    'PUT /api/products/:id': { module: 'product', action: 'update', targetType: 'product', message: '更新产品' },
    'DELETE /api/products/:id': { module: 'product', action: 'delete', targetType: 'product', message: '删除产品' },
    'POST /api/products/batch-publish': { module: 'product', action: 'batch_publish', targetType: 'product', message: '批量发布产品' },
    'GET /api/products/stats': { module: 'product', action: 'list', targetType: 'product_stats', message: '查询产品统计' }
  };
  return configs[key] || buildGenericAutoAuditConfig(req, key, routePath);
}

function buildAutoAuditOptions(req, body, res = null) {
  const config = getAutoAuditConfig(req);
  if (!config || !body || typeof body !== 'object' || body.success === false || (res && res.statusCode >= 400)) {
    return null;
  }

  const auditContext = req.auditContext && typeof req.auditContext === 'object' ? req.auditContext : {};
  const data = body.data !== undefined ? body.data : body.user;
  const dataItem = Array.isArray(data) ? null : data;
  const targetId = auditContext.targetId !== undefined
    ? auditContext.targetId
    : (req.params?.id || req.params?.featureId || dataItem?.id || '');
  const targetName = auditContext.targetName !== undefined
    ? auditContext.targetName
    : resolveAuditTargetName(dataItem, req.query?.type || req.params?.type || '');
  const shouldCaptureAfter = ['create', 'update', 'delete', 'change_status', 'change_password', 'reset_password', 'reset_secret', 'sync_status', 'set_level', 'unbind', 'add_parent', 'rebind', 'secondary_apply', 'approve_secondary', 'reject_secondary', 'approve', 'reject', 'process_pending', 'price_adjust', 'primary_confirm', 'primary_reject', 'batch_publish', 'add_staff', 'import'].includes(config.action);
  const beforePayload = auditContext.before !== undefined ? cloneAuditValue(auditContext.before) : undefined;
  const afterPayload = auditContext.after !== undefined
    ? cloneAuditValue(auditContext.after)
    : (shouldCaptureAfter && config.action !== 'delete' ? cloneAuditValue(dataItem || body) : undefined);
  const changeSummary = buildAuditChangeSummary(beforePayload, afterPayload, req.body || {});
  const naturalMessage = buildAuditNaturalMessage(config, targetName, changeSummary);
  const extraPayload = auditContext.extra !== undefined ? cloneAuditValue(auditContext.extra) : buildAuditQueryExtra(req, body);
  if (changeSummary.lines.length && extraPayload && typeof extraPayload === 'object') {
    extraPayload.changeSummary = changeSummary.lines.join('；');
    extraPayload.changeSummaryLines = changeSummary.lines;
    extraPayload.fieldChanges = changeSummary.fields;
  }

  return {
    module: auditContext.module || config.module,
    action: auditContext.action || config.action,
    targetType: auditContext.targetType || config.targetType,
    targetId,
    targetName,
    result: auditContext.result || 'success',
    message: auditContext.message || naturalMessage || config.message,
    actor: auditContext.actor,
    fallbackUser: auditContext.fallbackUser || (config.module === 'auth' && dataItem && dataItem.id ? dataItem : undefined),
    before: beforePayload,
    after: afterPayload,
    extra: extraPayload
  };
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function toPositiveNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

const WORKLOAD_DELIVERY_TAGS = [
  { value: 'EPP_BASE', label: 'EPP\uff08\u4ec5DLP\u57fa\u7840\uff09' },
  { value: 'SENSITIVE_DATA', label: '\u654f\u611f\u6570\u636e\u68b3\u7406' },
  { value: 'UNIDES', label: 'UniDES' },
  { value: 'UNIAV', label: 'UniAV' },
  { value: 'NXG_NO_DLP', label: 'NXG\uff08\u4e0d\u542bDLP\uff09' },
  { value: 'NXG_WITH_DLP', label: 'NXG\uff08\u542bDLP\uff09' }
];

const WORKLOAD_DELIVERY_TAG_CODE_SET = new Set(WORKLOAD_DELIVERY_TAGS.map(item => item.value));
const WORKLOAD_DELIVERY_TAG_LABELS = WORKLOAD_DELIVERY_TAGS.reduce((map, item) => {
  map[item.value] = item.label;
  return map;
}, {});

const WORKLOAD_DELIVERY_COMPONENTS = [
  { code: 'handoffSurvey', label: '\u4ea4\u63a5+\u8c03\u7814+\u9700\u6c42\u6f84\u6e05+\u9a8c\u6536\u6807\u51c6\u786e\u8ba4' },
  { code: 'acceptanceStandard', label: '\u9a8c\u6536\u6807\u51c6\u786e\u8ba4\uff08500\u70b9\u4ee5\u4e0a\uff09' },
  { code: 'managementDeploy', label: '\u7ba1\u7406\u4e2d\u5fc3\u5b89\u88c5\u90e8\u7f72' },
  { code: 'uniDes', label: 'UniDES\u6587\u6863\u5b89\u5168' },
  { code: 'sensitiveData', label: '\u654f\u611f\u6570\u636e\u68b3\u7406' },
  { code: 'uniAv', label: 'UniAV\u9632\u75c5\u6bd2' },
  { code: 'nxg', label: 'UniNXG\u6446\u6e21\u7cfb\u7edf' },
  { code: 'pilot', label: '\u529f\u80fd\u6d4b\u8bd5+\u8bd5\u70b9\u90e8\u7f72' },
  { code: 'rollout', label: '\u63a8\u5e7f\u90e8\u7f72' },
  { code: 'acceptance', label: '\u9879\u76ee\u9a8c\u6536' }
];

function normalizeWorkloadDeliveryTags(tags = []) {
  const source = Array.isArray(tags) ? tags : [];
  return Array.from(new Set(
    source
      .map(item => String(item || '').trim())
      .filter(item => WORKLOAD_DELIVERY_TAG_CODE_SET.has(item))
  ));
}

function getWorkloadDeliveryTagLabel(tag) {
  return WORKLOAD_DELIVERY_TAG_LABELS[tag] || tag || '';
}

function legacyWorkloadTagsFromValues(productType, sensitiveKeyword) {
  const tags = [];
  if (productType === 'DES') {
    tags.push('UNIDES');
  } else if (productType === 'EPP') {
    tags.push('EPP_BASE');
  } else if (productType === 'NXG') {
    tags.push('NXG_NO_DLP');
  }
  if (sensitiveKeyword) {
    tags.push('SENSITIVE_DATA');
  }
  return normalizeWorkloadDeliveryTags(tags);
}

function deriveLegacyProductTypeFromDeliveryTags(tags = [], fallback = '') {
  const normalizedTags = normalizeWorkloadDeliveryTags(tags);
  if (normalizedTags.includes('UNIDES')) return 'DES';
  if (normalizedTags.includes('NXG_WITH_DLP') || normalizedTags.includes('NXG_NO_DLP')) return 'NXG';
  if (normalizedTags.length) return 'EPP';
  return ['EPP', 'DES', 'NXG'].includes(fallback) ? fallback : '';
}

function roundWorkloadPersonDays(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.round(numericValue * 100) / 100;
}

function getDefaultImplementationWorkloadClassifications() {
  return [
    {
      id: 'IWC-PRODUCT-TYPE',
      code: 'productType',
      name: '产品类型',
      valueType: 'enum',
      options: [
        { value: 'EPP', label: 'EPP' },
        { value: 'DES', label: 'DES' },
        { value: 'NXG', label: 'NXG' }
      ],
      editable: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 'IWC-DELIVERY-TAG',
      code: 'deliveryTags',
      name: '\u4ea4\u4ed8\u5de5\u4f5c\u91cf\u6807\u7b7e',
      valueType: 'multiEnum',
      options: WORKLOAD_DELIVERY_TAGS,
      editable: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 'IWC-SENSITIVE-KEYWORD',
      code: 'sensitiveKeyword',
      name: '敏感关键字',
      valueType: 'boolean',
      options: [
        { value: true, label: '是' },
        { value: false, label: '否' }
      ],
      editable: false,
      createdAt: new Date().toISOString()
    }
  ];
}

function getDefaultImplementationWorkloadRules() {
  const now = new Date().toISOString();
  const buckets = [
    { minPoints: 1, maxPoints: 50, epp: 2.5, eppKeyword: 4.5, des: 4, desKeyword: 6 },
    { minPoints: 51, maxPoints: 100, epp: 4, eppKeyword: 6, des: 5, desKeyword: 7 },
    { minPoints: 101, maxPoints: 200, epp: 5, eppKeyword: 8, des: 7, desKeyword: 10 },
    { minPoints: 201, maxPoints: 500, epp: 8, eppKeyword: 11, des: 12, desKeyword: 15 },
    { minPoints: 501, maxPoints: 1000, epp: 12, eppKeyword: 15, des: 16, desKeyword: 19 },
    { minPoints: 1001, maxPoints: 2000, epp: 18, eppKeyword: 21, des: 21, desKeyword: 24 },
    { minPoints: 2001, maxPoints: null, epp: 18, eppKeyword: 21, des: 21, desKeyword: 24 }
  ];
  const rules = [];
  buckets.forEach((bucket, index) => {
    [
      { productType: 'EPP', sensitiveKeyword: false, personDays: bucket.epp },
      { productType: 'EPP', sensitiveKeyword: true, personDays: bucket.eppKeyword },
      { productType: 'DES', sensitiveKeyword: false, personDays: bucket.des },
      { productType: 'DES', sensitiveKeyword: true, personDays: bucket.desKeyword }
    ].forEach((item, itemIndex) => {
      rules.push({
        id: `IWR-${index + 1}-${itemIndex + 1}`,
        name: `${item.productType} ${bucket.minPoints}-${bucket.maxPoints || '以上'}点${item.sensitiveKeyword ? ' 含敏感关键字' : ''}`,
        minPoints: bucket.minPoints,
        maxPoints: bucket.maxPoints,
        productType: item.productType,
        sensitiveKeyword: item.sensitiveKeyword,
        personDays: item.personDays,
        active: true,
        source: 'seed',
        createdAt: now,
        updatedAt: now
      });
    });
  });
  return rules;
}

function getDefaultDeliveryWorkloadRules() {
  const now = new Date().toISOString();
  return [
    { id: 'V2-EPP-001', deliveryTag: 'EPP_BASE', minPoints: 1, maxPoints: 100, personDays: 2.5, ruleType: 'base', sortOrder: 10, remark: '\u57fa\u7840\u4ea4\u4ed8\u5de5\u4f5c\u91cf' },
    { id: 'V2-EPP-002', deliveryTag: 'EPP_BASE', minPoints: 101, maxPoints: 200, personDays: 4, ruleType: 'base', sortOrder: 11, remark: '\u57fa\u7840\u4ea4\u4ed8\u5de5\u4f5c\u91cf' },
    { id: 'V2-EPP-003', deliveryTag: 'EPP_BASE', minPoints: 201, maxPoints: 500, personDays: 5, ruleType: 'base', sortOrder: 12, remark: '\u57fa\u7840\u4ea4\u4ed8\u5de5\u4f5c\u91cf' },
    { id: 'V2-EPP-004', deliveryTag: 'EPP_BASE', minPoints: 501, maxPoints: 1000, personDays: 8, ruleType: 'base', sortOrder: 13, remark: '\u57fa\u7840\u4ea4\u4ed8\u5de5\u4f5c\u91cf' },
    { id: 'V2-EPP-005', deliveryTag: 'EPP_BASE', minPoints: 1001, maxPoints: 2000, personDays: 12, ruleType: 'base', sortOrder: 14, remark: '\u57fa\u7840\u4ea4\u4ed8\u5de5\u4f5c\u91cf' },
    { id: 'V2-EPP-006', deliveryTag: 'EPP_BASE', minPoints: 2001, maxPoints: 5000, personDays: 18, ruleType: 'base', sortOrder: 15, remark: '\u57fa\u7840\u4ea4\u4ed8\u5de5\u4f5c\u91cf\uff1b\u8d85\u8fc75000\u70b9\u9700\u4eba\u5de5\u8bc4\u4f30' },
    { id: 'V2-SENSITIVE-001', deliveryTag: 'SENSITIVE_DATA', minPoints: 1, maxPoints: 200, personDays: 2, ruleType: 'addon', sortOrder: 20, remark: '\u4ea4\u4ed8\u52a0\u9879' },
    { id: 'V2-SENSITIVE-002', deliveryTag: 'SENSITIVE_DATA', minPoints: 201, maxPoints: 5000, personDays: 3, ruleType: 'addon', sortOrder: 21, remark: '\u4ea4\u4ed8\u52a0\u9879' },
    { id: 'V2-UNIDES-001', deliveryTag: 'UNIDES', minPoints: 1, maxPoints: 200, personDays: 1, ruleType: 'addon', sortOrder: 30, remark: '\u4ea4\u4ed8\u52a0\u9879' },
    { id: 'V2-UNIDES-002', deliveryTag: 'UNIDES', minPoints: 201, maxPoints: 500, personDays: 2, ruleType: 'addon', sortOrder: 31, remark: '\u4ea4\u4ed8\u52a0\u9879' },
    { id: 'V2-UNIDES-003', deliveryTag: 'UNIDES', minPoints: 501, maxPoints: 5000, personDays: 3, ruleType: 'addon', sortOrder: 32, remark: '\u4ea4\u4ed8\u52a0\u9879' },
    { id: 'V2-UNIAV-001', deliveryTag: 'UNIAV', minPoints: 1, maxPoints: 200, personDays: 1, ruleType: 'addon', sortOrder: 40, remark: '\u4ea4\u4ed8\u52a0\u9879' },
    { id: 'V2-UNIAV-002', deliveryTag: 'UNIAV', minPoints: 201, maxPoints: 5000, personDays: 2, ruleType: 'addon', sortOrder: 41, remark: '\u4ea4\u4ed8\u52a0\u9879' },
    { id: 'V2-NXG-NO-DLP', deliveryTag: 'NXG_NO_DLP', minPoints: null, maxPoints: null, personDays: 4, comboPersonDays: 2, ruleType: 'fixed', sortOrder: 50, remark: '\u72ec\u7acb\u9879\u76ee4\u4eba\u5929\uff1b\u7ec4\u5408\u9879\u76ee\u4f5c\u4e3a NXG \u52a0\u9879+2\u4eba\u5929' },
    { id: 'V2-NXG-WITH-DLP', deliveryTag: 'NXG_WITH_DLP', minPoints: null, maxPoints: null, personDays: 8, comboPersonDays: 6, ruleType: 'fixed', sortOrder: 51, remark: '\u72ec\u7acb\u9879\u76ee8\u4eba\u5929\uff1b\u7ec4\u5408\u9879\u76ee\u4f5c\u4e3a NXG \u52a0\u9879+6\u4eba\u5929' }
  ].map(rule => ({
    ...rule,
    item: getWorkloadDeliveryTagLabel(rule.deliveryTag),
    productTypeLabel: getWorkloadDeliveryTagLabel(rule.deliveryTag),
    condition: buildDeliveryWorkloadRuleCondition(rule),
    active: true,
    source: 'seed',
    createdAt: now,
    updatedAt: now
  }));
}

function buildDeliveryWorkloadRuleCondition(rule = {}) {
  if (rule.ruleType === 'fixed') return '\u72ec\u7acb\u9879\u76ee';
  const minPoints = rule.minPoints || 1;
  const maxPoints = rule.maxPoints || 5000;
  return `${minPoints}-${maxPoints}\u70b9`;
}

function normalizeDeliveryWorkloadRule(rule = {}) {
  const deliveryTag = WORKLOAD_DELIVERY_TAG_CODE_SET.has(rule.deliveryTag) ? rule.deliveryTag : '';
  const personDays = Number(rule.personDays);
  const comboPersonDays = Number(rule.comboPersonDays);
  const normalized = {
    ...rule,
    deliveryTag,
    item: rule.item || getWorkloadDeliveryTagLabel(deliveryTag),
    productTypeLabel: rule.productTypeLabel || getWorkloadDeliveryTagLabel(deliveryTag),
    condition: rule.condition || buildDeliveryWorkloadRuleCondition(rule),
    minPoints: rule.minPoints === '' || rule.minPoints === undefined ? null : rule.minPoints,
    maxPoints: rule.maxPoints === '' || rule.maxPoints === undefined ? null : rule.maxPoints,
    personDays: Number.isFinite(personDays) ? roundWorkloadPersonDays(personDays) : 0,
    active: rule.active !== false
  };
  if (Number.isFinite(comboPersonDays)) {
    normalized.comboPersonDays = roundWorkloadPersonDays(comboPersonDays);
  }
  return normalized;
}

function ensureImplementationDeliveryWorkloadRules() {
  let changed = false;
  if (!Array.isArray(db.implementationDeliveryWorkloadRules)) {
    db.implementationDeliveryWorkloadRules = [];
    changed = true;
  }

  const defaults = getDefaultDeliveryWorkloadRules();
  const existingMap = new Map(db.implementationDeliveryWorkloadRules.map(item => [item.id, item]));
  defaults.forEach(defaultRule => {
    const existing = existingMap.get(defaultRule.id);
    if (!existing) {
      db.implementationDeliveryWorkloadRules.push(defaultRule);
      changed = true;
      return;
    }
    const before = JSON.stringify(existing);
    Object.assign(existing, {
      deliveryTag: defaultRule.deliveryTag,
      item: existing.item || defaultRule.item,
      productTypeLabel: existing.productTypeLabel || defaultRule.productTypeLabel,
      ruleType: defaultRule.ruleType,
      sortOrder: defaultRule.sortOrder,
      condition: existing.condition || defaultRule.condition,
      active: existing.active !== false,
      updatedAt: existing.updatedAt || existing.createdAt || new Date().toISOString()
    });
    if (existing.source !== 'manual') {
      Object.assign(existing, {
        minPoints: defaultRule.minPoints,
        maxPoints: defaultRule.maxPoints,
        personDays: defaultRule.personDays,
        comboPersonDays: defaultRule.comboPersonDays,
        remark: defaultRule.remark,
        source: defaultRule.source
      });
    }
    if (JSON.stringify(existing) !== before) {
      changed = true;
    }
  });
  return changed;
}

function getDeliveryWorkloadRules() {
  const list = Array.isArray(db.implementationDeliveryWorkloadRules)
    ? db.implementationDeliveryWorkloadRules
    : [];
  return list
    .map(normalizeDeliveryWorkloadRule)
    .sort((a, b) => {
      const sortDiff = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
      if (sortDiff !== 0) return sortDiff;
      const tagDiff = String(a.deliveryTag || '').localeCompare(String(b.deliveryTag || ''));
      if (tagDiff !== 0) return tagDiff;
      return Number(a.minPoints || 0) - Number(b.minPoints || 0);
    });
}

function findDeliveryWorkloadRule(deliveryTag, endpoints = 0, ruleTypes = []) {
  const ruleTypeSet = new Set(Array.isArray(ruleTypes) ? ruleTypes : []);
  return getDeliveryWorkloadRules().find(rule => {
    if (!rule || rule.active === false) return false;
    if (rule.deliveryTag !== deliveryTag) return false;
    if (ruleTypeSet.size && !ruleTypeSet.has(rule.ruleType)) return false;
    if (rule.ruleType === 'fixed') return true;
    const minPoints = Number(rule.minPoints || 0);
    const maxPoints = rule.maxPoints === null || rule.maxPoints === undefined || rule.maxPoints === '' ? null : Number(rule.maxPoints);
    if (endpoints < minPoints) return false;
    if (maxPoints !== null && Number.isFinite(maxPoints) && endpoints > maxPoints) return false;
    return true;
  }) || null;
}

function getDeliveryWorkloadRulePersonDays(deliveryTag, endpoints, fallback = 0, options = {}) {
  const rule = findDeliveryWorkloadRule(deliveryTag, endpoints, options.ruleTypes);
  if (!rule) return fallback;
  if (options.useComboPersonDays) {
    const comboPersonDays = Number(rule.comboPersonDays);
    if (Number.isFinite(comboPersonDays)) return roundWorkloadPersonDays(comboPersonDays);
  }
  const personDays = Number(rule.personDays);
  return Number.isFinite(personDays) ? roundWorkloadPersonDays(personDays) : fallback;
}

function inferImplementationWorkloadMapping(feature) {
  const module = db.modules.find(item => item.id === feature.moduleId);
  const haystack = [
    feature.name,
    feature.productCode,
    feature.desc,
    module?.name,
    module?.desc
  ].join(' ').toLowerCase();
  const isDes = haystack.includes('des') || haystack.includes('加解密') || haystack.includes('透明');
  const isSensitiveKeyword = haystack.includes('敏感') || haystack.includes('关键字');
  return {
    productType: isDes ? 'DES' : 'EPP',
    sensitiveKeyword: isSensitiveKeyword
  };
}

function ensureImplementationWorkloadClassifications() {
  let changed = false;
  const defaults = getDefaultImplementationWorkloadClassifications();
  if (!Array.isArray(db.implementationWorkloadClassifications)) {
    db.implementationWorkloadClassifications = [];
    changed = true;
  }
  defaults.forEach(defaultItem => {
    const existing = db.implementationWorkloadClassifications.find(item => item.id === defaultItem.id || item.code === defaultItem.code);
    if (!existing) {
      db.implementationWorkloadClassifications.push(defaultItem);
      changed = true;
      return;
    }
    const before = JSON.stringify(existing);
    Object.assign(existing, {
      code: defaultItem.code,
      name: defaultItem.name || existing.name,
      valueType: defaultItem.valueType,
      options: defaultItem.options,
      editable: defaultItem.editable
    });
    if (JSON.stringify(existing) !== before) {
      changed = true;
    }
  });
  return changed;
}

function inferImplementationWorkloadMapping(feature = {}) {
  const isHardware = String(feature.id || '').startsWith('HW-') || feature.itemType === 'hardware';
  const module = db.modules.find(item => item.id === feature.moduleId);
  const category = module ? db.categories.find(item => item.id === module.categoryId) : null;
  const haystack = [
    feature.name,
    feature.productCode,
    feature.model,
    feature.specs,
    feature.desc,
    module?.name,
    module?.desc,
    category?.name
  ].join(' ').toLowerCase();
  const noDlpPattern = /\u4e0d\s*\u542b\s*dlp|without\s*dlp|no\s*dlp|non[-\s]*dlp/i;
  const hasNxg = /nxg|unixng|\u6446\u6e21|\u6570\u636e\u6446\u6e21/i.test(haystack);
  const hasNoDlp = noDlpPattern.test(haystack);
  const hasWithDlp = hasNxg && !hasNoDlp && (/\u542b\s*dlp|with\s*dlp|dlp/i.test(haystack));
  const hasUniDes = !hasNxg && (
    haystack.includes('unides')
    || haystack.includes('des')
    || haystack.includes('\u52a0\u89e3\u5bc6')
    || haystack.includes('\u900f\u660e')
  );
  const hasUniAv = !hasNxg && (
    haystack.includes('uniav')
    || haystack.includes('uedr-av')
    || haystack.includes('edr')
    || haystack.includes('\u9632\u75c5\u6bd2')
    || haystack.includes('\u6740\u6bd2')
  );
  const hasSensitiveData = !hasNxg && (
    haystack.includes('\u654f\u611f')
    || haystack.includes('\u5173\u952e\u5b57')
    || haystack.includes('\u6570\u636e\u68b3\u7406')
  );

  let deliveryTags = [];
  if (hasNxg) {
    deliveryTags = [hasWithDlp ? 'NXG_WITH_DLP' : 'NXG_NO_DLP'];
  } else if (hasUniDes) {
    deliveryTags = ['UNIDES'];
  } else if (hasUniAv) {
    deliveryTags = ['UNIAV'];
  } else if (hasSensitiveData) {
    deliveryTags = ['SENSITIVE_DATA'];
  } else if (isHardware) {
    deliveryTags = [];
  } else {
    deliveryTags = ['EPP_BASE'];
  }

  return {
    productType: deriveLegacyProductTypeFromDeliveryTags(deliveryTags),
    sensitiveKeyword: deliveryTags.includes('SENSITIVE_DATA'),
    deliveryTags
  };
}

function getImplementationWorkloadMappingTags(mapping = {}, feature = null) {
  const configuredTags = normalizeWorkloadDeliveryTags(mapping.deliveryTags);
  if (configuredTags.length) return configuredTags;
  const inferred = feature ? inferImplementationWorkloadMapping(feature) : { deliveryTags: [] };
  const inferredTags = normalizeWorkloadDeliveryTags(inferred.deliveryTags);
  const hasSpecificInferredTag = inferredTags.some(tag => tag !== 'EPP_BASE');
  if (hasSpecificInferredTag) return inferredTags;
  return normalizeWorkloadDeliveryTags([
    ...legacyWorkloadTagsFromValues(mapping.productType, mapping.sensitiveKeyword),
    ...inferredTags
  ]);
}

function buildImplementationWorkloadCatalogItems() {
  const featureItems = (db.features || []).map(feature => {
    const module = db.modules.find(item => item.id === feature.moduleId);
    const category = module ? db.categories.find(item => item.id === module.categoryId) : null;
    return {
      itemType: 'feature',
      id: feature.id,
      name: feature.name || feature.id,
      moduleId: feature.moduleId || '',
      moduleName: module?.name || '',
      categoryId: category?.id || '',
      categoryName: category?.name || '',
      productCode: feature.productCode || '',
      source: feature
    };
  });
  const hardwareItems = (db.hardwareProducts || []).map(hardware => ({
    itemType: 'hardware',
    id: hardware.id,
    name: hardware.name || hardware.model || hardware.id,
    moduleId: '',
    moduleName: '\u786c\u4ef6\u4ea7\u54c1',
    categoryId: hardware.categoryId || 'CAT-HW',
    categoryName: '\u786c\u4ef6\u4ea7\u54c1',
    productCode: hardware.productCode || hardware.model || '',
    source: { ...hardware, itemType: 'hardware', productCode: hardware.productCode || hardware.model || '' }
  }));
  return [...featureItems, ...hardwareItems];
}

function ensureImplementationWorkloadData() {
  let changed = false;

  if (!Array.isArray(db.implementationWorkloadClassifications)) {
    db.implementationWorkloadClassifications = [];
    changed = true;
  }
  if (!Array.isArray(db.implementationWorkloadMappings)) {
    db.implementationWorkloadMappings = [];
    changed = true;
  }
  if (!Array.isArray(db.implementationWorkloadRules)) {
    db.implementationWorkloadRules = [];
    changed = true;
  }
  if (!Array.isArray(db.implementationDeliveryWorkloadRules)) {
    db.implementationDeliveryWorkloadRules = [];
    changed = true;
  }

  if (ensureImplementationWorkloadClassifications()) {
    changed = true;
  }

  if (!db.implementationWorkloadRules.length) {
    db.implementationWorkloadRules = getDefaultImplementationWorkloadRules();
    changed = true;
  }
  if (ensureImplementationDeliveryWorkloadRules()) {
    changed = true;
  }

  const catalogItems = buildImplementationWorkloadCatalogItems();
  const catalogIds = new Set(catalogItems.map(item => item.id));
  const originalMappingCount = db.implementationWorkloadMappings.length;
  db.implementationWorkloadMappings = db.implementationWorkloadMappings.filter(item => item && catalogIds.has(item.featureId));
  if (db.implementationWorkloadMappings.length !== originalMappingCount) {
    changed = true;
  }
  const existingMap = new Map(db.implementationWorkloadMappings.map(item => [item.featureId, item]));

  catalogItems.forEach(catalogItem => {
    const inferred = inferImplementationWorkloadMapping(catalogItem.source);
    if (existingMap.has(catalogItem.id)) {
      const existing = existingMap.get(catalogItem.id);
      const before = JSON.stringify(existing);
      const deliveryTags = getImplementationWorkloadMappingTags(existing, catalogItem.source);
      Object.assign(existing, {
        itemType: catalogItem.itemType,
        featureName: catalogItem.name,
        moduleId: catalogItem.moduleId,
        moduleName: catalogItem.moduleName,
        productCode: catalogItem.productCode,
        productType: deriveLegacyProductTypeFromDeliveryTags(deliveryTags, existing.productType),
        sensitiveKeyword: deliveryTags.includes('SENSITIVE_DATA') || Boolean(existing.sensitiveKeyword),
        deliveryTags,
        active: existing.active !== false,
        updatedAt: existing.updatedAt || existing.createdAt || new Date().toISOString()
      });
      if (JSON.stringify(existing) !== before) {
        changed = true;
      }
      return;
    }
    db.implementationWorkloadMappings.push({
      id: `IWM-${catalogItem.id}`,
      itemType: catalogItem.itemType,
      featureId: catalogItem.id,
      featureName: catalogItem.name,
      moduleId: catalogItem.moduleId,
      moduleName: catalogItem.moduleName,
      productCode: catalogItem.productCode,
      productType: inferred.productType,
      sensitiveKeyword: inferred.sensitiveKeyword,
      deliveryTags: inferred.deliveryTags,
      source: 'seed',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    changed = true;
  });

  if (changed) {
    saveData();
  }
}

const PACKAGE_COMPATIBILITY_FIX_NAMES = new Set([
  '基础版套餐',
  '专业版套餐',
  '企业版套餐',
  'XCAD 国产化套餐',
  '无界办公',
  '山东方式地方'
]);

function uniqAuditCompatibleIds(list = []) {
  return Array.from(new Set((Array.isArray(list) ? list : []).filter(Boolean)));
}

function buildLegacyPackageFeatureIdMap() {
  const featureIdSet = new Set((db.features || []).map(item => item.id));
  const map = {
    'FEAT-LEP-0101': 'FEAT-MOD-LEP-01-01',
    'FEAT-LEP-0201': 'FEAT-MOD-LEP-02-01',
    'FEAT-LEP-0202': 'FEAT-MOD-LEP-02-02',
    'FEAT-LEP-0203': 'FEAT-MOD-LEP-02-03',
    'FEAT-LEP-0301': 'FEAT-MOD-LEP-03-01',
    'FEAT-LEP-0302': 'FEAT-MOD-LEP-03-02',
    'FEAT-LEP-0401': 'FEAT-MOD-LEP-04-01',
    'FEAT-LEP-0501': 'FEAT-MOD-LEP-01-05',
    'FEAT-LEP-0601': 'FEAT-MOD-LEP-01-06',
    'FEAT-LEP-0701': 'FEAT-MOD-LEP-01-07'
  };

  const xcadBaseModule = (db.modules || []).find(item => /数字化安全基座|安全基座/i.test(item.name || ''));
  const xcadDomainModule = (db.modules || []).find(item => /xcad|域管/i.test(item.name || ''));
  const sortByCreatedAt = (a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id || '').localeCompare(String(b.id || ''));
  const xcadBaseFeatures = (db.features || []).filter(item => item.moduleId === xcadBaseModule?.id).sort(sortByCreatedAt);
  const xcadDomainFeatures = (db.features || []).filter(item => item.moduleId === xcadDomainModule?.id).sort(sortByCreatedAt);

  if (xcadBaseFeatures[0]) map['FEAT-XCAD-0101'] = xcadBaseFeatures[0].id;
  if (xcadBaseFeatures[1]) map['FEAT-XCAD-0102'] = xcadBaseFeatures[1].id;
  if (xcadDomainFeatures[0]) map['FEAT-XCAD-0201'] = xcadDomainFeatures[0].id;
  if (xcadDomainFeatures[1]) map['FEAT-XCAD-0202'] = xcadDomainFeatures[1].id;

  Object.keys(map).forEach(key => {
    if (!featureIdSet.has(map[key])) {
      delete map[key];
    }
  });

  return map;
}

function ensurePackageCompatibilityData() {
  if (!Array.isArray(db.packages) || !db.packages.length) return;

  const legacyFeatureMap = buildLegacyPackageFeatureIdMap();
  const featureById = new Map([
    ...(db.features || []).map(item => [item.id, item]),
    ...(db.hardwareProducts || []).map(item => [item.id, { ...item, itemType: 'hardware', productCode: item.productCode || item.model || '' }])
  ]);
  const moduleIdSet = new Set((db.modules || []).map(item => item.id));
  let changed = false;

  db.packages = db.packages.map(pkg => {
    if (!pkg || typeof pkg !== 'object') return pkg;

    const originalFeatureIds = Array.isArray(pkg.featureIds) ? pkg.featureIds.filter(Boolean) : [];
    const originalModuleIds = Array.isArray(pkg.moduleIds) ? pkg.moduleIds.filter(Boolean) : [];
    const hasLegacyFeatureIds = originalFeatureIds.some(id => legacyFeatureMap[id]);
    const shouldFix = PACKAGE_COMPATIBILITY_FIX_NAMES.has(pkg.name) || hasLegacyFeatureIds;

    if (!shouldFix) {
      return pkg;
    }

    let nextFeatureIds = uniqAuditCompatibleIds(
      originalFeatureIds.map(id => {
        if (featureById.has(id)) return id;
        return legacyFeatureMap[id] || '';
      })
    );

    if (pkg.name === '无界办公' && !nextFeatureIds.length) {
      nextFeatureIds = uniqAuditCompatibleIds(
        (db.features || [])
          .filter(item => originalModuleIds.includes(item.moduleId))
          .map(item => item.id)
      );
    }

    if (pkg.name === 'XCAD 国产化套餐' && !nextFeatureIds.length) {
      nextFeatureIds = uniqAuditCompatibleIds(
        Object.keys(legacyFeatureMap)
          .filter(key => key.startsWith('FEAT-XCAD-'))
          .map(key => legacyFeatureMap[key])
      );
    }

    const nextModuleIds = uniqAuditCompatibleIds([
      ...originalModuleIds.filter(id => moduleIdSet.has(id)),
      ...nextFeatureIds.map(id => featureById.get(id)?.moduleId || '')
    ]);

    const featureChanged = JSON.stringify(nextFeatureIds) !== JSON.stringify(originalFeatureIds);
    const moduleChanged = JSON.stringify(nextModuleIds) !== JSON.stringify(originalModuleIds);

    if (!featureChanged && !moduleChanged) {
      return pkg;
    }

    changed = true;
    return {
      ...pkg,
      featureIds: nextFeatureIds,
      moduleIds: nextModuleIds,
      updatedAt: new Date().toISOString()
    };
  });

  if (changed) {
    saveData();
  }
}

function buildImplementationWorkloadFeatureIds(payload = {}) {
  const productIds = Array.isArray(payload.products) ? payload.products : [];
  const hardwareIds = Array.isArray(payload.hardwareIds) ? payload.hardwareIds : [];
  return Array.from(new Set([...productIds, ...hardwareIds].filter(Boolean)));
}

function buildImplementationWorkloadSuggestion(payload = {}) {
  const featureIds = buildImplementationWorkloadFeatureIds(payload);
  const endpoints = toPositiveNumber(payload.endpoints, 0);
  const selectedMappings = db.implementationWorkloadMappings
    .filter(item => item && item.active !== false && featureIds.includes(item.featureId));

  const hasDes = selectedMappings.some(item => item.productType === 'DES');
  const hasEpp = selectedMappings.some(item => item.productType === 'EPP');
  const productType = hasDes ? 'DES' : (hasEpp ? 'EPP' : '');
  const matchedNames = selectedMappings.map(item => item.featureName).filter(Boolean);
  const keywordFromMapping = selectedMappings.some(item => item.sensitiveKeyword === true);
  const hasSensitiveKeywordWorkload = Boolean(payload.hasSensitiveKeywordWorkload) || keywordFromMapping;

  const rule = db.implementationWorkloadRules.find(item => {
    if (!item || item.active === false) return false;
    if (item.productType !== productType) return false;
    if (Boolean(item.sensitiveKeyword) !== hasSensitiveKeywordWorkload) return false;
    if (endpoints < Number(item.minPoints || 0)) return false;
    if (item.maxPoints !== null && item.maxPoints !== undefined && item.maxPoints !== '' && endpoints > Number(item.maxPoints)) return false;
    return true;
  }) || null;

  const unresolvedFeatureIds = featureIds.filter(featureId => !selectedMappings.some(item => item.featureId === featureId));
  const canSuggest = Boolean(productType) && endpoints > 0 && Boolean(rule);
  const pointLabel = rule
    ? `${rule.minPoints}-${rule.maxPoints || '以上'}点`
    : `${endpoints}点`;

  return {
    available: canSuggest,
    featureIds,
    endpoints,
    productType,
    hasSensitiveKeywordWorkload,
    standardPersonDays: canSuggest ? Number(rule.personDays) : null,
    workloadRuleId: rule?.id || '',
    workloadRuleName: rule?.name || '',
    workloadClassifications: {
      productType,
      sensitiveKeyword: hasSensitiveKeywordWorkload,
      matchedFeatureIds: selectedMappings.map(item => item.featureId),
      matchedFeatureNames: matchedNames
    },
    workloadSummary: canSuggest
      ? `${productType} ${pointLabel}${hasSensitiveKeywordWorkload ? '，含敏感关键字' : ''}，建议 ${rule.personDays} 人天`
      : (productType ? '未匹配到标准工作量规则' : '请先配置产品类型映射'),
    workloadSnapshot: {
      endpoints,
      pointLabel,
      selectedFeatureIds: featureIds,
      matchedMappings: selectedMappings.map(item => ({
        featureId: item.featureId,
        featureName: item.featureName,
        productType: item.productType,
        sensitiveKeyword: Boolean(item.sensitiveKeyword)
      })),
      unresolvedFeatureIds
    },
    workloadCalculatedAt: new Date().toISOString()
  };
}

function getDeliveryWorkloadPointLabel(endpoints) {
  if (endpoints <= 100) return '1-100\u70b9';
  if (endpoints <= 200) return '101-200\u70b9';
  if (endpoints <= 500) return '201-500\u70b9';
  if (endpoints <= 1000) return '501-1000\u70b9';
  if (endpoints <= 2000) return '1001-2000\u70b9';
  if (endpoints <= 5000) return '2001-5000\u70b9';
  return `${endpoints}\u70b9`;
}

function resolveDeliveryWorkloadProductType(tags = []) {
  const tagSet = new Set(normalizeWorkloadDeliveryTags(tags));
  const hasNxg = tagSet.has('NXG_WITH_DLP') || tagSet.has('NXG_NO_DLP');
  const hasNonNxg = ['EPP_BASE', 'SENSITIVE_DATA', 'UNIDES', 'UNIAV'].some(tag => tagSet.has(tag));
  if (hasNxg && hasNonNxg) return '\u7ec4\u5408\u4ea4\u4ed8';
  if (tagSet.has('NXG_WITH_DLP')) return getWorkloadDeliveryTagLabel('NXG_WITH_DLP');
  if (tagSet.has('NXG_NO_DLP')) return getWorkloadDeliveryTagLabel('NXG_NO_DLP');
  if (tagSet.has('UNIDES')) return 'DES';
  if (hasNonNxg) return 'EPP';
  return '';
}

function calculateDeliveryWorkload(tags = [], endpoints = 0) {
  const normalizedTags = normalizeWorkloadDeliveryTags(tags);
  const tagSet = new Set(normalizedTags);
  const hasNxgWithDlp = tagSet.has('NXG_WITH_DLP');
  const hasNxgNoDlp = tagSet.has('NXG_NO_DLP');
  const hasNxg = hasNxgWithDlp || hasNxgNoDlp;
  const hasUniDes = tagSet.has('UNIDES');
  const hasSensitiveData = tagSet.has('SENSITIVE_DATA');
  const hasUniAv = tagSet.has('UNIAV');
  const hasNonNxg = ['EPP_BASE', 'SENSITIVE_DATA', 'UNIDES', 'UNIAV'].some(tag => tagSet.has(tag));
  const onlyNxg = hasNxg && !hasNonNxg;

  if (!normalizedTags.length) {
    return {
      available: false,
      reason: '\u8bf7\u5148\u914d\u7f6e\u4ea4\u4ed8\u5de5\u4f5c\u91cf\u6807\u7b7e',
      personDays: null,
      breakdown: [],
      unsupported: false
    };
  }
  if (!onlyNxg && endpoints > 5000) {
    return {
      available: false,
      reason: '\u8d85\u8fc75000\u70b9\u9700\u4eba\u5de5\u8bc4\u4f30',
      personDays: null,
      breakdown: [],
      unsupported: true
    };
  }

  const defaultAddons = {
    uniDes: hasUniDes ? (endpoints <= 200 ? 1 : (endpoints <= 500 ? 2 : (endpoints <= 5000 ? 3 : 0))) : 0,
    sensitiveData: hasSensitiveData ? (endpoints <= 200 ? 2 : (endpoints <= 5000 ? 3 : 0)) : 0,
    uniAv: hasUniAv ? (endpoints <= 200 ? 1 : (endpoints <= 5000 ? 2 : 0)) : 0,
    nxgCombo: hasNxgWithDlp ? 6 : (hasNxgNoDlp ? 2 : 0),
    nxgStandalone: hasNxgWithDlp ? 8 : (hasNxgNoDlp ? 4 : 0)
  };

  const values = {
    handoffSurvey: !hasNxg
      ? (endpoints <= 500 ? 0.25 : (endpoints <= 2000 ? 0.5 : (endpoints <= 5000 ? 1 : 0)))
      : (hasNonNxg ? (endpoints <= 500 ? 0.75 : (endpoints <= 2000 ? 1 : (endpoints <= 5000 ? 1.5 : 0))) : 0.5),
    acceptanceStandard: onlyNxg ? 0 : (endpoints <= 500 ? 0 : (endpoints <= 5000 ? 0.5 : 0)),
    managementDeploy: !hasNxg
      ? (endpoints <= 2000 ? 0.5 : (endpoints <= 5000 ? 1 : 0))
      : (hasNonNxg ? (endpoints <= 2000 ? 1.5 : (endpoints <= 5000 ? 2 : 0)) : 1),
    uniDes: hasUniDes ? getDeliveryWorkloadRulePersonDays('UNIDES', endpoints, defaultAddons.uniDes, { ruleTypes: ['addon'] }) : 0,
    sensitiveData: hasSensitiveData ? getDeliveryWorkloadRulePersonDays('SENSITIVE_DATA', endpoints, defaultAddons.sensitiveData, { ruleTypes: ['addon'] }) : 0,
    uniAv: hasUniAv ? getDeliveryWorkloadRulePersonDays('UNIAV', endpoints, defaultAddons.uniAv, { ruleTypes: ['addon'] }) : 0,
    nxg: hasNxg
      ? getDeliveryWorkloadRulePersonDays(
        hasNxgWithDlp ? 'NXG_WITH_DLP' : 'NXG_NO_DLP',
        endpoints,
        onlyNxg ? defaultAddons.nxgStandalone : defaultAddons.nxgCombo,
        { ruleTypes: ['fixed'], useComboPersonDays: !onlyNxg }
      )
      : 0,
    pilot: onlyNxg
      ? 0
      : (endpoints <= 100 ? (hasUniDes ? 2 : 1.5) : (endpoints > 2000 ? 3 : ((endpoints > 500 && hasUniDes) ? 3 : 2))),
    rollout: onlyNxg
      ? 0
      : (endpoints <= 100 ? 0 : (endpoints <= 200 ? 1 : (endpoints <= 500 ? 2 : (endpoints <= 1000 ? 4 : (endpoints <= 2000 ? 8 : (endpoints <= 5000 ? 12 : 0)))))),
    acceptance: !hasNxg
      ? (endpoints <= 500 ? 0.25 : (endpoints <= 5000 ? 0.5 : 0))
      : (hasNonNxg ? (endpoints <= 500 ? 0.75 : (endpoints <= 5000 ? 1 : 0)) : 0.5)
  };

  if (onlyNxg) {
    const fixedBaseDays = roundWorkloadPersonDays(values.handoffSurvey + values.managementDeploy + values.acceptance);
    values.nxg = roundWorkloadPersonDays(Math.max(0, values.nxg - fixedBaseDays));
  }

  if (!hasNxg && hasNonNxg) {
    const baseComponentCodes = ['handoffSurvey', 'acceptanceStandard', 'managementDeploy', 'pilot', 'rollout', 'acceptance'];
    const defaultBaseTotal = roundWorkloadPersonDays(baseComponentCodes.reduce((sum, code) => sum + (values[code] || 0), 0));
    const configuredBaseTotal = getDeliveryWorkloadRulePersonDays('EPP_BASE', endpoints, defaultBaseTotal, { ruleTypes: ['base'] });
    const baseDiff = roundWorkloadPersonDays(configuredBaseTotal - defaultBaseTotal);
    if (baseDiff) {
      values.rollout = roundWorkloadPersonDays(Math.max(0, values.rollout + baseDiff));
    }
  }

  const breakdown = WORKLOAD_DELIVERY_COMPONENTS.map(component => ({
    code: component.code,
    name: component.label,
    personDays: roundWorkloadPersonDays(values[component.code] || 0)
  }));
  const personDays = roundWorkloadPersonDays(breakdown.reduce((sum, item) => sum + item.personDays, 0));

  return {
    available: personDays > 0,
    reason: personDays > 0 ? '' : '\u672a\u5339\u914d\u5230\u6807\u51c6\u5de5\u4f5c\u91cf\u89c4\u5219',
    personDays,
    breakdown,
    unsupported: false,
    flags: {
      hasNxg,
      hasNonNxg,
      onlyNxg,
      hasUniDes,
      hasSensitiveData,
      hasUniAv
    }
  };
}

function getDeliveryWorkloadRuleRows() {
  return getDeliveryWorkloadRules();
  return [
    { id: 'V2-EPP-001', item: 'EPP\uff08\u4ec5DLP\u57fa\u7840\uff09', condition: '1-100\u70b9', personDays: 2.5, remark: '\u57fa\u7840\u4ea4\u4ed8\u5de5\u4f5c\u91cf' },
    { id: 'V2-EPP-002', item: 'EPP\uff08\u4ec5DLP\u57fa\u7840\uff09', condition: '101-200\u70b9', personDays: 4, remark: '\u57fa\u7840\u4ea4\u4ed8\u5de5\u4f5c\u91cf' },
    { id: 'V2-EPP-003', item: 'EPP\uff08\u4ec5DLP\u57fa\u7840\uff09', condition: '201-500\u70b9', personDays: 5, remark: '\u57fa\u7840\u4ea4\u4ed8\u5de5\u4f5c\u91cf' },
    { id: 'V2-EPP-004', item: 'EPP\uff08\u4ec5DLP\u57fa\u7840\uff09', condition: '501-1000\u70b9', personDays: 8, remark: '\u57fa\u7840\u4ea4\u4ed8\u5de5\u4f5c\u91cf' },
    { id: 'V2-EPP-005', item: 'EPP\uff08\u4ec5DLP\u57fa\u7840\uff09', condition: '1001-2000\u70b9', personDays: 12, remark: '\u57fa\u7840\u4ea4\u4ed8\u5de5\u4f5c\u91cf' },
    { id: 'V2-EPP-006', item: 'EPP\uff08\u4ec5DLP\u57fa\u7840\uff09', condition: '2001-5000\u70b9', personDays: 18, remark: '\u57fa\u7840\u4ea4\u4ed8\u5de5\u4f5c\u91cf\uff1b\u8d85\u8fc75000\u70b9\u9700\u4eba\u5de5\u8bc4\u4f30' },
    { id: 'V2-SENSITIVE-001', item: '\u654f\u611f\u6570\u636e\u68b3\u7406', condition: '1-200\u70b9', personDays: 2, remark: '\u4ea4\u4ed8\u52a0\u9879' },
    { id: 'V2-SENSITIVE-002', item: '\u654f\u611f\u6570\u636e\u68b3\u7406', condition: '201-5000\u70b9', personDays: 3, remark: '\u4ea4\u4ed8\u52a0\u9879' },
    { id: 'V2-UNIDES-001', item: 'UniDES', condition: '1-200\u70b9', personDays: 1, remark: '\u4ea4\u4ed8\u52a0\u9879' },
    { id: 'V2-UNIDES-002', item: 'UniDES', condition: '201-500\u70b9', personDays: 2, remark: '\u4ea4\u4ed8\u52a0\u9879' },
    { id: 'V2-UNIDES-003', item: 'UniDES', condition: '501-5000\u70b9', personDays: 3, remark: '\u4ea4\u4ed8\u52a0\u9879' },
    { id: 'V2-UNIAV-001', item: 'UniAV', condition: '1-200\u70b9', personDays: 1, remark: '\u4ea4\u4ed8\u52a0\u9879' },
    { id: 'V2-UNIAV-002', item: 'UniAV', condition: '201-5000\u70b9', personDays: 2, remark: '\u4ea4\u4ed8\u52a0\u9879' },
    { id: 'V2-NXG-NO-DLP', item: 'NXG\uff08\u4e0d\u542bDLP\uff09', condition: '\u72ec\u7acb\u9879\u76ee', personDays: 4, remark: '\u7ec4\u5408\u9879\u76ee\u65f6\u4f5c\u4e3a NXG \u52a0\u9879 +2 \u5e76\u53e0\u52a0\u7ec4\u5408\u57fa\u7840\u5de5\u4f5c\u91cf' },
    { id: 'V2-NXG-WITH-DLP', item: 'NXG\uff08\u542bDLP\uff09', condition: '\u72ec\u7acb\u9879\u76ee', personDays: 8, remark: '\u7ec4\u5408\u9879\u76ee\u65f6\u4f5c\u4e3a NXG \u52a0\u9879 +6 \u5e76\u53e0\u52a0\u7ec4\u5408\u57fa\u7840\u5de5\u4f5c\u91cf' }
  ];
}

function buildImplementationWorkloadSuggestion(payload = {}) {
  const featureIds = buildImplementationWorkloadFeatureIds(payload);
  const endpoints = toPositiveNumber(payload.endpoints, 0);
  const selectedMappings = db.implementationWorkloadMappings
    .filter(item => item && item.active !== false && featureIds.includes(item.featureId));
  const featureById = new Map((db.features || []).map(item => [item.id, item]));
  const mappingDetails = selectedMappings.map(item => {
    const feature = featureById.get(item.featureId);
    const deliveryTags = getImplementationWorkloadMappingTags(item, feature);
    return {
      mapping: item,
      deliveryTags
    };
  });
  const deliveryTags = normalizeWorkloadDeliveryTags([
    ...mappingDetails.flatMap(item => item.deliveryTags),
    ...(payload.hasSensitiveKeywordWorkload ? ['SENSITIVE_DATA'] : [])
  ]);
  const calculation = calculateDeliveryWorkload(deliveryTags, endpoints);
  const productType = resolveDeliveryWorkloadProductType(deliveryTags);
  const matchedNames = selectedMappings.map(item => item.featureName).filter(Boolean);
  const selectedTagLabels = deliveryTags.map(getWorkloadDeliveryTagLabel).filter(Boolean);
  const unresolvedFeatureIds = featureIds.filter(featureId => !selectedMappings.some(item => item.featureId === featureId));
  const untaggedFeatureIds = mappingDetails
    .filter(item => !item.deliveryTags.length)
    .map(item => item.mapping.featureId);
  const canSuggest = Boolean(productType) && endpoints > 0 && calculation.available;
  const pointLabel = getDeliveryWorkloadPointLabel(endpoints);
  const summaryTags = selectedTagLabels.length ? `\uff0c${selectedTagLabels.join('\u3001')}` : '';
  const workloadSummary = canSuggest
    ? `${productType} ${pointLabel}${summaryTags}\uff0c\u5efa\u8bae ${calculation.personDays} \u4eba\u5929`
    : (calculation.reason || (productType ? '\u672a\u5339\u914d\u5230\u6807\u51c6\u5de5\u4f5c\u91cf\u89c4\u5219' : '\u8bf7\u5148\u914d\u7f6e\u4ea4\u4ed8\u5de5\u4f5c\u91cf\u6807\u7b7e'));

  return {
    available: canSuggest,
    featureIds,
    endpoints,
    workloadEndpoints: endpoints,
    productType,
    deliveryTags,
    deliveryTagLabels: selectedTagLabels,
    hasSensitiveKeywordWorkload: deliveryTags.includes('SENSITIVE_DATA'),
    standardPersonDays: canSuggest ? calculation.personDays : null,
    workloadRuleId: 'LEP-DELIVERY-20260612',
    workloadRuleName: 'LEP delivery workload 20260612',
    workloadClassifications: {
      productType,
      sensitiveKeyword: deliveryTags.includes('SENSITIVE_DATA'),
      deliveryTags,
      deliveryTagLabels: selectedTagLabels,
      matchedFeatureIds: selectedMappings.map(item => item.featureId),
      matchedFeatureNames: matchedNames
    },
    workloadSummary,
    workloadBreakdown: calculation.breakdown,
    workloadSnapshot: {
      model: 'LEP_DELIVERY_20260612',
      endpoints,
      pointLabel,
      selectedFeatureIds: featureIds,
      selectedDeliveryTags: deliveryTags,
      selectedDeliveryTagLabels: selectedTagLabels,
      flags: calculation.flags || {},
      breakdown: calculation.breakdown,
      matchedMappings: mappingDetails.map(item => ({
        featureId: item.mapping.featureId,
        featureName: item.mapping.featureName,
        productType: item.mapping.productType,
        sensitiveKeyword: Boolean(item.mapping.sensitiveKeyword),
        deliveryTags: item.deliveryTags,
        deliveryTagLabels: item.deliveryTags.map(getWorkloadDeliveryTagLabel)
      })),
      unresolvedFeatureIds,
      untaggedFeatureIds
    },
    workloadCalculatedAt: new Date().toISOString()
  };
}

function applyQuoteWorkloadFields(target, payload) {
  const suggestion = buildImplementationWorkloadSuggestion(payload);
  Object.assign(target, {
    hasSensitiveKeywordWorkload: suggestion.hasSensitiveKeywordWorkload,
    standardPersonDays: suggestion.standardPersonDays,
    workloadRuleId: suggestion.workloadRuleId,
    workloadRuleName: suggestion.workloadRuleName,
    workloadClassifications: suggestion.workloadClassifications,
    workloadSummary: suggestion.workloadSummary,
    workloadBreakdown: suggestion.workloadBreakdown,
    workloadSnapshot: suggestion.workloadSnapshot,
    workloadCalculatedAt: suggestion.workloadCalculatedAt
  });
  return suggestion;
}

const IAM_H5_SSO_CONFIG = {
  enabled: (process.env.IAM_H5_SSO_ENABLED || 'true') === 'true',
  validateUrl: process.env.IAM_H5_SSO_VALIDATE_URL || 'http://10.10.2.62:8192/emm-cgi/oidc/getUserFromSsoToken',
  isaid: process.env.IAM_H5_SSO_ISAID || 'QudaoCrm123',
  timeoutMs: Number(process.env.IAM_H5_SSO_TIMEOUT || 8000)
};

const IAM_H5_SSO_ERROR_MAP = {
  6010: '当前设备待审核，暂无法登录',
  6005: 'IAM 用户不存在',
  6035: '单点凭证已过期，请从 IAM 入口重新进入',
  6036: 'IAM 用户已离职，禁止登录',
  6041: 'IAM 用户已被禁用，禁止登录',
  6042: '单点凭证无效，请重新发起登录',
  6048: 'IAM 用户设备未绑定',
  6610: '当前设备在黑名单中，无法登录',
  8095: 'IAM 认证服务异常，请稍后重试'
};

function buildAppToken(prefix = 'token') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

async function validateIamH5SsoToken(ssoToken) {
  const requestUrl = new URL(IAM_H5_SSO_CONFIG.validateUrl);
  requestUrl.searchParams.set('isaid', IAM_H5_SSO_CONFIG.isaid);
  requestUrl.searchParams.set('sso_token', ssoToken);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IAM_H5_SSO_CONFIG.timeoutMs);

  try {
    console.log('[IAM-SSO] request url:', requestUrl.toString());
    const response = await fetch(requestUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    console.log('[IAM-SSO] IAM http status:', response.status, response.statusText);

    const rawText = await response.text();
    console.log('[IAM-SSO] IAM raw response:', rawText.slice(0, 500));

    let payload = null;
    try {
      payload = JSON.parse(rawText);
    } catch (err) {
      console.log('[IAM-SSO] JSON parse failed:', err.message);
      throw new Error('IAM 返回数据格式异常');
    }

    if (!payload || payload.status !== 2000) {
      const statusCode = Number(payload?.status || 8095);
      console.log('[IAM-SSO] IAM business status:', statusCode, payload?.msg || '');
      return {
        success: false,
        status: statusCode,
        error: IAM_H5_SSO_ERROR_MAP[statusCode] || payload?.msg || 'IAM 验证失败'
      };
    }

    const mailuser = payload.data?.mailuser || {};
    const tokeninfo = payload.data?.tokeninfo || {};
    const username = normalizeUsername(mailuser.username);
    if (!username) {
      console.log('[IAM-SSO] IAM success payload missing username');
      return { success: false, status: 8095, error: 'IAM 返回缺少 username' };
    }

    console.log('[IAM-SSO] IAM success payload parsed for username:', username);
    return {
      success: true,
      status: 2000,
      username,
      rawUsername: mailuser.username,
      displayName: mailuser.struserdes || '',
      userId: mailuser.userid || '',
      deptId: mailuser.deptid || '',
      deptName: mailuser.deptname || '',
      accessToken: tokeninfo.access_token || '',
      refreshToken: tokeninfo.refresh_token || '',
      expiresIn: tokeninfo.expires_in || 0
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, status: 8095, error: 'IAM 验证请求超时' };
    }
    return { success: false, status: 8095, error: err.message || 'IAM 验证失败' };
  } finally {
    clearTimeout(timeout);
  }
}

function findLocalUserByIamUsername(iamUsername) {
  const normalized = normalizeUsername(iamUsername);
  if (!normalized) return null;
  return db.users.find(u => normalizeUsername(u.username) === normalized) || null;
}

const CRM_REAL_LOGIN_CONFIG = {
  enabled: (process.env.CRM_REAL_LOGIN_ENABLED || 'false') === 'true',
  mockEnabled: (process.env.CRM_AUTH_MOCK_ENABLED || 'true') === 'true',
  baseUrl: String(process.env.CRM_OPEN_API_BASE_URL || '').trim(),
  loginPath: String(process.env.CRM_OPEN_API_LOGIN_PATH || '/api/v2/auth/login').trim() || '/api/v2/auth/login',
  corpId: String(process.env.CRM_OPEN_API_CORP_ID || '').trim(),
  device: String(process.env.CRM_OPEN_API_DEVICE || 'open_api').trim() || 'open_api',
  versionCode: String(process.env.CRM_OPEN_API_VERSION_CODE || '9.9.9').trim() || '9.9.9',
  timeoutMs: Number(process.env.CRM_OPEN_API_TIMEOUT_MS || 12000),
};

const CRM_REAL_LOGIN_MOCK_CONFIG = {
  enabled: (process.env.CRM_REAL_LOGIN_MOCK_API_ENABLED || 'true') === 'true',
  requireCorpId: (process.env.CRM_REAL_LOGIN_MOCK_REQUIRE_CORP_ID || 'false') === 'true',
  corpId: String(process.env.CRM_REAL_LOGIN_MOCK_CORP_ID || 'demo-corp').trim() || 'demo-corp',
};

function buildLoginActor(username) {
  return {
    userId: '',
    username: username || '',
    name: '',
    role: ''
  };
}

function writeIamH5SsoLoginAudit(req, scope, result, message, options = {}) {
  const user = options.user || null;
  const iamResult = options.iamResult || {};
  const iamUsername = normalizeUsername(options.iamUsername || iamResult.username || '');
  const auditOptions = {
    module: 'auth',
    action: 'login',
    result,
    message,
    targetType: 'user',
    targetId: user?.id || '',
    targetName: user?.username || iamUsername || '',
    extra: {
      loginSource: 'iam_h5_sso',
      ssoScope: scope,
      iamUsername,
      iamStatus: iamResult.status || '',
      reason: options.reason || '',
      code: options.code || ''
    }
  };
  if (user) {
    const { password: _, ...userInfo } = user;
    auditOptions.fallbackUser = user;
    auditOptions.after = userInfo;
  } else {
    auditOptions.actor = buildLoginActor(iamUsername);
  }
  writeAuditLog(req, auditOptions);
}

function findLocalUserByCredentials(username, password) {
  return db.users.find(u => u.username === username && u.password === password) || null;
}

function getLocalUserVisibilityProfile(user) {
  if (!user) {
    return {
      scopeType: 'none',
      scopeValue: '',
      description: '未匹配用户'
    };
  }
  if (user.role === 'superadmin') {
    return {
      scopeType: 'all',
      scopeValue: '*',
      description: '全量可见'
    };
  }
  if (user.role === 'admin') {
    return {
      scopeType: 'region',
      scopeValue: user.region || '',
      description: `区域可见：${user.region || ''}`
    };
  }
  if (user.role === 'partner_admin') {
    return {
      scopeType: 'partner',
      scopeValue: user.partnerId || '',
      description: `渠道可见：${user.partnerId || ''}`
    };
  }
  return {
    scopeType: 'self_or_partner',
    scopeValue: user.partnerId || user.id || '',
    description: `本人/渠道可见：${user.partnerId || user.id || ''}`
  };
}

function buildMockRealLoginSuccessPayload(user) {
  return {
    code: 0,
    message: 'ok',
    data: {
      user_id: user.id,
      user_token: buildAppToken('crm_user'),
      username: user.username,
      login: user.username,
      account: user.username,
      name: user.name,
      role: user.role,
      status: user.status || 'active',
    }
  };
}

function buildMockIdentityPayload(user) {
  const profile = getLocalUserVisibilityProfile(user);
  const departmentIds = [];
  if (user.region) departmentIds.push(`region:${user.region}`);
  if (user.partnerId) departmentIds.push(`partner:${user.partnerId}`);

  return {
    code: 0,
    message: 'ok',
    data: {
      id: user.id,
      username: user.username,
      name: user.name,
      roleIds: [user.role],
      roleNames: [user.role],
      organizationIds: user.partnerId ? [user.partnerId] : [],
      departmentIds,
      isAdmin: user.role === 'superadmin' || user.role === 'admin',
      region: user.region || '',
      bigRegion: user.bigRegion || '',
      partnerId: user.partnerId || '',
      partnerName: user.partnerName || '',
      scopeType: profile.scopeType,
      scopeValue: profile.scopeValue,
      scopeDescription: profile.description,
      wecomSenderId: user.wecomSenderId || '',
    }
  };
}

function findLocalUserByRealLoginResult(result) {
  const exactUserId = String(result?.userId || '').trim();
  if (exactUserId) {
    const matchedById = db.users.find(u => String(u.id || '').trim() === exactUserId);
    if (matchedById) return matchedById;
  }

  const candidateNames = [
    result?.username,
    result?.login,
    result?.account,
    result?.mobile,
    result?.email
  ]
    .map(item => normalizeUsername(item))
    .filter(Boolean);

  for (const candidate of candidateNames) {
    const matchedByUsername = db.users.find(u => normalizeUsername(u.username) === candidate);
    if (matchedByUsername) return matchedByUsername;
  }

  return null;
}

function buildLoginSuccessPayload(user, extra = {}) {
  const token = extra.tokenFactory
    ? extra.tokenFactory()
    : buildAppToken(extra.tokenPrefix || 'token');
  const { password: _, ...userInfo } = user;
  return {
    token,
    user: userInfo,
  };
}

function validateLoginUserStatus(req, res, user, loginSource = 'local') {
  if (user.status === 'inactive' || user.status === 'disabled' || user.status === 'rejected') {
    writeAuditLog(req, {
      module: 'auth',
      action: 'login',
      result: 'failure',
      message: user.status === 'rejected' ? '登录失败：账号已驳回' : '登录失败：账号已禁用',
      fallbackUser: user,
      targetType: 'user',
      targetId: user.id,
      targetName: user.username,
      extra: {
        status: user.status,
        loginSource
      }
    });
    res.status(403).json({ error: user.status === 'rejected' ? '账号申请已被驳回，请联系管理员' : '账号已被禁用，请联系管理员' });
    return false;
  }

  if (user.status === 'pending') {
    writeAuditLog(req, {
      module: 'auth',
      action: 'login',
      result: 'failure',
      message: '登录失败：账号待审批',
      fallbackUser: user,
      targetType: 'user',
      targetId: user.id,
      targetName: user.username,
      extra: {
        status: user.status,
        loginSource
      }
    });
    res.status(403).json({ error: '账号待审批，请联系区域管理员审核' });
    return false;
  }

  return true;
}

function sendLocalLoginFailure(req, res, username, reason = '账号或密码错误', statusCode = 401, extra = {}) {
  writeAuditLog(req, {
    module: 'auth',
    action: 'login',
    result: 'failure',
    message: `登录失败：${reason}`,
    actor: buildLoginActor(username),
    extra: {
      username: username || '',
      ...extra
    }
  });
  return res.status(statusCode).json({ error: reason });
}

function sendLoginSuccess(req, res, user, loginSource = 'local', extra = {}) {
  const payload = buildLoginSuccessPayload(user, {
    tokenPrefix: loginSource === 'crm_open_api' ? 'crm_open_api' : 'token',
    tokenFactory: loginSource === 'crm_open_api'
      ? () => buildAppToken('crm_open_api')
      : () => 'token_' + Date.now(),
  });
  db.tokens = db.tokens || [];
  db.tokens.push({
    token: payload.token,
    userId: user.id,
    username: user.username,
    type: loginSource,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
  });
  const dueReminders = ensureDueReminderNotificationsForLogin(user);
  payload.dueReminders = dueReminders;
  payload.notifications = listNotificationsForUser(user.id);
  writeAuditLog(req, {
    module: 'auth',
    action: 'login',
    result: 'success',
    message: '登录成功',
    fallbackUser: user,
    targetType: 'user',
    targetId: user.id,
    targetName: user.username,
    after: payload.user,
    extra: {
      loginSource,
      ...extra
    }
  });
  return res.json(payload);
}

function getRealLoginUrl() {
  if (!CRM_REAL_LOGIN_CONFIG.baseUrl) return null;
  return new URL(
    CRM_REAL_LOGIN_CONFIG.loginPath,
    CRM_REAL_LOGIN_CONFIG.baseUrl.endsWith('/') ? CRM_REAL_LOGIN_CONFIG.baseUrl : `${CRM_REAL_LOGIN_CONFIG.baseUrl}/`
  ).toString();
}

function normalizeRealLoginSuccessPayload(payload) {
  const data = payload?.data || {};
  const userId = data.user_id || data.userId || payload?.user_id || payload?.userId || '';
  const userToken = data.user_token || data.userToken || payload?.user_token || payload?.userToken || '';

  return {
    success: true,
    raw: payload,
    code: payload?.code ?? 0,
    message: payload?.message || payload?.msg || 'ok',
    userId: String(userId || '').trim(),
    userToken: String(userToken || '').trim(),
    username: String(data.username || data.login || data.account || payload?.username || '').trim(),
    login: String(data.login || payload?.login || '').trim(),
    account: String(data.account || payload?.account || '').trim(),
    mobile: String(data.mobile || payload?.mobile || '').trim(),
    email: String(data.email || payload?.email || '').trim(),
  };
}

function normalizeRealLoginFailure(err, payload = null) {
  if (payload) {
    return {
      success: false,
      statusCode: 401,
      code: payload?.code ?? 'CRM_REAL_LOGIN_FAILED',
      message: payload?.message || payload?.msg || '真实 CRM 登录失败',
    };
  }
  if (err?.name === 'AbortError') {
    return {
      success: false,
      statusCode: 504,
      code: 'CRM_REAL_LOGIN_TIMEOUT',
      message: '真实 CRM 登录超时',
    };
  }
  return {
    success: false,
    statusCode: 502,
    code: 'CRM_REAL_LOGIN_REQUEST_FAILED',
    message: err?.message || '真实 CRM 登录请求失败',
  };
}

async function authenticateWithRealCrm(username, password) {
  const loginUrl = getRealLoginUrl();
  if (!CRM_REAL_LOGIN_CONFIG.enabled) {
    return { attempted: false, reason: 'feature_disabled' };
  }
  if (!loginUrl) {
    return { attempted: false, reason: 'missing_base_url' };
  }

  const body = {
    login: username,
    password,
    device: CRM_REAL_LOGIN_CONFIG.device,
  };
  if (CRM_REAL_LOGIN_CONFIG.corpId) {
    body.corp_id = CRM_REAL_LOGIN_CONFIG.corpId;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CRM_REAL_LOGIN_CONFIG.timeoutMs);
  try {
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Version-Code': CRM_REAL_LOGIN_CONFIG.versionCode,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const rawText = await response.text();
    let payload = null;
    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch (err) {
      return {
        attempted: true,
        ...normalizeRealLoginFailure(new Error('真实 CRM 登录返回非 JSON 数据')),
        rawText,
      };
    }

    if (!response.ok || payload?.code !== 0) {
      return {
        attempted: true,
        ...normalizeRealLoginFailure(null, payload),
        raw: payload,
        httpStatus: response.status,
      };
    }

    const normalized = normalizeRealLoginSuccessPayload(payload);
    if (!normalized.userId || !normalized.userToken) {
      return {
        attempted: true,
        success: false,
        statusCode: 502,
        code: 'CRM_REAL_LOGIN_RESPONSE_INVALID',
        message: '真实 CRM 登录成功响应缺少 user_id 或 user_token',
        raw: payload,
      };
    }

    return {
      attempted: true,
      ...normalized,
    };
  } catch (err) {
    return {
      attempted: true,
      ...normalizeRealLoginFailure(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

app.post('/api/mock/crm-open-api/v2/auth/login', (req, res) => {
  if (!CRM_REAL_LOGIN_MOCK_CONFIG.enabled) {
    return res.status(404).json({
      code: 40404,
      message: 'mock real crm login api disabled'
    });
  }

  const login = String(req.body?.login || req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const corpId = String(req.body?.corp_id || '').trim();

  if (CRM_REAL_LOGIN_MOCK_CONFIG.requireCorpId && corpId !== CRM_REAL_LOGIN_MOCK_CONFIG.corpId) {
    return res.status(400).json({
      code: 40021,
      message: 'corp_id invalid'
    });
  }

  const user = findLocalUserByCredentials(login, password);
  if (!user) {
    return res.status(401).json({
      code: 40101,
      message: 'login or password invalid'
    });
  }

  if (user.status === 'inactive' || user.status === 'disabled' || user.status === 'rejected') {
    return res.status(403).json({
      code: 40301,
      message: 'user disabled'
    });
  }

  if (user.status === 'pending') {
    return res.status(403).json({
      code: 40302,
      message: 'user pending approval'
    });
  }

  return res.json(buildMockRealLoginSuccessPayload(user));
});

app.get('/api/mock/crm-open-api/v1/identity/users/:userId', (req, res) => {
  if (!CRM_REAL_LOGIN_MOCK_CONFIG.enabled) {
    return res.status(404).json({
      code: 40404,
      message: 'mock identity api disabled'
    });
  }

  const user = db.users.find(item => item.id === req.params.userId);
  if (!user) {
    return res.status(404).json({
      code: 40401,
      message: 'user not found'
    });
  }

  return res.json(buildMockIdentityPayload(user));
});

app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) {
    return sendLocalLoginFailure(req, res, username, '账号或密码错误', 401, { loginSource: 'local' });
  }

  if (CRM_REAL_LOGIN_CONFIG.enabled) {
    const realLoginResult = await authenticateWithRealCrm(username, password);
    if (!realLoginResult.attempted && !CRM_REAL_LOGIN_CONFIG.mockEnabled) {
      writeAuditLog(req, {
        module: 'auth',
        action: 'login',
        result: 'failure',
        message: '登录失败：真实 CRM 登录已启用，但配置未完成',
        actor: buildLoginActor(username),
        extra: {
          loginSource: 'crm_open_api',
          reason: realLoginResult.reason || 'not_attempted',
        }
      });
      return res.status(503).json({
        error: '真实 CRM 登录已启用，但当前缺少登录基址等必要配置，请联系管理员补齐配置',
        code: 'CRM_REAL_LOGIN_NOT_READY',
      });
    }

    if (realLoginResult.attempted && realLoginResult.success) {
      const mappedUser = findLocalUserByRealLoginResult(realLoginResult);
      if (!mappedUser) {
        writeAuditLog(req, {
          module: 'auth',
          action: 'login',
          result: 'failure',
          message: '登录失败：真实 CRM 登录成功，但本地缺少身份映射',
          actor: buildLoginActor(username),
          extra: {
            loginSource: 'crm_open_api',
            crmUserId: realLoginResult.userId,
            crmUsername: realLoginResult.username || realLoginResult.login || '',
          }
        });
        return res.status(503).json({
          error: '真实 CRM 登录已成功，但当前系统未完成该账号的身份映射，请联系管理员补充映射资料'
        });
      }

      if (!validateLoginUserStatus(req, res, mappedUser, 'crm_open_api')) {
        return;
      }

      return sendLoginSuccess(req, res, mappedUser, 'crm_open_api', {
        crmUserId: realLoginResult.userId,
      });
    }

    if (realLoginResult.attempted && !CRM_REAL_LOGIN_CONFIG.mockEnabled) {
      writeAuditLog(req, {
        module: 'auth',
        action: 'login',
        result: 'failure',
        message: `登录失败：${realLoginResult.message}`,
        actor: buildLoginActor(username),
        extra: {
          loginSource: 'crm_open_api',
          code: realLoginResult.code || '',
        }
      });
      return res.status(realLoginResult.statusCode || 401).json({
        error: realLoginResult.message || '真实 CRM 登录失败',
        code: realLoginResult.code || 'CRM_REAL_LOGIN_FAILED',
      });
    }
  }

  const user = findLocalUserByCredentials(username, password);
  if (!user) {
    return sendLocalLoginFailure(req, res, username, '账号或密码错误', 401, {
      loginSource: 'local',
      fallbackFromRealLogin: CRM_REAL_LOGIN_CONFIG.enabled,
    });
  }

  if (!validateLoginUserStatus(req, res, user, 'local')) {
    return;
  }

  return sendLoginSuccess(req, res, user, 'local', {
    fallbackFromRealLogin: CRM_REAL_LOGIN_CONFIG.enabled,
  });
});

// 修改当前用户密码（自主修改）
app.put('/api/auth/password', (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  
  if (!userId || !oldPassword || !newPassword) {
    writeAuditLog(req, {
      module: 'auth',
      action: 'change_password',
      result: 'failure',
      message: '密码修改失败：缺少必填参数',
      extra: {
        userId: userId || ''
      }
    });
    return res.status(400).json({ success: false, error: '缺少必要参数' });
  }
  
  if (newPassword.length < 6) {
    writeAuditLog(req, {
      module: 'auth',
      action: 'change_password',
      result: 'failure',
      message: '密码修改失败：新密码长度不足',
      targetType: 'user',
      targetId: userId,
      extra: {
        userId
      }
    });
    return res.status(400).json({ success: false, error: '新密码长度不能少于6位' });
  }
  
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    writeAuditLog(req, {
      module: 'auth',
      action: 'change_password',
      result: 'failure',
      message: '密码修改失败：用户不存在',
      targetType: 'user',
      targetId: userId,
      extra: {
        userId
      }
    });
    return res.status(404).json({ success: false, error: '用户不存在' });
  }
  
  // 验证旧密码
  if (user.password !== oldPassword) {
    writeAuditLog(req, {
      module: 'auth',
      action: 'change_password',
      result: 'failure',
      message: '密码修改失败：原密码错误',
      fallbackUser: user,
      targetType: 'user',
      targetId: user.id,
      targetName: user.username
    });
    return res.status(400).json({ success: false, error: '原密码错误' });
  }
  
  const beforeUser = { ...user, password: '[masked]' };
  user.password = newPassword;
  user.updatedAt = new Date().toISOString();
  saveData();
  writeAuditLog(req, {
    module: 'auth',
    action: 'change_password',
    result: 'success',
    message: '密码修改成功',
    fallbackUser: user,
    targetType: 'user',
    targetId: user.id,
    targetName: user.username,
    before: beforeUser,
    after: { ...user, password: '[masked]' }
  });
  
  res.json({ success: true, message: '密码修改成功' });
});

// 获取当前用户信息
app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization;
  // 简化处理，直接返回第一个用户（实际应该验证token）
  res.json({ user: db.users[0] });
});

// 获取通知中心列表
app.get('/api/notifications', (req, res) => {
  const userId = String(req.query.userId || req.query.operatorId || '').trim();
  if (!userId) {
    return res.status(400).json({ success: false, error: '缺少用户ID' });
  }
  const user = db.users.find(item => String(item.id || '') === userId);
  if (user) {
    ensureDueReminderNotificationsForLogin(user);
  }
  res.json({ success: true, data: listNotificationsForUser(userId) });
});

// 标记通知已读
app.put('/api/notifications/read', (req, res) => {
  const userId = String(req.body?.userId || req.body?.operatorId || req.query?.userId || '').trim();
  const notificationId = String(req.body?.notificationId || req.query?.notificationId || '').trim();
  if (!userId) {
    return res.status(400).json({ success: false, error: '缺少用户ID' });
  }

  ensureNotificationsStore();
  let changed = false;
  for (const item of db.notifications) {
    if (String(item.userId || '') !== userId) continue;
    if (notificationId && item.id !== notificationId) continue;
    if (item.unread) {
      item.unread = false;
      item.updatedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) saveData();
  res.json({ success: true, data: listNotificationsForUser(userId) });
});

// ========== 客户报备接口 ==========

// 创建报备（合作伙伴）
app.post('/api/sso/iam/admin-login', async (req, res) => {
  if (!IAM_H5_SSO_CONFIG.enabled) {
    return res.status(400).json({ success: false, error: 'IAM 鍗曠偣鐧诲綍鏈惎鐢?' });
  }

  const ssoToken = String(req.body?.token || '').trim();
  if (!ssoToken) {
    return res.status(400).json({ success: false, error: '缂哄皯鍗曠偣鐧诲綍鍑瘉' });
  }

  const iamResult = await validateIamH5SsoToken(ssoToken);
  if (!iamResult.success) {
    return res.status(401).json({
      success: false,
      code: `IAM_${iamResult.status || 8095}`,
      error: iamResult.error
    });
  }

  const user = findLocalUserByIamUsername(iamResult.username);
  if (!user) {
    return res.status(403).json({ success: false, error: 'CRM 鏈湴鏈紑閫氳绠＄悊鍛樿处鍙?' });
  }

  if (user.role !== 'superadmin' && user.role !== 'admin') {
    return res.status(403).json({ success: false, error: '褰撳墠璐﹀彿鏈紑閫氱鐞嗗憳鍗曠偣鐧诲綍' });
  }

  if (user.status === 'inactive' || user.status === 'disabled' || user.status === 'rejected') {
    return res.status(403).json({ success: false, error: '璐﹀彿宸茶绂佺敤锛岃鑱旂郴绠＄悊鍛?' });
  }

  if (user.status === 'pending') {
    return res.status(403).json({ success: false, error: '璐﹀彿寰呭鎵癸紝璇疯仈绯荤鐞嗗憳瀹℃牳' });
  }

  const token = buildAppToken('sso_iam');
  db.tokens = db.tokens || [];
  db.tokens.push({
    token,
    userId: user.id,
    type: 'iam_h5_sso',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    iamUsername: iamResult.username
  });

  user.lastLogin = new Date().toISOString();
  user.lastLoginType = 'iam_h5_sso';
  user.ssoProvider = 'iam_h5';
  user.ssoSubject = iamResult.userId || iamResult.username;
  saveData();

  const { password: _, ...userInfo } = user;
  const dueReminders = ensureDueReminderNotificationsForLogin(user);
  res.json({
    success: true,
    token,
    user: userInfo,
    dueReminders,
    notifications: listNotificationsForUser(user.id)
  });
});

app.post('/api/sso/iam/admin-login-v2', async (req, res) => {
  if (!IAM_H5_SSO_CONFIG.enabled) {
    console.log('[IAM-SSO] rejected: feature disabled');
    writeIamH5SsoLoginAudit(req, 'admin', 'failure', '登录失败：IAM SSO 未启用', { reason: 'feature_disabled' });
    return res.status(400).json({ success: false, error: 'IAM SSO is disabled' });
  }

  const ssoToken = String(req.body?.token || '').trim();
  if (!ssoToken) {
    console.log('[IAM-SSO] rejected: missing token');
    writeIamH5SsoLoginAudit(req, 'admin', 'failure', '登录失败：缺少 IAM 单点登录凭证', { reason: 'missing_token' });
    return res.status(400).json({ success: false, error: 'Missing SSO token' });
  }

  console.log('[IAM-SSO] start validate token:', ssoToken.slice(0, 12) + '...');
  const iamResult = await validateIamH5SsoToken(ssoToken);
  if (!iamResult.success) {
    console.log('[IAM-SSO] IAM validate failed:', iamResult.status, iamResult.error);
    writeIamH5SsoLoginAudit(req, 'admin', 'failure', `登录失败：${iamResult.error || 'IAM 单点登录校验失败'}`, {
      iamResult,
      reason: 'iam_validate_failed',
      code: `IAM_${iamResult.status || 8095}`
    });
    return res.status(401).json({
      success: false,
      code: `IAM_${iamResult.status || 8095}`,
      error: iamResult.error || 'IAM validation failed'
    });
  }

  console.log('[IAM-SSO] IAM username:', iamResult.username);
  const user = findLocalUserByIamUsername(iamResult.username);
  if (!user) {
    console.log('[IAM-SSO] local user not found:', iamResult.username);
    writeIamH5SsoLoginAudit(req, 'admin', 'failure', '登录失败：CRM 未开通该管理员账号', {
      iamResult,
      reason: 'local_user_not_found'
    });
    return res.status(403).json({ success: false, error: 'CRM local admin account not found' });
  }

  if (user.role !== 'superadmin' && user.role !== 'admin') {
    console.log('[IAM-SSO] role rejected:', user.username, user.role);
    writeIamH5SsoLoginAudit(req, 'admin', 'failure', '登录失败：当前账号未开通管理员单点登录', {
      user,
      iamResult,
      reason: 'role_rejected'
    });
    return res.status(403).json({ success: false, error: 'Current account is not allowed for admin SSO' });
  }

  if (user.status === 'inactive' || user.status === 'disabled' || user.status === 'rejected') {
    console.log('[IAM-SSO] status rejected:', user.username, user.status);
    writeIamH5SsoLoginAudit(req, 'admin', 'failure', '登录失败：账号已禁用', {
      user,
      iamResult,
      reason: 'status_rejected'
    });
    return res.status(403).json({ success: false, error: 'Account is disabled' });
  }

  if (user.status === 'pending') {
    console.log('[IAM-SSO] status rejected:', user.username, user.status);
    writeIamH5SsoLoginAudit(req, 'admin', 'failure', '登录失败：账号待审批', {
      user,
      iamResult,
      reason: 'status_pending'
    });
    return res.status(403).json({ success: false, error: 'Account is pending approval' });
  }

  const token = buildAppToken('sso_iam');
  db.tokens = db.tokens || [];
  db.tokens.push({
    token,
    userId: user.id,
    type: 'iam_h5_sso',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    iamUsername: iamResult.username
  });

  user.lastLogin = new Date().toISOString();
  user.lastLoginType = 'iam_h5_sso';
  user.ssoProvider = 'iam_h5';
  user.ssoSubject = iamResult.userId || iamResult.username;
  saveData();

  console.log('[IAM-SSO] login success:', user.username, user.role, user.region || '-');
  const { password: _, ...userInfo } = user;
  const dueReminders = ensureDueReminderNotificationsForLogin(user);
  writeIamH5SsoLoginAudit(req, 'admin', 'success', '登录成功：手机端 IAM 单点登录', {
    user,
    iamResult
  });
  res.json({
    success: true,
    token,
    user: userInfo,
    dueReminders,
    notifications: listNotificationsForUser(user.id)
  });
});

app.post('/api/sso/iam/partner-login-v2', async (req, res) => {
  if (!IAM_H5_SSO_CONFIG.enabled) {
    console.log('[IAM-SSO][PARTNER] rejected: feature disabled');
    writeIamH5SsoLoginAudit(req, 'partner', 'failure', '登录失败：IAM SSO 未启用', { reason: 'feature_disabled' });
    return res.status(400).json({ success: false, error: 'IAM SSO is disabled' });
  }

  const ssoToken = String(req.body?.token || '').trim();
  if (!ssoToken) {
    console.log('[IAM-SSO][PARTNER] rejected: missing token');
    writeIamH5SsoLoginAudit(req, 'partner', 'failure', '登录失败：缺少 IAM 单点登录凭证', { reason: 'missing_token' });
    return res.status(400).json({ success: false, error: 'Missing SSO token' });
  }

  console.log('[IAM-SSO][PARTNER] start validate token:', ssoToken.slice(0, 12) + '...');
  const iamResult = await validateIamH5SsoToken(ssoToken);
  if (!iamResult.success) {
    console.log('[IAM-SSO][PARTNER] IAM validate failed:', iamResult.status, iamResult.error);
    writeIamH5SsoLoginAudit(req, 'partner', 'failure', `登录失败：${iamResult.error || 'IAM 单点登录校验失败'}`, {
      iamResult,
      reason: 'iam_validate_failed',
      code: `IAM_${iamResult.status || 8095}`
    });
    return res.status(401).json({
      success: false,
      code: `IAM_${iamResult.status || 8095}`,
      error: iamResult.error || 'IAM validation failed'
    });
  }

  console.log('[IAM-SSO][PARTNER] IAM username:', iamResult.username);
  const user = findLocalUserByIamUsername(iamResult.username);
  if (!user) {
    console.log('[IAM-SSO][PARTNER] local user not found:', iamResult.username);
    writeIamH5SsoLoginAudit(req, 'partner', 'failure', '登录失败：CRM 未开通该渠道账号', {
      iamResult,
      reason: 'local_user_not_found'
    });
    return res.status(403).json({ success: false, error: 'CRM local partner account not found' });
  }

  if (user.role !== 'partner_admin' && user.role !== 'staff') {
    console.log('[IAM-SSO][PARTNER] role rejected:', user.username, user.role);
    writeIamH5SsoLoginAudit(req, 'partner', 'failure', '登录失败：当前账号未开通渠道单点登录', {
      user,
      iamResult,
      reason: 'role_rejected'
    });
    return res.status(403).json({ success: false, error: 'Current account is not allowed for partner SSO' });
  }

  if (user.status === 'inactive' || user.status === 'disabled' || user.status === 'rejected') {
    console.log('[IAM-SSO][PARTNER] status rejected:', user.username, user.status);
    writeIamH5SsoLoginAudit(req, 'partner', 'failure', '登录失败：账号已禁用', {
      user,
      iamResult,
      reason: 'status_rejected'
    });
    return res.status(403).json({ success: false, error: 'Account is disabled' });
  }

  if (user.status === 'pending') {
    console.log('[IAM-SSO][PARTNER] status rejected:', user.username, user.status);
    writeIamH5SsoLoginAudit(req, 'partner', 'failure', '登录失败：账号待审批', {
      user,
      iamResult,
      reason: 'status_pending'
    });
    return res.status(403).json({ success: false, error: 'Account is pending approval' });
  }

  const token = buildAppToken('sso_iam');
  db.tokens = db.tokens || [];
  db.tokens.push({
    token,
    userId: user.id,
    type: 'iam_h5_sso',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    iamUsername: iamResult.username
  });

  user.lastLogin = new Date().toISOString();
  user.lastLoginType = 'iam_h5_sso';
  user.ssoProvider = 'iam_h5';
  user.ssoSubject = iamResult.userId || iamResult.username;
  saveData();

  console.log('[IAM-SSO][PARTNER] login success:', user.username, user.role, user.partnerId || '-', user.region || '-');
  const { password: _, ...userInfo } = user;
  const dueReminders = ensureDueReminderNotificationsForLogin(user);
  writeIamH5SsoLoginAudit(req, 'partner', 'success', '登录成功：手机端 IAM 单点登录', {
    user,
    iamResult
  });
  res.json({
    success: true,
    token,
    user: userInfo,
    dueReminders,
    notifications: listNotificationsForUser(user.id)
  });
});

app.post('/api/registrations', (req, res) => {
  const { customer, creditCode } = req.body;
  
  // 查重校验：检查客户名称是否已存在
  if (customer) {
    const normalizedCustomer = customer.trim().toLowerCase();
    const existingByName = db.registrations.find(r => 
      r.customer && r.customer.trim().toLowerCase() === normalizedCustomer
    );
    
    if (existingByName) {
      return res.status(409).json({ 
        success: false, 
        error: '该客户已被报备，不能重复报备',
        existing: {
          customer: existingByName.customer,
          owner: existingByName.createdByName || existingByName.owner || '未知',
          createdAt: existingByName.createdAt
        }
      });
    }
  }
  
  // 查重校验：检查统一社会信用代码是否已存在
  if (creditCode && creditCode.trim()) {
    const normalizedCreditCode = creditCode.trim();
    const existingByCreditCode = db.registrations.find(r => 
      r.creditCode && r.creditCode.trim() === normalizedCreditCode
    );
    
    if (existingByCreditCode) {
      return res.status(409).json({ 
        success: false, 
        error: '该统一社会信用代码已被报备，不能重复报备',
        existing: {
          customer: existingByCreditCode.customer,
          creditCode: existingByCreditCode.creditCode,
          owner: existingByCreditCode.createdByName || existingByCreditCode.owner || '未知'
        }
      });
    }
  }
  
  const { status: bodyStatus, owner, approvedBy } = req.body;
  
  // 判断是否为管理员提交的报备（status为approved且owner存在）
  const isAdminSubmit = bodyStatus === 'approved' && owner;
  
  const reg = {
    id: 'REG-' + Date.now(),
    ...req.body,
    status: bodyStatus || 'pending',
    createdAt: new Date().toISOString(),
    expireAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
  };
  
  // 管理员提交的报备自动通过，添加审核信息
  if (isAdminSubmit) {
    reg.approvedAt = new Date().toISOString();
    reg.approvedBy = approvedBy || owner;
  }
  
  // 确保 creditCode 字段存在
  if (!reg.creditCode) {
    reg.creditCode = '';
  }
  normalizeAssignedStaffForWrite(reg);
  
  // 【关键修复】自动补充 partnerId/partnerName：优先从 assignedStaffId 获取（员工有 partnerId，管理员没有）
  if (!reg.partnerId && reg.assignedStaffId) {
    const userInfo = getUserInfo(reg.assignedStaffId);
    if (userInfo.partnerId) {
      reg.partnerId = userInfo.partnerId;
      reg.partnerName = userInfo.partnerName;
      if (!reg.assignedPartnerId) reg.assignedPartnerId = userInfo.partnerId;
      if (!reg.assignedPartnerName) reg.assignedPartnerName = userInfo.partnerName;
    }
    if (userInfo.name && !reg.assignedStaffName) reg.assignedStaffName = userInfo.name;
  }
  
  // 【关键修复】如果还没有 partnerId，从 createdBy 获取（可能是员工自己创建）
  if (!reg.partnerId && reg.createdBy) {
    const userInfo = getUserInfo(reg.createdBy);
    if (userInfo.partnerId) reg.partnerId = userInfo.partnerId;
    if (userInfo.partnerName) reg.partnerName = userInfo.partnerName;
    if (userInfo.name && !reg.createdByName) reg.createdByName = userInfo.name;
  }
  
  // 【关键修复】如果指派了员工到渠道商，也需要设置 partnerId
  if (!reg.partnerId && reg.assignedPartnerId) {
    reg.partnerId = reg.assignedPartnerId;
    if (reg.assignedPartnerName) reg.partnerName = reg.assignedPartnerName;
  }
  
  // 【关键修复】如果还没有 partnerId，尝试从报备关联的商机获取（如果有 regId）
  if (!reg.partnerId && reg.regId) {
    const existingOpp = db.opportunities.find(o => o.regId === reg.regId);
    if (existingOpp) {
      if (existingOpp.partnerId) reg.partnerId = existingOpp.partnerId;
      if (existingOpp.partnerName) reg.partnerName = existingOpp.partnerName;
    }
  }
  
  db.registrations.push(reg);
  saveData();
  res.json({ success: true, data: reg });
});

// 获取报备列表
app.get('/api/registrations', (req, res) => {
  const { userId, region, status, partnerId } = req.query;
  let list = db.registrations;
  
  // 【关键修复】按用户筛选（员工：自己创建的 + 指派给自己的）
  // assignedStaffId 存储的是员工的 userId，直接匹配即可
  if (userId) {
    list = list.filter(r => isRecordRelatedToUser(r, userId, ['createdBy', 'owner', 'assignedStaffId']));
  }
  
  // 按区域筛选（区域管理员看本区域的）
  if (region) {
    list = list.filter(r => r.region === region);
  }
  
  // 按状态筛选
  if (status) {
    list = list.filter(r => r.status === status);
  }
  
  // 【关键修复】第一步：先 enrichment（补充缺失的 partnerId）
  list = list.map(r => {
    const enriched = enrichAssignedStaffForRead({ ...r });
    
    // 如果有 assignedStaffId，优先从被指派员工获取（员工有 partnerId，管理员没有）
    if (!enriched.partnerId && enriched.assignedStaffId) {
      const userInfo = getUserInfo(enriched.assignedStaffId);
      if (userInfo.partnerId) {
        enriched.partnerId = userInfo.partnerId;
        enriched.partnerName = userInfo.partnerName;
      }
      if (userInfo.name) {
        enriched.assignedStaffName = userInfo.name;
      }
    }
    
    // 如果有 createdBy，尝试从用户数据库获取正确的名称
    if (enriched.createdBy) {
      const userInfo = getUserInfo(enriched.createdBy);
      if (userInfo.name) {
        enriched.createdByName = userInfo.name;
      }
      // 【关键修复】补充 partnerId/partnerName（如果有缺失）
      if (!enriched.partnerId && userInfo.partnerId) {
        enriched.partnerId = userInfo.partnerId;
        enriched.partnerName = userInfo.partnerName;
      }
    }
    
    // 【关键修复】如果指派了员工，也需要设置 partnerId
    if (!enriched.partnerId && enriched.assignedPartnerId) {
      enriched.partnerId = enriched.assignedPartnerId;
      if (enriched.assignedPartnerName) enriched.partnerName = enriched.assignedPartnerName;
    }
    
    // 【关键修复】如果仍然没有 partnerId，尝试从商机获取（如果有关联的 regId）
    if (!enriched.partnerId && enriched.regId) {
      const opp = db.opportunities.find(o => o.regId === enriched.regId);
      if (opp && opp.partnerId) {
        enriched.partnerId = opp.partnerId;
        enriched.partnerName = opp.partnerName;
      }
    }
    
    return enriched;
  });
  
  // 【关键修复】第二步：enrichment 之后，再做 partnerId 过滤
  if (partnerId) {
    list = list.filter(r => r.partnerId === partnerId);
  }
  
  res.json({ success: true, data: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

// 更新报备状态（管理员审核）
app.put('/api/registrations/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, remark, approvedBy } = req.body;
  
  const reg = db.registrations.find(r => r.id === id);
  if (!reg) {
    return res.status(404).json({ error: '报备不存在' });
  }
  
  reg.status = status;
  reg.remark = remark;
  reg.updatedAt = new Date().toISOString();
  
  // 如果审批通过，记录审核信息
  if (status === 'approved') {
    reg.approvedAt = new Date().toISOString();
    reg.approvedBy = approvedBy || '管理员';
    
    // 如果报备时选择了"同时报备商机"，自动创建一个商机
    if (reg.hasOpportunity) {
      const createdByName = getUserInfo(reg.createdBy)?.name || reg.createdByName || '';
      
      const opp = {
        id: 'OPP-' + Date.now(),
        name: reg.project || (reg.customer + ' 项目'),
        customer: reg.customer,
        industry: reg.industry || '',
        contact: reg.contact || '',
        phone: reg.phone || '',
        region: reg.region,
        stage: 'contacted',
        amount: reg.estimatedAmt || 0,
        endpoints: reg.endpointRange ? parseInt(reg.endpointRange.split('-')[1]) || 0 : 0,
        probability: 30,
        expectedClose: reg.signDate || '',
        source: '渠道推荐',
        owner: createdByName,
        ownerId: reg.createdBy,
        createdBy: reg.createdBy,
        createdByName: createdByName,
        assignedStaffId: reg.assignedStaffId || reg.createdBy,
        assignedStaffName: reg.assignedStaffName || createdByName,
        partnerId: reg.partnerId,
        partnerName: reg.partnerName,
        assignedPartnerId: reg.assignedPartnerId || reg.partnerId,
        assignedPartnerName: reg.assignedPartnerName || reg.partnerName,
        regId: reg.id,
        quoteId: null,
        tags: [],
        notes: reg.notes || '',
        followUps: [],
        createdAt: new Date().toISOString()
      };
      
      normalizeAssignedStaffForWrite(opp);
      db.opportunities.push(opp);
    }
  }
  
  saveData();
  
  res.json({ success: true, data: reg });
});

// 更新报备记录
app.put('/api/registrations/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body && typeof req.body === 'object' ? { ...req.body } : {};
  
  const reg = db.registrations.find(r => r.id === id);
  if (!reg) {
    return res.status(404).json({ success: false, error: '报备不存在' });
  }
  
  // 角色权限控制：仅超管(superadmin)和区管(admin)可修改指派相关字段和保护期
  const operatedByRole = updates.operatedByRole || '';
  const isAdminRole = operatedByRole === 'superadmin' || operatedByRole === 'admin';
  const restrictedFields = ['assignedPartnerId', 'assignedPartnerName', 'assignedStaffId', 'assignedStaffName', 'expireAt', 'protectDays'];
  if (!isAdminRole) {
    // 非管理员角色：过滤掉受限字段
    restrictedFields.forEach(field => {
      delete updates[field];
    });
  }
  // 清理辅助字段，不写入数据
  stripAuditOperatorFields(updates);
  normalizeAssignedStaffForWrite(updates);
  
  // 允许更新的字段（含 partnerId/partnerName，指派渠道商时需同步更新以保证数据过滤正确）
  const allowedFields = ['assignedStaffId', 'assignedStaffName', 'assignedPartnerId', 'assignedPartnerName',
                         'partnerId', 'partnerName',
                         'industry', 'contact', 'phone', 'email', 'city', 'notes', 'status', 'remark',
                         'expireAt', 'protectDays'];
  for (const key of allowedFields) {
    if (updates.hasOwnProperty(key)) {
      reg[key] = updates[key];
    }
  }
  reg.updatedAt = new Date().toISOString();
  
  saveData();
  
  res.json({ success: true, data: reg });
});

// 删除报备
app.delete('/api/registrations/:id', (req, res) => {
  const { id } = req.params;
  
  const reg = db.registrations.find(r => r.id === id);
  if (!reg) {
    return res.status(404).json({ success: false, error: '报备不存在' });
  }
  
  db.registrations = db.registrations.filter(r => r.id !== id);
  saveData();
  
  res.json({ success: true, message: '报备已删除' });
});

// ========== 商机接口 ==========

// 创建商机
app.post('/api/opportunities', (req, res) => {
  const body = req.body;
  
  // 根据 regId 查找报备数据，获取 region 和员工信息
  let region = body.region;
  let assignedStaffName = body.assignedStaffName;
  let assignedStaffId = body.assignedStaffId;
  let assignedPartnerId = body.assignedPartnerId;
  let assignedPartnerName = body.assignedPartnerName;
  let createdByName = body.createdByName;
  
  // 如果前端没有传递 createdByName，根据 createdBy 自动获取
  if (!createdByName && body.createdBy) {
    const userInfo = getUserInfo(body.createdBy);
    createdByName = userInfo.name;
  }
  
  // 如果没有传递 partnerId/partnerName，根据 createdBy 自动获取
  if (!assignedPartnerId && !assignedPartnerName && body.createdBy) {
    const userInfo = getUserInfo(body.createdBy);
    if (userInfo.partnerId) assignedPartnerId = userInfo.partnerId;
    if (userInfo.partnerName) assignedPartnerName = userInfo.partnerName;
  }
  
  if (body.regId) {
    const reg = db.registrations.find(r => r.id === body.regId);
    if (reg) {
      if (reg.region) region = reg.region;
      // 如果前端没有指派员工，从报备中获取员工信息
      if (!assignedStaffName && reg.assignedStaffName) assignedStaffName = reg.assignedStaffName;
      if (!assignedStaffId && reg.assignedStaffId) assignedStaffId = reg.assignedStaffId;
      if (!assignedStaffName && reg.createdByName) assignedStaffName = reg.createdByName;
      if (!assignedStaffId && reg.createdBy) assignedStaffId = reg.createdBy;
      if (!assignedPartnerId && reg.partnerId) assignedPartnerId = reg.partnerId;
      if (!assignedPartnerName && reg.partnerName) assignedPartnerName = reg.partnerName;
      // 如果仍然没有 createdByName，从报备中获取
      if (!createdByName && reg.createdByName) createdByName = reg.createdByName;
    }
  }
  
  const opp = {
    id: 'OPP-' + Date.now(),
    ...body,
    region: region,
    createdByName: createdByName,
    assignedStaffName: assignedStaffName || createdByName,
    assignedStaffId: assignedStaffId,
    assignedPartnerId: assignedPartnerId,
    assignedPartnerName: assignedPartnerName,
    // 【关键修复】确保 partnerId 和 assignedPartnerId 一致
    // partnerId 用于企业管理员过滤，assignedPartnerId 用于标识商机归属的渠道商
    partnerId: assignedPartnerId || body.partnerId,
    partnerName: assignedPartnerName || body.partnerName,
    stage: 'contacted',
    createdAt: new Date().toISOString(),
    // 【防御性修复】确保 followUps 和 tags 始终为数组
    followUps: Array.isArray(body.followUps) ? body.followUps : [],
    tags: Array.isArray(body.tags) ? body.tags : []
  };

  // 【关键修复】如果还没有 partnerId，优先从 assignedStaffId 获取（员工有 partnerId，管理员没有）
  if (!opp.partnerId && opp.assignedStaffId) {
    const userInfo = getUserInfo(opp.assignedStaffId);
    if (userInfo.partnerId) {
      opp.partnerId = userInfo.partnerId;
      opp.partnerName = userInfo.partnerName;
    }
  }

  // 如果还没有 partnerId，尝试从 createdBy 获取（可能是员工自己创建）
  if (!opp.partnerId && opp.createdBy) {
    const userInfo = getUserInfo(opp.createdBy);
    if (userInfo.partnerId) {
      opp.partnerId = userInfo.partnerId;
      opp.partnerName = userInfo.partnerName;
    }
  }

  // 如果还没有 partnerId，尝试从 ownerId 获取（员工自己的渠道商）
  if (!opp.partnerId && opp.ownerId) {
    const userInfo = getUserInfo(opp.ownerId);
    if (userInfo.partnerId) {
      opp.partnerId = userInfo.partnerId;
      opp.partnerName = userInfo.partnerName;
    }
  }
  
  normalizeAssignedStaffForWrite(opp);
  db.opportunities.push(opp);
  saveData();
  writeAuditLog(req, {
    module: 'opportunity',
    action: 'create',
    targetType: 'opportunity',
    targetId: opp.id,
    targetName: opp.name || opp.customer || opp.id,
    result: 'success',
    message: '创建商机',
    after: opp,
    extra: {
      regId: opp.regId || '',
      partnerId: opp.partnerId || '',
      partnerName: opp.partnerName || '',
      assignedStaffId: opp.assignedStaffId || '',
      assignedStaffName: opp.assignedStaffName || ''
    }
  });
  res.json({ success: true, data: opp });
});

// 获取商机列表
app.get('/api/opportunities', (req, res) => {
  const { userId, region, partnerId } = req.query;
  let list = db.opportunities;
  
  // 【关键修复】第一步：先做员工/管理员的基础过滤
  // staff 角色：只能看到自己创建的商机 + 指派给自己的商机
  // assignedStaffId 存储的是员工的 userId，直接匹配即可
  if (userId) {
    list = list.filter(o => isRecordRelatedToUser(o, userId));
  }
  
  if (region) {
    // admin 角色：能看到本区域的商机（根据 region 字段或关联的报备数据判断）
    list = list.filter(o => {
      // 优先使用商机本身的 region 字段
      if (o.region === region) return true;
      // 否则根据 regId 查找报备数据的 region
      if (o.regId) {
        const reg = db.registrations.find(r => r.id === o.regId);
        if (reg && reg.region === region) return true;
      }
      return false;
    });
  }
  
  // 【关键修复】第二步：先 enrichment（补充缺失的 partnerId），再做 partnerId 过滤
  // 这样做可以确保原始数据中没有 partnerId 的商机也能被正确过滤
  // 优先级：assignedStaffId > createdBy > ownerId（员工有 partnerId，管理员没有）
  list = list.map(o => {
    const enriched = enrichAssignedStaffForRead({ ...o });
    
    // 【关键修复】优先从 assignedStaffId 获取（员工有 partnerId，管理员没有）
    if (!enriched.partnerId && enriched.assignedStaffId) {
      const userInfo = getUserInfo(enriched.assignedStaffId);
      if (userInfo.partnerId) {
        enriched.partnerId = userInfo.partnerId;
        enriched.partnerName = userInfo.partnerName;
        enriched.assignedPartnerId = userInfo.partnerId;
        enriched.assignedPartnerName = userInfo.partnerName;
      }
      if (userInfo.name) {
        enriched.assignedStaffName = userInfo.name;
      }
    }
    
    // 如果有 createdBy，尝试从用户数据库获取正确的名称
    if (enriched.createdBy) {
      const userInfo = getUserInfo(enriched.createdBy);
      if (userInfo.name) {
        enriched.createdByName = userInfo.name;
      }
      // 【关键修复】补充 partnerId/partnerName（如果有缺失）
      if (!enriched.partnerId && userInfo.partnerId) {
        enriched.partnerId = userInfo.partnerId;
        enriched.partnerName = userInfo.partnerName;
      }
    }
    
    // 如果有 assignedStaffId，补充 assignedStaffName
    if (enriched.assignedStaffId && !enriched.assignedStaffName) {
      const userInfo = getUserInfo(enriched.assignedStaffId);
      if (userInfo.name) {
        enriched.assignedStaffName = userInfo.name;
      } else if (enriched.createdByName) {
        enriched.assignedStaffName = enriched.createdByName;
      }
    }
    
    // 【关键修复】如果商机仍然没有 partnerId，尝试从 ownerId 获取
    if (!enriched.partnerId && enriched.ownerId) {
      const userInfo = getUserInfo(enriched.ownerId);
      if (userInfo.partnerId) {
        enriched.partnerId = userInfo.partnerId;
        enriched.partnerName = userInfo.partnerName;
      }
    }
    
    // 【防御性修复】确保 followUps 和 tags 字段始终为数组，防止前端 TypeError
    if (!Array.isArray(enriched.followUps)) enriched.followUps = [];
    if (!Array.isArray(enriched.tags)) enriched.tags = [];
    
    return enriched;
  });
  
  // 【关键修复】第三步：enrichment 之后，再做 partnerId 过滤
  // 这样可以确保原始数据中没有 partnerId 的商机也能被正确过滤
  if (partnerId) {
    list = list.filter(o => o.partnerId === partnerId);
  }
  
  res.json({ success: true, data: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

// 更新商机（包括跟进记录、阶段等）
app.put('/api/opportunities/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body && typeof req.body === 'object' ? { ...req.body } : {};
  
  const opp = db.opportunities.find(o => o.id === id);
  if (!opp) {
    return res.status(404).json({ success: false, error: '商机不存在' });
  }
  
  // 角色权限控制：仅超管(superadmin)和区管(admin)可修改商机名称、指派相关字段和商机金额
  const operatedByRole = updates.operatedByRole || '';
  const isAdminRole = operatedByRole === 'superadmin' || operatedByRole === 'admin';
  const restrictedFields = ['name', 'amount', 'assignedPartnerId', 'assignedPartnerName', 'assignedStaffId', 'assignedStaffName'];
  if (!isAdminRole) {
    // 非管理员角色：过滤掉受限字段
    restrictedFields.forEach(field => {
      delete updates[field];
    });
  }
  // 清理辅助字段，不写入数据
  stripAuditOperatorFields(updates);
  normalizeAssignedStaffForWrite(updates);
  
  // 更新字段
  Object.assign(opp, updates, { updatedAt: new Date().toISOString() });
  saveData();
  
  res.json({ success: true, data: opp });
});

// ========== 报价接口 ==========

// 根据用户ID获取用户信息（用于自动填充名称）
function normalizeRefId(value) {
  return String(value || '').trim();
}

function findPartnerStaffReferences(value) {
  const key = normalizeRefId(value);
  if (!key) return [];
  const refs = [];
  for (const partner of db.partners || []) {
    for (const staff of partner.staff || []) {
      if (
        normalizeRefId(staff.id) === key ||
        normalizeRefId(staff.userId) === key ||
        normalizeRefId(staff.username) === key
      ) {
        refs.push({ staff, partner });
      }
    }
  }
  return refs;
}

function findPartnerStaffReference(value) {
  return findPartnerStaffReferences(value)[0] || null;
}

function findUserDirectByIdentifier(identifier) {
  const key = normalizeRefId(identifier);
  if (!key) return null;
  return (db.users || []).find(u => normalizeRefId(u.id) === key)
    || (db.users || []).find(u => normalizeRefId(u.username) === key)
    || null;
}

function isPartnerStaffAccount(user) {
  return user && (user.role === 'staff' || user.role === 'partner_admin');
}

function isPartnerAdminRoleText(value) {
  const role = normalizeRefId(value);
  return role === 'partner_admin' || role === '企业管理员' || role === '渠道管理员';
}

function getPartnerStaffRoleFromUser(user, fallbackRole = '') {
  if (user?.role === 'partner_admin') return 'partner_admin';
  return user?.staffRole || (!isPartnerAdminRoleText(fallbackRole) ? fallbackRole : '') || '销售代表';
}

function isPartnerStaffRecordForUser(staff, user, identifier = '', partner = null) {
  if (!staff || !user) return false;
  const partnerId = normalizeRefId(partner?.id || user.partnerId);
  if (partnerId && normalizeRefId(user.partnerId) !== partnerId) return false;

  const userId = normalizeRefId(user.id);
  const username = normalizeRefId(user.username);
  const staffUserId = normalizeRefId(staff.userId);
  const staffUsername = normalizeRefId(staff.username);
  const staffId = normalizeRefId(staff.id);
  if (staffUsername && username && staffUsername === username) return true;
  if ((!staffUsername || !username) && userId && (staffUserId === userId || staffId === userId)) return true;
  return false;
}

function findUserByPartnerStaffRecord(staff, partner = null) {
  if (!staff) return null;
  const partnerId = normalizeRefId(partner?.id || staff.partnerId);
  if (!partnerId) return null;
  const users = (db.users || []).filter(user =>
    isPartnerStaffAccount(user) && normalizeRefId(user.partnerId) === partnerId
  );
  const username = normalizeRefId(staff.username);
  const userId = normalizeRefId(staff.userId);
  const staffId = normalizeRefId(staff.id);

  if (username) {
    const matchedByUsername = users.find(user => normalizeRefId(user.username) === username);
    if (matchedByUsername) return matchedByUsername;
  }

  if (userId) {
    const matchedByUserId = users.find(user =>
      normalizeRefId(user.id) === userId &&
      (!username || normalizeRefId(user.username) === username)
    );
    if (matchedByUserId) return matchedByUserId;
  }

  if (staffId) {
    const matchedByStaffId = users.find(user =>
      normalizeRefId(user.id) === staffId &&
      (!username || normalizeRefId(user.username) === username)
    );
    if (matchedByStaffId) return matchedByStaffId;
  }

  return null;
}

function buildPartnerStaffRecordFromUser(user) {
  return {
    id: user.id || user.username || `STAFF-${Date.now()}`,
    userId: user.id || '',
    username: user.username || '',
    name: user.name || '',
    role: getPartnerStaffRoleFromUser(user),
    phone: user.phone || '',
    email: user.email || '',
    status: user.status || 'active',
    createdBy: user.createdBy || '',
    createdByRole: user.createdByRole || '',
    createdAt: user.createdAt || new Date().toISOString()
  };
}

function ensurePartnerStaffRecordForUser(partner, user, identifier = '') {
  if (!partner || !isPartnerStaffAccount(user)) return null;
  if (normalizeRefId(user.partnerId) !== normalizeRefId(partner.id)) return null;
  if (!Array.isArray(partner.staff)) partner.staff = [];

  let staff = partner.staff.find(item => isPartnerStaffRecordForUser(item, user, identifier, partner));
  if (!staff) {
    staff = buildPartnerStaffRecordFromUser(user);
    partner.staff.push(staff);
  }
  return staff;
}

function buildUserInfo(user, staffRef = null) {
  const partner = staffRef?.partner || null;
  const staff = staffRef?.staff || null;
  return {
    id: user?.id || staff?.userId || '',
    userId: user?.id || staff?.userId || '',
    username: user?.username || staff?.username || '',
    staffId: staff?.id || '',
    name: user?.name || staff?.name || '',
    partnerId: user?.partnerId || partner?.id || '',
    partnerName: user?.partnerName || partner?.name || ''
  };
}

function getUserInfo(userId) {
  const key = normalizeRefId(userId);
  if (!key) return buildUserInfo(null);

  const user = (db.users || []).find(u => normalizeRefId(u.id) === key || normalizeRefId(u.username) === key);
  if (user) {
    return buildUserInfo(user, findPartnerStaffReference(user.id));
  }

  const staffRef = findPartnerStaffReference(key);
  if (staffRef) {
    const staffUser = findUserByPartnerStaffRecord(staffRef.staff, staffRef.partner);
    return buildUserInfo(staffUser, staffRef);
  }

  return buildUserInfo(null);
}

function findUserByIdentifier(identifier) {
  const key = normalizeRefId(identifier);
  if (!key) return null;
  const directUser = findUserDirectByIdentifier(key);
  if (directUser) return directUser;

  for (const staffRef of findPartnerStaffReferences(key)) {
    const staffUser = findUserByPartnerStaffRecord(staffRef.staff, staffRef.partner);
    if (staffUser) return staffUser;
  }
  return null;
}

function findUserForPartnerStaff(staff, partner = null) {
  if (!staff) return null;
  return findUserByPartnerStaffRecord(staff, partner);
}

function syncPartnerStaffUserInfo(staff, partner = null) {
  if (!staff) return staff;
  const user = findUserForPartnerStaff(staff, partner);
  if (!user) return staff;

  staff.userId = user.id;
  staff.username = user.username || staff.username || '';
  staff.name = user.name || staff.name || '';
  staff.phone = user.phone || staff.phone || '';
  staff.email = user.email || staff.email || '';
  staff.status = user.status || staff.status || 'active';
  staff.role = getPartnerStaffRoleFromUser(user, staff.role);
  return staff;
}

function syncPartnerStaffListUserInfo(partner) {
  if (!partner) return partner;
  if (!Array.isArray(partner.staff)) partner.staff = [];
  partner.staff.forEach(staff => syncPartnerStaffUserInfo(staff, partner));
  (db.users || [])
    .filter(user => isPartnerStaffAccount(user) && normalizeRefId(user.partnerId) === normalizeRefId(partner.id))
    .forEach(user => syncPartnerStaffUserInfo(ensurePartnerStaffRecordForUser(partner, user), partner));
  return partner;
}

function resolveUserReferenceId(value) {
  const key = normalizeRefId(value);
  if (!key) return '';
  const userInfo = getUserInfo(key);
  return userInfo.userId || key;
}

function isSameUserReference(value, userId) {
  const key = normalizeRefId(value);
  const target = normalizeRefId(userId);
  if (!key || !target) return false;
  return key === target || resolveUserReferenceId(key) === target;
}

function isRecordRelatedToUser(record, userId, fields = ['createdBy', 'ownerId', 'assignedStaffId']) {
  if (!record || !userId) return false;
  return fields.some(field => isSameUserReference(record[field], userId));
}

function applyAssignedStaffInfo(record, options = {}) {
  if (!record || !record.assignedStaffId) return record;
  const userInfo = getUserInfo(record.assignedStaffId);
  if (!userInfo.userId) return record;

  if (options.canonicalizeId && normalizeRefId(record.assignedStaffId) !== userInfo.userId) {
    record.assignedStaffSourceId = record.assignedStaffId;
    record.assignedStaffId = userInfo.userId;
  }
  record.assignedStaffUserId = userInfo.userId;
  if (userInfo.staffId) record.assignedPartnerStaffId = userInfo.staffId;
  if (userInfo.name && !record.assignedStaffName) record.assignedStaffName = userInfo.name;
  if (userInfo.partnerId) {
    if (!record.partnerId) record.partnerId = userInfo.partnerId;
    if (!record.partnerName) record.partnerName = userInfo.partnerName;
    if (!record.assignedPartnerId) record.assignedPartnerId = userInfo.partnerId;
    if (!record.assignedPartnerName) record.assignedPartnerName = userInfo.partnerName;
  }
  return record;
}

function normalizeAssignedStaffForWrite(record) {
  return applyAssignedStaffInfo(record, { canonicalizeId: true });
}

function enrichAssignedStaffForRead(record) {
  return applyAssignedStaffInfo(record, { canonicalizeId: true });
}

// 创建报价
function getOperatorFromRequest(req) {
  const operatorId =
    req.query?.operatorId ||
    req.body?.operatorId ||
    req.query?.operatedBy ||
    req.body?.operatedBy ||
    req.query?.userId ||
    req.body?.userId ||
    req.body?.createdBy ||
    '';
  if (!operatorId) return null;
  return db.users.find(item => item.id === operatorId) || null;
}

function requireSuperAdminUser(req, res) {
  const operator = getOperatorFromRequest(req);
  if (!operator || operator.role !== 'superadmin') {
    res.status(403).json({ success: false, error: '仅超级管理员可操作' });
    return null;
  }
  return operator;
}

app.get('/api/audit-logs', (req, res) => {
  const operator = requireSuperAdminUser(req, res);
  if (!operator) return;

  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const result = auditDb.list({
    page,
    pageSize,
    module: req.query.module || '',
    action: req.query.action || '',
    result: req.query.result || '',
    actorUserId: req.query.actorUserId || '',
    targetType: req.query.targetType || '',
    targetId: req.query.targetId || '',
    keyword: req.query.keyword || '',
    dateFrom: req.query.dateFrom || '',
    dateTo: req.query.dateTo || ''
  });

  res.json({ success: true, ...result });
});

app.get('/api/audit-logs/:id', (req, res) => {
  const operator = requireSuperAdminUser(req, res);
  if (!operator) return;

  const record = auditDb.getById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: '操作日志不存在' });
  }

  res.json({ success: true, data: record });
});

app.get('/api/workload/classifications', (req, res) => {
  const operator = requireSuperAdminUser(req, res);
  if (!operator) return;
  res.json({ success: true, data: db.implementationWorkloadClassifications });
});

app.get('/api/workload/delivery-rules', (req, res) => {
  const operator = requireSuperAdminUser(req, res);
  if (!operator) return;
  res.json({
    success: true,
    data: getDeliveryWorkloadRuleRows(),
    model: 'LEP-DELIVERY-20260612'
  });
});

app.put('/api/workload/delivery-rules/:id', (req, res) => {
  const operator = requireSuperAdminUser(req, res);
  if (!operator) return;
  if (!Array.isArray(db.implementationDeliveryWorkloadRules)) {
    db.implementationDeliveryWorkloadRules = [];
  }
  const rule = db.implementationDeliveryWorkloadRules.find(item => item.id === req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, error: '\u65b0\u7248\u5de5\u4f5c\u91cf\u89c4\u5219\u4e0d\u5b58\u5728' });
  }
  const personDays = Number(req.body.personDays);
  const comboPersonDays = req.body.comboPersonDays === null || req.body.comboPersonDays === undefined || req.body.comboPersonDays === ''
    ? null
    : Number(req.body.comboPersonDays);
  const minPoints = req.body.minPoints === null || req.body.minPoints === undefined || req.body.minPoints === ''
    ? null
    : Number(req.body.minPoints);
  const maxPoints = req.body.maxPoints === null || req.body.maxPoints === undefined || req.body.maxPoints === ''
    ? null
    : Number(req.body.maxPoints);
  if (!Number.isFinite(personDays) || personDays < 0) {
    return res.status(400).json({ success: false, error: '\u4eba\u5929\u5fc5\u987b\u4e3a\u975e\u8d1f\u6570' });
  }
  if (comboPersonDays !== null && (!Number.isFinite(comboPersonDays) || comboPersonDays < 0)) {
    return res.status(400).json({ success: false, error: '\u7ec4\u5408\u9879\u76ee\u52a0\u9879\u4eba\u5929\u5fc5\u987b\u4e3a\u975e\u8d1f\u6570' });
  }
  if (rule.ruleType !== 'fixed') {
    if (!Number.isFinite(minPoints) || minPoints <= 0 || (maxPoints !== null && (!Number.isFinite(maxPoints) || maxPoints < minPoints))) {
      return res.status(400).json({ success: false, error: '\u70b9\u6570\u8303\u56f4\u4e0d\u5408\u6cd5' });
    }
  }
  const before = cloneAuditValue(rule);
  Object.assign(rule, {
    minPoints: rule.ruleType === 'fixed' ? null : minPoints,
    maxPoints: rule.ruleType === 'fixed' ? null : maxPoints,
    personDays: roundWorkloadPersonDays(personDays),
    comboPersonDays: rule.ruleType === 'fixed' && comboPersonDays !== null ? roundWorkloadPersonDays(comboPersonDays) : rule.comboPersonDays,
    remark: String(req.body.remark || '').trim(),
    active: req.body.active !== false,
    source: 'manual',
    condition: buildDeliveryWorkloadRuleCondition({
      ...rule,
      minPoints: rule.ruleType === 'fixed' ? null : minPoints,
      maxPoints: rule.ruleType === 'fixed' ? null : maxPoints
    }),
    updatedAt: new Date().toISOString(),
    updatedBy: operator.id
  });
  setRequestAuditContext(req, {
    targetId: rule.id,
    targetName: rule.item || rule.id,
    before,
    after: cloneAuditValue(rule)
  });
  saveData();
  res.json({ success: true, data: normalizeDeliveryWorkloadRule(rule) });
});

app.get('/api/workload/mappings', (req, res) => {
  const operator = requireSuperAdminUser(req, res);
  if (!operator) return;
  const keyword = normalizeText(req.query.keyword);
  const list = buildImplementationWorkloadCatalogItems().map(catalogItem => {
    const mapping = db.implementationWorkloadMappings.find(item => item.featureId === catalogItem.id) || null;
    const deliveryTags = getImplementationWorkloadMappingTags(mapping || {}, catalogItem.source);
    return {
      id: mapping?.id || `IWM-${catalogItem.id}`,
      itemType: catalogItem.itemType,
      featureId: catalogItem.id,
      featureName: catalogItem.name,
      moduleId: catalogItem.moduleId,
      moduleName: catalogItem.moduleName,
      categoryId: catalogItem.categoryId,
      categoryName: catalogItem.categoryName,
      productCode: catalogItem.productCode,
      productType: deriveLegacyProductTypeFromDeliveryTags(deliveryTags, mapping?.productType || ''),
      sensitiveKeyword: deliveryTags.includes('SENSITIVE_DATA') || Boolean(mapping?.sensitiveKeyword),
      deliveryTags,
      deliveryTagLabels: deliveryTags.map(getWorkloadDeliveryTagLabel),
      active: mapping?.active !== false,
      source: mapping?.source || 'manual',
      updatedAt: mapping?.updatedAt || mapping?.createdAt || catalogItem.source.updatedAt || catalogItem.source.createdAt || ''
    };
  }).filter(item => {
    if (!keyword) return true;
    return [
      item.featureId,
      item.featureName,
      item.moduleName,
      item.categoryName,
      item.productCode
    ].some(value => normalizeText(value).includes(keyword));
  });
  res.json({ success: true, data: list });
});

app.put('/api/workload/mappings/:featureId', (req, res) => {
  const operator = requireSuperAdminUser(req, res);
  if (!operator) return;
  const catalogItem = buildImplementationWorkloadCatalogItems().find(item => item.id === req.params.featureId);
  const feature = catalogItem?.source || null;
  if (!feature) {
    return res.status(404).json({ success: false, error: '功能不存在' });
  }
  const module = db.modules.find(item => item.id === feature.moduleId);
  const mappingItemType = catalogItem?.itemType || 'feature';
  const mappingModuleName = catalogItem?.moduleName || module?.name || '';
  const mappingProductCode = catalogItem?.productCode || feature.productCode || '';
  const now = new Date().toISOString();
  const requestHasDeliveryTags = Object.prototype.hasOwnProperty.call(req.body || {}, 'deliveryTags');
  const deliveryTags = requestHasDeliveryTags
    ? normalizeWorkloadDeliveryTags(req.body.deliveryTags)
    : legacyWorkloadTagsFromValues(req.body.productType, req.body.sensitiveKeyword);
  const productType = deriveLegacyProductTypeFromDeliveryTags(deliveryTags, req.body.productType);
  const sensitiveKeyword = deliveryTags.includes('SENSITIVE_DATA');
  const existing = db.implementationWorkloadMappings.find(item => item.featureId === feature.id);
  if (existing) {
    Object.assign(existing, {
      itemType: mappingItemType,
      featureName: feature.name || feature.id,
      moduleId: feature.moduleId || '',
      moduleName: mappingModuleName,
      productCode: mappingProductCode,
      productType,
      sensitiveKeyword,
      deliveryTags,
      active: req.body.active !== false,
      source: 'manual',
      updatedAt: now,
      updatedBy: operator.id
    });
    saveData();
    return res.json({ success: true, data: existing });
  }
  const record = {
    id: `IWM-${feature.id}`,
    itemType: mappingItemType,
    featureId: feature.id,
    featureName: feature.name || feature.id,
    moduleId: feature.moduleId || '',
    moduleName: mappingModuleName,
    productCode: mappingProductCode,
    productType,
    sensitiveKeyword,
    deliveryTags,
    active: req.body.active !== false,
    source: 'manual',
    createdAt: now,
    updatedAt: now,
    updatedBy: operator.id
  };
  db.implementationWorkloadMappings.push(record);
  saveData();
  res.json({ success: true, data: record });
});

app.get('/api/workload/rules', (req, res) => {
  const operator = requireSuperAdminUser(req, res);
  if (!operator) return;
  const list = (db.implementationWorkloadRules || []).slice().sort((a, b) => {
    const minDiff = Number(a.minPoints || 0) - Number(b.minPoints || 0);
    if (minDiff !== 0) return minDiff;
    return String(a.productType || '').localeCompare(String(b.productType || ''));
  });
  res.json({ success: true, data: list });
});

app.post('/api/workload/rules', (req, res) => {
  const operator = requireSuperAdminUser(req, res);
  if (!operator) return;
  const minPoints = toPositiveNumber(req.body.minPoints, 0);
  const maxPoints = req.body.maxPoints === null || req.body.maxPoints === undefined || req.body.maxPoints === '' ? null : toPositiveNumber(req.body.maxPoints, 0);
  const personDays = Number(req.body.personDays);
  if (!minPoints || !['EPP', 'DES', 'NXG'].includes(req.body.productType) || !Number.isFinite(personDays) || personDays < 0) {
    return res.status(400).json({ success: false, error: '规则参数不完整' });
  }
  const now = new Date().toISOString();
  const record = {
    id: `IWR-${Date.now()}`,
    name: req.body.name || `${req.body.productType} ${minPoints}-${maxPoints || '以上'}点`,
    minPoints,
    maxPoints,
    productType: req.body.productType,
    sensitiveKeyword: Boolean(req.body.sensitiveKeyword),
    personDays,
    active: req.body.active !== false,
    source: 'manual',
    createdAt: now,
    updatedAt: now,
    updatedBy: operator.id
  };
  db.implementationWorkloadRules.push(record);
  saveData();
  res.json({ success: true, data: record });
});

app.put('/api/workload/rules/:id', (req, res) => {
  const operator = requireSuperAdminUser(req, res);
  if (!operator) return;
  const rule = db.implementationWorkloadRules.find(item => item.id === req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, error: '规则不存在' });
  }
  const minPoints = toPositiveNumber(req.body.minPoints, 0);
  const maxPoints = req.body.maxPoints === null || req.body.maxPoints === undefined || req.body.maxPoints === '' ? null : toPositiveNumber(req.body.maxPoints, 0);
  const personDays = Number(req.body.personDays);
  if (!minPoints || !['EPP', 'DES', 'NXG'].includes(req.body.productType) || !Number.isFinite(personDays) || personDays < 0) {
    return res.status(400).json({ success: false, error: '规则参数不完整' });
  }
  Object.assign(rule, {
    name: req.body.name || rule.name,
    minPoints,
    maxPoints,
    productType: req.body.productType,
    sensitiveKeyword: Boolean(req.body.sensitiveKeyword),
    personDays,
    active: req.body.active !== false,
    source: 'manual',
    updatedAt: new Date().toISOString(),
    updatedBy: operator.id
  });
  saveData();
  res.json({ success: true, data: rule });
});

app.delete('/api/workload/rules/:id', (req, res) => {
  const operator = requireSuperAdminUser(req, res);
  if (!operator) return;
  const idx = db.implementationWorkloadRules.findIndex(item => item.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '规则不存在' });
  }
  const deletedRule = cloneAuditValue(db.implementationWorkloadRules[idx]);
  setRequestAuditContext(req, {
    targetId: deletedRule.id || req.params.id,
    targetName: deletedRule.name || deletedRule.id || req.params.id,
    before: deletedRule,
    after: { id: deletedRule.id || req.params.id, deleted: true }
  });
  db.implementationWorkloadRules.splice(idx, 1);
  saveData();
  res.json({ success: true });
});

app.post('/api/quotes/workload-preview', (req, res) => {
  const suggestion = buildImplementationWorkloadSuggestion(req.body || {});
  res.json({ success: true, data: suggestion });
});

app.post('/api/ipg/quote-preview', (req, res) => {
  try {
    const body = req.body || {};
    const featureIds = Array.isArray(body.featureIds)
      ? body.featureIds
      : Array.isArray(body.products)
        ? body.products
        : [];
    const featureById = new Map((db.features || []).map(feature => [feature.id, feature]));
    const features = featureIds.map(featureId => {
      const feature = featureById.get(featureId);
      return feature ? { id: feature.id, name: feature.name, productCode: feature.productCode } : { id: featureId, name: featureId };
    });
    const preview = calculateIpgQuotePreview({
      ...body,
      featureIds,
      features,
      hardwareIds: Array.isArray(body.hardwareIds) ? body.hardwareIds : [],
      projectParams: body.projectParams || {}
    });
    res.json({ success: true, data: preview });
  } catch (err) {
    console.error('IPG参考价计算失败:', err);
    res.status(500).json({ success: false, error: 'IPG参考价计算失败' });
  }
});

app.post('/api/quotes', (req, res) => {
  const body = req.body;

  // 【新增】强制关联至少一个商机
  // 处理商机ID数组：优先使用 oppIds，如果不存在则使用 oppId 转换为数组
  let oppIds = [];
  if (body.oppIds && Array.isArray(body.oppIds)) {
    oppIds = body.oppIds;
  } else if (body.oppId) {
    oppIds = [body.oppId];
  }
  
  // 验证至少关联一个商机
  if (oppIds.length === 0) {
    writeAuditLog(req, {
      module: 'quote',
      action: 'create',
      result: 'failure',
      message: '报价单创建失败：未选择商机',
      extra: body
    });
    return res.status(400).json({ success: false, error: '报价单必须至少关联一个商机' });
  }
  
  // 验证所有商机ID存在
  for (const oppId of oppIds) {
    const opp = db.opportunities.find(o => o.id === oppId);
    if (!opp) {
      writeAuditLog(req, {
        module: 'quote',
        action: 'create',
        result: 'failure',
        message: '报价单创建失败：商机不存在',
        extra: {
          ...body,
          missingOppId: oppId
        }
      });
      return res.status(400).json({ success: false, error: `关联的商机不存在：${oppId}` });
    }
  }
  
  // 保持向后兼容：oppId 设置为第一个商机ID
  const oppId = oppIds[0];

  // 根据 regId 查找报备数据，获取合作伙伴信息
  let region = body.region;
  let partnerName = body.partnerName;
  let partnerId = body.partnerId;
  let assignedPartnerName = body.assignedPartnerName;
  let assignedPartnerId = body.assignedPartnerId;
  let assignedStaffName = body.assignedStaffName;
  let assignedStaffId = body.assignedStaffId;
  let createdByName = body.createdByName;

  // 如果前端没有传递 createdByName，根据 createdBy 自动获取
  if (!createdByName && body.createdBy) {
    const userInfo = getUserInfo(body.createdBy);
    createdByName = userInfo.name;
  }

  // 【关键修复】如果还没有 partnerId，优先从 assignedStaffId 获取（员工有 partnerId，管理员没有）
  if (!partnerId && assignedStaffId) {
    const userInfo = getUserInfo(assignedStaffId);
    if (userInfo.partnerId) {
      partnerId = userInfo.partnerId;
      partnerName = userInfo.partnerName;
      if (!assignedPartnerId) assignedPartnerId = userInfo.partnerId;
      if (!assignedPartnerName) assignedPartnerName = userInfo.partnerName;
    }
  }

  // 如果还没有 partnerId，根据 createdBy 自动获取（可能是员工自己创建）
  if (!partnerId && body.createdBy) {
    const userInfo = getUserInfo(body.createdBy);
    if (userInfo.partnerId) partnerId = userInfo.partnerId;
    if (userInfo.partnerName) partnerName = userInfo.partnerName;
  }

  if (body.regId) {
    const reg = db.registrations.find(r => r.id === body.regId);
    if (reg) {
      if (reg.region) region = reg.region;
      // 如果前端没有传递合作伙伴信息，从报备中获取
      if (!partnerName && reg.partnerName) partnerName = reg.partnerName;
      if (!partnerId && reg.partnerId) partnerId = reg.partnerId;
      if (!assignedPartnerName && reg.assignedPartnerName) assignedPartnerName = reg.assignedPartnerName;
      if (!assignedPartnerId && reg.assignedPartnerId) assignedPartnerId = reg.assignedPartnerId;
      if (!assignedStaffName && reg.assignedStaffName) assignedStaffName = reg.assignedStaffName;
      if (!assignedStaffId && reg.assignedStaffId) assignedStaffId = reg.assignedStaffId;
      // 如果仍然没有 createdByName，从报备中获取
      if (!createdByName && reg.createdByName) createdByName = reg.createdByName;
    }
  }

  const quote = {
    id: 'QT-' + Date.now(),
    ...body,
    oppIds: oppIds,        // 新增：商机ID数组
    oppId: oppId,          // 保持向后兼容
    region: region,
    partnerName: partnerName,
    partnerId: partnerId,
    assignedPartnerName: assignedPartnerName,
    assignedPartnerId: assignedPartnerId,
    assignedStaffName: assignedStaffName || createdByName,
    assignedStaffId: assignedStaffId,
    createdByName: createdByName,
    status: 'draft',
    createdAt: new Date().toISOString()
  };
  normalizeAssignedStaffForWrite(quote);
  applyQuoteWorkloadFields(quote, quote);
  db.quotes.push(quote);
  saveData();
  writeAuditLog(req, {
    module: 'quote',
    action: 'create',
    result: 'success',
    message: '报价单创建成功',
    targetType: 'quote',
    targetId: quote.id,
    targetName: quote.customerName || quote.id,
    after: quote,
    extra: body
  });
  res.json({ success: true, data: quote });
});

// 获取报价列表
app.get('/api/quotes', (req, res) => {
  const { userId, region, partnerId } = req.query;
  let list = db.quotes;
  
  // 【关键修复】员工获取报价单：只看自己创建的 + 被指派给自己的
  // assignedStaffId 存储的是员工的 userId，直接匹配即可
  if (userId) {
    list = list.filter(q => isRecordRelatedToUser(q, userId));
  }
  
  if (region) {
    list = list.filter(q => q.region === region);
  }
  
  // 【关键修复】第一步：先 enrichment（补充缺失的 partnerId）
  // 优先级：assignedStaffId > createdBy > ownerId（员工有 partnerId，管理员没有）
  list = list.map(q => {
    const enriched = enrichAssignedStaffForRead({ ...q });
    
    // 【关键修复】优先从 assignedStaffId 获取（员工有 partnerId，管理员没有）
    if (!enriched.partnerId && enriched.assignedStaffId) {
      const userInfo = getUserInfo(enriched.assignedStaffId);
      if (userInfo.partnerId) {
        enriched.partnerId = userInfo.partnerId;
        enriched.partnerName = userInfo.partnerName;
      }
      if (userInfo.name) {
        enriched.assignedStaffName = userInfo.name;
      }
    }
    
    // 如果有 createdBy，尝试从用户数据库获取正确的名称
    if (enriched.createdBy) {
      const userInfo = getUserInfo(enriched.createdBy);
      if (userInfo.name) {
        enriched.createdByName = userInfo.name;
      }
      // 【关键修复】补充 partnerId/partnerName（如果有缺失）
      if (!enriched.partnerId && userInfo.partnerId) {
        enriched.partnerId = userInfo.partnerId;
        enriched.partnerName = userInfo.partnerName;
      }
    }
    
    // 如果有 assignedStaffId，补充 assignedStaffName
    if (enriched.assignedStaffId && !enriched.assignedStaffName) {
      const userInfo = getUserInfo(enriched.assignedStaffId);
      if (userInfo.name) {
        enriched.assignedStaffName = userInfo.name;
      } else if (enriched.createdByName) {
        enriched.assignedStaffName = enriched.createdByName;
      }
    }
    
    // 【关键修复】如果仍然没有 partnerId，尝试从 ownerId 获取
    if (!enriched.partnerId && enriched.ownerId) {
      const userInfo = getUserInfo(enriched.ownerId);
      if (userInfo.partnerId) {
        enriched.partnerId = userInfo.partnerId;
        enriched.partnerName = userInfo.partnerName;
      }
    }
    
    return enriched;
  });
  
  // 【关键修复】第二步：enrichment 之后，再做 partnerId 过滤
  // partner_admin 角色：能看到本渠道企业所有员工的报价单
  if (partnerId) {
    list = list.filter(q => q.partnerId === partnerId);
  }
  
  res.json({ success: true, data: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

// 删除报价单
app.delete('/api/quotes/:id', (req, res) => {
  const idx = db.quotes.findIndex(q => q.id === req.params.id);
  if (idx !== -1) {
    const deletedQuote = cloneAuditValue(db.quotes[idx]);
    setRequestAuditContext(req, {
      targetId: deletedQuote.id || req.params.id,
      targetName: deletedQuote.customerName || deletedQuote.customer || deletedQuote.id || req.params.id,
      before: deletedQuote,
      after: { id: deletedQuote.id || req.params.id, deleted: true }
    });
    db.quotes.splice(idx, 1);
    saveData();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '报价单不存在' });
  }
});

// ========== 订单接口 ==========

// 创建订单
app.post('/api/orders', (req, res) => {
  const body = req.body;
  
  // 根据 quoteId 查找报价单数据，获取合作伙伴信息
  let region = body.region;
  let partnerName = body.partnerName;
  let partnerId = body.partnerId;
  let assignedPartnerName = body.assignedPartnerName;
  let assignedPartnerId = body.assignedPartnerId;
  let assignedStaffName = body.assignedStaffName;
  let assignedStaffId = body.assignedStaffId;
  let createdByName = body.createdByName;
  
  // 如果前端没有传递 createdByName，根据 createdBy 自动获取
  if (!createdByName && body.createdBy) {
    const userInfo = getUserInfo(body.createdBy);
    createdByName = userInfo.name;
  }
  
  // 【关键修复】如果还没有 partnerId，优先从 assignedStaffId 获取（员工有 partnerId，管理员没有）
  if (!partnerId && assignedStaffId) {
    const userInfo = getUserInfo(assignedStaffId);
    if (userInfo.partnerId) {
      partnerId = userInfo.partnerId;
      partnerName = userInfo.partnerName;
      if (!assignedPartnerId) assignedPartnerId = userInfo.partnerId;
      if (!assignedPartnerName) assignedPartnerName = userInfo.partnerName;
    }
  }
  
  // 如果还没有 partnerId，根据 createdBy 自动获取（可能是员工自己创建）
  if (!partnerId && body.createdBy) {
    const userInfo = getUserInfo(body.createdBy);
    if (userInfo.partnerId) partnerId = userInfo.partnerId;
    if (userInfo.partnerName) partnerName = userInfo.partnerName;
  }
  
  if (body.quoteId) {
    const quote = db.quotes.find(q => q.id === body.quoteId);
    if (quote) {
      if (quote.region) region = quote.region;
      if (quote.partnerName) partnerName = quote.partnerName;
      if (quote.partnerId) partnerId = quote.partnerId;
      // 【关键修复】从报价单继承时，不覆盖前端主动传递的 assignedPartnerId/assignedPartnerName
      // 二级渠道商转订单时，前端会主动传递一级渠道商作为 assignedPartnerId
      if (quote.assignedPartnerName && !body.assignedPartnerName) assignedPartnerName = quote.assignedPartnerName;
      if (quote.assignedPartnerId && !body.assignedPartnerId) assignedPartnerId = quote.assignedPartnerId;
      if (quote.assignedStaffName) assignedStaffName = quote.assignedStaffName;
      if (quote.assignedStaffId) assignedStaffId = quote.assignedStaffId;
      // 从报价单继承创建者信息
      if (quote.createdBy && !body.createdBy) body.createdBy = quote.createdBy;
      if (quote.createdByName && !createdByName) createdByName = quote.createdByName;
    }
  }
  
  // 【新增】二级渠道商下单限制检查（支持多个上级渠道商）
  const partner = db.partners.find(p => p.id === partnerId);
  if (partner && partner.partnerLevel === 'secondary') {
    // 二级渠道商下单：必须指定一个已绑定的一级渠道商
    if (!assignedPartnerId) {
      writeAuditLog(req, {
        module: 'order',
        action: 'create',
        result: 'failure',
      message: '订单创建失败：二级渠道商未指定一级渠道商',
        extra: body
      });
      return res.status(400).json({ 
        success: false, 
        error: '二级渠道商必须指定一个上级一级渠道商',
        code: 'SECONDARY_PARTNER_MUST_ORDER_THROUGH_PRIMARY'
      });
    }
    
    // 获取上级渠道商列表（兼容旧数据）
    const parentPartnerIds = partner.parentPartnerIds || 
                            (partner.parentPartnerId ? [partner.parentPartnerId] : []);
    
    // 检查指定的上级渠道商是否在绑定列表中
    if (!parentPartnerIds.includes(assignedPartnerId)) {
      writeAuditLog(req, {
        module: 'order',
        action: 'create',
        result: 'failure',
        message: '订单创建失败：二级渠道商选择的一级渠道商无效',
        extra: body
      });
      return res.status(400).json({ 
        success: false, 
        error: '二级渠道商只能向已绑定的上级一级渠道商下单',
        code: 'SECONDARY_PARTNER_MUST_ORDER_THROUGH_PRIMARY'
      });
    }
    
    // 二级渠道商订单状态为pending，需要经过一级确认
  }
  
  const order = {
    id: 'ORD-' + Date.now(),
    ...body,
    region: region,
    partnerName: partnerName,
    partnerId: partnerId,
    // 【修复】保存parentPartnerId，供一级渠道商查询下属二级订单
    parentPartnerId: partner && partner.partnerLevel === 'secondary' ? assignedPartnerId : null,
    assignedPartnerName: assignedPartnerName,
    assignedPartnerId: assignedPartnerId,
    createdByName: createdByName,
    assignedStaffName: assignedStaffName || createdByName,
    assignedStaffId: assignedStaffId,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  normalizeAssignedStaffForWrite(order);
  db.orders.push(order);
  
  // 更新渠道商统计字段
  if (partnerId) {
    updatePartnerStats(partnerId);
  }
  if (assignedPartnerId && assignedPartnerId !== partnerId) {
    updatePartnerStats(assignedPartnerId);
  }
  
  saveData();
  writeAuditLog(req, {
    module: 'order',
    action: 'create',
    result: 'success',
    message: '订单创建成功',
    targetType: 'order',
    targetId: order.id,
    targetName: order.customerName || order.id,
    after: order,
    extra: body
  });
  res.json({ 
    success: true, 
    data: order,
    message: partner && partner.partnerLevel === 'secondary' ? 
      '订单已提交，等待一级渠道商确认' : '订单已提交'
  });
});

// 更新渠道商统计字段
function updatePartnerStats(pId) {
  const partner = db.partners.find(p => p.id === pId);
  if (!partner) return;
  
  // 计算该渠道商的报价单数量和订单统计
  const partnerQuotes = db.quotes.filter(q => 
    q.partnerId === pId || q.assignedPartnerId === pId
  );
  const partnerOrders = db.orders.filter(o => 
    o.partnerId === pId || o.assignedPartnerId === pId
  );
  
  partner.quoteCount = partnerQuotes.length;
  partner.orderCount = partnerOrders.length;
  partner.totalAmt = partnerOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
}

// 获取订单列表
app.get('/api/orders', (req, res) => {
  const { userId, region, partnerId } = req.query;
  let list = db.orders;
  
  // 【关键修复】员工获取订单：只看自己创建的 + 被指派给自己的 + 如果属于一级渠道商还要看下属二级订单
  if (userId) {
    // 获取员工所属的一级渠道商
    const userInfo = getUserInfo(userId);
    const userPartnerId = userInfo?.partnerId;
    const isPrimaryPartner = userPartnerId && db.partners.find(p => p.id === userPartnerId)?.partnerLevel === 'primary';
    
    if (isPrimaryPartner) {
      // 找到所有下属二级渠道商（支持多个上级渠道商）
      const secondaryPartnerIds = db.partners
        .filter(p => p.partnerLevel === 'secondary' && 
                 ((p.parentPartnerIds && p.parentPartnerIds.includes(userPartnerId)) || 
                  p.parentPartnerId === userPartnerId))
        .map(p => p.id);
      
      // 员工本人创建的 + 被指派给该员工的 + 该一级渠道商的 + 下属二级渠道商的
      // 【关键修复】增加通过 parentPartnerId 匹配的条件：o.parentPartnerId === userPartnerId
      list = list.filter(o => 
        isRecordRelatedToUser(o, userId) ||
        o.partnerId === userPartnerId ||
        secondaryPartnerIds.includes(o.partnerId) ||
        o.parentPartnerId === userPartnerId || // 关键修复：二级渠道商的订单通过 parentPartnerId 关联
        o.assignedPartnerId === userPartnerId
      );
    } else {
      // 普通员工：只看自己创建的 + 被指派给自己的
      list = list.filter(o => isRecordRelatedToUser(o, userId));
    }
  }
  
  if (region) {
    list = list.filter(o => o.region === region);
  }
  
  // 【关键修复】第一步：先 enrichment（补充缺失的 partnerId）
  // 优先级：assignedStaffId > createdBy > ownerId（员工有 partnerId，管理员没有）
  list = list.map(o => {
    const enriched = enrichAssignedStaffForRead({ ...o });
    
    // 【关键修复】优先从 assignedStaffId 获取（员工有 partnerId，管理员没有）
    if (!enriched.partnerId && enriched.assignedStaffId) {
      const userInfo = getUserInfo(enriched.assignedStaffId);
      if (userInfo.partnerId) {
        enriched.partnerId = userInfo.partnerId;
        enriched.partnerName = userInfo.partnerName;
      }
      if (userInfo.name) {
        enriched.assignedStaffName = userInfo.name;
      }
    }
    
    // 如果有 createdBy，尝试从用户数据库获取正确的名称
    if (enriched.createdBy) {
      const userInfo = getUserInfo(enriched.createdBy);
      if (userInfo.name) {
        enriched.createdByName = userInfo.name;
      }
      // 【关键修复】补充 partnerId/partnerName（如果有缺失）
      if (!enriched.partnerId && userInfo.partnerId) {
        enriched.partnerId = userInfo.partnerId;
        enriched.partnerName = userInfo.partnerName;
      }
    }
    
    // 如果有 assignedStaffId，补充 assignedStaffName
    if (enriched.assignedStaffId && !enriched.assignedStaffName) {
      const userInfo = getUserInfo(enriched.assignedStaffId);
      if (userInfo.name) {
        enriched.assignedStaffName = userInfo.name;
      } else if (enriched.createdByName) {
        enriched.assignedStaffName = enriched.createdByName;
      }
    }
    
    // 【关键修复】如果仍然没有 partnerId，尝试从 ownerId 获取
    if (!enriched.partnerId && enriched.ownerId) {
      const userInfo = getUserInfo(enriched.ownerId);
      if (userInfo.partnerId) {
        enriched.partnerId = userInfo.partnerId;
        enriched.partnerName = userInfo.partnerName;
      }
    }
    
    return enriched;
  });
  
  // 【关键修复】第二步：enrichment 之后，再做 partnerId 过滤
  // partner_admin 角色：能看到本渠道企业所有员工的订单
  if (partnerId) {
    // 一级渠道商：可以看到自己的订单 + 下属二级渠道商的订单
    const partner = db.partners.find(p => p.id === partnerId);
    if (partner && partner.partnerLevel === 'primary') {
      // 找到所有下属二级渠道商（支持多个上级渠道商）
      const secondaryPartnerIds = db.partners
        .filter(p => p.partnerLevel === 'secondary' && 
                 ((p.parentPartnerIds && p.parentPartnerIds.includes(partnerId)) || 
                  p.parentPartnerId === partnerId))
        .map(p => p.id);
      
      list = list.filter(o => 
        o.partnerId === partnerId || // 自己的订单
        secondaryPartnerIds.includes(o.partnerId) || // 下属二级的订单
        o.assignedPartnerId === partnerId // 指派给自己的订单(二级下单)
      );
    } else {
      // 其他角色：只看自己的订单
      list = list.filter(o => o.partnerId === partnerId);
    }
  }
  
  res.json({ success: true, data: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

// 删除订单
app.delete('/api/orders/:id', (req, res) => {
  const idx = db.orders.findIndex(o => o.id === req.params.id);
  if (idx !== -1) {
    const deletedOrder = cloneAuditValue(db.orders[idx]);
    setRequestAuditContext(req, {
      targetId: deletedOrder.id || req.params.id,
      targetName: deletedOrder.customerName || deletedOrder.customer || deletedOrder.id || req.params.id,
      before: deletedOrder,
      after: { id: deletedOrder.id || req.params.id, deleted: true }
    });
    db.orders.splice(idx, 1);
    saveData();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '订单不存在' });
  }
});

// 更新报价单
app.put('/api/quotes/:id', (req, res) => {
  const { id } = req.params;
  const payload = req.body && typeof req.body === 'object' ? { ...req.body } : {};
  const updates = { ...payload };
  
  const quote = db.quotes.find(q => q.id === id);
  if (!quote) {
    writeAuditLog(req, {
      module: 'quote',
      action: 'update',
      result: 'failure',
      message: '报价单更新失败：报价单不存在',
      targetType: 'quote',
      targetId: id,
      extra: updates
    });
    return res.status(404).json({ success: false, error: '报价单不存在' });
  }
  
  const beforeQuote = JSON.parse(JSON.stringify(quote));
  delete updates.id;
  stripAuditOperatorFields(updates);
  normalizeAssignedStaffForWrite(updates);
  Object.assign(quote, updates, { updatedAt: new Date().toISOString() });
  applyQuoteWorkloadFields(quote, quote);
  saveData();
  writeAuditLog(req, {
    module: 'quote',
    action: 'update',
    result: 'success',
    message: '报价单更新成功',
    targetType: 'quote',
    targetId: quote.id,
    targetName: quote.customerName || quote.id,
    before: beforeQuote,
    after: quote,
    extra: payload
  });
  
  res.json({ success: true, data: quote });
});

// 更新报价单状态
// 支持的状态流转：draft -> sent -> confirmed -> converted(已转单)
// 也可以直接标记过期：任何状态 -> expired
app.put('/api/quotes/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, operatorId, operatorName } = req.body;
  
  const quote = db.quotes.find(q => q.id === id);
  if (!quote) {
    writeAuditLog(req, {
      module: 'quote',
      action: 'change_status',
      result: 'failure',
      message: '报价单状态变更失败：报价单不存在',
      targetType: 'quote',
      targetId: id,
      extra: req.body
    });
    return res.status(404).json({ success: false, error: '报价单不存在' });
  }
  
  // 验证状态值
  const validStatuses = ['draft', 'sent', 'confirmed', 'converted', 'expired'];
  if (!validStatuses.includes(status)) {
    writeAuditLog(req, {
      module: 'quote',
      action: 'change_status',
      result: 'failure',
      message: '报价单状态变更失败：状态无效',
      targetType: 'quote',
      targetId: id,
      targetName: quote.customerName || quote.id,
      extra: req.body
    });
    return res.status(400).json({ success: false, error: '无效的状态值' });
  }
  
  const beforeQuote = JSON.parse(JSON.stringify(quote));
  // 记录状态变更历史
  if (!quote.statusHistory) {
    quote.statusHistory = [];
  }
  quote.statusHistory.push({
    from: quote.status,
    to: status,
    operatorId: operatorId,
    operatorName: operatorName,
    changedAt: new Date().toISOString()
  });
  
  quote.status = status;
  quote.updatedAt = new Date().toISOString();
  saveData();
  writeAuditLog(req, {
    module: 'quote',
    action: 'change_status',
    result: 'success',
    message: `报价单状态变更为${getAuditStatusLabel(status)}`,
    targetType: 'quote',
    targetId: quote.id,
    targetName: quote.customerName || quote.id,
    before: beforeQuote,
    after: quote,
    extra: {
      operatorId,
      operatorName,
      fromStatus: beforeQuote.status,
      toStatus: status
    }
  });
  
  res.json({ success: true, data: quote });
});

// 更新订单状态（厂商确认订单）
// 支持的状态流转：
// - 一级/无层级渠道商：pending -> processing -> shipped -> completed
// - 二级渠道商：pending -> primary_confirmed -> processing -> shipped -> completed
// 也可以直接取消：任何状态 -> cancelled
app.put('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, remark, operatorId, operatorName, operatorRole } = req.body;
  
  const order = db.orders.find(o => o.id === id);
  if (!order) {
    writeAuditLog(req, {
      module: 'order',
      action: 'change_status',
      result: 'failure',
      message: '订单状态变更失败：订单不存在',
      targetType: 'order',
      targetId: id,
      extra: req.body
    });
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  
  // 验证状态值
  const validStatuses = ['pending', 'primary_confirmed', 'primary_rejected', 'processing', 'shipped', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    writeAuditLog(req, {
      module: 'order',
      action: 'change_status',
      result: 'failure',
      message: '订单状态变更失败：状态无效',
      targetType: 'order',
      targetId: id,
      targetName: order.customerName || order.id,
      extra: req.body
    });
    return res.status(400).json({ success: false, error: '无效的状态值' });
  }
  
  // 权限检查：只有超级管理员或区域管理员可以更新订单状态
  // 区域管理员只能更新自己区域的订单
  if (operatorRole === 'admin' && order.region) {
    const operator = db.users.find(u => u.id === operatorId);
    if (operator && operator.region !== order.region) {
      writeAuditLog(req, {
        module: 'order',
        action: 'change_status',
        result: 'failure',
        message: '订单状态变更失败：禁止跨区域操作',
        fallbackUser: operator,
        targetType: 'order',
        targetId: id,
        targetName: order.customerName || order.id,
        extra: req.body
      });
      return res.status(403).json({ success: false, error: '无权操作其他区域的订单' });
    }
  }
  
  // 二级渠道商订单流程验证
  const partner = db.partners.find(p => p.id === order.partnerId);
  if (partner && partner.partnerLevel === 'secondary') {
    // 二级渠道商订单必须经过一级确认
    if (order.status === 'pending' && status === 'processing') {
      writeAuditLog(req, {
        module: 'order',
        action: 'change_status',
        result: 'failure',
        message: '订单状态变更失败：二级渠道商订单需先一级确认',
        targetType: 'order',
        targetId: id,
        targetName: order.customerName || order.id,
        extra: req.body
      });
      return res.status(400).json({ 
        success: false, 
        error: '二级渠道商订单必须先经过一级渠道商确认' 
      });
    }
  }
  
  const beforeOrder = JSON.parse(JSON.stringify(order));
  // 记录状态变更历史
  if (!order.statusHistory) {
    order.statusHistory = [];
  }
  order.statusHistory.push({
    from: order.status,
    to: status,
    operatorId,
    operatorName,
    operatorRole,
    remark: remark || '',
    timestamp: new Date().toISOString()
  });
  
  // 更新状态
  const oldStatus = order.status;
  order.status = status;
  order.updatedAt = new Date().toISOString();
  
  // 记录最后操作人
  order.lastOperatorId = operatorId;
  order.lastOperatorName = operatorName;
  order.lastOperatorRole = operatorRole;
  
  saveData();
  writeAuditLog(req, {
    module: 'order',
    action: 'change_status',
    result: 'success',
    message: `订单状态变更为${getAuditStatusLabel(status)}`,
    targetType: 'order',
    targetId: order.id,
    targetName: order.customerName || order.id,
    before: beforeOrder,
    after: order,
    extra: {
      operatorId,
      operatorName,
      operatorRole,
      remark: remark || '',
      fromStatus: beforeOrder.status,
      toStatus: status
    }
  });
  
  res.json({ 
    success: true, 
    data: order,
    message: `订单状态已从 "${oldStatus}" 更新为 "${status}"`
  });
});

// 调整订单价格（区域管理员可调整订单金额，需填写调整原因）
app.put('/api/orders/:id/price-adjust', (req, res) => {
  const { id } = req.params;
  const { newAmount, adjustmentReason, operatorId, operatorName, operatorRole } = req.body;
  
  if (newAmount === undefined || newAmount === null || newAmount < 0) {
    writeAuditLog(req, {
      module: 'order',
      action: 'price_adjust',
      result: 'failure',
      message: '订单价格调整失败：金额无效',
      targetType: 'order',
      targetId: id,
      extra: req.body
    });
    return res.status(400).json({ success: false, error: '请输入有效的调整后价格' });
  }
  
  if (!adjustmentReason || adjustmentReason.trim() === '') {
    writeAuditLog(req, {
      module: 'order',
      action: 'price_adjust',
      result: 'failure',
      message: '订单价格调整失败：缺少调价原因',
      targetType: 'order',
      targetId: id,
      extra: req.body
    });
    return res.status(400).json({ success: false, error: '请填写价格调整原因' });
  }
  
  const order = db.orders.find(o => o.id === id);
  if (!order) {
    writeAuditLog(req, {
      module: 'order',
      action: 'price_adjust',
      result: 'failure',
      message: '订单价格调整失败：订单不存在',
      targetType: 'order',
      targetId: id,
      extra: req.body
    });
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  
  // 权限检查：只有超级管理员或区域管理员可以调整价格
  if (operatorRole !== 'superadmin' && operatorRole !== 'admin') {
    writeAuditLog(req, {
      module: 'order',
      action: 'price_adjust',
      result: 'failure',
      message: '订单价格调整失败：角色权限不足',
      targetType: 'order',
      targetId: id,
      targetName: order.customerName || order.id,
      extra: req.body
    });
    return res.status(403).json({ success: false, error: '只有管理员可以调整订单价格' });
  }
  
  // 区域管理员只能调整自己区域的订单
  if (operatorRole === 'admin' && order.region) {
    const operator = db.users.find(u => u.id === operatorId);
    if (operator && operator.region !== order.region) {
      writeAuditLog(req, {
        module: 'order',
        action: 'price_adjust',
        result: 'failure',
        message: '订单价格调整失败：禁止跨区域操作',
        fallbackUser: operator,
        targetType: 'order',
        targetId: id,
        targetName: order.customerName || order.id,
        extra: req.body
      });
      return res.status(403).json({ success: false, error: '无权调整其他区域的订单价格' });
    }
  }
  
  const beforeOrder = JSON.parse(JSON.stringify(order));
  // 记录价格调整历史
  if (!order.priceAdjustments) {
    order.priceAdjustments = [];
  }
  order.priceAdjustments.push({
    oldAmount: order.amount || order.total,
    newAmount: newAmount,
    reason: adjustmentReason.trim(),
    operatorId,
    operatorName,
    operatorRole,
    timestamp: new Date().toISOString()
  });
  
  // 更新订单金额
  const oldAmount = order.amount || order.total;
  order.amount = newAmount;
  order.total = newAmount;
  order.updatedAt = new Date().toISOString();
  
  // 记录最后操作人
  order.lastOperatorId = operatorId;
  order.lastOperatorName = operatorName;
  order.lastOperatorRole = operatorRole;
  
  // 更新渠道商统计
  if (order.partnerId) {
    updatePartnerStats(order.partnerId);
  }
  
  saveData();
  writeAuditLog(req, {
    module: 'order',
    action: 'price_adjust',
    result: 'success',
    message: '订单价格调整成功',
    targetType: 'order',
    targetId: order.id,
    targetName: order.customerName || order.id,
    before: beforeOrder,
    after: order,
    extra: {
      operatorId,
      operatorName,
      operatorRole,
      oldAmount,
      newAmount,
      adjustmentReason: adjustmentReason.trim()
    }
  });
  
  res.json({ 
    success: true, 
    data: order,
    message: `订单价格已从 ¥${oldAmount.toLocaleString()} 调整为 ¥${newAmount.toLocaleString()}`
  });
});

// ========== 用户/员工管理接口 ==========

// 获取用户列表（管理员账号管理）
app.get('/api/users', (req, res) => {
  const { role, region } = req.query;
  let list = db.users;
  
  // 按角色筛选
  if (role) {
    list = list.filter(u => u.role === role);
  }
  
  // 按区域筛选（区域管理员只能看本区域的）
  if (region) {
    list = list.filter(u => u.region === region || !u.region);
  }
  
  // 不返回密码
  const safeList = list.map(u => {
    const { password, ...userInfo } = u;
    return userInfo;
  });
  
  res.json({ success: true, data: safeList });
});

// 更新用户信息
app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body && typeof req.body === 'object' ? { ...req.body } : {};
  
  const user = findUserByIdentifier(id);
  if (!user) {
    return res.status(404).json({ success: false, error: '用户不存在' });
  }
  
  // 不允许通过此接口修改密码，需单独处理
  delete updates.password;
  delete updates.id; // ID 不能修改

  if (user.role === 'superadmin') {
    if (updates.role && updates.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: '不能修改超级管理员角色' });
    }
    if (updates.status && updates.status !== 'active') {
      return res.status(403).json({ success: false, error: '不能停用超级管理员账号' });
    }
  }
  
  stripAuditOperatorFields(updates);
  Object.assign(user, updates, { updatedAt: new Date().toISOString() });
  
  // 同步更新渠道商 staff 数组中的对应字段
  if (user.partnerId) {
    const partner = db.partners.find(p => p.id === user.partnerId);
    if (partner) {
      const staffRecord = ensurePartnerStaffRecordForUser(partner, user, id);
      if (staffRecord) {
        staffRecord.userId = user.id;
        if (user.username) staffRecord.username = user.username;
        if (updates.name) staffRecord.name = updates.name;
        if (updates.phone) staffRecord.phone = updates.phone;
        if (updates.email) staffRecord.email = updates.email;
        if (updates.staffRole) staffRecord.role = updates.staffRole;
        if (updates.status) staffRecord.status = updates.status;
      }
    }
  }
  
  saveData();
  
  const { password, ...userInfo } = user;
  res.json({ success: true, data: userInfo });
});

// 删除用户
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const operator = getOperatorFromRequest(req);
  
  const user = findUserByIdentifier(id);
  if (!user) {
    return res.status(404).json({ success: false, error: '用户不存在' });
  }
  
  if (user.role === 'superadmin') {
    if (user.username === 'admin') {
      return res.status(403).json({ success: false, error: '内置 admin 超级管理员账号不能删除' });
    }
    if (!operator || operator.username !== 'admin') {
      return res.status(403).json({ success: false, error: '仅 admin 账号可删除其他超级管理员账号' });
    }
    if (operator.id === user.id) {
      return res.status(403).json({ success: false, error: '不能删除当前登录账号' });
    }
  }
  
  // 同时删除渠道商 staff 数组中的记录
  if (user.partnerId) {
    const partner = db.partners.find(p => p.id === user.partnerId);
    if (partner && partner.staff) {
      partner.staff = partner.staff.filter(s => !isPartnerStaffRecordForUser(s, user, id, partner));
    }
  }
  
  setRequestAuditContext(req, {
    targetId: user.id || id,
    targetName: user.name || user.username || user.id || id,
    before: cloneAuditValue(user),
    after: { id: user.id || id, deleted: true }
  });
  db.users = db.users.filter(u => u.id !== user.id);
  saveData();
  
  res.json({ success: true, message: '用户已删除' });
});

// 重置用户密码
app.put('/api/users/:id/password', (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  const user = findUserByIdentifier(id);
  if (!user) {
    return res.status(404).json({ success: false, error: '用户不存在' });
  }

  // 不允许修改超级管理员密码
  if (user.role === 'superadmin') {
    return res.status(403).json({ success: false, error: '不能修改超级管理员密码' });
  }

  user.password = password || '123456';
  user.updatedAt = new Date().toISOString();
  saveData();

  res.json({ success: true, message: '密码已重置' });
});

// 同步员工状态到用户账号（禁用/启用）
app.post('/api/users/sync-status', (req, res) => {
  const { username, status } = req.body;
  
  if (!username || !status) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  const user = db.users.find(u => u.username === username);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  // 不允许禁用管理员账号
  if (user.role === 'superadmin' || user.role === 'admin') {
    return res.status(403).json({ error: '无权禁用管理员账号' });
  }
  
  user.status = status;
  saveData();
  
  res.json({ success: true, message: `账号已${status === 'active' ? '启用' : '禁用'}` });
});

// ========== 管理员账号管理接口 ==========

// 创建管理员账号
function ensureChannelOperationsData() {
  if (!Array.isArray(db.channelTargets)) db.channelTargets = [];
  if (!Array.isArray(db.channelVisits)) db.channelVisits = [];
}

function normalizePositiveNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * 100) / 100;
}

function roundMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function normalizeChannelYear(value) {
  const year = parseInt(value, 10);
  return Number.isFinite(year) && year > 2000 ? year : new Date().getFullYear();
}

function normalizeDateString(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function calcRate(actual, target) {
  if (!target) return actual > 0 ? 100 : 0;
  return Math.min(999, Math.round((actual / target) * 100));
}

const PARTNER_PROFILE_DEFAULT_INDUSTRIES = ['教育', '医疗', '制造', '园区'];
const PARTNER_PROFILE_LEVELS = ['high', 'medium', 'low', 'pending'];
const PARTNER_PROFILE_TEXT_FIELDS = ['address', 'bossName', 'bossPhone', 'establishedAt', 'employeeCount', 'annualRevenue', 'invoiceCapability'];
const PARTNER_PROFILE_LIST_FIELDS = ['customerIndustries', 'agencyBrands', 'qualifications', 'authorizedProducts', 'typicalCustomers', 'serviceAreas'];
const PARTNER_PROFILE_EXTENSION_DEFAULTS = {
  registeredCapital: '',
  paidInCapital: '',
  socialInsuranceCount: '',
  businessStatus: '',
  unifiedSocialCreditCode: '',
  legalRepresentative: '',
  businessScope: '',
  channelPositioning: '',
  officialWebsite: '',
  dataSource: '',
  advantageIndustries: [],
  mainBusiness: '',
  capabilityScore: '',
  riskSensitiveFields: [],
  authorizationExpiryReminder: '',
  paymentCycle: ''
};
const PARTNER_PROFILE_EXTENSION_LIST_FIELDS = new Set(['advantageIndustries', 'riskSensitiveFields']);
const PARTNER_PROFILE_EXTENSION_VALUE_FIELDS = new Set(['capabilityScore', 'authorizationExpiryReminder']);
const PARTNER_PROFILE_SENSITIVE_FIELDS = new Set([
  'registeredCapital',
  'paidInCapital',
  'annualRevenue',
  'socialInsuranceCount',
  'unifiedSocialCreditCode',
  'legalRepresentative',
  'riskSensitiveFields'
]);
const PARTNER_PROFILE_LIST_ALIASES = {
  serviceRegions: 'serviceAreas',
  majorAgencyBrands: 'agencyBrands',
  authorizedProductLines: 'authorizedProducts',
  certifications: 'qualifications'
};

function normalizeTrimmedString(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(item => normalizeTrimmedString(item)).filter(Boolean)));
  }
  const text = normalizeTrimmedString(value);
  if (!text) return [];
  return Array.from(new Set(text.split(/[，,、\n]/).map(item => item.trim()).filter(Boolean)));
}

function isPlainObjectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizePartnerProfileExtensionField(field, value) {
  if (PARTNER_PROFILE_EXTENSION_LIST_FIELDS.has(field)) {
    return normalizeStringList(value);
  }
  if (PARTNER_PROFILE_EXTENSION_VALUE_FIELDS.has(field) && isPlainObjectValue(value)) {
    return cloneAuditValue(value);
  }
  return normalizeTrimmedString(value);
}

function mergePartnerProfileExtensionValue(target, field, value) {
  if (value === undefined) return false;
  const nextValue = normalizePartnerProfileExtensionField(field, value);
  if (JSON.stringify(target[field]) === JSON.stringify(nextValue)) return false;
  target[field] = nextValue;
  return true;
}

function ensurePartnerProfileCompatibility(profile) {
  if (!profile || typeof profile !== 'object') return false;
  const before = JSON.stringify(profile);
  if (!profile.id && profile.partnerId) profile.id = profile.partnerId;
  if (!profile.partnerId && profile.id) profile.partnerId = profile.id;
  if (!profile.matrix || typeof profile.matrix !== 'object') profile.matrix = {};

  Object.entries(PARTNER_PROFILE_LIST_ALIASES).forEach(([aliasField, targetField]) => {
    const targetList = normalizeStringList(profile[targetField]);
    const aliasList = normalizeStringList(profile[aliasField]);
    profile[targetField] = targetList.length ? targetList : aliasList;
  });

  const extended = isPlainObjectValue(profile.extended) ? profile.extended : {};
  profile.extended = {};
  Object.entries(PARTNER_PROFILE_EXTENSION_DEFAULTS).forEach(([field, defaultValue]) => {
    const sourceValue = extended[field] !== undefined ? extended[field] : profile[field];
    profile.extended[field] = sourceValue !== undefined
      ? normalizePartnerProfileExtensionField(field, sourceValue)
      : cloneAuditValue(defaultValue);
  });

  return JSON.stringify(profile) !== before;
}

function getPartnerProfileInputSources(body) {
  const sources = [];
  if (isPlainObjectValue(body)) sources.push(body);
  if (isPlainObjectValue(body?.profile)) sources.push(body.profile);
  if (isPlainObjectValue(body?.extended)) sources.push(body.extended);
  if (isPlainObjectValue(body?.profile?.extended)) sources.push(body.profile.extended);
  return sources;
}

function getPartnerProfileInputValue(body, field) {
  const sources = getPartnerProfileInputSources(body);
  for (const source of sources) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      return source[field];
    }
  }
  return undefined;
}

function maskPartnerProfileValue(value) {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) return value.length ? ['已脱敏'] : [];
  if (isPlainObjectValue(value)) return Object.keys(value).length ? { status: '已脱敏' } : {};
  return normalizeTrimmedString(value) ? '已脱敏' : '';
}

function buildPartnerProfileDisplayValue(field, value, sensitiveVisible) {
  if (sensitiveVisible || !PARTNER_PROFILE_SENSITIVE_FIELDS.has(field)) return value;
  return maskPartnerProfileValue(value);
}

function buildPartnerProfileExtendedPayload(profile, sensitiveVisible) {
  ensurePartnerProfileCompatibility(profile);
  const extended = {};
  Object.keys(PARTNER_PROFILE_EXTENSION_DEFAULTS).forEach(field => {
    extended[field] = buildPartnerProfileDisplayValue(field, profile.extended[field], sensitiveVisible);
  });
  extended.annualRevenue = buildPartnerProfileDisplayValue('annualRevenue', profile.annualRevenue || '', sensitiveVisible);
  extended.serviceRegions = normalizeStringList(profile.serviceAreas);
  extended.majorAgencyBrands = normalizeStringList(profile.agencyBrands);
  extended.authorizedProductLines = normalizeStringList(profile.authorizedProducts);
  extended.typicalCustomers = normalizeStringList(profile.typicalCustomers);
  extended.certifications = normalizeStringList(profile.qualifications);
  return extended;
}

function applyPartnerProfileExtensionUpdates(profile, body) {
  ensurePartnerProfileCompatibility(profile);
  Object.keys(PARTNER_PROFILE_EXTENSION_DEFAULTS).forEach(field => {
    mergePartnerProfileExtensionValue(profile.extended, field, getPartnerProfileInputValue(body, field));
  });
}

function applyPartnerProfileBasicUpdates(profile, body) {
  PARTNER_PROFILE_TEXT_FIELDS.forEach(field => {
    const value = getPartnerProfileInputValue(body, field);
    if (value !== undefined) profile[field] = normalizeTrimmedString(value);
  });

  PARTNER_PROFILE_LIST_FIELDS.forEach(field => {
    const value = getPartnerProfileInputValue(body, field);
    if (value !== undefined) profile[field] = normalizeStringList(value);
  });

  Object.entries(PARTNER_PROFILE_LIST_ALIASES).forEach(([aliasField, targetField]) => {
    const value = getPartnerProfileInputValue(body, aliasField);
    if (value !== undefined) profile[targetField] = normalizeStringList(value);
  });

  applyPartnerProfileExtensionUpdates(profile, body);
}

function hasPartnerProfileInput(body) {
  if (!isPlainObjectValue(body)) return false;
  const fields = [
    ...PARTNER_PROFILE_TEXT_FIELDS,
    ...PARTNER_PROFILE_LIST_FIELDS,
    ...Object.keys(PARTNER_PROFILE_EXTENSION_DEFAULTS),
    ...Object.keys(PARTNER_PROFILE_LIST_ALIASES),
    'verified'
  ];
  return fields.some(field => getPartnerProfileInputValue(body, field) !== undefined);
}

function canMaintainPartnerProfileSettings(operator) {
  return operator?.role === 'superadmin' || operator?.role === 'admin';
}

function getRequestOperator(req) {
  const authenticatedOperator = getAuthenticatedOperator(req);
  if (authenticatedOperator) return authenticatedOperator;

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const query = req.query && typeof req.query === 'object' ? req.query : {};
  const operatorId = normalizeTrimmedString(body.operatorId || body.operatedBy || query.operatorId || query.userId);
  const user = operatorId ? (db.users || []).find(item => item.id === operatorId || item.username === operatorId) : null;
  return {
    id: user?.id || operatorId,
    role: normalizeTrimmedString(user?.role),
    region: normalizeTrimmedString(user?.region),
    partnerId: normalizeTrimmedString(user?.partnerId),
    name: normalizeTrimmedString(user?.name || body.operatorName || query.operatorName),
    resolved: Boolean(user)
  };
}

function getBearerToken(req) {
  const authHeader = normalizeTrimmedString(req.headers?.authorization);
  if (!authHeader) return '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
}

function getAuthenticatedOperator(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const tokenData = (db.tokens || []).find(item => item.token === token);
  if (!tokenData) return null;
  if (tokenData.expiresAt && new Date(tokenData.expiresAt).getTime() <= Date.now()) return null;
  const user = (db.users || []).find(item => item.id === tokenData.userId || item.username === tokenData.username);
  if (!user) return null;
  return {
    id: user.id,
    role: normalizeTrimmedString(user.role),
    region: normalizeTrimmedString(user.region),
    partnerId: normalizeTrimmedString(user.partnerId),
    name: normalizeTrimmedString(user.name),
    resolved: true
  };
}

function requireMobileOperator(req, res) {
  const operator = getAuthenticatedOperator(req);
  if (!operator) {
    res.status(401).json({ success: false, error: '登录已失效，请重新登录' });
    return null;
  }
  const user = (db.users || []).find(item => item.id === operator.id);
  if (!user || user.status === 'inactive' || user.status === 'disabled' || user.status === 'pending' || user.status === 'rejected') {
    res.status(401).json({ success: false, error: '当前账号不可用，请重新登录' });
    return null;
  }
  return operator;
}

function getMobileRecordPartnerId(record) {
  if (record?.partnerId) return record.partnerId;
  if (record?.assignedPartnerId) return record.assignedPartnerId;
  const relatedUserId = record?.assignedStaffId || record?.createdBy || record?.ownerId;
  return getUserInfo(relatedUserId || '')?.partnerId || '';
}

function getMobileRecordRegion(record) {
  if (record?.region) return record.region;
  if (record?.regId) return db.registrations.find(item => item.id === record.regId)?.region || '';
  return '';
}

function canMobileOperatorViewRecord(operator, record) {
  if (operator.role === 'superadmin') return true;
  if (operator.role === 'admin') return Boolean(operator.region && getMobileRecordRegion(record) === operator.region);
  if (operator.role === 'partner_admin') {
    return Boolean(operator.partnerId && (getMobileRecordPartnerId(record) === operator.partnerId
      || (record?.mobileV2Lifecycle === true && record?.primaryPartnerId === operator.partnerId)));
  }
  if (operator.role === 'staff') return isRecordRelatedToUser(record, operator.id);
  return false;
}

function filterMobileRecords(records, operator, query = {}) {
  const status = normalizeTrimmedString(query.status);
  const keyword = normalizeTrimmedString(query.keyword).toLowerCase();
  return records
    .filter(record => canMobileOperatorViewRecord(operator, record))
    .filter(record => !status || record.status === status || record.stage === status)
    .filter(record => {
      if (!keyword) return true;
      return [record.id, record.name, record.customer, record.customerName, record.partnerName, record.contact]
        .some(value => normalizeTrimmedString(value).toLowerCase().includes(keyword));
    })
    .map(record => ({ ...record }));
}

function buildMobilePage(records, query = {}) {
  const requestedPage = Number.parseInt(query.page, 10);
  const requestedPageSize = Number.parseInt(query.pageSize, 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0 ? Math.min(requestedPageSize, 50) : 20;
  const total = records.length;
  return {
    data: records.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total
  };
}

function requireMobileRole(operator, res, roles) {
  if (roles.includes(operator.role)) return true;
  res.status(403).json({ success: false, error: '当前账号无权执行此操作' });
  return false;
}

function getMobilePartnerName(partnerId) {
  return (db.partners || []).find(item => item.id === partnerId)?.name || '';
}

function pickMobileInput(body, fields) {
  return fields.reduce((result, field) => {
    if (body[field] !== undefined) result[field] = body[field];
    return result;
  }, {});
}

function sendMobileRecordDetail(req, res, records, recordLabel) {
  const operator = requireMobileOperator(req, res);
  if (!operator) return;
  const record = (records || []).find(item => item.id === req.params.id);
  if (!record) return res.status(404).json({ success: false, error: `${recordLabel}不存在` });
  if (!canMobileOperatorViewRecord(operator, record)) {
    return res.status(403).json({ success: false, error: `无权查看该${recordLabel}` });
  }
  return res.json({ success: true, data: { ...record } });
}

const MOBILE_FOLLOW_UP_TYPES = new Set(['电话', '拜访', '会议', '演示', '邮件', '其他']);
const MOBILE_OPPORTUNITY_STAGES = new Set(['contacted', 'registered', 'quoted', 'budget', 'design', 'testing', 'negotiation', 'won', 'lost']);

function buildMobileUniqueRecordId(prefix, records = []) {
  const existingIds = new Set((records || []).map(item => item && item.id).filter(Boolean));
  const base = `${prefix}-${Date.now()}`;
  let id = base;
  let index = 1;
  while (existingIds.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

function normalizeMobileFollowUpType(value) {
  const type = normalizeTrimmedString(value) || '电话';
  return MOBILE_FOLLOW_UP_TYPES.has(type) ? type : '其他';
}

function normalizeMobileOpportunityStage(value, fallback = 'contacted') {
  const stage = normalizeTrimmedString(value);
  if (!stage) return fallback;
  return MOBILE_OPPORTUNITY_STAGES.has(stage) ? stage : '';
}

function findMobileQuoteOpportunity(quote) {
  const ids = [
    ...(Array.isArray(quote?.oppIds) ? quote.oppIds : []),
    quote?.oppId,
    quote?.opportunityId
  ].map(normalizeTrimmedString).filter(Boolean);
  return (db.opportunities || []).find(item => ids.includes(item.id)) || null;
}

function findMobileQuoteRegistration(quote, opportunity) {
  const regId = normalizeTrimmedString(quote?.regId || quote?.registrationId || opportunity?.regId);
  if (!regId) return null;
  return (db.registrations || []).find(item => item.id === regId) || null;
}

function getMobileQuoteAmount(quote) {
  return normalizePositiveNumber(quote?.total ?? quote?.totalAmount ?? quote?.amount ?? quote?.subtotal ?? quote?.originalTotal);
}

function buildMobileOrderFromQuote(req, operator, quote, body) {
  const opportunity = findMobileQuoteOpportunity(quote);
  const registration = findMobileQuoteRegistration(quote, opportunity);
  const user = (db.users || []).find(item => item.id === operator.id) || {};
  const now = new Date().toISOString();
  const partnerId = normalizeTrimmedString(quote.partnerId || quote.assignedPartnerId || operator.partnerId);
  const partner = (db.partners || []).find(item => item.id === partnerId) || null;
  const parentPartnerIds = Array.isArray(partner?.parentPartnerIds)
    ? partner.parentPartnerIds
    : (partner?.parentPartnerId ? [partner.parentPartnerId] : []);
  const requestedParentPartnerId = normalizeTrimmedString(body.selectedParentPartnerId || body.primaryPartnerId);
  let assignedPartnerId = requestedParentPartnerId || normalizeTrimmedString(quote.assignedPartnerId || quote.primaryPartnerId || quote.parentPartnerId || partnerId);
  let assignedPartnerName = normalizeTrimmedString(quote.assignedPartnerName || quote.primaryPartnerName || getMobilePartnerName(assignedPartnerId));

  if (partner?.partnerLevel === 'secondary') {
    if (!assignedPartnerId || assignedPartnerId === partnerId) assignedPartnerId = parentPartnerIds[0] || '';
    if (!assignedPartnerId || !parentPartnerIds.includes(assignedPartnerId)) {
      return {
        error: {
          status: 400,
          body: {
            success: false,
            error: '二级渠道商转订单必须选择已绑定的一级渠道商',
            code: 'SECONDARY_PARTNER_MUST_ORDER_THROUGH_PRIMARY'
          }
        }
      };
    }
    assignedPartnerName = getMobilePartnerName(assignedPartnerId);
  }

  const total = getMobileQuoteAmount(quote);
  const customer = normalizeTrimmedString(quote.customerName || quote.customer || opportunity?.customer || registration?.customer);
  const deliveryContactName = normalizeTrimmedString(body.deliveryContactName);
  const deliveryContactPhone = normalizeTrimmedString(body.deliveryContactPhone);
  const deliveryAddress = normalizeTrimmedString(body.deliveryAddress);
  const order = {
    id: buildMobileUniqueRecordId('ORD', db.orders || []),
    quoteId: quote.id,
    oppId: quote.oppId || opportunity?.id || '',
    oppIds: Array.isArray(quote.oppIds) ? cloneAuditValue(quote.oppIds) : (quote.oppId ? [quote.oppId] : []),
    regId: quote.regId || registration?.id || opportunity?.regId || '',
    customer,
    customerName: customer,
    project: quote.project || opportunity?.name || registration?.project || '',
    products: cloneAuditValue(quote.products || []),
    productIds: cloneAuditValue(quote.productIds || []),
    hardwareIds: cloneAuditValue(quote.hardwareIds || []),
    items: cloneAuditValue(quote.items || quote.quoteItems || []),
    endpoints: quote.endpoints || opportunity?.endpoints || registration?.endpoints || '',
    amount: total,
    total,
    totalAmount: total,
    currency: quote.currency || 'CNY',
    deliveryContactName,
    deliveryContactPhone,
    deliveryAddress,
    deliveryAddr: deliveryAddress,
    contacts: [deliveryContactName, deliveryContactPhone].filter(Boolean).join(' / '),
    invoiceTitle: normalizeTrimmedString(body.invoiceTitle),
    remark: normalizeTrimmedString(body.remark),
    quoteSnapshot: {
      id: quote.id,
      status: quote.status,
      total,
      amount: total,
      totalAmount: total,
      currency: quote.currency || 'CNY',
      products: cloneAuditValue(quote.products || []),
      productIds: cloneAuditValue(quote.productIds || []),
      hardwareIds: cloneAuditValue(quote.hardwareIds || []),
      items: cloneAuditValue(quote.items || quote.quoteItems || [])
    },
    region: quote.region || opportunity?.region || registration?.region || operator.region || user.region || '',
    partnerId,
    partnerName: normalizeTrimmedString(quote.partnerName || getMobilePartnerName(partnerId)),
    assignedPartnerId,
    assignedPartnerName,
    parentPartnerId: partner?.partnerLevel === 'secondary' ? assignedPartnerId : null,
    createdBy: operator.id,
    createdByName: operator.name,
    assignedStaffId: quote.assignedStaffId || quote.createdBy || opportunity?.assignedStaffId || operator.id,
    assignedStaffName: quote.assignedStaffName || quote.createdByName || opportunity?.assignedStaffName || operator.name,
    source: 'mobile',
    status: 'pending',
    statusHistory: [{
      from: 'confirmed',
      to: 'pending',
      action: 'convert_order',
      operatorId: operator.id,
      operatorName: operator.name,
      changedAt: now
    }],
    createdAt: now,
    updatedAt: now
  };
  normalizeAssignedStaffForWrite(order);
  return { order };
}

function canMobileOperatorViewPartner(operator, partner) {
  return operator.role === 'superadmin' || (operator.role === 'admin' && partner.region === operator.region);
}

function sendMobilePartnerDetail(req, res) {
  const operator = requireMobileOperator(req, res);
  if (!operator || !requireMobileRole(operator, res, ['admin', 'superadmin'])) return;
  const partner = (db.partners || []).find(item => item.id === req.params.id);
  if (!partner) return res.status(404).json({ success: false, error: '渠道商不存在' });
  if (!canMobileOperatorViewPartner(operator, partner)) {
    return res.status(403).json({ success: false, error: '无权查看该渠道商' });
  }
  return res.json({ success: true, data: { ...partner } });
}

// ========== H5 二期受保护只读接口 ==========
// 二期写入规则尚未冻结前，仅提供令牌鉴权的查询能力，避免产生不可回退的业务数据。
// 功能开关仅从服务端环境配置读取，当前不提供修改接口，避免在规则未冻结时误开放写入。
const MOBILE_V2_PRIMARY_AUTH_METHODS = new Set(['password', 'sso']);
const MOBILE_V2_REAUTH_METHODS = new Set(['password', 'sso', 'sms']);

function getMobileV2BooleanEnv(name, fallback = false) {
  const value = normalizeTrimmedString(process.env[name]).toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function isMobileV2ExperimentalEnabled() {
  return getMobileV2BooleanEnv('MOBILE_V2_EXPERIMENTAL_ENABLED', false);
}

function getMobileV2PositiveIntegerEnv(name, fallback, max) {
  const parsed = Number.parseInt(normalizeTrimmedString(process.env[name]), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function getMobileV2ConfiguredAuthMethod(name, allowedMethods) {
  const value = normalizeTrimmedString(process.env[name]).toLowerCase();
  return allowedMethods.has(value) ? value : 'unconfirmed';
}

function getMobileV2RefreshCookieName() {
  const configured = normalizeTrimmedString(process.env.MOBILE_V2_REFRESH_COOKIE_NAME);
  return /^[A-Za-z0-9_-]{1,64}$/.test(configured) ? configured : 'mobile_v2_refresh';
}

function getMobileV2SessionConfig() {
  const primaryAuthMethod = getMobileV2ConfiguredAuthMethod('MOBILE_V2_PRIMARY_AUTH_METHOD', MOBILE_V2_PRIMARY_AUTH_METHODS);
  const reauthMethod = getMobileV2ConfiguredAuthMethod('MOBILE_V2_REAUTH_METHOD', MOBILE_V2_REAUTH_METHODS);
  return {
    experimentalEnabled: isMobileV2ExperimentalEnabled(),
    // 默认关闭。即使配置为开启，当前版本也不提供登录、刷新或再次验证接口。
    independentSessionEnabled: getMobileV2BooleanEnv('MOBILE_V2_INDEPENDENT_SESSION_ENABLED', false),
    primaryAuthMethod,
    reauthMethod,
    accessTokenTtlSeconds: getMobileV2PositiveIntegerEnv('MOBILE_V2_ACCESS_TOKEN_TTL_SECONDS', 900, 1800),
    refreshTokenTtlSeconds: getMobileV2PositiveIntegerEnv('MOBILE_V2_REFRESH_TOKEN_TTL_SECONDS', 1209600, 2592000),
    refreshCookieName: getMobileV2RefreshCookieName(),
    refreshCookiePath: '/api/mobile/v2/session',
    refreshCookieHttpOnly: true,
    refreshCookieSecure: true,
    refreshCookieSameSite: 'strict',
    refreshRotationRequired: true,
    csrfRequired: true,
    hstsEnabled: getMobileV2BooleanEnv('MOBILE_V2_HSTS_ENABLED', false)
  };
}

function isMobileV2RequestPath(requestPath) {
  const pathName = String(requestPath || '');
  return pathName === '/api/mobile/v2' || pathName.startsWith('/api/mobile/v2/');
}

function isMobileV2HttpsRequest(req) {
  if (req.secure === true) return true;
  return normalizeTrimmedString(req.headers?.['x-forwarded-proto']).toLowerCase() === 'https';
}

function applyMobileV2SecurityHeaders(req, res) {
  const config = getMobileV2SessionConfig();
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Security-Policy', "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=(), usb=()');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  // 仅在反向代理已确认 HTTPS 且显式配置后发送 HSTS，避免本地和未完成 HTTPS 迁移的环境误用。
  if (config.hstsEnabled && isMobileV2HttpsRequest(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

const MOBILE_V2_FEATURE_FLAG_CATALOG = {
  dashboard: ['read'],
  notification: ['read'],
  registration: ['read', 'create', 'update', 'submit', 'review'],
  opportunity: ['read', 'create', 'update', 'advance', 'follow_up'],
  catalog: ['read'],
  quote: ['read', 'create', 'update', 'submit', 'review', 'convert_order'],
  order: ['read', 'create', 'update', 'primary_review', 'fulfill', 'adjust_price', 'cancel'],
  partner: ['read', 'manage'],
  approval: ['read', 'review'],
  session: ['read', 'logout']
};

function normalizeMobileV2FeatureFlagValue(value) {
  return normalizeTrimmedString(value).toLowerCase();
}

function toMobileV2FeatureFlagList(value) {
  const source = Array.isArray(value) ? value : (value === undefined || value === null ? [] : [value]);
  return source
    .map(item => normalizeMobileV2FeatureFlagValue(item))
    .filter(Boolean);
}

function getMobileV2FeatureFlagRules() {
  const text = normalizeTrimmedString(process.env.MOBILE_V2_FEATURE_FLAGS);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') : [];
  } catch (error) {
    // 配置格式错误时保持最小权限：所有业务写入继续关闭。
    return [];
  }
}

function getMobileV2FeatureFlagRuleScope(rule, singularKey, pluralKey) {
  return toMobileV2FeatureFlagList(rule[pluralKey] !== undefined ? rule[pluralKey] : rule[singularKey]);
}

function isMobileV2FeatureFlagScopeMatched(values, actualValue) {
  if (!values.length || values.includes('*')) return true;
  const actual = normalizeMobileV2FeatureFlagValue(actualValue);
  return Boolean(actual && values.includes(actual));
}

function getMobileV2FeatureFlagRuleScore(rule, moduleName, action) {
  const ruleModule = normalizeMobileV2FeatureFlagValue(rule.module || '*');
  const ruleAction = normalizeMobileV2FeatureFlagValue(rule.action || '*');
  const roles = getMobileV2FeatureFlagRuleScope(rule, 'role', 'roles');
  const regions = getMobileV2FeatureFlagRuleScope(rule, 'region', 'regions');
  const partnerIds = getMobileV2FeatureFlagRuleScope(rule, 'partnerId', 'partnerIds');
  return (ruleModule === moduleName ? 32 : 0)
    + (ruleAction === action ? 16 : 0)
    + (roles.length ? 8 : 0)
    + (regions.length ? 4 : 0)
    + (partnerIds.length ? 2 : 0);
}

function getMobileV2FeatureFlagDecision(operator, moduleName, action) {
  const normalizedModule = normalizeMobileV2FeatureFlagValue(moduleName);
  const normalizedAction = normalizeMobileV2FeatureFlagValue(action);
  // 仅查询动作默认开放；所有二期业务写入默认关闭，必须由明确规则逐项开启。
  const defaultEnabled = normalizedAction === 'read';
  let matchedRule = null;
  let matchedScore = -1;

  getMobileV2FeatureFlagRules().forEach(rule => {
    const ruleModule = normalizeMobileV2FeatureFlagValue(rule.module || '*');
    const ruleAction = normalizeMobileV2FeatureFlagValue(rule.action || '*');
    if (ruleModule !== '*' && ruleModule !== normalizedModule) return;
    if (ruleAction !== '*' && ruleAction !== normalizedAction) return;
    if (!isMobileV2FeatureFlagScopeMatched(getMobileV2FeatureFlagRuleScope(rule, 'role', 'roles'), operator.role)) return;
    if (!isMobileV2FeatureFlagScopeMatched(getMobileV2FeatureFlagRuleScope(rule, 'region', 'regions'), operator.region)) return;
    if (!isMobileV2FeatureFlagScopeMatched(getMobileV2FeatureFlagRuleScope(rule, 'partnerId', 'partnerIds'), operator.partnerId)) return;
    const score = getMobileV2FeatureFlagRuleScore(rule, normalizedModule, normalizedAction);
    if (score >= matchedScore) {
      matchedRule = rule;
      matchedScore = score;
    }
  });

  return {
    enabled: matchedRule ? matchedRule.enabled === true : defaultEnabled,
    configured: Boolean(matchedRule)
  };
}

function isMobileV2FeatureEnabled(operator, moduleName, action) {
  return getMobileV2FeatureFlagDecision(operator, moduleName, action).enabled;
}

function requireMobileV2Feature(req, res, operator, moduleName, action) {
  if (isMobileV2FeatureEnabled(operator, moduleName, action)) return true;
  sendMobileV2Error(req, res, 403, 'FEATURE_DISABLED', '当前二期功能未开放，请使用已授权的查询能力或电脑端继续处理');
  return false;
}

function buildMobileV2FeatureFlags(operator) {
  const modules = Object.entries(MOBILE_V2_FEATURE_FLAG_CATALOG).reduce((result, [moduleName, actions]) => {
    result[moduleName] = actions.reduce((actionResult, action) => {
      actionResult[action] = isMobileV2FeatureEnabled(operator, moduleName, action);
      return actionResult;
    }, {});
    return result;
  }, {});
  const contracts = Object.entries(MOBILE_V2_WRITE_CONTRACTS).reduce((result, [key, contract]) => {
    const businessConfigReady = isMobileV2WriteContractBusinessConfigReady(operator, key);
    const featureEnabled = isMobileV2FeatureEnabled(operator, contract.module, contract.action);
    result[key] = {
      published: featureEnabled && businessConfigReady,
      method: contract.method,
      path: contract.path,
      module: contract.module,
      action: contract.action,
      businessConfigReady
    };
    return result;
  }, {});
  return {
    version: 'v2-controlled-write-1',
    scope: {
      role: operator.role,
      region: operator.region || '',
      partnerId: operator.partnerId || ''
    },
    modules,
    contracts
  };
}

function sendMobileV2Error(req, res, status, code, error) {
  return res.status(status).json({
    success: false,
    code,
    error,
    requestId: req.requestId
  });
}

function sendMobileV2Success(req, res, payload = {}) {
  return res.json({ success: true, requestId: req.requestId, ...payload });
}

function getMobileV2TokenFingerprint(token) {
  if (!token) return '';
  return crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 16);
}

function revokeMobileV2Session(req, operator, reason, action = 'session_revoke') {
  const token = getBearerToken(req);
  const tokenData = (db.tokens || []).find(item => item.token === token);
  if (!tokenData) return false;

  db.tokens = (db.tokens || []).filter(item => item.token !== token);
  ensureMobileV2BusinessStores();
  const sessionFingerprint = buildMobileV2SessionFingerprint(req);
  if (sessionFingerprint) {
    db.mobileV2RegistrationDrafts = db.mobileV2RegistrationDrafts.filter(item => item.sessionFingerprint !== sessionFingerprint);
    db.mobileV2OrderDrafts = db.mobileV2OrderDrafts.filter(item => item.sessionFingerprint !== sessionFingerprint);
  }
  // 令牌当前仅存在于内存，仍调用现有持久化流程以保持与既有退出行为一致。
  saveData();
  const user = (db.users || []).find(item => item.id === operator?.id) || {};
  writeAuditLog(req, {
    module: 'auth',
    action,
    result: 'success',
    message: action === 'logout' ? '移动端二期退出登录' : `移动端二期会话已失效：${reason}`,
    actor: {
      userId: operator?.id || tokenData.userId || '',
      username: user.username || tokenData.username || '',
      name: operator?.name || user.name || '',
      role: operator?.role || user.role || ''
    },
    targetType: 'user',
    targetId: operator?.id || tokenData.userId || '',
    targetName: operator?.name || user.name || tokenData.username || '',
    extra: {
      reason,
      sessionTokenFingerprint: getMobileV2TokenFingerprint(token),
      tokenType: tokenData.type || ''
    }
  });
  return true;
}

function getMobileV2TokenState(req) {
  const token = getBearerToken(req);
  if (!token) return { valid: false, reason: 'missing' };
  const tokenData = (db.tokens || []).find(item => item.token === token);
  if (!tokenData) return { valid: false, reason: 'revoked' };
  if (tokenData.expiresAt && new Date(tokenData.expiresAt).getTime() <= Date.now()) {
    const user = (db.users || []).find(item => item.id === tokenData.userId || item.username === tokenData.username);
    revokeMobileV2Session(req, user ? {
      id: user.id,
      role: normalizeTrimmedString(user.role),
      name: normalizeTrimmedString(user.name)
    } : null, '令牌已过期');
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, tokenData };
}

function getMobileV2Operator(req, res) {
  const tokenState = getMobileV2TokenState(req);
  if (!tokenState.valid) {
    sendMobileV2Error(req, res, 401, 'AUTH_REQUIRED', '登录已失效，请重新登录');
    return null;
  }
  const authenticated = getAuthenticatedOperator(req);
  if (!authenticated) {
    sendMobileV2Error(req, res, 401, 'AUTH_REQUIRED', '登录已失效，请重新登录');
    return null;
  }

  const user = (db.users || []).find(item => item.id === authenticated.id);
  if (!user || ['inactive', 'disabled', 'pending', 'rejected'].includes(user.status)) {
    revokeMobileV2Session(req, authenticated, '账号状态不可用');
    sendMobileV2Error(req, res, 401, 'ACCOUNT_UNAVAILABLE', '当前账号不可用，请重新登录');
    return null;
  }

  const operator = { ...authenticated };
  if (!['staff', 'partner_admin'].includes(operator.role)) return operator;

  const userInfo = getUserInfo(operator.id);
  const partnerId = operator.partnerId || userInfo.partnerId;
  const partner = (db.partners || []).find(item => item.id === partnerId);
  if (!partner || ['pending', 'rejected', 'disabled', 'inactive'].includes(partner.status)) {
    revokeMobileV2Session(req, operator, '所属渠道商状态不可用');
    sendMobileV2Error(req, res, 401, 'PARTNER_UNAVAILABLE', '所属渠道商当前不可用，请联系管理员');
    return null;
  }

  operator.partnerId = partnerId;
  return operator;
}

app.use('/api/mobile/v2', (req, res, next) => {
  if (isMobileV2ExperimentalEnabled()) return next();
  return sendMobileV2Error(req, res, 404, 'V2_DISABLED', '移动端二期未开放，请使用一期手机端或电脑端继续处理');
});

function buildMobileV2User(operator) {
  const user = (db.users || []).find(item => item.id === operator.id) || {};
  const partner = (db.partners || []).find(item => item.id === operator.partnerId) || {};
  return {
    id: operator.id,
    username: user.username || '',
    name: operator.name || user.name || '',
    role: operator.role,
    region: operator.region || '',
    partnerId: operator.partnerId || '',
    partnerName: user.partnerName || partner.name || '',
    partnerLevel: partner.partnerLevel || 'none'
  };
}

function pickMobileV2Fields(source, fields) {
  return fields.reduce((result, field) => {
    if (source && source[field] !== undefined) result[field] = source[field];
    return result;
  }, {});
}

function maskMobileV2Phone(value) {
  const text = normalizeTrimmedString(value);
  if (!text) return '';
  if (text.length <= 4) return '已脱敏';
  return `${text.slice(0, 3)}****${text.slice(-4)}`;
}

function maskMobileV2Email(value) {
  const text = normalizeTrimmedString(value);
  if (!text) return '';
  const [name, domain] = text.split('@');
  if (!domain) return '已脱敏';
  return `${(name || '').slice(0, 1)}***@${domain}`;
}

function maskMobileV2CreditCode(value) {
  const text = normalizeTrimmedString(value);
  if (!text) return '';
  if (text.length <= 4) return '已脱敏';
  return `****${text.slice(-4)}`;
}

function maskMobileV2Name(value) {
  const text = normalizeTrimmedString(value);
  if (!text) return '';
  return text.length === 1 ? '*' : `${text.slice(0, 1)}*`;
}

function buildMobileV2SensitiveDetail(record, type) {
  const source = record || {};
  if (type === 'registration') {
    return pickMobileV2Fields({
      contact: maskMobileV2Name(source.contact),
      phone: maskMobileV2Phone(source.phone),
      email: maskMobileV2Email(source.email),
      creditCode: maskMobileV2CreditCode(source.creditCode),
      legalPerson: maskMobileV2Name(source.legalPerson),
      address: normalizeTrimmedString(source.address) ? '已脱敏' : ''
    }, ['contact', 'phone', 'email', 'creditCode', 'legalPerson', 'address']);
  }
  if (type === 'opportunity') {
    return pickMobileV2Fields({
      contact: maskMobileV2Name(source.contact),
      phone: maskMobileV2Phone(source.phone)
    }, ['contact', 'phone']);
  }
  if (type === 'order') {
    return pickMobileV2Fields({
      deliveryAddr: normalizeTrimmedString(source.deliveryAddr) ? '已脱敏' : '',
      deliveryAddress: normalizeTrimmedString(source.deliveryAddress) ? '已脱敏' : '',
      contacts: source.contacts ? '已脱敏' : ''
    }, ['deliveryAddr', 'deliveryAddress', 'contacts']);
  }
  if (type === 'partner') {
    return pickMobileV2Fields({
      contact: maskMobileV2Name(source.contact),
      phone: maskMobileV2Phone(source.phone),
      email: maskMobileV2Email(source.email)
    }, ['contact', 'phone', 'email']);
  }
  return {};
}

function buildMobileV2Record(record, type, detail = false) {
  const commonFields = ['id', 'status', 'stage', 'createdAt', 'updatedAt', 'region', 'partnerId', 'partnerName', 'assignedPartnerId', 'assignedPartnerName'];
  const fieldsByType = {
    registration: ['customer', 'industry', 'city', 'project', 'estimatedAmt', 'signDate', 'expireAt', 'createdByName', 'assignedStaffName'],
    opportunity: ['name', 'customer', 'industry', 'amount', 'endpoints', 'probability', 'expectedClose', 'source', 'regId', 'quoteId', 'owner', 'ownerId', 'createdByName', 'assignedStaffName', 'tags'],
    quote: ['customer', 'customerName', 'regId', 'oppId', 'oppIds', 'total', 'amount', 'endpoints', 'validDays', 'createdByName', 'assignedStaffName'],
    order: ['customer', 'customerName', 'quoteId', 'oppId', 'regId', 'total', 'amount', 'createdByName', 'assignedStaffName', 'parentPartnerId'],
    partner: ['name', 'level', 'partnerLevel', 'region', 'city', 'status', 'joinDate', 'techServiceType']
  };
  const base = pickMobileV2Fields(record, [...commonFields, ...(fieldsByType[type] || [])]);
  // 仅向二期新建对象返回乐观锁版本。历史对象继续只读，不能借由版本字段进入移动端写入流程。
  if (detail && ['registration', 'opportunity', 'quote', 'order'].includes(type) && record && record.mobileV2Lifecycle === true
    && Number.isInteger(record.version) && record.version > 0) {
    base.version = record.version;
  }
  if (!detail) return base;

  if (type === 'registration') {
    return { ...base, ...pickMobileV2Fields(record, ['companyStatus', 'endpointRange', 'protectDays', 'approvedBy', 'approvedAt']), ...buildMobileV2SensitiveDetail(record, type) };
  }
  if (type === 'opportunity') {
    return { ...base, ...pickMobileV2Fields(record, ['lastFollowAt']), ...buildMobileV2SensitiveDetail(record, type) };
  }
  if (type === 'quote') {
    return { ...base, ...pickMobileV2Fields(record, ['products', 'hardwareIds', 'quoteMode', 'originalTotal', 'discountAmount', 'taxAmount', 'taxRate', 'currency', 'items', 'approvalStatus', 'expiresAt', 'convertedOrderId', 'statusHistory']) };
  }
  if (type === 'order') {
    return { ...base, ...pickMobileV2Fields(record, ['currency', 'items', 'discountAmount', 'taxAmount', 'taxRate', 'primaryPartnerId', 'primaryPartnerName', 'primaryReviewedBy', 'primaryReviewReasonCode', 'statusHistory', 'priceAdjustments', 'primaryConfirmedByName', 'primaryConfirmedAt', 'primaryConfirmRemark']), ...buildMobileV2SensitiveDetail(record, type) };
  }
  return { ...base, ...buildMobileV2SensitiveDetail(record, type) };
}

function sortMobileV2Records(records) {
  return records.slice().sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.createdAt || left.joinDate || 0).getTime() || 0;
    const rightTime = new Date(right.updatedAt || right.createdAt || right.joinDate || 0).getTime() || 0;
    return rightTime - leftTime;
  });
}

function sendMobileV2RecordList(req, res, records, type) {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, type, 'read')) return;
  const page = buildMobilePage(sortMobileV2Records(filterMobileRecords(records, operator, req.query)), req.query);
  return sendMobileV2Success(req, res, {
    data: page.data.map(item => buildMobileV2Record(item, type)),
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    hasMore: page.hasMore
  });
}

function sendMobileV2RecordDetail(req, res, records, type, label) {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, type, 'read')) return;
  const record = (records || []).find(item => item.id === req.params.id);
  if (!record) return sendMobileV2Error(req, res, 404, 'NOT_FOUND', `${label}不存在`);
  if (!canMobileOperatorViewRecord(operator, record)) {
    return sendMobileV2Error(req, res, 403, 'FORBIDDEN', `无权查看该${label}`);
  }
  return sendMobileV2Success(req, res, { data: buildMobileV2Record(record, type, true) });
}

function canMobileV2OperatorViewPartner(operator, partner) {
  return operator.role === 'superadmin' || (operator.role === 'admin' && operator.region === partner.region);
}

function buildMobileV2Catalog() {
  const visible = item => item && item.status === 'active' && item.published !== false;
  const categories = (db.categories || []).filter(visible).map(item => pickMobileV2Fields(item, ['id', 'name', 'type', 'icon', 'sort', 'desc']));
  const modules = (db.modules || []).filter(visible).map(item => pickMobileV2Fields(item, ['id', 'categoryId', 'name', 'icon', 'sort', 'desc']));
  const features = (db.features || []).filter(visible).map(item => pickMobileV2Fields(item, ['id', 'moduleId', 'name', 'productCode', 'unit', 'desc']));
  const hardware = (db.hardwareProducts || []).filter(visible).map(item => pickMobileV2Fields(item, ['id', 'categoryId', 'name', 'model', 'icon', 'unit', 'desc', 'specs']));
  const packages = (db.packages || []).filter(visible).map(item => pickMobileV2Fields(item, ['id', 'name', 'icon', 'desc', 'featureIds', 'hardwareIds', 'moduleIds']));
  return { categories, modules, features, hardware, packages };
}

function buildMobileV2Dashboard(operator) {
  const user = (db.users || []).find(item => item.id === operator.id);
  const registrations = filterMobileRecords(db.registrations || [], operator, {});
  const opportunities = filterMobileRecords(db.opportunities || [], operator, {});
  const quotes = filterMobileRecords(db.quotes || [], operator, {});
  const orders = filterMobileRecords(db.orders || [], operator, {});
  const notifications = listNotificationsForUser(operator.id);
  const canReviewRegistrations = ['admin', 'superadmin'].includes(operator.role);
  const canReviewApprovals = operator.role === 'superadmin';
  const partners = ['admin', 'superadmin'].includes(operator.role)
    ? (db.partners || []).filter(item => canMobileV2OperatorViewPartner(operator, item))
    : [];
  const dueReminderCount = user ? buildLoginDueReminders(user).length : 0;
  return {
    counts: {
      registrations: registrations.length,
      opportunities: opportunities.length,
      quotes: quotes.length,
      orders: orders.length,
      partners: partners.length,
      pendingRegistrations: canReviewRegistrations ? registrations.filter(item => ['pending', 'reviewing'].includes(item.status)).length : 0,
      pendingApprovals: canReviewApprovals ? (db.pendingApprovals || []).filter(item => item.status === 'pending').length : 0,
      unreadNotifications: notifications.filter(item => item.unread).length,
      dueReminders: dueReminderCount
    }
  };
}

// 二期首批受控写入仅服务于报备与商机。所有规则参数均来自独立配置实体，缺失时拒绝动作。
const MOBILE_V2_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MOBILE_V2_REGISTRATION_FIELDS = [
  'customer', 'creditCode', 'industry', 'contact', 'phone', 'email',
  'city', 'project', 'endpointRange', 'estimatedAmt', 'signDate', 'notes'
];
const MOBILE_V2_OPPORTUNITY_FIELDS = [
  'name', 'amount', 'expectedClose', 'contact', 'phone', 'endpoints',
  'source', 'notes', 'tags', 'productIntent', 'competitionInfo'
];
const MOBILE_V2_NUMERIC_INPUT_FIELDS = new Set(['estimatedAmt', 'amount', 'endpoints']);

function ensureMobileV2BusinessStores() {
  ['mobileV2BusinessConfigs', 'mobileV2RegistrationDrafts', 'mobileV2OrderDrafts', 'mobileV2BusinessEvents', 'mobileV2IdempotencyRecords'].forEach(key => {
    if (!Array.isArray(db[key])) db[key] = [];
  });
}

function cloneMobileV2BusinessValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function buildMobileV2MutationSnapshot() {
  ensureMobileV2BusinessStores();
  return {
    registrations: cloneMobileV2BusinessValue(db.registrations || []),
    opportunities: cloneMobileV2BusinessValue(db.opportunities || []),
    quotes: cloneMobileV2BusinessValue(db.quotes || []),
    orders: cloneMobileV2BusinessValue(db.orders || []),
    mobileV2RegistrationDrafts: cloneMobileV2BusinessValue(db.mobileV2RegistrationDrafts),
    mobileV2OrderDrafts: cloneMobileV2BusinessValue(db.mobileV2OrderDrafts),
    mobileV2BusinessEvents: cloneMobileV2BusinessValue(db.mobileV2BusinessEvents),
    mobileV2IdempotencyRecords: cloneMobileV2BusinessValue(db.mobileV2IdempotencyRecords)
  };
}

function restoreMobileV2MutationSnapshot(snapshot) {
  Object.keys(snapshot || {}).forEach(key => {
    db[key] = snapshot[key];
  });
}

function getMobileV2ConfigScopeValues(config, key) {
  const scope = config && typeof config.scope === 'object' ? config.scope : {};
  const pluralKey = `${key}s`;
  const value = scope[pluralKey] !== undefined ? scope[pluralKey]
    : (scope[key] !== undefined ? scope[key]
      : (config[pluralKey] !== undefined ? config[pluralKey] : config[key]));
  return toMobileV2FeatureFlagList(value);
}

function isMobileV2ConfigScopeMatched(values, actualValue) {
  return isMobileV2FeatureFlagScopeMatched(values, actualValue);
}

function findMobileV2BusinessConfig(configId, operator) {
  ensureMobileV2BusinessStores();
  const now = Date.now();
  return db.mobileV2BusinessConfigs.find(config => {
    if (!config || config.id !== configId || config.status !== 'active') return false;
    const effectiveAt = new Date(config.effectiveAt || 0).getTime();
    const expiresAt = new Date(config.expiresAt || 0).getTime();
    if (Number.isFinite(effectiveAt) && effectiveAt > 0 && effectiveAt > now) return false;
    if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= now) return false;
    return isMobileV2ConfigScopeMatched(getMobileV2ConfigScopeValues(config, 'role'), operator.role)
      && isMobileV2ConfigScopeMatched(getMobileV2ConfigScopeValues(config, 'region'), operator.region)
      && isMobileV2ConfigScopeMatched(getMobileV2ConfigScopeValues(config, 'partnerId'), operator.partnerId);
  }) || null;
}

function getMobileV2ConfigValues(config) {
  return config && config.values && typeof config.values === 'object' ? config.values : {};
}

function createMobileV2BusinessError(status, code, error) {
  return { error: { status, code, error } };
}

function createMobileV2BusinessConfigError() {
  return createMobileV2BusinessError(422, 'BUSINESS_CONFIG_MISSING', '二期业务参数未配置、未启用或不适用于当前范围');
}

function normalizeMobileV2CustomerName(value) {
  return normalizeTrimmedString(value).toLowerCase().replace(/[\s\u3000()（）【】\[\]{}<>《》,，.。;；:：'"“”‘’_-]/g, '');
}

function normalizeMobileV2CreditCode(value) {
  return normalizeTrimmedString(value).toUpperCase().replace(/[\s-]/g, '');
}

function buildMobileV2EntityId(prefix) {
  const suffix = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 18)
    : `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
  return `${prefix}-${suffix}`;
}

function buildMobileV2SessionFingerprint(req) {
  const token = getBearerToken(req);
  return token ? crypto.createHash('sha256').update(token).digest('hex').slice(0, 32) : '';
}

function buildMobileV2StableJson(value) {
  if (Array.isArray(value)) return `[${value.map(item => buildMobileV2StableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${buildMobileV2StableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

function getMobileV2IdempotencyContext(req, operator, operation) {
  const key = normalizeTrimmedString(req.headers['idempotency-key']);
  if (!key) return { error: createMobileV2BusinessError(400, 'IDEMPOTENCY_KEY_REQUIRED', '写入请求必须携带 Idempotency-Key') };
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
    return { error: createMobileV2BusinessError(400, 'IDEMPOTENCY_KEY_INVALID', 'Idempotency-Key 格式不正确') };
  }
  const requestHash = crypto.createHash('sha256')
    .update(buildMobileV2StableJson(req.body && typeof req.body === 'object' ? req.body : {}))
    .digest('hex');
  return { key, requestHash, operation, operatorId: operator.id };
}

function cleanupExpiredMobileV2IdempotencyRecords() {
  ensureMobileV2BusinessStores();
  const now = Date.now();
  db.mobileV2IdempotencyRecords = db.mobileV2IdempotencyRecords.filter(record => {
    const expiresAt = new Date(record.expiresAt || 0).getTime();
    return !Number.isFinite(expiresAt) || expiresAt <= 0 || expiresAt > now;
  });
}

function createMobileV2Event(req, operator, options = {}) {
  ensureMobileV2BusinessStores();
  const event = {
    id: buildMobileV2EntityId('V2EVT'),
    objectType: options.objectType || '',
    objectId: options.objectId || '',
    action: options.action || '',
    beforeStatus: options.beforeStatus || '',
    afterStatus: options.afterStatus || '',
    reasonCode: options.reasonCode || '',
    summary: options.summary || '',
    actorId: operator.id,
    actorName: operator.name || '',
    actorRole: operator.role,
    requestId: req.requestId || '',
    clientVersion: normalizeTrimmedString(req.headers['x-client-version']).slice(0, 100),
    source: 'mobile_v2',
    version: Number.isInteger(options.version) ? options.version : 0,
    createdAt: new Date().toISOString()
  };
  db.mobileV2BusinessEvents.push(event);
  return event;
}

function writeMobileV2BusinessAudit(req, operator, event, targetName = '') {
  // 即使审计存储暂时不可用，也禁止通用审计回退记录原始草稿和联系人字段。
  req.auditLogged = true;
  writeAuditLog(req, {
    module: event.objectType === 'order_draft' ? 'order' : (['registration', 'opportunity', 'quote', 'order'].includes(event.objectType) ? event.objectType : 'registration'),
    action: event.action,
    targetType: event.objectType,
    targetId: event.objectId,
    targetName: targetName || event.objectId,
    result: 'success',
    message: `移动端二期${event.summary || event.action}`,
    actor: {
      userId: operator.id,
      username: ((db.users || []).find(user => user.id === operator.id) || {}).username || '',
      name: operator.name || '',
      role: operator.role
    },
    after: {
      id: event.objectId,
      status: event.afterStatus || '',
      version: event.version || 0,
      eventId: event.id
    },
    extra: {
      source: 'mobile_v2',
      eventId: event.id,
      reasonCode: event.reasonCode || '',
      clientVersion: event.clientVersion || ''
    }
  });
}

function executeMobileV2Write(req, res, operator, operation, mutate) {
  const scopedOperation = `${operation}:${req.path}`;
  const context = getMobileV2IdempotencyContext(req, operator, scopedOperation);
  if (context.error) {
    const error = context.error.error;
    return sendMobileV2Error(req, res, error.status, error.code, error.error);
  }
  cleanupExpiredMobileV2IdempotencyRecords();
  const existing = db.mobileV2IdempotencyRecords.find(record =>
    record.operatorId === context.operatorId && record.operation === context.operation && record.key === context.key
  );
  if (existing) {
    if (existing.requestHash !== context.requestHash) {
      return sendMobileV2Error(req, res, 409, 'IDEMPOTENCY_CONFLICT', '相同 Idempotency-Key 的请求内容不一致');
    }
    return res.status(existing.statusCode || 200).json({
      success: true,
      requestId: req.requestId,
      data: cloneMobileV2BusinessValue(existing.responseData),
      idempotentReplay: true
    });
  }

  const snapshot = buildMobileV2MutationSnapshot();
  const result = mutate();
  if (!result || result.error) {
    const error = result && result.error ? result.error : { status: 500, code: 'V2_SERVICE_ERROR', error: '二期写入处理失败' };
    return sendMobileV2Error(req, res, error.status, error.code, error.error);
  }

  db.mobileV2IdempotencyRecords.push({
    id: buildMobileV2EntityId('V2IDEMP'),
    operatorId: context.operatorId,
    operation: context.operation,
    key: context.key,
    requestHash: context.requestHash,
    statusCode: result.statusCode || 200,
    responseData: cloneMobileV2BusinessValue(result.data),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + MOBILE_V2_IDEMPOTENCY_TTL_MS).toISOString()
  });
  try {
    // Node.js 单线程同步区间内完成状态判断、内存变更和 SQLite 事务提交，避免并发覆盖。
    dbLayer.syncToDb(db);
  } catch (error) {
    restoreMobileV2MutationSnapshot(snapshot);
    return sendMobileV2Error(req, res, 500, 'V2_SERVICE_ERROR', '二期写入未能持久化，请稍后重试');
  }
  const events = Array.isArray(result.events) ? result.events : (result.event ? [result.event] : []);
  events.forEach(event => writeMobileV2BusinessAudit(req, operator, event, result.targetName));
  return res.status(result.statusCode || 200).json({ success: true, requestId: req.requestId, data: result.data });
}

function getMobileV2InputValue(body, key) {
  if (!body || !Object.prototype.hasOwnProperty.call(body, key)) return undefined;
  const value = body[key];
  if (typeof value === 'string') return value.trim();
  if (MOBILE_V2_NUMERIC_INPUT_FIELDS.has(key) && typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function buildMobileV2RegistrationInput(body) {
  return MOBILE_V2_REGISTRATION_FIELDS.reduce((result, key) => {
    const value = getMobileV2InputValue(body, key);
    if (value !== undefined) result[key] = value;
    return result;
  }, {});
}

function buildMobileV2OpportunityInput(body) {
  return MOBILE_V2_OPPORTUNITY_FIELDS.reduce((result, key) => {
    const value = getMobileV2InputValue(body, key);
    if (value !== undefined) result[key] = value;
    return result;
  }, {});
}

function validateMobileV2TextRules(operator, domain, input, requiredFields = []) {
  const config = findMobileV2BusinessConfig('field_constraints', operator);
  const rules = getMobileV2ConfigValues(config)[domain];
  if (!config || !rules || typeof rules !== 'object') return createMobileV2BusinessConfigError();
  for (const field of Object.keys(input)) {
    const value = input[field];
    if (value === undefined || value === '') continue;
    const rule = rules[field];
    if (!rule || !Number.isInteger(rule.maxLength) || rule.maxLength <= 0) return createMobileV2BusinessConfigError();
    if (value === null || (typeof value !== 'string' && typeof value !== 'number')) {
      return createMobileV2BusinessError(400, 'VALIDATION_FAILED', `${field} 类型不正确`);
    }
    if (typeof value === 'string' && value.length > rule.maxLength) {
      return createMobileV2BusinessError(400, 'VALIDATION_FAILED', `${field} 长度不符合要求`);
    }
  }
  for (const field of requiredFields) {
    const value = input[field];
    const rule = rules[field];
    if (!rule || !Number.isInteger(rule.maxLength) || rule.maxLength <= 0) return createMobileV2BusinessConfigError();
    if (typeof value !== 'string' || !value || (Number.isInteger(rule.minLength) && value.length < rule.minLength)) {
      return createMobileV2BusinessError(400, 'VALIDATION_FAILED', `${field} 为必填项或格式不正确`);
    }
  }
  return null;
}

function isMobileV2ValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateMobileV2RegistrationBusinessValues(input) {
  if (input.estimatedAmt !== undefined && (!Number.isFinite(Number(input.estimatedAmt)) || Number(input.estimatedAmt) < 0)) {
    return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '预计金额格式不正确');
  }
  if (input.signDate !== undefined && input.signDate !== '' && !isMobileV2ValidDate(input.signDate)) {
    return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '预计签约日期格式不正确');
  }
  return null;
}

function getMobileV2DuplicateDecision(operator, input) {
  const config = findMobileV2BusinessConfig('registration_duplicate_rule', operator);
  const values = getMobileV2ConfigValues(config);
  if (!config || values.creditCodeExact !== true || !normalizeTrimmedString(values.nameNormalizationVersion)) {
    return { configMissing: true };
  }
  const creditCode = normalizeMobileV2CreditCode(input.creditCode);
  if (creditCode && (db.registrations || []).some(item => normalizeMobileV2CreditCode(item.creditCode) === creditCode)) {
    return { decision: '不可提交', code: 'CREDIT_CODE_DUPLICATE', message: '统一社会信用代码已存在有效报备，当前提交不可继续' };
  }
  const customer = normalizeMobileV2CustomerName(input.customer);
  if (customer && (db.registrations || []).some(item => normalizeMobileV2CustomerName(item.customer) === customer)) {
    return { decision: '需人工处理', code: 'CUSTOMER_NAME_SIMILAR', message: '客户名称存在疑似重复，请按既定人工流程核验' };
  }
  return { decision: '可继续', code: 'NO_DUPLICATE', message: '未发现需要阻断的精确重复' };
}

function getMobileV2RegistrationReviewRoute(operator, registration) {
  const config = findMobileV2BusinessConfig('registration_review_route', operator);
  const routes = getMobileV2ConfigValues(config).routes;
  if (!config || !Array.isArray(routes)) return null;
  return routes.find(route => route && route.status === 'active'
    && normalizeTrimmedString(route.region) === normalizeTrimmedString(registration.region)
    && toMobileV2FeatureFlagList(route.roles).includes(normalizeTrimmedString(operator.role).toLowerCase())) || null;
}

function hasMobileV2RegistrationReviewRoute(operator) {
  const config = findMobileV2BusinessConfig('registration_review_route', operator);
  const routes = getMobileV2ConfigValues(config).routes;
  return Boolean(config && Array.isArray(routes) && routes.some(route => route && route.status === 'active'
    && normalizeTrimmedString(route.region) === normalizeTrimmedString(operator.region)
    && toMobileV2FeatureFlagList(route.roles).some(role => ['admin', 'superadmin'].includes(role))));
}

function isMobileV2ReasonAllowed(config, target, reasonCode) {
  const values = getMobileV2ConfigValues(config);
  const list = Array.isArray(values[target]) ? values[target] : [];
  return list.some(item => (typeof item === 'string' ? item : item && item.code) === reasonCode);
}

function isMobileV2ChannelOperator(operator) {
  return ['staff', 'partner_admin'].includes(operator.role) && Boolean(operator.partnerId && operator.region);
}

function canMobileV2OperateOwnRegistrationDraft(req, operator, draft) {
  return Boolean(draft && draft.createdBy === operator.id && draft.sessionFingerprint === buildMobileV2SessionFingerprint(req));
}

function canMobileV2OperateOpportunity(operator, opportunity) {
  return Boolean(opportunity && opportunity.mobileV2Lifecycle === true
    && isMobileV2ChannelOperator(operator)
    && (opportunity.ownerId === operator.id || opportunity.assignedStaffId === operator.id));
}

function buildMobileV2DraftResponse(draft) {
  return { id: draft.id, status: draft.status, version: draft.version, updatedAt: draft.updatedAt, copyFromRegistrationId: draft.copyFromRegistrationId || '' };
}

function buildMobileV2RegistrationWriteResponse(registration, event) {
  return { id: registration.id, status: registration.status, version: registration.version, updatedAt: registration.updatedAt, eventId: event.id, protectDays: registration.protectDays || 0 };
}

function buildMobileV2OpportunityWriteResponse(opportunity, event) {
  return { id: opportunity.id, stage: opportunity.stage, version: opportunity.version, updatedAt: opportunity.updatedAt, eventId: event.id, ownerId: opportunity.ownerId };
}

function roundMobileV2Money(value, precision) {
  const factor = 10 ** precision;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function getMobileV2QuoteProduct(productId) {
  return [...(db.features || []), ...(db.hardwareProducts || [])].find(item => item
    && item.id === productId && item.status === 'active' && item.published !== false) || null;
}

function getMobileV2ScopedConfigValues(config, key) {
  const values = getMobileV2ConfigValues(config);
  const value = values[key];
  return toMobileV2FeatureFlagList(value);
}

function isMobileV2QuotePriceItemMatched(item, operator) {
  const partnerLevel = (db.partners || []).find(partner => partner.id === operator.partnerId)?.partnerLevel || 'none';
  return isMobileV2FeatureFlagScopeMatched(getMobileV2ScopedConfigValues({ values: item }, 'regions'), operator.region)
    && isMobileV2FeatureFlagScopeMatched(getMobileV2ScopedConfigValues({ values: item }, 'partnerLevels'), partnerLevel);
}

function getMobileV2QuotePricingContext(operator) {
  const priceBook = findMobileV2BusinessConfig('quote_price_book', operator);
  const taxRule = findMobileV2BusinessConfig('quote_tax_rule', operator);
  const discountPolicy = findMobileV2BusinessConfig('quote_discount_policy', operator);
  const priceBookValues = getMobileV2ConfigValues(priceBook);
  const taxValues = getMobileV2ConfigValues(taxRule);
  const discountValues = getMobileV2ConfigValues(discountPolicy);
  const precision = Number(priceBookValues.precision);
  const taxRate = Number(taxValues.taxRate);
  const maxRate = Number(discountValues.maxRate);
  const noApprovalMaxRate = Number(discountValues.noApprovalMaxRate);
  const validDays = Number(discountValues.validDays);
  if (!priceBook || !Array.isArray(priceBookValues.items) || !/^[A-Z]{3}$/.test(normalizeTrimmedString(priceBookValues.currency))
    || !Number.isInteger(precision) || precision < 0 || precision > 4
    || !taxRule || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1
    || !discountPolicy || !Number.isFinite(maxRate) || maxRate < 0 || maxRate > 1
    || !Number.isFinite(noApprovalMaxRate) || noApprovalMaxRate < 0 || noApprovalMaxRate > maxRate
    || !Number.isInteger(validDays) || validDays < 1 || validDays > 365
    || !Array.isArray(discountValues.reviewRoles) || !discountValues.reviewRoles.length
    || !Array.isArray(discountValues.confirmationRoles) || !discountValues.confirmationRoles.length) {
    return { error: createMobileV2BusinessConfigError() };
  }
  return {
    priceBook,
    taxRule,
    discountPolicy,
    currency: normalizeTrimmedString(priceBookValues.currency),
    precision,
    taxRate,
    maxRate,
    noApprovalMaxRate,
    validDays,
    reviewRoles: toMobileV2FeatureFlagList(discountValues.reviewRoles),
    confirmationRoles: toMobileV2FeatureFlagList(discountValues.confirmationRoles)
  };
}

function buildMobileV2QuoteCalculation(operator, source = {}) {
  const pricing = getMobileV2QuotePricingContext(operator);
  if (pricing.error) return pricing;
  const items = Array.isArray(source.items) ? source.items : [];
  if (!items.length || items.length > 50) return { error: createMobileV2BusinessError(400, 'VALIDATION_FAILED', '报价产品明细数量不合法') };
  const seenProductIds = new Set();
  const calculatedItems = [];
  for (const item of items) {
    const productId = normalizeTrimmedString(item && item.productId);
    const quantity = Number(item && item.quantity);
    if (!productId || seenProductIds.has(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
      return { error: createMobileV2BusinessError(400, 'VALIDATION_FAILED', '报价产品或数量不合法') };
    }
    seenProductIds.add(productId);
    const product = getMobileV2QuoteProduct(productId);
    const priceRule = getMobileV2ConfigValues(pricing.priceBook).items.find(rule => rule && rule.productId === productId && isMobileV2QuotePriceItemMatched(rule, operator));
    const unitPrice = Number(priceRule && priceRule.unitPrice);
    if (!product || !priceRule || !Number.isFinite(unitPrice) || unitPrice < 0) return { error: createMobileV2BusinessConfigError() };
    calculatedItems.push({
      productId,
      productName: product.name || product.model || productId,
      quantity,
      unit: product.unit || '件',
      unitPrice: roundMobileV2Money(unitPrice, pricing.precision),
      subtotal: roundMobileV2Money(unitPrice * quantity, pricing.precision)
    });
  }
  const discountRate = source.discountRate === undefined || source.discountRate === '' ? 0 : Number(source.discountRate);
  if (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > pricing.maxRate) {
    return { error: createMobileV2BusinessError(400, 'VALIDATION_FAILED', '折扣比例不符合当前阈值') };
  }
  const subtotal = roundMobileV2Money(calculatedItems.reduce((sum, item) => sum + item.subtotal, 0), pricing.precision);
  const discountAmount = roundMobileV2Money(subtotal * discountRate, pricing.precision);
  const beforeTaxTotal = roundMobileV2Money(subtotal - discountAmount, pricing.precision);
  const taxAmount = roundMobileV2Money(beforeTaxTotal * pricing.taxRate, pricing.precision);
  return {
    data: {
      items: calculatedItems,
      subtotal,
      discountRate,
      discountAmount,
      taxRate: pricing.taxRate,
      taxAmount,
      total: roundMobileV2Money(beforeTaxTotal + taxAmount, pricing.precision),
      currency: pricing.currency,
      pricingSnapshot: {
        priceBookVersion: pricing.priceBook.version || '',
        taxRuleVersion: pricing.taxRule.version || '',
        discountPolicyVersion: pricing.discountPolicy.version || '',
        precision: pricing.precision
      },
      discountReviewRequired: discountRate > pricing.noApprovalMaxRate
    },
    pricing
  };
}

function canMobileV2OperateQuote(operator, quote) {
  if (!operator || !quote || quote.mobileV2Lifecycle !== true || !isMobileV2ChannelOperator(operator)) return false;
  if (operator.role === 'partner_admin') return quote.partnerId === operator.partnerId;
  return quote.createdBy === operator.id || quote.assignedStaffId === operator.id;
}

function canMobileV2OperateOrder(operator, order) {
  if (!operator || !order || order.mobileV2Lifecycle !== true || !isMobileV2ChannelOperator(operator)) return false;
  if (operator.role === 'partner_admin') return order.partnerId === operator.partnerId;
  return order.createdBy === operator.id || order.assignedStaffId === operator.id;
}

function canMobileV2OperateOwnOrderDraft(req, operator, draft) {
  return Boolean(draft && draft.createdBy === operator.id && draft.sessionFingerprint === buildMobileV2SessionFingerprint(req));
}

function isMobileV2QuoteActive(quote) {
  const expiresAt = new Date(quote && quote.expiresAt || 0).getTime();
  return Boolean(quote && quote.mobileV2Lifecycle === true && quote.status === 'confirmed'
    && (!Number.isFinite(expiresAt) || expiresAt <= 0 || expiresAt > Date.now()));
}

function buildMobileV2QuoteWriteResponse(quote, event) {
  return {
    id: quote.id, status: quote.status, version: quote.version, total: quote.total, currency: quote.currency,
    approvalStatus: quote.approvalStatus, updatedAt: quote.updatedAt, eventId: event && event.id
  };
}

function buildMobileV2OrderWriteResponse(order, event) {
  return {
    id: order.id, status: order.status, version: order.version, total: order.total, currency: order.currency,
    quoteId: order.quoteId, primaryPartnerId: order.primaryPartnerId || '', updatedAt: order.updatedAt, eventId: event && event.id
  };
}

function getMobileV2OrderPolicy(operator) {
  const fulfillment = findMobileV2BusinessConfig('order_fulfillment_policy', operator);
  const relationship = findMobileV2BusinessConfig('order_channel_relationship_policy', operator);
  const values = getMobileV2ConfigValues(fulfillment);
  const relationshipValues = getMobileV2ConfigValues(relationship);
  if (!fulfillment || !values.transitions || typeof values.transitions !== 'object' || !Array.isArray(values.rejectReasons)
    || !relationship || relationshipValues.requireSameRegion !== true) return { error: createMobileV2BusinessConfigError() };
  return { fulfillment, relationship, transitions: values.transitions, rejectReasons: values.rejectReasons };
}

function getMobileV2PrimaryPartnerForOrder(operator, primaryPartnerId, policy) {
  const sourcePartner = (db.partners || []).find(item => item.id === operator.partnerId);
  if (!sourcePartner || sourcePartner.status !== 'active') return { error: createMobileV2BusinessConfigError() };
  if (sourcePartner.partnerLevel !== 'secondary') return { data: null };
  const parentIds = Array.isArray(sourcePartner.parentPartnerIds) ? sourcePartner.parentPartnerIds
    : (sourcePartner.parentPartnerId ? [sourcePartner.parentPartnerId] : []);
  if (!parentIds.length) return { error: createMobileV2BusinessConfigError() };
  const primary = (db.partners || []).find(item => item.id === primaryPartnerId);
  if (!primary || primary.status !== 'active' || primary.partnerLevel !== 'primary' || !parentIds.includes(primary.id)) {
    return { error: createMobileV2BusinessError(403, 'FORBIDDEN', '只能选择已绑定且有效的一级渠道商') };
  }
  if (policy && getMobileV2ConfigValues(policy.relationship).requireSameRegion === true && primary.region !== sourcePartner.region) {
    return { error: createMobileV2BusinessError(403, 'FORBIDDEN', '一级渠道商必须与当前二级渠道同区域') };
  }
  return { data: primary };
}

const MOBILE_V2_WRITE_CONTRACTS = {
  'registration-draft': { method: 'POST', path: '/registration-drafts', module: 'registration', action: 'create' },
  'registration-submit': { method: 'POST', path: '/registrations', module: 'registration', action: 'submit' },
  'registration-review': { method: 'PUT', path: '/registrations/:id/review', module: 'registration', action: 'review' },
  'opportunity-create': { method: 'POST', path: '/opportunities', module: 'opportunity', action: 'create' },
  'opportunity-update': { method: 'PUT', path: '/opportunities/:id', module: 'opportunity', action: 'update' },
  'opportunity-advance': { method: 'PUT', path: '/opportunities/:id/stage', module: 'opportunity', action: 'advance' },
  'opportunity-follow-up': { method: 'POST', path: '/opportunities/:id/follow-ups', module: 'opportunity', action: 'follow_up' },
  'quote-preview': { method: 'POST', path: '/quotes/preview', module: 'quote', action: 'create' },
  'quote-draft': { method: 'POST', path: '/quote-drafts', module: 'quote', action: 'create' },
  'quote-submit': { method: 'POST', path: '/quotes', module: 'quote', action: 'submit' },
  'quote-discount-review': { method: 'PUT', path: '/quotes/:id/discount-review', module: 'quote', action: 'review' },
  'quote-confirm': { method: 'PUT', path: '/quotes/:id/confirm', module: 'quote', action: 'review' },
  'order-draft': { method: 'POST', path: '/order-drafts', module: 'order', action: 'create' },
  'order-submit': { method: 'POST', path: '/orders/:id/submit', module: 'order', action: 'submit' },
  'order-primary-review': { method: 'PUT', path: '/orders/:id/primary-review', module: 'order', action: 'primary_review' },
  'order-fulfill': { method: 'PUT', path: '/orders/:id/fulfillment', module: 'order', action: 'fulfill' }
};

function hasMobileV2FieldConstraintConfig(operator, domain, fields) {
  const config = findMobileV2BusinessConfig('field_constraints', operator);
  const rules = getMobileV2ConfigValues(config)[domain];
  return Boolean(config && rules && fields.every(field => {
    const rule = rules[field];
    return rule && Number.isInteger(rule.maxLength) && rule.maxLength > 0;
  }));
}

function hasMobileV2RegistrationProtectionConfig(operator) {
  const config = findMobileV2BusinessConfig('registration_protection', operator);
  const values = getMobileV2ConfigValues(config);
  return Boolean(config && values.startAt === 'approved' && Number.isInteger(values.days) && values.days > 0);
}

function hasMobileV2RegistrationDuplicateConfig(operator) {
  const config = findMobileV2BusinessConfig('registration_duplicate_rule', operator);
  const values = getMobileV2ConfigValues(config);
  return Boolean(config && values.creditCodeExact === true && normalizeTrimmedString(values.nameNormalizationVersion));
}

function hasMobileV2RegistrationReviewConfig(operator) {
  const config = findMobileV2BusinessConfig('registration_review_route', operator);
  const routes = getMobileV2ConfigValues(config).routes;
  const reasons = findMobileV2BusinessConfig('registration_reject_reasons', operator);
  return Boolean(config && Array.isArray(routes) && routes.some(route => route && route.status === 'active'
    && normalizeTrimmedString(route.region) === normalizeTrimmedString(operator.region)
    && toMobileV2FeatureFlagList(route.roles).includes(normalizeTrimmedString(operator.role).toLowerCase()))
    && reasons && Array.isArray(getMobileV2ConfigValues(reasons).reasons));
}

function hasMobileV2OpportunityCreationConfig(operator) {
  const config = findMobileV2BusinessConfig('opportunity_creation_rule', operator);
  return Boolean(config && Number.isInteger(getMobileV2ConfigValues(config).maxActivePerRegistration)
    && getMobileV2ConfigValues(config).maxActivePerRegistration > 0);
}

function hasMobileV2OpportunityStageConfig(operator) {
  const policy = findMobileV2BusinessConfig('opportunity_stage_policy', operator);
  const transitions = getMobileV2ConfigValues(policy).transitions;
  const reasons = findMobileV2BusinessConfig('opportunity_close_reasons', operator);
  const reasonValues = getMobileV2ConfigValues(reasons);
  return Boolean(policy && transitions && typeof transitions === 'object'
    && reasons && ['won', 'lost', 'cancelled'].every(stage => Array.isArray(reasonValues[stage])));
}

function hasMobileV2QuotePricingConfig(operator) {
  return !getMobileV2QuotePricingContext(operator).error;
}

function hasMobileV2OrderConfig(operator) {
  return !getMobileV2OrderPolicy(operator).error;
}

function isMobileV2WriteContractBusinessConfigReady(operator, key) {
  if (key === 'registration-draft') return hasMobileV2FieldConstraintConfig(operator, 'registration', MOBILE_V2_REGISTRATION_FIELDS);
  if (key === 'registration-submit') {
    return hasMobileV2FieldConstraintConfig(operator, 'registration', MOBILE_V2_REGISTRATION_FIELDS)
      && hasMobileV2RegistrationProtectionConfig(operator)
      && hasMobileV2RegistrationDuplicateConfig(operator)
      && hasMobileV2RegistrationReviewRoute(operator);
  }
  if (key === 'registration-review') return hasMobileV2RegistrationProtectionConfig(operator) && hasMobileV2RegistrationReviewConfig(operator);
  if (key === 'opportunity-create') return hasMobileV2FieldConstraintConfig(operator, 'opportunity', MOBILE_V2_OPPORTUNITY_FIELDS) && hasMobileV2OpportunityCreationConfig(operator);
  if (key === 'opportunity-update') return hasMobileV2FieldConstraintConfig(operator, 'opportunity', MOBILE_V2_OPPORTUNITY_FIELDS);
  if (key === 'opportunity-advance') return hasMobileV2OpportunityStageConfig(operator);
  if (key === 'opportunity-follow-up') {
    const config = findMobileV2BusinessConfig('field_constraints', operator);
    const followUp = getMobileV2ConfigValues(config).followUp;
    return Boolean(hasMobileV2FieldConstraintConfig(operator, 'opportunity', MOBILE_V2_OPPORTUNITY_FIELDS)
      && followUp && Number.isInteger(followUp.contentMaxLength) && followUp.contentMaxLength > 0);
  }
  if (['quote-preview', 'quote-draft', 'quote-submit', 'quote-discount-review', 'quote-confirm'].includes(key)) return hasMobileV2QuotePricingConfig(operator);
  if (key === 'order-draft') return hasMobileV2QuotePricingConfig(operator) && hasMobileV2OrderConfig(operator);
  if (key === 'order-submit') return hasMobileV2OrderConfig(operator);
  if (['order-primary-review', 'order-fulfill'].includes(key)) return hasMobileV2OrderConfig(operator);
  return false;
}

app.get('/api/mobile/v2/me', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'session', 'read')) return;
  return sendMobileV2Success(req, res, { data: buildMobileV2User(operator) });
});

app.get('/api/mobile/v2/feature-flags', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  return sendMobileV2Success(req, res, { data: buildMobileV2FeatureFlags(operator) });
});

app.get('/api/mobile/v2/dashboard', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'dashboard', 'read')) return;
  return sendMobileV2Success(req, res, { data: buildMobileV2Dashboard(operator) });
});

app.get('/api/mobile/v2/notifications', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'notification', 'read')) return;
  const page = buildMobilePage(listNotificationsForUser(operator.id), req.query);
  return sendMobileV2Success(req, res, {
    data: page.data.map(item => pickMobileV2Fields(item, ['id', 'type', 'title', 'desc', 'time', 'unread', 'createdAt', 'updatedAt'])),
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    hasMore: page.hasMore
  });
});

app.post('/api/mobile/v2/registration-drafts', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'registration', 'create')) return;
  if (!isMobileV2ChannelOperator(operator)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权保存报备草稿');
  return executeMobileV2Write(req, res, operator, 'registration_draft_save', () => {
    const input = buildMobileV2RegistrationInput(req.body || {});
    const validationError = validateMobileV2TextRules(operator, 'registration', input);
    if (validationError) return validationError;
    const businessValidationError = validateMobileV2RegistrationBusinessValues(input);
    if (businessValidationError) return businessValidationError;
    const requestedDraftId = normalizeTrimmedString(req.body?.draftId);
    const existing = requestedDraftId ? db.mobileV2RegistrationDrafts.find(item => item.id === requestedDraftId) : null;
    if (requestedDraftId && !canMobileV2OperateOwnRegistrationDraft(req, operator, existing)) {
      return createMobileV2BusinessError(404, 'NOT_FOUND', '报备草稿不存在或无权访问');
    }
    const now = new Date().toISOString();
    const draft = existing || {
      id: buildMobileV2EntityId('V2DRAFT'),
      createdBy: operator.id,
      sessionFingerprint: buildMobileV2SessionFingerprint(req),
      status: 'draft',
      version: 0,
      createdAt: now
    };
    draft.data = input;
    draft.version += 1;
    draft.updatedAt = now;
    if (!existing) db.mobileV2RegistrationDrafts.push(draft);
    const event = createMobileV2Event(req, operator, {
      objectType: 'registration_draft', objectId: draft.id, action: existing ? 'draft_update' : 'draft_create',
      afterStatus: 'draft', summary: existing ? '更新报备草稿' : '创建报备草稿', version: draft.version
    });
    return { data: { ...buildMobileV2DraftResponse(draft), eventId: event.id }, event, targetName: input.customer || draft.id };
  });
});

app.post('/api/mobile/v2/registrations/check-duplicate', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'registration', 'create')) return;
  if (!isMobileV2ChannelOperator(operator)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权查询报备重复情况');
  const input = buildMobileV2RegistrationInput(req.body || {});
  const validationError = validateMobileV2TextRules(operator, 'registration', input, ['customer']);
  if (validationError) return sendMobileV2Error(req, res, validationError.error.status, validationError.error.code, validationError.error.error);
  const businessValidationError = validateMobileV2RegistrationBusinessValues(input);
  if (businessValidationError) return sendMobileV2Error(req, res, businessValidationError.error.status, businessValidationError.error.code, businessValidationError.error.error);
  const duplicate = getMobileV2DuplicateDecision(operator, input);
  if (duplicate.configMissing) return sendMobileV2Error(req, res, 422, 'BUSINESS_CONFIG_MISSING', '报备查重规则未配置、未启用或不适用于当前范围');
  const config = findMobileV2BusinessConfig('registration_duplicate_rule', operator);
  return sendMobileV2Success(req, res, {
    data: {
      decision: duplicate.decision,
      code: duplicate.code,
      message: duplicate.message,
      configVersion: config.version || ''
    }
  });
});

app.post('/api/mobile/v2/registrations', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'registration', 'submit')) return;
  if (!isMobileV2ChannelOperator(operator)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权提交报备');
  return executeMobileV2Write(req, res, operator, 'registration_submit', () => {
    const draftId = normalizeTrimmedString(req.body?.draftId);
    const draft = db.mobileV2RegistrationDrafts.find(item => item.id === draftId);
    if (!canMobileV2OperateOwnRegistrationDraft(req, operator, draft)) {
      return createMobileV2BusinessError(404, 'NOT_FOUND', '当前会话报备草稿不存在或无权提交');
    }
    const input = { ...(draft.data || {}), ...buildMobileV2RegistrationInput(req.body || {}) };
    const validationError = validateMobileV2TextRules(operator, 'registration', input, ['customer', 'contact', 'phone']);
    if (validationError) return validationError;
    const businessValidationError = validateMobileV2RegistrationBusinessValues(input);
    if (businessValidationError) return businessValidationError;
    const protectionConfig = findMobileV2BusinessConfig('registration_protection', operator);
    const protectionValues = getMobileV2ConfigValues(protectionConfig);
    if (!protectionConfig || protectionValues.startAt !== 'approved' || !Number.isInteger(protectionValues.days) || protectionValues.days <= 0) {
      return createMobileV2BusinessConfigError();
    }
    if (!hasMobileV2RegistrationReviewRoute(operator)) return createMobileV2BusinessConfigError();
    const duplicate = getMobileV2DuplicateDecision(operator, input);
    if (duplicate.configMissing) return createMobileV2BusinessConfigError();
    if (duplicate.decision === '不可提交') {
      return createMobileV2BusinessError(409, 'DUPLICATE_PROTECTED', '客户存在精确重复报备，不能提交');
    }
    const now = new Date().toISOString();
    const user = (db.users || []).find(item => item.id === operator.id) || {};
    const partner = (db.partners || []).find(item => item.id === operator.partnerId) || {};
    const registration = {
      id: buildMobileV2EntityId('REGV2'),
      ...input,
      status: 'pending',
      version: 1,
      mobileV2Lifecycle: true,
      createdBy: operator.id,
      createdByName: operator.name || user.name || '',
      assignedStaffId: operator.id,
      assignedStaffName: operator.name || user.name || '',
      owner: operator.name || user.name || '',
      partnerId: operator.partnerId,
      partnerName: user.partnerName || partner.name || '',
      assignedPartnerId: operator.partnerId,
      assignedPartnerName: user.partnerName || partner.name || '',
      region: operator.region,
      protectionConfigVersion: protectionConfig.version || '',
      duplicateDecision: duplicate.decision,
      sourceDraftId: draft.id,
      createdAt: now,
      updatedAt: now
    };
    db.registrations.push(registration);
    db.mobileV2RegistrationDrafts = db.mobileV2RegistrationDrafts.filter(item => item.id !== draft.id);
    const event = createMobileV2Event(req, operator, {
      objectType: 'registration', objectId: registration.id, action: 'submit', beforeStatus: 'draft', afterStatus: 'pending',
      summary: '提交客户报备', version: registration.version
    });
    return { data: buildMobileV2RegistrationWriteResponse(registration, event), event, targetName: registration.customer };
  });
});

app.put('/api/mobile/v2/registrations/:id/review', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'registration', 'review')) return;
  const registration = (db.registrations || []).find(item => item.id === req.params.id);
  if (!registration) return sendMobileV2Error(req, res, 404, 'NOT_FOUND', '报备不存在');
  if (!registration.mobileV2Lifecycle) return sendMobileV2Error(req, res, 422, 'HISTORY_MAPPING_REQUIRED', '历史报备仅支持查询，不能通过二期写入处理');
  if (!['admin', 'superadmin'].includes(operator.role) || !canMobileOperatorViewRecord(operator, registration)) {
    return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权审核该报备');
  }
  if (!getMobileV2RegistrationReviewRoute(operator, registration)) {
    return sendMobileV2Error(req, res, 422, 'BUSINESS_CONFIG_MISSING', '当前区域审核路由未配置或当前角色不在审核路由中');
  }
  return executeMobileV2Write(req, res, operator, 'registration_review', () => {
    const action = normalizeTrimmedString(req.body?.action);
    const expectedVersion = Number(req.body?.version);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '审核请求必须携带当前对象版本');
    }
    if (expectedVersion !== registration.version) return createMobileV2BusinessError(409, 'STATE_CONFLICT', '报备已被其他操作更新，请刷新后重试');
    const beforeStatus = registration.status;
    const reviewer = (db.users || []).find(item => item.id === operator.id) || {};
    if (action === 'start') {
      if (beforeStatus !== 'pending') return createMobileV2BusinessError(409, 'STATE_CONFLICT', '仅待审核报备可开始审核');
      registration.status = 'reviewing';
      registration.reviewStartedAt = new Date().toISOString();
    } else if (action === 'approve') {
      if (beforeStatus !== 'reviewing') return createMobileV2BusinessError(409, 'STATE_CONFLICT', '仅审核中的报备可审批通过');
      const protectionConfig = findMobileV2BusinessConfig('registration_protection', operator);
      const values = getMobileV2ConfigValues(protectionConfig);
      if (!protectionConfig || values.startAt !== 'approved' || !Number.isInteger(values.days) || values.days <= 0) return createMobileV2BusinessConfigError();
      const approvedAt = new Date();
      registration.status = 'approved';
      registration.approvedAt = approvedAt.toISOString();
      registration.approvedBy = operator.name || reviewer.name || '';
      registration.reviewerId = operator.id;
      registration.protectDays = values.days;
      registration.expireAt = new Date(approvedAt.getTime() + values.days * 24 * 60 * 60 * 1000).toISOString();
      registration.protectionConfigVersion = protectionConfig.version || '';
    } else if (action === 'reject') {
      if (!['pending', 'reviewing'].includes(beforeStatus)) return createMobileV2BusinessError(409, 'STATE_CONFLICT', '当前状态不可驳回');
      const reasonCode = normalizeTrimmedString(req.body?.reasonCode);
      const reasonConfig = findMobileV2BusinessConfig('registration_reject_reasons', operator);
      if (!reasonConfig) return createMobileV2BusinessConfigError();
      if (!isMobileV2ReasonAllowed(reasonConfig, 'reasons', reasonCode)) return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '驳回原因代码不合法');
      registration.status = 'rejected';
      registration.rejectReasonCode = reasonCode;
      registration.rejectRemark = normalizeTrimmedString(req.body?.remark);
      registration.reviewerId = operator.id;
      registration.reviewedAt = new Date().toISOString();
    } else {
      return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '审核动作不合法');
    }
    registration.version += 1;
    registration.updatedAt = new Date().toISOString();
    const event = createMobileV2Event(req, operator, {
      objectType: 'registration', objectId: registration.id, action: `review_${action}`, beforeStatus, afterStatus: registration.status,
      reasonCode: registration.rejectReasonCode || '', summary: action === 'start' ? '开始审核报备' : (action === 'approve' ? '审核通过报备' : '驳回报备'), version: registration.version
    });
    return { data: buildMobileV2RegistrationWriteResponse(registration, event), event, targetName: registration.customer };
  });
});

app.post('/api/mobile/v2/registrations/:id/copy', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'registration', 'create')) return;
  if (!isMobileV2ChannelOperator(operator)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权复制报备草稿');
  const registration = (db.registrations || []).find(item => item.id === req.params.id);
  if (!registration || !registration.mobileV2Lifecycle || registration.status !== 'rejected') {
    return sendMobileV2Error(req, res, 404, 'NOT_FOUND', '可复制的已驳回报备不存在');
  }
  if (!(registration.createdBy === operator.id || (operator.role === 'partner_admin' && registration.partnerId === operator.partnerId))) {
    return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权复制该报备');
  }
  return executeMobileV2Write(req, res, operator, 'registration_copy', () => {
    const now = new Date().toISOString();
    const draft = {
      id: buildMobileV2EntityId('V2DRAFT'), createdBy: operator.id, sessionFingerprint: buildMobileV2SessionFingerprint(req),
      status: 'draft', version: 1, copyFromRegistrationId: registration.id, data: buildMobileV2RegistrationInput(registration), createdAt: now, updatedAt: now
    };
    db.mobileV2RegistrationDrafts.push(draft);
    const event = createMobileV2Event(req, operator, {
      objectType: 'registration_draft', objectId: draft.id, action: 'draft_copy', afterStatus: 'draft', summary: '复制已驳回报备为新草稿', version: draft.version
    });
    return { data: { ...buildMobileV2DraftResponse(draft), eventId: event.id }, event, targetName: registration.customer };
  });
});

app.get('/api/mobile/v2/registrations/:id/events', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'registration', 'read')) return;
  const registration = (db.registrations || []).find(item => item.id === req.params.id);
  if (!registration) return sendMobileV2Error(req, res, 404, 'NOT_FOUND', '报备不存在');
  if (!canMobileOperatorViewRecord(operator, registration)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '无权查看该报备事件');
  ensureMobileV2BusinessStores();
  const events = db.mobileV2BusinessEvents.filter(item => item.objectType === 'registration' && item.objectId === registration.id)
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
    .map(item => pickMobileV2Fields(item, ['id', 'action', 'beforeStatus', 'afterStatus', 'reasonCode', 'summary', 'actorName', 'actorRole', 'requestId', 'createdAt']));
  return sendMobileV2Success(req, res, { data: events });
});

app.get('/api/mobile/v2/registrations', (req, res) => sendMobileV2RecordList(req, res, db.registrations || [], 'registration'));
app.get('/api/mobile/v2/registrations/:id', (req, res) => sendMobileV2RecordDetail(req, res, db.registrations || [], 'registration', '报备'));
app.get('/api/mobile/v2/opportunities', (req, res) => sendMobileV2RecordList(req, res, db.opportunities || [], 'opportunity'));
app.get('/api/mobile/v2/opportunities/:id', (req, res) => sendMobileV2RecordDetail(req, res, db.opportunities || [], 'opportunity', '商机'));

app.post('/api/mobile/v2/opportunities', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'opportunity', 'create')) return;
  if (!isMobileV2ChannelOperator(operator)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权创建商机');
  return executeMobileV2Write(req, res, operator, 'opportunity_create', () => {
    const regId = normalizeTrimmedString(req.body?.regId);
    const registration = (db.registrations || []).find(item => item.id === regId);
    if (!registration || !canMobileOperatorViewRecord(operator, registration)) {
      return createMobileV2BusinessError(404, 'NOT_FOUND', '已审批报备不存在或无权访问');
    }
    if (!registration.mobileV2Lifecycle) return createMobileV2BusinessError(422, 'HISTORY_MAPPING_REQUIRED', '历史报备仅支持查询，不能作为二期商机创建来源');
    if (registration.status !== 'approved') return createMobileV2BusinessError(409, 'STATE_CONFLICT', '仅已审批报备可创建商机');
    const creationConfig = findMobileV2BusinessConfig('opportunity_creation_rule', operator);
    const creationValues = getMobileV2ConfigValues(creationConfig);
    if (!creationConfig || !Number.isInteger(creationValues.maxActivePerRegistration) || creationValues.maxActivePerRegistration < 1) {
      return createMobileV2BusinessConfigError();
    }
    const input = buildMobileV2OpportunityInput(req.body || {});
    const validationError = validateMobileV2TextRules(operator, 'opportunity', input, ['name']);
    if (validationError) return validationError;
    if (input.amount !== undefined && (!Number.isFinite(Number(input.amount)) || Number(input.amount) < 0)) {
      return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '预估金额格式不正确');
    }
    if (input.endpoints !== undefined && (!Number.isInteger(Number(input.endpoints)) || Number(input.endpoints) < 0)) {
      return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '预计终端数格式不正确');
    }
    const activeCount = (db.opportunities || []).filter(item => item.mobileV2Lifecycle === true && item.regId === registration.id
      && !['won', 'lost', 'cancelled'].includes(item.stage)).length;
    if (activeCount >= creationValues.maxActivePerRegistration) {
      return createMobileV2BusinessError(409, 'OPPORTUNITY_EXISTS', '该报备已达到允许创建的活动商机数量');
    }
    const now = new Date().toISOString();
    const user = (db.users || []).find(item => item.id === operator.id) || {};
    const opportunity = {
      id: buildMobileV2EntityId('OPPV2'),
      ...input,
      customer: registration.customer,
      industry: registration.industry || '',
      region: registration.region,
      partnerId: registration.partnerId,
      partnerName: registration.partnerName,
      assignedPartnerId: registration.assignedPartnerId || registration.partnerId,
      assignedPartnerName: registration.assignedPartnerName || registration.partnerName,
      regId: registration.id,
      ownerId: operator.id,
      owner: operator.name || user.name || '',
      assignedStaffId: operator.id,
      assignedStaffName: operator.name || user.name || '',
      createdBy: operator.id,
      createdByName: operator.name || user.name || '',
      stage: 'contacted',
      version: 1,
      mobileV2Lifecycle: true,
      creationConfigVersion: creationConfig.version || '',
      followUps: [],
      createdAt: now,
      updatedAt: now
    };
    db.opportunities.push(opportunity);
    const event = createMobileV2Event(req, operator, {
      objectType: 'opportunity', objectId: opportunity.id, action: 'create', afterStatus: opportunity.stage,
      summary: '从已审批报备创建商机', version: opportunity.version
    });
    return { data: buildMobileV2OpportunityWriteResponse(opportunity, event), event, targetName: opportunity.name || opportunity.customer };
  });
});

app.put('/api/mobile/v2/opportunities/:id', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'opportunity', 'update')) return;
  const opportunity = (db.opportunities || []).find(item => item.id === req.params.id);
  if (!opportunity) return sendMobileV2Error(req, res, 404, 'NOT_FOUND', '商机不存在');
  if (!opportunity.mobileV2Lifecycle || !opportunity.ownerId) return sendMobileV2Error(req, res, 422, 'HISTORY_MAPPING_REQUIRED', '历史或未完成映射的商机仅支持查询');
  if (operator.role !== 'staff' || !canMobileV2OperateOpportunity(operator, opportunity)) {
    return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权编辑该商机');
  }
  return executeMobileV2Write(req, res, operator, 'opportunity_update', () => {
    const expectedVersion = Number(req.body?.version);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '商机更新必须携带当前对象版本');
    }
    if (expectedVersion !== opportunity.version) return createMobileV2BusinessError(409, 'STATE_CONFLICT', '商机已被其他操作更新，请刷新后重试');
    const input = buildMobileV2OpportunityInput(req.body || {});
    if (!Object.keys(input).length) return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '未提供可更新的商机字段');
    const validationError = validateMobileV2TextRules(operator, 'opportunity', input);
    if (validationError) return validationError;
    if (input.amount !== undefined && (!Number.isFinite(Number(input.amount)) || Number(input.amount) < 0)) {
      return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '预估金额格式不正确');
    }
    if (input.endpoints !== undefined && (!Number.isInteger(Number(input.endpoints)) || Number(input.endpoints) < 0)) {
      return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '预计终端数格式不正确');
    }
    if (input.expectedClose !== undefined && input.expectedClose !== '' && Number.isNaN(new Date(input.expectedClose).getTime())) {
      return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '预计成交日期格式不正确');
    }
    if (typeof input.tags === 'string') {
      input.tags = input.tags.split(/[、,，]/).map(item => normalizeTrimmedString(item)).filter(Boolean);
    }
    const beforeStatus = opportunity.stage;
    Object.assign(opportunity, input, { updatedAt: new Date().toISOString() });
    opportunity.version += 1;
    const event = createMobileV2Event(req, operator, {
      objectType: 'opportunity', objectId: opportunity.id, action: 'update', beforeStatus, afterStatus: opportunity.stage,
      summary: '更新商机基础字段', version: opportunity.version
    });
    return { data: buildMobileV2OpportunityWriteResponse(opportunity, event), event, targetName: opportunity.name || opportunity.customer };
  });
});

app.put('/api/mobile/v2/opportunities/:id/stage', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'opportunity', 'advance')) return;
  const opportunity = (db.opportunities || []).find(item => item.id === req.params.id);
  if (!opportunity) return sendMobileV2Error(req, res, 404, 'NOT_FOUND', '商机不存在');
  if (!opportunity.mobileV2Lifecycle || !opportunity.ownerId) return sendMobileV2Error(req, res, 422, 'HISTORY_MAPPING_REQUIRED', '历史或未完成映射的商机仅支持查询');
  if (!canMobileV2OperateOpportunity(operator, opportunity)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权推进该商机');
  return executeMobileV2Write(req, res, operator, 'opportunity_stage_advance', () => {
    const expectedVersion = Number(req.body?.version);
    const targetStage = normalizeTrimmedString(req.body?.stage);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1 || !targetStage) {
      return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '阶段推进必须携带目标阶段和当前对象版本');
    }
    if (expectedVersion !== opportunity.version) return createMobileV2BusinessError(409, 'STATE_CONFLICT', '商机已被其他操作更新，请刷新后重试');
    const stageConfig = findMobileV2BusinessConfig('opportunity_stage_policy', operator);
    const transitions = getMobileV2ConfigValues(stageConfig).transitions;
    if (!stageConfig || !transitions || typeof transitions !== 'object' || !Array.isArray(transitions[opportunity.stage])) {
      return createMobileV2BusinessConfigError();
    }
    if (!transitions[opportunity.stage].includes(targetStage)) {
      return createMobileV2BusinessError(409, 'STATE_CONFLICT', '当前商机状态不允许跳转到目标阶段');
    }
    const terminalStages = ['won', 'lost', 'cancelled'];
    const reasonCode = normalizeTrimmedString(req.body?.reasonCode);
    if (terminalStages.includes(targetStage)) {
      const reasonConfig = findMobileV2BusinessConfig('opportunity_close_reasons', operator);
      if (!reasonConfig) return createMobileV2BusinessConfigError();
      if (!isMobileV2ReasonAllowed(reasonConfig, targetStage, reasonCode)) return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '结案原因代码不合法');
    }
    const beforeStatus = opportunity.stage;
    opportunity.stage = targetStage;
    opportunity.closeReasonCode = terminalStages.includes(targetStage) ? reasonCode : '';
    opportunity.version += 1;
    opportunity.updatedAt = new Date().toISOString();
    const event = createMobileV2Event(req, operator, {
      objectType: 'opportunity', objectId: opportunity.id, action: 'stage_advance', beforeStatus, afterStatus: opportunity.stage,
      reasonCode: opportunity.closeReasonCode || '', summary: '推进商机阶段', version: opportunity.version
    });
    return { data: buildMobileV2OpportunityWriteResponse(opportunity, event), event, targetName: opportunity.name || opportunity.customer };
  });
});

app.post('/api/mobile/v2/opportunities/:id/follow-ups', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'opportunity', 'follow_up')) return;
  const opportunity = (db.opportunities || []).find(item => item.id === req.params.id);
  if (!opportunity) return sendMobileV2Error(req, res, 404, 'NOT_FOUND', '商机不存在');
  if (!opportunity.mobileV2Lifecycle || !opportunity.ownerId) return sendMobileV2Error(req, res, 422, 'HISTORY_MAPPING_REQUIRED', '历史或未完成映射的商机仅支持查询');
  if (!canMobileV2OperateOpportunity(operator, opportunity)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权提交该商机跟进');
  return executeMobileV2Write(req, res, operator, 'opportunity_follow_up', () => {
    const expectedVersion = Number(req.body?.version);
    const content = normalizeTrimmedString(req.body?.content);
    const nextFollowAt = normalizeTrimmedString(req.body?.nextFollowAt);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1 || !content || !nextFollowAt) {
      return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '跟进内容、下次跟进时间和当前对象版本均为必填项');
    }
    if (expectedVersion !== opportunity.version) return createMobileV2BusinessError(409, 'STATE_CONFLICT', '商机已被其他操作更新，请刷新后重试');
    const constraints = findMobileV2BusinessConfig('field_constraints', operator);
    const followUpRules = getMobileV2ConfigValues(constraints).followUp;
    if (!constraints || !followUpRules || !Number.isInteger(followUpRules.contentMaxLength) || followUpRules.contentMaxLength <= 0) {
      return createMobileV2BusinessConfigError();
    }
    if (content.length > followUpRules.contentMaxLength) return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '跟进内容长度不符合要求');
    const nextTime = new Date(nextFollowAt).getTime();
    if (!Number.isFinite(nextTime) || nextTime <= Date.now()) return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '下次跟进时间必须为未来有效时间');
    const now = new Date().toISOString();
    const followUp = {
      id: buildMobileV2EntityId('V2FOLLOW'), content, nextFollowAt, createdBy: operator.id,
      createdByName: operator.name || '', createdAt: now
    };
    if (!Array.isArray(opportunity.followUps)) opportunity.followUps = [];
    opportunity.followUps.push(followUp);
    opportunity.lastFollowAt = now;
    opportunity.nextFollowAt = nextFollowAt;
    opportunity.version += 1;
    opportunity.updatedAt = now;
    const event = createMobileV2Event(req, operator, {
      objectType: 'opportunity', objectId: opportunity.id, action: 'follow_up', beforeStatus: opportunity.stage, afterStatus: opportunity.stage,
      summary: '提交商机跟进', version: opportunity.version
    });
    return {
      data: { ...buildMobileV2OpportunityWriteResponse(opportunity, event), followUp: { id: followUp.id, nextFollowAt: followUp.nextFollowAt, createdAt: followUp.createdAt } },
      event,
      targetName: opportunity.name || opportunity.customer
    };
  });
});

app.get('/api/mobile/v2/opportunities/:id/events', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'opportunity', 'read')) return;
  const opportunity = (db.opportunities || []).find(item => item.id === req.params.id);
  if (!opportunity) return sendMobileV2Error(req, res, 404, 'NOT_FOUND', '商机不存在');
  if (!canMobileOperatorViewRecord(operator, opportunity)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '无权查看该商机事件');
  ensureMobileV2BusinessStores();
  const events = db.mobileV2BusinessEvents.filter(item => item.objectType === 'opportunity' && item.objectId === opportunity.id)
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
    .map(item => pickMobileV2Fields(item, ['id', 'action', 'beforeStatus', 'afterStatus', 'reasonCode', 'summary', 'actorName', 'actorRole', 'requestId', 'createdAt']));
  return sendMobileV2Success(req, res, { data: events });
});

app.get('/api/mobile/v2/quotes', (req, res) => sendMobileV2RecordList(req, res, db.quotes || [], 'quote'));
app.get('/api/mobile/v2/quotes/:id', (req, res) => sendMobileV2RecordDetail(req, res, db.quotes || [], 'quote', '报价单'));
app.get('/api/mobile/v2/orders', (req, res) => sendMobileV2RecordList(req, res, db.orders || [], 'order'));
app.get('/api/mobile/v2/orders/parent-options', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  // 该只读能力受既有 order/read 开关保护，候选范围始终由当前会话所属渠道计算。
  if (!requireMobileV2Feature(req, res, operator, 'order', 'read')) return;
  const quoteId = normalizeTrimmedString(req.query.quoteId);
  if (!quoteId) return sendMobileV2Error(req, res, 400, 'VALIDATION_FAILED', '必须提供已确认报价编号');
  const quote = (db.quotes || []).find(item => item.id === quoteId);
  if (!quote || !canMobileV2OperateQuote(operator, quote)) {
    return sendMobileV2Error(req, res, 404, 'NOT_FOUND', '已确认报价不存在或无权访问');
  }
  if (!isMobileV2QuoteActive(quote)) {
    return sendMobileV2Error(req, res, 409, 'STATE_CONFLICT', '报价未确认、已过期或尚未完成二期映射');
  }
  const currentPartner = (db.partners || []).find(item => item.id === operator.partnerId);
  if (!currentPartner || currentPartner.partnerLevel !== 'secondary') {
    return sendMobileV2Success(req, res, { data: [], applicable: false, message: '当前渠道无需选择一级渠道商' });
  }
  const parentIds = Array.isArray(currentPartner.parentPartnerIds) ? currentPartner.parentPartnerIds
    : (currentPartner.parentPartnerId ? [currentPartner.parentPartnerId] : []);
  const data = parentIds
    .map(id => (db.partners || []).find(item => item.id === id))
    .filter(item => item && item.status === 'active' && item.partnerLevel === 'primary' && item.region === currentPartner.region)
    .map(item => ({ id: item.id, name: item.name || '', region: item.region, partnerLevel: item.partnerLevel }));
  return sendMobileV2Success(req, res, { data, applicable: true });
});
app.get('/api/mobile/v2/orders/:id', (req, res) => sendMobileV2RecordDetail(req, res, db.orders || [], 'order', '订单'));

app.get('/api/mobile/v2/quote-products', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'quote', 'read')) return;
  if (!isMobileV2ChannelOperator(operator)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权查看报价产品范围');
  const pricing = getMobileV2QuotePricingContext(operator);
  if (pricing.error) return sendMobileV2Error(req, res, pricing.error.error.status, pricing.error.error.code, pricing.error.error.error);
  const items = getMobileV2ConfigValues(pricing.priceBook).items
    .filter(item => item && isMobileV2QuotePriceItemMatched(item, operator))
    .map(item => {
      const product = getMobileV2QuoteProduct(item.productId);
      return product ? { id: product.id, name: product.name || product.model || product.id, unit: product.unit || '件' } : null;
    })
    .filter(Boolean);
  return sendMobileV2Success(req, res, { data: items, priceBookVersion: pricing.priceBook.version || '' });
});

app.post('/api/mobile/v2/quotes/preview', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'quote', 'create')) return;
  if (!isMobileV2ChannelOperator(operator)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权试算报价');
  return executeMobileV2Write(req, res, operator, 'quote_preview', () => {
    const calculation = buildMobileV2QuoteCalculation(operator, req.body || {});
    if (calculation.error) return calculation.error;
    const event = createMobileV2Event(req, operator, {
      objectType: 'quote', objectId: buildMobileV2EntityId('V2PREVIEW'), action: 'preview', afterStatus: 'previewed', summary: '服务端试算报价'
    });
    return { data: { ...calculation.data, previewOnly: true, eventId: event.id }, event, targetName: '报价试算' };
  });
});

app.post('/api/mobile/v2/quote-drafts', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'quote', 'create')) return;
  if (!isMobileV2ChannelOperator(operator)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权保存报价草稿');
  return executeMobileV2Write(req, res, operator, 'quote_draft_save', () => {
    const calculation = buildMobileV2QuoteCalculation(operator, req.body || {});
    if (calculation.error) return calculation.error;
    const customer = normalizeTrimmedString(req.body?.customer);
    if (!customer || customer.length > 120) return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '客户名称不合法');
    const now = new Date().toISOString();
    const quote = {
      id: buildMobileV2EntityId('QTV2'), customer, customerName: customer, ...calculation.data,
      status: 'draft', version: 1, mobileV2Lifecycle: true, createdBy: operator.id, createdByName: operator.name || '',
      assignedStaffId: operator.id, assignedStaffName: operator.name || '', partnerId: operator.partnerId, partnerName: getMobilePartnerName(operator.partnerId),
      assignedPartnerId: operator.partnerId, assignedPartnerName: getMobilePartnerName(operator.partnerId), region: operator.region,
      productIds: calculation.data.items.map(item => item.productId), approvalStatus: calculation.data.discountReviewRequired ? 'pending' : 'not_required',
      createdAt: now, updatedAt: now
    };
    db.quotes.push(quote);
    const event = createMobileV2Event(req, operator, {
      objectType: 'quote', objectId: quote.id, action: 'draft_create', afterStatus: quote.status, summary: '创建报价草稿', version: quote.version
    });
    return { data: buildMobileV2QuoteWriteResponse(quote, event), event, targetName: quote.customer };
  });
});

app.post('/api/mobile/v2/quotes', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'quote', 'submit')) return;
  if (!isMobileV2ChannelOperator(operator)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权提交报价');
  return executeMobileV2Write(req, res, operator, 'quote_submit', () => {
    const quoteId = normalizeTrimmedString(req.body?.quoteId);
    const expectedVersion = Number(req.body?.version);
    const quote = (db.quotes || []).find(item => item.id === quoteId);
    if (!quote) return createMobileV2BusinessError(404, 'NOT_FOUND', '报价草稿不存在');
    if (!quote.mobileV2Lifecycle) return createMobileV2BusinessError(422, 'HISTORY_MAPPING_REQUIRED', '历史报价仅支持查询，不能通过二期提交');
    if (!canMobileV2OperateQuote(operator, quote)) return createMobileV2BusinessError(403, 'FORBIDDEN', '当前账号无权提交该报价');
    if (quote.status !== 'draft' || !Number.isInteger(expectedVersion) || expectedVersion !== quote.version) {
      return createMobileV2BusinessError(409, 'STATE_CONFLICT', '报价状态或版本已变化，请刷新后重试');
    }
    const calculation = buildMobileV2QuoteCalculation(operator, { items: quote.items, discountRate: quote.discountRate });
    if (calculation.error) return calculation.error;
    const submittedAt = new Date().toISOString();
    Object.assign(quote, calculation.data, { status: 'sent', updatedAt: submittedAt, expiresAt: new Date(Date.now() + calculation.pricing.validDays * 24 * 60 * 60 * 1000).toISOString() });
    quote.approvalStatus = calculation.data.discountReviewRequired ? 'pending' : 'not_required';
    quote.version += 1;
    const event = createMobileV2Event(req, operator, {
      objectType: 'quote', objectId: quote.id, action: 'submit', beforeStatus: 'draft', afterStatus: quote.status,
      summary: '提交报价', version: quote.version
    });
    return { data: buildMobileV2QuoteWriteResponse(quote, event), event, targetName: quote.customer };
  });
});

app.put('/api/mobile/v2/quotes/:id/discount-review', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'quote', 'review')) return;
  const quote = (db.quotes || []).find(item => item.id === req.params.id);
  if (!quote) return sendMobileV2Error(req, res, 404, 'NOT_FOUND', '待审核报价不存在');
  if (quote.mobileV2Lifecycle !== true) return sendMobileV2Error(req, res, 422, 'HISTORY_MAPPING_REQUIRED', '历史报价仅支持查询，不能通过二期审核');
  const pricing = getMobileV2QuotePricingContext(operator);
  if (pricing.error) return sendMobileV2Error(req, res, pricing.error.error.status, pricing.error.error.code, pricing.error.error.error);
  if (!pricing.reviewRoles.includes(operator.role) || operator.id === quote.createdBy || !canMobileOperatorViewRecord(operator, quote)) {
    return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权审核该报价折扣');
  }
  return executeMobileV2Write(req, res, operator, 'quote_discount_review', () => {
    const expectedVersion = Number(req.body?.version);
    const action = normalizeTrimmedString(req.body?.action);
    const reasonCode = normalizeTrimmedString(req.body?.reasonCode);
    if (quote.status !== 'sent' || quote.approvalStatus !== 'pending' || !Number.isInteger(expectedVersion) || expectedVersion !== quote.version) {
      return createMobileV2BusinessError(409, 'STATE_CONFLICT', '报价状态或版本已变化，请刷新后重试');
    }
    if (!['approve', 'reject'].includes(action) || (action === 'reject' && !reasonCode)) {
      return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '折扣审核动作或驳回原因不合法');
    }
    quote.status = 'sent';
    quote.approvalStatus = action === 'approve' ? 'approved' : 'rejected';
    quote.discountReviewReasonCode = action === 'reject' ? reasonCode : '';
    quote.discountReviewedBy = operator.id;
    quote.updatedAt = new Date().toISOString();
    quote.version += 1;
    const event = createMobileV2Event(req, operator, {
      objectType: 'quote', objectId: quote.id, action: `discount_${action}`, beforeStatus: 'sent', afterStatus: quote.status,
      reasonCode, summary: action === 'approve' ? '通过报价折扣审核' : '驳回报价折扣审核', version: quote.version
    });
    return { data: buildMobileV2QuoteWriteResponse(quote, event), event, targetName: quote.customer };
  });
});

app.get('/api/mobile/v2/quotes/:id/discount-review', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'quote', 'read')) return;
  const quote = (db.quotes || []).find(item => item.id === req.params.id);
  if (!quote) return sendMobileV2Error(req, res, 404, 'NOT_FOUND', '报价不存在');
  if (!canMobileOperatorViewRecord(operator, quote)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '无权查看该报价审核结果');
  return sendMobileV2Success(req, res, { data: pickMobileV2Fields(quote, ['id', 'status', 'version', 'discountRate', 'discountAmount', 'approvalStatus', 'discountReviewReasonCode', 'discountReviewedBy', 'updatedAt']) });
});

app.put('/api/mobile/v2/quotes/:id/confirm', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'quote', 'review')) return;
  const quote = (db.quotes || []).find(item => item.id === req.params.id);
  if (!quote) return sendMobileV2Error(req, res, 404, 'NOT_FOUND', '待确认报价不存在');
  if (quote.mobileV2Lifecycle !== true) return sendMobileV2Error(req, res, 422, 'HISTORY_MAPPING_REQUIRED', '历史报价仅支持查询，不能通过二期确认');
  const pricing = getMobileV2QuotePricingContext(operator);
  if (pricing.error) return sendMobileV2Error(req, res, pricing.error.error.status, pricing.error.error.code, pricing.error.error.error);
  if (operator.role !== 'partner_admin' || !pricing.confirmationRoles.includes(operator.role) || operator.partnerId !== quote.partnerId || !canMobileOperatorViewRecord(operator, quote)) {
    return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权确认该报价');
  }
  return executeMobileV2Write(req, res, operator, 'quote_confirm', () => {
    const expectedVersion = Number(req.body?.version);
    const expiresAt = new Date(quote.expiresAt || 0).getTime();
    if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= Date.now()) {
      return createMobileV2BusinessError(409, 'STATE_CONFLICT', '报价已过期或状态不允许确认');
    }
    if (quote.status !== 'sent' || ['pending', 'rejected'].includes(quote.approvalStatus) || !Number.isInteger(expectedVersion) || expectedVersion !== quote.version) {
      return createMobileV2BusinessError(409, 'STATE_CONFLICT', '报价状态或版本不允许确认');
    }
    quote.status = 'confirmed';
    quote.confirmedBy = operator.id;
    quote.confirmedAt = new Date().toISOString();
    quote.updatedAt = quote.confirmedAt;
    quote.version += 1;
    const event = createMobileV2Event(req, operator, {
      objectType: 'quote', objectId: quote.id, action: 'confirm', beforeStatus: 'sent', afterStatus: quote.status, summary: '确认报价', version: quote.version
    });
    return { data: buildMobileV2QuoteWriteResponse(quote, event), event, targetName: quote.customer };
  });
});

app.post('/api/mobile/v2/order-drafts', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'order', 'create')) return;
  if (!isMobileV2ChannelOperator(operator)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权创建订单草稿');
  return executeMobileV2Write(req, res, operator, 'order_draft_save', () => {
    const quoteId = normalizeTrimmedString(req.body?.quoteId);
    const expectedVersion = Number(req.body?.version);
    const quote = (db.quotes || []).find(item => item.id === quoteId);
    if (!quote) return createMobileV2BusinessError(404, 'NOT_FOUND', '已确认报价不存在');
    if (!quote.mobileV2Lifecycle) return createMobileV2BusinessError(422, 'HISTORY_MAPPING_REQUIRED', '历史报价仅支持查询，不能通过二期转订单');
    if (!canMobileV2OperateQuote(operator, quote)) return createMobileV2BusinessError(403, 'FORBIDDEN', '当前账号无权转该报价的订单');
    if (!isMobileV2QuoteActive(quote) || quote.approvalStatus === 'pending' || !Number.isInteger(expectedVersion) || expectedVersion !== quote.version) {
      return createMobileV2BusinessError(409, 'STATE_CONFLICT', '报价状态或版本不允许转订单');
    }
    const policy = getMobileV2OrderPolicy(operator);
    if (policy.error) return policy.error;
    const primaryPartnerId = normalizeTrimmedString(req.body?.primaryPartnerId);
    const primaryResult = getMobileV2PrimaryPartnerForOrder(operator, primaryPartnerId, policy);
    if (primaryResult.error) return primaryResult.error;
    if ((db.orders || []).some(item => item.mobileV2Lifecycle === true && item.quoteId === quote.id)
      || (db.mobileV2OrderDrafts || []).some(item => item.quoteId === quote.id && item.status === 'draft')) {
      return createMobileV2BusinessError(409, 'ORDER_EXISTS', '该报价已转为订单');
    }
    const deliveryAddr = normalizeTrimmedString(req.body?.deliveryAddr);
    if (!deliveryAddr || deliveryAddr.length > 240) return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '收货地址不合法');
    const now = new Date().toISOString();
    const primary = primaryResult.data;
    const draft = {
      id: buildMobileV2EntityId('V2ORDERDRAFT'), quoteId: quote.id, quoteVersion: quote.version, deliveryAddr,
      primaryPartnerId: primary ? primary.id : '', primaryPartnerName: primary ? primary.name : '', createdBy: operator.id,
      sessionFingerprint: buildMobileV2SessionFingerprint(req), status: 'draft', version: 1, createdAt: now, updatedAt: now
    };
    db.mobileV2OrderDrafts.push(draft);
    const event = createMobileV2Event(req, operator, {
      objectType: 'order_draft', objectId: draft.id, action: 'draft_create', afterStatus: 'draft', summary: '创建订单草稿', version: draft.version
    });
    return { data: { id: draft.id, status: draft.status, version: draft.version, quoteId: draft.quoteId, primaryPartnerId: draft.primaryPartnerId, eventId: event.id }, event, targetName: quote.customer };
  });
});

app.post('/api/mobile/v2/orders/:id/submit', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'order', 'submit')) return;
  if (!isMobileV2ChannelOperator(operator)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权提交订单');
  return executeMobileV2Write(req, res, operator, 'order_submit', () => {
    const draft = (db.mobileV2OrderDrafts || []).find(item => item.id === req.params.id);
    const expectedVersion = Number(req.body?.version);
    if (!canMobileV2OperateOwnOrderDraft(req, operator, draft)) return createMobileV2BusinessError(404, 'NOT_FOUND', '订单草稿不存在或无权提交');
    if (draft.status !== 'draft' || !Number.isInteger(expectedVersion) || expectedVersion !== draft.version) {
      return createMobileV2BusinessError(409, 'STATE_CONFLICT', '订单草稿状态或版本已变化，请刷新后重试');
    }
    const quote = (db.quotes || []).find(item => item.id === draft.quoteId);
    if (!quote || !canMobileV2OperateQuote(operator, quote)) return createMobileV2BusinessError(404, 'NOT_FOUND', '已确认报价不存在或无权访问');
    if (!isMobileV2QuoteActive(quote) || quote.version !== draft.quoteVersion || quote.approvalStatus === 'pending') {
      return createMobileV2BusinessError(409, 'STATE_CONFLICT', '报价状态、有效期或版本已变化，请重新创建订单草稿');
    }
    const policy = getMobileV2OrderPolicy(operator);
    if (policy.error) return policy.error;
    const primaryResult = getMobileV2PrimaryPartnerForOrder(operator, draft.primaryPartnerId, policy);
    if (primaryResult.error) return primaryResult.error;
    if ((db.orders || []).some(item => item.mobileV2Lifecycle === true && item.quoteId === quote.id)) return createMobileV2BusinessError(409, 'ORDER_EXISTS', '该报价已转为订单');
    const now = new Date().toISOString();
    const primary = primaryResult.data;
    const order = {
      id: buildMobileV2EntityId('ORDV2'), quoteId: quote.id, customer: quote.customer, customerName: quote.customer, regId: quote.regId || '', oppId: quote.oppId || '',
      items: cloneMobileV2BusinessValue(quote.items), subtotal: quote.subtotal, discountRate: quote.discountRate, discountAmount: quote.discountAmount,
      taxRate: quote.taxRate, taxAmount: quote.taxAmount, total: quote.total, currency: quote.currency, pricingSnapshot: cloneMobileV2BusinessValue(quote.pricingSnapshot),
      quoteSnapshot: { id: quote.id, version: quote.version, total: quote.total, currency: quote.currency, items: cloneMobileV2BusinessValue(quote.items) },
      deliveryAddr: draft.deliveryAddr, partnerId: quote.partnerId, partnerName: quote.partnerName, assignedPartnerId: quote.assignedPartnerId, assignedPartnerName: quote.assignedPartnerName,
      primaryPartnerId: primary ? primary.id : '', primaryPartnerName: primary ? primary.name : '', parentPartnerId: primary ? primary.id : null,
      region: quote.region, createdBy: operator.id, createdByName: operator.name || '', assignedStaffId: quote.assignedStaffId, assignedStaffName: quote.assignedStaffName,
      status: 'pending', version: 1, mobileV2Lifecycle: true, createdAt: now, updatedAt: now
    };
    quote.status = 'converted';
    quote.convertedOrderId = order.id;
    quote.updatedAt = now;
    quote.version += 1;
    draft.status = 'submitted';
    draft.updatedAt = now;
    draft.version += 1;
    db.orders.push(order);
    const quoteEvent = createMobileV2Event(req, operator, {
      objectType: 'quote', objectId: quote.id, action: 'convert_order', beforeStatus: 'confirmed', afterStatus: quote.status, summary: '报价转订单', version: quote.version
    });
    const orderEvent = createMobileV2Event(req, operator, {
      objectType: 'order', objectId: order.id, action: 'submit', beforeStatus: 'draft', afterStatus: order.status, summary: '提交订单', version: order.version
    });
    return { data: { ...buildMobileV2OrderWriteResponse(order, orderEvent), quoteEventId: quoteEvent.id }, events: [quoteEvent, orderEvent], targetName: order.customer };
  });
});

app.put('/api/mobile/v2/orders/:id/primary-review', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'order', 'primary_review')) return;
  const order = (db.orders || []).find(item => item.id === req.params.id);
  if (!order) return sendMobileV2Error(req, res, 404, 'NOT_FOUND', '待一级确认订单不存在');
  if (order.mobileV2Lifecycle !== true) return sendMobileV2Error(req, res, 422, 'HISTORY_MAPPING_REQUIRED', '历史订单仅支持查询，不能通过二期确认');
  if (operator.role !== 'partner_admin' || operator.partnerId !== order.primaryPartnerId) {
    return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '仅指定一级渠道管理员可以确认或驳回订单');
  }
  return executeMobileV2Write(req, res, operator, 'order_primary_review', () => {
    const policy = getMobileV2OrderPolicy(operator);
    if (policy.error) return policy.error;
    const expectedVersion = Number(req.body?.version);
    const action = normalizeTrimmedString(req.body?.action);
    const reasonCode = normalizeTrimmedString(req.body?.reasonCode);
    if (order.status !== 'pending' || !order.primaryPartnerId || !Number.isInteger(expectedVersion) || expectedVersion !== order.version) {
      return createMobileV2BusinessError(409, 'STATE_CONFLICT', '订单状态或版本已变化，请刷新后重试');
    }
    if (!['approve', 'reject'].includes(action) || (action === 'reject' && !policy.rejectReasons.includes(reasonCode))) {
      return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '一级确认动作或驳回原因不合法');
    }
    order.status = action === 'approve' ? 'primary_confirmed' : 'primary_rejected';
    order.primaryReviewedBy = operator.id;
    order.primaryReviewReasonCode = action === 'reject' ? reasonCode : '';
    order.version += 1;
    order.updatedAt = new Date().toISOString();
    const event = createMobileV2Event(req, operator, {
      objectType: 'order', objectId: order.id, action: `primary_${action}`, beforeStatus: 'pending', afterStatus: order.status,
      reasonCode, summary: action === 'approve' ? '一级确认订单' : '一级驳回订单', version: order.version
    });
    return { data: buildMobileV2OrderWriteResponse(order, event), event, targetName: order.customer };
  });
});

app.put('/api/mobile/v2/orders/:id/fulfillment', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'order', 'fulfill')) return;
  const order = (db.orders || []).find(item => item.id === req.params.id);
  if (!order) return sendMobileV2Error(req, res, 404, 'NOT_FOUND', '订单不存在');
  if (order.mobileV2Lifecycle !== true) return sendMobileV2Error(req, res, 422, 'HISTORY_MAPPING_REQUIRED', '历史订单仅支持查询，不能通过二期履约');
  if (!['admin', 'superadmin'].includes(operator.role) || !canMobileOperatorViewRecord(operator, order)) {
    return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '仅本区域管理员可以推进履约');
  }
  return executeMobileV2Write(req, res, operator, 'order_fulfill', () => {
    const policy = getMobileV2OrderPolicy(operator);
    if (policy.error) return policy.error;
    const expectedVersion = Number(req.body?.version);
    const targetStatus = normalizeTrimmedString(req.body?.status);
    if (!Number.isInteger(expectedVersion) || !targetStatus) {
      return createMobileV2BusinessError(400, 'VALIDATION_FAILED', '履约状态和当前对象版本均为必填项');
    }
    if (expectedVersion !== order.version) return createMobileV2BusinessError(409, 'STATE_CONFLICT', '订单已被其他操作更新，请刷新后重试');
    const allowed = Array.isArray(policy.transitions[order.status]) ? policy.transitions[order.status] : [];
    if (!allowed.includes(targetStatus)) return createMobileV2BusinessError(409, 'STATE_CONFLICT', '当前订单状态不允许跳转到目标履约状态');
    const beforeStatus = order.status;
    order.status = targetStatus;
    order.version += 1;
    order.updatedAt = new Date().toISOString();
    const event = createMobileV2Event(req, operator, {
      objectType: 'order', objectId: order.id, action: 'fulfill', beforeStatus, afterStatus: order.status, summary: '推进订单履约', version: order.version
    });
    return { data: buildMobileV2OrderWriteResponse(order, event), event, targetName: order.customer };
  });
});

app.all([
  '/api/mobile/v2/orders/:id/price-adjustments',
  '/api/mobile/v2/orders/:id/adjust-price',
  '/api/mobile/v2/orders/:id/cancel',
  '/api/mobile/v2/orders/:id/refund',
  '/api/mobile/v2/orders/:id/refunds'
], (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  return sendMobileV2Error(req, res, 403, 'FEATURE_DISABLED', '订单调价、取消和退款尚未在移动端开放');
});

function sendMobileV2BusinessEvents(req, res, type, records, label) {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, type, 'read')) return;
  const record = (records || []).find(item => item.id === req.params.id);
  if (!record) return sendMobileV2Error(req, res, 404, 'NOT_FOUND', `${label}不存在`);
  if (!canMobileOperatorViewRecord(operator, record)) return sendMobileV2Error(req, res, 403, 'FORBIDDEN', `无权查看该${label}事件`);
  ensureMobileV2BusinessStores();
  const events = db.mobileV2BusinessEvents.filter(item => item.objectType === type && item.objectId === record.id)
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
    .map(item => pickMobileV2Fields(item, ['id', 'action', 'beforeStatus', 'afterStatus', 'reasonCode', 'summary', 'actorName', 'actorRole', 'requestId', 'createdAt']));
  return sendMobileV2Success(req, res, { data: events });
}

app.get('/api/mobile/v2/quotes/:id/events', (req, res) => sendMobileV2BusinessEvents(req, res, 'quote', db.quotes || [], '报价'));
app.get('/api/mobile/v2/orders/:id/events', (req, res) => sendMobileV2BusinessEvents(req, res, 'order', db.orders || [], '订单'));

app.get('/api/mobile/v2/partners', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'partner', 'read')) return;
  if (!['admin', 'superadmin'].includes(operator.role)) {
    return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权查看渠道商');
  }
  const keyword = normalizeTrimmedString(req.query.keyword).toLowerCase();
  const status = normalizeTrimmedString(req.query.status);
  const records = (db.partners || [])
    .filter(item => canMobileV2OperatorViewPartner(operator, item))
    .filter(item => !status || item.status === status)
    .filter(item => !keyword || [item.id, item.name, item.region, item.city].some(value => normalizeTrimmedString(value).toLowerCase().includes(keyword)));
  const page = buildMobilePage(sortMobileV2Records(records), req.query);
  return sendMobileV2Success(req, res, {
    data: page.data.map(item => buildMobileV2Record(item, 'partner')),
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    hasMore: page.hasMore
  });
});

app.get('/api/mobile/v2/partners/:id', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'partner', 'read')) return;
  if (!['admin', 'superadmin'].includes(operator.role)) {
    return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '当前账号无权查看渠道商');
  }
  const partner = (db.partners || []).find(item => item.id === req.params.id);
  if (!partner) return sendMobileV2Error(req, res, 404, 'NOT_FOUND', '渠道商不存在');
  if (!canMobileV2OperatorViewPartner(operator, partner)) {
    return sendMobileV2Error(req, res, 403, 'FORBIDDEN', '无权查看该渠道商');
  }
  return sendMobileV2Success(req, res, { data: buildMobileV2Record(partner, 'partner', true) });
});

app.get('/api/mobile/v2/catalog', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!requireMobileV2Feature(req, res, operator, 'catalog', 'read')) return;
  return sendMobileV2Success(req, res, { data: buildMobileV2Catalog() });
});

app.post('/api/mobile/v2/logout', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  revokeMobileV2Session(req, operator, '用户主动退出', 'logout');
  return sendMobileV2Success(req, res, { data: { loggedOut: true } });
});

// 所有未发布的二期路径仍须鉴权并以统一结构返回，避免默认 404 响应缺少请求编号。
app.use('/api/mobile/v2', (req, res) => {
  const operator = getMobileV2Operator(req, res);
  if (!operator) return;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
    return sendMobileV2Error(req, res, 403, 'FEATURE_DISABLED', '当前二期业务写入功能未开放');
  }
  return sendMobileV2Error(req, res, 404, 'NOT_FOUND', '二期接口不存在或未开放');
});

// 仅规范化二期接口异常，不改变一期与电脑端既有错误响应。
app.use((error, req, res, next) => {
  if (!String(req.path || '').startsWith('/api/mobile/v2')) return next(error);
  if (res.headersSent) return next(error);
  if (!req.requestId) {
    req.requestId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }
  const isInvalidRequest = error && (error.type === 'entity.parse.failed' || error.status === 400);
  return sendMobileV2Error(
    req,
    res,
    isInvalidRequest ? 400 : 500,
    isInvalidRequest ? 'REQUEST_INVALID' : 'V2_SERVICE_ERROR',
    isInvalidRequest ? '请求数据格式不正确，请检查后重试' : '二期服务暂时不可用，请稍后重试'
  );
});

app.get('/api/mobile/registrations', (req, res) => {
  const operator = requireMobileOperator(req, res);
  if (!operator) return;
  const records = filterMobileRecords(db.registrations, operator, req.query)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, ...buildMobilePage(records, req.query) });
});

function buildMobileCompanySearchLocalMatches(operator, keyword) {
  const normalizedKeyword = normalizeTrimmedString(keyword).toLowerCase();
  const seenNames = new Set();
  return (db.registrations || [])
    .filter(item => canMobileOperatorViewRecord(operator, item))
    .filter(item => normalizeTrimmedString(item.customer || item.customerName).toLowerCase().includes(normalizedKeyword))
    .filter(item => {
      const customer = normalizeTrimmedString(item.customer || item.customerName);
      if (!customer || seenNames.has(customer)) return false;
      seenNames.add(customer);
      return true;
    })
    .slice(0, 10)
    .map(item => ({
      name: item.customer || item.customerName || '',
      creditCode: item.creditCode || '',
      legalPerson: item.legalPerson || '',
      address: item.address || item.city || '',
      province: '',
      city: item.city || '',
      companyStatus: '在营',
      industry: item.industry || '',
      source: 'local',
    }));
}

function pickMobileCompanySearchFields(items) {
  return (Array.isArray(items) ? items : [])
    .slice(0, 10)
    .map(item => ({
      name: normalizeTrimmedString(item?.name || item?.customer),
      creditCode: normalizeTrimmedString(item?.creditCode),
      industry: normalizeTrimmedString(item?.industry),
      city: normalizeTrimmedString(item?.city),
      address: normalizeTrimmedString(item?.address),
      province: normalizeTrimmedString(item?.province),
      source: normalizeTrimmedString(item?.source),
    }))
    .filter(item => item.name);
}

app.get('/api/mobile/company-search', async (req, res) => {
  const operator = requireMobileOperator(req, res);
  if (!operator) return;
  const keyword = normalizeTrimmedString(req.query.keyword);
  if (keyword.length < 2) return res.json({ success: true, data: [] });
  const localMatches = buildMobileCompanySearchLocalMatches(operator, keyword);
  try {
    const result = await runOpenApiCompanySearch(keyword, localMatches);
    return res.json({ success: true, data: pickMobileCompanySearchFields(result.data), note: result.note || '' });
  } catch (error) {
    return res.json({ success: true, data: pickMobileCompanySearchFields(mergeCompanySearchResults(searchCustomerLedger(keyword, 10), localMatches)), note: 'search_degraded' });
  }
});

app.get('/api/mobile/registrations/:id', (req, res) => {
  sendMobileRecordDetail(req, res, db.registrations, '报备');
});

app.post('/api/mobile/registrations', (req, res) => {
  const operator = requireMobileOperator(req, res);
  if (!operator || !requireMobileRole(operator, res, ['staff', 'partner_admin'])) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const customer = normalizeTrimmedString(body.customer);
  const contact = normalizeTrimmedString(body.contact);
  const phone = normalizeTrimmedString(body.phone);
  if (!customer || !contact || !phone) {
    return res.status(400).json({ success: false, error: '客户名称、联系人和联系电话不能为空' });
  }
  const duplicate = db.registrations.find(item => normalizeTrimmedString(item.customer).toLowerCase() === customer.toLowerCase());
  if (duplicate) {
    return res.status(409).json({ success: false, error: '该客户已被报备，不能重复报备' });
  }
  const partnerId = operator.partnerId;
  const user = (db.users || []).find(item => item.id === operator.id);
  const reg = {
    id: 'REG-' + Date.now(),
    ...pickMobileInput(body, ['industry', 'email', 'city', 'creditCode', 'notes', 'endpointRange', 'signDate', 'source']),
    customer,
    contact,
    phone,
    status: 'pending',
    createdBy: operator.id,
    createdByName: operator.name,
    assignedStaffId: operator.id,
    assignedStaffName: operator.name,
    partnerId,
    partnerName: getMobilePartnerName(partnerId),
    assignedPartnerId: partnerId,
    assignedPartnerName: getMobilePartnerName(partnerId),
    region: operator.region || user?.region || (db.partners || []).find(item => item.id === partnerId)?.region || '',
    createdAt: new Date().toISOString(),
    expireAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
  };
  db.registrations.push(reg);
  saveData();
  writeAuditLog(req, { module: 'registration', action: 'create', result: 'success', message: '手机端创建客户报备', targetType: 'registration', targetId: reg.id, targetName: reg.customer, after: reg });
  res.json({ success: true, data: reg });
});

app.get('/api/mobile/opportunities', (req, res) => {
  const operator = requireMobileOperator(req, res);
  if (!operator) return;
  const records = filterMobileRecords(db.opportunities, operator, req.query)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, ...buildMobilePage(records, req.query) });
});

app.get('/api/mobile/opportunities/:id', (req, res) => {
  sendMobileRecordDetail(req, res, db.opportunities, '商机');
});

app.post('/api/mobile/opportunities/:id/follow-ups', (req, res) => {
  const operator = requireMobileOperator(req, res);
  if (!operator || !requireMobileRole(operator, res, ['staff', 'partner_admin'])) return;
  const opportunity = (db.opportunities || []).find(item => item.id === req.params.id);
  if (!opportunity) return res.status(404).json({ success: false, error: '商机不存在' });
  if (!canMobileOperatorViewRecord(operator, opportunity)) {
    return res.status(403).json({ success: false, error: '无权跟进该商机' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const content = normalizeTrimmedString(body.content);
  const nextFollowAt = normalizeTrimmedString(body.nextFollowAt);
  const nextStage = normalizeMobileOpportunityStage(body.stage, opportunity.stage || 'contacted');
  if (!content) return res.status(400).json({ success: false, error: '跟进内容不能为空' });
  if (content.length > 500) return res.status(400).json({ success: false, error: '跟进内容不能超过500字' });
  if (!nextStage) return res.status(400).json({ success: false, error: '商机阶段不正确' });
  if (nextFollowAt && Number.isNaN(new Date(nextFollowAt).getTime())) {
    return res.status(400).json({ success: false, error: '下次跟进日期格式不正确' });
  }

  const beforeOpportunity = cloneAuditValue(opportunity);
  const now = new Date();
  const followUp = {
    id: buildMobileUniqueRecordId('FU', opportunity.followUps || []),
    type: normalizeMobileFollowUpType(body.type),
    content,
    stage: nextStage,
    beforeStage: opportunity.stage || '',
    nextFollowAt,
    user: operator.name,
    userId: operator.id,
    date: formatDateKey(now),
    createdAt: now.toISOString()
  };
  if (!Array.isArray(opportunity.followUps)) opportunity.followUps = [];
  opportunity.followUps.push(followUp);
  opportunity.stage = nextStage;
  opportunity.lastFollowAt = followUp.createdAt;
  if (nextFollowAt) opportunity.nextFollowAt = nextFollowAt;
  opportunity.updatedAt = followUp.createdAt;
  saveData();
  writeAuditLog(req, {
    module: 'opportunity',
    action: 'follow_up',
    result: 'success',
    message: '手机端提交商机跟进',
    targetType: 'opportunity',
    targetId: opportunity.id,
    targetName: opportunity.name || opportunity.customer,
    before: beforeOpportunity,
    after: opportunity,
    extra: { followUpId: followUp.id }
  });
  res.json({ success: true, data: { ...opportunity }, followUp });
});

app.post('/api/mobile/opportunities', (req, res) => {
  const operator = requireMobileOperator(req, res);
  if (!operator || !requireMobileRole(operator, res, ['staff', 'partner_admin'])) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const regId = normalizeTrimmedString(body.regId);
  const registration = db.registrations.find(item => item.id === regId);
  if (!registration || registration.status !== 'approved' || !canMobileOperatorViewRecord(operator, registration)) {
    return res.status(403).json({ success: false, error: '只能为本人可见的已审批报备创建商机' });
  }
  const name = normalizeTrimmedString(body.name);
  const stage = normalizeMobileOpportunityStage(body.stage, 'contacted');
  if (!name) return res.status(400).json({ success: false, error: '商机名称不能为空' });
  if (!stage) return res.status(400).json({ success: false, error: '商机阶段不正确' });
  const duplicate = db.opportunities.find(item =>
    item.regId === registration.id &&
    normalizeTrimmedString(item.name).toLowerCase() === name.toLowerCase() &&
    item.createdBy === operator.id &&
    Date.now() - new Date(item.createdAt || 0).getTime() < 60 * 1000
  );
  if (duplicate) return res.status(409).json({ success: false, error: '请勿重复提交相同商机' });
  const partnerId = operator.partnerId;
  const opp = {
    id: 'OPP-' + Date.now(),
    ...pickMobileInput(body, ['amount', 'endpoints', 'expectedClose', 'source', 'contactPerson', 'contactPhone', 'tags', 'notes', 'followUps']),
    name,
    customer: registration.customer,
    industry: registration.industry || '',
    contact: normalizeTrimmedString(body.contactPerson) || registration.contact || '',
    phone: normalizeTrimmedString(body.contactPhone) || registration.phone || '',
    regId: registration.id,
    region: registration.region || operator.region || '',
    partnerId,
    partnerName: getMobilePartnerName(partnerId),
    assignedPartnerId: partnerId,
    assignedPartnerName: getMobilePartnerName(partnerId),
    createdBy: operator.id,
    createdByName: operator.name,
    ownerId: operator.id,
    owner: operator.name,
    assignedStaffId: operator.id,
    assignedStaffName: operator.name,
    quoteId: null,
    stage,
    tags: Array.isArray(body.tags) ? body.tags : [],
    followUps: Array.isArray(body.followUps) ? body.followUps : [],
    createdAt: new Date().toISOString()
  };
  db.opportunities.push(opp);
  saveData();
  writeAuditLog(req, { module: 'opportunity', action: 'create', result: 'success', message: '手机端创建商机', targetType: 'opportunity', targetId: opp.id, targetName: opp.name, after: opp });
  res.json({ success: true, data: opp });
});

app.get('/api/mobile/quotes', (req, res) => {
  const operator = requireMobileOperator(req, res);
  if (!operator) return;
  const records = filterMobileRecords(db.quotes, operator, req.query)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, ...buildMobilePage(records, req.query) });
});

app.get('/api/mobile/quotes/:id', (req, res) => {
  sendMobileRecordDetail(req, res, db.quotes, '报价单');
});

app.post('/api/mobile/quotes/:id/convert-order', (req, res) => {
  const operator = requireMobileOperator(req, res);
  if (!operator || !requireMobileRole(operator, res, ['staff', 'partner_admin'])) return;
  const quote = (db.quotes || []).find(item => item.id === req.params.id);
  if (!quote) return res.status(404).json({ success: false, error: '报价单不存在' });
  if (!canMobileOperatorViewRecord(operator, quote)) {
    return res.status(403).json({ success: false, error: '无权转该报价单为订单' });
  }
  if (quote.status === 'converted' || quote.convertedOrderId || (db.orders || []).some(item => item.quoteId === quote.id)) {
    return res.status(409).json({ success: false, error: '该报价已转为订单，不能重复转单', code: 'ORDER_EXISTS' });
  }
  if (quote.status !== 'confirmed') {
    return res.status(409).json({ success: false, error: '仅已确认报价可以转为订单', code: 'QUOTE_NOT_CONFIRMED' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const deliveryContactName = normalizeTrimmedString(body.deliveryContactName);
  const deliveryContactPhone = normalizeTrimmedString(body.deliveryContactPhone);
  const deliveryAddress = normalizeTrimmedString(body.deliveryAddress);
  if (!deliveryContactName || !deliveryContactPhone || !deliveryAddress) {
    return res.status(400).json({ success: false, error: '交付联系人、联系电话和交付地址不能为空' });
  }
  if (!/^[+\d][\d\s-]{5,20}$/.test(deliveryContactPhone)) {
    return res.status(400).json({ success: false, error: '联系电话格式不正确' });
  }
  if (deliveryAddress.length > 240) return res.status(400).json({ success: false, error: '交付地址不能超过240字' });

  const beforeQuote = cloneAuditValue(quote);
  const built = buildMobileOrderFromQuote(req, operator, quote, body);
  if (built.error) return res.status(built.error.status).json(built.error.body);
  const order = built.order;
  const now = order.createdAt;
  quote.status = 'converted';
  quote.convertedOrderId = order.id;
  quote.convertedAt = now;
  quote.updatedAt = now;
  if (!Array.isArray(quote.statusHistory)) quote.statusHistory = [];
  quote.statusHistory.push({
    from: beforeQuote.status,
    to: 'converted',
    action: 'convert_order',
    operatorId: operator.id,
    operatorName: operator.name,
    changedAt: now
  });
  db.orders.push(order);
  if (order.partnerId) updatePartnerStats(order.partnerId);
  if (order.assignedPartnerId && order.assignedPartnerId !== order.partnerId) updatePartnerStats(order.assignedPartnerId);
  saveData();
  writeAuditLog(req, {
    module: 'quote',
    action: 'convert_order',
    result: 'success',
    message: '手机端已确认报价转订单',
    targetType: 'quote',
    targetId: quote.id,
    targetName: quote.customerName || quote.customer || quote.id,
    before: beforeQuote,
    after: quote,
    extra: { orderId: order.id }
  });
  writeAuditLog(req, {
    module: 'order',
    action: 'create',
    result: 'success',
    message: '手机端报价转订单创建成功',
    targetType: 'order',
    targetId: order.id,
    targetName: order.customerName || order.id,
    after: order,
    extra: { quoteId: quote.id }
  });
  res.json({ success: true, data: order, quote });
});

app.get('/api/mobile/orders', (req, res) => {
  const operator = requireMobileOperator(req, res);
  if (!operator) return;
  const records = filterMobileRecords(db.orders, operator, req.query)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, ...buildMobilePage(records, req.query) });
});

app.get('/api/mobile/orders/:id', (req, res) => {
  sendMobileRecordDetail(req, res, db.orders, '订单');
});

app.get('/api/mobile/partners', (req, res) => {
  const operator = requireMobileOperator(req, res);
  if (!operator || !requireMobileRole(operator, res, ['admin', 'superadmin'])) return;
  const keyword = normalizeTrimmedString(req.query.keyword).toLowerCase();
  const status = normalizeTrimmedString(req.query.status);
  const records = (db.partners || [])
    .filter(partner => operator.role === 'superadmin' || partner.region === operator.region)
    .filter(partner => !status || partner.status === status)
    .filter(partner => !keyword || [partner.id, partner.name, partner.region, partner.contact].some(value => normalizeTrimmedString(value).toLowerCase().includes(keyword)))
    .map(partner => ({ ...partner }));
  res.json({ success: true, ...buildMobilePage(records, req.query) });
});

app.get('/api/mobile/partners/:id', (req, res) => {
  sendMobilePartnerDetail(req, res);
});

app.put('/api/mobile/registrations/:id/status', (req, res) => {
  const operator = requireMobileOperator(req, res);
  if (!operator || !requireMobileRole(operator, res, ['admin', 'superadmin'])) return;
  const registration = db.registrations.find(item => item.id === req.params.id);
  if (!registration) return res.status(404).json({ success: false, error: '报备不存在' });
  if (!canMobileOperatorViewRecord(operator, registration)) return res.status(403).json({ success: false, error: '无权审核该报备' });
  const status = normalizeTrimmedString(req.body?.status);
  const remark = normalizeTrimmedString(req.body?.remark);
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ success: false, error: '审核状态不合法' });
  if (status === 'rejected' && !remark) return res.status(400).json({ success: false, error: '驳回时必须填写原因' });
  if (!['pending', 'reviewing'].includes(registration.status)) return res.status(409).json({ success: false, error: '该报备已处理，请刷新后重试' });
  registration.status = status;
  registration.remark = remark;
  registration.approvedBy = operator.name;
  registration.approvedAt = new Date().toISOString();
  registration.updatedAt = new Date().toISOString();
  saveData();
  writeAuditLog(req, { module: 'approval', action: 'review_registration', result: 'success', message: status === 'approved' ? '手机端审核通过客户报备' : '手机端驳回客户报备', targetType: 'registration', targetId: registration.id, targetName: registration.customer, after: registration });
  res.json({ success: true, data: registration });
});

app.get('/api/mobile/pending-approvals', (req, res) => {
  const operator = requireMobileOperator(req, res);
  if (!operator || !requireMobileRole(operator, res, ['superadmin'])) return;
  const records = (db.pendingApprovals || []).filter(item => item.status === 'pending').map(item => ({ ...item }));
  res.json({ success: true, ...buildMobilePage(records, req.query) });
});

app.put('/api/mobile/partners/:id/status', (req, res) => {
  const operator = requireMobileOperator(req, res);
  if (!operator || !requireMobileRole(operator, res, ['superadmin'])) return;
  const partner = (db.partners || []).find(item => item.id === req.params.id);
  if (!partner) return res.status(404).json({ success: false, error: '渠道商不存在' });
  const status = normalizeTrimmedString(req.body?.status);
  const remark = normalizeTrimmedString(req.body?.remark);
  if (!['active', 'rejected'].includes(status)) return res.status(400).json({ success: false, error: '审核状态不合法' });
  if (status === 'rejected' && !remark) return res.status(400).json({ success: false, error: '驳回时必须填写原因' });
  if (partner.status !== 'pending') return res.status(409).json({ success: false, error: '该渠道商已处理，请刷新后重试' });
  partner.status = status;
  partner.approvedBy = operator.name;
  partner.approvedAt = new Date().toISOString();
  partner.remark = remark;
  const pendingApproval = (db.pendingApprovals || []).find(item => item.type === 'partner' && item.targetId === partner.id && item.status === 'pending');
  if (pendingApproval) {
    pendingApproval.status = status === 'active' ? 'approved' : 'rejected';
    pendingApproval.approvedBy = operator.name;
    pendingApproval.approvedAt = partner.approvedAt;
    pendingApproval.remark = remark;
  }
  saveData();
  writeAuditLog(req, { module: 'approval', action: 'review_partner', result: 'success', message: status === 'active' ? '手机端审核通过渠道商' : '手机端驳回渠道商', targetType: 'partner', targetId: partner.id, targetName: partner.name, after: partner });
  res.json({ success: true, data: partner });
});

app.post('/api/mobile/logout', (req, res) => {
  const operator = requireMobileOperator(req, res);
  if (!operator) return;
  const token = getBearerToken(req);
  db.tokens = (db.tokens || []).filter(item => item.token !== token);
  saveData();
  writeAuditLog(req, { module: 'auth', action: 'logout', result: 'success', message: '手机端退出登录', targetType: 'user', targetId: operator.id, targetName: operator.name });
  res.json({ success: true });
});

app.put('/api/mobile/pending-approvals/:id', (req, res) => {
  const operator = requireMobileOperator(req, res);
  if (!operator || !requireMobileRole(operator, res, ['superadmin'])) return;
  const approval = (db.pendingApprovals || []).find(item => item.id === req.params.id);
  if (!approval) return res.status(404).json({ success: false, error: '待审批记录不存在' });
  if (approval.status !== 'pending') return res.status(409).json({ success: false, error: '该记录已处理，请刷新后重试' });
  const action = normalizeTrimmedString(req.body?.action);
  const remark = normalizeTrimmedString(req.body?.remark);
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ success: false, error: '审批动作不合法' });
  if (action === 'reject' && !remark) return res.status(400).json({ success: false, error: '驳回时必须填写原因' });
  const user = (db.users || []).find(item => item.id === approval.targetId);
  if (action === 'approve' && user) user.status = 'active';
  if (action === 'reject' && user) {
    user.status = 'rejected';
    const targetReferences = new Set([user.id, user.username].filter(Boolean));
    db.tokens = (db.tokens || []).filter(token =>
      !targetReferences.has(token.userId) && !targetReferences.has(token.username)
    );
  }
  const partner = (db.partners || []).find(item => item.id === approval.targetPartnerId);
  const staff = partner?.staff?.find(item => item.userId === approval.targetId || item.id === approval.targetId);
  if (staff) staff.status = action === 'approve' ? 'active' : 'rejected';
  approval.status = action === 'approve' ? 'approved' : 'rejected';
  approval.approvedBy = operator.name;
  approval.approvedAt = new Date().toISOString();
  approval.remark = remark;
  saveData();
  writeAuditLog(req, { module: 'approval', action: 'process_pending', result: 'success', message: action === 'approve' ? '手机端审批通过账号' : '手机端驳回账号', targetType: 'pending_approval', targetId: approval.id, targetName: approval.targetName || approval.id, after: approval });
  res.json({ success: true, data: approval });
});

function canManagePartnerProfile(operator, partner) {
  if (!operator || !partner) return false;
  if (operator.role === 'superadmin') return true;
  if (operator.role === 'admin') return Boolean(operator.region && operator.region === partner.region);
  return false;
}

function isLinkedPartnerVisible(operatorPartnerId, targetPartner) {
  if (!operatorPartnerId || !targetPartner) return false;
  if (targetPartner.id === operatorPartnerId) return true;
  if (targetPartner.parentPartnerId && targetPartner.parentPartnerId === operatorPartnerId) return true;
  if (Array.isArray(targetPartner.parentPartnerIds) && targetPartner.parentPartnerIds.includes(operatorPartnerId)) return true;
  const operatorPartner = (db.partners || []).find(item => item.id === operatorPartnerId);
  if (!operatorPartner) return false;
  if (operatorPartner.parentPartnerId && operatorPartner.parentPartnerId === targetPartner.id) return true;
  return Array.isArray(operatorPartner.parentPartnerIds) && operatorPartner.parentPartnerIds.includes(targetPartner.id);
}

function canViewPartnerProfile(operator, partner) {
  if (!operator || !partner) return false;
  if (operator.role === 'superadmin') return true;
  if (operator.role === 'admin') return !operator.region || operator.region === partner.region;
  if (operator.role === 'partner_admin' || operator.role === 'staff') {
    return isLinkedPartnerVisible(operator.partnerId, partner);
  }
  return false;
}

function canViewSensitivePartnerProfile(operator, partner) {
  if (!operator || !partner) return false;
  if (operator.role === 'superadmin') return true;
  if (operator.role === 'admin') return canViewPartnerProfile(operator, partner);
  return false;
}

function maskPhoneNumber(value) {
  const text = normalizeTrimmedString(value);
  if (!text) return '';
  const digits = text.replace(/\D/g, '');
  if (digits.length < 7) return text.replace(/(\d{2})\d+(\d{2})/, '$1****$2');
  return text.replace(digits, `${digits.slice(0, 3)}****${digits.slice(-4)}`);
}

function getPartnerProfileProductModuleNames(product) {
  const moduleIds = normalizeStringList(product?.moduleIds);
  return moduleIds.map(moduleId => {
    const moduleItem = (db.modules || []).find(item => item.id === moduleId);
    return moduleItem?.name || moduleId;
  });
}

function ensurePartnerProfileData() {
  let changed = false;
  if (!Array.isArray(db.partnerProfiles)) {
    db.partnerProfiles = [];
    changed = true;
  }
  if (!Array.isArray(db.partnerProfileProducts)) {
    db.partnerProfileProducts = [];
    changed = true;
  }
  db.partnerProfiles.forEach(profile => {
    if (ensurePartnerProfileCompatibility(profile)) changed = true;
  });
  if (db.partnerProfileProducts.length > 0) return changed;

  const defaults = [
    { name: '安全网关', code: 'security-gateway', moduleIds: ['MOD-LEP-04'], sort: 10 },
    { name: '终端安全', code: 'endpoint-security', moduleIds: ['MOD-LEP-01'], sort: 20 },
    { name: '云桌面', code: 'cloud-desktop', moduleIds: ['MOD-LEP-01'], sort: 30 },
    { name: '态势感知', code: 'situational-awareness', moduleIds: ['MOD-LEP-03'], sort: 40 }
  ];

  db.partnerProfileProducts = defaults.map(item => ({
    id: `PPP-${item.code}`,
    name: item.name,
    code: item.code,
    productLine: '默认画像产品',
    moduleIds: item.moduleIds,
    status: 'active',
    sort: item.sort,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  return true;
}

function createBlankPartnerProfile(partnerId) {
  return {
    id: partnerId,
    partnerId,
    address: '',
    bossName: '',
    bossPhone: '',
    establishedAt: '',
    employeeCount: '',
    annualRevenue: '',
    invoiceCapability: '',
    customerIndustries: [],
    agencyBrands: [],
    qualifications: [],
    authorizedProducts: [],
    typicalCustomers: [],
    serviceAreas: [],
    extended: cloneAuditValue(PARTNER_PROFILE_EXTENSION_DEFAULTS),
    matrix: {},
    verified: false,
    updatedAt: ''
  };
}

function getPartnerProfile(partnerId, createIfMissing = true) {
  ensurePartnerProfileData();
  let profile = db.partnerProfiles.find(item => item.partnerId === partnerId || item.id === partnerId);
  if (!profile) {
    profile = createBlankPartnerProfile(partnerId);
    if (!createIfMissing) return profile;
    db.partnerProfiles.push(profile);
  }
  ensurePartnerProfileCompatibility(profile);
  return profile;
}

function getRecordIndustry(record) {
  return normalizeTrimmedString(record?.industry || record?.customerType || record?.customerCategory || '其他') || '其他';
}

function getDirectPartnerId(record) {
  return normalizeTrimmedString(record?.partnerId);
}

function isRecordForPartner(record, partnerId) {
  if (!record || !partnerId) return false;
  const directPartnerId = getDirectPartnerId(record);
  if (directPartnerId) return directPartnerId === partnerId;
  if (getRecordPartnerId(record) === partnerId) return true;
  if (record.assignedPartnerId === partnerId) return true;
  if (record.regId) {
    const reg = (db.registrations || []).find(item => item.id === record.regId);
    if (reg && isRecordForPartner(reg, partnerId)) return true;
  }
  if (Array.isArray(record.oppIds)) {
    return record.oppIds.some(oppId => {
      const opp = (db.opportunities || []).find(item => item.id === oppId);
      return opp && isRecordForPartner(opp, partnerId);
    });
  }
  if (record.oppId) {
    const opp = (db.opportunities || []).find(item => item.id === record.oppId);
    if (opp && isRecordForPartner(opp, partnerId)) return true;
  }
  return false;
}

function getPartnerBusinessRecords(partnerId) {
  const registrations = (db.registrations || []).filter(item => isRecordForPartner(item, partnerId));
  const opportunities = (db.opportunities || []).filter(item => isRecordForPartner(item, partnerId));
  const quotes = (db.quotes || []).filter(item => isRecordForPartner(item, partnerId));
  const orders = (db.orders || []).filter(item => isRecordForPartner(item, partnerId));
  return { registrations, opportunities, quotes, orders };
}

function calcPercent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function buildPartnerBusinessSummary(partnerId) {
  const records = getPartnerBusinessRecords(partnerId);
  const customerCount = records.registrations.length;
  const opportunityCount = records.opportunities.length;
  const quoteCount = records.quotes.length;
  const orderCount = records.orders.length;
  const opportunityAmount = records.opportunities.reduce((sum, item) => sum + normalizePositiveNumber(item.amount || item.total || item.totalAmount), 0);
  const orderAmount = records.orders.reduce((sum, item) => sum + normalizePositiveNumber(item.amount || item.total || item.totalAmount), 0);
  return {
    customerReportCount: customerCount,
    opportunityReportCount: opportunityCount,
    quoteCount,
    orderCount,
    opportunityAmount,
    orderAmount,
    customerToOpportunityRate: calcPercent(opportunityCount, customerCount),
    opportunityToQuoteRate: calcPercent(quoteCount, opportunityCount),
    quoteToOrderRate: calcPercent(orderCount, quoteCount),
    fullConversionRate: calcPercent(orderCount, customerCount)
  };
}

function buildPartnerProfileIndustries(profile, records) {
  const source = [
    ...normalizeStringList(profile.customerIndustries),
    ...records.registrations.map(getRecordIndustry),
    ...records.opportunities.map(getRecordIndustry),
    ...records.quotes.map(getRecordIndustry),
    ...records.orders.map(getRecordIndustry)
  ];
  const industries = Array.from(new Set(source.map(item => normalizeTrimmedString(item)).filter(Boolean)));
  return industries.length ? industries.slice(0, 8) : PARTNER_PROFILE_DEFAULT_INDUSTRIES;
}

function normalizeMatrixLevel(value) {
  const level = normalizeTrimmedString(value);
  return PARTNER_PROFILE_LEVELS.includes(level) ? level : 'pending';
}

function buildPartnerProfileMatrix(profile, industries, products) {
  const matrix = profile.matrix && typeof profile.matrix === 'object' ? profile.matrix : {};
  return industries.map(industry => ({
    industry,
    cells: products.map(product => ({
      productId: product.id,
      productName: product.name,
      level: normalizeMatrixLevel(matrix?.[industry]?.[product.id])
    }))
  }));
}

function buildPartnerProfilePayload(partner, operator) {
  ensurePartnerProfileData();
  const profile = getPartnerProfile(partner.id, false);
  const records = getPartnerBusinessRecords(partner.id);
  const products = (db.partnerProfileProducts || [])
    .filter(item => item.status !== 'inactive')
    .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
    .map(item => ({
      ...item,
      moduleNames: getPartnerProfileProductModuleNames(item)
    }));
  const industries = buildPartnerProfileIndustries(profile, records);
  const sensitiveVisible = canViewSensitivePartnerProfile(operator, partner);
  const extended = buildPartnerProfileExtendedPayload(profile, sensitiveVisible);
  return {
    partner: {
      id: partner.id,
      name: partner.name,
      level: partner.level,
      region: partner.region,
      city: partner.city || '',
      status: partner.status,
      contact: partner.contact || '',
      phone: sensitiveVisible ? (partner.phone || '') : maskPhoneNumber(partner.phone),
      joinDate: partner.joinDate || '',
      staffCount: Array.isArray(partner.staff) ? partner.staff.length : 0
    },
    profile: {
      ...profile,
      ...Object.keys(PARTNER_PROFILE_EXTENSION_DEFAULTS).reduce((result, field) => {
        result[field] = extended[field];
        return result;
      }, {}),
      serviceRegions: extended.serviceRegions,
      majorAgencyBrands: extended.majorAgencyBrands,
      authorizedProductLines: extended.authorizedProductLines,
      certifications: extended.certifications,
      extended,
      bossName: profile.bossName || partner.contact || '',
      bossPhone: sensitiveVisible ? (profile.bossPhone || partner.phone || '') : maskPhoneNumber(profile.bossPhone || partner.phone),
      establishedAt: profile.establishedAt || partner.joinDate || '',
      employeeCount: profile.employeeCount || (Array.isArray(partner.staff) ? partner.staff.length : ''),
      annualRevenue: extended.annualRevenue,
      invoiceCapability: profile.invoiceCapability || '',
      customerIndustries: normalizeStringList(profile.customerIndustries).length ? normalizeStringList(profile.customerIndustries) : industries,
      agencyBrands: normalizeStringList(profile.agencyBrands),
      qualifications: normalizeStringList(profile.qualifications),
      authorizedProducts: normalizeStringList(profile.authorizedProducts),
      typicalCustomers: normalizeStringList(profile.typicalCustomers),
      serviceAreas: normalizeStringList(profile.serviceAreas).length ? normalizeStringList(profile.serviceAreas) : normalizeStringList([partner.city, partner.region])
    },
    summary: buildPartnerBusinessSummary(partner.id),
    matrixProducts: products,
    matrixRows: buildPartnerProfileMatrix(profile, industries, products),
    permissions: {
      canEditProfile: canManagePartnerProfile(operator, partner),
      canManageProducts: canMaintainPartnerProfileSettings(operator),
      canViewSensitive: sensitiveVisible
    }
  };
}

function getScopedPartners({ userRole, region, partnerId }) {
  let partners = Array.isArray(db.partners) ? db.partners.slice() : [];
  partners = partners.filter(p => p && p.status === 'active');
  if (userRole === 'admin' && region) {
    partners = partners.filter(p => p.region === region);
  }
  if (partnerId) {
    partners = partners.filter(p => p.id === partnerId);
  }
  return partners;
}

function filterChannelTargetsByScope(list, { userRole, region, partnerId, year }) {
  let items = Array.isArray(list) ? list.slice() : [];
  if (year) items = items.filter(item => Number(item.year) === Number(year));
  if (userRole === 'admin' && region) items = items.filter(item => item.region === region);
  if (partnerId) items = items.filter(item => item.partnerId === partnerId);
  return items;
}

function filterChannelVisitsByScope(list, { userRole, region, partnerId, year }) {
  let items = Array.isArray(list) ? list.slice() : [];
  if (year) {
    items = items.filter(item => normalizeChannelYear(item.year || item.visitDate) === Number(year));
  }
  if (userRole === 'admin' && region) items = items.filter(item => item.region === region);
  if (partnerId) items = items.filter(item => item.partnerId === partnerId);
  return items;
}

function buildChannelOperationsOverview({ year, userRole, region, partnerId }) {
  ensureChannelOperationsData();

  const targetYear = normalizeChannelYear(year);
  const partners = getScopedPartners({ userRole, region, partnerId });
  const partnerIds = new Set(partners.map(item => item.id));
  const registrations = Array.isArray(db.registrations) ? db.registrations.slice() : [];
  const opportunities = Array.isArray(db.opportunities) ? db.opportunities.slice() : [];
  const quotes = Array.isArray(db.quotes) ? db.quotes.slice() : [];
  const orders = Array.isArray(db.orders) ? db.orders.slice() : [];
  const targets = filterChannelTargetsByScope(db.channelTargets, { userRole, region, partnerId, year: targetYear });
  const visits = filterChannelVisitsByScope(db.channelVisits, { userRole, region, partnerId, year: targetYear });

  const registrationIdsByPartner = {};
  registrations.forEach(item => {
    const pid = item.partnerId || item.assignedPartnerId;
    if (!pid || !partnerIds.has(pid)) return;
    if (!registrationIdsByPartner[pid]) registrationIdsByPartner[pid] = new Set();
    registrationIdsByPartner[pid].add(item.id);
  });

  const targetMap = new Map();
  targets.forEach(item => {
    const key = `${item.region || ''}__${item.partnerId || 'region'}`;
    targetMap.set(key, item);
  });

  const partnerMetrics = partners.map(partner => {
    const partnerRegIds = registrationIdsByPartner[partner.id] || new Set();
    const partnerOpportunities = opportunities.filter(item =>
      item.partnerId === partner.id ||
      item.assignedPartnerId === partner.id ||
      (item.regId && partnerRegIds.has(item.regId))
    );
    const partnerQuotes = quotes.filter(item =>
      item.partnerId === partner.id || item.assignedPartnerId === partner.id
    );
    const partnerOrders = orders.filter(item =>
      item.partnerId === partner.id || item.assignedPartnerId === partner.id
    );
    const partnerVisits = visits.filter(item => item.partnerId === partner.id);
    const target = targetMap.get(`${partner.region || ''}__${partner.id}`) || null;

    const opportunityAmount = partnerOpportunities.reduce((sum, item) => sum + normalizePositiveNumber(item.amount), 0);
    const quoteAmount = partnerQuotes.reduce((sum, item) => sum + normalizePositiveNumber(item.amount || item.totalAmount), 0);
    const orderAmount = partnerOrders.reduce((sum, item) => sum + normalizePositiveNumber(item.amount || item.totalAmount), 0);
    const visitCount = partnerVisits.length;
    const revenueTarget = normalizePositiveNumber(target?.revenueTarget);
    const opportunityTarget = normalizePositiveNumber(target?.opportunityTarget);
    const visitTarget = normalizePositiveNumber(target?.visitTarget);
    const revenueCompletionRate = calcRate(orderAmount, revenueTarget);
    const opportunityCompletionRate = calcRate(partnerOpportunities.length, opportunityTarget);
    const visitCompletionRate = calcRate(visitCount, visitTarget);
    const conversionRate = partnerQuotes.length ? Math.round((partnerOrders.length / partnerQuotes.length) * 100) : 0;
    const healthScore = Math.round(
      revenueCompletionRate * 0.4 +
      opportunityCompletionRate * 0.2 +
      visitCompletionRate * 0.2 +
      Math.min(conversionRate, 100) * 0.1 +
      Math.min(visitCount * 10, 100) * 0.1
    );

    const sortedVisits = partnerVisits.slice().sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)));
    const lastVisit = sortedVisits[0] || null;

    return {
      partnerId: partner.id,
      partnerName: partner.name,
      region: partner.region || '',
      level: partner.level || '',
      techServiceType: partner.techServiceType || 'none',
      staffCount: Array.isArray(partner.staff) ? partner.staff.length : 0,
      registrationCount: partnerRegIds.size,
      opportunityCount: partnerOpportunities.length,
      opportunityAmount,
      quoteCount: partnerQuotes.length,
      quoteAmount,
      orderCount: partnerOrders.length,
      orderAmount,
      visitCount,
      lastVisitDate: lastVisit ? lastVisit.visitDate : '',
      visitStatus: lastVisit ? (lastVisit.status || '') : '',
      revenueTarget,
      opportunityTarget,
      visitTarget,
      revenueCompletionRate,
      opportunityCompletionRate,
      visitCompletionRate,
      conversionRate,
      healthScore
    };
  });

  const regionTarget = targets.find(item => !item.partnerId) || null;
  const summary = partnerMetrics.reduce((acc, item) => {
    acc.partnerCount += 1;
    acc.registrationCount += item.registrationCount;
    acc.opportunityCount += item.opportunityCount;
    acc.opportunityAmount += item.opportunityAmount;
    acc.quoteCount += item.quoteCount;
    acc.quoteAmount += item.quoteAmount;
    acc.orderCount += item.orderCount;
    acc.orderAmount += item.orderAmount;
    acc.visitCount += item.visitCount;
    acc.revenueTarget += item.revenueTarget;
    acc.opportunityTarget += item.opportunityTarget;
    acc.visitTarget += item.visitTarget;
    return acc;
  }, {
    partnerCount: 0,
    registrationCount: 0,
    opportunityCount: 0,
    opportunityAmount: 0,
    quoteCount: 0,
    quoteAmount: 0,
    orderCount: 0,
    orderAmount: 0,
    visitCount: 0,
    revenueTarget: normalizePositiveNumber(regionTarget?.revenueTarget),
    opportunityTarget: normalizePositiveNumber(regionTarget?.opportunityTarget),
    visitTarget: normalizePositiveNumber(regionTarget?.visitTarget)
  });

  summary.revenueCompletionRate = calcRate(summary.orderAmount, summary.revenueTarget);
  summary.opportunityCompletionRate = calcRate(summary.opportunityCount, summary.opportunityTarget);
  summary.visitCompletionRate = calcRate(summary.visitCount, summary.visitTarget);

  const visitCoverage = partners.map(partner => {
    const metric = partnerMetrics.find(item => item.partnerId === partner.id);
    return {
      partnerId: partner.id,
      partnerName: partner.name,
      region: partner.region || '',
      visitCount: metric ? metric.visitCount : 0,
      lastVisitDate: metric ? metric.lastVisitDate : '',
      healthScore: metric ? metric.healthScore : 0
    };
  }).sort((a, b) => b.visitCount - a.visitCount || String(b.lastVisitDate).localeCompare(String(a.lastVisitDate)));

  const partnerRanking = partnerMetrics
    .slice()
    .sort((a, b) => b.healthScore - a.healthScore || b.orderAmount - a.orderAmount)
    .slice(0, 8);

  const recentVisits = visits
    .slice()
    .sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, 12);

  return {
    year: targetYear,
    summary,
    regionTarget,
    partnerTargets: targets.filter(item => item.partnerId),
    recentVisits,
    visitCoverage,
    partnerRanking,
    partnerMetrics
  };
}

app.get('/api/channel-operations/overview', (req, res) => {
  try {
    const data = buildChannelOperationsOverview({
      year: req.query.year,
      userRole: req.query.userRole,
      region: req.query.region,
      partnerId: req.query.partnerId
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'channel operations overview failed' });
  }
});

app.get('/api/channel-targets', (req, res) => {
  ensureChannelOperationsData();
  const year = req.query.year ? normalizeChannelYear(req.query.year) : null;
  const data = filterChannelTargetsByScope(db.channelTargets, {
    userRole: req.query.userRole,
    region: req.query.region,
    partnerId: req.query.partnerId,
    year
  }).sort((a, b) => {
    if ((a.partnerId || '') === (b.partnerId || '')) return String(a.region || '').localeCompare(String(b.region || ''));
    if (!a.partnerId) return -1;
    if (!b.partnerId) return 1;
    return String(a.partnerName || '').localeCompare(String(b.partnerName || ''));
  });
  res.json({ success: true, data });
});

app.post('/api/channel-targets', (req, res) => {
  ensureChannelOperationsData();
  const payload = req.body || {};
  const userRole = payload.operatedByRole || payload.userRole;
  const operatedRegion = payload.operatedByRegion || payload.userRegion || '';
  const targetYear = normalizeChannelYear(payload.year);
  const region = String(payload.region || '').trim();
  const partnerId = payload.partnerId ? String(payload.partnerId).trim() : '';

  if (!region) {
    return res.status(400).json({ success: false, error: 'region is required' });
  }
  if (userRole === 'admin' && operatedRegion && region !== operatedRegion) {
    return res.status(403).json({ success: false, error: 'admin can only maintain own region targets' });
  }

  let partnerName = '';
  if (partnerId) {
    const partner = db.partners.find(item => item.id === partnerId);
    if (!partner) return res.status(400).json({ success: false, error: 'partner not found' });
    if (partner.region !== region) return res.status(400).json({ success: false, error: 'partner region mismatch' });
    partnerName = partner.name;
  }

  const exists = db.channelTargets.find(item =>
    Number(item.year) === targetYear &&
    String(item.region || '') === region &&
    String(item.partnerId || '') === partnerId
  );
  if (exists) {
    return res.status(409).json({ success: false, error: 'target already exists' });
  }

  const target = {
    id: `CT-${Date.now()}`,
    year: targetYear,
    region,
    partnerId: partnerId || '',
    partnerName,
    revenueTarget: normalizePositiveNumber(payload.revenueTarget),
    opportunityTarget: normalizePositiveNumber(payload.opportunityTarget),
    visitTarget: normalizePositiveNumber(payload.visitTarget),
    remark: String(payload.remark || '').trim(),
    createdBy: payload.operatedBy || '',
    createdByRole: userRole || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.channelTargets.push(target);
  saveData();
  res.json({ success: true, data: target });
});

app.put('/api/channel-targets/:id', (req, res) => {
  ensureChannelOperationsData();
  const target = db.channelTargets.find(item => item.id === req.params.id);
  if (!target) return res.status(404).json({ success: false, error: 'target not found' });

  const payload = req.body || {};
  const userRole = payload.operatedByRole || payload.userRole;
  const operatedRegion = payload.operatedByRegion || payload.userRegion || '';
  if (userRole === 'admin' && operatedRegion && target.region !== operatedRegion) {
    return res.status(403).json({ success: false, error: 'admin can only maintain own region targets' });
  }

  target.revenueTarget = normalizePositiveNumber(payload.revenueTarget !== undefined ? payload.revenueTarget : target.revenueTarget);
  target.opportunityTarget = normalizePositiveNumber(payload.opportunityTarget !== undefined ? payload.opportunityTarget : target.opportunityTarget);
  target.visitTarget = normalizePositiveNumber(payload.visitTarget !== undefined ? payload.visitTarget : target.visitTarget);
  target.remark = payload.remark !== undefined ? String(payload.remark || '').trim() : target.remark;
  target.updatedAt = new Date().toISOString();
  target.updatedBy = payload.operatedBy || '';
  saveData();
  res.json({ success: true, data: target });
});

app.get('/api/channel-visits', (req, res) => {
  ensureChannelOperationsData();
  const year = req.query.year ? normalizeChannelYear(req.query.year) : null;
  const data = filterChannelVisitsByScope(db.channelVisits, {
    userRole: req.query.userRole,
    region: req.query.region,
    partnerId: req.query.partnerId,
    year
  }).sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)));
  res.json({ success: true, data });
});

app.post('/api/channel-visits', (req, res) => {
  ensureChannelOperationsData();
  const payload = req.body || {};
  const userRole = payload.operatedByRole || payload.userRole;
  const operatedRegion = payload.operatedByRegion || payload.userRegion || '';
  const partnerId = String(payload.partnerId || '').trim();
  if (!partnerId) return res.status(400).json({ success: false, error: 'partnerId is required' });

  const partner = db.partners.find(item => item.id === partnerId);
  if (!partner) return res.status(400).json({ success: false, error: 'partner not found' });
  if (userRole === 'admin' && operatedRegion && partner.region !== operatedRegion) {
    return res.status(403).json({ success: false, error: 'admin can only maintain own region visits' });
  }

  const visitDate = normalizeDateString(payload.visitDate);
  const visit = {
    id: `CV-${Date.now()}`,
    year: normalizeChannelYear(payload.year || visitDate),
    visitDate,
    region: partner.region || payload.region || '',
    partnerId: partner.id,
    partnerName: partner.name,
    type: String(payload.type || 'onsite').trim(),
    status: String(payload.status || 'planned').trim(),
    theme: String(payload.theme || '').trim(),
    summary: String(payload.summary || '').trim(),
    nextAction: String(payload.nextAction || '').trim(),
    attendees: String(payload.attendees || '').trim(),
    owner: String(payload.owner || payload.operatedByName || '').trim(),
    createdBy: payload.operatedBy || '',
    createdByRole: userRole || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.channelVisits.push(visit);
  saveData();
  res.json({ success: true, data: visit });
});

app.put('/api/channel-visits/:id', (req, res) => {
  ensureChannelOperationsData();
  const visit = db.channelVisits.find(item => item.id === req.params.id);
  if (!visit) return res.status(404).json({ success: false, error: 'visit not found' });

  const payload = req.body || {};
  const userRole = payload.operatedByRole || payload.userRole;
  const operatedRegion = payload.operatedByRegion || payload.userRegion || '';
  if (userRole === 'admin' && operatedRegion && visit.region !== operatedRegion) {
    return res.status(403).json({ success: false, error: 'admin can only maintain own region visits' });
  }

  visit.visitDate = payload.visitDate ? normalizeDateString(payload.visitDate) : visit.visitDate;
  visit.year = normalizeChannelYear(payload.year || visit.visitDate);
  visit.type = payload.type !== undefined ? String(payload.type || '').trim() : visit.type;
  visit.status = payload.status !== undefined ? String(payload.status || '').trim() : visit.status;
  visit.theme = payload.theme !== undefined ? String(payload.theme || '').trim() : visit.theme;
  visit.summary = payload.summary !== undefined ? String(payload.summary || '').trim() : visit.summary;
  visit.nextAction = payload.nextAction !== undefined ? String(payload.nextAction || '').trim() : visit.nextAction;
  visit.attendees = payload.attendees !== undefined ? String(payload.attendees || '').trim() : visit.attendees;
  visit.owner = payload.owner !== undefined ? String(payload.owner || '').trim() : visit.owner;
  visit.updatedAt = new Date().toISOString();
  visit.updatedBy = payload.operatedBy || '';
  saveData();
  res.json({ success: true, data: visit });
});

app.post('/api/admin/accounts', (req, res) => {
  const { username, name, role, password, region, bigRegion, status, remark, avatar, createdBy, createdByRole, operatedByRole } = req.body;
  const operatorRole = operatedByRole || createdByRole || '';
  const targetRole = role || 'admin';
  
  if (!username || !name) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  if (operatorRole !== 'superadmin') {
    return res.status(403).json({ success: false, message: '仅超级管理员可创建管理员账号' });
  }

  if (targetRole !== 'admin' && targetRole !== 'superadmin') {
    return res.status(400).json({ success: false, message: '仅支持创建超级管理员或区域管理员账号' });
  }

  if (targetRole === 'admin' && (!region || !bigRegion)) {
    return res.status(400).json({ success: false, message: '区域管理员必须指定大区和区域' });
  }
  
  // 检查账号是否已存在
  if (db.users.find(u => u.username === username)) {
    return res.status(400).json({ success: false, message: '用户名已存在' });
  }
  
  // 生成唯一ID
  const existingIds = db.users.filter(u => u.id.startsWith('A')).map(u => parseInt(u.id.slice(1)) || 0);
  const maxId = Math.max(0, ...existingIds);
  const newId = 'A' + String(maxId + 1).padStart(3, '0');
  
  const newUser = {
    id: newId,
    username,
    name,
    role: targetRole,
    password: password || '123456',
    region: targetRole === 'superadmin' ? '' : (region || ''),
    bigRegion: targetRole === 'superadmin' ? '' : (bigRegion || ''),
    status: status || 'active',
    remark: remark || '',
    avatar: avatar || name.slice(0, 1),
    createdBy: createdBy || '',
    createdByRole: operatorRole,
    createdAt: new Date().toISOString()
  };
  
  db.users.push(newUser);
  saveData();
  
  const { password: _, ...userInfo } = newUser;
  res.json({ success: true, message: '创建成功', data: userInfo });
});

// 创建员工账号（添加用户）
app.post('/api/users', (req, res) => {
  const { username, name, role, password, partnerId, partnerName, region, bigRegion, status, phone, email, createdBy, createdByRole, staffRole } = req.body;
  
  if (!username || !name || !password) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  // 检查账号是否已存在
  if (db.users.find(u => u.username === username)) {
    return res.status(409).json({ error: '账号已存在' });
  }
  
  // 根据创建者角色决定状态
  // 超级管理员创建：直接生效
  // 区域管理员创建：待审批（员工和企业管理员都需要审批）
  const userRole = role || 'staff';
  const isPendingApproval = userRole === 'staff' || userRole === 'partner_admin';
  const newStatus = (createdByRole === 'superadmin') ? 'active' : 'pending';
  
  // 根据角色生成ID前缀
  let idPrefix = 'S';
  if (userRole === 'admin' || userRole === 'superadmin') idPrefix = 'A';
  else if (userRole === 'partner_admin') idPrefix = 'PA';
  
  // 生成唯一ID，同时保留历史员工记录已占用的编号，避免再次复用孤儿引用。
  const reservedIds = [
    ...(db.users || []).map(user => user.id),
    ...(db.partners || []).flatMap(partner => (partner.staff || []).map(staff => staff.userId))
  ];
  const existingIds = reservedIds
    .map(value => String(value || ''))
    .filter(value => value.startsWith(idPrefix))
    .map(value => Number.parseInt(value.slice(idPrefix.length), 10))
    .filter(Number.isFinite);
  const maxId = Math.max(0, ...existingIds);
  const newId = idPrefix + String(maxId + 1).padStart(3, '0');
  
  const newUser = {
    id: newId,
    username,
    name,
    role: userRole,
    password,
    partnerId,
    partnerName,
    region,
    bigRegion,
    status: newStatus,
    createdBy,
    createdByRole
  };
  
  db.users.push(newUser);
  
  // 如果是渠道员工或企业管理员，同时添加到对应渠道商的 staff 数组
  let staffRecord = null;
  if ((userRole === 'staff' || userRole === 'partner_admin') && partnerId) {
    const partner = db.partners.find(p => p.id === partnerId);
    if (partner) {
      if (!partner.staff) partner.staff = [];
      
      // 生成员工在渠道商内的ID
      const prefix = partnerId.replace('P', 'S') + '-';
      const seq = String(partner.staff.length + 1).padStart(2, '0');
      
      staffRecord = {
        id: prefix + seq,
        userId: newId,
        username,
        name,
        role: userRole === 'partner_admin' ? 'partner_admin' : (staffRole || '销售代表'),
        phone: phone || '',
        email: email || '',
        status: newStatus,
        createdBy,
        createdByRole,
        createdAt: new Date().toISOString()
      };
      
      partner.staff.push(staffRecord);
    }
  }
  
  // 如果是区域管理员创建的员工/企业管理员，添加到待审批列表
  if (newStatus === 'pending' && isPendingApproval) {
    db.pendingApprovals.push({
      id: 'APR-' + Date.now(),
      type: userRole === 'partner_admin' ? 'partner_admin' : 'staff',
      targetId: newId,
      targetName: name,
      targetPartnerId: partnerId,
      targetPartnerName: partnerName,
      createdBy,
      createdByRole,
      region,
      bigRegion: bigRegion || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  }
  
  saveData();
  
  const { password: _, ...userInfo } = newUser;
  res.json({ 
    success: true, 
    data: userInfo,
    message: newStatus === 'pending' ? '员工账号创建成功，等待超级管理员审批' : '员工账号创建成功'
  });
});

// ========== 渠道商管理接口 ==========

function validatePartnerCity(city) {
  const normalizedCity = normalizePrefectureCity(city);
  if (!normalizedCity) {
    return { valid: false, city: '', error: '所在城市为必填项' };
  }
  if (!isPrefectureLevelCity(normalizedCity)) {
    return { valid: false, city: normalizedCity, error: '所在城市必须选择地市级行政区' };
  }
  return { valid: true, city: normalizedCity, error: '' };
}

// 技术服务类型同步函数（兼容旧数据）
function syncTechServiceType(partner) {
  if (partner.techServiceType) {
    partner.isTechService = partner.techServiceType === 'full';
  } else if (partner.isTechService) {
    partner.techServiceType = 'full';
  } else {
    partner.techServiceType = 'none';
  }
  return partner;
}

app.get('/api/meta/prefecture-cities', (req, res) => {
  res.json({ success: true, data: PREFECTURE_LEVEL_CITIES });
});

// 获取渠道商列表
app.get('/api/partners', (req, res) => {
  const { userId, userRole, region, bigRegion, status, partnerId } = req.query;
  let list = db.partners;
  
  // 超级管理员：看全部（包括待审批和已生效）
  // 区域管理员：看本区域的已生效渠道商 + 自己创建的待审批渠道商
  // 渠道员工：看自己所属渠道商
  
  if (userRole === 'admin' && region) {
    // 区域管理员：看本区域已生效的 + 自己创建的待审批
    list = list.filter(p => {
      if (p.status === 'active' && p.region === region) return true;
      if (p.status === 'pending' && p.createdBy === userId) return true;
      return false;
    });
  } else if (userRole === 'staff' && userId) {
    // 渠道员工：需要找到对应的 partner
    const user = db.users.find(u => u.id === userId);
    if (user && user.partnerId) {
      list = list.filter(p => p.id === user.partnerId);
    }
  } else if (partnerId) {
    // 【新增】按 partnerId 过滤：返回该渠道商 + 其下属二级渠道商（一级渠道商需要看下属，支持多个上级渠道商）
    list = list.filter(p => p.id === partnerId || 
                          p.parentPartnerId === partnerId ||
                          (p.parentPartnerIds && p.parentPartnerIds.includes(partnerId)));
  }
  // superadmin 不过滤，看全部
  
  // 按状态筛选
  if (status) {
    list = list.filter(p => p.status === status);
  }
  
  res.json({ success: true, data: list.sort((a, b) => new Date(b.joinDate) - new Date(a.joinDate)).map(p => {
    // 同步 user 信息到 staff（处理旧数据缺少 phone/status 等字段的情况）
    syncPartnerStaffListUserInfo(p);
    // 同步 techServiceType 与 isTechService（兼容旧数据）
    syncTechServiceType(p);
    if (p.city === undefined || p.city === null) p.city = '';
    return p;
  }) });
});

// 创建渠道商
app.post('/api/partners', (req, res) => {
  const { name, level, region, city, bigRegion, contact, phone, email, techServiceType, createdBy, createdByRole, partnerLevel, parentPartnerId, parentPartnerIds } = req.body;
  
  if (!name || !region) {
    return res.status(400).json({ success: false, error: '缺少必要参数' });
  }
  if (!level) {
    return res.status(400).json({ success: false, error: '合作级别为必填项' });
  }
  const cityValidation = validatePartnerCity(city);
  if (!cityValidation.valid) {
    return res.status(400).json({ success: false, error: cityValidation.error });
  }
  
  // 生成渠道商ID
  const existingIds = db.partners.map(p => parseInt(p.id.replace('P', '')) || 0);
  const maxId = Math.max(0, ...existingIds);
  const newId = 'P' + String(maxId + 1).padStart(3, '0');
  
  // 根据创建者角色决定状态
  // 超级管理员创建：直接生效
  // 区域管理员创建：待审批
  const status = createdByRole === 'superadmin' ? 'active' : 'pending';
  
  // 确定渠道分销层级和上级渠道商关系（支持多个上级渠道商）
  const finalPartnerLevel = partnerLevel || 'none';
  // 确定上级渠道商ID列表（兼容旧参数）
  let finalParentPartnerIds = [];
  if (parentPartnerIds && Array.isArray(parentPartnerIds)) {
    finalParentPartnerIds = parentPartnerIds;
  } else if (parentPartnerId && parentPartnerId !== null && parentPartnerId !== '') {
    finalParentPartnerIds = [parentPartnerId];
  }
  
  // 二级渠道商必须绑定至少一个一级渠道商
  if (finalPartnerLevel === 'secondary') {
    if (finalParentPartnerIds.length === 0) {
      return res.status(400).json({ success: false, error: '二级渠道商必须指定至少一个一级渠道商' });
    }
    
    // 验证每个上级渠道商是否存在且为一级渠道商
    for (const pid of finalParentPartnerIds) {
      const parentPartner = db.partners.find(p => p.id === pid);
      if (!parentPartner) {
        return res.status(400).json({ success: false, error: `一级渠道商 ${pid} 不存在` });
      }
      if (parentPartner.partnerLevel !== 'primary') {
        return res.status(400).json({ success: false, error: `指定的渠道商 ${pid} 不是一级渠道商` });
      }
      // 二级渠道商必须与一级渠道商同区域
      if (region !== parentPartner.region) {
        return res.status(400).json({ success: false, error: `二级渠道商必须与一级渠道商 ${pid} 同区域` });
      }
    }
  }
  
  const newPartner = {
    id: newId,
    name,
    level,
    partnerLevel: finalPartnerLevel,
    region,
    city: cityValidation.city,
    bigRegion: bigRegion || '',
    contact: contact || '',
    phone: phone || '',
    email: email || '',
    isTechService: techServiceType === 'full',
    techServiceType: techServiceType || 'none',
    status,
    joinDate: new Date().toISOString().split('T')[0],
    quoteCount: 0,
    orderCount: 0,
    totalAmt: 0,
    staff: [],
    createdBy,
    createdByRole,
    parentPartnerId: finalParentPartnerIds.length > 0 ? finalParentPartnerIds[0] : null,
    parentPartnerIds: finalParentPartnerIds,
    partnerLevelSetBy: null,
    partnerLevelSetAt: null
  };
  
  db.partners.push(newPartner);

  const profileInput = isPlainObjectValue(req.body?.profile) ? req.body.profile : null;
  let newPartnerProfile = null;
  if (hasPartnerProfileInput(profileInput)) {
    newPartnerProfile = getPartnerProfile(newPartner.id);
    applyPartnerProfileBasicUpdates(newPartnerProfile, profileInput);
    const verifiedInput = getPartnerProfileInputValue(profileInput, 'verified');
    if (verifiedInput !== undefined) {
      newPartnerProfile.verified = verifiedInput === true || verifiedInput === 'true';
    }
    newPartnerProfile.updatedBy = createdBy || '';
    newPartnerProfile.updatedByName = '';
    newPartnerProfile.updatedAt = new Date().toISOString();
  }
  
  // 如果是区域管理员创建的，添加到待审批列表
  if (status === 'pending') {
    db.pendingApprovals.push({
      id: 'APR-' + Date.now(),
      type: 'partner',
      targetId: newId,
      targetName: name,
      createdBy,
      createdByRole,
      region,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  }
  
  saveData();
  writeAuditLog(req, {
    module: 'partner',
    action: 'create',
    targetType: 'partner',
    targetId: newPartner.id,
    targetName: newPartner.name || newPartner.id,
    result: 'success',
    message: '创建渠道商',
    after: newPartner,
    extra: {
      status: newPartner.status,
      partnerLevel: newPartner.partnerLevel || 'none',
      parentPartnerIds: cloneAuditValue(newPartner.parentPartnerIds || []),
      createdBy: newPartner.createdBy || '',
      createdByRole: newPartner.createdByRole || '',
      profileInitialized: Boolean(newPartnerProfile)
    }
  });
  
  res.json({ 
    success: true, 
    data: newPartner,
    message: status === 'pending' ? '渠道商创建成功，等待超级管理员审批' : '渠道商创建成功'
  });
});

// 获取矩阵产品列配置
app.get('/api/partner-profile-products', (req, res) => {
  if (ensurePartnerProfileData()) saveData();
  const products = (db.partnerProfileProducts || [])
    .slice()
    .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
    .map(item => ({
      ...item,
      moduleNames: getPartnerProfileProductModuleNames(item)
    }));
  const modules = (db.modules || [])
    .filter(item => item.status !== 'inactive')
    .map(item => ({ id: item.id, name: item.name, categoryId: item.categoryId, status: item.status }));
  res.json({ success: true, data: { products, modules } });
});

// 新增矩阵产品列配置（仅超管或区管）
app.post('/api/partner-profile-products', (req, res) => {
  ensurePartnerProfileData();
  const operator = getAuthenticatedOperator(req);
  if (!operator) {
    return res.status(401).json({ success: false, error: '请先登录后再维护矩阵产品列' });
  }
  if (!canMaintainPartnerProfileSettings(operator)) {
    return res.status(403).json({ success: false, error: '仅超级管理员或区域管理员可维护矩阵产品列' });
  }

  const name = normalizeTrimmedString(req.body?.name);
  const moduleIds = normalizeStringList(req.body?.moduleIds);
  const status = normalizeTrimmedString(req.body?.status || 'active');
  if (!name) {
    return res.status(400).json({ success: false, error: '产品名称为必填项' });
  }
  if (status === 'active' && moduleIds.length === 0) {
    return res.status(400).json({ success: false, error: '启用的矩阵产品必须绑定至少一个关联模块' });
  }

  const code = normalizeTrimmedString(req.body?.code) || `profile-product-${Date.now()}`;
  const duplicated = db.partnerProfileProducts.find(item => item.code === code);
  if (duplicated) {
    return res.status(400).json({ success: false, error: '产品编码已存在' });
  }

  const product = {
    id: req.body?.id || `PPP-${Date.now()}`,
    name,
    code,
    productLine: normalizeTrimmedString(req.body?.productLine),
    moduleIds,
    status: status || 'active',
    sort: Number(req.body?.sort) || db.partnerProfileProducts.length * 10 + 10,
    maintainedBy: operator.id,
    maintainedByName: operator.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.partnerProfileProducts.push(product);
  saveData();
  res.json({ success: true, data: { ...product, moduleNames: getPartnerProfileProductModuleNames(product) } });
});

// 更新矩阵产品列配置（仅超管或区管）
app.put('/api/partner-profile-products/:id', (req, res) => {
  ensurePartnerProfileData();
  const operator = getAuthenticatedOperator(req);
  if (!operator) {
    return res.status(401).json({ success: false, error: '请先登录后再维护矩阵产品列' });
  }
  if (!canMaintainPartnerProfileSettings(operator)) {
    return res.status(403).json({ success: false, error: '仅超级管理员或区域管理员可维护矩阵产品列' });
  }

  const product = db.partnerProfileProducts.find(item => item.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: '矩阵产品不存在' });
  }

  const updates = req.body && typeof req.body === 'object' ? { ...req.body } : {};
  stripAuditOperatorFields(updates);
  const nextName = updates.name !== undefined ? normalizeTrimmedString(updates.name) : product.name;
  const nextCode = updates.code !== undefined ? normalizeTrimmedString(updates.code) : product.code;
  const nextModuleIds = updates.moduleIds !== undefined ? normalizeStringList(updates.moduleIds) : normalizeStringList(product.moduleIds);
  const nextStatus = updates.status !== undefined ? normalizeTrimmedString(updates.status) : product.status;

  if (!nextName) {
    return res.status(400).json({ success: false, error: '产品名称为必填项' });
  }
  if (!nextCode) {
    return res.status(400).json({ success: false, error: '产品编码为必填项' });
  }
  if (nextStatus === 'active' && nextModuleIds.length === 0) {
    return res.status(400).json({ success: false, error: '启用的矩阵产品必须绑定至少一个关联模块' });
  }
  const duplicated = db.partnerProfileProducts.find(item => item.id !== product.id && item.code === nextCode);
  if (duplicated) {
    return res.status(400).json({ success: false, error: '产品编码已存在' });
  }

  Object.assign(product, {
    name: nextName,
    code: nextCode,
    productLine: updates.productLine !== undefined ? normalizeTrimmedString(updates.productLine) : product.productLine,
    moduleIds: nextModuleIds,
    status: nextStatus || 'active',
    sort: updates.sort !== undefined ? Number(updates.sort) || 0 : product.sort,
    maintainedBy: operator.id,
    maintainedByName: operator.name,
    updatedAt: new Date().toISOString()
  });
  saveData();
  res.json({ success: true, data: { ...product, moduleNames: getPartnerProfileProductModuleNames(product) } });
});

// 删除矩阵产品列配置；有历史矩阵数据时自动停用
app.delete('/api/partner-profile-products/:id', (req, res) => {
  ensurePartnerProfileData();
  const operator = getAuthenticatedOperator(req);
  if (!operator) {
    return res.status(401).json({ success: false, error: '请先登录后再维护矩阵产品列' });
  }
  if (!canMaintainPartnerProfileSettings(operator)) {
    return res.status(403).json({ success: false, error: '仅超级管理员或区域管理员可维护矩阵产品列' });
  }

  const idx = db.partnerProfileProducts.findIndex(item => item.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '矩阵产品不存在' });
  }

  const product = db.partnerProfileProducts[idx];
  const hasMatrixData = (db.partnerProfiles || []).some(profile =>
    Object.values(profile.matrix || {}).some(row => row && row[product.id])
  );

  if (hasMatrixData) {
    product.status = 'inactive';
    product.maintainedBy = operator.id;
    product.maintainedByName = operator.name;
    product.updatedAt = new Date().toISOString();
    product.deletedAt = new Date().toISOString();
    saveData();
    return res.json({ success: true, data: product, message: '该产品已有历史矩阵数据，已停用并保留历史记录' });
  }

  db.partnerProfileProducts.splice(idx, 1);
  saveData();
  res.json({ success: true, message: '矩阵产品已删除' });
});

// 获取渠道商信息简介、经营摘要和画像矩阵
app.get('/api/partners/:id/profile', (req, res) => {
  if (ensurePartnerProfileData()) saveData();
  const partner = db.partners.find(p => p.id === req.params.id);
  if (!partner) {
    return res.status(404).json({ success: false, error: '渠道商不存在' });
  }
  const operator = getAuthenticatedOperator(req);
  if (!operator) {
    return res.status(401).json({ success: false, error: '请先登录后再查看渠道商信息简介' });
  }
  if (!canViewPartnerProfile(operator, partner)) {
    return res.status(403).json({ success: false, error: '无权查看该渠道商信息简介' });
  }
  res.json({ success: true, data: buildPartnerProfilePayload(partner, operator) });
});

// 更新渠道商信息简介和画像矩阵
app.put('/api/partners/:id/profile', (req, res) => {
  ensurePartnerProfileData();
  const partner = db.partners.find(p => p.id === req.params.id);
  if (!partner) {
    return res.status(404).json({ success: false, error: '渠道商不存在' });
  }
  const operator = getAuthenticatedOperator(req);
  if (!operator) {
    return res.status(401).json({ success: false, error: '请先登录后再维护渠道商信息简介' });
  }
  if (!canManagePartnerProfile(operator, partner)) {
    return res.status(403).json({ success: false, error: '无权维护该渠道商信息简介' });
  }

  const profile = getPartnerProfile(partner.id);
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  applyPartnerProfileBasicUpdates(profile, body);

  const matrixInput = getPartnerProfileInputValue(body, 'matrix');
  if (isPlainObjectValue(matrixInput)) {
    const activeProducts = new Set((db.partnerProfileProducts || []).filter(item => item.status !== 'inactive').map(item => item.id));
    const nextMatrix = {};
    Object.entries(matrixInput).forEach(([industry, row]) => {
      const cleanIndustry = normalizeTrimmedString(industry);
      if (!cleanIndustry || !row || typeof row !== 'object') return;
      nextMatrix[cleanIndustry] = {};
      Object.entries(row).forEach(([productId, level]) => {
        if (!activeProducts.has(productId)) return;
        nextMatrix[cleanIndustry][productId] = normalizeMatrixLevel(level);
      });
    });
    profile.matrix = nextMatrix;
  }

  const verifiedInput = getPartnerProfileInputValue(body, 'verified');
  if (verifiedInput !== undefined) {
    profile.verified = verifiedInput === true || verifiedInput === 'true';
  }
  profile.updatedBy = operator.id;
  profile.updatedByName = operator.name;
  profile.updatedAt = new Date().toISOString();

  saveData();
  res.json({ success: true, data: buildPartnerProfilePayload(partner, operator) });
});

// 获取单个渠道商详情
app.get('/api/partners/:id', (req, res) => {
  const { id } = req.params;
  const partner = db.partners.find(p => p.id === id);
  
  if (!partner) {
    return res.status(404).json({ error: '渠道商不存在' });
  }

  const operator = getRequestOperator(req);
  if (!canViewPartnerProfile(operator, partner)) {
    return res.status(403).json({ success: false, error: '无权查看该渠道商详情' });
  }
  
  // 同步 techServiceType 与 isTechService（兼容旧数据）
  syncTechServiceType(partner);
  if (partner.city === undefined || partner.city === null) partner.city = '';
  
  // 同步 user 信息到 staff（处理旧数据缺少 phone/status 等字段的情况）
  syncPartnerStaffListUserInfo(partner);
  
  res.json({ success: true, data: partner });
});

// 更新渠道商状态（审批）
app.put('/api/partners/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, remark, approvedBy } = req.body;
  
  const partner = db.partners.find(p => p.id === id);
  if (!partner) {
    return res.status(404).json({ error: '渠道商不存在' });
  }
  
  partner.status = status;
  partner.approvedBy = approvedBy;
  partner.approvedAt = new Date().toISOString();
  partner.remark = remark || '';
  
  // 更新待审批列表
  const approval = db.pendingApprovals.find(a => a.targetId === id && a.type === 'partner');
  if (approval) {
    approval.status = status;
    approval.approvedBy = approvedBy;
    approval.approvedAt = new Date().toISOString();
  }
  
  saveData();
  
  res.json({ success: true, data: partner });
});

// 给渠道商添加员工
app.post('/api/partners/:id/staff', (req, res) => {
  const { id } = req.params;
  const { username, name, password, region, status, staffRole, phone, email } = req.body;
  
  const partner = db.partners.find(p => p.id === id);
  if (!partner) {
    return res.status(404).json({ success: false, message: '渠道商不存在' });
  }
  
  // 检查账号是否已存在
  if (db.users.find(u => u.username === username)) {
    return res.status(400).json({ success: false, message: '用户名已存在' });
  }
  
  // 生成唯一ID
  const prefix = partner.id.replace('P', 'S');
  const existingIds = db.users.filter(u => u.id.startsWith(prefix)).map(u => parseInt(u.id.slice(prefix.length + 1)) || 0);
  const maxId = Math.max(0, ...existingIds);
  const newId = prefix + '-' + String(maxId + 1).padStart(3, '0');
  
  const newUser = {
    id: newId,
    username,
    name,
    role: 'staff',
    password: password || '123456',
    partnerId: partner.id,
    partnerName: partner.name,
    region: region || partner.region,
    status: status || 'active',
    staffRole: staffRole || '销售代表',
    phone: phone || '',
    email: email || '',
    createdAt: new Date().toISOString()
  };
  
  db.users.push(newUser);
  
  // 同时添加到渠道商的 staff 数组
  if (!partner.staff) partner.staff = [];
  partner.staff.push({
    id: newId,
    name,
    role: staffRole || '销售代表',
    phone: phone || '',
    email: email || '',
    username,
    userId: newId,
    status: newUser.status
  });
  
  // 如果是待审批状态，写入 pendingApprovals（等待超级管理员审批）
  if (newUser.status === 'pending') {
    if (!db.pendingApprovals) db.pendingApprovals = [];
    db.pendingApprovals.push({
      id: 'APR-' + Date.now(),
      type: 'staff',
      targetId: newId,
      targetName: name,
      targetPartnerId: partner.id,
      targetPartnerName: partner.name,
      createdBy: req.body.createdBy || '',
      createdByRole: req.body.createdByRole || 'admin',
      region: newUser.region,
      bigRegion: partner.bigRegion || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  }
  
  saveData();
  setRequestAuditContext(req, {
    targetType: 'user',
    targetId: newUser.id,
    targetName: newUser.name || newUser.username || newUser.id,
    after: cloneAuditValue(newUser),
    extra: {
      partnerId: partner.id,
      partnerName: partner.name,
      body: cloneAuditValue(req.body || {})
    }
  });
  
  res.json({ success: true, message: '添加成功', data: { id: newId, status: newUser.status } });
});

function findPartnerStaffTarget(partnerId, staffId) {
  const partner = (db.partners || []).find(item => normalizeRefId(item.id) === normalizeRefId(partnerId));
  if (!partner) return { partner: null, staff: null, user: null };

  const staff = (partner.staff || []).find(item => normalizeRefId(item.id) === normalizeRefId(staffId));
  if (!staff) return { partner, staff: null, user: null };

  return { partner, staff, user: findUserByPartnerStaffRecord(staff, partner) };
}

function buildPartnerStaffOperationData(partner, staff, user) {
  const { password, ...userInfo } = user || {};
  return {
    ...userInfo,
    id: user?.id || staff.userId || staff.id || '',
    userId: user?.id || staff.userId || '',
    staffId: staff.id || '',
    username: user?.username || staff.username || '',
    name: user?.name || staff.name || '',
    phone: user?.phone || staff.phone || '',
    email: user?.email || staff.email || '',
    role: user?.role || (isPartnerAdminRoleText(staff.role) ? 'partner_admin' : 'staff'),
    staffRole: user?.staffRole || staff.role || '',
    partnerId: partner.id,
    partnerName: partner.name || '',
    status: user?.status || staff.status || ''
  };
}

function removePartnerStaffPendingApprovals(partner, staff, user) {
  if (!Array.isArray(db.pendingApprovals)) return;
  const partnerId = normalizeRefId(partner.id);
  const targetIds = new Set([
    staff.id,
    staff.userId,
    staff.username,
    user?.id,
    user?.username
  ].map(normalizeRefId).filter(Boolean));

  db.pendingApprovals = db.pendingApprovals.filter(approval => {
    if (normalizeRefId(approval.targetPartnerId) !== partnerId) return true;
    return !targetIds.has(normalizeRefId(approval.targetId));
  });
}

function sendPartnerStaffTargetError(res, target) {
  if (!target.partner) {
    res.status(404).json({ success: false, error: '渠道商不存在' });
    return true;
  }
  if (!target.staff) {
    res.status(404).json({ success: false, error: '渠道商员工不存在' });
    return true;
  }
  return false;
}

// 按渠道商和员工记录精确维护，避免历史重复账号编号串改其他渠道商。
app.put('/api/partners/:partnerId/staff/:staffId', (req, res) => {
  const target = findPartnerStaffTarget(req.params.partnerId, req.params.staffId);
  if (sendPartnerStaffTargetError(res, target)) return;

  const updates = req.body && typeof req.body === 'object' ? req.body : {};
  const now = new Date().toISOString();
  if (!target.user) {
    ['name', 'phone', 'email', 'status'].forEach(field => {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        target.staff[field] = updates[field];
      }
    });
    if (updates.staffRole !== undefined && !isPartnerAdminRoleText(target.staff.role)) {
      target.staff.role = updates.staffRole;
    }
    target.staff.updatedAt = now;
    saveData();
    return res.json({
      success: true,
      message: '员工档案已更新（未关联登录账号）',
      data: buildPartnerStaffOperationData(target.partner, target.staff, null)
    });
  }

  ['name', 'phone', 'email', 'status'].forEach(field => {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      target.user[field] = updates[field];
    }
  });
  if (updates.staffRole !== undefined && target.user.role !== 'partner_admin') {
    target.user.staffRole = updates.staffRole;
  }
  target.user.updatedAt = now;

  target.staff.userId = target.user.id;
  target.staff.username = target.user.username || target.staff.username || '';
  target.staff.name = target.user.name || target.staff.name || '';
  target.staff.phone = target.user.phone || '';
  target.staff.email = target.user.email || '';
  target.staff.status = target.user.status || target.staff.status || 'active';
  target.staff.role = target.user.role === 'partner_admin'
    ? 'partner_admin'
    : (target.user.staffRole || target.staff.role || '销售代表');
  target.staff.updatedAt = now;

  saveData();
  res.json({
    success: true,
    message: '员工信息已更新',
    data: buildPartnerStaffOperationData(target.partner, target.staff, target.user)
  });
});

// 按渠道商和员工记录精确启用或停用账号。
app.put('/api/partners/:partnerId/staff/:staffId/status', (req, res) => {
  const target = findPartnerStaffTarget(req.params.partnerId, req.params.staffId);
  if (sendPartnerStaffTargetError(res, target)) return;

  const { status, remark, approvedBy } = req.body || {};
  if (!status) {
    return res.status(400).json({ success: false, error: '账号状态不能为空' });
  }

  const now = new Date().toISOString();
  if (!target.user) {
    target.staff.status = status;
    target.staff.approvedBy = approvedBy;
    target.staff.approvedAt = now;
    target.staff.remark = remark || '';
    target.staff.updatedAt = now;
    saveData();
    return res.json({
      success: true,
      message: `员工档案已${status === 'active' ? '启用' : '停用'}（未关联登录账号）`,
      data: buildPartnerStaffOperationData(target.partner, target.staff, null)
    });
  }

  target.user.status = status;
  target.user.approvedBy = approvedBy;
  target.user.approvedAt = now;
  target.user.remark = remark || '';
  target.user.updatedAt = now;

  target.staff.userId = target.user.id;
  target.staff.username = target.user.username || target.staff.username || '';
  target.staff.status = status;
  target.staff.approvedBy = approvedBy;
  target.staff.approvedAt = now;
  target.staff.updatedAt = now;

  const targetIds = new Set([
    target.staff.id,
    target.staff.userId,
    target.staff.username,
    target.user.id,
    target.user.username
  ].map(normalizeRefId).filter(Boolean));
  const approval = (db.pendingApprovals || []).find(item =>
    normalizeRefId(item.targetPartnerId) === normalizeRefId(target.partner.id) &&
    targetIds.has(normalizeRefId(item.targetId)) &&
    (item.type === 'staff' || item.type === 'partner_admin')
  );
  if (approval) {
    approval.status = status;
    approval.approvedBy = approvedBy;
    approval.approvedAt = now;
  }

  saveData();
  res.json({
    success: true,
    message: `账号已${status === 'active' ? '启用' : '停用'}`,
    data: buildPartnerStaffOperationData(target.partner, target.staff, target.user)
  });
});

// 按渠道商和员工记录精确重置密码。
app.put('/api/partners/:partnerId/staff/:staffId/password', (req, res) => {
  const target = findPartnerStaffTarget(req.params.partnerId, req.params.staffId);
  if (sendPartnerStaffTargetError(res, target)) return;
  if (!target.user) {
    return res.status(409).json({
      success: false,
      error: '该员工记录未关联登录账号，无法重置密码'
    });
  }

  target.user.password = req.body?.password || '123456';
  target.user.updatedAt = new Date().toISOString();
  saveData();
  res.json({ success: true, message: '密码已重置' });
});

// 按渠道商和员工记录精确删除；历史孤儿记录只删除当前渠道商内的残留员工项。
app.delete('/api/partners/:partnerId/staff/:staffId', (req, res) => {
  const target = findPartnerStaffTarget(req.params.partnerId, req.params.staffId);
  if (sendPartnerStaffTargetError(res, target)) return;

  const before = {
    user: target.user ? cloneAuditValue(target.user) : null,
    staff: cloneAuditValue(target.staff),
    partnerId: target.partner.id,
    partnerName: target.partner.name || ''
  };
  target.partner.staff = (target.partner.staff || []).filter(item => item !== target.staff);
  if (target.user) {
    db.users = (db.users || []).filter(item => item !== target.user);
  }
  removePartnerStaffPendingApprovals(target.partner, target.staff, target.user);

  setRequestAuditContext(req, {
    targetType: 'user',
    targetId: target.user?.id || target.staff.id,
    targetName: target.user?.name || target.staff.name || target.staff.username || target.staff.id,
    before,
    after: {
      id: target.user?.id || target.staff.id,
      deleted: true,
      accountMissing: !target.user
    }
  });
  saveData();

  res.json({
    success: true,
    message: target.user ? '员工账号已删除' : '员工残留记录已删除'
  });
});

// 更新员工状态（审批）
app.put('/api/users/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, remark, approvedBy } = req.body;
  
  const user = findUserByIdentifier(id);
  if (!user) {
    return res.status(404).json({ error: '员工不存在' });
  }
  
  user.status = status;
  user.approvedBy = approvedBy;
  user.approvedAt = new Date().toISOString();
  user.remark = remark || '';
  
  // 同步更新渠道商 staff 数组中的状态
  if (user.partnerId) {
    const partner = db.partners.find(p => p.id === user.partnerId);
    if (partner) {
      const staff = ensurePartnerStaffRecordForUser(partner, user, id);
      if (staff) {
        staff.userId = user.id;
        if (user.username) staff.username = user.username;
        staff.status = status;
        staff.approvedBy = approvedBy;
        staff.approvedAt = new Date().toISOString();
      }
    }
  }
  
  // 更新待审批列表（兼容 staff 和 partner_admin 两种类型）
  const approval = db.pendingApprovals.find(a =>
    (a.targetId === id || a.targetId === user.id || a.targetName === user.name) &&
    (a.type === 'staff' || a.type === 'partner_admin')
  );
  if (approval) {
    approval.status = status;
    approval.approvedBy = approvedBy;
    approval.approvedAt = new Date().toISOString();
  }
  
  saveData();
  
  res.json({ success: true, data: user });
});

// 更新渠道商信息
app.put('/api/partners/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body && typeof req.body === 'object' ? { ...req.body } : {};

  const partner = db.partners.find(p => p.id === id);
  if (!partner) {
    return res.status(404).json({ success: false, error: '渠道商不存在' });
  }

  delete updates.id; // ID 不能修改
  const nextLevel = updates.level !== undefined ? updates.level : partner.level;
  if (!nextLevel) {
    return res.status(400).json({ success: false, error: '合作级别为必填项' });
  }
  const profileFields = ['name', 'level', 'region', 'city', 'contact', 'phone', 'email', 'techServiceType'];
  const isProfileUpdate = profileFields.some(field => updates[field] !== undefined);
  if (isProfileUpdate) {
    const cityValidation = validatePartnerCity(updates.city !== undefined ? updates.city : partner.city);
    if (!cityValidation.valid) {
      return res.status(400).json({ success: false, error: cityValidation.error });
    }
    updates.city = cityValidation.city;
  }

  // 处理渠道分销层级和上级渠道商关系（支持多个上级渠道商）
  const { partnerLevel, parentPartnerId, parentPartnerIds } = updates;
  
  // 确定最终渠道分销层级（如果提供了则使用新值，否则保持原值）
  const finalPartnerLevel = partnerLevel !== undefined ? partnerLevel : partner.partnerLevel;
  
  // 确定最终上级渠道商ID列表（兼容旧参数）
  let finalParentPartnerIds = [];
  if (parentPartnerIds && Array.isArray(parentPartnerIds)) {
    finalParentPartnerIds = parentPartnerIds;
  } else if (parentPartnerId && parentPartnerId !== null && parentPartnerId !== '') {
    finalParentPartnerIds = [parentPartnerId];
  } else if (parentPartnerIds === null || parentPartnerId === null) {
    // 显式设置为空数组
    finalParentPartnerIds = [];
  } else {
    // 没有提供新的上级渠道商信息，保持现有的
    finalParentPartnerIds = partner.parentPartnerIds || [];
  }

  // 非二级渠道商不允许有上级渠道商
  if (finalPartnerLevel !== 'secondary') {
    finalParentPartnerIds = [];
  }

  // 二级渠道商必须绑定至少一个一级渠道商
  if (finalPartnerLevel === 'secondary') {
    if (finalParentPartnerIds.length === 0) {
      return res.status(400).json({ success: false, error: '二级渠道商必须指定至少一个一级渠道商' });
    }
    
    // 验证每个上级渠道商是否存在且为一级渠道商
    for (const pid of finalParentPartnerIds) {
      const parentPartner = db.partners.find(p => p.id === pid);
      if (!parentPartner) {
        return res.status(400).json({ success: false, error: `一级渠道商 ${pid} 不存在` });
      }
      if (parentPartner.partnerLevel !== 'primary') {
        return res.status(400).json({ success: false, error: `指定的渠道商 ${pid} 不是一级渠道商` });
      }
      // 二级渠道商必须与一级渠道商同区域
      if (partner.region !== parentPartner.region) {
        return res.status(400).json({ success: false, error: `二级渠道商必须与一级渠道商 ${pid} 同区域` });
      }
    }
  }

  // 更新渠道分销层级
  if (partnerLevel !== undefined) {
    partner.partnerLevel = finalPartnerLevel;
  }

  // 更新上级渠道商关系（只有当渠道商是二级时才设置）
  if (finalPartnerLevel === 'secondary') {
    partner.parentPartnerIds = finalParentPartnerIds;
    // 为了向后兼容，也设置 parentPartnerId 为第一个元素（如果存在）
    partner.parentPartnerId = finalParentPartnerIds.length > 0 ? finalParentPartnerIds[0] : null;
  } else {
    // 非二级渠道商清空上级渠道商关系
    partner.parentPartnerIds = [];
    partner.parentPartnerId = null;
  }

  // 应用其他更新字段
  delete updates.partnerLevel;
  delete updates.parentPartnerId;
  delete updates.parentPartnerIds;
  stripAuditOperatorFields(updates);
  Object.assign(partner, updates, { updatedAt: new Date().toISOString() });

  // 同步 techServiceType 与 isTechService
  syncTechServiceType(partner);

  saveData();

  res.json({ success: true, data: partner });
});

// 删除渠道商
app.delete('/api/partners/:id', (req, res) => {
  const { id } = req.params;
  const { operatedByRole } = req.body || {};
  
  if (operatedByRole !== 'superadmin') {
    return res.status(403).json({ success: false, error: '仅超级管理员可删除渠道商' });
  }
  
  const partner = db.partners.find(p => p.id === id);
  if (!partner) {
    return res.status(404).json({ success: false, error: '渠道商不存在' });
  }

  const linkedUsers = db.users.filter(u => u.partnerId === id);
  if (linkedUsers.length > 0) {
    return res.status(400).json({ success: false, error: `该渠道商下还有 ${linkedUsers.length} 个账号，无法删除` });
  }

  const childPartners = db.partners.filter(p =>
    p.id !== id && (
      p.parentPartnerId === id ||
      (Array.isArray(p.parentPartnerIds) && p.parentPartnerIds.includes(id))
    )
  );
  if (childPartners.length > 0) {
    return res.status(400).json({ success: false, error: `该渠道商仍绑定 ${childPartners.length} 个下级渠道商，无法删除` });
  }

  const linkedRegistrations = db.registrations.filter(r => r.partnerId === id);
  if (linkedRegistrations.length > 0) {
    return res.status(400).json({ success: false, error: `该渠道商下还有 ${linkedRegistrations.length} 条客户报备，无法删除` });
  }

  const linkedOpportunities = db.opportunities.filter(o => o.partnerId === id);
  if (linkedOpportunities.length > 0) {
    return res.status(400).json({ success: false, error: `该渠道商下还有 ${linkedOpportunities.length} 条商机，无法删除` });
  }

  const linkedQuotes = db.quotes.filter(q => q.partnerId === id);
  if (linkedQuotes.length > 0) {
    return res.status(400).json({ success: false, error: `该渠道商下还有 ${linkedQuotes.length} 条报价单，无法删除` });
  }

  const linkedOrders = db.orders.filter(o => o.partnerId === id);
  if (linkedOrders.length > 0) {
    return res.status(400).json({ success: false, error: `该渠道商下还有 ${linkedOrders.length} 条订单，无法删除` });
  }

  const linkedPendingApprovals = (db.pendingApprovals || []).filter(a =>
    (a.type === 'partner' && a.targetId === id) ||
    ((a.type === 'secondary_partner' || a.type === 'partner_admin' || a.type === 'staff') && (
      a.partnerId === id ||
      a.targetId === id ||
      a.parentPartnerId === id ||
      (Array.isArray(a.parentPartnerIds) && a.parentPartnerIds.includes(id))
    ))
  );
  if (linkedPendingApprovals.length > 0) {
    return res.status(400).json({ success: false, error: `该渠道商还有 ${linkedPendingApprovals.length} 条待处理审批记录，无法删除` });
  }
  
  setRequestAuditContext(req, {
    targetId: partner.id || id,
    targetName: partner.name || partner.id || id,
    before: cloneAuditValue(partner),
    after: { id: partner.id || id, deleted: true }
  });
  db.partners = db.partners.filter(p => p.id !== id);
  saveData();
  
  res.json({ success: true, message: '渠道商已删除' });
});

// ========== 渠道分销层级管理接口 ==========

// 设置渠道分销层级
app.put('/api/partners/:id/level', (req, res) => {
  const { id } = req.params;
  const { partnerLevel, parentPartnerId, parentPartnerIds, operatedBy, operatedByRole } = req.body;
  const operator = operatedBy ? db.users.find(u => u.id === operatedBy) : null;
  const effectiveRole = operatedByRole || operator?.role || '';
  const effectiveRegion = operator?.region || '';
  
  // 权限检查：仅区域管理员和超管可操作
  if (effectiveRole !== 'admin' && effectiveRole !== 'superadmin') {
    return res.status(403).json({ success: false, error: '无权限操作' });
  }
  
  const partner = db.partners.find(p => p.id === id);
  if (!partner) {
    return res.status(404).json({ success: false, error: '渠道商不存在' });
  }

  // 区域管理员只能维护本区域渠道商
  if (effectiveRole === 'admin' && effectiveRegion && partner.region !== effectiveRegion) {
    return res.status(403).json({ success: false, error: '无权限操作其他区域渠道商' });
  }
  
  // 验证等级值
  if (!['primary', 'secondary', 'none'].includes(partnerLevel)) {
    return res.status(400).json({ success: false, error: '无效的分销层级值' });
  }
  
  // 确定上级渠道商ID列表（兼容旧参数）
  let finalParentPartnerIds = [];
  if (parentPartnerIds && Array.isArray(parentPartnerIds)) {
    finalParentPartnerIds = parentPartnerIds;
  } else if (parentPartnerId && parentPartnerId !== null && parentPartnerId !== '') {
    finalParentPartnerIds = [parentPartnerId];
  }
  
  // 二级渠道商必须绑定至少一个一级渠道商
  if (partnerLevel === 'secondary') {
    if (finalParentPartnerIds.length === 0) {
      return res.status(400).json({ success: false, error: '二级渠道商必须指定至少一个一级渠道商' });
    }
    
    // 验证每个上级渠道商是否存在且为一级渠道商
    for (const pid of finalParentPartnerIds) {
      const parentPartner = db.partners.find(p => p.id === pid);
      if (!parentPartner) {
        return res.status(400).json({ success: false, error: `一级渠道商 ${pid} 不存在` });
      }
      if (parentPartner.partnerLevel !== 'primary') {
        return res.status(400).json({ success: false, error: `指定的渠道商 ${pid} 不是一级渠道商` });
      }
      // 二级渠道商必须与一级渠道商同区域
      if (partner.region !== parentPartner.region) {
        return res.status(400).json({ success: false, error: `二级渠道商必须与一级渠道商 ${pid} 同区域` });
      }
    }
  }
  
  // 更新等级
  partner.partnerLevel = partnerLevel;
  
  // 更新上级渠道商关系
  if (partnerLevel === 'secondary') {
    // 设置 parentPartnerIds 数组
    partner.parentPartnerIds = finalParentPartnerIds;
    // 为了向后兼容，也设置 parentPartnerId 为第一个元素（如果存在）
    partner.parentPartnerId = finalParentPartnerIds.length > 0 ? finalParentPartnerIds[0] : null;
  } else {
    partner.parentPartnerIds = [];
    partner.parentPartnerId = null;
  }
  
  partner.partnerLevelSetBy = operatedBy || operator?.id || '';
  partner.partnerLevelSetAt = new Date().toISOString();
  partner.updatedAt = new Date().toISOString();
  
  saveData();
  
  res.json({ success: true, data: partner, message: '分销层级设置成功' });
});

// 解绑二级渠道商
app.put('/api/partners/:id/unbind', (req, res) => {
  const { id } = req.params;
  const { parentPartnerIdToRemove, operatedBy, operatedByRole } = req.body;
  
  // 权限检查
  if (operatedByRole !== 'admin' && operatedByRole !== 'superadmin') {
    return res.status(403).json({ success: false, error: '无权限操作' });
  }
  
  const partner = db.partners.find(p => p.id === id);
  if (!partner) {
    return res.status(404).json({ success: false, error: '渠道商不存在' });
  }
  
  if (partner.partnerLevel !== 'secondary') {
    return res.status(400).json({ success: false, error: '只能解绑二级渠道商' });
  }
  
  // 部分解绑：从 parentPartnerIds 中移除指定的上级渠道商
  if (parentPartnerIdToRemove) {
    if (!partner.parentPartnerIds || !Array.isArray(partner.parentPartnerIds)) {
      partner.parentPartnerIds = [];
    }
    
    // 移除指定的上级渠道商
    const index = partner.parentPartnerIds.indexOf(parentPartnerIdToRemove);
    if (index !== -1) {
      partner.parentPartnerIds.splice(index, 1);
    }
    
    // 如果移除后数组为空，则变为无层级
    if (partner.parentPartnerIds.length === 0) {
      partner.partnerLevel = 'none';
      partner.parentPartnerId = null;
    } else {
      // 更新 parentPartnerId 为第一个元素（向后兼容）
      partner.parentPartnerId = partner.parentPartnerIds[0];
    }
    
    partner.updatedAt = new Date().toISOString();
    saveData();
    
    return res.json({ 
      success: true, 
      data: partner, 
      message: partner.parentPartnerIds.length > 0 
        ? '已移除指定的上级渠道商' 
        : '已移除所有上级渠道商，渠道分销层级已变为无层级'
    });
  }
  
  // 完全解绑：变为无层级
  partner.partnerLevel = 'none';
  partner.parentPartnerIds = [];
  partner.parentPartnerId = null;
  partner.updatedAt = new Date().toISOString();
  
  saveData();
  
  res.json({ success: true, data: partner, message: '解绑成功' });
});

// 添加上级渠道商到二级渠道商（支持多个上级渠道商）
app.put('/api/partners/:id/add-parent', (req, res) => {
  const { id } = req.params;
  const { parentPartnerId, parentPartnerIds, operatedBy, operatedByRole } = req.body;
  
  // 权限检查
  if (operatedByRole !== 'admin' && operatedByRole !== 'superadmin') {
    return res.status(403).json({ success: false, error: '无权限操作' });
  }
  
  const partner = db.partners.find(p => p.id === id);
  if (!partner) {
    return res.status(404).json({ success: false, error: '渠道商不存在' });
  }
  
  if (partner.partnerLevel !== 'secondary') {
    return res.status(400).json({ success: false, error: '只能为二级渠道商添加上级渠道商' });
  }
  
  // 确定要添加的上级渠道商ID列表
  let idsToAdd = [];
  if (parentPartnerIds && Array.isArray(parentPartnerIds)) {
    idsToAdd = parentPartnerIds;
  } else if (parentPartnerId && parentPartnerId !== null && parentPartnerId !== '') {
    idsToAdd = [parentPartnerId];
  } else {
    return res.status(400).json({ success: false, error: '必须指定至少一个上级渠道商' });
  }
  
  // 验证每个上级渠道商
  const validParentIds = [];
  for (const pid of idsToAdd) {
    const parentPartner = db.partners.find(p => p.id === pid);
    if (!parentPartner) {
      return res.status(400).json({ success: false, error: `一级渠道商 ${pid} 不存在` });
    }
    if (parentPartner.partnerLevel !== 'primary') {
      return res.status(400).json({ success: false, error: `指定的渠道商 ${pid} 不是一级渠道商` });
    }
    if (partner.region !== parentPartner.region) {
      return res.status(400).json({ success: false, error: `二级渠道商必须与一级渠道商 ${pid} 同区域` });
    }
    validParentIds.push(pid);
  }
  
  // 初始化 parentPartnerIds 数组
  if (!partner.parentPartnerIds || !Array.isArray(partner.parentPartnerIds)) {
    partner.parentPartnerIds = [];
  }
  
  // 添加新的上级渠道商（去重）
  let addedCount = 0;
  for (const pid of validParentIds) {
    if (!partner.parentPartnerIds.includes(pid)) {
      partner.parentPartnerIds.push(pid);
      addedCount++;
    }
  }
  
  // 更新 parentPartnerId 为第一个元素（向后兼容）
  if (partner.parentPartnerIds.length > 0) {
    partner.parentPartnerId = partner.parentPartnerIds[0];
  }
  
  partner.updatedAt = new Date().toISOString();
  saveData();
  
  res.json({ 
    success: true, 
    data: partner, 
    message: addedCount > 0 
      ? `成功添加 ${addedCount} 个上级渠道商` 
      : '指定的上级渠道商已存在，未添加重复项'
  });
});

// 重新绑定二级渠道商到新的一级渠道商（替换整个上级渠道商列表）
app.put('/api/partners/:id/rebind', (req, res) => {
  const { id } = req.params;
  const { parentPartnerId, parentPartnerIds, operatedBy, operatedByRole } = req.body;
  
  // 权限检查
  if (operatedByRole !== 'admin' && operatedByRole !== 'superadmin') {
    return res.status(403).json({ success: false, error: '无权限操作' });
  }
  
  const partner = db.partners.find(p => p.id === id);
  if (!partner) {
    return res.status(404).json({ success: false, error: '渠道商不存在' });
  }
  
  if (partner.partnerLevel !== 'secondary') {
    return res.status(400).json({ success: false, error: '只能重新绑定二级渠道商' });
  }
  
  // 确定新的上级渠道商ID列表
  let newParentPartnerIds = [];
  if (parentPartnerIds && Array.isArray(parentPartnerIds)) {
    newParentPartnerIds = parentPartnerIds;
  } else if (parentPartnerId && parentPartnerId !== null && parentPartnerId !== '') {
    newParentPartnerIds = [parentPartnerId];
  } else {
    return res.status(400).json({ success: false, error: '必须指定至少一个上级渠道商' });
  }
  
  // 验证每个上级渠道商
  for (const pid of newParentPartnerIds) {
    const parentPartner = db.partners.find(p => p.id === pid);
    if (!parentPartner) {
      return res.status(400).json({ success: false, error: `一级渠道商 ${pid} 不存在` });
    }
    if (parentPartner.partnerLevel !== 'primary') {
      return res.status(400).json({ success: false, error: `指定的渠道商 ${pid} 不是一级渠道商` });
    }
    if (partner.region !== parentPartner.region) {
      return res.status(400).json({ success: false, error: `二级渠道商必须与一级渠道商 ${pid} 同区域` });
    }
  }
  
  // 更新上级渠道商列表
  partner.parentPartnerIds = newParentPartnerIds;
  partner.parentPartnerId = newParentPartnerIds.length > 0 ? newParentPartnerIds[0] : null;
  partner.updatedAt = new Date().toISOString();
  
  saveData();
  
  res.json({ success: true, data: partner, message: '重新绑定成功' });
});

// ========== 二级渠道商审批流接口 ==========

// 一级渠道商申请创建二级渠道商
app.post('/api/partners/secondary/apply', (req, res) => {
  const { name, level, region, city, bigRegion, contact, phone, email, techServiceType, createdBy, createdByRole, parentPartnerId, parentPartnerIds } = req.body;
  
  // 确定上级渠道商ID列表（兼容旧参数）
  let finalParentPartnerIds = [];
  if (parentPartnerIds && Array.isArray(parentPartnerIds)) {
    finalParentPartnerIds = parentPartnerIds;
  } else if (parentPartnerId && parentPartnerId !== null && parentPartnerId !== '') {
    finalParentPartnerIds = [parentPartnerId];
  }
  
  if (!name || !region || finalParentPartnerIds.length === 0) {
    return res.status(400).json({ success: false, error: '缺少必要参数' });
  }
  if (!level) {
    return res.status(400).json({ success: false, error: '合作级别为必填项' });
  }
  const cityValidation = validatePartnerCity(city);
  if (!cityValidation.valid) {
    return res.status(400).json({ success: false, error: cityValidation.error });
  }
  
  // 验证每个上级渠道商是否存在且为一级渠道商，并且区域匹配
  for (const pid of finalParentPartnerIds) {
    const parentPartner = db.partners.find(p => p.id === pid);
    if (!parentPartner) {
      return res.status(400).json({ success: false, error: `一级渠道商 ${pid} 不存在` });
    }
    if (parentPartner.partnerLevel !== 'primary') {
      return res.status(400).json({ success: false, error: `指定的渠道商 ${pid} 不是一级渠道商` });
    }
    // 二级渠道商必须与一级渠道商同区域
    if (region !== parentPartner.region) {
      return res.status(400).json({ success: false, error: `二级渠道商必须与一级渠道商 ${pid} 同区域` });
    }
  }
  
  // 生成渠道商ID
  const existingIds = db.partners.map(p => parseInt(p.id.replace('P', '')) || 0);
  const maxId = Math.max(0, ...existingIds);
  const newId = 'P' + String(maxId + 1).padStart(3, '0');
  
  const newPartner = {
    id: newId,
    name,
    level,
    partnerLevel: 'secondary',
    parentPartnerId: finalParentPartnerIds.length > 0 ? finalParentPartnerIds[0] : null,
    parentPartnerIds: finalParentPartnerIds,
    partnerLevelSetBy: null, // 审批通过后设置
    partnerLevelSetAt: null,
    region,
    city: cityValidation.city,
    bigRegion: bigRegion || '',
    contact: contact || '',
    phone: phone || '',
    email: email || '',
    isTechService: techServiceType === 'full',
    techServiceType: techServiceType || 'none',
    status: 'pending',
    joinDate: new Date().toISOString().split('T')[0],
    quoteCount: 0,
    orderCount: 0,
    totalAmt: 0,
    staff: [],
    createdBy,
    createdByRole
  };
  
  db.partners.push(newPartner);
  
  // 添加到待审批列表
  const approvalId = 'APR-' + Date.now();
  const firstParentPartner = db.partners.find(p => p.id === finalParentPartnerIds[0]);
  db.pendingApprovals.push({
    id: approvalId,
    type: 'secondary_partner',
    targetId: newId,
    targetName: name,
    parentPartnerId: finalParentPartnerIds[0],
    parentPartnerName: firstParentPartner ? firstParentPartner.name : '',
    createdBy,
    createdByRole,
    region,
    bigRegion: bigRegion || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  });
  
  saveData();
  
  res.json({ 
    success: true, 
    data: newPartner,
    message: '二级渠道商申请已提交，等待区域管理员或超管审批'
  });
});

// 获取待审批的二级渠道商申请
app.get('/api/partners/secondary/pending', (req, res) => {
  const { userRole, region } = req.query;
  
  let list = db.pendingApprovals.filter(a => a.type === 'secondary_partner' && a.status === 'pending');
  
  // 区域管理员只能看到本区域的申请
  if (userRole === 'admin' && region) {
    list = list.filter(a => a.region === region);
  }
  // 超管可看全部
  
  res.json({ success: true, data: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

// 审批通过二级渠道商申请
app.put('/api/partners/secondary/:id/approve', (req, res) => {
  const { id } = req.params;
  const { approvedBy, approvedByRole } = req.body;
  
  // 权限检查
  if (approvedByRole !== 'admin' && approvedByRole !== 'superadmin') {
    return res.status(403).json({ success: false, error: '无权限操作' });
  }
  
  const approval = db.pendingApprovals.find(a => a.id === id && a.type === 'secondary_partner');
  if (!approval) {
    return res.status(404).json({ success: false, error: '审批记录不存在' });
  }
  
  if (approval.status !== 'pending') {
    return res.status(400).json({ success: false, error: '该申请已处理' });
  }
  
  // 激活渠道商
  const partner = db.partners.find(p => p.id === approval.targetId);
  if (partner) {
    partner.status = 'active';
    partner.partnerLevelSetBy = approvedBy;
    partner.partnerLevelSetAt = new Date().toISOString();
    partner.approvedBy = approvedBy;
    partner.approvedAt = new Date().toISOString();
  }
  
  // 更新审批记录
  approval.status = 'approved';
  approval.approvedBy = approvedBy;
  approval.approvedAt = new Date().toISOString();
  
  saveData();
  
  res.json({ success: true, message: '审批通过，二级渠道商已创建' });
});

// 审批驳回二级渠道商申请
app.put('/api/partners/secondary/:id/reject', (req, res) => {
  const { id } = req.params;
  const { approvedBy, approvedByRole, remark } = req.body;
  
  // 权限检查
  if (approvedByRole !== 'admin' && approvedByRole !== 'superadmin') {
    return res.status(403).json({ success: false, error: '无权限操作' });
  }
  
  const approval = db.pendingApprovals.find(a => a.id === id && a.type === 'secondary_partner');
  if (!approval) {
    return res.status(404).json({ success: false, error: '审批记录不存在' });
  }
  
  if (approval.status !== 'pending') {
    return res.status(400).json({ success: false, error: '该申请已处理' });
  }
  
  // 驳回：删除渠道商记录
  db.partners = db.partners.filter(p => p.id !== approval.targetId);
  
  // 更新审批记录
  approval.status = 'rejected';
  approval.approvedBy = approvedBy;
  approval.approvedAt = new Date().toISOString();
  approval.remark = remark || '';
  
  saveData();
  
  res.json({ success: true, message: '已驳回申请' });
});

// ========== 订单多级确认接口 ==========

// 一级渠道商确认订单
app.put('/api/orders/:id/primary-confirm', (req, res) => {
  const { id } = req.params;
  const { operatorId, operatorName, operatorPartnerId, remark } = req.body;
  
  const order = db.orders.find(o => o.id === id);
  if (!order) {
    writeAuditLog(req, {
      module: 'order',
      action: 'primary_confirm',
      result: 'failure',
      message: '一级确认失败：订单不存在',
      targetType: 'order',
      targetId: id,
      extra: req.body
    });
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  
  // 验证订单状态
  if (order.status !== 'pending') {
    writeAuditLog(req, {
      module: 'order',
      action: 'primary_confirm',
      result: 'failure',
      message: '一级确认失败：订单状态不正确',
      targetType: 'order',
      targetId: id,
      targetName: order.customerName || order.id,
      extra: req.body
    });
    return res.status(400).json({ success: false, error: '订单状态不正确' });
  }
  
  // 验证订单的二级渠道商是否绑定到该一级渠道商
  // operatorPartnerId 为操作者的渠道商ID（一级渠道商），operatorId 为其用户ID
  const secondaryPartner = db.partners.find(p => p.id === order.partnerId);
  if (!secondaryPartner || secondaryPartner.partnerLevel !== 'secondary') {
    writeAuditLog(req, {
      module: 'order',
      action: 'primary_confirm',
      result: 'failure',
      message: '一级确认失败：该订单不属于二级渠道商',
      targetType: 'order',
      targetId: id,
      targetName: order.customerName || order.id,
      extra: req.body
    });
    return res.status(403).json({ success: false, error: '此订单不属于二级渠道商，无需一级确认' });
  }
  // 支持两种方式识别操作者的渠道商：前端明确传 operatorPartnerId，或通过 operatorId 查找
  let operatorPId = operatorPartnerId;
  if (!operatorPId && operatorId) {
    const operatorUser = db.users.find(u => u.id === operatorId);
    if (operatorUser && operatorUser.partnerId) {
      operatorPId = operatorUser.partnerId;
    }
    // 也有可能 operatorId 本身就是 partner 的 id（如企业管理员账号就是 partnerId）
    if (!operatorPId) {
      const matchPartner = db.partners.find(p => p.id === operatorId);
      if (matchPartner) operatorPId = operatorId;
    }
  }
  // 检查操作者是否是该二级渠道商的上级渠道商（支持多个上级渠道商）
  const parentIds = secondaryPartner.parentPartnerIds || 
                   (secondaryPartner.parentPartnerId ? [secondaryPartner.parentPartnerId] : []);
  if (!operatorPId || !parentIds.includes(operatorPId)) {
    writeAuditLog(req, {
      module: 'order',
      action: 'primary_confirm',
      result: 'failure',
      message: '一级确认失败：操作者不是绑定的一级渠道商',
      targetType: 'order',
      targetId: id,
      targetName: order.customerName || order.id,
      extra: req.body
    });
    return res.status(403).json({ success: false, error: '无权限确认此订单，您不是该二级渠道商的上级渠道商' });
  }
  
  const beforeOrder = JSON.parse(JSON.stringify(order));
  // 更新订单状态
  order.status = 'primary_confirmed'; // 新增状态：一级已确认
  order.primaryConfirmedBy = operatorId;
  order.primaryConfirmedByName = operatorName;
  order.primaryConfirmedAt = new Date().toISOString();
  order.primaryConfirmRemark = remark || '';
  
  // 记录状态变更历史
  if (!order.statusHistory) {
    order.statusHistory = [];
  }
  order.statusHistory.push({
    from: 'pending',
    to: 'primary_confirmed',
    operatorId,
    operatorName,
    operatorRole: 'primary_partner',
    remark: remark || '',
    timestamp: new Date().toISOString()
  });
  
  saveData();
  writeAuditLog(req, {
    module: 'order',
    action: 'primary_confirm',
    result: 'success',
    message: '一级渠道商确认订单成功',
    targetType: 'order',
    targetId: order.id,
    targetName: order.customerName || order.id,
    before: beforeOrder,
    after: order,
    extra: {
      operatorId,
      operatorName,
      operatorPartnerId: operatorPId,
      remark: remark || ''
    }
  });
  
  res.json({ success: true, data: order, message: '一级确认成功，等待区域管理员审批' });
});

// 一级渠道商驳回订单
app.put('/api/orders/:id/primary-reject', (req, res) => {
  const { id } = req.params;
  const { operatorId, operatorName, operatorPartnerId, remark } = req.body;
  
  const order = db.orders.find(o => o.id === id);
  if (!order) {
    writeAuditLog(req, {
      module: 'order',
      action: 'primary_reject',
      result: 'failure',
      message: '一级驳回失败：订单不存在',
      targetType: 'order',
      targetId: id,
      extra: req.body
    });
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  
  if (order.status !== 'pending') {
    writeAuditLog(req, {
      module: 'order',
      action: 'primary_reject',
      result: 'failure',
      message: '一级驳回失败：订单状态不正确',
      targetType: 'order',
      targetId: id,
      targetName: order.customerName || order.id,
      extra: req.body
    });
    return res.status(400).json({ success: false, error: '订单状态不正确' });
  }
  
  // 验证权限：同 primary-confirm
  const secondaryPartner = db.partners.find(p => p.id === order.partnerId);
  if (!secondaryPartner || secondaryPartner.partnerLevel !== 'secondary') {
    writeAuditLog(req, {
      module: 'order',
      action: 'primary_reject',
      result: 'failure',
      message: '一级驳回失败：该订单不属于二级渠道商',
      targetType: 'order',
      targetId: id,
      targetName: order.customerName || order.id,
      extra: req.body
    });
    return res.status(403).json({ success: false, error: '此订单不属于二级渠道商' });
  }
  let operatorPId = operatorPartnerId;
  if (!operatorPId && operatorId) {
    const operatorUser = db.users.find(u => u.id === operatorId);
    if (operatorUser && operatorUser.partnerId) {
      operatorPId = operatorUser.partnerId;
    }
    if (!operatorPId) {
      const matchPartner = db.partners.find(p => p.id === operatorId);
      if (matchPartner) operatorPId = operatorId;
    }
  }
  // 检查操作者是否是该二级渠道商的上级渠道商（支持多个上级渠道商）
  const parentIds = secondaryPartner.parentPartnerIds || 
                   (secondaryPartner.parentPartnerId ? [secondaryPartner.parentPartnerId] : []);
  if (!operatorPId || !parentIds.includes(operatorPId)) {
    writeAuditLog(req, {
      module: 'order',
      action: 'primary_reject',
      result: 'failure',
      message: '一级驳回失败：操作者不是绑定的一级渠道商',
      targetType: 'order',
      targetId: id,
      targetName: order.customerName || order.id,
      extra: req.body
    });
    return res.status(403).json({ success: false, error: '无权限驳回此订单，您不是该二级渠道商的上级渠道商' });
  }
  
  const beforeOrder = JSON.parse(JSON.stringify(order));
  // 更新订单状态
  order.status = 'primary_rejected';
  order.primaryRejectedBy = operatorId;
  order.primaryRejectedByName = operatorName;
  order.primaryRejectedAt = new Date().toISOString();
  order.primaryRejectRemark = remark || '';
  
  // 记录状态变更历史
  if (!order.statusHistory) {
    order.statusHistory = [];
  }
  order.statusHistory.push({
    from: 'pending',
    to: 'primary_rejected',
    operatorId,
    operatorName,
    operatorRole: 'primary_partner',
    remark: remark || '',
    timestamp: new Date().toISOString()
  });
  
  saveData();
  writeAuditLog(req, {
    module: 'order',
    action: 'primary_reject',
    result: 'success',
    message: '一级渠道商驳回订单成功',
    targetType: 'order',
    targetId: order.id,
    targetName: order.customerName || order.id,
    before: beforeOrder,
    after: order,
    extra: {
      operatorId,
      operatorName,
      operatorPartnerId: operatorPId,
      remark: remark || ''
    }
  });
  
  res.json({ success: true, data: order, message: '订单已驳回' });
});

// 获取待审批列表
app.get('/api/pending-approvals', (req, res) => {
  const { userRole, region } = req.query;
  
  let list = db.pendingApprovals.filter(a => a.status === 'pending');
  
  // 区域管理员只能看自己提交的
  if (userRole === 'admin') {
    list = list.filter(a => a.createdByRole !== 'superadmin');
  }
  
  res.json({ success: true, data: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

// 审批/驳回账号（支持 partner_admin 和 staff）
app.put('/api/pending-approvals/:id', (req, res) => {
  const { id } = req.params;
  const { action, approvedBy } = req.body; // action: 'approve' | 'reject'
  
  // 查找待审批记录
  const apr = db.pendingApprovals.find(a => a.id === id);
  if (!apr) {
    writeAuditLog(req, {
      module: 'approval',
      action: 'process_pending',
      result: 'failure',
      message: '审批处理失败：记录不存在',
      targetType: 'pending_approval',
      targetId: id,
      extra: req.body
    });
    return res.status(404).json({ success: false, message: '审批记录不存在' });
  }
  
  if (apr.status !== 'pending') {
    writeAuditLog(req, {
      module: 'approval',
      action: 'process_pending',
      result: 'failure',
      message: '审批处理失败：记录已处理',
      targetType: 'pending_approval',
      targetId: id,
      targetName: apr.type || apr.id,
      extra: req.body
    });
    return res.status(400).json({ success: false, message: '该记录已处理' });
  }
  
  const beforeApproval = JSON.parse(JSON.stringify(apr));
  if (action === 'approve') {
    // 激活账号
    const user = db.users.find(u => u.id === apr.targetId);
    if (user) {
      user.status = 'active';
      // 如果是员工，同时激活 partner.staff 中的记录
      const partner = db.partners.find(p => p.id === apr.targetPartnerId);
      if (partner && partner.staff) {
        const sf = partner.staff.find(s => s.userId === apr.targetId);
        if (sf) sf.status = 'active';
      }
    }
    apr.status = 'approved';
    apr.approvedBy = approvedBy;
    apr.approvedAt = new Date().toISOString();
  } else if (action === 'reject') {
    // 驳回：删除账号记录和 partner.staff 记录
    const idx = db.users.findIndex(u => u.id === apr.targetId);
    if (idx > -1) db.users.splice(idx, 1);
    const partner = db.partners.find(p => p.id === apr.targetPartnerId);
    if (partner && partner.staff) {
      partner.staff = partner.staff.filter(s => s.userId !== apr.targetId);
    }
    apr.status = 'rejected';
  }
  
  saveData();
  writeAuditLog(req, {
    module: 'approval',
    action: 'process_pending',
    result: 'success',
    message: action === 'approve' ? '待审批记录已通过' : '待审批记录已驳回',
    targetType: 'pending_approval',
    targetId: apr.id,
    targetName: apr.type || apr.id,
    before: beforeApproval,
    after: apr,
    extra: {
      action,
      approvedBy,
      targetId: apr.targetId,
      targetType: apr.type
    }
  });
  res.json({ success: true, message: action === 'approve' ? '已审批通过' : '已驳回' });
});

// ========== 统计接口 ==========

// 获取仪表盘统计
app.get('/api/dashboard/stats', (req, res) => {
  const { region } = req.query;
  
  let regs = db.registrations;
  let opps = db.opportunities;
  let quotes = db.quotes;
  
  if (region) {
    regs = regs.filter(r => r.region === region);
    opps = opps.filter(o => o.region === region);
    quotes = quotes.filter(q => q.region === region);
  }
  
  res.json({
    success: true,
    data: {
      registrationCount: regs.length,
      pendingCount: regs.filter(r => r.status === 'pending').length,
      opportunityCount: opps.length,
      quoteCount: quotes.length,
      totalAmount: opps.reduce((sum, o) => sum + (o.amount || 0), 0)
    }
  });
});

// ========== 产品架构接口（三级产品体系）============

// 获取完整产品树（包含大类→模块→功能模块）
app.get('/api/product-tree', (req, res) => {
  const { published } = req.query;
  const onlyPublished = published === 'true';
  
  // 过滤数据（兼容旧数据：没有 published 字段的视为已发布）
  const categories = db.categories.filter(c => onlyPublished ? c.status === 'active' : true);
  const modules = db.modules.filter(m => onlyPublished ? m.status === 'active' : true);
  const features = db.features.filter(f => {
    if (!onlyPublished) return true;
    if (f.status !== 'active') return false;
    // 旧数据没有 published 字段视为已发布
    if (f.published === undefined) return true;
    return f.published === true;
  });
  
  // 构建产品树
  const tree = categories.map(cat => {
    const catModules = modules
      .filter(m => m.categoryId === cat.id)
      .sort((a, b) => a.sort - b.sort)
      .map(mod => ({
        ...mod,
        features: features
          .filter(f => f.moduleId === mod.id)
          .map(f => ({ ...f, tiers: undefined })) // 简化返回
      }));
    
    return {
      ...cat,
      moduleCount: catModules.length,
      featureCount: catModules.reduce((sum, m) => sum + m.features.length, 0),
      modules: catModules
    };
  }).sort((a, b) => a.sort - b.sort);
  
  res.json({ success: true, data: tree });
});

// 获取产品大类列表
app.get('/api/categories', (req, res) => {
  const { status, published } = req.query;
  let categories = [...db.categories];
  if (status) {
    categories = categories.filter(c => c.status === status);
  }
  // 支持 published 过滤（兼容旧数据：没有 published 字段的视为已发布）
  if (published !== undefined) {
    const showPublished = published === 'true';
    categories = categories.filter(c => {
      if (c.published === undefined) return true; // 旧数据视为已发布
      return c.published === showPublished;
    });
  }
  categories.sort((a, b) => a.sort - b.sort);
  res.json({ success: true, data: categories });
});

// 创建产品大类
app.post('/api/categories', (req, res) => {
  const category = {
    id: req.body.id || `CAT-${Date.now()}`,
    name: req.body.name,
    type: req.body.type || 'software',
    icon: req.body.icon || '📦',
    sort: req.body.sort || (db.categories.length + 1),
    status: 'active',
    published: req.body.published !== undefined ? req.body.published : true, // 默认已发布
    desc: req.body.desc || '',
    createdAt: new Date().toISOString()
  };
  db.categories.push(category);
  saveData();
  res.json({ success: true, data: category });
});

// 更新产品大类
app.put('/api/categories/:id', (req, res) => {
  const idx = db.categories.findIndex(c => c.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '产品大类不存在' });
  }
  db.categories[idx] = { ...db.categories[idx], ...req.body, updatedAt: new Date().toISOString() };
  saveData();
  res.json({ success: true, data: db.categories[idx] });
});

// 删除产品大类（需先删除关联的模块和功能）
app.delete('/api/categories/:id', (req, res) => {
  const idx = db.categories.findIndex(c => c.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '产品大类不存在' });
  }
  const deletedCategory = cloneAuditValue(db.categories[idx]);
  setRequestAuditContext(req, {
    targetId: deletedCategory.id || req.params.id,
    targetName: deletedCategory.name || deletedCategory.id || req.params.id,
    before: deletedCategory,
    after: { id: deletedCategory.id || req.params.id, deleted: true }
  });
  // 删除关联的模块
  const moduleIds = db.modules.filter(m => m.categoryId === req.params.id).map(m => m.id);
  db.modules = db.modules.filter(m => m.categoryId !== req.params.id);
  // 删除关联的功能
  db.features = db.features.filter(f => !moduleIds.includes(f.moduleId));
  // 删除大类
  db.categories.splice(idx, 1);
  saveData();
  res.json({ success: true, message: '产品大类及关联数据已删除' });
});

// 获取产品模块列表
app.get('/api/modules', (req, res) => {
  const { categoryId, status, published } = req.query;
  let modules = [...db.modules];
  if (categoryId) modules = modules.filter(m => m.categoryId === categoryId);
  if (status) modules = modules.filter(m => m.status === status);
  // 支持 published 过滤（兼容旧数据：没有 published 字段的视为已发布）
  if (published !== undefined) {
    const showPublished = published === 'true';
    modules = modules.filter(m => {
      if (m.published === undefined) return true; // 旧数据视为已发布
      return m.published === showPublished;
    });
  }
  modules.sort((a, b) => a.sort - b.sort);
  res.json({ success: true, data: modules });
});

// 创建产品模块
app.post('/api/modules', (req, res) => {
  const module = {
    id: req.body.id || `MOD-${Date.now()}`,
    categoryId: req.body.categoryId,
    name: req.body.name,
    icon: req.body.icon || '📋',
    sort: req.body.sort || (db.modules.filter(m => m.categoryId === req.body.categoryId).length + 1),
    status: 'active',
    published: req.body.published !== undefined ? req.body.published : true, // 默认已发布
    desc: req.body.desc || '',
    createdAt: new Date().toISOString()
  };
  db.modules.push(module);
  saveData();
  res.json({ success: true, data: module });
});

// 更新产品模块
app.put('/api/modules/:id', (req, res) => {
  const idx = db.modules.findIndex(m => m.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '产品模块不存在' });
  }
  db.modules[idx] = { ...db.modules[idx], ...req.body, updatedAt: new Date().toISOString() };
  saveData();
  res.json({ success: true, data: db.modules[idx] });
});

// 删除产品模块（需先删除关联的功能）
app.delete('/api/modules/:id', (req, res) => {
  const idx = db.modules.findIndex(m => m.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '产品模块不存在' });
  }
  const deletedModule = cloneAuditValue(db.modules[idx]);
  setRequestAuditContext(req, {
    targetId: deletedModule.id || req.params.id,
    targetName: deletedModule.name || deletedModule.id || req.params.id,
    before: deletedModule,
    after: { id: deletedModule.id || req.params.id, deleted: true }
  });
  // 删除关联的功能
  db.features = db.features.filter(f => f.moduleId !== req.params.id);
  db.modules.splice(idx, 1);
  saveData();
  res.json({ success: true, message: '产品模块及关联功能已删除' });
});

// 获取功能模块列表
app.get('/api/features', (req, res) => {
  const { moduleId, status, published } = req.query;
  let features = db.features.map(feature => normalizeStandardMaintenanceFeatureConfig(feature));
  if (moduleId) features = features.filter(f => f.moduleId === moduleId);
  if (status) features = features.filter(f => f.status === status);
  // 支持 published 过滤（兼容旧数据：没有 published 字段的视为已发布）
  if (published !== undefined) {
    const showPublished = published === 'true';
    features = features.filter(f => {
      if (f.published === undefined) return true; // 旧数据视为已发布
      return f.published === showPublished;
    });
  }
  res.json({ success: true, data: features });
});

// 创建功能模块
app.post('/api/features', (req, res) => {
  const feature = normalizeStandardMaintenanceFeatureConfig({
    id: req.body.id || `FEAT-${Date.now()}`,
    moduleId: req.body.moduleId,
    categoryId: req.body.categoryId || '',
    name: req.body.name,
    required: req.body.required || false,
    productCode: req.body.productCode || '',
    priceType: req.body.priceType || 'tiered',
    priceFixed: req.body.priceFixed || 0,
    tiers: req.body.tiers || null,
    discount: req.body.discount || null,
    unitPoints: req.body.unitPoints || null,
    unit: req.body.unit || '端点',
    desc: req.body.desc || '',
    status: 'active',
    published: req.body.published !== undefined ? req.body.published : true, // 默认已发布
    regionPriceOverrides: Array.isArray(req.body.regionPriceOverrides) ? req.body.regionPriceOverrides : [],
    maintenanceModuleRates: Array.isArray(req.body.maintenanceModuleRates) ? req.body.maintenanceModuleRates : [],
    maintenanceFeatureOverrides: Array.isArray(req.body.maintenanceFeatureOverrides) ? req.body.maintenanceFeatureOverrides : [],
    createdAt: new Date().toISOString()
  });
  db.features.push(feature);
  ensureImplementationWorkloadData();
  saveData();
  res.json({ success: true, data: feature });
});

// 更新功能模块
app.put('/api/features/:id', (req, res) => {
  const idx = db.features.findIndex(f => f.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '功能模块不存在' });
  }
  
  const feature = normalizeStandardMaintenanceFeatureConfig(db.features[idx]);
  
  // 处理价格折扣设置（折扣率模式：30% = 打3折，支付原价的30%）
  if (req.body.priceRatioPrimary !== undefined || req.body.priceRatioSecondary !== undefined) {
    // 获取折扣率值（百分比格式，如30表示30%折扣）
    let ratioPrimary = req.body.priceRatioPrimary !== undefined ? 
      parseFloat(req.body.priceRatioPrimary) : 
      (feature.priceRatioPrimary || 100);
    
    let ratioSecondary = req.body.priceRatioSecondary !== undefined ? 
      parseFloat(req.body.priceRatioSecondary) : 
      (feature.priceRatioSecondary || 100);
    
    // 如果值大于100，说明是旧数据格式（加价率），需要转换为折扣率
    // 旧格式：100%=原价，110%=加价10%，130%=加价30%
    // 新格式：100%=原价，90%=打9折，30%=打3折
    if (ratioPrimary > 100) {
      const oldRatio = ratioPrimary;
      ratioPrimary = Math.round(100 / ratioPrimary * 100);  // 例如130% -> 77%
      console.log(`[价格折扣转换] 一级渠道商: ${oldRatio}% (加价率) -> ${ratioPrimary}% (折扣率)`);
    }
    if (ratioSecondary > 100) {
      const oldRatio = ratioSecondary;
      ratioSecondary = Math.round(100 / ratioSecondary * 100);  // 例如130% -> 77%
      console.log(`[价格折扣转换] 二级渠道商: ${oldRatio}% (加价率) -> ${ratioSecondary}% (折扣率)`);
    }
    
    // 限制折扣率范围：0-100%
    ratioPrimary = Math.max(0, Math.min(100, ratioPrimary));
    ratioSecondary = Math.max(0, Math.min(100, ratioSecondary));
    
    // 基于价格类型计算渠道商价格（折扣价格 = 原价 × 折扣率 / 100）
    if (feature.priceType === 'tiered' && feature.tiers) {
      // 阶梯价格：计算每个阶梯的折扣价格
      feature.priceForPrimary = feature.tiers.map(tier => ({
        min: tier.min,
        max: tier.max,
        price: roundMoney(tier.price * ratioPrimary / 100)
      }));
      
      feature.priceForSecondary = feature.tiers.map(tier => ({
        min: tier.min,
        max: tier.max,
        price: roundMoney(tier.price * ratioSecondary / 100)
      }));
      
      console.log(`[价格计算] ${feature.name} - 一级渠道商: 阶梯价格 × ${ratioPrimary}%折扣`);
      console.log(`[价格计算] ${feature.name} - 二级渠道商: 阶梯价格 × ${ratioSecondary}%折扣`);
    } else if (feature.priceType === 'fixed') {
      // 固定价格
      const basePrice = feature.priceFixed || 0;
      feature.priceForPrimary = roundMoney(basePrice * ratioPrimary / 100);
      feature.priceForSecondary = roundMoney(basePrice * ratioSecondary / 100);
      
      console.log(`[价格计算] ${feature.name} - 一级渠道商: ¥${basePrice} × ${ratioPrimary}% = ¥${feature.priceForPrimary}`);
      console.log(`[价格计算] ${feature.name} - 二级渠道商: ¥${basePrice} × ${ratioSecondary}% = ¥${feature.priceForSecondary}`);
    }
    
    // 保存价格折扣率（百分比形式）
    feature.priceRatioPrimary = Math.round(ratioPrimary);
    feature.priceRatioSecondary = Math.round(ratioSecondary);
    feature.priceRatioUpdatedAt = new Date().toISOString();
  }
  
  // 处理区域价格覆盖配置
  if (req.body.regionPriceOverrides !== undefined && Array.isArray(req.body.regionPriceOverrides)) {
    // 对每个区域覆盖中设置了折扣率的，自动计算渠道商价格
    feature.regionPriceOverrides = req.body.regionPriceOverrides.map(override => {
      const overrideCopy = { ...override };
      const regions = Array.from(new Set([
        ...(Array.isArray(overrideCopy.regions) ? overrideCopy.regions : []),
        overrideCopy.region || ''
      ].filter(Boolean)));
      overrideCopy.region = regions[0] || '';
      overrideCopy.regions = regions;

      // 确定该区域使用的阶梯价格/固定价格基准（有覆盖用覆盖的，没有用全国的）
      const baseTiers = overrideCopy.tiers && overrideCopy.tiers.length > 0 ? overrideCopy.tiers : feature.tiers;
      const baseFixed = overrideCopy.priceFixed !== undefined && overrideCopy.priceFixed !== null ? overrideCopy.priceFixed : feature.priceFixed;
      const priceType = baseTiers && baseTiers.length > 0 ? 'tiered' : (baseFixed !== undefined && baseFixed !== null ? 'fixed' : null);

      if (!priceType) return overrideCopy;

      // 处理一级渠道商折扣率
      if (overrideCopy.priceRatioPrimary !== undefined && overrideCopy.priceRatioPrimary !== null && overrideCopy.priceRatioPrimary !== '') {
        let ratioP = parseFloat(overrideCopy.priceRatioPrimary);
        if (ratioP > 100) ratioP = Math.round(100 / ratioP * 100); // 旧格式转换
        ratioP = Math.max(0, Math.min(100, ratioP));
        overrideCopy.priceRatioPrimary = Math.round(ratioP);

        if (priceType === 'tiered') {
          overrideCopy.priceForPrimary = baseTiers.map(tier => ({
            min: tier.min, max: tier.max,
            price: roundMoney(tier.price * ratioP / 100)
          }));
        } else {
          overrideCopy.priceForPrimary = roundMoney((baseFixed || 0) * ratioP / 100);
        }
        console.log(`[区域价格] ${feature.name} - ${regions.join('、') || override.region || '未选择区域'} 一级渠道商: × ${ratioP}%`);
      } else {
        delete overrideCopy.priceRatioPrimary;
        delete overrideCopy.priceForPrimary;
      }

      // 处理二级渠道商折扣率
      if (overrideCopy.priceRatioSecondary !== undefined && overrideCopy.priceRatioSecondary !== null && overrideCopy.priceRatioSecondary !== '') {
        let ratioS = parseFloat(overrideCopy.priceRatioSecondary);
        if (ratioS > 100) ratioS = Math.round(100 / ratioS * 100);
        ratioS = Math.max(0, Math.min(100, ratioS));
        overrideCopy.priceRatioSecondary = Math.round(ratioS);

        if (priceType === 'tiered') {
          overrideCopy.priceForSecondary = baseTiers.map(tier => ({
            min: tier.min, max: tier.max,
            price: roundMoney(tier.price * ratioS / 100)
          }));
        } else {
          overrideCopy.priceForSecondary = roundMoney((baseFixed || 0) * ratioS / 100);
        }
        console.log(`[区域价格] ${feature.name} - ${regions.join('、') || override.region || '未选择区域'} 二级渠道商: × ${ratioS}%`);
      } else {
        delete overrideCopy.priceRatioSecondary;
        delete overrideCopy.priceForSecondary;
      }

      // 如果阶梯覆盖为空数组或未设置，则删除（使用全国默认）
      if (!overrideCopy.tiers || (Array.isArray(overrideCopy.tiers) && overrideCopy.tiers.length === 0)) {
        delete overrideCopy.tiers;
      }
      if (overrideCopy.priceFixed === undefined || overrideCopy.priceFixed === null) {
        delete overrideCopy.priceFixed;
      }

      return overrideCopy;
    });

    feature.regionPriceUpdatedAt = new Date().toISOString();
    console.log(`[区域价格] ${feature.name} - 已保存 ${feature.regionPriceOverrides.length} 个区域价格覆盖`);
  }

  // 更新其他字段（排除 regionPriceOverrides，已在上面单独处理）
  const { regionPriceOverrides: _rp, ...otherFields } = req.body;
  db.features[idx] = normalizeStandardMaintenanceFeatureConfig({
    ...feature,
    ...otherFields,
    updatedAt: new Date().toISOString()
  });
  // 写入已处理的区域价格覆盖
  db.features[idx].regionPriceOverrides = db.features[idx].regionPriceOverrides || feature.regionPriceOverrides || [];
  saveData();
  res.json({ success: true, data: db.features[idx] });
});

// 删除功能模块
app.delete('/api/features/:id', (req, res) => {
  const idx = db.features.findIndex(f => f.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '功能模块不存在' });
  }
  const deletedFeature = cloneAuditValue(db.features[idx]);
  setRequestAuditContext(req, {
    targetId: deletedFeature.id || req.params.id,
    targetName: deletedFeature.name || deletedFeature.id || req.params.id,
    before: deletedFeature,
    after: { id: deletedFeature.id || req.params.id, deleted: true }
  });
  db.features.splice(idx, 1);
  ensureImplementationWorkloadData();
  saveData();
  res.json({ success: true, message: '功能模块已删除' });
});

// 发布/取消发布功能模块
app.patch('/api/features/:id/publish', (req, res) => {
  const idx = db.features.findIndex(f => f.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '功能模块不存在' });
  }
  db.features[idx].published = req.body.published;
  db.features[idx].publishedAt = new Date().toISOString();
  saveData();
  res.json({ success: true, data: db.features[idx] });
});

// 获取硬件产品列表
app.get('/api/hardware', (req, res) => {
  const { categoryId, status, published } = req.query;
  let hardware = [...db.hardwareProducts];
  if (categoryId) hardware = hardware.filter(h => h.categoryId === categoryId);
  if (status) hardware = hardware.filter(h => h.status === status);
  // 支持 published 过滤（兼容旧数据：没有 published 字段的视为已发布）
  if (published !== undefined) {
    const showPublished = published === 'true';
    hardware = hardware.filter(h => {
      if (h.published === undefined) return true; // 旧数据视为已发布
      return h.published === showPublished;
    });
  }
  res.json({ success: true, data: hardware });
});

// 创建硬件产品
app.post('/api/hardware', (req, res) => {
  const hw = {
    id: req.body.id || `HW-${Date.now()}`,
    categoryId: req.body.categoryId || 'CAT-HW',
    name: req.body.name,
    model: req.body.model || '',
    icon: req.body.icon || '🖥️',
    desc: req.body.desc || '',
    specs: req.body.specs || '',
    priceFixed: req.body.priceFixed || 0,
    unit: req.body.unit || '台',
    status: 'active',
    published: req.body.published !== undefined ? req.body.published : true, // 默认已发布
    createdAt: new Date().toISOString()
  };
  db.hardwareProducts.push(hw);
  saveData();
  res.json({ success: true, data: hw });
});

// 更新硬件产品
app.put('/api/hardware/:id', (req, res) => {
  const idx = db.hardwareProducts.findIndex(h => h.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '硬件产品不存在' });
  }
  db.hardwareProducts[idx] = { ...db.hardwareProducts[idx], ...req.body, updatedAt: new Date().toISOString() };
  saveData();
  res.json({ success: true, data: db.hardwareProducts[idx] });
});

// 删除硬件产品
app.delete('/api/hardware/:id', (req, res) => {
  const idx = db.hardwareProducts.findIndex(h => h.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '硬件产品不存在' });
  }
  const deletedHardware = cloneAuditValue(db.hardwareProducts[idx]);
  setRequestAuditContext(req, {
    targetId: deletedHardware.id || req.params.id,
    targetName: deletedHardware.name || deletedHardware.id || req.params.id,
    before: deletedHardware,
    after: { id: deletedHardware.id || req.params.id, deleted: true }
  });
  db.hardwareProducts.splice(idx, 1);
  saveData();
  res.json({ success: true, message: '硬件产品已删除' });
});

// 发布/取消发布硬件产品
app.patch('/api/hardware/:id/publish', (req, res) => {
  const idx = db.hardwareProducts.findIndex(h => h.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '硬件产品不存在' });
  }
  db.hardwareProducts[idx].published = req.body.published;
  db.hardwareProducts[idx].publishedAt = new Date().toISOString();
  saveData();
  res.json({ success: true, data: db.hardwareProducts[idx] });
});

// ========== 套餐接口 ==========

// 获取套餐列表
app.get('/api/packages', (req, res) => {
  const { status, published } = req.query;
  let packages = [...db.packages];
  if (status) packages = packages.filter(p => p.status === status);
  // 支持 published 过滤（兼容旧数据：没有 published 字段的视为已发布）
  if (published !== undefined) {
    const showPublished = published === 'true';
    packages = packages.filter(p => {
      if (p.published === undefined) return true; // 旧数据视为已发布
      return p.published === showPublished;
    });
  }
  res.json({ success: true, data: packages });
});

// 获取套餐详情（含完整产品列表）
app.get('/api/packages/:id', (req, res) => {
  const pkg = db.packages.find(p => p.id === req.params.id);
  if (!pkg) {
    return res.status(404).json({ success: false, error: '套餐不存在' });
  }
  
  // 填充功能模块详情
  const features = pkg.featureIds.map(fid => db.features.find(f => f.id === fid)).filter(Boolean);
  // 填充硬件详情
  const hardware = pkg.hardwareIds.map(hid => db.hardwareProducts.find(h => h.id === hid)).filter(Boolean);
  // 填充模块详情
  const modules = pkg.moduleIds.map(mid => db.modules.find(m => m.id === mid)).filter(Boolean);
  
  res.json({ 
    success: true, 
    data: {
      ...pkg,
      features,
      hardware,
      modules
    }
  });
});

// 创建套餐
app.post('/api/packages', (req, res) => {
  const pkg = {
    id: req.body.id || `PKG-${Date.now()}`,
    name: req.body.name,
    icon: req.body.icon || '📦',
    desc: req.body.desc || '',
    featureIds: req.body.featureIds || [],
    hardwareIds: req.body.hardwareIds || [],
    moduleIds: req.body.moduleIds || [],
    status: 'active',
    published: req.body.published !== undefined ? req.body.published : true, // 默认已发布
    createdAt: new Date().toISOString()
  };
  db.packages.push(pkg);
  saveData();
  res.json({ success: true, data: pkg });
});

// 更新套餐
app.put('/api/packages/:id', (req, res) => {
  const idx = db.packages.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '套餐不存在' });
  }
  db.packages[idx] = { ...db.packages[idx], ...req.body, updatedAt: new Date().toISOString() };
  saveData();
  res.json({ success: true, data: db.packages[idx] });
});

// 删除套餐
app.delete('/api/packages/:id', (req, res) => {
  const idx = db.packages.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '套餐不存在' });
  }
  const deletedPackage = cloneAuditValue(db.packages[idx]);
  setRequestAuditContext(req, {
    targetId: deletedPackage.id || req.params.id,
    targetName: deletedPackage.name || deletedPackage.id || req.params.id,
    before: deletedPackage,
    after: { id: deletedPackage.id || req.params.id, deleted: true }
  });
  db.packages.splice(idx, 1);
  saveData();
  res.json({ success: true, message: '套餐已删除' });
});

// 发布/取消发布套餐
app.patch('/api/packages/:id/publish', (req, res) => {
  const idx = db.packages.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '套餐不存在' });
  }
  db.packages[idx].published = req.body.published;
  db.packages[idx].publishedAt = new Date().toISOString();
  saveData();
  res.json({ success: true, data: db.packages[idx] });
});

// ========== 旧版产品接口（兼容）============

// 获取产品列表（按类别分组）
app.get('/api/products', (req, res) => {
  const { type, published } = req.query;
  let products = [...db.products];
  
  // 过滤类型
  if (type) {
    products = products.filter(p => p.type === type);
  }
  
  // 过滤发布状态
  if (published === 'true') {
    products = products.filter(p => p.published === true);
  }
  
  // 按类别分组
  const categories = [...new Set(products.map(p => p.category))];
  const grouped = categories.map(cat => ({
    category: cat,
    type: products.find(p => p.category === cat)?.type || 'lep',
    products: products.filter(p => p.category === cat)
  }));
  
  res.json({ success: true, data: grouped, categories, products });
});

// 获取产品分类统计
app.get('/api/products/stats', (req, res) => {
  const stats = {
    total: db.features.length + db.hardwareProducts.length,
    published: db.features.filter(f => f.published).length + db.hardwareProducts.filter(h => h.published).length,
    unpublished: db.features.filter(f => !f.published).length + db.hardwareProducts.filter(h => !h.published).length,
    categories: db.categories.length,
    modules: db.modules.length,
    features: db.features.length,
    hardware: db.hardwareProducts.length,
    packages: db.packages.length,
    byCategory: {}
  };
  
  db.categories.forEach(cat => {
    const moduleIds = db.modules.filter(m => m.categoryId === cat.id).map(m => m.id);
    const featureCount = db.features.filter(f => moduleIds.includes(f.moduleId)).length;
    stats.byCategory[cat.id] = {
      name: cat.name,
      icon: cat.icon,
      total: featureCount,
      published: db.features.filter(f => moduleIds.includes(f.moduleId) && f.published).length
    };
  });
  
  res.json({ success: true, data: stats });
});

// 获取单个产品
app.get('/api/products/:id', (req, res) => {
  // 先在新架构中查找
  let product = db.features.find(f => f.id === req.params.id);
  if (product) {
    const module = db.modules.find(m => m.id === product.moduleId);
    const category = db.categories.find(c => c.id === module?.categoryId);
    return res.json({ success: true, data: { ...product, categoryName: category?.name, moduleName: module?.name } });
  }
  product = db.hardwareProducts.find(h => h.id === req.params.id);
  if (product) {
    return res.json({ success: true, data: product });
  }
  // 兼容旧数据
  product = db.products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: '产品不存在' });
  }
  res.json({ success: true, data: product });
});

// 创建产品（超级管理员）
app.post('/api/products', (req, res) => {
  const product = {
    id: req.body.id || `PROD-${Date.now()}`,
    ...req.body,
    status: 'active',
    published: false,
    createdAt: new Date().toISOString()
  };
  db.products.push(product);
  saveData();
  res.json({ success: true, data: product });
});

// 更新产品（超级管理员）
app.put('/api/products/:id', (req, res) => {
  const idx = db.products.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '产品不存在' });
  }
  db.products[idx] = { ...db.products[idx], ...req.body, updatedAt: new Date().toISOString() };
  saveData();
  res.json({ success: true, data: db.products[idx] });
});

// 删除产品（超级管理员）
app.delete('/api/products/:id', (req, res) => {
  const idx = db.products.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '产品不存在' });
  }
  const deletedProduct = cloneAuditValue(db.products[idx]);
  setRequestAuditContext(req, {
    targetId: deletedProduct.id || req.params.id,
    targetName: deletedProduct.name || deletedProduct.id || req.params.id,
    before: deletedProduct,
    after: { id: deletedProduct.id || req.params.id, deleted: true }
  });
  db.products.splice(idx, 1);
  saveData();
  res.json({ success: true, message: '产品已删除' });
});

// 发布/取消发布产品（超级管理员）
app.patch('/api/products/:id/publish', (req, res) => {
  const idx = db.products.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '产品不存在' });
  }
  db.products[idx].published = req.body.published;
  db.products[idx].publishedAt = new Date().toISOString();
  saveData();
  res.json({ success: true, data: db.products[idx] });
});

// 批量发布产品（超级管理员）
app.post('/api/products/batch-publish', (req, res) => {
  const { productIds, published } = req.body;
  productIds.forEach(id => {
    const idx = db.products.findIndex(p => p.id === id);
    if (idx !== -1) {
      db.products[idx].published = published;
      db.products[idx].publishedAt = new Date().toISOString();
    }
  });
  saveData();
  res.json({ success: true, message: `已${published ? '发布' : '取消发布'} ${productIds.length} 个产品` });
});

// ═══════════════════════════════════════════════════════════════════
// OAuth2/OIDC 单点登录支持
// ═══════════════════════════════════════════════════════════════════

// OAuth2 配置（可从环境变量或配置文件读取）
const OAUTH_CONFIG = {
  // 是否启用 SSO（可通过环境变量 SSO_ENABLED=true 启用）
  enabled: process.env.SSO_ENABLED === 'true' || false,
  
  // IAM 提供商配置
  provider: {
    issuer: process.env.SSO_ISSUER || 'https://your-iam.example.com',
    clientId: process.env.SSO_CLIENT_ID || 'your-client-id',
    clientSecret: process.env.SSO_CLIENT_SECRET || 'your-client-secret',
    // OIDC 标准端点
    authorizationEndpoint: process.env.SSO_AUTH_ENDPOINT || '/oauth/authorize',
    tokenEndpoint: process.env.SSO_TOKEN_ENDPOINT || '/oauth/token',
    userinfoEndpoint: process.env.SSO_USERINFO_ENDPOINT || '/oauth/userinfo',
    // 回调地址
    redirectUri: process.env.SSO_REDIRECT_URI || 'http://localhost:3000/api/oauth/callback',
    // 作用域
    scopes: process.env.SSO_SCOPES || 'openid profile email',
  },
  
  // 应用本地配置
  app: {
    // 用户名映射：IAM 用户属性 -> 本地用户字段
    usernameMapping: process.env.SSO_USERNAME_CLAIM || 'preferred_username',
    // 姓名映射
    nameMapping: process.env.SSO_NAME_CLAIM || 'name',
    // 邮箱映射
    emailMapping: process.env.SSO_EMAIL_CLAIM || 'email',
    // 部门/组织映射
    departmentMapping: process.env.SSO_DEPT_CLAIM || 'department',
  }
};

// 存储 in-flight 授权请求（防止 CSRF）
const pendingAuths = new Map();

// 生成随机字符串（state 参数）
function generateState(returnUrl) {
  const state = {
    random: Math.random().toString(36).substring(2, 15),
    timestamp: Date.now(),
    returnUrl: returnUrl || '/'
  };
  const stateStr = Buffer.from(JSON.stringify(state)).toString('base64');
  pendingAuths.set(stateStr, state);
  
  // 10分钟后过期
  setTimeout(() => pendingAuths.delete(stateStr), 10 * 60 * 1000);
  
  return stateStr;
}

// 验证 state 参数
function validateState(stateStr) {
  try {
    const state = pendingAuths.get(stateStr);
    if (!state) return null;
    
    // 检查是否过期（10分钟内）
    if (Date.now() - state.timestamp > 10 * 60 * 1000) {
      pendingAuths.delete(stateStr);
      return null;
    }
    
    pendingAuths.delete(stateStr);
    return state;
  } catch (e) {
    return null;
  }
}

// 从 IAM 获取 Token
async function exchangeCodeForToken(code, state) {
  const { provider } = OAUTH_CONFIG;
  
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: provider.redirectUri,
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
  });
  
  const response = await fetch(provider.issuer.replace(/\/$/, '') + provider.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: params.toString()
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }
  
  return await response.json();
}

// 从 IAM 获取用户信息
async function fetchUserInfo(accessToken) {
  const { provider } = OAUTH_CONFIG;
  
  const response = await fetch(provider.issuer.replace(/\/$/, '') + provider.userinfoEndpoint, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }
  
  return await response.json();
}

// 根据 IAM 用户信息查找或创建本地用户
function findOrCreateLocalUser(iamUser) {
  const { app } = OAUTH_CONFIG;
  
  // 从 IAM 用户信息中提取本地用户字段
  const iamUsername = iamUser[app.usernameMapping] || iamUser.sub;
  const iamName = iamUser[app.nameMapping] || iamUser.name || iamUsername;
  const iamEmail = iamUser[app.emailMapping] || iamUser.email || '';
  const iamDepartment = iamUser[app.departmentMapping] || iamUser.department || '';
  
  // 查找是否已存在
  let localUser = db.users.find(u => u.username === iamUsername || u.email === iamEmail);
  
  if (localUser) {
    // 更新用户信息
    localUser.name = iamName;
    localUser.email = iamEmail;
    localUser.department = iamDepartment;
    localUser.lastLogin = new Date().toISOString();
    localUser.ssoProvider = 'oidc';
    localUser.ssoSubject = iamUser.sub;
    return localUser;
  }
  
  // 自动创建新用户（需要管理员审批）
  const newUser = {
    id: 'SSO-' + Date.now(),
    username: iamUsername,
    name: iamName,
    email: iamEmail,
    department: iamDepartment,
    role: 'staff',  // 默认角色，可根据 IAM 配置调整
    status: 'pending',  // 新用户需要审批
    ssoProvider: 'oidc',
    ssoSubject: iamUser.sub,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  };
  
  db.users.push(newUser);
  saveData();
  
  return newUser;
}

// ── OAuth2/OIDC API 路由 ─────────────────────────────────────

// 获取 SSO 配置（前端使用）
app.get('/api/oauth/config', (req, res) => {
  res.json({
    enabled: OAUTH_CONFIG.enabled,
    provider: OAUTH_CONFIG.provider.issuer,
    // 不返回 clientSecret
    clientId: OAUTH_CONFIG.provider.clientId
  });
});

// 发起 SSO 登录（跳转到 IAM 授权页面）
app.get('/api/oauth/authorize', (req, res) => {
  if (!OAUTH_CONFIG.enabled) {
    return res.status(400).json({ error: 'SSO is not enabled' });
  }
  
  const { provider } = OAUTH_CONFIG;
  const returnUrl = req.query.return || '/';
  
  // 生成 state 参数
  const state = generateState(returnUrl);
  
  // 构建授权 URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: provider.clientId,
    redirect_uri: provider.redirectUri,
    scope: provider.scopes,
    state: state
  });
  
  const authUrl = provider.issuer.replace(/\/$/, '') + provider.authorizationEndpoint + '?' + params.toString();
  
  console.log('🔐 Redirecting to IAM:', authUrl);
  res.redirect(authUrl);
});

// 处理 IAM 回调
app.get('/api/oauth/callback', async (req, res) => {
  try {
    const { code, state: stateStr, error, error_description } = req.query;
    
    // 处理错误情况
    if (error) {
      console.error('OAuth error:', error, error_description);
      return res.redirect(`/?error=${encodeURIComponent(error_description || error)}`);
    }
    
    // 验证 state
    const stateData = validateState(stateStr);
    if (!stateData) {
      return res.redirect(`/?error=${encodeURIComponent('Invalid state parameter')}`);
    }
    
    // 用授权码换取 Token
    const tokenResponse = await exchangeCodeForToken(code, stateStr);
    
    if (!tokenResponse.access_token) {
      throw new Error('No access token received');
    }
    
    // 获取用户信息
    const iamUser = await fetchUserInfo(tokenResponse.access_token);
    
    // 查找或创建本地用户
    const localUser = findOrCreateLocalUser(iamUser);
    
    // 生成应用 Token
    const appToken = 'sso_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
    
    // 存储 Token 映射
    db.tokens = db.tokens || [];
    db.tokens.push({
      token: appToken,
      userId: localUser.id,
      type: 'sso',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小时
    });
    saveData();
    
    // 构建返回信息
    const { password: _, ...userInfo } = localUser;
    
    // 返回到前端（通过 URL 参数传递）
    const returnData = Buffer.from(JSON.stringify({
      token: appToken,
      user: userInfo
    })).toString('base64');
    
    // 重定向回前端应用
    const frontendUrl = stateData.returnUrl.includes('sso_callback') 
      ? stateData.returnUrl 
      : `/sso_callback.html`;
    
    res.redirect(`${frontendUrl}?data=${returnData}`);
    
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`/?error=${encodeURIComponent(err.message)}`);
  }
});

// 获取当前用户信息（OIDC 标准接口）
app.get('/api/oauth/userinfo', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.substring(7);
  const tokenData = db.tokens?.find(t => t.token === token && t.type === 'sso');
  
  if (!tokenData) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  const user = db.users.find(u => u.id === tokenData.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  // 返回标准 OIDC 用户信息
  res.json({
    sub: user.id,
    preferred_username: user.username,
    name: user.name,
    email: user.email,
    department: user.department,
    role: user.role,
    status: user.status
  });
});

// SSO 登出
app.post('/api/oauth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (db.tokens) {
      db.tokens = db.tokens.filter(t => t.token !== token);
      saveData();
    }
  }
  res.json({ success: true });
});

// ========== 企业信息查询（代理接口，避免前端跨域） ==========

// 引入 https 模块（Node.js 内置，无需安装）
const https = require('https');

/**
 * GET /api/company-search?keyword=xxx
 * 通过阿里云市场企业工商模糊查询 API 查询企业工商信息
 *
 * 配置说明：
 *   - 在后端启动时设置环境变量 COMPANY_API_KEY=你的AppCode
 *   - 例如：COMPANY_API_KEY=8785eb7b1e854819867bc497405bb2cc
 *   - 接口：POST https://kzgsmnv1.market.alicloudapi.com/api/company_search/query
 *   - 返回字段：companyName, creditNo, legalPerson, establishDate, companyStatus, companyCode
 */
const COMPANY_API_KEY = process.env.COMPANY_API_KEY || ''; // 留空则只走本地数据

function mergeCompanySearchResults(...groups) {
  const merged = [];
  const indexMap = new Map();

  for (const group of groups) {
    for (const item of group || []) {
      const key = normalizeCompanyName(item.name || item.customer || '') || String(item.creditCode || '');
      if (!key) continue;

      if (!indexMap.has(key)) {
        merged.push({ ...item });
        indexMap.set(key, merged.length - 1);
        continue;
      }

      const target = merged[indexMap.get(key)];
      for (const [field, value] of Object.entries(item)) {
        if ((target[field] === undefined || target[field] === null || target[field] === '') && value) {
          target[field] = value;
        }
      }
    }
  }

  return merged;
}

app.get('/api/company-search', async (req, res) => {
  const keyword = (req.query.keyword || '').trim();
  if (!keyword || keyword.length < 2) {
    return res.json({ success: true, data: [] });
  }

  const ledgerMatches = searchCustomerLedger(keyword, 10);

  // ── 先在本地已报备/已有数据中做模糊匹配（无需外部接口） ──
  // 这样即使没有配置 API Key 也能在已报备客户中搜索
  const localMatches = [];
  const registrations = db.registrations || [];
  const lk = keyword.toLowerCase();
  const seenNames = new Set();
  for (const r of registrations) {
    if (r.customer && r.customer.toLowerCase().includes(lk) && !seenNames.has(r.customer)) {
      seenNames.add(r.customer);
      localMatches.push({
        name: r.customer,
        creditCode: r.creditCode || '',
        legalPerson: r.legalPerson || '',
        address: r.address || r.city || '',
        province: '',
        city: r.city || '',
        companyStatus: '在营',
        industry: r.industry || '',
        source: 'local'  // 标识来源，前端可据此显示"本地"徽标
      });
    }
  }

  // ── 调用外部 API 查询（阿里云市场） ──
  // 如果没有配置 API Key，则只返回本地数据
  if (!COMPANY_API_KEY) {
    return res.json({
      success: true,
      data: mergeCompanySearchResults(ledgerMatches, localMatches),
      note: COMPANY_API_KEY ? '' : 'no_api_key'  // 提示前端未配置 key
    });
  }

  try {
    // 阿里云市场 API：POST + x-www-form-urlencoded
    const postData = `keyword=${encodeURIComponent(keyword)}&pageNum=1&pageSize=10`;

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'kzgsmhv1.market.alicloudapi.com',
        path: '/api/company_search/query',
        method: 'POST',
        headers: {
          'Authorization': `APPCODE ${COMPANY_API_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Mozilla/5.0'
        }
      };
      const request = https.request(options, (response) => {
        let body = '';
        response.on('data', chunk => body += chunk);
        response.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch(e) {
            reject(new Error('解析响应失败'));
          }
        });
      });
      request.on('error', reject);
      request.setTimeout(8000, () => { request.destroy(); reject(new Error('请求超时')); });
      request.write(postData);
      request.end();
    });

    // 阿里云接口返回格式：{ code: 200, data: { companyList: [...] } }
    if (result.code === 200 && result.data && result.data.companyList) {
      const rows = result.data.companyList;
      const apiResults = rows.map(d => ({
        name: d.companyName || '',
        creditCode: d.creditNo || '',
        legalPerson: d.legalPerson || '',
        address: '',
        province: '',
        city: '',
        companyStatus: d.companyStatus || '',
        industry: '',
        capital: '',
        establishDate: d.establishDate || '',
        businessScope: '',
        source: 'api'
      }));

      // 合并本地和API结果（API结果优先，去重）
      const merged = mergeCompanySearchResults(ledgerMatches, localMatches, apiResults);
      return res.json({ success: true, data: merged });
    } else {
      // API 返回错误，只返回本地数据
      return res.json({
        success: true,
        data: mergeCompanySearchResults(ledgerMatches, localMatches),
        apiError: result.msg || '查询无结果'
      });
    }
  } catch (err) {
    console.error('[company-search] 阿里云 API 调用失败:', err.message);
    // 降级：返回本地数据
    return res.json({
      success: true,
      data: mergeCompanySearchResults(ledgerMatches, localMatches),
      apiError: err.message
    });
  }
});

// ========== /企业信息查询 ==========

// ========== 批量导入功能 ==========

// 导入类型验证
const IMPORT_TYPES = ['partners', 'staff', 'registrations', 'opportunities'];

const EXPORT_TYPES = ['partners', 'staff', 'registrations', 'opportunities'];

const PARTNER_IMPORT_MAIN_HEADERS = ['渠道商名称*', '合作级别', '所在区域*', '所在城市*', '大区', '联系人', '联系电话', '邮箱', '技术服务商类型'];
const PARTNER_IMPORT_MAIN_KEYS = ['name', 'level', 'region', 'city', 'bigRegion', 'contact', 'phone', 'email', 'techServiceType'];
const PARTNER_IMPORT_PROFILE_COLUMNS = [
  { header: '地址', key: 'address' },
  { header: '老板', key: 'bossName' },
  { header: '老板联系方式', key: 'bossPhone' },
  { header: '成立时间', key: 'establishedAt' },
  { header: '企业员工数量', key: 'employeeCount' },
  { header: '注册资本', key: 'registeredCapital' },
  { header: '实缴资本', key: 'paidInCapital' },
  { header: '年营收额', key: 'annualRevenue' },
  { header: '社保参保人数', key: 'socialInsuranceCount' },
  { header: '经营状态', key: 'businessStatus' },
  { header: '开票能力', key: 'invoiceCapability' },
  { header: '法定代表人', key: 'legalRepresentative' },
  { header: '统一社会信用代码', key: 'unifiedSocialCreditCode' },
  { header: '经营范围', key: 'businessScope' },
  { header: '资料来源', key: 'dataSource' },
  { header: '主要客户或行业', key: 'customerIndustries', list: true },
  { header: '主要代理品牌', key: 'agencyBrands', list: true },
  { header: '授权产品线', key: 'authorizedProducts', list: true },
  { header: '资质认证', key: 'qualifications', list: true },
  { header: '典型客户', key: 'typicalCustomers', list: true },
  { header: '服务区域', key: 'serviceAreas', list: true },
  { header: '资料是否已核验', key: 'verified', boolean: true }
];
const PARTNER_IMPORT_PROFILE_HEADERS = PARTNER_IMPORT_PROFILE_COLUMNS.map(item => item.header);
const PARTNER_IMPORT_PROFILE_KEYS = PARTNER_IMPORT_PROFILE_COLUMNS.map(item => item.key);
const PARTNER_IMPORT_CLEAR_VALUES = new Set(['清空', '置空', '空值', '__CLEAR__']);
const PARTNER_IMPORT_DATE_KEYS = new Set(['establishedAt', 'expectedClose']);
const PARTNER_IMPORT_INVOICE_OPTIONS = ['可开增值税专用发票', '可开增值税普通发票', '专票和普票均可', '暂不支持开票', '待确认'];
const PARTNER_IMPORT_PROFILE_HEADER_ALIASES = {
  techServiceType: ['技术服务类型'],
  employeeCount: ['简介员工数量', '企业人数'],
  customerIndustries: ['主要客户行业', '主要客户/行业'],
  agencyBrands: ['代理品牌'],
  authorizedProducts: ['授权产品', '授权产品线'],
  qualifications: ['资质', '认证资质'],
  typicalCustomers: ['典型客户案例'],
  verified: ['资料已核验', '是否核验', '资料是否核验']
};
const PARTNER_EXPORT_PROFILE_HEADERS = PARTNER_IMPORT_PROFILE_HEADERS;

// Excel模板定义
const TEMPLATES = {
  partners: {
    name: '渠道商导入模板',
    headers: [...PARTNER_IMPORT_MAIN_HEADERS, ...PARTNER_IMPORT_PROFILE_HEADERS],
    keys: [...PARTNER_IMPORT_MAIN_KEYS, ...PARTNER_IMPORT_PROFILE_KEYS],
    required: ['name', 'region', 'city'],
    levels: ['lep', 'diamond', 'gold', 'silver', 'bronze', '行业总代'],
    headerAliases: PARTNER_IMPORT_PROFILE_HEADER_ALIASES
  },
  staff: {
    name: '员工导入模板',
    headers: ['登录账号*', '员工姓名*', '所属渠道商名称*', '密码*', '手机号', '邮箱', '状态'],
    keys: ['username', 'name', 'partnerName', 'password', 'phone', 'email', 'status'],
    required: ['username', 'name', 'partnerName', 'password']
  },
  registrations: {
    name: '客户报备导入模板',
    headers: ['客户名称*', '统一社会信用代码', '行业', '联系人', '联系电话', '负责员工姓名*', '所属渠道商名称*', '客户地址'],
    keys: ['customer', 'creditCode', 'industry', 'contact', 'phone', 'assignedStaffName', 'partnerName', 'address'],
    required: ['customer', 'assignedStaffName', 'partnerName']
  },
  opportunities: {
    name: '商机导入模板',
    headers: ['商机名称*', '客户名称*', '商机金额', '预计签约日期', '商机阶段', '行业', '联系人', '联系电话', '负责员工姓名*', '所属渠道商名称*', '备注'],
    keys: ['name', 'customer', 'amount', 'expectedClose', 'stage', 'industry', 'contact', 'phone', 'assignedStaffName', 'partnerName', 'remark'],
    required: ['name', 'customer', 'assignedStaffName', 'partnerName']
  }
};

const IMPORT_FIELD_LABELS = {
  name: '名称',
  level: '合作级别',
  region: '所在区域',
  city: '所在城市',
  username: '登录账号',
  partnerName: '所属渠道商名称',
  password: '密码',
  customer: '客户名称',
  assignedStaffName: '负责员工姓名'
};

function cleanupImportFile(req) {
  if (req?.file?.path) {
    try { fs.unlinkSync(req.file.path); } catch (err) {}
  }
}

function getImportHeaderKeyMap(template) {
  const headerKeyMap = {};
  template.headers.forEach((header, idx) => {
    headerKeyMap[header] = template.keys[idx];
    headerKeyMap[header.replace(/\*$/, '')] = template.keys[idx];
    headerKeyMap[`${header.replace(/\*$/, '')}*`] = template.keys[idx];
  });
  Object.entries(template.headerAliases || {}).forEach(([key, aliases]) => {
    aliases.forEach(alias => {
      headerKeyMap[alias] = key;
      headerKeyMap[alias.replace(/\*$/, '')] = key;
      headerKeyMap[`${alias.replace(/\*$/, '')}*`] = key;
    });
  });
  return headerKeyMap;
}

function normalizeImportHeader(header) {
  return String(header === undefined || header === null ? '' : header).trim();
}

function formatImportDateCell(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && value > 20000 && value < 80000 && XLSX.SSF?.parse_date_code) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return [
        String(parsed.y).padStart(4, '0'),
        String(parsed.m).padStart(2, '0'),
        String(parsed.d).padStart(2, '0')
      ].join('-');
    }
  }
  return String(value === undefined || value === null ? '' : value).trim();
}

function normalizeImportCellValue(value, key) {
  if (value === undefined || value === null) return '';
  if (PARTNER_IMPORT_DATE_KEYS.has(key)) return formatImportDateCell(value);
  return String(value).trim();
}

function parseImportRow(headers, row, headerKeyMap) {
  const item = {};
  for (let ci = 0; ci < headers.length; ci++) {
    const header = normalizeImportHeader(headers[ci]);
    const mappedKey = headerKeyMap[header];
    if (mappedKey) {
      item[mappedKey] = normalizeImportCellValue(row[ci], mappedKey);
    }
  }
  return item;
}

function getImportDisplayHeaders(headers, headerKeyMap) {
  return headers
    .map(normalizeImportHeader)
    .filter(header => header && headerKeyMap[header]);
}

function pushImportError(errors, message) {
  if (message && !errors.includes(message)) {
    errors.push(message);
  }
}

function resolveImportOperator(req) {
  const operator = getOperatorFromRequest(req);
  if (!operator) {
    return { operator: null, error: '缺少有效的导入操作人' };
  }
  if (operator.status && operator.status !== 'active') {
    return { operator: null, error: '导入操作人账号已停用' };
  }
  return { operator, error: '' };
}

function validateImportPermission(type, operator) {
  if (!operator || (operator.role !== 'superadmin' && operator.role !== 'admin')) {
    return '权限不足，仅管理员可以执行导入';
  }
  if (type === 'staff' && operator.role !== 'superadmin') {
    return '权限不足，员工账号导入仅允许超级管理员操作';
  }
  if (operator.role === 'admin' && !operator.region) {
    return '区域管理员缺少所属区域，无法执行导入';
  }
  return '';
}

function getImportPartnerRegionError(operator, partner, itemRegion, targetLabel) {
  if (!operator || operator.role !== 'admin') return '';
  if (itemRegion && itemRegion !== operator.region) {
    return `区域管理员只能导入本区域数据（${operator.region}）`;
  }
  if (partner && partner.region !== operator.region) {
    return `区域管理员不能导入或更新其他区域的${targetLabel || '数据'}`;
  }
  return '';
}

function resolveImportedStaffStatus(status) {
  return (status && STAFF_STATUS[status]) ? STAFF_STATUS[status] : 'active';
}

function isImportBlankValue(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function isImportClearValue(value) {
  return PARTNER_IMPORT_CLEAR_VALUES.has(String(value === undefined || value === null ? '' : value).trim());
}

function normalizeImportedInvoiceCapability(value) {
  const rawValue = normalizeTrimmedString(value);
  if (!rawValue || isImportClearValue(rawValue)) return rawValue;
  const normalizedValue = rawValue.replace(/\s+/g, '');
  const aliasMap = {
    '可开增值税专用发票': '可开增值税专用发票',
    '增值税专用发票': '可开增值税专用发票',
    '专票': '可开增值税专用发票',
    '可开专票': '可开增值税专用发票',
    '可开增值税普通发票': '可开增值税普通发票',
    '增值税普通发票': '可开增值税普通发票',
    '普票': '可开增值税普通发票',
    '可开普票': '可开增值税普通发票',
    '专票和普票均可': '专票和普票均可',
    '专普票均可': '专票和普票均可',
    '均可': '专票和普票均可',
    '都可以': '专票和普票均可',
    '暂不支持开票': '暂不支持开票',
    '不支持开票': '暂不支持开票',
    '不能开票': '暂不支持开票',
    '待确认': '待确认',
    '待定': '待确认'
  };
  return aliasMap[normalizedValue] || '';
}

function normalizeImportedBooleanValue(value) {
  const rawValue = normalizeTrimmedString(value);
  if (!rawValue) return '';
  if (isImportClearValue(rawValue)) return false;
  const normalizedValue = rawValue.toLowerCase();
  if (['是', '已核验', '已验证', 'true', '1', 'yes', 'y'].includes(normalizedValue)) return true;
  if (['否', '未核验', '未验证', 'false', '0', 'no', 'n'].includes(normalizedValue)) return false;
  return null;
}

function buildPartnerImportProfilePayload(item) {
  const payload = {};

  PARTNER_IMPORT_PROFILE_COLUMNS.forEach(column => {
    if (!Object.prototype.hasOwnProperty.call(item, column.key)) return;
    const value = item[column.key];
    if (isImportBlankValue(value)) return;

    if (column.boolean) {
      const normalizedValue = normalizeImportedBooleanValue(value);
      if (normalizedValue !== null && normalizedValue !== '') {
        payload[column.key] = normalizedValue;
      }
      return;
    }

    if (isImportClearValue(value)) {
      payload[column.key] = column.list ? [] : '';
      return;
    }

    payload[column.key] = value;
  });

  return payload;
}

function syncImportedPartnerProfile(partner, item, operator) {
  if (!partner) return false;
  const payload = buildPartnerImportProfilePayload(item);
  if (!hasPartnerProfileInput(payload)) return false;

  const profile = getPartnerProfile(partner.id);
  applyPartnerProfileBasicUpdates(profile, payload);

  if (Object.prototype.hasOwnProperty.call(payload, 'verified')) {
    profile.verified = payload.verified === true || payload.verified === 'true';
  }

  profile.updatedBy = operator?.id || '';
  profile.updatedByName = operator?.name || '';
  profile.updatedAt = new Date().toISOString();
  return true;
}

function validateImportItem(type, item, operator) {
  const template = TEMPLATES[type];
  const errors = [];

  template.required.forEach(field => {
    if (!item[field] || item[field] === '') {
      pushImportError(errors, `缺少必填字段: ${IMPORT_FIELD_LABELS[field] || field}`);
    }
  });

  if (type === 'partners') {
    const rawLevel = item.level;
    const isBlankLevel = isImportedPartnerLevelBlankValue(rawLevel);
    item.level = normalizeImportedPartnerLevel(rawLevel);
    item.techServiceType = normalizeImportedTechServiceType(item.techServiceType);

    if (Object.prototype.hasOwnProperty.call(item, 'invoiceCapability') && !isImportBlankValue(item.invoiceCapability) && !isImportClearValue(item.invoiceCapability)) {
      const normalizedInvoiceCapability = normalizeImportedInvoiceCapability(item.invoiceCapability);
      if (!normalizedInvoiceCapability) {
        pushImportError(errors, `开票能力无效，请填写：${PARTNER_IMPORT_INVOICE_OPTIONS.join('、')}`);
      } else {
        item.invoiceCapability = normalizedInvoiceCapability;
      }
    }

    if (Object.prototype.hasOwnProperty.call(item, 'verified') && !isImportBlankValue(item.verified)) {
      const normalizedVerified = normalizeImportedBooleanValue(item.verified);
      if (normalizedVerified === null) {
        pushImportError(errors, '资料是否已核验无效，请填写 是/否');
      } else {
        item.verified = normalizedVerified;
      }
    }

    const cityValidation = validatePartnerCity(item.city);
    if (!cityValidation.valid) {
      pushImportError(errors, cityValidation.error);
    } else {
      item.city = cityValidation.city;
    }

    if (!isBlankLevel && !item.level) {
      pushImportError(errors, '合作级别无效，请填写 lep/diamond/gold/silver/bronze/行业总代，或留空');
    }

    const existing = item.name ? db.partners.find(p => p.name === item.name) : null;
    const regionError = getImportPartnerRegionError(operator, existing, item.region, '渠道商');
    if (regionError) pushImportError(errors, regionError);
  } else if (type === 'staff') {
    const partner = item.partnerName ? db.partners.find(p => p.name === item.partnerName) : null;
    if (item.partnerName && !partner) {
      pushImportError(errors, `渠道商"${item.partnerName}"不存在`);
    }

    const existing = item.username ? db.users.find(u => u.username === item.username) : null;
    if (existing && existing.role !== 'staff' && existing.role !== 'partner_admin') {
      pushImportError(errors, `账号"${item.username}"已存在且不是渠道员工账号`);
    }
  } else if (type === 'registrations') {
    const partner = item.partnerName ? db.partners.find(p => p.name === item.partnerName) : null;
    if (item.partnerName && !partner) {
      pushImportError(errors, `渠道商"${item.partnerName}"不存在`);
    }

    const regionError = getImportPartnerRegionError(operator, partner, '', '客户报备');
    if (regionError) pushImportError(errors, regionError);

    if (partner && item.assignedStaffName) {
      const staff = db.users.find(u => u.name === item.assignedStaffName && u.partnerId === partner.id && (u.role === 'staff' || u.role === 'partner_admin'));
      if (!staff) {
        pushImportError(errors, `渠道商"${item.partnerName}"下不存在员工"${item.assignedStaffName}"`);
      }
    }
  } else if (type === 'opportunities') {
    item.stage = normalizeImportedOpportunityStage(item.stage);

    const partner = item.partnerName ? db.partners.find(p => p.name === item.partnerName) : null;
    if (item.partnerName && !partner) {
      pushImportError(errors, `渠道商"${item.partnerName}"不存在`);
    }

    const regionError = getImportPartnerRegionError(operator, partner, '', '商机');
    if (regionError) pushImportError(errors, regionError);

    if (partner && item.assignedStaffName) {
      const staff = db.users.find(u => u.name === item.assignedStaffName && u.partnerId === partner.id && (u.role === 'staff' || u.role === 'partner_admin'));
      if (!staff) {
        pushImportError(errors, `渠道商"${item.partnerName}"下不存在员工"${item.assignedStaffName}"`);
      }
    }

    if (item.customer) {
      const reg = db.registrations.find(r => r.customer === item.customer && r.status === 'approved');
      if (!reg) {
        pushImportError(errors, `客户"${item.customer}"尚未报备或报备未通过审批`);
      }
    }
  }

  return { item, errors };
}

function syncImportedStaffToPartner(user, partner, item, status) {
  if (!user || !partner) return;

  db.partners.forEach(p => {
    if (p.id !== partner.id && Array.isArray(p.staff)) {
      p.staff = p.staff.filter(s => s.userId !== user.id && s.username !== user.username);
    }
  });

  if (!partner.staff) partner.staff = [];
  let staffRecord = partner.staff.find(s => s.userId === user.id || s.username === user.username);
  if (!staffRecord) {
    const prefix = partner.id.replace('P', 'S') + '-';
    const seq = String(partner.staff.length + 1).padStart(2, '0');
    staffRecord = { id: prefix + seq, userId: user.id };
    partner.staff.push(staffRecord);
  }

  staffRecord.userId = user.id;
  staffRecord.username = user.username;
  staffRecord.name = user.name;
  staffRecord.role = staffRecord.role || user.staffRole || '销售代表';
  staffRecord.phone = item.phone || user.phone || '';
  staffRecord.email = item.email || user.email || '';
  staffRecord.status = status;
}

const EXPORT_CONFIGS = {
  partners: {
    fileName: '渠道商导出.xlsx',
    sheetName: '渠道商',
    headers: ['渠道商ID', '渠道商名称', '合作级别', '渠道分销层级', '所在区域', '所在城市', '大区', '联系人', '联系电话', '邮箱', '技术服务类型', '状态', '加入日期', '员工数量', '报价数', '订单数', '累计金额', ...PARTNER_EXPORT_PROFILE_HEADERS]
  },
  staff: {
    fileName: '员工账号导出.xlsx',
    sheetName: '员工账号',
    headers: ['用户ID', '登录账号', '姓名', '角色', '所属渠道商ID', '所属渠道商名称', '区域', '大区', '手机', '邮箱', '状态', '创建时间']
  },
  registrations: {
    fileName: '客户报备导出.xlsx',
    sheetName: '客户报备',
    headers: ['报备ID', '客户名称', '统一社会信用代码', '行业', '联系人', '联系电话', '区域', '渠道商ID', '渠道商名称', '跟进员工ID', '跟进员工姓名', '状态', '报备日期', '保护到期日', '保护天数', '备注']
  },
  opportunities: {
    fileName: '商机导出.xlsx',
    sheetName: '商机',
    headers: ['商机ID', '商机名称', '客户名称', '行业', '联系人', '联系电话', '区域', '渠道商ID', '渠道商名称', '跟进员工ID', '跟进员工姓名', '阶段', '金额', '预计签约日期', '最近跟进日期', '来源', '标签', '备注', '创建时间']
  }
};

function isImportedPartnerLevelBlankValue(level) {
  const rawLevel = level !== undefined && level !== null ? String(level).trim() : '';
  return ['', '/', '-', '空', '空白', '空白值', '无', '无级别', '未设置', '未填写'].includes(rawLevel);
}

function normalizeImportedPartnerLevel(level) {
  const rawLevel = level !== undefined && level !== null ? String(level).trim() : '';
  if (isImportedPartnerLevelBlankValue(rawLevel)) return '';

  const normalizedLevel = rawLevel.toLowerCase();
  const levelAlias = {
    'lep': 'lep',
    '钻石': 'diamond',
    'diamond': 'diamond',
    '金牌': 'gold',
    'gold': 'gold',
    '银牌': 'silver',
    'silver': 'silver',
    '铜牌': 'bronze',
    'bronze': 'bronze',
    '行业总代': 'industry',
    'industry': 'industry'
  };

  return levelAlias[normalizedLevel] || '';
}

function normalizeImportedTechServiceType(type) {
  const rawType = type !== undefined && type !== null ? String(type).trim() : '';
  if (!rawType || rawType === '/' || rawType === '-') return '';

  const normalizedType = rawType.toLowerCase();
  const typeAlias = {
    'developing': 'developing',
    'full': 'full',
    '提名技术服务商': 'developing',
    '签约技术服务商': 'full',
    '发展中技术服务商': 'developing',
    '正式技术服务商': 'full'
  };

  return typeAlias[normalizedType] || '';
}

function normalizeImportedOpportunityStage(stage) {
  const rawStage = stage !== undefined && stage !== null ? String(stage).trim() : '';
  if (!rawStage) return 'contacted';

  const normalizedStage = rawStage.replace(/\s+/g, '');
  const stageAlias = {
    'contacted': 'contacted',
    'registered': 'registered',
    'quoted': 'quoted',
    'budget': 'budget',
    'design': 'design',
    'testing': 'testing',
    'negotiation': 'negotiation',
    'won': 'won',
    'cancelled': 'cancelled',
    'lost': 'lost',
    '已联系上客户': 'contacted',
    '1%已联系上客户': 'contacted',
    '商机明确并报备': 'registered',
    '10%商机明确并报备': 'registered',
    '正式报价': 'quoted',
    '20%正式报价': 'quoted',
    '明确预算': 'budget',
    '30%明确预算': 'budget',
    '技术交流/方案设计': 'design',
    '40%技术交流/方案设计': 'design',
    '产品测试': 'testing',
    '50%产品测试': 'testing',
    '招投标/商务谈判': 'negotiation',
    '70%招投标/商务谈判': 'negotiation',
    '赢单': 'won',
    '100%赢单': 'won',
    '项目取消': 'cancelled',
    '输单': 'lost',
    '1%联系上客户': 'contacted',
    '10%见到客户并且感兴趣': 'registered',
    '10%见到客户并感兴趣': 'registered',
    '10%客户见面并有兴趣': 'registered',
    '10%客户见面且有兴趣': 'registered',
    '20%正式报价': 'quoted',
    '30%客户进行测试': 'testing',
    '30%进行测试': 'testing',
    '40%技术交流': 'design',
    '40%方案设计': 'design',
    '50%客户进行测试': 'testing',
    '初步接触': 'contacted',
    '需求沟通': 'budget',
    '方案报价': 'quoted',
    '商务谈判': 'negotiation',
    '合同签订': 'won',
    '失败': 'lost'
  };

  if (stageAlias[normalizedStage]) {
    return stageAlias[normalizedStage];
  }

  if (normalizedStage.includes('取消')) return 'cancelled';
  if (normalizedStage.includes('输单') || normalizedStage.includes('失败')) return 'lost';
  if (normalizedStage.includes('赢单') || normalizedStage.includes('签约') || normalizedStage.includes('合同')) return 'won';
  if (normalizedStage.includes('招投标') || normalizedStage.includes('谈判')) return 'negotiation';
  if (normalizedStage.includes('测试')) return 'testing';
  if (normalizedStage.includes('方案') || normalizedStage.includes('技术交流')) return 'design';
  if (normalizedStage.includes('预算')) return 'budget';
  if (normalizedStage.includes('报价')) return 'quoted';
  if (normalizedStage.includes('报备') || normalizedStage.includes('见到客户') || normalizedStage.includes('见面') || normalizedStage.includes('感兴趣')) return 'registered';
  if (normalizedStage.includes('联系')) return 'contacted';

  return 'contacted';
}

// 商机阶段映射（与前端 STAGES 定义保持一致）
const OPP_STAGES = {
  '已联系上客户': 'contacted',
  '1% 已联系上客户': 'contacted',
  '商机明确并报备': 'registered',
  '10% 商机明确并报备': 'registered',
  '正式报价': 'quoted',
  '20% 正式报价': 'quoted',
  '明确预算': 'budget',
  '30% 明确预算': 'budget',
  '技术交流/方案设计': 'design',
  '40% 技术交流/方案设计': 'design',
  '产品测试': 'testing',
  '50% 产品测试': 'testing',
  '招投标/商务谈判': 'negotiation',
  '70% 招投标/商务谈判': 'negotiation',
  '赢单': 'won',
  '100% 赢单': 'won',
  '项目取消': 'cancelled',
  '输单': 'lost',
  // 兼容旧模板的简写阶段名
  '初步接触': 'contacted',
  '需求沟通': 'budget',
  '方案报价': 'quoted',
  '商务谈判': 'negotiation',
  '合同签订': 'won',
  '失败': 'lost'
};

// 状态映射（销售/售前/技术等岗位统一视为active）
const STAFF_STATUS = {
  '正常': 'active',
  '停用': 'inactive',
  '销售': 'active',
  '售前': 'active',
  '技术': 'active',
  '售后': 'active'
};

function normalizeExportUserParams(query = {}) {
  return {
    userId: query.userId || '',
    userRole: query.userRole || '',
    region: query.region || '',
    partnerId: query.partnerId || '',
    status: query.status || '',
    role: query.role || '',
    level: query.level || '',
    keyword: (query.keyword || '').trim(),
    stage: query.stage || ''
  };
}

function exportLevelLabel(level) {
  return {
    lep: 'LEP',
    diamond: '钻石',
    gold: '金牌',
    silver: '银牌',
    bronze: '铜牌',
    industry: '行业总代'
  }[level] || level || '';
}

function exportPartnerLevelLabel(level) {
  return {
    primary: '一级渠道商',
    secondary: '二级渠道商',
    none: '无层级'
  }[level] || level || '';
}

function exportStatusLabel(status) {
  return {
    active: '正常',
    inactive: '停用',
    disabled: '停用',
    pending: '待审批',
    reviewing: '审核中',
    approved: '已通过',
    expired: '已过期',
    rejected: '已拒绝'
  }[status] || status || '';
}

function exportTechServiceTypeLabel(type) {
  return {
    none: '',
    developing: '提名技术服务商',
    full: '签约技术服务商'
  }[type] || type || '';
}

function exportOpportunityStageLabel(stage) {
  return {
    contacted: '1% 已联系上客户',
    registered: '10% 客户见面并有兴趣',
    quoted: '20% 正式报价',
    budget: '30% 明确预算',
    design: '40% 技术交流/方案设计',
    testing: '50% 进行测试',
    negotiation: '70% 招投标/商务谈判',
    won: '100% 赢单',
    cancelled: '项目取消',
    lost: '输单'
  }[stage] || stage || '';
}

function buildExportUsers(params) {
  const { userId, userRole, role, region, partnerId, status, keyword } = params;
  let list = db.users.filter(u => u.role !== 'superadmin');

  if (role === 'admin') {
    list = list.filter(u => u.role === 'admin');
  } else {
    list = list.filter(u => u.role === 'staff' || u.role === 'partner_admin');
  }

  if (role !== 'admin') {
    if (userRole === 'admin' && region) {
      list = list.filter(u => u.region === region);
    } else if ((userRole === 'staff' || userRole === 'partner_admin') && userId) {
      const currentUser = db.users.find(u => u.id === userId);
      if (currentUser?.partnerId) {
        list = list.filter(u => u.partnerId === currentUser.partnerId);
      } else {
        list = [];
      }
    }
  }

  if (region) {
    list = list.filter(u => u.region === region);
  }
  if (partnerId) {
    list = list.filter(u => u.partnerId === partnerId);
  }
  if (status) {
    list = list.filter(u => u.status === status);
  }
  if (keyword) {
    list = list.filter(u =>
      (u.username && u.username.includes(keyword)) ||
      (u.name && u.name.includes(keyword)) ||
      (u.partnerName && u.partnerName.includes(keyword))
    );
  }

  return list
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map(u => {
      const partner = u.partnerId ? db.partners.find(p => p.id === u.partnerId) : null;
      const staff = partner?.staff?.find(s => s.userId === u.id || s.username === u.username);
      return {
        ...u,
        phone: u.phone || staff?.phone || '',
        email: u.email || staff?.email || '',
        staffRole: staff?.role || ''
      };
    });
}

function buildExportPartners(params) {
  const { userId, userRole, region, partnerId, status, level, keyword } = params;
  let list = db.partners.slice();

  if (userRole === 'admin' && region) {
    list = list.filter(p => {
      if (p.status === 'active' && p.region === region) return true;
      if (p.status === 'pending' && p.createdBy === userId) return true;
      return false;
    });
  } else if ((userRole === 'staff' || userRole === 'partner_admin') && userId) {
    const user = db.users.find(u => u.id === userId);
    if (user?.partnerId) {
      list = list.filter(p => p.id === user.partnerId);
    } else {
      list = [];
    }
  } else if (partnerId) {
    list = list.filter(p =>
      p.id === partnerId ||
      p.parentPartnerId === partnerId ||
      (p.parentPartnerIds && p.parentPartnerIds.includes(partnerId))
    );
  }

  if (status) {
    list = list.filter(p => p.status === status);
  }
  if (level) {
    list = list.filter(p => p.level === level);
  }
  if (keyword) {
    list = list.filter(p =>
      (p.name && p.name.includes(keyword)) ||
      (p.contact && p.contact.includes(keyword)) ||
      (p.phone && p.phone.includes(keyword)) ||
      (p.city && p.city.includes(keyword))
    );
  }

  return list
    .slice()
    .sort((a, b) => new Date(b.joinDate || 0) - new Date(a.joinDate || 0))
    .map(p => syncTechServiceType({ ...p }));
}

function buildExportRegistrations(params) {
  const { userId, userRole, region, partnerId, status, keyword } = params;
  let list = db.registrations.slice();

  if (userRole === 'staff' && userId) {
    list = list.filter(r => isRecordRelatedToUser(r, userId, ['createdBy', 'owner', 'assignedStaffId']));
  }
  if (region) {
    list = list.filter(r => r.region === region);
  }
  if (status) {
    list = list.filter(r => r.status === status);
  }

  list = list.map(r => {
    const enriched = enrichAssignedStaffForRead({ ...r });
    if (!enriched.partnerId && enriched.assignedStaffId) {
      const userInfo = getUserInfo(enriched.assignedStaffId);
      if (userInfo.partnerId) {
        enriched.partnerId = userInfo.partnerId;
        enriched.partnerName = userInfo.partnerName;
      }
      if (userInfo.name) {
        enriched.assignedStaffName = userInfo.name;
      }
    }
    if (enriched.createdBy) {
      const userInfo = getUserInfo(enriched.createdBy);
      if (userInfo.name) enriched.createdByName = userInfo.name;
      if (!enriched.partnerId && userInfo.partnerId) {
        enriched.partnerId = userInfo.partnerId;
        enriched.partnerName = userInfo.partnerName;
      }
    }
    if (!enriched.partnerId && enriched.assignedPartnerId) {
      enriched.partnerId = enriched.assignedPartnerId;
      if (enriched.assignedPartnerName) enriched.partnerName = enriched.assignedPartnerName;
    }
    if (!enriched.partnerId && enriched.regId) {
      const opp = db.opportunities.find(o => o.regId === enriched.regId);
      if (opp?.partnerId) {
        enriched.partnerId = opp.partnerId;
        enriched.partnerName = opp.partnerName;
      }
    }
    return enriched;
  });

  if (partnerId) {
    list = list.filter(r => r.partnerId === partnerId);
  }
  if (keyword) {
    list = list.filter(r =>
      (r.customer && r.customer.includes(keyword)) ||
      (r.contact && r.contact.includes(keyword)) ||
      (r.partnerName && r.partnerName.includes(keyword)) ||
      (r.assignedPartnerName && r.assignedPartnerName.includes(keyword))
    );
  }

  return list.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function buildExportOpportunities(params) {
  const { userId, userRole, region, partnerId, stage, keyword } = params;
  let list = db.opportunities.slice();

  if (userRole === 'staff' && userId) {
    list = list.filter(o => isRecordRelatedToUser(o, userId));
  }
  if (region) {
    list = list.filter(o => o.region === region);
  }
  if (stage) {
    list = list.filter(o => o.stage === stage);
  }

  list = list.map(o => {
    const enriched = enrichAssignedStaffForRead({ ...o });
    if (!enriched.partnerId && enriched.assignedStaffId) {
      const userInfo = getUserInfo(enriched.assignedStaffId);
      if (userInfo.partnerId) {
        enriched.partnerId = userInfo.partnerId;
        enriched.partnerName = userInfo.partnerName;
        enriched.assignedPartnerId = userInfo.partnerId;
        enriched.assignedPartnerName = userInfo.partnerName;
      }
      if (userInfo.name) {
        enriched.assignedStaffName = userInfo.name;
      }
    }
    if (enriched.createdBy) {
      const userInfo = getUserInfo(enriched.createdBy);
      if (userInfo.name) enriched.createdByName = userInfo.name;
      if (!enriched.partnerId && userInfo.partnerId) {
        enriched.partnerId = userInfo.partnerId;
        enriched.partnerName = userInfo.partnerName;
      }
    }
    if (enriched.assignedStaffId && !enriched.assignedStaffName) {
      const userInfo = getUserInfo(enriched.assignedStaffId);
      if (userInfo.name) {
        enriched.assignedStaffName = userInfo.name;
      } else if (enriched.createdByName) {
        enriched.assignedStaffName = enriched.createdByName;
      }
    }
    if (!enriched.partnerId && enriched.ownerId) {
      const userInfo = getUserInfo(enriched.ownerId);
      if (userInfo.partnerId) {
        enriched.partnerId = userInfo.partnerId;
        enriched.partnerName = userInfo.partnerName;
      }
    }
    if (!Array.isArray(enriched.followUps)) enriched.followUps = [];
    if (!Array.isArray(enriched.tags)) enriched.tags = [];
    return enriched;
  });

  if (partnerId) {
    list = list.filter(o => o.partnerId === partnerId);
  }
  if (keyword) {
    list = list.filter(o =>
      (o.name && o.name.includes(keyword)) ||
      (o.customer && o.customer.includes(keyword)) ||
      (o.contact && o.contact.includes(keyword)) ||
      (o.partnerName && o.partnerName.includes(keyword)) ||
      (o.assignedPartnerName && o.assignedPartnerName.includes(keyword))
    );
  }

  return list.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function joinExportList(value) {
  return normalizeStringList(value).join('、');
}

function getPartnerProfileExtendedField(profile, field) {
  ensurePartnerProfileCompatibility(profile);
  return profile.extended?.[field] || '';
}

function buildExportPartnerProfileRow(partner) {
  const profile = getPartnerProfile(partner.id, false);
  return [
    profile.address || '',
    profile.bossName || partner.contact || '',
    profile.bossPhone || partner.phone || '',
    profile.establishedAt || partner.joinDate || '',
    profile.employeeCount || (Array.isArray(partner.staff) ? partner.staff.length : ''),
    getPartnerProfileExtendedField(profile, 'registeredCapital'),
    getPartnerProfileExtendedField(profile, 'paidInCapital'),
    profile.annualRevenue || '',
    getPartnerProfileExtendedField(profile, 'socialInsuranceCount'),
    getPartnerProfileExtendedField(profile, 'businessStatus'),
    profile.invoiceCapability || '',
    getPartnerProfileExtendedField(profile, 'legalRepresentative'),
    getPartnerProfileExtendedField(profile, 'unifiedSocialCreditCode'),
    getPartnerProfileExtendedField(profile, 'businessScope'),
    getPartnerProfileExtendedField(profile, 'dataSource'),
    joinExportList(profile.customerIndustries),
    joinExportList(profile.agencyBrands),
    joinExportList(profile.authorizedProducts),
    joinExportList(profile.qualifications),
    joinExportList(profile.typicalCustomers),
    joinExportList(normalizeStringList(profile.serviceAreas).length ? profile.serviceAreas : [partner.city, partner.region]),
    profile.verified ? '是' : '否'
  ];
}

function buildExportRows(type, items) {
  if (type === 'partners') {
    return items.map(p => [
      p.id || '',
      p.name || '',
      exportLevelLabel(p.level),
      exportPartnerLevelLabel(p.partnerLevel),
      p.region || '',
      p.city || '',
      p.bigRegion || '',
      p.contact || '',
      p.phone || '',
      p.email || '',
      exportTechServiceTypeLabel(p.techServiceType),
      exportStatusLabel(p.status),
      p.joinDate || '',
      Array.isArray(p.staff) ? p.staff.length : 0,
      p.quoteCount || 0,
      p.orderCount || 0,
      p.totalAmt || 0,
      ...buildExportPartnerProfileRow(p)
    ]);
  }

  if (type === 'staff') {
    return items.map(u => [
      u.id || '',
      u.username || '',
      u.name || '',
      u.role === 'partner_admin' ? '企业管理员' : (u.staffRole || '员工'),
      u.partnerId || '',
      u.partnerName || '',
      u.region || '',
      u.bigRegion || '',
      u.phone || '',
      u.email || '',
      exportStatusLabel(u.status),
      u.createdAt || ''
    ]);
  }

  if (type === 'registrations') {
    return items.map(r => [
      r.id || '',
      r.customer || '',
      r.creditCode || '',
      r.industry || '',
      r.contact || '',
      r.phone || '',
      r.region || '',
      r.assignedPartnerId || r.partnerId || '',
      r.assignedPartnerName || r.partnerName || '',
      r.assignedStaffId || '',
      r.assignedStaffName || '',
      exportStatusLabel(r.status),
      r.createdAt || '',
      r.expireAt || '',
      r.protectDays || '',
      r.notes || r.remark || ''
    ]);
  }

  if (type === 'opportunities') {
    return items.map(o => [
      o.id || '',
      o.name || '',
      o.customer || '',
      o.industry || '',
      o.contact || '',
      o.phone || '',
      o.region || '',
      o.assignedPartnerId || o.partnerId || '',
      o.assignedPartnerName || o.partnerName || '',
      o.assignedStaffId || '',
      o.assignedStaffName || o.owner || '',
      exportOpportunityStageLabel(o.stage),
      o.amount || 0,
      o.expectedClose || '',
      o.lastFollowAt || '',
      o.source || '',
      Array.isArray(o.tags) ? o.tags.join('、') : '',
      o.notes || '',
      o.createdAt || ''
    ]);
  }

  return [];
}

app.get('/api/export/:type', (req, res) => {
  const { type } = req.params;

  if (!EXPORT_TYPES.includes(type)) {
    return res.status(400).json({ success: false, error: '不支持的导出类型' });
  }

  try {
    const params = normalizeExportUserParams(req.query);
    const config = EXPORT_CONFIGS[type];
    let items = [];

    if (type === 'partners') {
      items = buildExportPartners(params);
    } else if (type === 'staff') {
      items = buildExportUsers({ ...params, role: 'staff' });
    } else if (type === 'registrations') {
      items = buildExportRegistrations(params);
    } else if (type === 'opportunities') {
      items = buildExportOpportunities(params);
    }

    const wb = XLSX.utils.book_new();
    const rows = buildExportRows(type, items);
    const ws = XLSX.utils.aoa_to_sheet([config.headers, ...rows]);
    ws['!cols'] = config.headers.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, config.sheetName);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const exportAuditMap = {
      partners: { module: 'partner', targetType: 'partner', message: '导出渠道商列表' },
      staff: { module: 'account', targetType: 'user', message: '导出员工账号列表' },
      registrations: { module: 'registration', targetType: 'registration', message: '导出客户报备列表' },
      opportunities: { module: 'opportunity', targetType: 'opportunity', message: '导出商机列表' }
    };
    const exportAuditConfig = exportAuditMap[type] || {
      module: 'export',
      targetType: 'export',
      message: `导出${type}`
    };

    writeAuditLog(req, {
      module: exportAuditConfig.module,
      action: 'export',
      targetType: exportAuditConfig.targetType,
      targetId: type,
      targetName: config.fileName,
      result: 'success',
      message: exportAuditConfig.message,
      extra: {
        params: cloneAuditValue(req.params || {}),
        query: cloneAuditValue(req.query || {}),
        resultMeta: {
          success: true,
          count: items.length,
          fileName: config.fileName,
          sheetName: config.sheetName
        }
      }
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(config.fileName)}`);
    res.send(buffer);
  } catch (err) {
    console.error('[export] 导出失败:', err);
    res.status(500).json({ success: false, error: '导出失败: ' + err.message });
  }
});

// 下载导入模板
app.get('/api/import/:type/template', (req, res) => {
  const { type } = req.params;
  
  if (!IMPORT_TYPES.includes(type)) {
    return res.status(400).json({ success: false, error: '不支持的导入类型' });
  }
  
  const template = TEMPLATES[type];
  
  // 创建工作簿
  const wb = XLSX.utils.book_new();
  
  // 创建示例数据行
  const exampleData = [];
  if (type === 'partners') {
    exampleData.push([
      '示例渠道商',
      'gold',
      '北区（政府企业）',
      '北京市',
      '大北区',
      '张总',
      '13800138000',
      'example@test.com',
      '提名技术服务商',
      '北京市海淀区示例路 88 号',
      '张总',
      '13800138000',
      '2018-06-01',
      '86 人',
      '3000 万元',
      '1800 万元',
      '5000 万元',
      '72 人',
      '存续',
      '专票和普票均可',
      '张三',
      '91110000XXXXXXXXXX',
      '软件销售、技术服务、系统集成',
      '渠道导入',
      '教育、医疗、制造',
      '联软、华为',
      '终端安全、安全网关',
      '信息安全服务资质、ISO9001',
      '某教育集团、某三甲医院',
      '北京市、北区（政府企业）',
      '是'
    ]);
  } else if (type === 'staff') {
    exampleData.push(['zhangsan', '张三', '北京安盾网络', '123456', '13800138000', 'zhangsan@test.com', '正常']);
  } else if (type === 'registrations') {
    exampleData.push(['示例客户公司', '91110000XXXXXXXXXX', '科技', '李经理', '13800138001', '刘建国', '北京安盾网络', '北京市朝阳区']);
  } else if (type === 'opportunities') {
    exampleData.push(['XX公司安全项目', '示例客户公司', '50000', '2026-06-30', '1% 已联系上客户', '科技', '李经理', '13800138001', '刘建国', '北京安盾网络', '重要项目']);
  }
  
  // 添加表头和示例
  const wsData = [template.headers, ...exampleData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // 设置列宽
  ws['!cols'] = template.headers.map(() => ({ wch: 20 }));
  
  XLSX.utils.book_append_sheet(wb, ws, template.name);

  if (type === 'partners') {
    const guideData = [
      ['渠道商导入填写说明'],
      ['1. 兼容旧模板：只保留主档字段也可以导入，新增简介字段全部为选填。'],
      ['2. 已存在渠道商按“渠道商名称”更新；不存在则新增。'],
      ['3. 简介字段空白时不覆盖已有资料；如需清空简介字段，请填写“清空”或“__CLEAR__”。'],
      ['4. 多值字段可用顿号、逗号或换行分隔，例如：教育、医疗、制造。'],
      [`5. 开票能力可选：${PARTNER_IMPORT_INVOICE_OPTIONS.join('、')}。`],
      ['6. 资料是否已核验请填写：是 或 否。'],
      ['7. 区域管理员只能导入或更新本区域渠道商。']
    ];
    const guideSheet = XLSX.utils.aoa_to_sheet(guideData);
    guideSheet['!cols'] = [{ wch: 90 }];
    XLSX.utils.book_append_sheet(wb, guideSheet, '填写说明');
  }
  
  // 商机导入模板添加"阶段选项说明"工作表
  if (type === 'opportunities') {
    const stageRefData = [
      ['商机阶段可选值（请填写以下文字，填入"商机阶段"列）'],
      ['阶段名称', '说明'],
      ['1% 已联系上客户', '初次联系到客户'],
      ['10% 商机明确并报备', '商机已明确并完成报备'],
      ['20% 正式报价', '已向客户正式报价'],
      ['30% 明确预算', '客户已明确预算'],
      ['40% 技术交流/方案设计', '进行技术交流或方案设计'],
      ['50% 产品测试', '客户进行产品测试'],
      ['70% 招投标/商务谈判', '进入招投标或商务谈判阶段'],
      ['100% 赢单', '项目赢单'],
      ['项目取消', '项目被取消'],
      ['输单', '项目输单'],
      [''],
      ['简写也支持：已联系上客户、商机明确并报备、正式报价、明确预算、技术交流/方案设计、产品测试、招投标/商务谈判、赢单、项目取消、输单']
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(stageRefData);
    wsRef['!cols'] = [{ wch: 35 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsRef, '阶段选项说明');
  }
  
  // 生成buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  // 设置响应头
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(template.name)}.xlsx`);
  
  res.send(buffer);
});

// 预览解析Excel（不保存）
app.post('/api/import/:type/preview', upload.single('file'), (req, res) => {
  const { type } = req.params;
  
  if (!IMPORT_TYPES.includes(type)) {
    cleanupImportFile(req);
    return res.status(400).json({ success: false, error: '不支持的导入类型' });
  }
  
  if (!req.file) {
    return res.status(400).json({ success: false, error: '请上传Excel文件' });
  }

  const { operator, error: operatorError } = resolveImportOperator(req);
  if (operatorError) {
    cleanupImportFile(req);
    return res.status(403).json({ success: false, error: operatorError });
  }
  const permissionError = validateImportPermission(type, operator);
  if (permissionError) {
    cleanupImportFile(req);
    return res.status(403).json({ success: false, error: permissionError });
  }
  
  try {
    // 解析Excel
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (data.length < 2) {
      // 清理临时文件
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'Excel文件内容为空或格式不正确' });
    }
    
    const template = TEMPLATES[type];
    const headers = data[0];
    const rows = data.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== null && cell !== ''));
    
    // 解析每行数据
    // 建立中文表头 -> 英文key的映射
    const headerKeyMap = getImportHeaderKeyMap(template);

    const parsedData = rows.map((row, index) => {
      const rawItem = parseImportRow(headers, row, headerKeyMap);
      const { item, errors } = validateImportItem(type, rawItem, operator);
      
      return {
        rowIndex: index + 2, // Excel行号（1是表头）
        data: item,
        errors: errors
      };
    });
    
    // 清理临时文件
    fs.unlinkSync(req.file.path);
    
    const previewLimit = 50;
    const errorCount = parsedData.filter(item => item.errors.length > 0).length;

    res.json({
      success: true,
      preview: parsedData.slice(0, previewLimit),
      totalCount: rows.length,
      previewCount: Math.min(parsedData.length, previewLimit),
      errorCount,
      headers: getImportDisplayHeaders(headers, headerKeyMap)
    });
    
  } catch (err) {
    // 清理临时文件
    if (req.file && req.file.path) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    console.error('[import/preview] 解析Excel失败:', err);
    res.status(500).json({ success: false, error: '解析Excel文件失败: ' + err.message });
  }
});

// 执行导入
app.post('/api/import/:type/execute', upload.single('file'), async (req, res) => {
  const { type } = req.params;
  
  if (!IMPORT_TYPES.includes(type)) {
    cleanupImportFile(req);
    return res.status(400).json({ success: false, error: '不支持的导入类型' });
  }
  
  if (!req.file) {
    return res.status(400).json({ success: false, error: '请上传Excel文件' });
  }
  
  const { operator, error: operatorError } = resolveImportOperator(req);
  if (operatorError) {
    cleanupImportFile(req);
    return res.status(403).json({ success: false, error: operatorError });
  }
  const permissionError = validateImportPermission(type, operator);
  if (permissionError) {
    cleanupImportFile(req);
    return res.status(403).json({ success: false, error: permissionError });
  }
  
  try {
    // 解析Excel
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    fs.unlinkSync(req.file.path); // 立即清理临时文件
    
    if (data.length < 2) {
      return res.status(400).json({ success: false, error: 'Excel文件内容为空' });
    }
    
    const template = TEMPLATES[type];
    const headers = data[0];
    const rows = data.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== null && cell !== ''));
    
    // 建立中文表头 -> 英文key的映射
    const headerKeyMap = getImportHeaderKeyMap(template);
    
    const results = {
      success: 0,
      updated: 0,
      profileUpdated: 0,
      failed: 0,
      errors: []
    };
    
    // 按类型执行导入
    if (type === 'partners') {
      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          const rawItem = parseImportRow(headers, row, headerKeyMap);
          const { item, errors } = validateImportItem(type, rawItem, operator);
          if (errors.length) {
            results.failed++;
            results.errors.push({ row: i + 2, message: errors.join('；') });
            continue;
          }
          
          // 查重（按名称）
          const existing = db.partners.find(p => p.name === item.name);
          if (existing) {
            // 更新
            existing.level = item.level;
            existing.region = item.region;
            existing.city = item.city;
            existing.bigRegion = item.bigRegion || existing.bigRegion;
            existing.contact = item.contact || existing.contact;
            existing.phone = item.phone || existing.phone;
            existing.email = item.email || existing.email;
            existing.techServiceType = item.techServiceType !== undefined ? (item.techServiceType || 'none') : existing.techServiceType;
            existing.isTechService = existing.techServiceType === 'full';
            existing.updatedBy = operator.id;
            existing.updatedAt = new Date().toISOString();
            if (syncImportedPartnerProfile(existing, item, operator)) {
              results.profileUpdated++;
            }
            results.updated++;
          } else {
            // 新增
            const existingIds = db.partners.map(p => parseInt(p.id.replace('P', '')) || 0);
            const maxId = Math.max(0, ...existingIds);
            const newId = 'P' + String(maxId + 1).padStart(3, '0');
            
            const newPartner = {
              id: newId,
              name: item.name,
              level: item.level,
              partnerLevel: 'none',
              parentPartnerId: null,
              parentPartnerIds: [],
              partnerLevelSetBy: null,
              partnerLevelSetAt: null,
              region: item.region,
              city: item.city,
              bigRegion: item.bigRegion || '',
              contact: item.contact || '',
              phone: item.phone || '',
              email: item.email || '',
	              isTechService: item.techServiceType === 'full',
	              techServiceType: item.techServiceType || 'none',
	              status: operator.role === 'superadmin' ? 'active' : 'pending',
	              joinDate: new Date().toISOString().split('T')[0],
	              quoteCount: 0,
	              orderCount: 0,
	              totalAmt: 0,
	              staff: [],
	              createdBy: operator.id,
	              createdByRole: operator.role
	            };
	            
	            db.partners.push(newPartner);
	            if (syncImportedPartnerProfile(newPartner, item, operator)) {
	              results.profileUpdated++;
	            }
	            if (newPartner.status === 'pending') {
	              db.pendingApprovals.push({
	                id: 'APR-' + Date.now() + '-' + i,
	                type: 'partner',
	                targetId: newPartner.id,
	                targetName: newPartner.name,
	                createdBy: operator.id,
	                createdByRole: operator.role,
	                region: newPartner.region,
	                status: 'pending',
	                createdAt: new Date().toISOString()
	              });
	            }
	            results.success++;
	          }
        } catch (err) {
          results.failed++;
          results.errors.push({ row: i + 2, message: err.message });
        }
      }
	    } else if (type === 'staff') {
	      for (let i = 0; i < rows.length; i++) {
	        try {
	          const row = rows[i];
	          const rawItem = parseImportRow(headers, row, headerKeyMap);
	          const { item, errors } = validateImportItem(type, rawItem, operator);
	          if (errors.length) {
	            results.failed++;
	            results.errors.push({ row: i + 2, message: errors.join('；') });
	            continue;
	          }
	          const partner = db.partners.find(p => p.name === item.partnerName);
	          const finalStatus = resolveImportedStaffStatus(item.status);
	          
	          // 查重（按账号）
	          const existing = db.users.find(u => u.username === item.username);
	          if (existing) {
	            // 更新
	            existing.name = item.name;
	            existing.partnerId = partner.id;
	            existing.partnerName = partner.name;
	            existing.region = partner.region;
	            existing.bigRegion = partner.bigRegion || '';
	            existing.phone = item.phone || '';
	            existing.email = item.email || '';
	            existing.status = finalStatus;
	            existing.updatedBy = operator.id;
	            existing.updatedAt = new Date().toISOString();
	            syncImportedStaffToPartner(existing, partner, item, finalStatus);
	            results.updated++;
	          } else {
            // 新增
            const idPrefix = 'S';
            const existingIds = db.users.filter(u => u.id.startsWith(idPrefix)).map(u => parseInt(u.id.slice(1)) || 0);
            const maxId = Math.max(0, ...existingIds);
            const newId = idPrefix + String(maxId + 1).padStart(3, '0');
            
            const newUser = {
              id: newId,
              username: item.username,
              name: item.name,
              role: 'staff',
              password: item.password,
              partnerId: partner.id,
	              partnerName: partner.name,
	              region: partner.region,
	              bigRegion: partner.bigRegion || '',
	              phone: item.phone || '',
	              email: item.email || '',
	              status: finalStatus,
	              createdBy: operator.id,
	              createdByRole: operator.role,
	              createdAt: new Date().toISOString()
	            };
	            
	            db.users.push(newUser);
	            syncImportedStaffToPartner(newUser, partner, item, finalStatus);
	            
	            results.success++;
	          }
        } catch (err) {
          results.failed++;
          results.errors.push({ row: i + 2, message: err.message });
        }
      }
	    } else if (type === 'registrations') {
	      for (let i = 0; i < rows.length; i++) {
	        try {
	          const row = rows[i];
	          const rawItem = parseImportRow(headers, row, headerKeyMap);
	          const { item, errors } = validateImportItem(type, rawItem, operator);
	          if (errors.length) {
	            results.failed++;
	            results.errors.push({ row: i + 2, message: errors.join('；') });
	            continue;
	          }
	          const partner = db.partners.find(p => p.name === item.partnerName);
	          const staff = db.users.find(u => u.name === item.assignedStaffName && u.partnerId === partner.id && (u.role === 'staff' || u.role === 'partner_admin'));
	          
	          // 查重（按客户名称+信用代码）
          const existing = db.registrations.find(r => 
            r.customer === item.customer && 
            (!item.creditCode || r.creditCode === item.creditCode)
          );
          if (existing) {
            // 更新
            existing.creditCode = item.creditCode || existing.creditCode;
            existing.industry = item.industry || existing.industry;
            existing.contact = item.contact || existing.contact;
            existing.phone = item.phone || existing.phone;
            existing.address = item.address || existing.address;
            existing.assignedStaffId = staff.id;
            existing.assignedStaffName = staff.name;
	            existing.partnerId = partner.id;
	            existing.partnerName = partner.name;
	            existing.updatedBy = operator.id;
	            existing.updatedAt = new Date().toISOString();
	            results.updated++;
          } else {
            // 新增
            const newReg = {
              id: 'REG-' + Date.now() + '-' + i,
              customer: item.customer,
              creditCode: item.creditCode || '',
              industry: item.industry || '',
              contact: item.contact || '',
              phone: item.phone || '',
              address: item.address || '',
              assignedStaffId: staff.id,
              assignedStaffName: staff.name,
              partnerId: partner.id,
	              partnerName: partner.name,
	              region: partner.region,
	              status: 'approved',
	              approvedAt: new Date().toISOString(),
	              approvedBy: operator.id,
	              createdBy: staff.id,
	              createdByName: staff.name,
              createdAt: new Date().toISOString(),
              expireAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
            };
            
            db.registrations.push(newReg);
            results.success++;
          }
        } catch (err) {
          results.failed++;
          results.errors.push({ row: i + 2, message: err.message });
        }
      }
	    } else if (type === 'opportunities') {
	      for (let i = 0; i < rows.length; i++) {
	        try {
	          const row = rows[i];
	          const rawItem = parseImportRow(headers, row, headerKeyMap);
	          const { item, errors } = validateImportItem(type, rawItem, operator);
	          if (errors.length) {
	            results.failed++;
	            results.errors.push({ row: i + 2, message: errors.join('；') });
	            continue;
	          }
	          const partner = db.partners.find(p => p.name === item.partnerName);
	          const staff = db.users.find(u => u.name === item.assignedStaffName && u.partnerId === partner.id && (u.role === 'staff' || u.role === 'partner_admin'));
	          const reg = db.registrations.find(r => r.customer === item.customer && r.status === 'approved');
	          
	          // 查重（按商机名称+客户名称）
          const existing = db.opportunities.find(o => o.name === item.name && o.customer === item.customer);
          if (existing) {
            // 更新
            existing.amount = parseFloat(item.amount) || existing.amount;
            existing.expectedClose = item.expectedClose || existing.expectedClose;
            existing.stage = item.stage || existing.stage;
            existing.industry = item.industry || existing.industry;
            existing.contact = item.contact || existing.contact;
            existing.phone = item.phone || existing.phone;
            existing.remark = item.remark || existing.remark;
            existing.assignedStaffId = staff.id;
	            existing.assignedStaffName = staff.name;
	            existing.partnerId = partner.id;
	            existing.partnerName = partner.name;
	            existing.updatedBy = operator.id;
	            existing.updatedAt = new Date().toISOString();
            results.updated++;
          } else {
            // 新增
            const newOpp = {
              id: 'OPP-' + Date.now() + '-' + i,
              name: item.name,
              customer: item.customer,
              regId: reg.id,
              amount: parseFloat(item.amount) || 0,
              expectedClose: item.expectedClose || '',
              stage: item.stage || 'contacted',
              industry: item.industry || '',
              contact: item.contact || '',
              phone: item.phone || '',
              remark: item.remark || '',
              assignedStaffId: staff.id,
              assignedStaffName: staff.name,
              partnerId: partner.id,
              partnerName: partner.name,
              region: partner.region,
              createdBy: staff.id,
              createdByName: staff.name,
              owner: staff.name,
              tags: [],
              lastFollowAt: '',
              createdAt: new Date().toISOString()
            };
            
            db.opportunities.push(newOpp);
            results.success++;
          }
        } catch (err) {
          results.failed++;
          results.errors.push({ row: i + 2, message: err.message });
        }
      }
    }
    
    // 保存数据
    saveData();
    
    res.json({
      success: true,
      message: `导入完成：新增 ${results.success} 条，更新 ${results.updated} 条，失败 ${results.failed} 条`,
      results: results
    });
    
  } catch (err) {
    console.error('[import/execute] 导入失败:', err);
    res.status(500).json({ success: false, error: '导入失败: ' + err.message });
  }
});

// 启动服务器

// 确保上传目录存在
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const OPEN_API_AUDIT_LOG_FILE = path.join(__dirname, 'open-api-access.log');
const OPEN_API_TOKEN_TTL_MS = Number(process.env.OPEN_API_TOKEN_TTL_MS || 2 * 60 * 60 * 1000);
const OPEN_API_DEFAULT_PAGE_SIZE = 20;
const OPEN_API_MAX_PAGE_SIZE = 200;
const OPEN_API_CORE_RESOURCES = ['users', 'partners', 'registrations', 'opportunities', 'quotes', 'orders'];
const OPEN_API_PRODUCT_RESOURCES = ['categories', 'modules', 'features', 'hardware', 'packages', 'products', 'product-tree', 'product-stats'];
const OPEN_API_OPERATION_RESOURCES = [
  'notifications',
  'pending-approvals',
  'channel-targets',
  'channel-visits',
  'channel-operations-overview',
  'dashboard-stats',
  'company-search',
];
const OPEN_API_CONFIG_RESOURCES = [
  'workload-classifications',
  'workload-delivery-rules',
  'workload-mappings',
  'workload-rules',
  'quote-workload-preview',
  'ipg-quote-preview',
];
const OPEN_API_SYSTEM_RESOURCES = ['audit-logs', 'analytics', 'diagnostics', 'identity'];
const OPEN_API_ALLOWED_RESOURCES = new Set([
  '*',
  ...OPEN_API_CORE_RESOURCES,
  ...OPEN_API_PRODUCT_RESOURCES,
  ...OPEN_API_OPERATION_RESOURCES,
  ...OPEN_API_CONFIG_RESOURCES,
  ...OPEN_API_SYSTEM_RESOURCES,
]);
const OPEN_API_RESOURCE_LABELS = {
  '*': '全部资源',
  users: '用户',
  partners: '渠道商',
  registrations: '客户报备',
  opportunities: '商机',
  quotes: '报价',
  orders: '订单',
  categories: '产品大类',
  modules: '产品模块',
  features: '功能模块',
  hardware: '硬件产品',
  packages: '产品套餐',
  products: '兼容产品',
  'product-tree': '产品目录树',
  'product-stats': '产品统计',
  notifications: '通知中心',
  'pending-approvals': '待审批',
  'channel-targets': '渠道目标',
  'channel-visits': '渠道拜访',
  'channel-operations-overview': '渠道运营总览',
  'dashboard-stats': '首页统计',
  'company-search': '企业搜索',
  'workload-classifications': '实施工作量分类',
  'workload-delivery-rules': '交付工作量规则',
  'workload-mappings': '产品工作量映射',
  'workload-rules': '旧版工作量规则',
  'quote-workload-preview': '报价工作量预览',
  'ipg-quote-preview': 'IPG参考价预览',
  'audit-logs': '操作审计日志',
  analytics: '统计分析',
  diagnostics: '诊断自检',
  identity: '身份权限',
};
const OPEN_API_RESOURCE_GROUPS = [
  { key: 'core', label: '核心业务', resources: OPEN_API_CORE_RESOURCES },
  { key: 'product', label: '产品与报价配置', resources: OPEN_API_PRODUCT_RESOURCES },
  { key: 'operation', label: '运营与提醒', resources: OPEN_API_OPERATION_RESOURCES },
  { key: 'config', label: '计算与实施配置', resources: OPEN_API_CONFIG_RESOURCES },
  { key: 'system', label: '系统分析', resources: OPEN_API_SYSTEM_RESOURCES },
];
const OPEN_API_SENSITIVE_FIELDS = new Set([
  'password',
  'passwd',
  'pwd',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'session',
  'sessionid',
  'secret',
  'clientsecret',
  'appsecret',
  'privatekey',
  'authorization',
  'ssotoken',
  'sso_token',
  'iamtoken',
  'authtoken',
  'resettoken',
  'captcha',
  'salt',
]);
const OPEN_API_SENSITIVE_KEYWORDS = [
  'password',
  'token',
  'secret',
  'session',
  'cookie',
  'captcha',
  'salt',
];
const OPEN_API_DOCS_DIR = path.join(__dirname, '..', 'docs');
const OPEN_API_MANAGED_DOCS = [
  {
    id: 'latest-guide',
    title: '联软CRM标准OpenAPI最新对接说明',
    fileName: 'openapi-aiagent-latest-guide.md',
    description: '对方联调优先阅读，包含 Base URL、鉴权、核心接口、联调注意事项。',
  },
  {
    id: 'api-contract',
    title: 'AI-agent标准API契约',
    fileName: 'openapi-aiagent-api-contract.md',
    description: '标准接口契约、请求参数、响应结构、错误码与分页规则。',
  },
  {
    id: 'aiagent-expanded-resources',
    title: 'AI-agent全量业务OpenAPI取数说明',
    fileName: 'openapi-aiagent-expanded-resources-20260624.md',
    description: '新增业务资源、字典、权限口径和AI-agent取数建议。',
  },
  {
    id: 'analytics-statistics',
    title: 'OpenAPI统计分析接口说明',
    fileName: 'openapi-aiagent-analytics-statistics-guide-20260624.md',
    description: '统计分析资源、筛选条件、指标口径和接口调用示例。',
  },
  {
    id: 'self-test-record',
    title: '联软CRM-OpenAPI增强实施与自测记录',
    fileName: 'openapi-aiagent-self-test-record.md',
    description: '接口增强、自测范围、验证结论与剩余注意事项。',
  },
];

let openApiAccessTokens = [];

function ensureOpenApiData() {
  if (!Array.isArray(db.openApiClients)) db.openApiClients = [];
}

function pruneOpenApiAccessTokens() {
  const now = Date.now();
  openApiAccessTokens = openApiAccessTokens.filter(item => item && item.expiresAt > now);
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

function generateOpenApiCredential(prefix) {
  return `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
}

function createOpenApiRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function normalizeIpWhitelist(value) {
  return normalizeStringArray(value).map(item => normalizeOpenApiIp(item)).filter(Boolean);
}

function normalizeAllowedResources(value) {
  const resources = normalizeStringArray(value).map(item => item.toLowerCase());
  if (!resources.length) return ['*'];
  return resources.filter(item => OPEN_API_ALLOWED_RESOURCES.has(item));
}

function maskSecret(secret) {
  const text = String(secret || '');
  if (text.length <= 8) return '********';
  return `${text.slice(0, 4)}****${text.slice(-4)}`;
}

function getRequestIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return normalizeOpenApiIp(forwarded || req.ip || req.socket?.remoteAddress || '');
}

function normalizeOpenApiIp(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (text === 'localhost' || text === '::1' || text === '0:0:0:0:0:0:0:1') return '127.0.0.1';
  if (text.startsWith('::ffff:')) return text.slice(7);
  return text;
}

function wildcardToRegExp(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function isIpAllowed(ip, whitelist) {
  const normalizedIp = normalizeOpenApiIp(ip);
  if (!Array.isArray(whitelist) || whitelist.length === 0) return true;
  return whitelist.some(rule => {
    const value = normalizeOpenApiIp(rule);
    if (!value) return false;
    if (value === '*') return true;
    if (value.includes('*')) return wildcardToRegExp(value).test(normalizedIp);
    return value === normalizedIp;
  });
}

function isOpenApiClientExpired(client) {
  if (!client?.expiresAt) return false;
  const time = new Date(client.expiresAt).getTime();
  return Number.isFinite(time) && time < Date.now();
}

function getOpenApiBoundUser(client) {
  if (!client?.boundUserId) return null;
  return db.users.find(item => item.id === client.boundUserId) || null;
}

function sanitizeOpenApiClient(client) {
  if (!client) return null;
  const { appSecretHash, ...safe } = client;
  return safe;
}

function appendOpenApiAudit(record) {
  try {
    fs.appendFileSync(OPEN_API_AUDIT_LOG_FILE, `${JSON.stringify(record)}\n`, 'utf8');
  } catch (err) {
    console.error('[OPEN-API] audit log write failed:', err.message);
  }
}

function isSensitiveField(key) {
  const normalized = String(key || '').trim().toLowerCase();
  if (!normalized) return false;
  if (OPEN_API_SENSITIVE_FIELDS.has(normalized)) return true;
  return OPEN_API_SENSITIVE_KEYWORDS.some(item => normalized.includes(item));
}

function sanitizeOpenApiOutput(value) {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeOpenApiOutput(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const result = {};
  Object.entries(value).forEach(([key, item]) => {
    if (isSensitiveField(key)) return;
    result[key] = sanitizeOpenApiOutput(item);
  });
  return result;
}

function parsePageNo(value) {
  const pageNo = Number.parseInt(value, 10);
  return Number.isFinite(pageNo) && pageNo > 0 ? pageNo : 1;
}

function parsePageSize(value) {
  const pageSize = Number.parseInt(value, 10);
  if (!Number.isFinite(pageSize) || pageSize <= 0) return OPEN_API_DEFAULT_PAGE_SIZE;
  return Math.min(OPEN_API_MAX_PAGE_SIZE, pageSize);
}

function parseDateValue(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function parseOpenApiNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getOpenApiAmount(record) {
  return parseOpenApiNumber(
    record?.amount ?? record?.totalAmount ?? record?.total ?? record?.totalAmt ?? record?.orderAmount ?? record?.quoteAmount ?? record?.estimatedAmt ?? record?.expectedAmount,
    0
  );
}

function getOpenApiDateBucket(record, field = 'createdAt', granularity = 'month') {
  const raw = record?.[field] || record?.createdAt || record?.updatedAt;
  const time = parseDateValue(raw);
  if (!time) return '';
  const date = new Date(time);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (granularity === 'day') return `${year}-${month}-${day}`;
  if (granularity === 'year') return String(year);
  return `${year}-${month}`;
}

function applyOpenApiKeywordFilter(items, keyword, fields) {
  const normalized = String(keyword || '').trim().toLowerCase();
  if (!normalized) return items;
  return items.filter(item => fields.some(field => String(item?.[field] || '').toLowerCase().includes(normalized)));
}

function applyOpenApiTimeFilters(items, query) {
  const createdAfter = parseDateValue(query.createdAfter);
  const createdBefore = parseDateValue(query.createdBefore);
  const updatedAfter = parseDateValue(query.updatedAfter);
  const updatedBefore = parseDateValue(query.updatedBefore);
  return items.filter(item => {
    const createdAt = parseDateValue(item.createdAt);
    const updatedAt = parseDateValue(item.updatedAt || item.createdAt);
    if (createdAfter && (!createdAt || createdAt < createdAfter)) return false;
    if (createdBefore && (!createdAt || createdAt > createdBefore)) return false;
    if (updatedAfter && (!updatedAt || updatedAt < updatedAfter)) return false;
    if (updatedBefore && (!updatedAt || updatedAt > updatedBefore)) return false;
    return true;
  });
}

function applyOpenApiPagination(items, query) {
  const pageNo = parsePageNo(query.pageNo);
  const pageSize = parsePageSize(query.pageSize);
  const total = items.length;
  const offset = (pageNo - 1) * pageSize;
  return {
    pageNo,
    pageSize,
    total,
    list: items.slice(offset, offset + pageSize),
  };
}

function getOpenApiSortField(query, fallback = 'updatedAt') {
  const field = String(query.sortBy || fallback).trim();
  return field || fallback;
}

function sortOpenApiItems(items, query, fallback = 'updatedAt') {
  const sortBy = getOpenApiSortField(query, fallback);
  const sortOrder = String(query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  return items.slice().sort((a, b) => {
    const av = a?.[sortBy];
    const bv = b?.[sortBy];
    const at = parseDateValue(av);
    const bt = parseDateValue(bv);
    let result = 0;
    if (at !== null && bt !== null) {
      result = at - bt;
    } else if (typeof av === 'number' && typeof bv === 'number') {
      result = av - bv;
    } else {
      result = String(av || '').localeCompare(String(bv || ''), 'zh-CN');
    }
    return sortOrder === 'asc' ? result : -result;
  });
}

function isSamePartnerScope(record, partnerId) {
  return record?.partnerId === partnerId ||
    record?.assignedPartnerId === partnerId ||
    record?.parentPartnerId === partnerId ||
    (Array.isArray(record?.parentPartnerIds) && record.parentPartnerIds.includes(partnerId));
}

function scopeOpenApiRegistrations(user) {
  let list = Array.isArray(db.registrations) ? db.registrations.map(item => enrichAssignedStaffForRead({ ...item })) : [];
  if (user.role === 'superadmin') return list;
  if (user.role === 'admin') {
    return list.filter(item => item.region === user.region);
  }
  if (user.role === 'partner_admin') {
    return list.filter(item => isSamePartnerScope(item, user.partnerId));
  }
  if (user.role === 'staff') {
    return list.filter(item => isRecordRelatedToUser(item, user.id, ['createdBy', 'owner', 'assignedStaffId']));
  }
  return [];
}

function scopeOpenApiOpportunities(user) {
  let list = Array.isArray(db.opportunities) ? db.opportunities.map(item => enrichAssignedStaffForRead({ ...item })) : [];
  if (user.role === 'superadmin') return list;
  if (user.role === 'admin') {
    return list.filter(item => item.region === user.region);
  }
  if (user.role === 'partner_admin') {
    return list.filter(item => isSamePartnerScope(item, user.partnerId));
  }
  if (user.role === 'staff') {
    return list.filter(item => isRecordRelatedToUser(item, user.id));
  }
  return [];
}

function scopeOpenApiQuotes(user) {
  let list = Array.isArray(db.quotes) ? db.quotes.map(item => enrichAssignedStaffForRead({ ...item })) : [];
  if (user.role === 'superadmin') return list;
  if (user.role === 'admin') {
    return list.filter(item => item.region === user.region);
  }
  if (user.role === 'partner_admin') {
    return list.filter(item => isSamePartnerScope(item, user.partnerId));
  }
  if (user.role === 'staff') {
    return list.filter(item => isRecordRelatedToUser(item, user.id));
  }
  return [];
}

function scopeOpenApiOrders(user) {
  let list = Array.isArray(db.orders) ? db.orders.map(item => enrichAssignedStaffForRead({ ...item })) : [];
  if (user.role === 'superadmin') return list;
  if (user.role === 'admin') {
    return list.filter(item => item.region === user.region);
  }
  if (user.role === 'partner_admin') {
    return list.filter(item => isSamePartnerScope(item, user.partnerId));
  }
  if (user.role === 'staff') {
    return list.filter(item => isRecordRelatedToUser(item, user.id));
  }
  return [];
}

function scopeOpenApiPartners(user) {
  let list = Array.isArray(db.partners) ? db.partners.slice() : [];
  if (user.role === 'superadmin') return list;
  if (user.role === 'admin') {
    return list.filter(item => (item.status === 'active' && item.region === user.region) || (item.status === 'pending' && item.createdBy === user.id));
  }
  if (user.role === 'partner_admin') {
    return list.filter(item => item.id === user.partnerId || item.parentPartnerId === user.partnerId || (Array.isArray(item.parentPartnerIds) && item.parentPartnerIds.includes(user.partnerId)));
  }
  if (user.role === 'staff') {
    return list.filter(item => item.id === user.partnerId);
  }
  return [];
}

function scopeOpenApiUsers(user) {
  let list = Array.isArray(db.users) ? db.users.slice() : [];
  if (user.role === 'superadmin') return list;
  if (user.role === 'admin') {
    return list.filter(item => item.region === user.region || !item.region);
  }
  if (user.role === 'partner_admin') {
    return list.filter(item => item.partnerId === user.partnerId);
  }
  if (user.role === 'staff') {
    return list.filter(item => item.id === user.id);
  }
  return [];
}

function buildOpenApiChannelScopeParams(user, query = {}) {
  const params = {
    userRole: user?.role || '',
    region: '',
    partnerId: '',
    year: query.year || '',
  };
  if (user?.role === 'admin') {
    params.region = user.region || '';
  } else if (user?.role === 'partner_admin' || user?.role === 'staff') {
    params.partnerId = user.partnerId || '';
    params.region = user.region || '';
  } else if (user?.role === 'superadmin') {
    params.region = String(query.region || '').trim();
    params.partnerId = String(query.partnerId || '').trim();
  }
  return params;
}

function getOpenApiVisibleUserIds(user) {
  if (!user) return [];
  if (user.role === 'superadmin') {
    return dedupeOpenApiStrings((Array.isArray(db.users) ? db.users : []).map(item => item.id));
  }
  if (user.role === 'admin') {
    return dedupeOpenApiStrings((Array.isArray(db.users) ? db.users : [])
      .filter(item => item.id === user.id || item.region === user.region)
      .map(item => item.id));
  }
  if (user.role === 'partner_admin') {
    return dedupeOpenApiStrings((Array.isArray(db.users) ? db.users : [])
      .filter(item => item.id === user.id || item.partnerId === user.partnerId)
      .map(item => item.id));
  }
  return dedupeOpenApiStrings([user.id]);
}

function scopeOpenApiNotifications(user) {
  ensureNotificationsStore();
  const visibleUserIds = new Set(getOpenApiVisibleUserIds(user));
  return (Array.isArray(db.notifications) ? db.notifications : []).filter(item => visibleUserIds.has(String(item.userId || '')));
}

function scopeOpenApiPendingApprovals(user) {
  let list = Array.isArray(db.pendingApprovals) ? db.pendingApprovals.slice() : [];
  if (!user) return [];
  if (user.role === 'superadmin') return list;
  if (user.role === 'admin') {
    return list.filter(item =>
      String(item.region || '') === String(user.region || '') ||
      String(item.createdBy || '') === String(user.id || '')
    );
  }
  if (user.role === 'partner_admin') {
    return list.filter(item =>
      String(item.parentPartnerId || '') === String(user.partnerId || '') ||
      String(item.targetPartnerId || '') === String(user.partnerId || '') ||
      String(item.createdBy || '') === String(user.id || '')
    );
  }
  return list.filter(item => String(item.createdBy || '') === String(user.id || '') || String(item.targetId || '') === String(user.id || ''));
}

function scopeOpenApiChannelTargets(user, query = {}) {
  ensureChannelOperationsData();
  return filterChannelTargetsByScope(db.channelTargets, buildOpenApiChannelScopeParams(user, query));
}

function scopeOpenApiChannelVisits(user, query = {}) {
  ensureChannelOperationsData();
  return filterChannelVisitsByScope(db.channelVisits, buildOpenApiChannelScopeParams(user, query));
}

function buildOpenApiProductTree(query = {}) {
  const onlyPublished = String(query.published || '').toLowerCase() === 'true';
  const categories = (Array.isArray(db.categories) ? db.categories : []).filter(item => onlyPublished ? item.status === 'active' : true);
  const modules = (Array.isArray(db.modules) ? db.modules : []).filter(item => onlyPublished ? item.status === 'active' : true);
  const features = (Array.isArray(db.features) ? db.features : []).filter(item => {
    if (!onlyPublished) return true;
    if (item.status !== 'active') return false;
    return item.published === undefined || item.published === true;
  });
  return categories.map(category => {
    const categoryModules = modules
      .filter(item => item.categoryId === category.id)
      .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
      .map(moduleItem => ({
        ...moduleItem,
        features: features
          .filter(feature => feature.moduleId === moduleItem.id)
          .map(feature => ({ ...normalizeStandardMaintenanceFeatureConfig(feature), tiers: undefined })),
      }));
    return {
      ...category,
      moduleCount: categoryModules.length,
      featureCount: categoryModules.reduce((sum, moduleItem) => sum + moduleItem.features.length, 0),
      modules: categoryModules,
    };
  }).sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
}

function buildOpenApiProductStats() {
  const features = Array.isArray(db.features) ? db.features : [];
  const hardware = Array.isArray(db.hardwareProducts) ? db.hardwareProducts : [];
  const categories = Array.isArray(db.categories) ? db.categories : [];
  const modules = Array.isArray(db.modules) ? db.modules : [];
  const byCategory = {};
  categories.forEach(category => {
    const moduleIds = modules.filter(item => item.categoryId === category.id).map(item => item.id);
    const categoryFeatures = features.filter(item => moduleIds.includes(item.moduleId));
    byCategory[category.id] = {
      name: category.name,
      icon: category.icon,
      total: categoryFeatures.length,
      published: categoryFeatures.filter(item => item.published !== false).length,
    };
  });
  return {
    total: features.length + hardware.length,
    published: features.filter(item => item.published !== false).length + hardware.filter(item => item.published !== false).length,
    unpublished: features.filter(item => item.published === false).length + hardware.filter(item => item.published === false).length,
    categories: categories.length,
    modules: modules.length,
    features: features.length,
    hardware: hardware.length,
    packages: Array.isArray(db.packages) ? db.packages.length : 0,
    byCategory,
  };
}

function buildOpenApiDashboardStats(user, query = {}) {
  let registrations = getOpenApiScopedResourceItems(user, 'registrations');
  let opportunities = getOpenApiScopedResourceItems(user, 'opportunities');
  let quotes = getOpenApiScopedResourceItems(user, 'quotes');
  const region = String(query.region || '').trim();
  if (region) {
    registrations = registrations.filter(item => item.region === region);
    opportunities = opportunities.filter(item => item.region === region);
    quotes = quotes.filter(item => item.region === region);
  }
  return {
    registrationCount: registrations.length,
    pendingCount: registrations.filter(item => item.status === 'pending').length,
    opportunityCount: opportunities.length,
    quoteCount: quotes.length,
    totalAmount: opportunities.reduce((sum, item) => sum + getOpenApiAmount(item), 0),
  };
}

function buildOpenApiUserContext(user) {
  const roleNameMap = {
    superadmin: '超级管理员',
    admin: '区域管理员',
    partner_admin: '渠道管理员',
    staff: '员工',
  };
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    roleName: roleNameMap[user.role] || user.role || '',
    region: user.region || '',
    bigRegion: user.bigRegion || '',
    partnerId: user.partnerId || '',
    partnerName: user.partnerName || '',
    status: user.status || '',
    wecomUserId: user.wecomUserId || user.wecomSenderId || '',
    departmentId: user.departmentId || '',
    departmentName: user.departmentName || '',
  };
}

function buildOpenApiIdentityContext(user) {
  const base = buildOpenApiUserContext(user);
  const scope = buildOpenApiPermissionScope(user);
  return {
    ...base,
    user_id: base.id,
    roleIds: dedupeOpenApiStrings([base.role]),
    roleNames: dedupeOpenApiStrings([base.roleName || base.role]),
    isAdmin: base.role === 'superadmin' || base.role === 'admin',
    regions: scope.regions,
    bigRegions: scope.bigRegions,
    partnerIds: scope.partnerIds,
    userIds: scope.userIds,
    ownerIds: scope.userIds,
    scopeType: scope.scopeType,
    scopeDescription: scope.description,
    channels: ['web-console', 'open-api'],
    wecomUserId: base.wecomUserId || '',
  };
}

function ensureOpenApiArray(value) {
  if (Array.isArray(value)) return value.filter(item => item !== undefined && item !== null && item !== '');
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function dedupeOpenApiStrings(values) {
  return Array.from(new Set(ensureOpenApiArray(values).map(item => String(item || '').trim()).filter(Boolean)));
}

function getOpenApiOpportunityIds(record) {
  return dedupeOpenApiStrings([
    ...(Array.isArray(record?.opportunityIds) ? record.opportunityIds : []),
    record?.opportunityId,
    ...(Array.isArray(record?.oppIds) ? record.oppIds : []),
    record?.oppId,
  ]);
}

function getOpenApiRegistrationId(record, fallback = '') {
  return String(record?.registrationId || record?.regId || fallback || '').trim();
}

function getOpenApiCustomerId(record, fallbackCustomer = '') {
  return String(
    record?.customerId ||
    record?.customer_id ||
    record?.creditCode ||
    record?.credit_code ||
    record?.unifiedSocialCreditCode ||
    record?.taxNo ||
    fallbackCustomer ||
    record?.customer ||
    record?.customerName ||
    ''
  ).trim();
}

function findOpportunityForOpenApi(record) {
  const candidateIds = getOpenApiOpportunityIds(record);
  if (!candidateIds.length) return null;
  return (Array.isArray(db.opportunities) ? db.opportunities : []).find(item => candidateIds.includes(String(item?.id || ''))) || null;
}

function findOpportunityByRegistrationIdForOpenApi(registrationId) {
  const normalized = String(registrationId || '').trim();
  if (!normalized) return null;
  return (Array.isArray(db.opportunities) ? db.opportunities : []).find(item =>
    String(item?.registrationId || item?.regId || '') === normalized
  ) || null;
}

function findQuoteForOpenApi(record) {
  const quoteId = String(record?.quoteId || '').trim();
  if (!quoteId) return null;
  return (Array.isArray(db.quotes) ? db.quotes : []).find(item => String(item?.id || '') === quoteId) || null;
}

function buildOpportunityNameForOpenApi(opportunity) {
  if (!opportunity) return '';
  return opportunity.name || opportunity.opportunityName || opportunity.customer || opportunity.customerName || opportunity.id || '';
}

function buildQuoteCustomerForOpenApi(record) {
  if (record?.customer) return String(record.customer);
  if (record?.customerName) return String(record.customerName);
  const opportunity = findOpportunityForOpenApi(record);
  if (opportunity?.customer) return String(opportunity.customer);
  return '';
}

function buildOrderCustomerForOpenApi(record) {
  if (record?.customer) return String(record.customer);
  if (record?.customerName) return String(record.customerName);
  const quote = findQuoteForOpenApi(record);
  if (quote?.customer) return String(quote.customer);
  if (quote?.customerName) return String(quote.customerName);
  const opportunity = quote ? findOpportunityForOpenApi(quote) : null;
  if (opportunity?.customer) return String(opportunity.customer);
  return '';
}

const OPEN_API_ROLE_LABELS = {
  superadmin: '超级管理员',
  admin: '区域管理员',
  partner_admin: '渠道管理员',
  staff: '员工',
};

const OPEN_API_PARTNER_LEVEL_LABELS = {
  none: '未设置',
  primary: '一级渠道',
  secondary: '二级渠道',
};

const OPEN_API_COOPERATION_LEVEL_LABELS = {
  lep: 'LEP',
  gold: '金牌',
  silver: '银牌',
  diamond: '钻石',
};

const OPEN_API_TECH_SERVICE_TYPE_LABELS = {
  none: '未参与',
  full: '签约技术服务商',
  developing: '提名技术服务商',
  nominated: '提名技术服务商',
};

const OPEN_API_OPPORTUNITY_STAGE_LABELS = {
  contacted: '已接触',
  qualified: '已确认',
  proposal: '方案/报价中',
  negotiation: '商务谈判',
  won: '已成交',
  lost: '已失单',
};

function getOpenApiUserName(userId) {
  if (!userId) return '';
  const user = (Array.isArray(db.users) ? db.users : []).find(item => String(item?.id || '') === String(userId));
  return user?.name || user?.username || '';
}

function normalizeOpenApiBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return false;
  return ['true', '1', 'yes', 'y', 'full', 'technical', 'tech', '技术服务商', '是'].includes(text);
}

function getOpenApiTechnicalServiceProvider(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.isTechnicalServiceProvider !== undefined) return normalizeOpenApiBoolean(record.isTechnicalServiceProvider);
  if (record.isTechService !== undefined) return normalizeOpenApiBoolean(record.isTechService);
  if (record.techServiceType !== undefined) return String(record.techServiceType || '').trim() !== '' && String(record.techServiceType || '').trim() !== 'none';
  return false;
}

function getOpenApiPartnerLevelName(level) {
  return OPEN_API_PARTNER_LEVEL_LABELS[level] || level || '未设置';
}

function getOpenApiCooperationLevelName(level) {
  return OPEN_API_COOPERATION_LEVEL_LABELS[level] || level || '';
}

function getOpenApiTechServiceTypeName(type) {
  return OPEN_API_TECH_SERVICE_TYPE_LABELS[type] || type || '未参与';
}

function getOpenApiOpportunityStageName(stage) {
  return OPEN_API_OPPORTUNITY_STAGE_LABELS[stage] || stage || '';
}

function normalizeOpenApiRecord(resource, record) {
  if (!record || typeof record !== 'object') return record;

  if (resource === 'users') {
    return {
      ...record,
      userId: record.userId || record.id || '',
      displayName: record.displayName || record.name || record.username || '',
      roleName: record.roleName || OPEN_API_ROLE_LABELS[record.role] || record.role || '',
      region: record.region || '',
      bigRegion: record.bigRegion || '',
      partnerId: record.partnerId || '',
      partnerName: record.partnerName || '',
      phone: record.phone || '',
      email: record.email || '',
      status: record.status || '',
      wecomUserId: record.wecomUserId || record.wecomSenderId || '',
      departmentId: record.departmentId || '',
      departmentName: record.departmentName || '',
      createdAt: record.createdAt || '',
      updatedAt: record.updatedAt || record.createdAt || '',
    };
  }

  if (resource === 'partners') {
    const amount = getOpenApiAmount(record);
    const partnerLevel = record.partnerLevel || 'none';
    const cooperationLevel = record.cooperationLevel || record.level || '';
    const createdAt = record.createdAt || record.joinDate || '';
    const isTechnicalServiceProvider = getOpenApiTechnicalServiceProvider(record);
    const techServiceType = record.techServiceType || record.technicalServiceProviderType || (isTechnicalServiceProvider ? 'full' : 'none');
    const partnerType = record.partnerType || record.type || (isTechnicalServiceProvider ? 'technical_service_provider' : 'channel_partner');
    return {
      ...record,
      partnerId: record.partnerId || record.id || '',
      partnerName: record.partnerName || record.name || '',
      shortName: record.shortName || record.name || '',
      displayName: record.displayName || record.partnerName || record.name || '',
      partnerType,
      partnerTypeName: partnerType === 'technical_service_provider' ? '技术服务商' : (partnerType === 'channel_partner' ? '渠道商' : partnerType),
      partnerLevel,
      partnerLevelName: record.partnerLevelName || getOpenApiPartnerLevelName(partnerLevel),
      cooperationLevel,
      cooperationLevelName: record.cooperationLevelName || getOpenApiCooperationLevelName(cooperationLevel),
      isTechnicalServiceProvider,
      techServiceType,
      techServiceTypeName: record.techServiceTypeName || getOpenApiTechServiceTypeName(techServiceType),
      technicalServiceProviderType: techServiceType,
      technicalServiceProviderTypeName: record.technicalServiceProviderTypeName || getOpenApiTechServiceTypeName(techServiceType),
      parentPartnerIds: dedupeOpenApiStrings(record.parentPartnerIds),
      amount,
      totalAmount: amount,
      region: record.region || '',
      city: record.city || '',
      bigRegion: record.bigRegion || '',
      status: record.status || '',
      createdAt,
      updatedAt: record.updatedAt || record.createdAt || record.joinDate || '',
    };
  }

  if (resource === 'registrations') {
    const assignedStaffId = record.assignedStaffId || record.createdBy || '';
    const partnerId = record.partnerId || record.assignedPartnerId || '';
    const customer = record.customer || record.customerName || '';
    const registrationId = record.registrationId || record.id || '';
    const opportunity = findOpportunityByRegistrationIdForOpenApi(registrationId);
    return {
      ...record,
      registrationId,
      customer,
      customerName: record.customerName || customer || '',
      customerId: getOpenApiCustomerId(record, customer),
      opportunityId: record.opportunityId || opportunity?.id || '',
      opportunityName: record.opportunityName || buildOpportunityNameForOpenApi(opportunity),
      partnerId,
      partnerName: record.partnerName || record.assignedPartnerName || '',
      assignedPartnerId: record.assignedPartnerId || record.partnerId || '',
      assignedPartnerName: record.assignedPartnerName || record.partnerName || '',
      assignedStaffId,
      assignedStaffName: record.assignedStaffName || getOpenApiUserName(assignedStaffId),
      createdByName: record.createdByName || getOpenApiUserName(record.createdBy),
      region: record.region || '',
      bigRegion: record.bigRegion || '',
      status: record.status || '',
      createdAt: record.createdAt || '',
      updatedAt: record.updatedAt || record.createdAt || '',
    };
  }

  if (resource === 'opportunities') {
    const stage = record.stage || '';
    const ownerId = record.ownerId || record.assignedStaffId || record.createdBy || '';
    const assignedStaffId = record.assignedStaffId || ownerId || '';
    const customer = record.customer || record.customerName || '';
    const registrationId = getOpenApiRegistrationId(record);
    return {
      ...record,
      opportunityId: record.opportunityId || record.id || '',
      opportunityName: record.opportunityName || record.name || customer || record.id || '',
      customer,
      customerName: record.customerName || customer || '',
      customerId: getOpenApiCustomerId(record, customer),
      registrationId,
      regId: registrationId,
      partnerId: record.partnerId || record.assignedPartnerId || '',
      partnerName: record.partnerName || record.assignedPartnerName || '',
      assignedPartnerId: record.assignedPartnerId || record.partnerId || '',
      assignedPartnerName: record.assignedPartnerName || record.partnerName || '',
      stage,
      stageName: record.stageName || getOpenApiOpportunityStageName(stage),
      status: record.status || stage,
      ownerId,
      ownerName: record.ownerName || record.owner || getOpenApiUserName(ownerId),
      assignedStaffId,
      assignedStaffName: record.assignedStaffName || getOpenApiUserName(assignedStaffId),
      createdByName: record.createdByName || getOpenApiUserName(record.createdBy),
      amount: getOpenApiAmount(record),
      region: record.region || '',
      bigRegion: record.bigRegion || '',
      createdAt: record.createdAt || '',
      updatedAt: record.updatedAt || record.createdAt || '',
    };
  }

  if (resource === 'quotes') {
    const oppIds = getOpenApiOpportunityIds(record);
    const oppId = String(oppIds[0] || '').trim();
    const opportunity = findOpportunityForOpenApi(record);
    const registrationId = getOpenApiRegistrationId(record, opportunity?.regId || '');
    const customer = buildQuoteCustomerForOpenApi(record);
    const assignedStaffId = record.assignedStaffId || record.ownerId || record.createdBy || '';
    const amount = getOpenApiAmount(record);
    return {
      ...record,
      quoteId: record.quoteId || record.id || '',
      quoteName: record.quoteName || record.name || record.id || '',
      customer,
      customerName: record.customerName || customer || '',
      customerId: getOpenApiCustomerId(record, customer),
      registrationId,
      regId: registrationId,
      opportunityId: oppId,
      opportunityIds: oppIds,
      opportunityName: record.opportunityName || buildOpportunityNameForOpenApi(opportunity),
      oppIds,
      oppId,
      partnerId: record.partnerId || record.assignedPartnerId || '',
      partnerName: record.partnerName || record.assignedPartnerName || '',
      assignedPartnerId: record.assignedPartnerId || record.partnerId || '',
      assignedPartnerName: record.assignedPartnerName || record.partnerName || '',
      assignedStaffId,
      assignedStaffName: record.assignedStaffName || getOpenApiUserName(assignedStaffId),
      ownerId: record.ownerId || assignedStaffId,
      ownerName: record.ownerName || record.assignedStaffName || getOpenApiUserName(record.ownerId || assignedStaffId),
      createdByName: record.createdByName || getOpenApiUserName(record.createdBy),
      amount,
      totalAmount: record.totalAmount ?? amount,
      region: record.region || '',
      bigRegion: record.bigRegion || '',
      status: record.status || '',
      createdAt: record.createdAt || '',
      updatedAt: record.updatedAt || record.createdAt || '',
    };
  }

  if (resource === 'orders') {
    const customer = buildOrderCustomerForOpenApi(record);
    const quote = findQuoteForOpenApi(record);
    const opportunity = findOpportunityForOpenApi(record) || (quote ? findOpportunityForOpenApi(quote) : null);
    const opportunityId = String(record.opportunityId || record.oppId || opportunity?.id || '').trim();
    const registrationId = getOpenApiRegistrationId(record, quote?.registrationId || quote?.regId || opportunity?.regId || '');
    const assignedStaffId = record.assignedStaffId || record.ownerId || record.createdBy || quote?.assignedStaffId || '';
    const ownerId = record.ownerId || assignedStaffId || quote?.ownerId || quote?.createdBy || '';
    const amount = getOpenApiAmount(record);
    return {
      ...record,
      orderId: record.orderId || record.id || '',
      orderNo: record.orderNo || record.orderNumber || record.id || '',
      orderName: record.orderName || record.name || record.orderNo || record.orderNumber || record.id || '',
      customer,
      customerName: record.customerName || customer || '',
      customerId: getOpenApiCustomerId(record, customer),
      partnerId: record.partnerId || record.assignedPartnerId || '',
      partnerName: record.partnerName || record.assignedPartnerName || '',
      assignedPartnerId: record.assignedPartnerId || '',
      assignedPartnerName: record.assignedPartnerName || '',
      parentPartnerId: record.parentPartnerId || '',
      opportunityId,
      opportunityName: record.opportunityName || buildOpportunityNameForOpenApi(opportunity),
      oppId: opportunityId,
      registrationId,
      regId: registrationId,
      quoteId: record.quoteId || '',
      ownerId,
      ownerName: record.ownerName || record.assignedStaffName || getOpenApiUserName(ownerId),
      assignedStaffId,
      assignedStaffName: record.assignedStaffName || getOpenApiUserName(assignedStaffId),
      createdByName: record.createdByName || getOpenApiUserName(record.createdBy),
      amount,
      totalAmount: record.totalAmount ?? amount,
      region: record.region || '',
      bigRegion: record.bigRegion || quote?.bigRegion || opportunity?.bigRegion || '',
      status: record.status || '',
      dealAt: record.dealAt || record.completedAt || record.confirmedAt || (record.status === 'completed' ? (record.updatedAt || record.createdAt || '') : ''),
      createdAt: record.createdAt || '',
      updatedAt: record.updatedAt || record.createdAt || '',
    };
  }

  if (resource === 'notifications') {
    const userId = String(record.userId || '');
    return {
      ...record,
      notificationId: record.notificationId || record.id || '',
      userId,
      userName: record.userName || getOpenApiUserName(userId),
      type: record.type || '',
      title: record.title || '',
      desc: record.desc || record.description || '',
      unread: record.unread !== false,
      status: record.unread === false ? 'read' : 'unread',
      dateKey: record.dateKey || '',
      reminderItems: Array.isArray(record.reminderItems) ? record.reminderItems : [],
      createdAt: record.createdAt || record.updatedAt || '',
      updatedAt: record.updatedAt || record.createdAt || '',
    };
  }

  if (resource === 'pending-approvals') {
    return {
      ...record,
      approvalId: record.approvalId || record.id || '',
      approvalType: record.type || '',
      targetId: record.targetId || '',
      targetName: record.targetName || '',
      targetPartnerId: record.targetPartnerId || record.parentPartnerId || '',
      targetPartnerName: record.targetPartnerName || record.parentPartnerName || '',
      createdByName: record.createdByName || getOpenApiUserName(record.createdBy),
      approvedByName: record.approvedByName || getOpenApiUserName(record.approvedBy),
      status: record.status || '',
      region: record.region || '',
      createdAt: record.createdAt || '',
      updatedAt: record.updatedAt || record.approvedAt || record.createdAt || '',
    };
  }

  if (resource === 'channel-targets') {
    return {
      ...record,
      channelTargetId: record.channelTargetId || record.id || '',
      year: Number(record.year || 0) || '',
      region: record.region || '',
      partnerId: record.partnerId || '',
      partnerName: record.partnerName || '',
      revenueTarget: parseOpenApiNumber(record.revenueTarget, 0),
      opportunityTarget: parseOpenApiNumber(record.opportunityTarget, 0),
      visitTarget: parseOpenApiNumber(record.visitTarget, 0),
      createdByName: record.createdByName || getOpenApiUserName(record.createdBy),
      updatedByName: record.updatedByName || getOpenApiUserName(record.updatedBy),
      createdAt: record.createdAt || '',
      updatedAt: record.updatedAt || record.createdAt || '',
    };
  }

  if (resource === 'channel-visits') {
    return {
      ...record,
      channelVisitId: record.channelVisitId || record.id || '',
      year: Number(record.year || 0) || '',
      visitDate: record.visitDate || '',
      region: record.region || '',
      partnerId: record.partnerId || '',
      partnerName: record.partnerName || '',
      type: record.type || '',
      status: record.status || '',
      owner: record.owner || '',
      createdByName: record.createdByName || getOpenApiUserName(record.createdBy),
      updatedByName: record.updatedByName || getOpenApiUserName(record.updatedBy),
      createdAt: record.createdAt || record.visitDate || '',
      updatedAt: record.updatedAt || record.createdAt || record.visitDate || '',
    };
  }

  if (resource === 'audit-logs') {
    return {
      ...record,
      auditLogId: record.auditLogId || record.id || '',
      createdAt: record.createdAt || record.created_at || '',
      updatedAt: record.updatedAt || record.created_at || '',
      requestId: record.requestId || record.request_id || '',
      actorUserId: record.actorUserId || record.actor_user_id || '',
      actorUsername: record.actorUsername || record.actor_username || '',
      actorName: record.actorName || record.actor_name || '',
      actorRole: record.actorRole || record.actor_role || '',
      targetType: record.targetType || record.target_type || '',
      targetId: record.targetId || record.target_id || '',
      targetName: record.targetName || record.target_name || '',
      userAgent: record.userAgent || record.user_agent || '',
    };
  }

  if (resource === 'workload-classifications' || resource === 'workload-delivery-rules' || resource === 'workload-mappings' || resource === 'workload-rules') {
    return {
      ...record,
      workloadId: record.workloadId || record.id || record.featureId || '',
      featureId: record.featureId || '',
      featureName: record.featureName || record.name || record.item || '',
      moduleId: record.moduleId || '',
      moduleName: record.moduleName || '',
      categoryId: record.categoryId || '',
      categoryName: record.categoryName || '',
      active: record.active !== false,
      status: record.status || (record.active === false ? 'disabled' : 'active'),
      createdAt: record.createdAt || '',
      updatedAt: record.updatedAt || record.createdAt || '',
    };
  }

  return {
    ...record,
    createdAt: record.createdAt || '',
    updatedAt: record.updatedAt || record.createdAt || '',
  };
}

function normalizeOpenApiList(resource, items) {
  return (Array.isArray(items) ? items : []).map(item => normalizeOpenApiRecord(resource, item));
}

function buildOpenApiPermissionScope(user) {
  const currentUser = buildOpenApiUserContext(user);
  const visiblePartners = normalizeOpenApiList('partners', scopeOpenApiPartners(user));
  const visiblePartnerIds = dedupeOpenApiStrings(visiblePartners.map(item => item.id));

  if (user.role === 'superadmin') {
    return {
      user: currentUser,
      scopeType: 'all',
      regions: [],
      bigRegions: [],
      partnerIds: visiblePartnerIds,
      userIds: [],
      description: '可查看全量数据',
    };
  }

  if (user.role === 'admin') {
    return {
      user: currentUser,
      scopeType: 'region',
      regions: dedupeOpenApiStrings([user.region]),
      bigRegions: dedupeOpenApiStrings([user.bigRegion]),
      partnerIds: visiblePartnerIds,
      userIds: [],
      description: '可查看本区域数据',
    };
  }

  if (user.role === 'partner_admin') {
    return {
      user: currentUser,
      scopeType: 'partner',
      regions: dedupeOpenApiStrings([user.region]),
      bigRegions: dedupeOpenApiStrings([user.bigRegion]),
      partnerIds: visiblePartnerIds.length ? visiblePartnerIds : dedupeOpenApiStrings([user.partnerId]),
      userIds: [],
      description: '可查看本渠道及关联渠道数据',
    };
  }

  return {
    user: currentUser,
    scopeType: 'user',
    regions: dedupeOpenApiStrings([user.region]),
    bigRegions: dedupeOpenApiStrings([user.bigRegion]),
    partnerIds: dedupeOpenApiStrings([user.partnerId]),
    userIds: dedupeOpenApiStrings([user.id]),
    description: '仅可查看本人相关数据',
  };
}

function buildOpenApiDictionaries() {
  const buildItems = (values, labels = {}) => dedupeOpenApiStrings(values).map((value, index) => ({
    value,
    label: labels[value] || value,
    sort: index + 1,
    enabled: true,
  }));

  const allBusinessObjects = [
    ...(Array.isArray(db.users) ? db.users : []),
    ...(Array.isArray(db.partners) ? db.partners : []),
    ...(Array.isArray(db.registrations) ? db.registrations : []),
    ...(Array.isArray(db.opportunities) ? db.opportunities : []),
    ...(Array.isArray(db.quotes) ? db.quotes : []),
    ...(Array.isArray(db.orders) ? db.orders : []),
    ...(Array.isArray(db.pendingApprovals) ? db.pendingApprovals : []),
    ...(Array.isArray(db.channelTargets) ? db.channelTargets : []),
    ...(Array.isArray(db.channelVisits) ? db.channelVisits : []),
  ];

  const registrationStatuses = buildItems(
    ['pending', 'approved', 'rejected', ...(Array.isArray(db.registrations) ? db.registrations.map(item => item?.status) : [])],
    {
      pending: '待审批',
      approved: '已通过',
      rejected: '已驳回',
    }
  );

  const opportunityStages = buildItems(
    ['contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', ...(Array.isArray(db.opportunities) ? db.opportunities.map(item => item?.stage) : [])],
    {
      contacted: '已接触',
      qualified: '已确认',
      proposal: '方案/报价中',
      negotiation: '商务谈判',
      won: '已成交',
      lost: '已失单',
    }
  );

  const quoteStatuses = buildItems(
    ['draft', 'submitted', 'approved', 'rejected', 'converted', ...(Array.isArray(db.quotes) ? db.quotes.map(item => item?.status) : [])],
    {
      draft: '草稿',
      submitted: '已提交',
      approved: '已通过',
      rejected: '已驳回',
      converted: '已转订单',
    }
  );

  const orderStatuses = buildItems(
    ['pending', 'confirmed', 'primary_confirmed', 'rejected', 'completed', 'cancelled', ...(Array.isArray(db.orders) ? db.orders.map(item => item?.status) : [])],
    {
      pending: '待处理',
      confirmed: '已确认',
      primary_confirmed: '一级渠道已确认',
      rejected: '已驳回',
      completed: '已完成',
      cancelled: '已取消',
    }
  );

  const userStatuses = buildItems(
    ['active', 'pending', 'disabled', 'inactive', ...(Array.isArray(db.users) ? db.users.map(item => item?.status) : [])],
    {
      active: '正常可用',
      pending: '待审批',
      disabled: '禁用',
      inactive: '未激活/停用',
    }
  );

  const partnerStatuses = buildItems(
    ['active', 'pending', 'disabled', ...(Array.isArray(db.partners) ? db.partners.map(item => item?.status) : [])],
    {
      active: '已激活',
      pending: '待审批',
      disabled: '禁用',
    }
  );

  const customerClassificationValues = [
    ...(Array.isArray(db.registrations) ? db.registrations.flatMap(item => [item?.customerType, item?.customerCategory, item?.industry]) : []),
    ...(Array.isArray(db.opportunities) ? db.opportunities.flatMap(item => [item?.customerType, item?.customerCategory, item?.industry]) : []),
    ...(Array.isArray(db.quotes) ? db.quotes.flatMap(item => [item?.customerType, item?.customerCategory, item?.industry]) : []),
    ...(Array.isArray(db.orders) ? db.orders.flatMap(item => [item?.customerType, item?.customerCategory, item?.industry]) : []),
  ];

  const partnerTypeValues = (Array.isArray(db.partners) ? db.partners : []).map(item => {
    const isTechnical = getOpenApiTechnicalServiceProvider(item);
    return item?.partnerType || item?.type || (isTechnical ? 'technical_service_provider' : 'channel_partner');
  });

  const productStatuses = buildItems(
    [
      'active',
      'inactive',
      'disabled',
      ...(Array.isArray(db.categories) ? db.categories.map(item => item?.status) : []),
      ...(Array.isArray(db.modules) ? db.modules.map(item => item?.status) : []),
      ...(Array.isArray(db.features) ? db.features.map(item => item?.status) : []),
      ...(Array.isArray(db.hardwareProducts) ? db.hardwareProducts.map(item => item?.status) : []),
      ...(Array.isArray(db.packages) ? db.packages.map(item => item?.status) : []),
    ],
    {
      active: '启用',
      inactive: '停用',
      disabled: '禁用',
    }
  );

  const approvalTypes = buildItems(
    ['partner', 'staff', 'partner_admin', 'secondary_partner', ...(Array.isArray(db.pendingApprovals) ? db.pendingApprovals.map(item => item?.type) : [])],
    {
      partner: '渠道商审批',
      staff: '员工账号审批',
      partner_admin: '渠道管理员审批',
      secondary_partner: '二级渠道商审批',
    }
  );

  const approvalStatuses = buildItems(
    ['pending', 'approved', 'rejected', ...(Array.isArray(db.pendingApprovals) ? db.pendingApprovals.map(item => item?.status) : [])],
    {
      pending: '待审批',
      approved: '已通过',
      rejected: '已驳回',
    }
  );

  const notificationTypes = buildItems(
    ['due_reminder', 'system', ...(Array.isArray(db.notifications) ? db.notifications.map(item => item?.type) : [])],
    {
      due_reminder: '到期提醒',
      system: '系统通知',
    }
  );

  const channelVisitTypes = buildItems(
    ['onsite', 'remote', 'phone', ...(Array.isArray(db.channelVisits) ? db.channelVisits.map(item => item?.type) : [])],
    {
      onsite: '现场拜访',
      remote: '远程沟通',
      phone: '电话沟通',
    }
  );

  const channelVisitStatuses = buildItems(
    ['planned', 'completed', 'cancelled', ...(Array.isArray(db.channelVisits) ? db.channelVisits.map(item => item?.status) : [])],
    {
      planned: '计划中',
      completed: '已完成',
      cancelled: '已取消',
    }
  );

  const workloadProductTypes = buildItems(
    ['EPP', 'DES', 'NXG', ...(Array.isArray(db.implementationWorkloadRules) ? db.implementationWorkloadRules.map(item => item?.productType) : [])],
    {
      EPP: '终端安全/DLP基础',
      DES: '数据安全',
      NXG: '准入/NXG',
    }
  );

  const workloadDeliveryTags = buildItems(
    [
      'EPP_BASE',
      'DES_BASE',
      'NXG_WITH_DLP',
      'NXG_NO_DLP',
      'SENSITIVE_DATA',
      ...((Array.isArray(db.implementationWorkloadMappings) ? db.implementationWorkloadMappings : [])
        .flatMap(item => Array.isArray(item?.deliveryTags) ? item.deliveryTags : [])),
    ],
    {
      EPP_BASE: 'EPP基础交付',
      DES_BASE: 'DES基础交付',
      NXG_WITH_DLP: 'NXG含DLP',
      NXG_NO_DLP: 'NXG不含DLP',
      SENSITIVE_DATA: '敏感数据梳理',
    }
  );

  const auditModules = buildItems(['auth', 'registration', 'opportunity', 'quote', 'order', 'user', 'partner', 'approval', 'product', 'openapi', 'system']);
  const auditActions = buildItems(['create', 'update', 'delete', 'approve', 'reject', 'login', 'export', 'import', 'primary_confirm', 'primary_reject']);
  const auditResults = buildItems(['success', 'failure'], { success: '成功', failure: '失败' });
  const openApiResources = buildItems(Array.from(OPEN_API_ALLOWED_RESOURCES), OPEN_API_RESOURCE_LABELS);

  return {
    roles: buildItems(['superadmin', 'admin', 'partner_admin', 'staff'], {
      superadmin: '超级管理员',
      admin: '区域管理员',
      partner_admin: '渠道管理员',
      staff: '员工',
    }),
    partnerLevels: buildItems(['none', 'primary', 'secondary', ...(Array.isArray(db.partners) ? db.partners.map(item => item?.partnerLevel) : [])], {
      none: '未设置',
      primary: '一级渠道',
      secondary: '二级渠道',
    }),
    partnerTypes: buildItems(['channel_partner', 'technical_service_provider', ...partnerTypeValues], {
      channel_partner: '渠道商',
      technical_service_provider: '技术服务商',
    }),
    partnerCooperationLevels: buildItems(['lep', 'gold', 'silver', 'diamond', ...(Array.isArray(db.partners) ? db.partners.map(item => item?.level) : [])], {
      lep: 'LEP',
      gold: '金牌',
      silver: '银牌',
      diamond: '钻石',
    }),
    technicalServiceProviderTypes: buildItems(['true', 'false'], {
      true: '技术服务商',
      false: '非技术服务商',
    }),
    techServiceTypes: buildItems(['none', 'full', 'developing', 'nominated', ...(Array.isArray(db.partners) ? db.partners.map(item => item?.techServiceType || item?.technicalServiceProviderType) : [])], OPEN_API_TECH_SERVICE_TYPE_LABELS),
    customerCategories: buildItems(customerClassificationValues),
    customerTypes: buildItems(customerClassificationValues),
    registrationStatuses,
    opportunityStages,
    quoteStatuses,
    orderStatuses,
    userStatuses,
    partnerStatuses,
    productStatuses,
    approvalTypes,
    approvalStatuses,
    notificationTypes,
    channelVisitTypes,
    channelVisitStatuses,
    workloadProductTypes,
    workloadDeliveryTags,
    auditModules,
    auditActions,
    auditResults,
    openApiResources,
    openApiResourceGroups: OPEN_API_RESOURCE_GROUPS.map(group => ({
      key: group.key,
      label: group.label,
      resources: group.resources.map(resource => ({
        value: resource,
        label: OPEN_API_RESOURCE_LABELS[resource] || resource,
      })),
    })),
    publishStatuses: buildItems(['published', 'unpublished'], {
      published: '已发布',
      unpublished: '未发布',
    }),
    priceTypes: buildItems(['tiered', 'fixed'], {
      tiered: '阶梯价',
      fixed: '固定价',
    }),
    businessFieldDictionary: {
      users: ['userId', 'username', 'displayName', 'role', 'roleName', 'region', 'bigRegion', 'partnerId', 'status'],
      partners: ['partnerId', 'partnerName', 'partnerLevel', 'partnerLevelName', 'cooperationLevel', 'cooperationLevelName', 'level', 'techServiceType', 'techServiceTypeName', 'technicalServiceProviderType', 'technicalServiceProviderTypeName', 'region', 'city', 'bigRegion', 'parentPartnerIds', 'isTechnicalServiceProvider'],
      registrations: ['registrationId', 'customer', 'customerId', 'status', 'protectUntil', 'partnerId', 'assignedStaffId', 'region'],
      opportunities: ['opportunityId', 'opportunityName', 'customer', 'stage', 'stageName', 'expectedClose', 'ownerId', 'partnerId', 'amount'],
      quotes: ['quoteId', 'customer', 'opportunityIds', 'partnerId', 'assignedStaffId', 'amount', 'totalAmount', 'status'],
      orders: ['orderId', 'orderNo', 'quoteId', 'opportunityId', 'partnerId', 'amount', 'totalAmount', 'status', 'dealAt'],
      products: ['categoryId', 'moduleId', 'featureId', 'productCode', 'priceType', 'tiers', 'regionPriceOverrides', 'published'],
      operations: ['notificationId', 'approvalId', 'channelTargetId', 'channelVisitId', 'year', 'type', 'status'],
      workload: ['workloadId', 'featureId', 'deliveryTags', 'productType', 'personDays', 'active'],
      auditLogs: ['auditLogId', 'createdAt', 'actorUserId', 'module', 'action', 'targetType', 'targetId', 'result'],
    },
    regions: buildItems(allBusinessObjects.map(item => item?.region)),
    cities: buildItems([...PREFECTURE_LEVEL_CITIES, ...allBusinessObjects.map(item => item?.city)]),
    bigRegions: buildItems(allBusinessObjects.map(item => item?.bigRegion)),
    timeFields: [
      { field: 'createdAt', format: 'ISO 8601', timezone: 'Asia/Shanghai', meaning: '创建时间' },
      { field: 'updatedAt', format: 'ISO 8601', timezone: 'Asia/Shanghai', meaning: '更新时间' },
      { field: 'approvedAt', format: 'ISO 8601', timezone: 'Asia/Shanghai', meaning: '审批时间' },
      { field: 'expectedClose', format: 'ISO 8601 or date', timezone: 'Asia/Shanghai', meaning: '预计成交时间' },
      { field: 'protectUntil', format: 'ISO 8601 or date', timezone: 'Asia/Shanghai', meaning: '客户报备保护期' },
      { field: 'visitDate', format: 'date', timezone: 'Asia/Shanghai', meaning: '渠道拜访日期' },
    ],
  };
}

function openApiTextIncludes(value, expected) {
  const text = String(value || '').trim().toLowerCase();
  const target = String(expected || '').trim().toLowerCase();
  return Boolean(target) && text.includes(target);
}

function openApiValueEqualsAny(values, expected) {
  const target = String(expected || '').trim();
  if (!target) return false;
  return dedupeOpenApiStrings(values).some(value => value === target);
}

function applyOpenApiObjectFilters(items, query, options = {}) {
  let list = items.slice();
  if (query.status && options.statusField) {
    list = list.filter(item => String(item?.[options.statusField] || '') === String(query.status));
  }
  if (query.stage && options.stageField) {
    list = list.filter(item => String(item?.[options.stageField] || '') === String(query.stage));
  }
  if (query.region && options.regionField) {
    list = list.filter(item => String(item?.[options.regionField] || '') === String(query.region));
  }
  if (query.city && options.cityField) {
    list = list.filter(item => String(item?.[options.cityField] || '') === String(query.city));
  }
  if (query.bigRegion) {
    list = list.filter(item => String(item?.bigRegion || '') === String(query.bigRegion));
  }
  if (query.partnerId) {
    list = list.filter(item => isSamePartnerScope(item, String(query.partnerId)));
  }
  if (query.assignedStaffId) {
    list = list.filter(item => String(item?.assignedStaffId || '') === String(query.assignedStaffId));
  }
  if (query.ownerId) {
    list = list.filter(item => String(item?.ownerId || '') === String(query.ownerId));
  }
  if (query.createdBy) {
    list = list.filter(item => String(item?.createdBy || '') === String(query.createdBy));
  }
  if (query.partnerLevel) {
    list = list.filter(item => String(item?.partnerLevel || '') === String(query.partnerLevel));
  }
  if (query.cooperationLevel) {
    list = list.filter(item => String(item?.cooperationLevel || item?.level || '') === String(query.cooperationLevel));
  }
  if (query.techServiceType || query.technicalServiceProviderType) {
    const expected = String(query.techServiceType || query.technicalServiceProviderType || '').trim();
    list = list.filter(item => String(item?.techServiceType || item?.technicalServiceProviderType || '') === expected);
  }
  if (query.customer) {
    list = list.filter(item =>
      openApiTextIncludes(item?.customer, query.customer) ||
      openApiTextIncludes(item?.customerName, query.customer)
    );
  }
  if (query.customerId) {
    list = list.filter(item => openApiValueEqualsAny([
      item?.customerId,
      item?.creditCode,
      item?.customer,
      item?.customerName,
    ], query.customerId));
  }
  if (query.registrationId) {
    list = list.filter(item => openApiValueEqualsAny([
      item?.registrationId,
      item?.regId,
      item?.id,
    ], query.registrationId));
  }
  if (query.opportunityId) {
    list = list.filter(item => openApiValueEqualsAny([
      item?.opportunityId,
      item?.oppId,
      ...(Array.isArray(item?.opportunityIds) ? item.opportunityIds : []),
      ...(Array.isArray(item?.oppIds) ? item.oppIds : []),
      item?.id,
    ], query.opportunityId));
  }
  if (query.quoteId) {
    list = list.filter(item => openApiValueEqualsAny([
      item?.quoteId,
      item?.id,
    ], query.quoteId));
  }
  if (query.orderId) {
    list = list.filter(item => openApiValueEqualsAny([
      item?.orderId,
      item?.orderNo,
      item?.orderNumber,
      item?.id,
    ], query.orderId));
  }
  if (query.ownerName) {
    list = list.filter(item =>
      openApiTextIncludes(item?.ownerName, query.ownerName) ||
      openApiTextIncludes(item?.assignedStaffName, query.ownerName) ||
      openApiTextIncludes(item?.createdByName, query.ownerName)
    );
  }
  if (query.partnerName) {
    list = list.filter(item => openApiTextIncludes(item?.partnerName || item?.name, query.partnerName));
  }
  if (query.type) {
    list = list.filter(item => String(item?.type || item?.approvalType || '') === String(query.type));
  }
  if (query.year) {
    list = list.filter(item => String(item?.year || '') === String(query.year));
  }
  if (query.module) {
    list = list.filter(item => String(item?.module || '') === String(query.module));
  }
  if (query.action) {
    list = list.filter(item => String(item?.action || '') === String(query.action));
  }
  if (query.result) {
    list = list.filter(item => String(item?.result || '') === String(query.result));
  }
  if (query.targetType) {
    list = list.filter(item => String(item?.targetType || item?.target_type || '') === String(query.targetType));
  }
  if (query.targetId) {
    list = list.filter(item => openApiValueEqualsAny([item?.targetId, item?.target_id], query.targetId));
  }
  if (query.userId) {
    list = list.filter(item => openApiValueEqualsAny([item?.userId, item?.actorUserId, item?.actor_user_id, item?.createdBy], query.userId));
  }
  if (query.orderNo) {
    list = list.filter(item => openApiValueEqualsAny([
      item?.orderNo,
      item?.orderNumber,
      item?.orderId,
      item?.id,
    ], query.orderNo));
  }
  if (query.isTechnicalServiceProvider !== undefined) {
    const expected = normalizeOpenApiBoolean(query.isTechnicalServiceProvider);
    list = list.filter(item => Boolean(item?.isTechnicalServiceProvider) === expected);
  }
  if (query.keyword && Array.isArray(options.searchFields) && options.searchFields.length > 0) {
    list = applyOpenApiKeywordFilter(list, query.keyword, options.searchFields);
  }
  list = applyOpenApiTimeFilters(list, query);
  return sortOpenApiItems(list, query, options.defaultSortField || 'updatedAt');
}

function canOpenApiAccessResource(client, resource) {
  if (!resource || resource === '*') return true;
  const list = Array.isArray(client?.allowedResources) && client.allowedResources.length ? client.allowedResources : ['*'];
  return list.includes('*') || list.includes(resource);
}

function ensureOpenApiResourcesAllowed(req, res, resources) {
  const list = Array.isArray(resources) ? resources : [resources];
  const denied = list.find(resource => !canOpenApiAccessResource(req.openApi?.client, resource));
  if (denied) {
    sendOpenApiError(req, res, 403, 40303, `resource not allowed: ${denied}`);
    return false;
  }
  return true;
}

function groupOpenApiItems(items, groupBy, options = {}) {
  const dateField = options.dateField || 'createdAt';
  const granularity = options.granularity || 'month';
  const groups = new Map();
  items.forEach(item => {
    let key = '';
    if (groupBy === 'month' || groupBy === 'day' || groupBy === 'year') {
      key = getOpenApiDateBucket(item, dateField, groupBy);
    } else {
      key = String(item?.[groupBy] || '未设置');
    }
    if (!key) key = '未设置';
    const current = groups.get(key) || { key, count: 0, amount: 0 };
    current.count += 1;
    current.amount += getOpenApiAmount(item);
    groups.set(key, current);
  });
  return Array.from(groups.values()).sort((a, b) => {
    if (groupBy === 'month' || groupBy === 'day' || groupBy === 'year') {
      return String(a.key).localeCompare(String(b.key));
    }
    return b.amount - a.amount || b.count - a.count || String(a.key).localeCompare(String(b.key), 'zh-CN');
  });
}

function topOpenApiItems(items, field, limit = 10) {
  return groupOpenApiItems(items, field)
    .filter(item => item.key && item.key !== '未设置')
    .slice(0, limit);
}

function getOpenApiAnalyticsStatusField(resource) {
  return resource === 'opportunities' ? 'stage' : 'status';
}

function normalizeOpenApiAnalyticsGranularity(value) {
  const granularity = String(value || 'month').trim();
  return ['day', 'month', 'year'].includes(granularity) ? granularity : 'month';
}

function buildOpenApiPartnerLookup(partners = []) {
  const lookup = new Map();
  (Array.isArray(partners) ? partners : []).forEach(partner => {
    const normalized = normalizeOpenApiRecord('partners', partner);
    [
      normalized?.partnerId,
      normalized?.id,
      normalized?.partnerName,
      normalized?.name,
    ].filter(Boolean).forEach(key => {
      if (!lookup.has(String(key))) lookup.set(String(key), normalized);
    });
  });
  return lookup;
}

function attachOpenApiPartnerDimensions(items, partners = []) {
  const lookup = buildOpenApiPartnerLookup(partners);
  return (Array.isArray(items) ? items : []).map(item => {
    const partnerKey = item?.partnerId || item?.assignedPartnerId || item?.partnerName || item?.assignedPartnerName || '';
    const partner = lookup.get(String(partnerKey)) || null;
    if (!partner) {
      const techServiceType = item?.techServiceType || item?.technicalServiceProviderType || '';
      return {
        ...item,
        techServiceType,
        techServiceTypeName: item?.techServiceTypeName || item?.technicalServiceProviderTypeName || getOpenApiTechServiceTypeName(techServiceType),
        technicalServiceProviderType: techServiceType,
        technicalServiceProviderTypeName: item?.technicalServiceProviderTypeName || item?.techServiceTypeName || getOpenApiTechServiceTypeName(techServiceType),
      };
    }
    const cooperationLevel = item?.cooperationLevel || item?.level || partner.cooperationLevel || partner.level || '';
    const techServiceType = item?.techServiceType || item?.technicalServiceProviderType || partner.techServiceType || partner.technicalServiceProviderType || '';
    const partnerLevel = item?.partnerLevel || partner.partnerLevel || '';
    return {
      ...item,
      partnerLevel,
      partnerLevelName: item?.partnerLevelName || partner.partnerLevelName || getOpenApiPartnerLevelName(partnerLevel),
      cooperationLevel,
      cooperationLevelName: item?.cooperationLevelName || partner.cooperationLevelName || getOpenApiCooperationLevelName(cooperationLevel),
      techServiceType,
      techServiceTypeName: item?.techServiceTypeName || partner.techServiceTypeName || getOpenApiTechServiceTypeName(techServiceType),
      technicalServiceProviderType: techServiceType,
      technicalServiceProviderTypeName: item?.technicalServiceProviderTypeName || partner.technicalServiceProviderTypeName || getOpenApiTechServiceTypeName(techServiceType),
      isTechnicalServiceProvider: item?.isTechnicalServiceProvider !== undefined ? item.isTechnicalServiceProvider : Boolean(partner.isTechnicalServiceProvider),
    };
  });
}

function buildOpenApiAnalyticsDimensions(resource, items = [], query = {}) {
  const statusField = getOpenApiAnalyticsStatusField(resource);
  return {
    resource,
    statusField,
    byStatus: groupOpenApiItems(items, statusField),
    statusDistribution: groupOpenApiItems(items, statusField),
    byRegion: groupOpenApiItems(items, 'region'),
    byCity: groupOpenApiItems(items, 'city'),
    byBigRegion: groupOpenApiItems(items, 'bigRegion'),
    byPartnerLevel: groupOpenApiItems(items, 'partnerLevel'),
    byCooperationLevel: groupOpenApiItems(items, 'cooperationLevel'),
    byTechServiceType: groupOpenApiItems(items, 'techServiceType'),
    byTechnicalServiceProviderType: groupOpenApiItems(items, 'technicalServiceProviderType'),
    byPartner: groupOpenApiItems(items, 'partnerId'),
    byPartnerName: groupOpenApiItems(items, 'partnerName'),
    dateField: String(query.dateField || 'createdAt').trim() || 'createdAt',
    granularity: normalizeOpenApiAnalyticsGranularity(query.granularity),
  };
}

function buildOpenApiAnalyticsTimeSeries(resource, items = [], query = {}) {
  const statusField = getOpenApiAnalyticsStatusField(resource);
  const dateField = String(query.dateField || 'createdAt').trim() || 'createdAt';
  const granularity = normalizeOpenApiAnalyticsGranularity(query.granularity);
  const groups = new Map();

  (Array.isArray(items) ? items : []).forEach(item => {
    const period = getOpenApiDateBucket(item, dateField, granularity) || '未设置';
    const current = groups.get(period) || { period, key: period, count: 0, amount: 0, items: [] };
    current.count += 1;
    current.amount += getOpenApiAmount(item);
    current.items.push(item);
    groups.set(period, current);
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (a.period === '未设置') return 1;
    if (b.period === '未设置') return -1;
    return String(a.period).localeCompare(String(b.period));
  }).map(row => {
    const bucketItems = row.items;
    return {
      period: row.period,
      key: row.key,
      count: row.count,
      amount: row.amount,
      byStatus: groupOpenApiItems(bucketItems, statusField),
      byCooperationLevel: groupOpenApiItems(bucketItems, 'cooperationLevel'),
      byTechServiceType: groupOpenApiItems(bucketItems, 'techServiceType'),
      byRegion: groupOpenApiItems(bucketItems, 'region'),
      byCity: groupOpenApiItems(bucketItems, 'city'),
      byBigRegion: groupOpenApiItems(bucketItems, 'bigRegion'),
    };
  });
}

function buildOpenApiBusinessDimensions(resources = {}, query = {}) {
  return Object.fromEntries(Object.entries(resources).map(([resource, items]) => [
    resource,
    buildOpenApiAnalyticsDimensions(resource, items, query),
  ]));
}

function buildOpenApiBusinessTimeSeries(resources = {}, query = {}) {
  return Object.fromEntries(Object.entries(resources).map(([resource, items]) => [
    resource,
    buildOpenApiAnalyticsTimeSeries(resource, items, query),
  ]));
}

function buildOpenApiResourceSummary(resource, items, query = {}) {
  const normalized = normalizeOpenApiList(resource, items);
  const amount = normalized.reduce((sum, item) => sum + getOpenApiAmount(item), 0);
  const statusField = getOpenApiAnalyticsStatusField(resource);
  const dateField = String(query.dateField || 'createdAt').trim() || 'createdAt';
  const granularity = normalizeOpenApiAnalyticsGranularity(query.granularity);
  const dimensions = buildOpenApiAnalyticsDimensions(resource, normalized, query);
  const timeSeries = buildOpenApiAnalyticsTimeSeries(resource, normalized, query);
  return {
    resource,
    totalCount: normalized.length,
    totalAmount: amount,
    statusField,
    byStatus: groupOpenApiItems(normalized, statusField),
    byRegion: groupOpenApiItems(normalized, 'region'),
    byCity: groupOpenApiItems(normalized, 'city'),
    byBigRegion: groupOpenApiItems(normalized, 'bigRegion'),
    byMonth: groupOpenApiItems(normalized, granularity, { dateField, granularity }),
    byCooperationLevel: dimensions.byCooperationLevel,
    byTechServiceType: dimensions.byTechServiceType,
    statusDistribution: dimensions.statusDistribution,
    dimensions,
    timeSeries,
    topCustomers: topOpenApiItems(normalized, 'customer'),
    topPartners: topOpenApiItems(normalized, 'partnerId'),
    topStaff: topOpenApiItems(normalized, 'assignedStaffId'),
    topOwners: topOpenApiItems(normalized, 'ownerId'),
    dataSource: 'CRM_STANDARD_OPEN_API',
  };
}

function filterOpenApiAnalyticsItems(user, resource, query = {}) {
  const statusField = getOpenApiAnalyticsStatusField(resource);
  let items = getOpenApiScopedResourceItems(user, resource);
  if (resource !== 'partners') {
    items = attachOpenApiPartnerDimensions(items, getOpenApiScopedResourceItems(user, 'partners'));
  }
  if (resource === 'partners') {
    return applyOpenApiObjectFilters(items, query, {
      ...getOpenApiPartnerAnalyticsFilterOptions(),
      statusField,
      stageField: statusField,
    });
  }
  return applyOpenApiObjectFilters(items, query, {
    statusField,
    stageField: statusField,
    regionField: 'region',
    searchFields: ['id', 'name', 'customer', 'customerName', 'partnerName', 'createdByName', 'assignedStaffName', 'ownerName', 'cooperationLevel', 'techServiceType'],
    defaultSortField: 'updatedAt',
  });
}

function buildOpenApiPartnerProfile(partners, query = {}) {
  const normalized = normalizeOpenApiList('partners', partners);
  const dimensions = buildOpenApiAnalyticsDimensions('partners', normalized, query);
  return {
    totalCount: normalized.length,
    activeCount: normalized.filter(item => item.status === 'active').length,
    technicalServiceProviderCount: normalized.filter(item => item.isTechnicalServiceProvider).length,
    nonTechnicalServiceProviderCount: normalized.filter(item => !item.isTechnicalServiceProvider).length,
    byPartnerLevel: groupOpenApiItems(normalized, 'partnerLevel'),
    byCooperationLevel: groupOpenApiItems(normalized, 'cooperationLevel'),
    byTechServiceType: groupOpenApiItems(normalized, 'techServiceType'),
    byTechnicalServiceProviderType: groupOpenApiItems(normalized, 'technicalServiceProviderType'),
    byTechnicalServiceProvider: groupOpenApiItems(normalized.map(item => ({
      ...item,
      technicalServiceProviderLabel: item.isTechnicalServiceProvider ? '技术服务商' : '非技术服务商',
    })), 'technicalServiceProviderLabel'),
    byStatus: groupOpenApiItems(normalized, 'status'),
    statusDistribution: dimensions.statusDistribution,
    byRegion: groupOpenApiItems(normalized, 'region'),
    byCity: groupOpenApiItems(normalized, 'city'),
    byBigRegion: groupOpenApiItems(normalized, 'bigRegion'),
    dimensions,
    timeSeries: buildOpenApiAnalyticsTimeSeries('partners', normalized, query),
    dataSource: 'CRM_STANDARD_OPEN_API',
  };
}

function getOpenApiPartnerAnalyticsFilterOptions() {
  return {
    statusField: 'status',
    regionField: 'region',
    cityField: 'city',
    searchFields: ['id', 'name', 'shortName', 'partnerLevel', 'partnerLevelName', 'cooperationLevel', 'cooperationLevelName', 'level', 'techServiceType', 'techServiceTypeName', 'technicalServiceProviderType', 'technicalServiceProviderTypeName', 'region', 'city', 'contact', 'phone', 'email'],
    defaultSortField: 'updatedAt',
  };
}

function isOpenApiTechnicalServiceProviderAnalyticsResource(resource) {
  return ['technical-service-providers', 'tech-service-providers'].includes(String(resource || '').trim());
}

function isOpenApiTechnicalServiceProviderAnalyticsItem(item) {
  const normalized = normalizeOpenApiRecord('partners', item) || {};
  const type = String(normalized.techServiceType || normalized.technicalServiceProviderType || '').trim();
  return Boolean(type && type !== 'none') || Boolean(normalized.isTechnicalServiceProvider);
}

function filterOpenApiTechnicalServiceProviderPartners(partners, query = {}) {
  if (query.techServiceType || query.technicalServiceProviderType) return partners;
  return (Array.isArray(partners) ? partners : []).filter(isOpenApiTechnicalServiceProviderAnalyticsItem);
}

function buildOpenApiPartnerContributionRows(user, partners) {
  const registrations = getOpenApiScopedResourceItems(user, 'registrations');
  const opportunities = getOpenApiScopedResourceItems(user, 'opportunities');
  const quotes = getOpenApiScopedResourceItems(user, 'quotes');
  const orders = getOpenApiScopedResourceItems(user, 'orders');

  return (Array.isArray(partners) ? partners : []).map(partner => {
    const normalized = normalizeOpenApiRecord('partners', partner);
    const partnerId = normalized.partnerId || normalized.id;
    const partnerRegistrations = registrations.filter(item => isSamePartnerScope(item, partnerId));
    const partnerOpportunities = opportunities.filter(item => isSamePartnerScope(item, partnerId));
    const partnerQuotes = quotes.filter(item => isSamePartnerScope(item, partnerId));
    const partnerOrders = orders.filter(item => isSamePartnerScope(item, partnerId));
    const opportunityAmount = partnerOpportunities.reduce((sum, item) => sum + getOpenApiAmount(item), 0);
    const quoteAmount = partnerQuotes.reduce((sum, item) => sum + getOpenApiAmount(item), 0);
    const orderAmount = partnerOrders.reduce((sum, item) => sum + getOpenApiAmount(item), 0);
    const techServiceType = normalized.techServiceType || normalized.technicalServiceProviderType || '';
    return {
      partnerId,
      partnerName: normalized.name || normalized.partnerName || '',
      partnerLevel: normalized.partnerLevel || '',
      partnerLevelName: normalized.partnerLevelName || getOpenApiPartnerLevelName(normalized.partnerLevel || ''),
      cooperationLevel: normalized.cooperationLevel || normalized.level || '',
      cooperationLevelName: normalized.cooperationLevelName || getOpenApiCooperationLevelName(normalized.cooperationLevel || normalized.level || ''),
      techServiceType,
      techServiceTypeName: normalized.techServiceTypeName || normalized.technicalServiceProviderTypeName || getOpenApiTechServiceTypeName(techServiceType),
      technicalServiceProviderType: techServiceType,
      technicalServiceProviderTypeName: normalized.technicalServiceProviderTypeName || normalized.techServiceTypeName || getOpenApiTechServiceTypeName(techServiceType),
      isTechnicalServiceProvider: Boolean(normalized.isTechnicalServiceProvider),
      status: normalized.status || '',
      region: normalized.region || '',
      city: normalized.city || '',
      bigRegion: normalized.bigRegion || '',
      registrationCount: partnerRegistrations.length,
      opportunityCount: partnerOpportunities.length,
      opportunityAmount,
      quoteCount: partnerQuotes.length,
      quoteAmount,
      orderCount: partnerOrders.length,
      orderAmount,
    };
  }).sort((a, b) => b.orderAmount - a.orderAmount || b.opportunityAmount - a.opportunityAmount || b.orderCount - a.orderCount);
}

function buildOpenApiContributionRow(key, label, itemsByResource) {
  const registrations = itemsByResource.registrations || [];
  const opportunities = itemsByResource.opportunities || [];
  const quotes = itemsByResource.quotes || [];
  const orders = itemsByResource.orders || [];
  const opportunityAmount = opportunities.reduce((sum, item) => sum + getOpenApiAmount(item), 0);
  const quoteAmount = quotes.reduce((sum, item) => sum + getOpenApiAmount(item), 0);
  const orderAmount = orders.reduce((sum, item) => sum + getOpenApiAmount(item), 0);
  return {
    key,
    label: label || key || '未设置',
    registrationCount: registrations.length,
    opportunityCount: opportunities.length,
    opportunityAmount,
    quoteCount: quotes.length,
    quoteAmount,
    orderCount: orders.length,
    orderAmount,
  };
}

function groupOpenApiContributionByField(resources, field, labelResolver = value => value) {
  const keys = new Set();
  Object.values(resources).forEach(items => {
    (items || []).forEach(item => keys.add(String(item?.[field] || '未设置')));
  });
  return Array.from(keys).map(key => {
    const itemsByResource = {};
    Object.entries(resources).forEach(([resource, items]) => {
      itemsByResource[resource] = (items || []).filter(item => String(item?.[field] || '未设置') === key);
    });
    return buildOpenApiContributionRow(key, labelResolver(key, itemsByResource), itemsByResource);
  }).sort((a, b) => b.orderAmount - a.orderAmount || b.opportunityAmount - a.opportunityAmount || b.orderCount - a.orderCount);
}

function getOpenApiScopedResourceItems(user, resource) {
  if (resource === 'users') return normalizeOpenApiList('users', scopeOpenApiUsers(user));
  if (resource === 'partners') return normalizeOpenApiList('partners', scopeOpenApiPartners(user));
  if (resource === 'registrations') return normalizeOpenApiList('registrations', scopeOpenApiRegistrations(user));
  if (resource === 'opportunities') return normalizeOpenApiList('opportunities', scopeOpenApiOpportunities(user));
  if (resource === 'quotes') return normalizeOpenApiList('quotes', scopeOpenApiQuotes(user));
  if (resource === 'orders') return normalizeOpenApiList('orders', scopeOpenApiOrders(user));
  if (resource === 'notifications') return normalizeOpenApiList('notifications', scopeOpenApiNotifications(user));
  if (resource === 'pending-approvals') return normalizeOpenApiList('pending-approvals', scopeOpenApiPendingApprovals(user));
  if (resource === 'channel-targets') return normalizeOpenApiList('channel-targets', scopeOpenApiChannelTargets(user));
  if (resource === 'channel-visits') return normalizeOpenApiList('channel-visits', scopeOpenApiChannelVisits(user));
  if (resource === 'categories') return normalizeOpenApiList('categories', Array.isArray(db.categories) ? db.categories : []);
  if (resource === 'modules') return normalizeOpenApiList('modules', Array.isArray(db.modules) ? db.modules : []);
  if (resource === 'features') return normalizeOpenApiList('features', Array.isArray(db.features) ? db.features.map(item => normalizeStandardMaintenanceFeatureConfig(item)) : []);
  if (resource === 'hardware') return normalizeOpenApiList('hardware', Array.isArray(db.hardwareProducts) ? db.hardwareProducts : []);
  if (resource === 'packages') return normalizeOpenApiList('packages', Array.isArray(db.packages) ? db.packages : []);
  if (resource === 'products') return normalizeOpenApiList('products', Array.isArray(db.products) ? db.products : []);
  if (resource === 'product-tree') return normalizeOpenApiList('product-tree', buildOpenApiProductTree());
  if (resource === 'product-stats') return [buildOpenApiProductStats()];
  if (resource === 'dashboard-stats') return [buildOpenApiDashboardStats(user)];
  if (resource === 'channel-operations-overview') {
    return [buildChannelOperationsOverview(buildOpenApiChannelScopeParams(user))];
  }
  if (user?.role === 'superadmin') {
    if (resource === 'workload-classifications') return normalizeOpenApiList(resource, Array.isArray(db.implementationWorkloadClassifications) ? db.implementationWorkloadClassifications : []);
    if (resource === 'workload-delivery-rules') return normalizeOpenApiList(resource, getDeliveryWorkloadRuleRows());
    if (resource === 'workload-mappings') {
      const rows = buildImplementationWorkloadCatalogItems().map(catalogItem => {
        const mapping = db.implementationWorkloadMappings.find(item => item.featureId === catalogItem.id) || null;
        const deliveryTags = getImplementationWorkloadMappingTags(mapping || {}, catalogItem.source);
        return {
          id: mapping?.id || `IWM-${catalogItem.id}`,
          itemType: catalogItem.itemType,
          featureId: catalogItem.id,
          featureName: catalogItem.name,
          moduleId: catalogItem.moduleId,
          moduleName: catalogItem.moduleName,
          categoryId: catalogItem.categoryId,
          categoryName: catalogItem.categoryName,
          productCode: catalogItem.productCode,
          productType: deriveLegacyProductTypeFromDeliveryTags(deliveryTags, mapping?.productType || ''),
          sensitiveKeyword: deliveryTags.includes('SENSITIVE_DATA') || Boolean(mapping?.sensitiveKeyword),
          deliveryTags,
          deliveryTagLabels: deliveryTags.map(getWorkloadDeliveryTagLabel),
          active: mapping?.active !== false,
          source: mapping?.source || 'manual',
          updatedAt: mapping?.updatedAt || mapping?.createdAt || catalogItem.source.updatedAt || catalogItem.source.createdAt || '',
        };
      });
      return normalizeOpenApiList(resource, rows);
    }
    if (resource === 'workload-rules') return normalizeOpenApiList(resource, Array.isArray(db.implementationWorkloadRules) ? db.implementationWorkloadRules : []);
  }
  return [];
}

function buildOpenApiDiagnostics(req) {
  const resources = Array.from(OPEN_API_ALLOWED_RESOURCES).filter(resource => resource !== '*' && !['analytics', 'diagnostics', 'identity', 'company-search', 'quote-workload-preview', 'ipg-quote-preview', 'audit-logs'].includes(resource));
  const dictionaries = buildOpenApiDictionaries();
  return {
    checkedAt: new Date().toISOString(),
    client: sanitizeOpenApiClient(req.openApi.client),
    user: buildOpenApiIdentityContext(req.openApi.user),
    permissionScope: buildOpenApiPermissionScope(req.openApi.user),
    token: {
      tokenType: 'Bearer',
      ttlSeconds: Math.floor(OPEN_API_TOKEN_TTL_MS / 1000),
    },
    limits: {
      defaultPageSize: OPEN_API_DEFAULT_PAGE_SIZE,
      maxPageSize: OPEN_API_MAX_PAGE_SIZE,
    },
    dictionaries: Object.fromEntries(Object.entries(dictionaries).map(([key, value]) => [
      key,
      { count: Array.isArray(value) ? value.length : 0 },
    ])),
    resources: resources.map(resource => {
      const allowed = canOpenApiAccessResource(req.openApi.client, resource);
      const visibleItems = allowed ? getOpenApiScopedResourceItems(req.openApi.user, resource) : [];
      return {
        resource,
        allowed,
        visibleCount: visibleItems.length,
        sampleId: visibleItems[0]?.id || '',
      };
    }),
    dataSource: 'CRM_STANDARD_OPEN_API',
  };
}

function writeOpenApiAudit(req, result) {
  const requestId = req.openApi?.requestId || createOpenApiRequestId();
  const client = req.openApi?.client || null;
  const user = req.openApi?.user || null;
  appendOpenApiAudit({
    requestId,
    time: new Date().toISOString(),
    clientId: client?.id || '',
    clientName: client?.name || '',
    boundUserId: user?.id || '',
    boundUsername: user?.username || '',
    method: req.method,
    path: req.originalUrl,
    ip: getRequestIp(req),
    resultCode: result.code,
    resultMessage: result.message,
    returnedCount: result.returnedCount || 0,
  });
}

function sendOpenApiSuccess(req, res, data, extra = {}) {
  const payload = {
    code: 0,
    message: 'ok',
    data: sanitizeOpenApiOutput(data),
    requestId: req.openApi?.requestId || createOpenApiRequestId(),
    ...extra,
  };
  writeOpenApiAudit(req, {
    code: 0,
    message: 'ok',
    returnedCount: Array.isArray(data) ? data.length : (extra.total || (data ? 1 : 0)),
  });
  return res.json(payload);
}

function sendOpenApiError(req, res, httpStatus, code, message) {
  const payload = {
    code,
    message,
    requestId: req.openApi?.requestId || createOpenApiRequestId(),
  };
  writeOpenApiAudit(req, { code, message, returnedCount: 0 });
  return res.status(httpStatus).json(payload);
}

function sendOpenApiPagedResource(req, res, resource, items, options = {}) {
  let list = normalizeOpenApiList(resource, items);
  list = applyOpenApiObjectFilters(list, req.query, {
    statusField: options.statusField === undefined ? 'status' : options.statusField,
    stageField: options.stageField === undefined ? '' : options.stageField,
    regionField: options.regionField === undefined ? 'region' : options.regionField,
    searchFields: options.searchFields || ['id', 'name', 'title', 'customer', 'customerName', 'partnerName', 'featureName', 'moduleName', 'targetName'],
    defaultSortField: options.defaultSortField || 'updatedAt',
  });
  if (typeof options.filter === 'function') {
    list = options.filter(list, req.query);
  }
  const page = applyOpenApiPagination(list, req.query);
  return sendOpenApiSuccess(req, res, page.list, {
    pageNo: page.pageNo,
    pageSize: page.pageSize,
    total: page.total,
  });
}

function findOpenApiItemById(items, id) {
  const target = String(id || '').trim();
  if (!target) return null;
  return (Array.isArray(items) ? items : []).find(item => {
    const values = [
      item?.id,
      item?.userId,
      item?.partnerId,
      item?.registrationId,
      item?.opportunityId,
      item?.quoteId,
      item?.orderId,
      item?.notificationId,
      item?.approvalId,
      item?.channelTargetId,
      item?.channelVisitId,
      item?.workloadId,
      item?.featureId,
      item?.auditLogId,
    ];
    return values.some(value => String(value || '') === target);
  }) || null;
}

function registerOpenApiResourceRoutes(resource, pathName, options = {}) {
  app.get(`/api/open/v1/${pathName}`, requireOpenApiAuth(resource), (req, res) => {
    const items = typeof options.getItems === 'function'
      ? options.getItems(req.openApi.user, req.query, req)
      : getOpenApiScopedResourceItems(req.openApi.user, resource);
    return sendOpenApiPagedResource(req, res, resource, items, options);
  });

  if (options.detail === false) return;

  app.get(`/api/open/v1/${pathName}/:id`, requireOpenApiAuth(resource), (req, res) => {
    const items = typeof options.getItems === 'function'
      ? options.getItems(req.openApi.user, req.query, req)
      : getOpenApiScopedResourceItems(req.openApi.user, resource);
    const item = findOpenApiItemById(normalizeOpenApiList(resource, items), req.params.id);
    if (!item) return sendOpenApiError(req, res, 404, 40410, `${resource} not found`);
    return sendOpenApiSuccess(req, res, item);
  });
}

async function runOpenApiCompanySearch(keyword, scopedLocalMatches) {
  const normalizedKeyword = String(keyword || '').trim();
  if (!normalizedKeyword || normalizedKeyword.length < 2) return { data: [], note: 'keyword_too_short' };

  const hasScopedLocalMatches = Array.isArray(scopedLocalMatches);
  const ledgerMatches = searchCustomerLedger(normalizedKeyword, 10);
  const localMatches = hasScopedLocalMatches ? scopedLocalMatches.slice(0, 10) : [];
  if (!hasScopedLocalMatches) {
    const registrations = Array.isArray(db.registrations) ? db.registrations : [];
    const lowerKeyword = normalizedKeyword.toLowerCase();
    const seenNames = new Set();
    for (const registration of registrations) {
      const customer = String(registration.customer || registration.customerName || '');
      if (!customer || !customer.toLowerCase().includes(lowerKeyword) || seenNames.has(customer)) continue;
      seenNames.add(customer);
      localMatches.push({
        name: customer,
        creditCode: registration.creditCode || '',
        legalPerson: registration.legalPerson || '',
        address: registration.address || registration.city || '',
        province: '',
        city: registration.city || '',
        companyStatus: '在营',
        industry: registration.industry || '',
        source: 'local',
      });
    }
  }

  if (!COMPANY_API_KEY) {
    return {
      data: hasScopedLocalMatches
        ? mergeCompanySearchResults(localMatches, ledgerMatches)
        : mergeCompanySearchResults(ledgerMatches, localMatches),
      note: 'no_api_key',
    };
  }

  const postData = `keyword=${encodeURIComponent(normalizedKeyword)}&pageNum=1&pageSize=10`;
  const apiResults = await new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'kzgsmhv1.market.alicloudapi.com',
      path: '/api/company_search/query',
      method: 'POST',
      headers: {
        Authorization: `APPCODE ${COMPANY_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0',
      },
    }, response => {
      let body = '';
      response.on('data', chunk => body += chunk);
      response.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.code === 200 && result.data && Array.isArray(result.data.companyList)) {
            resolve(result.data.companyList.map(item => ({
              name: item.companyName || '',
              creditCode: item.creditNo || '',
              legalPerson: item.legalPerson || '',
              address: item.address || '',
              province: item.province || '',
              city: item.city || '',
              companyStatus: item.companyStatus || '',
              industry: item.industry || '',
              source: 'api',
            })));
          } else {
            resolve([]);
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    request.on('error', reject);
    request.setTimeout(8000, () => {
      request.destroy();
      reject(new Error('company search timeout'));
    });
    request.write(postData);
    request.end();
  });

  return {
    data: hasScopedLocalMatches
      ? mergeCompanySearchResults(localMatches, ledgerMatches, apiResults)
      : mergeCompanySearchResults(ledgerMatches, localMatches, apiResults),
    note: '',
  };
}

function requireOpenApiManager(req, res, next) {
  ensureOpenApiData();
  const operatorId = String(req.body?.operatorId || req.query?.operatorId || req.headers['x-operator-id'] || '').trim();
  if (!operatorId) {
    return res.status(400).json({ success: false, error: '缺少 operatorId' });
  }
  const operator = db.users.find(item => item.id === operatorId);
  if (!operator || operator.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: '仅超级管理员可管理开放接口应用' });
  }
  req.openApiManager = operator;
  next();
}

function requireOpenApiAuth(resource) {
  return (req, res, next) => {
    ensureOpenApiData();
    pruneOpenApiAccessTokens();
    const requestId = createOpenApiRequestId();
    const authHeader = String(req.headers.authorization || '');
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const accessToken = bearerToken || String(req.headers['x-api-access-token'] || '').trim();
    if (!accessToken) {
      req.openApi = { requestId };
      return sendOpenApiError(req, res, 401, 40101, 'missing access token');
    }

    const tokenRecord = openApiAccessTokens.find(item => item.token === accessToken);
    if (!tokenRecord || tokenRecord.expiresAt <= Date.now()) {
      req.openApi = { requestId };
      return sendOpenApiError(req, res, 401, 40102, 'access token invalid');
    }

    const client = db.openApiClients.find(item => item.id === tokenRecord.clientId);
    if (!client || client.status !== 'active' || isOpenApiClientExpired(client)) {
      req.openApi = { requestId };
      return sendOpenApiError(req, res, 403, 40301, 'client is disabled or expired');
    }

    const requestIp = getRequestIp(req);
    if (!isIpAllowed(requestIp, client.ipWhitelist)) {
      req.openApi = { requestId, client };
      return sendOpenApiError(req, res, 403, 40302, 'ip not allowed');
    }

    if (!canOpenApiAccessResource(client, resource)) {
      req.openApi = { requestId, client };
      return sendOpenApiError(req, res, 403, 40303, 'resource not allowed');
    }

    const user = getOpenApiBoundUser(client);
    if (!user || user.status !== 'active') {
      req.openApi = { requestId, client };
      return sendOpenApiError(req, res, 403, 40304, 'bound crm user is unavailable');
    }

    req.openApi = {
      requestId,
      client,
      user,
      ip: requestIp,
    };
    next();
  };
}

function getOpenApiPublicBaseUrl(req) {
  const configured = String(process.env.OPEN_API_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const protocol = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = req.get('host') || `localhost:${PORT}`;
  return `${protocol}://${host}/api/open/v1`;
}

function buildOpenApiDocList() {
  return OPEN_API_MANAGED_DOCS.map(doc => {
    const filePath = path.join(OPEN_API_DOCS_DIR, doc.fileName);
    return {
      id: doc.id,
      title: doc.title,
      fileName: doc.fileName,
      description: doc.description,
      available: fs.existsSync(filePath),
      downloadUrl: `/api/open-api/docs/${doc.id}/download`,
    };
  });
}

app.get('/api/open-api/overview', requireOpenApiManager, (req, res) => {
  const baseUrl = getOpenApiPublicBaseUrl(req);
  res.json({
    success: true,
    data: {
      baseUrl,
      apiPrefix: '/api/open/v1',
      tokenEndpoint: `${baseUrl}/auth/token`,
      authHeader: 'Authorization: Bearer {accessToken}',
      tokenTtlSeconds: Math.floor(OPEN_API_TOKEN_TTL_MS / 1000),
      allowedResources: Array.from(OPEN_API_ALLOWED_RESOURCES),
      coreResources: OPEN_API_CORE_RESOURCES,
      productResources: OPEN_API_PRODUCT_RESOURCES,
      operationResources: OPEN_API_OPERATION_RESOURCES,
      configResources: OPEN_API_CONFIG_RESOURCES,
      systemResources: OPEN_API_SYSTEM_RESOURCES,
      resourceGroups: OPEN_API_RESOURCE_GROUPS.map(group => ({
        key: group.key,
        label: group.label,
        resources: group.resources,
      })),
      analyticsResources: ['partners', 'registrations', 'opportunities', 'quotes', 'orders'],
      docs: buildOpenApiDocList(),
    },
  });
});

app.get('/api/open-api/docs', requireOpenApiManager, (req, res) => {
  res.json({ success: true, data: buildOpenApiDocList() });
});

app.get('/api/open-api/docs/:id/download', requireOpenApiManager, (req, res) => {
  const doc = OPEN_API_MANAGED_DOCS.find(item => item.id === req.params.id);
  if (!doc) {
    return res.status(404).json({ success: false, error: '对接文档不存在' });
  }

  const filePath = path.join(OPEN_API_DOCS_DIR, doc.fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: '对接文档文件未找到' });
  }

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`);
  fs.createReadStream(filePath).pipe(res);
});

app.get('/api/open-api/clients', requireOpenApiManager, (req, res) => {
  ensureOpenApiData();
  const list = db.openApiClients
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map(item => ({
      ...sanitizeOpenApiClient(item),
      appKeyMasked: maskSecret(item.appKey),
      boundUser: sanitizeOpenApiOutput(getOpenApiBoundUser(item)),
    }));
  res.json({ success: true, data: list });
});

app.post('/api/open-api/clients', requireOpenApiManager, (req, res) => {
  ensureOpenApiData();
  const { name, boundUserId, ipWhitelist, allowedResources, expiresAt, remark } = req.body || {};
  if (!name || !boundUserId) {
    return res.status(400).json({ success: false, error: '缺少必要参数 name 或 boundUserId' });
  }
  const boundUser = db.users.find(item => item.id === boundUserId);
  if (!boundUser) {
    return res.status(404).json({ success: false, error: '绑定的 CRM 用户不存在' });
  }
  const appKey = generateOpenApiCredential('oak');
  const appSecret = generateOpenApiCredential('oas');
  const record = {
    id: `OAC-${Date.now()}`,
    name: String(name).trim(),
    appKey,
    appSecretHash: sha256(appSecret),
    boundUserId: boundUser.id,
    status: 'active',
    ipWhitelist: normalizeIpWhitelist(ipWhitelist),
    allowedResources: normalizeAllowedResources(allowedResources),
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : '',
    remark: String(remark || '').trim(),
    createdBy: req.openApiManager.id,
    createdByName: req.openApiManager.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.openApiClients.push(record);
  saveData();
  res.json({
    success: true,
    data: {
      ...sanitizeOpenApiClient(record),
      appSecret,
    },
    message: '开放接口应用创建成功，请妥善保存 appSecret',
  });
});

app.put('/api/open-api/clients/:id', requireOpenApiManager, (req, res) => {
  ensureOpenApiData();
  const client = db.openApiClients.find(item => item.id === req.params.id);
  if (!client) {
    return res.status(404).json({ success: false, error: '开放接口应用不存在' });
  }
  const updates = req.body || {};
  if (updates.boundUserId) {
    const boundUser = db.users.find(item => item.id === updates.boundUserId);
    if (!boundUser) {
      return res.status(404).json({ success: false, error: '绑定的 CRM 用户不存在' });
    }
    client.boundUserId = boundUser.id;
  }
  if (updates.name !== undefined) client.name = String(updates.name || '').trim();
  if (updates.status !== undefined) client.status = String(updates.status || '') === 'disabled' ? 'disabled' : 'active';
  if (updates.remark !== undefined) client.remark = String(updates.remark || '').trim();
  if (updates.ipWhitelist !== undefined) client.ipWhitelist = normalizeIpWhitelist(updates.ipWhitelist);
  if (updates.allowedResources !== undefined) client.allowedResources = normalizeAllowedResources(updates.allowedResources);
  if (updates.expiresAt !== undefined) client.expiresAt = updates.expiresAt ? new Date(updates.expiresAt).toISOString() : '';
  client.updatedAt = new Date().toISOString();
  saveData();
  res.json({ success: true, data: sanitizeOpenApiClient(client) });
});

app.post('/api/open-api/clients/:id/reset-secret', requireOpenApiManager, (req, res) => {
  ensureOpenApiData();
  const client = db.openApiClients.find(item => item.id === req.params.id);
  if (!client) {
    return res.status(404).json({ success: false, error: '开放接口应用不存在' });
  }
  const appSecret = generateOpenApiCredential('oas');
  client.appSecretHash = sha256(appSecret);
  client.updatedAt = new Date().toISOString();
  openApiAccessTokens = openApiAccessTokens.filter(item => item.clientId !== client.id);
  saveData();
  res.json({
    success: true,
    data: {
      id: client.id,
      appKey: client.appKey,
      appSecret,
    },
    message: '密钥已重置，请妥善保存新的 appSecret',
  });
});

app.get('/api/open-api/logs', requireOpenApiManager, (req, res) => {
  const limit = Math.min(500, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));
  if (!fs.existsSync(OPEN_API_AUDIT_LOG_FILE)) {
    return res.json({ success: true, data: [] });
  }
  const lines = fs.readFileSync(OPEN_API_AUDIT_LOG_FILE, 'utf8').split(/\r?\n/).filter(Boolean);
  const list = lines.slice(-limit).reverse().map(line => {
    try {
      return JSON.parse(line);
    } catch (err) {
      return { raw: line };
    }
  });
  res.json({ success: true, data: list });
});

app.post('/api/open/v1/auth/token', (req, res) => {
  ensureOpenApiData();
  pruneOpenApiAccessTokens();
  const requestId = createOpenApiRequestId();
  const appKey = String(req.body?.appKey || '').trim();
  const appSecret = String(req.body?.appSecret || '').trim();
  const requestIp = getRequestIp(req);
  const writeAuthAudit = (code, message, client) => {
    appendOpenApiAudit({
      requestId,
      time: new Date().toISOString(),
      clientId: client?.id || '',
      clientName: client?.name || '',
      method: req.method,
      path: req.originalUrl,
      ip: requestIp,
      resultCode: code,
      resultMessage: message,
      returnedCount: 0,
    });
  };

  if (!appKey || !appSecret) {
    writeAuthAudit(40111, 'missing appKey or appSecret');
    return res.status(400).json({ code: 40111, message: 'missing appKey or appSecret', requestId });
  }

  const client = db.openApiClients.find(item => item.appKey === appKey);
  if (!client || client.status !== 'active' || isOpenApiClientExpired(client)) {
    writeAuthAudit(40112, 'client invalid', client);
    return res.status(401).json({ code: 40112, message: 'client invalid', requestId });
  }
  if (!isIpAllowed(requestIp, client.ipWhitelist)) {
    writeAuthAudit(40312, 'ip not allowed', client);
    return res.status(403).json({ code: 40312, message: 'ip not allowed', requestId });
  }
  if (client.appSecretHash !== sha256(appSecret)) {
    writeAuthAudit(40113, 'appSecret invalid', client);
    return res.status(401).json({ code: 40113, message: 'appSecret invalid', requestId });
  }

  const user = getOpenApiBoundUser(client);
  if (!user || user.status !== 'active') {
    writeAuthAudit(40313, 'bound crm user unavailable', client);
    return res.status(403).json({ code: 40313, message: 'bound crm user unavailable', requestId });
  }

  const accessToken = buildAppToken('openapi');
  const expiresAt = Date.now() + OPEN_API_TOKEN_TTL_MS;
  openApiAccessTokens.push({
    token: accessToken,
    clientId: client.id,
    userId: user.id,
    expiresAt,
  });
  writeAuthAudit(0, 'ok', client);
  return res.json({
    code: 0,
    message: 'ok',
    data: {
      accessToken,
      expiresIn: Math.floor(OPEN_API_TOKEN_TTL_MS / 1000),
      tokenType: 'Bearer',
      clientId: client.id,
      clientName: client.name,
      boundUser: sanitizeOpenApiOutput(buildOpenApiUserContext(user)),
    },
    requestId,
  });
});

app.get('/api/open/v1/auth/me', requireOpenApiAuth('*'), (req, res) => {
  return sendOpenApiSuccess(req, res, {
    client: sanitizeOpenApiClient(req.openApi.client),
    user: buildOpenApiUserContext(req.openApi.user),
  });
});

app.get('/api/open/v1/meta/permission-scope', requireOpenApiAuth('*'), (req, res) => {
  return sendOpenApiSuccess(req, res, buildOpenApiPermissionScope(req.openApi.user));
});

app.get('/api/open/v1/meta/dictionaries', requireOpenApiAuth('*'), (req, res) => {
  return sendOpenApiSuccess(req, res, buildOpenApiDictionaries());
});

app.get('/api/open/v1/users', requireOpenApiAuth('users'), (req, res) => {
  let list = normalizeOpenApiList('users', scopeOpenApiUsers(req.openApi.user));
  list = applyOpenApiObjectFilters(list, req.query, {
    statusField: 'status',
    regionField: 'region',
    searchFields: ['id', 'username', 'name', 'role', 'region', 'partnerName', 'phone', 'email'],
    defaultSortField: 'updatedAt',
  });
  if (req.query.role) list = list.filter(item => String(item.role || '') === String(req.query.role));
  const page = applyOpenApiPagination(list, req.query);
  return sendOpenApiSuccess(req, res, page.list, {
    pageNo: page.pageNo,
    pageSize: page.pageSize,
    total: page.total,
  });
});

app.get('/api/open/v1/users/:id', requireOpenApiAuth('users'), (req, res) => {
  const item = normalizeOpenApiRecord('users', scopeOpenApiUsers(req.openApi.user).find(row => row.id === req.params.id));
  if (!item) return sendOpenApiError(req, res, 404, 40401, 'user not found');
  return sendOpenApiSuccess(req, res, item);
});

app.get('/api/open/v1/partners', requireOpenApiAuth('partners'), (req, res) => {
  let list = normalizeOpenApiList('partners', scopeOpenApiPartners(req.openApi.user));
  list = applyOpenApiObjectFilters(list, req.query, {
    statusField: 'status',
    regionField: 'region',
    cityField: 'city',
    searchFields: ['id', 'name', 'partnerLevel', 'partnerLevelName', 'cooperationLevel', 'cooperationLevelName', 'level', 'region', 'city', 'contact', 'phone', 'email'],
    defaultSortField: 'joinDate',
  });
  const page = applyOpenApiPagination(list, req.query);
  return sendOpenApiSuccess(req, res, page.list, {
    pageNo: page.pageNo,
    pageSize: page.pageSize,
    total: page.total,
  });
});

app.get('/api/open/v1/partners/:id', requireOpenApiAuth('partners'), (req, res) => {
  const item = normalizeOpenApiRecord('partners', scopeOpenApiPartners(req.openApi.user).find(row => row.id === req.params.id));
  if (!item) return sendOpenApiError(req, res, 404, 40402, 'partner not found');
  return sendOpenApiSuccess(req, res, item);
});

app.get('/api/open/v1/registrations', requireOpenApiAuth('registrations'), (req, res) => {
  let list = normalizeOpenApiList('registrations', scopeOpenApiRegistrations(req.openApi.user));
  list = applyOpenApiObjectFilters(list, req.query, {
    statusField: 'status',
    regionField: 'region',
    searchFields: ['id', 'customer', 'industry', 'contact', 'phone', 'partnerName', 'createdByName'],
    defaultSortField: 'updatedAt',
  });
  const page = applyOpenApiPagination(list, req.query);
  return sendOpenApiSuccess(req, res, page.list, {
    pageNo: page.pageNo,
    pageSize: page.pageSize,
    total: page.total,
  });
});

app.get('/api/open/v1/registrations/:id', requireOpenApiAuth('registrations'), (req, res) => {
  const item = normalizeOpenApiRecord('registrations', scopeOpenApiRegistrations(req.openApi.user).find(row => row.id === req.params.id));
  if (!item) return sendOpenApiError(req, res, 404, 40403, 'registration not found');
  return sendOpenApiSuccess(req, res, item);
});

app.get('/api/open/v1/opportunities', requireOpenApiAuth('opportunities'), (req, res) => {
  let list = normalizeOpenApiList('opportunities', scopeOpenApiOpportunities(req.openApi.user));
  list = applyOpenApiObjectFilters(list, req.query, {
    statusField: 'stage',
    stageField: 'stage',
    regionField: 'region',
    searchFields: ['id', 'name', 'customer', 'contact', 'phone', 'partnerName', 'createdByName'],
    defaultSortField: 'updatedAt',
  });
  const page = applyOpenApiPagination(list, req.query);
  return sendOpenApiSuccess(req, res, page.list, {
    pageNo: page.pageNo,
    pageSize: page.pageSize,
    total: page.total,
  });
});

app.get('/api/open/v1/opportunities/:id', requireOpenApiAuth('opportunities'), (req, res) => {
  const item = normalizeOpenApiRecord('opportunities', scopeOpenApiOpportunities(req.openApi.user).find(row => row.id === req.params.id));
  if (!item) return sendOpenApiError(req, res, 404, 40404, 'opportunity not found');
  return sendOpenApiSuccess(req, res, item);
});

app.get('/api/open/v1/quotes', requireOpenApiAuth('quotes'), (req, res) => {
  let list = normalizeOpenApiList('quotes', scopeOpenApiQuotes(req.openApi.user));
  list = applyOpenApiObjectFilters(list, req.query, {
    statusField: 'status',
    regionField: 'region',
    searchFields: ['id', 'customer', 'customerName', 'partnerName', 'createdByName'],
    defaultSortField: 'updatedAt',
  });
  const page = applyOpenApiPagination(list, req.query);
  return sendOpenApiSuccess(req, res, page.list, {
    pageNo: page.pageNo,
    pageSize: page.pageSize,
    total: page.total,
  });
});

app.get('/api/open/v1/quotes/:id', requireOpenApiAuth('quotes'), (req, res) => {
  const item = normalizeOpenApiRecord('quotes', scopeOpenApiQuotes(req.openApi.user).find(row => row.id === req.params.id));
  if (!item) return sendOpenApiError(req, res, 404, 40405, 'quote not found');
  return sendOpenApiSuccess(req, res, item);
});

app.get('/api/open/v1/orders', requireOpenApiAuth('orders'), (req, res) => {
  let list = normalizeOpenApiList('orders', scopeOpenApiOrders(req.openApi.user));
  list = applyOpenApiObjectFilters(list, req.query, {
    statusField: 'status',
    regionField: 'region',
    searchFields: ['id', 'customer', 'customerName', 'partnerName', 'createdByName', 'deliveryAddr'],
    defaultSortField: 'updatedAt',
  });
  const page = applyOpenApiPagination(list, req.query);
  return sendOpenApiSuccess(req, res, page.list, {
    pageNo: page.pageNo,
    pageSize: page.pageSize,
    total: page.total,
  });
});

app.get('/api/open/v1/orders/:id', requireOpenApiAuth('orders'), (req, res) => {
  const item = normalizeOpenApiRecord('orders', scopeOpenApiOrders(req.openApi.user).find(row => row.id === req.params.id));
  if (!item) return sendOpenApiError(req, res, 404, 40406, 'order not found');
  return sendOpenApiSuccess(req, res, item);
});

app.get('/api/open/v1/identity/users/:userId', requireOpenApiAuth('*'), (req, res) => {
  const requestedUserId = String(req.params.userId || '').trim();
  const currentUser = req.openApi.user;
  if (currentUser.role !== 'superadmin' && requestedUserId !== currentUser.id && requestedUserId !== currentUser.username) {
    return sendOpenApiError(req, res, 403, 40304, 'identity user is outside current crm user scope');
  }
  const visibleUser = scopeOpenApiUsers(req.openApi.user).find(row => row.id === req.params.userId || row.username === req.params.userId);
  if (!visibleUser) return sendOpenApiError(req, res, 404, 40401, 'user not found');
  return sendOpenApiSuccess(req, res, buildOpenApiIdentityContext(visibleUser));
});

app.get('/api/open/v1/diagnostics/self-check', requireOpenApiAuth('*'), (req, res) => {
  return sendOpenApiSuccess(req, res, buildOpenApiDiagnostics(req));
});

app.get('/api/open/v1/analytics/:resource/summary', requireOpenApiAuth('*'), (req, res) => {
  const resource = String(req.params.resource || '').trim();
  const supported = new Set(['partners', 'registrations', 'opportunities', 'quotes', 'orders']);
  const isTechnicalServiceProviderResource = isOpenApiTechnicalServiceProviderAnalyticsResource(resource);
  if (!supported.has(resource) && !isTechnicalServiceProviderResource) {
    return sendOpenApiError(req, res, 404, 40409, 'analytics resource not found');
  }
  if (isTechnicalServiceProviderResource) {
    if (!ensureOpenApiResourcesAllowed(req, res, 'partners')) return;
    const partners = filterOpenApiTechnicalServiceProviderPartners(
      filterOpenApiAnalyticsItems(req.openApi.user, 'partners', req.query),
      req.query
    );
    const summary = buildOpenApiResourceSummary('partners', partners, req.query);
    return sendOpenApiSuccess(req, res, {
      ...summary,
      resource,
      sourceResource: 'partners',
    });
  }
  if (!ensureOpenApiResourcesAllowed(req, res, resource)) return;

  let list = filterOpenApiAnalyticsItems(req.openApi.user, resource, req.query);

  return sendOpenApiSuccess(req, res, buildOpenApiResourceSummary(resource, list, req.query));
});

app.get('/api/open/v1/analytics/business-overview', requireOpenApiAuth('*'), (req, res) => {
  const resources = ['partners', 'registrations', 'opportunities', 'quotes', 'orders'];
  if (!ensureOpenApiResourcesAllowed(req, res, resources)) return;

  const filtered = {};
  resources.forEach(resource => {
    filtered[resource] = filterOpenApiAnalyticsItems(req.openApi.user, resource, req.query);
  });

  const registrationCount = filtered.registrations.length;
  const opportunityCount = filtered.opportunities.length;
  const quoteCount = filtered.quotes.length;
  const orderCount = filtered.orders.length;
  const orderAmount = filtered.orders.reduce((sum, item) => sum + getOpenApiAmount(item), 0);
  const rate = (numerator, denominator) => denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;

  return sendOpenApiSuccess(req, res, {
    scope: buildOpenApiPermissionScope(req.openApi.user),
    summaries: {
      partners: buildOpenApiResourceSummary('partners', filtered.partners, req.query),
      registrations: buildOpenApiResourceSummary('registrations', filtered.registrations, req.query),
      opportunities: buildOpenApiResourceSummary('opportunities', filtered.opportunities, req.query),
      quotes: buildOpenApiResourceSummary('quotes', filtered.quotes, req.query),
      orders: buildOpenApiResourceSummary('orders', filtered.orders, req.query),
    },
    dimensions: buildOpenApiBusinessDimensions(filtered, req.query),
    timeSeries: buildOpenApiBusinessTimeSeries(filtered, req.query),
    funnel: {
      stages: [
        { key: 'registrations', label: '客户报备', count: registrationCount },
        { key: 'opportunities', label: '商机', count: opportunityCount, conversionRateFromPrevious: rate(opportunityCount, registrationCount) },
        { key: 'quotes', label: '报价', count: quoteCount, conversionRateFromPrevious: rate(quoteCount, opportunityCount) },
        { key: 'orders', label: '订单', count: orderCount, amount: orderAmount, conversionRateFromPrevious: rate(orderCount, quoteCount) },
      ],
      totalConversionRate: rate(orderCount, registrationCount),
    },
    dataSource: 'CRM_STANDARD_OPEN_API',
  });
});

app.get('/api/open/v1/analytics/funnel', requireOpenApiAuth('*'), (req, res) => {
  const resources = ['registrations', 'opportunities', 'quotes', 'orders'];
  if (!ensureOpenApiResourcesAllowed(req, res, resources)) return;

  const registrations = filterOpenApiAnalyticsItems(req.openApi.user, 'registrations', req.query);
  const opportunities = filterOpenApiAnalyticsItems(req.openApi.user, 'opportunities', req.query);
  const quotes = filterOpenApiAnalyticsItems(req.openApi.user, 'quotes', req.query);
  const orders = filterOpenApiAnalyticsItems(req.openApi.user, 'orders', req.query);
  const groupedResources = { registrations, opportunities, quotes, orders };

  const registrationCount = registrations.length;
  const opportunityCount = opportunities.length;
  const quoteCount = quotes.length;
  const orderCount = orders.length;
  const orderAmount = orders.reduce((sum, item) => sum + getOpenApiAmount(item), 0);
  const rate = (numerator, denominator) => denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;

  return sendOpenApiSuccess(req, res, {
    stages: [
      { key: 'registrations', label: '客户报备', count: registrationCount },
      { key: 'opportunities', label: '商机', count: opportunityCount, conversionRateFromPrevious: rate(opportunityCount, registrationCount) },
      { key: 'quotes', label: '报价', count: quoteCount, conversionRateFromPrevious: rate(quoteCount, opportunityCount) },
      { key: 'orders', label: '订单', count: orderCount, amount: orderAmount, conversionRateFromPrevious: rate(orderCount, quoteCount) },
    ],
    totalConversionRate: rate(orderCount, registrationCount),
    dimensions: buildOpenApiBusinessDimensions(groupedResources, req.query),
    timeSeries: buildOpenApiBusinessTimeSeries(groupedResources, req.query),
    dataSource: 'CRM_STANDARD_OPEN_API',
  });
});

app.get('/api/open/v1/analytics/funnel/registration-opportunity-order', requireOpenApiAuth('*'), (req, res) => {
  const resources = ['registrations', 'opportunities', 'quotes', 'orders'];
  if (!ensureOpenApiResourcesAllowed(req, res, resources)) return;

  const registrations = filterOpenApiAnalyticsItems(req.openApi.user, 'registrations', req.query);
  const opportunities = filterOpenApiAnalyticsItems(req.openApi.user, 'opportunities', req.query);
  const quotes = filterOpenApiAnalyticsItems(req.openApi.user, 'quotes', req.query);
  const orders = filterOpenApiAnalyticsItems(req.openApi.user, 'orders', req.query);
  const groupedResources = { registrations, opportunities, quotes, orders };

  const registrationCount = registrations.length;
  const opportunityCount = opportunities.length;
  const quoteCount = quotes.length;
  const orderCount = orders.length;
  const orderAmount = orders.reduce((sum, item) => sum + getOpenApiAmount(item), 0);
  const rate = (numerator, denominator) => denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;

  return sendOpenApiSuccess(req, res, {
    stages: [
      { key: 'registrations', label: '客户报备', count: registrationCount },
      { key: 'opportunities', label: '商机', count: opportunityCount, conversionRateFromPrevious: rate(opportunityCount, registrationCount) },
      { key: 'quotes', label: '报价', count: quoteCount, conversionRateFromPrevious: rate(quoteCount, opportunityCount) },
      { key: 'orders', label: '订单', count: orderCount, amount: orderAmount, conversionRateFromPrevious: rate(orderCount, quoteCount) },
    ],
    totalConversionRate: rate(orderCount, registrationCount),
    dimensions: buildOpenApiBusinessDimensions(groupedResources, req.query),
    timeSeries: buildOpenApiBusinessTimeSeries(groupedResources, req.query),
    dataSource: 'CRM_STANDARD_OPEN_API',
  });
});

app.get('/api/open/v1/analytics/partners/profile', requireOpenApiAuth('*'), (req, res) => {
  if (!ensureOpenApiResourcesAllowed(req, res, 'partners')) return;
  const partners = applyOpenApiObjectFilters(getOpenApiScopedResourceItems(req.openApi.user, 'partners'), req.query, {
    ...getOpenApiPartnerAnalyticsFilterOptions(),
  });
  return sendOpenApiSuccess(req, res, buildOpenApiPartnerProfile(partners, req.query));
});

app.get(['/api/open/v1/analytics/technical-service-providers/profile', '/api/open/v1/analytics/tech-service-providers/profile'], requireOpenApiAuth('*'), (req, res) => {
  if (!ensureOpenApiResourcesAllowed(req, res, 'partners')) return;
  const partners = filterOpenApiTechnicalServiceProviderPartners(
    applyOpenApiObjectFilters(getOpenApiScopedResourceItems(req.openApi.user, 'partners'), req.query, {
      ...getOpenApiPartnerAnalyticsFilterOptions(),
    }),
    req.query
  );
  const profile = buildOpenApiPartnerProfile(partners, req.query);
  return sendOpenApiSuccess(req, res, {
    ...profile,
    resource: 'technical-service-providers',
    sourceResource: 'partners',
  });
});

app.get('/api/open/v1/analytics/partners/contribution', requireOpenApiAuth('*'), (req, res) => {
  const resources = ['partners', 'registrations', 'opportunities', 'quotes', 'orders'];
  if (!ensureOpenApiResourcesAllowed(req, res, resources)) return;

  const partners = applyOpenApiObjectFilters(getOpenApiScopedResourceItems(req.openApi.user, 'partners'), req.query, {
    ...getOpenApiPartnerAnalyticsFilterOptions(),
  });
  const rows = buildOpenApiPartnerContributionRows(req.openApi.user, partners);

  const page = applyOpenApiPagination(rows, req.query);
  return sendOpenApiSuccess(req, res, page.list, {
    pageNo: page.pageNo,
    pageSize: page.pageSize,
    total: page.total,
    dimensions: buildOpenApiAnalyticsDimensions('partners', partners, req.query),
    timeSeries: buildOpenApiAnalyticsTimeSeries('partners', partners, req.query),
  });
});

app.get(['/api/open/v1/analytics/technical-service-providers/contribution', '/api/open/v1/analytics/tech-service-providers/contribution'], requireOpenApiAuth('*'), (req, res) => {
  const resources = ['partners', 'registrations', 'opportunities', 'quotes', 'orders'];
  if (!ensureOpenApiResourcesAllowed(req, res, resources)) return;

  const partners = filterOpenApiTechnicalServiceProviderPartners(
    applyOpenApiObjectFilters(getOpenApiScopedResourceItems(req.openApi.user, 'partners'), req.query, {
      ...getOpenApiPartnerAnalyticsFilterOptions(),
    }),
    req.query
  );
  const rows = buildOpenApiPartnerContributionRows(req.openApi.user, partners);

  const page = applyOpenApiPagination(rows, req.query);
  return sendOpenApiSuccess(req, res, page.list, {
    pageNo: page.pageNo,
    pageSize: page.pageSize,
    total: page.total,
    resource: 'technical-service-providers',
    sourceResource: 'partners',
    dimensions: buildOpenApiAnalyticsDimensions('partners', partners, req.query),
    timeSeries: buildOpenApiAnalyticsTimeSeries('partners', partners, req.query),
  });
});

app.get('/api/open/v1/analytics/regions/contribution', requireOpenApiAuth('*'), (req, res) => {
  const resources = ['registrations', 'opportunities', 'quotes', 'orders'];
  if (!ensureOpenApiResourcesAllowed(req, res, resources)) return;
  const groupedResources = {
    registrations: filterOpenApiAnalyticsItems(req.openApi.user, 'registrations', req.query),
    opportunities: filterOpenApiAnalyticsItems(req.openApi.user, 'opportunities', req.query),
    quotes: filterOpenApiAnalyticsItems(req.openApi.user, 'quotes', req.query),
    orders: filterOpenApiAnalyticsItems(req.openApi.user, 'orders', req.query),
  };
  const groupBy = req.query.groupBy === 'bigRegion' ? 'bigRegion' : 'region';
  const rows = groupOpenApiContributionByField(groupedResources, groupBy);
  return sendOpenApiSuccess(req, res, rows, {
    total: rows.length,
    groupBy,
    dimensions: buildOpenApiBusinessDimensions(groupedResources, req.query),
    timeSeries: buildOpenApiBusinessTimeSeries(groupedResources, req.query),
  });
});

app.get('/api/open/v1/analytics/owners/contribution', requireOpenApiAuth('*'), (req, res) => {
  const resources = ['registrations', 'opportunities', 'quotes', 'orders'];
  if (!ensureOpenApiResourcesAllowed(req, res, resources)) return;
  const groupedResources = {
    registrations: filterOpenApiAnalyticsItems(req.openApi.user, 'registrations', req.query).map(item => ({
      ...item,
      ownerDimensionId: item.assignedStaffId || item.createdBy || '',
      ownerDimensionName: item.assignedStaffName || item.createdByName || getOpenApiUserName(item.assignedStaffId || item.createdBy),
    })),
    opportunities: filterOpenApiAnalyticsItems(req.openApi.user, 'opportunities', req.query).map(item => ({
      ...item,
      ownerDimensionId: item.ownerId || item.assignedStaffId || item.createdBy || '',
      ownerDimensionName: item.ownerName || item.assignedStaffName || item.createdByName || getOpenApiUserName(item.ownerId || item.assignedStaffId || item.createdBy),
    })),
    quotes: filterOpenApiAnalyticsItems(req.openApi.user, 'quotes', req.query).map(item => ({
      ...item,
      ownerDimensionId: item.assignedStaffId || item.ownerId || item.createdBy || '',
      ownerDimensionName: item.assignedStaffName || item.ownerName || item.createdByName || getOpenApiUserName(item.assignedStaffId || item.ownerId || item.createdBy),
    })),
    orders: filterOpenApiAnalyticsItems(req.openApi.user, 'orders', req.query).map(item => ({
      ...item,
      ownerDimensionId: item.ownerId || item.assignedStaffId || item.createdBy || '',
      ownerDimensionName: item.ownerName || item.assignedStaffName || item.createdByName || getOpenApiUserName(item.ownerId || item.assignedStaffId || item.createdBy),
    })),
  };
  const rows = groupOpenApiContributionByField(groupedResources, 'ownerDimensionId', (key, itemsByResource) => {
    const allItems = Object.values(itemsByResource).flat();
    return allItems.find(item => item.ownerDimensionName)?.ownerDimensionName || key;
  }).map(row => ({
    ownerId: row.key === '未设置' ? '' : row.key,
    ownerName: row.label,
    ...row,
  }));
  return sendOpenApiSuccess(req, res, rows, {
    total: rows.length,
    dimensions: buildOpenApiBusinessDimensions(groupedResources, req.query),
    timeSeries: buildOpenApiBusinessTimeSeries(groupedResources, req.query),
  });
});

app.get('/api/open/v1/categories', requireOpenApiAuth('categories'), (req, res) => {
  let list = applyOpenApiObjectFilters(Array.isArray(db.categories) ? db.categories.slice() : [], req.query, {
    statusField: 'status',
    searchFields: ['id', 'name', 'type', 'desc'],
    defaultSortField: 'sort',
  });
  const page = applyOpenApiPagination(list, req.query);
  return sendOpenApiSuccess(req, res, page.list, { pageNo: page.pageNo, pageSize: page.pageSize, total: page.total });
});

app.get('/api/open/v1/categories/:id', requireOpenApiAuth('categories'), (req, res) => {
  const item = (Array.isArray(db.categories) ? db.categories : []).find(row => row.id === req.params.id);
  if (!item) return sendOpenApiError(req, res, 404, 40412, 'category not found');
  return sendOpenApiSuccess(req, res, item);
});

app.get('/api/open/v1/modules', requireOpenApiAuth('modules'), (req, res) => {
  let list = Array.isArray(db.modules) ? db.modules.slice() : [];
  if (req.query.categoryId) list = list.filter(item => item.categoryId === req.query.categoryId);
  list = applyOpenApiObjectFilters(list, req.query, {
    statusField: 'status',
    searchFields: ['id', 'name', 'categoryId', 'desc'],
    defaultSortField: 'sort',
  });
  const page = applyOpenApiPagination(list, req.query);
  return sendOpenApiSuccess(req, res, page.list, { pageNo: page.pageNo, pageSize: page.pageSize, total: page.total });
});

app.get('/api/open/v1/modules/:id', requireOpenApiAuth('modules'), (req, res) => {
  const item = (Array.isArray(db.modules) ? db.modules : []).find(row => row.id === req.params.id);
  if (!item) return sendOpenApiError(req, res, 404, 40413, 'module not found');
  return sendOpenApiSuccess(req, res, item);
});

app.get('/api/open/v1/features', requireOpenApiAuth('features'), (req, res) => {
  let list = Array.isArray(db.features) ? db.features.slice() : [];
  if (req.query.moduleId) list = list.filter(item => item.moduleId === req.query.moduleId);
  list = applyOpenApiObjectFilters(list, req.query, {
    statusField: 'status',
    searchFields: ['id', 'name', 'moduleId', 'productCode'],
    defaultSortField: 'sort',
  });
  const page = applyOpenApiPagination(list, req.query);
  return sendOpenApiSuccess(req, res, page.list, { pageNo: page.pageNo, pageSize: page.pageSize, total: page.total });
});

app.get('/api/open/v1/features/:id', requireOpenApiAuth('features'), (req, res) => {
  const item = (Array.isArray(db.features) ? db.features : []).find(row => row.id === req.params.id);
  if (!item) return sendOpenApiError(req, res, 404, 40414, 'feature not found');
  return sendOpenApiSuccess(req, res, normalizeStandardMaintenanceFeatureConfig(item));
});

app.get('/api/open/v1/hardware', requireOpenApiAuth('hardware'), (req, res) => {
  let list = applyOpenApiObjectFilters(Array.isArray(db.hardwareProducts) ? db.hardwareProducts.slice() : [], req.query, {
    statusField: 'status',
    searchFields: ['id', 'name', 'productCode', 'brand', 'model'],
    defaultSortField: 'sort',
  });
  const page = applyOpenApiPagination(list, req.query);
  return sendOpenApiSuccess(req, res, page.list, { pageNo: page.pageNo, pageSize: page.pageSize, total: page.total });
});

app.get('/api/open/v1/hardware/:id', requireOpenApiAuth('hardware'), (req, res) => {
  const item = (Array.isArray(db.hardwareProducts) ? db.hardwareProducts : []).find(row => row.id === req.params.id);
  if (!item) return sendOpenApiError(req, res, 404, 40415, 'hardware not found');
  return sendOpenApiSuccess(req, res, item);
});

app.get('/api/open/v1/packages', requireOpenApiAuth('packages'), (req, res) => {
  let list = applyOpenApiObjectFilters(Array.isArray(db.packages) ? db.packages.slice() : [], req.query, {
    statusField: 'status',
    searchFields: ['id', 'name', 'desc'],
    defaultSortField: 'sort',
  });
  const page = applyOpenApiPagination(list, req.query);
  return sendOpenApiSuccess(req, res, page.list, { pageNo: page.pageNo, pageSize: page.pageSize, total: page.total });
});

app.get('/api/open/v1/packages/:id', requireOpenApiAuth('packages'), (req, res) => {
  const item = (Array.isArray(db.packages) ? db.packages : []).find(row => row.id === req.params.id);
  if (!item) return sendOpenApiError(req, res, 404, 40407, 'package not found');
  return sendOpenApiSuccess(req, res, item);
});

app.get('/api/open/v1/products', requireOpenApiAuth('products'), (req, res) => {
  let list = applyOpenApiObjectFilters(Array.isArray(db.products) ? db.products.slice() : [], req.query, {
    statusField: 'status',
    searchFields: ['id', 'name', 'categoryId', 'moduleId', 'featureId'],
    defaultSortField: 'sort',
  });
  const page = applyOpenApiPagination(list, req.query);
  return sendOpenApiSuccess(req, res, page.list, { pageNo: page.pageNo, pageSize: page.pageSize, total: page.total });
});

app.get('/api/open/v1/products/:id', requireOpenApiAuth('products'), (req, res) => {
  const item = (Array.isArray(db.products) ? db.products : []).find(row => row.id === req.params.id);
  if (!item) return sendOpenApiError(req, res, 404, 40408, 'product not found');
  return sendOpenApiSuccess(req, res, item);
});

registerOpenApiResourceRoutes('notifications', 'notifications', {
  statusField: 'status',
  searchFields: ['id', 'title', 'desc', 'type', 'userName'],
  defaultSortField: 'updatedAt',
});

registerOpenApiResourceRoutes('pending-approvals', 'pending-approvals', {
  statusField: 'status',
  searchFields: ['id', 'targetName', 'targetId', 'type', 'region', 'createdByName'],
  defaultSortField: 'createdAt',
});

registerOpenApiResourceRoutes('channel-targets', 'channel-targets', {
  statusField: '',
  searchFields: ['id', 'region', 'partnerId', 'partnerName', 'remark'],
  defaultSortField: 'updatedAt',
  getItems: (user, query) => scopeOpenApiChannelTargets(user, query),
});

registerOpenApiResourceRoutes('channel-visits', 'channel-visits', {
  statusField: 'status',
  searchFields: ['id', 'region', 'partnerName', 'theme', 'summary', 'nextAction', 'owner'],
  defaultSortField: 'visitDate',
  getItems: (user, query) => scopeOpenApiChannelVisits(user, query),
});

registerOpenApiResourceRoutes('workload-classifications', 'workload-classifications', {
  statusField: 'status',
  searchFields: ['id', 'code', 'name', 'desc'],
  defaultSortField: 'updatedAt',
});

registerOpenApiResourceRoutes('workload-delivery-rules', 'workload-delivery-rules', {
  statusField: 'status',
  searchFields: ['id', 'item', 'condition', 'remark'],
  defaultSortField: 'id',
});

registerOpenApiResourceRoutes('workload-mappings', 'workload-mappings', {
  statusField: 'status',
  searchFields: ['id', 'featureId', 'featureName', 'moduleName', 'categoryName', 'productCode', 'productType'],
  defaultSortField: 'updatedAt',
});

registerOpenApiResourceRoutes('workload-rules', 'workload-rules', {
  statusField: 'status',
  searchFields: ['id', 'name', 'productType'],
  defaultSortField: 'updatedAt',
});

app.get('/api/open/v1/product-tree', requireOpenApiAuth('product-tree'), (req, res) => {
  const tree = buildOpenApiProductTree(req.query);
  return sendOpenApiSuccess(req, res, tree, { total: tree.length });
});

app.get('/api/open/v1/product-stats', requireOpenApiAuth('product-stats'), (req, res) => {
  return sendOpenApiSuccess(req, res, buildOpenApiProductStats());
});

app.get('/api/open/v1/dashboard-stats', requireOpenApiAuth('dashboard-stats'), (req, res) => {
  return sendOpenApiSuccess(req, res, buildOpenApiDashboardStats(req.openApi.user, req.query));
});

app.get('/api/open/v1/channel-operations-overview', requireOpenApiAuth('channel-operations-overview'), (req, res) => {
  try {
    return sendOpenApiSuccess(req, res, buildChannelOperationsOverview(buildOpenApiChannelScopeParams(req.openApi.user, req.query)));
  } catch (err) {
    return sendOpenApiError(req, res, 500, 50001, err.message || 'channel operations overview failed');
  }
});

app.get('/api/open/v1/audit-logs', requireOpenApiAuth('audit-logs'), (req, res) => {
  if (req.openApi.user.role !== 'superadmin') {
    return sendOpenApiSuccess(req, res, [], { pageNo: parsePageNo(req.query.pageNo), pageSize: parsePageSize(req.query.pageSize), total: 0 });
  }
  const pageNo = parsePageNo(req.query.pageNo || req.query.page);
  const pageSize = Math.min(100, parsePageSize(req.query.pageSize));
  const result = auditDb.list({
    page: pageNo,
    pageSize,
    module: req.query.module || '',
    action: req.query.action || '',
    result: req.query.result || '',
    actorUserId: req.query.actorUserId || req.query.userId || '',
    targetType: req.query.targetType || '',
    targetId: req.query.targetId || '',
    keyword: req.query.keyword || '',
    dateFrom: req.query.dateFrom || req.query.createdAfter || '',
    dateTo: req.query.dateTo || req.query.createdBefore || '',
  });
  return sendOpenApiSuccess(req, res, normalizeOpenApiList('audit-logs', result.data), {
    pageNo: result.page,
    pageSize: result.pageSize,
    total: result.total,
  });
});

app.get('/api/open/v1/audit-logs/:id', requireOpenApiAuth('audit-logs'), (req, res) => {
  if (req.openApi.user.role !== 'superadmin') return sendOpenApiError(req, res, 404, 40411, 'audit log not found');
  const record = auditDb.getById(req.params.id);
  if (!record) return sendOpenApiError(req, res, 404, 40411, 'audit log not found');
  return sendOpenApiSuccess(req, res, normalizeOpenApiRecord('audit-logs', record));
});

app.get('/api/open/v1/company-search', requireOpenApiAuth('company-search'), async (req, res) => {
  try {
    const result = await runOpenApiCompanySearch(req.query.keyword);
    return sendOpenApiSuccess(req, res, result.data, { total: result.data.length, note: result.note || '' });
  } catch (err) {
    return sendOpenApiError(req, res, 500, 50002, err.message || 'company search failed');
  }
});

app.post('/api/open/v1/quotes/workload-preview', requireOpenApiAuth('quote-workload-preview'), (req, res) => {
  const suggestion = buildImplementationWorkloadSuggestion(req.body || {});
  return sendOpenApiSuccess(req, res, suggestion);
});

app.post('/api/open/v1/ipg/quote-preview', requireOpenApiAuth('ipg-quote-preview'), (req, res) => {
  try {
    const body = req.body || {};
    const featureIds = Array.isArray(body.featureIds)
      ? body.featureIds
      : Array.isArray(body.products)
        ? body.products
        : [];
    const featureById = new Map((db.features || []).map(feature => [feature.id, feature]));
    const features = featureIds.map(featureId => {
      const feature = featureById.get(featureId);
      return feature ? { id: feature.id, name: feature.name, productCode: feature.productCode } : { id: featureId, name: featureId };
    });
    const preview = calculateIpgQuotePreview({
      ...body,
      featureIds,
      features,
      hardwareIds: Array.isArray(body.hardwareIds) ? body.hardwareIds : [],
      projectParams: body.projectParams || {},
    });
    return sendOpenApiSuccess(req, res, preview);
  } catch (err) {
    return sendOpenApiError(req, res, 500, 50003, err.message || 'ipg quote preview failed');
  }
});

loadData();
if (ensurePartnerProfileData()) saveData();
ensureImplementationWorkloadData();
ensurePackageCompatibilityData();

app.listen(PORT, () => {
  const dbStats = dbLayer.getStats();
  const totalRecords = Object.values(dbStats).reduce((a, b) => a + b, 0);
  console.log(`
╔════════════════════════════════════════════════╗
║     联软渠道管理平台 - 后端服务已启动           ║
╠════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}              ║
║  数据库:   ${DB_PATH}  (${totalRecords}条记录) ║
║  审计库:   ${AUDIT_DB_PATH} ║
╠════════════════════════════════════════════════╣
║  API 接口:                                      ║
║  • POST   /api/auth/login      登录            ║
║  • GET    /api/registrations   报备列表        ║
║  • POST   /api/registrations   创建报备        ║
║  • GET    /api/opportunities   商机列表        ║
║  • POST   /api/opportunities   创建商机        ║
║  • GET    /api/quotes          报价列表        ║
║  • POST   /api/quotes          创建报价        ║
╚════════════════════════════════════════════════╝
  `);
});

// 进程退出时安全关闭数据库
process.on('SIGINT', () => {
  saveData();
  dbLayer.close();
  auditDb.close();
  console.log('\n✅ 数据已保存，数据库已关闭，服务退出');
  process.exit(0);
});

process.on('SIGTERM', () => {
  saveData();
  dbLayer.close();
  auditDb.close();
  console.log('\n✅ 收到 SIGTERM，数据已保存，服务退出');
  process.exit(0);
});
