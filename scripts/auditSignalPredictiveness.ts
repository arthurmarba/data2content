/**
 * auditSignalPredictiveness.ts — quais sinais do post preveem o desempenho do PRÓPRIO criador.
 *
 * SOMENTE LEITURA. Nenhuma escrita, nenhum índice, nenhuma mutação.
 *
 * A pergunta: o que o produto mostra como padrão ("o gancho que funciona pra você",
 * "seu melhor dia", "posts no seu território rendem mais") ajuda a adivinhar se o
 * PRÓXIMO post do criador vai bater a mediana dele? Se não ajuda, é ruído vestido de
 * insight.
 *
 * O método, por sinal e por criador:
 *   1. ordena os posts por data; os 70% mais antigos ensinam, os 30% mais novos testam;
 *   2. nos antigos, calcula quanto cada valor do sinal (ex.: "pergunta", "quinta-feira")
 *      rende acima ou abaixo da mediana do criador, encolhendo valores com poucos posts;
 *   3. nos novos, dá a cada post a nota aprendida para o valor dele e confere se a nota
 *      separa quem bateu a mediana de quem não bateu.
 *
 * O número é uma AUC calculada só com pares do MESMO criador: 0,50 é cara ou coroa,
 * 1,00 é acerto total. Criadores nunca são comparados entre si. O intervalo vem de
 * reamostrar criadores (bootstrap).
 *
 * Imprime só números agregados — nenhum nome, e-mail, id ou legenda.
 *
 * Métricas: alcance (serve a foto, carrossel e reel) e taxa de compartilhamento.
 * Posts da última semana ficam de fora porque ainda acumulam. Métrica atual de post
 * antigo não é retrato do passado — a comparação dentro do criador atenua, não zera.
 *
 * @run `npx tsx --env-file=.env.local ./scripts/auditSignalPredictiveness.ts`
 * @run `npx tsx --env-file=.env.local ./scripts/auditSignalPredictiveness.ts --months=12 --min-posts=20`
 */

import mongoose from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
import { loadMapProfiles } from "@/app/lib/relatorio/mapProfiles";
import { resolveTerritoryForContexts } from "@/app/lib/relatorio/territories";
import { classifyCreatorHookPattern } from "@/app/lib/mcp/creatorHookPattern";

type Label = string | null;

interface Post {
  date: Date;
  reach: number | null;
  shareRate: number | null;
  signals: Record<string, Label>;
}

function arg(name: string, fallback: number): number {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  const parsed = hit ? Number(hit.split("=")[1]) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const MONTHS = arg("months", 18);
const MIN_POSTS = arg("min-posts", 20);
const BOOTSTRAP = arg("bootstrap", 300);
const SHRINK = 3;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function first(values: unknown): string | null {
  if (!Array.isArray(values)) return null;
  const hit = values.find((value) => typeof value === "string" && value.trim());
  return hit ? String(hit).trim() : null;
}

function median(values: Array<number | null>): number | null {
  const usable = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (!usable.length) return null;
  const middle = usable.length >> 1;
  return usable.length % 2 ? usable[middle]! : (usable[middle - 1]! + usable[middle]!) / 2;
}

function durationBucket(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  if (seconds < 15) return "<15s";
  if (seconds < 30) return "15-30s";
  if (seconds < 60) return "30-60s";
  if (seconds <= 90) return "60-90s";
  return ">90s";
}

function brtParts(date: Date) {
  const shifted = new Date(date.getTime() - 3 * 3600_000);
  const hour = shifted.getUTCHours();
  const block = hour < 6 ? "madrugada" : hour < 12 ? "manha" : hour < 18 ? "tarde" : "noite";
  const days = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  return { weekday: days[shifted.getUTCDay()]!, block };
}

type Metric = (post: Post) => number | null;

/** Pares (positivo, negativo) do mesmo criador no trecho de teste. */
function scoredTest(posts: Post[], signal: string, metric: Metric) {
  const sorted = [...posts].sort((a, b) => a.date.getTime() - b.date.getTime());
  const cut = Math.floor(sorted.length * 0.7);
  const train = sorted.slice(0, cut);
  const test = sorted.slice(cut);
  const base = median(train.map(metric));
  if (!base || base <= 0) return null;

  const sums = new Map<string, { sum: number; n: number }>();
  for (const post of train) {
    const value = metric(post);
    const label = post.signals[signal];
    if (value === null || value <= 0 || label === null || label === undefined) continue;
    const entry = sums.get(label) ?? { sum: 0, n: 0 };
    entry.sum += Math.log(value / base);
    entry.n += 1;
    sums.set(label, entry);
  }
  const score = (label: Label | undefined) => {
    if (label === null || label === undefined) return null;
    const entry = sums.get(label);
    return entry ? entry.sum / (entry.n + SHRINK) : 0;
  };

  return test
    .map((post) => ({ value: metric(post), score: score(post.signals[signal]) }))
    .filter((row): row is { value: number; score: number } => row.value !== null && row.score !== null)
    .map((row) => ({ score: row.score, positive: row.value > base }));
}

function aucOver(creators: Post[][], signal: string, metric: Metric) {
  let concordant = 0;
  let pairs = 0;
  let testedPosts = 0;
  for (const posts of creators) {
    const rows = scoredTest(posts, signal, metric);
    if (!rows) continue;
    testedPosts += rows.length;
    const positives = rows.filter((row) => row.positive);
    const negatives = rows.filter((row) => !row.positive);
    for (const p of positives) {
      for (const n of negatives) {
        pairs += 1;
        concordant += p.score > n.score ? 1 : p.score === n.score ? 0.5 : 0;
      }
    }
  }
  return pairs ? { auc: concordant / pairs, pairs, testedPosts } : null;
}

function bootstrap(creators: Post[][], signal: string, metric: Metric): [number, number] | null {
  const samples: number[] = [];
  for (let i = 0; i < BOOTSTRAP; i += 1) {
    const resample = Array.from({ length: creators.length }, () => creators[Math.floor(Math.random() * creators.length)]!);
    const result = aucOver(resample, signal, metric);
    if (result) samples.push(result.auc);
  }
  if (samples.length < 20) return null;
  samples.sort((a, b) => a - b);
  return [samples[Math.floor(samples.length * 0.025)]!, samples[Math.floor(samples.length * 0.975)]!];
}

const SIGNALS: Array<{ key: string; label: string; group: string }> = [
  { key: "offMap", label: "o post realiza o mapa (algo do mapa apareceu no vídeo)", group: "Mapa" },
  { key: "mapSubject", label: "fala de um assunto do mapa", group: "Mapa" },
  { key: "mapAsset", label: "mostra um elemento de vida do mapa", group: "Mapa" },
  { key: "captionTerritory", label: "legenda cai num território do mapa", group: "Mapa" },
  { key: "hook", label: "tipo de gancho (7 tipos)", group: "Gancho" },
  { key: "format", label: "formato (reel, foto, carrossel)", group: "Forma" },
  { key: "duration", label: "duração do reel (faixa)", group: "Forma" },
  { key: "narrativeForm", label: "forma narrativa (classificação da legenda)", group: "Forma" },
  { key: "proposal", label: "proposta (classificação da legenda)", group: "Legenda" },
  { key: "tone", label: "tom (classificação da legenda)", group: "Legenda" },
  { key: "sceneTone", label: "tom do mapa lido no vídeo", group: "Cena" },
  { key: "place", label: "cenário", group: "Cena" },
  { key: "weekday", label: "dia da semana", group: "Quando" },
  { key: "block", label: "faixa de horário", group: "Quando" },
];

async function main() {
  await connectToDatabase();
  const db = mongoose.connection.db!;

  const until = new Date(Date.now() - 7 * 86_400_000);
  const since = new Date(Date.now() - MONTHS * 30 * 86_400_000);

  const raw = await db
    .collection("metrics")
    .find(
      { postDate: { $gte: since, $lt: until } },
      {
        projection: {
          user: 1, postDate: 1, type: 1, context: 1, proposal: 1, tone: 1, narrativeForm: 1,
          "stats.reach": 1, "stats.views": 1, "stats.video_views": 1, "stats.shares": 1,
          "stats.video_duration_seconds": 1, sceneElements: 1,
        },
      },
    )
    .toArray();

  const byCreator = new Map<string, typeof raw>();
  for (const row of raw) {
    const key = String(row.user ?? "");
    if (!key) continue;
    const list = byCreator.get(key) ?? [];
    list.push(row);
    byCreator.set(key, list);
  }
  const eligibleIds = [...byCreator.entries()].filter(([, rows]) => rows.length >= MIN_POSTS).map(([id]) => id);
  const profiles = await loadMapProfiles(eligibleIds);

  const creators: Post[][] = [];
  for (const id of eligibleIds) {
    const profile = profiles.get(id);
    const mapSubjects = new Set((profile?.subjects ?? []).map((subject) => subject.subjectId));
    const mapTerritories = new Set(profile?.territoryIds ?? []);
    const posts: Post[] = [];
    for (const row of byCreator.get(id)!) {
      const stats = row.stats ?? {};
      const reach = num(stats.reach) ?? num(stats.views) ?? num(stats.video_views);
      const shares = num(stats.shares);
      const scene = row.sceneElements && typeof row.sceneElements === "object" ? row.sceneElements : null;
      const opening = scene && typeof scene.openingLine === "string" && scene.openingLine.trim() ? scene.openingLine : null;
      const when = brtParts(new Date(row.postDate));
      const captionTerritory = profile ? resolveTerritoryForContexts(row.context)?.id ?? null : null;
      const sceneSubjects: string[] = Array.isArray(scene?.subjectIds) ? scene.subjectIds : [];
      const sceneAssets: string[] = Array.isArray(scene?.assetRoleIds) ? scene.assetRoleIds : [];

      posts.push({
        date: new Date(row.postDate),
        reach: reach && reach > 0 ? reach : null,
        shareRate: reach && reach > 0 && shares !== null ? shares / reach : null,
        signals: {
          offMap: scene && typeof scene.offMap === "boolean" ? (scene.offMap ? "fora" : "dentro") : null,
          mapSubject: scene && profile && mapSubjects.size
            ? (sceneSubjects.some((subject) => mapSubjects.has(subject)) ? "sim" : "nao")
            : null,
          mapAsset: scene && profile ? (sceneAssets.length ? "sim" : "nao") : null,
          captionTerritory: profile && mapTerritories.size && captionTerritory
            ? (mapTerritories.has(captionTerritory) ? "sim" : "nao")
            : null,
          hook: opening ? classifyCreatorHookPattern(opening) : null,
          format: typeof row.type === "string" ? row.type : null,
          duration: durationBucket(num(stats.video_duration_seconds)),
          narrativeForm: first(row.narrativeForm),
          proposal: first(row.proposal),
          tone: first(row.tone),
          sceneTone: scene ? first(scene.toneIds) ?? "nenhum" : null,
          place: scene && typeof scene.placeId === "string" ? scene.placeId : null,
          weekday: when.weekday,
          block: when.block,
        },
      });
    }
    creators.push(posts);
  }

  const totalPosts = creators.reduce((sum, posts) => sum + posts.length, 0);
  console.log(`\nSINAIS × DESEMPENHO DO PRÓPRIO CRIADOR`);
  console.log(`janela: últimos ${MONTHS} meses, sem a última semana · criadores com ≥${MIN_POSTS} posts: ${creators.length} · posts: ${totalPosts}`);
  console.log(`com mapa carregado: ${eligibleIds.filter((id) => profiles.has(id)).length} criadores`);
  console.log(`AUC dentro do criador: 0,50 = cara ou coroa · 70% antigos ensinam, 30% novos testam\n`);

  const metrics: Array<[string, Metric]> = [
    ["alcance", (post) => post.reach],
    ["compart.", (post) => post.shareRate],
  ];

  let lastGroup = "";
  for (const signal of SIGNALS) {
    if (signal.group !== lastGroup) {
      console.log(`── ${signal.group}`);
      lastGroup = signal.group;
    }
    const covered = creators.flat().filter((post) => post.signals[signal.key] !== null).length;
    const cells: string[] = [];
    for (const [name, metric] of metrics) {
      const result = aucOver(creators, signal.key, metric);
      const ci = result ? bootstrap(creators, signal.key, metric) : null;
      cells.push(
        result
          ? `${name} ${result.auc.toFixed(3)} (${ci ? `${ci[0].toFixed(2)}–${ci[1].toFixed(2)}` : "—"}, ${result.testedPosts} posts)`
          : `${name} —`,
      );
    }
    const coverage = `${Math.round((covered / totalPosts) * 100)}%`.padStart(4);
    console.log(`  ${signal.label.padEnd(56)} cobre ${coverage}  ${cells.join("   ")}`);
  }

  // A tese do produto em número bruto: post dentro do mapa × fora, contra a mediana do criador.
  console.log(`\n── Dentro × fora do mapa (lido do vídeo), alcance ÷ mediana do próprio criador`);
  for (const side of ["dentro", "fora"]) {
    const multiples: number[] = [];
    for (const posts of creators) {
      const base = median(posts.map((post) => post.reach));
      if (!base) continue;
      for (const post of posts) {
        if (post.signals.offMap === side && post.reach !== null) multiples.push(post.reach / base);
      }
    }
    const med = median(multiples);
    const beat = multiples.length ? Math.round((100 * multiples.filter((m) => m > 1).length) / multiples.length) : 0;
    console.log(`  ${side.padEnd(8)} mediana ${med ? med.toFixed(2) : "—"}x   bate a mediana em ${beat}%   n=${multiples.length}`);
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
