'use client';

import type { ReactNode } from 'react';

type TargetExpandedPanelProps = {
  targetSnapshotId: string;
  onCollapse?: () => void;
  children: ReactNode;
};

export default function TargetExpandedPanel(props: TargetExpandedPanelProps) {
  return (
    <div
      id={`target-inline-panel-${props.targetSnapshotId}`}
      className="rounded-2xl border border-border bg-surface/90 p-5 shadow-sm"
    >
      {props.onCollapse ? (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground transition hover:border-primary/40 hover:text-primary"
            aria-label="Collapse expanded target details"
            onClick={props.onCollapse}
          >
            Collapse details
          </button>
        </div>
      ) : null}
      {props.children}
    </div>
  );
}
