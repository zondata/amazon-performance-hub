# Supabase Schema Snapshot
Generated: 2026-04-26T14:22:53.594Z

## accounts (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| marketplace | text | YES |
| created_at | timestamp with time zone | NO |

## ad_group_name_history (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| ad_group_id | text | NO |
| campaign_id | text | NO |
| name_raw | text | NO |
| name_norm | text | NO |
| valid_from | date | NO |
| valid_to | date | YES |

## ads_change_set_items (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| change_set_id | uuid | NO |
| channel | text | NO |
| entity_level | text | NO |
| entity_key | text | NO |
| campaign_id | text | YES |
| ad_group_id | text | YES |
| target_id | text | YES |
| target_key | text | YES |
| placement_code | text | YES |
| action_type | text | NO |
| before_json | jsonb | NO |
| after_json | jsonb | NO |
| objective | text | YES |
| hypothesis | text | YES |
| forecast_json | jsonb | YES |
| review_after_days | integer | YES |
| notes | text | YES |
| objective_preset_id | uuid | YES |
| ui_context_json | jsonb | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## ads_change_sets (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| experiment_id | uuid | YES |
| name | text | NO |
| status | text | NO |
| objective | text | YES |
| hypothesis | text | YES |
| forecast_window_days | integer | YES |
| review_after_days | integer | YES |
| notes | text | YES |
| filters_json | jsonb | NO |
| generated_run_id | text | YES |
| generated_artifact_json | jsonb | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## ads_objective_presets (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| channel | text | YES |
| name | text | NO |
| objective | text | NO |
| hypothesis | text | YES |
| forecast_json | jsonb | YES |
| review_after_days | integer | YES |
| notes | text | YES |
| is_archived | boolean | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## ads_optimizer_manual_overrides (BASE TABLE)
| column | type | nullable |
|---|---|---|
| manual_override_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| product_id | uuid | NO |
| override_key | text | NO |
| override_value_json | jsonb | NO |
| notes | text | YES |
| is_archived | boolean | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |
| archived_at | timestamp with time zone | YES |

## ads_optimizer_product_settings (BASE TABLE)
| column | type | nullable |
|---|---|---|
| product_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| archetype | text | NO |
| optimizer_enabled | boolean | NO |
| default_objective_mode | text | YES |
| rule_pack_version_id | uuid | NO |
| strategic_notes | text | YES |
| guardrail_overrides_json | jsonb | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## ads_optimizer_product_snapshot (BASE TABLE)
| column | type | nullable |
|---|---|---|
| product_snapshot_id | uuid | NO |
| run_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| product_id | uuid | YES |
| asin | text | NO |
| snapshot_payload_json | jsonb | NO |
| created_at | timestamp with time zone | NO |

## ads_optimizer_recommendation_overrides (BASE TABLE)
| column | type | nullable |
|---|---|---|
| recommendation_override_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| product_id | uuid | NO |
| asin | text | NO |
| target_id | text | NO |
| run_id | uuid | NO |
| target_snapshot_id | uuid | NO |
| recommendation_snapshot_id | uuid | NO |
| override_scope | text | NO |
| replacement_action_bundle_json | jsonb | NO |
| operator_note | text | NO |
| is_archived | boolean | NO |
| last_applied_at | timestamp with time zone | YES |
| last_applied_change_set_id | uuid | YES |
| apply_count | integer | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |
| archived_at | timestamp with time zone | YES |

## ads_optimizer_recommendation_snapshot (BASE TABLE)
| column | type | nullable |
|---|---|---|
| recommendation_snapshot_id | uuid | NO |
| run_id | uuid | NO |
| target_snapshot_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| asin | text | NO |
| status | text | NO |
| action_type | text | YES |
| reason_codes_json | jsonb | YES |
| snapshot_payload_json | jsonb | NO |
| created_at | timestamp with time zone | NO |

## ads_optimizer_role_transition_log (BASE TABLE)
| column | type | nullable |
|---|---|---|
| role_transition_log_id | uuid | NO |
| run_id | uuid | NO |
| target_snapshot_id | uuid | YES |
| account_id | text | NO |
| marketplace | text | NO |
| asin | text | NO |
| target_id | text | YES |
| from_role | text | YES |
| to_role | text | YES |
| transition_reason_json | jsonb | YES |
| created_at | timestamp with time zone | NO |

## ads_optimizer_rule_pack_versions (BASE TABLE)
| column | type | nullable |
|---|---|---|
| rule_pack_version_id | uuid | NO |
| rule_pack_id | uuid | NO |
| version_label | text | NO |
| status | text | NO |
| change_summary | text | NO |
| change_payload_json | jsonb | NO |
| created_from_version_id | uuid | YES |
| created_at | timestamp with time zone | NO |
| activated_at | timestamp with time zone | YES |
| archived_at | timestamp with time zone | YES |

## ads_optimizer_rule_packs (BASE TABLE)
| column | type | nullable |
|---|---|---|
| rule_pack_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| channel | text | NO |
| scope_type | text | NO |
| scope_value | text | YES |
| name | text | NO |
| description | text | YES |
| is_archived | boolean | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## ads_optimizer_runs (BASE TABLE)
| column | type | nullable |
|---|---|---|
| run_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| channel | text | NO |
| scope_type | text | NO |
| selected_asin | text | NO |
| run_kind | text | NO |
| date_start | date | NO |
| date_end | date | NO |
| rule_pack_version_id | uuid | NO |
| rule_pack_version_label | text | NO |
| status | text | NO |
| input_summary_json | jsonb | NO |
| diagnostics_json | jsonb | YES |
| product_snapshot_count | integer | NO |
| target_snapshot_count | integer | NO |
| recommendation_snapshot_count | integer | NO |
| role_transition_count | integer | NO |
| created_at | timestamp with time zone | NO |
| started_at | timestamp with time zone | YES |
| completed_at | timestamp with time zone | YES |

## ads_optimizer_target_snapshot (BASE TABLE)
| column | type | nullable |
|---|---|---|
| target_snapshot_id | uuid | NO |
| run_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| asin | text | NO |
| campaign_id | text | NO |
| ad_group_id | text | NO |
| target_id | text | NO |
| source_scope | text | NO |
| coverage_note | text | YES |
| snapshot_payload_json | jsonb | NO |
| created_at | timestamp with time zone | NO |

## ads_settings_snapshot_runs (BASE TABLE)
| column | type | nullable |
|---|---|---|
| snapshot_run_id | uuid | NO |
| sync_run_id | uuid | YES |
| account_id | text | NO |
| marketplace | text | NO |
| channel | text | NO |
| source_type | text | NO |
| snapshot_date | date | NO |
| exported_at | timestamp with time zone | YES |
| started_at | timestamp with time zone | YES |
| finished_at | timestamp with time zone | YES |
| status | text | NO |
| data_status | text | NO |
| entities_seen | integer | NO |
| changes_detected | integer | NO |
| log_changes_written | integer | NO |
| source_upload_id | uuid | YES |
| previous_snapshot_run_id | uuid | YES |
| summary_json | jsonb | NO |
| error_message | text | YES |
| last_refreshed_at | timestamp with time zone | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## amazon_sales_traffic_timeseries (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| sync_run_id | uuid | YES |
| ingestion_job_id | uuid | YES |
| source | text | NO |
| report_type | text | NO |
| report_id | text | YES |
| report_family | text | NO |
| granularity | text | NO |
| asin_granularity | text | NO |
| period_start | date | NO |
| period_end | date | NO |
| date | date | NO |
| parent_asin | text | YES |
| child_asin | text | YES |
| asin | text | YES |
| sku | text | YES |
| ordered_product_sales | numeric | YES |
| ordered_product_sales_currency | text | YES |
| b2b_ordered_product_sales | numeric | YES |
| units_ordered | integer | YES |
| total_order_items | integer | YES |
| shipped_product_sales | numeric | YES |
| shipped_units | integer | YES |
| refunds | integer | YES |
| refund_rate | numeric | YES |
| page_views | integer | YES |
| sessions | integer | YES |
| buy_box_percentage | numeric | YES |
| order_item_session_percentage | numeric | YES |
| unit_session_percentage | numeric | YES |
| avg_sales_price_calc | numeric | YES |
| unit_session_percentage_calc | numeric | YES |
| data_status | text | NO |
| is_final | boolean | NO |
| final_after_at | timestamp with time zone | YES |
| finalized_at | timestamp with time zone | YES |
| last_refreshed_at | timestamp with time zone | NO |
| raw_json | jsonb | NO |
| source_metadata | jsonb | NO |
| canonical_record_id | text | NO |
| source_record_index | integer | NO |
| exported_at | timestamp with time zone | NO |
| ingested_at | timestamp with time zone | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## api_connections (BASE TABLE)
| column | type | nullable |
|---|---|---|
| connection_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| source_type | text | NO |
| provider | text | NO |
| connection_name | text | NO |
| auth_secret_ref | text | YES |
| status | text | NO |
| scopes | jsonb | NO |
| metadata | jsonb | NO |
| last_verified_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## api_sync_cursors (BASE TABLE)
| column | type | nullable |
|---|---|---|
| cursor_id | uuid | NO |
| connection_id | uuid | YES |
| account_id | text | NO |
| marketplace | text | NO |
| source_type | text | NO |
| source_name | text | NO |
| scope_key | text | NO |
| cursor_kind | text | NO |
| cursor_value | text | YES |
| window_start | timestamp with time zone | YES |
| window_end | timestamp with time zone | YES |
| last_sync_run_id | uuid | YES |
| last_refreshed_at | timestamp with time zone | NO |
| metadata | jsonb | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## api_sync_runs (BASE TABLE)
| column | type | nullable |
|---|---|---|
| sync_run_id | uuid | NO |
| connection_id | uuid | YES |
| account_id | text | NO |
| marketplace | text | NO |
| source_type | text | NO |
| source_name | text | NO |
| table_name | text | NO |
| sync_kind | text | NO |
| status | text | NO |
| data_status | text | NO |
| requested_at | timestamp with time zone | NO |
| started_at | timestamp with time zone | YES |
| finished_at | timestamp with time zone | YES |
| source_window_start | timestamp with time zone | YES |
| source_window_end | timestamp with time zone | YES |
| backfill_start | date | YES |
| backfill_end | date | YES |
| rows_read | integer | YES |
| rows_written | integer | YES |
| rows_failed | integer | YES |
| error_code | text | YES |
| error_message | text | YES |
| request_json | jsonb | NO |
| result_json | jsonb | NO |
| raw_json | jsonb | YES |
| last_refreshed_at | timestamp with time zone | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## bulk_ad_groups (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| snapshot_date | date | NO |
| ad_group_id | text | NO |
| campaign_id | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| state | text | YES |
| default_bid | numeric | YES |

## bulk_campaigns (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| snapshot_date | date | NO |
| campaign_id | text | NO |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| portfolio_id | text | YES |
| state | text | YES |
| daily_budget | numeric | YES |
| bidding_strategy | text | YES |

## bulk_placements (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| snapshot_date | date | NO |
| campaign_id | text | NO |
| placement_raw | text | NO |
| placement_code | text | NO |
| percentage | numeric | NO |

## bulk_portfolios (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| snapshot_date | date | NO |
| portfolio_id | text | NO |
| portfolio_name_raw | text | NO |
| portfolio_name_norm | text | NO |

## bulk_product_ads (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| snapshot_date | date | NO |
| ad_id | text | NO |
| ad_group_id | text | NO |
| campaign_id | text | NO |
| sku_raw | text | YES |
| asin_raw | text | YES |

## bulk_sb_ad_groups (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| snapshot_date | date | NO |
| ad_group_id | text | NO |
| campaign_id | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| state | text | YES |
| default_bid | numeric | YES |

## bulk_sb_campaigns (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| snapshot_date | date | NO |
| campaign_id | text | NO |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| portfolio_id | text | YES |
| state | text | YES |
| daily_budget | numeric | YES |
| bidding_strategy | text | YES |

## bulk_sb_placements (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| snapshot_date | date | NO |
| campaign_id | text | NO |
| placement_raw | text | NO |
| placement_raw_norm | text | NO |
| placement_code | text | NO |
| percentage | numeric | NO |

## bulk_sb_targets (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| snapshot_date | date | NO |
| target_id | text | NO |
| ad_group_id | text | NO |
| campaign_id | text | NO |
| expression_raw | text | NO |
| expression_norm | text | NO |
| match_type | text | NO |
| is_negative | boolean | NO |
| state | text | YES |
| bid | numeric | YES |

## bulk_sd_ad_groups (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| snapshot_date | date | NO |
| ad_group_id | text | NO |
| campaign_id | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| state | text | YES |
| default_bid | numeric | YES |

## bulk_sd_campaigns (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| snapshot_date | date | NO |
| campaign_id | text | NO |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| portfolio_id | text | YES |
| state | text | YES |
| budget | numeric | YES |
| tactic | text | YES |
| cost_type | text | YES |
| bid_optimization | text | YES |

## bulk_sd_product_ads (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| snapshot_date | date | NO |
| ad_id | text | NO |
| ad_group_id | text | NO |
| campaign_id | text | NO |
| sku_raw | text | YES |
| asin_raw | text | YES |

## bulk_sd_targets (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| snapshot_date | date | NO |
| targeting_id | text | NO |
| ad_group_id | text | NO |
| campaign_id | text | NO |
| target_type | text | NO |
| expression_raw | text | NO |
| expression_norm | text | NO |
| bid | numeric | YES |
| bid_optimization | text | YES |
| cost_type | text | YES |
| state | text | YES |

## bulk_targets (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| snapshot_date | date | NO |
| target_id | text | NO |
| ad_group_id | text | NO |
| campaign_id | text | NO |
| expression_raw | text | NO |
| expression_norm | text | NO |
| match_type | text | NO |
| is_negative | boolean | NO |
| state | text | YES |
| bid | numeric | YES |

## campaign_name_history (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| campaign_id | text | NO |
| name_raw | text | NO |
| name_norm | text | NO |
| valid_from | date | NO |
| valid_to | date | YES |

## change_outcome_evaluations (BASE TABLE)
| column | type | nullable |
|---|---|---|
| evaluation_id | uuid | NO |
| change_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| evaluated_at | timestamp with time zone | NO |
| window_start | date | YES |
| window_end | date | YES |
| actual_result | text | YES |
| learning | text | YES |
| notes | text | YES |
| metrics_json | jsonb | YES |
| created_at | timestamp with time zone | NO |

## data_quality_checks (BASE TABLE)
| column | type | nullable |
|---|---|---|
| check_id | uuid | NO |
| sync_run_id | uuid | YES |
| account_id | text | NO |
| marketplace | text | NO |
| table_name | text | NO |
| check_name | text | NO |
| check_category | text | NO |
| status | text | NO |
| severity | text | NO |
| checked_at | timestamp with time zone | NO |
| period_start | date | YES |
| period_end | date | YES |
| rows_checked | integer | YES |
| failing_rows | integer | YES |
| metric_name | text | YES |
| expected_json | jsonb | NO |
| actual_json | jsonb | NO |
| details_json | jsonb | NO |
| message | text | YES |
| created_at | timestamp with time zone | NO |

## dim_keyword (BASE TABLE)
| column | type | nullable |
|---|---|---|
| keyword_id | uuid | NO |
| marketplace | text | NO |
| keyword_raw | text | NO |
| keyword_norm | text | NO |
| created_at | timestamp with time zone | NO |

## h10_keyword_tracker_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| marketplace_domain_raw | text | YES |
| asin | text | NO |
| title | text | YES |
| keyword_raw | text | NO |
| keyword_norm | text | NO |
| keyword_sales | integer | YES |
| search_volume | integer | YES |
| organic_rank_raw | text | YES |
| organic_rank_value | integer | YES |
| organic_rank_kind | text | NO |
| sponsored_pos_raw | text | YES |
| sponsored_pos_value | integer | YES |
| sponsored_pos_kind | text | NO |
| observed_at | timestamp without time zone | NO |
| observed_date | date | NO |
| exported_at | timestamp with time zone | NO |

## import_source_status (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| source_type | text | NO |
| last_attempted_at | timestamp with time zone | NO |
| last_original_filename | text | YES |
| last_upload_id | uuid | YES |
| ingest_status | text | NO |
| ingest_row_count | integer | YES |
| ingest_message | text | YES |
| map_status | text | NO |
| map_fact_rows | integer | YES |
| map_issue_rows | integer | YES |
| map_message | text | YES |
| unresolved | boolean | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## ingestion_jobs (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| job_key | text | NO |
| source_name | text | NO |
| account_id | text | YES |
| marketplace | text | YES |
| requested_at | timestamp with time zone | NO |
| source_window_start | timestamp with time zone | YES |
| source_window_end | timestamp with time zone | YES |
| retrieved_at | timestamp with time zone | YES |
| started_at | timestamp with time zone | YES |
| finished_at | timestamp with time zone | YES |
| processing_status | text | NO |
| run_kind | text | NO |
| idempotency_key | text | NO |
| checksum | text | YES |
| row_count | integer | YES |
| error_code | text | YES |
| error_message | text | YES |
| metadata | jsonb | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## keyword_group_members (BASE TABLE)
| column | type | nullable |
|---|---|---|
| member_id | uuid | NO |
| group_id | uuid | NO |
| group_set_id | uuid | NO |
| keyword_id | uuid | NO |
| note | text | YES |
| created_at | timestamp with time zone | NO |

## keyword_group_sets (BASE TABLE)
| column | type | nullable |
|---|---|---|
| group_set_id | uuid | NO |
| product_id | uuid | NO |
| name | text | NO |
| description | text | YES |
| is_active | boolean | NO |
| is_exclusive | boolean | NO |
| created_at | timestamp with time zone | NO |

## keyword_groups (BASE TABLE)
| column | type | nullable |
|---|---|---|
| group_id | uuid | NO |
| group_set_id | uuid | NO |
| name | text | NO |
| notes | text | YES |
| created_at | timestamp with time zone | NO |

## log_change_entities (BASE TABLE)
| column | type | nullable |
|---|---|---|
| change_entity_id | uuid | NO |
| change_id | uuid | NO |
| entity_type | text | NO |
| product_id | text | YES |
| campaign_id | text | YES |
| ad_group_id | text | YES |
| target_id | text | YES |
| keyword_id | uuid | YES |
| note | text | YES |
| extra | jsonb | YES |
| created_at | timestamp with time zone | NO |
| asin | text | YES |
| sku | text | YES |

## log_change_validations (BASE TABLE)
| column | type | nullable |
|---|---|---|
| change_id | uuid | NO |
| status | text | NO |
| expected_json | jsonb | YES |
| actual_json | jsonb | YES |
| diff_json | jsonb | YES |
| validated_upload_id | uuid | YES |
| validated_snapshot_date | date | YES |
| checked_at | timestamp with time zone | NO |
| created_at | timestamp with time zone | NO |

## log_changes (BASE TABLE)
| column | type | nullable |
|---|---|---|
| change_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| occurred_at | timestamp with time zone | NO |
| channel | text | NO |
| change_type | text | NO |
| summary | text | NO |
| why | text | YES |
| before_json | jsonb | YES |
| after_json | jsonb | YES |
| source | text | NO |
| source_upload_id | text | YES |
| created_at | timestamp with time zone | NO |
| dedupe_key | text | YES |
| entity_level | text | YES |
| field_name | text | YES |
| expected_outcome | text | YES |
| evaluation_window_days | integer | YES |
| notes | text | YES |

## log_driver_campaign_intents (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| asin_norm | text | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |
| created_by | text | YES |
| updated_by | text | YES |
| channel | text | NO |
| campaign_id | text | NO |
| intent | text | NO |
| is_driver | boolean | NO |
| notes | text | YES |
| constraints_json | jsonb | NO |

## log_evaluations (BASE TABLE)
| column | type | nullable |
|---|---|---|
| evaluation_id | uuid | NO |
| experiment_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| evaluated_at | timestamp with time zone | NO |
| window_start | date | YES |
| window_end | date | YES |
| metrics_json | jsonb | YES |
| notes | text | YES |
| created_at | timestamp with time zone | NO |

## log_experiment_changes (BASE TABLE)
| column | type | nullable |
|---|---|---|
| experiment_change_id | uuid | NO |
| experiment_id | uuid | NO |
| change_id | uuid | NO |
| created_at | timestamp with time zone | NO |

## log_experiment_events (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| experiment_id | uuid | NO |
| run_id | text | YES |
| phase_id | uuid | YES |
| event_type | text | NO |
| event_date | date | YES |
| occurred_at | timestamp with time zone | NO |
| payload_json | jsonb | NO |
| created_by | text | YES |

## log_experiment_phases (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| experiment_id | uuid | NO |
| run_id | text | NO |
| title | text | YES |
| notes | text | YES |
| effective_date | date | YES |
| uploaded_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | NO |
| created_by | text | YES |

## log_experiments (BASE TABLE)
| column | type | nullable |
|---|---|---|
| experiment_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| name | text | NO |
| objective | text | NO |
| hypothesis | text | YES |
| evaluation_lag_days | integer | YES |
| evaluation_window_days | integer | YES |
| primary_metrics | jsonb | YES |
| guardrails | jsonb | YES |
| scope | jsonb | YES |
| created_at | timestamp with time zone | NO |

## log_product_kiv_items (BASE TABLE)
| column | type | nullable |
|---|---|---|
| kiv_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| asin_norm | text | NO |
| created_at | timestamp with time zone | NO |
| created_by | text | YES |
| status | text | NO |
| title | text | NO |
| details | text | YES |
| source | text | NO |
| source_experiment_id | uuid | YES |
| tags | ARRAY | NO |
| priority | integer | YES |
| due_date | date | YES |
| resolved_at | timestamp with time zone | YES |
| resolution_notes | text | YES |

## portfolio_name_history (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| portfolio_id | text | NO |
| name_raw | text | NO |
| name_norm | text | NO |
| valid_from | date | NO |
| valid_to | date | YES |

## product_cost_history (BASE TABLE)
| column | type | nullable |
|---|---|---|
| cost_id | uuid | NO |
| sku_id | uuid | YES |
| valid_from | date | NO |
| valid_to | date | YES |
| currency | USER-DEFINED | NO |
| landed_cost_per_unit | numeric | NO |
| supplier_cost | numeric | YES |
| packaging_cost | numeric | YES |
| domestic_ship_cost | numeric | YES |
| intl_ship_cost | numeric | YES |
| duty_tax_cost | numeric | YES |
| prep_cost | numeric | YES |
| assembly_cost | numeric | YES |
| other_cost | numeric | YES |
| breakdown_lines | jsonb | YES |
| notes | text | YES |
| created_at | timestamp with time zone | YES |

## product_profile (BASE TABLE)
| column | type | nullable |
|---|---|---|
| product_id | uuid | NO |
| profile_json | jsonb | NO |
| updated_at | timestamp with time zone | YES |

## product_skus (BASE TABLE)
| column | type | nullable |
|---|---|---|
| sku_id | uuid | NO |
| product_id | uuid | YES |
| account_id | text | NO |
| marketplace | text | NO |
| sku | text | NO |
| status | USER-DEFINED | NO |
| is_bundle | boolean | NO |
| bundle_note | text | YES |
| inherits_cost_from_sku_id | uuid | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |

## products (BASE TABLE)
| column | type | nullable |
|---|---|---|
| product_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| asin | text | NO |
| status | USER-DEFINED | NO |
| brand | text | YES |
| title | text | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |

## report_data_status (BASE TABLE)
| column | type | nullable |
|---|---|---|
| status_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| table_name | text | NO |
| source_type | text | NO |
| source_name | text | NO |
| scope_key | text | NO |
| period_start | date | YES |
| period_end | date | YES |
| data_status | text | NO |
| is_final | boolean | NO |
| final_after_at | timestamp with time zone | YES |
| finalized_at | timestamp with time zone | YES |
| last_sync_run_id | uuid | YES |
| last_refreshed_at | timestamp with time zone | NO |
| row_count | integer | YES |
| coverage_json | jsonb | NO |
| warnings | jsonb | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## sb_ad_group_name_history (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| ad_group_id | text | NO |
| campaign_id | text | NO |
| name_raw | text | NO |
| name_norm | text | NO |
| valid_from | date | NO |
| valid_to | date | YES |

## sb_attributed_purchases_daily_fact (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| date | date | NO |
| campaign_id | text | NO |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| purchased_sku_raw | text | YES |
| purchased_sku_norm | text | YES |
| purchased_asin_raw | text | NO |
| purchased_asin_norm | text | NO |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| exported_at | timestamp with time zone | NO |

## sb_campaign_daily_fact (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| campaign_id | text | NO |
| portfolio_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| exported_at | timestamp with time zone | NO |

## sb_campaign_daily_fact_gold (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| campaign_id | text | NO |
| portfolio_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| exported_at | timestamp with time zone | NO |
| ingested_at | timestamp with time zone | NO |

## sb_campaign_daily_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| exported_at | timestamp with time zone | NO |

## sb_campaign_name_history (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| campaign_id | text | NO |
| name_raw | text | NO |
| name_norm | text | NO |
| valid_from | date | NO |
| valid_to | date | YES |

## sb_campaign_placement_daily_fact (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| campaign_id | text | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| placement_raw | text | NO |
| placement_raw_norm | text | NO |
| placement_code | text | NO |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sb_campaign_placement_daily_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| placement_raw | text | NO |
| placement_raw_norm | text | NO |
| placement_code | text | NO |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sb_keyword_daily_fact (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| campaign_id | text | NO |
| ad_group_id | text | NO |
| target_id | text | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| targeting_raw | text | NO |
| targeting_norm | text | NO |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sb_keyword_daily_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| targeting_raw | text | NO |
| targeting_norm | text | NO |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sb_manual_name_overrides (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| account_id | text | NO |
| entity_level | text | NO |
| entity_id | text | NO |
| name_norm | text | NO |
| valid_from | date | YES |
| valid_to | date | YES |
| notes | text | YES |
| created_at | timestamp with time zone | NO |

## sb_mapping_issues (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| account_id | text | NO |
| upload_id | uuid | NO |
| report_type | text | NO |
| entity_level | text | NO |
| issue_type | text | NO |
| key_json | jsonb | NO |
| candidates_json | jsonb | YES |
| row_count | integer | NO |
| created_at | timestamp with time zone | NO |

## sb_stis_daily_fact (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| campaign_id | text | NO |
| ad_group_id | text | NO |
| target_id | text | YES |
| target_key | text | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| targeting_raw | text | NO |
| targeting_norm | text | NO |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| customer_search_term_raw | text | NO |
| customer_search_term_norm | text | NO |
| search_term_impression_rank | integer | YES |
| search_term_impression_share | numeric | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sb_stis_daily_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| targeting_raw | text | NO |
| targeting_norm | text | NO |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| customer_search_term_raw | text | NO |
| customer_search_term_norm | text | NO |
| search_term_impression_rank | integer | YES |
| search_term_impression_share | numeric | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sd_ad_group_name_history (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| ad_group_id | text | NO |
| campaign_id | text | NO |
| name_raw | text | NO |
| name_norm | text | NO |
| valid_from | date | NO |
| valid_to | date | YES |

## sd_advertised_product_daily_fact (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| campaign_id | text | NO |
| ad_group_id | text | NO |
| ad_id | text | YES |
| ad_key | text | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| advertised_sku_raw | text | YES |
| advertised_sku_norm | text | YES |
| advertised_asin_raw | text | YES |
| advertised_asin_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sd_advertised_product_daily_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| advertised_sku_raw | text | YES |
| advertised_sku_norm | text | YES |
| advertised_asin_raw | text | YES |
| advertised_asin_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sd_campaign_daily_fact (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| campaign_id | text | NO |
| portfolio_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sd_campaign_daily_fact_gold (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| campaign_id | text | NO |
| cost_type | text | YES |
| cost_type_key | text | YES |
| cost_type_is_null | boolean | YES |
| portfolio_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |
| ingested_at | timestamp with time zone | NO |

## sd_campaign_daily_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sd_campaign_name_history (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| campaign_id | text | NO |
| name_raw | text | NO |
| name_norm | text | NO |
| valid_from | date | NO |
| valid_to | date | YES |

## sd_manual_name_overrides (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| account_id | text | NO |
| entity_level | text | NO |
| entity_id | text | NO |
| name_norm | text | NO |
| valid_from | date | YES |
| valid_to | date | YES |
| notes | text | YES |
| created_at | timestamp with time zone | NO |

## sd_mapping_issues (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| account_id | text | NO |
| upload_id | uuid | NO |
| report_type | text | NO |
| entity_level | text | NO |
| issue_type | text | NO |
| key_json | jsonb | NO |
| candidates_json | jsonb | YES |
| row_count | integer | NO |
| created_at | timestamp with time zone | NO |

## sd_matched_target_daily_fact (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| campaign_id | text | NO |
| ad_group_id | text | NO |
| target_id | text | YES |
| target_key | text | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| targeting_raw | text | NO |
| targeting_norm | text | NO |
| matched_target_raw | text | NO |
| matched_target_norm | text | NO |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sd_matched_target_daily_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| targeting_raw | text | NO |
| targeting_norm | text | NO |
| matched_target_raw | text | NO |
| matched_target_norm | text | NO |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sd_purchased_product_daily_fact (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| campaign_id | text | NO |
| ad_group_id | text | NO |
| ad_id | text | YES |
| ad_key | text | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| advertised_sku_raw | text | YES |
| advertised_sku_norm | text | YES |
| advertised_asin_raw | text | YES |
| advertised_asin_norm | text | YES |
| purchased_sku_raw | text | YES |
| purchased_sku_norm | text | YES |
| purchased_asin_raw | text | YES |
| purchased_asin_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sd_purchased_product_daily_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| purchased_sku_raw | text | YES |
| purchased_sku_norm | text | YES |
| purchased_asin_raw | text | YES |
| purchased_asin_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sd_targeting_daily_fact (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| campaign_id | text | NO |
| ad_group_id | text | NO |
| target_id | text | YES |
| target_key | text | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| targeting_raw | text | NO |
| targeting_norm | text | NO |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sd_targeting_daily_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| targeting_raw | text | NO |
| targeting_norm | text | NO |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |

## search_terms_market_weekly_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| marketplace_id | text | NO |
| week_start | date | NO |
| week_end | date | NO |
| department_name_raw | text | NO |
| department_name_norm | text | NO |
| search_term_raw | text | NO |
| search_term_norm | text | NO |
| search_frequency_rank | integer | NO |
| clicked_asin | text | NO |
| click_share_rank | integer | NO |
| click_share | numeric | NO |
| conversion_share | numeric | NO |
| exported_at | timestamp with time zone | NO |

## si_sales_trend_daily_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| asin | text | NO |
| date | date | NO |
| referral_fees | numeric | YES |
| fulfillment_fees | numeric | YES |
| cost_of_goods | numeric | YES |
| payout | numeric | YES |
| profits | numeric | YES |
| roi | numeric | YES |
| margin | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| organic_orders | integer | YES |
| organic_units | integer | YES |
| sessions | integer | YES |
| conversions | numeric | YES |
| unit_session_pct | numeric | YES |
| ppc_cost | numeric | YES |
| ppc_sales | numeric | YES |
| ppc_orders | integer | YES |
| ppc_units | integer | YES |
| ppc_impressions | integer | YES |
| ppc_clicks | integer | YES |
| cost_per_click | numeric | YES |
| ppc_conversions | numeric | YES |
| acos | numeric | YES |
| tacos | numeric | YES |
| ctr | numeric | YES |
| ppc_cost_per_order | numeric | YES |
| promotions | integer | YES |
| promotion_value | numeric | YES |
| refund_units | integer | YES |
| refund_cost | numeric | YES |
| refund_per_unit | numeric | YES |
| avg_sales_price | numeric | YES |
| exported_at | timestamp with time zone | NO |

## source_watermarks (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| source_name | text | NO |
| account_id | text | YES |
| marketplace | text | YES |
| scope_key | text | NO |
| last_requested_at | timestamp with time zone | YES |
| last_available_at | timestamp with time zone | YES |
| last_success_at | timestamp with time zone | YES |
| last_job_id | uuid | YES |
| watermark_start | timestamp with time zone | YES |
| watermark_end | timestamp with time zone | YES |
| status | text | NO |
| notes | text | YES |
| metadata | jsonb | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## sp_advertised_product_daily_fact (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| date | date | NO |
| campaign_id | text | NO |
| ad_group_id | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| advertised_asin_raw | text | NO |
| advertised_asin_norm | text | NO |
| sku_raw | text | YES |
| impressions | numeric | YES |
| clicks | numeric | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | numeric | YES |
| units | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sp_campaign_daily_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| exported_at | timestamp with time zone | NO |
| start_time | time without time zone | YES |

## sp_campaign_hourly_fact (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| start_time | time without time zone | YES |
| campaign_id | text | NO |
| portfolio_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| exported_at | timestamp with time zone | NO |

## sp_campaign_hourly_fact_gold (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| start_time | time without time zone | YES |
| start_time_key | time without time zone | YES |
| start_time_is_null | boolean | YES |
| campaign_id | text | NO |
| portfolio_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| exported_at | timestamp with time zone | NO |
| ingested_at | timestamp with time zone | NO |

## sp_category_id_map (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | bigint | NO |
| account_id | text | NO |
| category_name_norm | text | NO |
| category_id | text | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## sp_manual_name_overrides (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| account_id | text | NO |
| entity_level | text | NO |
| entity_id | text | NO |
| name_norm | text | NO |
| valid_from | date | YES |
| valid_to | date | YES |
| notes | text | YES |
| created_at | timestamp with time zone | NO |

## sp_mapping_issues (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| account_id | text | NO |
| upload_id | uuid | NO |
| report_type | text | NO |
| entity_level | text | NO |
| issue_type | text | NO |
| key_json | jsonb | NO |
| candidates_json | jsonb | YES |
| row_count | integer | NO |
| created_at | timestamp with time zone | NO |

## sp_placement_daily_fact (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| campaign_id | text | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| bidding_strategy | text | YES |
| placement_raw | text | NO |
| placement_raw_norm | text | NO |
| placement_code | text | NO |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sp_placement_daily_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| bidding_strategy | text | YES |
| placement_raw | text | NO |
| placement_code | text | NO |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| exported_at | timestamp with time zone | NO |
| placement_raw_norm | text | NO |

## sp_placement_modifier_change_log (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| upload_id | uuid | NO |
| snapshot_date | date | NO |
| exported_at | timestamp with time zone | NO |
| campaign_id | text | NO |
| placement_code | text | NO |
| placement_raw | text | YES |
| old_pct | numeric | YES |
| new_pct | numeric | NO |
| created_at | timestamp with time zone | NO |

## sp_stis_daily_fact (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| campaign_id | text | NO |
| ad_group_id | text | NO |
| target_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| targeting_raw | text | NO |
| targeting_norm | text | NO |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| customer_search_term_raw | text | NO |
| customer_search_term_norm | text | NO |
| search_term_impression_rank | integer | YES |
| search_term_impression_share | numeric | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |
| target_key | text | NO |

## sp_stis_daily_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| targeting_raw | text | NO |
| targeting_norm | text | NO |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| customer_search_term_raw | text | NO |
| customer_search_term_norm | text | NO |
| search_term_impression_rank | integer | YES |
| search_term_impression_share | numeric | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sp_targeting_daily_fact (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| campaign_id | text | NO |
| ad_group_id | text | NO |
| target_id | text | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| targeting_raw | text | NO |
| targeting_norm | text | NO |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| top_of_search_impression_share | numeric | YES |
| exported_at | timestamp with time zone | NO |

## sp_targeting_daily_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| date | date | NO |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | NO |
| campaign_name_norm | text | NO |
| ad_group_name_raw | text | NO |
| ad_group_name_norm | text | NO |
| targeting_raw | text | NO |
| targeting_norm | text | NO |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| top_of_search_impression_share | numeric | YES |
| exported_at | timestamp with time zone | NO |

## spapi_sales_and_traffic_by_asin_report_rows (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| ingestion_job_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| report_id | text | NO |
| report_family | text | NO |
| report_type | text | NO |
| section_name | text | NO |
| canonical_record_id | text | NO |
| source_record_index | integer | NO |
| report_window_start | date | NO |
| report_window_end | date | NO |
| date | date | YES |
| asin | text | YES |
| parent_asin | text | YES |
| child_asin | text | YES |
| sku | text | YES |
| ordered_product_sales_amount | numeric | YES |
| ordered_product_sales_currency | text | YES |
| units_ordered | integer | YES |
| total_order_items | integer | YES |
| sessions | integer | YES |
| page_views | integer | YES |
| buy_box_percentage | numeric | YES |
| unit_session_percentage | numeric | YES |
| row_values | jsonb | NO |
| source_metadata | jsonb | NO |
| exported_at | timestamp with time zone | NO |
| ingested_at | timestamp with time zone | NO |

## spapi_sales_and_traffic_by_date_report_rows (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| ingestion_job_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| report_id | text | NO |
| report_family | text | NO |
| report_type | text | NO |
| section_name | text | NO |
| canonical_record_id | text | NO |
| source_record_index | integer | NO |
| report_window_start | date | NO |
| report_window_end | date | NO |
| date | date | NO |
| ordered_product_sales_amount | numeric | YES |
| ordered_product_sales_currency | text | YES |
| units_ordered | integer | YES |
| total_order_items | integer | YES |
| sessions | integer | YES |
| page_views | integer | YES |
| buy_box_percentage | numeric | YES |
| unit_session_percentage | numeric | YES |
| row_values | jsonb | NO |
| source_metadata | jsonb | NO |
| exported_at | timestamp with time zone | NO |
| ingested_at | timestamp with time zone | NO |

## sqp_monthly_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| scope_type | text | NO |
| scope_value | text | NO |
| period_start | date | NO |
| period_end | date | NO |
| reporting_date | date | NO |
| search_query_raw | text | NO |
| search_query_norm | text | NO |
| search_query_score | integer | YES |
| search_query_volume | integer | YES |
| impressions_total | integer | YES |
| impressions_self | integer | YES |
| impressions_self_share | numeric | YES |
| clicks_total | integer | YES |
| clicks_rate_per_query | numeric | YES |
| clicks_self | integer | YES |
| clicks_self_share | numeric | YES |
| clicks_price_median_total | numeric | YES |
| clicks_price_median_self | numeric | YES |
| clicks_same_day_ship | integer | YES |
| clicks_1d_ship | integer | YES |
| clicks_2d_ship | integer | YES |
| cart_adds_total | integer | YES |
| cart_add_rate_per_query | numeric | YES |
| cart_adds_self | integer | YES |
| cart_adds_self_share | numeric | YES |
| cart_adds_price_median_total | numeric | YES |
| cart_adds_price_median_self | numeric | YES |
| cart_adds_same_day_ship | integer | YES |
| cart_adds_1d_ship | integer | YES |
| cart_adds_2d_ship | integer | YES |
| purchases_total | integer | YES |
| purchases_rate_per_query | numeric | YES |
| purchases_self | integer | YES |
| purchases_self_share | numeric | YES |
| purchases_price_median_total | numeric | YES |
| purchases_price_median_self | numeric | YES |
| purchases_same_day_ship | integer | YES |
| purchases_1d_ship | integer | YES |
| purchases_2d_ship | integer | YES |
| exported_at | timestamp with time zone | NO |

## sqp_weekly_raw (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| marketplace | text | NO |
| scope_type | text | NO |
| scope_value | text | NO |
| week_start | date | NO |
| week_end | date | NO |
| reporting_date | date | NO |
| search_query_raw | text | NO |
| search_query_norm | text | NO |
| search_query_score | integer | YES |
| search_query_volume | integer | YES |
| impressions_total | integer | YES |
| impressions_self | integer | YES |
| impressions_self_share | numeric | YES |
| clicks_total | integer | YES |
| clicks_rate_per_query | numeric | YES |
| clicks_self | integer | YES |
| clicks_self_share | numeric | YES |
| clicks_price_median_total | numeric | YES |
| clicks_price_median_self | numeric | YES |
| clicks_same_day_ship | integer | YES |
| clicks_1d_ship | integer | YES |
| clicks_2d_ship | integer | YES |
| cart_adds_total | integer | YES |
| cart_add_rate_per_query | numeric | YES |
| cart_adds_self | integer | YES |
| cart_adds_self_share | numeric | YES |
| cart_adds_price_median_total | numeric | YES |
| cart_adds_price_median_self | numeric | YES |
| cart_adds_same_day_ship | integer | YES |
| cart_adds_1d_ship | integer | YES |
| cart_adds_2d_ship | integer | YES |
| purchases_total | integer | YES |
| purchases_rate_per_query | numeric | YES |
| purchases_self | integer | YES |
| purchases_self_share | numeric | YES |
| purchases_price_median_total | numeric | YES |
| purchases_price_median_self | numeric | YES |
| purchases_same_day_ship | integer | YES |
| purchases_1d_ship | integer | YES |
| purchases_2d_ship | integer | YES |
| exported_at | timestamp with time zone | NO |

## ui_page_settings (BASE TABLE)
| column | type | nullable |
|---|---|---|
| account_id | text | NO |
| marketplace | text | NO |
| page_key | text | NO |
| settings | jsonb | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## uploads (BASE TABLE)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | NO |
| account_id | text | NO |
| source_type | text | NO |
| original_filename | text | NO |
| file_hash_sha256 | text | NO |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | NO |
| coverage_start | date | YES |
| coverage_end | date | YES |
| snapshot_date | date | YES |
| notes | text | YES |

## ads_campaign_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| channel | text | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| impressions | numeric | YES |
| clicks | numeric | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | numeric | YES |
| units | numeric | YES |

## ads_campaign_placement_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| channel | text | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| placement_code | text | YES |
| placement_raw | text | YES |
| placement_raw_norm | text | YES |
| impressions | bigint | YES |
| clicks | bigint | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | bigint | YES |
| units | bigint | YES |

## ads_target_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| channel | text | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| ad_group_id | text | YES |
| target_key | text | YES |
| target_id | text | YES |
| targeting_raw | text | YES |
| targeting_norm | text | YES |
| match_type_norm | text | YES |
| impressions | bigint | YES |
| clicks | bigint | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | bigint | YES |
| units | bigint | YES |
| top_of_search_impression_share | numeric | YES |

## amazon_sales_traffic_timeseries_latest (VIEW)
| column | type | nullable |
|---|---|---|
| id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| sync_run_id | uuid | YES |
| ingestion_job_id | uuid | YES |
| source | text | YES |
| report_type | text | YES |
| report_id | text | YES |
| report_family | text | YES |
| granularity | text | YES |
| asin_granularity | text | YES |
| period_start | date | YES |
| period_end | date | YES |
| date | date | YES |
| parent_asin | text | YES |
| child_asin | text | YES |
| asin | text | YES |
| sku | text | YES |
| ordered_product_sales | numeric | YES |
| ordered_product_sales_currency | text | YES |
| b2b_ordered_product_sales | numeric | YES |
| units_ordered | integer | YES |
| total_order_items | integer | YES |
| shipped_product_sales | numeric | YES |
| shipped_units | integer | YES |
| refunds | integer | YES |
| refund_rate | numeric | YES |
| page_views | integer | YES |
| sessions | integer | YES |
| buy_box_percentage | numeric | YES |
| order_item_session_percentage | numeric | YES |
| unit_session_percentage | numeric | YES |
| avg_sales_price_calc | numeric | YES |
| unit_session_percentage_calc | numeric | YES |
| data_status | text | YES |
| is_final | boolean | YES |
| final_after_at | timestamp with time zone | YES |
| finalized_at | timestamp with time zone | YES |
| last_refreshed_at | timestamp with time zone | YES |
| raw_json | jsonb | YES |
| source_metadata | jsonb | YES |
| canonical_record_id | text | YES |
| source_record_index | integer | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | YES |
| updated_at | timestamp with time zone | YES |
| rn | bigint | YES |

## bulk_targets_enriched (VIEW)
| column | type | nullable |
|---|---|---|
| account_id | text | YES |
| snapshot_date | date | YES |
| target_id | text | YES |
| ad_group_id | text | YES |
| ad_group_name_norm | text | YES |
| campaign_id | text | YES |
| campaign_name_norm | text | YES |
| expression_raw | text | YES |
| expression_norm | text | YES |
| match_type | text | YES |
| is_negative | boolean | YES |
| state | text | YES |
| bid | numeric | YES |

## h10_keyword_rank_daily_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| marketplace_domain_raw | text | YES |
| asin | text | YES |
| title | text | YES |
| keyword_raw | text | YES |
| keyword_norm | text | YES |
| keyword_sales | integer | YES |
| search_volume | integer | YES |
| organic_rank_raw | text | YES |
| organic_rank_value | integer | YES |
| organic_rank_kind | text | YES |
| sponsored_pos_raw | text | YES |
| sponsored_pos_value | integer | YES |
| sponsored_pos_kind | text | YES |
| observed_at | timestamp without time zone | YES |
| observed_date | date | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |
| rn_daily | bigint | YES |

## h10_keyword_rank_daily_with_dims (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| marketplace_domain_raw | text | YES |
| asin | text | YES |
| title | text | YES |
| keyword_raw | text | YES |
| keyword_norm | text | YES |
| keyword_sales | integer | YES |
| search_volume | integer | YES |
| organic_rank_raw | text | YES |
| organic_rank_value | integer | YES |
| organic_rank_kind | text | YES |
| sponsored_pos_raw | text | YES |
| sponsored_pos_value | integer | YES |
| sponsored_pos_kind | text | YES |
| observed_at | timestamp without time zone | YES |
| observed_date | date | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |
| rn_daily | bigint | YES |
| product_id | uuid | YES |
| keyword_id | uuid | YES |

## h10_keyword_tracker_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| marketplace_domain_raw | text | YES |
| asin | text | YES |
| title | text | YES |
| keyword_raw | text | YES |
| keyword_norm | text | YES |
| keyword_sales | integer | YES |
| search_volume | integer | YES |
| organic_rank_raw | text | YES |
| organic_rank_value | integer | YES |
| organic_rank_kind | text | YES |
| sponsored_pos_raw | text | YES |
| sponsored_pos_value | integer | YES |
| sponsored_pos_kind | text | YES |
| observed_at | timestamp without time zone | YES |
| observed_date | date | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sb_allocated_asin_spend_daily_v1 (VIEW)
| column | type | nullable |
|---|---|---|
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| purchased_asin_norm | text | YES |
| allocated_spend | numeric | YES |

## sb_allocated_asin_spend_daily_v2 (VIEW)
| column | type | nullable |
|---|---|---|
| account_id | text | YES |
| date | date | YES |
| campaign_name_norm | text | YES |
| purchased_asin_norm | text | YES |
| allocated_spend | numeric | YES |

## sb_allocated_asin_spend_daily_v3 (VIEW)
| column | type | nullable |
|---|---|---|
| account_id | text | YES |
| date | date | YES |
| join_key | text | YES |
| purchased_asin_norm | text | YES |
| allocated_spend | numeric | YES |

## sb_attributed_purchases_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| purchased_sku_raw | text | YES |
| purchased_sku_norm | text | YES |
| purchased_asin_raw | text | YES |
| purchased_asin_norm | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| exported_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sb_campaign_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| portfolio_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sb_campaign_daily_fact_latest_gold (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| portfolio_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sb_campaign_daily_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| exported_at | timestamp with time zone | YES |

## sb_campaign_placement_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| placement_raw | text | YES |
| placement_raw_norm | text | YES |
| placement_code | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sb_campaign_placement_daily_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| placement_raw | text | YES |
| placement_raw_norm | text | YES |
| placement_code | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| exported_at | timestamp with time zone | YES |

## sb_keyword_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| ad_group_id | text | YES |
| target_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| targeting_raw | text | YES |
| targeting_norm | text | YES |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sb_keyword_daily_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| targeting_raw | text | YES |
| targeting_norm | text | YES |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sb_stis_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| ad_group_id | text | YES |
| target_id | text | YES |
| target_key | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| targeting_raw | text | YES |
| targeting_norm | text | YES |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| customer_search_term_raw | text | YES |
| customer_search_term_norm | text | YES |
| search_term_impression_rank | integer | YES |
| search_term_impression_share | numeric | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sb_stis_daily_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| targeting_raw | text | YES |
| targeting_norm | text | YES |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| customer_search_term_raw | text | YES |
| customer_search_term_norm | text | YES |
| search_term_impression_rank | integer | YES |
| search_term_impression_share | numeric | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sd_advertised_product_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| ad_group_id | text | YES |
| ad_id | text | YES |
| ad_key | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| advertised_sku_raw | text | YES |
| advertised_sku_norm | text | YES |
| advertised_asin_raw | text | YES |
| advertised_asin_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sd_advertised_product_daily_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| advertised_sku_raw | text | YES |
| advertised_sku_norm | text | YES |
| advertised_asin_raw | text | YES |
| advertised_asin_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |

## sd_campaign_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| portfolio_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sd_campaign_daily_fact_latest_gold (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| portfolio_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sd_campaign_daily_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |

## sd_matched_target_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| ad_group_id | text | YES |
| target_id | text | YES |
| target_key | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| targeting_raw | text | YES |
| targeting_norm | text | YES |
| matched_target_raw | text | YES |
| matched_target_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sd_matched_target_daily_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| targeting_raw | text | YES |
| targeting_norm | text | YES |
| matched_target_raw | text | YES |
| matched_target_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |

## sd_purchased_product_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| ad_group_id | text | YES |
| ad_id | text | YES |
| ad_key | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| advertised_sku_raw | text | YES |
| advertised_sku_norm | text | YES |
| advertised_asin_raw | text | YES |
| advertised_asin_norm | text | YES |
| purchased_sku_raw | text | YES |
| purchased_sku_norm | text | YES |
| purchased_asin_raw | text | YES |
| purchased_asin_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sd_purchased_product_daily_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| purchased_sku_raw | text | YES |
| purchased_sku_norm | text | YES |
| purchased_asin_raw | text | YES |
| purchased_asin_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |

## sd_targeting_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| ad_group_id | text | YES |
| target_id | text | YES |
| target_key | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| targeting_raw | text | YES |
| targeting_norm | text | YES |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sd_targeting_daily_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| targeting_raw | text | YES |
| targeting_norm | text | YES |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| cost_type | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |

## si_sales_trend_daily_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| asin | text | YES |
| date | date | YES |
| referral_fees | numeric | YES |
| fulfillment_fees | numeric | YES |
| cost_of_goods | numeric | YES |
| payout | numeric | YES |
| profits | numeric | YES |
| roi | numeric | YES |
| margin | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| organic_orders | integer | YES |
| organic_units | integer | YES |
| sessions | integer | YES |
| conversions | numeric | YES |
| unit_session_pct | numeric | YES |
| ppc_cost | numeric | YES |
| ppc_sales | numeric | YES |
| ppc_orders | integer | YES |
| ppc_units | integer | YES |
| ppc_impressions | integer | YES |
| ppc_clicks | integer | YES |
| cost_per_click | numeric | YES |
| ppc_conversions | numeric | YES |
| acos | numeric | YES |
| tacos | numeric | YES |
| ctr | numeric | YES |
| ppc_cost_per_order | numeric | YES |
| promotions | integer | YES |
| promotion_value | numeric | YES |
| refund_units | integer | YES |
| refund_cost | numeric | YES |
| refund_per_unit | numeric | YES |
| avg_sales_price | numeric | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sp_advertised_product_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| ad_group_id | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| advertised_asin_raw | text | YES |
| advertised_asin_norm | text | YES |
| sku_raw | text | YES |
| impressions | numeric | YES |
| clicks | numeric | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | numeric | YES |
| units | numeric | YES |
| exported_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sp_campaign_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| portfolio_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| impressions | bigint | YES |
| clicks | bigint | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | bigint | YES |
| units | bigint | YES |
| exported_at | timestamp with time zone | YES |

## sp_campaign_daily_fact_latest_gold (VIEW)
| column | type | nullable |
|---|---|---|
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| portfolio_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| exported_at | timestamp with time zone | YES |

## sp_campaign_hourly_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| start_time | time without time zone | YES |
| campaign_id | text | YES |
| portfolio_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sp_campaign_hourly_fact_latest_gold (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| start_time | time without time zone | YES |
| campaign_id | text | YES |
| portfolio_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sp_campaign_hourly_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| exported_at | timestamp with time zone | YES |
| start_time | time without time zone | YES |

## sp_placement_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| bidding_strategy | text | YES |
| placement_raw | text | YES |
| placement_raw_norm | text | YES |
| placement_code | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sp_placement_daily_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| bidding_strategy | text | YES |
| placement_raw | text | YES |
| placement_code | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| exported_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sp_stis_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| ad_group_id | text | YES |
| target_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| targeting_raw | text | YES |
| targeting_norm | text | YES |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| customer_search_term_raw | text | YES |
| customer_search_term_norm | text | YES |
| search_term_impression_rank | integer | YES |
| search_term_impression_share | numeric | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |
| target_key | text | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sp_stis_daily_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| targeting_raw | text | YES |
| targeting_norm | text | YES |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| customer_search_term_raw | text | YES |
| customer_search_term_norm | text | YES |
| search_term_impression_rank | integer | YES |
| search_term_impression_share | numeric | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sp_targeting_daily_fact_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| campaign_id | text | YES |
| ad_group_id | text | YES |
| target_id | text | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| targeting_raw | text | YES |
| targeting_norm | text | YES |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| top_of_search_impression_share | numeric | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sp_targeting_daily_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| date | date | YES |
| portfolio_name_raw | text | YES |
| portfolio_name_norm | text | YES |
| campaign_name_raw | text | YES |
| campaign_name_norm | text | YES |
| ad_group_name_raw | text | YES |
| ad_group_name_norm | text | YES |
| targeting_raw | text | YES |
| targeting_norm | text | YES |
| match_type_raw | text | YES |
| match_type_norm | text | YES |
| impressions | integer | YES |
| clicks | integer | YES |
| spend | numeric | YES |
| sales | numeric | YES |
| orders | integer | YES |
| units | integer | YES |
| cpc | numeric | YES |
| ctr | numeric | YES |
| acos | numeric | YES |
| roas | numeric | YES |
| conversion_rate | numeric | YES |
| top_of_search_impression_share | numeric | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## spapi_retail_sales_traffic_by_asin_truth (VIEW)
| column | type | nullable |
|---|---|---|
| id | uuid | YES |
| ingestion_job_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| report_id | text | YES |
| report_family | text | YES |
| report_type | text | YES |
| section_name | text | YES |
| canonical_record_id | text | YES |
| source_record_index | integer | YES |
| report_window_start | date | YES |
| report_window_end | date | YES |
| date | date | YES |
| asin | text | YES |
| parent_asin | text | YES |
| child_asin | text | YES |
| sku | text | YES |
| ordered_product_sales_amount | numeric | YES |
| ordered_product_sales_currency | text | YES |
| units_ordered | integer | YES |
| total_order_items | integer | YES |
| sessions | integer | YES |
| page_views | integer | YES |
| buy_box_percentage | numeric | YES |
| unit_session_percentage | numeric | YES |
| row_values | jsonb | YES |
| source_metadata | jsonb | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| retail_truth_source | text | YES |
| legacy_sales_trend_fallback | boolean | YES |

## spapi_retail_sales_traffic_by_date_truth (VIEW)
| column | type | nullable |
|---|---|---|
| id | uuid | YES |
| ingestion_job_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| report_id | text | YES |
| report_family | text | YES |
| report_type | text | YES |
| section_name | text | YES |
| canonical_record_id | text | YES |
| source_record_index | integer | YES |
| report_window_start | date | YES |
| report_window_end | date | YES |
| date | date | YES |
| ordered_product_sales_amount | numeric | YES |
| ordered_product_sales_currency | text | YES |
| units_ordered | integer | YES |
| total_order_items | integer | YES |
| sessions | integer | YES |
| page_views | integer | YES |
| buy_box_percentage | numeric | YES |
| unit_session_percentage | numeric | YES |
| row_values | jsonb | YES |
| source_metadata | jsonb | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| retail_truth_source | text | YES |
| legacy_sales_trend_fallback | boolean | YES |

## spapi_sales_and_traffic_by_asin_latest (VIEW)
| column | type | nullable |
|---|---|---|
| id | uuid | YES |
| ingestion_job_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| report_id | text | YES |
| report_family | text | YES |
| report_type | text | YES |
| section_name | text | YES |
| canonical_record_id | text | YES |
| source_record_index | integer | YES |
| report_window_start | date | YES |
| report_window_end | date | YES |
| date | date | YES |
| asin | text | YES |
| parent_asin | text | YES |
| child_asin | text | YES |
| sku | text | YES |
| ordered_product_sales_amount | numeric | YES |
| ordered_product_sales_currency | text | YES |
| units_ordered | integer | YES |
| total_order_items | integer | YES |
| sessions | integer | YES |
| page_views | integer | YES |
| buy_box_percentage | numeric | YES |
| unit_session_percentage | numeric | YES |
| row_values | jsonb | YES |
| source_metadata | jsonb | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## spapi_sales_and_traffic_by_date_latest (VIEW)
| column | type | nullable |
|---|---|---|
| id | uuid | YES |
| ingestion_job_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| report_id | text | YES |
| report_family | text | YES |
| report_type | text | YES |
| section_name | text | YES |
| canonical_record_id | text | YES |
| source_record_index | integer | YES |
| report_window_start | date | YES |
| report_window_end | date | YES |
| date | date | YES |
| ordered_product_sales_amount | numeric | YES |
| ordered_product_sales_currency | text | YES |
| units_ordered | integer | YES |
| total_order_items | integer | YES |
| sessions | integer | YES |
| page_views | integer | YES |
| buy_box_percentage | numeric | YES |
| unit_session_percentage | numeric | YES |
| row_values | jsonb | YES |
| source_metadata | jsonb | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| rn | bigint | YES |

## sqp_focus_keywords_2026_02_07 (VIEW)
| column | type | nullable |
|---|---|---|
| marketplace | text | YES |
| search_query_norm | text | YES |

## sqp_focus_keywords_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| scope_type | text | YES |
| scope_value | text | YES |
| week_start | date | YES |
| week_end | date | YES |
| reporting_date | date | YES |
| search_query_raw | text | YES |
| search_query_norm | text | YES |
| search_query_score | integer | YES |
| search_query_volume | integer | YES |
| impressions_total | integer | YES |
| impressions_self | integer | YES |
| impressions_self_share | numeric | YES |
| clicks_total | integer | YES |
| clicks_rate_per_query | numeric | YES |
| clicks_self | integer | YES |
| clicks_self_share | numeric | YES |
| clicks_price_median_total | numeric | YES |
| clicks_price_median_self | numeric | YES |
| clicks_same_day_ship | integer | YES |
| clicks_1d_ship | integer | YES |
| clicks_2d_ship | integer | YES |
| cart_adds_total | integer | YES |
| cart_add_rate_per_query | numeric | YES |
| cart_adds_self | integer | YES |
| cart_adds_self_share | numeric | YES |
| cart_adds_price_median_total | numeric | YES |
| cart_adds_price_median_self | numeric | YES |
| cart_adds_same_day_ship | integer | YES |
| cart_adds_1d_ship | integer | YES |
| cart_adds_2d_ship | integer | YES |
| purchases_total | integer | YES |
| purchases_rate_per_query | numeric | YES |
| purchases_self | integer | YES |
| purchases_self_share | numeric | YES |
| purchases_price_median_total | numeric | YES |
| purchases_price_median_self | numeric | YES |
| purchases_same_day_ship | integer | YES |
| purchases_1d_ship | integer | YES |
| purchases_2d_ship | integer | YES |
| exported_at | timestamp with time zone | YES |
| market_ctr | numeric | YES |
| self_ctr | numeric | YES |
| market_cvr | numeric | YES |
| self_cvr | numeric | YES |
| self_impression_share_calc | numeric | YES |
| self_click_share_calc | numeric | YES |
| self_purchase_share_calc | numeric | YES |
| self_ctr_index | numeric | YES |
| self_cvr_index | numeric | YES |
| cart_add_rate_from_clicks_market | numeric | YES |
| cart_add_rate_from_clicks_self | numeric | YES |

## sqp_monthly_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| scope_type | text | YES |
| scope_value | text | YES |
| period_start | date | YES |
| period_end | date | YES |
| reporting_date | date | YES |
| search_query_raw | text | YES |
| search_query_norm | text | YES |
| search_query_score | integer | YES |
| search_query_volume | integer | YES |
| impressions_total | integer | YES |
| impressions_self | integer | YES |
| impressions_self_share | numeric | YES |
| clicks_total | integer | YES |
| clicks_rate_per_query | numeric | YES |
| clicks_self | integer | YES |
| clicks_self_share | numeric | YES |
| clicks_price_median_total | numeric | YES |
| clicks_price_median_self | numeric | YES |
| clicks_same_day_ship | integer | YES |
| clicks_1d_ship | integer | YES |
| clicks_2d_ship | integer | YES |
| cart_adds_total | integer | YES |
| cart_add_rate_per_query | numeric | YES |
| cart_adds_self | integer | YES |
| cart_adds_self_share | numeric | YES |
| cart_adds_price_median_total | numeric | YES |
| cart_adds_price_median_self | numeric | YES |
| cart_adds_same_day_ship | integer | YES |
| cart_adds_1d_ship | integer | YES |
| cart_adds_2d_ship | integer | YES |
| purchases_total | integer | YES |
| purchases_rate_per_query | numeric | YES |
| purchases_self | integer | YES |
| purchases_self_share | numeric | YES |
| purchases_price_median_total | numeric | YES |
| purchases_price_median_self | numeric | YES |
| purchases_same_day_ship | integer | YES |
| purchases_1d_ship | integer | YES |
| purchases_2d_ship | integer | YES |
| exported_at | timestamp with time zone | YES |

## sqp_monthly_latest_enriched (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| scope_type | text | YES |
| scope_value | text | YES |
| period_start | date | YES |
| period_end | date | YES |
| reporting_date | date | YES |
| search_query_raw | text | YES |
| search_query_norm | text | YES |
| search_query_score | integer | YES |
| search_query_volume | integer | YES |
| impressions_total | integer | YES |
| impressions_self | integer | YES |
| impressions_self_share | numeric | YES |
| clicks_total | integer | YES |
| clicks_rate_per_query | numeric | YES |
| clicks_self | integer | YES |
| clicks_self_share | numeric | YES |
| clicks_price_median_total | numeric | YES |
| clicks_price_median_self | numeric | YES |
| clicks_same_day_ship | integer | YES |
| clicks_1d_ship | integer | YES |
| clicks_2d_ship | integer | YES |
| cart_adds_total | integer | YES |
| cart_add_rate_per_query | numeric | YES |
| cart_adds_self | integer | YES |
| cart_adds_self_share | numeric | YES |
| cart_adds_price_median_total | numeric | YES |
| cart_adds_price_median_self | numeric | YES |
| cart_adds_same_day_ship | integer | YES |
| cart_adds_1d_ship | integer | YES |
| cart_adds_2d_ship | integer | YES |
| purchases_total | integer | YES |
| purchases_rate_per_query | numeric | YES |
| purchases_self | integer | YES |
| purchases_self_share | numeric | YES |
| purchases_price_median_total | numeric | YES |
| purchases_price_median_self | numeric | YES |
| purchases_same_day_ship | integer | YES |
| purchases_1d_ship | integer | YES |
| purchases_2d_ship | integer | YES |
| exported_at | timestamp with time zone | YES |
| market_ctr | numeric | YES |
| self_ctr | numeric | YES |
| market_cvr | numeric | YES |
| self_cvr | numeric | YES |
| self_impression_share_calc | numeric | YES |
| self_click_share_calc | numeric | YES |
| self_purchase_share_calc | numeric | YES |

## sqp_weekly_brand_agg_from_asin_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| scope_type | text | YES |
| scope_value | text | YES |
| week_start | date | YES |
| week_end | date | YES |
| reporting_date | date | YES |
| search_query_raw | text | YES |
| search_query_norm | text | YES |
| search_query_score | integer | YES |
| search_query_volume | integer | YES |
| impressions_total | integer | YES |
| impressions_self | bigint | YES |
| impressions_self_share | numeric | YES |
| clicks_total | integer | YES |
| clicks_rate_per_query | numeric | YES |
| clicks_self | bigint | YES |
| clicks_self_share | numeric | YES |
| clicks_price_median_total | numeric | YES |
| clicks_price_median_self | numeric | YES |
| clicks_same_day_ship | integer | YES |
| clicks_1d_ship | integer | YES |
| clicks_2d_ship | integer | YES |
| cart_adds_total | integer | YES |
| cart_add_rate_per_query | numeric | YES |
| cart_adds_self | bigint | YES |
| cart_adds_self_share | numeric | YES |
| cart_adds_price_median_total | numeric | YES |
| cart_adds_price_median_self | numeric | YES |
| cart_adds_same_day_ship | integer | YES |
| cart_adds_1d_ship | integer | YES |
| cart_adds_2d_ship | integer | YES |
| purchases_total | integer | YES |
| purchases_rate_per_query | numeric | YES |
| purchases_self | bigint | YES |
| purchases_self_share | numeric | YES |
| purchases_price_median_total | numeric | YES |
| purchases_price_median_self | numeric | YES |
| purchases_same_day_ship | integer | YES |
| purchases_1d_ship | integer | YES |
| purchases_2d_ship | integer | YES |
| exported_at | timestamp with time zone | YES |

## sqp_weekly_brand_continuous_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| scope_type | text | YES |
| scope_value | text | YES |
| week_start | date | YES |
| week_end | date | YES |
| reporting_date | date | YES |
| search_query_raw | text | YES |
| search_query_norm | text | YES |
| search_query_score | integer | YES |
| search_query_volume | integer | YES |
| impressions_total | integer | YES |
| impressions_self | bigint | YES |
| impressions_self_share | numeric | YES |
| clicks_total | integer | YES |
| clicks_rate_per_query | numeric | YES |
| clicks_self | bigint | YES |
| clicks_self_share | numeric | YES |
| clicks_price_median_total | numeric | YES |
| clicks_price_median_self | numeric | YES |
| clicks_same_day_ship | integer | YES |
| clicks_1d_ship | integer | YES |
| clicks_2d_ship | integer | YES |
| cart_adds_total | integer | YES |
| cart_add_rate_per_query | numeric | YES |
| cart_adds_self | bigint | YES |
| cart_adds_self_share | numeric | YES |
| cart_adds_price_median_total | numeric | YES |
| cart_adds_price_median_self | numeric | YES |
| cart_adds_same_day_ship | integer | YES |
| cart_adds_1d_ship | integer | YES |
| cart_adds_2d_ship | integer | YES |
| purchases_total | integer | YES |
| purchases_rate_per_query | numeric | YES |
| purchases_self | bigint | YES |
| purchases_self_share | numeric | YES |
| purchases_price_median_total | numeric | YES |
| purchases_price_median_self | numeric | YES |
| purchases_same_day_ship | integer | YES |
| purchases_1d_ship | integer | YES |
| purchases_2d_ship | integer | YES |
| exported_at | timestamp with time zone | YES |

## sqp_weekly_latest (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| scope_type | text | YES |
| scope_value | text | YES |
| week_start | date | YES |
| week_end | date | YES |
| reporting_date | date | YES |
| search_query_raw | text | YES |
| search_query_norm | text | YES |
| search_query_score | integer | YES |
| search_query_volume | integer | YES |
| impressions_total | integer | YES |
| impressions_self | integer | YES |
| impressions_self_share | numeric | YES |
| clicks_total | integer | YES |
| clicks_rate_per_query | numeric | YES |
| clicks_self | integer | YES |
| clicks_self_share | numeric | YES |
| clicks_price_median_total | numeric | YES |
| clicks_price_median_self | numeric | YES |
| clicks_same_day_ship | integer | YES |
| clicks_1d_ship | integer | YES |
| clicks_2d_ship | integer | YES |
| cart_adds_total | integer | YES |
| cart_add_rate_per_query | numeric | YES |
| cart_adds_self | integer | YES |
| cart_adds_self_share | numeric | YES |
| cart_adds_price_median_total | numeric | YES |
| cart_adds_price_median_self | numeric | YES |
| cart_adds_same_day_ship | integer | YES |
| cart_adds_1d_ship | integer | YES |
| cart_adds_2d_ship | integer | YES |
| purchases_total | integer | YES |
| purchases_rate_per_query | numeric | YES |
| purchases_self | integer | YES |
| purchases_self_share | numeric | YES |
| purchases_price_median_total | numeric | YES |
| purchases_price_median_self | numeric | YES |
| purchases_same_day_ship | integer | YES |
| purchases_1d_ship | integer | YES |
| purchases_2d_ship | integer | YES |
| exported_at | timestamp with time zone | YES |

## sqp_weekly_latest_enriched (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| scope_type | text | YES |
| scope_value | text | YES |
| week_start | date | YES |
| week_end | date | YES |
| reporting_date | date | YES |
| search_query_raw | text | YES |
| search_query_norm | text | YES |
| search_query_score | integer | YES |
| search_query_volume | integer | YES |
| impressions_total | integer | YES |
| impressions_self | integer | YES |
| impressions_self_share | numeric | YES |
| clicks_total | integer | YES |
| clicks_rate_per_query | numeric | YES |
| clicks_self | integer | YES |
| clicks_self_share | numeric | YES |
| clicks_price_median_total | numeric | YES |
| clicks_price_median_self | numeric | YES |
| clicks_same_day_ship | integer | YES |
| clicks_1d_ship | integer | YES |
| clicks_2d_ship | integer | YES |
| cart_adds_total | integer | YES |
| cart_add_rate_per_query | numeric | YES |
| cart_adds_self | integer | YES |
| cart_adds_self_share | numeric | YES |
| cart_adds_price_median_total | numeric | YES |
| cart_adds_price_median_self | numeric | YES |
| cart_adds_same_day_ship | integer | YES |
| cart_adds_1d_ship | integer | YES |
| cart_adds_2d_ship | integer | YES |
| purchases_total | integer | YES |
| purchases_rate_per_query | numeric | YES |
| purchases_self | integer | YES |
| purchases_self_share | numeric | YES |
| purchases_price_median_total | numeric | YES |
| purchases_price_median_self | numeric | YES |
| purchases_same_day_ship | integer | YES |
| purchases_1d_ship | integer | YES |
| purchases_2d_ship | integer | YES |
| exported_at | timestamp with time zone | YES |
| market_ctr | numeric | YES |
| self_ctr | numeric | YES |
| market_cvr | numeric | YES |
| self_cvr | numeric | YES |
| self_impression_share_calc | numeric | YES |
| self_click_share_calc | numeric | YES |
| self_purchase_share_calc | numeric | YES |
| self_ctr_index | numeric | YES |
| self_cvr_index | numeric | YES |
| cart_add_rate_from_clicks_market | numeric | YES |
| cart_add_rate_from_clicks_self | numeric | YES |

## sqp_weekly_latest_known_keywords (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| scope_type | text | YES |
| scope_value | text | YES |
| week_start | date | YES |
| week_end | date | YES |
| reporting_date | date | YES |
| search_query_raw | text | YES |
| search_query_norm | text | YES |
| search_query_score | integer | YES |
| search_query_volume | integer | YES |
| impressions_total | integer | YES |
| impressions_self | integer | YES |
| impressions_self_share | numeric | YES |
| clicks_total | integer | YES |
| clicks_rate_per_query | numeric | YES |
| clicks_self | integer | YES |
| clicks_self_share | numeric | YES |
| clicks_price_median_total | numeric | YES |
| clicks_price_median_self | numeric | YES |
| clicks_same_day_ship | integer | YES |
| clicks_1d_ship | integer | YES |
| clicks_2d_ship | integer | YES |
| cart_adds_total | integer | YES |
| cart_add_rate_per_query | numeric | YES |
| cart_adds_self | integer | YES |
| cart_adds_self_share | numeric | YES |
| cart_adds_price_median_total | numeric | YES |
| cart_adds_price_median_self | numeric | YES |
| cart_adds_same_day_ship | integer | YES |
| cart_adds_1d_ship | integer | YES |
| cart_adds_2d_ship | integer | YES |
| purchases_total | integer | YES |
| purchases_rate_per_query | numeric | YES |
| purchases_self | integer | YES |
| purchases_self_share | numeric | YES |
| purchases_price_median_total | numeric | YES |
| purchases_price_median_self | numeric | YES |
| purchases_same_day_ship | integer | YES |
| purchases_1d_ship | integer | YES |
| purchases_2d_ship | integer | YES |
| exported_at | timestamp with time zone | YES |
| keyword_id | uuid | YES |

## upload_stats (VIEW)
| column | type | nullable |
|---|---|---|
| upload_id | uuid | YES |
| account_id | text | YES |
| source_type | text | YES |
| original_filename | text | YES |
| exported_at | timestamp with time zone | YES |
| ingested_at | timestamp with time zone | YES |
| coverage_start | date | YES |
| coverage_end | date | YES |
| snapshot_date | date | YES |
| row_count | bigint | YES |

## v3_ads_settings_snapshot_rows (VIEW)
| column | type | nullable |
|---|---|---|
| account_id | text | YES |
| channel | text | YES |
| snapshot_date | date | YES |
| entity_level | text | YES |
| entity_key | text | YES |
| campaign_id | text | YES |
| ad_group_id | text | YES |
| target_id | text | YES |
| ad_id | text | YES |
| field_name | text | YES |
| field_value | text | YES |
| field_value_json | jsonb | YES |
| entity_label | text | YES |

## v_ppc_spend_reconciliation_daily (VIEW)
| column | type | nullable |
|---|---|---|
| account_id | text | YES |
| date | date | YES |
| ppc_cost_scale_insights | numeric | YES |
| spend_ads_reports | numeric | YES |
| delta | numeric | YES |
| delta_pct | numeric | YES |
| flag_large_delta | boolean | YES |

## v_product_sku_base (VIEW)
| column | type | nullable |
|---|---|---|
| product_id | uuid | YES |
| base_sku_id | uuid | YES |
| base_sku | text | YES |
| account_id | text | YES |
| marketplace | text | YES |

## v_product_sku_cost_current (VIEW)
| column | type | nullable |
|---|---|---|
| sku_id | uuid | YES |
| product_id | uuid | YES |
| account_id | text | YES |
| marketplace | text | YES |
| sku | text | YES |
| effective_sku_id | uuid | YES |
| currency | USER-DEFINED | YES |
| landed_cost_per_unit | numeric | YES |
| supplier_cost | numeric | YES |
| packaging_cost | numeric | YES |
| domestic_ship_cost | numeric | YES |
| intl_ship_cost | numeric | YES |
| duty_tax_cost | numeric | YES |
| prep_cost | numeric | YES |
| assembly_cost | numeric | YES |
| other_cost | numeric | YES |
| valid_from | date | YES |
| valid_to | date | YES |
| notes | text | YES |
