import { isValidCategoryId } from "@/app/lib/classification";
import { getV2CategoryById } from "@/app/lib/classificationV2";
import { getV25CategoryById } from "@/app/lib/classificationV2_5";
import { EXPERIENCE_SPECS, getExperienceFilters } from "@/app/lib/discover/experiences";

function expectIncludeToBeCanonical(include: {
  format?: string[];
  context?: string[];
  references?: string[];
  contentIntent?: string[];
  narrativeForm?: string[];
  contentSignals?: string[];
  proofStyle?: string[];
  commercialMode?: string[];
}) {
  include.format?.forEach((id) => expect(isValidCategoryId(id, "format")).toBe(true));
  include.context?.forEach((id) => expect(isValidCategoryId(id, "context")).toBe(true));
  include.references?.forEach((id) => expect(isValidCategoryId(id, "reference")).toBe(true));
  include.contentIntent?.forEach((id) => expect(getV2CategoryById(id, "contentIntent")).toBeDefined());
  include.narrativeForm?.forEach((id) => expect(getV2CategoryById(id, "narrativeForm")).toBeDefined());
  include.contentSignals?.forEach((id) => expect(getV2CategoryById(id, "contentSignal")).toBeDefined());
  include.proofStyle?.forEach((id) => expect(getV25CategoryById(id, "proofStyle")).toBeDefined());
  include.commercialMode?.forEach((id) => expect(getV25CategoryById(id, "commercialMode")).toBeDefined());
}

describe("discover experiences", () => {
  it("uses only canonical ids in every experience spec", () => {
    Object.values(EXPERIENCE_SPECS).forEach((spec) => {
      expectIncludeToBeCanonical(spec.include);
    });
  });

  it("maps learning presets to strategic intent, narrative and proof filters", () => {
    expect(getExperienceFilters("learn", {})).toEqual({
      format: "reel,carousel",
      context: undefined,
      references: undefined,
      contentIntent: "teach",
      narrativeForm: "tutorial",
      contentSignals: undefined,
      proofStyle: "demonstration,list_based",
      commercialMode: undefined,
    });

    expect(getExperienceFilters("learn_fun", {})).toEqual({
      format: "reel,carousel",
      context: undefined,
      references: "pop_culture",
      contentIntent: "teach,entertain",
      narrativeForm: "tutorial,sketch_scene",
      contentSignals: undefined,
      proofStyle: "demonstration,list_based",
      commercialMode: undefined,
    });
  });

  it("merges personalized context without breaking canonical ids", () => {
    expect(getExperienceFilters("niche_humor", { allowedPersonalized: true, topContextIds: ["fashion_style"] })).toEqual({
      format: undefined,
      context: "fashion_style",
      references: undefined,
      contentIntent: "entertain",
      narrativeForm: "sketch_scene",
      contentSignals: undefined,
      proofStyle: undefined,
      commercialMode: undefined,
    });
  });
});
