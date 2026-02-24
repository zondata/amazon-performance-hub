export type PackMessageLevel = "debug" | "info" | "warn" | "error";

export type PackMessage = {
  level: PackMessageLevel;
  code: string;
  text: string;
  meta?: Record<string, unknown>;
};

export const legacyWarningsFromMessages = (messages: PackMessage[]): string[] =>
  messages
    .filter((message) => message.level === "warn" || message.level === "error")
    .map((message) => message.text);

export const describeChunkFailureKind = (params: {
  chunksFailed: number;
  timeoutFailures: number;
}): string => {
  if (params.timeoutFailures === params.chunksFailed) return "timeouts";
  if (params.timeoutFailures === 0) return "errors";
  return "mixed errors";
};

export const buildChunkFailureMessage = (params: {
  label: string;
  chunksTotal: number;
  chunksFailed: number;
  timeoutFailures: number;
  allChunksFailedSuffix: string;
  isSpReconciliation?: boolean;
}): PackMessage | null => {
  if (params.chunksFailed <= 0) return null;
  const failureKind = describeChunkFailureKind({
    chunksFailed: params.chunksFailed,
    timeoutFailures: params.timeoutFailures,
  });
  const isAllFailed = params.chunksFailed === params.chunksTotal && params.chunksTotal > 0;

  if (params.isSpReconciliation) {
    if (isAllFailed) {
      return {
        level: "error",
        code: "CHUNK_FAILED",
        text: `SP reconciliation failed: all ${params.chunksTotal}/${params.chunksTotal} chunks failed (${failureKind}). See meta.fetch_diagnostics.`,
        meta: {
          label: params.label,
          chunks_total: params.chunksTotal,
          chunks_failed: params.chunksFailed,
          failure_kind: failureKind,
          impact: params.allChunksFailedSuffix,
        },
      };
    }
    return {
      level: "warn",
      code: "CHUNK_PARTIAL",
      text: `SP reconciliation partial: ${params.chunksFailed}/${params.chunksTotal} chunks failed (${failureKind}). See meta.fetch_diagnostics.`,
      meta: {
        label: params.label,
        chunks_total: params.chunksTotal,
        chunks_failed: params.chunksFailed,
        failure_kind: failureKind,
      },
    };
  }

  if (isAllFailed) {
    return {
      level: "error",
      code: "CHUNK_FAILED",
      text: `Failed loading ${params.label}: all ${params.chunksTotal} chunks failed (${failureKind}); ${params.allChunksFailedSuffix}`,
      meta: {
        label: params.label,
        chunks_total: params.chunksTotal,
        chunks_failed: params.chunksFailed,
        failure_kind: failureKind,
      },
    };
  }

  return {
    level: "warn",
    code: "CHUNK_PARTIAL",
    text: `Failed loading ${params.label}: partial data due to chunk failures (${params.chunksFailed}/${params.chunksTotal} chunks failed; ${failureKind}); using successful chunks only.`,
    meta: {
      label: params.label,
      chunks_total: params.chunksTotal,
      chunks_failed: params.chunksFailed,
      failure_kind: failureKind,
    },
  };
};

export const buildNoChannelMessages = (params: {
  hasSbCampaignCandidates: boolean;
  hasSdCampaignCandidates: boolean;
}): PackMessage[] => {
  const messages: PackMessage[] = [];
  if (!params.hasSbCampaignCandidates) {
    messages.push({
      level: "info",
      code: "NO_SB_FOR_ASIN",
      text: "No Sponsored Brands data for this ASIN in the selected range.",
    });
  }
  if (!params.hasSdCampaignCandidates) {
    messages.push({
      level: "info",
      code: "NO_SD_FOR_ASIN",
      text: "No Sponsored Display data for this ASIN in the selected range.",
    });
  }
  return messages;
};
