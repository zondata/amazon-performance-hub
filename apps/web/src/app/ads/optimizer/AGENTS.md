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

## Progressive Disclosure Workbench Pattern
- For dense optimizer review surfaces, prefer the Progressive Disclosure Workbench pattern documented in [progressive-disclosure-workbench.md](/home/albert/code/amazon-performance-hub/docs/ui-patterns/progressive-disclosure-workbench.md).
- Keep top/context sections compact or collapsed by default on desktop.
- Let the main queue + drawer workbench own most of the viewport height.
- Make queue scroll ownership, drawer scroll ownership, sticky headers, and any frozen first column attach to the real pane-level scroller, not the page shell.
- On mobile/tablet, prefer the simpler single-scroll fallback over nested-scroll traps.
