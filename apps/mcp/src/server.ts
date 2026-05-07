import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadRuntimeConfig } from "./config";
import { createReadOnlyDb } from "./db";
import { createAphMcpServer } from "./mcpServer";

export const startStdioServer = async (): Promise<void> => {
  const config = loadRuntimeConfig("stdio");
  const db = createReadOnlyDb(config);
  const server = createAphMcpServer(config, db);
  const transport = new StdioServerTransport();

  try {
    await server.connect(transport);
  } catch (error) {
    await db.close().catch(() => undefined);
    throw error;
  }

  const shutdown = async () => {
    await Promise.allSettled([server.close(), db.close()]);
  };

  process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
};

if (require.main === module) {
  startStdioServer().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
