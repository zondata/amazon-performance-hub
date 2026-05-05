export type Helium10KeywordTrackerIngestResult = {
  status: "ok" | "already ingested";
  uploadId?: string;
  rowCount?: number;
  coverageStart?: string | null;
  coverageEnd?: string | null;
  asin?: string;
  marketplaceDomainRaw?: string | null;
};

export type SupabaseLikeClient = {
  from(table: string): any;
};

export function inferExportedAtFromFilename(filename: string): string | null;

export function ingestHelium10KeywordTrackerRawWithClient(options: {
  client: SupabaseLikeClient;
  csvPath: string;
  accountId: string;
  marketplace: string;
  exportedAtOverride?: string;
  originalFilenameOverride?: string;
}): Promise<Helium10KeywordTrackerIngestResult>;
