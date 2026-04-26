# V3 Phase 0 Cleanup Candidates

Generated: 2026-04-26T18:47:08+08:00

No tables were dropped in Phase 0. These are candidates only, carried forward for Phase 8 dependency checks and backup/export review.

## Raw Duplicate Report Tables

| Table | Exists | Estimated rows | Note |
| --- | --- | ---: | --- |
| sp_campaign_daily_raw | yes | 856451 | Candidate from plan; still source for legacy latest views. |
| sp_placement_daily_raw | yes | 280273 | Candidate from plan; still source for placement latest/fact workflows. |
| sp_targeting_daily_raw | yes | 385497 | Candidate from plan. |
| sp_stis_daily_raw | yes | 60695 | Candidate from plan. |
| sb_campaign_daily_raw | yes | 19389 | Candidate from plan. |
| sb_campaign_placement_daily_raw | yes | 13884 | Candidate from plan. |
| sb_keyword_daily_raw | yes | 22428 | Candidate from plan. |
| sb_stis_daily_raw | yes | 2719 | Candidate from plan. |
| sd_campaign_daily_raw | yes | 325 | Candidate from plan. |
| sd_advertised_product_daily_raw | yes | 325 | Candidate from plan. |
| sd_targeting_daily_raw | yes | 0 | Candidate from plan. |
| sd_matched_target_daily_raw | yes | 0 | Candidate from plan. |
| sd_purchased_product_daily_raw | yes | 0 | Candidate from plan. |
| si_sales_trend_daily_raw | yes | 2452 | Candidate from plan. |

## Duplicate Or Legacy Fact Tables

| Table | Exists | Estimated rows | Note |
| --- | --- | ---: | --- |
| sp_campaign_hourly_fact | yes | 847769 | Candidate from plan; compare against gold table before any cleanup. |
| sb_campaign_daily_fact | yes | 19389 | Candidate from plan; compare against gold table before any cleanup. |
| sd_campaign_daily_fact | yes | 325 | Candidate from plan; compare against gold table before any cleanup. |
| sp_placement_modifier_change_log | yes | 119 | Candidate from plan, but currently used by latest V3 baseline pack history. |

## Product/Profile/Keyword Extras

| Table | Exists | Estimated rows | Note |
| --- | --- | ---: | --- |
| product_cost_history | yes | 1 | Candidate from plan. |
| product_profile | yes | 8 | Candidate from plan; UI/product context may depend on it. |
| keyword_group_sets | yes | 5 | Candidate from plan; ranking/SQP UI may depend on it. |
| keyword_groups | yes | 38 | Candidate from plan. |
| keyword_group_members | yes | 727 | Candidate from plan. |
| ui_page_settings | yes | 5 | Candidate from plan; UI preferences depend on it. |

## Experiment/UI/Optimizer Tables

| Table | Exists | Estimated rows | Note |
| --- | --- | ---: | --- |
| log_experiments | yes | 0 | Candidate from plan. |
| log_experiment_changes | yes | 0 | Candidate from plan. |
| log_evaluations | yes | 0 | Candidate from plan. |
| log_experiment_phases | yes | 0 | Candidate from plan. |
| log_experiment_events | yes | 0 | Candidate from plan. |
| log_product_kiv_items | yes | 0 | Candidate from plan. |
| log_driver_campaign_intents | yes | 1 | Candidate from plan. |
| ads_change_sets | yes | 22 | Candidate from plan. |
| ads_objective_presets | yes | 0 | Candidate from plan. |
| ads_change_set_items | yes | 133 | Candidate from plan. |
| ads_optimizer_rule_packs | yes | 2 | Candidate from plan. |
| ads_optimizer_rule_pack_versions | yes | 4 | Candidate from plan. |
| ads_optimizer_product_settings | yes | 0 | Candidate from plan. |
| ads_optimizer_manual_overrides | yes | 2 | Candidate from plan. |
| ads_optimizer_runs | yes | 64 | Candidate from plan. |
| ads_optimizer_product_snapshot | yes | 64 | Candidate from plan. |
| ads_optimizer_target_snapshot | yes | 5268 | Candidate from plan. |
| ads_optimizer_recommendation_snapshot | yes | 4717 | Candidate from plan. |
| ads_optimizer_role_transition_log | yes | 1399 | Candidate from plan. |
| ads_optimizer_recommendation_overrides | yes | 98 | Candidate from plan. |
