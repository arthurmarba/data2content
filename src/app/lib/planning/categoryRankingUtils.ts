const CATEGORY_NAME_ALIASES: Record<string, string> = {
  photo: "foto",
  imagem: "foto",
  image: "foto",
  carousel: "carrossel",
  carrossel: "carrossel",
  reel: "reels",
  reels: "reels",
  video: "video",
  "vídeo": "video",
};

export const CATEGORY_RANKING_LIMIT = 5;

export type CategoryRankingBar = {
  name: string;
  value: number;
  postsCount?: number;
};

function normalizeCategoryName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function categoryNamesMatch(left: string, right: string) {
  const leftNormalized = normalizeCategoryName(left);
  const rightNormalized = normalizeCategoryName(right);
  if (leftNormalized === rightNormalized) return true;

  const leftAlias = CATEGORY_NAME_ALIASES[leftNormalized];
  const rightAlias = CATEGORY_NAME_ALIASES[rightNormalized];
  return leftAlias === rightNormalized || rightAlias === leftNormalized;
}

export function limitCategoryBars<T extends CategoryRankingBar>(
  rows: T[],
  limit = CATEGORY_RANKING_LIMIT
): T[] {
  return Array.isArray(rows) ? rows.slice(0, limit) : [];
}

export function shouldSupplementCategoryBars(
  primaryBars: CategoryRankingBar[],
  desiredSize = CATEGORY_RANKING_LIMIT
) {
  if (!Array.isArray(primaryBars) || primaryBars.length === 0) return true;
  if (primaryBars.length < desiredSize) return true;
  return primaryBars.some((bar) => typeof bar.postsCount !== "number");
}

export function mergeCategoryBars(
  primaryBars: CategoryRankingBar[],
  fallbackBars?: CategoryRankingBar[] | null
): CategoryRankingBar[] {
  const safePrimaryBars = Array.isArray(primaryBars) ? primaryBars : [];
  const safeFallbackBars = Array.isArray(fallbackBars) ? fallbackBars : [];

  if (!safePrimaryBars.length) {
    return safeFallbackBars
      .slice()
      .sort((left, right) => right.value - left.value);
  }

  return [
    ...safePrimaryBars.map((bar) => {
      if (typeof bar.postsCount === "number") return bar;

      const fallbackBar = safeFallbackBars.find((row) =>
        categoryNamesMatch(row.name, bar.name)
      );

      return {
        ...bar,
        postsCount: fallbackBar?.postsCount ?? 0,
      };
    }),
    ...safeFallbackBars.filter(
      (row) => !safePrimaryBars.some((bar) => categoryNamesMatch(bar.name, row.name))
    ),
  ].sort((left, right) => right.value - left.value);
}
