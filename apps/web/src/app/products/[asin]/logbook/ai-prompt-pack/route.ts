import { env } from '@/lib/env';
import { getProductExperimentPromptTemplates } from '@/lib/logbook/productExperimentPromptTemplates';
import { renderProductExperimentPromptPackMarkdown } from '@/lib/logbook/renderProductExperimentPromptPack';

export const dynamic = 'force-dynamic';

const sanitizeFileSegment = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]+/g, '')
    .slice(0, 80);

type Ctx = { params: Promise<{ asin: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { asin: rawAsin } = await params;
  const asin = (rawAsin ?? '').trim().toUpperCase();
  if (!asin) {
    return new Response('Missing ASIN param.', { status: 400 });
  }

  const url = new URL(request.url);
  const templateIdParam = url.searchParams.get('template')?.trim() ?? '';

  let templates;
  try {
    templates = await getProductExperimentPromptTemplates({
      accountId: env.accountId,
      marketplace: env.marketplace,
    });
  } catch (error) {
    console.error('product_experiment_prompt_pack:template_load_error', { asin, error });
    return new Response('Failed to load product experiment prompt pack template.', {
      status: 500,
    });
  }

  const selectedTemplate =
    templates.find((template) => template.id === templateIdParam) ??
    templates.find((template) => template.is_default) ??
    templates[0];

  if (!selectedTemplate) {
    return new Response('No product experiment prompt pack template configured.', {
      status: 500,
    });
  }

  const content = renderProductExperimentPromptPackMarkdown({
    asin,
    template: {
      id: selectedTemplate.id,
      name: selectedTemplate.name,
      instructions_md: selectedTemplate.instructions_md,
    },
  });

  const filename = `${sanitizeFileSegment(asin)}_${sanitizeFileSegment(
    selectedTemplate.id
  )}_product_experiment_prompt_pack.md`;

  return new Response(content, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
