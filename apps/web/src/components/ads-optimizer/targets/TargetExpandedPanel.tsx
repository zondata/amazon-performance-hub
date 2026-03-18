'use client';

import type { ReactNode } from 'react';

import type { AdsOptimizerTargetReviewRow } from '@/lib/ads-optimizer/runtime';

type TargetExpandedPanelProps = {
  drawerId?: string;
  activeRow: AdsOptimizerTargetReviewRow | null;
  children: ReactNode;
};

export default function TargetExpandedPanel(props: TargetExpandedPanelProps) {
  return (
    <aside id={props.drawerId} className="xl:sticky xl:top-4 xl:self-stretch xl:h-[calc(100vh-1.5rem)] xl:min-h-0">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm xl:flex xl:h-full xl:flex-col xl:overflow-hidden">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">Target detail drawer</div>
        {props.activeRow ? (
          props.children
        ) : (
          <div className="mt-3 text-sm text-muted">
            Select one queue row to open the target detail drawer.
          </div>
        )}
      </section>
    </aside>
  );
}
