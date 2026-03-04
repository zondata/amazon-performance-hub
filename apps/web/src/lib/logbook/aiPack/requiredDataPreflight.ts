type JsonRecord = Record<string, unknown>;

export type PreflightStatus = "PASS" | "FAIL";

export type PreflightItem = {
  name: string;
  required: boolean;
  status: PreflightStatus;
  source: string;
  details: string;
  remediation: string;
};

export type PreflightReport = {
  overall_ok: boolean;
  analysis_type: string;
  items: PreflightItem[];
  actions: string[];
};

export type PreflightArtifactInput = {
  filename: string | null;
  text: string | null;
  sizeBytes: number;
  readError: string | null;
};

export type RequiredDataPreflightContext = {
  analysisType: "experiment_evaluation";
  analysisOutputPack: PreflightArtifactInput;
  baselinePack: PreflightArtifactInput;
  stisSeparateUpload: PreflightArtifactInput;
  stirSeparateUpload: PreflightArtifactInput;
};

type MetricPresenceCheck = {
  present: boolean;
  details: string;
};

export type RequiredDataPreflightResult = {
  report: PreflightReport;
  parsedAnalysisOutputPack: JsonRecord | null;
  parsedBaselinePack: JsonRecord | null;
};

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
};

const asArray = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) return [];
  return value;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseJsonArtifact = (artifact: PreflightArtifactInput): {
  ok: boolean;
  parsed: JsonRecord | null;
  details: string;
} => {
  if (artifact.readError) {
    return { ok: false, parsed: null, details: artifact.readError };
  }
  if (!artifact.text || artifact.text.trim().length === 0) {
    return { ok: false, parsed: null, details: "file is empty" };
  }
  try {
    const parsedUnknown = JSON.parse(artifact.text);
    const parsed = asRecord(parsedUnknown);
    if (!parsed) {
      return { ok: false, parsed: null, details: "JSON root must be an object" };
    }
    return { ok: true, parsed, details: "valid JSON object" };
  } catch {
    return { ok: false, parsed: null, details: "invalid JSON" };
  }
};

const parseRowsFromText = (text: string): { rows: JsonRecord[]; parseError: string | null } => {
  const trimmed = text.trim();
  if (!trimmed) return { rows: [], parseError: "empty file" };

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) return { rows: [], parseError: "JSON must be an array" };
      const rows = parsed.map((entry) => asRecord(entry)).filter((entry): entry is JsonRecord => entry !== null);
      return { rows, parseError: rows.length > 0 ? null : "array has no object rows" };
    } catch {
      return { rows: [], parseError: "invalid JSON array" };
    }
  }

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length === 0) return { rows: [], parseError: "empty file" };
  const rows: JsonRecord[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const row = asRecord(parsed);
      if (row) rows.push(row);
    } catch {
      return { rows: [], parseError: "invalid NDJSON line" };
    }
  }
  return { rows, parseError: rows.length > 0 ? null : "no object rows" };
};

const detectMetricRowsInPack = (pack: JsonRecord | null, metric: "stis" | "stir"): MetricPresenceCheck => {
  if (!pack) return { present: false, details: "baseline pack not provided" };

  const metricField = metric === "stis" ? "search_term_impression_share" : "search_term_impression_rank";
  const adsBaseline = asRecord(pack.ads_baseline);
  const sp = asRecord(adsBaseline?.sp);
  const metricObject = asRecord(sp?.[metric]);
  const rows = asArray(metricObject?.rows).map((entry) => asRecord(entry)).filter((entry): entry is JsonRecord => entry !== null);
  const metricRows = rows.filter((row) => asNumber(row[metricField]) !== null);
  if (metricRows.length > 0) {
    return { present: true, details: `${metricRows.length} row(s) found in ads_baseline.sp.${metric}.rows` };
  }

  const metadata = asRecord(pack.metadata);
  const stisStirMeta = asRecord(metadata?.stis_stir);
  const metricMeta = asRecord(stisStirMeta?.[metric]);
  const includedInPack = metricMeta?.included_in_pack === true;
  const inPackRowCount = asNumber(metricMeta?.in_pack_row_count) ?? 0;
  if (includedInPack && inPackRowCount > 0) {
    return {
      present: true,
      details: `metadata marks included_in_pack with ${inPackRowCount} rows`,
    };
  }

  return { present: false, details: "no in-pack metric rows detected" };
};

const detectMetricRowsInSeparateUpload = (
  artifact: PreflightArtifactInput,
  metric: "stis" | "stir"
): MetricPresenceCheck => {
  if (artifact.readError) {
    return { present: false, details: artifact.readError };
  }
  if (!artifact.text || artifact.text.trim().length === 0) {
    return { present: false, details: "separate upload not provided" };
  }
  const parsed = parseRowsFromText(artifact.text);
  if (parsed.parseError) {
    return { present: false, details: parsed.parseError };
  }

  const metricField = metric === "stis" ? "search_term_impression_share" : "search_term_impression_rank";
  const metricRows = parsed.rows.filter((row) => asNumber(row[metricField]) !== null);
  if (metricRows.length === 0) {
    return { present: false, details: `no rows with ${metricField}` };
  }
  return { present: true, details: `${metricRows.length} row(s) parseable from separate upload` };
};

const isBaselinePackKind = (pack: JsonRecord | null): boolean => {
  const kind = asString(pack?.kind);
  return Boolean(kind && kind.includes("product_baseline_data_pack"));
};

const collectActions = (items: PreflightItem[]): string[] => {
  const actions: string[] = [];
  for (const item of items) {
    if (item.required && item.status === "FAIL") {
      if (!actions.includes(item.remediation)) actions.push(item.remediation);
    }
  }
  return actions;
};

export const renderRequiredDataAvailability = (report: PreflightReport): string => {
  const lines: string[] = ["Required data availability"];
  for (const item of report.items) {
    lines.push(`- ${item.status}: ${item.name}: ${item.details} [source: ${item.source}]`);
  }
  if (!report.overall_ok) {
    lines.push("");
    lines.push("Action required:");
    for (const action of report.actions) lines.push(`- ${action}`);
  }
  return lines.join("\n");
};

export const runRequiredDataPreflight = (
  context: RequiredDataPreflightContext
): RequiredDataPreflightResult => {
  const outputPackParsed = parseJsonArtifact(context.analysisOutputPack);
  const baselinePackParsed = parseJsonArtifact(context.baselinePack);

  const outputPackItem: PreflightItem = {
    name: "Analysis output pack",
    required: true,
    status: outputPackParsed.ok ? "PASS" : "FAIL",
    source: context.analysisOutputPack.filename ? "uploaded file" : "missing",
    details: outputPackParsed.ok
      ? `present (${context.analysisOutputPack.filename ?? "output pack"})`
      : `missing or invalid (${outputPackParsed.details})`,
    remediation: "Regenerate the analysis output pack JSON and upload it.",
  };

  const baselinePackItem: PreflightItem = {
    name: "Baseline data pack",
    required: true,
    status:
      baselinePackParsed.ok && isBaselinePackKind(baselinePackParsed.parsed) ? "PASS" : "FAIL",
    source: context.baselinePack.filename ? "uploaded file" : "missing",
    details:
      baselinePackParsed.ok && isBaselinePackKind(baselinePackParsed.parsed)
        ? `present (${context.baselinePack.filename ?? "baseline pack"})`
        : baselinePackParsed.ok
          ? "invalid pack kind (expected product baseline data pack)"
          : `missing or invalid (${baselinePackParsed.details})`,
    remediation: "Regenerate Product Baseline Data Pack and upload it with this analysis output.",
  };

  const stisFromPack = detectMetricRowsInPack(baselinePackParsed.parsed, "stis");
  const stisFromSeparate = stisFromPack.present
    ? { present: false, details: "not needed" }
    : detectMetricRowsInSeparateUpload(context.stisSeparateUpload, "stis");
  const stisPresent = stisFromPack.present || stisFromSeparate.present;
  const stisSource = stisFromPack.present
    ? "from pack"
    : stisFromSeparate.present
      ? "separate upload"
      : "missing";
  const stisItem: PreflightItem = {
    name: "STIS",
    required: true,
    status: stisPresent ? "PASS" : "FAIL",
    source: stisSource,
    details: stisPresent
      ? `present (${stisSource})`
      : `missing (${stisFromPack.details}; ${stisFromSeparate.details})`,
    remediation:
      "STIS missing. Regenerate the pack and choose include, or regenerate in export mode and upload STIS + STIR files.",
  };

  const stirFromPack = detectMetricRowsInPack(baselinePackParsed.parsed, "stir");
  const stirFromSeparate = stirFromPack.present
    ? { present: false, details: "not needed" }
    : detectMetricRowsInSeparateUpload(context.stirSeparateUpload, "stir");
  const stirPresent = stirFromPack.present || stirFromSeparate.present;
  const stirSource = stirFromPack.present
    ? "from pack"
    : stirFromSeparate.present
      ? "separate upload"
      : "missing";
  const stirItem: PreflightItem = {
    name: "STIR",
    required: true,
    status: stirPresent ? "PASS" : "FAIL",
    source: stirSource,
    details: stirPresent
      ? `present (${stirSource})`
      : `missing (${stirFromPack.details}; ${stirFromSeparate.details})`,
    remediation:
      "STIR missing. Regenerate the pack and choose include, or regenerate in export mode and upload STIS + STIR files.",
  };

  const items = [outputPackItem, baselinePackItem, stisItem, stirItem];
  const overallOk = items.every((item) => !item.required || item.status === "PASS");

  const report: PreflightReport = {
    overall_ok: overallOk,
    analysis_type: context.analysisType,
    items,
    actions: collectActions(items),
  };

  return {
    report,
    parsedAnalysisOutputPack: outputPackParsed.parsed,
    parsedBaselinePack: baselinePackParsed.parsed,
  };
};
