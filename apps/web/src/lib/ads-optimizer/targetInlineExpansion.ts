export const toggleExpandedTargetSnapshotId = (
  currentExpandedTargetSnapshotId: string | null,
  clickedTargetSnapshotId: string
) =>
  currentExpandedTargetSnapshotId === clickedTargetSnapshotId
    ? null
    : clickedTargetSnapshotId;

export const resolveVisibleExpandedTargetSnapshotId = (
  expandedTargetSnapshotId: string | null,
  visibleTargetSnapshotIds: readonly string[]
) =>
  expandedTargetSnapshotId !== null && visibleTargetSnapshotIds.includes(expandedTargetSnapshotId)
    ? expandedTargetSnapshotId
    : null;
