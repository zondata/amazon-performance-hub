export type ComputePpcAttributionBridgeInput = {
  siPpcCostTotal: number;
  spAttributedSpendTotal: number;
  spAdvertisedAsinSpendTotal: number;
  spMappedCampaignSpendTotal: number;
  sbAttributedAsinSpendTotal: number;
  sbSpendTotalUnattributed: number;
  sdSpendTotalUnattributed: number;
};

export type PpcAttributionBridge = {
  si_ppc_cost_total: number;
  sp_attributed_spend_total: number;
  sp_advertised_asin_spend_total: number;
  sp_mapped_campaign_spend_total: number;
  sp_unattributed_spend_total: number;
  sb_attributed_asin_spend_total: number;
  sb_spend_total_unattributed: number;
  sd_spend_total_unattributed: number;
  si_gap_vs_sp_attributed_total: number;
  coverage: {
    sp_vs_si_pct: number | null;
    sp_advertised_vs_si_pct: number | null;
    sp_vs_sp_campaign_pct: number | null;
    sb_attributed_vs_si_pct: number | null;
  };
};

const clampNonNegative = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value;
};

const ratioOrNull = (numerator: number, denominator: number): number | null => {
  if (!(denominator > 0)) return null;
  return Number((numerator / denominator).toFixed(6));
};

export const computePpcAttributionBridge = (
  input: ComputePpcAttributionBridgeInput
): PpcAttributionBridge => {
  const siPpcCostTotal = clampNonNegative(input.siPpcCostTotal);
  const spAttributedSpendTotal = clampNonNegative(input.spAttributedSpendTotal);
  const spAdvertisedAsinSpendTotal = clampNonNegative(input.spAdvertisedAsinSpendTotal);
  const spMappedCampaignSpendTotal = clampNonNegative(input.spMappedCampaignSpendTotal);
  const sbAttributedAsinSpendTotal = clampNonNegative(input.sbAttributedAsinSpendTotal);
  const sbSpendTotalUnattributed = clampNonNegative(input.sbSpendTotalUnattributed);
  const sdSpendTotalUnattributed = clampNonNegative(input.sdSpendTotalUnattributed);

  const spUnattributedSpendTotal = Math.max(0, spMappedCampaignSpendTotal - spAttributedSpendTotal);
  const siGapVsSpAttributedTotal = Math.max(0, siPpcCostTotal - spAttributedSpendTotal);

  return {
    si_ppc_cost_total: siPpcCostTotal,
    sp_attributed_spend_total: spAttributedSpendTotal,
    sp_advertised_asin_spend_total: spAdvertisedAsinSpendTotal,
    sp_mapped_campaign_spend_total: spMappedCampaignSpendTotal,
    sp_unattributed_spend_total: spUnattributedSpendTotal,
    sb_attributed_asin_spend_total: sbAttributedAsinSpendTotal,
    sb_spend_total_unattributed: sbSpendTotalUnattributed,
    sd_spend_total_unattributed: sdSpendTotalUnattributed,
    si_gap_vs_sp_attributed_total: siGapVsSpAttributedTotal,
    coverage: {
      sp_vs_si_pct: ratioOrNull(spAttributedSpendTotal, siPpcCostTotal),
      sp_advertised_vs_si_pct: ratioOrNull(spAdvertisedAsinSpendTotal, siPpcCostTotal),
      sp_vs_sp_campaign_pct: ratioOrNull(spAttributedSpendTotal, spMappedCampaignSpendTotal),
      sb_attributed_vs_si_pct: ratioOrNull(sbAttributedAsinSpendTotal, siPpcCostTotal),
    },
  };
};
