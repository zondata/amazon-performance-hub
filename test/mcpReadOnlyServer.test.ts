import { describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "../apps/mcp/src/config";
import { createReadOnlyDb } from "../apps/mcp/src/db";
import { getReadOnlyToolNames } from "../apps/mcp/src/tools";

describe("APH read-only MCP server", () => {
  it("exposes only the approved read-only v1 tools", () => {
    expect(getReadOnlyToolNames()).toEqual([
      "get_mcp_guide",
      "get_data_coverage_status",
      "get_sales_summary",
      "get_sp_campaign_summary",
      "get_sp_target_summary",
      "get_h10_keyword_rankings",
    ]);
  });

  it("does not expose SQP or write tools", () => {
    const toolNames = getReadOnlyToolNames().join(" ");
    expect(toolNames).not.toContain("sqp");
    expect(toolNames).not.toContain("write");
    expect(toolNames).not.toContain("create");
    expect(toolNames).not.toContain("update");
    expect(toolNames).not.toContain("delete");
    expect(toolNames).not.toContain("insert");
  });

  it("requires MCP_DATABASE_URL for stdio mode", () => {
    expect(() =>
      loadRuntimeConfig("stdio", {
        MCP_ACCOUNT_ID: "sourbear",
        MCP_MARKETPLACE: "US",
      }),
    ).toThrow("MCP_DATABASE_URL is required");
  });

  it("requires MCP_REMOTE_BEARER_TOKEN for remote mode", () => {
    expect(() =>
      loadRuntimeConfig("http", {
        MCP_DATABASE_URL: "postgres://readonly:readonly@127.0.0.1:5432/aph",
        MCP_ACCOUNT_ID: "sourbear",
        MCP_MARKETPLACE: "US",
      }),
    ).toThrow("MCP_REMOTE_BEARER_TOKEN is required");
  });

  it("creates the database adapter lazily", async () => {
    const config = loadRuntimeConfig("stdio", {
      MCP_DATABASE_URL: "postgres://readonly:readonly@127.0.0.1:5432/aph",
      MCP_ACCOUNT_ID: "sourbear",
      MCP_MARKETPLACE: "US",
    });

    const db = createReadOnlyDb(config);
    await expect(db.close()).resolves.toBeUndefined();
  });
});
