'use client';

import { useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import KpiCards from '@/components/KpiCards';
import SpChangeComposer from '@/components/ads/SpChangeComposer';
import SpTargetsTable from '@/components/ads/SpTargetsTable';
import type { SpTargetsWorkspaceRow } from '@/lib/ads/spTargetsWorkspaceModel';
import type { SaveSpDraftActionState } from '@/lib/ads-workspace/spChangeComposerState';
import type { AdsObjectivePreset, JsonObject } from '@/lib/ads-workspace/types';

type SaveSpDraftAction = (
  prevState: SaveSpDraftActionState,
  formData: FormData
) => Promise<SaveSpDraftActionState>;

type KpiItem = {
  label: string;
  value: string;
  subvalue?: string;
};

type ActiveDraftSummary = {
  id: string;
  name: string;
  queueCount: number;
} | null;

type AdsTargetsWorkspaceClientProps = {
  rows: SpTargetsWorkspaceRow[];
  kpiItems: KpiItem[];
  filtersJson: JsonObject;
  objectivePresets: AdsObjectivePreset[];
  activeDraft: ActiveDraftSummary;
  saveDraftAction: SaveSpDraftAction;
};

export default function AdsTargetsWorkspaceClient(props: AdsTargetsWorkspaceClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRouting, startRouting] = useTransition();
  const [composerRow, setComposerRow] = useState<SpTargetsWorkspaceRow | null>(null);
  const [activeDraft, setActiveDraft] = useState<ActiveDraftSummary>(props.activeDraft);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  const draftBadgeText = activeDraft
    ? `${activeDraft.queueCount.toLocaleString('en-US')} staged item(s)`
    : 'No active draft';

  const handleSaved = (state: SaveSpDraftActionState) => {
    if (!state.ok || !state.changeSetId || !state.changeSetName) return;

    setComposerRow(null);
    setFlashMessage(state.message);
    setActiveDraft({
      id: state.changeSetId,
      name: state.changeSetName,
      queueCount: state.queueCount,
    });

    startRouting(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('change_set', state.changeSetId!);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      router.refresh();
    });
  };

  const draftSummary = useMemo(() => {
    if (!activeDraft) {
      return 'Stage a first action from a target row to create the draft queue.';
    }
    return `Active draft ${activeDraft.name} with ${activeDraft.queueCount.toLocaleString('en-US')} staged item(s).`;
  }, [activeDraft]);

  return (
    <section className="space-y-6">
      <KpiCards items={props.kpiItems} />

      <div className="rounded-2xl border border-border bg-surface/80 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-muted">Targets</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {props.rows.length.toLocaleString('en-US')} target row(s)
            </div>
            <div className="mt-2 max-w-2xl text-sm text-muted">{draftSummary}</div>
          </div>
          <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-right">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Draft queue</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{draftBadgeText}</div>
            <div className="mt-1 text-xs text-muted">
              {activeDraft ? activeDraft.name : 'Created on first composer save'}
            </div>
          </div>
        </div>
      </div>

      {flashMessage ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-800">
          {flashMessage}
        </div>
      ) : null}

      {isRouting ? (
        <div className="rounded-2xl border border-border bg-surface/80 px-5 py-4 text-sm text-muted shadow-sm">
          Refreshing draft queue…
        </div>
      ) : null}

      <SpTargetsTable
        rows={props.rows}
        onOpenComposer={(row) => {
          setFlashMessage(null);
          setComposerRow(row);
        }}
        activeDraftName={activeDraft?.name ?? null}
      />

      {composerRow ? (
        <SpChangeComposer
          row={composerRow}
          filtersJson={props.filtersJson}
          activeChangeSetId={activeDraft?.id ?? null}
          activeChangeSetName={activeDraft?.name ?? null}
          objectivePresets={props.objectivePresets}
          action={props.saveDraftAction}
          onClose={() => setComposerRow(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </section>
  );
}
