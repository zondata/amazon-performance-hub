import { describe, expect, it } from 'vitest';

import { intentToUi, uiToIntent } from '../apps/web/src/lib/products/productIntentUiModel';

describe('intentToUi', () => {
  it('maps summary with goal/text fallback priority', () => {
    expect(intentToUi({ goal: 'Protect rank', text: 'Fallback text' }).summary).toBe('Protect rank');
    expect(intentToUi({ text: 'Use this text' }).summary).toBe('Use this text');
    expect(intentToUi({ summary: 'Primary summary', goal: 'ignored' }).summary).toBe('Primary summary');
  });

  it('joins constraints and avoid arrays into line-delimited strings', () => {
    const result = intentToUi({
      constraints: ['acos <= 0.35', 'cpc <= 1.25'],
      do_not: ['raise bids on low intent'],
    });

    expect(result.constraints).toBe('acos <= 0.35\ncpc <= 1.25');
    expect(result.avoid).toBe('raise bids on low intent');
  });
});

describe('uiToIntent', () => {
  it('preserves unknown keys while updating known intent fields', () => {
    const result = uiToIntent(
      {
        summary: 'Keep rank stable',
        constraints: 'acos <= 0.30',
        avoid: 'pause branded exact',
        notes: 'Watch weekend volatility',
      },
      {
        foo: 'bar',
        do_not: ['legacy preserved'],
      }
    );

    expect(result).toEqual({
      foo: 'bar',
      do_not: ['legacy preserved'],
      summary: 'Keep rank stable',
      constraints: ['acos <= 0.30'],
      avoid: ['pause branded exact'],
      notes: 'Watch weekend volatility',
    });
  });

  it('deletes blank known keys and returns null when no keys remain', () => {
    expect(
      uiToIntent(
        {
          summary: '   ',
          constraints: '   \n  ',
          avoid: '',
          notes: '   ',
        },
        {
          summary: 'old',
          constraints: ['old constraint'],
          avoid: ['old avoid'],
          notes: 'old notes',
        }
      )
    ).toBeNull();
  });
});
