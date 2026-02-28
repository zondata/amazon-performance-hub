import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CAMPAIGN_ID_LIMIT = 500;

type LoadAsinCampaignIdsArgs = {
  asin: string;
  accountId: string;
  snapshotDate: string | null;
  namePattern: string;
  startDate?: string;
  endDate?: string;
};

const getEffectiveNamePattern = ({ asin, namePattern }: Pick<LoadAsinCampaignIdsArgs, "asin" | "namePattern">) => {
  const trimmed = namePattern.trim();
  if (trimmed.length > 0) return trimmed;
  return `%${asin.trim().toLowerCase()}%`;
};

const normalizeCampaignIds = (
  rows: Array<{ campaign_id: string | null }> | null | undefined
): string[] => {
  const unique = new Set<string>();
  for (const row of rows ?? []) {
    const campaignId = String(row.campaign_id ?? "").trim();
    if (campaignId.length === 0) continue;
    unique.add(campaignId);
  }
  return [...unique].sort((left, right) => left.localeCompare(right)).slice(0, CAMPAIGN_ID_LIMIT);
};

export const loadSpCampaignIdsForAsin = async ({
  asin,
  accountId,
  snapshotDate,
  namePattern,
  startDate,
  endDate,
}: LoadAsinCampaignIdsArgs): Promise<string[]> => {
  const normalizedAsin = asin.trim();
  const normalizedAsinNorm = normalizedAsin.toLowerCase();
  const effectiveNamePattern = getEffectiveNamePattern({ asin, namePattern });

  if (snapshotDate && normalizedAsin.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("bulk_product_ads")
      .select("campaign_id")
      .eq("account_id", accountId)
      .eq("snapshot_date", snapshotDate)
      .ilike("asin_raw", normalizedAsin)
      .limit(CAMPAIGN_ID_LIMIT);
    if (error) {
      throw new Error(`Failed loading SP product-ad campaign candidates: ${error.message}`);
    }
    const campaignIdsFromProductAds = normalizeCampaignIds(
      (data ?? null) as Array<{ campaign_id: string | null }> | null
    );
    if (campaignIdsFromProductAds.length > 0) return campaignIdsFromProductAds;
  }

  let campaignIds: string[] = [];
  if (snapshotDate) {
    const { data, error } = await supabaseAdmin
      .from("bulk_campaigns")
      .select("campaign_id")
      .eq("account_id", accountId)
      .eq("snapshot_date", snapshotDate)
      .ilike("campaign_name_norm", effectiveNamePattern)
      .limit(CAMPAIGN_ID_LIMIT);
    if (error) {
      throw new Error(`Failed loading SP bulk campaign candidates: ${error.message}`);
    }
    campaignIds = normalizeCampaignIds(
      (data ?? null) as Array<{ campaign_id: string | null }> | null
    );
  }

  if (campaignIds.length > 0) return campaignIds;

  const { data: historyData, error: historyError } = await supabaseAdmin
    .from("campaign_name_history")
    .select("campaign_id")
    .eq("account_id", accountId)
    .ilike("name_norm", effectiveNamePattern)
    .limit(CAMPAIGN_ID_LIMIT);
  if (historyError) {
    throw new Error(`Failed loading SP campaign history candidates: ${historyError.message}`);
  }
  campaignIds = normalizeCampaignIds(
    (historyData ?? null) as Array<{ campaign_id: string | null }> | null
  );
  if (campaignIds.length > 0) return campaignIds;

  if (normalizedAsinNorm.length === 0) return [];

  let factQuery = supabaseAdmin
    .from("sp_advertised_product_daily_fact_latest")
    .select("campaign_id")
    .eq("account_id", accountId)
    .eq("advertised_asin_norm", normalizedAsinNorm)
    .limit(CAMPAIGN_ID_LIMIT);
  if (startDate) {
    factQuery = factQuery.gte("date", startDate);
  }
  if (endDate) {
    factQuery = factQuery.lte("date", endDate);
  }
  const { data: factData, error: factError } = await factQuery;
  if (factError) {
    throw new Error(`Failed loading SP advertised-product campaign candidates: ${factError.message}`);
  }
  return normalizeCampaignIds(
    (factData ?? null) as Array<{ campaign_id: string | null }> | null
  );
};

export const loadSbCampaignIdsForAsin = async ({
  asin,
  accountId,
  snapshotDate,
  namePattern,
  startDate,
  endDate,
}: LoadAsinCampaignIdsArgs): Promise<string[]> => {
  const effectiveNamePattern = getEffectiveNamePattern({ asin, namePattern });
  const normalizedAsinNorm = asin.trim().toLowerCase();

  let campaignIds: string[] = [];
  if (snapshotDate) {
    const { data, error } = await supabaseAdmin
      .from("bulk_sb_campaigns")
      .select("campaign_id")
      .eq("account_id", accountId)
      .eq("snapshot_date", snapshotDate)
      .ilike("campaign_name_norm", effectiveNamePattern)
      .limit(CAMPAIGN_ID_LIMIT);
    if (error) {
      throw new Error(`Failed loading SB bulk campaign candidates: ${error.message}`);
    }
    campaignIds = normalizeCampaignIds(
      (data ?? null) as Array<{ campaign_id: string | null }> | null
    );
  }

  if (campaignIds.length > 0) return campaignIds;

  const { data: historyData, error: historyError } = await supabaseAdmin
    .from("sb_campaign_name_history")
    .select("campaign_id")
    .eq("account_id", accountId)
    .ilike("name_norm", effectiveNamePattern)
    .limit(CAMPAIGN_ID_LIMIT);
  if (historyError) {
    throw new Error(`Failed loading SB campaign history candidates: ${historyError.message}`);
  }
  campaignIds = normalizeCampaignIds(
    (historyData ?? null) as Array<{ campaign_id: string | null }> | null
  );
  if (campaignIds.length > 0) return campaignIds;

  if (normalizedAsinNorm.length === 0) return [];

  let factQuery = supabaseAdmin
    .from("sb_attributed_purchases_daily_fact_latest")
    .select("campaign_id")
    .eq("account_id", accountId)
    .eq("purchased_asin_norm", normalizedAsinNorm)
    .limit(CAMPAIGN_ID_LIMIT);
  if (startDate) {
    factQuery = factQuery.gte("date", startDate);
  }
  if (endDate) {
    factQuery = factQuery.lte("date", endDate);
  }
  const { data: factData, error: factError } = await factQuery;
  if (factError) {
    throw new Error(`Failed loading SB attributed-purchases campaign candidates: ${factError.message}`);
  }
  return normalizeCampaignIds(
    (factData ?? null) as Array<{ campaign_id: string | null }> | null
  );
};
