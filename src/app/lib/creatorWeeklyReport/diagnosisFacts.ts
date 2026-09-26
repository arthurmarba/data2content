// src/app/lib/creatorWeeklyReport/diagnosisFacts.ts
//
// Os fatos que o diagnóstico da semana pode usar — e nada além deles.
//
// O modelo não lê o relatório inteiro: recebe um pacote pequeno, já decidido pelo
// cálculo. O que é regra e o que ainda é aposta sai de `patternSections` (a mesma
// régua que separava os cartões); a frase de ação sai de `patternActions`; as
// palavras de território, narrativa e asset saem do mapa. O modelo junta, não
// descobre.
//
// Esse pacote também é a trava contra número inventado: todo número que aparecer
// no texto precisa existir aqui (`allowedNumbers`). E fica guardado junto do
// diagnóstico, como a evidência por trás de cada frase.

import { buildPatternHighlights } from "./patternHighlights";
import { buildPatternSections, type PatternSectionCard } from "./patternSections";
import type { CreatorWeeklyReportPayload } from "./types";

/** Janela de comparação. Vai nos fatos porque o texto pode dizê-la ("seus 90 dias"). */
export const DIAGNOSIS_WINDOW_DAYS = 90;

/** Dias até um post parar de acumular números. Antes disso, número baixo não é queda. */
export const DIAGNOSIS_MATURITY_DAYS = 7;

/** Abaixo disso não há o que comparar, e o diagnóstico não é escrito. */
export const DIAGNOSIS_MIN_POSTS_90D = 3;

const MAX_PATTERNS_PER_SECTION = 4;

/** O mapa, só com as palavras que o texto pode usar. */
export interface DiagnosisMapInput {
  narrative: string | null;
  narrativeIsFirm: boolean;
  territories: string[];
  assets: string[];
  tone: string | null;
}

export interface DiagnosisPatternFact {
  /** A dimensão pela palavra da tela: "Onde", "Dia", "Gancho". */
  dimensao: string;
  /** A resposta do ranking: "Cozinha", "Qui". */
  resposta: string;
  /** A resposta dita como ação: "Grave em cozinha". */
  acao: string;
  /** Multiplicador contra a mediana própria, já formatado: "2,3×". */
  indice: string;
  /** Posts que sustentam a resposta nos 90 dias. */
  posts: number;
  /** Quantos posts da semana fechada repetiram esta resposta. */
  vezesNaSemana: number;
  /** A métrica que o índice compara, quando o motor informou. */
  metrica: "compartilhamentos" | "salvamentos" | "visualizações" | null;
}

export interface DiagnosisFacts {
  semana: { rotulo: string; postsNaSemana: number };
  janelaDias: number;
  maturidadeDias: number;
  cobertura: { postsNos90Dias: number; postsComCenaLida: number };
  mapa: {
    narrativa: string | null;
    narrativaFirme: boolean;
    territorios: string[];
    assets: string[];
    tom: string | null;
  } | null;
  padroes: {
    /** Já se repetiram o bastante para virar decisão. */
    regras: DiagnosisPatternFact[];
    /** Renderam acima do normal, mas em poucos posts: aposta. */
    testes: DiagnosisPatternFact[];
    /** Dimensões lidas em que nada passou do normal ainda. */
    semResposta: Array<{ dimensao: string; postsLidos: number }>;
  };
  /**
   * Assuntos que a leitura reconheceu nos posts, com as palavras da leitura.
   * Servem para ligar um padrão a um território do mapa quando a ligação é
   * evidente pelas palavras — não para criar território novo.
   */
  assuntosObservados: string[];
  /** O post da semana que mais rendeu contra o próprio normal. */
  melhorPostDaSemana: {
    assunto: string | null;
    cenario: string | null;
    abertura: string | null;
    indice: string | null;
    diasDesdeAPublicacao: number;
  } | null;
  /** Só para não repetir a mesma manchete duas semanas seguidas. */
  manchetePassada: string | null;
}

const METRIC_LABEL = {
  shares: "compartilhamentos",
  saved: "salvamentos",
  views: "visualizações",
} as const;

export function formatDiagnosisIndex(index: number | null | undefined): string | null {
  if (typeof index !== "number" || !Number.isFinite(index)) return null;
  return `${index.toFixed(1).replace(".", ",")}×`;
}

function comparisonMetricOf(
  report: CreatorWeeklyReportPayload,
  card: PatternSectionCard,
): DiagnosisPatternFact["metrica"] {
  const detail = report.details.find((item) => item.id === card.highlight.detailId);
  const group = detail?.groups.find((item) => item.id === card.highlight.groupId);
  const row = group?.items.find((item) => item.id === card.highlight.itemId);
  const metric = row?.comparisonMetric;
  return metric ? METRIC_LABEL[metric] : null;
}

function weeklyOccurrencesOf(report: CreatorWeeklyReportPayload, card: PatternSectionCard): number {
  const detail = report.details.find((item) => item.id === card.highlight.detailId);
  const group = detail?.groups.find((item) => item.id === card.highlight.groupId);
  const row = group?.items.find((item) => item.id === card.highlight.itemId);
  return row?.weeklyOccurrences ?? 0;
}

function toPatternFact(report: CreatorWeeklyReportPayload, card: PatternSectionCard): DiagnosisPatternFact | null {
  const indice = formatDiagnosisIndex(card.highlight.index);
  if (!indice) return null;
  return {
    dimensao: card.highlight.label,
    resposta: card.highlight.value,
    acao: card.action,
    indice,
    posts: card.highlight.nPosts ?? 0,
    vezesNaSemana: weeklyOccurrencesOf(report, card),
    metrica: comparisonMetricOf(report, card),
  };
}

function daysBetween(from: string, to: Date): number {
  const start = new Date(from).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((to.getTime() - start) / 86_400_000));
}

function cleanList(values: string[], limit: number): string[] {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, limit);
}

export function isDiagnosisEligible(report: CreatorWeeklyReportPayload | null | undefined): boolean {
  if (!report || (report.status !== "ready" && report.status !== "partial")) return false;
  return (report.coverage?.posts90d ?? 0) >= DIAGNOSIS_MIN_POSTS_90D;
}

export function buildDiagnosisFacts(params: {
  report: CreatorWeeklyReportPayload;
  map: DiagnosisMapInput | null;
  previousHeadline?: string | null;
  now?: Date;
}): DiagnosisFacts {
  const { report } = params;
  const now = params.now ?? new Date();
  const highlights = buildPatternHighlights(report);
  const sections = buildPatternSections(highlights);
  const facts = (cards: PatternSectionCard[]) =>
    cards
      .map((card) => toPatternFact(report, card))
      .filter((fact): fact is DiagnosisPatternFact => fact !== null)
      .slice(0, MAX_PATTERNS_PER_SECTION);

  const video = report.weeklyVideo;
  const map = params.map;
  const hasMap = Boolean(map && (map.narrative || map.territories.length > 0));

  return {
    semana: { rotulo: report.period.rangeLabel, postsNaSemana: report.coverage.postsWeek },
    janelaDias: DIAGNOSIS_WINDOW_DAYS,
    maturidadeDias: DIAGNOSIS_MATURITY_DAYS,
    cobertura: {
      postsNos90Dias: report.coverage.posts90d,
      postsComCenaLida: report.coverage.postsWithScene,
    },
    mapa: hasMap && map
      ? {
          narrativa: map.narrative?.trim() || null,
          narrativaFirme: map.narrativeIsFirm,
          territorios: cleanList(map.territories, 8),
          assets: cleanList(map.assets, 8),
          tom: map.tone?.trim() || null,
        }
      : null,
    padroes: {
      regras: facts(sections.rules),
      testes: facts(sections.tests),
      semResposta: highlights
        .filter((highlight) => highlight.kind !== "answer")
        .map((highlight) => ({ dimensao: highlight.label, postsLidos: highlight.analysedPosts })),
    },
    assuntosObservados: cleanList(report.overview?.observedSubjects ?? [], 8),
    melhorPostDaSemana: video
      ? {
          assunto: video.subject,
          cenario: video.place,
          abertura: video.openingLine,
          indice: formatDiagnosisIndex(video.performanceIndex),
          diasDesdeAPublicacao: daysBetween(video.publishedAt, now),
        }
      : null,
    manchetePassada: params.previousHeadline?.trim() || null,
  };
}

/** A linha de amostra é calculada, nunca escrita pelo modelo. */
export function diagnosisSampleLine(coverage: CreatorWeeklyReportPayload["coverage"]): string {
  const read = coverage.postsWithScene;
  const total = coverage.posts90d;
  const posts = total === 1 ? "post lido" : "posts lidos";
  return `${read} de ${total} ${posts} · comparado com os seus últimos ${DIAGNOSIS_WINDOW_DAYS} dias`;
}

/** Normaliza "2,3" e "2.3" para a mesma chave. */
export function normalizeNumberToken(token: string): string {
  const value = Number(token.replace(",", "."));
  return Number.isFinite(value) ? String(value) : token;
}

/**
 * Todo número que existe nos fatos — nas contagens, nos índices e dentro dos
 * próprios rótulos ("Das 4h às 8h", "14 a 20 de setembro"). É a lista do que o
 * texto pode citar.
 */
export function allowedNumbers(facts: DiagnosisFacts): Set<string> {
  const allowed = new Set<string>();
  const serialized = JSON.stringify(facts);
  for (const match of serialized.matchAll(/\d+(?:[.,]\d+)?/g)) {
    allowed.add(normalizeNumberToken(match[0]));
  }
  return allowed;
}
