import mongoose from "mongoose";
import { exportJWK, generateKeyPair } from "jose";
import { connectToDatabase } from "../src/app/lib/mongoose";
import UserModel from "../src/app/models/User";
import McpAdminAuditEventModel from "../src/app/models/McpAdminAuditEvent";
import McpOAuthAuthorizationCodeModel from "../src/app/models/McpOAuthAuthorizationCode";
import McpOAuthClientModel from "../src/app/models/McpOAuthClient";
import McpOAuthConsentRequestModel from "../src/app/models/McpOAuthConsentRequest";
import McpOAuthRefreshTokenModel from "../src/app/models/McpOAuthRefreshToken";

const baseUrl = "http://localhost:3000";
const adminResource = `${baseUrl}/api/mcp/admin`;
const redirectUri = "http://127.0.0.1:4173/oauth/callback";
const requestId = `mcp-admin-integration-${Date.now()}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function configureEphemeralOAuth() {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  privateJwk.alg = "ES256";
  privateJwk.use = "sig";
  privateJwk.kid = `mcp-admin-integration-${Date.now()}`;

  process.env.MCP_OAUTH_PRIVATE_JWK = JSON.stringify(privateJwk);
  process.env.MCP_OAUTH_ISSUER = baseUrl;
  process.env.MCP_OAUTH_AUDIENCE = `${baseUrl}/api/mcp`;
  process.env.MCP_OAUTH_JWKS_URL = `${baseUrl}/api/mcp/oauth/jwks`;
  process.env.MCP_SERVER_URL = `${baseUrl}/api/mcp`;
  process.env.MCP_ADMIN_SERVER_URL = adminResource;
  process.env.MCP_ADMIN_REQUIRED_SCOPE = "admin:creators:search";
  process.env.MCP_ADMIN_SUPPORTED_SCOPES = "admin:creators:search,admin:creator:read";
  process.env.MCP_ADMIN_CONNECTION_SCOPES = "admin:creators:search,admin:creator:read";
  process.env.MCP_OAUTH_ALLOWED_ALGORITHMS = "ES256";
  process.env.MCP_ADMIN_ENABLED = "1";
}

async function cleanup(clientId: string | null) {
  const operations: Array<Promise<unknown>> = [
    McpAdminAuditEventModel.deleteMany({ requestId }),
  ];
  if (clientId) {
    operations.push(
      McpOAuthAuthorizationCodeModel.deleteMany({ clientId }),
      McpOAuthConsentRequestModel.deleteMany({ clientId }),
      McpOAuthRefreshTokenModel.deleteMany({ clientId }),
      McpOAuthClientModel.deleteMany({ clientId }),
    );
  }
  await Promise.all(operations);
}

async function main() {
  assert(process.env.MONGODB_URI, "MONGODB_URI não configurado para o smoke integrado.");
  await configureEphemeralOAuth();
  await connectToDatabase();

  const admin = await UserModel.findOne({ role: "admin" }).select("_id").lean();
  assert(admin?._id, "Nenhum usuário role=admin disponível para o smoke integrado.");
  const adminUserId = String(admin._id);
  process.env.MCP_ADMIN_ALLOWED_USER_IDS = adminUserId;

  const creator = await UserModel.findOne({ _id: { $ne: admin._id } })
    .sort({ isInstagramConnected: -1, followers_count: -1 })
    .select("_id")
    .lean();
  assert(creator?._id, "Nenhum creator disponível para o smoke integrado.");
  const creatorRef = `creator:${String(creator._id)}`;

  const {
    calculatePkceChallenge,
    generateOpaqueOAuthToken,
    resetMcpOAuthKeyCacheForTests,
  } = await import("../src/app/lib/mcp/oauth/crypto");
  const {
    approveMcpConsent,
    createMcpConsentRequest,
    exchangeMcpAuthorizationCode,
    exchangeMcpRefreshToken,
    registerMcpOAuthClient,
    revokeMcpRefreshToken,
  } = await import("../src/app/lib/mcp/oauth/service");
  const { authenticateAdminMcpRequest } = await import("../src/app/lib/mcp/auth");
  const { getMcpAdminAuthorization } = await import("../src/app/lib/mcp/adminAuthorization");
  const { beginMcpAdminAuditEvent, completeMcpAdminAuditEvent } =
    await import("../src/app/lib/mcp/adminAudit");
  resetMcpOAuthKeyCacheForTests();

  let clientId: string | null = null;

  try {
    const registration = await registerMcpOAuthClient({
      client_name: "Data2Content MCP Admin Integration Smoke",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "admin:creators:search admin:creator:read",
    });
    clientId = registration.client_id;

    const verifier = generateOpaqueOAuthToken(48);
    const consentToken = await createMcpConsentRequest({
      responseType: "code",
      clientId,
      redirectUri,
      scope: "admin:creators:search admin:creator:read",
      state: "integration-smoke",
      resource: adminResource,
      codeChallenge: calculatePkceChallenge(verifier),
      codeChallengeMethod: "S256",
    }, adminUserId);
    const approvalRedirect = await approveMcpConsent(consentToken, adminUserId);
    const code = new URL(approvalRedirect).searchParams.get("code");
    assert(code, "Consentimento não retornou authorization code.");

    const tokenResponse = await exchangeMcpAuthorizationCode(new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      resource: adminResource,
    }));
    const identity = await authenticateAdminMcpRequest(new Request(adminResource, {
      headers: { authorization: `Bearer ${tokenResponse.access_token}` },
    }));
    const authorization = await getMcpAdminAuthorization(identity.userId);
    assert(authorization.authorized, "Token válido não preservou a autorização role=admin.");

    const invocationId = await beginMcpAdminAuditEvent({
      requestId,
      actorUserId: identity.userId,
      targetCreatorIds: [String(creator._id)],
      clientId: identity.clientId,
      tool: "integration_smoke",
      scopes: identity.scopes,
    });
    await completeMcpAdminAuditEvent(invocationId, {
      status: "success",
      durationMs: 1,
      resultCount: 1,
    });

    const auditEvents = await McpAdminAuditEventModel.find({ requestId }).sort({ createdAt: 1 }).lean();
    assert(auditEvents.length === 1, "O smoke esperava exatamente um evento de auditoria.");
    assert(auditEvents.every((event) => event.status === "success"), "A auditoria não foi finalizada com sucesso.");
    assert(auditEvents.every((event) => event.expiresAt instanceof Date), "A retenção TTL não foi registrada.");
    assert(
      auditEvents.some((event) => event.targetCreatorIds.some((id) => String(id) === String(creator._id))),
      "A auditoria integrada não registrou o creator alvo.",
    );

    const refreshed = await exchangeMcpRefreshToken(new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenResponse.refresh_token,
      client_id: clientId,
      resource: adminResource,
      scope: "admin:creators:search",
    }));
    const narrowedIdentity = await authenticateAdminMcpRequest(new Request(adminResource, {
      headers: { authorization: `Bearer ${refreshed.access_token}` },
    }));
    assert(
      narrowedIdentity.scopes.join(" ") === "admin:creators:search",
      "O refresh não reduziu os scopes conforme solicitado.",
    );
    await revokeMcpRefreshToken(refreshed.refresh_token, clientId);

    process.stdout.write(
      `MCP Admin integration smoke passed: OAuth+PKCE, admin authorization, audit TTL, scope narrowing and target binding (${creatorRef.split(":")[0]}).\n`,
    );
  } finally {
    await cleanup(clientId);
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  await mongoose.disconnect().catch(() => undefined);
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
