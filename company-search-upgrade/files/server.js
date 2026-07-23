/**
 * 联软渠道管理平台 - 简易后端服务
 * 使用内存存储 + 文件持久化，无需编译原生模块
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
      partnerLevel: 'none', // 渠道商等级: primary(一级)/secondary(二级)/none(无等级,默认)
      parentPartnerId: null, // 上级渠道商ID(仅二级渠道商有值)
      partnerLevelSetBy: null, // 等级设置人
      partnerLevelSetAt: null, // 等级设置时间
      region: '北区（政府企业）', 
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
  quotes: [],
  orders: [],
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
  products: []
};

// 从文件加载数据
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      // 用文件数据完全替换默认数据，而不是合并
      if (data.categories) db.categories = data.categories;
      if (data.modules) db.modules = data.modules;
      if (data.features) db.features = data.features;
      if (data.hardware) db.hardware = data.hardware;
      if (data.packages) db.packages = data.packages;
      if (data.partners) db.partners = data.partners;
      if (data.users) db.users = data.users;
      if (data.registrations) db.registrations = data.registrations;
      if (data.opportunities) db.opportunities = data.opportunities;
      if (data.quotes) db.quotes = data.quotes;
      if (data.orders) db.orders = data.orders;
      if (data.pendingApprovals) db.pendingApprovals = data.pendingApprovals;
      console.log('✅ 数据已从文件加载 (完全替换模式)');
    }
  } catch (err) {
    console.error('加载数据失败:', err.message);
  }
}

// 保存数据到文件
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('保存数据失败:', err.message);
  }
}

// 定期保存（每30秒）
setInterval(saveData, 30000);

// 登录接口
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: '账号或密码错误' });
  }
  
  // 检查账号状态
  if (user.status === 'inactive' || user.status === 'disabled') {
    return res.status(403).json({ error: '账号已被禁用，请联系管理员' });
  }
  
  // 检查账号状态（待审批账号不能登录）
  if (user.status === 'pending') {
    return res.status(403).json({ error: '账号待审批，请联系区域管理员审核' });
  }
  
  const token = 'token_' + Date.now();
  const { password: _, ...userInfo } = user;
  
  res.json({
    token,
    user: userInfo
  });
});

// 修改当前用户密码（自主修改）
app.put('/api/auth/password', (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  
  if (!userId || !oldPassword || !newPassword) {
    return res.status(400).json({ success: false, error: '缺少必要参数' });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, error: '新密码长度不能少于6位' });
  }
  
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, error: '用户不存在' });
  }
  
  // 验证旧密码
  if (user.password !== oldPassword) {
    return res.status(400).json({ success: false, error: '原密码错误' });
  }
  
  user.password = newPassword;
  user.updatedAt = new Date().toISOString();
  saveData();
  
  res.json({ success: true, message: '密码修改成功' });
});

// 获取当前用户信息
app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization;
  // 简化处理，直接返回第一个用户（实际应该验证token）
  res.json({ user: db.users[0] });
});

// ========== 客户报备接口 ==========

// 创建报备（合作伙伴）
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
    list = list.filter(r => 
      r.createdBy === userId || 
      r.assignedStaffId === userId
    );
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
    const enriched = { ...r };
    
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
        stage: 'prospecting',
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
      
      db.opportunities.push(opp);
    }
  }
  
  saveData();
  
  res.json({ success: true, data: reg });
});

// 更新报备记录
app.put('/api/registrations/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const reg = db.registrations.find(r => r.id === id);
  if (!reg) {
    return res.status(404).json({ success: false, error: '报备不存在' });
  }
  
  // 允许更新的字段
  const allowedFields = ['assignedStaffId', 'assignedStaffName', 'assignedPartnerId', 'assignedPartnerName', 
                         'contact', 'phone', 'email', 'city', 'notes', 'status', 'remark'];
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
    stage: 'prospecting',
    createdAt: new Date().toISOString()
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
  
  db.opportunities.push(opp);
  saveData();
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
    list = list.filter(o => 
      o.createdBy === userId || 
      o.ownerId === userId ||
      o.assignedStaffId === userId
    );
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
    const enriched = { ...o };
    
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
  const updates = req.body;
  
  const opp = db.opportunities.find(o => o.id === id);
  if (!opp) {
    return res.status(404).json({ success: false, error: '商机不存在' });
  }
  
  // 更新字段
  Object.assign(opp, updates, { updatedAt: new Date().toISOString() });
  saveData();
  
  res.json({ success: true, data: opp });
});

// ========== 报价接口 ==========

// 根据用户ID获取用户信息（用于自动填充名称）
function getUserInfo(userId) {
  const user = db.users.find(u => u.id === userId);
  if (user) {
    return {
      name: user.name || '',
      partnerId: user.partnerId || '',
      partnerName: user.partnerName || ''
    };
  }
  return { name: '', partnerId: '', partnerName: '' };
}

// 创建报价
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
    return res.status(400).json({ success: false, error: '报价单必须至少关联一个商机' });
  }
  
  // 验证所有商机ID存在
  for (const oppId of oppIds) {
    const opp = db.opportunities.find(o => o.id === oppId);
    if (!opp) {
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
  db.quotes.push(quote);
  saveData();
  res.json({ success: true, data: quote });
});

// 获取报价列表
app.get('/api/quotes', (req, res) => {
  const { userId, region, partnerId } = req.query;
  let list = db.quotes;
  
  // 【关键修复】员工获取报价单：只看自己创建的 + 被指派给自己的
  // assignedStaffId 存储的是员工的 userId，直接匹配即可
  if (userId) {
    list = list.filter(q => 
      q.createdBy === userId ||
      q.ownerId === userId ||
      q.assignedStaffId === userId
    );
  }
  
  if (region) {
    list = list.filter(q => q.region === region);
  }
  
  // 【关键修复】第一步：先 enrichment（补充缺失的 partnerId）
  // 优先级：assignedStaffId > createdBy > ownerId（员工有 partnerId，管理员没有）
  list = list.map(q => {
    const enriched = { ...q };
    
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
  db.orders.push(order);
  
  // 更新渠道商统计字段
  if (partnerId) {
    updatePartnerStats(partnerId);
  }
  if (assignedPartnerId && assignedPartnerId !== partnerId) {
    updatePartnerStats(assignedPartnerId);
  }
  
  saveData();
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
        o.createdBy === userId ||
        o.ownerId === userId ||
        o.assignedStaffId === userId ||
        o.partnerId === userPartnerId ||
        secondaryPartnerIds.includes(o.partnerId) ||
        o.parentPartnerId === userPartnerId || // 关键修复：二级渠道商的订单通过 parentPartnerId 关联
        o.assignedPartnerId === userPartnerId
      );
    } else {
      // 普通员工：只看自己创建的 + 被指派给自己的
      list = list.filter(o => 
        o.createdBy === userId ||
        o.ownerId === userId ||
        o.assignedStaffId === userId
      );
    }
  }
  
  if (region) {
    list = list.filter(o => o.region === region);
  }
  
  // 【关键修复】第一步：先 enrichment（补充缺失的 partnerId）
  // 优先级：assignedStaffId > createdBy > ownerId（员工有 partnerId，管理员没有）
  list = list.map(o => {
    const enriched = { ...o };
    
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
  const updates = req.body;
  
  const quote = db.quotes.find(q => q.id === id);
  if (!quote) {
    return res.status(404).json({ success: false, error: '报价单不存在' });
  }
  
  delete updates.id;
  Object.assign(quote, updates, { updatedAt: new Date().toISOString() });
  saveData();
  
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
    return res.status(404).json({ success: false, error: '报价单不存在' });
  }
  
  // 验证状态值
  const validStatuses = ['draft', 'sent', 'confirmed', 'converted', 'expired'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: '无效的状态值' });
  }
  
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
  
  res.json({ success: true, data: quote });
});

// 更新订单状态（厂商确认订单）
// 支持的状态流转：
// - 一级/无等级渠道商：pending -> processing -> shipped -> completed
// - 二级渠道商：pending -> primary_confirmed -> processing -> shipped -> completed
// 也可以直接取消：任何状态 -> cancelled
app.put('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, remark, operatorId, operatorName, operatorRole } = req.body;
  
  const order = db.orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  
  // 验证状态值
  const validStatuses = ['pending', 'primary_confirmed', 'primary_rejected', 'processing', 'shipped', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: '无效的状态值' });
  }
  
  // 权限检查：只有超级管理员或区域管理员可以更新订单状态
  // 区域管理员只能更新自己区域的订单
  if (operatorRole === 'admin' && order.region) {
    const operator = db.users.find(u => u.id === operatorId);
    if (operator && operator.region !== order.region) {
      return res.status(403).json({ success: false, error: '无权操作其他区域的订单' });
    }
  }
  
  // 二级渠道商订单流程验证
  const partner = db.partners.find(p => p.id === order.partnerId);
  if (partner && partner.partnerLevel === 'secondary') {
    // 二级渠道商订单必须经过一级确认
    if (order.status === 'pending' && status === 'processing') {
      return res.status(400).json({ 
        success: false, 
        error: '二级渠道商订单必须先经过一级渠道商确认' 
      });
    }
  }
  
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
    return res.status(400).json({ success: false, error: '请输入有效的调整后价格' });
  }
  
  if (!adjustmentReason || adjustmentReason.trim() === '') {
    return res.status(400).json({ success: false, error: '请填写价格调整原因' });
  }
  
  const order = db.orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  
  // 权限检查：只有超级管理员或区域管理员可以调整价格
  if (operatorRole !== 'superadmin' && operatorRole !== 'admin') {
    return res.status(403).json({ success: false, error: '只有管理员可以调整订单价格' });
  }
  
  // 区域管理员只能调整自己区域的订单
  if (operatorRole === 'admin' && order.region) {
    const operator = db.users.find(u => u.id === operatorId);
    if (operator && operator.region !== order.region) {
      return res.status(403).json({ success: false, error: '无权调整其他区域的订单价格' });
    }
  }
  
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
  const updates = req.body;
  
  const user = db.users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ success: false, error: '用户不存在' });
  }
  
  // 不允许通过此接口修改密码，需单独处理
  delete updates.password;
  delete updates.id; // ID 不能修改
  
  Object.assign(user, updates, { updatedAt: new Date().toISOString() });
  saveData();
  
  const { password, ...userInfo } = user;
  res.json({ success: true, data: userInfo });
});

// 删除用户
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  
  const user = db.users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ success: false, error: '用户不存在' });
  }
  
  // 不允许删除超级管理员
  if (user.role === 'superadmin') {
    return res.status(403).json({ success: false, error: '不能删除超级管理员账号' });
  }
  
  // 同时删除渠道商 staff 数组中的记录
  if (user.partnerId) {
    const partner = db.partners.find(p => p.id === user.partnerId);
    if (partner && partner.staff) {
      partner.staff = partner.staff.filter(s => s.userId !== id);
    }
  }
  
  db.users = db.users.filter(u => u.id !== id);
  saveData();
  
  res.json({ success: true, message: '用户已删除' });
});

// 重置用户密码
app.put('/api/users/:id/password', (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  const user = db.users.find(u => u.id === id);
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
app.post('/api/admin/accounts', (req, res) => {
  const { username, name, role, password, region, bigRegion, status, remark, avatar } = req.body;
  
  if (!username || !name) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
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
    role: role || 'admin',
    password: password || '123456',
    region: region || '',
    bigRegion: bigRegion || '',
    status: status || 'active',
    remark: remark || '',
    avatar: avatar || name.slice(0, 1),
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
  
  // 生成唯一ID
  const existingIds = db.users.filter(u => u.id.startsWith(idPrefix)).map(u => parseInt(u.id.slice(1)) || 0);
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
  
  res.json({ success: true, data: list.sort((a, b) => new Date(b.joinDate) - new Date(a.joinDate)) });
});

// 创建渠道商
app.post('/api/partners', (req, res) => {
  const { name, level, region, bigRegion, contact, phone, email, isTechService, createdBy, createdByRole, partnerLevel, parentPartnerId, parentPartnerIds } = req.body;
  
  if (!name || !region) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  // 生成渠道商ID
  const existingIds = db.partners.map(p => parseInt(p.id.replace('P', '')) || 0);
  const maxId = Math.max(0, ...existingIds);
  const newId = 'P' + String(maxId + 1).padStart(3, '0');
  
  // 根据创建者角色决定状态
  // 超级管理员创建：直接生效
  // 区域管理员创建：待审批
  const status = createdByRole === 'superadmin' ? 'active' : 'pending';
  
  // 确定渠道商等级和上级渠道商关系（支持多个上级渠道商）
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
    level: level || 'gold',
    partnerLevel: finalPartnerLevel,
    region,
    bigRegion: bigRegion || '',
    contact: contact || '',
    phone: phone || '',
    email: email || '',
    isTechService: isTechService || false,
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
  
  res.json({ 
    success: true, 
    data: newPartner,
    message: status === 'pending' ? '渠道商创建成功，等待超级管理员审批' : '渠道商创建成功'
  });
});

// 获取单个渠道商详情
app.get('/api/partners/:id', (req, res) => {
  const { id } = req.params;
  const partner = db.partners.find(p => p.id === id);
  
  if (!partner) {
    return res.status(404).json({ error: '渠道商不存在' });
  }
  
  // 确保 staff 数组存在
  if (!partner.staff) partner.staff = [];
  
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
  
  res.json({ success: true, message: '添加成功', data: { id: newId, status: newUser.status } });
});

// 更新员工状态（审批）
app.put('/api/users/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, remark, approvedBy } = req.body;
  
  const user = db.users.find(u => u.id === id);
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
    if (partner && partner.staff) {
      const staff = partner.staff.find(s => s.userId === id);
      if (staff) {
        staff.status = status;
        staff.approvedBy = approvedBy;
        staff.approvedAt = new Date().toISOString();
      }
    }
  }
  
  // 更新待审批列表（兼容 staff 和 partner_admin 两种类型）
  const approval = db.pendingApprovals.find(a => a.targetId === id && (a.type === 'staff' || a.type === 'partner_admin'));
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
  const updates = req.body;

  const partner = db.partners.find(p => p.id === id);
  if (!partner) {
    return res.status(404).json({ success: false, error: '渠道商不存在' });
  }

  delete updates.id; // ID 不能修改

  // 处理渠道商等级和上级渠道商关系（支持多个上级渠道商）
  const { partnerLevel, parentPartnerId, parentPartnerIds } = updates;
  
  // 确定最终渠道商等级（如果提供了则使用新值，否则保持原值）
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

  // 更新渠道商等级
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
  Object.assign(partner, updates, { updatedAt: new Date().toISOString() });

  saveData();

  res.json({ success: true, data: partner });
});

// 删除渠道商
app.delete('/api/partners/:id', (req, res) => {
  const { id } = req.params;
  
  const partner = db.partners.find(p => p.id === id);
  if (!partner) {
    return res.status(404).json({ success: false, error: '渠道商不存在' });
  }
  
  db.partners = db.partners.filter(p => p.id !== id);
  saveData();
  
  res.json({ success: true, message: '渠道商已删除' });
});

// ========== 渠道商等级管理接口 ==========

// 设置渠道商等级
app.put('/api/partners/:id/level', (req, res) => {
  const { id } = req.params;
  const { partnerLevel, parentPartnerId, parentPartnerIds, operatedBy, operatedByRole } = req.body;
  
  // 权限检查：仅区域管理员和超管可操作
  if (operatedByRole !== 'admin' && operatedByRole !== 'superadmin') {
    return res.status(403).json({ success: false, error: '无权限操作' });
  }
  
  const partner = db.partners.find(p => p.id === id);
  if (!partner) {
    return res.status(404).json({ success: false, error: '渠道商不存在' });
  }
  
  // 验证等级值
  if (!['primary', 'secondary', 'none'].includes(partnerLevel)) {
    return res.status(400).json({ success: false, error: '无效的等级值' });
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
  
  partner.partnerLevelSetBy = operatedBy;
  partner.partnerLevelSetAt = new Date().toISOString();
  partner.updatedAt = new Date().toISOString();
  
  saveData();
  
  res.json({ success: true, data: partner, message: '等级设置成功' });
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
    
    // 如果移除后数组为空，则变为无等级
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
        : '已移除所有上级渠道商，渠道商等级已变为无等级'
    });
  }
  
  // 完全解绑：变为无等级
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
  const { name, level, region, bigRegion, contact, phone, email, isTechService, createdBy, createdByRole, parentPartnerId, parentPartnerIds } = req.body;
  
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
    level: level || 'gold',
    partnerLevel: 'secondary',
    parentPartnerId: finalParentPartnerIds.length > 0 ? finalParentPartnerIds[0] : null,
    parentPartnerIds: finalParentPartnerIds,
    partnerLevelSetBy: null, // 审批通过后设置
    partnerLevelSetAt: null,
    region,
    bigRegion: bigRegion || '',
    contact: contact || '',
    phone: phone || '',
    email: email || '',
    isTechService: isTechService || false,
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
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  
  // 验证订单状态
  if (order.status !== 'pending') {
    return res.status(400).json({ success: false, error: '订单状态不正确' });
  }
  
  // 验证订单的二级渠道商是否绑定到该一级渠道商
  // operatorPartnerId 为操作者的渠道商ID（一级渠道商），operatorId 为其用户ID
  const secondaryPartner = db.partners.find(p => p.id === order.partnerId);
  if (!secondaryPartner || secondaryPartner.partnerLevel !== 'secondary') {
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
    return res.status(403).json({ success: false, error: '无权限确认此订单，您不是该二级渠道商的上级渠道商' });
  }
  
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
  
  res.json({ success: true, data: order, message: '一级确认成功，等待区域管理员审批' });
});

// 一级渠道商驳回订单
app.put('/api/orders/:id/primary-reject', (req, res) => {
  const { id } = req.params;
  const { operatorId, operatorName, operatorPartnerId, remark } = req.body;
  
  const order = db.orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  
  if (order.status !== 'pending') {
    return res.status(400).json({ success: false, error: '订单状态不正确' });
  }
  
  // 验证权限：同 primary-confirm
  const secondaryPartner = db.partners.find(p => p.id === order.partnerId);
  if (!secondaryPartner || secondaryPartner.partnerLevel !== 'secondary') {
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
    return res.status(403).json({ success: false, error: '无权限驳回此订单，您不是该二级渠道商的上级渠道商' });
  }
  
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
    return res.status(404).json({ success: false, message: '审批记录不存在' });
  }
  
  if (apr.status !== 'pending') {
    return res.status(400).json({ success: false, message: '该记录已处理' });
  }
  
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
  // 删除关联的功能
  db.features = db.features.filter(f => f.moduleId !== req.params.id);
  db.modules.splice(idx, 1);
  saveData();
  res.json({ success: true, message: '产品模块及关联功能已删除' });
});

// 获取功能模块列表
app.get('/api/features', (req, res) => {
  const { moduleId, status, published } = req.query;
  let features = [...db.features];
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
  const feature = {
    id: req.body.id || `FEAT-${Date.now()}`,
    moduleId: req.body.moduleId,
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
    createdAt: new Date().toISOString()
  };
  db.features.push(feature);
  saveData();
  res.json({ success: true, data: feature });
});

// 更新功能模块
app.put('/api/features/:id', (req, res) => {
  const idx = db.features.findIndex(f => f.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '功能模块不存在' });
  }
  
  const feature = db.features[idx];
  
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
        price: Math.round(tier.price * ratioPrimary / 100)
      }));
      
      feature.priceForSecondary = feature.tiers.map(tier => ({
        min: tier.min,
        max: tier.max,
        price: Math.round(tier.price * ratioSecondary / 100)
      }));
      
      console.log(`[价格计算] ${feature.name} - 一级渠道商: 阶梯价格 × ${ratioPrimary}%折扣`);
      console.log(`[价格计算] ${feature.name} - 二级渠道商: 阶梯价格 × ${ratioSecondary}%折扣`);
    } else if (feature.priceType === 'fixed') {
      // 固定价格
      const basePrice = feature.priceFixed || 0;
      feature.priceForPrimary = Math.round(basePrice * ratioPrimary / 100);
      feature.priceForSecondary = Math.round(basePrice * ratioSecondary / 100);
      
      console.log(`[价格计算] ${feature.name} - 一级渠道商: ¥${basePrice} × ${ratioPrimary}% = ¥${feature.priceForPrimary}`);
      console.log(`[价格计算] ${feature.name} - 二级渠道商: ¥${basePrice} × ${ratioSecondary}% = ¥${feature.priceForSecondary}`);
    }
    
    // 保存价格折扣率（百分比形式）
    feature.priceRatioPrimary = Math.round(ratioPrimary);
    feature.priceRatioSecondary = Math.round(ratioSecondary);
    feature.priceRatioUpdatedAt = new Date().toISOString();
  }
  
  // 更新其他字段
  db.features[idx] = { ...feature, ...req.body, updatedAt: new Date().toISOString() };
  saveData();
  res.json({ success: true, data: db.features[idx] });
});

// 删除功能模块
app.delete('/api/features/:id', (req, res) => {
  const idx = db.features.findIndex(f => f.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: '功能模块不存在' });
  }
  db.features.splice(idx, 1);
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

app.get('/api/company-search', async (req, res) => {
  const keyword = (req.query.keyword || '').trim();
  if (!keyword || keyword.length < 2) {
    return res.json({ success: true, data: [] });
  }

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
      data: localMatches,
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
      const merged = [...apiResults];
      for (const lm of localMatches) {
        if (!merged.some(m => m.name === lm.name)) {
          merged.push(lm);
        }
      }
      return res.json({ success: true, data: merged });
    } else {
      // API 返回错误，只返回本地数据
      return res.json({ success: true, data: localMatches, apiError: result.msg || '查询无结果' });
    }
  } catch (err) {
    console.error('[company-search] 阿里云 API 调用失败:', err.message);
    // 降级：返回本地数据
    return res.json({ success: true, data: localMatches, apiError: err.message });
  }
});

// ========== /企业信息查询 ==========

// ========== 批量导入功能 ==========

// 导入类型验证
const IMPORT_TYPES = ['partners', 'staff', 'registrations', 'opportunities'];

// Excel模板定义
const TEMPLATES = {
  partners: {
    name: '渠道商导入模板',
    headers: ['渠道商名称*', '合作级别', '所在区域*', '大区', '联系人', '联系电话', '邮箱'],
    keys: ['name', 'level', 'region', 'bigRegion', 'contact', 'phone', 'email'],
    required: ['name', 'region'],
    levels: ['lep', 'diamond', 'gold', 'silver', 'bronze', '行业总代']
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

// 商机阶段映射
const OPP_STAGES = {
  '初步接触': 'prospecting',
  '需求沟通': 'qualification',
  '方案报价': 'proposal',
  '商务谈判': 'negotiation',
  '合同签订': 'closed-won',
  '失败': 'closed-lost'
};

// 状态映射
const STAFF_STATUS = {
  '正常': 'active',
  '停用': 'inactive'
};

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
    exampleData.push(['示例渠道商', 'gold', '北区（政府企业）', '大北区', '张总', '13800138000', 'example@test.com']);
  } else if (type === 'staff') {
    exampleData.push(['zhangsan', '张三', '北京安盾网络', '123456', '13800138000', 'zhangsan@test.com', '正常']);
  } else if (type === 'registrations') {
    exampleData.push(['示例客户公司', '91110000XXXXXXXXXX', '科技', '李经理', '13800138001', '刘建国', '北京安盾网络', '北京市朝阳区']);
  } else if (type === 'opportunities') {
    exampleData.push(['XX公司安全项目', '示例客户公司', '50000', '2026-06-30', '初步接触', '科技', '李经理', '13800138001', '刘建国', '北京安盾网络', '重要项目']);
  }
  
  // 添加表头和示例
  const wsData = [template.headers, ...exampleData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // 设置列宽
  ws['!cols'] = template.headers.map(() => ({ wch: 20 }));
  
  XLSX.utils.book_append_sheet(wb, ws, template.name);
  
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
    return res.status(400).json({ success: false, error: '不支持的导入类型' });
  }
  
  if (!req.file) {
    return res.status(400).json({ success: false, error: '请上传Excel文件' });
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
    const headerKeyMap = {};
    template.headers.forEach((h, idx) => {
      headerKeyMap[h] = template.keys[idx];
    });

    const parsedData = rows.map((row, index) => {
      const item = {};
      const errors = [];
      
      headers.forEach((header, colIndex) => {
        const key = headerKeyMap[header];
        if (key) {
          item[key] = row[colIndex] !== undefined ? String(row[colIndex]).trim() : '';
        }
      });
      
      // 验证必填字段
      template.required.forEach(field => {
        if (!item[field] || item[field] === '') {
          errors.push(`缺少必填字段: ${field}`);
        }
      });
      
      // 类型特定验证
      if (type === 'partners' && item.level) {
        const levelAlias = { 'lep': 'lep', '钻石': 'diamond', 'diamond': 'diamond', '金牌': 'gold', 'gold': 'gold', '银牌': 'silver', 'silver': 'silver', '铜牌': 'bronze', 'bronze': 'bronze', '行业总代': '行业总代' };
        const normalizedLevel = item.level.toLowerCase().trim();
        if (levelAlias[normalizedLevel]) {
          item.level = levelAlias[normalizedLevel];
        } else if (item.level === '/' || item.level === '' || item.level === '-') {
          item.level = 'gold'; // 空值或/默认gold
        } else {
          item.level = 'gold'; // 未知值默认gold
        }
      }
      if (type === 'staff' && item.status && !STAFF_STATUS[item.status]) {
        item.status = 'active'; // 默认值
      }
      if (type === 'opportunities' && item.stage && !OPP_STAGES[item.stage]) {
        item.stage = 'prospecting'; // 默认值
      }
      
      return {
        rowIndex: index + 2, // Excel行号（1是表头）
        data: item,
        errors: errors
      };
    });
    
    // 清理临时文件
    fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      preview: parsedData.slice(0, 10), // 最多预览10行
      totalCount: rows.length,
      headers: template.headers
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
  const { userId, userRole } = req.body;
  
  if (!IMPORT_TYPES.includes(type)) {
    return res.status(400).json({ success: false, error: '不支持的导入类型' });
  }
  
  if (!req.file) {
    return res.status(400).json({ success: false, error: '请上传Excel文件' });
  }
  
  // 权限验证：仅超管和区管可以导入
  if (!userRole || (userRole !== 'superadmin' && userRole !== 'admin')) {
    fs.unlinkSync(req.file.path);
    return res.status(403).json({ success: false, error: '权限不足，仅管理员可以执行导入' });
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
    const headerKeyMap = {};
    template.headers.forEach((h, idx) => {
      headerKeyMap[h] = template.keys[idx];
    });
    
    const results = {
      success: 0,
      updated: 0,
      failed: 0,
      errors: []
    };
    
    // 按类型执行导入
    if (type === 'partners') {
      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          const item = {};
          for (let ci = 0; ci < headers.length; ci++) {
            const mappedKey = headerKeyMap[headers[ci]];
            if (mappedKey) {
              item[mappedKey] = row[ci] !== undefined ? String(row[ci]).trim() : '';
            }
          }
          
          // 验证必填
          if (!item.name || !item.region) {
            results.failed++;
            results.errors.push({ row: i + 2, message: '缺少必填字段（渠道商名称或所在区域）' });
            continue;
          }
          
          // 查重（按名称）
          const existing = db.partners.find(p => p.name === item.name);
          if (existing) {
            // 更新
            existing.level = item.level || existing.level;
            existing.bigRegion = item.bigRegion || existing.bigRegion;
            existing.contact = item.contact || existing.contact;
            existing.phone = item.phone || existing.phone;
            existing.email = item.email || existing.email;
            existing.updatedBy = userId;
            existing.updatedAt = new Date().toISOString();
            results.updated++;
          } else {
            // 新增
            const existingIds = db.partners.map(p => parseInt(p.id.replace('P', '')) || 0);
            const maxId = Math.max(0, ...existingIds);
            const newId = 'P' + String(maxId + 1).padStart(3, '0');
            
            const newPartner = {
              id: newId,
              name: item.name,
              level: item.level || 'gold',
              partnerLevel: 'none',
              parentPartnerId: null,
              parentPartnerIds: [],
              partnerLevelSetBy: null,
              partnerLevelSetAt: null,
              region: item.region,
              bigRegion: item.bigRegion || '',
              contact: item.contact || '',
              phone: item.phone || '',
              email: item.email || '',
              status: 'active',
              joinDate: new Date().toISOString().split('T')[0],
              quoteCount: 0,
              orderCount: 0,
              totalAmt: 0,
              staff: [],
              createdBy: userId,
              createdByRole: userRole
            };
            
            db.partners.push(newPartner);
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
          const item = {};
          for (let ci = 0; ci < headers.length; ci++) {
            const mappedKey = headerKeyMap[headers[ci]];
            if (mappedKey) {
              item[mappedKey] = row[ci] !== undefined ? String(row[ci]).trim() : '';
            }
          }
          
          // 验证必填
          if (!item.username || !item.name || !item.partnerName || !item.password) {
            results.failed++;
            results.errors.push({ row: i + 2, message: '缺少必填字段（账号、姓名、渠道商名称或密码）' });
            continue;
          }
          
          // 查找渠道商
          const partner = db.partners.find(p => p.name === item.partnerName);
          if (!partner) {
            results.failed++;
            results.errors.push({ row: i + 2, message: `渠道商"${item.partnerName}"不存在` });
            continue;
          }
          
          // 查重（按账号）
          const existing = db.users.find(u => u.username === item.username);
          if (existing) {
            // 更新
            existing.name = item.name;
            existing.partnerId = partner.id;
            existing.partnerName = partner.name;
            existing.phone = item.phone || '';
            existing.email = item.email || '';
            existing.status = item.status ? STAFF_STATUS[item.status] : 'active';
            existing.updatedBy = userId;
            existing.updatedAt = new Date().toISOString();
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
              status: item.status ? STAFF_STATUS[item.status] : 'active',
              createdBy: userId,
              createdByRole: userRole,
              createdAt: new Date().toISOString()
            };
            
            db.users.push(newUser);
            
            // 添加到渠道商staff列表
            if (!partner.staff) partner.staff = [];
            const prefix = partner.id.replace('P', 'S') + '-';
            const seq = String(partner.staff.length + 1).padStart(2, '0');
            partner.staff.push({
              id: prefix + seq,
              userId: newId,
              username: item.username,
              name: item.name
            });
            
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
          const item = {};
          for (let ci = 0; ci < headers.length; ci++) {
            const mappedKey = headerKeyMap[headers[ci]];
            if (mappedKey) {
              item[mappedKey] = row[ci] !== undefined ? String(row[ci]).trim() : '';
            }
          }
          
          // 验证必填
          if (!item.customer || !item.assignedStaffName || !item.partnerName) {
            results.failed++;
            results.errors.push({ row: i + 2, message: '缺少必填字段（客户名称、员工姓名或渠道商名称）' });
            continue;
          }
          
          // 查找渠道商
          const partner = db.partners.find(p => p.name === item.partnerName);
          if (!partner) {
            results.failed++;
            results.errors.push({ row: i + 2, message: `渠道商"${item.partnerName}"不存在` });
            continue;
          }
          
          // 查找员工
          const staff = db.users.find(u => u.name === item.assignedStaffName && u.partnerId === partner.id && u.role === 'staff');
          if (!staff) {
            results.failed++;
            results.errors.push({ row: i + 2, message: `渠道商"${item.partnerName}"下不存在员工"${item.assignedStaffName}"` });
            continue;
          }
          
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
            existing.updatedBy = userId;
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
              approvedBy: userId,
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
          const item = {};
          for (let ci = 0; ci < headers.length; ci++) {
            const mappedKey = headerKeyMap[headers[ci]];
            if (mappedKey) {
              item[mappedKey] = row[ci] !== undefined ? String(row[ci]).trim() : '';
            }
          }
          
          // 验证必填
          if (!item.name || !item.customer || !item.assignedStaffName || !item.partnerName) {
            results.failed++;
            results.errors.push({ row: i + 2, message: '缺少必填字段（商机名称、客户名称、员工姓名或渠道商名称）' });
            continue;
          }
          
          // 查找渠道商
          const partner = db.partners.find(p => p.name === item.partnerName);
          if (!partner) {
            results.failed++;
            results.errors.push({ row: i + 2, message: `渠道商"${item.partnerName}"不存在` });
            continue;
          }
          
          // 查找员工
          const staff = db.users.find(u => u.name === item.assignedStaffName && u.partnerId === partner.id && u.role === 'staff');
          if (!staff) {
            results.failed++;
            results.errors.push({ row: i + 2, message: `渠道商"${item.partnerName}"下不存在员工"${item.assignedStaffName}"` });
            continue;
          }
          
          // 查找客户报备（验证依赖）
          const reg = db.registrations.find(r => r.customer === item.customer && r.status === 'approved');
          if (!reg) {
            results.failed++;
            results.errors.push({ row: i + 2, message: `客户"${item.customer}"尚未报备或报备未通过审批` });
            continue;
          }
          
          // 查重（按商机名称+客户名称）
          const existing = db.opportunities.find(o => o.name === item.name && o.customer === item.customer);
          if (existing) {
            // 更新
            existing.amount = parseFloat(item.amount) || existing.amount;
            existing.expectedClose = item.expectedClose || existing.expectedClose;
            existing.stage = item.stage ? (OPP_STAGES[item.stage] || item.stage) : existing.stage;
            existing.industry = item.industry || existing.industry;
            existing.contact = item.contact || existing.contact;
            existing.phone = item.phone || existing.phone;
            existing.remark = item.remark || existing.remark;
            existing.assignedStaffId = staff.id;
            existing.assignedStaffName = staff.name;
            existing.partnerId = partner.id;
            existing.partnerName = partner.name;
            existing.updatedBy = userId;
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
              stage: item.stage ? (OPP_STAGES[item.stage] || item.stage) : 'prospecting',
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

loadData();

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║     联软渠道管理平台 - 后端服务已启动           ║
╠════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}              ║
║  数据文件: ${DATA_FILE}          ║
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

// 进程退出时保存数据
process.on('SIGINT', () => {
  saveData();
  console.log('\n✅ 数据已保存，服务关闭');
  process.exit(0);
});
