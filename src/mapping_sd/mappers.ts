import {
  BulkLookup,
  MappingIssue,
  buildAdKey,
  buildTargetKey,
  createIssueCollector,
  resolveAdGroupId,
  resolveAdId,
  resolveCampaignId,
  resolveTargetId,
  resolveTargetIdByCampaign,
} from "./core";

export type SdCampaignRawRow = {
  date: string;
  portfolio_name_raw: string | null;
  portfolio_name_norm: string | null;
  campaign_name_raw: string;
  campaign_name_norm: string;
  cost_type: string | null;
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

export type SdCampaignFactRow = SdCampaignRawRow & {
  upload_id: string;
  account_id: string;
  campaign_id: string;
  portfolio_id: string | null;
  exported_at: string;
};

export type SdAdvertisedProductRawRow = {
  date: string;
  portfolio_name_raw: string | null;
  portfolio_name_norm: string | null;
  campaign_name_raw: string;
  campaign_name_norm: string;
  ad_group_name_raw: string;
  ad_group_name_norm: string;
  advertised_sku_raw: string | null;
  advertised_sku_norm: string | null;
  advertised_asin_raw: string | null;
  advertised_asin_norm: string | null;
  cost_type: string | null;
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

export type SdAdvertisedProductFactRow = SdAdvertisedProductRawRow & {
  upload_id: string;
  account_id: string;
  campaign_id: string;
  ad_group_id: string;
  ad_id: string | null;
  ad_key: string;
  exported_at: string;
};

export type SdTargetingRawRow = {
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
  cost_type: string | null;
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

export type SdTargetingFactRow = SdTargetingRawRow & {
  upload_id: string;
  account_id: string;
  campaign_id: string;
  ad_group_id: string;
  target_id: string | null;
  target_key: string;
  exported_at: string;
};

export type SdMatchedTargetRawRow = {
  date: string;
  portfolio_name_raw: string | null;
  portfolio_name_norm: string | null;
  campaign_name_raw: string;
  campaign_name_norm: string;
  ad_group_name_raw: string;
  ad_group_name_norm: string;
  targeting_raw: string;
  targeting_norm: string;
  matched_target_raw: string;
  matched_target_norm: string;
  cost_type: string | null;
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

export type SdMatchedTargetFactRow = SdMatchedTargetRawRow & {
  upload_id: string;
  account_id: string;
  campaign_id: string;
  ad_group_id: string;
  target_id: string | null;
  target_key: string;
  exported_at: string;
};

export type SdPurchasedProductRawRow = {
  date: string;
  portfolio_name_raw: string | null;
  portfolio_name_norm: string | null;
  campaign_name_raw: string;
  campaign_name_norm: string;
  ad_group_name_raw: string;
  ad_group_name_norm: string;
  purchased_sku_raw: string | null;
  purchased_sku_norm: string | null;
  purchased_asin_raw: string | null;
  purchased_asin_norm: string | null;
  cost_type: string | null;
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

export type SdPurchasedProductFactRow = SdPurchasedProductRawRow & {
  upload_id: string;
  account_id: string;
  campaign_id: string;
  ad_group_id: string;
  ad_id: string | null;
  ad_key: string;
  advertised_sku_raw: string | null;
  advertised_sku_norm: string | null;
  advertised_asin_raw: string | null;
  advertised_asin_norm: string | null;
  exported_at: string;
};

function issueKeyBase(row: { campaign_name_norm: string; portfolio_name_norm?: string | null }) {
  return {
    campaign_name_norm: row.campaign_name_norm,
    portfolio_name_norm: row.portfolio_name_norm ?? null,
  };
}

type PendingIssue = Omit<MappingIssue, "row_count"> & { row_count?: number };

export function mapSdCampaignRows(params: {
  rows: SdCampaignRawRow[];
  lookup: BulkLookup;
  uploadId: string;
  accountId: string;
  exportedAt: string;
  referenceDate: string;
}): { facts: SdCampaignFactRow[]; issues: MappingIssue[] } {
  const { rows, lookup, uploadId, accountId, exportedAt, referenceDate } = params;
  const facts: SdCampaignFactRow[] = [];
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
      portfolio_name_raw: row.portfolio_name_raw,
      portfolio_name_norm: row.portfolio_name_norm,
      campaign_name_raw: row.campaign_name_raw,
      campaign_name_norm: row.campaign_name_norm,
      cost_type: row.cost_type,
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

export function mapSdAdvertisedProductRows(params: {
  rows: SdAdvertisedProductRawRow[];
  lookup: BulkLookup;
  uploadId: string;
  accountId: string;
  exportedAt: string;
  referenceDate: string;
}): { facts: SdAdvertisedProductFactRow[]; issues: MappingIssue[] } {
  const { rows, lookup, uploadId, accountId, exportedAt, referenceDate } = params;
  const facts: SdAdvertisedProductFactRow[] = [];
  const collector = createIssueCollector();
  const resolvedCampaignKeys = new Set<string>();
  const resolvedAdGroupKeys = new Set<string>();
  const resolvedAdKeys = new Set<string>();
  const pendingCampaignIssues: { key: string; issue: PendingIssue }[] = [];
  const pendingAdGroupIssues: { key: string; issue: PendingIssue }[] = [];
  const pendingAdIssues: { key: string; issue: PendingIssue }[] = [];

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

    const adKeySignature = buildAdKey({
      campaign_name_norm: row.campaign_name_norm,
      portfolio_name_norm: row.portfolio_name_norm ?? null,
      ad_group_name_norm: row.ad_group_name_norm,
      advertised_sku_norm: row.advertised_sku_norm,
      advertised_asin_norm: row.advertised_asin_norm,
      cost_type: row.cost_type,
    });

    const adResult = resolveAdId({
      adGroupId: adGroupResult.id,
      skuNorm: row.advertised_sku_norm,
      asinNorm: row.advertised_asin_norm,
      referenceDate,
      lookup,
    });

    if (adResult.status !== "ok") {
      pendingAdIssues.push({
        key: adKeySignature,
        issue: {
          entity_level: "ad",
          issue_type: adResult.status === "ambiguous" ? "ambiguous" : "unmapped",
          key_json: {
            ...issueKeyBase(row),
            ad_group_name_norm: row.ad_group_name_norm,
            advertised_sku_norm: row.advertised_sku_norm,
            advertised_asin_norm: row.advertised_asin_norm,
            cost_type: row.cost_type ?? null,
          },
          candidates_json: adResult.status === "ambiguous" ? adResult.candidates : null,
        },
      });
    } else {
      resolvedAdKeys.add(adKeySignature);
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
      advertised_sku_raw: row.advertised_sku_raw,
      advertised_sku_norm: row.advertised_sku_norm,
      advertised_asin_raw: row.advertised_asin_raw,
      advertised_asin_norm: row.advertised_asin_norm,
      cost_type: row.cost_type,
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
      ad_id: adResult.status === "ok" ? adResult.id : null,
      ad_key: adResult.status === "ok" ? adResult.id : adKeySignature,
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
  for (const pending of pendingAdIssues) {
    if (resolvedAdKeys.has(pending.key)) continue;
    collector.addIssue(pending.issue);
  }

  return { facts, issues: collector.list() };
}

export function mapSdTargetingRows(params: {
  rows: SdTargetingRawRow[];
  lookup: BulkLookup;
  uploadId: string;
  accountId: string;
  exportedAt: string;
  referenceDate: string;
}): { facts: SdTargetingFactRow[]; issues: MappingIssue[] } {
  const { rows, lookup, uploadId, accountId, exportedAt, referenceDate } = params;
  const facts: SdTargetingFactRow[] = [];
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
    const targetKeySignature = buildTargetKey({
      campaign_name_norm: row.campaign_name_norm,
      portfolio_name_norm: row.portfolio_name_norm ?? null,
      ad_group_name_norm: row.ad_group_name_norm,
      targeting_norm: row.targeting_norm,
      match_type_norm: row.match_type_norm,
      cost_type: row.cost_type,
    });
    const targetResult = resolveTargetId({
      adGroupId: adGroupResult.id,
      expressionNorm: row.targeting_norm,
      referenceDate,
      lookup,
    });

    if (targetResult.status !== "ok") {
      pendingTargetIssues.push({
        key: targetKeySignature,
        issue: {
          entity_level: "target",
          issue_type: targetResult.status === "ambiguous" ? "ambiguous" : "unmapped",
          key_json: {
            ...issueKeyBase(row),
            ad_group_name_norm: row.ad_group_name_norm,
            targeting_norm: row.targeting_norm,
            match_type_norm: row.match_type_norm,
            cost_type: row.cost_type ?? null,
          },
          candidates_json: targetResult.status === "ambiguous" ? targetResult.candidates : null,
        },
      });
    } else {
      resolvedTargetKeys.add(targetKeySignature);
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
      cost_type: row.cost_type,
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
      target_id: targetResult.status === "ok" ? targetResult.id : null,
      target_key: targetResult.status === "ok" ? targetResult.id : targetKeySignature,
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

export function mapSdMatchedTargetRows(params: {
  rows: SdMatchedTargetRawRow[];
  lookup: BulkLookup;
  uploadId: string;
  accountId: string;
  exportedAt: string;
  referenceDate: string;
}): { facts: SdMatchedTargetFactRow[]; issues: MappingIssue[] } {
  const { rows, lookup, uploadId, accountId, exportedAt, referenceDate } = params;
  const facts: SdMatchedTargetFactRow[] = [];
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
    const targetKeySignature = buildTargetKey({
      campaign_name_norm: row.campaign_name_norm,
      portfolio_name_norm: row.portfolio_name_norm ?? null,
      ad_group_name_norm: row.ad_group_name_norm,
      targeting_norm: row.targeting_norm,
      match_type_norm: null,
      cost_type: row.cost_type,
    });

    const targetResult = resolveTargetIdByCampaign({
      campaignId: campaignResult.id,
      adGroupId: adGroupResult.id,
      expressionNorm: row.targeting_norm,
      referenceDate,
      lookup,
    });

    if (targetResult.status !== "ok") {
      pendingTargetIssues.push({
        key: targetKeySignature,
        issue: {
          entity_level: "target",
          issue_type: targetResult.status === "ambiguous" ? "ambiguous" : "unmapped",
          key_json: {
            ...issueKeyBase(row),
            ad_group_name_norm: row.ad_group_name_norm,
            targeting_norm: row.targeting_norm,
            matched_target_norm: row.matched_target_norm,
            cost_type: row.cost_type ?? null,
          },
          candidates_json: targetResult.status === "ambiguous" ? targetResult.candidates : null,
        },
      });
    } else {
      resolvedTargetKeys.add(targetKeySignature);
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
      matched_target_raw: row.matched_target_raw,
      matched_target_norm: row.matched_target_norm,
      cost_type: row.cost_type,
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
      target_id: targetResult.status === "ok" ? targetResult.id : null,
      target_key: targetResult.status === "ok" ? targetResult.id : targetKeySignature,
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

export function mapSdPurchasedProductRows(params: {
  rows: SdPurchasedProductRawRow[];
  lookup: BulkLookup;
  uploadId: string;
  accountId: string;
  exportedAt: string;
  referenceDate: string;
}): { facts: SdPurchasedProductFactRow[]; issues: MappingIssue[] } {
  const { rows, lookup, uploadId, accountId, exportedAt, referenceDate } = params;
  const facts: SdPurchasedProductFactRow[] = [];
  const collector = createIssueCollector();
  const resolvedCampaignKeys = new Set<string>();
  const resolvedAdGroupKeys = new Set<string>();
  const resolvedAdKeys = new Set<string>();
  const pendingCampaignIssues: { key: string; issue: PendingIssue }[] = [];
  const pendingAdGroupIssues: { key: string; issue: PendingIssue }[] = [];
  const pendingAdIssues: { key: string; issue: PendingIssue }[] = [];

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

    const adSkuNorm = row.purchased_sku_norm;
    const adAsinNorm = row.purchased_asin_norm;
    const adKeySignature = buildAdKey({
      campaign_name_norm: row.campaign_name_norm,
      portfolio_name_norm: row.portfolio_name_norm ?? null,
      ad_group_name_norm: row.ad_group_name_norm,
      advertised_sku_norm: adSkuNorm,
      advertised_asin_norm: adAsinNorm,
      cost_type: row.cost_type,
    });

    const adResult = resolveAdId({
      adGroupId: adGroupResult.id,
      skuNorm: adSkuNorm,
      asinNorm: adAsinNorm,
      referenceDate,
      lookup,
    });

    if (adResult.status !== "ok") {
      pendingAdIssues.push({
        key: adKeySignature,
        issue: {
          entity_level: "ad",
          issue_type: adResult.status === "ambiguous" ? "ambiguous" : "unmapped",
          key_json: {
            ...issueKeyBase(row),
            ad_group_name_norm: row.ad_group_name_norm,
            purchased_sku_norm: row.purchased_sku_norm,
            purchased_asin_norm: row.purchased_asin_norm,
            cost_type: row.cost_type ?? null,
          },
          candidates_json: adResult.status === "ambiguous" ? adResult.candidates : null,
        },
      });
    } else {
      resolvedAdKeys.add(adKeySignature);
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
      advertised_sku_raw: null,
      advertised_sku_norm: null,
      advertised_asin_raw: null,
      advertised_asin_norm: null,
      purchased_sku_raw: row.purchased_sku_raw,
      purchased_sku_norm: row.purchased_sku_norm,
      purchased_asin_raw: row.purchased_asin_raw,
      purchased_asin_norm: row.purchased_asin_norm,
      cost_type: row.cost_type,
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
      ad_id: adResult.status === "ok" ? adResult.id : null,
      ad_key: adResult.status === "ok" ? adResult.id : adKeySignature,
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
  for (const pending of pendingAdIssues) {
    if (resolvedAdKeys.has(pending.key)) continue;
    collector.addIssue(pending.issue);
  }

  return { facts, issues: collector.list() };
}
