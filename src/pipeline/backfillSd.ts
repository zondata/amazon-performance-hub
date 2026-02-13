import fs from "node:fs";
import path from "node:path";
import { findBulkXlsx } from "../fs/reportLocator";
import { ingestBulk } from "../ingest/ingestBulk";
import { ingestSdCampaignRaw } from "../ingest/ingestSdCampaignRaw";
import { ingestSdAdvertisedProductRaw } from "../ingest/ingestSdAdvertisedProductRaw";
import { ingestSdTargetingRaw } from "../ingest/ingestSdTargetingRaw";
import { ingestSdMatchedTargetRaw } from "../ingest/ingestSdMatchedTargetRaw";
import { ingestSdPurchasedProductRaw } from "../ingest/ingestSdPurchasedProductRaw";
import { hashFileSha256 } from "../ingest/utils";
import { findUploadIdByFileHash, mapUpload } from "../mapping_sd/db";

export type DateFolder = {
  date: string;
  folderPath: string;
};

export type BackfillFolderSummary = {
  date: string;
  folderPath: string;
  ingests: Record<string, { status: string; uploadId?: string; rowCount?: number; error?: string }>;
  mappings: Record<string, { status: string; uploadId?: string; factRows?: number; issueRows?: number; error?: string }>;
};

export type BackfillOptions = {
  accountId: string;
  root: string;
  from: string;
  to: string;
  concurrency?: number;
  dryRun?: boolean;
  continueOnError?: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function listDateFolders(root: string): DateFolder[] {
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const folders: DateFolder[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!DATE_RE.test(entry.name)) continue;
    folders.push({ date: entry.name, folderPath: path.join(root, entry.name) });
  }
  folders.sort((a, b) => a.date.localeCompare(b.date));
  return folders;
}

export function selectDateFoldersInRange(folders: DateFolder[], from: string, to: string): DateFolder[] {
  return folders.filter((folder) => folder.date >= from && folder.date <= to);
}

function exportedAtDateFolder(dateFolder: string): string | null {
  const match = dateFolder.match(/(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  return `${match[1]}T00:00:00Z`;
}

function fileIfExists(folderPath: string, filename: string): string | null {
  const filePath = path.join(folderPath, filename);
  return fs.existsSync(filePath) ? filePath : null;
}

async function mapReportByFile(
  accountId: string,
  reportType:
    | "sd_campaign"
    | "sd_advertised_product"
    | "sd_targeting"
    | "sd_matched_target"
    | "sd_purchased_product",
  filePath: string
) {
  const fileHash = hashFileSha256(filePath);
  const uploadId = await findUploadIdByFileHash(accountId, fileHash);
  if (!uploadId) {
    return { status: "missing-upload" as const };
  }
  const result = await mapUpload(uploadId, reportType);
  return { status: result.status, uploadId, factRows: result.factRows, issueRows: result.issueRows };
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  handler: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let running = 0;

  return new Promise((resolve, reject) => {
    const launchNext = () => {
      if (nextIndex >= items.length && running === 0) {
        resolve(results);
        return;
      }
      while (running < limit && nextIndex < items.length) {
        const current = nextIndex++;
        running += 1;
        handler(items[current], current)
          .then((result) => {
            results[current] = result;
            running -= 1;
            launchNext();
          })
          .catch((err) => {
            reject(err);
          });
      }
    };
    launchNext();
  });
}

async function processFolder(folder: DateFolder, opts: BackfillOptions): Promise<BackfillFolderSummary> {
  const summary: BackfillFolderSummary = {
    date: folder.date,
    folderPath: folder.folderPath,
    ingests: {},
    mappings: {},
  };

  const bulkPath = (() => {
    try {
      return findBulkXlsx(folder.folderPath);
    } catch {
      return null;
    }
  })();

  const campaignPath = fileIfExists(folder.folderPath, "Sponsored_Display_Campaign_report.xlsx");
  const advertisedPath = fileIfExists(folder.folderPath, "Sponsored_Display_Advertised_product_report.xlsx");
  const targetingPath = fileIfExists(folder.folderPath, "Sponsored_Display_Targeting_report.xlsx");
  const matchedPath = fileIfExists(folder.folderPath, "Sponsored_Display_Matched_target_report.xlsx");
  const purchasedPath = fileIfExists(folder.folderPath, "Sponsored_Display_Purchased_product_report.xlsx");

  if (opts.dryRun) {
    summary.ingests.bulk = { status: bulkPath ? "would-run" : "missing" };
    summary.ingests.sd_campaign = { status: campaignPath ? "would-run" : "missing" };
    summary.ingests.sd_advertised_product = { status: advertisedPath ? "would-run" : "missing" };
    summary.ingests.sd_targeting = { status: targetingPath ? "would-run" : "missing" };
    summary.ingests.sd_matched_target = { status: matchedPath ? "would-run" : "missing" };
    summary.ingests.sd_purchased_product = { status: purchasedPath ? "would-run" : "missing" };

    summary.mappings.sd_campaign = { status: campaignPath ? "would-run" : "missing" };
    summary.mappings.sd_advertised_product = { status: advertisedPath ? "would-run" : "missing" };
    summary.mappings.sd_targeting = { status: targetingPath ? "would-run" : "missing" };
    summary.mappings.sd_matched_target = { status: matchedPath ? "would-run" : "missing" };
    summary.mappings.sd_purchased_product = { status: purchasedPath ? "would-run" : "missing" };
    return summary;
  }

  if (bulkPath) {
    const result = await ingestBulk(bulkPath, opts.accountId);
    summary.ingests.bulk = {
      status: result.status,
      uploadId: result.uploadId,
      rowCount: result.counts?.campaigns,
    };
  } else {
    summary.ingests.bulk = { status: "missing" };
  }

  const exportedAt = exportedAtDateFolder(folder.folderPath) ?? undefined;

  if (campaignPath) {
    const result = await ingestSdCampaignRaw(campaignPath, opts.accountId, exportedAt);
    summary.ingests.sd_campaign = {
      status: result.status,
      uploadId: result.uploadId,
      rowCount: result.rowCount,
    };
  } else {
    summary.ingests.sd_campaign = { status: "missing" };
  }

  if (advertisedPath) {
    const result = await ingestSdAdvertisedProductRaw(advertisedPath, opts.accountId, exportedAt);
    summary.ingests.sd_advertised_product = {
      status: result.status,
      uploadId: result.uploadId,
      rowCount: result.rowCount,
    };
  } else {
    summary.ingests.sd_advertised_product = { status: "missing" };
  }

  if (targetingPath) {
    const result = await ingestSdTargetingRaw(targetingPath, opts.accountId, exportedAt);
    summary.ingests.sd_targeting = {
      status: result.status,
      uploadId: result.uploadId,
      rowCount: result.rowCount,
    };
  } else {
    summary.ingests.sd_targeting = { status: "missing" };
  }

  if (matchedPath) {
    const result = await ingestSdMatchedTargetRaw(matchedPath, opts.accountId, exportedAt);
    summary.ingests.sd_matched_target = {
      status: result.status,
      uploadId: result.uploadId,
      rowCount: result.rowCount,
    };
  } else {
    summary.ingests.sd_matched_target = { status: "missing" };
  }

  if (purchasedPath) {
    const result = await ingestSdPurchasedProductRaw(purchasedPath, opts.accountId, exportedAt);
    summary.ingests.sd_purchased_product = {
      status: result.status,
      uploadId: result.uploadId,
      rowCount: result.rowCount,
    };
  } else {
    summary.ingests.sd_purchased_product = { status: "missing" };
  }

  if (campaignPath) {
    summary.mappings.sd_campaign = await mapReportByFile(opts.accountId, "sd_campaign", campaignPath);
  } else {
    summary.mappings.sd_campaign = { status: "missing" };
  }

  if (advertisedPath) {
    summary.mappings.sd_advertised_product = await mapReportByFile(
      opts.accountId,
      "sd_advertised_product",
      advertisedPath
    );
  } else {
    summary.mappings.sd_advertised_product = { status: "missing" };
  }

  if (targetingPath) {
    summary.mappings.sd_targeting = await mapReportByFile(opts.accountId, "sd_targeting", targetingPath);
  } else {
    summary.mappings.sd_targeting = { status: "missing" };
  }

  if (matchedPath) {
    summary.mappings.sd_matched_target = await mapReportByFile(
      opts.accountId,
      "sd_matched_target",
      matchedPath
    );
  } else {
    summary.mappings.sd_matched_target = { status: "missing" };
  }

  if (purchasedPath) {
    summary.mappings.sd_purchased_product = await mapReportByFile(
      opts.accountId,
      "sd_purchased_product",
      purchasedPath
    );
  } else {
    summary.mappings.sd_purchased_product = { status: "missing" };
  }

  return summary;
}

export async function backfillSd(options: BackfillOptions): Promise<BackfillFolderSummary[]> {
  const folders = selectDateFoldersInRange(listDateFolders(options.root), options.from, options.to);
  const concurrency = Math.max(1, options.concurrency ?? 1);

  if (concurrency === 1) {
    const results: BackfillFolderSummary[] = [];
    for (const folder of folders) {
      try {
        const result = await processFolder(folder, options);
        results.push(result);
      } catch (err) {
        if (!options.continueOnError) throw err;
        results.push({
          date: folder.date,
          folderPath: folder.folderPath,
          ingests: { error: { status: "error", error: (err as Error).message } },
          mappings: {},
        });
      }
    }
    return results;
  }

  return runWithConcurrency(folders, concurrency, async (folder) => {
    try {
      return await processFolder(folder, options);
    } catch (err) {
      if (!options.continueOnError) throw err;
      return {
        date: folder.date,
        folderPath: folder.folderPath,
        ingests: { error: { status: "error", error: (err as Error).message } },
        mappings: {},
      };
    }
  });
}
