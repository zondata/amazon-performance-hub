---
id: bid_placement_mechanics
title: Bid-Placement Mechanics
version: 1.0.0
tags:
  - ads
  - auction
  - placement
  - bid
applies_to:
  - analysis
  - planning
  - execution
---

## SOP

### Auction floor principle
- The base bid determines auction eligibility. A bid below the auction
  floor means zero impressions, regardless of placement modifiers.
- Placement modifiers amplify the base bid for a specific placement.
  They can increase competitiveness for a placement but cannot create
  eligibility that the base bid does not provide.
- Consequence: reducing base bid to "save money" on one placement
  (e.g., Product Pages) can eliminate impressions across ALL placements,
  including profitable ones.

### Before recommending any bid change
1. Check `placement_performance` spend distribution: identify which
   placements are consuming spend and which are generating sales.
2. Verify that placement spend sums to campaign spend. If it does not,
   flag the discrepancy and avoid placement-level efficiency calculations
   until the gap is understood.
3. Cross-check placement `modifier_pct_current` against placement
   performance to assess whether modifiers are aligned with efficiency.
4. Check `top_of_search_impression_share` (STIS) for the target keyword.
   Low or declining STIS indicates the bid may already be near the
   auction floor. Further bid reduction risks losing the auction entirely.
5. Check impression volume trends. Falling impressions with unchanged
   bids suggest increased competition or market-driven bid inflation.
6. Treat placement KPIs as campaign-level only. Do not attribute
   placement outcomes to individual targets in multi-target campaigns.
7. Focus placement actions on campaigns with spend > 0.

### Bid reduction scenarios
- If a placement is spending heavily with poor efficiency (low/no
  sales), the first lever is to reduce that placement's modifier, not
  the base bid.
- Only reduce the base bid when:
  - The overall campaign ACOS is unsustainable AND
  - Modifier reductions alone cannot shift spend distribution AND
  - STIS indicates the bid is well above the auction floor
    (meaningful impression share suggests room to reduce)
- When reducing base bid, do it in small increments and monitor
  impression volume daily. If impressions drop sharply, the bid is
  near the auction floor and further reduction will collapse volume.

### Bid increase scenarios
- Increasing bids is appropriate when:
  - Conversion rate is stable/strong but traffic (impressions) has
    declined, suggesting competitive displacement.
  - STIS has dropped, confirming loss of auction competitiveness.
  - The product has margin headroom to absorb higher CPC.
- Do not increase bids to fix conversion problems.

### Ad spend spike without bid changes
- When ad spend increases but `current_bulk` bid/modifier values are
  unchanged, the likely cause is market-driven: competitors lowered
  bids or exited, causing your existing bid to win higher/more
  placements.
- Monitor for 2-5 days. If spend remains elevated and ROAS is
  acceptable, the extra visibility may be beneficial.
- If spend remains elevated and ROAS degrades, gradually reduce bid.
  Do not make a large one-time cut.

### Ads-organic reinforcement loop
- For some products, ads position directly supports organic ranking.
  Cutting ad spend may cause organic rank to fall, compounding the
  revenue loss beyond just the ad channel.
- Read `product.notes` and `product.intent` for product-specific
  context on whether this loop applies. When present, factor organic
  rank dependency into any bid reduction analysis.
- Check `ranking_baseline` trends alongside ads changes to detect
  this pattern.

## Why
The bid-placement interaction is a mechanical constraint, not a
strategy preference. Ignoring the auction floor can cause impression
collapse that no modifier adjustment can recover.

## Risks if skipped
- Lowering base bid to fix PP waste but losing all TOS and ROS
  impressions simultaneously.
- Interpreting a spend spike as waste when it is market-driven
  opportunity.
- Breaking the ads-organic flywheel on position-dependent products.
