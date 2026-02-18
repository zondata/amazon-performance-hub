import { describe, expect, it } from "vitest";
import { safeJoin } from "../apps/web/src/lib/bulksheets/pathUtils";

describe("safeJoin", () => {
  it("allows child paths within root", () => {
    const result = safeJoin("/tmp/root", "nested/file.txt");
    expect(result).toBe("/tmp/root/nested/file.txt");
  });

  it("rejects path traversal", () => {
    expect(() => safeJoin("/tmp/root", "../etc/passwd")).toThrow(/traversal/i);
  });
});
