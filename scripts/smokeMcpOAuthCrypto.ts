import { exportJWK, generateKeyPair, importJWK, jwtVerify } from "jose";

async function main() {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  privateJwk.alg = "ES256";
  privateJwk.use = "sig";
  privateJwk.kid = "mcp-smoke-key";

  process.env.MCP_OAUTH_PRIVATE_JWK = JSON.stringify(privateJwk);
  process.env.MCP_OAUTH_ISSUER = "http://localhost:3000";
  process.env.MCP_OAUTH_AUDIENCE = "http://localhost:3000/api/mcp";
  process.env.MCP_OAUTH_JWKS_URL = "http://localhost:3000/api/mcp/oauth/jwks";
  process.env.MCP_SERVER_URL = "http://localhost:3000/api/mcp";

  const { getMcpOAuthJwks, resetMcpOAuthKeyCacheForTests, signMcpAccessToken } =
    await import("../src/app/lib/mcp/oauth/crypto");
  resetMcpOAuthKeyCacheForTests();
  const userId = "507f1f77bcf86cd799439011";
  const { accessToken } = await signMcpAccessToken({
    userId,
    clientId: "smoke-client",
    scopes: ["profile:read"],
  });
  const jwks = await getMcpOAuthJwks();
  const publicKey = await importJWK(jwks.keys[0]!, "ES256");
  const { payload } = await jwtVerify(accessToken, publicKey, {
    issuer: "http://localhost:3000",
    audience: "http://localhost:3000/api/mcp",
    algorithms: ["ES256"],
  });
  if (payload.d2c_user_id !== userId || payload.scope !== "profile:read") {
    throw new Error("OAuth access token claims did not round-trip");
  }
  const { authenticateMcpRequest } = await import("../src/app/lib/mcp/auth");
  const identity = await authenticateMcpRequest(
    new Request("http://localhost:3000/api/mcp", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
  if (identity.userId !== userId || identity.clientId !== "smoke-client") {
    throw new Error("MCP resource-server authentication did not accept the self-hosted token");
  }
  process.stdout.write("MCP OAuth signing/JWKS smoke passed.\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
