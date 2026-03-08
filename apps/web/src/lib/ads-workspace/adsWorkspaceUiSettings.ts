export const ADS_WORKSPACE_UI_PAGE_KEY = 'ads.performance.workspace';

export const ADS_WORKSPACE_TABLE_SURFACE_KEYS = [
  'table:campaigns',
  'table:adgroups',
  'table:targets',
  'table:placements',
  'table:searchterms',
] as const;

export type AdsWorkspaceTableSurfaceKey =
  (typeof ADS_WORKSPACE_TABLE_SURFACE_KEYS)[number];

export type AdsWorkspaceTableFontSize = 'compact' | 'default' | 'comfortable';

export type AdsWorkspaceSurfaceSettings = {
  columnOrder: string[];
  hiddenColumns: string[];
  frozenColumns: string[];
  wrapLongLabels: boolean;
  fontSize: AdsWorkspaceTableFontSize;
};

export type AdsWorkspaceUiSettings = {
  surfaces: Partial<Record<AdsWorkspaceTableSurfaceKey, AdsWorkspaceSurfaceSettings>>;
};

export const DEFAULT_ADS_WORKSPACE_SURFACE_SETTINGS: AdsWorkspaceSurfaceSettings = {
  columnOrder: [],
  hiddenColumns: [],
  frozenColumns: [],
  wrapLongLabels: false,
  fontSize: 'default',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];

const asFontSize = (value: unknown): AdsWorkspaceTableFontSize =>
  value === 'compact' || value === 'comfortable' || value === 'default'
    ? value
    : 'default';

export const normalizeAdsWorkspaceSurfaceSettings = (params: {
  raw: unknown;
  columnKeys: string[];
  defaultFrozenColumns?: string[];
}) => {
  const record = isRecord(params.raw) ? params.raw : {};
  const validColumnKeys = new Set(params.columnKeys);
  const defaultFrozen = new Set(params.defaultFrozenColumns ?? []);

  const rawOrder = asStringArray(record.columnOrder).filter((key) => validColumnKeys.has(key));
  const seen = new Set(rawOrder);
  const trailing = params.columnKeys.filter((key) => !seen.has(key));
  const orderedColumns = [...rawOrder, ...trailing];

  const hiddenColumns = asStringArray(record.hiddenColumns).filter((key) => validColumnKeys.has(key));
  const hasSavedFrozenColumns = Object.prototype.hasOwnProperty.call(record, 'frozenColumns');
  const frozenColumns = hasSavedFrozenColumns
    ? asStringArray(record.frozenColumns).filter((key) => validColumnKeys.has(key))
    : [...defaultFrozen].filter((key) => validColumnKeys.has(key));

  const orderedFrozen = orderedColumns.filter((key) => frozenColumns.includes(key));
  const orderedNonFrozen = orderedColumns.filter((key) => !frozenColumns.includes(key));

  return {
    columnOrder: [...orderedFrozen, ...orderedNonFrozen],
    hiddenColumns,
    frozenColumns: orderedFrozen,
    wrapLongLabels: record.wrapLongLabels === true,
    fontSize: asFontSize(record.fontSize),
  } satisfies AdsWorkspaceSurfaceSettings;
};

export const normalizeAdsWorkspaceUiSettings = (raw: unknown): AdsWorkspaceUiSettings => {
  if (!isRecord(raw)) {
    return { surfaces: {} };
  }

  const surfaces = isRecord(raw.surfaces) ? raw.surfaces : {};
  const normalized: AdsWorkspaceUiSettings = { surfaces: {} };
  for (const surfaceKey of ADS_WORKSPACE_TABLE_SURFACE_KEYS) {
    const nextSurface = surfaces[surfaceKey];
    if (!nextSurface || !isRecord(nextSurface)) continue;
    normalized.surfaces[surfaceKey] = {
      columnOrder: asStringArray(nextSurface.columnOrder),
      hiddenColumns: asStringArray(nextSurface.hiddenColumns),
      frozenColumns: asStringArray(nextSurface.frozenColumns),
      wrapLongLabels: nextSurface.wrapLongLabels === true,
      fontSize: asFontSize(nextSurface.fontSize),
    };
  }
  return normalized;
};
