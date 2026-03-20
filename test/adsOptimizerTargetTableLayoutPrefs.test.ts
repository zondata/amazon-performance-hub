import { describe, expect, it } from 'vitest';

import {
  ADS_OPTIMIZER_TARGET_TABLE_LAYOUT_STORAGE_KEY,
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

    expect(ADS_OPTIMIZER_TARGET_TABLE_LAYOUT_STORAGE_KEY).toBe(
      'aph.adsOptimizerTargetsCollapsedTableLayout.v2'
    );
    expect(prefs.widths.target).toBe(340);
    expect(prefs.widths.state).toBe(280);
    expect(prefs.widths.economics).toBe(270);
    expect(prefs.widths.contribution).toBe(170);
    expect(prefs.widths.ranking).toBe(150);
    expect(prefs.widths.role).toBe(120);
    expect(prefs.widths.change_summary).toBe(200);
    expect(
      prefs.widths.target +
        prefs.widths.state +
        prefs.widths.economics +
        prefs.widths.contribution +
        prefs.widths.ranking +
        prefs.widths.role +
        prefs.widths.change_summary
    ).toBe(1530);
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
                  updateAdsOptimizerTargetTableColumnWidth(defaults, 'target', 480),
                  'state',
                  360
                ),
                'economics',
                340
              ),
              'contribution',
              260
            ),
            'ranking',
            220
          ),
          'role',
          180
        ),
        'change_summary',
        320
      ),
      'target'
    );

    const restored = parseAdsOptimizerTargetTableLayoutPrefs(
      serializeAdsOptimizerTargetTableLayoutPrefs(updated)
    );

    expect(restored.widths.target).toBe(480);
    expect(restored.widths.state).toBe(360);
    expect(restored.widths.economics).toBe(340);
    expect(restored.widths.contribution).toBe(260);
    expect(restored.widths.ranking).toBe(220);
    expect(restored.widths.role).toBe(180);
    expect(restored.widths.change_summary).toBe(320);
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

    expect(restored.widths.target).toBe(280);
    expect(restored.widths.ranking).toBe(260);
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

    expect(resized.widths.target).toBe(500);
    expect(getDefaultAdsOptimizerTargetTableLayoutPrefs()).toEqual(defaults);
  });
});
