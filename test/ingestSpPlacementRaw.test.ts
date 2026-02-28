import fs from "node:fs";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

type ExistingUploadRow = {
  upload_id: string;
  exported_at: string | null;
} | null;

let existingUpload: ExistingUploadRow = null;
let existingRawCount = 0;
let insertedRawRows: Array<Record<string, unknown>> = [];

function createQuery(table: string) {
  const query: any = {
    _filters: {} as Record<string, unknown>,
    _selectOptions: undefined as unknown,
    _deleteRequested: false,
    select: (_columns: string, options?: unknown) => {
      query._selectOptions = options;
      return query;
    },
    eq: (column: string, value: unknown) => {
      query._filters[column] = value;
      return query;
    },
    maybeSingle: () => {
      if (table === "uploads") return Promise.resolve({ data: existingUpload, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    upsert: () => Promise.resolve({ error: null }),
    insert: (payload: unknown) => {
      if (table === "sp_placement_daily_raw") {
        const rows = Array.isArray(payload) ? payload : [payload];
        insertedRawRows.push(...(rows as Array<Record<string, unknown>>));
        return Promise.resolve({ error: null });
      }
      if (table === "uploads") {
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { upload_id: "new-upload-id" }, error: null }),
          }),
        };
      }
      return Promise.resolve({ error: null });
    },
    delete: () => {
      query._deleteRequested = true;
      return query;
    },
    _execute: () => {
      if (table === "sp_placement_daily_raw" && query._deleteRequested) {
        return Promise.resolve({ error: null });
      }
      if (table === "sp_placement_daily_raw" && (query._selectOptions as any)?.head) {
        return Promise.resolve({ count: existingRawCount, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    },
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      query._execute().then(resolve, reject),
  };
  return query;
}

const mockClient = {
  from: (table: string) => createQuery(table),
};

vi.mock("../src/db/supabaseClient", () => ({
  getSupabaseClient: () => mockClient,
}));

vi.mock("../src/ads/parseSpPlacementReport", () => ({
  parseSpPlacementReport: vi.fn(),
}));

vi.mock("../src/ingest/utils", async () => {
  const actual = await vi.importActual<typeof import("../src/ingest/utils")>("../src/ingest/utils");
  return {
    ...actual,
    hashFileSha256: vi.fn(),
  };
});

vi.mock("../src/lib/retry", () => ({
  retryAsync: (fn: () => Promise<unknown>) => fn(),
  isTransientSupabaseError: () => false,
  formatRetryError: (error: unknown) => String(error),
}));

import { ingestSpPlacementRaw } from "../src/ingest/ingestSpPlacementRaw";
import { parseSpPlacementReport } from "../src/ads/parseSpPlacementReport";
import { hashFileSha256 } from "../src/ingest/utils";

const parseSpPlacementReportMock = vi.mocked(parseSpPlacementReport);
const hashFileSha256Mock = vi.mocked(hashFileSha256);

describe("ingestSpPlacementRaw exportedAt selection", () => {
  beforeEach(() => {
    existingUpload = { upload_id: "upload-1", exported_at: "2026-01-02T00:00:00Z" };
    existingRawCount = 0;
    insertedRawRows = [];
    hashFileSha256Mock.mockReturnValue("hash-1");
    parseSpPlacementReportMock.mockReturnValue({
      rows: [
        {
          date: "2026-01-05",
          portfolio_name_raw: null,
          portfolio_name_norm: null,
          campaign_name_raw: "Campaign",
          campaign_name_norm: "campaign",
          bidding_strategy: null,
          placement_raw: "Top of Search (first page)",
          placement_raw_norm: "top of search first page",
          placement_code: "TOS",
          impressions: 100,
          clicks: 10,
          spend: 12.3,
          sales: 50,
          orders: 2,
          units: 3,
          cpc: 1.23,
          ctr: 0.1,
          acos: 0.2,
          roas: 4.06,
        },
      ],
      coverageStart: "2026-01-05",
      coverageEnd: "2026-01-05",
    });
    vi.spyOn(fs, "statSync").mockReturnValue({
      mtime: new Date("2026-01-03T04:05:06Z"),
    } as fs.Stats);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("uses exportedAtOverride when provided", async () => {
    await ingestSpPlacementRaw("/tmp/fake-placement.xlsx", "sourbear", "2026-01-10T00:00:00Z");
    expect(insertedRawRows).toHaveLength(1);
    expect(insertedRawRows[0]?.exported_at).toBe("2026-01-10T00:00:00Z");
  });

  it("uses existing upload exported_at when override is missing", async () => {
    await ingestSpPlacementRaw("/tmp/fake-placement.xlsx", "sourbear");
    expect(insertedRawRows).toHaveLength(1);
    expect(insertedRawRows[0]?.exported_at).toBe("2026-01-02T00:00:00Z");
  });

  it("falls back to file mtime when override and existing upload exported_at are missing", async () => {
    existingUpload = null;
    await ingestSpPlacementRaw("/tmp/fake-placement.xlsx", "sourbear");
    expect(insertedRawRows).toHaveLength(1);
    expect(insertedRawRows[0]?.exported_at).toBe("2026-01-03T04:05:06.000Z");
  });
});
