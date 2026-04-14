# S2A-G2 - Gate: first real SQP pull ingests successfully for one ASIN window

## Scope executed
- Added one bounded CLI path: `npm run spapi:sqp-first-real-pull-ingest`
- Accepted one bounded SQP ASIN week window via:
  - `--asin <ASIN>`
  - `--start-date <YYYY-MM-DD>`
  - `--end-date <YYYY-MM-DD>`
- Reused the existing SP-API report request, poll, and document-retrieval design pattern
- Wrote downloaded SQP raw artifacts to deterministic local paths under `out/sp-api-sqp-artifacts/`
- Handed the downloaded raw artifact into the existing `spapi:sqp-parse-ingest` boundary
- Added the minimum parser support required for the official SP-API SQP JSON artifact shape
- Kept the task limited to one SQP ASIN-window gate path only

## Files added or changed
- `src/connectors/sp-api/firstSqpRealPull.ts`
- `src/connectors/sp-api/firstSqpRealPullCli.ts`
- `src/connectors/sp-api/firstSqpRealPull.test.ts`
- `src/connectors/sp-api/firstSqpRealPullCli.test.ts`
- `src/connectors/sp-api/firstSqpParseIngest.ts`
- `src/connectors/sp-api/firstSqpParseIngest.test.ts`
- `src/connectors/sp-api/index.ts`
- `src/connectors/sp-api/types.ts`
- `src/sqp/parseSqpReport.ts`
- `package.json`

## Validation run
- `npm test -- src/connectors/sp-api/firstSqpRealPull.test.ts src/connectors/sp-api/firstSqpRealPullCli.test.ts src/connectors/sp-api/firstSqpParseIngest.test.ts src/connectors/sp-api/firstSqpParseIngestCli.test.ts`
- `npm run spapi:sqp-first-real-pull-ingest -- --asin B0FYPRWPN1 --start-date 2026-04-05 --end-date 2026-04-11`
- `npm test`
- `npm run verify:wsl`

## Result
- `S2A-G2` is complete.
- The real gate proof command succeeded with:
  - `reportId = 485937020557`
  - `scopeType = asin`
  - `scopeValue = B0FYPRWPN1`
  - `coverage = 2026-04-05 -> 2026-04-11`
  - `rowCount = 53`
  - `warningsCount = 0`
  - `uploadId = f0f533b2-b856-4b2c-9e5f-1aae58f7bcfe`
- The bounded real SQP request, poll, download, and ingest path is now proven for one ASIN window.
