import { env } from '@/lib/env';
import { buildKeywordAiPackFilename } from '@/lib/keywords/keywordAiPackFilenames';
import { getKeywordAiPackTemplates } from '@/lib/keywords/keywordAiPackTemplates';
import { renderKeywordAiPackMarkdown } from '@/lib/keywords/renderKeywordAiPack';
import { getKeywordGroupExportData } from '@/lib/products/keywordGroupExport';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const parseShortName = (value: unknown): string | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const shortName = (value as Record<string, unknown>).short_name;
  return typeof shortName === 'string' && shortName.trim().length > 0
    ? shortName.trim()
    : null;
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
  const templateIdParam = url.searchParams.get('template')?.trim() ?? '';

  let templates;
  try {
    templates = await getKeywordAiPackTemplates({
      accountId: env.accountId,
      marketplace: env.marketplace,
    });
  } catch (error) {
    console.error('keyword_ai_pack:template_load_error', { asin, error });
    return new Response('Failed to load keyword AI pack template.', { status: 500 });
  }
  const selectedTemplate =
    templates.find((template) => template.id === templateIdParam) ??
    templates.find((template) => template.is_default) ??
    templates[0];

  if (!selectedTemplate) {
    return new Response('No keyword AI pack template configured.', { status: 500 });
  }

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

    const { data: productRow, error: productError } = await supabaseAdmin
      .from('products')
      .select('product_id,title')
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .eq('asin', asin)
      .maybeSingle();

    if (productError || !productRow?.product_id) {
      return new Response('Product not found.', { status: 404 });
    }

    let shortName: string | null = null;
    try {
      const { data: profileRow } = await supabaseAdmin
        .from('product_profile')
        .select('profile_json')
        .eq('product_id', productRow.product_id)
        .maybeSingle();
      shortName = parseShortName(profileRow?.profile_json ?? null);
    } catch {
      shortName = null;
    }

    const content = renderKeywordAiPackMarkdown({
      asin,
      title: (productRow.title ?? null) as string | null,
      short_name: shortName,
      template: {
        name: selectedTemplate.name,
        instructions_md: selectedTemplate.instructions_md,
      },
    });

    const filename = buildKeywordAiPackFilename({
      asin,
      templateId: selectedTemplate.id,
    });

    console.log('keyword_ai_pack_generic', {
      asin,
      templateId: selectedTemplate.id,
    });

    return new Response(content, {
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  const data = result.data;
  const groupNames = data.group_names.slice(0, 12);
  const setName = data.group_set.name;

  const content = renderKeywordAiPackMarkdown({
    asin,
    title: data.title,
    short_name: data.short_name,
    group_set: {
      name: data.group_set.name,
      is_exclusive: data.group_set.is_exclusive,
      created_at: data.group_set.created_at,
    },
    allowed_group_names: groupNames,
    template: {
      name: selectedTemplate.name,
      instructions_md: selectedTemplate.instructions_md,
    },
  });

  const filename = buildKeywordAiPackFilename({
    asin,
    setName,
    templateId: selectedTemplate.id,
  });

  console.log('keyword_ai_pack', {
    asin,
    groupSetId: data.group_set.group_set_id,
    groupCount: groupNames.length,
    templateId: selectedTemplate.id,
  });

  return new Response(content, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
