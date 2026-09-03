import {
  hasDirectionalJargon,
  sanitizeDirectionalInstruction,
  sanitizePlainDirectionalCopy,
  startsWithActionVerb,
} from "./directionalCopyPolicy";

describe("directionalCopyPolicy", () => {
  it("troca jargão e promessa absoluta por linguagem simples", () => {
    const result = sanitizePlainDirectionalCopy("Use um pattern interrupt: isso vai viralizar com payoff forte.");
    expect(result).toContain("mudança visual");
    expect(result).toContain("entrega");
    expect(result).not.toMatch(/viralizar|pattern interrupt|payoff/i);
    expect(hasDirectionalJargon(result)).toBe(false);
  });

  it("transforma observação em instrução iniciada por verbo", () => {
    const result = sanitizeDirectionalInstruction({
      value: "a demonstração aparece tarde",
      action: "move",
    });
    expect(result).toBe("Mova a demonstração aparece tarde");
    expect(startsWithActionVerb(result)).toBe(true);
  });

  it("substitui direção vaga por ação concreta segura", () => {
    expect(sanitizeDirectionalInstruction({
      value: "Melhore a retenção e deixe mais envolvente",
      action: "shorten",
      fallbackObject: "a introdução",
    })).toBe("Encurte a introdução.");
  });

  it("mantém uma ação por instrução", () => {
    expect(sanitizeDirectionalInstruction({
      value: "Mova a demonstração e corte a pausa seguinte.",
      action: "move",
    })).toBe("Mova a demonstração");
  });
});
