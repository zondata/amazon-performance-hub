---
id: keyword_lifecycle
title: Keyword Lifecycle Management
version: 1.0.0
tags:
  - ads
  - keywords
  - targeting
  - optimization
applies_to:
  - analysis
  - planning
---

## SOP

### Classify each keyword by lifecycle stage
Use `targets` data (spend, sales, orders, clicks, cvr, STIS) and
available trend data to classify keywords into stages:

- **Proven converter**: consistent orders over the window, CVR in line
  with or above product average. Protect these.
- **Promising but insufficient data**: some clicks but below the
  minimum evaluation threshold. Be patient.
- **Spend-without-conversion**: accumulated clicks exceed the evaluation
  threshold with zero orders. Candidate for bid reduction or pause.
- **Previously converting, now stopped**: had orders in prior periods
  but zero in the current window. Requires diagnosis before action.
- **Low volume / slow drip**: very low daily spend (under ~$2/day),
  accumulating clicks slowly. Evaluate on longer windows.

### Minimum evaluation threshold
- Do not judge a keyword's conversion potential until it has accumulated
  enough clicks for a fair test relative to the product's baseline CVR.
- Guideline: if the product converts at ~10% (1 in 10 clicks), a
  keyword needs at least 10-15 clicks before concluding it does not
  convert. For lower CVR products, the threshold is proportionally
  higher.
- For low-volume keywords spending <$2/day, extend the evaluation window
  to 14-30 days to accumulate sufficient clicks. Do not evaluate daily.
- If a keyword has 5 clicks over 27 days with $4 spend, it has not been
  tested — it has been dormant. Do not pause for non-conversion.

### Handling previously converting keywords
- When a keyword has historical orders but zero in the current window:
  1. Check impression volume first. If impressions dropped significantly,
     this is a traffic problem (lost auction position), not a conversion
     failure.
  2. Check STIS if available. Declining STIS confirms auction
     displacement.
  3. Check if the keyword's bid was recently reduced or if competitors
     may have increased bids.
  4. Do not immediately pause. If the keyword converted before, the
     demand signal was real. Consider restoring bid to previous levels
     or monitoring for one more evaluation window.

### Keywords with high spend and no sales
- These are the clearest optimization targets, but apply the evaluation
  threshold first.
- For targets that have genuinely accumulated enough clicks (e.g., 15+
  clicks, zero orders) over 14+ days: reduce bid by 20-30% as a first
  step rather than immediate pause.
- For auto-targeting clauses (substitutes, complements, loose-match):
  these can have lower CVR by nature. Use a more generous threshold
  before cutting.

### Keyword harvesting (when flagged as opportunity)
- Identify winning signals from `sqp_baseline`: queries where
  `self_purchase_share_calc > 0` indicate the product is already
  converting on that query organically or through broad/auto targeting.
- Cross-reference with existing `targets` to avoid duplicating
  already-targeted keywords.
- New keywords from harvesting should start with conservative bids
  and be tracked as a separate experiment for evaluation.
- Flag harvesting opportunities in `kiv_items` when the current
  experiment scope is focused on optimization rather than expansion.

## Why
Keywords at different lifecycle stages require fundamentally different
treatment. Treating a data-starved keyword the same as a proven loser
kills potential. Treating a declining keyword as dead without diagnosing
the cause wastes historical investment.

## Risks if skipped
- Pausing keywords before they have had a fair test (false negatives).
- Bleeding spend on genuinely non-converting keywords because the
  accumulation threshold was never applied (slow death by a thousand
  cuts).
- Losing previously profitable keywords to temporary auction shifts
  that could have been recovered with a bid adjustment.
