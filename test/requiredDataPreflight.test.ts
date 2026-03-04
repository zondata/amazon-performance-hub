import { describe, expect, it } from 'vitest';

import {
  renderRequiredDataAvailability,
  runRequiredDataPreflight,
  type PreflightArtifactInput,
} from '../apps/web/src/lib/logbook/aiPack/requiredDataPreflight';

const makeArtifact = (text: string | null, filename: string | null): PreflightArtifactInput => ({
  filename,
  text,
  sizeBytes: text ? Buffer.byteLength(text, 'utf8') : 0,
  readError: null,
});

const makeOutputPack = () =>
  JSON.stringify({
    kind: 'aph_experiment_evaluation_pack_v1',
    experiment_id: '11111111-1111-1111-1111-111111111111',
  });

describe('required data preflight', () => {
  it('passes when all required artifacts are present (STIS/STIR from pack)', () => {
    const baselinePack = JSON.stringify({
      kind: 'aph_product_baseline_data_pack_v3',
      metadata: {
        stis_stir: {
          stis: { included_in_pack: true, in_pack_row_count: 1 },
          stir: { included_in_pack: true, in_pack_row_count: 1 },
        },
      },
      ads_baseline: {
        sp: {
          stis: {
            rows: [{ search_term_impression_share: 0.41 }],
          },
          stir: {
            rows: [{ search_term_impression_rank: 5 }],
          },
        },
      },
    });

    const result = runRequiredDataPreflight({
      analysisType: 'experiment_evaluation',
      analysisOutputPack: makeArtifact(makeOutputPack(), 'evaluation_output.json'),
      baselinePack: makeArtifact(baselinePack, 'baseline.json'),
      stisSeparateUpload: makeArtifact(null, null),
      stirSeparateUpload: makeArtifact(null, null),
    });

    expect(result.report.overall_ok).toBe(true);
    const stis = result.report.items.find((item) => item.name === 'STIS');
    const stir = result.report.items.find((item) => item.name === 'STIR');
    expect(stis?.status).toBe('PASS');
    expect(stis?.source).toBe('from pack');
    expect(stir?.status).toBe('PASS');
    expect(stir?.source).toBe('from pack');

    const rendered = renderRequiredDataAvailability(result.report);
    expect(rendered.startsWith('Required data availability')).toBe(true);
  });

  it('fails when STIS is missing', () => {
    const baselinePack = JSON.stringify({
      kind: 'aph_product_baseline_data_pack_v3',
      metadata: {
        stis_stir: {
          stis: { included_in_pack: false, in_pack_row_count: 0 },
          stir: { included_in_pack: true, in_pack_row_count: 1 },
        },
      },
      ads_baseline: {
        sp: {
          stis: { rows: [] },
          stir: {
            rows: [{ search_term_impression_rank: 7 }],
          },
        },
      },
    });

    const result = runRequiredDataPreflight({
      analysisType: 'experiment_evaluation',
      analysisOutputPack: makeArtifact(makeOutputPack(), 'evaluation_output.json'),
      baselinePack: makeArtifact(baselinePack, 'baseline.json'),
      stisSeparateUpload: makeArtifact(null, null),
      stirSeparateUpload: makeArtifact(null, null),
    });

    expect(result.report.overall_ok).toBe(false);
    const stis = result.report.items.find((item) => item.name === 'STIS');
    expect(stis?.status).toBe('FAIL');
    expect(result.report.actions.some((action) => action.includes('STIS missing.'))).toBe(true);
  });

  it('passes when STIS is provided via separate upload', () => {
    const baselinePack = JSON.stringify({
      kind: 'aph_product_baseline_data_pack_v3',
      metadata: {
        stis_stir: {
          stis: { included_in_pack: false, in_pack_row_count: 0 },
          stir: { included_in_pack: true, in_pack_row_count: 1 },
        },
      },
      ads_baseline: {
        sp: {
          stis: { rows: [] },
          stir: {
            rows: [{ search_term_impression_rank: 3 }],
          },
        },
      },
    });

    const stisNdjson = `${JSON.stringify({ search_term_impression_share: 0.19 })}\n`;

    const result = runRequiredDataPreflight({
      analysisType: 'experiment_evaluation',
      analysisOutputPack: makeArtifact(makeOutputPack(), 'evaluation_output.json'),
      baselinePack: makeArtifact(baselinePack, 'baseline.json'),
      stisSeparateUpload: makeArtifact(stisNdjson, 'stis.ndjson'),
      stirSeparateUpload: makeArtifact(null, null),
    });

    expect(result.report.overall_ok).toBe(true);
    const stis = result.report.items.find((item) => item.name === 'STIS');
    expect(stis?.status).toBe('PASS');
    expect(stis?.source).toBe('separate upload');
  });
});
