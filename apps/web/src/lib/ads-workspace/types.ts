export const ADS_WORKSPACE_CHANNELS = ['sp', 'sb', 'sd'] as const;
export const ADS_CHANGE_SET_STATUSES = [
  'draft',
  'review_ready',
  'generated',
  'cancelled',
] as const;
export const ADS_CHANGE_SET_ITEM_ENTITY_LEVELS = [
  'campaign',
  'placement',
  'ad_group',
  'target',
  'search_term_context',
] as const;
export const ADS_CHANGE_SET_ITEM_ACTION_TYPES = [
  'update_target_bid',
  'update_target_state',
  'update_ad_group_default_bid',
  'update_ad_group_state',
  'update_campaign_budget',
  'update_campaign_state',
  'update_campaign_bidding_strategy',
  'update_placement_modifier',
] as const;

export type JsonObject = Record<string, unknown>;

export type AdsWorkspaceChannel = (typeof ADS_WORKSPACE_CHANNELS)[number];
export type AdsChangeSetStatus = (typeof ADS_CHANGE_SET_STATUSES)[number];
export type AdsChangeSetItemEntityLevel = (typeof ADS_CHANGE_SET_ITEM_ENTITY_LEVELS)[number];
export type AdsChangeSetItemActionType = (typeof ADS_CHANGE_SET_ITEM_ACTION_TYPES)[number];

export type AdsChangeSet = {
  id: string;
  account_id: string;
  marketplace: string;
  experiment_id: string | null;
  name: string;
  status: AdsChangeSetStatus;
  objective: string | null;
  hypothesis: string | null;
  forecast_window_days: number | null;
  review_after_days: number | null;
  notes: string | null;
  filters_json: JsonObject;
  generated_run_id: string | null;
  generated_artifact_json: JsonObject | null;
  created_at: string;
  updated_at: string;
};

export type AdsChangeSetItem = {
  id: string;
  change_set_id: string;
  channel: AdsWorkspaceChannel;
  entity_level: AdsChangeSetItemEntityLevel;
  entity_key: string;
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
  target_key: string | null;
  placement_code: string | null;
  action_type: AdsChangeSetItemActionType;
  before_json: JsonObject;
  after_json: JsonObject;
  objective: string | null;
  hypothesis: string | null;
  forecast_json: JsonObject | null;
  review_after_days: number | null;
  notes: string | null;
  objective_preset_id: string | null;
  ui_context_json: JsonObject | null;
  created_at: string;
  updated_at: string;
};

export type AdsObjectivePreset = {
  id: string;
  account_id: string;
  marketplace: string;
  channel: AdsWorkspaceChannel | null;
  name: string;
  objective: string;
  hypothesis: string | null;
  forecast_json: JsonObject | null;
  review_after_days: number | null;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ChangeSetPayload = {
  experiment_id?: string | null;
  name?: string | null;
  status?: string | null;
  objective?: string | null;
  hypothesis?: string | null;
  forecast_window_days?: number | null;
  review_after_days?: number | null;
  notes?: string | null;
  filters_json?: unknown;
  generated_run_id?: string | null;
  generated_artifact_json?: unknown;
};

export type ChangeSetItemPayload = {
  channel?: string | null;
  entity_level?: string | null;
  entity_key?: string | null;
  campaign_id?: string | null;
  ad_group_id?: string | null;
  target_id?: string | null;
  target_key?: string | null;
  placement_code?: string | null;
  action_type?: string | null;
  before_json?: unknown;
  after_json?: unknown;
  objective?: string | null;
  hypothesis?: string | null;
  forecast_json?: unknown;
  review_after_days?: number | null;
  notes?: string | null;
  objective_preset_id?: string | null;
  ui_context_json?: unknown;
};

export type ObjectivePresetPayload = {
  channel?: string | null;
  name?: string | null;
  objective?: string | null;
  hypothesis?: string | null;
  forecast_json?: unknown;
  review_after_days?: number | null;
  notes?: string | null;
};

export type ListChangeSetsOptions = {
  status?: AdsChangeSetStatus | AdsChangeSetStatus[];
  experiment_id?: string | null;
  limit?: number;
};

export type ListObjectivePresetsOptions = {
  channel?: AdsWorkspaceChannel | null;
  includeArchived?: boolean;
  limit?: number;
};

export type AdsChangeSetRow = Omit<AdsChangeSet, 'filters_json' | 'generated_artifact_json'> & {
  filters_json: unknown;
  generated_artifact_json: unknown | null;
};

export type AdsChangeSetItemRow = Omit<
  AdsChangeSetItem,
  'before_json' | 'after_json' | 'forecast_json' | 'ui_context_json'
> & {
  before_json: unknown;
  after_json: unknown;
  forecast_json: unknown | null;
  ui_context_json: unknown | null;
};

export type AdsObjectivePresetRow = Omit<AdsObjectivePreset, 'forecast_json'> & {
  forecast_json: unknown | null;
};

const asJsonObject = (value: unknown, fieldName: string): JsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }
  return value as JsonObject;
};

const asNullableJsonObject = (value: unknown, fieldName: string): JsonObject | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return asJsonObject(value, fieldName);
};

export const mapChangeSetRow = (row: AdsChangeSetRow): AdsChangeSet => ({
  ...row,
  status: row.status as AdsChangeSetStatus,
  filters_json: asJsonObject(row.filters_json, 'filters_json'),
  generated_artifact_json: asNullableJsonObject(
    row.generated_artifact_json,
    'generated_artifact_json'
  ),
});

export const mapChangeSetItemRow = (row: AdsChangeSetItemRow): AdsChangeSetItem => ({
  ...row,
  channel: row.channel as AdsWorkspaceChannel,
  entity_level: row.entity_level as AdsChangeSetItemEntityLevel,
  action_type: row.action_type as AdsChangeSetItemActionType,
  before_json: asJsonObject(row.before_json, 'before_json'),
  after_json: asJsonObject(row.after_json, 'after_json'),
  forecast_json: asNullableJsonObject(row.forecast_json, 'forecast_json'),
  ui_context_json: asNullableJsonObject(row.ui_context_json, 'ui_context_json'),
});

export const mapObjectivePresetRow = (row: AdsObjectivePresetRow): AdsObjectivePreset => ({
  ...row,
  channel: row.channel as AdsWorkspaceChannel | null,
  forecast_json: asNullableJsonObject(row.forecast_json, 'forecast_json'),
});
