import { describe, expect, it } from 'vitest';

import { parseFirstSqpRealPullCliArgs } from './firstSqpRealPullCli';

describe('sp-api sqp first real pull cli', () => {
  it('rejects unknown arguments', () => {
    expect(() => parseFirstSqpRealPullCliArgs(['--unexpected'])).toThrowError(
      /Unknown CLI argument/
    );
  });

  it('requires the bounded asin and week window inputs', () => {
    expect(() => parseFirstSqpRealPullCliArgs(['--asin', 'B0TESTA123'])).toThrowError(
      /requires --asin <value> --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD>/
    );
  });

  it('accepts the bounded asin/week inputs and optional polling controls', () => {
    expect(
      parseFirstSqpRealPullCliArgs([
        '--asin',
        'B0TESTA123',
        '--start-date',
        '2026-02-01',
        '--end-date',
        '2026-02-07',
        '--max-attempts',
        '5',
        '--poll-interval-ms=1000',
      ])
    ).toEqual({
      asin: 'B0TESTA123',
      startDate: '2026-02-01',
      endDate: '2026-02-07',
      maxAttempts: 5,
      pollIntervalMs: 1000,
    });
  });
});
