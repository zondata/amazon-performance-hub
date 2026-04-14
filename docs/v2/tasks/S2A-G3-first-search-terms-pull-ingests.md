# S2A-G3 - Gate: first Search Terms pull ingests successfully for one marketplace window

## Objective
Add one bounded real SP-API Search Terms pull path for one marketplace WEEK window that can:
- request the Search Terms report
- poll until terminal status
- download the raw artifact
- parse the official `GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT` artifact shape
- ingest it through one bounded Search Terms ingest path
- print one safe final summary

## Scope
- Bounded to one Search Terms marketplace window only
- Reuses the existing SP-API request/status/document patterns where practical
- Writes downloaded raw artifacts to `out/sp-api-search-terms-artifacts/`
- Ingests normalized rows through one bounded Search Terms raw-ingest boundary
- Does not widen into Search Terms orchestration, Stage 2B, warehouse, or UI work

## Delivered implementation
- `spapi:search-terms-first-real-pull-ingest` CLI wired under `src/connectors/sp-api/**`
- Official Search Terms JSON-family validation
- Deterministic raw artifact output path
- Bounded Search Terms parse+ingest path
- Minimal Search Terms raw-ingest destination required for a real upload id and normalized rows

## Real gate command
```bash
npm run spapi:search-terms-first-real-pull-ingest -- --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD>
```

## Completion rule
`S2A-G3` is not complete until the real command above succeeds end to end and the final ingest summary is captured with report id, marketplace, coverage window, row count, warnings count, and upload id.
