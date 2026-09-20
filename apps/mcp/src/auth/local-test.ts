import type { McpConfig } from "../config.js";
import type { McpPrincipal } from "./principal.js";

export const LOCAL_TEST_PRINCIPALS = {
  "internal-demo": {
    userId: "00000000-0000-4000-8000-000000000101",
    username: "internal-demo",
    displayName: "内部测试用户",
    personType: "internal",
    primaryOrganization: "测试总部",
    primaryPartner: null,
    permissionSummary: ["本人范围", "内部人员"],
  },
  "channel-demo": {
    userId: "00000000-0000-4000-8000-000000000102",
    username: "channel-demo",
    displayName: "渠道测试用户",
    personType: "channel",
    primaryOrganization: "测试区域",
    primaryPartner: "渠道甲",
    permissionSummary: ["本渠道范围", "渠道人员"],
  },
} as const satisfies Record<string, McpPrincipal>;

export function resolveLocalTestPrincipal(config: McpConfig): McpPrincipal | null {
  if (!config.localTestMode || !config.localTestUser) return null;
  const base = LOCAL_TEST_PRINCIPALS[config.localTestUser];
  if (!config.realToolsEnabled) return base;
  if (!config.localTestUserId || !config.localTestUsername) return null;
  return {
    ...base,
    userId: config.localTestUserId,
    username: config.localTestUsername,
    displayName: config.localTestUsername,
  };
}
