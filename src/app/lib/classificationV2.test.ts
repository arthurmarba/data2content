import {
  canonicalizeV2CategoryValues,
  getV2CategoryByValue,
  toCanonicalV2CategoryId,
  v2IdsToLabels,
} from "@/app/lib/classificationV2";

describe("classification V2", () => {
  it("canonicalizes content intent ids and labels", () => {
    expect(toCanonicalV2CategoryId("Ensinar", "contentIntent")).toBe("teach");
    expect(toCanonicalV2CategoryId("build_authority", "contentIntent")).toBe("build_authority");
    expect(toCanonicalV2CategoryId("promotional", "contentIntent")).toBe("convert");
  });

  it("canonicalizes narrative form ids and legacy-safe aliases", () => {
    expect(toCanonicalV2CategoryId("Rotina/Vlog", "narrativeForm")).toBe("day_in_the_life");
    expect(toCanonicalV2CategoryId("lifestyle", "narrativeForm")).toBe("day_in_the_life");
    expect(toCanonicalV2CategoryId("humor_scene", "narrativeForm")).toBe("sketch_scene");
    expect(toCanonicalV2CategoryId("q&a", "narrativeForm")).toBe("q_and_a");
  });

  it("canonicalizes signal ids and labels", () => {
    expect(toCanonicalV2CategoryId("Patrocinado/Publi", "contentSignal")).toBe("sponsored");
    expect(toCanonicalV2CategoryId("publi_divulgation", "contentSignal")).toBe("sponsored");
    expect(toCanonicalV2CategoryId("trend", "contentSignal")).toBe("trend_participation");
  });

  it("canonicalizes arrays and drops unknown values for new writes", () => {
    expect(
      canonicalizeV2CategoryValues(
        ["Ensinar", "teach", "desconhecido"],
        "contentIntent"
      )
    ).toEqual(["teach"]);
  });

  it("maps canonical ids back to labels for reads", () => {
    expect(v2IdsToLabels(["build_authority"], "contentIntent")).toEqual(["Construir Autoridade"]);
    expect(v2IdsToLabels(["day_in_the_life"], "narrativeForm")).toEqual(["Rotina/Vlog"]);
    expect(v2IdsToLabels(["sponsored"], "contentSignal")).toEqual(["Patrocinado/Publi"]);
  });

  it("resolves categories through the value lookup helper", () => {
    expect(getV2CategoryByValue("Converter", "contentIntent")?.id).toBe("convert");
    expect(getV2CategoryByValue("Sorteio", "contentSignal")?.id).toBe("giveaway");
  });
});
