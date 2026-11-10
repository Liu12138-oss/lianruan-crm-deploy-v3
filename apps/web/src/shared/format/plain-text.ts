/**
 * 历史审批意见可能来自旧系统富文本编辑器。
 * 页面只按纯文本展示，避免把 <strong>、<br> 等标签直接暴露给用户。
 */
const 实体映射: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

export function 清除富文本标签(值: unknown): string {
  if (值 === null || 值 === undefined) return "";
  return String(值)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|tr)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, 十六进制: string) =>
      String.fromCodePoint(Number.parseInt(十六进制, 16)),
    )
    .replace(/&#(\d+);/g, (_, 十进制: string) => String.fromCodePoint(Number.parseInt(十进制, 10)))
    .replace(/&[a-z]+;|&#39;/gi, (实体) => 实体映射[实体.toLowerCase()] ?? 实体)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
