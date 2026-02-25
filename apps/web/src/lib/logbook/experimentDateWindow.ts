const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type JsonObject = Record<string, unknown>;

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonObject;
};

const minMaxDates = (dates: string[]): { min: string; max: string } | null => {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort((a, b) => a.localeCompare(b));
  return { min: sorted[0], max: sorted[sorted.length - 1] };
};

export const parseDateOnly = (value: unknown): string | null => {
  const text = asString(value);
  if (!text || !DATE_RE.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === text ? text : null;
};

export const toDateOnlyFromIso = (iso: string): string | null => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

export const deriveExperimentDateWindow = (args: {
  scope: unknown | null;
  changes: Array<{ occurred_at: string; validated_snapshot_date?: string | null }>;
}): {
  startDate: string | null;
  endDate: string | null;
  source: 'scope' | 'validated_snapshot_dates' | 'linked_changes' | 'missing';
} => {
  const scope = asObject(args.scope);
  const scopeStart = parseDateOnly(scope?.start_date);
  const scopeEnd = parseDateOnly(scope?.end_date);
  if (scopeStart && scopeEnd) {
    return {
      startDate: scopeStart,
      endDate: scopeEnd,
      source: 'scope',
    };
  }

  const snapshotDates = args.changes
    .map((change) => parseDateOnly(change.validated_snapshot_date))
    .filter((value): value is string => Boolean(value));
  const snapshotWindow = minMaxDates(snapshotDates);
  if (snapshotWindow) {
    return {
      startDate: snapshotWindow.min,
      endDate: snapshotWindow.max,
      source: 'validated_snapshot_dates',
    };
  }

  const linkedDates = args.changes
    .map((change) => toDateOnlyFromIso(change.occurred_at))
    .filter((value): value is string => Boolean(value));
  const linkedWindow = minMaxDates(linkedDates);
  if (linkedWindow) {
    return {
      startDate: linkedWindow.min,
      endDate: linkedWindow.max,
      source: 'linked_changes',
    };
  }

  return { startDate: null, endDate: null, source: 'missing' };
};
