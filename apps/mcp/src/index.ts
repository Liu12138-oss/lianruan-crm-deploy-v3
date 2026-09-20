export { LOCAL_TEST_PRINCIPALS, resolveLocalTestPrincipal } from "./auth/local-test.js";
export type { McpPrincipal } from "./auth/principal.js";
export { MCP_PROTOCOL_VERSION, McpConfigError, readMcpConfig } from "./config.js";
export { createMcpServer, resolveMcpPrincipal } from "./server-factory.js";
