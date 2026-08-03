/**
 * rankingEngine.ts — a tabela de ranking do relatório.
 *
 * Implementa os sete padrões do §6 do briefing, que é o que faz o relatório valer:
 *
 *   1. Linha do 1,0×      → todo valor é índice sobre a média do território (na janela)
 *   2. Coluna de movimento → posição desta semana vs. a de 3 semanas atrás
 *   3. Duas metades        → índice < 1,0 na métrica de ordenação vai para baixo
 *   4. Coluna "cabe em"    → quantos criadores do território conseguem fazer aquilo
 *   5. Ocorrências na linha→ `visto 19×` na semana, e o histórico que dá lastro
 *   6. Ordenação declarada→ a tabela carrega o `sortedBy` que o documento imprime
 *   7. Escala igual        → responsabilidade do template; aqui a saída é só o índice
 *
 * NÃO HÁ MAIS CORTE. Havia, e ele protegia contra um problema real — um criador
 * prolífico virando "tendência do território", que a Regra 2 proíbe. Mas ele resolvia
 * isso excluindo linhas, e um relatório semanal que só mostra o que passa num portão
 * estatístico é quase igual toda semana, porque o estável é justamente o que passa.
 *
 * A mesma proteção agora vem do PESO: a linha aparece sempre, e o quanto ela se repetiu
 * decide a posição dela. Dois posts da mesma pessoa continuam sem liderar a tabela —
 * só que agora aparecem, marcados como indício. Ver `weight.ts`.
 */

import { medianOf, percentileOf, roundIndex } from "./postMetrics";
import { REPORT_METRICS } from "./types";
import { effectiveSampleSize, evidenceLevelOf, forceOf } from "./weight";
import type {
  ElementKind,
  MetricIndex,
  Movement,
  RankingRow,
  RankingTable,
  ReportMetric,
} from "./types";

/** Uma aparição de um elemento em um post. */
export interface ElementObservation {
  /** Chave estável entre semanas. */
  key: string;
  label: string;
  creatorId: string;
  /** true quando o post é da semana do relatório. */
  inWeek: boolean;
  /** Métricas cruas do post (retenção já convertida em índice de linha de base). */
  metrics: Partial<Record<ReportMetric, number | null>>;
  /** Visualizações absolutas, preservadas para comparações editoriais de horário. */
  views?: number | null;
}

/**
 * O corte foi REMOVIDO. Ver `weight.ts` para a razão inteira; em uma frase: quatro
 * portões (8 aparições, 3 criadores, 2 na semana, 2 criadores na semana) faziam o
 * relatório ser quase igual toda semana e sumiam com o detalhe visto uma vez, que é
 * interessante — só não é interessante como tendência. A frequência agora não decide
 * SE a linha aparece, decide ONDE ela aparece.
 *
 * Sobra um único requisito, e ele não é estatístico: a linha precisa ter aparecido pelo
 * menos uma vez NA SEMANA. O relatório é da semana; o que não aconteceu nela vai para
 * `absentThisWeek`, que é outra informação.
 */
export const MIN_WEEK_OCCURRENCES = 1;

/**
 * Teto de linhas por tabela.
 *
 * Era { above: 5, below: 3 } porque a entrega era um slide de altura fixa. A entrega
 * virou um documento com páginas, e num documento a tabela corre inteira — é ela que
 * carrega a riqueza que o relatório precisa ter para ser diferente toda semana. O teto
 * fica só como defesa contra o absurdo; quem renderiza slide passa o seu.
 */
export const DEFAULT_ROW_LIMITS = { above: 200, below: 200 };

export interface BuildRankingParams {
  kind: ElementKind;
  title: string;
  sortedBy: ReportMetric;
  columns: ReportMetric[];
  observations: readonly ElementObservation[];
  /** Base (mediana) do território por métrica na semana. Denominador do 1,0×. */
  territoryBaseline: Partial<Record<ReportMetric, number | null>>;
  /** Ranking congelado de 3 semanas atrás: chave → posição. */
  previousRanks?: Map<string, number> | null;
  movementWeeksBack?: number;
  /** Quantos criadores do território conseguem fazer cada elemento. */
  fitsResolver?: (key: string) => number;
  /** Criadores ativos no território na semana — denominador do "cabe em". */
  fitsOutOf?: number;
  rowLimits?: { above: number; below: number };
}

interface Aggregate {
  key: string;
  label: string;
  weekOccurrences: number;
  weekCreators: Set<string>;
  sampleCreatorId: string | null;
  windowOccurrences: number;
  windowCreators: Set<string>;
  weekMetricValues: Map<ReportMetric, (number | null)[]>;
  windowMetricValues: Map<ReportMetric, (number | null)[]>;
  weekViews: (number | null)[];
}

function pushMetric(
  target: Map<ReportMetric, (number | null)[]>,
  metrics: Partial<Record<ReportMetric, number | null>>,
) {
  for (const [metric, value] of Object.entries(metrics) as [ReportMetric, number | null][]) {
    const list = target.get(metric) ?? [];
    list.push(value ?? null);
    target.set(metric, list);
  }
}

/**
 * Percentil em que os valores da semana são aparados antes de agregar.
 *
 * Winsorização, e ela é necessária: as métricas do relatório são de cauda pesada.
 * Na matriz gerada com dado real apareceu "alcance 148×" — um post que alcançou 148
 * vezes a base do próprio criador. É um fato verdadeiro SOBRE AQUELE POST, e virou
 * propriedade do elemento "Qua 16–20h" porque foi o único post da semana naquela
 * faixa. Aparar no p90 do território preserva a direção do sinal (o post continua
 * sendo o mais alto da distribuição) sem deixar um evento definir a linha.
 *
 * Não usar `Math.min` com um teto fixo: o teto tem que vir da distribuição da própria
 * semana, senão em territórios com dinâmica diferente ele apara sinal legítimo.
 */
export const WINSOR_PERCENTILE = 0.9;

/** Tetos por métrica, calculados sobre os valores DA SEMANA no território. */
function winsorCaps(
  observations: readonly ElementObservation[],
): Partial<Record<ReportMetric, number | null>> {
  const buckets = new Map<ReportMetric, (number | null)[]>();
  for (const observation of observations) {
    if (!observation.inWeek) continue;
    pushMetric(buckets, observation.metrics);
  }
  const caps: Partial<Record<ReportMetric, number | null>> = {};
  for (const [metric, values] of buckets) {
    caps[metric] = percentileOf(values, WINSOR_PERCENTILE);
  }
  return caps;
}

function clampMetrics(
  metrics: Partial<Record<ReportMetric, number | null>>,
  caps: Partial<Record<ReportMetric, number | null>>,
): Partial<Record<ReportMetric, number | null>> {
  const clamped: Partial<Record<ReportMetric, number | null>> = {};
  for (const [metric, value] of Object.entries(metrics) as [ReportMetric, number | null][]) {
    const cap = caps[metric];
    clamped[metric] =
      value !== null && cap !== null && cap !== undefined && value > cap ? cap : value;
  }
  return clamped;
}

function aggregate(
  observations: readonly ElementObservation[],
  caps: Partial<Record<ReportMetric, number | null>>,
): Map<string, Aggregate> {
  const byKey = new Map<string, Aggregate>();

  for (const raw of observations) {
    const observation: ElementObservation = raw.inWeek
      ? { ...raw, metrics: clampMetrics(raw.metrics, caps) }
      : raw;
    const entry: Aggregate =
      byKey.get(observation.key) ??
      {
        key: observation.key,
        label: observation.label,
        weekOccurrences: 0,
        weekCreators: new Set(),
        sampleCreatorId: null,
        windowOccurrences: 0,
        windowCreators: new Set(),
        weekMetricValues: new Map(),
        windowMetricValues: new Map(),
        weekViews: [],
      };

    entry.windowOccurrences += 1;
    entry.windowCreators.add(observation.creatorId);
    pushMetric(entry.windowMetricValues, observation.metrics);

    if (observation.inWeek) {
      entry.weekOccurrences += 1;
      entry.weekCreators.add(observation.creatorId);
      entry.sampleCreatorId ??= observation.creatorId;
      pushMetric(entry.weekMetricValues, observation.metrics);
      entry.weekViews.push(observation.views ?? null);
      // O rótulo da semana ganha: se a IA mudou de nome, o slide mostra o atual.
      entry.label = observation.label;
    }

    byKey.set(observation.key, entry);
  }

  return byKey;
}

/**
 * A base do território por métrica — o denominador da linha do 1,0×.
 *
 * Duas decisões, as duas medidas contra dado real:
 *
 * 1. Só as observações DA SEMANA. Com denominador de 90 dias, uma semana em que o
 *    território caiu joga TODA linha abaixo de 1,0 e a risca preta deixa de separar
 *    "puxa pra cima" de "puxa pra baixo" — passa a dizer só "a semana foi pior que o
 *    trimestre", que a variação do cabeçalho já diz. A comparação entre semanas não se
 *    perde: mora na coluna de movimento, que compara POSIÇÃO.
 *
 * 2. MEDIANA, não média. Com 3 a 10 posts por elemento, a média é dominada por um
 *    post viral: na primeira matriz gerada com dado real apareceram "alcance 6,6×" e
 *    "comentários 8,4×", que não descrevem o elemento, descrevem um post. A mediana diz
 *    "o post típico com este elemento foi 2,7× o post típico do território" — que é a
 *    frase que a reunião consegue usar.
 */
export function territoryBaselineFrom(
  observations: readonly ElementObservation[],
): Partial<Record<ReportMetric, number | null>> {
  const buckets = new Map<ReportMetric, (number | null)[]>();
  for (const observation of observations) {
    if (!observation.inWeek) continue;
    pushMetric(buckets, observation.metrics);
  }
  const baseline: Partial<Record<ReportMetric, number | null>> = {};
  for (const [metric, values] of buckets) {
    baseline[metric] = medianOf(values);
  }
  return baseline;
}

/** Índice: mediana do elemento ÷ mediana do território. Ver territoryBaselineFrom. */
function indexOf(
  values: (number | null)[] | undefined,
  territoryBaseline: number | null | undefined,
): number | null {
  const median = medianOf(values ?? []);
  if (median === null) return null;
  if (territoryBaseline === null || territoryBaseline === undefined || territoryBaseline <= 0) {
    return null;
  }
  return median / territoryBaseline;
}

function movementFor(
  key: string,
  currentRank: number,
  previousRanks: Map<string, number> | null | undefined,
  weeksBack: number,
): Movement | null {
  if (!previousRanks) return null;
  const previous = previousRanks.get(key);
  if (previous === undefined) {
    return { kind: "new", delta: 0, comparedWeeksBack: weeksBack };
  }
  const delta = previous - currentRank;
  if (Math.abs(delta) <= 1) return { kind: "stable", delta: 0, comparedWeeksBack: weeksBack };
  return {
    kind: delta > 0 ? "up" : "down",
    delta: Math.abs(delta),
    comparedWeeksBack: weeksBack,
  };
}

const RANKING_NOTE =
  "Tudo o que aconteceu na semana está aqui. A ordem leva em conta quantas vezes " +
  "o elemento se repetiu: visto poucas vezes é indício, visto muitas é tendência.";

export interface BuildRankingResult extends RankingTable {
  /** Elementos elegíveis que ficaram fora por limite de linhas — vai pra matriz. */
  overflow: RankingRow[];
  /** Elegíveis mas sem nenhuma aparição na semana — sem número pra mostrar. */
  absentThisWeek: string[];
}

/**
 * Forma mínima de uma linha que pode entrar no ranking. O contrato é exportado para
 * que o render use exatamente o mesmo comparador ao trocar as colunas visíveis de uma
 * tabela (por exemplo, a leitura de ressonância por engajamento).
 */
export interface RankingComparable {
  key: string;
  label: string;
  occurrences: number;
  creators: number;
  metrics: readonly MetricIndex[];
  /** Índice não arredondado da métrica principal, quando ainda estamos no motor. */
  primaryIndex?: number;
}

function metricIndexOf(row: RankingComparable, metric: ReportMetric, primary: ReportMetric): number | null {
  if (metric === primary && row.primaryIndex !== undefined) return row.primaryIndex;
  return row.metrics.find((entry) => entry.metric === metric)?.index ?? null;
}

/**
 * O comparador único das listas do relatório.
 *
 * 1. A métrica declarada continua sendo a principal.
 * 2. Empates usam, na ordem, as outras métricas que a tabela mostra.
 * 3. Cada comparação usa a mesma força bayesiana e o mesmo teto por criador.
 * 4. Só depois entram lastro coletivo, ocorrências e rótulo — nunca o alfabeto antes
 *    do desempenho visível.
 *
 * Assim duas linhas com 1,7× de engajamento não caem em ordem alfabética: comentários
 * e compartilhamentos decidem. As linhas abaixo de 1,0× permanecem depois da risca e
 * são ordenadas da queda mais forte para a mais leve, como no desenho original.
 */
export function compareRankingRows(
  a: RankingComparable,
  b: RankingComparable,
  primary: ReportMetric,
  visibleMetrics: readonly ReportMetric[],
): number {
  const metrics = [primary, ...visibleMetrics.filter((metric) => metric !== primary)];
  const primaryA = metricIndexOf(a, primary, primary);
  const primaryB = metricIndexOf(b, primary, primary);
  const downA = primaryA !== null && primaryA < 1;
  const downB = primaryB !== null && primaryB < 1;
  if (downA !== downB) return downA ? 1 : -1;

  const sampleA = effectiveSampleSize(a.occurrences, a.creators);
  const sampleB = effectiveSampleSize(b.occurrences, b.creators);
  for (const metric of metrics) {
    const indexA = metricIndexOf(a, metric, primary);
    const indexB = metricIndexOf(b, metric, primary);
    if (indexA === null && indexB === null) continue;
    if (indexA === null) return 1;
    if (indexB === null) return -1;
    const forceA = forceOf(indexA, sampleA);
    const forceB = forceOf(indexB, sampleB);
    if (Math.abs(forceA - forceB) <= 1e-9) continue;
    if (metric === primary && downA && downB) return forceA - forceB;
    return forceB - forceA;
  }

  if (b.creators !== a.creators) return b.creators - a.creators;
  if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
  return a.label.localeCompare(b.label, "pt-BR") || a.key.localeCompare(b.key);
}

/** Amostra efetiva da semana: posts limitados por pessoas. Ver weight.ts. */
function sampleOf(entry: Aggregate): number {
  return effectiveSampleSize(entry.weekOccurrences, entry.weekCreators.size);
}

/**
 * Monta a tabela. Recebe observações já filtradas para um território, contendo a
 * janela inteira com `inWeek` marcado — a função não conhece banco nem datas.
 */
export function buildRankingTable(
  params: BuildRankingParams & { windowDays?: number },
): BuildRankingResult {
  const {
    kind,
    title,
    sortedBy,
    columns,
    observations,
    territoryBaseline,
    previousRanks = null,
    movementWeeksBack = 3,
    fitsResolver,
    fitsOutOf = 0,
    rowLimits = DEFAULT_ROW_LIMITS,
    windowDays = 90,
  } = params;

  const caps = winsorCaps(observations);
  const aggregates = [...aggregate(observations, caps).values()];
  const absentThisWeek: string[] = [];

  // Único requisito, e não é estatístico: aconteceu nesta semana. O que só existe no
  // histórico é outra informação — vai para `absentThisWeek`, que alimenta o bloco
  // "sumiu esta semana" do documento.
  const eligible = aggregates.filter((entry) => {
    if (entry.weekOccurrences < MIN_WEEK_OCCURRENCES) {
      absentThisWeek.push(entry.key);
      return false;
    }
    return true;
  });

  const scored = eligible
    .map((entry) => {
      // Calcula TODAS as métricas, não só as colunas que esta tabela mostra. A matriz
      // da tela 4 reaproveita estas mesmas linhas com seis colunas — restringir aqui
      // fazia a matriz sair esburacada, com "—" na maioria das células. O template
      // filtra por `columns` na hora de desenhar.
      const metrics: MetricIndex[] = [];
      for (const metric of REPORT_METRICS) {
        const index = indexOf(entry.weekMetricValues.get(metric), territoryBaseline[metric]);
        if (index !== null) metrics.push({ metric, index: roundIndex(index) });
      }
      const sortIndex = indexOf(entry.weekMetricValues.get(sortedBy), territoryBaseline[sortedBy]);
      return { entry, metrics, sortIndex };
    })
    // Sem valor na métrica de ordenação não há como posicionar a linha.
    .filter((scored): scored is typeof scored & { sortIndex: number } => scored.sortIndex !== null)
    .sort((a, b) => compareRankingRows(
      {
        key: a.entry.key,
        label: a.entry.label,
        occurrences: a.entry.weekOccurrences,
        creators: a.entry.weekCreators.size,
        metrics: a.metrics,
        primaryIndex: a.sortIndex,
      },
      {
        key: b.entry.key,
        label: b.entry.label,
        occurrences: b.entry.weekOccurrences,
        creators: b.entry.weekCreators.size,
        metrics: b.metrics,
        primaryIndex: b.sortIndex,
      },
      sortedBy,
      columns,
    ));

  const rows: RankingRow[] = scored.map((item, position) => {
    const rank = position + 1;
    return {
      kind,
      key: item.entry.key,
      label: item.entry.label,
      occurrences: item.entry.weekOccurrences,
      creators: item.entry.weekCreators.size,
      occurrencesInWindow: item.entry.windowOccurrences,
      metrics: item.metrics,
      medianViews: (() => {
        const value = medianOf(item.entry.weekViews);
        return value === null ? null : Math.round(value);
      })(),
      movement: movementFor(item.entry.key, rank, previousRanks, movementWeeksBack),
      fitsCount: fitsResolver ? fitsResolver(item.entry.key) : 0,
      fitsOutOf,
      // O nome antigo era `belowCut` e mentia depois que o corte saiu: a linha não está
      // "abaixo do corte", ela puxa PARA BAIXO. As duas metades da tabela são as duas
      // direções do 1,0×, não incluída e excluída.
      pullsDown: item.sortIndex < 1,
      evidence: evidenceLevelOf(sampleOf(item.entry)),
      sampleCreatorId: item.entry.sampleCreatorId,
      // O nome não existe aqui: o motor não conhece criador, só id. Ver collectTerritory.
      sampleCreatorName: null,
    };
  });

  const above = rows.filter((row) => !row.pullsDown);
  const below = rows.filter((row) => row.pullsDown);
  const kept = [...above.slice(0, rowLimits.above), ...below.slice(0, rowLimits.below)];
  const keptKeys = new Set(kept.map((row) => row.key));

  return {
    kind,
    title,
    sortedBy,
    columns,
    rows: kept,
    // Preenchida pelo coletor, que conhece o rótulo do território. Ver describeFinding.
    reading: null,
    cutoffNote: RANKING_NOTE,
    overflow: rows.filter((row) => !keptKeys.has(row.key)),
    absentThisWeek,
  };
}

/** Extrai o mapa chave → posição de um snapshot congelado, para o movimento. */
export function previousRanksFrom(
  elements: readonly { kind: string; key: string; rank: number }[] | null | undefined,
  kind: ElementKind,
): Map<string, number> | null {
  if (!elements || elements.length === 0) return null;
  const map = new Map<string, number>();
  for (const element of elements) {
    if (element.kind !== kind) continue;
    map.set(element.key, element.rank);
  }
  return map.size > 0 ? map : null;
}
