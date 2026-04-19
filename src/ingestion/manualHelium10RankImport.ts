import fs from 'node:fs';
import path from 'node:path';

import { normText } from '../bulk/parseSponsoredProductsBulk';
import { normalizeHeader, parseIntSafe } from '../ads/sdReportUtils';
import { hashFileSha256 } from '../ingest/utils';
import {
  InMemoryIngestionJobRepository,
  IngestionJobRunner,
  IngestionJobRunnerError,
  type IngestionJobRepository,
  type IngestionJobRunResult,
} from './jobRunner';

export const MANUAL_H10_RANK_IMPORT_SOURCE_NAME = 'h10_keyword_tracker_manual_csv';
export const MANUAL_H10_RANK_IMPORT_JOB_KEY = 'manual_h10_rank_csv_import';

export type ManualHelium10RankKind = 'exact' | 'gte' | 'missing';

export interface ManualHelium10RankRow {
  marketplace_domain_raw: string;
  asin: string;
  title: string | null;
  keyword_raw: string;
  keyword_norm: string;
  keyword_sales: number | null;
  search_volume: number | null;
  organic_rank_raw: string | null;
  organic_rank_value: number | null;
  organic_rank_kind: ManualHelium10RankKind;
  sponsored_pos_raw: string | null;
  sponsored_pos_value: number | null;
  sponsored_pos_kind: ManualHelium10RankKind;
  observed_at: string;
  observed_date: string;
}

export interface ManualHelium10RankValidationIssue {
  rowNumber: number;
  code: string;
  message: string;
}

export interface ManualHelium10RankImportSummary {
  filePath: string;
  fileName: string;
  fileHashSha256: string;
  accountId: string;
  marketplace: string;
  asin: string;
  marketplaceDomainRaw: string;
  coverageStart: string;
  coverageEnd: string;
  inputRowCount: number;
  acceptedRowCount: number;
  duplicateRowCount: number;
  rejectedRowCount: number;
  warningCount: number;
  jobResult: IngestionJobRunResult['result'];
  jobStatus: IngestionJobRunResult['job']['processing_status'];
  jobId: string;
  idempotencyKey: string;
  executorInvoked: boolean;
  watermarkStatus: string | null;
}

export interface ManualHelium10RankImportResult {
  rows: ManualHelium10RankRow[];
  duplicateRows: ManualHelium10RankRow[];
  warnings: ManualHelium10RankValidationIssue[];
  summary: ManualHelium10RankImportSummary;
  job: IngestionJobRunResult;
}

export interface ManualHelium10RankImportOptions {
  csvPath: string;
  accountId: string;
  marketplace: string;
  repository?: IngestionJobRepository;
  now?: () => string;
  createJobId?: () => string;
}

export class ManualHelium10RankImportError extends Error {
  readonly code:
    | 'invalid_file'
    | 'invalid_header'
    | 'invalid_row'
    | 'mixed_scope'
    | 'duplicate_conflict'
    | 'empty_file'
    | 'job_failed';
  readonly issues: ManualHelium10RankValidationIssue[];

  constructor(
    code: ManualHelium10RankImportError['code'],
    message: string,
    issues: ManualHelium10RankValidationIssue[] = []
  ) {
    super(message);
    this.name = 'ManualHelium10RankImportError';
    this.code = code;
    this.issues = issues;
  }
}

const REQUIRED_HEADERS = [
  'marketplace',
  'asin',
  'keyword',
  'date added',
  'organic rank',
  'sponsored position',
] as const;

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === '"') {
      const next = content[index + 1];
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      current.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && content[index + 1] === '\n') index += 1;
      current.push(field);
      field = '';
      if (current.length > 1 || current[0]?.trim()) rows.push(current);
      current = [];
      continue;
    }

    field += char;
  }

  if (field.length || current.length) {
    current.push(field);
    if (current.length > 1 || current[0]?.trim()) rows.push(current);
  }

  if (inQuotes) {
    throw new ManualHelium10RankImportError('invalid_file', 'CSV has an unterminated quoted field.');
  }

  return rows;
}

function mapHeaders(headers: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (let index = 0; index < headers.length; index += 1) {
    out[normalizeHeader(headers[index] ?? '')] = index;
  }
  return out;
}

function getCell(row: string[], headers: Record<string, number>, name: string): string {
  const index = headers[name];
  return index === undefined ? '' : String(row[index] ?? '');
}

function toTimestampString(parts: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}): string {
  const year = String(parts.year).padStart(4, '0');
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  const hour = String(parts.hour ?? 0).padStart(2, '0');
  const minute = String(parts.minute ?? 0).padStart(2, '0');
  const second = String(parts.second ?? 0).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function parseObservedAt(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw === '-') return null;

  const isoLike = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?(?:\.\d+)?(?:\s*(Z|[+-]\d{2}:?\d{2}))?$/i
  );
  if (isoLike) {
    if (isoLike[7]) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return toTimestampString({
          year: parsed.getUTCFullYear(),
          month: parsed.getUTCMonth() + 1,
          day: parsed.getUTCDate(),
          hour: parsed.getUTCHours(),
          minute: parsed.getUTCMinutes(),
          second: parsed.getUTCSeconds(),
        });
      }
    }

    return toTimestampString({
      year: Number.parseInt(isoLike[1], 10),
      month: Number.parseInt(isoLike[2], 10),
      day: Number.parseInt(isoLike[3], 10),
      hour: isoLike[4] ? Number.parseInt(isoLike[4], 10) : 0,
      minute: isoLike[5] ? Number.parseInt(isoLike[5], 10) : 0,
      second: isoLike[6] ? Number.parseInt(isoLike[6], 10) : 0,
    });
  }

  const slash = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i
  );
  if (!slash) return null;

  let hour = slash[4] ? Number.parseInt(slash[4], 10) : 0;
  const minute = slash[5] ? Number.parseInt(slash[5], 10) : 0;
  const second = slash[6] ? Number.parseInt(slash[6], 10) : 0;
  const meridiem = (slash[7] ?? '').toUpperCase();

  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (meridiem === 'PM' && hour < 12) hour += 12;

  return toTimestampString({
    year: Number.parseInt(slash[3], 10),
    month: Number.parseInt(slash[1], 10),
    day: Number.parseInt(slash[2], 10),
    hour,
    minute,
    second,
  });
}

function parseNullableInt(value: string): number | null {
  const raw = value.trim();
  if (!raw || raw === '-') return null;
  const parsed = parseIntSafe(raw);
  return parsed === null || !Number.isFinite(parsed) ? null : parsed;
}

function parseRankField(value: string): {
  raw: string | null;
  kind: ManualHelium10RankKind;
  parsedValue: number | null;
  valid: boolean;
} {
  const raw = value.trim();
  if (!raw || raw === '-') {
    return { raw: raw || null, kind: 'missing', parsedValue: null, valid: true };
  }

  const gte = raw.match(/^>\s*([0-9,]+)$/);
  if (gte) {
    const parsed = parseIntSafe(gte[1]);
    return { raw, kind: 'gte', parsedValue: parsed, valid: parsed !== null && parsed > 0 };
  }

  const exact = raw.match(/^([0-9,]+)$/);
  if (exact) {
    const parsed = parseIntSafe(exact[1]);
    return { raw, kind: 'exact', parsedValue: parsed, valid: parsed !== null && parsed > 0 };
  }

  return { raw, kind: 'missing', parsedValue: null, valid: false };
}

const buildDedupeKey = (row: ManualHelium10RankRow): string =>
  [
    row.marketplace_domain_raw.toLowerCase(),
    row.asin,
    row.keyword_norm,
    row.observed_date,
  ].join('|');

const comparableRowPayload = (row: ManualHelium10RankRow): string =>
  JSON.stringify({
    title: row.title,
    keyword_sales: row.keyword_sales,
    search_volume: row.search_volume,
    organic_rank_raw: row.organic_rank_raw,
    organic_rank_value: row.organic_rank_value,
    organic_rank_kind: row.organic_rank_kind,
    sponsored_pos_raw: row.sponsored_pos_raw,
    sponsored_pos_value: row.sponsored_pos_value,
    sponsored_pos_kind: row.sponsored_pos_kind,
    observed_at: row.observed_at,
  });

export function validateManualHelium10RankCsv(csvPath: string): {
  rows: ManualHelium10RankRow[];
  duplicateRows: ManualHelium10RankRow[];
  warnings: ManualHelium10RankValidationIssue[];
  inputRowCount: number;
  asin: string;
  marketplaceDomainRaw: string;
  coverageStart: string;
  coverageEnd: string;
} {
  if (path.extname(csvPath).toLowerCase() !== '.csv') {
    throw new ManualHelium10RankImportError(
      'invalid_file',
      `Helium 10 rank import requires a .csv file: ${csvPath}`
    );
  }
  if (!fs.existsSync(csvPath)) {
    throw new ManualHelium10RankImportError('invalid_file', `CSV file not found: ${csvPath}`);
  }

  const csvRows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  if (!csvRows.length) {
    throw new ManualHelium10RankImportError('empty_file', 'Helium 10 rank CSV is empty.');
  }

  const headers = mapHeaders(csvRows[0] ?? []);
  const missingHeaders = REQUIRED_HEADERS.filter((header) => headers[header] === undefined);
  if (missingHeaders.length > 0) {
    throw new ManualHelium10RankImportError(
      'invalid_header',
      `Helium 10 rank CSV is missing required column(s): ${missingHeaders.join(', ')}`,
      missingHeaders.map((header) => ({
        rowNumber: 1,
        code: 'missing_required_column',
        message: `Missing required column: ${header}`,
      }))
    );
  }

  const issues: ManualHelium10RankValidationIssue[] = [];
  const warnings: ManualHelium10RankValidationIssue[] = [];
  const rows: ManualHelium10RankRow[] = [];
  const duplicateRows: ManualHelium10RankRow[] = [];
  const seen = new Map<string, ManualHelium10RankRow>();
  const asinSet = new Set<string>();
  const marketplaceSet = new Set<string>();
  let coverageStart: string | null = null;
  let coverageEnd: string | null = null;
  let inputRowCount = 0;

  for (let rowIndex = 1; rowIndex < csvRows.length; rowIndex += 1) {
    const row = csvRows[rowIndex] ?? [];
    if (row.every((cell) => !String(cell ?? '').trim())) continue;
    inputRowCount += 1;

    const rowNumber = rowIndex + 1;
    const marketplaceDomainRaw = getCell(row, headers, 'marketplace').trim();
    const asin = getCell(row, headers, 'asin').trim().toUpperCase();
    const keywordRaw = getCell(row, headers, 'keyword').trim();
    const observedAt = parseObservedAt(getCell(row, headers, 'date added'));
    const organic = parseRankField(getCell(row, headers, 'organic rank'));
    const sponsored = parseRankField(getCell(row, headers, 'sponsored position'));

    if (!marketplaceDomainRaw) {
      issues.push({ rowNumber, code: 'missing_marketplace', message: 'Marketplace is required.' });
    }
    if (!asin) {
      issues.push({ rowNumber, code: 'missing_asin', message: 'ASIN is required.' });
    }
    if (!keywordRaw) {
      issues.push({ rowNumber, code: 'missing_keyword', message: 'Keyword is required.' });
    }
    if (!observedAt) {
      issues.push({ rowNumber, code: 'invalid_date_added', message: 'Date Added is required and must be parseable.' });
    }
    if (!organic.valid) {
      issues.push({ rowNumber, code: 'invalid_organic_rank', message: `Organic Rank is malformed: ${organic.raw}` });
    }
    if (!sponsored.valid) {
      issues.push({
        rowNumber,
        code: 'invalid_sponsored_position',
        message: `Sponsored Position is malformed: ${sponsored.raw}`,
      });
    }

    if (!marketplaceDomainRaw || !asin || !keywordRaw || !observedAt || !organic.valid || !sponsored.valid) {
      continue;
    }

    asinSet.add(asin);
    marketplaceSet.add(marketplaceDomainRaw.toLowerCase());

    const normalizedRow: ManualHelium10RankRow = {
      marketplace_domain_raw: marketplaceDomainRaw,
      asin,
      title: getCell(row, headers, 'title').trim() || null,
      keyword_raw: keywordRaw,
      keyword_norm: normText(keywordRaw),
      keyword_sales: parseNullableInt(getCell(row, headers, 'keyword sales')),
      search_volume: parseNullableInt(getCell(row, headers, 'search volume')),
      organic_rank_raw: organic.raw,
      organic_rank_value: organic.parsedValue,
      organic_rank_kind: organic.kind,
      sponsored_pos_raw: sponsored.raw,
      sponsored_pos_value: sponsored.parsedValue,
      sponsored_pos_kind: sponsored.kind,
      observed_at: observedAt,
      observed_date: observedAt.slice(0, 10),
    };

    const key = buildDedupeKey(normalizedRow);
    const existing = seen.get(key);
    if (existing) {
      if (comparableRowPayload(existing) !== comparableRowPayload(normalizedRow)) {
        issues.push({
          rowNumber,
          code: 'duplicate_conflict',
          message: `Duplicate row conflicts with earlier row for ${normalizedRow.asin}/${normalizedRow.keyword_norm}/${normalizedRow.observed_date}.`,
        });
        continue;
      }

      duplicateRows.push(normalizedRow);
      warnings.push({
        rowNumber,
        code: 'duplicate_row_deduped',
        message: `Duplicate row deduped for ${normalizedRow.asin}/${normalizedRow.keyword_norm}/${normalizedRow.observed_date}.`,
      });
      continue;
    }

    seen.set(key, normalizedRow);
    rows.push(normalizedRow);
    if (!coverageStart || normalizedRow.observed_date < coverageStart) coverageStart = normalizedRow.observed_date;
    if (!coverageEnd || normalizedRow.observed_date > coverageEnd) coverageEnd = normalizedRow.observed_date;
  }

  if (asinSet.size > 1) {
    issues.push({
      rowNumber: 0,
      code: 'mixed_asin_scope',
      message: `Helium 10 rank CSV contains multiple ASINs: ${Array.from(asinSet).sort().join(', ')}.`,
    });
  }
  if (marketplaceSet.size > 1) {
    issues.push({
      rowNumber: 0,
      code: 'mixed_marketplace_scope',
      message: `Helium 10 rank CSV contains multiple marketplaces: ${Array.from(marketplaceSet).sort().join(', ')}.`,
    });
  }
  if (inputRowCount === 0 || rows.length === 0) {
    issues.push({
      rowNumber: 0,
      code: 'no_importable_rows',
      message: 'Helium 10 rank CSV has no importable rows.',
    });
  }

  if (issues.length > 0) {
    const mixedScope = issues.some((issue) => issue.code.startsWith('mixed_'));
    const duplicateConflict = issues.some((issue) => issue.code === 'duplicate_conflict');
    throw new ManualHelium10RankImportError(
      duplicateConflict ? 'duplicate_conflict' : mixedScope ? 'mixed_scope' : 'invalid_row',
      `Helium 10 rank CSV failed validation with ${issues.length} issue(s).`,
      issues
    );
  }

  return {
    rows,
    duplicateRows,
    warnings,
    inputRowCount,
    asin: Array.from(asinSet)[0],
    marketplaceDomainRaw: rows[0].marketplace_domain_raw,
    coverageStart: coverageStart as string,
    coverageEnd: coverageEnd as string,
  };
}

export async function runManualHelium10RankImport(
  options: ManualHelium10RankImportOptions
): Promise<ManualHelium10RankImportResult> {
  const accountId = options.accountId.trim();
  const marketplace = options.marketplace.trim().toUpperCase();
  if (!accountId) {
    throw new ManualHelium10RankImportError('invalid_file', 'accountId is required.');
  }
  if (!marketplace) {
    throw new ManualHelium10RankImportError('invalid_file', 'marketplace is required.');
  }

  const resolvedPath = path.resolve(options.csvPath);
  const validation = validateManualHelium10RankCsv(resolvedPath);
  const fileHashSha256 = hashFileSha256(resolvedPath);
  const repository = options.repository ?? new InMemoryIngestionJobRepository();
  const createJobId = options.createJobId ?? (() => `h10-rank-import-${fileHashSha256.slice(0, 12)}`);
  const runner = new IngestionJobRunner({
    repository,
    now: options.now,
    createJobId,
    executor: async () => ({
      outcome: 'success',
      rowCount: validation.rows.length,
      checksum: fileHashSha256,
      metadata: {
        import_summary: {
          file_name: path.basename(resolvedPath),
          file_hash_sha256: fileHashSha256,
          input_row_count: validation.inputRowCount,
          accepted_row_count: validation.rows.length,
          duplicate_row_count: validation.duplicateRows.length,
          rejected_row_count: 0,
          warning_count: validation.warnings.length,
          asin: validation.asin,
          marketplace_domain_raw: validation.marketplaceDomainRaw,
          coverage_start: validation.coverageStart,
          coverage_end: validation.coverageEnd,
        },
      },
    }),
  });

  const idempotencyKey = [
    MANUAL_H10_RANK_IMPORT_SOURCE_NAME,
    accountId,
    marketplace,
    validation.asin,
    fileHashSha256,
  ].join('/');
  const scopeKey = `asin:${validation.asin}`;
  const job = await runner.submitJob({
    jobKey: MANUAL_H10_RANK_IMPORT_JOB_KEY,
    sourceName: MANUAL_H10_RANK_IMPORT_SOURCE_NAME,
    accountId,
    marketplace,
    sourceWindowStart: validation.coverageStart,
    sourceWindowEnd: validation.coverageEnd,
    idempotencyKey,
    runKind: 'manual',
    scopeKey,
    metadata: {
      manual_import: true,
      input_file_name: path.basename(resolvedPath),
      file_hash_sha256: fileHashSha256,
      source_type: 'h10_keyword_tracker',
    },
  });

  if (job.job.processing_status !== 'available') {
    throw new ManualHelium10RankImportError(
      'job_failed',
      `Manual Helium 10 rank import job did not finish successfully: ${job.job.processing_status}`
    );
  }

  return {
    rows: validation.rows,
    duplicateRows: validation.duplicateRows,
    warnings: validation.warnings,
    job,
    summary: {
      filePath: resolvedPath,
      fileName: path.basename(resolvedPath),
      fileHashSha256,
      accountId,
      marketplace,
      asin: validation.asin,
      marketplaceDomainRaw: validation.marketplaceDomainRaw,
      coverageStart: validation.coverageStart,
      coverageEnd: validation.coverageEnd,
      inputRowCount: validation.inputRowCount,
      acceptedRowCount: validation.rows.length,
      duplicateRowCount: validation.duplicateRows.length,
      rejectedRowCount: 0,
      warningCount: validation.warnings.length,
      jobResult: job.result,
      jobStatus: job.job.processing_status,
      jobId: job.job.id,
      idempotencyKey,
      executorInvoked: job.executorInvoked,
      watermarkStatus: job.watermark?.status ?? null,
    },
  };
}

export function summarizeManualHelium10RankImport(result: ManualHelium10RankImportResult): string {
  const summary = result.summary;
  return [
    'Manual Helium 10 rank CSV import completed.',
    `file=${summary.filePath}`,
    `file_hash_sha256=${summary.fileHashSha256}`,
    `account_id=${summary.accountId}`,
    `marketplace=${summary.marketplace}`,
    `asin=${summary.asin}`,
    `marketplace_domain=${summary.marketplaceDomainRaw}`,
    `coverage_start=${summary.coverageStart}`,
    `coverage_end=${summary.coverageEnd}`,
    `input_rows=${summary.inputRowCount}`,
    `accepted_rows=${summary.acceptedRowCount}`,
    `deduped_rows=${summary.duplicateRowCount}`,
    `rejected_rows=${summary.rejectedRowCount}`,
    `warnings=${summary.warningCount}`,
    `job_result=${summary.jobResult}`,
    `job_status=${summary.jobStatus}`,
    `job_id=${summary.jobId}`,
    `idempotency_key=${summary.idempotencyKey}`,
    `executor_invoked=${summary.executorInvoked ? 'yes' : 'no'}`,
    `watermark_status=${summary.watermarkStatus ?? 'none'}`,
  ].join('\n');
}
