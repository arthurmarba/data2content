/**
 * weeklyReportService.ts — o serviço que fecha a semana.
 *
 * Duas responsabilidades, nesta ordem:
 *   1. FECHAR: gravar o snapshot congelado da semana (idempotente por upsert).
 *   2. COMPOR: resolver a previsão da semana anterior e devolver o `WeeklyReportData`.
 *
 * O passo 1 tem que rodar mesmo que o 2 falhe — o snapshot é irrecuperável, o
 * relatório é reprodutível.
 *
 * Antes dos dois, os NÚMEROS de cada post da semana são congelados (statsFreeze.ts).
 * Assim refechar dias depois — quando a leitura de cena alcança a semana — completa
 * assunto, tom e asset sem trocar os números da segunda pelos do dia.
 */

import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import MetricModel from "@/app/models/Metric";
import MapaSeedModel from "@/app/models/MapaSeed";
import WeeklyTerritoryReportModel from "@/app/models/WeeklyTerritoryReport";
import WeeklyReportPredictionModel from "@/app/models/WeeklyReportPrediction";
import WeeklyStatsFreezeModel from "@/app/models/WeeklyStatsFreeze";
import { logger } from "@/app/lib/logger";
import { buildWeeklyReport, type SnapshotForMovement } from "./buildReport";
import { loadWindow } from "./loadWindow";
import {
  extractRawMetrics,
  durationBucketFor,
  meanOf,
  rawRetention,
  type ReportPost,
} from "./postMetrics";
import {
  ReclosingWithoutFrozenStatsError,
  WeekNotEndedError,
  coverageOf,
  planPredictionWrite,
  reclosingNeedsConsent,
  weekHasEnded,
  type WeekCoverage,
} from "./statsFreeze";
import { freezeWeekStats, loadFrozenStats, type FreezeWeekResult } from "./statsFreezeStore";
import { resolveTerritoryForContexts } from "./territories";
import { MOVEMENT_WEEKS_BACK, WINDOW_DAYS, shiftWeeks, type WeekWindow } from "./weekWindow";
import type { CollectedTerritory } from "./collectTerritory";
import type { PredictionOutcome, WeeklyReportData } from "./types";

const TAG = "[relatorio][weeklyReportService]";

/** Territórios fixados para a reunião. Vazio = escolha por volume. */
function pinnedTerritories(): string[] {
  return (process.env.RELATORIO_TERRITORIOS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

// NOTA: `loadAssetFits` e `loadNarratives` viviam aqui e foram removidos. O mapa de
// cada criador agora é carregado uma vez em `loadWindow` e resolvido pelo registro
// canônico (mapProfiles.ts) — o "cabe em" e a lista de narrativas saem de lá.

// ─── Snapshots de semanas anteriores ─────────────────────────────────────────

export async function loadMovementSnapshots(
  week: WeekWindow,
  weeksBack: number = MOVEMENT_WEEKS_BACK,
): Promise<Map<string, SnapshotForMovement>> {
  const targetKey = shiftWeeks(week, weeksBack).weekKey;
  const docs = await WeeklyTerritoryReportModel.find({ weekKey: targetKey })
    .select("territoryId elements")
    .lean()
    .exec();

  const map = new Map<string, SnapshotForMovement>();
  for (const doc of docs as unknown as Array<{
    territoryId: string;
    elements: Array<{ kind: string; key: string; rank: number }>;
    overviewRank?: number;
  }>) {
    map.set(doc.territoryId, {
      territoryId: doc.territoryId,
      elements: doc.elements ?? [],
      overviewRank: doc.overviewRank,
    });
  }
  if (map.size === 0) {
    logger.info(
      `${TAG} sem snapshot de ${targetKey} — a coluna de movimento sai vazia nesta semana. ` +
        `Esperado nas primeiras ${weeksBack + 1} semanas de operação.`,
    );
  }
  return map;
}

/** Criadores que ganharam destaque na semana anterior — não repetem. */
async function loadPreviousWinners(week: WeekWindow): Promise<Set<string>> {
  const previous = shiftWeeks(week, 1).weekKey;
  const docs = await WeeklyTerritoryReportModel.find({ weekKey: previous })
    .select("highlightWinners")
    .lean()
    .exec();
  const winners = new Set<string>();
  for (const doc of docs as unknown as Array<{ highlightWinners?: string[] }>) {
    for (const id of doc.highlightWinners ?? []) winners.add(id);
  }
  return winners;
}

// ─── Posts de uma semana arbitrária (para a variação de engajamento) ─────────

/**
 * Posts de uma semana já fechada, com os números congelados dela quando existem.
 *
 * Com o congelamento, a variação de engajamento compara cada semana com os números da
 * PRÓPRIA segunda (posts de 1 a 7 dias contra posts de 1 a 7 dias). Antes comparava a
 * semana nova com a anterior já mais velha (8 a 14 dias) — e refechar mudava a conta.
 * Semana sem congelamento cai nos números do dia, como sempre foi.
 */
async function loadWeekPosts(week: WeekWindow): Promise<ReportPost[]> {
  const [rawMetrics, frozen] = await Promise.all([
    MetricModel.find(
      { postDate: { $gte: week.startsAt, $lte: week.endsAt } },
      { user: 1, postDate: 1, context: 1, stats: 1, type: 1 },
    )
      .lean()
      .exec() as unknown as Promise<
      Array<{
        _id: Types.ObjectId;
        user: Types.ObjectId;
        postDate: Date;
        type?: string;
        context?: unknown;
        stats?: Record<string, unknown>;
      }>
    >,
    loadFrozenStats(week.weekKey),
  ]);
  const metrics = rawMetrics.map((metric) => {
    const frozenStats = frozen.stats.get(String(metric._id));
    return frozenStats ? { ...metric, stats: frozenStats as Record<string, unknown> } : metric;
  });

  return metrics.map((metric) => {
    const duration =
      ["REEL", "VIDEO"].includes(metric.type || "") && typeof metric.stats?.video_duration_seconds === "number"
        ? metric.stats.video_duration_seconds
        : null;
    return {
      id: String(metric._id),
      creatorId: String(metric.user),
      postDate: new Date(metric.postDate),
      // Semana anterior serve só para a variação de engajamento — território não é
      // usado aqui, então fica null em vez de puxar o mapa de novo.
      territoryId: null,
      observedTerritoryId: resolveTerritoryForContexts(metric.context)?.id ?? null,
      // A semana anterior entra só para a variação de engajamento do território — nada
      // de cena é lido dela, então as dimensões abertas ficam vazias de propósito.
      temas: [],
      objetos: [],
      falas: [],
      local: null,
      enquadramentos: [],
      esteticas: [],
      screenTitle: null,
      openingLine: null,
      sceneRead: false,
      absolute: {},
      raw: extractRawMetrics(metric.stats, metric.type),
      rawRetentionValue: rawRetention(metric.stats, metric.type),
      durationSeconds: duration,
      durationBucket: durationBucketFor(duration)?.key ?? null,
      assuntos: [],
      tons: [],
      formatos: [],
      assets: [],
      postLink: null,
      thumbnailUrl: null,
      description: "",
    };
  });
}

// ─── Previsão ────────────────────────────────────────────────────────────────

/**
 * Resolve a previsão de uma semana medindo a semana seguinte. `tested` são os posts
 * que contêm TODOS os elementos previstos; `worked`, quantos bateram o limiar.
 * Nenhum dos dois é editável — é isso que torna a tela 02 uma prestação de contas.
 */
export async function resolvePreviousPrediction(
  week: WeekWindow,
  weekPosts: readonly ReportPost[],
): Promise<PredictionOutcome | null> {
  const previousKey = shiftWeeks(week, 1).weekKey;
  // Refechar esta semana mede de novo a aposta que ELA MESMA resolveu — agora com a
  // semana completa. Aposta resolvida por outra semana não se toca.
  const prediction = await WeeklyReportPredictionModel.findOne({
    weekKey: previousKey,
    $or: [{ resolvedAt: null }, { resolvedWeekKey: week.weekKey }],
  }).exec();
  if (!prediction) return null;

  const matches = (post: ReportPost) =>
    prediction.elements.every((element) => {
      if (element.kind === "asset") return post.assets.includes(element.key);
      if (element.kind === "assunto") return post.assuntos.includes(element.key);
      if (element.kind === "tom") return post.tons.includes(element.key);
      if (element.kind === "formato") return post.formatos.includes(element.key);
      if (element.kind === "duracao") return post.durationBucket === element.key;
      if (element.kind === "territorio") return post.territoryId === element.key;
      return false;
    });

  const scope = prediction.territoryId
    ? weekPosts.filter((post) => post.territoryId === prediction.territoryId)
    : weekPosts;
  const tested = scope.filter(matches);
  const territoryMean = meanOf(scope.map((post) => post.raw[prediction.metric] ?? null));

  let worked = 0;
  if (territoryMean !== null && territoryMean > 0) {
    for (const post of tested) {
      const value = post.raw[prediction.metric];
      if (value === null || value === undefined) continue;
      if (value / territoryMean >= prediction.successThreshold) worked += 1;
    }
  }

  const note =
    tested.length === 0
      ? "Ninguém testou. A previsão volta para a semana que vem."
      : worked >= Math.ceil(tested.length * 0.6)
        ? null
        : `Funcionou em ${worked} de ${tested.length}. A leitura da semana passada não se sustentou.`;

  prediction.resolvedAt = new Date();
  prediction.resolvedWeekKey = week.weekKey;
  prediction.tested = tested.length;
  prediction.worked = worked;
  prediction.outcomeNote = note;
  await prediction.save();

  return { statement: prediction.statement, tested: tested.length, worked, note };
}

// ─── Fechar a semana ─────────────────────────────────────────────────────────

export interface CloseWeekResult {
  weekKey: string;
  territories: string[];
  report: WeeklyReportData;
  /** true quando gravou; false em dry run. */
  persisted: boolean;
  /** O que o congelamento fez com os números desta semana. */
  freeze: FreezeWeekResult;
  /** Quanto da semana (posts com território) o retrato conseguiu ler. */
  coverage: WeekCoverage;
}

function snapshotElementsOf(collected: CollectedTerritory) {
  const tables = [
    collected.tables.assets,
    collected.tables.assuntos,
    collected.tables.tons,
    collected.tables.horarios,
    collected.tables.duracoes,
    collected.tables.ganchos,
  ];
  const elements: Array<Record<string, unknown>> = [];
  for (const table of tables) {
    // rows + overflow: o snapshot guarda TODO elemento elegível, não só o que caiu no
    // slide. Senão um elemento que sai do top-5 numa semana viraria "novo" ao voltar.
    [...table.rows, ...table.overflow].forEach((row, index) => {
      elements.push({
        kind: row.kind,
        key: row.key,
        label: row.label,
        rank: index + 1,
        occurrences: row.occurrences,
        creators: row.creators,
        occurrencesInWindow: row.occurrencesInWindow,
        metrics: row.metrics,
        medianViews: row.medianViews ?? null,
        fitsCount: row.fitsCount,
        fitsOutOf: row.fitsOutOf,
        pullsDown: row.pullsDown,
        evidence: row.evidence,
      });
    });
  }
  return elements;
}

export interface CloseWeekOptions {
  week: WeekWindow;
  /** true = calcula e devolve sem gravar. Para inspecionar antes de publicar. */
  dryRun?: boolean;
  /**
   * Refechar semana fechada ANTES de existir o congelamento grava os números de hoje.
   * Sem isto, `closeWeek` recusa. A rotina de segunda nunca precisa: semana nova não
   * tem retrato.
   */
  acceptTodayStats?: boolean;
}

export async function closeWeek(options: CloseWeekOptions): Promise<CloseWeekResult> {
  const { week, dryRun = false, acceptTodayStats = false } = options;
  if (!dryRun && !weekHasEnded(week)) throw new WeekNotEndedError(week.weekKey);
  await connectToDatabase();

  const [hasReport, hasFreeze] = await Promise.all([
    WeeklyTerritoryReportModel.exists({ weekKey: week.weekKey }),
    WeeklyStatsFreezeModel.exists({ weekKey: week.weekKey }),
  ]);
  if (
    reclosingNeedsConsent({
      hasReport: Boolean(hasReport),
      hasFreeze: Boolean(hasFreeze),
      dryRun,
      acceptTodayStats,
    })
  ) {
    throw new ReclosingWithoutFrozenStatsError(week.weekKey);
  }

  // Congela ANTES de calcular: o cálculo lê os números congelados (loadWindow).
  const freeze = await freezeWeekStats(week, { dryRun });
  const window = await loadWindow(week);

  const [movementSnapshots, previousWinners, rawPreviousWeekPosts] = await Promise.all([
    loadMovementSnapshots(week),
    loadPreviousWinners(week),
    loadWeekPosts(shiftWeeks(week, 1)),
  ]);

  // Os posts da semana anterior também herdam o território do MAPA. Sem isto eles
  // ficam sem território e a variação de engajamento do cabeçalho sai "—" — foi o que
  // aconteceu na primeira execução com território vindo do mapa.
  const previousWeekPosts = rawPreviousWeekPosts.map((post) => ({
    ...post,
    territoryId: window.mapProfiles.get(post.creatorId)?.primaryTerritoryId ?? null,
  }));

  const previousPrediction = dryRun
    ? null
    : await resolvePreviousPrediction(week, window.weekPosts);

  const built = buildWeeklyReport({
    window,
    previousWeekPosts,
    movementSnapshots,
    previousPrediction,
    prediction: null,
    previousWinners,
    pinnedTerritories: pinnedTerritories(),
  });

  const coverageByTerritory = new Map(
    built.collected.map(({ territoryId, collected }) => [
      territoryId,
      coverageOf(collected.weekPosts, window.classifiedPostIds, window.frozenPostIds),
    ]),
  );
  const coverage = coverageOf(
    window.weekPosts.filter((post) => post.territoryId !== null),
    window.classifiedPostIds,
    window.frozenPostIds,
  );

  if (dryRun) {
    return {
      weekKey: week.weekKey,
      territories: built.collected.map((item) => item.territoryId),
      report: built.data,
      persisted: false,
      freeze,
      coverage,
    };
  }

  const highlightWinnersByTerritory = new Map<string, string[]>();
  for (const highlight of built.data.highlights) {
    if (!highlight.territoryId) continue;
    const list = highlightWinnersByTerritory.get(highlight.territoryId) ?? [];
    list.push(highlight.creatorName);
    highlightWinnersByTerritory.set(highlight.territoryId, list);
  }

  for (const { territoryId, territoryLabel, collected } of built.collected) {
    const section = built.data.territories.find((s) => s.header.territoryId === territoryId);
    await WeeklyTerritoryReportModel.updateOne(
      { weekKey: week.weekKey, territoryId },
      {
        $set: {
          isoYear: week.isoYear,
          isoWeek: week.isoWeek,
          weekStartsAt: week.startsAt,
          weekEndsAt: week.endsAt,
          territoryLabel,
          posts: collected.weekPosts.length,
          creators: collected.creatorsInWeek,
          narratives: collected.narratives.length,
          engagementMean: collected.territoryBaseline.engajamento ?? 0,
          engagementDeltaPct: section?.header.engagementDeltaPct ?? null,
          sortedBy: {
            asset: collected.tables.assets.sortedBy,
            assunto: collected.tables.assuntos.sortedBy,
            tom: collected.tables.tons.sortedBy,
            horario: collected.tables.horarios.sortedBy,
            duracao: collected.tables.duracoes.sortedBy,
            gancho: collected.tables.ganchos.sortedBy,
          },
          elements: snapshotElementsOf(collected),
          overviewRank: built.overviewRanks.get(territoryId) ?? null,
          highlightWinners: highlightWinnersByTerritory.get(territoryId) ?? [],
          coverage: {
            ...(coverageByTerritory.get(territoryId) ?? coverageOf([], new Set(), new Set())),
            statsFrozenAt: window.statsFrozenAt,
          },
          generatedAt: new Date(),
          schemaVersion: "weekly_territory_report_v1",
        },
      },
      { upsert: true },
    );
  }

  // Território que tinha retrato e sumiu ao refechar (mapa mudou): o documento velho
  // fica, mas avisa — apagar retrato é decisão de gente.
  const writtenTerritories = built.collected.map((item) => item.territoryId);
  const stale = (await WeeklyTerritoryReportModel.find({
    weekKey: week.weekKey,
    territoryId: { $nin: writtenTerritories },
  })
    .select("territoryId")
    .lean()
    .exec()) as unknown as Array<{ territoryId: string }>;
  if (stale.length > 0) {
    logger.warn(
      `${TAG} ${week.weekKey}: retrato antigo sem correspondente neste fechamento — ` +
        `${stale.map((doc) => doc.territoryId).join(", ")}. Mantido.`,
    );
  }

  // Grava a previsão desta semana. Sem isto a tela 02 da próxima segunda nunca terá
  // "resultado da previsão" — e a previsão perde o que a torna diferente de horóscopo.
  //
  // Refechar não pode deixar duas apostas na mesma semana (o upsert é por território, e
  // a aposta nova pode ser de outro) nem reescrever aposta que a semana seguinte já
  // mediu. Ver `planPredictionWrite`.
  const prediction = built.data.prediction;
  const existingPredictions = (await WeeklyReportPredictionModel.find({ weekKey: week.weekKey })
    .select("territoryId resolvedAt")
    .lean()
    .exec()) as unknown as Array<{ territoryId: string | null; resolvedAt: Date | null }>;
  const plan = planPredictionWrite(existingPredictions, Boolean(prediction));
  if (plan.action === "keep-resolved") {
    logger.info(`${TAG} previsão de ${week.weekKey} já foi medida pela semana seguinte — mantida.`);
  } else if (plan.action === "clear-unresolved") {
    await WeeklyReportPredictionModel.deleteMany({ weekKey: week.weekKey, resolvedAt: null });
    logger.info(`${TAG} nenhum elemento virou previsão ao refechar; a aposta antiga saiu.`);
  } else if (prediction) {
    await WeeklyReportPredictionModel.deleteMany({
      weekKey: week.weekKey,
      territoryId: { $ne: prediction.territoryId },
      resolvedAt: null,
    });
    await WeeklyReportPredictionModel.updateOne(
      { weekKey: week.weekKey, territoryId: prediction.territoryId },
      {
        $set: {
          statement: prediction.statement,
          caveat: prediction.caveat,
          elements: prediction.elements,
          metric: prediction.metric,
          successThreshold: 1.3,
        },
        $setOnInsert: { resolvedAt: null },
      },
      { upsert: true },
    );
    logger.info(`${TAG} previsão de ${week.weekKey} gravada: ${prediction.statement}`);
  } else {
    logger.info(`${TAG} nenhum elemento se destacou o bastante para virar previsão.`);
  }

  logger.info(
    `${TAG} semana ${week.weekKey} fechada: ${built.collected.length} territórios gravados · ` +
      `cobertura ${coverage.posts} posts, ${coverage.withStats} com número, ` +
      `${coverage.frozen} congelados, ${coverage.classified} classificados, ` +
      `${coverage.sceneRead} lidos.`,
  );

  return {
    weekKey: week.weekKey,
    territories: writtenTerritories,
    report: built.data,
    persisted: true,
    freeze,
    coverage,
  };
}
