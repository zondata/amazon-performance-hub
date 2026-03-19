import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ImportSourceStatusRecord = Record<string, unknown>;

let rows: ImportSourceStatusRecord[] = [];

function matchesFilters(row: ImportSourceStatusRecord, filters: Record<string, unknown>) {
  return Object.entries(filters).every(([key, value]) => row[key] === value);
}

function createQuery(table: string) {
  const query: any = {
    _filters: {} as Record<string, unknown>,
    _select: "*",
    select: (_columns: string) => {
      query._select = _columns;
      return query;
    },
    eq: (column: string, value: unknown) => {
      query._filters[column] = value;
      return query;
    },
    maybeSingle: () => {
      if (table !== "import_source_status") return Promise.resolve({ data: null, error: null });
      const match = rows.find((row) => matchesFilters(row, query._filters)) ?? null;
      return Promise.resolve({ data: match, error: null });
    },
    upsert: (payload: ImportSourceStatusRecord) => {
      if (table !== "import_source_status") {
        return {
          select: () => ({
            single: () => Promise.resolve({ data: payload, error: null }),
          }),
        };
      }
      const existingIndex = rows.findIndex(
        (row) => row.account_id === payload.account_id && row.source_type === payload.source_type
      );
      if (existingIndex >= 0) {
        const existing = rows[existingIndex]!;
        rows[existingIndex] = {
          ...existing,
          ...payload,
          created_at: existing.created_at ?? "2026-03-19T00:00:00.000Z",
          updated_at: payload.updated_at ?? existing.updated_at ?? "2026-03-19T00:00:00.000Z",
        };
      } else {
        rows.push({
          created_at: "2026-03-19T00:00:00.000Z",
          updated_at: payload.updated_at ?? "2026-03-19T00:00:00.000Z",
          ...payload,
        });
      }
      const saved = rows.find(
        (row) => row.account_id === payload.account_id && row.source_type === payload.source_type
      )!;
      return {
        select: () => ({
          single: () => Promise.resolve({ data: saved, error: null }),
        }),
      };
    },
    order: (column: string, params?: { ascending?: boolean }) => {
      if (table !== "import_source_status") {
        return Promise.resolve({ data: [], error: null });
      }
      const filtered = rows
        .filter((row) => matchesFilters(row, query._filters))
        .sort((left, right) => {
          const leftValue = String(left[column] ?? "");
          const rightValue = String(right[column] ?? "");
          return params?.ascending === false
            ? rightValue.localeCompare(leftValue)
            : leftValue.localeCompare(rightValue);
        });
      return Promise.resolve({ data: filtered, error: null });
    },
  };
  return query;
}

const mockClient = {
  from: (table: string) => createQuery(table),
};

vi.mock("../src/db/supabaseClient", () => ({
  getSupabaseClient: () => mockClient,
}));

import {
  getImportSourceStatuses,
  upsertImportSourceStatus,
} from "../src/importStatus/db";

describe("import_source_status db helper", () => {
  beforeEach(() => {
    rows = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-19T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("merges partial map updates and clears map_message on success", async () => {
    rows.push({
      account_id: "acct",
      source_type: "sp_campaign",
      last_attempted_at: "2026-03-18T00:00:00.000Z",
      last_original_filename: "campaign.csv",
      last_upload_id: "upload-1",
      ingest_status: "ok",
      ingest_row_count: 25,
      ingest_message: "old ingest note",
      map_status: "error",
      map_fact_rows: 0,
      map_issue_rows: 0,
      map_message: "old map error",
      unresolved: true,
      created_at: "2026-03-18T00:00:00.000Z",
      updated_at: "2026-03-18T00:00:00.000Z",
    });

    const result = await upsertImportSourceStatus({
      account_id: "acct",
      source_type: "sp_campaign",
      map_status: "ok",
      map_fact_rows: 12,
      map_issue_rows: 1,
    });

    expect(result.ingest_status).toBe("ok");
    expect(result.ingest_row_count).toBe(25);
    expect(result.ingest_message).toBe("old ingest note");
    expect(result.map_status).toBe("ok");
    expect(result.map_fact_rows).toBe(12);
    expect(result.map_issue_rows).toBe(1);
    expect(result.map_message).toBeNull();
    expect(result.unresolved).toBe(false);
    expect(result.last_original_filename).toBe("campaign.csv");
    expect(result.last_upload_id).toBe("upload-1");
    expect(result.last_attempted_at).toBe("2026-03-19T12:00:00.000Z");
  });

  it("clears ingest_message on non-error ingest success and preserves unresolved map failures", async () => {
    rows.push({
      account_id: "acct",
      source_type: "sp_targeting",
      last_attempted_at: "2026-03-18T00:00:00.000Z",
      last_original_filename: "targeting.xlsx",
      last_upload_id: "upload-2",
      ingest_status: "error",
      ingest_row_count: null,
      ingest_message: "broken ingest",
      map_status: "missing_snapshot",
      map_fact_rows: 0,
      map_issue_rows: 1,
      map_message: "No compatible bulk snapshot was found for this upload.",
      unresolved: true,
      created_at: "2026-03-18T00:00:00.000Z",
      updated_at: "2026-03-18T00:00:00.000Z",
    });

    const result = await upsertImportSourceStatus({
      account_id: "acct",
      source_type: "sp_targeting",
      ingest_status: "already ingested",
    });

    expect(result.ingest_status).toBe("already ingested");
    expect(result.ingest_message).toBeNull();
    expect(result.map_status).toBe("missing_snapshot");
    expect(result.map_message).toBe("No compatible bulk snapshot was found for this upload.");
    expect(result.unresolved).toBe(true);
  });

  it("supports map-only updates for standalone remaps and keeps rows ordered by source_type", async () => {
    await upsertImportSourceStatus({
      account_id: "acct",
      source_type: "sp_placement",
      map_status: "error",
      map_message: "Manual remap failed.",
    });
    await upsertImportSourceStatus({
      account_id: "acct",
      source_type: "bulk",
      ingest_status: "ok",
      map_status: "not_required",
    });

    const ordered = await getImportSourceStatuses("acct");
    expect(ordered.map((row) => row.source_type)).toEqual(["bulk", "sp_placement"]);
    expect(ordered[1]?.ingest_status).toBe("ok");
    expect(ordered[1]?.map_status).toBe("error");
    expect(ordered[1]?.map_message).toBe("Manual remap failed.");
    expect(ordered[1]?.unresolved).toBe(true);
  });
});
