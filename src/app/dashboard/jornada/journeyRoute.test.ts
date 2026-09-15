import { buildJourneyHref } from "./journeyRoute";

describe("buildJourneyHref", () => {
  it("abre a Jornada sem query quando não há contexto", () => {
    expect(buildJourneyHref(undefined)).toBe("/dashboard/jornada");
    expect(buildJourneyHref({})).toBe("/dashboard/jornada");
  });

  it("preserva retorno de Instagram, checkout e origem", () => {
    expect(buildJourneyHref({ instagramLinked: "true", source: "chatgpt", activation: "whatsapp" }))
      .toBe("/dashboard/jornada?instagramLinked=true&source=chatgpt&activation=whatsapp");
  });

  it("traduz os pedidos de aba das telas antigas", () => {
    expect(buildJourneyHref({ tab: "collabs" })).toBe("/dashboard/jornada?view=collabs");
    expect(buildJourneyHref({ openCommunity: "1", paywall: "1" })).toBe("/dashboard/jornada?paywall=1&view=comunidade");
  });

  it("respeita a aba pedida explicitamente e repete valores múltiplos", () => {
    expect(buildJourneyHref({ view: "publis", tab: "collabs", ref: ["a", "b"] }))
      .toBe("/dashboard/jornada?view=publis&ref=a&ref=b");
  });
});
