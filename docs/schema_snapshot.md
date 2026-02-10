# Supabase Schema Snapshot
Generated: 2026-02-10T10:19:28.816Z

## amazon_account (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| user_id | uuid | NO |
| name | text | NO |
| marketplace | text | NO |
| seller_id | text | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## asin (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| user_id | uuid | NO |
| marketplace | text | NO |
| asin | text | NO |
| canonical_title | text | YES |
| canonical_brand | text | YES |
| main_image_url | text | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## asin_snapshot (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| user_id | uuid | NO |
| asin_watch_id | uuid | NO |
| captured_at | timestamp with time zone | NO |
| marketplace | text | NO |
| asin | text | NO |
| title | text | YES |
| subtitle | text | YES |
| brand | text | YES |
| url | text | YES |
| is_prime | boolean | YES |
| is_new | boolean | YES |
| price_symbol | text | YES |
| price_value | numeric | YES |
| price_currency | text | YES |
| price_display | text | YES |
| main_image_url | text | YES |
| rating | numeric | YES |
| ratings_total | integer | YES |
| feature_bullets | ARRAY | YES |
| categories | jsonb | YES |
| seller_id | text | YES |
| seller_name | text | YES |
| raw_product_json | jsonb | NO |
| created_at | timestamp with time zone | NO |

## asin_watch (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| user_id | uuid | NO |
| amazon_account_id | uuid | YES |
| asin_id | uuid | NO |
| label | text | YES |
| type | text | NO |
| tags | ARRAY | YES |
| active | boolean | NO |
| cadence_unit | text | NO |
| cadence_value | integer | NO |
| next_run_at | timestamp with time zone | YES |
| last_run_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## asin_watch_notification_subscription (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| user_id | uuid | NO |
| asin_watch_id | uuid | NO |
| notification_channel_id | uuid | NO |
| created_at | timestamp with time zone | NO |

## asin_watch_rule (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| user_id | uuid | NO |
| asin_watch_id | uuid | NO |
| field_key | text | NO |
| operator | text | NO |
| threshold_numeric | numeric | YES |
| enabled | boolean | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## notification_channel (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| user_id | uuid | NO |
| type | text | NO |
| name | text | NO |
| config | jsonb | NO |
| active | boolean | NO |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## notification_event (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| user_id | uuid | NO |
| asin_watch_id | uuid | NO |
| asin_snapshot_id | uuid | YES |
| created_at | timestamp with time zone | NO |
| summary | text | NO |
| details | jsonb | YES |

## notification_event_delivery (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| user_id | uuid | NO |
| notification_event_id | uuid | NO |
| notification_channel_id | uuid | NO |
| status | text | NO |
| error_message | text | YES |
| sent_at | timestamp with time zone | YES |
| created_at | timestamp with time zone | NO |

## owner_notes (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | text | NO |
| html | text | YES |
| updated_at | timestamp with time zone | NO |

## owner_scenarios (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | uuid | NO |
| name | text | NO |
| base_name | text | YES |
| saved_at | timestamp with time zone | NO |
| snapshot | jsonb | NO |

## owner_settings (BASE TABLE)
| column | type | nullable |
|---|---|---|
| id | text | NO |
| rates | jsonb | YES |
| selected_rate_id | text | YES |
| fx | jsonb | YES |
| carton_settings | jsonb | YES |
| updated_at | timestamp with time zone | NO |
