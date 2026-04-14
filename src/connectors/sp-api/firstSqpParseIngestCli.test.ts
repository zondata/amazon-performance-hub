import { describe, expect, it } from 'vitest';

import { parseSpApiSqpParseIngestCliArgs } from './firstSqpParseIngestCli';

describe('sp-api sqp parse+ingest cli', () => {
  it('rejects unknown arguments', () => {
    expect(() => parseSpApiSqpParseIngestCliArgs(['--unexpected'])).toThrowError(
      /Unknown CLI argument/
    );
  });

  it('requires either report id or raw path', () => {
    expect(() => parseSpApiSqpParseIngestCliArgs([])).toThrowError(
      /requires --report-id <value> or --raw-path <value>/
    );
  });

  it('accepts report-id and raw-path inputs', () => {
    expect(
      parseSpApiSqpParseIngestCliArgs([
        '--report-id',
        'sqp-123',
        '--raw-path',
        '/tmp/report-sqp-123.sqp.raw.csv',
      ])
    ).toEqual({
      reportId: 'sqp-123',
      rawFilePath: '/tmp/report-sqp-123.sqp.raw.csv',
    });
  });
});
