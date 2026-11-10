import type { 阶段9记录 } from "../../api/business-client.js";
import type { 产品树功能, 产品树大类, 产品树模块 } from "../product/product-catalog-client.js";

export interface 报价目录功能 {
  编号: string;
  名称: string;
  编码: string;
  排序: number;
  定位键: string[];
  产品: 阶段9记录;
}

export interface 报价目录模块 {
  编号: string;
  名称: string;
  图标: string;
  排序: number;
  功能: 报价目录功能[];
}

export interface 报价目录大类 {
  编号: string;
  名称: string;
  编码: string;
  图标: string;
  排序: number;
  模块: 报价目录模块[];
}

export interface 已选报价明细分组<项> {
  大类名称: string;
  模块名称: string;
  大类排序: number;
  模块排序: number;
  明细: 项[];
}

interface 树定位 {
  大类: 产品树大类;
  模块: 产品树模块;
  功能: 产品树功能;
  大类排序: number;
  模块排序: number;
  功能排序: number;
}

interface 大类构建项 {
  编号: string;
  名称: string;
  编码: string;
  图标: string;
  排序: number;
  模块: Map<string, 模块构建项>;
}

interface 模块构建项 {
  编号: string;
  名称: string;
  图标: string;
  排序: number;
  功能: 报价目录功能[];
}

function 文本值(值: unknown): string {
  if (值 === null || 值 === undefined) return "";
  return String(值).trim();
}

function 数字值(值: unknown, 默认值 = 9999): number {
  const 数值 = Number(值);
  return Number.isFinite(数值) ? 数值 : 默认值;
}

function 原始数据(产品: 阶段9记录): Record<string, unknown> {
  return (产品.原始数据 as Record<string, unknown>) || {};
}

function 唯一非空(值列表: unknown[]): string[] {
  return [...new Set(值列表.map(文本值).filter(Boolean))];
}

function 产品定位键(产品: 阶段9记录): string[] {
  const 原始 = 原始数据(产品);
  return 唯一非空([
    产品.id,
    产品.编号,
    原始.id,
    原始.productId,
    原始.featureId,
    原始.v2_source_id,
    原始.v2SourceId,
    原始.feature_code,
    原始.featureCode,
    原始.productCode,
    原始.uuid,
  ]);
}

function 建立树索引(产品树: 产品树大类[]): Map<string, 树定位> {
  const 索引 = new Map<string, 树定位>();
  产品树.forEach((大类, 大类序) => {
    (大类.modules || []).forEach((模块, 模块序) => {
      (模块.features || []).forEach((功能, 功能序) => {
        const 定位: 树定位 = {
          大类,
          模块,
          功能,
          大类排序: 大类序,
          模块排序: 模块序,
          功能排序: 功能序,
        };
        for (const 键 of 唯一非空([功能.id, 功能.uuid, 功能.productCode])) {
          if (!索引.has(键)) 索引.set(键, 定位);
        }
      });
    });
  });
  return 索引;
}

function 按排序和名称比较(
  左: { 排序: number; 名称: string },
  右: { 排序: number; 名称: string },
): number {
  return 左.排序 - 右.排序 || 左.名称.localeCompare(右.名称, "zh-CN");
}

/** 维保产品使用显式分类编码识别；没有分类编码的历史数据不算维保。 */
export function 是维保报价产品(产品: 阶段9记录): boolean {
  const 原始 = 原始数据(产品);
  return 文本值(原始.categoryCode || 原始.category_code) === "CAT-MAINTENANCE";
}

/**
 * 把阶段九产品整理成稳定的“大类 → 模块 → 功能”目录。
 * 产品树只负责名称、图标和顺序；报价选择与保存仍使用阶段九产品 id。
 */
export function 构建报价目录(产品列表: 阶段9记录[], 产品树: 产品树大类[] = []): 报价目录大类[] {
  const 树索引 = 建立树索引(产品树);
  const 大类映射 = new Map<string, 大类构建项>();
  const 已处理产品 = new Set<string>();

  for (const 产品 of 产品列表) {
    if (!产品?.id || 已处理产品.has(产品.id)) continue;
    已处理产品.add(产品.id);

    const 原始 = 原始数据(产品);
    const 定位 = 产品定位键(产品)
      .map((键) => 树索引.get(键))
      .find(Boolean);
    const 大类名称 =
      文本值(定位?.大类.name) || 文本值(原始.categoryName || 原始.category_name) || "其他功能";
    const 模块名称 =
      文本值(定位?.模块.name) || 文本值(原始.moduleName || 原始.module_name) || "其他模块";
    const 大类识别 = 文本值(
      定位?.大类.code ||
        原始.categoryCode ||
        原始.category_code ||
        原始.categoryId ||
        原始.category_id ||
        大类名称,
    );
    const 大类编号 = `大类:${大类识别 || 大类名称}`;
    const 模块识别 = 文本值(
      定位?.模块.code ||
        原始.moduleCode ||
        原始.module_code ||
        原始.moduleId ||
        原始.module_id ||
        模块名称,
    );
    const 模块编号 = `${大类编号}\u0000模块:${模块识别 || 模块名称}`;
    const 大类排序 = 定位?.大类排序 ?? 9999;
    const 模块排序 = 定位?.模块排序 ?? 数字值(原始.moduleSort || 原始.sort, 9999);
    const 功能排序 = 定位?.功能排序 ?? 数字值(原始.sort, 9999);

    let 大类项 = 大类映射.get(大类编号);
    if (!大类项) {
      大类项 = {
        编号: 大类编号,
        名称: 大类名称,
        编码: 文本值(定位?.大类.code || 定位?.大类.id || 原始.categoryCode || 原始.category_code),
        图标: 文本值(定位?.大类.icon),
        排序: 大类排序,
        模块: new Map<string, 模块构建项>(),
      };
      大类映射.set(大类编号, 大类项);
    }

    let 模块项 = 大类项.模块.get(模块编号);
    if (!模块项) {
      模块项 = {
        编号: 模块编号,
        名称: 模块名称,
        图标: 文本值(定位?.模块.icon),
        排序: 模块排序,
        功能: [],
      };
      大类项.模块.set(模块编号, 模块项);
    }

    模块项.功能.push({
      编号: 产品.id,
      名称: 文本值(产品.标题 || 原始.name) || "未命名功能",
      编码:
        文本值(原始.productCode || 原始.featureCode || 原始.feature_code || 产品.编号) || 产品.id,
      排序: 功能排序,
      定位键: 产品定位键(产品),
      产品,
    });
  }

  return [...大类映射.values()]
    .map((大类) => ({
      编号: 大类.编号,
      名称: 大类.名称,
      编码: 大类.编码,
      图标: 大类.图标,
      排序: 大类.排序,
      模块: [...大类.模块.values()]
        .map((模块) => ({
          编号: 模块.编号,
          名称: 模块.名称,
          图标: 模块.图标,
          排序: 模块.排序,
          功能: [...模块.功能].sort(按排序和名称比较),
        }))
        .sort(按排序和名称比较),
    }))
    .sort(按排序和名称比较);
}

/** 按套餐 featureIds 保留命中的功能，兼容 V2 编号、V3 UUID 与产品编码。 */
export function 筛选套餐功能目录(目录: 报价目录大类[], 功能编号列表: string[]): 报价目录大类[] {
  const 功能集合 = new Set(功能编号列表.map(文本值).filter(Boolean));
  if (!功能集合.size) return [];

  return 目录
    .map((大类) => {
      const 模块 = 大类.模块
        .map((模块项) => ({
          ...模块项,
          功能: 模块项.功能.filter((功能) => 功能.定位键.some((键) => 功能集合.has(键))),
        }))
        .filter((模块项) => 模块项.功能.length);
      return { ...大类, 模块 };
    })
    .filter((大类) => 大类.模块.length);
}

/** 搜索只缩小可选目录，不改变已选内容与保存顺序。 */
export function 过滤报价目录(目录: 报价目录大类[], 关键词: string): 报价目录大类[] {
  const 目标 = 关键词.trim().toLowerCase();
  if (!目标) return 目录;

  return 目录
    .map((大类) => {
      const 模块 = 大类.模块
        .map((模块项) => ({
          ...模块项,
          功能: 模块项.功能.filter((功能) => {
            const 检索文本 = [功能.名称, 功能.编码, 模块项.名称, 大类.名称].join(" ").toLowerCase();
            return 检索文本.includes(目标);
          }),
        }))
        .filter((模块项) => 模块项.功能.length);
      return { ...大类, 模块 };
    })
    .filter((大类) => 大类.模块.length);
}

/** 已选软件明细按产品模块分组；历史明细无法匹配目录时统一进入“其他功能”。 */
export function 分组已选报价明细<项 extends { id: string; 名称: string }>(
  明细列表: 项[],
  目录: 报价目录大类[],
): 已选报价明细分组<项>[] {
  const 编号索引 = new Map<string, { 大类: 报价目录大类; 模块: 报价目录模块 }>();
  const 名称索引 = new Map<string, { 大类: 报价目录大类; 模块: 报价目录模块 }>();

  for (const 大类 of 目录) {
    for (const 模块 of 大类.模块) {
      for (const 功能 of 模块.功能) {
        for (const 键 of 功能.定位键) {
          if (!编号索引.has(键)) 编号索引.set(键, { 大类, 模块 });
        }
        if (!名称索引.has(功能.名称)) 名称索引.set(功能.名称, { 大类, 模块 });
      }
    }
  }

  const 分组表 = new Map<string, 已选报价明细分组<项>>();
  for (const 项 of 明细列表) {
    const 命中 = 编号索引.get(文本值(项.id)) || 名称索引.get(文本值(项.名称));
    const 大类名称 = 命中?.大类.名称 || "其他功能";
    const 模块名称 = 命中?.模块.名称 || "其他模块";
    const 键 = `${命中?.大类.编号 || "其他功能"}\u0000${命中?.模块.编号 || "其他模块"}`;
    let 分组 = 分组表.get(键);
    if (!分组) {
      分组 = {
        大类名称,
        模块名称,
        大类排序: 命中?.大类.排序 ?? 9999,
        模块排序: 命中?.模块.排序 ?? 9999,
        明细: [],
      };
      分组表.set(键, 分组);
    }
    分组.明细.push(项);
  }

  return [...分组表.values()].sort(
    (左, 右) =>
      左.大类排序 - 右.大类排序 ||
      左.模块排序 - 右.模块排序 ||
      左.大类名称.localeCompare(右.大类名称, "zh-CN") ||
      左.模块名称.localeCompare(右.模块名称, "zh-CN"),
  );
}
