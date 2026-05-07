export type ServerMode = "stdio" | "http";

export type RuntimeConfig = {
  databaseUrl: string;
  accountId: string;
  marketplace: string;
  httpHost: string;
  httpPort: number;
  httpPath: string;
  publicBaseUrl: string | null;
  oauthIssuer: string | null;
  oauthApprovalToken: string | null;
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

const normalizeUrl = (raw: string, name: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error(`${name} must use http or https`);
  }

  if (parsed.search || parsed.hash) {
    throw new Error(`${name} must not include query or fragment components`);
  }

  if (!parsed.pathname || parsed.pathname === "/") {
    parsed.pathname = "/";
  }

  return parsed.toString().replace(/\/$/, "");
};

export const loadRuntimeConfig = (
  mode: ServerMode,
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig => {
  const databaseUrl = requireEnv(env, "MCP_DATABASE_URL");
  const accountId = requireEnv(env, "MCP_ACCOUNT_ID");
  const marketplace = requireEnv(env, "MCP_MARKETPLACE");
  const publicBaseUrl =
    mode === "http"
      ? normalizeUrl(requireEnv(env, "MCP_PUBLIC_BASE_URL"), "MCP_PUBLIC_BASE_URL")
      : null;
  const oauthIssuer =
    mode === "http"
      ? normalizeUrl(env.MCP_OAUTH_ISSUER?.trim() || publicBaseUrl!, "MCP_OAUTH_ISSUER")
      : null;
  const oauthApprovalToken =
    mode === "http" ? requireEnv(env, "MCP_OAUTH_APPROVAL_TOKEN") : null;

  return {
    databaseUrl,
    accountId,
    marketplace,
    httpHost: env.MCP_HTTP_HOST?.trim() || "0.0.0.0",
    httpPort: parsePort(env.MCP_HTTP_PORT ?? env.PORT),
    httpPath: normalizeHttpPath(env.MCP_HTTP_PATH),
    publicBaseUrl,
    oauthIssuer,
    oauthApprovalToken,
  };
};
