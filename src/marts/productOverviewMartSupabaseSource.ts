import {
  PRODUCT_OVERVIEW_ADS_SPEND_SOURCE,
  type ProductOverviewAdsSpendSourceRow,
  type ProductOverviewMartRequest,
  type ProductOverviewMartSource,
  type ProductOverviewRetailTruthSourceRow,
} from './productOverviewMart';
import { SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW } from '../warehouse/retailSalesTrafficTruth';

const RETAIL_TRUTH_SELECT =
  'account_id,marketplace,asin,date,report_window_start,report_window_end,ordered_product_sales_amount,total_order_items,sessions,report_id,canonical_record_id,exported_at,ingested_at,retail_truth_source,legacy_sales_trend_fallback';

const ADS_SPEND_SELECT =
  'account_id,date,advertised_asin_norm,spend,campaign_id,ad_group_id,exported_at';

const PAGE_SIZE = 1000;

type SupabaseErrorLike = {
  message: string;
};

type SupabaseQueryLike<Row> = {
  eq(column: string, value: string): SupabaseQueryLike<Row>;
  gte(column: string, value: string): SupabaseQueryLike<Row>;
  lte(column: string, value: string): SupabaseQueryLike<Row>;
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean }
  ): SupabaseQueryLike<Row>;
  range(
    from: number,
    to: number
  ): Promise<{
    data: Row[] | null;
    error: SupabaseErrorLike | null;
  }>;
};

type SupabaseClientLike = {
  from(table: string): {
    select<Row>(columns: string): SupabaseQueryLike<Row>;
  };
};

export class ProductOverviewMartSourceError extends Error {
  readonly code: 'source_query_failed';

  constructor(message: string) {
    super(message);
    this.name = 'ProductOverviewMartSourceError';
    this.code = 'source_query_failed';
  }
}

const loadDefaultSupabaseClient = (): SupabaseClientLike => {
  const { getSupabaseClient } = require('../db/supabaseClient') as typeof import(
    '../db/supabaseClient'
  );
  return getSupabaseClient() as unknown as SupabaseClientLike;
};

export const createSupabaseProductOverviewMartSource = (
  client: SupabaseClientLike = loadDefaultSupabaseClient()
): ProductOverviewMartSource => ({
  async fetchRetailTruthRows(
    request: ProductOverviewMartRequest
  ): Promise<ProductOverviewRetailTruthSourceRow[]> {
    const rows: ProductOverviewRetailTruthSourceRow[] = [];
    let offset = 0;

    while (true) {
      let query = client
        .from(SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW)
        .select<ProductOverviewRetailTruthSourceRow>(RETAIL_TRUTH_SELECT)
        .eq('account_id', request.account_id)
        .eq('marketplace', request.marketplace)
        .gte('report_window_end', request.start_date)
        .lte('report_window_start', request.end_date)
        .order('asin', { ascending: true, nullsFirst: false })
        .order('report_window_start', { ascending: true })
        .order('report_window_end', { ascending: true })
        .order('exported_at', { ascending: false, nullsFirst: false });

      if (request.asin) {
        query = query.eq('asin', request.asin);
      }

      const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
      if (error) {
        throw new ProductOverviewMartSourceError(
          `Failed querying ${SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW}: ${error.message}`
        );
      }

      const page = data ?? [];
      rows.push(...page);

      if (page.length < PAGE_SIZE) {
        break;
      }

      offset += PAGE_SIZE;
    }

    return rows;
  },

  async fetchAdsSpendRows(
    request: ProductOverviewMartRequest
  ): Promise<ProductOverviewAdsSpendSourceRow[]> {
    const rows: ProductOverviewAdsSpendSourceRow[] = [];
    let offset = 0;

    while (true) {
      let query = client
        .from(PRODUCT_OVERVIEW_ADS_SPEND_SOURCE)
        .select<ProductOverviewAdsSpendSourceRow>(ADS_SPEND_SELECT)
        .eq('account_id', request.account_id)
        .gte('date', request.start_date)
        .lte('date', request.end_date)
        .order('advertised_asin_norm', { ascending: true, nullsFirst: false })
        .order('date', { ascending: true })
        .order('exported_at', { ascending: false, nullsFirst: false });

      if (request.asin) {
        query = query.eq('advertised_asin_norm', request.asin);
      }

      const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
      if (error) {
        throw new ProductOverviewMartSourceError(
          `Failed querying ${PRODUCT_OVERVIEW_ADS_SPEND_SOURCE}: ${error.message}`
        );
      }

      const page = data ?? [];
      rows.push(...page);

      if (page.length < PAGE_SIZE) {
        break;
      }

      offset += PAGE_SIZE;
    }

    return rows;
  },
});
