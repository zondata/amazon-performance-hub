import { randomUUID } from "node:crypto";
import type http from "node:http";
import express, { type Request, type Response } from "express";
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadRuntimeConfig, type RuntimeConfig } from "./config";
import { REQUEST_BODY_LIMIT_BYTES } from "./constants";
import { createReadOnlyDb } from "./db";
import { defaultLogger, type Logger } from "./logging";
import { createAphMcpServer } from "./mcpServer";
import { ApprovalOAuthProvider, DynamicClientStore } from "./oauthProvider";

type SessionEntry = {
  transport: StreamableHTTPServerTransport;
  close: () => Promise<void>;
};

export type StartedHttpServer = {
  server: http.Server;
  port: number;
  close: () => Promise<void>;
};

const sendJson = (
  res: Response,
  statusCode: number,
  payload: Record<string, unknown>,
): void => {
  res.status(statusCode).json(payload);
};

const isInitializeRequest = (body: unknown): boolean => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }

  return (body as { method?: unknown }).method === "initialize";
};

const resolveRuntimeBaseUrl = (configuredBaseUrl: string, actualPort: number): URL => {
  const url = new URL(configuredBaseUrl);
  if (url.port === "0") {
    url.port = String(actualPort);
  }
  return url;
};

export const startHttpServer = async (
  config: RuntimeConfig,
  logger: Logger = defaultLogger,
): Promise<StartedHttpServer> => {
  const sessions = new Map<string, SessionEntry>();
  const app = express();

  app.disable("x-powered-by");
  app.use(
    express.json({
      limit: REQUEST_BODY_LIMIT_BYTES,
    }),
  );
  app.use(
    express.urlencoded({
      extended: false,
      limit: REQUEST_BODY_LIMIT_BYTES,
    }),
  );

  const server = await new Promise<http.Server>((resolve, reject) => {
    const listeningServer = app.listen(config.httpPort, config.httpHost, () =>
      resolve(listeningServer),
    );
    listeningServer.once("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to determine MCP HTTP listen address");
  }

  const runtimeBaseUrl = resolveRuntimeBaseUrl(config.publicBaseUrl!, address.port);
  const oauthIssuerUrl = new URL(config.oauthIssuer!);
  if (oauthIssuerUrl.port === "0") {
    oauthIssuerUrl.port = String(address.port);
  }
  const mcpServerUrl = new URL(config.httpPath, runtimeBaseUrl);

  const clientsStore = new DynamicClientStore();
  const authProvider = new ApprovalOAuthProvider({
    clientsStore,
    approvalToken: config.oauthApprovalToken!,
    resourceServerUrl: mcpServerUrl,
  });

  app.use(
    mcpAuthRouter({
      provider: authProvider,
      issuerUrl: oauthIssuerUrl,
      baseUrl: runtimeBaseUrl,
      resourceServerUrl: mcpServerUrl,
      scopesSupported: ["mcp:tools"],
      resourceName: "Amazon Performance Hub Read-Only MCP",
    }),
  );

  const authMiddleware = requireBearerAuth({
    verifier: authProvider,
    requiredScopes: [],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
  });

  const handleMcpRequest = async (req: Request, res: Response): Promise<void> => {
    if (req.method === "POST") {
      const sessionIdHeader = req.headers["mcp-session-id"];
      const sessionId =
        typeof sessionIdHeader === "string" && sessionIdHeader.trim()
          ? sessionIdHeader
          : undefined;

      if (sessionId) {
        const existing = sessions.get(sessionId);
        if (!existing) {
          sendJson(res, 404, { error: "Unknown MCP session" });
          return;
        }
        await existing.transport.handleRequest(req, res, req.body);
        return;
      }

      if (!isInitializeRequest(req.body)) {
        sendJson(res, 400, { error: "Missing MCP session id" });
        return;
      }

      const db = createReadOnlyDb(config);
      const mcpServer = createAphMcpServer(config, db);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          sessions.set(newSessionId, {
            transport,
            close: async () => {
              await Promise.allSettled([mcpServer.close(), db.close(), transport.close()]);
            },
          });
        },
        onsessionclosed: (closedSessionId) => {
          sessions.delete(closedSessionId);
        },
      });

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    if (req.method === "GET" || req.method === "DELETE") {
      const sessionIdHeader = req.headers["mcp-session-id"];
      const sessionId =
        typeof sessionIdHeader === "string" && sessionIdHeader.trim()
          ? sessionIdHeader
          : undefined;

      if (!sessionId) {
        sendJson(res, 400, { error: "Missing MCP session id" });
        return;
      }

      const existing = sessions.get(sessionId);
      if (!existing) {
        sendJson(res, 404, { error: "Unknown MCP session" });
        return;
      }

      await existing.transport.handleRequest(req, res);
      if (req.method === "DELETE") {
        await existing.close();
        sessions.delete(sessionId);
      }
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  };

  app.all(config.httpPath, authMiddleware, async (req: Request, res: Response) => {
    try {
      await handleMcpRequest(req, res);
    } catch {
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal server error" });
      }
      logger.error("[aph-mcp] request failed with internal_error");
    }
  });

  logger.info(`[aph-mcp] remote MCP listening on ${mcpServerUrl.toString()}`);

  return {
    server,
    port: address.port,
    close: async () => {
      for (const entry of sessions.values()) {
        await entry.close();
      }
      sessions.clear();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
};

if (require.main === module) {
  const config = loadRuntimeConfig("http");
  startHttpServer(config).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
