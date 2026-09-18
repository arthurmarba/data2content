/**
 * Compara modelos de leitura de vídeo contra a leitura que já está em produção.
 *
 * Régua: o próprio gemini-2.5-flash relendo o mesmo vídeo — é a oscilação natural.
 * Um candidato só passa se divergir da leitura salva no mesmo patamar da régua.
 * Os modelos 3.x leem vídeo a 70 tokens por quadro por padrão; aqui eles rodam em
 * resolução alta, que é a hipótese em aberto desde 15/09/2026.
 *
 * Preparação (sem IA):  npx tsx --env-file=.env.local scripts/compareSceneModels.ts --usd-brl=6.5
 * Execução (paga):      npx tsx --env-file=.env.local scripts/compareSceneModels.ts --run
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { PartMediaResolutionLevel } from "@google/genai";
import { connectToDatabase } from "../src/app/lib/mongoose";
import Metric from "../src/app/models/Metric";
import User from "../src/app/models/User";
import Evidence from "../src/app/models/PublishedContentEvidence";
import Operation from "../src/app/models/GeminiOperation";
import { GeminiBudgetPolicy, GeminiBudgetBucket } from "../src/app/models/GeminiBudget";
import { loadMapProfiles, type MapProfile } from "../src/app/lib/relatorio/mapProfiles";
import { freshPublishedMedia } from "../src/app/lib/relatorio/publishedMedia";
import { evaluateSceneAgainstMap } from "../src/app/lib/relatorio/sceneEvaluation";
import { LEGACY_SCENE_FORMAT } from "../src/app/lib/relatorio/compactSceneFormat";
import { governanceHash } from "../src/app/lib/llm/geminiGovernance";

const opcao = (nome: string) => process.argv.find(v => v.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const DIRETORIO = path.resolve(opcao("output") ?? "output/modelos-cena");
const ARQUIVO = path.join(DIRETORIO, "manifest.json");
const MAX_ITENS = 12;
const TETO_BRL = 8;

/** Preço por milhão de tokens, consultado em 14/09/2026. */
const TARIFAS: Record<string, { inputUsdPerMillion: number; outputUsdPerMillion: number }> = {
  "gemini-2.5-flash":       { inputUsdPerMillion: 0.30, outputUsdPerMillion: 2.50 },
  "gemini-3.1-flash-lite":  { inputUsdPerMillion: 0.25, outputUsdPerMillion: 1.50 },
  "gemini-3.5-flash-lite":  { inputUsdPerMillion: 0.30, outputUsdPerMillion: 2.50 },
};

type Variante = { id: string; model: string; mediaResolution?: PartMediaResolutionLevel };
const TODAS: Variante[] = [
  { id: "regua",      model: "gemini-2.5-flash" },
  { id: "31lite-alt", model: "gemini-3.1-flash-lite", mediaResolution: PartMediaResolutionLevel.MEDIA_RESOLUTION_HIGH },
  { id: "35lite-alt", model: "gemini-3.5-flash-lite", mediaResolution: PartMediaResolutionLevel.MEDIA_RESOLUTION_HIGH },
];
/** `--apenas=35lite-alt` repete uma variante só, sem repagar as outras. */
const apenas = opcao("apenas")?.split(",").filter(Boolean);
/** Sufixo da identidade do experimento, para repetir uma variante corrigida. */
const sufixo = opcao("sufixo") ? `:${opcao("sufixo")}` : "";
const VARIANTES: Variante[] = apenas?.length ? TODAS.filter(v => apenas.includes(v.id)) : TODAS;

type Referencia = { assetRoleIds: string[]; toneIds: string[]; subjects: string[]; placeId: string | null; transcript: string };
type Item = { metricId: string; mediaId: string; creatorId: string; duration: number; profile: MapProfile; referencia: Referencia };
type Manifest = { id: string; createdAt: string; usdBrl: number; capBrl: number; items: Item[] };

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const diferenca = (a: string[], b: string[]) => { const o = new Set(b.map(normal)); return a.filter(x => !o.has(normal(x))); };

/** Semelhança de fala por bigramas de palavra (Dice) — tolera reescrita, pune perda. */
function semelhanca(a: string, b: string): number {
  const bigramas = (texto: string) => {
    const palavras = normal(texto).split(/\s+/).filter(Boolean);
    return palavras.slice(1).map((palavra, i) => `${palavras[i]} ${palavra}`);
  };
  const x = bigramas(a), y = bigramas(b);
  if (!x.length || !y.length) return x.length === y.length ? 1 : 0;
  const conta = new Map<string, number>();
  for (const bigrama of x) conta.set(bigrama, (conta.get(bigrama) ?? 0) + 1);
  let comuns = 0;
  for (const bigrama of y) { const n = conta.get(bigrama) ?? 0; if (n > 0) { comuns++; conta.set(bigrama, n - 1); } }
  return (2 * comuns) / (x.length + y.length);
}

async function preparar() {
  const usdBrl = Number(opcao("usd-brl"));
  if (!Number.isFinite(usdBrl) || usdBrl <= 0) throw new Error("Informe --usd-brl com cotação conservadora.");
  const lidos = await Metric.find({
    type: { $in: ["REEL", "VIDEO"] },
    "sceneElements.version": "cena_mapa_v4",
    "stats.video_duration_seconds": { $gt: 0, $lte: 120 },
    postDate: { $gte: new Date(Date.now() - 60 * 86400000) },
    instagramMediaId: { $nin: [null, ""] },
  }).select("user instagramMediaId stats.video_duration_seconds sceneElements postDate").sort({ postDate: -1 }).limit(200).lean();

  const evidencias = new Map<string, any>();
  for (const evidencia of await Evidence.find({ metricId: { $in: lidos.map((m: any) => m._id) } }).select("metricId transcript").lean()) {
    evidencias.set(String((evidencia as any).metricId), evidencia);
  }
  const perfis = await loadMapProfiles([...new Set(lidos.map((m: any) => String(m.user)))]);

  // Espalha por criador e por duração: um criador só não define a régua.
  const porCriador = new Map<string, number>();
  const items: Item[] = [];
  for (const metric of lidos as any[]) {
    const creatorId = String(metric.user);
    const evidencia = evidencias.get(String(metric._id));
    const fala = evidencia?.transcript?.fullText ?? "";
    if (!perfis.has(creatorId) || typeof fala !== "string" || fala.length < 40) continue;
    if ((porCriador.get(creatorId) ?? 0) >= 2) continue;
    porCriador.set(creatorId, (porCriador.get(creatorId) ?? 0) + 1);
    items.push({
      metricId: String(metric._id), mediaId: metric.instagramMediaId, creatorId,
      duration: metric.stats.video_duration_seconds, profile: perfis.get(creatorId)!,
      referencia: {
        assetRoleIds: metric.sceneElements?.assetRoleIds ?? [],
        toneIds: metric.sceneElements?.toneIds ?? [],
        subjects: metric.sceneElements?.subjects ?? [],
        placeId: metric.sceneElements?.placeId ?? null,
        transcript: fala,
      },
    });
    if (items.length === MAX_ITENS) break;
  }
  const manifest: Manifest = { id: `modelos-cena-${new Date().toISOString().slice(0, 10)}`, createdAt: new Date().toISOString(), usdBrl, capBrl: TETO_BRL, items };
  await fs.mkdir(DIRETORIO, { recursive: true });
  await fs.writeFile(ARQUIVO, JSON.stringify(manifest, null, 2), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ preparados: items.length, criadores: porCriador.size, chamadasPrevistas: items.length * VARIANTES.length, tetoBrl: TETO_BRL }));
}

async function executar() {
  const manifest = JSON.parse(await fs.readFile(ARQUIVO, "utf8")) as Manifest;
  if (manifest.items.length > MAX_ITENS || manifest.capBrl !== TETO_BRL) throw new Error("Manifesto fora do combinado.");

  // Orçamento próprio: o experimento não pode comer o dinheiro da leitura de produção.
  const policyId = `comparison:${manifest.id}`;
  const cap = Math.floor((manifest.capBrl / manifest.usdBrl) * 1e6);
  await GeminiBudgetPolicy.updateOne({ _id: policyId }, { $setOnInsert: { enabled: true, globalDailyMicros: cap, rates: TARIFAS } }, { upsert: true });

  const resumo: any[] = [];
  for (const [indice, item] of manifest.items.entries()) {
    const user = await User.findById(item.creatorId).select("instagramAccessToken").lean<any>();
    if (!user?.instagramAccessToken) { resumo.push({ indice, pulado: "sem token" }); continue; }
    const media = await freshPublishedMedia(item.mediaId, user.instagramAccessToken).catch(() => null);
    if (!media?.mediaUrl || media.mediaType !== "VIDEO") { resumo.push({ indice, pulado: "mídia indisponível (áudio protegido?)" }); continue; }

    // Baixa uma vez e serve das mesmas fitas para todas as variantes: comparação justa
    // e sem pagar banda três vezes.
    const arquivo = path.join(DIRETORIO, `video-${indice}.mp4`);
    let bytes: Buffer;
    try { bytes = await fs.readFile(arquivo); }
    catch {
      const resposta = await fetch(media.mediaUrl, { signal: AbortSignal.timeout(60000) });
      if (!resposta.ok) { resumo.push({ indice, pulado: `download ${resposta.status}` }); continue; }
      bytes = Buffer.from(await resposta.arrayBuffer());
      await fs.writeFile(arquivo, bytes, { mode: 0o600 });
    }
    const buffer = new Uint8Array(bytes).buffer;

    for (const variante of VARIANTES) {
      const saida = await evaluateSceneAgainstMap({
        metricId: item.metricId, mediaUrl: media.mediaUrl, profile: item.profile, durationSeconds: item.duration,
        model: variante.model, mediaResolution: variante.mediaResolution,
        responseFormat: LEGACY_SCENE_FORMAT,
        // `--sufixo=v2` cria identidade nova: sem isso, a trava de pagamento único recusa
        // repetir uma variante que já tem operação registrada, mesmo que tenha falhado.
        experiment: { id: `${manifest.id}:${variante.id}${sufixo}`, budgetPolicyId: policyId },
        fetchImpl: (async () => new Response(buffer.slice(0), { headers: { "content-type": "video/mp4" } })) as typeof fetch,
      });
      await fs.writeFile(path.join(DIRETORIO, `${indice}-${variante.id}.json`), JSON.stringify(saida, null, 2), { mode: 0o600 });

      const linha: any = { indice, variante: variante.id, ok: saida.ok };
      if (saida.ok) {
        const r = item.referencia;
        const lidos = saida.result;
        linha.elementosPerdidos = diferenca(r.assetRoleIds, lidos.assetRoleIds).length;
        linha.elementosInventados = diferenca(lidos.assetRoleIds, r.assetRoleIds).length;
        linha.tomIgual = diferenca(r.toneIds, lidos.toneIds).length === 0 && diferenca(lidos.toneIds, r.toneIds).length === 0;
        linha.assuntosIguais = r.subjects.length ? 1 - diferenca(r.subjects, lidos.subjects).length / r.subjects.length : 1;
        linha.lugarIgual = normal(String(r.placeId ?? "")) === normal(String(lidos.placeId ?? ""));
        linha.fala = Number(semelhanca(r.transcript, lidos.transcript ?? "").toFixed(3));
      } else linha.motivo = saida.reason;
      resumo.push(linha);
      console.log(JSON.stringify(linha));
      await fs.writeFile(path.join(DIRETORIO, "summary.json"), JSON.stringify(resumo, null, 2), { mode: 0o600 });
      if (!saida.ok && /budget|saldo|balance/i.test(saida.reason)) { console.log("orçamento do experimento esgotado"); return; }
    }
    const balde = await GeminiBudgetBucket.findById(`experiment:${policyId}`).lean<any>();
    if ((balde?.allocatedMicros ?? 0) >= cap) { console.log("teto atingido"); break; }
  }

  const recibos = await Operation.find({ contentKey: { $regex: `^experiment:${manifest.id}:` } })
    .select("contentKey model response.usageMetadata chargedEstimateMicros").lean();
  await fs.writeFile(path.join(DIRETORIO, "usage.json"), JSON.stringify(recibos, null, 2), { mode: 0o600 });
  const porVariante: Record<string, { n: number; usd: number; entrada: number; saida: number }> = {};
  for (const recibo of recibos as any[]) {
    const variante = String(recibo.contentKey).split(":")[2] ?? "?";
    const uso = recibo.response?.usageMetadata ?? {};
    const tarifa = TARIFAS[recibo.model] ?? TARIFAS["gemini-2.5-flash"]!;
    const entrada = uso.promptTokenCount ?? 0, saida = (uso.candidatesTokenCount ?? 0) + (uso.thoughtsTokenCount ?? 0);
    porVariante[variante] ??= { n: 0, usd: 0, entrada: 0, saida: 0 };
    porVariante[variante]!.n++;
    porVariante[variante]!.entrada += entrada;
    porVariante[variante]!.saida += saida;
    porVariante[variante]!.usd += (entrada / 1e6) * tarifa.inputUsdPerMillion + (saida / 1e6) * tarifa.outputUsdPerMillion;
  }
  console.log(JSON.stringify({ custoPorVariante: porVariante }));
}

async function main() {
  await connectToDatabase();
  if (process.argv.includes("--run")) await executar();
  else await preparar();
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
