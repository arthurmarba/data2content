import {
  canonicalizeV25CategoryValues,
  getV25CategoryByValue,
  toCanonicalV25CategoryId,
  v25IdsToLabels,
} from "@/app/lib/classificationV2_5";

describe("classification V2.5", () => {
  it("canonicalizes stance ids and labels", () => {
    expect(toCanonicalV25CategoryId("Critico", "stance")).toBe("critical");
    expect(toCanonicalV25CategoryId("testimonial", "stance")).toBe("testimonial");
    expect(toCanonicalV25CategoryId("depoimento", "stance")).toBe("testimonial");
  });

  it("canonicalizes proof style ids and aliases", () => {
    expect(toCanonicalV25CategoryId("Antes e Depois", "proofStyle")).toBe("before_after");
    expect(toCanonicalV25CategoryId("storytime", "proofStyle")).toBe("personal_story");
    expect(toCanonicalV25CategoryId("listicle", "proofStyle")).toBe("list_based");
  });

  it("canonicalizes commercial mode ids and legacy-adjacent aliases", () => {
    expect(toCanonicalV25CategoryId("Parceria Paga", "commercialMode")).toBe("paid_partnership");
    expect(toCanonicalV25CategoryId("sponsored", "commercialMode")).toBe("paid_partnership");
    expect(toCanonicalV25CategoryId("promo_offer", "commercialMode")).toBe("discount_offer");
  });

  it("canonicalizes arrays and drops unknown values for new writes", () => {
    expect(
      canonicalizeV25CategoryValues(
        ["Critico", "critical", "desconhecido"],
        "stance"
      )
    ).toEqual(["critical"]);
  });

  it("maps canonical ids back to labels for reads", () => {
    expect(v25IdsToLabels(["testimonial"], "stance")).toEqual(["Depoimento"]);
    expect(v25IdsToLabels(["before_after"], "proofStyle")).toEqual(["Antes e Depois"]);
    expect(v25IdsToLabels(["discount_offer"], "commercialMode")).toEqual(["Oferta/Desconto"]);
  });

  it("resolves categories through the lookup helper", () => {
    expect(getV25CategoryByValue("Questionando", "stance")?.id).toBe("questioning");
    expect(getV25CategoryByValue("Demonstracao", "proofStyle")?.id).toBe("demonstration");
  });
});
