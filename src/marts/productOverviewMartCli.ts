import {
  PRODUCT_OVERVIEW_ADS_SPEND_SOURCE,
  buildProductOverviewMart,
  buildProductOverviewMartFromRows,
  summarizeProductOverviewMart,
  type ProductOverviewAdsSpendSourceRow,
  type ProductOverviewMartRequest,
  type ProductOverviewRetailTruthSourceRow,
} from './productOverviewMart';
import {
  RETAIL_TRUTH_SOURCE,
  SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
} from '../warehouse/retailSalesTrafficTruth';

type ProductOverviewMartCliScenario =
  | 'real'
  | 'stub-valid'
  | 'stub-missing-data'
  | 'stub-zero-denominator'
  | 'stub-legacy-fallback';

interface ProductOverviewMartCliArgs {
  account_id: string;
  marketplace: string;
  start_date: string;
  end_date: string;
  asin?: string;
  scenario: ProductOverviewMartCliScenario;
}

const readValue = (argv: string[], index: number, flag: string): string => {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
};

const parseScenario = (value: string): ProductOverviewMartCliScenario => {
  if (
    value === 'real' ||
    value === 'stub-valid' ||
    value === 'stub-missing-data' ||
    value === 'stub-zero-denominator' ||
    value === 'stub-legacy-fallback'
  ) {
    return value;
  }

  throw new Error(`Unsupported scenario: ${value}`);
};

export const parseProductOverviewMartCliArgs = (
  argv: string[]
): ProductOverviewMartCliArgs => {
  const args: Partial<ProductOverviewMartCliArgs> = {
    scenario: 'real',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--account-id') {
      args.account_id = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--account-id=')) {
      args.account_id = arg.slice('--account-id='.length);
      continue;
    }
    if (arg === '--marketplace') {
      args.marketplace = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--marketplace=')) {
      args.marketplace = arg.slice('--marketplace='.length);
      continue;
    }
    if (arg === '--start-date') {
      args.start_date = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--start-date=')) {
      args.start_date = arg.slice('--start-date='.length);
      continue;
    }
    if (arg === '--end-date') {
      args.end_date = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--end-date=')) {
      args.end_date = arg.slice('--end-date='.length);
      continue;
    }
    if (arg === '--asin') {
      args.asin = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith('--asin=')) {
      args.asin = arg.slice('--asin='.length);
      continue;
    }
    if (arg === '--scenario') {
      args.scenario = parseScenario(readValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg.startsWith('--scenario=')) {
      args.scenario = parseScenario(arg.slice('--scenario='.length));
      continue;
    }

    throw new Error(`Unknown CLI argument: ${arg}`);
  }

  for (const field of ['account_id', 'marketplace', 'start_date', 'end_date'] as const) {
    if (!args[field]) {
      throw new Error(`Missing required --${field.replace(/_/g, '-')} argument`);
    }
  }

  return args as ProductOverviewMartCliArgs;
};

const buildStubRows = (
  request: ProductOverviewMartRequest,
  scenario: Exclude<ProductOverviewMartCliScenario, 'real'>
): {
  retailTruthRows: ProductOverviewRetailTruthSourceRow[];
  adsSpendRows: ProductOverviewAdsSpendSourceRow[];
} => {
  const asin = request.asin ?? 'B0STUBASIN';
  const retailBase = {
    account_id: request.account_id,
    marketplace: request.marketplace,
    asin,
    report_window_start: request.start_date,
    report_window_end: request.end_date,
    report_id: 'stub-report-id',
    canonical_record_id: 'stub-report-id:salesAndTrafficByAsin:0',
    exported_at: '2026-04-20T00:00:00.000Z',
    ingested_at: '2026-04-20T00:01:00.000Z',
    retail_truth_source: RETAIL_TRUTH_SOURCE,
    legacy_sales_trend_fallback: false,
  } satisfies Omit<
    ProductOverviewRetailTruthSourceRow,
    'ordered_product_sales_amount' | 'total_order_items' | 'sessions'
  >;
  const adsBase = {
    account_id: request.account_id,
    advertised_asin_norm: asin,
    exported_at: '2026-04-20T00:00:00.000Z',
  };

  if (scenario === 'stub-valid') {
    return {
      retailTruthRows: [
        {
          ...retailBase,
          ordered_product_sales_amount: 150,
          total_order_items: 7,
          sessions: 75,
        },
      ],
      adsSpendRows: [
        {
          ...adsBase,
          date: request.start_date,
          spend: 20,
        },
        {
          ...adsBase,
          date: request.end_date,
          spend: 5,
        },
      ],
    };
  }

  if (scenario === 'stub-missing-data') {
    return {
      retailTruthRows: [
        {
          ...retailBase,
          report_window_end: request.start_date,
          ordered_product_sales_amount: 100,
          total_order_items: 5,
          sessions: null,
        },
      ],
      adsSpendRows: [],
    };
  }

  if (scenario === 'stub-legacy-fallback') {
    return {
      retailTruthRows: [
        {
          ...retailBase,
          ordered_product_sales_amount: 100,
          total_order_items: 4,
          sessions: 20,
          retail_truth_source: 'legacy-sales-trend',
          legacy_sales_trend_fallback: true,
        },
      ],
      adsSpendRows: [
        {
          ...adsBase,
          date: request.start_date,
          spend: 12,
        },
      ],
    };
  }

  return {
    retailTruthRows: [
      {
        ...retailBase,
        report_window_start: request.start_date,
        report_window_end: request.start_date,
        ordered_product_sales_amount: 0,
        total_order_items: 0,
        sessions: 0,
      },
    ],
    adsSpendRows: [
      {
        ...adsBase,
        date: request.start_date,
        spend: 12,
      },
    ],
  };
};

export const runProductOverviewMartCli = async (argv: string[]): Promise<string> => {
  const args = parseProductOverviewMartCliArgs(argv);
  const request: ProductOverviewMartRequest = {
    account_id: args.account_id,
    marketplace: args.marketplace,
    start_date: args.start_date,
    end_date: args.end_date,
    ...(args.asin ? { asin: args.asin } : {}),
  };

  const result =
    args.scenario === 'real'
      ? await buildProductOverviewMart({
          request,
          source: (await import('./productOverviewMartSupabaseSource'))
            .createSupabaseProductOverviewMartSource(),
        })
      : buildProductOverviewMartFromRows({
          request,
          ...buildStubRows(request, args.scenario),
        });

  const summary = summarizeProductOverviewMart(result);
  return [
    summary,
    `Expected retail source: ${SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW}`,
    `Expected ads source: ${PRODUCT_OVERVIEW_ADS_SPEND_SOURCE}`,
  ].join('\n');
};

async function main(): Promise<void> {
  try {
    console.log(await runProductOverviewMartCli(process.argv.slice(2)));
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Product overview mart failed: ${error.message}`);
    } else {
      console.error('Product overview mart failed due to an unknown error.');
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
