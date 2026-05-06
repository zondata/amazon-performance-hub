import type { McpServerConfig } from "./types.js";

const REQUIRED_MESSAGE =
  "MCP_DATABASE_URL is required and should use a read-only database role.";

export function resolveMcpConfig(env: NodeJS.ProcessEnv = process.env): McpServerConfig {
  const databaseUrl = env.MCP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(REQUIRED_MESSAGE);
  }

  const accountId = env.MCP_ACCOUNT_ID?.trim() || env.APP_ACCOUNT_ID?.trim() || null;
  const marketplace = env.MCP_MARKETPLACE?.trim() || env.APP_MARKETPLACE?.trim() || null;

  return {
    databaseUrl,
    accountId,
    marketplace,
  };
}

export function getMissingDatabaseUrlMessage(): string {
  return REQUIRED_MESSAGE;
}
