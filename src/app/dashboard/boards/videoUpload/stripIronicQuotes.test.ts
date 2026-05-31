import { stripIronicQuotes } from "./contentIdeasTextHygiene";

describe("stripIronicQuotes", () => {
  it("remove aspas em torno de uma única palavra", () => {
    expect(stripIronicQuotes("o 'caos' de não ter equipe")).toBe("o caos de não ter equipe");
    expect(stripIronicQuotes("minhas 'aulas' que nascem da vida")).toBe("minhas aulas que nascem da vida");
    expect(stripIronicQuotes("seu jeito de 'ensinar'")).toBe("seu jeito de ensinar");
  });

  it("trata aspas curvas e duplas também", () => {
    expect(stripIronicQuotes("o ‘caos’ virou método")).toBe("o caos virou método");
    expect(stripIronicQuotes("a “falta” que te move")).toBe("a falta que te move");
  });

  it("NÃO mexe em contrações (sem par de aspas)", () => {
    expect(stripIronicQuotes("um pouco d'água no rosto")).toBe("um pouco d'água no rosto");
  });

  it("NÃO toca em citações com mais de uma palavra", () => {
    const frase = "ele disse 'criar sozinho é difícil' e seguiu";
    expect(stripIronicQuotes(frase)).toBe(frase);
  });

  it("limpa múltiplas ocorrências na mesma frase", () => {
    expect(stripIronicQuotes("entre 'caos' e 'ordem'")).toBe("entre caos e ordem");
  });
});
