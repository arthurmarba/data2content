import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import McpOAuthClientModel from "@/app/models/McpOAuthClient";
import McpOAuthAuthorizationCodeModel from "@/app/models/McpOAuthAuthorizationCode";
import McpOAuthRefreshTokenModel from "@/app/models/McpOAuthRefreshToken";
import McpOAuthConsentRequestModel, {
  type IMcpOAuthConsentRequest,
} from "@/app/models/McpOAuthConsentRequest";
import { getMcpAccountState } from "../accountState";
import { getMcpAdminAuthorization } from "../adminAuthorization";
import {
  getMcpOAuthAuthorizationCodeTtlSeconds,
  getMcpOAuthRefreshTokenTtlDays,
  isMcpAdminResource,
} from "../config";
import {
  calculatePkceChallenge,
  generateOpaqueOAuthToken,
  hashOpaqueOAuthToken,
  safeOAuthStringEqual,
  signMcpAccessToken,
} from "./crypto";
import {
  McpOAuthError,
  assertMcpResource,
  isScopeSubset,
  parseOAuthClientScopes,
  parseOAuthScopesForResource,
  validatePkceChallenge,
  validatePkceVerifier,
  validateRedirectUri,
} from "./validation";

export interface RegisterMcpOAuthClientInput {
  client_name?: unknown;
  redirect_uris?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
  token_endpoint_auth_method?: unknown;
  scope?: unknown;
}

export interface McpOAuthAuthorizationInput {
  responseType: string | null;
  clientId: string | null;
  redirectUri: string | null;
  scope: string | null;
  state: string | null;
  resource: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
}

function assertStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new McpOAuthError("invalid_client_metadata", 400, `${name} deve ser uma lista de strings.`);
  }
  return value;
}

export async function registerMcpOAuthClient(input: RegisterMcpOAuthClientInput) {
  const redirectUris = assertStringArray(input.redirect_uris, "redirect_uris");
  if (redirectUris.length < 1 || redirectUris.length > 10) {
    throw new McpOAuthError("invalid_redirect_uri", 400, "Informe entre 1 e 10 redirect_uris.");
  }
  const validatedRedirectUris = [...new Set(redirectUris.map(validateRedirectUri))];
  const grantTypes = input.grant_types == null
    ? ["authorization_code", "refresh_token"]
    : assertStringArray(input.grant_types, "grant_types");
  if (
    !grantTypes.includes("authorization_code") ||
    grantTypes.some((grant) => grant !== "authorization_code" && grant !== "refresh_token")
  ) {
    throw new McpOAuthError("invalid_client_metadata", 400, "grant_types não suportado.");
  }
  const responseTypes = input.response_types == null
    ? ["code"]
    : assertStringArray(input.response_types, "response_types");
  if (responseTypes.length !== 1 || responseTypes[0] !== "code") {
    throw new McpOAuthError("invalid_client_metadata", 400, "Somente response_type=code é suportado.");
  }
  const authMethod = input.token_endpoint_auth_method ?? "none";
  if (authMethod !== "none") {
    throw new McpOAuthError("invalid_client_metadata", 400, "Somente clientes públicos com PKCE são suportados.");
  }
  const clientName = typeof input.client_name === "string" && input.client_name.trim()
    ? input.client_name.trim().slice(0, 120)
    : "MCP Client";
  const scopes = parseOAuthClientScopes(input.scope);
  const clientId = `d2c_mcp_${generateOpaqueOAuthToken(24)}`;

  await connectToDatabase();
  await McpOAuthClientModel.create({
    clientId,
    clientName,
    redirectUris: validatedRedirectUris,
    grantTypes,
    responseTypes,
    tokenEndpointAuthMethod: "none",
    scope: scopes,
  });
  logger.info("[mcp][oauth_client_registered]", {
    clientName,
    scopes,
    scopeCount: scopes.length,
  });

  return {
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: clientName,
    redirect_uris: validatedRedirectUris,
    grant_types: grantTypes,
    response_types: responseTypes,
    token_endpoint_auth_method: "none",
    scope: scopes.join(" "),
  };
}

export async function createMcpConsentRequest(
  input: McpOAuthAuthorizationInput,
  userId: string,
): Promise<string> {
  if (input.responseType !== "code" || !input.clientId || !input.redirectUri) {
    throw new McpOAuthError("invalid_request", 400, "Parâmetros obrigatórios de autorização ausentes.");
  }
  if (input.clientId.length > 200 || (input.state?.length || 0) > 1024) {
    throw new McpOAuthError("invalid_request", 400, "client_id ou state excede o limite permitido.");
  }
  const redirectUri = validateRedirectUri(input.redirectUri);
  const resource = assertMcpResource(input.resource);
  const codeChallenge = validatePkceChallenge(input.codeChallenge, input.codeChallengeMethod);

  await connectToDatabase();
  const client = await McpOAuthClientModel.findOne({ clientId: input.clientId }).lean();
  if (!client) throw new McpOAuthError("unauthorized_client", 400, "Cliente OAuth desconhecido.");
  if (!client.redirectUris.includes(redirectUri)) {
    throw new McpOAuthError("invalid_request", 400, "redirect_uri não pertence ao cliente.");
  }
  const scopes = parseOAuthScopesForResource(input.scope, resource);
  if (!isScopeSubset(scopes, client.scope)) {
    const expandedScopes = [...new Set([...client.scope, ...scopes])];
    await McpOAuthClientModel.updateOne(
      { _id: client._id },
      { $set: { scope: expandedScopes } },
    );
    logger.info("[mcp][oauth_client_scopes_expanded]", {
      clientName: client.clientName,
      previousScopes: client.scope,
      requestedScopes: scopes,
      expandedScopes,
    });
  }
  const requestToken = generateOpaqueOAuthToken(32);
  await McpOAuthConsentRequestModel.create({
    requestHash: hashOpaqueOAuthToken(requestToken),
    userId: new Types.ObjectId(userId),
    clientId: client.clientId,
    clientName: client.clientName,
    redirectUri,
    scope: scopes,
    resource,
    codeChallenge,
    state: input.state || null,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  return requestToken;
}

type ConsentRequestLike = Pick<
  IMcpOAuthConsentRequest,
  "redirectUri" | "state"
>;

function authorizationRedirect(claims: ConsentRequestLike, params: Record<string, string>): string {
  const redirect = new URL(claims.redirectUri);
  for (const [key, value] of Object.entries(params)) redirect.searchParams.set(key, value);
  if (claims.state) redirect.searchParams.set("state", claims.state);
  return redirect.toString();
}

export async function readMcpConsentRequest(token: string) {
  if (!token || token.length > 200) {
    throw new McpOAuthError("invalid_request", 400, "Solicitação de consentimento inválida.");
  }
  await connectToDatabase();
  const request = await McpOAuthConsentRequestModel.findOne({
    requestHash: hashOpaqueOAuthToken(token),
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!request) {
    throw new McpOAuthError("invalid_request", 400, "Solicitação de consentimento inválida ou expirada.");
  }
  return request;
}

async function consumeMcpConsentRequest(token: string, userId: string) {
  const request = await readMcpConsentRequest(token);
  if (!safeOAuthStringEqual(String(request.userId), userId)) {
    throw new McpOAuthError("access_denied", 403, "A sessão não corresponde à solicitação OAuth.");
  }
  const consumed = await McpOAuthConsentRequestModel.findOneAndUpdate(
    { _id: request._id, consumedAt: null },
    { $set: { consumedAt: new Date() } },
    { new: true },
  ).lean();
  if (!consumed) throw new McpOAuthError("invalid_request", 400, "Solicitação de consentimento já utilizada.");
  return consumed;
}

export async function denyMcpConsent(token: string, sessionUserId: string): Promise<string> {
  const claims = await consumeMcpConsentRequest(token, sessionUserId);
  return authorizationRedirect(claims, { error: "access_denied" });
}

export async function approveMcpConsent(token: string, sessionUserId: string): Promise<string> {
  const claims = await readMcpConsentRequest(token);
  if (!safeOAuthStringEqual(String(claims.userId), sessionUserId)) {
    throw new McpOAuthError("access_denied", 403, "A sessão não corresponde à solicitação OAuth.");
  }
  await assertMcpOAuthSubjectAccess(sessionUserId, claims.resource, "consent");
  const consumed = await consumeMcpConsentRequest(token, sessionUserId);
  const code = generateOpaqueOAuthToken();
  const expiresAt = new Date(Date.now() + getMcpOAuthAuthorizationCodeTtlSeconds() * 1000);
  await connectToDatabase();
  await McpOAuthAuthorizationCodeModel.create({
    codeHash: hashOpaqueOAuthToken(code),
    clientId: consumed.clientId,
    userId: new Types.ObjectId(sessionUserId),
    redirectUri: consumed.redirectUri,
    scope: consumed.scope,
    resource: consumed.resource,
    codeChallenge: consumed.codeChallenge,
    expiresAt,
  });
  return authorizationRedirect(consumed, { code });
}

export async function assertMcpOAuthSubjectAccess(
  userId: string,
  resource: string,
  phase: "consent" | "grant",
): Promise<void> {
  if (isMcpAdminResource(resource)) {
    const authorization = await getMcpAdminAuthorization(userId);
    if (!authorization.authorized) {
      throw new McpOAuthError(
        phase === "consent" ? "access_denied" : "invalid_grant",
        phase === "consent" ? 403 : 400,
        authorization.reason === "authorization_unavailable"
          ? "Não foi possível validar o acesso administrativo."
          : "A conta não possui acesso administrativo ao MCP.",
      );
    }
    return;
  }

  const accountState = await getMcpAccountState(userId);
  if (!accountState.accountAvailable) {
    throw new McpOAuthError(
      phase === "consent" ? "access_denied" : "invalid_grant",
      phase === "consent" ? 403 : 400,
      accountState.reason === "account_state_unavailable"
        ? "Não foi possível validar a conta Data2Content."
        : "A conta Data2Content não está disponível.",
    );
  }
}

async function createRefreshToken(params: {
  clientId: string;
  userId: string;
  scopes: string[];
  resource: string;
}) {
  const refreshToken = generateOpaqueOAuthToken(48);
  const tokenHash = hashOpaqueOAuthToken(refreshToken);
  const expiresAt = new Date(Date.now() + getMcpOAuthRefreshTokenTtlDays() * 86_400_000);
  await McpOAuthRefreshTokenModel.create({
    tokenHash,
    clientId: params.clientId,
    userId: new Types.ObjectId(params.userId),
    scope: params.scopes,
    resource: params.resource,
    expiresAt,
  });
  return { refreshToken, tokenHash };
}

async function buildTokenResponse(params: {
  clientId: string;
  userId: string;
  scopes: string[];
  resource: string;
}) {
  const [{ accessToken, expiresIn }, { refreshToken }] = await Promise.all([
    signMcpAccessToken({
      userId: params.userId,
      clientId: params.clientId,
      scopes: params.scopes,
      resource: params.resource,
    }),
    createRefreshToken(params),
  ]);
  logger.info("[mcp][oauth_token_issued]", {
    scopes: params.scopes,
    scopeCount: params.scopes.length,
  });
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    refresh_token: refreshToken,
    scope: params.scopes.join(" "),
  };
}

export async function exchangeMcpAuthorizationCode(form: URLSearchParams) {
  const code = form.get("code");
  const clientId = form.get("client_id");
  const redirectUriRaw = form.get("redirect_uri");
  const verifier = validatePkceVerifier(form.get("code_verifier"));
  if (!code || !clientId || !redirectUriRaw || code.length > 200 || clientId.length > 200) {
    throw new McpOAuthError("invalid_request", 400, "code, client_id e redirect_uri são obrigatórios.");
  }
  const redirectUri = validateRedirectUri(redirectUriRaw);
  const resource = assertMcpResource(form.get("resource"));
  await connectToDatabase();
  const codeHash = hashOpaqueOAuthToken(code);
  const grant = await McpOAuthAuthorizationCodeModel.findOne({
    codeHash,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!grant || grant.clientId !== clientId || grant.redirectUri !== redirectUri || grant.resource !== resource) {
    throw new McpOAuthError("invalid_grant", 400, "Código de autorização inválido.");
  }
  const actualChallenge = calculatePkceChallenge(verifier);
  if (!safeOAuthStringEqual(actualChallenge, grant.codeChallenge)) {
    throw new McpOAuthError("invalid_grant", 400, "Falha na validação PKCE.");
  }
  const consumed = await McpOAuthAuthorizationCodeModel.findOneAndUpdate(
    { _id: grant._id, usedAt: null },
    { $set: { usedAt: new Date() } },
    { new: true },
  ).lean();
  if (!consumed) throw new McpOAuthError("invalid_grant", 400, "Código de autorização já utilizado.");
  const userId = String(grant.userId);
  await assertMcpOAuthSubjectAccess(userId, resource, "grant");
  return buildTokenResponse({ clientId, userId, scopes: grant.scope, resource });
}

export async function exchangeMcpRefreshToken(form: URLSearchParams) {
  const refreshToken = form.get("refresh_token");
  const clientId = form.get("client_id");
  if (!refreshToken || !clientId || refreshToken.length > 300 || clientId.length > 200) {
    throw new McpOAuthError("invalid_request", 400, "refresh_token e client_id são obrigatórios.");
  }
  const resource = assertMcpResource(form.get("resource"));
  await connectToDatabase();
  const tokenHash = hashOpaqueOAuthToken(refreshToken);
  const existing = await McpOAuthRefreshTokenModel.findOne({
    tokenHash,
    clientId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!existing || existing.resource !== resource) {
    throw new McpOAuthError("invalid_grant", 400, "Refresh token inválido.");
  }
  const scopes = form.has("scope")
    ? parseOAuthScopesForResource(form.get("scope"), resource)
    : existing.scope;
  if (!isScopeSubset(scopes, existing.scope)) {
    throw new McpOAuthError("invalid_scope", 400, "Não é permitido ampliar scopes no refresh.");
  }
  const consumed = await McpOAuthRefreshTokenModel.findOneAndUpdate(
    { _id: existing._id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: true },
  ).lean();
  if (!consumed) throw new McpOAuthError("invalid_grant", 400, "Refresh token já utilizado.");
  const userId = String(existing.userId);
  await assertMcpOAuthSubjectAccess(userId, resource, "grant");
  const response = await buildTokenResponse({ clientId, userId, scopes, resource });
  await McpOAuthRefreshTokenModel.updateOne(
    { _id: existing._id },
    { $set: { replacedByTokenHash: hashOpaqueOAuthToken(response.refresh_token) } },
  );
  return response;
}

export async function revokeMcpRefreshToken(token: string, clientId: string): Promise<void> {
  await connectToDatabase();
  await McpOAuthRefreshTokenModel.updateOne(
    { tokenHash: hashOpaqueOAuthToken(token), clientId },
    { $set: { revokedAt: new Date() } },
  );
}
