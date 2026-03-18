import { describe, expect, it } from 'vitest';

import {
  resolveVisibleExpandedTargetSnapshotId,
  toggleExpandedTargetSnapshotId,
} from '@/lib/ads-optimizer/targetInlineExpansion';

describe('ads optimizer target inline expansion state', () => {
  it('expands a row when no row is currently expanded', () => {
    expect(toggleExpandedTargetSnapshotId(null, 'target-1')).toBe('target-1');
  });

  it('collapses the same row when its header is clicked again', () => {
    expect(toggleExpandedTargetSnapshotId('target-1', 'target-1')).toBeNull();
  });

  it('switches expansion when a different row is clicked', () => {
    expect(toggleExpandedTargetSnapshotId('target-1', 'target-2')).toBe('target-2');
  });

  it('keeps the expanded row anchored to its id across sort and filter changes', () => {
    expect(
      resolveVisibleExpandedTargetSnapshotId('target-2', ['target-3', 'target-2', 'target-1'])
    ).toBe('target-2');
    expect(resolveVisibleExpandedTargetSnapshotId('target-2', ['target-3', 'target-1'])).toBeNull();
    expect(resolveVisibleExpandedTargetSnapshotId('target-2', ['target-1', 'target-2'])).toBe(
      'target-2'
    );
  });
});
