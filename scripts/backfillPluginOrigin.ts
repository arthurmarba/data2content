/**
 * Marca a origem de plugin (ChatGPT ou Claude) de quem conectou antes de a
 * Data2Content passar a gravá-la na autorização (26/09/2026).
 *
 * Fonte: os refresh tokens OAuth do MCP comum (o administrativo fica de fora).
 * Vale a primeira conexão de cada conta. Só preenche quem ainda não tem origem.
 *
 * Sem opção, só mostra o que faria:
 *   npx tsx --env-file=.env.local scripts/backfillPluginOrigin.ts
 * Grava:
 *   npx tsx --env-file=.env.local scripts/backfillPluginOrigin.ts --apply
 */
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "../src/app/lib/mongoose";
import { surfaceFromClientRegistration } from "../src/app/lib/mcp/clientSurface";
import McpOAuthClient from "../src/app/models/McpOAuthClient";
import McpOAuthRefreshToken from "../src/app/models/McpOAuthRefreshToken";
import User from "../src/app/models/User";

async function main() {
  const apply = process.argv.includes("--apply");
  await connectToDatabase();

  const firstConnections = await McpOAuthRefreshToken.aggregate<{ _id: Types.ObjectId; clientId: string; firstAt: Date }>([
    { $match: { resource: { $not: /\/admin/ } } },
    { $sort: { createdAt: 1 } },
    { $group: { _id: "$userId", clientId: { $first: "$clientId" }, firstAt: { $first: "$createdAt" } } },
  ]);
  const clients = await McpOAuthClient.find({ clientId: { $in: [...new Set(firstConnections.map((row) => row.clientId))] } })
    .select("clientId clientName redirectUris")
    .lean();
  const surfaceByClient = new Map(clients.map((client) => [client.clientId, surfaceFromClientRegistration(client)]));
  const alreadyMarked = new Set(
    (await User.find({ _id: { $in: firstConnections.map((row) => row._id) }, pluginOrigin: { $exists: true } }).select("_id").lean())
      .map((user) => String(user._id)),
  );

  const pending = firstConnections.filter((row) => !alreadyMarked.has(String(row._id)));
  const byClient: Record<string, number> = {};
  for (const row of pending) {
    const client = surfaceByClient.get(row.clientId) ?? "chatgpt";
    byClient[client] = (byClient[client] ?? 0) + 1;
  }
  console.log(JSON.stringify({ connectedAccounts: firstConnections.length, alreadyMarked: alreadyMarked.size, toMark: pending.length, byClient, apply }, null, 2));

  if (!apply) return;
  let written = 0;
  for (const row of pending) {
    const client = surfaceByClient.get(row.clientId) ?? "chatgpt";
    const result = await User.updateOne(
      { _id: row._id, pluginOrigin: { $exists: false } },
      { $set: { pluginOrigin: { client, firstConnectedAt: row.firstAt } } },
    );
    written += result.modifiedCount;
  }
  console.log(JSON.stringify({ written }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
