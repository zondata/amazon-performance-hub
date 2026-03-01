import { revalidatePath } from 'next/cache';

import {
  importExperimentEvaluationOutputPack,
} from '@/lib/logbook/aiPack/importExperimentEvaluationOutputPack';
import { normalizeEvaluationImportSuccess } from '@/lib/logbook/aiPack/evaluationImportResponse';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

const jsonFailure = (
  status: number,
  error: string,
  details?: Record<string, unknown>
) =>
  Response.json(
    {
      ok: false,
      error,
      ...(details ? { details } : {}),
    },
    { status }
  );

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const experimentId = id?.trim();
  if (!experimentId) {
    return jsonFailure(400, 'Missing experiment id.', {
      code: 'missing_experiment_id',
    });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonFailure(400, 'Expected multipart form data.', {
      code: 'invalid_form_data',
    });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File) || file.size === 0) {
    return jsonFailure(400, 'JSON file is required.', {
      code: 'missing_file',
    });
  }

  try {
    const fileText = await file.text();
    const result = await importExperimentEvaluationOutputPack({
      fileText,
      expectedExperimentId: experimentId,
    });

    if (!result.ok) {
      return jsonFailure(400, result.error ?? 'Failed to import evaluation output pack.', {
        code: 'evaluation_import_failed',
        experiment_id: experimentId,
        ...(result.details ? result.details : {}),
      });
    }

    revalidatePath(`/logbook/experiments/${experimentId}`);
    if (result.product_asin) {
      revalidatePath(`/products/${result.product_asin}`);
    }

    return Response.json(normalizeEvaluationImportSuccess(result));
  } catch (error) {
    return jsonFailure(
      500,
      error instanceof Error ? error.message : 'Unexpected evaluation import error.',
      {
        code: 'evaluation_import_unexpected_error',
        experiment_id: experimentId,
      }
    );
  }
}
