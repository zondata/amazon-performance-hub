export type DriverIntent = {
  channel: string;
  campaign_id: string;
  intent: string;
  notes: string | null;
  constraints_json: Record<string, unknown>;
  updated_at: string;
};

export const validateIntentString = (intent: string): string => {
  const normalized = intent.trim();
  if (!normalized) {
    throw new Error('intent must be a non-empty string.');
  }
  return normalized;
};
