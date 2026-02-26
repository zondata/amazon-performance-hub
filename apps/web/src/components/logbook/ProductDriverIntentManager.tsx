'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Channel = 'sp' | 'sb' | 'sd';

type DriverIntentRow = {
  id: string;
  channel: Channel;
  campaign_id: string;
  intent: string;
  notes: string | null;
  is_driver: boolean;
  updated_at: string;
};

type Props = {
  asin: string;
  initialRows: DriverIntentRow[];
};

const readErrorText = async (response: Response): Promise<string> => {
  const text = await response.text();
  return text.trim().length > 0 ? text : `Request failed (${response.status})`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const CHANNELS: Channel[] = ['sp', 'sb', 'sd'];

export default function ProductDriverIntentManager({ asin, initialRows }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [newChannel, setNewChannel] = useState<Channel>('sp');
  const [newCampaignId, setNewCampaignId] = useState('');
  const [newIntent, setNewIntent] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderedRows = useMemo(
    () => [...rows].sort((left, right) => right.updated_at.localeCompare(left.updated_at)),
    [rows]
  );

  const patchLocalRow = (id: string, patch: Partial<DriverIntentRow>) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const handleSaveExisting = async (row: DriverIntentRow) => {
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(
        `/products/${encodeURIComponent(asin)}/driver-intents/${encodeURIComponent(row.id)}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            channel: row.channel,
            campaign_id: row.campaign_id,
            intent: row.intent,
            notes: row.notes,
            is_driver: row.is_driver,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await readErrorText(response));
      }

      const payload = (await response.json()) as { intent?: DriverIntentRow };
      if (!payload.intent) {
        throw new Error('Driver intent update response missing row.');
      }

      setRows((current) =>
        current.map((entry) =>
          entry.id === payload.intent?.id ? (payload.intent as DriverIntentRow) : entry
        )
      );
      setNotice(`Saved driver intent ${row.campaign_id}.`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save driver intent.');
    }
  };

  const handleDelete = async (id: string) => {
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(
        `/products/${encodeURIComponent(asin)}/driver-intents/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
        }
      );
      if (!response.ok) {
        throw new Error(await readErrorText(response));
      }

      setRows((current) => current.filter((row) => row.id !== id));
      setNotice('Driver intent removed.');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to delete driver intent.');
    }
  };

  const handleAdd = async () => {
    setNotice(null);
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/products/${encodeURIComponent(asin)}/driver-intents`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          channel: newChannel,
          campaign_id: newCampaignId,
          intent: newIntent,
          notes: newNotes,
          is_driver: true,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorText(response));
      }

      const payload = (await response.json()) as { intent?: DriverIntentRow };
      if (!payload.intent) {
        throw new Error('Driver intent create response missing row.');
      }

      setRows((current) => {
        const rest = current.filter((row) => row.id !== payload.intent?.id);
        return [payload.intent as DriverIntentRow, ...rest];
      });
      setNewCampaignId('');
      setNewIntent('');
      setNewNotes('');
      setNotice('Driver intent saved.');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to add driver intent.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Driver campaign intents</div>
        <div className="mt-1 text-lg font-semibold text-foreground">Campaign-level intent classifications</div>
      </div>

      <div className="space-y-3">
        {orderedRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
            No driver campaign intents yet.
          </div>
        ) : (
          orderedRows.map((row) => (
            <div key={row.id} className="space-y-2 rounded-lg border border-border bg-surface p-3">
              <div className="grid gap-2 md:grid-cols-[110px_1fr_1fr]">
                <select
                  value={row.channel}
                  onChange={(event) => patchLocalRow(row.id, { channel: event.target.value as Channel })}
                  className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground"
                >
                  {CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel.toUpperCase()}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={row.campaign_id}
                  onChange={(event) => patchLocalRow(row.id, { campaign_id: event.target.value })}
                  placeholder="campaign_id"
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                />
                <input
                  type="text"
                  value={row.intent}
                  onChange={(event) => patchLocalRow(row.id, { intent: event.target.value })}
                  placeholder="intent"
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                />
              </div>
              <textarea
                value={row.notes ?? ''}
                onChange={(event) => patchLocalRow(row.id, { notes: event.target.value })}
                rows={2}
                placeholder="notes (optional)"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span>Updated {formatDateTime(row.updated_at)}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveExisting(row)}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-2"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(row.id)}
                    className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <details className="rounded-lg border border-border bg-surface p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">
          Add or upsert intent
        </summary>
        <div className="mt-3 space-y-2">
          <div className="grid gap-2 md:grid-cols-[110px_1fr_1fr]">
            <select
              value={newChannel}
              onChange={(event) => setNewChannel(event.target.value as Channel)}
              className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground"
            >
              {CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {channel.toUpperCase()}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newCampaignId}
              onChange={(event) => setNewCampaignId(event.target.value)}
              placeholder="campaign_id"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
            <input
              type="text"
              value={newIntent}
              onChange={(event) => setNewIntent(event.target.value)}
              placeholder="intent"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </div>
          <textarea
            value={newNotes}
            onChange={(event) => setNewNotes(event.target.value)}
            rows={2}
            placeholder="notes (optional)"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAdd}
              disabled={isSubmitting}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving…' : 'Save intent'}
            </button>
          </div>
        </div>
      </details>

      <div className="min-h-5 text-xs">
        {notice ? <span className="text-emerald-700">{notice}</span> : null}
        {error ? <span className="text-rose-700">{error}</span> : null}
      </div>
    </div>
  );
}
