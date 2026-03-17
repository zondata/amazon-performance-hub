# Ads Optimizer data/helpers — AGENTS

Follow:
- `docs/ads-optimizer/AGENTS.md`
- `docs/ads-optimizer/ads_optimizer_v2_build_plan.md`

## Local reminders
- Use only optimizer-prefixed tables for optimizer state.
- Keep recommendation logic deterministic and auditable.
- Reuse existing ads facts; do not mutate them.
- Recommendation outputs need reason codes, coverage flags, and stable identities.
- V2 keeps the V1 backend; prefer adapting view models and helpers over replacing persistence or engines.
- Support a shell contract with only two primary tabs: `overview` and `targets`.
- Support `history`, `config`, and `outcomes` as secondary utility surfaces.
- Keep legacy optimizer `view=` links normalizable into the new shell contract.
- Preserve KPI scope integrity for placement and target metrics.
- Treat STIS / STIR / TOS IS and ranking as non-additive diagnostics: latest observed values and explicit trends only.
- Do not let non-additive diagnostics silently become default V1 scoring math.
- Expected absence of search-term diagnostics on zero-click targets is normal availability behavior unless other inputs make it suspicious.
- Keep the shared V2 ranking ladder definition centralized: page 1 numeric splits (`1-2`, `3-5`, `6-10`, `11-20`, `21-45`) followed by page-based buckets (`Page 2` through `Page 7`), with signed count deltas instead of percentages or average rank.
- For V2 review surfaces, prefer compact summary payloads for collapsed states and explicit detail payloads for advanced/expanded states.
- Preserve explicit lazy-detail boundaries, stable row identity, and explicit empty-state coverage semantics so the UI does not have to infer missing structure.
