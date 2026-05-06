import type { McpServerConfig } from "./types.js";

export function buildGuide(config: Pick<McpServerConfig, "accountId" | "marketplace">): string {
  const accountContext = config.accountId ?? "not pinned";
  const marketplaceContext = config.marketplace ?? "not pinned";

  return `# Amazon Performance Hub MCP v1

Amazon Performance Hub is a read-only analytics layer over stable Amazon sales, ads, and Helium 10 keyword ranking data stored in V3 Supabase.

## Context

- account_id: ${accountContext}
- marketplace: ${marketplaceContext}

## Available tools

- \`get_mcp_guide\`
- \`get_data_coverage_status\`
- \`get_sales_summary\`
- \`get_sp_campaign_summary\`
- \`get_sp_target_summary\`
- \`get_h10_keyword_rankings\`

## Stable data in v1

- Sales and traffic summaries from V3 sales/traffic warehouse views.
- Sponsored Products campaign and target performance from V3 ads performance views.
- H10 keyword ranking history from manual Helium 10 UI uploads.
- Coverage/freshness signals from \`data_coverage_status\`.

## Intentionally excluded in v1

- SQP weekly and monthly tools.
- SQP pending request status.
- Any write or mutation tool.
- Campaign edit tools.
- Amazon API write actions.
- Arbitrary SQL execution.

SQP is intentionally excluded from MCP v1 while SQP backfill and pending reports settle.

## Operating rules for AI clients

- MCP v1 is read-only.
- No write tools exist.
- No Amazon changes can be made through this server.
- Check \`get_data_coverage_status\` before claiming data is fresh or complete.
- Cite tool output dates when answering.
- Do not assume missing rows mean zero sales, clicks, or keyword rank unless tool output says so.
- Do not recommend that data is complete unless the tool output explicitly supports that claim.
- H10 ranking data is manually uploaded through the V3 UI and may lag behind sales and ads sources.`;
}
