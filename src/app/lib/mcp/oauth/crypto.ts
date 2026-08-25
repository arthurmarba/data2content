import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  SignJWT,
  calculateJwkThumbprint,
  importJWK,
  type JWK,
} from "jose";
import {
  getMcpOAuthAccessTokenTtlSeconds,
  getMcpOAuthAudience,
  getMcpOAuthIssuer,
} from "../config";
import { McpOAuthError } from "./validation";

interface OAuthKeyMaterial {
  privateKey: CryptoKey | Uint8Array;
  publicJwk: JWK;
  kid: string;
}

let cachedKeySource: string | null = null;
let cachedKeyMaterial: Promise<OAuthKeyMaterial> | null = null;

function readPrivateJwk(): JWK {
  const source = process.env.MCP_OAUTH_PRIVATE_JWK?.trim();
  if (!source) throw new McpOAuthError("server_error", 503, "Chave de assinatura OAuth não configurada.");
  try {
    const jwk = JSON.parse(source) as JWK;
    if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d || !jwk.x || !jwk.y) {
      throw new Error("Expected a private P-256 JWK");
    }
    return { ...jwk, alg: "ES256", use: "sig" };
  } catch {
    throw new McpOAuthError("server_error", 503, "MCP_OAUTH_PRIVATE_JWK inválida.");
  }
}

async function loadKeyMaterial(): Promise<OAuthKeyMaterial> {
  const privateJwk = readPrivateJwk();
  const publicJwk: JWK = { ...privateJwk };
  delete publicJwk.d;
  const kid = typeof privateJwk.kid === "string" && privateJwk.kid
    ? privateJwk.kid
    : await calculateJwkThumbprint(publicJwk);
  publicJwk.kid = kid;
  publicJwk.alg = "ES256";
  publicJwk.use = "sig";
  const privateKey = await importJWK({ ...privateJwk, kid }, "ES256");
  return { privateKey, publicJwk, kid };
}

async function getKeyMaterial(): Promise<OAuthKeyMaterial> {
  const source = process.env.MCP_OAUTH_PRIVATE_JWK?.trim() || "";
  if (!cachedKeyMaterial || cachedKeySource !== source) {
    cachedKeySource = source;
    cachedKeyMaterial = loadKeyMaterial();
  }
  return cachedKeyMaterial;
}

export function generateOpaqueOAuthToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashOpaqueOAuthToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

export function calculatePkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

export function safeOAuthStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function getMcpOAuthJwks() {
  const { publicJwk } = await getKeyMaterial();
  return { keys: [publicJwk] };
}

export async function signMcpAccessToken(params: {
  userId: string;
  clientId: string;
  scopes: string[];
  resource?: string;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const { privateKey, kid } = await getKeyMaterial();
  const expiresIn = getMcpOAuthAccessTokenTtlSeconds();
  const issuer = getMcpOAuthIssuer();
  const audience = params.resource || getMcpOAuthAudience();
  const accessToken = await new SignJWT({
    d2c_user_id: params.userId,
    scope: params.scopes.join(" "),
    client_id: params.clientId,
  })
    .setProtectedHeader({ alg: "ES256", kid, typ: "at+jwt" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(params.userId)
    .setJti(generateOpaqueOAuthToken(16))
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(privateKey);
  return { accessToken, expiresIn };
}

export function resetMcpOAuthKeyCacheForTests() {
  cachedKeySource = null;
  cachedKeyMaterial = null;
}
