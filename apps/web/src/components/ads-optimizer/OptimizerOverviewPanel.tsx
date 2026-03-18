import type { AdsOptimizerOverviewData } from '@/lib/ads-optimizer/overview';
import OverviewConversionSection from './overview/OverviewConversionSection';
import OverviewEmptyState from './overview/OverviewEmptyState';
import OverviewHeaderSummary from './overview/OverviewHeaderSummary';
import OverviewKpiGrid from './overview/OverviewKpiGrid';
import OverviewNotesSection from './overview/OverviewNotesSection';
import OverviewRankingLadder from './overview/OverviewRankingLadder';
import OverviewTrafficSection from './overview/OverviewTrafficSection';

type OptimizerOverviewPanelProps = {
  asin: string;
  start: string;
  end: string;
  trendEnabled: boolean;
  data: AdsOptimizerOverviewData | null;
  returnTo: string;
  saveHeroQueryAction: (formData: FormData) => Promise<void>;
  resetHeroQueryAction: (formData: FormData) => Promise<void>;
};

export default function OptimizerOverviewPanel(props: OptimizerOverviewPanelProps) {
  if (!props.data) {
    return <OverviewEmptyState start={props.start} end={props.end} />;
  }

  return (
    <div className="space-y-4">
      <OverviewHeaderSummary
        data={props.data}
        start={props.start}
        end={props.end}
        trendEnabled={props.trendEnabled}
      />
      <OverviewKpiGrid data={props.data} />
      <OverviewRankingLadder
        data={props.data}
        returnTo={props.returnTo}
        saveHeroQueryAction={props.saveHeroQueryAction}
        resetHeroQueryAction={props.resetHeroQueryAction}
      />
      <OverviewTrafficSection data={props.data} />
      <OverviewConversionSection data={props.data} />
      <OverviewNotesSection data={props.data} />
    </div>
  );
}
