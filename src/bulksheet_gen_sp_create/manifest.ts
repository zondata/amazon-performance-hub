import { SpCreateAction, SpCreateResolvedRefs } from "./types";
import { normText } from "../bulk/parseSponsoredProductsBulk";

export type SpCreateManifest = {
  run_id: string;
  generator: string;
  created_at: string;
  campaigns: {
    name: string;
    temp_id?: string;
    portfolio_id?: string;
    campaign_id: string;
  }[];
  ad_groups: {
    campaign_name: string;
    ad_group_name: string;
    temp_id?: string;
    ad_group_id: string;
  }[];
  product_ads: {
    campaign_name: string;
    ad_group_name: string;
    sku?: string;
    asin?: string;
  }[];
  keywords: {
    campaign_name: string;
    ad_group_name: string;
    keyword_text: string;
    match_type: string;
    bid: number;
  }[];
};

function resolveCampaignName(
  action: { campaign_name?: string; campaign_temp_id?: string },
  refs: SpCreateResolvedRefs
): string {
  if (action.campaign_name) return action.campaign_name.trim();
  if (action.campaign_temp_id) {
    const name = refs.campaignsByTempId.get(action.campaign_temp_id);
    if (!name) throw new Error(`Unknown campaign_temp_id: ${action.campaign_temp_id}`);
    return name;
  }
  throw new Error("Missing campaign_name or campaign_temp_id");
}

function resolveAdGroupName(
  action: { ad_group_name?: string; ad_group_temp_id?: string },
  refs: SpCreateResolvedRefs
): string {
  if (action.ad_group_name) return action.ad_group_name.trim();
  if (action.ad_group_temp_id) {
    const ref = refs.adGroupsByTempId.get(action.ad_group_temp_id);
    if (!ref) throw new Error(`Unknown ad_group_temp_id: ${action.ad_group_temp_id}`);
    return ref.adGroupName;
  }
  throw new Error("Missing ad_group_name or ad_group_temp_id");
}

export function buildCreateManifest(params: {
  actions: SpCreateAction[];
  refs: SpCreateResolvedRefs;
  runId: string;
  generator: string;
  portfolioId?: string;
}): SpCreateManifest {
  const campaigns: SpCreateManifest["campaigns"] = [];
  const adGroups: SpCreateManifest["ad_groups"] = [];
  const productAds: SpCreateManifest["product_ads"] = [];
  const keywords: SpCreateManifest["keywords"] = [];

  for (const action of params.actions) {
    if (action.type === "create_campaign") {
      const campaignId =
        action.temp_id ?? params.refs.campaignsByName.get(normText(action.name.trim())) ?? "";
      campaigns.push({
        name: action.name.trim(),
        temp_id: action.temp_id,
        portfolio_id: params.portfolioId,
        campaign_id: campaignId,
      });
      continue;
    }
    if (action.type === "create_ad_group") {
      const campaignName = resolveCampaignName(action, params.refs);
      const key = `${normText(campaignName)}::${normText(action.ad_group_name.trim())}`;
      const adGroupId = action.temp_id ?? params.refs.adGroupsByKey.get(key) ?? "";
      adGroups.push({
        campaign_name: campaignName,
        ad_group_name: action.ad_group_name.trim(),
        temp_id: action.temp_id,
        ad_group_id: adGroupId,
      });
      continue;
    }
    if (action.type === "create_product_ad") {
      productAds.push({
        campaign_name: resolveCampaignName(action, params.refs),
        ad_group_name: resolveAdGroupName(action, params.refs),
        sku: action.sku?.trim() || undefined,
        asin: action.asin?.trim() || undefined,
      });
      continue;
    }
    if (action.type === "create_keyword") {
      keywords.push({
        campaign_name: resolveCampaignName(action, params.refs),
        ad_group_name: resolveAdGroupName(action, params.refs),
        keyword_text: action.keyword_text.trim(),
        match_type: action.match_type.trim(),
        bid: action.bid,
      });
      continue;
    }
  }

  return {
    run_id: params.runId,
    generator: params.generator,
    created_at: new Date().toISOString(),
    campaigns,
    ad_groups: adGroups,
    product_ads: productAds,
    keywords,
  };
}
