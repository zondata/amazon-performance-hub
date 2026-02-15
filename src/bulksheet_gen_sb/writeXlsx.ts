import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { UploadRow } from "./buildUploadRows";

export const REVIEW_HELPER_COLUMNS = [
  "action_type",
  "notes",
  "current_value",
  "new_value",
  "delta",
];

export type TemplateSheet = {
  name: string;
  headers: string[];
};

function readTemplateSheet(templatePath: string, sheetName: string): TemplateSheet {
  const workbook = XLSX.readFile(templatePath, { dense: true });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Template sheet missing: ${sheetName}`);
  }
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  const headerRow = rows[0] ?? [];
  const headers = headerRow.map((cell) => String(cell ?? "").trim());
  if (!headers.length || headers.every((h) => !h)) {
    throw new Error(`Template sheet ${sheetName} has no header row.`);
  }
  return { name: sheetName, headers };
}

function ensureRequiredHeaders(headers: string[], required: string[], sheetName: string) {
  const missing = required.filter((col) => !headers.includes(col));
  if (missing.length) {
    throw new Error(
      `Template sheet ${sheetName} missing required columns: ${missing.join(", ")}`
    );
  }
}

function ensureNoHeaderCollisions(headers: string[], extra: string[], sheetName: string) {
  const collisions = extra.filter((col) => headers.includes(col));
  if (collisions.length) {
    throw new Error(
      `Template sheet ${sheetName} already contains helper columns: ${collisions.join(", ")}`
    );
  }
}

function buildRowArray(
  headers: string[],
  cells: Record<string, string | number | boolean | null>
): (string | number | boolean)[] {
  return headers.map((header) => {
    const value = cells[header];
    if (value === null || value === undefined) return "";
    return value;
  });
}

function groupRows(rows: UploadRow[]): Map<string, UploadRow[]> {
  const grouped = new Map<string, UploadRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.sheetName) ?? [];
    list.push(row);
    grouped.set(row.sheetName, list);
  }
  return grouped;
}

export function writeSbBulkUpdateXlsx(params: {
  templatePath: string;
  outDir: string;
  rows: UploadRow[];
  requiredHeadersBySheet: Map<string, string[]>;
}): { uploadPath: string; reviewPath: string } {
  const { templatePath, outDir, rows, requiredHeadersBySheet } = params;

  const grouped = groupRows(rows);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const uploadWorkbook = XLSX.utils.book_new();
  const reviewWorkbook = XLSX.utils.book_new();

  for (const [sheetName, sheetRows] of grouped) {
    const templateSheet = readTemplateSheet(templatePath, sheetName);
    const requiredHeaders = requiredHeadersBySheet.get(sheetName) ?? [];
    ensureRequiredHeaders(templateSheet.headers, requiredHeaders, sheetName);
    ensureNoHeaderCollisions(templateSheet.headers, REVIEW_HELPER_COLUMNS, sheetName);

    const uploadRows: (string | number | boolean)[][] = [
      templateSheet.headers as (string | number | boolean)[],
    ];
    const reviewHeaders = [...templateSheet.headers, ...REVIEW_HELPER_COLUMNS];
    const reviewRows: (string | number | boolean)[][] = [
      reviewHeaders as (string | number | boolean)[],
    ];

    for (const row of sheetRows) {
      uploadRows.push(buildRowArray(templateSheet.headers, row.cells));
      const reviewRow = buildRowArray(templateSheet.headers, row.cells);
      for (const helper of REVIEW_HELPER_COLUMNS) {
        const value = row.review[helper];
        reviewRow.push(value === null || value === undefined ? "" : value);
      }
      reviewRows.push(reviewRow);
    }

    const uploadSheet = XLSX.utils.aoa_to_sheet(uploadRows);
    const reviewSheet = XLSX.utils.aoa_to_sheet(reviewRows);
    XLSX.utils.book_append_sheet(uploadWorkbook, uploadSheet, sheetName);
    XLSX.utils.book_append_sheet(reviewWorkbook, reviewSheet, sheetName);
  }

  const uploadPath = path.join(outDir, "upload_strict.xlsx");
  const reviewPath = path.join(outDir, "review.xlsx");
  XLSX.writeFile(uploadWorkbook, uploadPath);
  XLSX.writeFile(reviewWorkbook, reviewPath);

  return { uploadPath, reviewPath };
}
