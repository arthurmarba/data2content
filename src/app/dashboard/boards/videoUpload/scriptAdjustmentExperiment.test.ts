import { resolveScriptAdjustmentExperiment } from "./scriptAdjustmentExperiment";

describe("scriptAdjustmentExperiment", () => {
  it("entrega a experiência completa quando o experimento está desligado", () => {
    expect(resolveScriptAdjustmentExperiment({ userId: "user-a", env: {} })).toBe("personalized");
  });

  it("mantém a mesma pessoa no mesmo grupo", () => {
    const env = { VIDEO_NARRATIVE_SCRIPT_ADJUSTMENT_EXPERIMENT_ENABLED: "1" };
    expect(resolveScriptAdjustmentExperiment({ userId: "user-a", env })).toBe(
      resolveScriptAdjustmentExperiment({ userId: "user-a", env }),
    );
  });

  it("rollback coloca todos no controle", () => {
    expect(resolveScriptAdjustmentExperiment({
      userId: "user-a",
      env: { VIDEO_NARRATIVE_SCRIPT_ADJUSTMENT_ENABLED: "0", VIDEO_NARRATIVE_SCRIPT_ADJUSTMENT_EXPERIMENT_ENABLED: "1" },
    })).toBe("control");
  });
});

