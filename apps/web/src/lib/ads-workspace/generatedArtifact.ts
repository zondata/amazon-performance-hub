import type { JsonObject } from './types';

export const ADS_OPTIMIZER_PHASE10_HANDOFF_SOURCE = 'ads_optimizer_phase10_handoff';

export type AdsWorkspaceGeneratedArtifact = {
  reviewPath: string | null;
  uploadPath: string | null;
  generatedAt: string | null;
  actionCount: number | null;
  logCreated: number | null;
  logSkipped: number | null;
};

export type AdsWorkspaceHandoffMeta = {
  source: string;
  optimizerRunId: string | null;
  selectedRowCount: number | null;
  stagedActionCount: number | null;
  dedupedActionCount: number | null;
  skippedUnsupportedActionTypes: string[];
  recommendationOverrideIds: string[];
  overriddenRowCount: number | null;
};

const asObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonObject;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const hasOwn = (value: JsonObject, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const isGeneratorArtifactShape = (value: JsonObject) =>
  asString(value.generator) !== null ||
  asNumber(value.action_count) !== null ||
  asString(value.out_dir) !== null ||
  hasOwn(value, 'log_created') ||
  hasOwn(value, 'log_skipped') ||
  asString(value.spawn_cwd) !== null;

export const readAdsWorkspaceGeneratedArtifact = (
  value: unknown
): AdsWorkspaceGeneratedArtifact | null => {
  const artifact = asObject(value);
  if (!artifact) return null;

  const reviewPath = asString(artifact.review_path);
  const uploadPath = asString(artifact.upload_strict_path);
  const generatedAt = asString(artifact.generated_at);

  const isRealArtifact =
    reviewPath !== null ||
    uploadPath !== null ||
    (generatedAt !== null && isGeneratorArtifactShape(artifact));

  if (!isRealArtifact) return null;

  return {
    reviewPath,
    uploadPath,
    generatedAt,
    actionCount: asNumber(artifact.action_count),
    logCreated: asNumber(artifact.log_created),
    logSkipped: asNumber(artifact.log_skipped),
  };
};

const readLegacyHandoffMeta = (value: unknown): AdsWorkspaceHandoffMeta | null => {
  const meta = asObject(value);
  if (!meta) return null;
  if (asString(meta.source) !== ADS_OPTIMIZER_PHASE10_HANDOFF_SOURCE) return null;
  if (readAdsWorkspaceGeneratedArtifact(meta)) return null;

  return {
    source: ADS_OPTIMIZER_PHASE10_HANDOFF_SOURCE,
    optimizerRunId: asString(meta.optimizer_run_id),
    selectedRowCount: asNumber(meta.selected_row_count),
    stagedActionCount: asNumber(meta.staged_action_count),
    dedupedActionCount: asNumber(meta.deduped_action_count),
    skippedUnsupportedActionTypes: asStringArray(meta.skipped_unsupported_action_types),
    recommendationOverrideIds: asStringArray(meta.recommendation_override_ids),
    overriddenRowCount: asNumber(meta.overridden_row_count),
  };
};

export const readAdsWorkspaceHandoffMeta = (
  filtersJson: unknown,
  generatedArtifactJson: unknown
): AdsWorkspaceHandoffMeta | null => {
  const filters = asObject(filtersJson);
  const nested = readLegacyHandoffMeta(filters?.handoff_meta);
  if (nested) return nested;
  return readLegacyHandoffMeta(generatedArtifactJson);
};
