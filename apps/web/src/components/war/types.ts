export interface 指标项 {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  /** 可选跳转地址；未配置时指标卡保持只读。 */
  path?: string;
}

export interface 记录标签 {
  text: string;
  hot?: boolean;
}
