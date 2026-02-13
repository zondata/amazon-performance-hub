import * as XLSX from "xlsx";
import { cleanId, normText } from "./parseSponsoredProductsBulk";

export type SbCampaignRow = {
  campaignId: string | null;
  campaignNameRaw: string;
  campaignNameNorm: string;
  portfolioId: string | null;
  state: string;
  dailyBudget: number | null;
  biddingStrategy: string;
};

export type SbAdGroupRow = {
  adGroupId: string | null;
  campaignId: string | null;
  adGroupNameRaw: string;
  adGroupNameNorm: string;
  state: string;
  defaultBid: number | null;
};

export type SbTargetRow = {
  targetId: string | null;
  adGroupId: string | null;
  campaignId: string | null;
  expressionRaw: string;
  expressionNorm: string;
  matchType: string;
  isNegative: boolean;
  state: string;
  bid: number | null;
};

export type SbPlacementRow = {
  campaignId: string | null;
  placementRaw: string;
  placementRawNorm: string;
  placementCode: string;
  percentage: number | null;
};

export type SponsoredBrandsSnapshot = {
  snapshotDate: string;
  campaigns: SbCampaignRow[];
  adGroups: SbAdGroupRow[];
  targets: SbTargetRow[];
  placements: SbPlacementRow[];
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

function normalizePlacementCode(raw: string): string {
  const norm = raw.trim().toLowerCase();
  if (!norm) return "UNKNOWN";
  if (norm === "top of search") return "TOS";
  if (norm === "rest of search") return "ROS";
  if (norm === "product pages") return "PP";
  if (norm === "home page" || norm === "homepage" || norm === "home") return "HOME";
  if (norm === "other") return "OTHER";
  const safe = norm
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe || "UNKNOWN";
}

function getBiddingStrategy(row: Record<string, unknown>): string {
  const candidates = ["Bid Optimization", "Bidding Strategy", "Bid Strategy"];
  for (const key of candidates) {
    const value = String(getCell(row, key) ?? "").trim();
    if (value) return value;
  }
  return "";
}

export async function parseSponsoredBrandsBulk(xlsxPath: string, snapshotDate: string) {
  const workbook = XLSX.readFile(xlsxPath, { dense: true });

  const campaigns: SbCampaignRow[] = [];
  const adGroups: SbAdGroupRow[] = [];
  const targets: SbTargetRow[] = [];
  const placements: SbPlacementRow[] = [];

  const seenCampaigns = new Set<string>();
  const seenAdGroups = new Set<string>();
  const seenTargets = new Set<string>();
  const seenPlacements = new Set<string>();

  function handleCampaignRow(row: Record<string, unknown>) {
    const campaignId = cleanId(getCell(row, "Campaign ID"));
    if (campaignId && seenCampaigns.has(campaignId)) return;
    if (campaignId) seenCampaigns.add(campaignId);
    const campaignNameRaw = String(getCell(row, "Campaign Name") ?? "").trim();
    campaigns.push({
      campaignId,
      campaignNameRaw,
      campaignNameNorm: normText(campaignNameRaw),
      portfolioId: cleanId(getCell(row, "Portfolio ID")),
      state: String(getCell(row, "State") ?? "").trim(),
      dailyBudget: parseNumber(getCell(row, "Daily Budget")),
      biddingStrategy: getBiddingStrategy(row),
    });
  }

  function handleTargetRow(row: Record<string, unknown>, entityLower: string) {
    const isKeyword = entityLower.includes("keyword");
    const isProductTargeting = entityLower.includes("product targeting");
    if (!isKeyword && !isProductTargeting) return;

    const targetId = cleanId(
      isKeyword ? getCell(row, "Keyword ID") : getCell(row, "Product Targeting ID")
    );
    if (targetId && seenTargets.has(targetId)) return;
    if (targetId) seenTargets.add(targetId);
    const expressionRaw = String(
      isKeyword ? getCell(row, "Keyword Text") : getCell(row, "Product Targeting Expression")
    ).trim();
    const matchType = isKeyword
      ? String(getCell(row, "Match Type") ?? "").trim()
      : "TARGETING_EXPRESSION";
    const isNegative = entityLower.includes("negative");
    targets.push({
      targetId,
      adGroupId: cleanId(getCell(row, "Ad Group ID")),
      campaignId: cleanId(getCell(row, "Campaign ID")),
      expressionRaw,
      expressionNorm: normText(expressionRaw),
      matchType,
      isNegative,
      state: String(getCell(row, "State") ?? "").trim(),
      bid: isNegative ? null : parseNumber(getCell(row, "Bid")),
    });

    const adGroupId = cleanId(getCell(row, "Ad Group ID"));
    const adGroupNameRaw = String(getCell(row, "Ad Group Name") ?? "").trim();
    if (adGroupId && !seenAdGroups.has(adGroupId) && !adGroupNameRaw) {
      seenAdGroups.add(adGroupId);
      const syntheticName = "Ad group";
      adGroups.push({
        adGroupId,
        campaignId: cleanId(getCell(row, "Campaign ID")),
        adGroupNameRaw: syntheticName,
        adGroupNameNorm: normText(syntheticName),
        state: "",
        defaultBid: null,
      });
    }
  }

  const campaignSheet = workbook.Sheets["Sponsored Brands Campaigns"];
  if (campaignSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(campaignSheet, {
      raw: false,
      defval: "",
    });

    for (const row of rows) {
      const entity = normalizeEntity(getCell(row, "Entity"));

      if (entity === "Campaign") {
        handleCampaignRow(row);
        continue;
      }

      const entityLower = entity.toLowerCase();
      handleTargetRow(row, entityLower);
    }
  }

  const multiSheet = workbook.Sheets["SB Multi Ad Group Campaigns"];
  if (multiSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(multiSheet, {
      raw: false,
      defval: "",
    });

    for (const row of rows) {
      const entity = normalizeEntity(getCell(row, "Entity"));

      if (entity === "Campaign") {
        handleCampaignRow(row);
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

      const entityLower = entity.toLowerCase();
      handleTargetRow(row, entityLower);

      if (entity === "Bidding Adjustment by Placement") {
        const campaignId = cleanId(getCell(row, "Campaign ID"));
        const placementRaw = String(getCell(row, "Placement") ?? "").trim();
        const placementRawNorm = normText(placementRaw);
        const placementCode = normalizePlacementCode(placementRaw);
        const key = `${campaignId ?? ""}::${placementCode}::${placementRawNorm}`;
        if (seenPlacements.has(key)) continue;
        seenPlacements.add(key);
        placements.push({
          campaignId,
          placementRaw,
          placementRawNorm,
          placementCode,
          percentage: parseNumber(getCell(row, "Percentage")),
        });
        continue;
      }
    }
  }

  return {
    snapshotDate,
    campaigns,
    adGroups,
    targets,
    placements,
  } satisfies SponsoredBrandsSnapshot;
}
