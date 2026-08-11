import { buildVideoNarrativeFallbackSampleTimes } from "./videoNarrativeOpenAiFallback";

describe("videoNarrativeOpenAiFallback", () => {
  it("amostra abertura, desenvolvimento e fechamento sem repetir quadros", () => {
    const samples = buildVideoNarrativeFallbackSampleTimes(60);
    expect(samples).toHaveLength(6);
    expect(samples.slice(0, 3)).toEqual([0.1, 1.5, 3]);
    expect(samples.at(-1)).toBe(59.5);
    expect(new Set(samples).size).toBe(samples.length);
  });

  it("mantém amostras válidas em vídeo curto", () => {
    const samples = buildVideoNarrativeFallbackSampleTimes(2);
    expect(samples.length).toBeGreaterThanOrEqual(3);
    expect(samples.every((value) => value > 0 && value < 2)).toBe(true);
  });
});
