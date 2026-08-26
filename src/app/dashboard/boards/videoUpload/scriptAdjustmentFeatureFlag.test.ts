import { isCreatorStructureEvidenceEnabled, isScriptAdjustmentEnabled } from "./scriptAdjustmentFeatureFlag";

describe("scriptAdjustmentFeatureFlag", () => {
  it("fica ativo por padrão e permite rollback explícito", () => {
    expect(isScriptAdjustmentEnabled({})).toBe(true);
    expect(isScriptAdjustmentEnabled({ VIDEO_NARRATIVE_SCRIPT_ADJUSTMENT_ENABLED: "0" })).toBe(false);
  });

  it("desliga evidência do criador separadamente", () => {
    expect(isCreatorStructureEvidenceEnabled({})).toBe(true);
    expect(isCreatorStructureEvidenceEnabled({ VIDEO_NARRATIVE_SCRIPT_ADJUSTMENT_CREATOR_ENABLED: "0" })).toBe(false);
  });
});

