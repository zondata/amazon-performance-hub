import {
  BulkLookup,
  MappingIssue,
  createIssueCollector,
  inferIsNegative,
  resolveCampaignId,
  resolveAdGroupId,
  resolveTargetId,
} from "./core";

export type SpCampaignRawRow = {
  date: string;
  start_time: string | null;
  portfolio_name_raw: string | null;
  portfolio_name_norm: string | null;
  campaign_name_raw: string;
  campaign_name_norm: string;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  sales: number | null;
  orders: number | null;
  units: number | null;
};

export type SpCampaignFactRow = SpCampaignRawRow & {
  upload_id: string;
  account_id: string;
  campaign_id: string;
  portfolio_id: string | null;
  exported_at: string;
};

export type SpPlacementRawRow = {
  date: string;
  portfolio_name_raw: string | null;
  portfolio_name_norm: string | null;
  campaign_name_raw: string;
  campaign_name_norm: string;
  bidding_strategy: string | null;
  placement_raw: string;
  placement_raw_norm: string;
  placement_code: string;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  sales: number | null;
  orders: number | null;
  units: number | null;
  cpc: number | null;
  ctr: number | null;
  acos: number | null;
  roas: number | null;
};

export type SpPlacementFactRow = SpPlacementRawRow & {
  upload_id: string;
  account_id: string;
  campaign_id: string;
  exported_at: string;
};

export type SpTargetingRawRow = {
  date: string;
  portfolio_name_raw: string | null;
  portfolio_name_norm: string | null;
  campaign_name_raw: string;
  campaign_name_norm: string;
  ad_group_name_raw: string;
  ad_group_name_norm: string;
  targeting_raw: string;
  targeting_norm: string;
  match_type_raw: string | null;
  match_type_norm: string | null;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  sales: number | null;
  orders: number | null;
  units: number | null;
  cpc: number | null;
  ctr: number | null;
  acos: number | null;
  roas: number | null;
  conversion_rate: number | null;
  top_of_search_impression_share: number | null;
};

export type SpTargetingFactRow = SpTargetingRawRow & {
  upload_id: string;
  account_id: string;
  campaign_id: string;
  ad_group_id: string;
  target_id: string;
  exported_at: string;
};

export type SpStisRawRow = {
  date: string;
  portfolio_name_raw: string | null;
  portfolio_name_norm: string | null;
  campaign_name_raw: string;
  campaign_name_norm: string;
  ad_group_name_raw: string;
  ad_group_name_norm: string;
  targeting_raw: string;
  targeting_norm: string;
  match_type_raw: string | null;
  match_type_norm: string | null;
  customer_search_term_raw: string;
  customer_search_term_norm: string;
  search_term_impression_rank: number | null;
  search_term_impression_share: number | null;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  sales: number | null;
  orders: number | null;
  units: number | null;
  cpc: number | null;
  ctr: number | null;
  acos: number | null;
  roas: number | null;
  conversion_rate: number | null;
};

export type SpStisDailyFactRow = SpStisRawRow & {
  upload_id: string;
  account_id: string;
  campaign_id: string;
  ad_group_id: string;
  // target_id may be null when customer_search_term_norm is present (search-term rows).
  target_id: string | null;
  target_key: string;
  exported_at: string;
};
export type SpStisFactRow = SpStisDailyFactRow;

function issueKeyBase(row: { campaign_name_norm: string; portfolio_name_norm?: string | null }) {
  return {
    campaign_name_norm: row.campaign_name_norm,
    portfolio_name_norm: row.portfolio_name_norm ?? null,
  };
}

type PendingIssue = Omit<MappingIssue, "row_count"> & { row_count?: number };

export function mapSpCampaignRows(params: {
  rows: SpCampaignRawRow[];
  lookup: BulkLookup;
  uploadId: string;
  accountId: string;
  exportedAt: string;
  referenceDate: string;
}): { facts: SpCampaignFactRow[]; issues: MappingIssue[] } {
  const { rows, lookup, uploadId, accountId, exportedAt, referenceDate } = params;
  const facts: SpCampaignFactRow[] = [];
  const collector = createIssueCollector();
  const resolvedCampaignKeys = new Set<string>();
  const pendingCampaignIssues: { key: string; issue: PendingIssue }[] = [];

  for (const row of rows) {
    const campaignKey = JSON.stringify(issueKeyBase(row));
    const campaignResult = resolveCampaignId({
      campaignNameNorm: row.campaign_name_norm,
      portfolioNameNorm: row.portfolio_name_norm,
      referenceDate,
      lookup,
    });

    if (campaignResult.status !== "ok") {
      pendingCampaignIssues.push({
        key: campaignKey,
        issue: {
          entity_level: "campaign",
          issue_type: campaignResult.status === "ambiguous" ? "ambiguous" : "unmapped",
          key_json: issueKeyBase(row),
          candidates_json: campaignResult.status === "ambiguous" ? campaignResult.candidates : null,
        },
      });
      continue;
    }

    resolvedCampaignKeys.add(campaignKey);
    const campaignInfo = lookup.campaignById.get(campaignResult.id) ?? null;
    facts.push({
      upload_id: uploadId,
      account_id: accountId,
      date: row.date,
      start_time: row.start_time ?? null,
      portfolio_name_raw: row.portfolio_name_raw,
      portfolio_name_norm: row.portfolio_name_norm,
      campaign_name_raw: row.campaign_name_raw,
      campaign_name_norm: row.campaign_name_norm,
      impressions: row.impressions,
      clicks: row.clicks,
      spend: row.spend,
      sales: row.sales,
      orders: row.orders,
      units: row.units,
      campaign_id: campaignResult.id,
      portfolio_id: campaignInfo?.portfolio_id ?? null,
      exported_at: exportedAt,
    });
  }

  for (const pending of pendingCampaignIssues) {
    if (resolvedCampaignKeys.has(pending.key)) continue;
    collector.addIssue(pending.issue);
  }

  return { facts, issues: collector.list() };
}

export function mapSpPlacementRows(params: {
  rows: SpPlacementRawRow[];
  lookup: BulkLookup;
  uploadId: string;
  accountId: string;
  exportedAt: string;
  referenceDate: string;
}): { facts: SpPlacementFactRow[]; issues: MappingIssue[] } {
  const { rows, lookup, uploadId, accountId, exportedAt, referenceDate } = params;
  const facts: SpPlacementFactRow[] = [];
  const collector = createIssueCollector();
  const resolvedCampaignKeys = new Set<string>();
  const pendingCampaignIssues: { key: string; issue: PendingIssue }[] = [];

  for (const row of rows) {
    const campaignKey = JSON.stringify(issueKeyBase(row));
    const campaignResult = resolveCampaignId({
      campaignNameNorm: row.campaign_name_norm,
      portfolioNameNorm: row.portfolio_name_norm,
      referenceDate,
      lookup,
    });

    if (campaignResult.status !== "ok") {
      pendingCampaignIssues.push({
        key: campaignKey,
        issue: {
          entity_level: "campaign",
          issue_type: campaignResult.status === "ambiguous" ? "ambiguous" : "unmapped",
          key_json: issueKeyBase(row),
          candidates_json: campaignResult.status === "ambiguous" ? campaignResult.candidates : null,
        },
      });
      continue;
    }

    resolvedCampaignKeys.add(campaignKey);
    facts.push({
      upload_id: uploadId,
      account_id: accountId,
      date: row.date,
      portfolio_name_raw: row.portfolio_name_raw,
      portfolio_name_norm: row.portfolio_name_norm,
      campaign_name_raw: row.campaign_name_raw,
      campaign_name_norm: row.campaign_name_norm,
      bidding_strategy: row.bidding_strategy,
      placement_raw: row.placement_raw,
      placement_raw_norm: row.placement_raw_norm,
      placement_code: row.placement_code,
      impressions: row.impressions,
      clicks: row.clicks,
      spend: row.spend,
      sales: row.sales,
      orders: row.orders,
      units: row.units,
      cpc: row.cpc,
      ctr: row.ctr,
      acos: row.acos,
      roas: row.roas,
      campaign_id: campaignResult.id,
      exported_at: exportedAt,
    });
  }

  for (const pending of pendingCampaignIssues) {
    if (resolvedCampaignKeys.has(pending.key)) continue;
    collector.addIssue(pending.issue);
  }

  return { facts, issues: collector.list() };
}

export function mapSpTargetingRows(params: {
  rows: SpTargetingRawRow[];
  lookup: BulkLookup;
  uploadId: string;
  accountId: string;
  exportedAt: string;
  referenceDate: string;
}): { facts: SpTargetingFactRow[]; issues: MappingIssue[] } {
  const { rows, lookup, uploadId, accountId, exportedAt, referenceDate } = params;
  const facts: SpTargetingFactRow[] = [];
  const collector = createIssueCollector();
  const resolvedCampaignKeys = new Set<string>();
  const resolvedAdGroupKeys = new Set<string>();
  const resolvedTargetKeys = new Set<string>();
  const pendingCampaignIssues: { key: string; issue: PendingIssue }[] = [];
  const pendingAdGroupIssues: { key: string; issue: PendingIssue }[] = [];
  const pendingTargetIssues: { key: string; issue: PendingIssue }[] = [];

  for (const row of rows) {
    const campaignKey = JSON.stringify(issueKeyBase(row));
    const campaignResult = resolveCampaignId({
      campaignNameNorm: row.campaign_name_norm,
      portfolioNameNorm: row.portfolio_name_norm,
      referenceDate,
      lookup,
    });

    if (campaignResult.status !== "ok") {
      pendingCampaignIssues.push({
        key: campaignKey,
        issue: {
          entity_level: "campaign",
          issue_type: campaignResult.status === "ambiguous" ? "ambiguous" : "unmapped",
          key_json: issueKeyBase(row),
          candidates_json: campaignResult.status === "ambiguous" ? campaignResult.candidates : null,
        },
      });
      continue;
    }

    resolvedCampaignKeys.add(campaignKey);
    const adGroupKeyObj = {
      ...issueKeyBase(row),
      ad_group_name_norm: row.ad_group_name_norm,
    };
    const adGroupKey = JSON.stringify(adGroupKeyObj);
    const adGroupResult = resolveAdGroupId({
      campaignId: campaignResult.id,
      adGroupNameNorm: row.ad_group_name_norm,
      referenceDate,
      lookup,
    });

    if (adGroupResult.status !== "ok") {
      pendingAdGroupIssues.push({
        key: adGroupKey,
        issue: {
          entity_level: "ad_group",
          issue_type: adGroupResult.status === "ambiguous" ? "ambiguous" : "unmapped",
          key_json: adGroupKeyObj,
          candidates_json: adGroupResult.status === "ambiguous" ? adGroupResult.candidates : null,
        },
      });
      continue;
    }

    resolvedAdGroupKeys.add(adGroupKey);
    const targetResult = resolveTargetId({
      adGroupId: adGroupResult.id,
      expressionNorm: row.targeting_norm,
      matchTypeNorm: row.match_type_norm,
      matchTypeRaw: row.match_type_raw,
      isNegative: inferIsNegative(row.match_type_raw),
      referenceDate,
      lookup,
    });

    if (targetResult.status !== "ok") {
      const targetKeyObj = {
        ...issueKeyBase(row),
        ad_group_name_norm: row.ad_group_name_norm,
        targeting_norm: row.targeting_norm,
        match_type_norm: row.match_type_norm,
        is_negative: inferIsNegative(row.match_type_raw),
      };
      const targetKey = JSON.stringify(targetKeyObj);
      pendingTargetIssues.push({
        key: targetKey,
        issue: {
          entity_level: "target",
          issue_type: targetResult.status === "ambiguous" ? "ambiguous" : "unmapped",
          key_json: targetKeyObj,
          candidates_json: targetResult.status === "ambiguous" ? targetResult.candidates : null,
        },
      });
      continue;
    }

    const targetKey = JSON.stringify({
      ...issueKeyBase(row),
      ad_group_name_norm: row.ad_group_name_norm,
      targeting_norm: row.targeting_norm,
      match_type_norm: row.match_type_norm,
      is_negative: inferIsNegative(row.match_type_raw),
    });
    resolvedTargetKeys.add(targetKey);
    facts.push({
      upload_id: uploadId,
      account_id: accountId,
      date: row.date,
      portfolio_name_raw: row.portfolio_name_raw,
      portfolio_name_norm: row.portfolio_name_norm,
      campaign_name_raw: row.campaign_name_raw,
      campaign_name_norm: row.campaign_name_norm,
      ad_group_name_raw: row.ad_group_name_raw,
      ad_group_name_norm: row.ad_group_name_norm,
      targeting_raw: row.targeting_raw,
      targeting_norm: row.targeting_norm,
      match_type_raw: row.match_type_raw,
      match_type_norm: row.match_type_norm,
      impressions: row.impressions,
      clicks: row.clicks,
      spend: row.spend,
      sales: row.sales,
      orders: row.orders,
      units: row.units,
      cpc: row.cpc,
      ctr: row.ctr,
      acos: row.acos,
      roas: row.roas,
      conversion_rate: row.conversion_rate,
      top_of_search_impression_share: row.top_of_search_impression_share,
      campaign_id: campaignResult.id,
      ad_group_id: adGroupResult.id,
      target_id: targetResult.id,
      exported_at: exportedAt,
    });
  }

  for (const pending of pendingCampaignIssues) {
    if (resolvedCampaignKeys.has(pending.key)) continue;
    collector.addIssue(pending.issue);
  }
  for (const pending of pendingAdGroupIssues) {
    if (resolvedAdGroupKeys.has(pending.key)) continue;
    collector.addIssue(pending.issue);
  }
  for (const pending of pendingTargetIssues) {
    if (resolvedTargetKeys.has(pending.key)) continue;
    collector.addIssue(pending.issue);
  }

  return { facts, issues: collector.list() };
}

export function mapSpStisRows(params: {
  rows: SpStisRawRow[];
  lookup: BulkLookup;
  uploadId: string;
  accountId: string;
  exportedAt: string;
  referenceDate: string;
}): { facts: SpStisFactRow[]; issues: MappingIssue[] } {
  const { rows, lookup, uploadId, accountId, exportedAt, referenceDate } = params;
  const facts: SpStisFactRow[] = [];
  const collector = createIssueCollector();
  const resolvedCampaignKeys = new Set<string>();
  const resolvedAdGroupKeys = new Set<string>();
  const resolvedTargetKeys = new Set<string>();
  const pendingCampaignIssues: { key: string; issue: PendingIssue }[] = [];
  const pendingAdGroupIssues: { key: string; issue: PendingIssue }[] = [];
  const pendingTargetIssues: { key: string; issue: PendingIssue }[] = [];

  for (const row of rows) {
    const campaignKey = JSON.stringify(issueKeyBase(row));
    const campaignResult = resolveCampaignId({
      campaignNameNorm: row.campaign_name_norm,
      portfolioNameNorm: row.portfolio_name_norm,
      referenceDate,
      lookup,
    });

    if (campaignResult.status !== "ok") {
      pendingCampaignIssues.push({
        key: campaignKey,
        issue: {
          entity_level: "campaign",
          issue_type: campaignResult.status === "ambiguous" ? "ambiguous" : "unmapped",
          key_json: issueKeyBase(row),
          candidates_json: campaignResult.status === "ambiguous" ? campaignResult.candidates : null,
        },
      });
      continue;
    }

    resolvedCampaignKeys.add(campaignKey);
    const adGroupKeyObj = {
      ...issueKeyBase(row),
      ad_group_name_norm: row.ad_group_name_norm,
    };
    const adGroupKey = JSON.stringify(adGroupKeyObj);
    const adGroupResult = resolveAdGroupId({
      campaignId: campaignResult.id,
      adGroupNameNorm: row.ad_group_name_norm,
      referenceDate,
      lookup,
    });

    if (adGroupResult.status !== "ok") {
      pendingAdGroupIssues.push({
        key: adGroupKey,
        issue: {
          entity_level: "ad_group",
          issue_type: adGroupResult.status === "ambiguous" ? "ambiguous" : "unmapped",
          key_json: adGroupKeyObj,
          candidates_json: adGroupResult.status === "ambiguous" ? adGroupResult.candidates : null,
        },
      });
      continue;
    }

    resolvedAdGroupKeys.add(adGroupKey);
    const targetingNorm = row.targeting_norm.trim();
    const isSearchTermRow =
      !!row.customer_search_term_norm && row.customer_search_term_norm.trim() !== "";
    const targetKeySignature = JSON.stringify({
      ...issueKeyBase(row),
      ad_group_name_norm: row.ad_group_name_norm,
      targeting_norm: row.targeting_norm,
      match_type_norm: row.match_type_norm,
      is_negative: inferIsNegative(row.match_type_raw),
    });
    let targetId: string | null = null;
    if (isSearchTermRow) {
      // Search-term rows don't have a target_id; avoid logging target issues.
      targetId = null;
    } else if (targetingNorm !== "*") {
      const targetResult = resolveTargetId({
        adGroupId: adGroupResult.id,
        expressionNorm: row.targeting_norm,
        matchTypeNorm: row.match_type_norm,
        matchTypeRaw: row.match_type_raw,
        isNegative: inferIsNegative(row.match_type_raw),
        referenceDate,
        lookup,
      });

      if (targetResult.status !== "ok") {
        const targetKeyObj = {
          ...issueKeyBase(row),
          ad_group_name_norm: row.ad_group_name_norm,
          targeting_norm: row.targeting_norm,
          match_type_norm: row.match_type_norm,
          is_negative: inferIsNegative(row.match_type_raw),
        };
        const targetKey = JSON.stringify(targetKeyObj);
        pendingTargetIssues.push({
          key: targetKey,
          issue: {
            entity_level: "target",
            issue_type: targetResult.status === "ambiguous" ? "ambiguous" : "unmapped",
            key_json: targetKeyObj,
            candidates_json: targetResult.status === "ambiguous" ? targetResult.candidates : null,
          },
        });
        continue;
      }
      targetId = targetResult.id;
      const targetKey = JSON.stringify({
        ...issueKeyBase(row),
        ad_group_name_norm: row.ad_group_name_norm,
        targeting_norm: row.targeting_norm,
        match_type_norm: row.match_type_norm,
        is_negative: inferIsNegative(row.match_type_raw),
      });
      resolvedTargetKeys.add(targetKey);
    }

    facts.push({
      upload_id: uploadId,
      account_id: accountId,
      date: row.date,
      portfolio_name_raw: row.portfolio_name_raw,
      portfolio_name_norm: row.portfolio_name_norm,
      campaign_name_raw: row.campaign_name_raw,
      campaign_name_norm: row.campaign_name_norm,
      ad_group_name_raw: row.ad_group_name_raw,
      ad_group_name_norm: row.ad_group_name_norm,
      targeting_raw: row.targeting_raw,
      targeting_norm: row.targeting_norm,
      match_type_raw: row.match_type_raw,
      match_type_norm: row.match_type_norm,
      customer_search_term_raw: row.customer_search_term_raw,
      customer_search_term_norm: row.customer_search_term_norm,
      search_term_impression_rank: row.search_term_impression_rank,
      search_term_impression_share: row.search_term_impression_share,
      impressions: row.impressions,
      clicks: row.clicks,
      spend: row.spend,
      sales: row.sales,
      orders: row.orders,
      units: row.units,
      cpc: row.cpc,
      ctr: row.ctr,
      acos: row.acos,
      roas: row.roas,
      conversion_rate: row.conversion_rate,
      campaign_id: campaignResult.id,
      ad_group_id: adGroupResult.id,
      target_id: targetId,
      target_key: targetId ?? targetKeySignature,
      exported_at: exportedAt,
    });
  }

  for (const pending of pendingCampaignIssues) {
    if (resolvedCampaignKeys.has(pending.key)) continue;
    collector.addIssue(pending.issue);
  }
  for (const pending of pendingAdGroupIssues) {
    if (resolvedAdGroupKeys.has(pending.key)) continue;
    collector.addIssue(pending.issue);
  }
  for (const pending of pendingTargetIssues) {
    if (resolvedTargetKeys.has(pending.key)) continue;
    collector.addIssue(pending.issue);
  }

  return { facts, issues: collector.list() };
}
