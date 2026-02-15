import { getSupabaseClient } from "../db/supabaseClient";
import { normText } from "../bulk/parseSponsoredProductsBulk";
import { SpCreateManifest } from "./manifest";

type BulkCampaignRow = {
  campaign_id: string;
  campaign_name_raw: string;
  campaign_name_norm: string;
};

type BulkAdGroupRow = {
  ad_group_id: string;
  ad_group_name_raw: string;
  ad_group_name_norm: string;
  campaign_id: string;
};

type BulkTargetRow = {
  target_id: string;
  ad_group_id: string;
  expression_norm: string;
  match_type: string;
};

export type ReconcileResult = {
  run_id: string;
  generator: string;
  matched_at: string;
  campaign_matches: {
    campaign_name: string;
    campaign_id: string | null;
    matched: boolean;
  }[];
  ad_group_matches: {
    campaign_name: string;
    ad_group_name: string;
    ad_group_id: string | null;
    matched: boolean;
  }[];
  keyword_matches: {
    keyword_text: string;
    match_type: string;
    target_id: string | null;
    matched: boolean;
  }[];
  product_ad_matches: {
    campaign_name: string;
    ad_group_name: string;
    sku?: string;
    asin?: string;
    ad_id: string | null;
    matched: boolean;
    note?: string;
  }[];
  counts: {
    expected: number;
    matched: number;
    campaigns: { expected: number; matched: number };
    ad_groups: { expected: number; matched: number };
    keywords: { expected: number; matched: number };
    product_ads: { expected: number; matched: number };
  };
  all_matched: boolean;
};

export async function fetchBulkRows(params: {
  accountId: string;
  snapshotDate: string;
}) {
  const client = getSupabaseClient();
  const { data: campaigns, error: campErr } = await client
    .from("bulk_campaigns")
    .select("campaign_id,campaign_name_raw,campaign_name_norm")
    .eq("account_id", params.accountId)
    .eq("snapshot_date", params.snapshotDate);
  if (campErr) throw new Error(`Failed fetching bulk_campaigns: ${campErr.message}`);

  const { data: adGroups, error: adErr } = await client
    .from("bulk_ad_groups")
    .select("ad_group_id,ad_group_name_raw,ad_group_name_norm,campaign_id")
    .eq("account_id", params.accountId)
    .eq("snapshot_date", params.snapshotDate);
  if (adErr) throw new Error(`Failed fetching bulk_ad_groups: ${adErr.message}`);

  const { data: targets, error: targetErr } = await client
    .from("bulk_targets")
    .select("target_id,ad_group_id,expression_norm,match_type")
    .eq("account_id", params.accountId)
    .eq("snapshot_date", params.snapshotDate);
  if (targetErr) throw new Error(`Failed fetching bulk_targets: ${targetErr.message}`);

  return {
    campaigns: (campaigns ?? []) as BulkCampaignRow[],
    adGroups: (adGroups ?? []) as BulkAdGroupRow[],
    targets: (targets ?? []) as BulkTargetRow[],
  };
}

export function reconcileManifest(params: {
  manifest: SpCreateManifest;
  campaigns: BulkCampaignRow[];
  adGroups: BulkAdGroupRow[];
  targets: BulkTargetRow[];
}): ReconcileResult {
  const { manifest, campaigns, adGroups, targets } = params;
  if (!manifest.run_id || !manifest.generator) {
    throw new Error("Manifest missing required fields: run_id and generator.");
  }

  const campaignByNorm = new Map<string, BulkCampaignRow>();
  for (const campaign of campaigns) {
    campaignByNorm.set(campaign.campaign_name_norm, campaign);
  }

  const adGroupByKey = new Map<string, BulkAdGroupRow>();
  for (const adGroup of adGroups) {
    const key = `${adGroup.campaign_id}::${adGroup.ad_group_name_norm}`;
    adGroupByKey.set(key, adGroup);
  }

  const campaignMatches = manifest.campaigns.map((campaign) => {
    const match = campaignByNorm.get(normText(campaign.name));
    return {
      campaign_name: campaign.name,
      campaign_id: match?.campaign_id ?? null,
      matched: Boolean(match),
    };
  });

  const adGroupMatches = manifest.ad_groups.map((adGroup) => {
    const campaign = campaignByNorm.get(normText(adGroup.campaign_name));
    const key = campaign ? `${campaign.campaign_id}::${normText(adGroup.ad_group_name)}` : "";
    const match = key ? adGroupByKey.get(key) : null;
    return {
      campaign_name: adGroup.campaign_name,
      ad_group_name: adGroup.ad_group_name,
      ad_group_id: match?.ad_group_id ?? null,
      matched: Boolean(match),
    };
  });

  const keywordMatches = manifest.keywords.map((keyword) => {
    const campaign = campaignByNorm.get(normText(keyword.campaign_name));
    const adGroupKey = campaign
      ? `${campaign.campaign_id}::${normText(keyword.ad_group_name)}`
      : "";
    const adGroup = adGroupKey ? adGroupByKey.get(adGroupKey) : null;
    const match = adGroup
      ? targets.find(
          (target) =>
            target.ad_group_id === adGroup.ad_group_id &&
            target.expression_norm === normText(keyword.keyword_text) &&
            target.match_type === keyword.match_type
        )
      : null;
    return {
      keyword_text: keyword.keyword_text,
      match_type: keyword.match_type,
      target_id: match?.target_id ?? null,
      matched: Boolean(match),
    };
  });

  const productAdMatches = manifest.product_ads.map((productAd) => {
    const campaign = campaignByNorm.get(normText(productAd.campaign_name));
    const adGroupKey = campaign
      ? `${campaign.campaign_id}::${normText(productAd.ad_group_name)}`
      : "";
    const adGroup = adGroupKey ? adGroupByKey.get(adGroupKey) : null;
    const matched = Boolean(adGroup);
    return {
      campaign_name: productAd.campaign_name,
      ad_group_name: productAd.ad_group_name,
      sku: productAd.sku,
      asin: productAd.asin,
      ad_id: null,
      matched,
      note: matched ? "ad_id_unavailable" : "missing_campaign_or_ad_group",
    };
  });

  const counts = {
    expected:
      manifest.campaigns.length +
      manifest.ad_groups.length +
      manifest.keywords.length +
      manifest.product_ads.length,
    matched:
      campaignMatches.filter((row) => row.matched).length +
      adGroupMatches.filter((row) => row.matched).length +
      keywordMatches.filter((row) => row.matched).length +
      productAdMatches.filter((row) => row.matched).length,
    campaigns: {
      expected: manifest.campaigns.length,
      matched: campaignMatches.filter((row) => row.matched).length,
    },
    ad_groups: {
      expected: manifest.ad_groups.length,
      matched: adGroupMatches.filter((row) => row.matched).length,
    },
    keywords: {
      expected: manifest.keywords.length,
      matched: keywordMatches.filter((row) => row.matched).length,
    },
    product_ads: {
      expected: manifest.product_ads.length,
      matched: productAdMatches.filter((row) => row.matched).length,
    },
  };

  const allMatched =
    counts.campaigns.expected === counts.campaigns.matched &&
    counts.ad_groups.expected === counts.ad_groups.matched &&
    counts.keywords.expected === counts.keywords.matched &&
    counts.product_ads.expected === counts.product_ads.matched;

  return {
    run_id: manifest.run_id,
    generator: manifest.generator,
    matched_at: new Date().toISOString(),
    campaign_matches: campaignMatches,
    ad_group_matches: adGroupMatches,
    keyword_matches: keywordMatches,
    product_ad_matches: productAdMatches,
    counts,
    all_matched: allMatched,
  };
}

export async function reconcileWithSnapshot(params: {
  accountId: string;
  snapshotDate: string;
  manifest: SpCreateManifest;
}): Promise<ReconcileResult> {
  const { campaigns, adGroups, targets } = await fetchBulkRows({
    accountId: params.accountId,
    snapshotDate: params.snapshotDate,
  });
  return reconcileManifest({ manifest: params.manifest, campaigns, adGroups, targets });
}
