export type SqpEnrichableRow = {
  impressions_total?: number | string | null;
  impressions_self?: number | string | null;
  clicks_total?: number | string | null;
  clicks_self?: number | string | null;
  purchases_total?: number | string | null;
  purchases_self?: number | string | null;
  cart_adds_total?: number | string | null;
  cart_adds_self?: number | string | null;
};

type SqpEnrichedMetrics = {
  market_ctr: number | null;
  self_ctr: number | null;
  market_cvr: number | null;
  self_cvr: number | null;
  self_ctr_index: number | null;
  self_cvr_index: number | null;
  cart_add_rate_from_clicks_market: number | null;
  cart_add_rate_from_clicks_self: number | null;
};

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const enrichSqpRow = <T extends SqpEnrichableRow>(row: T): T & SqpEnrichedMetrics => {
  const impressionsTotal = toNumber(row.impressions_total);
  const impressionsSelf = toNumber(row.impressions_self);
  const clicksTotal = toNumber(row.clicks_total);
  const clicksSelf = toNumber(row.clicks_self);
  const purchasesTotal = toNumber(row.purchases_total);
  const purchasesSelf = toNumber(row.purchases_self);
  const cartAddsTotal = toNumber(row.cart_adds_total);
  const cartAddsSelf = toNumber(row.cart_adds_self);

  const marketCtr =
    impressionsTotal === null || impressionsTotal === 0 || clicksTotal === null
      ? null
      : clicksTotal / impressionsTotal;

  const selfCtr =
    impressionsSelf === null || impressionsSelf === 0 || clicksSelf === null
      ? null
      : clicksSelf / impressionsSelf;

  const marketCvr =
    clicksTotal === null || clicksTotal === 0 || purchasesTotal === null
      ? null
      : purchasesTotal / clicksTotal;

  const selfCvr =
    clicksSelf === null || clicksSelf === 0 || purchasesSelf === null
      ? null
      : purchasesSelf / clicksSelf;

  const selfCtrIndex = (() => {
    if (impressionsTotal === null || impressionsTotal === 0) return null;
    if (impressionsSelf === null || impressionsSelf === 0) return null;
    if (clicksTotal === null || clicksSelf === null) return null;
    const base = clicksTotal / impressionsTotal;
    if (base === 0) return null;
    return (clicksSelf / impressionsSelf) / base;
  })();

  const selfCvrIndex = (() => {
    if (clicksTotal === null || clicksTotal === 0) return null;
    if (clicksSelf === null || clicksSelf === 0) return null;
    if (purchasesTotal === null || purchasesSelf === null) return null;
    const base = purchasesTotal / clicksTotal;
    if (base === 0) return null;
    return (purchasesSelf / clicksSelf) / base;
  })();

  const cartAddRateFromClicksMarket =
    clicksTotal === null || clicksTotal === 0 || cartAddsTotal === null
      ? null
      : cartAddsTotal / clicksTotal;

  const cartAddRateFromClicksSelf =
    clicksSelf === null || clicksSelf === 0 || cartAddsSelf === null
      ? null
      : cartAddsSelf / clicksSelf;

  return {
    ...row,
    market_ctr: marketCtr,
    self_ctr: selfCtr,
    market_cvr: marketCvr,
    self_cvr: selfCvr,
    self_ctr_index: selfCtrIndex,
    self_cvr_index: selfCvrIndex,
    cart_add_rate_from_clicks_market: cartAddRateFromClicksMarket,
    cart_add_rate_from_clicks_self: cartAddRateFromClicksSelf,
  };
};

export type { SqpEnrichedMetrics };
