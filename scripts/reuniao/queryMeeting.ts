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
  enrichThumbs,
  profilePicFor,
  previousSnapshot,
} from "../relatorio/lib/creatorWeek";
import type { MeetingContext, ParticipanteSemana } from "./lib/types";

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
  const [posts, profilePictureUrl] = await Promise.all([
    postsInWeek(userId, de, ate),
    profilePicFor(userId),
  ]);
  await enrichThumbs(userId, posts); // thumbs frescas (a URL salva expira → 403)

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
    anterior,
  };
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
      p.anterior
        ? `   ↺ comparativo LIGADO (snapshot ${p.anterior.data}; prometeu: ${p.anterior.planoPrometido.join("; ") || "—"})`
        : `   ↺ sem semana anterior (sem comparativo)`,
      `   ${p.posts.length} post(s) na semana (top por engajamento; resto resumido):`,
    );
    // Token-frugal: mostra só os TOP posts por interação (os candidatos a forte/fraco)
    // + uma linha de resumo do resto (captura o padrão de diluição sem listar tudo).
    const TOP = 8;
    const ord = [...p.posts].sort(
      (a, b) => (b.stats.total_interactions ?? 0) - (a.stats.total_interactions ?? 0),
    );
    const top = ord.slice(0, TOP);
    for (const post of top) {
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
    }
    const resto = ord.slice(TOP);
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
