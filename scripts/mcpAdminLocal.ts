import { randomUUID } from "node:crypto";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

async function main() {
  // O stdout é reservado ao protocolo MCP; logs de serviços vão para stderr.
  const stderr = console.error.bind(console);
  console.log = stderr;
  console.info = stderr;
  console.warn = stderr;
  console.debug = stderr;

  const [{ connectToDatabase }, { getMcpAdminAuthorization },
    { getMcpAdminConnectionScopes }, { createD2CAdminMcpServer }, { logger }, { default: winston }] =
    await Promise.all([
      import("@/app/lib/mongoose"),
      import("@/app/lib/mcp/adminAuthorization"),
      import("@/app/lib/mcp/config"),
      import("@/app/lib/mcp/adminServer"),
      import("@/app/lib/logger"),
      import("winston"),
    ]);

  logger.clear();
  logger.add(new winston.transports.Console({
    stderrLevels: ["error", "warn", "info", "http", "verbose", "debug", "silly"],
  }));

  const [flag, userId] = process.argv.slice(2);
  if (flag !== "--user-id" || !userId || process.argv.length !== 4) {
    throw new Error("Configure o identificador da conta administradora com --user-id <id>.");
  }

  await connectToDatabase();
  const authorization = await getMcpAdminAuthorization(userId);
  if (!authorization.authorized) {
    throw new Error(`A conta administradora local não foi autorizada: ${authorization.reason}.`);
  }

  const server = createD2CAdminMcpServer({
    identity: {
      userId,
      subject: `local:${userId}`,
      scopes: getMcpAdminConnectionScopes(),
      issuer: "local-d2c-admin",
      token: "",
      clientId: "codex-local",
    },
    authorization,
    requestId: randomUUID(),
  });
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error("[d2c-admin-local] Falha ao iniciar:", error);
  process.exitCode = 1;
});
