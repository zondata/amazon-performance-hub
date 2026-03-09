# Ads data helpers — AGENTS

For all Ads Workspace data-loading / aggregation work under this tree, follow:
- `docs/ads-workspace/AGENTS.md`
- `docs/ads-workspace/BUILD_PLAN.md`

## Local reminders
- Preserve KPI scope integrity.
- Do not flatten campaign placement facts into target facts.
- Keep STIS/STIR tied to SP STIS coverage and TOS IS tied to SP Targeting rows on target surfaces.
- Do not infer campaign-level TOS IS from target rows.
- Product filter in SP v1 is advertised-ASIN entity inclusion, not guaranteed ASIN-only metric slicing.
- Non-additive diagnostics (STIS / STIR / TOS IS) must remain explicit and never be silently averaged.
