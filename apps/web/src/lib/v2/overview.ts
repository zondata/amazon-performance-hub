import 'server-only';

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

type SearchParamValue = string | string[] | undefined;

export type V2OverviewSearchParams = Record<string, SearchParamValue>;

export type V2OverviewMetricKey =
  | 'sales'
  | 'orders'
  | 'sessions'
  | 'conversion_rate'
  | 'ad_spend'
  | 'tacos';

export type V2OverviewDiagnostic = {
  code: string;
  severity: 'warning';
  source: string;
  metric?: V2OverviewMetricKey;
  message: string;
  expected_days?: number;
  observed_days?: number;
  missing_dates?: string[];
};

export type V2OverviewMartRow = {
  schema_version: string;
  account_id: string;
  marketplace: string;
  asin: string;
  start_date: string;
  end_date: string;
  sales: number | null;
  orders: number | null;
  sessions: number | null;
  conversion_rate: number | null;
  ad_spend: number | null;
  tacos: number | null;
  source_coverage: {
    retail_source: string;
    ads_source: string;
    expected_days: number;
    retail_observed_days: number;
    ads_observed_days: number;
    retail_missing_dates: string[];
    ads_missing_dates: string[];
  };
  diagnostics: V2OverviewDiagnostic[];
};

export type V2OverviewMartResult = {
  schema_version: string;
  request: {
    account_id: string;
    marketplace: string;
    start_date: string;
    end_date: string;
    asin?: string;
  };
  source_summary: {
    retail_source: string;
    retail_truth_source: string;
    ads_source: string;
    legacy_sales_trend_fallback: false;
    retail_row_count: number;
    ads_row_count: number;
  };
  rows: V2OverviewMartRow[];
  row_count: number;
  diagnostics_count: number;
  diagnostics: V2OverviewDiagnostic[];
};

export type V2OverviewMartSource = {
  fetchRetailTruthRows(request: {
    account_id: string;
    marketplace: string;
    start_date: string;
    end_date: string;
    asin?: string;
  }): Promise<unknown[]>;
  fetchAdsSpendRows(request: {
    account_id: string;
    marketplace: string;
    start_date: string;
    end_date: string;
    asin?: string;
  }): Promise<unknown[]>;
};

export type V2OverviewPageState =
  | {
      kind: 'missing-date-window';
      asin: string;
      startDate: string | null;
      endDate: string | null;
      accountId: string;
      marketplace: string;
    }
  | {
      kind: 'invalid-date-window';
      asin: string;
      startDate: string | null;
      endDate: string | null;
      accountId: string;
      marketplace: string;
      message: string;
    }
  | {
      kind: 'loaded';
      asin: string;
      startDate: string;
      endDate: string;
      accountId: string;
      marketplace: string;
      mart: V2OverviewMartResult;
    }
  | {
      kind: 'error';
      asin: string;
      startDate: string | null;
      endDate: string | null;
      accountId: string;
      marketplace: string;
      message: string;
    };

type V2OverviewLoaderDeps = {
  source?: V2OverviewMartSource;
  accountId?: string;
  marketplace?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const firstParam = (value: SearchParamValue): string | null => {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return value?.trim() || null;
};

export const parseV2OverviewDateWindow = (
  searchParams: V2OverviewSearchParams
): {
  startDate: string | null;
  endDate: string | null;
  error: string | null;
} => {
  const startDate = firstParam(searchParams.start);
  const endDate = firstParam(searchParams.end);

  if (!startDate || !endDate) {
    return {
      startDate,
      endDate,
      error: null,
    };
  }

  if (!DATE_RE.test(startDate)) {
    return {
      startDate,
      endDate,
      error: 'Start date must use YYYY-MM-DD.',
    };
  }

  if (!DATE_RE.test(endDate)) {
    return {
      startDate,
      endDate,
      error: 'End date must use YYYY-MM-DD.',
    };
  }

  if (startDate > endDate) {
    return {
      startDate,
      endDate,
      error: 'Start date must be on or before end date.',
    };
  }

  return {
    startDate,
    endDate,
    error: null,
  };
};

type ProductOverviewMartRuntime = {
  buildProductOverviewMart(args: {
    request: {
      account_id: string;
      marketplace: string;
      start_date: string;
      end_date: string;
      asin?: string;
    };
    source: V2OverviewMartSource;
  }): Promise<V2OverviewMartResult>;
};

type ProductOverviewMartSourceRuntime = {
  createSupabaseProductOverviewMartSource(client: unknown): V2OverviewMartSource;
};

let registeredTsNode = false;

const resolveRepoRoot = (): string => {
  const candidates = [process.cwd(), path.resolve(process.cwd(), '../..')];
  const repoRoot = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, 'src/marts/productOverviewMart.ts'))
  );

  if (!repoRoot) {
    throw new Error('Unable to locate repo root for the product overview mart.');
  }

  return repoRoot;
};

const loadProductOverviewMartRuntime = (): ProductOverviewMartRuntime => {
  const repoRoot = resolveRepoRoot();
  const nodeRequire = createRequire(path.join(repoRoot, 'package.json'));

  if (!registeredTsNode) {
    process.env.TS_NODE_PROJECT = path.join(repoRoot, 'tsconfig.json');
    nodeRequire('ts-node/register/transpile-only');
    registeredTsNode = true;
  }

  return nodeRequire(
    path.join(repoRoot, 'src/marts/productOverviewMart.ts')
  ) as ProductOverviewMartRuntime;
};

const loadProductOverviewMartSourceRuntime =
  (): ProductOverviewMartSourceRuntime => {
    const repoRoot = resolveRepoRoot();
    const nodeRequire = createRequire(path.join(repoRoot, 'package.json'));

    if (!registeredTsNode) {
      process.env.TS_NODE_PROJECT = path.join(repoRoot, 'tsconfig.json');
      nodeRequire('ts-node/register/transpile-only');
      registeredTsNode = true;
    }

    return nodeRequire(
      path.join(repoRoot, 'src/marts/productOverviewMartSupabaseSource.ts')
    ) as ProductOverviewMartSourceRuntime;
  };

const defaultProductOverviewMartSource =
  async (): Promise<V2OverviewMartSource> => {
    const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
    return loadProductOverviewMartSourceRuntime().createSupabaseProductOverviewMartSource(
      supabaseAdmin
    );
  };

const defaultAccountContext = async (): Promise<{
  accountId: string;
  marketplace: string;
}> => {
  const { env } = await import('@/lib/env');
  return {
    accountId: env.accountId,
    marketplace: env.marketplace,
  };
};

const resolveAccountContext = async (
  deps: V2OverviewLoaderDeps
): Promise<{ accountId: string; marketplace: string }> => {
  if (deps.accountId && deps.marketplace) {
    return {
      accountId: deps.accountId,
      marketplace: deps.marketplace,
    };
  }

  const defaults = await defaultAccountContext();
  return {
    accountId: deps.accountId ?? defaults.accountId,
    marketplace: deps.marketplace ?? defaults.marketplace,
  };
};

export const loadV2OverviewPageState = async (
  args: {
    asin: string;
    searchParams: V2OverviewSearchParams;
  },
  deps: V2OverviewLoaderDeps = {}
): Promise<V2OverviewPageState> => {
  const asin = args.asin.trim().toUpperCase();
  const accountContext = await resolveAccountContext(deps);
  const accountId = accountContext.accountId;
  const marketplace = accountContext.marketplace.toUpperCase();
  const { startDate, endDate, error } = parseV2OverviewDateWindow(
    args.searchParams
  );

  if (error) {
    return {
      kind: 'invalid-date-window',
      asin,
      startDate,
      endDate,
      accountId,
      marketplace,
      message: error,
    };
  }

  if (!startDate || !endDate) {
    return {
      kind: 'missing-date-window',
      asin,
      startDate,
      endDate,
      accountId,
      marketplace,
    };
  }

  try {
    const mart = await loadProductOverviewMartRuntime().buildProductOverviewMart({
      request: {
        account_id: accountId,
        marketplace,
        start_date: startDate,
        end_date: endDate,
        asin,
      },
      source: deps.source ?? (await defaultProductOverviewMartSource()),
    });

    return {
      kind: 'loaded',
      asin,
      startDate,
      endDate,
      accountId,
      marketplace,
      mart,
    };
  } catch (errorValue) {
    return {
      kind: 'error',
      asin,
      startDate,
      endDate,
      accountId,
      marketplace,
      message:
        errorValue instanceof Error
          ? errorValue.message
          : 'The product overview mart request failed.',
    };
  }
};
