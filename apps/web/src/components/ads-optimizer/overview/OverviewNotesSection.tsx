import type { AdsOptimizerOverviewData } from '@/lib/ads-optimizer/overview';
import {
  OverviewCoverageCard,
  OverviewNoteItem,
  formatSqpWeekEndingLabel,
  overviewSectionClassName,
} from './overviewShared';

type OverviewNotesSectionProps = {
  data: AdsOptimizerOverviewData;
};

export default function OverviewNotesSection(props: OverviewNotesSectionProps) {
  const { data } = props;

  return (
    <section className={overviewSectionClassName}>
      <div className="text-xs uppercase tracking-[0.3em] text-muted">Notes / coverage / warnings</div>
      <div className="mt-1.5 text-lg font-semibold text-foreground">Operator notes</div>

      <div className="mt-3 grid gap-3 xl:grid-cols-4">
        <OverviewCoverageCard
          label="Ranking coverage"
          status={data.visibility.rankingCoverage.status}
          headline={`${data.visibility.rankingCoverage.trackedKeywords.toLocaleString('en-US')} tracked keyword(s)`}
          detail={data.visibility.rankingCoverage.detail}
        />
        <OverviewCoverageCard
          label="Traffic coverage"
          status={data.traffic?.coverage.status ?? 'missing'}
          headline={data.traffic?.coverage.status ?? 'missing'}
          detail={
            data.traffic?.coverage.detail ??
            'Traffic coverage could not be resolved for the selected ASIN and date window.'
          }
        />
        <OverviewCoverageCard
          label="Conversion coverage"
          status={data.conversion?.coverage.status ?? 'missing'}
          headline={data.conversion?.coverage.status ?? 'missing'}
          detail={
            data.conversion?.coverage.detail ??
            'Conversion coverage could not be resolved for the selected ASIN and date window.'
          }
        />
        <OverviewCoverageCard
          label="SQP week coverage"
          status={data.visibility.sqpCoverage.status}
          headline={formatSqpWeekEndingLabel(data.visibility.sqpCoverage.selectedWeekEnd)}
          detail={data.visibility.sqpCoverage.detail}
        />
      </div>

      {data.coverageNotes && data.coverageNotes.length > 0 ? (
        <div className="mt-4">
          <div className="text-sm font-semibold text-foreground">Coverage notes</div>
          <ul className="mt-2.5 space-y-2.5">
            {data.coverageNotes.map((note) => (
              <OverviewNoteItem key={`${note.source}-${note.message}`} note={note} />
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3.5 text-sm text-emerald-800">
          Required Phase 3 inputs were available for this ASIN without any explicit coverage gaps.
        </div>
      )}

      {data.warnings.length > 0 ? (
        <div className="mt-4">
          <div className="text-sm font-semibold text-foreground">Warnings</div>
          <ul className="mt-2.5 space-y-2.5">
            {data.warnings.map((warning) => (
              <li
                key={warning}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800"
              >
                {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
