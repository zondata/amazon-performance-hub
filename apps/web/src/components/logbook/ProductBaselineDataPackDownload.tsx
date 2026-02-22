"use client";

import { useMemo, useState } from "react";

const RANGE_OPTIONS = [
  { value: "30d", label: "Last 30 days" },
  { value: "60d", label: "Last 60 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "180d", label: "Last 180 days" },
  { value: "all", label: "All (overlap)" },
] as const;

type RangeValue = (typeof RANGE_OPTIONS)[number]["value"];

const normalizeRange = (value: string | undefined): RangeValue => {
  if (value === "30d") return "30d";
  if (value === "60d") return "60d";
  if (value === "90d") return "90d";
  if (value === "180d") return "180d";
  if (value === "all") return "all";
  return "60d";
};

type ProductBaselineDataPackDownloadProps = {
  asin: string;
  initialRange?: string;
};

export default function ProductBaselineDataPackDownload({
  asin,
  initialRange,
}: ProductBaselineDataPackDownloadProps) {
  const [range, setRange] = useState<RangeValue>(normalizeRange(initialRange));

  const href = useMemo(
    () =>
      `/products/${encodeURIComponent(asin)}/logbook/ai-data-pack?range=${encodeURIComponent(range)}`,
    [asin, range]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="product-baseline-range" className="text-xs font-medium text-muted">
        Baseline range
      </label>
      <select
        id="product-baseline-range"
        value={range}
        onChange={(event) => setRange(normalizeRange(event.target.value))}
        className="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-foreground"
      >
        {RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <a
        href={href}
        download
        className="inline-flex rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface"
      >
        Download Product Baseline Data Pack
      </a>
    </div>
  );
}
