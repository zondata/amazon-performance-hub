export type CoverageStatusRow = {
  source_type: string;
  table_name: string;
  granularity: string | null;
  oldest_period_start: string | null;
  latest_period_end: string | null;
  latest_complete_period_end: string | null;
  last_status: string;
  freshness_status: string;
  row_count: string | number;
  notes: string | null;
  last_successful_run_at: string | null;
};

export type SalesSummaryRow = {
  date: string;
  asin: string | null;
  child_asin: string | null;
  ordered_product_sales: string | number | null;
  units_ordered: number | null;
  total_order_items: number | null;
  sessions: number | null;
  page_views: number | null;
  buy_box_percentage: string | number | null;
};

export type SpCampaignSummaryRow = {
  date: string;
  campaign_id: string | null;
  campaign_name: string | null;
  impressions: string | number | null;
  clicks: string | number | null;
  spend: string | number | null;
  sales: string | number | null;
  orders: string | number | null;
  units: string | number | null;
  acos: string | number | null;
  roas: string | number | null;
  cpc: string | number | null;
  ctr: string | number | null;
};

export type SpTargetSummaryRow = {
  date: string;
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
  targeting_text: string | null;
  match_type: string | null;
  impressions: string | number | null;
  clicks: string | number | null;
  spend: string | number | null;
  sales: string | number | null;
  orders: string | number | null;
  units: string | number | null;
  acos: string | number | null;
  roas: string | number | null;
  cpc: string | number | null;
  ctr: string | number | null;
};

export type H10KeywordRankingRow = {
  asin: string;
  observed_date: string;
  keyword_raw: string | null;
  keyword_norm: string | null;
  organic_rank_raw: string | null;
  organic_rank_value: number | null;
  organic_rank_kind: string | null;
  sponsored_pos_raw: string | null;
  sponsored_pos_value: number | null;
  sponsored_pos_kind: string | null;
  search_volume: number | null;
  keyword_sales: number | null;
};

export type QueryResultRow =
  | CoverageStatusRow
  | SalesSummaryRow
  | SpCampaignSummaryRow
  | SpTargetSummaryRow
  | H10KeywordRankingRow;

export interface QueryExecutor {
  query<T extends QueryResultRow>(text: string, values: readonly unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

export type McpServerConfig = {
  databaseUrl: string;
  accountId: string | null;
  marketplace: string | null;
};
