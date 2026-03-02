---
id: diagnosis_before_action
title: Diagnosis Before Action
version: 1.0.0
tags:
  - analysis
  - framework
  - risk
applies_to:
  - analysis
  - evaluation
---

## SOP

### Step 1: Assess overall health first
- After restating `computed_summary` (per prompt template), assess the trajectory
  from `sales_trend_daily`: sales, spend, profit, margin, and TACOS over the full window.
- Classify the trajectory: improving, stable, or deteriorating.
- If stable and profitable, the default recommendation is "do nothing."
  Proposing changes on a stable product requires a bounded hypothesis
  with predicted outcome and success criteria.

### Step 2: Diagnose traffic vs. conversion
- When a KPI decline is detected, classify the root cause before
  recommending action:
  - Traffic problem: sessions/impressions falling, conversion rate stable
    or unchanged. Check `ranking_baseline` trends and `sqp_baseline`
    impression share for confirming signals.
  - Conversion problem: sessions/impressions stable, conversion rate
    falling. Check if pricing, reviews, or listing changes may explain it.
  - Mixed: both signals present. Separate the two in the analysis and
    address them independently.
- Do not recommend bid increases to fix conversion problems.
- Do not recommend listing changes to fix traffic problems caused by
  auction displacement.

### Step 3: Distinguish market-driven vs. action-driven changes
- If ad spend changed but bids and modifiers are unchanged
  (`current_bulk` values have not moved), suspect a market-driven shift
  (competitor bid changes, seasonal demand). Confirm with STIS trends
  and impression volume.
- Market-driven changes often self-correct within days. Recommend
  monitoring (2-5 days) before acting unless spend is clearly
  unsustainable.
- If the operator recently made changes (check `experiments` and
  product change history), attribute the shift to those changes first.

### Step 4: Trust the data window boundaries
- The system already excludes recent unfinalised days from the data
  pack (controlled by `metadata.exclude_last_days`, default 2).
  All dates within `window.start` to `window.end` can be treated
  as finalised.
- Do not add your own finalization disclaimers or treat the last
  days in the window as provisional.
- If `metadata.exclude_last_days` is present, you may reference it
  to explain why the window ends before today, but do not second-guess
  the boundary.

### Step 5: State the diagnosis before any recommendation
- Every recommendation must be preceded by an explicit diagnosis:
  what changed, why (traffic/conversion/market), and the evidence.
- If the evidence is insufficient, say so and recommend what additional
  data would clarify the picture.
- If a `computed_summary` section shows "unknown due to missing data",
  do not guess values for that section. State the limitation and work
  with what is available.

## Why
Acting without diagnosis leads to solving the wrong problem. Lowering
bids for a conversion problem wastes opportunity. Changing listings for
an auction displacement issue misses the real cause.

## Risks if skipped
- Treating symptoms instead of causes.
- Making changes that compound existing problems.
- Unnecessary changes on a stable product that introduce volatility.
