# Remote MCP Deployment

`apps/mcp` supports two entrypoints:

- Local stdio MCP for local process-spawned clients.
- Remote OAuth MCP for Claude custom connectors and other hosted HTTP MCP clients.

The local stdio server still reads credentials from the environment and does not use OAuth.

The remote server is intended for a public HTTPS URL such as:

`https://your-domain.example.com/mcp`

Do not paste `MCP_DATABASE_URL` into Claude or any client UI. It stays on the server only.

## Required Environment

Both modes require:

- `MCP_DATABASE_URL`
- `MCP_ACCOUNT_ID`
- `MCP_MARKETPLACE`

Remote OAuth mode also requires:

- `MCP_PUBLIC_BASE_URL`
- `MCP_OAUTH_APPROVAL_TOKEN`

Optional remote OAuth settings:

- `MCP_OAUTH_ISSUER`
- `MCP_HTTP_HOST` default `0.0.0.0`
- `MCP_HTTP_PORT` default `8080`
- `MCP_HTTP_PATH` default `/mcp`

Notes:

- Use a read-only database credential for `MCP_DATABASE_URL`.
- Do not use `SUPABASE_SERVICE_ROLE_KEY`.
- `MCP_ACCOUNT_ID` and `MCP_MARKETPLACE` scope every tool request to one APH partition.
- `MCP_PUBLIC_BASE_URL` should usually be the HTTPS origin for the deployed service, for example `https://your-domain.example.com`.
- `MCP_OAUTH_ISSUER` defaults to `MCP_PUBLIC_BASE_URL`.

## OAuth Endpoints

The remote server exposes MCP-spec OAuth endpoints on the same host:

- Remote MCP URL: `/mcp`
- Protected Resource Metadata: `/.well-known/oauth-protected-resource/mcp`
- Authorization Server Metadata: `/.well-known/oauth-authorization-server`
- Authorization endpoint: `/authorize`
- Token endpoint: `/token`
- Client registration endpoint: `/register`

Remote `/mcp` requests without a valid OAuth access token receive `401`.

## Claude Custom Connector Setup

In Claude's custom connector UI, use:

- Name: any operator-facing label, for example `Amazon Performance Hub`
- Remote MCP server URL: `https://your-domain.example.com/mcp`
- OAuth Client ID: leave blank when using dynamic client registration
- OAuth Client Secret: leave blank when using dynamic client registration

After adding the connector:

1. Click `Connect`.
2. Claude will start the OAuth flow against your remote MCP server.
3. On the authorization page hosted by your MCP server, enter the value of `MCP_OAUTH_APPROVAL_TOKEN`.
4. Approve the request to finish connection.

If you later decide to disable dynamic client registration and move to pre-provisioned OAuth clients, document the registered client ID and client secret for operators before changing this setup.

## MCP Inspector Testing

Use MCP Inspector to validate the OAuth flow before testing in Claude:

```bash
npx @modelcontextprotocol/inspector
```

In the Inspector:

1. Select `Streamable HTTP`.
2. Enter `https://your-domain.example.com/mcp`.
3. Open Auth Settings.
4. Run the OAuth flow.
5. Enter `MCP_OAUTH_APPROVAL_TOKEN` on the authorization page.
6. Confirm the Inspector receives an access token and can list tools.

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

MCP v1 remains read-only and limited to:

- `get_mcp_guide`
- `get_data_coverage_status`
- `get_sales_summary`
- `get_sp_campaign_summary`
- `get_sp_target_summary`
- `get_h10_keyword_rankings`

Excluded from MCP v1:

- SQP tools
- write tools
- arbitrary SQL

## Secret Rotation

Rotate remote OAuth secrets by:

1. Changing `MCP_OAUTH_APPROVAL_TOKEN`.
2. Restarting the remote MCP server.
3. Reconnecting clients if needed.

Current access and refresh tokens are stored in memory only, so restarting the process invalidates issued tokens and registered dynamic clients.

## Deployment Options

Recommended deployment options:

- A small Node process on Fly.io, Render, Railway, or a VM/container behind HTTPS.
- A reverse proxy such as Nginx or Caddy terminating TLS and forwarding to the Node process.
- Any private platform that can host a long-running Node HTTP service and inject env vars securely.

Operational guidance:

- Keep the database user read-only.
- Use HTTPS in front of the remote MCP endpoint.
- Treat `MCP_OAUTH_APPROVAL_TOKEN` like a secret.
- Do not expose database credentials, client secrets, access tokens, or refresh tokens in logs.
