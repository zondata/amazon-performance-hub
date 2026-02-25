import { describe, expect, it } from 'vitest';

import { extractProductProfileContext } from '../apps/web/src/lib/products/productProfileContext';

describe('extractProductProfileContext', () => {
  it('returns null fields for null input', () => {
    expect(extractProductProfileContext(null)).toEqual({
      short_name: null,
      notes: null,
      intent: null,
      skills: [],
    });
  });

  it('trims short_name and notes', () => {
    expect(
      extractProductProfileContext({
        short_name: '  Core Name  ',
        notes: '  Keep this concise.  ',
      })
    ).toEqual({
      short_name: 'Core Name',
      notes: 'Keep this concise.',
      intent: null,
      skills: [],
    });
  });

  it('extracts intent when it is an object', () => {
    expect(
      extractProductProfileContext({
        intent: {
          mode: 'defensive',
          max_cpc: 1.25,
        },
      })
    ).toEqual({
      short_name: null,
      notes: null,
      intent: {
        mode: 'defensive',
        max_cpc: 1.25,
      },
      skills: [],
    });
  });

  it('ignores invalid intent types including arrays', () => {
    expect(extractProductProfileContext({ intent: ['bad'] })).toEqual({
      short_name: null,
      notes: null,
      intent: null,
      skills: [],
    });
    expect(extractProductProfileContext({ intent: 'bad' })).toEqual({
      short_name: null,
      notes: null,
      intent: null,
      skills: [],
    });
  });

  it('normalizes skills into a deduped id list', () => {
    expect(
      extractProductProfileContext({
        skills: [' unit_economics_first ', 'placement_modifier_review', 'unit_economics_first', '', null],
      })
    ).toEqual({
      short_name: null,
      notes: null,
      intent: null,
      skills: ['unit_economics_first', 'placement_modifier_review'],
    });
  });
});
