import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "../apps/mcp/src/config";
import { startHttpServer, type StartedHttpServer } from "../apps/mcp/src/httpServer";

const TOKEN = "test-remote-bearer-token";

describe("APH remote MCP HTTP server", () => {
  let startedServer: StartedHttpServer | null = null;

  afterEach(async () => {
    if (startedServer) {
      await startedServer.close();
      startedServer = null;
    }
  });

  const boot = async (logs: string[]): Promise<{ url: string }> => {
    const config = loadRuntimeConfig("http", {
      MCP_DATABASE_URL: "postgres://readonly:readonly@127.0.0.1:5432/aph",
      MCP_ACCOUNT_ID: "sourbear",
      MCP_MARKETPLACE: "US",
      MCP_REMOTE_BEARER_TOKEN: TOKEN,
      MCP_HTTP_HOST: "127.0.0.1",
      MCP_HTTP_PORT: "0",
    });

    startedServer = await startHttpServer(config, {
      info: (message) => logs.push(`info:${message}`),
      warn: (message) => logs.push(`warn:${message}`),
      error: (message) => logs.push(`error:${message}`),
    });

    return {
      url: `http://127.0.0.1:${startedServer.port}${config.httpPath}`,
    };
  };

  it("rejects requests with a missing token", async () => {
    const logs: string[] = [];
    const { url } = await boot(logs);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(logs.join("\n")).not.toContain(TOKEN);
  });

  it("rejects requests with a wrong token", async () => {
    const logs: string[] = [];
    const { url } = await boot(logs);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: "Bearer wrong-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(logs.join("\n")).not.toContain("wrong-token");
    expect(logs.join("\n")).not.toContain(TOKEN);
  });

  it("accepts the correct token and exposes only the read-only v1 tools", async () => {
    const logs: string[] = [];
    const { url } = await boot(logs);

    const client = new Client({
      name: "mcp-http-test-client",
      version: "1.0.0",
    });
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: {
        headers: {
          authorization: `Bearer ${TOKEN}`,
        },
      },
    });

    await client.connect(transport);
    const result = await client.listTools();

    expect(result.tools.map((tool) => tool.name).sort()).toEqual([
      "get_data_coverage_status",
      "get_h10_keyword_rankings",
      "get_mcp_guide",
      "get_sales_summary",
      "get_sp_campaign_summary",
      "get_sp_target_summary",
    ]);

    const toolNames = result.tools.map((tool) => tool.name).join(" ");
    expect(toolNames).not.toContain("sqp");
    expect(toolNames).not.toContain("write");
    expect(logs.join("\n")).not.toContain(TOKEN);

    await transport.terminateSession();
    await client.close();
  });
});
