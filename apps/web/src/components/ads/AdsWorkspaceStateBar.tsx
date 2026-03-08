'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

type AdsWorkspaceStateBarProps = {
  showIds: boolean;
  campaignScopeId?: string | null;
  adGroupScopeId?: string | null;
  campaignScopeLabel?: string | null;
  adGroupScopeLabel?: string | null;
};

export default function AdsWorkspaceStateBar({
  showIds,
  campaignScopeId,
  adGroupScopeId,
  campaignScopeLabel,
  adGroupScopeLabel,
}: AdsWorkspaceStateBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRouting, startRouting] = useTransition();

  const updateParams = (updates: Record<string, string | null>) => {
    startRouting(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const hasScope = Boolean(campaignScopeId || adGroupScopeId);
  const renderScopeChip = (
    prefix: string,
    label: string | null | undefined,
    id: string | null | undefined
  ) => {
    const primaryText = label?.trim() || id?.trim() || 'Unknown';
    const secondaryText =
      showIds && label?.trim() && id?.trim() && label.trim() !== id.trim() ? id.trim() : null;

    return (
      <span className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted">
        <span className="font-semibold text-foreground">{prefix}:</span> {primaryText}
        {secondaryText ? <span className="ml-1 text-[11px] text-muted">{secondaryText}</span> : null}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/80 px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => updateParams({ show_ids: showIds ? null : '1' })}
          aria-pressed={showIds}
          className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
            showIds
              ? 'border-primary/30 bg-primary text-primary-foreground'
              : 'border-border bg-surface-2 text-foreground'
          }`}
        >
          Show IDs {showIds ? 'On' : 'Off'}
        </button>
        {hasScope ? (
          <>
            {campaignScopeId ? (
              renderScopeChip('Campaign scope', campaignScopeLabel, campaignScopeId)
            ) : null}
            {adGroupScopeId ? (
              renderScopeChip('Ad group scope', adGroupScopeLabel, adGroupScopeId)
            ) : null}
            <button
              type="button"
              onClick={() =>
                updateParams({
                  campaign_scope: null,
                  campaign_scope_name: null,
                  ad_group_scope: null,
                  ad_group_scope_name: null,
                  trend_entity: null,
                })
              }
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground"
            >
              Clear drilldown
            </button>
          </>
        ) : null}
      </div>
      {isRouting ? <div className="text-xs text-muted">Updating workspace…</div> : null}
    </div>
  );
}
