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

## Progressive Disclosure Workbench Pattern
- If helper/view-model work is feeding a dense optimizer review page, prefer shapes that support the Progressive Disclosure Workbench pattern documented in [progressive-disclosure-workbench.md](/home/albert/code/amazon-performance-hub/docs/ui-patterns/progressive-disclosure-workbench.md).
- Keep queue-facing data compact and scannable.
- Keep drawer-facing data detailed and auditable.
- Preserve explicit empty states, explicit coverage semantics, and stable sticky/frozen-table behavior by not forcing UI layers to infer missing structure at render time.
