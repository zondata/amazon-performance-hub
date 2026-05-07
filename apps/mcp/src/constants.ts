export const MCP_SERVER_INFO = {
  name: "amazon-performance-hub-readonly",
  version: "1.0.0",
} as const;

export const READ_ONLY_TOOL_NAMES = [
  "get_mcp_guide",
  "get_data_coverage_status",
  "get_sales_summary",
  "get_sp_campaign_summary",
  "get_sp_target_summary",
  "get_h10_keyword_rankings",
] as const;

export const MAX_DATA_COVERAGE_ROWS = 100;
export const MAX_SALES_DAILY_ROWS = 366;
export const MAX_CAMPAIGN_ROWS = 200;
export const MAX_TARGET_ROWS = 500;
export const MAX_H10_ROWS = 200;
export const MAX_DATE_RANGE_DAYS = 366;
export const REQUEST_BODY_LIMIT_BYTES = 1024 * 1024;

export const MCP_INSTRUCTIONS = [
  "Read-only Amazon Performance Hub MCP server.",
  "This server does not expose write tools, SQP tools, or arbitrary SQL.",
  "Every query is scoped to the configured account and marketplace.",
].join(" ");
