import type { ReactNode } from 'react';

type InlineFiltersProps = {
  children: ReactNode;
};

export default function InlineFilters({ children }: InlineFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface/80 p-4 text-sm shadow-sm">
      {children}
    </div>
  );
}
