import { buildAttentionInsight, buildPropagationInsight } from "./audienceAttentionInsights";
import type { AverageResult } from "@/utils/getAverageEngagementByGrouping";

const r = (name: string, value: number, postsCount: number): AverageResult => ({ name, value, postsCount });

describe("buildAttentionInsight", () => {
  it("picks the context leader by retention when it stands out", () => {
    const result = buildAttentionInsight({
      context: [
        r("Desenvolvimento Pessoal", 0.72, 12),  // líder destacado
        r("Estilo de Vida e Bem-Estar", 0.41, 30),
        r("Relacionamentos/Família", 0.38, 20),
      ],
    });
    expect(result?.label).toBe("Desenvolvimento Pessoal");
    expect(result?.kind).toBe("attention");
    expect(result?.grouping).toBe("context");
  });

  it("returns null on near-tie", () => {
    const result = buildAttentionInsight({
      context: [
        r("A", 0.61, 20),
        r("B", 0.58, 18),  // muito próximo do líder
      ],
    });
    expect(result).toBeNull();
  });

  it("returns null when only one bucket has volume", () => {
    const result = buildAttentionInsight({
      context: [r("A", 0.9, 20), r("B", 0.1, 2)],  // B abaixo do piso
    });
    expect(result).toBeNull();
  });

  it("falls through to tone when context has no standout", () => {
    const result = buildAttentionInsight({
      context: [r("A", 0.5, 20), r("B", 0.48, 20)],  // empate
      tone: [r("Íntimo", 0.78, 15), r("Direto", 0.40, 20)],  // destaque claro
    });
    expect(result?.grouping).toBe("tone");
    expect(result?.label).toBe("Íntimo");
  });

  it("returns null when all buckets are empty", () => {
    expect(buildAttentionInsight({})).toBeNull();
  });
});

describe("buildPropagationInsight", () => {
  it("picks the leader by shares", () => {
    const result = buildPropagationInsight({
      context: [
        r("Pessoal e Profissional", 4.5, 10),
        r("Estilo de Vida e Bem-Estar", 1.2, 25),
      ],
    });
    expect(result?.label).toBe("Pessoal e Profissional");
    expect(result?.kind).toBe("propagation");
  });

  it("excludes commercial labels from propagation", () => {
    const result = buildPropagationInsight({
      tone: [
        r("Promocional/Comercial", 9.0, 20),  // descartado
        r("Inspirador/Motivacional", 3.5, 25),
        r("Humorístico", 1.2, 15),
      ],
    });
    // Comercial excluído → só Inspirador e Humorístico → Inspirador lidera
    expect(result?.label).toBe("Inspirador/Motivacional");
  });

  it("returns null when no standout exists after excluding commercial", () => {
    const result = buildPropagationInsight({
      tone: [
        r("Promocional/Comercial", 9.0, 20),  // único com volume → excluído
      ],
    });
    expect(result).toBeNull();
  });
});
