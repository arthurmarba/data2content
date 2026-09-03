// scripts/reuniao/queryMeeting.ts
//
// Monta o CONTEXTO de uma reunião de grupo para o Galisteu escrever o deck.
// Somente leitura. Para CADA participante, lê a semana (posts + classificação +
// mapa + foto), reaproveitando os mesmos helpers da Galileia
// (scripts/relatorio/lib/creatorWeek.ts) — a mesma fonte do Galeano.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/reuniao/queryMeeting.ts \
//     --handles=@a,@b,@c --ate=2026-06-23 --out=output/reunioes/2026-06-23
//
//   (alternativas de entrada: --names="Fulano de Tal;Beltrana Silva"
//                              --file=participantes.txt  → 1 @handle ou nome por linha)
//
// --ate = último dia do período (default: hoje). A semana são os 7 dias até --ate.
// --out = DIRETÓRIO da reunião → grava context.json lá; imprime digest no stdout.

import { promises as fs } from "node:fs";
import path from "node:path";
import { connectToDatabase } from "@/app/lib/mongoose";
import MapaSeed from "@/app/models/MapaSeed";
import User from "@/app/models/User";
import {
  ymd,
  slugify,
  resolveUserId,
  postsInWeek,
  statsWindow,
  enrichThumbs,
  profilePicFor,
  previousSnapshot,
} from "../relatorio/lib/creatorWeek";
import { computeBaseline, indicesFor, forceMagnitude, EVIDENCE_LABEL } from "../relatorio/lib/baseline";
import { buildPadroes } from "../relatorio/lib/patterns";
import type { MeetingContext, ParticipanteSemana, PostSemana } from "./lib/types";

if (!process.env.LOG_LEVEL) process.env.LOG_LEVEL = "error";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}

/** Resolve a lista de participantes a partir de --handles / --names / --file.
 *  Cada item carrega se a string parece um @handle ou um nome. */
async function lerParticipantes(): Promise<{ raw: string; isHandle: boolean }[]> {
  const itens: { raw: string; isHandle: boolean }[] = [];
  const handles = arg("handles");
  const names = arg("names");
  const file = arg("file");

  if (handles) {
    for (const h of handles.split(",").map((s) => s.trim()).filter(Boolean)) {
      itens.push({ raw: h, isHandle: true });
    }
  }
  if (names) {
    for (const n of names.split(";").map((s) => s.trim()).filter(Boolean)) {
      itens.push({ raw: n, isHandle: false });
    }
  }
  if (file) {
    const txt = await fs.readFile(path.resolve(file), "utf-8");
    for (const line of txt.split("\n").map((s) => s.trim()).filter(Boolean)) {
      itens.push({ raw: line, isHandle: line.startsWith("@") });
    }
  }
  return itens;
}

/** Monta a semana de UM participante (ou marca como não-encontrado). */
async function gatherParticipante(
  raw: string,
  isHandle: boolean,
  de: Date,
  ate: Date,
): Promise<ParticipanteSemana> {
  const handleArg = isHandle ? raw : null;
  const nameArg = isHandle ? null : raw;
  const userId = await resolveUserId(handleArg, nameArg);

  const vazio = (extra: Partial<ParticipanteSemana> = {}): ParticipanteSemana => ({
    encontrado: false,
    consulta: raw,
    userId: null,
    nome: raw,
    handle: isHandle ? raw : null,
    profilePictureUrl: null,
    narrativaCentral: "",
    territorios: [],
    temas: [],
    assets: [],
    tom: "",
    posts: [],
    anterior: null,
    ...extra,
  });

  if (!userId) return vazio();

  const [mapaDoc, user]: [any, any] = await Promise.all([
    MapaSeed.findOne({ userId }).lean(),
    User.findById(userId).select("name username").lean(),
  ]);
  if (!user) return vazio();

  const mapa = mapaDoc?.mapa ?? {};

  // Mesma leitura de 90 dias da Galileia, dois recortes (ver queryWeek.ts):
  //   • baseline dos índices por post = só o que ANTECEDE a semana (senão o post
  //     se compararia contra si mesmo);
  //   • base dos padrões = os 90 dias inteiros, incluindo a semana.
  const baselineInicio = new Date(de.getTime() - 90 * 24 * 60 * 60 * 1000);
  const padroesInicio = new Date(ate.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [posts, profilePictureUrl, janela] = await Promise.all([
    postsInWeek(userId, de, ate),
    profilePicFor(userId),
    statsWindow(userId, baselineInicio, ate),
  ]);
  await enrichThumbs(userId, posts); // thumbs frescas (a URL salva expira → 403)

  // Baseline do PRÓPRIO criador (nunca do território) + índice por post: é o que
  // deixa o host dizer "3× a mediana dela" em vez de comparar dois posts da mesma
  // semana — numa semana fraca o melhor post ainda é fraco, e o número cru mente.
  const baseline = computeBaseline(
    janela.filter((p) => p.postDate >= baselineInicio && p.postDate < de),
  );
  for (const p of posts) p.indices = indicesFor(p.stats, baseline);

  // Padrões de 90 dias: o que é HÁBITO deste criador, não o que foi sorte da semana.
  const padroes = buildPadroes(
    janela.filter((p) => p.postDate >= padroesInicio),
    { de: ymd(padroesInicio), ate: ymd(ate) },
    de,
    baseline.sufficient
      ? { shares: baseline.medianShares, saved: baseline.medianSaved, views: baseline.medianViews }
      : undefined,
  );

  // Comparativo: reusa o snapshots.json que a Galileia grava por criador.
  const slug = slugify(user.username?.replace(/^@/, "") || user.name || "");
  const snapshotsPath = path.resolve("output", "relatorios", slug, "snapshots.json");
  const anterior = await previousSnapshot(snapshotsPath, ymd(ate));

  return {
    encontrado: true,
    consulta: raw,
    userId: String(userId),
    nome: user.name ?? "Criador",
    handle: user.username ? `@${user.username.replace(/^@/, "")}` : null,
    profilePictureUrl,
    narrativaCentral: mapa.narrativa_central ?? "",
    territorios: mapa.territorios ?? [],
    temas: mapa.temas ?? [],
    assets: mapa.assets ?? [],
    tom: mapa.tom ?? "",
    posts,
    baseline,
    padroes,
    anterior,
  };
}

/** "3,2×" / "0,4×" / "—" — formato curto do índice contra a mediana do criador. */
function fmtIdx(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(1).replace(".", ",")}×`;
}

/** As linhas de padrão que mais puxam pra cima/baixo — o HÁBITO do criador, não a
 *  semana. Compacto de propósito: a Galileia mostra 10 tabelas porque é 1 criador
 *  por PDF; aqui são 8 criadores no mesmo deck, e o host tem ~1 minuto por pessoa. */
function habitoLinhas(p: ParticipanteSemana, max = 3): string[] {
  const pad = p.padroes;
  if (!pad || pad.dimensoes.length === 0) return [];
  // Uma linha por dimensão (a mais forte dela), depois as mais expressivas no geral.
  const candidatas = pad.dimensoes
    .map((d) => ({ dim: d.titulo, linha: d.linhas[0] }))
    .filter((x): x is { dim: string; linha: NonNullable<typeof x.linha> } => !!x.linha)
    .sort(
      (a, b) =>
        forceMagnitude(b.linha.indexShares, b.linha.nPosts) -
        forceMagnitude(a.linha.indexShares, a.linha.nPosts),
    )
    .slice(0, max);
  return candidatas.map(
    ({ dim, linha }) =>
      `     ▣ ${dim}: "${linha.label}" — compart. ${fmtIdx(linha.indexShares)} / salvos ${fmtIdx(
        linha.indexSaved,
      )} da mediana dela · ${linha.nPosts} post(s) · ${EVIDENCE_LABEL[linha.evidence]}`,
  );
}

function digest(ctx: MeetingContext): string {
  const l: string[] = [
    `▸ Reunião ${ctx.periodo.de} → ${ctx.periodo.ate} · ${ctx.participantes.length} participante(s)`,
    ``,
  ];
  for (const p of ctx.participantes) {
    if (!p.encontrado) {
      l.push(`✗ ${p.consulta} — NÃO encontrado na base (relate; não invente)`, ``);
      continue;
    }
    l.push(
      `── ${p.nome} (${p.handle ?? "?"})`,
      `   narrativa: ${p.narrativaCentral || "—"}`,
      p.territorios.length ? `   territórios: ${p.territorios.join(" · ")}` : "   territórios: —",
      p.temas.length ? `   temas: ${p.temas.join(" · ")}` : "",
      p.assets.length ? `   assets: ${p.assets.join(" · ")}` : "",
      p.tom ? `   tom: ${p.tom}` : "",
      // A régua: sem isto o host só compara post contra post da mesma semana.
      p.baseline
        ? p.baseline.sufficient
          ? `   ⚖ mediana dela (${p.baseline.nPosts} posts/90d): compart.=${p.baseline.medianShares ?? "—"} salvos=${p.baseline.medianSaved ?? "—"} views=${p.baseline.medianViews ?? "—"} → USE os índices abaixo, não o número cru`
          : `   ⚖ baseline insuficiente (${p.baseline.nPosts} posts/90d, mínimo 4) — sem histórico p/ comparar; compare dentro da semana ou omita o stat`
        : "",
      p.anterior
        ? `   ↺ comparativo LIGADO (snapshot ${p.anterior.data}; prometeu: ${p.anterior.planoPrometido.join("; ") || "—"})`
        : `   ↺ sem semana anterior (sem comparativo)`,
      `   ${p.posts.length} post(s) na semana (top por engajamento; resto resumido):`,
    );
    // Token-frugal, mas sem ponto cego. Cortar só pelos TOP por interação escondia
    // justamente os piores posts — que é onde mora o "ponto a ajustar". Então o
    // digest mostra as DUAS pontas: os melhores por engajamento E os que mais
    // ficaram abaixo da mediana do criador. O resto vira uma linha de resumo.
    const TOP = 8;
    const PIORES = 3;
    const linhaPost = (post: PostSemana): void => {
      const s = post.stats;
      const classif = [
        post.proposal.length ? post.proposal.join(",") : "",
        post.context.length ? post.context.join(",") : "",
        post.tone.length ? post.tone.join(",") : "",
      ].filter(Boolean).join("/");
      l.push(
        `     • ${post.postDate} sv=${s.saved ?? "?"} sh=${s.shares ?? "?"} cm=${s.comments ?? "?"} int=${s.total_interactions ?? "?"} | ` +
          `${classif || "sem-classif"} | id=${post.postId ?? "—"} | ${post.description.replace(/\s+/g, " ").slice(0, 70)}`,
      );
      // Índices vs. a mediana DELA — é daqui que sai o `stat` do deck.json.
      const i = post.indices;
      if (i && (i.shares != null || i.saved != null || i.views != null)) {
        l.push(
          `       ↳ vs. mediana dela → compart. ${fmtIdx(i.shares)} · salvos ${fmtIdx(i.saved)} · views ${fmtIdx(i.views)}`,
        );
      }
    };

    const ord = [...p.posts].sort(
      (a, b) => (b.stats.total_interactions ?? 0) - (a.stats.total_interactions ?? 0),
    );
    const top = ord.slice(0, TOP);
    for (const post of top) linhaPost(post);

    // A outra ponta: entre os que não entraram acima, os que mais afundaram contra
    // a mediana do criador (índice mais baixo; empate desempatado por interação).
    const foraDoTop = ord.slice(TOP);
    const desempenho = (x: PostSemana): number =>
      Math.max(x.indices?.shares ?? 0, x.indices?.saved ?? 0);
    const piores = [...foraDoTop]
      .sort((a, b) => desempenho(a) - desempenho(b) || (a.stats.total_interactions ?? 0) - (b.stats.total_interactions ?? 0))
      .slice(0, PIORES);
    if (piores.length) {
      l.push(`     ▽ os que mais ficaram abaixo da mediana dela (candidatos a ponto a ajustar):`);
      for (const post of piores) linhaPost(post);
    }

    const resto = foraDoTop.filter((x) => !piores.includes(x));
    if (resto.length) {
      const savesResto = resto.map((r) => r.stats.saved ?? 0).sort((a, b) => a - b);
      const mediana = savesResto[Math.floor(savesResto.length / 2)] ?? 0;
      const zerados = resto.filter((r) => (r.stats.total_interactions ?? 0) === 0).length;
      const classifs = resto.flatMap((r) => r.context).filter(Boolean);
      const dominante = classifs.sort(
        (a, b) => classifs.filter((x) => x === b).length - classifs.filter((x) => x === a).length,
      )[0];
      l.push(
        `     … +${resto.length} posts (mediana saves=${mediana}, ${zerados} zerados${dominante ? `, ctx dominante=${dominante}` : ""})`,
      );
    }
    if (p.posts.length === 0) l.push("     (nenhum post publicado no período — slide nasce do mapa)");
    // O hábito de 90 dias: o que funciona SEMPRE pra ela, não só nesta semana.
    const hab = habitoLinhas(p);
    if (hab.length) {
      l.push(
        `   ▣ hábito dos 90 dias (${p.padroes?.nPosts ?? 0} posts${
          p.padroes?.nComCena ? `, ${p.padroes.nComCena} com leitura de cena` : ", sem leitura de cena"
        }) — o que é padrão, não sorte da semana:`,
        ...hab,
      );
    }
    l.push(``);
  }
  return l.join("\n");
}

async function main() {
  const itens = await lerParticipantes();
  if (itens.length === 0) {
    console.error("✗ nenhum participante. Use --handles=@a,@b  ou  --names=\"Nome;Nome\"  ou  --file=lista.txt");
    process.exit(2);
  }

  const ateStr = arg("ate") ?? ymd(new Date());
  const ate = new Date(`${ateStr}T23:59:59.999Z`);
  const de = new Date(ate.getTime() - 6 * 24 * 60 * 60 * 1000);
  de.setUTCHours(0, 0, 0, 0);

  await connectToDatabase();

  const participantes: ParticipanteSemana[] = [];
  for (const it of itens) {
    participantes.push(await gatherParticipante(it.raw, it.isHandle, de, ate));
  }

  const ctx: MeetingContext = {
    data: ateStr,
    periodo: { de: ymd(de), ate: ateStr },
    participantes,
  };

  const payload = JSON.stringify(ctx, null, 2);
  const outArg = arg("out");
  if (outArg) {
    const ctxPath = /\.json$/i.test(outArg)
      ? path.resolve(outArg)
      : path.join(path.resolve(outArg), "context.json");
    await fs.mkdir(path.dirname(ctxPath), { recursive: true });
    await fs.writeFile(ctxPath, payload);
    const achados = participantes.filter((p) => p.encontrado).length;
    console.error(`✓ context salvo em ${ctxPath}  (${achados}/${participantes.length} encontrados)`);
    process.stdout.write(digest(ctx) + "\n");
  } else {
    process.stdout.write(payload);
  }

  await (await connectToDatabase()).connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
