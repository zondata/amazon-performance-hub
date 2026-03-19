'use client';

import type { ReactNode } from 'react';

type TargetExpandedPanelProps = {
  targetSnapshotId: string;
  contextStrip: ReactNode;
  tabStrip: ReactNode;
  children: ReactNode;
};

export default function TargetExpandedPanel(props: TargetExpandedPanelProps) {
  return (
    <div
      id={`target-inline-panel-${props.targetSnapshotId}`}
      className="grid h-[36rem] min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-border bg-surface/90 shadow-sm"
    >
      <div className="min-w-0 overflow-x-auto border-b-[0.5px] border-border px-4 py-[6px]">
        {props.contextStrip}
      </div>
      <div className="min-w-0 border-b-[0.5px] border-border">{props.tabStrip}</div>
      <div className="min-h-0 overflow-y-auto px-4 pt-[14px] pb-4">
        {props.children}
      </div>
    </div>
  );
}
