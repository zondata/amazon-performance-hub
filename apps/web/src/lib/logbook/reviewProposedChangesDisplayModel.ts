export type ReviewActionGroup = 'State' | 'Budget' | 'Strategy' | 'Placement' | 'Bid' | 'Other';

export type ReviewSortMode = 'damage_risk_first' | 'objective_kpi_risk_high_first';

export type ReviewColumnKey =
  | 'channel'
  | 'campaign_name'
  | 'ad_group_name'
  | 'target'
  | 'placement'
  | 'objective'
  | 'action_details'
  | 'field'
  | 'previous_value'
  | 'current_value'
  | 'delta'
  | 'delta_pct'
  | 'why'
  | 'decision'
  | 'override'
  | 'note'
  | 'copy'
  | 'change_id'
  | 'run_id'
  | 'campaign_id'
  | 'ad_group_id'
  | 'target_id'
  | 'placement_ids'
  | 'entity_ref'
  | 'summary'
  | 'rank_objective_alignment'
  | 'rank_expected_kpi_movement'
  | 'rank_risk_guardrail'
  | 'rank_magnitude'
  | 'snapshot_date'
  | 'plan_notes';

export type ReviewProposedChangesDisplayRow = {
  original_index: number;
  channel: 'SP' | 'SB';
  run_id: string;
  change_id: string;
  action_type: string;
  action_group: ReviewActionGroup;
  action_details: string;
  field_label: string;
  objective: string;
  campaign_name: string;
  ad_group_name: string;
  target_display: string;
  placement_display: string;
  previous_value: string | number | null;
  current_value: string | number | null;
  delta: number | null;
  delta_pct: number | null;
  why: string;
  campaign_id: string | null;
  ad_group_id: string | null;
  target_id: string | null;
  placement_code: string | null;
  placement_raw: string | null;
  entity_ref: string;
  summary: string;
  snapshot_date: string | null;
  plan_notes: string | null;
  raw_action: Record<string, unknown>;
  review_rank: {
    objective_alignment: number;
    expected_kpi_movement: number;
    risk_guardrail: number;
    magnitude: number;
  };
  numeric_field_key?: string;
  proposed_numeric_value?: number;
};

export type ReviewChangesUiSettings = {
  showIds: boolean;
  sortMode: ReviewSortMode;
  visibleColumns: ReviewColumnKey[];
};

export const REVIEW_CHANGES_PAGE_KEY = 'logbook.experiment.review_changes';

export const RECOMMENDED_REVIEW_COLUMNS: ReviewColumnKey[] = [
  'channel',
  'campaign_name',
  'ad_group_name',
  'target',
  'placement',
  'objective',
  'action_details',
  'field',
  'previous_value',
  'current_value',
  'delta',
  'delta_pct',
  'why',
  'decision',
  'override',
  'note',
  'copy',
];

export const RECOMMENDED_REVIEW_CHANGES_UI_SETTINGS: ReviewChangesUiSettings = {
  showIds: false,
  sortMode: 'objective_kpi_risk_high_first',
  visibleColumns: RECOMMENDED_REVIEW_COLUMNS,
};

