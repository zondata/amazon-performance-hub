export type ChunkError = {
  chunkStart: string;
  chunkEnd: string;
  message: string;
  timedOut: boolean;
};

export type FetchByDateChunksArgs<T> = {
  startDate: string;
  endDate: string;
  chunkDays?: number;
  maxRetries?: number;
  runChunk: (chunkStart: string, chunkEnd: string) => Promise<T[]>;
};

export type FetchByDateChunksStats = {
  chunksTotal: number;
  chunksSucceeded: number;
  chunksFailed: number;
  retriesUsedMax: number;
  failedRangesCount: number;
  failedRangesSample: Array<Pick<ChunkError, "chunkStart" | "chunkEnd" | "message">>;
};

export type FetchByDateChunksResult<T> = {
  rows: T[];
  chunkErrors: ChunkError[];
  stats: FetchByDateChunksStats;
};

type DateChunk = {
  start: string;
  end: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDateString = (value: Date): string => value.toISOString().slice(0, 10);

const parseIsoDate = (value: string): Date => {
  if (!DATE_RE.test(value)) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || toDateString(parsed) !== value) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return parsed;
};

const addDays = (date: string, days: number): string => {
  const parsed = parseIsoDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toDateString(parsed);
};

const getDayCountInclusive = (startDate: string, endDate: string): number => {
  const start = parseIsoDate(startDate).getTime();
  const end = parseIsoDate(endDate).getTime();
  if (start > end) return 0;
  return Math.floor((end - start) / MS_PER_DAY) + 1;
};

const normalizeChunkDays = (chunkDays: number | undefined): number => {
  if (typeof chunkDays !== "number" || !Number.isFinite(chunkDays)) return 7;
  const normalized = Math.floor(chunkDays);
  return normalized > 0 ? normalized : 7;
};

const normalizeMaxRetries = (maxRetries: number | undefined): number => {
  if (typeof maxRetries !== "number" || !Number.isFinite(maxRetries)) return 1;
  const normalized = Math.floor(maxRetries);
  return normalized >= 0 ? normalized : 1;
};

const chooseChunkDays = (dayCountInclusive: number, requestedChunkDays: number): number => {
  let effectiveChunkDays = normalizeChunkDays(requestedChunkDays);
  let chunkCount = Math.ceil(dayCountInclusive / effectiveChunkDays);
  if (chunkCount > 60 && effectiveChunkDays < 14) {
    effectiveChunkDays = 14;
    chunkCount = Math.ceil(dayCountInclusive / effectiveChunkDays);
  }
  if (chunkCount > 60 && effectiveChunkDays < 30) {
    effectiveChunkDays = 30;
  }
  return effectiveChunkDays;
};

const buildDateChunks = (startDate: string, endDate: string, chunkDays = 7): DateChunk[] => {
  const dayCountInclusive = getDayCountInclusive(startDate, endDate);
  if (dayCountInclusive <= 0) return [];

  const effectiveChunkDays = chooseChunkDays(dayCountInclusive, chunkDays);
  const chunks: DateChunk[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    const chunkEnd = addDays(cursor, effectiveChunkDays - 1);
    const cappedEnd = chunkEnd > endDate ? endDate : chunkEnd;
    chunks.push({ start: cursor, end: cappedEnd });
    if (cappedEnd >= endDate) break;
    cursor = addDays(cappedEnd, 1);
  }
  return chunks;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && typeof error.message === "string" && error.message.length > 0) {
    return error.message;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "unknown error";
};

export const isStatementTimeoutMessage = (message: string): boolean =>
  /statement timeout|canceling statement/i.test(message);

export async function fetchByDateChunks<T>(
  args: FetchByDateChunksArgs<T>
): Promise<FetchByDateChunksResult<T>> {
  const chunks = buildDateChunks(args.startDate, args.endDate, args.chunkDays ?? 7);
  const maxRetries = normalizeMaxRetries(args.maxRetries);
  const rows: T[] = [];
  const chunkErrors: ChunkError[] = [];
  let retriesUsedMax = 0;

  for (const chunk of chunks) {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const chunkRows = await args.runChunk(chunk.start, chunk.end);
        rows.push(...chunkRows);
        retriesUsedMax = Math.max(retriesUsedMax, attempt);
        break;
      } catch (error) {
        const message = toErrorMessage(error);
        const canRetry = attempt < maxRetries;
        if (canRetry) {
          attempt += 1;
          continue;
        }
        retriesUsedMax = Math.max(retriesUsedMax, attempt);
        chunkErrors.push({
          chunkStart: chunk.start,
          chunkEnd: chunk.end,
          message,
          timedOut: isStatementTimeoutMessage(message),
        });
        break;
      }
    }
  }

  const stats: FetchByDateChunksStats = {
    chunksTotal: chunks.length,
    chunksSucceeded: chunks.length - chunkErrors.length,
    chunksFailed: chunkErrors.length,
    retriesUsedMax,
    failedRangesCount: chunkErrors.length,
    failedRangesSample: chunkErrors.slice(0, 3).map((entry) => ({
      chunkStart: entry.chunkStart,
      chunkEnd: entry.chunkEnd,
      message: entry.message,
    })),
  };

  return {
    rows,
    chunkErrors,
    stats,
  };
}
