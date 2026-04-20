import type {
  V2OverviewDiagnostic,
  V2OverviewMartRow,
  V2OverviewPageState,
} from '@/lib/v2/overview';

const formatCurrency = (value: number | null): string =>
  value === null
    ? 'No data'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      }).format(value);

const formatInteger = (value: number | null): string =>
  value === null ? 'No data' : new Intl.NumberFormat('en-US').format(value);

const formatPercent = (value: number | null): string =>
  value === null
    ? 'No data'
    : new Intl.NumberFormat('en-US', {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(value);

const metricCards = (row: V2OverviewMartRow) => [
  {
    label: 'Sales',
    value: formatCurrency(row.sales),
    source: row.sales === null ? 'Missing retail truth metric' : 'SP-API retail truth',
  },
  {
    label: 'Orders',
    value: formatInteger(row.orders),
    source: row.orders === null ? 'Missing retail truth metric' : 'SP-API retail truth',
  },
  {
    label: 'Sessions',
    value: formatInteger(row.sessions),
    source:
      row.sessions === null ? 'Missing retail truth metric' : 'SP-API retail truth',
  },
  {
    label: 'Conversion rate',
    value: formatPercent(row.conversion_rate),
    source: row.conversion_rate === null ? 'Requires orders and sessions' : 'orders / sessions',
  },
  {
    label: 'Ad spend',
    value: formatCurrency(row.ad_spend),
    source: row.ad_spend === null ? 'Missing Ads-backed spend' : 'Ads-backed truth',
  },
  {
    label: 'TACOS',
    value: formatPercent(row.tacos),
    source: row.tacos === null ? 'Requires ad spend and sales' : 'ad spend / sales',
  },
];

const getPrimaryRow = (state: Extract<V2OverviewPageState, { kind: 'loaded' }>) =>
  state.mart.rows.find((row) => row.asin === state.asin) ?? state.mart.rows[0] ?? null;

const DateWindowForm = ({
  asin,
  startDate,
  endDate,
}: {
  asin: string;
  startDate: string | null;
  endDate: string | null;
}) => (
  <form method="get" className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
    <label className="grid gap-2 text-sm font-medium text-foreground">
      Start date
      <input
        name="start"
        type="date"
        defaultValue={startDate ?? ''}
        className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
        aria-label="Start date"
      />
    </label>
    <label className="grid gap-2 text-sm font-medium text-foreground">
      End date
      <input
        name="end"
        type="date"
        defaultValue={endDate ?? ''}
        className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
        aria-label="End date"
      />
    </label>
    <button
      type="submit"
      className="h-10 rounded-md border border-primary bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
    >
      Load overview
    </button>
    <input type="hidden" name="asin" value={asin} />
  </form>
);

const StateNotice = ({
  title,
  message,
  tone = 'neutral',
}: {
  title: string;
  message: string;
  tone?: 'neutral' | 'warning' | 'error';
}) => {
  const toneClass =
    tone === 'error'
      ? 'border-red-300 bg-red-50 text-red-950'
      : tone === 'warning'
        ? 'border-amber-300 bg-amber-50 text-amber-950'
        : 'border-border bg-surface text-foreground';

  return (
    <section className={`rounded-lg border p-4 ${toneClass}`}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6">{message}</p>
    </section>
  );
};

const SourceState = ({
  state,
}: {
  state: Extract<V2OverviewPageState, { kind: 'loaded' }>;
}) => (
  <section className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold text-foreground">Source and fallback state</h2>
      <p className="mt-1 text-sm text-muted">
        The page reads the product overview mart result and shows the bounded source contract returned by that mart.
      </p>
    </div>
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="text-xs font-semibold uppercase text-muted">Retail truth source</div>
        <div className="mt-2 break-words font-mono text-sm text-foreground">
          {state.mart.source_summary.retail_source}
        </div>
        <div className="mt-2 text-sm text-muted">
          {state.mart.source_summary.retail_truth_source}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="text-xs font-semibold uppercase text-muted">Ads truth source</div>
        <div className="mt-2 break-words font-mono text-sm text-foreground">
          {state.mart.source_summary.ads_source}
        </div>
        <div className="mt-2 text-sm text-muted">
          Rows read: {state.mart.source_summary.ads_row_count}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="text-xs font-semibold uppercase text-muted">Legacy SI fallback</div>
        <div className="mt-2 text-2xl font-semibold text-foreground">
          {state.mart.source_summary.legacy_sales_trend_fallback ? 'Yes' : 'No'}
        </div>
        <div className="mt-2 text-sm text-muted">
          SI SalesTrend fallback is not allowed on this route.
        </div>
      </div>
    </div>
  </section>
);

const Diagnostics = ({ diagnostics }: { diagnostics: V2OverviewDiagnostic[] }) => (
  <section className="space-y-3">
    <h2 className="text-lg font-semibold text-foreground">Diagnostics</h2>
    {diagnostics.length === 0 ? (
      <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
        No mart diagnostics for this ASIN and date window.
      </p>
    ) : (
      <ul className="space-y-2">
        {diagnostics.map((diagnostic, index) => (
          <li
            key={`${diagnostic.code}-${diagnostic.metric ?? 'coverage'}-${index}`}
            className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          >
            <div className="font-semibold">{diagnostic.code}</div>
            <div className="mt-1">{diagnostic.message}</div>
            <div className="mt-2 font-mono text-xs">{diagnostic.source}</div>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export default function V2OverviewPageView({
  state,
}: {
  state: V2OverviewPageState;
}) {
  const startDate = 'startDate' in state ? state.startDate : null;
  const endDate = 'endDate' in state ? state.endDate : null;

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <div className="text-xs font-semibold uppercase text-muted">V2 Overview</div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">{state.asin}</h1>
            <p className="mt-2 text-sm text-muted">
              Account {state.accountId} · Marketplace {state.marketplace}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
            Date window:{' '}
            <span className="font-mono text-foreground">
              {startDate && endDate ? `${startDate} -> ${endDate}` : 'explicit dates required'}
            </span>
          </div>
        </div>
      </header>

      <section className="rounded-lg border border-border bg-surface p-4">
        <DateWindowForm asin={state.asin} startDate={startDate} endDate={endDate} />
      </section>

      {state.kind === 'missing-date-window' ? (
        <StateNotice
          title="Explicit date window required"
          message="Enter both start and end dates to load the product overview mart. This page does not use hidden rolling windows."
        />
      ) : null}

      {state.kind === 'invalid-date-window' ? (
        <StateNotice title="Invalid date window" message={state.message} tone="error" />
      ) : null}

      {state.kind === 'error' ? (
        <StateNotice title="Overview load failed" message={state.message} tone="error" />
      ) : null}

      {state.kind === 'loaded' ? (
        <>
          {state.mart.row_count === 0 ? (
            <StateNotice
              title="No product overview data"
              message="The product overview mart returned no rows for this ASIN and date window. No metrics were fabricated."
              tone="warning"
            />
          ) : null}

          {(() => {
            const row = getPrimaryRow(state);
            if (!row) return null;

            return (
              <>
                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {metricCards(row).map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-lg border border-border bg-surface p-4"
                    >
                      <div className="text-xs font-semibold uppercase text-muted">
                        {metric.label}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-foreground">
                        {metric.value}
                      </div>
                      <div className="mt-2 text-sm text-muted">{metric.source}</div>
                    </div>
                  ))}
                </section>

                <SourceState state={state} />
                <Diagnostics diagnostics={row.diagnostics} />
              </>
            );
          })()}
        </>
      ) : null}
    </section>
  );
}
