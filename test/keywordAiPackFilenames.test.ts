import { describe, expect, it } from 'vitest';

import {
  buildKeywordAiPackFilename,
  sanitizeFileSegment,
} from '../apps/web/src/lib/keywords/keywordAiPackFilenames';

describe('sanitizeFileSegment', () => {
  it('normalizes spaces and removes unsupported characters', () => {
    expect(sanitizeFileSegment(' Core Terms / Feb ')).toBe('Core_Terms_Feb');
  });

  it('falls back when cleaned segment is empty', () => {
    expect(sanitizeFileSegment('!!!')).toBe('keyword_set');
  });
});

describe('buildKeywordAiPackFilename', () => {
  it('builds asin-only filename', () => {
    expect(
      buildKeywordAiPackFilename({
        asin: 'b0test1234',
      })
    ).toBe('B0TEST1234_keyword_ai_pack.md');
  });

  it('includes sanitized set name and keyword ai pack suffix', () => {
    expect(
      buildKeywordAiPackFilename({
        asin: 'B0TEST1234',
        setName: ' Core Terms / Feb ',
      })
    ).toBe('B0TEST1234_Core_Terms_Feb_keyword_ai_pack.md');
  });

  it('includes template suffix for non-formatting template ids', () => {
    expect(
      buildKeywordAiPackFilename({
        asin: 'B0TEST1234',
        setName: 'core',
        templateId: 'keyword_partner',
      })
    ).toBe('B0TEST1234_core_keyword_ai_pack_tmpl_keyword_partner.md');
  });
});
