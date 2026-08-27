import crypto from "node:crypto";

export interface 订单预审报价单 {
  订单编号: string;
  报价编号: string;
  合同对方: string;
  最终用户: string;
  所属区域: string;
  明细: Array<{
    名称: string;
    数量: string;
    单价: string;
    金额: string;
  }>;
  合计金额: string;
  生成时间: string;
}

/**
 * 生成只包含订单预审所需内容的 PDF。
 *
 * 使用 PDF 标准中文字体 STSong-Light，避免任务镜像额外依赖系统字体或浏览器。
 * 文件只在任务进程内生成并保存到受控上传目录，不进入 Redis、日志或外部消息正文。
 */
export function 生成订单预审报价单PDF(报价单: 订单预审报价单): Buffer {
  const 行 = [
    "渠道产品订单预审报价单",
    `订单编号：${报价单.订单编号}`,
    `报价编号：${报价单.报价编号 || "未登记"}`,
    `合同对方：${报价单.合同对方}`,
    `最终用户：${报价单.最终用户}`,
    `所属区域：${报价单.所属区域}`,
    "",
    "采购内容明细",
    "序号  名称  数量  单价（元）  金额（元）",
    ...报价单.明细.flatMap((项目, 下标) =>
      拆分过长文本(`${下标 + 1}. ${项目.名称}    ${项目.数量}    ${项目.单价}    ${项目.金额}`, 42),
    ),
    "",
    `合计金额（元）：${报价单.合计金额}`,
    `生成时间：${报价单.生成时间}`,
    "本报价单由联软渠道管理平台按订单关联报价生成，仅用于渠道产品订单预审。",
  ];
  const 每页行数 = 38;
  const 页面 = 分页(行, 每页行数);
  const 对象: string[] = [];
  const 页面对象起始编号 = 5;
  const 内容对象起始编号 = 页面对象起始编号 + 页面.length;

  对象.push("<< /Type /Catalog /Pages 2 0 R >>");
  对象.push(
    `<< /Type /Pages /Kids [${页面.map((_, 下标) => `${页面对象起始编号 + 下标} 0 R`).join(" ")}] /Count ${页面.length} >>`,
  );
  对象.push(
    "<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [4 0 R] >>",
  );
  对象.push(
    "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /DW 1000 >>",
  );

  for (let 下标 = 0; 下标 < 页面.length; 下标 += 1) {
    const 内容编号 = 内容对象起始编号 + 下标;
    对象.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${内容编号} 0 R >>`,
    );
  }
  for (let 下标 = 0; 下标 < 页面.length; 下标 += 1) {
    const 内容 = 生成页面内容(页面[下标] || [], 下标 + 1, 页面.length);
    const 字节长度 = Buffer.byteLength(内容, "binary");
    对象.push(`<< /Length ${字节长度} >>\nstream\n${内容}\nendstream`);
  }

  const 文件头 = "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n";
  const 分段: Buffer[] = [Buffer.from(文件头, "binary")];
  const 偏移 = [0];
  let 已写字节 = Buffer.byteLength(文件头, "binary");
  for (let 下标 = 0; 下标 < 对象.length; 下标 += 1) {
    偏移.push(已写字节);
    const 内容 = `${下标 + 1} 0 obj\n${对象[下标]}\nendobj\n`;
    const 二进制 = Buffer.from(内容, "binary");
    分段.push(二进制);
    已写字节 += 二进制.length;
  }
  const 交叉引用偏移 = 已写字节;
  const 交叉引用 = [
    `xref\n0 ${对象.length + 1}`,
    "0000000000 65535 f ",
    ...偏移.slice(1).map((位置) => `${String(位置).padStart(10, "0")} 00000 n `),
    `trailer\n<< /Size ${对象.length + 1} /Root 1 0 R /ID [<${生成文件标识(报价单)}> <${生成文件标识(报价单)}>] >>`,
    `startxref\n${交叉引用偏移}\n%%EOF\n`,
  ].join("\n");
  分段.push(Buffer.from(交叉引用, "binary"));
  return Buffer.concat(分段);
}

function 生成页面内容(行: string[], 页码: number, 总页数: number): string {
  const 指令 = ["BT", "/F1 11 Tf", "48 795 Td", "15 TL"];
  for (const [下标, 文本] of 行.entries()) {
    if (下标 > 0) 指令.push("T*");
    指令.push(`<${转换为UCS2十六进制(文本)}> Tj`);
  }
  指令.push("ET");
  指令.push(
    "BT",
    "/F1 9 Tf",
    "480 28 Td",
    `<${转换为UCS2十六进制(`第 ${页码}/${总页数} 页`)}> Tj`,
    "ET",
  );
  return 指令.join("\n");
}

function 转换为UCS2十六进制(文本: string): string {
  const 缓冲区 = Buffer.from(文本.replace(/[\r\n]/g, " "), "utf16le");
  for (let 下标 = 0; 下标 < 缓冲区.length; 下标 += 2) {
    const 临时 = 缓冲区[下标] || 0;
    缓冲区[下标] = 缓冲区[下标 + 1] || 0;
    缓冲区[下标 + 1] = 临时;
  }
  return 缓冲区.toString("hex").toUpperCase();
}

function 拆分过长文本(文本: string, 最大字符数: number): string[] {
  const 字符 = Array.from(文本);
  if (字符.length <= 最大字符数) return [文本];
  const 结果: string[] = [];
  for (let 起始 = 0; 起始 < 字符.length; 起始 += 最大字符数) {
    结果.push(字符.slice(起始, 起始 + 最大字符数).join(""));
  }
  return 结果;
}

function 分页<T>(项目: T[], 每页数量: number): T[][] {
  const 结果: T[][] = [];
  for (let 起始 = 0; 起始 < 项目.length; 起始 += 每页数量) {
    结果.push(项目.slice(起始, 起始 + 每页数量));
  }
  return 结果.length ? 结果 : [[]];
}

function 生成文件标识(报价单: 订单预审报价单): string {
  return crypto
    .createHash("md5")
    .update(`${报价单.订单编号}:${报价单.报价编号}:${报价单.生成时间}`, "utf8")
    .digest("hex")
    .toUpperCase();
}
