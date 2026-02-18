import { env } from '@/lib/env';
import { getKeywordGroupExportData } from '@/lib/products/keywordGroupExport';

export const dynamic = 'force-dynamic';

const sanitizeFileSegment = (value: string): string => {
  const cleaned = value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]+/g, '');
  return cleaned.length > 0 ? cleaned.slice(0, 80) : 'keyword_set';
};

const escapeCsv = (value: string): string => {
  if (value.includes('"')) {
    value = value.replace(/"/g, '""');
  }
  if (value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value}"`;
  }
  return value;
};

const buildCsv = (rows: string[][]): string =>
  rows.map((row) => row.map((cell) => escapeCsv(cell ?? '')).join(',')).join('\n');

type Ctx = { params: Promise<{ asin: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { asin: asinRaw } = await params;
  const asin = (asinRaw ?? '').trim().toUpperCase();
  if (!asin) {
    return new Response('Missing ASIN param', { status: 400 });
  }
  const url = new URL(request.url);
  const groupSetId = url.searchParams.get('set');

  let result;
  try {
    result = await getKeywordGroupExportData({
      accountId: env.accountId,
      marketplace: env.marketplace,
      asin,
      groupSetId,
    });
  } catch (error) {
    console.error('keyword_export:error', { asin, groupSetId, error });
    return new Response('Failed to load keyword group export.', { status: 500 });
  }

  if (!result || result.ok === false) {
    if (result?.reason === 'product_not_found') {
      return new Response('Product not found.', { status: 404 });
    }
    return new Response('No keyword group set found.', { status: 404 });
  }

  const data = result.data;
  const groupNames = data.group_names.slice(0, 12);
  const groupKeywords = data.group_keywords;

  const rows: string[][] = [];
  const headerRow = new Array(15).fill('');
  headerRow[0] = 'keyword';
  headerRow[1] = 'group';
  headerRow[2] = 'note';
  groupNames.forEach((name, idx) => {
    headerRow[3 + idx] = name;
  });
  rows.push(headerRow);

  const maxRows = Math.max(
    0,
    ...groupNames.map((name) => (groupKeywords[name] ?? []).length)
  );

  for (let i = 0; i < maxRows; i += 1) {
    const row = new Array(15).fill('');
    groupNames.forEach((name, idx) => {
      row[3 + idx] = groupKeywords[name]?.[i] ?? '';
    });
    rows.push(row);
  }

  const csv = buildCsv(rows);
  const setName = sanitizeFileSegment(data.group_set.name);
  const filename = `${asin}_${setName}_keyword_groups.csv`;

  console.log('keyword_export', {
    asin,
    groupSetId: data.group_set.group_set_id,
    groupCount: groupNames.length,
    keywordCount: Object.values(groupKeywords).reduce(
      (sum, list) => sum + list.length,
      0
    ),
  });

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
