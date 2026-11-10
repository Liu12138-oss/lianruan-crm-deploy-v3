import { pinyin } from "pinyin-pro";

export interface 城市检索项 {
  名称: string;
  全拼: string;
  首字母: string;
}

/** 为标准城市名称生成无声调全拼和首字母别名。 */
export function 构建城市检索项(名称列表: string[]): 城市检索项[] {
  return 名称列表
    .map((名称) => 名称.trim())
    .filter(Boolean)
    .map((名称) => ({
      名称,
      全拼: pinyin(名称, { toneType: "none", type: "array" }).join("").toLowerCase(),
      首字母: pinyin(名称, {
        pattern: "first",
        toneType: "none",
        type: "array",
      })
        .join("")
        .toLowerCase(),
    }));
}

/** 同时按中文、全拼和首字母匹配，结果最多返回指定条数。 */
export function 匹配城市(选项列表: 城市检索项[], 查询: string, 最大条数 = 60): 城市检索项[] {
  const 关键词 = 查询.trim().toLowerCase().replace(/\s+/g, "");
  return 选项列表
    .filter((选项) => {
      if (!关键词) return true;
      return (
        选项.名称.toLowerCase().includes(关键词) ||
        选项.全拼.includes(关键词) ||
        选项.首字母.includes(关键词)
      );
    })
    .slice(0, 最大条数);
}
