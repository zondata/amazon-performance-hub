# Remote MCP Deployment

`apps/mcp` now supports two entrypoints:

- Local stdio MCP: for local process-spawned clients such as traditional desktop MCP setups.
- Remote HTTP MCP: for hosted clients that need a Remote MCP server URL, such as Claude's custom connector flow.

Claude custom connectors require a remote MCP URL such as:

`https://your-domain.example.com/mcp`

Do not paste `MCP_DATABASE_URL` into Claude or any client UI. That value stays on the server only.

## Required Environment

Remote MCP requires these server-side environment variables:

- `MCP_DATABASE_URL`
- `MCP_ACCOUNT_ID`
- `MCP_MARKETPLACE`
- `MCP_REMOTE_BEARER_TOKEN`

Notes:

- `MCP_DATABASE_URL` is still required for both stdio and remote modes.
- Use a read-only database credential for `MCP_DATABASE_URL`.
- Do not use `SUPABASE_SERVICE_ROLE_KEY`.
- `MCP_ACCOUNT_ID` and `MCP_MARKETPLACE` scope every tool request to one APH partition.

Optional HTTP settings:

- `MCP_HTTP_HOST` default `0.0.0.0`
- `MCP_HTTP_PORT` default `8080`
- `MCP_HTTP_PATH` default `/mcp`

## Auth

First deployment uses static bearer authentication:

- Every HTTP request must send `Authorization: Bearer <token>`.
- Requests with a missing or wrong token return `401`.
- The token is validated server-side only.

This is intentionally simple for first deployment. Some Claude custom connector flows may require OAuth instead of static bearer auth. If Claude does not accept bearer-only remote MCP auth in your connector flow, add an OAuth wrapper in a follow-up deployment.

## Commands

Build the MCP package:

```bash
npm run mcp:build
```

Start the remote MCP server:

```bash
npm run mcp:http:start
```

Start the local stdio MCP server:

```bash
npm --prefix apps/mcp run stdio:start
```

## Scope

MCP v1 remains read-only and intentionally limited to:

- `get_mcp_guide`
- `get_data_coverage_status`
- `get_sales_summary`
- `get_sp_campaign_summary`
- `get_sp_target_summary`
- `get_h10_keyword_rankings`

Not included in MCP v1:

- SQP tools
- write tools
- arbitrary SQL

## Deployment Options

Recommended first deployments:

- A small Node process on Fly.io, Render, Railway, or a VM/container behind HTTPS.
- A reverse proxy such as Nginx or Caddy terminating TLS and forwarding to the Node process.
- Any private internal platform that can host a long-running Node HTTP service and inject env vars securely.

Operational guidance:

- Keep the server private or token-protected.
- Rotate `MCP_REMOTE_BEARER_TOKEN` if it is shared too broadly.
- Use HTTPS in front of the remote MCP endpoint.
- Keep the database user read-only.
