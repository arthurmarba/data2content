import { splitChipLabel, sanitizeChipArray } from "./normalizeChipLabel";

describe("splitChipLabel", () => {
  it("quebra exemplos empacotados em vários chips curtos", () => {
    expect(splitChipLabel("Cenários externos (praia, metrô, áreas verdes)")).toEqual([
      "Cenários externos",
      "Praia",
      "Metrô",
      "Áreas verdes",
    ]);
  });

  it("capitaliza a primeira letra de cada exemplo, inclusive acentuada", () => {
    expect(splitChipLabel("Equipamentos de gravação (câmeras, microfones)")).toEqual([
      "Equipamentos de gravação",
      "Câmeras",
      "Microfones",
    ]);
  });

  it("mantém intacto parêntese sem vírgula (nome/especificação é sinal)", () => {
    expect(splitChipLabel("A esposa (Lívia Linhares)")).toEqual(["A esposa (Lívia Linhares)"]);
  });

  it("devolve rótulo simples sem alteração (idempotente)", () => {
    expect(splitChipLabel("Cenários externos")).toEqual(["Cenários externos"]);
    expect(splitChipLabel("Chihuahua")).toEqual(["Chihuahua"]);
  });

  it("colapsa espaços e apara as bordas", () => {
    expect(splitChipLabel("  Gosta   de  cozinhar  ")).toEqual(["Gosta de cozinhar"]);
  });

  it("dedupa quando o núcleo repete um exemplo", () => {
    expect(splitChipLabel("Praia (praia, sol)")).toEqual(["Praia", "Sol"]);
  });

  it("retorna vazio para entrada vazia", () => {
    expect(splitChipLabel("")).toEqual([]);
    expect(splitChipLabel("   ")).toEqual([]);
  });
});

describe("sanitizeChipArray", () => {
  it("achata rótulos empacotados e dedupa entre itens", () => {
    expect(
      sanitizeChipArray([
        "Cenários externos (praia, metrô)",
        "Praia",
        "Equipamentos de gravação (câmeras, microfones)",
      ]),
    ).toEqual([
      "Cenários externos",
      "Praia",
      "Metrô",
      "Equipamentos de gravação",
      "Câmeras",
      "Microfones",
    ]);
  });

  it("limita o total ao cap", () => {
    const result = sanitizeChipArray(["A (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13)"], 4);
    expect(result).toHaveLength(4);
  });

  it("ignora entradas não-array", () => {
    expect(sanitizeChipArray(null)).toEqual([]);
    expect(sanitizeChipArray(undefined)).toEqual([]);
    expect(sanitizeChipArray("texto")).toEqual([]);
  });

  it("é idempotente sobre um array já normalizado", () => {
    const once = sanitizeChipArray(["Cenários externos (praia, metrô)"]);
    expect(sanitizeChipArray(once)).toEqual(once);
  });
});
