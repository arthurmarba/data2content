import { act, renderHook } from "@testing-library/react";
import {
  analysisProgressStageIndex,
  estimatedAnalysisProgress,
  useAnalysisProgress,
} from "./useAnalysisProgress";

describe("analysis progress", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("cresce de forma monotônica e nunca ultrapassa 94 enquanto aguarda o backend", () => {
    expect(estimatedAnalysisProgress(0)).toBe(0);
    expect(estimatedAnalysisProgress(1_600)).toBe(14);
    expect(estimatedAnalysisProgress(10_400)).toBe(58);
    expect(estimatedAnalysisProgress(60_000)).toBe(94);
  });

  it("mapeia o percentual para a etapa editorial correta", () => {
    expect(analysisProgressStageIndex(0)).toBe(0);
    expect(analysisProgressStageIndex(38)).toBe(2);
    expect(analysisProgressStageIndex(89)).toBe(4);
    expect(analysisProgressStageIndex(94)).toBe(5);
    expect(analysisProgressStageIndex(100)).toBe(6);
  });

  it("só alcança 100 depois que a análise foi concluída", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-10T12:00:00.000Z"));
    const { result, rerender } = renderHook(
      ({ complete }) => useAnalysisProgress({ active: true, complete, resetKey: 1 }),
      { initialProps: { complete: false } },
    );

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(result.current.progress).toBe(94);

    rerender({ complete: true });
    act(() => {
      jest.advanceTimersByTime(700);
    });
    expect(result.current.progress).toBe(100);
  });
});
