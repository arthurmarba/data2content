/**
 * Smoke somente leitura da análise administrativa de todos os criadores.
 *
 * Roda as três consultas que o MCP admin usa para varrer a base — diretório
 * paginado, consolidação do período e dossiê individual — contra o banco real,
 * medindo o tempo de cada uma e conferindo que nada de privado escapa.
 *
 * Não escreve nada: só find/count/aggregate.
 *
 *   npm run smoke:mcp-admin-portfolio
 */
import mongoose from "mongoose";
import { connectToDatabase } from "../src/app/lib/mongoose";
import {
  analyzeMcpAdminPortfolio,
  listMcpAdminCreators,
  type AdminPortfolioInput,
} from "../src/app/lib/mcp/adminAnalytics";
import { getMcpAdminCreatorAnalysis } from "../src/app/lib/mcp/adminCreatorAnalysis";
import { getMcpFollowerGrowth } from "../src/app/lib/mcp/followerGrowth";

const TIME_ZONE = "America/Sao_Paulo";
/** Campos que jamais podem sair numa resposta administrativa. */
const FORBIDDEN = [
  "instagramAccessToken",
  "accessToken",
  "refreshToken",
  "password",
  "stripeCustomerId",
  "whatsappVerificationCode",
  "fullText",
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertNoLeak(label: string, payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const field of FORBIDDEN) {
    assert(!serialized.includes(field), `${label} vazou o campo proibido "${field}".`);
  }
}

async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  const result = await run();
  process.stdout.write(`  ${label}: ${Date.now() - startedAt}ms\n`);
  return result;
}

function calendarDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
}

async function main() {
  assert(process.env.MONGODB_URI, "MONGODB_URI não configurado para o smoke da análise administrativa.");
  await connectToDatabase();

  const endDate = calendarDate(new Date());
  const startDate = calendarDate(new Date(Date.now() - 29 * 86_400_000));
  const period = { startDate, endDate, timeZone: TIME_ZONE };
  process.stdout.write(`Período analisado: ${startDate} → ${endDate} (${TIME_ZONE})\n\n`);

  process.stdout.write("1) Diretório paginado da base\n");
  const firstPage = await timed("primeira página", () => listMcpAdminCreators({ limit: 25 }));
  assertNoLeak("list_creators", firstPage);
  assert(firstPage.pagination.total >= firstPage.creators.length, "Total do diretório menor que a página devolvida.");
  assert(
    firstPage.creators.every((creator) => /^creator:[a-f0-9]{24}$/.test(creator.id)),
    "Diretório devolveu id fora do formato creator:<id>.",
  );

  // Percorre até o fim (limitado) para provar que o cursor cobre a base inteira sem repetir.
  const seen = new Set(firstPage.creators.map((creator) => creator.id));
  let cursor = firstPage.pagination.nextCursor;
  let pages = 1;
  while (cursor && pages < 200) {
    const next: Awaited<ReturnType<typeof listMcpAdminCreators>> =
      await listMcpAdminCreators({ limit: 100, cursor });
    for (const creator of next.creators) {
      assert(!seen.has(creator.id), `Cursor repetiu o criador ${creator.id}.`);
      seen.add(creator.id);
    }
    cursor = next.pagination.nextCursor;
    pages += 1;
  }
  assert(!cursor, "O cursor não terminou dentro do limite de páginas do smoke.");
  assert(
    seen.size === firstPage.pagination.total,
    `A varredura viu ${seen.size} criadores, mas o total declarado é ${firstPage.pagination.total}.`,
  );
  process.stdout.write(`  ${seen.size} criadores em ${pages} páginas, sem repetição\n\n`);

  await expectRejectedCursor(firstPage.pagination.nextCursor);

  process.stdout.write("2) Consolidação do período (toda a população)\n");
  const portfolio = await timed("analyze_creator_portfolio", () =>
    analyzeMcpAdminPortfolio({ ...period, limit: 25 } satisfies AdminPortfolioInput),
  );
  assertNoLeak("analyze_creator_portfolio", portfolio);
  assert(
    portfolio.summary.totalCreators === seen.size,
    `A consolidação cobriu ${portfolio.summary.totalCreators} criadores e o diretório, ${seen.size}.`,
  );
  assert(
    portfolio.summary.creatorsWithPosts <= portfolio.summary.totalCreators,
    "Criadores com post não podem exceder o total da população.",
  );
  assert(
    portfolio.summary.observedTranscripts <= portfolio.summary.videos,
    "Falas observadas não podem exceder a quantidade de vídeos.",
  );
  assert(
    portfolio.summary.photosAndCarouselsVisuallyRead <= portfolio.summary.photosAndCarousels,
    "Fotos lidas não podem exceder a quantidade de fotos e carrosséis.",
  );
  assert(
    portfolio.summary.videos + portfolio.summary.photosAndCarousels <= portfolio.summary.current.posts,
    "Vídeos e fotos somados excedem os posts do período.",
  );
  assert(
    portfolio.creators.length <= 25 && portfolio.pagination.total === portfolio.summary.totalCreators,
    "A paginação de linhas não bate com o total consolidado.",
  );
  const engagement = portfolio.summary.current.engagement;
  assert(
    engagement.value === null || (engagement.value >= 0 && engagement.eligiblePosts > 0),
    "Engajamento agregado sem posts elegíveis.",
  );
  process.stdout.write(
    `  ${portfolio.summary.totalCreators} criadores | ${portfolio.summary.creatorsWithPosts} com post | ` +
      `${portfolio.summary.disconnectedCreators} desconectados\n` +
      `  ${portfolio.summary.current.posts} posts no período (${portfolio.summary.previous.posts} na janela anterior) | ` +
      `${portfolio.summary.observedTranscripts}/${portfolio.summary.videos} vídeos com fala lida | ` +
      `${portfolio.summary.photosAndCarouselsVisuallyRead}/${portfolio.summary.photosAndCarousels} fotos e carrosséis lidos\n` +
      `  engajamento agregado: ${engagement.value === null ? "indisponível" : (engagement.value * 100).toFixed(2) + "%"} ` +
      `(${engagement.eligiblePosts} posts elegíveis)\n\n`,
  );

  const followers = portfolio.summary.followerGrowth;
  assert(
    followers.creatorsMeasured <= portfolio.summary.totalCreators,
    "Mais criadores com saldo medido do que criadores na população.",
  );
  assert(
    followers.creatorsGaining + followers.creatorsLosing <= followers.creatorsMeasured,
    "Criadores ganhando e perdendo não cabem dentro dos medidos.",
  );
  assert(
    portfolio.creators.every((row: { followerGrowth: { netGain: number | null; followersAtStart: number | null; followersAtEnd: number | null; measuredFromDate: string | null; hasBaselineBeforePeriod: boolean; readingsInPeriod: number } }) =>
      row.followerGrowth.netGain === null ||
      (row.followerGrowth.followersAtStart !== null
        && row.followerGrowth.followersAtEnd !== null
        && row.followerGrowth.measuredFromDate !== null
        && (row.followerGrowth.hasBaselineBeforePeriod || row.followerGrowth.readingsInPeriod > 1))),
    "Um criador trouxe saldo sem as duas leituras que o produzem.",
  );
  assert(
    followers.creatorsMeasuredFromInsidePeriod <= followers.creatorsMeasured,
    "Mais criadores medidos por dentro do período do que medidos no total.",
  );
  process.stdout.write(
    `  saldo de seguidores da base: ${followers.netGain === null ? "indisponível" : followers.netGain} ` +
      `(${followers.creatorsMeasured} medidos, ${followers.creatorsGaining} ganhando, ${followers.creatorsLosing} perdendo, ` +
      `${followers.creatorsMeasuredFromInsidePeriod} sem referência antes do período)\n\n`,
  );

  process.stdout.write("3) Ordenações e recortes\n");
  for (const sortBy of ["engagement", "reach", "needs_attention", "follower_gain"] as const) {
    const page = await timed(`sortBy=${sortBy}`, () =>
      analyzeMcpAdminPortfolio({ ...period, sortBy, limit: 3 }),
    );
    assert(page.summary.totalCreators === portfolio.summary.totalCreators, `sortBy=${sortBy} mudou a população.`);
  }
  const connected = await timed("connection=connected", () =>
    analyzeMcpAdminPortfolio({ ...period, connection: "connected", limit: 3 }),
  );
  const disconnected = await timed("connection=disconnected", () =>
    analyzeMcpAdminPortfolio({ ...period, connection: "disconnected", limit: 3 }),
  );
  assert(
    connected.summary.totalCreators + disconnected.summary.totalCreators === portfolio.summary.totalCreators,
    "Conectados e desconectados não recompõem a população inteira.",
  );
  assert(connected.summary.disconnectedCreators === 0, "Recorte de conectados trouxe conta desconectada.");
  const reels = await timed("format=reel", () => analyzeMcpAdminPortfolio({ ...period, format: "reel", limit: 3 }));
  assert(
    reels.summary.current.posts <= portfolio.summary.current.posts,
    "O recorte de reels trouxe mais posts que o total do período.",
  );
  process.stdout.write("\n");

  const target = portfolio.creators[0]?.creator.id;
  if (!target) {
    process.stdout.write("4) Dossiê individual: sem criador no período; nada a conferir.\n");
  } else {
    process.stdout.write("4) Dossiê individual\n");
    const analysis = await timed("get_creator_analysis", () =>
      getMcpAdminCreatorAnalysis({ creatorRef: target, ...period }),
    );
    assert(analysis, "O dossiê administrativo não encontrou o criador que a consolidação devolveu.");
    assertNoLeak("get_creator_analysis", analysis);
    assert(analysis.targetCreatorRef === target, "O dossiê não ficou amarrado ao criador pedido.");
    assert(analysis.overview.creator.id === target, "A identidade do dossiê diverge do criador pedido.");
    assert(
      analysis.performance.creators.every((row: { creator: { id: string } }) => row.creator.id === target),
      "O desempenho do dossiê trouxe outro criador junto.",
    );
    assert(analysis.dna === null || analysis.dna.audience === null, "O dossiê editorial trouxe demografia junto.");
    process.stdout.write(
      `  ${target} | mapa: ${analysis.map.hasMap ? analysis.map.maturity : "inexistente"} | ` +
        `DNA: ${analysis.dna ? "disponível" : "ausente"} | avisos: ${analysis.receipt.warnings.length}\n`,
    );
  }

  process.stdout.write("5) Saldo de seguidores por dia\n");
  const withFollowers = portfolio.creators.find(
    (row: { followerGrowth: { netGain: number | null } }) => row.followerGrowth.netGain !== null,
  )?.creator.id ?? portfolio.creators[0]?.creator.id;
  if (!withFollowers) {
    process.stdout.write("  sem criador no período; nada a conferir.\n");
  } else {
    const growth = await timed("get_follower_growth", () =>
      getMcpFollowerGrowth({ userId: withFollowers.replace("creator:", ""), ...period }),
    );
    assertNoLeak("get_follower_growth", growth);
    assert(
      growth.days.every((day) => day.netGain === null || Number.isFinite(day.netGain)),
      "A série diária trouxe um saldo que não é número.",
    );
    assert(
      growth.days.every((day) => day.daysCovered === null || day.daysCovered >= 1),
      "Um dia declarou cobrir menos de um dia.",
    );
    assert(
      growth.coverage.daysWithReading === growth.days.length,
      "A cobertura não bate com a quantidade de dias devolvidos.",
    );
    const somaDosDias = growth.days.reduce((total, day) => total + (day.netGain ?? 0), 0);
    assert(
      growth.summary.netGain === null || growth.summary.netGain === somaDosDias,
      "O saldo do período não é a soma dos saldos diários.",
    );
    const medidos = growth.days.filter((day) => day.netGain !== null).length;
    process.stdout.write(
      `  ${withFollowers} | ${growth.days.length} dias com leitura de ${growth.coverage.calendarDays} | ` +
        `${medidos} com saldo | período: ${growth.summary.netGain ?? "indisponível"} | ` +
        `melhor dia: ${growth.summary.bestDay ? `${growth.summary.bestDay.date} (+${growth.summary.bestDay.netGain})` : "—"} | ` +
        `dias no vermelho: ${growth.summary.daysWithLoss}\n`,
    );
    process.stdout.write(`  avisos: ${growth.coverage.warnings.join(", ") || "nenhum"}\n`);
  }

  process.stdout.write("\nSmoke da análise administrativa passou: diretório completo, consolidação da base, recortes e dossiê individual.\n");
}

async function expectRejectedCursor(cursor: string | null) {
  if (!cursor) return;
  // Cursor só vale para o filtro que o originou: mudar o filtro precisa falhar.
  await listMcpAdminCreators({ cursor, connection: "connected" }).then(
    () => {
      throw new Error("O cursor foi aceito depois de trocar o filtro.");
    },
    (error: unknown) => {
      assert(
        error instanceof Error && error.message === "invalid_admin_cursor",
        "Cursor com filtro trocado falhou por outro motivo.",
      );
    },
  );
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
