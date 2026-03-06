import type { SpUpdateAction } from '../../../../../src/bulksheet_gen_sp/types';

import type { AdsChangeSetItem, ChangeSetItemPayload, JsonObject } from './types';
import { buildForecastJson } from './spChangeComposer';

export type SpDraftItemFieldSpec = {
  key: string;
  label: string;
  inputType: 'number' | 'text' | 'state';
  beforeValue: string | number | null;
  afterValue: string | number | null;
};

const STATE_OPTIONS = ['enabled', 'paused', 'archived'] as const;

const trimToNull = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readNumber = (value: unknown, fieldName: string): number => {
  const parsed = typeof value === 'number' ? value : Number(String(value));
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a number.`);
  }
  return parsed;
};

const readNonNegativeNumber = (value: unknown, fieldName: string): number => {
  const parsed = readNumber(value, fieldName);
  if (parsed < 0) {
    throw new Error(`${fieldName} must be non-negative.`);
  }
  return parsed;
};

const readString = (value: unknown, fieldName: string): string => {
  const trimmed = trimToNull(value);
  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }
  return trimmed;
};

const readState = (value: unknown, fieldName: string): string => {
  const normalized = readString(value, fieldName).toLowerCase();
  if (!STATE_OPTIONS.includes(normalized as (typeof STATE_OPTIONS)[number])) {
    throw new Error(`${fieldName} must be one of: ${STATE_OPTIONS.join(', ')}.`);
  }
  return normalized;
};

const readReviewAfterDays = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('review_after_days must be a non-negative integer.');
  }
  return parsed;
};

const getValue = (object: JsonObject, key: string) => object[key] ?? null;

export const getSpDraftItemFieldSpec = (item: AdsChangeSetItem): SpDraftItemFieldSpec => {
  if (item.action_type === 'update_target_bid') {
    return {
      key: 'bid',
      label: 'Target bid',
      inputType: 'number',
      beforeValue: getValue(item.before_json, 'bid') as number | null,
      afterValue: getValue(item.after_json, 'bid') as number | null,
    };
  }
  if (item.action_type === 'update_target_state') {
    return {
      key: 'state',
      label: 'Target state',
      inputType: 'state',
      beforeValue: getValue(item.before_json, 'state') as string | null,
      afterValue: getValue(item.after_json, 'state') as string | null,
    };
  }
  if (item.action_type === 'update_ad_group_default_bid') {
    return {
      key: 'default_bid',
      label: 'Ad group default bid',
      inputType: 'number',
      beforeValue: getValue(item.before_json, 'default_bid') as number | null,
      afterValue: getValue(item.after_json, 'default_bid') as number | null,
    };
  }
  if (item.action_type === 'update_ad_group_state') {
    return {
      key: 'state',
      label: 'Ad group state',
      inputType: 'state',
      beforeValue: getValue(item.before_json, 'state') as string | null,
      afterValue: getValue(item.after_json, 'state') as string | null,
    };
  }
  if (item.action_type === 'update_campaign_budget') {
    return {
      key: 'daily_budget',
      label: 'Campaign daily budget',
      inputType: 'number',
      beforeValue: getValue(item.before_json, 'daily_budget') as number | null,
      afterValue: getValue(item.after_json, 'daily_budget') as number | null,
    };
  }
  if (item.action_type === 'update_campaign_state') {
    return {
      key: 'state',
      label: 'Campaign state',
      inputType: 'state',
      beforeValue: getValue(item.before_json, 'state') as string | null,
      afterValue: getValue(item.after_json, 'state') as string | null,
    };
  }
  if (item.action_type === 'update_campaign_bidding_strategy') {
    return {
      key: 'bidding_strategy',
      label: 'Campaign bidding strategy',
      inputType: 'text',
      beforeValue: getValue(item.before_json, 'bidding_strategy') as string | null,
      afterValue: getValue(item.after_json, 'bidding_strategy') as string | null,
    };
  }
  if (item.action_type === 'update_placement_modifier') {
    return {
      key: 'percentage',
      label: 'Placement modifier %',
      inputType: 'number',
      beforeValue: getValue(item.before_json, 'percentage') as number | null,
      afterValue: getValue(item.after_json, 'percentage') as number | null,
    };
  }
  throw new Error(`Unsupported action type: ${item.action_type}`);
};

export const describeSpDraftItem = (item: AdsChangeSetItem) => {
  const uiContext = item.ui_context_json ?? {};
  const campaignName = trimToNull(uiContext.campaign_name);
  const adGroupName = trimToNull(uiContext.ad_group_name);
  const targetText = trimToNull(uiContext.target_text);
  const placementLabel = trimToNull(uiContext.placement_label);

  const title =
    item.entity_level === 'campaign'
      ? campaignName ?? item.campaign_id ?? item.entity_key
      : item.entity_level === 'ad_group'
        ? adGroupName ?? item.ad_group_id ?? item.entity_key
        : item.entity_level === 'placement'
          ? `${campaignName ?? item.campaign_id ?? item.entity_key} · ${placementLabel ?? item.placement_code ?? 'Placement'}`
          : targetText ?? item.target_id ?? item.entity_key;

  return {
    title,
    subtitle: [item.campaign_id, item.ad_group_id, item.target_id, item.placement_code]
      .filter((value): value is string => Boolean(value))
      .join(' · '),
  };
};

export const mapChangeSetItemsToSpUpdateActions = (items: AdsChangeSetItem[]): SpUpdateAction[] => {
  return items.map((item) => {
    if (item.action_type === 'update_target_bid') {
      return {
        type: 'update_target_bid',
        target_id: readString(item.target_id, 'target_id'),
        campaign_id: item.campaign_id ?? undefined,
        ad_group_id: item.ad_group_id ?? undefined,
        new_bid: readNonNegativeNumber(item.after_json.bid, 'after_json.bid'),
      } satisfies SpUpdateAction;
    }
    if (item.action_type === 'update_target_state') {
      return {
        type: 'update_target_state',
        target_id: readString(item.target_id, 'target_id'),
        campaign_id: item.campaign_id ?? undefined,
        ad_group_id: item.ad_group_id ?? undefined,
        new_state: readState(item.after_json.state, 'after_json.state'),
      } satisfies SpUpdateAction;
    }
    if (item.action_type === 'update_ad_group_default_bid') {
      return {
        type: 'update_ad_group_default_bid',
        ad_group_id: readString(item.ad_group_id, 'ad_group_id'),
        campaign_id: item.campaign_id ?? undefined,
        new_bid: readNonNegativeNumber(item.after_json.default_bid, 'after_json.default_bid'),
      } satisfies SpUpdateAction;
    }
    if (item.action_type === 'update_ad_group_state') {
      return {
        type: 'update_ad_group_state',
        ad_group_id: readString(item.ad_group_id, 'ad_group_id'),
        campaign_id: item.campaign_id ?? undefined,
        new_state: readState(item.after_json.state, 'after_json.state'),
      } satisfies SpUpdateAction;
    }
    if (item.action_type === 'update_campaign_budget') {
      return {
        type: 'update_campaign_budget',
        campaign_id: readString(item.campaign_id, 'campaign_id'),
        new_budget: readNonNegativeNumber(item.after_json.daily_budget, 'after_json.daily_budget'),
      } satisfies SpUpdateAction;
    }
    if (item.action_type === 'update_campaign_state') {
      return {
        type: 'update_campaign_state',
        campaign_id: readString(item.campaign_id, 'campaign_id'),
        new_state: readState(item.after_json.state, 'after_json.state'),
      } satisfies SpUpdateAction;
    }
    if (item.action_type === 'update_campaign_bidding_strategy') {
      return {
        type: 'update_campaign_bidding_strategy',
        campaign_id: readString(item.campaign_id, 'campaign_id'),
        new_strategy: readString(item.after_json.bidding_strategy, 'after_json.bidding_strategy'),
      } satisfies SpUpdateAction;
    }
    if (item.action_type === 'update_placement_modifier') {
      return {
        type: 'update_placement_modifier',
        campaign_id: readString(item.campaign_id, 'campaign_id'),
        placement_code: readString(item.placement_code ?? item.after_json.placement_code, 'placement_code'),
        new_pct: readNonNegativeNumber(item.after_json.percentage, 'after_json.percentage'),
      } satisfies SpUpdateAction;
    }
    throw new Error(`Unsupported action type: ${item.action_type}`);
  });
};

export const buildSpDraftItemPatch = (params: {
  item: AdsChangeSetItem;
  nextValueRaw: string | null;
  objective: string | null;
  hypothesis: string | null;
  forecastSummary: string | null;
  forecastWindowDays: string | null;
  reviewAfterDays: string | null;
  notes: string | null;
}): ChangeSetItemPayload => {
  const fieldSpec = getSpDraftItemFieldSpec(params.item);
  let nextValue: string | number;
  if (fieldSpec.inputType === 'number') {
    nextValue = readNonNegativeNumber(params.nextValueRaw, fieldSpec.label);
  } else if (fieldSpec.inputType === 'state') {
    nextValue = readState(params.nextValueRaw, fieldSpec.label);
  } else {
    nextValue = readString(params.nextValueRaw, fieldSpec.label);
  }

  const forecast = buildForecastJson({
    forecastSummary: params.forecastSummary,
    forecastWindowDays: params.forecastWindowDays,
    baseForecastJson: params.item.forecast_json,
  });

  return {
    after_json: {
      ...params.item.after_json,
      [fieldSpec.key]: nextValue,
    },
    objective: readString(params.objective, 'objective'),
    hypothesis: trimToNull(params.hypothesis),
    forecast_json: forecast.forecast_json,
    review_after_days: readReviewAfterDays(params.reviewAfterDays),
    notes: trimToNull(params.notes),
  };
};
