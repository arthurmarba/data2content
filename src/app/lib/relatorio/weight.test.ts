import {
  confidenceOf,
  effectiveSampleSize,
  evidenceLevelOf,
  forceMagnitude,
  forceOf,
  WEIGHT_K,
} from "./weight";

const round = (value: number) => Math.round(value * 100) / 100;

describe("forceOf — a repetição vira força", () => {
  it("reproduz o exemplo combinado: a caneca não passa na frente da boneca", () => {
    // Visto 1× com 3,0× é indício; visto 4× com 2,2× é mais confiável apesar do
    // multiplicador menor. É este o comportamento que substitui o corte.
    const caneca = forceOf(3.0, 1);
    const boneca = forceOf(2.2, 4);
    expect(round(caneca)).toBe(1.33);
    expect(round(boneca)).toBe(1.53);
    expect(boneca).toBeGreaterThan(caneca);
  });

  it("nada é excluído — o visto uma vez continua com força acima de 1", () => {
    expect(forceOf(3.0, 1)).toBeGreaterThan(1);
  });

  it("quanto mais se repete, menos é puxado para o 1,0×", () => {
    const forcas = [1, 2, 5, 20, 100].map((n) => forceOf(2, n));
    for (let i = 1; i < forcas.length; i += 1) {
      expect(forcas[i]!).toBeGreaterThan(forcas[i - 1]!);
    }
    // No limite, a força encosta no índice verdadeiro sem nunca ultrapassá-lo.
    expect(forceOf(2, 100_000)).toBeLessThan(2);
    expect(round(forceOf(2, 100_000))).toBe(2);
  });

  it("com n = K a linha carrega exatamente metade da própria força", () => {
    expect(forceOf(3, WEIGHT_K)).toBeCloseTo(2, 10);
  });

  it("puxa para o 1,0× dos DOIS lados — indício fraco também é só indício", () => {
    // 0,2× visto uma vez não pode liderar a leitura de "pare de fazer isso".
    expect(round(forceOf(0.2, 1))).toBe(0.87);
    expect(round(forceOf(0.2, 20))).toBe(0.36);
  });

  it("sem observação não há o que afirmar: força é 1,0×", () => {
    expect(forceOf(3, 0)).toBe(1);
    expect(forceOf(Number.NaN, 10)).toBe(1);
  });
});

describe("forceMagnitude — ordenar sem esconder o que puxa para baixo", () => {
  it("trata os dois lados como igualmente informativos", () => {
    expect(forceMagnitude(1.6, 20)).toBeCloseTo(forceMagnitude(0.4, 20), 10);
  });

  it("uma queda forte e repetida vence uma alta fraca e isolada", () => {
    expect(forceMagnitude(0.3, 30)).toBeGreaterThan(forceMagnitude(1.4, 1));
  });
});

describe("effectiveSampleSize — Regra 2 sem excluir ninguém", () => {
  it("uma pessoa nunca soma mais que três observações de confiança", () => {
    expect(effectiveSampleSize(20, 1)).toBe(3);
    expect(effectiveSampleSize(2, 1)).toBe(2);
  });

  it("gente diferente soma de verdade", () => {
    expect(effectiveSampleSize(9, 3)).toBe(9);
    expect(effectiveSampleSize(12, 4)).toBe(12);
  });

  it("9 posts de 1 pessoa perdem para 9 posts de 3, com o mesmo multiplicador", () => {
    const umSo = forceOf(3, effectiveSampleSize(9, 1));
    const coletivo = forceOf(3, effectiveSampleSize(9, 3));
    expect(coletivo).toBeGreaterThan(umSo);
  });
});

describe("evidenceLevelOf — a mesma coisa dita em português", () => {
  it("vai de indício a tendência conforme a repetição", () => {
    expect(evidenceLevelOf(1)).toBe("indicio");
    expect(evidenceLevelOf(2)).toBe("indicio");
    expect(evidenceLevelOf(3)).toBe("sinal");
    expect(evidenceLevelOf(7)).toBe("sinal");
    // 8 era o mínimo de aparições do corte antigo; virou a fronteira do nome.
    expect(evidenceLevelOf(8)).toBe("tendencia");
  });

  it("confiança é o mesmo n/(n+K) que a força usa — nunca divergem", () => {
    expect(confidenceOf(5)).toBeCloseTo(0.5, 10);
    expect(forceOf(2, 5) - 1).toBeCloseTo(confidenceOf(5), 10);
  });
});
