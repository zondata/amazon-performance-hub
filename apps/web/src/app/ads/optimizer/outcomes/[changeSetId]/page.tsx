import { notFound } from 'next/navigation';
import Link from 'next/link';

import OptimizerOutcomeReviewDetail from '@/components/ads-optimizer/OptimizerOutcomeReviewDetail';
import { isAdsOptimizerEnabled } from '@/lib/ads-optimizer/featureFlag';
import { getAdsOptimizerOutcomeReviewDetailData } from '@/lib/ads-optimizer/outcomeReview';
import {
  normalizeAdsOptimizerOutcomeHorizon,
  normalizeAdsOptimizerOutcomeMetric,
} from '@/lib/ads-optimizer/shell';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDate = (value?: string): string | undefined => {
  if (!value || !DATE_RE.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10) === value ? value : undefined;
};

type AdsOptimizerOutcomeReviewDetailPageProps = {
  params: Promise<{ changeSetId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdsOptimizerOutcomeReviewDetailPage(
  props: AdsOptimizerOutcomeReviewDetailPageProps
) {
  if (!isAdsOptimizerEnabled()) {
    notFound();
  }

  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams ?? Promise.resolve(undefined),
  ]);
  const paramValue = (key: string): string | undefined => {
    const raw = searchParams?.[key];
    if (!raw) return undefined;
    return Array.isArray(raw) ? raw[0] : raw;
  };

  const horizon = normalizeAdsOptimizerOutcomeHorizon(paramValue('horizon'));
  const metric = normalizeAdsOptimizerOutcomeMetric(paramValue('metric'));
  const detail = await getAdsOptimizerOutcomeReviewDetailData({
    changeSetId: params.changeSetId,
    horizon,
    selectedEndDate: normalizeDate(paramValue('end')),
    selectedStartDate: normalizeDate(paramValue('start')),
    metric,
  });

  if (!detail) {
    notFound();
  }

  if (detail.kind === 'not_optimizer') {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Outcome review detail</div>
          <div className="mt-2 text-xl font-semibold text-foreground">
            This change set is not optimizer-originated.
          </div>
          <div className="mt-2 max-w-3xl text-sm text-muted">
            Outcome Review detail only supports Ads Workspace change sets created from the optimizer
            handoff lineage. This change set reports source{' '}
            <span className="font-semibold text-foreground">{detail.source ?? 'Not captured'}</span>.
          </div>
          <Link href={detail.returnHref} className="mt-4 inline-flex text-sm font-semibold text-primary underline">
            Back to outcome review
          </Link>
        </section>
      </div>
    );
  }

  return <OptimizerOutcomeReviewDetail data={detail} />;
}
