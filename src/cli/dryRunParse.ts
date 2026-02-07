import path from "node:path";
import * as XLSX from "xlsx";

function main(): void {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error("usage: npm run dryrun -- <path-to-xlsx>");
    process.exitCode = 1;
    return;
  }

  try {
    const resolvedPath = path.resolve(process.cwd(), inputPath);
    const workbook = XLSX.readFile(resolvedPath, { dense: true });
    const sheetNames = workbook.SheetNames;

    console.log(`Workbook: ${resolvedPath}`);
    console.log(`Sheet names (${sheetNames.length}): ${sheetNames.join(", ")}`);

    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const headerRow = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
        header: 1,
        raw: false,
        blankrows: false
      })[0] ?? [];
      const headers = headerRow.slice(0, 30).map((value) => String(value ?? "").trim());
      console.log(`- ${sheetName}: ${headers.join(" | ")}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`dryrun failed: ${message}`);
    process.exitCode = 1;
  }
}

main();
