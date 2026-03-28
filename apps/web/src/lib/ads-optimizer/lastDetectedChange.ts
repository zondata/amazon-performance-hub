import 'server-only';

import { env } from '@/lib/env';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type AdsOptimizerLastDetectedChangeKind =
  | 'target_bid'
  | 'target_state'
  | 'campaign_bidding_strategy'
  | 'placement_modifier';

export type AdsOptimizerLastDetectedChangeDeltaDirection = 'positive' | 'negative' | null;

export type AdsOptimizerLastDetectedChangeItem = {
  key: string;
  kind: AdsOptimizerLastDetectedChangeKind;
  label: 'Bid' | 'State' | 'Strategy' | 'TOS modifier' | 'ROS modifier' | 'PP modifier';
  previousDisplay: string;
  currentDisplay: string;
  deltaPercentLabel: string | null;
  deltaDirection: AdsOptimizerLastDetectedChangeDeltaDirection;
};

export type AdsOptimizerLastDetectedChange = {
  detectedDate: string | null;
  items: AdsOptimizerLastDetectedChangeItem[];
  overflowCount: number;
  emptyMessage: string | null;
};

export type AdsOptimizerLastDetectedChangeRowRef = {
  targetSnapshotId: string;
  targetId: string;
  campaignId: string;
};

type BulkTargetHistoryRow = {
  target_id: string;
  snapshot_date: string;
  bid: number | string | null;
  state: string | null;
};

type BulkCampaignHistoryRow = {
  campaign_id: string;
  snapshot_date: string;
  bidding_strategy: string | null;
};

type PlacementModifierChangeLogRow = {
  campaign_id: string;
  snapshot_date: string;
  placement_code: string;
  old_pct: number | string | null;
  new_pct: number | string | null;
};

type BulkPlacementHistoryRow = {
  campaign_id: string;
  snapshot_date: string;
  placement_code: string;
  percentage: number | string | null;
};

type DetectedScalarChange<T> = {
  detectedDate: string;
  previousValue: T;
  currentValue: T;
};

type DetectedChangeEvent = AdsOptimizerLastDetectedChangeItem & {
  detectedDate: string;
  sortOrder: number;
};

const CHANGE_ITEM_ORDER: Record<AdsOptimizerLastDetectedChangeItem['label'], number> = {
  Bid: 1,
  State: 2,
  'TOS modifier': 3,
  'ROS modifier': 4,
  'PP modifier': 5,
  Strategy: 6,
};

const PLACEMENT_LABELS = {
  PLACEMENT_TOP: 'TOS modifier',
  PLACEMENT_REST_OF_SEARCH: 'ROS modifier',
  PLACEMENT_PRODUCT_PAGE: 'PP modifier',
} as const;

const EMPTY_LAST_DETECTED_CHANGE: AdsOptimizerLastDetectedChange = {
  detectedDate: null,
  items: [],
  overflowCount: 0,
  emptyMessage: 'No detected tracked change',
};

export const createEmptyAdsOptimizerLastDetectedChange =
  (): AdsOptimizerLastDetectedChange => ({
    ...EMPTY_LAST_DETECTED_CHANGE,
    items: [],
  });

const toFiniteNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeString = (value: string | null | undefined) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : null;
};

const valuesEqual = (
  left: number | string | null | undefined,
  right: number | string | null | undefined,
  kind: 'numeric' | 'string'
) => {
  if (kind === 'numeric') {
    const leftNumber = toFiniteNumber(left);
    const rightNumber = toFiniteNumber(right);
    if (leftNumber === null && rightNumber === null) return true;
    if (leftNumber === null || rightNumber === null) return false;
    return leftNumber === rightNumber;
  }

  const leftString = normalizeString(typeof left === 'string' ? left : null);
  const rightString = normalizeString(typeof right === 'string' ? right : null);
  if (leftString === null && rightString === null) return true;
  if (leftString === null || rightString === null) return false;
  return leftString === rightString;
};

const formatCurrency = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return 'Not captured';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  });
};

const formatWholePercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return 'Not captured';
  const digits = Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)}%`;
};

const formatStoredString = (value: string | null) => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : 'Not captured';
};

const formatDeltaPercentLabel = (previous: number | null, current: number | null) => {
  if (
    previous === null ||
    current === null ||
    !Number.isFinite(previous) ||
    !Number.isFinite(current) ||
    previous === 0
  ) {
    return { label: null, direction: null as AdsOptimizerLastDetectedChangeDeltaDirection };
  }

  const rawDeltaPercent = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(rawDeltaPercent * 10) / 10;
  const digits = Number.isInteger(rounded) ? 0 : 1;

  return {
    label: `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}%`,
    direction:
      rawDeltaPercent > 0 ? ('positive' as const) : rawDeltaPercent < 0 ? ('negative' as const) : null,
  };
};

const detectLatestChangeFromDescendingHistory = <TRow, TValue>(args: {
  rows: TRow[];
  getDate: (row: TRow) => string;
  getValue: (row: TRow) => TValue;
  equals: (left: TValue, right: TValue) => boolean;
}): DetectedScalarChange<TValue> | null => {
  for (let index = 0; index < args.rows.length - 1; index += 1) {
    const currentRow = args.rows[index]!;
    const previousRow = args.rows[index + 1]!;
    const currentValue = args.getValue(currentRow);
    const previousValue = args.getValue(previousRow);

    if (!args.equals(currentValue, previousValue)) {
      return {
        detectedDate: args.getDate(currentRow),
        previousValue,
        currentValue,
      };
    }
  }

  return null;
};

const buildBidEvent = (
  targetId: string,
  change: DetectedScalarChange<number | null>
): DetectedChangeEvent => {
  const delta = formatDeltaPercentLabel(change.previousValue, change.currentValue);
  return {
    key: `target_bid:${targetId}:${change.detectedDate}`,
    kind: 'target_bid',
    label: 'Bid',
    previousDisplay: formatCurrency(change.previousValue),
    currentDisplay: formatCurrency(change.currentValue),
    deltaPercentLabel: delta.label,
    deltaDirection: delta.direction,
    detectedDate: change.detectedDate,
    sortOrder: CHANGE_ITEM_ORDER.Bid,
  };
};

const buildStateEvent = (
  targetId: string,
  change: DetectedScalarChange<string | null>
): DetectedChangeEvent => ({
  key: `target_state:${targetId}:${change.detectedDate}`,
  kind: 'target_state',
  label: 'State',
  previousDisplay: formatStoredString(change.previousValue),
  currentDisplay: formatStoredString(change.currentValue),
  deltaPercentLabel: null,
  deltaDirection: null,
  detectedDate: change.detectedDate,
  sortOrder: CHANGE_ITEM_ORDER.State,
});

const buildStrategyEvent = (
  campaignId: string,
  change: DetectedScalarChange<string | null>
): DetectedChangeEvent => ({
  key: `campaign_bidding_strategy:${campaignId}:${change.detectedDate}`,
  kind: 'campaign_bidding_strategy',
  label: 'Strategy',
  previousDisplay: formatStoredString(change.previousValue),
  currentDisplay: formatStoredString(change.currentValue),
  deltaPercentLabel: null,
  deltaDirection: null,
  detectedDate: change.detectedDate,
  sortOrder: CHANGE_ITEM_ORDER.Strategy,
});

const buildPlacementEvent = (args: {
  campaignId: string;
  placementCode: keyof typeof PLACEMENT_LABELS;
  detectedDate: string;
  previousValue: number | null;
  currentValue: number | null;
}): DetectedChangeEvent => {
  const delta = formatDeltaPercentLabel(args.previousValue, args.currentValue);
  const label = PLACEMENT_LABELS[args.placementCode];

  return {
    key: `placement_modifier:${args.campaignId}:${args.placementCode}:${args.detectedDate}`,
    kind: 'placement_modifier',
    label,
    previousDisplay: formatWholePercent(args.previousValue),
    currentDisplay: formatWholePercent(args.currentValue),
    deltaPercentLabel: delta.label,
    deltaDirection: delta.direction,
    detectedDate: args.detectedDate,
    sortOrder: CHANGE_ITEM_ORDER[label],
  };
};

const buildTargetEventMaps = (rows: BulkTargetHistoryRow[]) => {
  const rowsByTargetId = new Map<string, BulkTargetHistoryRow[]>();

  rows.forEach((row) => {
    const bucket = rowsByTargetId.get(row.target_id) ?? [];
    bucket.push(row);
    rowsByTargetId.set(row.target_id, bucket);
  });

  const bidEvents = new Map<string, DetectedChangeEvent>();
  const stateEvents = new Map<string, DetectedChangeEvent>();

  rowsByTargetId.forEach((historyRows, targetId) => {
    const sortedRows = [...historyRows].sort((left, right) =>
      right.snapshot_date.localeCompare(left.snapshot_date)
    );
    const bidChange = detectLatestChangeFromDescendingHistory({
      rows: sortedRows,
      getDate: (row) => row.snapshot_date,
      getValue: (row) => toFiniteNumber(row.bid),
      equals: (left, right) => valuesEqual(left, right, 'numeric'),
    });
    const stateChange = detectLatestChangeFromDescendingHistory({
      rows: sortedRows,
      getDate: (row) => row.snapshot_date,
      getValue: (row) => row.state,
      equals: (left, right) => valuesEqual(left, right, 'string'),
    });

    if (bidChange) {
      bidEvents.set(targetId, buildBidEvent(targetId, bidChange));
    }
    if (stateChange) {
      stateEvents.set(targetId, buildStateEvent(targetId, stateChange));
    }
  });

  return {
    bidEvents,
    stateEvents,
  };
};

const buildStrategyEventMap = (rows: BulkCampaignHistoryRow[]) => {
  const rowsByCampaignId = new Map<string, BulkCampaignHistoryRow[]>();

  rows.forEach((row) => {
    const bucket = rowsByCampaignId.get(row.campaign_id) ?? [];
    bucket.push(row);
    rowsByCampaignId.set(row.campaign_id, bucket);
  });

  const events = new Map<string, DetectedChangeEvent>();

  rowsByCampaignId.forEach((historyRows, campaignId) => {
    const sortedRows = [...historyRows].sort((left, right) =>
      right.snapshot_date.localeCompare(left.snapshot_date)
    );
    const strategyChange = detectLatestChangeFromDescendingHistory({
      rows: sortedRows,
      getDate: (row) => row.snapshot_date,
      getValue: (row) => row.bidding_strategy,
      equals: (left, right) => valuesEqual(left, right, 'string'),
    });

    if (strategyChange) {
      events.set(campaignId, buildStrategyEvent(campaignId, strategyChange));
    }
  });

  return events;
};

const buildPlacementEventMap = (args: {
  changeLogRows: PlacementModifierChangeLogRow[];
  bulkPlacementRows: BulkPlacementHistoryRow[];
}) => {
  const authoritativePairs = new Set(
    args.changeLogRows.map((row) => `${row.campaign_id}::${row.placement_code}`)
  );
  const events = new Map<string, DetectedChangeEvent>();

  args.changeLogRows
    .filter(
      (row): row is PlacementModifierChangeLogRow & { placement_code: keyof typeof PLACEMENT_LABELS } =>
        row.placement_code in PLACEMENT_LABELS
    )
    .sort((left, right) => right.snapshot_date.localeCompare(left.snapshot_date))
    .forEach((row) => {
      const key = `${row.campaign_id}::${row.placement_code}`;
      if (events.has(key)) return;
      events.set(
        key,
        buildPlacementEvent({
          campaignId: row.campaign_id,
          placementCode: row.placement_code,
          detectedDate: row.snapshot_date,
          previousValue: toFiniteNumber(row.old_pct),
          currentValue: toFiniteNumber(row.new_pct),
        })
      );
    });

  const rowsByPair = new Map<string, BulkPlacementHistoryRow[]>();

  args.bulkPlacementRows
    .filter(
      (row): row is BulkPlacementHistoryRow & { placement_code: keyof typeof PLACEMENT_LABELS } =>
        row.placement_code in PLACEMENT_LABELS &&
        !authoritativePairs.has(`${row.campaign_id}::${row.placement_code}`)
    )
    .forEach((row) => {
      const key = `${row.campaign_id}::${row.placement_code}`;
      const bucket = rowsByPair.get(key) ?? [];
      bucket.push(row);
      rowsByPair.set(key, bucket);
    });

  rowsByPair.forEach((historyRows, key) => {
    if (events.has(key)) return;
    const sortedRows = [...historyRows].sort((left, right) =>
      right.snapshot_date.localeCompare(left.snapshot_date)
    );
    const placementChange = detectLatestChangeFromDescendingHistory({
      rows: sortedRows,
      getDate: (row) => row.snapshot_date,
      getValue: (row) => toFiniteNumber(row.percentage),
      equals: (left, right) => valuesEqual(left, right, 'numeric'),
    });

    if (!placementChange) return;

    const [campaignId, placementCode] = key.split('::') as [
      string,
      keyof typeof PLACEMENT_LABELS,
    ];
    events.set(
      key,
      buildPlacementEvent({
        campaignId,
        placementCode,
        detectedDate: placementChange.detectedDate,
        previousValue: placementChange.previousValue,
        currentValue: placementChange.currentValue,
      })
    );
  });

  return events;
};

export const buildAdsOptimizerLastDetectedChangesForTargets = (args: {
  rows: AdsOptimizerLastDetectedChangeRowRef[];
  bulkTargetRows: BulkTargetHistoryRow[];
  bulkCampaignRows: BulkCampaignHistoryRow[];
  placementChangeLogRows: PlacementModifierChangeLogRow[];
  bulkPlacementRows: BulkPlacementHistoryRow[];
}): Map<string, AdsOptimizerLastDetectedChange> => {
  const { bidEvents, stateEvents } = buildTargetEventMaps(args.bulkTargetRows);
  const strategyEvents = buildStrategyEventMap(args.bulkCampaignRows);
  const placementEvents = buildPlacementEventMap({
    changeLogRows: args.placementChangeLogRows,
    bulkPlacementRows: args.bulkPlacementRows,
  });

  return new Map(
    args.rows.map((row) => {
      const rowEvents = [
        bidEvents.get(row.targetId) ?? null,
        stateEvents.get(row.targetId) ?? null,
        placementEvents.get(`${row.campaignId}::PLACEMENT_TOP`) ?? null,
        placementEvents.get(`${row.campaignId}::PLACEMENT_REST_OF_SEARCH`) ?? null,
        placementEvents.get(`${row.campaignId}::PLACEMENT_PRODUCT_PAGE`) ?? null,
        strategyEvents.get(row.campaignId) ?? null,
      ].filter((event): event is DetectedChangeEvent => event !== null);

      if (rowEvents.length === 0) {
        return [row.targetSnapshotId, createEmptyAdsOptimizerLastDetectedChange()] as const;
      }

      const latestDetectedDate = rowEvents.reduce(
        (maxDate, event) => (event.detectedDate > maxDate ? event.detectedDate : maxDate),
        rowEvents[0]!.detectedDate
      );
      const latestItems = rowEvents
        .filter((event) => event.detectedDate === latestDetectedDate)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.key.localeCompare(right.key))
        .map<AdsOptimizerLastDetectedChangeItem>((event) => ({
          key: event.key,
          kind: event.kind,
          label: event.label,
          previousDisplay: event.previousDisplay,
          currentDisplay: event.currentDisplay,
          deltaPercentLabel: event.deltaPercentLabel,
          deltaDirection: event.deltaDirection,
        }));

      return [
        row.targetSnapshotId,
        {
          detectedDate: latestDetectedDate,
          items: latestItems,
          overflowCount: Math.max(0, latestItems.length - 2),
          emptyMessage: null,
        },
      ] as const;
    })
  );
};

export const loadAdsOptimizerLastDetectedChangesForTargets = async (
  rows: AdsOptimizerLastDetectedChangeRowRef[]
): Promise<Map<string, AdsOptimizerLastDetectedChange>> => {
  const filteredRows = rows.filter(
    (row) => row.targetSnapshotId && row.targetId && row.campaignId
  );
  if (filteredRows.length === 0) {
    return new Map();
  }

  const targetIds = [...new Set(filteredRows.map((row) => row.targetId))];
  const campaignIds = [...new Set(filteredRows.map((row) => row.campaignId))];

  const bulkTargetQuery = supabaseAdmin
    .from('bulk_targets')
    .select('snapshot_date,target_id,bid,state')
    .eq('account_id', env.accountId)
    .in('target_id', targetIds)
    .order('target_id', { ascending: true })
    .order('snapshot_date', { ascending: false });

  const bulkCampaignQuery = supabaseAdmin
    .from('bulk_campaigns')
    .select('snapshot_date,campaign_id,bidding_strategy')
    .eq('account_id', env.accountId)
    .in('campaign_id', campaignIds)
    .order('campaign_id', { ascending: true })
    .order('snapshot_date', { ascending: false });

  const placementChangeLogQuery = supabaseAdmin
    .from('sp_placement_modifier_change_log')
    .select('snapshot_date,campaign_id,placement_code,old_pct,new_pct')
    .eq('account_id', env.accountId)
    .in('campaign_id', campaignIds)
    .order('campaign_id', { ascending: true })
    .order('placement_code', { ascending: true })
    .order('snapshot_date', { ascending: false });

  const bulkPlacementQuery = supabaseAdmin
    .from('bulk_placements')
    .select('snapshot_date,campaign_id,placement_code,percentage')
    .eq('account_id', env.accountId)
    .in('campaign_id', campaignIds)
    .order('campaign_id', { ascending: true })
    .order('placement_code', { ascending: true })
    .order('snapshot_date', { ascending: false });

  const [bulkTargetRows, bulkCampaignRows, placementChangeLogRows, bulkPlacementRows] =
    await Promise.all([
      fetchAllRows<BulkTargetHistoryRow>((from, to) => bulkTargetQuery.range(from, to)).catch(
        (error: unknown) => {
          throw new Error(
            `Failed to load bulk target history for last detected changes: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      ),
      fetchAllRows<BulkCampaignHistoryRow>((from, to) => bulkCampaignQuery.range(from, to)).catch(
        (error: unknown) => {
          throw new Error(
            `Failed to load bulk campaign history for last detected changes: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      ),
      fetchAllRows<PlacementModifierChangeLogRow>((from, to) =>
        placementChangeLogQuery.range(from, to)
      ).catch((error: unknown) => {
        throw new Error(
          `Failed to load placement modifier change log for last detected changes: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }),
      fetchAllRows<BulkPlacementHistoryRow>((from, to) => bulkPlacementQuery.range(from, to)).catch(
        (error: unknown) => {
          throw new Error(
            `Failed to load bulk placement history for last detected changes: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      ),
    ]);

  return buildAdsOptimizerLastDetectedChangesForTargets({
    rows: filteredRows,
    bulkTargetRows,
    bulkCampaignRows,
    placementChangeLogRows,
    bulkPlacementRows,
  });
};
