import mongoose from "mongoose";
import { performance } from "node:perf_hooks";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { connectToDatabase } from "../src/app/lib/mongoose";
import UserModel from "../src/app/models/User";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function textPayload(result: CallToolResult) {
  const part = result.content.find((item) => item.type === "text");
  assert(part?.type === "text", "A resposta MCP não contém conteúdo textual.");
  return JSON.parse(part.text) as Record<string, unknown>;
}

async function timed<T>(operation: () => Promise<T>) {
  const startedAt = performance.now();
  const value = await operation();
  return { value, durationMs: Math.round(performance.now() - startedAt) };
}

async function main() {
  const endpoint = process.env.MCP_ADMIN_HTTP_SMOKE_URL || "http://127.0.0.1:3102/api/mcp/admin";
  assert(process.env.MONGODB_URI, "MONGODB_URI não configurado para o smoke HTTP.");
  await connectToDatabase();
  const creators = await UserModel.find({ role: { $ne: "admin" } })
    .sort({ isInstagramConnected: -1, followers_count: -1 })
    .select("_id")
    .limit(2)
    .lean();
  await mongoose.disconnect();
  assert(creators.length === 2, "São necessários dois creators para o smoke HTTP.");
  const expectedCreatorRefs = creators.map((creator) => `creator:${String(creator._id)}`);

  const client = new Client({ name: "mcp-admin-http-smoke", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint));
  try {
    const connection = await timed(() => client.connect(transport));
    const listed = await timed(() => client.listTools());
    assert(listed.value.tools.length === 10, "O endpoint admin não expôs as dez ferramentas esperadas.");
    assert(
      listed.value.tools.every((tool) => tool.annotations?.readOnlyHint === true),
      "Uma ferramenta administrativa não está marcada como somente leitura.",
    );

    const searched = await timed(() => client.callTool({
      name: "search",
      arguments: { query: String(creators[0]!._id) },
    }));
    assert(searched.value.isError !== true, "A ferramenta search falhou via HTTP.");
    const searchPayload = textPayload(searched.value as CallToolResult);
    const results = searchPayload.results;
    assert(Array.isArray(results) && results.length === 1, "A busca exata não retornou um creator.");
    const creatorRef = (results[0] as { id?: unknown }).id;
    assert(typeof creatorRef === "string" && creatorRef.startsWith("creator:"), "Creator ref inválido.");

    const fetched = await timed(() => client.callTool({ name: "fetch", arguments: { id: creatorRef } }));
    assert(fetched.value.isError !== true, "A ferramenta fetch falhou via HTTP.");
    const serializedFetch = JSON.stringify(textPayload(fetched.value as CallToolResult));
    assert(!/access.?token|refresh.?token|client.?secret/i.test(serializedFetch), "A resposta expôs um segredo.");

    const compared = await timed(() => client.callTool({
      name: "compare_creators",
      arguments: {
        creatorRefs: expectedCreatorRefs,
        startDate: "2026-07-27",
        endDate: "2026-08-26",
        timeZone: "America/Sao_Paulo",
      },
    }));
    assert(compared.value.isError !== true, "A ferramenta compare_creators falhou via HTTP.");

    const slowestToolMs = Math.max(searched.durationMs, fetched.durationMs);
    assert(slowestToolMs < 5_000, `Latência administrativa acima do gate local: ${slowestToolMs}ms.`);
    assert(compared.durationMs < 15_000, `Comparação administrativa acima do gate local: ${compared.durationMs}ms.`);
    process.stdout.write(
      `MCP Admin HTTP smoke passed: connect=${connection.durationMs}ms list=${listed.durationMs}ms search=${searched.durationMs}ms fetch=${fetched.durationMs}ms compare=${compared.durationMs}ms.\n`,
    );
  } finally {
    await client.close().catch(() => undefined);
  }
}

main().catch(async (error) => {
  await mongoose.disconnect().catch(() => undefined);
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
