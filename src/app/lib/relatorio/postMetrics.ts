/**
 * postMetrics.ts — do documento Metric para as sete métricas do relatório.
 *
 * A única aqui que não é leitura direta é a RETENÇÃO. A API do Instagram não entrega
 * curva; entrega `ig_reels_avg_watch_time` (em MILISSEGUNDOS) e `video_duration`. A
 * razão entre os dois dá a retenção crua — e retenção crua não é comparável entre
 * durações: na base real ela cai de 0,73 (0–15s) para 0,17 (90s+). Ranquear por
 * retenção crua é ranquear quem faz vídeo curto.
 *
 * Então a métrica do relatório é retenção RELATIVA À LINHA DE BASE da duração
 * (§8 do briefing): quanto o vídeo ficou acima do esperado para o tamanho dele.
 * Ver retentionBaseline.ts.
 */

import type { ReportMetric } from "./types";

export interface DurationBucket {
  /** Chave estável, usada na linha de base e no elemento "duracao". */
  key: string;
  label: string;
  minSeconds: number;
  /** null = sem teto. */
  maxSeconds: number | null;
}

/** Faixas do mock. Fixas: mudá-las invalida as linhas de base já gravadas. */
export const DURATION_BUCKETS: readonly DurationBucket[] = [
  { key: "0-15", label: "0–15s", minSeconds: 0, maxSeconds: 15 },
  { key: "15-30", label: "15–30s", minSeconds: 15, maxSeconds: 30 },
  { key: "30-60", label: "30–60s", minSeconds: 30, maxSeconds: 60 },
  { key: "60-90", label: "60–90s", minSeconds: 60, maxSeconds: 90 },
  { key: "90+", label: "90s+", minSeconds: 90, maxSeconds: null },
] as const;

export function durationBucketFor(seconds: number | null | undefined): DurationBucket | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  for (const bucket of DURATION_BUCKETS) {
    if (seconds >= bucket.minSeconds && (bucket.maxSeconds === null || seconds < bucket.maxSeconds)) {
      return bucket;
    }
  }
  return null;
}

/** Um post normalizado, do jeito que todo o motor do relatório consome. */
export interface ReportPost {
  id: string;
  creatorId: string;
  postDate: Date;
  /**
   * Território do post: o território PRIMÁRIO do mapa de quem postou.
   *
   * Vem do card "Seu Mapa", não da classificação da legenda. Um pai que posta uma
   * receita continua sendo Paternidade nesta semana — território é propriedade do
   * criador, declarada e confirmada no mapa.
   */
  territoryId: string | null;
  /**
   * Território que a classificação do POST sugere (do `context`, ou seja, da legenda).
   * Não define nada; é evidência de que o mapa pode estar desatualizado.
   */
  observedTerritoryId: string | null;
  /**
   * Métricas do post. `retencao` começa crua (0–1) e é REESCRITA para índice de
   * linha de base por `applyRetentionBaseline` — daí pra frente é comparável entre
   * durações e entra nos rankings como as outras seis.
   */
  raw: Partial<Record<ReportMetric, number | null>>;
  /**
   * As contagens ABSOLUTAS, como o Instagram mostra.
   *
   * `raw` guarda TAXAS (curtidas por pessoa alcançada), que é o certo para comparar
   * criadores de tamanhos diferentes — mas é ilegível para a pessoa: "0,008" não diz
   * nada, e arredondar dá zero. Para falar com o criador na língua dele ("você costuma
   * fazer 12 compartilhamentos, este fez 350") o número absoluto é o único que serve.
   */
  absolute: Partial<Record<
    "curtidas" | "comentarios" | "compartilhamentos" | "salvamentos" | "alcance" | "visualizacoes",
    number | null
  >>;
  /**
   * Retenção CRUA preservada, nunca reescrita.
   *
   * Existe porque as duas leituras são necessárias e são diferentes: o ranking de
   * ASSUNTO/TOM tem que usar a retenção corrigida (senão premia quem faz vídeo curto),
   * mas o gráfico de DURAÇÃO tem que usar a crua — é ele que responde "que tamanho eu
   * faço", e corrigir por duração ali achataria justamente a divergência que o gráfico
   * existe para mostrar.
   */
  rawRetentionValue: number | null;
  durationSeconds: number | null;
  durationBucket: string | null;
  /** Dimensões classificadas, já em rótulo humano quando disponível. */
  assuntos: string[];
  tons: string[];
  formatos: string[];
  assets: string[];
  /**
   * As dimensões ABERTAS, lidas do vídeo em vez de agrupadas do mapa.
   *
   * São elas que dão ao relatório o detalhe que faz uma semana ser diferente da
   * outra: "voltar a trabalhar depois da licença" no lugar de "Criar filho", "caneca"
   * no lugar de "objeto do cotidiano". Ver sceneEvaluation.ts.
   */
  temas: string[];
  objetos: string[];
  falas: string[];
  /** Cômodo ou lugar, de vocabulário global fechado. */
  local: string | null;
  enquadramentos: string[];
  esteticas: string[];
  /** Texto na tela e primeira fala — o gancho, para a tabela de melhores vídeos. */
  screenTitle: string | null;
  openingLine: string | null;
  /**
   * true quando o vídeo chegou a ser assistido pela IA.
   *
   * Existe para o relatório saber a diferença entre "não aconteceu" e "não foi lido".
   * São coisas opostas e a tabela vazia é idêntica nas duas: Treino saiu com quatro
   * telas em branco na primeira execução, e a causa era que NENHUM dos 4 criadores tem
   * o Instagram conectado — sem token não há mp4, sem mp4 não há leitura. Sem este
   * campo o relatório acusa o território de não ter feito nada.
   */
  sceneRead: boolean;
  postLink: string | null;
  thumbnailUrl: string | null;
  description: string;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegative(value: unknown): number | null {
  const n = finite(value);
  return n !== null && n >= 0 ? n : null;
}

/**
 * Retenção crua: tempo médio assistido ÷ duração. O campo da API vem em ms.
 * Devolve null quando falta qualquer um dos dois — nunca 0, que seria lido como
 * "assistiu nada" em vez de "não sabemos".
 */
export function rawRetention(stats: Record<string, unknown> | null | undefined): number | null {
  const watchMs = nonNegative(stats?.ig_reels_avg_watch_time);
  const duration = nonNegative(stats?.video_duration_seconds);
  if (watchMs === null || duration === null || duration <= 0) return null;
  const ratio = watchMs / 1000 / duration;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  // Trava em 1: repetição de reel faz o tempo médio passar da duração, e uma
  // retenção de 1,4 quebraria a leitura de "assistiu até o fim".
  return Math.min(ratio, 1);
}

/**
 * Engajamento. Prefere a taxa já calculada por formulas.ts; cai para
 * interações ÷ alcance. Taxa e não valor absoluto: o relatório compara criadores
 * de tamanhos muito diferentes.
 */
export function engagementRate(stats: Record<string, unknown> | null | undefined): number | null {
  const stored = nonNegative(stats?.engagement_rate_on_reach);
  if (stored !== null && stored > 0) return stored;
  const interactions = nonNegative(stats?.total_interactions);
  const reach = nonNegative(stats?.reach);
  if (interactions === null || reach === null || reach <= 0) return null;
  return interactions / reach;
}

/**
 * Alcance mínimo para uma TAXA ser medível.
 *
 * Um post com alcance 10 e 3 compartilhamentos dá taxa 0,30 contra uma típica de
 * 0,005 — sessenta vezes a base, não porque o vídeo é bom, mas porque o denominador
 * é ruído. Abaixo deste piso as taxas saem null: o post entra na contagem, não no
 * ranking. Apareceu na matriz gerada com dado real, como "compartilhamentos 8,1×".
 */
export const MIN_REACH_FOR_RATE = 100;

/**
 * As sete métricas cruas de um post. Curtidas/comentários/compartilhamentos/
 * salvamentos entram normalizados por alcance — sem isso, o ranking do território
 * é dominado por quem tem mais seguidor, não por quem escolheu melhor o elemento.
 *
 * `alcance` sai como valor ABSOLUTO aqui e é convertido em índice por
 * `applyCreatorReachBaseline`: alcance varia três ordens de grandeza entre criadores,
 * então só faz sentido comparado com o alcance típico do PRÓPRIO criador.
 */
/** As contagens como vieram da API, sem virar taxa. */
export function extractAbsoluteMetrics(
  stats: Record<string, unknown> | null | undefined,
): ReportPost["absolute"] {
  const views = nonNegative(stats?.views) ?? nonNegative(stats?.video_views);
  return {
    curtidas: nonNegative(stats?.likes),
    comentarios: nonNegative(stats?.comments),
    compartilhamentos: nonNegative(stats?.shares),
    salvamentos: nonNegative(stats?.saved),
    alcance: nonNegative(stats?.reach),
    visualizacoes: views,
  };
}

export function extractRawMetrics(
  stats: Record<string, unknown> | null | undefined,
): Partial<Record<ReportMetric, number | null>> {
  const reach = nonNegative(stats?.reach);
  const measurable = reach !== null && reach >= MIN_REACH_FOR_RATE;
  const perReach = (value: number | null): number | null => {
    if (value === null || !measurable) return null;
    return value / reach!;
  };

  return {
    curtidas: perReach(nonNegative(stats?.likes)),
    comentarios: perReach(nonNegative(stats?.comments)),
    compartilhamentos: perReach(nonNegative(stats?.shares)),
    salvamentos: perReach(nonNegative(stats?.saved)),
    retencao: rawRetention(stats),
    alcance: reach,
    engajamento: measurable ? engagementRate(stats) : null,
  };
}

/** Média aritmética ignorando null. Devolve null se não sobrar nada. */
export function meanOf(values: readonly (number | null)[]): number | null {
  const usable = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (usable.length === 0) return null;
  return usable.reduce((sum, v) => sum + v, 0) / usable.length;
}

/**
 * Mediana ignorando null. É a estatística de base do relatório onde a amostra é
 * pequena: com n=8 um único reel viral move a média e não move a mediana.
 */
export function medianOf(values: readonly (number | null)[]): number | null {
  const usable = values
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (usable.length === 0) return null;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 === 0
    ? (usable[middle - 1]! + usable[middle]!) / 2
    : usable[middle]!;
}

/**
 * Percentil (0–1) de uma lista, ignorando null. Interpolação linear.
 * Base da winsorização do ranking — ver `WINSOR_PERCENTILE`.
 */
export function percentileOf(values: readonly (number | null)[], p: number): number | null {
  const usable = values
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (usable.length === 0) return null;
  if (usable.length === 1) return usable[0]!;
  const position = (usable.length - 1) * Math.min(1, Math.max(0, p));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return usable[lower]!;
  return usable[lower]! + (usable[upper]! - usable[lower]!) * (position - lower);
}

/** Arredonda para uma decimal — a precisão que o slide mostra ("2,7×"). */
export function roundIndex(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Formata índice no padrão do slide: vírgula decimal e sufixo "×". */
export function formatIndex(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${roundIndex(value).toFixed(1).replace(".", ",")}×`;
}
