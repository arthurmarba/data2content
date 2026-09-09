/** Completa apenas contas de demonstração já existentes; sem --apply, só inspeciona. */
import mongoose from "mongoose";
import { connectToDatabase } from "../src/app/lib/mongoose";
import User from "../src/app/models/User";
import Metric from "../src/app/models/Metric";
import MapaSeed from "../src/app/models/MapaSeed";
import Idea from "../src/app/models/CreatorContentIdea";
import Evidence from "../src/app/models/PublishedContentEvidence";
import { buildCreatorScriptDnaV3 } from "../src/app/lib/scripts/creatorScriptDnaV3";

const APPLY = process.argv.includes("--apply");
const FIXTURE = "openai-review-2026-09";
const ACCOUNTS = ["openai-review-pro@data2content.ai", "openai-review-free@data2content.ai"];
const ideas = [
  { title: "[Demonstração] Uma pauta começa pela transformação", hook: "Você está escolhendo o formato antes de saber o que quer dizer?", angle: "Mostrar no caderno como uma promessa específica muda a pauta.", points: ["Apresente uma ideia genérica", "Escreva a transformação desejada", "Escolha o formato depois da tese"] },
  { title: "[Demonstração] Consistência sem repetir a mesma ideia", hook: "Postar toda semana não precisa significar dizer sempre a mesma coisa.", angle: "Usar a mesa de trabalho para comparar três recortes do mesmo território.", points: ["Mostre três anotações", "Relacione cada recorte à narrativa", "Escolha um para desenvolver"] },
  { title: "[Demonstração] Seu ponto de vista cabe em uma frase", hook: "Se o seu roteiro pudesse ter uma única frase, qual seria?", angle: "Transformar uma anotação longa em uma tese concreta.", points: ["Leia uma anotação longa", "Retire o que não serve à tese", "Reescreva a frase central"] },
];

async function main() {
  mongoose.set("autoIndex", false);
  await connectToDatabase();
  const accounts = await User.find({ email: { $in: ACCOUNTS } }).select("_id email name role").lean();
  if (accounts.length !== 2 || accounts.some(u => !/^OpenAI Review/.test(u.name || "") || u.role !== "user")) {
    throw new Error("As duas contas exclusivas de revisão não foram identificadas; nenhuma gravação autorizada.");
  }
  const pro = accounts.find(u => u.email === ACCOUNTS[0])!;
  const metrics = await Metric.find({ user: pro._id, instagramMediaId: { $in: ["openai_review_post_01", "openai_review_post_03", "openai_review_post_04"] } }).sort({ postDate: 1 }).lean();
  if (metrics.length !== 3) throw new Error("Faltam os três posts sintéticos conhecidos; não usar conteúdo de clientes.");
  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", accounts: ACCOUNTS, maps: 2, ideas: ideas.length, plannedEvidence: metrics.length, observedTranscripts: 0, changesCredentials: false }));
  if (!APPLY) return;
  const now = new Date();
  for (const account of accounts) {
    await MapaSeed.updateOne({ userId: account._id }, { $setOnInsert: {
      userId: account._id,
      mapa: {
        narrativa_central: "Defender a clareza e a voz própria contra a pressão de produzir conteúdo genérico — perfil fictício de demonstração",
        territorios: ["Criação de conteúdo", "Planejamento editorial"],
        temas: ["Consistência", "Roteiros", "Ponto de vista"],
        narrativas_adjacentes: [], assets: ["Caderno de ideias", "Mesa de trabalho"],
        tom: "Direto e didático", formatos: ["Reels", "Carrossel"],
        maturidade: "seed", fonte: ["onboarding_declarativo"],
        observacoes: ["Dados fictícios exclusivos para revisão; sem leitura real de vídeos."],
      }, createdAt: now,
    } }, { upsert: true, runValidators: true });
  }
  for (let i = 0; i < ideas.length; i++) {
    const item = ideas[i]!;
    await Idea.updateOne({ userId: pro._id, generationJobId: `${FIXTURE}-${i}` }, { $setOnInsert: {
      userId: pro._id, generationJobId: `${FIXTURE}-${i}`, status: "active", source: "manual_seed",
      title: item.title, hook: item.hook, angle: item.angle, territory: "Criação de conteúdo",
      assets: ["Caderno de ideias", "Mesa de trabalho"], suggestedFormat: "Reels", tone: "Direto e didático",
      whyItFits: "A narrativa declarada contrapõe voz própria a conteúdo genérico dentro de Criação de conteúdo.",
      mapAnchors: [{ kind: "subject", source: "territories", label: "Criação de conteúdo" }],
      scriptPoints: item.points, scriptClosing: "Qual ideia você quer tornar mais clara hoje?",
      mapContextHash: FIXTURE, modelVersion: "manual_demo", generatedAt: now,
    } }, { upsert: true, runValidators: true });
    const metric = metrics[i]!;
    const text = `[Material fictício de demonstração; roteiro planejado, não transcrição observada.] ${item.hook} ${item.angle} ${item.points.join(". ")}. Antes de gravar, escolha uma ideia que ajude alguém a entender algo concreto. No caderno, escreva a mudança que você quer provocar e uma situação que mostre essa mudança. A clareza nasce dessa escolha. Depois, transforme a situação em começo, desenvolvimento e fechamento. Qual ideia você quer tornar mais clara hoje?`;
    const record = new Evidence({
      userId: pro._id, metricId: metric._id, instagramMediaId: metric.instagramMediaId,
      publishedAt: metric.postDate, evidenceVersion: "published_content_evidence_v1",
      transcript: { fullText: text, wordCount: text.split(/\s+/).length, language: "pt-BR", source: "stored_script", segments: [], quality: { status: "unverified", truncated: false, speakerVerified: false, temporalCoverage: null } },
      scenes: [], narrative: { hook: item.hook, promise: item.angle, structure: item.points, cta: "Qual ideia você quer tornar mais clara hoje?", subjects: ["Criação de conteúdo"], toneSignals: ["Direto", "Didático"] },
      visual: { setting: null, objects: [], framing: [], aesthetics: [], screenTitle: null },
      performance: { capturedAt: now }, scriptLink: { scriptId: null, confidence: "unlinked", similarity: null, source: "none" },
      completeness: { transcript: false, scenes: false, performance: true, duration: false, scriptLink: false },
      provider: "manual_demo_planned_script", analyzedAt: now,
    });
    await record.validate();
    const { _id, ...fields } = record.toObject();
    await Evidence.updateOne({ userId: pro._id, metricId: metric._id }, { $setOnInsert: fields }, { upsert: true, runValidators: true });
  }
  const dna = await buildCreatorScriptDnaV3({ userId: String(pro._id), lookbackDays: 365 });
  console.log(JSON.stringify({ completed: true, fixture: FIXTURE, dnaConfidence: dna?.confidence, coverage: dna?.coverage }));
}
main().catch(() => { console.error("Falha na preparação das contas de revisão; conferir dados e conectividade sem imprimir credenciais."); process.exitCode = 1; }).finally(() => mongoose.disconnect());
