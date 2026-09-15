import type { LandingCreatorHighlight } from "@/types/landing";

/**
 * Territórios do diretório da comunidade a partir do texto livre do cadastro.
 *
 * O casting guarda o que cada criador digitou: "BELEZA;estética;cursos", "beleza",
 * "Guia-gastronômico", entradas só com emoji e erros como "Creatorr". Sem limpeza o
 * filtro virava a lista crua. Aqui cada valor é separado, normalizado para comparar
 * (sem acento, caixa, espaço ou hífen) e só entra no filtro se aparecer em pelo
 * menos dois criadores — erro de digitação isolado não vira opção.
 */
export const MIN_CREATORS_PER_THEME = 2;

const key = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const label = (value: string) => {
  const text = value.replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1).toLocaleLowerCase("pt-BR");
};

export function creatorThemeKeys(creator: Pick<LandingCreatorHighlight, "niches" | "brandTerritories">): string[] {
  const raw = creator.brandTerritories ?? creator.niches ?? [];
  const keys = raw
    .flatMap((value) => String(value ?? "").split(/[;,|/·]+/))
    .map((value) => value.trim())
    .filter((value) => /\p{L}/u.test(value))
    .map(key)
    .filter((value) => value.length >= 3);
  return Array.from(new Set(keys));
}

export function communityThemes(
  creators: Array<Pick<LandingCreatorHighlight, "niches" | "brandTerritories">>,
): Array<{ key: string; label: string }> {
  const counts = new Map<string, { creators: number; labels: Map<string, number> }>();
  for (const creator of creators) {
    const raw = creator.brandTerritories ?? creator.niches ?? [];
    const seen = new Set<string>();
    for (const part of raw.flatMap((value) => String(value ?? "").split(/[;,|/·]+/))) {
      const text = part.trim();
      if (!/\p{L}/u.test(text)) continue;
      const k = key(text);
      if (k.length < 3) continue;
      const entry = counts.get(k) ?? { creators: 0, labels: new Map<string, number>() };
      if (!seen.has(k)) {
        entry.creators += 1;
        seen.add(k);
      }
      const l = label(text);
      entry.labels.set(l, (entry.labels.get(l) ?? 0) + 1);
      counts.set(k, entry);
    }
  }
  return Array.from(counts.entries())
    .filter(([, entry]) => entry.creators >= MIN_CREATORS_PER_THEME)
    .map(([k, entry]) => ({
      key: k,
      // O rótulo mais usado; empate fica com o que tem espaços (mais legível).
      label: Array.from(entry.labels.entries()).sort(
        (a, b) => b[1] - a[1] || b[0].split(" ").length - a[0].split(" ").length,
      )[0]![0],
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}
