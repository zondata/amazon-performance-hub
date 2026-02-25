export type KivStatus = 'open' | 'done' | 'dismissed';

export type KivCarryForward<T> = {
  open: Array<T & { status: KivStatus }>;
  recently_closed: Array<T & { status: KivStatus }>;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const asTimestamp = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeKivStatus = (value: unknown): KivStatus => {
  if (typeof value !== 'string') return 'open';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'done') return 'done';
  if (normalized === 'dismissed') return 'dismissed';
  return 'open';
};

export const deriveKivCarryForward = <T extends { status?: unknown; resolved_at?: unknown; created_at?: unknown }>(
  items: T[]
): KivCarryForward<T> => {
  const cutoffMs = Date.now() - THIRTY_DAYS_MS;
  const open: Array<T & { status: KivStatus }> = [];
  const recentlyClosed: Array<T & { status: KivStatus }> = [];

  for (const item of items) {
    const status = normalizeKivStatus(item.status);
    const normalizedItem = {
      ...item,
      status,
    } as T & { status: KivStatus };

    if (status === 'open') {
      open.push(normalizedItem);
      continue;
    }

    const resolvedMs = asTimestamp(item.resolved_at) ?? asTimestamp(item.created_at);
    if (resolvedMs !== null && resolvedMs >= cutoffMs) {
      recentlyClosed.push(normalizedItem);
    }
  }

  return {
    open,
    recently_closed: recentlyClosed,
  };
};
