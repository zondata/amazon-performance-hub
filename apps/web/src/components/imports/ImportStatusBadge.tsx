import type { ReactNode } from 'react';

import type { StatusBadgeTone } from '@/lib/imports/statusPresentation';

type ImportStatusBadgeProps = {
  tone: StatusBadgeTone;
  children: ReactNode;
};

const TONE_CLASS_NAME: Record<StatusBadgeTone, string> = {
  success: 'border border-emerald-300 bg-emerald-50 text-emerald-700',
  problem: 'border border-rose-300 bg-rose-50 text-rose-700',
  neutral: 'border border-border bg-surface-2 text-muted',
};

export default function ImportStatusBadge(props: ImportStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${TONE_CLASS_NAME[props.tone]}`}
    >
      {props.children}
    </span>
  );
}
