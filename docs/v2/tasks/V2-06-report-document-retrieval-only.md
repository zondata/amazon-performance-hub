Task ID

V2-06

Title

Add report document retrieval only

Objective

Extend the existing first report-request and report-status boundaries so the system can retrieve the report document metadata and download the raw report document bytes for one completed Sales and Traffic report, with no decryption beyond what the API/document flow minimally requires for access, no parsing, no normalization, no ingestion, no warehouse writes, and no UI.

Why this task exists

V2-04 already proved that the system can submit one real Sales and Traffic report request and receive a report id. V2-05 already proved that the system can poll one report id until a terminal status is reached. The next bounded step is to prove the document retrieval boundary for a completed report, without expanding into content parsing or downstream pipeline work.

In-scope files
src/connectors/sp-api/**
src/testing/fixtures/** only if needed for unit tests around document retrieval, safe metadata handling, or raw content persistence
docs/v2/BUILD_STATUS.md
docs/v2/tasks/V2-06-report-document-retrieval-only.md
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
any report content parsing or normalization
any database write
any UI or admin page
any Amazon Ads API work
any generic multi-report orchestration
any downstream business logic that interprets the report content

Constraints
Keep the scope on report document retrieval only.
Do not implement content parsing.
Do not implement normalization.
Do not implement ingestion.
Do not implement database writes.
Do not add UI.
Do not add Ads API code.
Do not log secrets, tokens, raw auth headers, refresh tokens, client secrets, or pre-signed document URLs.
Do not commit real response payloads or raw downloaded report files containing account-sensitive data.
Do not require sandbox credentials.
Use the local production env already saved by the operator.
Reuse the existing SP-API connector boundary style instead of scattering logic.
Keep this task bounded to one report type family and one document retrieval path.
Do not introduce parsing or warehouse abstractions in this task.

Required implementation
1. Add one bounded report-document retrieval path only

Add one bounded path that retrieves the document metadata for one completed Sales and Traffic report and downloads the raw report document payload.

Use a report id that has already reached terminal status in V2-05 or a report id passed explicitly to the CLI.

Requirements:

support exactly one bounded document-retrieval path for the same report type family already proven in V2-04 and V2-05
use the Reports API document retrieval flow only after the report is already terminal and has a reportDocumentId
limit the task to retrieval proof
avoid generic orchestration for unrelated report types

the outcome of this task is only:

report document metadata retrieved successfully
raw document bytes downloaded successfully
safe summary printed
optional raw artifact written locally in a controlled output path for operator inspection

2. Keep auth/config boundaries intact

Extend the existing SP-API connector skeleton without collapsing responsibilities.

Preferred responsibilities:

env.ts loads and validates env
auth.ts exchanges refresh token for access token
endpoints.ts resolves region endpoint and report path constants
existing status/request files remain focused on their existing jobs
add one small document-retrieval file for metadata retrieval, safe download handling, and safe summary
add one CLI entrypoint in the same connector boundary

Do not scatter raw env reads across multiple files.

3. Keep the retrieval boundary narrow

Use the same bounded transport style already established in the connector.

Requirements:

keep get-report and get-report-document request building isolated
keep document metadata parsing isolated
keep raw download handling isolated
fail with typed connector errors
support only the minimum download flow needed to prove retrieval works
keep logs safe and human-readable

Do not introduce parsing, normalization, ingestion, warehouse, or UI helpers in this task.

4. Implement one callable entrypoint

Create one explicit entrypoint for report document retrieval.

Preferred shape:

one small function in the SP-API connector
one minimal CLI/dev entry script

Acceptable examples:

fetchFirstSalesTrafficReportDocument()
runFirstSpApiReportDocumentFetch()

If a CLI/dev script is added, it must:

live under the SP-API connector boundary
accept a report id input
print a redacted, human-readable retrieval summary
not dump sensitive full payloads by default
fail with clear typed errors

5. Build one bounded document retrieval flow

Implement the smallest flow that proves report-document retrieval works.

Requirements:

use the existing report-status path or direct get-report call to obtain a reportDocumentId for a completed report
call the correct Reports API getReportDocument operation
retrieve only the metadata needed to download the document
perform the raw document download using the returned document information
support the compression/encryption handling only to the minimal extent required to obtain the raw document contents safely
keep all content handling byte-oriented or text-as-received; do not parse business rows into structured records

6. Persist only a controlled raw artifact

If the raw document is written to disk, keep the output bounded and explicit.

Requirements:

write only to a controlled local output path under the repo boundary or a clearly documented generated-output folder
use deterministic naming that includes the report id
avoid overwriting unrelated files
make the artifact easy for the operator to inspect manually

The saved artifact may be one of:

raw downloaded content as received
minimally decompressed content if decompression is required before the operator can inspect it

Do not:

convert to warehouse rows
normalize columns
parse TSV/CSV into domain records
write to Supabase

7. Parse only the minimal safe metadata response

On success, parse only the fields required to prove document retrieval works.

Safe summary may include:

call succeeded
report id used
processing status if checked
report document id used
compression algorithm if returned
output file path
downloaded byte count
content type if returned

Do not print:

access token
refresh token
raw authorization headers
full raw response payload by default
pre-signed download URLs
full sensitive file contents in console output

8. Add targeted unit tests

Add connector tests that verify:

report document id extraction is correct for a completed report
get-report-document path resolution is correct
safe metadata parsing returns a redacted retrieval summary
raw download handler writes to the expected bounded output path
non-2xx responses raise the correct typed error
malformed success payload raises the correct typed error
safe summary does not expose secrets or pre-signed URLs

Tests must not require real credentials or network access.

9. Add one npm script

Add one explicit script to package.json.

Required script:

spapi:get-first-report-document

That script must invoke the new CLI entrypoint and nothing broader.

Forbidden changes
Do not implement report content parsing.
Do not implement normalization.
Do not implement ingestion.
Do not add database or Supabase changes.
Do not add UI.
Do not expand into Ads API.
Do not refactor unrelated connector files.
Do not modify real .env* files.
Do not mark parsing or ingestion stages complete in this task.

Required tests
npm test
npm run spapi:get-first-report-document -- --report-id <real-report-id>
npm run verify:wsl

Acceptance checks
One new bounded report-document retrieval path exists under src/connectors/sp-api/**
package.json contains spapi:get-first-report-document
The command can retrieve document metadata and download the raw document for one existing completed report id
Success output includes report id and report document id and does not expose secrets or pre-signed URLs
If an output artifact is written, it is stored in a bounded local output path with deterministic naming
No parsing, normalization, ingestion, database, or UI scope is added
Existing first-call, first-report-request, and report-status paths remain intact
npm run verify:wsl passes

Required status update

Update docs/v2/BUILD_STATUS.md in the same branch:

set Current task = V2-06
keep the current stage history intact
append one task-log row for V2-06
record that V2-06 is limited to report document retrieval only
set the next follow-up after V2-06 as report content parsing only, not ingestion or warehouse writes
