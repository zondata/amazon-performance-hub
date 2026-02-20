import { coerceFloat, coerceInt } from './normalizeSqpValue';

type SqpRow = Record<string, unknown>;

const INT_FIELDS = [
  'search_query_score',
  'search_query_volume',
  'impressions_total',
  'clicks_total',
  'cart_adds_total',
  'purchases_total',
  'clicks_same_day_ship',
  'clicks_1d_ship',
  'clicks_2d_ship',
  'cart_adds_same_day_ship',
  'cart_adds_1d_ship',
  'cart_adds_2d_ship',
  'purchases_same_day_ship',
  'purchases_1d_ship',
  'purchases_2d_ship',
];

const BIGINT_FIELDS = [
  'impressions_self',
  'clicks_self',
  'cart_adds_self',
  'purchases_self',
];

const NUMERIC_FIELDS = [
  'impressions_self_share',
  'clicks_rate_per_query',
  'clicks_self_share',
  'clicks_price_median_total',
  'clicks_price_median_self',
  'cart_add_rate_per_query',
  'cart_adds_self_share',
  'cart_adds_price_median_total',
  'cart_adds_price_median_self',
  'purchases_rate_per_query',
  'purchases_self_share',
  'purchases_price_median_total',
  'purchases_price_median_self',
];

export const normalizeSqpRow = <T extends SqpRow>(row: T): T => {
  const next = { ...row } as T;
  INT_FIELDS.forEach((field) => {
    if (field in next) {
      const value = coerceInt(next[field]);
      (next as Record<string, unknown>)[field] = value;
    }
  });
  BIGINT_FIELDS.forEach((field) => {
    if (field in next) {
      const value = coerceInt(next[field]);
      (next as Record<string, unknown>)[field] = value;
    }
  });
  NUMERIC_FIELDS.forEach((field) => {
    if (field in next) {
      const value = coerceFloat(next[field]);
      (next as Record<string, unknown>)[field] = value;
    }
  });
  return next;
};

export { coerceInt };
