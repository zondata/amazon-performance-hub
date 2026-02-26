'use client';

import { useMemo, useState } from 'react';

type TimelineEvent = {
  id: string;
  run_id: string | null;
  event_type: string;
  event_date: string | null;
  occurred_at: string;
  payload_json: unknown;
};

type Props = {
  events: TimelineEvent[];
  interruptionEventIds: string[];
};

type EventFilter = 'all' | 'interruptions';

const INTERRUPTION_TYPES = new Set([
  'guardrail_breach',
  'manual_intervention',
  'stop_loss',
  'rollback',
]);

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const formatEventTypeLabel = (value: string): string => value.replace(/_/g, ' ');

const extractNotes = (payload: unknown): string => {
  const objectPayload = asObject(payload);
  if (!objectPayload) return '—';
  return (
    asString(objectPayload.notes) ??
    asString(objectPayload.note) ??
    asString(objectPayload.summary) ??
    asString(objectPayload.message) ??
    asString(objectPayload.reason) ??
    '—'
  );
};

export default function ExperimentEventsTimeline({ events, interruptionEventIds }: Props) {
  const [filter, setFilter] = useState<EventFilter>('all');

  const interruptionIdSet = useMemo(() => new Set(interruptionEventIds), [interruptionEventIds]);

  const sortedEvents = useMemo(() => {
    return [...events].sort((left, right) => {
      const occurredCompare = right.occurred_at.localeCompare(left.occurred_at);
      if (occurredCompare !== 0) return occurredCompare;
      return right.id.localeCompare(left.id);
    });
  }, [events]);

  const visibleEvents = useMemo(() => {
    if (filter === 'all') return sortedEvents;
    return sortedEvents.filter(
      (event) => interruptionIdSet.has(event.id) || INTERRUPTION_TYPES.has(event.event_type)
    );
  }, [filter, interruptionIdSet, sortedEvents]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Events timeline</div>
          <div className="text-xs text-muted">{visibleEvents.length} shown</div>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-surface-2 p-1 text-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-md px-3 py-1.5 ${
              filter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted hover:bg-surface'
            }`}
          >
            All events
          </button>
          <button
            type="button"
            onClick={() => setFilter('interruptions')}
            className={`rounded-md px-3 py-1.5 ${
              filter === 'interruptions'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted hover:bg-surface'
            }`}
          >
            Interruptions only
          </button>
        </div>
      </div>

      {visibleEvents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
          No events for this filter.
        </div>
      ) : (
        <div className="space-y-2">
          {visibleEvents.map((event) => {
            const isInterruption =
              interruptionIdSet.has(event.id) || INTERRUPTION_TYPES.has(event.event_type);

            return (
              <div
                key={event.id}
                className={`rounded-lg border p-3 ${
                  isInterruption
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-border bg-surface-2'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>{formatDateTime(event.occurred_at)}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 ${
                      isInterruption
                        ? 'border-primary/60 bg-primary/10 text-foreground'
                        : 'border-border bg-surface text-muted'
                    }`}
                  >
                    {formatEventTypeLabel(event.event_type)}
                  </span>
                  {event.run_id ? (
                    <code className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-foreground">
                      {event.run_id}
                    </code>
                  ) : null}
                  {event.event_date ? (
                    <span className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px]">
                      {event.event_date}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-sm text-foreground">{extractNotes(event.payload_json)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
