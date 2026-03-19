import { isValidCategoryId } from "@/app/lib/classification";
import { getRecipe } from "@/app/lib/discover/recipes";

function expectIncludeToBeCanonical(include?: {
  format?: string[];
  proposal?: string[];
  context?: string[];
  tone?: string[];
  references?: string[];
}) {
  if (!include) return;
  include.format?.forEach((id) => expect(isValidCategoryId(id, "format")).toBe(true));
  include.proposal?.forEach((id) => expect(isValidCategoryId(id, "proposal")).toBe(true));
  include.context?.forEach((id) => expect(isValidCategoryId(id, "context")).toBe(true));
  include.tone?.forEach((id) => expect(isValidCategoryId(id, "tone")).toBe(true));
  include.references?.forEach((id) => expect(isValidCategoryId(id, "reference")).toBe(true));
}

describe("discover recipes", () => {
  it("uses only canonical ids in all known experience and view recipes", () => {
    const recipes = [
      getRecipe({ exp: "for_you", allowedPersonalized: true, topContextIds: ["fashion_style"] }),
      getRecipe({ exp: "learn" }),
      getRecipe({ exp: "learn_fun" }),
      getRecipe({ exp: "inspire" }),
      getRecipe({ exp: "sell" }),
      getRecipe({ exp: "niche_humor", allowedPersonalized: true, topContextIds: ["fashion_style"] }),
      getRecipe({ view: "reels_lt_15" }),
      getRecipe({ view: "reels_15_45" }),
      getRecipe({ view: "reels_gt_45" }),
      getRecipe({ view: "top_comments" }),
      getRecipe({ view: "top_shares" }),
      getRecipe({ view: "top_saves" }),
      getRecipe({ view: "viral_weekend" }),
      getRecipe({ view: "viral_morning" }),
      getRecipe({ view: "viral_night" }),
    ].filter(Boolean);

    recipes.forEach((recipe) => {
      recipe!.shelves.forEach((shelf) => expectIncludeToBeCanonical(shelf.include));
    });
  });

  it("keeps learning and selling recipes on canonical ids only", () => {
    const learnRecipe = getRecipe({ exp: "learn" });
    expect(learnRecipe?.shelves[0]?.include).toEqual({
      proposal: ["tips"],
      tone: ["educational"],
      format: ["reel", "carousel"],
    });

    const sellRecipe = getRecipe({ exp: "sell" });
    expect(sellRecipe?.shelves[0]?.include).toEqual({
      proposal: ["review", "publi_divulgation"],
      tone: ["promotional"],
    });
  });
});
