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
      proposal: "guide,tips",
      tone: "Promocional/Comercial,promotional (Promocional/Comercial)",
    });

    expect(buildDiscoverSelectedFromParams(params)).toEqual({
      format: [],
      contentIntent: ["teach"],
      context: ["fashion_style"],
      narrativeForm: ["tutorial"],
      contentSignals: [],
      stance: [],
      proofStyle: [],
      commercialMode: [],
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
    expect(nextParams.get("contentIntent")).toBeNull();
    expect(nextParams.get("narrativeForm")).toBeNull();
    expect(nextParams.get("proposal")).toBeNull();
    expect(nextParams.get("extra")).toBe("keep-me");
  });

  it("canonicalizes individual filter writes by dimension", () => {
    expect(canonicalizeDiscoverFilterValues("references", ["geography.city"])).toEqual(["city"]);
    expect(canonicalizeDiscoverFilterValues("contentIntent", ["Converter"])).toEqual(["convert"]);
    expect(canonicalizeDiscoverFilterValues("narrativeForm", ["Tips"])).toEqual(["tutorial"]);
    expect(canonicalizeDiscoverFilterValues("contentSignals", ["publi_divulgation"])).toEqual(["sponsored"]);
    expect(canonicalizeDiscoverFilterValues("stance", ["Depoimento"])).toEqual(["testimonial"]);
    expect(canonicalizeDiscoverFilterValues("proofStyle", ["before after"])).toEqual(["before_after"]);
    expect(canonicalizeDiscoverFilterValues("commercialMode", ["promo_offer"])).toEqual(["discount_offer"]);
  });
});
