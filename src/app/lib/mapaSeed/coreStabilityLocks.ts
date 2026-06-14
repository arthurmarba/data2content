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

// ─── Merge de enriquecimento: união, nunca substituição ───────────────────────
//
// Invariante central do mapa (data2content): UM CHIP INSERIDO NUNCA É EXCLUÍDO
// pelo enriquecimento — só o criador remove um chip. O enriquecimento (Instagram/
// vídeo) só pode REFINAR (a redação, no prompt) ou ADICIONAR chips novos. Logo o
// merge é UNIÃO (existentes ∪ propostos), nunca substituição:
//   - todo chip existente sobrevive (ordem preservada);
//   - propostos que repetem um existente são ignorados (o existente — possivelmente
//     curado pelo criador — vence; o refino de redação fica a cargo do prompt);
//   - propostos que o criador REMOVEU (tombstones) não ressuscitam;
//   - o cap limita apenas ADIÇÕES — existentes acima do cap nunca caem.
// Substitui a antiga trava binária por seção (`applyEditedArrayLocks`), que ou
// congelava a seção inteira (bloqueando crescimento) ou a substituía (apagando
// chips silenciosamente) — ambos violavam a invariante.

export const ENRICHABLE_ARRAY_SECTIONS = [
  "territorios",
  "temas",
  "narrativas_adjacentes",
  "assets",
  "formatos",
] as const;
export type EnrichableArraySection = (typeof ENRICHABLE_ARRAY_SECTIONS)[number];

// Cap de ADIÇÕES por seção. Mantém o mapa enxuto (UI calma) sem nunca remover
// chips existentes — se já houver mais que o cap, todos são preservados.
const ADDITION_CAPS: Record<EnrichableArraySection, number> = {
  territorios: 6,
  temas: 6,
  narrativas_adjacentes: 4,
  assets: 8,
  formatos: 6,
};

function normalizeChip(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface DismissedChipRef {
  section: string;
  label: string;
}

export function mergeEnrichmentArrays(params: {
  mapaAtual: Pick<IMapaData, EnrichableArraySection>;
  proposed: Partial<Pick<IMapaData, EnrichableArraySection>>;
  dismissed?: DismissedChipRef[] | null;
}): Pick<IMapaData, EnrichableArraySection> {
  const { mapaAtual, proposed, dismissed } = params;
  const out = {} as Pick<IMapaData, EnrichableArraySection>;

  for (const section of ENRICHABLE_ARRAY_SECTIONS) {
    const existing = (mapaAtual[section] ?? []).filter(Boolean);
    const result = [...existing]; // existentes NUNCA caem
    const seen = new Set(result.map(normalizeChip));
    const tombstoned = new Set(
      (dismissed ?? [])
        .filter((d) => d.section === section)
        .map((d) => normalizeChip(d.label)),
    );
    const cap = ADDITION_CAPS[section];

    for (const candidate of (proposed[section] ?? []).filter(Boolean)) {
      const key = normalizeChip(candidate);
      if (seen.has(key)) continue;     // já existe (refino/dup) → existente vence
      if (tombstoned.has(key)) continue; // removido pelo criador → não ressuscita
      if (result.length >= cap) break;   // cap limita só ADIÇÕES
      result.push(candidate);
      seen.add(key);
    }
    out[section] = result;
  }

  return out;
}
