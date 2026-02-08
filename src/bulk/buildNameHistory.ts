import type {
  CampaignRow,
  AdGroupRow,
  PortfolioRow,
} from "./parseSponsoredProductsBulk";

export type NameHistoryRow = {
  entityType: "campaign" | "adGroup" | "portfolio";
  entityId: string;
  nameRaw: string;
  nameNorm: string;
  validFrom: string;
  validTo: string | null;
};

type SnapshotLike = {
  snapshotDate: string;
  campaigns: CampaignRow[];
  adGroups: AdGroupRow[];
  portfolios: PortfolioRow[];
};

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const next = new Date(utc + days * 24 * 60 * 60 * 1000);
  const year = next.getUTCFullYear();
  const month = String(next.getUTCMonth() + 1).padStart(2, "0");
  const day = String(next.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildNameHistory(snapshots: SnapshotLike[]): NameHistoryRow[] {
  const ordered = [...snapshots].sort((a, b) =>
    a.snapshotDate.localeCompare(b.snapshotDate)
  );

  const history: NameHistoryRow[] = [];
  const currentByKey = new Map<string, NameHistoryRow>();

  function upsert(
    snapshotDate: string,
    entityType: NameHistoryRow["entityType"],
    entityId: string | null,
    nameRaw: string,
    nameNorm: string
  ) {
    if (!entityId) return;
    const key = `${entityType}::${entityId}`;
    const current = currentByKey.get(key);
    if (!current) {
      const row: NameHistoryRow = {
        entityType,
        entityId,
        nameRaw,
        nameNorm,
        validFrom: snapshotDate,
        validTo: null,
      };
      history.push(row);
      currentByKey.set(key, row);
      return;
    }

    if (current.nameNorm !== nameNorm) {
      current.validTo = addDays(snapshotDate, -1);
      const row: NameHistoryRow = {
        entityType,
        entityId,
        nameRaw,
        nameNorm,
        validFrom: snapshotDate,
        validTo: null,
      };
      history.push(row);
      currentByKey.set(key, row);
    }
  }

  for (const snapshot of ordered) {
    const seen = new Set<string>();

    for (const campaign of snapshot.campaigns) {
      const id = campaign.campaignId;
      if (!id) continue;
      upsert(snapshot.snapshotDate, "campaign", id, campaign.campaignNameRaw, campaign.campaignNameNorm);
      seen.add(`campaign::${id}`);
    }
    for (const adGroup of snapshot.adGroups) {
      const id = adGroup.adGroupId;
      if (!id) continue;
      upsert(snapshot.snapshotDate, "adGroup", id, adGroup.adGroupNameRaw, adGroup.adGroupNameNorm);
      seen.add(`adGroup::${id}`);
    }
    for (const portfolio of snapshot.portfolios) {
      const id = portfolio.portfolioId;
      if (!id) continue;
      upsert(snapshot.snapshotDate, "portfolio", id, portfolio.portfolioNameRaw, portfolio.portfolioNameNorm);
      seen.add(`portfolio::${id}`);
    }

    for (const [key, current] of currentByKey.entries()) {
      if (!seen.has(key) && current.validTo === null) {
        // If an entity disappears, close its row at this snapshot's date.
        current.validTo = snapshot.snapshotDate;
      }
    }
  }

  return history;
}
