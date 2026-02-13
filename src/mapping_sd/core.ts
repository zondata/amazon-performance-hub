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
  campaign_id: string;
  target_type: string;
};

export type AdCandidate = {
  ad_id: string;
  ad_group_id: string;
  campaign_id: string;
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
  targetByCampaignKey: Map<string, TargetCandidate[]>;
  targetById: Map<string, TargetCandidate>;
  adByGroupSku: Map<string, AdCandidate[]>;
  adByGroupAsin: Map<string, AdCandidate[]>;
  adById: Map<string, AdCandidate>;
  portfolioByName: Map<string, string[]>;
  campaignHistoryByName: Map<string, NameHistoryRow[]>;
  adGroupHistoryByName: Map<string, NameHistoryRow[]>;
  overridesByName: Map<string, ManualOverrideRow[]>;
};

export type MappingIssue = {
  entity_level: "campaign" | "ad_group" | "target" | "ad" | "snapshot";
  issue_type: "unmapped" | "ambiguous" | "missing_bulk_snapshot";
  key_json: Record<string, unknown>;
  candidates_json?: CandidateInfo[] | null;
  row_count: number;
};

function dateToUtcMs(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function pickBulkSnapshotFromList(exportedAtDate: string, snapshotDates: string[]): string | null {
  if (!snapshotDates.length) return null;
  const sorted = [...new Set(snapshotDates)].sort();
  const beforeOrEqual = sorted.filter((d) => d <= exportedAtDate);
  const exportedMs = dateToUtcMs(exportedAtDate);
  const chosenBefore = beforeOrEqual.length ? beforeOrEqual[beforeOrEqual.length - 1] ?? null : null;
  const after = sorted
    .map((d) => ({ d, diff: dateToUtcMs(d) - exportedMs }))
    .filter((row) => row.diff > 0 && row.diff <= 7 * 24 * 60 * 60 * 1000)
    .sort((a, b) => a.diff - b.diff);
  const chosenAfter = after[0]?.d ?? null;

  if (chosenBefore && chosenAfter) {
    const beforeDiff = exportedMs - dateToUtcMs(chosenBefore);
    const afterDiff = dateToUtcMs(chosenAfter) - exportedMs;
    if (afterDiff < beforeDiff) return chosenAfter;
    return chosenBefore;
  }
  return chosenBefore ?? chosenAfter;
}

function isWithinRange(dateIso: string, start: string | null, end: string | null): boolean {
  if (start && dateIso < start) return false;
  if (end && dateIso > end) return false;
  return true;
}

function resolveFromCandidates(candidates: CandidateInfo[] | undefined): ResolvedId | null {
  if (!candidates || !candidates.length) return null;
  const unique = [...new Set(candidates.map((c) => c.entity_id))].sort();
  if (unique.length === 1) return { status: "ok", id: unique[0] };
  return { status: "ambiguous", candidates };
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
  if (overrideResult) return overrideResult;

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

export function resolveTargetId(params: {
  adGroupId: string;
  expressionNorm: string;
  referenceDate: string;
  lookup: BulkLookup;
}): ResolvedId {
  const { adGroupId, expressionNorm, referenceDate, lookup } = params;
  const overrideKey = `target::${expressionNorm}`;
  const overrideResult = resolveByOverrides(lookup.overridesByName.get(overrideKey), referenceDate);
  if (overrideResult?.status === "ok") {
    const candidate = lookup.targetById.get(overrideResult.id);
    if (!candidate || candidate.ad_group_id !== adGroupId) {
      return { status: "unmapped" };
    }
    return overrideResult;
  }
  if (overrideResult) return overrideResult;

  const key = `${adGroupId}::${expressionNorm}`;
  const snapshotCandidates = (lookup.targetByAdGroupKey.get(key) ?? []).map((row) => ({
    entity_id: row.target_id,
    source: "snapshot" as const,
  }));
  const snapshotResult = resolveFromCandidates(snapshotCandidates);
  if (snapshotResult) return snapshotResult;

  return { status: "unmapped" };
}

export function resolveTargetIdByCampaign(params: {
  campaignId: string;
  adGroupId: string | null;
  expressionNorm: string;
  referenceDate: string;
  lookup: BulkLookup;
}): ResolvedId {
  const { campaignId, adGroupId, expressionNorm, referenceDate, lookup } = params;
  if (adGroupId) {
    const adGroupResult = resolveTargetId({
      adGroupId,
      expressionNorm,
      referenceDate,
      lookup,
    });
    if (adGroupResult.status !== "unmapped") return adGroupResult;
  }

  const overrideKey = `target::${expressionNorm}`;
  const overrideResult = resolveByOverrides(lookup.overridesByName.get(overrideKey), referenceDate);
  if (overrideResult) return overrideResult;

  const key = `${campaignId}::${expressionNorm}`;
  const snapshotCandidates = (lookup.targetByCampaignKey.get(key) ?? []).map((row) => ({
    entity_id: row.target_id,
    source: "snapshot" as const,
  }));
  const snapshotResult = resolveFromCandidates(snapshotCandidates);
  if (snapshotResult) return snapshotResult;

  return { status: "unmapped" };
}

export function resolveAdId(params: {
  adGroupId: string;
  skuNorm: string | null;
  asinNorm: string | null;
  referenceDate: string;
  lookup: BulkLookup;
}): ResolvedId {
  const { adGroupId, skuNorm, asinNorm, referenceDate, lookup } = params;
  const overrideKey = `ad::${skuNorm || asinNorm || ""}`;
  const overrideResult = resolveByOverrides(lookup.overridesByName.get(overrideKey), referenceDate);
  if (overrideResult?.status === "ok") {
    const candidate = lookup.adById.get(overrideResult.id);
    if (!candidate || candidate.ad_group_id !== adGroupId) {
      return { status: "unmapped" };
    }
    return overrideResult;
  }
  if (overrideResult) return overrideResult;

  const skuKey = skuNorm ? `${adGroupId}::${skuNorm}` : null;
  const asinKey = asinNorm ? `${adGroupId}::${asinNorm}` : null;

  if (skuKey) {
    const snapshotCandidates = (lookup.adByGroupSku.get(skuKey) ?? []).map((row) => ({
      entity_id: row.ad_id,
      source: "snapshot" as const,
    }));
    const snapshotResult = resolveFromCandidates(snapshotCandidates);
    if (snapshotResult) return snapshotResult;
  }

  if (asinKey) {
    const snapshotCandidates = (lookup.adByGroupAsin.get(asinKey) ?? []).map((row) => ({
      entity_id: row.ad_id,
      source: "snapshot" as const,
    }));
    const snapshotResult = resolveFromCandidates(snapshotCandidates);
    if (snapshotResult) return snapshotResult;
  }

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

export function buildTargetKey(signature: {
  campaign_name_norm: string;
  portfolio_name_norm: string | null;
  ad_group_name_norm: string;
  targeting_norm: string;
  match_type_norm: string | null;
  cost_type: string | null;
}): string {
  return JSON.stringify({
    campaign_name_norm: signature.campaign_name_norm,
    portfolio_name_norm: signature.portfolio_name_norm ?? null,
    ad_group_name_norm: signature.ad_group_name_norm,
    targeting_norm: signature.targeting_norm,
    match_type_norm: signature.match_type_norm ?? null,
    cost_type: signature.cost_type ?? null,
  });
}

export function buildAdKey(signature: {
  campaign_name_norm: string;
  portfolio_name_norm: string | null;
  ad_group_name_norm: string;
  advertised_sku_norm: string | null;
  advertised_asin_norm: string | null;
  cost_type: string | null;
}): string {
  return JSON.stringify({
    campaign_name_norm: signature.campaign_name_norm,
    portfolio_name_norm: signature.portfolio_name_norm ?? null,
    ad_group_name_norm: signature.ad_group_name_norm,
    advertised_sku_norm: signature.advertised_sku_norm ?? null,
    advertised_asin_norm: signature.advertised_asin_norm ?? null,
    cost_type: signature.cost_type ?? null,
  });
}
