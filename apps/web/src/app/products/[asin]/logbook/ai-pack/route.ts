import { env } from '@/lib/env';
import { LOGBOOK_AI_PACK_VERSION } from '@/lib/logbook/aiPack/parseLogbookAiPack';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toDateString = (value: Date) => value.toISOString().slice(0, 10);

const parseDate = (value: string | null): string | null => {
  if (!value || !DATE_RE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return value;
};

const defaultRange = () => {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return {
    start: toDateString(start),
    end: toDateString(end),
  };
};

const parseShortName = (value: unknown): string | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const shortName = (value as Record<string, unknown>).short_name;
  return typeof shortName === 'string' && shortName.trim() ? shortName.trim() : null;
};

type SalesKpiRow = {
  sales: number | string | null;
  orders: number | string | null;
  units: number | string | null;
  ppc_cost: number | string | null;
};

const num = (value: number | string | null | undefined) => {
  const out = Number(value ?? 0);
  return Number.isFinite(out) ? out : 0;
};

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

const formatNumber = (value: number) => value.toLocaleString('en-US');

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const sanitizeFileSegment = (value: string): string => {
  const cleaned = value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]+/g, '');
  return cleaned.length > 0 ? cleaned.slice(0, 80) : 'product';
};

type Ctx = { params: Promise<{ asin: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { asin: rawAsin } = await params;
  const asin = (rawAsin ?? '').trim().toUpperCase();

  if (!asin) {
    return new Response('Missing ASIN param.', { status: 400 });
  }

  const url = new URL(request.url);
  const defaults = defaultRange();
  let start = parseDate(url.searchParams.get('start')) ?? defaults.start;
  let end = parseDate(url.searchParams.get('end')) ?? defaults.end;

  if (start > end) {
    const swap = start;
    start = end;
    end = swap;
  }

  const { data: productRow, error: productError } = await supabaseAdmin
    .from('products')
    .select('product_id,title')
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('asin', asin)
    .maybeSingle();

  if (productError || !productRow?.product_id) {
    return new Response('Product not found.', { status: 404 });
  }

  let shortName: string | null = null;
  try {
    const { data: profileRow } = await supabaseAdmin
      .from('product_profile')
      .select('profile_json')
      .eq('product_id', productRow.product_id)
      .maybeSingle();
    shortName = parseShortName(profileRow?.profile_json ?? null);
  } catch {
    shortName = null;
  }

  const { data: kpiRows, error: kpiError } = await supabaseAdmin
    .from('si_sales_trend_daily_latest')
    .select('sales,orders,units,ppc_cost')
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('asin', asin)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })
    .limit(5000);

  if (kpiError) {
    return new Response(`Failed to load KPI summary: ${kpiError.message}`, { status: 500 });
  }

  const rows = (kpiRows ?? []) as SalesKpiRow[];
  const totals = rows.reduce<{
    sales: number;
    orders: number;
    units: number;
    ppc_cost: number;
  }>(
    (acc, row) => ({
      sales: acc.sales + num(row.sales),
      orders: acc.orders + num(row.orders),
      units: acc.units + num(row.units),
      ppc_cost: acc.ppc_cost + num(row.ppc_cost),
    }),
    { sales: 0, orders: 0, units: 0, ppc_cost: 0 }
  );

  const tacos = totals.sales > 0 ? totals.ppc_cost / totals.sales : null;

  const content = `# Product Logbook AI Pack

## Product Context
- ASIN: ${asin}
- Title: ${productRow.title ?? '—'}
- Short name: ${shortName ?? '—'}
- Date range: ${start} to ${end}

## Sales KPI Summary (${start} to ${end})
- Days with data: ${rows.length}
- Sales: ${formatCurrency(totals.sales)}
- Orders: ${formatNumber(totals.orders)}
- Units: ${formatNumber(totals.units)}
- PPC Cost: ${formatCurrency(totals.ppc_cost)}
- TACOS: ${formatPercent(tacos)}

## Strict Output Contract
- Return **JSON only** (no markdown, prose, or code fences).
- Output exactly one object with these top-level fields:
  - \`pack_version\`: must be \`${LOGBOOK_AI_PACK_VERSION}\`
  - \`kind\`: one of \`experiment\`, \`change\`, \`evaluation\`
  - \`product\`: must include \`asin\` = \`${asin}\`
  - One payload object matching \`kind\`.
- Use ISO datetimes for timestamps and \`YYYY-MM-DD\` for dates.
- Keep identifiers deterministic using optional \`dedupe_key\` fields.

## JSON Example: kind=experiment
\`\`\`json
{
  "pack_version": "${LOGBOOK_AI_PACK_VERSION}",
  "kind": "experiment",
  "product": { "asin": "${asin}" },
  "experiment": {
    "dedupe_key": "exp-${asin.toLowerCase()}-budget-test-w08",
    "name": "Budget Expansion W08",
    "objective": "Increase net sales while maintaining TACOS guardrail",
    "hypothesis": "Raising budget on top campaigns increases incremental orders",
    "evaluation_lag_days": 2,
    "evaluation_window_days": 7,
    "primary_metrics": { "sales": "si_sales_trend_daily_latest" },
    "guardrails": { "tacos_max": 0.18 },
    "scope": {
      "product_id": "${asin}",
      "status": "active",
      "start_date": "${start}",
      "end_date": "${end}",
      "tags": ["sp", "budget_test"],
      "5w1h": {
        "who": "PPC manager",
        "what": "Increase top campaign budgets by 20%",
        "when": "Week 08",
        "where": "US marketplace",
        "why": "Recover lost rank and sessions",
        "how": "Apply incremental increases, watch TACOS daily"
      },
      "plan": ["Apply budget changes", "Monitor for 7 days", "Evaluate outcomes"],
      "expected_outcome": "Sales up 8-12% with TACOS below 18%"
    }
  }
}
\`\`\`

## JSON Example: kind=change
\`\`\`json
{
  "pack_version": "${LOGBOOK_AI_PACK_VERSION}",
  "kind": "change",
  "product": { "asin": "${asin}" },
  "change": {
    "dedupe_key": "chg-${asin.toLowerCase()}-sp-budget-2026-02-21",
    "occurred_at": "2026-02-21T14:30:00Z",
    "channel": "sp",
    "change_type": "budget_update",
    "summary": "Raised daily budgets by 20% for top converters",
    "why": "Capture additional demand during peak traffic",
    "source": "ai_pack",
    "before_json": { "daily_budget": 120 },
    "after_json": { "daily_budget": 144 },
    "experiment_dedupe_key": "exp-${asin.toLowerCase()}-budget-test-w08",
    "entities": [
      {
        "entity_type": "campaign",
        "campaign_id": "1234567890",
        "note": "Primary SP campaign"
      }
    ]
  }
}
\`\`\`

## JSON Example: kind=evaluation
\`\`\`json
{
  "pack_version": "${LOGBOOK_AI_PACK_VERSION}",
  "kind": "evaluation",
  "product": { "asin": "${asin}" },
  "evaluation": {
    "experiment_dedupe_key": "exp-${asin.toLowerCase()}-budget-test-w08",
    "evaluated_at": "2026-02-28T12:00:00Z",
    "window_start": "${start}",
    "window_end": "${end}",
    "metrics_json": {
      "outcome": {
        "score": 0.74,
        "summary": "Positive lift with acceptable TACOS"
      },
      "kpis": {
        "sales_delta_pct": 0.11,
        "tacos_delta_pct": 0.02
      }
    },
    "notes": "Observed stronger conversion on top terms.",
    "mark_complete": true,
    "status": "complete",
    "outcome_summary": "Scale cautiously next cycle"
  }
}
\`\`\`
`;

  const filename = `${asin}_${sanitizeFileSegment(shortName ?? productRow.title ?? 'logbook')}_ai_pack.md`;

  return new Response(content, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
