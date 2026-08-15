import { chooseContentIdeaTiming } from "./contentIdeasOpportunityContext";
import { simplifyUserFacingText } from "./contentIdeaOpportunity";

describe("chooseContentIdeaTiming", () => {
  it("omite o horário quando existem poucos posts", () => {
    expect(chooseContentIdeaTiming([
      { dayOfWeek: 3, hour: 19, average: 20, count: 2 },
      { dayOfWeek: 4, hour: 12, average: 10, count: 2 },
    ])).toBeNull();
  });

  it("mostra uma faixa exata apenas com base suficiente", () => {
    const result = chooseContentIdeaTiming([
      { dayOfWeek: 3, hour: 19, average: 40, count: 4 },
      { dayOfWeek: 4, hour: 12, average: 20, count: 3 },
      { dayOfWeek: 5, hour: 9, average: 10, count: 3 },
    ]);
    expect(result).toMatchObject({
      dayLabel: "Terça-feira",
      shortLabel: "Terça, 19h–21h",
      confidence: "high",
      sampleSize: 10,
    });
  });

  it("usa um período amplo quando a base é média", () => {
    const result = chooseContentIdeaTiming([
      { dayOfWeek: 3, hour: 20, average: 30, count: 2 },
      { dayOfWeek: 3, hour: 18, average: 20, count: 1 },
      { dayOfWeek: 4, hour: 10, average: 10, count: 3 },
    ]);
    expect(result).toMatchObject({
      dayLabel: "Terça-feira",
      windowLabel: "à noite",
      confidence: "medium",
    });
  });
});

describe("simplifyUserFacingText", () => {
  it("troca termos técnicos por palavras comuns antes de mostrar o texto", () => {
    expect(simplifyUserFacingText(
      "O storyboard usa um hook e um asset para ampliar a complementaridade da collab.",
    )).toBe(
      "O passo a passo do vídeo usa uma frase inicial e um elemento de cena para ampliar o que cada pessoa acrescenta à parceria.",
    );
  });

  it("não corta a última palavra pela metade", () => {
    const result = simplifyUserFacingText("Uma explicação curta que termina com uma palavra comprida", 34);
    expect(result).toMatch(/…$/);
    expect(result).not.toMatch(/compr…$/);
  });
});
