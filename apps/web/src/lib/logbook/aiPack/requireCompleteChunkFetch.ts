import {
  PackIncompleteError,
  toChunkDiagnostics,
} from "./PackIncompleteError";
import type { FetchByDateChunksResult } from "./fetchByDateChunks";

export const requireCompleteChunkFetch = <T>(params: {
  label: string;
  result: FetchByDateChunksResult<T>;
  code?: string;
  context?: Record<string, unknown>;
}): T[] => {
  if (params.result.chunkErrors.length > 0) {
    throw new PackIncompleteError(
      {
        label: params.label,
        code: params.code ?? "CHUNK_FETCH_INCOMPLETE",
        ...toChunkDiagnostics(params.result as FetchByDateChunksResult<unknown>),
        context: params.context,
      },
      `Failed loading ${params.label}: chunk failures detected.`
    );
  }
  return params.result.rows;
};
