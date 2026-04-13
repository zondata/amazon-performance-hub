Task ID

V2-04

Title

Make the first real SP-API report request only

Objective

Use the existing SP-API auth and first-call boundary to submit exactly one real SP-API report request for the first retail Sales and Traffic report, with no polling, no document download, no parsing, no ingestion, no warehouse writes, and no UI.

Why this task exists

V2 has already proven env loading, token exchange, and one real read call. The next bounded step is to prove the first Reports API request path works for retail performance data, without expanding into the rest of the reporting pipeline.

In-scope files
src/connectors/sp-api/**
src/testing/fixtures/** only if needed for unit tests around request shaping or safe response handling
docs/v2/BUILD_STATUS.md
docs/v2/tasks/V2-04-first-report-request.md
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
any Amazon write/execution code outside the single report request path
any report polling/status loop
any report document download
any report parsing or normalization
any database write
any UI or admin page
any Amazon Ads API work
Constraints
Make exactly one minimal real SP-API report request path.
Do not implement report polling.
Do not implement report download.
Do not implement parsing.
Do not implement ingestion.
Do not implement database writes.
Do not add UI.
Do not add Ads API code.
Do not log secrets, tokens, raw auth headers, refresh tokens, or client secrets.
Do not commit real response payloads containing account-sensitive data.
Do not require sandbox credentials.
Use the local production env already saved by the operator.
Keep the scope on proof-of-report-request only.
Reuse the existing SP-API connector boundary style instead of scattering logic.
Required implementation
1. Choose one minimal report request only

Add one bounded path that submits one retail Sales and Traffic report request.

Use one report type only.

Requirements:

choose the first report type intentionally for retail Sales and Traffic
document the exact report type constant in code
do not add support for multiple report types in this task
do not add generic report orchestration

The outcome of this task is only:

request submitted successfully
report id returned
safe summary printed
2. Keep auth/config boundaries intact

Extend the existing SP-API connector skeleton without collapsing responsibilities.

Preferred responsibilities:

env.ts loads and validates env
auth.ts exchanges refresh token for access token
endpoints.ts resolves region endpoint and report path constants
add one small report-request file for request building, response parsing, and safe summary
add one CLI entrypoint in the same connector boundary

Do not scatter raw env reads across multiple files.

3. Keep the transport boundary narrow

Use the same bounded transport style already established in the connector.

Requirements:

keep request building isolated
keep response parsing isolated
fail with typed connector errors
do not log sensitive headers or tokens
do not introduce warehouse, polling, or download helpers in this task
4. Implement one callable entrypoint

Create one explicit entrypoint for the first report request.

Preferred shape:

one small function in the SP-API connector
one minimal CLI/dev entry script

Acceptable examples:

createFirstSalesTrafficReportRequest()
runFirstSpApiReportRequest()

If a CLI/dev script is added, it must:

live under the SP-API connector boundary
print a redacted, human-readable success summary
not dump sensitive full payloads by default
fail with clear typed errors
5. Build one report-create request only

Implement a bounded request builder for the Reports API create-report call.

Requirements:

build the request body in one dedicated function
include marketplace scope from validated env
keep the date window explicit and deterministic
default to a small safe lookback window suitable for request submission only
do not add date-range CLI complexity beyond what is required for one bounded request path
6. Parse only the minimal safe response

On success, parse only the fields required to prove the request was accepted.

Safe summary may include:

call succeeded
region used
marketplace id used
report type used
report id returned

Do not print:

access token
refresh token
raw authorization headers
full raw response payload by default
7. Add targeted unit tests

Add connector tests that verify:

request body shape for the chosen report type
report-create request path uses the correct endpoint/path
marketplace id is included
success response parsing returns a safe summary
non-2xx responses raise the correct typed error
malformed success payload raises the correct typed error

Tests must not require real credentials or network access.

8. Add one npm script

Add one explicit script to package.json.

Required script:

spapi:first-report-request

That script must invoke the new CLI entrypoint and nothing broader.

Forbidden changes
Do not implement report polling.
Do not implement report status checks beyond what is needed to parse the immediate create response.
Do not implement report document retrieval.
Do not implement document decryption.
Do not implement parsing or ingestion.
Do not add database or Supabase changes.
Do not add UI.
Do not expand into Ads API.
Do not refactor unrelated connector files.
Do not modify real .env* files.
Do not mark later stages complete in this task.
Required tests
npm test
npm run spapi:first-report-request
npm run verify:wsl
Acceptance checks
One new bounded report-request path exists under src/connectors/sp-api/**
package.json contains spapi:first-report-request
The command submits one real retail Sales and Traffic report request and returns a safe summary
Success output includes a returned report id and does not expose secrets
No polling, download, parsing, ingestion, database, or UI scope is added
Existing SP-API first-call path remains intact
npm run verify:wsl passes
Required status update

Update docs/v2/BUILD_STATUS.md in the same branch:

set Current task = V2-04
keep the current stage history intact
append one task-log row for V2-04
record that Stage 2A is now complete based on successful WSL verification and successful npm run spapi:first-call
set the next follow-up after V2-04 as report polling/status only, not download or ingestion
