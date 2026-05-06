import * as z from "zod/v4";

import { buildGuide } from "./guide.js";
import type {
  CoverageStatusRow,
  H10KeywordRankingRow,
  McpServerConfig,
  QueryExecutor,
  SalesSummaryRow,
  SpCampaignSummaryRow,
  SpTargetSummaryRow,
} from "./types.js";
import {
  assertDateRangeWithinLimit,
  clampLimit,
  defaultLast30DaysRange,
  parseKeywordArray,
  parseOptionalDate,
  parseOptionalString,
  parseRequiredAsin,
  parseRequiredDate,
} from "./validation.js";

export const MCP_TOOL_NAMES = [
  "get_mcp_guide",
  "get_data_coverage_status",
  "get_sales_summary",
  "get_sp_campaign_summary",
  "get_sp_target_summary",
  "get_h10_keyword_rankings",
] as const;

export const EXCLUDED_SQP_SOURCE_TYPES = ["sp_api_sqp_weekly", "sp_api_sqp_monthly"] as const;

type ToolName = (typeof MCP_TOOL_NAMES)[number];

type SqlQuery = {
  text: string;
  values: readonly unknown[];
};

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
};

type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

type ToolDefinition = {
  name: ToolName;
  title: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  handler: ToolHandler;
};

function addContextFilters(
  clauses: string[],
  values: unknown[],
  config: Pick<McpServerConfig, "accountId" | "marketplace">,
): void {
  if (config.accountId) {
    values.push(config.accountId);
    clauses.push(`account_id = $${values.length}`);
  }
  if (config.marketplace) {
    values.push(config.marketplace);
    clauses.push(`marketplace = $${values.length}`);
  }
}

function addAdsContextFilters(
  clauses: string[],
  values: unknown[],
  config: Pick<McpServerConfig, "accountId" | "marketplace">,
): void {
  if (config.accountId) {
    values.push(config.accountId);
    clauses.push(`account_id = $${values.length}`);
  }
  if (config.marketplace) {
    values.push(config.marketplace);
    clauses.push(`(marketplace = $${values.length} or marketplace is null)`);
  }
}

function toJsonResult(payload: Record<string, unknown>): ToolResult {
  return {
    structuredContent: payload,
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

export function buildCoverageQuery(
  config: Pick<McpServerConfig, "accountId" | "marketplace">,
  input: { source_type?: unknown; limit?: unknown },
): SqlQuery {
  const limit = clampLimit(input.limit, 50, 100);
  const sourceType = parseOptionalString(input.source_type, "source_type");

  const values: unknown[] = [EXCLUDED_SQP_SOURCE_TYPES];
  const clauses = ["source_type <> ALL($1::text[])"];
  addContextFilters(clauses, values, config);
  if (sourceType) {
    values.push(sourceType);
    clauses.push(`source_type = $${values.length}`);
  }
  values.push(limit);

  return {
    text: `
      select
        source_type,
        table_name,
        granularity,
        oldest_period_start,
        latest_period_end,
        latest_complete_period_end,
        last_status,
        freshness_status,
        row_count,
        notes,
        last_successful_run_at
      from public.v_mcp_data_coverage_status
      where ${clauses.join(" and ")}
      order by last_successful_run_at desc nulls last, source_type asc, table_name asc
      limit $${values.length}
    `,
    values,
  };
}

export function buildSalesSummaryQuery(
  config: Pick<McpServerConfig, "accountId" | "marketplace">,
  input: { start_date?: unknown; end_date?: unknown; asin?: unknown; limit?: unknown },
): SqlQuery {
  const startDate = parseRequiredDate(input.start_date, "start_date");
  const endDate = parseRequiredDate(input.end_date, "end_date");
  assertDateRangeWithinLimit(startDate, endDate);
  const asin = parseOptionalString(input.asin, "asin");
  const limit = clampLimit(input.limit, 100, 500);

  const values: unknown[] = [startDate, endDate];
  const clauses = ["date >= $1", "date <= $2"];
  addContextFilters(clauses, values, config);
  if (asin) {
    values.push(asin.toUpperCase());
    clauses.push(`upper(asin) = $${values.length}`);
  }
  values.push(limit);

  return {
    text: `
      select
        date,
        asin,
        child_asin,
        ordered_product_sales,
        units_ordered,
        total_order_items,
        sessions,
        page_views,
        buy_box_percentage
      from public.v_mcp_sales_traffic_daily
      where ${clauses.join(" and ")}
      order by date desc, asin asc nulls last
      limit $${values.length}
    `,
    values,
  };
}

export function buildSpCampaignSummaryQuery(
  config: Pick<McpServerConfig, "accountId" | "marketplace">,
  input: { start_date?: unknown; end_date?: unknown; campaign_id?: unknown; limit?: unknown },
): SqlQuery {
  const startDate = parseRequiredDate(input.start_date, "start_date");
  const endDate = parseRequiredDate(input.end_date, "end_date");
  assertDateRangeWithinLimit(startDate, endDate);
  const campaignId = parseOptionalString(input.campaign_id, "campaign_id");
  const limit = clampLimit(input.limit, 100, 500);

  const values: unknown[] = [startDate, endDate, "sp", "campaign"];
  const clauses = ["date >= $1", "date <= $2", "channel = $3", "performance_level = $4"];
  addAdsContextFilters(clauses, values, config);
  if (campaignId) {
    values.push(campaignId);
    clauses.push(`campaign_id = $${values.length}`);
  }
  values.push(limit);

  return {
    text: `
      select
        date,
        campaign_id,
        entity_name as campaign_name,
        impressions,
        clicks,
        spend,
        sales,
        orders,
        units,
        acos,
        roas,
        cpc,
        ctr
      from public.v_mcp_ads_performance_daily
      where ${clauses.join(" and ")}
      order by date desc, campaign_id asc nulls last
      limit $${values.length}
    `,
    values,
  };
}

export function buildSpTargetSummaryQuery(
  config: Pick<McpServerConfig, "accountId" | "marketplace">,
  input: {
    start_date?: unknown;
    end_date?: unknown;
    campaign_id?: unknown;
    ad_group_id?: unknown;
    target_id?: unknown;
    limit?: unknown;
  },
): SqlQuery {
  const startDate = parseRequiredDate(input.start_date, "start_date");
  const endDate = parseRequiredDate(input.end_date, "end_date");
  assertDateRangeWithinLimit(startDate, endDate);
  const campaignId = parseOptionalString(input.campaign_id, "campaign_id");
  const adGroupId = parseOptionalString(input.ad_group_id, "ad_group_id");
  const targetId = parseOptionalString(input.target_id, "target_id");
  const limit = clampLimit(input.limit, 100, 500);

  const values: unknown[] = [startDate, endDate, "sp", "target"];
  const clauses = ["date >= $1", "date <= $2", "channel = $3", "performance_level = $4"];
  addAdsContextFilters(clauses, values, config);
  if (campaignId) {
    values.push(campaignId);
    clauses.push(`campaign_id = $${values.length}`);
  }
  if (adGroupId) {
    values.push(adGroupId);
    clauses.push(`ad_group_id = $${values.length}`);
  }
  if (targetId) {
    values.push(targetId);
    clauses.push(`target_id = $${values.length}`);
  }
  values.push(limit);

  return {
    text: `
      select
        date,
        campaign_id,
        ad_group_id,
        target_id,
        targeting_raw as targeting_text,
        match_type_norm as match_type,
        impressions,
        clicks,
        spend,
        sales,
        orders,
        units,
        acos,
        roas,
        cpc,
        ctr
      from public.v_mcp_ads_performance_daily
      where ${clauses.join(" and ")}
      order by date desc, campaign_id asc nulls last, ad_group_id asc nulls last, target_id asc nulls last
      limit $${values.length}
    `,
    values,
  };
}

export function buildH10KeywordRankingsQuery(
  config: Pick<McpServerConfig, "accountId" | "marketplace">,
  input: {
    asin?: unknown;
    start_date?: unknown;
    end_date?: unknown;
    keywords?: unknown;
    limit?: unknown;
  },
  now = new Date(),
): SqlQuery {
  const asin = parseRequiredAsin(input.asin);
  const parsedStartDate = parseOptionalDate(input.start_date, "start_date");
  const parsedEndDate = parseOptionalDate(input.end_date, "end_date");
  const defaultRange = parsedStartDate && parsedEndDate ? null : defaultLast30DaysRange(now);
  const startDate = parsedStartDate ?? defaultRange?.startDate ?? null;
  const endDate = parsedEndDate ?? defaultRange?.endDate ?? null;
  if (!startDate || !endDate) {
    throw new Error("start_date and end_date must both be provided when overriding the default range.");
  }
  assertDateRangeWithinLimit(startDate, endDate);
  const keywords = parseKeywordArray(input.keywords);
  const limit = clampLimit(input.limit, 100, 500);

  const values: unknown[] = [asin, startDate, endDate];
  const clauses = ["asin = $1", "observed_date >= $2", "observed_date <= $3"];
  addContextFilters(clauses, values, config);
  if (keywords) {
    values.push(keywords);
    const placeholder = `$${values.length}`;
    clauses.push(
      `(lower(coalesce(keyword_norm, keyword_raw, '')) = any(${placeholder}::text[]) or lower(coalesce(keyword_raw, keyword_norm, '')) = any(${placeholder}::text[]))`,
    );
  }
  values.push(limit);

  return {
    text: `
      select
        asin,
        observed_date,
        keyword_raw,
        keyword_norm,
        organic_rank_raw,
        organic_rank_value,
        organic_rank_kind,
        sponsored_pos_raw,
        sponsored_pos_value,
        sponsored_pos_kind,
        search_volume,
        keyword_sales
      from public.v_mcp_h10_keyword_rankings
      where ${clauses.join(" and ")}
      order by observed_date desc, keyword_norm asc nulls last, keyword_raw asc nulls last
      limit $${values.length}
    `,
    values,
  };
}

async function runQuery<T extends CoverageStatusRow | SalesSummaryRow | SpCampaignSummaryRow | SpTargetSummaryRow | H10KeywordRankingRow>(
  executor: QueryExecutor,
  query: SqlQuery,
): Promise<T[]> {
  const result = await executor.query<T>(query.text, query.values);
  return result.rows;
}

export function createToolDefinitions(config: McpServerConfig, executor: QueryExecutor): ToolDefinition[] {
  return [
    {
      name: "get_mcp_guide",
      title: "Amazon Performance Hub MCP Guide",
      description: "Returns the read-only MCP v1 guide and operating rules.",
      inputSchema: {},
      handler: async () =>
        toJsonResult({
          guide_markdown: buildGuide(config),
        }),
    },
    {
      name: "get_data_coverage_status",
      title: "Data Coverage Status",
      description: "Returns stable data coverage and freshness rows, excluding SQP in MCP v1.",
      inputSchema: {
        source_type: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
      handler: async (args) => {
        const rows = await runQuery<CoverageStatusRow>(executor, buildCoverageQuery(config, args));
        return toJsonResult({
          excluded_source_types: [...EXCLUDED_SQP_SOURCE_TYPES],
          rows,
        });
      },
    },
    {
      name: "get_sales_summary",
      title: "Sales Summary",
      description: "Returns sales and traffic rows by date and ASIN for up to 90 days.",
      inputSchema: {
        start_date: z.string(),
        end_date: z.string(),
        asin: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
      handler: async (args) => {
        const rows = await runQuery<SalesSummaryRow>(executor, buildSalesSummaryQuery(config, args));
        return toJsonResult({ rows });
      },
    },
    {
      name: "get_sp_campaign_summary",
      title: "SP Campaign Summary",
      description: "Returns Sponsored Products campaign-level performance rows for up to 90 days.",
      inputSchema: {
        start_date: z.string(),
        end_date: z.string(),
        campaign_id: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
      handler: async (args) => {
        const rows = await runQuery<SpCampaignSummaryRow>(executor, buildSpCampaignSummaryQuery(config, args));
        return toJsonResult({ rows });
      },
    },
    {
      name: "get_sp_target_summary",
      title: "SP Target Summary",
      description: "Returns Sponsored Products target-level performance rows for up to 90 days.",
      inputSchema: {
        start_date: z.string(),
        end_date: z.string(),
        campaign_id: z.string().optional(),
        ad_group_id: z.string().optional(),
        target_id: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
      handler: async (args) => {
        const rows = await runQuery<SpTargetSummaryRow>(executor, buildSpTargetSummaryQuery(config, args));
        return toJsonResult({ rows });
      },
    },
    {
      name: "get_h10_keyword_rankings",
      title: "H10 Keyword Rankings",
      description: "Returns Helium 10 keyword ranking rows for an ASIN, defaulting to the latest 30 days.",
      inputSchema: {
        asin: z.string(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        limit: z.number().int().positive().optional(),
      },
      handler: async (args) => {
        const rows = await runQuery<H10KeywordRankingRow>(executor, buildH10KeywordRankingsQuery(config, args));
        return toJsonResult({ rows });
      },
    },
  ];
}
