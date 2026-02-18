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
    console.error('keyword_template:error', { asin, groupSetId, error });
    return new Response('Failed to load keyword template export.', { status: 500 });
  }

  if (!result || result.ok === false) {
    if (result?.reason === 'product_not_found') {
      return new Response('Product not found.', { status: 404 });
    }
    return new Response('No keyword group set found.', { status: 404 });
  }

  const data = result.data;
  const groupNames = data.group_names.slice(0, 12);

  const rows: string[][] = [];
  const headerRow = new Array(15).fill('');
  headerRow[0] = 'keyword';
  headerRow[1] = 'group';
  headerRow[2] = 'note';
  groupNames.forEach((name, idx) => {
    headerRow[3 + idx] = name;
  });
  rows.push(headerRow);

  const emptyRow = new Array(15).fill('');
  rows.push(emptyRow);

  const csv = buildCsv(rows);
  const setName = sanitizeFileSegment(data.group_set.name);
  const filename = `${asin}_${setName}_keyword_template.csv`;

  console.log('keyword_template', {
    asin,
    groupSetId: data.group_set.group_set_id,
    groupCount: groupNames.length,
  });

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
