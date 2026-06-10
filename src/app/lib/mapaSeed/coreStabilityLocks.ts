// src/app/lib/mapaSeed/coreStabilityLocks.ts
//
// Estabilidade do núcleo do mapa (G3). Compartilhado pelos dois enrichers
// (Instagram e vídeo): se o criador já confirmou narrativa/tom, a fonte de
// enriquecimento NÃO sobrescreve o núcleo — mantém o confirmado e registra a
// divergência como observação calma. Mesma filosofia do Stream A: o criador
// confirma o que entra no núcleo; a fonte propõe, não impõe.

import type { IMapaData } from "@/app/models/MapaSeed";

export interface CoreStabilityLocks {
  narrativeLocked: boolean;
  toneLocked: boolean;
}

/** Frases de divergência específicas da fonte (Instagram × vídeos). */
export interface CoreLockSourcePhrases {
  /** Prefixo da observação de narrativa, ex.: "Seu Instagram sugere" / "Seus vídeos sugerem". */
  narrativePrefix: string;
  /** Locução para o tom, ex.: "no Instagram" / "nos vídeos". */
  tonePhrase: string;
}

export interface CoreLockResult {
  narrativaFinal: string;
  tomFinal: string;
  observacoes: string[];
}

/** Comparação tolerante a espaços/caixa para detectar divergência real. */
function normalizeForCompare(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Aplica os locks de estabilidade ao núcleo. Quando uma dimensão está travada e
 * a fonte diverge, mantém o valor confirmado e acrescenta uma observação calma.
 * Quando destravada, usa o valor proposto pela fonte (comportamento padrão).
 */
export function applyCoreStabilityLocks(params: {
  mapaAtual: Pick<IMapaData, "narrativa_central" | "tom">;
  proposedNarrativa: string;
  proposedTom: string;
  baseObservacoes: string[];
  locks: CoreStabilityLocks | undefined;
  source: CoreLockSourcePhrases;
}): CoreLockResult {
  const { mapaAtual, proposedNarrativa, proposedTom, baseObservacoes, locks, source } = params;
  const observacoes = [...baseObservacoes];

  let narrativaFinal = proposedNarrativa;
  if (locks?.narrativeLocked) {
    narrativaFinal = mapaAtual.narrativa_central;
    if (normalizeForCompare(proposedNarrativa) !== normalizeForCompare(mapaAtual.narrativa_central)) {
      observacoes.push(
        `${source.narrativePrefix} uma narrativa um pouco diferente da que você confirmou: "${proposedNarrativa}". Mantivemos a sua — você pode revisar quando quiser.`,
      );
    }
  }

  let tomFinal = proposedTom;
  if (locks?.toneLocked) {
    tomFinal = mapaAtual.tom;
    if (normalizeForCompare(proposedTom) !== normalizeForCompare(mapaAtual.tom)) {
      observacoes.push(
        `Seu tom ${source.tonePhrase} aparece como "${proposedTom}", diferente do que você confirmou. Mantivemos o seu.`,
      );
    }
  }

  return { narrativaFinal, tomFinal, observacoes };
}
