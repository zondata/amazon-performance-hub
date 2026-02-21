import { computeExperimentKpis } from '@/lib/logbook/computeExperimentKpis';
import { getExperimentContext } from '@/lib/logbook/getExperimentContext';

export const dynamic = 'force-dynamic';

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString();
};

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
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

  let context;
  try {
    context = await getExperimentContext(experimentId);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Failed to load experiment.', {
      status: 500,
    });
  }

  const warnings: string[] = [];
  let kpisBlock = '- KPI comparison unavailable.';

  if (!context.product_asin) {
    warnings.push('scope.product_id is missing, so KPI comparison is unavailable.');
  }

  if (!context.date_window.startDate || !context.date_window.endDate) {
    warnings.push('Experiment date window is missing; add scope.start_date/end_date or link dated changes.');
  }

  if (context.product_asin && context.date_window.startDate && context.date_window.endDate) {
    try {
      const kpis = await computeExperimentKpis({
        accountId: context.experiment.account_id ?? '',
        marketplace: context.experiment.marketplace ?? '',
        asin: context.product_asin,
        startDate: context.date_window.startDate,
        endDate: context.date_window.endDate,
        lagDays: context.experiment.evaluation_lag_days ?? 0,
      });

      kpisBlock = `- Baseline: ${kpis.windows.baseline.startDate} → ${kpis.windows.baseline.endDate}
- Test: ${kpis.windows.test.startDate} → ${kpis.windows.test.endDate} (lag ${kpis.lagDays} days)

| KPI | Baseline | Test | Delta | Delta % |
|---|---:|---:|---:|---:|
| Sales | ${formatCurrency(kpis.baseline.totals.sales)} | ${formatCurrency(kpis.test.totals.sales)} | ${formatCurrency(kpis.delta.totals.absolute.sales)} | ${formatPercent(kpis.delta.totals.percent.sales)} |
| Orders | ${formatNumber(kpis.baseline.totals.orders)} | ${formatNumber(kpis.test.totals.orders)} | ${formatNumber(kpis.delta.totals.absolute.orders)} | ${formatPercent(kpis.delta.totals.percent.orders)} |
| Units | ${formatNumber(kpis.baseline.totals.units)} | ${formatNumber(kpis.test.totals.units)} | ${formatNumber(kpis.delta.totals.absolute.units)} | ${formatPercent(kpis.delta.totals.percent.units)} |
| Sessions | ${formatNumber(kpis.baseline.totals.sessions)} | ${formatNumber(kpis.test.totals.sessions)} | ${formatNumber(kpis.delta.totals.absolute.sessions)} | ${formatPercent(kpis.delta.totals.percent.sessions)} |
| Conversions | ${formatNumber(kpis.baseline.totals.conversions)} | ${formatNumber(kpis.test.totals.conversions)} | ${formatNumber(kpis.delta.totals.absolute.conversions)} | ${formatPercent(kpis.delta.totals.percent.conversions)} |
| PPC Cost | ${formatCurrency(kpis.baseline.totals.ppc_cost)} | ${formatCurrency(kpis.test.totals.ppc_cost)} | ${formatCurrency(kpis.delta.totals.absolute.ppc_cost)} | ${formatPercent(kpis.delta.totals.percent.ppc_cost)} |
| TACOS (avg) | ${formatPercent(kpis.baseline.averages.tacos)} | ${formatPercent(kpis.test.averages.tacos)} | ${formatNumber(kpis.delta.averages.absolute.tacos)} | ${formatPercent(kpis.delta.averages.percent.tacos)} |
| Profits | ${formatCurrency(kpis.baseline.totals.profits)} | ${formatCurrency(kpis.test.totals.profits)} | ${formatCurrency(kpis.delta.totals.absolute.profits)} | ${formatPercent(kpis.delta.totals.percent.profits)} |
| ROI (avg) | ${formatNumber(kpis.baseline.averages.roi)} | ${formatNumber(kpis.test.averages.roi)} | ${formatNumber(kpis.delta.averages.absolute.roi)} | ${formatPercent(kpis.delta.averages.percent.roi)} |
| Margin (avg) | ${formatPercent(kpis.baseline.averages.margin)} | ${formatPercent(kpis.test.averages.margin)} | ${formatNumber(kpis.delta.averages.absolute.margin)} | ${formatPercent(kpis.delta.averages.percent.margin)} |`;
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Failed to compute KPI windows.');
    }
  }

  const definitionBlock = `## Experiment Definition
- ID: ${context.experiment.experiment_id}
- Name: ${context.experiment.name}
- Objective: ${context.experiment.objective}
- Hypothesis: ${context.experiment.hypothesis ?? '—'}
- Primary metrics: ${JSON.stringify(context.experiment.primary_metrics ?? {}, null, 0)}
- Guardrails: ${JSON.stringify(context.experiment.guardrails ?? {}, null, 0)}
- Expected outcome: ${context.expected_outcome ?? '—'}`;

  const scopeBlock = `## Scope (Human Summary)
- Status: ${context.status}
- Product ASIN: ${context.product_asin ?? '—'}
- Window: ${context.date_window.startDate ?? '—'} → ${context.date_window.endDate ?? '—'} (${context.date_window.source})
- Evaluation lag: ${context.experiment.evaluation_lag_days ?? 0} days
- Evaluation window target: ${context.experiment.evaluation_window_days ?? '—'} days
- Outcome summary: ${context.outcome_summary ?? '—'}`;

  const planBlock = `## SP/SB Plan Summary
- SP plans: ${context.plan_summary.sp.plan_count} (actions: ${context.plan_summary.sp.action_count})
- SP highlights: ${context.plan_summary.sp.highlights.length > 0 ? context.plan_summary.sp.highlights.join(', ') : '—'}
- SB plans: ${context.plan_summary.sb.plan_count} (actions: ${context.plan_summary.sb.action_count})
- SB highlights: ${context.plan_summary.sb.highlights.length > 0 ? context.plan_summary.sb.highlights.join(', ') : '—'}`;

  const runBlock = `## Linked Changes By run_id
${
  context.run_groups.length === 0
    ? '- No linked changes.'
    : context.run_groups
        .map((group) => {
          const summary = group.validation_summary;
          const changes = group.changes
            .map(
              (change) =>
                `  - ${formatDateTime(change.occurred_at)} | ${change.channel}/${change.change_type} | ${change.summary} | validation=${change.validation_status}`
            )
            .join('\n');

          return `- run_id=${group.run_id}
  - validation: validated=${summary.validated}, mismatch=${summary.mismatch}, pending=${summary.pending}, not_found=${summary.not_found}
${changes}`;
        })
        .join('\n')
}`;

  const kpiSection = `## KPI Baseline vs Test
${kpisBlock}`;

  const instructions = `## Instructions To AI
- Do not invent IDs.
- Propose next actions grounded in the listed evidence.
- Call out missing data and assumptions explicitly before recommendations.`;

  const appendix = `## Raw JSON Appendix
\`\`\`json
${JSON.stringify(context.scope ?? {}, null, 2)}
\`\`\`
`;

  const content = `# Experiment AI Deep Dive Pack

${definitionBlock}

${scopeBlock}

${planBlock}

${runBlock}

## Validation Totals
- validated=${context.validation_summary.validated}
- mismatch=${context.validation_summary.mismatch}
- pending=${context.validation_summary.pending}
- not_found=${context.validation_summary.not_found}

${kpiSection}

${instructions}

${warnings.length > 0 ? `## Warnings\n${warnings.map((line) => `- ${line}`).join('\n')}\n\n` : ''}${appendix}`;

  const filename = `${sanitizeFileSegment(context.experiment.name)}_${context.experiment.experiment_id}_ai_deep_dive.md`;

  return new Response(content, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
