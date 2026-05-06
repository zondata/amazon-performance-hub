import { describe, expect, it } from "vitest";

import { getMissingDatabaseUrlMessage, resolveMcpConfig } from "../apps/mcp/src/config";
import { buildGuide } from "../apps/mcp/src/guide";
import { buildMcpServer } from "../apps/mcp/src/server";
import {
  buildCoverageQuery,
  buildH10KeywordRankingsQuery,
  buildSalesSummaryQuery,
  buildSpCampaignSummaryQuery,
  buildSpTargetSummaryQuery,
  createToolDefinitions,
  EXCLUDED_SQP_SOURCE_TYPES,
  MCP_TOOL_NAMES,
} from "../apps/mcp/src/tools";
import type { McpServerConfig, QueryExecutor, QueryResultRow } from "../apps/mcp/src/types";
import { assertDateRangeWithinLimit, clampLimit, parseRequiredAsin } from "../apps/mcp/src/validation";

class FakeQueryExecutor implements QueryExecutor {
  public readonly calls: Array<{ text: string; values: readonly unknown[] }> = [];

  async query<T extends QueryResultRow>(text: string, values: readonly unknown[]): Promise<{ rows: T[] }> {
    this.calls.push({ text, values });
    return { rows: [] };
  }

  async close(): Promise<void> {
    return;
  }
}

const config: McpServerConfig = {
  databaseUrl: "postgres://readonly.example/db",
  accountId: "sourbear",
  marketplace: "US",
};

describe("read-only MCP v1", () => {
  it("server starts from the registered v1 tools", () => {
    const server = buildMcpServer(config, new FakeQueryExecutor());
    expect(server).toBeTruthy();
  });

  it("tool list contains only the intended v1 tools", () => {
    expect([...MCP_TOOL_NAMES]).toEqual([
      "get_mcp_guide",
      "get_data_coverage_status",
      "get_sales_summary",
      "get_sp_campaign_summary",
      "get_sp_target_summary",
      "get_h10_keyword_rankings",
    ]);
  });

  it("does not expose write tools", () => {
    for (const name of MCP_TOOL_NAMES) {
      expect(name.startsWith("set_")).toBe(false);
      expect(name.startsWith("update_")).toBe(false);
      expect(name.startsWith("create_")).toBe(false);
      expect(name.startsWith("delete_")).toBe(false);
      expect(name.startsWith("run_")).toBe(false);
    }
  });

  it("get_mcp_guide returns the v1 guide content", async () => {
    const tools = createToolDefinitions(config, new FakeQueryExecutor());
    const guideTool = tools.find((tool) => tool.name === "get_mcp_guide");
    expect(guideTool).toBeTruthy();
    const result = await guideTool!.handler({});
    expect(result.content[0].text).toContain("SQP is intentionally excluded from MCP v1");
    expect(result.content[0].text).toContain("No write tools exist");
  });

  it("guide builder includes account and marketplace context", () => {
    const guide = buildGuide(config);
    expect(guide).toContain("account_id: sourbear");
    expect(guide).toContain("marketplace: US");
  });

  it("missing MCP_DATABASE_URL produces a clear error", () => {
    expect(() => resolveMcpConfig({})).toThrow(getMissingDatabaseUrlMessage());
  });

  it("enforces the max row limit", () => {
    expect(clampLimit(999, 100, 500)).toBe(500);
  });

  it("rejects invalid dates", () => {
    expect(() =>
      buildSalesSummaryQuery(config, {
        start_date: "2026/01/01",
        end_date: "2026-01-31",
      }),
    ).toThrow("start_date must be YYYY-MM-DD.");
  });

  it("rejects date ranges above 90 days", () => {
    expect(() => assertDateRangeWithinLimit("2026-01-01", "2026-04-15")).toThrow(
      "Date range cannot exceed 90 days in MCP v1.",
    );
  });

  it("validates H10 ASIN input", () => {
    expect(() => parseRequiredAsin("BAD-ASIN")).toThrow("asin must be a valid 10-character Amazon ASIN.");
  });

  it("excludes SQP source rows from coverage status", () => {
    const query = buildCoverageQuery(config, {});
    expect(query.values[0]).toEqual(EXCLUDED_SQP_SOURCE_TYPES);
    expect(query.text).toContain("source_type <> ALL($1::text[])");
  });

  it("does not exclude null marketplace ads rows in SP campaign summary", () => {
    const query = buildSpCampaignSummaryQuery(config, {
      start_date: "2026-01-01",
      end_date: "2026-01-31",
    });
    expect(query.text).toContain("(marketplace = $6 or marketplace is null)");
    expect(query.text).toContain("account_id = $5");
  });

  it("does not exclude null marketplace ads rows in SP target summary", () => {
    const query = buildSpTargetSummaryQuery(config, {
      start_date: "2026-01-01",
      end_date: "2026-01-31",
    });
    expect(query.text).toContain("(marketplace = $6 or marketplace is null)");
    expect(query.text).toContain("account_id = $5");
  });

  it("keeps strict marketplace filtering for sales, H10, and coverage", () => {
    const salesQuery = buildSalesSummaryQuery(config, {
      start_date: "2026-01-01",
      end_date: "2026-01-31",
    });
    expect(salesQuery.text).toContain("marketplace = $4");

    const h10Query = buildH10KeywordRankingsQuery(
      config,
      {
        asin: "B0B2K57W5R",
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      },
      new Date("2026-05-06T00:00:00Z"),
    );
    expect(h10Query.text).toContain("marketplace = $5");

    const coverageQuery = buildCoverageQuery(config, {});
    expect(coverageQuery.text).toContain("marketplace = $3");
  });

  it("uses parameterized queries instead of concatenating user SQL", () => {
    const malicious = "B0B2K57W5R' or 1=1 --";
    const query = buildH10KeywordRankingsQuery(
      config,
      {
        asin: "B0B2K57W5R",
        keywords: [malicious],
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      },
      new Date("2026-05-06T00:00:00Z"),
    );
    expect(query.text).not.toContain(malicious);
    expect(JSON.stringify(query.values)).toContain(malicious.toLowerCase());
  });
});
