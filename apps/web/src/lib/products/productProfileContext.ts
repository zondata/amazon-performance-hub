export type ProductProfileContext = {
  short_name: string | null;
  notes: string | null;
  intent: Record<string, unknown> | null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asTrimmedStringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const extractProductProfileContext = (profileJson: unknown): ProductProfileContext => {
  const profile = asRecord(profileJson);

  return {
    short_name: asTrimmedStringOrNull(profile?.short_name),
    notes: asTrimmedStringOrNull(profile?.notes),
    intent: asRecord(profile?.intent),
  };
};
