// scripts/reuniao/resolveDeck.ts
//
// Hidrata o deck.json a partir do context.json — para o Galisteu NÃO precisar
// colar URLs assinadas (gigantes, que expiram) nem transcrever séries/fatos à mão.
// É o equivalente do resolveAssets.ts do Galeano: o agente escreve um deck ENXUTO
// (só a parte editorial + postIds) e este passo preenche o resto.
//
// Por criador (casado por `handle`), preenche quando AUSENTE (idempotente):
//   - userId, profilePictureUrl, nome, narrativaCentral, territorios  (fatos do mapa)
//   - pontoForte/pontoAjustar.thumbnailUrl  (pelo postId → thumb fresca do context)
//   - reel.posterUrl                         (pelo reel.postId)
//   - grafico                                (saves/shares agregados por dia)
//
// Uso:
//   npx tsx scripts/reuniao/resolveDeck.ts --deck=output/reunioes/<data>/deck.json
//   (lê o context.json da MESMA pasta; ou passe --context=<arquivo>)

import { promises as fs } from "node:fs";
import path from "node:path";
import type { DeckData } from "./lib/types";
import type { MeetingContext, ParticipanteSemana, PostSemana } from "./lib/types";

if (!process.env.LOG_LEVEL) process.env.LOG_LEVEL = "error";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}

const norm = (h: string | null | undefined): string => (h ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/^@/, "")
  .toLowerCase()
  .replace(/^(dra?\.?|assessoria)\s+/, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

function postById(p: ParticipanteSemana, id: string | null | undefined): PostSemana | null {
  if (!id) return null;
  return p.posts.find((q) => String(q.postId) === String(id)) ?? null;
}

/** Gráfico: saves/shares somados por dia (o ritmo de demanda da semana). */
function graficoPorDia(p: ParticipanteSemana): { posts: { rotulo: string; saves: number; shares: number }[] } {
  const byDay = new Map<string, { saves: number; shares: number }>();
  for (const x of p.posts) {
    if (!x.postDate) continue;
    const cur = byDay.get(x.postDate) ?? { saves: 0, shares: 0 };
    cur.saves += x.stats.saved ?? 0;
    cur.shares += x.stats.shares ?? 0;
    byDay.set(x.postDate, cur);
  }
  const posts = [...byDay.keys()]
    .sort()
    .map((d) => ({ rotulo: `${d.slice(8, 10)}/${d.slice(5, 7)}`, saves: byDay.get(d)!.saves, shares: byDay.get(d)!.shares }));
  return { posts };
}

async function main() {
  const deckPath = arg("deck");
  if (!deckPath) {
    console.error("Informe --deck=output/reunioes/<data>/deck.json");
    process.exit(1);
  }
  const deckAbs = path.resolve(deckPath);
  const dir = path.dirname(deckAbs);
  const ctxPath = path.resolve(arg("context") ?? path.join(dir, "context.json"));

  const deck: DeckData = JSON.parse(await fs.readFile(deckAbs, "utf-8"));
  const ctx: MeetingContext = JSON.parse(await fs.readFile(ctxPath, "utf-8"));
  const byHandle = new Map<string, ParticipanteSemana>();
  const byNome = new Map<string, ParticipanteSemana>();
  const participantesNormalizados: { keys: string[]; participante: ParticipanteSemana }[] = [];
  for (const p of ctx.participantes) {
    if (p.handle) byHandle.set(norm(p.handle), p);
    if (p.nome) byNome.set(norm(p.nome), p);
    participantesNormalizados.push({
      keys: [p.handle, p.nome, p.consulta].map(norm).filter(Boolean),
      participante: p,
    });
  }

  let hidratados = 0;
  const semContexto: string[] = [];
  for (const c of deck.criadores) {
    // Criadores sem Instagram conectado não têm handle — casam por nome (resolvido via --names).
    const creatorKeys = [c.handle, c.nome].map(norm).filter(Boolean);
    const fuzzy = participantesNormalizados.find(({ keys }) =>
      creatorKeys.some((creatorKey) => keys.some((key) => key === creatorKey || key.startsWith(`${creatorKey} `) || creatorKey.startsWith(`${key} `))),
    )?.participante;
    const p = byHandle.get(norm(c.handle)) ?? byNome.get(norm(c.handle)) ?? byNome.get(norm(c.nome)) ?? fuzzy;
    if (!p || !p.encontrado) {
      semContexto.push(c.handle ?? c.nome);
      continue;
    }
    hidratados++;
    // Fatos do mapa (só se ausentes — respeita o que o agente escreveu).
    if (!c.userId) c.userId = p.userId;
    if (!c.profilePictureUrl) c.profilePictureUrl = p.profilePictureUrl;
    if (!c.nome) c.nome = p.nome;
    if (!c.narrativaCentral) c.narrativaCentral = p.narrativaCentral;
    if (!c.territorios || c.territorios.length === 0) c.territorios = p.territorios;
    // Thumbs dos pontos (pelo postId) — nunca colar URL à mão.
    if (c.pontoForte && !c.pontoForte.thumbnailUrl) {
      c.pontoForte.thumbnailUrl = postById(p, c.pontoForte.postId)?.thumbnailUrl ?? null;
    }
    if (c.pontoAjustar && !c.pontoAjustar.thumbnailUrl) {
      c.pontoAjustar.thumbnailUrl = postById(p, c.pontoAjustar.postId)?.thumbnailUrl ?? null;
    }
    // Poster do reel.
    if (c.reel?.postId && !c.reel.posterUrl) {
      c.reel.posterUrl = postById(p, c.reel.postId)?.thumbnailUrl ?? null;
    }
    // Gráfico da semana (computado, salvo se o agente já tiver mandado um).
    if (!c.grafico) c.grafico = graficoPorDia(p);
  }

  await fs.writeFile(deckAbs, JSON.stringify(deck, null, 2));
  console.error(`✓ deck hidratado: ${hidratados}/${deck.criadores.length} criadores`);
  if (semContexto.length) console.error(`  ⚠ sem contexto (não hidratados): ${semContexto.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
