import { isValidCategoryId } from "@/app/lib/classification";
import { getV2CategoryById } from "@/app/lib/classificationV2";
import { getV25CategoryById } from "@/app/lib/classificationV2_5";
import { getRecipe } from "@/app/lib/discover/recipes";

function expectIncludeToBeCanonical(include?: {
  format?: string[];
  context?: string[];
  references?: string[];
  contentIntent?: string[];
  narrativeForm?: string[];
  contentSignals?: string[];
  proofStyle?: string[];
  commercialMode?: string[];
}) {
  if (!include) return;
  include.format?.forEach((id) => expect(isValidCategoryId(id, "format")).toBe(true));
  include.context?.forEach((id) => expect(isValidCategoryId(id, "context")).toBe(true));
  include.references?.forEach((id) => expect(isValidCategoryId(id, "reference")).toBe(true));
  include.contentIntent?.forEach((id) => expect(getV2CategoryById(id, "contentIntent")).toBeDefined());
  include.narrativeForm?.forEach((id) => expect(getV2CategoryById(id, "narrativeForm")).toBeDefined());
  include.contentSignals?.forEach((id) => expect(getV2CategoryById(id, "contentSignal")).toBeDefined());
  include.proofStyle?.forEach((id) => expect(getV25CategoryById(id, "proofStyle")).toBeDefined());
  include.commercialMode?.forEach((id) => expect(getV25CategoryById(id, "commercialMode")).toBeDefined());
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

  it("keeps learning and selling recipes on canonical strategic ids only", () => {
    const learnRecipe = getRecipe({ exp: "learn" });
    expect(learnRecipe?.shelves[0]?.include).toEqual({
      contentIntent: ["teach"],
      narrativeForm: ["tutorial"],
      proofStyle: ["demonstration", "list_based"],
      format: ["reel", "carousel"],
    });

    const sellRecipe = getRecipe({ exp: "sell" });
    expect(sellRecipe?.shelves[0]?.include).toEqual({
      contentIntent: ["convert"],
      narrativeForm: ["review"],
      proofStyle: ["social_proof", "demonstration"],
      commercialMode: ["paid_partnership"],
    });
  });
});
