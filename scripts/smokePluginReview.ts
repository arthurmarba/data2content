/** Exercita o servidor MCP com dados reais das contas fictícias; não valida o transporte OAuth. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import mongoose from "mongoose";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createD2CMcpServer } from "../src/app/lib/mcp/server";
import { getMcpAccountState } from "../src/app/lib/mcp/accountState";
import { connectToDatabase } from "../src/app/lib/mongoose";
import User from "../src/app/models/User";
import ScriptEntry from "../src/app/models/ScriptEntry";

const WRITE = process.argv.includes("--write-demo");
const GENERATE = process.argv.includes("--live-generation");
const scopes = ["profile:read", "profile:write", "metrics:read", "content:read", "intelligence:read", "strategy:read", "collabs:read", "scripts:generate", "scripts:write", "campaigns:read"];
const report: Record<string, unknown> = { transport: "in_memory", oauthValidated: false, writeDemo: WRITE, liveGeneration: GENERATE, checks: [] };
const checks = report.checks as Array<Record<string, unknown>>;
async function main() {
  mongoose.set("autoIndex", false);
  process.env.MCP_CAMPAIGN_RADAR_ENABLED = "1";
  await connectToDatabase();
  for (const tier of ["pro", "free"]) {
    const email = `openai-review-${tier}@data2content.ai`;
    const user = await User.findOne({ email, role: "user", name: /^OpenAI Review/ }).select("_id").lean();
    assert(user, "Conta de demonstração não encontrada");
    const userId = String(user._id);
    const state = await getMcpAccountState(userId);
    assert.equal(state.accessLevel, tier);
    const server = createD2CMcpServer({ identity: { userId, subject: userId, scopes, issuer: "urn:review-fixture", token: "in-memory-no-http-token" }, accountState: state });
    const client = new Client({ name: "d2c-plugin-review-smoke", version: "1.0.0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a); await client.connect(b);
    async function call(name: string, args: Record<string, unknown> = {}, expectedError = false) {
      const start = Date.now();
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 180_000 });
      const text = (result.content as Array<{ type: string; text?: string }>).find(c => c.type === "text")?.text;
      let body: any;
      try { body = JSON.parse(text || "{}"); } catch { body = { error: text || "Resposta sem JSON" }; }
      checks.push({ tier, tool: name, isError: result.isError === true, expectedError, durationMs: Date.now() - start });
      assert.equal(result.isError === true, expectedError, `${tier}/${name}: ${body.error || "erro inesperado"}`);
      return body;
    }
    try {
      const { tools } = await client.listTools();
      assert.equal(tools.length, 26);
      const imported = JSON.parse(await fs.readFile("chatgpt-app-submission.json", "utf8"));
      for (const tool of tools) for (const hint of ["readOnlyHint", "destructiveHint", "openWorldHint"] as const) assert.equal(tool.annotations?.[hint], imported.tools[tool.name].annotations[hint], `${tool.name}/${hint}`);
      report.missingOutputSchemas = tools.filter(t => !t.outputSchema).map(t => t.name);
      await call("get_account_state");
      const map = await call("get_creator_map"); assert.equal(map.hasMap, true); assert.equal(map.evidenceLevel, "declared");
      await call("build_creator_radar", { periodDays: 180 });
      if (tier === "free") {
        await call("list_content_ideas", {}, true);
        await call("get_script_evidence_pack", { prompt: "Roteiro com referências próprias" }, true);
        await call("analyze_creator_period", { startDate: "2026-08-01", endDate: "2026-08-07", timeZone: "America/Sao_Paulo" }, true);
        continue;
      }
      const ideas = await call("list_content_ideas", { limit: 10 }); assert(ideas.total >= 3);
      await call("get_creator_profile"); await call("get_creator_content_dna");
      await call("get_creator_intelligence_snapshot", { lookbackDays: 180 });
      const found = await call("search", { query: "roteiro" });
      if (found.results?.[0]?.id) await call("fetch", { id: found.results[0].id });
      const period = await call("analyze_creator_period", { startDate: "2026-08-01", endDate: "2026-08-07", timeZone: "America/Sao_Paulo" });
      report.periodInventory = period.inventory;
      assert.equal(period.inventory.totalPosts, 3);
      const growth = await call("get_follower_growth", { startDate: "2026-08-01", endDate: "2026-08-07", timeZone: "America/Sao_Paulo" });
      report.followerCoverage = growth.coverage;
      await call("get_performance_summary"); await call("compare_content_formats");
      const top = await call("list_top_content", { metric: "reach", periodDays: 180, limit: 3 });
      const first = top.items?.[0];
      if (first?.id) await call("get_content_deep_analysis", { contentId: first.id.replace(/^post:/, ""), includeTranscript: false });
      const research = await call("research_inspiration_content", { query: "criação de conteúdo", periodDays: 180, limit: 2 });
      const ids = (research.items || []).map((item: any) => item.inspirationId || item.id).filter(Boolean);
      if (ids[0]) await call("analyze_inspiration_content", { inspirationId: ids[0] });
      if (ids.length >= 2) await call("compare_inspiration_contents", { inspirationIds: ids.slice(0, 2) });
      await call("recommend_collab_creators", { themeKeyword: "criação de conteúdo", periodDays: 180, limit: 2 });
      await call("find_campaign_opportunities", { query: "criação de conteúdo", limit: 2 });
      if (WRITE) {
        const pack = await call("get_script_evidence_pack", { prompt: "Clareza na criação de conteúdo", startsAt: "2026-08-01T00:00:00-03:00", endsAt: "2026-08-31T23:59:59-03:00", lookbackDays: 180 });
        report.evidenceReceipt = pack.receipt;
        const content = "Roteiro fictício para testar a revisão do plugin. Uma boa ideia começa pela mudança que você quer provocar. Pegue seu caderno e escreva uma situação concreta. Mostre o problema, escolha seu ponto de vista e termine com uma pergunta. A clareza aparece quando você decide o que pode ficar de fora. Qual ideia você quer tornar mais clara hoje?";
        await call("critique_script_against_creator_dna", { content, prompt: "Clareza na criação de conteúdo", clientRequestId: pack.clientRequestId, targetDurationSeconds: 40 });
        const saved = await call("save_script", { clientRequestId: pack.clientRequestId, title: "[Demonstração] Teste de revisão do plugin", content, userConfirmed: true });
        const replay = await call("save_script", { clientRequestId: pack.clientRequestId, title: "[Demonstração] Teste de revisão do plugin", content, userConfirmed: true });
        assert.match(saved.savedScript?.id || "", /^script:[a-f0-9]{24}$/);
        assert.equal(saved.savedScript.id, replay.savedScript?.id);
        await call("record_script_feedback", { scriptId: saved.savedScript.id.replace(/^script:/, ""), preferredDirection: "Frases curtas — preferência fictícia de teste" });
        await call("record_script_feedback", { scriptId: saved.savedScript.id.replace(/^script:/, ""), voiceMatch: false, notes: "$nota literal de demonstração" });
        const persisted = await ScriptEntry.findOne({ _id: saved.savedScript.id.replace(/^script:/, ""), userId }).select("content creatorFeedback").lean();
        assert.equal(persisted?.content, content);
        assert.equal(persisted?.creatorFeedback?.preferredDirection, "Frases curtas — preferência fictícia de teste");
        assert.equal(persisted?.creatorFeedback?.voiceMatch, false);
        assert.equal(persisted?.creatorFeedback?.notes, "$nota literal de demonstração");
      }
      if (GENERATE) {
        const result = await call("generate_script_draft", { prompt: "Roteiro fictício de demonstração sobre clareza na criação de conteúdo", targetDurationSeconds: 40, startsAt: "2026-08-01T00:00:00-03:00", endsAt: "2026-08-31T23:59:59-03:00" });
        report.generation = { provider: result.generation?.provider, hasDraft: !!result.draft?.content, validation: result.generation?.validation };
        assert(result.draft?.content?.length > 80);
      }
    } finally { await client.close(); await server.close(); }
  }
  report.passed = true;
}
main().catch(error => { report.passed = false; report.error = error instanceof Error ? error.message : "Falha no teste"; process.exitCode = 1; }).finally(async () => {
  await fs.mkdir("output/plugin-review", { recursive: true });
  await fs.writeFile("output/plugin-review/verification.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await mongoose.disconnect();
});
