// scripts/relatorio/queryEvolucaoSemanal.ts
//
// Coleta (somente leitura) a série semanal de UM criador pro "Painel de evolução
// semanal" — o formato validado com a Rafa Custódio: seguidores, ganho×perda,
// views médias/post, compartilhamentos, alcance total, taxa de participação e
// composição do engajamento, semana a semana. Sem a camada qualitativa da
// Galileia/Galisteu (pontoForte etc.) — é só o "boletim numérico".
//
// Reaproveita os mesmos helpers de scripts/relatorio/lib/creatorWeek.ts e a
// mesma lógica de bucket semanal/ganho-perda que scripts/reuniao/queryDashboard.ts
// já usa pra reunião de grupo — aqui aplicada a UM criador só, com mais semanas
// de histórico (padrão 12, como a Rafa).
//
// Uso:
//   npx tsx --env-file=.env.local scripts/relatorio/queryEvolucaoSemanal.ts \
//     --handle=@ronaldofonsecajr --semanas=12 --ate=2026-07-16 \
//     --out=output/relatorios/ronaldofonsecajr/evolucao-semanal.json

import { promises as fs } from "node:fs";
import path from "node:path";
import { connectToDatabase } from "@/app/lib/mongoose";
import AccountInsightModel from "@/app/models/AccountInsight";
import User from "@/app/models/User";
import { ymd, postsInWeek, resolveUserId } from "./lib/creatorWeek";

if (!process.env.LOG_LEVEL) process.env.LOG_LEVEL = "error";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}

interface SemanaEvolucao {
  semanaFim: string;
  seguidores: number | null;
  seguidoresDelta: number | null;
  seguidoresGanho: number | null;
  seguidoresPerda: number | null;
  composicao: { curtidas: number; comentarios: number; salvos: number; compartilhamentos: number };
  interacoes: number;
  alcance: number;
  taxaParticipacao: number | null;
  viewsMedioPorPost: number | null;
  posts: number;
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

async function seguidoresPorSemana(userId: string, fins: Date[]): Promise<(number | null)[]> {
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
  return resultado;
}

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
    if (typeof s.followersCount === "number") porDia.set(ymd(new Date(s.recordedAt)), s.followersCount);
  }

  let ultimoConhecido: number | null = null;
  const snapshotAntes = await AccountInsightModel.findOne({ user: userId, recordedAt: { $lt: inicio } })
    .sort({ recordedAt: -1 })
    .select("followersCount")
    .lean();
  if (snapshotAntes && typeof (snapshotAntes as any).followersCount === "number") {
    ultimoConhecido = (snapshotAntes as any).followersCount;
  }

  const deltasPorDia = new Map<string, number>();
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

async function main() {
  const handleArg = arg("handle");
  const nameArg = arg("name");
  if (!handleArg && !nameArg) {
    console.error("✗ use --handle=@fulano ou --name=\"Nome Completo\"");
    process.exit(2);
  }
  const semanas = Number(arg("semanas") ?? "12");
  const ateStr = arg("ate") ?? ymd(new Date());
  const outArg = arg("out");

  await connectToDatabase();

  const userId = await resolveUserId(handleArg, nameArg ?? null);
  if (!userId) {
    console.error(`✗ criador não encontrado: ${handleArg ?? nameArg}`);
    process.exit(1);
  }
  const user: any = await User.findById(userId).select("name username").lean();

  const ate = endOfDay(new Date(`${ateStr}T00:00:00.000Z`));
  const janelas = janelasSemanais(ate, semanas);
  const fins = janelas.map((j) => j.ate);

  const seguidores = await seguidoresPorSemana(userId, fins);
  const ganhoPerda = await ganhoPerdaPorSemana(userId, janelas);

  const semanasDados: SemanaEvolucao[] = [];
  for (let i = 0; i < janelas.length; i++) {
    const { de, ate: fimSemana } = janelas[i]!;
    const posts = await postsInWeek(userId, de, fimSemana);
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

    semanasDados.push({
      semanaFim: ymd(fimSemana),
      seguidores: seguidoresAtual,
      seguidoresDelta:
        seguidoresAtual != null && seguidoresAnterior != null ? seguidoresAtual - seguidoresAnterior : null,
      seguidoresGanho: ganhoPerda[i]?.ganho ?? null,
      seguidoresPerda: ganhoPerda[i]?.perda ?? null,
      composicao,
      interacoes,
      alcance,
      taxaParticipacao: alcance > 0 ? interacoes / alcance : null,
      viewsMedioPorPost: posts.length > 0 ? somaViews / posts.length : null,
      posts: posts.length,
    });
  }

  const payload = {
    nome: user?.name ?? (nameArg || handleArg),
    handle: user?.username ? `@${user.username.replace(/^@/, "")}` : null,
    periodo: { de: ymd(janelas[0]!.de), ate: ateStr, semanas },
    semanas: semanasDados,
  };

  const json = JSON.stringify(payload, null, 2);
  if (outArg) {
    const outPath = path.resolve(outArg);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, json);
    console.error(`✓ salvo em ${outPath}`);
  } else {
    process.stdout.write(json);
  }

  await (await connectToDatabase()).connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
