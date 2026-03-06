import {
  ADS_CHANGE_SET_ITEM_ACTION_TYPES,
  ADS_CHANGE_SET_ITEM_ENTITY_LEVELS,
  ADS_CHANGE_SET_STATUSES,
  ADS_WORKSPACE_CHANNELS,
  AdsChangeSetItemActionType,
  AdsChangeSetItemEntityLevel,
  AdsChangeSetStatus,
  AdsWorkspaceChannel,
  ChangeSetItemPayload,
  ChangeSetPayload,
  JsonObject,
  ObjectivePresetPayload,
} from './types';

export type ValidationResult<T> = {
  value: T;
  errors: string[];
};

export type ValidatedCreateChangeSet = {
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
};

export type ValidatedChangeSetPatch = {
  experiment_id?: string | null;
  name?: string;
  status?: AdsChangeSetStatus;
  objective?: string | null;
  hypothesis?: string | null;
  forecast_window_days?: number | null;
  review_after_days?: number | null;
  notes?: string | null;
  filters_json?: JsonObject;
  generated_run_id?: string | null;
  generated_artifact_json?: JsonObject | null;
};

export type ValidatedCreateChangeSetItem = {
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
};

export type ValidatedChangeSetItemPatch = {
  channel?: AdsWorkspaceChannel;
  entity_level?: AdsChangeSetItemEntityLevel;
  entity_key?: string;
  campaign_id?: string | null;
  ad_group_id?: string | null;
  target_id?: string | null;
  target_key?: string | null;
  placement_code?: string | null;
  action_type?: AdsChangeSetItemActionType;
  before_json?: JsonObject;
  after_json?: JsonObject;
  objective?: string | null;
  hypothesis?: string | null;
  forecast_json?: JsonObject | null;
  review_after_days?: number | null;
  notes?: string | null;
  objective_preset_id?: string | null;
  ui_context_json?: JsonObject | null;
};

export type ValidatedCreateObjectivePreset = {
  channel: AdsWorkspaceChannel | null;
  name: string;
  objective: string;
  hypothesis: string | null;
  forecast_json: JsonObject | null;
  review_after_days: number | null;
  notes: string | null;
};

export type ValidatedObjectivePresetPatch = {
  channel?: AdsWorkspaceChannel | null;
  name?: string;
  objective?: string;
  hypothesis?: string | null;
  forecast_json?: JsonObject | null;
  review_after_days?: number | null;
  notes?: string | null;
};

const hasOwn = <T extends object>(value: T, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(value, key);

const optionalTrimmed = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readRequiredString = (
  value: unknown,
  fieldName: string,
  errors: string[]
): string => {
  const normalized = optionalTrimmed(value);
  if (!normalized) {
    errors.push(`${fieldName} is required`);
    return '';
  }
  return normalized;
};

const readNullableInteger = (
  payload: Record<string, unknown>,
  fieldName: string,
  errors: string[]
): number | null | undefined => {
  if (!hasOwn(payload, fieldName)) {
    return undefined;
  }
  const value = payload[fieldName];
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isInteger(value) || Number(value) < 0) {
    errors.push(`${fieldName} must be a non-negative integer`);
    return null;
  }
  return Number(value);
};

const readEnum = <T extends readonly string[]>(
  payload: Record<string, unknown>,
  fieldName: string,
  allowed: T,
  errors: string[],
  required: boolean
): T[number] | null | undefined => {
  if (!hasOwn(payload, fieldName)) {
    if (required) {
      errors.push(`${fieldName} is required`);
    }
    return required ? null : undefined;
  }
  const value = optionalTrimmed(payload[fieldName]);
  if (!value) {
    errors.push(`${fieldName} is required`);
    return null;
  }
  if (!allowed.includes(value)) {
    errors.push(`${fieldName} must be one of: ${allowed.join(', ')}`);
    return null;
  }
  return value as T[number];
};

const readNullableEnum = <T extends readonly string[]>(
  payload: Record<string, unknown>,
  fieldName: string,
  allowed: T,
  errors: string[]
): T[number] | null | undefined => {
  if (!hasOwn(payload, fieldName)) {
    return undefined;
  }
  const rawValue = payload[fieldName];
  if (rawValue === null || rawValue === undefined) {
    return null;
  }
  const value = optionalTrimmed(rawValue);
  if (!value) {
    return null;
  }
  if (!allowed.includes(value)) {
    errors.push(`${fieldName} must be one of: ${allowed.join(', ')}`);
    return null;
  }
  return value as T[number];
};

const readRequiredObject = (
  value: unknown,
  fieldName: string,
  errors: string[]
): JsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${fieldName} must be an object`);
    return {};
  }
  return value as JsonObject;
};

const readOptionalObject = (
  payload: Record<string, unknown>,
  fieldName: string,
  errors: string[]
): JsonObject | undefined => {
  if (!hasOwn(payload, fieldName)) {
    return undefined;
  }
  return readRequiredObject(payload[fieldName], fieldName, errors);
};

const readNullableObject = (
  payload: Record<string, unknown>,
  fieldName: string,
  errors: string[]
): JsonObject | null | undefined => {
  if (!hasOwn(payload, fieldName)) {
    return undefined;
  }
  const value = payload[fieldName];
  if (value === null || value === undefined) {
    return null;
  }
  return readRequiredObject(value, fieldName, errors);
};

const ensurePatchHasValues = (patch: Record<string, unknown>, errors: string[]) => {
  if (Object.keys(patch).length === 0) {
    errors.push('at least one field is required');
  }
};

export const validateCreateChangeSetPayload = (
  payload: ChangeSetPayload
): ValidationResult<ValidatedCreateChangeSet> => {
  const errors: string[] = [];
  const record = payload as Record<string, unknown>;
  const status =
    readEnum(record, 'status', ADS_CHANGE_SET_STATUSES, errors, false) ?? 'draft';

  return {
    value: {
      experiment_id: optionalTrimmed(payload.experiment_id) ?? null,
      name: readRequiredString(payload.name, 'name', errors),
      status: (status ?? 'draft') as AdsChangeSetStatus,
      objective: optionalTrimmed(payload.objective) ?? null,
      hypothesis: optionalTrimmed(payload.hypothesis) ?? null,
      forecast_window_days: readNullableInteger(record, 'forecast_window_days', errors) ?? null,
      review_after_days: readNullableInteger(record, 'review_after_days', errors) ?? null,
      notes: optionalTrimmed(payload.notes) ?? null,
      filters_json:
        readOptionalObject(record, 'filters_json', errors) ??
        ({} as JsonObject),
      generated_run_id: optionalTrimmed(payload.generated_run_id) ?? null,
      generated_artifact_json:
        readNullableObject(record, 'generated_artifact_json', errors) ?? null,
    },
    errors,
  };
};

export const validateUpdateChangeSetPayload = (
  payload: ChangeSetPayload
): ValidationResult<ValidatedChangeSetPatch> => {
  const errors: string[] = [];
  const record = payload as Record<string, unknown>;
  const value: ValidatedChangeSetPatch = {};

  if (hasOwn(payload, 'experiment_id')) {
    value.experiment_id = optionalTrimmed(payload.experiment_id) ?? null;
  }
  if (hasOwn(payload, 'name')) {
    value.name = readRequiredString(payload.name, 'name', errors);
  }
  const status = readEnum(record, 'status', ADS_CHANGE_SET_STATUSES, errors, false);
  if (status) value.status = status as AdsChangeSetStatus;
  if (hasOwn(payload, 'objective')) value.objective = optionalTrimmed(payload.objective) ?? null;
  if (hasOwn(payload, 'hypothesis')) {
    value.hypothesis = optionalTrimmed(payload.hypothesis) ?? null;
  }
  const forecastWindowDays = readNullableInteger(record, 'forecast_window_days', errors);
  if (forecastWindowDays !== undefined) value.forecast_window_days = forecastWindowDays;
  const reviewAfterDays = readNullableInteger(record, 'review_after_days', errors);
  if (reviewAfterDays !== undefined) value.review_after_days = reviewAfterDays;
  if (hasOwn(payload, 'notes')) value.notes = optionalTrimmed(payload.notes) ?? null;
  const filtersJson = readOptionalObject(record, 'filters_json', errors);
  if (filtersJson !== undefined) value.filters_json = filtersJson;
  if (hasOwn(payload, 'generated_run_id')) {
    value.generated_run_id = optionalTrimmed(payload.generated_run_id) ?? null;
  }
  const generatedArtifactJson = readNullableObject(
    record,
    'generated_artifact_json',
    errors
  );
  if (generatedArtifactJson !== undefined) {
    value.generated_artifact_json = generatedArtifactJson;
  }

  ensurePatchHasValues(value as Record<string, unknown>, errors);
  return { value, errors };
};

export const validateCreateChangeSetItemPayload = (
  payload: ChangeSetItemPayload
): ValidationResult<ValidatedCreateChangeSetItem> => {
  const errors: string[] = [];
  const record = payload as Record<string, unknown>;

  return {
    value: {
      channel: (readEnum(record, 'channel', ADS_WORKSPACE_CHANNELS, errors, true) ??
        'sp') as AdsWorkspaceChannel,
      entity_level: (readEnum(
        record,
        'entity_level',
        ADS_CHANGE_SET_ITEM_ENTITY_LEVELS,
        errors,
        true
      ) ?? 'campaign') as AdsChangeSetItemEntityLevel,
      entity_key: readRequiredString(payload.entity_key, 'entity_key', errors),
      campaign_id: optionalTrimmed(payload.campaign_id) ?? null,
      ad_group_id: optionalTrimmed(payload.ad_group_id) ?? null,
      target_id: optionalTrimmed(payload.target_id) ?? null,
      target_key: optionalTrimmed(payload.target_key) ?? null,
      placement_code: optionalTrimmed(payload.placement_code) ?? null,
      action_type: (readEnum(
        record,
        'action_type',
        ADS_CHANGE_SET_ITEM_ACTION_TYPES,
        errors,
        true
      ) ?? 'update_campaign_state') as AdsChangeSetItemActionType,
      before_json: readRequiredObject(payload.before_json, 'before_json', errors),
      after_json: readRequiredObject(payload.after_json, 'after_json', errors),
      objective: optionalTrimmed(payload.objective) ?? null,
      hypothesis: optionalTrimmed(payload.hypothesis) ?? null,
      forecast_json: readNullableObject(record, 'forecast_json', errors) ?? null,
      review_after_days: readNullableInteger(record, 'review_after_days', errors) ?? null,
      notes: optionalTrimmed(payload.notes) ?? null,
      objective_preset_id: optionalTrimmed(payload.objective_preset_id) ?? null,
      ui_context_json: readNullableObject(record, 'ui_context_json', errors) ?? null,
    },
    errors,
  };
};

export const validateUpdateChangeSetItemPayload = (
  payload: ChangeSetItemPayload
): ValidationResult<ValidatedChangeSetItemPatch> => {
  const errors: string[] = [];
  const record = payload as Record<string, unknown>;
  const value: ValidatedChangeSetItemPatch = {};

  const channel = readEnum(record, 'channel', ADS_WORKSPACE_CHANNELS, errors, false);
  if (channel) value.channel = channel as AdsWorkspaceChannel;
  const entityLevel = readEnum(
    record,
    'entity_level',
    ADS_CHANGE_SET_ITEM_ENTITY_LEVELS,
    errors,
    false
  );
  if (entityLevel) value.entity_level = entityLevel as AdsChangeSetItemEntityLevel;
  if (hasOwn(payload, 'entity_key')) {
    value.entity_key = readRequiredString(payload.entity_key, 'entity_key', errors);
  }
  if (hasOwn(payload, 'campaign_id')) value.campaign_id = optionalTrimmed(payload.campaign_id) ?? null;
  if (hasOwn(payload, 'ad_group_id')) value.ad_group_id = optionalTrimmed(payload.ad_group_id) ?? null;
  if (hasOwn(payload, 'target_id')) value.target_id = optionalTrimmed(payload.target_id) ?? null;
  if (hasOwn(payload, 'target_key')) value.target_key = optionalTrimmed(payload.target_key) ?? null;
  if (hasOwn(payload, 'placement_code')) {
    value.placement_code = optionalTrimmed(payload.placement_code) ?? null;
  }
  const actionType = readEnum(
    record,
    'action_type',
    ADS_CHANGE_SET_ITEM_ACTION_TYPES,
    errors,
    false
  );
  if (actionType) value.action_type = actionType as AdsChangeSetItemActionType;
  const beforeJson = readOptionalObject(record, 'before_json', errors);
  if (beforeJson !== undefined) value.before_json = beforeJson;
  const afterJson = readOptionalObject(record, 'after_json', errors);
  if (afterJson !== undefined) value.after_json = afterJson;
  if (hasOwn(payload, 'objective')) value.objective = optionalTrimmed(payload.objective) ?? null;
  if (hasOwn(payload, 'hypothesis')) {
    value.hypothesis = optionalTrimmed(payload.hypothesis) ?? null;
  }
  const forecastJson = readNullableObject(record, 'forecast_json', errors);
  if (forecastJson !== undefined) value.forecast_json = forecastJson;
  const reviewAfterDays = readNullableInteger(record, 'review_after_days', errors);
  if (reviewAfterDays !== undefined) value.review_after_days = reviewAfterDays;
  if (hasOwn(payload, 'notes')) value.notes = optionalTrimmed(payload.notes) ?? null;
  if (hasOwn(payload, 'objective_preset_id')) {
    value.objective_preset_id = optionalTrimmed(payload.objective_preset_id) ?? null;
  }
  const uiContextJson = readNullableObject(record, 'ui_context_json', errors);
  if (uiContextJson !== undefined) value.ui_context_json = uiContextJson;

  ensurePatchHasValues(value as Record<string, unknown>, errors);
  return { value, errors };
};

export const validateCreateObjectivePresetPayload = (
  payload: ObjectivePresetPayload
): ValidationResult<ValidatedCreateObjectivePreset> => {
  const errors: string[] = [];
  const record = payload as Record<string, unknown>;

  return {
    value: {
      channel: (readNullableEnum(record, 'channel', ADS_WORKSPACE_CHANNELS, errors) ??
        null) as AdsWorkspaceChannel | null,
      name: readRequiredString(payload.name, 'name', errors),
      objective: readRequiredString(payload.objective, 'objective', errors),
      hypothesis: optionalTrimmed(payload.hypothesis) ?? null,
      forecast_json: readNullableObject(record, 'forecast_json', errors) ?? null,
      review_after_days: readNullableInteger(record, 'review_after_days', errors) ?? null,
      notes: optionalTrimmed(payload.notes) ?? null,
    },
    errors,
  };
};

export const validateUpdateObjectivePresetPayload = (
  payload: ObjectivePresetPayload
): ValidationResult<ValidatedObjectivePresetPatch> => {
  const errors: string[] = [];
  const record = payload as Record<string, unknown>;
  const value: ValidatedObjectivePresetPatch = {};

  const channel = readNullableEnum(record, 'channel', ADS_WORKSPACE_CHANNELS, errors);
  if (channel !== undefined) value.channel = channel as AdsWorkspaceChannel | null;
  if (hasOwn(payload, 'name')) value.name = readRequiredString(payload.name, 'name', errors);
  if (hasOwn(payload, 'objective')) {
    value.objective = readRequiredString(payload.objective, 'objective', errors);
  }
  if (hasOwn(payload, 'hypothesis')) {
    value.hypothesis = optionalTrimmed(payload.hypothesis) ?? null;
  }
  const forecastJson = readNullableObject(record, 'forecast_json', errors);
  if (forecastJson !== undefined) value.forecast_json = forecastJson;
  const reviewAfterDays = readNullableInteger(record, 'review_after_days', errors);
  if (reviewAfterDays !== undefined) value.review_after_days = reviewAfterDays;
  if (hasOwn(payload, 'notes')) value.notes = optionalTrimmed(payload.notes) ?? null;

  ensurePatchHasValues(value as Record<string, unknown>, errors);
  return { value, errors };
};
