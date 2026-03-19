import type { ImportSourceStatusRow } from '../../../../../src/importStatus/db';

export type BatchIngestStatus = 'ok' | 'already ingested' | 'error';
export type BatchMapStatus = 'ok' | 'not_required' | 'missing_snapshot' | 'skipped' | 'error';

export type ImportBatchItemLike = {
  original_filename: string;
  source_type: string;
  ingest: {
    status: BatchIngestStatus;
    upload_id?: string;
    row_count?: number;
    message?: string;
    error?: string;
  };
  map: {
    status: BatchMapStatus;
    fact_rows?: number;
    issue_rows?: number;
    message?: string;
    error?: string;
  };
};

export type LatestUploadHealthRow = {
  upload_id: string | null;
  source_type: string | null;
  original_filename: string | null;
  exported_at: string | null;
  ingested_at: string | null;
  coverage_start: string | null;
  coverage_end: string | null;
  snapshot_date: string | null;
  row_count: number | string | null;
};

export type StatusBadgeTone = 'success' | 'problem' | 'neutral';

export type ImportsHealthStatusPresentation = {
  label: string;
  tone: Exclude<StatusBadgeTone, 'neutral'>;
  message?: string;
};

export type ImportsHealthSourceGroup = {
  title: string;
  sources: string[];
};

export type ImportsHealthSourceDisplayRow = {
  sourceType: string;
  latestUpload: LatestUploadHealthRow | null;
  persistedStatus: ImportSourceStatusRow | null;
};

export const getBatchIngestLabel = (status: BatchIngestStatus) => {
  if (status === 'ok') return 'OK';
  if (status === 'already ingested') return 'Already ingested';
  return 'Error';
};

export const getBatchMapLabel = (status: BatchMapStatus) => {
  if (status === 'ok') return 'OK';
  if (status === 'not_required') return 'No mapping required';
  if (status === 'missing_snapshot') return 'Missing snapshot';
  if (status === 'skipped') return 'Skipped';
  return 'Error';
};

export const getBatchIngestTone = (status: BatchIngestStatus): StatusBadgeTone => {
  if (status === 'ok') return 'success';
  if (status === 'already ingested') return 'neutral';
  return 'problem';
};

export const getBatchMapTone = (status: BatchMapStatus): StatusBadgeTone => {
  if (status === 'ok' || status === 'not_required') return 'success';
  return 'problem';
};

export const getBatchSummaryCounts = (items: ImportBatchItemLike[]) => {
  return {
    ingestOk: items.filter((item) => item.ingest.status === 'ok').length,
    alreadyIngested: items.filter((item) => item.ingest.status === 'already ingested').length,
    ingestErrors: items.filter((item) => item.ingest.status === 'error').length,
    mapOk: items.filter((item) => item.map.status === 'ok').length,
    noMappingRequired: items.filter((item) => item.map.status === 'not_required').length,
    mapProblems: items.filter((item) =>
      item.map.status === 'missing_snapshot'
      || item.map.status === 'skipped'
      || item.map.status === 'error'
    ).length,
    mapProblemBreakdown: {
      missingSnapshot: items.filter((item) => item.map.status === 'missing_snapshot').length,
      skipped: items.filter((item) => item.map.status === 'skipped').length,
      error: items.filter((item) => item.map.status === 'error').length,
    },
  };
};

export const getBatchDetailsText = (item: ImportBatchItemLike) => {
  if (item.ingest.status === 'error') {
    return item.ingest.message ?? item.ingest.error ?? 'Ingest failed.';
  }
  if (
    item.map.status === 'error'
    || item.map.status === 'missing_snapshot'
    || item.map.status === 'skipped'
  ) {
    return item.map.message ?? item.map.error ?? 'Mapping failed.';
  }
  if (item.map.status === 'not_required') {
    return 'No mapping step required for this source type.';
  }
  if (item.ingest.status === 'already ingested') {
    return 'Existing upload found.';
  }
  return '—';
};

const toTimestampMs = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const latestUploadTimestampMs = (row: LatestUploadHealthRow | null) => {
  if (!row) return null;
  return (
    toTimestampMs(row.exported_at)
    ?? toTimestampMs(row.snapshot_date ? `${row.snapshot_date}T00:00:00Z` : null)
    ?? toTimestampMs(row.ingested_at)
  );
};

export const shouldSuppressPersistedStatus = (params: {
  latestUpload: LatestUploadHealthRow | null;
  persistedStatus: ImportSourceStatusRow | null;
}) => {
  const { latestUpload, persistedStatus } = params;
  if (!latestUpload || !persistedStatus || !persistedStatus.unresolved) return false;
  if (!latestUpload.upload_id || !persistedStatus.last_upload_id) return false;
  if (latestUpload.upload_id === persistedStatus.last_upload_id) return false;

  const latestUploadMs = latestUploadTimestampMs(latestUpload);
  const lastAttemptedMs = toTimestampMs(persistedStatus.last_attempted_at);
  if (latestUploadMs === null || lastAttemptedMs === null) return false;
  return latestUploadMs > lastAttemptedMs;
};

export const getEffectivePersistedStatus = (params: {
  latestUpload: LatestUploadHealthRow | null;
  persistedStatus: ImportSourceStatusRow | null;
}) => {
  if (shouldSuppressPersistedStatus(params)) return null;
  return params.persistedStatus;
};

export const getImportsHealthStatusPresentation = (
  persistedStatus: ImportSourceStatusRow | null
): ImportsHealthStatusPresentation | null => {
  if (!persistedStatus) return null;

  if (persistedStatus.ingest_status === 'error') {
    return {
      label: 'Problem — ingest',
      tone: 'problem',
      message: persistedStatus.ingest_message ?? undefined,
    };
  }
  if (persistedStatus.map_status === 'error') {
    return {
      label: 'Problem — mapping error',
      tone: 'problem',
      message: persistedStatus.map_message ?? undefined,
    };
  }
  if (persistedStatus.map_status === 'missing_snapshot') {
    return {
      label: 'Problem — missing snapshot',
      tone: 'problem',
      message: persistedStatus.map_message ?? undefined,
    };
  }
  if (persistedStatus.map_status === 'skipped') {
    return {
      label: 'Problem — skipped',
      tone: 'problem',
      message: persistedStatus.map_message ?? undefined,
    };
  }
  if (
    persistedStatus.map_status === 'not_required'
    && persistedStatus.ingest_status === 'already ingested'
  ) {
    return { label: 'OK — already ingested / no map', tone: 'success' };
  }
  if (persistedStatus.map_status === 'not_required') {
    return { label: 'OK — no map required', tone: 'success' };
  }
  if (
    persistedStatus.ingest_status === 'already ingested'
    && persistedStatus.map_status === 'ok'
  ) {
    return { label: 'OK — already ingested', tone: 'success' };
  }
  if (persistedStatus.map_status === 'ok') {
    return { label: 'OK', tone: 'success' };
  }
  return null;
};

export const buildImportsHealthSourceSections = (params: {
  sourceGroups: ImportsHealthSourceGroup[];
  latestUploadsBySourceType: LatestUploadHealthRow[];
  importSourceStatuses: ImportSourceStatusRow[];
}) => {
  const latestBySource = new Map<string, LatestUploadHealthRow>();
  params.latestUploadsBySourceType.forEach((row) => {
    if (row.source_type) latestBySource.set(row.source_type, row);
  });
  const statusBySource = new Map<string, ImportSourceStatusRow>();
  params.importSourceStatuses.forEach((row) => {
    statusBySource.set(row.source_type, row);
  });

  const usedSources = new Set<string>();
  const groups = params.sourceGroups.map((group) => {
    const rows: ImportsHealthSourceDisplayRow[] = group.sources
      .map((sourceType) => {
        const latestUpload = latestBySource.get(sourceType) ?? null;
        const persistedStatus = getEffectivePersistedStatus({
          latestUpload,
          persistedStatus: statusBySource.get(sourceType) ?? null,
        });
        if (!latestUpload && !persistedStatus) return null;
        return {
          sourceType,
          latestUpload,
          persistedStatus,
        };
      })
      .filter((row): row is ImportsHealthSourceDisplayRow => Boolean(row));

    group.sources.forEach((sourceType) => usedSources.add(sourceType));
    return { title: group.title, rows };
  });

  const otherSourceTypes = new Set<string>();
  params.latestUploadsBySourceType.forEach((row) => {
    if (row.source_type && !usedSources.has(row.source_type)) otherSourceTypes.add(row.source_type);
  });
  params.importSourceStatuses.forEach((row) => {
    if (!usedSources.has(row.source_type)) otherSourceTypes.add(row.source_type);
  });

  const otherRows = [...otherSourceTypes]
    .sort((left, right) => left.localeCompare(right))
    .map((sourceType) => {
      const latestUpload = latestBySource.get(sourceType) ?? null;
      const persistedStatus = getEffectivePersistedStatus({
        latestUpload,
        persistedStatus: statusBySource.get(sourceType) ?? null,
      });
      return {
        sourceType,
        latestUpload,
        persistedStatus,
      };
    })
    .filter((row) => row.latestUpload || row.persistedStatus);

  return { groups, otherRows };
};
