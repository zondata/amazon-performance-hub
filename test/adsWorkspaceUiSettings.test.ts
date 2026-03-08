import { describe, expect, it } from 'vitest';

import {
  normalizeAdsWorkspaceSurfaceSettings,
  normalizeAdsWorkspaceUiSettings,
} from '../apps/web/src/lib/ads-workspace/adsWorkspaceUiSettings';

describe('normalizeAdsWorkspaceSurfaceSettings', () => {
  const columnKeys = ['campaign_name', 'status', 'spend', 'actions'];

  it('seeds default frozen columns only when no saved frozen state exists', () => {
    expect(
      normalizeAdsWorkspaceSurfaceSettings({
        raw: {},
        columnKeys,
        defaultFrozenColumns: ['campaign_name', 'status'],
      })
    ).toEqual({
      columnOrder: ['campaign_name', 'status', 'spend', 'actions'],
      hiddenColumns: [],
      frozenColumns: ['campaign_name', 'status'],
      wrapLongLabels: false,
      fontSize: 'default',
    });
  });

  it('preserves an explicit unfreeze action instead of silently restoring defaults', () => {
    expect(
      normalizeAdsWorkspaceSurfaceSettings({
        raw: {
          columnOrder: ['status', 'campaign_name', 'spend', 'actions'],
          frozenColumns: [],
          hiddenColumns: ['spend'],
          wrapLongLabels: true,
          fontSize: 'comfortable',
        },
        columnKeys,
        defaultFrozenColumns: ['campaign_name', 'status'],
      })
    ).toEqual({
      columnOrder: ['status', 'campaign_name', 'spend', 'actions'],
      hiddenColumns: ['spend'],
      frozenColumns: [],
      wrapLongLabels: true,
      fontSize: 'comfortable',
    });
  });
});

describe('normalizeAdsWorkspaceUiSettings', () => {
  it('keeps only known table surfaces', () => {
    expect(
      normalizeAdsWorkspaceUiSettings({
        surfaces: {
          'table:campaigns': {
            columnOrder: ['campaign_name'],
            hiddenColumns: [],
            frozenColumns: ['campaign_name'],
            wrapLongLabels: true,
            fontSize: 'compact',
          },
          'trend:campaigns': {
            columnOrder: ['ignored'],
            hiddenColumns: [],
            frozenColumns: [],
            wrapLongLabels: false,
            fontSize: 'default',
          },
        },
      })
    ).toEqual({
      surfaces: {
        'table:campaigns': {
          columnOrder: ['campaign_name'],
          hiddenColumns: [],
          frozenColumns: ['campaign_name'],
          wrapLongLabels: true,
          fontSize: 'compact',
        },
      },
    });
  });
});
