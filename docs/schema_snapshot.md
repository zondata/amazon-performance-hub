# Supabase Schema Snapshot
Generated: 2026-02-14T02:18:08.052Z

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
