import { getSupabaseClient } from "../db/supabaseClient";
import {
  inferExportedAtFromFilename,
  ingestHelium10KeywordTrackerRawWithClient,
  type Helium10KeywordTrackerIngestResult,
  type SupabaseLikeClient,
} from "../../shared/helium10KeywordTrackerIngestCore";

export type { Helium10KeywordTrackerIngestResult };
export { inferExportedAtFromFilename };

export async function ingestHelium10KeywordTrackerRaw(
  csvPath: string,
  accountId: string,
  marketplace: string,
  exportedAtOverride?: string,
  originalFilenameOverride?: string
): Promise<Helium10KeywordTrackerIngestResult> {
  const client = getSupabaseClient();
  return ingestHelium10KeywordTrackerRawWithClient({
    client,
    csvPath,
    accountId,
    marketplace,
    exportedAtOverride,
    originalFilenameOverride,
  });
}

export async function ingestHelium10KeywordTrackerRawWithSupabaseClient(
  client: SupabaseLikeClient,
  csvPath: string,
  accountId: string,
  marketplace: string,
  exportedAtOverride?: string,
  originalFilenameOverride?: string
): Promise<Helium10KeywordTrackerIngestResult> {
  return ingestHelium10KeywordTrackerRawWithClient({
    client,
    csvPath,
    accountId,
    marketplace,
    exportedAtOverride,
    originalFilenameOverride,
  });
}
