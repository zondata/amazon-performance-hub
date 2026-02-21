import "server-only";

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { env } from "@/lib/env";

const isRepoRoot = (dir: string) =>
  fs.existsSync(path.join(dir, "package.json")) && fs.existsSync(path.join(dir, "src"));

const resolveRepoRoot = () => {
  const cwd = process.cwd();
  const candidates = [
    cwd,
    path.resolve(cwd, ".."),
    path.resolve(cwd, "..", ".."),
    path.resolve(cwd, "..", "..", ".."),
    "/home/albert/code/amazon-performance-hub",
  ];
  for (const candidate of candidates) {
    if (isRepoRoot(candidate)) return candidate;
  }
  return cwd;
};

export const runManualBulkgenValidation = async (changeId: string): Promise<void> => {
  const args = [
    "run",
    "log:validate:bulkgen",
    "--",
    "--account-id",
    env.accountId,
    "--mode",
    "manual",
    "--change-id",
    changeId,
    "--limit",
    "1",
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", args, {
      cwd: resolveRepoRoot(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || "Validation command failed."));
        return;
      }
      resolve();
    });
  });
};
