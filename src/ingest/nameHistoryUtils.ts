import { addDaysUtc } from "./utils";

export type NameRow = {
  entityId: string;
  nameRaw: string;
  nameNorm: string;
};

export type OpenHistoryRow = {
  entityId: string;
  nameRaw: string;
  nameNorm: string;
  validFrom: string;
};

export type HistoryUpdatePlan = {
  toInsert: { entityId: string; nameRaw: string; nameNorm: string; validFrom: string }[];
  toClose: { entityId: string; validFrom: string; validTo: string }[];
};

export function planNameHistoryUpdates(
  current: NameRow[],
  openRows: OpenHistoryRow[],
  snapshotDate: string
): HistoryUpdatePlan {
  const openById = new Map<string, OpenHistoryRow>();
  for (const row of openRows) {
    if (!openById.has(row.entityId)) openById.set(row.entityId, row);
  }

  const toInsert: HistoryUpdatePlan["toInsert"] = [];
  const toClose: HistoryUpdatePlan["toClose"] = [];

  for (const row of current) {
    if (!row.entityId) continue;
    const open = openById.get(row.entityId);
    if (!open) {
      toInsert.push({
        entityId: row.entityId,
        nameRaw: row.nameRaw,
        nameNorm: row.nameNorm,
        validFrom: snapshotDate,
      });
      continue;
    }
    if (open.nameNorm !== row.nameNorm) {
      toClose.push({
        entityId: row.entityId,
        validFrom: open.validFrom,
        validTo: addDaysUtc(snapshotDate, -1),
      });
      toInsert.push({
        entityId: row.entityId,
        nameRaw: row.nameRaw,
        nameNorm: row.nameNorm,
        validFrom: snapshotDate,
      });
    }
  }

  return { toInsert, toClose };
}
