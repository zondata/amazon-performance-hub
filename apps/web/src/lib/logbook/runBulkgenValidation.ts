import "server-only";

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const hasScript = (dir: string, scriptName: string): boolean => {
  const packageJsonPath = path.join(dir, "package.json");
  if (!fs.existsSync(packageJsonPath)) return false;

  try {
    const packageRaw = fs.readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageRaw) as {
      scripts?: Record<string, unknown>;
    };
    return typeof packageJson.scripts?.[scriptName] === "string";
  } catch {
    return false;
  }
};

export const resolveRepoRoot = (startDir = process.cwd()): string => {
  let current = path.resolve(startDir);
  while (true) {
    if (hasScript(current, "log:validate:bulkgen")) return current;

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(startDir);
};

export const runManualBulkgenValidation = async (changeId: string): Promise<void> => {
  const { env } = await import("../env");
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
