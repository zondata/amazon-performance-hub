import { randomUUID, timingSafeEqual } from "node:crypto";
import type { Response } from "express";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import {
  AccessDeniedError,
  InvalidGrantError,
  InvalidScopeError,
  InvalidTargetError,
  InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  MCP_ACCESS_TOKEN_TTL_SECONDS,
  MCP_OAUTH_SCOPE,
  MCP_REFRESH_TOKEN_TTL_SECONDS,
} from "./constants";

type AuthorizationCodeRecord = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource?: string;
  expiresAtMs: number;
};

type RefreshTokenRecord = {
  clientId: string;
  scopes: string[];
  resource?: string;
  expiresAtMs: number;
};

type AccessTokenRecord = {
  clientId: string;
  scopes: string[];
  resource?: string;
  expiresAtMs: number;
};

const htmlEscape = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toFormValue = (value: string | undefined): string => htmlEscape(value ?? "");

const isSubset = (requested: string[], granted: string[]): boolean =>
  requested.every((scope) => granted.includes(scope));

const constantTimeMatch = (provided: string, expected: string): boolean => {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
};

const renderApprovalPage = (
  res: Response,
  client: OAuthClientInformationFull,
  params: AuthorizationParams,
  errorMessage?: string,
): void => {
  const scopeValue = params.scopes?.join(" ") ?? "";
  const resourceValue = params.resource?.toString() ?? "";
  const errorHtml = errorMessage
    ? `<p style="color:#b91c1c;margin:0 0 16px;">${htmlEscape(errorMessage)}</p>`
    : "";

  res.status(200).type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Authorize Amazon Performance Hub MCP</title>
  </head>
  <body style="font-family:system-ui,-apple-system,sans-serif;background:#f5f5f5;padding:32px;color:#111827;">
    <main style="max-width:540px;margin:0 auto;background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
      <h1 style="margin:0 0 12px;font-size:24px;">Authorize Amazon Performance Hub MCP</h1>
      <p style="margin:0 0 16px;">Approve Claude to use the read-only Amazon Performance Hub MCP tools.</p>
      <dl style="margin:0 0 20px;">
        <dt style="font-weight:600;">Client</dt>
        <dd style="margin:0 0 12px;">${htmlEscape(client.client_name ?? client.client_id)}</dd>
        <dt style="font-weight:600;">Scopes</dt>
        <dd style="margin:0 0 12px;">${htmlEscape(scopeValue || MCP_OAUTH_SCOPE)}</dd>
        <dt style="font-weight:600;">Resource</dt>
        <dd style="margin:0;">${htmlEscape(resourceValue)}</dd>
      </dl>
      ${errorHtml}
      <form method="post">
        <input type="hidden" name="client_id" value="${toFormValue(client.client_id)}" />
        <input type="hidden" name="redirect_uri" value="${toFormValue(params.redirectUri)}" />
        <input type="hidden" name="response_type" value="code" />
        <input type="hidden" name="code_challenge" value="${toFormValue(params.codeChallenge)}" />
        <input type="hidden" name="code_challenge_method" value="S256" />
        <input type="hidden" name="state" value="${toFormValue(params.state)}" />
        <input type="hidden" name="scope" value="${toFormValue(scopeValue)}" />
        <input type="hidden" name="resource" value="${toFormValue(resourceValue)}" />
        <label for="approval_token" style="display:block;font-weight:600;margin-bottom:8px;">Authorization token</label>
        <input id="approval_token" name="approval_token" type="password" autocomplete="off" required style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;box-sizing:border-box;" />
        <p style="font-size:14px;color:#4b5563;margin:10px 0 20px;">Enter the server-side approval token configured for this connector.</p>
        <button type="submit" style="background:#111827;color:white;border:0;border-radius:8px;padding:10px 16px;cursor:pointer;">Approve</button>
      </form>
    </main>
  </body>
</html>`);
};

export class DynamicClientStore implements OAuthRegisteredClientsStore {
  private readonly clients = new Map<string, OAuthClientInformationFull>();

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    return this.clients.get(clientId);
  }

  async registerClient(
    client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">,
  ): Promise<OAuthClientInformationFull> {
    if (client.token_endpoint_auth_method === "none") {
      throw new AccessDeniedError("Public OAuth clients are not supported by this server");
    }

    const now = Math.floor(Date.now() / 1000);
    const registeredClient: OAuthClientInformationFull = {
      ...client,
      token_endpoint_auth_method: "client_secret_post",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_id: randomUUID(),
      client_id_issued_at: now,
    };

    this.clients.set(registeredClient.client_id, registeredClient);
    return registeredClient;
  }
}

export class ApprovalOAuthProvider implements OAuthServerProvider {
  readonly clientsStore: OAuthRegisteredClientsStore;

  private readonly authorizationCodes = new Map<string, AuthorizationCodeRecord>();
  private readonly accessTokens = new Map<string, AccessTokenRecord>();
  private readonly refreshTokens = new Map<string, RefreshTokenRecord>();
  private readonly approvalToken: string;
  private readonly resourceServerUrl: string;

  constructor(options: {
    clientsStore: OAuthRegisteredClientsStore;
    approvalToken: string;
    resourceServerUrl: URL;
  }) {
    this.clientsStore = options.clientsStore;
    this.approvalToken = options.approvalToken;
    this.resourceServerUrl = options.resourceServerUrl.toString();
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    const request = res.req;
    if (!request) {
      throw new AccessDeniedError("Authorization request context is unavailable");
    }

    if (params.resource && params.resource.toString() !== this.resourceServerUrl) {
      throw new InvalidTargetError("Requested resource is not supported");
    }

    const scopes = params.scopes?.length ? params.scopes : [MCP_OAUTH_SCOPE];
    if (!isSubset(scopes, [MCP_OAUTH_SCOPE])) {
      throw new InvalidScopeError("Only the mcp:tools scope is supported");
    }

    if (request.method !== "POST") {
      renderApprovalPage(res, client, { ...params, scopes });
      return;
    }

    const approvalTokenRaw = request.body?.approval_token;
    if (typeof approvalTokenRaw !== "string" || !constantTimeMatch(approvalTokenRaw, this.approvalToken)) {
      renderApprovalPage(
        res,
        client,
        { ...params, scopes },
        "Authorization token is invalid.",
      );
      return;
    }

    const code = randomUUID();
    this.authorizationCodes.set(code, {
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      scopes,
      resource: params.resource?.toString(),
      expiresAtMs: Date.now() + 5 * 60 * 1000,
    });

    const redirectUrl = new URL(params.redirectUri);
    redirectUrl.searchParams.set("code", code);
    if (params.state) {
      redirectUrl.searchParams.set("state", params.state);
    }
    res.redirect(302, redirectUrl.toString());
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const record = this.authorizationCodes.get(authorizationCode);
    if (!record || record.expiresAtMs < Date.now() || record.clientId !== client.client_id) {
      throw new InvalidGrantError("Authorization code is invalid or expired");
    }
    return record.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ) {
    const record = this.authorizationCodes.get(authorizationCode);
    if (!record || record.expiresAtMs < Date.now()) {
      throw new InvalidGrantError("Authorization code is invalid or expired");
    }
    if (record.clientId !== client.client_id) {
      throw new InvalidGrantError("Authorization code was issued to a different client");
    }
    if (redirectUri && redirectUri !== record.redirectUri) {
      throw new InvalidGrantError("redirect_uri does not match the authorization request");
    }
    if (resource && resource.toString() !== record.resource) {
      throw new InvalidTargetError("Requested resource does not match the authorization request");
    }

    this.authorizationCodes.delete(authorizationCode);
    return this.issueTokens({
      clientId: client.client_id,
      scopes: record.scopes,
      resource: record.resource,
    });
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ) {
    const record = this.refreshTokens.get(refreshToken);
    if (!record || record.expiresAtMs < Date.now()) {
      throw new InvalidGrantError("Refresh token is invalid or expired");
    }
    if (record.clientId !== client.client_id) {
      throw new InvalidGrantError("Refresh token was issued to a different client");
    }
    if (resource && resource.toString() !== record.resource) {
      throw new InvalidTargetError("Requested resource does not match the refresh token");
    }
    if (scopes && !isSubset(scopes, record.scopes)) {
      throw new InvalidScopeError("Requested scopes exceed the original grant");
    }

    this.refreshTokens.delete(refreshToken);
    return this.issueTokens({
      clientId: client.client_id,
      scopes: scopes?.length ? scopes : record.scopes,
      resource: record.resource,
    });
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const record = this.accessTokens.get(token);
    if (!record || record.expiresAtMs < Date.now()) {
      throw new InvalidTokenError("Access token is invalid or expired");
    }

    return {
      token,
      clientId: record.clientId,
      scopes: record.scopes,
      expiresAt: Math.floor(record.expiresAtMs / 1000),
      resource: record.resource ? new URL(record.resource) : undefined,
    };
  }

  private issueTokens(input: {
    clientId: string;
    scopes: string[];
    resource?: string;
  }) {
    const accessToken = randomUUID();
    const refreshToken = randomUUID();
    const accessExpiresAtMs = Date.now() + MCP_ACCESS_TOKEN_TTL_SECONDS * 1000;
    const refreshExpiresAtMs = Date.now() + MCP_REFRESH_TOKEN_TTL_SECONDS * 1000;

    this.accessTokens.set(accessToken, {
      clientId: input.clientId,
      scopes: input.scopes,
      resource: input.resource,
      expiresAtMs: accessExpiresAtMs,
    });
    this.refreshTokens.set(refreshToken, {
      clientId: input.clientId,
      scopes: input.scopes,
      resource: input.resource,
      expiresAtMs: refreshExpiresAtMs,
    });

    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: MCP_ACCESS_TOKEN_TTL_SECONDS,
      scope: input.scopes.join(" "),
      refresh_token: refreshToken,
    };
  }
}
