import { isValidCategoryId } from "@/app/lib/classification";
import { EXPERIENCE_SPECS, getExperienceFilters } from "@/app/lib/discover/experiences";

function expectIncludeToBeCanonical(include: {
  format?: string[];
  proposal?: string[];
  context?: string[];
  tone?: string[];
  references?: string[];
}) {
  include.format?.forEach((id) => expect(isValidCategoryId(id, "format")).toBe(true));
  include.proposal?.forEach((id) => expect(isValidCategoryId(id, "proposal")).toBe(true));
  include.context?.forEach((id) => expect(isValidCategoryId(id, "context")).toBe(true));
  include.tone?.forEach((id) => expect(isValidCategoryId(id, "tone")).toBe(true));
  include.references?.forEach((id) => expect(isValidCategoryId(id, "reference")).toBe(true));
}

describe("discover experiences", () => {
  it("uses only canonical ids in every experience spec", () => {
    Object.values(EXPERIENCE_SPECS).forEach((spec) => {
      expectIncludeToBeCanonical(spec.include);
    });
  });

  it("maps learning presets to canonical proposal, tone and reference filters", () => {
    expect(getExperienceFilters("learn", {})).toEqual({
      format: "reel,carousel",
      proposal: "tips",
      context: undefined,
      tone: "educational",
      references: undefined,
    });

    expect(getExperienceFilters("learn_fun", {})).toEqual({
      format: "reel,carousel",
      proposal: "tips,humor_scene",
      context: undefined,
      tone: "educational",
      references: "pop_culture",
    });
  });

  it("merges personalized context without breaking canonical ids", () => {
    expect(getExperienceFilters("niche_humor", { allowedPersonalized: true, topContextIds: ["fashion_style"] })).toEqual({
      format: undefined,
      proposal: "humor_scene",
      context: "fashion_style",
      tone: undefined,
      references: undefined,
    });
  });
});
