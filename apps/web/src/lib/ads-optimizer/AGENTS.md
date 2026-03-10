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
