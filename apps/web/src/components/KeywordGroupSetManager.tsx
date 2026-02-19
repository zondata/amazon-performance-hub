'use client';

import React from 'react';

import type { KeywordGroupSummary } from '@/lib/products/getProductKeywordGroups';

type ActionState = {
  ok?: boolean;
  error?: string | null;
  action?: 'activate' | 'deactivate';
  groupSetId?: string;
};

export default function KeywordGroupSetManager(props: {
  asin: string;
  groupSets: KeywordGroupSummary[];
  setActiveAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  deactivateAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [activateState, activateAction] = React.useActionState(props.setActiveAction, {
    ok: false,
    error: null,
  });
  const [deactivateState, deactivateAction] = React.useActionState(props.deactivateAction, {
    ok: false,
    error: null,
  });

  const errorMessage = activateState?.error ?? deactivateState?.error ?? null;
  const successMessage =
    activateState?.ok && activateState?.action === 'activate'
      ? 'Set activated.'
      : deactivateState?.ok && deactivateState?.action === 'deactivate'
        ? 'Set deactivated.'
        : null;

  return (
    <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="text-lg font-semibold text-foreground">Keyword set management</div>
      </div>
      {errorMessage ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}
      {props.groupSets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-sm text-muted">
          No keyword group sets found.
        </div>
      ) : (
        <div className="space-y-3">
          {props.groupSets.map((groupSet) => (
            <div
              key={groupSet.group_set_id}
              className="rounded-xl border border-border bg-surface px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {groupSet.name}
                    {groupSet.is_active ? (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        Active
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {groupSet.created_at ?? '-'} ·{' '}
                    {groupSet.is_exclusive ? 'Exclusive' : 'Non-exclusive'}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span>
                    Groups{' '}
                    <strong className="text-foreground">{groupSet.group_count}</strong>
                  </span>
                  <span>
                    Keywords{' '}
                    <strong className="text-foreground">{groupSet.keyword_count}</strong>
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {groupSet.groups.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border bg-surface-2 px-3 py-1 text-xs text-muted">
                    No groups in this set.
                  </div>
                ) : (
                  groupSet.groups.map((group) => (
                    <div
                      key={group.group_id}
                      className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted"
                    >
                      {group.name} — {group.keyword_count}
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {groupSet.is_active ? (
                  <form action={deactivateAction}>
                    <input type="hidden" name="group_set_id" value={groupSet.group_set_id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-surface-2"
                    >
                      Deactivate
                    </button>
                  </form>
                ) : (
                  <form action={activateAction}>
                    <input type="hidden" name="group_set_id" value={groupSet.group_set_id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
                    >
                      Set active
                    </button>
                  </form>
                )}
                <a
                  href={`/products/${props.asin}/keywords/export?set=${groupSet.group_set_id}`}
                  download
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-surface-2"
                >
                  Download grouped CSV
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
