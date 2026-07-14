/**
 * contentIdeasTitleDedup.ts
 *
 * Rede de segurança determinística contra pautas quase-duplicadas. A avoid-list
 * do prompt (títulos que o criador já viu) é uma instrução LEVE pro LLM — ele
 * pode reescrever um tema descartado com outras palavras e passar. Este filtro
 * roda DEPOIS da geração, sem LLM (custo/latência zero): compara as palavras
 * significativas do título novo contra os títulos que o criador já tem e corta
 * os que se sobrepõem demais.
 *
 * Módulo puro (sem deps de DB) — testável isoladamente.
 */
import { significantWords } from "./collabComplementarity";

/**
 * Similaridade Jaccard entre dois títulos, sobre palavras significativas
 * (≥4 chars, sem conectores genéricos — a mesma base do matcher). 0 quando
 * qualquer lado não tem palavra significativa (nada a comparar).
 */
export function titleSimilarity(a: string, b: string): number {
  const wa = new Set(significantWords(a));
  const wb = new Set(significantWords(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared += 1;
  const union = wa.size + wb.size - shared;
  return union === 0 ? 0 : shared / union;
}

/** Palavras significativas em comum entre dois títulos. */
function sharedCount(a: string, b: string): number {
  const wb = new Set(significantWords(b));
  return significantWords(a).filter((w) => wb.has(w)).length;
}

/**
 * true quando `title` é quase-duplicata de `other`. Além do limiar de Jaccard,
 * exige ≥2 palavras significativas em comum — sem isso, dois títulos curtos que
 * dividem UMA palavra (ex.: "casa") colidiriam à toa.
 */
export function isNearDuplicate(title: string, other: string, threshold = 0.5): boolean {
  return sharedCount(title, other) >= 2 && titleSimilarity(title, other) >= threshold;
}

/**
 * Filtra `candidates`, removendo os que são quase-duplicata de qualquer título
 * já existente (`existingTitles`) OU de um candidato anterior JÁ aceito nesta
 * mesma leva (dedup intra-lote também). Preserva a ordem; nunca muta a entrada.
 */
export function filterNearDuplicateTitles<T>(
  candidates: T[],
  existingTitles: string[],
  getTitle: (c: T) => string,
  threshold = 0.5,
): T[] {
  const kept: T[] = [];
  const seen = [...existingTitles];
  for (const c of candidates) {
    const title = getTitle(c);
    const dup = seen.some((prev) => isNearDuplicate(title, prev, threshold));
    if (!dup) {
      kept.push(c);
      seen.push(title);
    }
  }
  return kept;
}
