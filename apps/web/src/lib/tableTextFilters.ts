export type TableTextFilterSource =
  | string
  | null
  | undefined
  | readonly (string | null | undefined)[];

export const normalizeTableTextFilter = (value: string | null | undefined): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const hasActiveTableTextFilter = (
  value: string | null | undefined
): boolean => normalizeTableTextFilter(value).length > 0;

export const matchesTableTextFilter = (
  source: TableTextFilterSource,
  filterValue: string | null | undefined
): boolean => {
  const normalizedFilter = normalizeTableTextFilter(filterValue);
  if (!normalizedFilter) return true;

  const values = Array.isArray(source) ? source : [source];
  return values.some((value) => {
    const normalizedSource = normalizeTableTextFilter(value);
    return normalizedSource.length > 0 && normalizedSource.includes(normalizedFilter);
  });
};
