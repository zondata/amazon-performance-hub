export type ServerMode = "stdio" | "http";

export type RuntimeConfig = {
  databaseUrl: string;
  accountId: string;
  marketplace: string;
  remoteBearerToken: string | null;
  httpHost: string;
  httpPort: number;
  httpPath: string;
};

const requireEnv = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const parsePort = (raw: string | undefined): number => {
  if (!raw) return 8080;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 65535) {
    throw new Error("MCP_HTTP_PORT must be an integer between 0 and 65535");
  }
  return value;
};

const normalizeHttpPath = (raw: string | undefined): string => {
  const value = raw?.trim() || "/mcp";
  return value.startsWith("/") ? value : `/${value}`;
};

export const loadRuntimeConfig = (
  mode: ServerMode,
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig => {
  const databaseUrl = requireEnv(env, "MCP_DATABASE_URL");
  const accountId = requireEnv(env, "MCP_ACCOUNT_ID");
  const marketplace = requireEnv(env, "MCP_MARKETPLACE");
  const remoteBearerToken =
    mode === "http" ? requireEnv(env, "MCP_REMOTE_BEARER_TOKEN") : null;

  return {
    databaseUrl,
    accountId,
    marketplace,
    remoteBearerToken,
    httpHost: env.MCP_HTTP_HOST?.trim() || "0.0.0.0",
    httpPort: parsePort(env.MCP_HTTP_PORT ?? env.PORT),
    httpPath: normalizeHttpPath(env.MCP_HTTP_PATH),
  };
};
