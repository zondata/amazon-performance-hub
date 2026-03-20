export const ADS_OPTIMIZER_TARGET_TABLE_LAYOUT_STORAGE_KEY =
  'aph.adsOptimizerTargetsCollapsedTableLayout.v2';

export const ADS_OPTIMIZER_TARGET_TABLE_COLUMNS = [
  {
    key: 'target',
    label: 'Target',
    minWidth: 280,
    defaultWidth: 340,
    maxWidth: 500,
    freezable: true,
  },
  {
    key: 'state',
    label: 'State',
    minWidth: 240,
    defaultWidth: 280,
    maxWidth: 400,
    freezable: false,
  },
  {
    key: 'economics',
    label: 'Economics',
    minWidth: 240,
    defaultWidth: 270,
    maxWidth: 400,
    freezable: false,
  },
  {
    key: 'contribution',
    label: 'Contribution',
    minWidth: 140,
    defaultWidth: 170,
    maxWidth: 280,
    freezable: false,
  },
  {
    key: 'ranking',
    label: 'Ranking',
    minWidth: 120,
    defaultWidth: 150,
    maxWidth: 260,
    freezable: false,
  },
  {
    key: 'role',
    label: 'Role',
    minWidth: 100,
    defaultWidth: 120,
    maxWidth: 200,
    freezable: false,
  },
  {
    key: 'change_summary',
    label: 'Change summary',
    minWidth: 160,
    defaultWidth: 200,
    maxWidth: 360,
    freezable: false,
  },
] as const;

export type AdsOptimizerTargetTableColumnKey =
  (typeof ADS_OPTIMIZER_TARGET_TABLE_COLUMNS)[number]['key'];
export type AdsOptimizerTargetTableColumnWidths = Record<
  AdsOptimizerTargetTableColumnKey,
  number
>;
export type AdsOptimizerTargetTableLayoutPrefs = {
  widths: AdsOptimizerTargetTableColumnWidths;
  frozenColumns: AdsOptimizerTargetTableColumnKey[];
};

const DEFAULT_FROZEN_COLUMNS: AdsOptimizerTargetTableColumnKey[] = ['target'];
const COLUMN_KEYS = ADS_OPTIMIZER_TARGET_TABLE_COLUMNS.map((column) => column.key);

export const DEFAULT_ADS_OPTIMIZER_TARGET_TABLE_COLUMN_WIDTHS =
  ADS_OPTIMIZER_TARGET_TABLE_COLUMNS.reduce(
    (accumulator, column) => {
      accumulator[column.key] = column.defaultWidth;
      return accumulator;
    },
    {} as AdsOptimizerTargetTableColumnWidths
  );

const isColumnKey = (value: unknown): value is AdsOptimizerTargetTableColumnKey =>
  typeof value === 'string' &&
  COLUMN_KEYS.includes(value as AdsOptimizerTargetTableColumnKey);

const readColumnConfig = (key: AdsOptimizerTargetTableColumnKey) =>
  ADS_OPTIMIZER_TARGET_TABLE_COLUMNS.find((column) => column.key === key) ??
  ADS_OPTIMIZER_TARGET_TABLE_COLUMNS[0];

export const getAdsOptimizerTargetTableColumnConfig = (
  key: AdsOptimizerTargetTableColumnKey
) => readColumnConfig(key);

const clampColumnWidth = (key: AdsOptimizerTargetTableColumnKey, value: number) => {
  const config = readColumnConfig(key);
  const safeValue = Number.isFinite(value) ? value : config.defaultWidth;
  return Math.max(config.minWidth, Math.min(config.maxWidth, Math.round(safeValue)));
};

const normalizeFrozenColumns = (value: unknown): AdsOptimizerTargetTableColumnKey[] => {
  if (!Array.isArray(value)) return [...DEFAULT_FROZEN_COLUMNS];
  const normalized = value.filter(
    (entry): entry is AdsOptimizerTargetTableColumnKey =>
      isColumnKey(entry) && readColumnConfig(entry).freezable
  );
  return normalized.length > 0 ? normalized : [];
};

export const getDefaultAdsOptimizerTargetTableLayoutPrefs =
  (): AdsOptimizerTargetTableLayoutPrefs => ({
    widths: { ...DEFAULT_ADS_OPTIMIZER_TARGET_TABLE_COLUMN_WIDTHS },
    frozenColumns: [...DEFAULT_FROZEN_COLUMNS],
  });

export const normalizeAdsOptimizerTargetTableLayoutPrefs = (
  value: unknown
): AdsOptimizerTargetTableLayoutPrefs => {
  const defaults = getDefaultAdsOptimizerTargetTableLayoutPrefs();
  const nextWidths = { ...defaults.widths };
  const widths =
    value && typeof value === 'object' && value !== null && 'widths' in value
      ? (value.widths as Record<string, unknown>)
      : null;

  for (const key of COLUMN_KEYS) {
    const rawWidth = widths?.[key];
    nextWidths[key] =
      typeof rawWidth === 'number'
        ? clampColumnWidth(key, rawWidth)
        : defaults.widths[key];
  }

  const frozenColumns =
    value && typeof value === 'object' && value !== null && 'frozenColumns' in value
      ? normalizeFrozenColumns(value.frozenColumns)
      : [...defaults.frozenColumns];

  return {
    widths: nextWidths,
    frozenColumns,
  };
};

export const parseAdsOptimizerTargetTableLayoutPrefs = (value: string | null) => {
  if (!value) return getDefaultAdsOptimizerTargetTableLayoutPrefs();
  try {
    return normalizeAdsOptimizerTargetTableLayoutPrefs(JSON.parse(value));
  } catch {
    return getDefaultAdsOptimizerTargetTableLayoutPrefs();
  }
};

export const serializeAdsOptimizerTargetTableLayoutPrefs = (
  value: AdsOptimizerTargetTableLayoutPrefs
) => JSON.stringify(normalizeAdsOptimizerTargetTableLayoutPrefs(value));

export const updateAdsOptimizerTargetTableColumnWidth = (
  prefs: AdsOptimizerTargetTableLayoutPrefs,
  key: AdsOptimizerTargetTableColumnKey,
  width: number
): AdsOptimizerTargetTableLayoutPrefs => {
  const normalized = normalizeAdsOptimizerTargetTableLayoutPrefs(prefs);
  return {
    ...normalized,
    widths: {
      ...normalized.widths,
      [key]: clampColumnWidth(key, width),
    },
  };
};

export const applyAdsOptimizerTargetTableColumnResizeDelta = (
  prefs: AdsOptimizerTargetTableLayoutPrefs,
  key: AdsOptimizerTargetTableColumnKey,
  startWidth: number,
  deltaX: number
) => updateAdsOptimizerTargetTableColumnWidth(prefs, key, startWidth + deltaX);

export const toggleAdsOptimizerTargetTableFrozenColumn = (
  prefs: AdsOptimizerTargetTableLayoutPrefs,
  key: AdsOptimizerTargetTableColumnKey
): AdsOptimizerTargetTableLayoutPrefs => {
  if (!readColumnConfig(key).freezable) {
    return normalizeAdsOptimizerTargetTableLayoutPrefs(prefs);
  }

  const normalized = normalizeAdsOptimizerTargetTableLayoutPrefs(prefs);
  const frozenColumns = normalized.frozenColumns.includes(key)
    ? normalized.frozenColumns.filter((entry) => entry !== key)
    : [...normalized.frozenColumns, key];

  return {
    ...normalized,
    frozenColumns,
  };
};
