import { buildCreatorDnaProfileFromCaptions } from "./dnaProfile";

describe("scripts/dnaProfile", () => {
  it("returns safe defaults when there is no caption evidence", () => {
    const profile = buildCreatorDnaProfileFromCaptions([]);

    expect(profile.sampleSize).toBe(0);
    expect(profile.hasEnoughEvidence).toBe(false);
    expect(profile.writingGuidelines.length).toBeGreaterThan(0);
  });

  it("extracts language signals from a small caption corpus", () => {
    const profile = buildCreatorDnaProfileFromCaptions([
      {
        metricId: "m1",
        caption: "Ola criadores! Hoje eu te mostro um truque rapido. Comenta aqui se quer parte 2.",
        interactions: 100,
      },
      {
        metricId: "m2",
        caption: "Ola criadores, bora melhorar seus videos hoje? Salva esse post e manda para um amigo.",
        interactions: 120,
      },
      {
        metricId: "m3",
        caption: "Ola criadores: roteiro simples, gancho forte e CTA claro. Comenta o tema do proximo.",
        interactions: 90,
      },
      {
        metricId: "m4",
        caption: "Hoje tem dica pratica para creator. Salve e compartilhe com quem precisa.",
        interactions: 80,
      },
      {
        metricId: "m5",
        caption: "Bora crescer com estrategia? Comenta e compartilha com o time.",
        interactions: 70,
      },
      {
        metricId: "m6",
        caption: "Ola criadores, teste esse modelo de roteiro e me conta o resultado.",
        interactions: 110,
      },
    ]);

    expect(profile.sampleSize).toBe(6);
    expect(profile.hasEnoughEvidence).toBe(true);
    expect(profile.averageSentenceLength).toBeGreaterThan(0);
    expect(profile.openingPatterns.length).toBeGreaterThan(0);
    expect(profile.ctaPatterns.length).toBeGreaterThan(0);
    expect(profile.recurringExpressions).toContain("criadores");
  });
});
