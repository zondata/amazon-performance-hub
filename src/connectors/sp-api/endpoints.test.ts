import { describe, expect, it } from 'vitest';

import { resolveSpApiEndpoint } from './endpoints';

describe('sp-api endpoint resolver', () => {
  it('returns the correct URL for each allowed region', () => {
    expect(resolveSpApiEndpoint('na')).toBe('https://sellingpartnerapi-na.amazon.com');
    expect(resolveSpApiEndpoint('eu')).toBe('https://sellingpartnerapi-eu.amazon.com');
    expect(resolveSpApiEndpoint('fe')).toBe('https://sellingpartnerapi-fe.amazon.com');
  });

  it('throws for unsupported input', () => {
    expect(() => resolveSpApiEndpoint('apac')).toThrowError(
      'Unsupported SP-API region: apac'
    );
  });
});
