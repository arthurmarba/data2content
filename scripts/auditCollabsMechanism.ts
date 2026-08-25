/**
 * auditCollabsMechanism.ts — o mecanismo da aba Collabs tem dado por trás?
 *
 * SOMENTE LEITURA. Nenhuma escrita, nenhuma mutação.
 *
 * A aba é uma cadeia de quatro elos, e ela só entrega valor se os quatro
 * existirem. Qualquer um faltando degrada em silêncio — a tela não quebra, ela
 * só fica com menos:
 *
 *   1. PAUTAS geradas por criador     → sem elas, deck vazio
 *   2. INTERESSES registrados          → é o swipe virando dado
 *   3. MATCHES recíprocos              → o prêmio da aba; sem isso é só um
 *                                        gerador de ideias com gesto bonito
 *   4. CACHE de collab por pauta       → é o que faz o card de parceria APARECER
 *                                        no deck; sem ele todo card é solo
 *
 * Números agregados apenas — nenhum nome, e-mail ou id de criador é impresso.
 *
 * @run `npm run audit:collabs`
 */

import mongoose from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
import { significantWords } from "@/app/dashboard/boards/videoUpload/collabComplementarity";

/** TTL do cache de collab por pauta — espelha PerPautaCollabCache. */
const PER_PAUTA_COLLAB_CACHE_TTL_HOURS = 12;

function pct(part: number, total: number) {
  if (total === 0) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

function bar(part: number, total: number, width = 26) {
  if (total === 0) return "";
  const filled = Math.max(0, Math.min(width, Math.round((part / total) * width)));
  return `${"█".repeat(filled)}${"·".repeat(width - filled)}`;
}

function daysAgo(date: Date | null | undefined) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

async function main() {
  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error("sem conexão");

  // Os modelos declaram estas coleções; ler por nome evita registrar schema.
  const ideas = db.collection("creatorcontentideas");
  const matches = db.collection("collabmatches");
  const interests = db.collection("collabinterests");
  const caches = db.collection("perpautacollabcaches");

  // ── 1. Pautas ─────────────────────────────────────────────────────────────
  const ideasByCreator = await ideas
    .aggregate<{ _id: unknown; total: number }>([{ $group: { _id: "$userId", total: { $sum: 1 } } }])
    .toArray();
  const totalIdeas = ideasByCreator.reduce((sum, entry) => sum + entry.total, 0);
  const [newestIdea] = await ideas
    .find({}, { projection: { createdAt: 1 } })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();

  console.log("\n═══ 1. PAUTAS (o deck) ═══\n");
  console.log(`Criadores com pauta gerada ............... ${ideasByCreator.length}`);
  console.log(`Pautas no total .......................... ${totalIdeas}`);
  console.log(
    `Pauta mais recente ....................... ${
      newestIdea ? `há ${daysAgo((newestIdea as unknown as { createdAt: Date }).createdAt)} dias` : "NENHUMA"
    }`,
  );

  // ── 2. Interesses (o swipe virando dado) ──────────────────────────────────
  const interestTotals = await interests
    .aggregate<{ _id: string; total: number }>([{ $group: { _id: "$decision", total: { $sum: 1 } } }])
    .toArray();
  const decidedBy = await interests.distinct("user");
  const [newestInterest] = await interests
    .find({}, { projection: { createdAt: 1 } })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();

  console.log("\n═══ 2. DECISÕES DE COLLAB (o swipe) ═══\n");
  console.log(`Criadores que já decidiram alguma ........ ${decidedBy.length}`);
  for (const entry of interestTotals.sort((a, b) => b.total - a.total)) {
    console.log(`  ${String(entry._id).padEnd(22)} ${entry.total}`);
  }
  console.log(
    `Decisão mais recente ..................... ${
      newestInterest ? `há ${daysAgo((newestInterest as unknown as { createdAt: Date }).createdAt)} dias` : "NENHUMA"
    }`,
  );

  // ── 3. Matches (o prêmio) ─────────────────────────────────────────────────
  const matchCount = await matches.countDocuments({});
  const [newestMatch] = await matches
    .find({}, { projection: { createdAt: 1 } })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();
  const interested = interestTotals.find((entry) => String(entry._id) === "interested")?.total ?? 0;

  console.log("\n═══ 3. MATCHES (os dois toparam) ═══\n");
  console.log(`Matches recíprocos ....................... ${matchCount}`);
  console.log(
    `Match mais recente ....................... ${
      newestMatch ? `há ${daysAgo((newestMatch as unknown as { createdAt: Date }).createdAt)} dias` : "NENHUM"
    }`,
  );
  if (interested > 0) {
    // Cada match consome DOIS interesses — é assim que a taxa se lê.
    console.log(
      `Taxa de reciprocidade .................... ${pct(matchCount * 2, interested)}  ${bar(matchCount * 2, interested)}`,
    );
    console.log(`  (${matchCount * 2} de ${interested} "quero fazer" viraram match)`);
  }

  // ── 4. Cache por pauta (o que põe a collab NO deck) ───────────────────────
  // O cache guarda um Record<pautaId, match> por criador. Uma entrada com o
  // Record VAZIO quer dizer "rodei o matching e não achei ninguém" — que é
  // exatamente o caso em que o deck vira 100% solo.
  const cacheEntries = (await caches
    .find({}, { projection: { matches: 1, updatedAt: 1 } })
    .toArray()) as unknown as Array<{ matches?: Record<string, unknown>; updatedAt: Date }>;
  const withAnyMatch = cacheEntries.filter(
    (entry) => Object.keys(entry.matches ?? {}).length > 0,
  );
  const pautasWithCollab = cacheEntries.reduce(
    (sum, entry) => sum + Object.keys(entry.matches ?? {}).length,
    0,
  );
  const newestCache = cacheEntries
    .map((entry) => entry.updatedAt)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  console.log("\n═══ 4. CACHE DE COLLAB POR PAUTA (põe a parceria no deck) ═══\n");
  console.log(`Criadores com cache calculado ............ ${cacheEntries.length}`);
  console.log(
    `  ├─ com ao menos UMA parceria no deck ... ${withAnyMatch.length}  (${pct(withAnyMatch.length, cacheEntries.length)})  ${bar(withAnyMatch.length, cacheEntries.length)}`,
  );
  console.log(`  └─ deck 100% solo (ninguém compatível) .. ${cacheEntries.length - withAnyMatch.length}`);
  console.log(`Pautas com criador compatível ............ ${pautasWithCollab}`);
  console.log(
    `Cache mais recente ....................... ${
      newestCache ? `há ${daysAgo(newestCache)} dias` : "NENHUM"
    }  (TTL ${PER_PAUTA_COLLAB_CACHE_TTL_HOURS}h)`,
  );

  // ── 5. Por que o deck é solo? ─────────────────────────────────────────────
  //
  // O pool de candidatos (narrativeCollabMatchingService) descarta quem não
  // passa por QUATRO filtros em sequência. Cada um derruba gente em silêncio, e
  // basta o funil zerar para todo card virar solo. Medir os quatro diz qual
  // deles é o gargalo — sem isso a resposta seria chute.
  const seeds = db.collection("mapasseed");
  const users = db.collection("users");

  const comMapa = await seeds.countDocuments({});
  const comNarrativa = await seeds.countDocuments({
    "mapa.narrativa_central": { $exists: true, $ne: "" },
  });
  const comTerritorio = await seeds.countDocuments({
    "mapa.narrativa_central": { $exists: true, $ne: "" },
    "mapa.territorios.0": { $exists: true },
  });

  // O último filtro é o avatar: sem foto, o candidato não entra no pool.
  const elegiveis = await seeds
    .aggregate<{ total: number }>([
      {
        $match: {
          "mapa.narrativa_central": { $exists: true, $ne: "" },
          "mapa.territorios.0": { $exists: true },
        },
      },
      { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "u" } },
      { $unwind: "$u" },
      {
        $match: {
          $or: [
            { "u.profile_picture_url": { $exists: true, $nin: [null, ""] } },
            { "u.image": { $exists: true, $nin: [null, ""] } },
            { "u.providerImage": { $exists: true, $nin: [null, ""] } },
          ],
        },
      },
      { $count: "total" },
    ])
    .toArray();
  const comAvatar = elegiveis[0]?.total ?? 0;

  console.log("\n═══ 5. O FUNIL DO POOL DE CANDIDATOS ═══\n");
  console.log(`Mapas gravados ........................... ${comMapa}`);
  console.log(`  ├─ com narrativa central preenchida .... ${comNarrativa}  (${pct(comNarrativa, comMapa)})  ${bar(comNarrativa, comMapa)}`);
  console.log(`  ├─ E com ao menos 1 território ......... ${comTerritorio}  (${pct(comTerritorio, comMapa)})  ${bar(comTerritorio, comMapa)}`);
  console.log(`  └─ E com avatar (entra no pool) ........ ${comAvatar}  (${pct(comAvatar, comMapa)})  ${bar(comAvatar, comMapa)}`);
  console.log(`\nUsuários no total ........................ ${await users.countDocuments({})}`);

  // ── 6. Existe sobreposição de território? ─────────────────────────────────
  //
  // Passado o pool, o match por-pauta exige que o TERRITÓRIO da pauta e um
  // território do candidato compartilhem ao menos uma palavra significativa
  // (`territoryRelevance` > 0). Se essa sobreposição não existe na base, nenhum
  // ajuste de prompt ou de peso resolve — o problema é vocabulário, não código.
  const pautaTerritories = (await ideas.distinct("territory")) as unknown[];
  const candidateTerritoryDocs = (await seeds
    .find(
      { "mapa.territorios.0": { $exists: true } },
      { projection: { "mapa.territorios": 1 } },
    )
    .toArray()) as Array<{ mapa?: { territorios?: string[] } }>;

  const candidateWordSets = candidateTerritoryDocs.map(
    (doc) => new Set((doc.mapa?.territorios ?? []).flatMap(significantWords)),
  );

  const pautaTerms = pautaTerritories
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const matchable = pautaTerms.filter((territory) => {
    const words = significantWords(territory);
    if (words.length === 0) return false;
    return candidateWordSets.some((set) => words.some((word) => set.has(word)));
  });

  console.log("\n═══ 6. SOBREPOSIÇÃO DE TERRITÓRIO (a regra do match) ═══\n");
  console.log(`Territórios distintos nas pautas ......... ${pautaTerms.length}`);
  console.log(
    `  └─ com candidato de palavra em comum ... ${matchable.length}  (${pct(matchable.length, pautaTerms.length)})  ${bar(matchable.length, pautaTerms.length)}`,
  );
  const orphans = pautaTerms.filter((t) => !matchable.includes(t)).slice(0, 8);
  if (orphans.length > 0) {
    console.log(`\n  Exemplos de território de pauta SEM par no vocabulário dos mapas:`);
    for (const territory of orphans) console.log(`    “${territory}”`);
  }

  // ── 7. O portão do opportunityKind ────────────────────────────────────────
  //
  // `matchCollabsForPautas` só considera pautas com território E com
  // `opportunityKind !== "individual"`. Uma pauta marcada como individual NUNCA
  // recebe parceiro, por mais compatível que alguém seja — ela nem entra na
  // conta. Se a geração marca quase tudo como individual, o deck é solo por
  // construção, e nenhum ajuste no matching muda isso.
  const kindTotals = await ideas
    .aggregate<{ _id: string | null; total: number }>([
      { $group: { _id: "$opportunityKind", total: { $sum: 1 } } },
    ])
    .toArray();
  const semTerritorio = await ideas.countDocuments({
    $or: [{ territory: { $exists: false } }, { territory: "" }, { territory: null }],
  });

  console.log("\n═══ 7. O PORTÃO DO opportunityKind ═══\n");
  for (const entry of kindTotals.sort((a, b) => b.total - a.total)) {
    const label = entry._id === null ? "(sem campo — legado)" : String(entry._id);
    const passa = entry._id !== "individual";
    console.log(
      `  ${label.padEnd(24)} ${String(entry.total).padStart(5)}  ${passa ? "entra no matching" : "NUNCA recebe parceiro"}`,
    );
  }
  const blocked = kindTotals.find((entry) => entry._id === "individual")?.total ?? 0;
  console.log(`\nPautas sem território .................... ${semTerritorio}  (também fora)`);
  console.log(
    `Pautas elegíveis a parceria .............. ${totalIdeas - blocked - semTerritorio} de ${totalIdeas}  ${bar(totalIdeas - blocked - semTerritorio, totalIdeas)}`,
  );

  console.log("");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Falhou:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
