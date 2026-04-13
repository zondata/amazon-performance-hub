Task ID

V2-03

Title

Make the first real SP-API call only

Objective

Use the existing SP-API auth skeleton and local production credentials to perform one minimal real SP-API read call successfully, with no ingestion, no warehouse writes, no UI, and no Amazon write actions.

Why this task exists

Stage 2A is not complete until V2 proves that the app can exchange the production refresh token for an access token and successfully call a real SP-API endpoint. This task is the smallest possible production-read proof.

In-scope files
src/connectors/sp-api/**
src/testing/fixtures/** only if needed for unit tests around request shaping or response handling
docs/v2/BUILD_STATUS.md
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
any Amazon write/execution code
any report polling/download/parsing/ingestion code
any UI or admin page
Constraints
Make exactly one minimal real SP-API read path.
Do not implement report ingestion.
Do not implement database writes.
Do not add UI.
Do not add Ads API code.
Do not add retry/backoff frameworks beyond minimal safe handling needed for one call path.
Do not log secrets, tokens, raw Authorization headers, or client secrets.
Do not commit real response payloads containing account-sensitive data.
Do not require sandbox credentials for this task.
Use the local production env already saved by the operator.
Keep the scope on proof-of-auth and proof-of-read only.
Required implementation
1. Choose one minimal real SP-API read endpoint

Use a real production SP-API endpoint that proves auth and marketplace-scoped access with the least extra complexity.

Preferred endpoint for this task:

getMarketplaceParticipations from the Sellers API

Reason:

it is a small read-only call
it proves the LWA token exchange works
it proves the first real SP-API request path works
it does not require report workflow complexity
for NA/EU, Amazon documents this endpoint behind Selling Partner Insights or Product Listing

Role correction for this task:

Selling Partner Insights is now enabled for the app and the app has been re-authorized
therefore keep this exact Sellers endpoint as the V2-03 first-call proof
do not switch V2-03 to Reports API because report workflow belongs to the next bounded task

If that endpoint is not feasible with the current approved role set, choose the smallest alternative read-only endpoint that works with the roles already granted, and document exactly why the preferred endpoint was not used.

2. Keep auth/config boundaries intact

Extend the existing SP-API connector skeleton without collapsing responsibilities.

Prefer these responsibilities:

env.ts loads and validates env
auth.ts exchanges refresh token for access token
endpoints.ts resolves region endpoint
add request signing / transport in a separate small file if needed
add the first-call entrypoint in a clearly named file

Do not scatter raw env reads across multiple files.

3. Keep the existing first-call transport boundary

Use the current bounded request shape for this task.

Requirements:

keep the current LWA-only first-call path
do not add AWS env vars
do not add SigV4 logic
do not switch endpoints
do not log secrets, tokens, or raw auth headers

4. Implement one callable entrypoint

Create one explicit entrypoint for the first real call.

Preferred shape:

a small function in the SP-API connector
plus a minimal CLI/dev entry script if needed

Acceptable examples:

fetchMarketplaceParticipations()
runFirstSpApiCall()

If a CLI/dev script is added, it must:

live under the SP-API connector boundary or an obviously related scripts boundary
print a redacted, human-readable success summary
not dump sensitive full payloads by default
fail with clear typed errors
5. Redact output

On success, surface only a safe summary such as:

call succeeded
region used
marketplace IDs found
number of participations returned

Do not print:

refresh token
access token
client secret
full signed headers
6. Handle errors clearly

Add clear error handling for at least:

missing env
token exchange failure
signing/setup failure
non-2xx SP-API response

Error output must help diagnose the problem without leaking secrets.

7. Add tests

Add or update unit tests for the new code that do not require real network calls.

Minimum required tests:

first-call request path fails clearly when required env is missing
token exchange error is surfaced as a typed error
endpoint resolution remains correct
redaction/safe-summary behavior is covered if applicable

Do not add tests that require real Amazon credentials.

8. Manual verification path

This task must provide one exact manual verification command for WSL that the operator can run after Codex finishes.

Examples:

npm run verify:wsl
and one explicit first-call command if added, such as:
npm run spapi:first-call

If a new root/package script is needed for the first-call command, add only the minimum script wiring required.

9. Update status file

Update docs/v2/BUILD_STATUS.md in the same branch.

Required updates:

Current task = V2-03
Current stage = Stage 2A
mark Stage 2A complete only if:
the real call path is implemented
the operator manually confirms the first real call succeeded
npm run verify:wsl passes
append one task-log row
record tests actually run
record the exact manual verification command(s)
note any remaining follow-up for sales-and-traffic/report work
Forbidden changes
Do not implement report create/poll/download/parse/ingest.
Do not write to Supabase.
Do not add /v2 pages or admin UI.
Do not add Ads API code.
Do not add broad ingestion infrastructure.
Do not add warehouse or marts logic.
Do not expand to multiple SP-API endpoints.
Do not commit real secrets or response payload dumps.
Do not fix unrelated repo code unless required to make this task verify.
Required tests

Codex should do only scoped non-WSL validation that does not depend on your trusted WSL acceptance environment.

The operator will run manual WSL verification after Codex finishes.

Required operator verification after Codex finishes:

npm run verify:wsl
plus the exact first-call command added by this task

If WSL verification fails because of a new issue introduced by this task, fix only the blocker required for this task.

If WSL verification fails because of an unrelated pre-existing issue, report it clearly in docs/v2/BUILD_STATUS.md and in the task output.

Acceptance checks
one real production SP-API read call path exists
the call uses the existing auth skeleton extended minimally
required env is validated explicitly
the existing LWA-only first-call boundary remains intact
no secrets are logged
safe success summary is produced
no ingestion, warehouse, UI, or Ads API work was added
docs/v2/BUILD_STATUS.md updated in the same branch
operator can run the exact WSL verification commands
Stage 2A is marked complete only after confirmed real-call success and passing WSL verification
Required status update

Update docs/v2/BUILD_STATUS.md:

Current task = V2-03
Current stage = Stage 2A
add a note that this task is the first real SP-API call proof
do not mark Stage 2A complete unless the operator confirms:
real call succeeded
npm run verify:wsl passed
append a task-log row
record tests actually run
record manual follow-up needed for the next bounded task, which should be the first report call path
Output format
files created or changed
first real SP-API call surface added
tests added
exact WSL commands I should run
blockers or follow-up
