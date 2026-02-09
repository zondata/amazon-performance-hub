export type RetryOptions = {
  retries: number;
  delaysMs: number[];
  shouldRetry: (err: unknown) => boolean;
  onRetry?: (info: { attempt: number; error: unknown; delayMs: number }) => void;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { retries, delaysMs, shouldRetry, onRetry } = options;
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      const canRetry = attempt <= retries && shouldRetry(err);
      if (!canRetry) throw err;
      const delayMs = delaysMs[Math.min(attempt - 1, delaysMs.length - 1)] ?? 0;
      if (onRetry) onRetry({ attempt, error: err, delayMs });
      if (delayMs > 0) await sleep(delayMs);
    }
  }
}

export function isTransientSupabaseError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { status?: number; message?: string; name?: string; code?: string };
  if (anyErr.status && anyErr.status >= 500) return true;
  const msg = String(anyErr.message ?? "").toLowerCase();
  if (msg.includes("timeout")) return true;
  if (msg.includes("timed out")) return true;
  if (msg.includes("network")) return true;
  if (msg.includes("fetch failed")) return true;
  if (msg.includes("econnreset") || msg.includes("econnrefused")) return true;
  if (msg.includes("cloudflare") && msg.includes("500")) return true;
  return false;
}

export function formatRetryError(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const anyErr = err as { status?: number; message?: string; name?: string };
  const status = anyErr.status ? `status ${anyErr.status}` : "";
  const message = anyErr.message ? anyErr.message : "";
  return [status, message].filter(Boolean).join(" ").trim() || "unknown error";
}
