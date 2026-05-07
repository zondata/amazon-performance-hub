import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RuntimeConfig } from "./config";
import { MCP_INSTRUCTIONS, MCP_SERVER_INFO } from "./constants";
import type { ReadOnlyDb } from "./db";
import { buildToolRegistration } from "./tools";

export const createAphMcpServer = (config: RuntimeConfig, db: ReadOnlyDb): McpServer => {
  const server = new McpServer(MCP_SERVER_INFO, {
    capabilities: {
      tools: {},
    },
    instructions: MCP_INSTRUCTIONS,
  });

  for (const tool of buildToolRegistration({ config, db })) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: false,
        },
      },
      tool.handler as never,
    );
  }

  return server;
};
