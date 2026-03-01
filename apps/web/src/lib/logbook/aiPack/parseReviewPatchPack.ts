import {
  REVIEW_PATCH_PACK_KIND_V1,
  REVIEW_PATCH_PACK_VERSION_V1,
  type PatchDecisionModeV1,
  type PatchDecisionV1,
  type ReviewPatchPackV1,
  type WorkflowModeV1,
} from '../contracts/adsOptimizationContractV1';

type JsonRecord = Record<string, unknown>;

export type ParseReviewPatchPackResult =
  | { ok: true; value: ReviewPatchPackV1 }
  | { ok: false; error: string };

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const asWorkflowMode = (value: unknown): WorkflowModeV1 | null => {
  const normalized = asString(value)?.toLowerCase();
  if (normalized === 'manual' || normalized === 'api') {
    return normalized;
  }
  return null;
};

const asDecisionMode = (value: unknown): PatchDecisionModeV1 | null => {
  const normalized = asString(value)?.toLowerCase();
  if (normalized === 'accept' || normalized === 'reject' || normalized === 'modify') {
    return normalized;
  }
  return null;
};

const parseDecision = (value: unknown, index: number): { ok: true; value: PatchDecisionV1 } | { ok: false; error: string } => {
  const row = asRecord(value);
  if (!row) {
    return { ok: false, error: `patch.decisions[${index}] must be an object.` };
  }

  const changeId = asString(row.change_id);
  if (!changeId) {
    return { ok: false, error: `patch.decisions[${index}].change_id is required.` };
  }

  const decision = asDecisionMode(row.decision);
  if (!decision) {
    return { ok: false, error: `patch.decisions[${index}].decision must be accept|reject|modify.` };
  }

  const nestedOverride = asRecord(row.override);
  const override = asFiniteNumber(row.override_new_value ?? nestedOverride?.new_value);

  return {
    ok: true,
    value: {
      ...row,
      change_id: changeId,
      decision,
      ...(override !== null ? { override_new_value: override } : {}),
      ...(asString(row.note) ? { note: asString(row.note) as string } : {}),
    },
  };
};

export const parseReviewPatchPack = (
  rawText: string,
  options?: {
    expectedExperimentId?: string;
  }
): ParseReviewPatchPackResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: 'Invalid JSON payload.' };
  }

  const root = asRecord(parsed);
  if (!root) {
    return { ok: false, error: 'Payload must be a JSON object.' };
  }

  const kind = asString(root.kind);
  if (kind !== REVIEW_PATCH_PACK_KIND_V1) {
    return { ok: false, error: `kind must be ${REVIEW_PATCH_PACK_KIND_V1}.` };
  }

  const packVersion = asString(root.pack_version);
  if (packVersion !== REVIEW_PATCH_PACK_VERSION_V1) {
    return { ok: false, error: `pack_version must be ${REVIEW_PATCH_PACK_VERSION_V1}.` };
  }

  const packId = asString(root.pack_id);
  if (!packId) {
    return { ok: false, error: 'pack_id is required.' };
  }

  const createdAt = asString(root.created_at);
  if (!createdAt) {
    return { ok: false, error: 'created_at is required.' };
  }

  const links = asRecord(root.links);
  if (!links) {
    return { ok: false, error: 'links is required.' };
  }

  const experimentId = asString(links.experiment_id);
  if (!experimentId) {
    return { ok: false, error: 'links.experiment_id is required.' };
  }
  const expectedExperimentId = asString(options?.expectedExperimentId);
  if (expectedExperimentId && expectedExperimentId !== experimentId) {
    return {
      ok: false,
      error: `links.experiment_id (${experimentId}) must match selected experiment (${expectedExperimentId}).`,
    };
  }

  const trace = asRecord(root.trace);
  if (!trace) {
    return { ok: false, error: 'trace is required.' };
  }

  const workflowMode = asWorkflowMode(trace.workflow_mode);
  if (!workflowMode) {
    return { ok: false, error: 'trace.workflow_mode must be manual|api.' };
  }

  const patch = asRecord(root.patch);
  if (!patch) {
    return { ok: false, error: 'patch is required.' };
  }

  const decisionsRaw = Array.isArray(patch.decisions) ? patch.decisions : null;
  if (!decisionsRaw || decisionsRaw.length === 0) {
    return { ok: false, error: 'patch.decisions must be a non-empty array.' };
  }

  const decisions: PatchDecisionV1[] = [];
  for (let index = 0; index < decisionsRaw.length; index += 1) {
    const parsedDecision = parseDecision(decisionsRaw[index], index);
    if (!parsedDecision.ok) return parsedDecision;
    decisions.push(parsedDecision.value);
  }

  return {
    ok: true,
    value: {
      ...root,
      kind: REVIEW_PATCH_PACK_KIND_V1,
      pack_version: REVIEW_PATCH_PACK_VERSION_V1,
      pack_id: packId,
      created_at: createdAt,
      links: {
        ...links,
        experiment_id: experimentId,
        proposal_pack_id: asString(links.proposal_pack_id) ?? undefined,
      },
      trace: {
        ...trace,
        workflow_mode: workflowMode,
        model: asString(trace.model) ?? undefined,
        prompt_template_id: asString(trace.prompt_template_id) ?? undefined,
      },
      patch: {
        ...patch,
        decisions,
        notes: asString(patch.notes) ?? undefined,
      },
    },
  };
};

export const REVIEW_PATCH_PACK_KIND = REVIEW_PATCH_PACK_KIND_V1;
