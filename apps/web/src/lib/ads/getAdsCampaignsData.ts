import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { aggregateCampaignRows, type CampaignAggregate } from './aggregateCampaigns';

type Channel = 'sp' | 'sb' | 'sd';

type AdsFilters = {
  accountId: string;
  marketplace: string;
  channel: Channel;
  start: string;
  end: string;
  asinFilter: string;
};

type CampaignRow = {
  date: string | null;
  campaign_id: string | null;
  campaign_name_raw?: string | null;
  impressions?: number | string | null;
  clicks?: number | string | null;
  spend?: number | string | null;
  sales?: number | string | null;
  orders?: number | string | null;
  units?: number | string | null;
};

const CHANNEL_TABLE: Record<Channel, string> = {
  sp: 'sp_campaign_hourly_fact_latest',
  sb: 'sb_campaign_daily_fact_latest',
  sd: 'sd_campaign_daily_fact_latest',
};

export const getAdsCampaignsData = async ({
  accountId,
  marketplace,
  channel,
  start,
  end,
  asinFilter,
}: AdsFilters) => {
  const table = CHANNEL_TABLE[channel];

  let query = supabaseAdmin
    .from(table)
    .select(
      'date,campaign_id,campaign_name_raw,impressions,clicks,spend,sales,orders,units'
    )
    .eq('account_id', accountId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (channel === 'sp') {
    query = query.order('start_time', { ascending: true });
  }

  const rows = await fetchAllRows<CampaignRow>((from, to) => query.range(from, to));

  const aggregated = aggregateCampaignRows(rows);

  return {
    rows: aggregated.rows as CampaignAggregate[],
    totals: aggregated.totals,
    notes: {
      asinFilterIgnored: asinFilter !== 'all',
      dataDelayNote: 'Ads reports can finalize with delay (48h+).',
      marketplaceIgnored: channel === 'sp' || channel === 'sb' || channel === 'sd',
      marketplace,
    },
  };
};
