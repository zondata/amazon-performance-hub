import { describe, expect, it } from "vitest";

import {
  buildImportsHealthSourceSections,
  getBatchDetailsText,
  getBatchSummaryCounts,
  getImportsHealthStatusPresentation,
} from "../apps/web/src/lib/imports/statusPresentation";

describe("batch status presentation helpers", () => {
  it("distinguishes no-mapping-required from skipped map problems", () => {
    const counts = getBatchSummaryCounts([
      {
        original_filename: "bulk.xlsx",
        source_type: "bulk",
        ingest: { status: "ok" },
        map: {
          status: "not_required",
          message: "No mapping step required for this source type.",
        },
      },
      {
        original_filename: "sp_campaign.csv",
        source_type: "sp_campaign",
        ingest: { status: "already ingested" },
        map: {
          status: "skipped",
          message:
            "Mapping skipped because ingest status was already ingested and this flow did not remap the existing upload.",
        },
      },
    ]);

    expect(counts.noMappingRequired).toBe(1);
    expect(counts.mapProblems).toBe(1);
    expect(counts.mapProblemBreakdown.skipped).toBe(1);
  });

  it("uses the required Details priority order", () => {
    expect(
      getBatchDetailsText({
        original_filename: "sp_campaign.csv",
        source_type: "sp_campaign",
        ingest: { status: "already ingested" },
        map: {
          status: "skipped",
          message:
            "Mapping skipped because ingest status was already ingested and this flow did not remap the existing upload.",
        },
      })
    ).toBe(
      "Mapping skipped because ingest status was already ingested and this flow did not remap the existing upload."
    );

    expect(
      getBatchDetailsText({
        original_filename: "bulk.xlsx",
        source_type: "bulk",
        ingest: { status: "ok" },
        map: {
          status: "not_required",
          message: "No mapping step required for this source type.",
        },
      })
    ).toBe("No mapping step required for this source type.");
  });
});

describe("imports-health source row helpers", () => {
  const sourceGroups = [
    { title: "SP", sources: ["sp_campaign"] },
  ];

  it("keeps unresolved persisted status visible when it applies to the latest upload", () => {
    const sections = buildImportsHealthSourceSections({
      sourceGroups,
      latestUploadsBySourceType: [
        {
          source_type: "sp_campaign",
          upload_id: "upload-1",
          original_filename: "sp_campaign.csv",
          exported_at: "2026-03-19T00:00:00.000Z",
          ingested_at: "2026-03-19T00:10:00.000Z",
          coverage_start: "2026-03-18",
          coverage_end: "2026-03-18",
          snapshot_date: null,
          row_count: 10,
        },
      ],
      importSourceStatuses: [
        {
          account_id: "acct",
          source_type: "sp_campaign",
          last_attempted_at: "2026-03-19T00:10:00.000Z",
          last_original_filename: "sp_campaign.csv",
          last_upload_id: "upload-1",
          ingest_status: "already ingested",
          ingest_row_count: null,
          ingest_message: null,
          map_status: "skipped",
          map_fact_rows: null,
          map_issue_rows: null,
          map_message:
            "Mapping skipped because ingest status was already ingested and this flow did not remap the existing upload.",
          unresolved: true,
          created_at: "2026-03-19T00:10:00.000Z",
          updated_at: "2026-03-19T00:10:00.000Z",
        },
      ],
    });

    const row = sections.groups[0]?.rows[0];
    expect(row?.persistedStatus?.map_status).toBe("skipped");
    expect(getImportsHealthStatusPresentation(row?.persistedStatus ?? null)).toEqual({
      label: "Problem — skipped",
      tone: "problem",
      message:
        "Mapping skipped because ingest status was already ingested and this flow did not remap the existing upload.",
    });
  });

  it("shows persisted status rows even when no upload row exists and places unknown under Other uploads", () => {
    const sections = buildImportsHealthSourceSections({
      sourceGroups,
      latestUploadsBySourceType: [],
      importSourceStatuses: [
        {
          account_id: "acct",
          source_type: "unknown",
          last_attempted_at: "2026-03-19T00:10:00.000Z",
          last_original_filename: "mystery.csv",
          last_upload_id: null,
          ingest_status: "error",
          ingest_row_count: null,
          ingest_message: "Could not detect source_type from filename: mystery.csv",
          map_status: "skipped",
          map_fact_rows: null,
          map_issue_rows: null,
          map_message: "Mapping skipped because ingest failed.",
          unresolved: true,
          created_at: "2026-03-19T00:10:00.000Z",
          updated_at: "2026-03-19T00:10:00.000Z",
        },
      ],
    });

    expect(sections.otherRows).toHaveLength(1);
    expect(sections.otherRows[0]?.sourceType).toBe("unknown");
    expect(sections.otherRows[0]?.persistedStatus?.ingest_status).toBe("error");
  });

  it("suppresses an old unresolved status when a newer upload supersedes it", () => {
    const sections = buildImportsHealthSourceSections({
      sourceGroups,
      latestUploadsBySourceType: [
        {
          source_type: "sp_campaign",
          upload_id: "upload-2",
          original_filename: "sp_campaign-new.csv",
          exported_at: "2026-03-20T00:00:00.000Z",
          ingested_at: "2026-03-20T00:05:00.000Z",
          coverage_start: "2026-03-19",
          coverage_end: "2026-03-19",
          snapshot_date: null,
          row_count: 12,
        },
      ],
      importSourceStatuses: [
        {
          account_id: "acct",
          source_type: "sp_campaign",
          last_attempted_at: "2026-03-19T00:10:00.000Z",
          last_original_filename: "sp_campaign-old.csv",
          last_upload_id: "upload-1",
          ingest_status: "already ingested",
          ingest_row_count: null,
          ingest_message: null,
          map_status: "skipped",
          map_fact_rows: null,
          map_issue_rows: null,
          map_message:
            "Mapping skipped because ingest status was already ingested and this flow did not remap the existing upload.",
          unresolved: true,
          created_at: "2026-03-19T00:10:00.000Z",
          updated_at: "2026-03-19T00:10:00.000Z",
        },
      ],
    });

    const row = sections.groups[0]?.rows[0];
    expect(row?.latestUpload?.upload_id).toBe("upload-2");
    expect(row?.persistedStatus).toBeNull();
  });
});
