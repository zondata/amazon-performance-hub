# Ads Optimizer data/helpers — AGENTS

Follow:
- `docs/ads-optimizer/AGENTS.md`
- `docs/ads-optimizer/BUILD_PLAN.md`

## Local reminders
- Use only optimizer-prefixed tables for optimizer state.
- Keep recommendation logic deterministic and auditable.
- Reuse existing ads facts; do not mutate them.
- Recommendation outputs need reason codes, coverage flags, and stable identities.
- Preserve KPI scope integrity for placement and target metrics.
- Treat STIS / STIR / TOS IS and ranking as non-additive diagnostics: latest observed values and explicit trends only.
- Do not let non-additive diagnostics silently become default V1 scoring math.
- Expected absence of search-term diagnostics on zero-click targets is normal availability behavior unless other inputs make it suspicious.
