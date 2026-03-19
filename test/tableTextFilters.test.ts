import { describe, expect, it } from 'vitest';

import {
  hasActiveTableTextFilter,
  matchesTableTextFilter,
  normalizeTableTextFilter,
} from '@/lib/tableTextFilters';

describe('tableTextFilters', () => {
  it('trims outer spaces, lowercases, and collapses internal whitespace', () => {
    expect(normalizeTableTextFilter('  Sponsored   Products\tCampaign  ')).toBe(
      'sponsored products campaign'
    );
  });

  it('treats empty normalized input as inactive', () => {
    expect(normalizeTableTextFilter('   \n\t  ')).toBe('');
    expect(hasActiveTableTextFilter('   \n\t  ')).toBe(false);
    expect(matchesTableTextFilter('Campaign Alpha', '   \n\t  ')).toBe(true);
  });

  it('does not match nullish sources against a non-empty filter', () => {
    expect(matchesTableTextFilter(null, 'alpha')).toBe(false);
    expect(matchesTableTextFilter(undefined, 'alpha')).toBe(false);
  });

  it('matches any provided source value with case-insensitive substring semantics', () => {
    expect(
      matchesTableTextFilter(
        ['Blue Widget Pro', 'blue widget professional'],
        '  WIDGET   PRO '
      )
    ).toBe(true);
    expect(
      matchesTableTextFilter(
        ['Displayed term', 'normalized query variant'],
        'query variant'
      )
    ).toBe(true);
    expect(matchesTableTextFilter(['Campaign Alpha', 'campaign alpha'], 'beta')).toBe(
      false
    );
  });
});
