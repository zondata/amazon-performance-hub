import type {
  AdsOptimizerCoverageStatus,
  AdsOptimizerOverviewCoverageNote,
  AdsOptimizerOverviewData,
  AdsOptimizerOverviewDeltaEvaluation,
} from '@/lib/ads-optimizer/overview';
import { getIsoWeekYear } from '@/lib/sqp/formatSqpWeekLabel';
import { formatUiDateRange } from '@/lib/time/formatUiDate';

export const overviewSectionClassName =
  'rounded-2xl border border-border bg-surface/80 p-4 shadow-sm';

type VisibilityStatus = AdsOptimizerOverviewData['visibility']['rankingCoverage']['status'];

export const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
};

export const formatSignedCurrency = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (value === 0) return '$0';
  return `${value > 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}`;
};

export const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US');
};

export const formatSignedCount = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  return `${value > 0 ? '+' : ''}${value.toLocaleString('en-US')}`;
};

export const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

export const formatSignedPercentPoints = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (value === 0) return '0.0 pts';
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)} pts`;
};

export const formatSignedPercentChange = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (value === 0) return '0.0%';
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
};

export const formatSqpWeekEndingLabel = (weekEnd?: string | null) => {
  if (!weekEnd) return 'No SQP week available';
  const { week } = getIsoWeekYear(weekEnd);
  return week > 0 ? `Week ${week} ending ${weekEnd}` : `Week ending ${weekEnd}`;
};

export const coverageBadgeClass = (status: VisibilityStatus) => {
  if (status === 'ready') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'partial') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-border bg-surface-2 text-muted';
};

export const coveragePanelClass = (status: AdsOptimizerCoverageStatus) => {
  if (status === 'ready') return 'border-emerald-200 bg-emerald-50/70';
  if (status === 'partial') return 'border-amber-200 bg-amber-50/70';
  return 'border-rose-200 bg-rose-50/70';
};

export const coverageTextClass = (status: AdsOptimizerCoverageStatus) => {
  if (status === 'ready') return 'text-emerald-900';
  if (status === 'partial') return 'text-amber-900';
  return 'text-rose-900';
};

export const stateBadgeClass = (state: AdsOptimizerOverviewData['state']['value']) => {
  if (state === 'profitable') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (state === 'break_even') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (state === 'loss') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-border bg-surface-2 text-muted';
};

export const objectiveBadgeClass = (objective: AdsOptimizerOverviewData['objective']['value']) => {
  if (objective === 'Scale Profit' || objective === 'Harvest Profit') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (objective === 'Rank Growth' || objective === 'Rank Defense') {
    return 'border-sky-200 bg-sky-50 text-sky-800';
  }
  if (objective === 'Break Even') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  return 'border-border bg-surface-2 text-muted';
};

export const noteItemClass = (status: AdsOptimizerCoverageStatus) => {
  if (status === 'missing') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (status === 'partial') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-emerald-200 bg-emerald-50 text-emerald-800';
};

const metricCardToneClass = (evaluation?: AdsOptimizerOverviewDeltaEvaluation) => {
  if (evaluation === 'better') return 'border-emerald-200 bg-emerald-50/75';
  if (evaluation === 'worse') return 'border-rose-200 bg-rose-50/75';
  if (evaluation === 'flat') return 'border-slate-200 bg-slate-50/75';
  return 'border-border bg-surface';
};

const metricBadgeClass = (evaluation?: AdsOptimizerOverviewDeltaEvaluation) => {
  if (evaluation === 'better') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (evaluation === 'worse') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (evaluation === 'flat') return 'border-border bg-surface-2 text-muted';
  return 'border-sky-200 bg-sky-50 text-sky-800';
};

const metricBadgeLabel = (evaluation?: AdsOptimizerOverviewDeltaEvaluation) => {
  if (evaluation === 'better') return 'Improving';
  if (evaluation === 'worse') return 'Watch';
  if (evaluation === 'flat') return 'Flat';
  return 'Context';
};

const comparisonValueClass = (label: 'current' | 'previous' | 'delta') => {
  if (label === 'current') return 'text-foreground';
  if (label === 'delta') return 'text-foreground';
  return 'text-muted';
};

export const CoverageStatusBadge = (props: { status: AdsOptimizerCoverageStatus }) => (
  <span
    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${coverageBadgeClass(
      props.status
    )}`}
  >
    {props.status}
  </span>
);

export const OverviewInfoCard = (props: {
  label: string;
  value: string;
  detail?: string;
  valueClassName?: string;
}) => (
  <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
      {props.label}
    </div>
    <div className={`mt-1.5 text-base font-semibold ${props.valueClassName ?? 'text-foreground'}`}>
      {props.value}
    </div>
    {props.detail ? <div className="mt-1 text-sm text-muted">{props.detail}</div> : null}
  </div>
);

export const OverviewCoverageCard = (props: {
  label: string;
  status: AdsOptimizerCoverageStatus;
  headline: string;
  detail: string;
}) => (
  <div className={`rounded-xl border px-3.5 py-3.5 ${coveragePanelClass(props.status)}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
        {props.label}
      </div>
      <CoverageStatusBadge status={props.status} />
    </div>
    <div className={`mt-2.5 text-base font-semibold ${coverageTextClass(props.status)}`}>
      {props.headline}
    </div>
    <div className={`mt-1.5 text-sm ${coverageTextClass(props.status)}`}>{props.detail}</div>
  </div>
);

export const OverviewMetricCard = (props: {
  label: string;
  current: number | null | undefined;
  previous: number | null | undefined;
  delta: number | null | undefined;
  deltaPct?: number | null | undefined;
  formatter: (value?: number | null) => string;
  deltaFormatter: (value?: number | null) => string;
  evaluation?: AdsOptimizerOverviewDeltaEvaluation;
  detail?: string;
  eyebrow?: string;
}) => {
  const hasPrevious = props.previous !== null && props.previous !== undefined;
  const hasDelta = props.delta !== null && props.delta !== undefined;

  return (
    <div
      className={`rounded-xl border px-4 py-4 shadow-sm ${metricCardToneClass(props.evaluation)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {props.eyebrow ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
              {props.eyebrow}
            </div>
          ) : null}
          <div className="text-sm font-semibold text-foreground">{props.label}</div>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${metricBadgeClass(
            props.evaluation
          )}`}
        >
          {metricBadgeLabel(props.evaluation)}
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {props.formatter(props.current)}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-border bg-surface/85 p-2.5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Current</div>
          <div className={`mt-1 text-sm font-semibold ${comparisonValueClass('current')}`}>
            {props.formatter(props.current)}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Previous</div>
          <div className={`mt-1 text-sm font-semibold ${comparisonValueClass('previous')}`}>
            {hasPrevious ? props.formatter(props.previous) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Delta</div>
          <div className={`mt-1 text-sm font-semibold ${comparisonValueClass('delta')}`}>
            {hasDelta ? props.deltaFormatter(props.delta) : '—'}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {hasDelta && props.deltaPct !== null && props.deltaPct !== undefined
              ? formatSignedPercentChange(props.deltaPct)
              : 'vs equal-length prior'}
          </div>
        </div>
      </div>
      <div className="mt-2.5 text-sm text-muted">
        {props.detail ??
          `${props.label} compares the current window to the equal-length previous period.`}
      </div>
    </div>
  );
};

export const OverviewNoteItem = (props: { note: AdsOptimizerOverviewCoverageNote }) => (
  <li className={`rounded-lg border px-4 py-3 text-sm ${noteItemClass(props.note.status)}`}>
    <span className="font-semibold uppercase tracking-wide">{props.note.source}</span> ·{' '}
    {props.note.message}
  </li>
);

export const buildWindowSummary = (
  data: AdsOptimizerOverviewData | null,
  start: string,
  end: string
) =>
  data?.window
    ? {
        currentRange: formatUiDateRange(data.window.current.start, data.window.current.end),
        currentDays: data.window.current.days,
        previousRange: formatUiDateRange(data.window.previous.start, data.window.previous.end),
        previousDays: data.window.previous.days,
      }
    : {
        currentRange: formatUiDateRange(start, end),
        currentDays: null,
        previousRange: '—',
        previousDays: null,
      };
