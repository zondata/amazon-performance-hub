import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { PgQueryExecutor } from "./db.js";
import { resolveMcpConfig } from "./config.js";
import { createToolDefinitions } from "./tools.js";
import type { McpServerConfig, QueryExecutor } from "./types.js";

export function buildMcpServer(config: McpServerConfig, executor: QueryExecutor): McpServer {
  const server = new McpServer({
    name: "amazon-performance-hub-v3-read-only",
    version: "1.0.0",
  });

  for (const tool of createToolDefinitions(config, executor)) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: false,
        },
      },
      tool.handler,
    );
  }

  return server;
}

export async function startStdioServer(): Promise<void> {
  const config = resolveMcpConfig(process.env);
  const executor = new PgQueryExecutor(config.databaseUrl);
  const server = buildMcpServer(config, executor);
  const transport = new StdioServerTransport();

  process.on("SIGINT", async () => {
    await executor.close();
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await executor.close();
    await server.close();
    process.exit(0);
  });

  await server.connect(transport);
}
