import { splitChipLabel, sanitizeChipArray } from "./normalizeChipLabel";

describe("splitChipLabel", () => {
  it("dropa o cabeçalho de cena genérico e mantém só os específicos", () => {
    expect(splitChipLabel("Cenários externos (praia, metrô, áreas verdes)")).toEqual([
      "Praia",
      "Metrô",
      "Áreas verdes",
    ]);
  });

  it("dropa 'Equipamentos' (cabeçalho) e capitaliza os específicos, inclusive acentuados", () => {
    expect(splitChipLabel("Equipamentos de gravação (câmeras, microfones)")).toEqual([
      "Câmeras",
      "Microfones",
    ]);
  });

  it("preserva o núcleo quando NÃO é cabeçalho de cena (territórios/temas)", () => {
    expect(splitChipLabel("Família (esposa, filhos)")).toEqual(["Família", "Esposa", "Filhos"]);
  });

  it("mantém intacto parêntese sem vírgula (nome/especificação é sinal)", () => {
    expect(splitChipLabel("A esposa (Lívia Linhares)")).toEqual(["A esposa (Lívia Linhares)"]);
  });

  it("dropa cabeçalho de cena genérico isolado (sem específicos)", () => {
    expect(splitChipLabel("Cenários externos")).toEqual([]);
    expect(splitChipLabel("Cenários internos")).toEqual([]);
    expect(splitChipLabel("Objetos de cena")).toEqual([]);
    expect(splitChipLabel("Internos")).toEqual([]);
  });

  it("NÃO dropa temas/territórios que só começam com 'objeto'/'cenário'", () => {
    expect(splitChipLabel("Objeto de desejo")).toEqual(["Objeto de desejo"]);
    expect(splitChipLabel("Cenário do crime")).toEqual(["Cenário do crime"]);
  });

  it("devolve rótulo simples sem alteração (idempotente)", () => {
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
  it("achata rótulos empacotados, dropa cabeçalhos de cena e dedupa entre itens", () => {
    expect(
      sanitizeChipArray([
        "Cenários externos (praia, metrô)",
        "Praia",
        "Equipamentos de gravação (câmeras, microfones)",
      ]),
    ).toEqual([
      "Praia",
      "Metrô",
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
