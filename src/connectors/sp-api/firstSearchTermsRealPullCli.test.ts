import { describe, expect, it } from 'vitest';

import { parseFirstSearchTermsRealPullCliArgs } from './firstSearchTermsRealPullCli';

describe('sp-api Search Terms first real pull cli', () => {
  it('rejects unknown arguments', () => {
    expect(() => parseFirstSearchTermsRealPullCliArgs(['--unexpected'])).toThrowError(
      /Unknown CLI argument/
    );
  });

  it('requires the bounded marketplace week inputs', () => {
    expect(() =>
      parseFirstSearchTermsRealPullCliArgs(['--start-date', '2026-04-05'])
    ).toThrowError(/requires --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD>/);
  });

  it('accepts the bounded marketplace/week inputs and optional polling controls', () => {
    expect(
      parseFirstSearchTermsRealPullCliArgs([
        '--marketplace-id',
        'ATVPDKIKX0DER',
        '--start-date',
        '2026-04-05',
        '--end-date',
        '2026-04-11',
        '--max-attempts',
        '5',
        '--poll-interval-ms=1000',
      ])
    ).toEqual({
      marketplaceId: 'ATVPDKIKX0DER',
      startDate: '2026-04-05',
      endDate: '2026-04-11',
      maxAttempts: 5,
      pollIntervalMs: 1000,
    });
  });
});
