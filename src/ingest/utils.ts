import fs from "node:fs";
import crypto from "node:crypto";

export function hashFileSha256(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error("chunk size must be > 0");
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function addDaysUtc(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const next = new Date(utc + days * 24 * 60 * 60 * 1000);
  const year = next.getUTCFullYear();
  const month = String(next.getUTCMonth() + 1).padStart(2, "0");
  const day = String(next.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
