export type StisMode = "pack" | "export";

export type StisStirAvailability = {
  stisAvailable: boolean;
  stirAvailable: boolean;
  stisRowCount: number;
  stirRowCount: number;
  campaignCount: number;
  start: string;
  end: string;
};

export type StisModeDecisionSource =
  | "explicit"
  | "confirmation_required"
  | "default_non_interactive"
  | "single_or_missing";

export type StisModeDecision = {
  mode: StisMode;
  source: StisModeDecisionSource;
  confirmationRequired: boolean;
};

export type StisStirExportArtifacts = {
  stisPath: string;
  stirPath: string;
};

type BuildPackParams<TRow extends Record<string, unknown>> = {
  includeStisStir: boolean;
  mode: StisMode;
  decisionSource: StisModeDecisionSource;
  availability: StisStirAvailability;
  stisRows: TRow[];
  stirRows: TRow[];
  exportPaths: StisStirExportArtifacts | null;
};

type BuildPackManifestEntry = {
  available: boolean;
  available_row_count: number;
  included_in_pack: boolean;
  in_pack_row_count: number;
  in_pack_size_bytes: number | null;
  exported_paths: string[];
};

export type StisStirPackManifest = {
  mode: StisMode;
  decision_source: StisModeDecisionSource;
  explicit_choice_required: boolean;
  start: string;
  end: string;
  stis: BuildPackManifestEntry;
  stir: BuildPackManifestEntry;
};

export type BuildPackResult<TRow extends Record<string, unknown>> = {
  stisRowsInPack: TRow[] | null;
  stirRowsInPack: TRow[] | null;
  manifest: StisStirPackManifest;
};

const toNonNegativeCount = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const encodePathPart = (value: string): string => encodeURIComponent(value.trim());

export const normalizeStisMode = (value: string | null | undefined): StisMode | null => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "pack") return "pack";
  if (normalized === "export") return "export";
  return null;
};

export const detectStisStirAvailability = (params: {
  stisRowCount: unknown;
  stirRowCount: unknown;
  campaignCount: unknown;
  start: string;
  end: string;
}): StisStirAvailability => {
  const stisRowCount = toNonNegativeCount(params.stisRowCount);
  const stirRowCount = toNonNegativeCount(params.stirRowCount);
  const campaignCount = toNonNegativeCount(params.campaignCount);
  return {
    stisAvailable: stisRowCount > 0,
    stirAvailable: stirRowCount > 0,
    stisRowCount,
    stirRowCount,
    campaignCount,
    start: params.start,
    end: params.end,
  };
};

export const chooseStisModeInteractivelyIfNeeded = (params: {
  availability: StisStirAvailability;
  requestedMode: StisMode | null;
  interactiveConfirmRequested: boolean;
  defaultMode?: StisMode;
}): StisModeDecision => {
  const defaultMode = params.defaultMode ?? "pack";
  const bothAvailable = params.availability.stisAvailable && params.availability.stirAvailable;
  if (!bothAvailable) {
    return {
      mode: params.requestedMode ?? defaultMode,
      source: "single_or_missing",
      confirmationRequired: false,
    };
  }
  if (params.requestedMode) {
    return {
      mode: params.requestedMode,
      source: "explicit",
      confirmationRequired: false,
    };
  }
  if (params.interactiveConfirmRequested) {
    return {
      mode: defaultMode,
      source: "confirmation_required",
      confirmationRequired: true,
    };
  }
  return {
    mode: defaultMode,
    source: "default_non_interactive",
    confirmationRequired: false,
  };
};

export const exportStisStirArtifacts = (params: {
  outputDir: string;
  start: string;
  end: string;
  channel?: "sp" | "sb";
  scope?: "included" | "all";
  format?: "ndjson" | "ndjson.gz";
}): StisStirExportArtifacts => {
  const outputDir = trimTrailingSlash(params.outputDir);
  const channel = params.channel ?? "sp";
  const scope = params.scope ?? "included";
  const format = params.format ?? "ndjson.gz";
  const start = encodePathPart(params.start);
  const end = encodePathPart(params.end);
  const queryBase = `channel=${channel}&start=${start}&end=${end}&scope=${scope}&format=${format}`;
  return {
    stisPath: `${outputDir}/stis?${queryBase}&metric=stis`,
    stirPath: `${outputDir}/stir?${queryBase}`,
  };
};

export const buildPack = <TRow extends Record<string, unknown>>(
  params: BuildPackParams<TRow>
): BuildPackResult<TRow> => {
  const include = params.includeStisStir;
  const stisRowsInPack = include ? params.stisRows : null;
  const stirRowsInPack = include ? params.stirRows : null;

  const stisInPackSizeBytes =
    stisRowsInPack && stisRowsInPack.length > 0
      ? Buffer.byteLength(JSON.stringify(stisRowsInPack), "utf-8")
      : null;
  const stirInPackSizeBytes =
    stirRowsInPack && stirRowsInPack.length > 0
      ? Buffer.byteLength(JSON.stringify(stirRowsInPack), "utf-8")
      : null;

  const stisExportedPaths =
    !include && params.availability.stisAvailable && params.exportPaths?.stisPath
      ? [params.exportPaths.stisPath]
      : [];
  const stirExportedPaths =
    !include && params.availability.stirAvailable && params.exportPaths?.stirPath
      ? [params.exportPaths.stirPath]
      : [];

  return {
    stisRowsInPack,
    stirRowsInPack,
    manifest: {
      mode: params.mode,
      decision_source: params.decisionSource,
      explicit_choice_required: params.availability.stisAvailable && params.availability.stirAvailable,
      start: params.availability.start,
      end: params.availability.end,
      stis: {
        available: params.availability.stisAvailable,
        available_row_count: params.availability.stisRowCount,
        included_in_pack: include && params.availability.stisAvailable,
        in_pack_row_count: stisRowsInPack?.length ?? 0,
        in_pack_size_bytes: stisInPackSizeBytes,
        exported_paths: stisExportedPaths,
      },
      stir: {
        available: params.availability.stirAvailable,
        available_row_count: params.availability.stirRowCount,
        included_in_pack: include && params.availability.stirAvailable,
        in_pack_row_count: stirRowsInPack?.length ?? 0,
        in_pack_size_bytes: stirInPackSizeBytes,
        exported_paths: stirExportedPaths,
      },
    },
  };
};
