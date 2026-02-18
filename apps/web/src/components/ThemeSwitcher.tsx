'use client';

import { useEffect, useRef, useState } from 'react';

type ThemeOption = {
  id: 'stripe' | 'saas-analytics' | 'real-time';
  label: string;
  swatches: [string, string, string];
};

const OPTIONS: ThemeOption[] = [
  {
    id: 'stripe',
    label: 'Stripe',
    swatches: ['#F6F9FC', '#FFFFFF', '#635BFF'],
  },
  {
    id: 'saas-analytics',
    label: 'SaaS Analytics',
    swatches: ['#FDFDFD', '#E8EAEC', '#845C58'],
  },
  {
    id: 'real-time',
    label: 'Real-time',
    swatches: ['#141414', '#282828', '#B55933'],
  },
];

export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, [open]);

  const applyTheme = (theme: ThemeOption['id']) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aph.theme', theme);
    window.dispatchEvent(new CustomEvent('aph:theme-change', { detail: theme }));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Theme"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-sm transition hover:bg-surface/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M12 3a9 9 0 0 0 0 18 1 1 0 0 0 0-2 7 7 0 0 1 0-14 1 1 0 0 0 0-2Z" />
          <circle cx="8.5" cy="8.5" r="1.2" />
          <circle cx="14.8" cy="7.4" r="1.1" />
          <circle cx="16.5" cy="12.8" r="1.1" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-surface/95 p-2 text-sm text-foreground shadow-lg backdrop-blur">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              data-theme-option={option.id}
              onClick={() => applyTheme(option.id)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-surface-2/60"
            >
              <span className="font-medium">{option.label}</span>
              <span className="flex items-center gap-1">
                {option.swatches.map((swatch) => (
                  <span
                    key={swatch}
                    className="h-3 w-3 rounded-full border border-border/60"
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
