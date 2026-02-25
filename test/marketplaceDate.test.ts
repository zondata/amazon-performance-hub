import { describe, expect, it } from 'vitest';

import {
  marketplaceToIanaTimeZone,
  toMarketplaceDate,
} from '../apps/web/src/lib/time/marketplaceDate';

describe('marketplaceDate helpers', () => {
  it('maps marketplace codes to expected IANA zones with UTC fallback', () => {
    expect(marketplaceToIanaTimeZone('US')).toBe('America/Los_Angeles');
    expect(marketplaceToIanaTimeZone('ca')).toBe('America/Toronto');
    expect(marketplaceToIanaTimeZone('DE')).toBe('Europe/Berlin');
    expect(marketplaceToIanaTimeZone('unknown')).toBe('UTC');
  });

  it('formats fixed UTC timestamps into marketplace-local YYYY-MM-DD', () => {
    const utc = new Date('2026-02-25T03:00:00Z');
    expect(toMarketplaceDate(utc, 'US')).toBe('2026-02-24');
    expect(toMarketplaceDate(utc, 'UK')).toBe('2026-02-25');
  });

  it('handles malaysia-vs-us scheduling example deterministically', () => {
    const utc = new Date('2026-02-25T08:00:00Z');
    expect(toMarketplaceDate(utc, 'US')).toBe('2026-02-25');
  });
});
