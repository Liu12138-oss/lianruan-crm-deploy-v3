// ============================================================
// 产品数据 — 来源：LEP套餐报价——外发.xlsx
// ============================================================
const PRODUCT_DATA = {
  // 套餐报价清单
  lep: [
    {
      id: 'LV-VM-1', category: '管理后台', name: '安略安全管控平台虚拟镜像',
      required: true, type: 'hardware',
      desc: '联软安略安全管控平台标准虚拟镜像，支持VMware、802.1x/EOU/WebAuth等准入控制，内置操作系统和数据库软件。',
      priceFixed: 0,
      tiers: [{ min:10,max:19,price:0 },{ min:20,max:49,price:0 },{ min:50,max:99,price:0 },{ min:100,max:199,price:0 },{ min:200,max:500,price:0 }],
    },
    {
      id: '微盾一体机', category: '管理后台', name: '微盾一体机',
      required: false, type: 'hardware',
      desc: '联软安略安全管控平台一体机，支持网关型、802.1x等多种准入控制，内置系统所需操作系统和数据库。',
      priceFixed: 10000,
      tiers: null,
    },
    {
      id: 'UA-AM-1+UA-SoftMgr-1+UA-SS-1', category: '桌面安全管理', name: '桌面管理套件（资产+软件+安全）',
      required: true, type: 'software',
      desc: '终端资产信息收集与管理、远程交互、节能管理；软件安装监控、黑白名单管理；软件防火墙、终端流量统计。',
      tiers: [{ min:10,max:19,price:60 },{ min:20,max:49,price:56 },{ min:50,max:99,price:52 },{ min:100,max:199,price:44 },{ min:200,max:500,price:36 }],
    },
    {
      id: 'LV-AppStore-1', category: '桌面安全管理', name: '企业软件商店',
      required: false, type: 'software',
      desc: '标准化软件中心，为终端用户提供软件下载入口，避免私自下载带来的安全和法律风险。',
      tiers: [{ min:10,max:19,price:15 },{ min:20,max:49,price:14 },{ min:50,max:99,price:13 },{ min:100,max:199,price:11 },{ min:200,max:500,price:9 }],
    },
    {
      id: 'UA-MSP-1', category: '桌面安全管理', name: '微软补丁管理',
      required: false, type: 'software',
      desc: '自动给客户端安装补丁，支持中继和断点续传；支持蓝屏修复和远程卸载补丁。',
      tiers: [{ min:10,max:19,price:15 },{ min:20,max:49,price:14 },{ min:50,max:99,price:13 },{ min:100,max:199,price:11 },{ min:200,max:500,price:9 }],
    },
    {
      id: 'SaaS-SWD', category: '桌面安全管理', name: '云软件安全下载（SaaS）',
      required: false, type: 'saas',
      desc: '提供云端软件下载至软件商城服务，极大节省运维效率。注：需先选购软件商城模块。',
      tiers: [{ min:10,max:19,price:15 },{ min:20,max:49,price:14 },{ min:50,max:99,price:13 },{ min:100,max:199,price:11 },{ min:200,max:500,price:9 }],
    },
    {
      id: 'UA-NAC-1', category: '网络准入', name: '网络准入控制（NAC）',
      required: true, type: 'software',
      desc: '基于802.1x/EoU的网络准入控制，支持终端识别、安全检查、安全隔离、安全修复、安全接入等完整准入流程，横向移动控制。',
      tiers: [{ min:10,max:19,price:135 },{ min:20,max:49,price:126 },{ min:50,max:99,price:117 },{ min:100,max:199,price:110 },{ min:200,max:500,price:99 }],
    },
    {
      id: 'UA-NAC-G-1', category: '网络准入', name: '访客及外协人员管理',
      required: false, type: 'software',
      desc: '访客管理、外协人员管理。注：需先选购网络准入控制模块，数量需保持一致。',
      tiers: [{ min:10,max:19,price:15 },{ min:20,max:49,price:14 },{ min:50,max:99,price:13 },{ min:100,max:199,price:11 },{ min:200,max:500,price:9 }],
    },
    {
      id: 'UEDR-AV-1', category: '防病毒（EDR）', name: '防病毒/EDR客户端（Windows）',
      required: true, type: 'software',
      desc: '防范木马、病毒入侵；病毒查杀（本地查杀）、文件实时防护、白名单管理、勒索防护、日志管理。续费：出厂价×25%/年。',
      renewRate: 0.25,
      tiers: [{ min:10,max:19,price:45 },{ min:20,max:49,price:42 },{ min:50,max:99,price:39 },{ min:100,max:199,price:33 },{ min:200,max:500,price:27 }],
    },
    {
      id: 'UEDR-TI-1', category: '防病毒（EDR）', name: '终端全量信息采集及查询（TI）',
      required: false, type: 'software',
      desc: '终端信息采集与查询（主机/系统用户/服务/PE/进程/网络访问等），支持SQL语句方式快速查询，实时深度调查。',
      tiers: [{ min:10,max:19,price:45 },{ min:20,max:49,price:42 },{ min:50,max:99,price:39 },{ min:100,max:199,price:33 },{ min:200,max:500,price:27 }],
    },
    {
      id: 'UA-DLP-Suite', category: '数据防泄漏（DLP）', name: 'DLP全套（USB+打印+网络+文件+外设）',
      required: true, type: 'software',
      desc: 'USB移动存储管理、打印审计与控制、网络行为审计与控制、文件读写审计、非授权外连控制五合一套件。注：需先选购桌面安全管理。',
      tiers: [{ min:10,max:19,price:75 },{ min:20,max:49,price:70 },{ min:50,max:99,price:65 },{ min:100,max:199,price:55 },{ min:200,max:500,price:45 }],
    },
    {
      id: 'UA-IMCtrl-1', category: '数据防泄漏（DLP）', name: '即时通讯行为审计（IM）',
      required: false, type: 'software',
      desc: 'QQ、企业QQ、TIM、企业微信、钉钉、飞书等即时通讯客户端审计与控制基础模块。',
      tiers: [{ min:10,max:19,price:15 },{ min:20,max:49,price:14 },{ min:50,max:99,price:13 },{ min:100,max:199,price:11 },{ min:200,max:500,price:9 }],
    },
    {
      id: 'UA-EmailCtrl-1', category: '数据防泄漏（DLP）', name: '邮件审计',
      required: false, type: 'software',
      desc: '常见邮件客户端SMTP+TLS邮件内容审计和外发控制；支持QQ邮箱、163邮箱等Web邮件审计。',
      tiers: [{ min:10,max:19,price:15 },{ min:20,max:49,price:14 },{ min:50,max:99,price:13 },{ min:100,max:199,price:11 },{ min:200,max:500,price:9 }],
    },
    {
      id: 'UA-ScrRec-1', category: '数据防泄漏（DLP）', name: '屏幕录像',
      required: false, type: 'software',
      desc: '对终端屏幕进行录像，可在管理端实现回放。',
      tiers: [{ min:10,max:19,price:15 },{ min:20,max:49,price:14 },{ min:50,max:99,price:13 },{ min:100,max:199,price:11 },{ min:200,max:500,price:9 }],
    },
    {
      id: 'UA-ScrCtrl-WaterPrt-1', category: '数据防泄漏（DLP）', name: '屏幕水印与控制',
      required: false, type: 'software',
      desc: '屏幕明文/矢量/图片/二维码水印；截屏管控与隐形盲水印（QQ/企业微信/键盘截屏），截图盲水印追溯。',
      tiers: [{ min:10,max:19,price:15 },{ min:20,max:49,price:14 },{ min:50,max:99,price:13 },{ min:100,max:199,price:11 },{ min:200,max:500,price:9 }],
    },
    {
      id: 'UA-UEnc-1', category: '数据防泄漏（DLP）', name: '安全U盘',
      required: false, type: 'software',
      desc: '安全U盘制作工具；安全U盘绑定注册与管理；安全U盘文件读写操作审计与控制。（按注册数量计算）',
      tiers: [{ min:10,max:19,price:30 },{ min:20,max:49,price:28 },{ min:50,max:99,price:26 },{ min:100,max:199,price:22 },{ min:200,max:500,price:18 }],
    },
    {
      id: 'BDP-DLP-1', category: '数据防泄漏（DLP）', name: '敏感内容检查（DLP）',
      required: false, type: 'software',
      desc: '敏感数据分类分级定义与规则配置；敏感文件审计策略；敏感文件自检工具。',
      tiers: [{ min:10,max:19,price:300 },{ min:20,max:49,price:280 },{ min:50,max:99,price:260 },{ min:100,max:199,price:242 },{ min:200,max:500,price:198 }],
    },
    {
      id: 'UA-DES-Win-1', category: '文档加密', name: '文档安全加密（DES）',
      required: true, type: 'software',
      desc: '自定义受信程序透明加解密；密级标签管理；加密文件权限管控、外发管理、离线管理、备份管理；支持审批流程。',
      tiers: [{ min:10,max:19,price:300 },{ min:20,max:49,price:280 },{ min:50,max:99,price:260 },{ min:100,max:199,price:242 },{ min:200,max:500,price:198 }],
    },
    {
      id: 'SDP-P1', category: '远程办公', name: 'UniSDP零信任访问控制系统（P1设备）',
      required: true, type: 'hardware',
      desc: '4个千兆网口，最大支持500台设备；内置零信任网关、SPA模块；支持PC端+移动端（安卓/鸿蒙/iOS）；集成桌管/准入/DLP。',
      priceFixed: 20000,
      tiers: null,
    },
    {
      id: '准入-N2', category: '无代理准入', name: '网络准入控制器（N2设备）',
      required: true, type: 'hardware',
      desc: '1U机架式，6个千兆网口，最大500台；支持策略路由/端口镜像/EOU/Portal等多种准入方式；含三年标准质保。',
      priceFixed: 27000,
      tiers: null,
    },
  ],

  // XCAD报价清单
  xcad: [
    {
      id: 'Q-DSS-HA-V1', category: '数字化安全基座（必选）', name: '数字化安全基座高可用组件',
      required: true, type: 'software',
      priceFixed: 50000, discount: 0.8, unitPoints: 1,
      desc: '数字化安全基座平台高可用（HA）组件，折扣后出货价10,000元。',
    },
    {
      id: 'Q-DSS-Base-VM-V1', category: '数字化安全基座（必选）', name: '数字化安全基座虚拟机版',
      required: true, type: 'software',
      priceFixed: 120000, discount: 0.8, unitPoints: 1,
      desc: '数字化安全基座平台虚拟机版，折扣后出货价24,000元。',
    },
    {
      id: 'Q-DSS-Base-VM-CNOS-V1', category: '数字化安全基座（必选）', name: '数字化安全基座虚拟机版（国产OS）',
      required: true, type: 'software',
      priceFixed: 240000, discount: 0.8, unitPoints: 1,
      desc: '数字化安全基座平台国产操作系统虚拟机版，折扣后出货价48,000元。',
    },
    {
      id: 'IAM-GW-V1', category: '数字化安全基座（必选）', name: 'IAM身份认证网关',
      required: true, type: 'software',
      priceFixed: 120000, discount: 0.8, unitPoints: 1,
      desc: 'IAM身份认证网关，折扣后出货价24,000元。',
    },
    {
      id: 'XCAD-DomainAuth-V1', category: 'UniXCAD国产化域管（阶梯价）', name: 'UniXCAD域认证模块',
      required: false, type: 'software',
      unitPrice: 400, discount: 0.8, unitPoints: 500,
      tiers: [
        { min:1, max:199, discount: 1.0 },
        { min:200, max:499, discount: 0.9 },
        { min:500, max:999, discount: 0.8 },
        { min:1000, max:1999, discount: 0.72 },
      ],
      desc: '联软国产化身份目录与域管安全系统V5.0 — 域认证模块。阶梯折扣：1-199(10折)，200-499(9折)，500-999(8折)，1000-1999(7.2折)。',
    },
    {
      id: 'XCAD-GroupPolicy-V1', category: 'UniXCAD国产化域管（阶梯价）', name: 'UniXCAD组策略模块',
      required: false, type: 'software',
      unitPrice: 150, discount: 0.8, unitPoints: 500,
      tiers: [
        { min:1, max:199, discount: 1.0 },
        { min:200, max:499, discount: 0.9 },
        { min:500, max:999, discount: 0.8 },
        { min:1000, max:1999, discount: 0.72 },
      ],
      desc: '联软国产化身份目录与域管安全系统V5.0 — 组策略管理模块。',
    },
  ],

  // 备注
  notes: [
    '除特别标注，价格为1年质保产品价格，不包含实施费用。',
    '防病毒模块每年续费：联软出厂价 × 25%。',
    '其它软硬件每年续费：联软出厂价 × 15%。',
    'XCAD产品折扣后为合作伙伴出货价。',
  ]
};

// 根据数量查阶梯价
function getTierPrice(product, qty) {
  if (!product.tiers || !qty) return product.priceFixed || 0;
  for (const t of product.tiers) {
    if (qty >= t.min && qty <= t.max) return t.price;
  }
  return product.tiers[product.tiers.length - 1].price;
}

// XCAD 阶梯折扣
function getXcadDiscount(tiers, qty) {
  if (!tiers) return 0.8;
  for (const t of tiers) {
    if (qty >= t.min && qty <= t.max) return t.discount;
  }
  return tiers[tiers.length - 1].discount;
}
