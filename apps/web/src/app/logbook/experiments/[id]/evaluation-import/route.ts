import { revalidatePath } from 'next/cache';

import { importExperimentEvaluationOutputPack } from '@/lib/logbook/aiPack/importExperimentEvaluationOutputPack';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const experimentId = id?.trim();
  if (!experimentId) {
    return Response.json({ ok: false, error: 'Missing experiment id.' }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ ok: false, error: 'Expected multipart form data.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File) || file.size === 0) {
    return Response.json({ ok: false, error: 'JSON file is required.' }, { status: 400 });
  }

  const fileText = await file.text();
  const result = await importExperimentEvaluationOutputPack({
    fileText,
    expectedExperimentId: experimentId,
  });

  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        error: result.error ?? 'Failed to import evaluation output pack.',
      },
      { status: 400 }
    );
  }

  revalidatePath(`/logbook/experiments/${experimentId}`);
  if (result.product_asin) {
    revalidatePath(`/products/${result.product_asin}`);
  }

  return Response.json(result);
}
