'use client';

import { useEffect, useRef, useState } from 'react';

export type AdsWorkspaceRowActionItem = {
  key: string;
  label: string;
} & (
  | {
      href: string;
      onSelect?: never;
    }
  | {
      href?: never;
      onSelect: () => void;
    }
  );

type AdsWorkspaceRowActionsMenuProps = {
  items: AdsWorkspaceRowActionItem[];
};

export default function AdsWorkspaceRowActionsMenu({
  items,
}: AdsWorkspaceRowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground"
      >
        Actions
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 min-w-[190px] rounded-2xl border border-border bg-background p-2 shadow-lg"
        >
          {items.length > 0 ? (
            <div className="space-y-1">
              {items.map((item) => (
                'href' in item ? (
                  <a
                    key={item.key}
                    role="menuitem"
                    href={item.href}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpen(false);
                    }}
                    className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-surface-2"
                  >
                    {item.label}
                  </a>
                ) : (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpen(false);
                      item.onSelect();
                    }}
                    className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-surface-2"
                  >
                    {item.label}
                  </button>
                )
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-xs text-muted">No valid actions for this row.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
