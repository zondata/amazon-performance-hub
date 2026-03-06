# Ads data helpers — AGENTS

For all Ads Workspace data-loading / aggregation work under this tree, follow:
- `docs/ads-workspace/AGENTS.md`
- `docs/ads-workspace/BUILD_PLAN.md`

## Local reminders
- Preserve KPI scope integrity.
- Do not flatten campaign placement facts into target facts.
- Product filter in SP v1 is advertised-ASIN entity inclusion, not guaranteed ASIN-only metric slicing.
- Non-additive diagnostics (STIS / STIR / TOS IS) must remain explicit and never be silently averaged.
