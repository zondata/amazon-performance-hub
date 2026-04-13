Task ID

V2-05

Title

Add report polling and terminal status check only

Objective

Extend the existing first report-request boundary so the system can poll one existing Reports API report id until a terminal processing status is reached, then return a safe terminal status summary, with no document download, no decryption, no parsing, no ingestion, no warehouse writes, and no UI.

Why this task exists

V2-04 already proved that the system can submit one real Sales and Traffic report request and receive a report id. The next bounded step is to prove the status lifecycle boundary for that report id, without expanding into document retrieval or downstream pipeline work.

In-scope files
src/connectors/sp-api/**
src/testing/fixtures/** only if needed for unit tests around status polling, response parsing, or safe summaries
docs/v2/BUILD_STATUS.md
docs/v2/tasks/V2-05-report-polling-status-only.md
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
any report document download
any report document decryption
any report content parsing or normalization
any database write
any UI or admin page
any Amazon Ads API work
any generic multi-report orchestration

Constraints
Keep the scope on report status polling only.
Do not implement report document retrieval.
Do not implement report download URL handling beyond carrying through identifiers in memory if the API returns them.
Do not implement document decryption.
Do not implement parsing.
Do not implement ingestion.
Do not implement database writes.
Do not add UI.
Do not add Ads API code.
Do not log secrets, tokens, raw auth headers, refresh tokens, or client secrets.
Do not commit real response payloads containing account-sensitive data.
Do not require sandbox credentials.
Use the local production env already saved by the operator.
Reuse the existing SP-API connector boundary style instead of scattering logic.
Keep this task bounded to one report type and one status path.

Required implementation
1. Add one bounded report-status path only

Add one bounded path that checks the processing status for one existing Sales and Traffic report id.

Use the report id returned from V2-04 or a report id passed explicitly to the CLI.

Requirements:

support exactly one bounded report-status path for the same report type family already proven in V2-04
use the Reports API get-report operation only for status retrieval
limit the task to status lifecycle proof
avoid generic orchestration for unrelated report types

the outcome of this task is only:

report status checked successfully
terminal or current processing status returned
safe status summary printed

2. Keep auth/config boundaries intact

Extend the existing SP-API connector skeleton without collapsing responsibilities.

Preferred responsibilities:

env.ts loads and validates env
auth.ts exchanges refresh token for access token
endpoints.ts resolves region endpoint and report path constants
add one small status-polling file for request building, response parsing, wait/retry policy, and safe summary
add one CLI entrypoint in the same connector boundary

Do not scatter raw env reads across multiple files.

3. Keep the transport and polling boundary narrow

Use the same bounded transport style already established in the connector.

Requirements:

keep status request building isolated
keep status response parsing isolated
fail with typed connector errors
implement a small bounded polling loop with deterministic stop rules
support both single-check mode and bounded poll-until-terminal mode
stop at terminal status or max-attempt limit
keep logs safe and human-readable

Do not introduce download, decryption, parsing, ingestion, warehouse, or UI helpers in this task.

4. Implement one callable entrypoint

Create one explicit entrypoint for report polling and status checks.

Preferred shape:

one small function in the SP-API connector
one minimal CLI/dev entry script

Acceptable examples:

pollFirstSalesTrafficReportStatus()
runFirstSpApiReportStatusPoll()

If a CLI/dev script is added, it must:

live under the SP-API connector boundary
accept a report id input
print a redacted, human-readable status summary
not dump sensitive full payloads by default
fail with clear typed errors

5. Build one bounded get-report request path

Implement a bounded request builder for the Reports API get-report call.

Requirements:

build the request path in one dedicated function
use the report id explicitly
call the correct Reports API status endpoint
parse only the fields needed for status lifecycle proof

6. Add a bounded polling policy

Implement a minimal polling loop suitable only for proof of status lifecycle.

Requirements:

use deterministic defaults for polling interval and max attempts
allow small CLI overrides only if they are directly required for bounded operator use
support a mode that performs one immediate status check without waiting
support a mode that polls until a terminal status or max attempts is reached
recognize at least the processing states needed to separate in-progress from terminal outcomes

The terminal outcome summary may include:

report id
report type if returned
processing status
terminal reached true or false
attempt count
processing start/end timestamps if returned
report document id only as an identifier if returned by the API

Do not:

download the report document
use the reportDocumentId for retrieval
parse returned content

7. Parse only the minimal safe response

On success, parse only the fields required to prove the report status lifecycle works.

Safe summary may include:

call succeeded
region used
marketplace id used if already known in context
report id used
processing status returned
terminal reached or max attempts reached
report document id if present

Do not print:

access token
refresh token
raw authorization headers
full raw response payload by default
pre-signed download URLs

8. Add targeted unit tests

Add connector tests that verify:

get-report path resolution is correct
report id is required and validated
single-check mode parses a safe status summary
bounded polling stops on terminal status
bounded polling stops on max attempts when status stays non-terminal
non-2xx responses raise the correct typed error
malformed success payload raises the correct typed error
safe summary does not expose secrets or raw payloads

Tests must not require real credentials or network access.

9. Add one npm script

Add one explicit script to package.json.

Required script:

spapi:poll-first-report

That script must invoke the new CLI entrypoint and nothing broader.

Forbidden changes
Do not implement report document retrieval.
Do not implement pre-signed URL download logic.
Do not implement document decryption.
Do not implement content parsing or ingestion.
Do not add database or Supabase changes.
Do not add UI.
Do not expand into Ads API.
Do not refactor unrelated connector files.
Do not modify real .env* files.
Do not mark document download or ingestion stages complete in this task.

Required tests
npm test
npm run spapi:poll-first-report -- --report-id <real-report-id>
npm run verify:wsl

Acceptance checks
One new bounded report-status path exists under src/connectors/sp-api/**
package.json contains spapi:poll-first-report
The command can check one existing report id and return a safe status summary
The bounded polling mode can stop at a terminal status or max-attempt limit
Success output includes report id and processing status and does not expose secrets
No download, decryption, parsing, ingestion, database, or UI scope is added
Existing first-call and first-report-request paths remain intact
npm run verify:wsl passes

Required status update

Update docs/v2/BUILD_STATUS.md in the same branch:

set Current task = V2-05
keep the current stage history intact
append one task-log row for V2-05
record that V2-05 is limited to Reports API status polling only
set the next follow-up after V2-05 as report document retrieval only, not parsing or ingestion
