'use client';

import type { ReactNode } from 'react';

type TargetAdvancedSectionProps = {
  label: string;
  children: ReactNode;
};

export default function TargetAdvancedSection(props: TargetAdvancedSectionProps) {
  return (
    <section className="rounded-xl border border-border bg-surface px-4 py-4">
      <div className="text-xs uppercase tracking-[0.3em] text-muted">{props.label}</div>
      <div className="mt-3 space-y-3">{props.children}</div>
    </section>
  );
}
