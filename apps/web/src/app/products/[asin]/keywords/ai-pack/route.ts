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
    console.error('keyword_ai_pack:error', { asin, groupSetId, error });
    return new Response('Failed to load keyword AI pack.', { status: 500 });
  }

  if (!result || result.ok === false) {
    if (result?.reason === 'product_not_found') {
      return new Response('Product not found.', { status: 404 });
    }
    return new Response('No keyword group set found.', { status: 404 });
  }

  const data = result.data;
  const groupNames = data.group_names.slice(0, 12);
  const setName = data.group_set.name;

  const content = `# AI Keyword Formatting Pack

## Product
- ASIN: ${asin}
- Title: ${data.title ?? '—'}
- Short name: ${data.short_name ?? '—'}

## Group Set
- Name: ${setName}
- Exclusive: ${data.group_set.is_exclusive ? 'Yes' : 'No'}
- Created: ${data.group_set.created_at ?? '—'}

## Allowed Group Names (Columns D-O)
${groupNames.length > 0 ? groupNames.map((name) => `- ${name}`).join('\n') : '- (none)'}

## Exact CSV Requirements
- Row 1 is headers (no notes row). Columns must be:
  - A: keyword
  - B: group
  - C: note
  - D..O: group columns (only the names listed above).
- Only the group names listed above are allowed in columns D..O.
- Keywords are normalized (lowercase, trim, collapse spaces).
- Duplicate keywords are removed automatically by the importer.
- If this is an exclusive set, each keyword can belong to only one group.
- Output **only** a CSV in this exact format.

## Ask
Please produce a CSV that follows the exact format above for the group names listed.
`;

  const filename = `${asin}_${sanitizeFileSegment(setName)}_ai_pack.md`;

  console.log('keyword_ai_pack', {
    asin,
    groupSetId: data.group_set.group_set_id,
    groupCount: groupNames.length,
  });

  return new Response(content, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
