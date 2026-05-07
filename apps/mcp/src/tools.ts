import * as z from "zod/v4";
import {
  MAX_CAMPAIGN_ROWS,
  MAX_DATA_COVERAGE_ROWS,
  MAX_H10_ROWS,
  MAX_SALES_DAILY_ROWS,
  MAX_TARGET_ROWS,
  READ_ONLY_TOOL_NAMES,
} from "./constants";
import type { RuntimeConfig } from "./config";
import type { ReadOnlyDb } from "./db";
import { validateDateRange, validateLimit, validateOptionalIdentifier } from "./validation";

type ToolContext = {
  config: RuntimeConfig;
  db: ReadOnlyDb;
};

export type RegisteredReadOnlyTool = {
  name: string;
  description: string;
  inputSchema?: z.ZodRawShape | undefined;
  handler: (args: Record<string, unknown>) => Promise<ContentResult>;
};

type ContentResult = {
  content: Array<{
    type: "text";
    text: string;
  }>;
  structuredContent: Record<string, unknown>;
};

const jsonResult = (payload: Record<string, unknown>): ContentResult => ({
  content: [
    {
      type: "text",
      text: JSON.stringify(payload, null, 2),
    },
  ],
  structuredContent: payload,
});

export const getReadOnlyToolNames = (): string[] => [...READ_ONLY_TOOL_NAMES];

export const buildToolRegistration = (context: ToolContext): RegisteredReadOnlyTool[] => {
  const accountId = context.config.accountId;
  const marketplace = context.config.marketplace;

  return [
    {
      name: "get_mcp_guide",
      description: "Explains the read-only APH MCP scope, constraints, and supported tools.",
      inputSchema: undefined,
      handler: async (): Promise<ContentResult> =>
        jsonResult({
          server_mode: {
            local_stdio: "Use the stdio entrypoint for local process-spawned MCP clients.",
            remote_http:
              "Use the remote HTTP entrypoint for hosted MCP clients such as Claude custom connectors.",
          },
          scoping: {
            account_id: accountId,
            marketplace,
          },
          supported_tools: getReadOnlyToolNames(),
          exclusions: [
            "No write tools",
            "No SQP tools in MCP v1",
            "No arbitrary SQL",
            "No service-role access",
          ],
          remote_auth:
            "Remote HTTP mode uses MCP-spec OAuth. Claude custom connector users add the /mcp URL, then complete the OAuth connect flow.",
          oauth_note:
            "Dynamic client registration is enabled for the remote OAuth flow. OAuth Client ID and OAuth Client Secret can be left blank in Claude's custom connector UI unless your deployment intentionally switches to pre-provisioned clients.",
        }),
    },
    {
      name: "get_data_coverage_status",
      description: "Returns scoped data freshness and coverage rows for the configured account and marketplace.",
      inputSchema: {
        source_type: z.string().optional(),
        table_name: z.string().optional(),
        limit: z.number().int().optional(),
      },
      handler: async (args: Record<string, unknown>): Promise<ContentResult> => {
        const typedArgs = args as {
          source_type?: string;
          table_name?: string;
          limit?: number;
        };
        const sourceType = validateOptionalIdentifier(typedArgs.source_type, "source_type");
        const tableName = validateOptionalIdentifier(typedArgs.table_name, "table_name");
        const limit = validateLimit(typedArgs.limit, MAX_DATA_COVERAGE_ROWS);

        const rows = await context.db.queryRows(
          `
            select
              source_type,
              table_name,
              source_name,
              scope_key,
              data_status,
              is_final,
              period_start,
              period_end,
              last_refreshed_at,
              row_count,
              latest_sync_status,
              latest_sync_finished_at,
              latest_error_code,
              latest_error_message,
              coverage_json,
              warnings
            from public.v_mcp_data_freshness
            where account_id = $1
              and marketplace = $2
              and ($3::text is null or source_type = $3)
              and ($4::text is null or table_name = $4)
            order by coalesce(last_refreshed_at, latest_sync_finished_at) desc nulls last, table_name asc
            limit $5
          `,
          [accountId, marketplace, sourceType, tableName, limit],
        );

        return jsonResult({
          account_id: accountId,
          marketplace,
          row_limit: MAX_DATA_COVERAGE_ROWS,
          returned_rows: rows.length,
          rows,
        });
      },
    },
    {
      name: "get_sales_summary",
      description: "Returns scoped sales totals plus daily rows for a bounded date range, with optional ASIN filter.",
      inputSchema: {
        start_date: z.string(),
        end_date: z.string(),
        asin: z.string().optional(),
        limit: z.number().int().optional(),
      },
      handler: async (args: Record<string, unknown>): Promise<ContentResult> => {
        const typedArgs = args as {
          start_date: string;
          end_date: string;
          asin?: string;
          limit?: number;
        };
        const { startDate, endDate } = validateDateRange(
          typedArgs.start_date,
          typedArgs.end_date,
        );
        const asin = validateOptionalIdentifier(typedArgs.asin, "asin");
        const limit = validateLimit(typedArgs.limit, MAX_SALES_DAILY_ROWS);

        const [summary] = await context.db.queryRows(
          `
            select
              min(date)::text as date_start,
              max(date)::text as date_end,
              coalesce(sum(ordered_product_sales), 0)::double precision as ordered_product_sales,
              coalesce(sum(total_order_items), 0)::integer as total_order_items,
              coalesce(sum(units_ordered), 0)::integer as units_ordered,
              coalesce(sum(sessions), 0)::integer as sessions,
              coalesce(sum(page_views), 0)::integer as page_views,
              bool_and(coalesce(is_final, false)) as all_rows_final,
              max(exported_at) as latest_exported_at,
              count(*)::integer as row_count
            from public.v_mcp_sales_traffic_daily
            where account_id = $1
              and marketplace = $2
              and date between $3::date and $4::date
              and ($5::text is null or asin = $5)
          `,
          [accountId, marketplace, startDate, endDate, asin],
        );

        const rows = await context.db.queryRows(
          `
            select
              date::text as date,
              asin,
              ordered_product_sales::double precision as ordered_product_sales,
              total_order_items::integer as total_order_items,
              units_ordered::integer as units_ordered,
              sessions::integer as sessions,
              page_views::integer as page_views,
              data_status,
              is_final,
              exported_at
            from public.v_mcp_sales_traffic_daily
            where account_id = $1
              and marketplace = $2
              and date between $3::date and $4::date
              and ($5::text is null or asin = $5)
            order by date asc, asin asc nulls last
            limit $6
          `,
          [accountId, marketplace, startDate, endDate, asin, limit],
        );

        return jsonResult({
          account_id: accountId,
          marketplace,
          filters: {
            start_date: startDate,
            end_date: endDate,
            asin,
          },
          row_limit: MAX_SALES_DAILY_ROWS,
          summary: summary ?? null,
          daily_rows: rows,
        });
      },
    },
    {
      name: "get_sp_campaign_summary",
      description: "Returns bounded Sponsored Products campaign performance grouped by campaign.",
      inputSchema: {
        start_date: z.string(),
        end_date: z.string(),
        campaign_id: z.string().optional(),
        limit: z.number().int().optional(),
      },
      handler: async (args: Record<string, unknown>): Promise<ContentResult> => {
        const typedArgs = args as {
          start_date: string;
          end_date: string;
          campaign_id?: string;
          limit?: number;
        };
        const { startDate, endDate } = validateDateRange(
          typedArgs.start_date,
          typedArgs.end_date,
        );
        const campaignId = validateOptionalIdentifier(
          typedArgs.campaign_id,
          "campaign_id",
        );
        const limit = validateLimit(typedArgs.limit, MAX_CAMPAIGN_ROWS);

        const rows = await context.db.queryRows(
          `
            select
              campaign_id,
              max(entity_name) as campaign_name,
              coalesce(sum(impressions), 0)::double precision as impressions,
              coalesce(sum(clicks), 0)::double precision as clicks,
              coalesce(sum(spend), 0)::double precision as spend,
              coalesce(sum(sales), 0)::double precision as sales,
              coalesce(sum(orders), 0)::double precision as orders,
              coalesce(sum(units), 0)::double precision as units,
              max(exported_at) as latest_exported_at
            from public.v_mcp_ads_performance_daily
            where account_id = $1
              and marketplace = $2
              and channel = 'sp'
              and performance_level = 'campaign'
              and date between $3::date and $4::date
              and ($5::text is null or campaign_id = $5)
            group by campaign_id
            order by spend desc, sales desc, campaign_id asc
            limit $6
          `,
          [accountId, marketplace, startDate, endDate, campaignId, limit],
        );

        return jsonResult({
          account_id: accountId,
          marketplace,
          filters: {
            start_date: startDate,
            end_date: endDate,
            campaign_id: campaignId,
          },
          row_limit: MAX_CAMPAIGN_ROWS,
          rows,
        });
      },
    },
    {
      name: "get_sp_target_summary",
      description: "Returns bounded Sponsored Products target performance grouped by target identity.",
      inputSchema: {
        start_date: z.string(),
        end_date: z.string(),
        campaign_id: z.string().optional(),
        ad_group_id: z.string().optional(),
        target_id: z.string().optional(),
        limit: z.number().int().optional(),
      },
      handler: async (args: Record<string, unknown>): Promise<ContentResult> => {
        const typedArgs = args as {
          start_date: string;
          end_date: string;
          campaign_id?: string;
          ad_group_id?: string;
          target_id?: string;
          limit?: number;
        };
        const { startDate, endDate } = validateDateRange(
          typedArgs.start_date,
          typedArgs.end_date,
        );
        const campaignId = validateOptionalIdentifier(
          typedArgs.campaign_id,
          "campaign_id",
        );
        const adGroupId = validateOptionalIdentifier(
          typedArgs.ad_group_id,
          "ad_group_id",
        );
        const targetId = validateOptionalIdentifier(typedArgs.target_id, "target_id");
        const limit = validateLimit(typedArgs.limit, MAX_TARGET_ROWS);

        const rows = await context.db.queryRows(
          `
            select
              campaign_id,
              ad_group_id,
              target_id,
              max(target_key) as target_key,
              max(entity_name) as entity_name,
              max(targeting_raw) as targeting_raw,
              max(match_type_norm) as match_type_norm,
              coalesce(sum(impressions), 0)::double precision as impressions,
              coalesce(sum(clicks), 0)::double precision as clicks,
              coalesce(sum(spend), 0)::double precision as spend,
              coalesce(sum(sales), 0)::double precision as sales,
              coalesce(sum(orders), 0)::double precision as orders,
              coalesce(sum(units), 0)::double precision as units,
              max(exported_at) as latest_exported_at
            from public.v_mcp_ads_performance_daily
            where account_id = $1
              and marketplace = $2
              and channel = 'sp'
              and performance_level = 'target'
              and date between $3::date and $4::date
              and ($5::text is null or campaign_id = $5)
              and ($6::text is null or ad_group_id = $6)
              and ($7::text is null or target_id = $7)
            group by campaign_id, ad_group_id, target_id
            order by spend desc, sales desc, target_id asc
            limit $8
          `,
          [accountId, marketplace, startDate, endDate, campaignId, adGroupId, targetId, limit],
        );

        return jsonResult({
          account_id: accountId,
          marketplace,
          filters: {
            start_date: startDate,
            end_date: endDate,
            campaign_id: campaignId,
            ad_group_id: adGroupId,
            target_id: targetId,
          },
          row_limit: MAX_TARGET_ROWS,
          rows,
        });
      },
    },
    {
      name: "get_h10_keyword_rankings",
      description: "Returns bounded Helium 10 keyword ranking rows for a required ASIN and date range.",
      inputSchema: {
        asin: z.string(),
        start_date: z.string(),
        end_date: z.string(),
        keyword_query: z.string().optional(),
        limit: z.number().int().optional(),
      },
      handler: async (args: Record<string, unknown>): Promise<ContentResult> => {
        const typedArgs = args as {
          asin: string;
          start_date: string;
          end_date: string;
          keyword_query?: string;
          limit?: number;
        };
        const { startDate, endDate } = validateDateRange(
          typedArgs.start_date,
          typedArgs.end_date,
        );
        const asin = validateOptionalIdentifier(typedArgs.asin, "asin");
        if (!asin) {
          throw new Error("asin is required");
        }
        const keywordQuery = validateOptionalIdentifier(
          typedArgs.keyword_query,
          "keyword_query",
        );
        const limit = validateLimit(typedArgs.limit, MAX_H10_ROWS);

        const rows = await context.db.queryRows(
          `
            select
              asin,
              title,
              keyword_raw,
              keyword_norm,
              keyword_sales,
              search_volume,
              organic_rank_raw,
              organic_rank_value,
              organic_rank_kind,
              sponsored_pos_raw,
              sponsored_pos_value,
              sponsored_pos_kind,
              observed_date::text as observed_date,
              observed_at,
              exported_at
            from public.v_mcp_h10_keyword_rankings
            where account_id = $1
              and marketplace = $2
              and asin = $3
              and observed_date between $4::date and $5::date
              and (
                $6::text is null
                or keyword_norm like ('%' || lower($6) || '%')
                or keyword_raw like ('%' || $6 || '%')
              )
            order by observed_date desc, search_volume desc nulls last, keyword_norm asc
            limit $7
          `,
          [accountId, marketplace, asin, startDate, endDate, keywordQuery, limit],
        );

        return jsonResult({
          account_id: accountId,
          marketplace,
          filters: {
            asin,
            start_date: startDate,
            end_date: endDate,
            keyword_query: keywordQuery,
          },
          row_limit: MAX_H10_ROWS,
          rows,
        });
      },
    },
  ];
};
