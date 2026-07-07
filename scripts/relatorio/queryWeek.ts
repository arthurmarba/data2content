// scripts/relatorio/queryWeek.ts
//
// Monta o CONTEXTO de uma semana para o agente de relatório escrever a matéria.
// Somente leitura. Reaproveita os modelos do app (MapaSeed, User, Metric,
// AccountInsight) — a mesma fonte do Galeano.
//
// O agente NÃO relê o PDF anterior: este script já entrega o snapshot da semana
// passada (de output/relatorios/<slug>/snapshots.json) dentro do contexto.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/relatorio/queryWeek.ts --handle=@criador --out=output/relatorios/<slug>/<ate>
//   npx tsx --env-file=.env.local scripts/relatorio/queryWeek.ts --userId=<id> --ate=2026-06-22
//
// --ate = último dia do período (default: hoje). A semana é os 7 dias até --ate.
// --out = DIRETÓRIO da semana → grava context.json lá; imprime digest no stdout.

import { promises as fs } from "node:fs";
import path from "node:path";
import { connectToDatabase } from "@/app/lib/mongoose";
import MapaSeed from "@/app/models/MapaSeed";
import User from "@/app/models/User";
import type { ContextoSemana } from "./lib/types";
import {
  ymd,
  slugify,
  resolveUserId,
  postsInWeek,
  enrichThumbs,
  profilePicFor,
  previousSnapshot,
} from "./lib/creatorWeek";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}

function digest(ctx: ContextoSemana): string {
  const c = ctx.criador;
  const l: string[] = [
    `▸ ${c.nome} (${c.handle ?? "?"}) · ${ctx.periodo.de} → ${ctx.periodo.ate}`,
    `narrativa: ${c.narrativaCentral}`,
    c.territorios.length ? `territórios: ${c.territorios.join(" · ")}` : "",
    c.tom ? `tom: ${c.tom}` : "",
    ctx.anterior ? `↺ comparativo LIGADO (snapshot ${ctx.anterior.data})` : "↺ primeira semana — sem comparativo",
    ``,
    `${ctx.posts.length} post(s) na semana:`,
  ].filter(Boolean);
  for (const p of ctx.posts) {
    const s = p.stats;
    l.push(
      `  • ${p.postDate} | ${p.type}${p.format.length ? "/" + p.format.join(",") : ""} | ` +
        `saves=${s.saved ?? "?"} shares=${s.shares ?? "?"} coment=${s.comments ?? "?"} int=${s.total_interactions ?? "?"} | ` +
        `postId=${p.postId ?? "—"} | ${p.description.replace(/\s+/g, " ").slice(0, 80)}`,
    );
  }
  if (ctx.posts.length === 0) l.push("  (nenhum post publicado no período)");
  return l.join("\n");
}

async function main() {
  const userIdArg = arg("userId");
  const handle = arg("handle");
  const name = arg("name");
  const ateStr = arg("ate") ?? ymd(new Date());
  const ate = new Date(`${ateStr}T23:59:59.999Z`);
  const de = new Date(ate.getTime() - 6 * 24 * 60 * 60 * 1000);
  de.setUTCHours(0, 0, 0, 0);

  await connectToDatabase();

  const userId = userIdArg ?? (await resolveUserId(handle, name));
  if (!userId) {
    console.error(`✗ criador não encontrado (${handle ?? name ?? "sem identificador"})`);
    await (await connectToDatabase()).connection.close();
    process.exit(2);
  }

  const [mapaDoc, user]: [any, any] = await Promise.all([
    MapaSeed.findOne({ userId }).lean(),
    User.findById(userId).select("name username").lean(),
  ]);
  if (!user) {
    console.error(`✗ usuário ${userId} não existe`);
    await (await connectToDatabase()).connection.close();
    process.exit(2);
  }
  const mapa = mapaDoc?.mapa ?? {};

  const [posts, profilePictureUrl] = await Promise.all([
    postsInWeek(userId, de, ate),
    profilePicFor(userId),
  ]);

  // Rebusca thumbnails frescas (a URL salva no Metric expira → 403 no download).
  await enrichThumbs(userId, posts);

  const nome = user.name ?? "Criador";
  const slug = slugify(user.username?.replace(/^@/, "") || nome);

  // Resolve onde está o snapshots.json para ligar o comparativo.
  const outArg = arg("out");
  const baseDir = outArg
    ? path.resolve(path.dirname(/\.json$/i.test(outArg) ? outArg : path.join(outArg, "x")))
    : path.resolve("output", "relatorios", slug);
  const snapshotsPath = path.join(path.resolve("output", "relatorios", slug), "snapshots.json");
  const anterior = await previousSnapshot(snapshotsPath, ateStr);

  const ctx: ContextoSemana = {
    periodo: { de: ymd(de), ate: ateStr },
    criador: {
      userId: String(userId),
      nome,
      handle: user.username ? `@${user.username.replace(/^@/, "")}` : null,
      profilePictureUrl,
      narrativaCentral: mapa.narrativa_central ?? "",
      territorios: mapa.territorios ?? [],
      temas: mapa.temas ?? [],
      assets: mapa.assets ?? [],
      tom: mapa.tom ?? "",
    },
    posts,
    anterior,
  };

  const payload = JSON.stringify(ctx, null, 2);
  if (outArg) {
    const ctxPath = /\.json$/i.test(outArg) ? path.resolve(outArg) : path.join(path.resolve(outArg), "context.json");
    await fs.mkdir(path.dirname(ctxPath), { recursive: true });
    await fs.writeFile(ctxPath, payload);
    console.error(`✓ context salvo em ${ctxPath}  (slug=${slug}, baseDir=${baseDir})`);
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
