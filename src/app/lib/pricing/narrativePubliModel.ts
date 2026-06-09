// src/app/lib/pricing/narrativePubliModel.ts
//
// Modelo ISOMÓRFICO (sem dependências de servidor) da estimativa de valor de
// publi por narrativa, compartilhado entre o client (OnboardingValueBlock) e o
// servidor (narrativePubliStats). Fonte única da fórmula e dos parâmetros.
//
// Entregável de referência (fixo): 1 Reels + combo de Stories, marca média,
// uso orgânico, sem exclusividade, risco/autoridade padrão.
//
// Fórmula (mesma de `publiCalculator.ts`):
//   justo = (alcance / 1000) × CPM_narrativa × multiplicadores × unidades_ponderadas
// O preço é LINEAR no nº de seguidores → percentis de seguidores viram percentis
// de preço diretamente.

/** Alcance por conteúdo como fração dos seguidores (orgânico, blend Reels/Stories). */
export const REACH_RATE = 0.25;

/** Unidades ponderadas: 1 Reels (×1.4) + combo de 3 Stories (3 × 0.8) = 3.8. */
export const CONTENT_UNITS = 1 * 1.4 + 3 * 0.8;

/**
 * Multiplicador combinado para marca média / risco padrão:
 * brandSize.media(1.0) × imageRisk.medio(1.15) × strategicGain.baixo(1.0) ×
 * contentModel.publicidade(1.0) = 1.15. Demais fatores neutros (1.0). Sem bônus
 * de engajamento — estimativa conservadora, não infla o que não conhecemos.
 */
export const BRAND_MEDIUM_MULTIPLIER = 1.15;

/** Faixa de seguidores do fallback determinístico — criador típico, em ascensão. */
export const FALLBACK_FOLLOWERS_MIN = 10_000;
export const FALLBACK_FOLLOWERS_MAX = 50_000;

export interface NarrativeDef {
  /** CPM do benchmark seed (`INITIAL_CPM_SEED`) para o segmento da narrativa. */
  cpm: number;
  /** Rótulo curto da narrativa, usado na copy. */
  label: string;
  /** Grupo canônico — agrupa chaves equivalentes (incl. legadas) para formar a coorte. */
  group: string;
}

/** CPM + rótulo por chave de narrativa (Q1). Chaves legadas mapeadas ao grupo atual. */
export const NARRATIVE_DEFS: Record<string, NarrativeDef> = {
  ensino_conhecimento:     { cpm: 18, label: "conteúdo educativo",    group: "educativo" },
  compartilho_aprendizado: { cpm: 18, label: "conteúdo educativo",    group: "educativo" },
  ensino_habilidade:       { cpm: 18, label: "conteúdo educativo",    group: "educativo" },
  conto_historias:         { cpm: 22, label: "conteúdo pessoal",      group: "pessoal" },
  entretenimento:          { cpm: 21, label: "entretenimento",        group: "entretenimento" },
  inspiro_acao:            { cpm: 22, label: "conteúdo motivacional", group: "motivacional" },
};

export const DEFAULT_NARRATIVE_DEF: NarrativeDef = {
  cpm: 22,
  label: "narrativa definida",
  group: "default",
};

/** Resolve a definição da narrativa (CPM/rótulo/grupo); cai no default se desconhecida. */
export function resolveNarrativeDef(whyYouCreate?: string | null): NarrativeDef {
  return (whyYouCreate ? NARRATIVE_DEFS[whyYouCreate] : undefined) ?? DEFAULT_NARRATIVE_DEF;
}

/**
 * Todas as chaves de `whyYouCreate` equivalentes à narrativa pedida (mesmo grupo).
 * Usado para montar a coorte sem perder usuários com respostas legadas.
 * Retorna `[]` para narrativa desconhecida (default) — sem coorte confiável.
 */
export function equivalentNarrativeKeys(whyYouCreate?: string | null): string[] {
  const def = resolveNarrativeDef(whyYouCreate);
  if (def.group === "default") return [];
  return Object.keys(NARRATIVE_DEFS).filter((key) => NARRATIVE_DEFS[key]?.group === def.group);
}

/** Arredonda para a dezena mais próxima — deixa o número limpo na faixa. */
export function roundToTen(value: number): number {
  return Math.round(value / 10) * 10;
}

/** Estima o "justo" do entregável de referência, dado CPM e nº de seguidores. */
export function estimateJusto(cpm: number, followers: number): number {
  const reach = followers * REACH_RATE;
  return (reach / 1000) * cpm * BRAND_MEDIUM_MULTIPLIER * CONTENT_UNITS;
}

export interface PubliRange {
  min: number;
  max: number;
  label: string;
}

/** Faixa de preço (arredondada) para a narrativa entre dois patamares de seguidores. */
export function priceRangeFromFollowers(
  whyYouCreate: string | null | undefined,
  lowFollowers: number,
  highFollowers: number,
): PubliRange {
  const def = resolveNarrativeDef(whyYouCreate);
  return {
    min: roundToTen(estimateJusto(def.cpm, lowFollowers)),
    max: roundToTen(estimateJusto(def.cpm, highFollowers)),
    label: def.label,
  };
}

/**
 * Faixa estimada determinística (fallback) para a narrativa, na banda de
 * seguidores ancorada (10–50k). Usada quando não há coorte real suficiente.
 */
export function fallbackPubliRange(whyYouCreate?: string | null): PubliRange {
  return priceRangeFromFollowers(whyYouCreate, FALLBACK_FOLLOWERS_MIN, FALLBACK_FOLLOWERS_MAX);
}
