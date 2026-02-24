import { describe, expect, it } from "vitest";

import {
  buildChunkFailureMessage,
  buildNoChannelMessages,
  legacyWarningsFromMessages,
  type PackMessage,
} from "../apps/web/src/lib/logbook/aiPack/packMessages";

describe("pack message helpers", () => {
  it("marks no-SB channel as info and keeps legacy warnings empty", () => {
    const messages = buildNoChannelMessages({
      hasSbCampaignCandidates: false,
      hasSdCampaignCandidates: true,
    });

    expect(messages).toEqual([
      {
        level: "info",
        code: "NO_SB_FOR_ASIN",
        text: "No Sponsored Brands data for this ASIN in the selected range.",
      },
    ]);
    expect(legacyWarningsFromMessages(messages)).toEqual([]);
  });

  it("maps chunk partial failures to warn and keeps warn/error-only legacy warnings", () => {
    const partial = buildChunkFailureMessage({
      label: "SP reconciliation rows",
      chunksTotal: 4,
      chunksFailed: 1,
      timeoutFailures: 1,
      allChunksFailedSuffix: "values may appear as 0.",
      isSpReconciliation: true,
    });
    expect(partial).toMatchObject({
      level: "warn",
      code: "CHUNK_PARTIAL",
    });
    expect(partial?.text).toContain("SP reconciliation partial");

    const messages: PackMessage[] = [
      {
        level: "info",
        code: "NO_SB_FOR_ASIN",
        text: "No Sponsored Brands data for this ASIN in the selected range.",
      },
      partial as PackMessage,
    ];

    expect(legacyWarningsFromMessages(messages)).toEqual([(partial as PackMessage).text]);
  });
});
