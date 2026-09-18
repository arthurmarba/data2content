/**
 * Compara o enriquecimento do mapa com raciocínio MÉDIO (produção hoje) e BAIXO.
 *
 * Mesma pergunta, mesmo modelo, mesma temperatura: muda só o nível de raciocínio.
 * Os padrões do Instagram vêm dos checkpoints já pagos (`mapa:instagram:<criador>`),
 * então o experimento não paga leitura visual — só a pergunta do enriquecimento.
 *
 * Preparação (sem IA):  npx tsx --env-file=.env.local scripts/compareMapaThinking.ts
 * Execução (paga):      npx tsx --env-file=.env.local scripts/compareMapaThinking.ts --run
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/app/lib/mongoose";
import State from "../src/app/models/ContentReadingState";
import MapaSeed, { type IMapaData } from "../src/app/models/MapaSeed";
import UsageLog from "../src/app/models/GeminiUsageLog";
import type { InstagramPatterns } from "../src/app/lib/mapaSeed/analyzeInstagramPosts";
import { buildPrompt } from "../src/app/lib/mapaSeed/enrichMapaWithInstagram";
import { callClaudeJSON } from "../src/app/lib/claudeService";

type Nivel = "medium" | "low";
type Item = { creatorId: string; mapa: IMapaData; patterns: InstagramPatterns };
type Manifest = { id: string; createdAt: string; maxCalls: number; items: Item[] };

const opcao = (nome: string) => process.argv.find(v => v.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const DIRETORIO = path.resolve(opcao("output") ?? "output/mapa-thinking");
/** Permite repetir a MESMA amostra com o prompt mudado, gravando noutra pasta. */
const ARQUIVO = path.resolve(opcao("manifest") ?? path.join(DIRETORIO, "manifest.json"));
const MAX_CRIADORES = 10;

const lista = (valor: unknown): string[] =>
  Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : [];

/** Divergência = chip que aparece em uma resposta e não na outra, ignorando caixa e acento. */
function diferenca(a: string[], b: string[]): string[] {
  const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const outros = new Set(b.map(normal));
  return a.filter(item => !outros.has(normal(item)));
}

async function preparar() {
  const checkpoints = await State.find({ "result.patterns": { $exists: true } })
    .select("_id result.patterns updatedAt").sort({ updatedAt: -1 }).limit(60).lean();
  const items: Item[] = [];
  for (const checkpoint of checkpoints as any[]) {
    const creatorId = String(checkpoint._id).replace(/^mapa:instagram:/, "");
    if (!mongoose.isValidObjectId(creatorId)) continue;
    const patterns = checkpoint.result?.patterns as InstagramPatterns | undefined;
    if (!patterns || patterns.amostragem === "insuficiente") continue;
    const seed: any = await MapaSeed.findOne({ userId: creatorId }).select("mapa").lean();
    if (!seed?.mapa?.narrativa_central) continue;
    items.push({ creatorId, mapa: seed.mapa, patterns });
    if (items.length === MAX_CRIADORES) break;
  }
  const manifest: Manifest = { id: `mapa-thinking-${new Date().toISOString().slice(0, 10)}`, createdAt: new Date().toISOString(), maxCalls: items.length * 2, items };
  await fs.mkdir(DIRETORIO, { recursive: true });
  await fs.writeFile(ARQUIVO, JSON.stringify(manifest, null, 2), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ preparados: items.length, chamadasPrevistas: manifest.maxCalls, arquivo: ARQUIVO }));
}

async function executar() {
  const manifest = JSON.parse(await fs.readFile(ARQUIVO, "utf8")) as Manifest;
  if (manifest.items.length > MAX_CRIADORES) throw new Error("Manifesto acima do teto do experimento.");
  await fs.mkdir(DIRETORIO, { recursive: true });
  const inicio = new Date();
  const resumo: any[] = [];

  for (const [indice, item] of manifest.items.entries()) {
    const prompt = buildPrompt(item.mapa, item.patterns);
    // Alterna a ordem para que um eventual efeito de ordem não favoreça sempre o mesmo nível.
    const niveis: Nivel[] = indice % 2 ? ["low", "medium"] : ["medium", "low"];
    const respostas: Partial<Record<Nivel, any>> = {};
    for (const nivel of niveis) {
      try {
        respostas[nivel] = await callClaudeJSON<any>(prompt, {
          intensity: "high", maxTokens: 1024, thinkingLevel: nivel,
          usageTag: `experimento_mapa_${nivel}`,
        });
      } catch (error) {
        respostas[nivel] = { erro: error instanceof Error ? error.message : String(error) };
      }
    }
    await fs.writeFile(path.join(DIRETORIO, `${indice}-respostas.json`), JSON.stringify({ creatorId: item.creatorId, respostas }, null, 2), { mode: 0o600 });

    const medio = respostas.medium ?? {};
    const baixo = respostas.low ?? {};
    const campos = ["territorios", "temas", "assets", "formatos", "narrativas_adjacentes"] as const;
    const divergencias = campos.flatMap(campo => [
      ...diferenca(lista(medio[campo]), lista(baixo[campo])).map(v => `só no médio · ${campo}: ${v}`),
      ...diferenca(lista(baixo[campo]), lista(medio[campo])).map(v => `só no baixo · ${campo}: ${v}`),
    ]);
    const linha = {
      indice, creatorId: item.creatorId,
      erro: medio.erro || baixo.erro || null,
      tomIgual: String(medio.tom ?? "") === String(baixo.tom ?? ""),
      narrativaIgual: String(medio.narrativa_central ?? "") === String(baixo.narrativa_central ?? ""),
      divergencias: divergencias.length,
      detalhe: divergencias.slice(0, 6),
    };
    resumo.push(linha);
    console.log(JSON.stringify(linha));
    await fs.writeFile(path.join(DIRETORIO, "summary.json"), JSON.stringify(resumo, null, 2), { mode: 0o600 });
    if (linha.erro && /saldo|budget|balance|quota/i.test(linha.erro)) break;
  }

  const uso = await UsageLog.aggregate([
    { $match: { tag: { $in: ["experimento_mapa_medium", "experimento_mapa_low"] }, ts: { $gte: inicio } } },
    { $group: { _id: "$tag", chamadas: { $sum: 1 }, entrada: { $sum: "$promptTokens" }, saida: { $sum: "$outputTokens" }, raciocinio: { $sum: "$thoughtsTokens" } } },
  ]);
  await fs.writeFile(path.join(DIRETORIO, "usage.json"), JSON.stringify(uso, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ uso }));
}

async function main() {
  await connectToDatabase();
  if (process.argv.includes("--run")) await executar();
  else await preparar();
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
