import { ADS_OPTIMIZER_TARGET_ROLES, type AdsOptimizerTargetRole } from './role';
import {
  resolveAdsOptimizerLossMakerPolicy,
  resolveAdsOptimizerPhasedRecoveryPolicy,
  resolveAdsOptimizerRoleBiasPolicy,
  resolveAdsOptimizerStrategyProfile,
} from './ruleConfig';
import type {
  AdsOptimizerGuardrailManualApprovalThreshold,
} from './role';
import type {
  AdsOptimizerRulePackPayload,
  AdsOptimizerRulePackVersion,
  AdsOptimizerStrategyProfile,
} from './types';

type NumberFieldDefinition = {
  key: string;
  label: string;
  description: string;
  defaultValue: number;
  step: string;
  min?: string;
  max?: string;
};

type BooleanFieldDefinition = {
  key: string;
  label: string;
  description: string;
  defaultValue: boolean;
};

const asJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const readNumber = (value: Record<string, unknown> | null, key: string) => {
  const raw = value?.[key];
  if (raw === null || raw === undefined || raw === '') return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
};

const readString = (value: Record<string, unknown> | null, key: string) => {
  const raw = value?.[key];
  return typeof raw === 'string' ? raw : null;
};

const readBoolean = (value: Record<string, unknown> | null, key: string) => {
  const raw = value?.[key];
  return typeof raw === 'boolean' ? raw : null;
};

export const ADS_OPTIMIZER_EDITOR_STATE_ENGINE_FIELDS: NumberFieldDefinition[] = [
  {
    key: 'min_clicks_directional',
    label: 'Directional clicks minimum',
    description: 'Captured click floor before a row becomes directional instead of too thin.',
    defaultValue: 20,
    step: '1',
    min: '0',
  },
  {
    key: 'min_orders_confirmed',
    label: 'Confirmed orders minimum',
    description: 'Order floor before the row is treated as confirmed instead of only directional.',
    defaultValue: 2,
    step: '1',
    min: '0',
  },
  {
    key: 'min_days_directional',
    label: 'Directional days minimum',
    description: 'Observed-day floor for directional confidence when orders are still sparse.',
    defaultValue: 3,
    step: '1',
    min: '0',
  },
  {
    key: 'min_days_confirmed',
    label: 'Confirmed days minimum',
    description: 'Observed-day floor used when converting rows are treated as confirmed.',
    defaultValue: 7,
    step: '1',
    min: '0',
  },
  {
    key: 'break_even_gap_tolerance',
    label: 'Break-even gap tolerance',
    description: 'How close to break-even a converting row can sit before it is treated as break-even.',
    defaultValue: 0.03,
    step: '0.01',
    min: '0',
  },
  {
    key: 'dominant_spend_share',
    label: 'Dominant spend share',
    description: 'Share of product ad spend that pushes importance toward Tier 1 dominant.',
    defaultValue: 0.35,
    step: '0.01',
    min: '0',
  },
  {
    key: 'core_spend_share',
    label: 'Core spend share',
    description: 'Share of product ad spend that keeps a row inside Tier 2 core instead of long-tail.',
    defaultValue: 0.12,
    step: '0.01',
    min: '0',
  },
  {
    key: 'dominant_click_velocity',
    label: 'Dominant click velocity',
    description: 'Click velocity that materially reinforces Tier 1 importance.',
    defaultValue: 4,
    step: '0.1',
    min: '0',
  },
  {
    key: 'core_click_velocity',
    label: 'Core click velocity',
    description: 'Click velocity floor that keeps a row inside Tier 2 core traffic.',
    defaultValue: 1.5,
    step: '0.1',
    min: '0',
  },
  {
    key: 'dominant_importance_score',
    label: 'Dominant importance score',
    description: 'Importance score at or above this threshold resolves to Tier 1 dominant.',
    defaultValue: 70,
    step: '1',
    min: '0',
    max: '100',
  },
  {
    key: 'core_importance_score',
    label: 'Core importance score',
    description: 'Importance score at or above this threshold resolves to Tier 2 core.',
    defaultValue: 40,
    step: '1',
    min: '0',
    max: '100',
  },
  {
    key: 'no_sale_spend_risk',
    label: 'No-sale spend risk',
    description: 'Risk lift applied when a row spends through the learning window without sales.',
    defaultValue: 20,
    step: '1',
    min: '0',
  },
  {
    key: 'no_sale_clicks_risk',
    label: 'No-sale clicks risk',
    description: 'Risk lift applied when a row clicks through the learning window without sales.',
    defaultValue: 10,
    step: '1',
    min: '0',
  },
];

export const ADS_OPTIMIZER_EDITOR_GUARDRAIL_FIELDS: Array<
  NumberFieldDefinition | {
    key: 'manual_approval_threshold';
    label: string;
    description: string;
    defaultValue: AdsOptimizerGuardrailManualApprovalThreshold;
    options: AdsOptimizerGuardrailManualApprovalThreshold[];
  }
> = [
  {
    key: 'no_sale_spend_cap',
    label: 'No-sale spend cap',
    description: 'Campaign-side spend cap before no-sale rows are forced into stronger protection.',
    defaultValue: 20,
    step: '1',
    min: '0',
  },
  {
    key: 'no_sale_click_cap',
    label: 'No-sale click cap',
    description: 'Click cap before no-sale rows stop getting patient learning treatment.',
    defaultValue: 12,
    step: '1',
    min: '0',
  },
  {
    key: 'max_loss_per_cycle',
    label: 'Max loss per cycle',
    description: 'Loss boundary before a row is treated as outside the safe operating envelope.',
    defaultValue: 25,
    step: '1',
    min: '0',
  },
  {
    key: 'max_bid_increase_per_cycle_pct',
    label: 'Max bid increase per cycle %',
    description: 'Upper bound on a single-cycle bid increase recommendation.',
    defaultValue: 12,
    step: '1',
    min: '0',
  },
  {
    key: 'max_bid_decrease_per_cycle_pct',
    label: 'Max bid decrease per cycle %',
    description: 'Upper bound on a single-cycle bid decrease recommendation.',
    defaultValue: 18,
    step: '1',
    min: '0',
  },
  {
    key: 'max_placement_bias_increase_per_cycle_pct',
    label: 'Max placement bias increase %',
    description: 'Upper bound on a single-cycle placement modifier increase.',
    defaultValue: 8,
    step: '1',
    min: '0',
  },
  {
    key: 'rank_push_time_limit_days',
    label: 'Rank-push time limit days',
    description: 'Time box before rank-push posture should be reconsidered.',
    defaultValue: 14,
    step: '1',
    min: '0',
  },
  {
    key: 'manual_approval_threshold',
    label: 'Manual approval threshold',
    description: 'Lowest posture that still requires operator approval before execution.',
    defaultValue: 'medium',
    options: ['low', 'medium', 'high', 'all'],
  },
  {
    key: 'auto_pause_threshold',
    label: 'Auto-pause threshold',
    description: 'Risk threshold where suppress posture can recommend a direct pause.',
    defaultValue: 40,
    step: '1',
    min: '0',
  },
  {
    key: 'min_bid_floor',
    label: 'Min bid floor',
    description: 'Hard floor below which bid reductions should not recommend a lower bid.',
    defaultValue: 0.2,
    step: '0.01',
    min: '0',
  },
  {
    key: 'max_bid_ceiling',
    label: 'Max bid ceiling',
    description: 'Hard ceiling above which bid increases should not recommend a higher bid.',
    defaultValue: 3,
    step: '0.01',
    min: '0',
  },
];

export const ADS_OPTIMIZER_EDITOR_RECOMMENDATION_FIELDS: NumberFieldDefinition[] = [
  {
    key: 'isolate_query_clicks_min',
    label: 'Isolate-query clicks minimum',
    description: 'Click floor before a profitable query becomes an isolate candidate.',
    defaultValue: 4,
    step: '1',
    min: '0',
  },
  {
    key: 'negative_query_clicks_min',
    label: 'Negative-query clicks minimum',
    description: 'Click floor before a non-converting query becomes a negative candidate.',
    defaultValue: 6,
    step: '1',
    min: '0',
  },
  {
    key: 'negative_query_spend_min',
    label: 'Negative-query spend minimum',
    description: 'Spend floor before a non-converting query becomes a negative candidate.',
    defaultValue: 12,
    step: '1',
    min: '0',
  },
  {
    key: 'promote_to_exact_clicks_min',
    label: 'Promote-to-exact clicks minimum',
    description: 'Click floor before a converting query becomes an exact-promotion candidate.',
    defaultValue: 5,
    step: '1',
    min: '0',
  },
  {
    key: 'same_text_pin_click_share_min',
    label: 'Same-text click share minimum',
    description: 'Share threshold for pinning same-text query behavior as meaningful context.',
    defaultValue: 0.55,
    step: '0.01',
    min: '0',
    max: '1',
  },
  {
    key: 'main_driver_degradation_click_share_min',
    label: 'Main-driver degradation share minimum',
    description: 'Share threshold before degrading main-driver query context raises an exception signal.',
    defaultValue: 0.55,
    step: '0.01',
    min: '0',
    max: '1',
  },
  {
    key: 'low_confidence_high_spend_min',
    label: 'Low-confidence high spend minimum',
    description: 'Spend threshold for flagging low-confidence rows that are still consuming material spend.',
    defaultValue: 25,
    step: '1',
    min: '0',
  },
  {
    key: 'increase_opportunity_gap',
    label: 'Increase opportunity gap',
    description: 'Opportunity-minus-risk gap required before spend direction can increase.',
    defaultValue: 10,
    step: '1',
  },
  {
    key: 'reduce_risk_gap',
    label: 'Reduce risk gap',
    description: 'Risk-minus-opportunity gap where protective reduction becomes more likely.',
    defaultValue: 8,
    step: '1',
  },
  {
    key: 'max_active_discover_targets',
    label: 'Max active discover targets',
    description: 'ASIN-level cap on how many discover rows can stay active at once.',
    defaultValue: 6,
    step: '1',
    min: '0',
  },
  {
    key: 'learning_budget_cap',
    label: 'Learning budget cap',
    description: 'ASIN-level spend cap reserved for discover and learning-no-sale rows.',
    defaultValue: 75,
    step: '1',
    min: '0',
  },
  {
    key: 'total_stop_loss_cap',
    label: 'Total stop-loss cap',
    description: 'ASIN-level cap for aggregate suppress and loss-making spend exposure.',
    defaultValue: 120,
    step: '1',
    min: '0',
  },
  {
    key: 'max_budget_share_per_target',
    label: 'Max budget share per target',
    description: 'Maximum single-row share of total ASIN spend before growth is capped.',
    defaultValue: 0.35,
    step: '0.01',
    min: '0',
    max: '1',
  },
];

export const ADS_OPTIMIZER_EDITOR_ROLE_BIAS_FIELDS: BooleanFieldDefinition[] = [
  {
    key: 'visibility_led_rank_defend_bias',
    label: 'Visibility-led rank defense bias',
    description: 'Lets visibility-led drafts protect important rows with stronger Rank Defend preference.',
    defaultValue: true,
  },
  {
    key: 'design_led_long_tail_suppress_bias',
    label: 'Design-led long-tail suppression bias',
    description: 'Lets design-led drafts collapse weak long-tail rows faster than the neutral baseline.',
    defaultValue: true,
  },
];

export const adsOptimizerDraftFieldName = (section: string, key: string) =>
  `draft_${section}_${key}`;

const buildNumberValues = (
  value: Record<string, unknown> | null,
  fields: NumberFieldDefinition[]
) =>
  Object.fromEntries(
    fields.map((field) => [field.key, readNumber(value, field.key) ?? field.defaultValue])
  ) as Record<string, number>;

export type AdsOptimizerDraftEditorValues = {
  versionLabel: string;
  changeSummary: string;
  strategyProfile: AdsOptimizerStrategyProfile;
  stateEngineThresholds: Record<string, number>;
  guardrailThresholds: Record<string, number | AdsOptimizerGuardrailManualApprovalThreshold>;
  recommendationThresholds: Record<string, number>;
  lossMakerPolicy: ReturnType<typeof resolveAdsOptimizerLossMakerPolicy>;
  phasedRecoveryPolicy: ReturnType<typeof resolveAdsOptimizerPhasedRecoveryPolicy>;
  roleBiasPolicy: ReturnType<typeof resolveAdsOptimizerRoleBiasPolicy>;
  roleTemplates: Record<AdsOptimizerTargetRole, { enabled: boolean; notes: string }>;
};

export const readAdsOptimizerDraftEditorValues = (
  version: AdsOptimizerRulePackVersion
): AdsOptimizerDraftEditorValues => {
  const payload = version.change_payload_json;
  const stateThresholds = asJsonObject(asJsonObject(payload.state_engine)?.thresholds);
  const guardrailThresholds = asJsonObject(
    asJsonObject(asJsonObject(payload.guardrail_templates)?.default)?.thresholds
  );
  const recommendationThresholds = asJsonObject(
    asJsonObject(payload.action_policy)?.recommendation_thresholds
  );

  return {
    versionLabel: version.version_label,
    changeSummary: version.change_summary,
    strategyProfile: resolveAdsOptimizerStrategyProfile({
      rulePackPayload: payload,
    }),
    stateEngineThresholds: buildNumberValues(
      stateThresholds,
      ADS_OPTIMIZER_EDITOR_STATE_ENGINE_FIELDS
    ),
    guardrailThresholds: {
      ...Object.fromEntries(
        ADS_OPTIMIZER_EDITOR_GUARDRAIL_FIELDS.filter((field) => 'step' in field).map((field) => [
          field.key,
          readNumber(guardrailThresholds, field.key) ?? field.defaultValue,
        ])
      ),
      manual_approval_threshold:
        (readString(
          guardrailThresholds,
          'manual_approval_threshold'
        ) as AdsOptimizerGuardrailManualApprovalThreshold | null) ?? 'medium',
    },
    recommendationThresholds: buildNumberValues(
      recommendationThresholds,
      ADS_OPTIMIZER_EDITOR_RECOMMENDATION_FIELDS
    ),
    lossMakerPolicy: resolveAdsOptimizerLossMakerPolicy(payload),
    phasedRecoveryPolicy: resolveAdsOptimizerPhasedRecoveryPolicy(payload),
    roleBiasPolicy: resolveAdsOptimizerRoleBiasPolicy(payload),
    roleTemplates: Object.fromEntries(
      ADS_OPTIMIZER_TARGET_ROLES.map((role) => {
        const template = asJsonObject(payload.role_templates?.[role] ?? null);
        return [
          role,
          {
            enabled: readBoolean(template, 'enabled') ?? true,
            notes: readString(template, 'notes') ?? '',
          },
        ];
      })
    ) as Record<AdsOptimizerTargetRole, { enabled: boolean; notes: string }>,
  };
};

export const mergeAdsOptimizerDraftPayload = (
  existingPayload: AdsOptimizerRulePackPayload,
  updates: Partial<AdsOptimizerRulePackPayload>
): AdsOptimizerRulePackPayload => {
  const nextStateEngine = asJsonObject(updates.state_engine);
  const nextStateThresholds = asJsonObject(nextStateEngine?.thresholds);
  const existingStateEngine = asJsonObject(existingPayload.state_engine);
  const existingStateThresholds = asJsonObject(existingStateEngine?.thresholds);

  const nextGuardrailTemplates = asJsonObject(updates.guardrail_templates);
  const nextDefaultGuardrails = asJsonObject(nextGuardrailTemplates?.default);
  const nextGuardrailThresholds = asJsonObject(nextDefaultGuardrails?.thresholds);
  const existingGuardrailTemplates = asJsonObject(existingPayload.guardrail_templates);
  const existingDefaultGuardrails = asJsonObject(existingGuardrailTemplates?.default);
  const existingGuardrailThresholds = asJsonObject(existingDefaultGuardrails?.thresholds);

  const nextActionPolicy = asJsonObject(updates.action_policy);
  const nextRecommendationThresholds = asJsonObject(nextActionPolicy?.recommendation_thresholds);
  const existingActionPolicy = asJsonObject(existingPayload.action_policy);
  const existingRecommendationThresholds = asJsonObject(
    existingActionPolicy?.recommendation_thresholds
  );

  const nextRoleTemplates = updates.role_templates ?? {};
  const mergedRoleTemplates = Object.fromEntries(
    ADS_OPTIMIZER_TARGET_ROLES.map((role) => {
      const existingTemplate = asJsonObject(existingPayload.role_templates?.[role] ?? null);
      const nextTemplate = asJsonObject(nextRoleTemplates[role] ?? null);
      return [
        role,
        {
          enabled: readBoolean(nextTemplate, 'enabled') ?? readBoolean(existingTemplate, 'enabled') ?? true,
          notes: readString(nextTemplate, 'notes') ?? readString(existingTemplate, 'notes') ?? '',
        },
      ];
    })
  );

  return {
    ...existingPayload,
    ...updates,
    role_templates: {
      ...existingPayload.role_templates,
      ...mergedRoleTemplates,
    },
    state_engine: {
      ...existingPayload.state_engine,
      ...updates.state_engine,
      thresholds: {
        ...existingStateThresholds,
        ...nextStateThresholds,
      },
    },
    guardrail_templates: {
      ...existingPayload.guardrail_templates,
      ...updates.guardrail_templates,
      default: {
        ...existingDefaultGuardrails,
        ...nextDefaultGuardrails,
        thresholds: {
          ...existingGuardrailThresholds,
          ...nextGuardrailThresholds,
        },
      },
    },
    action_policy: {
      ...existingPayload.action_policy,
      ...updates.action_policy,
      recommendation_thresholds: {
        ...existingRecommendationThresholds,
        ...nextRecommendationThresholds,
      },
    },
  };
};
