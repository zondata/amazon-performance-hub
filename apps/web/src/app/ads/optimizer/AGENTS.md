# Ads Optimizer route — AGENTS

Follow:
- `docs/ads-optimizer/AGENTS.md`
- `docs/ads-optimizer/ads_optimizer_v2_build_plan.md`

## Local reminders
- This route is a new optimizer surface, not the existing Ads Workspace.
- Keep `/ads/performance` intact.
- SP only for V1.
- Feature-flag unfinished work.
- Optimizer is recommendation-first.
- V2 is a surface migration on top of the existing backend/runtime tables.
- Only `Overview` and `Targets` are primary tabs.
- `History`, `Config`, and `Outcome Review` stay available as secondary utilities.
- The shipped Phase 1 through Phase 4 work is Overview-first:
  - shared run/scope header flow
  - simplified page-level trend behavior
  - rebuilt Overview command-center UI
  - compact ranking ladder cards using the shared V2 bucket definition
  - SQP clarity improvements
  - manual hero query override per ASIN with reset-to-auto
- Saved manual hero query is the Overview source of truth when present and should flow through hero-query-dependent sections until reset.
- Reuse semantic theme tokens and shared horizontal-scroll patterns.
- Prefer linking into the current Ads Workspace draft flow instead of inventing a new execution path.
- Product-level and target-level coverage notes must be explicit.
- Keep product objective dynamic by ASIN.
- Manual overrides remain first-class.
- STIS / STIR / TOS IS and ranking are non-additive diagnostics; only show latest observed values or explicit trend metadata, never synthetic window rollups.
- Zero-click targets can legitimately show expected-unavailable search-term diagnostics; do not frame that as broken coverage by default.
- Old optimizer deep links must remain usable: normalize legacy `view=history|config|outcomes` into the V2 shell instead of breaking them.
- Prefer compact header/adjacent controls for utilities over adding more primary tabs.
- Phase 5 is the next major route/UI step:
  - build the V2 Targets row model
  - split/refactor the large Targets panel
  - move toward inline row expansion instead of re-entrenching queue + drawer as the default interaction model
