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

## Phase 8 Cleanup Review

Reviewed: 2026-04-26T22:55:00+08:00

Decision: no tables dropped.

Reason: candidates still have live dependent views, non-zero data, active UI/optimizer/logbook ownership, or unclear product ownership. Phase 8 created MCP views that do not depend on cleanup candidate tables, so cleanup can be handled later as an operator-approved archival task without risking the V3 baseline.

Backup/export status:

- Schema backup: `docs/schema_snapshot.md` refreshed after Phase 8 MCP views.
- Supabase CLI dump: blocked by temp-role authentication failure and pooler circuit breaker; documented in `out/v3_schema_after_phase.sql`.
- Data export manifest: use the `\copy` commands below before any future table drop.
- No destructive cleanup was performed, so no candidate data was removed.

### MCP Dependency Check

Recursive dependency check found no `v_mcp_%` view dependency on cleanup candidate tables.

### Candidate Exact Row Counts And Dependencies

| Table | Exact rows | Dependent views found | Phase 8 decision |
| --- | ---: | --- | --- |
| ads_change_set_items | 133 | none | retain; active ads workspace data |
| ads_change_sets | 22 | none | retain; active ads workspace data |
| ads_objective_presets | 0 | none | retain; zero-row but product ownership unclear |
| ads_optimizer_manual_overrides | 2 | none | retain; optimizer data |
| ads_optimizer_product_settings | 0 | none | retain; optimizer schema |
| ads_optimizer_product_snapshot | 64 | none | retain; optimizer history |
| ads_optimizer_recommendation_overrides | 98 | none | retain; optimizer review history |
| ads_optimizer_recommendation_snapshot | 4717 | none | retain; optimizer history |
| ads_optimizer_role_transition_log | 1399 | none | retain; optimizer audit log |
| ads_optimizer_rule_pack_versions | 4 | none | retain; optimizer config |
| ads_optimizer_rule_packs | 2 | none | retain; optimizer config |
| ads_optimizer_runs | 64 | none | retain; optimizer run history |
| ads_optimizer_target_snapshot | 4811 | none | retain; optimizer history |
| keyword_group_members | 727 | none | retain; keyword grouping UI data |
| keyword_group_sets | 5 | none | retain; keyword grouping UI data |
| keyword_groups | 38 | none | retain; keyword grouping UI data |
| log_driver_campaign_intents | 1 | none | retain; product detail/logbook data |
| log_evaluations | 0 | none | retain; experiment-core schema |
| log_experiment_changes | 0 | none | retain; experiment-core schema |
| log_experiment_events | 0 | none | retain; experiment-core schema |
| log_experiment_phases | 0 | none | retain; experiment-core schema |
| log_experiments | 0 | none | retain; experiment-core schema |
| log_product_kiv_items | 0 | none | retain; product detail/logbook schema |
| product_cost_history | 1 | v_product_sku_cost_current | retain; live dependent view |
| product_profile | 8 | none | retain; product context data |
| sb_campaign_daily_fact | 19389 | sb_campaign_daily_fact_latest | retain; live dependent view |
| sb_campaign_daily_raw | 19389 | sb_campaign_daily_latest, upload_stats | retain; live dependent views |
| sb_campaign_placement_daily_raw | 13884 | sb_campaign_placement_daily_latest, upload_stats | retain; live dependent views |
| sb_keyword_daily_raw | 22438 | sb_keyword_daily_latest, upload_stats | retain; live dependent views |
| sb_stis_daily_raw | 2719 | sb_stis_daily_latest, upload_stats | retain; live dependent views |
| sd_advertised_product_daily_raw | 470 | sd_advertised_product_daily_latest, upload_stats | retain; live dependent views |
| sd_campaign_daily_fact | 470 | sd_campaign_daily_fact_latest | retain; live dependent view |
| sd_campaign_daily_raw | 470 | sd_campaign_daily_latest, upload_stats | retain; live dependent views |
| sd_matched_target_daily_raw | 0 | sd_matched_target_daily_latest, upload_stats | retain; live dependent views despite zero rows |
| sd_purchased_product_daily_raw | 0 | sd_purchased_product_daily_latest, upload_stats | retain; live dependent views despite zero rows |
| sd_targeting_daily_raw | 0 | sd_targeting_daily_latest, upload_stats | retain; live dependent views despite zero rows |
| si_sales_trend_daily_raw | 2452 | si_sales_trend_daily_latest, upload_stats | retain; live Products/Sales UI dependency |
| sp_campaign_daily_raw | 855818 | sp_campaign_hourly_latest, upload_stats | retain; live dependent views |
| sp_campaign_hourly_fact | 848699 | sp_campaign_hourly_fact_latest | retain; live dependent view |
| sp_placement_daily_raw | 280273 | sp_placement_daily_latest, upload_stats | retain; live dependent views |
| sp_placement_modifier_change_log | 119 | none | retain; V3 baseline pack history uses it |
| sp_stis_daily_raw | 60561 | sp_stis_daily_latest, upload_stats | retain; live dependent views |
| sp_targeting_daily_raw | 385497 | sp_targeting_daily_latest, upload_stats | retain; live dependent views |
| ui_page_settings | 5 | none | retain; UI preference data |

### Future Backup Export Manifest

Run these before any future destructive cleanup:

```bash
mkdir -p out/v3_cleanup_exports

for table in \
  sp_campaign_daily_raw sp_placement_daily_raw sp_targeting_daily_raw sp_stis_daily_raw \
  sb_campaign_daily_raw sb_campaign_placement_daily_raw sb_keyword_daily_raw sb_stis_daily_raw \
  sd_campaign_daily_raw sd_advertised_product_daily_raw sd_targeting_daily_raw sd_matched_target_daily_raw sd_purchased_product_daily_raw si_sales_trend_daily_raw \
  sp_campaign_hourly_fact sb_campaign_daily_fact sd_campaign_daily_fact sp_placement_modifier_change_log \
  product_cost_history product_profile keyword_group_sets keyword_groups keyword_group_members ui_page_settings \
  log_experiments log_experiment_changes log_evaluations log_experiment_phases log_experiment_events log_product_kiv_items log_driver_campaign_intents \
  ads_change_sets ads_objective_presets ads_change_set_items ads_optimizer_rule_packs ads_optimizer_rule_pack_versions ads_optimizer_product_settings ads_optimizer_manual_overrides ads_optimizer_runs ads_optimizer_product_snapshot ads_optimizer_target_snapshot ads_optimizer_recommendation_snapshot ads_optimizer_role_transition_log ads_optimizer_recommendation_overrides
do
  psql "$DATABASE_URL" -c "\\copy public.${table} to 'out/v3_cleanup_exports/${table}.csv' with csv header"
done
```
