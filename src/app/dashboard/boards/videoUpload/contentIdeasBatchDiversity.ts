/**
 * Seleção de uma leva de pautas para o swipe.
 *
 * O modelo é incentivado a gerar candidatos com origens diferentes, mas esta
 * camada mantém a promessa quando ele volta à mesma nota. Ela nunca inventa
 * nem reescreve uma pauta: apenas privilegia as que já chegam mais distintas.
 */
import { isNearDuplicate } from "./contentIdeasTitleDedup";

export interface DiverseContentIdea {
  title: string;
  territory: string;
  assets: string[];
  suggestedFormat: string;
  creativeMode: string;
}

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function hasNewAsset(candidate: DiverseContentIdea, usedAssets: Set<string>): boolean {
  return candidate.assets.some((asset) => !usedAssets.has(normalized(asset)));
}

/**
 * Escolhe até `targetCount` ideias distintas. Empates respeitam a ordem do LLM
 * para não trocar arbitrariamente a intenção da geração.
 */
export function selectDiverseContentIdeas<T extends DiverseContentIdea>(
  candidates: T[],
  existingTitles: string[],
  targetCount: number,
): T[] {
  const selected: T[] = [];
  const seenTitles = [...existingTitles];
  const usedModes = new Set<string>();
  const usedTerritories = new Set<string>();
  const usedFormats = new Set<string>();
  const usedAssets = new Set<string>();
  const remaining = candidates.map((candidate, index) => ({ candidate, index }));

  while (selected.length < targetCount && remaining.length > 0) {
    const eligible = remaining
      .filter(({ candidate }) => !seenTitles.some((title) => isNearDuplicate(candidate.title, title, 0.42)))
      .map(({ candidate, index }) => {
        const mode = normalized(candidate.creativeMode);
        const territory = normalized(candidate.territory);
        const format = normalized(candidate.suggestedFormat);
        const score =
          (usedModes.has(mode) ? 0 : 5) +
          (usedTerritories.has(territory) ? 0 : 3) +
          (hasNewAsset(candidate, usedAssets) ? 2 : 0) +
          (usedFormats.has(format) ? 0 : 1);
        return { candidate, index, score, mode, territory, format };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index);

    if (eligible.length === 0) break;

    const next = eligible[0]!;
    selected.push(next.candidate);
    seenTitles.push(next.candidate.title);
    usedModes.add(next.mode);
    usedTerritories.add(next.territory);
    usedFormats.add(next.format);
    for (const asset of next.candidate.assets) usedAssets.add(normalized(asset));

    const remainingIndex = remaining.findIndex(({ candidate }) => candidate === next.candidate);
    remaining.splice(remainingIndex, 1);
  }

  return selected;
}
