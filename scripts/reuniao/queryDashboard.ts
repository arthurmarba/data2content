// scripts/reuniao/queryDashboard.ts
//
// Coleta (somente leitura) a série de N semanas de seguidores + engajamento
// (saves+shares) por participante de uma reunião já processada pelo Galisteu —
// reaproveita o context.json que o queryMeeting.ts já escreveu (roster + mapa),
// e soma a isso o que falta pra uma dashboard de resultados: histórico de
// seguidores (AccountInsightModel) e engajamento semana a semana (postsInWeek,
// o mesmo helper que a Galileia/Galisteu já usam).
//
// A análise QUALITATIVA da semana atual (pontoForte, pontoAjustar, coerencia,
// audienciaPede, comparativo, proximosPassos) já existe no deck.json da mesma
// reunião — este script não a duplica; ela é fundida depois, fora daqui.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/reuniao/queryDashboard.ts \
//     --context=output/reunioes/2026-07-09/context.json \
//     --semanas=6 \
//     --out=output/reunioes/2026-07-09/dashboard-data.json

import { promises as fs } from "node:fs";
import path from "node:path";
import { connectToDatabase } from "@/app/lib/mongoose";
import AccountInsightModel from "@/app/models/AccountInsight";
import { ymd, postsInWeek } from "../relatorio/lib/creatorWeek";
import type { MeetingContext, ParticipanteSemana } from "./lib/types";

if (!process.env.LOG_LEVEL) process.env.LOG_LEVEL = "error";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}

interface TopPost {
  postId: string | null;
  thumbnailUrl: string | null;
  description: string;
  proposal: string[];
  context: string[];
  tone: string[];
  saved: number;
  shares: number;
}

interface SemanaDados {
  semanaFim: string; // YYYY-MM-DD
  seguidores: number | null;
  seguidoresDelta: number | null;
  seguidoresGanho: number | null; // soma dos ganhos diários (aproximado)
  seguidoresPerda: number | null; // soma das perdas diárias, em módulo (aproximado)
  engajamento: number; // saved + shares somados dos posts da semana (o "ouro" do método)
  composicao: { curtidas: number; comentarios: number; salvos: number; compartilhamentos: number };
  interacoes: number; // total_interactions somado (numerador da taxa de participação)
  alcance: number; // reach somado da semana
  taxaParticipacao: number | null; // interacoes / alcance
  viewsMedioPorPost: number | null;
  posts: number; // nº de posts na semana (ritmo)
  topPost: TopPost | null;
}

type LeituraCruzada = "fundo" | "raso" | "estavel" | "acompanhando" | "dados-insuficientes";

interface ParticipanteDashboard {
  userId: string;
  nome: string;
  handle: string | null;
  profilePictureUrl: string | null;
  narrativaCentral: string;
  territorios: string[];
  semanas: SemanaDados[]; // ordem cronológica crescente (mais antiga primeiro)
  leituraCruzada: LeituraCruzada;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(23, 59, 59, 999);
  return r;
}

/** Janelas semanais de 7 dias terminando em `ate`, da mais antiga pra mais recente. */
function janelasSemanais(ate: Date, n: number): { de: Date; ate: Date }[] {
  const janelas: { de: Date; ate: Date }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const fim = endOfDay(addDays(ate, -7 * i));
    const inicio = new Date(addDays(fim, -6));
    inicio.setUTCHours(0, 0, 0, 0);
    janelas.push({ de: inicio, ate: fim });
  }
  return janelas;
}

function topPostDaSemana(posts: Awaited<ReturnType<typeof postsInWeek>>): TopPost | null {
  if (posts.length === 0) return null;
  const ord = [...posts].sort(
    (a, b) =>
      (b.stats.saved ?? 0) + (b.stats.shares ?? 0) - ((a.stats.saved ?? 0) + (a.stats.shares ?? 0)),
  );
  const p = ord[0]!;
  return {
    postId: p.postId,
    thumbnailUrl: p.thumbnailUrl,
    description: p.description,
    proposal: p.proposal,
    context: p.context,
    tone: p.tone,
    saved: p.stats.saved ?? 0,
    shares: p.stats.shares ?? 0,
  };
}

/** Seguidores por fim de semana, com forward-fill do último valor conhecido
 *  (mesma lógica de getFollowerTrendChartData, com bucket semanal). */
async function seguidoresPorSemana(
  userId: string,
  fins: Date[],
): Promise<(number | null)[]> {
  const primeiraData = fins[0]!;
  const snapshots = await AccountInsightModel.find({
    user: userId,
    recordedAt: { $lte: fins[fins.length - 1]! },
  })
    .sort({ recordedAt: 1 })
    .select("recordedAt followersCount")
    .lean();

  let ponteiro = 0;
  let ultimoConhecido: number | null = null;
  const resultado: (number | null)[] = [];

  for (const fim of fins) {
    while (
      ponteiro < snapshots.length &&
      new Date((snapshots[ponteiro] as any).recordedAt).getTime() <= fim.getTime()
    ) {
      const v = (snapshots[ponteiro] as any).followersCount;
      if (typeof v === "number") ultimoConhecido = v;
      ponteiro++;
    }
    resultado.push(ultimoConhecido);
  }

  void primeiraData;
  return resultado;
}

/** Ganho/perda de seguidores por semana, a partir da série DIÁRIA (forward-fill),
 *  mesma abordagem de getFollowerDailyChangeData.ts — soma os deltas positivos
 *  (ganho) e negativos em módulo (perda) dentro de cada janela semanal.
 *  Aproximado por natureza (a régua de amostragem do Instagram não é diária pra
 *  todo mundo): um "ganho" isolado grande pode ser um salto real ou só a conta
 *  de várias semanas sem snapshot caindo no mesmo dia — não afirma causalidade. */
async function ganhoPerdaPorSemana(
  userId: string,
  janelas: { de: Date; ate: Date }[],
): Promise<{ ganho: number | null; perda: number | null }[]> {
  const inicio = janelas[0]!.de;
  const fim = janelas[janelas.length - 1]!.ate;

  const snapshots = await AccountInsightModel.find({ user: userId, recordedAt: { $lte: fim } })
    .sort({ recordedAt: 1 })
    .select("recordedAt followersCount")
    .lean();

  const porDia = new Map<string, number>();
  for (const s of snapshots as any[]) {
    if (typeof s.followersCount === "number") {
      porDia.set(ymd(new Date(s.recordedAt)), s.followersCount);
    }
  }

  let ultimoConhecido: number | null = null;
  const snapshotAntes = await AccountInsightModel.findOne({ user: userId, recordedAt: { $lt: inicio } })
    .sort({ recordedAt: -1 })
    .select("followersCount")
    .lean();
  if (snapshotAntes && typeof (snapshotAntes as any).followersCount === "number") {
    ultimoConhecido = (snapshotAntes as any).followersCount;
  }

  const deltasPorDia = new Map<string, number>(); // dia -> variação vs dia anterior com dado
  let cursor = new Date(inicio);
  let anterior = ultimoConhecido;
  while (cursor <= fim) {
    const chave = ymd(cursor);
    if (porDia.has(chave)) {
      const atual = porDia.get(chave)!;
      if (anterior != null) deltasPorDia.set(chave, atual - anterior);
      anterior = atual;
    }
    cursor = addDays(cursor, 1);
  }

  return janelas.map(({ de, ate }) => {
    let ganho = 0;
    let perda = 0;
    let teveDado = false;
    for (const [diaStr, delta] of deltasPorDia) {
      const dia = new Date(`${diaStr}T12:00:00.000Z`);
      if (dia >= de && dia <= ate) {
        teveDado = true;
        if (delta > 0) ganho += delta;
        else if (delta < 0) perda += -delta;
      }
    }
    return teveDado ? { ganho, perda } : { ganho: null, perda: null };
  });
}

function media(vals: number[]): number | null {
  const validos = vals.filter((v) => Number.isFinite(v));
  if (validos.length === 0) return null;
  return validos.reduce((a, b) => a + b, 0) / validos.length;
}

function pctChange(velho: number | null, novo: number | null): number | null {
  if (velho == null || novo == null || velho === 0) return null;
  return (novo - velho) / Math.abs(velho);
}

/** Abaixo disso, % de variação de engajamento é ruído estatístico (base quase
 *  zero) — ex.: parar de postar faz o engajamento "cair 100%", o que soa como
 *  "raso" (seguidores crescendo mais que engajamento) mas na real é só
 *  inatividade, não um problema de audiência não engajando. */
const POSTS_MINIMOS_PARA_LEITURA = 4;

function calcularLeituraCruzada(semanas: SemanaDados[]): LeituraCruzada {
  if (semanas.length < 4) return "dados-insuficientes";
  const totalPosts = semanas.reduce((acc, s) => acc + s.posts, 0);
  if (totalPosts < POSTS_MINIMOS_PARA_LEITURA) return "dados-insuficientes";

  const meio = Math.floor(semanas.length / 2);
  const antigas = semanas.slice(0, meio);
  const recentes = semanas.slice(semanas.length - meio);

  const seguidoresAntigos = media(antigas.map((s) => s.seguidores).filter((v): v is number => v != null));
  const seguidoresRecentes = media(recentes.map((s) => s.seguidores).filter((v): v is number => v != null));
  const engAntigo = media(antigas.map((s) => s.engajamento));
  const engRecente = media(recentes.map((s) => s.engajamento));

  const deltaSeguidores = pctChange(seguidoresAntigos, seguidoresRecentes);
  const deltaEng = pctChange(engAntigo, engRecente);

  if (deltaSeguidores == null || deltaEng == null) return "dados-insuficientes";

  const diff = deltaEng - deltaSeguidores;
  if (Math.abs(deltaSeguidores) < 0.05 && Math.abs(deltaEng) < 0.05) return "estavel";
  if (diff > 0.15) return "fundo"; // engajamento crescendo mais que seguidores
  if (diff < -0.15) return "raso"; // seguidores crescendo mais que engajamento
  return "acompanhando"; // sobem/descem juntos, sem descolar
}

async function gatherParticipante(
  p: ParticipanteSemana,
  janelas: { de: Date; ate: Date }[],
): Promise<ParticipanteDashboard | null> {
  if (!p.encontrado || !p.userId) return null;

  const fins = janelas.map((j) => j.ate);
  const seguidores = await seguidoresPorSemana(p.userId, fins);
  const ganhoPerda = await ganhoPerdaPorSemana(p.userId, janelas);

  const semanas: SemanaDados[] = [];
  for (let i = 0; i < janelas.length; i++) {
    const { de, ate } = janelas[i]!;
    const posts = await postsInWeek(p.userId, de, ate);
    const engajamento = posts.reduce((acc, post) => acc + (post.stats.saved ?? 0) + (post.stats.shares ?? 0), 0);
    const composicao = posts.reduce(
      (acc, post) => ({
        curtidas: acc.curtidas + (post.stats.likes ?? 0),
        comentarios: acc.comentarios + (post.stats.comments ?? 0),
        salvos: acc.salvos + (post.stats.saved ?? 0),
        compartilhamentos: acc.compartilhamentos + (post.stats.shares ?? 0),
      }),
      { curtidas: 0, comentarios: 0, salvos: 0, compartilhamentos: 0 },
    );
    const interacoes = posts.reduce((acc, post) => acc + (post.stats.total_interactions ?? 0), 0);
    const alcance = posts.reduce((acc, post) => acc + (post.stats.reach ?? 0), 0);
    const somaViews = posts.reduce((acc, post) => acc + (post.stats.views ?? 0), 0);
    const seguidoresAtual = seguidores[i] ?? null;
    const seguidoresAnterior = i > 0 ? seguidores[i - 1] ?? null : null;
    semanas.push({
      semanaFim: ymd(ate),
      seguidores: seguidoresAtual,
      seguidoresDelta:
        seguidoresAtual != null && seguidoresAnterior != null ? seguidoresAtual - seguidoresAnterior : null,
      seguidoresGanho: ganhoPerda[i]?.ganho ?? null,
      seguidoresPerda: ganhoPerda[i]?.perda ?? null,
      engajamento,
      composicao,
      interacoes,
      alcance,
      taxaParticipacao: alcance > 0 ? interacoes / alcance : null,
      viewsMedioPorPost: posts.length > 0 ? somaViews / posts.length : null,
      posts: posts.length,
      topPost: topPostDaSemana(posts),
    });
  }

  return {
    userId: p.userId,
    nome: p.nome,
    handle: p.handle,
    profilePictureUrl: p.profilePictureUrl,
    narrativaCentral: p.narrativaCentral,
    territorios: p.territorios,
    semanas,
    leituraCruzada: calcularLeituraCruzada(semanas),
  };
}

function digest(dados: ParticipanteDashboard[], naoEncontrados: string[]): string {
  const l: string[] = [`▸ Dashboard — ${dados.length} participante(s) com dados`, ``];
  for (const p of dados) {
    l.push(`── ${p.nome} (${p.handle ?? "?"}) — leituraCruzada: ${p.leituraCruzada}`);
    for (const s of p.semanas) {
      const top = s.topPost
        ? `top: sv=${s.topPost.saved} sh=${s.topPost.shares} "${s.topPost.description.slice(0, 50)}"`
        : "sem posts";
      const c = s.composicao;
      l.push(
        `   ${s.semanaFim} | seguidores=${s.seguidores ?? "?"} (Δ${s.seguidoresDelta ?? "?"}, ` +
          `+${s.seguidoresGanho ?? "?"}/-${s.seguidoresPerda ?? "?"}) | eng(sv+sh)=${s.engajamento} ` +
          `[curt=${c.curtidas} com=${c.comentarios} sv=${c.salvos} sh=${c.compartilhamentos}] | ` +
          `alcance=${s.alcance} taxaPart=${s.taxaParticipacao != null ? (s.taxaParticipacao * 100).toFixed(1) + "%" : "?"} | ` +
          `posts=${s.posts} | ${top}`,
      );
    }
    l.push(``);
  }
  if (naoEncontrados.length) {
    l.push(`✗ sem userId (fora da dashboard): ${naoEncontrados.join(", ")}`, ``);
  }
  return l.join("\n");
}

async function main() {
  const contextPath = arg("context");
  if (!contextPath) {
    console.error("✗ use --context=output/reunioes/<data>/context.json");
    process.exit(2);
  }
  const semanas = Number(arg("semanas") ?? "6");
  const outArg = arg("out");

  const ctx: MeetingContext = JSON.parse(await fs.readFile(path.resolve(contextPath), "utf-8"));
  const ate = endOfDay(new Date(`${ctx.data}T00:00:00.000Z`));
  const janelas = janelasSemanais(ate, semanas);

  await connectToDatabase();

  const dados: ParticipanteDashboard[] = [];
  const naoEncontrados: string[] = [];
  for (const p of ctx.participantes) {
    const r = await gatherParticipante(p, janelas);
    if (r) dados.push(r);
    else naoEncontrados.push(p.consulta);
  }

  const payload = JSON.stringify(dados, null, 2);
  if (outArg) {
    const outPath = path.resolve(outArg);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, payload);
    console.error(`✓ dashboard-data salvo em ${outPath} (${dados.length}/${ctx.participantes.length} com dados)`);
    process.stdout.write(digest(dados, naoEncontrados) + "\n");
  } else {
    process.stdout.write(payload);
  }

  await (await connectToDatabase()).connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
