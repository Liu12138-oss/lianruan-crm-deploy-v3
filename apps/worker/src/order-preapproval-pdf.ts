export {
  type 正式报价单数据,
  type 正式报价单明细,
  type 正式报价单明细类型,
  生成正式报价单PDF,
  生成订单预审采购内容,
  type 订单预审报价单,
} from "@lianruan/shared";

/** 保留旧导出名，兼容现有 Worker 引用。 */
export { 生成正式报价单PDF as 生成订单预审报价单PDF } from "@lianruan/shared";
