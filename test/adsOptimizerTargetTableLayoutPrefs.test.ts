import { describe, expect, it } from 'vitest';

import {
  applyAdsOptimizerTargetTableColumnResizeDelta,
  getDefaultAdsOptimizerTargetTableLayoutPrefs,
  parseAdsOptimizerTargetTableLayoutPrefs,
  serializeAdsOptimizerTargetTableLayoutPrefs,
  toggleAdsOptimizerTargetTableFrozenColumn,
  updateAdsOptimizerTargetTableColumnWidth,
} from '../apps/web/src/lib/ads-optimizer/targetTableLayoutPrefs';

describe('ads optimizer target table layout prefs', () => {
  it('uses stable defaults for widths and target freeze state', () => {
    const prefs = getDefaultAdsOptimizerTargetTableLayoutPrefs();

    expect(prefs.widths.target).toBeGreaterThan(0);
    expect(prefs.widths.state).toBeGreaterThan(0);
    expect(prefs.widths.economics).toBeGreaterThan(0);
    expect(prefs.widths.contribution).toBeGreaterThan(0);
    expect(prefs.widths.ranking).toBeGreaterThan(0);
    expect(prefs.widths.role).toBeGreaterThan(0);
    expect(prefs.widths.change_summary).toBeGreaterThan(0);
    expect(prefs.frozenColumns).toEqual(['target']);
  });

  it('round-trips persisted widths for all columns across reload-style parsing', () => {
    const defaults = getDefaultAdsOptimizerTargetTableLayoutPrefs();
    const updated = toggleAdsOptimizerTargetTableFrozenColumn(
      updateAdsOptimizerTargetTableColumnWidth(
        updateAdsOptimizerTargetTableColumnWidth(
          updateAdsOptimizerTargetTableColumnWidth(
            updateAdsOptimizerTargetTableColumnWidth(
              updateAdsOptimizerTargetTableColumnWidth(
                updateAdsOptimizerTargetTableColumnWidth(
                  updateAdsOptimizerTargetTableColumnWidth(defaults, 'target', 560),
                  'state',
                  408
                ),
                'economics',
                392
              ),
              'contribution',
              280
            ),
            'ranking',
            296
          ),
          'role',
          224
        ),
        'change_summary',
        376
      ),
      'target'
    );

    const restored = parseAdsOptimizerTargetTableLayoutPrefs(
      serializeAdsOptimizerTargetTableLayoutPrefs(updated)
    );

    expect(restored.widths.target).toBe(560);
    expect(restored.widths.state).toBe(408);
    expect(restored.widths.economics).toBe(392);
    expect(restored.widths.contribution).toBe(280);
    expect(restored.widths.ranking).toBe(296);
    expect(restored.widths.role).toBe(224);
    expect(restored.widths.change_summary).toBe(376);
    expect(restored.frozenColumns).toEqual([]);
  });

  it('applies resize drag deltas to the correct column key only', () => {
    const defaults = getDefaultAdsOptimizerTargetTableLayoutPrefs();
    const resized = applyAdsOptimizerTargetTableColumnResizeDelta(
      defaults,
      'state',
      defaults.widths.state,
      64
    );

    expect(resized.widths.state).toBe(defaults.widths.state + 64);
    expect(resized.widths.target).toBe(defaults.widths.target);
    expect(resized.widths.economics).toBe(defaults.widths.economics);
    expect(resized.widths.contribution).toBe(defaults.widths.contribution);
    expect(resized.widths.ranking).toBe(defaults.widths.ranking);
    expect(resized.widths.role).toBe(defaults.widths.role);
    expect(resized.widths.change_summary).toBe(defaults.widths.change_summary);
  });

  it('falls back to defaults when persisted data is missing or invalid', () => {
    const restored = parseAdsOptimizerTargetTableLayoutPrefs(
      JSON.stringify({
        widths: {
          target: 20,
          ranking: 9999,
        },
        frozenColumns: ['target', 'ranking', 'unknown'],
      })
    );

    expect(restored.widths.target).toBeGreaterThan(20);
    expect(restored.widths.ranking).toBeLessThan(9999);
    expect(restored.frozenColumns).toEqual(['target']);
    expect(parseAdsOptimizerTargetTableLayoutPrefs('{bad json')).toEqual(
      getDefaultAdsOptimizerTargetTableLayoutPrefs()
    );
  });

  it('keeps default widths available as the reset baseline', () => {
    const defaults = getDefaultAdsOptimizerTargetTableLayoutPrefs();
    const resized = updateAdsOptimizerTargetTableColumnWidth(
      defaults,
          'target',
          560
    );

    expect(resized.widths.target).toBe(560);
    expect(getDefaultAdsOptimizerTargetTableLayoutPrefs()).toEqual(defaults);
  });
});
