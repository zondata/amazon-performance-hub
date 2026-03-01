import { describe, expect, it } from 'vitest';

import {
  parseReviewPatchPack,
  REVIEW_PATCH_PACK_KIND,
} from '../apps/web/src/lib/logbook/aiPack/parseReviewPatchPack';

describe('review patch pack parser', () => {
  it('accepts a valid review patch pack', () => {
    const result = parseReviewPatchPack(
      JSON.stringify({
        kind: REVIEW_PATCH_PACK_KIND,
        pack_version: 'v1',
        pack_id: 'review_123',
        created_at: '2026-03-01T10:00:00Z',
        links: {
          experiment_id: '11111111-1111-1111-1111-111111111111',
          proposal_pack_id: 'proposal_1',
        },
        trace: {
          workflow_mode: 'manual',
          model: 'gpt-5',
        },
        patch: {
          decisions: [
            {
              change_id: 'chg_abcdef12',
              decision: 'accept',
            },
            {
              change_id: 'chg_abcdef34',
              decision: 'modify',
              override: { new_value: 2.5 },
            },
          ],
        },
      }),
      {
        expectedExperimentId: '11111111-1111-1111-1111-111111111111',
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.patch.decisions).toHaveLength(2);
      expect(result.value.patch.decisions[1].override_new_value).toBe(2.5);
    }
  });

  it('rejects experiment mismatch', () => {
    const result = parseReviewPatchPack(
      JSON.stringify({
        kind: REVIEW_PATCH_PACK_KIND,
        pack_version: 'v1',
        pack_id: 'review_123',
        created_at: '2026-03-01T10:00:00Z',
        links: {
          experiment_id: '22222222-2222-2222-2222-222222222222',
        },
        trace: {
          workflow_mode: 'manual',
        },
        patch: {
          decisions: [{ change_id: 'chg_1', decision: 'accept' }],
        },
      }),
      {
        expectedExperimentId: '11111111-1111-1111-1111-111111111111',
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/must match selected experiment/i);
    }
  });

  it('rejects empty decisions', () => {
    const result = parseReviewPatchPack(
      JSON.stringify({
        kind: REVIEW_PATCH_PACK_KIND,
        pack_version: 'v1',
        pack_id: 'review_123',
        created_at: '2026-03-01T10:00:00Z',
        links: { experiment_id: '11111111-1111-1111-1111-111111111111' },
        trace: { workflow_mode: 'manual' },
        patch: { decisions: [] },
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/non-empty array/i);
    }
  });
});
