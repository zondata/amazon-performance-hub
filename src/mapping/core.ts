export type CandidateInfo = {
  entity_id: string;
  source: "override" | "snapshot" | "history";
  valid_from?: string | null;
  valid_to?: string | null;
};

export type ResolvedId =
  | { status: "ok"; id: string }
  | { status: "ambiguous"; candidates: CandidateInfo[] }
  | { status: "unmapped"; candidates?: CandidateInfo[] };

export type CampaignCandidate = {
  campaign_id: string;
  portfolio_id: string | null;
};

export type AdGroupCandidate = {
  ad_group_id: string;
  campaign_id: string;
};

export type TargetCandidate = {
  target_id: string;
  ad_group_id: string;
  match_type_norm: string;
  is_negative: boolean;
};

export type NameHistoryRow = {
  entity_id: string;
  name_norm: string;
  valid_from: string;
  valid_to: string | null;
  campaign_id?: string | null;
};

export type ManualOverrideRow = {
  entity_id: string;
  name_norm: string;
  valid_from: string | null;
  valid_to: string | null;
};

export type BulkLookup = {
  campaignByName: Map<string, CampaignCandidate[]>;
  campaignById: Map<string, CampaignCandidate>;
  adGroupByCampaignName: Map<string, AdGroupCandidate[]>;
  adGroupById: Map<string, AdGroupCandidate>;
  targetByAdGroupKey: Map<string, TargetCandidate[]>;
  targetById: Map<string, TargetCandidate>;
  portfolioByName: Map<string, string[]>;
  campaignHistoryByName: Map<string, NameHistoryRow[]>;
  adGroupHistoryByName: Map<string, NameHistoryRow[]>;
  overridesByName: Map<string, ManualOverrideRow[]>;
};

export type MappingIssue = {
  entity_level: "campaign" | "ad_group" | "target" | "snapshot";
  issue_type: "unmapped" | "ambiguous" | "missing_bulk_snapshot";
  key_json: Record<string, unknown>;
  candidates_json?: CandidateInfo[] | null;
  row_count: number;
};

export function normalizeMatchType(raw?: string | null): string {
  const norm = String(raw ?? "").trim().toUpperCase();
  if (!norm) return "UNKNOWN";
  if (norm.includes("EXACT")) return "EXACT";
  if (norm.includes("PHRASE")) return "PHRASE";
  if (norm.includes("BROAD")) return "BROAD";
  if (norm.includes("TARGET")) return "TARGETING_EXPRESSION";
  return "UNKNOWN";
}

export function inferIsNegative(matchTypeRaw?: string | null): boolean {
  return /negative/i.test(String(matchTypeRaw ?? ""));
}

export function buildTargetKey(
  adGroupId: string,
  expressionNorm: string,
  matchTypeNorm: string,
  isNegative: boolean
): string {
  return `${adGroupId}::${expressionNorm}::${matchTypeNorm}::${isNegative ? "1" : "0"}`;
}

function dateToUtcMs(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function isWithinRange(dateIso: string, start: string | null, end: string | null): boolean {
  if (start && dateIso < start) return false;
  if (end && dateIso > end) return false;
  return true;
}

export function pickBulkSnapshotFromList(exportedAtDate: string, snapshotDates: string[]): string | null {
  if (!snapshotDates.length) return null;
  const sorted = [...new Set(snapshotDates)].sort();
  const beforeOrEqual = sorted.filter((d) => d <= exportedAtDate);
  if (beforeOrEqual.length) return beforeOrEqual[beforeOrEqual.length - 1] ?? null;

  const exportedMs = dateToUtcMs(exportedAtDate);
  const after = sorted
    .map((d) => ({ d, diff: dateToUtcMs(d) - exportedMs }))
    .filter((row) => row.diff > 0 && row.diff <= 7 * 24 * 60 * 60 * 1000)
    .sort((a, b) => a.diff - b.diff);
  return after[0]?.d ?? null;
}

function resolveByOverrides(
  overrides: ManualOverrideRow[] | undefined,
  referenceDate: string
): ResolvedId | null {
  if (!overrides || !overrides.length) return null;
  const matches = overrides
    .filter((row) => isWithinRange(referenceDate, row.valid_from, row.valid_to))
    .map((row) => row.entity_id);
  const unique = [...new Set(matches)].sort();
  if (unique.length === 1) {
    return { status: "ok", id: unique[0] };
  }
  if (unique.length > 1) {
    return {
      status: "ambiguous",
      candidates: unique.map((entity_id) => ({ entity_id, source: "override" })),
    };
  }
  return null;
}

function resolveByHistory(
  historyRows: NameHistoryRow[] | undefined,
  referenceDate: string
): ResolvedId | null {
  if (!historyRows || !historyRows.length) return null;
  const matches = historyRows.filter((row) =>
    isWithinRange(referenceDate, row.valid_from, row.valid_to)
  );
  const unique = [...new Set(matches.map((row) => row.entity_id))].sort();
  if (unique.length === 1) {
    return { status: "ok", id: unique[0] };
  }
  if (unique.length > 1) {
    return {
      status: "ambiguous",
      candidates: matches.map((row) => ({
        entity_id: row.entity_id,
        source: "history",
        valid_from: row.valid_from,
        valid_to: row.valid_to,
      })),
    };
  }
  return null;
}

function resolveFromCandidates(
  candidates: CandidateInfo[] | undefined
): ResolvedId | null {
  if (!candidates || !candidates.length) return null;
  const unique = [...new Set(candidates.map((c) => c.entity_id))].sort();
  if (unique.length === 1) return { status: "ok", id: unique[0] };
  return { status: "ambiguous", candidates };
}

export function resolveCampaignId(params: {
  campaignNameNorm: string;
  portfolioNameNorm?: string | null;
  referenceDate: string;
  lookup: BulkLookup;
}): ResolvedId {
  const { campaignNameNorm, portfolioNameNorm, referenceDate, lookup } = params;
  const overrideKey = `campaign::${campaignNameNorm}`;
  const overrideResult = resolveByOverrides(lookup.overridesByName.get(overrideKey), referenceDate);
  if (overrideResult) return overrideResult;

  const candidates = lookup.campaignByName.get(campaignNameNorm) ?? [];
  let filtered = candidates;
  if (portfolioNameNorm) {
    const portfolioIds = lookup.portfolioByName.get(portfolioNameNorm) ?? [];
    if (portfolioIds.length === 1) {
      filtered = candidates.filter((row) => row.portfolio_id === portfolioIds[0]);
    }
  }

  const snapshotCandidates = filtered.map((row) => ({
    entity_id: row.campaign_id,
    source: "snapshot" as const,
  }));
  const snapshotResult = resolveFromCandidates(snapshotCandidates);
  if (snapshotResult) return snapshotResult;

  const historyResult = resolveByHistory(
    lookup.campaignHistoryByName.get(campaignNameNorm),
    referenceDate
  );
  if (historyResult) return historyResult;

  return { status: "unmapped" };
}

export function resolveAdGroupId(params: {
  campaignId: string;
  adGroupNameNorm: string;
  referenceDate: string;
  lookup: BulkLookup;
}): ResolvedId {
  const { campaignId, adGroupNameNorm, referenceDate, lookup } = params;
  const overrideKey = `ad_group::${adGroupNameNorm}`;
  const overrideResult = resolveByOverrides(lookup.overridesByName.get(overrideKey), referenceDate);
  if (overrideResult?.status === "ok") {
    const candidate = lookup.adGroupById.get(overrideResult.id);
    if (!candidate || candidate.campaign_id !== campaignId) {
      return { status: "unmapped" };
    }
    return overrideResult;
  }
  if (overrideResult && overrideResult.status !== "ok") return overrideResult;

  const key = `${campaignId}::${adGroupNameNorm}`;
  const snapshotCandidates = (lookup.adGroupByCampaignName.get(key) ?? []).map((row) => ({
    entity_id: row.ad_group_id,
    source: "snapshot" as const,
  }));
  const snapshotResult = resolveFromCandidates(snapshotCandidates);
  if (snapshotResult) return snapshotResult;

  const historyRows = lookup.adGroupHistoryByName.get(key);
  const historyResult = resolveByHistory(historyRows, referenceDate);
  if (historyResult) return historyResult;

  return { status: "unmapped" };
}

function normalizeTargetMatchType(matchTypeNorm: string | null, matchTypeRaw: string | null): string {
  const normalized = normalizeMatchType(matchTypeNorm ?? matchTypeRaw ?? "");
  if (normalized !== "UNKNOWN") return normalized;
  const raw = String(matchTypeRaw ?? "").toLowerCase();
  if (raw.includes("target")) return "TARGETING_EXPRESSION";
  return "UNKNOWN";
}

export function resolveTargetId(params: {
  adGroupId: string;
  expressionNorm: string;
  matchTypeNorm: string | null;
  matchTypeRaw: string | null;
  isNegative: boolean;
  referenceDate: string;
  lookup: BulkLookup;
}): ResolvedId {
  const { adGroupId, expressionNorm, matchTypeNorm, matchTypeRaw, isNegative, referenceDate, lookup } = params;
  const overrideKey = `target::${expressionNorm}`;
  const overrideResult = resolveByOverrides(lookup.overridesByName.get(overrideKey), referenceDate);
  if (overrideResult?.status === "ok") {
    const candidate = lookup.targetById.get(overrideResult.id);
    if (!candidate || candidate.ad_group_id !== adGroupId) {
      return { status: "unmapped" };
    }
    return overrideResult;
  }
  if (overrideResult && overrideResult.status !== "ok") return overrideResult;

  const effectiveMatchType = normalizeTargetMatchType(matchTypeNorm, matchTypeRaw);
  const key = buildTargetKey(adGroupId, expressionNorm, effectiveMatchType, isNegative);
  const snapshotCandidates = (lookup.targetByAdGroupKey.get(key) ?? []).map((row) => ({
    entity_id: row.target_id,
    source: "snapshot" as const,
  }));
  const snapshotResult = resolveFromCandidates(snapshotCandidates);
  if (snapshotResult) return snapshotResult;

  return { status: "unmapped" };
}

export function createIssueCollector() {
  const issues = new Map<string, MappingIssue>();

  function addIssue(issue: Omit<MappingIssue, "row_count"> & { row_count?: number }) {
    const key = JSON.stringify({
      entity_level: issue.entity_level,
      issue_type: issue.issue_type,
      key_json: issue.key_json,
    });
    const existing = issues.get(key);
    if (existing) {
      existing.row_count += issue.row_count ?? 1;
      return;
    }
    issues.set(key, {
      entity_level: issue.entity_level,
      issue_type: issue.issue_type,
      key_json: issue.key_json,
      candidates_json: issue.candidates_json ?? null,
      row_count: issue.row_count ?? 1,
    });
  }

  function list() {
    return Array.from(issues.values());
  }

  return { addIssue, list };
}
