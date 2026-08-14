import { parseMobileOnboardingBody } from "./route";

describe("mobile strategic profile onboarding contract", () => {
  it("aceita somente o Norte no fluxo principal", () => {
    expect(parseMobileOnboardingBody({
      creatorPurpose: "  Ajudo criadores a comunicar seu valor com clareza.  ",
    })).toEqual({
      ok: true,
      skipped: false,
      creatorPurpose: "Ajudo criadores a comunicar seu valor com clareza.",
    });
  });

  it("aceita um skip explícito sem inventar respostas ocultas", () => {
    expect(parseMobileOnboardingBody({ skip: true })).toEqual({
      ok: true,
      skipped: true,
    });
  });

  it("rejeita texto curto e o contrato legado sem Norte", () => {
    expect(parseMobileOnboardingBody({ creatorPurpose: "Muito curto" })).toEqual({
      ok: false,
      error: "creatorPurpose deve ter pelo menos 15 caracteres.",
    });
    expect(parseMobileOnboardingBody({
      whyYouCreate: "ensino_conhecimento",
      desiredFeeling: "inspirado",
    })).toEqual({
      ok: false,
      error: "creatorPurpose é obrigatório, a menos que o onboarding seja pulado.",
    });
  });
});
