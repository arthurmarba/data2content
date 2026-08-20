// src/app/lib/creatorWeeklyReport/patternContextTypes.ts
//
// O contexto de um padrão: a série dele nas últimas semanas e o mesmo padrão
// medido no território. Tipos puros, sem Mongo — o Perfil importa daqui.
//
// Por que existe: um multiplicador sozinho não diz se aquilo está subindo ou
// se é o resto do assunto que também rende. "Natureza 7,5×" pode ser uma
// descoberta sua ou pode ser o que qualquer pessoa que fala do seu assunto já
// sabe. A série responde a primeira pergunta, o território a segunda.

/** Uma linha do ranking do território, na mesma régua do criador. */
export interface PatternTerritoryRow {
  key: string;
  label: string;
  /** Índice contra a base do território na janela. 1,0× é a média de lá. */
  index: number;
}

export interface PatternTerritoryContext {
  id: string;
  label: string;
  /** Semana congelada de onde os rankings saíram ("2026-W33"). */
  weekKey: string;
  /** Por groupId da leitura do criador ("place", "tone", "weekday"…). */
  rankings: Record<string, PatternTerritoryRow[]>;
}

export interface PatternContext {
  /**
   * Série das últimas semanas, do mais antigo ao mais recente, por
   * `${detailId}:${groupId}:${rótulo normalizado}`. Semana em que o item não
   * apareceu entra como 0 — a barra vazia é informação, não buraco.
   */
  trends: Record<string, number[]>;
  /** Quantas semanas a série cobre. */
  weeks: number;
  territory: PatternTerritoryContext | null;
}

/** Quantas semanas a barrinha de tendência mostra. */
export const PATTERN_TREND_WEEKS = 4;

export const EMPTY_PATTERN_CONTEXT: PatternContext = {
  trends: {},
  weeks: PATTERN_TREND_WEEKS,
  territory: null,
};

/**
 * Ponte entre o vocabulário da leitura do criador (`groupId`) e o das tabelas
 * do território (`ElementKind`). Dia e horário não têm tabela própria lá: o
 * relatório de território mede a célula dia×horário, e o serviço agrega.
 */
export const TERRITORY_KIND_BY_GROUP: Readonly<Record<string, string>> = {
  place: "local",
  objects: "objeto",
  cast: "asset",
  framing: "enquadramento",
  tone: "tom",
  aesthetics: "estetica",
  "subjects-best": "tema",
  subjects: "tema",
  "subjects-repeated": "tema",
  "openings-best": "fala",
  best: "fala",
};

/**
 * Chave da série de um padrão promovido.
 *
 * A chave é o RÓTULO, não o id do item. Dois dos rankings — assunto mais forte
 * e gancho — geram um item por post, com id derivado do id da mídia: ele muda
 * toda semana, e a série nunca se reencontraria. O rótulo ("Cozinha de casa",
 * "Qui") é o que de fato se repete de uma semana para a outra.
 */
export function patternTrendKey(
  detailId: string,
  groupId: string,
  label: string | null | undefined,
): string | null {
  const normalized = (label ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
  return normalized ? `${detailId}:${groupId}:${normalized}` : null;
}
