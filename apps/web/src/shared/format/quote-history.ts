export type 历史报价金额明细 = {
  单价?: unknown;
  小计?: unknown;
  unitPrice?: unknown;
  lineAmount?: unknown;
};

function 数值(项: 历史报价金额明细, ...键: Array<keyof 历史报价金额明细>): number {
  for (const 字段 of 键) {
    const 值 = 项[字段];
    if (值 === null || 值 === undefined || 值 === "") continue;
    const 结果 = Number(值);
    if (Number.isFinite(结果)) return 结果;
  }
  return 0;
}

/**
 * 历史报价的总额大于明细合计时，说明旧快照只保留了部分价格。
 * 只把单价和小计同时为 0 的明细标记为未记录，避免把有价格的硬件或正常赠送项误判。
 */
export function 计算历史缺价序号(明细列表: 历史报价金额明细[], 报价总额: unknown): Set<number> {
  const 总额 = Number(报价总额);
  const 明细合计 = 明细列表.reduce(
    (合计, 项) => 合计 + Math.max(0, 数值(项, "小计", "lineAmount")),
    0,
  );
  if (!Number.isFinite(总额) || 总额 <= 0 || !明细列表.length || 明细合计 + 0.01 >= 总额) {
    return new Set();
  }
  return new Set(
    明细列表.flatMap((项, 序号) =>
      数值(项, "单价", "unitPrice") === 0 && 数值(项, "小计", "lineAmount") === 0 ? [序号] : [],
    ),
  );
}
