export type McpPersonType = "internal" | "channel";

export interface McpPrincipal {
  userId: string;
  username: string;
  displayName: string;
  personType: McpPersonType;
  primaryOrganization: string;
  primaryPartner: string | null;
  permissionSummary: string[];
}
