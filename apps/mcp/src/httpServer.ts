import { randomUUID, timingSafeEqual } from "node:crypto";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadRuntimeConfig, type RuntimeConfig } from "./config";
import { REQUEST_BODY_LIMIT_BYTES } from "./constants";
import { createReadOnlyDb } from "./db";
import { defaultLogger, type Logger } from "./logging";
import { createAphMcpServer } from "./mcpServer";

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
  res: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
): void => {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("content-length", Buffer.byteLength(body));
  res.end(body);
};

const readBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > REQUEST_BODY_LIMIT_BYTES) {
      throw new Error("Request body too large");
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const constantTimeBearerMatch = (provided: string, expected: string): boolean => {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
};

const isAuthorized = (req: IncomingMessage, expectedToken: string): boolean => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return false;
  }
  const provided = header.slice("Bearer ".length);
  return constantTimeBearerMatch(provided, expectedToken);
};

const isInitializeRequest = (body: unknown): boolean => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }

  const maybeMethod = (body as { method?: unknown }).method;
  return maybeMethod === "initialize";
};

export const startHttpServer = async (
  config: RuntimeConfig,
  logger: Logger = defaultLogger,
): Promise<StartedHttpServer> => {
  const sessions = new Map<string, SessionEntry>();

  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      if (requestUrl.pathname !== config.httpPath) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }

      if (!isAuthorized(req, config.remoteBearerToken ?? "")) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }

      if (req.method === "POST") {
        const parsedBody = await readBody(req);
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
          await existing.transport.handleRequest(req, res, parsedBody);
          return;
        }

        if (!isInitializeRequest(parsedBody)) {
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
        await transport.handleRequest(req, res, parsedBody);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message === "Request body too large" ? 413 : 500;
      sendJson(res, statusCode, {
        error: statusCode === 413 ? "Request body too large" : "Internal server error",
      });
      logger.error(
        `[aph-mcp] request failed with ${statusCode === 413 ? "payload_too_large" : "internal_error"}`,
      );
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.httpPort, config.httpHost, () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to determine MCP HTTP listen address");
  }

  logger.info(
    `[aph-mcp] remote MCP listening on http://${config.httpHost}:${address.port}${config.httpPath}`,
  );

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
