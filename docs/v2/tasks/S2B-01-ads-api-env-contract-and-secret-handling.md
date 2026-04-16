# S2B-01 - Ads API environment contract and secret handling

## Purpose
Define the exact Amazon Ads API environment contract, secret handling rules, runtime boundaries, and verification rules that must be satisfied before any Stage 2B implementation task may claim live Ads API success.

## Scope
- Stage 2B control-layer contract only
- Documentation-only task
- Applies to all future `src/connectors/ads-api/**` implementation tasks
- Covers local, sandbox, and production-proof rules
- Does not implement Ads API auth, profile sync, or report pulls

## Required credentials
The following variables are the required Ads API contract for future implementation tasks:

| Variable | Required for sandbox | Required for production | Secret | Purpose |
| --- | --- | --- | --- | --- |
| `AMAZON_ADS_CLIENT_ID` | yes | yes | yes | Amazon Ads application client id |
| `AMAZON_ADS_CLIENT_SECRET` | yes | yes | yes | Amazon Ads application client secret |
| `AMAZON_ADS_API_BASE_URL` | yes | yes | no | Configured Amazon Ads API base URL |
| `AMAZON_ADS_REFRESH_TOKEN` | yes | yes | yes | Environment-specific refresh token |
| `AMAZON_ADS_PROFILE_ID` | optional for auth-only checks | yes for live pull proof | no | Ads profile scope used in `Amazon-Advertising-API-Scope` |
| `APP_ACCOUNT_ID` | yes | yes | no | Internal account partition key already used by the repo |
| `APP_MARKETPLACE` | yes | yes | no | Internal marketplace code already used by the repo |

Rules:
- `AMAZON_ADS_CLIENT_ID`, `AMAZON_ADS_CLIENT_SECRET`, and `AMAZON_ADS_REFRESH_TOKEN` are secrets.
- `AMAZON_ADS_PROFILE_ID` is runtime scope, not a secret.
- `AMAZON_ADS_API_BASE_URL` must stay separate from the LWA token endpoint.
- `AMAZON_ADS_REFRESH_TOKEN` may be wrapped in one matching pair of surrounding single or double quotes in local `.env.local`; loaders must trim whitespace and remove that one outer pair before use without altering interior characters.
- Region handling is out of scope for `S2B-02` and is not a required variable in this contract.
- One `.env.local` set must describe one environment only.

## Secret storage rules
Allowed secret locations:
- local `.env.local` on the operator machine
- approved secret manager
- CI/CD secret store when an implementation task explicitly requires it

Forbidden secret locations:
- committed files
- task docs
- source files
- tests
- fixtures
- snapshots
- terminal transcripts committed back to the repo
- sample env files committed to git with real values

Required handling rules:
- Never commit real Ads API credentials.
- Never paste full Ads API credentials into `docs/v2/BUILD_STATUS.md`.
- Never log full refresh tokens, client secrets, or raw auth headers.
- Redact secrets in manual handoff evidence.
- If a snapshot bundle is generated, confirm secret-bearing env files are excluded or redacted before sharing.

## Allowed runtime environments
Allowed runtime classes for future Ads API tasks:
- `local sandbox`: local WSL execution against Amazon Ads sandbox credentials
- `local production`: local WSL execution against real Amazon Ads production credentials
- `ci verification`: non-secret checks only; no real Ads auth proof unless explicitly approved and secrets are provisioned securely

Rules:
- WSL is the canonical execution environment for implementation and verification.
- Sandbox proof may validate wiring only.
- Production proof is required before any task may claim a real Ads API gate is complete.

## Forbidden environment mixes
Forbidden combinations:
- production refresh token with sandbox base URL or sandbox assumptions
- sandbox refresh token with production success claims
- `AMAZON_ADS_PROFILE_ID` from one account with credentials for another account
- shared mixed `.env.local` containing both sandbox and production Ads credentials
- committed placeholder values presented as real proof

## Verification rules
Before any future Stage 2B implementation task may be marked complete:
- required env vars for that task must be present in local `.env.local`
- configured Ads API base URL must be explicit
- profile scope must be explicit for any task that needs profile-scoped calls
- the exact WSL command used for proof must be recorded
- success must be based on a real end-to-end run against the intended environment
- sandbox-only runs must be labeled `sandbox` and must not be described as production proof
- production proof must be labeled `production`

## Evidence required before first Ads API implementation task can be marked complete
The minimum evidence set for the first real Ads API implementation task is:
- exact command run
- environment class: `sandbox` or `production`
- configured Ads API base URL
- profile id used if applicable
- account id / marketplace used by the repo
- redacted success summary
- exact tests run
- explicit statement whether proof was sandbox-only or production

Proof rules:
- sandbox success is not sufficient to claim the first production Ads API gate is complete
- production proof requires a real non-sandbox end-to-end command success

## Operator handoff rules
The operator must provide or confirm:
- which environment is intended: `sandbox` or `production`
- the configured Ads API base URL
- the profile id if the task is profile-scoped
- that credentials are placed in local `.env.local` and not committed
- whether the goal is sandbox wiring proof or production proof

If production proof is required, the operator must confirm:
- the intended Ads account
- the intended profile
- that the credentials and profile belong to the same environment

## Codex execution rules
Codex must:
- refuse to claim Ads API success when required secrets are missing
- state exactly which required variables are missing
- stop at documentation or contract-stub work when secrets are unavailable
- distinguish `sandbox-ready` from `production-proven`
- record the exact WSL command used for any real Ads API proof

Codex must not:
- invent credentials
- hardcode secrets
- commit `.env.local`
- claim production proof from sandbox-only runs
- treat missing credentials as permission to widen scope into unrelated work

## Non-goals
- no Ads authorization grant implementation
- no token exchange implementation
- no token refresh implementation
- no Ads profile sync implementation
- no Sponsored Products pulls
- no warehouse work
- no UI work
- no schema work

## Completion effect
This task is complete when this contract is documented, tracking docs are updated, and verification passes.

The next bounded build task after this contract is:
- `S2B-02 - Implement Ads authorization grant, token exchange, and refresh`
