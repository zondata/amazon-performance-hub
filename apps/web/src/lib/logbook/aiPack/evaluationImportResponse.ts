import type { ImportExperimentEvaluationOutputPackResult } from './importExperimentEvaluationOutputPack';

export type EvaluationImportAppliedSummary = {
  kiv: {
    created: number;
    updated: number;
    status_changed: number;
    matched_by_id: number;
    matched_by_title: number;
  };
  events: {
    created: number;
  };
  memory: {
    updated: boolean;
  };
};

export type EvaluationImportSuccessResponse = Omit<
  ImportExperimentEvaluationOutputPackResult,
  'ok' | 'applied' | 'warnings'
> & {
  ok: true;
  applied: EvaluationImportAppliedSummary;
  warnings: string[];
};

const toFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toAppliedSummary = (
  value: ImportExperimentEvaluationOutputPackResult['applied']
): EvaluationImportAppliedSummary => ({
  kiv: {
    created: toFiniteNumber(value?.kiv.created),
    updated: toFiniteNumber(value?.kiv.updated),
    status_changed: toFiniteNumber(value?.kiv.status_changed),
    matched_by_id: toFiniteNumber(value?.kiv.matched_by_id),
    matched_by_title: toFiniteNumber(value?.kiv.matched_by_title),
  },
  events: {
    created: toFiniteNumber(value?.events.created),
  },
  memory: {
    updated: Boolean(value?.memory.updated),
  },
});

export const normalizeEvaluationImportSuccess = (
  result: ImportExperimentEvaluationOutputPackResult
): EvaluationImportSuccessResponse => {
  if (!result.ok) {
    throw new Error('normalizeEvaluationImportSuccess expects a successful result.');
  }

  return {
    ...result,
    ok: true,
    applied: toAppliedSummary(result.applied),
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
  };
};
