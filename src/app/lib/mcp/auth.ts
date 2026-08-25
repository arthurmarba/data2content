import mongoose from "mongoose";
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyOptions,
} from "jose";
import { getMcpOAuthJwks } from "./oauth/crypto";
import {
  getMcpOAuthAudience,
  getMcpOAuthIssuer,
  getMcpOAuthJwksUrl,
  getMcpRequiredScope,
  getMcpResourceMetadataUrl,
  getMcpSupportedScopes,
} from "./config";

export type McpAuthErrorCode =
  | "missing_token"
  | "invalid_token"
  | "insufficient_scope"
  | "auth_not_configured";

export class McpAuthError extends Error {
  constructor(
    public readonly code: McpAuthErrorCode,
    public readonly status: number,
    message: string,
    public readonly requiredScopes: string[] = [],
  ) {
    super(message);
    this.name = "McpAuthError";
  }
}

export interface McpAuthenticatedIdentity {
  userId: string;
  subject: string;
  scopes: string[];
  issuer: string;
  token: string;
  clientId?: string;
}

interface McpOAuthConfig {
  issuer: string;
  audience: string;
  jwksUrl: string;
  userIdClaim: string;
  algorithms: string[];
}

let cachedJwksUrl: string | null = null;
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedLocalJwkSource: string | null = null;
let cachedLocalJwks: ReturnType<typeof createLocalJWKSet> | null = null;

function parseBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization")?.trim() || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new McpAuthError("missing_token", 401, "Token de acesso ausente.");
  }
  return match[1].trim();
}

function readOAuthConfig(): McpOAuthConfig {
  let issuer: string;
  let audience: string;
  let jwksUrl: string;
  try {
    issuer = getMcpOAuthIssuer();
    audience = getMcpOAuthAudience();
    jwksUrl = getMcpOAuthJwksUrl();
  } catch {
    throw new McpAuthError("auth_not_configured", 503, "Autenticação MCP ainda não está configurada.");
  }

  const algorithms = (process.env.MCP_OAUTH_ALLOWED_ALGORITHMS || "RS256,ES256")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    issuer,
    audience,
    jwksUrl,
    userIdClaim: process.env.MCP_OAUTH_USER_ID_CLAIM?.trim() || "d2c_user_id",
    algorithms,
  };
}

function getRemoteJwks(url: string) {
  if (!cachedJwks || cachedJwksUrl !== url) {
    cachedJwks = createRemoteJWKSet(new URL(url));
    cachedJwksUrl = url;
  }
  return cachedJwks;
}

async function getVerificationJwks(config: McpOAuthConfig) {
  const localJwkSource = process.env.MCP_OAUTH_PRIVATE_JWK?.trim() || "";
  const selfHostedJwksUrl = `${config.issuer}/api/mcp/oauth/jwks`;
  if (localJwkSource && config.jwksUrl === selfHostedJwksUrl) {
    if (!cachedLocalJwks || cachedLocalJwkSource !== localJwkSource) {
      cachedLocalJwks = createLocalJWKSet(await getMcpOAuthJwks());
      cachedLocalJwkSource = localJwkSource;
    }
    return cachedLocalJwks;
  }
  return getRemoteJwks(config.jwksUrl);
}

export function normalizeMcpScopes(payload: JWTPayload): string[] {
  const raw = payload.scope ?? payload.scp;
  if (typeof raw === "string") {
    return raw.split(/\s+/).map((scope) => scope.trim()).filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw.filter((scope): scope is string => typeof scope === "string" && Boolean(scope.trim()));
  }
  return [];
}

export function resolveMcpUserIdFromClaims(
  payload: JWTPayload,
  userIdClaim = "d2c_user_id",
): string {
  const claimedUserId = payload[userIdClaim];
  if (typeof claimedUserId === "string" && mongoose.isValidObjectId(claimedUserId)) {
    return claimedUserId;
  }
  if (typeof payload.sub === "string" && mongoose.isValidObjectId(payload.sub)) {
    return payload.sub;
  }
  throw new McpAuthError(
    "invalid_token",
    401,
    "Token sem vínculo válido com uma conta Data2Content.",
  );
}

function readClientId(payload: JWTPayload): string | undefined {
  const value = payload.client_id ?? payload.azp;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function maybeResolveDevelopmentIdentity(request: Request): McpAuthenticatedIdentity | null {
  if (process.env.NODE_ENV === "production" || process.env.MCP_DEV_AUTH_BYPASS !== "1") {
    return null;
  }
  const userId = process.env.MCP_DEV_USER_ID?.trim();
  if (!userId || !mongoose.isValidObjectId(userId)) return null;

  return {
    userId,
    subject: userId,
    scopes: ["profile:read", "metrics:read", "strategy:read", "content:read"],
    issuer: "local-development",
    token: request.headers.get("authorization") || "local-development",
  };
}

export async function authenticateMcpRequest(request: Request): Promise<McpAuthenticatedIdentity> {
  const developmentIdentity = maybeResolveDevelopmentIdentity(request);
  if (developmentIdentity) return developmentIdentity;

  const token = parseBearerToken(request);
  const config = readOAuthConfig();
  const verifyOptions: JWTVerifyOptions = {
    issuer: config.issuer,
    audience: config.audience,
    algorithms: config.algorithms,
  };

  try {
    const { payload } = await jwtVerify(token, await getVerificationJwks(config), verifyOptions);
    const scopes = normalizeMcpScopes(payload);
    const requiredScope = getMcpRequiredScope();
    if (!scopes.includes(requiredScope)) {
      throw new McpAuthError(
        "insufficient_scope",
        403,
        `O token não possui o scope obrigatório ${requiredScope}.`,
      );
    }

    return {
      userId: resolveMcpUserIdFromClaims(payload, config.userIdClaim),
      subject: payload.sub || "",
      scopes,
      issuer: config.issuer,
      token,
      clientId: readClientId(payload),
    };
  } catch (error) {
    if (error instanceof McpAuthError) throw error;
    throw new McpAuthError("invalid_token", 401, "Token de acesso inválido ou expirado.");
  }
}

export function buildMcpWwwAuthenticateHeader(error?: McpAuthError): string {
  const scopes = error?.requiredScopes.length
    ? [...new Set(error.requiredScopes)]
    : getMcpSupportedScopes();
  const parts = [
    `Bearer resource_metadata="${getMcpResourceMetadataUrl()}"`,
    `scope="${scopes.join(" ")}"`,
  ];
  if (error && error.code !== "auth_not_configured") {
    parts.push(`error="${error.code === "missing_token" ? "invalid_token" : error.code}"`);
  }
  return parts.join(", ");
}
