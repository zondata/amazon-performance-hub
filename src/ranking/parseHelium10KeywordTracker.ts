import fs from "node:fs";
import { normText } from "../bulk/parseSponsoredProductsBulk";
import { normalizeHeader, parseIntSafe } from "../ads/sdReportUtils";

export type RankKind = "exact" | "gte" | "missing";

export type Helium10KeywordTrackerRow = {
  marketplace_domain_raw: string | null;
  asin: string;
  title: string | null;
  keyword_raw: string;
  keyword_norm: string;
  keyword_sales: number | null;
  search_volume: number | null;
  organic_rank_raw: string | null;
  organic_rank_value: number | null;
  organic_rank_kind: RankKind;
  sponsored_pos_raw: string | null;
  sponsored_pos_value: number | null;
  sponsored_pos_kind: RankKind;
  observed_at: string;
  observed_date: string;
};

export type Helium10KeywordTrackerParseResult = {
  rows: Helium10KeywordTrackerRow[];
  coverageStart: string | null;
  coverageEnd: string | null;
  asin: string;
  marketplace_domain_raw: string | null;
};

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (char === '"') {
      const next = content[i + 1];
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      current.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && content[i + 1] === "\n") i += 1;
      current.push(field);
      field = "";
      if (current.length > 1 || current[0]?.trim()) rows.push(current);
      current = [];
      continue;
    }

    field += char;
  }

  if (field.length || current.length) {
    current.push(field);
    if (current.length > 1 || current[0]?.trim()) rows.push(current);
  }

  return rows;
}

function toTimestampString(parts: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}): string {
  const year = String(parts.year).padStart(4, "0");
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  const hour = String(parts.hour ?? 0).padStart(2, "0");
  const minute = String(parts.minute ?? 0).padStart(2, "0");
  const second = String(parts.second ?? 0).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function parseObservedAt(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw === "-") return null;

  const isoLike = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?(?:\.\d+)?(?:\s*(Z|[+-]\d{2}:?\d{2}))?$/i
  );
  if (isoLike) {
    const hasTz = Boolean(isoLike[7]);
    if (hasTz) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return toTimestampString({
          year: parsed.getUTCFullYear(),
          month: parsed.getUTCMonth() + 1,
          day: parsed.getUTCDate(),
          hour: parsed.getUTCHours(),
          minute: parsed.getUTCMinutes(),
          second: parsed.getUTCSeconds(),
        });
      }
    }

    return toTimestampString({
      year: Number.parseInt(isoLike[1], 10),
      month: Number.parseInt(isoLike[2], 10),
      day: Number.parseInt(isoLike[3], 10),
      hour: isoLike[4] ? Number.parseInt(isoLike[4], 10) : 0,
      minute: isoLike[5] ? Number.parseInt(isoLike[5], 10) : 0,
      second: isoLike[6] ? Number.parseInt(isoLike[6], 10) : 0,
    });
  }

  const slash = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i
  );
  if (slash) {
    let hour = slash[4] ? Number.parseInt(slash[4], 10) : 0;
    const minute = slash[5] ? Number.parseInt(slash[5], 10) : 0;
    const second = slash[6] ? Number.parseInt(slash[6], 10) : 0;
    const meridiem = (slash[7] ?? "").toUpperCase();

    if (meridiem === "AM" && hour === 12) hour = 0;
    if (meridiem === "PM" && hour < 12) hour += 12;

    return toTimestampString({
      year: Number.parseInt(slash[3], 10),
      month: Number.parseInt(slash[1], 10),
      day: Number.parseInt(slash[2], 10),
      hour,
      minute,
      second,
    });
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return toTimestampString({
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
    hour: parsed.getUTCHours(),
    minute: parsed.getUTCMinutes(),
    second: parsed.getUTCSeconds(),
  });
}

function parseNullableInt(value: string): number | null {
  const raw = value.trim();
  if (!raw || raw === "-") return null;
  return parseIntSafe(raw);
}

function parseRankField(value: string): { raw: string | null; kind: RankKind; parsedValue: number | null } {
  const raw = value.trim();
  if (!raw || raw === "-") {
    return { raw: raw || null, kind: "missing", parsedValue: null };
  }

  const gte = raw.match(/^>\s*([0-9,]+)$/);
  if (gte) {
    const parsed = parseIntSafe(gte[1]);
    return {
      raw,
      kind: "gte",
      parsedValue: parsed,
    };
  }

  const exact = raw.match(/^([0-9,]+)$/);
  if (exact) {
    return {
      raw,
      kind: "exact",
      parsedValue: parseIntSafe(exact[1]),
    };
  }

  return { raw, kind: "missing", parsedValue: null };
}

function mapHeaders(headers: string[]): Record<string, number> {
  const normalized = headers.map((h) => normalizeHeader(h));
  const out: Record<string, number> = {};
  for (let i = 0; i < normalized.length; i += 1) {
    out[normalized[i]] = i;
  }
  return out;
}

function getCell(row: string[], headers: Record<string, number>, name: string): string {
  const index = headers[name];
  if (index === undefined) return "";
  return String(row[index] ?? "");
}

export function parseHelium10KeywordTracker(input: string): Helium10KeywordTrackerParseResult {
  const content = fs.existsSync(input) ? fs.readFileSync(input, "utf8") : input;
  const csvRows = parseCsv(content);
  if (!csvRows.length) {
    throw new Error("Helium10 Keyword Tracker CSV is empty.");
  }

  const headers = mapHeaders(csvRows[0] ?? []);
  const rows: Helium10KeywordTrackerRow[] = [];
  const asinSet = new Set<string>();
  let coverageStart: string | null = null;
  let coverageEnd: string | null = null;
  let marketplaceDomainRaw: string | null = null;

  for (let i = 1; i < csvRows.length; i += 1) {
    const row = csvRows[i] ?? [];

    const keywordRaw = getCell(row, headers, "keyword").trim();
    if (!keywordRaw) continue;

    const asinRaw = getCell(row, headers, "asin").trim().toUpperCase();
    if (!asinRaw) continue;
    asinSet.add(asinRaw);

    const observedAt = parseObservedAt(getCell(row, headers, "date added"));
    if (!observedAt) continue;
    const observedDate = observedAt.slice(0, 10);

    const domainRaw = getCell(row, headers, "marketplace").trim();
    if (!marketplaceDomainRaw && domainRaw) {
      marketplaceDomainRaw = domainRaw;
    }

    const organic = parseRankField(getCell(row, headers, "organic rank"));
    const sponsored = parseRankField(getCell(row, headers, "sponsored position"));

    const parsedRow: Helium10KeywordTrackerRow = {
      marketplace_domain_raw: domainRaw || null,
      asin: asinRaw,
      title: getCell(row, headers, "title").trim() || null,
      keyword_raw: keywordRaw,
      keyword_norm: normText(keywordRaw),
      keyword_sales: parseNullableInt(getCell(row, headers, "keyword sales")),
      search_volume: parseNullableInt(getCell(row, headers, "search volume")),
      organic_rank_raw: organic.raw,
      organic_rank_value: organic.parsedValue,
      organic_rank_kind: organic.kind,
      sponsored_pos_raw: sponsored.raw,
      sponsored_pos_value: sponsored.parsedValue,
      sponsored_pos_kind: sponsored.kind,
      observed_at: observedAt,
      observed_date: observedDate,
    };

    rows.push(parsedRow);

    if (!coverageStart || observedDate < coverageStart) coverageStart = observedDate;
    if (!coverageEnd || observedDate > coverageEnd) coverageEnd = observedDate;
  }

  if (asinSet.size > 1) {
    throw new Error(
      `Helium10 Keyword Tracker CSV contains multiple ASINs (${Array.from(asinSet).join(", ")}). Split by ASIN and ingest one file per ASIN.`
    );
  }

  const asin = Array.from(asinSet)[0];
  if (!asin) {
    throw new Error("No ASIN found in Helium10 Keyword Tracker CSV rows.");
  }

  return {
    rows,
    coverageStart,
    coverageEnd,
    asin,
    marketplace_domain_raw: marketplaceDomainRaw,
  };
}
