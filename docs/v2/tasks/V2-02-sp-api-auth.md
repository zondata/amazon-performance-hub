Task ID

V2-02

Title

Create the SP-API auth skeleton only

Objective

Create the V2 Sponsored Products API authentication skeleton and environment contract without implementing report sync, warehouse writes, UI flows, or production data pulls.

Why this task exists

V2 needs a clean SP-API connector boundary before any retail report ingestion work starts. This task creates the auth/config foundation only, so future tasks can build on a typed and testable base instead of ad hoc environment reads.

In-scope files
src/connectors/sp-api/**
src/testing/fixtures/** only if needed for auth/config unit tests
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
any real report ingestion code
any real UI or admin page
Constraints
Create the auth skeleton only.
Do not make live Amazon API calls.
Do not require real credentials for tests.
Do not create database schema or migrations.
Do not implement report create, poll, download, parse, or ingest yet.
Do not add Amazon Ads API code in this task.
Do not add UI for connection management in this task.
Do not expand beyond SP-API auth/config boundary.
Required implementation
1. Create SP-API module boundary contents

Under src/connectors/sp-api/, create the initial auth/config skeleton with small, typed files. Split by responsibility. Prefer a structure like:

src/connectors/sp-api/README.md
src/connectors/sp-api/index.ts
src/connectors/sp-api/types.ts
src/connectors/sp-api/env.ts
src/connectors/sp-api/auth.ts
src/connectors/sp-api/endpoints.ts

Exact filenames may vary slightly if needed, but responsibilities must remain separated.

2. Define typed environment contract

Implement a typed loader/validator for the SP-API auth environment contract.

Required env variables for the skeleton:

SP_API_LWA_CLIENT_ID
SP_API_LWA_CLIENT_SECRET
SP_API_REFRESH_TOKEN
SP_API_REGION
SP_API_MARKETPLACE_ID

Rules:

environment loading must be explicit
missing required variables must produce a clear typed error
do not silently default secrets
SP_API_REGION must be validated against an explicit allowed set

Allowed region values for this task:

na
eu
fe

Do not infer region from marketplace in this task.

3. Define typed auth/config shapes

Create TypeScript types/interfaces for:

SP-API region
SP-API credentials
SP-API environment config
LWA token response shape for access token exchange
SP-API auth error shape or error class

Keep the shapes minimal and directly related to auth/config.

4. Implement endpoint mapping

Create a region-to-endpoint mapping helper for SP-API base URLs.

Required support:

na
eu
fe

The helper must:

return a deterministic endpoint string for each region
throw a clear error for unsupported input
5. Implement LWA token refresh skeleton

Create an auth function that prepares the refresh-token exchange request for Login with Amazon and returns a typed result shape.

This task may do one of the following:

build the request payload and expose a function boundary without making the network call, or
implement the fetch call behind an injected transport interface that is mocked in tests

Preferred approach:

use an injected transport boundary so tests can validate behavior without real network access

Requirements:

no real credentials
no live external calls in tests
typed success and failure handling
no token persistence yet
no retry/backoff yet
6. Export a stable public surface

src/connectors/sp-api/index.ts must export only the intended public API for this stage, such as:

env/config loader
endpoint resolver
auth/token refresh entrypoint
core types
7. Add tests

Add unit tests for the auth/config skeleton.

Minimum required tests:

env loader succeeds with a complete valid config
env loader fails with missing required fields
env loader fails with invalid region
endpoint resolver returns correct URL for each allowed region
token refresh boundary handles a mocked success response
token refresh boundary handles a mocked error response

Do not add integration tests requiring real Amazon credentials.

8. Update status file

Update docs/v2/BUILD_STATUS.md in the same branch.

Required updates:

Current task = V2-02
Current stage = Stage 2A
mark Stage 2A complete only if acceptance checks pass
append one task-log row
record tests actually run
note any manual follow-up still required
Forbidden changes
Do not implement report requests.
Do not implement report polling.
Do not implement report download/decompression/parsing.
Do not write to Supabase.
Do not add /v2 pages or admin UI.
Do not add Ads API auth in this task.
Do not read raw env vars throughout the codebase outside the new SP-API module boundary.
Do not add real secrets or modify .env files with live values.
Do not fix unrelated repo code unless required to make this task compile and verify.
Do not expand into ingestion backbone or warehouse design.
Required tests

Run the repo verification command in WSL after implementation:

npm run verify:wsl

If the verification command fails because of a new issue introduced by this task, fix only the blocker required for this task.

If the verification command fails because of an unrelated pre-existing issue, report it clearly in docs/v2/BUILD_STATUS.md and in the task output.

Acceptance checks
src/connectors/sp-api/ contains a typed auth/config skeleton with separated responsibilities
required env contract is defined and validated
region endpoint resolver exists and is tested
token refresh boundary exists and is tested without real network calls
public exports are stable and minimal
no UI, ingestion, warehouse, or Ads API work was added
docs/v2/BUILD_STATUS.md updated in the same branch
npm run verify:wsl passes, or any unrelated pre-existing blocker is clearly documented
Required status update

Update docs/v2/BUILD_STATUS.md:

Current task = V2-02
Current stage = Stage 2A
mark Stage 2A — SP-API auth + first Sales and Traffic pull as not complete unless this task explicitly includes a first call and all acceptance checks pass
add a note that this task covers only the auth skeleton portion of Stage 2A
append a task-log row
record tests actually run
record manual follow-up needed for the first real SP-API call in a later bounded task