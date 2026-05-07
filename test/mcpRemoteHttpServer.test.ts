import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "../apps/mcp/src/config";
import { startHttpServer, type StartedHttpServer } from "../apps/mcp/src/httpServer";

const APPROVAL_TOKEN = "test-oauth-approval-token";

const base64UrlEncode = (value: Buffer): string =>
  value
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

const toCodeChallenge = (codeVerifier: string): string =>
  base64UrlEncode(createHash("sha256").update(codeVerifier).digest());

describe("APH remote MCP HTTP server", () => {
  let startedServer: StartedHttpServer | null = null;

  afterEach(async () => {
    if (startedServer) {
      await startedServer.close();
      startedServer = null;
    }
  });

  const boot = async (logs: string[]): Promise<{ baseUrl: string; mcpUrl: string }> => {
    const config = loadRuntimeConfig("http", {
      MCP_DATABASE_URL: "postgres://readonly:readonly@127.0.0.1:5432/aph",
      MCP_ACCOUNT_ID: "sourbear",
      MCP_MARKETPLACE: "US",
      MCP_OAUTH_APPROVAL_TOKEN: APPROVAL_TOKEN,
      MCP_PUBLIC_BASE_URL: "http://127.0.0.1:0",
      MCP_HTTP_HOST: "127.0.0.1",
      MCP_HTTP_PORT: "0",
    });

    startedServer = await startHttpServer(config, {
      info: (message) => logs.push(`info:${message}`),
      warn: (message) => logs.push(`warn:${message}`),
      error: (message) => logs.push(`error:${message}`),
    });

    const baseUrl = `http://127.0.0.1:${startedServer.port}`;
    return {
      baseUrl,
      mcpUrl: `${baseUrl}${config.httpPath}`,
    };
  };

  const registerClient = async (baseUrl: string): Promise<{
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }> => {
    const redirectUri = "http://127.0.0.1:43123/callback";
    const response = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "client_secret_post",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        client_name: "vitest client",
        scope: "mcp:tools",
      }),
    });

    expect(response.status).toBe(201);
    const payload = (await response.json()) as {
      client_id: string;
      client_secret: string;
    };

    expect(payload.client_id).toBeTruthy();
    expect(payload.client_secret).toBeTruthy();

    return {
      clientId: payload.client_id,
      clientSecret: payload.client_secret,
      redirectUri,
    };
  };

  const authorizeAndExchange = async (baseUrl: string): Promise<string> => {
    const { clientId, clientSecret, redirectUri } = await registerClient(baseUrl);
    const codeVerifier = "vitest-code-verifier-1234567890";
    const codeChallenge = toCodeChallenge(codeVerifier);
    const resource = `${baseUrl}/mcp`;

    const authPage = await fetch(
      `${baseUrl}/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(
        redirectUri,
      )}&response_type=code&code_challenge=${encodeURIComponent(
        codeChallenge,
      )}&code_challenge_method=S256&scope=mcp:tools&resource=${encodeURIComponent(resource)}`,
    );

    expect(authPage.status).toBe(200);
    expect(await authPage.text()).toContain("Authorize Amazon Performance Hub MCP");

    const approvalResponse = await fetch(`${baseUrl}/authorize`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      redirect: "manual",
      body: new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        scope: "mcp:tools",
        resource,
        approval_token: APPROVAL_TOKEN,
      }),
    });

    expect(approvalResponse.status).toBe(302);
    const redirectLocation = approvalResponse.headers.get("location");
    expect(redirectLocation).toBeTruthy();
    const redirected = new URL(redirectLocation!);
    const code = redirected.searchParams.get("code");
    expect(code).toBeTruthy();

    const tokenResponse = await fetch(`${baseUrl}/token`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: code!,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        resource,
      }),
    });

    expect(tokenResponse.status).toBe(200);
    const tokenPayload = (await tokenResponse.json()) as { access_token: string };
    expect(tokenPayload.access_token).toBeTruthy();
    return tokenPayload.access_token;
  };

  it("exposes OAuth metadata endpoints for the /mcp resource", async () => {
    const logs: string[] = [];
    const { baseUrl } = await boot(logs);

    const protectedResourceResponse = await fetch(
      `${baseUrl}/.well-known/oauth-protected-resource/mcp`,
    );
    expect(protectedResourceResponse.status).toBe(200);
    const protectedResourcePayload = (await protectedResourceResponse.json()) as {
      resource: string;
      authorization_servers: string[];
    };
    expect(protectedResourcePayload.resource).toBe(`${baseUrl}/mcp`);
    expect(protectedResourcePayload.authorization_servers).toEqual([`${baseUrl}/`]);

    const metadataResponse = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
    expect(metadataResponse.status).toBe(200);
    const metadataPayload = (await metadataResponse.json()) as {
      issuer: string;
      authorization_endpoint: string;
      token_endpoint: string;
      registration_endpoint?: string;
    };
    expect(metadataPayload.issuer).toBe(`${baseUrl}/`);
    expect(metadataPayload.authorization_endpoint).toBe(`${baseUrl}/authorize`);
    expect(metadataPayload.token_endpoint).toBe(`${baseUrl}/token`);
    expect(metadataPayload.registration_endpoint).toBe(`${baseUrl}/register`);
  });

  it("rejects missing and invalid bearer tokens for /mcp without leaking secrets", async () => {
    const logs: string[] = [];
    const { mcpUrl } = await boot(logs);

    const missingTokenResponse = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    });

    expect(missingTokenResponse.status).toBe(401);
    expect(missingTokenResponse.headers.get("www-authenticate")).toContain(
      "/.well-known/oauth-protected-resource/mcp",
    );
    expect(await missingTokenResponse.text()).not.toContain(APPROVAL_TOKEN);

    const invalidTokenResponse = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        authorization: "Bearer invalid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    });

    expect(invalidTokenResponse.status).toBe(401);
    expect(await invalidTokenResponse.text()).not.toContain("invalid-token");
    expect(logs.join("\n")).not.toContain(APPROVAL_TOKEN);
  });

  it("supports dynamic client registration and valid OAuth access tokens for /mcp", async () => {
    const logs: string[] = [];
    const { baseUrl, mcpUrl } = await boot(logs);
    const accessToken = await authorizeAndExchange(baseUrl);

    const client = new Client({
      name: "mcp-http-test-client",
      version: "1.0.0",
    });
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
      requestInit: {
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      },
    });

    await client.connect(transport);
    const toolsResult = await client.listTools();

    expect(toolsResult.tools.map((tool) => tool.name).sort()).toEqual([
      "get_data_coverage_status",
      "get_h10_keyword_rankings",
      "get_mcp_guide",
      "get_sales_summary",
      "get_sp_campaign_summary",
      "get_sp_target_summary",
    ]);

    const guideResult = await client.callTool({
      name: "get_mcp_guide",
      arguments: {},
    });
    const guideText = JSON.stringify(guideResult);
    expect(guideText).toContain("Dynamic client registration is enabled");
    expect(guideText).toContain("No SQP tools in MCP v1");

    const toolNames = toolsResult.tools.map((tool) => tool.name).join(" ");
    expect(toolNames).not.toContain("sqp");
    expect(toolNames).not.toContain("write");
    expect(logs.join("\n")).not.toContain(APPROVAL_TOKEN);
    expect(logs.join("\n")).not.toContain(accessToken);

    await transport.terminateSession();
    await client.close();
  });
});
