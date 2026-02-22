export function isCategoryTargetingExpression(norm: string): boolean {
  return /^category=\".*\"$/i.test(String(norm ?? "").trim());
}
