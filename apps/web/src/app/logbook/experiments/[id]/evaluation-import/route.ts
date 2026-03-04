import { revalidatePath } from 'next/cache';
import { gunzipSync } from 'node:zlib';

import {
  importExperimentEvaluationOutputPack,
} from '@/lib/logbook/aiPack/importExperimentEvaluationOutputPack';
import { normalizeEvaluationImportSuccess } from '@/lib/logbook/aiPack/evaluationImportResponse';
import {
  renderRequiredDataAvailability,
  runRequiredDataPreflight,
  type PreflightArtifactInput,
} from '@/lib/logbook/aiPack/requiredDataPreflight';

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

const isGzipBuffer = (buffer: Buffer): boolean =>
  buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;

const readArtifactInput = async (
  formData: FormData,
  key: string,
  label: string
): Promise<PreflightArtifactInput> => {
  const file = formData.get(key);
  if (!file || !(file instanceof File)) {
    return {
      filename: null,
      text: null,
      sizeBytes: 0,
      readError: null,
    };
  }

  if (file.size === 0) {
    return {
      filename: file.name ?? null,
      text: null,
      sizeBytes: 0,
      readError: null,
    };
  }

  try {
    const raw = Buffer.from(await file.arrayBuffer());
    const isGzip = isGzipBuffer(raw) || file.name.toLowerCase().endsWith('.gz');
    const text = isGzip ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
    return {
      filename: file.name ?? null,
      text,
      sizeBytes: file.size,
      readError: null,
    };
  } catch (error) {
    return {
      filename: file.name ?? null,
      text: null,
      sizeBytes: file.size,
      readError:
        error instanceof Error
          ? `${label} could not be read (${error.message}).`
          : `${label} could not be read.`,
    };
  }
};

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

  const [analysisOutputPack, baselinePack, stisSeparateUpload, stirSeparateUpload] =
    await Promise.all([
      readArtifactInput(formData, 'file', 'Analysis output pack'),
      readArtifactInput(formData, 'baseline_file', 'Baseline data pack'),
      readArtifactInput(formData, 'stis_file', 'STIS upload'),
      readArtifactInput(formData, 'stir_file', 'STIR upload'),
    ]);

  const preflight = runRequiredDataPreflight({
    analysisType: 'experiment_evaluation',
    analysisOutputPack,
    baselinePack,
    stisSeparateUpload,
    stirSeparateUpload,
  });
  const preflightRendered = renderRequiredDataAvailability(preflight.report);

  if (!preflight.report.overall_ok) {
    return jsonFailure(
      400,
      'Required data missing or invalid. Analysis halted until required data availability passes.',
      {
        code: 'required_data_missing',
        experiment_id: experimentId,
        preflight: preflight.report,
        preflight_rendered: preflightRendered,
      }
    );
  }

  if (!analysisOutputPack.text) {
    return jsonFailure(400, 'Analysis output pack is required.', {
      code: 'missing_file',
      experiment_id: experimentId,
      preflight: preflight.report,
      preflight_rendered: preflightRendered,
    });
  }

  try {
    const result = await importExperimentEvaluationOutputPack({
      fileText: analysisOutputPack.text,
      expectedExperimentId: experimentId,
    });

    if (!result.ok) {
      return jsonFailure(400, result.error ?? 'Failed to import evaluation output pack.', {
        code: 'evaluation_import_failed',
        experiment_id: experimentId,
        preflight: preflight.report,
        preflight_rendered: preflightRendered,
        ...(result.details ? result.details : {}),
      });
    }

    revalidatePath(`/logbook/experiments/${experimentId}`);
    if (result.product_asin) {
      revalidatePath(`/products/${result.product_asin}`);
    }

    return Response.json({
      preflight: preflight.report,
      preflight_rendered: preflightRendered,
      ...normalizeEvaluationImportSuccess(result),
    });
  } catch (error) {
    return jsonFailure(
      500,
      error instanceof Error ? error.message : 'Unexpected evaluation import error.',
      {
        code: 'evaluation_import_unexpected_error',
        experiment_id: experimentId,
        preflight: preflight.report,
        preflight_rendered: preflightRendered,
      }
    );
  }
}
