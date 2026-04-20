import { loadV2OverviewPageState, type V2OverviewSearchParams } from '@/lib/v2/overview';
import V2OverviewPageView from './V2OverviewPageView';

type OverviewPageProps = {
  params: Promise<{
    asin: string;
  }>;
  searchParams: Promise<V2OverviewSearchParams>;
};

export default async function V2OverviewAsinPage({
  params,
  searchParams,
}: OverviewPageProps) {
  const { asin } = await params;
  const state = await loadV2OverviewPageState({
    asin,
    searchParams: await searchParams,
  });

  return <V2OverviewPageView state={state} />;
}
