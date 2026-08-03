/**
 * buildReport.ts — junta os coletores num `WeeklyReportData`.
 *
 * Esta é a função que o job da segunda chama. Recebe a janela já carregada e os
 * snapshots das semanas anteriores; devolve o relatório inteiro, pronto para
 * renderizar. Nenhuma chamada de banco aqui — o que entra, entra por parâmetro.
 */

import {
  applyCreatorReachBaseline,
  applyRetentionBaseline,
  buildRetentionBaseline,
} from "./retentionBaseline";
import {
  collectCrossTerritory,
  collectHighlights,
  collectOverview,
  collectSilentCreators,
  crossTerritoryHints,
  engagementDeltaPct,
} from "./collectPlatform";
import { collectTerritory, type CollectedTerritory } from "./collectTerritory";
import { buildPautas, buildPrediction, pickPredictionCandidate } from "./buildPrediction";
import {
  assetFitsByTerritory,
  narrativesOfTerritory,
  territoryMemberships,
} from "./mapProfiles";
import { canonicalTerritoryById } from "./mapRegistry";
import { selectWeekTerritories, tallyTerritories } from "./territories";
import { MOVEMENT_WEEKS_BACK, WINDOW_DAYS, type WeekWindow } from "./weekWindow";
import type { CreatorProfile, WindowData } from "./loadWindow";
import type {
  PredictionOutcome,
  PredictionStatement,
  RankingTable,
  TerritorySection,
  WeeklyReportData,
} from "./types";

/** Snapshot congelado de uma semana × território, do jeito que o motor precisa. */
export interface SnapshotForMovement {
  territoryId: string;
  elements: readonly { kind: string; key: string; rank: number }[];
  /** Posição do território na visão geral daquela semana. */
  overviewRank?: number;
}

export interface BuildReportParams {
  window: WindowData;
  /** Posts da semana anterior — só para a variação de engajamento do cabeçalho. */
  previousWeekPosts: readonly import("./postMetrics").ReportPost[];
  /** Snapshots de `MOVEMENT_WEEKS_BACK` semanas atrás, por território. */
  movementSnapshots: Map<string, SnapshotForMovement>;
  /** Resultado da previsão da semana anterior, já resolvido. */
  previousPrediction: PredictionOutcome | null;
  /** A previsão desta semana. */
  prediction: PredictionStatement | null;
  /** Criadores que ganharam destaque na semana passada — não repetem. */
  previousWinners?: ReadonlySet<string>;
  pinnedTerritories?: string[];
  territoryCount?: number;
}

export interface BuiltReport {
  data: WeeklyReportData;
  /** Coletas cruas por território — o job usa para gravar o snapshot. */
  collected: { territoryId: string; territoryLabel: string; collected: CollectedTerritory }[];
  /** Posição de cada território na visão geral, para o snapshot. */
  overviewRanks: Map<string, number>;
}

const NUMERO_POR_EXTENSO = ["nenhum", "um", "dois", "três", "quatro", "cinco", "seis"];

/**
 * Blocos da reunião de quinta. O primeiro bloco nomeia quantos territórios o relatório
 * abriu — era "Os quatro territórios" fixo, e saía errado assim que um território não
 * atingia o piso de criadores. O que está no slide tem que ser o que está no relatório.
 */
function meetingFor(territoryCount: number) {
  const quantos = NUMERO_POR_EXTENSO[territoryCount] ?? String(territoryCount);
  return {
    weekdayLabel: "Quinta",
    timeLabel: "19h",
    blocks: [
      {
        label: territoryCount === 1 ? "O território" : `Os ${quantos} territórios`,
        minutes: 20,
        audience: "todos" as const,
      },
      { label: "A sua conta na tela", minutes: 40, audience: "assinantes" as const },
      { label: "Perguntas", minutes: 15, audience: "assinantes" as const },
    ],
  };
}

function windowLabelFor(windowDays: number): string {
  return `últimos ${windowDays} dias`;
}

/** Só a parte pública da tabela — o overflow fica para a matriz. */
function publicTable(table: RankingTable & { overflow?: unknown }): RankingTable {
  return {
    kind: table.kind,
    title: table.title,
    sortedBy: table.sortedBy,
    columns: table.columns,
    rows: table.rows,
    reading: table.reading,
    cutoffNote: table.cutoffNote,
  };
}

export function buildWeeklyReport(params: BuildReportParams): BuiltReport {
  const {
    window,
    previousWeekPosts,
    movementSnapshots,
    previousPrediction,
    prediction,
    previousWinners = new Set<string>(),
    pinnedTerritories = [],
    territoryCount = 4,
  } = params;

  const week: WeekWindow = window.week;

  // 1. As duas linhas de base, sobre a janela inteira. Têm que vir antes de tudo:
  //    dali pra frente `raw.retencao` e `raw.alcance` são ÍNDICES, não valores brutos,
  //    e todo o resto do motor pode tratar as sete métricas do mesmo jeito.
  //      • retenção → esperado para a DURAÇÃO do vídeo (§8 do briefing)
  //      • alcance  → alcance típico do PRÓPRIO criador
  const baseline = buildRetentionBaseline(window.posts);
  const posts = applyCreatorReachBaseline(applyRetentionBaseline(window.posts, baseline));
  const weekPostIds = new Set(window.weekPosts.map((post) => post.id));
  const weekPosts = posts.filter((post) => weekPostIds.has(post.id));
  const previousWeek = applyCreatorReachBaseline(
    applyRetentionBaseline(previousWeekPosts, baseline),
  );

  // 2. Territórios da semana. O universo de territórios vem do MAPA dos criadores;
  //    a seleção de quais abrem tela usa o volume de posts da semana.
  const memberships = territoryMemberships(window.mapProfiles);
  const membershipById = new Map(memberships.map((m) => [m.territoryId, m]));
  const volumes = tallyTerritories(weekPosts);
  const territoryIds = selectWeekTerritories(volumes, {
    count: territoryCount,
    pinned: pinnedTerritories,
  });

  // 3. Comparação entre territórios primeiro — ela alimenta a dica de lacuna de cada um.
  const crossTerritory = collectCrossTerritory(posts, territoryIds);
  const hints = crossTerritoryHints(crossTerritory, territoryIds);

  // 4. As quatro telas de cada território.
  const creatorsForCollect = new Map(
    [...window.creators.entries()].map(([id, profile]) => [
      id,
      { name: profile.name, handle: profile.handle },
    ]),
  );

  // "Cabe em" e narrativas vêm do MAPA, não dos posts.
  const fitsFromMap = assetFitsByTerritory(window.mapProfiles);

  const collected = territoryIds.map((territoryId) => {
    const label = canonicalTerritoryById(territoryId)?.label ?? territoryId;
    const windowPosts = posts.filter((post) => post.territoryId === territoryId);
    const snapshot = movementSnapshots.get(territoryId) ?? null;
    const creatorsInWeek = new Set(
      weekPosts.filter((post) => post.territoryId === territoryId).map((post) => post.creatorId),
    );
    return {
      territoryId,
      territoryLabel: label,
      // Narrativas do mapa dos criadores que postaram no território nesta semana.
      narratives: narrativesOfTerritory(territoryId, window.mapProfiles, creatorsInWeek),
      // Criadores que DECLARAM o território no mapa — é o "58 criadores" do cabeçalho.
      declaredCreators: membershipById.get(territoryId)?.creatorIds.length ?? 0,
      collected: collectTerritory({
        territoryId,
        territoryLabel: label,
        windowPosts,
        weekPostIds,
        creators: creatorsForCollect,
        // A lista de narrativas passa a vir pronta do mapa; o coletor não a deriva.
        narratives: null,
        previousElements: snapshot?.elements ?? null,
        movementWeeksBack: MOVEMENT_WEEKS_BACK,
        windowDays: WINDOW_DAYS,
        windowLabel: windowLabelFor(WINDOW_DAYS),
        assetFits: fitsFromMap.get(territoryId) ?? new Map(),
        // Denominador do "cabe em": quem declara o território no mapa.
        fitsOutOf: membershipById.get(territoryId)?.creatorIds.length ?? 0,
        crossTerritoryHint: hints.get(territoryId) ?? null,
      }),
    };
  });

  // 5. Visão geral, com movimento vindo do snapshot.
  const overviewPreviousRanks = new Map<string, number>();
  for (const [territoryId, snapshot] of movementSnapshots) {
    if (typeof snapshot.overviewRank === "number") {
      overviewPreviousRanks.set(territoryId, snapshot.overviewRank);
    }
  }
  const overview = collectOverview(
    posts,
    weekPosts,
    territoryIds,
    overviewPreviousRanks.size > 0 ? overviewPreviousRanks : null,
    MOVEMENT_WEEKS_BACK,
  );
  const overviewRanks = new Map(overview.map((row, index) => [row.territoryId, index + 1]));

  // 6. Seções, já no formato de apresentação.
  const sections: TerritorySection[] = collected.map((item) => {
    const { territoryId, territoryLabel, collected: c, narratives, declaredCreators } = item;
    const territoryWeekPosts = weekPosts.filter((post) => post.territoryId === territoryId);
    const territoryPreviousWeek = previousWeek.filter((post) => post.territoryId === territoryId);
    return {
      header: {
        territoryId,
        label: territoryLabel,
        // Criadores que DECLARAM o território no mapa, não quem postou nesta semana:
        // o território não encolhe porque metade das pessoas não postou.
        creators: declaredCreators,
        creatorsWhoPosted: c.creatorsInWeek,
        narratives: narratives.length,
        engagementDeltaPct: engagementDeltaPct(territoryWeekPosts, territoryPreviousWeek),
        // Só vídeo entra na conta: post estático nunca teve cena para ler, e contá-lo
        // no denominador faria a cobertura parecer pior do que é.
        scene: {
          videos: territoryWeekPosts.filter((post) => post.durationSeconds !== null).length,
          read: territoryWeekPosts.filter((post) => post.sceneRead).length,
        },
      },
      narratives: narratives.map((n) => ({ label: n.label, creators: n.creators })),
      assets: publicTable(c.tables.assets),
      assuntos: publicTable(c.tables.assuntos),
      tons: publicTable(c.tables.tons),
      temas: publicTable(c.tables.temas),
      objetos: publicTable(c.tables.objetos),
      falas: publicTable(c.tables.falas),
      locais: publicTable(c.tables.locais),
      enquadramentos: publicTable(c.tables.enquadramentos),
      esteticas: publicTable(c.tables.esteticas),
      horarios: publicTable(c.tables.horarios),
      duracoes: publicTable(c.tables.duracoes),
      timeGrid: c.timeGrid,
      durations: c.durations,
      topVideos: c.topVideos,
      gaps: c.gaps,
      matrix: c.matrix,
      strongCombination: c.strongCombination,
      // Pautas: uma por narrativa, cruzando a narrativa do mapa com o elemento que
      // está funcionando no território nesta semana.
      // As abertas entram primeiro na geração de pauta: "falar sobre voltar a
      // trabalhar depois da licença" é uma pauta de verdade; "ter filho em cena" é
      // uma condição de produção.
      pautas: buildPautas(narratives, [
        c.tables.temas,
        c.tables.falas,
        c.tables.assets,
        c.tables.locais,
        c.tables.assuntos,
        c.tables.tons,
      ]),
    };
  });

  // 7. Leitura da tela 19: qual território leva cada elemento.
  const crossWithReading = crossTerritory.map((row) => {
    const usable = row.byTerritory.filter((cell) => cell.index !== null) as {
      territoryId: string;
      index: number;
    }[];
    if (usable.length < 2) return row;
    const best = usable.reduce((a, b) => (b.index > a.index ? b : a));
    const worst = usable.reduce((a, b) => (b.index < a.index ? b : a));
    const bestLabel = canonicalTerritoryById(best.territoryId)?.label ?? best.territoryId;
    const worstLabel = canonicalTerritoryById(worst.territoryId)?.label ?? worst.territoryId;
    return {
      ...row,
      reading: `Funciona em ${bestLabel} e não funciona em ${worstLabel}.`,
    };
  });

  // 8. Destaques, silenciosos e capa.
  const highlights = collectHighlights(
    posts,
    weekPosts,
    window.creators,
    collected.map(({ territoryId, collected: c }) => ({ territoryId, collected: c })),
    previousWinners,
  );
  // Território de cada criador para "quem não postou": direto do mapa.
  const creatorTerritories = new Map<string, string>();
  for (const [creatorId, profile] of window.mapProfiles) {
    if (profile.primaryTerritoryId) creatorTerritories.set(creatorId, profile.primaryTerritoryId);
  }
  const silentCreators = collectSilentCreators(
    posts,
    weekPosts,
    window.creators,
    creatorTerritories,
  );

  // A previsão desta semana é DERIVADA do ranking, não escrita à mão: o melhor
  // candidato é o elemento que funciona muito e ainda é pouco adotado no território.
  // Nascendo do ranking, ela já vem com os elementos estruturados que a semana
  // seguinte vai medir — a frase e a medição não podem divergir.
  const predictionCandidates = collected
    .map((item) =>
      pickPredictionCandidate(item.territoryId, item.territoryLabel, [
        item.collected.tables.assets,
        item.collected.tables.assuntos,
        item.collected.tables.tons,
      ]),
    )
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

  const bestCandidate =
    predictionCandidates.length > 0
      ? predictionCandidates.reduce((best, candidate) => {
          const indexOf = (c: typeof candidate) =>
            c.row.metrics.find((m) => m.metric === c.metric)?.index ?? 0;
          return indexOf(candidate) > indexOf(best) ? candidate : best;
        })
      : null;

  const weekPrediction = prediction ?? buildPrediction(bestCandidate);

  const data: WeeklyReportData = {
    meta: {
      weekKey: week.weekKey,
      startsAt: week.startsAt.toISOString(),
      endsAt: week.endsAt.toISOString(),
      timezone: "America/Sao_Paulo",
      generatedAt: new Date().toISOString(),
      windowDays: WINDOW_DAYS,
      schemaVersion: "weekly_report_v1",
    },
    cover: {
      isoWeek: week.isoWeek,
      isoYear: week.isoYear,
      rangeLabel: week.rangeLabel,
      creators: new Set(weekPosts.map((post) => post.creatorId)).size,
      territories: territoryIds.length,
      videos: weekPosts.length,
      engagementDeltaPct: engagementDeltaPct(weekPosts, previousWeek),
    },
    overview,
    previousPrediction,
    territories: sections,
    crossTerritory: crossWithReading,
    highlights,
    silentCreators,
    prediction: weekPrediction,
    meeting: meetingFor(territoryIds.length),
  };

  return { data, collected, overviewRanks };
}

export type { CreatorProfile };
