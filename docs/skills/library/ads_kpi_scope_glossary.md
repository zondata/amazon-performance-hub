---
id: ads_kpi_scope_glossary
title: Ads KPI Scope Glossary
version: 1.0.0
tags:
  - ads
  - kpi
  - stis
  - stir
  - placement
applies_to:
  - analysis
  - planning
  - evaluation
---

## Definitions
- STIS: search term impression share from SP STIS coverage (`search_term_impression_share`). Non-additive diagnostic signal; do not average.
- STIR: search term impression rank from SP STIS coverage (`search_term_impression_rank`). Non-additive diagnostic signal; do not average.
- TOS IS: top-of-search impression share from the SP Targeting report (`top_of_search_impression_share`). It is not the same metric as STIS.

## Scope Rules
- Do not average or mean STIS, STIR, or TOS IS.
- Use STIS/STIR as search-term diagnostics. On Ads Workspace target surfaces, parent rows may show one representative child diagnostic, but that does not change the underlying search-term scope.
- In the current repo, TOS IS is available on SP target surfaces via the Targeting report. Treat it as a target-row diagnostic, not as campaign placement performance.
- Campaign-level TOS IS requires its own true campaign-grain source. Do not infer it by averaging or rolling up target rows.
- Placement modifier scope is campaign-level and affects all targets in the campaign.

## Why
Mixing KPI scopes (target vs campaign) creates false precision and can drive broad changes from non-comparable metrics.

## Risks
- Overstating confidence by averaging non-additive diagnostics.
- Applying target-level conclusions directly to campaign-level controls.
- Missing cross-target collateral impact when placement modifiers are changed.
