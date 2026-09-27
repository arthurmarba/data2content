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

/** A métrica que o efeito compara, dita como gente. */
export type DiagnosisMetric = "compartilhamentos" | "salvamentos" | "visualizações";

export interface DiagnosisPatternFact {
  /** A dimensão pela palavra da tela: "Onde", "Dia", "Gancho". */
  dimensao: string;
  /** A resposta do ranking: "Cozinha", "Qui". */
  resposta: string;
  /** A resposta dita como ação: "Grave em cozinha". */
  acao: string;
  /**
   * O resultado em palavras de gente, sempre contra o que o próprio criador
   * costuma ter: "o dobro de compartilhamentos", "50% mais salvamentos".
   * Calculado aqui para o modelo não fazer conta nem copiar decimal.
   */
  efeito: string;
  /** Posts em que isso aconteceu nos últimos 3 meses. */
  posts: number;
  /** O quanto dá para confiar, dito como conversa. */
  firmeza: string;
  /** Quantos posts da semana fechada repetiram esta resposta. */
  vezesNaSemana: number;
}

export interface DiagnosisFacts {
  semana: { rotulo: string; postsNaSemana: number };
  /** A janela de comparação dita como gente: "últimos 3 meses". */
  periodo: string;
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
    /** "o dobro do resultado de costume"; nulo quando não passou do normal. */
    efeito: string | null;
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

/**
 * O multiplicador dito como uma pessoa diria. "2,34×" vira "o dobro de
 * compartilhamentos"; "1,53×", "50% mais compartilhamentos". Arredonda de
 * propósito: quem lê precisa da ordem de grandeza, não da casa decimal.
 */
export function humanEffect(
  index: number | null | undefined,
  metric: DiagnosisMetric | null,
): string | null {
  if (typeof index !== "number" || !Number.isFinite(index) || index <= 1) return null;
  if (index >= 3.5) return metric ? `${Math.round(index)} vezes mais ${metric}` : `${Math.round(index)} vezes o resultado de costume`;
  if (index >= 2.5) return metric ? `o triplo de ${metric}` : "o triplo do resultado de costume";
  if (index >= 1.95) return metric ? `o dobro de ${metric}` : "o dobro do resultado de costume";
  // Menos de 10% acima não vira porcentagem: "10% mais" exageraria um empate.
  if (index < 1.1) return metric ? `um pouco mais de ${metric}` : "um pouco acima do resultado de costume";
  const percent = Math.round((index - 1) * 10) * 10;
  return metric ? `${percent}% mais ${metric}` : `${percent}% acima do resultado de costume`;
}

function firmnessOf(isRule: boolean, posts: number): string {
  if (isRule) return "já se repetiu o bastante: dá pra confiar";
  if (posts >= 3) return "apareceu algumas vezes: vale repetir para confirmar";
  return "aconteceu em poucos posts: ainda é cedo para confiar";
}

function comparisonMetricOf(
  report: CreatorWeeklyReportPayload,
  card: PatternSectionCard,
): DiagnosisMetric | null {
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

function toPatternFact(
  report: CreatorWeeklyReportPayload,
  card: PatternSectionCard,
  isRule: boolean,
): DiagnosisPatternFact | null {
  const efeito = humanEffect(card.highlight.index, comparisonMetricOf(report, card));
  if (!efeito) return null;
  const posts = card.highlight.nPosts ?? 0;
  return {
    dimensao: card.highlight.label,
    resposta: card.highlight.value,
    acao: card.action,
    efeito,
    posts,
    firmeza: firmnessOf(isRule, posts),
    vezesNaSemana: weeklyOccurrencesOf(report, card),
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
  const facts = (cards: PatternSectionCard[], isRule: boolean) =>
    cards
      .map((card) => toPatternFact(report, card, isRule))
      .filter((fact): fact is DiagnosisPatternFact => fact !== null)
      .slice(0, MAX_PATTERNS_PER_SECTION);

  const video = report.weeklyVideo;
  const map = params.map;
  const hasMap = Boolean(map && (map.narrative || map.territories.length > 0));

  return {
    semana: { rotulo: report.period.rangeLabel, postsNaSemana: report.coverage.postsWeek },
    periodo: "últimos 3 meses",
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
      regras: facts(sections.rules, true),
      testes: facts(sections.tests, false),
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
          efeito: humanEffect(video.performanceIndex, null),
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
  return `Lemos ${read} dos seus ${total} posts dos últimos 3 meses`;
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
