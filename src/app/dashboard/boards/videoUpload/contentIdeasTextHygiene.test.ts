import { repairMangledAccents, cleanIdeaText, stripIronicQuotes } from "./contentIdeasTextHygiene";

describe("repairMangledAccents", () => {
  it("conserta um acento mutilado no meio da palavra", () => {
    expect(repairMangledAccents("com a cabe00e7a no surf")).toBe("com a cabeça no surf");
  });

  it("conserta acentos em sequência (ç + õ encostados)", () => {
    expect(repairMangledAccents("imperfei00e700f5es")).toBe("imperfeições");
  });

  it("cobre a faixa de acentos do português (á ê ç ã ó)", () => {
    expect(repairMangledAccents("00e1gua")).toBe("água"); // á
    expect(repairMangledAccents("voc00ea")).toBe("você"); // ê
    expect(repairMangledAccents("cora00e700e3o")).toBe("coração"); // ç + ã encostados
    expect(repairMangledAccents("av00f3")).toBe("avó"); // ó
  });

  it("conserta maiúsculas acentuadas (À–Ý)", () => {
    expect(repairMangledAccents("00c1gua")).toBe("Água"); // Á
  });

  it("NÃO toca sequência isolada por espaços (sem letra adjacente)", () => {
    expect(repairMangledAccents("custa 00e7 reais")).toBe("custa 00e7 reais");
  });

  it("NÃO toca codepoints fora da faixa de letras (a0–bf: símbolos)", () => {
    // 00aa (ª) está fora de [c-f] → não decodifica
    expect(repairMangledAccents("1a00aa")).toBe("1a00aa");
  });

  it("string vazia/limpa passa intacta", () => {
    expect(repairMangledAccents("")).toBe("");
    expect(repairMangledAccents("texto sem acento mutilado")).toBe("texto sem acento mutilado");
  });
});

describe("cleanIdeaText", () => {
  it("conserta acento E remove aspas irônicas, na ordem certa", () => {
    expect(cleanIdeaText("a 'cabe00e7a' no jogo")).toBe("a cabeça no jogo");
  });

  it("é idempotente em texto já limpo", () => {
    const clean = "Como eu estudo medicina com a cabeça no surf";
    expect(cleanIdeaText(clean)).toBe(clean);
  });
});

describe("stripIronicQuotes (regressão)", () => {
  it("remove aspas em volta de uma palavra", () => {
    expect(stripIronicQuotes("o 'caos' do dia")).toBe("o caos do dia");
  });
});
