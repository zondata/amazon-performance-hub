# S2A-07 - Implement SP-API Search Query Performance report parse + ingest

## Scope executed
- Added one bounded CLI path: `npm run spapi:sqp-parse-ingest`
- Accepted either `--report-id <value>` or `--raw-path <value>`
- Resolved deterministic local SQP raw artifacts under `out/sp-api-sqp-artifacts/` for report-id lookup
- Validated one SQP ASIN-window raw artifact before ingest
- Reused the existing SQP weekly raw ingest sink in `src/ingest/ingestSqpWeeklyRaw.ts`
- Kept the task limited to SQP only

## Files added or changed
- `src/connectors/sp-api/firstSqpParseIngest.ts`
- `src/connectors/sp-api/firstSqpParseIngestCli.ts`
- `src/connectors/sp-api/firstSqpParseIngest.test.ts`
- `src/connectors/sp-api/firstSqpParseIngestCli.test.ts`
- `src/connectors/sp-api/index.ts`
- `src/connectors/sp-api/types.ts`
- `src/testing/fixtures/sp-api/report-fixture-sqp-asin-window.sqp.raw.csv`
- `package.json`

## Validation run
- `npm test`
- `npm run spapi:sqp-parse-ingest -- --raw-path src/testing/fixtures/sp-api/report-fixture-sqp-asin-window.sqp.raw.csv`
- `npm run verify:wsl`

## Result
- `S2A-07` implementation is complete.
- The bounded CLI successfully parsed and ingested the committed SQP ASIN-window fixture through the existing SQP weekly raw ingest boundary.
- `S2A-G2` remains open because the gate still requires one first real SQP pull for one ASIN window, not only the fixture-backed implementation proof.
