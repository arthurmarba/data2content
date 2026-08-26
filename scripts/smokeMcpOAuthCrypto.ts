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
  process.env.MCP_ADMIN_SERVER_URL = "http://localhost:3000/api/mcp/admin";
  process.env.MCP_SUPPORTED_SCOPES = "profile:read";
  process.env.MCP_CONNECTION_SCOPES = "profile:read";
  process.env.MCP_ADMIN_SUPPORTED_SCOPES = "admin:creators:search";
  process.env.MCP_ADMIN_CONNECTION_SCOPES = "admin:creators:search";

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
  const { authenticateAdminMcpRequest, authenticateMcpRequest } =
    await import("../src/app/lib/mcp/auth");
  const identity = await authenticateMcpRequest(
    new Request("http://localhost:3000/api/mcp", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
  if (identity.userId !== userId || identity.clientId !== "smoke-client") {
    throw new Error("MCP resource-server authentication did not accept the self-hosted token");
  }

  const { accessToken: adminAccessToken } = await signMcpAccessToken({
    userId,
    clientId: "admin-smoke-client",
    scopes: ["admin:creators:search"],
    resource: "http://localhost:3000/api/mcp/admin",
  });
  const adminIdentity = await authenticateAdminMcpRequest(
    new Request("http://localhost:3000/api/mcp/admin", {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    }),
  );
  if (adminIdentity.userId !== userId || adminIdentity.clientId !== "admin-smoke-client") {
    throw new Error("Admin MCP did not accept a token minted for its resource");
  }

  async function expectAudienceRejection(operation: () => Promise<unknown>, label: string) {
    try {
      await operation();
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "invalid_token") return;
      throw error;
    }
    throw new Error(`${label} unexpectedly accepted a token minted for another MCP resource`);
  }

  await expectAudienceRejection(
    () => authenticateAdminMcpRequest(
      new Request("http://localhost:3000/api/mcp/admin", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ),
    "Admin MCP",
  );
  await expectAudienceRejection(
    () => authenticateMcpRequest(
      new Request("http://localhost:3000/api/mcp", {
        headers: { Authorization: `Bearer ${adminAccessToken}` },
      }),
    ),
    "Subscriber MCP",
  );

  process.stdout.write("MCP OAuth signing/JWKS and audience isolation smoke passed.\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
