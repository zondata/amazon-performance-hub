import { env } from '@/lib/env';
import { extractOutcomeScore } from '@/lib/logbook/aiPack/parseLogbookAiPack';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type ExperimentRow = {
  experiment_id: string;
  name: string;
  objective: string;
  hypothesis: string | null;
  scope: unknown;
  created_at: string;
};

type LinkRow = {
  change_id: string;
};

type ChangeRow = {
  change_id: string;
  occurred_at: string;
  channel: string;
  change_type: string;
  summary: string;
  why: string | null;
  source: string;
};

type ChangeEntityRow = {
  change_id: string;
  entity_type: string;
  product_id: string | null;
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
  keyword_id: string | null;
  note: string | null;
};

type EvaluationRow = {
  evaluation_id: string;
  evaluated_at: string;
  window_start: string | null;
  window_end: string | null;
  metrics_json: unknown;
  notes: string | null;
};

type KpiRow = {
  sales: number | string | null;
  orders: number | string | null;
  units: number | string | null;
  ppc_cost: number | string | null;
};

type KpiSummary = {
  start: string;
  end: string;
  sales: number;
  orders: number;
  units: number;
  ppc_cost: number;
  tacos: number | null;
  row_count: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const scopeString = (scope: Record<string, unknown> | null, key: string): string | null => {
  if (!scope) return null;
  const value = scope[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const parseDateOnly = (value: string | null): string | null => {
  if (!value || !DATE_RE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return value;
};

const toDate = (value: string): Date => new Date(`${value}T00:00:00Z`);

const toDateString = (value: Date): string => value.toISOString().slice(0, 10);

const addDays = (value: Date, days: number) => {
  const out = new Date(value);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
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

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString();
};

const formatDelta = (test: number, baseline: number) => {
  const delta = test - baseline;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)}`;
};

const formatPctDelta = (test: number, baseline: number) => {
  if (baseline === 0) return '—';
  const delta = (test - baseline) / baseline;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${(delta * 100).toFixed(1)}%`;
};

const collectKpis = async (
  asin: string,
  start: string,
  end: string
): Promise<KpiSummary> => {
  const { data, error } = await supabaseAdmin
    .from('si_sales_trend_daily_latest')
    .select('sales,orders,units,ppc_cost')
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .eq('asin', asin)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })
    .limit(5000);

  if (error) {
    throw new Error(`Failed to load sales KPIs: ${error.message}`);
  }

  const rows = (data ?? []) as KpiRow[];
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

  return {
    start,
    end,
    sales: totals.sales,
    orders: totals.orders,
    units: totals.units,
    ppc_cost: totals.ppc_cost,
    tacos: totals.sales > 0 ? totals.ppc_cost / totals.sales : null,
    row_count: rows.length,
  };
};

const entityLabel = (entity: ChangeEntityRow) => {
  const parts: string[] = [];
  if (entity.product_id) parts.push(`product=${entity.product_id}`);
  if (entity.campaign_id) parts.push(`campaign=${entity.campaign_id}`);
  if (entity.ad_group_id) parts.push(`ad_group=${entity.ad_group_id}`);
  if (entity.target_id) parts.push(`target=${entity.target_id}`);
  if (entity.keyword_id) parts.push(`keyword=${entity.keyword_id}`);
  if (entity.note) parts.push(`note=${entity.note}`);
  return parts.join(', ');
};

const sanitizeFileSegment = (value: string): string => {
  const cleaned = value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]+/g, '');
  return cleaned.length > 0 ? cleaned.slice(0, 80) : 'experiment';
};

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const experimentId = id?.trim();

  if (!experimentId) {
    return new Response('Missing experiment id.', { status: 400 });
  }

  const { data: experimentData, error: experimentError } = await supabaseAdmin
    .from('log_experiments')
    .select('experiment_id,name,objective,hypothesis,scope,created_at')
    .eq('experiment_id', experimentId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .maybeSingle();

  if (experimentError || !experimentData) {
    return new Response('Experiment not found.', { status: 404 });
  }

  const experiment = experimentData as ExperimentRow;
  const scope = asObject(experiment.scope);
  const status = scopeString(scope, 'status') ?? 'planned';
  const startDate = parseDateOnly(scopeString(scope, 'start_date'));
  const endDate = parseDateOnly(scopeString(scope, 'end_date'));
  const productAsin = scopeString(scope, 'product_id')?.toUpperCase() ?? null;

  const { data: linkData, error: linkError } = await supabaseAdmin
    .from('log_experiment_changes')
    .select('change_id')
    .eq('experiment_id', experimentId);

  if (linkError) {
    return new Response(`Failed to load linked changes: ${linkError.message}`, { status: 500 });
  }

  const changeIds = (linkData as LinkRow[] | null)?.map((row) => row.change_id) ?? [];

  let changes: ChangeRow[] = [];
  let changeEntities: ChangeEntityRow[] = [];

  if (changeIds.length > 0) {
    const { data: changeData, error: changeError } = await supabaseAdmin
      .from('log_changes')
      .select('change_id,occurred_at,channel,change_type,summary,why,source')
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .in('change_id', changeIds)
      .order('occurred_at', { ascending: false })
      .limit(5000);

    if (changeError) {
      return new Response(`Failed to load change rows: ${changeError.message}`, { status: 500 });
    }

    changes = (changeData ?? []) as ChangeRow[];

    const { data: entityData, error: entityError } = await supabaseAdmin
      .from('log_change_entities')
      .select(
        'change_id,entity_type,product_id,campaign_id,ad_group_id,target_id,keyword_id,note'
      )
      .in('change_id', changeIds)
      .order('created_at', { ascending: false });

    if (entityError) {
      return new Response(`Failed to load change entities: ${entityError.message}`, {
        status: 500,
      });
    }

    changeEntities = (entityData ?? []) as ChangeEntityRow[];
  }

  const entitiesByChangeId = new Map<string, ChangeEntityRow[]>();
  changeEntities.forEach((entity) => {
    const rows = entitiesByChangeId.get(entity.change_id) ?? [];
    rows.push(entity);
    entitiesByChangeId.set(entity.change_id, rows);
  });

  const { data: latestEvaluationData } = await supabaseAdmin
    .from('log_evaluations')
    .select('evaluation_id,evaluated_at,window_start,window_end,metrics_json,notes')
    .eq('experiment_id', experimentId)
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .order('evaluated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestEvaluation = (latestEvaluationData ?? null) as EvaluationRow | null;

  let productTitle: string | null = null;
  if (productAsin) {
    const { data: productData } = await supabaseAdmin
      .from('products')
      .select('title')
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .eq('asin', productAsin)
      .maybeSingle();

    productTitle = productData?.title ?? null;
  }

  const warnings: string[] = [];
  let baselineSummary: KpiSummary | null = null;
  let testSummary: KpiSummary | null = null;
  const metadataOnly = !startDate || !endDate;

  if (!productAsin) {
    warnings.push('Experiment scope.product_id is missing, so sales KPI comparison is unavailable.');
  }

  if (metadataOnly) {
    warnings.push('scope.start_date or scope.end_date is missing/invalid; baseline vs test KPIs skipped.');
  }

  if (!metadataOnly && startDate && endDate && productAsin) {
    const start = toDate(startDate);
    const end = toDate(endDate);

    if (end < start) {
      warnings.push('scope.end_date is earlier than scope.start_date; baseline vs test KPIs skipped.');
    } else {
      const days = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      const baselineEnd = addDays(start, -1);
      const baselineStart = addDays(baselineEnd, -(days - 1));

      try {
        baselineSummary = await collectKpis(
          productAsin,
          toDateString(baselineStart),
          toDateString(baselineEnd)
        );
        testSummary = await collectKpis(productAsin, startDate, endDate);
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : 'Failed to load sales KPI windows.');
      }
    }
  }

  const linkedActionsSection = metadataOnly
    ? ''
    : `## Linked Actions (${changes.length})
${
  changes.length === 0
    ? '- No linked changes.'
    : changes
        .map((change) => {
          const entityLabels = (entitiesByChangeId.get(change.change_id) ?? [])
            .map((entity) => `${entity.entity_type}: ${entityLabel(entity)}`)
            .filter((line) => line.trim().length > 0);

          return `- ${formatDateTime(change.occurred_at)} | ${change.channel}/${change.change_type} | ${change.summary}
  - Why: ${change.why ?? '—'}
  - Source: ${change.source}${
            entityLabels.length > 0
              ? `\n  - Entities:\n${entityLabels.map((line) => `    - ${line}`).join('\n')}`
              : ''
          }`;
        })
        .join('\n')
}
`;

  const kpiSection = metadataOnly
    ? ''
    : `## Sales KPI Comparison
${
  baselineSummary && testSummary
    ? `- Baseline window: ${baselineSummary.start} to ${baselineSummary.end} (${baselineSummary.row_count} days with data)
- Test window: ${testSummary.start} to ${testSummary.end} (${testSummary.row_count} days with data)

| KPI | Baseline | Test | Delta | Delta % |
|---|---:|---:|---:|---:|
| Sales | ${formatCurrency(baselineSummary.sales)} | ${formatCurrency(testSummary.sales)} | ${formatDelta(testSummary.sales, baselineSummary.sales)} | ${formatPctDelta(testSummary.sales, baselineSummary.sales)} |
| Orders | ${formatNumber(baselineSummary.orders)} | ${formatNumber(testSummary.orders)} | ${formatDelta(testSummary.orders, baselineSummary.orders)} | ${formatPctDelta(testSummary.orders, baselineSummary.orders)} |
| Units | ${formatNumber(baselineSummary.units)} | ${formatNumber(testSummary.units)} | ${formatDelta(testSummary.units, baselineSummary.units)} | ${formatPctDelta(testSummary.units, baselineSummary.units)} |
| PPC Cost | ${formatCurrency(baselineSummary.ppc_cost)} | ${formatCurrency(testSummary.ppc_cost)} | ${formatDelta(testSummary.ppc_cost, baselineSummary.ppc_cost)} | ${formatPctDelta(testSummary.ppc_cost, baselineSummary.ppc_cost)} |
| TACOS | ${formatPercent(baselineSummary.tacos)} | ${formatPercent(testSummary.tacos)} | — | — |`
    : '- Baseline/test comparison unavailable from current scope metadata.'
}
`;

  const evaluationSection = metadataOnly
    ? ''
    : `## Latest Evaluation
${
  latestEvaluation
    ? `- Evaluation ID: ${latestEvaluation.evaluation_id}
- Evaluated At: ${formatDateTime(latestEvaluation.evaluated_at)}
- Window: ${latestEvaluation.window_start ?? '—'} to ${latestEvaluation.window_end ?? '—'}
- Outcome Score: ${extractOutcomeScore(latestEvaluation.metrics_json) ?? '—'}
- Notes: ${latestEvaluation.notes ?? '—'}

\`\`\`json
${JSON.stringify(latestEvaluation.metrics_json ?? {}, null, 2)}
\`\`\``
    : '- No evaluation found.'
}
`;

  const content = `# Experiment Deep Dive Pack

## Experiment
- ID: ${experiment.experiment_id}
- Name: ${experiment.name}
- Objective: ${experiment.objective}
- Hypothesis: ${experiment.hypothesis ?? '—'}
- Status: ${status}
- Product ASIN: ${productAsin ?? '—'}
- Product Title: ${productTitle ?? '—'}
- Scope Start: ${startDate ?? '—'}
- Scope End: ${endDate ?? '—'}
- Created At: ${formatDateTime(experiment.created_at)}

## Scope JSON
\`\`\`json
${JSON.stringify(scope ?? {}, null, 2)}
\`\`\`

${warnings.length > 0 ? `## Warnings\n${warnings.map((line) => `- ${line}`).join('\n')}\n\n` : ''}${metadataOnly ? '## Metadata-Only Mode\n- Start/end dates are unavailable, so this pack includes only experiment metadata.\n\n' : ''}${linkedActionsSection}${kpiSection}${evaluationSection}
`;

  const filename = `${sanitizeFileSegment(experiment.name)}_${experiment.experiment_id}_deep_dive.md`;

  return new Response(content, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
