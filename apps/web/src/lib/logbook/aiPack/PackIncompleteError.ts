import type {
  ChunkError,
  FetchByDateChunksResult,
  FetchByDateChunksStats,
} from "./fetchByDateChunks";

export type PackIncompleteMeta = {
  label: string;
  code: string;
  stats?: FetchByDateChunksStats;
  chunkErrors?: ChunkError[];
  context?: Record<string, unknown>;
};

const defaultMessage = (meta: PackIncompleteMeta): string => {
  const chunksFailed = meta.stats?.chunksFailed ?? meta.chunkErrors?.length ?? 0;
  const chunksTotal = meta.stats?.chunksTotal ?? 0;
  if (chunksTotal > 0) {
    return `Failed loading ${meta.label}: ${chunksFailed}/${chunksTotal} chunk failures.`;
  }
  return `Failed loading ${meta.label}.`;
};

export class PackIncompleteError extends Error {
  readonly status = "pack_incomplete" as const;
  readonly label: string;
  readonly code: string;
  readonly stats?: FetchByDateChunksStats;
  readonly chunkErrors: ChunkError[];
  readonly context?: Record<string, unknown>;

  constructor(meta: PackIncompleteMeta, message?: string) {
    super(message ?? defaultMessage(meta));
    this.name = "PackIncompleteError";
    this.label = meta.label;
    this.code = meta.code;
    this.stats = meta.stats;
    this.chunkErrors = meta.chunkErrors ?? [];
    this.context = meta.context;
  }
}

export const toChunkDiagnostics = (
  result: FetchByDateChunksResult<unknown>
): Pick<PackIncompleteMeta, "stats" | "chunkErrors"> => ({
  stats: result.stats,
  chunkErrors: result.chunkErrors,
});
