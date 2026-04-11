import V2PlaceholderPage from '../../_components/V2PlaceholderPage';

type OverviewPageProps = {
  params: Promise<{
    asin: string;
  }>;
};

export default async function V2OverviewAsinPage({ params }: OverviewPageProps) {
  const { asin } = await params;

  return (
    <V2PlaceholderPage
      title={`V2 Overview Placeholder: ${asin}`}
      routePath={`/v2/overview/${asin}`}
      summary="This route reserves the ASIN-level V2 overview surface. It intentionally contains no Amazon connectors, marts, or live data yet."
    />
  );
}
