'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';

import {
  runImportBatchAction,
  saveIgnoredSourceTypesAction,
  type ImportBatchActionState,
} from '@/lib/imports/runImportBatch';
import {
  IMPORT_BATCH_SOURCE_TYPES,
  type ImportSourceType,
} from '@/lib/imports/sourceTypes';

type AsinOption = {
  asin: string;
  label: string;
};

type ImportBatchUploaderProps = {
  asinOptions: AsinOption[];
  spawnEnabled: boolean;
  initialIgnoredSourceTypes: ImportSourceType[];
};

const INITIAL_STATE: ImportBatchActionState = {
  ok: true,
  error: null,
  summary: undefined,
  ignored_reports: [],
  ignored_source_types: [],
};

const formatSourceTypeLabel = (value: string) =>
  value
    .split('_')
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');

const isSalesTrendCsv = (filename: string) =>
  /salestrend/i.test(filename) && filename.toLowerCase().endsWith('.csv');

const formatBatchDate = (exportedAtIso?: string, runAtIso?: string) => {
  const value = exportedAtIso ?? runAtIso;
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

export default function ImportBatchUploader(props: ImportBatchUploaderProps) {
  const [state, formAction, isPending] = useActionState(runImportBatchAction, {
    ...INITIAL_STATE,
    ignored_source_types: props.initialIgnoredSourceTypes,
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [ignoredSourceTypes, setIgnoredSourceTypes] = useState<ImportSourceType[]>(
    props.initialIgnoredSourceTypes
  );
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [saveError, setSaveError] = useState<string>('');
  const [isSavingPrefs, startSavingPrefs] = useTransition();

  const toggleIgnored = (sourceType: ImportSourceType) => {
    setIgnoredSourceTypes((current) =>
      current.includes(sourceType)
        ? current.filter((item) => item !== sourceType)
        : [...current, sourceType]
    );
    setSaveMessage('');
    setSaveError('');
  };

  const savePreferences = () => {
    setSaveMessage('');
    setSaveError('');
    startSavingPrefs(async () => {
      const result = await saveIgnoredSourceTypesAction(ignoredSourceTypes);
      if (!result.ok) {
        setSaveError(result.error ?? 'Failed to save ignore preferences.');
        return;
      }
      setIgnoredSourceTypes(result.ignored_source_types);
      setSaveMessage('Saved');
    });
  };

  const uploadedSourceTypes = useMemo(() => {
    const seen = new Set<ImportSourceType>();
    (state.summary?.items ?? []).forEach((item) => {
      if (item.source_type !== 'unknown') seen.add(item.source_type);
    });
    (state.ignored_reports ?? []).forEach((item) => {
      if (item.source_type !== 'unknown') seen.add(item.source_type);
    });
    return seen;
  }, [state.summary?.items, state.ignored_reports]);

  const requiredSourceTypes = useMemo(
    () => IMPORT_BATCH_SOURCE_TYPES.filter((sourceType) => !ignoredSourceTypes.includes(sourceType)),
    [ignoredSourceTypes]
  );

  const missingRequired = useMemo(
    () => requiredSourceTypes.filter((sourceType) => !uploadedSourceTypes.has(sourceType)),
    [requiredSourceTypes, uploadedSourceTypes]
  );

  const ingestCounts = useMemo(() => {
    const rows = state.summary?.items ?? [];
    return {
      ok: rows.filter((item) => item.ingest.status === 'ok').length,
      already: rows.filter((item) => item.ingest.status === 'already ingested').length,
      failed: rows.filter((item) => item.ingest.status === 'error').length,
    };
  }, [state.summary?.items]);

  const mapCounts = useMemo(() => {
    const rows = state.summary?.items ?? [];
    return {
      ok: rows.filter((item) => item.map.status === 'ok').length,
      missingSnapshot: rows.filter((item) => item.map.status === 'missing_snapshot').length,
      skipped: rows.filter((item) => item.map.status === 'skipped').length,
      failed: rows.filter((item) => item.map.status === 'error').length,
    };
  }, [state.summary?.items]);

  return (
    <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Batch import</div>
          <div className="mt-1 text-lg font-semibold text-foreground">Batch Import (local only)</div>
          <div className="mt-1 text-sm text-muted">
            Upload multiple CSV/XLSX files and run CLI ingestion + mapping in one batch.
          </div>
        </div>
      </div>

      {!props.spawnEnabled ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Batch import is disabled in this build. Set <code>ENABLE_BULKGEN_SPAWN=1</code> to enable
          local CLI spawning.
        </div>
      ) : null}

      <div className="mb-5 rounded-xl border border-border bg-surface-2 p-4">
        <div className="mb-3 text-sm font-semibold text-foreground">
          Ignore source types by default
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {IMPORT_BATCH_SOURCE_TYPES.map((sourceType) => (
            <label key={sourceType} className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={ignoredSourceTypes.includes(sourceType)}
                onChange={() => toggleIgnored(sourceType)}
                className="h-4 w-4 rounded border-border"
              />
              <span>{formatSourceTypeLabel(sourceType)}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={savePreferences}
            disabled={isSavingPrefs}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-foreground disabled:opacity-60"
          >
            {isSavingPrefs ? 'Saving…' : 'Save defaults'}
          </button>
          {saveMessage ? <span className="text-sm text-emerald-700">{saveMessage}</span> : null}
          {saveError ? <span className="text-sm text-rose-700">{saveError}</span> : null}
        </div>
      </div>

      {state.error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <form action={formAction} className="space-y-4">
        <input
          type="hidden"
          name="ignored_source_types_json"
          value={JSON.stringify(ignoredSourceTypes)}
        />

        <label className="flex flex-col text-xs uppercase tracking-wide text-muted">
          Files
          <input
            type="file"
            name="files"
            multiple
            accept=".csv,.xlsx"
            required
            onChange={(event) => {
              setSelectedFiles(Array.from(event.currentTarget.files ?? []));
            }}
            className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-foreground"
          />
        </label>

        {selectedFiles.length > 0 ? (
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="mb-2 text-sm font-semibold text-foreground">
              SalesTrend ASIN overrides (optional per file)
            </div>
            <div className="space-y-3">
              {selectedFiles.map((file, index) =>
                isSalesTrendCsv(file.name) ? (
                  <label key={`${file.name}-${index}`} className="flex flex-col gap-1 text-sm text-muted">
                    <span className="font-medium text-foreground">{file.name}</span>
                    <input
                      type="text"
                      name={`asin_override_${index}`}
                      list={`asin-options-${index}`}
                      placeholder="ASIN (e.g. B0B2K57W5R)"
                      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                    />
                    <datalist id={`asin-options-${index}`}>
                      {props.asinOptions.map((option) => (
                        <option key={option.asin} value={option.asin}>
                          {option.label}
                        </option>
                      ))}
                    </datalist>
                  </label>
                ) : null
              )}
            </div>
          </div>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={!props.spawnEnabled || isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {isPending ? 'Importing…' : 'Run batch import'}
          </button>
        </div>
      </form>

      {state.summary ? (
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted">Ingested</div>
              <div className="mt-1 text-xl font-semibold text-foreground">{ingestCounts.ok}</div>
            </div>
            <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted">Already ingested</div>
              <div className="mt-1 text-xl font-semibold text-foreground">{ingestCounts.already}</div>
            </div>
            <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted">Failed</div>
              <div className="mt-1 text-xl font-semibold text-foreground">{ingestCounts.failed}</div>
            </div>
            <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted">Mapped (ok/missing/skipped/error)</div>
              <div className="mt-1 text-base font-semibold text-foreground">
                {mapCounts.ok} / {mapCounts.missingSnapshot} / {mapCounts.skipped} / {mapCounts.failed}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="text-sm font-semibold text-foreground">Missing required reports</div>
              {missingRequired.length === 0 ? (
                <div className="mt-2 text-sm text-emerald-700">No required source types are missing in this batch.</div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {missingRequired.map((sourceType) => (
                    <span
                      key={sourceType}
                      className="rounded-full border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"
                    >
                      {sourceType}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="text-sm font-semibold text-foreground">Ignored reports</div>
              {state.ignored_reports && state.ignored_reports.length > 0 ? (
                <div className="mt-2 space-y-1 text-sm text-muted">
                  {state.ignored_reports.map((row, index) => (
                    <div key={`${row.original_filename}-${index}`}>
                      {row.original_filename} {row.source_type !== 'unknown' ? `(${row.source_type})` : ''}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm text-muted">No uploaded files were ignored.</div>
              )}
            </div>
          </div>

          <div data-aph-hscroll data-aph-hscroll-axis="x" className="overflow-x-auto rounded-xl border border-border">
            <table className="table-fixed w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="w-[24%] px-3 py-2">File</th>
                  <th className="w-28 px-3 py-2">Date</th>
                  <th className="w-36 px-3 py-2">Source type</th>
                  <th className="w-24 px-3 py-2">Ingest</th>
                  <th className="w-44 px-3 py-2">Upload ID</th>
                  <th className="w-20 px-3 py-2">Rows</th>
                  <th className="w-28 px-3 py-2">Map</th>
                  <th className="w-24 px-3 py-2">Fact rows</th>
                  <th className="w-24 px-3 py-2">Issue rows</th>
                  <th className="w-[26%] px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {(state.summary.items ?? []).map((item, index) => (
                  <tr key={`${item.original_filename}-${index}`} className="align-top">
                    <td className="break-words whitespace-normal px-3 py-2 leading-5 text-foreground">
                      {item.original_filename}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {formatBatchDate(item.exported_at_iso, item.run_at_iso)}
                    </td>
                    <td className="px-3 py-2 text-muted">{item.source_type}</td>
                    <td className="px-3 py-2 text-muted">{item.ingest.status}</td>
                    <td className="px-3 py-2 text-xs text-muted">
                      <span className="block truncate" title={item.ingest.upload_id ?? undefined}>
                        {item.ingest.upload_id ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {item.ingest.row_count !== undefined ? item.ingest.row_count : '—'}
                    </td>
                    <td className="px-3 py-2 text-muted">{item.map.status}</td>
                    <td className="px-3 py-2 text-muted">
                      {item.map.fact_rows !== undefined ? item.map.fact_rows : '—'}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {item.map.issue_rows !== undefined ? item.map.issue_rows : '—'}
                    </td>
                    <td className="break-words whitespace-normal px-3 py-2 text-xs leading-5 text-rose-700">
                      {item.ingest.error ?? item.map.error ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
