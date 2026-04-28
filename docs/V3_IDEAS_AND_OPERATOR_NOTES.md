# V3 Ideas and Operator Notes

## Purpose

This file is the parking lot for:

- future ideas
- deferred UI
- manual operator commands
- possible improvements
- scope-drift candidates
- tasks Albert wants to remember but not build yet

Any AI or developer working on this repo must check this file before adding new features, tables, UI, automation, or workflows.

If Albert suggests an idea that might drift from the V3 core system, the AI must stop, inform Albert that the idea may cause drift, and recommend recording it in this file first unless Albert explicitly approves implementation.

## Core System Boundary

The V3 core system boundary is:

- database-first Supabase system
- API-first Amazon data ingestion
- manual upload fallback
- Sales & Traffic
- SP/SB/SD ads data
- SQP weekly/monthly
- H10 manual ranking upload
- ads settings snapshots
- ads change logbook
- manual non-ads logbook
- data coverage/freshness tracking
- MCP-readable views
- approved automation/manual pull commands

Examples of possible drift:

- dashboards before data completeness
- optimizer/recommendation engine
- complex UI
- unrelated product management tools
- new tables that duplicate existing status/logbook tables
- rebuilding old V1/V2 app behavior
- adding features without a phase plan
- changing schema before documenting why
- implementing ideas directly from chat without adding them here first

## AI Drift-Control Rules

- Check this file before implementing any new feature.
- Check `docs/v3_database_only_build_plan.md` before implementing any new phase.
- If an idea is not part of the active approved phase, add it here first.
- If Albert asks for something that may cause drift, say so clearly.
- Ask whether to record the idea here or proceed as an approved implementation.
- Do not implement deferred ideas unless Albert explicitly approves them.
- Prefer small approved phases.
- Do not create new tables unless existing tables/views cannot satisfy the requirement.
- Do not build UI unless the active approved phase explicitly includes UI.
- Do not hide drift risk behind "quick fix" wording.

## Active Operator Commands

### Manual Amazon data pull

Status: planned, not built yet.

Planned WSL commands:

```bash
npm run v3:pull:today
npm run v3:pull:recent
npm run v3:pull:ads
npm run v3:pull:sales
npm run v3:pull:sqp
npm run v3:pull:amazon -- --from YYYY-MM-DD --to YYYY-MM-DD --sources ads,sales,sqp
```

Operator notes:

- These commands are placeholders for approved future automation only.
- Do not implement them during documentation-only phases.
- Any future implementation must stay within the approved V3 phase plan.

## Deferred UI and Workflow Ideas

Status: not approved for implementation unless added to an active phase.

- operator dashboard ideas that depend on incomplete data coverage
- UI for manual uploads beyond minimal operator workflows
- broad navigation or workspace redesign
- recommendation or optimization panels
- proactive alerts that imply new automation not yet approved

## Deferred Automation and Integration Ideas

Status: record here first, then move into a phase plan only after approval.

- scheduled refresh jobs
- background ingestion daemons
- automated anomaly detection
- auto-generated recommendations
- non-approved writeback or action-taking workflows

## Schema and Workflow Notes

- Document schema changes before proposing implementation.
- Prefer existing tables, views, status tables, and logbooks over new structures.
- If a new workflow can be expressed as an operator command plus existing database tables, prefer that over building new services.
- If an idea depends on rebuilding legacy V1/V2 behavior, treat it as drift unless Albert explicitly approves it.

## Ideas Parking Lot

Add new deferred items here before implementation.

Template:

```text
- Idea:
  Reason it may drift:
  Why it is useful:
  Suggested future phase:
  Status: deferred | approved later | rejected
```

- One click manual data pull
- Copy manual upload reports features (Sales and SP ads, SB still not created) from V1 to V3
- Bulksheet create and edit campaign features for V1 to V3
