import crypto from "node:crypto";

export type 正式报价单明细类型 = "软件产品" | "硬件设备" | "服务项";

export interface 正式报价单明细 {
  名称: string;
  数量: string;
  单价: string;
  金额: string;
  类型?: 正式报价单明细类型;
  数量标签?: string;
}

export interface 正式报价单数据 {
  订单编号?: string;
  报价编号: string;
  合同对方: string;
  最终用户: string;
  所属区域: string;
  明细: 正式报价单明细[];
  合计金额: string;
  生成时间: string;
  工作量说明?: string;
  标准人天?: string;
  项目名称?: string;
  有效期?: string;
  端点数量?: string;
  报价状态?: string;
}

/** 兼容订单预审 Worker 的既有类型名。 */
export type 订单预审报价单 = 正式报价单数据;

const 页面宽度 = 595;
const 页面高度 = 842;
const 左边距 = 42;
const 右边距 = 42;
const 内容宽度 = 页面宽度 - 左边距 - 右边距;
const 蓝色 = "0.04 0.12 0.24";
const 强调蓝色 = "0.08 0.35 0.76";
const 浅蓝色 = "0.93 0.96 1";
const 边框色 = "0.84 0.88 0.94";
const 正文色 = "0.12 0.16 0.23";
const 次要色 = "0.38 0.43 0.51";

/**
 * 生成页面下载和 OA 附件共用的正式报价单 PDF。
 *
 * PDF 只使用 PDF 标准字体：中文使用 STSong-Light，英文和数字使用
 * Helvetica。两种字体按字符分段绘制，避免中文字体把英文和数字拉成全角间距。
 */
export function 生成正式报价单PDF(报价单: 正式报价单数据): Buffer {
  const 明细 = 补齐默认明细(报价单.明细);
  const 分组 = [
    { 标题: "软件产品", 数量列名: "授权端点数", 数据: 明细.filter((项) => 项.类型 === "软件产品") },
    { 标题: "硬件设备", 数量列名: "数量", 数据: 明细.filter((项) => 项.类型 === "硬件设备") },
    { 标题: "服务项", 数量列名: "数量", 数据: 明细.filter((项) => 项.类型 === "服务项") },
  ].filter((项) => 项.数据.length > 0);
  const 页面列表 = 创建页面内容(报价单, 分组);
  return 生成PDF(页面列表, `${报价单.报价编号}:${报价单.生成时间}`);
}

/** 生成泛微 OA 的采购内容字段；硬件只在 PDF 附件中展示。 */
export function 生成订单预审采购内容(明细: 正式报价单明细[], 是否补充标准质保 = true): string {
  const 标准明细 = 补齐默认明细(明细, 是否补充标准质保);
  const 软件 = 标准明细.filter((项) => 项.类型 === "软件产品");
  const 服务 = 标准明细.filter((项) => 项.类型 === "服务项");
  const 行: string[] = [];
  if (软件.length) {
    行.push("软件产品：");
    软件.forEach((项, 下标) => {
      行.push(
        `${下标 + 1}. ${项.名称}，授权端点数：${规范数量标签(项.数量标签 || `${项.数量} 点`)}，小计：${格式金额带符号(项.金额)}`,
      );
    });
  }
  if (服务.length) {
    if (行.length) 行.push("");
    行.push("服务项：");
    服务.forEach((项, 下标) => {
      行.push(
        `${下标 + 1}. ${项.名称}，数量：${规范数量标签(项.数量标签 || 项.数量)}，小计：${格式金额带符号(项.金额)}`,
      );
    });
  }
  return 行.join("\n");
}

function 创建页面内容(
  报价单: 正式报价单数据,
  分组: Array<{ 标题: string; 数量列名: string; 数据: 正式报价单明细[] }>,
): 页面内容[] {
  const 内容: 页面内容[] = [];
  let 当前页 = 创建空页面();
  let y = 214;
  添加页眉(当前页, 报价单);

  const 添加到下一页 = () => {
    内容.push(当前页);
    当前页 = 创建空页面();
    y = 72;
    添加续页标题(当前页, 报价单);
  };

  添加文本(当前页, "产品明细", 左边距, y, 13, "bold", 正文色);
  y += 28;
  for (const 分组项 of 分组) {
    const 行数 = 分组项.数据.reduce(
      (总数, 项) => 总数 + Math.max(1, 拆分文本(项.名称, 25).length),
      0,
    );
    const 组高度 = 48 + 行数 * 30;
    if (y + 组高度 > 680) {
      添加到下一页();
      添加文本(当前页, "产品明细（续）", 左边距, y, 13, "bold", 正文色);
      y += 28;
    }
    y = 添加明细分组(当前页, 分组项, y);
    y += 18;
  }

  if (y + 180 > 790) 添加到下一页();
  添加合计与签章(当前页, 报价单, y);
  内容.push(当前页);
  return 内容;
}

interface 页面内容 {
  指令: string[];
}

function 创建空页面(): 页面内容 {
  return { 指令: [] };
}

function 添加页眉(页面: 页面内容, 报价单: 正式报价单数据): void {
  填充矩形(页面, 0, 0, 页面宽度, 200, 蓝色);
  添加文本(页面, "联软科技（深圳）有限公司", 左边距, 38, 14, "bold", "1 1 1");
  添加文本(
    页面,
    "UniSoft Technology (Shenzhen) Co., Ltd.",
    左边距,
    59,
    8.5,
    "regular",
    "0.76 0.86 1",
  );
  添加文本(页面, "联软安全产品报价单", 左边距, 99, 23, "bold", "1 1 1");
  添加文本(页面, "UniSoft Security Products Quotation", 左边距, 122, 10, "regular", "0.76 0.86 1");

  const 元数据: Array<[string, string]> = [
    ["报价编号", 报价单.报价编号 || "未登记"],
    ["客户名称", 报价单.最终用户 || "未填写"],
    ["项目名称", 报价单.项目名称 || "—"],
    ["报价日期", 格式日期(报价单.生成时间)],
    ["有效期", 报价单.有效期 ? `${报价单.有效期} 天` : "—"],
    ["端点数量", 报价单.端点数量 ? `${报价单.端点数量} 台` : "—"],
  ];
  元数据.forEach(([标签, 值], 下标) => {
    const 列 = 下标 % 3;
    const 行 = Math.floor(下标 / 3);
    const x = 左边距 + 列 * 171;
    const y = 141 + 行 * 27;
    填充矩形(页面, x, y, 160, 22, "0.12 0.25 0.43");
    添加文本(页面, 标签, x + 8, y + 9, 7, "regular", "0.67 0.78 0.92");
    添加文本(页面, 截断文本(值, 18), x + 8, y + 19, 8.5, "bold", "1 1 1");
  });
}

function 添加续页标题(页面: 页面内容, 报价单: 正式报价单数据): void {
  填充矩形(页面, 0, 0, 页面宽度, 52, 蓝色);
  添加文本(页面, "联软安全产品报价单", 左边距, 29, 14, "bold", "1 1 1");
  添加文本(页面, 报价单.报价编号 || "未登记", 页面宽度 - 150, 29, 9, "regular", "0.78 0.86 1");
}

function 添加明细分组(
  页面: 页面内容,
  分组: { 标题: string; 数量列名: string; 数据: 正式报价单明细[] },
  起始Y: number,
): number {
  const 列 = { 序号: 左边距, 名称: 72, 数量: 315, 小计: 410 };
  添加文本(页面, 分组.标题, 左边距, 起始Y, 11, "bold", 强调蓝色);
  const 表头Y = 起始Y + 12;
  填充矩形(页面, 左边距, 表头Y, 内容宽度, 24, 浅蓝色);
  添加文本(页面, "序号", 列.序号 + 8, 表头Y + 16, 8.5, "bold", 正文色);
  添加文本(页面, "产品名称", 列.名称 + 8, 表头Y + 16, 8.5, "bold", 正文色);
  添加文本(页面, 分组.数量列名, 列.数量 + 8, 表头Y + 16, 8.5, "bold", 正文色);
  添加文本(页面, "小计（元）", 列.小计 + 8, 表头Y + 16, 8.5, "bold", 正文色);
  let y = 表头Y + 24;
  const 行边界 = [表头Y, y];
  分组.数据.forEach((项, 下标) => {
    const 名称行 = 拆分文本(项.名称, 25);
    const 行高 = Math.max(1, 名称行.length) * 30;
    if (下标 % 2 === 1) 填充矩形(页面, 左边距, y, 内容宽度, 行高, "0.98 0.99 1");
    添加文本(页面, String(下标 + 1), 列.序号 + 10, y + 19, 9, "regular", 正文色);
    名称行.forEach((行文本, 行下标) =>
      添加文本(页面, 行文本, 列.名称 + 8, y + 18 + 行下标 * 14, 8.8, "regular", 正文色),
    );
    添加文本(
      页面,
      规范数量标签(项.数量标签 || 项.数量),
      列.数量 + 8,
      y + 19,
      8.8,
      "regular",
      正文色,
    );
    添加文本(页面, 格式金额(项.金额), 列.小计 + 8, y + 19, 8.8, "bold", 正文色);
    y += 行高;
    行边界.push(y);
  });
  画表格线(页面, 表头Y, y, [30, 243, 95, 143], 行边界);
  return y;
}

function 添加合计与签章(页面: 页面内容, 报价单: 正式报价单数据, 起始Y: number): void {
  let y = 起始Y + 2;
  if (报价单.工作量说明) {
    填充矩形(页面, 左边距, y, 内容宽度, 46, "0.95 0.99 0.93");
    添加文本(页面, "标准工作量建议", 左边距 + 12, y + 17, 9.5, "bold", "0.14 0.46 0.10");
    添加文本(页面, 截断文本(报价单.工作量说明, 58), 左边距 + 12, y + 33, 8.5, "regular", 次要色);
    if (报价单.标准人天)
      添加文本(
        页面,
        `${报价单.标准人天} 人天`,
        页面宽度 - 120,
        y + 26,
        12,
        "bold",
        "0.14 0.46 0.10",
      );
    y += 62;
  }
  const 合计宽度 = 220;
  const 合计X = 页面宽度 - 42 - 合计宽度;
  填充矩形(页面, 合计X, y, 合计宽度, 72, "0.96 0.98 1");
  添加文本(页面, "产品合计", 合计X + 14, y + 20, 9, "regular", 次要色);
  添加文本(页面, 格式金额(报价单.合计金额), 合计X + 145, y + 20, 9, "regular", 正文色);
  添加文本(页面, "实施服务费", 合计X + 14, y + 39, 9, "regular", 次要色);
  添加文本(页面, "另行报价", 合计X + 145, y + 39, 9, "regular", 次要色);
  画线(页面, 合计X + 12, y + 47, 合计X + 合计宽度 - 12, y + 47, "0.78 0.84 0.94", 0.7);
  添加文本(页面, "报价总额", 合计X + 14, y + 64, 10.5, "bold", 强调蓝色);
  添加文本(页面, 格式金额(报价单.合计金额), 合计X + 145, y + 64, 10.5, "bold", 强调蓝色);
  y += 104;
  画线(页面, 左边距, y, 页面宽度 - 42, y, 边框色, 0.7);
  添加文本(页面, "报价方签章：___________________", 左边距, y + 26, 8.5, "regular", 次要色);
  添加文本(页面, "客户方签章：___________________", 300, y + 26, 8.5, "regular", 次要色);
  添加文本(页面, "日期：___________________", 左边距, y + 47, 8.5, "regular", 次要色);
  添加文本(页面, "日期：___________________", 300, y + 47, 8.5, "regular", 次要色);
  添加文本(
    页面,
    "联系电话：400-800-XXXX    官网：www.unisoft.com.cn",
    左边距,
    y + 69,
    8,
    "regular",
    次要色,
  );
  添加文本(
    页面,
    "本报价单由联软渠道管理平台自动生成",
    左边距,
    y + 84,
    7.5,
    "regular",
    "0.55 0.59 0.66",
  );
}

function 画表格线(
  页面: 页面内容,
  起始Y: number,
  结束Y: number,
  列宽: number[],
  行边界: number[],
): void {
  let x = 左边距;
  画线(页面, x, 起始Y, x, 结束Y, 边框色, 0.6);
  for (const 宽度 of 列宽) {
    x += 宽度;
    画线(页面, x, 起始Y, x, 结束Y, 边框色, 0.6);
  }
  for (const y of new Set([起始Y, ...行边界, 结束Y])) {
    画线(页面, 左边距, y, 页面宽度 - 42, y, 边框色, 0.6);
  }
}

function 填充矩形(
  页面: 页面内容,
  x: number,
  y: number,
  宽度: number,
  高度: number,
  颜色: string,
): void {
  页面.指令.push(
    `${颜色} rg ${数字(x)} ${数字(页面高度 - y - 高度)} ${数字(宽度)} ${数字(高度)} re f`,
  );
}

function 画线(
  页面: 页面内容,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  颜色: string,
  宽度: number,
): void {
  页面.指令.push(
    `${颜色} RG ${数字(宽度)} w ${数字(x1)} ${数字(页面高度 - y1)} m ${数字(x2)} ${数字(页面高度 - y2)} l S`,
  );
}

function 添加文本(
  页面: 页面内容,
  文本: string,
  x: number,
  y: number,
  字号: number,
  字重: "regular" | "bold",
  颜色: string,
): void {
  let 当前X = x;
  const 片段 = 文本.replace(/[\r\n]/g, " ").match(/[\x20-\x7e]+|[^\x20-\x7e]+/g) || [];
  for (const 一段 of 片段) {
    const 是否拉丁 = /^[\x20-\x7e]+$/.test(一段);
    const 字体 = 是否拉丁 ? (字重 === "bold" ? "/F3" : "/F2") : "/F1";
    const 内容 = 是否拉丁 ? `(${转义PDF文本(一段)}) Tj` : `<${转换为UCS2十六进制(一段)}> Tj`;
    页面.指令.push(
      `BT ${颜色} rg ${字体} ${数字(字号)} Tf 1 0 0 1 ${数字(当前X)} ${数字(页面高度 - y)} Tm ${内容} ET`,
    );
    当前X += 估算文本宽度(一段, 字号, 是否拉丁);
  }
}

function 生成PDF(页面列表: 页面内容[], 标识: string): Buffer {
  const 对象: string[] = [];
  const 页面对象起始编号 = 7;
  const 内容对象起始编号 = 页面对象起始编号 + 页面列表.length;
  对象.push("<< /Type /Catalog /Pages 2 0 R >>");
  对象.push(
    `<< /Type /Pages /Kids [${页面列表.map((_, i) => `${页面对象起始编号 + i} 0 R`).join(" ")}] /Count ${页面列表.length} >>`,
  );
  对象.push(
    "<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [4 0 R] >>",
  );
  对象.push(
    "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /DW 1000 >>",
  );
  对象.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  对象.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );
  for (let i = 0; i < 页面列表.length; i += 1) {
    const 内容编号 = 内容对象起始编号 + i;
    对象.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${页面宽度} ${页面高度}] /Resources << /Font << /F1 3 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents ${内容编号} 0 R >>`,
    );
  }
  for (let i = 0; i < 页面列表.length; i += 1) {
    const 页面 = 页面列表[i];
    if (!页面) continue;
    const 内容 = [
      ...页面.指令,
      `BT /F2 8 Tf 0.45 0.5 0.58 rg 1 0 0 1 510 24 Tm (${i + 1}/${页面列表.length}) Tj ET`,
    ].join("\n");
    对象.push(`<< /Length ${Buffer.byteLength(内容, "binary")} >>\nstream\n${内容}\nendstream`);
  }
  const 文件头 = "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n";
  const 分段: Buffer[] = [Buffer.from(文件头, "binary")];
  const 偏移 = [0];
  let 已写字节 = Buffer.byteLength(文件头, "binary");
  for (let i = 0; i < 对象.length; i += 1) {
    偏移.push(已写字节);
    const 内容 = `${i + 1} 0 obj\n${对象[i]}\nendobj\n`;
    const 二进制 = Buffer.from(内容, "binary");
    分段.push(二进制);
    已写字节 += 二进制.length;
  }
  const 交叉引用偏移 = 已写字节;
  const 标识摘要 = crypto.createHash("md5").update(标识, "utf8").digest("hex").toUpperCase();
  分段.push(
    Buffer.from(
      [
        `xref\n0 ${对象.length + 1}`,
        "0000000000 65535 f ",
        ...偏移.slice(1).map((值) => `${String(值).padStart(10, "0")} 00000 n `),
        `trailer\n<< /Size ${对象.length + 1} /Root 1 0 R /ID [<${标识摘要}> <${标识摘要}>] >>`,
        `startxref\n${交叉引用偏移}\n%%EOF\n`,
      ].join("\n"),
      "binary",
    ),
  );
  return Buffer.concat(分段);
}

function 补齐默认明细(明细: 正式报价单明细[], 是否补充标准质保 = true): 正式报价单明细[] {
  const 结果 = 明细.map((项) => ({
    ...项,
    类型: 项.类型 || 推断明细类型(项),
    数量标签: 项.数量标签 || 推断数量标签(项),
  }));
  if (是否补充标准质保 && !结果.some((项) => 项.名称.trim() === "标准质保服务（赠送1年）")) {
    结果.push({
      名称: "标准质保服务（赠送1年）",
      数量: "1",
      数量标签: "1 年",
      单价: "0",
      金额: "0",
      类型: "服务项",
    });
  }
  return 结果;
}

function 推断明细类型(项: 正式报价单明细): 正式报价单明细类型 {
  if (/质保|维护|服务|实施|培训|部署|安装|售后/.test(项.名称)) return "服务项";
  if (/硬件|设备|服务器|网关|探针/.test(项.名称)) return "硬件设备";
  return "软件产品";
}

function 推断数量标签(项: 正式报价单明细): string {
  if (项.类型 === "软件产品") return `${格式数量(项.数量)} 点`;
  if (项.名称.includes("质保") || 项.名称.includes("年")) return `${格式数量(项.数量)} 年`;
  return 格式数量(项.数量);
}

function 格式金额带符号(值: string): string {
  return `¥${格式金额(值)}`;
}

function 格式金额(值: string): string {
  const 数字值 = Number(值);
  if (!Number.isFinite(数字值)) return "0";
  return 数字值.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function 格式数量(值: string): string {
  const 数字值 = Number(值);
  if (!Number.isFinite(数字值)) return 值;
  return 数字值.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

function 规范数量标签(值: string): string {
  const 匹配 = 值.trim().match(/^(-?[\d.]+)(.*)$/);
  return 匹配 ? `${格式数量(匹配[1] || "0")}${匹配[2] || ""}` : 值;
}

function 格式日期(值: string): string {
  const 日期 = new Date(值);
  return Number.isNaN(日期.getTime()) ? 值 : 日期.toISOString().slice(0, 10);
}

function 拆分文本(值: string, 每行字符数: number): string[] {
  const 字符 = Array.from(值 || "");
  if (!字符.length) return ["—"];
  const 结果: string[] = [];
  for (let i = 0; i < 字符.length; i += 每行字符数)
    结果.push(字符.slice(i, i + 每行字符数).join(""));
  return 结果;
}

function 截断文本(值: string, 最大字符数: number): string {
  const 字符 = Array.from(值 || "");
  return 字符.length > 最大字符数 ? `${字符.slice(0, 最大字符数 - 1).join("")}…` : 值 || "—";
}

function 估算文本宽度(文本: string, 字号: number, 是否拉丁: boolean): number {
  return Array.from(文本).reduce((总数, _字符) => 总数 + 字号 * (是否拉丁 ? 0.56 : 1), 0);
}

function 数字(值: number): string {
  return Number.isInteger(值) ? String(值) : 值.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function 转义PDF文本(文本: string): string {
  return 文本.replace(/[\\()]/g, (字符) => `\\${字符}`);
}

function 转换为UCS2十六进制(文本: string): string {
  const 缓冲区 = Buffer.from(文本.replace(/[\r\n]/g, " "), "utf16le");
  for (let i = 0; i < 缓冲区.length; i += 2) {
    const 临时 = 缓冲区[i] || 0;
    缓冲区[i] = 缓冲区[i + 1] || 0;
    缓冲区[i + 1] = 临时;
  }
  return 缓冲区.toString("hex").toUpperCase();
}
