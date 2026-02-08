import type { BulkFileMeta } from "./bulkFileMeta";

function compareNullableNumber(a: number | null | undefined, b: number | null | undefined): number {
  const av = a ?? -Infinity;
  const bv = b ?? -Infinity;
  return av - bv;
}

function compareNullableString(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a.localeCompare(b);
}

function isWithin(dateIso: string, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  return start <= dateIso && dateIso <= end;
}

export function selectBestBulkFileForDate(
  filesMeta: BulkFileMeta[],
  dateIso: string
): BulkFileMeta | null {
  if (!filesMeta.length) return null;

  const withCoverage = filesMeta.filter((meta) =>
    isWithin(dateIso, meta.coverageStart, meta.coverageEnd)
  );
  const candidates = withCoverage.length ? withCoverage : filesMeta;

  const sorted = [...candidates].sort((a, b) => {
    const byExport = compareNullableNumber(a.exportTimestampMs, b.exportTimestampMs);
    if (byExport !== 0) return byExport;
    const bySnapshot = compareNullableString(a.snapshotDate, b.snapshotDate);
    if (bySnapshot !== 0) return bySnapshot;
    const byMtime = compareNullableNumber(a.mtimeMs ?? null, b.mtimeMs ?? null);
    return byMtime;
  });

  return sorted[sorted.length - 1] ?? null;
}
