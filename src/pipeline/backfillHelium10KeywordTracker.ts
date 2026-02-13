import fs from "node:fs";
import path from "node:path";
import { ingestHelium10KeywordTrackerDateFolder } from "../cli/ingestHelium10KeywordTrackerDate";
import { getHelium10KeywordTrackerCsvFiles } from "../fs/reportLocator";

export type DateFolder = {
  date: string;
  folderPath: string;
};

export type BackfillH10KeywordTrackerOptions = {
  accountId: string;
  marketplace: string;
  root: string;
  from: string;
  to: string;
  dryRun?: boolean;
  continueOnError?: boolean;
};

export type BackfillH10KeywordTrackerFileSummary = {
  filePath: string;
  status: string;
  uploadId?: string;
  rowCount?: number;
  error?: string;
};

export type BackfillH10KeywordTrackerFolderSummary = {
  date: string;
  folderPath: string;
  files: BackfillH10KeywordTrackerFileSummary[];
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

export async function backfillHelium10KeywordTracker(
  options: BackfillH10KeywordTrackerOptions
): Promise<BackfillH10KeywordTrackerFolderSummary[]> {
  const folders = selectDateFoldersInRange(listDateFolders(options.root), options.from, options.to);
  const results: BackfillH10KeywordTrackerFolderSummary[] = [];

  for (const folder of folders) {
    try {
      if (options.dryRun) {
        let files: string[] = [];
        try {
          files = getHelium10KeywordTrackerCsvFiles(folder.folderPath);
        } catch {
          files = [];
        }
        results.push({
          date: folder.date,
          folderPath: folder.folderPath,
          files: files.map((filePath) => ({ filePath, status: "would-run" })),
        });
        continue;
      }

      const ingestResults = await ingestHelium10KeywordTrackerDateFolder(
        options.accountId,
        options.marketplace,
        folder.folderPath
      );

      results.push({
        date: folder.date,
        folderPath: folder.folderPath,
        files: ingestResults.map((item) => ({
          filePath: item.csvPath,
          status: item.status,
          uploadId: item.uploadId,
          rowCount: item.rowCount,
        })),
      });
    } catch (err) {
      if (!options.continueOnError) throw err;
      results.push({
        date: folder.date,
        folderPath: folder.folderPath,
        files: [
          {
            filePath: folder.folderPath,
            status: "error",
            error: (err as Error).message,
          },
        ],
      });
    }
  }

  return results;
}
