'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type KivItem = {
  kiv_id: string;
  status: 'open' | 'done' | 'dismissed';
  title: string;
  details: string | null;
  resolution_notes: string | null;
  due_date: string | null;
  priority: number | null;
  created_at: string;
  resolved_at: string | null;
  tags: string[] | null;
};

type Props = {
  asin: string;
  initialOpenItems: KivItem[];
  initialRecentlyClosedItems: KivItem[];
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

export default function ProductKivBacklogManager({
  asin,
  initialOpenItems,
  initialRecentlyClosedItems,
}: Props) {
  const router = useRouter();
  const [openItems, setOpenItems] = useState(initialOpenItems);
  const [recentlyClosedItems, setRecentlyClosedItems] = useState(initialRecentlyClosedItems);
  const [newTitle, setNewTitle] = useState('');
  const [newDetails, setNewDetails] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedOpen = useMemo(
    () => [...openItems].sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [openItems]
  );
  const sortedClosed = useMemo(
    () =>
      [...recentlyClosedItems].sort((left, right) => {
        const leftAt = left.resolved_at ?? left.created_at;
        const rightAt = right.resolved_at ?? right.created_at;
        return rightAt.localeCompare(leftAt);
      }),
    [recentlyClosedItems]
  );

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setError(null);

    setIsCreating(true);
    try {
      const response = await fetch(`/products/${encodeURIComponent(asin)}/kiv`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: newTitle,
          details: newDetails,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorText(response));
      }

      const payload = (await response.json()) as { item?: KivItem };
      if (!payload.item) {
        throw new Error('KIV create response missing item.');
      }

      setOpenItems((current) => [payload.item as KivItem, ...current]);
      setNewTitle('');
      setNewDetails('');
      setNotice('KIV item added.');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to add KIV item.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>, item: KivItem) => {
    event.preventDefault();
    setNotice(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const status = String(formData.get('status') ?? 'open');
    const resolutionNotes = String(formData.get('resolution_notes') ?? '').trim();

    try {
      const response = await fetch(
        `/products/${encodeURIComponent(asin)}/kiv/${encodeURIComponent(item.kiv_id)}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            status,
            resolution_notes: resolutionNotes,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await readErrorText(response));
      }

      const payload = (await response.json()) as { item?: KivItem };
      if (!payload.item) {
        throw new Error('KIV update response missing item.');
      }

      const updated = payload.item as KivItem;
      if (updated.status === 'open') {
        setOpenItems((current) => {
          const rest = current.filter((row) => row.kiv_id !== updated.kiv_id);
          return [updated, ...rest];
        });
        setRecentlyClosedItems((current) =>
          current.filter((row) => row.kiv_id !== updated.kiv_id)
        );
      } else {
        setOpenItems((current) => current.filter((row) => row.kiv_id !== updated.kiv_id));
        setRecentlyClosedItems((current) => {
          const rest = current.filter((row) => row.kiv_id !== updated.kiv_id);
          return [updated, ...rest];
        });
      }

      setNotice(`KIV item ${updated.status === 'open' ? 'updated' : 'closed'}.`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to update KIV item.');
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-muted">KIV backlog</div>
        <div className="mt-1 text-lg font-semibold text-foreground">Keep-in-view items for {asin}</div>
      </div>

      <form onSubmit={handleCreate} className="space-y-2 rounded-lg border border-border bg-surface p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Add item</div>
        <input
          type="text"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="Title"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          required
        />
        <textarea
          value={newDetails}
          onChange={(event) => setNewDetails(event.target.value)}
          rows={2}
          placeholder="Details (optional)"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isCreating}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating ? 'Adding…' : 'Add KIV item'}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        <div className="text-sm font-semibold text-foreground">Open items</div>
        {sortedOpen.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
            No open KIV items.
          </div>
        ) : (
          sortedOpen.map((item) => (
            <form
              key={item.kiv_id}
              onSubmit={(event) => handleUpdate(event, item)}
              className="space-y-2 rounded-lg border border-border bg-surface p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">{item.title}</div>
                  {item.details ? <div className="text-xs text-muted">{item.details}</div> : null}
                  <div className="mt-1 text-[11px] text-muted">Created {formatDateTime(item.created_at)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    name="status"
                    defaultValue={item.status}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground"
                  >
                    <option value="open">open</option>
                    <option value="done">done</option>
                    <option value="dismissed">dismissed</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg border border-border bg-surface px-3 py-1 text-xs font-semibold text-foreground hover:bg-surface-2"
                  >
                    Save
                  </button>
                </div>
              </div>
              <textarea
                name="resolution_notes"
                rows={2}
                defaultValue={item.resolution_notes ?? ''}
                placeholder="Resolution notes"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground"
              />
            </form>
          ))
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold text-foreground">Recently closed (30 days)</div>
        {sortedClosed.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-3 text-sm text-muted">
            No recently closed KIV items.
          </div>
        ) : (
          <div className="space-y-2">
            {sortedClosed.slice(0, 20).map((item) => (
              <div key={item.kiv_id} className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
                <div className="font-semibold text-foreground">{item.title}</div>
                <div className="text-muted">
                  status {item.status} · resolved {formatDateTime(item.resolved_at ?? item.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-5 text-xs">
        {notice ? <span className="text-emerald-700">{notice}</span> : null}
        {error ? <span className="text-rose-700">{error}</span> : null}
      </div>
    </div>
  );
}
