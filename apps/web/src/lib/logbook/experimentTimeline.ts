const INTERRUPTION_TYPES = new Set([
  'manual_intervention',
  'guardrail_breach',
  'stop_loss',
  'rollback',
]);

export const isInterruptionChange = (change_type: string): boolean =>
  INTERRUPTION_TYPES.has(change_type);

export const pickMajorActions = (
  changes: Array<{ change_id: string; occurred_at: string; change_type: string }>,
  limit: number
): { major: string[]; interruption_ids: string[] } => {
  const sorted = [...changes].sort((a, b) => {
    const occurredCompare = b.occurred_at.localeCompare(a.occurred_at);
    if (occurredCompare !== 0) return occurredCompare;
    return a.change_id.localeCompare(b.change_id);
  });

  const interruptionIds: string[] = [];
  const interruptionSeen = new Set<string>();
  for (const change of sorted) {
    if (!isInterruptionChange(change.change_type)) continue;
    if (interruptionSeen.has(change.change_id)) continue;
    interruptionSeen.add(change.change_id);
    interruptionIds.push(change.change_id);
  }

  const normalizedLimit = Math.max(0, Math.floor(limit));
  const major: string[] = [];
  const majorSeen = new Set<string>();
  const pushMajor = (changeId: string) => {
    if (majorSeen.has(changeId)) return;
    majorSeen.add(changeId);
    major.push(changeId);
  };

  for (const change of sorted.slice(0, normalizedLimit)) {
    pushMajor(change.change_id);
  }

  for (const changeId of interruptionIds) {
    pushMajor(changeId);
  }

  return {
    major,
    interruption_ids: interruptionIds,
  };
};
