import fs from "node:fs";
import path from "node:path";
import { ingestBulk } from "../ingest/ingestBulk";
import { ingestSpCampaignRaw } from "../ingest/ingestSpCampaignRaw";
import { ingestSpPlacementRaw } from "../ingest/ingestSpPlacementRaw";
import { ingestSpTargetingRaw } from "../ingest/ingestSpTargetingRaw";
import { ingestSpStisRaw } from "../ingest/ingestSpStisRaw";
import { ingestSpAdvertisedProductRaw } from "../ingest/ingestSpAdvertisedProductRaw";
import { ingestSbCampaignRaw } from "../ingest/ingestSbCampaignRaw";
import { ingestSbCampaignPlacementRaw } from "../ingest/ingestSbCampaignPlacementRaw";
import { ingestSbKeywordRaw } from "../ingest/ingestSbKeywordRaw";
import { ingestSbStisRaw } from "../ingest/ingestSbStisRaw";
import { ingestSbAttributedPurchasesRaw } from "../ingest/ingestSbAttributedPurchasesRaw";
import { ingestSdCampaignRaw } from "../ingest/ingestSdCampaignRaw";
import { ingestSdAdvertisedProductRaw } from "../ingest/ingestSdAdvertisedProductRaw";
import { ingestSdTargetingRaw } from "../ingest/ingestSdTargetingRaw";
import { ingestSdMatchedTargetRaw } from "../ingest/ingestSdMatchedTargetRaw";
import { ingestSdPurchasedProductRaw } from "../ingest/ingestSdPurchasedProductRaw";
import { ingestScaleInsightsSalesTrendRaw } from "../ingest/ingestScaleInsightsSalesTrendRaw";
import { ingestHelium10KeywordTrackerRaw } from "../ingest/ingestHelium10KeywordTrackerRaw";
import { ingestSqpWeeklyRaw } from "../ingest/ingestSqpWeeklyRaw";
import { detectSourceTypeFromFilename, type DetectedSourceType } from "../fs/reportLocator";
import { mapUpload as mapSpUpload } from "../mapping/db";
import { mapUpload as mapSbUpload } from "../mapping_sb/db";
import { mapUpload as mapSdUpload } from "../mapping_sd/db";
import { upsertImportSourceStatus } from "../importStatus/db";
import { rejectDeprecatedAccountId } from "./_accountGuard";
import { resolveSalesTrendAsinOverrideFromManifestItem } from "./importBatchManifestHelpers";

type ManifestItem = {
  path: string;
  original_filename?: string;
  asin_override?: string;
};

type Manifest = {
  account_id?: string;
  marketplace?: string;
  items?: ManifestItem[];
};

type IngestSummary = {
  status: "ok" | "already ingested" | "error";
  upload_id?: string;
  row_count?: number;
  message?: string;
  error?: string;
};

type MapSummary = {
  status: "ok" | "not_required" | "missing_snapshot" | "skipped" | "error";
  fact_rows?: number;
  issue_rows?: number;
  message?: string;
  error?: string;
};

type ItemSummary = {
  original_filename: string;
  source_type: DetectedSourceType | "unknown";
  exported_at_iso?: string;
  run_at_iso: string;
  ingest: IngestSummary;
  map: MapSummary;
};

type BatchSummary = {
  items: ItemSummary[];
};

const SP_MAPPABLE: ReadonlySet<DetectedSourceType> = new Set([
  "sp_campaign",
  "sp_placement",
  "sp_advertised_product",
  "sp_targeting",
  "sp_stis",
]);

const SB_MAPPABLE: ReadonlySet<DetectedSourceType> = new Set([
  "sb_campaign",
  "sb_campaign_placement",
  "sb_keyword",
  "sb_stis",
]);

const SD_MAPPABLE: ReadonlySet<DetectedSourceType> = new Set([
  "sd_campaign",
  "sd_advertised_product",
  "sd_targeting",
  "sd_matched_target",
  "sd_purchased_product",
]);

type SpMapReportType =
  | "sp_campaign"
  | "sp_placement"
  | "sp_advertised_product"
  | "sp_targeting"
  | "sp_stis";
type SbMapReportType = "sb_campaign" | "sb_campaign_placement" | "sb_keyword" | "sb_stis";
type SdMapReportType =
  | "sd_campaign"
  | "sd_advertised_product"
  | "sd_targeting"
  | "sd_matched_target"
  | "sd_purchased_product";

function isSpMapReportType(sourceType: DetectedSourceType): sourceType is SpMapReportType {
  return SP_MAPPABLE.has(sourceType);
}

function isSbMapReportType(sourceType: DetectedSourceType): sourceType is SbMapReportType {
  return SB_MAPPABLE.has(sourceType);
}

function isSdMapReportType(sourceType: DetectedSourceType): sourceType is SdMapReportType {
  return SD_MAPPABLE.has(sourceType);
}

function usage() {
  console.log(
    "Usage: npm run pipeline:import:manifest -- --manifest <path.json> [--account-id <id>] [--marketplace <marketplace>]"
  );
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isMappableSourceType(sourceType: DetectedSourceType): boolean {
  return isSpMapReportType(sourceType) || isSbMapReportType(sourceType) || isSdMapReportType(sourceType);
}

function buildNoMappingRequiredSummary(): MapSummary {
  return {
    status: "not_required",
    message: "No mapping step required for this source type.",
  };
}

function buildSkippedMapSummary(reason: "already_ingested" | "ingest_failed" | "missing_upload_id"): MapSummary {
  if (reason === "already_ingested") {
    return {
      status: "skipped",
      message:
        "Mapping skipped because ingest status was already ingested and this flow did not remap the existing upload.",
    };
  }
  if (reason === "missing_upload_id") {
    return {
      status: "skipped",
      message: "Mapping skipped because upload_id was not returned from ingest.",
    };
  }
  return {
    status: "skipped",
    message: "Mapping skipped because ingest failed.",
  };
}

async function persistItemStatus(params: {
  accountId: string;
  item: ItemSummary;
}) {
  const { accountId, item } = params;
  await upsertImportSourceStatus({
    account_id: accountId,
    source_type: item.source_type,
    last_attempted_at: item.run_at_iso,
    last_original_filename: item.original_filename,
    last_upload_id: item.ingest.upload_id ?? null,
    ingest_status: item.ingest.status,
    ingest_row_count: item.ingest.row_count ?? null,
    ingest_message: item.ingest.message ?? item.ingest.error ?? null,
    map_status: item.map.status,
    map_fact_rows: item.map.fact_rows ?? null,
    map_issue_rows: item.map.issue_rows ?? null,
    map_message: item.map.message ?? item.map.error ?? null,
  });
}

function readManifest(manifestPath: string): Manifest {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest file not found: ${manifestPath}`);
  }
  const raw = fs.readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as Manifest;
  return parsed;
}

function resolveFilename(item: ManifestItem): string {
  const fromManifest = (item.original_filename ?? "").trim();
  if (fromManifest) return fromManifest;
  return path.basename(item.path);
}

function resolveExportedAtIso(filePath: string): string | undefined {
  if (!filePath || !path.isAbsolute(filePath) || !fs.existsSync(filePath)) return undefined;
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return undefined;
  }
}

function normalizeRowCount(result: unknown): number | undefined {
  if (!result || typeof result !== "object") return undefined;
  const maybeRowCount = (result as { rowCount?: unknown }).rowCount;
  if (typeof maybeRowCount === "number") return maybeRowCount;

  const counts = (result as { counts?: unknown }).counts;
  if (!counts || typeof counts !== "object") return undefined;
  const values = Object.values(counts as Record<string, unknown>)
    .map((value) => (typeof value === "number" ? value : 0));
  if (!values.length) return undefined;
  return values.reduce((acc, value) => acc + value, 0);
}

function normalizeUploadId(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const uploadId = (result as { uploadId?: unknown }).uploadId;
  return typeof uploadId === "string" && uploadId.trim().length > 0 ? uploadId : undefined;
}

async function ingestBySourceType(params: {
  sourceType: DetectedSourceType;
  item: ManifestItem;
  accountId: string;
  marketplace: string;
}): Promise<{
  status: "ok" | "already ingested";
  uploadId?: string;
  rowCount?: number;
}> {
  const { sourceType, item, accountId, marketplace } = params;
  if (sourceType === "bulk") {
    const result = await ingestBulk(item.path, accountId, marketplace);
    return {
      status: result.status,
      uploadId: result.uploadId,
      rowCount: normalizeRowCount(result),
    };
  }

  if (sourceType === "sp_campaign") {
    const result = await ingestSpCampaignRaw(item.path, accountId);
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }
  if (sourceType === "sp_placement") {
    const result = await ingestSpPlacementRaw(item.path, accountId);
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }
  if (sourceType === "sp_targeting") {
    const result = await ingestSpTargetingRaw(item.path, accountId);
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }
  if (sourceType === "sp_stis") {
    const result = await ingestSpStisRaw(item.path, accountId);
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }
  if (sourceType === "sp_advertised_product") {
    const result = await ingestSpAdvertisedProductRaw(item.path, accountId);
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }

  if (sourceType === "sb_campaign") {
    const result = await ingestSbCampaignRaw(item.path, accountId);
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }
  if (sourceType === "sb_campaign_placement") {
    const result = await ingestSbCampaignPlacementRaw(item.path, accountId);
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }
  if (sourceType === "sb_keyword") {
    const result = await ingestSbKeywordRaw(item.path, accountId);
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }
  if (sourceType === "sb_stis") {
    const result = await ingestSbStisRaw(item.path, accountId);
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }
  if (sourceType === "sb_attributed_purchases") {
    const result = await ingestSbAttributedPurchasesRaw(item.path, accountId);
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }

  if (sourceType === "sd_campaign") {
    const result = await ingestSdCampaignRaw(item.path, accountId);
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }
  if (sourceType === "sd_advertised_product") {
    const result = await ingestSdAdvertisedProductRaw(item.path, accountId);
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }
  if (sourceType === "sd_targeting") {
    const result = await ingestSdTargetingRaw(item.path, accountId);
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }
  if (sourceType === "sd_matched_target") {
    const result = await ingestSdMatchedTargetRaw(item.path, accountId);
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }
  if (sourceType === "sd_purchased_product") {
    const result = await ingestSdPurchasedProductRaw(item.path, accountId);
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }

  if (sourceType === "si_sales_trend") {
    const exportedAtOverride = resolveExportedAtIso(item.path);
    const asinOverride = resolveSalesTrendAsinOverrideFromManifestItem(item);
    const result = await ingestScaleInsightsSalesTrendRaw(
      item.path,
      accountId,
      marketplace,
      exportedAtOverride,
      asinOverride
    );
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }

  if (sourceType === "h10_keyword_tracker") {
    const result = await ingestHelium10KeywordTrackerRaw(item.path, accountId, marketplace);
    return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
  }

  const result = await ingestSqpWeeklyRaw(item.path, accountId, marketplace);
  return { status: result.status, uploadId: result.uploadId, rowCount: normalizeRowCount(result) };
}

async function mapIfRequired(sourceType: DetectedSourceType, uploadId: string): Promise<MapSummary> {
  if (isSpMapReportType(sourceType)) {
    const result = await mapSpUpload(uploadId, sourceType);
    return {
      status: result.status,
      fact_rows: result.factRows,
      issue_rows: result.issueRows,
      message:
        result.status === "missing_snapshot"
          ? "No compatible bulk snapshot was found for this upload."
          : undefined,
    };
  }

  if (isSbMapReportType(sourceType)) {
    const result = await mapSbUpload(uploadId, sourceType);
    return {
      status: result.status,
      fact_rows: result.factRows,
      issue_rows: result.issueRows,
      message:
        result.status === "missing_snapshot"
          ? "No compatible bulk snapshot was found for this upload."
          : undefined,
    };
  }

  if (isSdMapReportType(sourceType)) {
    const result = await mapSdUpload(uploadId, sourceType);
    return {
      status: result.status,
      fact_rows: result.factRows,
      issue_rows: result.issueRows,
      message:
        result.status === "missing_snapshot"
          ? "No compatible bulk snapshot was found for this upload."
          : undefined,
    };
  }

  return buildNoMappingRequiredSummary();
}

async function processItem(params: {
  item: ManifestItem;
  accountId: string;
  marketplace: string;
  runAtIso: string;
}): Promise<ItemSummary> {
  const { item, accountId, marketplace, runAtIso } = params;
  const originalFilename = resolveFilename(item);
  const exportedAtIso = resolveExportedAtIso(item.path);
  const sourceType =
    detectSourceTypeFromFilename(originalFilename) ??
    detectSourceTypeFromFilename(path.basename(item.path));

  if (!item.path || !path.isAbsolute(item.path)) {
    const ingestMessage = `Manifest item path must be absolute: ${item.path}`;
    return {
      original_filename: originalFilename,
      source_type: sourceType ?? "unknown",
      exported_at_iso: exportedAtIso,
      run_at_iso: runAtIso,
      ingest: {
        status: "error",
        message: ingestMessage,
        error: ingestMessage,
      },
      map:
        sourceType && !isMappableSourceType(sourceType)
          ? buildNoMappingRequiredSummary()
          : buildSkippedMapSummary("ingest_failed"),
    };
  }

  if (!fs.existsSync(item.path)) {
    const ingestMessage = `File not found: ${item.path}`;
    return {
      original_filename: originalFilename,
      source_type: sourceType ?? "unknown",
      exported_at_iso: exportedAtIso,
      run_at_iso: runAtIso,
      ingest: {
        status: "error",
        message: ingestMessage,
        error: ingestMessage,
      },
      map:
        sourceType && !isMappableSourceType(sourceType)
          ? buildNoMappingRequiredSummary()
          : buildSkippedMapSummary("ingest_failed"),
    };
  }

  if (!sourceType) {
    const ingestMessage = `Could not detect source_type from filename: ${originalFilename}`;
    return {
      original_filename: originalFilename,
      source_type: "unknown",
      exported_at_iso: exportedAtIso,
      run_at_iso: runAtIso,
      ingest: {
        status: "error",
        message: ingestMessage,
        error: ingestMessage,
      },
      map: buildSkippedMapSummary("ingest_failed"),
    };
  }

  try {
    const ingestResult = await ingestBySourceType({
      sourceType,
      item,
      accountId,
      marketplace,
    });

    const ingestSummary: IngestSummary = {
      status: ingestResult.status,
      upload_id: ingestResult.uploadId,
      row_count: ingestResult.rowCount,
    };

    if (ingestResult.status !== "ok") {
      return {
        original_filename: originalFilename,
        source_type: sourceType,
        exported_at_iso: exportedAtIso,
        run_at_iso: runAtIso,
        ingest: ingestSummary,
        map: isMappableSourceType(sourceType)
          ? buildSkippedMapSummary("already_ingested")
          : buildNoMappingRequiredSummary(),
      };
    }

    const uploadId = ingestResult.uploadId ?? normalizeUploadId(ingestResult);
    if (!uploadId) {
      const ingestMessage = "Ingest succeeded but upload_id was not returned.";
      return {
        original_filename: originalFilename,
        source_type: sourceType,
        exported_at_iso: exportedAtIso,
        run_at_iso: runAtIso,
        ingest: {
          ...ingestSummary,
          status: "error",
          message: ingestMessage,
          error: ingestMessage,
        },
        map: isMappableSourceType(sourceType)
          ? buildSkippedMapSummary("missing_upload_id")
          : buildNoMappingRequiredSummary(),
      };
    }

    try {
      const mapSummary = await mapIfRequired(sourceType, uploadId);
      return {
        original_filename: originalFilename,
        source_type: sourceType,
        exported_at_iso: exportedAtIso,
        run_at_iso: runAtIso,
        ingest: ingestSummary,
        map: mapSummary,
      };
    } catch (error) {
      const message = asErrorMessage(error);
      return {
        original_filename: originalFilename,
        source_type: sourceType,
        exported_at_iso: exportedAtIso,
        run_at_iso: runAtIso,
        ingest: ingestSummary,
        map: {
          status: "error",
          message,
          error: message,
        },
      };
    }
  } catch (error) {
    const message = asErrorMessage(error);
    return {
      original_filename: originalFilename,
      source_type: sourceType,
      exported_at_iso: exportedAtIso,
      run_at_iso: runAtIso,
      ingest: {
        status: "error",
        message,
        error: message,
      },
      map: isMappableSourceType(sourceType)
        ? buildSkippedMapSummary("ingest_failed")
        : buildNoMappingRequiredSummary(),
    };
  }
}

async function main() {
  const manifestPath = getArg("--manifest");
  const accountIdArg = getArg("--account-id");
  const marketplaceArg = getArg("--marketplace");

  if (!manifestPath) {
    usage();
    process.exit(1);
  }

  const manifest = readManifest(manifestPath);
  const accountId = (accountIdArg ?? manifest.account_id ?? "").trim();
  const marketplace = (marketplaceArg ?? manifest.marketplace ?? "").trim();
  if (!accountId || !marketplace) {
    usage();
    throw new Error("Manifest/account args must include account_id and marketplace.");
  }
  rejectDeprecatedAccountId(accountId);

  const items = Array.isArray(manifest.items) ? manifest.items : [];
  const runAtIso = new Date().toISOString();
  const summaryItems: ItemSummary[] = [];
  for (const item of items) {
    const summaryItem = await processItem({ item, accountId, marketplace, runAtIso });
    await persistItemStatus({ accountId, item: summaryItem });
    summaryItems.push(summaryItem);
  }

  const summary: BatchSummary = { items: summaryItems };
  console.log(`IMPORT_BATCH_SUMMARY ${JSON.stringify(summary)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
