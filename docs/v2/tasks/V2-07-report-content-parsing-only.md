Task ID

V2-07

Title

Add report content parsing only

Objective

Extend the existing report-document retrieval boundary so the system can read one downloaded raw Sales and Traffic report document, decompress it if needed, parse its tabular content into a validated local structured artifact, and print a safe parsing summary, with no ingestion pipeline, no warehouse writes, no Supabase writes, and no UI.

Why this task exists

V2-04 already proved report request creation.
V2-05 already proved report status polling.
V2-06 already proved report document retrieval and bounded raw artifact writing.
The next bounded step is to prove that the downloaded report content can be parsed into a predictable local structured form, without widening into persistence or analytics layers.

In-scope files

src/connectors/sp-api/**
src/testing/fixtures/** only if needed for parser/unit tests
docs/v2/BUILD_STATUS.md
docs/v2/tasks/V2-07-report-content-parsing-only.md
package.json

Out-of-scope files

apps/web/**
src/ingestion/**
src/warehouse/**
src/marts/**
src/diagnosis/**
src/memory/**
src/changes/**
supabase/**
.env* files with real secrets
any database write
any UI or admin page
any Amazon Ads API work
any generic multi-report orchestration
any downstream business logic or KPI interpretation
any warehouse schema or migration work

Constraints

Keep the scope on report content parsing only.
Do not implement ingestion.
Do not implement database writes.
Do not add UI.
Do not add Ads API code.
Do not log secrets, tokens, raw auth headers, refresh tokens, client secrets, or full sensitive report contents.
Do not commit real response payloads or real parsed artifacts containing account-sensitive data.
Reuse the existing SP-API connector boundary style instead of scattering logic.
Keep this task bounded to the same GET_SALES_AND_TRAFFIC_REPORT family already proven in V2-04 to V2-06.
Parse into a local structured artifact only.
Do not introduce warehouse abstractions in this task.

Required implementation

1. Add one bounded report-content parsing path only

Add one bounded path that reads one raw report artifact from V2-06 and parses it into a local structured representation.

Requirements:

support exactly one bounded parsing path for the same Sales and Traffic report family already proven in earlier tasks
accept either a direct raw artifact path or a report id that resolves to the deterministic local raw artifact path already created by V2-06
limit the task to parsing proof only
avoid generic orchestration for unrelated report types

The outcome of this task is only:

raw artifact located successfully
compression handled if needed
tabular content parsed successfully
safe parsing summary printed
optional parsed local artifact written in a controlled output path for operator inspection
2. Keep boundaries intact

Extend the existing SP-API connector skeleton without collapsing responsibilities.

Preferred responsibilities:

existing request/status/document files remain focused on their current jobs
add one small parsing file for raw artifact reading, decompression, header validation, row parsing, and safe summary
add one CLI entrypoint in the same connector boundary

Do not scatter raw path logic across multiple files.

3. Keep the parsing boundary narrow

Requirements:

keep raw artifact loading isolated
keep decompression handling isolated
keep header parsing and row parsing isolated
fail with typed connector/parser errors
support only the minimum parsing flow needed to prove content structure works
keep logs safe and human-readable

Do not introduce ingestion, warehouse, UI, or KPI/analytics helpers in this task.

4. Implement one callable entrypoint

Create one explicit entrypoint for report content parsing.

Acceptable examples:

parseFirstSalesTrafficReportContent()
runFirstSpApiReportParser()

If a CLI/dev script is added, it must:

live under the SP-API connector boundary
accept a report id or raw file path input
print a redacted, human-readable parsing summary
not dump full sensitive parsed contents by default
fail with clear typed errors
5. Parse the downloaded report content into a bounded local structure

Implement the smallest parsing flow that proves content parsing works.

Requirements:

read the bounded raw artifact from V2-06
handle .gz decompression if present
interpret the document as delimited text only if that is what the downloaded file actually is
parse the header row
validate that rows align to the header structure
produce a bounded structured representation such as:
header list
row count
first N parsed rows for preview in memory only
optional parsed artifact file in JSON

Do not:

map fields into warehouse tables
normalize business concepts across datasets
compute business conclusions beyond row/header validation
write to Supabase
6. Persist only a controlled parsed artifact

If a parsed artifact is written to disk, keep the output bounded and explicit.

Requirements:

write only to a controlled local output path under the repo boundary or a clearly documented generated-output folder
use deterministic naming that includes the report id
avoid overwriting unrelated files
make the artifact easy for the operator to inspect manually

Acceptable parsed artifact examples:

JSON with headers, rowCount, and parsed rows
JSONL if clearly documented

Do not:

create warehouse-ready loaders
create DB seed files
create business dashboards
7. Parse only the minimal safe structure

Safe summary may include:

report id used
input file path
decompressed or not
detected delimiter
header count
row count
output parsed artifact path if written

Do not print:

secrets
tokens
pre-signed URLs
full raw file contents
full parsed dataset in console output
8. Add targeted unit tests

Add connector tests that verify:

raw artifact path resolution is correct
.gz decompression works for fixture data
header parsing works
row parsing aligns with header count
malformed rows raise the correct typed error or are handled according to the bounded parser rule you document
safe summary does not expose sensitive contents
parsed artifact writes to the expected bounded output path

Tests must not require real credentials or network access.

9. Add one npm script

Add one explicit script to package.json.

Required script:

spapi:parse-first-report

That script must invoke the new CLI entrypoint and nothing broader.

Forbidden changes

Do not implement ingestion.
Do not implement database or Supabase writes.
Do not add UI.
Do not expand into Ads API.
Do not refactor unrelated connector files.
Do not modify real .env* files.
Do not mark ingestion or warehouse stages complete in this task.

Required tests

npm test
npm run spapi:parse-first-report -- --report-id <real-report-id>
npm run verify:wsl

Acceptance checks

One new bounded report-content parsing path exists under src/connectors/sp-api/**
package.json contains spapi:parse-first-report
The command can read one existing downloaded raw report artifact and parse it into a bounded structured local artifact
Success output includes safe parsing summary only
If an output artifact is written, it is stored in a bounded local output path with deterministic naming
No ingestion, database, warehouse, or UI scope is added
Existing request, status, and document-retrieval paths remain intact
npm run verify:wsl passes

Required status update

Update docs/v2/BUILD_STATUS.md in the same branch:

set Current task = V2-07
keep the current stage history intact
append one task-log row for V2-07
record that V2-07 is limited to report content parsing only
set the next follow-up after V2-07 as local structured handoff or ingestion boundary definition only, not warehouse writes