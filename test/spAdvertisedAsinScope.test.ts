import { describe, expect, it } from 'vitest';

import {
  normalizeSpAdvertisedAsin,
  resolveAdvertisedAsinSetForEntity,
} from '../apps/web/src/lib/ads/spAdvertisedAsinScope';

describe('normalizeSpAdvertisedAsin', () => {
  it('normalizes to uppercase for the SP advertised-product facts contract', () => {
    expect(normalizeSpAdvertisedAsin(' b0abc12345 ')).toBe('B0ABC12345');
    expect(normalizeSpAdvertisedAsin('')).toBeNull();
  });
});

describe('resolveAdvertisedAsinSetForEntity', () => {
  it('falls back from ad-group lookup to campaign lookup when ad-group coverage is missing', () => {
    const result = resolveAdvertisedAsinSetForEntity({
      adGroupId: 'ag-missing',
      campaignId: 'c1',
      asinByAdGroup: new Map([['ag-other', new Set(['B0AAA11111'])]]),
      asinByCampaign: new Map([['c1', new Set(['B0ABC12345'])]]),
    });

    expect(result ? [...result] : []).toEqual(['B0ABC12345']);
  });

  it('prefers ad-group coverage when it exists', () => {
    const result = resolveAdvertisedAsinSetForEntity({
      adGroupId: 'ag1',
      campaignId: 'c1',
      asinByAdGroup: new Map([['ag1', new Set(['B0ADGROUP1'])]]),
      asinByCampaign: new Map([['c1', new Set(['B0CAMPAIGN'])]]),
    });

    expect(result ? [...result] : []).toEqual(['B0ADGROUP1']);
  });
});
