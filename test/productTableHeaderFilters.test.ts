import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { matchesTableTextFilter } from '@/lib/tableTextFilters';

const rankingPath = path.join(
  process.cwd(),
  'apps/web/src/components/ranking/ProductRankingHeatmap.tsx'
);
const sqpPath = path.join(
  process.cwd(),
  'apps/web/src/components/sqp/ProductSqpTable.tsx'
);

const getInlineFiltersBlock = (source: string) => {
  const start = source.indexOf('<InlineFilters>');
  const end = source.indexOf('</InlineFilters>');
  if (start < 0 || end < 0) return '';
  return source.slice(start, end);
};

const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

describe('product table header filters', () => {
  it('moves ranking keyword search into the Keyword header and keeps raw plus normalized matching', () => {
    const source = fs.readFileSync(rankingPath, 'utf-8');
    const inlineFilters = getInlineFiltersBlock(source);
    const normalizedSource = collapseWhitespace(source);

    expect(inlineFilters).not.toMatch(/>\s*Search\s*</);
    expect(source).toContain('placeholder="Search keyword"');
    expect(source).toContain('aria-label="Search keyword"');
    expect(source).toContain('type="search"');
    expect(normalizedSource).toContain(
      'matchesTableTextFilter([entry.keywordRaw, entry.keywordNorm], keywordSearch)'
    );
    expect(matchesTableTextFilter(['Blue Widget Pro', 'blue widget pro'], 'widget pro')).toBe(
      true
    );
    expect(
      matchesTableTextFilter(['Display variant', 'normalized keyword value'], 'keyword value')
    ).toBe(true);
    expect(source).toContain('No result');
  });

  it('moves SQP query search and group filter into the relevant headers', () => {
    const source = fs.readFileSync(sqpPath, 'utf-8');
    const inlineFilters = getInlineFiltersBlock(source);
    const normalizedSource = collapseWhitespace(source);

    expect(inlineFilters).not.toMatch(/>\s*Search\s*</);
    expect(inlineFilters).not.toMatch(/>\s*Group\s*</);
    expect(source).toContain('placeholder="Search query"');
    expect(source).toContain('aria-label="Search query"');
    expect(source).toContain('aria-label="Filter groups"');
    expect(normalizedSource).toMatch(
      /matchesTableTextFilter\(\s*\[row\.search_query_raw,\s*row\.search_query_norm\],\s*keywordSearch\s*\)/
    );
    expect(
      matchesTableTextFilter(['Displayed query', 'normalized query value'], 'displayed')
    ).toBe(true);
    expect(
      matchesTableTextFilter(['Displayed query', 'normalized query value'], 'query value')
    ).toBe(true);
    expect(source).toContain('showGroupColumn ? (');
    expect(source).toContain('No result');
  });
});
