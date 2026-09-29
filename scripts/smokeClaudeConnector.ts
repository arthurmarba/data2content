/**
 * smokeClaudeConnector.ts — o conector como o Claude o vê, na conta fictícia.
 *
 * Roda todas as ferramentas do MCP com clientSurface "claude" na conta
 * openai-review-pro@ (dados sintéticos) e confere as duas exigências do diretório
 * da Anthropic: nenhum campo de ordem ao assistente e nenhuma frase que comece com
 * verbo de ordem fora dos campos que são conteúdo para o criador (pontos de
 * roteiro, recomendações, mensagens ao usuário).
 *
 * Por padrão só lê. Com --write-demo também grava NA CONTA FICTÍCIA: o mesmo Norte
 * que ela já tem, um roteiro "[Demonstração]", uma preferência fictícia, e chama a
 * geração de roteiro (custo de IA de centavos).
 *
 * Não passa pelo HTTP nem pelo OAuth: chama o servidor em memória, contra o banco real.
 * Ver docs/brain/40 Decisões/Conector do Claude sem ordens.md.
 *
 * @run `npx tsx --env-file=.env.local ./scripts/smokeClaudeConnector.ts`
 * @run `npx tsx --env-file=.env.local ./scripts/smokeClaudeConnector.ts --write-demo`
 */
import mongoose from "mongoose";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createD2CMcpServer } from "@/app/lib/mcp/server";
import { getMcpAccountState } from "@/app/lib/mcp/accountState";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

import { ASSISTANT_DIRECTIVE_KEYS } from "@/app/lib/mcp/claudeDirectoryPolicy";

const WRITE = process.argv.includes("--write-demo");
const DIRECTIVE_KEYS: ReadonlySet<string> = new Set(ASSISTANT_DIRECTIVE_KEYS);
// Campos cujo texto é conteúdo para o criador (roteiro, recomendação, mensagem ao usuário).
const CREATOR_CONTENT_PATH = /(scriptPoints|angle|winningStructures|structure|recommendations|message)(\[\])*$/;
function directiveKeys(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => directiveKeys(item, found));
  else if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      if (DIRECTIVE_KEYS.has(key)) found.add(key);
      directiveKeys(inner, found);
    }
  }
  return found;
}

// A conta fictícia não tem conexão real com a Meta: as consultas por @ recusam por desenho.
const EXPECTED_ERRORS = new Set([
  "get_public_instagram_creator:instagram_connection_required",
  "compare_public_instagram_creators:erro",
]);
const IMPERATIVE = /^(Não |Nunca |Use |Usar |Mostre |Apresente |Diga |Explique |Informe |Trate |Fale |Escreva |Inclua |Mencione |Respeite |Só |Sempre |Evite |Prefira |Combine |Adapte |Ignore |Relacione |Separe |Considere |Cite |Deixe |Peça |Pergunte |Chame |Confirme |Consulte |Abra |Conecte )/;
const imperativeHits = new Map<string, Set<string>>();
function scanImperatives(tool: string, value: unknown, path = ""): void {
  if (typeof value === "string") {
    if (IMPERATIVE.test(value.trim()) && !CREATOR_CONTENT_PATH.test(path)) {
      const set = imperativeHits.get(tool) ?? new Set<string>();
      set.add(`${path} → ${value.trim().slice(0, 70)}`);
      imperativeHits.set(tool, set);
    }
    return;
  }
  if (Array.isArray(value)) { value.forEach((item) => scanImperatives(tool, item, `${path}[]`)); return; }
  if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) scanImperatives(tool, v, path ? `${path}.${k}` : k);
}

async function main() {
  mongoose.set("autoIndex", false);
  process.env.USAGE_EVENTS_DISABLED = "1";
  process.env.MCP_CAMPAIGN_RADAR_ENABLED = "1";
  await connectToDatabase();
  const user = await User.findOne({ email: "openai-review-pro@data2content.ai", role: "user", name: /^OpenAI Review/ }).select("_id").lean();
  if (!user) throw new Error("conta de teste não encontrada");
  const userId = String(user._id);
  const state = await getMcpAccountState(userId);
  const scopes = ["profile:read", "profile:write", "metrics:read", "content:read", "intelligence:read", "strategy:read", "collabs:read", "scripts:generate", "scripts:write", "campaigns:read"];
  const server = createD2CMcpServer({
    identity: { userId, subject: userId, scopes, issuer: "urn:review-fixture", token: "in-memory" },
    accountState: state,
    clientSurface: "claude",
  });
  const client = new Client({ name: "d2c-claude-smoke", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);

  const rows: Array<{ tool: string; ok: boolean; error?: string; directives?: string[]; ms: number }> = [];
  const called = new Set<string>();
  async function call(name: string, args: Record<string, unknown> = {}) {
    const start = Date.now();
    called.add(name);
    try {
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 180_000 });
      const text = (result.content as Array<{ type: string; text?: string }>).find((c) => c.type === "text")?.text ?? "{}";
      let body: any = {};
      try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 80) }; }
      const found = [...directiveKeys(body), ...directiveKeys(result.structuredContent ?? {})];
      scanImperatives(name, body);
      rows.push({ tool: name, ok: result.isError !== true, error: result.isError ? String(body.error ?? body.raw ?? "erro") : undefined, directives: [...new Set(found)], ms: Date.now() - start });
      return body;
    } catch (error) {
      rows.push({ tool: name, ok: false, error: `exceção: ${error instanceof Error ? error.message.slice(0, 160) : "?"}`, ms: Date.now() - start });
      return {};
    }
  }

  try {
    const { tools } = await client.listTools();
    const instructions = client.getInstructions() ?? "";
    console.log(`ferramentas publicadas: ${tools.length} · instruções: ${instructions.length} caracteres`);
    const period = { startDate: "2026-08-01", endDate: "2026-08-07", timeZone: "America/Sao_Paulo" };

    const account = await call("get_account_state");
    await call("get_creator_profile");
    await call("get_creator_map");
    await call("list_content_ideas", { limit: 5 });
    await call("build_creator_radar", { periodDays: 180 });
    await call("get_creator_intelligence_snapshot", { lookbackDays: 180 });
    await call("get_creator_content_dna");
    await call("analyze_creator_period", period);
    await call("get_follower_growth", period);
    await call("get_performance_summary");
    await call("compare_content_formats");
    const top = await call("list_top_content", { metric: "reach", periodDays: 180, limit: 3 });
    const firstId = top.items?.[0]?.id;
    await call("get_content_deep_analysis", { contentId: typeof firstId === "string" ? firstId.replace(/^post:/, "") : "000000000000000000000000", includeTranscript: false });
    const found = await call("search", { query: "roteiro" });
    await call("fetch", { id: found.results?.[0]?.id ?? "script:000000000000000000000000" });
    const research = await call("research_inspiration_content", { query: "criação de conteúdo", periodDays: 180, limit: 2 });
    const ids = (research.items ?? []).map((item: any) => item.inspirationId ?? item.id).filter(Boolean);
    await call("analyze_inspiration_content", { inspirationId: ids[0] ?? "inspiration:000000000000000000000000" });
    await call("compare_inspiration_contents", { inspirationIds: ids.length >= 2 ? ids.slice(0, 2) : ["inspiration:000000000000000000000000", "inspiration:000000000000000000000001"] });
    await call("recommend_collab_creators", { themeKeyword: "criação de conteúdo", periodDays: 180, limit: 2 });
    await call("find_campaign_opportunities", { query: "criação de conteúdo", limit: 2 });
    await call("get_public_instagram_creator", { username: "nike", postLimit: 3 });
    await call("compare_public_instagram_creators", { usernames: ["nike", "adidas"], postLimit: 3 });
    if (!WRITE) {
      console.log("sem --write-demo: set_creator_north, roteiro, geração e preferência ficam de fora");
    } else {
    const north = typeof account.creatorNorth === "string" && account.creatorNorth.length >= 20 ? account.creatorNorth : null;
    if (north) await call("set_creator_north", { creatorNorth: north });
    const pack = await call("get_script_evidence_pack", { prompt: "Clareza na criação de conteúdo", startsAt: "2026-08-01T00:00:00-03:00", endsAt: "2026-08-31T23:59:59-03:00", lookbackDays: 180 });
    const content = "Roteiro fictício para testar o conector no Claude. Uma boa ideia começa pela mudança que você quer provocar. Pegue seu caderno e escreva uma situação concreta. Mostre o problema, escolha seu ponto de vista e termine com uma pergunta. Qual ideia você quer tornar mais clara hoje?";
    await call("critique_script_against_creator_dna", { content, prompt: "Clareza na criação de conteúdo", clientRequestId: pack.clientRequestId, targetDurationSeconds: 40 });
    await call("generate_script_draft", { prompt: "Roteiro fictício de demonstração sobre clareza na criação de conteúdo", title: "[Demonstração] Rascunho do teste do Claude", targetDurationSeconds: 40 });
    const saved = await call("save_script", { clientRequestId: pack.clientRequestId, title: "[Demonstração] Teste do conector no Claude", content, userConfirmed: true });
    const scriptId = typeof saved.savedScript?.id === "string" ? saved.savedScript.id.replace(/^script:/, "") : null;
    if (scriptId) await call("record_script_feedback", { scriptId, preferredDirection: "Frases curtas — preferência fictícia de teste" });
    }

    console.log("\nferramenta".padEnd(40) + "resultado");
    for (const row of rows) {
      console.log(`${row.tool.padEnd(38)} ${row.ok ? "ok  " : "erro"} ${row.error ?? ""}${row.directives?.length ? `  CAMPOS DE ORDEM: ${row.directives.join(",")}` : ""}  (${row.ms} ms)`);
    }
    const missing = tools.map((tool) => tool.name).filter((name) => !called.has(name));
    console.log(`\nchamadas: ${rows.length} · ferramentas publicadas não chamadas: ${missing.length ? missing.join(", ") : "nenhuma"}`);
    console.log(`respostas com campo de ordem: ${rows.filter((row) => row.directives?.length).length}`);
    console.log(`\nfrases que começam com verbo de ordem: ${[...imperativeHits.values()].reduce((n, set) => n + set.size, 0)}`);
    for (const [tool, set] of imperativeHits) for (const hit of set) console.log(`  ${tool}: ${hit}`);
    const failed = rows.filter((row) => !row.ok && !EXPECTED_ERRORS.has(`${row.tool}:${row.error}`));
    if (imperativeHits.size || rows.some((row) => row.directives?.length) || failed.length) {
      console.log(`\nFALHOU: ${failed.map((row) => `${row.tool} (${row.error})`).join(", ") || "frases ou campos de ordem acima"}`);
      process.exitCode = 1;
    } else {
      console.log("\nOK: todas as ferramentas chamadas, sem ordens ao assistente.");
    }
  } finally {
    await client.close();
    await server.close();
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
