import fs from "node:fs";
import path from "node:path";
import { SpCreateManifest } from "./manifest";
import { reconcileWithSnapshot, ReconcileResult } from "./reconcile";

type PendingDirs = {
  baseDir: string;
  pendingDir: string;
  reconciledDir: string;
  failedDir: string;
};

export function resolvePendingDirs(pendingDir: string): PendingDirs {
  const pendingPath = path.resolve(pendingDir);
  const candidate = path.join(pendingPath, "_PENDING_RECONCILE");
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    return {
      baseDir: pendingPath,
      pendingDir: candidate,
      reconciledDir: path.join(pendingPath, "_RECONCILED"),
      failedDir: path.join(pendingPath, "_FAILED"),
    };
  }
  const base = path.dirname(pendingPath);
  return {
    baseDir: base,
    pendingDir: pendingPath,
    reconciledDir: path.join(base, "_RECONCILED"),
    failedDir: path.join(base, "_FAILED"),
  };
}

function ensureDir(dir: string, dryRun: boolean) {
  if (dryRun) return;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith(".json"))
    .sort();
}

function writeJson(filePath: string, data: unknown, dryRun: boolean) {
  if (dryRun) return;
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function moveFile(src: string, dest: string, dryRun: boolean) {
  if (dryRun) return;
  if (fs.existsSync(dest)) {
    fs.unlinkSync(dest);
  }
  fs.renameSync(src, dest);
}

function basenameWithoutExt(filePath: string): string {
  const base = path.basename(filePath);
  return base.replace(/\.[^.]+$/, "");
}

function countExpected(manifest: SpCreateManifest): number {
  return (
    manifest.campaigns.length +
    manifest.ad_groups.length +
    manifest.product_ads.length +
    manifest.keywords.length
  );
}

export async function processPendingManifests(params: {
  accountId: string;
  snapshotDate: string;
  pendingDir: string;
  dryRun: boolean;
  maxManifests?: number;
  verbose?: boolean;
}): Promise<{
  reconciled: number;
  pending: number;
  failed: number;
  processed: number;
}> {
  const dirs = resolvePendingDirs(params.pendingDir);
  ensureDir(dirs.reconciledDir, params.dryRun);
  ensureDir(dirs.failedDir, params.dryRun);

  const files = listJsonFiles(dirs.pendingDir);
  const limited = params.maxManifests ? files.slice(0, params.maxManifests) : files;

  let reconciled = 0;
  let pending = 0;
  let failed = 0;

  for (const fileName of limited) {
    const fullPath = path.join(dirs.pendingDir, fileName);
    let manifest: SpCreateManifest;
    try {
      const raw = fs.readFileSync(fullPath, "utf-8");
      manifest = JSON.parse(raw) as SpCreateManifest;
      if (!manifest.run_id || !manifest.generator) {
        throw new Error("Manifest missing required fields: run_id and generator.");
      }
    } catch (err) {
      failed += 1;
      const failData = {
        error: (err as Error).message,
        stack: (err as Error).stack ?? null,
      };
      const base = basenameWithoutExt(fullPath);
      const failPath = path.join(dirs.failedDir, `${base}.fail.json`);
      writeJson(failPath, failData, params.dryRun);
      moveFile(fullPath, path.join(dirs.failedDir, fileName), params.dryRun);
      console.log(`FAILED ${fileName}`);
      continue;
    }

    let result: ReconcileResult;
    try {
      result = await reconcileWithSnapshot({
        accountId: params.accountId,
        snapshotDate: params.snapshotDate,
        manifest,
      });
    } catch (err) {
      failed += 1;
      const failData = {
        error: (err as Error).message,
        stack: (err as Error).stack ?? null,
      };
      const base = basenameWithoutExt(fullPath);
      const failPath = path.join(dirs.failedDir, `${base}.fail.json`);
      writeJson(failPath, failData, params.dryRun);
      moveFile(fullPath, path.join(dirs.failedDir, fileName), params.dryRun);
      console.log(`FAILED ${fileName}`);
      continue;
    }

    if (result.all_matched) {
      reconciled += 1;
      const reconcilePayload = {
        run_id: result.run_id,
        account_id: params.accountId,
        snapshot_date: params.snapshotDate,
        matched_at: result.matched_at,
        matches: result,
      };
      const base = basenameWithoutExt(fullPath);
      const resultPath = path.join(dirs.reconciledDir, `${base}.reconcile_result.json`);
      writeJson(resultPath, reconcilePayload, params.dryRun);
      moveFile(fullPath, path.join(dirs.reconciledDir, fileName), params.dryRun);
      console.log(`RECONCILED ${fileName}`);
      continue;
    }

    pending += 1;
    const expected = countExpected(manifest);
    const matched = result.counts.matched;
    const suffix = params.verbose ? ` (${matched}/${expected})` : "";
    console.log(`PENDING ${fileName}${suffix}`);
  }

  return {
    reconciled,
    pending,
    failed,
    processed: limited.length,
  };
}
