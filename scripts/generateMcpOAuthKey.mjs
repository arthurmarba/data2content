import { generateKeyPairSync, randomBytes } from "node:crypto";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = privateKey.export({ format: "jwk" });
jwk.alg = "ES256";
jwk.use = "sig";
jwk.kid = randomBytes(12).toString("base64url");

process.stdout.write(`MCP_OAUTH_PRIVATE_JWK='${JSON.stringify(jwk)}'\n`);
