import { describe, expect, it, vi } from "vitest";
import { retryAsync, isTransientSupabaseError } from "../src/lib/retry";

function makeError(status: number, message: string) {
  return { status, message } as { status: number; message: string };
}

describe("retryAsync", () => {
  it("retries transient errors and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(makeError(500, "cloudflare 500"))
      .mockRejectedValueOnce(makeError(502, "bad gateway"))
      .mockResolvedValueOnce("ok");

    const result = await retryAsync(fn, {
      retries: 3,
      delaysMs: [0, 0, 0],
      shouldRetry: isTransientSupabaseError,
    });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
