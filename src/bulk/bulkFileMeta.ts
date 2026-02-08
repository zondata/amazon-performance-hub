export type BulkFileMeta = {
  filename: string;
  coverageStart: string | null;
  coverageEnd: string | null;
  exportTimestampMs: number | null;
  snapshotDate: string | null;
  mtimeMs?: number | null;
};

function toIso(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

export function parseBulkFilenameMeta(filename: string): BulkFileMeta {
  const rangeMatch = filename.match(/(\d{8})-(\d{8})/);
  const coverageStart = rangeMatch ? toIso(rangeMatch[1]) : null;
  const coverageEnd = rangeMatch ? toIso(rangeMatch[2]) : null;
  const snapshotDate = coverageEnd ?? null;

  const exportMatch = filename.match(/-(\d{13,})\.xlsx$/i);
  const exportTimestampMs = exportMatch ? Number(exportMatch[1]) : null;

  return {
    filename,
    coverageStart,
    coverageEnd,
    exportTimestampMs: Number.isFinite(exportTimestampMs ?? NaN) ? exportTimestampMs : null,
    snapshotDate,
  };
}
