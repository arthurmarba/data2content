import {
  CATEGORY_RANKING_LIMIT,
  limitCategoryBars,
  mergeCategoryBars,
  shouldSupplementCategoryBars,
} from "./categoryRankingUtils";

describe("categoryRankingUtils", () => {
  it("limits category rankings to top 5 entries", () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({
      name: `Categoria ${index + 1}`,
      value: 100 - index,
      postsCount: index + 1,
    }));

    expect(limitCategoryBars(rows)).toEqual(rows.slice(0, CATEGORY_RANKING_LIMIT));
  });

  it("supplements rankings when the api returns fewer than 5 rows", () => {
    expect(
      shouldSupplementCategoryBars([
        { name: "A", value: 120, postsCount: 3 },
        { name: "B", value: 110, postsCount: 2 },
      ])
    ).toBe(true);
  });

  it("supplements rankings when postsCount is missing", () => {
    expect(
      shouldSupplementCategoryBars([
        { name: "A", value: 120, postsCount: 3 },
        { name: "B", value: 110 },
        { name: "C", value: 100, postsCount: 2 },
        { name: "D", value: 90, postsCount: 2 },
        { name: "E", value: 80, postsCount: 1 },
      ])
    ).toBe(true);
  });

  it("keeps complete rankings untouched when 5 rows already exist", () => {
    expect(
      shouldSupplementCategoryBars([
        { name: "A", value: 120, postsCount: 3 },
        { name: "B", value: 110, postsCount: 2 },
        { name: "C", value: 100, postsCount: 2 },
        { name: "D", value: 90, postsCount: 2 },
        { name: "E", value: 80, postsCount: 1 },
      ])
    ).toBe(false);
  });

  it("merges api rows with fallback rows and hydrates missing counts", () => {
    const merged = mergeCategoryBars(
      [
        { name: "Posicionamento/Autoridade", value: 180 },
        { name: "Review", value: 140, postsCount: 3 },
      ],
      [
        { name: "Posicionamento/Autoridade", value: 170, postsCount: 5 },
        { name: "Tutorial", value: 130, postsCount: 2 },
        { name: "Bastidor", value: 120, postsCount: 2 },
      ]
    );

    expect(merged).toEqual([
      { name: "Posicionamento/Autoridade", value: 180, postsCount: 5 },
      { name: "Review", value: 140, postsCount: 3 },
      { name: "Tutorial", value: 130, postsCount: 2 },
      { name: "Bastidor", value: 120, postsCount: 2 },
    ]);
  });
});
