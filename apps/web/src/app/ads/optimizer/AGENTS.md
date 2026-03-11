# Ads Optimizer route — AGENTS

Follow:
- `docs/ads-optimizer/AGENTS.md`
- `docs/ads-optimizer/BUILD_PLAN.md`

## Local reminders
- This route is a new optimizer surface, not the existing Ads Workspace.
- Keep `/ads/performance` intact.
- SP only for V1.
- Feature-flag unfinished work.
- Optimizer is recommendation-first.
- Reuse semantic theme tokens and shared horizontal-scroll patterns.
- Prefer linking into the current Ads Workspace draft flow instead of inventing a new execution path.
- Product-level and target-level coverage notes must be explicit.
- STIS / STIR / TOS IS and ranking are non-additive diagnostics; only show latest observed values or explicit trend metadata, never synthetic window rollups.
- Zero-click targets can legitimately show expected-unavailable search-term diagnostics; do not frame that as broken coverage by default.
