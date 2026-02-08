import * as XLSX from "xlsx";

export type CampaignRow = {
  campaignId: string | null;
  campaignNameRaw: string;
  campaignNameNorm: string;
  portfolioId: string | null;
  state: string;
  dailyBudget: number | null;
  biddingStrategy: string;
};

export type AdGroupRow = {
  adGroupId: string | null;
  campaignId: string | null;
  adGroupNameRaw: string;
  adGroupNameNorm: string;
  state: string;
  defaultBid: number | null;
};

export type TargetRow = {
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

export type PlacementRow = {
  campaignId: string | null;
  placement: string;
  percentage: number | null;
};

export type PortfolioRow = {
  portfolioId: string | null;
  portfolioNameRaw: string;
  portfolioNameNorm: string;
};

export type SponsoredProductsSnapshot = {
  snapshotDate: string;
  campaigns: CampaignRow[];
  adGroups: AdGroupRow[];
  targets: TargetRow[];
  placements: PlacementRow[];
  portfolios: PortfolioRow[];
};

export function cleanId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return raw.endsWith(".0") ? raw.slice(0, -2) : raw;
}

export function normText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

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

export async function parseSponsoredProductsBulk(xlsxPath: string, snapshotDate: string) {
  const workbook = XLSX.readFile(xlsxPath, { dense: true });
  const sheet = workbook.Sheets["Sponsored Products Campaigns"];
  if (!sheet) {
    throw new Error('Sheet "Sponsored Products Campaigns" not found');
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    defval: "",
  });

  const campaigns: CampaignRow[] = [];
  const adGroups: AdGroupRow[] = [];
  const targets: TargetRow[] = [];
  const placements: PlacementRow[] = [];
  const portfolios: PortfolioRow[] = [];

  const seenCampaigns = new Set<string>();
  const seenAdGroups = new Set<string>();
  const seenTargets = new Set<string>();
  const seenPlacements = new Set<string>();
  const seenPortfolios = new Set<string>();

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
        dailyBudget: parseNumber(getCell(row, "Daily Budget")),
        biddingStrategy: String(getCell(row, "Bidding Strategy") ?? "").trim(),
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

    if (entity === "Keyword" || entity === "Product Targeting" || entity.includes("Negative")) {
      const isNegative = entity.includes("Negative");
      const isKeyword = entity === "Keyword" || entity.includes("Keyword");
      const targetId = cleanId(
        isKeyword ? getCell(row, "Keyword ID") : getCell(row, "Product Targeting ID")
      );
      if (targetId && seenTargets.has(targetId)) continue;
      if (targetId) seenTargets.add(targetId);
      const expressionRaw = String(
        isKeyword ? getCell(row, "Keyword Text") : getCell(row, "Product Targeting Expression")
      ).trim();
      const matchType = isKeyword
        ? String(getCell(row, "Match Type") ?? "").trim()
        : "TARGETING_EXPRESSION";
      targets.push({
        targetId,
        adGroupId: cleanId(getCell(row, "Ad Group ID")),
        campaignId: cleanId(getCell(row, "Campaign ID")),
        expressionRaw,
        expressionNorm: normText(expressionRaw),
        matchType,
        isNegative,
        state: String(getCell(row, "State") ?? "").trim(),
        bid: parseNumber(getCell(row, "Bid")),
      });
      continue;
    }

    if (entity === "Bidding Adjustment") {
      const campaignId = cleanId(getCell(row, "Campaign ID"));
      const placement = String(getCell(row, "Placement") ?? "").trim();
      const key = `${campaignId ?? ""}::${placement}`;
      if (seenPlacements.has(key)) continue;
      seenPlacements.add(key);
      placements.push({
        campaignId,
        placement,
        percentage: parseNumber(getCell(row, "Percentage")),
      });
      continue;
    }

    if (entity === "Portfolio") {
      const portfolioId = cleanId(getCell(row, "Portfolio ID"));
      if (portfolioId && seenPortfolios.has(portfolioId)) continue;
      if (portfolioId) seenPortfolios.add(portfolioId);
      const portfolioNameRaw = String(getCell(row, "Portfolio Name") ?? "").trim();
      portfolios.push({
        portfolioId,
        portfolioNameRaw,
        portfolioNameNorm: normText(portfolioNameRaw),
      });
      continue;
    }
  }

  return {
    snapshotDate,
    campaigns,
    adGroups,
    targets,
    placements,
    portfolios,
  } satisfies SponsoredProductsSnapshot;
}
