import {
  buildDiscoverSearchParams,
  buildDiscoverSelectedFromParams,
  canonicalizeDiscoverFilterValues,
} from "@/app/discover/components/discoverFilterState";

describe("discover filter state", () => {
  it("canonicalizes legacy aliases from URL params into discover chip state", () => {
    const params = new URLSearchParams({
      context: "Moda/Estilo,lifestyle_and_wellbeing.fashion_style",
      references: "geography.city,Cidade",
      tone: "Promocional/Comercial,promotional (Promocional/Comercial)",
      proposal: "guide,tips",
    });

    expect(buildDiscoverSelectedFromParams(params)).toEqual({
      format: [],
      proposal: ["tips"],
      context: ["fashion_style"],
      tone: ["promotional"],
      references: ["city"],
    });
  });

  it("serializes canonical discover params and drops invalid values", () => {
    const params = new URLSearchParams({
      context: "Moda/Estilo",
      proposal: "guide",
      extra: "keep-me",
    });

    const state = buildDiscoverSelectedFromParams(params);
    const nextParams = buildDiscoverSearchParams(params, state);

    expect(nextParams.get("context")).toBe("fashion_style");
    expect(nextParams.get("proposal")).toBeNull();
    expect(nextParams.get("extra")).toBe("keep-me");
  });

  it("canonicalizes individual filter writes by dimension", () => {
    expect(canonicalizeDiscoverFilterValues("references", ["geography.city"])).toEqual(["city"]);
    expect(canonicalizeDiscoverFilterValues("tone", ["Promocional/Comercial"])).toEqual(["promotional"]);
  });
});
