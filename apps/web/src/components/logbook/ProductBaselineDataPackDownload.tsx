"use client";

import { useMemo, useState } from "react";

const REQUEST_TIMEOUT_MS = 120_000;
const IS_DEV = process.env.NODE_ENV !== "production";

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

type PackMessageLevel = "debug" | "info" | "warn" | "error";
type PackMessage = {
  level: PackMessageLevel;
  code: string;
  text: string;
  meta?: Record<string, unknown>;
};

type FetchDiagnosticEntry = {
  chunksTotal?: number;
  chunksSucceeded?: number;
  chunksFailed?: number;
  retriesUsedMax?: number;
  failedRangesSampleCount?: number;
  failedRangesSample?: Array<{
    chunkStart?: string;
    chunkEnd?: string;
    message?: string;
  }>;
};

type BaselinePackResponse = {
  metadata?: {
    warnings?: unknown;
    messages?: unknown;
  };
  meta?: {
    fetch_diagnostics?: {
      sp_reconciliation?: FetchDiagnosticEntry;
    };
  };
};

const getFilenameFromContentDisposition = (headerValue: string | null): string | null => {
  if (!headerValue) return null;
  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).trim();
    } catch {
      return utf8Match[1].trim();
    }
  }
  const quotedMatch = headerValue.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1].trim();
  const bareMatch = headerValue.match(/filename=([^;]+)/i);
  if (bareMatch?.[1]) return bareMatch[1].trim();
  return null;
};

const asWarnings = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
};

const asPackMessages = (value: unknown): PackMessage[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const candidate = entry as Record<string, unknown>;
      const levelRaw = String(candidate.level ?? "").trim();
      const code = String(candidate.code ?? "").trim();
      const text = String(candidate.text ?? "").trim();
      const level =
        levelRaw === "debug" || levelRaw === "info" || levelRaw === "warn" || levelRaw === "error"
          ? (levelRaw as PackMessageLevel)
          : null;
      if (!level || !code || !text) return null;
      const meta =
        candidate.meta && typeof candidate.meta === "object" && !Array.isArray(candidate.meta)
          ? (candidate.meta as Record<string, unknown>)
          : undefined;
      return meta ? { level, code, text, meta } : { level, code, text };
    })
    .filter((entry): entry is PackMessage => entry !== null);
};

const toLegacyWarningMessages = (warnings: string[]): PackMessage[] =>
  warnings.map((text) => ({ level: "warn", code: "LEGACY_WARNING", text }));

const formatErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request timed out. Try again; if it keeps failing, reduce date range.";
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  return "Unexpected error.";
};

export default function ProductBaselineDataPackDownload({
  asin,
  initialRange,
}: ProductBaselineDataPackDownloadProps) {
  const [range, setRange] = useState<RangeValue>(normalizeRange(initialRange));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [packMessages, setPackMessages] = useState<PackMessage[]>([]);
  const [showInfoMessages, setShowInfoMessages] = useState(false);
  const [showDebugMessages, setShowDebugMessages] = useState(false);
  const [failedRangesSample, setFailedRangesSample] = useState<
    Array<{ chunkStart: string; chunkEnd: string; message: string }>
  >([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const href = useMemo(
    () =>
      `/products/${encodeURIComponent(asin)}/logbook/ai-data-pack?range=${encodeURIComponent(range)}`,
    [asin, range]
  );

  const handleDownload = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setPackMessages([]);
    setShowInfoMessages(false);
    setShowDebugMessages(false);
    setFailedRangesSample([]);
    setSuccessMessage(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(href, {
        method: "GET",
        signal: controller.signal,
      });

      if (!response.ok) {
        const bodyText = (await response.text()).trim();
        const statusMessage = `${response.status} ${response.statusText}`.trim();
        throw new Error(bodyText || statusMessage || "Request failed.");
      }

      const cloned = response.clone();
      let payload: BaselinePackResponse | null = null;
      try {
        payload = (await cloned.json()) as BaselinePackResponse;
      } catch {
        payload = null;
      }

      const warnings = asWarnings(payload?.metadata?.warnings);
      const messages = asPackMessages(payload?.metadata?.messages);
      const spReconciliationDiagnostics = payload?.meta?.fetch_diagnostics?.sp_reconciliation;
      const chunksFailed = Number(spReconciliationDiagnostics?.chunksFailed ?? 0);
      const hasPartialChunkFailures = Number.isFinite(chunksFailed) && chunksFailed > 0;

      const normalizedMessages = messages.length > 0 ? messages : toLegacyWarningMessages(warnings);
      if (
        hasPartialChunkFailures &&
        !normalizedMessages.some(
          (message) =>
            message.code === "CHUNK_PARTIAL" ||
            message.code === "CHUNK_FAILED" ||
            message.text.includes("SP reconciliation partial")
        )
      ) {
        normalizedMessages.push({
          level: "warn",
          code: "CHUNK_PARTIAL",
          text: `SP reconciliation partial: ${chunksFailed} chunk${chunksFailed === 1 ? "" : "s"} failed. See meta.fetch_diagnostics.`,
        });
      }
      setPackMessages(normalizedMessages);

      const sample = Array.isArray(spReconciliationDiagnostics?.failedRangesSample)
        ? spReconciliationDiagnostics.failedRangesSample
            .map((entry) => ({
              chunkStart: String(entry.chunkStart ?? "").trim(),
              chunkEnd: String(entry.chunkEnd ?? "").trim(),
              message: String(entry.message ?? "").trim(),
            }))
            .filter(
              (entry) => entry.chunkStart.length > 0 && entry.chunkEnd.length > 0 && entry.message.length > 0
            )
            .slice(0, 3)
        : [];
      setFailedRangesSample(sample);

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download =
        getFilenameFromContentDisposition(response.headers.get("content-disposition")) ??
        `${asin}_product_baseline_data_pack.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      setSuccessMessage("Data pack downloaded.");
    } catch (error) {
      setErrorMessage(`Failed to generate data pack: ${formatErrorMessage(error)}`);
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const errorMessages = packMessages.filter((message) => message.level === "error");
  const warnMessages = packMessages.filter((message) => message.level === "warn");
  const infoMessages = packMessages.filter((message) => message.level === "info");
  const debugMessages = packMessages.filter((message) => message.level === "debug");
  const hasWarnOrError = errorMessages.length > 0 || warnMessages.length > 0;
  const hasDetailsContent =
    hasWarnOrError || infoMessages.length > 0 || (IS_DEV && debugMessages.length > 0) || failedRangesSample.length > 0;
  const showDetailsPanel =
    hasWarnOrError || infoMessages.length > 0 || (IS_DEV && debugMessages.length > 0) || failedRangesSample.length > 0;
  const titleText =
    errorMessages.length > 0
      ? "Generated with errors."
      : warnMessages.length > 0
        ? "Generated with warnings."
        : "Generated successfully.";
  const boxClassName =
    errorMessages.length > 0
      ? "rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700"
      : warnMessages.length > 0
        ? "rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        : "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="product-baseline-range" className="text-xs font-medium text-muted">
          Baseline range
        </label>
        <select
          id="product-baseline-range"
          value={range}
          onChange={(event) => setRange(normalizeRange(event.target.value))}
          disabled={isLoading}
          className="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-70"
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleDownload}
          disabled={isLoading}
          className="inline-flex rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Generating..." : "Download Product Baseline Data Pack"}
        </button>
      </div>

      {isLoading ? (
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <span>Generating data pack... This may take a minute.</span>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {showDetailsPanel ? (
        <div className={boxClassName}>
          {hasWarnOrError ? <div>{titleText}</div> : null}
          {errorMessages.length > 0 ? (
            <ul className="mt-2 list-disc pl-4 text-xs">
              {errorMessages.map((message, index) => (
                <li key={`err-inline-${message.code}-${index}`}>{message.text}</li>
              ))}
            </ul>
          ) : null}
          {warnMessages.length > 0 ? (
            <ul className="mt-2 list-disc pl-4 text-xs">
              {warnMessages.map((message, index) => (
                <li key={`warn-inline-${message.code}-${index}`}>{message.text}</li>
              ))}
            </ul>
          ) : null}
          <details className={hasWarnOrError ? "mt-2" : ""}>
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide">
              Details
            </summary>
            <div className="mt-2 space-y-2 text-xs">
              {errorMessages.length > 0 ? (
                <div>
                  <div className="font-semibold">Errors</div>
                  <ul className="list-disc pl-4">
                    {errorMessages.map((message, index) => (
                      <li key={`${message.code}-${index}`}>{message.text}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {warnMessages.length > 0 ? (
                <div>
                  <div className="font-semibold">Warnings</div>
                  <ul className="list-disc pl-4">
                    {warnMessages.map((message, index) => (
                      <li key={`${message.code}-${index}`}>{message.text}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {infoMessages.length > 0 ? (
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={showInfoMessages}
                    onChange={(event) => setShowInfoMessages(event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  <span>Show info</span>
                </label>
              ) : null}
              {IS_DEV && debugMessages.length > 0 ? (
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={showDebugMessages}
                    onChange={(event) => setShowDebugMessages(event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  <span>Show debug</span>
                </label>
              ) : null}
              {showInfoMessages && infoMessages.length > 0 ? (
                <div>
                  <div className="font-semibold">Info</div>
                  <ul className="list-disc pl-4">
                    {infoMessages.map((message, index) => (
                      <li key={`${message.code}-${index}`}>{message.text}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {IS_DEV && showDebugMessages && debugMessages.length > 0 ? (
                <div>
                  <div className="font-semibold">Debug</div>
                  <ul className="list-disc pl-4">
                    {debugMessages.map((message, index) => (
                      <li key={`${message.code}-${index}`}>{message.text}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {failedRangesSample.length > 0 ? (
                <div>
                  <div className="font-semibold">SP failed chunk sample</div>
                  <ul className="list-disc pl-4">
                    {failedRangesSample.map((sample, index) => (
                      <li key={`${sample.chunkStart}-${sample.chunkEnd}-${index}`}>
                        {sample.chunkStart}..{sample.chunkEnd}: {sample.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!hasDetailsContent ? <div>No additional details.</div> : null}
            </div>
          </details>
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {successMessage}
        </div>
      ) : null}
    </div>
  );
}
