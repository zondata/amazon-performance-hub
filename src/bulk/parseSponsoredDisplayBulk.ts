import * as XLSX from "xlsx";
import { cleanId, normText } from "./parseSponsoredProductsBulk";

export type SdCampaignRow = {
  campaignId: string | null;
  campaignNameRaw: string;
  campaignNameNorm: string;
  portfolioId: string | null;
  state: string;
  budget: number | null;
  tactic: string;
  costType: string;
  bidOptimization: string;
};

export type SdAdGroupRow = {
  adGroupId: string | null;
  campaignId: string | null;
  adGroupNameRaw: string;
  adGroupNameNorm: string;
  state: string;
  defaultBid: number | null;
};

export type SdProductAdRow = {
  adId: string | null;
  adGroupId: string | null;
  campaignId: string | null;
  skuRaw: string;
  asinRaw: string;
};

export type SdTargetRow = {
  targetingId: string | null;
  adGroupId: string | null;
  campaignId: string | null;
  targetType: string;
  expressionRaw: string;
  expressionNorm: string;
  bid: number | null;
  bidOptimization: string;
  costType: string;
  state: string;
};

export type SponsoredDisplaySnapshot = {
  snapshotDate: string;
  campaigns: SdCampaignRow[];
  adGroups: SdAdGroupRow[];
  productAds: SdProductAdRow[];
  targets: SdTargetRow[];
};

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function getCell(row: Record<string, unknown>, key: string): unknown {
  return row[key];
}

function normalizeEntity(value: unknown): string {
  return String(value ?? "").trim();
}

function getCampaignBudget(row: Record<string, unknown>): number | null {
  const candidates = ["Budget", "Daily Budget"];
  for (const key of candidates) {
    const value = getCell(row, key);
    const parsed = parseNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function getBidOptimization(row: Record<string, unknown>): string {
  const candidates = ["Bid Optimization", "Bid Optimization (Goal)", "Bid Optimization Strategy"];
  for (const key of candidates) {
    const value = String(getCell(row, key) ?? "").trim();
    if (value) return value;
  }
  return "";
}

function getCostType(row: Record<string, unknown>): string {
  const value = String(getCell(row, "Cost Type") ?? "").trim();
  return value;
}

export async function parseSponsoredDisplayBulk(xlsxPath: string, snapshotDate: string) {
  const workbook = XLSX.readFile(xlsxPath, { dense: true });
  const sheet = workbook.Sheets["Sponsored Display Campaigns"];
  if (!sheet) {
    return {
      snapshotDate,
      campaigns: [],
      adGroups: [],
      productAds: [],
      targets: [],
    } satisfies SponsoredDisplaySnapshot;
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    defval: "",
  });

  const campaigns: SdCampaignRow[] = [];
  const adGroups: SdAdGroupRow[] = [];
  const productAds: SdProductAdRow[] = [];
  const targets: SdTargetRow[] = [];

  const seenCampaigns = new Set<string>();
  const seenAdGroups = new Set<string>();
  const seenProductAds = new Set<string>();
  const seenTargets = new Set<string>();

  for (const row of rows) {
    const entity = normalizeEntity(getCell(row, "Entity"));

    if (entity === "Campaign") {
      const campaignId = cleanId(getCell(row, "Campaign ID"));
      if (campaignId && seenCampaigns.has(campaignId)) continue;
      if (campaignId) seenCampaigns.add(campaignId);
      const campaignNameRaw = String(getCell(row, "Campaign Name") ?? "").trim();
      campaigns.push({
        campaignId,
        campaignNameRaw,
        campaignNameNorm: normText(campaignNameRaw),
        portfolioId: cleanId(getCell(row, "Portfolio ID")),
        state: String(getCell(row, "State") ?? "").trim(),
        budget: getCampaignBudget(row),
        tactic: String(getCell(row, "Tactic") ?? "").trim(),
        costType: getCostType(row),
        bidOptimization: getBidOptimization(row),
      });
      continue;
    }

    if (entity === "Ad Group") {
      const adGroupId = cleanId(getCell(row, "Ad Group ID"));
      if (adGroupId && seenAdGroups.has(adGroupId)) continue;
      if (adGroupId) seenAdGroups.add(adGroupId);
      const adGroupNameRaw = String(getCell(row, "Ad Group Name") ?? "").trim();
      adGroups.push({
        adGroupId,
        campaignId: cleanId(getCell(row, "Campaign ID")),
        adGroupNameRaw,
        adGroupNameNorm: normText(adGroupNameRaw),
        state: String(getCell(row, "State") ?? "").trim(),
        defaultBid: parseNumber(getCell(row, "Bid")),
      });
      continue;
    }

    if (entity === "Product Ad") {
      const adId = cleanId(getCell(row, "Ad ID"));
      if (adId && seenProductAds.has(adId)) continue;
      if (adId) seenProductAds.add(adId);
      const skuRaw = String(getCell(row, "SKU") ?? "").trim();
      const asinRaw = String(getCell(row, "ASIN") ?? "").trim();
      productAds.push({
        adId,
        adGroupId: cleanId(getCell(row, "Ad Group ID")),
        campaignId: cleanId(getCell(row, "Campaign ID")),
        skuRaw,
        asinRaw,
      });
      continue;
    }

    if (entity === "Contextual Targeting" || entity === "Audience Targeting") {
      const targetingId = cleanId(getCell(row, "Targeting ID"));
      if (targetingId && seenTargets.has(targetingId)) continue;
      if (targetingId) seenTargets.add(targetingId);
      const expressionRaw = String(getCell(row, "Targeting Expression") ?? "").trim();
      const targetType = entity === "Contextual Targeting" ? "CONTEXTUAL_TARGETING" : "AUDIENCE_TARGETING";
      targets.push({
        targetingId,
        adGroupId: cleanId(getCell(row, "Ad Group ID")),
        campaignId: cleanId(getCell(row, "Campaign ID")),
        targetType,
        expressionRaw,
        expressionNorm: normText(expressionRaw),
        bid: parseNumber(getCell(row, "Bid")),
        bidOptimization: getBidOptimization(row),
        costType: getCostType(row),
        state: String(getCell(row, "State") ?? "").trim(),
      });
    }
  }

  return {
    snapshotDate,
    campaigns,
    adGroups,
    productAds,
    targets,
  } satisfies SponsoredDisplaySnapshot;
}
