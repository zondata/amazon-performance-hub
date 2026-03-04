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
- STIS: target-level top-of-search impression share metric. Non-additive diagnostic signal; do not average.
- STIR: target-level search term impression rank metric. Non-additive diagnostic signal; do not average.
- TOS IS: campaign-level top-of-search impression share for the placement. It is not the same metric as STIS.

## Scope Rules
- Do not average or mean STIS, STIR, or TOS IS.
- Use STIS/STIR as per-target diagnostics only.
- Use TOS IS as per-campaign placement diagnostics only.
- Placement modifier scope is campaign-level and affects all targets in the campaign.

## Why
Mixing KPI scopes (target vs campaign) creates false precision and can drive broad changes from non-comparable metrics.

## Risks
- Overstating confidence by averaging non-additive diagnostics.
- Applying target-level conclusions directly to campaign-level controls.
- Missing cross-target collateral impact when placement modifiers are changed.
