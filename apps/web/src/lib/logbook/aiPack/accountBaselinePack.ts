export const ACCOUNT_BASELINE_DATA_PACK_KIND = 'aph_account_ai_baseline_data_pack_v1';

export type BaselineWindow = {
  start: string;
  end: string;
  days: number;
};

export type BaselineSalesKpis = {
  sales: number;
  orders: number;
  units: number;
  ppc_cost: number;
  tacos: number | null;
};

export type BaselineProductSnapshot = {
  asin: string;
  name: string | null;
  revenue_last_30d: number;
  revenue_last_90d: number;
  orders_last_30d: number;
  units_last_30d: number;
  deltas_vs_prev_30d: {
    revenue_abs: number;
    revenue_pct: number | null;
    orders_abs: number;
    orders_pct: number | null;
    units_abs: number;
    units_pct: number | null;
  };
};

export type BaselineAdsWindowSummary = {
  spend: number;
  sales: number;
  acos: number | null;
  roas: number | null;
};

export type BaselineExperimentSummary = {
  experiment_id: string;
  name: string;
  status: string;
  product_id: string | null;
  created_at: string;
  latest_evaluated_at: string | null;
  outcome_score: number | null;
};

export type BaselineValidationSummary = {
  window_start: string;
  window_end: string;
  total_changes: number;
  validated: number;
  mismatch: number;
  pending: number;
  not_found: number;
  none: number;
};

export type BaselineIngestionHeartbeat = {
  source_type: string;
  latest_timestamp: string | null;
  coverage_start: string | null;
  coverage_end: string | null;
  row_count: number;
};

export type AccountBaselineDataPack = {
  kind: typeof ACCOUNT_BASELINE_DATA_PACK_KIND;
  generated_at: string;
  account_id: string;
  marketplace: string;
  windows: {
    last_30d: BaselineWindow;
    last_90d: BaselineWindow;
    prev_30d: BaselineWindow;
  };
  sales_kpis_summary: {
    last_30d: BaselineSalesKpis;
    last_90d: BaselineSalesKpis;
  };
  top_products_snapshot: BaselineProductSnapshot[];
  ads_summary: {
    last_30d: {
      sp: BaselineAdsWindowSummary;
      sb: BaselineAdsWindowSummary;
      combined: BaselineAdsWindowSummary;
    };
    last_90d: {
      sp: BaselineAdsWindowSummary;
      sb: BaselineAdsWindowSummary;
      combined: BaselineAdsWindowSummary;
    };
  };
  recent_experiments: BaselineExperimentSummary[];
  validation_summary: BaselineValidationSummary;
  ingestion_heartbeat: BaselineIngestionHeartbeat[];
};

type BuildPackInput = Omit<AccountBaselineDataPack, 'kind'>;

export const buildAccountBaselineDataPack = (
  input: BuildPackInput
): AccountBaselineDataPack => ({
  kind: ACCOUNT_BASELINE_DATA_PACK_KIND,
  generated_at: input.generated_at,
  account_id: input.account_id,
  marketplace: input.marketplace,
  windows: input.windows,
  sales_kpis_summary: input.sales_kpis_summary,
  top_products_snapshot: input.top_products_snapshot,
  ads_summary: input.ads_summary,
  recent_experiments: input.recent_experiments,
  validation_summary: input.validation_summary,
  ingestion_heartbeat: input.ingestion_heartbeat,
});
