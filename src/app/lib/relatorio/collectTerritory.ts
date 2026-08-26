/**
 * collectTerritory.ts — as quatro telas de um território.
 *
 * Tudo função pura sobre `ReportPost[]`. O banco fica em loadWindow.ts; o desenho
 * fica nos templates. Aqui mora só a regra.
 */

import {
  DURATION_BUCKETS,
  meanOf,
  medianOf,
  roundIndex,
  type ReportPost,
} from "./postMetrics";
import {
  buildRankingTable,
  territoryBaselineFrom,
  type BuildRankingResult,
  type ElementObservation,
} from "./rankingEngine";
import { SLOT_LABELS, gridPosition, WEEKDAY_LABELS_SHORT } from "./weekWindow";
import {
  canonicalAestheticById,
  canonicalAssetRoleById,
  canonicalFramingById,
  canonicalPlaceById,
  canonicalSubjectById,
  canonicalToneById,
} from "./mapRegistry";
import { describeTable } from "./describeFinding";
import {
  classifyCreatorHookPattern,
  CREATOR_HOOK_PATTERN_LABELS,
} from "@/app/dashboard/boards/videoUpload/creatorHookEvidence";
import type {
  DurationBar,
  ElementKind,
  MatrixCell,
  MatrixRow,
  MetricIndex,
  NarrativeEntry,
  RankingRow,
  ReportMetric,
  StrongCombination,
  TerritoryGap,
  TimeGrid,
  TimeGridCell,
  TopVideo,
} from "./types";

/** Extrai os rótulos de uma dimensão de um post. */
type DimensionReader = (post: ReportPost) => string[];

type OpenKind = "tema" | "objeto" | "fala" | "local" | "enquadramento" | "estetica";
type ClosedKind = "asset" | "assunto" | "tom" | "formato";

const DIMENSION_READERS: Record<ClosedKind | OpenKind, DimensionReader> = {
  asset: (post) => post.assets,
  assunto: (post) => post.assuntos,
  tom: (post) => post.tons,
  formato: (post) => post.formatos,
  // Abertas: o rótulo É a chave, porque não existe registro para traduzir. Duas
  // criadoras que disseram a mesma frase caem na mesma linha e a linha ganha peso;
  // quem disse coisa diferente ocupa uma linha própria, mais abaixo. Ver weight.ts.
  tema: (post) => post.temas,
  objeto: (post) => post.objetos,
  fala: (post) => post.falas,
  local: (post) => (post.local ? [post.local] : []),
  enquadramento: (post) => post.enquadramentos,
  estetica: (post) => post.esteticas,
};

/**
 * Rótulo de exibição de um elemento. Asset e tom vêm do registro do mapa — é o que
 * garante que o slide mostre "Parceiro em cena" e nunca "a esposa (Lívia)". Chave
 * desconhecida volta como ela mesma, degradando sem quebrar o slide.
 */
function labelForDimension(kind: ElementKind, key: string): string {
  if (kind === "asset") return canonicalAssetRoleById(key)?.label ?? key;
  if (kind === "tom") return canonicalToneById(key)?.label ?? key;
  // Assunto pode ser id canônico do mapa ou label de contentIntent (fallback).
  if (kind === "assunto") return canonicalSubjectById(key)?.label ?? key;
  if (kind === "local") return canonicalPlaceById(key)?.label ?? key;
  if (kind === "enquadramento") return canonicalFramingById(key)?.label ?? key;
  if (kind === "estetica") return canonicalAestheticById(key)?.label ?? key;
  // Tema, objeto e fala não têm registro: o rótulo é o texto do próprio vídeo, e a
  // primeira letra maiúscula é a única cortesia que se faz com ele.
  if (kind === "tema" || kind === "objeto") {
    return key.charAt(0).toUpperCase() + key.slice(1);
  }
  return key;
}

export function observationsFor(
  posts: readonly ReportPost[],
  kind: ClosedKind | OpenKind,
  isInWeek: (post: ReportPost) => boolean,
): ElementObservation[] {
  const read = DIMENSION_READERS[kind];
  const observations: ElementObservation[] = [];
  for (const post of posts) {
    for (const key of read(post)) {
      observations.push({
        key,
        label: labelForDimension(kind, key),
        creatorId: post.creatorId,
        inWeek: isInWeek(post),
        metrics: post.raw,
        views: post.absolute.visualizacoes ?? null,
      });
    }
  }
  return observations;
}

/** Observações de horário: a chave é "Domingo 20–24h". */
export function timeObservations(
  posts: readonly ReportPost[],
  isInWeek: (post: ReportPost) => boolean,
): ElementObservation[] {
  return posts.map((post) => {
    const { dayOfWeek, slot } = gridPosition(post.postDate);
    const key = `${dayOfWeek}|${slot}`;
    return {
      key,
      label: `${WEEKDAY_LABELS_SHORT[dayOfWeek]} ${SLOT_LABELS[slot]}`,
      creatorId: post.creatorId,
      inWeek: isInWeek(post),
      metrics: post.raw,
      views: post.absolute.visualizacoes ?? null,
    };
  });
}

/** Observações de duração: a chave é a faixa. */
export function durationObservations(
  posts: readonly ReportPost[],
  isInWeek: (post: ReportPost) => boolean,
): ElementObservation[] {
  const labels = new Map(DURATION_BUCKETS.map((b) => [b.key, b.label]));
  return posts
    .filter((post) => post.durationBucket !== null)
    .map((post) => ({
      key: post.durationBucket!,
      label: labels.get(post.durationBucket!) ?? post.durationBucket!,
      creatorId: post.creatorId,
      inWeek: isInWeek(post),
      metrics: post.raw,
      views: post.absolute.visualizacoes ?? null,
    }));
}

/**
 * Converte aberturas em padrões anônimos. A frase original é deliberadamente
 * descartada aqui: o território ensina a estrutura que funciona, nunca o texto de
 * outro criador.
 */
export function hookPatternObservations(
  posts: readonly ReportPost[],
  isInWeek: (post: ReportPost) => boolean,
): ElementObservation[] {
  return posts.flatMap((post) => {
    const opening = post.openingLine?.trim() || post.screenTitle?.trim();
    if (!opening) return [];
    const pattern = classifyCreatorHookPattern(opening);
    return [{
      key: pattern,
      label: CREATOR_HOOK_PATTERN_LABELS[pattern],
      creatorId: post.creatorId,
      inWeek: isInWeek(post),
      metrics: post.raw,
      views: post.absolute.visualizacoes ?? null,
    }];
  });
}

// ─── Narrativas (Regra 1: nunca ranqueadas) ──────────────────────────────────

export interface NarrativeSource {
  /** creatorId → rótulo de narrativa. Vem do registro curado por território. */
  byCreator: Map<string, string>;
}

/**
 * Lista de narrativas do território com quantos criadores em cada. SEM ordem de
 * performance — ordenada por número de criadores só para a lista ficar legível, e o
 * slide diz "não tem ordem". Nenhuma métrica entra aqui.
 */
export function collectNarratives(
  weekPosts: readonly ReportPost[],
  source: NarrativeSource | null,
): NarrativeEntry[] {
  if (!source || source.byCreator.size === 0) return [];
  const creatorsInTerritory = new Set(weekPosts.map((post) => post.creatorId));
  const tally = new Map<string, Set<string>>();
  for (const creatorId of creatorsInTerritory) {
    const narrative = source.byCreator.get(creatorId);
    if (!narrative) continue;
    const set = tally.get(narrative) ?? new Set<string>();
    set.add(creatorId);
    tally.set(narrative, set);
  }
  return [...tally.entries()]
    .map(([label, creators]) => ({ label, creators: creators.size }))
    .sort((a, b) => b.creators - a.creators || a.label.localeCompare(b.label));
}

// ─── Grade dia × faixa de horário ────────────────────────────────────────────

/**
 * A grade. Célula = índice de engajamento sobre a média do território na JANELA
 * (não na semana): com ~35 posts por território por semana, uma célula da semana tem
 * 1 ou 2 posts e o índice seria ruído. A grade é a única tela do relatório que fala
 * de hábito, e hábito não se lê em 7 dias.
 *
 * Célula sem post fica null e o slide pinta cinza — é o buraco de oportunidade.
 */
export function collectTimeGrid(
  windowPosts: readonly ReportPost[],
  metric: ReportMetric = "engajamento",
): TimeGrid {
  const cells = new Map<string, { values: (number | null)[] }>();
  for (const post of windowPosts) {
    const { dayOfWeek, slot } = gridPosition(post.postDate);
    const key = `${dayOfWeek}|${slot}`;
    const entry = cells.get(key) ?? { values: [] };
    entry.values.push(post.raw[metric] ?? null);
    cells.set(key, entry);
  }

  const territoryMean = meanOf(windowPosts.map((post) => post.raw[metric] ?? null));
  const out: TimeGridCell[] = [];
  const emptySlots: { dayOfWeek: number; slot: number }[] = [];

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    for (let slot = 0; slot < SLOT_LABELS.length; slot += 1) {
      const entry = cells.get(`${dayOfWeek}|${slot}`);
      const posts = entry?.values.length ?? 0;
      if (posts === 0) {
        emptySlots.push({ dayOfWeek, slot });
        out.push({ dayOfWeek, slot, index: null, posts: 0 });
        continue;
      }
      const mean = meanOf(entry!.values);
      const index =
        mean !== null && territoryMean !== null && territoryMean > 0
          ? roundIndex(mean / territoryMean)
          : null;
      out.push({ dayOfWeek, slot, index, posts });
    }
  }

  return { slotLabels: [...SLOT_LABELS], cells: out, emptySlots };
}

// ─── Barras por faixa de duração ─────────────────────────────────────────────

/**
 * Retenção e engajamento por faixa. As duas barras existem porque DIVERGEM: vídeo
 * curto retém mais e engaja menos. Responde "que tamanho eu faço" em dois segundos.
 *
 * Aqui a retenção é a CRUA (`rawRetentionValue`), não a corrigida pela linha de base.
 * É o único lugar do relatório em que isso vale: corrigir por duração num gráfico cujo
 * eixo É a duração achataria todas as barras em 1,0× por construção — foi exatamente
 * o que aconteceu na primeira execução contra dado real. A correção existe para não
 * premiar vídeo curto no ranking de ASSUNTO; neste gráfico, o efeito da duração é o
 * assunto.
 */
export function collectDurations(windowPosts: readonly ReportPost[]): DurationBar[] {
  const territoryRetention = medianOf(windowPosts.map((p) => p.rawRetentionValue));
  const territoryEngagement = medianOf(windowPosts.map((p) => p.raw.engajamento ?? null));

  return DURATION_BUCKETS.map((bucket) => {
    const inBucket = windowPosts.filter((post) => post.durationBucket === bucket.key);
    const retentionMean = medianOf(inBucket.map((p) => p.rawRetentionValue));
    const engagementMean = medianOf(inBucket.map((p) => p.raw.engajamento ?? null));
    return {
      label: bucket.label,
      minSeconds: bucket.minSeconds,
      maxSeconds: bucket.maxSeconds,
      posts: inBucket.length,
      retentionIndex:
        retentionMean !== null && territoryRetention !== null && territoryRetention > 0
          ? roundIndex(retentionMean / territoryRetention)
          : null,
      engagementIndex:
        engagementMean !== null && territoryEngagement !== null && territoryEngagement > 0
          ? roundIndex(engagementMean / territoryEngagement)
          : null,
      rawRetention: retentionMean,
    };
  });
}

// ─── Melhores vídeos ─────────────────────────────────────────────────────────

export function collectTopVideos(
  weekPosts: readonly ReportPost[],
  territoryBaseline: Partial<Record<ReportMetric, number | null>>,
  creators: Map<string, { name: string; handle: string | null }>,
  limit = 5,
): TopVideo[] {
  const scored = weekPosts
    .map((post) => ({ post, score: post.raw.engajamento ?? null }))
    .filter((item): item is { post: ReportPost; score: number } => item.score !== null)
    .sort((a, b) => b.score - a.score || a.post.id.localeCompare(b.post.id))
    .slice(0, limit);

  const columns: ReportMetric[] = [
    "curtidas",
    "comentarios",
    "compartilhamentos",
    "salvamentos",
  ];

  return scored.map(({ post }) => {
    const metrics: MetricIndex[] = [];
    for (const metric of columns) {
      const value = post.raw[metric];
      const base = territoryBaseline[metric];
      if (value === null || value === undefined || !base || base <= 0) continue;
      metrics.push({ metric, index: roundIndex(value / base) });
    }
    // As duas em que ele mais se destacou. Quatro números lado a lado, com "0,0×"
    // entre eles, escondiam o que o vídeo tem de notável.
    const standout = [...metrics].sort((a, b) => b.index - a.index).slice(0, 2);
    // Os elementos do mapa presentes — o "por que funcionou" da reunião.
    const elements = [
      ...post.assets.map((key) => labelForDimension("asset", key)),
      ...post.tons.map((key) => labelForDimension("tom", key)),
      ...(post.local ? [labelForDimension("local", post.local)] : []),
      ...post.objetos.map((key) => labelForDimension("objeto", key)),
    ].slice(0, 6);
    const creator = creators.get(post.creatorId);
    return {
      creatorName: creator?.name ?? "Criador",
      creatorHandle: creator?.handle ?? null,
      postLink: post.postLink,
      thumbnailUrl: post.thumbnailUrl,
      durationSeconds: post.durationSeconds,
      // Retenção CRUA, em fração. Aqui o absoluto é legítimo e melhor: para UM vídeo,
      // "61%" é concreto e o criador reconhece; "1,3×" exige a linha de base na cabeça.
      // Ao lado da duração ("78s · 61%") a leitura fica completa sem precisar do índice.
      retention: post.rawRetentionValue,
      metrics,
      standout,
      elements,
      screenTitle: post.screenTitle,
      openingLine: post.openingLine,
    };
  });
}

// ─── Matriz (tela 4 de cada território) ──────────────────────────────────────

function intensityOf(index: number): 1 | 2 | 3 | 4 | 5 {
  if (index >= 2.5) return 5;
  if (index >= 1.9) return 4;
  if (index >= 1.4) return 3;
  if (index >= 1.0) return 2;
  return 1;
}

/**
 * A matriz junta todos os elementos elegíveis do território num painel de leitura
 * literal: ache a coluna, desça, pegue as escuras. Reaproveita as linhas já
 * calculadas pelas tabelas (inclusive o overflow que não caiu nos slides 1–3).
 */
/**
 * Teto de 12 linhas, não 14. O slide tem 720px fixos e a matriz divide a altura com a
 * combinação e as pautas no pé. Com os assets preenchidos a matriz cresceu e empurrou o
 * rodapé para fora — 12 linhas é o que cabe deixando o pé legível.
 */
export function collectMatrix(
  tables: readonly BuildRankingResult[],
  columns: readonly ReportMetric[],
  limit = 12,
): MatrixRow[] {
  const rows: { row: RankingRow; sortIndex: number }[] = [];
  for (const table of tables) {
    for (const row of [...table.rows, ...table.overflow]) {
      const sortIndex = row.metrics.find((m) => m.metric === table.sortedBy)?.index ?? 0;
      rows.push({ row, sortIndex });
    }
  }

  return rows
    .sort((a, b) => b.sortIndex - a.sortIndex || a.row.key.localeCompare(b.row.key))
    .slice(0, limit)
    .map(({ row }) => {
      const cells: MatrixCell[] = [];
      for (const metric of columns) {
        const found = row.metrics.find((m) => m.metric === metric);
        if (!found) continue;
        cells.push({ metric, index: found.index, intensity: intensityOf(found.index) });
      }
      return { kind: row.kind, label: row.label, cells };
    });
}

// ─── A combinação mais forte ─────────────────────────────────────────────────

export const MIN_COMBINATION_OCCURRENCES = 5;
export const MIN_COMBINATION_CREATORS = 3;

/**
 * A combinação mais forte da semana — com TRÊS elementos, não cinco.
 *
 * Onde o mock erra: uma célula de 5 dimensões (assunto × tom × asset × horário ×
 * duração) tem n=0 ou n=1 num território de ~35 posts na semana. A frase "visto 19
 * vezes com 8 criadores" só é verdadeira na janela de 90 dias — e aí não é "da
 * semana". Aqui a combinação é de 3 elementos, medida na janela, e a janela é
 * DECLARADA no slide. Se nem com 3 houver amostra, devolve null e o slide cala.
 */
export function collectStrongCombination(
  windowPosts: readonly ReportPost[],
  territoryBaseline: Partial<Record<ReportMetric, number | null>>,
  metric: ReportMetric,
  windowLabel: string,
): StrongCombination | null {
  interface Cell {
    labels: string[];
    values: (number | null)[];
    creators: Set<string>;
  }
  const cells = new Map<string, Cell>();

  for (const post of windowPosts) {
    // O terceiro eixo é o que estiver disponível, nesta ordem: ASSET (o mais
    // interessante — é o que o mock quer), depois TOM, depois nada.
    //
    // Antes o tom era obrigatório e a combinação sumiu dos quatro territórios quando o
    // tom passou a vir só do mapa: a maioria dos posts ficou sem tom e nenhuma célula
    // atingia a amostra. Exigir uma dimensão que só existe em parte da base derruba a
    // tela inteira em vez de degradar.
    const assunto = post.assuntos[0];
    const bucket = post.durationBucket;
    if (!assunto || !bucket) continue;

    const asset = post.assets[0];
    const tom = post.tons[0];
    const terceiro = asset
      ? labelForDimension("asset", asset)
      : tom
        ? labelForDimension("tom", tom)
        : null;
    if (!terceiro) continue;

    const bucketLabel = DURATION_BUCKETS.find((b) => b.key === bucket)?.label ?? bucket;
    // O assunto vinha CRU para o slide: "criacao_dos_filhos · Filho em cena · 60–90s".
    // As outras duas pontas já passavam pelo tradutor e esta não — a chave técnica
    // vazava para a tela mais lida do território.
    const labels = [labelForDimension("assunto", assunto), terceiro, bucketLabel];
    const key = labels.join(" · ");
    const cell = cells.get(key) ?? { labels, values: [], creators: new Set<string>() };
    cell.values.push(post.raw[metric] ?? null);
    cell.creators.add(post.creatorId);
    cells.set(key, cell);
  }

  const base = territoryBaseline[metric];
  if (!base || base <= 0) return null;

  let best: StrongCombination | null = null;
  let bestIndex = 0;

  for (const cell of cells.values()) {
    const usable = cell.values.filter((v): v is number => v !== null);
    if (usable.length < MIN_COMBINATION_OCCURRENCES) continue;
    if (cell.creators.size < MIN_COMBINATION_CREATORS) continue;
    const cellMedian = medianOf(cell.values);
    if (cellMedian === null) continue;
    const index = cellMedian / base;
    if (index <= bestIndex || index < 1) continue;
    bestIndex = index;
    best = {
      elements: cell.labels,
      occurrences: usable.length,
      creators: cell.creators.size,
      windowLabel,
      metrics: [{ metric, index: roundIndex(index) }],
    };
  }

  return best;
}

// ─── O que está vazio no território ──────────────────────────────────────────

/**
 * Os dois boxes da tela 05. O primeiro é sempre um buraco de horário; o segundo, um
 * elemento que funciona em OUTRO território e quase não aparece neste — que é o tipo
 * de coisa que ninguém enxerga sozinho.
 */
/** Faixas de madrugada: 0–4h e 4–8h. Ver `collectGaps`. */
const OVERNIGHT_SLOTS = new Set([0, 1]);

export function collectGaps(
  grid: TimeGrid,
  crossTerritoryHint: TerritoryGap | null,
): TerritoryGap[] {
  const gaps: TerritoryGap[] = [];

  // Madrugada fora: 0–4h e 4–8h estão vazias em TODO território, e não porque alguém
  // deixou passar uma oportunidade — é ninguém postar de madrugada. Os quatro
  // territórios da semana 29 exibiam "Dom 0–4h" no box de lacuna, gastando o espaço
  // com um não-achado. Buraco só é oportunidade em horário que as pessoas usam.
  const usable = grid.emptySlots.filter((slot) => !OVERNIGHT_SLOTS.has(slot.slot));
  // Fim de semana em horário nobre é o buraco mais interessante quando existe.
  const emptyWeekend = usable.find(
    (slot) => (slot.dayOfWeek === 6 || slot.dayOfWeek === 0) && slot.slot >= 2 && slot.slot <= 4,
  );
  const emptyAny = emptyWeekend ?? usable[0];
  if (emptyAny) {
    gaps.push({
      title: `${WEEKDAY_LABELS_SHORT[emptyAny.dayOfWeek]} ${grid.slotLabels[emptyAny.slot]}`,
      detail: "Ninguém postou nesse horário. Nenhum dado.",
    });
  }

  if (crossTerritoryHint) gaps.push(crossTerritoryHint);
  return gaps;
}

// ─── Montagem das quatro telas ───────────────────────────────────────────────

export interface CollectTerritoryParams {
  territoryId: string;
  territoryLabel: string;
  windowPosts: readonly ReportPost[];
  weekPostIds: ReadonlySet<string>;
  creators: Map<string, { name: string; handle: string | null }>;
  narratives: NarrativeSource | null;
  /** Snapshot de N semanas atrás, para a coluna de movimento. */
  previousElements: readonly { kind: string; key: string; rank: number }[] | null;
  movementWeeksBack: number;
  windowDays: number;
  windowLabel: string;
  /** Quantos criadores do território têm cada asset declarado no mapa. */
  assetFits: Map<string, number>;
  /**
   * Denominador do "cabe em": criadores que DECLARAM o território no mapa. Quando
   * ausente, cai para os criadores com post na janela.
   */
  fitsOutOf?: number;
  crossTerritoryHint: TerritoryGap | null;
}

export interface CollectedTerritory {
  tables: {
    assets: BuildRankingResult;
    assuntos: BuildRankingResult;
    tons: BuildRankingResult;
    horarios: BuildRankingResult;
    duracoes: BuildRankingResult;
    /** Padrões anônimos de abertura; nunca contém a frase de outro criador. */
    ganchos: BuildRankingResult;
    /** As abertas, lidas do vídeo — ver DIMENSION_READERS. */
    temas: BuildRankingResult;
    objetos: BuildRankingResult;
    falas: BuildRankingResult;
    locais: BuildRankingResult;
    enquadramentos: BuildRankingResult;
    esteticas: BuildRankingResult;
  };
  narratives: NarrativeEntry[];
  timeGrid: TimeGrid;
  durations: DurationBar[];
  topVideos: TopVideo[];
  matrix: MatrixRow[];
  strongCombination: StrongCombination | null;
  gaps: TerritoryGap[];
  territoryBaseline: Partial<Record<ReportMetric, number | null>>;
  weekPosts: ReportPost[];
  creatorsInWeek: number;
}

const MATRIX_COLUMNS: ReportMetric[] = [
  "curtidas",
  "comentarios",
  "compartilhamentos",
  "salvamentos",
  "retencao",
  "alcance",
];

export function collectTerritory(params: CollectTerritoryParams): CollectedTerritory {
  const {
    windowPosts,
    weekPostIds,
    creators,
    narratives,
    previousElements,
    movementWeeksBack,
    windowDays,
    windowLabel,
    assetFits,
    fitsOutOf,
    crossTerritoryHint,
  } = params;

  const isInWeek = (post: ReportPost) => weekPostIds.has(post.id);
  const weekPosts = windowPosts.filter(isInWeek);
  const creatorsInWeek = new Set(weekPosts.map((post) => post.creatorId)).size;

  const postObservations: ElementObservation[] = windowPosts.map((post) => ({
    key: post.id,
    label: post.id,
    creatorId: post.creatorId,
    inWeek: isInWeek(post),
    metrics: post.raw,
  }));
  const territoryBaseline = territoryBaselineFrom(postObservations);

  const previousRanksOf = (kind: ElementKind) => {
    if (!previousElements) return null;
    const map = new Map<string, number>();
    for (const element of previousElements) {
      if (element.kind === kind) map.set(element.key, element.rank);
    }
    return map.size > 0 ? map : null;
  };

  // Denominador do "cabe em": criadores do território na JANELA, não na semana.
  // Capacidade é uma noção de janela — "quantos conseguem fazer isso" não muda porque
  // metade deles não postou nesta semana. Com o denominador da semana o campo produzia
  // frações impossíveis (cabe em 11/8).
  const creatorsInWindow = new Set(windowPosts.map((post) => post.creatorId)).size;

  const common = {
    territoryBaseline,
    movementWeeksBack,
    windowDays,
    fitsOutOf: fitsOutOf ?? creatorsInWindow,
  };

  const assets = buildRankingTable({
    ...common,
    kind: "asset",
    title: "Assets de vida",
    sortedBy: "comentarios",
    columns: ["comentarios", "compartilhamentos", "salvamentos"],
    observations: observationsFor(windowPosts, "asset", isInWeek),
    previousRanks: previousRanksOf("asset"),
    fitsResolver: (key) => assetFits.get(key) ?? 0,
  });

  const assuntos = buildRankingTable({
    ...common,
    kind: "assunto",
    title: "Assuntos",
    sortedBy: "comentarios",
    columns: ["comentarios", "compartilhamentos"],
    observations: observationsFor(windowPosts, "assunto", isInWeek),
    previousRanks: previousRanksOf("assunto"),
    fitsResolver: (key) =>
      new Set(
        windowPosts.filter((post) => post.assuntos.includes(key)).map((post) => post.creatorId),
      ).size,
  });

  const tons = buildRankingTable({
    ...common,
    kind: "tom",
    title: "Tom de voz e formato",
    sortedBy: "engajamento",
    columns: ["engajamento", "retencao"],
    observations: observationsFor(windowPosts, "tom", isInWeek),
    previousRanks: previousRanksOf("tom"),
    fitsResolver: (key) =>
      new Set(windowPosts.filter((post) => post.tons.includes(key)).map((post) => post.creatorId))
        .size,
  });

  /** As tabelas abertas. Mesmo motor, mesma ordenação por força — só o vocabulário muda. */
  const openTable = (
    kind: OpenKind,
    title: string,
    sortedBy: ReportMetric,
    columns: ReportMetric[],
  ) =>
    buildRankingTable({
      ...common,
      kind,
      title,
      sortedBy,
      columns,
      observations: observationsFor(windowPosts, kind, isInWeek),
      previousRanks: previousRanksOf(kind),
      fitsResolver: (key) =>
        new Set(
          windowPosts
            .filter((post) => DIMENSION_READERS[kind](post).includes(key))
            .map((post) => post.creatorId),
        ).size,
    });

  const temas = openTable("tema", "Assuntos ditos", "comentarios", ["comentarios", "compartilhamentos"]);
  const objetos = openTable("objeto", "Objetos em cena", "comentarios", ["comentarios", "salvamentos"]);
  const falas = openTable("fala", "Frases ditas", "comentarios", ["comentarios", "retencao"]);
  const locais = openTable("local", "Onde foi gravado", "comentarios", ["comentarios", "engajamento"]);
  const enquadramentos = openTable("enquadramento", "Enquadramento", "retencao", ["retencao", "engajamento"]);
  const esteticas = openTable("estetica", "Estética", "retencao", ["retencao", "engajamento"]);

  const horarios = buildRankingTable({
    ...common,
    kind: "horario",
    title: "Dia e horário",
    sortedBy: "engajamento",
    columns: ["engajamento", "comentarios"],
    observations: timeObservations(windowPosts, isInWeek),
    previousRanks: previousRanksOf("horario"),
  });

  const duracoes = buildRankingTable({
    ...common,
    kind: "duracao",
    title: "Duração",
    sortedBy: "comentarios",
    columns: ["comentarios", "retencao"],
    observations: durationObservations(windowPosts, isInWeek),
    previousRanks: previousRanksOf("duracao"),
  });

  const ganchos = buildRankingTable({
    ...common,
    kind: "gancho",
    title: "Padrões de gancho",
    sortedBy: "retencao",
    columns: ["retencao", "engajamento", "compartilhamentos"],
    observations: hookPatternObservations(windowPosts, isInWeek),
    previousRanks: previousRanksOf("gancho"),
    fitsResolver: (key) =>
      new Set(
        windowPosts
          .filter((post) => {
            const opening = post.openingLine?.trim() || post.screenTitle?.trim();
            return opening ? classifyCreatorHookPattern(opening) === key : false;
          })
          .map((post) => post.creatorId),
      ).size,
  });

  // A leitura em português de cada tabela, do mesmo número que ela mostra — e o nome de
  // quem produziu a linha, que o motor não tem como saber (ele só conhece id).
  const withReading = <T extends BuildRankingResult>(table: T): T => ({
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      sampleCreatorName: row.sampleCreatorId
        ? (creators.get(row.sampleCreatorId)?.name ?? null)
        : null,
    })),
    reading: describeTable(table.rows, table.sortedBy, params.territoryLabel),
  });

  const timeGrid = collectTimeGrid(windowPosts);
  const tables = {
    assets: withReading(assets),
    assuntos: withReading(assuntos),
    tons: withReading(tons),
    horarios: withReading(horarios),
    duracoes: withReading(duracoes),
    ganchos: withReading(ganchos),
    temas: withReading(temas),
    objetos: withReading(objetos),
    falas: withReading(falas),
    locais: withReading(locais),
    enquadramentos: withReading(enquadramentos),
    esteticas: withReading(esteticas),
  };

  return {
    tables,
    narratives: collectNarratives(weekPosts, narratives),
    timeGrid,
    durations: collectDurations(windowPosts),
    topVideos: collectTopVideos(weekPosts, territoryBaseline, creators),
    matrix: collectMatrix(
      [tables.assuntos, tables.tons, tables.assets, tables.horarios, tables.duracoes],
      MATRIX_COLUMNS,
    ),
    strongCombination: collectStrongCombination(
      windowPosts,
      territoryBaseline,
      "comentarios",
      windowLabel,
    ),
    gaps: collectGaps(timeGrid, crossTerritoryHint),
    territoryBaseline,
    weekPosts,
    creatorsInWeek,
  };
}

export { MATRIX_COLUMNS, intensityOf, labelForDimension };
export type { BuildRankingResult };
